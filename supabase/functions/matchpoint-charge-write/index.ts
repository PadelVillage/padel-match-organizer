import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  CODICE_AMBIENTE_DI_PROVA,
  MESSAGGIO_AMBIENTE_DI_PROVA,
  scritturaAlCircoloConsentita,
} from './scrittura-al-circolo.ts';

// matchpoint-charge-write — VOCE 132. Cambia l'IMPORTO A CARICO di un giocatore su una
// partita/lezione di Matchpoint (worker `/set-charge`) e registra il gesto nel gestionale.
//
// 🗣️ Voce del committente, 03/09/2026: «quando su una scheda cambio l'importo e poi clicco
// salva me lo deve riportare su Matchpoint e sul gestionale».
//
// 🚨⭐⭐ NON È UN INCASSO, ed è la ragione per cui questa funzione esiste invece di essere un
// modo in più di `matchpoint-payment-write`. Cambia QUANTO uno deve, non muove un centesimo:
// nessun cobro, nessun record `payment`, nessuna riga nella sezione Incassi.
// 📌 *Un importo a carico non è un pagamento, e i due non possono stare nello stesso libro.*
// ⚖️ Il nome della funzione è la prima cosa che qualcuno legge: chiamarla `payment-…` avrebbe
// invitato, un giorno, a farle scrivere un pagamento «già che c'è».
//
// 🩹⭐⭐ E LA FORMA DEL «SUL GESTIONALE» NON È QUELLA CHE LA SCHEDA 132 PROPONEVA. La scheda
// diceva di scrivere nella **copia locale della partita**, «dove il roster tiene già gli importi
// ed è lo stesso posto da cui la scheda li rilegge». 📏 Misurato il 03/09 prima di scriverlo, ed
// è falso in tutt'e due le metà:
//   · la scheda gli importi li rilegge **vivi da Matchpoint** a ogni apertura
//     (`matchpoint-bookings-edit` con `read:true` → `partecipantiFinali` → `importoCents`);
//   · la copia locale (`staff_booking.giocatori`) tiene **solo i nomi** — `[{ nome }]` — e il
//     write-back del roster la riscrive così a ogni lettura autorevole: un importo messo lì
//     verrebbe **cancellato dalla lettura successiva**.
// ⇒ Scriverlo là non sarebbe stato «registrare»: sarebbe stato aprire un secondo libro che si
//   svuota da sé. Il posto giusto è il **registro dei gesti della segreteria** (`staff_edit`),
//   dove già stanno la modifica del roster, lo spostamento e la nota.
// 📌 *Una proposta di disegno è un'ipotesi finché non si è guardato dove il dato vive davvero.*
//
// 🔁 LA REGOLA DEI TRE PASSI (`CLAUDE.md`, 22/08) applicata al denaro:
//   ① si scrive su Matchpoint e si ASPETTA la conferma (il worker rilegge il campo dalla scheda
//      ricaricata: se MP non ha preso il valore è un errore, non un successo);
//   ② solo allora si registra nel gestionale e si risponde a chi ha chiesto — insieme, non prima.
// 🔇 Al socio NON parte niente: gesto interno della segreteria, per sua decisione del 03/09.
//
// 🔒 Tre difese, le stesse dell'incasso: ① il recinto `scrittura-al-circolo.ts` (fuori dalla
// produzione al worker non ci si parla — il worker è UNO SOLO e condiviso fra TEST e PROD),
// ② il kill-switch del worker (`MATCHPOINT_PAYMENT_WRITE_ENABLED`, default OFF), ③ il permesso
// `cloud_sync` sull'attore.

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

const DEFAULT_BASE_URL = 'https://app-padelvillage-it.matchpoint.com.es';
/** Tetto di sicurezza contro il refuso di battitura: 1.000,00 €. Lo stesso del worker. */
const MAX_CENTS = 100000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
function ok(body: JsonMap) { return json({ ok: true, ...body }); }
function err(status: number, code: string, message: string, extra: JsonMap = {}) {
  return json({ ok: false, error: code, message, ...extra }, status);
}
function clean(value: unknown) { return String(value ?? '').trim(); }
function errorText(value: unknown) {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message || String(value);
  try { return JSON.stringify(value); } catch { return String(value); }
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
    email: clean(profile.email || userData.user.email || ''),
    role: String(profile.role ?? 'staff'),
    permissions: (profile.permissions as JsonMap) ?? {},
  };
}

async function callWorkerSetCharge(opts: {
  workerUrl: string; workerApiKey: string; username: string; password: string; baseUrl: string;
  payload: JsonMap;
}): Promise<JsonMap> {
  const { workerUrl, workerApiKey, username, password, baseUrl, payload } = opts;
  let res: Response;
  try {
    res = await fetch(`${workerUrl}/set-charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${workerApiKey}` },
      body: JSON.stringify({ username, password, baseUrl, ...payload }),
    });
  } catch (netErr) {
    const e = new Error(`Worker network error: ${errorText(netErr)}`) as Error & { code: string };
    e.code = 'WORKER_NETWORK_ERROR';
    throw e;
  }
  // 🚨 Un worker INDIETRO non espone `/set-charge` e risponde 404: va detto con parole sue,
  // o si legge come «l'importo è stato rifiutato» — che è un'altra cosa e manda a rifarlo.
  if (res.status === 404 || res.status === 501) {
    const e = new Error('Il worker in servizio non espone /set-charge: è indietro rispetto al gestionale.') as Error & { code: string };
    e.code = 'WORKER_SET_CHARGE_NOT_IMPLEMENTED';
    throw e;
  }
  const body = await res.json().catch(() => ({}));
  if (res.ok) return body as JsonMap;
  const code = clean((body as JsonMap).error) || 'WORKER_ERROR';
  const e = new Error(errorText((body as JsonMap).message || code)) as Error & { code: string; diagnostic?: unknown };
  e.code = code;
  e.diagnostic = (body as JsonMap).diagnostic;
  throw e;
}

/**
 * Il gesto entra nel registro della segreteria — lo STESSO di modifica roster, spostamento e nota.
 *
 * ⚖️ Perché `staff_edit` e non un tipo nuovo: cambiare l'importo a carico di un giocatore È una
 * modifica alla partita fatta dalla segreteria, e il `payload` dice **quale** (`azione`). Un
 * `record_type` nuovo avrebbe voluto una migrazione del CHECK e quindi un ordine obbligato fra
 * due deploy — costo vero, per separare due cose che si leggono insieme.
 * 🚨 E si guarda `{ error }`: supabase-js lo RESTITUISCE invece di lanciarlo (difetto dell'11/08,
 * che faceva uscire un rifiuto del database come un «fatto»).
 */
async function registraGestoNelGestionale(opts: {
  supabaseUrl: string; supabaseKey: string; actor: StaffActor;
  idReserva: string; idCliente: string; playerName: string;
  daCents: number | null; aCents: number; changed: boolean; workerResult: JsonMap;
}) {
  const { supabaseUrl, supabaseKey, actor } = opts;
  const client = createClient(supabaseUrl, supabaseKey);
  const localKey = `staff_edit|charge|${opts.idReserva}|${opts.idCliente || opts.playerName}|${actor.userId}|${new Date().toISOString()}`;
  const { error } = await client.from('pmo_cloud_records').upsert({
    record_type: 'staff_edit',
    local_key: localKey,
    payload: {
      azione: 'set_charge',
      idReserva: opts.idReserva,
      giocatore: { idCliente: opts.idCliente || null, nome: opts.playerName || null },
      importo: { daCents: opts.daCents, aCents: opts.aCents, cambiato: opts.changed },
      edited_by_email: actor.email,
      edited_by_role: actor.role,
      worker_result: opts.workerResult,
    },
    deleted: false,
    updated_at: new Date().toISOString(),
    synced_at: new Date().toISOString(),
  }, { onConflict: 'record_type,local_key' });
  if (error) throw new Error(`registro staff_edit non scritto: ${error.message}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return err(405, 'METHOD_NOT_ALLOWED', 'Only POST supported');

  const actor = await getActor(req).catch(() => null);
  if (!actor) return err(401, 'UNAUTHORIZED', 'Autenticazione richiesta.');
  if (!hasPermission(actor, 'cloud_sync')) {
    return err(403, 'FORBIDDEN', 'Permesso cloud_sync richiesto per cambiare l\'importo a carico.');
  }

  let body: JsonMap;
  try { body = await req.json(); } catch { return err(400, 'INVALID_JSON', 'Request body must be valid JSON.'); }

  const idReserva = clean(body.idReserva);
  const idCliente = clean(body.idCliente);
  const playerName = clean(body.playerName);
  const amountRaw = body.amountCents;
  const amountCents = (typeof amountRaw === 'number' && Number.isFinite(amountRaw)) ? Math.round(amountRaw) : NaN;

  if (!idReserva) return err(400, 'MISSING_IDRESERVA', 'idReserva richiesto.');
  if (!idCliente && !playerName) return err(400, 'MISSING_PLAYER', 'idCliente o playerName richiesto.');
  // ⚖️ `>= 0` e non `> 0`, al contrario dell'incasso: mettere a **zero** un importo a carico è un
  // gesto legittimo (la quota offerta), mentre incassare zero euro non vuol dire niente.
  if (!Number.isFinite(amountCents) || amountCents < 0) return err(400, 'INVALID_AMOUNT', 'amountCents deve essere un intero >= 0.');
  if (amountCents > MAX_CENTS) return err(400, 'INVALID_AMOUNT', 'amountCents oltre il tetto di sicurezza (1.000,00 €).');

  const workerUrl = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_URL'));
  const workerApiKey = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_API_KEY'));
  const username = clean(Deno.env.get('MATCHPOINT_USERNAME'));
  const password = clean(Deno.env.get('MATCHPOINT_PASSWORD'));
  const baseUrl = clean(Deno.env.get('MATCHPOINT_BASE_URL')) || DEFAULT_BASE_URL;
  if (!workerUrl || !workerApiKey) return err(500, 'WORKER_NOT_CONFIGURED', 'Worker Matchpoint non configurato.');
  if (!username || !password) return err(500, 'MATCHPOINT_CREDENTIALS_MISSING', 'Credenziali Matchpoint non configurate.');

  // 🔒💰 IL RECINTO — da fuori dalla produzione la scheda del circolo NON si tocca.
  // 🚨 Il worker è **uno solo e condiviso** fra TEST e PROD: «lo provo da test» cambierebbe
  // l'importo a carico di una persona **vera**, su una partita **vera**.
  if (!scritturaAlCircoloConsentita(Deno.env.get('SUPABASE_URL'))) {
    const avrebbe_scritto = { op: 'set_charge', idReserva, idCliente, playerName, amountCents };
    console.warn(JSON.stringify({ event: 'ambiente_di_prova', azione: 'set-charge', avrebbe_scritto }));
    return err(503, CODICE_AMBIENTE_DI_PROVA, MESSAGGIO_AMBIENTE_DI_PROVA, { avrebbe_scritto, retryable: false });
  }

  let workerResult: JsonMap;
  try {
    workerResult = await callWorkerSetCharge({
      workerUrl, workerApiKey, username, password, baseUrl,
      payload: { idReserva, idCliente, playerName, amountCents },
    });
  } catch (workerErr) {
    const code = clean((workerErr as { code?: string })?.code) || 'WORKER_ERROR';
    const diagnostic = (workerErr as { diagnostic?: unknown })?.diagnostic;
    const status = code === 'WORKER_NETWORK_ERROR' ? 502 : 422;
    return err(status, code, errorText(workerErr), { idReserva, idCliente, ...(diagnostic ? { diagnostic } : {}) });
  }

  // Il worker può tornare ok:false con ALREADY_PAID (riga già riscossa) → propaga il rifiuto.
  if (workerResult.ok === false) {
    const code = clean(workerResult.code) || 'SET_CHARGE_NOT_DONE';
    return err(409, code, errorText(workerResult.message || code), {
      idReserva, idCliente: clean(workerResult.idCliente) || idCliente,
    });
  }

  // ② Matchpoint ha confermato ⇒ ADESSO, e non prima, si registra e si risponde.
  const changed = workerResult.changed === true;
  const daCents = typeof workerResult.precedenteCents === 'number' ? workerResult.precedenteCents : null;
  let registrato = true;
  let registroErrore: string | null = null;
  try {
    await registraGestoNelGestionale({
      supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
      supabaseKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      actor, idReserva, idCliente: clean(workerResult.idCliente) || idCliente, playerName,
      daCents, aCents: amountCents, changed, workerResult,
    });
  } catch (registroErr) {
    // ⚖️ Non si nega un cambio già avvenuto su Matchpoint — mandare a rifarlo sarebbe peggio —
    // ma non si tace nemmeno: chi ha chiesto deve poter sapere che il registro non c'è.
    registrato = false;
    registroErrore = errorText(registroErr);
    console.error(JSON.stringify({ event: 'registro_non_scritto', azione: 'set-charge', idReserva, errore: registroErrore }));
  }

  return ok({
    idReserva,
    idCliente: clean(workerResult.idCliente) || idCliente,
    amountCents,
    changed,
    precedenteCents: daCents,
    pendenteCents: typeof workerResult.pendenteCents === 'number' ? workerResult.pendenteCents : null,
    registrato,
    ...(registroErrore ? { registroErrore } : {}),
  });
});
