import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// ai-lex-examples — Verifica del Vocabolario (lessico) PMOAi.
//
// Lo staff sta insegnando che «surface» significa «canonical» (una parola/frase
// che l'assistente già capisce). Questa funzione chiede a Gemini di GENERARE
// alcune frasi naturali che usano «surface» in contesto, con una breve spiegazione
// di cosa intende fare — così lo staff vede se l'assistente "ha capito" il termine,
// prima di approvarlo. NON tocca archivi soci/prenotazioni. Solo testo + contesto.
//
// Modello: Gemini 2.5 Flash (Google AI Studio). thinkingBudget=0 → veloce.
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
const GEMINI_TIMEOUT_MS = 9000;

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

const SYSTEM_PROMPT = `Sei l'assistente in italiano di un circolo di PADEL, al servizio dello STAFF.
Lo staff ti insegna un nuovo modo di dire: ti indica una PAROLA o FRASE NUOVA e il suo SIGNIFICATO
(un termine che già capisci: un comando come prenota, annulla, sposta, modifica, riduci, allunga,
oppure una conferma/rifiuto come sì, no, procedi).

COMPITO: genera da 4 a 5 frasi BREVI e NATURALI che un gestore del circolo scriverebbe DAVVERO
USANDO la parola/frase nuova, e per ciascuna spiega in una riga, in italiano semplice, COSA intende fare.

REGOLE:
- OBBLIGATORIO: ogni frase deve contenere la PAROLA/FRASE NUOVA così com'è (non coniugarla, non
  sostituirla con un sinonimo). NON scrivere mai le parole letterali "PAROLA" o "SIGNIFICATO":
  usa sempre i valori reali che ti vengono dati.
- Varia i contesti: campo, orario, giorno, giocatori, lezione/partita (per i comandi); per una conferma,
  brevi risposte affermative/negative dentro una conversazione.
- Frasi realistiche e concise, come messaggi veloci. Usa nomi generici.
- "intende": una riga, l'azione concreta (es. "annulla la prenotazione di campo 2 di domani").
- Se il SIGNIFICATO non è un'azione/conferma sensata, restituisci examples = [] con una breve nota.

Rispondi SOLO con l'oggetto JSON conforme allo schema. Nessun testo extra.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    examples: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          phrase: { type: 'STRING' },
          intende: { type: 'STRING' },
        },
        required: ['phrase', 'intende'],
        propertyOrdering: ['phrase', 'intende'],
      },
    },
    nota: { type: 'STRING', nullable: true },
  },
  required: ['examples'],
  propertyOrdering: ['examples', 'nota'],
};

function buildUserMessage(surface: string, canonical: string, domain: string) {
  const lines = [
    `PAROLA/FRASE NUOVA: «${surface}»`,
    `SIGNIFICATO (già capito): «${canonical}»`,
  ];
  if (domain) lines.push(`Ambito: ${domain}`);
  lines.push(`Scrivi le frasi usando «${surface}» (esattamente questa parola/frase) nel senso di «${canonical}».`);
  return lines.join('\n');
}

async function callGemini(apiKey: string, userMessage: string): Promise<JsonMap> {
  // Gemini va talvolta in 503/429 (sovraccarico): ritenta una volta dopo una breve attesa.
  let lastErr: Error = new Error('Gemini non raggiungibile');
  for (let attempt = 0; attempt < 2; attempt++) {
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
            temperature: 0.3,
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });
    } finally {
      clearTimeout(timer);
    }

    const bodyText = await resp.text();
    if (resp.ok) {
      let payload: JsonMap;
      try { payload = JSON.parse(bodyText); } catch { throw new Error('Risposta Gemini non JSON'); }
      const candidate = (payload.candidates as JsonMap[] | undefined)?.[0];
      const partText = ((candidate?.content as JsonMap | undefined)?.parts as JsonMap[] | undefined)?.[0]?.text;
      if (typeof partText !== 'string') throw new Error('Risposta Gemini senza testo');
      let parsed: JsonMap;
      try { parsed = JSON.parse(partText); } catch { throw new Error('JSON del modello non valido'); }
      return { parsed, usage: payload.usageMetadata ?? null };
    }

    lastErr = new Error(`Gemini HTTP ${resp.status}: ${bodyText.slice(0, 300)}`);
    if ((resp.status === 503 || resp.status === 429) && attempt === 0) {
      await new Promise((r) => setTimeout(r, 1200));
      continue;
    }
    throw lastErr;
  }
  throw lastErr;
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

  const surface = clean(body.surface);
  const canonical = clean(body.canonical);
  if (surface.length < 2 || !canonical) return err(400, 'INVALID_INPUT', 'Campi "surface" (≥2) e "canonical" richiesti.');
  const domain = clean(body.domain);

  const userMessage = buildUserMessage(surface, canonical, domain);

  let result: JsonMap;
  try {
    result = await callGemini(apiKey, userMessage);
  } catch (geminiErr) {
    const msg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
    return err(502, 'GEMINI_ERROR', msg);
  }

  const parsed = result.parsed as JsonMap;
  const rawExamples = Array.isArray(parsed.examples) ? parsed.examples as JsonMap[] : [];
  // Tieni solo le frasi che contengono davvero il termine, ma in modo tollerante:
  // confronto senza accenti/maiuscole (così «giù» ≈ «giu», «Butta» ≈ «butta»).
  const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const surfFold = fold(surface);
  const cleaned = rawExamples
    .map((e) => ({ phrase: clean(e.phrase), intende: clean(e.intende) }))
    .filter((e) => e.phrase && e.intende);
  const withTerm = cleaned.filter((e) => fold(e.phrase).includes(surfFold));
  // Preferisci le frasi che contengono il termine; se il modello non l'ha messo letteralmente
  // in nessuna (raro), mostra comunque le sue frasi invece di non dare nulla.
  const examples = (withTerm.length ? withTerm : cleaned).slice(0, 5);

  return ok({
    examples,
    nota: clean(parsed.nota) || null,
    source: 'gemini',
    usage: result.usage ?? null,
  });
});
