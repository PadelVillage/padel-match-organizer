import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// wa-shadow-proxy — proxy AUTENTICATO per la messaggistica WhatsApp staff.
// Due famiglie di azioni, entrambe dietro JWT staff attivo:
// 1) suggest | approve-suggestion | send → inoltro allo Shadow Mode backend
//    (${SHADOW_URL}/webhook/*, token INTERNAL_API_KEY come secret server-side;
//    risposta ritornata VERBATIM, incluso 429, così la UI resta invariata).
//    Eccezione «send»: lo Shadow REGISTRA soltanto (replied_at, mai Meta) — la
//    consegna reale la fa questo proxy chiamando l'edge whatsapp-send del progetto
//    assistente (credenziali Meta già lì; scrive whatsapp_outbound_messages).
//    Se la consegna riesce lo status dell'inbound passa a «Risposto» e la risposta
//    al client porta inviato_meta:true; se fallisce resta la sola registrazione
//    shadow (inviato_meta:false + errore_meta), stessa UX di prima.
// 2) inbox-list | inbox-update → lettura lista + update triage DIRETTI sul DB del
//    progetto assistente WhatsApp (Padel Match Assistant TEST, aylykijfirtegyxzdwgu)
//    in service_role. Motivo: le tabelle whatsapp_* hanno RLS deny-all (l'anon legge
//    [] e non scrive — VOLUTO: testi e numeri dei clienti sono sensibili e l'anon key
//    è pubblica su GitHub Pages). L'unico varco è questo proxy autenticato.
//    Secret richiesto: WA_ASSISTANT_SERVICE_KEY (service key del progetto assistente).

type JsonMap = Record<string, unknown>;

type StaffActor = { userId: string; email: string; role: string; permissions: JsonMap };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Solo questi path webhook sono inoltrabili (niente path arbitrari dal client).
const FORWARD_ACTIONS = new Set(['suggest', 'approve-suggestion', 'send']);
// Azioni inbox: parlano al DB assistente in service_role (mai inoltrate allo Shadow).
const INBOX_ACTIONS = new Set(['inbox-list', 'inbox-update']);

/* ── Inbox staff (dashboard Messaggi WhatsApp) ── */
const WA_ASSISTANT_URL_DEFAULT = 'https://aylykijfirtegyxzdwgu.supabase.co';
const WA_INBOUND_TABLE = 'whatsapp_inbound_messages';
// Whitelist CHIUSA dei campi triage aggiornabili dalla dashboard: tutto il resto
// (testi, numeri, esiti IA di pipeline) resta scrivibile solo dalle edge dell'assistente.
const INBOX_STATUS_VALUES = new Set(['Da elaborare', 'In revisione', 'Completato', 'Risposto']);
const INBOX_REVISIONE_VALUES = new Set(['approvato', 'rifiutato', 'modificato']);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
function err(status: number, code: string, message: string, extra: JsonMap = {}) {
  return json({ ok: false, success: false, error: code, errore: message, ...extra }, status);
}
function clean(value: unknown) { return String(value ?? '').trim(); }

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

async function handleInboxAction(action: string, payload: JsonMap, actor: StaffActor): Promise<Response> {
  const waUrl = clean(Deno.env.get('WA_ASSISTANT_URL')) || WA_ASSISTANT_URL_DEFAULT;
  const serviceKey = clean(Deno.env.get('WA_ASSISTANT_SERVICE_KEY'));
  if (!serviceKey) {
    return err(503, 'WA_INBOX_NOT_CONFIGURED', 'Inbox WhatsApp non configurata: manca il secret WA_ASSISTANT_SERVICE_KEY.');
  }
  const wa = createClient(waUrl, serviceKey, { auth: { persistSession: false } });

  if (action === 'inbox-list') {
    const rawLimit = Number(payload.limit ?? 100);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : 100, 1), 200);
    const { data, error } = await wa.from(WA_INBOUND_TABLE)
      .select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) return err(502, 'WA_INBOX_READ_ERROR', `Lettura inbox non riuscita: ${clean(error.message)}`);
    return json({ ok: true, success: true, messages: data ?? [] });
  }

  // inbox-update — il ruolo readonly vede ma non tocca (stessa regola del resto dell'app).
  if (String(actor.role).toLowerCase() === 'readonly') {
    return err(403, 'READONLY_STAFF', 'Profilo in sola lettura: non puoi modificare il triage.');
  }
  const id = clean(payload.id);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return err(400, 'INVALID_ID', 'id messaggio mancante o non valido.');
  }
  const rawFields = (payload.fields && typeof payload.fields === 'object') ? payload.fields as JsonMap : {};
  const fields: JsonMap = {};
  for (const [key, value] of Object.entries(rawFields)) {
    if (key === 'categories') {
      if (!Array.isArray(value) || value.length > 12 || value.some((v) => typeof v !== 'string' || v.length > 40)) {
        return err(400, 'INVALID_FIELD_VALUE', 'categories deve essere una lista di stringhe brevi.');
      }
      fields.categories = value.map((v) => clean(v)).filter(Boolean);
    } else if (key === 'status') {
      if (!INBOX_STATUS_VALUES.has(String(value))) return err(400, 'INVALID_FIELD_VALUE', `status non valido: ${clean(value)}`);
      fields.status = String(value);
    } else if (key === 'stato_revisione') {
      if (!INBOX_REVISIONE_VALUES.has(String(value))) return err(400, 'INVALID_FIELD_VALUE', `stato_revisione non valido: ${clean(value)}`);
      fields.stato_revisione = String(value);
    } else if (key === 'risposta_suggerita_ia') {
      const testo = clean(value);
      if (!testo || testo.length > 4000) return err(400, 'INVALID_FIELD_VALUE', 'risposta_suggerita_ia vuota o troppo lunga (max 4000).');
      fields.risposta_suggerita_ia = testo;
    } else {
      return err(400, 'INVALID_FIELD', `Campo non aggiornabile: ${key}`);
    }
  }
  if (!Object.keys(fields).length) return err(400, 'NO_FIELDS', 'Nessun campo da aggiornare.');
  fields.updated_at = new Date().toISOString();
  const { data, error } = await wa.from(WA_INBOUND_TABLE)
    .update(fields).eq('id', id).select().maybeSingle();
  if (error) return err(502, 'WA_INBOX_WRITE_ERROR', `Aggiornamento triage non riuscito: ${clean(error.message)}`);
  if (!data) return err(404, 'MESSAGE_NOT_FOUND', 'Messaggio non trovato.');
  return json({ ok: true, success: true, message: data });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return err(405, 'METHOD_NOT_ALLOWED', 'Solo POST supportato.');

  // Gate: staff autenticato e attivo (blocca il pubblico che prima leggeva il token dal sorgente).
  const actor = await getActor(req).catch(() => null);
  if (!actor) return err(401, 'UNAUTHORIZED', 'Autenticazione staff richiesta.');

  let body: JsonMap;
  try { body = await req.json(); } catch { return err(400, 'INVALID_JSON', 'Body non JSON valido.'); }

  const action = clean(body.action);
  if (!FORWARD_ACTIONS.has(action) && !INBOX_ACTIONS.has(action)) {
    return err(400, 'INVALID_ACTION', `Azione non ammessa: ${action || '(vuota)'}`);
  }
  const payload = (body.payload && typeof body.payload === 'object') ? body.payload as JsonMap : {};

  if (INBOX_ACTIONS.has(action)) {
    try {
      return await handleInboxAction(action, payload, actor);
    } catch (inboxErr) {
      return err(500, 'WA_INBOX_ERROR', `Inbox WhatsApp: ${clean(inboxErr instanceof Error ? inboxErr.message : inboxErr)}`);
    }
  }

  const shadowUrl = clean(Deno.env.get('SHADOW_WEBHOOK_URL'));
  const shadowKey = clean(Deno.env.get('SHADOW_INTERNAL_API_KEY'));
  if (!shadowUrl || !shadowKey) return err(500, 'SHADOW_NOT_CONFIGURED', 'Shadow backend non configurato.');

  let res: Response;
  try {
    res = await fetch(`${shadowUrl}/webhook/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${shadowKey}` },
      body: JSON.stringify(payload),
    });
  } catch (netErr) {
    return err(502, 'SHADOW_NETWORK_ERROR', `Shadow non raggiungibile: ${clean(netErr instanceof Error ? netErr.message : netErr)}`);
  }

  // Passa attraverso body + status verbatim (incluso 429) così la UI resta invariata.
  const text = await res.text();

  // «send» registrato dallo Shadow → consegna reale via whatsapp-send (assistente).
  if (action === 'send' && res.ok) {
    let shadowData: JsonMap = {};
    try { shadowData = JSON.parse(text) as JsonMap; } catch { /* non-JSON: passthrough sotto */ }
    if (shadowData.success === true && shadowData.inviato_meta !== true) {
      const merged = await deliverViaMeta(payload, shadowData);
      return json(merged, res.status);
    }
  }

  return new Response(text, {
    status: res.status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});

// Consegna reale del «Rispondi» staff: chiama whatsapp-send sul progetto assistente
// (service key come JWT: la funzione è verify_jwt e scrive lei il log outbound),
// poi allinea lo status dell'inbound a «Risposto». Ogni fallimento degrada alla sola
// registrazione shadow: inviato_meta:false + errore_meta, mai un errore bloccante.
async function deliverViaMeta(payload: JsonMap, shadowData: JsonMap): Promise<JsonMap> {
  const waUrl = clean(Deno.env.get('WA_ASSISTANT_URL')) || WA_ASSISTANT_URL_DEFAULT;
  const serviceKey = clean(Deno.env.get('WA_ASSISTANT_SERVICE_KEY'));
  const numero = clean(payload.numero).replace(/[^0-9]/g, '');
  const testo = clean(payload.testo);
  const messageId = clean(payload.message_id);
  const inboundId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId) ? messageId : null;

  if (!serviceKey) return { ...shadowData, inviato_meta: false, errore_meta: 'WA_ASSISTANT_SERVICE_KEY mancante' };
  if (numero.length < 8 || !testo) return { ...shadowData, inviato_meta: false, errore_meta: 'numero o testo mancanti' };

  try {
    const sendResp = await fetch(`${waUrl}/functions/v1/whatsapp-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({
        recipient_number: numero,
        message_text: testo,
        inbound_message_id: inboundId ?? undefined,
      }),
    });
    const sendData = (await sendResp.json().catch(() => ({}))) as JsonMap;
    if (!sendResp.ok || sendData.success !== true) {
      return { ...shadowData, inviato_meta: false, errore_meta: clean(sendData.error) || `whatsapp-send HTTP ${sendResp.status}` };
    }

    // whatsapp-send marca l'inbound «Archiviato»: per il flusso manuale staff lo
    // status corretto è «Risposto» (stesso valore che la dashboard mostra in locale).
    if (inboundId) {
      const wa = createClient(waUrl, serviceKey, { auth: { persistSession: false } });
      await wa.from(WA_INBOUND_TABLE)
        .update({ status: 'Risposto', updated_at: new Date().toISOString() })
        .eq('id', inboundId);
    }

    return { ...shadowData, inviato_meta: true, meta_message_id: sendData.meta_message_id ?? null };
  } catch (metaErr) {
    return { ...shadowData, inviato_meta: false, errore_meta: clean(metaErr instanceof Error ? metaErr.message : metaErr) };
  }
}
