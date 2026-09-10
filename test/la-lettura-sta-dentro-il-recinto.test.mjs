/* 🔒 «Anche la lettura sta dentro il recinto» — banco della VOCE 180, quarto pezzo (09/09/2026).
 *
 * 🚨 IL DIFETTO CHE CHIUDE, ed era l'ultimo punto di contatto fra il sistema nuovo e quello
 *   vecchio: `matchpoint-bookings-edit` con `read: true` **saltava il recinto**
 *   (`if (!readOnly && !scritturaAlCircoloConsentita(...))`) ⇒ dal gestionale che sta diventando
 *   quello vero partiva davvero una visita al Matchpoint del circolo.
 *   📌 *Un recinto che lascia passare chi «guarda soltanto» non è un recinto a metà: è un recinto
 *      con una porta, e la porta la trova chiunque non stia cercando di forzare niente.*
 *
 * 🎯 LE QUATTRO COSE CHE QUESTO BANCO DIFENDE:
 *   ① il cancello dell'app guarda il **REF SUPABASE**, non l'hostname — e questo è il punto:
 *      `PMO_IS_TEST_ENV` risponde a un'altra domanda e il distacco la farà **scadere**, perché il
 *      gestionale nuovo sarà servito da un indirizzo che non comincia per `test.`;
 *   ② 🚨 fallisce CHIUSO: url mancante, storpiato, o un host che *somiglia* a quello di PROD ⇒
 *      «non lo chiamo». Un dubbio sull'identità del database non autorizza a bussare al circolo;
 *   ③ 🚨 l'app e l'edge rispondono **d'accordo** sugli host veri — sono due guardie sullo stesso
 *      fatto, e se divergessero una delle due starebbe proteggendo un'altra cosa;
 *   ④ 🚨 i QUATTRO punti che leggevano dal vivo sono tutti passati dal cancello, e l'edge rifiuta
 *      **a viso aperto** invece di rispondere `ok` con un roster vuoto.
 *
 * ⛔ QUELLO CHE NON DICE: le prove sull'edge sono **testuali** (leggono `index.ts` come testo, non
 *    lo eseguono: è una funzione Deno con dipendenze di rete). Dicono che il ramo c'è e sta nel
 *    posto giusto, non che risponde 503 al primo che bussa. Quello lo dice una chiamata vera.
 *
 * Esegui:  node --experimental-strip-types test/la-lettura-sta-dentro-il-recinto.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scritturaAlCircoloConsentita, REF_PROD } from '../supabase/functions/matchpoint-bookings-edit/scrittura-al-circolo.ts';

const QUI = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(QUI, '..', 'index.html'), 'utf8');
const EDGE = readFileSync(join(QUI, '..', 'supabase/functions/matchpoint-bookings-edit/index.ts'), 'utf8');
assert.ok(APP.length > 500000, 'sorgente non letto: questo banco non direbbe niente');

let passed = 0, failed = 0;
function test(nome, fn) {
  try { fn(); passed++; console.log('ok   - ' + nome); }
  catch (e) { failed++; console.log('FAIL - ' + nome + '\n       ' + e.message); }
}
// 🚨⭐⭐ SENZA I COMMENTI — aggiunto il 10/09/2026, e non è un abbellimento: è la lezione che
// nella sessione del 09/09 è costata TRE banchi rossi, sempre nello stesso modo. Una cura porta
// accanto a sé un commento che CITA la frase vecchia per dire che l'ha tolta, e un controllo
// testuale la legge come se fosse ancora viva. ⇒ Qui è ricapitato al primo colpo: il commento
// della voce 187 nomina `matchpoint-bookings-create/index.ts` per spiegare DOVE si è misurato, e
// il caso ④ l'ha letto come una chiamata al circolo rimasta lì.
// 📌 *Un banco che legge i commenti non misura il programma: misura come è stato raccontato.*
// ⚖️ Curata la CLASSE e non l'istanza: passa di qui ogni funzione che questo banco ritaglia — e
//    `esegui()` ne guadagna, perché una funzione costruita senza commenti è la stessa funzione.
function senzaCommenti(testo) {
  let fuori = '', i = 0, stringa = null, prec = '';
  while (i < testo.length) {
    const c = testo[i], succ = testo[i + 1];
    if (stringa) {
      fuori += c;
      if (c === stringa && prec !== '\\') stringa = null;
      prec = (prec === '\\' && c === '\\') ? '' : c;
      i++; continue;
    }
    if (c === '/' && succ === '/') { const f = testo.indexOf('\n', i); i = f < 0 ? testo.length : f; continue; }
    if (c === '/' && succ === '*') { const f = testo.indexOf('*/', i + 2); i = f < 0 ? testo.length : f + 2; continue; }
    if (c === '"' || c === "'" || c === '`') stringa = c;
    fuori += c; prec = c; i++;
  }
  return fuori;
}
function corpoDi(nome, src) {
  const s = src || APP;
  const i = s.indexOf('function ' + nome + '(');
  assert.ok(i > 0, 'funzione non trovata: ' + nome);
  const apre = s.indexOf(') {', i);
  let g = 0, visto = false, out = '';
  for (let k = apre + 2; k < s.length; k++) {
    const c = s[k]; out += c;
    if (c === '{') { g++; visto = true; }
    else if (c === '}') { g--; if (visto && g === 0) break; }
  }
  return senzaCommenti(out);
}
function parametriDi(nome) {
  const i = APP.indexOf('function ' + nome + '(');
  return APP.slice(i + ('function ' + nome + '(').length, APP.indexOf(') {', i));
}
function esegui(nome, dip) {
  const nomi = Object.keys(dip || {}), vals = nomi.map((k) => dip[k]);
  return new Function(...nomi,
    'return function ' + nome + '(' + parametriDi(nome) + ') ' + corpoDi(nome) + ';')(...vals);
}

const collegato = esegui('pmoGestionaleCollegatoAlCircolo', { PMO_PROD_SUPABASE_PROJECT_REF: REF_PROD });

// ─────────────────────────────────────────────────────────────────────────────
// ① IL CANCELLO GUARDA IL REF, NON L'HOSTNAME
// ─────────────────────────────────────────────────────────────────────────────
test('① il gestionale del CIRCOLO è collegato', () => {
  assert.equal(collegato('https://' + REF_PROD + '.supabase.co'), true);
});

test('① il gestionale NUOVO non lo è', () => {
  assert.equal(collegato('https://cudiqnrrlbyqryrtaprd.supabase.co'), false);
});

test('① 🚨 e NON guarda l\'hostname dell\'app: il cancello non sa dove è servita la pagina', () => {
  const corpo = corpoDi('pmoGestionaleCollegatoAlCircolo');
  assert.doesNotMatch(corpo, /PMO_IS_TEST_ENV|location|hostname\s*\)/,
    'appoggiarsi a «sto su test.» è la cosa che il distacco farà scadere: il gestionale nuovo '
    + 'sarà servito da un indirizzo che non comincia per test.');
  assert.match(corpo, /PMO_PROD_SUPABASE_PROJECT_REF/, 'il fatto vero è a quale database si è attaccati');
});

// ─────────────────────────────────────────────────────────────────────────────
// ② FALLISCE CHIUSO
// ─────────────────────────────────────────────────────────────────────────────
test('② 🚨 url mancante o storpiato ⇒ non lo chiamo', () => {
  [null, undefined, '', '   ', 'boh', '/functions/v1', 'http://', 42, {}].forEach((v) => {
    assert.equal(collegato(v), false, 'url ' + JSON.stringify(v) + ': nel dubbio non si bussa al circolo');
  });
});

test('② 🚨 un host che SOMIGLIA a quello del circolo non passa', () => {
  [
    'https://' + REF_PROD + '.supabase.co.evil.com',
    'https://x' + REF_PROD + '.supabase.co',
    'https://' + REF_PROD + '-2.supabase.co',
    'https://cudiqnrrlbyqryrtaprd.supabase.co/?x=' + REF_PROD,
  ].forEach((u) => assert.equal(collegato(u), false, 'passa: ' + u));
});

test('② il ref si confronta senza badare alle maiuscole', () => {
  assert.equal(collegato('https://' + REF_PROD.toUpperCase() + '.supabase.co'), true);
});

// ─────────────────────────────────────────────────────────────────────────────
// ③ 🚨 LE DUE GUARDIE SONO D'ACCORDO
// ─────────────────────────────────────────────────────────────────────────────
test('③ 🚨 app ed edge rispondono UGUALE sugli host che esistono davvero', () => {
  ['https://' + REF_PROD + '.supabase.co',
   'https://cudiqnrrlbyqryrtaprd.supabase.co',
   '', 'boh', 'http://localhost:54321',
  ].forEach((u) => {
    assert.equal(collegato(u), scritturaAlCircoloConsentita(u),
      'divergono su ' + JSON.stringify(u) + ' — due guardie sullo stesso fatto che non concordano '
      + 'stanno proteggendo due cose diverse');
  });
});

test('③ ⚖️ e dove NON coincidono, quella dell\'app è la più STRETTA (mai il contrario)', () => {
  // L'edge accetta anche `<ref>.qualcosa.supabase.co` (startsWith + endsWith); l'app pretende
  // l'host esatto. Va bene che l'app sia più prudente: non va bene il contrario.
  ['https://' + REF_PROD + '.pooler.supabase.co'].forEach((u) => {
    if (collegato(u) !== scritturaAlCircoloConsentita(u)) {
      assert.equal(collegato(u), false, 'l\'app non deve MAI dire sì dove l\'edge dice no');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ④ LE CUCITURE — i quattro punti, e l'edge
// ─────────────────────────────────────────────────────────────────────────────
test('④ 🚨 NESSUNA chiamata con `read: true` è rimasta fuori dal cancello', () => {
  const righe = APP.split('\n');
  const siti = [];
  righe.forEach((r, i) => { if (/read:\s*true/.test(r) && /JSON\.stringify/.test(r)) siti.push(i + 1); });
  assert.equal(siti.length, 4, 'i punti che leggono dal vivo sono quattro: ne trovo ' + siti.length
    + ' (' + siti.join(' · ') + '). Se ne è nato uno nuovo, va passato dal cancello.');
  // ognuno deve avere il cancello entro le 60 righe che lo precedono
  siti.forEach((n) => {
    const prima = righe.slice(Math.max(0, n - 61), n).join('\n');
    assert.match(prima, /pmoGestionaleCollegatoAlCircolo/,
      'la chiamata di riga ' + n + ' non passa dal cancello');
  });
});

// 🔄⭐ AGGIORNATO IL 10/09/2026 DALLA VOCE 187, e la riga vecchia è stata CORRETTA non affiancata.
// Diceva «NON si converte, ma fallisce chiusa» e pretendeva un `verdict: 'boh'` in quel ramo:
// era vera, ed è diventata falsa il giorno in cui la domanda ha trovato un destinatario — il
// **gestionale**. ⇒ Questo banco era rosso per una cura, non per un difetto: si aggiorna.
// ⛔ MA NON SI INDEBOLISCE: quello che difendeva — *mai un «no» inventato*, e il cancello prima
//    della chiamata al circolo — resta preteso qui, parola per parola. Cambia solo che il ramo
//    adesso DELEGA invece di arrendersi. Il «no» che quella delega può dire è provato riga per
//    riga in `test/chi-risponde-se-e-passata.test.mjs`, sabotaggi compresi.
test('④ e anche `staffCalAskMatchpoint` — che ora CHIEDE AL GESTIONALE invece di arrendersi', () => {
  const corpo = corpoDi('staffCalAskMatchpoint');
  assert.match(corpo, /pmoGestionaleCollegatoAlCircolo\(supabaseUrl\)/);
  const iGate = corpo.indexOf('pmoGestionaleCollegatoAlCircolo');
  const iFetch = corpo.indexOf('matchpoint-bookings-edit');
  assert.ok(iGate < iFetch, 'il cancello deve stare PRIMA della chiamata, o non ferma niente');
  // ⚠️ Il perimetro è il BLOCCO del ramo, non «da qui a lì»: la prima stesura tagliava da `iGate`
  //    a `iFetch` e si portava dentro mezza riga della chiamata al circolo — `…/functions/v1/` —
  //    facendo cadere il controllo su una cura che c'era. 📌 *Una sonda che guarda più larga del
  //    suo bersaglio non è più severa: è sbagliata, e lo sembra dalla parte giusta.*
  const ramo = corpo.slice(iGate, corpo.indexOf('\n    }', iGate));
  assert.match(ramo, /staffCalChiediAlGestionale\(/,
    'senza destinatario la domanda resta senza risposta: il ramo deve chiedere al gestionale');
  assert.doesNotMatch(ramo, /verdict: 'no'/,
    '🚨 mai un «no» INVENTATO qui dentro: chi lo legge riprova, e la partita si prenota due volte');
  assert.doesNotMatch(ramo, /functions\/v1|matchpoint-bookings/,
    'e il ramo del gestionale non collegato non bussa al circolo per nessuna strada');
});

test('④ 🚨 e il velo si spegne a mano quando la lettura viva non parte più', () => {
  // 🩹 Dentro `staffCalEditPlayers` i cancelli sono DUE — la manutenzione (che non ha roster, e
  //    quindi non ha velo) e la lettura dei giocatori — e la prima volta questo controllo guardava
  //    il primo, cioè quello sbagliato, e cadeva su una cura che c'era.
  //    📌 *Una sonda che trova «il» posto quando i posti sono due non sta misurando: sta pescando.*
  const corpo = corpoDi('staffCalEditPlayers');
  const cancelli = [];
  let i = corpo.indexOf('pmoGestionaleCollegatoAlCircolo');
  while (i >= 0) { cancelli.push(i); i = corpo.indexOf('pmoGestionaleCollegatoAlCircolo', i + 1); }
  assert.equal(cancelli.length, 2, 'i punti che leggevano dal vivo in questa funzione sono due');
  const spegne = cancelli.filter((n) => /rosterLoading = false/.test(corpo.slice(n, n + 1200)));
  assert.equal(spegne.length, 1,
    'esattamente UNO dei due deve spegnere il velo: quello del roster. '
    + 'Chi toglie l\'unico che spegne una luce deve spegnerla lui, o la rotellina gira per sempre '
    + '— e proprio sulle prenotazioni che non sappiamo raccontare.');
});

test('④ 🚨 L\'EDGE rifiuta la LETTURA fuori dalla produzione — ed è la guardia che vale per tutti', () => {
  assert.match(EDGE, /if \(readOnly && !scritturaAlCircoloConsentita\(supabaseUrl\)\)/,
    'senza questo ramo, una copia vecchia dell\'app rimasta aperta bussa ancora al circolo');
  assert.match(EDGE, /LETTURA_AL_CIRCOLO_NON_PREVISTA/, 'il rifiuto ha un codice suo, riconoscibile nei registri');
});

test('④ 🚨 e sta PRIMA del controllo dei secret, o non lo si raggiungerebbe mai', () => {
  const iLettura = EDGE.indexOf('if (readOnly && !scritturaAlCircoloConsentita(supabaseUrl))');
  const iScrittura = EDGE.indexOf('if (!readOnly && !scritturaAlCircoloConsentita(supabaseUrl))');
  const iSecret = EDGE.indexOf("return err(500, 'WORKER_NOT_CONFIGURED'");
  assert.ok(iLettura > 0 && iScrittura > 0 && iSecret > 0);
  assert.ok(iLettura < iScrittura, 'il ramo lettura va prima di quello scrittura, o `!readOnly` lo scavalca');
  assert.ok(iScrittura < iSecret,
    'è la lezione della voce 178: togliendo i secret MATCHPOINT_* si prenderebbe un 500 e non si '
    + 'arriverebbe mai al recinto');
});

test('④ ⛔ il rifiuto NON è un «ok con roster vuoto»', () => {
  const i = EDGE.indexOf("if (readOnly && !scritturaAlCircoloConsentita(supabaseUrl))");
  const ramo = EDGE.slice(i, i + 500);
  assert.match(ramo, /return err\(503,/, 'un elenco vuoto direbbe «in campo non c\'è nessuno», che è una risposta che non abbiamo');
  assert.doesNotMatch(ramo, /return ok\(/);
});

console.log('\n' + passed + ' passati, ' + failed + ' falliti');
process.exit(failed ? 1 : 0);
