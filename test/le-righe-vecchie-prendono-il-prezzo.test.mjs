/* 📦💶 «Le righe che c'erano già prendono il prezzo» — banco della VOCE 180 (09/09/2026).
 *
 * 📏 IL PROBLEMA MISURATO: delle `staff_booking` vive sul gestionale nuovo, **2 su 30** portano
 *   gli importi — e sono le due che qualcuno ha aperto a mano (le stesse due con `lettoAt`).
 *   Tutte le altre hanno solo i nomi. Il prezzo che nasce dal listino vale da adesso in avanti:
 *   le righe di prima resterebbero senza, e la cassa non avrebbe su cosa addebitare.
 *
 * ⚖️ LA SCELTA: riempire ALL'APERTURA della scheda, non con una migrazione una-tantum.
 *   Una migrazione invecchia (cura le righe di oggi, non quelle che nascono domani da una strada
 *   che ancora non conosciamo); questa è idempotente per costruzione e mette il prezzo nel
 *   momento in cui qualcuno sta per usarlo.
 *
 * 🎯 LE CINQUE COSE CHE QUESTO BANCO DIFENDE:
 *   ① riempie chi non ha importo, e chi ce l'ha NON si tocca (regola ②);
 *   ② 🚨 è IDEMPOTENTE: la seconda apertura non scrive e non ripinge al cloud. *Un campanello che
 *      suona sempre non dice più niente* — è la ragione per cui `_pmoRosterCambiato` esiste;
 *   ③ 🚨 senza prezzo (listino non caricato · giorno chiuso · fascia senza prezzo · data passata)
 *      non si scrive NIENTE: uno zero direbbe «gratis», che è un'altra cosa.
 *      ⚖️ **Qui due guardie proteggono lo stesso caso**, e va detto invece di far finta: l'uscita
 *      `if (prezzo === null) return false` e la regola ① dentro `_pmoImportiDalListino`. Tolta una,
 *      l'altra regge — quindi un sabotaggio su una sola resta verde, e non perché il banco sia
 *      debole. La regola ① è tenuta ferma dal banco `limporto-del-giocatore-aggiunto`, che la
 *      confronta con la gemella dell'edge;
 *   ④ 🚨 le righe STRINGA (il sync scrive l'elenco come nomi) si portano alla forma a oggetto,
 *      o l'importo finirebbe addosso a un `String`. È il caso della 142, su un quarto dei record;
 *   ⑤ ⛔ le OCCUPAZIONI del sync (senza `id`) non si toccano: non sono nostre.
 *
 * ⛔ QUELLO CHE NON DICE, e va detto: una riga che nessuno apre resta senza importo. È onesto,
 *    non completo.
 *
 * Esegui:  node test/le-righe-vecchie-prendono-il-prezzo.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(QUI, '..', 'index.html'), 'utf8');
assert.ok(APP.length > 500000, 'sorgente non letto: questo banco non direbbe niente');

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
    const c = APP[k]; out += c;
    if (c === '{') { g++; visto = true; }
    else if (c === '}') { g--; if (visto && g === 0) break; }
  }
  return out;
}
function parametriDi(nome) {
  const i = APP.indexOf('function ' + nome + '(');
  return APP.slice(i + ('function ' + nome + '(').length, APP.indexOf(') {', i));
}
function esegui(nome, dip) {
  const nomi = Object.keys(dip || {}), vals = nomi.map((k) => dip[k]);
  return new Function(...nomi,
    'return function ' + nome + '(' + parametriDi(nome) + ') ' + corpoDi(nome) + ';')(...vals);
}

const oraPulita = esegui('_pmoOraPulita', {});
// 🎯 VOCE 188 — `_pmoPrezzoDelloSlot` chiede adesso la fascia che CONTIENE l'ora: senza montarle
//    anche questa dipendenza, il banco cadrebbe su un `is not defined` e sembrerebbe un difetto
//    della cura invece che del banco.
const dentroLaFascia = esegui('pmoOraDentroLaFascia', {});
// 🆕 VOCE 188/B — il ciclo sulle fasce vive adesso in `_pmoPerchePrezzoAssente`, e
// `_pmoPrezzoDelloSlot` gli delega: si monta prima quella, o si esercita una funzione che
// nell'app non esiste più.
const percheAssente = esegui('_pmoPerchePrezzoAssente', { _pmoOraPulita: oraPulita, pmoOraDentroLaFascia: dentroLaFascia });
const prezzoSlot = esegui('_pmoPrezzoDelloSlot', { _pmoPerchePrezzoAssente: percheAssente });
const importiApp = esegui('_pmoImportiDalListino', {});

/* 🚨 IL FIXTURE DEVE CONTENERE L'INPUT CHE LA GUARDIA DEVE FERMARE, o il sabotaggio resta verde.
 *   Misurato scrivendo questo banco: con la sola fascia da 1300 il sabotaggio «una fascia senza
 *   prezzo torna 0 invece di null» **non cadeva** — non perché la guardia mancasse, ma perché non
 *   c'era niente da fermare. ⇒ La fascia delle 21:00 è qui apposta, e vale più di un caso in più.
 *   📌 *Una guardia si prova sull'input che deve fermare: su un input innocuo resta verde per sempre.* */
const MAPPA = { '2026-12-30': { chiuso: false, slots: [
                  { start: '19:30:00', end: '21:00:00', prezzoCents: 1300 },
                  { start: '21:00:00', end: '22:30:00', prezzoCents: null },
                ] },
                '2026-12-25': { chiuso: true, slots: [{ start: '19:30:00', end: '21:00:00', prezzoCents: 1300 }] } };

/** Monta la funzione vera con un mondo finto attorno, e registra cosa ha scritto. */
function banco(opts) {
  const stato = { salvato: 0, spinto: 0, avvisi: [] };
  const magazzino = { staffBookings: opts.righe };
  const riempi = esegui('_staffCalRiempiImportiDalListino', {
    _pmoPrezzoDelloSlot: prezzoSlot,
    _pmoImportiDalListino: importiApp,
    pmoCalendarioMappa: ('mappa' in opts) ? opts.mappa : MAPPA,
    safeLoad: (k, d) => (k in magazzino ? magazzino[k] : d),
    save: (k, v) => { magazzino[k] = v; stato.salvato++; },
    staffCalCloudSyncEdit: () => { stato.spinto++; },
    console: { warn: (...a) => stato.avvisi.push(a.join(' ')) },
  });
  return { riempi, stato, magazzino };
}
const RIGA = (giocatori, extra) => Object.assign(
  { id: 'sb-1', data: '2026-12-30', campo: 'Campo 4', ora: '19:30', giocatori: giocatori }, extra || {});

// ─────────────────────────────────────────────────────────────────────────────
test('① riempie chi non ha importo', () => {
  const b = banco({ righe: [RIGA([{ nome: 'A' }, { nome: 'B' }])] });
  assert.equal(b.riempi('2026-12-30', 4, '19:30'), true);
  const g = b.magazzino.staffBookings[0].giocatori;
  assert.equal(g[0].importoCents, 1300);
  assert.equal(g[0].pendenteCents, 1300);
  assert.equal(g[0].origineImporto, 'listino');
  assert.equal('lettoAt' in g[0], false, '🚨 non l\'ha detto il circolo');
  assert.equal(b.stato.salvato, 1);
  assert.equal(b.stato.spinto, 1, 'e il cloud lo deve sapere');
});

test('① 🚨 chi ce l\'ha GIÀ non si tocca — nemmeno il suo `lettoAt`', () => {
  const b = banco({ righe: [RIGA([{ nome: 'A', importoCents: 500, pendenteCents: 500, lettoAt: '2026-09-01T00:00:00Z' }, { nome: 'B' }])] });
  assert.equal(b.riempi('2026-12-30', 4, '19:30'), true, 'B va riempito');
  const g = b.magazzino.staffBookings[0].giocatori;
  assert.equal(g[0].importoCents, 500, 'il numero del circolo vince sul listino');
  assert.equal(g[0].lettoAt, '2026-09-01T00:00:00Z', 'e resta letto: la provenienza non si riscrive');
  assert.equal(g[0].origineImporto, undefined, '🚨 e non diventa «dal listino»');
  assert.equal(g[1].importoCents, 1300);
});

test('② 🚨 IDEMPOTENTE: la seconda apertura non scrive e non ripinge', () => {
  const b = banco({ righe: [RIGA([{ nome: 'A' }])] });
  assert.equal(b.riempi('2026-12-30', 4, '19:30'), true);
  assert.equal(b.riempi('2026-12-30', 4, '19:30'), false, 'un campanello che suona sempre non dice niente');
  assert.equal(b.stato.salvato, 1);
  assert.equal(b.stato.spinto, 1);
});

test('③ 🚨 listino NON caricato ⇒ non scrive niente', () => {
  const b = banco({ righe: [RIGA([{ nome: 'A' }])], mappa: null });
  assert.equal(b.riempi('2026-12-30', 4, '19:30'), false);
  assert.equal(b.stato.salvato, 0);
  assert.equal(b.magazzino.staffBookings[0].giocatori[0].importoCents, undefined);
});

test('③ 🚨 una FASCIA SENZA PREZZO non diventa gratis — la riga resta senza importo', () => {
  const b = banco({ righe: [RIGA([{ nome: 'A' }], { ora: '21:00' })] });
  assert.equal(b.riempi('2026-12-30', 4, '21:00'), false, 'zero vorrebbe dire «gratis», che è un\'altra cosa');
  assert.equal(b.stato.salvato, 0);
  assert.equal(b.magazzino.staffBookings[0].giocatori[0].importoCents, undefined);
});

test('③ 🚨 giorno CHIUSO ⇒ non scrive niente', () => {
  const b = banco({ righe: [RIGA([{ nome: 'A' }], { data: '2026-12-25' })] });
  assert.equal(b.riempi('2026-12-25', 4, '19:30'), false);
});

test('③ 🚨 data fuori dalla tratta caricata (una partita passata) ⇒ non scrive niente', () => {
  const b = banco({ righe: [RIGA([{ nome: 'A' }], { data: '2026-01-05' })] });
  assert.equal(b.riempi('2026-01-05', 4, '19:30'), false, 'un prezzo inventato a ritroso è peggio del vuoto');
});

test('④ 🚨 le righe STRINGA diventano oggetti prima di prendere l\'importo', () => {
  const b = banco({ righe: [RIGA(['Mario Rossi', 'Anna Verdi'])] });
  assert.equal(b.riempi('2026-12-30', 4, '19:30'), true);
  const g = b.magazzino.staffBookings[0].giocatori;
  assert.equal(g[0].nome, 'Mario Rossi');
  assert.equal(g[0].importoCents, 1300, 'senza la conversione l\'importo finirebbe addosso a un String');
  assert.equal(g[1].nome, 'Anna Verdi');
});

test('⑤ ⛔ un\'OCCUPAZIONE del sync (senza id) non si tocca', () => {
  const b = banco({ righe: [RIGA([{ nome: 'A' }], { id: undefined })] });
  assert.equal(b.riempi('2026-12-30', 4, '19:30'), false, 'non è nostra');
  assert.equal(b.stato.salvato, 0);
});

test('⑤ e uno slot che non esiste in locale non fa niente e non esplode', () => {
  const b = banco({ righe: [RIGA([{ nome: 'A' }])] });
  assert.equal(b.riempi('2026-12-30', 9, '19:30'), false, 'campo diverso');
  assert.equal(b.riempi('2026-12-30', 4, '08:00'), false, 'ora diversa');
  assert.equal(b.stato.salvato, 0);
});

test('⑤ una prenotazione senza giocatori non fa niente', () => {
  const b = banco({ righe: [RIGA([])] });
  assert.equal(b.riempi('2026-12-30', 4, '19:30'), false);
});

// ─────────────────────────────────────────────────────────────────────────────
test('🔌 la scheda RIEMPIE all\'apertura, e PRIMA di leggere il roster locale', () => {
  const corpo = corpoDi('staffCalEditPlayers');
  const iRiempi = corpo.indexOf('_staffCalRiempiImportiDalListino(isoDate, campoNum, ora)');
  const iLeggi = corpo.indexOf('_localRoster = _normRoster(_b.giocatori)');
  assert.ok(iRiempi > 0, 'senza la chiamata la cura non parte mai');
  assert.ok(iLeggi > 0, 'non trovo la lettura del roster locale');
  assert.ok(iRiempi < iLeggi,
    'riempire DOPO aver letto mostrerebbe lo stato vecchio: il prezzo comparirebbe solo alla riapertura');
});

console.log('\n' + passed + ' passati, ' + failed + ' falliti');
process.exit(failed ? 1 : 0);
