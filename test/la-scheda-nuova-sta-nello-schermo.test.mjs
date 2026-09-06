// ─────────────────────────────────────────────────────────────────────────────
// VOCE 166 — LA SCHEDA «NUOVA PRENOTAZIONE» STA NELLO SCHERMO, COME LA SCHEDA PARTITA
//
// 🗣️ Sua segnalazione del 06/09/2026, con lo screenshot di PROD 6.367: «è troppo grande e
//    non si vedono tutti gli elementi quando la apri» · «fai come hai fatto quando apro una
//    scheda di una partita già completa di dati».
//
// ⛔ COSA QUESTO BANCO NON DICE, detto in testa: non misura pixel su uno schermo. Legge il
//    SORGENTE e verifica che le tre decisioni della cura ci siano ancora — la taglia compatta su
//    desktop, le due colonne da 900px in su, una ✕ sola in modalità scheda. Se una viene tolta
//    «per pulizia» questo banco si accende; se il risultato è brutto lo dice solo uno schermo
//    (console remota a misura del suo, o il suo).
// ─────────────────────────────────────────────────────────────────────────────

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(QUI, '..', 'index.html'), 'utf8');

/** Il corpo di `svcOpenBookingCard`, tagliato dal sorgente. */
function corpoSchedina() {
  const i = APP.indexOf('function svcOpenBookingCard(');
  assert.ok(i > 0, 'svcOpenBookingCard non trovata');
  const fine = APP.indexOf('\n  // Step 1 — scelta tipo', i);
  assert.ok(fine > i, 'fine di svcOpenBookingCard non trovata');
  return APP.slice(i, fine);
}

/** Il blocco `@media (min-width:900px)` che contiene il pannello-finestra (`.svc-chat-panel {`). */
function bloccoDesktop() {
  const ancora = APP.indexOf('.svc-chat-panel {\n        position:fixed; top:74px;');
  assert.ok(ancora > 0, 'il pannello-finestra del desktop non si trova più dove stava');
  const apre = APP.lastIndexOf('@media (min-width:900px)', ancora);
  assert.ok(apre > 0, 'il pannello-finestra non sta dentro un @media (min-width:900px)');
  // Il blocco si chiude dove comincia il ramo del telefono.
  const chiude = APP.indexOf('@media (max-width:899px)', ancora);
  assert.ok(chiude > apre, 'il ramo del telefono non segue quello del desktop');
  return APP.slice(apre, chiude);
}

test('① su desktop la taglia è quella COMPATTA e basta: niente scala da telefono a 1180px', () => {
  const c = corpoSchedina();
  assert.match(c, /const _desktop = \(window\.innerWidth \|\| 0\) >= 900;/,
    'la soglia è la stessa dei 900px di tutta l\'app: una domanda, una soglia');
  assert.match(c, /const _t\s*=\s*_desktop \? 0 :/,
    '🚨 senza questo, il pannello da 620-1180px cade oltre i 560 della scala e la scheda esce con la taglia da telefono');
});

test('② da 900px in su la scheda è su DUE colonne, con giocatori e note a destra', () => {
  const css = bloccoDesktop();
  assert.match(css, /\.svc-flow-card\s*\{[^}]*display:grid/, 'la scheda è una griglia');
  assert.match(css, /\.svc-flow-card > \*\s*\{[^}]*grid-column:1/, 'per difetto tutto a sinistra: un blocco nuovo non finisce mai fra i giocatori');
  assert.match(css, /\.svc-flow-card > \.svc-flow-dx\s*\{[^}]*grid-column:2;\s*grid-row:2 \/ span 10/, 'la colonna destra parte dalla riga 2 (la 1 è la testata) e copre le righe della sinistra');
  assert.match(css, /\.svc-flow-card > \.svc-flow-head, \.svc-flow-card > \.svc-flow-foot\s*\{[^}]*grid-column:1 \/ -1/, 'testata e piè a tutta larghezza');

  // E il DOM promette le stesse classi che il CSS cerca — altrimenti la griglia è vuota e verde.
  const c = corpoSchedina();
  assert.match(c, /head\.classList\.add\('svc-flow-head'\)/, 'la testata si dichiara');
  assert.match(c, /foot\.classList\.add\('svc-flow-foot'\)/, 'il piè si dichiara');
  assert.match(c, /colDx\.classList\.add\('svc-flow-dx'\)/, 'la colonna destra si dichiara');
  assert.match(c, /colDx\.appendChild\(fGioc\)/, 'i giocatori stanno a destra');
  assert.match(c, /colDx\.appendChild\(fNote\)/, 'le note stanno a destra');
  assert.doesNotMatch(c, /card\.appendChild\(fGioc\)|card\.appendChild\(fNote\)/, 'e non più come figli diretti della scheda');
});

test('③ in modalità scheda la ✕ è UNA: la testata del pannello sparisce solo lì', () => {
  const css = bloccoDesktop();
  assert.match(css, /\.svc-chat-panel\.svc-card-mode \.svc-chat-header\s*\{\s*display:none;/,
    'la scheda ha già la sua ✕ (xBtn → svcCloseChat); due ✕ a 70px di distanza erano nello screenshot');
  assert.doesNotMatch(css, /\.svc-chat-panel \.svc-chat-header\s*\{[^}]*display:none/,
    '⛔ fuori dalla modalità scheda la testata resta: è quella che la 146 protegge');
});
