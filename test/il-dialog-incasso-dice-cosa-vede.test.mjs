// il-dialog-incasso-dice-cosa-vede.test.mjs — VOCE 171: la sonda E la cura (06/09/2026)
//
// 🎯 COSA DIFENDE. L'incasso dalla scheda partita era rotto su PROD per OGNI metodo: due
// tentativi veri, `wallet` e `cash`, tutti e due «Pulsante metodo … non trovato nel dialog
// incasso». Il worker però diceva solo QUALE cercava, mai QUALI vedeva ⇒ ogni diagnosi
// successiva sarebbe stata un altro tentativo alla cieca su una cassa vera.
//
// 📏 LA CAUSA, misurata dalla sonda su PROD e non supposta: dopo il click su «Incassare» il
// frame principale resta la scheda partita, e i metodi vivono in un fancybox-iframe
// `CobroParticipanteReserva.aspx?id_participante=…` — `Contanti`
// (`CC_Datos_LinkButtonCobrarEfectivo`), `Carta`, `Saldo disponibile: 0,00`.
// ⇒ Non era l'etichetta, e non era il tempo (20 giri in 8 s, mai comparso): era la STANZA.
// 📌 Un elemento cercato nel contesto sbagliato non è «assente»: è altrove, e le due cose si
//    somigliano solo per chi guarda da un posto solo.
//
// 🚨 E LA GUARDIA NUOVA, che nasce dalla cura stessa: il dialog è PER PARTECIPANTE, quindi
// cliccare in un frame trovato per URL può incassare alla PERSONA SBAGLIATA. Prima il rischio
// non esisteva perché non si cliccava affatto.
//
// 🚨 LE PROVE SONO SUL COMPORTAMENTO: le funzioni si ESTRAGGONO da `server.mjs` e si ESEGUONO
// con un doppio del `page`. Un banco che cercasse la stringa `cobroMethodIds` resterebbe verde
// davanti a un ramo mai percorso.
//
// ⛔ QUELLO CHE QUESTO BANCO NON DICE: che un incasso vero vada a buon fine su Matchpoint.
// Dice che il worker cerca il metodo nel frame giusto, per id, e che si ferma quando il dialog
// non c'è o è di un altro. Che il denaro si muova lo dice solo un incasso vero su PROD.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const sorgente = readFileSync(join(QUI, '..', 'tools', 'matchpoint-browser-worker', 'src', 'server.mjs'), 'utf8');

// `server.mjs` avvia un server quando lo si importa: le funzioni si ritagliano dal testo.
function estrai(nome, prefisso = 'async function') {
  const inizio = sorgente.indexOf(`${prefisso} ${nome}(`);
  if (inizio < 0) throw new Error(`funzione «${nome}» non trovata in server.mjs`);
  let i = sorgente.indexOf('{', sorgente.indexOf(')', inizio));
  let graffe = 0;
  for (let j = i; j < sorgente.length; j++) {
    if (sorgente[j] === '{') graffe++;
    else if (sorgente[j] === '}') { graffe--; if (!graffe) return sorgente.slice(inizio, j + 1); }
  }
  throw new Error(`funzione «${nome}» non chiusa`);
}

// I selettori si prendono dal sorgente vero: se un id cambia lì, questo banco lo segue.
function estraiSelettori() {
  const inizio = sorgente.indexOf('const MP_PAYMENT_SELECTORS = {');
  const i = sorgente.indexOf('{', inizio);
  let graffe = 0;
  for (let j = i; j < sorgente.length; j++) {
    if (sorgente[j] === '{') graffe++;
    else if (sorgente[j] === '}') { graffe--; if (!graffe) return sorgente.slice(inizio, j + 1) + ';'; }
  }
  throw new Error('MP_PAYMENT_SELECTORS non chiuso');
}

const contesto = vm.createContext({
  fail: (code, message, diagnostic) => Object.assign(new Error(message), { code, diagnostic }),
});
vm.runInContext(
  `${estraiSelettori()}\n${estrai('_collectCobroCandidates')}\n${estrai('_cobroDialogFrame', 'function')}\n${estrai('_clickCobroMethod')}\n`
  + 'globalThis.__f = { _clickCobroMethod, _collectCobroCandidates, _cobroDialogFrame, MP_PAYMENT_SELECTORS };',
  contesto,
);
const { _clickCobroMethod, _collectCobroCandidates, MP_PAYMENT_SELECTORS } = contesto.__f;

const URL_DIALOG = 'https://mp/Reservas/CobroParticipanteReserva.aspx?modo=fancy&id_participante=27677';
const URL_SCHEDA = 'https://mp/Reservas/FichaPartidaPagoPorUsuario.aspx?modo=fancy&id=9844';

// ── Doppi ───────────────────────────────────────────────────────────────────────────────────
// `contenuto`: quel che `evaluate` restituisce (la sonda chiede un oggetto, la guardia una
// stringa) — si distingue dalla forma della risposta attesa, come fa Playwright davvero.
function fintoFrame(url, name, { corpo = '', cliccabili = [], clickEsplode = false } = {}) {
  const registro = { click: 0, selettoriProvati: [] };
  return {
    registro,
    url: () => url,
    name: () => name,
    evaluate: async (fn) => {
      const r = typeof fn === 'function' ? undefined : undefined;
      // La sonda passa una funzione che ritorna un oggetto; la guardia una che ritorna testo.
      // Qui si decide dal contenuto della funzione, senza eseguirla nel DOM (che non c'è).
      return String(fn).includes('cliccabili')
        ? { bodyText: corpo, cliccabili, iframes: [] }
        : corpo;
    },
    locator: (sel) => ({
      count: async () => { registro.selettoriProvati.push(sel); return cliccabili.some((c) => sel.includes(c.id) || sel.includes(c.testo)) ? 1 : 0; },
      first: () => ({
        click: async () => { registro.click++; if (clickEsplode) throw new Error('elemento coperto da un overlay'); },
      }),
    }),
  };
}

const METODI = [
  { id: 'CC_Datos_LinkButtonCobrarEfectivo', testo: 'Contanti' },
  { id: 'CC_Datos_LinkButtonCobrarTarjeta', testo: 'Carta' },
  { id: 'CC_Datos_LinkButtonCobrarSaldo', testo: 'Saldo disponibile: 0,00' },
];

function fintaPagina({ conDialog = true, corpoDialog = 'FABIOLA LIMUTI CAMPO 4 Da pagare: 8,00 €', clickEsplode = false, ritardoGiri = 0 } = {}) {
  const principale = fintoFrame(URL_SCHEDA, '', { corpo: 'Partita n. 9844', cliccabili: [{ id: 'Cobrar', testo: 'Incassare' }] });
  const dialog = fintoFrame(URL_DIALOG, 'fancybox-frame1', { corpo: corpoDialog, cliccabili: METODI, clickEsplode });
  const registro = { attese: [], interrogazioni: 0 };
  const page = {
    registro, dialog, principale,
    mainFrame: () => principale,
    frames() {
      registro.interrogazioni++;
      if (!conDialog) return [principale];
      return registro.interrogazioni > ritardoGiri ? [principale, dialog] : [principale];
    },
    waitForTimeout: async (ms) => { registro.attese.push(ms); },
    locator: () => ({ count: async () => 0, first: () => ({ click: async () => { throw new Error('il main non si clicca'); } }) }),
  };
  return page;
}

const diag = () => ({ steps: [] });

// ── ① il caso vero: il metodo sta nell'IFRAME, e ci si clicca ────────────────────────────────
test('① il metodo si clicca nel frame del dialog, non nella pagina', async () => {
  const page = fintaPagina();
  const d = diag();
  await _clickCobroMethod(page, 'contanti', 'Contanti', 'Fabiola Limuti', d);
  assert.equal(page.dialog.registro.click, 1, 'ha cliccato nel dialog');
  assert.equal(page.principale.registro.click, 0, 'non ha cliccato nella pagina');
  assert.match(d.cobroDialogUrl, /CobroParticipanteReserva/);
});

// ── ② si clicca per ID, non per testo: il testo del borsellino porta il saldo dentro ─────────
test('② il borsellino si prende per id, benché il suo testo contenga il saldo', async () => {
  const page = fintaPagina();
  const d = diag();
  await _clickCobroMethod(page, 'borsellino', 'Saldo disponibile', 'Fabiola Limuti', d);
  assert.ok(d.steps.some((s) => s.endsWith(':id')), d.steps.join('|'));
  const primo = page.dialog.registro.selettoriProvati[0];
  assert.equal(primo, MP_PAYMENT_SELECTORS.cobroMethodIds.borsellino, 'l\'id si prova per primo');
});

// ── ③ il dialog arriva TARDI: si aspetta il frame, non si scommette su un'attesa fissa ───────
test('③ dialog lento → si aspetta e si clicca lo stesso', async () => {
  const page = fintaPagina({ ritardoGiri: 3 });
  const d = diag();
  await _clickCobroMethod(page, 'contanti', 'Contanti', 'Fabiola Limuti', d);
  assert.equal(page.dialog.registro.click, 1);
  assert.ok(d.cobroGiri > 1, 'ha fatto più di un giro');
});

// ── ④ il dialog non compare MAI: fallisce DICENDO cosa c'era ─────────────────────────────────
test('④ dialog mai comparso → FORMA_PAGO_NON_TROVATA con l\'elenco dei contesti', async () => {
  const page = fintaPagina({ conDialog: false });
  const d = diag();
  const err = await _clickCobroMethod(page, 'contanti', 'Contanti', 'Fabiola Limuti', d).then(() => null, (e) => e);
  assert.ok(err, 'doveva fallire');
  assert.equal(err.code, 'FORMA_PAGO_NON_TROVATA');
  assert.equal(err.diagnostic.cobroEsito, 'dialog_mai_comparso');
  assert.ok(Array.isArray(err.diagnostic.cobroCandidates));
  assert.equal(page.principale.registro.click, 0, 'non ha cliccato niente');
});

// ── ⑤ LA GUARDIA: il dialog di un ALTRO giocatore non si clicca ──────────────────────────────
test('⑤ dialog di un\'altra persona → non si incassa, e lo dice', async () => {
  const page = fintaPagina({ corpoDialog: 'LIDIA COMES CAMPO 4 Da pagare: 8,00 €' });
  const d = diag();
  const err = await _clickCobroMethod(page, 'contanti', 'Contanti', 'Fabiola Limuti', d).then(() => null, (e) => e);
  assert.ok(err, 'doveva fallire');
  assert.equal(err.code, 'COBRO_DIALOG_ALTRO_GIOCATORE');
  assert.equal(page.dialog.registro.click, 0, 'NESSUN click: è denaro di qualcun altro');
});

// ── ⑥ senza nome la guardia non si può esercitare: si DICHIARA invece di fingere ─────────────
test('⑥ senza playerName → si procede, ma la guardia si dichiara non esercitata', async () => {
  const page = fintaPagina({ corpoDialog: 'QUALCUNO CAMPO 4' });
  const d = diag();
  await _clickCobroMethod(page, 'contanti', 'Contanti', '', d);
  assert.equal(d.cobroPersonaVerificata, false);
  assert.equal(page.dialog.registro.click, 1);
});

// ── ⑦ trovato ma non cliccabile: un tentativo solo (l'incasso non è idempotente) ─────────────
test('⑦ click che esplode → un solo tentativo, e lo dichiara', async () => {
  const page = fintaPagina({ clickEsplode: true });
  const d = diag();
  const err = await _clickCobroMethod(page, 'contanti', 'Contanti', 'Fabiola Limuti', d).then(() => null, (e) => e);
  assert.ok(err, 'doveva fallire');
  assert.equal(err.diagnostic.cobroEsito, 'trovato_non_cliccabile');
  assert.equal(page.dialog.registro.click, 1, 'un click solo: non si ritenta ciò che poteva passare');
});

// ── ⑧ la raccolta guarda DENTRO gli iframe ed è in sola lettura ──────────────────────────────
test('⑧ la sonda elenca i frame e non clicca niente', async () => {
  const page = fintaPagina();
  page.frames(); // materializza il dialog
  const contesti = await _collectCobroCandidates(page);
  assert.equal(contesti.length, 2);
  assert.equal(contesti[0].main, true);
  assert.match(contesti[1].url, /CobroParticipanteReserva/);
  assert.equal(page.dialog.registro.click, 0);
  assert.equal(page.principale.registro.click, 0);
});
