/**
 * ── BANCO: IL MAESTRO LO DECIDE LA TABELLA, NON UN FILE SU GITHUB (voce 202) ──────────
 *
 * 🗣️ Sua richiesta del 10/09/2026: «bisogna creare un posto nel gestionale di test dove si
 *    possono aggiungere e modificare i nomi dei maestri che poi si vedono dentro la scheda che
 *    si apre dal calendario».
 *
 * 🚨⭐⭐ IL CASO CHE VALE PIÙ DI TUTTI È `② la porta chiusa`, e non è il caso felice.
 *    L'elenco arriva da una RPC: può non arrivare (permesso negato, rete giù, login non ancora
 *    fatto). Se in quel caso l'overlay scrivesse comunque, `valori_validi` resterebbe VUOTO —
 *    e un selettore del maestro vuoto è una LEZIONE CHE NON SI CREA PIÙ, per un guasto di
 *    lettura. ⇒ Elenco vuoto = regole intatte, col ripiego cablato ancora in piedi.
 *    📌 *Una cura che migliora il caso normale e rompe il caso degradato non è una cura.*
 *
 * 🚨⭐ IL SECONDO: `⑨ il valore resta il CODICE`. Il nome è ciò che si legge, il codice è ciò
 *    che è già scritto nelle prenotazioni e che viene mandato avanti. Se l'overlay mettesse i
 *    NOMI in `valori_validi`, la scheda manderebbe «Gianluca Spinazzè» dove il sistema aspetta
 *    «Spinazze» — e il difetto si vedrebbe solo al salvataggio, su una lezione vera.
 *
 * ⛔ QUELLO CHE QUESTO BANCO NON DICE: che il pannello si apra, che la RPC risponda, e che
 *    nella scheda viva si legga il nome. Quelle sono misure sulla pagina, non sul banco.
 *
 * Esegui:  node test/il-maestro-lo-decide-la-tabella.test.mjs
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

/** Il testo di una funzione dichiarata nell'app, graffe bilanciate. */
function sorgenteDi(nome) {
  const i = APP.indexOf('function ' + nome + '(');
  assert.ok(i > 0, 'funzione non trovata: ' + nome);
  let g = 0, visto = false, k = APP.indexOf(') {', i) + 2;
  for (; k < APP.length; k++) {
    const c = APP[k];
    if (c === '{') { g++; visto = true; }
    else if (c === '}') { g--; if (visto && g === 0) { k++; break; } }
  }
  return APP.slice(i, k);
}

/* 🔨 IL BANCO ESECUTIVO: le due funzioni si estraggono dall'app e si eseguono DAVVERO, con un
 * `PARSER_RULES` finto che il banco controlla. Così un domani che cambia il comportamento cade
 * qui, invece di passare perché il sorgente «contiene ancora la parola giusta». */
function monta(regoleIniziali) {
  const fabbrica = new Function('statoIniziale', `
    let PARSER_RULES = statoIniziale;
    ${sorgenteDi('pmoMaestriSuRegole')}
    ${sorgenteDi('pmoMaestroEtichetta')}
    return {
      applica: function (elenco) { PARSER_RULES = pmoMaestriSuRegole(PARSER_RULES, elenco); return PARSER_RULES; },
      etichetta: pmoMaestroEtichetta,
      regole: function () { return PARSER_RULES; },
    };
  `);
  return fabbrica(regoleIniziali);
}

/** Le regole come nascono nell'app: i tre nomi CABLATI del ripiego. */
const RIPIEGO = () => ({
  versione: 'v2.1',
  campi_opzionali: {
    istruttore: {
      valori_validi: ['LoZio', 'Spinazze', 'Lucas Vidal'],
      fuzzy_match: { 'Lo Zio': 'LoZio', 'Spinazzi': 'Spinazze', 'Vidal': 'Lucas Vidal' },
      domanda_se_manca: 'Quale istruttore? (LoZio, Spinazze, Lucas Vidal)',
    },
  },
});

/** La tabella `pmo_maestri` com'è davvero su `cudi`, misurata il 10/09/2026. */
const TABELLA = [
  { codice: 'LoZio', nome: 'Maurizio Aprea', attivo: true },
  { codice: 'Spinazze', nome: 'Gianluca Spinazzè', attivo: true },
  { codice: 'Lucas Vidal', nome: 'Lucas Vidal', attivo: true },
];

// ══════════════════════════════════════════════════════════════════════════════════
// ① LA TABELLA VINCE
// ══════════════════════════════════════════════════════════════════════════════════

test('① un maestro aggiunto in tabella compare fra i valori validi', () => {
  const b = monta(RIPIEGO());
  const r = b.applica(TABELLA.concat([{ codice: 'Santiago', nome: 'Santiago Ruiz', attivo: true }]));
  assert.deepEqual(r.campi_opzionali.istruttore.valori_validi,
    ['LoZio', 'Spinazze', 'Lucas Vidal', 'Santiago']);
});

test('① …e uno TOLTO dalla tabella spariesce dai valori validi', () => {
  const b = monta(RIPIEGO());
  const r = b.applica([{ codice: 'LoZio', nome: 'Maurizio Aprea', attivo: true }]);
  assert.deepEqual(r.campi_opzionali.istruttore.valori_validi, ['LoZio']);
});

// ══════════════════════════════════════════════════════════════════════════════════
// 🚨 ② LA PORTA CHIUSA — il caso che vale più di tutti
// ══════════════════════════════════════════════════════════════════════════════════

test('🚨 ② elenco VUOTO ⇒ le regole NON si toccano (resta il ripiego cablato)', () => {
  const b = monta(RIPIEGO());
  const r = b.applica([]);
  assert.deepEqual(r.campi_opzionali.istruttore.valori_validi, ['LoZio', 'Spinazze', 'Lucas Vidal'],
    'un selettore vuoto è una lezione che non si crea più');
});

test('🚨 ② e nemmeno con `null`, `undefined` o una risposta che non è un elenco', () => {
  for (const brutto of [null, undefined, {}, 'LoZio', 0]) {
    const b = monta(RIPIEGO());
    const r = b.applica(brutto);
    assert.deepEqual(r.campi_opzionali.istruttore.valori_validi, ['LoZio', 'Spinazze', 'Lucas Vidal'],
      'caduto su: ' + JSON.stringify(brutto));
  }
});

test('🚨 ② e nemmeno se le righe ci sono ma sono TUTTE spente o senza codice', () => {
  const b = monta(RIPIEGO());
  const r = b.applica([
    { codice: 'LoZio', nome: 'Maurizio Aprea', attivo: false },
    { codice: '   ', nome: 'Senza Codice', attivo: true },
  ]);
  assert.deepEqual(r.campi_opzionali.istruttore.valori_validi, ['LoZio', 'Spinazze', 'Lucas Vidal']);
});

// ══════════════════════════════════════════════════════════════════════════════════
// ③ SOLO GLI ATTIVI SI POSSONO SCEGLIERE
// ══════════════════════════════════════════════════════════════════════════════════

test('③ un maestro spento non è più scegliibile, ma gli altri restano', () => {
  const b = monta(RIPIEGO());
  const r = b.applica([
    { codice: 'LoZio', nome: 'Maurizio Aprea', attivo: true },
    { codice: 'Spinazze', nome: 'Gianluca Spinazzè', attivo: false },
  ]);
  assert.deepEqual(r.campi_opzionali.istruttore.valori_validi, ['LoZio']);
});

// ══════════════════════════════════════════════════════════════════════════════════
// ④⑤⑥ LE ETICHETTE — si legge la PERSONA
// ══════════════════════════════════════════════════════════════════════════════════

test('④ il codice si legge col nome della persona', () => {
  const b = monta(RIPIEGO());
  b.applica(TABELLA);
  assert.equal(b.etichetta('Spinazze'), 'Gianluca Spinazzè');
  assert.equal(b.etichetta('LoZio'), 'Maurizio Aprea');
});

test('⑤ un codice SCONOSCIUTO si legge com\'è, non come un buco (è il caso `Santiago`)', () => {
  const b = monta(RIPIEGO());
  b.applica(TABELLA);
  assert.equal(b.etichetta('Santiago'), 'Santiago');
});

test('⑥ il confronto non distingue le maiuscole (nel roster c\'è «-lucas vidal.»)', () => {
  const b = monta(RIPIEGO());
  b.applica(TABELLA);
  assert.equal(b.etichetta('lucas vidal'), 'Lucas Vidal');
  assert.equal(b.etichetta('SPINAZZE'), 'Gianluca Spinazzè');
});

test('⑥ e un codice vuoto non diventa una stringa strana', () => {
  const b = monta(RIPIEGO());
  b.applica(TABELLA);
  assert.equal(b.etichetta(''), '');
  assert.equal(b.etichetta(null), '');
  assert.equal(b.etichetta(undefined), '');
});

// ══════════════════════════════════════════════════════════════════════════════════
// ⑦ IL PARSER IMPARA I NOMI, SENZA PERDERE GLI ERRORI DI BATTITURA VERI
// ══════════════════════════════════════════════════════════════════════════════════

test('⑦ il NOME diventa riconoscibile dal parser, e riporta al codice', () => {
  const b = monta(RIPIEGO());
  const f = b.applica(TABELLA).campi_opzionali.istruttore.fuzzy_match;
  assert.equal(f['Gianluca Spinazzè'], 'Spinazze');
  assert.equal(f['gianluca spinazzè'], 'Spinazze');
  assert.equal(f['Maurizio Aprea'], 'LoZio');
});

test('🚨 ⑦ e NON sovrascrive le voci che c\'erano già (curano errori visti sul campo)', () => {
  const b = monta(RIPIEGO());
  const f = b.applica(TABELLA).campi_opzionali.istruttore.fuzzy_match;
  assert.equal(f['Spinazzi'], 'Spinazze');
  assert.equal(f['Lo Zio'], 'LoZio');
  assert.equal(f['Vidal'], 'Lucas Vidal');
});

// ══════════════════════════════════════════════════════════════════════════════════
// ⑧ LA DOMANDA NON NOMINA PIÙ TRE NOMI CABLATI
// ══════════════════════════════════════════════════════════════════════════════════

test('⑧ «Quale istruttore?» elenca i nomi della tabella, non i tre del file', () => {
  const b = monta(RIPIEGO());
  const r = b.applica(TABELLA.concat([{ codice: 'Santiago', nome: 'Santiago Ruiz', attivo: true }]));
  assert.equal(r.campi_opzionali.istruttore.domanda_se_manca,
    'Quale istruttore? (Maurizio Aprea, Gianluca Spinazzè, Lucas Vidal, Santiago Ruiz)');
});

// ══════════════════════════════════════════════════════════════════════════════════
// 🚨 ⑨ IL VALORE RESTA IL CODICE — il secondo caso che vale più di tutti
// ══════════════════════════════════════════════════════════════════════════════════

test('🚨 ⑨ in `valori_validi` ci sono i CODICI, mai i nomi', () => {
  const b = monta(RIPIEGO());
  const validi = b.applica(TABELLA).campi_opzionali.istruttore.valori_validi;
  assert.ok(validi.includes('Spinazze'), 'il codice deve restare il valore');
  assert.ok(!validi.includes('Gianluca Spinazzè'),
    'un nome in `valori_validi` arriverebbe al worker dove è atteso il codice');
});

test('⑨ un nome mancante in tabella ripiega sul codice invece di lasciare un buco', () => {
  const b = monta(RIPIEGO());
  const r = b.applica([{ codice: 'Santiago', nome: '   ', attivo: true }]);
  assert.deepEqual(r.campi_opzionali.istruttore.valori_validi, ['Santiago']);
  assert.equal(b.etichetta('Santiago'), 'Santiago');
});

// ══════════════════════════════════════════════════════════════════════════════════
// ⑩ IL RINFRESCO DELL'ORA DOPO NON RIPORTA I TRE NOMI DEL FILE
// ══════════════════════════════════════════════════════════════════════════════════

test('⑩ `PARSER_RULES` sostituito da un giro nuovo e l\'elenco si riapplica', () => {
  const b = monta(RIPIEGO());
  b.applica(TABELLA);
  // com'è davvero: `loadParserRules` fa `PARSER_RULES = json`, oggetto NUOVO dal file
  const fresco = b.applica.call(null, TABELLA); // l'overlay è puro: si riapplica su ciò che arriva
  assert.deepEqual(fresco.campi_opzionali.istruttore.valori_validi, ['LoZio', 'Spinazze', 'Lucas Vidal']);
  const dopo = monta(RIPIEGO()).applica(TABELLA.concat([{ codice: 'Santiago', nome: 'Santiago Ruiz', attivo: true }]));
  assert.ok(dopo.campi_opzionali.istruttore.valori_validi.includes('Santiago'));
});

test('⑩ e le regole senza `campi_opzionali` non fanno cadere niente', () => {
  const b = monta({ versione: 'v2.1' });
  const r = b.applica(TABELLA);
  assert.deepEqual(r.campi_opzionali.istruttore.valori_validi, ['LoZio', 'Spinazze', 'Lucas Vidal']);
});

// ══════════════════════════════════════════════════════════════════════════════════
// ⑪ LE RIGHE DEL SORGENTE CHE NESSUN CASO QUI SOPRA PUÒ PROTEGGERE
//    (un domani che le toglie lascerebbe tutti i casi di sopra verdi)
// ══════════════════════════════════════════════════════════════════════════════════

test('🚨 ⑪ l\'overlay si riapplica DOPO OGNI caricamento, ripiego compreso (`finally`)', () => {
  const i = APP.indexOf('async function loadParserRules()');
  assert.ok(i > 0, 'loadParserRules non trovata');
  const corpo = APP.slice(i, i + 1800);
  assert.ok(/finally\s*\{[\s\S]*pmoApplicaMaestriSuParserRules/.test(corpo),
    'senza il `finally` il rinfresco dell\'ora dopo riporterebbe i tre nomi del file');
});

test('🚨 ⑪ i tre selettori del maestro mostrano l\'ETICHETTA, non il codice grezzo', () => {
  // la scheda dal calendario · la creazione · il flusso a bottoni
  assert.ok(APP.includes("o.textContent = pmoMaestroEtichetta(v)"), 'la scheda dal calendario');
  assert.ok(APP.includes("o.textContent=pmoMaestroEtichetta(m)"), 'la creazione');
  assert.ok(APP.includes('const _etichette = maestri.map(function(c){ return pmoMaestroEtichetta(c); });'), 'il flusso a bottoni');
});

test('⑪ il pannello salva passando dalla RPC col permesso `cloud_sync`', () => {
  assert.ok(/pmoStaffRpc\('pmo_set_maestri', \{ p_maestri: righe \}, 'cloud_sync'/.test(APP));
  assert.ok(/pmoStaffRpc\('pmo_get_maestri'/.test(APP));
});

test('⑪ il `codice` di una riga che ESISTE non è modificabile (è la chiave delle prenotazioni)', () => {
  const i = APP.indexOf('function pmoRenderMaestri()');
  assert.ok(i > 0);
  const corpo = APP.slice(i, APP.indexOf('async function pmoSalvaMaestri()'));
  assert.ok(/if \(m\.nuovo\) \{/.test(corpo), 'il campo di testo del codice vale solo per le righe nuove');
  assert.ok(corpo.includes('non si cambia.'), 'e lo dice a chi guarda');
});

console.log(`\n— ${passed + failed} casi, ${failed} rossi —`);
if (failed) process.exitCode = 1;
