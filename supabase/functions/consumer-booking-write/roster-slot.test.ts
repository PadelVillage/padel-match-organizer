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
  altriOmonimiVivi,
  bersaglioDaTogliere,
  playersFromDescrizione,
  dirittoDiAnnullare,
  variantiDelNome,
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
    const d = dirittoDiAnnullare(slot, varianti(chi), false);
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
  assert.equal(dirittoDiAnnullare(slot, varianti('Maurizio Aprea'), false).permesso, false);
});

test('27) «Ospite» non organizza: è un posto occupato, non una persona', () => {
  const slot = [rigaTipata({ descrizione: '-Ospite.-Uno Rossi.-Due Rossi.-Tre Rossi.' }, 'Partita')];
  assert.equal(organizzatoreDelloSlot(slot), null);
  // 🚨 E NON si scala al secondo: il posto 0 è occupato da qualcuno che non sappiamo nominare.
  assert.notEqual(organizzatoreDelloSlot(slot), 'Uno Rossi');
  assert.equal(dirittoDiAnnullare(slot, varianti('Uno Rossi'), false).motivo, 'organizzatore_ignoto');
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
  assert.equal(dirittoDiAnnullare(soloCopiaInApp, varianti('Uno Rossi'), false).motivo, 'organizzatore_ignoto');
});

test('31) una descrizione che è un TITOLO non è un roster', () => {
  // `playersFromDescrizione` dà nomi solo se la descrizione comincia per «-». Un titolo libero
  // («Torneo aziendale») non è un elenco ordinato, e da lì non esce nessun organizzatore.
  assert.equal(organizzatoreDelloSlot([rigaTipata({ descrizione: 'Torneo aziendale' }, 'Partita')]), null);
});

test('32) IL DIRITTO: l\'organizzatore sì, gli altri no — e i due motivi sono diversi', () => {
  const D = '-Uno Rossi.-Due Rossi.-Tre Rossi.-Ospite.';
  const slot = [rigaTipata({ descrizione: D }, 'Partita')];
  const org = dirittoDiAnnullare(slot, varianti('Uno Rossi'), false);
  assert.equal(org.permesso, true);
  assert.equal(org.organizzatore, 'Uno Rossi');
  assert.equal(org.motivo, null);
  const altro = dirittoDiAnnullare(slot, varianti('Due Rossi'), false);
  assert.equal(altro.permesso, false);
  // ⭐ Il motivo NON è lo stesso di quando non si sa chi ha organizzato: qui il socio una strada
  // ce l'ha (uscire dalla partita), là no (segreteria). Un motivo solo costringerebbe il bot a
  // indovinare quale delle due frasi dire.
  assert.equal(altro.motivo, 'non_sei_organizzatore');
  assert.equal(altro.organizzatore, 'Uno Rossi', 'chi ha il ruolo si sa lo stesso: serve al registro, non al socio');
  // Chi non è nemmeno in campo: stessa risposta di chi c'è ma non ha il ruolo.
  assert.equal(dirittoDiAnnullare(slot, varianti('Estraneo Qualsiasi'), false).motivo, 'non_sei_organizzatore');
});

test('33) IL DIRITTO riconosce «Cognome Nome», come fa la proprietà', () => {
  // Il gestionale scrive ora «Nome Cognome», ora «Cognome Nome»: le varianti sono le stesse che
  // l'edge usa per stabilire che la prenotazione è del socio. Se qui si confrontasse in un modo
  // diverso, l'organizzatore vero si vedrebbe rifiutare l'annullamento della propria partita.
  const slot = [rigaTipata({ descrizione: '-Rossi Uno.-Due Rossi.' }, 'Partita')];
  assert.equal(dirittoDiAnnullare(slot, varianti('Uno Rossi', 'Rossi Uno'), false).permesso, true);
  // E gli accenti non contano (normName toglie i diacritici), come per la proprietà.
  const conAccento = [rigaTipata({ descrizione: '-Niccolò Perù.-Due Rossi.' }, 'Partita')];
  assert.equal(dirittoDiAnnullare(conAccento, varianti('Niccolo Peru'), false).permesso, true);
});

test('34) IL COLLEGAMENTO: l\'edge chiama la funzione, non una copia scritta a mano', () => {
  // 🚨⭐⭐ Senza questo caso, togliendo da `index.ts` la chiamata a `dirittoDiAnnullare` e
  // rimettendo il vecchio rifiuto secco, TUTTI i casi qui sopra resterebbero VERDI e
  // l'organizzatore tornerebbe a non poter annullare — senza un rosso. È lo stesso buco trovato
  // il 30/07 sul promemoria del bot: i casi provavano la regola, nessuno provava che il codice
  // vero la usasse.
  const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  // 🆕 4/08 — le azioni che chiedono il diritto sono DUE: `cancel` (annulla) e `remove`
  // (togli un giocatore). Si pretendono ENTRAMBE, con la stessa forma: se un domani una delle
  // due smettesse di chiamare la funzione, l'altra terrebbe verde il caso e il buco resterebbe
  // invisibile — che è esattamente il difetto che questo test esiste per impedire.
  const chiamate = src.match(/dirittoDiAnnullare\((righeSlot|righe), nameVariants, esitoOmonimi\.omonimi\.length > 0\)/g) ?? [];
  assert.equal(chiamate.length, 2,
    'sia `cancel` sia `remove` devono chiedere il diritto a roster-slot.ts, passandogli righe, varianti E la risposta sugli omonimi');
  assert.ok(/dirittoDiAnnullare\(righeSlot, nameVariants/.test(src), '`cancel` deve chiamare il diritto');
  assert.ok(/dirittoDiAnnullare\(righe, nameVariants/.test(src), '`remove` deve chiamare il diritto');
  assert.equal((src.match(/reason: diritto\.motivo/g) ?? []).length, 2,
    'il motivo del rifiuto deve essere quello della funzione in tutt\'e due i rami, non uno riscritto a mano');
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

// ── 👥 OMONIMI ────────────────────────────────────────────────────────────────
// ⭐ I nomi dei casi 36-39 sono VERI: sono tre delle 13 coppie di omonimi misurate su PROD il
// 3/08/2026 in sola lettura (27 persone, tutte con telefoni diversi ⇒ persone vere, non
// doppioni). Gli `id` sono finti perché alla funzione non servono: guarda i nomi.

const scheda = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, name, ...extra });

test('36) OMONIMI: due persone diverse con lo stesso nome si contano', () => {
  const io = scheda('id-A', 'Marco Micheletto');
  const altro = scheda('id-B', 'Marco Micheletto');
  assert.deepEqual(altriOmonimiVivi(io, [io, altro]), ['id-B']);
  // 🚨 CONTROLLO NEGATIVO, e senza questo il caso sopra non direbbe niente: chi NON ha omonimi
  // deve dare elenco vuoto. Una funzione che risponde sempre «sì» supererebbe il primo assert.
  const solo = scheda('id-C', 'Nessun Omonimo');
  assert.deepEqual(altriOmonimiVivi(solo, [solo, io, altro]), [], 'chi non ha omonimi non ne ha');
  // Non sono omonimo di me stesso, nemmeno se la stessa scheda arriva due volte dalle due query.
  assert.deepEqual(altriOmonimiVivi(io, [io, io]), []);
});

test('37) OMONIMI: l\'archiviato non conta, e «Cognome Nome» invece sì', () => {
  const io = scheda('id-A', 'Francesco Casagrande');
  // Una scheda archiviata è di una persona che non gioca più: bloccare l'annullo per lei
  // sarebbe un prezzo pagato a vuoto.
  const archiviato = scheda('id-B', 'Francesco Casagrande', { active: 'false' });
  assert.deepEqual(altriOmonimiVivi(io, [io, archiviato]), [], 'archiviata ⇒ non è un omonimo vivo');
  // 🚨⭐⭐ La forma invertita DEVE contare: il gestionale scrive ora «Nome Cognome», ora
  // «Cognome Nome», e il diritto accetta entrambe come mie. Se la guardia contasse solo la
  // forma diretta, esisterebbe una scheda che il match riconosce come mia e che la guardia
  // non vede — cioè un buco esattamente dove serve la protezione.
  const invertito = scheda('id-C', 'Casagrande Francesco');
  assert.deepEqual(altriOmonimiVivi(io, [io, invertito]), ['id-C']);
  // E la stessa cosa vale se il nome è spezzato nei due campi invece che in `name`.
  const spezzato = { id: 'id-D', firstName: 'Francesco', surname: 'Casagrande' };
  assert.deepEqual(altriOmonimiVivi(io, [io, spezzato]), ['id-D']);
  // Senza nome non c'è niente da proteggere: il match per nome non potrebbe mai riuscire.
  assert.deepEqual(altriOmonimiVivi({ id: 'id-X' }, [io, invertito]), []);
});

test('38) IL DIRITTO: con un omonimo al circolo il nome non prova più niente', () => {
  const slot = [rigaTipata({ descrizione: '-Davide Zanardo.-Due Rossi.-Tre Rossi.' }, 'Partita')];
  // Senza omonimi: l'organizzatore annulla, come sempre. È il controllo che tiene onesto il resto.
  const senza = dirittoDiAnnullare(slot, varianti('Davide Zanardo'), false);
  assert.equal(senza.permesso, true);
  assert.equal(senza.motivo, null);
  // Con un omonimo: il nome combacia ancora, ma combaciare non vuol più dire «sei tu».
  const con = dirittoDiAnnullare(slot, varianti('Davide Zanardo'), true);
  assert.equal(con.permesso, false, 'due Davide Zanardo al circolo ⇒ non si annulla al buio');
  assert.equal(con.motivo, 'omonimi_al_circolo');
  assert.equal(con.organizzatore, 'Davide Zanardo', 'chi ha il ruolo si sa lo stesso: serve al registro');
  // 🚨 L'ORDINE dei motivi conta: se l'organizzatore è un altro, il motivo giusto resta
  // `non_sei_organizzatore` — è vero comunque e offre una strada (uscire dalla partita).
  // Rispondere `omonimi_al_circolo` a chi semplicemente non ha il ruolo lo manderebbe in
  // segreteria per un problema che non ha.
  assert.equal(dirittoDiAnnullare(slot, varianti('Due Rossi'), true).motivo, 'non_sei_organizzatore');
  // E se non si sa chi ha organizzato, quello viene prima di tutto.
  const ignoto = [rigaTipata({ descrizione: '-Ospite.-Davide Zanardo.' }, 'Partita')];
  assert.equal(dirittoDiAnnullare(ignoto, varianti('Davide Zanardo'), true).motivo, 'organizzatore_ignoto');
});

test('39) IL COLLEGAMENTO degli omonimi: l\'edge li legge, e nel dubbio NON annulla', () => {
  // 🚨⭐⭐ Senza questo caso, l'edge potrebbe passare `false` fisso al posto della risposta
  // vera e i casi 36-38 resterebbero TUTTI VERDI mentre in produzione un omonimo continua ad
  // annullare la partita di un altro. È lo stesso buco del caso 34, sulla riga nuova.
  const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.ok(src.length > 10000, 'sorgente dell\'edge non letto: questa prova non direbbe niente');
  assert.ok(/const omonimi = altriOmonimiVivi\(member, candidati\)/.test(src),
    'l\'edge deve chiedere gli omonimi alla funzione provata, non deciderlo per conto suo');
  // 🆕 4/08 — la lettura è stata tirata fuori in `omonimiDelSocio`, un posto solo, il giorno in
  // cui è servita anche a `remove`. Si pretende che sia UNA (una seconda copia divergerebbe) e
  // che la chiamino ENTRAMBE le azioni che decidono su un gesto irreversibile.
  assert.equal((src.match(/const omonimi = altriOmonimiVivi\(/g) ?? []).length, 1,
    'la lettura degli omonimi deve stare in UN posto solo: due copie di una guardia divergono');
  assert.ok(/await omonimiDelSocio\('cancel', 'non annullo'\)/.test(src),
    '`cancel` deve passare dalla guardia condivisa');
  assert.ok(/await omonimiDelSocio\('remove', 'non tolgo nessuno'\)/.test(src),
    '`remove` deve passare dalla stessa guardia, e dire al socio la cosa giusta');
  // Il fail closed: se la lettura non riesce (errore o elenco troncato al limite) l'annullo
  // si ferma con un 503 e NON prosegue come se non ci fossero omonimi.
  assert.ok(/OMONIMI_NON_VERIFICABILI/.test(src),
    'quando non si riesce a verificare, l\'edge deve fermarsi: «non lo so» qui vale «no»');
  assert.ok(/length >= OMONIMI_LIMITE/.test(src),
    'un elenco pieno fino al limite può aver perso proprio l\'omonimo: va trattato come dubbio');
  // ⭐ E le varianti devono venire dal modulo, non essere riscritte nell'edge: due elenchi
  // scritti a mano in due posti divergono, e la divergenza si vedrebbe solo il giorno in cui
  // qualcuno annulla la partita di un altro.
  assert.ok(/const nameVariants = variantiDelNome\(member\)/.test(src),
    'l\'edge deve usare le stesse varianti del nome che usa la guardia degli omonimi');
});

// ── ✏️ IL BERSAGLIO: chi si toglie dalla partita ──────────────────────────────
// ⭐ Il diritto (36-39) dice «puoi». Questi dicono «puoi togliere PROPRIO QUESTO», che è
// un'altra domanda: fra il momento in cui il bot disegna i nomi e il tocco del socio la
// partita può essere cambiata, e il nome toccato può non esserci più — o esserci due volte.

test('40) IL BERSAGLIO: si toglie chi è in campo, e torna il nome COME LO SCRIVE IL GESTIONALE', () => {
  const roster = ['Andrea Foltran', 'Manuel Casagrande', 'Ospite'];
  // Il socio tocca un bottone: quello che arriva è una stringa da fuori, e può essere scritta
  // in un verso diverso da quello della ficha.
  const e = bersaglioDaTogliere(roster, 'Andrea Foltran', 'casagrande manuel');
  assert.equal(e.ok, true);
  // 🚨 Il punto del caso: torna «Manuel Casagrande», la forma della FICHA, non quella arrivata.
  // Il worker toglie confrontando la stringa esatta della scheda — rimandare indietro ciò che
  // è arrivato farebbe fallire la rimozione, o riuscirla sulla riga sbagliata.
  assert.equal(e.ok && e.nome, 'Manuel Casagrande');
  assert.equal(e.ok && e.ospite, false);
  // E gli accenti non contano, come dappertutto: decide `normName`.
  const conAccento = bersaglioDaTogliere(['Niccolò Perù', 'Due Rossi'], 'Niccolò Perù', 'due rossi');
  assert.equal(conAccento.ok && conAccento.nome, 'Due Rossi');
});

test('41) IL BERSAGLIO: chi non è (più) in campo → «non_in_partita», non un guasto', () => {
  // 🚨 Il caso vero che questo difende: i bottoni di un messaggio già in chat sono FOTOGRAFIE.
  // Il socio apre l'elenco, un compagno esce da solo, e quattro minuti dopo lui tocca il nome
  // di chi non c'è più. Senza questo controllo si chiederebbe al worker di togliere un nome
  // che nella ficha non esiste — e la risposta sarebbe un errore tecnico, non «riapri l'elenco».
  const roster = ['Andrea Foltran', 'Manuel Casagrande'];
  assert.equal(bersaglioDaTogliere(roster, 'Andrea Foltran', 'Lidia Comes').ok, false);
  assert.equal(
    (bersaglioDaTogliere(roster, 'Andrea Foltran', 'Lidia Comes') as { motivo: string }).motivo,
    'non_in_partita');
  // Fail closed: da fuori può arrivare qualunque cosa, e «vuoto» non è una persona.
  assert.equal((bersaglioDaTogliere(roster, 'Andrea Foltran', '') as { motivo: string }).motivo, 'non_in_partita');
  assert.equal((bersaglioDaTogliere(roster, 'Andrea Foltran', '   ') as { motivo: string }).motivo, 'non_in_partita');
  // ⭐ Controllo negativo dello stesso giro: su un nome che c'è DAVVERO deve dire di sì —
  // altrimenti questo caso passerebbe anche con una funzione che rifiuta sempre tutto.
  assert.equal(bersaglioDaTogliere(roster, 'Andrea Foltran', 'Manuel Casagrande').ok, true);
});

test('42) IL BERSAGLIO: tre Ospite si tolgono uno alla volta, due OMONIMI veri no', () => {
  // 🚨⭐⭐ La differenza è nel WORKER, verificata nel suo codice e non dedotta:
  //  · l'Ospite si toglie a CONTEGGIO ⇒ chiederne uno ne toglie esattamente uno, e quale dei
  //    tre sparisca non vuol dire niente: è un posto occupato, non una persona;
  //  · una persona si toglie per NOME, e il ciclo ri-scandisce la ficha finché un nome
  //    combacia ⇒ due omonimi in campo sparirebbero TUTT'E DUE, con un tocco solo.
  const conOspiti = ['Sergio Dal Bianco', 'Ospite', 'Ospite', 'Ospite'];
  const o = bersaglioDaTogliere(conOspiti, 'Sergio Dal Bianco', 'Ospite');
  assert.equal(o.ok, true);
  assert.equal(o.ok && o.ospite, true, 'l\'Ospite va riconosciuto come tale: dietro non c\'è nessuno da avvisare');

  const conOmonimi = ['Andrea Foltran', 'Marco Rossi', 'Marco Rossi'];
  const m = bersaglioDaTogliere(conOmonimi, 'Andrea Foltran', 'Marco Rossi');
  assert.equal(m.ok, false);
  assert.equal((m as { motivo: string }).motivo, 'omonimi_in_partita');
  // ⭐ Controllo opposto, senza cui il caso sarebbe soddisfatto anche da «rifiuta i doppioni
  // sempre»: nella STESSA partita l'altro giocatore, che è unico, si toglie eccome.
  assert.equal(bersaglioDaTogliere(conOmonimi, 'Andrea Foltran', 'Andrea Foltran').ok, false);
  assert.equal(bersaglioDaTogliere(['Andrea Foltran', 'Marco Rossi', 'Ospite'], 'Andrea Foltran', 'Marco Rossi').ok, true);
});

test('43) IL BERSAGLIO: l\'organizzatore non si toglie da sé, e l\'ORDINE dei controlli conta', () => {
  const roster = ['Andrea Foltran', 'Manuel Casagrande'];
  const sé = bersaglioDaTogliere(roster, 'Andrea Foltran', 'Andrea Foltran');
  assert.equal(sé.ok, false);
  // ⭐ Motivo suo e non un «non_in_partita» generico: per uscire lui c'è già `leave`, cioè il
  // bottone «Esci», e il bot deve poterglielo dire invece di lasciarlo davanti a un no.
  assert.equal((sé as { motivo: string }).motivo, 'e_l_organizzatore');
  // Vale anche scritto al contrario: decide `normName`, non la stringa.
  assert.equal((bersaglioDaTogliere(roster, 'Andrea Foltran', 'foltran andrea') as { motivo: string }).motivo,
    'e_l_organizzatore');

  // 🚨⭐⭐ L'ordine: in campo ci sono DUE persone che si chiamano come l'organizzatore. Il
  // rifiuto giusto è «non so quale dei due», NON «per uscire usa Esci» — che manderebbe a fare
  // una cosa diversa da quella chiesta. Gli omonimi si guardano prima.
  const dueUguali = ['Marco Rossi', 'Marco Rossi', 'Ospite'];
  assert.equal((bersaglioDaTogliere(dueUguali, 'Marco Rossi', 'Marco Rossi') as { motivo: string }).motivo,
    'omonimi_in_partita');
});

test('44) IL COLLEGAMENTO di «remove»: l\'edge chiede il bersaglio, e allinea la copia SU DI LUI', () => {
  // 🚨⭐⭐ Senza questo caso i quattro qui sopra resterebbero verdi mentre l'edge toglie il
  // nome arrivato dalla richiesta senza guardarlo: è lo stesso buco dei casi 34 e 39, sulla
  // riga nuova.
  const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.ok(src.length > 10000, 'sorgente dell\'edge non letto: questa prova non direbbe niente');
  assert.ok(/bersaglioDaTogliere\(esito\.roster, diritto\.organizzatore \?\? '', clean\(body\.giocatore\)\)/.test(src),
    'l\'edge deve chiedere il bersaglio alla funzione provata, passandole il roster VERO e l\'organizzatore già deciso');
  assert.ok(/reason: bersaglio\.motivo/.test(src),
    'il motivo del rifiuto deve essere quello della funzione, non uno riscritto a mano');
  assert.ok(/players: \{ remove: \[bersaglio\.nome\] \}/.test(src),
    'al worker deve andare il nome scelto dalla guardia, non quello arrivato nella richiesta');
  // 🚨⭐⭐ La riga che, sbagliata, farebbe il danno peggiore: la copia in app va allineata sulle
  // varianti del BERSAGLIO. Con `nameVariants` toglierebbe dalla copia l'ORGANIZZATORE —
  // lasciandoci dentro la persona che il gestionale ha davvero tolto, cioè due copie che
  // raccontano l'opposto della verità, e nessun rosso da nessuna parte.
  assert.ok(/allineaCopiaInApp\(copie, new Set\(\[normName\(bersaglio\.nome\)\]\)\)/.test(src),
    'la copia in app si allinea sul bersaglio, MAI sulle varianti di chi ha chiesto');
  // La lezione e il roster incoerente devono fermare anche questo ramo, non solo `leave`.
  assert.ok(/remove roster INCOERENTE/.test(src), '`remove` deve fermarsi su un roster incoerente');
});

console.log(`\n${passed} passati, ${failed} falliti`);
if (failed > 0) process.exit(1);
