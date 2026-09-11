/* 🆔 «L'id della persona è NOSTRO» — banco della voce 215 (11/09/2026).
 *
 * 🗣️ REGOLA SUA, data mentre stavo per costruire sulla chiave sbagliata:
 *    *«il nostro ID di riferimento è quello PMO»* · *«l'ID riserva non ci serve a nulla,
 *    utilizziamo solamente il nostro ID PMO»*. E non era nuova: è la sua decisione del 2/08/2026,
 *    già scritta nel sorgente — *«il nostro è il perno e sopravvive al distacco da Matchpoint»*.
 *
 * 📏 IL DIFETTO, misurato dalla prova fisica della 211: un incasso in contanti su una prenotazione
 *    nata da noi nasceva con `id_cliente` VUOTO e `member_local_id` NULL ⇒ denaro nel libro di
 *    cassa che non è di nessuno, e che nella scheda del socio non comparirà mai.
 *
 * 📏 PERCHÉ IL `PMO-` E NON `member.id`, misurato su `cudi` prima di scrivere: **2822 soci vivi su
 *    2826** hanno `pmoPlayerId`, tutti col prefisso `PMO-`; i 4 senza sono due «Ospite» e due
 *    utenze di servizio. Mentre `member.id` per **1043 soci** si chiama `matchpoint_…`, cioè porta
 *    addosso il nome del sistema che stiamo spegnendo.
 *
 * 🚨 DUE `PMO-` DIVERSI, e questo banco difende la distinzione: quello della PRENOTAZIONE
 *    (`PMO-` + UUID) e quello della PERSONA (`PMO-` + 6 cifre). Confonderli aggancerebbe una
 *    partita a un socio.
 *
 * ⛔ QUELLO CHE QUESTO BANCO NON DICE: che un incasso vero arrivi attribuito in archivio. Gira
 *    senza browser e senza database. Lo dice il gesto.
 *
 * Esegui:  node test/lid-della-persona-e-nostro.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(QUI, '..', 'index.html'), 'utf8');
/* 🆔🚨 VOCE 215 — il banco guarda ANCHE il server, ed è la lezione che questa voce ha pagato:
   la catena era giusta in tutta l'app e si interrompeva nell'edge, che dall'app non si vede. */
const EDGE = readFileSync(join(QUI, '..', 'supabase', 'functions', 'matchpoint-bookings-create', 'index.ts'), 'utf8');
assert.ok(APP.length > 500000, 'sorgente non letto: questo banco non direbbe niente');

let passed = 0, failed = 0;
function test(nome, fn) {
  try { fn(); passed++; console.log('ok   - ' + nome); }
  catch (e) { failed++; console.log('FAIL - ' + nome + '\n       ' + e.message); }
}
function soloCodice(t) {
  return String(t).split('\n').filter((r) => !/^\s*(\/\/|\*|\/\*)/.test(r)).join('\n');
}
function ritaglia(firma, { codice = true } = {}) {
  const i = APP.indexOf(firma);
  assert.ok(i > 0, '«' + firma + '» non c\'è più: questo banco non sa dove guardare');
  let liv = 0, j = APP.indexOf('{', i), fine = -1;
  for (let k = j; k < APP.length; k++) {
    if (APP[k] === '{') liv++;
    else if (APP[k] === '}') { liv--; if (liv === 0) { fine = k + 1; break; } }
  }
  const src = APP.slice(i, fine);
  return codice ? soloCodice(src) : src;
}
/** Esegue una funzione pura ritagliata dal sorgente. */
function esegui(firma, nome, extra = '') {
  const ctx = vm.createContext({});
  vm.runInContext(extra + '\n' + ritaglia(firma, { codice: false }) + `\nglobalThis.__f = ${nome};`, ctx);
  return ctx.__f;
}

// ══════════════════════════════════════════════════════════════════════════════
// ① LA LETTURA DELL'ID — e la distinzione fra i due PMO
// ══════════════════════════════════════════════════════════════════════════════
const pmoId = esegui('function _staffCalPmoId(', '_staffCalPmoId');

test('① legge il PMO della PERSONA', () => {
  assert.equal(pmoId({ pmoPlayerId: 'PMO-000112' }), 'PMO-000112');
  assert.equal(pmoId({ pmoPlayerId: ' pmo-000326 ' }), 'PMO-000326', 'non normalizza spazi e maiuscole');
});

test('① 🚨 …e RIFIUTA quello della PRENOTAZIONE', () => {
  /* I due PMO hanno forme diverse apposta. Se questa guardia li accettasse tutt'e due, un id di
     partita finirebbe nel campo «chi ha pagato» — e sarebbe un incasso attribuito a una prenotazione. */
  assert.equal(pmoId({ pmoPlayerId: 'PMO-ab603e6c-99c9-4c6a-b3cc-7e0e3d999508' }), '',
    'accetta il PMO di una PRENOTAZIONE come se fosse una persona');
});

test('① e rifiuta ciò che non è un PMO', () => {
  for (const v of [undefined, null, '', '1034', '001013', 'matchpoint_100hip6', 'PMO-', 'PMO-ab'])
    assert.equal(pmoId({ pmoPlayerId: v }), '', 'accetta «' + v + '» come id nostro');
  assert.equal(pmoId(null), '', 'esplode o accetta un socio che non c\'è');
});

// ══════════════════════════════════════════════════════════════════════════════
// ② L'ATTRIBUZIONE DELLA RIGA DI CASSA — tre chiavi, in ordine, e mai il nome
// ══════════════════════════════════════════════════════════════════════════════
const rigaSocio = esegui('function _pmoPagRigaSocio(', '_pmoPagRigaSocio');

test('② il PMO aggancia la riga al socio', () => {
  assert.equal(rigaSocio({ pmo_player_id: 'PMO-000112' }, { id: 'x', pmoPlayerId: 'PMO-000112' }, null), true);
});

test('② 🚨 e un PMO che NON combacia dice NO, non «riprovo con un\'altra chiave»', () => {
  /* 📌 Provare più chiavi finché una aggancia non è robustezza: è cercare un sì. Qui il
     `member_local_id` combacerebbe, ma il PMO dice che sono due persone diverse. */
  const r = rigaSocio(
    { pmo_player_id: 'PMO-000112', member_local_id: 'abc' },
    { id: 'abc', pmoPlayerId: 'PMO-000999' }, null);
  assert.equal(r, false, 'un PMO diverso viene scavalcato da una chiave più debole');
});

test('② le 1421 righe già scritte continuano ad agganciare', () => {
  /* ⚖️ Nessuna di quelle porta `pmo_player_id`: se la nuova chiave le avesse sostituite invece di
     precederle, si sarebbero staccate tutte in un colpo. */
  assert.equal(rigaSocio({ member_local_id: 'abc' }, { id: 'abc', pmoPlayerId: 'PMO-000112' }, null), true,
    'una riga vecchia (senza PMO) non aggancia più il socio');
  assert.equal(rigaSocio({ id_cliente: '1034' }, { id: 'zzz' }, '1034'), true,
    'il ripiego sul codice Matchpoint è sparito mentre il ponte c\'è ancora');
});

test('② ⛔ e MAI per nome (regola della 138)', () => {
  const src = ritaglia('function _pmoPagRigaSocio(');
  assert.ok(!/player_name|\bnome\b/.test(src),
    '`_pmoPagRigaSocio` guarda il nome: è la 138, che costò una scheda aperta sulla persona sbagliata');
});

// ══════════════════════════════════════════════════════════════════════════════
// ③ LA CATENA — il PMO deve sopravvivere da dove nasce fino alla riga di cassa
// ══════════════════════════════════════════════════════════════════════════════
test('③ la riga di cassa SCRIVE il PMO', () => {
  const src = ritaglia('async function _pmoCassaScriviIncasso(');
  assert.match(src, /pmo_player_id:\s*String\(opts\.pmoId/,
    'la riga di cassa non porta più l\'id nostro: nasce di nuovo senza proprietario');
});

test('③ l\'incasso lo riceve e lo passa', () => {
  const src = ritaglia('async function _pmoCollectPayment(');
  assert.ok(/opts\.pmoId/.test(src), '`_pmoCollectPayment` non legge più il PMO');
  assert.match(src, /pmoId:\s*pmoId/, 'il PMO non arriva alla scrittura della riga di cassa');
  assert.match(src, /_pmoSocioLocalId\(idCliente,\s*pmoId\)/,
    'l\'id locale del socio si risolve ancora senza il PMO: su una scheda nostra tornerebbe null');
});

test('③ la SERIALIZZAZIONE lo copia — è il punto dove moriva', () => {
  /* 📌 Aggiungere un campo dove nasce non serve a niente se chi lo scrive non lo copia: la
     serializzazione teneva solo i due codici di Matchpoint. */
  const riga = APP.match(/^.*const addArr = st\.hasPlayers.*$/m);
  assert.ok(riga, 'la serializzazione dei giocatori è sparita');
  assert.ok(/o\.pmoId = p\.pmoId/.test(riga[0]),
    'la serializzazione non copia il PMO: non arriverebbe MAI nel payload della prenotazione');
});

test('③ la MEMORIA del roster lo ricorda — ESEGUITA, non letta', () => {
  /* 🚨 Prima questo caso cercava la stringa `riga.pmoId`, e un sabotaggio `if (false) riga.pmoId = …`
     gli passava VERDE davanti: la stringa c'era ancora. 📌 *Una prova che cerca una parola prova che
     la parola c'è, non che il codice succeda.* */
  const f = esegui('function _pmoRosterDaRicordare(', '_pmoRosterDaRicordare');
  const out = f([{ nome: 'Lidia Comes', idx: 0, pmoId: 'PMO-000112', importoCents: 1200 }], '2026-09-11T00:00:00Z');
  assert.equal(out.length, 1, 'la riga si è persa');
  assert.equal(out[0].pmoId, 'PMO-000112',
    'il PMO non si ricorda: si perde alla riapertura della scheda, cioè quando serve per incassare');
  const vuoto = f([{ nome: 'Ospite', idx: 1 }], '2026-09-11T00:00:00Z');
  assert.ok(!('pmoId' in vuoto[0]), 'inventa un PMO su una riga che non ce l\'ha');
});

test('③ 🚨 e SOPRAVVIVE alla rilettura dal worker', () => {
  /* Il roster del worker è la ficha di Matchpoint e del nostro id non sa niente: senza la
     ricucitura, la cura funzionava e smetteva da sola dopo qualche secondo. */
  const i = APP.indexOf('partecipantiFinali)\n            ? _normRoster');
  const zona = APP.slice(APP.indexOf('let roster = (ok && data'), APP.indexOf('const st = staffCalPlayersState;', APP.indexOf('let roster = (ok && data')));
  assert.ok(/_pmoPerNome/.test(zona),
    'il PMO si perde quando il worker risponde: l\'incasso fatto dopo nasce di nuovo senza proprietario');
  assert.ok(/if \(!p \|\| p\.pmoId\) return p;/.test(zona),
    'la ricucitura sovrascrive un PMO che c\'era già invece di rispettarlo');
  /* 🚨 E la condizione dev'essere VIVA: `if (false) {` lasciava tutto il resto in piedi e questo
     caso passava verde. Si controlla che ciò che comanda sia la mappa, non una costante. */
  assert.ok(/if \(_pmoPerNome\.size\)/.test(zona),
    'la ricucitura è governata da qualcosa che non è la mappa dei PMO: potrebbe essere spenta');
  assert.ok(!/if \((?:false|0)\)/.test(zona), 'c\'è un ramo spento dentro la ricucitura');
});

// ══════════════════════════════════════════════════════════════════════════════
// ④ L'AGGANCIO DEL SOCIO — il PMO davanti, Matchpoint dietro, e nessun ripiego
// ══════════════════════════════════════════════════════════════════════════════
test('④ il PMO viene PRIMA del codice Matchpoint', () => {
  const src = ritaglia('function _staffCalSocioDelGiocatore(');
  const iPmo = src.indexOf('pmoId');
  const iMp = src.indexOf('idInterno');
  assert.ok(iPmo > 0, 'l\'aggancio non conosce il PMO');
  assert.ok(iPmo < iMp, 'il codice di Matchpoint viene prima del nostro id');
});

test('④ 🚨 un PMO che non aggancia NON ricade su Matchpoint', () => {
  /* Se il nostro id non trova nessuno, la risposta è «non lo so» — non «riprovo con la chiave
     che stiamo togliendo». Altrimenti la chiave vecchia non morirebbe mai. */
  const src = ritaglia('function _staffCalSocioDelGiocatore(');
  const dentro = src.slice(src.indexOf('pmoId'), src.indexOf('const idInterno'));
  /* 🚨 `return perPmo;` da solo non bastava: `if (perPmo) return perPmo;` lo contiene, e passava
     verde pur ricadendo su Matchpoint. Si controlla l'uscita INCONDIZIONATA. */
  assert.ok(/\n\s*return perPmo;/.test(dentro),
    'il ramo del PMO non esce sempre: quando il nostro id non aggancia ricade sul codice di Matchpoint');
  assert.ok(!/if \(perPmo\)\s*return perPmo;/.test(dentro),
    'l\'uscita del ramo PMO è condizionata: un PMO che non trova nessuno riprova con Matchpoint');
});

test('④ e l\'Ospite resta muto anche per questa strada', () => {
  /* 📏 L'Ospite un id ce l'ha (è `1`) e due record vivi: la 138 ci è già cascata una volta. */
  const src = ritaglia('function _staffCalSocioDelGiocatore(');
  const dentro = src.slice(src.indexOf('pmoId'), src.indexOf('const idInterno'));
  assert.ok(/isGuestJollyMember/.test(dentro),
    'per la strada del PMO l\'Ospite tornerebbe cliccabile: è il difetto della 138, da un\'altra porta');
});

test('③ 🚨 i BOTTONI della scheda passano il PMO della riga', () => {
  /* Questo caso MANCAVA, e il sabotaggio che azzerava il valore passava verde: tutta la catena
     poteva essere giusta e l'ultimo anello — chi preme Cash — mandare una stringa vuota.
     📌 *Una catena si prova dall'anello che tocca il mondo, non da quelli comodi da leggere.* */
  const i = APP.indexOf('const _collect = function (method) {');
  assert.ok(i > 0, 'la chiamata all\'incasso dai bottoni è sparita');
  const zona = APP.slice(i, APP.indexOf('};', APP.indexOf('sourceBtns', i)));
  assert.match(zona, /pmoId:\s*\(p\.pmoId != null \? String\(p\.pmoId\) : ''\)/,
    'i bottoni non passano più il PMO della riga: l\'incasso nascerebbe senza proprietario');
});

test('③ 🚨🚨 IL SERVER non pota il PMO — trovato dalla PROVA FISICA, non dal banco', () => {
  /* 📏 L'11/09 una prenotazione vera creata su TEST aveva `pmoId: "PMO-000583"` in memoria e, nel
     database, la stessa riga con solo `{nome, codice, codiceCliente}`. ⇒ La normalizzazione
     dell'edge RICOSTRUISCE l'oggetto a chiavi fisse, quindi ogni campo nuovo muore in silenzio —
     ed è la stessa trappola che nel 2026 aveva già ucciso `codiceCliente`.
     📌 *Un campo nuovo si aggiunge dove qualcuno lo LEGGE, e uno dei lettori è il server.* */
  const i = EDGE.indexOf('const giocatori = (Array.isArray(body.giocatori)');
  assert.ok(i > 0, 'la normalizzazione dei giocatori nell\'edge è sparita');
  const zona = EDGE.slice(i, EDGE.indexOf('.filter((g) => g.nome);', i));
  assert.ok(/pmoId:\s*clean\(o\.pmoId \?\? o\.pmoPlayerId\)/.test(zona),
    'l\'edge ricostruisce i giocatori SENZA il PMO: la riga nel database nasce senza proprietario');
  assert.ok(/if \(typeof g === 'string'\) return \{[^}]*pmoId: ''/.test(zona),
    'il ramo delle voci-stringa non dichiara il PMO: due forme dello stesso dato con chiavi diverse');
});

test('③ e la funzione degli importi non lo pota a sua volta', () => {
  /* Passa dopo la normalizzazione e RICOSTRUISCE le righe: se non usasse lo spread, il PMO
     morirebbe un passo più in là — e la cura sopra sembrerebbe fatta. */
  const LIST = readFileSync(join(QUI, '..', 'supabase', 'functions', 'matchpoint-bookings-create', 'importo-dal-listino.ts'), 'utf8');
  const i = LIST.indexOf('export function importiDalListino(');
  assert.ok(i > 0, '`importiDalListino` è sparita');
  const zona = LIST.slice(i, i + 1400);
  assert.ok(/const riga: GiocatoreRiga = \{ \.\.\.g \};/.test(zona),
    '`importiDalListino` non copia più tutti i campi: il PMO si perde aggiungendo gli importi');
});

console.log('\n— ' + passed + ' verdi, ' + failed + ' rossi —');
process.exit(failed ? 1 : 0);
