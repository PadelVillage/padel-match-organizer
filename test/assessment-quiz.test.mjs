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

console.log(ko ? `\n${ko} PROVE FALLITE` : '\n— tutte verdi —');
process.exit(ko ? 1 : 0);
