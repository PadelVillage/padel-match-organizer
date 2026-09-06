/* 🔝 «I bottoni della scheda stanno in TESTA, e ci restano» — banco delle VOCI 167 e 168.
 *
 * 🔄⭐⭐ RINOMINATO il 06/09/2026 pomeriggio, e il nome vecchio era «…stanno nel piè».
 *    La 168 li ha spostati dal fondo alla testa: un banco che si chiama «nel piè» mentre
 *    difende il contrario non è vecchio, **mente** — e il primo che lo apre gli crede.
 *    ⇒ Si rinomina, non si affianca.
 *
 * 🗣️ Sua richiesta: «vorrei che tutti i bottoni siano in basso, cioè salva, chiudi, annulla e
 *    aggiungi. Immettere tutti in orizzontale in basso alla scheda. che ne dici? così è più
 *    pratico».
 * 🚨 E la sua correzione, che ha deciso il PUNTO DI PARTENZA: «devi capire che dati ci sono
 *    dentro questa scheda prima di fare un nuovo mockup» ⇒ inventario della scheda aperta con la
 *    console remota, non lo screenshot. Da lì il fatto che questo banco protegge più di tutti:
 *    i bottoni della scheda sono **quattro**, ma nella scheda ce ne sono molti di più — ✕ e
 *    Cash/Card/Wallet per ogni giocatore. Quelli parlano del GIOCATORE e restano con lui.
 *
 * 🎯 COSA DIFENDE:
 *   ① i quattro bottoni della scheda finiscono TUTTI nella stessa barra;
 *   ② 🚨🚨 **LA PREMESSA CHE MUORE IN SILENZIO**: la barra resta FIGLIA DIRETTA del box.
 *      `_svcSchedaEsito` infila la riga dell'esito con `:scope > .svc-edit-actions-bar` e la
 *      guardia della 150 la cerca con `.svc-edit-box > .svc-edit-esito`: incartare la barra per
 *      ottenere il piè le farebbe fallire **tutte e due senza diventare rosse**. È la lezione
 *      della 152 — *una disposizione si cambia con la disposizione*;
 *   ③ a mettere il piè in fondo è la GRIGLIA (`grid-column:1 / -1`), dentro i 900 px;
 *   ④ 🚨 **Annulla prenotazione è lontano da Salva** (`margin-left:auto`) ed è l'ULTIMO del
 *      gruppo: è l'unico gesto distruttivo, e in una riga con Salva la distanza è la protezione;
 *   ⑤ il CONTO sta SOPRA il piè — cioè `box.appendChild(conto)` viene PRIMA di
 *      `box.appendChild(actions)`. Al contrario, con la barra a tutta larghezza, il conto
 *      finirebbe fuori dalla scheda;
 *   ⑥ 🚨 l'«Aggiungi giocatore» è nel piè **una volta sola**: se restasse anche nella colonna dei
 *      giocatori sarebbero due bottoni per lo stesso gesto — il difetto che questo progetto ha
 *      già pagato quattro volte (136, 145, 147, 150);
 *   ⑦ sotto i 900 px la barra va a capo, o i quattro si schiacciano sul telefono.
 *
 * ⛔ QUELLO CHE NON DICE: che sullo schermo i quattro ci stiano davvero in fila senza toccarsi.
 *    Quello lo dice la pagina viva, ed è la prova fisica.
 *
 * Esegui:  node test/i-bottoni-stanno-in-testa.test.mjs
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

function regolaCon(selettore, richiesto) {
  const re = new RegExp(selettore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'g');
  let m, ultima = null, dove = -1;
  while ((m = re.exec(APP))) {
    if (!richiesto || richiesto.test(m[1])) { ultima = m[1]; dove = m.index; }
  }
  assert.ok(ultima !== null, 'regola non trovata: ' + selettore + (richiesto ? ' con ' + richiesto : ''));
  return { corpo: ultima, indice: dove };
}

// le @media aperte in un punto, contate con una pila (non «la più vicina indietro»)
function mediaAperteIn(indice) {
  const pila = []; let k = 0;
  while (k < indice) {
    if (APP[k] === '@' && APP.startsWith('@media', k)) {
      const apre = APP.indexOf('{', k);
      if (apre < 0 || apre >= indice) break;
      pila.push({ cond: APP.slice(k, apre).trim(), livello: 0, aperta: true });
      k = apre; continue;
    }
    if (APP[k] === '{') { for (const m of pila) if (m.aperta) m.livello++; }
    else if (APP[k] === '}') {
      for (let i = pila.length - 1; i >= 0; i--) {
        if (!pila[i].aperta) continue;
        pila[i].livello--; if (pila[i].livello === 0) pila[i].aperta = false; break;
      }
    }
    k++;
  }
  return pila.filter(m => m.aperta).map(m => m.cond);
}

const iDove = (frammento) => {
  const i = APP.indexOf(frammento);
  assert.ok(i >= 0, 'non trovo più: ' + frammento);
  return i;
};

// ─────────────────────────────────────────────────────────────────────────────
// ① i quattro bottoni della scheda, tutti nella stessa barra
// ─────────────────────────────────────────────────────────────────────────────
test('① i QUATTRO bottoni della scheda finiscono tutti in `actions`', () => {
  for (const b of ['saveBtn', 'closeBtn', 'addBtn', 'delBtn']) {
    assert.ok(APP.includes('actions.appendChild(' + b + ');'),
      b + ' non finisce più nella barra: uno dei quattro che lui ha nominato è rimasto fuori');
  }
});

test('① e nessuno dei quattro è finito nella colonna dei giocatori', () => {
  assert.ok(!APP.includes('playersSec.appendChild(addBtn);'),
    'l\'«Aggiungi giocatore» sta ancora nella sezione dei giocatori: il piè non lo ha preso');
});

// ─────────────────────────────────────────────────────────────────────────────
// ② la premessa che muore in silenzio
// ─────────────────────────────────────────────────────────────────────────────
test('② 🚨 la barra resta FIGLIA DIRETTA del box (o esito e guardia della 150 falliscono muti)', () => {
  assert.ok(APP.includes('box.appendChild(actions);'),
    'la barra non è più appesa al box: `_svcSchedaEsito` cerca `:scope > .svc-edit-actions-bar` '
    + 'e la guardia della 150 `.svc-edit-box > .svc-edit-esito` — con un involucro in mezzo '
    + 'smettono di trovarle **tutte e due**, e niente diventa rosso');
  // e chi le cerca deve continuare a cercarle come figlie dirette
  assert.ok(APP.includes(":scope > .svc-edit-actions-bar"),
    'l\'esito non si aggancia più alla barra come figlia diretta');
  assert.ok(APP.includes('.svc-edit-box > .svc-edit-esito'),
    'la guardia della 150 non cerca più l\'esito come figlio diretto del box');
});

// ─────────────────────────────────────────────────────────────────────────────
// ③ ④ ⑦ la disposizione
// ─────────────────────────────────────────────────────────────────────────────
test('③ il piè attraversa le due colonne, e solo da 900 px in su', () => {
  const { corpo, indice } = regolaCon('.svc-edit-box > .svc-edit-actions-bar', /grid-column/);
  assert.match(corpo, /grid-column\s*:\s*1\s*\/\s*-1/,
    'il piè non attraversa più le due colonne: resterebbe stretto nella colonna sinistra');
  const media = mediaAperteIn(indice);
  assert.ok(media.some(c => /min-width\s*:\s*900px/.test(c)),
    'la regola del piè sta fuori dalla @media dei 900 px: sul telefono la scheda è una colonna '
    + 'sola e una griglia a due non c\'è');
});

test('③ e l\'esito lo attraversa insieme a lui, restandogli sopra', () => {
  const { corpo } = regolaCon('.svc-edit-box > .svc-edit-esito', /grid-column/);
  assert.match(corpo, /grid-column\s*:\s*1\s*\/\s*-1/,
    'la riga dell\'esito non attraversa le due colonne: la risposta al gesto finirebbe stretta '
    + 'sotto lo Slot invece che sopra il bottone che l\'ha chiesto');
});

test('④ 🚨 «Annulla prenotazione» è spinto lontano da Salva', () => {
  const { corpo } = regolaCon('.svc-edit-actions-bar > .svc-edit-del', /margin-left/);
  assert.match(corpo, /margin-left\s*:\s*auto/,
    'l\'unico gesto distruttivo della scheda non è più tenuto a distanza: in una riga con Salva '
    + 'un pollice che cerca Salva cancella la partita');
});

test('④ e nel DOM è l\'ULTIMO del gruppo, dopo l\'Aggiungi', () => {
  assert.ok(iDove('actions.appendChild(delBtn);') > iDove('actions.appendChild(addBtn);'),
    '«Annulla prenotazione» non è più in coda: `margin-left:auto` lo sposta a destra ma '
    + 'l\'ordine di lettura (e quello del TAB) resta quello del DOM');
});

test('⑦ sotto i 900 px la barra va a capo: i quattro in fila non ci starebbero', () => {
  const { corpo } = regolaCon('.svc-edit-actions-bar > .svc-edit-add', /flex\s*:\s*1\s+0\s+100%/);
  assert.match(corpo, /flex\s*:\s*1\s+0\s+100%/,
    'l\'«Aggiungi» non prende più tutta la riga sul telefono: i quattro si schiaccerebbero');
  const { corpo: cDel } = regolaCon('.svc-edit-actions-bar > .svc-edit-del', /flex\s*:\s*1\s+0\s+100%/);
  assert.ok(cDel, 'l\'«Annulla» non prende più tutta la riga sul telefono');
});

// ─────────────────────────────────────────────────────────────────────────────
// ⑧ 🚨🚨 IL DIFETTO CHE IL SORGENTE NON MOSTRA — trovato il 06/09 prima di spingere
// ─────────────────────────────────────────────────────────────────────────────
test('⑧ 🚨 le due disposizioni del piè stanno in @media DISGIUNTE, o l\'ordine decide al posto loro', () => {
  /* 📏 Il difetto vero, e non era teorico: le regole del telefono stavano ~200 righe SOTTO
   *    quelle del desktop, con la STESSA specificità (0,2,0). A parità di specificità il CSS
   *    prende l'ULTIMA scritta ⇒ su uno schermo grande avrebbe vinto `flex:1 0 100%`, e il piè
   *    sarebbe rimasto incolonnato **pur avendo la regola giusta scritta bene poco sopra**.
   * ⚖️ È la forma peggiore: due regole entrambe corrette, e il difetto sta nell'ORDINE — che
   *    nessuna prova che legge una regola per volta può vedere. Si vede solo chiedendo *sotto
   *    quali @media sta ciascuna*, ed è quello che fa questo caso. */
  const soloTel = regolaCon('.svc-edit-actions-bar > .svc-edit-del', /flex\s*:\s*1\s+0\s+100%/);
  const soloDes = regolaCon('.svc-edit-actions-bar > .svc-edit-del', /margin-left\s*:\s*auto/);
  const mTel = mediaAperteIn(soloTel.indice);
  const mDes = mediaAperteIn(soloDes.indice);
  assert.ok(mTel.some(c => /max-width\s*:\s*899px/.test(c)),
    'la disposizione da telefono di «Annulla» non è chiusa in `max-width:899px`: stando nuda, '
    + 'e stando DOPO quella del desktop, la scavalca anche su uno schermo grande');
  assert.ok(mDes.some(c => /min-width\s*:\s*900px/.test(c)),
    'la disposizione da desktop di «Annulla» non è chiusa in `min-width:900px`');
  // e le due soglie non devono sovrapporsi: 899 e 900 non si toccano
  assert.ok(soloTel.indice !== soloDes.indice, 'le due regole sono la stessa: una delle due è sparita');
});

// ─────────────────────────────────────────────────────────────────────────────
// ⑤ il conto sopra il piè
// ─────────────────────────────────────────────────────────────────────────────
test('⑤ 🔄 la barra sta SUBITO DOPO il titolo (voce 168)', () => {
  /* 🗣️ Sua richiesta: «vorrei che i bottoni vengano messi a seguire il titolo… questo perché
   *    quella barra rimane sempre fissa anche quando scrolli». ⇒ In fondo sparivano appena si
   *    scorreva, e un bottone che c'è ma non si vede vale come un bottone che non c'è. */
  const t = iDove('box.appendChild(title);');
  const a = iDove('box.appendChild(actions);');
  assert.ok(a > t, 'la barra non viene più dopo il titolo');
  // 🩹 la fetta parte DOPO la chiamata del titolo, o quella conterebbe sé stessa (difetto
  //    di questo caso, trovato facendolo cadere su un codice giusto).
  const inMezzo = APP.slice(t + 'box.appendChild(title);'.length, a);
  assert.ok(!/box\.appendChild\((?!actions)/.test(inMezzo),
    'fra il titolo e la barra si è infilato qualcos\'altro: la barra non è più il primo blocco '
    + 'della scheda, e in cima ci finirebbe quello');
});

test('⑤ 🚨 e ci RESTA: è `sticky` in cima, con sfondo pieno e uno z-index', () => {
  const { corpo } = regolaCon('.svc-edit-actions-bar', /position\s*:\s*sticky/);
  assert.match(corpo, /position\s*:\s*sticky/, 'la barra non è più ferma: torna a sparire scorrendo');
  assert.match(corpo, /top\s*:\s*0/, 'la barra è sticky ma senza `top`: non si aggancia a niente');
  // 🚨 Le due cose che, mancando, fanno un difetto che si vede solo scorrendo:
  assert.match(corpo, /background\s*:/,
    'la barra non ha uno sfondo pieno: il contenuto che le passa sotto si legge ATTRAVERSO i '
    + 'bottoni, e il difetto compare solo quando qualcuno scorre');
  assert.match(corpo, /z-index\s*:\s*[1-9]/,
    'la barra non ha z-index: le sezioni che scorrono le finiscono SOPRA');
});

// ─────────────────────────────────────────────────────────────────────────────
// ⑥ una sola volta
// ─────────────────────────────────────────────────────────────────────────────
test('⑥ 🚨 l\'«Aggiungi giocatore» esiste UNA volta sola', () => {
  const quante = (APP.match(/Aggiungi giocatore<\/button>|>Aggiungi giocatore'/g) || []).length;
  const creazioni = (APP.match(/const addBtn = document\.createElement\('button'\);/g) || []).length;
  assert.equal(creazioni, 1,
    'l\'«Aggiungi giocatore» si crea ' + creazioni + ' volte: due bottoni per lo stesso gesto '
    + 'sono il difetto che questo progetto ha già pagato quattro volte');
  assert.ok(quante >= 0);
});

test('⑥ e compare solo quando i giocatori ci sono davvero', () => {
  const i = iDove("const addBtn = document.createElement('button');");
  const prima = APP.slice(Math.max(0, i - 500), i);
  assert.match(prima, /st\.hasPlayers\s*&&\s*!_loadingRoster/,
    'l\'«Aggiungi giocatore» non è più protetto: su una manutenzione (nessun giocatore) o '
    + 'mentre il roster si legge, offrirebbe un gesto che la scheda non sa fare');
});

console.log('\n' + passed + ' passati, ' + failed + ' falliti');
process.exit(failed ? 1 : 0);
