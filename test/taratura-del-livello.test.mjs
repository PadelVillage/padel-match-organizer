// ── BANCO: la taratura del livello — le risposte pesano più delle dichiarazioni ───────
//
// 🗣️ Nasce dalla sua parola del 30/08/2026 sulle proposte ② e ③ — *«VAi procedi e fai il
//    lavoro»* — e da un buco misurato scrivendole: delle 65 prove del repo, **nessuna** teneva
//    ferma la taratura. `test/assessment-quiz.test.mjs` controlla che il calcolo GIRI,
//    `test/motore-a-passi.test.mjs` che non dipenda dall'ordine dei bottoni. Quanto vale una
//    risposta, e quanto pesa una dichiarazione, non lo guardava nessuno.
//    ⇒ Cioè: si poteva cambiare un peso o un punteggio e vedere tutto verde. È lo stesso difetto
//    che il 21/08 aveva 42 file di prova che non girava nessuno, in scala più piccola.
//
// ⭐ COSA PINZA, e perché così: le PROPRIETÀ, non i numeri. Un banco che ricopia «0,55» diventa
//    rosso a ogni ritaratura legittima e verde a ogni deriva accidentale che ricopi anche lui.
//    Qui si pretendono le tre decisioni che stanno sotto i numeri:
//      ① le quattro scale tecniche sono lo STESSO metro (stessi cinque gradini);
//      ② le risposte pesano più delle dichiarazioni;
//      ③ il freno esiste verso l'alto e NON esiste verso il basso.
//    Un domani i numeri si possono muovere: queste tre no, senza che qualcuno lo decida.
//
// Uso:  node test/taratura-del-livello.test.mjs
import {
  assessmentPublicTechnicalScores,
  calculateAssessmentPublicLevel,
} from '../supabase/functions/assessment-quiz/conoscenza.js';

let passati = 0, falliti = 0;
function caso(titolo, fn) {
  try { fn(); console.log('✅ ' + titolo); passati++; }
  catch (err) { console.log('❌ ' + titolo + '\n   → ' + (err && err.message || err)); falliti++; }
}
function esigi(condizione, messaggio) { if (!condizione) throw new Error(messaggio); }

/* Le risposte estreme e centrali delle quattro domande tecniche, per parola: sono il dato con
   cui il punteggio si assegna, quindi si scrivono qui per esteso e non si abbreviano. */
const SCALE = {
  rally: ['Faccio fatica a tenere 3-4 colpi', 'Tengo lo scambio solo a ritmo lento',
    'Tengo scambi regolari con continuità', 'Tengo scambi anche con ritmo alto',
    'Costruisco il punto con controllo'],
  glass: ['Evito quasi sempre il vetro', 'Lo uso solo se la palla è facile',
    'Difendo con il vetro in modo base', 'Lo uso con continuità anche sotto pressione',
    'Lo uso per difendere e ripartire in attacco'],
  net: ['Sto poco a rete', 'Vado a rete ma faccio fatica a chiudere', 'Gioco volée semplici',
    'Tengo posizione e controllo le volée', 'Costruisco e chiudo il punto a rete'],
  overhead: ['Non li uso', 'Li provo ma con poca sicurezza', 'Uso almeno la bandeja in modo semplice',
    'Uso bandeja e smash con controllo', 'Uso colpi alti in modo tattico e affidabile'],
};
const gradini = (campo) => SCALE[campo].map((testo) => assessmentPublicTechnicalScores({ [campo]: testo })[campo]);
const rispostaN = (n) => Object.fromEntries(Object.entries(SCALE).map(([k, v]) => [k, v[n]]));

caso('1. ⭐ le quattro scale tecniche sono lo STESSO metro', () => {
  /* 📏 Il difetto che questa riga chiude, misurato il 30/08: lo scambio andava da 1,0 a 5,0
     (4 punti di corsa), la rete e i colpi alti da 1,5 a 4,5 (3 punti) — e le quattro venivano
     mediate come se fossero commensurabili. ⇒ Lo scambio pesava un terzo in più delle altre
     due, per un peso che nessuno aveva deciso. */
  const riferimento = gradini('rally');
  for (const campo of Object.keys(SCALE)) {
    const g = gradini(campo);
    esigi(g.every((v) => typeof v === 'number' && Number.isFinite(v)),
      `${campo}: una risposta non ha punteggio — il testo non combacia più con la tabella: ${JSON.stringify(g)}`);
    esigi(JSON.stringify(g) === JSON.stringify(riferimento),
      `${campo} ha gradini diversi dallo scambio: ${JSON.stringify(g)} contro ${JSON.stringify(riferimento)} ` +
      '— quattro scale mediate alla pari devono avere la stessa corsa, o una domanda pesa più delle altre');
    esigi(g.every((v, i) => i === 0 || v > g[i - 1]), `${campo}: i gradini non salgono: ${JSON.stringify(g)}`);
  }
});

caso('2. la media tecnica può dire tutta la scala, da Principiante ad Agonista', () => {
  /* Prima della ritaratura la media tecnica viveva solo fra 1,25 e 4,625: chi rispondeva al
     massimo su tutt'e quattro non arrivava mai alla parola «Agonista» dalla parte tecnica, e
     chi rispondeva al minimo non arrivava a «Principiante». Un metro che non raggiunge i suoi
     estremi non misura gli estremi: li comprime. */
  const bassa = assessmentPublicTechnicalScores(rispostaN(0)).average;
  const alta = assessmentPublicTechnicalScores(rispostaN(4)).average;
  esigi(bassa <= 1.0, `la risposta più bassa dà ${bassa}, non arriva a Principiante`);
  esigi(alta >= 5.0, `la risposta più alta dà ${alta}, non arriva ad Agonista`);
});

caso('3. 🚨⭐⭐ le RISPOSTE pesano più delle DICHIARAZIONI', () => {
  /* È la decisione del 30/08, e la sola cosa di ② che non deve poter cambiare per distrazione.
     Si misura dal comportamento, non leggendo i pesi: a parità di tutto il resto, spostare le
     quattro risposte tecniche di un gradino deve muovere il calcolato più di quanto lo muova
     spostare di un gradino le due domande in cui il socio dice di sé.
     📌 Un banco che ricopiasse «0,55» non proverebbe questo: proverebbe di saper leggere. */
  const fisso = { declaredLevel: '3.5', balancedLevel: '3.5' };
  const perTecnica = Math.abs(
    Number(calculateAssessmentPublicLevel({ ...fisso, ...rispostaN(3) }).raw_score) -
    Number(calculateAssessmentPublicLevel({ ...fisso, ...rispostaN(2) }).raw_score));
  const perDichiarazione = Math.abs(
    Number(calculateAssessmentPublicLevel({ declaredLevel: '4.5', balancedLevel: '4.5', ...rispostaN(2) }).raw_score) -
    Number(calculateAssessmentPublicLevel({ declaredLevel: '3.5', balancedLevel: '3.5', ...rispostaN(2) }).raw_score));
  esigi(perTecnica > perDichiarazione,
    `un gradino di risposte tecniche muove il punteggio di ${perTecnica.toFixed(3)}, uno di ` +
    `dichiarazioni di ${perDichiarazione.toFixed(3)}: il test è tornato a misurare l'opinione di sé`);
});

caso('4. il freno verso l\'ALTO c\'è: non si esce con più di mezzo passo sopra il dichiarato', () => {
  const r = calculateAssessmentPublicLevel({ declaredLevel: '2.5', balancedLevel: '7', ...rispostaN(4) });
  esigi(Number(r.calculated_level) <= 3.0,
    `dichiarando Base e rispondendo al massimo esce ${r.calculated_level}: il tetto anti-sopravvalutazione non morde più`);
});

caso('5. 🚨 il freno verso il BASSO non c\'è più', () => {
  /* 🔄 30/08: toglierlo è metà di ②. Rialzava verso la dichiarazione chi rispondeva molto più
     basso di come si era descritto — la stessa forza contro cui i pesi nuovi lavorano, applicata
     una seconda volta. Chi dichiara Avanzato e risponde da Principiante deve poter uscire più di
     un punto sotto la sua dichiarazione; a fermare quella scheda ci pensa la coerenza bassa,
     che è una protezione vera e non un rialzo. */
  const r = calculateAssessmentPublicLevel({ declaredLevel: '4.5', balancedLevel: '1.5', ...rispostaN(0) });
  esigi(Number(r.calculated_level) < 4.5 - 1.0,
    `esce ${r.calculated_level}, cioè non più di un punto sotto il dichiarato: il freno basso è tornato`);
  esigi(r.coherence === 'low' && r.staff_status === 'review',
    'una scheda così incoerente deve comunque fermarsi in segreteria: è lei la protezione, non il freno');
});

caso('6. chi risponde coerente non viene toccato dalla ritaratura', () => {
  /* La contropartita della ②: ribilanciare non deve spostare chi dice di sé quello che poi
     risponde. Misurato sulle schede vere (44), la fascia cambia in 6 casi e quasi tutti sono
     scarti fra dichiarato e risposte; qui si pinza il caso pulito. */
  for (const [dichiarato, gradino] of [['1.5', 0], ['2.5', 1], ['3.5', 2], ['4.5', 3], ['5.5', 4]]) {
    const r = calculateAssessmentPublicLevel({ declaredLevel: dichiarato, balancedLevel: dichiarato, ...rispostaN(gradino) });
    esigi(r.coherence === 'high',
      `chi dichiara ${dichiarato} e risponde al gradino ${gradino + 1} risulta «${r.coherence}»: ` +
      'la scala tecnica non è più allineata alla scala dei livelli');
  }
});

console.log(`\n— ${passati} passati, ${falliti} falliti su ${passati + falliti} casi —`);
process.exit(falliti === 0 ? 0 : 1);
