/* 🔗 «Un nome muto non promette» — banco della voce 138 (03/09/2026).
 *
 * 🗣️ LA VOCE È SUA, detta guardando PROD 6.285 col Wallet appena messo in servizio: «manca la
 * possibilità di cliccare sul nome del giocatore e ti apre la sua scheda di anagrafica» — e la
 * notte prima: «potrebbe essere carino… ma non so se si può fare».
 *
 * ✅ SCELTA SUA fra tre strade, la **ⓒ**: la scheda si apre **SOPRA**, senza cambiare tab.
 * ⚖️ Le altre due pagavano un prezzo che questa non paga: la ⓐ (cliccabile solo se non c'è niente
 * di modificato) lascia il click **a volte assente**, e un nome che a volte non risponde è un nome
 * di cui non ci si fida; la ⓑ (chiedi conferma) mette un popup nel mezzo del lavoro.
 *
 * 🚨⭐⭐ E LA SCHEDA DELLA VOCE DICEVA CHE LA ⓒ ERA «LA PIÙ LUNGA DA FARE». Falso, misurato prima
 * di scrivere una riga: `openMemberCard` **non cambia tab** — disegna dentro `#memberCardOverlay`,
 * un `position:fixed` **fratello del login**, fuori da ogni tab. Chiamarla dal calendario apre la
 * scheda sopra e basta.
 * 📌 *Prima di costruire, guarda cosa c'è già.* È la seconda volta nella stessa giornata: il
 * semaforo della 137 era spento dietro un commento, questo era già della forma giusta.
 *
 * 🎯 E LA REGOLA CHE QUESTO BANCO DIFENDE PIÙ DI TUTTE: **gli «Ospite» restano nomi MUTI**. Nelle
 * sue schermate sono spesso la maggioranza delle righe, e non hanno una scheda da aprire.
 * 📌 *Un nome cliccabile che non apre niente è peggio di un nome normale: promette e non mantiene.*
 *
 * ⛔ QUELLO CHE QUESTO BANCO **NON** DICE: che cliccando si apra davvero la scheda giusta, e che
 * gli importi digitati si ritrovino chiudendola. Gira senza browser ⇒ prova le REGOLE. Quello lo
 * dice il suo dito su una partita vera.
 *
 * Esegui:  node test/il-nome-muto-non-promette.test.mjs
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

/** Le sole righe di CODICE: via i commenti.
 *  🩹 Serve, e nella sessione di oggi l'ho imparato tre volte: una sonda che cerca «questa cosa
 *  non deve comparire» e guarda anche i commenti dà l'allarme proprio a chi ha scritto la difesa. */
function soloCodice(testo) {
  return String(testo).split('\n').filter(function (r) {
    return !/^\s*(\/\/|\*|\/\*)/.test(r);
  }).join('\n');
}

/** Dove finisce `function nome(`: l'indice DOPO la sua graffa di chiusura.
 *  ⚠️ Le graffe si contano dalla prima del CORPO e non dalla firma: un valore predefinito `= {}`
 *  ne aprirebbe e chiuderebbe una prima, e il ritaglio finirebbe dopo tre caratteri. */
function estremiDi(nome) {
  const i = APP.indexOf('function ' + nome + '(');
  assert.ok(i > 0, 'funzione non trovata: ' + nome);
  const apre = APP.indexOf(') {', i);
  assert.ok(apre > i, 'firma inattesa: ' + nome);
  let g = 0, visto = false, k = apre + 2;
  for (; k < APP.length; k++) {
    const c = APP[k];
    if (c === '{') { g++; visto = true; }
    else if (c === '}') { g--; if (visto && g === 0) { k++; break; } }
  }
  return { inizio: i, corpo: apre + 2, fine: k };
}

/** Il solo CORPO — per guardarci dentro con una regex. */
function corpoDi(nome) {
  const e = estremiDi(nome);
  return APP.slice(e.corpo, e.fine);
}

/** La DICHIARAZIONE intera, `function nome(…) { … }` — per poterla ESEGUIRE.
 *  🩹 La prima stesura di questo banco passava a `new Function` il solo CORPO: invece di
 *  definire la funzione lo eseguiva sul posto, e cascava con `cleanCell is not defined` su una
 *  chiamata che nessuno aveva chiesto. Una sonda che sbaglia a ritagliare non trova un difetto:
 *  ne inventa uno, e per un attimo sembra vero. */
function dichiarazioneDi(nome) {
  const e = estremiDi(nome);
  return APP.slice(e.inizio, e.fine);
}

// La regola di ricerca del socio, ESEGUITA — non cercata con una regex.
const trovaSocio = new Function(
  'giocatori', 'pmoChiaveCodiceCliente', 'pmoIdMatchpoint',
  dichiarazioneDi('_staffCalSocioDelGiocatore') + '\nreturn _staffCalSocioDelGiocatore;'
);

// Le due funzioni vere dell'app, estratte così come sono: se cambiano, cambia anche questo banco.
// 🩹 A tutt'e due va passato `cleanCell`, e la prima stesura non lo dava alla prima: dentro
//    `_staffCalSocioDelGiocatore` il `ReferenceError` finiva nel `try/catch`, che tornava `null`
//    — cioè il banco diceva «il socio non si trova» quando a non funzionare era LA SONDA.
//    📌 *Un catch che ingoia tutto protegge l'app e acceca chi la prova: quando una prova
//       fallisce contro una funzione difesa così, il primo sospettato è la prova.*
const CLEAN = function (v) { return String(v == null ? '' : v).trim(); };
const chiave = new Function('cleanCell', dichiarazioneDi('pmoChiaveCodiceCliente') + '\nreturn pmoChiaveCodiceCliente;')(CLEAN);
const idMp = new Function('cleanCell', dichiarazioneDi('pmoIdMatchpoint') + '\nreturn pmoIdMatchpoint;')(CLEAN);

const SOCI = [
  { id: 'm1', nome: 'Alberto Chiapinotto', memberId: '000140' },
  { id: 'm2', nome: 'Erika Poser', memberId: '000255' },
  { id: 'm3', nome: 'Senza codice', memberId: 'PMO-abc' },
];
const cerca = (p) => trovaSocio(SOCI, chiave, idMp)(p);

// ── ① IL SOCIO SI TROVA, E LA CHIAVE SI NORMALIZZA ──────────────────────────────────────────
test('un giocatore del roster trova il suo socio', () => {
  const s = cerca({ nome: 'Alberto Chiapinotto', idCliente: '000140' });
  assert.ok(s, 'socio non trovato');
  assert.equal(s.id, 'm1');
});

test('«140» e «000140» sono lo stesso socio', () => {
  // Il roster e l'anagrafica non scrivono il codice con lo stesso numero di zeri: senza la
  // normalizzazione a sei cifre metà dei nomi resterebbero muti senza una ragione visibile.
  assert.equal(cerca({ idCliente: '140' }).id, 'm1');
  assert.equal(cerca({ idCliente: '000140' }).id, 'm1');
});

test('gli zeri IN ECCESSO non si tolgono — limite dichiarato, non difetto di questa voce', () => {
  // 📏 Misurato scrivendo il banco: `pmoChiaveCodiceCliente` riempie gli zeri MANCANTI
  //    (`padStart(6)`) ma non toglie quelli in più ⇒ «00000140» a otto cifre non aggancia.
  // ⛔ Non si cura QUI, ed è una scelta: quella funzione è la stessa che regge l'anti-omonimia
  //    delle SCRITTURE su Matchpoint (`pmoChiaveCodiceCliente` in `index.html:11491`). Allargarla
  //    per far cliccare un nome vorrebbe dire toccare la guardia che impedisce di aggiungere il
  //    socio sbagliato a una partita: un prezzo sproporzionato al guadagno.
  // ⚖️ E il caso è teorico: Matchpoint i codici li scrive a sei cifre. Se un giorno smettesse, il
  //    sintomo sarebbe un nome muto — cioè il verso SICURO in cui sbagliare, non un nome che apre
  //    la scheda di qualcun altro.
  assert.equal(cerca({ idCliente: '00000140' }), null);
});

// ── ② GLI «OSPITE» RESTANO MUTI — la regola che vale più di tutte ────────────────────────────
test('un «Ospite» non trova nessuno', () => {
  // 📌 Un nome cliccabile che non apre niente è peggio di un nome normale: promette e non mantiene.
  assert.equal(cerca({ nome: 'Ospite', idCliente: '' }), null);
  assert.equal(cerca({ nome: 'Ospite' }), null);
  assert.equal(cerca({ nome: 'Ospite', idCliente: null }), null);
});

test('un codice che non è un numero non aggancia niente', () => {
  assert.equal(cerca({ idCliente: 'PMO-abc' }), null);
  assert.equal(cerca({ idCliente: 'ospite' }), null);
});

test('un codice che nessun socio ha resta muto, non aggancia il primo che passa', () => {
  assert.equal(cerca({ idCliente: '999999' }), null);
});

test('un socio senza codice Matchpoint non viene agganciato per sbaglio', () => {
  // `pmoIdMatchpoint` torna '' per un `PMO-…`: se la chiave vuota facesse coppia con la chiave
  // vuota di un Ospite, OGNI ospite aprirebbe la scheda di quel socio. È il difetto peggiore
  // possibile qui, ed è silenzioso.
  assert.equal(cerca({ nome: 'Ospite', idCliente: '' }), null);
  assert.equal(idMp(SOCI[2]), '', 'il socio di prova non è più senza codice: il caso non è coperto');
});

// ── ③ NON SI ROMPE ──────────────────────────────────────────────────────────────────────────
test('un roster malformato non fa cadere la scheda', () => {
  for (const rotto of [null, undefined, {}, { idCliente: {} }, { idCliente: [] }]) {
    assert.doesNotThrow(function () { cerca(rotto); }, JSON.stringify(rotto));
  }
});

// ── ④ LA CUCITURA — la ⓒ, e il nome che non è un bottone ────────────────────────────────────
test('si apre la scheda SOPRA, senza cambiare tab', () => {
  const corpo = soloCodice(corpoDi('staffCalRenderPlayersEditor'));
  assert.ok(/openMemberCard\(String\(_socio\.id\)\)/.test(corpo), 'il nome non apre più la scheda');
  assert.ok(!/switchTab/.test(corpo), 'è tornato un cambio di tab: la ⓒ era «senza lasciare il calendario»');
});

test('l\'overlay della scheda socio è fuori da ogni tab', () => {
  // È il fatto che rende la ⓒ corta: se l'overlay vivesse dentro il tab Anagrafica, aprirlo dal
  // calendario vorrebbe dire cambiare tab, e il prezzo che la voce temeva tornerebbe.
  const i = APP.indexOf('id="memberCardOverlay"');
  assert.ok(i > 0, 'l\'overlay della scheda socio non c\'è più');
  const dopo = APP.slice(i, i + 400);
  assert.ok(/pmoLoginOverlay/.test(dopo), 'l\'overlay non è più fratello del login: potrebbe essere finito dentro un tab');
});

test('il nome NON è un bottone', () => {
  // In questa scheda ogni bottone scrive su Matchpoint: uno innocuo in mezzo a quelli è un
  // invito a sbagliare mira. Stessa ragione per cui la pastiglia del Wallet è muta.
  const corpo = soloCodice(corpoDi('staffCalRenderPlayersEditor'));
  // ⚠️ La finestra si ritaglia sui CONFINI del blocco, non «900 caratteri intorno»: la prima
  //    stesura pescava anche la ✕ che sta poco sotto — che un bottone lo è davvero — e dava
  //    l'allarme su codice giusto.
  const i = corpo.indexOf('_staffCalSocioDelGiocatore(p)');
  assert.ok(i > 0);
  const fine = corpo.indexOf('row.appendChild(nm);', i);
  assert.ok(fine > i, 'il blocco del nome non finisce più con `row.appendChild(nm)`');
  const blocco = corpo.slice(i, fine);
  assert.ok(!/createElement\('button'\)/.test(blocco), 'il nome è diventato un bottone');
  assert.ok(/setAttribute\('role', 'link'\)/.test(blocco), 'il nome non si annuncia come link');
  assert.ok(/setAttribute\('tabindex', '0'\)/.test(blocco), 'il nome non si raggiunge da tastiera');
  assert.ok(/ev\.key === 'Enter'/.test(blocco), 'da tastiera il nome non si apre');
});

test('una riga segnata per la RIMOZIONE non è cliccabile', () => {
  const corpo = soloCodice(corpoDi('staffCalRenderPlayersEditor'));
  assert.ok(/const _socio = marked \? null : _staffCalSocioDelGiocatore\(p\);/.test(corpo),
    'il nome barrato di chi sta per uscire è tornato cliccabile');
});

test('il segno del nome non sposta la riga', () => {
  // Un bordo cambierebbe l'altezza e sposterebbe di un pixel tutto l'elenco: su quattro righe
  // incolonnate si vede.
  const i = APP.indexOf('.svc-pl-name-apri {');
  assert.ok(i > 0, 'manca la regola CSS del nome apribile');
  const regola = APP.slice(i, APP.indexOf('}', i));
  assert.ok(/text-decoration:underline dotted/.test(regola), regola);
  assert.ok(!/(^|[^-])border:/.test(regola), 'usa un bordo: sposterebbe l\'elenco');
});

console.log('\n' + passed + ' ok, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
