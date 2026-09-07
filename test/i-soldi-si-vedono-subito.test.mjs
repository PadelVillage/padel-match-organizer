// i-soldi-si-vedono-subito.test.mjs — VOCE 142, la metà dei SOLDI (07/09/2026)
//
// 🎯 COSA DIFENDE. All'apertura della scheda partita lo stato dei pagamenti arrivava **solo** dal
// worker: finché non rispondeva, `stato` era `null` e ogni riga diceva «non lo so ancora» —
// **anche per chi il gestionale SA che ha pagato**. Il dato era già in mano (record `payment`,
// sync ogni 5′) e veniva consultato SOLO per decorare uno stato che il worker aveva già dato.
// 🗣️ È la frase da cui la voce nasce: *«così quando clicco su una scheda ho tutti i dati
// immediatamente»*.
//
// 📏 E LA MISURA CHE HA CAMBIATO LA CURA, fatta su PROD il 07/09 PRIMA di scrivere una riga —
// perché per leggere quei record bisogna sapere riconoscere uno storno, e il codice non lo sapeva:
//   · il booleano `voided`, che era la PRIMA metà della condizione, non ce l'ha **nessuna** delle
//     **3320** righe ⇒ era una difesa **morta**, con l'aria di difendere;
//   · lo stesso stato è scritto in **DUE** modi — `voided` (20 righe, 03/06 → 26/08) e `void`
//     (3 righe, nate il 06/09 alle 22:08) ⇒ `status === 'void'` ne riconosceva **3 su 23**;
//   · le 20 vecchie non fanno danno **oggi** solo perché sono `deleted` e `_incassiFetch` le
//     scarta prima ⇒ a proteggerle era un meccanismo **diverso** da quello dichiarato dal codice.
//   · e nell'altro verso la regola nuova è sicura: delle **3297** righe `paid`, **zero** portano
//     `voided_at` e **zero** sono `deleted`.
// 📌 *Una condizione che nomina un campo che non esiste non è una difesa in più: è una difesa in
// meno, travestita.*
//
// 🚨 LE PROVE SONO SUL COMPORTAMENTO: le funzioni si ESTRAGGONO da `index.html` e si ESEGUONO.
//
// ⛔ QUELLO CHE QUESTO BANCO NON DICE: che sullo schermo la ✓ compaia. Dice che la regola decide
// giusto e nel verso giusto. Che si veda lo dice solo una scheda vera aperta su PROD.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(QUI, '..', 'index.html'), 'utf8');

function estrai(nome) {
  let inizio = html.indexOf(`function ${nome}(`);
  if (inizio < 0) throw new Error(`funzione «${nome}» non trovata in index.html`);
  // 🩹 Ritagliare da `function` perde l'`async` che sta prima, e il corpo estratto muore su
  //    «await is only valid in async functions» — cioè il banco accusa il codice di un difetto
  //    che ha l'attrezzo. 📌 *Un estrattore che non conosce la forma di ciò che legge produce
  //    rossi che parlano di sé stesso.*
  if (html.slice(Math.max(0, inizio - 6), inizio) === 'async ') inizio -= 6;
  let t = html.indexOf('(', inizio), tonde = 0;
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

/* ─────────────────────────────────────────────────────────────────────────────
   IL MONDO ATTORNO, ridotto a ciò che le funzioni toccano davvero.
   Si rifabbrica a OGNI caso: l'indice tiene stato.
   ───────────────────────────────────────────────────────────────────────────── */
function banco(pagamentiInArchivio = []) {
  const ctx = { console: { warn() {} } };
  vm.createContext(ctx);
  vm.runInContext([
    'const _PAY_METHOD_LABEL = { contanti: "Cash", carta: "Card", borsellino: "Wallet", omaggio: "Offerta", altro: "Altro" };',
    'let _staffCalPaidIndex = new Map();',
    // `_incassiMethodBucket` sta lontanissimo nel file e non è ciò che si prova: si dichiara il
    // suo esito, che è una mappa parola→secchio, e si tiene la funzione VERA per il resto.
    'function _incassiMethodBucket(m){ m = String(m||"").toLowerCase();'
      + ' if (/cash|contant/.test(m)) return "contanti";'
      + ' if (/card|carta/.test(m)) return "carta";'
      + ' if (/wallet|borsell|saldo/.test(m)) return "borsellino";'
      + ' return "altro"; }',
    'function renderStaffCalendar(){}',
    estrai('_payCampoNum'),
    estrai('_payOraHm'),
    estrai('_payBucket'),
    estrai('_payNormName'),
    estrai('_payNatKey'),
    estrai('_staffCalPaidIndexAdd'),
    estrai('_staffCalPaidInfo'),
    estrai('_payPaidBadge'),
    estrai('_staffCalRefreshPaidIndex'),
    // 🚨 Le `const`/`let` di primo livello NON diventano proprietà del contesto: si espongono.
    'globalThis.__leggiIndice = () => _staffCalPaidIndex;',
  ].join('\n'), ctx);

  // `_incassiFetch` è il confine col database: qui si dichiara cosa risponde.
  ctx._incassiFetch = async () => ({ payments: pagamentiInArchivio, lastSync: null });
  return ctx;
}

/* 📏 Le righe sono COPIATE dall'archivio di PROD il 07/09, non inventate. */
const PAGATO = (over = {}) => Object.assign({
  ora: '17:30', seq: 1, data: '2026-09-06', campo: 'Campo 1', method: 'card',
  source: 'matchpoint', status: 'paid', id_cliente: '116', player_name: 'Marco Balliana',
  amount_cents: 800, booking_data: '2026-09-06', id_cliente_mp: '122',
}, over);
// I tre storni delle prove della 171, con la parola NUOVA (`void`, nati il 06/09 alle 22:08).
const STORNO_NUOVO = () => PAGATO({
  status: 'void', method: 'wallet', player_name: 'Fabiola Limuti', id_cliente: '291',
  campo: 'Campo 4', ora: '10:30', data: '2026-09-07', booking_data: '2026-09-07',
  voided_at: '2026-09-06T22:09:58.473Z', voided_by: 'padelvillage.club+claude@gmail.com',
});
// Uno storno con la parola VECCHIA (`voided`), che in archivio ce n'è venti.
const STORNO_VECCHIO = () => PAGATO({
  status: 'voided', player_name: 'Marco Balliana',
  voided_at: '2026-08-26T16:23:13.272Z',
});

/** 🚨 Un valore nato nel contesto `vm` ha un altro `Array.prototype`/`Object.prototype`:
 *  `deepStrictEqual` lo rifiuta pur avendo la stessa struttura, e stampa due valori identici
 *  («same structure but not reference-equal»). Si riporta di qua prima di confrontarlo.
 *  📌 Un banco che accusa il codice per un confine di realm è peggio di niente. */
const puro = (x) => JSON.parse(JSON.stringify(x));

const CHIAVE = { data: '2026-09-06', campo: 'Campo 1', ora: '17:30', nome: 'Marco Balliana' };
const info = (c, k = CHIAVE) => c._staffCalPaidInfo(k.data, k.campo, k.ora, k.nome);

// ══════════════════════════════════════════════════════════════════════════════════════════
// ① LA REGOLA DELLO STORNO — le due parole, e la difesa morta
// ══════════════════════════════════════════════════════════════════════════════════════════
test('① un pagamento vero entra nell’indice, col suo metodo', async () => {
  const c = banco([PAGATO()]);
  await c._staffCalRefreshPaidIndex();
  const i = info(c);
  assert.ok(i, 'un pagamento `paid` non è entrato nell’indice');
  assert.deepEqual(puro(i.methods), ['carta']);
  assert.equal(i.cents, 800);
});

test('① 🚨 lo storno con la parola NUOVA (`void`) NON entra', async () => {
  const c = banco([STORNO_NUOVO()]);
  await c._staffCalRefreshPaidIndex();
  assert.equal(info(c, { data: '2026-09-07', campo: 'Campo 4', ora: '10:30', nome: 'Fabiola Limuti' }), null);
});

test('① 🚨🚨 e lo storno con la parola VECCHIA (`voided`) nemmeno — erano venti, e passavano', async () => {
  // È il caso che il codice di prima lasciava passare: `p.voided` non esiste su nessuna riga e
  // `status === 'void'` non è `'voided'`. Oggi non facevano danno perché il fetch scarta i
  // `deleted`; il giorno che il sync scrivesse `voided` senza `deleted` — e la parola è già
  // cambiata una volta — un rimborso sarebbe risultato incassato.
  const c = banco([STORNO_VECCHIO()]);
  await c._staffCalRefreshPaidIndex();
  assert.equal(info(c), null, 'uno storno `voided` è finito fra i pagati');
});

test('① una parola di storno MAI VISTA prima non passa lo stesso', async () => {
  // La regola non elenca le parole: pretende `paid`. Una terza forma nasce senza avvisare —
  // ne sono già nate due — e deve cadere dalla parte sicura.
  const c = banco([PAGATO({ status: 'annullato' })]);
  await c._staffCalRefreshPaidIndex();
  assert.equal(info(c), null);
});

test('① e nell’altro verso NON nasconde un incasso vero', async () => {
  // 📏 Delle 3297 righe `paid` di PROD, zero portano `voided_at`: la regola nuova non può
  //    scartarne una. Il caso serve a dire che il rigore non è diventato eccesso.
  const c = banco([PAGATO(), PAGATO({ method: 'cash', seq: 2 })]);
  await c._staffCalRefreshPaidIndex();
  const i = info(c);
  assert.ok(i);
  assert.deepEqual(puro(i.methods).sort(), ['carta', 'contanti']);
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// ② IL SEGNO — chi risponde quando il worker non ha ancora risposto
// ══════════════════════════════════════════════════════════════════════════════════════════
/** 🚨 LA DECISIONE SI PRENDE DA `index.html`, RIGA PER RIGA — non si riscrive qui.
 *  Le tre righe che decidono il segno vivono dentro una chiusura lunghissima e non sono una
 *  funzione: si ritagliano per il loro testo e si ESEGUONO. ⇒ Chi domani cambia una di quelle
 *  righe fa cadere questi casi. Riscriverle qui darebbe un banco che resta verde mentre la
 *  scheda sbaglia — la trappola della copia, già pagata in questo progetto.
 *  📌 *Un banco che prova una copia del ragionamento non prova il ragionamento.* */
function riga(prefisso) {
  const re = new RegExp('^[ \\t]*' + prefisso.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '.*$', 'm');
  const m = html.match(re);
  if (!m) throw new Error(`riga «${prefisso}…» non trovata in index.html: la cura è stata tolta o riscritta`);
  return m[0].trim();
}
const decideSegno = new Function('payRow', 'stato', '_payInfo', [
  riga('const _pagatoDalGestionale ='),
  riga('const isPaid = payRow &&'),
  riga('const _statoIgnoto ='),
  'return { isPaid, _statoIgnoto, _pagatoDalGestionale };',
].join('\n'));

/** E anche il cancello dello STORNO si esegue, non si legge: la sua condizione si ritaglia
 *  dall'`if` vero. Una prova testuale direbbe che la parola c'è, non che il bottone sparisce. */
const _CONDIZIONE_STORNO = (function () {
  const r = riga('if (_payVoidActive && !isGift');
  const m = r.match(/^if \((.*)\) \{$/);
  if (!m) throw new Error('la condizione dello storno ha cambiato forma: ' + r);
  return m[1];
})();
const stornoOfferto = new Function('_payVoidActive', 'isGift', 'stato', 'return !!(' + _CONDIZIONE_STORNO + ');');

function segno(stato, payInfo) {
  const s = decideSegno(true, stato, payInfo);
  return Object.assign({}, s, { stornabile: s.isPaid && stornoOfferto(true, false, stato) });
}

test('② il worker ha risposto «riscosso» → ✓, e si può stornare', () => {
  const s = segno('riscosso', { methods: ['carta'], cents: 800 });
  assert.equal(s.isPaid, true);
  assert.equal(s._statoIgnoto, false);
  assert.equal(s.stornabile, true);
});

test('② ⭐ il worker NON ha ancora risposto ma il gestionale sa → ✓ subito', () => {
  const s = segno(null, { methods: ['carta'], cents: 800 });
  assert.equal(s.isPaid, true, 'la riga resta «non lo so ancora» di uno che il gestionale sa pagato');
  assert.equal(s._statoIgnoto, false);
});

test('② 🚨 …ma NON si può stornare finché il circolo non conferma', () => {
  // Un dato basta per informare molto prima di bastare per agire: lo storno muove denaro vero.
  const s = segno(null, { methods: ['carta'], cents: 800 });
  assert.equal(s.stornabile, false, 'lo storno si offre su uno stato che il circolo non ha confermato');
});

test('② 🚨 nessuno dei due sa → «non lo so ancora», MAI la ✗ rossa', () => {
  // L'assenza dall'archivio non diventa «da incassare»: un pagamento di due minuti fa non è
  // ancora nella copia, e dire «deve pagare» a chi ha pagato manda a chiedere soldi due volte.
  const s = segno(null, null);
  assert.equal(s.isPaid, false);
  assert.equal(s._statoIgnoto, true, 'l’assenza dall’archivio è diventata un «da incassare»');
});

test('② il worker dice «in sospeso» → ✗, e l’archivio non lo ribalta', () => {
  // Il circolo ha parlato: la sua parola vince su una copia che può essere indietro.
  const s = segno('in_sospeso', { methods: ['carta'], cents: 800 });
  assert.equal(s.isPaid, false);
  assert.equal(s._statoIgnoto, false, 'con lo stato letto non si dice più «non lo so»');
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// ③ L'OMAGGIO — riconosciuto senza l'importo del worker
// ══════════════════════════════════════════════════════════════════════════════════════════
test('③ col worker: importo 0 ⇒ 🎁', () => {
  const c = banco([]);
  assert.deepEqual(puro(c._payPaidBadge('riscosso', 0, ['omaggio'])), { kind: 'gift' });
});

test('③ ⭐ senza il worker l’importo è IGNOTO ⇒ l’omaggio si riconosce dal METODO', () => {
  // Senza questo, una quota offerta si mostrerebbe come un incasso: direbbe che sono entrati
  // soldi che non sono entrati.
  const c = banco([]);
  assert.deepEqual(puro(c._payPaidBadge(null, null, ['omaggio'])), { kind: 'gift' });
});

test('③ un omaggio poi trasformato in incasso vero NON resta un 🎁', () => {
  const c = banco([]);
  const b = c._payPaidBadge(null, null, ['omaggio', 'contanti']);
  assert.equal(b.kind, 'methods', 'il 🎁 nasconderebbe un incasso vero');
});

test('③ e senza nessun metodo noto resta l’attesa, non un omaggio', () => {
  const c = banco([]);
  assert.deepEqual(puro(c._payPaidBadge(null, null, [])), { kind: 'wait' });
});
