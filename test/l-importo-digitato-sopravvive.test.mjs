/* 💶 «L'importo digitato sopravvive al ridisegno» — banco della voce 163 (05/09/2026).
 *
 * 📏 LA VOCE NASCE DA UNA MISURA, non da un'idea, ed è uscita chiudendone un'altra: nello
 * screenshot della prova della 138, su PROD 6.365, il campo importo era tornato `0,00` mentre la
 * sonda un istante prima ci aveva letto `37,50`. Rimisurato apposta, **senza cliccare niente**:
 * digitato 37,50 → dopo 3 secondi `0,00`, dopo 10 secondi `0,00`.
 *
 * 🔎 A cancellarlo non è il click sul nome (quello la 138 l'ha provato): è il ridisegno della
 * scheda dopo la rilettura del roster — `staffCalRenderPlayersEditor()` fa `box.innerHTML = ''`
 * e rifà i campi dallo stato, e il numero digitato viveva SOLO nel DOM.
 * 📏 Misurato anche il ramo che la console non poteva esercitare per via della rete: eseguendo
 * quel ridisegno **nudo** il valore sparisce lo stesso, e con un roster nuovo torna il numero di
 * Matchpoint (13,00 al posto di 41,00). ⇒ Tutti i rami della rilettura chiamano quella funzione:
 * non è il caso del worker che fallisce, succede sempre.
 *
 * 🚨⭐⭐ LA REGOLA CHE QUESTO BANCO DIFENDE PIÙ DI TUTTE: **un numero non si rimette mai su una
 * riga di cui non si è certi**. Rimettere dei soldi sulla persona sbagliata è la voce 138 un
 * piano più in basso — con la differenza che là si apriva una scheda, qui si incassa da un altro.
 * 📌 *Un numero perso è un fastidio; un numero rimesso sulla persona sbagliata è un danno.*
 *
 * ⛔ QUELLO CHE QUESTO BANCO **NON** DICE: che nella pagina viva il numero si ritrovi davvero.
 * Gira senza browser ⇒ prova le REGOLE. Quello lo dice la console remota su TEST e su PROD.
 *
 * Esegui:  node test/l-importo-digitato-sopravvive.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(QUI, '..', 'index.html'), 'utf8');

let passed = 0, failed = 0;
function test(nome, fn) {
  try { fn(); passed++; console.log('ok   - ' + nome); }
  catch (e) { failed++; console.log('FAIL - ' + nome + '\n       ' + e.message); }
}

/** Le sole righe di CODICE: via i commenti. Una sonda che cerca «questa cosa non deve
 *  comparire» e guarda anche i commenti dà l'allarme proprio a chi ha scritto la difesa. */
function soloCodice(testo) {
  return String(testo).split('\n').filter(r => !/^\s*(\/\/|\*|\/\*)/.test(r)).join('\n');
}

/** Dove finisce `function nome(`: le graffe si contano dal CORPO, non dalla firma. */
function estremiDi(nome) {
  const i = APP.indexOf('function ' + nome + '(');
  assert.ok(i > 0, 'funzione non trovata: ' + nome);
  const apre = APP.indexOf(') {', i);
  assert.ok(apre > i, 'firma inattesa: ' + nome);
  let g = 0, visto = false, k = apre + 2;
  for (; k < APP.length; k++) {
    const c = APP[k];
    if (c === '{') { g++; visto = true; }
    else if (c === '}') { g--; if (visto && g === 0) { k++; break; } }
  }
  return { inizio: i, corpo: apre + 2, fine: k };
}
function dichiarazioneDi(nome) { const e = estremiDi(nome); return APP.slice(e.inizio, e.fine); }
function corpoDi(nome) { const e = estremiDi(nome); return APP.slice(e.corpo, e.fine); }

// Le regole vere dell'app, ESEGUITE — non cercate con una regex.
const chiave = new Function(dichiarazioneDi('_pmoChiaveRigaImporto') + '\nreturn _pmoChiaveRigaImporto;')();
const decidi = new Function(dichiarazioneDi('_pmoImportiDaRimettere') + '\nreturn _pmoImportiDaRimettere;')();

// 🚨 LE RIGHE DI PROVA SONO COPIATE DAI DATI VERI di PROD (partita del 07/09, 19:30, Campo 2),
//    Ospite compreso: è la riga che fa cadere ogni chiave più furba di questa.
const RIGHE = [
  { idCliente: '11',  idx: '0', nome: 'Oriana Canzian' },
  { idCliente: '191', idx: '1', nome: 'Valeria Moschet' },
  { idCliente: '384', idx: '2', nome: 'Francesca Cimetta' },
  { idCliente: '1',   idx: '3', nome: 'Ospite' },
];
const chiaviDi = (righe) => righe.map(chiave);

// ── ① LA CHIAVE DI UNA RIGA ─────────────────────────────────────────────────────────────────
test('due «Ospite» nella stessa partita NON hanno la stessa chiave', () => {
  // 📏 Misurato sulla 138: l'Ospite ha id interno `1`, e ce l'hanno tutti. Una chiave fatta col
  //    solo id li farebbe collassare, e i soldi digitati per uno tornerebbero sull'altro.
  const a = { idCliente: '1', idx: '2', nome: 'Ospite' };
  const b = { idCliente: '1', idx: '3', nome: 'Ospite' };
  assert.notEqual(chiave(a), chiave(b), 'due ospiti hanno la stessa chiave');
});

test('la chiave cambia se cambia la posizione, il nome o l\'id', () => {
  const base = { idCliente: '191', idx: '1', nome: 'Valeria Moschet' };
  assert.notEqual(chiave(base), chiave({ idCliente: '191', idx: '2', nome: 'Valeria Moschet' }));
  assert.notEqual(chiave(base), chiave({ idCliente: '191', idx: '1', nome: 'Valeria Moschetti' }));
  assert.notEqual(chiave(base), chiave({ idCliente: '190', idx: '1', nome: 'Valeria Moschet' }));
});

test('una riga senza id o senza nome non fa cadere la chiave', () => {
  assert.equal(typeof chiave({}), 'string');
  assert.equal(typeof chiave(null), 'string');
  assert.equal(typeof chiave({ idCliente: null, idx: 0, nome: undefined }), 'string');
});

// ── ② LISTA INVARIATA: i numeri si rimettono ────────────────────────────────────────────────
test('la lista è la stessa ⇒ l\'importo digitato torna al suo posto', () => {
  const k = chiaviDi(RIGHE);
  const memoria = { firma: k.join('§'), valori: { [k[1]]: '37,50' } };
  const e = decidi(memoria, k);
  assert.equal(e.persi, false);
  assert.equal(e.rimetti[k[1]], '37,50');
});

test('lo ZERO digitato è un valore, non un\'assenza', () => {
  // La 149 ha già stabilito che uno zero LETTO è un dato. Uno zero DIGITATO pure: è l'omaggio.
  const k = chiaviDi(RIGHE);
  const e = decidi({ firma: k.join('§'), valori: { [k[0]]: '0,00' } }, k);
  assert.equal(e.rimetti[k[0]], '0,00');
});

test('una casella SVUOTATA a mano resta svuotata', () => {
  // Chi cancella un importo lo sta facendo apposta: rimettercelo sarebbe disfare il suo gesto.
  const k = chiaviDi(RIGHE);
  const e = decidi({ firma: k.join('§'), valori: { [k[2]]: '' } }, k);
  assert.equal(e.rimetti[k[2]], '');
});

test('si rimettono TUTTE le caselle toccate, non solo l\'ultima', () => {
  const k = chiaviDi(RIGHE);
  const e = decidi({ firma: k.join('§'), valori: { [k[0]]: '5,00', [k[3]]: '9,50' } }, k);
  assert.equal(e.rimetti[k[0]], '5,00');
  assert.equal(e.rimetti[k[3]], '9,50');
});

// ── ③ LISTA CAMBIATA: non si indovina, e non si tace ────────────────────────────────────────
test('🚨 se un giocatore ESCE dalla lista non si rimette NIENTE, e la perdita si dichiara', () => {
  // È il caso che rende sicura tutta la cura: le posizioni scivolano, e una chiave che «quasi»
  // combacia metterebbe i soldi di uno sulla riga di un altro.
  const kPrima = chiaviDi(RIGHE);
  const memoria = { firma: kPrima.join('§'), valori: { [kPrima[3]]: '37,50' } };
  const dopo = [RIGHE[0], RIGHE[2], RIGHE[3]].map((r, i) => ({ ...r, idx: String(i) }));
  const e = decidi(memoria, chiaviDi(dopo));
  assert.deepEqual(e.rimetti, {}, 'ha rimesso un importo su una lista cambiata');
  assert.equal(e.persi, true, 'la perdita non è stata dichiarata');
  assert.deepEqual(e.valori, {}, 'la memoria non è stata svuotata: rimetterebbe al giro dopo');
});

test('🚨 anche il solo SCAMBIO di due righe è una lista cambiata', () => {
  const k = chiaviDi(RIGHE);
  const memoria = { firma: k.join('§'), valori: { [k[0]]: '37,50' } };
  const scambiate = [RIGHE[1], RIGHE[0], RIGHE[2], RIGHE[3]];
  const e = decidi(memoria, chiaviDi(scambiate));
  assert.equal(e.persi, true);
  assert.deepEqual(e.rimetti, {});
});

test('un valore ricordato per una riga che non c\'è più non finisce su nessuno', () => {
  const k = chiaviDi(RIGHE);
  const sconosciuta = chiave({ idCliente: '999', idx: '9', nome: 'Chi Non C\'è' });
  const e = decidi({ firma: k.join('§'), valori: { [sconosciuta]: '37,50' } }, k);
  assert.equal(e.rimetti[sconosciuta], undefined);
  assert.deepEqual(e.rimetti, {});
});

// ── ④ IL SILENZIO SI DICHIARA SOLO QUANDO C'È DAVVERO UNA PERDITA ───────────────────────────
test('memoria vuota ⇒ nessuna perdita da annunciare', () => {
  // Un avviso che compare quando non si è perso niente è un avviso che si impara a ignorare.
  const k = chiaviDi(RIGHE);
  assert.equal(decidi({ firma: 'qualunque', valori: {} }, k).persi, false);
  assert.equal(decidi(null, k).persi, false);
  assert.equal(decidi(undefined, k).persi, false);
  assert.equal(decidi({}, k).persi, false);
});

test('la firma torna sempre quella di ADESSO, anche quando si perde', () => {
  // Se tornasse la vecchia, il giro dopo la lista sembrerebbe cambiata un'altra volta.
  const k = chiaviDi(RIGHE);
  const e = decidi({ firma: 'vecchia', valori: { x: '1,00' } }, k);
  assert.equal(e.firma, k.join('§'));
  assert.equal(decidi(null, k).firma, k.join('§'));
});

test('una memoria malformata non fa cadere il ridisegno', () => {
  const k = chiaviDi(RIGHE);
  assert.doesNotThrow(() => decidi({ firma: 1, valori: 'non un oggetto' }, k));
  assert.doesNotThrow(() => decidi({ valori: null }, k));
  assert.doesNotThrow(() => decidi({ firma: 'x', valori: { a: '1' } }, null));
});

// ── ⑤ E IL RIDISEGNO DEVE USARE QUESTE REGOLE, non rifarle in casa ──────────────────────────
test('il ridisegno chiama le due funzioni, invece di riscrivere la regola', () => {
  // Una regola copiata in due posti diverge al primo che ne tocca uno solo: è la ragione per cui
  // qui la logica sta fuori dal disegno.
  const corpo = soloCodice(corpoDi('staffCalRenderPlayersEditor'));
  assert.ok(corpo.includes('_pmoImportiDaRimettere('), 'il ridisegno non chiama _pmoImportiDaRimettere');
  assert.ok(corpo.includes('_pmoChiaveRigaImporto('), 'il ridisegno non chiama _pmoChiaveRigaImporto');
});

test('la memoria vive nello STATO della scheda, non nel DOM', () => {
  // È tutta qui la cura: il DOM lo si butta a ogni ridisegno, lo stato no. Ed è lo stesso
  // rimedio che l'app usa già per la nota (`st.note` / `st.origNote`).
  const corpo = soloCodice(corpoDi('staffCalRenderPlayersEditor'));
  assert.ok(/st\.importiDigitati\s*=/.test(corpo), 'la memoria non viene riposta nello stato');
  assert.ok(corpo.includes("addEventListener('input'"), 'nessuno registra quello che viene digitato');
});

test('la perdita viene DETTA, non solo registrata', () => {
  // «Sparisce senza dirlo» è il difetto della voce: curarlo in silenzio sarebbe curarne metà.
  const corpo = soloCodice(corpoDi('staffCalRenderPlayersEditor'));
  // 🩹 La prima stesura cercava il solo nome `st.importiPersi`, e restava VERDE togliendo la
  //    riga che lo ALZA: il nome compariva lo stesso, due righe più in là, dove lo si LEGGE.
  //    📌 *Una sonda che cerca un nome trova anche chi quel nome lo consuma: si cerca il GESTO.*
  assert.ok(/st\.importiPersi\s*=\s*true/.test(corpo), 'nessuno ALZA il segno della perdita');
  assert.ok(/persi\.hidden\s*=/.test(corpo), 'il segno della perdita non governa niente in pagina');
  assert.ok(/cambiata mentre scrivevi/.test(corpo), 'nessun avviso all\'operatore');
});

test('⚠️ (guardia TESTUALE) il ridisegno rimette davvero i valori nelle caselle', () => {
  // 🚨 Questa prova è TESTUALE e va detto: guarda com'è scritto il codice, non cosa fa. Serve
  //    perché il pezzo che rimette il valore vive nel DOM, e un banco senza browser lì non
  //    arriva — infatti, togliendo quelle due righe, tutte le prove qui sopra restavano VERDI:
  //    la funzione decideva benissimo cosa rimettere e poi non lo rimetteva nessuno.
  // ⚖️ Una decisione giusta che non arriva allo schermo è una cura che non esiste, e la prova
  //    vera resta quella con la console remota sulla pagina viva.
  const corpo = soloCodice(corpoDi('staffCalRenderPlayersEditor'));
  assert.ok(/_esito\.rimetti\[/.test(corpo), 'nessuno legge cosa andava rimesso');
  assert.ok(/r\.input\.value\s*=\s*v\b/.test(corpo), 'il valore deciso non finisce nella casella');
});

test('⚠️ (guardia TESTUALE) la firma si prende dal ROSTER, non dalle righe dei soldi', () => {
  // Chi è segnato per la rimozione la riga dei soldi non ce l'ha. Firmando quelle, una ✕ su un
  // giocatore diventerebbe «la lista è cambiata» e butterebbe gli importi scritti sugli ALTRI:
  // una perdita causata da noi, dentro un gesto che con i soldi non c'entra.
  const corpo = soloCodice(corpoDi('staffCalRenderPlayersEditor'));
  assert.ok(/_chiaviOra\s*=\s*function[\s\S]{0,80}st\.roster/.test(corpo),
    'la firma non nasce dal roster: un gesto di rimozione butterebbe gli importi altrui');
});

test('⚠️ (guardia TESTUALE) l\'avviso della perdita si accende dal suo segno', () => {
  const corpo = soloCodice(corpoDi('staffCalRenderPlayersEditor'));
  assert.ok(/persi\.hidden\s*=\s*!st\.importiPersi/.test(corpo),
    'l\'avviso non è legato al segno: può restare spento per sempre');
});

console.log('\n' + passed + ' ok, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
