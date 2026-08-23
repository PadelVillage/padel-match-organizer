// Prove della riduzione della raffica (voce 68, decisione ② del committente).
// Esegui:  node supabase/functions/consumer-staff-events/riduzione.test.ts
import assert from 'node:assert/strict';
import { coppia, QUIETE_MS, riduci, statoFinale, type FattoInCoda } from './riduzione.ts';

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

const T0 = Date.parse('2026-08-21T20:48:00Z');
const ADESSO = T0 + 10 * 60 * 1000;   // dieci minuti dopo: tutto maturo

let seq = 0;
function fatto(
  gesto: FattoInCoda['gesto'],
  offsetSec: number,
  persona = 'Lidia Comes',
  slot = '2026-08-31|09:30|1',
): FattoInCoda {
  const [data, ora, campo] = slot.split('|');
  return {
    id: `f${++seq}`,
    slot, data, ora, campo, persona, gesto,
    visto_at: new Date(T0 + offsetSec * 1000).toISOString(),
  };
}

// ── Lo stato finale, la regola in sé ─────────────────────────────────────────────────────
test('la tabella della regola, riga per riga', () => {
  assert.equal(statoFinale(['tolto']), 'tolto');
  assert.equal(statoFinale(['tolto', 'aggiunto']), null, 'tolto e rimesso: non è successo niente');
  assert.equal(statoFinale(['aggiunto', 'tolto']), null);
  assert.equal(statoFinale(['aggiunto']), 'aggiunto');
  assert.equal(statoFinale(['aggiunto', 'tolto', 'aggiunto']), 'aggiunto');
  assert.equal(statoFinale(['tolto', 'aggiunto', 'tolto']), 'tolto');
  assert.equal(statoFinale([]), null);
});

test("l'annullamento vince quando è l'ultima parola", () => {
  assert.equal(statoFinale(['annullata']), 'annullata');
  assert.equal(statoFinale(['aggiunto', 'annullata']), 'annullata');
  assert.equal(statoFinale(['tolto', 'aggiunto', 'annullata']), 'annullata');
});

test('una partita annullata e poi ricreata: conta come uscita, e il seguito riprende da lì', () => {
  assert.equal(statoFinale(['annullata', 'aggiunto']), null, 'era dentro, è dentro');
});

// ── ⭐ Il caso che giustifica il modulo ───────────────────────────────────────────────────
test('⭐ tolto e rimesso in trenta secondi → NESSUN messaggio, ma le righe si chiudono', () => {
  const f = [fatto('tolto', 0), fatto('aggiunto', 30)];
  const e = riduci(f, ADESSO);
  assert.equal(e.length, 1);
  assert.equal(e[0].gesto, null, 'niente da dire: la persona è dove era');
  assert.equal(e[0].ids.length, 2, 'ma tutte e due le righe vanno marcate consegnate');
});

test('la raffica vera del 21/08 si riduce a una cosa sola', () => {
  // 20:50 tolte Fabiola e Lidia dal bot, ~20:52 Lidia rimessa dal gestionale.
  const f = [
    fatto('tolto', 0, 'Fabiola Limuti'),
    fatto('tolto', 0, 'Lidia Comes'),
    fatto('aggiunto', 120, 'Lidia Comes'),
  ];
  const e = riduci(f, ADESSO).sort((a, b) => a.persona.localeCompare(b.persona));
  assert.equal(e.length, 2, 'due persone, due coppie');
  assert.equal(e[0].persona, 'Fabiola Limuti');
  assert.equal(e[0].gesto, 'tolto', 'lei è uscita davvero e lo deve sapere');
  assert.equal(e[1].persona, 'Lidia Comes');
  assert.equal(e[1].gesto, null, 'lei non si è accorta di niente, e va bene così');
});

// ── I due minuti di quiete ───────────────────────────────────────────────────────────────
test('una raffica ancora calda non si consegna a metà', () => {
  const f = [fatto('tolto', 0)];
  assert.deepEqual(riduci(f, T0 + QUIETE_MS - 1000), [], 'un secondo prima: si aspetta');
  assert.equal(riduci(f, T0 + QUIETE_MS).length, 1, 'scaduti i due minuti: si consegna');
});

test('la quiete si misura sull\'ULTIMO gesto, non sul primo', () => {
  // Primo gesto vecchissimo, ultimo appena fatto: la segreteria sta ancora lavorando.
  const f = [fatto('tolto', 0), fatto('aggiunto', 590)];
  assert.deepEqual(riduci(f, T0 + 600 * 1000), [], 'l\'ultimo ha dieci secondi: si aspetta');
});

test('una coppia calda non trattiene le altre', () => {
  const f = [
    fatto('tolto', 0, 'Lidia Comes'),
    fatto('tolto', 595, 'Marco Rossi'),
  ];
  const e = riduci(f, T0 + 600 * 1000);
  assert.equal(e.length, 1);
  assert.equal(e[0].persona, 'Lidia Comes');
});

test('una data illeggibile non blocca la riga per sempre', () => {
  const f = [{ ...fatto('tolto', 0), visto_at: 'non-una-data' }];
  assert.equal(riduci(f, ADESSO).length, 1);
});

// ── Le coppie sono per persona E per partita ─────────────────────────────────────────────
test('la stessa persona in due partite diverse sono due esiti', () => {
  const f = [
    fatto('tolto', 0, 'Lidia Comes', '2026-08-31|09:30|1'),
    fatto('aggiunto', 0, 'Lidia Comes', '2026-09-01|18:00|2'),
  ];
  assert.equal(riduci(f, ADESSO).length, 2);
});

test('il nome si confronta senza badare a maiuscole e spazi', () => {
  assert.equal(coppia(' Lidia Comes ', 's'), coppia('lidia comes', 's'));
});

test('i gesti si ordinano per istante, non per come arrivano dal database', () => {
  const dopo = fatto('aggiunto', 60);
  const prima = fatto('tolto', 0);
  const e = riduci([dopo, prima], ADESSO);   // di proposito al contrario
  assert.equal(e[0].gesto, null, 'tolto poi aggiunto = niente; l\'ordine sbagliato direbbe «tolto»');
});

// ── VOCE 74 — il tipo dello slot arriva fino a chi consegna ─────────────────────────────
test('il tipo dello slot sopravvive alla riduzione: senza, il bot direbbe «partita» a una lezione', () => {
  const base = { slot: '2026-08-25|12:30|1', data: '2026-08-25', ora: '12:30', campo: 'Campo 1', persona: 'Maria Pia Bettiol' };
  const r = riduci([
    { id: 'a', ...base, gesto: 'aggiunto', visto_at: '2026-08-22T10:00:00.000Z', tipo: 'lezione' },
  ], new Date('2026-08-22T10:05:00.000Z'));
  assert.equal(r.length, 1);
  assert.equal(r[0].tipo, 'lezione');
});

test('un fatto VECCHIO senza tipo esce con null, non con undefined: il bot deve poter dire «non lo so»', () => {
  const base = { slot: '2026-08-25|12:30|1', data: '2026-08-25', ora: '12:30', campo: 'Campo 1', persona: 'Maria Pia Bettiol' };
  const r = riduci([
    { id: 'a', ...base, gesto: 'aggiunto', visto_at: '2026-08-22T10:00:00.000Z' },
  ], new Date('2026-08-22T10:05:00.000Z'));
  assert.equal(r[0].tipo, null);
});

test('🔄 lo SPOSTAMENTO vince da ultimo, come «annullata» — ma in mezzo va nel verso opposto', () => {
  // 🗣️ Voce 74, regola del committente del 23/08. `spostata` dice dov'è finita la PARTITA, non
  // dove si trova il giocatore: da ultimo vince, come `annullata`.
  assert.equal(statoFinale(['spostata']), 'spostata');
  assert.equal(statoFinale(['aggiunto', 'spostata']), 'spostata');
  assert.equal(statoFinale(['spostata', 'spostata']), 'spostata', 'due spostamenti si dicono una volta sola');
  assert.equal(statoFinale(['spostata', 'annullata']), 'annullata', 'spostata e poi annullata: non c\'è più');

  // 🚨 E QUI LE DUE PAROLE VANNO NEI VERSI OPPOSTI, che è il punto in cui è facile confonderle:
  // un annullo IN MEZZO è un'uscita (`annullata` conta come «fuori»), uno spostamento no — chi
  // era in campo ci resta, la partita si è solo mossa. ⇒ Non tocca il conto dentro/fuori.
  assert.equal(statoFinale(['spostata', 'tolto']), 'tolto', 'spostata e poi tolto: è fuori');
  assert.equal(statoFinale(['tolto', 'spostata']), 'spostata');
  // Chi era fuori, viene messo dentro e poi la partita si sposta: la notizia utile è lo
  // spostamento, e dice già che è dentro.
  assert.equal(statoFinale(['aggiunto', 'spostata']), 'spostata');
});

test('🔄 il «da» sopravvive alla riduzione, e viene dall\'ULTIMO fatto', () => {
  // ⚖️ Come il `tipo`: non si fonde e non si vota. Se una partita si sposta due volte in una
  // raffica, la partenza che serve al socio è quella da cui l'ha vista lui — la prima — ma
  // l'unica che questo modulo può conoscere senza tenere una storia è l'ultima. ⇒ Si dichiara.
  const base = fatto('spostata', 0, 'Maurizio Aprea', '2026-08-31|11:30|2');
  const con = { ...base, da: { data: '2026-08-31', ora: '09:30', campo: '1' } } as FattoInCoda;
  const dopoLaQuiete = Date.parse(con.visto_at) + QUIETE_MS + 1000;
  const r = riduci([con], dopoLaQuiete);
  assert.equal(r.length, 1);
  assert.equal(r[0].gesto, 'spostata');
  assert.deepEqual(r[0].da, { data: '2026-08-31', ora: '09:30', campo: '1' });
  // ⚠️ Sugli altri gesti resta nullo: non si porta dietro una partenza che non esiste.
  const senza = riduci([fatto('tolto', 0, 'Lidia Comes', '2026-08-31|11:30|2')], dopoLaQuiete);
  assert.equal(senza[0].da ?? null, null);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
