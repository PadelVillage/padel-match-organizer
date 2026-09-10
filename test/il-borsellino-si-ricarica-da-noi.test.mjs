/* 👛⭐⭐ «Il borsellino si ricarica da noi» — banco della VOCE 196 (10/09/2026).
 *
 * 🗣️ Nasce da un suo gesto sul vivo del sistema nuovo: «Ricarica wallet» → *«Non riuscito.
 *   Ambiente di prova: da qui non si scrive sul gestionale del circolo»*. 📏 E da un censimento:
 *   delle 11 edge che scrivono, `matchpoint-wallet-correct` era l'UNICA senza una strada dopo il
 *   distacco — e i suoi bottoni erano accesi (`PMO_WALLET_WRITE_ENABLED = true`).
 *
 * 🎯 LE CINQUE COSE CHE QUESTO BANCO DIFENDE:
 *   ① 🚨⭐⭐ **LA FOTOGRAFIA NON SI RISCRIVE** — è la protezione che vale tutte le altre, ed è
 *      quella che si romperebbe copiando l'edge. Dalla 181 `wallet_balance` è il saldo
 *      **d'apertura** e i movimenti nostri ci si **sommano**: riscriverla E aggiungere il
 *      movimento conterebbe la ricarica **due volte**, nel verso «credito regalato»;
 *   ② il segno è la direzione: + ricarica, − storno, dentro `amount_cents`;
 *   ③ una chiave per EVENTO, non per socio: due ricariche allo stesso socio sono due movimenti;
 *   ④ senza chiave NON si scrive: un movimento non attribuibile è denaro di nessuno;
 *   ⑤ il saldo si muove SUBITO (il delta), non al prossimo giro di lettura da 2 minuti.
 *
 * ⭐ E la regola si ESEGUE, non si cerca come parola: `_pmoWalletScriviMovimento` viene estratta
 *   e fatta girare con le scritture finte. È la lezione della 149 — *una guardia che cerca una
 *   parola prova che la parola c'è, non che il codice succeda*.
 *
 * ⛔ QUELLO CHE NON DICE: che sulla pagina viva il saldo si veda salire. Questo è un banco.
 *
 * Esegui:  node test/il-borsellino-si-ricarica-da-noi.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(QUI, '..', 'index.html'), 'utf8');
assert.ok(APP.length > 500000, 'sorgente non letto: questo banco non direbbe niente');

let passed = 0, failed = 0;
/* 🚨⭐⭐ LE PROVE SI ASPETTANO — e questa riga nasce da un VERDE FALSO di questo stesso banco,
 * trovato da un sabotaggio e non rileggendo. La prima versione faceva `try { fn(); }`: con una
 * funzione `async` quel `try` non vede niente, la promessa parte, il caso stampa **ok** subito e
 * l'assert fallisce dopo, fuori da ogni `catch`. ⇒ Otto casi esecutivi su undici erano verdi
 * qualunque cosa facesse il codice, e il sabotaggio si manifestava come «uncaught» in fondo
 * all'output — dopo undici `ok`.
 * 📌 *Un banco che non aspetta le sue prove non misura il codice: misura che il codice è
 *    partito.* ⇒ I casi si accodano e si eseguono in fila, con `await`. */
const casi = [];
function test(nome, fn) { casi.push([nome, fn]); }
async function esegui() {
  for (const [nome, fn] of casi) {
    try { await fn(); passed++; console.log('ok   - ' + nome); }
    catch (e) { failed++; console.log('FAIL - ' + nome + '\n       ' + e.message); }
  }
}

/** Il testo di una funzione dichiarata nell'app, graffe bilanciate. */
function sorgenteDi(nome) {
  const i = APP.indexOf('function ' + nome + '(');
  assert.ok(i > 0, 'funzione non trovata: ' + nome);
  const apre = APP.indexOf(') {', i);
  let g = 0, visto = false;
  let k = apre + 2;
  for (; k < APP.length; k++) {
    const c = APP[k];
    if (c === '{') { g++; visto = true; }
    else if (c === '}') { g--; if (visto && g === 0) { k++; break; } }
  }
  // ⚠️ Si riparte da `async function`/`function` per non perdere l'`async`: senza, un `await`
  // dentro il corpo sarebbe un errore di sintassi e il banco fallirebbe su sé stesso.
  const inizio = APP.lastIndexOf('function', i) === i ? i : i;
  const prefissoAsync = APP.slice(Math.max(0, inizio - 6), inizio) === 'async ' ? 'async ' : '';
  return prefissoAsync + APP.slice(inizio, k);
}

/* 🔨 IL BANCO ESECUTIVO: si monta un mondo finto con `pmoSyncCloudRecordsNow` che REGISTRA
 * invece di scrivere, e si guarda cosa quella funzione produce davvero. */
function montaBanco() {
  const scritti = [];
  const sorgente = [
    sorgenteDi('_pmoWalletChiavi'),
    sorgenteDi('_pmoWalletPesoRiga'),
    sorgenteDi('_pmoWalletDeltaTxn'),
    sorgenteDi('_pmoWalletScriviMovimento'),
  ].join('\n');
  const fabbrica = new Function('scritti', 'finestra', `
    const window = finestra;
    const PMO_CASSA_SOURCE = 'pmo_cassa';
    async function pmoSyncCloudRecordsNow(recs) { scritti.push(...recs); }
    ${sorgente}
    return { scrivi: _pmoWalletScriviMovimento };
  `);
  const finestra = { __pmoWalletDelta: new Map() };
  return { ...fabbrica(scritti, finestra), scritti, finestra };
}

// ── ① LA COSA CHE VALE TUTTE LE ALTRE ───────────────────────────────────────────────────────
test('🚨 una ricarica NON scrive la fotografia del saldo (o la conterebbe due volte)', async () => {
  const b = montaBanco();
  await b.scrivi({ op: 'recharge', memberLocalId: 'm-1', amountCents: 1000, preCents: 1000 });
  assert.equal(b.scritti.length, 1, 'record scritti: ' + b.scritti.map((r) => r.record_type).join(','));
  assert.equal(b.scritti[0].record_type, 'wallet_txn');
  assert.ok(!b.scritti.some((r) => r.record_type === 'wallet_balance'),
    'ha riscritto wallet_balance: dalla 181 quella è il saldo D APERTURA, e il movimento ci si somma sopra ⇒ contato due volte');
});

// ── ② il segno è la direzione ───────────────────────────────────────────────────────────────
test('＋ la ricarica somma, ↩︎ lo storno sottrae — dentro `amount_cents`', async () => {
  const b = montaBanco();
  await b.scrivi({ op: 'recharge', memberLocalId: 'm-1', amountCents: 1500, preCents: 0 });
  await b.scrivi({ op: 'storno', memberLocalId: 'm-1', amountCents: 500, preCents: 1500 });
  assert.equal(b.scritti[0].payload.amount_cents, 1500);
  assert.equal(b.scritti[1].payload.amount_cents, -500);
  assert.equal(b.scritti[1].payload.balance_cents_post, 1000, 'il saldo dopo non torna');
});

test('🚨 uno storno con importo NEGATIVO non diventa una ricarica per sbaglio', async () => {
  // ⛔ `Math.abs` + il segno da `op`: se il segno venisse dall'importo, un `-500` passato per
  //    errore ricaricherebbe invece di stornare — denaro regalato da un segno di troppo.
  const b = montaBanco();
  await b.scrivi({ op: 'storno', memberLocalId: 'm-1', amountCents: -500, preCents: 1500 });
  assert.equal(b.scritti[0].payload.amount_cents, -500);
});

// ── ③ una chiave per EVENTO ─────────────────────────────────────────────────────────────────
test('🔑 due ricariche allo stesso socio sono due righe, non una sovrascritta', async () => {
  const b = montaBanco();
  await b.scrivi({ op: 'recharge', memberLocalId: 'm-1', amountCents: 100, preCents: 0 });
  await b.scrivi({ op: 'recharge', memberLocalId: 'm-1', amountCents: 100, preCents: 100 });
  assert.equal(b.scritti.length, 2);
  assert.notEqual(b.scritti[0].local_key, b.scritti[1].local_key,
    'stessa local_key: la seconda ricarica sovrascriverebbe la prima');
});

// ── ④ senza chiave non si scrive ────────────────────────────────────────────────────────────
test('⛔ senza `member_local_id` né `id_cliente` NON scrive: sarebbe denaro di nessuno', async () => {
  const b = montaBanco();
  await assert.rejects(
    () => b.scrivi({ op: 'recharge', playerName: 'Mario Rossi', amountCents: 1000, preCents: 0 }),
    /SENZA_CHIAVE/,
  );
  assert.equal(b.scritti.length, 0);
});

test('⛔ e nemmeno con importo zero', async () => {
  const b = montaBanco();
  await assert.rejects(() => b.scrivi({ op: 'recharge', memberLocalId: 'm-1', amountCents: 0 }), /IMPORTO_NULLO/);
  assert.equal(b.scritti.length, 0);
});

test('✅ BASE: con la sola chiave Matchpoint (nessun id nostro) scrive — o i due casi sopra misurerebbero «non scrive mai»', async () => {
  const b = montaBanco();
  await b.scrivi({ op: 'recharge', idCliente: '4021', amountCents: 1000, preCents: 0 });
  assert.equal(b.scritti.length, 1);
  assert.equal(b.scritti[0].payload.id_cliente, '4021');
});

// ── ⑤ il saldo si muove subito ──────────────────────────────────────────────────────────────
test('⚡ il delta si muove SUBITO, senza aspettare il giro di lettura da 2 minuti', async () => {
  const b = montaBanco();
  await b.scrivi({ op: 'recharge', memberLocalId: 'm-7', amountCents: 2500, preCents: 0 });
  assert.equal(b.finestra.__pmoWalletDelta.get('m:m-7'), 2500);
  await b.scrivi({ op: 'storno', memberLocalId: 'm-7', amountCents: 500, preCents: 2500 });
  assert.equal(b.finestra.__pmoWalletDelta.get('m:m-7'), 2000, 'lo storno non ha rimesso a posto il delta');
});

// ── E il ramo nativo dei due gemelli: cancello giusto, e il saldo che non va sotto zero ──────
/* 🚨⭐⭐ I COMMENTI SI TOLGONO PRIMA DI GUARDARE — e questa riga nasce da un rosso di questo
 * stesso banco, non da un ragionamento. Il caso «cancello NEGATO» è caduto sulla ricarica al
 * primo giro: a far scattare la regex era il COMMENTO che spiega perché quel cancello negato
 * NON si usa. ⇒ Una guardia che legge i commenti come codice è rotta nei due versi — dà rosso
 * su una cura giusta, e domani darebbe verde su un difetto descritto a parole.
 * 📌 *Cercare una parola nel sorgente vuol dire cercarla anche dove il sorgente parla di sé.* */
function senzaCommenti(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}
function corpoDi(nome) { return senzaCommenti(sorgenteDi(nome)); }

test('🚪 tutt\'e due i gemelli hanno il ramo nativo, e col cancello GIUSTO', () => {
  for (const fn of ['_pmoRechargeWallet', '_pmoVoidWallet']) {
    const c = corpoDi(fn);
    assert.ok(c.includes('_pmoWalletScriviMovimento'), fn + ': nessuna strada nativa');
    assert.ok(c.includes('pmoCassaNativa'), fn + ': il cancello non è pmoCassaNativa');
    // 🚨 La negazione di `pmoGestionaleCollegatoAlCircolo` è la trappola trovata dal banco della
    //    181: quel cancello fallisce chiuso per LA SUA domanda, e negarlo vuol dire «nel dubbio
    //    scrivo denaro».
    assert.ok(!/!\s*pmoGestionaleCollegatoAlCircolo/.test(c),
      fn + ': cancello NEGATO — nel dubbio scriverebbe denaro');
  }
});

/* 🚨⭐⭐ LA REGOLA DELLO STORNO SI ESEGUE, non si cerca — e questa forma nasce da un sabotaggio
 * che NON è stato preso: spegnendo il controllo con `if (false)` la parola `EXCEEDS_BALANCE`
 * restava nel sorgente e il caso restava verde. È la lezione della 181, ripetuta identica.
 * ⇒ La regola sta in `_pmoWalletStornoAmmesso`, pura, e qui gira davvero. */
test('🚨 lo storno non porta il borsellino sotto zero — regola ESEGUITA', () => {
  const regola = new Function(`${sorgenteDi('_pmoWalletStornoAmmesso')}; return _pmoWalletStornoAmmesso;`)();
  assert.equal(regola(1000, 500), true, 'uno storno che sta dentro il saldo va permesso');
  assert.equal(regola(1000, 1000), true, 'lo storno TOTALE è il caso normale');
  assert.equal(regola(1000, 1001), false, 'un centesimo oltre il saldo è passato');
  assert.equal(regola(0, 100), false);
  assert.equal(regola(null, 100), false, 'saldo IGNOTO: nel dubbio non si storna');
  assert.equal(regola(undefined, 100), false);
  assert.equal(regola(1000, 0), false, 'importo zero non è uno storno');
  assert.equal(regola(1000, -500), false, 'un importo negativo non autorizza niente');
});

test('🔗 …e il gemello dello storno la CHIAMA prima di scrivere', () => {
  // ⚖️ La regola giusta serve a qualcosa solo se la strada ci passa: sono due difetti diversi
  //    (una regola sbagliata, e una regola giusta mai chiamata) e vogliono due casi.
  const c = corpoDi('_pmoVoidWallet');
  const iRegola = c.indexOf('_pmoWalletStornoAmmesso');
  const iScrive = c.indexOf('_pmoWalletScriviMovimento');
  assert.ok(iRegola > 0, 'lo storno non chiama la regola del saldo');
  assert.ok(iScrive > 0);
  assert.ok(iRegola < iScrive, 'la regola è chiamata DOPO la scrittura: non protegge niente');
});

test('🚫 la ricarica NON chiama la regola dello storno (o sarebbe copiata a sproposito)', () => {
  // ⭐ Controllo negativo del caso sopra: se comparisse in tutt'e due, quel caso resterebbe
  //    verde senza distinguere il gemello che ne ha bisogno da quello che no.
  assert.ok(!corpoDi('_pmoRechargeWallet').includes('_pmoWalletStornoAmmesso'));
});

await esegui();
console.log(`\n1..${passed + failed}\n# pass ${passed}\n# fail ${failed}`);
if (failed) process.exit(1);
