// ── BANCO: «il maestro non si butta insieme all'occupazione scartata» ────────────
//
// Che cosa prova: che la card del calendario mostri il MAESTRO della lezione anche quando per
// lo stesso slot esiste uno staff_booking — cioè quando le guardie v5.701/v5.742 scartano
// l'occupazione Matchpoint, che è l'UNICA a portare il nome del monitor (il sync lo legge dalla
// casella del tabellone; l'export non ha la colonna istruttore).
//
// Caso reale che l'ha fatto nascere — PROD, 7/08/2026, Campo 1 ore 19:30 (idReserva 9197):
//   · booking_occupancy  → istruttore «Lucas Vidal»   ← c'è, nel database
//   · staff_booking      → istruttore «»              ← creato dall'app, mai riempito
//   · sulla card         → nessun maestro             ← il difetto
// La scheda di modifica invece lo mostrava (ripiego v6.128): due schermate della stessa lezione
// che si contraddicono.
//
// 🚨⭐⭐ Perché questo banco chiama staffCalGetSlots VERA e non solo la funzione pura: il modo
//    più facile di sbagliare questo fix è metterlo nel posto giusto ma nell'ORDINE sbagliato —
//    travasare DOPO lo splice, quando l'occupazione non c'è più. Una funzione pura corretta
//    resterebbe verde e il prodotto rotto. Qui il guasto sta nel mezzo, quindi si misura il mezzo.
//
// ⭐ Le funzioni sono ESTRATTE da index.html, non ricopiate.
//
// Uso:  node test/maestro-non-si-butta-col-resto.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(QUI, '..', 'index.html'), 'utf8');

function estrai(nome) {
  const inizio = html.indexOf(`function ${nome}(`);
  if (inizio < 0) throw new Error(`funzione «${nome}» non trovata in index.html`);
  // 🚨 Il corpo comincia DOPO i parametri: `funzione(row={})` ha una graffa fra le tonde.
  let t = html.indexOf('(', inizio), tonde = 0;
  for (; t < html.length; t++) {
    if (html[t] === '(') tonde++;
    else if (html[t] === ')') { tonde--; if (tonde === 0) { t++; break; } }
  }
  // 🚨 I COMMENTI si saltano: in italiano sono pieni di apostrofi e ognuno, preso per un apice,
  // sballa il conteggio delle graffe tirando dentro le funzioni successive.
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

// ── Il banco monta il calendario VERO ────────────────────────────────────────────
// Le uniche cose finte sono i DATI (l'occupazione e gli staff_booking) e il magazzino locale.
// Tutta la logica — travaso, scarto v5.701, scarto v5.742, soppressioni — è quella di index.html.
const ctx = {
  console: { info() {}, warn() {}, log() {}, error() {} },
  prenotazioniOccupazione: [],
  prenotazioni: [],
  storicoPrenotazioni: [],
  magazzino: { staffBookings: [], staffCalCancelled: [] },
};
ctx.safeLoad = (chiave, ripiego) => (chiave in ctx.magazzino ? ctx.magazzino[chiave] : ripiego);
vm.createContext(ctx);
vm.runInContext([
  estrai('staffCalTodayIso'),
  estrai('_staffCalDurMin'),
  estrai('_staffCalSuppressKey'),
  estrai('_staffCalGetSuppressed'),
  estrai('pmoStaffCalMaestroDaTravasare'),
  estrai('staffCalGetSlots'),
].join('\n'), ctx);

const GIORNO = '2026-08-07';

// Una riga di occupazione come la scrive il sync Matchpoint (il caso vero delle 19:30).
const occupazione = (extra = {}) => ({
  data: GIORNO, ora: '19:30', campo: 'Campo 1', durata: '1',
  tipo: 'Lezione Libera', giocatore: 'Sara Trentin', giocatori: ['Sara Trentin'],
  idReserva: '9197', istruttore: 'Lucas Vidal', descrizione: '-Sara Trentin.',
  ...extra,
});

// Una prenotazione come la tiene l'app in `staffBookings` (nasce SEMPRE con istruttore vuoto).
const staffBooking = (extra = {}) => ({
  id: 'sb-1', data: GIORNO, ora: '19:30', campo: 1, durata: 60,
  tipo: 'lezione', istruttore: '', nome: 'Sara Trentin',
  giocatori: [{ nome: 'Sara Trentin', codice: '1131' }], idReserva: '9197',
  ...extra,
});

// Prepara il mondo e chiede al calendario che cosa disegnerebbe.
const slots = (occupazioni, staffBookings) => {
  ctx.prenotazioniOccupazione = occupazioni;
  ctx.magazzino.staffBookings = staffBookings;
  return ctx.staffCalGetSlots(GIORNO);
};
const cardStaff = (lista, campo = 1, ora = '19:30') =>
  lista.find(r => r.tipo === 'staff-booking' && r.campo === campo && r.ora === ora);

const casi = [];
const caso = (nome, fn) => casi.push({ nome, fn });

caso('1. IL CASO VERO — Campo 1, 19:30: la card mostra «Lucas Vidal»', () => {
  const lista = slots([occupazione()], [staffBooking()]);
  const card = cardStaff(lista);
  return [
    !!card,
    card.istruttore === 'Lucas Vidal',
    // ⭐ e l'occupazione è comunque sparita: il travaso NON deve far ricomparire il doppione
    // che le guardie v5.701/v5.742 esistono apposta per togliere.
    lista.filter(r => r.campo === 1 && r.ora === '19:30').length === 1,
  ];
});

caso('2. 🚨 PARTITA: nessun travaso — su una partita quel posto è prezzo e categoria, non una persona', () => {
  const occ = occupazione({ tipo: 'Partita', istruttore: 'Lucas Vidal' });
  const sb = staffBooking({ tipo: 'partita' });
  const card = cardStaff(slots([occ], [sb]));
  return [!!card, card.istruttore === ''];
});

caso('3. 🚨 il maestro SCELTO dallo staff vince sulla lettura del tabellone', () => {
  // 🚨 MISURATO: la sola prova dal calendario NON discrimina. La precedenza è scritta in DUE
  // posti — il passaggio di travaso salta gli staff_booking che un maestro ce l'hanno già, e la
  // funzione pura la ripete — quindi togliendola dalla funzione il calendario resta comunque
  // giusto e il banco verde. Si interroga la funzione PURA di suo, oltre al calendario.
  const card = cardStaff(slots([occupazione({ istruttore: 'Santiago Carabajal' })],
                               [staffBooking({ istruttore: 'Spinazze' })]));
  const diretto = ctx.pmoStaffCalMaestroDaTravasare(
    { tipoReale: 'lezione', istruttore: 'Spinazze' }, { istruttore: 'Santiago Carabajal' });
  return [card.istruttore === 'Spinazze', diretto === 'Spinazze'];
});

caso('4. 🚨 NON si pesca il maestro di un\'ALTRA lezione: servono ENTRAMBI, campo e ora', () => {
  // 🚨 MISURATO: due lezioni che differiscono per campo E per ora insieme non discriminano —
  // allargando l'aggancio a uno solo dei due, restano comunque appaiate giuste. Servono le due
  // coppie che variano UN dato per volta.
  const stesso = (extra) => occupazione({ giocatori: ['Tizio'], ...extra });
  // (a) stesso CAMPO, ore diverse → smaschera chi non guarda l'ora
  const listaA = slots(
    [stesso({ campo: 'Campo 1', ora: '19:30', idReserva: '1', istruttore: 'Lucas Vidal' }),
     stesso({ campo: 'Campo 1', ora: '21:00', idReserva: '2', istruttore: 'Santiago Carabajal' })],
    [staffBooking({ id: 'a1', campo: 1, ora: '19:30', idReserva: '1' }),
     staffBooking({ id: 'a2', campo: 1, ora: '21:00', idReserva: '2' })]);
  // (b) stessa ORA, campi diversi → smaschera chi non guarda il campo
  const listaB = slots(
    [stesso({ campo: 'Campo 1', ora: '19:30', idReserva: '3', istruttore: 'Lucas Vidal' }),
     stesso({ campo: 'Campo 2', ora: '19:30', idReserva: '4', istruttore: 'Santiago Carabajal' })],
    [staffBooking({ id: 'b1', campo: 1, ora: '19:30', idReserva: '3' }),
     staffBooking({ id: 'b2', campo: 2, ora: '19:30', idReserva: '4' })]);
  return [
    cardStaff(listaA, 1, '19:30').istruttore === 'Lucas Vidal',
    cardStaff(listaA, 1, '21:00').istruttore === 'Santiago Carabajal',
    cardStaff(listaB, 1, '19:30').istruttore === 'Lucas Vidal',
    cardStaff(listaB, 2, '19:30').istruttore === 'Santiago Carabajal',
  ];
});

caso('5. 🚨 lezione PROMOSSA e poi SPOSTATA: l\'aggancio regge per idReserva anche a slot diverso', () => {
  // È il caso della guardia v5.742: lo staff_booking si è spostato alle 20:00, l'occupazione
  // stantia è rimasta alle 19:30. Agganciando solo campo|ora, il maestro andrebbe perso.
  const occ = occupazione({ ora: '19:30', idReserva: '9197', istruttore: 'Lucas Vidal' });
  const sb = staffBooking({ ora: '20:00', idReserva: '9197' });
  const lista = slots([occ], [sb]);
  const card = cardStaff(lista, 1, '20:00');
  return [!!card, card.istruttore === 'Lucas Vidal', !lista.some(r => r.tipo !== 'staff-booking')];
});

caso('6. occupazione SENZA maestro: la card resta muta, non inventa un nome', () => {
  const card = cardStaff(slots([occupazione({ istruttore: '' })], [staffBooking()]));
  return [!!card, card.istruttore === ''];
});

caso('7. chiave istruttore ASSENTE (scrape a vuoto): non esplode e non inventa', () => {
  const occ = occupazione();
  delete occ.istruttore;
  const card = cardStaff(slots([occ], [staffBooking()]));
  return [!!card, card.istruttore === ''];
});

caso('8. le stringhe di soli spazi NON sono un maestro, né come fonte né come destinazione', () => {
  const a = cardStaff(slots([occupazione({ istruttore: 'Lucas Vidal' })], [staffBooking({ istruttore: '   ' })]));
  const b = cardStaff(slots([occupazione({ istruttore: '   ' })], [staffBooking({ istruttore: '' })]));
  return [a.istruttore === 'Lucas Vidal', b.istruttore === ''];
});

caso('9. MANUTENZIONE: nessun travaso', () => {
  const occ = occupazione({ tipo: 'Manutenzione', istruttore: 'Lucas Vidal', giocatori: [] });
  const card = cardStaff(slots([occ], [staffBooking({ tipo: 'manutenzione' })]));
  return [!!card, card.istruttore === ''];
});

caso('10. lezione nata su MATCHPOINT (nessuno staff_booking): mostra il maestro come prima', () => {
  const lista = slots([occupazione()], []);
  const card = lista.find(r => r.tipo === 'lezione' && r.campo === 1);
  return [!!card, card.istruttore === 'Lucas Vidal'];
});

caso('11. voci mancanti o storte non fanno cadere la scelta', () => {
  const f = ctx.pmoStaffCalMaestroDaTravasare;
  return [
    f(null, null) === '',
    f(undefined, { istruttore: 'Lucas Vidal' }) === '',
    f({ tipoReale: 'lezione' }, null) === '',
    f({ tipoReale: 'lezione', istruttore: null }, { istruttore: 42 }) === '',
  ];
});

// ── GUARDIE SULLA BASE ──────────────────────────────────────────────────────────
const corpoPura = estrai('pmoStaffCalMaestroDaTravasare');
const corpoSlots = estrai('staffCalGetSlots');
const iChiamata = corpoSlots.indexOf('pmoStaffCalMaestroDaTravasare(');
const iScarto701 = corpoSlots.indexOf('_staffSlotKeys');
const iScarto742 = corpoSlots.indexOf('_staffIdReserva');

const guardie = [
  ['la funzione pura esiste', !!corpoPura],
  ['il calendario la CHIAMA', iChiamata >= 0],
  // ⭐⭐ La guardia che conta davvero. Il travaso messo DOPO lo splice lascerebbe verdi tutti i
  // casi puri e la card muta: quando l'occupazione è già stata tolta, non c'è più niente da cui
  // travasare. È l'ordine, non la logica, il punto in cui questo fix può morire in silenzio.
  ['il travaso viene PRIMA di entrambi gli scarti',
   iChiamata >= 0 && iChiamata < iScarto701 && iChiamata < iScarto742],
  ['è pura: non salva, non legge il magazzino, non tocca il DOM',
   !/\bsave\(|localStorage|\bwindow\.|document\.|safeLoad\(|pmoSyncCloudRecordsNow\(/.test(corpoPura)],
  ['non cancella niente', !/splice\(|delete /.test(corpoPura)],
  ['il gate sul tipo guarda tipoReale (sullo staff_booking `tipo` vale sempre "staff-booking")',
   /tipoReale/.test(corpoPura)],
];

let passati = 0, falliti = 0;
console.log('BANCO — il maestro non si butta insieme all\'occupazione scartata\n');
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
