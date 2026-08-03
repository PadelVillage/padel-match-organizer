// ── BANCO: «una prenotazione, UNA riga nel cloud» ────────────────────────────────
//
// Che cosa prova: che l'edge `matchpoint-bookings-create` usi come chiave l'id che l'APP gli
// manda (`sbId`) — così la sua riga e quella dell'app sono LA STESSA — e che, condividendo la
// chiave, non possa più cancellare quello che l'app ha già scritto.
//
// Il difetto: fino al 3/08/2026 l'edge chiavava sempre `staff_booking|<data>|<ora>|Campo <n>|
// <userId>` mentre l'app usava l'id della prenotazione ⇒ DUE righe per la stessa partita
// (misurate su PROD: 36 su 84). L'accordo era già spedito — l'app manda `sbId` dal 43274 di
// index.html — e nessuno lo leggeva.
//
// 🚨⭐⭐ Condividere la chiave è il pezzo pericoloso: la RPC dell'app fa `payload = excluded.
//    payload`, cioè SOSTITUISCE, e nel flusso asincrono l'app salva PRIMA e l'edge risponde
//    DOPO. Scrivendo alla cieca, la fotografia della creazione cancellerebbe il roster
//    aggiornato. Da qui la regola: l'esistente vince, ma i BUCHI li riempie l'edge.
//
// ⭐ La funzione di fusione è ESTRATTA dal sorgente vero dell'edge, non ricopiata.
//
// Uso:  node test/prenotazione-chiave-unica.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const EDGE = join(QUI, '..', 'supabase', 'functions', 'matchpoint-bookings-create', 'index.ts');
const ts = readFileSync(EDGE, 'utf8');

// Estrae una funzione dal .ts e le toglie le annotazioni di tipo, che a Node non servono e che
// `vm` non saprebbe leggere. Si tocca SOLO la firma: il corpo resta quello vero.
function estraiSenzaTipi(nome) {
  const inizio = ts.indexOf(`export function ${nome}(`);
  if (inizio < 0) throw new Error(`funzione «${nome}» non trovata nell'edge`);
  let i = ts.indexOf('{', ts.indexOf(')', inizio)), livello = 0, stringa = null, prec = '';
  for (; i < ts.length; i++) {
    const c = ts[i], succ = ts[i + 1];
    if (stringa) { if (c === stringa && prec !== '\\') stringa = null; }
    else if (c === '/' && succ === '/') { const f = ts.indexOf('\n', i); i = f < 0 ? ts.length : f; prec = '\n'; continue; }
    else if (c === '/' && succ === '*') { const f = ts.indexOf('*/', i + 2); i = f < 0 ? ts.length : f + 1; prec = '/'; continue; }
    else if (c === '"' || c === "'" || c === '`') stringa = c;
    else if (c === '{') livello++;
    else if (c === '}') { livello--; if (livello === 0) { i++; break; } }
    prec = c;
  }
  return ts.slice(inizio, i)
    .replace(/^export\s+/, '')
    .replace(/:\s*JsonMap(\s*[,)])/g, '$1')       // parametri tipati
    .replace(/\)\s*:\s*JsonMap\s*\{/, ') {')      // tipo di ritorno
    .replace(/:\s*JsonMap\s*=/g, ' =');           // variabili tipate nel corpo
}

const ctx = { console: { log() {}, warn() {}, error() {} } };
vm.createContext(ctx);
vm.runInContext(estraiSenzaTipi('fondiPayloadPrenotazione'), ctx);
vm.runInContext(
  estraiSenzaTipi('normalizzaSbId')
    .replace(/:\s*unknown/g, '')
    .replace(/\)\s*:\s*string \| undefined\s*\{/, ') {'),
  ctx);
vm.runInContext(
  estraiSenzaTipi('chiavePrenotazione')
    .replace(/booking\s*:\s*BookingRequest/, 'booking')
    .replace(/actorUserId\s*:\s*string/, 'actorUserId')
    .replace(/\)\s*:\s*string\s*\{/, ') {'),
  ctx);
const fondi = (nostro, gia) => ctx.fondiPayloadPrenotazione(nostro, gia);
const normalizza = (v) => ctx.normalizzaSbId(v);
const chiave = (booking, utente) => ctx.chiavePrenotazione(booking, utente);
const PRENOTAZIONE = { data: '2026-08-04', ora: '18:00', campo: 3 };

const casi = [];
const caso = (nome, fn) => casi.push({ nome, fn });

caso('1. riga nuova: passa la fotografia della creazione così com\'è', () => {
  const r = fondi({ tipo: 'lezione', nome: 'Marco', giocatori: [{ nome: 'A' }], id_reserva: '9245' }, {});
  return [r.tipo === 'lezione', r.id_reserva === '9245', r.giocatori.length === 1];
});

caso('2. 🚨 l\'app ha già scritto un roster PIÙ RICCO: l\'edge NON lo cancella', () => {
  // È il caso che rende pericoloso condividere la chiave. Senza questa regola, la fotografia
  // della creazione (2 giocatori) sostituirebbe il roster aggiornato (4).
  const nostro = { giocatori: [{ nome: 'A' }, { nome: 'B' }], tipo: 'partita' };
  const gia    = { giocatori: [{ nome: 'A' }, { nome: 'B' }, { nome: 'C' }, { nome: 'D' }] };
  return [fondi(nostro, gia).giocatori.length === 4];
});

caso('3. l\'app ha cambiato il TIPO: vince l\'app, non la fotografia', () => {
  return [fondi({ tipo: 'partita' }, { tipo: 'lezione' }).tipo === 'lezione'];
});

caso('4. ⭐ il BUCO lo riempie l\'edge: id_reserva che l\'app non poteva conoscere', () => {
  // Flusso asincrono: l'app salva prima di sapere il numero della prenotazione.
  const gia = { tipo: 'partita', giocatori: [{ nome: 'A' }], id_reserva: '' };
  return [fondi({ id_reserva: '9245', tipo: 'partita' }, gia).id_reserva === '9245'];
});

caso('5. campo del tutto ASSENTE nell\'esistente: lo mette l\'edge', () => {
  return [fondi({ istruttore: 'Marco' }, { tipo: 'lezione' }).istruttore === 'Marco'];
});

caso('6. elenco VUOTO conta come buco, non come scelta', () => {
  return [fondi({ giocatori: [{ nome: 'A' }] }, { giocatori: [] }).giocatori.length === 1];
});

caso('7. null e undefined nell\'esistente non cancellano il dato dell\'edge', () => {
  const r = fondi({ nome: 'Marco', note: 'x' }, { nome: null, note: undefined });
  return [r.nome === 'Marco', r.note === 'x'];
});

caso('8. i campi che SOLO l\'app conosce sopravvivono alla fusione', () => {
  const r = fondi({ tipo: 'partita' }, { promoted: true, ora_fine: '13:00' });
  return [r.promoted === true, r.ora_fine === '13:00'];
});

caso('9. uno ZERO non è un buco: 0 è un valore e resta', () => {
  return [fondi({ durata: 90 }, { durata: 0 }).durata === 0];
});

caso('10. «false» non è un buco', () => {
  return [fondi({ promoted: true }, { promoted: false }).promoted === false];
});

caso('11. non modifica gli oggetti ricevuti', () => {
  const nostro = { tipo: 'partita' }, gia = { tipo: 'lezione' };
  fondi(nostro, gia);
  return [nostro.tipo === 'partita', gia.tipo === 'lezione'];
});

caso('12. esistente mancante o vuoto non fa cadere la fusione', () => {
  return [fondi({ tipo: 'partita' }, null).tipo === 'partita',
          fondi({ tipo: 'partita' }, undefined).tipo === 'partita'];
});

caso('13. l\'id dell\'app passa così com\'è quando è un UUID', () => {
  return [normalizza('41e635df-f430-4450-b3f3-e3679c693588') === '41e635df-f430-4450-b3f3-e3679c693588'];
});

caso('14. ⛔ un id che contiene «|» è RIFIUTATO: fingerebbe una chiave composta', () => {
  return [normalizza('staff_booking|2026-08-03|18:00|Campo 3|altro-utente') === undefined];
});

caso('15. vuoto o assente ⇒ undefined, cioè «usa la chiave di prima» (è il caso del BOT)', () => {
  return [normalizza('') === undefined, normalizza(null) === undefined,
          normalizza(undefined) === undefined, normalizza('   ') === undefined];
});

caso('16. un id assurdamente lungo è rifiutato: finisce in una colonna indicizzata', () => {
  return [normalizza('x'.repeat(65)) === undefined, normalizza('x'.repeat(64)) === 'x'.repeat(64)];
});

caso('17. ⭐ con l\'id dell\'app la CHIAVE è quella dell\'app: una riga sola', () => {
  const k = chiave({ ...PRENOTAZIONE, sbId: '41e635df-f430-4450-b3f3-e3679c693588' }, 'utente-staff');
  return [k === '41e635df-f430-4450-b3f3-e3679c693588'];
});

caso('18. ⛔ SENZA id dell\'app resta la chiave composta: è il caso del BOT, e non si tocca', () => {
  const k = chiave({ ...PRENOTAZIONE }, 'consumer-assistente-soci');
  return [k === 'staff_booking|2026-08-04|18:00|Campo 3|consumer-assistente-soci'];
});

caso('19. un id malevolo con «|» NON diventa chiave: si ricade su quella composta', () => {
  const k = chiave({ ...PRENOTAZIONE, sbId: 'staff_booking|2026-08-04|18:00|Campo 3|altro' }, 'io');
  return [k === 'staff_booking|2026-08-04|18:00|Campo 3|io'];
});

caso('20. id vuoto o di soli spazi ⇒ chiave composta', () => {
  return [chiave({ ...PRENOTAZIONE, sbId: '' }, 'io').startsWith('staff_booking|'),
          chiave({ ...PRENOTAZIONE, sbId: '   ' }, 'io').startsWith('staff_booking|')];
});

// ── GUARDIE SUL SORGENTE DELL'EDGE ──────────────────────────────────────────────
// 🚨 La funzione pura può essere perfetta e il difetto restare: quello che conta è COME
//    l'edge la usa e QUALE CHIAVE sceglie. Queste guardano il codice, non il risultato.
// Il letterale che costruisce l'oggetto passato a chi scrive il record: `booking` si compone
// campo per campo, e chi non è elencato lì dentro NON ESISTE a valle.
const letteraleBooking = (() => {
  const i = ts.indexOf('const booking: BookingRequest = {');
  return i < 0 ? '' : ts.slice(i, ts.indexOf('};', i));
})();

const guardie = [
  ['l\'edge accetta `sbId` nella richiesta', /sbId\?\s*:\s*string/.test(ts)],

  // 🚨⭐⭐ LA GUARDIA CHE MANCAVA, e che è costata un deploy a vuoto il 3/08/2026.
  // La prima versione controllava solo che il codice DICESSE `clean(booking.sbId)` — ed era
  // verde mentre `sbId` non veniva mai copiato dentro `booking`: le due estremità giuste, il
  // valore che non attraversa il mezzo. Un controllo va poggiato sul DATO, non sulla parola.
  ['⭐⭐ `sbId` ARRIVA davvero dentro `booking` (non solo nominato)', /\bsbId\b/.test(letteraleBooking)],
  ['`sbId` viene ripulito prima di diventare una chiave', /const sbId = normalizzaSbId\(body\.sbId\)/.test(ts)],
  ['la pulizia dell\'id è una funzione a sé, provabile', /export function normalizzaSbId/.test(ts)],
  ['la chiave si decide in una funzione a sé', /export function chiavePrenotazione/.test(ts)],
  ['chi scrive il record usa QUELLA funzione', /const localKey = chiavePrenotazione\(booking, actor\.userId\)/.test(ts)],

  // ⭐⭐ Il punto per cui la prova a vuoto vale qualcosa: deve calcolare la chiave con LA STESSA
  // funzione del percorso vero. Con due espressioni gemelle, la prova potrebbe dire una cosa e
  // la scrittura farne un'altra — una prova che rassicura senza misurare.
  ['⭐⭐ la PROVA A VUOTO usa la stessa funzione del percorso vero',
   (ts.match(/chiavePrenotazione\(booking, actor\.userId\)/g) || []).length >= 2],
  // 🚨 Il confronto va fatto DENTRO il gestore della richiesta: `callWorkerCreateBooking(`
  // compare anche prima nel file, in un'altra funzione, e misurando su tutto il sorgente questa
  // guardia dava rosso su codice giusto. Si misura il percorso, non il file.
  ['la prova a vuoto esce PRIMA del worker e del ramo asincrono', (() => {
    const gestore = ts.slice(ts.indexOf('Deno.serve('));
    const iProva = gestore.indexOf('body.provaAVuoto === true');
    const iAsync = gestore.indexOf('body.async === true');
    const iWorker = gestore.indexOf('workerResult = await callWorkerCreateBooking');
    return iProva > 0 && iProva < iAsync && iProva < iWorker;
  })()],
  ['l\'edge DICHIARA che cosa sa fare', /export const FEATURES = \[/.test(ts) && /prova-a-vuoto-chiave/.test(ts)],
  ['prima di scrivere LEGGE la riga esistente', /\.select\('payload, deleted'\)/.test(ts)],
  ['⛔ non resuscita una prenotazione ANNULLATA', /esistente\?\.deleted === true\)\s*return/.test(ts)],
  ['usa la fusione invece di scrivere alla cieca', /payload = fondiPayloadPrenotazione\(/.test(ts)],
  ['la fusione è una funzione a sé, provabile', /export function fondiPayloadPrenotazione/.test(ts)],
  ['la fusione non scrive da sola sul database', !/\.upsert\(|\.insert\(|createClient\(/.test(estraiSenzaTipi('fondiPayloadPrenotazione'))],
];

let passati = 0, falliti = 0;
console.log('BANCO — una prenotazione, UNA riga nel cloud\n');
console.log('Guardie sul sorgente dell\'edge:');
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
