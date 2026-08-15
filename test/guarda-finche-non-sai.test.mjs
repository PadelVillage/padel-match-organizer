// ── BANCO: GUARDA FINCHÉ NON SAI ────────────────────────────────────────────────
//
// Che cosa prova: che `staffCalGuardaFinchePuoi` NON si accontenti del primo colpo andato a
// vuoto. Fino al 15/08/2026 l'app guardava su Matchpoint **una volta sola**: se quel colpo
// falliva, il «non lo so» diventava DEFINITIVO e finiva davanti all'operatore.
//
// 🎯 PERCHÉ UN COLPO SOLO ERA LA SCELTA PEGGIORE POSSIBILE, e non è teoria: misurato in
//    produzione la notte del 14/08/2026, fermando Caddy. Il guardare passa dalla STESSA strada
//    della prenotazione, quindi quando l'esito è ignoto quella strada è caduta — e il primo
//    tentativo è, per costruzione, quello con meno probabilità di riuscire.
//
// ⭐ La funzione NON è ricopiata qui: viene ESTRATTA da `index.html` e valutata. Un banco che
//    prova una copia del codice prova la copia, non il prodotto.
//
// ⭐ Orologio e attesa sono iniettati, quindi i 3 minuti di insistenza si provano in un
//    millisecondo e senza rete: il banco misura la REGOLA, non la pazienza di chi lo esegue.
//
// Uso:  node test/guarda-finche-non-sai.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const INDEX = join(QUI, '..', 'index.html');
const html = readFileSync(INDEX, 'utf8');

// Estrazione per conteggio di graffe, saltando commenti e stringhe (i commenti italiani sono
// pieni di apostrofi, e ognuno preso per un apice manda in tilt il conteggio).
// ⚠️ Rispetto ai banchi fratelli qui si cerca PRIMA `async function`: tagliare via quel prefisso
//    produrrebbe una funzione sincrona piena di `await`, cioè un errore di sintassi — un banco
//    rosso per un motivo che non c'entra niente con ciò che deve provare.
function estrai(nome) {
  let inizio = html.indexOf(`async function ${nome}(`);
  if (inizio < 0) inizio = html.indexOf(`function ${nome}(`);
  if (inizio < 0) throw new Error(`funzione «${nome}» non trovata in index.html`);
  let t = html.indexOf('(', inizio), tonde = 0;
  for (; t < html.length; t++) {
    if (html[t] === '(') tonde++;
    else if (html[t] === ')') { tonde--; if (tonde === 0) { t++; break; } }
  }
  let i = html.indexOf('{', t), livello = 0, dentroStringa = null, prec = '';
  for (; i < html.length; i++) {
    const c = html[i], succ = html[i + 1];
    if (dentroStringa) {
      if (c === dentroStringa && prec !== '\\') dentroStringa = null;
    } else if (c === '/' && succ === '/') { const fine = html.indexOf('\n', i); i = fine < 0 ? html.length : fine; prec = '\n'; continue; }
    else if (c === '/' && succ === '*') { const fine = html.indexOf('*/', i + 2); i = fine < 0 ? html.length : fine + 1; prec = '/'; continue; }
    else if (c === '"' || c === "'" || c === '`') { dentroStringa = c; }
    else if (c === '{') livello++;
    else if (c === '}') { livello--; if (livello === 0) { i++; break; } }
    prec = c;
  }
  return html.slice(inizio, i);
}

// La costante vera, letta anch'essa da `index.html`: se un domani cambiassero i tempi, il banco
// deve accorgersene invece di provare numeri suoi.
const rigaLook = html.match(/const _STAFF_CAL_LOOK = \{[^}]*\};/);
if (!rigaLook) throw new Error('`_STAFF_CAL_LOOK` non trovata in index.html');

const ctx = vm.createContext({ console });
vm.runInContext(rigaLook[0] + '\n\n' + estrai('staffCalGuardaFinchePuoi'), ctx);
const guarda = ctx.staffCalGuardaFinchePuoi;
// ⚠️ `const` non diventa una proprietà del contesto (le `function` sì): la costante si legge
//    valutandola come espressione, o si leggerebbe `undefined` credendo di aver misurato.
const LOOK = vm.runInContext('({ maxMs: _STAFF_CAL_LOOK.maxMs, stepMs: _STAFF_CAL_LOOK.stepMs })', ctx);

// Banco a orologio finto: le risposte si dichiarano in fila, il tempo avanza solo quando la
// funzione decide di aspettare.
function prova(risposte, opzioni) {
  const o = opzioni || {};
  let t = 0;
  const attese = [];
  const annunci = [];
  let chiamate = 0;
  const chiedi = async function () {
    const r = risposte[Math.min(chiamate, risposte.length - 1)];
    chiamate++;
    if (r instanceof Error) throw r;
    return r;
  };
  return guarda(chiedi, {
    maxMs: o.maxMs, stepMs: o.stepMs,
    ora: function () { return t; },
    aspetta: async function (ms) { attese.push(ms); t += ms; },
    annuncia: function (n) { annunci.push(n); },
  }).then(function (esito) {
    return { esito, attese, annunci, chiamate };
  });
}

let ok = 0, ko = 0;
async function caso(nome, fn) {
  let esito;
  try { esito = await fn(); } catch (e) { esito = false; console.log(`   ↳ eccezione: ${e.message}`); }
  const passato = Array.isArray(esito) ? esito.every(Boolean) : !!esito;
  console.log(`${passato ? '✅' : '❌'} ${nome}`);
  passato ? ok++ : ko++;
}

console.log('\n⌛ GUARDA FINCHÉ NON SAI — staffCalGuardaFinchePuoi\n');

await caso('1. la costante è quella vera di index.html: 3 minuti, un colpo ogni 15 secondi', () =>
  LOOK.maxMs === 180000 && LOOK.stepMs === 15000);

await caso('2. primo colpo «si» ⇒ si ferma subito, senza aspettare nessuno', async () => {
  const r = await prova([{ verdict: 'si', why: 'trovata' }], { maxMs: 60000, stepMs: 15000 });
  return r.esito.verdict === 'si' && r.esito.tentativi === 1 && r.attese.length === 0;
});

await caso('3. 🚨 IL CASO CHE IERI FALLIVA: primo «boh», secondo «si» ⇒ SI (prima si arrendeva)', async () => {
  const r = await prova([{ verdict: 'boh', why: 'strada giù' }, { verdict: 'si', why: 'trovata' }],
    { maxMs: 60000, stepMs: 15000 });
  return r.esito.verdict === 'si' && r.esito.tentativi === 2 && !r.esito.scaduto;
});

await caso('4. primo «boh», secondo «no» ⇒ NO definitivo: anche la brutta notizia è una risposta', async () => {
  const r = await prova([{ verdict: 'boh', why: 'strada giù' }, { verdict: 'no', why: 'non c\'è niente' }],
    { maxMs: 60000, stepMs: 15000 });
  return r.esito.verdict === 'no' && r.esito.tentativi === 2;
});

await caso('5. sempre «boh» ⇒ si arrende alla SCADENZA, dichiarandolo, dopo aver insistito', async () => {
  const r = await prova([{ verdict: 'boh', why: 'niente da fare' }], { maxMs: 60000, stepMs: 15000 });
  return r.esito.verdict === 'boh' && r.esito.scaduto === true
    && r.esito.tentativi === 5 && r.attese.length === 4;
});

await caso('6. 🚨 se il guardare LANCIA, non ci si arrende: l\'eccezione è il motivo per riprovare', async () => {
  const r = await prova([new Error('tcp connect error'), { verdict: 'si', why: 'trovata' }],
    { maxMs: 60000, stepMs: 15000 });
  return r.esito.verdict === 'si' && r.esito.tentativi === 2;
});

await caso('7. non martella: fra un colpo e l\'altro aspetta esattamente il passo dichiarato', async () => {
  const r = await prova([{ verdict: 'boh', why: 'x' }], { maxMs: 60000, stepMs: 15000 });
  return r.attese.every((ms) => ms === 15000);
});

await caso('8. annuncia OGNI tentativo, numerato da 1: chi guarda lo schermo vede che si insiste', async () => {
  const r = await prova([{ verdict: 'boh', why: 'x' }], { maxMs: 45000, stepMs: 15000 });
  return JSON.stringify(r.annunci) === JSON.stringify([1, 2, 3, 4]);
});

await caso('9. una risposta malformata vale «boh», non fa esplodere e non ferma l\'insistenza', async () => {
  const r = await prova([null, undefined, { verdict: 'si', why: 'trovata' }],
    { maxMs: 60000, stepMs: 15000 });
  return r.esito.verdict === 'si' && r.esito.tentativi === 3;
});

await caso('10. 🚨 CONTROLLO NEGATIVO — il banco sa diventare rosso: con la regola vecchia (un colpo\n    solo, ci si ferma su «boh») il caso 3 fallisce', async () => {
  // Riproduce il comportamento fino alla 6.232: guarda una volta e restituisce quel che trova.
  const vecchia = async function (chiedi) { return await chiedi(); };
  let n = 0;
  const risposte = [{ verdict: 'boh', why: 'strada giù' }, { verdict: 'si', why: 'trovata' }];
  const esito = await vecchia(async function () { return risposte[n++]; });
  // Con la regola vecchia esce «boh»: se un domani qualcuno la rimettesse, il caso 3 diventa rosso.
  return esito.verdict === 'boh';
});

console.log(`\n${ko === 0 ? '✅' : '❌'} ${ok}/${ok + ko} casi passati\n`);
process.exit(ko === 0 ? 0 : 1);
