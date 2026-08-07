// ── BANCO: «una lezione senza maestro non parte, e nessuno se ne inventa uno» ────
//
// Che cosa prova: che nessuna delle strade di creazione riesca a mandare su Matchpoint una
// LEZIONE priva di maestro, e che il parser della casella «Prenota» non spacci per maestro una
// parola della frase.
//
// Le strade che creano una prenotazione sono TRE e finiscono tutte in `staffCalSubmitSingle`:
//   · casella «Prenota» del calendario (singola e RICORRENTE)  ← non aveva nessuna guardia
//   · scheda «Nuova prenotazione» dallo slot libero            ← bloccava già
//   · assistente in chat                                        ← chiedeva già il maestro per primo
// La guardia sta nel punto in cui CONVERGONO, non su ciascuna schermata: agganciarsi alle
// schermate lascia scoperta la prossima che verrà.
//
// 🚨⭐⭐ Il difetto misurato il 7/08/2026 non era «manca il maestro» ma «ne viene INVENTATO uno»:
//    con «lezione campo 1 19:30-20:30 Sara Trentin» il parser consegnava `istruttore: "campo"`.
//    Un campo vuoto si nota, un campo pieno di sbagliato no — e finiva su Matchpoint.
//
// ⭐ Le funzioni sono ESTRATTE da index.html, non ricopiate.
//
// Uso:  node test/lezione-senza-maestro-non-parte.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(QUI, '..', 'index.html'), 'utf8');

function estrai(nome) {
  const inizio = html.indexOf(`function ${nome}(`);
  if (inizio < 0) throw new Error(`funzione «${nome}» non trovata in index.html`);
  let t = html.indexOf('(', inizio), tonde = 0;
  for (; t < html.length; t++) {
    if (html[t] === '(') tonde++;
    else if (html[t] === ')') { tonde--; if (tonde === 0) { t++; break; } }
  }
  let i = html.indexOf('{', t), livello = 0, stringa = null, prec = '';
  for (; i < html.length; i++) {
    const c = html[i], succ = html[i + 1];
    if (stringa) { if (c === stringa && prec !== '\\') stringa = null; }
    else if (c === '/' && succ === '/') { const fine = html.indexOf('\n', i); i = fine < 0 ? html.length : fine; prec = '\n'; continue; }
    else if (c === '/' && succ === '*') { const fine = html.indexOf('*/', i + 2); i = fine < 0 ? html.length : fine + 1; prec = '/'; continue; }
    else if (c === '"' || c === "'" || c === '`') stringa = c;
    else if (c === '{') livello++;
    else if (c === '}') { livello--; if (livello === 0) { i++; break; } }
    prec = c;
  }
  const asincrona = html.slice(Math.max(0, inizio - 6), inizio) === 'async ';
  return (asincrona ? 'async ' : '') + html.slice(inizio, i);
}

// Le regole di ripiego VERE del parser, prese dal file (non riscritte qui).
const iRegole = html.indexOf('const STAFF_CAL_FALLBACK_RULES');
const bloccoRegole = html.slice(iRegole, html.indexOf('\n  };', iRegole) + 5);

const ctx = {
  console: { info() {}, warn() {}, log() {}, error() {} },
  PARSER_RULES: null,
  logParserError: async () => {},
};
vm.createContext(ctx);
vm.runInContext([
  bloccoRegole,
  estrai('pmoNomeMaestroPlausibile'),
  estrai('staffCalParseBookingText'),
  estrai('staffCalSubmitSingle'),
].join('\n'), ctx);

const plausibile = ctx.pmoNomeMaestroPlausibile;
const leggi = (t) => ctx.staffCalParseBookingText(t, '2026-08-07');

// Chiede a staffCalSubmitSingle di partire e racconta com'è andata:
//   fermata=true  → la guardia l'ha rifiutata
//   inviata=true  → è arrivata oltre la guardia (poi esplode su altro: qui non c'è una rete)
async function provaAPartire(parsed) {
  let inviata = false;
  try {
    await ctx.staffCalSubmitSingle(parsed, { id: 'x' }, 'https://esempio', 'chiave',
      { onSent: function () { inviata = true; } });
    return { fermata: false, inviata, messaggio: '' };
  } catch (err) {
    const m = String((err && err.message) || err);
    return { fermata: /senza maestro/i.test(m), inviata, messaggio: m };
  }
}

const lezione = (extra = {}) => ({
  campoNum: 1, campo: 'Campo 1', data: '2026-08-07', ora: '19:30', oraFine: '20:30',
  durata: 60, tipo: 'lezione', istruttore: 'Santiago', nome: 'Sara Trentin',
  giocatori: [{ nome: 'Sara Trentin', codice: '1131' }], note: '',
  ...extra,
});

const casi = [];
const caso = (nome, fn) => casi.push({ nome, fn });

caso('1. 🚨 IL DIFETTO MISURATO: «lezione campo 1 …» non produce più il maestro «campo»', async () => {
  const r = leggi('lezione campo 1 19:30-20:30 Sara Trentin');
  return [!!r, r.tipo === 'lezione', !r.istruttore, r.nome === 'Sara Trentin'];
});

caso('2. un maestro VERO nel testo si legge ancora — la cura non ha spento la lettura', async () => {
  const a = leggi('lezione Santiago campo 1 18-19:30');
  const b = leggi('lezione Lucas Vidal campo 1 19:30-20:30');
  return [a.istruttore === 'Santiago', b.istruttore === 'Lucas Vidal'];
});

caso('3. ⭐⭐ la lezione senza maestro NON PARTE, e non è mai stata spedita', async () => {
  const r = await provaAPartire(lezione({ istruttore: '' }));
  // `inviata` false è la metà che conta: chi chiama distingue «non inviata» da «esito ignoto»
  // guardando proprio questo. Se la guardia stesse più in basso, l'app andrebbe a GUARDARE su
  // Matchpoint una prenotazione che non è mai uscita di qui.
  return [r.fermata === true, r.inviata === false];
});

caso('4. 🚨 nemmeno con un maestro FINTO: «campo» non è una persona', async () => {
  const r = await provaAPartire(lezione({ istruttore: 'campo' }));
  return [r.fermata === true, r.inviata === false];
});

caso('5. la lezione COL maestro passa la guardia (altrimenti avrei chiuso tutto, non curato)', async () => {
  const r = await provaAPartire(lezione({ istruttore: 'Santiago' }));
  return [r.fermata === false];
});

caso('6. la PARTITA non vuole nessun maestro: la guardia non la tocca', async () => {
  const r = await provaAPartire(lezione({ tipo: 'partita', istruttore: '' }));
  return [r.fermata === false];
});

caso('7. la MANUTENZIONE non vuole nessun maestro', async () => {
  const r = await provaAPartire(lezione({ tipo: 'manutenzione', istruttore: '', giocatori: [] }));
  return [r.fermata === false];
});

caso('8. «Lezione Libera» (il tipo come lo scrive Matchpoint) è comunque una lezione', async () => {
  const r = await provaAPartire(lezione({ tipo: 'Lezione Libera', istruttore: '' }));
  return [r.fermata === true];
});

caso('9. che cosa può essere un nome di maestro, e che cosa no', async () => {
  return [
    plausibile('Santiago') === true,
    plausibile('Lucas Vidal') === true,
    plausibile('LoZio') === true,
    plausibile("D'Ambrosio") === true,
    plausibile('campo') === false,          // il caso vero
    plausibile('Campo') === false,          // e la sua maiuscola
    plausibile('ogni') === false,
    plausibile('martedì') === false,        // «lezione ogni martedì …»
    plausibile('campo 1') === false,        // una parola buona non salva la frase
    plausibile('') === false,
    plausibile('   ') === false,
    plausibile(null) === false,
    plausibile(undefined) === false,
    plausibile(42) === false,
    plausibile('...') === false,
  ];
});

// ── GUARDIE SULLA BASE ──────────────────────────────────────────────────────────
const corpoPura = estrai('pmoNomeMaestroPlausibile');
const corpoSingle = estrai('staffCalSubmitSingle');
const corpoBooking = estrai('staffCalSubmitBooking');
const corpoParser = estrai('staffCalParseBookingText');

// 🚨 MISURATO: cercare l'ordine nel testo GREZZO dava rosso su codice giusto, perché il commento
// che spiega la guardia nomina `onSent` — e il commento viene prima della riga che chiama. Il
// controllo trovava la mia stessa prosa. Si cercano gli ATTI: i commenti si tolgono.
function senzaCommenti(src) {
  let out = '', stringa = null, prec = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i], succ = src[i + 1];
    if (stringa) { out += c; if (c === stringa && prec !== '\\') stringa = null; prec = c; continue; }
    if (c === '/' && succ === '/') { const f = src.indexOf('\n', i); i = f < 0 ? src.length : f; out += '\n'; prec = '\n'; continue; }
    if (c === '/' && succ === '*') { const f = src.indexOf('*/', i + 2); i = f < 0 ? src.length : f + 1; out += ' '; prec = ' '; continue; }
    if (c === '"' || c === "'" || c === '`') stringa = c;
    out += c; prec = c;
  }
  return out;
}
const codiceSingle = senzaCommenti(corpoSingle);
const iGuardia = codiceSingle.indexOf('pmoNomeMaestroPlausibile(');
// Tutti i modi in cui questa funzione può far partire qualcosa verso il mondo.
const iPrimoInvio = Math.min(...['fetch(', 'onSent', 'pmoWorkerFetch(']
  .map(s => { const k = codiceSingle.indexOf(s); return k < 0 ? Infinity : k; }));

const guardie = [
  ['la funzione pura esiste', !!corpoPura],
  // ⭐⭐ La guardia sta nel punto di CONVERGENZA, non su una schermata: è ciò che la rende
  // valida anche per la prossima strada di creazione che verrà aggiunta.
  ['staffCalSubmitSingle — il punto dove le tre strade convergono — la chiama', iGuardia >= 0],
  ['⭐ la chiama PRIMA di qualunque invio (altrimenti l\'esito diventa «ignoto», non «non inviata»)',
   iGuardia >= 0 && iGuardia < iPrimoInvio],
  ['anche la casella «Prenota» la chiama, per dirlo subito e una volta sola',
   corpoBooking.includes('pmoNomeMaestroPlausibile(')],
  ['il parser la usa invece di fidarsi del testo libero', corpoParser.includes('pmoNomeMaestroPlausibile(')],
  // 🚨 Il ripiego che generava il maestro «campo». Si cerca l'ATTO, non la parola: `|| rawIstr`
  // come ultima scelta della catena.
  ['non è rimasto il ripiego a occhi chiusi `|| rawIstr`', !/\|\|\s*rawIstr\s*;/.test(corpoParser)],
  ['è pura: non salva, non scrive, non tocca il DOM',
   !/\bsave\(|localStorage|\bwindow\.|document\.|fetch\(|pmoSyncCloudRecordsNow\(/.test(corpoPura)],
];

let passati = 0, falliti = 0;
console.log('BANCO — una lezione senza maestro non parte, e nessuno se ne inventa uno\n');
console.log('Guardie sulla base:');
guardie.forEach(([nome, ok]) => {
  console.log(`  ${ok ? '✅' : '❌'} ${nome}`);
  if (!ok) falliti++;
});
console.log('');
for (const c of casi) {
  let esiti;
  try { esiti = await c.fn(); } catch (err) { esiti = [false]; c.errore = err; }
  const ok = Array.isArray(esiti) && esiti.length > 0 && esiti.every(Boolean);
  if (ok) { passati++; console.log(`✅ ${c.nome}`); }
  else {
    falliti++;
    console.log(`❌ ${c.nome}`);
    if (c.errore) console.log(`   errore: ${c.errore.message}`);
    else console.log(`   controlli: [${esiti.map(v => v ? 'ok' : 'NO').join(', ')}]`);
  }
}
console.log(`\n— ${passati} passati, ${falliti} falliti su ${casi.length} casi —`);
process.exit(falliti ? 1 : 0);
