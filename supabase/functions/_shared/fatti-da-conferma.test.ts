// Prove del modulo che traduce una CONFERMA del circolo in fatti per il socio (voce 76).
// Esegui:  node supabase/functions/_shared/fatti-da-conferma.test.ts
import assert from 'node:assert/strict';
import { campoScritto, destinatari, fattiDaAnnullo, fattiDaSpostamento } from './fatti-da-conferma.ts';
import { chiaveSlot } from '../matchpoint-bookings-sync/eventi-staff.ts';

const test = (nome: string, fn: () => void) => {
  try {
    fn();
    console.log(`  ok  ${nome}`);
  } catch (e) {
    console.error(`  KO  ${nome}`);
    throw e;
  }
};

// ── I destinatari ────────────────────────────────────────────────────────────────────────

test('gli Ospiti non ricevono: dietro non c\'è nessuno da avvisare', () => {
  assert.deepEqual(
    destinatari(['Maurizio Aprea', 'Ospite', 'ospite', 'Lidia Comes']),
    ['Maurizio Aprea', 'Lidia Comes'],
  );
});

test('lo stesso nome ripetuto avvisa una volta sola', () => {
  // 🚨 La copia locale tiene UNA RIGA PER GIOCATORE, ognuna con l'elenco intero: senza dedup
  // una partita di quattro manderebbe a ciascuno quattro volte lo stesso messaggio.
  assert.deepEqual(
    destinatari(['Maurizio Aprea', 'MAURIZIO  APREA', 'Lidia Comes']),
    ['Maurizio Aprea', 'Lidia Comes'],
  );
});

test('i nomi vuoti non producono destinatari', () => {
  assert.deepEqual(destinatari(['', '   ', null, undefined, 'Lidia Comes']), ['Lidia Comes']);
});

// ── Il campo scritto ─────────────────────────────────────────────────────────────────────

test('il numero nudo diventa la parola del gestionale', () => {
  assert.equal(campoScritto(2), 'Campo 2');
  assert.equal(campoScritto('2'), 'Campo 2');
});

test('un campo già scritto non si riscrive', () => {
  assert.equal(campoScritto('Campo 2'), 'Campo 2');
  assert.equal(campoScritto(''), '');
});

// ── Lo spostamento ───────────────────────────────────────────────────────────────────────

const PARTENZA = { data: '2026-08-31', ora: '09:30', campo: 'Campo 1' };
const ARRIVO = { data: '2026-08-31', ora: '11:00', campo: 'Campo 1' };

test('uno spostamento parla a tutti quelli in campo, con le coordinate di ARRIVO', () => {
  const fatti = fattiDaSpostamento({
    partenza: PARTENZA,
    arrivo: ARRIVO,
    roster: ['Maurizio Aprea', 'Lidia Comes'],
    tipo: 'Partita',
  });
  assert.equal(fatti.length, 2);
  for (const f of fatti) {
    assert.equal(f.gesto, 'spostata');
    assert.equal(f.ora, '11:00', 'le coordinate del fatto sono quelle nuove: è lì che si gioca');
    assert.deepEqual(f.da, PARTENZA, 'e `da` dice da dove, perché il socio la ricorda com\'era');
    assert.equal(f.tipo, 'partita');
  }
});

test('la chiave dello slot è quella del sync, o dedup e quiete non riconoscono niente', () => {
  const [f] = fattiDaSpostamento({
    partenza: PARTENZA, arrivo: ARRIVO, roster: ['Maurizio Aprea'],
  });
  assert.equal(f.slot, chiaveSlot(ARRIVO.data, ARRIVO.ora, ARRIVO.campo));
  assert.equal(f.slot, '2026-08-31|11:00|1', 'il campo tenuto in cifre: «Campo 1» e «1» sono lo stesso slot');
});

test('una LEZIONE si dice lezione, con la parola del gestionale', () => {
  const [f] = fattiDaSpostamento({
    partenza: PARTENZA, arrivo: ARRIVO, roster: ['Maria Pia Bettiol'], tipo: 'Lezione Libera',
  });
  assert.equal(f.tipo, 'lezione', 'e MAI «Lezione Libera», che è una parola di Matchpoint');
});

test('🚨 senza coordinate non si dichiara niente: meglio tacere che scrivere un messaggio monco', () => {
  assert.deepEqual(
    fattiDaSpostamento({ partenza: PARTENZA, arrivo: { data: '', ora: '', campo: '' }, roster: ['Maurizio Aprea'] }),
    [],
  );
  assert.deepEqual(
    fattiDaSpostamento({ partenza: { data: '', ora: '', campo: '' }, arrivo: ARRIVO, roster: ['Maurizio Aprea'] }),
    [],
  );
});

test('un roster di soli Ospiti non produce fatti', () => {
  assert.deepEqual(
    fattiDaSpostamento({ partenza: PARTENZA, arrivo: ARRIVO, roster: ['Ospite', 'Ospite'] }),
    [],
  );
});

// ── L'annullo ────────────────────────────────────────────────────────────────────────────

test('un annullo parla a TUTTI: avvisarne uno solo manda gli altri al campo per niente', () => {
  const fatti = fattiDaAnnullo({
    slot: PARTENZA,
    roster: ['Maurizio Aprea', 'Lidia Comes', 'Ospite', 'Mauro Schincariol'],
    tipo: 'Partita',
  });
  assert.equal(fatti.length, 3, 'i tre con una scheda, non l\'Ospite');
  for (const f of fatti) {
    assert.equal(f.gesto, 'annullata');
    assert.equal(f.data, PARTENZA.data);
    assert.equal(f.ora, PARTENZA.ora);
    assert.equal(f.da, undefined, '`da` esiste solo su uno spostamento');
  }
});

test('senza data non si dichiara un annullo', () => {
  assert.deepEqual(fattiDaAnnullo({ slot: { data: '', ora: '09:30', campo: 'Campo 1' }, roster: ['Maurizio Aprea'] }), []);
});

console.log('\n✅ fatti-da-conferma: tutte le prove passate');
