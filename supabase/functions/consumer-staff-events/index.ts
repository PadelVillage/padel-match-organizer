import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { riduci, type FattoInCoda } from './riduzione.ts';
import { destinatarioPerNome, normNome, type SchedaMinima } from './identifica.ts';
import { leggiImpaginato } from './impaginazione.ts';
import {
  copertura,
  FINESTRA_RICEVUTA_MS,
  TOLLERANZA_ANTICIPO_MS,
  type Ricevuta,
} from './ricevute.ts';

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

/**
 * Quante righe il client restituisce al massimo in una lettura, qualunque cosa si chieda.
 * ⚠️ NON è una scelta: è il tetto imposto dal client, ed è la stessa costante che le altre
 * funzioni di questo repo chiamano `SUPABASE_PAGE_SIZE`. Chiedere di più non lo alza.
 */
const SUPABASE_PAGE_SIZE = 1000;

/**
 * Il freno d'emergenza dell'impaginazione: se l'anagrafica superasse questo numero, si smette
 * di leggere e lo si SCRIVE nel registro. È dieci volte i soci di oggi (2810 il 21/08/2026):
 * arrivarci vuol dire che è successo qualcos'altro.
 */
const MAX_SCHEDE_ANAGRAFICA = 30000;

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

  // ── 1bis. QUALI DI QUESTI FATTI NON LI HA FATTI IL CIRCOLO (voce 70) ─────────────────
  // 🗣️ Difetto misurato al secondo la notte del 21/08/2026: Lidia accetta un invito dal bot,
  // il bot le dice «✅ Sei in campo», e fra i 4 e i 19 minuti dopo un avviso **del circolo** le
  // annuncia la stessa cosa. Il gesto era suo.
  //
  // 🔎 `eventi-staff.ts` confronta due fotografie del calendario: vede *cosa* è cambiato e non
  // può sapere **chi**. Ma il gestionale lo sa, perché la scrittura l'ha eseguita lui — e da
  // oggi la lascia detta in `pmo_ricevute_gesti`. Qui le due cose si incontrano.
  //
  // 🚨⭐⭐ E SI FA QUI, PRIMA DELLA RIDUZIONE, non dopo: un socio che entra dal bot e che poi la
  // **segreteria** toglie produce due fatti, `aggiunto` (suo) e `tolto` (del circolo). Scartando
  // prima resta il `tolto` e lui lo sente; scartando dopo i due si sarebbero già fusi in un netto
  // nullo e non avrebbe saputo di essere stato tolto. La prova sta in `ricevute.test.ts`.
  //
  // ⏱️ Si leggono solo le ricevute che possono riguardare QUESTI fatti: dal più vecchio di loro,
  // meno la finestra. Non è un'ottimizzazione — è ciò che tiene la lettura piccola e prevedibile
  // anche il giorno in cui la coda si allunga.
  const vistoPiuVecchio = fatti
    .map((f) => Date.parse(f.visto_at))
    .filter((n) => Number.isFinite(n))
    .reduce((a, b) => Math.min(a, b), Number.POSITIVE_INFINITY);
  const daQuando = Number.isFinite(vistoPiuVecchio)
    ? new Date(vistoPiuVecchio - FINESTRA_RICEVUTA_MS - TOLLERANZA_ANTICIPO_MS).toISOString()
    : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: righeRic, error: ricErr } = await service
    .from('pmo_ricevute_gesti')
    .select('id, data, ora, campo, persona, gesto, scritta_at')
    .is('usata_at', null)
    .gte('scritta_at', daQuando)
    .order('scritta_at', { ascending: true })
    .limit(SUPABASE_PAGE_SIZE);
  if (ricErr) {
    // 🚨 Non si tira dritto: senza le ricevute questo giro rimanderebbe in circolo esattamente
    // gli avvisi falsi che la voce 70 cura, e li manderebbe **davvero**. I fatti restano in coda
    // e il giro dopo riprova. *Un avviso in ritardo è un fastidio; un avviso falso è una bugia.*
    console.error('[staff-events] errore lettura ricevute:', ricErr.message);
    return err(500, 'DB_ERROR', 'Errore lettura delle ricevute: niente consegnato.');
  }
  const ricevute = (righeRic ?? []) as Ricevuta[];
  // 🚨⭐ SE IL TETTO MORDE SI FERMA, e questa riga è la lezione del 21/08 applicata prima di
  // pagarla una seconda volta: là `.limit(5000)` ne restituiva 1000 e nessuno lo sapeva, perché
  // *un limite che si dichiara non è un limite che si ottiene*. Qui una lettura tronca vorrebbe
  // dire ricevute mancanti ⇒ avvisi falsi consegnati **davvero**, con la coda vuotata. I fatti
  // restano dove sono e il giro dopo riprova.
  if (ricevute.length >= SUPABASE_PAGE_SIZE) {
    console.error(`[staff-events] ricevute troncate a ${ricevute.length}: niente consegnato.`);
    return err(500, 'DB_ERROR', 'Troppe ricevute per un giro solo: niente consegnato.');
  }
  const { daConsegnare, coperti } = copertura(fatti, ricevute);

  // Le ricevute consumate si marcano subito: se il giro morisse qui, il peggio che può capitare
  // è che un fatto già scartato non trovi più la sua ricevuta — e quel fatto è già chiuso.
  if (!dryRun && coperti.length) {
    const adesso = new Date().toISOString();
    const { error: chiudiRicErr } = await service
      .from('pmo_eventi_staff')
      .update({ consegnato_at: adesso })
      .in('id', coperti.map((c) => c.fatto.id));
    if (chiudiRicErr) {
      // Se non si riesce a chiudere i coperti si ferma tutto: proseguire vorrebbe dire
      // riesaminarli al giro dopo con le ricevute ormai consumate, cioè consegnarli.
      console.error('[staff-events] errore chiusura dei coperti:', chiudiRicErr.message);
      return err(500, 'DB_ERROR', 'Errore nella chiusura dei fatti coperti: niente consegnato.');
    }
    for (const c of coperti) {
      const { error: usaErr } = await service
        .from('pmo_ricevute_gesti')
        .update({ usata_at: adesso, usata_da: c.fatto.id })
        .eq('id', c.ricevuta.id);
      if (usaErr) {
        // ⚠️ Best effort col verso giusto: il fatto è già chiuso, quindi il danno di una
        // ricevuta rimasta libera è al massimo un secondo gesto uguale coperto per sbaglio
        // entro la finestra. Va scritto, però: è l'unica traccia che lo spiegherebbe.
        console.error(`[staff-events] ricevuta ${c.ricevuta.id} non marcata usata: ${usaErr.message}`);
      }
    }
  }
  if (coperti.length) {
    // 🚨 Si DICHIARA, uno per uno. Un avviso soppresso è indistinguibile da un fatto che non è
    // successo, e senza questa riga la cura sarebbe invisibile tanto quanto il difetto.
    for (const c of coperti) {
      console.log(`[staff-events] non consegnato (l'ha fatto il socio): ${c.fatto.persona} ${c.fatto.gesto} ${c.fatto.data} ${c.fatto.ora} C${c.fatto.campo}`);
    }
  }
  if (!daConsegnare.length) {
    return ok({ eventi: [], troncato: false, coperti_da_ricevuta: coperti.length });
  }

  // ── 2. La quiete e il netto ──────────────────────────────────────────────────────────
  const ridotti = riduci(daConsegnare, Date.now());
  if (!ridotti.length) {
    // C'erano righe, ma sono tutte ancora calde: la segreteria sta lavorando adesso.
    return ok({
      eventi: [], troncato: false,
      in_attesa_di_quiete: daConsegnare.length,
      coperti_da_ricevuta: coperti.length,
    });
  }

  // ── 3. Chi sono queste persone ───────────────────────────────────────────────────────
  // 🚨 Si risolve SOLO chi ha davvero qualcosa da ricevere: gli esiti a netto nullo si
  // chiudono e basta, e cercarne il nome in anagrafica sarebbe una lettura di dati personali
  // fatta per niente.
  const daDire = ridotti.filter((e) => e.gesto !== null);
  const nomi = [...new Set(daDire.map((e) => e.persona))];

  const schede: SchedaMinima[] = [];
  if (nomi.length) {
    // 🚨⭐⭐ SI IMPAGINA, e non è una raffinatezza: `.limit(5000)` ne restituisce **1000**.
    // Il client tronca a mille per volta comunque lo si chieda — sta scritto in questo stesso
    // repo (`anagrafica-report-telefoni`: «i soci sono ~2800 e il client tronca a 1000 per
    // volta») e le altre nove funzioni che leggono l'anagrafica impaginano tutte.
    // 📏 MISURATO su PROD il 21/08/2026, al primo collaudo con due persone diverse: il ponte
    // vedeva le prime 1000 schede su 2810. «Maurizio Aprea» sta in posizione 628 ⇒ avviso
    // consegnato; «Lidia Comes» in posizione 2721 ⇒ `nonRiconosciuti: 1`, e il messaggio non
    // è mai partito. Due persone ai due lati del taglio, e il difetto si vedeva solo così.
    // ⚖️ Il numero che rende l'idea: **1810 soci su 2810** non potevano ricevere NIENTE, in
    // silenzio, con la riga chiusa come se fosse stata consegnata.
    // 🚨 Il chiesto era 5000 — cioè più delle schede che esistono — e proprio per questo
    // sembrava al sicuro: un tetto chiesto più alto del vero non protegge da un tetto
    // imposto più basso. *Un limite che si dichiara non è un limite che si ottiene.*
    const cercati = new Set(nomi.map((n) => normNome(n)));
    const lettura = await leggiImpaginato<JsonMap>(
      async (from, to) => {
        const { data, error } = await service
          .from('pmo_cloud_records')
          .select('payload')
          .eq('record_type', 'member')
          .not('deleted', 'is', true)
          .range(from, to);
        return { righe: (data ?? []) as JsonMap[], errore: error?.message ?? null };
      },
      { pagina: SUPABASE_PAGE_SIZE, tetto: MAX_SCHEDE_ANAGRAFICA },
    );
    if (lettura.errore) {
      console.error('[staff-events] errore lettura anagrafica:', lettura.errore);
      return err(500, 'DB_ERROR', 'Errore lettura anagrafica.');
    }
    // 🚨 Se il freno ha morso, l'elenco è incompleto e qualcuno tornerebbe «non riconosciuto»
    // per una ragione che non è sua: si smette, senza chiudere niente. I fatti restano in coda
    // e il giro dopo riprova. *Meglio un avviso in ritardo che una riga chiusa a vuoto* — che
    // è esattamente il difetto del 21/08.
    if (lettura.troncato) {
      console.error('[staff-events] anagrafica troncata a', lettura.righe.length, 'schede.');
      return err(500, 'DB_ERROR', 'Anagrafica troppo grande per un giro solo: niente consegnato.');
    }
    for (const row of lettura.righe) {
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
    copertiDaRicevuta: coperti.length,
    ridotti: ridotti.length,
    consegnati: eventi.length,
    nettoNullo: ridotti.length - daDire.length,
    nonRiconosciuti,
    troncato,
    dryRun,
  }));

  return ok({
    eventi,
    troncato,
    non_riconosciuti: nonRiconosciuti,
    coperti_da_ricevuta: coperti.length,
    dry_run: dryRun,
  });
});
