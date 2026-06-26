import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';
import { logAiUsage } from '../_shared/aiUsage.ts';

// ─────────────────────────────────────────────────────────────────────────────
// ai-reason — Step 3 dell'apprendimento conversazionale (layer "ragionatore").
//
// A differenza di `ai-parse` (traduttore a colpo singolo: frase → JSON di slot),
// questo edge RAGIONA sul filo del discorso (più battute) quando le regole NON
// hanno capito. Restituisce:
//   • un'INTERPRETAZIONE discorsiva di cosa intende lo staff,
//   • UN comando normalizzato che l'app può ri-parsare ed eseguire (se confidente),
//   • UNA domanda di chiarimento con opzioni-pulsante (se ambiguo),
//   • UNA proposta di apprendimento (sinonimo o pattern d'intenzione) nata
//     dall'intesa, da rivedere/approvare UMANAMENTE nel Vocabolario.
//
// Privacy come ai-parse: riceve SOLO le battute + contesto neutro (data, campi,
// istruttori). MAI l'archivio soci/prenotazioni. Nessuna scrittura: propone soltanto.
// Modello: Gemini 2.5 Flash. Auth: staff attivo + permesso view_assistante_ai.
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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_TIMEOUT_MS = 10000;
const MAX_HISTORY = 12; // battute considerate (tetto anti-abuso/costo)

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function ok(body: JsonMap) {
  return json({ ok: true, ...body });
}

function err(status: number, code: string, message: string, extra: JsonMap = {}) {
  return json({ ok: false, error: code, message, ...extra }, status);
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

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

// ── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Sei il "ragionatore" di un assistente per lo STAFF di un circolo di padel.
Le REGOLE automatiche dell'app NON hanno capito un comando: intervieni TU seguendo il filo del discorso.
NON esegui azioni, NON inventi dati, NON conosci l'elenco dei soci o delle prenotazioni: proponi soltanto.

Le AZIONI che l'app sa fare (per "comando_app" usa un italiano semplice e canonico):
- prenotare: «prenota campo 2 domani alle 18 partita Mario Rossi».
- annullare: «annulla la partita di campo 2 oggi alle 18».
- modificare/spostare: «sposta al campo 3 alle 19», «allunga di 30 minuti».
- giocatori: «aggiungi Mario alla partita», «togli un ospite», «togli Luca».
- interrogare: «chi gioca oggi alle 18», «campi liberi domani».
- anagrafica: «aggiungi socio Mario Rossi», «aggiorna il livello di Anna a 4».

COSA DEVI PRODURRE (uno o più campi, secondo il caso):
- interpretazione: in 1 frase, cosa pensi voglia lo staff (discorsivo, gentile).
- comando_app: SE sei ragionevolmente sicuro, il comando canonico equivalente che l'app può eseguire
  (una sola riga, come gli esempi sopra). Altrimenti null.
- domanda: SE è ambiguo, UNA domanda breve di chiarimento con 2-4 opzioni concrete da mostrare come
  pulsanti (campo "opzioni"). Niente domande generiche: offri scelte azionabili. Altrimenti null.
- proposta: SE riconosci un MODO DI DIRE ricorrente che varrebbe la pena insegnare alle regole, proponi:
    • tipo "sinonimo": una parola/locuzione → forma canonica (es. surface "levami", canonical "togli").
    • tipo "pattern": una frase intera → micro-azione parametrica. Compila "frase_intento" con
      { trigger_regex (regex JS, parole chiave con \\b), esempi:[…], azione (una delle azioni sopra),
      operazione (es. "rimuovi"/"aggiungi"), slot_preimpostati:{ruolo,quantita} }.
    • includi sempre "intesa" (spiegazione discorsiva) ed "esempi_test" (≥2 frasi che dovrebbero
      attivare la regola). Se non c'è nulla da imparare, tipo "nessuna".
- confidence: 0..1 sulla tua interpretazione complessiva.

PRINCIPI: massimo UNA domanda per risposta; preferisci proporre un comando_app chiaro quando puoi;
la proposta è solo un suggerimento da far approvare a un umano (non un'azione). Sii conciso.
Restituisci SOLO l'oggetto JSON conforme allo schema. Nessun testo extra.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    interpretazione: { type: 'STRING' },
    comando_app: { type: 'STRING', nullable: true },
    domanda: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        testo: { type: 'STRING' },
        opzioni: { type: 'ARRAY', items: { type: 'STRING' } },
      },
    },
    proposta: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        tipo: { type: 'STRING', enum: ['sinonimo', 'pattern', 'nessuna'] },
        surface: { type: 'STRING', nullable: true },
        canonical: { type: 'STRING', nullable: true },
        frase_intento: {
          type: 'OBJECT',
          nullable: true,
          properties: {
            trigger_regex: { type: 'STRING', nullable: true },
            esempi: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
            azione: { type: 'STRING', nullable: true },
            operazione: { type: 'STRING', nullable: true },
            slot_preimpostati: {
              type: 'OBJECT',
              nullable: true,
              properties: {
                ruolo: { type: 'STRING', nullable: true },
                quantita: { type: 'INTEGER', nullable: true },
              },
            },
          },
        },
        intesa: { type: 'STRING', nullable: true },
        esempi_test: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
      },
    },
    confidence: { type: 'NUMBER' },
  },
  required: ['interpretazione', 'confidence'],
  propertyOrdering: ['interpretazione', 'comando_app', 'domanda', 'proposta', 'confidence'],
};

function buildUserMessage(history: Array<{ role: string; text: string }>, today: string, courts: string, instructors: string) {
  const lines: string[] = [];
  lines.push(`Data odierna (per risolvere oggi/domani/giorni): ${today}`);
  if (courts) lines.push(`Campi disponibili: ${courts}`);
  if (instructors) lines.push(`Istruttori del circolo: ${instructors}`);
  lines.push('');
  lines.push('Conversazione (la più recente è in fondo):');
  for (const h of history) {
    const who = h.role === 'assistant' ? 'Assistente' : 'Staff';
    lines.push(`${who}: ${h.text}`);
  }
  return lines.join('\n');
}

async function callGemini(apiKey: string, userMessage: string): Promise<JsonMap> {
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
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          // Un minimo di ragionamento: qui serve "pensare" al filo del discorso (≠ ai-parse secco).
          thinkingConfig: { thinkingBudget: 512 },
        },
      }),
    });
  } finally {
    clearTimeout(timer);
  }

  const bodyText = await resp.text();
  if (!resp.ok) {
    throw new Error(`Gemini HTTP ${resp.status}: ${bodyText.slice(0, 500)}`);
  }

  let payload: JsonMap;
  try { payload = JSON.parse(bodyText); } catch { throw new Error('Risposta Gemini non JSON'); }

  const candidate = (payload.candidates as JsonMap[] | undefined)?.[0];
  const partText = ((candidate?.content as JsonMap | undefined)?.parts as JsonMap[] | undefined)?.[0]?.text;
  if (typeof partText !== 'string') throw new Error('Risposta Gemini senza testo');

  let parsed: JsonMap;
  try { parsed = JSON.parse(partText); } catch { throw new Error('JSON del modello non valido'); }

  return { parsed, usage: payload.usageMetadata ?? null };
}

// Normalizza l'input `history`: accetta un array di {role,text} o una semplice lista di stringhe
// (interpretate come battute dello staff). Taglia alle ultime MAX_HISTORY battute non vuote.
function normHistory(raw: unknown): Array<{ role: string; text: string }> {
  const arr = Array.isArray(raw) ? raw : [];
  const out: Array<{ role: string; text: string }> = [];
  for (const item of arr) {
    if (typeof item === 'string') {
      const t = clean(item);
      if (t) out.push({ role: 'user', text: t });
    } else if (item && typeof item === 'object') {
      const t = clean((item as JsonMap).text);
      const role = clean((item as JsonMap).role) === 'assistant' ? 'assistant' : 'user';
      if (t) out.push({ role, text: t });
    }
  }
  return out.slice(-MAX_HISTORY);
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return err(405, 'METHOD_NOT_ALLOWED', 'Only POST supported');

  const actor = await getActor(req).catch(() => null);
  if (!actor) return err(401, 'UNAUTHORIZED', 'Autenticazione richiesta.');
  if (!hasPermission(actor, 'view_assistante_ai')) {
    return err(403, 'FORBIDDEN', 'Permesso view_assistante_ai richiesto.');
  }

  const apiKey = clean(Deno.env.get('GEMINI_API_KEY'));
  if (!apiKey) return err(500, 'GEMINI_NOT_CONFIGURED', 'GEMINI_API_KEY non configurata.');

  let body: JsonMap;
  try {
    body = await req.json();
  } catch {
    return err(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }

  // Compat: accetta sia { history:[…] } sia { text:"…" } (singola battuta).
  let history = normHistory(body.history);
  if (!history.length && clean(body.text)) history = [{ role: 'user', text: clean(body.text) }];
  if (!history.length) return err(400, 'INVALID_HISTORY', 'Serve "history" (battute) o "text".');

  const ctx = (body.context && typeof body.context === 'object') ? body.context as JsonMap : {};
  const today = clean(ctx.today) || new Date().toISOString().slice(0, 10);
  const courts = Array.isArray(ctx.courts) ? ctx.courts.join(', ') : clean(ctx.courts);
  const instructors = Array.isArray(ctx.instructors) ? ctx.instructors.join(', ') : clean(ctx.instructors);

  const userMessage = buildUserMessage(history, today, courts, instructors);

  let result: JsonMap;
  try {
    result = await callGemini(apiKey, userMessage);
  } catch (geminiErr) {
    const msg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
    return err(502, 'GEMINI_ERROR', msg);
  }

  const out = (result.parsed && typeof result.parsed === 'object') ? result.parsed as JsonMap : {};
  const interpretazione = clean(out.interpretazione);
  const comando = clean(out.comando_app);

  // Domanda: solo se ha testo + almeno 1 opzione (altrimenti null → niente domanda).
  let domanda: JsonMap | null = null;
  const dRaw = out.domanda as JsonMap | null;
  if (dRaw && clean(dRaw.testo)) {
    const opzioni = Array.isArray(dRaw.opzioni) ? dRaw.opzioni.map((o) => clean(o)).filter(Boolean).slice(0, 4) : [];
    domanda = { testo: clean(dRaw.testo), opzioni };
  }

  // Proposta: passa attraverso solo se ha un tipo utile e dati minimi coerenti.
  let proposta: JsonMap | null = null;
  const pRaw = out.proposta as JsonMap | null;
  if (pRaw && clean(pRaw.tipo) && clean(pRaw.tipo) !== 'nessuna') {
    const tipo = clean(pRaw.tipo);
    const esempi = Array.isArray(pRaw.esempi_test) ? pRaw.esempi_test.map((e) => clean(e)).filter(Boolean) : [];
    if (tipo === 'sinonimo' && clean(pRaw.surface) && clean(pRaw.canonical)) {
      proposta = { tipo, surface: clean(pRaw.surface).toLowerCase(), canonical: clean(pRaw.canonical), intesa: clean(pRaw.intesa), esempi_test: esempi };
    } else if (tipo === 'pattern' && pRaw.frase_intento && typeof pRaw.frase_intento === 'object') {
      const fi = pRaw.frase_intento as JsonMap;
      const slot = (fi.slot_preimpostati && typeof fi.slot_preimpostati === 'object') ? fi.slot_preimpostati as JsonMap : {};
      proposta = {
        tipo,
        frase_intento: {
          trigger_regex: clean(fi.trigger_regex),
          esempi: Array.isArray(fi.esempi) ? fi.esempi.map((e) => clean(e)).filter(Boolean) : [],
          azione: clean(fi.azione) || null,
          operazione: clean(fi.operazione) || null,
          slot_preimpostati: { ruolo: clean(slot.ruolo) || null, quantita: Number(slot.quantita) || 1 },
        },
        intesa: clean(pRaw.intesa),
        esempi_test: esempi,
      };
    }
  }

  let confidence = Number(out.confidence);
  if (!Number.isFinite(confidence)) confidence = 0;
  confidence = Math.max(0, Math.min(1, confidence));

  await logAiUsage('ai-reason', result.usage as Record<string, unknown> | null, actor.email);

  return ok({
    interpretazione,
    comando: comando || null,
    domanda,
    proposta,
    confidence,
    source: 'gemini',
    usage: result.usage ?? null,
  });
});
