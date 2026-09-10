/**
 * ── BANCO: TORNEO E STAGE SONO PRENOTAZIONI, CON NOMI DIVERSI (voce 207) ──────────────
 *
 * 🗣️ Due sue parole del 10/09/2026, e dicono DUE cose diverse:
 *    · «Il torneo è un modo di chiamare una prenotazione.»          ⇒ niente maestro
 *    · «Anche lo stage È un tipo di prenotazione come la LEZIONE    ⇒ maestro SÌ
 *       solo con un nome diverso.»
 *
 * 🚨⭐⭐ IL CASO CHE VALE PIÙ DI TUTTI È `③ la parola sopravvive alla scrittura`.
 *    Il macchinario di uno stage è quello della lezione — ed è giusto. Ma la creazione scriveva
 *    `tipo: 'lezione'` CABLATO, quindi lo stage perdeva il proprio nome nell'istante in cui
 *    veniva scritto: da lì in poi nessuno poteva più distinguerlo, e al socio sarebbe arrivato
 *    «Lezione con Gianluca» per uno STAGE.
 *    📌 *Il macchinario si eredita, il nome no — e se il nome non sopravvive alla scrittura, il
 *    tipo nuovo non esiste: esiste solo un bottone che ne ha l'aspetto.*
 *
 * 🚨⭐ IL SECONDO: `② uno stage ha i giocatori`. `hasPlayers` era un confronto ESATTO su
 *    `['partita','lezione']`: con `tipo:'stage'` diceva false, e una scheda senza `hasPlayers`
 *    non disegna né i giocatori né il selettore del maestro ⇒ le due righe nuove, da sole,
 *    avrebbero dato uno stage SENZA maestro: l'opposto di quanto chiesto.
 *
 * ⛔ QUELLO CHE QUESTO BANCO NON DICE: che premendo «Stage» sulla pagina viva si prenoti
 *    davvero. Quello lo dice la misura sulla pagina.
 *
 * Esegui:  node test/torneo-e-stage-sono-prenotazioni.test.mjs
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

function sorgenteDi(nome) {
  const i = APP.indexOf('function ' + nome + '(');
  assert.ok(i > 0, 'funzione non trovata: ' + nome);
  let g = 0, visto = false, k = APP.indexOf(') {', i) + 2;
  for (; k < APP.length; k++) {
    const c = APP[k];
    if (c === '{') { g++; visto = true; }
    else if (c === '}') { g--; if (visto && g === 0) { k++; break; } }
  }
  return APP.slice(i, k);
}

/* 🔨 IL BANCO ESECUTIVO: la tabella e le funzioni si estraggono dall'app e si ESEGUONO. */
function monta() {
  const iTab = APP.indexOf('const PMO_TIPI_PRENOTAZIONE = [');
  assert.ok(iTab > 0, 'tabella dei tipi non trovata');
  const tabella = APP.slice(iTab, APP.indexOf('];', iTab) + 2);
  const fabbrica = new Function(`
    ${tabella}
    ${sorgenteDi('pmoTipoScheda')}
    ${sorgenteDi('pmoTipoEngine')}
    ${sorgenteDi('pmoTipoVuoleMaestro')}
    ${sorgenteDi('pmoTipoHaGiocatori')}
    ${sorgenteDi('pmoTipoEtichetta')}
    ${sorgenteDi('pmoTipoParola')}
    return { PMO_TIPI_PRENOTAZIONE, pmoTipoEngine, pmoTipoVuoleMaestro, pmoTipoHaGiocatori,
             pmoTipoEtichetta, pmoTipoParola };
  `);
  return fabbrica();
}
const T = monta();

// ══════════════════════════════════════════════════════════════════════════════════
// ① LA MATRICE — quattro tipi per tre domande. È la tabella delle sue due frasi.
// ══════════════════════════════════════════════════════════════════════════════════

const MATRICE = [
  // parola scritta    engine           maestro  giocatori  etichetta
  ['partita',          'partita',       false,   true,      'Partita'],
  ['lezione',          'lezione',       true,    true,      'Lezione'],
  ['stage',            'lezione',       true,    true,      'Stage'],
  ['torneo',           'partita',       false,   true,      'Torneo'],
  ['manutenzione',     'manutenzione',  false,   false,     'Manutenzione'],
];

MATRICE.forEach(([parola, engine, maestro, giocatori, etichetta]) => {
  test(`① «${parola}» → engine ${engine}, maestro ${maestro ? 'SÌ' : 'no'}, giocatori ${giocatori ? 'sì' : 'no'}`, () => {
    assert.equal(T.pmoTipoEngine(parola), engine, 'engine');
    assert.equal(T.pmoTipoVuoleMaestro(parola), maestro, 'maestro');
    assert.equal(T.pmoTipoHaGiocatori(parola), giocatori, 'giocatori');
    assert.equal(T.pmoTipoEtichetta(parola), etichetta, 'etichetta');
    assert.equal(T.pmoTipoParola(parola), parola, 'parola scritta');
  });
});

test('🚨 ① le sue DUE frasi, una accanto all\'altra: lo stage NON somiglia al torneo', () => {
  // «lo stage è come la LEZIONE» / «il torneo è un modo di chiamare una PRENOTAZIONE»
  assert.equal(T.pmoTipoEngine('stage'), T.pmoTipoEngine('lezione'), 'stage ≡ lezione');
  assert.equal(T.pmoTipoEngine('torneo'), T.pmoTipoEngine('partita'), 'torneo ≡ partita');
  assert.notEqual(T.pmoTipoEngine('stage'), T.pmoTipoEngine('torneo'),
    'se questi due coincidessero, una delle due sue frasi sarebbe stata ignorata');
  assert.equal(T.pmoTipoVuoleMaestro('stage'), true);
  assert.equal(T.pmoTipoVuoleMaestro('torneo'), false);
});

// ══════════════════════════════════════════════════════════════════════════════════
// 🚨 ② UNO STAGE HA I GIOCATORI — il confronto esatto che diceva «no»
// ══════════════════════════════════════════════════════════════════════════════════

test('🚨 ② `hasPlayers` non è più un elenco di due parole', () => {
  assert.ok(!/const hasPlayers = \['partita', 'lezione'\]\.includes/.test(APP),
    'il confronto esatto darebbe uno stage senza giocatori E senza maestro');
  assert.ok(/const hasPlayers = pmoTipoHaGiocatori\(tipoR\);/.test(APP));
});

test('🚨 ② e la sezione del maestro nella scheda non si appende più alla sillaba «lez»', () => {
  assert.ok(/if \(st\.hasPlayers && pmoTipoVuoleMaestro\(st\.tipoReale\)\)/.test(APP),
    'con `includes(\'lez\')` lo STAGE non avrebbe avuto il selettore del maestro');
});

// ══════════════════════════════════════════════════════════════════════════════════
// 🚨 ③ LA PAROLA SOPRAVVIVE ALLA SCRITTURA — il caso che vale più di tutti
// ══════════════════════════════════════════════════════════════════════════════════

test('🚨 ③ la creazione NON scrive più `tipo: \'lezione\'` cablato', () => {
  assert.ok(!/\n        tipo: 'lezione',\n        istruttore: istruttore,/.test(APP),
    'cablato così, uno STAGE perdeva il nome nell\'istante in cui veniva scritto');
  assert.ok(/tipo: tipoParola,/.test(APP), 'la parola scelta deve arrivare al payload');
});

test('🚨 ③ e `tipoParola` nasce dalla scelta, non dal macchinario', () => {
  assert.ok(/const tipoParola = pmoTipoParola\(svcFlowState\.tipo \|\| tipoEngine\);/.test(APP),
    'se nascesse da `tipoEngine` uno stage tornerebbe a chiamarsi «lezione»');
});

test('🚨 ③ un\'etichetta sporca di Matchpoint non cancella la parola', () => {
  // il flusso a passi mette in `tipo` l'ETICHETTA («Lezione Singola»), non una parola pulita
  assert.equal(T.pmoTipoParola('Lezione Singola'), 'lezione');
  assert.equal(T.pmoTipoParola('Lezione di Gruppo'), 'lezione');
  assert.equal(T.pmoTipoParola('Stage'), 'stage');
  assert.equal(T.pmoTipoParola('Torneo'), 'torneo');
});

// ══════════════════════════════════════════════════════════════════════════════════
// ④ LE PAROLE COME ARRIVANO DA MATCHPOINT — sporche, e vanno riconosciute
// ══════════════════════════════════════════════════════════════════════════════════

test('④ «Lezione Libera» resta una lezione (è la forma vera su Matchpoint)', () => {
  assert.equal(T.pmoTipoEngine('Lezione Libera'), 'lezione');
  assert.equal(T.pmoTipoVuoleMaestro('Lezione Libera'), true);
  assert.equal(T.pmoTipoEngine('lezione libera'), 'lezione');
  assert.equal(T.pmoTipoEngine('LEZIONE'), 'lezione');
});

test('④ e le forme sporche dei nomi nuovi', () => {
  assert.equal(T.pmoTipoEngine('Stage Estivo'), 'lezione');
  assert.equal(T.pmoTipoVuoleMaestro('STAGE'), true);
  assert.equal(T.pmoTipoEngine('Torneo Sociale'), 'partita');
  assert.equal(T.pmoTipoEngine('Manutenzione programmata'), 'manutenzione');
});

test('🚨 ④ l\'ORDINE dei controlli: «stage» e «torneo» si guardano PRIMA di «lez»', () => {
  // un nome che contiene tutt'e due le parole non deve cadere nella prima per caso
  assert.equal(T.pmoTipoParola('Stage di lezioni'), 'stage',
    'se «lez» si guardasse prima, questo diventerebbe una lezione e perderebbe il nome');
  assert.equal(T.pmoTipoParola('Manutenzione dopo lo stage'), 'manutenzione',
    'manutenzione si guarda prima di tutto: non ha giocatori');
});

test('④ un tipo vuoto o sconosciuto ripiega su «partita», non su niente', () => {
  for (const brutto of ['', null, undefined, '   ', 'qualunquecosa', 42]) {
    assert.equal(T.pmoTipoEngine(brutto), 'partita', 'caduto su: ' + JSON.stringify(brutto));
    assert.equal(T.pmoTipoVuoleMaestro(brutto), false,
      'un tipo ignoto non deve PRETENDERE un maestro, o bloccherebbe il Salva');
  }
});

// ══════════════════════════════════════════════════════════════════════════════════
// ⑤ I DUE POSTI DOVE SI SCEGLIE, E LA FONTE È UNA SOLA
// ══════════════════════════════════════════════════════════════════════════════════

test('⑤ la scheda di creazione non elenca più i tipi a mano', () => {
  assert.ok(!/\{ key:'Torneo', *engine:null, *tipo:null, disabled:true \}/.test(APP),
    '«Torneo» era scegliibile mai');
  assert.ok(/const TIPI = PMO_TIPI_PRENOTAZIONE\.map\(/.test(APP),
    'due elenchi separati potrebbero dire due cose diverse senza che nessuno se ne accorga');
});

test('⑤ lo Stage c\'è anche nel flusso a passi, e il Torneo non viene più RIFIUTATO', () => {
  assert.ok(/'Stage': *\[/.test(APP), 'lo Stage manca fra le durate del flusso a passi');
  assert.ok(!/Il Torneo non \\xe8 ancora gestito dal sistema di prenotazione/.test(APP),
    'quel rifiuto è diventato falso: un torneo È una prenotazione');
  assert.ok(/svcFlowState\.tipoEngine = pmoTipoEngine\(tipo\);/.test(APP));
});

test('⑤ e i cinque tipi stanno tutti nella fonte unica', () => {
  assert.equal(T.PMO_TIPI_PRENOTAZIONE.length, 5);
  assert.deepEqual(T.PMO_TIPI_PRENOTAZIONE.map((x) => x.tipo),
    ['partita', 'lezione', 'stage', 'torneo', 'manutenzione']);
  // gli `engine` restano TRE: non se ne inventano con i nomi nuovi
  assert.deepEqual([...new Set(T.PMO_TIPI_PRENOTAZIONE.map((x) => x.engine))].sort(),
    ['lezione', 'manutenzione', 'partita']);
});

console.log(`\n— ${passed + failed} casi, ${failed} rossi —`);
if (failed) process.exitCode = 1;
