// la-cassa-dice-quanto-e-a-chi.test.mjs — VOCE 171, terzo gradino (06/09/2026)
//
// 🎯 COSA DIFENDE. Il cobro non si conferma con l'«Actualizar» della scheda: si conferma nella
// CASSA, un terzo iframe che si apre dentro il dialog dopo il click sul metodo —
// `cobro/AyudaCobroEfectivo.aspx?importe=8,00&idpeople=301&…`, con «Annullare», «Incassare» e
// «Incassare e stampare». 📏 Misurato su PROD due volte: senza quel passo il pendente resta
// intero e il gesto muore in SAVE_BUTTON_CLICK_TIMEOUT.
//
// ⭐⭐ E QUELL'URL PORTA IMPORTO E PERSONA — scritti da Matchpoint, leggibili PRIMA di premere.
// È la guardia più forte che questo gesto possa avere: è l'unico istante in cui si può sapere
// cosa si sta per incassare e a chi **mentre si è ancora in tempo a non farlo**.
//
// 🚨 LE PROVE SONO SUL COMPORTAMENTO: la funzione si ESTRAE da `server.mjs` e si ESEGUE con un
// doppio del `page`. E il caso che conta di più è quello in cui NON si preme.
//
// ⛔ QUELLO CHE QUESTO BANCO NON DICE: che l'incasso vero vada a buon fine su Matchpoint. Dice
// che si preme il bottone giusto quando i conti tornano, e che non si preme quando non tornano.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const sorgente = readFileSync(join(QUI, '..', 'tools', 'matchpoint-browser-worker', 'src', 'server.mjs'), 'utf8');

function ritaglia(inizio) {
  let i = sorgente.indexOf('{', inizio);
  let graffe = 0;
  for (let j = i; j < sorgente.length; j++) {
    if (sorgente[j] === '{') graffe++;
    else if (sorgente[j] === '}') { graffe--; if (!graffe) return sorgente.slice(inizio, j + 1); }
  }
  throw new Error('blocco non chiuso');
}
// Dal nome alla graffa bilanciata che chiude la funzione.
function estraiFn(nome, pref = 'async function') {
  const inizio = sorgente.indexOf(`${pref} ${nome}(`);
  if (inizio < 0) throw new Error(`funzione «${nome}» non trovata in server.mjs`);
  let i = sorgente.indexOf('{', sorgente.indexOf(')', inizio));
  let graffe = 0;
  for (let j = i; j < sorgente.length; j++) {
    if (sorgente[j] === '{') graffe++;
    else if (sorgente[j] === '}') { graffe--; if (!graffe) return sorgente.slice(inizio, j + 1); }
  }
  throw new Error(`funzione «${nome}» non chiusa`);
}
function estraiCost(nome) {
  const inizio = sorgente.indexOf(`const ${nome} = {`);
  if (inizio < 0) throw new Error(`«${nome}» non trovata`);
  return ritaglia(inizio) && sorgente.slice(inizio, sorgente.indexOf('};', inizio) + 2);
}

const contesto = vm.createContext({
  fail: (code, message, diagnostic) => Object.assign(new Error(message), { code, diagnostic }),
});
vm.runInContext(
  `${estraiCost('MP_PAYMENT_SELECTORS')}\n${estraiFn('mpMoneyToCents', 'function')}\n`
  + `${estraiFn('_collectCobroCandidates')}\n${estraiFn('_confermaCobroInCassa')}\n`
  + 'globalThis.__f = { _confermaCobroInCassa, MP_PAYMENT_SELECTORS };',
  contesto,
);
const { _confermaCobroInCassa, MP_PAYMENT_SELECTORS } = contesto.__f;

const BASE = 'https://mp/cobro/AyudaCobroEfectivo.aspx?modo=fancy';
const urlCassa = (importe, idpeople) => `${BASE}&importe=${encodeURIComponent(importe)}&idpeople=${idpeople}&cbf=callbackCobro`;

function fintoFrame(url, { bottoni = [], clickEsplode = false } = {}) {
  const registro = { click: 0, provati: [] };
  return {
    registro,
    url: () => url,
    name: () => 'f',
    evaluate: async () => ({ bodyText: 'Cassa Principale', cliccabili: [], iframes: [] }),
    locator: (sel) => ({
      count: async () => { registro.provati.push(sel); return bottoni.some((b) => sel.includes(b)) ? 1 : 0; },
      first: () => ({ click: async () => { registro.click++; if (clickEsplode) throw new Error('coperto'); } }),
    }),
  };
}

function pagina({ cassa = true, importe = '8,00', idpeople = '301', bottoni = ['CC_Datos_ButtonSoloCobrar'] } = {}) {
  const principale = fintoFrame('https://mp/Reservas/FichaPartida.aspx');
  const frameCassa = fintoFrame(urlCassa(importe, idpeople), { bottoni });
  const registro = { attese: [] };
  return {
    registro, cassa: frameCassa, principale,
    mainFrame: () => principale,
    frames: () => (cassa ? [principale, frameCassa] : [principale]),
    waitForTimeout: async (ms) => { registro.attese.push(ms); },
  };
}

const diag = () => ({ steps: [] });

// ── ① il caso normale: i conti tornano, si preme «Incassare» ─────────────────────────────────
test('① importo e persona giusti → si conferma nella cassa', async () => {
  const page = pagina();
  const d = diag();
  const esito = await _confermaCobroInCassa(page, { amountCents: 800, idCliente: '301' }, d);
  assert.equal(esito, true);
  assert.equal(page.cassa.registro.click, 1);
  assert.equal(page.cassa.registro.provati[0], MP_PAYMENT_SELECTORS.cobroConfermaBtn, 'prima l\'id');
  assert.ok(d.steps.some((s) => s.startsWith('cobro_cassa_ok:800c:301')), d.steps.join('|'));
});

// ── ② 🚨 L'IMPORTO NON TORNA: non si preme. È il caso che protegge la cassa vera ──────────────
test('② la cassa chiede un importo diverso → NON si incassa', async () => {
  const page = pagina({ importe: '18,00' });
  const d = diag();
  const err = await _confermaCobroInCassa(page, { amountCents: 800, idCliente: '301' }, d).then(() => null, (e) => e);
  assert.ok(err, 'doveva fermarsi');
  assert.equal(err.code, 'COBRO_CASSA_IMPORTO_DIVERSO');
  assert.equal(page.cassa.registro.click, 0, 'NESSUN click: è denaro vero');
});

// ── ③ 🚨 LA PERSONA NON TORNA: non si preme ───────────────────────────────────────────────────
test('③ la cassa è intestata a un altro → NON si incassa', async () => {
  const page = pagina({ idpeople: '1034' });
  const d = diag();
  const err = await _confermaCobroInCassa(page, { amountCents: 800, idCliente: '301' }, d).then(() => null, (e) => e);
  assert.ok(err, 'doveva fermarsi');
  assert.equal(err.code, 'COBRO_CASSA_PERSONA_DIVERSA');
  assert.equal(page.cassa.registro.click, 0);
});

// ── ④ l'importo si confronta in CENTESIMI, non come stringa (migliaia, spazi, %2c) ────────────
test('④ 1.234,50 € nell\'URL vale 123450 centesimi', async () => {
  const page = pagina({ importe: '1.234,50' });
  const d = diag();
  const esito = await _confermaCobroInCassa(page, { amountCents: 123450, idCliente: '301' }, d);
  assert.equal(esito, true);
  assert.equal(page.cassa.registro.click, 1);
});

// ── ⑤ la cassa non si apre (altri metodi): si prosegue, e lo si dichiara ─────────────────────
test('⑤ nessuna cassa → torna false senza inventare un esito', async () => {
  const page = pagina({ cassa: false });
  const d = diag();
  const esito = await _confermaCobroInCassa(page, { amountCents: 800, idCliente: '301' }, d);
  assert.equal(esito, false);
  assert.ok(d.steps.includes('cobro_cassa:assente'));
});

// ── ⑥ cassa aperta ma senza il bottone: si ferma e allega cosa c'era ─────────────────────────
test('⑥ cassa senza «Incassare» → si ferma e consegna la lista', async () => {
  const page = pagina({ bottoni: [] });
  const d = diag();
  const err = await _confermaCobroInCassa(page, { amountCents: 800, idCliente: '301' }, d).then(() => null, (e) => e);
  assert.ok(err, 'doveva fermarsi');
  assert.equal(err.code, 'COBRO_CASSA_SENZA_BOTTONE');
  assert.ok(Array.isArray(err.diagnostic.cobroCandidatiInCassa));
  assert.equal(page.cassa.registro.click, 0);
});

// ── ⑦ si preme «Incassare», MAI «Incassare e stampare» ───────────────────────────────────────
test('⑦ non si sceglie mai la stampa', async () => {
  const page = pagina({ bottoni: ['CC_Datos_ButtonSoloCobrar', 'CC_Datos_ButtonCobrarEImprimir'] });
  const d = diag();
  await _confermaCobroInCassa(page, { amountCents: 800, idCliente: '301' }, d);
  assert.ok(!page.cassa.registro.provati.some((s) => s.includes('CobrarEImprimir')), 'la stampa non si prova nemmeno');
});
