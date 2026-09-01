// ── BANCO: fin dove il calendario staff SA, e dove smette di dirlo (voce 114) ───────────
//
// 🗣️ Nata da una sua domanda del 01/09/2026: *«non vedo quattro campi prenotati il 4 ottobre
//    alle 10:30»*. 🔎 Non era un guasto — il 4 ottobre stava a 33 giorni e il sync ne porta 30.
//    **Il difetto era cosa si vedeva al posto loro**: quattro campi verdi con scritto «Libero»,
//    cioè un'assenza di dato mostrata come risposta affermativa, e nel verso peggiore — «libero»
//    è la condizione per prenotarci sopra.
//
// ⚖️ E ALLARGARE L'ORIZZONTE NON SAREBBE STATA LA CURA: a 60 giorni la stessa frase falsa
//    ricomparirebbe il 61°. Il confine si sposta, la bugia no. ⇒ Questa metà va fatta comunque,
//    ed è quella che toglie il danno; i 60 giorni sono un'altra cosa e vogliono un'altra misura.
//
// ⭐ Le funzioni sono ESTRATTE da index.html, non ricopiate: una copia proverebbe sé stessa.
//
// Uso:  node test/orizzonte-del-calendario.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

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
  // 🚨 I commenti si saltano: in italiano sono pieni di apostrofi, e uno preso per un apice
  // sballa il conteggio delle graffe tirandosi dentro le funzioni successive.
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

// ⭐ Le due liste sono i GLOBALI che l'app usa davvero: si sostituiscono per ogni caso, così
// la funzione legge quello che leggerebbe in pagina invece di un parametro inventato qui.
const ctx = { prenotazioniOccupazione: [], prenotazioni: [] };
vm.createContext(ctx);
vm.runInContext([estrai('staffCalOrizzonte'), estrai('staffCalOltreOrizzonte')].join('\n'), ctx);

const con = (occ, pren = []) => { ctx.prenotazioniOccupazione = occ; ctx.prenotazioni = pren; };
const g = (data) => ({ data, ora: '10:30', campo: 'Campo 1' });

test('1) l\'orizzonte è il giorno PIÙ LONTANO che il gestionale ha visto', () => {
  con([g('2026-09-04'), g('2026-10-01'), g('2026-09-20')]);
  assert.equal(ctx.staffCalOrizzonte(), '2026-10-01');
});

test('2) 🚨 IL CASO SUO: dentro l\'orizzonte «libero», oltre NO', () => {
  // 📏 I numeri sono quelli veri del 01/09: 30 giorni di finestra, il 4 ottobre a 33.
  con([g('2026-09-04'), g('2026-10-01')]);
  assert.equal(ctx.staffCalOltreOrizzonte('2026-09-04'), false, 'un giorno DENTRO deve restare «libero»');
  assert.equal(ctx.staffCalOltreOrizzonte('2026-10-01'), false, 'il giorno del confine è ancora saputo');
  assert.equal(ctx.staffCalOltreOrizzonte('2026-10-04'), true, 'il 4 ottobre diceva «Libero» e non lo sapeva');
});

test('3) ⚠️ liste vuote ⇒ NON si dipinge di grigio: si torna al comportamento di prima', () => {
  // ⚖️ L'app che sta ancora caricando ha le liste vuote. Un fail-closed qui direbbe «non lo so»
  // su TUTTO il calendario, cioè renderebbe inservibile la schermata per curare i giorni lontani.
  con([], []);
  assert.equal(ctx.staffCalOrizzonte(), '');
  for (const giorno of ['2026-09-04', '2026-10-04', '2027-01-01']) {
    assert.equal(ctx.staffCalOltreOrizzonte(giorno), false, `${giorno}: grigio su una lista vuota`);
  }
});

test('4) le due liste si guardano TUTTE E DUE, e le righe rotte non contano', () => {
  // 🚨 `prenotazioni` e `prenotazioniOccupazione` sono due fonti diverse e l'orizzonte è il più
  // lontano fra le due: guardarne una sola lo accorcerebbe, cioè direbbe «non lo so» su giorni
  // che il gestionale conosce benissimo.
  con([g('2026-09-10')], [g('2026-10-20')]);
  assert.equal(ctx.staffCalOrizzonte(), '2026-10-20');
  con([g('2026-09-10'), null, { ora: '10:00' }, { data: '' }], []);
  assert.equal(ctx.staffCalOrizzonte(), '2026-09-10', 'una riga senza data ha spostato l\'orizzonte');
});

test('5) ⭐⭐ il numero 30 NON è scritto nell\'app: l\'orizzonte si MISURA', () => {
  // 🚨 È la decisione di disegno di questa voce. `DEFAULT_FUTURE_DAYS` vive nel sync; una
  // seconda copia qui sarebbe la stessa regola scritta due volte, e divergerebbe il giorno in
  // cui qualcuno ne cambia una sola — dicendo «libero» con la stessa sicurezza di oggi.
  // ⇒ Il giorno in cui l'orizzonte diventa 60, queste funzioni non si toccano.
  const src = estrai('staffCalOrizzonte') + estrai('staffCalOltreOrizzonte');
  assert.ok(!/\b(30|60)\b/.test(src), 'c\'è un numero di giorni scritto a mano: è la seconda copia della regola');
});

test('6) 🚨 TUTTI E TRE i disegni del verde chiedono, non solo quello visto sbagliare', () => {
  // ⚖️ Il calendario disegna gli slot liberi in tre punti (agenda, griglia verticale, corsie
  // larghe). Curare solo quello guardato durante la segnalazione lascerebbe gli altri due a
  // dire «Libero» al primo cambio di vista — e il difetto sembrerebbe intermittente.
  const usi = (html.match(/_oltre114/g) ?? []).length;
  assert.ok(usi >= 8, `«_oltre114» compare ${usi} volte: uno dei tre disegni non chiede`);
  assert.equal((html.match(/seg\.textContent = _oltre114 \? 'non lo so' : 'Libero'/g) ?? []).length, 3,
    'i segmenti che dicono «Libero» senza chiedere non sono tre: qualcuno è rimasto indietro');
  assert.ok(!/seg\.textContent = 'Libero'/.test(html), 'c\'è ancora un «Libero» detto senza chiedere');
});
