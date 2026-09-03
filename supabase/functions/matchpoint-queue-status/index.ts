import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';
import { semaforoDaSnapshot } from './frasi-del-semaforo.ts';

type JsonMap = Record<string, unknown>;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
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

// Richiede uno staff autenticato e ATTIVO (qualsiasi ruolo). Leggere la coda è
// un'operazione innocua: nessun permesso speciale richiesto, solo login valido.
async function requireActiveStaff(req: Request): Promise<boolean> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const token = clean(req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token || !supabaseUrl || !anonKey) return false;
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: userData, error } = await authClient.auth.getUser(token);
  if (error || !userData?.user) return false;
  const { data: profileData, error: profileError } = await authClient.rpc('pmo_get_my_staff_profile');
  if (profileError || !profileData) return false;
  const profile = Array.isArray(profileData) ? profileData[0] : profileData;
  return !!profile && profile.status === 'active';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'GET') return err(405, 'METHOD_NOT_ALLOWED', 'Solo GET supportato.');

  const okStaff = await requireActiveStaff(req).catch(() => false);
  if (!okStaff) return err(401, 'UNAUTHORIZED', 'Autenticazione richiesta.');

  const workerUrl = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_URL'));
  const workerApiKey = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_API_KEY'));
  if (!workerUrl || !workerApiKey) {
    return err(500, 'WORKER_NOT_CONFIGURED', 'Worker Matchpoint non configurato (URL o API key mancante).');
  }

  let res: Response;
  try {
    res = await fetch(`${workerUrl}/queue/status`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${workerApiKey}` },
    });
  } catch (netErr) {
    // 🚦 VOCE 137 — anche il GUASTO parla italiano. `WORKER_UNREACHABLE` con dentro il messaggio
    //    di rete finiva dritto in una risposta che il calendario può mostrare: il codice resta
    //    per il registro, ma accanto viaggia un semaforo SPENTO e onesto («non lo so»), così chi
    //    disegna la barra non ha bisogno di interpretare un errore per sapere cosa fare.
    console.error(`[queue-status] worker irraggiungibile: ${errorText(netErr)}`);
    return err(502, 'WORKER_UNREACHABLE', 'Il sistema del circolo non risponde in questo momento.', {
      semaforo: { acceso: false, frase: null, che: null, chi: null, inAttesa: 0, dichiarazioneMancante: false, dove: null },
    });
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`[queue-status] worker in errore: ${errorText((body as JsonMap).message || (body as JsonMap).error || body)}`);
    return err(502, 'WORKER_ERROR', 'Il sistema del circolo non risponde in questo momento.', {
      semaforo: { acceso: false, frase: null, che: null, chi: null, inAttesa: 0, dichiarazioneMancante: false, dove: null },
    });
  }
  // Lo snapshot grezzo resta tale e quale (busy, running, waiting, waitingCount, time): serve
  // alla diagnosi, e toglierlo vorrebbe dire perdere l'unica finestra sulla coda che abbiamo.
  // ⭐ Accanto arriva `semaforo`, che è ciò che si DISEGNA: già filtrato dell'automatico e già
  //   tradotto in una frase del gestionale. La differenza fra i due non è cosmetica — è la
  //   ragione per cui la barra non può mostrare per sbaglio il nome di un pezzo interno.
  return json({ ...(body as JsonMap), semaforo: semaforoDaSnapshot(body as JsonMap) }, 200);
});
