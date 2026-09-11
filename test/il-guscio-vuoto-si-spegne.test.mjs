/* 🫥 «Il guscio vuoto si spegne» — banco della voce 209 (11/09/2026).
 *
 * 🗣️ LA VOCE È SUA, con lo schermo: «quando chiudo una scheda rimane questo banner» — una striscia
 *    vuota col solo ✕, sopra il calendario, che copre la prima fascia oraria.
 *
 * 📏 IL FATTO CHE QUESTO BANCO DIFENDE, misurato sulla pagina viva di TEST 6.450 con la console
 *    remota e con una LINEA DEL TEMPO: dopo il «Chiudi», a +200 ms il pannello è già a **55 px** e
 *    ci resta identico fino a **+9 s**, con dentro nessun messaggio. Non era un ritardo: era che
 *    nessuno lo spegneva.
 *
 * 🚨⭐⭐ QUELLO CHE QUESTO BANCO NON DICE, e va letto prima di fidarsene: gira **senza browser**.
 *    Prova che la decisione sia giusta (il ① la ESEGUE) e che le righe siano cablate dove devono
 *    (② ③ ④, che leggono il sorgente). Che la striscia sparisca **davvero** dallo schermo lo dice
 *    solo il gesto sulla pagina viva, ed è quello che chiude la voce.
 *
 * Esegui:  node test/il-guscio-vuoto-si-spegne.test.mjs
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

/** Solo le righe di CODICE: via i commenti.
 *  🩹 È la lezione della 118ª presa in flagrante mentre nasceva una sonda: una guardia che cerca
 *  una parola la trova **nel commento che dice di non usarla**, e il commento qui sopra nomina
 *  `svcCloseChat`, `svcResetToNeutral` e la striscia. Senza questo filtro il banco si misurerebbe
 *  addosso. */
function soloCodice(testo) {
  return String(testo).split('\n').filter(function (r) {
    return !/^\s*(\/\/|\*|\/\*)/.test(r);
  }).join('\n');
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ① LA DECISIONE SI ESEGUE, non si rilegge.
 *    Si estrae `svcChatSenzaContenuto` dal sorgente e la si fa girare davvero su contenitori
 *    finti. Una guardia che cercasse la PAROLA «every» proverebbe che la parola c'è, non che la
 *    decisione sia giusta — ed è il difetto già pagato nella 181.
 * ────────────────────────────────────────────────────────────────────────────*/
function estraiSenzaContenuto() {
  const i = APP.indexOf('function svcChatSenzaContenuto(');
  assert.ok(i > 0, 'svcChatSenzaContenuto non c\'è più: la voce 209 è senza il suo giudice');
  // fino alla chiusura della funzione: si conta la graffa, non si indovina.
  let liv = 0, j = APP.indexOf('{', i), fine = -1;
  for (let k = j; k < APP.length; k++) {
    if (APP[k] === '{') liv++;
    else if (APP[k] === '}') { liv--; if (liv === 0) { fine = k + 1; break; } }
  }
  assert.ok(fine > j, 'non sono riuscito a ritagliare la funzione: la fetta sarebbe una bugia');
  const src = APP.slice(i, fine);
  return new Function(src + '; return svcChatSenzaContenuto;')();
}

/** Un contenitore finto: `children` con `classList.contains`. */
function contenitore(classi) {
  return {
    children: classi.map(function (c) {
      return { classList: { contains: function (x) { return String(c).split(/\s+/).indexOf(x) >= 0; } } };
    })
  };
}

const senzaContenuto = estraiSenzaContenuto();

test('① CHAT VUOTA ⇒ vuota: non c\'è niente da leggere, il guscio può spegnersi', () => {
  assert.equal(senzaContenuto(contenitore([])), true);
});

test('① SOLO LA PASTIGLIA ⇒ vuota: il `↓` è arredamento, non un messaggio', () => {
  /* 📏 È esattamente lo stato misurato sul vivo dopo il Chiudi: un figlio solo, `svc-chat-nuovi`.
     Se questo caso dicesse «pieno», la cura non scatterebbe proprio nel caso che la vuole. */
  assert.equal(senzaContenuto(contenitore(['svc-chat-nuovi'])), true);
});

test('① UN MESSAGGIO RIMASTO ⇒ NON vuota: spegnere se lo porterebbe via', () => {
  assert.equal(senzaContenuto(contenitore(['svc-msg system'])), false);
  assert.equal(senzaContenuto(contenitore(['svc-chat-nuovi', 'svc-msg system error'])), false);
});

test('① SENZA CONTENITORE ⇒ NON vuota: «non lo so» non è «è vuoto»', () => {
  /* ⛔ Il verso del dubbio è scelto: una striscia vuota di troppo si vede e si chiude a mano;
     un errore spento senza essere letto non lo recupera nessuno. */
  assert.equal(senzaContenuto(null), false);
  assert.equal(senzaContenuto(undefined), false);
});

/* ─────────────────────────────────────────────────────────────────────────────
 * ② LA CURA È CABLATA NEL GESTO DEL «CHIUDI», e DOPO il messaggio.
 * ────────────────────────────────────────────────────────────────────────────*/
function ramoChiudi() {
  const i = APP.indexOf("svcAddMessage('system', '📝 Modifica chiusa.')");
  assert.ok(i > 0, 'il ramo del Chiudi non c\'è più: questo banco non sa dove guardare');
  const apri = APP.lastIndexOf('svcResetToNeutral();', i);
  assert.ok(apri > 0 && i - apri < 400, 'fra il reset e il messaggio c\'è troppo: non è più quel ramo');
  return APP.slice(apri, i + 1400);
}

test('② IL CHIUDI SPEGNE IL CONTENITORE, riusando l\'interruttore che esiste', () => {
  const src = soloCodice(ramoChiudi());
  assert.match(src, /svcChatSenzaContenuto\(/, 'il Chiudi non chiede più se è rimasto niente');
  assert.match(src, /svcCloseChat\(\)/, 'il Chiudi non arriva più a svcCloseChat: la striscia resta');
});

test('② …e lo fa DOPO il messaggio, o la domanda risponderebbe sull\'istante sbagliato', () => {
  /* ⚖️ L'ordine non è stile: se il controllo stesse PRIMA di `svcAddMessage`, una frase che finisce
     in chat (oggi non è così, ma la lista può cambiare) troverebbe la chat già dichiarata vuota e
     il pannello si spegnerebbe sopra un messaggio appena scritto. */
  const src = soloCodice(ramoChiudi());
  const iMsg = src.indexOf('svcAddMessage(');
  const iChk = src.indexOf('svcChatSenzaContenuto(');
  assert.ok(iMsg >= 0 && iChk > iMsg, 'il controllo è finito PRIMA del messaggio: ordine sbagliato');
});

/* ─────────────────────────────────────────────────────────────────────────────
 * ③ QUELLO CHE NON SI DEVE ROMPERE CURANDO: il SALVA deve poter far leggere la sua ✅.
 * ────────────────────────────────────────────────────────────────────────────*/
function corpoResetToNeutral() {
  const i = APP.indexOf('function svcResetToNeutral()');
  assert.ok(i > 0, 'svcResetToNeutral non c\'è più');
  let liv = 0, j = APP.indexOf('{', i), fine = -1;
  for (let k = j; k < APP.length; k++) {
    if (APP[k] === '{') liv++;
    else if (APP[k] === '}') { liv--; if (liv === 0) { fine = k + 1; break; } }
  }
  return soloCodice(APP.slice(i, fine));
}

test('③ `svcResetToNeutral` NON chiude il pannello: la ✅ del Salva si deve leggere', () => {
  /* 🚨 È la cura sbagliata che veniva più comoda: mettere `svcCloseChat()` dentro il reset cura la
     209 e rompe il Salva, che passa dalla stessa funzione. Il difetto sarebbe **invisibile** al
     banco della 209 e visibile solo a chi salva e non vede più com'è andata. */
  const src = corpoResetToNeutral();
  assert.ok(!/svcCloseChat\(/.test(src),
    'svcResetToNeutral chiude il pannello: così il Salva perde il suo esito');
});

/* ─────────────────────────────────────────────────────────────────────────────
 * ④ IL PERCHÉ LA STRISCIA NASCEVA: la frase del Chiudi non entra in chat.
 *    Se un domani uscisse da quella lista, la cura continuerebbe a funzionare (il ② dice perché)
 *    — ma questo caso lo DICHIARA, così chi legge non lo riscopre una terza volta.
 * ────────────────────────────────────────────────────────────────────────────*/
test('④ «Modifica chiusa» è fra gli esiti che NON entrano in chat — la causa, scritta', () => {
  const i = APP.indexOf('const SVC_ESITI_NELLA_SCHEDA = [');
  assert.ok(i > 0, 'la lista degli esiti non c\'è più');
  const fine = APP.indexOf('];', i);
  const lista = APP.slice(i, fine);
  assert.match(lista, /Modifica \(non riuscita\|chiusa\)/,
    'la frase del Chiudi non è più in lista: rileggere il ② prima di fidarsi di questo banco');
});

console.log('\n' + passed + ' verdi, ' + failed + ' rossi');
process.exit(failed ? 1 : 0);
