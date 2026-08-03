// ── BANCO: «quale copia mostrare quando lo stesso slot ne ha due» ────────────────
//
// Che cosa prova: che `pmoStaffBookingScegliCopia` mostri la copia GIUSTA quando la stessa
// prenotazione sta nel cloud due volte (la scrivono l'edge e l'app, con due chiavi diverse:
// 36 casi su 84 misurati su PROD il 3/08/2026), SENZA rompere i casi in cui le due voci sullo
// stesso slot non sono affatto due copie.
//
// 🚨⭐⭐ Il caso 5 è il motivo per cui questa funzione non è un `if` di tre righe. La regola
//    ovvia — «tieni la più ricca» — mostrerebbe la prenotazione VECCHIA quando si annulla e si
//    riprenota lo stesso slot con meno giocatori: il fantasma del 20/07 rifatto da capo.
//    Il discriminante è `idReserva`, che le due copie CONDIVIDONO e una riprenotazione no.
//
// ⭐ Le funzioni sono ESTRATTE da index.html, non ricopiate.
//
// Uso:  node test/prenotazioni-copia-migliore.test.mjs
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
  const asincrona = html.slice(Math.max(0, inizio - 6), inizio) === 'async ';
  return (asincrona ? 'async ' : '') + html.slice(inizio, i);
}

const ctx = { console: { info() {}, warn() {}, log() {}, error() {} } };
vm.createContext(ctx);
vm.runInContext([estrai('pmoStaffBookingQuantoDice'), estrai('pmoStaffBookingScegliCopia')].join('\n'), ctx);

// ⭐ Ogni confronto si prova nei DUE versi: dal cloud le voci non arrivano in un ordine
// garantito, e una regola asimmetrica darebbe una card che cambia da sola a ogni giro.
const scegli = (a, b) => {
  const ab = ctx.pmoStaffBookingScegliCopia(a, b);
  const ba = ctx.pmoStaffBookingScegliCopia(b, a);
  if (ab !== ba) throw new Error('la scelta NON è simmetrica: dipende dall\'ordine di arrivo');
  return ab;
};

// Una voce come la tiene l'app in `staffBookings`.
const voce = (etichetta, extra = {}) => ({
  etichetta,
  data: '2026-08-03', ora: '18:00', campo: '3', durata: '90',
  tipo: 'partita', istruttore: '', nome: 'Qualcuno',
  giocatori: [{ nome: 'Qualcuno', codice: '' }],
  idReserva: '9213', updatedAt: '2026-07-30T15:20:33Z',
  ...extra,
});

const casi = [];
const caso = (nome, fn) => casi.push({ nome, fn });

caso('1. copie gemelle: vince chi ha il TIPO — senza, la card mente sul genere', () => {
  const edge = voce('edge', { tipo: '', updatedAt: '2026-08-01T10:00:00Z' });   // più RECENTE
  const app  = voce('app',  { tipo: 'lezione', updatedAt: '2026-07-30T15:20:33Z' });
  return [scegli(edge, app).etichetta === 'app'];
});

caso('2. copie gemelle: vince chi ha PIÙ GIOCATORI — il caso vero di campo 3, 18:00', () => {
  const edge = voce('edge', { giocatori: [{ nome: 'Ospite', codice: '' }] });
  const app  = voce('app',  { giocatori: [
    { nome: 'Ospite', codice: '' }, { nome: 'Ospite', codice: '' },
    { nome: 'Ospite', codice: '' }, { nome: 'Myroslava Myroslava', codice: '' }] });
  return [scegli(edge, app).etichetta === 'app', scegli(edge, app).giocatori.length === 4];
});

caso('3. a parità di giocatori vince chi li sa NOMINARE — il caso vero di campo 1, 12:30', () => {
  const edge = voce('edge', { idReserva: '9245', giocatori: [
    { nome: 'Matteo Borghetto', codice: '' }, { nome: 'Maurizio Aprea', codice: '4' }] });
  const app  = voce('app', { idReserva: '9245', giocatori: [
    { nome: 'Matteo Borghetto', codice: '', codiceCliente: '000189' },
    { nome: 'Maurizio Aprea', codice: '4', codiceCliente: '000004' }] });
  return [scegli(edge, app).etichetta === 'app'];
});

caso('4. sulle lezioni pesa anche il MAESTRO', () => {
  const senza = voce('senza', { tipo: 'lezione', istruttore: '' });
  const con   = voce('con',   { tipo: 'lezione', istruttore: 'Marco' });
  return [scegli(senza, con).etichetta === 'con'];
});

caso('5. 🚨 RIPRENOTAZIONE: id_reserva DIVERSO ⇒ vince la più RECENTE anche se più povera', () => {
  // Annullata la partita da 4 e riprenotato lo stesso slot per 2: mostrare la vecchia perché
  // «più ricca» significherebbe mostrare una prenotazione che non esiste più.
  const vecchia = voce('vecchia', { idReserva: '9213', updatedAt: '2026-07-30T15:20:33Z',
    giocatori: [{ nome: 'A', codice: '1' }, { nome: 'B', codice: '2' },
                { nome: 'C', codice: '3' }, { nome: 'D', codice: '4' }] });
  const nuova   = voce('nuova',   { idReserva: '9999', updatedAt: '2026-08-03T09:00:00Z',
    giocatori: [{ nome: 'E', codice: '' }] });
  return [scegli(vecchia, nuova).etichetta === 'nuova'];
});

caso('6. record VECCHI senza id_reserva: non si può dimostrare che siano gemelli ⇒ come prima', () => {
  const povera_recente = voce('recente', { idReserva: '', updatedAt: '2026-08-03T09:00:00Z',
    giocatori: [], tipo: '' });
  const ricca_vecchia  = voce('vecchia', { idReserva: '', updatedAt: '2026-07-30T15:20:33Z',
    giocatori: [{ nome: 'A' }, { nome: 'B' }] });
  return [scegli(povera_recente, ricca_vecchia).etichetta === 'recente'];
});

caso('7. una sola delle due ha id_reserva ⇒ non sono dimostrabilmente gemelle: la più recente', () => {
  const senza = voce('senza', { idReserva: '', updatedAt: '2026-08-03T09:00:00Z', giocatori: [] });
  const con   = voce('con',   { idReserva: '9213', updatedAt: '2026-07-30T15:20:33Z' });
  return [scegli(senza, con).etichetta === 'senza'];
});

caso('8. gemelle che dicono le stesse identiche cose ⇒ la più recente', () => {
  const vecchia = voce('vecchia', { updatedAt: '2026-07-30T15:20:33Z' });
  const nuova   = voce('nuova',   { updatedAt: '2026-08-03T09:00:00Z' });
  return [scegli(vecchia, nuova).etichetta === 'nuova'];
});

caso('9. il TIPO conta più del numero di giocatori: una lezione non deve diventare partita', () => {
  const senzaTipo = voce('senzaTipo', { tipo: '', giocatori: [{ nome: 'A' }, { nome: 'B' }, { nome: 'C' }] });
  const conTipo   = voce('conTipo',   { tipo: 'lezione', giocatori: [{ nome: 'A' }] });
  return [scegli(senzaTipo, conTipo).etichetta === 'conTipo'];
});

caso('10. una voce mancante non fa cadere la scelta', () => {
  const v = voce('v');
  return [ctx.pmoStaffBookingScegliCopia(null, v) === v,
          ctx.pmoStaffBookingScegliCopia(v, null) === v,
          ctx.pmoStaffBookingScegliCopia(null, null) === null];
});

caso('11. giocatori assente o non un elenco: conta zero, non esplode', () => {
  const rotta = voce('rotta', { giocatori: undefined });
  const sana  = voce('sana',  { giocatori: [{ nome: 'A' }] });
  return [scegli(rotta, sana).etichetta === 'sana'];
});

caso('12. le stringhe di soli spazi NON contano come dato presente', () => {
  const spazi = voce('spazi', { tipo: '   ', istruttore: '  ' , giocatori: [{ nome: 'A', codice: '  ' }] });
  const vero  = voce('vero',  { tipo: 'lezione', istruttore: 'Marco', giocatori: [{ nome: 'A', codice: '7' }] });
  return [scegli(spazi, vero).etichetta === 'vero'];
});

// ── GUARDIE SULLA BASE ──────────────────────────────────────────────────────────
const corpoScegli = estrai('pmoStaffBookingScegliCopia');
const corpoQuanto = estrai('pmoStaffBookingQuantoDice');
const iDedup = html.indexOf('const _bySlot = new Map();');
const bloccoDedup = iDedup < 0 ? '' : html.slice(iDedup, iDedup + 400);

const guardie = [
  ['le due funzioni esistono', !!corpoScegli && !!corpoQuanto],
  // ⭐⭐ La guardia che conta: una funzione pura giusta non serve a niente se il calendario
  // non la chiama. È il punto in cui il difetto sarebbe rimasto invisibile.
  ['il calendario la CHIAMA nel punto che sceglie la card', /pmoStaffBookingScegliCopia\(/.test(bloccoDedup)],
  ['non è rimasto il vecchio confronto a occhi chiusi', !/String\(b\.updatedAt\|\|''\) > String\(prev\.updatedAt\|\|''\)/.test(bloccoDedup)],
  ['la scelta NON scrive nel cloud', !/pmoSyncCloudRecordsNow\(|pmoCloudRpc\(|pmoStaffRpcPaged\(/.test(corpoScegli)],
  ['la scelta non cancella niente', !/splice\(|delete /.test(corpoScegli)],
  ['il discriminante è idReserva', /idReserva/.test(corpoScegli)],
  // 🚨 Questa guardia era scritta male e dava ROSSO su codice giusto: cercava la parola
  // «giocatori», che qui è il NOME DI UN CAMPO (`b.giocatori`) e non la variabile globale.
  // Un controllo che trova sé stesso. Si cercano gli atti, non le parole.
  ['è pura: non salva e non legge lo stato globale',
   !/\bsave\(|localStorage|\bwindow\.|\bgiocatori\s*[=.[]|\bstaffBookings\b/.test(corpoScegli + corpoQuanto)],
];

let passati = 0, falliti = 0;
console.log('BANCO — quale copia mostrare quando lo stesso slot ne ha due\n');
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
