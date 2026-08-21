import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { riduci, type FattoInCoda } from './riduzione.ts';
import { destinatarioPerNome, normNome, type SchedaMinima } from './identifica.ts';

// consumer-staff-events — il gestionale CONSEGNA al bot i fatti della segreteria (voce 68).
//
// 🗣️ Nasce dalla segnalazione del committente del 21/08/2026: *«quando da gestionale faccio
// un'azione, cioè metto, levo giocatori o attivo partite o elimino partite, sul bot dei soci
// non succede niente, cioè non arriva nessun avviso»*.
//
// ⭐⭐ LA DIVISIONE DEI COMPITI, che è la regola ferrea del 19/08 — *il gestionale SA, il bot
// DICE* — e qui si vede in tre gesti precisi:
//   · il **sync** ha confrontato le fotografie e ha detto cosa è cambiato (`eventi-staff.ts`);
//   · **questa funzione** aspetta che la segreteria abbia finito, fonde la raffica in una cosa
//     sola, e dice **a chi** va detta — perché risolvere un nome in una persona vuol dire
//     leggere l'anagrafica, e l'anagrafica è del gestionale;
//   · il **bot** decide se e quando dirlo, e lo scrive in italiano al socio.
// ⇒ Il bot non calcola niente di tutto questo, e il giorno in cui Matchpoint si spegne non si
// tocca: cambia solo da dove il gestionale prende le sue fotografie.
//
// 🚨 NON è un webhook: non spinge niente. È il bot che chiede, quando è pronto ad ascoltare —
// così un bot fermo non perde messaggi, li trova in coda quando torna.
//
// Autenticazione: come le altre `consumer-*`, l'header `X-Consumer-Secret` confrontato in
// tempo costante con `CONSUMER_BRIDGE_SECRET`. Secret assente → 503, funzione disarmata.

type JsonMap = Record<string, unknown>;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-consumer-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Quanti esiti si consegnano al massimo in un giro.
 *
 * ⚖️ Non è una difesa contro il carico — è contro l'ERRORE. Se un giorno un guasto riempisse
 * la coda di migliaia di righe, un tetto basso fa sì che il primo giro ne mandi cento e il
 * registro lo dica, invece di far partire un'alluvione di messaggi ai soci prima che qualcuno
 * se ne accorga. 🚨 E quando il tetto morde, si DICHIARA nella risposta: una troncatura
 * silenziosa si legge come «non c'era altro».
 */
const MAX_ESITI = 100;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
function ok(body: JsonMap) { return json({ ok: true, ...body }); }
function err(status: number, code: string, message: string) {
  return json({ ok: false, error: code, message }, status);
}
function clean(value: unknown) { return String(value ?? '').trim(); }

/** Confronto in tempo costante: il secret è l'unico gate della funzione. */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return err(405, 'METHOD_NOT_ALLOWED', 'Usare POST.');
  }

  const bridgeSecret = clean(Deno.env.get('CONSUMER_BRIDGE_SECRET'));
  if (!bridgeSecret) {
    return err(503, 'BRIDGE_DISARMED', 'CONSUMER_BRIDGE_SECRET non configurato.');
  }
  const provided = clean(req.headers.get('x-consumer-secret'));
  if (!provided || !safeEqual(provided, bridgeSecret)) {
    return err(401, 'UNAUTHORIZED', 'X-Consumer-Secret assente o non valido.');
  }

  let body: JsonMap = {};
  try {
    body = await req.json();
  } catch {
    // Body vuoto = ritiro senza opzioni. Non è un errore: è il caso normale.
  }

  // `dry_run` legge senza chiudere niente. ⭐ Serve al collaudo: si guarda cosa uscirebbe
  // senza bruciare i fatti, che altrimenti si vedono una volta sola.
  const dryRun = body.dry_run === true;

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    return err(503, 'MISSING_ENV', 'SUPABASE_URL/SERVICE_ROLE_KEY non configurati.');
  }
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // ── 1. I fatti ancora in coda ────────────────────────────────────────────────────────
  // Si legge PIÙ del tetto: la riduzione fonde le raffiche, quindi mille righe possono
  // diventare venti esiti. Tagliare prima di ridurre spezzerebbe una raffica a metà.
  const { data: righe, error: codaErr } = await service
    .from('pmo_eventi_staff')
    .select('id, slot, data, ora, campo, persona, gesto, visto_at')
    .is('consegnato_at', null)
    .order('visto_at', { ascending: true })
    .limit(1000);
  if (codaErr) {
    console.error('[staff-events] errore lettura coda:', codaErr.message);
    return err(500, 'DB_ERROR', 'Errore lettura della coda.');
  }
  const fatti = (righe ?? []) as FattoInCoda[];
  if (!fatti.length) return ok({ eventi: [], troncato: false });

  // ── 2. La quiete e il netto ──────────────────────────────────────────────────────────
  const ridotti = riduci(fatti, Date.now());
  if (!ridotti.length) {
    // C'erano righe, ma sono tutte ancora calde: la segreteria sta lavorando adesso.
    return ok({ eventi: [], troncato: false, in_attesa_di_quiete: fatti.length });
  }

  // ── 3. Chi sono queste persone ───────────────────────────────────────────────────────
  // 🚨 Si risolve SOLO chi ha davvero qualcosa da ricevere: gli esiti a netto nullo si
  // chiudono e basta, e cercarne il nome in anagrafica sarebbe una lettura di dati personali
  // fatta per niente.
  const daDire = ridotti.filter((e) => e.gesto !== null);
  const nomi = [...new Set(daDire.map((e) => e.persona))];

  const schede: SchedaMinima[] = [];
  if (nomi.length) {
    const { data: membri, error: memberErr } = await service
      .from('pmo_cloud_records')
      .select('payload')
      .eq('record_type', 'member')
      .not('deleted', 'is', true)
      .limit(5000);
    if (memberErr) {
      console.error('[staff-events] errore lettura anagrafica:', memberErr.message);
      return err(500, 'DB_ERROR', 'Errore lettura anagrafica.');
    }
    const cercati = new Set(nomi.map((n) => normNome(n)));
    for (const row of membri ?? []) {
      const p = (row.payload ?? {}) as JsonMap;
      const nome = clean(p.name) || `${clean(p.firstName)} ${clean(p.surname)}`.trim();
      if (!nome) continue;
      // Si tengono solo le schede che c'entrano con questo giro, comprese le OMONIME —
      // servono proprio quelle: senza, il fail-closed non saprebbe di essere davanti a due.
      if (!cercati.has(normNome(nome))) continue;
      schede.push({
        id: clean(p.id),
        pmoPlayerId: clean(p.pmoPlayerId),
        memberId: clean(p.memberId),
        nome,
      });
    }
  }

  // ── 4. Cosa esce, e cosa si chiude ───────────────────────────────────────────────────
  const eventi: JsonMap[] = [];
  const daChiudere: string[] = [];
  let nonRiconosciuti = 0;
  let troncato = false;

  for (const e of ridotti) {
    // Netto nullo: niente da dire, ma le righe si chiudono — se no si riesaminano per sempre.
    if (e.gesto === null) { daChiudere.push(...e.ids); continue; }

    if (eventi.length >= MAX_ESITI) { troncato = true; continue; }

    const chi = destinatarioPerNome(e.persona, schede);
    if (!chi) {
      // 🚨 Si chiude lo stesso, e va spiegato: questo nome non diventerà risolvibile domani.
      // O è una persona che il circolo non ha in anagrafica, o sono due OMONIMI VERI (schede
      // con identificativi diversi) — e in nessuno dei due casi riprovare fra un'ora cambia
      // qualcosa. Tenerlo in coda vorrebbe dire riesaminarlo a ogni giro per sempre.
      // ⚠️ Le schede DUPLICATE della stessa persona non finiscono qui: `destinatarioPerNome`
      // le riconosce e consegna. Il 21/08 la regola secca «più di una scheda ⇒ nessuno»
      // avrebbe tolto per sempre gli avvisi a una socia vera, in silenzio.
      daChiudere.push(...e.ids);
      nonRiconosciuti += 1;
      continue;
    }
    eventi.push({
      gesto: e.gesto,
      persona: e.persona,
      pmo_player_id: chi.pmoPlayerId || null,
      member_id: chi.memberId || null,
      partita: { data: e.data, ora: e.ora, campo: e.campo, slot: e.slot },
    });
    daChiudere.push(...e.ids);
  }

  // ── 5. La chiusura ───────────────────────────────────────────────────────────────────
  // ⚠️ Si chiude PRIMA che il bot abbia scritto ai soci, e il verso è deliberato: se il bot
  // cade fra il ritiro e l'invio, quel messaggio è perso. L'alternativa — chiudere dopo una
  // conferma del bot — regalerebbe il caso opposto, in cui una conferma persa fa mandare
  // tutto due volte. *Un avviso in meno è un fastidio; un avviso doppio è il difetto che il
  // progetto evita apposta da sempre* (voce 63, gli inviti orfani ritirati in silenzio).
  if (!dryRun && daChiudere.length) {
    const { error: chiudiErr } = await service
      .from('pmo_eventi_staff')
      .update({ consegnato_at: new Date().toISOString() })
      .in('id', daChiudere);
    if (chiudiErr) {
      // 🚨 Non si consegna niente se non si è riusciti a chiudere: consegnare senza chiudere
      // significa rimandare gli stessi fatti al giro dopo, cioè scrivere due volte al socio.
      console.error('[staff-events] errore chiusura:', chiudiErr.message);
      return err(500, 'DB_ERROR', 'Errore nella chiusura della coda: niente consegnato.');
    }
  }

  console.log(JSON.stringify({
    event: 'staff_events_consegna',
    inCoda: fatti.length,
    ridotti: ridotti.length,
    consegnati: eventi.length,
    nettoNullo: ridotti.length - daDire.length,
    nonRiconosciuti,
    troncato,
    dryRun,
  }));

  return ok({ eventi, troncato, non_riconosciuti: nonRiconosciuti, dry_run: dryRun });
});
