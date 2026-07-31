import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';
import {
  ambienteDa,
  componiInvito,
  componiPersona,
  indicizzaSoci,
  vedeLaSezione,
  type RigaInvito,
  type RigaOperatore,
} from './logica.ts';

// ─────────────────────────────────────────────────────────────────────────────
// bot-telegram-admin — il PONTE fra il gestionale e le tabelle del bot Telegram.
//
// Perché esiste: chi è entrato nel bot sta scritto su un ALTRO progetto Supabase
// (quello del bot), e il gestionale non ci parla. Le strade erano due — spostare
// le tabelle, o mettere in mezzo un ponte — e si è scelto il ponte, dal lato del
// GESTIONALE, per tre ragioni:
//   1. il permesso di chi chiede è un fatto del gestionale (è lì che vive lo staff
//      con i suoi ruoli): una funzione sull'altro progetto non saprebbe verificarlo;
//   2. da qui il deploy è già separato per ambiente — TEST da `test-preview`, PROD
//      da `main` — che è esattamente la disciplina «prima TEST, poi PROD»;
//   3. la chiave del database del bot resta dalla parte del server. Nel browser non
//      ci arriva mai: l'app manda solo il token della persona che ha fatto il login.
//
// 🚨 La riga della whitelist porta la colonna `ambiente`: si legge e si scrive
// SOLO l'ambiente in cui questa funzione sta girando. Senza quel filtro, un tocco
// dato dal gestionale di TEST cambierebbe chi può usare il bot VERO.
// ─────────────────────────────────────────────────────────────────────────────

type JsonMap = Record<string, unknown>;
type StaffActor = { userId: string; email: string; ruolo: string; permessi: JsonMap };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Quanti inviti si mostrano. Oggi sono due in tutto; il tetto serve perché fra un
// anno la lista non diventi una pagina che non finisce mai.
const MAX_INVITI = 200;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}
function ok(body: JsonMap) { return json({ ok: true, ...body }); }
function err(status: number, code: string, message: string) { return json({ ok: false, error: code, message }, status); }
function clean(v: unknown) { return String(v ?? '').trim(); }

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
    ruolo: clean(profile.role),
    permessi: (profile.permissions && typeof profile.permissions === 'object') ? profile.permissions : {},
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return err(405, 'METHOD_NOT_ALLOWED', 'Solo POST.');

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) return err(500, 'CONFIG_MISSING', 'SUPABASE_URL / SERVICE_ROLE non configurati.');

  // ⚠️ I nomi NON possono cominciare per `SUPABASE_`: quel prefisso è riservato da
  // Supabase e un segreto così non si riesce nemmeno a salvare.
  const aylyUrl = Deno.env.get('AYLY_URL') ?? '';
  const aylyKey = Deno.env.get('AYLY_SERVICE_KEY') ?? '';

  const actor = await getActor(req).catch(() => null);
  if (!actor) return err(401, 'UNAUTHORIZED', 'Autenticazione richiesta.');
  if (!vedeLaSezione(actor.ruolo, actor.permessi)) {
    return err(403, 'FORBIDDEN', 'Non hai il permesso per la sezione «Bot Telegram».');
  }

  // Fail closed, come i tre ponti dei soci: senza le credenziali del database del
  // bot non si tira a indovinare e non si risponde «nessuno è entrato» — che
  // sarebbe una bugia rassicurante. Si dichiara che il ponte è disarmato.
  if (!aylyUrl || !aylyKey) {
    return err(503, 'BOT_DB_DISARMED', 'Il collegamento col database del bot non è configurato in questo ambiente.');
  }

  let body: JsonMap;
  try { body = await req.json(); } catch { return err(400, 'INVALID_JSON', 'Body non valido.'); }

  const azione = clean(body.action) || 'list';
  const ambiente = ambienteDa(supabaseUrl);
  const bot = createClient(aylyUrl, aylyKey, { auth: { persistSession: false } });
  const gestionale = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    if (azione === 'revoca' || azione === 'riattiva') {
      const chatId = clean(body.chat_id);
      if (!/^-?\d+$/.test(chatId)) return err(400, 'BAD_CHAT_ID', 'Identificativo Telegram non valido.');
      const attivo = azione === 'riattiva';
      const { error: upErr } = await bot
        .from('telegram_operatori')
        .update({ attivo })
        .eq('chat_id', chatId)
        .eq('ambiente', ambiente);
      if (upErr) return err(500, 'UPDATE_ERROR', upErr.message);

      // 🚨 Dopo una scrittura si guarda il BERSAGLIO, non il «success»: un update
      // che non trova nessuna riga riesce lo stesso, e chi guarda il pannello
      // crederebbe di aver revocato una persona che è ancora dentro.
      const { data: dopo, error: reErr } = await bot
        .from('telegram_operatori')
        .select('chat_id,attivo')
        .eq('chat_id', chatId)
        .eq('ambiente', ambiente)
        .limit(1);
      if (reErr) return err(500, 'VERIFY_ERROR', reErr.message);
      const riga = Array.isArray(dopo) ? dopo[0] : null;
      if (!riga) return err(404, 'NON_TROVATO', 'In questo ambiente non risulta nessuno con quell’identificativo.');
      if (riga.attivo !== attivo) return err(500, 'NON_APPLICATO', 'La modifica non risulta scritta: riprova.');

      // ⏱️ La guardia del bot tiene in memoria i «sì» per 5 minuti: una revoca può
      // impiegare fino a tanto per mordere davvero. Va detto a chi la usa, non
      // scoperto dopo, altrimenti sembra che il bottone non abbia funzionato.
      return ok({ ambiente, chat_id: chatId, attivo, attesa_minuti: 5, attore: actor.email });
    }

    if (azione === 'ritira_invito') {
      const token = clean(body.token);
      if (!token) return err(400, 'BAD_TOKEN', 'Invito non indicato.');
      const { error: upErr } = await bot
        .from('telegram_inviti')
        .update({ annullato: true })
        .eq('token', token)
        .eq('ambiente', ambiente);
      if (upErr) return err(500, 'UPDATE_ERROR', upErr.message);
      const { data: dopo, error: reErr } = await bot
        .from('telegram_inviti')
        .select('token,annullato,usato_il')
        .eq('token', token)
        .eq('ambiente', ambiente)
        .limit(1);
      if (reErr) return err(500, 'VERIFY_ERROR', reErr.message);
      const riga = Array.isArray(dopo) ? dopo[0] : null;
      if (!riga) return err(404, 'NON_TROVATO', 'Quell’invito non risulta in questo ambiente.');
      if (riga.annullato !== true) return err(500, 'NON_APPLICATO', 'Il ritiro non risulta scritto: riprova.');
      return ok({ ambiente, token, ritirato: true, attore: actor.email });
    }

    if (azione !== 'list') return err(400, 'AZIONE_IGNOTA', `Azione non prevista: ${azione}`);

    const [{ data: operatori, error: opErr }, { data: inviti, error: invErr }] = await Promise.all([
      bot.from('telegram_operatori')
        .select('chat_id,member_id,etichetta,attivo,ambiente,created_at,invitato_da_member_id,invito_token')
        .eq('ambiente', ambiente)
        .order('created_at', { ascending: false }),
      bot.from('telegram_inviti')
        .select('token,ambiente,invitante_member_id,invitante_etichetta,partita,creato_il,scade_il,annullato,aperto_da_chat_id,aperto_il,usato_da_chat_id,usato_il,esito')
        .eq('ambiente', ambiente)
        .order('creato_il', { ascending: false })
        .limit(MAX_INVITI),
    ]);
    if (opErr) return err(502, 'BOT_READ_ERROR', opErr.message);
    if (invErr) return err(502, 'BOT_READ_ERROR', invErr.message);

    const righeOperatori = (operatori ?? []) as RigaOperatore[];
    const righeInviti = (inviti ?? []) as RigaInvito[];

    // I nomi, i telefoni e i livelli stanno nell'anagrafica del GESTIONALE: il bot
    // conserva solo il codice socio. Si chiedono in una volta sola, per codice.
    const codici = new Set<string>();
    for (const r of righeOperatori) {
      if (clean(r.member_id)) codici.add(clean(r.member_id));
      if (clean(r.invitato_da_member_id)) codici.add(clean(r.invitato_da_member_id));
    }
    for (const r of righeInviti) {
      if (clean(r.invitante_member_id)) codici.add(clean(r.invitante_member_id));
    }

    let schede: Array<{ payload?: unknown }> = [];
    if (codici.size) {
      const { data, error: memErr } = await gestionale
        .from('pmo_cloud_records')
        .select('payload')
        .eq('record_type', 'member')
        .eq('deleted', false)
        .in('payload->>memberId', Array.from(codici));
      if (memErr) return err(500, 'ANAGRAFICA_ERROR', memErr.message);
      schede = (data ?? []) as Array<{ payload?: unknown }>;
    }
    const soci = indicizzaSoci(schede);
    const adesso = new Date();

    return ok({
      ambiente,
      persone: righeOperatori.map((r) => componiPersona(r, soci)),
      inviti: righeInviti.map((r) => componiInvito(r, soci, adesso)),
      letto_il: adesso.toISOString(),
    });
  } catch (e) {
    return err(500, 'UNEXPECTED', (e as Error)?.message || String(e));
  }
});
