import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

// anagrafica-report-telefoni — report giornaliero via email dei soci Matchpoint il cui
// TELEFONO in anagrafica non è utilizzabile, così la segreteria li corregge a mano
// nell'admin (e da lì matchpoint-clients-update riscrive anche la scheda Matchpoint).
//
// ── Perché esiste ────────────────────────────────────────────────────────────────
// L'export Excel di Matchpoint consegna alcuni cellulari in NOTAZIONE SCIENTIFICA
// (`3,93385E+11`). Togliendo i non-cifra resta `39338511`: un numero INVENTATO, in cui
// perfino le ultime due cifre sono l'esponente. Il campo però risulta PIENO, quindi
// nessuno si accorge di nulla — e quel socio dal login non viene più trovato.
// La scheda cliente di Matchpoint mostra sempre il numero giusto: il guasto è nell'export.
//
// ── Perché l'elenco è "chi è messo male ORA" e non "chi è arrivato storpiato oggi" ──
// L'export continuerà a consegnare il moncone per sempre, quindi un elenco di "arrivati
// storpiati" riproporrebbe gli STESSI nomi ogni mattina, anche dopo che sono stati
// corretti: dopo una settimana nessuno lo apre più. Una volta corretto il numero,
// la guardia di matchpoint-clients-sync ("corto non sovrascrive pieno") lo protegge
// dagli import successivi — verificato dal vivo il 19/07 — quindi il socio sparisce
// da questo elenco l'indomani. Lista vuota = non c'è niente da fare.
//
// ── Perché la mail parte ANCHE vuota ────────────────────────────────────────────
// Se si spedisse solo quando c'è qualcosa, il silenzio significherebbe due cose
// indistinguibili: "va tutto bene" e "il lavoro schedulato è morto". Lo stato sta
// nell'OGGETTO, così si legge dall'elenco della posta senza aprire niente.
//
// Accesso: solo la routine schedulata (header x-pmo-routine-secret validato sul vault),
// come le altre funzioni chiamate da pg_cron. Con `{"preview": true}` restituisce
// l'elenco SENZA spedire: serve a collaudare senza mandare posta a nessuno.

type JsonMap = Record<string, unknown>;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pmo-routine-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_PAGE_SIZE = 1000;
const DEFAULT_REPORT_EMAIL = 'info@padelvillage.club';

// Stessa soglia di matchpoint-clients-sync: un numero italiano plausibile, dopo la
// normalizzazione, ha almeno 11 cifre ("39" + ≥9). Le due regole devono restare
// allineate, altrimenti il report segnala gente che l'import considera a posto.
const PLAUSIBLE_PHONE_MIN_DIGITS = 11;

function clean(value: unknown) { return String(value ?? '').trim(); }

function errorText(value: unknown) {
  if (value instanceof Error) return value.message || value.name || String(value);
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') { try { return JSON.stringify(value); } catch { return String(value); } }
  return String(value ?? '');
}

function isValidEmail(value: unknown) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value)); }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// VERBATIM da matchpoint-clients-sync.normalizePhone: il report deve giudicare un numero
// esattamente come lo giudica l'import, altrimenti le due parti si contraddicono.
function normalizePhone(value: unknown) {
  const raw = clean(value);
  let digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 14 && digits.startsWith('3939') && /^393\d{9}$/.test(digits.slice(2))) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('3')) digits = `39${digits}`;
  else if (digits.startsWith('0') && digits.length >= 7 && digits.length <= 11) digits = `39${digits}`;
  else if (!digits.startsWith('39') && digits.length >= 8 && digits.length <= 11) digits = `39${digits}`;
  return digits ? `+${digits}` : '';
}

function phoneDigits(value: unknown) {
  return normalizePhone(value).replace(/\D/g, '');
}

// ── Chi finisce nel report ──────────────────────────────────────────────────────
// Solo i soci Matchpoint veri (tessera a 6 cifre): sono gli unici che il login può
// cercare. Contatti Google e record PMO- sono esclusi per disegno, segnalarli sarebbe
// rumore su cui nessuno può agire.
//
// Due condizioni, e servono entrambe perché il report funzioni PRIMA e DOPO la
// correzione dell'import:
//   · telefono PRESENTE ma implausibile → il moncone di oggi;
//   · `phoneImportRejected` → il marcatore che lascerà l'import corretto, quando invece
//     di salvare una cifra falsa lascerà il campo vuoto.
// Un telefono semplicemente VUOTO e senza marcatore non è un guasto di questo tipo
// (è "Ospite", è "Tennis App"): fuori, o l'elenco nasce già sporco di due nomi fissi.
function needsAttention(payload: JsonMap) {
  const memberId = clean(payload.memberId);
  if (!/^[0-9]{6}$/.test(memberId)) return false;
  if (payload.phoneImportRejected === true) return true;
  const raw = clean(payload.phone);
  if (!raw) return false;
  return phoneDigits(raw).length < PLAUSIBLE_PHONE_MIN_DIGITS;
}

function memberName(payload: JsonMap) {
  const full = clean(payload.name);
  if (full) return full;
  return clean(`${clean(payload.firstName)} ${clean(payload.surname)}`);
}

// Il client è tipizzato `any` sullo schema: qui non esiste un `Database` generato, e senza
// quello supabase-js inferisce `undefined` per gli argomenti delle rpc, facendo fallire
// `deno check` (il gate differenziale conterebbe questi come errori NUOVI).
type Admin = ReturnType<typeof createClient<any>>;

async function verifyRoutineSecret(admin: Admin, secret: string) {
  const value = clean(secret);
  if (!value) return false;
  const { data, error } = await admin.rpc('pmo_verify_data_routine_secret', { p_secret: value });
  if (error) return false;
  return data === true;
}

// ── Email (stesso canale Gmail OAuth di google-contacts-import) ─────────────────
function base64UrlEncode(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function encodeMimeHeader(value: string) {
  const b64 = base64UrlEncode(value).replace(/-/g, '+').replace(/_/g, '/');
  return `=?UTF-8?B?${b64}${'='.repeat((4 - (b64.length % 4)) % 4)}?=`;
}

function safeHeader(value: string) { return clean(value).replace(/[\r\n]+/g, ' '); }

async function getGmailAccessToken() {
  const clientId = clean(Deno.env.get('GMAIL_CLIENT_ID'));
  const clientSecret = clean(Deno.env.get('GMAIL_CLIENT_SECRET'));
  const refreshToken = clean(Deno.env.get('GMAIL_REFRESH_TOKEN'));
  if (!clientId || !clientSecret || !refreshToken) throw new Error('GMAIL_SECRETS_MISSING');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: refreshToken, grant_type: 'refresh_token',
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.access_token) {
    throw new Error(`GMAIL_TOKEN_FAILED: ${errorText(data?.error_description || data?.error || response.status)}`);
  }
  return clean(data.access_token);
}

async function sendGmailMessage(accessToken: string, rawMessage: string) {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: base64UrlEncode(rawMessage) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.id) {
    throw new Error(`GMAIL_SEND_FAILED: ${errorText(data?.error?.message || data?.error || response.status)}`);
  }
  return data as JsonMap;
}

type Riga = { tessera: string; nome: string; telefonoRicevuto: string };

function buildBody(righe: Riga[]) {
  if (righe.length === 0) {
    return [
      'Nessun socio con il telefono da correggere. Non c\'è niente da fare.',
      '',
      'Questa email arriva comunque tutti i giorni: se un mattino NON arriva,',
      'vuol dire che il controllo automatico si è fermato — non che va tutto bene.',
    ].join('\n');
  }
  const larghezzaNome = Math.max(...righe.map((r) => r.nome.length), 12);
  const elenco = righe.map((r) =>
    `  ${r.tessera}   ${r.nome.padEnd(larghezzaNome)}   ricevuto: ${r.telefonoRicevuto || '(vuoto)'}`);
  return [
    `${righe.length} ${righe.length === 1 ? 'socio ha' : 'soci hanno'} in anagrafica un numero di telefono non utilizzabile.`,
    'Finché resta così, dall\'app dei soci non vengono trovati.',
    '',
    '  TESSERA  NOME',
    ...elenco,
    '',
    'COME SI CORREGGE',
    '  1. Apri la scheda del socio su Matchpoint: lì il numero è GIUSTO.',
    '     (Il guasto è nel file che Matchpoint esporta, non nella scheda.)',
    '  2. Copia il numero nella scheda del socio dentro l\'admin.',
    '  3. Fatto: la correzione resta anche dopo gli import successivi,',
    '     e il socio sparisce da questo elenco domani mattina.',
  ].join('\n');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);

  const supabaseUrl = clean(Deno.env.get('SUPABASE_URL'));
  const serviceKey = clean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  if (!supabaseUrl || !serviceKey) return json({ ok: false, error: 'MISSING_ENV' }, 503);
  const admin = createClient<any>(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  if (!(await verifyRoutineSecret(admin, req.headers.get('x-pmo-routine-secret') || ''))) {
    return json({ ok: false, error: 'FORBIDDEN' }, 403);
  }

  const body = await req.json().catch(() => ({})) as JsonMap;
  const preview = body.preview === true;

  // Paginazione: i soci sono ~2800 e il client tronca a 1000 per volta.
  const righe: Riga[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await admin
      .from('pmo_cloud_records')
      .select('payload')
      .eq('record_type', 'member')
      .not('deleted', 'is', true)
      .range(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) return json({ ok: false, error: 'DB_ERROR', message: error.message }, 500);
    const rows = data ?? [];
    for (const row of rows) {
      const payload = (row.payload ?? {}) as JsonMap;
      if (!needsAttention(payload)) continue;
      righe.push({
        tessera: clean(payload.memberId),
        nome: memberName(payload) || '(senza nome)',
        telefonoRicevuto: clean(payload.phone),
      });
    }
    if (rows.length < SUPABASE_PAGE_SIZE) break;
    from += SUPABASE_PAGE_SIZE;
  }
  righe.sort((a, b) => a.tessera.localeCompare(b.tessera));

  const oggetto = righe.length === 0
    ? '✅ Anagrafica soci — nessun telefono da correggere'
    : `⚠️ Anagrafica soci — ${righe.length} ${righe.length === 1 ? 'telefono da correggere' : 'telefoni da correggere'}`;
  const testo = buildBody(righe);

  if (preview) return json({ ok: true, preview: true, count: righe.length, subject: oggetto, body: testo, righe });

  const to = clean(Deno.env.get('ANAGRAFICA_REPORT_EMAIL')) || DEFAULT_REPORT_EMAIL;
  const fromEmail = clean(Deno.env.get('GMAIL_SENDER_EMAIL'));
  if (!isValidEmail(fromEmail) || !isValidEmail(to)) {
    return json({ ok: false, error: 'REPORT_EMAIL_NOT_CONFIGURED', count: righe.length }, 503);
  }

  try {
    const token = await getGmailAccessToken();
    const raw = [
      `From: "Padel Village" <${safeHeader(fromEmail)}>`,
      `To: ${safeHeader(to)}`,
      `Subject: ${encodeMimeHeader(oggetto)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      testo,
    ].join('\r\n');
    const sent = await sendGmailMessage(token, raw);
    return json({ ok: true, sent: true, to, count: righe.length, messageId: clean(sent.id) });
  } catch (err) {
    console.error('[anagrafica-report-telefoni] invio fallito:', errorText(err));
    return json({ ok: false, error: 'SEND_FAILED', message: errorText(err), count: righe.length }, 502);
  }
});
