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

test('7. 🚨⭐⭐ il motivo si vede in un pannello RAGGIUNGIBILE, non solo in uno che esiste', () => {
  /* 📏 Difetto della cura, trovato il 02/09 perché il committente è andato a guardare e ha
     detto «negativo». La prima versione mostrava il motivo **solo** nel pannello della sezione
     Autovalutazione — che è CONGELATA dal 13/06/2026 (`PMO_ASSESSMENT_PARKED = true`) e
     `pmoSectionVisibleFor` la nega **a tutti, owner compreso**.
     ⇒ La colonna era giusta, la RPC la portava, l'app la traduceva — e la schermata non si
     poteva aprire. *Un dato arrivato non è un dato visto: fra i due c'è una porta, ed è quella
     che non si guarda.*
     ⇒ Adesso sta anche nella scheda socio (Anagrafica soci → Scheda → Autovalutazione), che è
     la strada che la segreteria percorre davvero.
     ⚠️ GUARDIA TESTUALE, e si dice: legge il sorgente, non apre nessuna pagina. Dice che la
     riga è nel pannello giusto, non che si veda. */
  const app = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
  const pannello = app.match(/id="memberAssessmentValidationPanel"[\s\S]*?<\/section>`/);
  assert.ok(pannello, 'il pannello della scheda socio non si trova: questa prova non guarda più niente');
  assert.match(pannello![0], /assessmentReviewReasonLabel\(/,
    'il motivo non compare nella scheda socio: resterebbe solo nella sezione congelata, cioè invisibile');
  // 🔒 E la sezione È ancora congelata: il giorno che la riaprissero questa riga cade e si
  // rilegge il caso, invece di lasciare una spiegazione appesa a un fatto cambiato.
  assert.match(app, /const PMO_ASSESSMENT_PARKED = true;/,
    'la sezione Autovalutazione non è più congelata: rileggi il perché di questa prova');
});

test('8. 🚨⭐⭐ la scheda si cerca sul SOCIO, non sul gettone corrente (che è sempre vuoto)', () => {
  /* 📏 Misurato sui gettoni veri di PROD, al millesimo: scheda consegnata alle 08:18:22.105,
     gettone successivo (vuoto) coniato alle 08:18:22.754 — 649 ms dopo. L'app ordina per
     `completed_at || sent_at || created_at` e prende il primo ⇒ vince SEMPRE quello nuovo,
     che una scheda non ce l'ha. ⇒ Il pannello «da validare» non si disegnava MAI per una
     scheda arrivata dal bot, cioè per tutte.
     🔒 Questa guardia pretende il ripiego e il confronto giusto sull'«applicata».
     ⚠️ Testuale, e si dice: legge il sorgente, non apre una pagina. */
  const app = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
  const blocco = app.match(/function assessmentRecordFor\(member\)[\s\S]*?\n    \}/);
  assert.ok(blocco, 'assessmentRecordFor non si trova: questa prova non guarda più niente');
  assert.match(blocco![0], /assessmentMemberResponses\(member\)\[0\]/,
    'tolto il ripiego sulla scheda più recente del socio: torna il pannello che non si disegna mai');
  assert.match(blocco![0], /normalizeText\(response\?\.token \|\| ''\)/,
    "l'«applicata» si giudica di nuovo su `rec` invece che sulla scheda mostrata: due gettoni diversi");
});

test('9. 🚨⭐⭐ il motivo SOPRAVVIVE al travaso: l\'app tiene il campo, non solo la RPC', () => {
  /* 📏 Misurato il 02/09 sull'app VIVA di PROD (6.263) con la console remota, aprendo la
     scheda di un socio vero: la RPC `get_self_assessments_by_tokens` torna **16** colonne e
     porta `review_reason: 'quiz_non_superato'`, ma l'oggetto riposto in `assessmentResponses`
     ne aveva **15** — `importAssessmentResponses` costruisce `normalized` con un elenco di
     campi FISSO, e quello non c'era.
     ⇒ Il riquadro «da validare» compariva (la cura del gettone vuoto morde) e la riga «Perché
     è da controllare» no: il sintomo somigliava a una cura riuscita.
     ⚖️ È lo stesso difetto della migrazione `20260902123000`, che aveva allargato l'imbuto
     della RPC. *Fra il dato e chi lo legge i trasporti sono in fila: allargarne uno non dice
     niente degli altri.*
     ⚠️ GUARDIA TESTUALE, e si dice: legge il sorgente, non apre nessuna pagina. */
  const app = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
  const blocco = app.match(/function importAssessmentResponses\(rows[\s\S]*?\n        \};/);
  assert.ok(blocco, 'importAssessmentResponses non si trova: questa prova non guarda più niente');
  // ⚠️ Il confronto è sull'ASSEGNAZIONE, non sulla parola: cercare `/review_reason:/` faceva
  // passare la guardia leggendo il COMMENTO scritto due righe sopra il campo — sabotata il
  // 02/09 e trovata finta al primo colpo. 📌 *Una guardia che legge la spiegazione invece del
  // codice certifica che qualcuno ha scritto la cura, non che la cura c'è.*
  assert.match(blocco![0], /\n\s*review_reason: cleanCell\(firstAvailable\(/,
    "l'app torna a buttare `review_reason` nel travaso: la riga «Perché è da controllare» sparisce di nuovo");
  // 🔒 E il campo dev'essere quello che il pannello legge davvero, cioè `response.review_reason`.
  assert.match(app, /const codice = cleanCell\(\(response && response\.review_reason\) \|\| ''\)/,
    'la funzione che traduce non legge più `response.review_reason`: il travaso curato non basterebbe');
});

console.log(`\n${passed} verdi · ${failed} rossi`);
if (failed > 0) process.exit(1);
