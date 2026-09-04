/* 📌 «La barra dei capitoli resta ferma, il sotto scorre» — banco della VOCE 155 (04/09/2026).
 *
 * 🗣️ Sua richiesta: «questa barra su desktop deve rimanere sempre fissa e il sotto scollare».
 *
 * 📏 MISURATO sulla pagina viva di PROD 6.342 a 1440×900 PRIMA di scrivere una riga, perché
 *    `position:sticky` non funziona «in generale»: funziona rispetto a un antenato preciso.
 *    · a scorrere NON è il documento (`html` e `body` sono `overflow:hidden`, e
 *      `scrollHeight - clientHeight` valeva **0**);
 *    · lo scroller è **`main.main-content`** (`overflow-y:auto`);
 *    · fra la barra e lo scroller c'è **un solo** antenato, `.container`, e vale
 *      `overflow:visible` — che è la condizione perché lo sticky viva.
 *
 * 🎯 LE COSE CHE QUESTO BANCO DIFENDE:
 *   ① la barra è dichiarata `sticky` a `top:0`;
 *   ② 🚨 sta DENTRO `@media (min-width:900px)` — «su desktop», parola sua; sotto i 900 quella
 *      barra è `display:none` e la navigazione è il cassetto del ≡;
 *   ③ 🚨🚨 il livello sta SOTTO il velo delle due schede (2550): una barra che resta accesa
 *      sopra un velo scuro non sembra fissa, sembra rotta. E sopra il contenuto, o non
 *      servirebbe a niente;
 *   ④ 🚨🚨 **LA PREMESSA, che è la cosa che muore in silenzio**: `.container` non deve
 *      dichiarare `overflow`. Se un domani qualcuno gliene mette uno, la barra si aggancia a
 *      QUELLO invece che allo scroller e smette di seguire lo scorrimento — senza che niente
 *      si rompa a voce alta, e senza che questo banco, guardando solo la regola, se ne accorga;
 *   ⑤ e `.main-content` resta lo scroller: senza `overflow-y:auto` lì, non c'è nessuno scroller
 *      a cui agganciarsi e lo sticky non ha niente da fare.
 *
 * ⛔ QUELLO CHE NON DICE: gira senza browser. Dice che la regola c'è, sta nel posto giusto e
 *    che le due premesse misurate reggono ancora — NON che scorrendo la barra resti ferma.
 *    Quello lo dice la pagina viva, ed è la prova fisica.
 *
 * Esegui:  node test/la-barra-dei-capitoli-resta-ferma.test.mjs
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

// La regola che DICHIARA la barra fissa: quella che porta `position:sticky`.
function regolaSticky() {
  const re = /\.pmo-chapter-bar\s*\{([^}]*)\}/g;
  let m, trovata = null, indice = -1;
  while ((m = re.exec(APP))) {
    if (/position\s*:\s*sticky/.test(m[1])) { trovata = m[1]; indice = m.index; }
  }
  assert.ok(trovata, 'nessuna regola .pmo-chapter-bar dichiara position:sticky');
  return { corpo: trovata, indice };
}

// ─────────────────────────────────────────────────────────────────────────────
test('① la barra è sticky, e si ferma a top:0', () => {
  const { corpo } = regolaSticky();
  assert.match(corpo, /position\s*:\s*sticky/);
  const m = corpo.match(/top\s*:\s*(-?\d+)(?:px)?\b/);
  assert.ok(m, 'la regola sticky non dichiara nessun `top`: senza, non si ferma da nessuna parte');
  assert.equal(Number(m[1]), 0,
    'si ferma a ' + m[1] + 'px invece che a 0: i 20px sopra sono il padding di .container, e '
    + 'fermandosi lì il contenuto scorrerebbe in quella fascia, sopra la barra');
});

// 🩹 Le @media APERTE nel punto `indice`, contate con una PILA e non con «la più vicina
//    indietro»: fra l'apertura di una @media e una regola ce ne stanno altre già chiuse, e
//    `lastIndexOf` trova quelle. Prima versione di questa prova: rossa su una cura giusta.
function mediaAperteIn(indice) {
  const pila = [];
  let k = 0;
  while (k < indice) {
    const c = APP[k];
    if (c === '@' && APP.startsWith('@media', k)) {
      const apre = APP.indexOf('{', k);
      if (apre < 0 || apre >= indice) break;
      pila.push({ cond: APP.slice(k, apre).trim(), livello: 0, aperta: true });
      k = apre; continue;
    }
    if (c === '{') { for (const m of pila) if (m.aperta) m.livello++; }
    else if (c === '}') {
      for (let i = pila.length - 1; i >= 0; i--) {
        if (!pila[i].aperta) continue;
        pila[i].livello--;
        if (pila[i].livello === 0) pila[i].aperta = false;
        break;
      }
    }
    k++;
  }
  return pila.filter(m => m.aperta).map(m => m.cond);
}

test('② 🚨 la regola sta DENTRO @media (min-width:900px) — «su desktop», parola sua', () => {
  const { indice } = regolaSticky();
  const aperte = mediaAperteIn(indice);
  assert.ok(aperte.length > 0, 'la regola non sta dentro nessuna @media: varrebbe anche sul telefono, '
    + 'dove quella barra è display:none e la navigazione è il cassetto del ≡');
  assert.ok(aperte.some(c => /min-width\s*:\s*900px/.test(c)),
    'le @media aperte lì sono [' + aperte.join(' · ') + ']: nessuna è la soglia dei 900 px');
});

test('③ 🚨 il livello sta sopra il contenuto ma SOTTO il velo delle due schede', () => {
  const { corpo } = regolaSticky();
  const m = corpo.match(/z-index\s*:\s*(\d+)/);
  assert.ok(m, 'la barra fissa non dichiara z-index: il contenuto le scorrerebbe SOPRA');
  const z = Number(m[1]);
  assert.ok(z > 0, 'z-index ' + z + ': non sta sopra niente');
  // il velo che copre tutto quando si apre una scheda
  const velo = APP.match(/\.svc-chat-overlay\s*\{[^}]*z-index\s*:\s*(\d+)/);
  assert.ok(velo, 'non trovo lo z-index del velo delle schede: la ③ non sa più cosa confrontare');
  assert.ok(z < Number(velo[1]),
    'la barra (' + z + ') sta sopra il velo delle schede (' + velo[1] + '): con una scheda aperta '
    + 'resterebbe accesa sopra lo scuro, e non sembrerebbe fissa — sembrerebbe rotta');
});

// ─────────────────────────────────────────────────────────────────────────────
// ④ ⑤ Le PREMESSE misurate. Sono la metà che muore in silenzio.
// ─────────────────────────────────────────────────────────────────────────────
function dichiarazioniPer(selettore) {
  const re = new RegExp(selettore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'g');
  const out = [];
  let m; while ((m = re.exec(APP))) out.push(m[1]);
  return out;
}

test('④ 🚨🚨 `.container` non dichiara overflow — o lo sticky si aggancia a LUI e muore in silenzio', () => {
  const regole = dichiarazioniPer('.container');
  assert.ok(regole.length > 0, 'non trovo nessuna regola per .container: la premessa non è più verificabile');
  for (const r of regole) {
    assert.doesNotMatch(r, /overflow(-x|-y)?\s*:\s*(hidden|auto|scroll|clip)/,
      'una regola di .container dichiara un overflow: la barra si aggancerebbe a quel riquadro '
      + 'invece che a main.main-content e smetterebbe di seguire lo scorrimento, SENZA rompere niente '
      + 'a voce alta. Regola trovata: «' + r.trim().slice(0, 120) + '»');
  }
});

test('⑤ `main.main-content` è ancora lo scroller (overflow-y:auto)', () => {
  const i = APP.indexOf('body.dashboard-view .main-content {');
  assert.ok(i > 0, 'la regola che rende .main-content lo scroller non c\'è più: senza scroller, '
    + 'lo sticky non ha niente a cui agganciarsi');
  const corpo = APP.slice(i, APP.indexOf('}', i));
  assert.match(corpo, /overflow-y\s*:\s*auto/,
    'main.main-content non è più `overflow-y:auto`: la premessa misurata della cura è caduta');
});

test('⑤ e la barra è davvero DENTRO .container (l\'antenato che è stato misurato)', () => {
  const bar = APP.indexOf('<nav class="pmo-chapter-bar"');
  assert.ok(bar > 0, 'la barra non si trova nel markup');
  const cont = APP.lastIndexOf('<div class="container">', bar);
  assert.ok(cont > 0 && cont < bar,
    'la barra non sta più dentro .container: la catena degli antenati misurata è cambiata, '
    + 'e con essa la ragione per cui lo sticky funziona');
});

console.log('\n' + passed + ' passati, ' + failed + ' falliti');
process.exit(failed ? 1 : 0);
