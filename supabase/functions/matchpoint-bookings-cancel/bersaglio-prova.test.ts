// Chi spegne l'annullamento di una partita DI PROVA — casi deterministici, senza database.
// Esegui:  node supabase/functions/matchpoint-bookings-cancel/bersaglio-prova.test.ts
//
// 🚨⭐⭐ QUESTO BANCO NASCE DA UN DIFETTO CHE UN ALTRO BANCO NON POTEVA VEDERE (7/08/2026).
// C'era già un caso che misurava «nel ramo di prova si chiama spegniPartiteDiProvaSulloSlot»:
// verde, e giusto — ma misurava la STRUTTURA, non la RESA. La funzione veniva chiamata e non
// trovava niente, perché cercava per slot mentre il bot manda solo l'`idReserva`.
// ⇒ Il difetto è uscito alla prima prova dal vivo: «annullata», e la partita ancora in elenco.
import assert from 'node:assert/strict';
import { righeDiProvaDaSpegnere, type RigaStaffBooking } from './bersaglio-prova.ts';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`ok   - ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL - ${name}\n       ${(e as Error).message}`);
  }
}

const diProva = (over: Record<string, unknown> = {}): RigaStaffBooking => ({
  local_key: `staff_booking|${over.data ?? '2026-08-08'}|${over.ora ?? '10:30'}|Campo ${over.campo ?? 2}|x`,
  payload: {
    data: '2026-08-08', ora: '10:30', campo: 2, nome: 'Maurizio Aprea',
    id_reserva: 'PROVA-aaa', nata_in_prova: true, ...over,
  },
});
const vera = (over: Record<string, unknown> = {}): RigaStaffBooking => ({
  local_key: `staff_booking|vera|${over.ora ?? '10:30'}`,
  payload: { data: '2026-08-08', ora: '10:30', campo: 2, id_reserva: '778899', ...over },
});

test('1) 🚨⭐⭐ per RIFERIMENTO — è la strada che il BOT percorre davvero', () => {
  // Il caso che mancava. Il ponte dei soci, quando la prenotazione ha un `idReserva`, manda
  // SOLO quello: niente data, niente ora, niente campo. E le partite di prova un `idReserva`
  // ce l'hanno per forza. Con la prima versione qui uscivano zero righe, e l'annullo diceva
  // «fatto» a vuoto.
  const righe = [diProva(), diProva({ id_reserva: 'PROVA-bbb', ora: '19:00', campo: 1 })];
  const spente = righeDiProvaDaSpegnere(righe, { idReserva: 'PROVA-bbb' });
  assert.equal(spente.length, 1);
  assert.equal(spente[0].payload.ora, '19:00', 'ha spento la partita sbagliata');
});

test('2) per SLOT — la strada dell\'app e di chi il riferimento non ce l\'ha', () => {
  const righe = [diProva(), diProva({ ora: '19:00', campo: 1, id_reserva: 'PROVA-bbb' })];
  const spente = righeDiProvaDaSpegnere(righe, { data: '2026-08-08', ora: '19:00', campo: 1 });
  assert.equal(spente.length, 1);
  assert.equal(spente[0].payload.id_reserva, 'PROVA-bbb');
});

test('3) 🚨🚨 una partita VERA non si tocca MAI, per nessuna delle due strade', () => {
  // ⛔ È il confine del pezzo: di prova si spegne solo ciò che è nato di prova. Una riga vera
  // la decide il giro di sincronizzazione, come sempre.
  const righe = [vera(), vera({ id_reserva: '778899' })];
  assert.equal(righeDiProvaDaSpegnere(righe, { idReserva: '778899' }).length, 0);
  assert.equal(righeDiProvaDaSpegnere(righe, { data: '2026-08-08', ora: '10:30', campo: 2 }).length, 0);
});

test('4) 🚨⭐⭐ senza NESSUNA chiave non si spegne niente (mai una pulizia generale)', () => {
  // Il verso del dubbio: un filtro che non filtra ridurrebbe a «tutte le partite di prova», e
  // un annullo diventerebbe una scopa. Meglio non spegnere nulla.
  const righe = [diProva(), diProva({ id_reserva: 'PROVA-bbb', ora: '19:00' })];
  assert.equal(righeDiProvaDaSpegnere(righe, {}).length, 0);
  assert.equal(righeDiProvaDaSpegnere(righe, { data: '2026-08-08' }).length, 0, 'terna incompleta');
  assert.equal(righeDiProvaDaSpegnere(righe, { ora: '10:30', campo: 2 }).length, 0, 'terna incompleta');
});

test('5) il riferimento VINCE sulla terna, e non si sommano', () => {
  // Se arrivano tutt'e due, comanda il riferimento: identifica una riga sola, la terna no
  // (sullo stesso slot possono esserci più righe).
  const righe = [
    diProva({ id_reserva: 'PROVA-aaa' }),
    diProva({ id_reserva: 'PROVA-bbb' }),
  ];
  const spente = righeDiProvaDaSpegnere(righe, { idReserva: 'PROVA-aaa', data: '2026-08-08', ora: '10:30', campo: 2 });
  assert.equal(spente.length, 1, 'con un riferimento si spegne UNA riga, non tutto lo slot');
});

test('6) il campo confrontato come TESTO: «2» e 2 sono lo stesso campo', () => {
  // 🚨 Nel payload il campo arriva a volte numero e a volte stringa (due strade lo scrivono).
  // Un confronto stretto avrebbe lasciato in piedi metà delle partite, in modo imprevedibile.
  const righe = [diProva({ campo: '2' })];
  assert.equal(righeDiProvaDaSpegnere(righe, { data: '2026-08-08', ora: '10:30', campo: 2 }).length, 1);
});

test('7) niente righe, nessun errore', () => {
  assert.equal(righeDiProvaDaSpegnere([], { idReserva: 'PROVA-aaa' }).length, 0);
});

console.log(`\n${passed} passati, ${failed} falliti`);
if (failed) process.exit(1);
