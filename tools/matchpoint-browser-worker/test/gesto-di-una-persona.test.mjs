/* 🚦 «Il nome dell'op non dice se c'è una persona» — banco della voce 137 (03/09/2026).
 *
 * 🗣️ LA VOCE È SUA: «come poter avere sul gestionale la visione di quello che sta succedendo
 * sul Matchpoint NON legato alla scheda… tipo in sovrapposizione sul calendario» — e il limite
 * che ha messo lui stesso: «ogni due minuti la pagina si aggiorna con i dati importati da
 * Matchpoint. Questo io non vorrei vederlo sul calendario segnalato.»
 *
 * ⭐ IL MOTORE ERA GIÀ IN PIEDI E SPENTO DA TRE MESI: `/queue/status` risponde, l'edge
 * `matchpoint-queue-status` è ACTIVE, le due funzioni nell'app sono scritte e complete — a
 * mancare era la riga che le accende, commentata il 3/06/2026 (commit `58fee80`) e **non per un
 * difetto del dato**: dava ingombro nel flusso della pagina. Una sovrapposizione non ingombra
 * ⇒ quella ragione cade.
 *
 * 🚨⭐⭐ QUELLO CHE QUESTO BANCO PROTEGGE, e senza cui il semaforo mente il primo giorno:
 * **il nome dell'operazione non basta a sapere se c'è una persona dietro.** Due casi misurati,
 * e nessuno dei due si vede leggendo l'elenco delle op:
 *
 *   ① `edit` con `read:true` è la LETTURA autorevole del roster — quella che parte da sola
 *      quando si APRE una scheda. La coda la chiamava «modifica» ⇒ il gesto più frequente della
 *      segreteria sarebbe apparso come una modifica in corso su Matchpoint.
 *   ② `client` con `soloRicerca` è la ricerca per telefono che si fa PRIMA di creare un socio,
 *      e non crea niente. La coda la chiamava «nuovo cliente» ⇒ un socio annunciato e mai nato.
 *
 * ⚖️ E IL VERSO IN CUI È GIUSTO SBAGLIARE, che è una scelta e va detta: davanti a un flag che
 * non riconosce, la regola dice «è un gesto» — cioè sbaglia verso l'ALLARME. Un falso «sta
 * succedendo qualcosa» si guarda e si scopre in due secondi; un falso silenzio no, ed è
 * indistinguibile dal funzionamento normale.
 *
 * ⛔ QUELLO CHE QUESTO BANCO **NON** DICE: che il semaforo si veda. Prova la REGOLA, non la
 * barra. Il render, la disposizione D e il fatto che da telefono si legga, li dice solo il suo
 * occhio sul calendario vero.
 *
 * Esegui:  node tools/matchpoint-browser-worker/test/gesto-di-una-persona.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eGestoDiUnaPersona, eSolaLettura, eSolaRicerca, MP_INTERACTIVE_OPS } from '../src/gesto-di-una-persona.mjs';
import { MP_INTERACTIVE_OPS as DALLA_CODA, MP_SYNC_OPS } from '../src/coda-priorita.mjs';

const QUI = dirname(fileURLToPath(import.meta.url));
const SERVER = readFileSync(join(QUI, '..', 'src', 'server.mjs'), 'utf8');

let passed = 0, failed = 0;
function test(nome, fn) {
  try { fn(); passed++; console.log('ok   - ' + nome); }
  catch (e) { failed++; console.log('FAIL - ' + nome + '\n       ' + e.message); }
}

// ── ① IL SYNC AUTOMATICO NON SI VEDE — è la sua decisione, ed è il punto della voce ─────────
test('il giro ogni 2 minuti NON è un gesto di una persona', () => {
  // `export-history` è il sync delle prenotazioni: se accendesse il semaforo, il semaforo
  // sarebbe acceso quasi sempre — cioè uno sfondo, non una segnalazione.
  assert.equal(eGestoDiUnaPersona({ op: 'export-history' }, {}), false);
});

test('nessuna delle sincronizzazioni accende il semaforo', () => {
  for (const op of MP_SYNC_OPS) {
    assert.equal(eGestoDiUnaPersona({ op }, {}), false, 'accende il semaforo: ' + op);
  }
});

test('il traffico di fondo non accende il semaforo', () => {
  for (const op of ['poll', 'keepalive', 'debug', 'read-tabellone', 'read-wallet']) {
    assert.equal(eGestoDiUnaPersona({ op }, {}), false, 'accende il semaforo: ' + op);
  }
});

// ── ② APRIRE UNA SCHEDA NON È UNA MODIFICA — la prima trappola ──────────────────────────────
test('`edit` con read:true NON è un gesto — aprire una scheda non tocca niente', () => {
  assert.equal(eGestoDiUnaPersona({ op: 'edit' }, { campo: 2, ora: '16:30', read: true }), false);
});

test('`edit` senza read È un gesto — quella è una modifica vera', () => {
  assert.equal(eGestoDiUnaPersona({ op: 'edit' }, { campo: 2, ora: '16:30', players: { add: ['x'] } }), true);
});

test('il flag `read` si legge anche dentro `booking`', () => {
  assert.equal(eSolaLettura({ booking: { read: true } }), true);
  assert.equal(eSolaLettura({ booking: { campo: 2 } }), false);
});

test('un `read` che non è ESATTAMENTE true sbaglia verso l\'allarme, non verso il silenzio', () => {
  // Scelta dichiarata: la forma è quella che `server.mjs` usa davvero (`input.read === true`).
  // Se un domani arrivasse `read:'1'`, qui esce «è un gesto» — un falso allarme si scopre
  // guardando, un falso silenzio no.
  assert.equal(eSolaLettura({ read: '1' }), false);
  assert.equal(eGestoDiUnaPersona({ op: 'edit' }, { read: '1' }), true);
});

// ── ③ CERCARE UN TELEFONO NON È CREARE UN SOCIO — la seconda trappola ───────────────────────
test('`client` con soloRicerca NON è un gesto: non crea niente', () => {
  assert.equal(eGestoDiUnaPersona({ op: 'client' }, { options: { soloRicerca: true } }), false);
  assert.equal(eGestoDiUnaPersona({ op: 'client' }, { client: { soloRicerca: true } }), false);
});

test('il flag `soloRicerca` si legge in TUTTI i posti in cui il worker lo legge', () => {
  // ⚠️ Il worker fa `!!(options.soloRicerca || client.soloRicerca)`. Guardarne uno solo
  //    lascerebbe passare metà dei casi, ed è un errore che nessuna rilettura trova.
  assert.equal(eSolaRicerca({ options: { soloRicerca: true } }), true);
  assert.equal(eSolaRicerca({ client: { soloRicerca: true } }), true);
  assert.equal(eSolaRicerca({ client: { nome: 'Marco' } }), false);
  const nelWorker = SERVER.includes('options.soloRicerca || client.soloRicerca');
  assert.ok(nelWorker, 'il worker ha cambiato dove legge `soloRicerca`: riallineare la regola');
});

test('creare un socio davvero È un gesto', () => {
  assert.equal(eGestoDiUnaPersona({ op: 'client' }, { client: { nome: 'Marco', cognome: 'Aprea' } }), true);
});

// ── ④ I GESTI CHE DEVONO VEDERSI, compresi i quattro sui soldi ──────────────────────────────
test('tutti i gesti veri accendono il semaforo', () => {
  for (const op of ['create', 'cancel', 'disable-client', 'reactivate-client',
                    'collect-payment', 'set-charge', 'void-payment', 'correct-wallet']) {
    assert.equal(eGestoDiUnaPersona({ op }, {}), true, 'non accende il semaforo: ' + op);
  }
});

// ── ⑤ UNA LISTA SOLA, NON DUE — il difetto che ha già colpito due volte qui ─────────────────
test('la lista dei gesti è LA STESSA che decide la priorità in coda', () => {
  // 📌 Due elenchi divergono in silenzio: un'operazione aggiunta là e non qui sparirebbe dal
  //    semaforo senza che niente diventi rosso. `MP_INTERACTIVE_OPS` è ri-esportata, non copiata.
  assert.equal(MP_INTERACTIVE_OPS, DALLA_CODA, 'la lista è stata COPIATA invece che ri-esportata');
});

// ── ⑥ LA CUCITURA COL WORKER — la regola dev'essere davvero quella che gira ─────────────────
test('`mpJobMeta` usa la regola invece di riscriverla', () => {
  assert.ok(/from '\.\/gesto-di-una-persona\.mjs'/.test(SERVER), 'server.mjs non importa la regola');
  assert.ok(/const gesto = eGestoDiUnaPersona\(\{ op \}, body\);/.test(SERVER),
    '`mpJobMeta` non calcola più `gesto`');
});

test('il flag `gesto` arriva fino alla CODA, non si ferma alla meta', () => {
  // 🚨 Trovato scrivendo questa riga: `mpQueueRun` costruisce il job CAMPO PER CAMPO, non con
  //    uno spread ⇒ un campo nuovo non aggiunto lì non arriva mai, e a valle si legge
  //    `undefined` senza che niente diventi rosso. Sarebbe stato un semaforo spento per sempre.
  assert.ok(/gesto: meta\.gesto === true,/.test(SERVER),
    '`mpQueueRun` non copia `gesto` sul job: lo snapshot leggerebbe undefined');
  assert.ok(/gesto: mpQueue\.running\.gesto === true,/.test(SERVER),
    'lo snapshot non espone `gesto` sul job in corso');
  assert.ok(/gesto: j\.gesto === true/.test(SERVER),
    'lo snapshot non espone `gesto` sui job in attesa');
});

test('le due etichette che mentivano sono state corrette ALLA RADICE', () => {
  assert.ok(SERVER.includes("eSolaLettura(body) ? 'lettura scheda' : 'modifica'"),
    'la `edit` in sola lettura si chiama ancora «modifica»');
  assert.ok(SERVER.includes("eSolaRicerca(body) ? 'ricerca cliente' : 'nuovo cliente'"),
    'la ricerca per telefono si chiama ancora «nuovo cliente»');
});

test('nessuna etichetta della coda porta con sé un TELEFONO', () => {
  // Quelle righe finiscono sotto gli occhi di chiunque guardi il calendario: il numero di una
  // persona non ci va, e il nome basta a capire di chi si sta parlando.
  // 🩹 La prima stesura di questa prova ritagliava «500 caratteri intorno» e pescava codice di
  //    un'altra funzione: era rossa senza che il difetto ci fosse. ⇒ Si ritaglia `mpJobMeta`
  //    per intero contando le graffe, che è l'unico confine che non si sposta da sé.
  // ⚠️ Si parte dalla graffa del CORPO, non da `function`: la firma è
  //    `mpJobMeta(op, body = {})` e quel `{}` del valore predefinito apre e chiude una graffa
  //    prima del corpo ⇒ contando da `function` il ritaglio finiva dopo tre caratteri, e la
  //    prova diceva «zero etichette» invece di guardarle. Rossa per la propria sonda.
  const i = SERVER.indexOf('function mpJobMeta(');
  assert.ok(i > 0, '`mpJobMeta` non si trova più');
  const apre = SERVER.indexOf(') {', i);
  assert.ok(apre > i, 'la firma di `mpJobMeta` non ha più la forma attesa');
  let g = 0, visto = false, corpo = '';
  for (let k = apre + 2; k < SERVER.length; k++) {
    const c = SERVER[k];
    corpo += c;
    if (c === '{') { g++; visto = true; }
    else if (c === '}') { g--; if (visto && g === 0) break; }
  }
  const righeLabel = corpo.split('\n').filter((r) => r.includes('label:'));
  assert.ok(righeLabel.length >= 5, 'le etichette sono meno di prima: ' + righeLabel.length);
  for (const r of righeLabel) {
    assert.ok(!/telefono|phone|tel\b/i.test(r), 'telefono in un\'etichetta della coda: ' + r.trim());
  }
});

// ── ⑦ CHI HA CHIESTO — «socio» dal bot, «staff» dalla segreteria ────────────────────────────
test('`chiestoDa` attraversa TUTTA la catena: meta → job → snapshot', () => {
  // 🚨 Stessa forma del difetto di `gesto`: il job si costruisce campo per campo, quindi un
  //    campo nuovo che non venga aggiunto in `mpQueueRun` si perde in silenzio. Qui la catena
  //    si controlla ANELLO PER ANELLO, perché è l'unico modo in cui il buco fa rumore.
  assert.ok(/const chiestoDa = clean\(body\.chiestoDa\) \|\| '';/.test(SERVER),
    '`mpJobMeta` non legge più `chiestoDa` dal payload');
  assert.ok(/chiestoDa: meta\.chiestoDa \|\| '',/.test(SERVER),
    '`mpQueueRun` non copia `chiestoDa` sul job: si fermerebbe alla meta');
  assert.ok(/chiestoDa: mpQueue\.running\.chiestoDa \|\| '',/.test(SERVER),
    'lo snapshot non espone `chiestoDa` sul job in corso');
  assert.ok(/chiestoDa: j\.chiestoDa \|\| ''/.test(SERVER),
    'lo snapshot non espone `chiestoDa` sui job in attesa');
});

test('OGNI etichetta di `mpJobMeta` porta con sé `chiestoDa`', () => {
  // Un solo `return` dimenticato basterebbe a far sparire l'etichetta per UN tipo di gesto —
  // e sarebbe il difetto peggiore, perché gli altri cinque continuerebbero a funzionare.
  const i = SERVER.indexOf('function mpJobMeta(');
  const apre = SERVER.indexOf(') {', i);
  let g = 0, visto = false, corpo = '';
  for (let k = apre + 2; k < SERVER.length; k++) {
    const c = SERVER[k];
    corpo += c;
    if (c === '{') { g++; visto = true; }
    else if (c === '}') { g--; if (visto && g === 0) break; }
  }
  const ritorni = corpo.split('\n').filter((r) => r.includes('return { op,'));
  assert.ok(ritorni.length >= 6, 'i return di `mpJobMeta` sono meno di prima: ' + ritorni.length);
  for (const r of ritorni) {
    assert.ok(r.includes('chiestoDa'), 'un return senza `chiestoDa`: ' + r.trim());
    assert.ok(r.includes('gesto'), 'un return senza `gesto`: ' + r.trim());
  }
});

test('il RUOLO, non l\'email: le tre edge non riconoscono il bot da una stringa', () => {
  // ⛔ `email === 'assistente-soci@…'` funzionerebbe finché nessuno rinomina quella casella, e il
  //    giorno in cui qualcuno la rinomina NIENTE diventa rosso: i gesti dal bot si
  //    ridichiarerebbero «staff» in silenzio.
  // 🩹 E la scheda della 137 qui sbagliava: diceva che il bot si riconosce da un'ASSENZA di
  //    `operatore`. `consumerActor` gli dà un attore pieno — `operatore` c'è e non è vuoto.
  for (const quale of ['create', 'edit', 'cancel']) {
    const p = join(QUI, '..', '..', '..', 'supabase', 'functions', `matchpoint-bookings-${quale}`, 'index.ts');
    const edge = readFileSync(p, 'utf8');
    assert.ok(/function chiCiHaChiesto\(actor: StaffActor\): string \{\s*\n\s*return actor\.role === 'consumer' \? 'socio' : 'staff';/.test(edge),
      `${quale}: \`chiCiHaChiesto\` non decide più sul RUOLO`);
    assert.ok(edge.includes("chiestoDa: chiCiHaChiesto(actor)"),
      `${quale}: la chiamata al worker non porta \`chiestoDa\``);
    assert.ok(edge.includes("chiestoDa: chiestoDa ?? ''"),
      `${quale}: il corpo inviato al worker non contiene \`chiestoDa\``);
    // 🩹 Si guardano solo le righe di CODICE. La prima stesura di questa prova cercava la
    //    stringa nel file intero ed è cascata sul COMMENTO che spiega perché non si fa così:
    //    una sonda che non distingue il codice dalla sua documentazione dà l'allarme proprio a
    //    chi ha scritto la difesa. 📌 *Una guardia deve rompersi su ciò che è sbagliato, non su
    //    ciò che ne parla.*
    const soloCodice = edge.split('\n')
      .filter((r) => !/^\s*(\/\/|\*|\/\*)/.test(r))
      .join('\n');
    assert.ok(!/email === ['"]assistente-soci/.test(soloCodice),
      `${quale}: il bot viene riconosciuto da un'EMAIL invece che dal ruolo`);
  }
});

// ── ⑧ LE COORDINATE — strutturate, non spremute dall'etichetta ──────────────────────────────
test('`dove` attraversa tutta la catena, come `gesto` e `chiestoDa`', () => {
  assert.ok(/const dove = \{/.test(SERVER), '`mpJobMeta` non compone più `dove`');
  assert.ok(/dove: meta\.dove \|\| null,/.test(SERVER),
    '`mpQueueRun` non copia `dove` sul job: si fermerebbe alla meta');
  assert.ok(/dove: mpQueue\.running\.dove \|\| null,/.test(SERVER),
    'lo snapshot non espone `dove` sul job in corso');
  assert.ok(/dove: j\.dove \|\| null/.test(SERVER),
    'lo snapshot non espone `dove` sui job in attesa');
});

test('OGNI etichetta porta `dove` insieme a `gesto` e `chiestoDa`', () => {
  const i = SERVER.indexOf('function mpJobMeta(');
  const apre = SERVER.indexOf(') {', i);
  let g = 0, visto = false, corpo = '';
  for (let k = apre + 2; k < SERVER.length; k++) {
    const c = SERVER[k];
    corpo += c;
    if (c === '{') { g++; visto = true; }
    else if (c === '}') { g--; if (visto && g === 0) break; }
  }
  const ritorni = corpo.split('\n').filter((r) => r.includes('return { op,'));
  assert.ok(ritorni.length >= 6, 'i return sono meno di prima: ' + ritorni.length);
  for (const r of ritorni) {
    for (const campo of ['gesto', 'chiestoDa', 'dove']) {
      assert.ok(r.includes(campo), `un return senza \`${campo}\`: ` + r.trim());
    }
  }
});

console.log('\n' + passed + ' ok, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
