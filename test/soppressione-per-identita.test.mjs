// ── BANCO: «la soppressione nasconde UNA PRENOTAZIONE, non uno SLOT» ────────────────────────
//
// 📏 Il difetto, misurato sul vero il 21/08/2026 e visto dal committente sul gestionale.
// Alle 12:13:17 viene annullata una partita sul 22/08 · 09:00 · campo 4 ⇒ parte la soppressione
// di quello slot (TTL 30′). Alle 12:17 sullo STESSO slot nasce un'altra prenotazione — la
// lezione delle 9 col maestro Lucas, due allieve, `idReserva 9556` — e alle 12:18:46 il sync la
// porta nel gestionale, viva. Ma la soppressione nascondeva **lo slot**: per 27 minuti il
// calendario dello staff ha mostrato quel campo LIBERO, con una lezione vera sopra.
//
// ⚖️ Il verso che fa male non è la lezione che sparisce — è il campo che sembra libero, cioè
// quello su cui qualcuno prenota sopra. Perciò i casi qui sotto vanno in DUE versi: che la
// prenotazione nuova si veda, e che la copia stantia di quella annullata resti nascosta.
//
// ⭐ La funzione è ESTRATTA dal sorgente vero (`index.html`), non ricopiata: un caso che si
// riscrive il codice da sé resta verde anche quando il codice non c'è più.
//
// Uso:  node test/soppressione-per-identita.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const QUI = dirname(fileURLToPath(import.meta.url));
const APP = join(QUI, '..', 'index.html');
const src = readFileSync(APP, 'utf8');

/** Estrae una funzione dal sorgente dell'app, per nome, col suo corpo vero. */
function estrai(nome) {
  const inizio = src.indexOf(`function ${nome}(`);
  if (inizio < 0) throw new Error(`funzione «${nome}» non trovata in index.html`);
  let i = src.indexOf('{', src.indexOf(')', inizio)), livello = 0, stringa = null, prec = '';
  for (; i < src.length; i++) {
    const c = src[i], succ = src[i + 1];
    if (stringa) { if (c === stringa && prec !== '\\') stringa = null; }
    else if (c === '/' && succ === '/') { const f = src.indexOf('\n', i); i = f < 0 ? src.length : f; prec = '\n'; continue; }
    else if (c === '/' && succ === '*') { const f = src.indexOf('*/', i + 2); i = f < 0 ? src.length : f + 1; prec = '/'; continue; }
    else if (c === '"' || c === "'" || c === '`') stringa = c;
    else if (c === '{') livello++;
    else if (c === '}') { livello--; if (livello === 0) { i++; break; } }
    prec = c;
  }
  return src.slice(inizio, i);
}

const ctx = { console: { log() {}, warn() {}, error() {} } };
vm.createContext(ctx);
vm.runInContext(estrai('pmoSoppressioneNasconde'), ctx);
const nasconde = ctx.pmoSoppressioneNasconde;

let rossi = 0;
function caso(nome, fn) {
  try { fn(); console.log(`✅ ${nome}`); }
  catch (e) { rossi++; console.log(`❌ ${nome}\n   ${e && e.message}`); }
}

console.log('\n🧪 BANCO: la soppressione nasconde una PRENOTAZIONE, non uno slot\n');

// ── Il caso vero, quello che è successo ─────────────────────────────────────
const soppressa9507 = { ts: 1787307197788, ids: ['9507'] };

caso('🚨 IL CASO DEL 21/08: la lezione 9556 arrivata dopo l\'annullo della 9507 NON si nasconde', () => {
  const lezione = { idReserva: '9556', tipo: 'Lezione Libera', istruttore: 'Lucas Vidal' };
  assert.equal(nasconde(lezione, soppressa9507), false,
    'la lezione di sabato mattina resta nascosta: il campo sembra libero e non lo è');
});

caso('⚖️ …e la copia STANTIA della prenotazione annullata resta nascosta', () => {
  const stantia = { idReserva: '9507', tipo: 'Partita' };
  assert.equal(nasconde(stantia, soppressa9507), true,
    'la card fantasma torna a comparire: è il difetto che la soppressione esiste per chiudere');
});

// ── I casi che non si sanno leggere: verso prudente ─────────────────────────
caso('⚠️ una riga SENZA idReserva resta nascosta, come prima (manutenzioni, card vecchie)', () => {
  assert.equal(nasconde({ tipo: 'manutenzione' }, soppressa9507), true);
  assert.equal(nasconde({ idReserva: '', tipo: 'Partita' }, soppressa9507), true);
  assert.equal(nasconde({ idReserva: '   ' }, soppressa9507), true);
});

caso('⚠️ una soppressione VECCHIA (senza lista) nasconde lo slot, come prima', () => {
  for (const vecchia of [{ ts: 1 }, { ts: 1, ids: null }, { ts: 1, ids: [] }]) {
    assert.equal(nasconde({ idReserva: '9556' }, vecchia), true,
      `soppressione ${JSON.stringify(vecchia)}: dovrebbe comportarsi come prima della cura`);
  }
});

caso('⚠️ l\'hide ottimistico cross-device nasce CIECO e nasconde tutto', () => {
  // `_staffCalGetSuppressed` gli mette `ids: null` di proposito: lì non si sa ancora cosa sia
  // stato annullato, e finché non si sa il verso giusto è nascondere.
  assert.equal(nasconde({ idReserva: '9556' }, { ts: Date.now(), ids: null }), true);
});

// ── Le forme del dato, che non sono tutte uguali ────────────────────────────
caso('gli id si confrontano come TESTO: 9556 numero e "9556" stringa sono la stessa prenotazione', () => {
  assert.equal(nasconde({ idReserva: 9507 }, soppressa9507), true, 'numero non riconosciuto');
  assert.equal(nasconde({ idReserva: '9507' }, { ts: 1, ids: [9507] }), true, 'lista di numeri non riconosciuta');
});

caso('più prenotazioni annullate insieme sullo stesso slot: si nascondono tutte, e solo quelle', () => {
  const s = { ts: 1, ids: ['9507', '9506'] };
  assert.equal(nasconde({ idReserva: '9507' }, s), true);
  assert.equal(nasconde({ idReserva: '9506' }, s), true);
  assert.equal(nasconde({ idReserva: '9556' }, s), false);
});

caso('🧪 IL CONTROLLO DEL METRO: senza soppressione non si nasconde niente', () => {
  assert.equal(nasconde({ idReserva: '9507' }, null), false);
  assert.equal(nasconde({ idReserva: '9507' }, undefined), false);
});

// ── LA RACCOLTA, che è l'altra metà e senza la quale la decisione gira a vuoto ──
//
// 🔪 Questi casi nascono da un sabotaggio che NON mordeva: spegnendo la riga che raccoglie gli
// `idReserva`, la decisione restava giusta su una lista sempre vuota — cioè ogni soppressione
// nasceva cieca e il difetto del 21/08 tornava intero, col banco tutto verde. È la 43ª: il
// verde muto perché il dato non arriva mai fin lì.

vm.runInContext(estrai('pmoSoppressioneIds'), ctx);

/** Prepara il mondo che la funzione legge, e la chiama. */
function idsSuLoSlot(mondo, data, campo, ora) {
  ctx.prenotazioniOccupazione = mondo.occupancy || [];
  ctx.prenotazioni = mondo.bookings || [];
  ctx.safeLoad = (chiave, dflt) => (chiave === 'staffBookings' ? (mondo.staff || []) : dflt);
  // ⚠️ `Array.from` non è un vezzo: l'array torna dal contesto `vm`, quindi ha il prototipo di
  // un ALTRO realm, e `assert/strict` confronta anche quello — «same structure but not
  // reference-equal». Riportarlo qui è la differenza fra un rosso vero e un rosso di attrezzo.
  return Array.from(ctx.pmoSoppressioneIds(data, campo, ora));
}

caso('🚨 raccoglie gli idReserva che sono sullo slot ADESSO — è ciò che la soppressione ricorderà', () => {
  const ids = idsSuLoSlot({
    occupancy: [{ data: '2026-08-22', ora: '09:00', campo: 'Campo 4', idReserva: '9507' }],
  }, '2026-08-22', 4, '09:00');
  assert.deepEqual(ids, ['9507'], 'senza questo la soppressione nasce cieca e nasconde lo slot intero');
});

caso('⚖️ guarda SOLO lo slot chiesto: altri campi, altre ore, altri giorni non entrano', () => {
  const mondo = { occupancy: [
    { data: '2026-08-22', ora: '09:00', campo: 'Campo 4', idReserva: '9507' },
    { data: '2026-08-22', ora: '09:00', campo: 'Campo 3', idReserva: '1111' },
    { data: '2026-08-22', ora: '10:30', campo: 'Campo 4', idReserva: '2222' },
    { data: '2026-08-23', ora: '09:00', campo: 'Campo 4', idReserva: '3333' },
  ] };
  assert.deepEqual(idsSuLoSlot(mondo, '2026-08-22', 4, '09:00'), ['9507']);
});

caso('legge tutte e tre le fonti — occupazioni, prenotazioni e card staff — senza ripetere', () => {
  const slot = { data: '2026-08-22', ora: '09:00', campo: 'Campo 4' };
  const ids = idsSuLoSlot({
    occupancy: [{ ...slot, idReserva: '9507' }, { ...slot, idReserva: '9507' }],
    bookings: [{ ...slot, idReserva: '9507' }],
    staff: [{ data: '2026-08-22', ora: '09:00', campo: 4, idReserva: '8888' }],
  }, '2026-08-22', 4, '09:00');
  assert.deepEqual(ids.sort(), ['8888', '9507']);
});

caso('le righe senza idReserva non sporcano la lista (una lista di vuoti sarebbe una lista cieca)', () => {
  const slot = { data: '2026-08-22', ora: '09:00', campo: 'Campo 4' };
  const ids = idsSuLoSlot({ occupancy: [{ ...slot }, { ...slot, idReserva: '' }, { ...slot, idReserva: '9507' }] },
    '2026-08-22', 4, '09:00');
  assert.deepEqual(ids, ['9507']);
});

caso('🧪 IL CONTROLLO DEL METRO: su uno slot vuoto la raccolta torna vuota', () => {
  assert.deepEqual(idsSuLoSlot({}, '2026-08-22', 4, '09:00'), []);
});

// ── E la guardia della CLASSE: nessuno scrive una soppressione a mano ───────
caso('🚨 le soppressioni si costruiscono in UN POSTO SOLO', () => {
  // I punti che sopprimono sono tre (annullo, spostamento, card fantasma). Uno che se la
  // scrivesse da sé nascerebbe senza `ids`, cioè col difetto del 21/08, in un punto che
  // nessuno guarda. Il solo `record_type: 'staff_suppress'` ammesso è dentro la funzione.
  const quanti = (src.match(/record_type:\s*'staff_suppress'/g) || []).length;
  assert.equal(quanti, 1,
    `${quanti} punti scrivono un record staff_suppress: devono passare tutti da pmoRecordSoppressione`);
});

caso('🧪 IL CONTROLLO DEL METRO: la guardia della classe sa CONTARE davvero', () => {
  // Senza questo, un `quanti === 1` resterebbe verde anche se la regex non trovasse mai niente.
  const finto = `record_type: 'staff_suppress'\nrecord_type: 'staff_suppress'`;
  assert.equal((finto.match(/record_type:\s*'staff_suppress'/g) || []).length, 2);
});

console.log(`\n— ${rossi ? rossi + ' rossi' : 'tutto verde'} —\n`);
process.exit(rossi ? 1 : 0);
