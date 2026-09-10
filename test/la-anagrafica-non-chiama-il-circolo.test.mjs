/* 🏷️ «L'anagrafica non chiama il circolo» — banco della VOCE 193 (10/09/2026).
 *
 * 🗣️ Nasce dall'inventario chiesto dal passaggio di consegne: *«la differenza fra i due elenchi è
 *   l'elenco dei bottoni che sul gestionale nuovo non funzionano»*. Guardando le quattro edge
 *   dell'anagrafica una per una, il difetto è risultato **più stretto e diverso** da come era
 *   stato scritto: `create` e `update` la loro guardia ce l'hanno da sempre e non chiamano
 *   niente; **`disable` e `reactivate` no** ⇒ chiamavano la edge davvero, prendevano
 *   `503 AMBIENTE_DI_PROVA`, e l'operatore leggeva un **fallimento su un gesto riuscito**.
 *
 * 🎯 LE QUATTRO COSE CHE QUESTO BANCO DIFENDE:
 *   ① 🚨⭐⭐ **la guardia non è `PMO_IS_TEST_ENV`.** Quella risponde a *«l'indirizzo comincia per
 *      test.»* e la voce 184 la spegnerà: il giorno del passaggio queste due funzioni
 *      ricomincerebbero a chiamare il worker **da sole e in silenzio**, verso un Matchpoint che
 *      non c'è più. Si guarda il **ref Supabase**, cioè con chi si parla;
 *   ② ⛔ **la forma è POSITIVA, mai `!pmoGestionaleCollegatoAlCircolo(...)`.** Quel cancello
 *      fallisce chiuso per la *sua* domanda e torna `false` anche su un indirizzo storpiato:
 *      negarlo lo trasformerebbe in *«sono il sistema nuovo»* preso al buio. Nel dubbio si
 *      prosegue sulla strada vecchia, che su PROD è quella giusta;
 *   ③ 🔁 **`pmoSistemaNuovoPer` e `pmoCassaNativaPer` rispondono UGUALE su ogni indirizzo**: sono
 *      due nomi per un fatto solo, e due copie di un fatto divergono al primo ripensamento se
 *      nessuno le confronta;
 *   ④ 🩹 **i quattro punti di chiamata gestiscono `non_collegato`**, e non lo lasciano cadere
 *      nell'`else` che è l'allarme — che è esattamente il difetto curato.
 *
 * ⛔ QUELLO CHE NON DICE: che sulla pagina viva il messaggio falso sia sparito. Questo è un banco,
 *    non un gesto. La prova fisica è una disattivazione vera guardata su TEST.
 *
 * Esegui:  node --experimental-strip-types test/la-anagrafica-non-chiama-il-circolo.test.mjs
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

/** Il corpo di una funzione, letto dal sorgente vero e non da una copia nel banco. */
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
/** 🩹 Il corpo SENZA commenti — perché un banco deve giudicare il codice, non la prosa.
 * 📏 Trovato da questo stesso banco al primo giro: la guardia nuova cita `PMO_IS_TEST_ENV` in un
 * commento **per dire che non la usa**, e il controllo ①-bis leggeva quella citazione come se
 * fosse codice ⇒ rosso su una funzione corretta.
 * 📌 *Una guardia che legge i commenti non misura il programma: misura come è stato raccontato* —
 *    e sarebbe caduta ogni volta che qualcuno spiega, accanto al codice, la trappola che ha
 *    evitato. Toglie solo i commenti a inizio riga e i blocchi, così gli `https://` dentro le
 *    stringhe restano dove sono. */
function senzaCommenti(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .filter((r) => !/^\s*\/\//.test(r))
    .join('\n');
}
function parametriDi(nome) {
  const i = APP.indexOf('function ' + nome + '(');
  return APP.slice(i + ('function ' + nome + '(').length, APP.indexOf(') {', i));
}
function esegui(nome, ...dipendenze) {
  return new Function(...dipendenze.map((d) => d[0]),
    'return function ' + nome + '(' + parametriDi(nome) + ') ' + corpoDi(nome) + ';')(...dipendenze.map((d) => d[1]));
}

const REF_PROD = 'qqbfphyslczzkxoncgex';
const REF_NUOVO = 'cudiqnrrlbyqryrtaprd';
const refDellUrl = esegui('pmoRefSupabaseDellUrl');
const sistemaNuovoPer = esegui('pmoSistemaNuovoPer',
  ['pmoRefSupabaseDellUrl', refDellUrl], ['PMO_PROD_SUPABASE_PROJECT_REF', REF_PROD]);
const cassaNativaPer = esegui('pmoCassaNativaPer',
  ['pmoRefSupabaseDellUrl', refDellUrl], ['PMO_PROD_SUPABASE_PROJECT_REF', REF_PROD]);

/* ── Gli indirizzi su cui si misura, compresi quelli storti ──────────────────────────────── */
const INDIRIZZI = [
  ['il sistema nuovo',            `https://${REF_NUOVO}.supabase.co`,                 true],
  ['PROD',                        `https://${REF_PROD}.supabase.co`,                  false],
  ['vuoto',                       '',                                                 false],
  ['nullo',                       null,                                               false],
  ['non è un indirizzo',          'cudiqnrrlbyqryrtaprd',                             false],
  ['storpiato',                   'https://',                                         false],
  ['sosia di PROD',               `https://${REF_PROD}.supabase.co.altrove.it`,       false],
  ['sosia del sistema nuovo',     `https://${REF_NUOVO}.supabase.co.altrove.it`,      false],
  ['sottodominio di PROD',        `https://${REF_PROD}.funzioni.supabase.co`,         false],
];

/* ── ① la guardia risponde al FATTO, e nel dubbio dice «no» ──────────────────────────────── */
for (const [nome, url, atteso] of INDIRIZZI) {
  test(`① «sono il sistema nuovo?» — ${nome} ⇒ ${atteso}`, () => {
    assert.equal(sistemaNuovoPer(url), atteso);
  });
}

/* ── ③ due nomi, un fatto solo: non possono divergere in silenzio ────────────────────────── */
for (const [nome, url] of INDIRIZZI) {
  test(`③ pmoSistemaNuovoPer ≡ pmoCassaNativaPer — ${nome}`, () => {
    assert.equal(sistemaNuovoPer(url), cassaNativaPer(url),
      'i due predicati hanno smesso di dire la stessa cosa: uno dei due è stato cambiato da solo');
  });
}

/* ── ② la forma è positiva: la negazione del cancello sbagliato non deve comparire ───────── */
test('② nessuna delle due funzioni nega `pmoGestionaleCollegatoAlCircolo`', () => {
  for (const nome of ['pmoSistemaNuovoPer', 'pmoCassaNativaPer']) {
    assert.ok(!/!\s*pmoGestionaleCollegatoAlCircolo/.test(senzaCommenti(corpoDi(nome))),
      `${nome} nega un cancello che fallisce chiuso: quel false diventerebbe un «sì» preso al buio`);
  }
});

/* ── ① bis — le due spinte NON si appendono all'hostname (voce 184 le spegnerebbe) ───────── */
for (const nome of ['pmoDisableMemberInMatchpoint', 'pmoReactivateMemberInMatchpoint']) {
  test(`① ${nome} chiede con CHI parla, non come si chiama l'indirizzo`, () => {
    const corpo = senzaCommenti(corpoDi(nome));
    assert.ok(/pmoSistemaNuovoPer\s*\(/.test(corpo),
      'manca la guardia sul ref Supabase: sul sistema nuovo questa funzione chiamerebbe la edge');
    assert.ok(!/PMO_IS_TEST_ENV/.test(corpo),
      'guardia appesa all\'hostname: la voce 184 la spegnerebbe in silenzio');
    assert.ok(corpo.indexOf('pmoSistemaNuovoPer') < corpo.indexOf('/functions/v1/'),
      'la guardia arriva DOPO la chiamata alla edge: non la ferma');
  });
}

/* ── ④ i quattro punti di chiamata riconoscono `non_collegato` ───────────────────────────── */
test('④ ogni `.then` che legge questi esiti gestisce `non_collegato` prima dell\'else', () => {
  const punti = [...APP.matchAll(/Promise\.resolve\(pmo(?:Disable|Reactivate)MemberInMatchpoint\(/g)];
  assert.equal(punti.length, 4, `punti di chiamata attesi 4, trovati ${punti.length}`);
  for (let i = 0; i < punti.length; i++) {
    // 🚨⭐⭐ LA FINESTRA FINISCE DOVE COMINCIA IL VICINO, e non è pignoleria: la prima versione
    // leggeva 2600 caratteri fissi, e i due punti della scheda socio (disattiva e riattiva)
    // distano **quindici righe**. 📏 Sabotaggio del 10/09: tolto il ramo al primo dei quattro, il
    // banco è restato VERDE — la finestra arrivava a leggere il ramo del gemello e si accontentava.
    // 📌 *Una sonda che può vedere la risposta del vicino non sta misurando il suo bersaglio:
    //    sta misurando che almeno uno dei due è a posto.*
    const fine = (i + 1 < punti.length) ? punti[i + 1].index : punti[i].index + 2600;
    const blocco = APP.slice(punti[i].index, fine);
    assert.ok(/st === 'non_collegato'/.test(blocco),
      'un punto di chiamata non gestisce `non_collegato`: cadrebbe nell\'else, cioè nell\'allarme falso');
  }
});

/* ── ④ bis — e l'annuncio non promette un secondo passo che non c'è ──────────────────────── */
test('④ le quattro promesse «lo disiscrivo / lo ri-iscrivo» sono condizionate', () => {
  const promesse = [...APP.matchAll(/⏳ Lo (?:disiscrivo|ri-iscrivo)/g)];
  assert.equal(promesse.length, 4, `promesse attese 4, trovate ${promesse.length}`);
  for (const p of promesse) {
    const prima = APP.slice(Math.max(0, p.index - 700), p.index);
    assert.ok(/pmoSistemaNuovo\(\)/.test(prima),
      'una promessa parte incondizionata: sul sistema nuovo annuncia un passo che non esiste');
  }
});

console.log(`\n— ${passed} passate, ${failed} fallite —`);
process.exit(failed === 0 ? 0 : 1);
