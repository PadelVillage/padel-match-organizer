/* 🧹 «La sezione Circoli è andata» — banco della voce 199 (11/09/2026).
 *
 * 🗣️ SUA PAROLA: *«c'è da ripulire la sezione dati e da eliminare la sezione circoli»*.
 *
 * 🚨⭐⭐ COSA DIFENDE PIÙ DI TUTTO — non che «Circoli» sia sparita, ma le DUE cose che togliendola
 *    si rompono in silenzio:
 *    ① chi aveva «circoli» come ultima sezione aperta **salvata nel browser** deve atterrare da
 *       qualche parte: senza un ripiego vede Impostazioni **vuote** e non capisce perché. È la
 *       stessa trappola del 02/09 (`_pmoStornoInCorso` → ReferenceError a ogni chiusura), e qui
 *       il compilatore che avvisa non c'è;
 *    ② i **circoli ESTERNI** (`pmoCircoloEsterno*`, ~55 usi) sono TUTT'ALTRA COSA e sono vivi:
 *       chi cancellasse per la parola «circol» porterebbe via i tooltip degli incassi e la
 *       domanda del Salva. 📌 *Due cose che si chiamano quasi uguale sono la trappola più facile
 *       di una cancellazione.*
 *
 * ⛔ NON DICE che la pagina si apra: gira senza browser. Lo dice la prova sul vivo.
 *
 * Esegui:  node test/la-sezione-circoli-e-andata.test.mjs
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

test('① la SEZIONE non esiste più — in nessuno dei suoi pezzi', () => {
  /* Undici punti la nominavano, e bastava dimenticarne uno per lasciare un bottone che apre
     il vuoto o una funzione che non c'è. */
  for (const morto of [
    'pmoAdminCircoliSection', 'pmoAdminCircoliPanel', 'pmoCircoliCarica', 'pmoRenderCircoliPanel',
    'pmoCircoliState', 'pmoCircoliProva', 'pmoCircoliTabella', 'view_admin_circoli',
    'pmoCircoliStatus', 'pmoCircoliElenco',
  ]) {
    assert.ok(!APP.includes(morto), 'è rimasto un riferimento a «' + morto + '»: la sezione è tolta a metà');
  }
});

test('② 🚨 il RIPIEGO c\'è: chi ha «circoli» salvato NON atterra nel vuoto', () => {
  /* Senza questa riga, `pmoAdminSectionKey('circoli')` cadrebbe nel `return 'users'` finale —
     che per caso fa la cosa giusta. Ma il caso non è una difesa: il banco pretende la riga
     ESPLICITA, così chi rilegge sa che quel nome è stato pensato e non dimenticato. */
  const m = APP.match(/if \(key\.includes\('circol'\)\) return '([a-z-]+)';/);
  assert.ok(m, 'il ripiego per «circoli» non c\'è: chi ce l\'ha salvato apre Impostazioni vuote');
  assert.notEqual(m[1], 'circoli', 'il ripiego rimanda a una sezione che non esiste più');
});

test('③ 🚨🚨 i circoli ESTERNI sono intatti — sono un\'altra cosa', () => {
  /* 📏 Misurati prima di toccare: ~55 usi, e sono il circolo COLLEGATO (Matchpoint), non la
     sezione tolta. Vivono nei tooltip degli incassi e nella domanda del Salva. */
  for (const vivo of ['pmoCircoloEsternoCollegato', 'pmoNomeCircoloEsterno', 'pmoSuCircoloEsterno']) {
    assert.ok(APP.includes(vivo), 'è sparito «' + vivo + '»: la cancellazione ha preso i circoli ESTERNI');
  }
  const quanti = (APP.match(/pmo(Nome|Su|)CircoloEsterno/g) || []).length;
  assert.ok(quanti > 30, 'i riferimenti ai circoli esterni sono crollati a ' + quanti + ': ne è stato portato via un pezzo');
});

test('④ la sezione «Dati» si raggiunge ancora — la chiave regge', () => {
  /* Rinominata da «Dati Matchpoint» a «Dati»: funziona solo perché chi risolve guarda
     `key.includes('dati')`. Se quella riga cambiasse, il bottone aprirebbe Utenti. */
  assert.ok(/onclick="goToTabSection\('administration','Dati'\)"/.test(APP),
    'il bottone «Dati» non punta più alla sezione');
  assert.ok(/key\.includes\('dati'\)\) return 'matchpoint-data'/.test(APP),
    'la risoluzione non riconosce più «Dati»: il bottone aprirebbe un\'altra sezione');
  assert.ok(/key\.includes\('matchpoint'\)/.test(APP),
    'tolto il ripiego «matchpoint»: chi ha la vecchia chiave salvata nel browser si perde');
});

test('⑤ e il sottotitolo non promette più una sezione che non c\'è', () => {
  const m = APP.match(/<h2>Impostazioni<\/h2>\s*<p[^>]*>([^<]*)</);
  assert.ok(m, 'il sottotitolo di Impostazioni è sparito');
  assert.ok(!/circoli della zona/i.test(m[1]),
    'il sottotitolo promette ancora «circoli della zona», e quella sezione non esiste più');
});

test('⑥ 🚨 l\'elenco dei MAESTRI è rimasto: è NOSTRO, non di Matchpoint', () => {
  /* Vive dentro la stessa sezione «Dati» che si stava ripulendo, e il pannello lo dichiara:
     «Elenco NOSTRO: prima stava in un file su GitHub» (voce 202). ⇒ Non si porta via col resto. */
  for (const vivo of ['matchpointMaestriAccordion', 'pmoCaricaMaestri', 'pmoSalvaMaestri', 'pmoAggiungiMaestro']) {
    assert.ok(APP.includes(vivo), 'è sparito «' + vivo + '»: la pulizia si è portata via i maestri');
  }
});

test('⑦ i passi che nominano Matchpoint per DIRE IL VERO sono rimasti', () => {
  /* ⚖️ «Clienti Matchpoint», «Storico Matchpoint» importano DAVVERO da Matchpoint: finché la
     fonte è quella, il nome è corretto e toglierlo sarebbe mentire. La voce 190 riguarda le
     scritte che mentono, non quelle che descrivono. */
  assert.ok(/Clienti Matchpoint/.test(APP) && /Storico Matchpoint/.test(APP),
    'tolto il nome della FONTE da passi che leggono davvero da Matchpoint: adesso non dicono da dove prendono i dati');
});

test('④bis 🚨🚨 il bottone «Dati» APRE la sezione — la SECONDA strada, quella che comanda', () => {
  /* 🚨 TROVATO DALLA PROVA FISICA, e il banco non lo vedeva: c'è una mappa in
     `runSidebarSectionAction` che decide PRIMA di `pmoAdminSectionKey`, e cercava
     `includes('dati matchpoint')`. Rinominata la voce in «Dati», il bottone lasciava aperta
     «Utenti» — in silenzio, senza nessun errore.
     📌 *Due strade che rispondono alla stessa domanda vanno provate tutte e due: quella che non
     si prova è quella che comanda.* */
  const i = APP.indexOf("if (tabName === 'administration') {");
  assert.ok(i > 0, 'il ramo administration della mappa è sparito');
  const zona = APP.slice(i, i + 2600);
  const riga = zona.split('\n').find((r) => r.includes("pmoSetAdminSection('matchpoint-data'"));
  assert.ok(riga, 'nessuna riga porta più alla sezione Dati');
  assert.ok(/key === 'dati'/.test(riga),
    'la voce «Dati» non combacia più: il bottone del menu lascerebbe aperta la sezione precedente, senza errori');
  assert.ok(/dati matchpoint/.test(riga),
    'tolta la chiave vecchia: chi arriva da un link o da uno stato salvato con «Dati Matchpoint» non atterra più');
});

console.log('\n— ' + passed + ' verdi, ' + failed + ' rossi —');
process.exit(failed ? 1 : 0);
