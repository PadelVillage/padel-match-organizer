// ── BANCO: «la risposta giusta non arriva più al telefono» ───────────────────────
//
// Che cosa prova: il cancello di conoscenza dell'edge `assessment-quiz`, nato il 14/08/2026
// chiudendo la voce 27. Sono proprietà che PRIMA non potevano esistere, perché il cancello lo
// teneva il browser: la banca con le risposte stava in `index.html`, cioè nel file che si
// scarica per fare il test.
//
// ⭐ IL CODICE NON È RICOPIATO QUI: si IMPORTA il modulo vero. Fino a poche ore fa questo banco
//    lo estraeva a fette dal sorgente cercando marcatori di testo, e quelle fette mi hanno
//    tradito due volte in un pomeriggio — una funzione spostata di dieci righe finiva dentro
//    la fetta sbagliata e il banco crollava invece di dire rosso. Da quando il cancello vive
//    in un `.js` che è un MODULO vero, si importa e basta.
//    🔗 Ed è la stessa separazione che ha zittito i 36 errori di `deno check`: quel codice è
//    JavaScript, e adesso lo dichiara la sua estensione.
//
// 🚨 LE PROPRIETÀ, e perché ognuna esiste:
//   1. la pescata è RIPETIBILE — l'edge non salva quali domande ha fatto, le ripesca con lo
//      stesso seme quando corregge. Se si rompe, il socio viene bocciato per colpa del server;
//   2. la risposta giusta NON esce — né `correct` né `trap` nella pescata che va al telefono;
//   3. la furbata vecchia non funziona più — dichiarare zero domande dava `skip`;
//   4. il calcolo del livello GIRA — è morto una volta con `cleanCell is not defined`, perché
//      era stato spostato senza le funzioni che usa. Una funzione mai chiamata non rivela le
//      sue dipendenze mancanti;
//   5. il vuoto in colonna numerica diventa `null` — `balanced_level` usciva `""` da una
//      scheda normalissima e faceva fallire l'INTERA riga;
//   6. la fascia esce dalle DUE forme del livello — con `4.0 - Avanzato` dava NaN, e il socio
//      finiva in segreteria **in silenzio** avendo risposto a tutto.
//
// Uso:  node test/assessment-quiz.test.mjs
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const QUI = dirname(fileURLToPath(import.meta.url));
const MODULO = join(QUI, '..', 'supabase', 'functions', 'assessment-quiz', 'conoscenza.js');

// 🚨 Se questo `import` fallisce, il banco è già rosso e nel modo giusto: una dichiarazione
// doppia o una parentesi storta qui è ciò che il 14/08 ha fatto deployare su TEST una funzione
// che non partiva. Il caricamento come MODULO è lo stesso rigore che usa Deno.
const C = await import(`file://${MODULO}`);

let ko = 0;
const ok = (n, c) => { console.log((c ? '✅ ' : '❌ ') + n); if (!c) ko++; };

ok('il modulo si carica (dichiarazioni doppie e sintassi storta cadono qui)', typeof C.assessKnowledgePick === 'function');

// ── 1. ripetibilità ─────────────────────────────────────────────────────────────
const a = C.pescaPerGettone('tok-ABC123', 'Intermedio');
const b = C.pescaPerGettone('tok-ABC123', 'Intermedio');
ok('🚨 stesso gettone ⇒ stesse 4 domande', JSON.stringify(a) === JSON.stringify(b));
ok('…e sono davvero 4', a.length === 4);
ok('…con esattamente 1 trappola',
   a.filter((q) => C.ASSESS_KNOWLEDGE_BANK.questions.find((x) => x.id === q.id)?.trap).length === 1);
const c = C.pescaPerGettone('tok-XYZ789', 'Intermedio');
ok('gettone diverso ⇒ pescata diversa',
   JSON.stringify(a.map((q) => q.id)) !== JSON.stringify(c.map((q) => q.id)));

// ── 2. la risposta giusta non esce ──────────────────────────────────────────────
const versoIlTelefono = a.map((d) => ({ id: d.id, fascia: d.fascia, q: d.q, opts: d.opts }));
const testo = JSON.stringify(versoIlTelefono);
ok('🚨 nessun campo `correct` verso il telefono', !testo.includes('"correct"'));
ok('🚨 nessun campo `trap` verso il telefono', !testo.includes('"trap"'));

// ── 3. la correzione sta sugli id RIPESCATI ─────────────────────────────────────
const risposte = {};
for (const d of a) {
  const q = C.ASSESS_KNOWLEDGE_BANK.questions.find((x) => x.id === d.id);
  risposte[d.id] = q.opts[q.correct];
}
ok('tutte giuste ⇒ pass',
   C.assessKnowledgeEvaluate(a.map((d) => d.id), risposte, 'Intermedio').status === 'pass');
const furbata = C.assessKnowledgeEvaluate(a.map((d) => d.id), {}, 'Intermedio');
ok('🚨 rispondere a vuoto NON passa più', furbata.status === 'fail');
ok('fascia dedotta dalle domande', furbata.fascia === 'Intermedio');

// ── 4. il calcolo del livello gira ──────────────────────────────────────────────
ok('🚨 il calcolo del livello GIRA (era `cleanCell is not defined`)', (() => {
  const r = C.calculateAssessmentPublicLevel({
    declaredLevel: '4.0 - Avanzato', experience: 'Oltre 3 anni', frequency: '2-3 volte a settimana',
    rally: 'Scambio a ritmo medio con continuità', walls: 'Uso le pareti con sicurezza',
    net: 'Tengo posizione e controllo le volée', overheads: 'Uso bandeja e smash con controllo',
  });
  return r && typeof r.coherence === 'string';
})());
ok('…e regge una scheda VUOTA senza esplodere', (() => {
  try { C.calculateAssessmentPublicLevel({}); return true; } catch { return false; }
})());

// ── 5. il vuoto è `null`, non zero e non errore ─────────────────────────────────
ok('🚨 stringa vuota ⇒ null', C.numero('') === null && C.numero('   ') === null && C.numero(null) === null);
ok('…un numero resta un numero', C.numero('4') === 4 && C.numero('3.767') === 3.767);
ok('…la virgola si legge come il punto', C.numero('4,5') === 4.5);
ok('…e la fuffa non diventa 0', C.numero('boh') === null);
ok('🚨 nessun campo numerico della scheda finisce in colonna numerica come stringa vuota', (() => {
  const r = C.calculateAssessmentPublicLevel({ declaredLevel: '4.0 - Avanzato', experience: 'Oltre 3 anni' });
  return [r.calculated_level, r.balanced_level, r.technical_average, r.raw_score]
    .every((v) => C.numero(v) === null || typeof C.numero(v) === 'number');
})());

// ── 6. la fascia esce dalle due forme ───────────────────────────────────────────
ok('🚨 la fascia esce sia da «4» sia da «4.0 - Avanzato»',
   C.fasciaDaLivello('4') === 'Avanzato' && C.fasciaDaLivello('4.0 - Avanzato') === 'Avanzato');
ok('…e «2.0 - Base» dà Base, non vuoto', C.fasciaDaLivello('2.0 - Base') === 'Base');
ok('…Semi-Pro non ha quiz, e non è una dimenticanza', C.fasciaDaLivello('6.0 - Semi-Pro') === '');

// ── 7. nessun nome dichiarato due volte: è ciò che uccise la prima versione ──────
const sorgente = readFileSync(MODULO, 'utf8');
const nomi = [...sorgente.matchAll(/^export (?:function|const)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
const doppi = [...new Set(nomi.filter((n) => nomi.filter((x) => x === n).length > 1))];
ok(`nessuna dichiarazione doppia (${nomi.length} esportazioni)`, doppi.length === 0);
if (doppi.length) console.log('   doppi: ' + doppi.join(', '));

console.log(ko ? `\n${ko} PROVE FALLITE` : '\n— tutte verdi —');
process.exit(ko ? 1 : 0);
