/* 💶 «Zero non è "non lo so"» — banco della voce 149, applicato alla CASELLA DELL'IMPORTO.
 *
 * 🗣️ LA VOCE È SUA, dal cellulare il 04/09: «ho aperto la scheda della partita ma gli importi sono
 *    a zero» — mentre su Matchpoint quella partita porta 8,00 e 10,00.
 *
 * 🚨⭐⭐ È LA TERZA VOLTA CHE QUESTO PROGETTO SCRIVE QUESTA REGOLA:
 *    · voce 114 — il calendario oltre i 30 giorni diceva «Libero» invece di «non lo so»;
 *    · voce 139 — il saldo Wallet: `null` ⇒ `👛 —`, MAI `0,00 €`, perché «non ha credito» e
 *      «non l'ho letto» mandano chi fa cassa in due direzioni opposte;
 *    · e questa casella, che nessuna delle due ha guardato.
 *    📌 Una regola applicata dove ci si è ricordati non è una regola: è un'abitudine, e le
 *       abitudini hanno buchi. Questo banco esiste perché il quarto buco si rompa da solo.
 *
 * ⚖️ IL DANNO, che non è estetico: gli importi non stanno nella copia locale (il roster della 142
 *    porta i NOMI; importo e stato arrivano dalla rilettura del worker). Finché quella non atterra
 *    `importoCents` è `null` — e disegnarlo `0,00` dice a chi fa cassa la sera «non deve niente».
 *    🚨 E la 142 ha reso il difetto PEGGIORE senza toccarlo: prima la rotellina copriva tutto e non
 *    si vedeva nessun numero; da quando la scheda si apre subito, al posto del velo onesto c'è uno
 *    ZERO FALSO. È il rischio che la 142 aveva previsto per i nomi e non per i soldi.
 *
 * ⛔ QUELLO CHE QUESTO BANCO NON DICE: gira senza browser ⇒ prova le regole, non che sullo schermo
 *    si veda il trattino. Quello lo dice il suo occhio su una scheda vera.
 *
 * Esegui:  node test/zero-non-e-non-lo-so-importo.test.mjs
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

function soloCodice(testo) {
  return String(testo).split('\n').filter(function (r) {
    return !/^\s*(\/\/|\*|\/\*)/.test(r);
  }).join('\n');
}

/** Il pezzo che disegna la casella €.
 *  🩹 Ancorato a `} else if (payRow) {`, che è l'INIZIO del ramo — non a `_importoIgnoto`, che è
 *  ciò che si vuole misurare: una sonda che parte da ciò che cerca lo trova sempre. */
function ramoCasella() {
  const i = APP.indexOf('} else if (payRow) {');
  assert.ok(i > 0, 'il ramo della casella € non c\'è più: questo banco non sa dove guardare');
  return APP.slice(i, i + 4200);
}

/** Dove finisce `function nome(`: l'indice DOPO la sua graffa di chiusura. */
function dichiarazioneDi(nome) {
  const i = APP.indexOf('function ' + nome + '(');
  assert.ok(i > 0, 'funzione non trovata: ' + nome);
  const apre = APP.indexOf(') {', i);
  let g = 0, visto = false, k = apre + 2;
  for (; k < APP.length; k++) {
    const c = APP[k];
    if (c === '{') { g++; visto = true; }
    else if (c === '}') { g--; if (visto && g === 0) { k++; break; } }
  }
  return APP.slice(i, k);
}

/* 🩹⭐⭐ LA REGOLA SI ESTRAE DAL SORGENTE E SI ESEGUE — e la prima stesura di questo banco la
 * RISCRIVEVA qui dentro, copiando le tre righe dell'app.
 * 📏 Misurato: sabotando l'app in tre modi diversi (0,00 sul non letto · anche lo zero letto
 * diventa «non lo so» · `baseCents` di nuovo a 0) il banco restava **VERDE tutte e tre le volte**.
 * ⚖️ Una copia della regola è peggio di una rilettura, perché ha la FORMA di un'esecuzione: si
 * legge come una prova e non prova niente. È la ragione per cui l'app ha ora una funzione pura
 * (`_pmoImportoCasella`) invece di tre righe in mezzo al disegno — così qui non c'è niente da
 * ricopiare.
 * 📌 *Un banco che esegue una copia della regola prova che la copia funziona.* */
const casella = new Function(dichiarazioneDi('_pmoImportoCasella') + '\nreturn _pmoImportoCasella;')();
function valoreCasella(importoCents, pendenteCents) { return casella(importoCents, pendenteCents); }

test('① 🚨 NON LETTO ⇒ CASELLA VUOTA, mai «0,00»', () => {
  const r = valoreCasella(null, null);
  assert.equal(r.ignoto, true);
  assert.equal(r.valore, '', 'un importo non letto viene scritto come un numero: dice «non deve niente»');
  assert.equal(r.baseCents, null, 'il «da» viene inventato a 0: nessuno l\'ha letto');
});

test('② ⛔ E LO ZERO VERO RESTA ZERO — è l\'altra metà, e senza di lei la cura è un danno', () => {
  /* ⚖️ Un omaggio è un importo LETTO che vale 0. Se anche quello diventasse «—», si perderebbe
     l'informazione opposta: chi guarda non saprebbe più distinguere «gratis» da «non lo so».
     📌 Curare «zero non è non lo so» cancellando lo zero è la stessa malattia al rovescio. */
  const r = valoreCasella(0, null);
  assert.equal(r.ignoto, false, 'uno zero LETTO viene scambiato per un dato mancante');
  assert.equal(r.valore, '0,00');
  assert.equal(r.baseCents, 0, 'lo zero letto perde il suo «da»: un omaggio portato a 9 direbbe «(non letto)»');
});

test('③ I CASI NORMALI non si muovono', () => {
  assert.equal(valoreCasella(800, null).valore, '8,00');
  assert.equal(valoreCasella(800, null).baseCents, 800);
  // Il pendente vince sull'importo quando c'è un parziale da riscuotere.
  assert.equal(valoreCasella(1000, 400).valore, '4,00');
  assert.equal(valoreCasella(1000, 400).baseCents, 400);
  // Pendente a 0 (tutto riscosso) ⇒ si ricade sull'importo, che è letto.
  assert.equal(valoreCasella(1000, 0).ignoto, false);
});

test('④ 🚨 IL SEGNAPOSTO C\'È, e la casella NON è disabilitata', () => {
  /* ⛔ Disabilitarla toglierebbe la possibilità di correggere l'importo proprio quando il worker
     non risponde, cioè nel caso in cui serve di più. Non mentire non deve costare una funzione. */
  const src = soloCodice(ramoCasella());
  assert.match(src, /amt\.placeholder = '—'/, 'manca il segnaposto: una casella vuota senza «—» sembra un campo da riempire');
  assert.match(src, /amt\.disabled = !_payCollectActive;/,
    'la casella viene disabilitata sul dato mancante: si perde la correzione proprio quando serve');
  assert.ok(!/_importoIgnoto[\s\S]{0,80}amt\.disabled = true/.test(src),
    'la casella viene disabilitata quando l\'importo è ignoto');
});

test('⑤ 🚨🚨 IL «DA» NON SI INVENTA — né nel riepilogo né nella CONFERMA del denaro', () => {
  /* 🚨 La conferma è il punto in cui una persona autorizza del denaro: «0,00 → 9,00» le farebbe
     credere che quel giocatore non dovesse niente. È la bugia più cara di tutta questa voce. */
  const i = APP.indexOf("parts.push('Importo ' + c.nome");
  assert.ok(i > 0, 'la riga della conferma non c\'è più');
  const conferma = APP.slice(i, i + 400);
  assert.match(conferma, /c\.daCents == null \? '\(non letto\) → '/,
    'la conferma stampa un «da» che nessuno ha letto: chi autorizza il denaro legge il falso');

  const j = APP.indexOf('const _riga = function (c) {');
  assert.ok(j > 0, 'la riga del riepilogo non c\'è più');
  const riepilogo = APP.slice(j, j + 400);
  assert.match(riepilogo, /c\.daCents == null \? '→ '/, 'il riepilogo inventa il «da»');
});

test('⑥ ⛔ E LA REGOLA VALE ANCHE PER IL WALLET — la 139 non dev\'essere tornata indietro', () => {
  /* 📌 Le due righe si tengono: questa voce nasce dal fatto che la 139 aveva curato UN posto solo.
     Se un domani qualcuno «semplificasse» il wallet rimettendoci uno 0,00, il buco tornerebbe da
     lì — quindi il banco della 149 guarda anche quello. */
  const i = APP.indexOf('function _pmoWalletPastiglia(');
  assert.ok(i > 0, 'la pastiglia del wallet non c\'è più');
  const src = APP.slice(i, i + 500);
  assert.match(src, /testo: '—'/, 'il saldo wallet non letto è tornato a essere un numero');
  assert.match(src, /ignoto: true/, 'il wallet non distingue più «non letto» da «zero»');
});

console.log('\n' + passed + ' passati, ' + failed + ' falliti');
process.exit(failed ? 1 : 0);
