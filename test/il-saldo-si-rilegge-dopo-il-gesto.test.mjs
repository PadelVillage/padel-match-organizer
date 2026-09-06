// il-saldo-si-rilegge-dopo-il-gesto.test.mjs — VOCE 143, seconda metà (06/09/2026)
//
// 🎯 COSA DIFENDE. Dopo un gesto di cassa che muove il borsellino, il saldo mostrato non deve
// restare quello di prima. La prima metà della voce cura la RICARICA, dove il saldo dopo è già in
// mano (`balanceCentsPost`). Il PAGAMENTO COL BORSELLINO no: 📏 misurato il 06/09,
// `/collect-payment` torna `statoPost` e `pendentePostCents` — il saldo del borsellino **no**,
// perché il cobro si fa nella schermata della prenotazione, non in quella del borsellino.
// ⇒ Là il numero restava vecchio fino al giro dei 10 minuti: il caso che fa protestare la
// segreteria la sera con la fila davanti.
//
// 🚨⭐⭐ E IL PEZZO CHE NON SI VEDEVA LEGGENDO LA SCHEDA: nella scheda della partita il chip 👛 NON
// legge la fotografia del gestionale — legge `p.saldoCents`, che il worker ha portato
// all'APERTURA della scheda. ⇒ Curare solo l'archivio avrebbe lasciato il cassiere a guardare il
// numero di prima proprio nella riga dove ha appena premuto. Si aggiornano tutti e due, e col
// MEDESIMO numero: quello riletto dal circolo.
//
// 🚨 LE PROVE SONO SUL COMPORTAMENTO: la funzione si ESTRAE da `index.html` e si ESEGUE. Un banco
// che cercasse la stringa `matchpoint-wallet-read` resterebbe verde davanti a un ramo spento —
// lezione del 19/08.
//
// ⛔ QUELLO CHE QUESTO BANCO NON DICE: che il numero cambi sullo schermo della segreteria. Dice
// che l'app chiede il saldo giusto per la persona giusta e mette dove serve quello che riceve.
// Che si veda cambiato lo dice solo un pagamento vero col borsellino su PROD.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(QUI, '..', 'index.html'), 'utf8');

// Stesso estrattore degli altri banchi che leggono `index.html`: salta i commenti, che in
// italiano sono pieni di apostrofi e manderebbero in tilt il conteggio delle graffe.
function estrai(nome) {
  const inizio = html.indexOf(`function ${nome}(`);
  if (inizio < 0) throw new Error(`funzione «${nome}» non trovata in index.html`);
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

const SORGENTE = estrai('_pmoWalletRileggiDopoGesto');
const attendi = () => new Promise((r) => setTimeout(r, 5));

/* Il mondo attorno alla funzione, ridotto a ciò che tocca davvero.
   🚨 Si rifabbrica a OGNI caso, e non è un vezzo: la funzione legge `staffCalPlayersState` dallo
      scope, quindi un contesto riusato porterebbe il roster del caso precedente. (Sbagliato la
      prima volta, e il banco accusava il codice invece di sé stesso.) */
function banco({ roster = [], saldoLetto = 0, fetchRompe = false, idReserva = '9844' } = {}) {
  const chiamate = [];
  const cache = new Map(), cloud = new Map();
  let ridisegni = 0;
  const ctx = {
    staffCalPlayersState: { idReserva, roster },
    // La vera `_staffCalSocioDelGiocatore` è la funzione della voce 138 (id interno con id
    // interno, e davanti a un id che non aggancia NON indovina): qui si dichiara il suo esito.
    _staffCalSocioDelGiocatore: (p) => (p && p.__socio) || null,
    loadAssessmentSupabaseConfig: async () => ({ supabaseUrl: 'https://edge', supabaseKey: 'k' }),
    pmoRequireStaffPermission: async () => ({ accessToken: 't' }),
    staffCalRenderPlayersEditor: () => { ridisegni++; },
    displayMembers: () => {},
    document: { getElementById: () => null },
    window: { __pmoWalletCache: cache, __pmoWalletCloud: cloud },
    console: { warn: () => {} },
    setTimeout,
    fetch: async (_url, o) => {
      if (fetchRompe) throw new Error('worker giù');
      chiamate.push(JSON.parse(o.body));
      return { ok: true, status: 200, json: async () => ({ ok: true, idCliente: '4', balanceCents: saldoLetto }) };
    },
  };
  vm.createContext(ctx);
  vm.runInContext(SORGENTE, ctx);
  return { rileggi: ctx._pmoWalletRileggiDopoGesto, chiamate, cache, cloud, get ridisegni() { return ridisegni; } };
}

/* 📏 I dati sono COPIATI dall'archivio di PROD il 06/09, non inventati — lezione della 138:
   *un caso di prova si copia dai dati, non dall'idea che se ne ha*. Maurizio Aprea ha id interno
   `4` nel roster della prenotazione 9844 (lunedì 7/09, 10:30, Campo 4) e `member_local_id`
   `7d454239…` in anagrafica. */
const MAURIZIO = () => ({ idx: '3', idCliente: '4', nome: 'Maurizio Aprea', saldoCents: 600,
                          __socio: { id: '7d454239-929a-4346-8ba0-ec778d7763a3', memberId: '000004' } });
const GESTO = { idReserva: '9844', idCliente: '4', idx: '3', playerName: 'Maurizio Aprea', motivo: 'incasso-wallet' };

// ══════════════════════════════════════════════════════════════════════════════════════════
test('① il caso di lunedì: chiede il saldo per la persona giusta, una volta sola', async () => {
  const p = MAURIZIO();
  const b = banco({ roster: [p], saldoLetto: 100 });
  b.rileggi(GESTO);
  await attendi();
  assert.equal(b.chiamate.length, 1);
  assert.equal(b.chiamate[0].idInterno, '4');
  // 🔑 …e col `member_local_id` del socio AGGANCIATO: è la chiave con cui l'edge archivia.
  assert.equal(b.chiamate[0].memberLocalId, '7d454239-929a-4346-8ba0-ec778d7763a3');
});

test('② il chip 👛 della scheda partita prende il numero riletto — è dove sta l\'occhio', async () => {
  const p = MAURIZIO();
  const b = banco({ roster: [p], saldoLetto: 100 });
  b.rileggi(GESTO);
  await attendi();
  assert.equal(p.saldoCents, 100, 'il saldo della riga resta quello di prima: il cassiere vede il numero vecchio');
  assert.ok(b.ridisegni > 0, 'e la scheda va ridisegnata, o il numero nuovo resta nei dati e non sullo schermo');
});

test('③ ⛔ IL SALDO NON SI CALCOLA, SI CHIEDE: vince il numero del circolo', async () => {
  /* La scorciatoia che verrebbe in mente è sottrarre l'importo pagato da quello che avevamo.
     Sarebbe fabbricare una verità nostra: basta un incasso fatto dalla postazione accanto, o una
     ricarica di due minuti fa, e il numero «giusto» è falso senza che nessuno lo sappia.
     Qui il circolo dice 42,00 € mentre in mano avevamo 6,00 €: deve vincere il circolo. */
  const p = MAURIZIO();
  const b = banco({ roster: [p], saldoLetto: 4200 });
  b.rileggi(GESTO);
  await attendi();
  assert.equal(p.saldoCents, 4200);
});

test('④ e lo STESSO numero arriva alla scheda socio: uno solo, non due', async () => {
  const p = MAURIZIO();
  const b = banco({ roster: [p], saldoLetto: 100 });
  b.rileggi(GESTO);
  await attendi();
  assert.equal(b.cache.get('4').balance_cents, 100);
  assert.equal(b.cloud.get('7d454239-929a-4346-8ba0-ec778d7763a3').balance_cents, 100);
});

test('⑤ 🚨 l\'OSPITE non ha un borsellino da rileggere: non si chiede niente al worker', async () => {
  /* L'Ospite ha id interno `1` ed è il jolly del circolo, non una persona: in anagrafica sono DUE
     record vivi (misurato sulla 138). Leggerne il saldo vorrebbe dire interrogare un record
     condiviso e poi archiviarlo come se fosse di qualcuno. */
  const p = { idx: '1', idCliente: '1', nome: 'Ospite', saldoCents: 0, __socio: null };
  const b = banco({ roster: [p], saldoLetto: 999 });
  b.rileggi({ idReserva: '9844', idCliente: '1', idx: '1', playerName: 'Ospite' });
  await attendi();
  assert.equal(b.chiamate.length, 0);
});

test('⑥ 🚨 senza socio agganciato si legge, ma NON si inventa una chiave d\'archivio', async () => {
  /* Il difetto silenzioso della 138: il codice cliente di Laura Aprea (000140 → "140") è identico
     all'ID INTERNO di Marco Aprea (140). Passare l'id interno come `member_local_id` scriverebbe
     il saldo sul borsellino di chi non c'entra — e in cassa la sera nessuno se ne accorge. */
  const p = { idx: '2', idCliente: '999', nome: 'Tal dei Tali', saldoCents: null, __socio: null };
  const b = banco({ roster: [p], saldoLetto: 350 });
  b.rileggi({ idReserva: '9844', idCliente: '999', idx: '2', playerName: 'Tal dei Tali' });
  await attendi();
  assert.equal(b.chiamate.length, 1, 'il saldo si legge lo stesso: al chip serve');
  assert.equal(b.chiamate[0].memberLocalId, '', 'ma senza chiave l\'edge non archivierà: è lei a rifiutare');
  assert.equal(p.saldoCents, 350);
});

test('⑦ un rinfresco che fallisce NON fa esplodere il percorso del cassiere', async () => {
  // L'incasso è già riuscito: un errore qui direbbe il falso su di lui. Al massimo il saldo resta
  // quello di prima, cioè esattamente com'era prima di questa voce.
  const p = MAURIZIO();
  const b = banco({ roster: [p], fetchRompe: true });
  await assert.doesNotReject(async () => { b.rileggi(GESTO); await attendi(); });
  assert.equal(p.saldoCents, 600);
});

test('⑧ un id interno che non è un numero non arriva mai al worker', async () => {
  for (const cattivo of ['', '  ', 'abc', '123456789']) {
    const p = { idx: '9', idCliente: cattivo, nome: 'X', saldoCents: null, __socio: null };
    const b = banco({ roster: [p], saldoLetto: 1 });
    b.rileggi({ idReserva: '9844', idCliente: cattivo, idx: '9', playerName: 'X' });
    await attendi();
    assert.equal(b.chiamate.length, 0, `id «${cattivo}» non doveva partire`);
  }
});

/* ══════════════════════════════════════════════════════════════════════════════════════════
   ⑨-⑪ L'AGGANCIO — e sta qui perché il banco senza di esso aveva un buco che il suo stesso
   commento in testa denuncia. 📏 Misurato il 06/09: spegnendo la chiamata dentro l'incasso
   (`if (method === 'wallet')` → `if (false)`) i primi otto casi restavano **tutti verdi**.
   ⇒ Provavano che la funzione è giusta, non che qualcuno la chiama: il *ramo spento* del 19/08,
   nel banco scritto per ricordarsene. Qui si esegue `_pmoCollectPayment` per davvero. */

/* 🚨 `estrai` parte dalla parola `function` e quindi lascia fuori l'`async` che la precede: il
   corpo estratto diventa una funzione sincrona piena di `await`, e `vm` la rifiuta con un errore
   di sintassi che sembra un difetto del codice in servizio. Si rimette davanti.
   📌 *Un attrezzo che tronca l'inizio accusa il pezzo che ha troncato.* */
const SORGENTE_INCASSO = 'async ' + estrai('_pmoCollectPayment');

function bancoIncasso({ metodo = 'wallet', roster = [], edgeOk = true } = {}) {
  const riletture = [];
  const ctx = {
    PMO_IS_TEST_ENV: false, PMO_PAYMENTS_SIMULATE: false,
    PMO_PAYMENTS_COLLECT_ENABLED: true, PMO_PAYMENTS_WRITE_ENABLED: true,
    staffCalPlayersState: { idReserva: '9844', roster },
    // 🔑 IL BERSAGLIO DEL CASO: si registra CHI viene chiamato, non cosa fa — quello lo provano
    //    i casi ①-⑧.
    _pmoWalletRileggiDopoGesto: (o) => riletture.push(o),
    svcAddMessage: () => ({ querySelector: () => null, appendChild: () => {} }),
    svcMakeStepButtons: () => ({}),
    _svcSchedaEsito: () => {},
    _incassiEuro: (c) => String(c),
    escapeHtml: (x) => String(x == null ? '' : x),
    _staffCalPaidIndexAdd: () => {}, _payNatKey: () => 'k',
    renderStaffCalendar: () => {}, staffCalRenderPlayersEditor: () => {},
    svcScheduleAutoClear: () => {},
    loadAssessmentSupabaseConfig: async () => ({ supabaseUrl: 'https://edge', supabaseKey: 'k' }),
    pmoRequireStaffPermission: async () => ({ accessToken: 't' }),
    AbortController, setTimeout, clearTimeout, console: { warn: () => {} },
    fetch: async () => ({
      ok: edgeOk, status: edgeOk ? 200 : 500,
      text: async () => JSON.stringify(edgeOk ? { ok: true, statoPost: 'riscosso' } : { ok: false, error: 'WORKER_ERROR' }),
    }),
    // La conferma dell'operatore: qui si dà per data, il banco prova cosa succede DOPO il sì.
    _pmoConfirmCollect: async () => true,
  };
  vm.createContext(ctx);
  vm.runInContext(SORGENTE_INCASSO, ctx);
  return { incassa: ctx._pmoCollectPayment, riletture, metodo };
}

const INCASSO = (method) => ({ idReserva: '9844', idCliente: '4', idx: '3',
  playerName: 'Maurizio Aprea', method, amountCents: 1200, data: '2026-09-07', campo: 'Campo 4', ora: '10:30' });

test('⑨ ⭐ un incasso COL BORSELLINO fa scattare la rilettura del saldo', async () => {
  const b = bancoIncasso({ roster: [MAURIZIO()] });
  const esito = await b.incassa(INCASSO('wallet'));
  assert.equal(esito.ok, true);
  assert.equal(b.riletture.length, 1, 'nessuna rilettura: il saldo resterebbe vecchio fino al giro dei 10 minuti');
  assert.equal(b.riletture[0].idCliente, '4');
  assert.equal(b.riletture[0].idReserva, '9844');
});

test('⑩ ⛔ cash e card NON occupano il worker: il borsellino non si è mosso', async () => {
  /* ⚖️ Non è un'ottimizzazione: il worker è UN browser solo, condiviso col sync delle
     prenotazioni. Ogni lettura inutile è un tick tolto a quello. */
  for (const metodo of ['cash', 'card']) {
    const b = bancoIncasso({ roster: [MAURIZIO()] });
    await b.incassa(INCASSO(metodo));
    assert.equal(b.riletture.length, 0, `«${metodo}» non deve chiedere niente al worker`);
  }
});

test('⑪ 🚨 un incasso NON riuscito non rilegge niente: non c\'è nessun saldo nuovo da mostrare', async () => {
  // Rileggere qui vorrebbe dire riscrivere la fotografia con lo stesso numero di prima, dando a
  // quel record una freschezza che non ha — e la freschezza è ciò su cui la voce 53 decide se
  // può dire «no». Un dato vecchio con la data di oggi è peggio di un dato vecchio.
  const b = bancoIncasso({ roster: [MAURIZIO()], edgeOk: false });
  const esito = await b.incassa(INCASSO('wallet'));
  assert.equal(esito.ok, false);
  assert.equal(b.riletture.length, 0);
});

/* ══════════════════════════════════════════════════════════════════════════════════════════
   ⑫-⑬ IL BOTTONE ↻ DELLA SCHEDA SOCIO — il gesto che la segreteria fa più spesso.
   Fino a stanotte leggeva il saldo e lo teneva per sé: il numero finiva in
   `window.__pmoWalletCache`, cioè lo vedeva chi aveva premuto, si perdeva al reload, e la
   postazione accanto continuava a mostrare quello del giro di prima. Qui il socio è noto con
   CERTEZZA — siamo nella sua scheda — quindi archiviare non costa una lettura in più: è la
   stessa che si stava già facendo. */

const SORGENTE_REFRESH = 'async ' + estrai('pmoWalletRefresh');

function bancoRefresh({ socio, saldoLetto = 0 } = {}) {
  const chiamate = [];
  const cache = new Map(), cloud = new Map();
  const ctx = {
    giocatori: [socio],
    _walletClientId: (g) => g && g.matchpointIdInterno,
    playerFullName: (g) => g && g.name,
    loadAssessmentSupabaseConfig: async () => ({ supabaseUrl: 'https://edge', supabaseKey: 'k' }),
    pmoRequireStaffPermission: async () => ({ accessToken: 't' }),
    displayMembers: () => {}, renderOpenMemberCard: () => {},
    document: { getElementById: () => null },
    alert: () => {}, console: { warn: () => {} },
    window: { __pmoWalletCache: cache, __pmoWalletCloud: cloud },
    fetch: async (_u, o) => {
      chiamate.push(JSON.parse(o.body));
      return { ok: true, status: 200, json: async () => ({ ok: true, balanceCents: saldoLetto, fotografia: 'scritta' }) };
    },
  };
  vm.createContext(ctx);
  vm.runInContext(SORGENTE_REFRESH, ctx);
  return { aggiorna: ctx.pmoWalletRefresh, chiamate, cache, cloud };
}

const SOCIO = () => ({ id: '7d454239-929a-4346-8ba0-ec778d7763a3', name: 'Maurizio Aprea', matchpointIdInterno: '4' });

test('⑫ il ↻ passa la chiave del gestionale, così il saldo lo vede TUTTA la segreteria', async () => {
  const b = bancoRefresh({ socio: SOCIO(), saldoLetto: 600 });
  await b.aggiorna('7d454239-929a-4346-8ba0-ec778d7763a3', null);
  assert.equal(b.chiamate.length, 1);
  assert.equal(b.chiamate[0].idInterno, '4');
  assert.equal(b.chiamate[0].memberLocalId, '7d454239-929a-4346-8ba0-ec778d7763a3',
    'senza questo l\'edge legge e non archivia: il numero resta nel browser che ha premuto');
});

test('⑬ e le due mappe della stessa pagina non restano con due numeri diversi', async () => {
  const b = bancoRefresh({ socio: SOCIO(), saldoLetto: 600 });
  await b.aggiorna('7d454239-929a-4346-8ba0-ec778d7763a3', null);
  assert.equal(b.cache.get('4').balance_cents, 600);
  assert.equal(b.cloud.get('7d454239-929a-4346-8ba0-ec778d7763a3').balance_cents, 600);
});

/* ══════════════════════════════════════════════════════════════════════════════════════════
   ⑭-⑯ I DUE NUMERI — e questi casi esistono perché il difetto è stato COMMESSO, non immaginato.

   📏 La prima stesura di questa cura (06/09, in servizio per un'ora) scriveva nella fotografia
   l'ID INTERNO preso dal roster. Ma il campo `id_cliente` di quel record è quello che scrive
   `matchpoint-wallet-sync`, e il sync ci mette il CODICE CLIENTE. Due numerazioni nella stessa
   colonna, a seconda di chi aveva scritto la riga.

   🚨 E NON SI VEDEVA, che è la parte da ricordare: la prova era stata fatta su Maurizio Aprea,
   che ha id interno 4 e codice 000004 — i due numeri COINCIDONO. Il difetto è saltato fuori solo
   guardando un socio dove divergono:
     · `id_cliente` **191** in archivio = **Luciano Pase** (codice 000191, id interno assente);
     · **191** nel roster di una prenotazione = id interno di **Valeria Moschet** (codice 000182).
   Due persone, lo stesso numero, due colonne diverse. È la voce 138 in un altro campo.
   📌 *Un caso di prova scelto fra quelli dove i due valori coincidono non prova niente sui due
      valori.* */

test('⑭ 🚨 alla fotografia va il CODICE cliente, non l\'id interno del roster', async () => {
  const p = MAURIZIO();
  const b = banco({ roster: [p], saldoLetto: 600 });
  b.rileggi(GESTO);
  await attendi();
  assert.equal(b.chiamate[0].codiceCliente, '000004');
  // ⛔ E l'id interno resta al suo posto, che è l'indirizzo per LEGGERE da Matchpoint:
  //    i due campi viaggiano insieme e non si scambiano.
  assert.equal(b.chiamate[0].idInterno, '4');
});

test('⑮ 🚨 il caso dove i due numeri DIVERGONO: Valeria Moschet', async () => {
  /* 📏 Dati veri di PROD: id interno 191, codice 000182. Con la stesura sbagliata qui sarebbe
     partito «191» — che in quella colonna è il codice di un\'altra persona. */
  const valeria = { idx: '1', idCliente: '191', nome: 'Valeria Moschet', saldoCents: null,
                    __socio: { id: '1e81b18f-f88c-4663-9016-3cc45c213f7e', memberId: '000182' } };
  // 🚨 L'idReserva del banco DEVE essere quella della scheda aperta: con una diversa la riga non
  //    si trova, il socio non si aggancia e il caso passerebbe/cadrebbe per la ragione sbagliata.
  //    (Sbagliato la prima volta: il caso accusava il codice di non leggere `memberId`.)
  const b = banco({ roster: [valeria], saldoLetto: 0, idReserva: '9808' });
  b.rileggi({ idReserva: '9808', idCliente: '191', idx: '1', playerName: 'Valeria Moschet' });
  await attendi();
  assert.equal(b.chiamate[0].codiceCliente, '000182');
  assert.notEqual(b.chiamate[0].codiceCliente, '191');
});

test('⑯ senza socio agganciato il codice resta VUOTO, non ripiega sull\'id interno', async () => {
  // Meglio un campo che il sync riempirà, che un numero giusto nella numerazione sbagliata.
  const ignoto = { idx: '2', idCliente: '999', nome: 'Tal dei Tali', saldoCents: null, __socio: null };
  const b = banco({ roster: [ignoto], saldoLetto: 100 });
  b.rileggi({ idReserva: '9844', idCliente: '999', idx: '2', playerName: 'Tal dei Tali' });
  await attendi();
  assert.equal(b.chiamate[0].codiceCliente, '');
});

test('⑰ e il ↻ della scheda socio passa lo stesso campo, dalla stessa fonte', async () => {
  const b = bancoRefresh({ socio: { ...SOCIO(), memberId: '000004' }, saldoLetto: 600 });
  await b.aggiorna('7d454239-929a-4346-8ba0-ec778d7763a3', null);
  assert.equal(b.chiamate[0].codiceCliente, '000004');
});
