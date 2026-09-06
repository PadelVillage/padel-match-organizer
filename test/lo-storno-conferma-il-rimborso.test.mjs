// lo-storno-conferma-il-rimborso.test.mjs — VOCE 171, lo STORNO (06/09/2026)
//
// 🎯 COSA DIFENDE. Dopo «Anular», Matchpoint apre in un fancybox la finestra
// `Facturacion/SeleccionFormaPago.aspx` — «Con quale metodo di pagamento desidera effettuare il
// rimborso?», predefinito *Usa stesso metodo di pagamento del documento*, con «Accettare» e
// «Annullare». Quella finestra COPRE la pagina: è per questo che il «Salvare» della scheda
// risultava non cliccabile (SAVE_BUTTON_CLICK_TIMEOUT) — non perché mancasse.
// 📏 Misurato su PROD tre volte, con il pagamento che restava in piedi ogni volta.
//
// 📌 È la TERZA volta che lo stesso difetto si ripresenta in una sera: un gesto cercato nella
// stanza sbagliata. La lezione non è «il dialog è un iframe» — è «prima di cercare, guarda dove sei».
//
// ⛔ QUELLO CHE QUESTO BANCO NON DICE: che lo storno vero arrivi in fondo su Matchpoint. Dice che
// si preme «Accettare» nella finestra giusta, senza toccare i radio, e che non si inventa un
// esito quando quella finestra non c'è.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const sorgente = readFileSync(join(QUI, '..', 'tools', 'matchpoint-browser-worker', 'src', 'server.mjs'), 'utf8');

function ritaglia(da) {
  let i = sorgente.indexOf('{', da), graffe = 0;
  for (let j = i; j < sorgente.length; j++) {
    if (sorgente[j] === '{') graffe++;
    else if (sorgente[j] === '}') { graffe--; if (!graffe) return sorgente.slice(da, j + 1); }
  }
  throw new Error('blocco non chiuso');
}
function fn(nome) {
  const inizio = sorgente.indexOf(`async function ${nome}(`);
  if (inizio < 0) throw new Error(`«${nome}» non trovata`);
  let i = sorgente.indexOf('{', sorgente.indexOf(')', inizio)), graffe = 0;
  for (let j = i; j < sorgente.length; j++) {
    if (sorgente[j] === '{') graffe++;
    else if (sorgente[j] === '}') { graffe--; if (!graffe) return sorgente.slice(inizio, j + 1); }
  }
  throw new Error(`«${nome}» non chiusa`);
}
const cost = (nome) => sorgente.slice(sorgente.indexOf(`const ${nome} = {`), sorgente.indexOf('};', sorgente.indexOf(`const ${nome} = {`)) + 2);

const ctx = vm.createContext({ fail: (code, message, diagnostic) => Object.assign(new Error(message), { code, diagnostic }) });
vm.runInContext(`${cost('MP_PAYMENT_SELECTORS')}\n${fn('_collectCobroCandidates')}\n${fn('_confermaRimborso')}\nglobalThis.__f = { _confermaRimborso, MP_PAYMENT_SELECTORS };`, ctx);
const { _confermaRimborso, MP_PAYMENT_SELECTORS } = ctx.__f;

const URL_RIMBORSO = 'https://mp/Facturacion/SeleccionFormaPago.aspx?modo=fancy&showMessage=true&cbf=callBackFancy';

function frame(url, bottoni = []) {
  const registro = { click: 0, provati: [] };
  return {
    registro, url: () => url, name: () => 'f',
    evaluate: async () => ({ bodyText: 'Con quale metodo di pagamento desidera effettuare il rimborso?', cliccabili: [], iframes: [] }),
    locator: (sel) => ({
      count: async () => { registro.provati.push(sel); return bottoni.some((b) => sel.includes(b)) ? 1 : 0; },
      first: () => ({ click: async () => { registro.click++; } }),
    }),
  };
}
function pagina({ finestra = true, bottoni = ['CC_Datos_ButtonAceptar'] } = {}) {
  const principale = frame('https://mp/Reservas/FichaPartida.aspx');
  const rimborso = frame(URL_RIMBORSO, bottoni);
  return {
    principale, rimborso,
    mainFrame: () => principale,
    frames: () => (finestra ? [principale, rimborso] : [principale]),
    waitForTimeout: async () => {},
  };
}
const diag = () => ({ steps: [] });

test('① la finestra del rimborso c\'è → si preme «Accettare» lì dentro', async () => {
  const page = pagina();
  const d = diag();
  assert.equal(await _confermaRimborso(page, d), true);
  assert.equal(page.rimborso.registro.click, 1);
  assert.equal(page.principale.registro.click, 0, 'non si clicca nella pagina coperta');
  assert.ok(d.steps.includes('storno_rimborso_accetta'));
});

test('② si prova PRIMA l\'id, e non si toccano i radio del metodo', async () => {
  const page = pagina();
  await _confermaRimborso(page, diag());
  assert.equal(page.rimborso.registro.provati[0], MP_PAYMENT_SELECTORS.stornoRimborsoBtn);
  assert.ok(!page.rimborso.registro.provati.some((s) => /radio|Contanti|Carta|Saldo/i.test(s)),
    'il predefinito «stesso metodo del documento» si lascia com\'è');
});

test('③ nessuna finestra → torna false senza inventare un esito', async () => {
  const page = pagina({ finestra: false });
  const d = diag();
  assert.equal(await _confermaRimborso(page, d), false);
  assert.ok(d.steps.includes('storno_rimborso:assente'));
});

test('④ finestra senza «Accettare» → si ferma e consegna la lista', async () => {
  const page = pagina({ bottoni: [] });
  const err = await _confermaRimborso(page, diag()).then(() => null, (e) => e);
  assert.ok(err, 'doveva fermarsi');
  assert.equal(err.code, 'STORNO_RIMBORSO_SENZA_BOTTONE');
  assert.ok(Array.isArray(err.diagnostic.candidatiInRimborso));
  assert.equal(page.rimborso.registro.click, 0);
});
