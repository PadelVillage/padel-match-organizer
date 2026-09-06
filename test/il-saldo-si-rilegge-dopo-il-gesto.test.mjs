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
function banco({ roster = [], saldoLetto = 0, fetchRompe = false } = {}) {
  const chiamate = [];
  const cache = new Map(), cloud = new Map();
  let ridisegni = 0;
  const ctx = {
    staffCalPlayersState: { idReserva: '9844', roster },
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
                          __socio: { id: '7d454239-929a-4346-8ba0-ec778d7763a3' } });
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
