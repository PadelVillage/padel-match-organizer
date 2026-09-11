// lidreserva-e-un-codice-di-matchpoint.test.mjs — 11/09/2026
//
// 🗣️ Regola del committente: *«ti dico che idreserva non ci serve più perché è un codice di
//    matchpoint»*.
//
// 📏 IL DIFETTO CHE NE DISCENDE, misurato nel sorgente: **tre** strade che devono sopravvivere
//    allo spegnimento di Matchpoint erano chiuse **da un codice di Matchpoint**, perché la
//    guardia `NO_IDRESERVA` stava **prima del bivio** invece che dentro la strada che lo usa —
//    l'incasso (`_pmoCollectPayment`), l'importo a carico (`_pmoSetCharges`) e lo storno
//    (`_pmoVoidPayment`). Il ramo nativo dichiarava *«niente edge, niente worker, niente
//    Matchpoint — per costruzione»* e **non poteva nemmeno essere raggiunto**.
//
// 🎯 È la prova del futuro di questo progetto, applicata e fallita: *il giorno in cui Matchpoint
//    si spegne, questa strada non si tocca.* Oggi si fermava.
//
// ⚖️ E questo banco pretende ANCHE il contrario, che è la metà che rende la cura una cura e non
//    un allentamento: sulla strada di **Matchpoint** l'identificativo resta **obbligatorio**.
// 📌 *Una guardia che protegge una strada non va messa al bivio: da lì ferma anche chi prende
//    l'altra.*
//
// ⚠️ E NON sblocca niente oggi, misurato prima di scriverlo: su `cudi` le 37 `staff_booking`
//    vive hanno tutte un `id_reserva`, comprese le 4 non promosse da Matchpoint. È una cura
//    preventiva, e sta scritta per tale.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const APP = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8');

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
/** Il sorgente SENZA commenti: una sonda che legge i commenti prova il commento. */
function codiceDi(nome) {
  return sorgenteDi(nome)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').map((r) => r.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');
}

// ── ① LE TRE GUARDIE NON STANNO PIÙ AL BIVIO ─────────────────────────────────────────────
test('l\'INCASSO nativo non chiede più un codice di Matchpoint', () => {
  const c = codiceDi('_pmoCollectPayment');
  const g = c.indexOf("'NO_IDRESERVA'");
  assert.ok(g > 0, 'la guardia è sparita del tutto: sulla strada di Matchpoint deve restare');
  const cond = c.slice(c.lastIndexOf('if (', g), g);
  assert.match(cond, /_cassa/,
    'la guardia NO_IDRESERVA non guarda la cassa nativa: ferma anche chi non va su Matchpoint');
});

test('lo STORNO nativo non chiede più un codice di Matchpoint', () => {
  const c = codiceDi('_pmoVoidPayment');
  const g = c.indexOf("'NO_IDRESERVA'");
  assert.ok(g > 0, 'la guardia è sparita del tutto');
  const cond = c.slice(c.lastIndexOf('if (', g), g);
  assert.match(cond, /_cassa/, 'lo storno nativo resta chiuso da un codice di Matchpoint');
});

test('l\'IMPORTO A CARICO nativo non chiede più un codice di Matchpoint', () => {
  const c = codiceDi('_pmoSetCharges');
  const g = c.indexOf("'NO_IDRESERVA'");
  assert.ok(g > 0, 'la guardia è sparita del tutto');
  const cond = c.slice(c.lastIndexOf('if (', g), g);
  assert.match(cond, /_collegatoAlCircolo/,
    'la guardia non guarda se siamo collegati al circolo: ferma anche `_pmoSetChargesNativo`, che l\'identificativo non lo riceve nemmeno');
  // ⚖️ E deve stare DOPO che quel fatto è noto, o guarderebbe una variabile non ancora decisa.
  assert.ok(g > c.indexOf('_collegatoAlCircolo = (typeof pmoGestionaleCollegatoAlCircolo'),
    'la guardia gira prima che si sappia su quale strada si è');
});

test('…ma sulla strada di MATCHPOINT l\'identificativo resta obbligatorio', () => {
  // 🚨 La metà che rende questa una cura e non un allentamento: là serve davvero a mirare la
  //    ficha, e senza si scriverebbe a caso.
  for (const f of ['_pmoCollectPayment', '_pmoVoidPayment', '_pmoSetCharges']) {
    assert.match(codiceDi(f), /NO_IDRESERVA/,
      f + ' non rifiuta più nemmeno su Matchpoint: là l\'identificativo serve a mirare la ficha');
  }
});

// ── ② DUE ASSENZE NON SONO UNA CORRISPONDENZA ────────────────────────────────────────────
function montaStessaScheda() {
  const src = [sorgenteDi('_pmoOraNorm'), sorgenteDi('_pmoStessaScheda')].join('\n');
  return new Function(`${src}\nreturn _pmoStessaScheda;`)();
}
const SCHEDA = (extra) => Object.assign({ origIso: '2026-09-14', origCampo: 3, origOra: '18:00' }, extra || {});

test('con gli identificativi si confrontano quelli', () => {
  const f = montaStessaScheda();
  assert.equal(f(SCHEDA({ idReserva: 'MP-1' }), 'MP-1', '2026-01-01', 9, '07:00'), true,
    'con due identificativi uguali è la stessa scheda, comunque stiano le coordinate');
  assert.equal(f(SCHEDA({ idReserva: 'MP-1' }), 'MP-2', '2026-09-14', 3, '18:00'), false,
    'due identificativi diversi sono due prenotazioni diverse, anche sullo stesso slot');
});

test('senza identificativi si confrontano le COORDINATE', () => {
  const f = montaStessaScheda();
  assert.equal(f(SCHEDA(), '', '2026-09-14', 3, '18:00'), true);
  assert.equal(f(SCHEDA(), '', '2026-09-14', 4, '18:00'), false, 'campo diverso, scheda diversa');
  assert.equal(f(SCHEDA(), '', '2026-09-15', 3, '18:00'), false, 'giorno diverso, scheda diversa');
  assert.equal(f(SCHEDA(), '', '2026-09-14', 3, '19:30'), false, 'ora diversa, scheda diversa');
  assert.equal(f(SCHEDA({ origCampo: 'Campo 3' }), '', '2026-09-14', '3', '18:00'), true,
    '«Campo 3» e 3 sono lo stesso campo');
  assert.equal(f(SCHEDA({ origOra: '09:00' }), '', '2026-09-14', 3, '9:00'), true,
    'l\'ora si pareggia anche qui, o «9:00» e «09:00» sarebbero due slot');
});

test('⭐ DUE VUOTI NON SI CONFRONTANO UGUALI: è il difetto che questa cura poteva introdurre', () => {
  /* 🚨⭐⭐ Il codice di prima diceva `String(st.idReserva||'') === idReserva`. Tolto
   *    l'identificativo, quello diventa `'' === ''` ⇒ **vero per QUALUNQUE scheda aperta**, e
   *    l'incasso aggiornerebbe il roster di una partita che non c'entra niente — cioè la cura
   *    avrebbe aperto un buco peggiore di quello che chiudeva.
   * 📌 *Due assenze che si confrontano uguali non sono una corrispondenza: sono la mancanza di
   *    una domanda.* */
  const f = montaStessaScheda();
  assert.equal(f(SCHEDA(), '', null, null, null), false,
    'senza identificativo E senza coordinate dice «sì»: aggiornerebbe una scheda a caso');
  assert.equal(f(SCHEDA(), '', '2026-09-14', 3, ''), false, 'con un\'ora vuota non si decide');
  assert.equal(f(null, '', '2026-09-14', 3, '18:00'), false, 'senza scheda aperta non c\'è niente da confrontare');
});

test('nessuno dei cinque punti confronta più gli identificativi a mano', () => {
  // 🚨 Sabotaggio che ferma: rimetterne anche UNO solo riporta il `'' === ''` in quel punto, e
  //    gli altri quattro verdi lo coprirebbero.
  const rimasti = (APP.match(/String\(stOpen\.idReserva \|\| ''\) === idReserva/g) || []).length;
  assert.equal(rimasti, 0, 'ci sono ancora ' + rimasti + ' confronti a mano: lì due vuoti tornano uguali');
});
