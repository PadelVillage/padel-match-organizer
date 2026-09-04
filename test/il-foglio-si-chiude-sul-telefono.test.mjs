/* 🪟 «Su telefono il foglio si chiude» — banco della voce 148 (04/09/2026).
 *
 * 🗣️ LA VOCE È SUA, segnalata dal cellulare subito dopo il primo cambio importo vero su PROD
 *    6.330: «poi la scheda è rimasta aperta e non si è più chiusa sul cellulare. Quindi ce l'ho
 *    sempre aperta in sovraimpressione.»
 *
 * 🚨⭐⭐ IL FATTO CHE QUESTO BANCO ESISTE PER DIFENDERE, e che è la lezione della voce: non era
 *    un guasto, era una riga scritta APPOSTA dalla 132 — «la scheda resta aperta (i nuovi valori
 *    sono già quelli mostrati)». Su desktop è giusto: lì la scheda è un pannello accanto al
 *    calendario. Su telefono la stessa scheda è un foglio a TUTTO SCHERMO, e «resta aperta»
 *    diventa «non se ne va».
 *    📌 Una scelta giusta su una larghezza non è una scelta: è una scelta più una larghezza
 *       sottintesa. Se la larghezza non è scritta, la si è decisa senza saperlo.
 *
 * ⛔ QUELLO CHE QUESTO BANCO NON DICE: gira senza browser ⇒ prova che le righe ci siano e che
 *    dicano la cosa giusta, non che sul telefono il foglio si VEDA chiudere. Quello lo dice il
 *    suo dito su un cambio importo vero, che scrive su Matchpoint.
 *
 * Esegui:  node test/il-foglio-si-chiude-sul-telefono.test.mjs
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

/** Solo le righe di CODICE: via i commenti. Una guardia deve rompersi su ciò che è sbagliato,
 *  non su ciò che ne PARLA — e qui il commento accanto nomina tutte le funzioni in gioco. */
function soloCodice(testo) {
  return String(testo).split('\n').filter(function (r) {
    return !/^\s*(\/\/|\*|\/\*)/.test(r);
  }).join('\n');
}

/** Il ramo «solo gli importi sono cambiati».
 *  🩹⭐ ANCORATO A `const _idResCharge`, che apre il blocco — e la prima stesura partiva da
 *  `await _pmoSetCharges(`, cioè DOPO la riga che il caso ① deve misurare: il banco dichiarava
 *  mancante un `const _esitoCharge =` che era scritto tre caratteri prima della fetta.
 *  📌 Una sonda che ritaglia a partire da ciò che vuole misurare non lo misura mai. */
function ramoSoloImporti() {
  const i = APP.indexOf('const _idResCharge =');
  assert.ok(i > 0, 'il ramo degli importi non c\'è più: questo banco non sa dove guardare');
  const j = APP.indexOf('_pmoSetCharges(', i);
  assert.ok(j > i && j - i < 400, 'fra l\'id e la chiamata c\'è troppo: la fetta non è più quel ramo');
  return APP.slice(i, i + 3000);
}

test('① L\'ESITO SI CATTURA: senza, non c\'è modo di sapere se chiudere', () => {
  /* 🚨 Prima il valore di ritorno veniva buttato (`await _pmoSetCharges({...});`) e il ramo
     tornava senza sapere com'era andata. Chiudere alla cieca è precisamente ciò che il ② vieta. */
  const src = soloCodice(ramoSoloImporti());
  assert.match(src, /const\s+_esitoCharge\s*=\s*await\s+_pmoSetCharges\(/,
    'l\'esito della scrittura non viene catturato: la chiusura non potrebbe distinguere il verde dal rosso');
});

test('② 🚨 SI CHIUDE SOLO SUL VERDE — un foglio che si chiude su un errore è un errore nascosto', () => {
  /* ⚖️ È la regola di `svcMpSyncConfirmed` applicata qui: se la scrittura è fallita, l'esito col
     motivo vive nella riga della scheda. Chiuderla se lo porterebbe via, e resterebbe un importo
     non cambiato senza nessuna spiegazione. */
  const src = soloCodice(ramoSoloImporti());
  assert.match(src, /if\s*\(\s*_esitoCharge\s*&&\s*_esitoCharge\.ok\s*\)/,
    'la chiusura non è condizionata al verde: un rifiuto si porterebbe via il proprio motivo');
});

test('③ 🚨 PASSA DA `svcAutoCloseIfMobile`, NON da `svcCloseChat` — o il desktop cambia', () => {
  /* ⚖️ `svcAutoCloseIfMobile` porta dentro DUE cose che qui non si possono perdere: la soglia
     `< 900px` (il desktop resta com'era, e la scelta della 132 non viene ribaltata) e i 700 ms
     che lasciano leggere l'esito prima che il foglio se ne vada.
     🚨 Questa guardia si romperebbe se qualcuno, per «semplificare», mettesse `svcCloseChat()`
     diretto: da telefono sembrerebbe identico, e su desktop chiuderebbe un pannello che deve
     restare aperto. È lo stesso punto cieco della voce, al rovescio. */
  const src = soloCodice(ramoSoloImporti());
  assert.match(src, /svcAutoCloseIfMobile\(\)/, 'la chiusura su telefono non c\'è: il foglio resta in sovraimpressione');
  assert.ok(!/(^|[^.\w])svcCloseChat\(\)/.test(src),
    'si chiude con svcCloseChat diretto: senza la soglia dei 900px chiuderebbe anche il pannello del desktop');
});

test('④ LA SOGLIA STA DENTRO `svcAutoCloseIfMobile`, e ci deve restare', () => {
  /* 📌 Il ③ si fida di questa funzione: se un domani qualcuno le togliesse la soglia, la cura
     diventerebbe il difetto opposto senza che il ③ se ne accorga. Le due guardie si tengono. */
  const i = APP.indexOf('function svcAutoCloseIfMobile(');
  assert.ok(i > 0, 'svcAutoCloseIfMobile non esiste più');
  const src = APP.slice(i, i + 400);
  assert.match(src, /window\.innerWidth\s*<\s*900/, 'la soglia dei 900px non c\'è più: chiuderebbe anche su desktop');
  assert.match(src, /setTimeout\(/, 'la pausa non c\'è più: il foglio se ne andrebbe prima che l\'esito si legga');
});

test('⑤ ⛔ NON SI TOCCA `staffCalPlayersState`: la cura fa quello che farebbe il suo dito', () => {
  /* 📏 Misurato: il gestore della ✕ è `closeBtn.addEventListener('click', svcCloseChat)` e basta
     — non azzera nessuno stato. ⇒ Una chiusura automatica che invece lo azzerasse farebbe una
     cosa DIVERSA da quella che l'operatore crede di aver fatto, e le differenze fra un gesto e
     la sua imitazione si scoprono sempre dopo. */
  const src = soloCodice(ramoSoloImporti());
  assert.ok(!/staffCalPlayersState\s*=/.test(src),
    'la chiusura automatica azzera uno stato che la ✕ non azzera: non è più la stessa chiusura');
  assert.match(APP, /closeBtn\.addEventListener\('click',\s*svcCloseChat\)/,
    'il gestore della ✕ è cambiato: il ⑤ si fidava del fatto che non tocchi nessuno stato');
});

console.log('\n' + passed + ' passati, ' + failed + ' falliti');
process.exit(failed ? 1 : 0);
