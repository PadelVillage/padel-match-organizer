// la-mano-sul-livello-lascia-la-data.test.mjs — PUNTO D (29/08/2026)
//
// 🚨⭐⭐ IL GUASTO CHE QUESTO BANCO ESISTE PER FERMARE.
// `assessment-apply-level` decide guardando `Math.max(lastLevelUpdateAt, selfAssessmentDate)`, e
// il suo commento si presenta così: *«IL CONTROLLO CHE IMPEDISCE IL DANNO: una scheda vecchia non
// deve mai scavalcare un livello aggiornato dopo»*. 📏 Misurato il 29/08 su PROD: quel campo lo
// scrivevano DUE punti soli, tutti e due dentro il giro dell'autovalutazione, e ce l'avevano
// **20 soci su 2817**. ⇒ La guardia era cieca esattamente al tipo di aggiornamento che nomina —
// la mano della segreteria — e a tenerla in piedi era un'ALTRA regola («il livello non scende mai
// da solo»), che assorbiva 13 casi su 14.
// 📌 *Una protezione che regge grazie a un'altra non è una protezione: è una coincidenza che tiene.*
//
// 🚨 LE PROVE SONO SUL COMPORTAMENTO: la funzione si ESTRAE da `index.html` e si ESEGUE, e la
// regola dell'edge si riproduce identica per far vedere il danno passare e poi non passare. Un
// banco che cercasse la stringa `lastLevelUpdateAt` resterebbe verde davanti a un ramo spento.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(QUI, '..', 'index.html'), 'utf8');

function estrai(nome) {
  const inizio = html.indexOf(`function ${nome}(`);
  if (inizio < 0) throw new Error(`funzione «${nome}» non trovata in index.html`);
  let t = html.indexOf('(', inizio), tonde = 0;
  for (; t < html.length; t++) {
    if (html[t] === '(') tonde++;
    else if (html[t] === ')') { tonde--; if (tonde === 0) { t++; break; } }
  }
  let i = html.indexOf('{', t), livello = 0, stringa = null, prec = '';
  for (; i < html.length; i++) {
    const c = html[i], succ = html[i + 1];
    if (stringa) { if (c === stringa && prec !== '\\') stringa = null; }
    else if (c === '/' && succ === '/') { const fine = html.indexOf('\n', i); i = fine < 0 ? html.length : fine; prec = '\n'; continue; }
    else if (c === '/' && succ === '*') { const fine = html.indexOf('*/', i + 2); i = fine < 0 ? html.length : fine + 1; prec = '/'; continue; }
    else if (c === '"' || c === "'" || c === '`') stringa = c;
    else if (c === '{') livello++;
    else if (c === '}') { livello--; if (livello === 0) { i++; break; } }
    prec = c;
  }
  return html.slice(inizio, i);
}

const ctx = vm.createContext({ console });
vm.runInContext(estrai('cleanCell'), ctx);
vm.runInContext(estrai('pmoMarcaLivelloCambiato'), ctx);
const marca = (m, prima, quando) => vm.runInContext('pmoMarcaLivelloCambiato', ctx)(m, prima, quando);

const QUANDO = '2026-08-29T14:00:00.000Z';

test('il livello cambiato lascia la data', () => {
  const m = { level: 4 };
  assert.equal(marca(m, 3, QUANDO), true);
  assert.equal(m.lastLevelUpdateAt, QUANDO);
});

test('da senza livello a un livello: e\' un cambio, e si marca', () => {
  const m = { level: 3 };
  assert.equal(marca(m, '', QUANDO), true);
  assert.equal(m.lastLevelUpdateAt, QUANDO);
});

// ⭐ LA RIGA CHE TIENE ONESTA LA CURA: salvare la scheda per correggere un telefono non deve
// bloccare nessuna prova in attesa. Senza questo, la cura sarebbe un guasto nuovo: ogni
// salvataggio della scheda socio spegnerebbe le schede di quel socio per sempre.
test('livello invariato: NON si marca, comunque sia scritto', () => {
  for (const [prima, dopo] of [[4, 4], ['4', 4], [4, '4.0'], ['4,0', '4.0'], ['4,5', 4.5], ['', ''], [null, undefined]]) {
    const m = { level: dopo };
    assert.equal(marca(m, prima, QUANDO), false, `«${prima}» → «${dopo}» non e' un cambio`);
    assert.equal(m.lastLevelUpdateAt, undefined, `«${prima}» → «${dopo}» non deve marcare`);
  }
});

test('senza socio non esplode e non marca', () => {
  assert.equal(marca(null, 3, QUANDO), false);
});

test('senza un istante dichiarato si mette adesso', () => {
  const m = { level: 5 };
  const prima = Date.now();
  assert.equal(marca(m, 4, ''), true);
  const t = Date.parse(m.lastLevelUpdateAt);
  assert.ok(Number.isFinite(t) && t >= prima - 1000, 'la data deve essere un istante vero');
});

// ══════════════════════════════════════════════════════════════════════════════════════
// LA PROVA CHE CONTA: la regola dell'edge, riprodotta identica, davanti al DANNO VERO.
// `assessment-apply-level/index.ts`:
//     const ultimo = Math.max(quando(socio.lastLevelUpdateAt), quando(socio.selfAssessmentDate));
//     if (ultimo && !(scritta > ultimo)) → non si applica
const quando = (v) => { const t = Date.parse(String(v ?? '')); return Number.isFinite(t) ? t : 0; };
function laSchedaScavalca(socio, schedaSubmittedAt) {
  const scritta = quando(schedaSubmittedAt);
  const ultimo = Math.max(quando(socio.lastLevelUpdateAt), quando(socio.selfAssessmentDate));
  return !(ultimo && !(scritta > ultimo));
}

test('SENZA la marca una scheda vecchia scavalca la mano della segreteria', () => {
  // La segreteria mette 2 a mano OGGI; in coda c'e' una prova di aprile che dice 3,5.
  const socio = { level: 2 };                       // nessuna traccia: com'era prima della cura
  assert.equal(laSchedaScavalca(socio, '2026-04-30T10:00:00.000Z'), true,
    'e\' il danno: senza data, la prova di aprile passa sopra la decisione di oggi');
});

test('CON la marca la stessa scheda viene fermata', () => {
  const socio = { level: 2 };
  marca(socio, 3.5, '2026-08-29T09:00:00.000Z');    // la segreteria l'ha abbassato stamattina
  assert.equal(laSchedaScavalca(socio, '2026-04-30T10:00:00.000Z'), false,
    'la prova di aprile e\' piu\' vecchia della mano: non si applica');
});

test('e una prova PIU\' RECENTE della mano continua a passare', () => {
  const socio = { level: 2 };
  marca(socio, 3.5, '2026-08-29T09:00:00.000Z');
  assert.equal(laSchedaScavalca(socio, '2026-08-29T18:00:00.000Z'), true,
    'la cura non deve bloccare le prove nuove: fermerebbe la cosa giusta');
});

// ══════════════════════════════════════════════════════════════════════════════════════
// I QUATTRO PUNTI CHE SCRIVONO IL LIVELLO. Questa e' una prova STRUTTURALE e si dichiara per
// quello che e': non esegue la scheda socio, controlla che ogni mano che scrive il livello di un
// socio esistente chiami la marca. Serve perche' il difetto del punto D non era una funzione
// sbagliata — era una CHIAMATA CHE NON C'ERA, e nessuna prova sul comportamento la vede.
test('ogni mano che scrive il livello chiama la marca', () => {
  const chiamate = (html.match(/pmoMarcaLivelloCambiato\(/g) || []).length;
  // 1 dichiarazione + 4 chiamate + 1 guardia `typeof` nel pannello calendario
  assert.ok(chiamate >= 5, `attese almeno 5 occorrenze di pmoMarcaLivelloCambiato, trovate ${chiamate}`);
  for (const ancora of [
    'pmoMarcaLivelloCambiato(giocatori[idx], currentEditable.level, now)',   // scheda in Anagrafica
    'pmoMarcaLivelloCambiato(member, oldLevel, now)',                        // import livelli Excel
    'pmoMarcaLivelloCambiato(next, cur.level, now)',                         // assistente
    'pmoMarcaLivelloCambiato(g, prevSnap.level',                             // scheda dal calendario
  ]) {
    assert.ok(html.includes(ancora), `manca la marca in: ${ancora}`);
  }
});

// Lo strumento di prova RIPORTA INDIETRO il socio: se lasciasse la data, bloccherebbe proprio
// la scheda che esiste per far ripassare.
test('lo strumento di prova AZZERA la data invece di marcarla', () => {
  const i = html.indexOf('function assessmentInjectTestValidareEntry');
  assert.ok(i > 0, 'lo strumento di prova non c\'e\' piu\': aggiornare questo banco');
  const blocco = html.slice(i, i + 2000);
  assert.ok(/member\.lastLevelUpdateAt\s*=\s*''/.test(blocco),
    'lo strumento di prova deve azzerare lastLevelUpdateAt come azzera selfAssessmentDate');
});

// Il campo deve arrivare al cloud, o la marca vive solo in questo browser.
test('la data viaggia verso il cloud insieme al livello', () => {
  assert.ok(html.includes("'lastLevelUpdateAt'"), 'lastLevelUpdateAt deve stare fra i campi propagati');
});
