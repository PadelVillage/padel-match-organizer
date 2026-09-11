// una-domanda-per-volta-e-si-fa-vedere.test.mjs — VOCE 210 (11/09/2026)
//
// 🗣️ Sua segnalazione, con lo schermo davanti: *«Perché se io clicco i bottoni cash e card uno
//    dopo l'altro mi fa questo, dovrebbe non darmi tutti questi tentativi oppure è giusto?»*
// 📏 La cifra è nel suo schermo: `↓ 10 nuovi · 💰 CASSA DEL GESTIONALE — Incassare 12,00 € da
//    Lidia Comes in Card?` ⇒ dieci richieste di conferma accodate, tutte **fuori dalla vista**.
//
// 🚨⭐⭐ COSA QUESTO BANCO PRETENDE, e perché non è «meno messaggi». Queste conferme non sono un
//    dialogo modale: sono messaggi in un pannello che scorre. ⇒ Dieci domande che nessuno vede
//    non sono dieci tentativi, sono **zero incassi** — e chi preme non ha modo di saperlo.
// ⚖️ Quindi si pretendono TRE cose, e la terza è quella che si dimentica:
//    ① una sola richiesta aperta per volta;
//    ② la nuova **sostituisce** la vecchia (chi preme Cash e poi Card ha cambiato idea, non ha
//      chiesto due incassi);
//    ③ la sostituzione **si dichiara** — se no si scambia una coda invisibile con un **annullo**
//      invisibile, che sui soldi è peggio.
// 📌 *Togliere in silenzio una richiesta di denaro è lo stesso difetto di accodarla: in tutti e
//    due i casi qualcuno decide al posto di chi guarda.*

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const QUI = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(QUI, '..', 'index.html'), 'utf8');

function sorgenteDi(nome) {
  let i = APP.indexOf('function ' + nome + '(');
  assert.ok(i > 0, 'funzione non trovata: ' + nome);
  if (APP.slice(Math.max(0, i - 6), i) === 'async ') i -= 6;
  const apre = APP.indexOf(') {', i);
  let g = 0, visto = false, k = apre + 2;
  for (; k < APP.length; k++) {
    const c = APP[k];
    if (c === '{') { g++; visto = true; }
    else if (c === '}') { g--; if (visto && g === 0) { k++; break; } }
  }
  return APP.slice(i, k);
}

/* ── un pannello di servizio finto, con la STRUTTURA VERA del messaggio ──────────────────
 * 🚨⭐⭐ E la struttura è stata MISURATA sulla pagina viva, non immaginata. Il primo banco
 *    modellava il messaggio come «una riga sola», e su quel modello la cura sembrava corretta.
 *    📏 Guardando il DOM vero, i figli sono TRE: `.svc-msg-label` · la riga della domanda ·
 *    `.svc-step-buttons`. ⇒ `:scope > div:last-child` **non è la domanda, sono i bottoni** —
 *    e la prima versione della cura ci scriveva dentro la nota, ottenendo l'effetto giusto per
 *    la ragione sbagliata.
 * 📌 *Un banco che modella una struttura più semplice di quella vera non prova la cura: prova
 *    la cura contro il proprio disegno.* */
function finsiMessaggio() {
  const label = { tag: 'label', innerHTML: '🤖 Sistema' };
  const domanda = { tag: 'domanda', innerHTML: '' };
  const figli = [label, domanda];
  const m = {
    _label: label, _domanda: domanda, _figli: figli, innerHTML: '',
    get _bottoni() { return figli.filter((f) => f.tag === 'btns'); },
    get _note() { return figli.filter((f) => f.tag === 'nota'); },
    querySelector: (sel) => (sel === ':scope > div:last-child' ? figli[figli.length - 1] : null),
    querySelectorAll: (sel) => (/button/.test(sel) ? figli.filter((f) => f.tag === 'btns') : []),
    appendChild: (n) => { figli.push(n); return n; },
  };
  return m;
}

function monta() {
  const sorgente = [
    sorgenteDi('_pmoCollectChiudiPendente'),
    sorgenteDi('_pmoPortaInVista'),
    sorgenteDi('_pmoConfirmCollect'),
  ].join('\n');
  const reg = { messaggi: [], portateInVista: [], scrollTop: 0 };
  const fab = new Function('REG', 'NUOVO', `
    var _pmoCollectPending = null;
    const PMO_IS_TEST_ENV = false;
    const window = {};
    const escapeHtml = (s) => String(s == null ? '' : s);
    const _incassiEuro = (c) => (c / 100).toFixed(2).replace('.', ',') + ' €';
    const requestAnimationFrame = (f) => f();
    const svcAddMessage = function (chi, html) {
      const m = NUOVO(); m._domanda.innerHTML = html;
      REG.messaggi.push(m); REG.ultimo = m; return m;
    };
    const svcMakeStepButtons = function (labels, onChoose, onCancel) {
      const b = { tag: 'btns', _si: onChoose, _no: onCancel,
        remove() { b._tolto = true; const i = REG.ultimo._figli.indexOf(b); if (i >= 0) REG.ultimo._figli.splice(i, 1); } };
      return b;
    };
    const document = { getElementById: () => REG.cont, createElement: () => ({ tag: 'nota', style: {}, innerHTML: '', className: '' }) };
    ${sorgente}
    return {
      chiedi: _pmoConfirmCollect,
      chiudiPendente: _pmoCollectChiudiPendente,
      portaInVista: _pmoPortaInVista,
      pendente: () => _pmoCollectPending,
    };
  `);
  return { ...fab(reg, finsiMessaggio), reg };
}

// ── ① UNA SOLA DOMANDA APERTA ────────────────────────────────────────────────────────────
test('dieci click non accodano dieci richieste: ne resta UNA', async () => {
  const m = monta();
  const esiti = [];
  for (let i = 0; i < 10; i++) {
    m.chiedi('Lidia Comes', i % 2 ? 'Card' : 'Cash', 1200).then((r) => esiti.push(r));
  }
  await new Promise((r) => setImmediate(r));
  assert.equal(m.reg.messaggi.length, 10, 'i messaggi si scrivono tutti: la cronologia non si riscrive');
  assert.equal(esiti.length, 9, 'le nove richieste vecchie devono essersi già chiuse da sole');
  assert.deepEqual([...new Set(esiti)], [false], 'una richiesta sostituita non può risolversi in «sì, incassa»');
  assert.ok(m.pendente(), 'deve restare una richiesta aperta');
  assert.equal(m.pendente().come, 'Card', 'l\'ultima premuta è quella che vale: chi preme Card dopo Cash ha cambiato idea');
});

// ── ② LA SOSTITUZIONE SI DICHIARA ────────────────────────────────────────────────────────
test('la richiesta sostituita lo SCRIVE: non sparisce in silenzio', async () => {
  const m = monta();
  m.chiedi('Lidia Comes', 'Cash', 1200);
  m.chiedi('Lidia Comes', 'Card', 1200);
  await new Promise((r) => setImmediate(r));
  const vecchia = m.reg.messaggi[0];
  const nota = vecchia._note.map((n) => n.innerHTML).join(' ');
  assert.match(nota, /sostituita/i, 'la vecchia non dice di essere stata sostituita');
  assert.match(nota, /non è stato incassato/i, 'non dice la cosa che conta sui soldi: che non è stato incassato niente');
  assert.match(nota, /Card/, 'non dice QUALE richiesta l\'ha sostituita');
  // 🚨 E LA DOMANDA DEVE RESTARE LEGGIBILE: se la nota la sovrascrivesse, avrei tolto in
  //    silenzio la richiesta di denaro che stavo dichiarando di non voler togliere in silenzio.
  assert.match(vecchia._domanda.innerHTML, /Incassare/,
    'la nota ha cancellato la domanda: chi scorre indietro non sa più cosa gli era stato chiesto');
  assert.match(vecchia._domanda.innerHTML, /Cash/, 'e non sa più con quale metodo');
});

test('i bottoni della richiesta sostituita spariscono: un «Sì, incassa» morto è una bugia', async () => {
  const m = monta();
  m.chiedi('Lidia Comes', 'Cash', 1200);
  await new Promise((r) => setImmediate(r));
  const bottoneVecchio = m.reg.messaggi[0]._bottoni[0];
  m.chiedi('Lidia Comes', 'Card', 1200);
  await new Promise((r) => setImmediate(r));
  assert.equal(bottoneVecchio._tolto, true, 'il bottone della richiesta annullata è ancora lì e sembra premibile');
});

// ── ③ RISPONDERE CHIUDE DAVVERO ──────────────────────────────────────────────────────────
test('dopo la risposta non resta niente in sospeso, e un «sì» resta un sì', async () => {
  const m = monta();
  const p = m.chiedi('Lidia Comes', 'Cash', 1200);
  await new Promise((r) => setImmediate(r));
  m.reg.messaggi[0]._bottoni[0]._si();
  assert.equal(await p, true);
  assert.equal(m.pendente(), null, 'una richiesta risposta resta registrata come aperta: la prossima la «sostituirebbe»');
});

/* 🩹⭐⭐ QUI C'ERA UNA PROVA CHE NON POTEVA CADERE, e l'ha scoperta il sabotaggio.
 * Diceva *«rispondere due volte non cambia l'esito»* e premeva Sì poi No. Togliendo dal codice
 * la guardia `_done` **restava verde**: una Promise già risolta non si può ri-risolvere, quindi
 * a garantirlo è **il linguaggio**, non quella riga. ⇒ La prova non provava la guardia: provava
 * `Promise`.
 * ⚖️ La guardia resta nel codice — tiene onesta la contabilità di `_pmoCollectPending` in ordini
 *   che non so enumerare tutti — ma **si dichiara per quello che è**: una cintura in più, non il
 *   motivo per cui un doppio click è innocuo.
 * 📌 *Una prova che il linguaggio supera da solo non misura il codice: misura il linguaggio — e
 *    resta verde anche quando il codice non c'è più.* */

test('un doppio click resta innocuo, e a garantirlo è la Promise', async () => {
  const m = monta();
  const p = m.chiedi('Lidia Comes', 'Cash', 1200);
  await new Promise((r) => setImmediate(r));
  const b = m.reg.messaggi[0]._bottoni[0];
  b._si(); b._no();
  assert.equal(await p, true);
  assert.equal(m.pendente(), null, 'e la contabilità resta pulita: nessuna richiesta appesa');
});

// ── ④ LA DOMANDA SI PORTA SOTTO GLI OCCHI ────────────────────────────────────────────────
function montaVista(contRect, msgRect, scrollTop) {
  const cont = { scrollTop, getBoundingClientRect: () => contRect };
  const msg = { getBoundingClientRect: () => msgRect };
  const fab = new Function('CONT', 'MSG', `
    const document = { getElementById: () => CONT };
    ${sorgenteDi('_pmoPortaInVista')}
    return () => _pmoPortaInVista(MSG);
  `);
  return { cont, correre: fab(cont, msg) };
}

test('una domanda nata SOTTO il bordo viene portata dentro', () => {
  // 📏 Il caso misurato dalla 134 su PROD: pannello 711px, conferma 568px sotto il bordo.
  const v = montaVista({ top: 0, bottom: 711 }, { top: 1279, bottom: 1339 }, 0);
  v.correre();
  assert.ok(v.cont.scrollTop > 0, 'il pannello non si è mosso: la domanda resta dove nessuno la vede');
  assert.equal(v.cont.scrollTop, 1339 - 711 + 12);
});

test('una domanda nata SOPRA il bordo viene portata giù, non solo su', () => {
  const v = montaVista({ top: 0, bottom: 711 }, { top: -90, bottom: -30 }, 500);
  v.correre();
  assert.equal(v.cont.scrollTop, 500 - 90 - 12, 'una domanda sopra il bordo è invisibile quanto una sotto');
});

test('una domanda già visibile non fa saltare il pannello', () => {
  const v = montaVista({ top: 0, bottom: 711 }, { top: 200, bottom: 260 }, 340);
  v.correre();
  assert.equal(v.cont.scrollTop, 340, 'il pannello si è mosso senza motivo: chi stava leggendo ha perso il segno');
});

/** Il sorgente SENZA commenti. 🚨 Serve, e l'ho pagato subito: la sonda qui sotto cercava
 *  `scrollIntoView` e cadeva **sul mio stesso commento**, che la parola la NOMINA per dire di
 *  non usarla. È la lezione già scritta in `prove.yml` — *una guardia che cerca una parola prova
 *  che la parola c'è, non che il codice succeda* — presa in flagrante nel giro in cui la sonda
 *  veniva scritta. 📌 *Una sonda che legge i commenti prova il commento.* */
function codiceDi(nome) {
  return sorgenteDi(nome)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').map((r) => r.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');
}

test('non si usa scrollIntoView, che porterebbe via anche la PAGINA', () => {
  // 🚨 Sabotaggio che questa sonda ferma: quella funzione scrolla anche gli antenati ⇒ si
  //    muoverebbe la pagina sotto il pannello. Il difetto che si cura è «qualcosa si è mosso e
  //    non so cosa»: curarlo muovendo di più sarebbe curarlo al contrario.
  const codice = codiceDi('_pmoPortaInVista');
  assert.ok(/scrollTop/.test(codice), 'la sonda non sta guardando il codice giusto');
  assert.ok(!/scrollIntoView/.test(codice),
    '_pmoPortaInVista usa scrollIntoView: scrollerebbe anche la pagina, non solo il pannello');
});

test('la domanda si porta in vista DOPO che i bottoni sono attaccati', () => {
  // ⚖️ Prima dei bottoni il messaggio è più basso di quanto sarà: si porterebbe in vista una
  //    riga che poi cresce e riesce dal bordo — cioè si farebbe il gesto e non l'effetto.
  const src = sorgenteDi('_pmoConfirmCollect');
  const iBtn = src.indexOf('msg.appendChild(btns)');
  const iVista = src.indexOf('_pmoPortaInVista(msg)');
  assert.ok(iBtn > 0 && iVista > 0, 'manca uno dei due pezzi');
  assert.ok(iVista > iBtn, 'il porta-in-vista gira PRIMA dei bottoni: il messaggio crescerà e riuscirà dal bordo');
});

/* 🚨⭐⭐ IL CASO IN CUI L'APPROCCIO VECCHIO FACEVA DANNO DAVVERO.
 * La prima versione scriveva la nota dentro `:scope > div:last-child`, credendo fosse la riga
 * della domanda. 📏 Nel DOM vero l'ultimo figlio sono **i bottoni**, quindi la domanda restava —
 * per caso. ⛔ Ma se i bottoni NON sono attaccati (l'`appendChild` sta dentro un `try`, e
 * `svcMakeStepButtons` può fallire) l'ultimo figlio torna a essere **la domanda**, e la nota la
 * cancella: sparirebbe in silenzio proprio la richiesta di denaro che questa voce vuole non far
 * sparire in silenzio.
 * 📌 *Il caso che smaschera una premessa falsa non è quello frequente: è quello in cui la
 *    coincidenza che la teneva in piedi non c'è.* */
test('anche senza i bottoni attaccati, la domanda sopravvive alla sostituzione', async () => {
  const m = monta();
  m.chiedi('Lidia Comes', 'Cash', 1200);
  await new Promise((r) => setImmediate(r));
  const vecchia = m.reg.messaggi[0];
  // I bottoni non sono mai arrivati: ora l'ultimo figlio è la riga della domanda.
  vecchia._figli.length = 2;
  m.chiedi('Lidia Comes', 'Card', 1200);
  await new Promise((r) => setImmediate(r));
  assert.match(vecchia._domanda.innerHTML, /Incassare/,
    'senza bottoni la nota ha cancellato la domanda: la richiesta di denaro è sparita in silenzio');
  assert.ok(vecchia._note.length >= 1, 'e la nota della sostituzione non è stata scritta da nessuna parte');
});
