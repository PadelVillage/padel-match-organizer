/* 💶❓ «Il prezzo che non esiste si CHIEDE» — banco della VOCE 188/B (09/09/2026).
 *
 * 📏 IL PROBLEMA MISURATO su `cudi` il 09/09/2026, sulle 32 `staff_booking` vive:
 *      21 cominciano esattamente a una fascia   → hanno il prezzo
 *       6 stanno DENTRO una fascia senza iniziarla → curate dalla metà A
 *       5 stanno FUORI da ogni fascia            → lì un prezzo **non esiste**
 *   Delle 5, una sola è futura: giovedì 10/09, Campo 1, ore 11:00 — e le sue due righe hanno
 *   `importoCents` nullo. ⇒ La cassa (voce 181) non ha su cosa addebitare, **in silenzio**.
 *
 * 🗣️ LA REGOLA È SUA: la griglia del listino è il **menù dei soci**, non l'orario del circolo
 *   (*«la segreteria su chiamata personale può prenotare un campo»*). ⇒ Fuori fascia è **lavoro
 *   normale**, e la cura non può impedirlo: *«non deve bloccare chi lavora»*. Il gestionale
 *   **chiede** il prezzo invece di lasciarlo vuoto senza dirlo.
 *
 * 🎯 LE QUATTRO COSE CHE QUESTO BANCO DIFENDE:
 *   ① 🚨⭐⭐ I CINQUE MOTIVI SONO DISTINTI, e solo DUE fanno nascere una domanda. È il cuore della
 *      voce: `_pmoPrezzoDelloSlot` rispondeva `null` a cinque domande diverse, e due di quelle
 *      vogliono *«chiedi a una persona»* mentre le altre tre vogliono *«taci, lo saprai fra un
 *      secondo»*. 📌 *Una funzione che risponde «no» a due domande diverse non risponde a nessuna
 *      delle due* — la stessa riga già scritta in `CLAUDE.md` per `pmoIsReadonlyStaff`;
 *   ② la DELEGA regge: `_pmoPrezzoDelloSlot` deve dare **esattamente** il prezzo che
 *      `_pmoPerchePrezzoAssente` calcola. Prima erano due copie dello stesso ciclo;
 *   ③ 💰 la PROVENIENZA arriva agli occhi: un importo deciso in segreteria non si travestisce da
 *      importo confermato dal circolo — né nella casella né, soprattutto, nel riepilogo che chiede
 *      di confermare del denaro;
 *   ④ ✍️ la scrittura NATIVA fa la cosa giusta: scrive l'importo, non inventa `lettoAt`, e
 *      **non riporta a debito una riga già riscossa**.
 *
 * ⛔ QUELLO CHE QUESTO BANCO **NON** DICE, e va dichiarato invece di lasciarlo credere:
 *   · che il messaggio della domanda **compaia davvero sullo schermo**: qui si prova la regola che
 *     decide *se* chiederlo, non il pixel. Quello vuole la pagina viva;
 *   · che `matchpoint-charge-write` risponda 503 sul gestionale nuovo: è una misura fatta sul
 *     sorgente deployato, non una cosa che un banco possa esercitare da qui.
 *
 * Esegui:  node test/il-prezzo-che-non-esiste-si-chiede.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(QUI, '..', 'index.html'), 'utf8');

let passed = 0, failed = 0;
function test(nome, fn) {
  try { fn(); passed++; console.log('ok   - ' + nome); }
  catch (e) { failed++; console.log('FAIL - ' + nome + '\n       ' + e.message); }
}

function corpoDi(nome) {
  const i = APP.indexOf('function ' + nome + '(');
  assert.ok(i > 0, 'funzione non trovata: ' + nome);
  const apre = APP.indexOf(') {', i);
  let g = 0, visto = false, out = '';
  for (let k = apre + 2; k < APP.length; k++) {
    const c = APP[k];
    out += c;
    if (c === '{') { g++; visto = true; }
    else if (c === '}') { g--; if (visto && g === 0) break; }
  }
  return out;
}
function parametriDi(nome) {
  const i = APP.indexOf('function ' + nome + '(');
  return APP.slice(i + ('function ' + nome + '(').length, APP.indexOf(') {', i));
}
function esegui(nome, dip, asincrona) {
  const nomi = Object.keys(dip || {}), vals = nomi.map((k) => dip[k]);
  return new Function(...nomi,
    'return ' + (asincrona ? 'async ' : '') + 'function ' + nome + '(' + parametriDi(nome) + ') ' + corpoDi(nome) + ';')(...vals);
}

const oraPulita = esegui('_pmoOraPulita', {});
const dentroLaFascia = esegui('pmoOraDentroLaFascia', {});
const perche = esegui('_pmoPerchePrezzoAssente', { _pmoOraPulita: oraPulita, pmoOraDentroLaFascia: dentroLaFascia });
const prezzoSlot = esegui('_pmoPrezzoDelloSlot', { _pmoPerchePrezzoAssente: perche });
const casella = esegui('_pmoImportoCasella', {});
const importoDa = esegui('_pmoImportoDa', {});

/* 🚨 IL FIXTURE PORTA TUTTI E CINQUE I CASI, o quattro guardie su cinque restano verdi per
 *   mancanza di input invece che per merito — è la lezione già pagata scrivendo il banco della 180.
 *   · giovedì 10/12: fasce **con un buco** alle 11:00 (com'è il giovedì vero sul listino);
 *   · una fascia **senza prezzo** alle 21:00;
 *   · un giorno **chiuso**. */
const MAPPA = {
  '2026-12-10': { chiuso: false, slots: [
    { start: '12:30:00', end: '14:00:00', prezzoCents: 1000 },
    { start: '14:00:00', end: '15:30:00', prezzoCents: 1000 },
    { start: '21:00:00', end: '22:30:00', prezzoCents: null },
  ] },
  '2026-12-25': { chiuso: true, slots: [{ start: '12:30:00', end: '14:00:00', prezzoCents: 1000 }] },
};

// ── ① I CINQUE MOTIVI ────────────────────────────────────────────────────────────────────────

test('① il prezzo c\'è ⇒ motivo «c-e», e non si chiede niente a nessuno', () => {
  const r = perche(MAPPA, '2026-12-10', '12:30');
  assert.equal(r.motivo, 'c-e');
  assert.equal(r.prezzoCents, 1000);
  assert.equal(r.chiedere, false);
});

test('① 🚨 FUORI da ogni fascia ⇒ si CHIEDE (è il caso delle 11:00 del giovedì, 5 righe su 32)', () => {
  const r = perche(MAPPA, '2026-12-10', '11:00');
  assert.equal(r.motivo, 'fuori-da-ogni-fascia');
  assert.equal(r.prezzoCents, null);
  assert.equal(r.chiedere, true);
});

test('① 🚨 fascia che ESISTE ma senza prezzo ⇒ si CHIEDE (nessuno l\'ha messo)', () => {
  const r = perche(MAPPA, '2026-12-10', '21:00');
  assert.equal(r.motivo, 'fascia-senza-prezzo');
  assert.equal(r.chiedere, true);
});

test('① ⛔ listino NON caricato ⇒ NON si chiede: non lo sappiamo ANCORA, e lo sapremo', () => {
  assert.equal(perche(null, '2026-12-10', '11:00').motivo, 'listino-non-caricato');
  assert.equal(perche(null, '2026-12-10', '11:00').chiedere, false);
  // 🚨 E un GIORNO che la mappa non conosce è lo stesso caso: il calendario parte da oggi, quindi
  //    una partita passata cade qui. Chiederle un prezzo sarebbe l'invenzione a ritroso che la
  //    voce 180 ha escluso per iscritto.
  assert.equal(perche(MAPPA, '2026-06-19', '09:00').motivo, 'listino-non-caricato');
  assert.equal(perche(MAPPA, '2026-06-19', '09:00').chiedere, false);
});

test('① ⛔ giorno CHIUSO ⇒ NON si chiede: quel giorno non si gioca', () => {
  const r = perche(MAPPA, '2026-12-25', '12:30');
  assert.equal(r.motivo, 'giorno-chiuso');
  assert.equal(r.chiedere, false);
});

test('① ⛔ ora ILLEGGIBILE ⇒ NON si chiede: è un difetto nostro, non una domanda per la segreteria', () => {
  assert.equal(perche(MAPPA, '2026-12-10', 'boh').motivo, 'ora-illeggibile');
  assert.equal(perche(MAPPA, '2026-12-10', '99:99').chiedere, false);
});

test('① 🚨⭐⭐ e i motivi che CHIEDONO sono esattamente DUE, non tre e non uno', () => {
  const casi = [
    [MAPPA, '2026-12-10', '12:30'], [MAPPA, '2026-12-10', '11:00'], [MAPPA, '2026-12-10', '21:00'],
    [null, '2026-12-10', '11:00'], [MAPPA, '2026-06-19', '09:00'],
    [MAPPA, '2026-12-25', '12:30'], [MAPPA, '2026-12-10', 'boh'],
  ];
  const chiedono = casi.map((c) => perche(c[0], c[1], c[2])).filter((r) => r.chiedere).map((r) => r.motivo);
  assert.deepEqual([...new Set(chiedono)].sort(), ['fascia-senza-prezzo', 'fuori-da-ogni-fascia']);
});

// ── ② LA DELEGA ──────────────────────────────────────────────────────────────────────────────

test('② `_pmoPrezzoDelloSlot` dà ESATTAMENTE il prezzo che il motivo calcola (una regola sola)', () => {
  const casi = [
    [MAPPA, '2026-12-10', '12:30'], [MAPPA, '2026-12-10', '13:59'], [MAPPA, '2026-12-10', '14:00'],
    [MAPPA, '2026-12-10', '11:00'], [MAPPA, '2026-12-10', '21:00'], [MAPPA, '2026-12-25', '12:30'],
    [null, '2026-12-10', '12:30'], [MAPPA, '2026-12-10', 'boh'],
  ];
  for (const c of casi) {
    assert.equal(prezzoSlot(c[0], c[1], c[2]), perche(c[0], c[1], c[2]).prezzoCents,
      'divergono su ' + JSON.stringify(c.slice(1)));
  }
});

test('② ⛔ l\'ora uguale alla FINE appartiene alla fascia DOPO (metà A, `< fine` e non `<=`)', () => {
  // 14:00 è la fine della 12:30-14:00 e l'inizio della 14:00-15:30 ⇒ è della seconda.
  assert.equal(perche(MAPPA, '2026-12-10', '14:00').motivo, 'c-e');
  assert.equal(perche(MAPPA, '2026-12-10', '15:30').motivo, 'fuori-da-ogni-fascia');
});

// ── ③ LA PROVENIENZA ARRIVA AGLI OCCHI ───────────────────────────────────────────────────────

test('③ 💰 un importo DECISO IN SEGRETERIA si dichiara — e non si confonde col listino', () => {
  const c = casella(1500, 1500, null, 'segreteria');
  assert.equal(c.decisoQui, true);
  assert.equal(c.natoQui, false, 'non viene dal listino: il listino per quell\'ora non ha niente');
  assert.equal(c.ricordato, false);
});

test('③ 🚨 e NON si traveste da confermato dal circolo: nudo vorrebbe dire proprio quello', () => {
  // `_pmoSetCharges`, dopo la conferma del worker, TOGLIE la marca ⇒ su PROD «nessuna marca»
  // significa «il circolo ha confermato». Un numero deciso qui senza marca direbbe il falso.
  const senzaMarca = casella(1500, 1500, null, null);
  assert.equal(senzaMarca.decisoQui, false);
  assert.equal(senzaMarca.natoQui, false);
  const conMarca = casella(1500, 1500, null, 'segreteria');
  assert.notEqual(conMarca.decisoQui, senzaMarca.decisoQui,
    'i due casi devono essere distinguibili, o la marca non serve a niente');
});

test('③ ⚖️ `lettoAt` VINCE: se il circolo l\'ha poi letto, quel numero È letto', () => {
  const c = casella(1500, 1500, '2026-09-09T20:00:00.000Z', 'segreteria');
  assert.equal(c.ricordato, true);
  assert.equal(c.decisoQui, false, 'i tre esiti col numero sono mutuamente esclusivi per costruzione');
});

test('③ 🚨 e una casella VUOTA non dichiara nessuna provenienza: verrebbe da NIENTE', () => {
  const c = casella(null, null, null, 'segreteria');
  assert.equal(c.ignoto, true);
  assert.equal(c.decisoQui, false);
});

test('③ 💰⭐ il «da» del riepilogo lo dice — ed è il punto dove si conferma del DENARO', () => {
  const euro = (c) => (c / 100).toFixed(2);
  const quando = () => '';
  assert.equal(importoDa(1500, null, euro, quando, false, true), '15.00 (deciso in segreteria)');
  assert.equal(importoDa(1500, null, euro, quando, true, false), '15.00 (dal listino)');
  assert.equal(importoDa(1500, null, euro, quando, false, false), '15.00');
  assert.equal(importoDa(null, null, euro, quando, false, true), '(non letto)');
});

// ── ④ LA SCRITTURA NATIVA ────────────────────────────────────────────────────────────────────

/** Monta `_pmoSetChargesNativo` con un mondo finto attorno e registra cosa ha scritto. */
function bancoNativo(righe, cambi, stato0) {
  const stato = { salvato: 0, spinto: 0 };
  const magazzino = { staffBookings: [{ id: 'PMO-1', data: '2026-12-10', campo: '1', ora: '11:00', giocatori: righe }] };
  const schedaRoster = righe.map((g, i) => (typeof g === 'string' ? { nome: g, idx: i } : Object.assign({ idx: i }, g)));
  const fn = esegui('_pmoSetChargesNativo', {
    staffCalPlayersState: Object.assign({ isoDate: '2026-12-10', campo: 1, ora: '11:00', roster: schedaRoster }, stato0 || {}),
    safeLoad: (k, d) => (k in magazzino ? magazzino[k] : d),
    save: (k, v) => { magazzino[k] = v; stato.salvato++; },
    staffCalCloudSyncEdit: () => { stato.spinto++; },
  }, true);
  return fn({ changes: cambi }).then((esito) => ({
    esito, stato, righe: magazzino.staffBookings[0].giocatori, roster: schedaRoster,
  }));
}

test('④ ✍️ scrive l\'importo, lo spinge al cloud, e marca la provenienza', async () => {
  const r = await bancoNativo(
    [{ nome: 'Lidia Comes', idx: 0 }, { nome: 'Fabiola Limuti', idx: 1 }],
    [{ idx: 0, nome: 'Lidia Comes', aCents: 1500 }, { idx: 1, nome: 'Fabiola Limuti', aCents: 1500 }]);
  assert.equal(r.esito.ok, true);
  assert.equal(r.esito.done, 2);
  assert.equal(r.righe[0].importoCents, 1500);
  assert.equal(r.righe[0].pendenteCents, 1500, 'nessuno ha ancora pagato');
  assert.equal(r.righe[0].origineImporto, 'segreteria');
  assert.equal(r.stato.salvato, 1);
  assert.equal(r.stato.spinto, 1, 'senza la spinta al cloud la cassa non lo vedrebbe mai');
});

test('④ 🚨 NON scrive `lettoAt`: questo numero il circolo non l\'ha mai detto (regola ④ della 180)', async () => {
  const r = await bancoNativo([{ nome: 'Lidia Comes', idx: 0 }], [{ idx: 0, nome: 'Lidia Comes', aCents: 1500 }]);
  assert.equal(r.righe[0].lettoAt, undefined);
});

test('④ 🚨 e una marca VECCHIA si toglie: descriveva il numero di prima, non questo', async () => {
  const r = await bancoNativo(
    [{ nome: 'Lidia Comes', idx: 0, importoCents: 800, lettoAt: '2026-09-01T10:00:00.000Z' }],
    [{ idx: 0, nome: 'Lidia Comes', aCents: 1500 }]);
  assert.equal(r.righe[0].importoCents, 1500);
  assert.equal(r.righe[0].lettoAt, undefined, 'un lettoAt che sopravvive al numero si riattacca al primo che passa');
  assert.equal(r.righe[0].origineImporto, 'segreteria');
});

test('④ 💰⭐⭐ una riga GIÀ RISCOSSA non torna a debito: sopra un incasso vero', async () => {
  const r = await bancoNativo(
    [{ nome: 'Lidia Comes', idx: 0, importoCents: 800, pendenteCents: 0, stato: 'riscosso' }],
    [{ idx: 0, nome: 'Lidia Comes', aCents: 1500 }]);
  assert.equal(r.righe[0].importoCents, 1500, 'l\'importo a carico si può correggere');
  assert.equal(r.righe[0].pendenteCents, 0, 'ma il pendente NO: quei soldi sono già entrati');
});

test('④ 🩹 le righe STRINGA diventano oggetti prima (il sync scrive i nomi — caso della 142)', async () => {
  const r = await bancoNativo(['Lidia Comes'], [{ idx: 0, nome: 'Lidia Comes', aCents: 1500 }]);
  assert.equal(typeof r.righe[0], 'object');
  assert.equal(r.righe[0].nome, 'Lidia Comes');
  assert.equal(r.righe[0].importoCents, 1500);
});

test('④ ⛔ un\'OCCUPAZIONE del sync (senza `id`) non si tocca: non è nostra', async () => {
  const magazzino = { staffBookings: [{ data: '2026-12-10', campo: '1', ora: '11:00', giocatori: [{ nome: 'X' }] }] };
  const fn = esegui('_pmoSetChargesNativo', {
    staffCalPlayersState: { isoDate: '2026-12-10', campo: 1, ora: '11:00', roster: [] },
    safeLoad: (k, d) => (k in magazzino ? magazzino[k] : d),
    save: () => { throw new Error('non deve salvare'); },
    staffCalCloudSyncEdit: () => { throw new Error('non deve spingere'); },
  }, true);
  const esito = await fn({ changes: [{ idx: 0, nome: 'X', aCents: 1500 }] });
  assert.equal(esito.ok, false);
  assert.equal(esito.message, 'RIGA_NON_TROVATA');
});

test('④ 🚨 e la scheda aperta mostra subito il numero, senza aspettare una rilettura', async () => {
  const r = await bancoNativo([{ nome: 'Lidia Comes', idx: 0 }], [{ idx: 0, nome: 'Lidia Comes', aCents: 1500 }]);
  assert.equal(r.roster[0].importoCents, 1500);
  assert.equal(r.roster[0].origineImporto, 'segreteria');
});

// ── GUARDIE TESTUALI ─────────────────────────────────────────────────────────────────────────
// ⚠️ Una guardia che cerca una PAROLA prova che la parola c'è, non che il codice succeda: sono
//    dichiarate per quello che sono. Stanno qui perché il bivio che sorvegliano è quello che il
//    passaggio della voce 184 farà scadere in silenzio.

test('🛡️ il bivio si decide sul REF del gestionale, mai sull\'hostname (⇒ voce 184)', () => {
  const i = APP.indexOf('async function _pmoSetCharges(opts)');
  assert.ok(i > 0);
  const zona = APP.slice(i, i + 4000);
  assert.match(zona, /pmoGestionaleCollegatoAlCircolo/,
    'il ramo nativo deve nascere dal ref, non da dove è servita la pagina');
  assert.doesNotMatch(zona, /pmoIsTestHostname|location\.hostname/,
    'l\'hostname scade col passaggio: una guardia che scade senza dirlo è peggio di nessuna guardia');
});

test('🛡️ nel dubbio si resta sulla strada di PROD (sbagliare da lì FALLISCE, non inventa)', () => {
  const i = APP.indexOf('let _collegatoAlCircolo = true;');
  assert.ok(i > 0, 'il valore di partenza deve essere «collegato»');
  assert.match(APP.slice(i, i + 700), /catch\s*\(e\)\s*\{\s*_collegatoAlCircolo\s*=\s*true;/,
    'se la configurazione non si legge, si NON si scrive in un libro solo nostro');
});

// ── CONTROLLO NEGATIVO: il banco deve saper CADERE ────────────────────────────────────────────
// 📌 *Un banco che non cade quando lo si sabota non difende niente* — e i quattro sabotaggi qui
//    sotto sono i quattro modi realistici di rompere questa voce.

test('🧪 SABOTAGGI — quattro, e tutti e quattro devono far cadere qualcosa', () => {
  const cadeConIl = (fn) => { try { fn(); return false; } catch (e) { return true; } };

  // ⓵ «chiedere» acceso anche quando il listino non è caricato ⇒ si disturba chi lavora.
  const perche1 = new Function('_pmoOraPulita', 'pmoOraDentroLaFascia',
    'return function p(m,d,o){ return { prezzoCents:null, motivo:"listino-non-caricato", chiedere:true }; };')(oraPulita, dentroLaFascia);
  assert.ok(cadeConIl(() => assert.equal(perche1(null, '2026-12-10', '11:00').chiedere, false)),
    'sabotaggio ⓵ non visto: un listino lento farebbe nascere una domanda inutile');

  // ⓶ «fuori fascia» silenzioso ⇒ torna il difetto originale: la cassa senza numero, senza dirlo.
  const perche2 = new Function(
    'return function p(m,d,o){ return { prezzoCents:null, motivo:"fuori-da-ogni-fascia", chiedere:false }; };')();
  assert.ok(cadeConIl(() => assert.equal(perche2(MAPPA, '2026-12-10', '11:00').chiedere, true)),
    'sabotaggio ⓶ non visto: il buco tornerebbe muto');

  // ⓷ la marca della segreteria letta come «dal listino» ⇒ una cifra scelta a mano si vende come
  //    prezzo del circolo, che è il difetto curato dal quarto esito della 180.
  const casella3 = new Function('return function c(i,p,l,o){ return { ignoto:false, ricordato:false, natoQui:true, decisoQui:false }; };')();
  assert.ok(cadeConIl(() => assert.equal(casella3(1500, 1500, null, 'segreteria').decisoQui, true)),
    'sabotaggio ⓷ non visto: la provenienza non arriverebbe agli occhi');

  // ⓸ il pendente riportato a debito su una riga già riscossa ⇒ un debito inventato sopra un incasso.
  const righe = [{ nome: 'X', importoCents: 800, pendenteCents: 0, stato: 'riscosso' }];
  const sabotata = righe.map((r) => Object.assign({}, r, { importoCents: 1500, pendenteCents: 1500 }));
  assert.ok(cadeConIl(() => assert.equal(sabotata[0].pendenteCents, 0)),
    'sabotaggio ⓸ non visto: si potrebbe richiedere del denaro già incassato');
});

console.log('\n' + passed + ' passati, ' + failed + ' falliti');
if (failed) process.exit(1);
