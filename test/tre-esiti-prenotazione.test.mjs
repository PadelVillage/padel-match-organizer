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
const {
  esitoIgnoto, erroreEsitoIgnoto, decidiEsitoDelLavoro, codiceDiRifiuto, chiusuraDelLavoroIgnoto,
  esitoDellaRispostaWorker, salvataggioTentato, CODICI_FALLIMENTO_CERTO,
} = await import(MODULO);

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

// ── LA CHIUSURA del lavoro rimasto ignoto (residuo della voce 23, 15/08) ─────
// Il lavoro finiva `unknown` nel database e ci restava PER SEMPRE, anche dopo che l'app era
// andata a guardare su Matchpoint e aveva saputo com'era andata. Qui si prova la decisione, non
// il fatto che il codice la contenga: il modulo si importa, come per tutto il resto di sopra.

// Quello che fa `writeBookingJob` quando scrive la riga: serve al controllo negativo del caso 16.
const comeScriveLaRiga = (status, extra) => ({ status, updated_at: 'ADESSO', ...extra });

const LAVORO_IGNOTO = {
  status: 'unknown',
  updated_at: '2026-08-15T09:00:00.000Z',
  error: 'Worker network error: fetch failed',
  booking: { campo: 4, data: '2026-08-17', ora: '19:00' },
  created_by_email: 'staff@padelvillage.club',
};

caso('11. ⭐ un lavoro IGNOTO si chiude col verdetto «si»: diventa «done»', () => {
  const c = chiusuraDelLavoroIgnoto(LAVORO_IGNOTO, 'si', { tentativi: 3, quando: 'Q' });
  return [c.chiudibile === true, c.status === 'done', c.payload.verdetto === 'si', c.payload.tentativi_verifica === 3];
});

caso('12. e col verdetto «no» diventa «error», con scritto cosa si è ANDATI A VEDERE', () => {
  const c = chiusuraDelLavoroIgnoto(LAVORO_IGNOTO, 'no', {});
  return [c.status === 'error', /verificato guardando/i.test(c.payload.error), /NON c/.test(c.payload.message)];
});

caso('13. 🚨 CONTROLLO NEGATIVO: un esito GIÀ NOTO non si riscrive', () => {
  // È la parola del worker, che la cosa l'ha vista da vicino. L'app ha guardato il calendario da
  // fuori: se potesse sovrascriverla, questa cura diventerebbe un modo nuovo di dire il falso.
  const a = chiusuraDelLavoroIgnoto({ status: 'done' }, 'no', {});
  const b = chiusuraDelLavoroIgnoto({ status: 'error', error: 'campo occupato' }, 'si', {});
  const c = chiusuraDelLavoroIgnoto({ status: 'pending' }, 'si', {});
  return [
    a.chiudibile === false, a.motivo === 'NON_IGNOTO', a.payload === null,
    b.chiudibile === false, c.chiudibile === false,
  ];
});

caso('14. 🚨 il TERZO verdetto non chiude niente: «boh» non è un sì e non è un no', () => {
  // Un «non lo so» che chiude un lavoro sarebbe il terzo esito arrotondato al secondo — cioè il
  // difetto che tutta questa voce esiste per togliere, rifatto un piano più in là.
  return [
    chiusuraDelLavoroIgnoto(LAVORO_IGNOTO, 'boh', {}).chiudibile === false,
    chiusuraDelLavoroIgnoto(LAVORO_IGNOTO, '', {}).motivo === 'VERDETTO_NON_VALIDO',
    chiusuraDelLavoroIgnoto(LAVORO_IGNOTO, undefined, {}).chiudibile === false,
  ];
});

caso('15. il COSA si conserva, e l\'errore di allora cambia NOME invece di sparire', () => {
  // Una riga di stato che perde la prenotazione non serve a chi la legge; ma lasciare `error` su
  // un lavoro chiuso con «si» direbbe «non è stata creata», che è falso.
  const c = chiusuraDelLavoroIgnoto(LAVORO_IGNOTO, 'si', { quando: 'Q' });
  return [
    c.payload.booking.campo === 4,
    c.payload.created_by_email === 'staff@padelvillage.club',
    c.payload.errore_iniziale === 'Worker network error: fetch failed',
    c.payload.error === undefined,
    c.payload.chiusa_da === 'verifica-app',
  ];
});

caso('16. 🚨⭐⭐ CONTROLLO NEGATIVO: `status` e `updated_at` NON tornano dentro dal payload vecchio', async () => {
  // La trappola vera di questa modifica, e non si vede leggendo: chi scrive la riga mette
  // `{ status, updated_at, ...extra }`, quindi un `status` rimasto nel payload copiato
  // SOVRASCRIVEREBBE quello nuovo — il lavoro resterebbe `unknown` avendo risposto «chiuso».
  // Una bugia nuova al posto di quella tolta, e con l'aria di aver funzionato.
  const c = chiusuraDelLavoroIgnoto(LAVORO_IGNOTO, 'si', { quando: 'Q' });
  const riga = comeScriveLaRiga(c.status, c.payload);
  // E il sabotaggio che lo dimostra: rimettendoceli, questo stesso caso diventa rosso.
  const sabotata = comeScriveLaRiga(c.status, { ...c.payload, status: 'unknown', updated_at: 'VECCHIO' });
  return [
    riga.status === 'done', riga.updated_at === 'ADESSO',
    'status' in c.payload === false, 'updated_at' in c.payload === false,
    sabotata.status === 'unknown',   // ⇐ il sabotaggio fa esattamente il danno descritto
  ];
});

caso('17. robustezza: un payload nullo o storto non fa esplodere la decisione', () => {
  return [
    chiusuraDelLavoroIgnoto(null, 'si', {}).chiudibile === false,
    chiusuraDelLavoroIgnoto(undefined, 'si', {}).motivo === 'NON_IGNOTO',
    chiusuraDelLavoroIgnoto('unknown', 'si', {}).chiudibile === false,
    chiusuraDelLavoroIgnoto({ status: 'unknown' }, 'si', undefined).chiudibile === true,
  ];
});

// ── ⚖️ VOCE 72 (22/08/2026): quando un RIFIUTO del worker non è un fallimento ────────────────
// Il terzo esito nasceva in un punto solo — la `fetch` che non riceve risposta. Ma il worker sa
// rifiutare anche **senza sapere com'è finita**: il timeout della sua coda smette di aspettare
// un'operazione che sta ancora andando, e il click su «Salvare» può essere già partito.
// ⇒ Qui si prova la regola che li separa. Il verso in cui deve sbagliare è UNO: verso l'ignoto.

caso('18. 🚨🚨 IL DIFETTO DELLA 72: il TIMEOUT DELLA CODA non è un fallimento, è un ignoto', () => {
  // È il caso vero: `Promise.race` ha smesso di aspettare, Playwright no. Se il click su
  // «Salvare» era già partito, la prenotazione sul sistema del circolo C'È — e chiamarla
  // «rifiutata» manda il socio a rifarla, cioè a occupare il campo due volte.
  const corpo = { ok: false, error: 'QUEUE_JOB_TIMEOUT', message: 'Operazione "prenotazione · partita · Campo 2 · 19:00" oltre 180s: annullata per non bloccare la coda.' };
  return [esitoDellaRispostaWorker(corpo) === 'ignoto'];
});

caso('19. ⭐ CONTROLLO POSITIVO: i rifiuti che il worker SA di dare restano certi', () => {
  // Senza questo caso la cura sarebbe «chiama tutto ignoto», che toglie il danno insieme
  // all'utilità: il socio aspetterebbe un quarto d'ora per sapere che il campo era occupato.
  return [
    esitoDellaRispostaWorker({ error: 'SLOT_NOT_FREE' }) === 'certo',
    esitoDellaRispostaWorker({ error: 'INVALID_DATA' }) === 'certo',
    esitoDellaRispostaWorker({ error: 'FICHA_FORM_NOT_VISIBLE' }) === 'certo',
    esitoDellaRispostaWorker({ error: 'TABELLONE_CELL_NOT_FOUND' }) === 'certo',
    esitoDellaRispostaWorker({ error: 'WORKER_UNAUTHORIZED' }) === 'certo',
    // Il worker si ferma APPOSTA prima di salvare quando il giocatore non si è agganciato.
    esitoDellaRispostaWorker({ error: 'PLAYER_ADD_INCOMPLETE' }) === 'certo',
  ];
});

caso('20. 🚨⭐⭐ LA CREPA DENTRO «SAVE_BUTTON_NOT_FOUND»: lo stesso codice racconta due fatti opposti', () => {
  // `clickFormSave` prova i selettori in fila. Se un click PARTE e poi fallisce — l'elemento si
  // stacca perché la pagina sta già navigando, cioè proprio quando il salvataggio è riuscito —
  // l'errore va da parte, il ciclo continua, e finisce con «bottone non trovato».
  // ⇒ Senza questa distinzione l'elenco dei codici certi direbbe una bugia in un caso su due.
  const nessunBottone = { error: 'SAVE_BUTTON_NOT_FOUND', diagnostic: { navigationAttempts: [] } };
  const premutoEPoiBoh = { error: 'SAVE_BUTTON_NOT_FOUND', diagnostic: { navigationAttempts: [
    { action: 'save_attempt', sel: '#CC_Datos_FormViewFicha_ButtonInsertarYSalir', error: 'Element is not attached to the DOM' },
  ] } };
  return [
    esitoDellaRispostaWorker(nessunBottone) === 'certo',
    esitoDellaRispostaWorker(premutoEPoiBoh) === 'ignoto',
    salvataggioTentato(premutoEPoiBoh.diagnostic) === true,
    salvataggioTentato(nessunBottone.diagnostic) === false,
    // Il caso misurato il 19/08 (fallimento CERTO, la prenotazione non è mai esistita) resta certo.
    esitoDellaRispostaWorker({ error: 'SAVE_BUTTON_NOT_FOUND' }) === 'certo',
  ];
});

caso('21. 🚨⭐ FALLISCE CHIUSA: un codice che nessuno ha ancora scritto cade nell\'IGNOTO', () => {
  // ⚖️ È il verso deliberato dell'elenco: si elencano i CERTI, non gli ignoti. Un elenco al
  // contrario lascerebbe passare per «non è passata» ogni guasto futuro — e il guasto futuro è
  // esattamente quello di cui non si sa niente.
  // 🧨 E il sabotaggio che lo mostra: se la regola tornasse 'certo' sul codice sconosciuto,
  //    questo caso diventerebbe rosso, e con lui il timeout del 18.
  const sconosciuto = esitoDellaRispostaWorker({ error: 'BROWSER_DISCONNECTED_DOMANI' });
  const alContrario = (c) => (c === 'QUEUE_JOB_TIMEOUT' ? 'ignoto' : 'certo'); // ⇐ l'elenco sbagliato
  return [
    sconosciuto === 'ignoto',
    esitoDellaRispostaWorker({ error: '' }) === 'ignoto',
    esitoDellaRispostaWorker({}) === 'ignoto',
    alContrario('BROWSER_DISCONNECTED_DOMANI') === 'certo', // ⇐ il danno che l'elenco al contrario farebbe
  ];
});

caso('22. robustezza: un corpo nullo, storto o senza diagnostic non fa esplodere la decisione', () => {
  return [
    esitoDellaRispostaWorker(null) === 'ignoto',
    esitoDellaRispostaWorker('QUEUE_JOB_TIMEOUT') === 'ignoto',
    esitoDellaRispostaWorker({ error: 'slot_not_free' }) === 'certo',     // minuscolo: stesso codice
    esitoDellaRispostaWorker({ error: ' SLOT_NOT_FREE ' }) === 'certo',   // con spazi
    salvataggioTentato(null) === false,
    salvataggioTentato({ navigationAttempts: 'boh' }) === false,
    salvataggioTentato({ navigationAttempts: [null, 'x', {}] }) === false,
  ];
});

caso('23. il CABLAGGIO: dall\'ignoto nuovo esce lo stesso codice del vecchio', () => {
  // Se `esitoDellaRispostaWorker` dice «ignoto», l'edge deve fabbricare l'errore MARCHIATO — cioè
  // finire nella macchina che esiste già (voce 23 + voce 53), non in una strada nuova accanto.
  const e = erroreEsitoIgnoto('Worker error 500: QUEUE_JOB_TIMEOUT');
  return [
    esitoIgnoto(e) === true,
    codiceDiRifiuto(e) === 'WORKER_ESITO_IGNOTO',
    decidiEsitoDelLavoro(e, 'Partita').status === 'unknown',
    CODICI_FALLIMENTO_CERTO.has('QUEUE_JOB_TIMEOUT') === false,
  ];
});


caso('24. 🔌 IL CABLAGGIO NELL\'EDGE: la regola non basta scriverla, bisogna che qualcuno la chiami', () => {
  // ⚠️ Questo caso legge il SORGENTE, e va detto perché è l'eccezione: `callWorkerCreateBooking`
  // è TypeScript per Deno e da Node non si esegue. ⇒ Prova che la chiamata **c'è**, non che
  // succeda — che è meno di quanto valga per il resto di questo file, ma è tutto ciò che si può
  // avere qui, e vale comunque: senza, la regola più giusta del mondo resta un modulo che
  // nessuno importa. La prova che manca la dà il sabotaggio (`test/sabotaggi-voce-72.mjs`).
  const edge = readFileSync(join(QUI, '..', 'supabase', 'functions', 'matchpoint-bookings-create', 'index.ts'), 'utf8');
  return [
    /import\s*\{[^}]*esitoDellaRispostaWorker[^}]*\}\s*from\s*'\.\/esito-prenotazione\.js'/s.test(edge),
    // Chiamata E conseguenza: il ramo 'ignoto' deve fabbricare l'errore MARCHIATO, se no
    // finisce nella strada di prima con un nome nuovo.
    /esitoDellaRispostaWorker\([^)]*\)\s*===\s*'ignoto'\s*\)\s*throw\s+erroreEsitoIgnoto\(/.test(edge),
  ];
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
