/* 🚦 «Il semaforo chiede in proporzione a quanto il gestionale riesce a rispondere» — banco
 * della voce 162 (05/09/2026).
 *
 * 📏 IL DIFETTO, misurato e non pensato: alle 06:30 del 05/09, con PROD in ginocchio (voce
 * 160), `svcPollQueueStatus` girava dentro un `setInterval(…, 4000)` — un timer a passo fisso
 * che non aspetta la risposta precedente. Risultato: 129 chiamate in 10 minuti dalle sole pagine
 * della console remota, risposte da 100 secondi, 23 chiamate sovrapposte in volo sullo stesso
 * database che stava già morendo. 🚨 È la forma peggiore di carico: cresce proprio quando il
 * sistema rallenta.
 *
 * 🔨 LA CURA, in tre regole: ① un giro alla volta (il prossimo parte DOPO la risposta);
 * ② backoff dalla LENTEZZA MISURATA (4 → 8 → 16 → 32 s, e torna a 4 appena risponde in tempo);
 * ③ una scheda nascosta non chiede.
 * ⚖️ E cosa NON cambia, che è la metà da difendere con la stessa cura: quando il gestionale
 * sta bene la cella si accende entro i 4 s di oggi.
 *
 * ⛔ QUELLO CHE QUESTO BANCO NON DICE: quante chiamate partono davvero da una pagina viva.
 * Quello lo dice `function_edge_logs` di `matchpoint-queue-status` su TEST e poi su PROD,
 * prima e dopo, ed è la prova fisica della voce.
 *
 * Esegui:  node test/il-semaforo-chiede-in-proporzione.test.mjs
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

/** Le sole righe di CODICE: via i commenti (una guardia deve rompersi su ciò che è sbagliato,
 *  non su ciò che ne parla — e il commento della cura nomina `setInterval` per vietarlo). */
function soloCodice(testo) {
  return String(testo).split('\n').filter(function (r) { return !/^\s*(\/\/|\*|\/\*)/.test(r); }).join('\n');
}

/** Il corpo di `function nome(`, contando le graffe dalla PRIMA del corpo. */
function corpoDi(nome) {
  const i = APP.indexOf('function ' + nome + '(');
  assert.ok(i > 0, 'funzione non trovata: ' + nome);
  const apre = APP.indexOf(') {', i);
  let g = 0, visto = false, out = '';
  for (let k = apre + 2; k < APP.length; k++) {
    const c = APP[k]; out += c;
    if (c === '{') { g++; visto = true; } else if (c === '}') { g--; if (visto && g === 0) break; }
  }
  return out;
}

/** La regola del passo, presa DAL SORGENTE dell'app e valutata qui (pura: nessun DOM). */
function caricaProssimoPasso() {
  const iConst = APP.indexOf('const SVC_POLL_PASSO_MS =');
  assert.ok(iConst > 0, 'manca la costante del passo base');
  const costanti = APP.slice(iConst, APP.indexOf('let _svcPollPassoMs', iConst));
  const corpo = corpoDi('svcProssimoPasso');
  return new Function(costanti + '\nreturn function svcProssimoPasso(durataMs, passoMs) ' + corpo + ';')();
}

// ── ① UN GIRO ALLA VOLTA ────────────────────────────────────────────────────────────────────
test('① il polling non usa più un timer a passo fisso: niente setInterval attorno a svcPollQueueStatus', () => {
  const avvio = soloCodice(corpoDi('svcStartQueuePolling'));
  assert.doesNotMatch(avvio, /setInterval/, 'è tornato `setInterval`: le chiamate si sovrappongono quando il gestionale rallenta');
  assert.match(avvio, /svcGiroDiPolling\(\)/, 'l\'avvio non passa dal giro che aspetta la risposta');
  assert.doesNotMatch(soloCodice(APP), /setInterval\(svcPollQueueStatus/, 'svcPollQueueStatus è ancora dentro un setInterval da qualche parte');
});

test('① il giro successivo parte DOPO la risposta: `await` prima, `setTimeout` nel finally', () => {
  const giro = soloCodice(corpoDi('svcGiroDiPolling'));
  assert.match(giro, /await svcPollQueueStatus\(\)/, 'la chiamata non viene aspettata');
  const iAwait = giro.indexOf('await svcPollQueueStatus');
  const iFinally = giro.indexOf('finally');
  const iTimer = giro.indexOf('setTimeout(svcGiroDiPolling');
  assert.ok(iAwait > 0 && iFinally > iAwait && iTimer > iFinally,
    'il prossimo giro va programmato nel finally, dopo che questo ha risposto (o è caduto)');
});

// ── ② IL PASSO SEGUE LA LENTEZZA MISURATA ───────────────────────────────────────────────────
test('② risposta veloce ⇒ il passo resta 4 s: quando il gestionale sta bene non cambia niente', () => {
  const passo = caricaProssimoPasso();
  assert.equal(passo(120, 4000), 4000);
  assert.equal(passo(3999, 4000), 4000);
});

test('② risposta più lenta del passo ⇒ il passo raddoppia, fino a un tetto', () => {
  const passo = caricaProssimoPasso();
  assert.equal(passo(4001, 4000), 8000);
  assert.equal(passo(9000, 8000), 16000);
  assert.equal(passo(20000, 16000), 32000);
  assert.equal(passo(100000, 32000), 32000, 'oltre il tetto non si cresce: un passo infinito è un polling spento');
  // 📏 Il caso della mattina: risposte da 100 s. Con 4 s fissi partivano 25 chiamate al minuto
  // sovrapposte; qui ne parte UNA, e la successiva aspetta il tetto.
  assert.equal(passo(100000, 4000), 8000);
});

test('② appena le risposte tornano veloci il passo torna SUBITO a 4 s, non scende a scalini', () => {
  const passo = caricaProssimoPasso();
  assert.equal(passo(300, 32000), 4000);
  assert.equal(passo(300, 8000), 4000);
});

test('② un passo assente o rotto vale il passo base, mai zero (zero sarebbe un ciclo stretto)', () => {
  const passo = caricaProssimoPasso();
  assert.equal(passo(100, 0), 4000);
  assert.equal(passo(100, undefined), 4000);
  assert.equal(passo(5000, NaN), 8000);
});

// ── ③ UNA SCHEDA NASCOSTA NON CHIEDE ────────────────────────────────────────────────────────
test('③ una scheda nascosta non chiede: `document.hidden` ferma svcPollQueueStatus prima del fetch', () => {
  const poll = soloCodice(corpoDi('svcPollQueueStatus'));
  const iHidden = poll.indexOf('document.hidden');
  const iFetch = poll.indexOf('fetch(');
  assert.ok(iHidden > 0 && iFetch > iHidden, 'il controllo di visibilità deve stare PRIMA della chiamata');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
