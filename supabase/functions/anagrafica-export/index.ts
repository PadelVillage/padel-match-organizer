import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { type JsonMap, senzaNumeroDiScheda } from './esporta.ts';

// anagrafica-export — ponte SOLA LETTURA sull'anagrafica.
//
// Serve a un solo scopo: far leggere l'anagrafica di PRODUZIONE all'ambiente di
// TEST, che dal 3/08/2026 non la prende più da Matchpoint ma da PROD (decisione
// del committente: «chi comanda è prod»).
//
// 🚨 PERCHÉ ESISTE QUESTA FUNZIONE INVECE DI UNA CHIAVE DI PROD DATA A TEST.
// La sincronizzazione riscrive ogni notte ~2800 schede. Sbagliare il verso
// significherebbe riscrivere la PRODUZIONE. Il modo per renderlo impossibile non
// è scrivere codice attento: è togliere il permesso. Qui dentro c'è SOLO
// `.select()` — nessun insert, update, delete, upsert o rpc — quindi chi tiene
// in mano questo ponte non PUÒ scrivere su PROD nemmeno volendo.
//
// 🚨 E NON ESPORTA IL NUMERO DI SCHEDA (`payload.id`). Lo toglie apposta: è
// l'unico dato che non deve mai attraversare, perché la stessa persona ha numeri
// diversi nei due ambienti e sovrascriverlo romperebbe storici e cassetti
// (memoria: identita-cassetto-numero-di-scheda). Togliendolo QUI, il numero non
// può essere copiato per errore da nessuno a valle: non arriva proprio.
//
// Autenticazione: la CI deploya con --no-verify-jwt, quindi il gate è l'header
// X-Anagrafica-Secret confrontato in tempo costante con ANAGRAFICA_MIRROR_SECRET.
// Secret assente in env → 503: la funzione nasce DISARMATA, come i ponti consumer.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-anagrafica-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Una pagina per giro. 500 schede stanno larghe in una risposta e tengono la
// memoria bassa; il chiamante cicla finché `has_more` non è false.
const PAGE_SIZE_DEFAULT = 500;
const PAGE_SIZE_MAX = 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
function err(status: number, code: string, message: string) {
  return json({ ok: false, error: code, message }, status);
}
function clean(value: unknown) { return String(value ?? '').trim(); }

function safeEqualText(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return err(405, 'METHOD_NOT_ALLOWED', 'Usare POST.');
  }

  const secret = clean(Deno.env.get('ANAGRAFICA_MIRROR_SECRET'));
  if (!secret) {
    return err(503, 'EXPORT_DISARMED', 'ANAGRAFICA_MIRROR_SECRET non configurato.');
  }
  const provided = clean(req.headers.get('x-anagrafica-secret'));
  if (!provided || !safeEqualText(provided, secret)) {
    return err(401, 'UNAUTHORIZED', 'X-Anagrafica-Secret assente o non valido.');
  }

  let body: JsonMap = {};
  try {
    const raw = await req.text();
    body = raw ? JSON.parse(raw) as JsonMap : {};
  } catch {
    return err(400, 'BAD_JSON', 'Body non è JSON valido.');
  }

  const offset = Math.max(0, Number(body.offset ?? 0) | 0);
  const requested = Number(body.limit ?? PAGE_SIZE_DEFAULT) | 0;
  const limit = Math.min(PAGE_SIZE_MAX, Math.max(1, requested || PAGE_SIZE_DEFAULT));

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    return err(503, 'MISSING_ENV', 'SUPABASE_URL/SERVICE_ROLE_KEY non configurati.');
  }
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Il totale viaggia in OGNI pagina, non solo nella prima: è il numero con cui
  // il chiamante controlla di aver ricevuto tutto prima di cancellare qualcosa.
  // Un mirror che cancella in base a una lista arrivata a metà è una catastrofe
  // silenziosa, e il modo di non correre quel rischio è saper contare.
  const { count, error: countErr } = await service
    .from('pmo_cloud_records')
    .select('local_key', { count: 'exact', head: true })
    .eq('record_type', 'member')
    .not('deleted', 'is', true);
  if (countErr) {
    console.error('[anagrafica-export] errore conteggio:', countErr.message);
    return err(500, 'DB_ERROR', 'Errore conteggio anagrafica.');
  }

  // 🚨 Ordinamento su local_key, che è la chiave: senza un ordine stabile la
  // paginazione può saltare o ripetere righe fra una pagina e l'altra.
  const { data: rows, error: queryErr } = await service
    .from('pmo_cloud_records')
    .select('local_key,payload,updated_at')
    .eq('record_type', 'member')
    .not('deleted', 'is', true)
    .order('local_key', { ascending: true })
    .range(offset, offset + limit - 1);
  if (queryErr) {
    console.error('[anagrafica-export] errore query member:', queryErr.message);
    return err(500, 'DB_ERROR', 'Errore lettura anagrafica.');
  }

  const soci = (rows ?? []).map((row) => ({
    local_key: clean(row.local_key),
    payload: senzaNumeroDiScheda((row.payload ?? {}) as JsonMap),
    updated_at: row.updated_at ?? null,
  }));

  const totale = count ?? 0;
  const hasMore = offset + soci.length < totale;

  console.log(
    `[anagrafica-export] pagina offset=${offset} righe=${soci.length} totale=${totale} altre=${hasMore}`,
  );

  return json({
    ok: true,
    totale,
    offset,
    restituiti: soci.length,
    has_more: hasMore,
    soci,
  });
});
