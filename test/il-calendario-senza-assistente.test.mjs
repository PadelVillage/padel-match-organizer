/* 🪟 «Il calendario senza assistente» — banco del restyling del 04/09/2026.
 *
 * 🗣️ LA DECISIONE È SUA, e sono tre in una: «Leviamo totalmente l'assistente digitale, quindi
 * quella barra bassa con microfono dove si può scrivere. Non c'è più, si fa tutto manualmente.
 * Quello spazio dove appaiono le schede viene elevato e la scheda appare sopra il calendario
 * quando si clicca su una partita o su uno spazio vuoto, come facciamo già nella sezione
 * anagrafica soci.» · «Il menu non lo metterei sulla sinistra lo lascerei in alto e quello spazio
 * lo sfrutterei per ampliare il calendario.» · «Portiamo il messaggio che oggi abbiamo messo
 * nella barra in fondo al calendario all'interno della scheda in basso.»
 *
 * 🎯 LE TRE COSE CHE QUESTO BANCO DIFENDE, e nessuna si vede rileggendo:
 *   ① l'assistente non torna dentro dalla finestra — non un input, non un microfono, non un FAB;
 *   ② la colonna a sinistra sparisce SOLO su desktop: su telefono QUELLA COLONNA È IL MENU, e
 *      chi la nascondesse fuori dalla media query lascerebbe il telefono senza navigazione;
 *   ③ niente resta spostato di 304px per scansare una colonna che non c'è più.
 *
 * ⛔ QUELLO CHE NON DICE: gira senza browser ⇒ prova che il codice è quello giusto, non che la
 *    scheda si VEDA aprirsi sopra il calendario. Quello lo dice il suo dito su TEST.
 *
 * Esegui:  node test/il-calendario-senza-assistente.test.mjs
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

/** Le sole righe di CODICE: via i commenti. Una guardia deve rompersi su ciò che è sbagliato,
 *  non su ciò che ne PARLA — e qui sopra i commenti nominano tutto ciò che è stato tolto. */
function soloCodice(testo) {
  return String(testo).split('\n').filter((r) => !/^\s*(\/\/|\*|\/\*)/.test(r)).join('\n');
}

/** Il corpo di `function nome(`, contando le graffe dalla PRIMA del corpo (non dalla firma:
 *  un `= {}` fra i parametri chiuderebbe il ritaglio dopo tre caratteri). */
function corpoDi(nome) {
  const i = APP.indexOf('function ' + nome + '(');
  assert.ok(i > 0, 'funzione non trovata: ' + nome);
  const apre = APP.indexOf(') {', i);
  let g = 0, visto = false, out = '';
  for (let k = apre + 2; k < APP.length; k++) {
    const c = APP[k];
    out += c;
    if (c === '{') { g++; visto = true; }
    else if (c === '}') { g--; if (visto && g === 0) break; }
  }
  return out;
}

/** Il blocco `@media (min-width:900px) { … }` che contiene `ago`, dalla graffa alla sua chiusa.
 *  Serve a rispondere alla domanda che conta per la ②: quella regola sta DENTRO il desktop? */
function bloccoDesktopCheContiene(ago) {
  const dove = APP.indexOf(ago);
  assert.ok(dove > 0, 'non trovo la regola: ' + ago);
  const apertura = APP.lastIndexOf('@media (min-width:900px)', dove);
  assert.ok(apertura > 0, 'la regola non sta in nessun blocco desktop: ' + ago);
  let g = 0, visto = false, k = APP.indexOf('{', apertura);
  for (; k < APP.length; k++) {
    const c = APP[k];
    if (c === '{') { g++; visto = true; }
    else if (c === '}') { g--; if (visto && g === 0) { k++; break; } }
  }
  const blocco = APP.slice(apertura, k);
  assert.ok(blocco.includes(ago), 'la regola cade fuori dal blocco desktop: ' + ago);
  return blocco;
}

// ── ① L'ASSISTENTE NON C'È PIÙ ─────────────────────────────────────────────
test("① NEL CALENDARIO NON C'È PIÙ NIENTE SU CUI SCRIVERE O DETTARE", () => {
  // I cinque elementi che formavano l'assistente sul calendario. Si cercano per `id=`, cioè
  // come si scrive un elemento, non come lo si nomina in un commento.
  for (const id of ['svcChatInput', 'svcChatSend', 'svcChatFab', 'staffCalMobileInput', 'staffCalMobileMic', 'staffCalMobileSend']) {
    assert.ok(!APP.includes('id="' + id + '"'), 'è tornato l\'elemento ' + id + ': l\'assistente rientra dalla finestra');
  }
  assert.ok(!APP.includes('id="svcChatInputRow"'), 'è tornata la riga del composer');
  assert.ok(!APP.includes('id="staffCalMobileChatBar"'), 'è tornata la barra di scrittura del telefono');
});

test("①b I MESSAGGI E LE SCHEDE HANNO ANCORA UN POSTO — non si è buttato il contenitore", () => {
  // 🚨 La cosa da NON fare era togliere l'assistente portandosi via anche il contenitore delle
  //    schede: è lì che l'app disegna la prenotazione, la modifica, gli esiti. Il pannello resta,
  //    cambia mestiere — da chat a finestra.
  assert.ok(APP.includes('id="svcChatPanel"'), 'il pannello delle schede non c\'è più: le schede non avrebbero dove aprirsi');
  assert.ok(APP.includes('id="svcChatMessages"'), 'il contenitore dei messaggi non c\'è più');
  assert.ok(APP.includes('id="svcChatCloseBtn"'), 'senza la ✕ la finestra non si chiude');
});

// ── ② LA FINESTRA ──────────────────────────────────────────────────────────
test('② LA SCHEDA È UNA FINESTRA SOPRA IL CALENDARIO, E NASCE CHIUSA', () => {
  const blocco = bloccoDesktopCheContiene('.svc-chat-panel.svc-chat-open { display:flex; }');
  /* 🩹 Il ritaglio si CHIUDE alla graffa della regola. Un `slice` che parte dal selettore e
     arriva in fondo al blocco conterrebbe tutte le regole successive: sabotata la finestra
     togliendole `display:none`, la sonda restava verde perché quel `display:none` lo trovava
     in una regola qualunque venti righe sotto. Presa da un sabotaggio, non rileggendo. */
  const daSelettore = blocco.slice(blocco.indexOf('.svc-chat-panel {'));
  const regola = daSelettore.slice(0, daSelettore.indexOf('}') + 1);
  assert.match(regola, /position:fixed/, 'la finestra non è ancorata alla finestra del browser');
  assert.match(regola, /display:none/, 'la finestra nasce APERTA: coprirebbe il calendario sempre');
  assert.match(regola, /z-index:2600/, 'la finestra non sta sopra: finirebbe sotto il calendario');
  // Il fondo scuro: senza, la finestra galleggia su un calendario che sembra ancora cliccabile.
  assert.match(blocco, /\.svc-chat-overlay\.active \{ background:/, 'manca il fondo scuro dietro la finestra');
});

test('②b LA FINESTRA STA NEL <body> A QUALSIASI LARGHEZZA', () => {
  /* ⚖️ Prima su desktop veniva agganciata alla colonna di sinistra (#sideNavChatHost). Quella
     colonna è nascosta: un pannello agganciato lì dentro sarebbe invisibile — e invisibile è
     peggio di assente, perché il codice continuerebbe a scriverci dentro senza che si veda. */
  const c = soloCodice(corpoDi('pmoRelocateChat'));
  assert.ok(!/sideNavChatHost/.test(c), 'la finestra torna nella colonna nascosta: non si vedrebbe più niente');
  assert.match(c, /document\.body\)\s*document\.body\.appendChild\(panel\)/, 'la finestra non viene portata nel body');
});

test('②c APRIRE UNO SLOT LIBERO APRE LA FINESTRA ANCHE SU DESKTOP', () => {
  /* 🚨 Il difetto che questa guardia previene è silenzioso: prima la finestra su desktop era
     sempre visibile nella colonna, quindi due aperture erano scritte `if (window.innerWidth <
     900)`. Lasciandole così, su desktop si cliccherebbe uno slot e non succederebbe NIENTE. */
  const c = soloCodice(corpoDi('staffCalClickFree'));
  assert.match(c, /svcOpenChat\(\)/, 'cliccando uno slot libero la finestra non si apre');
  assert.ok(!/innerWidth < 900[^\n]*svcOpenChat/.test(c), 'l\'apertura è ancora riservata al telefono');
});

// ── ③ LA COLONNA A SINISTRA ────────────────────────────────────────────────
test('③ 🚨 LA COLONNA SPARISCE SOLO SU DESKTOP: SU TELEFONO È IL MENU', () => {
  /* 🚨⭐ È la guardia che vale di più di tutte quelle qui dentro. Su telefono `.side-nav` è il
     cassetto del ≡: nasconderla fuori dalla media query lascerebbe il telefono SENZA
     NAVIGAZIONE — e nessuna prova fatta da computer se ne accorgerebbe, perché da computer
     sarebbe tutto giusto. È lo stesso punto cieco della barra dei capitoli del 2/08. */
  const blocco = bloccoDesktopCheContiene('.side-nav, .sidebar-backdrop { display:none !important; }');
  assert.ok(blocco.includes('min-width:900px'), 'la colonna è nascosta fuori dal desktop');
  /* …e nessun'altra regola la nasconde per tutti.
     🩹 `(?![\w-])` e non `\b`: in CSS il trattino fa parte del nome, e `\b` pescava
     `.side-nav-close` e `.side-nav-chat-host` — due regole giuste, contate come colpevoli.
     È la sonda rossa per il proprio ritaglio, non per il codice. */
  const righe = APP.split('\n').filter((r) => /^\s*\.side-nav(?![\w-])[^{]*\{[^}]*display:\s*none/.test(r));
  assert.equal(righe.length, 1, 'più di una regola nasconde la colonna: una di loro potrebbe colpire il telefono');
});

test('③b MARCHIO, AMBIENTE, VERSIONE ED ESCI SONO TRASLOCATI IN ALTO', () => {
  // Non erano "la chat": erano le altre cose che la colonna teneva. Chi toglie la colonna senza
  // portarli via li perde, e la versione dell'app diventa inconoscibile da desktop.
  const i = APP.indexOf('<nav class="pmo-chapter-bar"');
  const barra = APP.slice(i, APP.indexOf('</nav>', i));
  assert.match(barra, /data-app-version/, 'la versione non si legge più da desktop');
  assert.match(barra, /data-env-label/, 'la targhetta TEST/PROD non si vede più: si scriverebbe sul database sbagliato senza accorgersene');
  assert.match(barra, /staffLogout\(\)/, 'non c\'è più modo di uscire da desktop');
  assert.match(barra, /pmo-chapter-brand/, 'manca il marchio');
});

test('③c NIENTE RESTA SPOSTATO DI 304px PER SCANSARE UNA COLONNA CHE NON C\'È', () => {
  /* ⚖️ Quattro regole spostavano roba di 304 o 328px per non finire sotto la colonna: la scheda
     socio, la finestra delle richieste, il pannello dei riempimenti, la barra del vecchio
     calendario. Tolta la colonna, quello spostamento non protegge più niente — lascia le cose
     sbilenche, spinte a destra di un terzo di schermo. */
  const codice = soloCodice(APP);
  assert.ok(!/left:\s*calc\(304px/.test(codice), 'la scheda socio è ancora spinta a destra di 304px');
  assert.ok(!/\.fill-request-modal \{ left:304px/.test(codice), 'la finestra delle richieste è ancora spostata');
  assert.ok(!/inset:28px 36px 28px 328px/.test(codice), 'il pannello dei riempimenti è ancora spostato');
  assert.ok(!/\.staff-cal-input-bar \{ left:304px/.test(codice), 'la barra del calendario vecchio è ancora spostata');
});

test('④ 🚨 LA STRISCIA A RIPOSO NON SI VEDE — `hidden` da solo non basta', () => {
  /* 📏 Il fatto, visto in una SCHERMATA di PROD 6.315 e poi misurato: la striscia era
     `hidden = true` e `display: flex`, cioè DIPINTA — una fascia azzurra vuota alta 52px in
     fondo a ogni schermata dell'app (`848→900` su una finestra alta 900).
     ⚖️ `[hidden] { display:none }` è una regola del BROWSER: la più debole che ci sia, e
     qualunque classe con un `display` la scavalca. E il difetto era cieco alle sonde:
     `pointer-events:none` fa rispondere «il calendario» a `elementFromPoint`.
     📌 Nessuna prova senza occhi l'avrebbe preso. Questa guardia esiste perché non torni. */
  assert.ok(/\.svc-semaforo\[hidden\] \{ display:none !important; \}/.test(APP),
    'la striscia a riposo torna a dipingersi: una fascia vuota in fondo a ogni schermata');
});

console.log('\n' + passed + ' passati, ' + failed + ' falliti');
process.exit(failed ? 1 : 0);
