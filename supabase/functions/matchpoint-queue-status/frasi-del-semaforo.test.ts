/* 🚦 «Il sync non si vede, e il worker non parla» — banco del pezzo ③ della voce 137 (03/09/2026).
 *
 * 🗣️ LE DUE DECISIONI SUE che questo banco esercita, e che sono in tensione fra loro:
 *   · «Ogni due minuti la pagina si aggiorna con i dati importati da Matchpoint. Questo io non
 *      vorrei vederlo sul calendario segnalato.» ⇒ il traffico automatico non accende niente;
 *   · «Io che sono di segreteria devo vedere le azioni di chi le fa dal chatbot e le azioni che
 *      faccio io da gestionale.» ⇒ i gesti dal bot sì, ed etichettati.
 *
 * 🚨 E LA REGOLA CHE NON SI VEDE LEGGENDO LA VOCE, ma che è quella che protegge il circolo: quello
 * che l'operatore legge dev'essere una frase del GESTIONALE, mai un codice del worker. Il worker
 * è il tramite del gestionale — che il gestionale sappia la risposta di Matchpoint è normale —
 * ma il calendario è una superficie che guarda anche chi passa davanti allo schermo.
 *
 * ⛔ QUELLO CHE QUESTO BANCO **NON** DICE: che la barra si veda, che sia leggibile da telefono, o
 * che la frase stia nello spazio disponibile. Prova la REGOLA, non il disegno. Il pezzo ④ non è
 * ancora scritto, e finché non c'è, il semaforo per chi fa segreteria **non esiste**.
 *
 * 🩹 La prima stesura di questo banco si SPOGLIAVA i tipi da sola con una fila di `replace`, per
 * poter passare il sorgente a `new Function`. Era rossa per conto suo — inciampava su un
 * `running!)` che una delle regex non copriva — e sarebbe rimasta fragile a ogni riga nuova del
 * modulo. Node 22 il `.ts` lo importa e basta, come fanno già gli altri banchi delle edge.
 * 📌 *Prima di costruire un aggeggio, guarda come lo fanno i pezzi accanto.*
 *
 * Esegui:  node supabase/functions/matchpoint-queue-status/frasi-del-semaforo.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  semaforoDaSnapshot,
  etichettaPerLoperatore,
  chiSpiegato,
  SENZA_ETICHETTA,
} from './frasi-del-semaforo.ts';

const QUI = dirname(fileURLToPath(import.meta.url));

let passed = 0, failed = 0;
function test(nome: string, fn: () => void) {
  try { fn(); passed++; console.log('ok   - ' + nome); }
  catch (e) { failed++; console.log('FAIL - ' + nome + '\n       ' + (e as Error).message); }
}

const GESTO = { op: 'create', label: 'prenotazione partita · Campo 2 · 16:30', operatore: 'staff@padelvillage.club', chiestoDa: 'staff', gesto: true };
const SYNC = { op: 'export-history', label: 'export-history', operatore: '—', chiestoDa: '', gesto: false };

// ── ① IL SYNC NON SI VEDE — la sua decisione, ed è il punto della voce ──────────────────────
test('il giro dei 2 minuti lascia la barra SPENTA', () => {
  const s = semaforoDaSnapshot({ busy: true, running: SYNC, waiting: [] });
  assert.equal(s.acceso, false);
  assert.equal(s.frase, null);
});

test('il traffico automatico in attesa non si CONTA', () => {
  // Un «3 in fila» che conta i poll direbbe al circolo che c'è un ingorgo dove non c'è.
  const s = semaforoDaSnapshot({ running: GESTO, waiting: [SYNC, SYNC, { ...GESTO, op: 'cancel' }] });
  assert.equal(s.inAttesa, 1);
});

test('coda vuota → spenta e muta', () => {
  const s = semaforoDaSnapshot({ busy: false, running: null, waiting: [] });
  assert.deepEqual(s, { acceso: false, frase: null, inAttesa: 0, dichiarazioneMancante: false });
});

// ── ② IL GESTO SI VEDE, E DICE CHI ──────────────────────────────────────────────────────────
test('un gesto della segreteria accende la barra e dice chi lavora', () => {
  const s = semaforoDaSnapshot({ busy: true, running: GESTO, waiting: [] });
  assert.equal(s.acceso, true);
  assert.ok(s.frase.includes('prenotazione partita'), s.frase);
  assert.ok(s.frase.includes('staff@padelvillage.club'), s.frase);
});

test('un gesto dal bot dice «richiesta da un socio»', () => {
  const dalBot = { ...GESTO, operatore: 'assistente-soci@padelvillage.club', chiestoDa: 'socio' };
  const s = semaforoDaSnapshot({ running: dalBot, waiting: [] });
  assert.equal(s.acceso, true);
  assert.ok(s.frase.includes('richiesta da un socio'), s.frase);
});

test('il NOME del socio non finisce sul calendario', () => {
  // ⛔ Questa riga sta sotto gli occhi di chiunque passi davanti allo schermo della segreteria.
  //    «un socio» basta a sapere che non è stata lei; il nome no.
  const dalBot = { op: 'cancel', label: 'annullamento · Campo 3 · 18:00', operatore: 'assistente-soci@padelvillage.club', chiestoDa: 'socio', gesto: true };
  const s = semaforoDaSnapshot({ running: dalBot, waiting: [] });
  assert.ok(!s.frase.includes('assistente-soci'), 'l\'email del ponte è finita sul calendario: ' + s.frase);
});

test('senza operatore dichiarato la frase resta, senza il «chi»', () => {
  const s = semaforoDaSnapshot({ running: { ...GESTO, operatore: '—', chiestoDa: '' }, waiting: [] });
  assert.equal(s.acceso, true);
  assert.equal(s.frase, 'prenotazione partita · Campo 2 · 16:30');
});

// ── ③ IL VOCABOLARIO — nessun nome interno arriva all'operatore ─────────────────────────────
test('un\'etichetta che nomina un pezzo interno viene sostituita INTERA', () => {
  // 🚨 Fallisce chiusa: non si ritaglia la parola colpevole lasciando il resto, perché ritagliare
  //    lascia in piedi la metà che nessuno ha pensato di cercare.
  for (const brutta of [
    'modifica · worker timeout',
    'errore Playwright sul browser',
    'chiamata a https://91.99.131.243/queue',
    'matchpoint non risponde',
    'caddy giù',
  ]) {
    assert.equal(etichettaPerLoperatore(brutta), SENZA_ETICHETTA, 'è passata: ' + brutta);
  }
});

test('un\'etichetta pulita passa intatta', () => {
  assert.equal(etichettaPerLoperatore('annullamento · Campo 1 · 09:00'), 'annullamento · Campo 1 · 09:00');
});

test('etichetta vuota → una frase, non il vuoto', () => {
  assert.equal(etichettaPerLoperatore(''), SENZA_ETICHETTA);
  assert.equal(etichettaPerLoperatore(null), SENZA_ETICHETTA);
});

test('la difesa vale anche sul CHI, non solo sul CHE', () => {
  assert.equal(chiSpiegato({ operatore: 'worker@interno', chiestoDa: '' }), null);
});

test('nemmeno un gesto acceso può far uscire un nome interno', () => {
  const s = semaforoDaSnapshot({ running: { ...GESTO, label: 'modifica · errore browser Hetzner' }, waiting: [] });
  assert.equal(s.acceso, true);
  assert.ok(!/worker|hetzner|browser|playwright/i.test(s.frase), s.frase);
});

// ── ④ LA DICHIARAZIONE CHE MANCA — un difetto non diventa un silenzio ───────────────────────
test('un job che non dichiara `gesto` NON accende la barra…', () => {
  const vecchio = { op: 'create', label: 'prenotazione · Campo 2', operatore: 'x@y.z' }; // niente `gesto`
  const s = semaforoDaSnapshot({ busy: true, running: vecchio, waiting: [] });
  assert.equal(s.acceso, false, 'la barra si è accesa su una dichiarazione che non c\'è');
});

test('…ma il fatto ESCE lo stesso, invece di sparire', () => {
  // ⚖️ Altrove in questa voce la regola è «sbagliare verso l'allarme». Qui sembra il contrario e
  //    non lo è: quella regola vale dove l'alternativa è un silenzio MUTO. Il fatto esce da
  //    un'altra porta, e la barra resta pulita come lui ha chiesto.
  //    📌 Non si sceglie fra rumore e silenzio: si sceglie DOVE mettere il fatto.
  const vecchio = { op: 'create', label: 'prenotazione · Campo 2' };
  assert.equal(semaforoDaSnapshot({ running: vecchio, waiting: [] }).dichiarazioneMancante, true);
  assert.equal(semaforoDaSnapshot({ running: null, waiting: [vecchio] }).dichiarazioneMancante, true);
});

test('un `gesto: false` esplicito NON è una dichiarazione mancante', () => {
  // La differenza fra «non è un gesto» e «non lo so» è tutta questa voce.
  assert.equal(semaforoDaSnapshot({ running: SYNC, waiting: [SYNC] }).dichiarazioneMancante, false);
});

// ── ⑤ ROBUSTEZZA — lo snapshot arriva dalla rete, non da noi ────────────────────────────────
test('uno snapshot rotto non fa cadere il calendario', () => {
  for (const rotto of [null, undefined, {}, { running: undefined, waiting: null }, { waiting: 'boh' }]) {
    const s = semaforoDaSnapshot(rotto);
    assert.equal(s.acceso, false);
    assert.equal(typeof s.inAttesa, 'number');
  }
});

// ── ⑥ LA CUCITURA — l'edge usa il modulo, e i suoi guasti parlano italiano ──────────────────
test('l\'edge non inoltra più lo snapshot GREZZO e basta', () => {
  const edge = readFileSync(join(QUI, 'index.ts'), 'utf8');
  assert.ok(edge.includes("import { semaforoDaSnapshot } from './frasi-del-semaforo.ts'"),
    'l\'edge non importa la regola');
  assert.ok(edge.includes('semaforo: semaforoDaSnapshot(body as JsonMap)'),
    'l\'edge non calcola più il semaforo');
});

test('i due guasti dell\'edge non mandano più un messaggio tecnico al calendario', () => {
  const edge = readFileSync(join(QUI, 'index.ts'), 'utf8');
  // 🩹 Prima `WORKER_UNREACHABLE` portava con sé `${errorText(netErr)}`, cioè il messaggio di rete
  //    grezzo — un nome interno servito a chi guarda il calendario. Il codice resta per il
  //    registro; il messaggio no.
  assert.ok(!/WORKER_UNREACHABLE',\s*`Worker non raggiungibile/.test(edge),
    'il messaggio di rete grezzo è tornato nella risposta');
  assert.ok(!/'WORKER_ERROR',\s*errorText\(/.test(edge),
    'l\'errore grezzo del worker è tornato nella risposta');
  assert.ok(edge.includes('Il sistema del circolo non risponde in questo momento.'),
    'manca la frase del gestionale sui due guasti');
  const conteggio = (edge.match(/console\.error\(`\[queue-status\]/g) || []).length;
  assert.equal(conteggio, 2, 'i due guasti non finiscono entrambi nel registro: ' + conteggio);
});

console.log('\n' + passed + ' ok, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
