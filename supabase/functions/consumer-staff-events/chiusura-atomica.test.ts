// 🚨🔒⭐⭐ LA CHIUSURA DELLA CODA SI PRENDE I FATTI, NON LI DÀ PER PRESI (24/08/2026 sera).
// Esegui:  node supabase/functions/consumer-staff-events/chiusura-atomica.test.ts
//
// 🗣️ Nasce da una sua segnalazione: *«oggi mi sono arrivati 2 messaggi di seguito uguali»* —
// due volte «🎾 Sei in campo · Domani alle 14:00, campo 2», tutt'e due alle 13:15.
//
// 📏 MISURATO nel registro del bot, al secondo — non dedotto:
//     13:13:54  🤖 bot avviato                          ← un riavvio
//     13:15:56  🔔 detto a Maurizio Aprea: aggiunto — 2026-08-25|14:00|2
//     13:15:56  🔔 fatti del circolo ACCESI: 2 ritirati ora, 1 detti   ← il giro dell'ACCENSIONE
//     13:15:57  🔔 detto a Maurizio Aprea: aggiunto — 2026-08-25|14:00|2   ← di nuovo
//     13:15:57  🔔 circolo: 2 ritirati, 1 detti, 1 scartati              ← un giro NORMALE
//   ⇒ Due giri a un secondo di distanza, e tutt'e due hanno ritirato **gli stessi 2 fatti**.
//   (Il secondo fatto era per una persona che nel bot non c'è: da qui «1 detti, 1 scartati».)
//
// 🎯 La causa stava nell'edge: la coda si LEGGE al passo 1 (`consegnato_at is null`) e si
// CHIUDE al passo 5, con tutta la funzione in mezzo. Due chiamate ravvicinate leggono le stesse
// righe prima che una delle due le abbia chiuse.
// 📌 *Una coda si consuma prendendo, non guardando e poi prendendo: fra il guardare e il
// prendere ci sta un altro.*
//
// ⚠️ QUESTE SONO GUARDIE TESTUALI, e si dicono per quello che sono: la chiusura parla col
// database, e da qui non si può ESEGUIRE. Provano che la presa è scritta come si deve e che la
// risposta si filtra — NON provano che due giri simultanei si escludano davvero. Quella è una
// prova fisica, e si vede da una riga sola: `gia_presi_da_un_altro_giro` maggiore di zero.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const QUI = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(QUI, 'index.ts'), 'utf8');

// 🚨 Si guarda il codice SENZA commenti: qui sopra i commenti PARLANO di `consegnato_at` e di
// `is('consegnato_at', null)` a lungo, e una guardia che cerca una parola la troverebbe nel
// racconto invece che nel codice. È la cicatrice del 19/08 (`Date.now()` contato tre volte,
// due nei commenti che spiegavano perché dev'essere uno solo).
// ⚠️ E le STRINGHE si tengono, al contrario del gemello in `consumer-assessment-link`: là si
// contavano occorrenze di `Date.now()` e le stringhe erano rumore; qui il codice da provare È
// fatto di stringhe (`'consegnato_at'`, `'id'`). Toglierle renderebbe queste guardie cieche —
// scoperto facendole fallire su codice giusto, che è il modo in cui una sonda si tara.
function senzaCommentiMaConLeStringhe(fonte) {
  let out = '', stringa = null, prec = '';
  for (let i = 0; i < fonte.length; i++) {
    const c = fonte[i], succ = fonte[i + 1];
    if (stringa) {
      out += c;
      if (c === stringa && prec !== '\\') stringa = null;
      prec = prec === '\\' ? '' : c;
      continue;
    }
    if (c === '/' && succ === '/') { const f = fonte.indexOf('\n', i); i = f < 0 ? fonte.length : f; out += '\n'; prec = '\n'; continue; }
    if (c === '/' && succ === '*') { const f = fonte.indexOf('*/', i + 2); i = f < 0 ? fonte.length : f + 1; out += ' '; prec = ' '; continue; }
    if (c === '"' || c === "'" || c === '`') { stringa = c; out += c; prec = c; continue; }
    out += c; prec = c;
  }
  return out;
}
const codice = senzaCommentiMaConLeStringhe(src);

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok   - ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`FAIL - ${name}\n       ${e.message}`);
  }
}

test('🔒 la chiusura PRETENDE che i fatti siano ancora liberi', () => {
  // Senza questo, due giri chiudono le stesse righe e tutt'e due le consegnano.
  assert.match(
    codice,
    /update\(\{ consegnato_at: new Date\(\)\.toISOString\(\) \}\)[\s\S]{0,200}?\.is\('consegnato_at', null\)/,
    'manca `.is(consegnato_at, null)` sulla chiusura del passo 5',
  );
});

test('🔒 …e si fa dire QUALI ha preso davvero', () => {
  // Un update che non torna niente non permette di sapere chi ha vinto la corsa: la presa
  // sarebbe atomica e inutile, perché si consegnerebbe lo stesso tutto.
  assert.match(
    codice,
    /\.is\('consegnato_at', null\)\s*\n?\s*\.select\('id'\)/,
    'la chiusura non chiede indietro gli id presi',
  );
});

test('🚨 la risposta si FILTRA su quelli presi: chi arriva secondo non consegna', () => {
  assert.match(codice, /eventi\.splice\(i, 1\)/, 'la risposta non si sfoltisce');
  assert.match(codice, /presi\.has\(/, 'il filtro non guarda quali sono stati presi');
});

test('🚨 un evento fuso si consegna solo se si sono prese TUTTE le sue righe', () => {
  // ⚖️ `every` e non `some`: se un altro giro ne ha già una, sta parlando lui. Si sbaglia dalla
  // parte del silenzio — *un avviso in meno è un fastidio; un avviso doppio è il difetto*.
  assert.match(codice, /miei\.every\(\(id\) => presi\.has\(/, 'basta una riga presa per consegnare: non basta');
  assert.ok(!/miei\.some\(\(id\) => presi\.has\(/.test(codice), 'usa `some`: consegnerebbe eventi mezzi rubati');
});

test('👀 la corsa si VEDE: chi resta a mani vuote lo scrive', () => {
  // 🚨 Zero righe qui non vuol dire «non succede»: vuol dire «non è successo da quando
  // guardiamo». Ma senza questa riga non lo si potrebbe sapere in nessun modo.
  assert.match(codice, /gia_presi_da_un_altro_giro: soffiati/, 'il conto non esce nella risposta');
  assert.match(codice, /console\.warn\([\s\S]{0,120}gi[àa] presi da un altro giro/, 'e non finisce nel registro');
});

test('⚖️ in `dryRun` non si prende niente: guardare non deve consumare', () => {
  assert.match(codice, /if \(!dryRun && daChiudere\.length\)/, 'la presa non è più protetta dal dryRun');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
