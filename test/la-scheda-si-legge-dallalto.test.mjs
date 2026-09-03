/* 🖼️ «La scheda della prenotazione si legge dall'alto» — banco della voce 127 (02/09/2026).
 *
 * 🚨 IL FATTO CHE LO FA NASCERE, segnalato da lui e poi MISURATO su PROD 6.276 con la console
 * remota: «quando clicco dentro una partita si apre la scheda della partita in maniera sbagliata,
 * non vedo la parte alta». Il titolo «Modifica prenotazione» finiva SOPRA il bordo del riquadro.
 * Non era tagliata dal CSS: era SCROLLATA. La chat dello staff ha un auto-scroll che dice
 * «se manca meno di 260px alla fine, incollati in fondo» — e una scheda che sborda di POCO ci
 * cade dentro tutta intera, portandosi via la testa.
 *
 * 📏 La misura che lo dimostra (stessa scheda, 4 giocatori, altezza del contenitore spazzata):
 *     eccedenza 281px → titolo VISIBILE      eccedenza 231px → TAGLIATO di 221px
 *     eccedenza 181px → TAGLIATO di 171px    eccedenza  81px → TAGLIATO di  71px
 *     eccedenza   0px → titolo VISIBILE
 * ⇒ colpisce **solo quando la scheda sborda di poco**, cioè sullo schermo normale: è il motivo per
 * cui non capitava sempre, e per cui rileggendo il CSS non si vedeva niente.
 *
 * ⚖️ QUESTO BANCO GUARDA IL FATTO, NON IL CSS, come chiedeva la scheda della voce: *la cima della
 * scheda dev'essere dentro il rettangolo visibile*. Non misura una larghezza, una classe o una
 * regola `@media` — quelle cambiano; il fatto no. Una guardia sul CSS sarebbe già stata smentita
 * due volte dalla guardia 11 (che leggeva anche le `@media` e accusava un layout giusto).
 *
 * ⛔ Quello che questo banco NON dice: gira senza browser, quindi prova la REGOLA (dove si deve
 * fermare lo scroll), non il RENDER. Che sulla pagina vera il titolo si veda lo dice la console
 * remota, ed è una misura, non un banco.
 *
 * Esegui:  node test/la-scheda-si-legge-dallalto.test.mjs
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

/** Estrae dall'app la funzione pura che decide dove fermare lo scroll, e la rende chiamabile.
 *  Si prova la funzione VERA dell'app, non una sua copia scritta qui: una copia si allinea al
 *  codice il giorno in cui la si scrive e mai più. */
function estraiTetto() {
  const i = APP.indexOf('function _svcTettoScroll(m) {');
  assert.ok(i > 0, '_svcTettoScroll non è più nell\'app: se è stata rinominata, questo banco va aggiornato con lei');
  // Conta le graffe finché la funzione non si chiude.
  let liv = 0, fine = -1;
  for (let k = i; k < APP.length; k++) {
    if (APP[k] === '{') liv++;
    else if (APP[k] === '}') { liv--; if (liv === 0) { fine = k + 1; break; } }
  }
  assert.ok(fine > i, 'non riesco a delimitare _svcTettoScroll');
  // eslint-disable-next-line no-new-func
  return new Function(APP.slice(i, fine) + '; return _svcTettoScroll;')();
}
const tetto = estraiTetto();

/** L'elenco delle schede protette, letto dall'app. */
function elencoSchede() {
  const m = APP.match(/const SVC_SCHEDE_CHE_SI_LEGGONO_DALLALTO = '([^']+)';/);
  assert.ok(m, 'SVC_SCHEDE_CHE_SI_LEGGONO_DALLALTO non c\'è più: se è stata rinominata, questo banco va aggiornato con lei');
  return m[1];
}

/* ── IL FATTO ────────────────────────────────────────────────────────────────
 * Con una scheda aperta, qualunque siano le misure, la cima della scheda deve restare dentro
 * il rettangolo visibile: `scrollTop <= cimaScheda`. */
test('con la scheda aperta la sua cima resta SEMPRE dentro il rettangolo visibile', () => {
  const contenuto = 1281;                       // la scheda misurata su PROD, 4 giocatori
  for (let visibile = 300; visibile <= 1400; visibile += 10) {
    for (const cima of [0, 37, 120, 260]) {     // scheda prima riga, o con messaggi sopra
      const y = tetto({ scrollHeight: contenuto, clientHeight: visibile, cimaScheda: cima });
      assert.ok(y <= cima + 0.001,
        `visibile=${visibile} cima=${cima}: lo scroll si ferma a ${y}, cioè ${Math.round(y - cima)}px oltre la cima della scheda`);
      assert.ok(y >= 0, `visibile=${visibile}: scroll negativo (${y})`);
    }
  }
});

test('i tre casi MISURATI su PROD che prima tagliavano il titolo, adesso non lo tagliano', () => {
  // eccedenza = contenuto - visibile. Prima: l'auto-scroll andava a `eccedenza` e il titolo
  // usciva sopra il bordo di quella stessa quantità.
  for (const [visibile, tagliavaDi] of [[1050, 231], [1100, 181], [1200, 81]]) {
    const y = tetto({ scrollHeight: 1281, clientHeight: visibile, cimaScheda: 0 });
    assert.equal(y, 0, `contenitore da ${visibile}px: prima tagliava di ${tagliavaDi}px, adesso lo scroll va a ${y}`);
  }
});

test('SENZA scheda la chat resta una chat: il messaggio nuovo va in fondo', () => {
  // È una decisione presa («WhatsApp: il messaggio nuovo va IN FONDO»), non un effetto collaterale:
  // il tetto vale SOLO dove c'è un modulo da leggere dall'alto.
  assert.equal(tetto({ scrollHeight: 1281, clientHeight: 700, cimaScheda: null }), 581);
  assert.equal(tetto({ scrollHeight: 400, clientHeight: 700, cimaScheda: null }), 0);
});

test('quando la scheda ci sta tutta non si scorre affatto', () => {
  assert.equal(tetto({ scrollHeight: 900, clientHeight: 1000, cimaScheda: 0 }), 0);
});

test('la scheda più alta dello schermo non fa scorrere OLTRE la sua cima', () => {
  // Il caso in cui la scheda comincia sotto un messaggio: si scorre fino a lei, non oltre.
  assert.equal(tetto({ scrollHeight: 2000, clientHeight: 700, cimaScheda: 120 }), 120);
});

/* ── LA CLASSE ───────────────────────────────────────────────────────────────
 * Il difetto non era in UN punto: `scrollTop = scrollHeight` compariva in cinque, e ne bastava
 * uno vivo per rimettere il titolo sopra il bordo. Chi ne aggiunge un sesto deve passare di qui. */
test('nessuno scrolla la chat dello staff «in fondo» DI PROPRIA INIZIATIVA', () => {
  const corpo = APP.slice(APP.indexOf('function svcAddMessage('));
  const colpevoli = [];
  const re = /(\w+)\.scrollTop\s*=\s*\1\.scrollHeight/g;
  for (const m of APP.matchAll(re)) colpevoli.push(m[0]);

  /* 🩹⭐⭐ 03/09/2026 — QUESTA GUARDIA È DIVENTATA ROSSA, E AVEVA RAGIONE A META'.
   *
   * La voce 134 ha aggiunto una pastiglia «↓ messaggio nuovo» che, CLICCATA, porta davvero in
   * fondo — scavalcando il tetto. Passando da `_svcAutoScroll` non farebbe niente: si fermerebbe
   * alla cima della scheda, cioè dove l'operatore è già.
   *
   * ⚖️ Il fatto che questa guardia difende non è «nessuno arriva mai in fondo»: è **nessuno ci va
   * senza che l'operatore l'abbia chiesto**. Il difetto della 127 era un salto deciso dal
   * PROGRAMMA mentre qualcuno leggeva; un dito su una pastiglia è l'esatto contrario — è la
   * persona che dice «portami di là».
   * ⇒ La guardia si riporta SUL FATTO: l'unico scavalco ammesso è dentro il gestore del click
   * della pastiglia, e resta **uno solo**. Allargarla a «ovunque» sarebbe stato allentarla, che
   * è come toglierla, solo più lentamente.
   * 📌 *Una guardia che si rompe su un caso legittimo va resa più PRECISA, non più permissiva.* */
  const dentroLaPastiglia = (() => {
    const i = APP.indexOf('function _svcPastiglia(');
    if (i < 0) return '';
    let g = 0, visto = false, out = '';
    for (let k = i; k < APP.length; k++) {
      const c = APP[k]; out += c;
      if (c === '{') { g++; visto = true; }
      else if (c === '}') { g--; if (visto && g === 0) break; }
    }
    return out;
  })();
  const ammessi = (dentroLaPastiglia.match(re) || []);
  assert.equal(ammessi.length, 1,
    'lo scavalco del tetto dentro la pastiglia dev\'essere UNO: è l\'eccezione, non una porta aperta');
  assert.ok(/addEventListener\('click'/.test(dentroLaPastiglia),
    'lo scavalco è lecito solo perché sta dietro un CLICK: senza il gestore, è di nuovo un salto deciso dal programma');

  const abusivi = colpevoli.filter((c) => !ammessi.includes(c));
  assert.deepEqual(abusivi, [],
    'trovato un auto-scroll che va in fondo di propria iniziativa: ' + abusivi.join(', ')
    + ' — usa _svcAutoScroll(contenitore), o il titolo della scheda tornerà sopra il bordo');
  assert.ok(corpo.length > 0);
});

test('_svcAutoScroll riconosce la scheda dal BOX, non dalla bolla', () => {
  // staffCalBringEditorToTop sposta il `.svc-edit-box` in fondo al contenitore, FUORI dalla sua
  // bolla `.svc-edit-host`: una guardia agganciata all'host perderebbe la scheda proprio nel
  // percorso dell'assistente (aggiunta/rimozione giocatore), che è uno di quelli che scrolla.
  assert.ok(elencoSchede().includes('.svc-edit-box'),
    'l\'elenco deve contenere `.svc-edit-box`: agganciato a `.svc-edit-host` perde la scheda spostata da staffCalBringEditorToTop');
});

/* ── LA FAMIGLIA ─────────────────────────────────────────────────────────────
 * 🚨 Il 02/09 il tetto proteggeva UNA scheda — quella della partita — e il 03/09 lui ha segnalato
 * lo stesso identico difetto sulla scheda «Nuova prenotazione», che è un'altra classe. La cura era
 * giusta, l'ELENCO era corto.
 * 📌 *Una cura si scrive sulla famiglia, non sull'esemplare che si aveva davanti* — e finché la
 * famiglia è un elenco scritto a mano, l'unica cosa che tiene onesto l'elenco è un banco che
 * conta i membri da sé invece di fidarsi. */
test('OGNI scheda che l\'app crea nella chat sta nell\'elenco protetto', () => {
  const elenco = elencoSchede();
  // Le schede che il codice crea davvero: una classe `svc-…-card` / `svc-…-box` messa a un
  // elemento. Contate dal sorgente, non elencate qui: una lista scritta a mano in un banco ha
  // esattamente lo stesso difetto della lista che il banco deve sorvegliare.
  const create = new Set();
  for (const m of APP.matchAll(/(?:classList\.add\(|className\s*=\s*)'(svc-[a-z0-9-]*(?:card|box))'/g)) create.add(m[1]);
  assert.ok(create.size >= 2, 'non trovo più le schede nel sorgente: è cambiato il modo di crearle, e questo banco non sa più contarle');
  const fuori = [...create].filter((c) => !elenco.includes('.' + c));
  assert.deepEqual(fuori, [],
    'queste schede si aprirebbero TAGLIATE IN ALTO perché non sono nell\'elenco SVC_SCHEDE_CHE_SI_LEGGONO_DALLALTO: '
    + fuori.map((c) => '.' + c).join(', '));
});

test('le BOLLE dei messaggi NON entrano nell\'elenco: la chat resta una chat', () => {
  // Se `.svc-msg` finisse lì dentro, il tetto si aggancerebbe al primo messaggio e nessun
  // messaggio nuovo andrebbe più in fondo — cioè si romperebbe una decisione presa.
  const elenco = elencoSchede();
  assert.ok(!/\.svc-msg\b/.test(elenco),
    '`.svc-msg` è una riga di chat, non un modulo da leggere dall\'alto: nell\'elenco romperebbe l\'auto-scroll dei messaggi');
});

test('l\'observer non strappa MAI verso l\'alto chi sta leggendo', () => {
  // La nota «⏳ Aggiorno la lista giocatori… (Ns)» riscrive sé stessa ogni secondo ⇒ l'observer
  // riparte ogni secondo per un minuto. Senza `soloInGiu` riporterebbe su l'operatore che scorre.
  const i = APP.indexOf('const obs = new MutationObserver(');
  assert.ok(i > 0, 'observer dell\'auto-scroll non trovato');
  const corpo = APP.slice(i, i + 400);
  assert.ok(/_svcAutoScroll\(container,\s*true\)/.test(corpo),
    'l\'observer deve chiamare _svcAutoScroll(container, true): senza `soloInGiu` strappa indietro chi sta leggendo la scheda');
});

console.log('\n' + passed + ' passati, ' + failed + ' falliti');
process.exit(failed ? 1 : 0);
