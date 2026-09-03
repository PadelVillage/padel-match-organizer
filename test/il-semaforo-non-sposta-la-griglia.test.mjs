/* 🚦 «Il semaforo non sposta la griglia, e non mostra il sync» — banco del pezzo ④ della voce 137.
 *
 * 🗣️ LA VOCE È SUA (03/09/2026): «come poter avere sul gestionale la visione di quello che sta
 * succedendo sul Matchpoint NON legato alla scheda… tipo in sovrapposizione sul calendario»,
 * col vincolo «ricordati che si utilizza la web app sia da mobile che da desktop».
 * Fra quattro disposizioni disegnate ha scelto la **D**: barra sovrapposta al bordo basso della
 * griglia (larga quanto lei) **+ la cella accesa** quando lo slot è in vista.
 *
 * ⚖️ PERCHÉ LA D E NON LE ALTRE, che è quello che questo banco difende:
 *   · la **C** stava nel flusso e spostava la griglia di ~22px ⇒ riapriva il 3 giugno 2026
 *     (quando il banner fu tolto proprio perché ingombrava) **e** la voce 130;
 *   · la **B**, solo la cella, tace quando lo slot è fuori vista — e quel silenzio è
 *     indistinguibile da «non sta succedendo nulla»;
 *   · la **A**, la pastiglia nell'angolo, sul telefono tronca la frase utile.
 *
 * 🚨⭐⭐ E IL DIFETTO CHE LA VERSIONE SPENTA AVEVA DENTRO, e che riaccenderla senza guardare
 * avrebbe rimesso in servizio: `svcRenderQueueStatus` leggeva `snap.running` e `snap.waitingCount`
 * GREZZI, quindi scriveva «🔄 Sincronizzazione automatica in corso…» ogni due minuti — cioè
 * esattamente la cosa che lui ha chiesto di non vedere — e contava i job automatici nel
 * «in coda: N», annunciando un ingorgo dove non c'era.
 * 📌 *Un pezzo funzionante spento per una ragione di layout non è un pezzo pronto: è un pezzo che
 * nessuno ha più guardato, e nel frattempo le decisioni sono cambiate.*
 *
 * ⛔ QUELLO CHE QUESTO BANCO **NON** DICE: che la barra si veda, che stia dove deve stare sullo
 * schermo vero, e che da telefono si legga. Gira senza browser ⇒ prova le REGOLE. Il resto lo
 * dicono la console remota su TEST e poi il suo occhio, ed è per questo che il pezzo ④ NON va
 * su PROD prima che lui l'abbia guardato: la disposizione l'ha scelta da disegni, non dal vivo.
 *
 * Esegui:  node test/il-semaforo-non-sposta-la-griglia.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(QUI, '..', 'index.html'), 'utf8');

let passed = 0, failed = 0;
function test(nome, fn) {
  try { fn(); passed++; console.log('ok   - ' + nome); }
  catch (e) { failed++; console.log('FAIL - ' + nome + '\n       ' + e.message); }
}

/** Le sole righe di CODICE di un testo: via i commenti.
 *
 * 🩹⭐ SERVE, e l'ho imparato tre volte oggi. Una sonda che cerca «questa cosa non deve
 * comparire» e guarda anche i commenti dà l'allarme **proprio a chi ha scritto la difesa**:
 * il commento che spiega *perché* non si usa `innerHTML` contiene la parola `innerHTML`.
 * 📌 *Una guardia deve rompersi su ciò che è sbagliato, non su ciò che ne parla.*
 */
function soloCodice(testo) {
  return String(testo).split('\n').filter(function (r) {
    return !/^\s*(\/\/|\*|\/\*)/.test(r);
  }).join('\n');
}

/** Il corpo di `function nome(`, contando le graffe dalla PRIMA del corpo.
 *  ⚠️ Si parte da `) {` e non da `function`: un valore predefinito `= {}` nella firma aprirebbe
 *  e chiuderebbe una graffa prima del corpo, e il ritaglio finirebbe dopo tre caratteri. */
function corpoDi(nome) {
  const i = APP.indexOf('function ' + nome + '(');
  assert.ok(i > 0, 'funzione non trovata: ' + nome);
  const apre = APP.indexOf(') {', i);
  assert.ok(apre > i, 'firma inattesa: ' + nome);
  let g = 0, visto = false, out = '';
  for (let k = apre + 2; k < APP.length; k++) {
    const c = APP[k];
    out += c;
    if (c === '{') { g++; visto = true; }
    else if (c === '}') { g--; if (visto && g === 0) break; }
  }
  return out;
}

// ── ① LA BARRA È SOVRAPPOSTA — la ragione per cui la D è stata scelta ───────────────────────
/* 🩹 QUESTO CASO CHIEDEVA `position:absolute`, ed è stato CORRETTO il 03/09 a tarda notte —
   pagato con una promozione in PROD che non si vedeva. La regola che difende è **«la barra sta
   fuori dal flusso e non sposta la griglia»**; `absolute` era il modo in cui era scritta, non la
   regola. 📏 Misurato sulla pagina viva di PROD 6.307: ancorata alla colonna, la barra stava a
   `top: 894` con la finestra alta 900 — in fondo al CALENDARIO, che è più alto dello schermo.
   ⇒ `fixed` soddisfa la stessa regola e in più **si vede**. Il caso ora accetta l'una o l'altra e
   pretende ciò che conta davvero: che non sia `static` né `relative`.
   📌 *Una prova che nomina il MEZZO invece del fine difende la vecchia soluzione dalla nuova.* */
test('la barra è fuori dal flusso: sovrapposta, non incastrata nella griglia', () => {
  const i = APP.indexOf('.svc-semaforo {');
  assert.ok(i > 0, 'la regola CSS della barra non c\'è');
  const regola = APP.slice(i, APP.indexOf('}', i));
  assert.ok(/position:(absolute|fixed)/.test(regola), 'la barra è tornata nel flusso: sposterebbe la griglia');
  assert.ok(/bottom:0/.test(regola), 'la barra non è ancorata al bordo basso');
  // 🩹 La larghezza della colonna non la dà più il CSS (con `fixed`, `left/right:0` sarebbero i
  //    bordi dello SCHERMO): la ridà `svcAllineaSemaforoAllaColonna` misurando `.svc-grid-col`
  //    a ogni accensione e a ogni resize. La regola è la stessa — larga quanto la griglia — e a
  //    cambiare è chi la applica, quindi la prova segue il codice invece del CSS.
  const all = APP.slice(APP.indexOf('function svcAllineaSemaforoAllaColonna('));
  assert.ok(/el\.style\.width = Math\.round\(r\.width\)/.test(all.slice(0, 900)),
    'la barra non prende più la larghezza della colonna: sarebbe una fascia da bordo a bordo');
});

/* 🩹 Il titolo diceva «o la barra finisce in fondo allo schermo»: da quando la barra è `fixed`
   quella conseguenza non è più sua. `position:relative` sulla colonna resta necessario — serve
   alla CELLA accesa, che è l'altra metà della disposizione D — e la prova resta, col motivo giusto. */
test('la colonna della griglia è posizionata, o la cella accesa perde il suo riferimento', () => {
  const i = APP.indexOf('.svc-grid-col {');
  const regola = APP.slice(i, APP.indexOf('}', i));
  assert.ok(/position:relative/.test(regola),
    'senza `position:relative` la barra si ancora alla pagina, non alla griglia');
});

test('la barra non ruba i click alla griglia sotto', () => {
  const i = APP.indexOf('.svc-semaforo {');
  const regola = APP.slice(i, APP.indexOf('}', i));
  assert.ok(/pointer-events:none/.test(regola),
    'la barra intercetta i click: uno slot coperto sarebbe uno slot che ogni tanto non si prenota');
});

test('il testo si tronca invece di andare a capo', () => {
  // Una barra che cresce in altezza si mangia una riga di calendario proprio quando c'è
  // qualcosa da guardare.
  const i = APP.indexOf('.svc-semaforo-testo {');
  assert.ok(i > 0, 'manca la regola del testo');
  const regola = APP.slice(i, APP.indexOf('}', i));
  assert.ok(/white-space:nowrap/.test(regola) && /text-overflow:ellipsis/.test(regola), regola);
});

test('la barra nasce NASCOSTA', () => {
  const i = APP.indexOf('id="svcQueueStatus"');
  assert.ok(i > 0, 'l\'elemento della barra non è nel DOM (era stato tolto nel 2026)');
  const tag = APP.slice(APP.lastIndexOf('<', i), APP.indexOf('>', i) + 1);
  assert.ok(/\bhidden\b/.test(tag), 'la barra nasce visibile: si vedrebbe una striscia vuota');
  assert.ok(/aria-live/.test(tag), 'la barra non si annuncia a chi usa un lettore di schermo');
});

test('la barra sta DENTRO la colonna della griglia', () => {
  // Fuori di lì `position:absolute` si ancorerebbe a un'altra antenata.
  const col = APP.indexOf('<div class="svc-grid-col">');
  const barra = APP.indexOf('id="svcQueueStatus"');
  const chiusura = APP.indexOf('<div class="svc-chat-panel"', col);
  assert.ok(col > 0 && barra > col && barra < chiusura, 'la barra è finita fuori dalla colonna');
});

/* 🩹 LA SONDA SI È SPOSTATA, il 03/09 notte, e la riga vecchia è stata CORRETTA e non affiancata.
   Fino a quella sera il disegno stava tutto dentro `svcRenderQueueStatus`, e questi casi
   guardavano lì. Col pezzo ⑤ della voce 137 la barra ha DUE fonti — la coda e il gesto fatto da
   questo browser — e il disegno è passato in `svcRidisegnaSemaforo`, mentre `svcRenderQueueStatus`
   è rimasto il guscio che riceve lo snapshot.
   🚨 I tre casi che sono diventati rossi NON avevano trovato un difetto: guardavano un posto che
   il codice aveva lasciato. ⇒ Si leggono i DUE corpi insieme, così la sonda regge anche il giorno
   in cui il disegno si sposterà ancora.
   📌 *Quando una prova cade dopo una riorganizzazione, il primo sospettato è la prova.* */
function corpoDelDisegno() {
  return soloCodice(corpoDi('svcRenderQueueStatus')) + '\n' + soloCodice(corpoDi('svcRidisegnaSemaforo'));
}

// ── ② IL SYNC NON SI VEDE — il difetto che la versione spenta aveva dentro ──────────────────
test('il render legge `semaforo`, MAI lo snapshot grezzo', () => {
  const corpo = corpoDelDisegno();
  assert.ok(/snap\.semaforo/.test(corpo), 'il render non legge il semaforo tradotto dalla edge');
  assert.ok(!/snap\.running/.test(corpo), 'il render è tornato a leggere `running` grezzo');
  assert.ok(!/waitingCount/.test(corpo), 'il render è tornato a contare i job automatici');
});

test('la frase «Sincronizzazione automatica in corso» non esiste più nel render', () => {
  const corpo = corpoDelDisegno();
  assert.ok(!/Sincronizzazione automatica/i.test(corpo),
    'è tornata la frase che lui ha chiesto di NON vedere sul calendario');
});

test('la frase si scrive come TESTO, non come markup', () => {
  const corpo = corpoDelDisegno();
  assert.ok(!/innerHTML/.test(corpo),
    'la frase attraversa la coda del worker: non è un posto in cui si accetta del markup');
  assert.ok(/testo\.textContent = che;/.test(corpo), 'la frase non si scrive più con `textContent`');
  assert.ok(/spanChi\.textContent = chi;/.test(corpo), 'il «chi» non si scrive più con `textContent`');
});

// ── ③ IL POLLING È RIACCESO — era commentato dal 3 giugno 2026 ──────────────────────────────
test('`svcStartQueuePolling()` non è più commentata', () => {
  assert.ok(/\n\s*svcStartQueuePolling\(\);/.test(APP),
    'la riga che accende il semaforo è ancora commentata');
  assert.ok(!/\/\/\s*svcStartQueuePolling\(\);/.test(APP),
    'è rimasta la vecchia riga commentata: due righe, una sola vera');
});

// ── ④ LA CELLA — la seconda metà della D ────────────────────────────────────────────────────
test('ogni cella dichiara le proprie coordinate', () => {
  // Tutte e tre le forme: occupata di testa, occupata di continuazione, libera. Un gesto può
  // riguardare uno slot qualunque, e una cella senza coordinate il semaforo non la trova.
  assert.ok(/el\.dataset\.campo = String\(f\); el\.dataset\.ora = hour;/.test(APP),
    'le celle non dichiarano più dove si trovano');
  const conteggio = (APP.match(/_dove\(document\.createElement\('div'\)\)/g) || []).length;
  assert.equal(conteggio, 3, 'le forme di cella con coordinate sono ' + conteggio + ', non 3');
});

test('un gesto di un ALTRO giorno non accende una cella di oggi', () => {
  const corpo = corpoDi('svcAccendiCella');
  assert.ok(/staffCalDate/.test(corpo) && /dove\.data !== giornoMostrato/.test(corpo),
    'la cella si accenderebbe anche per un gesto su un altro giorno');
});

test('senza coordinate non si accende niente, e non si rompe niente', () => {
  const corpo = corpoDi('svcAccendiCella');
  assert.ok(/if \(!dove \|\| !dove\.campo \|\| !dove\.ora\) return;/.test(corpo),
    'la cella si accende su coordinate incomplete');
});

test('la cella accesa si spegne prima di accenderne un\'altra', () => {
  // Senza, due gesti di fila lascerebbero due celle accese e il calendario direbbe il falso.
  const corpo = corpoDi('svcAccendiCella');
  assert.ok(/querySelectorAll\('\.svc-cella-attiva'\)/.test(corpo) && /classList\.remove\('svc-cella-attiva'\)/.test(corpo), corpo.slice(0, 300));
});

test('la cella si riaccende SUBITO dopo un ridisegno della griglia', () => {
  // 🚨 La griglia si ridisegna da sé (un sync, un click, un cambio giorno) e porta via la cella
  //    accesa. Aspettare il giro dopo del polling vuol dire fino a 4 secondi di buio su un gesto
  //    che ne dura sei: la cella spenta a metà racconta che l'operazione è finita quando non lo è.
  assert.ok(/svcRiaccendiCellaDopoRidisegno\(\);/.test(APP), 'manca la chiamata dopo il ridisegno');
  assert.ok(/let _svcUltimoSemaforo = null;/.test(APP), 'non si tiene l\'ultimo semaforo ricevuto');
});

test('la cella accesa non sposta di un pixel quello che le sta intorno', () => {
  const i = APP.indexOf('.cell.svc-cella-attiva {');
  assert.ok(i > 0, 'manca la regola della cella accesa');
  const regola = APP.slice(i, APP.indexOf('}', i));
  assert.ok(/outline:/.test(regola), 'usa un `border`, che cambia la scatola e sposta la griglia');
  assert.ok(!/(^|[^-])border:/.test(regola), regola);
});

// ── ⑤ IL MOVIMENTO SI PUÒ SPEGNERE ──────────────────────────────────────────────────────────
test('chi ha chiesto meno animazioni non vede il puntino pulsare', () => {
  assert.ok(/prefers-reduced-motion: reduce\) \{ \.svc-semaforo-dot \{ animation:none/.test(APP),
    'il puntino pulsa anche per chi ha chiesto di non vedere animazioni');
});

// ── ⑥ IL «CHI» NON SI TRONCA — cura nata da una misura sul telefono ────────────────────────
test('il «chi» si disegna a parte e NON si tronca', () => {
  // 📏 Misurato con la console remota su TEST a 390px: della frase intera entravano **43
  //    caratteri su 61**, e a cadere era la coda — cioè proprio il «chi». Su un telefono, chi fa
  //    segreteria perdeva l'unica cosa che gli dice se è stata lei o no, e gli restava il
  //    dettaglio di campo e ora che la cella accesa gli dice già.
  const corpo = corpoDelDisegno();
  assert.ok(/sem\.che \|\| sem\.frase/.test(corpo), 'il render non usa più la metà `che` della coda');
  assert.ok(/svc-semaforo-chi/.test(corpo), 'il «chi» non ha più un elemento suo');
  const i = APP.indexOf('.svc-semaforo-chi {');
  assert.ok(i > 0, 'manca la regola CSS del «chi»');
  const regola = APP.slice(i, APP.indexOf('}', i));
  assert.ok(/flex:0 0 auto/.test(regola), 'il «chi» può ancora restringersi e troncarsi: ' + regola);
});

test('senza «chi» la barra non disegna un elemento vuoto', () => {
  const corpo = corpoDelDisegno();
  assert.ok(/if \(chi\) \{/.test(corpo), 'il «chi» si disegna anche quando non c\'è');
});

console.log('\n' + passed + ' ok, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
