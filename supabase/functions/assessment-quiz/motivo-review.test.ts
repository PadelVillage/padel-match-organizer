// Prove del motivo del «review» (voce 84 ⓑ, 02/09/2026).
// Esegui:  node supabase/functions/assessment-quiz/motivo-review.test.ts
//
// ⭐ IL CASO 1 È QUELLO CHE VALE: l'INVARIANTE fra questo modulo e l'espressione che decide
// davvero in `index.ts`. Tutti gli altri provano una regola; quello prova che le due non
// possono divergere — ed è l'unico modo in cui una spiegazione può diventare falsa senza che
// nessuno se ne accorga.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { motivoDelReview, MOTIVI_REVIEW } from './motivo-review.ts';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed += 1; console.log(`ok   - ${name}`); }
  catch (e) { failed += 1; console.log(`FAIL - ${name}`); console.log(`       ${(e as Error).message.split('\n')[0]}`); }
}

/** L'espressione VERA di `index.ts`, copiata riga per riga: è il termine di paragone. */
function statoStaffComeInIndex(i: {
  genere: string; conoscenzaStatus: string; pocaEsperienza: boolean; pocaFrequenza: boolean;
  calcoloStaffStatus: string;
}): string {
  return (i.genere === 'NA' || i.conoscenzaStatus !== 'pass' || i.pocaEsperienza || i.pocaFrequenza)
    ? 'review' : i.calcoloStaffStatus;
}

test('1. ⭐⭐ INVARIANTE: c\'è un motivo SE E SOLO SE lo stato è «review»', () => {
  // 🚨 Si prova su TUTTE le combinazioni, non su qualcuna scelta a mano: 3×3×2×2×2×3 = 216.
  // Un caso scelto a mano prova la regola che chi lo scrive aveva già in testa.
  const generi = ['M', 'F', 'NA'];
  const quiz = ['pass', 'fail', ''];
  const staffCalcolo = ['', 'review'];
  const coerenze = ['high', 'medium', 'low'];
  let combinazioni = 0;
  for (const genere of generi) {
    for (const conoscenzaStatus of quiz) {
      for (const pocaEsperienza of [false, true]) {
        for (const pocaFrequenza of [false, true]) {
          for (const calcoloStaffStatus of staffCalcolo) {
            for (const calcoloCoerenza of coerenze) {
              combinazioni += 1;
              const stato = statoStaffComeInIndex({
                genere, conoscenzaStatus, pocaEsperienza, pocaFrequenza, calcoloStaffStatus,
              });
              const motivo = motivoDelReview({
                genere, conoscenzaStatus, pocaEsperienza, pocaFrequenza,
                calcoloStaffStatus, calcoloCoerenza,
              });
              assert.equal(
                motivo !== '',
                stato === 'review',
                `genere=${genere} quiz=${conoscenzaStatus} esp=${pocaEsperienza} freq=${pocaFrequenza} calcolo=${calcoloStaffStatus}: stato «${stato}» ma motivo «${motivo}»`,
              );
            }
          }
        }
      }
    }
  }
  assert.equal(combinazioni, 216, 'lo spazio provato è cambiato: rileggi questo caso');
});

test('2. l\'ordine è quello dei cancelli veri, non un altro', () => {
  // 🚨 Con tutti e quattro accesi vince il PRIMO che `index.ts` valuta. Raccontare il quarto
  // sarebbe dare una spiegazione che non è quella che ha fermato la scheda.
  assert.equal(motivoDelReview({
    genere: 'NA', conoscenzaStatus: 'fail', pocaEsperienza: true, pocaFrequenza: true,
    calcoloStaffStatus: 'review', calcoloCoerenza: 'low',
  }), 'genere_mancante');
  assert.equal(motivoDelReview({
    genere: 'F', conoscenzaStatus: 'fail', pocaEsperienza: true, pocaFrequenza: true,
    calcoloStaffStatus: 'review', calcoloCoerenza: 'low',
  }), 'quiz_non_superato');
  assert.equal(motivoDelReview({
    genere: 'F', conoscenzaStatus: 'pass', pocaEsperienza: true, pocaFrequenza: true,
    calcoloStaffStatus: '', calcoloCoerenza: 'high',
  }), 'poca_esperienza');
  assert.equal(motivoDelReview({
    genere: 'F', conoscenzaStatus: 'pass', pocaEsperienza: false, pocaFrequenza: true,
    calcoloStaffStatus: '', calcoloCoerenza: 'high',
  }), 'poca_frequenza');
});

test('3. il review che viene dal CALCOLO si distingue in due', () => {
  const base = { genere: 'M', conoscenzaStatus: 'pass', pocaEsperienza: false, pocaFrequenza: false };
  assert.equal(motivoDelReview({ ...base, calcoloStaffStatus: 'review', calcoloCoerenza: 'low' }), 'coerenza_bassa');
  // ⚠️ «dati insufficienti» torna `review` con coerenza `medium`: è l'unico modo di dirli diversi.
  assert.equal(motivoDelReview({ ...base, calcoloStaffStatus: 'review', calcoloCoerenza: 'medium' }), 'dati_insufficienti');
  assert.equal(motivoDelReview({ ...base, calcoloStaffStatus: '', calcoloCoerenza: 'low' }), '',
    'coerenza bassa senza review dal calcolo non è un motivo: lo stato non è review');
});

test('4. 📏 i tre casi VERI di PROD, misurati il 02/09', () => {
  // Lidia Comes 27/08: quiz 1/4, coerenza medium, sesso F ⇒ è il quiz a fermarla.
  assert.equal(motivoDelReview({
    genere: 'F', conoscenzaStatus: 'fail', pocaEsperienza: false, pocaFrequenza: false,
    calcoloStaffStatus: '', calcoloCoerenza: 'medium',
  }), 'quiz_non_superato');
  // Maurizio Aprea 29/08: quiz 5/5 superato, coerenza LOW ⇒ non è il quiz, è la coerenza.
  assert.equal(motivoDelReview({
    genere: 'M', conoscenzaStatus: 'pass', pocaEsperienza: false, pocaFrequenza: false,
    calcoloStaffStatus: 'review', calcoloCoerenza: 'low',
  }), 'coerenza_bassa');
  // Fabiola Limuti 19/08: quiz «pass» 0/0 (scheda senza quiz) e sesso vuoto ⇒ il sesso.
  assert.equal(motivoDelReview({
    genere: 'NA', conoscenzaStatus: 'pass', pocaEsperienza: false, pocaFrequenza: false,
    calcoloStaffStatus: '', calcoloCoerenza: 'high',
  }), 'genere_mancante');
});

test('5. ⭐⭐ i due vocabolari coincidono: ogni motivo ha la sua frase nell\'app', () => {
  /* 🚨 È la guardia che tiene insieme le due metà della cura, e senza di lei divergono in
     silenzio: la REGOLA sta qui (Deno), le PAROLE stanno in `index.html` (il browser), e i
     due file nessuno li confronta mai. Un motivo nuovo aggiunto qui e dimenticato là non
     darebbe nessun errore — darebbe alla segreteria un **codice grezzo** a video, o niente.
     📌 *Una cosa in un posto solo; e dove per forza sono due, una guardia che li confronta.* */
  const app = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
  const blocco = app.match(/const ASSESSMENT_REVIEW_REASON_LABELS = \{[\s\S]*?\n    \};/);
  assert.ok(blocco, 'la mappa delle frasi non si trova in index.html: la cura è mezza');
  const nellApp = [...blocco![0].matchAll(/^\s{6}([a-z_]+):\s*'/gm)].map((m) => m[1]);
  assert.deepEqual(
    [...nellApp].sort(),
    [...MOTIVI_REVIEW].sort(),
    'i motivi del gestionale e le frasi dell\'app non coincidono',
  );
});

test('6. l\'elenco dei motivi è quello che la regola sa produrre, senza avanzi', () => {
  // 🚨 `MOTIVI_REVIEW` è un elenco scritto a mano: se restasse indietro rispetto alla
  // funzione, la guardia qui sopra confronterebbe l'app con una lista vecchia — cioè
  // direbbe «tornano» guardando la cosa sbagliata.
  const prodotti = new Set<string>();
  for (const genere of ['M', 'NA']) {
    for (const conoscenzaStatus of ['pass', 'fail']) {
      for (const pocaEsperienza of [false, true]) {
        for (const pocaFrequenza of [false, true]) {
          for (const calcoloStaffStatus of ['', 'review']) {
            for (const calcoloCoerenza of ['high', 'medium', 'low']) {
              const m = motivoDelReview({
                genere, conoscenzaStatus, pocaEsperienza, pocaFrequenza,
                calcoloStaffStatus, calcoloCoerenza,
              });
              if (m) prodotti.add(m);
            }
          }
        }
      }
    }
  }
  assert.deepEqual([...prodotti].sort(), [...MOTIVI_REVIEW].sort(),
    'la funzione produce motivi che l\'elenco non conosce (o viceversa)');
});

console.log(`\n${passed} verdi · ${failed} rossi`);
if (failed > 0) process.exit(1);
