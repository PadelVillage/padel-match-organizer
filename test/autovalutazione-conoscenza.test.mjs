// ── BANCO: «si passa solo dicendo cose giuste» ───────────────────────────────────
//
// Che cosa prova: il cancello di conoscenza dell'autovalutazione. Fino al 9/08/2026 il test
// misurava SOLO autodescrizioni — dichiarato (40%), partite equilibrate (25%), quattro domande
// tecniche su di sé (35%) — e non esisteva una risposta oggettivamente sbagliata: chi sceglieva
// le frasi della fascia alta restava coerente e passava. Da qui le domande di conoscenza, che
// una risposta giusta ce l'hanno.
//
// ⭐ Il blocco NON è ricopiato qui: viene ESTRATTO dal sorgente vero di index.html, fra le due
//    sentinelle ASSESS-KNOWLEDGE SHARED. Se qualcuno cambia le domande o le soglie nell'app,
//    è quella modifica che finisce sul banco — non una copia stantia.
//
// ⛔🚨⭐⭐ 12/08/2026 — TOLTA LA PROVA CHE CONFRONTAVA L'EMULATORE, per decisione sua.
//    Diceva: «il blocco vive in TRE posti — gestionale, emulatore, e in Fase 2 il bot», e teneva
//    le due copie identiche riga per riga. Ma la **Fase 2 è ABBANDONATA dal 22/07** (sua parola:
//    «è abbandonata, non riaprirla»), e l'emulatore PUBBLICATO non ha mai avuto queste domande:
//    misurato il 12/08 sulla pagina online (v0.99, zero occorrenze). Le aveva solo una copia di
//    lavoro mai pubblicata, e questa prova ha prodotto due commit di «riallineamento» che non
//    servivano a nessuno — difendeva una premessa scaduta.
//    ⇒ ⭐⭐ Una prova di parità vale finché ESISTONO due cose che devono restare pari. Quando una
//    delle due muore, la prova non diventa inutile: diventa una FABBRICA DI LAVORO FINTO, e per
//    giunta silenziosa, perché è verde ogni volta che qualcuno le obbedisce.
//    ⚠️ Se un domani il blocco venisse copiato DAVVERO in un secondo posto vivo (il bot), la
//    prova va rimessa — puntando a quello, non all'emulatore.
//
// Uso:  node test/autovalutazione-conoscenza.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const APP = join(QUI, '..', 'index.html');
// 🆕 14/08/2026 — LA BANCA NON STA PIÙ NELL'APP, e questa prova la segue dove è andata.
// Le domande, il pesca e il corregge vivono ora nell'edge `assessment-quiz`: erano dentro
// `index.html`, cioè dentro il file che si scarica per fare il test, risposte comprese.
// ⭐ Restano DUE fonti di verità, non una, e vanno lette da due posti diversi:
//   · la CONOSCENZA (banca, pesca, corregge) → dall'edge, che è l'unico posto che ce l'ha;
//   · la SCALA dei livelli e il RIEPILOGO per lo staff → dall'app, che li usa e li tiene.
// Due contesti separati e non uno solo perché i due blocchi condividono di proposito gli
// aiutini (`assessTxt`, `assessKey`) e la scala: uniti darebbero una ridichiarazione.
const EDGE = join(QUI, '..', 'supabase', 'functions', 'assessment-quiz', 'index.ts');
const APRI = '/* ===== ASSESS-KNOWLEDGE SHARED v1 =====';
const CHIUDI = '/* ===== /ASSESS-KNOWLEDGE SHARED v1 =====';

function estraiBlocco(percorso) {
  const testo = readFileSync(percorso, 'utf8');
  const inizio = testo.indexOf(APRI);
  const fine = testo.indexOf(CHIUDI);
  if (inizio < 0 || fine < 0) throw new Error(`sentinelle ASSESS-KNOWLEDGE non trovate in ${percorso}`);
  return testo.slice(inizio, fine);
}
function esegui(percorso, esporta) {
  const ctx = vm.createContext({});
  vm.runInContext(estraiBlocco(percorso) + `\nthis.API = { ${esporta} };`, ctx);
  return ctx.API;
}

const CONOSCENZA = esegui(EDGE, 'ASSESS_KNOWLEDGE_BANK, assessKnowledgeFasciaFor, assessKnowledgePick, assessKnowledgeEvaluate, assessKnowledgeShuffle, assessKnowledgeRegole, PMO_LIVELLI, pmoLivelloDefinizione');
const SCALA = esegui(APP, 'PMO_LIVELLI, pmoLivelloDefinizione, pmoLivelloEtichettaSocio, pmoLivelloEtichettaStaff, pmoLivelliOpzioni, assessKnowledgeRiepilogo');
// La conoscenza vince sulla scala dove i due blocchi si sovrappongono: è lei la fonte del quiz.
const A = { ...SCALA, ...CONOSCENZA };

let falliti = 0;
function prova(nome, fn) {
  try { fn(); console.log(`✅ ${nome}`); }
  catch (err) { falliti++; console.log(`❌ ${nome}\n   ${err.message}`); }
}
function uguale(visto, atteso, che) {
  const a = JSON.stringify(visto), b = JSON.stringify(atteso);
  if (a !== b) throw new Error(`${che}: visto ${a}, atteso ${b}`);
}
// Risponde a un elenco di domande pescate. `giuste` = quante indovinarne; `sbagliaTrappola`
// decide a parte la sorte della trappola.
//
// 🚨 Gli errori si mettono SOLO sulle domande normali, mai sulla trappola per caso: la pesca
// mescola l'ordine, quindi «sbaglia l'ultima» a volte colpiva la trappola e la stessa prova
// usciva verde o rossa a seconda del sorteggio. Un banco che non torna sempre uguale non dice
// niente su quello che sta provando.
function rispondi(pescate, { giuste = 99, sbagliaTrappola = false } = {}) {
  const risposte = {};
  const normaliDaSbagliare = Math.max(0, pescate.length - giuste - (sbagliaTrappola ? 1 : 0));
  let sbagliate = 0;
  for (const p of pescate) {
    const q = A.ASSESS_KNOWLEDGE_BANK.questions.find(x => x.id === p.id);
    const esatta = q.opts[q.correct];
    const errata = p.opts.find(o => o !== esatta);
    let deveSbagliare;
    if (p.trap) deveSbagliare = sbagliaTrappola;
    else if (sbagliate < normaliDaSbagliare) { deveSbagliare = true; sbagliate++; }
    else deveSbagliare = false;
    risposte[p.id] = deveSbagliare ? errata : esatta;
  }
  return risposte;
}

console.log('\nBANCO — cancello di conoscenza dell\'autovalutazione\n');

// ── La tabella dei livelli ────────────────────────────────────────────────────────
prova('il numero diventa la parola giusta, su tutta la scala', () => {
  uguale(A.pmoLivelloDefinizione(1.0), 'Principiante', '1.0');
  uguale(A.pmoLivelloDefinizione(2.5), 'Base', '2.5');
  uguale(A.pmoLivelloDefinizione(3.5), 'Intermedio', '3.5');
  uguale(A.pmoLivelloDefinizione(4.0), 'Avanzato', '4.0');
  uguale(A.pmoLivelloDefinizione(5.5), 'Agonista', '5.5');
  uguale(A.pmoLivelloDefinizione(6.0), 'Semi-Pro', '6.0');
  uguale(A.pmoLivelloDefinizione(7.0), 'Professionista', '7.0');
});

prova('fuori scala si aggancia agli estremi, non resta senza nome', () => {
  uguale(A.pmoLivelloDefinizione(0.5), 'Principiante', 'minimo della scala');
  uguale(A.pmoLivelloDefinizione(9), 'Professionista', 'oltre il massimo');
  uguale(A.pmoLivelloDefinizione('3,5'), 'Intermedio', 'con la virgola');
  uguale(A.pmoLivelloDefinizione(''), '', 'valore vuoto');
  uguale(A.pmoLivelloDefinizione('boh'), '', 'valore non numerico');
});

prova('al socio le parole, allo staff anche il numero', () => {
  uguale(A.pmoLivelloEtichettaSocio(3.5), 'Intermedio', 'etichetta socio');
  if (/\d/.test(A.pmoLivelloEtichettaSocio(3.5))) throw new Error('al socio è arrivato un numero');
  uguale(A.pmoLivelloEtichettaStaff('3.5'), 'Intermedio (3.5)', 'etichetta staff');
});

prova('le opzioni delle domande valgono l\'estremo alto della fascia', () => {
  const opzioni = A.pmoLivelliOpzioni();
  uguale(opzioni.length, 7, 'quante opzioni');
  uguale(opzioni[2].value, '3.5', 'valore di Intermedio');
  if (!opzioni[2].label.startsWith('Intermedio —')) throw new Error(`etichetta inattesa: ${opzioni[2].label}`);
});

// ── La pesca delle domande ────────────────────────────────────────────────────────
prova('si pescano 3 domande normali e 1 trappola, dalla fascia dichiarata', () => {
  const pescate = A.assessKnowledgePick('Intermedio');
  uguale(pescate.length, 4, 'quante domande');
  uguale(pescate.filter(p => p.trap).length, 1, 'quante trappole');
  if (pescate.some(p => p.fascia !== 'Intermedio')) throw new Error('pescata una domanda di un\'altra fascia');
  if (new Set(pescate.map(p => p.id)).size !== 4) throw new Error('la stessa domanda pescata due volte');
});

prova('chi dichiara Semi-Pro o Professionista non ha quiz: va sempre in segreteria', () => {
  uguale(A.assessKnowledgeFasciaFor(6.0), '', 'Semi-Pro');
  uguale(A.assessKnowledgeFasciaFor(7.0), '', 'Professionista');
  uguale(A.assessKnowledgePick(A.assessKnowledgeFasciaFor(6.5)).length, 0, 'domande per Semi-Pro');
  uguale(A.assessKnowledgeEvaluate([], {}).status, 'skip', 'esito senza domande');
});

prova('la fascia si sceglie dal livello dichiarato, non a caso', () => {
  uguale(A.assessKnowledgeFasciaFor(1.5), 'Principiante', '1.5');
  uguale(A.assessKnowledgeFasciaFor(2.5), 'Base', '2.5');
  uguale(A.assessKnowledgeFasciaFor(4.5), 'Avanzato', '4.5');
  uguale(A.assessKnowledgeFasciaFor(5.0), 'Agonista', '5.0');
});

prova('rifare il test non serve: domande e risposte cambiano ordine', () => {
  const giri = Array.from({ length: 12 }, () => A.assessKnowledgePick('Base'));
  const firme = new Set(giri.map(g => g.map(p => p.id).join('|')));
  if (firme.size < 2) throw new Error('12 giri e sempre le stesse domande nello stesso ordine');
  const ordini = new Set(giri.map(g => g[0].opts.join('|')));
  if (ordini.size < 2) throw new Error('le risposte escono sempre nello stesso ordine');
});

// ── La correzione ─────────────────────────────────────────────────────────────────
prova('l\'onesto che sa le cose passa', () => {
  const pescate = A.assessKnowledgePick('Intermedio');
  const esito = A.assessKnowledgeEvaluate(pescate.map(p => p.id), rispondi(pescate));
  uguale(esito.status, 'pass', 'esito');
  uguale(esito.correct, 4, 'risposte giuste');
  uguale(esito.trap_failed, false, 'trappola');
});

prova('una sbagliata su quattro passa ancora (3/4 è la soglia)', () => {
  const pescate = A.assessKnowledgePick('Avanzato');
  const esito = A.assessKnowledgeEvaluate(pescate.map(p => p.id), rispondi(pescate, { giuste: 3 }));
  uguale(esito.correct, 3, 'risposte giuste');
  uguale(esito.status, 'pass', 'esito');
});

prova('il bugiardo che ne sbaglia due viene fermato', () => {
  const pescate = A.assessKnowledgePick('Avanzato');
  const esito = A.assessKnowledgeEvaluate(pescate.map(p => p.id), rispondi(pescate, { giuste: 2 }));
  uguale(esito.correct, 2, 'risposte giuste');
  uguale(esito.status, 'fail', 'esito');
});

prova('la trappola sbagliata boccia DA SOLA, con le altre tre giuste', () => {
  const pescate = A.assessKnowledgePick('Agonista');
  const esito = A.assessKnowledgeEvaluate(pescate.map(p => p.id), rispondi(pescate, { sbagliaTrappola: true }));
  uguale(esito.correct, 3, 'risposte giuste');
  uguale(esito.trap_failed, true, 'trappola sbagliata');
  uguale(esito.status, 'fail', 'esito: 3 su 4 basterebbero, ma non con la trappola');
});

prova('chi non risponde non passa per silenzio', () => {
  const pescate = A.assessKnowledgePick('Base');
  const esito = A.assessKnowledgeEvaluate(pescate.map(p => p.id), {});
  uguale(esito.correct, 0, 'risposte giuste');
  uguale(esito.status, 'fail', 'esito');
});

prova('si corregge sulla banca, non su quello che arriva dalla pagina', () => {
  const pescate = A.assessKnowledgePick('Intermedio');
  const inventate = {};
  pescate.forEach(p => { inventate[p.id] = 'Questa la decido io ed è giusta'; });
  uguale(A.assessKnowledgeEvaluate(pescate.map(p => p.id), inventate).status, 'fail', 'esito con risposte inventate');
});

prova('spazi e maiuscole non cambiano l\'esito', () => {
  // ⚠️ Fascia con IL CANCELLO, e dal 9/08 non è più un dettaglio: pescava da «Principiante»,
  // che il quiz non ce l'ha più ⇒ zero domande, esito «skip», e questo caso è diventato rosso
  // misurando una cosa che non era la sua. Qui si prova la normalizzazione, non la soglia.
  const pescate = A.assessKnowledgePick('Intermedio');
  const risposte = rispondi(pescate);
  const storte = {};
  Object.entries(risposte).forEach(([id, testo]) => { storte[id] = `  ${testo.toUpperCase()}  `; });
  uguale(A.assessKnowledgeEvaluate(pescate.map(p => p.id), storte, 'Intermedio').status, 'pass', 'esito');
});

// ── 🆕 9/08: il cancello NON è uguale per tutte le fasce (variante «B», sua scelta) ────────
prova('Principiante: nessun cancello, e si passa', () => {
  uguale(A.assessKnowledgePick('Principiante').length, 0, 'domande pescate');
  const esito = A.assessKnowledgeEvaluate([], {}, 'Principiante');
  uguale(esito.status, 'pass', 'esito');
  uguale(esito.senza_cancello, true, 'marchio «senza cancello»');
});

prova('🚨 zero domande NON vuol dire la stessa cosa per Semi-Pro', () => {
  // È la prova che tiene separati i due modi di arrivare senza domande. Se un domani
  // qualcuno facesse tornare «pass» anche qui, una seconda categoria si darebbe il livello
  // da sola senza che nessuno la guardi.
  uguale(A.assessKnowledgeEvaluate([], {}, 'Semi-Pro').status, 'skip', 'esito Semi-Pro');
  uguale(A.assessKnowledgeEvaluate([], {}, '').status, 'skip', 'esito senza fascia');
});

prova('Base: due giuste su quattro bastano', () => {
  const pescate = A.assessKnowledgePick('Base');
  uguale(pescate.length, 4, 'domande pescate');
  const ids = pescate.map(p => p.id);
  uguale(A.assessKnowledgeEvaluate(ids, rispondi(pescate, { giuste: 2 }), 'Base').status, 'pass', 'due giuste');
  uguale(A.assessKnowledgeEvaluate(ids, rispondi(pescate, { giuste: 1 }), 'Base').status, 'fail', 'una giusta');
});

prova('🚨 Base: la trappola sbagliata NON boccia da sola', () => {
  // La trappola smaschera chi si sopravvaluta. Chi dichiara Base e crede a un colpo
  // inventato sta dicendo la verità su di sé, non barando: non è quello il muro.
  const pescate = A.assessKnowledgePick('Base');
  const esito = A.assessKnowledgeEvaluate(
    pescate.map(p => p.id), rispondi(pescate, { giuste: 2, sbagliaTrappola: true }), 'Base');
  uguale(esito.trap_failed, true, 'la trappola risulta sbagliata');
  uguale(esito.status, 'pass', 'ma non boccia');
});

prova('🚨 in alto NON è cambiato niente: la trappola boccia ancora da sola', () => {
  const pescate = A.assessKnowledgePick('Avanzato');
  const esito = A.assessKnowledgeEvaluate(
    pescate.map(p => p.id), rispondi(pescate, { sbagliaTrappola: true }), 'Avanzato');
  uguale(esito.status, 'fail', 'Avanzato con trappola sbagliata');
  uguale(A.assessKnowledgeEvaluate(
    pescate.map(p => p.id), rispondi(pescate, { giuste: 2 }), 'Avanzato').status, 'fail', 'Avanzato con 2/4');
});

prova('🆕 la banca regge TRE tentativi: 8 normali + 3 trappole per fascia interrogabile', () => {
  // 🗣️ Plafond deciso da lui il 9/08: «hai pensato a un plafond di trenta, magari puoi
  // allargare a cinquanta» — perché con la regola dei tre tentativi uno potrebbe segnarsi le
  // domande, ed è difficile segnarsele tutte.
  // ⛔ Principiante è fuori di proposito: da quella fascia il quiz non si pesca più.
  const B = A.ASSESS_KNOWLEDGE_BANK;
  const interrogabili = ['Base', 'Intermedio', 'Avanzato', 'Agonista'];
  for (const fascia of interrogabili) {
    const pool = B.questions.filter(q => q.fascia === fascia);
    const normali = pool.filter(q => !q.trap).length;
    const trappole = pool.filter(q => q.trap).length;
    if (normali < 8) throw new Error(`${fascia}: solo ${normali} domande normali, ne servono 8`);
    if (trappole < 3) throw new Error(`${fascia}: solo ${trappole} trappole, ne servono 3`);
  }
  if (B.questions.length < 50) throw new Error(`banca scesa a ${B.questions.length}: il plafond è 50`);
});

prova('lo staff legge che il cancello non era richiesto', () => {
  const riga = A.assessKnowledgeRiepilogo(A.assessKnowledgeEvaluate([], {}, 'Principiante'));
  if (!riga.includes('non richiesta')) throw new Error(`riepilogo inatteso: ${riga}`);
  if (!riga.includes('Principiante')) throw new Error(`manca la fascia: ${riga}`);
});

// ── Quello che vede lo staff ──────────────────────────────────────────────────────
prova('lo staff legge il riepilogo, le schede vecchie non stampano nulla', () => {
  const pescate = A.assessKnowledgePick('Avanzato');
  const esito = A.assessKnowledgeEvaluate(pescate.map(p => p.id), rispondi(pescate, { sbagliaTrappola: true }));
  const riga = A.assessKnowledgeRiepilogo(esito);
  if (!riga.includes('Conoscenza 3/4')) throw new Error(`riepilogo inatteso: ${riga}`);
  if (!riga.includes('trappola sbagliata')) throw new Error(`manca la trappola: ${riga}`);
  if (!riga.includes('fascia Avanzato')) throw new Error(`manca la fascia: ${riga}`);
  uguale(A.assessKnowledgeRiepilogo(null), '', 'scheda vecchia senza conoscenza');
  uguale(A.assessKnowledgeRiepilogo({ total: 0 }), '', 'esito vuoto');
});

prova('il dettaglio salvato dice domanda, risposta e attesa: la coda deve poter controllare', () => {
  const pescate = A.assessKnowledgePick('Base');
  const esito = A.assessKnowledgeEvaluate(pescate.map(p => p.id), rispondi(pescate, { giuste: 1 }));
  uguale(esito.questions.length, 4, 'quante righe di dettaglio');
  const riga = esito.questions[0];
  ['id', 'domanda', 'risposta', 'attesa', 'giusta', 'trap'].forEach(campo => {
    if (!(campo in riga)) throw new Error(`manca il campo «${campo}» nel dettaglio`);
  });
});

// ── La banca in sé ────────────────────────────────────────────────────────────────
prova('ogni fascia interrogabile ha abbastanza domande per pescarne 3+1', () => {
  const fasce = [...new Set(A.ASSESS_KNOWLEDGE_BANK.questions.map(q => q.fascia))];
  uguale(fasce.length, 5, 'quante fasce interrogabili');
  for (const f of fasce) {
    const normali = A.ASSESS_KNOWLEDGE_BANK.questions.filter(q => q.fascia === f && !q.trap).length;
    const trappole = A.ASSESS_KNOWLEDGE_BANK.questions.filter(q => q.fascia === f && q.trap).length;
    if (normali < A.ASSESS_KNOWLEDGE_BANK.pick_normal) throw new Error(`${f}: solo ${normali} domande normali`);
    if (trappole < A.ASSESS_KNOWLEDGE_BANK.pick_trap) throw new Error(`${f}: solo ${trappole} trappole`);
  }
});

prova('nessuna domanda storta: indice valido, 4 risposte, nessun doppione', () => {
  const visti = new Set();
  for (const q of A.ASSESS_KNOWLEDGE_BANK.questions) {
    if (visti.has(q.id)) throw new Error(`id doppio: ${q.id}`);
    visti.add(q.id);
    if (q.opts.length !== 4) throw new Error(`${q.id}: ${q.opts.length} risposte invece di 4`);
    if (!(q.correct >= 0 && q.correct < q.opts.length)) throw new Error(`${q.id}: indice della risposta giusta fuori posto`);
    if (new Set(q.opts.map(o => o.trim().toLowerCase())).size !== 4) throw new Error(`${q.id}: due risposte uguali`);
    if (!A.PMO_LIVELLI.some(f => f.definizione === q.fascia)) throw new Error(`${q.id}: fascia «${q.fascia}» fuori tabella`);
  }
});

prova('il blocco non tocca l\'app: gira in una scatola vuota', () => {
  // Se qualcuno ci infilasse cleanCell, document o giocatori, questo banco morirebbe qui:
  // è la guardia che tiene le tre copie identiche.
  const solo = vm.createContext({});
  vm.runInContext(estraiBlocco(APP) + '\nthis.ok = pmoLivelloDefinizione(4.0);', solo);
  uguale(solo.ok, 'Avanzato', 'esito nella scatola vuota');
});

prova('la scala dentro l\'edge dell\'email dice le stesse parole', () => {
  // L'edge non può leggere index.html: ha una copia delle 7 righe. Se qualcuno cambia
  // la tabella da una parte sola, l'email racconterebbe un livello diverso da quello
  // che il socio ha letto. Questa prova è l'unico posto dove le due si guardano.
  const EDGE = join(QUI, '..', 'supabase', 'functions', 'assessment-notify-staff', 'index.ts');
  const ts = readFileSync(EDGE, 'utf8');
  const blocco = ts.slice(ts.indexOf('const LIVELLI'), ts.indexOf('function definizione'));
  const coppie = [...blocco.matchAll(/max:\s*([\d.]+),\s*definizione:\s*'([^']+)'/g)]
    .map(m => ({ max: Number(m[1]), definizione: m[2] }));
  uguale(coppie, A.PMO_LIVELLI.map(f => ({ max: f.max, definizione: f.definizione })), 'scala dell\'edge');
});

console.log(`\n— ${falliti ? `${falliti} prove ROSSE` : 'tutte le prove verdi'} —\n`);
process.exit(falliti ? 1 : 0);
