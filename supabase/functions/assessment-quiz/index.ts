import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// assessment-quiz — IL CANCELLO DI CONOSCENZA, spostato dal telefono al server.
//
// 🚨 IL BUCO CHE CHIUDE (voce 27, punti 1-2-3). Fino a oggi il test di livello si correggeva
// NEL BROWSER: la banca delle domande — risposte comprese — stava dentro `index.html`, che è
// il file che si scarica per fare il test. Il telefono pescava, correggeva, decideva l'esito
// e poi scriveva LUI la riga in `self_assessments` (tre policy di INSERT anonimo a
// `WITH CHECK (true)`), e il cron `assessment-apply-level` la applicava entro 15 minuti.
// ⇒ Chi aveva il proprio link poteva **darsi il livello che voleva**. Il muro «senza livello
// non si organizza» non si superava: si scavalcava.
// Il codice lo sapeva già di sé, nel commento sopra la banca: *«la pagina è statica, quindi le
// risposte stanno nel sorgente… in Fase 2 il bot correggerà da server e nemmeno quello resterà
// visibile»*. Questa funzione è quella Fase 2, per la sola parte che serviva davvero.
//
// ⭐ LA BANCA È STATA SPOSTATA, NON COPIATA. È la differenza fra chiudere il buco e aggiungere
// un giro: se le domande restassero anche in `index.html`, le risposte resterebbero pubbliche
// e tutto questo non servirebbe a niente. Vive fra le sentinelle ASSESS-KNOWLEDGE SHARED, e
// `test/autovalutazione-conoscenza.test.mjs` la **estrae da QUI** ed esegue il blocco vero.
//
// 🎲 PERCHÉ LE DOMANDE SI RIPESCANO INVECE DI SALVARLE. La correzione deve sapere quali domande
// erano state fatte. Farsele rimandare dal telefono rimetterebbe il coltello dalla parte del
// manico — bastava dichiarare «zero domande pescate» per ottenere `skip`, o una fascia senza
// cancello per ottenere `pass`. Salvarle vorrebbe una colonna nuova e una riga di stato da
// tenere pulita. ⇒ Si pescano DUE VOLTE con lo stesso seme, che è il gettone del socio: stesso
// gettone e stessa fascia ⇒ stesse quattro domande, senza salvare niente. Il telefono non ha
// voce in capitolo su quali fossero.
// ⚠️ Cambiare fascia cambia le domande, ed è giusto: la scheda le ridisegna già a ogni cambio.
//
// 🔑 AUTENTICAZIONE: nessun secret. Il gate è il **gettone stesso**, che è la credenziale del
// socio — questa funzione la chiama il telefono di chi fa il test, non un ponte. Si deploya con
// --no-verify-jwt come le altre pubbliche. Un gettone sconosciuto, già usato o scaduto non
// ottiene domande e non scrive niente.
// ⏳ E qui vive il PUNTO 3 della voce 27: `expires_at` finora non lo leggeva nessuno. Adesso sì.
//
// ✍️ SCRITTURE, con la chiave di servizio: una riga in `self_assessments` e il gettone portato a
// `completed`. Sono le stesse due scritture che prima faceva il browser — cambia chi le fa e su
// che base. ⛔ Nessuna scrittura verso Matchpoint: qui non c'entra il recinto delle `matchpoint-*`.

type JsonMap = Record<string, unknown>;

/* La forma di una domanda pescata. Vive QUI e non in `conoscenza.js` perché di là il tipo non
   si può scrivere — è JavaScript apposta, per poter girare nel banco. ⇒ Il confine fra i due
   file è anche il confine fra «codice che il banco esegue» e «codice che il compilatore
   controlla», e ognuno dei due dichiara ciò che sa dichiarare. */
type Domanda = { id: string; fascia: string; trap: boolean; q: string; opts: string[] };

/* La riga del gettone, nella forma che `gettoneValido` sa restituire. Sta qui e non dentro
   quella funzione perché ora la leggono in due: la consegna e il motore a passi. */
type Gettone = {
  token: string; member_local_id: string | null; member_name: string | null;
  phone_last4: string | null; status: string; expires_at: string | null;
  // 🆕 27/08 sera — l'istante di nascita del gettone: è il taglio immutabile della MEMORIA
  //    della pescata (vedi `domandeGiaViste`). ⚠️ Questo tipo e la `.select()` di
  //    `gettoneValido` sono DUE dichiarazioni della stessa forma: si cambiano insieme, o
  //    `deno check` cade — ed è successo, perché in locale deno non c'è e a dirlo è solo la CI.
  created_at: string | null;
} | null;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

import {
  ASSESS_KNOWLEDGE_BANK,
  PMO_LIVELLI,
  assessKey,
  assessKnowledgeEvaluate,
  assessKnowledgeFasciaFor,
  assessKnowledgePick,
  assessKnowledgeRegole,
  assessKnowledgeShuffle,
  assessTxt,
  assessmentPublicParseLevel,
  assessmentPublicScoreFromText,
  assessmentPublicTechnicalScores,
  calculateAssessmentPublicLevel,
  certificazioneDelMaestro,
  cleanCell,
  fasciaDaLivello,
  normalizeText,
  numero,
  pescaPerGettone,
  pmoLivelloDefinizione,
  pmoLivelloFascia,
  roundAssessmentToHalf,
  seme,
  sorteDa,
} from './conoscenza.js';

/* 🧩 Il motore a passi vive in un modulo suo (voce 97): le domande della scheda, dove siamo
   arrivati e cosa è una risposta ammessa sono **decisioni**, e le decisioni vanno in un posto
   che il banco possa eseguire. Qui restano il database e le porte. */
import {
  nomeSpezzato,
  passoCorrente,
  risposteConoscenza,
  schedaDaRisposte,
  valoreAmmesso,
  valoreDaIndice,
} from './passi.js';

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

/* Il tipo del client si prende da CHI lo fabbrica, non riscrivendo `ReturnType<typeof
   createClient>`: quella forma risolve con parametri generici diversi da quelli del client
   vero, e `deno check` la respinge — «SupabaseClient<any,…> non assegnabile a
   SupabaseClient<unknown,…>». Legandolo a `servizio()` combaciano per costruzione. */
type Db = NonNullable<ReturnType<typeof servizio>>;

function servizio() {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Il gettone, e i tre modi in cui può non valere. Il verso del dubbio è sempre «no». */
async function gettoneValido(db: Db, token: string) {
  const { data, error } = await db
    .from('assessment_tokens')
    // 🚨 SOLO colonne che esistono su ENTRAMBI i progetti. Misurato il 14/08 dopo che questa
    // riga ha fatto fallire la prima prova su TEST: `member_email` c'è su `qqbf…` e NON su
    // `cudi…`. Le due tabelle sono divergenti, come lo erano le funzioni SQL della voce 33 —
    // solo che di questa divergenza non lo sapeva nessuno. Scrivere una query guardando un
    // solo database è scrivere metà query.
    // 🆕 27/08 sera — `created_at` serve alla MEMORIA della pescata: è l'istante che separa
    //    «schede che questo socio aveva già consegnato» da quelle venute dopo. ✅ Verificato
    //    presente su TUTTI E DUE i progetti prima di scriverlo, che è la trappola del 14/08.
    .select('token, member_local_id, member_name, phone_last4, status, expires_at, created_at')
    .eq('token', token)
    .maybeSingle();
  /* 🔢 Il client non conosce lo schema, quindi PostgREST risolve la `select` a `never` e
     leggere `data.status` è un errore di tipo. La forma la dichiariamo noi, qui, una volta:
     è la stessa lista di colonne della `select` qui sopra — se una cambia, cambiano entrambe. */
  const riga = data as
    | { token: string; member_local_id: string | null; member_name: string | null;
        phone_last4: string | null; status: string; expires_at: string | null;
        created_at: string | null }
    | null;
  if (error) {
    // Il motivo VERO nel log della funzione: al socio si dice una cosa comprensibile, ma chi
    // deve capire perché non deve ripartire da «Failed to fetch». È il buco di diagnosi che
    // ha fatto perdere il primo giro di prove.
    console.error('assessment-quiz: lettura gettone fallita —', error.message, error.details ?? '');
    return { errore: err(500, 'LETTURA_FALLITA', 'Non riesco a leggere il gettone.') };
  }
  if (!riga) return { errore: err(404, 'GETTONE_SCONOSCIUTO', 'Questo link non risulta valido.') };
  if (riga.status === 'completed') {
    return { errore: err(409, 'GIA_COMPILATA', 'Questa scheda risulta già compilata.') };
  }
  // ⏳ PUNTO 3 della voce 27: la scadenza, che prima non leggeva nessuno.
  if (riga.expires_at && new Date(String(riga.expires_at)).getTime() < Date.now()) {
    return { errore: err(410, 'GETTONE_SCADUTO', 'Questo link è scaduto: chiedi in segreteria.') };
  }
  return { riga };
}

/**
 * Il SESSO del socio, letto dalla sua scheda invece che richiesto — voce 84 ⓑ, 24/08/2026.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * 🚨⭐⭐ IL DIFETTO CHE CURA, e non si vedeva da nessuna delle due parti da sole.
 *
 * Il cancello qui sotto manda la scheda «in mano alla segreteria» quando il sesso è `NA`, e da
 * lì `assessment-apply-level` la scarta PER SEMPRE (`staff_status` non vuoto ⇒ mai applicata).
 * Ma la domanda sul sesso, nella pagina del quiz, vive dentro `assessmentPublicConfigureExternalData`
 * e si mostra **solo per il link esterno**: sulla strada del GETTONE la funzione esce prima
 * (`if (!isExternal) { … return }`), il campo resta vuoto, e il socio non l'ha mai saltata —
 * non gliel'hanno mai chiesta.
 * 📏 Misurato il 24/08 su PROD, **2 casi su 2**: Laura Aprea (24/08) e Fabiola Limuti (19/08),
 * tutte e due `pass` al quiz, tutte e due `gender: ''`, tutte e due ferme a `review` con
 * `applied_at` nullo. Laura ha risposto anche alla domanda del bot — e il livello non è arrivato.
 *
 * ⭐ E LA CURA NON È AGGIUNGERE LA DOMANDA: è non farla. Sulla scheda socio di Laura c'è scritto
 * `gender: 'F'` — il circolo lo sa. *Il gestionale SA, il bot DICE*: un dato che il gestionale
 * possiede non si richiede a chi l'ha già dato, o diventa un secondo posto da tenere allineato.
 *
 * 🔒 FALLISCE CHIUSA, e nel verso che c'era già: se la lettura non riesce, o la scheda non ha un
 * sesso valido, torna stringa vuota ⇒ il chiamante resta a `NA` ⇒ `review`, esattamente come
 * prima. Questa funzione può solo TOGLIERE una revisione ingiusta, mai aggiungerne una.
 * ⚠️ Si accettano solo `M` e `F`: qualunque altra cosa scritta là dentro non è un sesso noto, e
 * far passare il cancello su un valore che non si sa leggere sarebbe peggio di trattenerlo.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */
async function genereDallaSchedaSocio(db: Db, memberLocalId: string | null | undefined): Promise<string> {
  const id = assessTxt(memberLocalId);
  if (!id) return '';
  const { data, error } = await db
    .from('pmo_cloud_records')
    .select('payload')
    .eq('record_type', 'member')
    .eq('deleted', false)
    .eq('payload->>id', id)
    .limit(10);
  if (error) {
    // Il motivo vero nel registro, come per la lettura del gettone: chi diagnostica non deve
    // ripartire da un sintomo. Al socio non cambia niente — resta il comportamento di prima.
    console.error('assessment-quiz: lettura sesso dalla scheda fallita —', error.message, error.details ?? '');
    return '';
  }
  // ⚠️ Le righe possono essere PIÙ D'UNA per la stessa persona: nella copia cloud lo stesso socio
  // sta sotto più chiavi (`email:…`, `phone:…`, id nudo) — è la famiglia della voce 69. Si
  // prende il primo sesso leggibile: fra copie della stessa persona quel dato non diverge, e
  // scegliere «la riga giusta» sarebbe una regola che qui non spetta.
  for (const r of (data ?? []) as { payload?: { gender?: unknown } | null }[]) {
    const g = assessTxt(r?.payload?.gender).toUpperCase();
    if (g === 'M' || g === 'F') return g;
  }
  return '';
}

/* 🔐 LA SECONDA PORTA: la sessione dello STAFF.
   L'anteprima del gestionale — «prova il test» — non ha un gettone di socio, ma le domande
   e la correzione le servono lo stesso. Aprirle senza gate sarebbe peggio che lasciarle in
   `index.html`: quattro domande da quattro opzioni fanno **256 combinazioni**, e un oracolo
   che risponde «giusto/sbagliato» le svela in pochi secondi — a chiunque, non solo allo staff.
   ⇒ Le azioni `staff-*` vogliono un JWT vero, verificato qui contro Supabase.
   📌 La chiave pubblicabile NON passa questo controllo: è un JWT senza utente dietro. */
async function staffValido(db: Db, req: Request): Promise<boolean> {
  const intestazione = req.headers.get('Authorization') || '';
  const jwt = intestazione.startsWith('Bearer ') ? intestazione.slice(7).trim() : '';
  if (!jwt) return false;
  try {
    const { data, error } = await db.auth.getUser(jwt);
    return !error && !!data?.user?.id;
  } catch {
    return false;
  }
}

/* 🚨 LA RETE SOTTO TUTTO — nata dal guasto del 14/08, e vale più del guasto.
   Un'eccezione non catturata la risponde il RUNTIME, non questa funzione: 500 senza le
   intestazioni CORS ⇒ il browser non vede l'errore, vede il CORS che salta, e dice
   «Failed to fetch». Cioè: il nulla. Ci sono voluti tre giri di prove per arrivare a un
   `ReferenceError` che il server conosceva dal primo istante.
   ⇒ Da qui in poi QUALSIASI cosa vada storta esce come JSON con CORS, e il motivo vero
   finisce nel log. Un errore che si sa leggere vale più di un errore che non capita. */
Deno.serve(async (req: Request) => {
  try {
    return await gestisci(req);
  } catch (e) {
    console.error('assessment-quiz: eccezione non prevista —', (e as Error)?.stack || String(e));
    return err(500, 'GUASTO_INTERNO', 'Qualcosa è andato storto. Riprova, o scrivi in segreteria.');
  }
});

async function gestisci(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return err(405, 'METODO', 'Solo POST.');

  const db = servizio();
  if (!db) return err(503, 'NON_CONFIGURATA', 'Manca la chiave di servizio.');

  let corpo: JsonMap;
  try { corpo = await req.json(); } catch { return err(400, 'CORPO', 'Corpo non leggibile.'); }

  const azione = assessTxt(corpo.azione);

  // ── Le azioni dello STAFF: nessun gettone, ma una sessione vera. Non scrivono niente. ──
  if (azione === 'staff-pesca' || azione === 'staff-valuta') {
    if (!await staffValido(db, req)) {
      return err(401, 'NON_AUTORIZZATO', 'Serve una sessione staff.');
    }
    // Il seme lo sceglie il SERVER e torna opaco: il telefono non decide le domande, e alla
    // valutazione le ripesca identiche senza che nessuno abbia salvato niente.
    const fascia = fasciaDaLivello(
      azione === 'staff-pesca' ? corpo.livello_dichiarato : (corpo.scheda as JsonMap)?.declaredLevel,
    );
    const semeStaff = assessTxt(corpo.seme) || crypto.randomUUID();
    const pescate = fascia ? assessKnowledgePick(fascia, sorteDa(seme(semeStaff, assessTxt(fascia)))) : [];

    if (azione === 'staff-pesca') {
      return ok({
        seme: semeStaff,
        fascia,
        cancello: !!fascia && assessKnowledgeRegole(fascia).cancello,
        domande: pescate.map((d: Domanda) => ({ id: d.id, fascia: d.fascia, q: d.q, opts: d.opts })),
      });
    }
    const scheda = (corpo.scheda ?? {}) as JsonMap;
    return ok({
      conoscenza: assessKnowledgeEvaluate(
        pescate.map((d: Domanda) => d.id), (corpo.risposte ?? {}) as Record<string, string>, fascia,
      ),
      livello: calculateAssessmentPublicLevel(scheda),
    });
  }

  const token = assessTxt(corpo.token);
  if (!token) return err(400, 'GETTONE_MANCANTE', 'Manca il gettone.');

  const g = await gettoneValido(db, token);
  if (g.errore) return g.errore;
  const gettone = g.riga ?? null;

  // ── PESCA: le domande, SENZA la risposta giusta ──────────────────────────────────────
  if (azione === 'pesca') {
    /* ═══════════════════════════════════════════════════════════════════════════════════
       🆕⏱️⭐⭐ 24/08/2026 (voce 84, cura C) — QUI IL SOCIO COMINCIA, e da qui parte il tempo.

       🗣️ Decisione sua, la sera del collaudo di Marco Aprea: *«Il tempo bisogna calcolarlo da
       quando si inizia a fare il quiz.»*

       📏 Il perché, misurato: il bot dava il link alle 20:53 e sorvegliava 20 minuti; il socio
       ha aperto il quiz alle 21:16 — 23 minuti dopo, che è la cosa che fa una persona normale —
       e l'ha finito in 1'34". Alla consegna non lo guardava più nessuno. ⇒ Il cronometro era
       ancorato al momento in cui il link **si consegna**, non a quello in cui **si apre**.

       ⭐⭐ E IL FATTO ESISTEVA GIÀ: `pesca` è la chiamata con cui la PAGINA si fa dare le
       domande, cioè esattamente «adesso sto cominciando». Non serviva un segnale nuovo —
       serviva conservare quello che passava già di qui e che nessuno scriveva.

       ⏳ SI RISCRIVE A OGNI APERTURA, deliberato: chi ricarica la pagina sta ricominciando, e
       il suo cronometro riparte. Il costo è che un socio che ricarica allunga la propria
       finestra — che è quello che deve succedere — e il tetto assoluto della sorveglianza,
       che vive nel bot, resta comunque a proteggere dal caso senza fine.

       🚨 NON FA FALLIRE NIENTE, e l'ordine è questo apposta: prima si tenta di scrivere, poi si
       risponde comunque con le domande. Se la scrittura non riesce, il socio fa il suo quiz e
       l'esito gli arriva col giro dei 15 minuti — si perde la fretta, non il fatto. Al
       contrario, un socio lasciato senza domande per un cronometro è un danno vero.
       ═══════════════════════════════════════════════════════════════════════════════════ */
    const { error: erroreApertura } = await db
      .from('assessment_tokens')
      .update({ opened_at: new Date().toISOString() })
      .eq('token', token);
    if (erroreApertura) {
      console.error(`[assessment-quiz] apertura non segnata per ${token} (${erroreApertura.message}) — l'esito arriverà col giro dei 15′`);
    }

    const fascia = fasciaDaLivello(corpo.livello_dichiarato);
    const regole = assessKnowledgeRegole(fascia);
    // 🚨 `opts` esce così com'è; `correct` non compare da nessuna parte in questa risposta.
    // È l'intero motivo per cui questa funzione esiste: la risposta giusta non attraversa
    // più la rete verso il telefono.
    const viste = fascia ? await domandeGiaViste(db, gettone) : [];
    const domande = fascia ? pescaPerGettone(token, fascia, viste).map((d: Domanda) => ({
      id: d.id, fascia: d.fascia, q: d.q, opts: d.opts,
    })) : [];
    return ok({ fascia, cancello: !!fascia && regole.cancello, domande });
  }

  // ── CONSEGNA: si corregge qui, si decide qui, si scrive qui ──────────────────────────
  if (azione === 'consegna') {
    return await consegnaScheda(
      db, token, gettone,
      (corpo.scheda ?? {}) as JsonMap,
      (corpo.risposte ?? {}) as Record<string, string>,
    );
  }

  return await motoreAPassi(db, azione, token, gettone, corpo);
}

/* ✍️ LA CONSEGNA, estratta dal corpo di `gestisci` il 25/08 (voce 97) e per il resto INTATTA.
   ⭐ Il motivo dell'estrazione è tutto qui: il test a passi finisce nello **stesso** posto in
   cui finisce la pagina. Correzione, cancello, livello, scrittura e frase del maestro restano
   **un codice solo** — se fossero due, prima o poi direbbero due cose diverse allo stesso socio,
   ed è esattamente il difetto che questo progetto insegue da settimane sotto altri nomi. */
async function consegnaScheda(
  db: Db,
  token: string,
  gettone: Gettone,
  scheda: JsonMap,
  risposte: Record<string, string>,
): Promise<Response> {
  const livCalc = calculateAssessmentPublicLevel(scheda);
  const fascia = fasciaDaLivello(scheda.declaredLevel);
  // 🚨 Gli id NON arrivano dal telefono: si ripescano. Vedi il perché in testa al file.
  const pescate = fascia ? pescaPerGettone(token, fascia, await domandeGiaViste(db, gettone)) : [];
  const conoscenza = assessKnowledgeEvaluate(pescate.map((d: Domanda) => d.id), risposte, fascia);

  // 🚨 voce 84 ⓑ — se il telefono non l'ha mandato, si CHIEDE ALLA SCHEDA prima di dire `NA`.
  // L'ordine è questo e non l'inverso: quello che il socio ha appena dichiarato vale più di
  // quello che c'era in archivio, e la scheda è il ripiego, non la fonte principale.
  const genereDetto = assessTxt(scheda.gender);
  const genereRipescato = genereDetto ? '' : await genereDallaSchedaSocio(db, gettone?.member_local_id);
  if (genereRipescato) {
    console.log(`assessment-quiz: sesso ripescato dalla scheda socio (${genereRipescato}) per il gettone ${token}`);
  }
  const genere = genereDetto || genereRipescato || 'NA';
  const dichiarato = parseFloat(assessmentPublicParseLevel(scheda.declaredLevel));
  const pocaEsperienza = Number.isFinite(dichiarato) && dichiarato >= 3.0
    && ['Meno di 1 mese', '1-3 mesi', '3-6 mesi', '6-12 mesi']
      .some((v) => assessKey(v) === assessKey(scheda.experience));
  /* 🆕🗣️⭐ 30/08/2026 — LA SECONDA BANDIERA: dichiara alto e gioca una volta al mese.
     🗣️ Sua parola sulla proposta ④: *«VAi procedi e fai il lavoro»*.

     📏 IL FATTO CHE L'HA APERTA: la domanda 2 («quante volte giochi al mese?») era **raccolta e
     buttata**. Non pesava nel calcolo — quello si sapeva — ma nemmeno finiva dove qualcuno la
     potesse leggere: la colonna `monthly_frequency` era vuota su **44 schede su 44**, perché
     questa riga cercava `scheda.monthly_frequency` mentre il test manda `frequency`, e nel
     gestionale non c'era nessun punto che la mostrasse. ⇒ Un passo chiesto a ogni socio, per
     niente.
     ⇒ O le si dà un lavoro, o la domanda si toglie. Il lavoro naturale è questo, ed è la gemella
     esatta della bandiera dell'esperienza: chi dichiara Intermedio o più e gioca **0-1 volte al
     mese** non viene bocciato — la scheda passa dalla segreteria.

     ⏳ DICHIARATO: sulle 44 schede col quiz questa bandiera si accende **zero** volte (le tre
     schede con «0-1» dichiarano tutte meno di Intermedio) ⇒ non toglie niente a nessuno oggi, e
     **non è provata su un caso vero**, perché il caso non si è ancora presentato. È una
     protezione preventiva, e va detto: la gemella dell'esperienza, in confronto, si è accesa 2
     volte su 44. */
  const pocaFrequenza = Number.isFinite(dichiarato) && dichiarato >= 3.0
    && assessKey('0-1') === assessKey(scheda.frequency);
  // Il cancello: senza conoscenza dimostrata la scheda non si applica da sola.
  const statoStaff = (genere === 'NA' || conoscenza.status !== 'pass' || pocaEsperienza || pocaFrequenza)
    ? 'review' : livCalc.staff_status;

  const riga = {
    token,
    /* 🚨🚨⭐⭐ 24/08/2026 (voce 84) — `submitted_at` SI SCRIVE, e prima non c'era.
       Costata il collaudo di Marco Aprea, e il difetto non si vedeva rileggendo: la riga
       qui sotto va in `upsert(... onConflict: 'token')`. Su gettone nuovo è un INSERT e la
       data la metteva il database (`default now()`); su un gettone che aveva già una scheda
       è un UPDATE, e `submitted_at` — non essendo nella riga — **restava quella di prima**.
       📏 Misurato: scheda consegnata il 24/08 alle 21:18:23, salvata con la data del 3
       MAGGIO. `assessment-apply-level` la confronta con `lastLevelUpdateAt` del socio (3
       maggio 19:18) e la scarta, giustamente, come «vecchia» — quindi il livello non si
       scrive MAI e il bot non ha niente da annunciare. Non un ritardo: un silenzio definitivo.
       ⚖️ La guardia che l'ha scartata è SANA e non si tocca: *una scheda vecchia non deve
       scavalcare un livello aggiornato dopo*. A mentire era la data, non chi la leggeva.
       📌 *Un campo che il database riempie da sé lo riempie solo alla NASCITA: chi riscrive
       la riga se lo deve scrivere, o eredita il passato di quella prima.* */
    submitted_at: new Date().toISOString(),
    first_name: assessTxt(scheda.first_name) || null,
    last_name: assessTxt(scheda.last_name) || null,
    phone: assessTxt(scheda.phone) || null,
    // ⛔ NIENTE `email`: la colonna c'è su PROD e NON su TEST (misurato il 14/08). Per la
    // strada col gettone non si perde nulla — là l'indirizzo era sempre vuoto, lo riempiva
    // solo il link esterno, che questa strada non la fa. 🔗 Stessa ragione per cui mancano
    // `consistency_score`, `inconsistency_reasons` e `review_note`: non le scriviamo, e su
    // TEST non esistono. La riga è l'INTERSEZIONE dei due schemi, per costruzione.
    experience: assessTxt(scheda.experience) || null,
    /* 🩹 30/08 — `scheda.frequency` PRIMA di `scheda.monthly_frequency`, e senza questa riga la
       risposta alla domanda 2 non arrivava mai in colonna: il modulo e il bot mandano
       `frequency` (è il `name` del campo e la `chiave` in `passi.js`), qui si cercava un nome
       che nessuno manda. 📏 Misurato: colonna vuota su 44 schede su 44, mentre dentro
       `raw_response` la risposta c'era tutte e 44 le volte.
       📌 *Un campo che si scrive da una chiave che nessuno manda non è un dato mancante: è un
       dato che c'è e non si trova.* */
    monthly_frequency: assessTxt(scheda.frequency) || assessTxt(scheda.monthly_frequency) || null,
    basic_strokes: assessTxt(scheda.basic_strokes) || null,
    glass_usage: assessTxt(scheda.glass_usage) || null,
    net_play: assessTxt(scheda.net_play) || null,
    positioning: assessTxt(scheda.positioning) || null,
    rally_patience: assessTxt(scheda.rally_patience) || null,
    competitions: assessTxt(scheda.competitions) || null,
    wants_matches: assessTxt(scheda.wants_matches) || null,
    preferred_days: assessTxt(scheda.preferred_days) || null,
    preferred_hours: assessTxt(scheda.preferred_hours) || null,
    availability_time: assessTxt(scheda.availability_time) || null,
    desired_frequency: assessTxt(scheda.desired_frequency) || null,
    notice: assessTxt(scheda.notice) || null,
    preferred_match_type: assessTxt(scheda.preferred_match_type) || null,
    notes: assessTxt(scheda.notes) || null,
    // 🚨 TUTTI e cinque passano da `numero`, non solo quello che mi era capitato vuoto.
    declared_level: numero(dichiarato),
    calculated_level: numero(livCalc.calculated_level),
    balanced_level: numero(livCalc.balanced_level),
    technical_average: numero(livCalc.technical_average),
    raw_score: numero(livCalc.raw_score),
    consistency_status: livCalc.coherence,
    staff_status: statoStaff,
    raw_response: {
      ...scheda,
      // ⭐ Il sesso ripescato si SCRIVE, non resta solo nel cancello: una riga che dice
      // `gender: ''` mentre la scheda socio dice `F` è un documento che mente su un dato che
      // abbiamo. E chi rilegge la scheda (la segreteria, un domani una cura) deve trovare il
      // valore vero, non doverlo ripescare di nuovo.
      ...(genereRipescato ? { gender: genereRipescato } : {}),
      knowledge: conoscenza,
      experience_flag: pocaEsperienza,
      frequency_flag: pocaFrequenza,
      calculation_note: livCalc.note,
      technical_scores: livCalc.technical_scores,
      corretta_dal_server: true,
    },
  };

  const { error: eIns } = await db
    .from('self_assessments')
    .upsert(riga, { onConflict: 'token' });
  if (eIns) {
    console.error('assessment-quiz: scrittura scheda fallita —', eIns.message, eIns.details ?? '');
    return err(500, 'SCRITTURA_FALLITA', 'Non riesco a salvare la scheda.');
  }

  // Il gettone si brucia DOPO la scrittura: se il salvataggio fallisse, il socio deve poter
  // riprovare. L'ordine inverso lo lascerebbe fuori con la scheda persa.
  await db.from('assessment_tokens')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('token', token);

  /* ═══════════════════════════════════════════════════════════════════════════════════
     🆕⚡⭐⭐ 24/08/2026 — IL GIRO D'APPLICAZIONE PARTE SUBITO, A OGNI SCHEDA CONSEGNATA.

     🗣️ Il difetto misurato su Fabiola Limuti, terza prova: *«non è arrivata nessuna notifica
     sul bot, non gli è stato comunicato il suo livello, non è stato messo il livello dentro
     la scheda»*. **Tre sintomi, una causa sola.**

     📏 La catena, al secondo: `12:48:12` la sorveglianza si accende (la cura di poche ore
     prima funziona), `12:49:28` la scheda arriva — e per due minuti il bot **tace**, con la
     sorveglianza che chiede ogni 15 secondi e non ha niente da dire.
     🎯 A tacere è la porta ② di `siPuoAnnunciareIlTest` nel bot: *a test superato si aspetta
     che il livello sia DAVVERO nella scheda*. Quella porta ha un'uscita — `puo_scegliere` —
     che rompe lo stallo circolare per le prove **con** una scelta da fare. La TERZA prova
     una scelta non ce l'ha (chiude il giro da sé) ⇒ per lei la porta resta **intera**, e il
     bot non può parlare finché il livello non è scritto. Lo scriveva solo il cron dei 15 minuti.
     ⚖️ ⇒ Sulla terza prova la lentezza del cron non era «si perde la fretta, non il fatto»:
     era **silenzio totale**, fino a un quarto d'ora, sull'unica prova che vale da sé.
     📌 E la lacuna era **dichiarata** in `consumer-assessment-decision` («il cron RESTA, ed è
     la rete… e la terza prova, che chiude il giro da sé») — scritta stamattina, creduta
     innocua perché nessuno aveva collegato che di là il bot **tace** aspettando quel livello.
     *Un limite dichiarato in un file non è innocuo finché non lo si guarda dall'altro.*

     ⭐ SI LANCIA A OGNI SCHEDA, non solo alla terza, ed è deliberato: decidere qui «è la
     terza?» vorrebbe dire una **seconda copia della regola del giro** — che vive in
     `giro-del-test.ts` ed è già la regola più delicata di questo lavoro. Si chiama sempre, e
     a decidere se applicare resta `decidi` in `assessment-apply-level`: sulle prove 1 e 2
     non applica niente (aspetta la scelta del socio o le 24 ore), quindi la chiamata in più
     non fa danno — e costa una volta per quiz consegnato, non una per tocco.

     ⭐⭐ SI CHIAMA IL DISPATCHER, NON L'EDGE, per la stessa ragione della decisione: il
     segreto delle routine vive nel **vault**, e `pmo_dispatch_assessment_apply_level` lo
     legge da sé (`SECURITY DEFINER`). È **la stessa identica strada del cron** ⇒ nessuna
     chiave in più in giro, e nessun secondo modo di far partire quel giro.

     🚨 NON SI ASPETTA IL SUO ESITO E NON PUÒ FAR FALLIRE NIENTE: il socio ha appena finito il
     quiz e la sua risposta è già vera. Se il giro non parte, il livello arriva col cron come
     prima — **si perde la fretta, non il fatto** — e l'errore resta nel registro.
     ═══════════════════════════════════════════════════════════════════════════════════ */
  const { error: erroreGiro } = await db.rpc('pmo_dispatch_assessment_apply_level', { p_simula: false });
  if (erroreGiro) {
    console.error(`[assessment-quiz] giro d'applicazione non partito (${erroreGiro.message}) — il livello arriverà col cron`);
  }

  // Al telefono torna l'ESITO, non il come: né le risposte giuste né le soglie.
  // 🆕 25/08 — e, quando le risposte dicono più di quanto il test possa scrivere, la FRASE
  // già scritta. ⭐ Non un flag da interpretare: le parole. È «il gestionale SA, il bot
  // DICE» applicato al test — chi le mostra (la pagina oggi, il bot domani) non deve
  // ricostruire la regola, e due ricostruzioni non possono divergere.
  return ok({
    esito: conoscenza.status,
    staff_status: statoStaff,
    livello: livCalc.calculated_level,
    /* 🚨 SOLO SE LA SCHEDA SI APPLICHERÀ DAVVERO, e il difetto è stato trovato pensando
       alla prova con Laura, non rileggendo il codice. La frase promette «intanto ti
       registriamo Intermedio»: dirla a chi ha fallito il cancello — o a chi finisce in
       segreteria per genere mancante, incoerenza, «dichiara alto e gioca da poco» —
       sarebbe una promessa che nessuno mantiene, e la peggiore delle tre perché
       riguarda proprio chi ha risposto MALE dichiarando ALTO.
       ⭐ `statoStaff` vuoto è esattamente «niente la trattiene»: è la stessa condizione
       che `assessment-apply-level` userà per scriverla. Chiedere qui la stessa cosa che
       decide là è il modo di non avere due verità. */
    certificazione: statoStaff === '' ? certificazioneDelMaestro(livCalc.calculated_level) : null,
  });
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
   🧩⭐⭐ IL MOTORE A PASSI — voce 97, 25/08/2026.

   🗣️ Nasce da una domanda sua: *«forse facendolo con una domanda alla volta potremmo anche
   metterlo dentro Telegram?»*. La risposta è sì, e l'ordine dei due lavori non è indifferente:
   la pagina «una alla volta» e il test dentro il bot vogliono **la stessa cosa nuova**, cioè
   queste due azioni. Farle dopo Telegram avrebbe voluto dire farle due volte.

   🚨 IL BUCO CHE CHIUDE: oggi `pesca` consegna le **quattro domande insieme** e la pagina le
   disegna tutte. Chi fa il test se le legge prima di rispondere alla prima. Un passo per volta
   quel tempo non c'è: la domanda dopo **non esiste ancora** finché non è arrivata la risposta
   a quella prima.

   🔒 LO STATO STA NEL GESTIONALE (`assessment_tokens.progress`), non nel bot e non nel telefono.
   Tre ragioni, e nessuna è di comodo: ① un aggiornamento del bot non deve buttare per terra chi
   è a metà test; ② *il gestionale SA, il bot DICE* — dov'è arrivato un socio è un fatto del
   circolo; ③ la pagina e il bot devono poter guardare **lo stesso** giro, o sarebbero due test.

   ⛔ NIENTE CRONOMETRI. La difesa qui è strutturale (la domanda dopo non è ancora uscita), non
   una soglia di tempo: la fase 2 del cronometro è stata cancellata il 25/08 insieme al tetto,
   perché ciò che difendeva — il guadagno di barare per salire di fascia — non esiste più.
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
async function motoreAPassi(
  db: Db,
  azione: string,
  token: string,
  gettone: Gettone,
  corpo: JsonMap,
): Promise<Response> {
  if (azione !== 'passo' && azione !== 'rispondi') {
    return err(400, 'AZIONE', 'Azione non riconosciuta.');
  }

  const lette = await risposteDelGiro(db, token);
  if (lette.errore) return lette.errore;
  const risposte: Record<string, string> = { ...lette.risposte };
  // 🆕 27/08 sera — una lettura sola per richiesta, passata a tutti i `passoCorrente` di qui
  //    in giù: due letture della stessa cosa sono il posto dove nasce una corsa.
  const viste = await domandeGiaViste(db, gettone);

  if (azione === 'rispondi') {
    const chiave = assessTxt(corpo.chiave);
    const passo = passoCorrente(token, risposte, viste);

    /* 🚨⭐ LA RISPOSTA A UNA DOMANDA GIÀ PASSATA NON SI PRENDE, e non è pignoleria: su Telegram
       i bottoni delle domande vecchie **restano nella chat**, e toccarne uno di ieri è la cosa
       più facile del mondo. Prenderla vorrebbe dire riscrivere in silenzio una risposta già
       data — o, peggio, farlo dopo la consegna.
       ⇒ Si risponde `FUORI_PASSO` **con dentro la domanda giusta**: chi chiama non deve
       indovinare cosa fare, si ridisegna e basta. Un errore che porta con sé la via d'uscita
       costa una riga in più qui e nessun messaggio confuso al socio. */
    if (passo.finito) {
      return err(409, 'GIRO_FINITO', 'Il test è già stato consegnato.');
    }
    /* La domanda in una variabile invece di `passo.domanda` ripetuto: `deno check` non la sa
       restringere attraverso `passo.finito` (arriva da un modulo .js) e ogni uso risulta
       «possibilmente null». ⭐ Il rosso l'ha trovato la CI, che è l'unico posto dove `deno
       check` gira — da qui `jsr.io` è bloccato — ed è il genere di errore che una rilettura
       non vede. */
    const attuale = passo.domanda;
    if (!attuale || !chiave || chiave !== attuale.chiave) {
      return json({
        ok: false, error: 'FUORI_PASSO',
        message: 'Quella domanda è già passata.',
        numero: passo.numero, totale: passo.totale, domanda: attuale,
      }, 409);
    }

    /* Due modi di dire la stessa cosa, e nessuno dei due lascia decidere a chi risponde:
       · `valore` — il testo dell'opzione, che è come risponde la pagina (un `<select>`);
       · `indice` — la posizione del bottone toccato, che è come risponde Telegram.
       ⭐ In tutti e due i casi a scegliere che cosa vuol dire quella risposta è QUESTO lato:
       il testo si riporta a quello canonico della banca, il numero si risolve sull'elenco che
       il server ha appena mandato. Chi risponde non può nominare un'opzione che non esiste. */
    const valore = assessTxt(corpo.valore)
      ? valoreAmmesso(attuale, corpo.valore)
      : valoreDaIndice(attuale, corpo.indice);
    if (!valore) {
      return err(400, 'RISPOSTA_NON_AMMESSA', 'Questa risposta non è fra quelle possibili.');
    }
    risposte[chiave] = valore;

    /* ⏱️ L'APERTURA SI SEGNA ALLA PRIMA RISPOSTA, non alla prima domanda letta.
       È la cura C della voce 84 portata di peso sul motore a passi: là il fatto era `pesca`
       («la pagina si sta facendo dare le domande»), qui è la prima risposta che arriva — cioè
       il momento in cui il socio ha davvero cominciato. Chi apre il bot, legge la prima
       domanda e posa il telefono non ha cominciato niente, e non deve far partire nessun
       cronometro. 🚨 Come là, non fa fallire niente: se non si scrive, l'esito arriva col giro
       lento e si perde la fretta, non il fatto. */
    if (!Object.keys(lette.risposte).length) {
      const { error: eApertura } = await db
        .from('assessment_tokens')
        .update({ opened_at: new Date().toISOString() })
        .eq('token', token);
      if (eApertura) {
        console.error(`[assessment-quiz] apertura non segnata per ${token} (${eApertura.message}) — l'esito arriverà col giro dei 15′`);
      }
    }

    /* 🚨 SI SALVA PRIMA DI RISPONDERE, e l'ordine è deliberato: se la scrittura non riesce, il
       socio deve ricevere un errore e **rispondere di nuovo**, non credere di aver risposto.
       L'ordine inverso perderebbe una risposta in silenzio — e su un test di dodici domande un
       silenzio così si scopre solo alla fine, quando non si sa più quale. */
    const { error: eSalva } = await db
      .from('assessment_tokens')
      .update({ progress: { risposte, aggiornato: new Date().toISOString() } })
      .eq('token', token);
    if (eSalva) {
      console.error('[assessment-quiz] progresso non salvato —', eSalva.message, eSalva.details ?? '');
      return err(500, 'SALVATAGGIO_FALLITO', 'Non riesco a salvare la risposta. Riprova.');
    }
  }

  const dopo = passoCorrente(token, risposte, viste);
  if (!dopo.finito) {
    return ok({ finito: false, numero: dopo.numero, totale: dopo.totale, totale_certo: dopo.totale_certo, domanda: dopo.domanda });
  }

  /* ✅ DODICI SU DODICI: si consegna. È la STESSA consegna della pagina — stessa correzione,
     stesso cancello, stesso livello, stessa frase del maestro — perché è la stessa funzione.
     ⚠️ Sul `passo` (non `rispondi`) ci si arriva solo se il giro era già completo e la
     consegna non era andata a buon fine: rifarla è giusto, `upsert` sul gettone la rende
     idempotente e il gettone bruciato la ferma comunque prima (`GIA_COMPILATA`). */
  const chi = nomeSpezzato(gettone?.member_name);
  return await consegnaScheda(
    db, token, gettone,
    // `as unknown as` e non un cast diretto: per `deno check` le due forme non si sovrappongono
    // abbastanza (a `JsonMap` manca l'indice di stringa). Il contenuto è quello giusto — le
    // stesse chiavi che manda la pagina — ed è ciò che il banco verifica una per una.
    schedaDaRisposte(risposte, chi) as unknown as JsonMap,
    risposteConoscenza(risposte) as Record<string, string>,
  );
}

/** Le risposte già date, lette dal gettone. Un progresso illeggibile vale come «non ha ancora
 *  risposto niente»: meglio far rifare il giro che costruire una scheda su metà dato. */
/* ═══ 🆕🗣️⭐⭐ 27/08/2026 sera — LE DOMANDE CHE QUESTO SOCIO HA GIÀ VISTO ═══════════════════
   🗣️ Da una segnalazione di Maurizio: *«le domande sono sempre le stesse che gli capitano»*.
   Il perché e i numeri stanno in testa a `ordinaPerFreschezza` (`conoscenza.js`): il sorteggio
   è sano, a ripetersi è la banca — e la nostra pescata di mezzogiorno l'aveva peggiorata.

   🚨⭐⭐ IL TAGLIO È `gettone.created_at`, E NON «ADESSO»: la pescata dev'essere ripetibile,
   perché alla consegna il server RIPESCA per correggere. Le schede consegnate **prima che
   questo gettone nascesse** sono un fatto che non cambia più ⇒ l'elenco è identico al primo
   passo, all'ultimo e alla consegna. Con «tutte le sue schede finora» un socio che ne
   consegnasse un'altra a metà test si vedrebbe cambiare le domande sotto le mani.

   🔒 Lo procura il SERVER, mai il telefono: è la stessa ragione per cui gli id della correzione
   si ripescano invece di crederci — chi sceglie le proprie domande sceglie il proprio esito.
   ⚖️ Fallisce APERTO: se la lettura non riesce si torna alla pescata di prima (memoria vuota),
   che è il comportamento di ieri. Un socio senza domande per una query storta sarebbe un danno
   vero; un socio che rivede una domanda è il fastidio che stiamo curando. */
const PROVE_DA_RICORDARE = 8;

async function domandeGiaViste(db: Db, gettone: Gettone): Promise<string[]> {
  const socio = assessTxt(gettone?.member_local_id);
  const nato = assessTxt(gettone?.created_at);
  if (!socio || !nato) return [];
  try {
    const { data: gettoni, error: erroreGettoni } = await db
      .from('assessment_tokens')
      .select('token')
      .eq('member_local_id', socio)
      .limit(60);
    if (erroreGettoni) throw new Error(erroreGettoni.message);
    const suoi = ((gettoni ?? []) as { token: string }[]).map((r) => assessTxt(r.token)).filter(Boolean);
    if (!suoi.length) return [];

    const { data: schede, error: erroreSchede } = await db
      .from('self_assessments')
      .select('submitted_at, raw_response')
      .in('token', suoi)
      .lt('submitted_at', nato)
      .order('submitted_at', { ascending: false })
      .limit(PROVE_DA_RICORDARE);
    if (erroreSchede) throw new Error(erroreSchede.message);

    // ⭐ In ordine: la PIÙ RECENTE per prima. `ordinaPerFreschezza` legge l'indice come «età».
    const viste: string[] = [];
    for (const riga of (schede ?? []) as { raw_response: JsonMap }[]) {
      const domande = ((riga?.raw_response as JsonMap)?.knowledge as JsonMap)?.questions;
      if (!Array.isArray(domande)) continue;
      for (const d of domande as JsonMap[]) {
        const id = assessTxt(d?.id);
        if (id && !viste.includes(id)) viste.push(id);
      }
    }
    return viste;
  } catch (e) {
    console.error(`[assessment-quiz] memoria delle domande non letta (${(e as Error).message}) — si pesca senza`);
    return [];
  }
}

async function risposteDelGiro(db: Db, token: string) {
  const { data, error } = await db
    .from('assessment_tokens')
    .select('progress')
    .eq('token', token)
    .maybeSingle();
  if (error) {
    console.error('[assessment-quiz] lettura progresso fallita —', error.message, error.details ?? '');
    return { errore: err(500, 'LETTURA_FALLITA', 'Non riesco a riprendere il test.'), risposte: {} };
  }
  const grezzo = (data as { progress?: unknown } | null)?.progress as { risposte?: unknown } | null;
  const mappa = (grezzo && typeof grezzo === 'object' ? grezzo.risposte : null) as Record<string, unknown> | null;
  const risposte: Record<string, string> = {};
  if (mappa && typeof mappa === 'object') {
    for (const [k, v] of Object.entries(mappa)) {
      const testo = assessTxt(v);
      if (testo) risposte[k] = testo;
    }
  }
  return { errore: null as Response | null, risposte };
}
