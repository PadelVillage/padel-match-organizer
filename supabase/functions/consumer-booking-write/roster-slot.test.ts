// Chi gioca davvero in uno slot — test deterministici, nessuna dipendenza esterna.
// Esegui:  node supabase/functions/consumer-booking-write/roster-slot.test.ts
//
// ⭐ I casi 1, 2 e 3 NON sono inventati: sono i payload VERI letti da PROD il 26/07 in sola
// lettura. Portare i dati veri alla funzione pura è il modo di provare una forma di dato che
// l'ambiente di TEST non contiene — là quella partita non ha la riga che causa il difetto.
import assert from 'node:assert/strict';
// Serve al caso 34: il test del COLLEGAMENTO legge il sorgente dell'edge per verificare che
// sia lui a chiedere il diritto, e non una copia della regola riscritta lì dentro.
import { readFileSync } from 'node:fs';
import {
  playersFromDescrizione,
  dirittoDiAnnullare,
  ePartitaLoSlot,
  giocatoriDelleListe,
  listeDaPayload,
  organizzatoreDelloSlot,
  restanoSoloOspiti,
  rosterDelloSlot,
  rosterOrdinatoDelloSlot,
  senzaDiMe,
  sostituito,
  normName,
  type RigaSlot,
  type RigaSlotTipata,
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
  liste: listeDaPayload(payload),
  descrizione: (payload.descrizione ?? null) as string | null,
});
const nomi = (r: string[] | Map<string, string>) =>
  (Array.isArray(r) ? [...r] : [...r.values()]).sort();
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

test('2) caso VERO di PROD: l’«Ospite» che sta SOLO nella scheda del circolo entra nel conteggio', () => {
  // 26/07 16:00 campo 3: la nostra copia dà 3 nomi, la scheda del circolo ne dà 4 perché
  // include «Ospite».
  // 🚨⭐⭐ QUESTO TEST DICEVA IL CONTRARIO fino al 27/07 («l’Ospite non deve entrare»), con la
  // motivazione «sotto i quattro non si consulta la scheda, cambiare qui cambierebbe di
  // rimbalzo gli avvisi». Quella motivazione è stata SUPERATA DAI FATTI: gli avvisi non
  // passano di qui — li calcola il readmodel, che dal 26/07 l’Ospite lo conta già. Le due
  // sedi dicevano quindi due numeri diversi sulla stessa partita, e la misura del 27/07 ha
  // mostrato che a rimetterci era il socio: 11 slot su 68 contati in difetto, 4 dei quali si
  // sentivano dire «sei solo» avendo il campo pieno.
  // ⭐ La decisione del committente (26/07) vale in tutt’e due le sedi: «Ospite è una persona
  // vera che verrà a giocare» ⇒ si conta.
  const D = '-Debora Barbarito.-federica dan.-Massimiliano Triches.-Ospite.';
  const slot: RigaSlot[] = [
    rigaDa({ giocatore: 'Debora Barbarito', descrizione: D }),
    rigaDa({ giocatore: 'federica dan', descrizione: D }),
    rigaDa({ giocatore: 'Massimiliano Triches', descrizione: D }),
  ];
  const e = rosterDelloSlot(slot, MAX);
  assert.equal(e.fonte, 'circolo', 'la nostra copia non dà una partita piena, la scheda sì');
  assert.equal(e.roster.length, 4, 'la partita è al completo: tre soci e un ospite');
  assert.ok(e.roster.includes('Ospite'));
  // ⚠️ Controllo che nessuno dei tre risulti «sostituito» solo perché ha vinto la scheda:
  // ci sono tutti, e dirgli il contrario sarebbe un vicolo cieco.
  for (const chi of ['Debora Barbarito', 'federica dan', 'Massimiliano Triches']) {
    assert.equal(sostituito(e, varianti(chi)), false, `${chi} gioca eccome`);
  }
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
  assert.equal(e.roster.length, 0, 'un roster incoerente non deve offrire nessun nome');
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
  assert.equal(rosterDelloSlot(cinque, MAX).roster.length, 4);
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
  const conGiocatori = listeDaPayload({
    nome: 'Aldo Bianchi, Bruna Conti, Nicola St',
    giocatori: [{ nome: 'Aldo Bianchi' }, { nome: 'Bruna Conti' }, { nome: 'Nicola Stella' }],
  });
  assert.deepEqual(conGiocatori, [['Aldo Bianchi', 'Bruna Conti', 'Nicola Stella']]);
  // Senza altra fonte è l'unico roster che si ha, e va spezzato sulle virgole.
  const soloNome = listeDaPayload({ nome: 'Aldo Bianchi, Bruna Conti, Nicola St' });
  assert.deepEqual(soloNome, [['Aldo Bianchi', 'Bruna Conti', 'Nicola St']]);
  // Il caso per cui il ripiego esiste: uno `staff_booking` a un giocatore solo.
  assert.deepEqual(listeDaPayload({ nome: 'Aldo Bianchi' }), [['Aldo Bianchi']]);
});

test('11) le tre forme del roster di una riga si leggono tutte', () => {
  assert.deepEqual(listeDaPayload({ giocatori: [{ nome: 'Uno Rossi' }] }), [['Uno Rossi']]);
  assert.deepEqual(listeDaPayload({ giocatori: ['Uno Rossi'] }), [['Uno Rossi']]);
  assert.deepEqual(listeDaPayload({ giocatore: 'Uno Rossi' }), [['Uno Rossi']]);
  assert.deepEqual(listeDaPayload({}), []);
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
  assert.equal(rosterDelloSlot(slot, 2).roster.length, 2);
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

// ── I casi del 27/07: il conteggio in difetto ─────────────────────────────────────────────
// ⭐ Tutti e tre i primi sono payload VERI letti da PROD il 27/07 in sola lettura, e sono i
// due estremi della misura: quelli contati male e quelli contati bene. Una batteria fatta di
// soli «deve sbagliare» sarebbe superata anche da un codice che gonfia sempre a quattro.

test('15) caso VERO di PROD: TRE «Ospite» sono tre persone, non la stessa tre volte', () => {
  // 27/07 21:00 campi 1-4, Massimiliano Triches: una riga sola, l’elenco `giocatori` ce li ha
  // tutti. Prima del 27/07 uscivano DUE giocatori (l’unione per nome li fondeva) e il socio
  // avrebbe letto «restano in campo 1» mentre in campo restavano tre.
  const D = '-Massimiliano Triches.-Ospite.-Ospite.-Ospite.';
  const slot: RigaSlot[] = [rigaDa({
    giocatore: 'Massimiliano Triches',
    giocatori: ['Massimiliano Triches', 'Ospite', 'Ospite', 'Ospite'],
    descrizione: D,
  })];
  const e = rosterDelloSlot(slot, MAX);
  assert.equal(e.roster.length, 4, 'quattro persone in campo');
  assert.equal(e.roster.filter((n) => n === 'Ospite').length, 3, 'tre ospiti distinti');
  // ⭐ La nostra copia bastava: la scheda non è dovuta intervenire. Distinguere i due percorsi
  // conta — un «4» ottenuto dalla scheda nasconderebbe che il conteggio nostro è ancora rotto.
  assert.equal(e.fonte, 'nostra');
});

test('16) l’intestatario NON raddoppia: `giocatore` e `giocatori` sono liste separate', () => {
  // 🚨 È il motivo per cui le liste non si concatenano mai. Concatenandole, Triches comparirebbe
  // due volte e la partita ne conterebbe cinque — cioè il difetto opposto, che fa scattare la
  // rete del «mai più di quattro» e blocca un socio che invece poteva uscire.
  const slot: RigaSlot[] = [rigaDa({
    giocatore: 'Uno Rossi',
    giocatori: ['Uno Rossi', 'Due Rossi', 'Tre Rossi', 'Quattro Rossi'],
  })];
  const e = rosterDelloSlot(slot, MAX);
  assert.equal(e.roster.length, 4);
  assert.equal(e.roster.filter((n) => n === 'Uno Rossi').length, 1);
  assert.equal(e.incoerente, false, 'non deve sforare per colpa dell’intestatario');
});

test('17) le righe sono COPIE: lo stesso elenco su due righe non si somma', () => {
  // Quattro righe che ripetono la stessa partita (una per giocatore) devono dare quattro
  // giocatori, non sedici. È il motivo per cui si prende il massimo e non la somma.
  const gio = ['Uno Rossi', 'Due Rossi', 'Ospite', 'Ospite'];
  const slot: RigaSlot[] = [
    rigaDa({ giocatore: 'Uno Rossi', giocatori: gio }),
    rigaDa({ giocatore: 'Due Rossi', giocatori: gio }),
  ];
  const e = rosterDelloSlot(slot, MAX);
  assert.equal(e.roster.length, 4);
  assert.equal(e.roster.filter((n) => n === 'Ospite').length, 2, 'due ospiti, non quattro');
});

test('18) caso VERO di PROD: un socio e tre ospiti su UNA riga → quattro, non uno', () => {
  // 27/07 19:30 campo 2, Sergio Dal Bianco. La nostra copia ha SOLO l’intestatario: i tre
  // ospiti stanno unicamente nella scheda del circolo. Prima del 27/07 da qui usciva UN
  // giocatore e l’edge rispondeva «unico_giocatore» — cioè «sei solo, qui non si esce, si
  // annulla» — mentre il bot, che li conta bene, gli rimostrava il bottone «Esci»: un giro
  // chiuso. È il caso che ha fatto scoprire tutto.
  const D = '-Ospite.-Ospite.-Ospite.-Sergio Dal Bianco.';
  const slot: RigaSlot[] = [rigaDa({ giocatore: 'Sergio Dal Bianco', descrizione: D })];
  const e = rosterDelloSlot(slot, MAX);
  assert.equal(e.fonte, 'circolo');
  assert.equal(e.roster.length, 4);
  assert.ok(e.roster.includes('Sergio Dal Bianco'));
  assert.equal(sostituito(e, varianti('Sergio Dal Bianco')), false, 'c’è nella scheda: non è sostituito');
});

test('19) chi resta in campo: soli ospiti sì, ma due soci e due ospiti NO', () => {
  // ⭐ Decisione del committente (27/07): se uscendo non resta nessun socio, la partita la
  // gestisce la segreteria. La coppia opposta è ciò che rende la regola misurabile: senza il
  // secondo caso, un «rifiuta sempre» passerebbe.
  assert.equal(restanoSoloOspiti(['Ospite', 'Ospite', 'Ospite']), true);
  assert.equal(restanoSoloOspiti(['Ospite']), true);
  assert.equal(restanoSoloOspiti(['Uno Rossi', 'Ospite', 'Ospite']), false, 'resta un socio');
  assert.equal(restanoSoloOspiti([]), false, 'nessuno in campo non è «soli ospiti»: è un altro caso');
  // Il confronto è sul nome normalizzato, non sulla grafia esatta.
  assert.equal(restanoSoloOspiti(['OSPITE', ' ospite ']), true);
});

test('20) uscendo si toglie UNA occorrenza, non tutti gli omonimi', () => {
  // 🚨 Se togliesse tutti i nomi uguali, un socio che esce da una partita con tre ospiti
  // lascerebbe zero giocatori invece di tre — e la partita risulterebbe vuota.
  assert.deepEqual(
    senzaDiMe(['Ospite', 'Ospite', 'Ospite', 'Sergio Dal Bianco'], 'Sergio Dal Bianco'),
    ['Ospite', 'Ospite', 'Ospite'],
  );
  assert.deepEqual(senzaDiMe(['Ospite', 'Ospite'], 'Ospite'), ['Ospite']);
  assert.deepEqual(senzaDiMe(['Uno Rossi'], 'Due Rossi'), ['Uno Rossi'], 'chi non c’è non toglie nulla');
});

test('21) il conteggio delle liste: massimo dentro UNA lista, mai la somma fra liste', () => {
  // La regola nuda, senza il contorno dello slot. Deve essere identica a `compagniDelloSlot`
  // del readmodel: due conteggi della stessa cosa divergono, e questo decide se un socio è solo.
  assert.deepEqual(giocatoriDelleListe([['A', 'Ospite', 'Ospite']]), ['A', 'Ospite', 'Ospite']);
  assert.deepEqual(
    giocatoriDelleListe([['A', 'Ospite', 'Ospite'], ['A', 'Ospite', 'Ospite']]),
    ['A', 'Ospite', 'Ospite'],
    'due copie della stessa lista non raddoppiano niente',
  );
  assert.deepEqual(
    giocatoriDelleListe([['A', 'Ospite'], ['A', 'Ospite', 'Ospite', 'Ospite']]),
    ['A', 'Ospite', 'Ospite', 'Ospite'],
    'vince la lista più informativa',
  );
  assert.deepEqual(giocatoriDelleListe([]), []);
});

test('22) la scheda entra in gioco SOLO se dà una partita piena', () => {
  // 🚨 Il confine della regola nuova, provato dai due versi. Una scheda che ne dà tre mentre
  // noi ne leggiamo due NON deve vincere: non sapremmo se il terzo c’è davvero, e gonfiare il
  // conteggio manderebbe la partita fra le complete zittendo gli avvisi.
  const tre = [rigaDa({ giocatore: 'Uno Rossi', descrizione: '-Uno Rossi.-Due Rossi.-Tre Rossi.' })];
  assert.equal(rosterDelloSlot(tre, MAX).fonte, 'nostra');
  assert.equal(rosterDelloSlot(tre, MAX).roster.length, 1);
  const quattro = [rigaDa({ giocatore: 'Uno Rossi', descrizione: '-Uno Rossi.-Due Rossi.-Tre Rossi.-Ospite.' })];
  assert.equal(rosterDelloSlot(quattro, MAX).fonte, 'circolo');
  assert.equal(rosterDelloSlot(quattro, MAX).roster.length, 4);
});

test('23) una scheda che ne dà PIÙ di quattro non vince: il tetto vale anche per lei', () => {
  // 🚨 Caso nato da un sabotaggio rimasto VERDE il 27/07: sostituendo «esattamente quattro»
  // con «almeno quattro» nessun test cadeva, perché nessuno aveva una scheda più lunga di
  // quattro. Non è un caso di fantasia: `playersFromDescrizione` spezza sul punto, quindi un
  // nome puntato («Alessandro Sir. Amato») conta due voci e una partita di quattro può
  // presentarne cinque. Accettarla vorrebbe dire mettere in campo cinque giocatori — cioè
  // proprio ciò che la rete del «mai più di quattro» esiste per impedire.
  const D = '-Uno Rossi.-Due Rossi.-Tre Rossi.-Alessandro Sir. Amato.';
  assert.equal(playersFromDescrizione(D).length, 5, 'il nome puntato si spezza: cinque voci');
  const slot: RigaSlot[] = [
    rigaDa({ giocatore: 'Uno Rossi', descrizione: D }),
    rigaDa({ giocatore: 'Due Rossi', descrizione: D }),
  ];
  const e = rosterDelloSlot(slot, MAX);
  assert.ok(e.roster.length <= MAX, 'mai più di quattro, da nessuna fonte');
  assert.equal(e.fonte, 'nostra', 'una scheda troppo lunga non è affidabile: si resta alla nostra copia');
  assert.equal(e.roster.length, 2);
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// CHI HA ORGANIZZATO, E IL DIRITTO DI ANNULLARE (30/07/2026)
//
// ⭐ Le schede dei casi 24, 25 e 26 sono VERE, lette da PROD in sola lettura il 30/07.
//
// 🚨🚨⭐⭐ MA ATTENZIONE A COSA PROVANO, perché la prima stesura lo diceva SBAGLIATO: nei casi
// 25 e 26 le righe che si contraddicono sono **CANCELLATE** (colonna `deleted = true`), e il
// ponte quelle non le legge mai — il suo filtro è `.not('deleted','is',true)`. Le avevo contate
// come vive perché il mio criterio guardava `payload->>'deleted'`, una chiave **sempre nulla**
// che ha lo stesso nome della colonna. ⇒ In produzione, alla funzione quelle due liste
// discordi **non arrivano**: la contraddizione fra copie non è mai stata osservata.
// ⭐ I due casi RESTANO, e sono onesti se si legge cosa sono: non «la fotografia di uno slot
// vero», ma **la forma di dato** (due schede che cominciano con nomi diversi) costruita con
// nomi e schede veri. Sorvegliano il ramo che deve tacere il giorno in cui capiterà davvero.
// → memoria [[metodo-il-caso-reale-non-discrimina]]
const rigaTipata = (payload: Record<string, unknown>, tipo: string): RigaSlotTipata => ({
  liste: listeDaPayload(payload),
  descrizione: (payload.descrizione ?? null) as string | null,
  tipo,
});

test('24) dati VERI: nella partita di sabato l\'organizzatore è il PRIMO della scheda', () => {
  // PROD, slot 2026-08-01 15:00 C4 (#9172): quattro righe `booking`, una per giocatore, tutte
  // con la stessa scheda e tutte rinfrescate dal sync alle 13:22 del 30/07.
  const D = '-Maurizio Aprea.-Fabio De Luca.-Roberto Ruzzini.-Manuel Casagrande.';
  const slot: RigaSlotTipata[] = [
    rigaTipata({ giocatore: 'Roberto Ruzzini', descrizione: D }, 'Partita'),
    rigaTipata({ giocatore: 'Maurizio Aprea', descrizione: D, giocatori: ['Maurizio Aprea', 'Fabio De Luca', 'Roberto Ruzzini', 'Manuel Casagrande'] }, 'Partita'),
    rigaTipata({ giocatore: 'Manuel Casagrande', descrizione: D }, 'Partita'),
    rigaTipata({ giocatore: 'Fabio De Luca', descrizione: D }, 'Partita'),
    // La copia in app: NON ha descrizione, quindi non partecipa all'ordine.
    rigaTipata({ nome: 'Maurizio Aprea, Fabio De Luca, Roberto Ruzzini, Manuel Casagrande' }, 'partita'),
  ];
  assert.equal(organizzatoreDelloSlot(slot), 'Maurizio Aprea');
  // 🚨 Controllo negativo: NON è il secondo. Senza, un sabotaggio che prende `[1]` resterebbe
  // verde su ogni caso in cui il primo nome è anche l'unico che ci aspettiamo.
  assert.notEqual(organizzatoreDelloSlot(slot), 'Fabio De Luca');
  // 🚨 E non dipende dall'ordine di ARRIVO delle righe: dal database escono senza `order by`.
  assert.equal(organizzatoreDelloSlot([...slot].reverse()), 'Maurizio Aprea');
});

test('25) due schede discordi NON danno il potere a chi è USCITO', () => {
  // Schede vere di PROD, slot 2026-07-30 19:30 C3: quattro righe vive elencano
  // Borsoi · Tonini · Zaccaron · Balzarini, e una riga ferma al 24/07 comincia con Anna
  // Quaglio, che da quella partita è USCITA (i Movimenti del gestionale: esce alle 18:44:04 del
  // 24/07, ed entra Balzarini 14 secondi dopo).
  // ⚠️ Quella quinta riga è `deleted = true` — il sync l'aveva già marcata — quindi al ponte
  // NON arriva: qui la si mette accanto alle altre apposta, per esercitare il ramo. È la forma
  // del dato, non la fotografia dello slot (vedi la nota in testa a questa sezione).
  const FRESCA = '-Stefano Borsoi.-Massimo Tonini.-Sheila Zaccaron.-Silvia Balzarini.';
  const VECCHIA = '-Anna Quaglio.-Stefano Borsoi.-Massimo Tonini.-Sheila Zaccaron.';
  const slot: RigaSlotTipata[] = [
    rigaTipata({ giocatore: 'Anna Quaglio', descrizione: VECCHIA }, 'Partita'),
    rigaTipata({ giocatore: 'Stefano Borsoi', descrizione: FRESCA }, 'Partita'),
    rigaTipata({ giocatore: 'Massimo Tonini', descrizione: FRESCA }, 'Partita'),
    rigaTipata({ giocatore: 'Sheila Zaccaron', descrizione: FRESCA }, 'Partita'),
    rigaTipata({ giocatore: 'Silvia Balzarini', descrizione: FRESCA }, 'Partita'),
  ];
  assert.equal(organizzatoreDelloSlot(slot), null, 'copie discordi ⇒ non lo sappiamo');
  // 🚨⭐⭐ Il controllo che dice PERCHÉ la porta esiste: la riga vecchia è la PIÙ ANTICA e la
  // più corta, ma se si scegliesse «la più completa» fra copie discordi (o semplicemente la
  // prima che arriva) l'organizzatore sarebbe Anna Quaglio — che in quella partita non c'è
  // più. Il fail closed non è prudenza generica: impedisce di dare il campo a chi è uscito.
  assert.equal(rosterOrdinatoDelloSlot([playersFromDescrizione(VECCHIA)])[0], 'Anna Quaglio');
  assert.deepEqual(rosterOrdinatoDelloSlot([playersFromDescrizione(VECCHIA), playersFromDescrizione(FRESCA)]), []);
  // E nessuno dei quattro che giocano davvero ottiene il diritto.
  for (const chi of ['Stefano Borsoi', 'Silvia Balzarini']) {
    const d = dirittoDiAnnullare(slot, varianti(chi));
    assert.equal(d.permesso, false);
    assert.equal(d.motivo, 'organizzatore_ignoto');
  }
});

test('26) dopo un\'uscita, la scheda vecchia accanto alla nuova tace', () => {
  // Schede vere di PROD, slot 2026-08-01 17:00 C4 (#9204): il 29/07 il socio è uscito dalla
  // partita col bot, e alle 17:15 la partita è stata annullata. La riga aggiornata diceva
  // `-Lidia Comes.`, la sua era rimasta a `-Maurizio Aprea.-Lidia Comes.` ⇒ prese insieme,
  // senza fail closed l'organizzatore sarebbe lui, che da quella partita era uscito.
  // ⚠️ Come il 25: oggi quelle righe sono TUTTE `deleted` (l'annullamento ha fatto il suo
  // lavoro, verificato nel registro del worker). Il caso prova la FORMA, non lo slot.
  const slot: RigaSlotTipata[] = [
    rigaTipata({ giocatore: 'Maurizio Aprea', descrizione: '-Maurizio Aprea.-Lidia Comes.', giocatori: ['Maurizio Aprea', 'Lidia Comes'] }, 'Partita'),
    rigaTipata({ giocatore: 'Lidia Comes', descrizione: '-Lidia Comes.', giocatori: ['Lidia Comes'] }, 'Partita'),
  ];
  assert.equal(organizzatoreDelloSlot(slot), null);
  assert.equal(dirittoDiAnnullare(slot, varianti('Maurizio Aprea')).permesso, false);
});

test('27) «Ospite» non organizza: è un posto occupato, non una persona', () => {
  const slot = [rigaTipata({ descrizione: '-Ospite.-Uno Rossi.-Due Rossi.-Tre Rossi.' }, 'Partita')];
  assert.equal(organizzatoreDelloSlot(slot), null);
  // 🚨 E NON si scala al secondo: il posto 0 è occupato da qualcuno che non sappiamo nominare.
  assert.notEqual(organizzatoreDelloSlot(slot), 'Uno Rossi');
  assert.equal(dirittoDiAnnullare(slot, varianti('Uno Rossi')).motivo, 'organizzatore_ignoto');
});

test('28) le LEZIONI restano fuori — e i due valori veri sono diversi', () => {
  // 🚨 Sui dati veri di PROD il tipo si scrive in cinque modi (misurato il 30/07):
  // `Partita` sulle righe del circolo, `partita` sulle copie in app, e per le lezioni
  // `Lezione Libera` e `lezione`. Il filtro è parte della regola: su 34 lezioni future, in 5
  // il primo nome della scheda è il MAESTRO ⇒ alla cieca darebbe a lui il diritto di annullare.
  const D = '-Marco Maestro.-Allievo Uno.-Allievo Due.';
  assert.equal(organizzatoreDelloSlot([rigaTipata({ descrizione: D }, 'Lezione Libera')]), null);
  assert.equal(organizzatoreDelloSlot([rigaTipata({ descrizione: D }, 'lezione')]), null);
  assert.equal(organizzatoreDelloSlot([rigaTipata({ descrizione: D }, 'Partita')]), 'Marco Maestro',
    'controllo negativo: sullo stesso dato, cambiando SOLO il tipo, la regola parla');
});

test('29) il tipo: manutenzione, sconosciuto, vuoto e MISTO ⇒ nessun organizzatore', () => {
  const D = '-Uno Rossi.-Due Rossi.';
  assert.equal(ePartitaLoSlot([rigaTipata({ descrizione: D }, 'manutenzione')]), false);
  assert.equal(ePartitaLoSlot([rigaTipata({ descrizione: D }, 'torneo')]), false);
  assert.equal(ePartitaLoSlot([rigaTipata({ descrizione: D }, '')]), false, 'tipo vuoto: non si indovina');
  assert.equal(ePartitaLoSlot([{ liste: [], descrizione: D }]), false, 'tipo assente: non si indovina');
  assert.equal(
    ePartitaLoSlot([rigaTipata({ descrizione: D }, 'Partita'), rigaTipata({ descrizione: D }, 'lezione')]),
    false,
    'slot MISTO: basta un tipo che non dice partita per tacere',
  );
  assert.equal(ePartitaLoSlot([rigaTipata({ descrizione: D }, 'Partita'), rigaTipata({ descrizione: D }, 'partita')]), true);
});

test('30) senza scheda del circolo non si sa: è il caso della partita appena creata', () => {
  // ⭐ Una partita prenotata dall'app o dal bot esiste da subito come `staff_booking`, che NON
  // ha `descrizione`: per i ~2 minuti che il sync impiega a portare la scheda, l'organizzatore
  // è ignoto. Non è un difetto — è il verso sicuro — ma va saputo: in quella finestra il
  // diritto di annullare da organizzatore non c'è. (Chi ha appena prenotato è però SOLO in
  // campo, e per lui vale la strada di sempre: quella non passa di qui.)
  const soloCopiaInApp: RigaSlotTipata[] = [
    rigaTipata({ nome: 'Uno Rossi, Due Rossi', giocatori: [{ nome: 'Uno Rossi' }, { nome: 'Due Rossi' }] }, 'partita'),
  ];
  assert.equal(organizzatoreDelloSlot(soloCopiaInApp), null);
  assert.equal(dirittoDiAnnullare(soloCopiaInApp, varianti('Uno Rossi')).motivo, 'organizzatore_ignoto');
});

test('31) una descrizione che è un TITOLO non è un roster', () => {
  // `playersFromDescrizione` dà nomi solo se la descrizione comincia per «-». Un titolo libero
  // («Torneo aziendale») non è un elenco ordinato, e da lì non esce nessun organizzatore.
  assert.equal(organizzatoreDelloSlot([rigaTipata({ descrizione: 'Torneo aziendale' }, 'Partita')]), null);
});

test('32) IL DIRITTO: l\'organizzatore sì, gli altri no — e i due motivi sono diversi', () => {
  const D = '-Uno Rossi.-Due Rossi.-Tre Rossi.-Ospite.';
  const slot = [rigaTipata({ descrizione: D }, 'Partita')];
  const org = dirittoDiAnnullare(slot, varianti('Uno Rossi'));
  assert.equal(org.permesso, true);
  assert.equal(org.organizzatore, 'Uno Rossi');
  assert.equal(org.motivo, null);
  const altro = dirittoDiAnnullare(slot, varianti('Due Rossi'));
  assert.equal(altro.permesso, false);
  // ⭐ Il motivo NON è lo stesso di quando non si sa chi ha organizzato: qui il socio una strada
  // ce l'ha (uscire dalla partita), là no (segreteria). Un motivo solo costringerebbe il bot a
  // indovinare quale delle due frasi dire.
  assert.equal(altro.motivo, 'non_sei_organizzatore');
  assert.equal(altro.organizzatore, 'Uno Rossi', 'chi ha il ruolo si sa lo stesso: serve al registro, non al socio');
  // Chi non è nemmeno in campo: stessa risposta di chi c'è ma non ha il ruolo.
  assert.equal(dirittoDiAnnullare(slot, varianti('Estraneo Qualsiasi')).motivo, 'non_sei_organizzatore');
});

test('33) IL DIRITTO riconosce «Cognome Nome», come fa la proprietà', () => {
  // Il gestionale scrive ora «Nome Cognome», ora «Cognome Nome»: le varianti sono le stesse che
  // l'edge usa per stabilire che la prenotazione è del socio. Se qui si confrontasse in un modo
  // diverso, l'organizzatore vero si vedrebbe rifiutare l'annullamento della propria partita.
  const slot = [rigaTipata({ descrizione: '-Rossi Uno.-Due Rossi.' }, 'Partita')];
  assert.equal(dirittoDiAnnullare(slot, varianti('Uno Rossi', 'Rossi Uno')).permesso, true);
  // E gli accenti non contano (normName toglie i diacritici), come per la proprietà.
  const conAccento = [rigaTipata({ descrizione: '-Niccolò Perù.-Due Rossi.' }, 'Partita')];
  assert.equal(dirittoDiAnnullare(conAccento, varianti('Niccolo Peru')).permesso, true);
});

test('34) IL COLLEGAMENTO: l\'edge chiama la funzione, non una copia scritta a mano', () => {
  // 🚨⭐⭐ Senza questo caso, togliendo da `index.ts` la chiamata a `dirittoDiAnnullare` e
  // rimettendo il vecchio rifiuto secco, TUTTI i casi qui sopra resterebbero VERDI e
  // l'organizzatore tornerebbe a non poter annullare — senza un rosso. È lo stesso buco trovato
  // il 30/07 sul promemoria del bot: i casi provavano la regola, nessuno provava che il codice
  // vero la usasse.
  const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.ok(/dirittoDiAnnullare\(righeSlot, nameVariants\)/.test(src),
    'index.ts deve chiedere il diritto a roster-slot.ts, passandogli le righe dello slot e le varianti del nome');
  assert.ok(/reason: diritto\.motivo/.test(src),
    'il motivo del rifiuto deve essere quello della funzione, non uno riscritto a mano');
  // ⭐ Guardia anti-cieco: se un domani il file cambia nome o si svuota, questo test deve
  // FALLIRE dicendo perché, invece di passare confrontando due stringhe vuote.
  assert.ok(src.length > 10000, 'sorgente dell\'edge non letto: questa prova non direbbe niente');
});

test('35) le DUE copie di rosterOrdinatoDelloSlot sono identiche, carattere per carattere', () => {
  // 🚨⭐⭐ Nato da un sabotaggio rimasto VERDE: cambiando qui «fra copie concordi vince la più
  // completa» in «vince la prima» non cadeva niente — ed è giusto, perché a questo modulo serve
  // solo la POSIZIONE 0, che fra copie concordi è la stessa. Il sabotaggio era INERTE, non un
  // test debole. Ma indicava una cosa vera da difendere: che le due copie non divergano.
  // ⭐ Perché sono due e non una: le cartelle `_shared/` NON vengono deployate (il `_` iniziale
  // le fa saltare dai workflow, e il deploy risulta verde senza aver caricato nulla), quindi
  // qui la strada è la copia VERBATIM — la stessa scelta di `playersFromDescrizione`. Una copia
  // verbatim senza una guardia è solo una copia che un giorno divergerà.
  const corpo = (url: URL) => {
    const src = readFileSync(url, 'utf8');
    const m = src.match(/export function rosterOrdinatoDelloSlot[\s\S]*?\n}/);
    // Guardia anti-cieco: se la funzione cambia nome o sparisce, questo test deve FALLIRE
    // dicendo perché, non passare confrontando due `null`.
    assert.ok(m, `rosterOrdinatoDelloSlot non trovata in ${url.pathname}: la prova sarebbe cieca`);
    return m![0];
  };
  assert.equal(
    corpo(new URL('./roster-slot.ts', import.meta.url)),
    corpo(new URL('../consumer-player-readmodel/compagni-slot.ts', import.meta.url)),
    'le due copie sono divergute: chi tocca una deve toccare l\'altra',
  );
});

console.log(`\n${passed} passati, ${failed} falliti`);
if (failed > 0) process.exit(1);
