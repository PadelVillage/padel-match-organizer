import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  CODICE_AMBIENTE_DI_PROVA,
  MESSAGGIO_AMBIENTE_DI_PROVA,
  scritturaAlCircoloConsentita,
} from './scrittura-al-circolo.ts';

// matchpoint-payment-void — STORNA un pagamento già riscosso su Matchpoint, via worker
// `/void-payment`. ⚠️ DENARO REALE. NON-IDEMPOTENTE → nessun retry.
//
// 🗣️ Sua richiesta del 02/09/2026: *«voglio avere la possibilità di stornare un pagamento fatto
// per errore»*, poi *«accendi solo lo storno»* quando gli ho detto che il flag di scrittura
// pagamenti accende anche l'INCASSO.
//
// 🚨⭐⭐ **L'APP LA CHIAMAVA GIÀ, E NON ESISTEVA.** `_pmoVoidPayment` faceva `fetch` su
// `/functions/v1/matchpoint-payment-void` da mesi — ma quella funzione non era **né in git né su
// Supabase**: l'elenco delle edge attive di PROD non la conteneva. A tenerla nascosta era
// `PMO_PAYMENTS_WRITE_ENABLED = false`, che impediva al bottone di comparire: il 404 non è mai
// arrivato a nessuno perché nessuno ha mai potuto premere.
// 📌 *Codice che chiama una porta che non c'è non dà errore finché nessuno ci passa: il flag che
// lo nasconde è anche ciò che impedisce di accorgersene.*
// ⚖️ Ed è la ragione per cui questa funzione nasce adesso invece di essere «riaccesa»: non c'era
// niente da riaccendere.

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

async function callWorkerVoid(opts: {
  workerUrl: string; workerApiKey: string; username: string; password: string; baseUrl: string;
  payload: JsonMap;
}): Promise<JsonMap> {
  const { workerUrl, workerApiKey, username, password, baseUrl, payload } = opts;
  let res: Response;
  try {
    res = await fetch(`${workerUrl}/void-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${workerApiKey}` },
      body: JSON.stringify({ username, password, baseUrl, ...payload }),
    });
  } catch (netErr) {
    const e = new Error(`Worker network error: ${errorText(netErr)}`) as Error & { code: string };
    e.code = 'WORKER_NETWORK_ERROR';
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

/* 🧾 LA TRACCIA — gemella di quella scritta oggi in `matchpoint-wallet-correct`.
   ⚖️ Uno storno **non** nasce come record nuovo: il pagamento esiste già nel gestionale, e il
   sync di Matchpoint prima o poi lo riporterà `voided`. Ma «prima o poi» è la mediana di ~2
   minuti misurata il 16/08, e nella finestra intermedia la sezione Pagamenti mostrerebbe come
   valido un incasso che il circolo ha appena annullato.
   ⇒ Si marca la riga **subito**, con `voided_at` e `status: 'void'`, che è esattamente ciò che il
   sync scriverà quando arriva: quando arriva, sovrascrive con lo stesso significato.
   📌 *Anticipare il sync è lecito solo scrivendo ciò che il sync scriverebbe: qualunque altra
   forma sarebbe un secondo libro mastro.*
   ⛔ Come per il borsellino: se la marcatura fallisce, lo storno su Matchpoint è comunque
   avvenuto ⇒ la risposta resta `ok` e lo DICE. */
async function marcaStornato(opts: {
  idReserva: string; idCliente: string; playerName: string;
  data: string; campo: string; ora: string; attore: StaffActor;
}): Promise<{ stato: 'marcata' | 'non_marcata' | 'nessuna_riga'; motivo?: string; quante?: number }> {
  const sUrl = clean(Deno.env.get('SUPABASE_URL'));
  const sKey = clean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  if (!sUrl || !sKey) return { stato: 'non_marcata', motivo: 'SERVICE_ROLE_MANCANTE' };
  const nomeNorm = opts.playerName.toLowerCase().trim();
  const idc = clean(opts.idCliente);
  // Giorno|campo|ora della partita stornata: senza, «questo pagamento» diventa «ogni pagamento
  // di questa persona». Stessa forma della chiave naturale che l'app usa già (`_payNatKey`).
  const slotChiave = `${clean(opts.data).slice(0, 10)}|${clean(opts.campo).replace(/\D/g, '')}|${clean(opts.ora).slice(0, 5)}`;
  if (!/^\d{4}-\d{2}-\d{2}\|\d+\|\d{2}:\d{2}$/.test(slotChiave)) {
    // ⛔ Fallisce CHIUSA: senza uno slot completo non si marca NIENTE e lo si dice. Il sync
    // sistemerà la riga da sé; marcare a caso non si disfa.
    return { stato: 'non_marcata', motivo: 'SLOT_INCOMPLETO' };
  }
  try {
    const client = createClient(sUrl, sKey, { auth: { persistSession: false } });
    const { data, error } = await client.from('pmo_cloud_records')
      .select('local_key,payload,deleted')
      .eq('record_type', 'payment')
      .eq('deleted', false);
    if (error) return { stato: 'non_marcata', motivo: error.message };

    /* 🚨 Si riconosce la riga per CLIENTE o per NOME, non per la chiave: la `local_key` del
       pagamento è `pay|idClienteMp|codice|giorno|importo|metodo|seq` e **non contiene
       l'idReserva**, quindi da qui non è ricostruibile. È lo stesso muro per cui la sezione
       Pagamenti deve risalire alla partita passando per il `numero` della prenotazione. */
    const daMarcare = (data ?? []).filter((r: JsonMap) => {
      const pl = (r.payload ?? {}) as JsonMap;
      if (pl.voided_at || (pl.status && pl.status !== 'paid')) return false; // già stornata
      const perCliente = !!(idc && clean(pl.id_cliente) === idc);
      const perNome = !!(nomeNorm && clean(pl.player_name).toLowerCase() === nomeNorm);
      if (!perCliente && !perNome) return false;
      /* 🔪🚨 QUI c'era un controllo FINTO — `clean(pl.__slot_ok) !== 'no'` — su un campo che non
         esiste, quindi sempre vero. Preso rileggendo il proprio codice, prima che girasse.
         ⚖️ Il danno che avrebbe fatto è il più grosso di tutta la giornata: senza il filtro sullo
         slot, stornare UN pagamento avrebbe marcato «stornati» **tutti** i pagamenti di quel socio
         — 58 righe su una scheda misurata, e il sync non li avrebbe rimessi a posto perché lui
         riconcilia solo ciò che il report gli riporta.
         📌 *Una riga che ha la forma di un controllo e non controlla niente è peggio di un
         controllo assente: chi rilegge la conta come fatta.* */
      const slotOk = slotChiave === `${clean(pl.booking_data || pl.data).slice(0, 10)}|`
        + `${clean(pl.campo).replace(/\D/g, '')}|${clean(pl.ora).slice(0, 5)}`;
      return slotOk;
    });
    if (!daMarcare.length) return { stato: 'nessuna_riga' };

    const adesso = new Date().toISOString();
    for (const r of daMarcare) {
      const pl = { ...(r.payload as JsonMap), voided_at: adesso, status: 'void', voided_by: opts.attore.email || '' };
      const { error: e2 } = await client.from('pmo_cloud_records')
        .update({ payload: pl, updated_at: adesso })
        .eq('record_type', 'payment').eq('local_key', r.local_key);
      // 🚨 supabase-js RESTITUISCE l'errore invece di lanciarlo.
      if (e2) return { stato: 'non_marcata', motivo: e2.message };
    }
    return { stato: 'marcata', quante: daMarcare.length };
  } catch (e) {
    return { stato: 'non_marcata', motivo: errorText(e) };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return err(405, 'METHOD_NOT_ALLOWED', 'Only POST supported');

  const actor = await getActor(req).catch(() => null);
  if (!actor) return err(401, 'UNAUTHORIZED', 'Autenticazione richiesta.');
  if (!hasPermission(actor, 'cloud_sync')) {
    return err(403, 'FORBIDDEN', 'Permesso cloud_sync richiesto per stornare un pagamento.');
  }

  let body: JsonMap;
  try { body = await req.json(); } catch { return err(400, 'INVALID_JSON', 'Request body must be valid JSON.'); }

  const idReserva = clean((body as JsonMap).idReserva);
  const idCliente = clean((body as JsonMap).idCliente);
  const playerName = clean((body as JsonMap).playerName);
  // Servono a marcare la riga GIUSTA nella copia locale (vedi `marcaStornato`): senza, lo storno
  // su Matchpoint riesce lo stesso e la marcatura si limita a non farsi.
  const dataPartita = clean((body as JsonMap).data);
  const campoPartita = clean((body as JsonMap).campo);
  const oraPartita = clean((body as JsonMap).ora);

  if (!idReserva) return err(400, 'MISSING_IDRESERVA', 'idReserva richiesto: è la prenotazione su cui sta il pagamento.');
  /* ⛔ Senza almeno UNO fra cliente e nome il worker non saprebbe QUALE giocatore stornare, e su
     una partita di quattro sceglierebbe da sé. Uno storno sul giocatore sbagliato è un danno
     doppio: uno che non doveva pagare resta pagato, e uno che aveva pagato risulta da pagare. */
  if (!idCliente && !playerName) {
    return err(400, 'MISSING_PLAYER', 'idCliente o playerName richiesto: senza, non si sa quale giocatore stornare.');
  }

  const workerUrl = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_URL'));
  const workerApiKey = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_API_KEY'));
  const username = clean(Deno.env.get('MATCHPOINT_USERNAME'));
  const password = clean(Deno.env.get('MATCHPOINT_PASSWORD'));
  const baseUrl = clean(Deno.env.get('MATCHPOINT_BASE_URL')) || DEFAULT_BASE_URL;
  if (!workerUrl || !workerApiKey) return err(500, 'WORKER_NOT_CONFIGURED', 'Worker Matchpoint non configurato.');
  if (!username || !password) return err(500, 'MATCHPOINT_CREDENTIALS_MISSING', 'Credenziali Matchpoint non configurate.');

  // 🔒💰 IL RECINTO — da fuori dalla produzione il registro cassa del circolo NON si tocca.
  // 🚨 Sta QUI, l'ultimo gradino prima del worker: il worker è **uno solo e condiviso** fra TEST e
  // PROD, quindi «lo provo da test» non è mai stata una prova — è denaro vero.
  if (!scritturaAlCircoloConsentita(Deno.env.get('SUPABASE_URL'))) {
    const avrebbe_scritto = { op: 'void_payment', idReserva, idCliente, playerName };
    console.warn(JSON.stringify({ event: 'ambiente_di_prova', azione: 'void-payment', avrebbe_scritto }));
    return err(503, CODICE_AMBIENTE_DI_PROVA, MESSAGGIO_AMBIENTE_DI_PROVA, { avrebbe_scritto, retryable: false });
  }

  let workerResult: JsonMap;
  try {
    workerResult = await callWorkerVoid({
      workerUrl, workerApiKey, username, password, baseUrl,
      payload: { idReserva, idCliente, playerName },
    });
  } catch (workerErr) {
    const code = clean((workerErr as { code?: string })?.code) || 'WORKER_ERROR';
    const diagnostic = (workerErr as { diagnostic?: unknown })?.diagnostic;
    const status = code === 'WORKER_NETWORK_ERROR' ? 502 : 422;
    return err(status, code, errorText(workerErr), { idReserva, idCliente, ...(diagnostic ? { diagnostic } : {}) });
  }

  // Il worker può tornare ok:false (NOTHING_TO_VOID e affini) → propaga 409, non 200.
  if ((workerResult as JsonMap).ok === false) {
    const code = clean((workerResult as JsonMap).code) || 'VOID_NOT_DONE';
    return err(409, code, errorText((workerResult as JsonMap).message || code), { idReserva, idCliente });
  }

  const traccia = await marcaStornato({
    idReserva, idCliente, playerName,
    data: dataPartita, campo: campoPartita, ora: oraPartita, attore: actor,
  });
  if (traccia.stato === 'non_marcata') {
    console.error(JSON.stringify({ event: 'storno_non_marcato', idReserva, idCliente, motivo: traccia.motivo }));
  }

  return ok({
    op: 'void_payment',
    idReserva, idCliente, playerName,
    // ⛔ Lo storno su Matchpoint è avvenuto: la risposta resta `ok`. Ma se la copia locale non è
    // stata marcata lo si DICE — il sync la sistemerà, e nel frattempo si sa perché diverge.
    traccia: traccia.stato,
    ...(typeof traccia.quante === 'number' ? { righeMarcate: traccia.quante } : {}),
    ...(traccia.motivo ? { tracciaMotivo: traccia.motivo } : {}),
    worker: workerResult,
  });
});
