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
ok('🚨 stesso gettone ⇒ stesse domande', JSON.stringify(a) === JSON.stringify(b));
ok('…e sono davvero 5', a.length === 5);   // 🔄 27/08: pescata 2+3
// 🔄 27/08, secondo giro — 3 trappole su 5, sua delega (pescata 2+3, soglia 4/5 in `conoscenza.js`).
ok('…con esattamente 3 trappole',
   a.filter((q) => C.ASSESS_KNOWLEDGE_BANK.questions.find((x) => x.id === q.id)?.trap).length === 3);
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

// ── 8. ⚡⭐⭐ IL GIRO D'APPLICAZIONE PARTE SUBITO (24/08/2026) ────────────────────
//
// 🗣️ Il difetto misurato su Fabiola Limuti, terza prova: *«non è arrivata nessuna notifica sul
// bot, non gli è stato comunicato il suo livello, non è stato messo il livello dentro la
// scheda»*. Tre sintomi, UNA causa: il bot, a test superato, tace finché il livello non è
// scritto — e sulla TERZA prova (che non ha una scelta da fare) quella porta resta intera.
// Il livello lo scriveva solo il cron `*/15` ⇒ fino a un quarto d'ora di silenzio totale.
// 📏 Provato a mano lo stesso giorno: lanciando il giro, il livello è atterrato in 0,7 secondi.
//
// 🚨 SI GUARDA IL CODICE SENZA COMMENTI, ed è la cicatrice della mattina: la prima stesura
// delle guardie della ⓒ cercava i nomi dentro il FILE, e i commenti che spiegano la cura li
// contengono tutti — togliendo il lancio vero restavano verdi.
const SORGENTE_EDGE = readFileSync(join(QUI, '..', 'supabase', 'functions', 'assessment-quiz', 'index.ts'), 'utf8');
const codiceEdge = SORGENTE_EDGE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// 🚨⭐⭐ E PRIMA DI TUTTO: I COMMENTI A BLOCCO SI CHIUDONO DOVE CREDONO DI CHIUDERSI.
//
// 🆕 25/08 — LA PROMESSA NON SI FA A CHI NON LA RICEVERÀ.
// 🚨 Il difetto c'è stato: la prima stesura mandava la frase «intanto ti registriamo
// Intermedio» a CHIUNQUE dimostrasse più di 3.5, cancello fallito compreso. Cioè proprio a
// chi ha dichiarato alto e risposto male — la persona a cui una promessa non mantenuta fa
// più danno. Trovato pensando alla prova con Laura, non rileggendo.
// ⚖️ `statoStaff === ''` è la stessa condizione che `assessment-apply-level` userà per
// scrivere il livello: chiedere qui quello che decide là è il modo di non avere due verità.
ok('🆕 la certificazione del maestro esce SOLO se la scheda si applichera\' davvero',
  /certificazione: statoStaff === '' \? certificazioneDelMaestro\(/.test(SORGENTE_EDGE));

// 📏 Successo scrivendo questa cura, il 24/08: dentro un commento `/* … */` avevo scritto il
// cron `*` `/15`, e quella sequenza CHIUDE il commento — il resto del testo italiano diventava
// codice, e la funzione non sarebbe nemmeno partita su Deno. L'ha beccato per rimbalzo la
// guardia sotto, che leggeva il sorgente senza commenti e ci trovava dentro delle parole.
// ⚖️ In un repo dove i commenti sono lunghi quanto il codice e pieni di percorsi e cron, non è
// un caso limite: è una trappola che aspetta. Qui si guarda in modo esplicito.
{
  let dentro = false, fuoriPosto = 0;
  for (let i = 0; i < SORGENTE_EDGE.length - 1; i++) {
    const due = SORGENTE_EDGE.slice(i, i + 2);
    if (!dentro && due === '/*') { dentro = true; i++; continue; }
    if (dentro && due === '*/') { dentro = false; i++; continue; }
    // Un `*/` fuori da un commento: o chiude un commento già chiuso (il difetto), o vive in
    // una stringa e allora va guardato lo stesso, perché è indistinguibile a occhio.
    if (!dentro && due === '*/') fuoriPosto++;
  }
  ok('🚨 nessun `*/` fuori posto: un commento a blocco chiuso a metà non parte su Deno',
     fuoriPosto === 0 && !dentro);
}

ok('⚡ consegnata la scheda, il giro d\'applicazione parte subito',
   /pmo_dispatch_assessment_apply_level/.test(codiceEdge));
// 🔒 Si passa dal DISPATCHER, che legge il vault da sé: il segreto delle routine non deve
// avere un secondo posto da cui uscire. Chiamare l'edge dritta vorrebbe dire portarcelo.
ok('…dal dispatcher, senza portarsi in mano il segreto delle routine',
   !/x-pmo-routine-secret/.test(codiceEdge));
// 🔒 La regola di QUANDO si applica (il giro delle tre prove, il ribasso, la scheda più
// recente) vive in `assessment-apply-level`. Qui non si decide «è la terza?»: si chiama
// sempre, e a decidere resta quella. Una seconda copia divergerebbe al primo ripensamento.
ok('🚨 la regola del giro NON è ricopiata qui: si chiama sempre',
   !/laProvaEsaurisceIlGiro|TENTATIVI_PER_GIRO|giro-del-test/.test(codiceEdge));
// ⚖️ Il socio ha appena finito il quiz: la sua risposta è già vera. Se il giro non parte, il
// livello arriva col cron — si perde la fretta, non il fatto.
ok('…e un giro fallito non fa fallire la consegna della scheda',
   /console\.error[\s\S]{0,160}giro d.applicazione non partito/.test(codiceEdge));
// 🚨 L'ORDINE, e non è un dettaglio: prima la scheda è scritta, poi si lancia. Al contrario il
// giro non troverebbe niente da applicare, e sarebbe una chiamata a vuoto che sembra una cura.
ok('🚨 si lancia DOPO che la scheda è stata scritta',
   codiceEdge.indexOf("from('self_assessments')") < codiceEdge.indexOf('pmo_dispatch_assessment_apply_level'));

// ── 9. 🚨🚨 LA DATA DELLA SCHEDA LA SCRIVE CHI LA SCRIVE (voce 84, 24/08/2026) ──────────
//
// 📏 Il collaudo di Marco Aprea, misurato: scheda consegnata alle 21:18:23 del 24 agosto e
// salvata con `submitted_at` del **3 maggio**. La riga va in `upsert(… onConflict: 'token')`:
// su gettone nuovo è un INSERT e la data la metteva il database (`default now()`), ma su un
// gettone che aveva già una scheda è un UPDATE — e un campo che non è nella riga NON si tocca.
// ⇒ `assessment-apply-level` l'ha scartata come «più vecchia del livello del socio», che è la
// sua guardia SANA: a mentire era la data. Livello mai scritto, bot muto, per sempre.
//
// ⚠️ QUESTE DUE SONO GUARDIE TESTUALI, e si dicono per quello che sono: la riga si costruisce
// dentro il gestore HTTP e da qui non si può ESEGUIRE. Provano che la data è scritta e dov'è
// scritta — non provano che il database la riceva. Quella è una prova fisica, e va fatta.
ok('🚨 la scheda porta la sua data: `submitted_at` non lo lascia mettere al database',
   /submitted_at:\s*new Date\(\)\.toISOString\(\)/.test(codiceEdge));
// 🔒 Dev'essere DENTRO la riga, cioè prima dell'`upsert`: scritta dopo sarebbe codice morto
// che sembra una cura — esattamente il tipo di verde che non difende niente.
ok('…e sta DENTRO la riga che si scrive, non dopo',
   codiceEdge.indexOf('submitted_at:') > -1
   && codiceEdge.indexOf('submitted_at:') < codiceEdge.indexOf("upsert(riga"));

console.log(ko ? `\n${ko} PROVE FALLITE` : '\n— tutte verdi —');
process.exit(ko ? 1 : 0);
