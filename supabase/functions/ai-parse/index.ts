import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';
import { logAiUsage } from '../_shared/aiUsage.ts';

// ─────────────────────────────────────────────────────────────────────────────
// ai-parse — Fase 2 della comprensione PMOAi (Ruolo A: LLM solo TRADUTTORE).
//
// Riceve SOLO il testo del comando + contesto neutro (data odierna, campi,
// istruttori). NON riceve mai l'archivio soci/prenotazioni. Restituisce lo
// stesso shape di `PMOAi.parse`: { intent, slots, confidence, missing }.
// La risoluzione nome→socio, le query e l'esecuzione restano LOCALI nell'app.
//
// Modello: Gemini 2.5 Flash (Google AI Studio), tier a pagamento (no training
// sui dati). thinkingBudget=0 → niente ragionamento, parsing secco e veloce.
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
const GEMINI_TIMEOUT_MS = 8000;

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

const SYSTEM_PROMPT = `Sei il parser di un assistente per lo STAFF di un circolo di padel.
Il tuo UNICO compito è capire un comando in italiano e tradurlo in JSON strutturato.
NON esegui azioni, NON inventi dati, NON conosci l'elenco dei soci o delle prenotazioni.

INTENT possibili (scegline ESATTAMENTE uno):
- PRENOTA: creare una prenotazione/partita/lezione. Es: "prenota campo 2 domani 18-19:30 Mario".
- CANCELLA: annullare una prenotazione esistente. Es: "annulla la partita di Mario domani".
- TROVA: interrogare/leggere (chi gioca, campi liberi, elenco). Es: "chi gioca sabato alle 18", "campi liberi domani".
- CORREGGI: modificare una prenotazione esistente (sposta/cambia campo, ora, giocatori). Es: "sposta al campo 3 alle 19".
- ANAGRAFICA: creare o aggiornare un socio. Es: "aggiungi socio Mario Rossi, uomo, livello 3.5", "aggiorna il livello di Anna a 4".
- RICORRENZA: prenotazione ricorrente. Es: "prenota campo 1 ogni martedì alle 19".
- SUGGERISCI: richiesta di suggerimento/ottimizzazione (raro). Es: "come riempio i buchi di sabato".
- UNKNOWN: se non capisci o non è pertinente al circolo.

REGOLE DI ESTRAZIONE SLOT:
- date: data in formato YYYY-MM-DD. Risolvi "oggi/domani/dopodomani/lunedì…" usando la data ODIERNA fornita nel messaggio. Se non indicata, null.
- court: numero del campo (intero). "campo 2", "cmp2", "c3" → 2,3. Se non indicato, null.
- time: orario di INIZIO in formato HH:MM 24h. "alle 18", "18:30", "le quattordici"→14:00, "mezzogiorno"→12:00. Se non indicato, null.
- timeEnd: orario di FINE HH:MM se presente (es. "18-19:30" → time 18:00, timeEnd 19:30). Altrimenti null.
- duration: durata in MINUTI se espressa (es. "90 minuti", "un'ora e mezza"→90). Altrimenti null.
- type: "lezione" se è una lezione (con istruttore/maestro), altrimenti "partita". null se non deducibile.
- instructor: nome dell'istruttore/maestro come STRINGA, se citato. Altrimenti null.
- who: nome del giocatore/socio principale come STRINGA così com'è scritto (NON risolvere, NON correggere). Es. "di Mario Rossi" → "Mario Rossi". Altrimenti null.
- names: array di nomi giocatori se ne compaiono più d'uno. Altrimenti null.
- gender: "uomo" o "donna" SOLO per ANAGRAFICA. Altrimenti null.
- level: livello come STRINGA (es. "3.5", "4") SOLO per ANAGRAFICA. Altrimenti null.
- phone: numero di telefono come STRINGA (solo cifre/spazi) SOLO per ANAGRAFICA. Altrimenti null.
- email: email SOLO per ANAGRAFICA. Altrimenti null.
- recurring: giorno della settimana della ricorrenza (es. "martedì") per RICORRENZA. Altrimenti null.

confidence: 0..1, quanto sei sicuro dell'intent e degli slot.
missing: elenco di slot OBBLIGATORI mancanti. Per PRENOTA gli obbligatori sono ["court","time"] (aggiungi "date" se manca la data).

Restituisci SOLO l'oggetto JSON conforme allo schema. Nessun testo extra.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    intent: {
      type: 'STRING',
      enum: ['PRENOTA', 'CANCELLA', 'TROVA', 'CORREGGI', 'ANAGRAFICA', 'RICORRENZA', 'SUGGERISCI', 'UNKNOWN'],
    },
    confidence: { type: 'NUMBER' },
    slots: {
      type: 'OBJECT',
      properties: {
        date: { type: 'STRING', nullable: true },
        court: { type: 'INTEGER', nullable: true },
        time: { type: 'STRING', nullable: true },
        timeEnd: { type: 'STRING', nullable: true },
        duration: { type: 'INTEGER', nullable: true },
        type: { type: 'STRING', nullable: true },
        instructor: { type: 'STRING', nullable: true },
        who: { type: 'STRING', nullable: true },
        names: { type: 'ARRAY', items: { type: 'STRING' }, nullable: true },
        gender: { type: 'STRING', nullable: true },
        level: { type: 'STRING', nullable: true },
        phone: { type: 'STRING', nullable: true },
        email: { type: 'STRING', nullable: true },
        recurring: { type: 'STRING', nullable: true },
      },
    },
    missing: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['intent', 'confidence', 'slots', 'missing'],
  propertyOrdering: ['intent', 'confidence', 'slots', 'missing'],
};

function buildUserMessage(text: string, today: string, courts: string, instructors: string) {
  const lines = [`Comando: "${text}"`, `Data odierna (per risolvere oggi/domani/giorni): ${today}`];
  if (courts) lines.push(`Campi disponibili: ${courts}`);
  if (instructors) lines.push(`Istruttori del circolo: ${instructors}`);
  return lines.join('\n');
}

// Rimuove le chiavi a null/'' dagli slot → l'app riceve solo ciò che esiste,
// esattamente come fa oggi `PMOAi.parse` (che aggiunge la chiave solo se valorizzata).
function pruneSlots(raw: unknown): JsonMap {
  const out: JsonMap = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as JsonMap)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
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
          temperature: 0,
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

  const text = clean(body.text);
  if (!text) return err(400, 'INVALID_TEXT', 'Campo "text" richiesto.');

  const ctx = (body.context && typeof body.context === 'object') ? body.context as JsonMap : {};
  const today = clean(ctx.today) || new Date().toISOString().slice(0, 10);
  const courts = Array.isArray(ctx.courts) ? ctx.courts.join(', ') : clean(ctx.courts);
  const instructors = Array.isArray(ctx.instructors) ? ctx.instructors.join(', ') : clean(ctx.instructors);

  const userMessage = buildUserMessage(text, today, courts, instructors);

  let result: JsonMap;
  try {
    result = await callGemini(apiKey, userMessage);
  } catch (geminiErr) {
    // Errore/timeout: l'app farà fallback alle regole locali.
    const msg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
    return err(502, 'GEMINI_ERROR', msg);
  }

  const out = result.parsed as JsonMap;
  const intent = clean(out.intent) || 'UNKNOWN';
  const slots = pruneSlots(out.slots);
  const missing = Array.isArray(out.missing) ? out.missing.map((m) => clean(m)).filter(Boolean) : [];
  let confidence = Number(out.confidence);
  if (!Number.isFinite(confidence)) confidence = 0;
  confidence = Math.max(0, Math.min(1, confidence));

  await logAiUsage('ai-parse', result.usage as Record<string, unknown> | null, actor.email);

  return ok({
    intent: intent === 'UNKNOWN' ? null : intent,
    slots,
    confidence,
    missing,
    source: 'gemini',
    usage: result.usage ?? null,
  });
});
