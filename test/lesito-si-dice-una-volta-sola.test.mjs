/* 🔔 «L'esito si dice una volta sola» — banco della VOCE 150 (04/09/2026).
 *
 * 🗣️ SUA SEGNALAZIONE, dopo un Salva su PROD 6.334:
 *   «Continuano ad esserci due messaggi uno dopo l'altro in basso alla scheda, che ora si chiude
 *    dopo che ho salvato, e questo te lo confermo.»
 *
 * 📏 MISURATO sulla pagina viva di TEST a 390×844 prima di scrivere una riga di cura: nello
 *   stesso istante `.svc-edit-esito` occupava 573→650 e `#svcQueueStatus` 771→844, **tutte e due
 *   dentro `#svcChatPanel`**. Non è una deduzione dal sorgente: è la sua schermata, riprodotta.
 *
 * 🚨⭐⭐ IL PEZZO CHE VALE PIÙ DELLA CURA — **è il QUARTO giro sullo stesso difetto**, e le tre
 *   volte prima erano tutte giuste:
 *     · la **136** tolse il doppione fra la riga nella scheda e la PASTIGLIA;
 *     · la **137 ⑤** mandò gli AVANZAMENTI fuori dalla scheda;
 *     · la **145** tolse la riga durante un gesto in volo;
 *     · la **147** spense la pastiglia durante un gesto in volo.
 *   ⇒ Tutte e quattro governano l'**ATTESA**. Nessuna guardava l'**ESITO**, che è l'istante in
 *   cui la riga torna (voce 134, voluta) e la barra passa a `fatto` senza sapere che quel fatto
 *   è già scritto dieci pixel più su.
 *   📌 *Quattro cure che chiudono lo stesso difetto in quattro istanti diversi non lo chiudono:
 *      lo spostano nell'istante che nessuna delle quattro guardava.*
 *
 * 🎯 LE CINQUE COSE CHE QUESTO BANCO DIFENDE:
 *   ① dentro la scheda, a gesto finito e con la riga visibile, la barra TACE;
 *   ② 🚨 e tace SOLO lì: fuori dalla scheda la riga non esiste ⇒ la barra è l'unica voce;
 *   ③ 🚨 il gesto di un ALTRO operatore non si zittisce mai: non è il doppione del mio esito;
 *   ④ 🚨 a gesto IN CORSO la barra parla: è la regola della 145 vista dall'altro verso, ed è il
 *      freno che impedisce a questa cura di rimangiarsi quella;
 *   ⑤ 🚨 se la riga NON si vede, la barra torna. È il verso sicuro in cui cadere, ed è la lezione
 *      che la 147 ha pagato: *una protezione che poggia sull'esistenza di un altro pezzo muore in
 *      silenzio quando quel pezzo viene tolto*. Qui muore parlando.
 *   ⑥ e l'ORDINE, che è la metà che non si vede: la barra arriva a «finita» PRIMA che la riga
 *      esista (la accende il gancio su `window.fetch`), quindi `_svcSchedaEsito` deve ridisegnare
 *      la striscia — nei DUE versi. Senza, la guardia guarda sempre un istante troppo presto.
 *
 * ⛔ QUELLO CHE NON DICE: gira senza browser. Dice che le funzioni decidono bene, non che sullo
 *    schermo si veda un riquadro solo. Quello lo dice una scheda vera, su PROD.
 *
 * Esegui:  node test/lesito-si-dice-una-volta-sola.test.mjs
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

/** Il corpo di `function nome(`, contando le graffe dalla PRIMA del corpo.
 *  🚨 Si parte dalla `)` che chiude i PARAMETRI, non da una parola cercata dentro il corpo: una
 *  sonda che ritaglia a partire da ciò che vuole misurare non lo misura mai (difetto della 148). */
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
// ①-⑤ LA REGOLA PURA, ESEGUITA (non riletta: è la lezione della 149).
// ─────────────────────────────────────────────────────────────────────────────
const regola = new Function('return function svcBarraDoppiaDellaRiga(o) ' + corpoDi('svcBarraDoppiaDellaRiga') + ';')();

const CASO_PIENO = { dentroLaScheda: true, locale: true, finita: true, rigaEsitoVisibile: true };

test('① il caso di lui: scheda aperta, gesto mio, finito, riga visibile ⇒ la barra tace', () => {
  assert.equal(regola(CASO_PIENO), true,
    'i due riquadri restano uno sotto l\'altro in fondo alla scheda: è la sua schermata');
});

test('② fuori dalla scheda la barra PARLA — lì la riga non esiste proprio', () => {
  assert.equal(regola({ ...CASO_PIENO, dentroLaScheda: false }), false,
    'zittita a scheda chiusa, la conferma non la direbbe più nessuno');
});

test('③ 🚨 il gesto di un ALTRO operatore non si zittisce mai', () => {
  assert.equal(regola({ ...CASO_PIENO, locale: false }), false,
    'il mio esito non è il doppione di ciò che sta facendo qualcun altro sugli stessi campi');
});

test('④ 🚨 a gesto IN CORSO la barra parla (la 145 non si rimangia)', () => {
  assert.equal(regola({ ...CASO_PIENO, finita: false }), false,
    'durante l\'attesa la riga non c\'è: zittire la barra lascerebbe il gesto muto');
});

test('⑤ 🚨 riga non visibile ⇒ la barra TORNA: si cade dal verso sicuro', () => {
  assert.equal(regola({ ...CASO_PIENO, rigaEsitoVisibile: false }), false,
    'meglio due avvisi che nessuno: questa guardia deve morire parlando, non in silenzio');
});

test('⑤ e regge anche senza argomento, invece di esplodere', () => {
  assert.equal(regola(), false);
  assert.equal(regola(null), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// ⑥ LA GUARDIA È DAVVERO NEL DISEGNO DELLA STRISCIA — eseguito, con un DOM finto.
// ─────────────────────────────────────────────────────────────────────────────
function elFinto(id) {
  const cls = new Set();
  const el = {
    id: id || '', hidden: false, textContent: '', innerHTML: '', figli: [], onclick: null,
    parentElement: null, type: '',
    get className() { return Array.from(cls).join(' '); },
    set className(v) { cls.clear(); String(v || '').split(/\s+/).filter(Boolean).forEach((c) => cls.add(c)); },
    classList: {
      add: (c) => cls.add(c),
      contains: (c) => cls.has(c),
      toggle: (c, on) => { if (on) cls.add(c); else cls.delete(c); },
    },
    setAttribute() {},
    appendChild(n) { el.figli.push(n); n.parentElement = el; return n; },
    getBoundingClientRect: () => ({ width: 200, height: 40, top: 0, bottom: 40 }),
  };
  return el;
}

function bancoStriscia({ schedaAperta, rigaSiVede, azioneLocale }) {
  const striscia = elFinto('svcQueueStatus');
  const panel = elFinto('svcChatPanel');
  const body = elFinto('body');
  const document = {
    body,
    getElementById: (i) => (i === 'svcQueueStatus' ? striscia : (i === 'svcChatPanel' ? panel : null)),
    createElement: () => elFinto(''),
    querySelector: () => null,
  };
  const celleAccese = [];
  const corpo = corpoDi('svcRidisegnaSemaforo');
  const f = new Function(
    'document', '_svcAzioneLocale', '_svcUltimoSemaforo', '_svcUltimoSemaforoTs', 'SVC_REMOTO_SCADE_MS',
    'SVC_ESITI', 'svcFraseDellEsito', 'svcAccendiCella', 'svcSchedaAperta', 'svcBarraDoppiaDellaRiga',
    '_svcRigaEsitoSiVede', 'svcAzzeraPosizioneStriscia', 'svcPosizionaPastiglia', 'svcApriDallaPastiglia',
    'svcScacciaAzione',
    'return function svcRidisegnaSemaforo() ' + corpo + ';',
  )(
    document, azioneLocale, null, 0, 60000,
    { fatto: { segno: '✅', classe: 'svc-semaforo-fatto', durataMs: 6000 },
      rifiutato: { segno: '⛔', classe: 'svc-semaforo-rifiutato', durataMs: 0 },
      ignoto: { segno: '❔', classe: 'svc-semaforo-ignoto', durataMs: 0 } },
    () => 'frase dell\'esito',
    (d) => celleAccese.push(d),
    () => schedaAperta,
    regola,
    () => rigaSiVede,
    () => {}, () => {}, () => {}, () => {},
  );
  f();
  return { striscia, celleAccese };
}

const GESTO_FINITO = { stato: 'fatto', corso: '💶 Cambio l\'importo', chi: 'io', dove: { campo: 2, data: '2026-09-03', ora: '21:00' }, motivo: null };
const GESTO_IN_CORSO = { ...GESTO_FINITO, stato: 'corso' };

test('⑥ la striscia si SPEGNE quando la riga dice già la stessa cosa', () => {
  const { striscia } = bancoStriscia({ schedaAperta: true, rigaSiVede: true, azioneLocale: GESTO_FINITO });
  assert.equal(striscia.hidden, true,
    'la striscia è ancora accesa sotto la riga dell\'esito: i due messaggi sono tornati');
  assert.equal(striscia.textContent, '',
    'nascosta ma piena: un `aria-live` già annunciato non lo ritira nessun `hidden`');
});

test('⑥ e resta ACCESA in tutti i casi in cui la riga non basta', () => {
  const casi = [
    ['scheda chiusa', { schedaAperta: false, rigaSiVede: true, azioneLocale: GESTO_FINITO }],
    ['riga non visibile', { schedaAperta: true, rigaSiVede: false, azioneLocale: GESTO_FINITO }],
    ['gesto in corso', { schedaAperta: true, rigaSiVede: true, azioneLocale: GESTO_IN_CORSO }],
  ];
  for (const [nome, cfg] of casi) {
    const { striscia } = bancoStriscia(cfg);
    assert.equal(striscia.hidden, false, 'la striscia è muta quando invece serviva — caso: ' + nome);
    assert.ok(striscia.figli.length > 0, 'spenta a metà (vuota ma visibile) — caso: ' + nome);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ⑥bis L'ORDINE: la riga dell'esito deve RISVEGLIARE la striscia, nei due versi.
// ─────────────────────────────────────────────────────────────────────────────
function bancoRiga() {
  const figli = [];
  const mk = () => ({ className: '', innerHTML: '', remove() { const i = figli.indexOf(this); if (i >= 0) figli.splice(i, 1); } });
  const box = {
    querySelector: (s) => (/svc-edit-esito/.test(s) ? (figli.find((f) => /svc-edit-esito/.test(f.className)) || null) : null),
    insertBefore(n) { figli.push(n); },
    appendChild(n) { figli.push(n); },
  };
  const document = { querySelector: (s) => (/svc-edit-box/.test(s) ? box : null), createElement: mk };
  let ridisegni = 0;
  const f = new Function('document', 'svcRidisegnaSemaforo',
    'return function _svcSchedaEsito(html, tipo) ' + corpoDi('_svcSchedaEsito') + ';')(
    document, () => { ridisegni++; });
  return { f, figli, conta: () => ridisegni };
}

test('⑥bis scrivere un ESITO ridisegna la striscia (o la guardia guarda troppo presto)', () => {
  const b = bancoRiga();
  b.f('✅ Importo salvato su Matchpoint', 'ok');
  assert.equal(b.conta(), 1,
    'la barra arriva a «finita» PRIMA che questa riga esista: senza ridisegno il doppione resta');
});

test('⑥bis e TOGLIERE la riga (wait) la ridisegna pure: l\'avanzamento non deve restare muto', () => {
  const b = bancoRiga();
  b.f('✅ Fatto', 'ok');
  b.f('↻ Salvo su Matchpoint l\'importo a carico… (non chiudere)', 'wait');
  assert.equal(b.conta(), 2, 'tolta la riga, la striscia deve tornare a parlare');
  assert.equal(b.figli.length, 0, 'la riga vecchia è rimasta accanto a un gesto in corso');
});

test('⑥bis il ridisegno NON può far fallire la scrittura dell\'esito', () => {
  const figli = [];
  const mk = () => ({ className: '', innerHTML: '', remove() {} });
  const box = { querySelector: () => null, insertBefore: (n) => figli.push(n), appendChild: (n) => figli.push(n) };
  const document = { querySelector: (s) => (/svc-edit-box/.test(s) ? box : null), createElement: mk };
  const f = new Function('document', 'svcRidisegnaSemaforo',
    'return function _svcSchedaEsito(html, tipo) ' + corpoDi('_svcSchedaEsito') + ';')(
    document, () => { throw new Error('striscia esplosa'); });
  const riga = f('✅ Importo salvato', 'ok');
  assert.ok(riga, 'una striscia rotta non deve poter cancellare l\'esito di una scrittura di denaro');
  assert.match(riga.innerHTML, /Importo salvato/);
});

console.log('\n' + passed + ' passati, ' + failed + ' falliti');
process.exit(failed ? 1 : 0);
