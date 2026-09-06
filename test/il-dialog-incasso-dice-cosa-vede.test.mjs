// il-dialog-incasso-dice-cosa-vede.test.mjs — VOCE 171, la SONDA (06/09/2026)
//
// 🎯 COSA DIFENDE. L'incasso dalla scheda partita è rotto su PROD per OGNI metodo: due tentativi
// veri, `wallet` e `cash`, hanno risposto tutti e due «Pulsante metodo … non trovato nel dialog
// incasso». Il worker però diceva solo QUALE cercava, mai QUALI vedeva ⇒ ogni diagnosi successiva
// sarebbe stata un altro tentativo alla cieca su una cassa vera.
// 📌 Una sonda che dice cosa cercava e non cosa ha trovato trasforma ogni diagnosi in un tentativo.
//
// 🚨 E LA SECONDA COSA, che non stava fra le tre ipotesi della scheda: il worker aspettava il
// dialog **400 ms fissi**. Un'attesa fissa non distingue «non c'è» da «non c'è ANCORA», e le due
// vogliono cure opposte — quindi ora aspetta finché non compare, e DICE quale dei due era.
//
// 🚨 LE PROVE SONO SUL COMPORTAMENTO: le funzioni si ESTRAGGONO da `server.mjs` e si ESEGUONO con
// un doppio del `page`. Un banco che cercasse la stringa `cobroCandidates` resterebbe verde davanti
// a un ramo mai percorso.
//
// ⛔ QUELLO CHE QUESTO BANCO NON DICE: perché il dialog non si apra su Matchpoint. Dice che quando
// non si apre il worker consegna l'elenco di cosa c'era, iframe compresi. La causa la dirà quella
// lista, letta dopo un tentativo vero.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const sorgente = readFileSync(join(QUI, '..', 'tools', 'matchpoint-browser-worker', 'src', 'server.mjs'), 'utf8');

// `server.mjs` avvia un server quando lo si importa: le funzioni si ritagliano dal testo.
function estrai(nome) {
  const inizio = sorgente.indexOf(`async function ${nome}(`);
  if (inizio < 0) throw new Error(`funzione «${nome}» non trovata in server.mjs`);
  let i = sorgente.indexOf('{', sorgente.indexOf(')', inizio));
  let graffe = 0;
  for (let j = i; j < sorgente.length; j++) {
    if (sorgente[j] === '{') graffe++;
    else if (sorgente[j] === '}') { graffe--; if (!graffe) return sorgente.slice(inizio, j + 1); }
  }
  throw new Error(`funzione «${nome}» non chiusa`);
}

// `fail` è la sola dipendenza esterna delle due funzioni: qui la si fabbrica uguale nella forma
// (codice + messaggio + diagnostica attaccata all'errore).
const contesto = vm.createContext({
  fail: (code, message, diagnostic) => Object.assign(new Error(message), { code, diagnostic }),
});
vm.runInContext(`${estrai('_collectCobroCandidates')}\n${estrai('_clickCobroMethod')}\nglobalThis.__f = { _clickCobroMethod, _collectCobroCandidates };`, contesto);
const { _clickCobroMethod, _collectCobroCandidates } = contesto.__f;

// ── Doppio del `page` di Playwright, ridotto a ciò che le due funzioni usano ────────────────────
// `comparsaAlGiro`: da quale interrogazione in poi il metodo «esiste» (0 = subito, ∞ = mai).
function fintaPagina({ comparsaAlGiro = 0, clickEsplode = false, frames = [] } = {}) {
  const registro = { count: 0, click: 0, attese: [], evaluate: 0 };
  const page = {
    registro,
    locator(sel) {
      return {
        count: async () => { registro.count++; return registro.count > comparsaAlGiro ? 1 : 0; },
        first: () => ({
          click: async () => {
            registro.click++;
            if (clickEsplode) throw new Error('elemento coperto da un overlay');
          },
        }),
      };
    },
    waitForTimeout: async (ms) => { registro.attese.push(ms); },
    mainFrame: () => frames[0],
    frames: () => frames,
  };
  return page;
}

function fintoFrame(url, name, risposta) {
  return { url: () => url, name: () => name, evaluate: async () => risposta };
}

const CONTENUTO_VUOTO = { bodyText: 'Scheda partita', cliccabili: [{ tag: 'a', id: 'Cobrar_2', testo: 'Incassare' }], iframes: [] };
const CONTENUTO_DIALOG = { bodyText: 'Forma di pagamento', cliccabili: [{ tag: 'button', id: 'btnEfectivo', testo: 'Contanti' }], iframes: [] };

function pagineConFrame(opts = {}) {
  const principale = fintoFrame('https://mp/Reservas/FichaPartida.aspx?id=9844', '', CONTENUTO_VUOTO);
  const dialogo = fintoFrame('https://mp/Reservas/FichaCobro.aspx?id=9844', 'fancybox-frame', CONTENUTO_DIALOG);
  return fintaPagina(Object.assign({ frames: [principale, dialogo] }, opts));
}

const diag = () => ({ steps: [] });

// ── ① il metodo c'è subito: si clicca e non si raccoglie niente ─────────────────────────────────
test('① metodo presente subito → click, nessuna raccolta', async () => {
  const page = pagineConFrame({ comparsaAlGiro: 0 });
  const d = diag();
  await _clickCobroMethod(page, 'Contanti', d);
  assert.equal(page.registro.click, 1);
  assert.equal(page.registro.evaluate, 0);
  assert.ok(d.steps.some((s) => s.startsWith('cobro_method:Contanti:giro1')), d.steps.join('|'));
});

// ── ② il dialog arriva TARDI: è il caso che i 400 ms fissi perdevano ────────────────────────────
test('② dialog lento (comparsa dopo alcune interrogazioni) → si aspetta e si clicca', async () => {
  const page = pagineConFrame({ comparsaAlGiro: 9 });   // ~3 giri da 4 selettori
  const d = diag();
  await _clickCobroMethod(page, 'Contanti', d);
  assert.equal(page.registro.click, 1, 'ha cliccato una volta sola');
  assert.ok(d.steps.some((s) => /cobro_method:Contanti:giro[2-9]/.test(s)), d.steps.join('|'));
});

// ── ③ non compare MAI: fallisce DICENDO cosa ha visto ───────────────────────────────────────────
test('③ mai comparso → FORMA_PAGO_NON_TROVATA con l\'elenco di cosa c\'era', async () => {
  const page = pagineConFrame({ comparsaAlGiro: Infinity });
  const d = diag();
  const err = await _clickCobroMethod(page, 'Contanti', d).then(() => null, (e) => e);
  assert.ok(err, 'doveva fallire');
  assert.equal(err.code, 'FORMA_PAGO_NON_TROVATA');
  assert.equal(err.diagnostic.cobroEsito, 'mai_comparso');
  assert.ok(Array.isArray(err.diagnostic.cobroCandidates), 'la lista dev\'esserci');
  assert.equal(err.diagnostic.cobroCandidates.length, 2, 'un contesto per frame');
  assert.equal(page.registro.click, 0, 'non ha cliccato niente');
});

// ── ④ trovato ma non cliccabile: si esce SUBITO (l'incasso non è idempotente) ───────────────────
test('④ trovato ma il click esplode → un solo tentativo, e lo dichiara', async () => {
  const page = pagineConFrame({ comparsaAlGiro: 0, clickEsplode: true });
  const d = diag();
  const err = await _clickCobroMethod(page, 'Contanti', d).then(() => null, (e) => e);
  assert.ok(err, 'doveva fallire');
  assert.equal(err.diagnostic.cobroEsito, 'trovato_non_cliccabile');
  assert.equal(err.diagnostic.cobroGiri, 1, 'un giro solo: non si ritenta un click che poteva passare');
  assert.ok(page.registro.click <= 4, 'al massimo i selettori di un giro, mai un secondo giro');
});

// ── ⑤ la raccolta guarda DENTRO gli iframe: è lì che vivono i dialog di Matchpoint ──────────────
test('⑤ la raccolta elenca anche i frame non principali', async () => {
  const page = pagineConFrame({ comparsaAlGiro: Infinity });
  const contesti = await _collectCobroCandidates(page);
  assert.equal(contesti.length, 2);
  assert.equal(contesti[0].main, true);
  assert.equal(contesti[1].main, false);
  assert.match(contesti[1].url, /FichaCobro/);
  assert.equal(contesti[1].cliccabili[0].testo, 'Contanti', 'il metodo era nel frame, e la sonda lo mostra');
});

// ── ⑥ un frame che rifiuta di farsi leggere non fa cadere la sonda ──────────────────────────────
test('⑥ un frame che esplode → si annota l\'errore, gli altri si leggono lo stesso', async () => {
  const rotto = { url: () => 'https://mp/altro', name: () => '', evaluate: async () => { throw new Error('cross-origin'); } };
  const buono = fintoFrame('https://mp/Reservas/FichaPartida.aspx', '', CONTENUTO_VUOTO);
  const page = fintaPagina({ comparsaAlGiro: Infinity, frames: [buono, rotto] });
  const contesti = await _collectCobroCandidates(page);
  assert.equal(contesti.length, 2);
  assert.match(contesti[1].err, /cross-origin/);
  assert.ok(contesti[0].cliccabili.length, 'il frame buono si è letto lo stesso');
});

// ── ⑦ la sonda è in SOLA LETTURA: guarda e non clicca ───────────────────────────────────────────
test('⑦ la raccolta non clicca niente', async () => {
  const page = pagineConFrame({ comparsaAlGiro: 0 });
  await _collectCobroCandidates(page);
  assert.equal(page.registro.click, 0);
});
