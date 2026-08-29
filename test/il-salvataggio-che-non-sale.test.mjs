// il-salvataggio-che-non-sale.test.mjs — 29/08/2026
//
// 🚨⭐⭐ IL GUASTO CHE QUESTO BANCO ESISTE PER FERMARE, visto succedere su PROD.
// La sera del 29/08 la segreteria ha cambiato il livello di Maurizio Aprea DUE volte (4 → 3,5 →
// 4). Nel cloud non è arrivata nessuna delle due, e il gestionale ha detto «salvato» tutte e due
// le volte. Il giorno dopo, sullo schermo, non ne restava traccia: lo schermo diceva 3,5, il
// cloud diceva 4, e nessuno dei due sapeva di essere in disaccordo.
//
// 📏 LE DUE MISURE che l'hanno inchiodato, su PROD e non a memoria:
//   ① in tutto il 29/08 l'unica scrittura di un record `member` è stata il sync clienti delle
//      19:30 — **zero** soci su 2817 con `payload.updatedAt` di quel giorno;
//   ② sul registro `pmo_audit_log`, dal 15 al 29 agosto, **67 spinte su 411 hanno scritto ZERO
//      record** — una su sei — e `pmoSyncCloudRecordsNow` le considerava tutte riuscite, perché
//      guardava `ok` e non `count`.
//
// ⚖️ PERCHÉ IL BANCO PROVA UNA TRACCIA E NON UN RAMO. I modi di perdere quella scrittura sono
// almeno quattro e stanno in punti diversi; quello che ha mangiato i due salvataggi del 29/08
// non si è potuto nominare **nemmeno leggendo il registro del database**. ⇒ Curare i rami noti
// avrebbe lasciato scoperto proprio il caso da cui la cura nasce. La traccia non ha bisogno di
// sapere quale ramo si rompe: si scrive prima di spingere, si cancella solo alla conferma.
//
// 🚨 LE PROVE SONO SUL COMPORTAMENTO: le funzioni si ESTRAGGONO da `index.html` e si ESEGUONO.
// Le due sull'ORDINE sono invece testuali, e sono dichiarate tali dove stanno: proteggono una
// decisione (dove sta la spinta nella catena), che è ciò che il codice dimentica per primo.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(QUI, '..', 'index.html'), 'utf8');

// Estrattore comune agli altri banchi che leggono `index.html`, con una differenza dichiarata:
// tiene la parola `async`. Senza, una funzione asincrona esce dal sorgente con gli `await`
// dentro e nessuna `async` davanti — cioè non compila, e il banco misurerebbe l'estrattore.
function estrai(nome) {
  const ancora = html.indexOf(`function ${nome}(`);
  if (ancora < 0) throw new Error(`funzione «${nome}» non trovata in index.html`);
  const inizio = html.slice(Math.max(0, ancora - 6), ancora) === 'async ' ? ancora - 6 : ancora;
  let t = html.indexOf('(', ancora), tonde = 0;
  for (; t < html.length; t++) {
    if (html[t] === '(') tonde++;
    else if (html[t] === ')') { tonde--; if (tonde === 0) { t++; break; } }
  }
  let i = html.indexOf('{', t), livello = 0, stringa = null, prec = '';
  for (; i < html.length; i++) {
    const c = html[i], succ = html[i + 1];
    if (stringa) { if (c === stringa && prec !== '\\') stringa = null; }
    else if (c === '/' && succ === '/') { const fine = html.indexOf('\n', i); i = fine < 0 ? html.length : fine; prec = '\n'; continue; }
    else if (c === '/' && succ === '*') { const fine = html.indexOf('*/', i + 2); i = fine < 0 ? html.length : fine + 1; prec = '/'; continue; }
    else if (c === '"' || c === "'" || c === '`') stringa = c;
    else if (c === '{') livello++;
    else if (c === '}') { livello--; if (livello === 0) { i++; break; } }
    prec = c;
  }
  return html.slice(inizio, i);
}

// Un browser finto: `localStorage` vero abbastanza da provarci sopra, e i toast raccolti.
function banco(extra = {}) {
  const magazzino = new Map();
  const avvisi = [];
  const ctx = {
    console: { warn() {}, log() {}, info() {} },
    localStorage: {
      getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
      setItem: (k, v) => { magazzino.set(k, String(v)); },
      removeItem: (k) => { magazzino.delete(k); }
    },
    JSON, Object, Array, Number, String, Date, Error, setTimeout,
    cleanCell: (v) => (v === null || v === undefined ? '' : String(v).trim()),
    escapeHtml: (v) => String(v == null ? '' : v),
    playerFullName: (m) => String((m && m.name) || ''),
    showAlert: (msg, tipo) => { avvisi.push({ msg: String(msg), tipo }); },
    pmoMemberCloudLocalKey: (m) => (m && m.phone ? `phone:${String(m.phone).replace(/\D/g, '')}` : ''),
    ...extra
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  ['pmoMemberSospesiLeggi', 'pmoMemberSospesiScrivi', 'pmoMemberSospesoChiave',
   'pmoMemberSospesoSegna', 'pmoMemberSospesoTogli', 'pmoMemberSospesiElenco',
   'pmoMemberSospesiAvvisa'].forEach(n => vm.runInContext(estrai(n), ctx));
  vm.runInContext(`const PMO_MEMBER_SOSPESI_KEY = 'pmoMemberCloudSospesi';`, ctx);
  return { ctx, avvisi, magazzino };
}

const SOCIO = { id: 'abc-123', name: 'Maurizio Aprea', phone: '+393357615855', level: 3.5 };

// ── ① IL CONTEGGIO: `ok:true` con zero record scritti NON è un salvataggio riuscito ──────────
// È il difetto misurato 67 volte in quindici giorni.

function bancoSpinta(rispostaRpc) {
  const { ctx, avvisi } = banco({
    pmoCloudState: {},
    save() {},
    pmoRequireStaffPermission: async () => ({ accessToken: 'x', profile: {} }),
    pmoCloudRpc: async () => rispostaRpc,
    pmoFriendlyCloudError: (v) => String((v && v.message) || v || 'errore')
  });
  vm.runInContext(estrai('pmoSyncCloudRecordsNow'), ctx);
  return { ctx, avvisi };
}

const UN_RECORD = [{ record_type: 'member', local_key: 'phone:393357615855', payload: {} }];

test('una spinta che scrive ZERO record fallisce, invece di passare per riuscita', async () => {
  const { ctx } = bancoSpinta({ ok: true, count: 0 });
  await assert.rejects(
    () => ctx.pmoSyncCloudRecordsNow(UN_RECORD, 'salvare la scheda socio'),
    /non ha scritto nessun record/i
  );
});

test('…e lo stesso se il conteggio manca del tutto (risposta vecchia o malformata)', async () => {
  const { ctx } = bancoSpinta({ ok: true });
  await assert.rejects(() => ctx.pmoSyncCloudRecordsNow(UN_RECORD, 'salvare la scheda socio'));
});

test('una spinta che scrive davvero passa — la cura non blocca la cosa giusta', async () => {
  const { ctx } = bancoSpinta({ ok: true, count: 1 });
  const esito = await ctx.pmoSyncCloudRecordsNow(UN_RECORD, 'salvare la scheda socio');
  assert.equal(esito.ok, true);
});

test('un lotto che scrive MENO di quanti ne manda passa: la RPC fonde i soci sulla stessa riga viva', async () => {
  // ⚖️ Il confronto è con lo zero e non con `list.length`, di proposito: `distinct on (local_key)`
  // può legittimamente fondere due record. Un banco che pretendesse la parità sarebbe rosso su
  // un comportamento corretto — e una guardia che ha torto ogni tanto si smette di leggere.
  const { ctx } = bancoSpinta({ ok: true, count: 1 });
  const due = [UN_RECORD[0], { ...UN_RECORD[0] }];
  const esito = await ctx.pmoSyncCloudRecordsNow(due, 'salvare due schede');
  assert.equal(esito.ok, true);
});

// ── ② LA TRACCIA: si scrive prima di spingere, si cancella SOLO alla conferma ────────────────

test('la traccia nasce col segno e sparisce solo quando la si toglie', () => {
  const { ctx } = banco();
  assert.equal(ctx.pmoMemberSospesiElenco().length, 0);
  ctx.pmoMemberSospesoSegna(SOCIO, 'salvare la scheda socio');
  const elenco = ctx.pmoMemberSospesiElenco();
  assert.equal(elenco.length, 1);
  assert.equal(elenco[0].nome, 'Maurizio Aprea');
  ctx.pmoMemberSospesoTogli(SOCIO);
  assert.equal(ctx.pmoMemberSospesiElenco().length, 0);
});

test('lo stesso socio segnato due volte resta UNA traccia, non due', () => {
  const { ctx } = banco();
  ctx.pmoMemberSospesoSegna(SOCIO, 'primo salvataggio');
  ctx.pmoMemberSospesoSegna(SOCIO, 'secondo salvataggio');
  assert.equal(ctx.pmoMemberSospesiElenco().length, 1);
});

test('una memoria del browser piena non fa fallire il salvataggio: la traccia si perde, il resto no', () => {
  // 📌 Una traccia perduta è un peccato; un salvataggio perduto PER COLPA della traccia sarebbe
  // il difetto che questa cura esiste per togliere.
  const { ctx } = banco();
  ctx.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.doesNotThrow(() => ctx.pmoMemberSospesoSegna(SOCIO, 'salvare la scheda socio'));
});

test('un magazzino corrotto non fa esplodere la lettura', () => {
  const { ctx } = banco();
  ctx.localStorage.setItem('pmoMemberCloudSospesi', '{non json');
  assert.deepEqual(ctx.pmoMemberSospesiElenco(), []);
});

test('all’avvio le tracce rimaste si DICONO, con quanti sono e il nome', () => {
  const { ctx, avvisi } = banco();
  ctx.pmoMemberSospesoSegna(SOCIO, 'salvare la scheda socio');
  assert.equal(ctx.pmoMemberSospesiAvvisa(), 1);
  assert.equal(avvisi.length, 1);
  assert.match(avvisi[0].msg, /Maurizio Aprea/);
  assert.equal(avvisi[0].tipo, 'warning');
});

test('senza tracce l’avvio TACE: un avviso che compare sempre si smette di leggere', () => {
  const { ctx, avvisi } = banco();
  assert.equal(ctx.pmoMemberSospesiAvvisa(), 0);
  assert.equal(avvisi.length, 0);
});

// ── ③ LA SPINTA E LA TRACCIA INSIEME, che è il comportamento che conta ───────────────────────

function bancoCoda(spinta, record = { record_type: 'member', local_key: 'phone:393357615855', payload: {} }) {
  const b = banco({
    pmoBuildMemberCloudRecord: () => record,
    pmoSyncCloudRecordsNow: spinta,
    pmoNotifyImmediateMemberCloudFailure: () => {}
  });
  vm.runInContext(estrai('pmoQueueImmediateMemberCloudSync'), b.ctx);
  return b;
}

test('spinta riuscita ⇒ la traccia sparisce', async () => {
  const { ctx } = bancoCoda(async () => ({ ok: true, count: 1 }));
  ctx.pmoQueueImmediateMemberCloudSync(SOCIO, 'salvare la scheda socio');
  await new Promise(r => setTimeout(r, 0));
  assert.equal(ctx.pmoMemberSospesiElenco().length, 0);
});

test('🚨 spinta FALLITA ⇒ la traccia RESTA: è il caso del 29/08', async () => {
  const { ctx } = bancoCoda(async () => { throw new Error('non ha scritto nessun record'); });
  ctx.pmoQueueImmediateMemberCloudSync(SOCIO, 'salvare la scheda socio');
  await new Promise(r => setTimeout(r, 0));
  const rimaste = ctx.pmoMemberSospesiElenco();
  assert.equal(rimaste.length, 1);
  assert.equal(rimaste[0].nome, 'Maurizio Aprea');
});

test('🚨 record non costruibile ⇒ non è più un’uscita MUTA: traccia e avviso', () => {
  const { ctx, avvisi } = bancoCoda(async () => ({ ok: true, count: 1 }), null);
  ctx.pmoQueueImmediateMemberCloudSync(SOCIO, 'salvare la scheda socio');
  assert.equal(ctx.pmoMemberSospesiElenco().length, 1);
  assert.equal(avvisi.length, 1);
});

// ── ④ L'ORDINE, e queste due prove sono TESTUALI: lo si dichiara invece di lasciarlo credere ──
// Proteggono una decisione, non un calcolo: *ciò che non si può perdere non si mette in fondo a
// una fila che può spezzarsi.* È il genere di riga che qualcuno rimette «in ordine» fra sei mesi.

// 🚨 Il corpo si guarda SENZA COMMENTI, e non è un dettaglio: la prima stesura di queste due
// prove cercava nel testo intero ed era rossa perché i commenti della cura NOMINANO
// `closeMemberCard()` e `updateStats()` per spiegare da dove sono stati spostati.
// 📌 *Un banco che legge il sorgente deve leggere il CODICE: la prosa che lo accompagna parla
// delle stesse funzioni, e misurarla è misurare chi l'ha scritta.*
function corpo(nome) {
  return estrai(nome).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

test('in saveMemberCard la spinta al cloud viene PRIMA di closeMemberCard e updateStats', () => {
  const src = corpo('saveMemberCard');
  const spinta = src.indexOf('pmoQueueImmediateMemberCloudSync');
  const chiudi = src.indexOf('closeMemberCard()');
  const stats  = src.indexOf('updateStats()');
  assert.ok(spinta > 0, 'la spinta al cloud non c’è più in saveMemberCard');
  assert.ok(chiudi > 0 && stats > 0, 'le due chiamate di interfaccia non ci sono più');
  assert.ok(spinta < chiudi, 'la spinta è finita DOPO closeMemberCard: un lancio lì se la porta via');
  assert.ok(spinta < stats,  'la spinta è finita DOPO updateStats: un lancio lì se la porta via');
});

test('in staffCalSociSaveEdit la spinta non sta più dentro un catch NUDO', () => {
  const src = corpo('staffCalSociSaveEdit');
  const spinta = src.indexOf('pmoQueueImmediateMemberCloudSync');
  const disegna = src.indexOf('displayMembers()');
  assert.ok(spinta > 0 && disegna > 0);
  assert.ok(spinta < disegna, 'la spinta è tornata in fondo alla catena');
  // ⚖️ Si guarda il `catch` ATTACCATO ALLA SPINTA, non tutti quelli della funzione: gli altri
  // (il diario, la chat) sono muti di proposito e non perdono nessun dato. Una guardia più
  // larga sarebbe rossa su codice sano, e una guardia che ha torto si smette di leggere.
  // Si guarda il PRIMO `catch` dopo la spinta — quello che la avvolge — e si pretende che il suo
  // corpo non sia vuoto. Gli altri `catch (_) {}` della funzione (il diario, la chat, e i due
  // interni a questa stessa cura) sono muti di proposito e non perdono nessun dato: una guardia
  // che li bocciasse sarebbe rossa su codice sano, e una guardia che ha torto si smette di leggere.
  const dopoLaSpinta = src.slice(spinta);
  const suoCatch = dopoLaSpinta.slice(dopoLaSpinta.indexOf('catch'));
  assert.doesNotMatch(suoCatch.slice(0, 40), /^catch\s*\(\s*\w*\s*\)\s*\{\s*\}/,
    'la spinta è di nuovo dentro un catch NUDO: è la forma più silenziosa di perdere un salvataggio');
  assert.match(dopoLaSpinta.slice(0, 900), /pmoMemberSospesoSegna/,
    'se la spinta non parte nessuno lascia la traccia: il salvataggio torna a sparire in silenzio');
});
