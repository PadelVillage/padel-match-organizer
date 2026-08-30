// ── BANCO: nessuna risposta automatica paga più del sapere ───────────────────────────
//
// 🗣️ Nasce dalla sua parola del 30/08/2026 — *«VAi procedi e fai il lavoro»* — sulla proposta ①,
//    che era stata MISURATA prima di proporla e non dedotta.
//
// 📏 LA MISURA CHE LA GIUSTIFICA, fatta sulla banca in servizio il 30/08: dei 57 trabocchetto di
//    allora, **44 si passavano negando** (le tre forme «Non esiste», «Mai: …», «No: …» sono la
//    stessa cosa per chi risponde). ⇒ Un socio che rispondeva «non esiste» a tutti e tre i
//    trabocchetto del giro e sapeva le due domande normali passava il quiz nel:
//        76% (Base e Intermedio) · 87% (Avanzato) · 96% (Agonista)
//    contro il **50%** di chi i trabocchetto non li sa e tira a caso.
//    ⇒ **La scorciatoia rendeva più del sapere**, che è esattamente ciò che un cancello non
//    deve mai fare.
//
// 🚨⭐⭐ E LA CURA CHE VIENE IN MENTE PER PRIMA È SBAGLIATA, misurato prima di scrivere il
//    codice: imporre alla pescata una composizione fissa («2 inventati + 1 vero») crea subito la
//    scorciatoia SPECCHIO, perché con soglia 4/5 e le due normali sapute bastano 2 trabocchetto
//    su 3 — chi impara la regola fissa la sfrutta al contrario.
//    ⇒ Si bilancia la **banca**, e la composizione del singolo giro resta casuale.
//    📌 *Contro una scorciatoia non si mette una regola fissa: una regola fissa è la prossima
//    scorciatoia. Si toglie l'informazione che la rendeva conveniente.*
//
// ⛔ COSA QUESTA PROVA NON PROVA, e va detto: che le 27 domande nuove siano GIUSTE. Questa
//    guardia conta i versi e misura le probabilità — non sa niente di padel. Le risposte le deve
//    rileggere il committente o il maestro, come fu fatto il 27/08 per le 36 di Principiante.
//
// Uso:  node test/trabocchetto-bilanciato.test.mjs
import { readFileSync } from 'node:fs';
import { ASSESS_KNOWLEDGE_BANK } from '../supabase/functions/assessment-quiz/conoscenza.js';

let passati = 0, falliti = 0;
function caso(titolo, fn) {
  try { fn(); console.log('✅ ' + titolo); passati++; }
  catch (err) { console.log('❌ ' + titolo + '\n   → ' + (err && err.message || err)); falliti++; }
}
function esigi(condizione, messaggio) { if (!condizione) throw new Error(messaggio); }

const FASCE = ['Principiante', 'Base', 'Intermedio', 'Avanzato', 'Agonista'];
const trapDi = (f) => ASSESS_KNOWLEDGE_BANK.questions.filter((q) => q.fascia === f && q.trap);
const PESCATE = ASSESS_KNOWLEDGE_BANK.pick_trap;
const SOGLIA = ASSESS_KNOWLEDGE_BANK.pass_min_correct;
const NORMALI = ASSESS_KNOWLEDGE_BANK.pick_normal;

function combinazioni(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1);
  return r;
}
/* Quante delle `pick` trabocchetto pescate sono del verso che il socio sta indovinando:
   è un'estrazione senza rimessa, quindi ipergeometrica — non binomiale. */
function distribuzione(favorevoli, totale, pick) {
  return [...Array(pick + 1)].map((_, k) =>
    combinazioni(favorevoli, k) * combinazioni(totale - favorevoli, pick - k) / combinazioni(totale, pick));
}
/* La probabilità di PASSARE per chi tira sempre lo stesso verso E sa le due domande normali:
   è il caso peggiore, cioè il socio che conosce il padel ma non i trabocchetto — o che ha
   capito lo schema. */
function quantoPagaLaScorciatoia(favorevoli, totale) {
  const d = distribuzione(favorevoli, totale, PESCATE);
  let p = 0;
  for (let k = 0; k < d.length; k++) if (k + NORMALI >= SOGLIA) p += d[k];
  return p;
}

caso('1. ogni trabocchetto dichiara un verso valido', () => {
  const storti = ASSESS_KNOWLEDGE_BANK.questions
    .filter((q) => q.trap && q.verso !== 'nega' && q.verso !== 'afferma')
    .map((q) => `${q.id} («${q.verso}»)`);
  esigi(storti.length === 0, `trabocchetto senza verso: ${storti.join(', ')}`);
});

caso('2. 🚨 in OGNI fascia i due versi si equivalgono (40-60%)', () => {
  /* Il limite è largo di proposito: pretendere il 50% esatto vorrebbe dire riscrivere una
     domanda ogni volta che se ne aggiunge una, e una guardia che costringe a manutenzione
     inutile è una guardia che qualcuno spegne. Fuori dal 40-60% invece la scorciatoia
     ricomincia a rendere, ed è il momento in cui serve saperlo. */
  const fuori = [];
  for (const f of FASCE) {
    const t = trapDi(f);
    const quota = t.filter((q) => q.verso === 'nega').length / t.length;
    if (quota < 0.40 || quota > 0.60) fuori.push(`${f}: ${(quota * 100).toFixed(0)}% negano (${t.length} trabocchetto)`);
  }
  esigi(fuori.length === 0, `fasce sbilanciate:\n     ${fuori.join('\n     ')}`);
});

caso('3. 🚨⭐⭐ nessuna risposta automatica paga più del tirare a caso', () => {
  /* La misura che conta davvero, e l'unica che dice se la cura ha funzionato: si simulano le
     DUE scorciatoie speculari — «nego sempre» e «confermo sempre» — su un socio che sa le due
     domande normali. Il riferimento è il 50% di chi tira a caso sui trabocchetto.
     ⚠️ Il margine è 12 punti e non zero perché una banca con un numero DISPARI di trabocchetto
     non può essere esattamente a metà: Principiante sta a 9/16 ⇒ 60%, ed è il massimo che quel
     conto consente. Sotto quella fascia, per giunta, la soglia è 0 e nessuno viene bocciato. */
  const MASSIMO = 0.50 + 0.12;
  const troppo = [];
  for (const f of FASCE) {
    const t = trapDi(f);
    const nega = t.filter((q) => q.verso === 'nega').length;
    const negoSempre = quantoPagaLaScorciatoia(nega, t.length);
    const confermoSempre = quantoPagaLaScorciatoia(t.length - nega, t.length);
    if (negoSempre > MASSIMO) troppo.push(`${f}: «nego sempre» passa nel ${(negoSempre * 100).toFixed(0)}%`);
    if (confermoSempre > MASSIMO) troppo.push(`${f}: «confermo sempre» passa nel ${(confermoSempre * 100).toFixed(0)}%`);
  }
  esigi(troppo.length === 0,
    `una risposta automatica è tornata a rendere più del sapere:\n     ${troppo.join('\n     ')}`);
});

caso('4. la banca resta abbastanza grande da non ripetersi', () => {
  /* La pescata ha memoria (non ripropone le domande delle ultime 8 prove): perché quella
     memoria abbia materiale, ogni fascia deve avere più trabocchetto di quanti se ne vedono in
     otto giri di un solo verso. 8 prove × 3 trabocchetto = 24, ma i due versi si dividono il
     lavoro ⇒ il vincolo pratico è ~12 per fascia. Sotto, la memoria degrada e il socio
     ricomincia a rivedere le stesse. */
  const povere = FASCE.filter((f) => trapDi(f).length < 14).map((f) => `${f}: ${trapDi(f).length}`);
  esigi(povere.length === 0, `fasce con troppi pochi trabocchetto: ${povere.join(', ')}`);
});

caso('5. la pescata NON impone una composizione fissa dei versi', () => {
  /* 🔒 Questa guardia protegge una decisione, non un meccanismo: se un domani qualcuno
     «migliorasse» la pescata imponendo 2 nega + 1 afferma a ogni giro, creerebbe la scorciatoia
     specchio che questa cura esiste per togliere. La pescata deve continuare a scegliere i
     trabocchetto per FRESCHEZZA e basta, senza guardare il verso. */
  const testo = readFileSync(new URL('../supabase/functions/assessment-quiz/conoscenza.js', import.meta.url), 'utf8');
  const pesca = testo.slice(testo.indexOf('export function assessKnowledgePick'), testo.indexOf('export function assessKnowledgeEvaluate'));
  esigi(!/verso/.test(pesca),
    'la pescata guarda il `verso`: una composizione fissa dei versi è la scorciatoia specchio, ' +
    'e questa cura esiste per toglierla. Il bilanciamento sta nella BANCA, non nel giro.');
});

console.log(`\n— ${passati} passati, ${falliti} falliti su ${passati + falliti} casi —`);
process.exit(falliti === 0 ? 0 : 1);
