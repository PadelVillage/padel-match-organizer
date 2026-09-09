/* 🗓️ «La griglia non è un suggerimento» — banco della VOCE 183, metà GRIGLIA (09/09/2026).
 *
 * 🚨 IL BUCO CHE CHIUDE, e sembrava sano: `create` controllava che l'ora stesse fra le 07:00 e
 *   le 23:30, con scritto accanto *«limiti larghi: l'autorità vera è Matchpoint»*. Era vero — la
 *   griglia la faceva rispettare Matchpoint, a valle. ⇒ **Il giorno del distacco quell'autorità
 *   non esiste più**, e resta un controllo che accetta le 07:13 di un giorno di chiusura.
 *   📌 *Un controllo che delega non è un controllo: è un rimando, e vale finché vive chi lo riceve.*
 *
 * 🎯 LE TRE COSE CHE QUESTO BANCO DIFENDE:
 *   ① le regole di `verdettoSlot` — i cinque rifiuti, e che siano cinque e non uno;
 *   ② 🚨⭐ **che la regola valga per `create` e NON per gli altri gesti.** Applicarla a `cancel`
 *      impedirebbe di disdire proprio le prenotazioni fuori griglia — quelle che più meritano di
 *      sparire. È il difetto più facile da introdurre domani spostando due righe;
 *   ③ **le due copie del modulo restano identiche** (Deno non importa fuori dalla propria
 *      cartella, quindi la copia è inevitabile e va legata).
 *
 * ⛔ QUELLO CHE NON DICE: che una prenotazione vera venga rifiutata. Questo è un banco, non un
 *    gesto: dice che il meccanismo è giusto, non che qualcuno ci è passato. La prova fisica è
 *    un `create` vero contro l'edge in servizio.
 *
 * Esegui:  node --experimental-strip-types test/la-griglia-e-un-limite.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verdettoSlot } from '../supabase/functions/consumer-booking-write/fasce-prenotabili.ts';

const QUI = dirname(fileURLToPath(import.meta.url));
const EDGE = join(QUI, '..', 'supabase', 'functions');
const INDEX = readFileSync(join(EDGE, 'consumer-booking-write', 'index.ts'), 'utf8');
assert.ok(INDEX.length > 50000, 'sorgente non letto: questo banco non direbbe niente');

let passed = 0, failed = 0;
function test(nome, fn) {
  try { fn(); passed++; console.log('ok   - ' + nome); }
  catch (e) { failed++; console.log('FAIL - ' + nome + '\n       ' + e.message); }
}

/** Un giorno come lo racconta `pmo_calendario_effettivo`, già passato per `giornoDalCalendario`. */
const giorno = (fasce, extra = {}) => ({
  data: '2026-09-14', chiuso: false, motivo: null, periodo_nome: 'Griglia base', fasce, ...extra,
});
const F = (start, end, prezzoCents = 1200) => ({ start, end, name: `${start}-${end}`, prezzoCents });

const LUNEDI = [F('12:30', '14:00', 1000), F('18:00', '19:30', 1200), F('19:30', '21:00', 1300)];

/* ── ① LE REGOLE ─────────────────────────────────────────────────────────── */

test('lo slot che sta sulla griglia passa, e torna la sua fascia', () => {
  const v = verdettoSlot(giorno(LUNEDI), null, '18:00', '19:30');
  assert.equal(v.ok, true);
  assert.equal(v.fascia.end, '19:30');
  assert.equal(v.fascia.prezzoCents, 1200, 'la fascia porta il prezzo: è ciò che rende la cassa possibile');
});

test('un orario che non è un inizio di fascia viene RIFIUTATO', () => {
  const v = verdettoSlot(giorno(LUNEDI), null, '18:30', '20:00');
  assert.equal(v.ok, false);
  assert.equal(v.codice, 'SLOT_FUORI_GRIGLIA');
  assert.deepEqual(v.fasce.map((f) => f.start), ['12:30', '18:00', '19:30'],
    'il rifiuto porta con sé gli orari veri: un «no» secco costringe il socio a indovinare');
});

test('le 07:13 — dentro la finestra vecchia 07:00-23:30 — adesso NON passano', () => {
  // 🎯 È il caso esatto che il controllo vecchio lasciava entrare, ed è la ragione della voce.
  const v = verdettoSlot(giorno(LUNEDI), null, '07:13', null);
  assert.equal(v.ok, false);
  assert.equal(v.codice, 'SLOT_FUORI_GRIGLIA');
});

test('CHI NON CHIEDE UNA DURATA prende quella della fascia', () => {
  // 🚨 Il caso che tiene in piedi il domani: una fascia da 60′ e una richiesta senza durata.
  // Col confronto secco contro `DURATA_DEFAULT` (90′) questa sarebbe rifiutata, in silenzio e
  // solo su quella fascia. Oggi tutte le fasce durano 90′ ⇒ nessun banco che usi solo i dati
  // di oggi vedrebbe mai questo difetto.
  const v = verdettoSlot(giorno([F('18:00', '19:00')]), null, '18:00', null);
  assert.equal(v.ok, true);
  assert.equal(v.fascia.end, '19:00', 'la fine la dice la fascia, non l\'aritmetica su 90 minuti');
});

test('chi chiede una durata DIVERSA si sente dire di no, e non gliela si cambia sotto', () => {
  const v = verdettoSlot(giorno(LUNEDI), null, '18:00', '19:00');
  assert.equal(v.ok, false);
  assert.equal(v.codice, 'DURATA_FUORI_GRIGLIA');
  assert.equal(v.fascia.end, '19:30', 'il rifiuto sa dire quale sarebbe la fine giusta');
});

test('un GIORNO CHIUSO rifiuta anche se le fasce sono ancora attaccate', () => {
  // ⛔ La chiusura viene prima: cercare la fascia per prima vorrebbe dire farsi dire di sì da
  // una griglia che quel giorno non vale.
  const v = verdettoSlot(giorno(LUNEDI, { chiuso: true, motivo: 'Natale' }), null, '18:00', '19:30');
  assert.equal(v.ok, false);
  assert.equal(v.codice, 'GIORNO_CHIUSO');
  assert.equal(v.motivo, 'Natale');
});

test('«quel giorno non c\'è niente» e «non ho la griglia» sono DUE risposte diverse', () => {
  // 📌 Una funzione che risponde «no» a due domande diverse non risponde a nessuna delle due.
  const so = verdettoSlot(giorno([]), null, '18:00', null);
  const nonSo = verdettoSlot(null, [], '18:00', null);
  assert.equal(so.codice, 'GIORNO_SENZA_FASCE');
  assert.equal(nonSo.codice, 'GRIGLIA_SCONOSCIUTA');
  assert.notEqual(so.codice, nonSo.codice);
});

test('senza calendario si valida sul RIPIEGO — la stessa fonte che ha fatto l\'offerta', () => {
  // ⭐ Se `create` validasse solo sul calendario, nella finestra in cui la RPC è muta il socio
  // si vedrebbe offrire uno slot e poi rifiutare lo stesso slot.
  const v = verdettoSlot(null, [F('09:00', '10:30')], '09:00', '10:30');
  assert.equal(v.ok, true);
  const no = verdettoSlot(null, [F('09:00', '10:30')], '11:00', null);
  assert.equal(no.codice, 'SLOT_FUORI_GRIGLIA');
});

test('il calendario VINCE sul ripiego: un giorno letto non ricade sulla griglia vecchia', () => {
  // Il ripiego offrirebbe le 09:00; il calendario di quel giorno no ⇒ si rifiuta.
  const v = verdettoSlot(giorno(LUNEDI), [F('09:00', '10:30')], '09:00', null);
  assert.equal(v.ok, false);
  assert.equal(v.codice, 'SLOT_FUORI_GRIGLIA');
});

test('le ore arrivano anche come HH:MM:SS e vengono normalizzate', () => {
  // La colonna è `time without time zone`: PostgREST consegna `HH:MM:SS`.
  const v = verdettoSlot(giorno([F('18:00', '19:30')]), null, '18:00:00', '19:30:00');
  assert.equal(v.ok, true);
});

test('una fine STORPIATA è un rifiuto, non una fine assente', () => {
  // 🚨 Trattare l'illeggibile come «non l'ha chiesta nessuno» accetterebbe una richiesta rotta.
  const v = verdettoSlot(giorno(LUNEDI), null, '18:00', 'boh');
  assert.equal(v.ok, false);
  assert.equal(v.codice, 'DURATA_FUORI_GRIGLIA');
});

/* ── ② LA REGOLA VALE PER `create` E NON PER GLI ALTRI GESTI ──────────────── */

test('la validazione è agganciata a `create` — e a create SOLTANTO', () => {
  const chiamate = INDEX.split('verdettoSlot(').length - 1;
  assert.equal(chiamate, 1, `verdettoSlot va chiamato UNA volta sola, trovate ${chiamate}`);
  const i = INDEX.indexOf('verdettoSlot(');
  const prima = INDEX.slice(0, i);
  const guardia = prima.lastIndexOf("if (action === 'create')");
  assert.ok(guardia > 0, 'la chiamata non sta dentro un ramo `create`');
  // Fra la guardia e la chiamata non deve aprirsi un altro ramo di azione: se ce ne fosse uno,
  // `create` sarebbe solo il ramo più vicino a sinistra e non quello che comanda.
  const inMezzo = INDEX.slice(guardia, i);
  assert.equal(inMezzo.includes("action === 'cancel'"), false, 'cancel non deve entrare qui');
  assert.equal(inMezzo.includes("action === 'leave'"), false, 'leave non deve entrare qui');
});

test('la validazione sta PRIMA che lo slot venga composto', () => {
  // ⭐ Altrimenti la durata della fascia arriverebbe troppo tardi: lo slot sarebbe già stato
  // costruito su `DURATA_DEFAULT`, e l'occupazione riletta su una finestra sbagliata.
  const iVerdetto = INDEX.indexOf('verdettoSlot(');
  const iSlot = INDEX.indexOf('const slot: SlotInput = {');
  assert.ok(iVerdetto > 0 && iSlot > 0, 'punti non trovati');
  assert.ok(iVerdetto < iSlot, 'il verdetto deve precedere la costruzione dello slot');
});

test('i cinque rifiuti hanno tutti la loro uscita, e nessuno nomina un pezzo interno', () => {
  for (const codice of ['GIORNO_CHIUSO', 'GIORNO_SENZA_FASCE', 'GRIGLIA_SCONOSCIUTA', 'DURATA_FUORI_GRIGLIA', 'SLOT_FUORI_GRIGLIA']) {
    assert.ok(INDEX.includes(`'${codice}'`), `manca l'uscita per ${codice}`);
  }
  // 🚨 `il gestionale SA, il bot DICE`: verso il bot non escono nomi di pezzi interni. Si
  // guarda il blocco della griglia, non tutto il file (che parla del worker altrove a ragione).
  const i = INDEX.indexOf('verdettoSlot(');
  const blocco = INDEX.slice(i, INDEX.indexOf('const slot: SlotInput = {', i));
  for (const parola of ['worker', 'matchpoint', 'hetzner', 'playwright']) {
    assert.equal(new RegExp(parola, 'i').test(blocco), false, `il blocco nomina «${parola}» verso il bot`);
  }
});

test('la durata finale si prende dalla FASCIA, non da DURATA_DEFAULT', () => {
  assert.ok(
    /durataFinale\s*=\s*timeToMin\(verdetto\.fascia\.end\)\s*-\s*timeToMin\(verdetto\.fascia\.start\)/.test(INDEX),
    'la fine dev\'essere quella della fascia',
  );
  assert.ok(
    INDEX.includes('body.durata != null'),
    'serve distinguere «durata non chiesta» da «durata 90»: `durata` porta già dentro il default',
  );
});

/* ── ③ LE DUE COPIE DEL MODULO ────────────────────────────────────────────── */

test('le due copie di `fasce-prenotabili.ts` sono byte-identiche', () => {
  const a = readFileSync(join(EDGE, 'consumer-booking-write', 'fasce-prenotabili.ts'));
  const b = readFileSync(join(EDGE, 'consumer-player-readmodel', 'fasce-prenotabili.ts'));
  assert.ok(a.equals(b), 'le due copie sono divergute: cambiandone una si cambiano TUTTE');
});

console.log(`\n── ${passed} verdi, ${failed} rossi ──`);
process.exit(failed ? 1 : 0);
