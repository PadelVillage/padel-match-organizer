// ── BANCO: «chi aspetta il maestro», la lista della voce 98 ──────────────────────
//
// Che cosa prova: `assessmentAspettaIlMaestro` (chi va nella lista) e
// `pmoProssimaVoltaInCampo` (quando andarlo a guardare), estratte da `index.html`.
//
// 🚨⭐⭐ IL CASO 2 È IL MOTIVO PER CUI QUESTA FUNZIONE NON È UN `>` E BASTA, ed è misurato su
//    PROD il 26/08/2026 sul test fatto dal committente: dimostrato **4**, in scheda **4**. Per
//    lui non c'è niente da certificare — il livello è già quello — e una lista che lo mostrasse
//    manderebbe il maestro a fare un lavoro già fatto. ⇒ Il criterio non è «ha dimostrato sopra
//    il tetto», è «ha dimostrato più di quello che ha in scheda».
//
// 🚨 E IL CASO 7 È L'ALTRO: al maestro serve sapere quando quella persona GIOCA, non quando ha
//    prenotato. `playerFutureBookingsCount`, che c'era già, guarda solo `p.giocatore` — cioè
//    l'organizzatore. Chi è stato invitato da un altro sta solo dentro `p.giocatori`, e cercare
//    nel posto sbagliato manda il maestro a guardare la partita di qualcun altro.
//
// ⛔ Quello che questo banco NON prova: che la riga si VEDA nell'elenco soci. Quella è una
//    prova fisica e si fa aprendo il gestionale — qui si prova la regola, non il disegno.
//
// ⭐ Le funzioni sono ESTRATTE da index.html, non ricopiate: un banco che prova una copia
//    prova la copia.
//
// Uso:  node test/lista-per-il-maestro.test.mjs
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
  // I commenti si saltano: in italiano sono pieni di apostrofi, e ognuno preso per un apice
  // sballa il conteggio delle graffe tirandosi dentro le funzioni successive.
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
  return html.slice(inizio, i);
}

// ⭐ Il tetto si LEGGE dal sorgente: ricopiarlo qui vorrebbe dire che il banco resta verde
//    anche il giorno in cui l'app ne usa un altro — proverebbe la propria copia.
const TETTO = Number((html.match(/const PMO_TETTO_MAESTRO = ([0-9.]+);/) || [])[1]);
if (!Number.isFinite(TETTO)) throw new Error('PMO_TETTO_MAESTRO non trovato in index.html');

// 🆕 27/08 mattina — la SCALA si estrae anche lei: `assessmentAspettaIlMaestro` ora confronta
//    le FASCE (stessa parola ⇒ niente da certificare — il caso di Maurizio, 4 → 4,5), e le
//    parole le dà `pmoLivelloFascia`, che legge `PMO_LIVELLI`. Ricopiare la tabella qui
//    proverebbe la copia, non l'app.
function estraiConst(nome) {
  const inizio = html.indexOf(`const ${nome} = [`);
  if (inizio < 0) throw new Error(`costante «${nome}» non trovata in index.html`);
  const fine = html.indexOf('];', inizio);
  if (fine < 0) throw new Error(`costante «${nome}» senza chiusura in index.html`);
  return html.slice(inizio, fine + 2);
}

// Le poche cose dell'app che le due funzioni usano. Sono pezzi banali e si dichiarano tali:
// il loro comportamento vero è provato altrove, qui servono solo a far girare la regola.
const base = `
  function normalizeText(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
  function cleanCell(v) { return String(v == null ? '' : v).trim(); }
  function playerFullName(g) { return [g && g.firstName, g && g.surname].filter(Boolean).join(' ').trim(); }
  function samePlayerName(a, b) { return normalizeText(a) === normalizeText(b) && normalizeText(a) !== ''; }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function isDateBetween(data, da, a) {
    const t = new Date(String(data || '') + 'T00:00').getTime();
    return Number.isFinite(t) && t >= da.getTime() && t <= a.getTime();
  }
  // 🚨 var e non let, ed è la differenza fra un banco che prova e uno che finge: dentro vm
  //    una let NON diventa una proprietà del contesto, quindi assegnare ctx.prenotazioni
  //    creerebbe un'ALTRA variabile e le funzioni continuerebbero a leggere l'array vuoto.
  //    Con la prima stesura cinque casi erano rossi e uno era VERDE per il motivo sbagliato
  //    (tornava null perché non vedeva nessuna scheda, non perché la regola funzionasse).
  var assessmentResponses = [];
  var prenotazioni = [];
  function assessmentMemberResponses(member) {
    return (assessmentResponses || []).filter(r => String(r.applied_member_id || '') === String(member && member.id));
  }
`;

const ctx = { console: { info() {}, warn() {}, log() {}, error() {} } };
vm.createContext(ctx);
vm.runInContext([
  base,
  `const PMO_TETTO_MAESTRO = ${TETTO};`,
  estraiConst('PMO_LIVELLI'),
  estrai('assessTxt'),
  estrai('pmoLivelloFascia'),
  estrai('pmoLivelloDefinizione'),
  estrai('assessmentUltimaScheda'),
  estrai('assessmentAspettaIlMaestro'),
  estrai('pmoProssimaVoltaInCampo'),
  estrai('pmoQuandoGiocaEtichetta'),
].join('\n'), ctx);

const socio = (level, extra = {}) => ({ id: 'S1', firstName: 'Maurizio', surname: 'Aprea', level, ...extra });
const scheda = (calcolato, extra = {}) => ({
  applied_member_id: 'S1',
  submitted_at: '2026-08-26T08:27:43Z',
  declared_level: '4.5',
  calculated_level: String(calcolato),
  raw_response: { knowledge: { status: 'pass' } },
  ...extra,
});
const conSchede = (rows) => { ctx.assessmentResponses = rows; };
const conPrenotazioni = (rows) => { ctx.prenotazioni = rows; };
const fraGiorni = (n) => {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const casi = [];
const caso = (nome, fn) => casi.push({ nome, fn });

// ── CHI VA IN LISTA ──────────────────────────────────────────────────────────
caso('1. dimostra sopra il tetto e in scheda ha il tetto ⇒ ASPETTA il maestro', () => {
  conSchede([scheda(4)]);
  const r = ctx.assessmentAspettaIlMaestro(socio(TETTO));
  return [!!r, r && r.dimostrato === 4, r && r.inScheda === TETTO];
});

caso('2. 🚨 dimostra 4 e in scheda ha GIÀ 4 ⇒ non aspetta nessuno (il caso vero del 26/08)', () => {
  // ⚖️ Il livello è già quello: chiederlo al maestro sarebbe chiedergli un lavoro già fatto.
  conSchede([scheda(4)]);
  return [ctx.assessmentAspettaIlMaestro(socio(4)) === null];
});

caso('3. dimostra ESATTAMENTE il tetto ⇒ non c\'è niente da certificare', () => {
  conSchede([scheda(TETTO)]);
  return [ctx.assessmentAspettaIlMaestro(socio(2)) === null];
});

caso('4. il quiz FALLITO non manda nessuno dal maestro', () => {
  // A chi lo fallisce la promessa del maestro non è mai uscita: metterlo in lista
  // significherebbe far certificare qualcuno a cui non abbiamo promesso niente.
  conSchede([scheda(5, { raw_response: { knowledge: { status: 'fail' } } })]);
  return [ctx.assessmentAspettaIlMaestro(socio(2)) === null];
});

caso('5. senza nessuna scheda non si aspetta niente', () => {
  conSchede([]);
  return [ctx.assessmentAspettaIlMaestro(socio(2)) === null];
});

caso('6. 🚨 conta solo l\'ULTIMA scheda, o la coda non si svuoterebbe mai', () => {
  // Una prova di aprile che diceva Agonista non deve tenere in lista chi a agosto ha
  // risposto da Base: sarebbe una lista che cresce e non cala.
  conSchede([
    scheda(5, { submitted_at: '2026-04-01T10:00:00Z' }),
    scheda(2, { submitted_at: '2026-08-26T08:27:43Z' }),
  ]);
  return [ctx.assessmentAspettaIlMaestro(socio(2)) === null];
});

caso('7. chi non ha ancora nessun livello e dimostra sopra il tetto ci va lo stesso', () => {
  conSchede([scheda(4.5)]);
  const r = ctx.assessmentAspettaIlMaestro(socio(''));
  return [!!r, r && r.inScheda === null];
});

// 🆕 27/08 mattina — LA STESSA FASCIA NON VA IN LISTA (il rovescio è documentato nel caso
// 1ter, che affermava il contrario ed è stato rovesciato su sua parola).
caso('14. ⚖️ in scheda 3,5 e dimostra 4,5 — la parola è nuova ⇒ resta in lista', () => {
  conSchede([scheda(4.5)]);
  const r = ctx.assessmentAspettaIlMaestro(socio(3.5));
  return [!!r, r && r.dimostrato === 4.5, r && r.inScheda === 3.5];
});

caso('15. 🚨 SABOTAGGIO: col solo confronto sui numeri il caso 13 metterebbe Maurizio in lista', () => {
  // Si rifà a mano la regola di ieri — `dimostrato > inScheda` e basta — e si pretende un
  // esito diverso: è dove ci si accorge se qualcuno «semplifica» via il confronto delle fasce.
  conSchede([scheda(4.5)]);
  const vero = ctx.assessmentAspettaIlMaestro(socio(4));
  const soloINumeri = 4.5 > 4;
  return [vero === null, soloINumeri === true];
});

// ── QUANDO ANDARLO A GUARDARE ────────────────────────────────────────────────
caso('8. 🚨 la prossima volta IN CAMPO vale anche se l\'ha prenotata QUALCUN ALTRO', () => {
  // È il difetto che `playerFutureBookingsCount` avrebbe portato dentro: guarda solo
  // `p.giocatore`, cioè chi ha prenotato.
  conPrenotazioni([
    { data: fraGiorni(3), ora: '19:00', giocatore: 'Lidia Rossi', giocatori: [{ nome: 'Lidia Rossi' }, { nome: 'Maurizio Aprea' }] },
  ]);
  const p = ctx.pmoProssimaVoltaInCampo(socio(TETTO));
  return [!!p, p && p.ora === '19:00'];
});

caso('9. fra due partite si sceglie la PRIMA, e a parità di giorno la più presto', () => {
  conPrenotazioni([
    { data: fraGiorni(5), ora: '09:00', giocatore: 'Maurizio Aprea', giocatori: [] },
    { data: fraGiorni(2), ora: '21:00', giocatore: 'Maurizio Aprea', giocatori: [] },
    { data: fraGiorni(2), ora: '08:00', giocatore: 'Maurizio Aprea', giocatori: [] },
  ]);
  const p = ctx.pmoProssimaVoltaInCampo(socio(TETTO));
  return [!!p, p && p.data === fraGiorni(2), p && p.ora === '08:00'];
});

caso('10. le partite PASSATE non contano, e nemmeno quelle oltre i 30 giorni', () => {
  conPrenotazioni([
    { data: fraGiorni(-2), ora: '19:00', giocatore: 'Maurizio Aprea', giocatori: [] },
    { data: fraGiorni(45), ora: '19:00', giocatore: 'Maurizio Aprea', giocatori: [] },
  ]);
  return [ctx.pmoProssimaVoltaInCampo(socio(TETTO)) === null];
});

caso('11. la partita di un OMONIMO parziale non è la sua', () => {
  conPrenotazioni([
    { data: fraGiorni(1), ora: '19:00', giocatore: 'Maurizio Apreanti', giocatori: [{ nome: 'Maurizio Apreanti' }] },
  ]);
  return [ctx.pmoProssimaVoltaInCampo(socio(TETTO)) === null];
});

caso('12. senza data non si inventa un\'etichetta', () => {
  return [
    ctx.pmoQuandoGiocaEtichetta(null) === '',
    ctx.pmoQuandoGiocaEtichetta({ data: '' }) === '',
    ctx.pmoQuandoGiocaEtichetta({ data: 'non-una-data' }) === '',
    /alle 19:00$/.test(ctx.pmoQuandoGiocaEtichetta({ data: fraGiorni(1), ora: '19:00' })),
  ];
});

// ── 🔄🗣️ 27/08: IL CRITERIO SI È ALLARGATO, e questi casi ieri sarebbero stati ROSSI ──
// 🗣️ Sua decisione, dopo la sua domanda della sera (*«chi è come livello avanzato e facendo il
// test risulta agonista, come risponde il bot?»*): **«si allarga la lista»**.
// 🚨 La riga vecchia era `inScheda > TETTO → null`, e aveva una ragione vera dietro (il caso 2).
// Ma escludeva anche chi ha 4 e dimostra 5 — che dal 27/08 riceve pure il messaggio che lo manda
// in segreteria dal maestro: si presentava al circolo, e in Anagrafica non c'era niente.
// ⇒ Il criterio non è più DOVE STA il socio, è QUANTO HA DIMOSTRATO IN PIÙ.

caso('1bis. 🚨🔄 in scheda ha 4 e dimostra AGONISTA (5) ⇒ ADESSO aspetta il maestro', () => {
  // Ieri questo caso tornava `null`, ed è il difetto che la voce 100 è nata per curare.
  conSchede([scheda(5)]);
  const r = ctx.assessmentAspettaIlMaestro(socio(4));
  return [!!r, r && r.dimostrato === 5, r && r.inScheda === 4];
});

caso('1ter. 🔄🔄 il mezzo passo NON conta più: in scheda 4, dimostrato 4,5 ⇒ fuori (27/08 mattina)', () => {
  /* 🗣️ ROVESCIATO su sua parola il 27/08 mattina, meno di dodici ore dopo essere stato scritto
     («e anche mezzo passo conta»): Maurizio ha fatto il test — in scheda 4, dimostrato 4,5,
     tutti e due «Avanzato» — e il bot lo mandava dal maestro a certificare il livello che ha
     già. *«Quando uno fa il test e risulta lo stesso livello che già ha nella scheda di
     anagrafica, non c'è bisogno che si chiami il maestro.»*
     ⚖️ Il criterio del 27/08 sera resta intero («quanto ha dimostrato in più», caso 1bis): si
     aggiunge che il DI PIÙ si misura in PAROLE, perché è la parola il livello del socio. */
  conSchede([scheda(4.5)]);
  return [ctx.assessmentAspettaIlMaestro(socio(4)) === null];
});

caso('2bis. ⚖️ …ma chi ha 5 e dimostra 5 resta FUORI: non è più di quello che ha', () => {
  // La ragione del caso 2, applicata dove prima non arrivava: sopra il tetto o sotto, il
  // criterio è lo stesso — «più di quello che ha in scheda».
  conSchede([scheda(5)]);
  return [ctx.assessmentAspettaIlMaestro(socio(5)) === null];
});

caso('2ter. ⚖️ e chi ha 5 e dimostra 4 resta fuori: ha dimostrato MENO', () => {
  // 🚨 Il verso conta: un `!==` al posto di un `>` metterebbe in lista chi è andato peggio,
  //    mandando il maestro a certificare una discesa che nessuno gli ha chiesto.
  conSchede([scheda(4)]);
  return [ctx.assessmentAspettaIlMaestro(socio(5)) === null];
});

// ── SABOTAGGI: un banco che non cade quando si rompe il codice non prova niente ──
caso('13. SABOTAGGIO: se il confronto guardasse solo il tetto, il caso 2 tornerebbe verde', () => {
  // Si rifà a mano la regola SBAGLIATA — «dimostra sopra il tetto» e basta — e si pretende
  // che dia un esito DIVERSO da quello vero sul caso del 26/08. Se un domani qualcuno
  // semplificasse così, questo caso è l'unico posto dove se ne accorgerebbe.
  conSchede([scheda(4)]);
  const vero = ctx.assessmentAspettaIlMaestro(socio(4)) !== null;
  const sbagliato = 4 > TETTO;
  return [vero === false, sbagliato === true, vero !== sbagliato];
});

caso('13bis. 🔄🚨 SABOTAGGIO: la regola VECCHIA («chi è già sopra il tetto è fuori») perderebbe il 1bis', () => {
  /* ⭐ Questo è il sabotaggio che protegge la DECISIONE del 27/08, non un calcolo: si rifà a
     mano la condizione di ieri e si pretende che dia un esito DIVERSO sul caso che l'ha fatta
     cambiare. Senza, la riga si potrebbe rimettere com'era e il banco resterebbe verde — che è
     esattamente quello che è successo fino a stasera: il criterio è cambiato e i 14 casi di
     prima sono passati tutti, prima e dopo. */
  conSchede([scheda(5)]);
  const vero = ctx.assessmentAspettaIlMaestro(socio(4)) !== null;
  const conLaRegolaVecchia = !(4 > TETTO);   // ieri: chi ha 4 (> 3,5) veniva scartato
  return [vero === true, conLaRegolaVecchia === false, vero !== conLaRegolaVecchia];
});

caso('14. SABOTAGGIO: cercando solo in `p.giocatore` il caso 8 non troverebbe niente', () => {
  const p = { data: fraGiorni(3), ora: '19:00', giocatore: 'Lidia Rossi', giocatori: [{ nome: 'Maurizio Aprea' }] };
  conPrenotazioni([p]);
  const vero = ctx.pmoProssimaVoltaInCampo(socio(TETTO)) !== null;
  const soloOrganizzatore = ctx.samePlayerName ? false : (p.giocatore === 'Maurizio Aprea');
  return [vero === true, soloOrganizzatore === false];
});

// ── GUARDIE SULLA BASE ───────────────────────────────────────────────────────
const corpo = estrai('assessmentAspettaIlMaestro') + estrai('pmoProssimaVoltaInCampo');
const guardie = [
  ['il tetto arriva dalla costante, non da un numero scritto a mano',
    /PMO_TETTO_MAESTRO/.test(corpo) && !/[^_A-Z]3\.5/.test(corpo)],
  ['la lista NON scrive niente: nessun save, nessun livello assegnato',
    !/\bsave\(|\.level\s*=|lastLevelUpdateAt\s*=|showAlert\(/.test(corpo)],
  ['il filtro dei soci chiama la funzione invece di rifare la regola',
    /if \(type === 'daCertificare'\) return !!assessmentAspettaIlMaestro\(g\);/.test(html)],
  ['la voce esiste nel menu a tendina, o il filtro non si può nemmeno scegliere',
    /<option value="daCertificare">/.test(html)],
  ['la riga compare nell\'elenco accanto a quella del doppione',
    /\$\{_dupWhy\}\$\{_maestroWhy\}/.test(html)],
  // 🗣️ 26/08 — sua richiesta: il riquadro sta anche nel tab «Autovalutazione» della scheda
  //    socio. Le due cose non si sostituiscono: il filtro dice CHI andare a guardare, il
  //    riquadro dice cosa aspetta QUESTA persona. Se un domani sparisse uno dei due, questa
  //    guardia lo direbbe invece di lasciarlo scoprire aprendo una scheda.
  ['il riquadro sta anche nel tab «Autovalutazione» della scheda socio',
    /🎓 Aspetta il maestro/.test(html) && /\$\{_maestroBox\}\$\{assessmentMeta\}/.test(html)],
  // 🔒 26/08 — il livello nasce CHIUSO, ma resta cambiabile con un gesto. Le due guardie vanno
  //    insieme: da sola, la prima permetterebbe di bloccarlo per sempre — e con lui la
  //    certificazione del maestro, che da quel campo passa.
  ['il campo del livello nasce chiuso (readonly)',
    /id="cardLevel"[^>]*readonly/.test(html)],
  ['…ma resta un gesto per aprirlo, o il maestro non potrebbe più certificare nessuno',
    /pmoSbloccaLivello\(/.test(html) && /input\.removeAttribute\('readonly'\)/.test(html)],
  ['il riquadro non offre nessun bottone che «certifichi»: il livello si scrive dal suo campo',
    !/certifica[^<]*<\/button>|onclick="[^"]*certific/i.test(html.slice(html.indexOf('🎓 Aspetta il maestro'), html.indexOf('🎓 Aspetta il maestro') + 2400))],
];

let passati = 0, falliti = 0;
console.log('BANCO — chi aspetta il maestro (voce 98)\n');
console.log(`Il tetto letto da index.html: ${TETTO}\n`);
console.log('Guardie sulla base:');
guardie.forEach(([nome, ok]) => {
  console.log(`  ${ok ? '✅' : '❌'} ${nome}`);
  if (!ok) falliti++;
});
console.log('');
for (const c of casi) {
  let esiti;
  try { esiti = c.fn(); } catch (err) { esiti = [false]; c.errore = err; }
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
