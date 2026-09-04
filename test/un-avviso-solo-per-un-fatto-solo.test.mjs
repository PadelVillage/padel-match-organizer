/* 🔔 «Un avviso solo per un fatto solo» — banco della voce 145 (04/09/2026).
 *
 * 🗣️ SUA SEGNALAZIONE dal telefono, su PROD 6.323:
 *   «Come vedi c'è ancora un doppio banner di messaggio, non va bene. Ce ne deve essere solo uno.»
 *   Nella schermata, nello STESSO istante: la riga gialla «↻ Salvo su Matchpoint l'importo a
 *   carico… (non chiudere)» dentro la scheda, e la striscia «💶 Cambio l'importo» in fondo.
 *
 * 🚨⭐⭐ IL PEZZO CHE VALE PIÙ DELLA CURA: sullo stesso difetto erano già passate DUE voci.
 *   · la **136** tolse il doppione fra la riga nella scheda e la **pastiglia**;
 *   · la **137 ⑤** stabilì la regola giusta — *gli avanzamenti escono dalla scheda, gli esiti
 *     restano* — e la applicò a `svcAddMessage`.
 *   ⇒ Nessuna delle due guardò `_svcSchedaEsito`, che è il **terzo** posto in cui una frase può
 *   comparire. 📌 *Una regola applicata in due punti su tre non è una regola: è una coincidenza
 *   che ha tenuto finché il terzo punto non è stato usato.*
 *
 * 🎯 LE TRE COSE CHE QUESTO BANCO DIFENDE:
 *   ① un `wait` NON disegna la riga nella scheda — la barra lo sta già raccontando;
 *   ② un `wait` TOGLIE la riga vecchia: un esito di prima lasciato accanto a un gesto in corso è
 *      peggio del doppione, perché è un doppione che dice un'altra cosa;
 *   ③ 🚨 gli esiti (`ok`, `ko`) restano, ed è il freno: la barra li mostra 6-14 secondi, un
 *      rifiuto col motivo dentro serve anche cinque minuti dopo. Se un giorno qualcuno
 *      "semplificasse" togliendo anche quelli, questa riga si rompe.
 *   ④ E il freno dell'altro verso: ogni punto che manda un `wait` deve essere un gesto che la
 *      BARRA racconta davvero (una edge classificata non-null in `SVC_AZIONI_DELLAPP`).
 *      Togliere un avviso che nessun altro ripete non è pulizia, è perdita.
 *
 * ⛔ QUELLO CHE NON DICE: gira senza browser. Dice che la funzione decide bene, non che sullo
 *    schermo si veda un banner solo. Quello lo dice una scheda vera.
 *
 * Esegui:  node test/un-avviso-solo-per-un-fatto-solo.test.mjs
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

/** Il corpo di `function nome(`, contando le graffe dalla PRIMA del corpo. */
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

// ─────────────────────────────────────────────────────────────────────────────
// Un DOM finto quel tanto che basta: la funzione si ESEGUE, non si rilegge.
// ─────────────────────────────────────────────────────────────────────────────
function montaDom() {
  const figli = [];
  const mkEl = (cls) => {
    const el = {
      className: cls || '', innerHTML: '', _padre: null,
      remove() { const i = figli.indexOf(el); if (i >= 0) figli.splice(i, 1); el._padre = null; },
    };
    return el;
  };
  const box = {
    querySelector(sel) {
      if (/svc-edit-esito/.test(sel)) return figli.find((f) => /svc-edit-esito/.test(f.className)) || null;
      if (/svc-edit-actions-bar/.test(sel)) return figli.find((f) => /svc-edit-actions-bar/.test(f.className)) || null;
      return null;
    },
    insertBefore(nuovo, rif) { const i = figli.indexOf(rif); figli.splice(i < 0 ? figli.length : i, 0, nuovo); nuovo._padre = box; },
    appendChild(nuovo) { figli.push(nuovo); nuovo._padre = box; },
  };
  const document = {
    querySelector(sel) { return /svc-edit-box/.test(sel) ? box : null; },
    createElement() { return mkEl(''); },
  };
  return { document, figli, box, mkEl };
}

const corpo = corpoDi('_svcSchedaEsito');
const fabbrica = new Function('document', 'return function _svcSchedaEsito(html, tipo) ' + corpo + '; ');

test('① un avanzamento (wait) NON disegna la riga nella scheda', () => {
  const dom = montaDom();
  const f = fabbrica(dom.document);
  const out = f('↻ Salvo su Matchpoint l\'importo a carico… (non chiudere)', 'wait');
  assert.equal(out, null, 'il wait non deve restituire una riga: la barra lo sta già dicendo');
  assert.equal(dom.figli.filter((x) => /svc-edit-esito/.test(x.className)).length, 0,
    'la riga gialla è tornata dentro la scheda ⇒ due banner per lo stesso fatto');
});

test('① vale anche col tipo DEDOTTO dal segno in testa (↻ ⏳ ⌛ 🧪 🔄)', () => {
  for (const segno of ['↻', '⏳', '⌛', '🧪', '🔄']) {
    const dom = montaDom();
    const f = fabbrica(dom.document);
    assert.equal(f(segno + ' Sto facendo qualcosa…'), null,
      'un avanzamento che non dichiara il tipo deve essere riconosciuto lo stesso: ' + segno);
  }
});

test('② un wait TOGLIE la riga vecchia rimasta lì', () => {
  const dom = montaDom();
  const f = fabbrica(dom.document);
  f('✅ Importo aggiornato su Matchpoint', 'ok');
  assert.equal(dom.figli.length, 1, 'l\'esito deve esserci');
  f('↻ Salvo su Matchpoint gli importi a carico… (non chiudere)', 'wait');
  assert.equal(dom.figli.length, 0,
    'la riga vecchia è rimasta accanto al gesto in corso: è un doppione che dice un\'altra cosa');
});

test('③ 🚨 gli ESITI restano — è il freno, non un dettaglio', () => {
  const dom = montaDom();
  const f = fabbrica(dom.document);
  const ok = f('✅ Importo aggiornato su Matchpoint', 'ok');
  assert.ok(ok, 'l\'esito positivo deve restare nella scheda');
  assert.match(ok.className, /svc-edit-esito/);
  assert.match(ok.className, /\bok\b/);
  const ko = f('⚠️ Nessun importo aggiornato. Il campo risulta già pagato.', 'ko');
  assert.ok(ko, 'il rifiuto col motivo dentro serve anche cinque minuti dopo: la barra dura 6-14s');
  assert.match(ko.className, /\bko\b/);
  assert.match(ko.innerHTML, /già pagato/, 'il motivo non si perde per strada');
});

test('③ e l\'esito RIUSA la riga invece di accumularne una nuova a ogni giro', () => {
  const dom = montaDom();
  const f = fabbrica(dom.document);
  f('✅ Primo', 'ok'); f('⚠️ Secondo', 'ko'); f('✅ Terzo', 'ok');
  assert.equal(dom.figli.length, 1, 'le righe di esito si accumulano: la scheda si allunga a ogni gesto');
  assert.match(dom.figli[0].innerHTML, /Terzo/);
});

test('③ senza scheda aperta non esplode e non inventa niente', () => {
  const f = fabbrica({ querySelector: () => null, createElement: () => ({}) });
  assert.equal(f('✅ Fatto', 'ok'), null);
  assert.equal(f('↻ In corso…', 'wait'), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// ④ il freno dell'altro verso: un wait tolto dev'essere raccontato dalla BARRA
// ─────────────────────────────────────────────────────────────────────────────
test('④ ogni punto che manda un `wait` è un gesto che la barra racconta', () => {
  // I chiamanti di `_svcSchedaEsito` stanno dentro `_setMsg` locali: si prende il testo attorno
  // e si guarda quale edge quel blocco chiama davvero.
  const punti = [];
  let i = APP.indexOf('_svcSchedaEsito(html, tipo);');
  while (i > 0) { punti.push(i); i = APP.indexOf('_svcSchedaEsito(html, tipo);', i + 1); }
  assert.ok(punti.length >= 3, 'i punti che scrivono nella riga della scheda sono spariti: trovati ' + punti.length);

  const classificate = (function () {
    const j = APP.indexOf('const SVC_AZIONI_DELLAPP = {');
    assert.ok(j > 0, 'la mappa delle azioni della barra non c\'è più');
    const blocco = APP.slice(j, APP.indexOf('\n  };', j));
    const vive = new Set();
    blocco.split('\n').forEach((r) => {
      const m = r.match(/'(matchpoint-[a-z-]+)':\s*(\{|null)/);
      if (m && m[2] === '{') vive.add(m[1]);
    });
    return vive;
  })();
  assert.ok(classificate.size >= 8, 'la mappa della barra si è svuotata: ' + classificate.size);

  punti.forEach((p) => {
    const intorno = APP.slice(p, p + 9000);
    const edge = (intorno.match(/functions\/v1\/(matchpoint-[a-z-]+)/) || [])[1];
    assert.ok(edge, 'un punto che scrive un avanzamento non chiama nessuna edge riconoscibile: '
      + 'non si può dire se la barra lo racconti');
    assert.ok(classificate.has(edge),
      '🚨 `' + edge + '` non è classificata nella barra: togliere il suo avanzamento dalla scheda '
      + 'toglierebbe l\'unico posto in cui quel gesto è scritto');
  });
});

console.log('\n' + passed + ' passate, ' + failed + ' fallite');
process.exit(failed ? 1 : 0);
