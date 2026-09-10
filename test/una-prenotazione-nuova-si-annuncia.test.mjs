// ── BANCO: UNA PRENOTAZIONE NUOVA SI ANNUNCIA (voce 194 ①) ───────────────────────
//
// 🗣️ Sua richiesta: «bisogna attivare le notifiche sul chatbot quando c'è qualsiasi operazione».
//
// 📏 IL FATTO MISURATO PRIMA DI SCRIVERE, su `cudi`: dall'08/09 **53 prenotazioni toccate e ZERO
//    avvisi nati**. L'ultimo evento è del 07/09 15:32 — l'ultimo giro di sync prima che le sei
//    routine venissero tolte. ⇒ Una prenotazione nuova non la raccontava più nessuno, e non lo
//    diceva nessun errore.
//
// 🔎 Il buco era UNO e preciso: `edit` e `cancel` erano già passate alla strada della conferma
//    (voce 76), `create` no — quando quella voce fu scritta il sync copriva ancora tutto.
//    📌 *Una strada che copre un buco non lo chiude: lo nasconde finché non si spegne.*
//
// Uso:  node --experimental-strip-types test/una-prenotazione-nuova-si-annuncia.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fattiDaCreazione, destinatari, oggiRoma } from '../supabase/functions/_shared/fatti-da-conferma.ts';

const QUI = dirname(fileURLToPath(import.meta.url));
const CREATE = readFileSync(join(QUI, '..', 'supabase/functions/matchpoint-bookings-create/index.ts'), 'utf8');

// 🚨 Senza i commenti: la cura porta accanto a sé un commento che cita il difetto per dire che
//    l'ha tolto, e un controllo testuale lo leggerebbe come se fosse ancora vivo.
function senzaCommenti(t) {
  let out = '', i = 0, str = null, prec = '';
  while (i < t.length) {
    const c = t[i], n = t[i + 1];
    if (str) { out += c; if (c === str && prec !== '\\') str = null; prec = (prec === '\\' && c === '\\') ? '' : c; i++; continue; }
    if (c === '/' && n === '/') { const f = t.indexOf('\n', i); i = f < 0 ? t.length : f; continue; }
    if (c === '/' && n === '*') { const f = t.indexOf('*/', i + 2); i = f < 0 ? t.length : f + 2; continue; }
    if (c === '"' || c === "'" || c === '`') str = c;
    out += c; prec = c; i++;
  }
  return out;
}
const NUDO = senzaCommenti(CREATE);

const DOMANI = new Date(Date.now() + 36e5 * 30).toISOString().slice(0, 10);
const SLOT = { data: DOMANI, ora: '19:00', campo: '3' };

test('① una prenotazione nuova produce un «aggiunto» per ciascuno di quelli in campo', () => {
  const f = fattiDaCreazione({ slot: SLOT, roster: ['Maurizio Aprea', 'Lidia Comes'], tipo: 'partita', oggi: oggiRoma() });
  assert.equal(f.length, 2);
  assert.deepEqual([...new Set(f.map((x) => x.gesto))], ['aggiunto']);
  assert.deepEqual(f.map((x) => x.persona).sort(), ['Lidia Comes', 'Maurizio Aprea']);
});

test('② 🚨 il gesto è `aggiunto`, NON una parola nuova: il bot lo conosce dal 23/08', () => {
  // Se qui servisse una parola nuova, l'ordine di messa in servizio cambierebbe (prima il bot,
  // poi il CHECK, poi il gestionale) e `ponte.ts` scarterebbe il gesto nel frattempo.
  const f = fattiDaCreazione({ slot: SLOT, roster: ['Marco Aprea'], oggi: oggiRoma() });
  assert.equal(f[0].gesto, 'aggiunto');
});

test('③ 🚨 gli «Ospite» non ricevono niente: la stessa regola di tutte le sorelle', () => {
  const f = fattiDaCreazione({ slot: SLOT, roster: ['Maurizio Aprea', 'Ospite', 'Ospite'], oggi: oggiRoma() });
  assert.equal(f.length, 1);
  assert.equal(f[0].persona, 'Maurizio Aprea');
});

test('④ 🚨 una partita GIÀ GIOCATA non produce niente: un avviso lì non è tardivo, è FALSO', () => {
  const f = fattiDaCreazione({ slot: { ...SLOT, data: '2020-01-01' }, roster: ['Maurizio Aprea'], oggi: oggiRoma() });
  assert.equal(f.length, 0);
});

test('⑤ senza data non si dichiara niente: uno slot senza coordinate non è un fatto', () => {
  assert.equal(fattiDaCreazione({ slot: { data: '', ora: '19:00', campo: '3' }, roster: ['X Y'], oggi: oggiRoma() }).length, 0);
});

test('⑥ il tipo arriva al socio tradotto in parole del gestionale, mai quelle di Matchpoint', () => {
  const f = fattiDaCreazione({ slot: SLOT, roster: ['Maurizio Aprea'], tipo: 'lezione', oggi: oggiRoma() });
  assert.equal(f[0].tipo, 'lezione');
});

test('⑦ 🚨 i doppi nomi non producono due avvisi alla stessa persona', () => {
  const f = fattiDaCreazione({ slot: SLOT, roster: ['Lidia Comes', 'lidia  comes'], oggi: oggiRoma() });
  assert.equal(f.length, 1);
});

// ── l'aggancio dentro `create`, letto SENZA COMMENTI ──────────────────────────
test('⑧ 🚨 `create` dichiara i fatti — era il buco: 53 prenotazioni, zero avvisi', () => {
  assert.match(NUDO, /accodaFattiDaConferma\(/,
    'senza questa chiamata una prenotazione nuova non la racconta più nessuno');
  assert.match(NUDO, /fattiDaCreazione\(/);
});

test('⑨ 🚨 sta DENTRO `saveStaffBookingRecord`, cioè dove la prenotazione esiste davvero', () => {
  // I rami che creano sono QUATTRO (nativo/worker × sincrono/asincrono) e passano tutti di lì.
  // Agganciarlo ai rami sarebbe lo stesso lavoro quattro volte, con tre occasioni di scordarsene.
  const i = NUDO.indexOf('async function saveStaffBookingRecord');
  const fine = NUDO.indexOf('\n}', NUDO.indexOf('accodaFattiDaConferma('));
  assert.ok(i > 0 && NUDO.indexOf('accodaFattiDaConferma(') > i && fine > i,
    'la dichiarazione deve stare dentro saveStaffBookingRecord');
});

test('⑩ 🚨 DOPO l\'upsert, non prima: una riga non scritta non si annuncia', () => {
  const iUpsert = NUDO.indexOf("riga della prenotazione non scritta");
  const iFatti = NUDO.indexOf('accodaFattiDaConferma(');
  assert.ok(iUpsert > 0 && iFatti > iUpsert,
    'annunciare prima di sapere se la riga c\'è è la bugia che questo progetto insegue da luglio');
});

test('⑪ 🚨 i giocatori si passano per NOME: un oggetto diventerebbe «[object Object]»', () => {
  // destinatari() fa String(g): un {nome, codice} passato intero produce un destinatario
  // che non esiste, in silenzio.
  assert.match(NUDO, /roster:\s*\(booking\.giocatori\s*\?\?\s*\[\]\)\.map\(\(g\)\s*=>\s*g\?\.nome\)/);
  // 🩹 E la trappola è stata CHIUSA alla radice il 10/09, dopo che questo banco l'ha mostrata:
  //    `destinatari` tornava `['[object Object]']` su un oggetto, cioè un destinatario che non
  //    esiste, in silenzio. Adesso legge `.nome`. Il banco resta a pretenderlo.
  assert.deepEqual(destinatari([{ nome: 'Maurizio Aprea' }]), ['Maurizio Aprea']);
  assert.deepEqual(destinatari([{ nome: 'Ospite' }]), [], 'e un Ospite resta fuori anche da oggetto');
});

test('⑫ ⚖️ BEST-EFFORT: un guasto negli avvisi non fa fallire una prenotazione riuscita', () => {
  const i = NUDO.indexOf('accodaFattiDaConferma(');
  const attorno = NUDO.slice(Math.max(0, i - 400), i + 400);
  assert.match(attorno, /try\s*\{/);
  assert.match(attorno, /catch/);
  assert.match(NUDO, /dichiarazione_creazione_saltata/,
    'e la strada che si arrende deve lasciare una riga nel registro');
});
