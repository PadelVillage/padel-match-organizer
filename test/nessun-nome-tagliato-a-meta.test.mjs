/* 🪟 «Nessun nome tagliato a metà, e il maestro una volta sola» — banco della voce 169
 *    (06/09/2026).
 *
 * 🗣️ SUE PAROLE, con due schermate di PROD 6.377 davanti: *«Ci sono ancora degli errori sulla
 *    visualizzazione del calendario e sui messaggi quando clicco su salva. Troppi banner di
 *    messaggi.»* — e, messo davanti a quattro candidati, ha indicato **due**: il maestro scritto
 *    due volte, e i nomi tagliati a metà riga. (Il quadratino verde stretto **è giusto**: è una
 *    mezz'ora libera, e l'ha detto lui.)
 *
 * 📏 I NUMERI DA CUI NASCE, misurati sulla pagina viva di PROD e non dedotti:
 *   · il dato vero della lezione delle 18:00 di lunedì 7 su C1:
 *       istruttore "Lucas Vidal" · giocatori [ "Andrea Bigaran", **"lucas vidal"** ]
 *     ⇒ Matchpoint mette il maestro **anche** nel roster, con un'altra scrittura del nome;
 *   · a **1490×880** non sborda niente (14 riquadri su 14 dentro il bordo) — una prova lì
 *     avrebbe detto «funziona»;
 *   · a **1490×810**, la finestra sua, `laneH` scende a 97 e **5 riquadri su 14** tagliano un
 *     nome in mezzo: «lucas vidal», «Carlo Ceriali», «Ospite», «Ospite», «Fabiola Limuti»,
 *     da 11 a 17 px oltre il bordo.
 *   📌 *La stessa pagina, due altezze di finestra, due verità.*
 *
 * 🎯 COSA DIFENDE, e sono quattro cose che rileggendo il sorgente non si vedono:
 *   ① il maestro sparisce dai giocatori anche se scritto **in un altro modo** (maiuscole,
 *      accenti, spazi doppi) — il vecchio `!==` lettera-per-lettera non lo vedeva;
 *   ② il maestro NON sparisce da una **partita**: là non c'è nessun maestro da confondere, e un
 *      omonimo verrebbe cancellato dal campo;
 *   ③ si contano solo le righe **intere**: una riga che finisce mezzo pixel oltre il tetto non
 *      conta come «ci sta»;
 *   ④ 🚨 quando non ci sta **nemmeno una** riga il «+N» non si scrive: prenderebbe lui il posto
 *      tagliato, cioè lo stesso difetto con un'altra faccia.
 *
 * ⛔ QUELLO CHE NON DICE: gira senza browser ⇒ dice che la regola è quella giusta, **non** che
 *    sullo schermo i nomi si leggono. Quello lo dice la misura sulla pagina viva, e sta nel
 *    resoconto della voce.
 *
 * Esegui:  node test/nessun-nome-tagliato-a-meta.test.mjs
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

/** Le funzioni si ESEGUONO, non si rileggono (lezione della 149): si ritagliano dal sorgente
 *  vivo e si valutano. Così il banco cade quando cambia il comportamento, non quando cambia una
 *  parola in un commento. */
function estrai(nome, sorgente) {
  const da = sorgente.indexOf('function ' + nome + '(');
  assert.ok(da >= 0, 'funzione non trovata nel sorgente: ' + nome);
  let i = sorgente.indexOf('{', da), liv = 0;
  for (let j = i; j < sorgente.length; j++) {
    if (sorgente[j] === '{') liv++;
    else if (sorgente[j] === '}') { liv--; if (liv === 0) return sorgente.slice(da, j + 1); }
  }
  throw new Error('graffe non chiuse per ' + nome);
}

const SORGENTI = ['pmoChiaveNome', 'pmoRosterSenzaIlMaestro', 'pmoRigheIntereCheCiStanno', 'pmoPianoRighe']
  .map(n => estrai(n, APP)).join('\n');
const F = new Function(SORGENTI + '\nreturn { pmoChiaveNome, pmoRosterSenzaIlMaestro, pmoRigheIntereCheCiStanno, pmoPianoRighe };')();

// ── ① Il maestro, comunque sia scritto ───────────────────────────────────────
test('il maestro esce dai giocatori anche scritto in minuscolo (il caso VERO di PROD)', () => {
  const g = [{ nome: 'Andrea Bigaran' }, { nome: 'lucas vidal' }];
  const r = F.pmoRosterSenzaIlMaestro(g, 'Lucas Vidal');
  assert.deepEqual(r.map(x => x.nome), ['Andrea Bigaran']);
});

test('…e anche con accenti diversi o spazi doppi', () => {
  assert.equal(F.pmoRosterSenzaIlMaestro([{ nome: 'NICOLÒ  ROSSI' }], 'nicolo rossi').length, 0);
  assert.equal(F.pmoRosterSenzaIlMaestro([{ nome: ' Lucas  Vidal ' }], 'Lucas Vidal').length, 0);
});

test('un OMONIMO che non è il maestro resta (chiave diversa)', () => {
  const g = [{ nome: 'Lucas Vidali' }];
  assert.equal(F.pmoRosterSenzaIlMaestro(g, 'Lucas Vidal').length, 1);
});

test('senza maestro non si tocca niente — è il caso della PARTITA', () => {
  const g = [{ nome: 'Lidia Comes' }, { nome: 'Ospite' }];
  assert.equal(F.pmoRosterSenzaIlMaestro(g, '').length, 2);
  assert.equal(F.pmoRosterSenzaIlMaestro(g, null).length, 2);
  assert.equal(F.pmoRosterSenzaIlMaestro(g, '   ').length, 2);
});

test('② la potatura si chiede SOLO per le lezioni — la riga che la chiama è dentro un `_isLez`', () => {
  assert.match(APP, /if \(_isLez && b\.istruttore\) _gList = pmoRosterSenzaIlMaestro\(_gList, b\.istruttore\);/,
    'se sparisce il freno `_isLez`, in una partita un omonimo del maestro verrebbe cancellato dal campo');
});

test('anche il vecchio ripiego su `b.nome` confronta per CHIAVE, non lettera per lettera', () => {
  assert.match(APP, /pmoChiaveNome\(b\.nome\) !== pmoChiaveNome\(b\.istruttore\)/,
    'era `b.nome !== b.istruttore`: «lucas vidal» e «Lucas Vidal» passavano come persone diverse');
});

// ── ③ Solo righe intere ──────────────────────────────────────────────────────
test('conta solo le righe che finiscono DENTRO il tetto', () => {
  assert.equal(F.pmoRigheIntereCheCiStanno([20, 36, 52, 68], 68), 4);
  assert.equal(F.pmoRigheIntereCheCiStanno([20, 36, 52, 68], 52), 3);
  assert.equal(F.pmoRigheIntereCheCiStanno([20, 36, 52, 68], 60), 3, 'una riga a metà non è una riga');
  assert.equal(F.pmoRigheIntereCheCiStanno([20, 36, 52, 68], 10), 0);
});

test('si ferma alla PRIMA che non ci sta, non salta avanti a cercarne una più corta', () => {
  assert.equal(F.pmoRigheIntereCheCiStanno([20, 90, 30], 40), 1);
});

test('mezzo pixel di tolleranza, e non uno di più', () => {
  assert.equal(F.pmoRigheIntereCheCiStanno([68.4], 68), 1);
  assert.equal(F.pmoRigheIntereCheCiStanno([69], 68), 0);
});

// ── ④ Cosa farne ─────────────────────────────────────────────────────────────
test('ci stanno tutte ⇒ non si tocca NIENTE (nessun «+0» sui riquadri che stanno bene)', () => {
  assert.deepEqual(F.pmoPianoRighe(4, 4), { mostra: 4, nascoste: 0, conContatore: false });
  assert.deepEqual(F.pmoPianoRighe(2, 4), { mostra: 2, nascoste: 0, conContatore: false });
});

test('🚨 ne stanno 3 su 4 ⇒ se ne mostrano TUTTE E TRE, e il «+1» non ruba una riga', () => {
  // 📏 La prima versione tornava { mostra: 2 } e su TEST 6.379 il riquadro delle 18:00 di C2
  //    mostrava UN nome e «+3», dove prima se ne leggevano TRE interi. Per togliere mezzo nome
  //    ne toglieva due interi: il contatore si prendeva una riga sua.
  assert.deepEqual(F.pmoPianoRighe(4, 3), { mostra: 3, nascoste: 1, conContatore: true });
});

test('non ci sta nemmeno una riga ⇒ nessun nome, e il conto lo dice lo stesso', () => {
  assert.deepEqual(F.pmoPianoRighe(4, 0), { mostra: 0, nascoste: 4, conContatore: true });
});

test('⭐ il contatore NON è una riga in più: si attacca alla riga dell\'orario, che c\'è già', () => {
  assert.match(APP, /if \(piano\.conContatore && info\.rigaOrario\)/,
    'su una riga sua il «+N» si mangia l\'ultima riga leggibile — è il difetto che questa cura toglie');
  assert.match(APP, /info\.rigaOrario\.appendChild\(piu\);/);
});

test('il conto torna sempre: mostrate + nascoste = totale, e mai più righe del tetto', () => {
  for (let tot = 0; tot <= 6; tot++) for (let cap = 0; cap <= 6; cap++) {
    const p = F.pmoPianoRighe(tot, cap);
    assert.equal(p.mostra + p.nascoste, tot, `tot=${tot} cap=${cap}`);
    assert.ok(p.mostra <= cap, `tot=${tot} cap=${cap}: mostra ${p.mostra} righe con un tetto di ${cap}`);
    assert.equal(p.conContatore, p.nascoste > 0, `tot=${tot} cap=${cap}: contatore e nascoste in disaccordo`);
  }
});

// ── Le due cose strutturali che il DOM non racconta ──────────────────────────
test('🩹 il tetto e i fondi si misurano nella STESSA origine (schermo), non offsetTop contro clientHeight', () => {
  const da = APP.indexOf('const _piani = [];');
  // 🩹 Si guarda il CODICE, non i commenti: il commento che spiega l'errore contiene la parola
  //    «offsetTop», e una sonda che non li toglie trova sempre ciò che cerca.
  const passo = APP.slice(da, APP.indexOf('for (const p of _piani)', da))
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/offsetTop/.test(passo),
    'offsetTop parte dal bordo e clientHeight il bordo non lo conta: mescolarli sbagliava di una riga intera');
  assert.match(passo, /getBoundingClientRect\(\)\.bottom/);
  assert.match(passo, /borderBottomWidth/, 'il bordo di una PARTITA APERTA è 2px tratteggiati, non 1 pieno');
});

test('prima TUTTE le letture, poi TUTTE le scritture (o il browser ricalcola a ogni riquadro)', () => {
  const da = APP.indexOf('const _piani = [];');
  assert.ok(da > 0, 'il passo delle misure non c\'è più');
  const fine = APP.indexOf('for (const p of _piani)', da);
  assert.ok(fine > da, 'il passo delle modifiche non c\'è più');
  const letture = APP.slice(da, fine);
  assert.ok(!/\.remove\(\)|appendChild|\.title =/.test(letture),
    'una modifica dentro il giro delle misure: il calcolo della pagina si rifà a ogni riquadro');
});

test('l\'elenco intero resta raggiungibile: chi nasconde dei nomi li mette nel `title`', () => {
  assert.match(APP, /info\.blk\.title = \(_gia \? _gia \+ '\\n' : ''\) \+ info\.nomi\.join\('\\n'\);/,
    'nascondere un nome senza lasciarlo da nessuna parte è una perdita, non una pulizia');
});

// ── ⑤ Il messaggio ripetuto ──────────────────────────────────────────────────
const SORG_BARRA = estrai('svcMessaggioVaSoloNellaBarra', APP);
const G = new Function(
  'const SVC_ESITI_NELLA_SCHEDA = ' + (APP.match(/const SVC_ESITI_NELLA_SCHEDA = \[[\s\S]*?\];/) || [''])[0].replace('const SVC_ESITI_NELLA_SCHEDA = ', '') + '\n' +
  'const SVC_AVANZAMENTI_NELLA_BARRA = ' + (APP.match(/const SVC_AVANZAMENTI_NELLA_BARRA = \[[\s\S]*?\];/) || [''])[0].replace('const SVC_AVANZAMENTI_NELLA_BARRA = ', '') + '\n' +
  SORG_BARRA + '\nreturn svcMessaggioVaSoloNellaBarra;')();

test('«Riprendo una verifica rimasta in sospeso» va SOLO nella barra', () => {
  assert.equal(G('⌛ <strong>Riprendo una verifica rimasta in sospeso</strong>: Campo 1 · 2026-09-15 · 09:00 (2° tentativo)…'), true);
});

test('⛔ ma i DUE ESITI della stessa strada restano in chat, dove si rileggono dopo', () => {
  assert.equal(G('✅ <strong>Verifica chiusa</strong>: Campo 1 · 2026-09-15 · 09:00 <strong>È stata creata</strong> su Matchpoint. Compare sul calendario entro un paio di minuti.'), false);
  assert.equal(G('❌ <strong>Verifica chiusa</strong>: Campo 1 · 2026-09-15 · 09:00 <strong>NON è stata creata</strong>. Lo slot è libero: puoi rifarla.'), false);
});

test('⛔ e resta in chat anche «non riesco ancora a raggiungere Matchpoint»: comincia come un avanzamento, è un ESITO', () => {
  assert.equal(G('⏳ Campo 1 · 2026-09-15 · 09:00: non riesco ancora a raggiungere Matchpoint. <strong>La verifica resta aperta</strong> e la riprendo da solo.'), false);
});

console.log('\n' + passed + ' passati, ' + failed + ' falliti');
process.exit(failed ? 1 : 0);
