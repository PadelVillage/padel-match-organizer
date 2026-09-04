/* 🪟 «La scheda si apre piena» — banco della voce 142, primo passo (04/09/2026).
 *
 * 🗣️ SUA SEGNALAZIONE, provando dal cellulare la sera stessa del restyling:
 *   «Continua a esserci la rotellina che pensa e mi dice "leggo i giocatori da Matchpoint":
 *    questo non dovrebbe più esistere. Si dovrebbe aprire la scheda con già i giocatori
 *    visibili.»
 *
 * 📏 E LA MISURA che ha cambiato la cura, presa sui record veri di PROD prima di toccare una
 *    riga: dei roster salvati in `staff_booking`, **173 sono elenchi di OGGETTI** e **67 sono
 *    elenchi di STRINGHE** (il sync scrive i nomi, il worker scrive gli oggetti).
 *    ⇒ Non era una cosa sola. Per i 173 i nomi c'erano e la rotellina li COPRIVA; per i 67
 *    `_normRoster` li BUTTAVA VIA (`p.nome` è `undefined` su una stringa) e sotto la rotellina
 *    non c'era niente. Togliere solo il velo avrebbe curato due terzi del difetto e lasciato
 *    l'altro terzo con una sezione vuota — peggio della rotellina, perché sembra una risposta.
 *
 * 🎯 LE CINQUE COSE CHE QUESTO BANCO DIFENDE:
 *   ① `_normRoster` tiene le stringhe (i 67) e continua a tenere gli oggetti (i 173);
 *   ② il velo `rosterLoading` si alza SOLO quando non c'è niente da mostrare — non è più
 *      «ha giocatori» secco, o la rotellina torna identica al primo che ricopia la riga;
 *   ③ stato del pagamento sconosciuto ⇒ NON la ✗ rossa «da incassare». Con la scheda aperta
 *      subito quel caso capita a ogni apertura, e chi fa cassa andrebbe a chiedere soldi già
 *      pagati: fra un sì e un no inventati si risponde «non lo so»;
 *   ④ `rosterRefreshing` si spegne in OGNI uscita della lettura (successo, esito storto,
 *      errore): un indicatore che non si spegne è una rotellina che torna dalla finestra;
 *   ⑤ 🚨 la rimozione manda al worker il **nome**, mai la posizione. È il fatto su cui poggia
 *      tutta la scelta di mostrare un elenco che può essere vecchio di due minuti: se un
 *      giorno diventasse per indice, l'elenco stantio sposterebbe la mira e questa cura
 *      diventerebbe pericolosa. Questa guardia è il freno di quella, non un dettaglio.
 *
 * ⛔ QUELLO CHE NON DICE: gira senza browser ⇒ dice che il codice è quello giusto, non che la
 *    scheda si VEDA aprirsi piena. Quello lo dice il suo dito.
 *
 * Esegui:  node test/la-scheda-si-apre-piena.test.mjs
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

/** Le sole righe di CODICE: via i commenti. Una guardia deve rompersi su ciò che è sbagliato,
 *  non su ciò che ne PARLA — e qui sopra i commenti nominano tutto ciò che è stato tolto. */
function soloCodice(testo) {
  return String(testo).split('\n').filter((r) => !/^\s*(\/\/|\*|\/\*)/.test(r)).join('\n');
}

/** Il corpo di `const nome = function (`, dalla graffa d'apertura alla sua chiusa. */
function corpoDiEspressione(nome) {
  const i = APP.indexOf('const ' + nome + ' = function (');
  assert.ok(i > 0, 'funzione non trovata: ' + nome);
  const apre = APP.indexOf('{', APP.indexOf(') {', i));
  let g = 0, visto = false, out = '';
  for (let k = apre; k < APP.length; k++) {
    const c = APP[k];
    out += c;
    if (c === '{') { g++; visto = true; }
    else if (c === '}') { g--; if (visto && g === 0) break; }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// ① _normRoster: le stringhe sopravvivono, gli oggetti pure. Eseguita davvero, non letta:
//    una sonda testuale direbbe che la riga c'è, non che fa la cosa giusta.
// ─────────────────────────────────────────────────────────────────────────────
const normRoster = new Function('return function ' + corpoDiEspressione('_normRoster').replace(/^\{/, '(arr) {'))();

test('① le voci STRINGA diventano nomi (i 67 record che prima uscivano vuoti)', () => {
  const out = normRoster(['Mario Rossi', 'Anna Verdi']);
  assert.equal(out.length, 2, 'un roster di stringhe non deve più svuotarsi');
  assert.equal(out[0].nome, 'Mario Rossi');
  assert.equal(out[1].nome, 'Anna Verdi');
  assert.equal(out[0].idx, 0, 'senza idx la scheda non sa più chi ha segnato per la rimozione');
  assert.equal(out[1].idx, 1);
});

test('① le stringhe vuote o di soli spazi restano fuori', () => {
  assert.equal(normRoster(['', '   ', 'Vera Persona']).length, 1);
});

test('① gli OGGETTI continuano a passare come prima (i 173)', () => {
  const out = normRoster([{ nome: 'Luca Bianchi', codiceCliente: '123' }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].nome, 'Luca Bianchi');
  assert.equal(out[0].codiceCliente, '123', 'i campi dell\'oggetto non si perdono per strada');
});

test('① l\'Ospite senza nome resta riconosciuto (regola vecchia, non travolta)', () => {
  const out = normRoster([{ nome: '', idCliente: '000001' }]);
  assert.equal(out.length, 1, 'l\'Ospite non deve sparire dal conteggio');
  assert.equal(out[0].nome, 'Ospite');
  assert.equal(out[0].ospite, true);
});

test('① una voce nulla o senza nome resta scartata', () => {
  assert.equal(normRoster([null, undefined, { codice: '9' }]).length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// ② il velo si alza solo quando non c'è niente sotto
// ─────────────────────────────────────────────────────────────────────────────
test('② rosterLoading guarda il ROSTER, non solo «ha giocatori»', () => {
  const riga = soloCodice(APP).split('\n').find((r) => /rosterLoading\s*:/.test(r));
  assert.ok(riga, 'la riga rosterLoading non c\'è più: la scheda ha cambiato forma');
  assert.ok(/roster/.test(riga.replace(/rosterLoading/g, '')),
    'rosterLoading è tornato a dipendere solo da hasPlayers ⇒ la rotellina copre di nuovo i nomi che abbiamo già');
  assert.ok(/length/.test(riga),
    'il velo deve cadere quando il roster locale ha almeno un nome: senza la lunghezza non lo sa');
});

test('② il velo resta per il caso vero: nessun nome in locale', () => {
  const riga = soloCodice(APP).split('\n').find((r) => /rosterLoading\s*:/.test(r));
  assert.ok(/hasPlayers/.test(riga),
    'il velo deve valere solo dove ci sono giocatori: su manutenzione e slot liberi non c\'entra');
  assert.ok(/!\s*\(/.test(riga) || /=== 0/.test(riga),
    'senza negazione la condizione dice il contrario di quel che serve');
});

// ─────────────────────────────────────────────────────────────────────────────
// ③ tre segni, non due: «non lo so» non è «da incassare»
// ─────────────────────────────────────────────────────────────────────────────
test('③ stato sconosciuto NON prende l\'icona rossa del dovuto', () => {
  const i = APP.indexOf("ic.className = 'ti ' +");
  assert.ok(i > 0, 'la riga dell\'icona di stato non c\'è più');
  const blocco = APP.slice(i, APP.indexOf(';', APP.indexOf('svc-pl-ic-due', i)));
  const espr = blocco.replace(/^ic\.className\s*=\s*/, '');
  const calcola = (isGift, isPaid, statoIgnoto) =>
    new Function('isGift', 'isPaid', '_statoIgnoto', 'return ' + espr)(isGift, isPaid, statoIgnoto);
  assert.match(calcola(false, false, true), /svc-pl-ic-unknown/,
    'con lo stato ancora ignoto l\'icona deve dire «non lo so», non «da incassare»');
  assert.doesNotMatch(calcola(false, false, true), /svc-pl-ic-due/,
    'la ✗ rossa su uno stato non letto manda a chiedere soldi già pagati');
  assert.match(calcola(false, false, false), /svc-pl-ic-due/, 'il dovuto VERO resta rosso');
  assert.match(calcola(false, true, false), /svc-pl-ic-paid/, 'il pagato resta verde');
  assert.match(calcola(true, false, false), /svc-pl-ic-gift/, 'l\'offerta resta il regalo');
});

test('③ il segno «non lo so» ha un colore suo nel CSS, spento e non allarmante', () => {
  assert.ok(/\.svc-pl-ic-unknown\s*\{[^}]*color:\s*var\(--text-muted/.test(APP),
    'senza la regola CSS l\'icona eredita il colore del testo e si confonde col dovuto');
});

test('③ e si spiega: un segno che nessuno sa leggere non è un segno', () => {
  const i = APP.indexOf('const _statoIgnoto');
  assert.ok(i > 0, 'il terzo caso è sparito');
  const blocco = APP.slice(i, i + 1400);
  assert.ok(/aria-label/.test(blocco) && /title/.test(blocco),
    'al cerchio tratteggiato servono l\'etichetta per lo screen reader e il tooltip per il mouse');
});

// ─────────────────────────────────────────────────────────────────────────────
// ④ l'indicatore di rilettura si spegne SEMPRE
// ─────────────────────────────────────────────────────────────────────────────
test('④ rosterRefreshing si accende in stato e si spegne in ogni uscita', () => {
  const codice = soloCodice(APP);
  assert.ok(/rosterRefreshing\s*:/.test(codice), 'il flag non nasce più con la scheda');
  const spegnimenti = (codice.match(/rosterRefreshing\s*=\s*false/g) || []).length;
  assert.ok(spegnimenti >= 2,
    'la lettura ha due uscite — quella normale e il catch: trovati ' + spegnimenti + ' spegnimenti, '
    + 'e quello che manca è una rotellina che gira per sempre');
});

test('④ l\'indicatore vive nell\'intestazione della sezione, non al posto della lista', () => {
  const i = APP.indexOf('if (st.rosterRefreshing) {');
  assert.ok(i > 0, 'l\'indicatore discreto non c\'è');
  const blocco = APP.slice(i, i + 900);
  assert.ok(/svc-edit-section-head/.test(blocco),
    'deve agganciarsi al titolo della sezione: dentro il corpo tornerebbe a prendere il posto dei nomi');
  assert.doesNotMatch(blocco, /innerHTML\s*=\s*''/,
    'non deve svuotare niente: questa è la differenza con la rotellina di prima');
});

// ─────────────────────────────────────────────────────────────────────────────
// ⑤ il freno: si rimuove per NOME
// ─────────────────────────────────────────────────────────────────────────────
test('⑤ la rimozione manda al worker i NOMI, mai gli indici', () => {
  const i = APP.indexOf('const remove = st.hasPlayers');
  assert.ok(i > 0, 'la riga che costruisce la lista da rimuovere non c\'è più');
  const riga = APP.slice(i, APP.indexOf('\n', i));
  assert.ok(/return p\.nome/.test(riga),
    '🚨 la rimozione non manda più il nome. Un elenco locale può essere vecchio di due minuti: '
    + 'per posizione toglierebbe la persona sbagliata, ed è l\'unica cosa che rendeva sicuro '
    + 'aprire la scheda senza aspettare Matchpoint');
});

console.log('\n' + passed + ' passate, ' + failed + ' fallite');
process.exit(failed ? 1 : 0);
