/* 💶 «L'importo si ricorda, e dice quando» — banco della VOCE 151 (04/09/2026).
 *
 * 🗣️ SUA OSSERVAZIONE: «sull'importo c'è un trattino, dopo circa otto secondi appare l'importo.
 *   Ma questo non è normale perché ci siamo detti che dovrebbe apparire già l'importo visto che
 *   ogni due minuti andiamo a leggere Matchpoint attraverso il worker.»
 * 🗣️ SUA APPROVAZIONE: «Sì, procedi col salvare l'importo quando si legge.»
 *
 * 📏 LA PREMESSA DELLA SUA FRASE È FALSA, ed è la misura che ha deciso la strada: il sync ogni due
 *   minuti NON legge gli importi (`giocatori?: string[]`, solo nomi, dalla descrizione dell'export).
 *   Gli importi stanno nella ficha della singola prenotazione, e aprirle tutte vorrebbe dire ~206
 *   prenotazioni × un giro ogni 2 minuti sul worker CONDIVISO ≈ 150.000 visite al giorno.
 *   ⇒ L'unica lettura che vede gli importi è quella che parte aprendo la scheda — e si buttava via.
 *
 * 🎯 LE SEI COSE CHE QUESTO BANCO DIFENDE:
 *   ① il terzo esito della casella — «ricordato» — esiste e non si confonde con gli altri due;
 *   ② 🚨 non c'è «ricordato» senza numero: un `lettoAt` su una casella vuota ricorderebbe niente;
 *   ③ 🚨 la 149 NON si rimangia: uno zero LETTO resta `0,00`, e un «da» mai letto resta `(non letto)`;
 *   ④ 🚨 il «da» ricordato si DICHIARA. Senza questo la 151 avrebbe rotto la 149 al contrario —
 *      un numero vecchio stampato come appena letto è un «da» inventato quanto lo zero, e più
 *      credibile perché è un numero vero;
 *   ⑤ 🚨 quello che NON si ricorda: `saldoCents` (il borsellino non è un fatto di questa partita)
 *      e `stato` (un «✓ pagato» ricordato su un pagamento stornato fa saltare un incasso vero);
 *   ⑥ 🚨 la guardia «è cambiato?» guarda anche i SOLDI. Guardando i soli nomi, un cambio importo
 *      su Matchpoint non sarebbe mai stato ricordato: la funzione sarebbe uscita dicendo «uguale»
 *      dopo aver confrontato metà del dato. Una guardia che confronta meno di quello che salva
 *      non protegge: congela.
 *
 * ⛔ QUELLO CHE NON DICE: gira senza browser e senza Matchpoint. Dice che le regole decidono bene,
 *    non che aprendo una scheda vera l'importo ci sia già. Quello lo dice una scheda vera.
 *
 * Esegui:  node test/limporto-si-ricorda-e-dice-quando.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(QUI, '..', 'index.html'), 'utf8');
assert.ok(APP.length > 500000, 'sorgente non letto: questo banco non direbbe niente');

let passed = 0, failed = 0;
function test(nome, fn) {
  try { fn(); passed++; console.log('ok   - ' + nome); }
  catch (e) { failed++; console.log('FAIL - ' + nome + '\n       ' + e.message); }
}

function corpoDi(nome) {
  const i = APP.indexOf('function ' + nome + '(');
  assert.ok(i > 0, 'funzione non trovata: ' + nome);
  const apre = APP.indexOf(') {', i);
  let g = 0, visto = false, out = '';
  for (let k = apre + 2; k < APP.length; k++) {
    const c = APP[k];
    out += c;
    if (c === '{') { g++; visto = true; }
    else if (c === '}') { g--; if (visto && g === 0) break; }
  }
  return out;
}
/** La firma vera, così il banco chiama la funzione con i parametri che HA, non con quelli che
 *  immagina: se qualcuno ne aggiunge o toglie uno, qui si rompe invece di passare in silenzio. */
function parametriDi(nome) {
  const i = APP.indexOf('function ' + nome + '(');
  return APP.slice(i + ('function ' + nome + '(').length, APP.indexOf(') {', i));
}
function esegui(nome, ...dipendenze) {
  const nomiDip = dipendenze.map((d) => d[0]);
  const valoriDip = dipendenze.map((d) => d[1]);
  return new Function(...nomiDip,
    'return function ' + nome + '(' + parametriDi(nome) + ') ' + corpoDi(nome) + ';')(...valoriDip);
}

const casella = esegui('_pmoImportoCasella');
const quando = esegui('_pmoQuandoLetto');
const daVerso = esegui('_pmoImportoDa');
const daRicordare = esegui('_pmoRosterDaRicordare');
const cambiato = esegui('_pmoRosterCambiato');

const IERI = '2026-09-03T19:03:00.000Z';

// ─────────────────────────────────────────────────────────────────────────────
// ① ② ③ LA CASELLA — tre esiti, e i due vecchi non si muovono.
// ─────────────────────────────────────────────────────────────────────────────
test('① l\'importo RICORDATO è un terzo esito: c\'è il numero, e si sa quando', () => {
  const c = casella(800, null, IERI);
  assert.equal(c.ignoto, false);
  assert.equal(c.ricordato, true, 'senza questo la casella vecchia e quella nuova sono identiche');
  assert.equal(c.valore, '8,00', 'il numero si mostra: è quello che lui ha chiesto di vedere subito');
  assert.equal(c.baseCents, 800);
  assert.equal(c.lettoAt, IERI, 'il QUANDO deve viaggiare col dato, non essere dedotto da chi legge');
});

test('① letto ADESSO (nessun lettoAt) non è «ricordato» — è il caso normale e resta magro', () => {
  const c = casella(800, null);
  assert.equal(c.ricordato, false);
  assert.equal(c.lettoAt, null);
  assert.equal(c.valore, '8,00');
});

test('② 🚨 non esiste un «ricordato» SENZA numero', () => {
  const c = casella(null, null, IERI);
  assert.equal(c.ignoto, true, 'niente importo ⇒ resta ignoto, il lettoAt non lo riempie');
  assert.equal(c.ricordato, false, 'ricorderebbe niente, e la casella direbbe di sapere');
  assert.equal(c.valore, '');
  assert.equal(c.baseCents, null);
});

test('③ 🚨 la 149 non si rimangia: uno ZERO LETTO resta 0,00, anche ricordato', () => {
  const c = casella(0, 0, IERI);
  assert.equal(c.ignoto, false, 'un omaggio è un importo letto che vale zero, non un dato mancante');
  assert.equal(c.valore, '0,00');
  assert.equal(c.baseCents, 0);
  assert.equal(c.ricordato, true);
});

test('③ e il PENDENTE vince sull\'importo quando c\'è qualcosa da pagare', () => {
  assert.equal(casella(1000, 400, IERI).valore, '4,00');
  assert.equal(casella(1000, 400, IERI).baseCents, 400);
});

// ─────────────────────────────────────────────────────────────────────────────
// ④ IL «DA» DEL CAMBIO IMPORTO — tre esiti, scritti una volta sola.
// ─────────────────────────────────────────────────────────────────────────────
const euro = (c) => (c / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

test('④ mai letto ⇒ «(non letto)» — la regola della 149, intatta', () => {
  assert.equal(daVerso(null, null, euro, quando), '(non letto)');
  assert.equal(daVerso(null, IERI, euro, quando), '(non letto)',
    'un lettoAt su un importo che non c\'è non deve fabbricare un «da»');
});

test('④ letto adesso ⇒ solo il numero: il caso normale non deve ingrassare', () => {
  assert.equal(daVerso(800, null, euro, quando), '8,00');
});

test('④ 🚨 RICORDATO ⇒ il numero E il quando — o la 151 romperebbe la 149 al contrario', () => {
  const s = daVerso(800, IERI, euro, quando);
  assert.match(s, /^8,00 \(letto /, 'chi conferma del denaro deve vedere che quel «da» è vecchio: ' + s);
});

test('④ e un lettoAt illeggibile non inventa un\'ora', () => {
  const s = daVerso(800, 'non-una-data', euro, quando);
  assert.equal(s, '8,00 (letto prima)', 'meglio «prima» che un orario finto: ' + s);
});

// ─────────────────────────────────────────────────────────────────────────────
// ⑤ CHE COSA SI RICORDA, E CHE COSA NO.
// ─────────────────────────────────────────────────────────────────────────────
const ORA = '2026-09-04T18:30:00.000Z';
const DAL_WORKER = [
  { idx: '0', nome: 'Dominik Benvegnù', idCliente: '4021', costo: '10,00', importoCents: 1000, pendenteCents: 1000, saldoCents: 2500, stato: 'in_sospeso' },
  { idx: '1', nome: 'Jury Piovesan', idCliente: '3311', costo: '8,00', importoCents: 800, pendenteCents: 0, saldoCents: 0, stato: 'riscosso' },
  { idx: '2', nome: 'Ospite', idCliente: '1', costo: '', importoCents: null, pendenteCents: null, saldoCents: null, stato: null },
];

test('⑤ si ricordano i SOLDI, con dentro il quando', () => {
  const r = daRicordare(DAL_WORKER, ORA);
  assert.equal(r.length, 3);
  assert.equal(r[0].importoCents, 1000);
  assert.equal(r[0].pendenteCents, 1000);
  assert.equal(r[0].idCliente, '4021');
  assert.equal(r[0].idx, '0');
  assert.equal(r[0].lettoAt, ORA, 'senza il quando il ricordo non è dichiarabile');
});

test('⑤ 🚨 il BORSELLINO no: non è un fatto di questa partita', () => {
  const r = daRicordare(DAL_WORKER, ORA);
  r.forEach((x) => assert.equal('saldoCents' in x, false,
    'un borsellino ricordato è falso per cause esterne, e nessuno lo saprebbe: ' + JSON.stringify(x)));
});

test('⑤ 🚨 lo STATO no: un «✓ pagato» ricordato su uno storno fa saltare un incasso vero', () => {
  const r = daRicordare(DAL_WORKER, ORA);
  r.forEach((x) => assert.equal('stato' in x, false, 'stato ricordato: ' + JSON.stringify(x)));
});

test('⑤ e il COSTO no: è il listino, non il dovuto', () => {
  daRicordare(DAL_WORKER, ORA).forEach((x) => assert.equal('costo' in x, false));
});

test('⑤ 🚨 niente lettoAt su una riga SENZA soldi: ricorderebbe niente', () => {
  const r = daRicordare(DAL_WORKER, ORA);
  assert.equal(r[2].nome, 'Ospite');
  assert.equal('lettoAt' in r[2], false, 'la riga senza importo non deve dichiararsi «ricordata»');
  assert.equal('importoCents' in r[2], false);
});

test('⑤ uno ZERO letto si ricorda (è un dato), un null no (è un buco)', () => {
  const r = daRicordare([{ nome: 'Omaggio', importoCents: 0, pendenteCents: 0 }], ORA);
  assert.equal(r[0].importoCents, 0, 'l\'omaggio è un importo letto che vale zero');
  assert.equal(r[0].lettoAt, ORA);
});

test('⑤ le righe senza nome si buttano, e una stringa nuda regge', () => {
  const r = daRicordare(['Mario Rossi', { nome: '   ' }, null, 7], ORA);
  assert.deepEqual(r.map((x) => x.nome), ['Mario Rossi', '7']);
});

// ─────────────────────────────────────────────────────────────────────────────
// ⑥ LA GUARDIA «È CAMBIATO?» — deve vedere i soldi, e ignorare l'orologio.
// ─────────────────────────────────────────────────────────────────────────────
test('⑥ 🚨 stessi nomi, importo DIVERSO ⇒ è cambiato (o il ricordo si congela)', () => {
  const prima = daRicordare(DAL_WORKER, ORA);
  const dopo = daRicordare(DAL_WORKER.map((p, i) => (i === 0 ? { ...p, importoCents: 1200, pendenteCents: 1200 } : p)), ORA);
  assert.equal(cambiato(prima, dopo), true,
    'guardando i soli nomi un cambio importo su Matchpoint non sarebbe mai stato ricordato');
});

/* 🩹⭐ QUESTE DUE PROVE NON C'ERANO, e le ha fatte nascere un SABOTAGGIO SBAGLIATO: togliendo
   dalla chiave il solo `pendenteCents` il banco restava **verde**, perché la prova qui sopra
   cambia i due numeri INSIEME e a riconoscerlo bastava l'altro. ⇒ Il banco stava difendendo
   «almeno uno dei due», non «tutti e due».
   📌 *Un sabotaggio che non fa diventare rosso non dice «la cura è solida»: dice che il banco
      guardava altrove — e va creduto lui, non il verde.* */
test('⑥ 🚨 cambia SOLO il pendente (un incasso) ⇒ è cambiato', () => {
  const prima = daRicordare(DAL_WORKER, ORA);
  const dopo = daRicordare(DAL_WORKER.map((p, i) => (i === 0 ? { ...p, pendenteCents: 0 } : p)), ORA);
  assert.equal(cambiato(prima, dopo), true,
    'la casella mostra il PENDENTE quando c\'è: ignorarlo lascerebbe «10,00 da pagare» su una riga saldata');
});

test('⑥ 🚨 cambia SOLO l\'importo a carico ⇒ è cambiato', () => {
  const prima = daRicordare(DAL_WORKER, ORA);
  const dopo = daRicordare(DAL_WORKER.map((p, i) => (i === 1 ? { ...p, importoCents: 900 } : p)), ORA);
  assert.equal(cambiato(prima, dopo), true);
});

test('⑥ 🚨 solo il lettoAt diverso ⇒ NON è cambiato: un campanello che suona sempre non dice niente', () => {
  const prima = daRicordare(DAL_WORKER, ORA);
  const dopo = daRicordare(DAL_WORKER, '2026-09-04T18:45:00.000Z');
  assert.equal(cambiato(prima, dopo), false,
    'ogni apertura di scheda riscriverebbe il record e ripingerebbe il cloud');
});

test('⑥ nomi diversi ⇒ è cambiato (il comportamento vecchio non si perde)', () => {
  const prima = daRicordare(DAL_WORKER, ORA);
  const dopo = daRicordare(DAL_WORKER.map((p, i) => (i === 1 ? { ...p, nome: 'Anna Verdi' } : p)), ORA);
  assert.equal(cambiato(prima, dopo), true);
});

test('⑥ e un record VECCHIO (soli nomi) va aggiornato appena arrivano i soldi', () => {
  const vecchio = [{ nome: 'Dominik Benvegnù' }, { nome: 'Jury Piovesan' }, { nome: 'Ospite' }];
  assert.equal(cambiato(vecchio, daRicordare(DAL_WORKER, ORA)), true,
    'i 206 record che oggi portano i soli nomi non prenderebbero mai gli importi');
  assert.equal(cambiato(vecchio, vecchio), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// ⑦ IL WRITE-BACK, ESEGUITO: dalla lettura del worker al record salvato.
// ─────────────────────────────────────────────────────────────────────────────
function bancoWriteBack(recordIniziale) {
  const magazzino = { staffBookings: recordIniziale };
  const salvataggi = [];
  const cloud = [];
  const f = esegui('_staffCalPersistRosterFromWorker',
    ['safeLoad', (k, d) => (magazzino[k] !== undefined ? magazzino[k] : d)],
    ['save', (k, v) => { magazzino[k] = v; salvataggi.push(k); }],
    ['_pmoRosterDaRicordare', daRicordare],
    ['_pmoRosterCambiato', cambiato],
    ['staffCalCloudSyncEdit', (...a) => cloud.push(a)],
    ['renderStaffCalendar', () => {}],
  );
  return { f, magazzino, salvataggi, cloud };
}

const REC = () => ([{ id: 'sb-1', data: '2026-09-03', campo: 2, ora: '21:00', giocatori: [{ nome: 'Dominik Benvegnù' }, { nome: 'Jury Piovesan' }, { nome: 'Ospite' }] }]);

test('⑦ la lettura del worker LASCIA gli importi nel record, e li spinge al cloud', () => {
  const b = bancoWriteBack(REC());
  b.f('2026-09-03', 2, '21:00', DAL_WORKER);
  const g = b.magazzino.staffBookings[0].giocatori;
  assert.equal(g[0].importoCents, 1000, 'l\'importo non è stato ricordato: la scheda ripartirà dal trattino');
  assert.ok(g[0].lettoAt, 'senza il quando, alla riapertura il numero si spaccerebbe per appena letto');
  assert.equal(b.salvataggi.length, 1);
  assert.equal(b.cloud.length, 1, 'il cloud è autorevole e sovrascrive il locale: senza il push il ricordo muore al primo pull');
});

test('⑦ 🚨 una seconda lettura IDENTICA non riscrive niente', () => {
  const b = bancoWriteBack(REC());
  b.f('2026-09-03', 2, '21:00', DAL_WORKER);
  b.f('2026-09-03', 2, '21:00', DAL_WORKER);
  assert.equal(b.salvataggi.length, 1, 'ogni apertura di scheda ripingerebbe il cloud per niente');
  assert.equal(b.cloud.length, 1);
});

test('⑦ 🚨 ma un importo CAMBIATO su Matchpoint sì — è il caso che la vecchia guardia perdeva', () => {
  const b = bancoWriteBack(REC());
  b.f('2026-09-03', 2, '21:00', DAL_WORKER);
  b.f('2026-09-03', 2, '21:00', DAL_WORKER.map((p, i) => (i === 0 ? { ...p, importoCents: 1200, pendenteCents: 1200 } : p)));
  assert.equal(b.salvataggi.length, 2, 'stessi giocatori, importo diverso: il record è rimasto al valore vecchio');
  assert.equal(b.magazzino.staffBookings[0].giocatori[0].importoCents, 1200);
});

test('⑦ una lettura VUOTA non svuota mai il roster', () => {
  const b = bancoWriteBack(REC());
  b.f('2026-09-03', 2, '21:00', []);
  assert.equal(b.salvataggi.length, 0);
  assert.equal(b.magazzino.staffBookings[0].giocatori.length, 3);
});

test('⑦ e uno slot che non è uno staff_booking non si tocca', () => {
  const b = bancoWriteBack([{ data: '2026-09-03', campo: 2, ora: '21:00', giocatori: [] }]); // niente id
  b.f('2026-09-03', 2, '21:00', DAL_WORKER);
  assert.equal(b.salvataggi.length, 0, 'le occupancy le gestisce la sync, non questa funzione');
});

console.log('\n' + passed + ' passati, ' + failed + ' falliti');
process.exit(failed ? 1 : 0);
