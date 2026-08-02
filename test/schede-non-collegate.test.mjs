// ── BANCO: ricollegare le schede che il browser e il cloud non riconoscono ───────────
//
// Che cosa prova: che il bottone «Ricollega le N schede che non si riconoscono» agganci la
// scheda locale GIUSTA alla riga viva del cloud — e soprattutto che NON la agganci a quella
// sbagliata, che qui significherebbe dare a una persona l'identità di un'altra.
//
// ⭐ Le funzioni NON sono ricopiate qui: vengono ESTRATTE da `index.html` e valutate.
//    Un banco che prova una copia del codice prova la copia, non il prodotto.
//
// 🚨 I due casi che contano davvero:
//    · il TELEFONO storpiato (Roberto Ruzzini, PROD: nel cloud `+393492222564`, nella copia
//      locale `+39349222564` — una cifra in meno). Il browser scrive nel cloud usando il
//      telefono come chiave: se non si allinea anche quello, al primo salvataggio riscrive
//      in una riga sbagliata e il guasto torna. Allineare il solo numero di scheda è mezzo
//      lavoro, e mezzo lavoro qui non si vede: sembra riuscito.
//    · gli OMONIMI (Davide Zanardo 000030 e 000930, Marco Micheletto 000820 e 000816 sono
//      persone DIVERSE con lo stesso nome, entrambe vive in PROD). Agganciare per nome le
//      scambierebbe: si aggancia per il gemello che la diagnostica ha già individuato.
//
// Uso:  node test/schede-non-collegate.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const INDEX = join(QUI, '..', 'index.html');
const html = readFileSync(INDEX, 'utf8');

// ── Estrazione delle funzioni dal file vero ──────────────────────────────────────
// 🚨 Due difetti già pagati e qui evitati: il corpo comincia DOPO la lista dei parametri
//    (una firma come `f(row={})` ha una graffa fra i parametri), e i COMMENTI si saltano
//    (in italiano sono pieni di apostrofi: presi per apici sballano il conteggio e
//    l'estrazione tira dentro le funzioni successive).
function estrai(nome) {
  const inizio = html.indexOf(`function ${nome}(`);
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

// ── Il banco: costruisce un contesto con gli appoggi veri e ci mette dentro le funzioni.
// `esito` raccoglie quello che la funzione ha fatto al mondo (salvataggi, messaggi), così
// si può controllare l'EFFETTO e non solo il valore di ritorno.
function contesto(sociLocali, missingRows, opts = {}) {
  const esito = { salvato: null, messaggi: [], dryRunRilanciato: 0 };
  const ctx = {
    giocatori: sociLocali,
    pmoMemberCountAuditState: { missingRows },
    confirm: () => opts.confermato !== false,
    save: (chiave, valore) => {
      if (opts.memoriaPiena) throw new Error('QuotaExceededError');
      esito.salvato = { chiave, valore };
    },
    showAlert: (testo, tipo) => esito.messaggi.push({ testo, tipo }),
    updateMemberCounts: () => {},
    renderMembers: () => {},
    pmoRunMemberCountAuditDryRun: () => { esito.dryRunRilanciato++; },
    console: { info() {}, warn() {}, log() {}, error() {} },
  };
  vm.createContext(ctx);
  const presi = ['cleanCell', 'pmoPianoRicollegamentoSchede', 'pmoRicollegaSchedeNonCollegate'];
  for (let giro = 0; giro < 40; giro++) {
    try {
      vm.runInContext(presi.map(estrai).join('\n'), ctx);
      return { ctx, esito };
    } catch (err) {
      const mancante = /(\w+) is not defined/.exec(String(err && err.message));
      if (!mancante || presi.includes(mancante[1])) throw err;
      presi.push(mancante[1]);
    }
  }
  throw new Error('troppe dipendenze da risolvere: qualcosa non torna nell\'estrazione');
}

// Una riga come la produce la diagnostica: `modo`, il payload del cloud e il gemello locale.
const riga = (modo, cloudId, gemelloId, payload = {}, extra = {}) => ({
  modo,
  cloudId,
  gemelloId,
  gemelloNome: extra.gemelloNome || '',
  fullName: extra.fullName || 'Tizio Caio',
  active: true,
  payload: { id: cloudId, phone: '', memberId: '', email: '', ...payload },
});
const socio = (id, firstName, surname, phone, extra = {}) =>
  ({ id, firstName, surname, phone, active: true, memberId: '', ...extra });

const casi = [];
const caso = (nome, fn) => casi.push({ nome, fn });

// ── IL PIANO ────────────────────────────────────────────────────────────────────

caso('1. una scheda non collegata: il piano la aggancia al numero del cloud', () => {
  const loc = [socio('vecchio-1', 'Roberto', 'Ruzzini', '+393492222564')];
  const righe = [riga('altro_id', 'e88ac66b', 'vecchio-1', { phone: '+393492222564', memberId: '000179' })];
  const { ctx } = contesto(loc, righe);
  const p = ctx.pmoPianoRicollegamentoSchede(righe, loc);
  return [p.azioni.length === 1, p.saltate.length === 0,
          p.azioni[0].idPrima === 'vecchio-1', p.azioni[0].idDopo === 'e88ac66b'];
});

caso('2. le righe «non c\'è proprio» NON vengono toccate (le ripara l\'altro bottone)', () => {
  const loc = [socio('a', 'Anna', 'Bianchi', '+393331110001')];
  const righe = [riga('assente', 'nuovo-1', '', { phone: '+393331110009' }),
                 riga('assente', 'nuovo-2', '', { phone: '+393331110008' })];
  const { ctx } = contesto(loc, righe);
  const p = ctx.pmoPianoRicollegamentoSchede(righe, loc);
  return [p.azioni.length === 0, p.saltate.length === 0];
});

caso('3. 🚨 il TELEFONO storpiato si allinea a quello del cloud (caso Ruzzini vero)', () => {
  const loc = [socio('vecchio-1', 'Roberto', 'Ruzzini', '+39349222564')];   // una cifra in meno
  const righe = [riga('altro_id', 'e88ac66b', 'vecchio-1', { phone: '+393492222564', memberId: '000179' })];
  const { ctx } = contesto(loc, righe);
  const p = ctx.pmoPianoRicollegamentoSchede(righe, loc);
  return [p.azioni.length === 1,
          p.azioni[0].telefonoPrima === '+39349222564',
          p.azioni[0].telefonoDopo === '+393492222564'];
});

caso('4. 🚨 se quel numero è GIÀ di un\'altra scheda locale: si salta, non si duplica', () => {
  // Riagganciare qui creerebbe due schede con lo stesso numero: peggio del problema.
  const loc = [socio('vecchio-1', 'Roberto', 'Ruzzini', '+39349222564'),
               socio('e88ac66b', 'Altro', 'Socio', '+393331110001')];
  const righe = [riga('altro_id', 'e88ac66b', 'vecchio-1', { phone: '+393492222564' })];
  const { ctx } = contesto(loc, righe);
  const p = ctx.pmoPianoRicollegamentoSchede(righe, loc);
  return [p.azioni.length === 0, p.saltate.length === 1,
          /già di un/.test(p.saltate[0].perche)];
});

caso('5. due righe del cloud che chiedono lo stesso numero: la seconda si salta', () => {
  const loc = [socio('v1', 'Uno', 'Tizio', '+393331110001'), socio('v2', 'Due', 'Caio', '+393331110002')];
  const righe = [riga('altro_id', 'stesso', 'v1', { phone: '+393331110001' }),
                 riga('altro_id', 'stesso', 'v2', { phone: '+393331110002' })];
  const { ctx } = contesto(loc, righe);
  const p = ctx.pmoPianoRicollegamentoSchede(righe, loc);
  return [p.azioni.length === 1, p.saltate.length === 1];
});

caso('6. il gemello locale non c\'è più: si salta e lo si dice', () => {
  const loc = [socio('altro', 'Anna', 'Bianchi', '+393331110001')];
  const righe = [riga('altro_id', 'cloud-1', 'sparito', { phone: '+393331110002' })];
  const { ctx } = contesto(loc, righe);
  const p = ctx.pmoPianoRicollegamentoSchede(righe, loc);
  return [p.azioni.length === 0, p.saltate.length === 1, /non si trova/.test(p.saltate[0].perche)];
});

caso('7. riga del cloud senza numero di scheda: si salta', () => {
  const loc = [socio('v1', 'Uno', 'Tizio', '+393331110001')];
  const righe = [{ modo: 'altro_id', cloudId: '', gemelloId: 'v1', fullName: 'Uno Tizio', payload: { id: '' } }];
  const { ctx } = contesto(loc, righe);
  const p = ctx.pmoPianoRicollegamentoSchede(righe, loc);
  return [p.azioni.length === 0, p.saltate.length === 1];
});

caso('8. 🚨 OMONIMI: due persone con lo stesso nome non si scambiano la scheda', () => {
  // Davide Zanardo esiste DUE volte in PROD: codici 000030 e 000930, telefoni diversi.
  const loc = [socio('zan-vecchio-A', 'Davide', 'Zanardo', '+393386503339', { memberId: '000030' }),
               socio('zan-vecchio-B', 'Davide', 'Zanardo', '+393318751694', { memberId: '000930' })];
  const righe = [
    riga('altro_id', 'cloud-A', 'zan-vecchio-A', { phone: '+393386503339', memberId: '000030' }, { fullName: 'Davide Zanardo' }),
    riga('altro_id', 'cloud-B', 'zan-vecchio-B', { phone: '+393318751694', memberId: '000930' }, { fullName: 'Davide Zanardo' }),
  ];
  const { ctx } = contesto(loc, righe);
  const p = ctx.pmoPianoRicollegamentoSchede(righe, loc);
  const perPrima = Object.fromEntries(p.azioni.map(a => [a.idPrima, a]));
  return [p.azioni.length === 2,
          perPrima['zan-vecchio-A'].idDopo === 'cloud-A',
          perPrima['zan-vecchio-B'].idDopo === 'cloud-B',
          perPrima['zan-vecchio-A'].codiceDopo === '000030',
          perPrima['zan-vecchio-B'].codiceDopo === '000930'];
});

// ── L'APPLICAZIONE ──────────────────────────────────────────────────────────────

caso('9. applicando: il numero cambia davvero, il telefono si allinea, il LIVELLO no', () => {
  const loc = [socio('vecchio-1', 'Roberto', 'Ruzzini', '+39349222564', { level: '4', memberId: '' })];
  const righe = [riga('altro_id', 'e88ac66b', 'vecchio-1', { phone: '+393492222564', memberId: '000179', level: '1' })];
  const { ctx, esito } = contesto(loc, righe);
  ctx.pmoRicollegaSchedeNonCollegate();
  const g = ctx.giocatori[0];
  return [g.id === 'e88ac66b', g.phone === '+393492222564', g.memberId === '000179',
          g.level === '4',                              // il livello è dell'app: non si tocca
          esito.salvato && esito.salvato.chiave === 'giocatori',
          esito.dryRunRilanciato === 1];
});

caso('10. il cloud senza codice non CANCELLA il codice locale', () => {
  const loc = [socio('vecchio-1', 'Anna', 'Bianchi', '+393331110001', { memberId: '000466' })];
  const righe = [riga('altro_id', 'cloud-1', 'vecchio-1', { phone: '+393331110001', memberId: '' })];
  const { ctx } = contesto(loc, righe);
  ctx.pmoRicollegaSchedeNonCollegate();
  return [ctx.giocatori[0].id === 'cloud-1', ctx.giocatori[0].memberId === '000466'];
});

caso('11. 🚨 memoria piena: lo DICE invece di annunciare successo', () => {
  const loc = [socio('vecchio-1', 'Anna', 'Bianchi', '+393331110001')];
  const righe = [riga('altro_id', 'cloud-1', 'vecchio-1', { phone: '+393331110001' })];
  const { ctx, esito } = contesto(loc, righe, { memoriaPiena: true });
  ctx.pmoRicollegaSchedeNonCollegate();
  const ultimo = esito.messaggi[esito.messaggi.length - 1] || {};
  return [esito.messaggi.length === 1, ultimo.tipo === 'danger', /piena/.test(ultimo.testo),
          esito.dryRunRilanciato === 0];
});

caso('12. se dice di no al confirm, non tocca niente', () => {
  const loc = [socio('vecchio-1', 'Anna', 'Bianchi', '+393331110001')];
  const righe = [riga('altro_id', 'cloud-1', 'vecchio-1', { phone: '+393331110001' })];
  const { ctx, esito } = contesto(loc, righe, { confermato: false });
  ctx.pmoRicollegaSchedeNonCollegate();
  return [ctx.giocatori[0].id === 'vecchio-1', esito.salvato === null];
});

caso('13. niente da fare: nessun salvataggio e nessun falso successo', () => {
  const loc = [socio('a', 'Anna', 'Bianchi', '+393331110001')];
  const righe = [riga('assente', 'nuovo-1', '', { phone: '+393331110009' })];
  const { ctx, esito } = contesto(loc, righe);
  ctx.pmoRicollegaSchedeNonCollegate();
  return [esito.salvato === null, esito.messaggi.length === 1, esito.messaggi[0].tipo === 'info'];
});

// ── 🚨 GUARDIE SULLA BASE ────────────────────────────────────────────────────────
// I casi qui sopra proverebbero la funzione anche se nessuno la chiamasse, e anche se il
// dato su cui si appoggia smettesse di arrivare. Sono i due modi in cui un banco resta
// verde mentre il prodotto è rotto: «fatto ma non collegato».
const corpo = (() => { try { return estrai('pmoRicollegaSchedeNonCollegate'); } catch { return ''; } })();
// I controlli «non fa X» si fanno sul CODICE, non sui commenti: un commento che PROMETTE
// di non scrivere nel cloud contiene la parola che lo farebbe accusare.
const soloCodice = corpo.split('\n').filter(r => !/^\s*(\/\/|\*|\/\*)/.test(r)).join('\n');
const guardie = [
  ['la funzione del bottone esiste', !!corpo],
  ['il pannello la chiama davvero', (html.match(/pmoRicollegaSchedeNonCollegate\(\)/g) || []).length >= 1],
  ['agisce SOLO sui «scheda non collegata»', /altro_id/.test(estrai('pmoPianoRicollegamentoSchede'))],
  ['NON scrive nel cloud', !/pmoSyncCloudRecordsNow\(|pmoCloudRpc\(|pmoStaffRpcPaged\(/.test(soloCodice)],
  ['non cancella soci', !/splice\(|giocatori\s*=\s*\[\]/.test(soloCodice)],
  ['gestisce la memoria piena invece di fingere', /catch/.test(soloCodice) && /piena/.test(soloCodice)],
  // 🚨 L'ANELLO DI MEZZO: il piano si aggancia a `row.gemelloId`, che NON nasce qui — lo
  // calcola la diagnostica. Se quel campo sparisse, il piano non troverebbe più nessuna
  // scheda locale e salterebbe tutto IN SILENZIO: il bottone direbbe «nessuna scheda da
  // ricollegare» e sembrerebbe che il problema non ci sia più.
  ['la diagnostica produce ancora «gemelloId»', /gemelloId:/.test(html)],
  ['il piano si aggancia al gemello, non al nome', /gemelloId/.test(estrai('pmoPianoRicollegamentoSchede'))],
];

let passati = 0, falliti = 0;
console.log('BANCO — ricollegare le schede che browser e cloud non riconoscono\n');
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
