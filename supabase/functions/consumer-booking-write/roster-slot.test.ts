// Chi gioca davvero in uno slot — test deterministici, nessuna dipendenza esterna.
// Esegui:  node supabase/functions/consumer-booking-write/roster-slot.test.ts
//
// ⭐ I casi 1, 2 e 3 NON sono inventati: sono i payload VERI letti da PROD il 26/07 in sola
// lettura. Portare i dati veri alla funzione pura è il modo di provare una forma di dato che
// l'ambiente di TEST non contiene — là quella partita non ha la riga che causa il difetto.
import assert from 'node:assert/strict';
import {
  playersFromDescrizione,
  rosterDaPayload,
  rosterDelloSlot,
  sostituito,
  normName,
  type RigaSlot,
} from './roster-slot.ts';

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

const MAX = 4;
const rigaDa = (payload: Record<string, unknown>): RigaSlot => ({
  roster: rosterDaPayload(payload),
  descrizione: (payload.descrizione ?? null) as string | null,
});
const nomi = (m: Map<string, string>) => [...m.values()].sort();
const varianti = (...n: string[]) => new Set(n.map(normName));

// ── I dati VERI di PROD ───────────────────────────────────────────────────────────────────
// Slot 27/07 13:00 campo 3 — 6 righe, le due copie discordano.
const DESCR_CIRCOLO = '-Valeria Moschet.-Silvia Balzarini.-Giorgia Eporti.-Pierangela Barbera.';
const SLOT_DISCORDE: RigaSlot[] = [
  // 4 righe sincronizzate dal circolo, aggiornate il 26/07 alle 11:17. Una per giocatrice:
  // è la prova che «l'organizzatore» non esiste nel dato — nessuna riga è l'intestataria.
  rigaDa({ giocatore: 'Pierangela Barbera', giocatori: null, descrizione: DESCR_CIRCOLO }),
  rigaDa({ giocatore: 'Valeria Moschet', giocatori: null, descrizione: DESCR_CIRCOLO }),
  rigaDa({ giocatore: 'Giorgia Eporti', giocatori: null, descrizione: DESCR_CIRCOLO }),
  rigaDa({
    giocatore: 'Silvia Balzarini', descrizione: DESCR_CIRCOLO,
    giocatori: ['Valeria Moschet', 'Silvia Balzarini', 'Giorgia Eporti', 'Pierangela Barbera'],
  }),
  // 2 righe della NOSTRA copia in app, ferme al 20/07: elencano Federica Da Rios, che è stata
  // sostituita da Pierangela Barbera. Nessuna descrizione (il campo non esiste sugli staff_booking).
  rigaDa({
    nome: 'Valeria Moschet, Federica Da Rios, Silvia Balzarini, Giorgia',
    giocatori: [
      { nome: 'Valeria Moschet', codice: '' }, { nome: 'Federica Da Rios', codice: '' },
      { nome: 'Silvia Balzarini', codice: '' }, { nome: 'Giorgia Eporti', codice: '' },
    ],
  }),
  rigaDa({
    nome: 'Valeria Moschet, Federica Da Rios, Silvia Balzarini, Giorgia',
    giocatori: [
      { nome: 'Valeria Moschet', codice: '', codiceCliente: '000182' },
      { nome: 'Federica Da Rios', codice: '', codiceCliente: '000073' },
      { nome: 'Silvia Balzarini', codice: '', codiceCliente: '000342' },
      { nome: 'Giorgia Eporti', codice: '', codiceCliente: '000028' },
    ],
  }),
];

test('1) caso VERO di PROD: le copie discordano → vincono i quattro della scheda del circolo', () => {
  const e = rosterDelloSlot(SLOT_DISCORDE, MAX);
  assert.equal(e.incoerente, false, 'non deve più fermarsi');
  assert.equal(e.fonte, 'circolo');
  assert.deepEqual(nomi(e.roster),
    ['Giorgia Eporti', 'Pierangela Barbera', 'Silvia Balzarini', 'Valeria Moschet']);
  // La sostituita resta FUORI, ed è tutto il punto della decisione.
  assert.ok(!nomi(e.roster).includes('Federica Da Rios'));
  // …ma l'unione la conosce ancora: serve a distinguere «sostituita» da «mai stata qui».
  assert.equal(e.unione.size, 5);
  assert.ok(nomi(e.unione).includes('Federica Da Rios'));
});

test('2) caso VERO di PROD: lo slot con un «Ospite» NON viene toccato', () => {
  // 26/07 16:00 campo 3: la nostra lettura dà 3 nomi, la scheda del circolo ne dà 4 perché
  // include «Ospite». Sotto i quattro NON si consulta la scheda: cambiare qui vorrebbe dire
  // cambiare di rimbalzo anche gli avvisi, che oggi funzionano. 4 slot su 88 sono così.
  const D = '-Debora Barbarito.-federica dan.-Massimiliano Triches.-Ospite.';
  const slot: RigaSlot[] = [
    rigaDa({ giocatore: 'Debora Barbarito', descrizione: D }),
    rigaDa({ giocatore: 'federica dan', descrizione: D }),
    rigaDa({ giocatore: 'Massimiliano Triches', descrizione: D }),
  ];
  const e = rosterDelloSlot(slot, MAX);
  assert.equal(e.fonte, 'nostra');
  assert.equal(e.roster.size, 3, 'l’Ospite della scheda non deve entrare');
});

test('3) caso VERO di PROD: uno slot sano resta identico, e la scheda non viene guardata', () => {
  // Se il codice consultasse SEMPRE la scheda questo test cadrebbe: la descrizione qui dice
  // apposta una cosa diversa dalle righe.
  const slot: RigaSlot[] = [
    rigaDa({ giocatore: 'Anna Bianchi', descrizione: '-Qualcun Altro.-Un Altro Ancora.' }),
    rigaDa({ giocatore: 'Bruno Conti', descrizione: '-Qualcun Altro.-Un Altro Ancora.' }),
  ];
  const e = rosterDelloSlot(slot, MAX);
  assert.equal(e.fonte, 'nostra');
  assert.deepEqual(nomi(e.roster), ['Anna Bianchi', 'Bruno Conti']);
});

test('4) la scheda del circolo deve dare ESATTAMENTE quattro, non «al massimo»', () => {
  // Cinque nella nostra lettura, tre nella scheda: la discordanza è troppo grande per
  // fidarsi. Prenderne tre non è «prendere i quattro giusti», è indovinare ⇒ ci si ferma.
  const D = '-Uno Rossi.-Due Rossi.-Tre Rossi.';
  const slot: RigaSlot[] = [
    rigaDa({ giocatori: ['Uno Rossi', 'Due Rossi', 'Tre Rossi', 'Quattro Rossi', 'Cinque Rossi'], descrizione: D }),
  ];
  const e = rosterDelloSlot(slot, MAX);
  assert.equal(e.incoerente, true);
  assert.equal(e.roster.size, 0, 'un roster incoerente non deve offrire nessun nome');
});

test('5) sfora e la scheda del circolo NON c’è → ci si ferma come prima', () => {
  const slot: RigaSlot[] = [
    rigaDa({ giocatori: [{ nome: 'Uno Rossi' }, { nome: 'Due Rossi' }, { nome: 'Tre Rossi' }, { nome: 'Quattro Rossi' }] }),
    rigaDa({ giocatori: [{ nome: 'Cinque Rossi' }] }),
  ];
  const e = rosterDelloSlot(slot, MAX);
  assert.equal(e.incoerente, true);
});

test('6) sfora e la scheda è un TITOLO libero, non una lista → ci si ferma', () => {
  // Una descrizione che non inizia per «-» non è un roster: è il nome di un torneo o una nota.
  const slot: RigaSlot[] = [
    rigaDa({
      giocatori: ['Uno Rossi', 'Due Rossi', 'Tre Rossi', 'Quattro Rossi', 'Cinque Rossi'],
      descrizione: 'Torneo sociale. Girone A. Semifinale.',
    }),
  ];
  assert.equal(rosterDelloSlot(slot, MAX).incoerente, true);
});

test('7) il confine si prova da tutt’e due i versi: 4 non consulta la scheda, 5 sì', () => {
  const D = '-Uno Rossi.-Due Rossi.-Tre Rossi.-Quattro Rossi.';
  const quattro = [rigaDa({ giocatori: ['Uno Rossi', 'Due Rossi', 'Tre Rossi', 'Quattro Rossi'], descrizione: D })];
  const cinque = [rigaDa({ giocatori: ['Uno Rossi', 'Due Rossi', 'Tre Rossi', 'Quattro Rossi', 'Cinque Rossi'], descrizione: D })];
  assert.equal(rosterDelloSlot(quattro, MAX).fonte, 'nostra');
  assert.equal(rosterDelloSlot(cinque, MAX).fonte, 'circolo');
  assert.equal(rosterDelloSlot(cinque, MAX).roster.size, 4);
});

test('8) chi è stato SOSTITUITO si riconosce, e non si confonde con chi non c’è mai stato', () => {
  const e = rosterDelloSlot(SLOT_DISCORDE, MAX);
  assert.equal(sostituito(e, varianti('Federica Da Rios')), true, 'Federica è nella nostra copia, non nella scheda');
  assert.equal(sostituito(e, varianti('Pierangela Barbera')), false, 'Pierangela gioca: non è sostituita');
  assert.equal(sostituito(e, varianti('Mario Rossi')), false, 'un estraneo non è «sostituito»');
});

test('9) su uno slot sano nessuno è «sostituito» (la scheda non è stata usata)', () => {
  const slot: RigaSlot[] = [rigaDa({ giocatore: 'Anna Bianchi', descrizione: '-Anna Bianchi.' })];
  const e = rosterDelloSlot(slot, MAX);
  assert.equal(sostituito(e, varianti('Chiunque Altro')), false);
});

test('10) il «nome» dello staff_booking è un RIPIEGO, mai un giocatore in più', () => {
  // Con `giocatori` valorizzato, il campo troncato non deve entrare: era il quinto fantasma.
  const conGiocatori = rosterDaPayload({
    nome: 'Aldo Bianchi, Bruna Conti, Nicola St',
    giocatori: [{ nome: 'Aldo Bianchi' }, { nome: 'Bruna Conti' }, { nome: 'Nicola Stella' }],
  });
  assert.deepEqual(conGiocatori, ['Aldo Bianchi', 'Bruna Conti', 'Nicola Stella']);
  // Senza altra fonte è l'unico roster che si ha, e va spezzato sulle virgole.
  const soloNome = rosterDaPayload({ nome: 'Aldo Bianchi, Bruna Conti, Nicola St' });
  assert.deepEqual(soloNome, ['Aldo Bianchi', 'Bruna Conti', 'Nicola St']);
  // Il caso per cui il ripiego esiste: uno `staff_booking` a un giocatore solo.
  assert.deepEqual(rosterDaPayload({ nome: 'Aldo Bianchi' }), ['Aldo Bianchi']);
});

test('11) le tre forme del roster di una riga si leggono tutte', () => {
  assert.deepEqual(rosterDaPayload({ giocatori: [{ nome: 'Uno Rossi' }] }), ['Uno Rossi']);
  assert.deepEqual(rosterDaPayload({ giocatori: ['Uno Rossi'] }), ['Uno Rossi']);
  assert.deepEqual(rosterDaPayload({ giocatore: 'Uno Rossi' }), ['Uno Rossi']);
  assert.deepEqual(rosterDaPayload({}), []);
});

test('12) playersFromDescrizione resta identica alla regola del sync', () => {
  assert.deepEqual(playersFromDescrizione('-Uno Rossi.-Due Rossi.'), ['Uno Rossi', 'Due Rossi']);
  assert.deepEqual(playersFromDescrizione('Torneo sociale'), []);
  assert.deepEqual(playersFromDescrizione(''), []);
  assert.deepEqual(playersFromDescrizione(null), []);
});

test('13) la soglia arriva da FUORI, non è scritta qui dentro', () => {
  // Se qualcuno riscrivesse il 4 a mano nel modulo, questo cadrebbe.
  const slot = [rigaDa({ giocatori: ['A Rossi', 'B Rossi', 'C Rossi'], descrizione: '-A Rossi.-B Rossi.' })];
  assert.equal(rosterDelloSlot(slot, 2).fonte, 'circolo', 'con soglia 2, tre giocatori sforano');
  assert.equal(rosterDelloSlot(slot, 2).roster.size, 2);
  assert.equal(rosterDelloSlot(slot, 3).fonte, 'nostra', 'con soglia 3, tre giocatori vanno bene');
});

test('14) l’ORDINE delle righe non conta: la scheda si cerca su tutte, non sulla prima', () => {
  // 🚨 Caso nato da un sabotaggio rimasto VERDE. Il caso vero non lo discriminava: lì la
  // prima riga è per caso una di quelle sincronizzate, che la scheda ce l'ha. Ma le righe
  // arrivano dal database senza un ordine garantito — se davanti finisse la copia in app,
  // che la descrizione non ce l'ha nemmeno come campo, leggere solo la prima darebbe zero
  // nomi e si tornerebbe a fermarsi. Qui le stesse sei righe, in ordine rovesciato.
  const rovesciato = [...SLOT_DISCORDE].reverse();
  assert.equal(rovesciato[0].descrizione, null, 'il caso vale solo se davanti c’è una riga senza scheda');
  const e = rosterDelloSlot(rovesciato, MAX);
  assert.equal(e.incoerente, false);
  assert.equal(e.fonte, 'circolo');
  assert.deepEqual(nomi(e.roster),
    ['Giorgia Eporti', 'Pierangela Barbera', 'Silvia Balzarini', 'Valeria Moschet']);
});

console.log(`\n${passed} passati, ${failed} falliti`);
if (failed > 0) process.exit(1);
