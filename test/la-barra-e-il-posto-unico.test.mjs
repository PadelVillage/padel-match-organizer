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

/** Le sole righe di CODICE di un testo: via i commenti.
 *  🩹⭐ Una guardia deve rompersi su ciò che è sbagliato, non su ciò che ne PARLA: il commento
 *  che spiega perché la scheda non si apre da sé contiene la parola `svcOpenChat`. */
function soloCodice(testo) {
  return String(testo).split('\n').filter(function (r) {
    return !/^\s*(\/\/|\*|\/\*)/.test(r);
  }).join('\n');
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
function costanteArray(nome) {
  const i = APP.indexOf('const ' + nome + ' = [');
  assert.ok(i > 0, 'costante non trovata: ' + nome);
  const apre = APP.indexOf('[', i);
  let g = 0, k = apre;
  for (; k < APP.length; k++) {
    const c = APP[k];
    if (c === '[') g++;
    else if (c === ']') { g--; if (g === 0) { k++; break; } }
  }
  return APP.slice(i, k) + ';';
}
const azioneDaChiamata = new Function(
  'SVC_AZIONI_DELLAPP',
  dichiarazioneDi('svcAzioneDaChiamata') + '\n' + dichiarazioneDi('svcDoveDelGesto') + '\n'
    + dichiarazioneDi('svcAffinaEdit') + '\nreturn svcAzioneDaChiamata;'
)(MAPPA);
const affinaEdit = new Function(dichiarazioneDi('svcAffinaEdit') + '\nreturn svcAffinaEdit;')();
const ESITI = new Function(costanteDi('SVC_ESITI') + '\nreturn SVC_ESITI;')();
const fraseDellEsito = new Function(
  costanteDi('SVC_ESITI') + '\n' + dichiarazioneDi('svcFraseDellEsito') + '\nreturn svcFraseDellEsito;')();
const motivoDelRifiuto = new Function(dichiarazioneDi('svcMotivoDelRifiuto') + '\nreturn svcMotivoDelRifiuto;')();
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
  assert.equal(azioneDaChiamata(U('matchpoint-bookings-edit'), { campo: 3, data: '2026-09-05', ora: '15:00' }).soggetto, 'Prenotazione');
  assert.equal(azioneDaChiamata(U('matchpoint-clients-create'), { telefono: '3331234567' }).soggetto, 'Cliente');
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

const vaSoloNellaBarra = new Function(
  costanteArray('SVC_ESITI_NELLA_SCHEDA') + '\n' + costanteArray('SVC_AVANZAMENTI_NELLA_BARRA')
    + '\n' + dichiarazioneDi('svcMessaggioVaSoloNellaBarra')
    + '\nreturn svcMessaggioVaSoloNellaBarra;')();
const eAvanzamento = new Function(
  dichiarazioneDi('svcEAvanzamentoInCorso') + '\nreturn svcEAvanzamentoInCorso;')();

test('⑧ 🚨 LA STRISCIA HA DUE CASE E NESSUNA DELLE DUE PUÒ FINIRE FUORI SCHERMO', () => {
  /* 📏 Il fatto che questa guardia difende, e che è stato PAGATO: su PROD 6.307 la barra
     ESISTEVA, l'aggancio era attivo, markup e CSS erano quelli giusti — e stava a `top: 894`
     con la finestra alta 900. Ancorata alla colonna con `bottom:0` finiva in fondo al
     CALENDARIO, che è più alto dello schermo. Ogni misura fatta prima era vera e nessuna
     chiedeva *si vede?*.
     🔄 RISCRITTA il 04/09/2026 col restyling: la striscia non è più una barra sotto il
     calendario, ha due case — dentro la scheda quando è aperta, pastiglia quando è chiusa.
     ⇒ L'invariante da difendere NON è più «si allinea alla colonna» (che era il mezzo), è
     **«non può finire dove non si vede»** (che era il fine). La pastiglia prende dalla colonna
     un suggerimento e poi si TAGLIA dentro la finestra: è il taglio la regola. */
  const i = APP.indexOf('.svc-semaforo {');
  assert.ok(i > 0, 'manca la regola CSS della striscia');
  const regola = APP.slice(i, APP.indexOf('}', i));
  assert.match(regola, /position:fixed/, 'la striscia è tornata ancorata a un elemento: finirebbe sotto lo schermo');
  assert.ok(!/position:absolute/.test(regola), 'position:absolute è tornato: è il difetto di 6.307');

  // ① La pastiglia si taglia DENTRO la finestra, in tutt'e due le direzioni.
  const pos = dichiarazioneDi('svcPosizionaPastiglia');
  assert.match(pos, /window\.innerHeight/, 'la pastiglia non guarda l\'altezza della finestra: può finire sotto il bordo');
  assert.match(pos, /window\.innerWidth/, 'la pastiglia non guarda la larghezza della finestra: può finire oltre il bordo destro');
  assert.match(pos, /Math\.min\(Math\.max\(/, 'il valore calcolato non è tagliato: un suggerimento senza taglio è il difetto di 6.307');

  // ② Il disegno sceglie la casa a OGNI giro: la scheda si apre e si chiude sotto la striscia,
  //    e una striscia rimasta dentro una finestra chiusa è il silenzio.
  const dis = dichiarazioneDi('svcRidisegnaSemaforo');
  assert.match(dis, /svcSchedaAperta\(\)/, 'il disegno non guarda se la scheda è aperta: la striscia resterebbe dove capita');
  assert.match(dis, /svc-semaforo-in-scheda/, 'manca la casa dentro la scheda');
  assert.match(dis, /svc-semaforo-pastiglia/, 'manca la pastiglia');
  assert.match(dis, /appendChild\(el\)/, 'la striscia non trasloca: resta dov\'era anche quando la casa cambia');

  // ③ Aprire e chiudere la scheda RIDISEGNA: senza, la striscia resta nella casa sbagliata.
  for (const f of ['svcOpenChat', 'svcCloseChat']) {
    assert.match(dichiarazioneDi(f), /svcRidisegnaSemaforo\(\)/, f + ' non ridisegna la striscia: resterebbe nella casa sbagliata');
  }
});

test('⑧b ⛔ LA SCHEDA NON SI APRE DA SÉ: la pastiglia si CLICCA', () => {
  /* 🗣️ Sua scelta del 04/09 fra le due, dopo il mockup: pastiglia, non apertura automatica.
     ⚖️ La ragione è di sicurezza e non di gusto: chi fa segreteria è quasi sempre dentro un
     altro gesto, e nella scheda ogni bottone scrive su Matchpoint. Una finestra che si apre
     QUANDO DECIDE IL SOCIO COL BOT si prende il click già partito.
     🚨 Questa guardia si romperebbe se qualcuno, per «comodità», facesse aprire la scheda dal
     disegno della striscia — cioè dal punto in cui arriva la notizia di un gesto altrui. */
  const dis = dichiarazioneDi('svcRidisegnaSemaforo');
  assert.ok(!/svcOpenChat\(\)/.test(soloCodice(dis)),
    'il disegno della striscia apre la scheda da sé: è la cosa che è stata scartata');
  // La pastiglia però DEVE essere una via: senza click sopra, un gesto altrui non si può aprire.
  assert.match(dis, /el\.onclick = dentro \? null : svcApriDallaPastiglia/,
    'la pastiglia non è cliccabile, oppure lo è anche la striscia dentro la scheda');
  const apri = dichiarazioneDi('svcApriDallaPastiglia');
  /* 🩹 05/09/2026 — qui si pretendeva `celle[i].click()`, cioè il ciclo che cercava
     `.cell[data-campo]`: un selettore che nella pagina viva non trova mai niente. La ricerca è
     diventata una sola funzione condivisa con `svcAccendiCella`, e la pretesa si sposta su
     QUELLA — perché il fatto da difendere non è come si cerca la cella, è che la si CLICCHI
     invece di riscrivere l'apertura di una scheda. */
  assert.match(apri, /svcCellaDelleCoordinate\(/, 'la pastiglia non cerca più la cella del gesto');
  assert.match(apri, /cella\.click\(\)/, 'la pastiglia non apre la scheda della cella: riscriverebbe l\'apertura');
  assert.match(apri, /svcOpenChat\(\)/, 'senza ripiego: con la cella fuori vista la pastiglia non farebbe niente');
});

test("⑨ AVANZAMENTI ED ESITI ESCONO DALLA SCHEDA — LE DOMANDE DELL'ASSISTENTE NO", () => {
  // 🗣️ «Vorrei levare tutti i messaggi dentro la scheda.» — detto dopo aver visto la scheda e la
  //    barra raccontare la stessa cosa due volte.
  assert.equal(vaSoloNellaBarra('<span class="mp-sync-head">⏳ <strong>Sto elaborando la richiesta su Matchpoint</strong></span> · modifica: Campo 3'), true);
  assert.equal(vaSoloNellaBarra('⏳ Aggiorno la lista giocatori da Matchpoint… (3s · puoi già modificare)'), true);
  assert.equal(vaSoloNellaBarra('Lista giocatori aggiornata da Matchpoint.'), true);
  // ② GLI ESITI di un gesto su Matchpoint escono anche loro (04/09): «leverei totalmente tutti i
  //    messaggi da dentro la scheda». La barra li ha presi in carico, e lì un rifiuto NON se ne va
  //    da solo — vedi ⑪. Senza quella metà questa sarebbe una perdita di informazione.
  assert.equal(vaSoloNellaBarra('❌ Modifica non riuscita (Campo 3 · 05/09/2026): slot occupato'), true);
  assert.equal(vaSoloNellaBarra('❌ <strong>Annullamento non riuscito</strong>: nessun evento'), true);
  assert.equal(vaSoloNellaBarra('⌛ <strong>Non ho la conferma</strong> della modifica (Campo 3)'), true);
  assert.equal(vaSoloNellaBarra('🧹 <strong>Card rimossa dal calendario</strong>: Campo 2'), true);
  // ⛔⛔ E LA METÀ CHE PROTEGGE, che vale più di tutte: le DOMANDE dell'Assistente restano. Non
  //    sono resoconti di qualcosa che è successo — sono una conversazione a cui lui deve
  //    rispondere, e toglierle non pulisce la scheda: spegne l'assistente, che resta ad aspettare
  //    la risposta a una domanda che nessuno ha potuto leggere.
  assert.equal(vaSoloNellaBarra('👥 <strong>Quale «Laura»?</strong> Scegli dall\'elenco.'), false);
  assert.equal(vaSoloNellaBarra('👨‍🏫 <strong>Quale maestro?</strong>'), false);
  assert.equal(vaSoloNellaBarra('👥 Aggiungi il <strong>giocatore</strong> (o scrivi <em>Ospite</em>)'), false);
  assert.equal(vaSoloNellaBarra('Ho aggiunto Lidia Comes alla partita.'), false);
  assert.equal(vaSoloNellaBarra('⚠️ Orario di fine non valido.'), false);
  assert.equal(vaSoloNellaBarra(''), false);
  assert.equal(vaSoloNellaBarra(null), false);
  // Chi scriveva su quel messaggio deve poterlo fare ancora: `_setNote` gli riscrive dentro a
  // ogni secondo, e un `null` di ritorno farebbe esplodere l'attesa dei giocatori.
  const add = dichiarazioneDi('svcAddMessage').slice(0, 1200);
  assert.match(add, /svcMessaggioVaSoloNellaBarra\(html\)/, 'i messaggi di avanzamento tornano nella scheda');
  assert.match(add, /const d = document\.createElement\('div'\); d\.innerHTML = html; return d;/,
    'si torna qualcosa che non è un div scrivibile: chi ci scrive sopra esplode');
});

test('⑪ 🚨 IL NOME DELLA EDGE NON È IL TIPO DI AZIONE: `edit` sono CINQUE gesti diversi', () => {
  /* 🗣️ Richiesta sua del 04/09, guardando la barra dire «modifica di una prenotazione» dopo aver
     salvato una nota: «si può mettere il tipo di azione che si sta effettuando / è stato
     effettuato al posto di quello generico?»
     ⚖️ Lo dice il CORPO della richiesta, non l'indirizzo — e il corpo lo costruisce chi sa cosa
     sta facendo, quindi non si sta indovinando niente. */
  const q = (b) => azioneDaChiamata(U('matchpoint-bookings-edit'), b);
  assert.equal(q({ note: 'ciao' }).soggetto, 'Nota');
  assert.equal(q({ note: 'ciao' }).corso, '📝 Salvo la nota');
  assert.equal(q({ players: { add: [{ nome: 'Laura' }] } }).soggetto, 'Giocatore');
  assert.equal(q({ players: { add: [{ nome: 'A' }, { nome: 'B' }] } }).soggetto, 'Giocatori');
  assert.equal(q({ players: { remove: ['Laura'] } }).participio, 'tolto');
  assert.equal(q({ move: { campo: 2, data: '2026-09-05' } }).participio, 'spostata');
  assert.equal(q({ istruttore: 'LoZio' }).soggetto, 'Maestro');
  assert.equal(q({ descrizione: 'x' }).soggetto, 'Descrizione');
  // ⚠️ Un salvataggio può portare PIÙ cambiamenti insieme e la riga ne dice UNO: si dichiara il
  //    più grosso. Uno spostamento con dentro anche una nota resta uno SPOSTAMENTO — chi guarda
  //    il calendario deve accorgersi che una partita ha cambiato campo, non che c'è una nota.
  assert.equal(q({ move: { campo: 2 }, note: 'x', players: { add: [{ nome: 'A' }] } }).participio, 'spostata');
  assert.equal(q({ players: { add: [{ nome: 'A' }] }, note: 'x' }).soggetto, 'Giocatore');
  // E un corpo che non porta nessuno di quei campi non inventa: resta la frase della edge.
  assert.equal(affinaEdit({ campo: 3 }), null);
  assert.equal(affinaEdit(null), null);
  // ⚠️ La voce 128 vuole Cash · Card · Wallet sotto gli occhi della segreteria: una parola
  //    italiana qui sarebbe la quarta di un vocabolario che ne ha tre. La guardia
  //    `letichetta-si-traduce-la-chiave-no` ha preso questa riga la prima volta che è stata scritta.
  assert.equal(MAPPA['matchpoint-wallet-correct'].soggetto, 'Wallet');
});

test('⑫ 🚨⭐⭐ UN RIFIUTO NON SE NE VA DA SOLO — da quando la scheda non lo scrive più', () => {
  /* Il successo passa da sé: il calendario lo mostra un attimo dopo. Il rifiuto e il dubbio no —
     la barra è l'unico posto in cui sono scritti, e un messaggio che sparisce dopo quattordici
     secondi è un messaggio che qualcuno non leggerà mai. Chi non l'ha letto crede sia andata bene. */
  assert.ok(ESITI.fatto.durataMs > 0, 'il «fatto» resta appeso: diventerebbe uno sfondo');
  assert.equal(ESITI.rifiutato.durataMs, 0, 'un rifiuto sparisce da sé: si perde l\'unico posto in cui è scritto');
  assert.equal(ESITI.ignoto.durataMs, 0, 'un dubbio sparisce da sé, e un dubbio non letto passa per un «fatto»');
  // Le tre frasi sono TRE, e non una negata a caso: «non è passata» detto su un dubbio è una
  // bugia (voce 72), e «fatto» detto su un rifiuto è la stessa bugia dall'altra parte.
  const az = { soggetto: 'Nota', participio: 'salvata' };
  assert.equal(fraseDellEsito(az, 'fatto'), '✅ Nota salvata');
  assert.equal(fraseDellEsito(az, 'rifiutato'), '⛔ Nota NON salvata');
  assert.match(fraseDellEsito(az, 'ignoto'), /non so com'è finita/);
  // Il MOTIVO è la seconda riga, ed è l'unica che dice perché: senza, un «non è passata» non si
  // può nemmeno rifare.
  assert.equal(motivoDelRifiuto({ message: 'lo slot è già occupato' }), 'lo slot è già occupato');
  assert.equal(motivoDelRifiuto({ error: 'SLOT_OCCUPATO' }), 'SLOT_OCCUPATO');
  assert.equal(motivoDelRifiuto({}), '');
  assert.equal(motivoDelRifiuto(null), '');
  assert.equal(motivoDelRifiuto({ message: 'x'.repeat(500) }).length, 120, 'un motivo lunghissimo sfonda la riga');
  // …e la ✕ esiste solo dove serve: su un esito che non se ne va da sé.
  const dis = dichiarazioneDi('svcRidisegnaSemaforo');
  assert.match(dis, /if \(finita && !SVC_ESITI\[loc\.stato\]\.durataMs\)/,
    'la ✕ non è agganciata alla persistenza: comparirebbe dove non serve o mancherebbe dove serve');
  assert.match(dis, /svcScacciaAzione\(\)/, 'la ✕ non chiude niente: il rifiuto resterebbe per sempre');
  // La barra ha DUE righe, ed è la richiesta sua: «raddoppiare l'altezza». Il raddoppio non è
  // solo spazio — è la riga in cui ci stanno il DOVE e il MOTIVO, che prima non ci stavano.
  assert.match(dis, /svc-semaforo-corpo/, 'la barra è tornata a una riga sola');
  const css = APP.slice(APP.indexOf('.svc-semaforo {'));
  assert.match(css.slice(0, 600), /min-height:5[0-9]px/, 'la barra ha perso l\'altezza doppia');
});

test('⑬ 🚨 VOCE 147 — UN GESTO IN VOLO SI LEGGE IN UN POSTO SOLO (i posti sono QUATTRO)', () => {
  /* 🗣️ Sua segnalazione del 04/09 sulla schermata di PROD 6.328: «trovo sulla scheda ancora 2
     messaggi distinti» — la pastiglia «↓ ↻ Salvo su Matchpoint l'impor…» e la striscia
     «💶 Cambio l'importo».
     ⚖️ IL DIFETTO CHE QUESTO BANCO ESISTE PER NON FAR TORNARE: la 136 spegneva la pastiglia
     guardando se la riga dentro la scheda era visibile; la 145 ha TOLTO quella riga per gli
     avanzamenti, e con lei è caduta la condizione. Una guardia che poggia sull'esistenza di un
     altro pezzo non urla quando quel pezzo sparisce: smette di proteggere in silenzio.
     ⛔ Questo banco è TESTUALE: prova le regole, non che sullo schermo si veda una striscia sola.
     Quello lo dice l'occhio, a 390 px, su un gesto vero. */

  // ① I tre avanzamenti dei pagamenti non nascono più in chat: la barra li dice per nome.
  assert.equal(vaSoloNellaBarra("↻ Salvo su Matchpoint l'importo a carico… (non chiudere)<br><span>Ospite 0,00 € → 20,00 €</span>"), true);
  assert.equal(vaSoloNellaBarra('↻ Salvo su Matchpoint gli importi a carico… (non chiudere)'), true);
  assert.equal(vaSoloNellaBarra('↻ Incasso Cash di 20,00 € per Ospite… (non chiudere)'), true);
  assert.equal(vaSoloNellaBarra('🧪 Simulazione incasso Card di 20,00 € per Ospite… (non chiudere)'), true);
  assert.equal(vaSoloNellaBarra('↻ Storno del pagamento di Mario Rossi… (non chiudere)'), true);
  assert.equal(vaSoloNellaBarra('🧪 Simulazione storno del pagamento di Mario Rossi… (non chiudere)'), true);

  // ⛔⛔ E QUELLO CHE RESTA IN CHAT VALE PIÙ DI QUELLO CHE ESCE — il WALLET si fa dalla scheda del
  //     SOCIO, dove `.svc-edit-box` non esiste: togliergli la chat gli toglierebbe l'unico posto
  //     in cui il suo esito è scritto. Per il doppione c'è la guardia ②, che leva la striscia e
  //     non l'informazione.
  assert.equal(vaSoloNellaBarra('↻ Storno wallet di Mario Rossi… (non chiudere)'), false);
  assert.equal(vaSoloNellaBarra('↻ Ricarica wallet di Mario Rossi… (non chiudere)'), false);
  // ⛔ E gli ESITI dei pagamenti restano fuori da questa lista: li disegna la riga nella scheda.
  assert.equal(vaSoloNellaBarra('✅ Importo aggiornato su Matchpoint'), false);
  assert.equal(vaSoloNellaBarra('⚠️ Nessun importo aggiornato. '), false);

  // ② La pastiglia non ripete un gesto in volo — e i due segni servono TUTTI E DUE.
  assert.equal(eAvanzamento('↻ Storno wallet di Mario Rossi… (non chiudere)'), true);
  assert.equal(eAvanzamento("↻ Salvo su Matchpoint l'importo a carico… (non chiudere)"), true);
  assert.equal(eAvanzamento('🧪 Simulazione incasso Cash di 20,00 € per Ospite… (non chiudere)'), true);
  // 🚨 LE TRE COSE CHE NON DEVE PRENDERE, ed è per loro che il «(non chiudere)» è obbligatorio:
  //    un esito che comincia uguale, una domanda che aspetta un click, un resoconto qualunque.
  assert.equal(eAvanzamento('⏳ Campo 3 · 18:00: dopo 4 tentativi non riesco a raggiungere Matchpoint per verificare.'), false);
  assert.equal(eAvanzamento('🧪 SIMULAZIONE — Stornare il pagamento di 20,00 € di Mario Rossi?'), false);
  assert.equal(eAvanzamento('👥 Quale «Laura»? Scegli dall\'elenco.'), false);
  assert.equal(eAvanzamento('✅ Importo aggiornato su Matchpoint'), false);
  assert.equal(eAvanzamento(''), false);
  assert.equal(eAvanzamento(null), false);

  // ③ E la guardia dev'essere DAVVERO agganciata, prima delle altre due: la 145 ha insegnato che
  //    una regola scritta e non chiamata nel punto giusto è una regola che non c'è.
  const agg = dichiarazioneDi('_svcAggiornaPastiglia');
  assert.match(agg, /svcEAvanzamentoInCorso\(st\.testo\)/, 'la pastiglia non guarda se il gesto è in volo: il doppione torna');
  assert.ok(agg.indexOf('svcEAvanzamentoInCorso') < agg.indexOf('_svcEsitoInSchedaVisibile'),
    'la guardia nuova arriva dopo quella che poggia sulla riga tolta dalla 145: non servirebbe a niente');
});

console.log('\n' + passed + ' passati, ' + failed + ' falliti');
process.exit(failed ? 1 : 0);
