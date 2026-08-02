// ── BANCO: la raccolta degli ID INTERNI Matchpoint ───────────────────────────────
//
// Che cosa prova: che `pmoAssorbiIdInterniMatchpoint` attacchi al socio GIUSTO l'id
// interno che il worker ci manda dentro la risposta di una prenotazione — e soprattutto
// che NON lo attacchi a quello sbagliato.
//
// ⭐ Le funzioni NON sono ricopiate qui: vengono ESTRATTE da `index.html` e valutate.
//    Un banco che prova una copia del codice prova la copia, non il prodotto.
//
// 🚨 Il caso che conta è il 2°: Matchpoint dà a ogni cliente DUE numeri (codice cliente e
//    id interno) e capita che il codice di uno sia identico all'id interno di un altro —
//    Stefano Longato ha codice 001068 e id interno 1089, Alberto Modanese ha codice 001089.
//    Sono persone vere dell'anagrafica di PROD. Confondere le due numerazioni è ciò che il
//    2/08/2026 ha fatto sparire Laura Aprea da una lezione dicendo «✅ confermato».
//
// Uso:  node test/id-interno-matchpoint.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const INDEX = join(QUI, '..', 'index.html');
const html = readFileSync(INDEX, 'utf8');

// ── Estrazione delle funzioni dal file vero ──────────────────────────────────────
// Prende `function <nome>(...) { ... }` contando le graffe: basta e avanza per funzioni
// scritte in modo normale, e se il nome non c'è più il banco lo dice invece di fingere.
function estrai(nome) {
  const inizio = html.indexOf(`function ${nome}(`);
  if (inizio < 0) throw new Error(`funzione «${nome}» non trovata in index.html`);
  let i = html.indexOf('{', inizio), livello = 0, dentroStringa = null, prec = '';
  for (; i < html.length; i++) {
    const c = html[i];
    if (dentroStringa) {
      if (c === dentroStringa && prec !== '\\') dentroStringa = null;
    } else if (c === '"' || c === "'" || c === '`') {
      dentroStringa = c;
    } else if (c === '{') livello++;
    else if (c === '}') { livello--; if (livello === 0) { i++; break; } }
    prec = c;
  }
  return html.slice(inizio, i);
}

const NOMI = ['cleanCell', 'pmoIdMatchpoint', 'pmoIdInternoMatchpoint', 'pmoChiaveCodiceCliente',
              'pmoResolvedPlayersDaRisposta', 'pmoAssorbiIdInterniMatchpoint'];

// ── Guardia sulla BASE: se gli agganci sparissero, i casi qui sotto resterebbero verdi
//    lo stesso (provano la funzione, non il fatto che qualcuno la chiami). Perciò si
//    contano le CHIAMATE nel file: creazione prenotazione + modifica prenotazione.
const chiamate = (html.match(/pmoAssorbiIdInterniMatchpoint\(/g) || []).length - 1; // -1 = la definizione
const AGGANCI_ATTESI = 2;

// ── 🚨 Guardia sull'ANELLO DI MEZZO — aggiunta il 2/08/2026 dopo un guasto in produzione.
// I 13 casi qui sotto erano tutti verdi e il meccanismo NON funzionava: l'edge function
// `matchpoint-bookings-create` normalizzava i giocatori tenendo solo `{nome, codice}` e
// BUTTAVA `codiceCliente` — che l'app manda da sempre e che è il campo con cui si riconosce
// il socio. Il worker lo riceveva vuoto e lo restituiva vuoto.
// ⭐ Perché il banco non poteva vederlo: i dati finti dei casi hanno `codiceCliente`
//    valorizzato, cioè un valore che nella produzione NON arrivava mai. Un banco è cieco su
//    tutto ciò che sta a monte del punto in cui inietta i dati — e qui il guasto stava lì.
// ⇒ Si controlla che quella normalizzazione conservi il campo. Non prova che il dato arrivi
//   davvero (solo una prenotazione vera lo prova), ma impedisce che sparisca di nuovo in
//   silenzio da una riga a cui nessuno stava badando.
const EDGE = join(QUI, '..', 'supabase', 'functions', 'matchpoint-bookings-create', 'index.ts');
let edgeConserva = false, edgeLetta = false;
try {
  const edge = readFileSync(EDGE, 'utf8');
  edgeLetta = true;
  const blocco = edge.slice(edge.indexOf('const giocatori ='), edge.indexOf('const VALID_TIPOS'));
  edgeConserva = blocco.includes('codiceCliente');
} catch { /* file non trovato: resta falso e il banco lo dice */ }

// ── Il contesto finto in cui far girare il codice vero ───────────────────────────
function nuovoBanco(soci) {
  const salvataggi = [];
  const sincronizzati = [];
  const avvisi = [];
  const ctx = {
    giocatori: soci,
    save: (chiave, valore) => salvataggi.push({ chiave, quanti: (valore || []).length }),
    pmoBuildMemberCloudRecord: (m) => ({ record_type: 'member', local_key: m.id, payload: { ...m } }),
    pmoSyncCloudRecordsNow: (records) => { sincronizzati.push(records); return Promise.resolve({ ok: true }); },
    console: { info: () => {}, warn: (m) => avvisi.push(String(m)), log: () => {}, error: () => {} },
  };
  vm.createContext(ctx);
  vm.runInContext(NOMI.map(estrai).join('\n'), ctx);
  return { ctx, salvataggi, sincronizzati, avvisi };
}

// ── I soci: dati VERI di PROD (2/08/2026), non numeri inventati ──────────────────
// Il valore della produzione conta: con codici finti tipo '1'/'2' la collisione fra le
// due numerazioni non si presenterebbe mai, e il banco resterebbe verde per finta.
const SOCI_VERI = () => ([
  { id: 'a', firstName: 'Stefano',  surname: 'Longato',  memberId: '001068', matchpointIdInterno: '' },
  { id: 'b', firstName: 'Alberto',  surname: 'Modanese', memberId: '001089', matchpointIdInterno: '' },
  { id: 'c', firstName: 'Maurizio', surname: 'Aprea',    memberId: '000004', matchpointIdInterno: '4' },
  { id: 'd', firstName: 'Flavio',   surname: 'La Malfa', memberId: '000409', matchpointIdInterno: '' },
  { id: 'e', firstName: 'Laura',    surname: 'Aprea',    memberId: '000140', matchpointIdInterno: '' },
  { id: 'f', firstName: 'Marco',    surname: 'Aprea',    memberId: '000133', matchpointIdInterno: '' },
  { id: 'g', firstName: 'Socio',    surname: 'Senza Codice', memberId: '', pmoPlayerId: 'PMO-000999', matchpointIdInterno: '' },
]);

// ── I casi ───────────────────────────────────────────────────────────────────────
const casi = [];
const caso = (nome, fn) => casi.push({ nome, fn });
const idDi = (soci, chi) => (soci.find(s => s.id === chi) || {}).matchpointIdInterno;

caso('1. il socio prende il suo id interno dalla creazione di una prenotazione', () => {
  const soci = SOCI_VERI();
  const b = nuovoBanco(soci);
  const esito = b.ctx.pmoAssorbiIdInterniMatchpoint(
    { status: 'done', worker_result: { idReserva: '55', resolvedPlayers: [{ nome: 'Stefano Longato', codiceCliente: '001068', idPeople: '1089' }] } }, 'prova');
  return [esito.nuovi === 1, idDi(soci, 'a') === '1089', b.salvataggi.length === 1, b.sincronizzati.length === 1];
});

caso('2. 🚨 COLLISIONE: l\'id interno 1089 di Longato NON finisce a Modanese (codice 001089)', () => {
  const soci = SOCI_VERI();
  const b = nuovoBanco(soci);
  b.ctx.pmoAssorbiIdInterniMatchpoint(
    { worker: { resolvedPlayers: [{ nome: 'Stefano Longato', codiceCliente: '001068', idPeople: '1089' }] } }, 'prova');
  // Longato lo prende, Modanese resta INTATTO: è tutto il senso del lavoro.
  return [idDi(soci, 'a') === '1089', idDi(soci, 'b') === ''];
});

caso('3. il verso opposto: il codice 001089 di Modanese non ruba l\'id di nessuno', () => {
  const soci = SOCI_VERI();
  const b = nuovoBanco(soci);
  b.ctx.pmoAssorbiIdInterniMatchpoint(
    { worker: { resolvedPlayers: [{ nome: 'Alberto Modanese', codiceCliente: '001089', idPeople: '1111' }] } }, 'prova');
  return [idDi(soci, 'b') === '1111', idDi(soci, 'a') === ''];
});

caso('4. gli zeri davanti non cambiano la persona: 1068 e 001068 sono lo stesso codice', () => {
  const soci = SOCI_VERI();
  const b = nuovoBanco(soci);
  b.ctx.pmoAssorbiIdInterniMatchpoint(
    { worker: { resolvedPlayers: [{ nome: 'Stefano Longato', codiceCliente: '1068', idPeople: '1089' }] } }, 'prova');
  return [idDi(soci, 'a') === '1089'];
});

caso('5. più giocatori nella stessa prenotazione: uno solo giro di rete', () => {
  const soci = SOCI_VERI();
  const b = nuovoBanco(soci);
  const esito = b.ctx.pmoAssorbiIdInterniMatchpoint({ worker_result: { resolvedPlayers: [
    { nome: 'Laura Aprea', codiceCliente: '000140', idPeople: '147' },
    { nome: 'Marco Aprea', codiceCliente: '000133', idPeople: '140' },
    { nome: 'Flavio La Malfa', codiceCliente: '000409', idPeople: '425' },
  ] } }, 'prova');
  // ⭐ Marco ha id interno 140 e Laura codice 000140: nella STESSA risposta convivono i due
  //    numeri che si somigliano. Devono restare al loro posto.
  return [esito.nuovi === 3, idDi(soci, 'e') === '147', idDi(soci, 'f') === '140',
          idDi(soci, 'd') === '425', b.sincronizzati.length === 1, b.sincronizzati[0].length === 3];
});

caso('6. chi ce l\'ha già uguale non viene riscritto (niente scritture, niente rete)', () => {
  const soci = SOCI_VERI();
  const b = nuovoBanco(soci);
  const esito = b.ctx.pmoAssorbiIdInterniMatchpoint(
    { worker: { resolvedPlayers: [{ nome: 'Maurizio Aprea', codiceCliente: '000004', idPeople: '4' }] } }, 'prova');
  return [esito.nuovi === 0, esito.corretti === 0, b.salvataggi.length === 0, b.sincronizzati.length === 0];
});

caso('7. un id interno DIVERSO da quello salvato viene corretto, e lascia un avviso', () => {
  const soci = SOCI_VERI();
  const b = nuovoBanco(soci);
  const esito = b.ctx.pmoAssorbiIdInterniMatchpoint(
    { worker: { resolvedPlayers: [{ nome: 'Maurizio Aprea', codiceCliente: '000004', idPeople: '9' }] } }, 'prova');
  return [esito.corretti === 1, idDi(soci, 'c') === '9', b.avvisi.length === 1];
});

caso('8. codice che non è di nessun socio: non si ripiega sul NOME, non si scrive niente', () => {
  const soci = SOCI_VERI();
  const b = nuovoBanco(soci);
  // Il nome combacia con un socio vero, ma il codice no: chi ripiegasse sul nome scriverebbe.
  const esito = b.ctx.pmoAssorbiIdInterniMatchpoint(
    { worker: { resolvedPlayers: [{ nome: 'Stefano Longato', codiceCliente: '009999', idPeople: '7777' }] } }, 'prova');
  return [esito.ignoti === 1, esito.nuovi === 0, idDi(soci, 'a') === '', b.salvataggi.length === 0];
});

caso('9. voci senza id interno o senza codice: saltate in silenzio', () => {
  const soci = SOCI_VERI();
  const b = nuovoBanco(soci);
  const esito = b.ctx.pmoAssorbiIdInterniMatchpoint({ worker: { resolvedPlayers: [
    { nome: 'Ospite', codiceCliente: '', idPeople: '' },
    { nome: 'Tizio', codiceCliente: '001068' },
    { nome: 'Caio', idPeople: '1234' },
  ] } }, 'prova');
  return [esito.visti === 0, esito.nuovi === 0, b.salvataggi.length === 0];
});

caso('10. risposta simulata di TEST (nessun resolvedPlayers): non esplode, non scrive', () => {
  const soci = SOCI_VERI();
  const b = nuovoBanco(soci);
  const e1 = b.ctx.pmoAssorbiIdInterniMatchpoint({ ok: true, simulated: true, idReserva: 'x', worker: { idReserva: 'x' } }, 'prova');
  const e2 = b.ctx.pmoAssorbiIdInterniMatchpoint(null, 'prova');
  const e3 = b.ctx.pmoAssorbiIdInterniMatchpoint({ status: 'done', message: 'ok' }, 'prova');
  return [e1.visti === 0, e2.visti === 0, e3.visti === 0, b.salvataggi.length === 0];
});

caso('11. i due involucri diversi (creazione = worker_result, modifica = worker)', () => {
  const b1 = nuovoBanco(SOCI_VERI());
  const b2 = nuovoBanco(SOCI_VERI());
  const voce = [{ nome: 'Stefano Longato', codiceCliente: '001068', idPeople: '1089' }];
  return [b1.ctx.pmoAssorbiIdInterniMatchpoint({ worker_result: { resolvedPlayers: voce } }, 'x').nuovi === 1,
          b2.ctx.pmoAssorbiIdInterniMatchpoint({ worker: { resolvedPlayers: voce } }, 'x').nuovi === 1];
});

caso('12. un socio senza codice Matchpoint non viene agganciato da un codice vuoto', () => {
  const soci = SOCI_VERI();
  const b = nuovoBanco(soci);
  const esito = b.ctx.pmoAssorbiIdInterniMatchpoint(
    { worker: { resolvedPlayers: [{ nome: 'Socio Senza Codice', codiceCliente: '', idPeople: '555' }] } }, 'prova');
  return [esito.visti === 0, idDi(soci, 'g') === ''];
});

caso('13. 🚨 il codice cercato NON deve agganciare chi ha quel numero come ID INTERNO', () => {
  // Rocco ha id interno 1068, che è identico al CODICE cliente di Longato (001068 → 1068).
  // Cercando il codice 001068 si deve trovare Longato e nessun altro. Questo caso diventa
  // rosso il giorno in cui qualcuno facesse entrare l'id interno nel confronto — che è
  // esattamente il guasto riparato nel worker il 2/08/2026.
  // 🚨 Si prova con Rocco PRIMA e DOPO Longato nell'elenco. Scritto solo nel secondo ordine
  //    il caso restava verde anche col sabotaggio attivo: la ricerca si ferma al primo che
  //    combacia, quindi trovava Longato per motivi di ORDINE, non di correttezza. Un verde
  //    che dipende da com'è ordinato l'array non sta provando niente.
  const esiti = [];
  for (const roccoPrima of [true, false]) {
    const soci = SOCI_VERI();
    const rocco = { id: 'z', firstName: 'Rocco', surname: 'Collisione', memberId: '002000', matchpointIdInterno: '1068' };
    if (roccoPrima) soci.unshift(rocco); else soci.push(rocco);
    const b = nuovoBanco(soci);
    const esito = b.ctx.pmoAssorbiIdInterniMatchpoint(
      { worker: { resolvedPlayers: [{ nome: 'Stefano Longato', codiceCliente: '001068', idPeople: '1089' }] } }, 'prova');
    esiti.push(esito.nuovi === 1, idDi(soci, 'a') === '1089', idDi(soci, 'z') === '1068');
  }
  return esiti;
});

// ⚠️ NOTA ONESTA sul banco, scritta dopo averlo sabotato (2/08/2026): i casi 2 e 3 restano
// VERDI anche se la chiave normalizza togliendo gli zeri invece di aggiungerli. Non è un buco
// del banco: è che quella normalizzazione non è ciò che protegge dalla collisione — si applica
// a entrambi i lati del confronto, quindi cambiarla non cambia niente. A discriminare sul
// serio sono il caso 8 (chi ripiegasse sul NOME diventa rosso) e il 13 (chi facesse entrare
// l'id interno nel confronto diventa rosso). I casi 2 e 3 restano perché descrivono il
// comportamento atteso su due persone vere, ma da soli non provano la difesa.

// ── Esecuzione ───────────────────────────────────────────────────────────────────
let passati = 0, falliti = 0;
console.log('BANCO — raccolta degli ID interni Matchpoint\n');
console.log(`Guardia sulla base: ${chiamate} agganci nel file (attesi ${AGGANCI_ATTESI}) — ` +
            (chiamate === AGGANCI_ATTESI ? '✅' : '❌ se ne è perso uno: la funzione può essere perfetta e non venire MAI chiamata'));
if (chiamate !== AGGANCI_ATTESI) falliti++;
console.log(`Guardia sull'anello di mezzo: l'edge di creazione conserva «codiceCliente» — ` +
            (edgeConserva ? '✅' : (edgeLetta
              ? '❌ l\'edge lo BUTTA: il worker riceverà il codice vuoto e non si riconoscerà nessun socio'
              : '❌ non ho potuto leggere l\'edge: controllo MANCATO, non un via libera')));
if (!edgeConserva) falliti++;
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
