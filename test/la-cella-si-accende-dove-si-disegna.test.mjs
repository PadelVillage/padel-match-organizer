/* 🚦 «La cella si accende dove il calendario si DISEGNA» — banco della cura ⑤ della voce 137.
 *
 * 🩹⭐⭐ IL DIFETTO CHE QUESTO BANCO FERMA, ed è rimasto invisibile due giorni: le coordinate
 * della voce 137 ④ («ogni cella dichiara DOVE si trova») erano state messe in
 * `_staffCalBuildGrid` — una funzione **che nessuno chiama**. `renderStaffCalendar` manda su
 * `_staffCalBuildHorizontal` in TUTTI E DUE i rami, computer e telefono. ⇒ `svcAccendiCella`
 * cercava `.cell[data-campo]` in una griglia che non ne ha nemmeno una, e la cella non poteva
 * accendersi in nessun caso — su nessun ambiente, su nessuno schermo.
 *
 * 📏 Misurato sulla pagina viva di PROD 6.357 il 05/09/2026, con la console remota:
 * `.cell` → **0**, `[data-campo]` → **0**, `[data-ora]` → **0**, dentro un
 * `#staffCalGridTable` che di `div` ne aveva **118**. Non era una sonda cieca: era la griglia
 * a essere fatta di un'altra cosa.
 *
 * 📌 *Un pezzo di codice che nessuno chiama non è «da provare»: è già rotto, e la prova che
 * manca è l'unica cosa che lo direbbe.*
 *
 * ⛔ QUELLO CHE QUESTO BANCO **NON** DICE: che la cella si veda accendersi. Gira senza browser
 * ⇒ prova che i selettori e la disposizione che li produce **parlano della stessa cosa**. Che
 * poi si accenda davanti agli occhi lo dice la console remota sulla pagina viva.
 *
 * Esegui:  node test/la-cella-si-accende-dove-si-disegna.test.mjs
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

/** Le sole righe di CODICE: senza questo, la guardia che vieta una parola darebbe l'allarme sul
 *  commento che spiega perché quella parola è vietata.
 *
 *  🩹⭐⭐ E NON SI FILTRA PER RIGA, che è come i banchi vicini lo fanno e come questo l'ha
 *  sbagliato al primo giro. Buttare via le righe che COMINCIANO per `//`, `*` o `/*` lascia
 *  dentro le righe di MEZZO di un commento lungo — quelle che vanno a capo e ricominciano con
 *  una parola qualunque. ⇒ La prima corsa di questo banco è caduta su una frase **mia**, scritta
 *  dieci righe più su per spiegare il difetto: nominava `.cell[data-campo]` per dire che non si
 *  usa più, e la guardia l'ha contata come un uso.
 *  📌 *Una guardia che legge i commenti finisce per accusare chi ha scritto la difesa* — ed è la
 *  terza volta in tre giorni. Qui si taglia per STRUTTURA: i `/* … *\/` spariscono interi,
 *  qualunque forma abbiano le righe dentro. */
function soloCodice(testo) {
  return String(testo)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').filter(function (r) { return !/^\s*\/\//.test(r); })
    .join('\n');
}

/** Il corpo di `function nome(`, contando le graffe dalla PRIMA del corpo. */
function corpoDi(nome, testo = APP) {
  const i = testo.indexOf('function ' + nome + '(');
  assert.ok(i > 0, 'funzione non trovata: ' + nome);
  const apre = testo.indexOf(') {', i);
  assert.ok(apre > i, 'firma inattesa: ' + nome);
  let g = 0, visto = false, out = '';
  for (let k = apre + 2; k < testo.length; k++) {
    const c = testo[k];
    out += c;
    if (c === '{') { g++; visto = true; }
    else if (c === '}') { g--; if (visto && g === 0) break; }
  }
  return out;
}

/* ─────────────────────────────────────────────────────────────────────────────
   ① CHI DISEGNA DAVVERO — la domanda che nessuno aveva fatto
   ───────────────────────────────────────────────────────────────────────────── */

test('renderStaffCalendar disegna SOLO con _staffCalBuildHorizontal, su tutti e due i rami', () => {
  const corpo = soloCodice(corpoDi('renderStaffCalendar'));
  assert.ok(/_staffCalBuildHorizontal\(isoDate, true\)/.test(corpo), 'manca il ramo computer');
  assert.ok(/_staffCalBuildHorizontal\(isoDate, false\)/.test(corpo), 'manca il ramo telefono');
  assert.ok(!/_staffCalBuildGrid\(/.test(corpo),
    'renderStaffCalendar chiama _staffCalBuildGrid: se un domani succede, questo banco va rifatto');
});

test('_staffCalBuildGrid resta MORTA: se qualcuno la chiama, questo banco lo dice', () => {
  const chiamate = soloCodice(APP).match(/_staffCalBuildGrid\s*\(/g) || [];
  // Una sola occorrenza = la definizione. Due o più = qualcuno la chiama davvero.
  assert.equal(chiamate.length, 1,
    'qualcuno chiama _staffCalBuildGrid: le coordinate vanno messe anche là, o le due disposizioni divergono');
});

/* ─────────────────────────────────────────────────────────────────────────────
   ② LE COORDINATE STANNO DOVE SI DISEGNA
   ───────────────────────────────────────────────────────────────────────────── */

test('la disposizione orizzontale marca i pezzi: campo + intervallo in minuti', () => {
  const corpo = soloCodice(corpoDi('_staffCalBuildHorizontal'));
  assert.ok(/dataset\.campo\s*=/.test(corpo), 'nessun campo dichiarato');
  assert.ok(/dataset\.minDa\s*=/.test(corpo) && /dataset\.minA\s*=/.test(corpo),
    'nessun intervallo dichiarato: senza, un gesto sulle 09:30 non trova la partita delle 09:00');
});

test('sia il LIBERO sia la PARTITA portano le coordinate', () => {
  const corpo = soloCodice(corpoDi('_staffCalBuildHorizontal'));
  assert.ok(/const seg = _coord\(/.test(corpo),
    'il segmento LIBERO non ha coordinate: una prenotazione nuova non avrebbe nessuna cella da accendere');
  assert.ok(/const blk = _coord\(/.test(corpo),
    'il blocco PRENOTATO non ha coordinate: una modifica non avrebbe nessuna cella da accendere');
});

/* ─────────────────────────────────────────────────────────────────────────────
   ③ CHI CERCA E CHI DISEGNA PARLANO DELLA STESSA COSA
   ───────────────────────────────────────────────────────────────────────────── */

test('nessuno cerca più `.cell[data-campo]`, che nella pagina viva non esiste', () => {
  const codice = soloCodice(APP);
  assert.ok(!/\.cell\[data-campo/.test(codice),
    'resta un selettore `.cell[data-campo]`: cerca una classe che solo la funzione morta produce');
});

test('la ricerca è UNA SOLA, e la usano tutti e due', () => {
  const accendi = soloCodice(corpoDi('svcAccendiCella'));
  const pastiglia = soloCodice(corpoDi('svcApriDallaPastiglia'));
  assert.ok(/svcCellaDelleCoordinate\(/.test(accendi), 'svcAccendiCella non usa la ricerca comune');
  assert.ok(/svcCellaDelleCoordinate\(/.test(pastiglia), 'svcApriDallaPastiglia non usa la ricerca comune');
});

test("lo stile dell'accesa non è più legato a `.cell`", () => {
  assert.ok(/#staffCalV36 \.svc-cella-attiva \{/.test(APP),
    'la regola CSS nomina ancora `.cell`: sarebbe spenta quanto il selettore che curava');
});

/* ─────────────────────────────────────────────────────────────────────────────
   ④ LA REGOLA, ESEGUITA — non riletta
   ───────────────────────────────────────────────────────────────────────────── */

/** La ricerca vera, ritagliata dall'app ed eseguita qui. Così il banco prova IL CODICE IN
 *  SERVIZIO e non una copia: una copia resta verde mentre l'originale si rompe. */
const svcCellaDelleCoordinate = new Function(
  'griglia', 'dove', corpoDi('svcCellaDelleCoordinate').replace(/^\{|\}$/g, ''),
);

function grigliaFinta(pezzi) {
  const nodi = pezzi.map((p) => ({ dataset: { campo: String(p.campo), minDa: String(p.da), minA: String(p.a) }, nome: p.nome }));
  return {
    querySelectorAll(sel) {
      const m = /data-campo="(\d+)"/.exec(sel);
      const campo = m ? m[1] : null;
      return nodi.filter((n) => n.dataset.campo === campo && n.dataset.minDa !== undefined);
    },
  };
}

const GRIGLIA = grigliaFinta([
  { campo: 1, da: 480, a: 540, nome: 'C1 libero 08:00–09:00' },
  { campo: 1, da: 540, a: 630, nome: 'C1 partita 09:00–10:30' },
  { campo: 1, da: 630, a: 1380, nome: 'C1 libero 10:30–23:00' },
  { campo: 2, da: 540, a: 630, nome: 'C2 partita 09:00–10:30' },
]);

test("un gesto sull'ora d'inizio accende quel pezzo", () => {
  const c = svcCellaDelleCoordinate(GRIGLIA, { campo: 1, ora: '09:00' });
  assert.equal(c && c.nome, 'C1 partita 09:00–10:30');
});

test('⭐ un gesto DENTRO la durata accende lo stesso pezzo, non quello che comincia lì', () => {
  // È la ragione per cui si scrive un intervallo: una partita di 90 minuti è UN segmento largo,
  // e un gesto sulle 09:30 cadrebbe fuori da qualunque confronto per uguaglianza.
  const c = svcCellaDelleCoordinate(GRIGLIA, { campo: 1, ora: '09:30' });
  assert.equal(c && c.nome, 'C1 partita 09:00–10:30');
});

test('il confine appartiene a chi comincia, non a chi finisce', () => {
  const c = svcCellaDelleCoordinate(GRIGLIA, { campo: 1, ora: '10:30' });
  assert.equal(c && c.nome, 'C1 libero 10:30–23:00');
});

test('il campo conta: la stessa ora su un altro campo è un altro pezzo', () => {
  const c = svcCellaDelleCoordinate(GRIGLIA, { campo: 2, ora: '09:30' });
  assert.equal(c && c.nome, 'C2 partita 09:00–10:30');
});

test('🚨 FALLISCE CHIUSA: coordinate mezze o orario illeggibile non accendono niente', () => {
  assert.equal(svcCellaDelleCoordinate(GRIGLIA, { campo: 1 }), null, 'senza ora');
  assert.equal(svcCellaDelleCoordinate(GRIGLIA, { ora: '09:00' }), null, 'senza campo');
  assert.equal(svcCellaDelleCoordinate(GRIGLIA, { campo: 1, ora: 'mattina' }), null, 'ora illeggibile');
  // 🚨⭐ LA RIGA CHE IL SABOTAGGIO HA SCOPERTO, ed è l'unica per cui il controllo di forma serve
  //    davvero: `'mattina'` si spegne DA SÉ (diventa il minuto 0, che non cade in nessun pezzo),
  //    quindi togliere la guardia non faceva cadere niente — il banco passava per fortuna.
  //    `'9'` no: senza i minuti diventa **540**, cioè le 09:00 in punto, e accenderebbe la
  //    partita delle nove su una coordinata che non ha mai detto le nove.
  //    📌 *Un caso che si difende da solo non prova la difesa: la prova sta nel caso che, senza,
  //       passerebbe come buono.*
  assert.equal(svcCellaDelleCoordinate(GRIGLIA, { campo: 1, ora: '9' }), null, "un'ora senza minuti non è le 09:00");
  assert.equal(svcCellaDelleCoordinate(GRIGLIA, { campo: 1, ora: '09:00:00' }), null, 'una forma che non è la nostra');
  assert.equal(svcCellaDelleCoordinate(GRIGLIA, null), null, 'niente coordinate');
  assert.equal(svcCellaDelleCoordinate(GRIGLIA, { campo: 9, ora: '09:00' }), null, 'campo che non c\'è');
  assert.equal(svcCellaDelleCoordinate(GRIGLIA, { campo: 1, ora: '02:00' }), null, 'ora fuori da ogni pezzo');
});

console.log('\n' + passed + ' passati, ' + failed + ' falliti');
process.exit(failed ? 1 : 0);
