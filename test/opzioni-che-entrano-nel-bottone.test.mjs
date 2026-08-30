// ── BANCO: ogni risposta entra in un bottone Telegram, intera ────────────────────────
//
// 🗣️ Nasce da una sua correzione del 27/08/2026, con la schermata della domanda 9 davanti:
//    *«non vanno bene le doppie risposte, devi ottimizzare le risposte con il bottone»*, e poi
//    *«se non è possibile accorciare le domande puoi pensare ad un'altra soluzione»*.
//    ⇒ Ha scelto lui, davanti alle tre anteprime: **riscrivere le opzioni corte**.
//
// 🚨⭐⭐ LA MISURA CHE HA CAMBIATO LA DIAGNOSI, e senza la quale si curava la cosa sbagliata:
//    quei puntini **non erano di Telegram, erano NOSTRI**. `ETICHETTA_SICURA` valeva **28** —
//    una stima messa apposta bassissima, con margine su margine — e a una risposta di 31
//    caratteri restavano 24. Telegram quella riga la reggeva intera: il confine visto sulle sue
//    schermate sta fra 42 e 43.
//    📌 *Prima di accorciare un testo si guarda CHI lo sta tagliando: se è il proprio codice,
//    la cura non è scrivere più corto — è smettere di tagliare.*
//
// ⚖️ Poi l'accorciatura è servita lo stesso, ed è la sua decisione: **302 opzioni su 720**
//    superavano i 36 caratteri, e con l'elenco sopra il socio leggeva ogni risposta due volte.
//
// 🚨 PERCHÉ ACCORCIARE QUI ERA SICURO, ed è la domanda che si fa prima di toccare un testo:
//    su queste domande il testo **non è il dato in un modo che si possa perdere**. La correzione
//    confronta la risposta ricevuta con `opts[correct]` **della stessa banca**
//    (`assessKnowledgeEvaluate`): le due parti cambiano insieme. Sulle otto domande della
//    scheda invece il punteggio nasce confrontando le parole con una tabella esterna, e infatti
//    là si accorcia con la coppia `[valore, testoBreve]` senza toccare il valore.
//
// ⛔ Quello che NON prova: che una risposta accorciata resti CHIARA per chi legge. Quello si
//    vede solo sul telefono, ed è una prova fisica.
//
// Uso:  node test/opzioni-che-entrano-nel-bottone.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = join(QUI, '..');
const BANCA = readFileSync(join(RADICE, 'supabase/functions/assessment-quiz/conoscenza.js'), 'utf8');
const PASSI = readFileSync(join(RADICE, 'supabase/functions/assessment-quiz/passi.js'), 'utf8');

/* 🔒 Il tetto NON si legge da qui: vive nel bot (`ETICHETTA_SICURA` in
   `src/telegram/test-a-passi.ts`), che è l'unico a sapere come si disegna una schermata.
   Scriverlo qui è una COPIA, e si dichiara tale — la guardia che le tiene insieme non può
   esistere, perché i due repo non si vedono. ⇒ Se un domani il bot alza o abbassa il suo tetto,
   questo numero va mosso a mano, e questo commento è il posto dove qualcuno lo scoprirà. */
const ETICHETTA_SICURA = 36;

let passati = 0, falliti = 0;
function caso(titolo, fn) {
  try { fn(); console.log('✅ ' + titolo); passati++; }
  catch (err) { console.log('❌ ' + titolo + '\n   → ' + (err && err.message || err)); falliti++; }
}
function esigi(condizione, messaggio) { if (!condizione) throw new Error(messaggio); }

// Le domande, lette dal sorgente vero — non da una copia.
const domande = [...BANCA.slice(BANCA.indexOf('questions: [')).matchAll(
  /\{ id:'([^']+)'.*?trap:(true|false),(?:\s*verso:'([a-z]+)',)?\s*q:'((?:[^'\\]|\\.)*)',\s*opts:\s*\[(.*?)\],\s*correct:\s*(\d+)\s*\}/gs
)].map((m) => ({
  id: m[1],
  trap: m[2] === 'true',
  verso: m[3] || '',
  domanda: m[4].replace(/\\'/g, "'"),
  opzioni: [...m[5].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((o) => o[1].replace(/\\'/g, "'")),
  corretta: Number(m[6]),
}));

caso('0. la banca si legge, ed è tutta lì', () => {
  esigi(domande.length === 219, `domande lette: ${domande.length}, attese 219`);   // 🔄 30/08: +27 trabocchetto che AFFERMANO (bilanciamento della banca)
  const opzioni = domande.reduce((n, d) => n + d.opzioni.length, 0);
  esigi(opzioni === 876, `opzioni lette: ${opzioni}, attese 876`);
});

caso('1. 🚨 OGNI opzione entra in un bottone, intera', () => {
  const oltre = domande.flatMap((d) => d.opzioni.filter((o) => o.length > ETICHETTA_SICURA).map((o) => `${d.id}: «${o}» (${o.length})`));
  esigi(oltre.length === 0, `${oltre.length} opzioni oltre ${ETICHETTA_SICURA} caratteri — al socio tornerebbe l'elenco sopra i bottoni:\n     ${oltre.slice(0, 8).join('\n     ')}`);
});

caso('2. ogni domanda ha esattamente QUATTRO opzioni', () => {
  const storte = domande.filter((d) => d.opzioni.length !== 4).map((d) => `${d.id}: ${d.opzioni.length}`);
  esigi(storte.length === 0, storte.join(', '));
});

caso('3. 🚨⭐⭐ dentro una domanda NON ci sono due opzioni uguali', () => {
  /* È la cosa che l'accorciatura poteva rompere, ed è la peggiore: la correzione confronta il
     TESTO ricevuto con quello atteso (`assessKey(risposta) === assessKey(attesa)`). Due opzioni
     che collassano sullo stesso testo rendono la risposta **ambigua**: chi tocca la sbagliata
     risulterebbe aver risposto giusto, o viceversa, e nessuno se ne accorgerebbe mai. */
  const doppie = domande.filter((d) => new Set(d.opzioni.map((o) => o.trim().toLowerCase())).size !== d.opzioni.length)
    .map((d) => `${d.id}: «${d.opzioni.join('» / «')}»`);
  esigi(doppie.length === 0, `opzioni ambigue:\n     ${doppie.join('\n     ')}`);
});

caso('4. l\'indice della risposta giusta punta a un\'opzione che esiste', () => {
  const rotte = domande.filter((d) => !(d.corretta >= 0 && d.corretta < d.opzioni.length)).map((d) => d.id);
  esigi(rotte.length === 0, `correct fuori intervallo: ${rotte.join(', ')}`);
});

caso('5. 🚨 nessuna opzione è rimasta vuota o ridotta a un moncone', () => {
  /* Accorciando si può cancellare troppo: una risposta di tre caratteri non è una risposta.
     ⚠️ Il minimo è 3 e non 8 apposta — «0-1», «Sei» e «Due» sono risposte legittime e complete,
     e una soglia comoda le boccerebbe. Qui si cerca il moncone, non la brevità. */
  const corte = domande.flatMap((d) => d.opzioni.filter((o) => o.trim().length < 3).map((o) => `${d.id}: «${o}»`));
  esigi(corte.length === 0, corte.join(', '));
});

caso('6. 🚨⭐⭐ ogni TRAPPOLA dichiara il suo verso, e la risposta giusta ha quella forma', () => {
  /* 🔄 30/08/2026 — QUESTA GUARDIA HA SOSTITUITO UN CONTEGGIO, e la riga vecchia si corregge
     invece di affiancarsi. Prima diceva: «almeno 42 trappole su 57 negano ancora», con quindici
     eccezioni legittime che nessuno poteva distinguere dagli errori. Era un conto, e un conto
     dice solo che il totale torna.

     ⚖️ Adesso ogni trappola DICHIARA il suo verso (`nega` / `afferma`) e la guardia controlla
     che la forma della risposta giusta corrisponda alla dichiarazione. È più forte in tutte e
     due le direzioni: prende la trappola che perde la negazione accorciando (era il difetto
     originale) E la trappola marcata male, che il conteggio non poteva vedere.

     🚨 PERCHÉ IL VERSO ESISTE: dei 57 trabocchetto di prima, 44 si passavano NEGANDO — chi
     rispondeva «non esiste» a tutti e tre e sapeva le due domande normali passava il quiz nel
     76-96% dei casi secondo la fascia, contro il 50% di chi tirava a caso. La cura è il
     bilanciamento della banca, e senza un campo esplicito il bilanciamento non è controllabile:
     lo si dovrebbe dedurre dal testo a ogni giro, cioè indovinare.

     📌 *Una proprietà che si deduce dal testo si può solo stimare; una dichiarata si può
     verificare — e una dichiarazione che nessuno verifica è una promessa.* */
  const NEGA = /(^|[^a-zà-ù])(non|no|mai|nessun\w*)([^a-zà-ù]|$)/i;
  const trappole = domande.filter((d) => d.trap);
  esigi(trappole.length === 84, `trappole: ${trappole.length}, attese 84`);

  const senzaVerso = trappole.filter((d) => d.verso !== 'nega' && d.verso !== 'afferma');
  esigi(senzaVerso.length === 0,
    `trappole senza un verso valido: ${senzaVerso.map((d) => `${d.id} («${d.verso}»)`).join(', ')}`);

  const storte = trappole.filter((d) => NEGA.test(d.opzioni[d.corretta]) !== (d.verso === 'nega'));
  esigi(storte.length === 0,
    `${storte.length} trappole in cui il verso dichiarato e la forma della risposta giusta non ` +
    `combaciano — o la negazione si è persa accorciando, o il verso è marcato male:\n     ` +
    storte.map((d) => `${d.id} [${d.verso}]: «${d.opzioni[d.corretta]}»`).join('\n     '));
});

caso('7. 🚨 CABLAGGIO: anche le OTTO domande della scheda entrano nel bottone', () => {
  /* La banca del regolamento non è l'unica cosa che finisce su un bottone: le prime otto
     arrivano da `passi.js`. Guardarne una sola metà è il modo classico di dichiarare curata
     una cosa curata a metà. */
  const testi = [...PASSI.matchAll(/\[\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*\]/g)].map((m) => m[2].replace(/\\'/g, "'"));
  esigi(testi.length > 0, 'in passi.js non si trova più nessuna coppia [valore, testoBreve]');
  const oltre = testi.filter((t) => t.length > ETICHETTA_SICURA);
  esigi(oltre.length === 0, `etichette brevi che non entrano: «${oltre.join('», «')}»`);
});

caso('8. 🚨 e le sette parole dei LIVELLI, prefisso della domanda 4 compreso', () => {
  const blocco = PASSI.slice(PASSI.indexOf('const PLURALE_LIVELLO = {'), PASSI.indexOf('function etichettaPlurale'));
  esigi(blocco.length > 0, 'la tabella dei plurali non c\'è più: la domanda 4 tornerebbe uguale alla 3');
  const plurali = [...blocco.matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]);
  esigi(plurali.length === 7, `plurali trovati: ${plurali.length}, attesi 7`);
  const oltre = plurali.filter((t) => ('Contro ' + t).length > ETICHETTA_SICURA);
  esigi(oltre.length === 0, `«Contro ${oltre.join('», «Contro ')}» non entra nel bottone`);
});

console.log(`\n— ${passati} passati, ${falliti} falliti su ${passati + falliti} casi —`);
process.exit(falliti ? 1 : 0);
