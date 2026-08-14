// ── BANCO: «la risposta giusta non arriva più al telefono» ───────────────────────
//
// Che cosa prova: le tre proprietà nuove dell'edge `assessment-quiz`, nate il 14/08/2026
// chiudendo i punti 1-2-3 della voce 27. Sono proprietà che PRIMA non potevano esistere,
// perché il cancello lo teneva il browser:
//
//   1. ⏱️ LA PESCATA È RIPETIBILE. L'edge non salva da nessuna parte quali domande ha fatto:
//      le ripesca con lo stesso seme (gettone + fascia) quando corregge. Se questa proprietà
//      si rompe, la correzione avviene su domande diverse da quelle mostrate — e il socio
//      viene bocciato per colpa del server.
//   2. 🚨 LA RISPOSTA GIUSTA NON ESCE. Nella pescata che va al telefono non compare né
//      `correct` né `trap`. È l'intero motivo per cui l'edge esiste: prima la banca stava in
//      `index.html`, cioè nel file che si scarica per fare il test.
//   3. 🚨 LA FURBATA VECCHIA NON FUNZIONA PIÙ. Finché gli id delle domande arrivavano dal
//      telefono, bastava dichiararne zero per ottenere `skip`, o una fascia senza cancello
//      per ottenere `pass`. Ora gli id li mette il server e il telefono non ha voce.
//
// ⭐ Come la sorella `autovalutazione-conoscenza.test.mjs`: il codice NON è ricopiato qui,
//    viene ESTRATTO dal sorgente vero dell'edge ed eseguito. Se qualcuno cambia il seme o il
//    pesca, è quella modifica che finisce sul banco.
// ⚠️ Le funzioni del seme stanno nell'edge SENZA annotazioni di tipo apposta, per poter
//    girare qui dentro. Chi gliele rimettesse romperebbe questa prova, non l'edge.
//
// Uso:  node test/assessment-quiz.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const QUI = dirname(fileURLToPath(import.meta.url));
const EDGE = join(QUI, '..', 'supabase', 'functions', 'assessment-quiz', 'index.ts');
const T = readFileSync(EDGE, 'utf8');
const A = '/* ===== ASSESS-KNOWLEDGE SHARED v1 =====', B = '/* ===== /ASSESS-KNOWLEDGE SHARED v1 =====';
const blocco = T.slice(T.indexOf(A), T.indexOf(B));
// le due funzioni del seme, estratte dal sorgente vero e non ricopiate
const seme = T.slice(T.indexOf('function seme('), T.indexOf('function servizio('));
const ctx = vm.createContext({ Math, String, Number, Array, JSON, parseFloat, isFinite });
vm.runInContext(blocco + '\n' + seme +
  '\nfunction pesca(t,f){ return assessKnowledgePick(f, sorteDa(seme(t, assessTxt(f)))); }' +
  '\nthis.API = { pesca, assessKnowledgeEvaluate, ASSESS_KNOWLEDGE_BANK, assessKnowledgeFasciaFor };', ctx);
const { pesca, assessKnowledgeEvaluate, ASSESS_KNOWLEDGE_BANK: BANK, assessKnowledgeFasciaFor } = ctx.API;

/* 🚨 IL BANCO CHE MANCAVA — aggiunto il 14/08/2026 DOPO che è morso davvero.
   La prima versione di questa edge è stata deployata su TEST **e non è mai partita**:
   `worker boot error: Identifier 'pmoLivelloFascia' has already been declared`. Il browser
   diceva solo «Failed to fetch», perché una funzione che non parte non risponde nemmeno con
   un errore. Eppure le 14 suite erano verdi.
   ⭐⭐ LA RAGIONE, ed è la lezione: `vm.runInContext` esegue il blocco come **script**, e in
   uno script ridichiarare una funzione è LECITO. Deno lo carica come **modulo**, e lì è un
   errore di sintassi FATALE. Il banco girava in un mondo più permissivo del vero, quindi
   poteva solo dire di sì. ⇒ Un banco che gira in condizioni più larghe della produzione non
   è un banco debole: è un banco che DÀ FIDUCIA SBAGLIATA, che è peggio di non averlo.
   ⇒ Qui sotto il blocco viene analizzato come MODULO, con lo stesso rigore di Deno. */
function provaComeModulo(codice, nome) {
  const file = join(tmpdir(), `pmo-${nome}-${codice.length}.mjs`);
  writeFileSync(file, codice);
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } finally {
    try { unlinkSync(file); } catch {}
  }
}

let ko = 0;
const ok = (n, c) => { console.log((c ? '✅ ' : '❌ ') + n); if (!c) ko++; };

// 1. ripetibilità: stesso gettone + stessa fascia ⇒ stesse domande, stesse opzioni
const a = pesca('tok-ABC123', 'Intermedio'), b = pesca('tok-ABC123', 'Intermedio');
ok('stesso gettone ⇒ stesse 4 domande', JSON.stringify(a) === JSON.stringify(b));
ok('…e sono davvero 4', a.length === 4);
ok('…con esattamente 1 trappola', a.filter(q => BANK.questions.find(x => x.id === q.id)?.trap).length === 1);

// 2. gettoni diversi ⇒ pescate diverse (se no il seme non serve a niente)
const c = pesca('tok-XYZ789', 'Intermedio');
ok('gettone diverso ⇒ pescata diversa', JSON.stringify(a.map(q=>q.id)) !== JSON.stringify(c.map(q=>q.id)));

// 3. 🚨 LA PROPRIETÀ CHE CONTA: nella pescata non esce mai la risposta giusta
const versoIlTelefono = a.map(d => ({ id: d.id, fascia: d.fascia, q: d.q, opts: d.opts }));
const testo = JSON.stringify(versoIlTelefono);
ok('🚨 nessun campo `correct` verso il telefono', !('correct' in versoIlTelefono[0]) && !testo.includes('"correct"'));
ok('🚨 nessun campo `trap` verso il telefono', !testo.includes('"trap"'));

// 4. la correzione avviene sugli id RIPESCATI, non su quelli che manda il telefono
const risposte = {};
for (const d of a) { const q = BANK.questions.find(x => x.id === d.id); risposte[d.id] = q.opts[q.correct]; }
ok('tutte giuste ⇒ pass', assessKnowledgeEvaluate(a.map(d=>d.id), risposte, 'Intermedio').status === 'pass');
// il trucco di prima: dichiarare zero domande per ottenere «skip». Ora gli id li mette il server.
const furbata = assessKnowledgeEvaluate(pesca('tok-ABC123','Intermedio').map(d=>d.id), {}, 'Intermedio');
ok('🚨 rispondere a vuoto NON passa più', furbata.status === 'fail');
ok('fascia dedotta dalle domande', furbata.fascia === 'Intermedio');

/* 🚨 IL SECONDO BANCO CHE MANCAVA — aggiunto il 14/08 dopo il TERZO giro storto.
   La consegna moriva con `ReferenceError: cleanCell is not defined`: il calcolo del livello
   era stato spostato nell'edge SENZA le tre funzioni che usa (`cleanCell`, `normalizeText`,
   `assessmentPublicScoreFromText`), che nell'app stanno altrove.
   ⭐⭐ Perché nessuna prova l'ha visto: le prove di prima ESERCITAVANO solo il quiz. Il calcolo
   del livello era nel file, dichiarato e mai chiamato — e una funzione mai chiamata non
   rivela le sue dipendenze mancanti. ⇒ Spostare una funzione vuol dire spostare il suo
   ALBERO, e il banco deve ESEGUIRE il ramo, non solo constatare che c'è. */
// ⚠️ I due estremi si CONTROLLANO: `indexOf` che non trova torna -1, e `slice(-1, …)` non
// dà errore — dà una fetta assurda. Senza questo controllo il banco crollava con uno stack
// illeggibile invece di dire cosa manca, ed è già successo provandolo.
const daQui = T.indexOf('function cleanCell('), aQui = T.indexOf('/* ── Il seme:');
if (daQui < 0 || aQui < 0 || aQui <= daQui) {
  console.log(`❌ non trovo il blocco del calcolo livello nell'edge (inizio ${daQui}, fine ${aQui}).`);
  console.log('   Se `cleanCell` non c\'è più, è il guasto del 14/08 che torna: il calcolo del');
  console.log('   livello è stato spostato senza le funzioni che usa.');
  process.exit(1);
}
const LIV = T.slice(daQui, aQui);
const ctxLiv = vm.createContext({ Math, String, Number, Array, JSON, parseFloat, isFinite });
vm.runInContext(LIV + '\nthis.API = { calculateAssessmentPublicLevel, assessmentPublicParseLevel };', ctxLiv);
const L = ctxLiv.API;

ok('🚨 il calcolo del livello GIRA (era `cleanCell is not defined`)', (() => {
  const esito = L.calculateAssessmentPublicLevel({
    declaredLevel: '4.0 - Avanzato', experience: 'Oltre 3 anni', frequency: '2-3 volte a settimana',
    rally: 'Scambio a ritmo medio con continuità', walls: 'Uso le pareti con sicurezza',
    net: 'Tengo posizione e controllo le volée', overheads: 'Uso bandeja e smash con controllo',
    balanced: '4.0 - Avanzato'
  });
  return esito && Number.isFinite(Number(esito.calculated_level)) && typeof esito.coherence === 'string';
})());
ok('…e regge una scheda VUOTA senza esplodere', (() => {
  try { L.calculateAssessmentPublicLevel({}); return true; } catch { return false; }
})());
ok('…e `assessmentPublicParseLevel` legge la virgola come il punto',
   L.assessmentPublicParseLevel('4,5') === '4.5');

// 5. 🚨 il blocco deve stare in piedi come MODULO, non solo come script
ok('🚨 il blocco condiviso è un modulo valido (come lo carica Deno)', (() => {
  try { provaComeModulo(blocco, 'blocco'); return true; }
  catch (e) { console.log('   ' + String(e.stderr || e.message).split('\n').slice(0, 3).join(' ')); return false; }
})());

// 6. nessun nome dichiarato due volte in cima al file: è esattamente ciò che uccise la v1
const nomi = [...T.matchAll(/^(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
const doppi = [...new Set(nomi.filter(n => nomi.filter(x => x === n).length > 1))];
ok(`nessuna dichiarazione doppia nell'edge (${nomi.length} nomi)`, doppi.length === 0);
if (doppi.length) console.log('   doppi: ' + doppi.join(', '));

console.log(ko ? `\n${ko} PROVE FALLITE` : '\n— tutte verdi —');
process.exit(ko ? 1 : 0);
