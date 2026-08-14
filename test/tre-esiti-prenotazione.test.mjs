// ── BANCO: «gli esiti sono TRE, e il terzo non si arrotonda al secondo» ──────────
//
// Voce 23. Che cosa prova: che una prenotazione il cui esito è IGNOTO — la richiesta al worker
// non ha mai ricevuto risposta — non venga raccontata come «fallita». Se lo fosse, l'operatore
// la rifarebbe, e se la prima era passata il campo resterebbe prenotato DUE VOLTE sul sistema
// del circolo. Sulla strada del ricorrente, che ne crea fino a quattro di fila, moltiplicato.
//
// ⭐ Le due metà si provano ENTRAMBE, perché il difetto viveva a cavallo:
//     · la EDGE decide come chiamare l'esito  → modulo `esito-prenotazione.js`, IMPORTATO
//     · l'APP lo legge e ci fa qualcosa       → `staffCalPollJob`, ESTRATTA da index.html
//
// 🚨 Perché un modulo e non un'estrazione a fette: la lezione del 14/08 (voce 27). Un banco che
//    ritaglia il sorgente cercando marcatori misura il ritaglio, non il codice. Qui la regola
//    dell'edge è un modulo vero e questo file lo importa: se cambia, il banco lo sa.
//
// ⛔ Quello che questo banco NON può provare, e va detto: che il worker vero, caduto sul serio,
//    faccia arrivare qui un errore marchiato. Quel pezzo vive su Hetzner, il worker è UNO e
//    condiviso TEST+PROD, e da una sessione cloud non si tocca. Il banco prova la DECISIONE e il
//    CABLAGGIO — cioè tutto ciò che è nostro — non la caduta della rete.
//
// Uso:  node test/tre-esiti-prenotazione.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const MODULO = join(QUI, '..', 'supabase', 'functions', 'matchpoint-bookings-create', 'esito-prenotazione.js');
const { esitoIgnoto, erroreEsitoIgnoto, decidiEsitoDelLavoro, codiceDiRifiuto } = await import(MODULO);

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

// L'app vera, con l'orologio corto: è lo STESSO codice, non una riscrittura.
let riposte = [];
const ctx = {
  console: { info() {}, warn() {}, log() {}, error() {} },
  setTimeout: (fn) => fn(),                       // niente attese vere
  Date, JSON, Math, String, Number, encodeURIComponent,
  _STAFF_CAL_POLL: { maxMs: 5000, stepMs: 1, lateMaxMs: 5000, lateStepMs: 1 },
  pmoAssorbiIdInterniMatchpoint() {},
  fetch: async () => {
    const corpo = riposte.length > 1 ? riposte.shift() : riposte[0];
    return { text: async () => JSON.stringify(corpo) };
  },
};
vm.createContext(ctx);
vm.runInContext(estrai('staffCalPollJob'), ctx);
const chiedi = (...c) => { riposte = c; return ctx.staffCalPollJob('J1', { accessToken: 't' }, 'https://x', 'k', null); };

const casi = [];
const caso = (nome, fn) => casi.push({ nome, fn });

// ── la EDGE: come si chiama ciò che è successo ───────────────────────────────
caso('1. 🚨 IL DIFETTO: nessuna risposta dal worker ⇒ «unknown», NON «error»', () => {
  const e = decidiEsitoDelLavoro(erroreEsitoIgnoto('Worker network error: fetch failed'), 'Partita');
  return [e.status === 'unknown', /Controlla su Matchpoint prima di rifarla/.test(e.message || '')];
});

caso('2. il messaggio porta l\'ISTRUZIONE, non solo la constatazione', () => {
  const e = decidiEsitoDelLavoro(erroreEsitoIgnoto('x'), 'Lezione');
  // Deve dire cosa fare PRIMA di rifarla: è l'unica riga che impedisce il doppione.
  return [/lezione/.test(e.message), /prima di rifarla/i.test(e.message), /potrebbe essere stata creata/.test(e.message)];
});

caso('3. ⭐ CONTROLLO NEGATIVO: un RIFIUTO del worker resta «error»', () => {
  // Un rifiuto è una risposta: l'esito è NOTO e chiamarlo ignoto manderebbe l'operatore a
  // guardare su Matchpoint per niente, ogni volta.
  const e = decidiEsitoDelLavoro(new Error('Worker error 400: campo occupato'), 'Partita');
  return [e.status === 'error', e.message === undefined];
});

caso('4. 🚨⭐⭐ CONTROLLO NEGATIVO che vale doppio: le PAROLE non contano, conta il MARCHIO', () => {
  // Un errore che PARLA di rete ma non è marchiato deve restare «error». Riconoscere l'ignoto
  // cercando «network» nel testo sarebbe lo stesso setaccio a maglie larghe della voce 36, dove
  // sette dispatcher finirono fra le «letture» perché non contenevano la parola `insert`.
  const finto = new Error('Worker error 500: network timeout upstream');
  return [esitoIgnoto(finto) === false, decidiEsitoDelLavoro(finto, 'Partita').status === 'error'];
});

caso('5. robustezza: null, stringhe e oggetti nudi non fanno esplodere la decisione', () => {
  return [
    decidiEsitoDelLavoro(null, 'Partita').status === 'error',
    decidiEsitoDelLavoro('caduto', 'Partita').status === 'error',
    decidiEsitoDelLavoro({}, 'Partita').status === 'error',
    esitoIgnoto(undefined) === false,
  ];
});

caso('6. la strada SINCRONA (il ricorrente) distingue col CODICE, non col testo', () => {
  return [
    codiceDiRifiuto(erroreEsitoIgnoto('x')) === 'WORKER_ESITO_IGNOTO',
    codiceDiRifiuto(new Error('rifiutata')) === 'WORKER_ERROR',
  ];
});

// ── l'APP: cosa ne fa ────────────────────────────────────────────────────────
caso('7. ⭐⭐ l\'app RICONOSCE «unknown» e si ferma subito, con la ragione', async () => {
  const r = await chiedi({ status: 'unknown', message: 'Non ho ricevuto risposta dal gestionale.' });
  // Non basta che finisca sulla strada giusta: deve portarsi dietro il PERCHÉ. Senza, chi guarda
  // legge «non ha ancora risposto» — che è un'altra cosa e non dice di controllare su Matchpoint.
  return [r.status === 'unknown', /non ho ricevuto risposta/i.test(r.error || '')];
});

caso('8. CONTROLLO NEGATIVO: «done» ed «error» non sono stati contagiati', async () => {
  const a = await chiedi({ status: 'done', message: 'ok' });
  const b = await chiedi({ status: 'error', error: 'campo occupato' });
  return [a.status === 'done', b.status === 'error', b.error === 'campo occupato'];
});

caso('9. CONTROLLO NEGATIVO: «pending» continua a chiedere e arriva a «done»', async () => {
  const r = await chiedi({ status: 'pending' }, { status: 'pending' }, { status: 'done', message: 'ok' });
  return [r.status === 'done'];
});

caso('10. uno stato SCONOSCIUTO non blocca: degrada a timeout, cioè a esito ignoto', async () => {
  // È la rete di sicurezza per un'app vecchia contro una edge nuova, e viceversa.
  const r = await chiedi({ status: 'boh-nuovo-domani' });
  return [r.status === 'timeout'];
});

let falliti = 0;
for (const c of casi) {
  let esiti;
  try { esiti = await c.fn(); } catch (e) { esiti = [false]; c.nome += ` — ECCEZIONE: ${e.message}`; }
  const ok = Array.isArray(esiti) && esiti.length > 0 && esiti.every(Boolean);
  if (!ok) falliti++;
  console.log(`${ok ? '✅' : '❌'} ${c.nome}${ok ? '' : `  → ${JSON.stringify(esiti)}`}`);
}
console.log(`\n— ${casi.length - falliti}/${casi.length} —`);
process.exit(falliti ? 1 : 0);
