// ── BANCO: «chi apre un browser passa dalla coda, e in che ordine» — 22/08/2026 ─────────
//
// La coda del worker esiste per un'invariante che il worker DICHIARA nel proprio commento:
// «Il worker usa UN solo account Matchpoint e regge una sola sessione browser per volta. Ogni
// operazione che lancia Chromium DEVE essere serializzata: mai due sessioni Matchpoint in
// parallelo». Il 22/08 quattro endpoint la aggiravano, e uno di loro — la chiamata del sync
// delle prenotazioni — ogni due minuti.
//
// ⚠️ Le prove qui sono di DUE nature, come in `tipo-ficha.test.mjs`, e la differenza va tenuta
// a mente leggendo un verde:
//   ① sulla REGOLA PURA (`coda-priorita.mjs`) — la si esegue davvero;
//   ② sul SORGENTE di `server.mjs` — prove di CUCITURA: dicono che il pezzo è cablato dove
//      deve, non che funziona. Servono perché il difetto curato oggi ERA un cablaggio: la
//      regola c'era, scritta in un commento, e quattro handler non la chiamavano.
//
// ⛔ Quello che questo banco NON può provare, e va detto: che serializzare RISOLVA davvero la
//    saturazione. Quello si vede solo sul worker vivo, che è UNO e condiviso TEST+PROD. Qui si
//    prova la decisione e il cablaggio — cioè tutto ciò che è nostro.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  mpJobPriority, PRIORITA, MP_INTERACTIVE_OPS, MP_SYNC_OPS,
  HANDLER_CHE_APRONO_UN_BROWSER,
} from '../src/coda-priorita.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const SORGENTE = fs.readFileSync(path.join(QUI, '..', 'src', 'server.mjs'), 'utf8');

/** Il corpo di una funzione di primo livello, dalla firma alla graffa che la chiude. */
function corpoDi(nome) {
  const inizio = SORGENTE.indexOf(`async function ${nome}(`);
  assert.notEqual(inizio, -1, `la funzione «${nome}» non esiste più in server.mjs`);
  const fine = SORGENTE.indexOf('\n}', inizio);
  assert.notEqual(fine, -1, `non trovo la fine di «${nome}»`);
  return SORGENTE.slice(inizio, fine);
}

// ── ① la regola pura ────────────────────────────────────────────────────────────────────

test('🚨 IL DIFETTO DEL 22/08: le quattro op di sincronizzazione hanno una priorità propria', () => {
  // Prima di oggi non esistevano affatto in questa tabella: cadevano tutte nel fondo insieme
  // al poller — e infatti non passavano nemmeno dalla coda.
  for (const op of ['export-history', 'export-clients', 'export-slot-schedule', 'get-slots']) {
    assert.equal(mpJobPriority({ op }), PRIORITA.SINCRONIZZAZIONE, `${op}: non è al livello di mezzo`);
  }
});

test('⭐ l\'ordine dei tre livelli è quello e non un altro: persone > sincronizzazioni > fondo', () => {
  // ⚖️ È la riga che protegge la DECISIONE, non un calcolo: se un domani qualcuno appiattisse
  // due livelli «per semplificare», il sync tornerebbe ad aspettare dietro il poller (che fa
  // tre giri per volta) e si sarebbe tolta la collisione pagandola con la freschezza.
  assert.ok(PRIORITA.INTERATTIVA > PRIORITA.SINCRONIZZAZIONE);
  assert.ok(PRIORITA.SINCRONIZZAZIONE > PRIORITA.FONDO);
  assert.equal(mpJobPriority({ op: 'create' }), PRIORITA.INTERATTIVA);
  assert.equal(mpJobPriority({ op: 'poll' }), PRIORITA.FONDO);
  assert.equal(mpJobPriority({ op: 'read-tabellone' }), PRIORITA.FONDO);
  assert.equal(mpJobPriority({ op: 'keepalive' }), PRIORITA.FONDO);
});

test('⭐ CONTROLLO NEGATIVO: le interattive non sono state degradate dall\'aggiunta di mezzo', () => {
  // Il modo sbagliato di aggiungere un livello è schiacciare quello di sopra: ogni op con una
  // persona che aspetta deve restare sopra OGNI sincronizzazione.
  //
  // 🩹⭐⭐ 03/09/2026 — QUI C'ERA `assert.equal(MP_INTERACTIVE_OPS.size, 6)`, e si è rotto
  // aggiungendo i quattro gesti sui soldi — che erano rimasti fuori dall'elenco e cadevano a
  // priorità FONDO, insieme al poller. La guardia aveva torto e il codice ragione.
  // ⇒ Il numero è stato **sostituito dai nomi**, non aggiornato: un conteggio a mano si rompe a
  // ogni aggiunta legittima e non si accorge di una SOSTITUZIONE (togline una, mettine un'altra:
  // il 6 torna e nessuno se ne accorge). I nomi invece si rompono solo quando qualcuno **toglie**
  // un gesto di una persona da sopra il sync, che è il difetto vero da fermare.
  // 📌 *Una guardia deve rompersi su ciò che è sbagliato, non su ciò che è cambiato.*
  const CON_UNA_PERSONA_CHE_ASPETTA = [
    'create', 'edit', 'cancel', 'client', 'disable-client', 'reactivate-client',
    'collect-payment', 'set-charge', 'void-payment', 'correct-wallet',
  ];
  for (const op of CON_UNA_PERSONA_CHE_ASPETTA) {
    assert.ok(MP_INTERACTIVE_OPS.has(op), `${op} è uscito dall'elenco delle interattive: chi lo ha chiesto aspetta dietro al sync`);
  }
  for (const op of MP_INTERACTIVE_OPS) {
    assert.ok(mpJobPriority({ op }) > mpJobPriority({ op: 'export-history' }), `${op} non passa più davanti al sync`);
  }
  // 🚨 E il caso che il conteggio NON copriva: un'op del fondo non deve poter entrare qui
  // di straforo — se ci entrasse, il poller passerebbe davanti alle persone.
  for (const op of ['poll', 'keepalive', 'read-tabellone', 'export-history']) {
    assert.ok(!MP_INTERACTIVE_OPS.has(op), `${op} non ha nessuno che aspetta: sopra le persone non ci va`);
  }
});

test('la priorità esplicita del chiamante vince ancora su tutta la tabella', () => {
  // È la via con cui un chiamante dice «questo lo so io meglio della tabella». Toglierla
  // romperebbe in silenzio chi la usa già.
  assert.equal(mpJobPriority({ op: 'poll', priority: 9 }), 9);
  assert.equal(mpJobPriority({ op: 'create', priority: 0 }), 0);
});

test('robustezza: meta nullo, storto o con un\'op mai vista non fa esplodere la scelta', () => {
  assert.equal(mpJobPriority(null), PRIORITA.FONDO);
  assert.equal(mpJobPriority(undefined), PRIORITA.FONDO);
  assert.equal(mpJobPriority({}), PRIORITA.FONDO);
  assert.equal(mpJobPriority({ op: 'op-che-inventeremo-domani' }), PRIORITA.FONDO);
  // ⚖️ Il fondo è il default GIUSTO per l'ignoto: un'op nuova che scavalcasse le persone
  // sarebbe un difetto silenzioso, una che aspetta un po' no.
  assert.equal(mpJobPriority({ op: 'poll', priority: 'due' }), PRIORITA.FONDO);
});

// ── ② la cucitura in server.mjs ──────────────────────────────────────────────────────────

test('🚨⭐⭐ CUCITURA: OGNI handler che apre un browser passa da mpQueueRun', () => {
  // È il difetto vero del 22/08, ed è la ragione per cui questo caso enumera invece di
  // controllare i quattro colpevoli: un elenco di colpevoli noti non vede il quinto.
  let misurati = 0;
  for (const nome of HANDLER_CHE_APRONO_UN_BROWSER) {
    const corpo = corpoDi(nome);
    misurati++;
    assert.ok(
      corpo.includes('mpQueueRun('),
      `${nome} apre un browser SENZA passare dalla coda: due sessioni Matchpoint in parallelo`,
    );
  }
  // 🚨 Un verdetto vale solo se ha misurato qualcosa: 0 difetti su 0 handler non è un verde.
  assert.equal(misurati, HANDLER_CHE_APRONO_UN_BROWSER.length);
  assert.ok(misurati >= 20, `l'elenco si è svuotato: ${misurati} handler`);
});

test('🚨⭐ CONTROLLO NEGATIVO: /poller/force-run NON deve stare in coda, o è uno STALLO', () => {
  // ⚖️ Il rovescio del caso di sopra, e non è pignoleria: `handlePollerForceRun` risponde 202
  // subito e lancia `runPollCycle()`, che i suoi job li mette in coda LUI. Metterlo in coda
  // sarebbe un job che aspetta altri job a concorrenza 1 ⇒ il worker si ferma del tutto.
  // 📌 Stava nel mio elenco dei colpevoli fino a un controllo: un elenco fatto cercando
  //    l'ASSENZA di una chiamata trova anche chi quella chiamata non deve farla.
  const corpo = corpoDi('handlePollerForceRun');
  assert.ok(!corpo.includes('mpQueueRun('), 'force-run è finito in coda: aspetterebbe i job che lancia lui');
  assert.ok(corpo.includes('runPollCycle('), 'non delega più al ciclo del poller: il caso non misura più niente');
  assert.ok(!HANDLER_CHE_APRONO_UN_BROWSER.includes('handlePollerForceRun'),
    'force-run è rientrato nell\'elenco di sopra: il caso qui sopra lo pretenderebbe in coda');
});

test('🚨 CUCITURA: /get-slots non tocca più la pagina condivisa fuori dalla coda', () => {
  // ⭐ Il peggiore dei quattro, e si vede solo guardando COSA usa: gli altri tre aprono un
  // browser loro, `getSlotsWithBrowser` chiama `mpAcquirePage`, cioè si fa dare la pagina
  // «warm» CONDIVISA — che non ha nessun lucchetto. Fuori dalla coda poteva guidare la stessa
  // pagina di un altro job, e chiuderne il browser con `mpWarmInvalidate()`.
  assert.ok(corpoDi('handleGetSlots').includes('mpQueueRun('));
  const fn = SORGENTE.slice(SORGENTE.indexOf('async function getSlotsWithBrowser('));
  assert.ok(fn.slice(0, 3000).includes('mpAcquirePage('),
    'getSlotsWithBrowser non usa più la pagina condivisa: se è vero, il commento del modulo va corretto');
});

test('la regola vive in UN posto solo: server.mjs non ha più una copia sua', () => {
  // Due copie della stessa tabella divergono al primo ripensamento — ed è già successo in
  // questo progetto abbastanza volte da farne una regola.
  assert.ok(!/^const MP_INTERACTIVE_OPS = new Set/m.test(SORGENTE),
    'l\'elenco delle interattive è tornato dentro server.mjs, accanto a quello del modulo');
  assert.ok(!/^function mpJobPriority\(/m.test(SORGENTE),
    'mpJobPriority è tornata dentro server.mjs: il banco proverebbe la copia sbagliata');
  assert.ok(SORGENTE.includes("from './coda-priorita.mjs'"), 'server.mjs non importa più la regola');
});
