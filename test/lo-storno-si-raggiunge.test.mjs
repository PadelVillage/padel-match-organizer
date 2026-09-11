/* ↩︎ «Lo storno si raggiunge» — banco della voce 217 (11/09/2026).
 *
 * 🗣️ TROVATA DA LUI guardando l'app: «non c'è la possibilità di fare lo storno né nella sezione
 *    incassi né nella scheda della partita».
 *
 * 🔎 E NON ERA «un bottone mai messo lì», che era il riassunto comodo: il ↩︎ nella scheda della
 *    partita **c'è dal 03/09** (voce 142/181). Era dietro `stato === 'riscosso'` — la conferma del
 *    CIRCOLO — che sul sistema nuovo non arriva mai, perché il circolo non c'è più.
 *
 * 📏 LA MISURA CHE INCHIODA IL DIFETTO, ed è sul codice: due righe sopra il bottone, `isPaid`
 *    accetta DUE fonti (`stato === 'riscosso'` **oppure** `_pagatoDalGestionale`, la cassa
 *    nostra); lo storno ne guardava UNA. ⇒ riga verde «pagato», nessun ↩︎ accanto.
 *
 * 🚨 E PERCHÉ SI VEDEVA SOLO RIAPRENDO: subito dopo l'incasso il roster riceve
 *    `tgt.stato = 'riscosso'` in via ottimistica ⇒ il ↩︎ compare. Alla riapertura il roster si
 *    ricostruisce, `stato` torna `null`, e il bottone sparisce. Un banco che avesse guardato solo
 *    «dopo l'incasso» sarebbe stato verde sul codice malato.
 *
 * ⛔ QUELLO CHE QUESTO BANCO NON DICE: che premendo ↩︎ il denaro torni indietro davvero. Gira
 *    senza browser e senza database. Lo dice la prova fisica sulla pagina viva.
 *
 * Esegui:  node test/lo-storno-si-raggiunge.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(QUI, '..', 'index.html'), 'utf8');
assert.ok(APP.length > 500000, 'sorgente non letto: questo banco non direbbe niente');

let passed = 0, failed = 0;
function test(nome, fn) {
  try { fn(); passed++; console.log('ok   - ' + nome); }
  catch (e) { failed++; console.log('FAIL - ' + nome + '\n       ' + e.message); }
}

/** Solo le righe di CODICE. I commenti di questa cura nominano `nostro`, `riscosso` e
 *  `PMO_CASSA_SOURCE`: senza filtro il banco misurerebbe le proprie spiegazioni, ed è
 *  esattamente il modo in cui l'11/09 due sabotaggi sono passati «verdi». */
function soloCodice(testo) {
  return String(testo).split('\n').filter(function (r) {
    return !/^\s*(\/\/|\*|\/\*)/.test(r);
  }).join('\n');
}
function ritaglia(firma) {
  const i = APP.indexOf(firma);
  assert.ok(i > 0, '«' + firma + '» non c\'è più: questo banco non sa dove guardare');
  let liv = 0, j = APP.indexOf('{', i), fine = -1;
  for (let k = j; k < APP.length; k++) {
    if (APP[k] === '{') liv++;
    else if (APP[k] === '}') { liv--; if (liv === 0) { fine = k + 1; break; } }
  }
  assert.ok(fine > j, 'non sono riuscito a ritagliare «' + firma + '»');
  return soloCodice(APP.slice(i, fine));
}

// ── la riga del cancello, isolata ────────────────────────────────────────────
const RIGA_STORNO = (function () {
  const m = APP.match(/^\s*if \(_payVoidActive && !isGift &&.*$/m);
  assert.ok(m, 'il cancello del ↩︎ nella scheda partita non c\'è più: la voce 217 è tornata');
  return m[0];
})();

test('① IL CANCELLO NON GUARDA PIÙ SOLO MATCHPOINT', () => {
  /* 🚨 Il difetto era esattamente `stato === 'riscosso'` e basta. Una guardia che controllasse
     solo l'esistenza del bottone sarebbe stata verde sul codice malato: il bottone c'era. */
  assert.ok(/_payInfo/.test(RIGA_STORNO),
    'il ↩︎ non consulta l\'archivio del gestionale: su una riga nostra non comparirà mai');
  assert.ok(/\bnostro\b/.test(RIGA_STORNO),
    'il ↩︎ non guarda da quale libro viene la riga: è il difetto della 217, tornato');
});

test('② …MA MATCHPOINT RESTA COM\'ERA: la 142 non è stata allentata', () => {
  /* ⚖️ La conferma del circolo resta richiesta dove un circolo c'è. Toglierla sarebbe stato
     curare la 217 aprendo un buco nella 142 — e sui soldi di terzi. */
  assert.ok(/riscosso/.test(RIGA_STORNO),
    'la conferma del circolo è sparita dal cancello: su Matchpoint lo storno partirebbe su una copia locale');
});

test('③ LA MARCATURA È ESPLICITA, non dedotta dalla forma del dato', () => {
  const src = ritaglia('function _payRigaNostra(');
  assert.ok(/PMO_CASSA_SOURCE\b/.test(src) && /PMO_CASSA_SOURCE_VECCHIA/.test(src),
    '`_payRigaNostra` non confronta più le due sorgenti della cassa nostra');
  assert.ok(!/matchpoint/i.test(src),
    '`_payRigaNostra` nomina Matchpoint: la sorgente nostra si riconosce per quello che È, non per quello che non è');
});

test('④ LE DUE SORGENTI SONO LE STESSE CHE LO STORNO SA TOCCARE', () => {
  /* 📌 Due regole per la stessa domanda divergono il giorno in cui una sola viene corretta: se
     `_pmoCassaStorna` imparasse una terza sorgente e `_payRigaNostra` no, il ↩︎ mancherebbe
     proprio sulle righe che si potevano stornare. */
  const storno = ritaglia('async function _pmoCassaStorna(');
  const nostra = ritaglia('function _payRigaNostra(');
  const usate = (t) => (t.match(/PMO_CASSA_SOURCE(_VECCHIA)?/g) || [])
    .filter((v, i, a) => a.indexOf(v) === i).sort().join(',');
  assert.equal(usate(nostra), usate(storno),
    'il ↩︎ si offre su un insieme di sorgenti DIVERSO da quello che lo storno sa annullare');
});

test('⑤ L\'INDICE SA RICEVERE LA SORGENTE, e il rinfresco gliela dà', () => {
  const add = ritaglia('function _staffCalPaidIndexAdd(');
  assert.match(add, /function _staffCalPaidIndexAdd\(key, name, method, cents, nostro\)/,
    '`_staffCalPaidIndexAdd` non accetta più la sorgente: nessuno può marcare la riga');
  assert.ok(/nostro === true/.test(add),
    'la marcatura non è esplicita: un valore qualunque accenderebbe il ↩︎');
  const refresh = ritaglia('async function _staffCalRefreshPaidIndex(');
  assert.ok(/_payRigaNostra\(p\)/.test(refresh),
    'il rinfresco dal cloud non marca più le righe nostre: alla RIAPERTURA della scheda il ↩︎ sparisce');
});

test('⑥ IL RAMO NATIVO MARCA, QUELLO DI MATCHPOINT NO — e sono due chiamate diverse', () => {
  /* 🚨 È il caso in cui una svista non si vede: passare `true` da tutt'e due i rami avrebbe messo
     il ↩︎ anche sulle righe di Matchpoint, dove non fa niente. */
  const chiamate = (APP.match(/_staffCalPaidIndexAdd\(_payNatKey\([^;]*?\);/g) || []);
  assert.ok(chiamate.length >= 2, 'le chiamate all\'indice dopo un incasso sono sparite');
  const conTrue = chiamate.filter((c) => /,\s*true\)/.test(c)).length;
  const conFalse = chiamate.filter((c) => /,\s*false\)/.test(c)).length;
  assert.equal(conTrue, 1, 'il ramo che marca la riga come nostra non è più esattamente uno');
  assert.equal(conFalse, 1, 'il ramo di Matchpoint non dichiara più `false`: sottintenderlo lo rende invisibile a chi rilegge');
});

test('⑦ LA STRADA DAGLI INCASSI PORTA ANCORA ALLA PARTITA', () => {
  /* 🗣️ Sua scelta del 03/09 — «lo storno si fa sempre nello stesso posto» — e la misura scelse la
     scheda della PARTITA, che copre il 100% delle righe (120 «Ospite» su 250 non hanno scheda
     socio). ⇒ La sezione Incassi non ha un ↩︎ suo: ci porta. Se questa strada si rompesse, la
     metà «né nella sezione incassi» della 217 tornerebbe vera anche a cancello aperto. */
  assert.ok(/onclick="pmoIncassiApriPartita\(/.test(APP),
    'le righe della sezione Incassi non aprono più la partita: lo storno torna irraggiungibile di lì');
  assert.ok(/da lì si incassa e si storna/.test(APP),
    'il tooltip che promette lo storno è sparito, o non promette più');
});

console.log('\n— ' + passed + ' verdi, ' + failed + ' rossi —');
process.exit(failed ? 1 : 0);
