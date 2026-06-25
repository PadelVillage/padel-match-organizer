import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// ai-propose-lexicon — Fase 3b autoapprendimento PMOAi (routine in background).
//
// Invocata OGNI ORA da pg_cron (pmo_dispatch_ai_lexicon_proposals → net.http_post,
// header x-pmo-routine-secret). Guarda nel diario (pmo_ai_turns) le frasi che le
// REGOLE non hanno capito (source='gemini') o che lo staff ha dovuto riformulare,
// chiede a Gemini di estrarre il modo di dire nuovo + la parola-base + esempi, e
// deposita una PROPOSTA (pmo_lessico status='proposed'). L'approvazione resta UMANA.
//
// Niente archivi soci/prenotazioni: legge solo le utterance del diario.
// ─────────────────────────────────────────────────────────────────────────────

type JsonMap = Record<string, unknown>;

type StaffActor = {
  userId: string;
  email: string;
  role: string;
  permissions: JsonMap;
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pmo-routine-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_TIMEOUT_MS = 12000;
const LOOKBACK_MINUTES = 70;       // routine oraria: sovrapposizione con la cadenza → niente buchi
const MAX_UTTERANCES = 15;         // routine: tetto per giro (di solito 0-2 candidati)
const MANUAL_MAX_UTTERANCES = 50;  // "Analizza ora" manuale: guarda TUTTO il non-rivisto
const MAX_PROPOSALS = 10;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}
function ok(body: JsonMap) { return json({ ok: true, ...body }); }
function err(status: number, code: string, message: string, extra: JsonMap = {}) { return json({ ok: false, error: code, message, ...extra }, status); }
function clean(value: unknown) { return String(value ?? '').trim(); }
function fold(s: string) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

async function verifyRoutineSecret(admin: ReturnType<typeof createClient>, secret: string) {
  const value = clean(secret);
  if (!value) return false;
  const { data, error } = await admin.rpc('pmo_verify_data_routine_secret', { p_secret: value });
  if (error) return false;
  return data === true;
}

// Staff loggato (bottone "Analizza ora"): stesso schema di ai-lex-examples / ai-parse.
function hasPermission(actor: StaffActor, perm: string) {
  if (['owner', 'admin'].includes(actor.role)) return true;
  return actor.permissions?.[perm] === true;
}
async function getActor(req: Request): Promise<StaffActor | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const token = clean(req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token || !supabaseUrl || !anonKey) return null;
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: userData, error } = await authClient.auth.getUser(token);
  if (error || !userData?.user) return null;
  const { data: profileData, error: profileError } = await authClient.rpc('pmo_get_my_staff_profile');
  if (profileError || !profileData) return null;
  const profile = Array.isArray(profileData) ? profileData[0] : profileData;
  if (!profile || profile.status !== 'active') return null;
  return {
    userId: userData.user.id,
    email: clean(userData.user.email),
    role: clean(profile.role),
    permissions: (profile.permissions && typeof profile.permissions === 'object') ? profile.permissions : {},
  };
}

const SYSTEM_PROMPT = `Sei l'assistente in italiano di un circolo di PADEL, al servizio dello STAFF.
Ti do alcune frasi che lo staff ha scritto e che il parser A REGOLE NON ha capito da solo.
Per OGNI frase, valuta se contiene una PAROLA o ESPRESSIONE NUOVA (un modo di dire) che converrebbe
insegnare al parser, e a quale PAROLA-BASE già nota corrisponde:
- comandi noti: prenota, annulla, sposta, modifica, riduci, allunga, sposta, aggiungi, togli;
- conferme note: sì, no, procedi.

Per ogni frase restituisci un elemento con:
- surface: la parola/espressione nuova da insegnare, in minuscolo (es. "butta giù"). Vuota se niente da imparare.
- canonical: la parola-base nota corrispondente (es. "annulla"). Vuota se niente.
- domain: "prenotazione", "anagrafica" o "" (entrambi/non chiaro).
- skip: true se la frase NON contiene un chiaro modo di dire nuovo (era un refuso, un nome, dati già
  comprensibili, o troppo ambigua). In tal caso surface/canonical vuoti.
- examples: se NON skip, 2-3 frasi BREVI e naturali che usano "surface" (esattamente), con "intende"
  (cosa fa). Se skip, lista vuota.

Sii prudente: meglio skip che inventare un termine inutile. Rispondi SOLO con il JSON dello schema.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          surface: { type: 'STRING' },
          canonical: { type: 'STRING' },
          domain: { type: 'STRING' },
          skip: { type: 'BOOLEAN' },
          examples: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: { phrase: { type: 'STRING' }, intende: { type: 'STRING' } },
              required: ['phrase', 'intende'],
              propertyOrdering: ['phrase', 'intende'],
            },
          },
        },
        required: ['surface', 'canonical', 'domain', 'skip', 'examples'],
        propertyOrdering: ['surface', 'canonical', 'domain', 'skip', 'examples'],
      },
    },
  },
  required: ['items'],
  propertyOrdering: ['items'],
};

async function callGemini(apiKey: string, userMessage: string): Promise<JsonMap> {
  let lastErr: Error = new Error('Gemini non raggiungibile');
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), GEMINI_TIMEOUT_MS);
    let resp: Response;
    try {
      resp = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: userMessage }] }],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA, thinkingConfig: { thinkingBudget: 0 } },
        }),
      });
    } finally { clearTimeout(timer); }
    const bodyText = await resp.text();
    if (resp.ok) {
      const payload = JSON.parse(bodyText) as JsonMap;
      const candidate = (payload.candidates as JsonMap[] | undefined)?.[0];
      const partText = ((candidate?.content as JsonMap | undefined)?.parts as JsonMap[] | undefined)?.[0]?.text;
      if (typeof partText !== 'string') throw new Error('Risposta Gemini senza testo');
      return { parsed: JSON.parse(partText), usage: payload.usageMetadata ?? null };
    }
    lastErr = new Error(`Gemini HTTP ${resp.status}: ${bodyText.slice(0, 200)}`);
    if ((resp.status === 503 || resp.status === 429) && attempt < 2) { await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); continue; }
    throw lastErr;
  }
  throw lastErr;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return err(405, 'METHOD_NOT_ALLOWED', 'Only POST supported');

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) return err(500, 'CONFIG_MISSING', 'SUPABASE_URL / SERVICE_ROLE non configurati.');
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Due vie d'accesso: la routine schedulata (secret) oppure lo staff loggato che preme
  // "Analizza ora" nel pannello Vocabolario (token + permesso view_assistante_ai). La modalità
  // MANUALE guarda TUTTO il non-rivisto (nessun limite di tempo); la routine solo l'ultima finestra.
  const routineOk = await verifyRoutineSecret(admin, req.headers.get('x-pmo-routine-secret') || '');
  let manual = false;
  if (!routineOk) {
    const actor = await getActor(req);
    if (!actor || !hasPermission(actor, 'view_assistante_ai')) {
      return err(401, 'UNAUTHORIZED', 'Serve la routine secret oppure una sessione staff con permesso Assistente AI.');
    }
    manual = true;
  }

  const apiKey = clean(Deno.env.get('GEMINI_API_KEY'));
  if (!apiKey) return err(500, 'GEMINI_NOT_CONFIGURED', 'GEMINI_API_KEY non configurata.');

  const env = supabaseUrl.includes('qqbfphyslczzkxoncgex') ? 'prod' : 'test';

  // 1) Frasi che le REGOLE non hanno capito (Gemini è intervenuto) o riformulate.
  //    Routine: solo l'ultima finestra. Manuale: tutto (il dedup vs pmo_lessico evita di riproporre
  //    ciò che è già stato deciso → di fatto "tutto il non-rivisto").
  let filter = admin
    .from('pmo_ai_turns')
    .select('utterance,next_utterance,source,domain,outcome,created_at')
    .eq('env', env)
    .not('utterance', 'is', null)
    .or('source.eq.gemini,next_utterance.not.is.null');
  if (!manual) {
    const since = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000).toISOString();
    filter = filter.gte('created_at', since);
  }
  const { data: turns, error: turnsErr } = await filter
    .order('created_at', { ascending: false })
    .limit(manual ? MANUAL_MAX_UTTERANCES : MAX_UTTERANCES);
  if (turnsErr) return err(500, 'DIARY_READ_ERROR', turnsErr.message);

  const mode = manual ? 'manual' : 'routine';
  const list = (turns || []).filter((t) => clean(t.utterance));
  if (!list.length) return ok({ env, mode, scanned: 0, proposed: 0, note: 'Nessuna frase nuova da analizzare.' });

  // 2) Lessico esistente → dedup (qualunque stato: non riproporre ciò che è già stato deciso).
  const { data: lex } = await admin.from('pmo_lessico').select('surface,domain').eq('env', env);
  const seen = new Set((lex || []).map((r) => (clean(r.domain) || '') + '|' + clean(r.surface).toLowerCase()));

  // 3) Gemini distilla surface→canonical + esempi.
  const userMessage = 'Frasi non capite dalle regole:\n' + list
    .map((t, i) => `${i + 1}) "${clean(t.utterance)}"` + (clean(t.next_utterance) ? ` → poi riscritta come: "${clean(t.next_utterance)}"` : ''))
    .join('\n');

  let parsed: JsonMap;
  try { const r = await callGemini(apiKey, userMessage); parsed = r.parsed as JsonMap; }
  catch (e) { return err(502, 'GEMINI_ERROR', e instanceof Error ? e.message : String(e)); }

  const items = Array.isArray(parsed.items) ? parsed.items as JsonMap[] : [];

  // 4) Valida, deduplica, prepara le proposte.
  const nowIso = new Date().toISOString();
  const rows: JsonMap[] = [];
  for (let i = 0; i < items.length && rows.length < MAX_PROPOSALS; i++) {
    const it = items[i];
    if (it.skip === true) continue;
    const surface = clean(it.surface).toLowerCase();
    const canonical = clean(it.canonical);
    if (surface.length < 2 || !canonical || surface === canonical.toLowerCase()) continue;
    if (!/^[a-zà-ÿ' -]+$/.test(surface)) continue;
    const domain = (it.domain === 'prenotazione' || it.domain === 'anagrafica') ? it.domain : null;
    const key = (domain || '') + '|' + surface;
    if (seen.has(key)) continue;
    seen.add(key);
    const fromUtt = clean(list[i]?.utterance);
    const exArr = Array.isArray(it.examples) ? it.examples as JsonMap[] : [];
    const examples = exArr
      .map((e) => clean(e.phrase))
      .filter((p) => p && fold(p).includes(fold(surface)))
      .slice(0, 3);
    rows.push({
      env, domain, surface, canonical, kind: 'sinonimo', status: 'proposed', source: 'gemini-distill',
      examples, meta: { from: fromUtt, mined_at: nowIso, via: 'ai-propose-lexicon' },
    });
  }

  if (!rows.length) return ok({ env, mode, scanned: list.length, proposed: 0, note: 'Nessun nuovo termine da proporre.' });

  const { error: insErr } = await admin
    .from('pmo_lessico')
    .upsert(rows, { onConflict: 'env,domain,surface', ignoreDuplicates: true });
  if (insErr) return err(500, 'INSERT_ERROR', insErr.message);

  return ok({ env, mode, scanned: list.length, proposed: rows.length, surfaces: rows.map((r) => r.surface) });
});
