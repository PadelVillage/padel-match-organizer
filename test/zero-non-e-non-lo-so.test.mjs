/* 👛 «Zero non è "non lo so"» — banco della voce 139 (03/09/2026).
 *
 * 🗣️ LA VOCE È SUA: «mi sono ricordato che non c'è accanto all'importo, dentro la scheda della
 * partita o della lezione, se un giocatore ha dei soldi nel borsellino» — e prima: «un colpo
 * d'occhio molto carino per chi fa segreteria e cassa la sera».
 *
 * 📏 IL FATTO CHE LA RENDE CORTA: `saldoCents` arriva GIÀ su ogni riga del roster, letto dalla
 * ficha Matchpoint (`server.mjs:7818`) nello stesso giro dei giocatori. L'app lo usava per una
 * cosa sola — accendere il bottone Wallet — e poi lo buttava via. Non costa una chiamata in più:
 * costa smettere di buttarlo.
 *
 * 🚨 E IL PUNTO CHE QUESTO BANCO PROTEGGE, che è l'unico in cui la voce può fare danno:
 *     `saldoCents === null` NON è `saldoCents === 0`.
 * Lo zero si DICHIARA (`0,00 €`, sua decisione: «non ha credito» è un'informazione, e chi fa
 * cassa la sera la usa). Ma il `null` del worker vuol dire «non l'ho letto» — cella assente o
 * lettura scaduta a 1500ms — e scriverci `0,00 €` direbbe «non ha credito» mentre la verità è
 * «non lo so»: chi fa cassa può rinunciare a un Wallet che invece funzionava, o mandare a pagare
 * in contanti chi il credito ce l'aveva.
 * 📌 *È lo stesso bivio della voce 114 («Libero» invece di «non lo so»), già sbagliato due volte.*
 *
 * ⚖️ IL COMMITTENTE È ANDATO A GUARDARE SU MATCHPOINT e ha misurato che sullo zero «lui ci scrive
 * 0,00». Vero — ma sulla SCHEDA CLIENTE (`#CC_Cabecera_LabelSaldo_Actual`, «Portafoglio: X,XX €»),
 * che è un'ALTRA pagina rispetto alla colonna dentro la ficha della partita da cui viene il saldo
 * della riga. ⇒ Quel fatto non elimina il caso «non l'ho letto», e la distinzione resta.
 *
 * ⛔ QUELLO CHE QUESTO BANCO **NON** DICE: gira senza browser ⇒ esegue la REGOLA, non il render.
 * Che la pastiglia si veda, e che si veda abbastanza da essere un colpo d'occhio, lo dice solo
 * il suo occhio sulla scheda vera — ed è la prova fisica che manca per chiudere la voce.
 *
 * Esegui:  node test/zero-non-e-non-lo-so.test.mjs
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

/** Ritaglia il corpo di `function nome(` contando le graffe. */
function corpoDi(nome) {
  const i = APP.indexOf('function ' + nome + '(');
  assert.ok(i > 0, 'funzione non trovata: ' + nome);
  let g = 0, visto = false, out = '';
  for (let k = i; k < APP.length; k++) {
    const c = APP[k];
    out += c;
    if (c === '{') { g++; visto = true; }
    else if (c === '}') { g--; if (visto && g === 0) break; }
  }
  return out;
}

// 🩹 La regola si ESEGUE, non si cerca con una regex: un banco che grepasse «non disponibile»
//    resterebbe verde anche se domani quel ramo diventasse irraggiungibile.
//    `_pmoWalletPastiglia` chiama `_incassiEuro`, quindi le si portano dentro tutt'e due.
const pastiglia = new Function(
  corpoDi('_incassiEuro') + '\n' + corpoDi('_pmoWalletPastiglia') + '\nreturn _pmoWalletPastiglia;'
)();

// ── ① LO ZERO SI DICHIARA — sua decisione, e il testo è quello esatto ───────────────────────
test('saldo zero → «0,00 €», non vuoto e non trattino', () => {
  const r = pastiglia(0);
  assert.equal(r.testo, '0,00 €');
  assert.equal(r.ignoto, false);
});

// ── ② IL null NON È ZERO — il cuore della voce ──────────────────────────────────────────────
test('saldo null → NON scrive 0,00 €', () => {
  const r = pastiglia(null);
  assert.equal(r.ignoto, true);
  assert.notEqual(r.testo, '0,00 €');
  assert.ok(!/\d/.test(r.testo), 'il caso ignoto non deve contenere cifre: ' + r.testo);
});

test('saldo assente/undefined → stesso trattamento del null', () => {
  for (const v of [undefined, NaN, 'boh', {}]) {
    const r = pastiglia(v);
    assert.equal(r.ignoto, true, 'non riconosciuto come ignoto: ' + String(v));
    assert.notEqual(r.testo, '0,00 €');
  }
});

test('il caso ignoto usa ESATTAMENTE la frase che l\'app dice già sul bottone Wallet', () => {
  // 🩹 La prima stesura diceva «Saldo borsellino non disponibile» e la guardia della voce 128
  //    l'ha fermata: nel gestionale la parola è **Wallet** (sua decisione del 02/09). Correggendola
  //    le due frasi sono diventate LA STESSA, che è meglio di due sinonimi: l'operatore che legge
  //    il bottone spento e la pastiglia legge una cosa sola.
  const r = pastiglia(null);
  assert.equal(r.titolo, 'Saldo Wallet non disponibile');
  assert.ok(APP.includes("'Saldo Wallet non disponibile'"),
    'il bottone Wallet non dice più «non disponibile»: le due frasi vanno riallineate a mano');
});

// ── ③ IL SALDO VERO SI LEGGE PER INTERO ─────────────────────────────────────────────────────
test('un saldo con credito si scrive in euro italiani', () => {
  assert.equal(pastiglia(1250).testo, '12,50 €');
  assert.equal(pastiglia(5).testo, '0,05 €');
  // 🩹 Il separatore delle MIGLIAIA non si asserisce: `toLocaleString` lo mette solo dove l'ICU
  //    completo c'è, e il node di una sessione cloud può essere «small-icu» — là 100000 esce
  //    «1000,00 €» invece di «1.000,00 €». Sul browser vero il punto c'è. Un banco che
  //    pretendesse il punto sarebbe rosso per il proprio interprete, non per l'app.
  const mille = pastiglia(100000).testo;
  assert.ok(/^1\.?000,00 €$/.test(mille), mille);
});

test('un saldo NEGATIVO si mostra com\'è, non si azzera', () => {
  // Matchpoint può esporre un saldo in rosso: nasconderlo direbbe «a posto» a chi fa cassa.
  const r = pastiglia(-750);
  assert.equal(r.ignoto, false);
  assert.ok(r.testo.includes('7,50'), r.testo);
});

// ── ④ LA PASTIGLIA C'È SEMPRE, ED È MUTA — le due decisioni sue ─────────────────────────────
test('la pastiglia non è un bottone', () => {
  const i = APP.indexOf("_pmoWalletPastiglia(p.saldoCents)");
  assert.ok(i > 0, 'la pastiglia non è agganciata alla riga del giocatore');
  const blocco = APP.slice(i - 400, i + 1400);
  assert.ok(!/createElement\('button'\)/.test(blocco.slice(0, 1600).split('item.appendChild(money)')[0]),
    'nella pastiglia è comparso un <button>: sua decisione era «muta»');
  assert.ok(!/wChip\.addEventListener/.test(blocco), 'la pastiglia ha preso un click');
});

test('la pastiglia NON è condizionata all\'avere credito', () => {
  // Sua decisione, che ha ribaltato la proposta di mostrarla solo a chi ha soldi dentro:
  // una riga senza pastiglia direbbe «non lo so», che è la cosa sbagliata da far pensare.
  const i = APP.indexOf('const _w = _pmoWalletPastiglia(p.saldoCents);');
  assert.ok(i > 0);
  const prima = APP.slice(i - 260, i);
  assert.ok(!/saldoCents\s*>\s*0|saldoCents\s*&&/.test(prima),
    'la pastiglia è stata rimessa dietro una condizione sul credito');
});

// ── ⑤ I TRE NOMI RESTANO TRE — la trappola della voce 128 ───────────────────────────────────
test('il worker continua a cercare i testi di Matchpoint, non i nostri', () => {
  // ⛔ Uniformare «borsellino» / «Wallet» / «Portafoglio» romperebbe il worker, che sul dialog
  //    dell'incasso clicca PER TESTO. Questa guardia si rompe se qualcuno «mette ordine».
  const w = readFileSync(join(QUI, '..', 'tools', 'matchpoint-browser-worker', 'src', 'server.mjs'), 'utf8');
  assert.ok(/borsellino/i.test(w), 'la chiave `borsellino` del worker è sparita');
  // …e verso l'operatore la parola resta una sola: «Wallet». La pastiglia non ne introduce una quarta.
  assert.ok(!/(titolo|aria-label)[^\n]*[Bb]orsellino/.test(APP),
    'la pastiglia è tornata a dire «borsellino» all\'operatore: la 128 vuole «Wallet»');
});

console.log('\n' + passed + ' ok, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
