// Prove del modulo che traduce una CONFERMA del circolo in fatti per il socio (voce 76).
// Esegui:  node supabase/functions/_shared/fatti-da-conferma.test.ts
import assert from 'node:assert/strict';
import { campoScritto, destinatari, fattiDaAnnullo, fattiDaCambioRoster, fattiDaSpostamento, oggiRoma } from './fatti-da-conferma.ts';
import { chiaveSlot, fattiDaConfronto } from '../matchpoint-bookings-sync/eventi-staff.ts';

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

// ── 👥 IL CAMBIO DI GIOCATORI DICHIARATO DALLA CONFERMA (31/08/2026) ─────────────────────
//
// 🗣️ Nasce da una sua frase davanti al primo avviso della voce 79: *«ha funzionato però ci ha
// messo parecchio tempo»*. La strada veloce esisteva (voce 76) ma copriva solo annullo e
// spostamento; il cambio di giocatori — il gesto più frequente — aspettava il sync.

const SLOT = { data: '2026-09-07', ora: '11:00', campo: 'Campo 3' };
const OGGI = '2026-09-01';

test('👥 chi entra, chi esce e chi resta: gli stessi tre fatti che direbbe il sync', () => {
  const fatti = fattiDaCambioRoster({
    slot: SLOT,
    prima: ['Maurizio Aprea', 'Marco Rossi'],
    dopo: ['Maurizio Aprea', 'Lidia Comes'],
    tipo: 'Partita',
    oggi: OGGI,
  });
  assert.deepEqual(
    fatti.map((f) => `${f.gesto}:${f.persona}`).sort(),
    ['aggiunto:Lidia Comes', 'formazione:Maurizio Aprea', 'tolto:Marco Rossi'],
  );
  const resta = fatti.find((f) => f.gesto === 'formazione')!;
  assert.deepEqual(resta.entrati, ['Lidia Comes']);
  assert.deepEqual(resta.usciti, ['Marco Rossi']);
  assert.equal(resta.tipo, 'partita');
});

test('👥⭐ NON è una seconda copia della regola: è la stessa funzione del sync', () => {
  // 📌 La sonda che protegge la scelta, non il risultato: se un domani qualcuno riscrivesse
  // qui la regola «a mano», questo caso resterebbe verde ma le due verità comincerebbero a
  // divergere. ⇒ Si confronta con `fattiDaConfronto` chiamata direttamente sulle stesse due
  // fotografie: devono dare la STESSA cosa, non una cosa equivalente.
  const uno = (roster: string[]) => new Map([[
    chiaveSlot(SLOT.data, SLOT.ora, SLOT.campo),
    { slot: chiaveSlot(SLOT.data, SLOT.ora, SLOT.campo), ...SLOT, roster, tipo: 'Partita' },
  ]]);
  const daConferma = fattiDaCambioRoster({
    slot: SLOT, prima: ['Maurizio Aprea', 'Ospite'], dopo: ['Maurizio Aprea', 'Ospite', 'Ospite'],
    tipo: 'Partita', oggi: OGGI,
  });
  const dalSync = fattiDaConfronto(uno(['Maurizio Aprea', 'Ospite']), uno(['Maurizio Aprea', 'Ospite', 'Ospite']), OGGI);
  assert.deepEqual(daConferma, dalSync);
});

test('👥 l\'ospite aggiunto: un fatto solo, per chi resta — il caso della voce 79', () => {
  const fatti = fattiDaCambioRoster({
    slot: SLOT, prima: ['Maurizio Aprea'], dopo: ['Maurizio Aprea', 'Ospite'], tipo: 'Partita', oggi: OGGI,
  });
  assert.equal(fatti.length, 1);
  assert.equal(fatti[0].gesto, 'formazione');
  assert.equal(fatti[0].persona, 'Maurizio Aprea');
  assert.deepEqual(fatti[0].entrati, ['Ospite']);
});

test('🚨 un «dopo» VUOTO non svuota la partita: è una lettura mozza, non un annullo', () => {
  // ⚖️ Il sync ha `confrontoAttendibile` contro il crollo; qui la stessa prudenza costa una
  // riga. Senza, un worker che risponde monco manderebbe «non sei più nella partita» a tutti.
  assert.deepEqual(
    fattiDaCambioRoster({ slot: SLOT, prima: ['Maurizio Aprea', 'Lidia Comes'], dopo: [], oggi: OGGI }),
    [],
  );
  assert.deepEqual(
    fattiDaCambioRoster({ slot: SLOT, prima: [], dopo: ['Maurizio Aprea'], oggi: OGGI }),
    [],
  );
});

test('🚨 e una partita GIÀ GIOCATA non produce niente: la finestra è quella del sync', () => {
  assert.deepEqual(
    fattiDaCambioRoster({
      slot: { data: '2026-08-01', ora: '11:00', campo: 'Campo 3' },
      prima: ['Maurizio Aprea', 'Lidia Comes'], dopo: ['Maurizio Aprea'], oggi: OGGI,
    }),
    [],
  );
});

test('⏱️ `oggiRoma` dà una data leggibile e non l\'orologio di chi la chiama', () => {
  assert.match(oggiRoma(), /^\d{4}-\d{2}-\d{2}$/);
});
