import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { riduci, SOSPETTO_RAFFICA_SPEZZATA_MS, type FattoInCoda } from './riduzione.ts';
import { destinatarioPerNome, normNome, stessaPersona, type SchedaMinima } from './identifica.ts';
import { leggiImpaginato } from './impaginazione.ts';
import {
  copertura,
  FINESTRA_RICEVUTA_MS,
  TOLLERANZA_ANTICIPO_MS,
  type Ricevuta,
} from './ricevute.ts';
/* 🆕🔎 VOCE 68 (01/09/2026) — i modi in cui una riga della coda finisce. Stanno in
   un modulo perché vivono in tre posti (qui, la migrazione, e chi un domani interrogherà la
   colonna), e tre stringhe scritte a mano in tre posti divergono. */
import { ESITO } from './esito-avviso.ts';

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
  // 🔄 VOCE 76 — `origine` si legge perché governa QUANTO SI ASPETTA (`quietaDovuta`), e
  // ⛔ non esce di qui: nella risposta al bot non c'è e non ci deve andare. Al bot arrivano i
  // gesti che già conosce — è il paletto 4, zero righe nel suo repo.
  // ⚠️ Le colonne si passano come VARIABILE, e ha un prezzo dichiarato: supabase-js deduce la
  // forma del risultato solo da una stringa letterale, quindi da qui in poi il tipo non lo
  // garantisce più il compilatore — lo garantisce `COLONNE`, che è l'unica fonte dei nomi.
  // Chi tocca questa stringa deve guardare `FattoInCoda`.
  const COLONNE = 'id, slot, data, ora, campo, persona, gesto, visto_at, tipo, da';
  // 👥 VOCE 79 — `entrati` e `usciti` si chiedono a parte, per lo stesso motivo di `origine`:
  // fino a che la loro migrazione non è applicata su QUESTO progetto, chiederle fermerebbe
  // tutti gli avvisi a tutti i soci. Vedi il ripiego qui sotto.
  const COLONNE_79 = 'entrati, usciti';
  const leggiCoda = async (colonne: string) => {
    const esito = await service
      .from('pmo_eventi_staff')
      .select(colonne)
      .is('consegnato_at', null)
      .order('visto_at', { ascending: true })
      .limit(1000);
    return {
      righe: (esito.data ?? []) as unknown as FattoInCoda[],
      errore: esito.error,
    };
  };

  /* 🆕🗣️ VOCE 79 (01/09) — `chiesto_da` è il ripiego PIÙ ESTERNO, cioè il primo a cadere:
   * è la colonna più nuova, quindi la più probabile a mancare su un progetto non ancora
   * migrato. ⚖️ E perdendola non si perde un avviso: si perde l'**attribuzione**, e le frasi
   * tornano quelle del circolo — che è esattamente il comportamento di ieri. La scala dei
   * ripieghi è ordinata dal meno grave al più grave, e questo è il meno grave di tutti. */
  let { righe, errore } = await leggiCoda(`${COLONNE}, origine, ${COLONNE_79}, chiesto_da`);
  if (errore) {
    console.warn(`[staff-events] coda senza 'chiesto_da' (${errore.message}): riprovo senza — l'attribuzione resta al circolo`);
    ({ righe, errore } = await leggiCoda(`${COLONNE}, origine, ${COLONNE_79}`));
  }
  if (errore) {
    // 👥 VOCE 79 — primo ripiego: senza gli elenchi della formazione. Non si perde niente di
    // quello che c'era prima — i quattro gesti vecchi non li usano — e un gestionale non
    // ancora migrato continua a consegnare tutto il resto.
    console.warn(`[staff-events] coda senza 'entrati/usciti' (${errore.message}): riprovo senza`);
    ({ righe, errore } = await leggiCoda(`${COLONNE}, origine`));
  }
  if (errore) {
    // 🚨⭐⭐ SI RIPROVA SENZA `origine`, e non è una gentilezza: se la migrazione della voce 76
    // non fosse ancora applicata su questo progetto, chiedere una colonna che non esiste
    // fermerebbe **tutti gli avvisi a tutti i soci**, in silenzio e senza che il guasto
    // assomigli alla sua causa.
    // ⚖️ Il ripiego non perde niente di importante: `origine` assente vale `sync`, cioè la
    // quiete piena — si torna al comportamento di prima della voce, che è esattamente ciò che
    // deve succedere finché la colonna non c'è.
    // 📌 È la lezione di `staff_edit` (11/08): un tipo non ammesso dal database faceva
    // rifiutare la scrittura, e le righe sono state zero per mesi senza che nessuno lo vedesse.
    console.warn(`[staff-events] coda senza 'origine' (${errore.message}): riprovo senza — quiete piena per tutti`);
    ({ righe, errore } = await leggiCoda(COLONNE));
  }
  if (errore) {
    console.error('[staff-events] errore lettura coda:', errore.message);
    return err(500, 'DB_ERROR', 'Errore lettura della coda.');
  }
  const fatti = righe;
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
    // 🆕🔇 VOCE 115 — il PERCHÉ si scrive nello stesso gesto che chiude, non dopo: questa
    //    strada non arriva mai al passo in cui gli altri esiti vengono scritti, e fino al
    //    05/09 lasciava `esito` NULL — indistinguibile dalle righe chiuse prima del 01/09.
    const { error: chiudiRicErr } = await service
      .from('pmo_eventi_staff')
      .update({ consegnato_at: adesso, esito: ESITO.GESTO_DAL_BOT })
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
  /* 🆕🚨⭐⭐ VOCE 123 — E ANCHE CHI HA CHIESTO, o la cura non potrebbe funzionare.
   *
   * 📏 Trovato prima di spingere, rileggendo la propria cura invece che il difetto: lo scarto
   * qui sotto chiede `destinatarioPerNome(e.chiestoDa, schede)`, ma `schede` è filtrato su
   * `cercati` — e `cercati` nasceva dalle sole `persona`. ⇒ Un richiedente scritto in
   * anagrafica diversamente da come lo scrive la scheda del circolo non si sarebbe trovato,
   * `destinatarioPerNome` avrebbe risposto `null`, e lo scarto **non sarebbe mai scattato**.
   * Nessun errore, nessun rosso: il difetto sarebbe semplicemente rimasto.
   * ⚖️ È la trappola della 69ª un piano più in là — *una sonda che risponde con sicurezza alla
   * domanda sbagliata* — qui nella forma in cui la sonda ha ragione e i **dati che le si danno**
   * non bastano.
   * ⛔ Non allarga la lettura di dati personali a chiunque: sono i nomi di chi ha appena
   * chiesto una scrittura **su questa stessa partita**, e servono per decidere se TACERE. */
  const nomi = [...new Set([
    ...daDire.map((e) => e.persona),
    ...daDire
      .filter((e) => e.chiestoDaUnanime)
      .map((e) => String(e.chiestoDa ?? '').trim())
      .filter(Boolean),
  ])];

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
  /**
   * 🆕🔒⭐⭐ 24/08/2026 sera — GLI ID DI OGNI EVENTO, in parallelo a `eventi`.
   *
   * Serve alla chiusura del passo 5: si consegna solo ciò che si è riusciti DAVVERO a
   * prendere. Senza questa corrispondenza non si potrebbe togliere dalla risposta un fatto
   * che nel frattempo se n'è preso un altro giro. Vedi il passo 5.
   */
  const idsPerEvento: string[][] = [];
  const daChiudere: string[] = [];
  /* 🆕🔎 VOCE 68 (01/09/2026) — PERCHÉ ogni riga viene chiusa.
   *
   * 🚨 `consegnato_at` risponde a *«questa riga è chiusa?»*, e su quella poggia tutta la
   * protezione contro il doppio invio. Ma chi la guardava per sapere *«è arrivato?»* otteneva
   * **sì** anche per un messaggio mai partito — un nome non riconosciuto, un netto nullo, una
   * corsa persa. 📏 Su PROD: 605 righe chiuse, 22 messaggi davvero usciti nel tratto di
   * registro letto. ⇒ Il perché esce accanto al dato, invece di lasciarlo dedurre.
   * ⚖️ Si AGGIUNGE e non rinomina niente: cambiare il significato di `consegnato_at`
   * vorrebbe dire toccare la chiusura atomica del 24/08, che è la cosa che funziona. */
  const esitoPerId = new Map<string, string>();
  const segnaEsito = (ids: string[], esito: string) => {
    for (const id of ids) esitoPerId.set(clean(id), esito);
  };
  /** Quanti fatti se li è presi un altro giro mentre questo lavorava. Vedi il passo 5. */
  let soffiati = 0;
  let nonRiconosciuti = 0;
  /** 🆕 VOCE 123: quanti avvisi non sono partiti perché il gesto era di chi li riceverebbe. */
  let suoiGesti = 0;
  let troncato = false;

  for (const e of ridotti) {
    // Netto nullo: niente da dire, ma le righe si chiudono — se no si riesaminano per sempre.
    if (e.gesto === null) { daChiudere.push(...e.ids); segnaEsito(e.ids, ESITO.NETTO_NULLO); continue; }

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
      segnaEsito(e.ids, ESITO.NON_RICONOSCIUTO);
      nonRiconosciuti += 1;
      continue;
    }

    /* 🆕🚨⭐⭐ VOCE 123 (02/09/2026) — A CHI HA CHIESTO IL GESTO, IL CIRCOLO NON LO ANNUNCIA.
     *
     * 📏 VISTO SUCCEDERE, non dedotto. 00:02:47 Maurizio toglie Marco dalla partita del 7
     * settembre; 00:03:26 gli arriva *«🔄 È cambiata la formazione della tua partita … Esce
     * Marco Aprea. L'ha chiesto Maurizio Aprea … Se non te lo aspettavi, parlane con Maurizio
     * Aprea.»* ⇒ Il circolo gli attribuisce un gesto suo e lo manda a parlare con sé stesso,
     * che è un'istruzione che non si può eseguire.
     *
     * ⚖️ PERCHÉ NON BASTAVA LA RICEVUTA DELLA VOCE 70, ed è la misura che ha corretto la
     * scheda della voce (che proponeva di allargarla): chi ha chiesto **resta in campo**,
     * quindi il fatto che lo raggiunge è `formazione` — e il vocabolario delle ricevute è
     * `aggiunto | tolto | annullata`. `copertura()` accoppia anche sul gesto ⇒ **nessuna
     * ricevuta può coprire un `formazione`**, né oggi né allargandola a `member.name`.
     * 📌 *Una protezione si estende dove arriva la sua CHIAVE, non dove arriva la sua ragione.*
     *
     * ⭐ E LO SCARTO STA NEL GESTIONALE, non nel bot: il bot non riceve niente da scartare, e
     * la regola di casa resta intera — *il gestionale SA, il bot DICE*. È anche la forma che
     * regge sui gesti futuri, perché non passa dal vocabolario delle ricevute.
     *
     * 🚨 SI CHIEDE ALL'ANAGRAFICA, non alle stringhe: `persona` è il nome come lo scrive la
     * scheda del circolo, `chiesto_da` è quello dell'anagrafica, e il progetto sa già che le
     * due grafie divergono. Un confronto fra nomi fallirebbe **in silenzio** proprio qui.
     *
     * ⛔ E SOLO SE LA RAFFICA È TUTTA SUA (`chiestoDaUnanime`): un gruppo che mescola un suo
     * gesto e uno della segreteria si consegna, o gli si toglierebbe l'unica notizia che
     * nessun altro gli darà. *Ogni scarto in più è un avviso che qualcuno non riceve.*
     */
    if (e.chiestoDaUnanime && stessaPersona(chi, destinatarioPerNome(e.chiestoDa ?? '', schede))) {
      console.log(`[staff-events] non lo dico a ${e.persona} (${e.gesto} ${e.data} ${e.ora} C${e.campo}): l'ha chiesto lui`);
      daChiudere.push(...e.ids);
      segnaEsito(e.ids, ESITO.SUO_GESTO);
      suoiGesti += 1;
      continue;
    }

    eventi.push({
      gesto: e.gesto,
      persona: e.persona,
      pmo_player_id: chi.pmoPlayerId || null,
      member_id: chi.memberId || null,
      // ⭐ VOCE 74: `tipo` viaggia fino al bot perché le sue frasi dicono tutte «partita», e a
      // una lezione vanno dette con la sua parola. È la parola del GESTIONALE (`lezione` /
      // `partita`), tradotta a monte in `eventi-staff.ts`: qui non si ritraduce niente, o
      // sarebbero due copie della stessa regola. `null` = non lo so ⇒ il bot dice «partita»,
      // che è il comportamento di prima.
      partita: { data: e.data, ora: e.ora, campo: e.campo, slot: e.slot, tipo: e.tipo ?? null },
      // 🔄 VOCE 74 (23/08): solo su `spostata`, e dice DA DOVE. Le coordinate dentro `partita`
      // sono quelle d'arrivo — è lì che si va a giocare — e questa è la partenza, che il socio
      // ha in testa. ⚠️ `null` su tutto il resto: il bot regge senza, dicendo comunque dov'è.
      da: e.da ?? null,
      /* 🆕🗣️ VOCE 79 (01/09) — CHI ha chiesto il gesto, quando non è la segreteria.
       * 📏 Il campo nasce da una prova fisica: alle 20:01 tre soci hanno letto «L'ha cambiata
       * il circolo» di un ingresso chiesto da una socia, col numero della segreteria in fondo.
       * ⛔ E `origine` NON esce di qui, né allora né adesso: governa quanto si aspetta, non
       * cosa si dice. Le due colonne rispondono a due domande diverse — *come è arrivato* e
       * *chi l'ha voluto* — e solo la seconda è affare del socio.
       * ⚠️ `null` ⇒ il bot dice le frasi del circolo, parola per parola come prima. */
      chiesto_da: e.chiestoDa ?? null,
      // 👥 VOCE 79 (31/08): solo su `formazione`, e dicono chi è entrato e chi è uscito. Sono
      // il contenuto del messaggio, non un contorno: un avviso di cambio formazione senza i
      // nomi non direbbe niente. ⚠️ Sempre presenti (vuoti sugli altri gesti), così chi legge
      // non deve difendersi da un campo che a volte c'è.
      entrati: e.entrati ?? [],
      usciti: e.usciti ?? [],
    });
    idsPerEvento.push([...e.ids]);
    daChiudere.push(...e.ids);
    segnaEsito(e.ids, ESITO.PASSATO_AL_BOT);
  }

  // ── 5. La chiusura ───────────────────────────────────────────────────────────────────
  // ⚠️ Si chiude PRIMA che il bot abbia scritto ai soci, e il verso è deliberato: se il bot
  // cade fra il ritiro e l'invio, quel messaggio è perso. L'alternativa — chiudere dopo una
  // conferma del bot — regalerebbe il caso opposto, in cui una conferma persa fa mandare
  // tutto due volte. *Un avviso in meno è un fastidio; un avviso doppio è il difetto che il
  // progetto evita apposta da sempre* (voce 63, gli inviti orfani ritirati in silenzio).
  /* ═══════════════════════════════════════════════════════════════════════════════════════
     🚨🔒⭐⭐ 24/08/2026 sera — LA CHIUSURA SI PRENDE I FATTI, NON LI DÀ PER PRESI.

     🗣️ Segnalato da lui: *«oggi mi sono arrivati 2 messaggi di seguito uguali»* — due volte
     «🎾 Sei in campo · Domani alle 14:00, campo 2».

     📏 Misurato nel registro del bot, al secondo:
         13:13:54  🤖 bot avviato                          ← un riavvio
         13:15:56  🔔 detto a Maurizio Aprea: aggiunto — 2026-08-25|14:00|2
         13:15:56  🔔 fatti del circolo ACCESI: 2 ritirati ora, 1 detti   ← il giro dell'ACCENSIONE
         13:15:57  🔔 detto a Maurizio Aprea: aggiunto — 2026-08-25|14:00|2   ← di nuovo
         13:15:57  🔔 circolo: 2 ritirati, 1 detti, 1 scartati              ← un giro NORMALE
     ⇒ Due giri a un secondo di distanza, e **tutt'e due hanno ritirato gli stessi 2 fatti**.

     🎯 LA CAUSA, ed era qui dentro: la coda si LEGGE al passo 1 (`consegnato_at is null`) e si
     CHIUDE qui al passo 5. In mezzo c'è tutta la funzione. Due chiamate ravvicinate leggono le
     stesse righe **prima che una delle due le abbia chiuse**, e poi le chiudono tutt'e due —
     ognuna convinta di essere sola.
     📌 *Una coda si consuma prendendo, non guardando e poi prendendo: fra il guardare e il
     prendere ci sta un altro.*

     ⚖️ E qui NON c'è la rete che hanno gli altri avvisi: quelli si aggiudicano il diritto di
     parlare con `segnaAvviso`, che è un `update … where colonna is null` — atomico, deciso dal
     database. Questa strada si fidava della marcatura, che atomica non era.

     🔨 LA CURA: si chiude pretendendo che siano ANCORA LIBERI (`.is('consegnato_at', null)`) e
     ci si fa dire **quali si è presi davvero** (`.select('id')`). Chi arriva secondo se ne
     prende zero, e non consegna. È lo stesso meccanismo di `segnaAvviso`, portato dove mancava.

     ⚠️ E la risposta si filtra di conseguenza: un fatto che non si è riusciti a prendere NON
     esce verso il bot. Un evento fuso da più righe si consegna solo se le si sono prese
     **tutte** — se un'altra ne ha già una, sta parlando lei.
     ⚖️ Si sbaglia dalla parte del silenzio, ed è la scelta già dichiarata dieci righe più su:
     *un avviso in meno è un fastidio; un avviso doppio è il difetto che il progetto evita
     apposta da sempre*.
     ═══════════════════════════════════════════════════════════════════════════════════════ */
  if (!dryRun && daChiudere.length) {
    const { data: presiRaw, error: chiudiErr } = await service
      .from('pmo_eventi_staff')
      .update({ consegnato_at: new Date().toISOString() })
      .in('id', daChiudere)
      .is('consegnato_at', null)
      .select('id');
    if (chiudiErr) {
      // 🚨 Non si consegna niente se non si è riusciti a chiudere: consegnare senza chiudere
      // significa rimandare gli stessi fatti al giro dopo, cioè scrivere due volte al socio.
      console.error('[staff-events] errore chiusura:', chiudiErr.message);
      return err(500, 'DB_ERROR', 'Errore nella chiusura della coda: niente consegnato.');
    }
    // 🔤 Il tipo si dichiara invece di lasciarlo dedurre: senza, l'elemento è `unknown` e la
    // mappa degli esiti (voce 68) non lo sa più cercare. Stessa riga, stesso valore.
    const presi = new Set<string>((presiRaw ?? []).map((r) => clean((r as JsonMap).id)));
    // Si scorre all'indietro: togliendo dal fondo gli indici davanti non si spostano.
    for (let i = eventi.length - 1; i >= 0; i--) {
      const miei = idsPerEvento[i] ?? [];
      if (miei.length && miei.every((id) => presi.has(clean(id)))) continue;
      /* 🆕🔎 VOCE 68 — le righe di QUESTO evento che questo giro si è preso non usciranno
       * mai: l'evento è stato tolto dalla risposta perché una riga sorella se l'è presa un
       * altro giro. Sono nostre e chiuse, ma non consegnate — ed è il caso in cui
       * `consegnato_at` mentiva in modo più insidioso, perché qui il nome era riconosciuto e
       * il messaggio sarebbe partito. */
      segnaEsito(miei, ESITO.CORSA_PERSA);
      eventi.splice(i, 1);
      idsPerEvento.splice(i, 1);
      soffiati += 1;
    }
    /* 🆕🔎 VOCE 68 — il perché si scrive DOPO la presa, su righe che sono già nostre: qui non
     * c'è nessuna corsa da vincere, e infatti non si pretende `consegnato_at is null` (lo
     * abbiamo appena messo noi). ⛔ E un errore qui NON tocca la consegna: è diagnostica, e
     * far cadere un avviso vero per una riga di contabilità sarebbe il verso sbagliato — lo
     * stesso già scelto per la ricevuta della voce 70. */
    const perEsito = new Map<string, string[]>();
    for (const id of presi) {
      const esito = esitoPerId.get(id);
      if (!esito) continue;
      const gruppo = perEsito.get(esito);
      if (gruppo) gruppo.push(id); else perEsito.set(esito, [id]);
    }
    for (const [esito, ids] of perEsito) {
      const { error: esitoErr } = await service
        .from('pmo_eventi_staff')
        .update({ esito })
        .in('id', ids);
      if (esitoErr) {
        console.error(`[staff-events] esito «${esito}» non scritto su ${ids.length} righe: ${esitoErr.message} — la colonna resta muta, gli avvisi no`);
      }
    }
    console.log(
      `[staff-events] esiti: ${[...perEsito].map(([k, v]) => `${k}=${v.length}`).join(' · ') || 'nessuno'}`,
    );
    if (soffiati) {
      // 🚨 NON è un guasto e NON si tace: è la prova che due giri si sono sovrapposti, ed è
      // l'unico posto da cui lo si può sapere. Zero righe qui = la corsa non è più successa.
      console.warn(`[staff-events] ${soffiati} fatti già presi da un altro giro: non li consegno.`);
    }
  }

  // ── 5bis. LE RAFFICHE SPEZZATE, solo per il registro ────────────────────────────────
  // 🚨 Non cambia niente di ciò che si consegna: conta le volte in cui a una coppia (persona,
  // partita) si era GIÀ consegnato qualcosa poco fa, e adesso le si consegna dell'altro. È il
  // sintomo che la quiete non ha tenuto insieme una raffica.
  // ⚖️ Esiste per rendere DECIDIBILE sui dati il valore di `QUIETE_MS`, che il 22/08 è stato
  // discusso su delle stime: *una soglia senza una misura che la sorvegli è un'opinione che ha
  // preso la forma di una costante.* Se questa riga non compare mai, la quiete si abbassa
  // senza discutere; se compare spesso, si alza con un numero in mano.
  // ⚠️ Best effort e dentro un try: una diagnostica non deve poter far fallire una consegna.
  let raffichePezzate = 0;
  if (eventi.length) {
    try {
      const daQuando = new Date(Date.now() - SOSPETTO_RAFFICA_SPEZZATA_MS).toISOString();
      const slotDetti = [...new Set(ridotti.filter((e) => e.gesto !== null).map((e) => e.slot))];
      const { data: gia } = await service
        .from('pmo_eventi_staff')
        .select('slot, persona')
        .in('slot', slotDetti)
        .not('consegnato_at', 'is', null)
        .gte('consegnato_at', daQuando);
      const gaCoppie = new Set((gia ?? []).map((r) =>
        `${normNome((r as JsonMap).persona)}\u0000${clean((r as JsonMap).slot)}`));
      for (const e of ridotti) {
        if (e.gesto === null) continue;
        if (gaCoppie.has(`${normNome(e.persona)}\u0000${e.slot}`)) {
          raffichePezzate += 1;
          console.warn(`[staff-events] raffica SPEZZATA: ${e.persona} ${e.data} ${e.ora} C${e.campo} — le era già stato consegnato qualcosa negli ultimi ${Math.round(SOSPETTO_RAFFICA_SPEZZATA_MS / 60000)} minuti`);
        }
      }
    } catch (e) {
      console.warn('[staff-events] conteggio raffiche spezzate non riuscito:', clean((e as Error)?.message ?? 'errore'));
    }
  }

  console.log(JSON.stringify({
    event: 'staff_events_consegna',
    inCoda: fatti.length,
    copertiDaRicevuta: coperti.length,
    raffichePezzate,
    ridotti: ridotti.length,
    consegnati: eventi.length,
    nettoNullo: ridotti.length - daDire.length,
    nonRiconosciuti,
    suoiGesti,
    troncato,
    dryRun,
  }));

  return ok({
    eventi,
    troncato,
    non_riconosciuti: nonRiconosciuti,
    coperti_da_ricevuta: coperti.length,
    // 🆕 VOCE 123: quanti avvisi sono stati taciuti perché il gesto era di chi li riceverebbe.
    // Come `gia_presi_da_un_altro_giro`, il bot non ci decide niente: è la traccia che rende
    // visibile uno scarto che, per definizione, non lascia nessun messaggio dietro di sé.
    suoi_gesti: suoiGesti,
    // 🆕 Quanti fatti se li è presi un altro giro sovrapposto (vedi il passo 5). Il bot non lo
    // usa per decidere niente — lo scrive nel registro, ed è così che la corsa si vede.
    gia_presi_da_un_altro_giro: soffiati,
    dry_run: dryRun,
  });
});
