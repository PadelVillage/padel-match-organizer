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

const rigaEta = html.match(/const _PMO_VERIFICHE_ETA_MAX_MS = [^;]+;/);
if (!rigaEta) throw new Error('`_PMO_VERIFICHE_ETA_MAX_MS` non trovata in index.html');

const ctx = vm.createContext({ console });
vm.runInContext([
  rigaLook[0],
  rigaEta[0],
  estrai('staffCalGuardaFinchePuoi'),
  estrai('pmoVerificheNormalizza'),
].join('\n\n'), ctx);
const guarda = ctx.staffCalGuardaFinchePuoi;
const normalizza = ctx.pmoVerificheNormalizza;
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

console.log('\n⏳ LE VERIFICHE IN SOSPESO — pmoVerificheNormalizza (seconda metà)\n');

const ORA = 1_000_000_000_000;
const GIORNO = 24 * 60 * 60 * 1000;
const voce = (id, quando) => ({ id, quando, parsed: { campo: 'Campo 1', data: '2026-12-14', ora: '08:00' } });

await caso('11. una verifica fresca sopravvive al giro di pulizia', () => {
  const r = normalizza([voce('a', ORA - 1000)], ORA, 2 * GIORNO);
  return r.length === 1 && r[0].id === 'a';
});

await caso('12. ⚠️ oltre le 48 ore si scarta: una domanda vecchia due giorni è un residuo, non una verifica', () => {
  const r = normalizza([voce('vecchia', ORA - 3 * GIORNO), voce('nuova', ORA - 1000)], ORA, 2 * GIORNO);
  return r.length === 1 && r[0].id === 'nuova';
});

await caso('13. lo stesso id non si duplica, anche se il deposito lo contiene due volte', () => {
  const r = normalizza([voce('a', ORA - 1000), voce('a', ORA - 2000)], ORA, 2 * GIORNO);
  return r.length === 1;
});

await caso('14. 🚨 un deposito ROTTO non fa esplodere l\'avvio: vale lista vuota', () => [
  normalizza('{non è json', ORA, 2 * GIORNO).length === 0,
  normalizza('null', ORA, 2 * GIORNO).length === 0,
  normalizza(null, ORA, 2 * GIORNO).length === 0,
  normalizza({ non: 'un array' }, ORA, 2 * GIORNO).length === 0,
  normalizza([null, 3, 'x', {}], ORA, 2 * GIORNO).length === 0,
]);

await caso('15. senza il COSA (parsed) la voce si scarta: non si può chiedere di che cosa', () => {
  const r = normalizza([{ id: 'a', quando: ORA - 1000 }, voce('b', ORA - 1000)], ORA, 2 * GIORNO);
  return r.length === 1 && r[0].id === 'b';
});

await caso('16. il deposito arriva anche come STRINGA (come lo restituisce lo storage) e si legge uguale', () => {
  const r = normalizza(JSON.stringify([voce('a', ORA - 1000)]), ORA, 2 * GIORNO);
  return r.length === 1 && r[0].id === 'a';
});

await caso('17. 🚨 CONTROLLO NEGATIVO: se la pulizia per età sparisse, il caso 12 diventerebbe rosso', () => {
  // Senza il filtro sull'età, la vecchia di tre giorni resterebbe in lista.
  const senzaFiltro = [voce('vecchia', ORA - 3 * GIORNO), voce('nuova', ORA - 1000)];
  return senzaFiltro.length === 2 && normalizza(senzaFiltro, ORA, 2 * GIORNO).length === 1;
});

console.log('\n👯 I GEMELLI — nessuna strada di creazione deve restare indietro\n');

// 🚨 IL CASO CHE AVREBBE SCOPERTO L'ERRORE DEL 15/08/2026.
// I 17 casi qui sopra erano tutti verdi e provavano una funzione che su DUE strade su tre non
// veniva mai chiamata: la correzione era stata scritta in un posto solo, e i gemelli — il clic
// sullo slot e l'assistente — erano rimasti com'erano. È la forma esatta della voce 31, e un
// banco che prova solo la REGOLA non la vede: bisogna provare anche il CABLAGGIO.
// ⇒ Qui non si prova cosa fa la funzione, ma CHI LA CHIAMA.
function blocchiIncerti() {
  const fuori = [];
  const re = /const _uncertain(?:Status|Msg) = async function/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    // Il corpo del blocco: dalla dichiarazione fino alla chiusura `};` a inizio riga.
    const dopo = html.slice(m.index, m.index + 6000);
    const fine = dopo.search(/\n\s{6,8}\};/);
    fuori.push(dopo.slice(0, fine > 0 ? fine : 3000));
  }
  return fuori;
}

const incerti = blocchiIncerti();

await caso(`18. le strade che gestiscono l'esito ignoto sono ${incerti.length}, e sono più di una`, () =>
  incerti.length >= 3);

await caso('19. 🚨 OGNUNA passa dal guardare che insiste — nessuna chiama il colpo singolo', () => {
  const pigre = incerti.filter((b) => !b.includes('staffCalGuardaFinchePuoi'));
  if (pigre.length) {
    pigre.forEach((b) => console.log('   ↳ strada rimasta indietro: ' + b.split('\n')[0].trim()));
  }
  return pigre.length === 0;
});

await caso('20. 🚨 OGNUNA deposita la verifica invece di scaricarla sull\'operatore', () => {
  const senzaDeposito = incerti.filter((b) => !b.includes('pmoVerificheSegna'));
  if (senzaDeposito.length) {
    senzaDeposito.forEach((b) => console.log('   ↳ strada che non deposita: ' + b.split('\n')[0].trim()));
  }
  return senzaDeposito.length === 0;
});

// 🚨 IL CASO CHE AVREBBE SCOPERTO L'ERRORE DEL 15/08, SECONDA VOLTA.
// La ripresa all'avvio provava UNA VOLTA SOLA e usciva in silenzio se la sessione staff non era
// ancora pronta — cioè il difetto che questa voce toglie dal guardare, rimesso nella cosa che
// doveva ripararlo. E siccome usciva muta, dal database non si vedeva niente: la diagnosi è
// costata un giro di prova in produzione.
const sorgenteRipresa = estrai('pmoRiprendiVerificheInSospeso');

await caso('22. 🚨 la ripresa NON esce in silenzio quando la sessione non è pronta: si ripianifica', () =>
  sorgenteRipresa.includes('setTimeout') && sorgenteRipresa.includes('pmoRiprendiVerificheInSospeso(giro + 1)'));

await caso('23. 🚨 e ogni esito lascia TRACCIA nel database, o resta invisibile a chi non è allo schermo', () => [
  sorgenteRipresa.includes('ripresa-senza-sessione'),
  sorgenteRipresa.includes('verifica-chiusa-si'),
  sorgenteRipresa.includes('verifica-chiusa-no'),
  sorgenteRipresa.includes('ripresa-eccezione'),
]);

await caso('24. l\'avviso va su ENTRAMBE le superfici: la chat e la riga di stato', () => {
  const avvisa = estrai('pmoVerificheAvvisa');
  return avvisa.includes('svcAddMessage') && avvisa.includes('staffCalSetStatus');
});

console.log('\n🗄️  LA CHIUSURA ARRIVA ANCHE NEL DATABASE — non solo in questo browser\n');

// 🚨 IL RESIDUO DELLA VOCE 23, misurato il 15/08/2026: l'app arrivava al verdetto e chiudeva la
// verifica, ma solo nel proprio `localStorage`. Nel database il lavoro restava `unknown` per
// sempre. La regola nuova di questi giorni è l'opposto — ogni pezzo lascia traccia in una
// tabella — e vale ancora di più qui, perché da fuori quel browser non si vedeva niente.
// ⇒ Di nuovo si prova il CABLAGGIO, non la regola (che sta nel banco `tre-esiti-prenotazione`):
//    la regola giusta chiamata da due strade su quattro è la voce 31 daccapo.

await caso('25. 🚨 OGNI strada incerta chiude il lavoro anche NEL DATABASE, su tutt\'e due i verdetti', () => {
  const mute = incerti.filter((b) => {
    const chiamate = (b.match(/pmoChiudiLavoroIgnoto\(/g) || []).length;
    return chiamate < 2 || !b.includes("'si'") || !b.includes("'no'");
  });
  if (mute.length) mute.forEach((b) => console.log('   ↳ strada che non chiude: ' + b.split('\n')[0].trim()));
  return mute.length === 0;
});

await caso('26. 🚨 e la RIPRESA all\'avvio pure: è la strada da cui passano le verifiche vecchie', () => [
  sorgenteRipresa.includes("pmoChiudiLavoroIgnoto(v.jobId, 'si'"),
  sorgenteRipresa.includes("pmoChiudiLavoroIgnoto(v.jobId, 'no'"),
]);

await caso('27. ⚠️ il deposito porta con sé il NUMERO del lavoro, o alla ripresa non c\'è cosa chiudere', () => {
  const segna = estrai('pmoVerificheSegna');
  const passanti = incerti.filter((b) => /pmoVerificheSegna\(_sbId, parsed, why, _jobIgnoto\)/.test(b));
  return [
    /function pmoVerificheSegna\(id, parsed, perche, jobId\)/.test(segna),
    segna.includes('jobId: String(jobId'),
    passanti.length === incerti.length,
  ];
});

await caso('28. la chiusura NON può far fallire una verifica riuscita: non lancia mai', () => {
  // È best-effort di proposito. Se questa scrittura potesse rompere il giro, avremmo scambiato
  // un difetto di racconto con un difetto di sostanza — e sarebbe uno scambio in perdita.
  const f = estrai('pmoChiudiLavoroIgnoto');
  return [f.includes('try {'), f.includes('catch (e)'), f.includes('return false')];
});

await caso('29. 🚨 CONTROLLO NEGATIVO: il caso 25 sa diventare rosso se una strada resta muta', () => {
  const finto = ["const _uncertainMsg = async function (why) {\n  if (look.verdict === 'si') { _okMsg(); return; }\n"];
  const mute = finto.filter((b) => (b.match(/pmoChiudiLavoroIgnoto\(/g) || []).length < 2);
  return mute.length === 1;
});

await caso('21. 🚨 CONTROLLO NEGATIVO: il caso 19 sa diventare rosso se una strada torna indietro', () => {
  const finto = ['const _uncertainMsg = async function (why) {\n  const look = await staffCalAskMatchpoint(a, b, c, d);\n'];
  return finto.filter((b) => !b.includes('staffCalGuardaFinchePuoi')).length === 1;
});

console.log(`\n${ko === 0 ? '✅' : '❌'} ${ok}/${ok + ko} casi passati\n`);
process.exit(ko === 0 ? 0 : 1);
