/* 🪟 VOCE 142 — LE DUE COPIE DELL'IMPRONTA DEVONO DIRE LA STESSA COSA.
 *
 * ⚖️ PERCHÉ ESISTE QUESTO BANCO: `CLAUDE.md` vieta le terze copie di una regola, e qui una copia
 *    c'è per forza — l'edge gira in Deno sul server, la scheda gira nel browser, e per confrontare
 *    due stringhe nessuna delle due può chiamare l'altra. ⇒ Il freno che sostituisce l'unicità è
 *    questa prova: le DUE implementazioni vengono ESEGUITE sugli stessi casi e devono coincidere.
 *
 * 🚨 E le esegue davvero, non le rilegge: la copia dell'app viene estratta da `index.html` e
 *    valutata. Una sonda che confronta due sorgenti con una regex direbbe «diversi» di due cose
 *    identiche scritte con un a capo in più — è già successo il 06/09 (la 142 lo racconta).
 *
 * ⛔ COSA NON DICE: che l'arricchimento arrivi alla scheda. Dice che, se arriva, le due parti si
 *    riconoscono. Che la scheda si apra piena lo dice solo la pagina viva.
 *
 * Esegui:  node test/impronta-roster.test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = join(QUI, '..');

// ── la copia dell'APP, estratta da index.html ed ESEGUITA ────────────────────────────────
const html = readFileSync(join(RADICE, 'index.html'), 'utf8');
const blocco = html.match(/function pmoChiaveNome[\s\S]*?\n    }\n    function pmoImprontaRoster[\s\S]*?\n    }/);
if (!blocco) {
  console.error('KO — le funzioni pmoChiaveNome/pmoImprontaRoster non si trovano in index.html.');
  console.error('    Se sono state rinominate, questo banco va aggiornato: non è un dettaglio,');
  console.error('    è la sola cosa che tiene allineate le due copie.');
  process.exit(1);
}
const appScope = {};
try {
  new Function('S', blocco[0].replace(/^ {4}/gm, '') + '\nS.chiave = pmoChiaveNome; S.impronta = pmoImprontaRoster;')(appScope);
} catch (err) {
  // 🚨 Ci si arriva rinominando una delle due funzioni: la regex qui sopra aggancia ancora un
  //    blocco, ma i nomi non tornano più. Senza questo messaggio il banco muore con un
  //    ReferenceError nudo, e un fallimento incomprensibile è un fallimento che si smette di
  //    leggere — la stessa ragione per cui le guardie di questo progetto sono state rese pazienti.
  console.error('KO — il blocco è stato trovato ma non definisce pmoChiaveNome/pmoImprontaRoster.');
  console.error('    Probabile rinomina in index.html. Le due copie non sono più confrontabili:');
  console.error('    aggiorna questo banco, o la scheda smetterà di riconoscere l\'arricchimento.');
  console.error('    Dettaglio: ' + (err && err.message));
  process.exit(1);
}

// ── la copia dell'EDGE, importata dal modulo vero ────────────────────────────────────────
const edge = await import(join(RADICE, 'supabase/functions/matchpoint-bookings-sync/arricchimento-scheda.ts'));

// ── i casi: ognuno è una cosa che è già andata storta almeno una volta in questo progetto ──
const CASI_NOME = [
  'Gianluca Spinazzè', 'GIANLUCA SPINAZZÈ', '  gianluca   spinazze  ',
  'Ospite', 'OSPITE', 'Lucàs Vidal', 'Niccolò D\'Amico', 'José Muñoz',
  'Maurizio  Aprea', '', null, undefined, 42, 'à è ì ò ù', 'Ærø Åberg',
];
const CASI_ROSTER = [
  ['Maurizio Aprea', 'Fabio De Luca', 'Marco Balliana', 'Gianluca Campalto'],
  ['Gianluca Campalto', 'Marco Balliana', 'Fabio De Luca', 'Maurizio Aprea'], // riordinato
  ['Gianluca Spinazzè', 'Ospite', 'Ospite', 'Leonardo Spinazzè'],
  ['Lidia Comes', 'Ospite', 'Ospite', 'Fabiola Limuti'],
  [], null, undefined, ['', '  ', null],
  [{ nome: 'Anna Bianchi' }, { nome: 'Bruno Neri' }],           // forma a oggetti (worker)
  [{ nome: 'Bruno Neri' }, { nome: 'Anna Bianchi' }],           // stessa, riordinata
  ['Anna Bianchi', { nome: 'Bruno Neri' }],                     // mista
];

let ok = 0, ko = 0;
for (const c of CASI_NOME) {
  const a = appScope.chiave(c), b = edge.chiaveNome(c);
  if (a === b) ok++;
  else { ko++; console.log(`  KO  chiaveNome(${JSON.stringify(c)}): app «${a}» ≠ edge «${b}»`); }
}
for (const c of CASI_ROSTER) {
  const a = appScope.impronta(c), b = edge.improntaRoster(c);
  if (a === b) ok++;
  else { ko++; console.log(`  KO  improntaRoster(${JSON.stringify(c)}): app «${a}» ≠ edge «${b}»`); }
}

// ⭐ E la proprietà che l'intera cura poggia: un roster RIORDINATO ha la STESSA impronta.
//    Se cadesse, la scheda rinuncerebbe all'arricchimento ogni volta che l'organizzatore cambia
//    posto — cioè quasi sempre, e in silenzio.
const r1 = appScope.impronta(['Maurizio Aprea', 'Lidia Comes']);
const r2 = appScope.impronta(['Lidia Comes', 'Maurizio Aprea']);
if (r1 === r2 && r1) ok++;
else { ko++; console.log(`  KO  il riordino cambia l'impronta: «${r1}» ≠ «${r2}»`); }

console.log(`\n=== impronta-roster: ${ok} ok, ${ko} KO ===`);
process.exit(ko ? 1 : 0);
