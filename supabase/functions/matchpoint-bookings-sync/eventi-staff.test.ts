// Prove deterministiche del confronto fra due fotografie del calendario (voce 68).
// Esegui:  node supabase/functions/matchpoint-bookings-sync/eventi-staff.test.ts
import assert from 'node:assert/strict';
import {
  confrontoAttendibile,
  fattiDaConfronto,
  normNome,
  puoRicevere,
  type SlotRoster,
} from './eventi-staff.ts';

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

/** Scorciatoia: una fotografia con gli slot indicati. */
function foto(...slots: Array<[string, string[]]>): Map<string, SlotRoster> {
  const m = new Map<string, SlotRoster>();
  for (const [slot, roster] of slots) {
    const [data, ora, campo] = slot.split('|');
    m.set(slot, { slot, data, ora, campo, roster });
  }
  return m;
}
/** Riempitivo per superare la guardia del crollo senza rumore nei casi sotto esame. */
function contorno(quanti: number): Array<[string, string[]]> {
  return Array.from({ length: quanti }, (_, i) =>
    [`2026-09-0${(i % 9) + 1}|10:00|${i + 20}`, ['Tizio Riempitivo']] as [string, string[]]);
}

// ── Il caso vero che ha aperto la voce ───────────────────────────────────────────────────
test('lo staff toglie un giocatore da una partita esistente → un fatto, per lui solo', () => {
  const prima = foto(['2026-08-31|09:30|1', ['Maurizio Aprea', 'Lidia Comes']], ...contorno(4));
  const dopo = foto(['2026-08-31|09:30|1', ['Maurizio Aprea']], ...contorno(4));
  const f = fattiDaConfronto(prima, dopo);
  assert.equal(f.length, 1);
  assert.equal(f[0].persona, 'Lidia Comes');
  assert.equal(f[0].gesto, 'tolto');
  assert.equal(f[0].data, '2026-08-31');
});

test('lo staff aggiunge un giocatore → un fatto, e NON lo ricevono gli altri in campo (decisione ①)', () => {
  const prima = foto(['2026-08-31|09:30|1', ['Maurizio Aprea', 'Marco Rossi']], ...contorno(4));
  const dopo = foto(['2026-08-31|09:30|1', ['Maurizio Aprea', 'Marco Rossi', 'Lidia Comes']], ...contorno(4));
  const f = fattiDaConfronto(prima, dopo);
  assert.equal(f.length, 1, 'un solo destinatario: chi il gesto ha toccato');
  assert.equal(f[0].persona, 'Lidia Comes');
  assert.equal(f[0].gesto, 'aggiunto');
});

test('una SOSTITUZIONE è due fatti — il conteggio non cambia, ma le persone sì', () => {
  const prima = foto(['2026-08-31|09:30|1', ['Maurizio Aprea', 'Marco Rossi']], ...contorno(4));
  const dopo = foto(['2026-08-31|09:30|1', ['Maurizio Aprea', 'Lidia Comes']], ...contorno(4));
  const f = fattiDaConfronto(prima, dopo);
  assert.equal(f.length, 2);
  assert.deepEqual(
    f.map((x) => `${x.gesto}:${x.persona}`).sort(),
    ['aggiunto:Lidia Comes', 'tolto:Marco Rossi'],
  );
});

// ── La decisione ③: toccato ≠ cambiato ───────────────────────────────────────────────────
test('lo staff salva senza modificare niente → nessun fatto', () => {
  const uguale: Array<[string, string[]]> = [['2026-08-31|09:30|1', ['Maurizio Aprea', 'Lidia Comes']]];
  const f = fattiDaConfronto(foto(...uguale, ...contorno(4)), foto(...uguale, ...contorno(4)));
  assert.deepEqual(f, []);
});

test("l'ordine dei nomi non è un cambiamento", () => {
  const prima = foto(['2026-08-31|09:30|1', ['Maurizio Aprea', 'Lidia Comes']], ...contorno(4));
  const dopo = foto(['2026-08-31|09:30|1', ['Lidia Comes', 'Maurizio Aprea']], ...contorno(4));
  assert.deepEqual(fattiDaConfronto(prima, dopo), []);
});

// ── L'annullamento ───────────────────────────────────────────────────────────────────────
test('partita annullata → lo sanno TUTTI quelli che ci giocavano', () => {
  const prima = foto(['2026-08-31|09:30|1', ['Maurizio Aprea', 'Lidia Comes', 'Marco Rossi']], ...contorno(6));
  const dopo = foto(...contorno(6));
  const f = fattiDaConfronto(prima, dopo);
  assert.equal(f.length, 3);
  assert.ok(f.every((x) => x.gesto === 'annullata'));
});

// ── Gli «Ospite»: si contano, non si avvisano ────────────────────────────────────────────
test('un «Ospite» tolto non produce nessun fatto: non ha una scheda a cui scrivere', () => {
  const prima = foto(['2026-08-31|09:30|1', ['Maurizio Aprea', 'Ospite', 'Ospite']], ...contorno(4));
  const dopo = foto(['2026-08-31|09:30|1', ['Maurizio Aprea', 'Ospite']], ...contorno(4));
  assert.deepEqual(fattiDaConfronto(prima, dopo), []);
});

test('tre «Ospite» accanto a una persona vera: il fatto esce solo per la persona', () => {
  const prima = foto(['2026-08-31|09:30|1', ['Sergio Dal Bianco', 'Ospite', 'Ospite', 'Ospite']], ...contorno(4));
  const dopo = foto(['2026-08-31|09:30|1', ['Sergio Dal Bianco', 'Ospite', 'Ospite', 'Lidia Comes']], ...contorno(4));
  const f = fattiDaConfronto(prima, dopo);
  assert.equal(f.length, 1);
  assert.equal(f[0].persona, 'Lidia Comes');
  assert.equal(f[0].gesto, 'aggiunto');
});

// ── La guardia del crollo: la protezione che vale più di tutte ───────────────────────────
test('🚨 export mozzato (tutte le partite sparite) → ZERO fatti, non un annullamento di massa', () => {
  const prima = foto(...contorno(40));
  const dopo = new Map<string, SlotRoster>();
  assert.deepEqual(fattiDaConfronto(prima, dopo), []);
});

test('🚨 metà calendario sparito in un colpo → non è una giornata di disdette, è un guasto', () => {
  const prima = foto(...contorno(40));
  const dopo = foto(...contorno(9));
  assert.deepEqual(fattiDaConfronto(prima, dopo), []);
});

test('primo giro (nessuna fotografia di prima) → nessun fatto', () => {
  assert.deepEqual(fattiDaConfronto(new Map(), foto(...contorno(10))), []);
});

test('un calo normale resta sotto la guardia e i fatti escono', () => {
  assert.equal(confrontoAttendibile(40, 39), true);
  assert.equal(confrontoAttendibile(40, 20), true, 'esattamente la soglia: ancora attendibile');
  assert.equal(confrontoAttendibile(40, 19), false);
  assert.equal(confrontoAttendibile(0, 10), false);
  assert.equal(confrontoAttendibile(10, 0), false);
});

// ── Le partite nuove ─────────────────────────────────────────────────────────────────────
test('partita nuova: avvisati tutti tranne il primo, che è chi ha organizzato', () => {
  const prima = foto(...contorno(10));
  const dopo = foto(['2026-09-15|18:00|3', ['Maurizio Aprea', 'Lidia Comes', 'Marco Rossi']], ...contorno(10));
  const f = fattiDaConfronto(prima, dopo);
  assert.equal(f.length, 2);
  assert.ok(!f.some((x) => x.persona === 'Maurizio Aprea'), "l'organizzatore non si avvisa da solo");
  assert.deepEqual(f.map((x) => x.persona).sort(), ['Lidia Comes', 'Marco Rossi']);
});

test('partita nuova con un solo nome → nessun fatto: quella persona ha prenotato lei', () => {
  const prima = foto(...contorno(10));
  const dopo = foto(['2026-09-15|18:00|3', ['Maurizio Aprea']], ...contorno(10));
  assert.deepEqual(fattiDaConfronto(prima, dopo), []);
});

// ── Il confronto dei nomi ────────────────────────────────────────────────────────────────
test('accenti e spazi doppi non fanno sembrare cambiato un roster fermo', () => {
  const prima = foto(['2026-08-31|09:30|1', ['Niccolò  D’Amico']], ...contorno(4));
  const dopo = foto(['2026-08-31|09:30|1', ['Niccolò D’Amico']], ...contorno(4));
  assert.deepEqual(fattiDaConfronto(prima, dopo), []);
});

test('normNome e puoRicevere', () => {
  assert.equal(normNome('  Maurizio   Aprea '), 'maurizio aprea');
  assert.equal(puoRicevere('Ospite'), false);
  assert.equal(puoRicevere('OSPITE'), false);
  assert.equal(puoRicevere(''), false);
  assert.equal(puoRicevere('Lidia Comes'), true);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
