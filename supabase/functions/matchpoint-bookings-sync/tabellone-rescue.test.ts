// Test deterministici del recupero lezioni-senza-giocatori (nessuna dipendenza esterna).
// Esegui:  node supabase/functions/matchpoint-bookings-sync/tabellone-rescue.test.ts
import assert from 'node:assert/strict';
import {
  collectTabelloneOnlyOccupancies,
  tipoDaTestoTabellone,
  type TabelloneEvent,
} from './tabellone-rescue.ts';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`ok   - ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL - ${name}\n      ${(e as Error).message}`);
  }
}

const D = '2026-07-14';
const day = (evs: TabelloneEvent[]) => ({ [D]: evs });

// 1) Caso reale: lezione senza giocatori NON nell'export → recuperata come occupancy.
test('lezione vuota recuperata', () => {
  const res = collectTabelloneOnlyOccupancies(
    day([{
      id: '8845',
      campo: 1,
      ora: '18:00',
      oraFine: '19:30',
      giocatori: [],
      // Testo VERO di una lezione sul tabellone (letto da uno screenshot del 21/07).
      testo: '18:00-19:30 (0p) Lezione. Santiago Carabajal . : scrivi su WhatsApp al 379 115 1472 per prenotare.',
    }]),
    new Set<string>(),
    new Set(['8815', '7887']), // altri booking reali, NON 8845
  );
  assert.equal(res.length, 1);
  const r = res[0];
  assert.equal(r.numero, '8845');
  assert.equal(r.idReserva, '8845');
  assert.equal(r.campo, 'Campo 1');
  assert.equal(r.ora, '18:00');
  assert.equal(r.durata, '1.5');
  assert.equal(r.tipo, 'Lezione Libera');
  assert.equal(r.giocatore, '');
  assert.equal(r.descrizione, '');
  assert.equal(r._tabelloneOnly, true);
  assert.equal('giocatori' in r, false); // roster vuoto → nessuna chiave giocatori
});

// 2) Anti-fantasma #1: slot che combacia con l'export (matchedKeys) → NON recuperato.
test('slot in matchedKeys ignorato', () => {
  const res = collectTabelloneOnlyOccupancies(
    day([{ id: '8815', campo: 1, ora: '17:00', giocatori: [] }]),
    new Set([`${D}|1|17:00`]),
    new Set<string>(),
  );
  assert.equal(res.length, 0);
});

// 3) Anti-fantasma #2 (backstop idReserva): match campo+ora fallito ma id già nell'export → skip.
test('idReserva gia nell export ignorato (backstop)', () => {
  const res = collectTabelloneOnlyOccupancies(
    day([{ id: '8815', campo: 1, ora: '17:05', giocatori: [] }]), // ora leggermente diversa → non in matchedKeys
    new Set<string>(),
    new Set(['8815']),
  );
  assert.equal(res.length, 0);
});

// 4) Manutenzione esclusa (percorso dedicato).
test('manutenzione esclusa', () => {
  const res = collectTabelloneOnlyOccupancies(
    day([{ id: '', campo: 2, ora: '10:00', tipo: 'manutenzione' }]),
    new Set<string>(),
    new Set<string>(),
  );
  assert.equal(res.length, 0);
});

// 5) Roster presente sul tabellone → incluso in descrizione + giocatori.
test('roster dal tabellone incluso', () => {
  const res = collectTabelloneOnlyOccupancies(
    day([{ id: '9001', campo: 3, ora: '20:00', oraFine: '21:30', giocatori: ['Mario Rossi', 'Ospite'] }]),
    new Set<string>(),
    new Set<string>(),
  );
  assert.equal(res.length, 1);
  assert.equal(res[0].descrizione, '-Mario Rossi.-Ospite.');
  assert.deepEqual(res[0].giocatori, ['Mario Rossi', 'Ospite']);
});

// 6) Durata calcolata dal range orario; fallback 1.5 se il range manca/è invalido.
test('durata dal range e fallback', () => {
  const r1 = collectTabelloneOnlyOccupancies(
    day([{ id: 'a', campo: 1, ora: '18:00', oraFine: '19:00', giocatori: [] }]),
    new Set<string>(), new Set<string>(),
  );
  assert.equal(r1[0].durata, '1');
  const r2 = collectTabelloneOnlyOccupancies(
    day([{ id: 'b', campo: 1, ora: '18:00', giocatori: [] }]), // niente oraFine
    new Set<string>(), new Set<string>(),
  );
  assert.equal(r2[0].durata, '1.5');
});

// 7) Eventi degeneri (campo 0 / ora mancante) scartati senza errori.
test('eventi degeneri scartati', () => {
  const res = collectTabelloneOnlyOccupancies(
    day([
      { id: 'x', campo: 0, ora: '18:00', giocatori: [] },
      { id: 'y', campo: 2, ora: '', giocatori: [] },
    ]),
    new Set<string>(), new Set<string>(),
  );
  assert.equal(res.length, 0);
});

// 8) Multi-giorno: la chiave matchedKeys è per-giorno (non confonde giorni diversi).
test('matchedKeys per-giorno non confonde altri giorni', () => {
  const res = collectTabelloneOnlyOccupancies(
    {
      '2026-07-14': [{ id: '1', campo: 1, ora: '18:00', giocatori: [] }],
      '2026-07-15': [{ id: '2', campo: 1, ora: '18:00', giocatori: [] }],
    },
    new Set(['2026-07-14|1|18:00']), // match solo il 14
    new Set<string>(),
  );
  assert.equal(res.length, 1);
  assert.equal(res[0].data, '2026-07-15');
});

// 9) IL CASO SEGNALATO (21/07): partita SENZA giocatori. Prima veniva chiamata «Lezione»
//    perché il tipo era una costante; ora si legge dalla casella.
test('partita vuota NON viene piu chiamata lezione', () => {
  const res = collectTabelloneOnlyOccupancies(
    day([{
      id: '8737',
      campo: 1,
      ora: '20:30',
      oraFine: '22:30',
      giocatori: [],
      testo: '20:30-22:30 (0/4p) Partita 0,00 - 7,00 misto',
    }]),
    new Set<string>(),
    new Set<string>(),
  );
  assert.equal(res.length, 1);
  assert.equal(res[0].tipo, 'Partita');
  assert.equal(res[0].durata, '2');
});

// 10) Ripiego quando la casella non dice niente: MAI tornare a dichiarare una lezione.
test('senza testo il ripiego e Partita, mai Lezione', () => {
  const res = collectTabelloneOnlyOccupancies(
    day([{ id: '9999', campo: 2, ora: '20:30', oraFine: '22:00', giocatori: [] }]),
    new Set<string>(),
    new Set<string>(),
  );
  assert.equal(res.length, 1);
  assert.equal(res[0].tipo, 'Partita');
});

// 11) Riconoscimento sulle stringhe VERE lette dal tabellone (screenshot 21/07).
test('tipoDaTestoTabellone sulle stringhe reali', () => {
  assert.equal(
    tipoDaTestoTabellone('09:00-10:30 (4/4p) Partita 0,00 - 7,00 misto Fabio De Luca Nicola Stella'),
    'Partita',
  );
  assert.equal(
    tipoDaTestoTabellone('21:00-23:00 (4/4p) Partita 0,00 - 7,00 maschile Alessandro Sagliocco'),
    'Partita',
  );
  assert.equal(
    tipoDaTestoTabellone('13:00-14:00 (2p) Lezione. Santiago Carabajal . : scrivi su WhatsApp al 379 115 1472 per prenotare. Santiago Carabajal'),
    'Lezione Libera',
  );
  // Altre categorie del tabellone: riportate tali e quali, non forzate in una delle due.
  assert.equal(tipoDaTestoTabellone('19:00-20:30 (4/4p) Seminario di tecnica'), 'Seminario');
  // Niente di riconoscibile → stringa vuota, il ripiego lo decide chi chiama.
  assert.equal(tipoDaTestoTabellone('20:30-22:30'), '');
  assert.equal(tipoDaTestoTabellone(''), '');
  assert.equal(tipoDaTestoTabellone(undefined), '');
});

// 12) Il motivo per cui NON si cerca «lezione» in tutto il testo: la parola può comparire
//     nella nota di una partita. Ancorando all'orario, non inganna.
test('la parola lezione nella nota non traveste una partita', () => {
  assert.equal(
    tipoDaTestoTabellone('19:30-21:00 (1/4p) Partita 2,50 misto Frank Vitagliano recupero lezione saltata'),
    'Partita',
  );
});

// 13) Tolleranza di formato: trattino lungo, spazi doppi, conteggio assente.
test('formati diversi della stessa riga', () => {
  assert.equal(tipoDaTestoTabellone('20:30 – 22:30  Partita 0,00'), 'Partita');
  assert.equal(tipoDaTestoTabellone('8:00-9:30 Lezione.'), 'Lezione Libera');
});

console.log(`\n${passed} passati, ${failed} falliti`);
if (failed > 0) process.exit(1);
