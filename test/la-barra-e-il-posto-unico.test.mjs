/* 🚦 «La barra è il posto unico dove si leggono le azioni» — banco della voce 137 ⑤ (03/09/2026 notte).
 *
 * 🗣️ LA VOCE È SUA, detta davanti a una barra che su PROD non si accendeva: «Tutti i messaggi di
 * azione li portiamo in una barra sotto il calendario. Si leggono tutte le azioni là.»
 *
 * ⭐⭐ COSA CAMBIA, ed è il motivo per cui questo banco esiste: fino a stanotte la barra aveva una
 * FONTE SOLA — la coda del worker, in fondo a quattro anelli (app → edge → worker → coda). Basta
 * che ne salti uno perché resti spenta **come se non stesse succedendo niente**, ed è successo:
 * gesto vero su PROD alle 23:10, scrittura partita, barra muta. Adesso c'è anche la fonte LOCALE,
 * che non passa da nessuna rete.
 *
 * 🎯 LA REGOLA CHE QUESTO BANCO DIFENDE PIÙ DI TUTTE, e che nessuna delle altre può sostituire:
 *    **«non è passata» si dice SOLO su un rifiuto pronunciato dal gestionale.**
 *    Una linea caduta, un timeout, un `esitoIgnoto` non sono un no — e scriverlo sul calendario
 *    spingerebbe la segreteria a rifare un gesto che può essere già passato, cioè a occupare due
 *    volte lo stesso campo. È la lezione della voce 72 su una superficie che guarda tutto il circolo.
 *
 * ⛔ QUELLO CHE QUESTO BANCO **NON** DICE — e va detto invece di lasciarlo credere:
 *    · gira senza browser ⇒ prova le REGOLE, non che la barra si VEDA. Che si veda lo dice il suo
 *      occhio su una partita vera, ed è la ragione per cui la voce resta aperta;
 *    · non prova l'aggancio alla `fetch` in esercizio: prova le funzioni pure che l'aggancio usa.
 *
 * Esegui:  node test/la-barra-e-il-posto-unico.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(QUI, '..', 'index.html'), 'utf8');
assert.ok(APP.length > 500000, 'sorgente non letto: questo banco non direbbe niente');

let passed = 0, failed = 0;
function test(nome, fn) {
  try { fn(); passed++; console.log('ok   - ' + nome); }
  catch (e) { failed++; console.log('FAIL - ' + nome + '\n       ' + e.message); }
}

/** Dove finisce `function nome(`: l'indice DOPO la sua graffa di chiusura.
 *  ⚠️ Le graffe si contano dalla prima del CORPO e non dalla firma. */
function dichiarazioneDi(nome) {
  const i = APP.indexOf('function ' + nome + '(');
  assert.ok(i > 0, 'funzione non trovata: ' + nome);
  const apre = APP.indexOf(') {', i);
  let g = 0, visto = false, k = apre + 2;
  for (; k < APP.length; k++) {
    const c = APP[k];
    if (c === '{') { g++; visto = true; }
    else if (c === '}') { g--; if (visto && g === 0) { k++; break; } }
  }
  return APP.slice(i, k);
}

/** La const `NOME = { … };` intera, per poterla ESEGUIRE. */
function costanteDi(nome) {
  const i = APP.indexOf('const ' + nome + ' = {');
  assert.ok(i > 0, 'costante non trovata: ' + nome);
  const apre = APP.indexOf('{', i);
  let g = 0, k = apre;
  for (; k < APP.length; k++) {
    const c = APP[k];
    if (c === '{') g++;
    else if (c === '}') { g--; if (g === 0) { k++; break; } }
  }
  return APP.slice(i, k) + ';';
}

// Le regole vere dell'app, ESEGUITE — non cercate con una regex.
const MAPPA = new Function(costanteDi('SVC_AZIONI_DELLAPP') + '\nreturn SVC_AZIONI_DELLAPP;')();
const azioneDaChiamata = new Function(
  'SVC_AZIONI_DELLAPP',
  dichiarazioneDi('svcAzioneDaChiamata') + '\n' + dichiarazioneDi('svcDoveDelGesto') + '\nreturn svcAzioneDaChiamata;'
)(MAPPA);
const doveDelGesto = new Function(dichiarazioneDi('svcDoveDelGesto') + '\nreturn svcDoveDelGesto;')();
const esitoDellaRisposta = new Function(dichiarazioneDi('svcEsitoDellaRisposta') + '\nreturn svcEsitoDellaRisposta;')();
const esitoDelLavoro = new Function(dichiarazioneDi('svcEsitoDelLavoro') + '\nreturn svcEsitoDelLavoro;')();

const U = (fn) => 'https://x.supabase.co/functions/v1/' + fn;

// ════════════════════════════════════════════════════════════════════════════════════════
test('① LE DUE TRAPPOLE DELLA 137: aprire una scheda e cercare un telefono NON accendono niente', () => {
  // 🚨 Trappola ①: la lettura autorevole dei giocatori passa da `edit` con `read:true`. Chi
  //    guardasse il solo nome dell'op vedrebbe «sta modificando una prenotazione» ogni volta che
  //    qualcuno APRE una scheda — cioè la barra accesa quasi sempre, che è come si perde un
  //    avviso senza toglierlo.
  assert.equal(
    azioneDaChiamata(U('matchpoint-bookings-edit'), { campo: 3, data: '2026-09-05', ora: '15:00', read: true }),
    null, 'aprire una scheda accende la barra: diventerebbe uno sfondo');
  // 🚨 Trappola ②: la ricerca per telefono prima di creare un socio non crea niente.
  assert.equal(
    azioneDaChiamata(U('matchpoint-clients-create'), { telefono: '3331234567', soloRicerca: true }),
    null, 'cercare un telefono annuncia un «nuovo cliente» che non nasce');
  // E le stesse due chiamate SENZA il flag sono azioni vere: se questa metà non passasse, la
  // difesa qui sopra starebbe spegnendo tutto invece di filtrare.
  assert.equal(azioneDaChiamata(U('matchpoint-bookings-edit'), { campo: 3, data: '2026-09-05', ora: '15:00' }).che,
    'modifica di una prenotazione');
  assert.equal(azioneDaChiamata(U('matchpoint-clients-create'), { telefono: '3331234567' }).che, 'nuovo cliente');
});

test('② IL SYNC AUTOMATICO NON SI VEDE — è la sua decisione, ed è quella che regge tutto il resto', () => {
  // 🗣️ «Ogni due minuti la pagina si aggiorna con i dati importati da Matchpoint. Questo io non
  //    vorrei vederlo sul calendario segnalato.»
  for (const fn of ['matchpoint-bookings-sync', 'matchpoint-clients-sync', 'matchpoint-history-sync',
                    'matchpoint-slot-schedule-sync', 'matchpoint-payments-sync', 'matchpoint-wallet-sync',
                    'matchpoint-wallet-read', 'matchpoint-queue-status']) {
    assert.equal(azioneDaChiamata(U(fn), {}), null, fn + ' accende la barra: il traffico automatico si vedrebbe');
  }
  // E una funzione che NON è del gestionale non deve essere nemmeno guardata.
  assert.equal(azioneDaChiamata(U('consumer-booking-write'), { campo: 1 }), null);
  assert.equal(azioneDaChiamata('https://x.supabase.co/rest/v1/member?select=*', null), null);
});

test('③ 🚨 L\'ELENCO NON SI PUÒ DIMENTICARE: ogni edge che l\'app chiama dev\'essere classificata', () => {
  /* ⭐⭐ È IL CASO CHE VALE PIÙ DI TUTTI, e non prova il codice di oggi: protegge quello di domani.
     Una lista bianca scritta a mano si dimentica — in questa stessa voce è già successo due volte
     (`MP_INTERACTIVE_OPS` senza i soldi, `HANDLER_CHE_APRONO_UN_BROWSER` senza `handleSetCharge`).
     ⇒ Qui si legge dal SORGENTE quali edge `matchpoint-*` l'app chiama davvero, e si pretende che
     ognuna abbia una riga nella mappa: o una frase, o un `null` che dichiara «non si vede».
     📌 Il giorno in cui nascerà un gesto nuovo, questo caso diventerà rosso — che è l'unico modo
        perché qualcuno se ne accorga prima del calendario del circolo. */
  const chiamate = new Set();
  const re = /\/functions\/v1\/(matchpoint-[a-z0-9-]+)/gi;
  let m;
  while ((m = re.exec(APP)) !== null) chiamate.add(m[1].toLowerCase());
  assert.ok(chiamate.size >= 12, 'trovate solo ' + chiamate.size + ' edge: la sonda sta guardando male');
  const orfane = [...chiamate].filter((c) => !Object.prototype.hasOwnProperty.call(MAPPA, c));
  assert.equal(orfane.length, 0,
    'edge chiamate dall\'app e non classificate — o si vedono, o si dichiara che non si vedono: ' + orfane.join(', '));
});

test('④ IL «DOVE» O È COMPLETO O NON C\'È: mezze coordinate accenderebbero una colonna intera', () => {
  assert.deepEqual(doveDelGesto({ campo: 3, data: '2026-09-05', ora: '15:00' }), { campo: 3, data: '2026-09-05', ora: '15:00' });
  assert.deepEqual(doveDelGesto({ campo: 'Campo 3', data: '2026-09-05', ora: '9:30' }), { campo: 3, data: '2026-09-05', ora: '9:30' });
  assert.equal(doveDelGesto({ campo: 3, data: '2026-09-05' }), null, 'senza ora si accenderebbe tutto il campo');
  assert.equal(doveDelGesto({ data: '2026-09-05', ora: '15:00' }), null);
  assert.equal(doveDelGesto({ campo: 3, data: '05/09/2026', ora: '15:00' }), null, 'una data non ISO non è il giorno mostrato');
  assert.equal(doveDelGesto({}), null);
  assert.equal(doveDelGesto(null), null);
  // Un annullo che lavora per `idReserva` non porta coordinate: è normale, non è un guasto — la
  // barra parla lo stesso, ed è per questo che la disposizione D ha DUE metà.
  assert.equal(azioneDaChiamata(U('matchpoint-bookings-cancel'), { idReserva: '99887' }).dove, null);
});

test('⑤ 🚨⭐⭐ «NON È PASSATA» SOLO SU UN RIFIUTO PRONUNCIATO — il resto è «non lo so»', () => {
  // La riga che costa: un falso «non è passata» fa rifare un gesto che può essere già passato.
  assert.equal(esitoDellaRisposta(false, null, true), 'ignoto', 'una linea caduta non è un no');
  assert.equal(esitoDellaRisposta(true, { ok: false, esitoIgnoto: true }, false), 'ignoto');
  assert.equal(esitoDellaRisposta(false, { ok: false, error: 'WORKER_ESITO_IGNOTO' }, false), 'ignoto');
  assert.equal(esitoDellaRisposta(false, { ok: false, error: 'QUEUE_TIMEOUT' }, false), 'ignoto');
  assert.equal(esitoDellaRisposta(false, { ok: false, error: 'WORKER_UNREACHABLE' }, false), 'ignoto');
  // …e il rifiuto vero resta un rifiuto: se anche questo diventasse «non lo so», la difesa qui
  // sopra avrebbe cancellato l'informazione invece di proteggerla.
  assert.equal(esitoDellaRisposta(false, { ok: false, error: 'SLOT_OCCUPATO' }, false), 'rifiutato');
  assert.equal(esitoDellaRisposta(true, { ok: false, message: 'orario non disponibile' }, false), 'rifiutato');
  assert.equal(esitoDellaRisposta(true, { ok: true }, false), 'fatto');
});

test('⑥ UN LAVORO ASINCRONO APPENA PARTITO NON È FINITO', () => {
  // 🚨 Una prenotazione `async` risponde `ok` con un numero di lavoro e la risposta vera arriva
  //    minuti dopo. Chiuderla qui direbbe «✅ fatto» di una cosa non ancora fatta — cioè
  //    esattamente il difetto della voce 75 (il bot che diceva «Prenotato» prima della conferma)
  //    riprodotto sul calendario della segreteria.
  assert.equal(esitoDellaRisposta(true, { ok: true, jobId: 'j-1' }, false), null, 'un lavoro accodato viene dato per fatto');
  assert.equal(esitoDellaRisposta(true, { ok: true, status: 'queued' }, false), null);
  // È il POLLING del lavoro a chiuderla, ed è l'unico che sappia come finisce.
  assert.equal(esitoDelLavoro(U('matchpoint-bookings-create') + '?jobId=j-1', { status: 'done' }), 'fatto');
  assert.equal(esitoDelLavoro(U('matchpoint-bookings-create') + '?jobId=j-1', { status: 'error' }), 'rifiutato');
  assert.equal(esitoDelLavoro(U('matchpoint-bookings-create') + '?jobId=j-1', { status: 'running' }), null);
  // …e quel polling non deve accendere una SECONDA azione: si vedrebbero due prenotazioni dove
  // ce n'è una sola.
  assert.equal(azioneDaChiamata(U('matchpoint-bookings-create') + '?jobId=j-1', null), null);
  // Una risposta senza `jobId` nell'url non è un aggiornamento di lavoro, per quanto assomigli.
  assert.equal(esitoDelLavoro(U('matchpoint-bookings-create'), { status: 'done' }), null);
});

test('⑦ IL DISEGNO GUARDA ENTRAMBE LE FONTI, e la LOCALE ha la precedenza', () => {
  /* ⚖️ Questo caso è TESTUALE e va detto per quello che è: `svcRidisegnaSemaforo` tocca il DOM,
     qui non c'è un browser. Prova che le tre righe che rendono la barra a due fonti ci siano —
     non che disegnino bene. Che disegni bene lo dice il suo occhio. */
  const src = dichiarazioneDi('svcRidisegnaSemaforo');
  assert.match(src, /const loc = _svcAzioneLocale;/, 'il disegno non guarda la fonte locale');
  assert.match(src, /remotoFresco/, 'il remoto non scade: un gesto finito resterebbe acceso per sempre');
  assert.match(src, /loc \? loc\.chi : sem\.chi/, 'la locale non ha la precedenza sul «chi»');
  // ⛔ La cella si spegne su un esito: accesa vuol dire «qui sta succedendo adesso».
  assert.match(src, /svcAccendiCella\(finita \? null : dove\)/, 'la cella resta accesa su un\'azione finita');
  // 🚨 E l'aggancio non deve poter far fallire una scrittura: la risposta torna intatta e il
  //    rigetto viene rilanciato. Un'app che non prenota più perché una barra è rotta sarebbe un
  //    danno molto più grande del difetto che questa voce cura.
  const agg = APP.slice(APP.indexOf('function svcAggancioDelleAzioni('));
  const pezzo = agg.slice(0, 3000);
  assert.match(pezzo, /return risposta;/, 'la risposta non torna al chiamante: l\'app si romperebbe');
  assert.match(pezzo, /throw err;/, 'il rigetto viene ingoiato: un errore di rete sparirebbe');
});

console.log('\n' + passed + ' passati, ' + failed + ' falliti');
process.exit(failed ? 1 : 0);
