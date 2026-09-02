/* 🗓️ «L'etichetta che lampeggia non sposta il calendario» — banco della voce 130 (02/09/2026).
 *
 * 🚨 IL FATTO, sue parole: «ogni tanto sembra che il calendario si sposta, quindi sale e scende
 * velocemente, ma è molto piccolo lo spostamento in verticale».
 *
 * 📏 MISURATO su TEST con la console remota, usando lo strumento del browser
 * (`PerformanceObserver` su `layout-shift`, che dice anche CHI si è mosso):
 *     t=77347ms  div#staffCalV36  189 → 213   (+24px)
 *     t=81424ms  div#staffCalV36  213 → 189   (−24px)
 * e, forzando l'etichetta visibile: intestazione 56 → 80px, `#staffCalV36` 189 → 213px.
 * ⇒ La causa è `#staffCalCloudStatus` («aggiorno…»), che si accende e si spegne con `display`
 * **dentro il flusso** dell'intestazione. Non è il calendario a muoversi: è l'intestazione a
 * crescere sopra di lui.
 *
 * ⚖️ LA CLASSE, non il caso: un avviso TRANSITORIO non ha diritto allo spazio di uno PERMANENTE.
 * `#staffCalSessionWarning` sta nello stesso posto e resta NEL FLUSSO di proposito — dura, ed è un
 * bersaglio da cliccare. Questo banco protegge tutt'e due i versi: che il primo resti fuori dal
 * flusso, e che il secondo NON ci finisca per «coerenza».
 *
 * ⛔ Quello che questo banco NON dice: gira senza browser ⇒ prova che l'etichetta è dichiarata
 * fuori dal flusso, non che sullo schermo non si muova niente. Quella è una misura (console remota
 * su `layout-shift`), e va rifatta se qualcuno tocca l'intestazione.
 *
 * Esegui:  node test/letichetta-non-sposta-il-calendario.test.mjs
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

/** Il blocco di regole CSS di un selettore, o null. */
function regoleDi(selettore) {
  const i = APP.indexOf(selettore + ' {');
  if (i < 0) return null;
  const j = APP.indexOf('}', i);
  return j < 0 ? null : APP.slice(i, j + 1);
}

test('l\'etichetta «aggiorno…» esiste ancora e la si accende/spegne a runtime', () => {
  // Se un domani sparisce, questo banco non ha più niente da difendere e va tolto con lei —
  // meglio che resti verde per inerzia proteggendo un elemento che non c'è.
  assert.ok(APP.includes('id="staffCalCloudStatus"'), 'l\'etichetta non è più nel markup');
  assert.ok(/statusEl\.style\.display\s*=/.test(APP),
    'nessuno accende/spegne più l\'etichetta: se è stato cambiato il meccanismo, aggiorna questo banco');
});

test('l\'etichetta TRANSITORIA sta FUORI dal flusso: accenderla non muove il calendario', () => {
  const r = regoleDi('#pmoCalendarioStaffPanel #staffCalCloudStatus');
  assert.ok(r, 'manca la regola che toglie #staffCalCloudStatus dal flusso');
  assert.ok(/position:\s*absolute/.test(r),
    'l\'etichetta è tornata nel flusso: accendendola l\'intestazione cresce di 24px e tutto il calendario scende');
  const anc = regoleDi('#pmoCalendarioStaffPanel .admin-panel-head > div:first-child');
  assert.ok(anc && /position:\s*relative/.test(anc),
    'senza `position:relative` sul contenitore, l\'etichetta assoluta si aggancia a un antenato lontano e finisce chissà dove');
});

test('l\'avviso PERMANENTE «sessione scaduta» resta NEL flusso, ed è una scelta', () => {
  // È un bersaglio da cliccare («tocca qui per uscire e rientrare») e dura finché non lo si tocca:
  // deve prendersi il suo spazio. Chi un giorno applicasse la stessa cura «per coerenza» lo
  // sovrapporrebbe al calendario.
  const r = regoleDi('#pmoCalendarioStaffPanel #staffCalSessionWarning');
  assert.ok(!r || !/position:\s*absolute/.test(r),
    'l\'avviso di sessione scaduta è stato tolto dal flusso: è permanente e cliccabile, non deve sovrapporsi al calendario');
});

console.log('\n' + passed + ' passati, ' + failed + ' falliti');
process.exit(failed ? 1 : 0);
