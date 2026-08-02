import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

type JsonMap = Record<string, unknown>;

type StaffActor = {
  userId: string;
  email: string;
  role: string;
  permissions: JsonMap;
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  // 🚨 `x-pmo-real-mp` DEVE stare qui o il browser blocca la richiesta prima di spedirla
  // («Failed to fetch»): è l'intestazione con cui i pulsanti diagnostici di TEST
  // scavalcano la simulazione. Difetto nascosto per mesi: senza quell'intestazione la
  // chiamata viene simulata dall'app e non esce mai in rete, quindi il preflight non
  // avviene. Tolta una volta per sbaglio riallineando i rami: c'è una guardia nel banco.
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pmo-real-mp',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_BASE_URL = 'https://app-padelvillage-it.matchpoint.com.es';

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

async function callWorkerCreateClient(opts: {
  workerUrl: string;
  workerApiKey: string;
  username: string;
  password: string;
  baseUrl: string;
  client: JsonMap;
  operatore?: string;
}): Promise<JsonMap> {
  const { workerUrl, workerApiKey, username, password, baseUrl, client, operatore } = opts;
  const endpoint = `${workerUrl}/create-client`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${workerApiKey}`,
      },
      body: JSON.stringify({ username, password, baseUrl, client, operatore: operatore ?? '' }),
    });
  } catch (netErr) {
    throw new Error(`Worker network error: ${errorText(netErr)}`);
  }

  const body = await res.json().catch(() => ({}));
  if (res.ok) return body as JsonMap;

  if (res.status === 501) {
    throw new Error('WORKER_CREATE_CLIENT_NOT_IMPLEMENTED: Il worker non supporta /create-client. Aggiornare il worker.');
  }

  const workerError = new Error(
    `Worker error ${res.status}: ${errorText((body as JsonMap).message || (body as JsonMap).error || body)}`,
  );
  (workerError as unknown as JsonMap).diagnostic = (body as JsonMap).diagnostic;
  throw workerError;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return err(405, 'METHOD_NOT_ALLOWED', 'Only POST supported');

  const actor = await getActor(req).catch(() => null);
  if (!actor) return err(401, 'UNAUTHORIZED', 'Autenticazione richiesta.');
  if (!hasPermission(actor, 'cloud_sync')) {
    return err(403, 'FORBIDDEN', 'Permesso cloud_sync richiesto per creare clienti su Matchpoint.');
  }

  let body: JsonMap;
  try {
    body = await req.json();
  } catch {
    return err(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }

  const c = (body.client && typeof body.client === 'object') ? body.client as JsonMap : body;
  const nome = clean(c.nome ?? c.firstName);
  const cognome = clean(c.cognome ?? c.surname);
  if (!nome) return err(400, 'INVALID_NOME', 'Nome cliente richiesto.');
  if (!cognome) return err(400, 'INVALID_COGNOME', 'Cognome cliente richiesto.');

  const client: JsonMap = {
    nome,
    cognome,
    telefono: clean(c.telefono ?? c.phone ?? ''),
    email: clean(c.email ?? ''),
    sesso: clean(c.sesso ?? c.gender ?? ''),
    dataNascita: clean(c.dataNascita ?? c.birthDate ?? ''),
    livello: c.livello,
    // 🛡️ Il worker cerca il telefono in Matchpoint prima di creare, per non fare la
    // seconda scheda a chi si e' iscritto allo sportello nelle ultime ore. Questa bandiera
    // scavalca la difesa e arriva SOLO da un gesto esplicito dello staff («e' un'altra
    // persona, crea lo stesso»): va passata, o quel bottone non potrebbe funzionare.
    forzaCreazione: c.forzaCreazione === true || c.forceCreate === true,
    // 🔎 Prova a vuoto: il worker cerca il telefono e RIFERISCE che cosa avrebbe fatto,
    // senza creare niente. Serve a collaudare la difesa senza lasciare schede finte in
    // Matchpoint — ogni prova fallita ne lasciava una.
    soloRicerca: c.soloRicerca === true,
  };

  const workerUrl = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_URL'));
  const workerApiKey = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_API_KEY'));
  const username = clean(Deno.env.get('MATCHPOINT_USERNAME'));
  const password = clean(Deno.env.get('MATCHPOINT_PASSWORD'));
  const baseUrl = clean(Deno.env.get('MATCHPOINT_BASE_URL')) || DEFAULT_BASE_URL;

  if (!workerUrl || !workerApiKey) {
    return err(500, 'WORKER_NOT_CONFIGURED', 'Worker Matchpoint non configurato (URL o API key mancante).');
  }
  if (!username || !password) {
    return err(500, 'MATCHPOINT_CREDENTIALS_MISSING', 'Credenziali Matchpoint non configurate.');
  }

  let workerResult: JsonMap;
  try {
    workerResult = await callWorkerCreateClient({ workerUrl, workerApiKey, username, password, baseUrl, client, operatore: actor.email });
  } catch (workerErr) {
    const diagnostic = (workerErr as unknown as JsonMap)?.diagnostic;
    return err(502, 'WORKER_ERROR', errorText(workerErr), { client, ...(diagnostic ? { diagnostic } : {}) });
  }

  // ⭐ Il worker ha TRE esiti, non due: creato / adottato (il telefono era gia' di quella
  // stessa persona: si prende il suo codice invece di fare la seconda scheda) / conflitto
  // (quel numero c'e' ma la scheda sembra di un altro: non si crea e non si adotta).
  // 🚨 Il messaggio va costruito sull'esito: dire «Cliente creato» quando NON e' stato
  // creato niente e' esattamente il falso «✅ confermato» gia' pagato altrove.
  const codice = clean((workerResult as JsonMap).codice);
  const esito = clean((workerResult as JsonMap).esito) || 'creato';
  const conflitto = (workerResult as JsonMap).conflitto as JsonMap | undefined;

  // 🔎 Prova a vuoto: non è stato creato niente e non lo sarà. Si riferisce che cosa
  // AVREBBE fatto, che è l'unica cosa interessante di questa modalità.
  if (esito === 'solo_ricerca') {
    const w = workerResult as JsonMap;
    const avrebbe = clean(w.avrebbe);
    const chi = clean(w.intestatario);
    const suo = clean(w.codice);
    const spiega = avrebbe === 'adotta'
      ? `avrebbe USATO la scheda già esistente di ${chi}${suo ? ' · codice ' + suo : ''}, senza crearne una seconda`
      : avrebbe === 'conflitto'
        ? `si sarebbe FERMATO e te lo avrebbe chiesto: quel numero è di ${chi || 'un altro cliente'}${suo ? ' · codice ' + suo : ''}`
        : 'avrebbe CREATO una scheda nuova: quel telefono in Matchpoint non risulta';
    return ok({
      esito,
      message: `🔎 Prova a vuoto (non ho creato niente): ${spiega}.`,
      avrebbe, motivo: clean(w.motivo), tentativi: w.tentativi,
      client, worker: workerResult,
    });
  }

  if (esito === 'conflitto_telefono') {
    const chi = clean(conflitto?.intestatario) || 'un altro cliente';
    const suoCodice = clean(conflitto?.codice);
    return ok({
      esito,
      conflitto,
      message: `Non ho creato niente: il telefono ${clean(client.telefono)} in Matchpoint è già di ${chi}${suoCodice ? ' · codice ' + suoCodice : ''}.`,
      client,
      worker: workerResult,
    });
  }

  const message = esito === 'adottato'
    ? `Quella persona era già in Matchpoint: uso la sua scheda${codice ? ' · codice ' + codice : ''} invece di crearne una seconda.`
    : `Cliente creato: ${nome} ${cognome}${codice ? ' · codice ' + codice : ''}`;
  return ok({ esito, message, client, worker: workerResult });
});
