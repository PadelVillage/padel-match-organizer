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

// Le regole vere dell'app, ESEGUITE — non cercate con una regex.
// 🩹 A `pmoChiaveCodiceCliente` va passato `cleanCell`, e la prima stesura non gliel'ha dato:
//    dentro `_staffCalSocioDelGiocatore` il `ReferenceError` finiva nel `try/catch`, che tornava
//    `null` — il banco diceva «il socio non si trova» mentre a non funzionare era LA SONDA.
//    📌 *Un catch che ingoia tutto protegge l'app e acceca chi la prova: quando una prova
//       fallisce contro una funzione difesa così, il primo sospettato è la prova.*
const CLEAN = function (v) { return String(v == null ? '' : v).trim(); };
const codiceInterno = new Function(dichiarazioneDi('_staffCalPlayerCode') + '\nreturn _staffCalPlayerCode;')();
// 🎭 La regola del jolly si INIETTA VERA, non si imita: `_staffCalSocioDelGiocatore` chiama
//    `isGuestJollyMember`, che a sua volta poggia su `playerFullName`, `isGuestJollyName`,
//    `normalizeKey` e `normalizeText`. Rifarne una copia qui vorrebbe dire provare la copia:
//    il giorno in cui l'app cambia la definizione di «Ospite», questo banco resterebbe verde
//    difendendo una regola che non esiste più.
// 🩹 E `cleanCell` sta in cima alla catena, non per completezza: senza, `normalizeText` esplode,
//    il `try/catch` di `_staffCalSocioDelGiocatore` ingoia l'eccezione e torna `null` ⇒ OGNI nome
//    diventa muto e il banco dice «socio non trovato», che somiglia a un difetto della cura.
//    📏 Successo qui il 05/09: tre prove rosse in un colpo, e la cura era sana.
const REGOLE_JOLLY = ['cleanCell', 'normalizeText', 'normalizeKey', 'playerFullName', 'isGuestJollyName', 'isGuestJollyMember']
  .map(dichiarazioneDi).join('\n');
const trovaSocio = new Function(
  'giocatori', '_staffCalPlayerCode',
  REGOLE_JOLLY + '\n' + dichiarazioneDi('_staffCalSocioDelGiocatore') + '\nreturn _staffCalSocioDelGiocatore;'
);

// 🚨 I SOCI DI PROVA SONO COSTRUITI SUL DIFETTO VERO: ognuno ha DUE numeri diversi, e per m2 il
//    codice cliente vale quanto l'ID INTERNO di m1. Chi confrontasse la colonna sbagliata
//    aprirebbe m2 al posto di m1 — che è esattamente quello che è successo su TEST 6.301.
const SOCI = [
  { id: 'm1', nome: 'Alberto Chiapinotto', memberId: '000140', matchpointIdInterno: '9911' },
  { id: 'm2', nome: 'Erika Poser',         memberId: '9911',   matchpointIdInterno: '4477' },
  { id: 'm3', nome: 'Senza id interno',    memberId: '000255', matchpointIdInterno: '' },
  // 🎭 IL JOLLY, COPIATO DAI DATI VERI e non immaginato. 📏 Su PROD il 05/09/2026 ci sono DUE
  //    record «Ospite» vivi, tutt'e due `guestJolly: true`, codice cliente `000001` e id interno
  //    `1` — e il roster di una partita porta l'Ospite con `idCliente: '1'`, non vuoto.
  //    ⇒ Prima di questa riga il banco provava un Ospite SENZA id, cioè il caso che non capita.
  { id: 'm4', firstName: 'Ospite', name: 'Ospite', memberId: '000001', matchpointIdInterno: '1', guestJolly: true },
];
const cerca = (p) => trovaSocio(SOCI, codiceInterno)(p);

// ── ① IL SOCIO SI TROVA, E SI TROVA SULL'ID INTERNO ─────────────────────────────────────────
test('un giocatore del roster trova il suo socio', () => {
  // `idCliente` del roster è l'ID INTERNO (`HiddenFieldIdCliente`), non il codice cliente.
  const s = cerca({ nome: 'Alberto Chiapinotto', idCliente: '9911' });
  assert.ok(s, 'socio non trovato');
  assert.equal(s.id, 'm1');
});

// ── ①bis IL DIFETTO CHE HA TROVATO LUI, e che questo banco esiste per non far tornare ───────
test('🚨 NON apre la scheda di un\'altra persona (i due numeri di Matchpoint)', () => {
  // 🗣️ Su TEST 6.301, al primo click: «guarda cliccando il nome sulla scheda cosa si apre… un
  //    nome differente». Cliccando «Filippo Battistella» si apriva «Giovanni Modanese».
  // ⚖️ Matchpoint dà a ogni cliente DUE numeri: il CODICE CLIENTE («000140-Nome», in `memberId`)
  //    e l'ID INTERNO (`id_people`, in `matchpointIdInterno`). La prima stesura confrontava
  //    l'id interno del roster col CODICE CLIENTE dell'anagrafica ⇒ due numeri diversi che per
  //    caso si somigliano, e il socio che esce è un altro.
  // 🚨 Nei soci di prova il `memberId` di m2 vale quanto il `matchpointIdInterno` di m1: chi
  //    guarda la colonna sbagliata prende m2. Deve prendere m1.
  const s = cerca({ nome: 'Alberto Chiapinotto', idCliente: '9911' });
  assert.equal(s.id, 'm1', 'ha agganciato il socio SBAGLIATO: sta confrontando il codice cliente');
  assert.notEqual(s.nome, 'Erika Poser');
});

test('l\'id interno NON si riempie di zeri', () => {
  // Il `padStart(6)` serve al CODICE cliente («140» = «000140»). L'id interno è un numero e
  // basta: normalizzarlo qui farebbe combaciare cose che Matchpoint tiene distinte — cioè
  // ricreerebbe, in piccolo, lo stesso difetto appena tolto.
  assert.equal(cerca({ idCliente: '009911' }), null);
});

test('un socio SENZA id interno non viene agganciato da una chiave vuota', () => {
  // Se la chiave vuota di un Ospite facesse coppia con la chiave vuota di un socio, OGNI ospite
  // aprirebbe la scheda di quel socio. È il difetto peggiore possibile qui, ed è silenzioso.
  assert.equal(codiceInterno(SOCI[2]), '', 'il socio di prova non è più senza id interno');
  assert.equal(cerca({ nome: 'Ospite', idCliente: '' }), null);
});

// ── ② GLI «OSPITE» RESTANO MUTI — la regola che vale più di tutte ────────────────────────────
test('un «Ospite» non trova nessuno', () => {
  // 📌 Un nome cliccabile che non apre niente è peggio di un nome normale: promette e non mantiene.
  assert.equal(cerca({ nome: 'Ospite', idCliente: '' }), null);
  assert.equal(cerca({ nome: 'Ospite' }), null);
  assert.equal(cerca({ nome: 'Ospite', idCliente: null }), null);
});

test('🚨 un «Ospite» con l\'id VERO (1) resta muto — il caso misurato su PROD', () => {
  // 📏 05/09/2026, console remota su PROD 6.363, partita del 07/09 19:30 Campo 2: il nome
  //    «Ospite» usciva CLICCABILE, `role="link"`, tooltip «Apri la scheda di Ospite» — e apriva
  //    il jolly del circolo. La scheda della voce dichiarava il contrario, e questo banco pure.
  // ⚖️ Il difetto non era nella regola: era nel CASO DI PROVA. L'Ospite un id ce l'ha.
  assert.equal(codiceInterno(SOCI[3]), '1', 'il jolly di prova non ha più l\'id interno vero');
  assert.equal(cerca({ nome: 'Ospite', idCliente: '1' }), null, 'l\'Ospite apre ancora una scheda');
  assert.equal(cerca({ nome: 'Ospite', idCliente: '01' }), null, 'zeri davanti: stesso jolly');
});

test('🎭 la PRIMA serratura: l\'id 1 è il jolly anche se l\'anagrafica se lo dimentica', () => {
  // Su Matchpoint l'Ospite è il cliente `000001`, id interno `1`, e l'app lo dà già per assodato
  // altrove (`_normRoster` riconosce l'Ospite senza nome proprio da quell'id). Se un giorno il
  // record in anagrafica perdesse il flag `guestJolly` e il nome «Ospite» — un errore di
  // importazione basta — la seconda serratura non scatterebbe più e il jolly tornerebbe
  // cliccabile IN SILENZIO. Questa prova è l'unica che tiene in piedi quella riga.
  const anagraficaSmemorata = [{ id: 'x9', nome: 'Cliente 1', matchpointIdInterno: '1' }];
  assert.equal(trovaSocio(anagraficaSmemorata, codiceInterno)({ nome: 'Ospite', idCliente: '1' }), null);
});

test('🎭 la seconda serratura: un jolly agganciato da un id inatteso resta muto', () => {
  // La prima serratura guarda l'id della riga (1). Questa guarda il socio TROVATO: se un domani
  // il jolly avesse un altro id interno, il nome tornerebbe cliccabile senza che nessuno se ne
  // accorga — ed è la stessa forma di difetto silenzioso della voce.
  const jollyStrano = [{ id: 'x1', name: 'Ospite', guestJolly: true, matchpointIdInterno: '7788' }];
  assert.equal(trovaSocio(jollyStrano, codiceInterno)({ nome: 'Ospite', idCliente: '7788' }), null);
});

test('🎭 il flag `ospite` del roster basta da solo', () => {
  // `_normRoster` lo mette quando il worker manda l'Ospite col nome VUOTO: là il nome non dice
  // niente, e l'unica cosa che resta a dirlo è il flag.
  assert.equal(cerca({ nome: '', ospite: true, idCliente: '9911' }), null);
});

test('⚖️ e le due serrature non chiudono la porta a un socio vero', () => {
  // Una guardia che sbaglia per eccesso qui si pagherebbe con nomi muti a caso, cioè con la
  // voce 138 disfatta in silenzio. Il socio con id interno 9911 deve continuare ad aprirsi.
  const s = cerca({ nome: 'Alberto Chiapinotto', idCliente: '9911' });
  assert.ok(s && s.id === 'm1', 'la guardia del jolly ha mangiato un socio vero');
});

test('un id che non è un numero non aggancia niente', () => {
  assert.equal(cerca({ idCliente: 'PMO-abc' }), null);
  assert.equal(cerca({ idCliente: 'ospite' }), null);
});

test('un id che nessun socio ha resta muto, non aggancia il primo che passa', () => {
  assert.equal(cerca({ idCliente: '999999' }), null);
});

test('⛔ nessun ripiego sul NOME quando l\'id non aggancia', () => {
  // Cercare «per nome che somiglia» rimetterebbe in piedi la classe di difetto appena tolta:
  // indovinare la persona. Davanti a un id che non aggancia la risposta è nome muto.
  assert.equal(cerca({ nome: 'Erika Poser', idCliente: '' }), null);
  assert.equal(cerca({ nome: 'Alberto Chiapinotto', idCliente: '999999' }), null);
  const corpo = soloCodice(corpoDi('_staffCalSocioDelGiocatore'));
  assert.ok(!/\.nome/.test(corpo), 'la ricerca del socio guarda il nome: è un ripiego che indovina');
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
