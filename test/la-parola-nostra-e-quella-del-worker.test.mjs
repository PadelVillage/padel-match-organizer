/**
 * ── BANCO: LA PAROLA NOSTRA E QUELLA CHE IL WORKER CONOSCE (voce 207) ────────────────
 *
 * 🚨⭐⭐ PERCHÉ QUESTO BANCO ESISTE, e non è una scelta di stile: questo pezzo l'ha trovato
 *    LA PROVA VERA, non il banco. Con «Stage» e «Torneo» aggiunti nell'app, premere Conferma
 *    su uno Stage tornava:
 *        «tipo deve essere uno di: partita, lezione, manutenzione, stagionale.»
 *    ⇒ un punto che ENUMERA i tipi, fuori da `index.html`, che nessun banco dell'app poteva
 *    vedere. Il banco arriva DOPO la misura, a tenerla ferma.
 *    📌 *Un tipo nuovo si aggiunge dove qualcuno lo LEGGE — e uno dei lettori è il server.*
 *
 * 🎯 LE DUE COSE CHE DIFENDE:
 *   ① `stage` e `torneo` sono parole ACCETTATE dalla edge (prima erano un 400);
 *   ② al WORKER arriva una parola che conosce — `stage` → `lezione`, `torneo` → `partita` —
 *      perché il worker accetta solo quattro parole e NON si tocca: si deploya solo da `main`,
 *      è condiviso con PROD, e PROD è CONGELATA.
 *
 * ⛔ QUELLO CHE NON DICE: che una prenotazione arrivi su Matchpoint. Qui si prova la
 *    TRADUZIONE, non il viaggio.
 *
 * Esegui:  node test/la-parola-nostra-e-quella-del-worker.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(QUI, '..', 'supabase/functions/matchpoint-bookings-create/index.ts'), 'utf8');
assert.ok(SRC.length > 20000, 'sorgente non letto: questo banco non direbbe niente');

let passed = 0, failed = 0;
function test(nome, fn) {
  try { fn(); passed++; console.log('ok   - ' + nome); }
  catch (e) { failed++; console.log('FAIL - ' + nome + '\n       ' + e.message); }
}

/* 🔨 La tabella e le due funzioni si estraggono dalla edge e si ESEGUONO — i tipi TypeScript
 *    si spogliano, perché qui interessa il comportamento. */
function monta() {
  const iTab = SRC.indexOf('const PMO_TIPI_NOSTRI');
  assert.ok(iTab > 0, 'tabella dei tipi non trovata nella edge');
  const tabella = SRC.slice(iTab, SRC.indexOf('};', iTab) + 2)
    .replace(': Record<string, string>', '');
  const corpo = (nome) => {
    const i = SRC.indexOf('function ' + nome + '(');
    assert.ok(i > 0, 'funzione non trovata: ' + nome);
    let g = 0, visto = false, k = SRC.indexOf('{', SRC.indexOf(')', i));
    for (; k < SRC.length; k++) {
      const c = SRC[k];
      if (c === '{') { g++; visto = true; }
      else if (c === '}') { g--; if (visto && g === 0) { k++; break; } }
    }
    // le annotazioni TypeScript si spogliano: qui interessa il COMPORTAMENTO, non i tipi
    return SRC.slice(i, k)
      .replace(/: *Record<[^>]*>/g, '')
      .replace(/: *string *\| *undefined/g, '')
      .replace(/\): *string/g, ')');
  };
  const fabbrica = new Function(`
    function clean(v) { return typeof v === 'string' ? v.trim() : (v == null ? '' : String(v)); }
    ${tabella}
    ${corpo('tipoPerIlWorker')}
    ${corpo('etichettaTipo')}
    return { PMO_TIPI_NOSTRI, tipoPerIlWorker, etichettaTipo };
  `);
  return fabbrica();
}
const E = monta();

// ══════════════════════════════════════════════════════════════════════════════════
// ① LE PAROLE NUOVE SONO ACCETTATE
// ══════════════════════════════════════════════════════════════════════════════════

test('① `stage` e `torneo` stanno fra i tipi validi (prima erano un 400)', () => {
  const validi = Object.keys(E.PMO_TIPI_NOSTRI);
  assert.ok(validi.includes('stage'), 'senza questo, premere Conferma su uno Stage è un 400');
  assert.ok(validi.includes('torneo'));
});

test('① e i quattro di prima NON si sono persi per strada', () => {
  for (const t of ['partita', 'lezione', 'manutenzione', 'stagionale']) {
    assert.ok(Object.keys(E.PMO_TIPI_NOSTRI).includes(t), 'sparito: ' + t);
  }
});

test('① la lista della edge NON è più scritta a mano', () => {
  assert.ok(/const VALID_TIPOS = Object\.keys\(PMO_TIPI_NOSTRI\);/.test(SRC),
    'due elenchi separati finirebbero per dire due cose diverse');
});

// ══════════════════════════════════════════════════════════════════════════════════
// 🚨 ② AL WORKER ARRIVA UNA PAROLA CHE CONOSCE
// ══════════════════════════════════════════════════════════════════════════════════

test('🚨 ② `stage` → `lezione` e `torneo` → `partita` (il worker conosce solo 4 parole)', () => {
  assert.equal(E.tipoPerIlWorker('stage'), 'lezione');
  assert.equal(E.tipoPerIlWorker('torneo'), 'partita');
});

test('🚨 ② il worker NON riceve mai una parola fuori dalle sue quattro', () => {
  const SUE = ['partita', 'lezione', 'manutenzione', 'stagionale'];
  for (const t of Object.keys(E.PMO_TIPI_NOSTRI)) {
    assert.ok(SUE.includes(E.tipoPerIlWorker(t)),
      `«${t}» diventerebbe «${E.tipoPerIlWorker(t)}», che il worker rifiuta con INVALID_TIPO`);
  }
});

test('🚨 ② e la traduzione è applicata DAVVERO alla chiamata, non solo definita', () => {
  assert.ok(/booking: \{ \.\.\.booking, tipo: tipoPerIlWorker\(booking\.tipo\) \}/.test(SRC),
    'una traduzione definita e non usata è peggio di nessuna: sembra fatta');
});

test('② i quattro di sempre passano INVARIATI (nessuna traduzione dove non serve)', () => {
  for (const t of ['partita', 'lezione', 'manutenzione', 'stagionale']) {
    assert.equal(E.tipoPerIlWorker(t), t);
  }
});

test('② un tipo ignoto diventa `partita`, non una parola che il worker rifiuta', () => {
  for (const brutto of ['', null, undefined, 'qualunquecosa', 'STAGE ']) {
    const fuori = E.tipoPerIlWorker(brutto);
    assert.ok(['partita', 'lezione', 'manutenzione', 'stagionale'].includes(fuori),
      'caduto su: ' + JSON.stringify(brutto) + ' → ' + fuori);
  }
});

// ══════════════════════════════════════════════════════════════════════════════════
// ③ MA LA PAROLA NOSTRA RESTA NOSTRA
// ══════════════════════════════════════════════════════════════════════════════════

test('🚨 ③ ciò che SALVIAMO tiene la parola scelta, non quella tradotta', () => {
  // `saveStaffBookingRecord` scrive `booking.tipo`: la traduzione vive SOLO nella chiamata al worker
  assert.ok(/tipo: booking\.tipo \?\? 'partita',/.test(SRC),
    'se qui arrivasse la parola tradotta, uno stage si salverebbe come «lezione»');
});

test('③ e l\'etichetta mostrata dice «Stage», non «Partita»', () => {
  assert.equal(E.etichettaTipo('stage'), 'Stage');
  assert.equal(E.etichettaTipo('torneo'), 'Torneo');
  assert.equal(E.etichettaTipo('lezione'), 'Lezione');
  assert.equal(E.etichettaTipo('manutenzione'), 'Manutenzione');
});

test('③ e le tre etichette cablate nella edge sono sparite', () => {
  assert.ok(!/=== 'lezione' \? 'Lezione' : .*=== 'manutenzione' \? 'Manutenzione' : 'Partita'/.test(SRC),
    'quelle righe chiamavano «Partita» sia uno stage che un torneo');
});

console.log(`\n— ${passed + failed} casi, ${failed} rossi —`);
if (failed) process.exitCode = 1;
