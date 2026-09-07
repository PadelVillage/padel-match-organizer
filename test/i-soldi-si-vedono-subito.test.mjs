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
    'let _staffCalPaidIndexAt = 0;',
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
    estrai('_staffCalMaybeRefreshPaidIndex'),
    // 🚨 `_incassiFetch` si ESTRAE, non si finge: è lì dentro che vive il `ok:false`, e
    //    sostituendola con uno stub il sabotaggio «il guasto torna indistinguibile dal vuoto»
    //    restava VERDE — il banco provava il proprio stub. Il confine falso si sposta un passo
    //    più in là, su `pmoStaffRpcPaged`, che è il vero confine col database.
    estrai('_incassiFetch'),
    'globalThis.__leggiIndice = () => _staffCalPaidIndex;',
    'globalThis.__leggiTimbro = () => _staffCalPaidIndexAt;',
    'globalThis.__timbra = (v) => { _staffCalPaidIndexAt = v; };',
    'globalThis.__metti = (k, n, m, c) => _staffCalPaidIndexAdd(k, n, m, c);',
  ].join('\n'), ctx);

  // Il confine col database è `pmoStaffRpcPaged`: qui si dichiara cosa risponde. `_incassiFetch`
  // resta quella VERA, estratta da index.html, e ci passa sopra per davvero.
  ctx.pmoStaffRpcPaged = async () => pagamentiInArchivio.map((pl) => ({
    record_type: 'payment', local_key: 'pay|x', deleted: false, payload: pl,
  }));
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


// ══════════════════════════════════════════════════════════════════════════════════════════
// ④ IL DIFETTO CHE HA TROVATO LA PROVA FISICA, non il banco — e che questa cura rende PORTANTE
//
// 📏 Su TEST 6.394 la scheda mostrava «non lo so ancora» per due giocatori che l'archivio
//    conosceva; forzando il rinfresco comparivano tutt'e due. ⇒ La regola era giusta, l'indice
//    era VUOTO: il primo disegno del calendario gira prima che la sessione staff sia pronta, la
//    lettura fallisce, e un elenco vuoto era indistinguibile da «non c'è nessun pagamento».
// 📌 Prima il danno era cosmetico (mancava l'etichetta del metodo su una riga già ✓); la cura
//    dei soldi lo rende portante. *Una cura può trasformare un difetto innocuo in quello che la
//    regge, e da quel momento va curato anche lui.*
// ══════════════════════════════════════════════════════════════════════════════════════════
test('④ una lettura FALLITA non svuota l’indice che c’era', async () => {
  const c = banco([PAGATO()]);
  await c._staffCalRefreshPaidIndex();
  assert.ok(info(c), 'preparazione fallita: il pagamento non è entrato');

  c.pmoStaffRpcPaged = async () => { throw new Error('Accedi con email personale Supabase'); };
  const esito = await c._staffCalRefreshPaidIndex();

  assert.equal(esito, false, 'un guasto si è dichiarato riuscito');
  assert.ok(info(c), '🚨 un guasto di lettura ha CANCELLATO i pagamenti che si conoscevano');
});

test('④ 🚨 e non consuma la finestra dei due minuti: il prossimo disegno riprova', async () => {
  const c = banco([PAGATO()]);
  c.__timbra(1_700_000_000_000);   // 🚨 sporcato apposta: con lo zero iniziale l'asserzione
  //    qui sotto passerebbe DA SOLA, anche con la cura tolta — ed è successo, visto in un
  //    sabotaggio rimasto verde. 📌 *Un caso che parte già nello stato che vuole dimostrare
  //    non dimostra niente: verifica sé stesso.*
  c.pmoStaffRpcPaged = async () => { throw new Error('sessione non pronta'); };
  await c._staffCalRefreshPaidIndex();
  assert.equal(c.__leggiTimbro(), 0,
    'la finestra è stata bruciata da un tentativo fallito: per due minuti l’archivio non risponde a nessuno');
});

test('④ una lettura che ESPLODE si comporta come una fallita', async () => {
  const c = banco([PAGATO()]);
  await c._staffCalRefreshPaidIndex();
  c.__timbra(1_700_000_000_000);
  c.pmoStaffRpcPaged = async () => { throw new Error('esplosa'); };
  const esito = await c._staffCalRefreshPaidIndex();
  assert.equal(esito, false);
  assert.equal(c.__leggiTimbro(), 0);
  assert.ok(info(c), 'un’eccezione ha cancellato i pagamenti che si conoscevano');
});

test('④ e una riga MALFORMATA non brucia la finestra né l’indice', async () => {
  // 🩹 Scritto perché un sabotaggio restava VERDE: `_incassiFetch` cattura per conto suo, quindi
  //    un guasto di rete non arriva MAI al `catch` esterno di `_staffCalRefreshPaidIndex` — e la
  //    sua rete di sicurezza non era esercitata da nessun caso. 📌 *Una difesa che nessun caso
  //    attraversa non è difesa: è dichiarata.* Qui l'eccezione nasce DOPO la lettura, nel giro
  //    che costruisce l'indice, che è l'unico modo di arrivarci.
  const c = banco([PAGATO()]);
  await c._staffCalRefreshPaidIndex();
  c.__timbra(1_700_000_000_000);
  c.pmoStaffRpcPaged = async () => [{
    record_type: 'payment', local_key: 'pay|rotta', deleted: false,
    payload: { status: 'paid', booking_data: '2026-09-06', campo: 'Campo 1', ora: '17:30',
               get player_name() { throw new Error('riga rotta'); } },
  }];
  const esito = await c._staffCalRefreshPaidIndex();
  assert.equal(esito, false, 'una riga rotta si è dichiarata un giro riuscito');
  assert.equal(c.__leggiTimbro(), 0, 'una riga rotta ha bruciato la finestra dei due minuti');
  assert.ok(info(c), 'una riga rotta ha cancellato i pagamenti buoni');
});

test('④ una lettura RIUSCITA invece consuma la finestra, o si leggerebbe a ogni disegno', async () => {
  const c = banco([PAGATO()]);
  c.__leggiTimbro();
  await c._staffCalMaybeRefreshPaidIndex();
  await new Promise((r) => setTimeout(r, 5));
  assert.ok(c.__leggiTimbro() > 0, 'senza timbro il calendario rileggerebbe il database a ogni disegno');
  assert.ok(info(c));
});

test('④ ⚠️ l’indice NON dimentica, ed è VOLUTO: protegge l’incasso appena fatto', async () => {
  // 🔎 Scoperto scrivendo questo banco, aspettandosi il contrario: un giro RIUSCITO che non
  //    riporta più un pagamento non lo toglie dall'indice — il blocco «preserva gli add
  //    ottimistici» ripesca dal giro di prima tutto ciò che il sync non ha.
  // ⚖️ NON si cambia, ed è una scelta dichiarata: quel blocco esiste per il cobro appena fatto
  //    alla cassa, che nel cloud non c'è ancora. Toglierlo farebbe tornare «non lo so ancora»
  //    proprio sulla riga dove la segreteria ha appena incassato — il caso che questa voce serve.
  // ⏳ IL COSTO, dichiarato e non nascosto: uno storno fatto da un'ALTRA postazione sparisce dal
  //    sync ma resta nell'indice di questo browser fino a un ricaricamento. ⇒ Per la finestra in
  //    cui il worker non ha ancora risposto quella riga mostra ✓. Il worker la corregge appena
  //    parla, e chi ha stornato lo toglie dal proprio indice da sé (`_staffCalPaidIndexRemove`).
  // 📌 *Un banco serve anche a scoprire che il codice fa una cosa diversa da quella che ti
  //    aspetti — e allora si guarda PERCHÉ, invece di cambiarlo perché il caso è rosso.*
  const c = banco([PAGATO()]);
  await c._staffCalRefreshPaidIndex();
  c.pmoStaffRpcPaged = async () => [];
  const esito = await c._staffCalRefreshPaidIndex();
  assert.equal(esito, true, 'un giro riuscito si è dichiarato fallito');
  assert.ok(info(c), 'la protezione dell’incasso appena fatto è stata tolta');
});
