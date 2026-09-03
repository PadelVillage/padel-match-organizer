/* 💶 «Una riga su cui si agisce dev'essere una cosa sola» — banco della voce 133 (03/09/2026).
 *
 * 🗣️ NASCE DA UNA SUA DOMANDA: *«è possibile negli incassi avere lo storno, come lo abbiamo nella
 * tab pagamenti di anagrafica?»*, poi precisata in *«lo storno logicamente nella sezione incassi
 * per riga di movimento»* e infine *«si clicca sul nome del giocatore e si apre la scheda… così lo
 * storno si fa sempre nello stesso posto»*.
 *
 * 📏 LE MISURE CHE HANNO DISEGNATO LA CURA (su PROD, 3183 pagamenti veri):
 *   · la tabella aggregava per GIOCATORE: negli ultimi 7 giorni **38 righe contenevano più di un
 *     movimento** (fino a 4) e **21 ne mescolavano due METODI diversi** ⇒ una riga non era un
 *     fatto, ed è per questo che non ci si poteva appoggiare sopra un gesto;
 *   · la scheda SOCIO apre solo **116 righe su 250 (46%)**: 120 sono «Ospite», che una scheda socio
 *     non ce l'ha e non ce l'avrà mai, più 14 soci non collegati;
 *   · la scheda della PARTITA invece c'è per tutte, perché ogni pagamento nasce da una prenotazione.
 * ⇒ Il criterio suo («un posto solo») è rimasto; la misura ha cambiato **quale** posto.
 * 📌 *Quando una strada copre metà dei casi, la domanda non è come coprire l'altra metà: è se
 * esiste un'altra strada che le copre tutte.*
 *
 * 🚨 E LA COSA CHE QUESTO BANCO PROTEGGE DAVVERO: lo storno di Matchpoint annulla il **cobro del
 * giocatore su quella partita**, NON il singolo movimento — misurato leggendo `marcaStornato`
 * nell'edge, che filtra per cliente/nome **e slot**, mai per metodo o importo. ⇒ Portarsi dietro
 * l'importo del movimento cliccato sarebbe una promessa che il circolo non mantiene.
 *
 * ⛔ Quello che questo banco NON dice: gira senza browser. Che la riga si apra davvero e che la
 * scheda arrivi col suo idReserva lo dice una misura sull'app viva, non un banco.
 *
 * Esegui:  node test/una-riga-e-un-fatto-solo.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = join(QUI, '..');
const APP = readFileSync(join(RADICE, 'index.html'), 'utf8');
const EDGE = join(RADICE, 'supabase', 'functions', 'matchpoint-payment-void', 'index.ts');

let passed = 0, failed = 0;
function test(nome, fn) {
  try { fn(); passed++; console.log('ok   - ' + nome); }
  catch (e) { failed++; console.log('FAIL - ' + nome + '\n       ' + e.message); }
}

test('la sezione Incassi disegna una riga per MOVIMENTO, non per giocatore', () => {
  assert.ok(/d\.movimenti\.push\(/.test(APP),
    'i movimenti non vengono più raccolti: la tabella è tornata ad aggregare, e una riga torna a essere due fatti');
  assert.ok(!/d\.players\.set\(pkey/.test(APP),
    'è tornata l\'aggregazione per giocatore: due movimenti con metodi diversi ricadrebbero nella stessa riga');
});

test('dalla riga si apre la PARTITA, che copre tutti — non la scheda socio, che copre il 46%', () => {
  assert.ok(APP.includes('function pmoIncassiApriPartita('),
    'pmoIncassiApriPartita non c\'è più: la riga di movimento non porta più da nessuna parte');
  const i = APP.indexOf('function pmoIncassiApriPartita(');
  const corpo = APP.slice(i, i + 1600);
  assert.ok(corpo.includes('staffCalEditPlayers'),
    'deve aprire la scheda della prenotazione: è la lettura autorevole di quella scheda a procurare l\'idReserva, senza cui lo storno non parte (NO_IDRESERVA)');
  assert.ok(!/openMemberCard/.test(corpo),
    'apre la scheda SOCIO: copre 116 righe su 250 e lascia scoperti i 120 «Ospite», che una scheda socio non hanno');
});

test('NON si porta dietro importo o metodo del movimento cliccato', () => {
  // Lo storno annulla il cobro del giocatore su quella partita, non il movimento: un importo
  // precompilato farebbe credere il contrario.
  const i = APP.indexOf('function pmoIncassiApriPartita(');
  const firma = APP.slice(i, APP.indexOf(')', i) + 1);
  for (const vietato of ['cents', 'importo', 'metodo', 'method', 'bucket']) {
    assert.ok(!new RegExp('\\b' + vietato, 'i').test(firma),
      `la firma porta \`${vietato}\`: lo storno è per (giocatore, partita) e non per movimento — prometterebbe una cosa che Matchpoint non fa`);
  }
});

test('il ↩︎ nella scheda della partita è acceso, e dallo STESSO flag dello storno', () => {
  // Era legato a PMO_PAYMENTS_WRITE_ENABLED (l'incasso): un gesto con due interruttori non si sa
  // accendere. Ora guarda PMO_PAYMENTS_VOID_ENABLED, come `_pmoVoidPayment` e la scheda socio.
  const m = APP.match(/const _payVoidActive = ([\s\S]{0,200}?);/);
  assert.ok(m, '_payVoidActive non c\'è più');
  assert.ok(/PMO_PAYMENTS_VOID_ENABLED/.test(m[1]),
    'il ↩︎ della scheda partita non guarda il flag dello storno: può restare spento mentre lo storno è acceso dappertutto');
  assert.match(APP, /const PMO_PAYMENTS_VOID_ENABLED = true;/,
    'lo storno è stato spento: senza, per gli «Ospite» non resta nessun posto in cui stornare');
});

test('l\'edge storna per CLIENTE e SLOT, mai per metodo: è il fatto su cui poggia tutto', () => {
  if (!existsSync(EDGE)) { console.log('       (edge non presente: saltato)'); return; }
  const E = readFileSync(EDGE, 'utf8');
  const i = E.indexOf('const daMarcare');
  assert.ok(i > 0, 'il filtro delle righe da marcare non c\'è più nell\'edge');
  const filtro = E.slice(i, i + 1400);
  assert.ok(/slotChiave/.test(filtro),
    'è sparito il filtro sullo SLOT: stornare un pagamento marcherebbe stornati TUTTI quelli di quel socio');
  assert.ok(!/\bpl\.method\b|\bpl\.amount_cents\b/.test(filtro),
    'l\'edge ha cominciato a filtrare per metodo/importo: se un giorno lo storno diventa per movimento, questo banco va riscritto INSIEME alla riga di Incassi, che oggi promette il contrario');
});

console.log('\n' + passed + ' passati, ' + failed + ' falliti');
process.exit(failed ? 1 : 0);
