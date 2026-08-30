// VOCE 80 — chi è stato tolto dalla segreteria non resta in campo per due minuti.
//
// ⭐ Quello che questi casi difendono non è un'aritmetica: è che il ponte legga un FATTO del
// gestionale invece di dedurre da quale lista fidarsi. Se un giorno qualcuno «semplificasse»
// tornando al confronto fra liste, il caso ⑤ diventa rosso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chiaveDelloSlot, mappaIdReserva, rimozioniDaStaffEdit, rimossiDopoIlSync, togliRimossi,
} from './rimozioni-recenti.ts';
import { normName } from './compagni-slot.ts';

const SLOT = '2026-09-04|19:00|2';
const SYNC = '2026-09-04T10:00:00.000Z';
const DOPO = '2026-09-04T10:02:00.000Z';
const PRIMA = '2026-09-04T09:58:00.000Z';

const booking = (idr: string) => ({
  payload: { idReserva: idr, data: '2026-09-04', ora: '19:00', campo: 'Campo 2' },
});
const edit = (p: Record<string, unknown>, quando = DOPO) => ({ payload: p, synced_at: quando });

// ── ① La chiave, con la convenzione del readmodel ─────────────────────────────────────

test('la chiave dello slot usa le cifre del campo, comunque sia scritto', () => {
  assert.equal(chiaveDelloSlot('2026-09-04', '19:00', 'Campo 2'), SLOT);
  assert.equal(chiaveDelloSlot('2026-09-04', '19:00', 2), SLOT, 'il numero nudo di `da.campo`');
  assert.equal(chiaveDelloSlot('2026-09-04', '19:00', ''), '', 'senza campo non si inventa');
});

// ── ② L'aggancio: DUE grafie, e la seconda strada ─────────────────────────────────────

test('🚨 `idReserva` e `id_reserva` si leggono TUTT\'E DUE', () => {
  // booking scrive `idReserva`, staff_booking scrive `id_reserva`: leggerne una sola perde
  // le copie nostre, e non lo direbbe nessuno.
  const m = mappaIdReserva([
    booking('9649'),
    { payload: { id_reserva: '7777', data: '2026-09-05', ora: '10:00', campo: 'Campo 3' } },
  ]);
  assert.equal(m.get('9649'), SLOT);
  assert.equal(m.get('7777'), '2026-09-05|10:00|3');
});

test('⭐ si aggancia per `idReserva` (89%) e, quando manca, per `da` (37%)', () => {
  const m = mappaIdReserva([booking('9649')]);
  const perIdr = rimozioniDaStaffEdit([edit({ idReserva: '9649', players: { remove: ['Ospite'] } })], m);
  assert.deepEqual(perIdr.map((r) => r.slot), [SLOT], 'non ha agganciato per idReserva');

  const perDa = rimozioniDaStaffEdit([edit({
    da: { data: '2026-09-04', ora: '19:00', campo: 2 }, players: { remove: ['Lidia Comes'] },
  })], new Map());
  assert.deepEqual(perDa.map((r) => r.slot), [SLOT], 'non ha agganciato per `da`');
});

test('⛔ senza aggancio non si produce NIENTE: si torna al comportamento di oggi', () => {
  const orfane = rimozioniDaStaffEdit([
    edit({ idReserva: '0000', players: { remove: ['Ospite'] } }),          // idReserva sconosciuto
    edit({ players: { remove: ['Ospite'] } }),                              // né idReserva né da
    edit({ idReserva: '9649', players: { remove: ['Ospite'] } }, ''),      // senza istante
    edit({ idReserva: '9649', players: { add: [{ nome: 'Tizio' }] } }),    // è un'aggiunta
  ], mappaIdReserva([booking('9649')]));
  assert.deepEqual(orfane, [], 'ha inventato una rimozione');
});

// ── ③ La finestra, che si chiude da sé ────────────────────────────────────────────────

test('⭐ vale solo DOPO l\'ultimo sync: passato quello, la verità è del circolo', () => {
  const m = mappaIdReserva([booking('9649')]);
  const dopo = rimozioniDaStaffEdit([edit({ idReserva: '9649', players: { remove: ['Ospite'] } }, DOPO)], m);
  const prima = rimozioniDaStaffEdit([edit({ idReserva: '9649', players: { remove: ['Ospite'] } }, PRIMA)], m);
  assert.deepEqual(rimossiDopoIlSync(dopo, SLOT, SYNC), ['Ospite']);
  assert.deepEqual(rimossiDopoIlSync(prima, SLOT, SYNC), [], 'corregge un dato già aggiornato');
});

test('⛔ senza sapere QUANDO il circolo ha parlato non si toglie nessuno', () => {
  const m = mappaIdReserva([booking('9649')]);
  const r = rimozioniDaStaffEdit([edit({ idReserva: '9649', players: { remove: ['Ospite'] } })], m);
  assert.deepEqual(rimossiDopoIlSync(r, SLOT, null), [], '`aggiornato_al` nullo ha tolto qualcuno');
  assert.deepEqual(rimossiDopoIlSync(r, 'altro|slot|9', SYNC), [], 'ha toccato un altro slot');
});

// ── ④ La trappola vera: per OCCORRENZA, non per nome ──────────────────────────────────

test('🚨⭐⭐ `remove: ["Ospite"]` toglie UN ospite, non tutti e tre', () => {
  // «Ospite» non è un nome, è un ruolo: tre ospiti non sono la stessa persona tre volte.
  // Togliere per nome svuoterebbe di tre una partita da cui è uscita una persona — e il verso
  // dell'errore sarebbe il peggiore: «vi manca il quarto» a chi ha il campo pieno.
  const dopo = togliRimossi(['Maurizio Aprea', 'Ospite', 'Ospite', 'Ospite'], ['Ospite'], normName);
  assert.deepEqual(dopo, ['Maurizio Aprea', 'Ospite', 'Ospite']);
});

test('due rimozioni dello stesso ruolo ne tolgono due', () => {
  const dopo = togliRimossi(['Ospite', 'Ospite', 'Ospite'], ['Ospite', 'Ospite'], normName);
  assert.deepEqual(dopo, ['Ospite']);
});

test('il confronto è quello del readmodel: accenti e maiuscole non contano', () => {
  assert.deepEqual(togliRimossi(['Gianluca Spinazzè'], ['gianluca spinazze'], normName), []);
});

test('⛔ a rimozioni zero la lista torna IDENTICA — la cura non esiste', () => {
  const lista = ['Maurizio Aprea', 'Lidia Comes'];
  assert.equal(togliRimossi(lista, [], normName), lista, 'ha ricostruito la lista per niente');
});

test('un nome che non c\'è non toglie nessun altro al suo posto', () => {
  const dopo = togliRimossi(['Maurizio Aprea', 'Lidia Comes'], ['Fabiola Limuti'], normName);
  assert.deepEqual(dopo, ['Maurizio Aprea', 'Lidia Comes']);
});

// ── ⑤ Il caso della VOCE, dal fatto al roster ─────────────────────────────────────────

test('🚨⭐⭐ IL CASO DELLA 80: l\'ospite tolto sparisce PRIMA che passi il sync', () => {
  // 📏 Il fatto misurato il 23/08: tolto alle 21:25:48, il bot lo mostrava ancora alle 21:27:22,
  // sparito solo col sync delle 21:27:53. Qui la finestra è attraversata e non mente più.
  const rows = [booking('9649')];
  const m = mappaIdReserva(rows);
  const rimozioni = rimozioniDaStaffEdit(
    [edit({ idReserva: '9649', players: { remove: ['Ospite'] } }, '2026-09-04T10:25:48.000Z')], m,
  );
  const sync = '2026-09-04T10:24:00.000Z';   // il circolo ha parlato PRIMA della rimozione
  const rimossi = rimossiDopoIlSync(rimozioni, SLOT, sync);
  const rosterStantio = ['Maurizio Aprea', 'Benso Zanchetta', 'Ospite'];
  assert.deepEqual(
    togliRimossi(rosterStantio, rimossi, normName),
    ['Maurizio Aprea', 'Benso Zanchetta'],
    'il fantasma è ancora in campo',
  );
  // ⭐ E la controprova che tiene onesta la cura: col sync ATTERRATO DOPO, non si tocca niente.
  const syncFresco = '2026-09-04T10:27:53.000Z';
  assert.deepEqual(
    togliRimossi(rosterStantio, rimossiDopoIlSync(rimozioni, SLOT, syncFresco), normName),
    rosterStantio,
    'corregge un dato che il circolo ha già aggiornato',
  );
});

// ── ⑥ L'OROLOGIO GIUSTO — il difetto che solo la prova fisica ha visto ────────────────

import { istanteDelCircolo } from './rimozioni-recenti.ts';
import { copiaNostra } from './compagni-slot.ts';

test('🚨⭐⭐ IL CASO VERO DEL 30/08: la copia NOSTRA non fa da orologio del circolo', () => {
  // 📏 Le tre righe come stavano davvero quando la prova è fallita. La copia nostra è scritta
  // dalla STESSA operazione che produce la rimozione, sempre un istante dopo ⇒ usando il
  // massimo di tutte le righe la cura non avrebbe morso MAI.
  const righe = [
    { record_type: 'booking',       synced_at: '2026-08-30T21:10:04.952Z' },
    { record_type: 'staff_booking', synced_at: '2026-08-30T21:12:14.778Z' },
  ];
  const rimozione = '2026-08-30T21:12:12.831Z';

  const circolo = istanteDelCircolo(righe, copiaNostra);
  assert.equal(circolo, '2026-08-30T21:10:04.952Z', 'ha preso l\'istante della copia nostra');
  assert.ok(rimozione > (circolo as string), 'la rimozione deve risultare PIÙ RECENTE del circolo');

  // ⚖️ E il controllo del metro: col massimo di TUTTE le righe il caso torna a fallire.
  const tutte = righe.map((r) => r.synced_at).sort().at(-1) as string;
  assert.ok(rimozione < tutte, 'il metro sbagliato non produce più il difetto: il caso non prova niente');
});

test('senza nessuna riga del circolo l\'istante è null — e allora non si toglie nessuno', () => {
  const soloNostre = [{ record_type: 'staff_booking', synced_at: '2026-08-30T21:12:14.778Z' }];
  assert.equal(istanteDelCircolo(soloNostre, copiaNostra), null);
  // ⇒ `rimossiDopoIlSync` con null torna [], che è il fallire chiuso già provato sopra.
  assert.deepEqual(rimossiDopoIlSync(
    [{ slot: SLOT, nome: 'Ospite', quando: DOPO }], SLOT, istanteDelCircolo(soloNostre, copiaNostra),
  ), []);
});
