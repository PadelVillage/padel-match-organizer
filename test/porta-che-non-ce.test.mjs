/* 🚪 «Codice che chiama una porta che non c'è» — banco del 02/09/2026.
 *
 * 🚨⭐⭐ IL FATTO CHE LO FA NASCERE, e sono DUE volte in due giorni:
 *   · 02/09 — `_pmoVoidPayment` chiamava `/functions/v1/matchpoint-payment-void` da mesi. Quella
 *     funzione non era né in git né su Supabase. Nessuno se n'era accorto perché il flag spento
 *     impediva al bottone di comparire, quindi il 404 non è mai arrivato a nessuno.
 *   · 02/09 — stessa identica cosa su `matchpoint-payment-write` (l'incasso): il sorgente stava in
 *     `supabase/functions/_archive/`, che i deploy **saltano di proposito**, e su PROD la funzione
 *     non era mai esistita. Accendere il flag avrebbe messo in segreteria tre bottoni che
 *     rispondevano 404 a ogni click.
 *
 * 📌 *Il flag che nasconde un bottone è anche ciò che impedisce di accorgersi che dietro non c'è
 * niente: il difetto non si manifesta finché non lo si accende, cioè nel momento peggiore.*
 *
 * ⚖️ ⇒ QUESTO BANCO GUARDA LA CLASSE, NON I DUE CASI. Cura l'istanza chi aggiunge una prova su
 * `payment-write`; la classe è *ogni* indirizzo `/functions/v1/…` che l'app compone deve avere un
 * sorgente deployabile. Una guardia scritta sui due nomi sarebbe passata verde sul terzo.
 *
 * ⛔ Quello che questo banco NON dice, e va detto: legge il REPO, non Supabase. Dice «il sorgente
 * c'è e il deploy lo prende», non «la funzione è viva sul progetto». Le due cose divergono finché
 * il deploy non gira — e per l'altra metà serve `list_edge_functions`, che è una misura, non un
 * banco.
 *
 * Esegui:  node test/porta-che-non-ce.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = join(QUI, '..');
const APP = readFileSync(join(RADICE, 'index.html'), 'utf8');
const FUNZIONI = join(RADICE, 'supabase', 'functions');

let passed = 0, failed = 0;
function test(nome, fn) {
  try { fn(); passed++; console.log('ok   - ' + nome); }
  catch (e) { failed++; console.log('FAIL - ' + nome + '\n       ' + e.message); }
}

/** Ogni `/functions/v1/<nome>` che compare nel sorgente dell'app, senza duplicati. */
function porteChiamateDallApp() {
  const trovate = new Set();
  for (const m of APP.matchAll(/\/functions\/v1\/([a-z0-9][a-z0-9-]*)/g)) trovate.add(m[1]);
  return [...trovate].sort();
}

test('1. l\'app chiama almeno una porta (se no questo banco non guarda niente)', () => {
  const porte = porteChiamateDallApp();
  assert.ok(porte.length >= 5,
    `trovate solo ${porte.length} porte: la ricerca non funziona più e questo banco passerebbe verde a vuoto`);
});

test('2. 🚪🚨 ogni porta che l\'app chiama ha un sorgente in supabase/functions/', () => {
  const mancanti = porteChiamateDallApp().filter((n) => !existsSync(join(FUNZIONI, n, 'index.ts')));
  assert.deepEqual(mancanti, [],
    'l\'app chiama funzioni che non hanno sorgente deployabile — ogni click su quei bottoni è un 404: '
    + mancanti.join(', '));
});

test('3. 🗄️ nessuna porta chiamata dall\'app vive in _archive/ (i deploy la saltano)', () => {
  /* 🚨 Questo caso è SEPARATO dal 2 di proposito, e non è pedanteria: un sorgente in `_archive/`
     esiste in git, si legge, si apre, e in un `grep` compare — sembra a tutti gli effetti che la
     funzione ci sia. Ma i due workflow filtrano le cartelle che iniziano per `_`, quindi su
     Supabase non arriva **mai**. È esattamente la forma in cui il difetto del 02/09 si è nascosto.
     📌 *Un file che c'è e un servizio che risponde sono due fatti diversi: il primo si vede
     leggendo, il secondo solo deployando.* */
  const archivio = join(FUNZIONI, '_archive');
  const inArchivio = existsSync(archivio)
    ? readdirSync(archivio, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
    : [];
  const chiamateMaArchiviate = porteChiamateDallApp().filter((n) => inArchivio.includes(n));
  assert.deepEqual(chiamateMaArchiviate, [],
    'l\'app chiama funzioni che stanno in _archive/, dove il deploy non le prende: '
    + chiamateMaArchiviate.join(', '));
});

test('4. 💶 l\'INCASSO e lo STORNO di riga sono due interruttori diversi', () => {
  /* 🗣️ Sua scelta del 02/09: acceso l'incasso nella scheda partita, lo storno resta nella scheda
     socio. ⚖️ La guardia è scritta sul FATTO (due nomi diversi che comandano due cose diverse) e
     non sul valore `true`/`false`, che un domani può cambiare senza che il difetto torni. */
  assert.match(APP, /const PMO_PAYMENTS_COLLECT_ENABLED = /,
    'sparito il flag dell\'incasso: è tornato tutto sotto PMO_PAYMENTS_WRITE_ENABLED, che accende anche lo storno di riga');
  const collect = APP.match(/const _payCollectActive = [\s\S]{0,400}?;\n/);
  const vd = APP.match(/const _payVoidActive = [\s\S]{0,400}?;\n/);
  assert.ok(collect, 'non esiste più _payCollectActive: l\'incasso non ha più un interruttore suo');
  assert.ok(vd, 'non esiste più _payVoidActive: lo storno di riga non ha più un interruttore suo');
  assert.ok(!/PMO_PAYMENTS_COLLECT_ENABLED/.test(vd[0]),
    'lo storno di riga è tornato a dipendere dal flag dell\'incasso: accendendo l\'uno si accende l\'altro, che è ciò che lui non ha chiesto');
});

test('5. 🚦 il cancello di _pmoCollectPayment conosce il flag che accende i bottoni', () => {
  /* 🚨 Se il cancello guardasse solo il flag vecchio, i tre bottoni comparirebbero (li disegna
     `_payCollectActive`) e la funzione rifiuterebbe con «Incasso non attivo»: un bottone vivo che
     dice sempre di no è peggio di un bottone assente, perché chi lo preme crede di aver sbagliato. */
  const cancello = APP.match(/if \(![A-Z_]*PMO_PAYMENTS[^)]*\) \{\n\s*try \{ svcAddMessage\('system', 'ℹ️ Incasso non attivo/);
  assert.ok(cancello, 'il cancello dell\'incasso non si trova più: questa prova non guarda più niente');
  assert.match(cancello[0], /PMO_PAYMENTS_COLLECT_ENABLED/,
    'il cancello non conosce PMO_PAYMENTS_COLLECT_ENABLED: i bottoni si disegnano e poi l\'incasso viene rifiutato');
});

console.log(`\n${passed} verdi · ${failed} rossi`);
process.exit(failed ? 1 : 0);
