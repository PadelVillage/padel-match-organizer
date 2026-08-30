// ── BANCO: la pagina del quiz è una PORTA, non un modulo ─────────────────────────────
//
// 🗣️ Voce 97, terzo passo ② — 30/08/2026, autorizzato da lui: *«si partirà dal test di livello
//    fatto da dentro il bot»*, *«procedi pure secondo il tuo programma»*.
//
// 🚨 PERCHÉ ESISTE, e non è una formalità: quando la porta è stata chiusa, il banco è rimasto
//    VERDE. Nessuna prova sorvegliava `handleAssessmentPublicDeepLink` ⇒ la riga che chiude si
//    poteva togliere senza che niente diventasse rosso, e il modulo morto che le sta sotto è
//    ancora lì, intero, a un `return` di distanza dal tornare vivo.
//    📌 *Una cura che nessuna prova difende non è in servizio: è in attesa che qualcuno la
//    disfi per sbaglio.*
//
// ⚠️ QUESTE PROVE SONO TESTUALI, e si dichiara: leggono il sorgente di `index.html` invece di
//    eseguirlo. Il motivo è che quel ramo vive dentro il DOM (`document`, `URLSearchParams`, la
//    modalità pubblica) e ricostruirlo qui vorrebbe dire provare il finto. ⇒ Dicono «la
//    decisione è scritta», non «il socio vede la porta»: quello lo dice l'app viva, ed è la
//    prova fisica che sta nella scheda della voce 97.
//    🔒 E leggono il CODICE spogliato dai commenti: la lezione del 25/08 — una guardia che
//    legge i commenti vieta di spiegare la cosa che sorveglia.
//
// Uso:  node test/la-porta-del-quiz-e-chiusa.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const QUI = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(QUI, '..', 'index.html'), 'utf8');

let passati = 0, falliti = 0;
function caso(titolo, fn) {
  try { fn(); console.log('✅ ' + titolo); passati++; }
  catch (err) { console.log('❌ ' + titolo + '\n   → ' + (err && err.message || err)); falliti++; }
}
function esigi(condizione, messaggio) { if (!condizione) throw new Error(messaggio); }

/** Il corpo di una funzione, coi commenti tolti: si sorveglia il codice, non la prosa. */
function corpo(nome) {
  const inizio = HTML.indexOf(`function ${nome}(`);
  esigi(inizio >= 0, `funzione «${nome}» non trovata in index.html`);
  let i = HTML.indexOf('{', inizio), livello = 0, fine = -1, stringa = null, prec = '';
  for (; i < HTML.length; i++) {
    const c = HTML[i], succ = HTML[i + 1];
    if (stringa) { if (c === stringa && prec !== '\\') stringa = null; }
    else if (c === '/' && succ === '/') { const n = HTML.indexOf('\n', i); i = n < 0 ? HTML.length : n; prec = '\n'; continue; }
    else if (c === '/' && succ === '*') { const n = HTML.indexOf('*/', i + 2); i = n < 0 ? HTML.length : n + 1; prec = '/'; continue; }
    else if (c === '"' || c === "'" || c === '`') stringa = c;
    else if (c === '{') livello++;
    else if (c === '}') { livello--; if (livello === 0) { fine = i + 1; break; } }
    prec = c;
  }
  esigi(fine > 0, `corpo di «${nome}» non delimitato`);
  return HTML.slice(inizio, fine)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const DEEP = corpo('handleAssessmentPublicDeepLink');

caso('1. 🚪 chi arriva con un GETTONE trova la porta chiusa, non il modulo', () => {
  /* 🚨 È il cuore del terzo passo. Fino al 30/08 un indirizzo con `?t=…` componeva la scheda:
     quel ramo passava di qui SENZA fermarsi, e il commento lo diceva pure. */
  const chiude = DEEP.indexOf('assessmentPublicPortaChiusa()');
  esigi(chiude >= 0, 'nessuno chiama più la porta chiusa: la pagina ha riaperto il modulo');
  const componeIlModulo = DEEP.indexOf("getElementById('assessmentPublicForm')");
  esigi(componeIlModulo >= 0, 'il modulo non si trova più: è cambiata la forma, questa prova non sa più dove guardare');
  esigi(chiude < componeIlModulo,
    'la porta si chiude DOPO aver composto il modulo: chi ha un gettone vedrebbe ancora la scheda');
});

caso('2. 🚨 fra la porta e il modulo c\'è un RETURN, non una condizione', () => {
  /* ⚖️ Non basta che la chiusura venga prima: deve **uscire**. Con un `if` davanti, la riga
     resterebbe verde alla prova ① e il modulo si comporrebbe lo stesso per qualcun altro —
     ed è esattamente la forma che aveva prima (`if (isExternal && !token)`). */
  const dopo = DEEP.slice(DEEP.indexOf('assessmentPublicPortaChiusa()'));
  const ritorno = dopo.slice(0, dopo.indexOf("getElementById('assessmentPublicForm')"));
  esigi(/\breturn\s+true\s*;/.test(ritorno), 'dopo la porta chiusa non si esce: il modulo si compone lo stesso');
  esigi(!/\bif\s*\([^)]*\)\s*\{?\s*assessmentPublicPortaChiusa\(\)/.test(DEEP),
    'la chiusura è tornata sotto una condizione: qualcuno passerebbe ancora');
});

caso('3. 🗣️ la porta DICE dove si fa il test adesso — mai un vicolo cieco', () => {
  const carta = corpo('assessmentPublicPortaChiusa');
  esigi(/bot/i.test(carta), 'la porta non nomina il bot: chi ci arriva non sa dove andare');
  /* 🚨 NON basta che il nome della porta compaia da qualche parte: deve stare nell'ISTRUZIONE,
     cioè nella frase che dice al socio cosa toccare. Una prima stesura di questa prova cercava
     `Test Livello di Gioco` ovunque nel corpo, ed era verde anche col titolo in cima e
     l'istruzione tolta — cioè su una carta che dice «il test si fa altrove» e non dove.
     📌 *Una sonda che cerca una parola trova la parola; per provare un'istruzione bisogna
     cercare l'istruzione.*
     🔒 L'etichetta è scritta a mano qui e nella pagina, e si dichiara: il suo originale
     (`RIMANDO_LIVELLO`) vive nel repo del BOT, che questo non vede. È la stessa copia
     dichiarata di `ETICHETTA_SICURA`. ⇒ Se un domani la porta cambia nome, questa riga va
     mossa a mano, e questo commento è il posto dove qualcuno lo scoprirà. */
  esigi(/Apri[^']*«[^»]*Test Livello di Gioco»/.test(carta),
    'non c\'è l\'istruzione «Apri «📊 Test Livello di Gioco»»: la carta dice che è altrove, non dove');
  esigi(/segreteria/i.test(carta), 'manca la via d\'uscita che c\'è sempre');
  /* 🚨 E non deve promettere quello che non c'è più: il «link personale che ti arriva per
     e-mail» era vero fino a stamattina e adesso manderebbe la gente ad aspettare una mail
     che nessuno spedisce. 📏 Misurato: ultimo invio 23/06, 132 dei 133 senza indirizzo. */
  esigi(!/e-?mail/i.test(carta), 'la porta promette ancora una e-mail: nessuna parte da giugno');
});

console.log(`\n— ${passati} passati, ${falliti} falliti su ${passati + falliti} casi —`);
process.exit(falliti ? 1 : 0);
