// Guardia della voce 66: i tre tentativi dell'autocomplete devono essere TRE.
// Esegui:  node tools/matchpoint-browser-worker/test/ristabilizza-fra-tentativi.test.mjs
//
// ⚖️ PERCHÉ UNA GUARDIA SUL SORGENTE. Quello che questa cura cambia vive dentro un flusso
// Playwright su una pagina Matchpoint vera: non c'è modo di eseguirlo qui, e provarlo davvero
// significherebbe scrivere sul gestionale del circolo. Ma la cosa che si può rompere non è il
// comportamento del browser — è una **decisione**: che il ri-stabilizzo stia dentro il ciclo e
// non solo prima. È la riga che qualcuno toglie «per pulizia» fra sei mesi, notando che sembra
// duplicata, e nessuno se ne accorge: le prenotazioni continuano a funzionare, e a tornare
// rotti sono solo i casi che già fallivano.
//
// 📏 IL FATTO CHE LA CURA POGGIA, misurato il 23/08 e non supposto. Traccia del fallimento del
// 22/08 22:14:52Z:
//     attempt0 → tendina giusta, id non agganciato
//     attempt1 → player_option_not_found      ← la tendina non torna più
//     attempt2 → player_option_not_found
// e nel registro dell'edge, due minuti dopo: stessa data, stessa ora, stesso campo, stesso
// socio, `create OK`. ⇒ Una pagina rimessa a posto ce la fa; a non farcela era il ciclo, che
// ridigitava dentro un campo morto senza rifare la stabilizzazione.
//
// 🚨 TARATURA MISURATA SABOTANDO (23/08/2026), non prevista guardandola verde:
//
//   sabotaggio                                              esito
//   ─────────────────────────────────────────────────       ──────────────────────────────
//   nessuno                                                 4 verdi
//   tolto il ri-stabilizzo dal ciclo (com'era prima)        3 ROSSI (il ciclo, il controllo
//                                                           negativo, e la traccia: togliendo
//                                                           il blocco spariscono tutti e tre)
//   ri-stabilizzo reso INCONDIZIONATO (senza attempt > 0)   1 ROSSO (solo il controllo negativo)
//
// 📌 Il primo sabotaggio ne fa cadere TRE, e non due come avevo previsto: `player_form_resettled`
// vive dentro lo stesso blocco che si toglie. Scritto com'è misurato, non com'era atteso.
//
// ⛔ Il secondo sabotaggio è il **controllo negativo**, ed è la metà che protegge il costo: senza
// la condizione, mezzo secondo in più si pagherebbe su OGNI giocatore di OGNI prenotazione — e
// il rischio della cura smetterebbe di essere confinato al ramo che già falliva, che è l'unica
// ragione per cui si è potuta scrivere senza prima provarla sul Matchpoint vero.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok   - ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL - ${name}\n      ${e.message}`);
  }
}

const sorgente = readFileSync(
  join(dirname(dirname(fileURLToPath(import.meta.url))), 'src', 'server.mjs'),
  'utf8',
);

// Il ciclo dei tentativi: da `outer:` fino alla riga che ne raccoglie l'esito.
const inizio = sorgente.indexOf('outer: for (let attempt');
const fine = sorgente.indexOf('if (!lockedId) {', inizio);
assert.notEqual(inizio, -1, 'il ciclo `outer:` dei tentativi non esiste più: questa guardia non guarda più niente');
assert.ok(fine > inizio, 'la chiusura del ciclo (`if (!lockedId)`) non si trova più dopo `outer:`');
const ciclo = sorgente.slice(inizio, fine);

test('il ciclo rimette a posto il campo fra un tentativo e l\'altro', () => {
  assert.ok(
    ciclo.includes('stabilizzaCampo()'),
    'il ciclo dei tentativi non rimette a posto il campo: `attempt1` e `attempt2` tornerebbero\n'
    + '      a ridigitare dentro un estensore avvelenato, cioè a essere due finte.',
  );
});

test('⛔ ma NON al primo giro — il costo resta confinato al ramo che gia\' falliva', () => {
  assert.ok(
    /if \(attempt > 0\)[\s\S]{0,200}stabilizzaCampo\(\)/.test(ciclo),
    'il ri-stabilizzo non e\' piu\' condizionato ad `attempt > 0`: mezzo secondo in piu\' su OGNI\n'
    + '      giocatore di OGNI prenotazione, e la cura smette di toccare solo cio\' che gia\' falliva.',
  );
});

test('il passo si dichiara nella traccia, o il prossimo caso non dira\' se e\' servito', () => {
  assert.ok(
    ciclo.includes('player_form_resettled'),
    'manca `player_form_resettled` negli steps: la prossima volta che il guasto capita non si\n'
    + '      potra\' distinguere «il ri-stabilizzo non e\' bastato» da «il ri-stabilizzo non c\'era».',
  );
});

test('la stabilizzazione e\' UNA sola definizione, e i due chiamanti non possono divergere', () => {
  const definizioni = sorgente.split('const stabilizzaCampo = async').length - 1;
  assert.equal(
    definizioni, 1,
    `\`stabilizzaCampo\` e' definita ${definizioni} volte: due copie della stessa manovra sono due\n`
    + '      copie che prima o poi divergono, ed e\' esattamente il difetto che questa cura chiude.',
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
