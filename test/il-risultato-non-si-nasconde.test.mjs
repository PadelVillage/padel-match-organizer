/* 👁️ «Un risultato non deve restare nascosto» — banco della voce 134 (03/09/2026).
 *
 * 🗣️ IL FATTO NASCE DA UNA SUA DOMANDA, subito dopo aver provato la voce 132: «ogni volta che
 * faccio un'operazione che poi aspetto la conferma da Matchpoint, dove è giusto che io veda la
 * conferma? In alto alla scheda oppure in basso?» — poi precisata: «è solo una questione di
 * visualizzazione di un risultato che non deve essere nascosto, sia se scrivi sia se clicchi
 * i bottoni».
 *
 * 📏 LA MISURA CHE HA DECISO IL DISEGNO, presa su PROD 6.281 con la console remota (1440×900),
 * scheda della partita di Campo 2 · 16:30 aperta:
 *     pannello visibile 711px · scheda alta 1216px (sborda di 505px)
 *     fermo sul bottone Salva  → il messaggio è VISIBILE (−47px dal bordo)
 *     subito DOPO il click     → il messaggio è 568px SOTTO il bordo, e scrollTop torna a 0
 * ⇒ Due difetti distinti, e il secondo è quello che nessuno avrebbe indovinato: non era solo il
 * messaggio a nascere in basso, era la **vista a tornare in cima**. `svcAddMessage` chiamava
 * `_svcAutoScroll(container)` SENZA `soloInGiu`, quindi il tetto della 127 — pensato per dire
 * «non oltre la cima della scheda» — veniva applicato anche a chi stava PIÙ IN BASSO, e lo
 * trascinava indietro.
 * 📌 *Un tetto dice «non oltre», non «torna indietro».*
 *
 * ⚖️ LA CURA È IN TRE PEZZI, e nessuno dei tre alza il tetto della 127 (che resta giusto: una
 * scheda si legge dall'alto):
 *   ① `svcAddMessage` non strappa più verso l'alto — l'observer questa regola ce l'aveva già,
 *      questa seconda strada no: due strade per lo stesso gesto, una sola protetta;
 *   ② l'esito dei bottoni si scrive DENTRO la scheda, sopra la barra dei bottoni, dove sta
 *      l'occhio nell'istante del click;
 *   ③ una pastiglia «↓ …» sul bordo basso porta il TESTO dell'ultimo messaggio, così l'esito si
 *      legge senza cliccare, e si raggiunge con un dito.
 *
 * ⛔ Quello che questo banco NON dice: gira senza browser ⇒ prova le REGOLE, non il render. Che
 * sulla pagina vera la conferma si veda lo dice la console remota, e poi il suo occhio.
 *
 * Esegui:  node test/il-risultato-non-si-nasconde.test.mjs
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

/** Il corpo di una funzione dichiarata come `function nome(` — ritaglio contando le graffe. */
function corpoDi(nome) {
  const i = APP.indexOf('function ' + nome + '(');
  assert.ok(i > 0, 'funzione non trovata: ' + nome);
  let g = 0, visto = false, out = '';
  for (let k = i; k < APP.length; k++) {
    const c = APP[k];
    out += c;
    if (c === '{') { g++; visto = true; }
    else if (c === '}') { g--; if (visto && g === 0) break; }
  }
  return out;
}

// ── ① lo scroll non strappa più verso l'alto ────────────────────────────────────────────

test('1) 🚨 svcAddMessage scrolla SOLO IN GIÙ — è la strada che il 03/09 riportava in cima', () => {
  const corpo = corpoDi('svcAddMessage');
  assert.ok(/_svcAutoScroll\(container,\s*true\)/.test(corpo),
    'senza `true` il tetto della 127 viene applicato anche verso l\'alto: chi ha appena cliccato un bottone in fondo alla scheda viene riportato in cima (misurato: scrollTop 570 → 0)');
  assert.ok(!/_svcAutoScroll\(container\s*\)/.test(corpo),
    'è rimasta una chiamata senza `soloInGiu`: basta quella a rifare lo strappo');
});

test('2) il TETTO della 127 è ancora al suo posto (la cura non lo alza)', () => {
  const t = corpoDi('_svcTettoScroll');
  assert.ok(/Math\.min\(fondo,\s*m\.cimaScheda\)/.test(t),
    'il tetto non limita più lo scroll alla cima della scheda: la 127 si riaprirebbe');
});

// ── ② l'esito dentro la scheda ──────────────────────────────────────────────────────────

test('3) 🚨 l\'esito si scrive SOPRA la barra dei bottoni, non in fondo alla scheda', () => {
  const c = corpoDi('_svcSchedaEsito');
  assert.ok(/svc-edit-actions-bar/.test(c) && /insertBefore\(riga,\s*barra\)/.test(c),
    'la riga d\'esito deve stare ATTACCATA alla barra dei bottoni: è lì che guarda chi ha appena cliccato');
});

test('4) senza scheda aperta è un NO-OP, non un errore', () => {
  const c = corpoDi('_svcSchedaEsito');
  assert.ok(/if \(!box\) return null/.test(c),
    'chiamata a scheda chiusa deve tornare null in silenzio: la chat da sola basta, e un\'eccezione qui fermerebbe un salvataggio riuscito');
});

test('5) ⭐ il colore si DEDUCE dal segno, e la regola si ESEGUE (non si legge)', () => {
  // Si ritaglia l'espressione VERA dal sorgente e la si fa girare: prova la regola spedita, non
  // una sua copia riscritta qui — che è il modo classico in cui un caso finisce per misurare
  // sé stesso invece del codice.
  const c = corpoDi('_svcSchedaEsito');
  const m = c.match(/const _t = tipo \|\| \(([\s\S]*?)\);\n/);
  assert.ok(m, 'la deduzione del tipo non c\'è più');
  // ⚠️ `tipo ||` va RIMESSO davanti: il ritaglio parte dopo. Senza, il caso in fondo — «il tipo
  // dichiarato vince sulla deduzione» — misurerebbe una funzione che il tipo non lo riceve, e
  // fallirebbe accusando il codice invece di sé stesso. (Successo il 03/09, in questo stesso banco.)
  const dedotto = new Function('tipo', 'html', 'return (tipo || (' + m[1] + '));');
  assert.equal(dedotto(undefined, '✅ Importo aggiornato su Matchpoint'), 'ok');
  assert.equal(dedotto(undefined, '⚠️ Nessun importo aggiornato.'), 'ko');
  assert.equal(dedotto(undefined, '❌ Modifica non eseguita'), 'ko');
  assert.equal(dedotto(undefined, '⏳ Sto elaborando…'), 'wait');
  assert.equal(dedotto(undefined, '⌛ Esito non confermato'), 'wait');
  assert.equal(dedotto(undefined, '↻ Incasso Cash…'), 'wait');
  // Una frase senza segno non inventa un colore: meglio neutra che verde per sbaglio.
  assert.equal(dedotto(undefined, 'Modifica chiusa.'), '');
  // E il tipo dichiarato a mano vince sempre sulla deduzione.
  assert.equal(dedotto('ko', '✅ sembra andata bene'), 'ko');
});

test('6) i tre bottoni della scheda partita scrivono l\'esito anche LÌ', () => {
  // Salva importi (132), incasso e storno: sono i gesti i cui bottoni stanno DENTRO la scheda.
  for (const fn of ['_pmoSetCharges', '_pmoCollectPayment', '_pmoVoidPayment']) {
    assert.ok(/_svcSchedaEsito\(/.test(corpoDi(fn)),
      fn + ' non scrive l\'esito dentro la scheda: il suo bottone sta lì, ma la risposta finirebbe solo in fondo alla chat');
  }
});

// ── ③ la pastiglia ──────────────────────────────────────────────────────────────────────

test('7) 🚨 la pastiglia PORTA IL TESTO: l\'esito si legge senza cliccare niente', () => {
  const c = corpoDi('_svcAggiornaPastiglia');
  assert.ok(/st\.testo/.test(c),
    'una pastiglia che dice solo «messaggio nuovo» costringe a un secondo gesto per sapere com\'è andata: il risultato resterebbe nascosto, che è esattamente ciò che la voce cura');
});

test('8) sparisce da sé quando il messaggio entra nel bordo (anche scorrendo a mano)', () => {
  const c = corpoDi('_svcAggiornaPastiglia');
  assert.ok(/if \(st\.visibile\)[\s\S]{0,120}hidden = true/.test(c),
    'la pastiglia deve nascondersi appena l\'ultimo messaggio è visibile');
  const e = corpoDi('_svcEnsureAutoScroll');
  assert.ok(/addEventListener\('scroll'/.test(e) && /_svcAggiornaPastiglia/.test(e),
    'senza l\'aggancio allo scroll resterebbe accesa mentre l\'operatore è già arrivato in fondo');
});

test('9) ⭐ il click sulla pastiglia SCAVALCA il tetto — ed è l\'unico punto in cui è lecito', () => {
  const c = corpoDi('_svcPastiglia');
  assert.ok(/scrollTop = cont\.scrollHeight/.test(c),
    'il click deve portare davvero in fondo: passare da _svcAutoScroll lo fermerebbe alla cima della scheda, cioè non farebbe niente');
  // ⚖️ E dev'essere l'UNICO: un salto in fondo deciso dal programma è il difetto della 127.
  const quanti = (APP.match(/scrollTop = cont\.scrollHeight/g) || []).length;
  assert.equal(quanti, 1,
    'lo scavalco del tetto è comparso in più di un punto: qui è lecito perché è un gesto esplicito dell\'operatore, altrove sarebbe la 127 daccapo');
});

test('10) resta l\'ULTIMO figlio, o un messaggio nuovo la coprirebbe', () => {
  const c = corpoDi('_svcPastiglia');
  assert.ok(/lastElementChild/.test(c),
    'la pastiglia va rimessa in fondo quando un messaggio nuovo la scavalca');
});

test('11) 🚨 non è una BOLLA di chat: non deve entrare nel conteggio dei messaggi', () => {
  assert.ok(!/class="svc-chat-nuovi svc-msg|svc-msg svc-chat-nuovi/.test(APP),
    'con la classe .svc-msg la pastiglia diventerebbe «l\'ultimo messaggio» e si giudicherebbe da sé visibile: la guardia si accecherebbe da sola');
  const c = corpoDi('_svcUltimoMsgVisibile');
  assert.ok(/:scope > \.svc-msg/.test(c),
    'l\'ultimo messaggio si cerca fra i figli diretti .svc-msg, non fra tutti i discendenti');
});

console.log('\n' + passed + ' passati, ' + failed + ' falliti');
process.exit(failed ? 1 : 0);
