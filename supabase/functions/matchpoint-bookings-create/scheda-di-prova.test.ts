// La scheda del circolo di una partita nata in prova — test deterministici, nessun database.
// Esegui:  node supabase/functions/matchpoint-bookings-create/scheda-di-prova.test.ts
//
// 🚨⭐⭐ Questo banco misura TRE cose, e la seconda è quella che di solito manca:
//   ① la REGOLA è giusta (che scheda esce, e quando non esce);
//   ② 🔗 la scheda si RILEGGE GIUSTA da chi la leggerà DAVVERO — non da una copia della regola
//      scritta qui dentro: si importa `playersFromDescrizione` e `organizzatoreDelloSlot` dal
//      modulo vero del ponte, e si misura che l'organizzatore torni fuori quello giusto. Una
//      scheda «formalmente corretta» che il lettore vero rilegge storta è il difetto che questo
//      modulo esiste per impedire;
//   ③ 🚨 la regola è COLLEGATA e **gated**: nell'edge la chiamata sta DENTRO il ramo della prova.
//      Una funzione perfetta che nessuno chiama resta verde e non difende niente; una chiamata
//      fuori dal ramo scriverebbe una scheda finta anche in PRODUZIONE.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { schedaDiProva } from './scheda-di-prova.ts';
// 🔗 I LETTORI VERI, importati e non riscritti: sono quelli che girano nel ponte dei soci.
import { organizzatoreDelloSlot, playersFromDescrizione } from '../consumer-booking-write/roster-slot.ts';

const QUI = dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`✔ ${name}`);
  } catch (e) {
    failed++;
    console.log(`✘ ${name}\n   ${(e as Error).message}`);
  }
}

// ── ① la regola ───────────────────────────────────────────────────────────────

test('un solo giocatore: la scheda è quella scritta a mano l\'11/08', () => {
  assert.equal(schedaDiProva([{ nome: 'Maurizio Aprea' }]), '-Maurizio Aprea.');
});

test('più giocatori: attaccati, e nell\'ORDINE del roster', () => {
  assert.equal(
    schedaDiProva([{ nome: 'Maurizio Aprea' }, { nome: 'Lidia Comes' }]),
    '-Maurizio Aprea.-Lidia Comes.',
  );
});

test('🚨 l\'ordine NON si riordina: il primo è l\'organizzatore', () => {
  const a = schedaDiProva([{ nome: 'Zeta Ultimo' }, { nome: 'Alfa Primo' }]);
  assert.equal(a, '-Zeta Ultimo.-Alfa Primo.');
  assert.equal(playersFromDescrizione(a)[0], 'Zeta Ultimo', 'riordinare cambierebbe chi comanda');
});

test('i nomi vuoti si saltano, gli spazi si tolgono', () => {
  assert.equal(schedaDiProva([{ nome: '  Uno Rossi ' }, { nome: '' }, { nome: '   ' }]), '-Uno Rossi.');
});

test('anche le stringhe nude: il roster ha più forme, e questa è una', () => {
  assert.equal(schedaDiProva(['Uno Rossi', 'Due Bianchi']), '-Uno Rossi.-Due Bianchi.');
});

test('🚨 niente roster ⇒ niente scheda (null, non stringa vuota)', () => {
  assert.equal(schedaDiProva([]), null);
  assert.equal(schedaDiProva(undefined), null);
  assert.equal(schedaDiProva(null), null);
  assert.equal(schedaDiProva('Uno Rossi'), null, 'una stringa non è un elenco');
  assert.equal(schedaDiProva([{ nome: '' }]), null);
});

test('👤 «Ospite» entra nella scheda: chi la legge decide, non noi', () => {
  assert.equal(schedaDiProva([{ nome: 'Uno Rossi' }, { nome: 'Ospite' }]), '-Uno Rossi.-Ospite.');
});

// ── il fail closed sulla rilettura ────────────────────────────────────────────

test('🚨⭐⭐ un nome col PUNTO non si scrive: si rileggerebbe SPEZZATO', () => {
  assert.equal(schedaDiProva([{ nome: 'A. Rossi' }]), null);
  assert.equal(schedaDiProva([{ nome: 'Uno Rossi' }, { nome: 'B. Bianchi' }]), null,
    'basta UNO storto per non scrivere niente: una scheda a metà nomina la persona sbagliata');
});

test('🚨 un nome che comincia per trattino non si scrive: si rileggerebbe MUTILATO', () => {
  assert.equal(schedaDiProva([{ nome: '-Strano Nome' }]), null);
});

test('⭐ un trattino IN MEZZO invece va bene: si rilegge intero', () => {
  const s = schedaDiProva([{ nome: 'Gian-Luca Rossi' }]);
  assert.equal(s, '-Gian-Luca Rossi.');
  assert.deepEqual(playersFromDescrizione(s as string), ['Gian-Luca Rossi']);
});

// ── ② il collegamento coi LETTORI VERI ────────────────────────────────────────

test('🔗 la scheda si rilegge IDENTICA con il parser vero del ponte', () => {
  for (const nomi of [['Uno Rossi'], ['Uno Rossi', 'Due Bianchi'], ['Uno Rossi', 'Ospite', 'Ospite']]) {
    const s = schedaDiProva(nomi.map((n) => ({ nome: n })));
    assert.ok(s, `scheda non scritta per ${nomi.join('+')}`);
    assert.deepEqual(playersFromDescrizione(s as string), nomi);
  }
});

test('🔗⭐⭐ IL FATTO CHE SERVIVA: con la scheda, la partita di prova HA un organizzatore', () => {
  const scheda = schedaDiProva([{ nome: 'Maurizio Aprea' }, { nome: 'Lidia Comes' }]);
  const riga = { liste: [['Maurizio Aprea', 'Lidia Comes']], descrizione: scheda, tipo: 'partita' };
  assert.equal(organizzatoreDelloSlot([riga]), 'Maurizio Aprea');
});

test('🔗 e SENZA la scheda non ce l\'ha: è l\'`organizzatore_ignoto` dell\'11/08', () => {
  const riga = { liste: [['Maurizio Aprea', 'Lidia Comes']], descrizione: null, tipo: 'partita' };
  assert.equal(organizzatoreDelloSlot([riga]), null,
    'se questo caso diventa verde da solo, il modulo non serve più — si cancelli');
});

test('🔗 la scheda NON contraddice la copia in app: le due copie concordano', () => {
  const scheda = schedaDiProva([{ nome: 'Maurizio Aprea' }, { nome: 'Lidia Comes' }]);
  const copiaInApp = { liste: [['Maurizio Aprea', 'Lidia Comes']], descrizione: null, tipo: 'partita' };
  const conScheda = { liste: [['Maurizio Aprea', 'Lidia Comes']], descrizione: scheda, tipo: 'partita' };
  assert.equal(organizzatoreDelloSlot([copiaInApp, conScheda]), 'Maurizio Aprea');
});

// ── ③ il collegamento e il GATE dentro l'edge ─────────────────────────────────

const SORGENTE = readFileSync(join(QUI, 'index.ts'), 'utf8');

test('🚨 l\'edge CHIAMA davvero la funzione (importata, non ricopiata)', () => {
  assert.match(SORGENTE, /import \{ schedaDiProva \} from '\.\/scheda-di-prova\.ts'/);
  assert.match(SORGENTE, /schedaDiProva\(booking\.giocatori\)/);
});

test('🚨⭐⭐ LA CHIAMATA STA DENTRO IL RAMO DELLA PROVA — in produzione non deve scattare', () => {
  const dopoIlGate = SORGENTE.split('if (esitoVieneDaUnaProva(workerResult))')[1] ?? '';
  const chiusuraRamo = dopoIlGate.indexOf('\n  }');
  assert.ok(chiusuraRamo > 0, 'il ramo della prova non si chiude come previsto: rileggere l\'edge');
  const dentroIlRamo = dopoIlGate.slice(0, chiusuraRamo);
  assert.match(dentroIlRamo, /schedaDiProva\(/, 'la chiamata è uscita dal ramo della prova');
  assert.equal(
    SORGENTE.split('schedaDiProva(').length - 1, 1,
    'la funzione si CHIAMA in un punto solo: un secondo punto è una seconda strada, e la '
    + 'seconda è quella che nessuno ricorda di mettere dentro al gate',
  );
});

test('🚨 `descrizione` si scrive in UN SOLO punto, e solo lì', () => {
  const scritture = SORGENTE.match(/nostro\.descrizione\s*=/g) ?? [];
  assert.equal(scritture.length, 1, 'due scritture della scheda = una fuori dal gate, prima o poi');
  const nostro = SORGENTE.split('const nostro: JsonMap = {')[1]?.split('};')[0] ?? '';
  assert.doesNotMatch(nostro, /descrizione/,
    '⛔ la `descrizione` NON va fra i campi sempre scritti: là finirebbe anche in PRODUZIONE');
});

console.log(`\n${passed} passati · ${failed} falliti`);
if (failed > 0) process.exit(1);
