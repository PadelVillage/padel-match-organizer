/* 🔪 BANCO della VOCE 174 — «il velo si toglie PRIMA di bussare».
 *
 * Il fatto da difendere si dice in una riga: *prima di dire che il pulsante del borsellino non
 * c'è, si toglie l'avviso che copre la pagina.* Tutto il resto sono i modi in cui si rompe.
 *
 * ⚖️ Si guarda il FATTO, non la regola: i casi non chiedono «hai chiamato dismissSwalOk?», ma
 *    *«alla fine il ledger l'hai aperto?»* — così la guardia regge anche se domani l'avviso si
 *    toglie in un altro modo.
 *
 * 🚨 E si prova anche il caso OPPOSTO, quello che una guardia distratta lascia scoperto: una
 *    pagina che il tab NON ce l'ha davvero non deve diventare un ritentativo a vuoto.
 *
 * Si lancia con:  node test/il-velo-si-toglie-prima-di-bussare.test.mjs
 */
import { readFileSync } from 'node:fs';

let passati = 0, falliti = 0;
function ok(nome, cond, dettaglio = '') {
  if (cond) { passati += 1; console.log('  ✅ ' + nome); }
  else { falliti += 1; console.log('  ❌ ' + nome + (dettaglio ? '  → ' + dettaglio : '')); }
}

/* ── Le funzioni in prova, ESTRATTE dal worker che gira davvero ────────────────────────────
   ⚠️ Si estraggono invece di ricopiarle: una copia nel banco prova la copia, e il giorno in cui
   il worker cambia il banco resta verde su codice che non esiste più. */
const SORGENTE = 'tools/matchpoint-browser-worker/src/server.mjs';
const src = readFileSync(new URL('../' + SORGENTE, import.meta.url), 'utf8');

function estrai(nome) {
  const i = src.indexOf(`async function ${nome}(`);
  if (i < 0) return null;
  const j = src.indexOf('\n}\n', i);
  return src.slice(i, j + 2);
}
const corpoLedger = estrai('_openWalletSaldoLedger');
const corpoSwal = estrai('dismissSwalOk');
ok('le due funzioni esistono ancora nel worker', !!corpoLedger && !!corpoSwal, 'rinominate o sparite: il banco non prova più niente');

const SELETTORI = { walletBillingTab: 'Fatturazione e pagamenti', walletSaldoSubTabLabels: ['Saldo'] };

function costruisci(codiceLedger = corpoLedger) {
  const dismissSwalOk = new Function(`return (${corpoSwal.replace('async function dismissSwalOk', 'async function')})`)();
  const ledger = new Function('MP_PAYMENT_SELECTORS', 'dismissSwalOk',
    `return (${codiceLedger.replace('async function _openWalletSaldoLedger', 'async function')})`)(SELETTORI, dismissSwalOk);
  return { ledger, dismissSwalOk };
}

/* ── La pagina finta: un Playwright ridotto all'osso ───────────────────────────────────────
   Il pezzo che conta è UNO: quando c'è un avviso aperto, ogni click SCADE (è ciò che fa un
   contenitore swal2, che copre lo schermo e intercetta i puntatori) — ma le LETTURE passano.
   È la firma esatta del guasto del 07/09: `saldo_pre` riuscito, tutti i click no. */
function paginaFinta({ avviso = false, tabPresente = true, subPresente = true } = {}) {
  const st = { avviso, clickTentati: 0, clickPassati: 0, swalTolti: 0, attese: 0 };
  const etichetta = (sel) => { const m = /has-text\("([^"]+)"\)/.exec(sel); return m ? m[1] : null; };

  const nodo = (quanti, alClick) => ({
    count: async () => quanti,
    isVisible: async () => quanti > 0,
    first() { return this; },
    innerText: async () => 'avviso finto',
    click: async () => {
      st.clickTentati += 1;
      if (alClick === 'swal') { st.avviso = false; st.swalTolti += 1; st.clickPassati += 1; return; }
      // il velo intercetta i puntatori: Playwright riprova fino al timeout e poi lancia
      if (st.avviso) throw new Error('Timeout 4000ms exceeded. <div class="swal2-container"> intercepts pointer events');
      st.clickPassati += 1;
    },
  });

  const page = {
    waitForTimeout: async () => { st.attese += 1; },
    locator(sel) {
      if (sel === 'button.swal2-confirm') return nodo(st.avviso ? 1 : 0, 'swal');
      if (sel.startsWith('.swal2-')) return nodo(1);
      const lab = etichetta(sel);
      if (lab === 'Saldo') return nodo(subPresente ? 1 : 0);
      if (lab === SELETTORI.walletBillingTab) return nodo(tabPresente ? 1 : 0);
      return nodo(0); // le altre etichette del tab (spagnolo, abbreviata) qui non ci sono
    },
  };
  return { page, st };
}

async function corri(opzioni, codiceLedger, { togliPrima = false } = {}) {
  const { ledger, dismissSwalOk } = costruisci(codiceLedger);
  const { page, st } = paginaFinta(opzioni);
  const d = { steps: [] };
  if (togliPrima) await dismissSwalOk(page, d, 'ficha_pre'); // ciò che fa il chiamante curato
  const esito = await ledger(page, d);
  return { esito, steps: d.steps, st };
}

console.log('\n① la pagina pulita: il ledger si apre, e la traccia lo dice');
{
  const r = await corri({}, corpoLedger);
  ok('torna true', r.esito === true);
  ok('traccia il tab e il sotto-tab', r.steps.includes('wallet_tab:Fatturazione e pagamenti') && r.steps.includes('wallet_subtab:Saldo'), JSON.stringify(r.steps));
}

console.log('\n② il velo tolto PRIMA (la cura nel chiamante): il ledger si apre lo stesso');
{
  const r = await corri({ avviso: true }, corpoLedger, { togliPrima: true });
  ok('torna true', r.esito === true, JSON.stringify(r.steps));
  ok('nessun click è andato perso', r.st.clickTentati - r.st.swalTolti === r.st.clickPassati - r.st.swalTolti);
}

console.log('\n③ il velo NON tolto prima: la funzione si ripara da sé e ritenta UNA volta');
{
  const r = await corri({ avviso: true }, corpoLedger);
  ok('alla fine il ledger è aperto', r.esito === true, JSON.stringify(r.steps));
  ok('ha tolto l\'avviso', r.st.swalTolti === 1);
  ok('dichiara di aver ritentato', r.steps.includes('wallet_ledger:ritento_dopo_avviso'), JSON.stringify(r.steps));
  ok('il primo giro ha lasciato traccia del click fallito', r.steps.some((s) => s.startsWith('wallet_tab_ko:')), JSON.stringify(r.steps));
}

console.log('\n④ il tab NON c\'è davvero: si arrende, e NON ritenta a vuoto');
{
  const r = await corri({ tabPresente: false, subPresente: false }, corpoLedger);
  ok('torna false', r.esito === false);
  ok('dice che il tab manca', r.steps.includes('wallet_tab:none') && r.steps.includes('wallet_subtab:none'), JSON.stringify(r.steps));
  ok('un giro solo: nessun ritentativo senza motivo', r.steps.filter((s) => s === 'wallet_subtab:none').length === 1, JSON.stringify(r.steps));
}

console.log('\n⑤ un click che non passa non è mai muto (era il difetto che rendeva il guasto illeggibile)');
{
  const r = await corri({ avviso: true }, corpoLedger);
  // 🩹 la guardia guarda i passi dei CLICK, non un qualunque `_ko:`: `swal_dismiss:ledger_ko`
  //    contiene la stessa sottostringa, e la prima stesura passava GRAZIE A QUELLO — cioè senza
  //    mai toccare la riga che dice di difendere.
  ok('c\'è almeno un passo wallet_*_ko:', r.steps.some((s) => /^wallet_(tab|subtab)_ko:/.test(s)), JSON.stringify(r.steps));
}

console.log('\n🔪 SABOTAGGI — ogni caso deve cadere quando si toglie la riga che dice di difendere');
async function sabota(nome, muta, atteso) {
  const codice = muta(corpoLedger);
  ok('il sabotaggio "' + nome + '" ha davvero cambiato il codice', codice !== corpoLedger);
  let rosso = false;
  try { rosso = !(await atteso(codice)); } catch (e) { rosso = true; }
  ok('→ e il caso che lo copre diventa ROSSO', rosso, 'il banco era verde con la difesa tolta: non la difendeva');
}

// S1 — tolto il ritentativo: il caso ③ (velo non tolto prima) non deve più riuscire
await sabota('niente auto-riparazione', (c) => c.replace('for (let giro = 0; giro < 2; giro++)', 'for (let giro = 0; giro < 1; giro++)'),
  async (c) => (await corri({ avviso: true }, c)).esito === true);

// S2 — rimesse mute TUTTE le catch dei click: il caso ⑤ non deve più vedere traccia.
// 🩹 La prima stesura ne mutava una sola (`wallet_tab_ko`) e il banco restava VERDE: l'altra
//    bastava a far passare il caso. *Un sabotaggio che non fa cadere niente non prova niente* —
//    è la trappola già pagata sul banco della 171, ripresentatasi identica.
await sabota('click di nuovo muti', (c) => c.replace(/catch \(e\) \{ diagnostic\.steps\.push\('wallet_(tab|subtab)_ko:[^\n]*\n/g, 'catch (e) { /* muto */ }\n'),
  async (c) => (await corri({ avviso: true }, c)).steps.some((s) => /^wallet_(tab|subtab)_ko:/.test(s)));

// S3 — ritenta SEMPRE: il caso ④ (niente da togliere) non deve più fare un giro solo
await sabota('ritenta anche senza motivo', (c) => c.replace('if (!via.dismissed) break;', ''),
  async (c) => (await corri({ tabPresente: false, subPresente: false }, c)).steps.filter((s) => s === 'wallet_subtab:none').length === 1);

console.log('\n📜 GUARDIE TESTUALI — e sono TESTUALI, non comportamentali: dicono che la riga è cablata dove va, non che il gesto riesce sul Matchpoint vero');
{
  const i = src.indexOf('const diagnostic = { mode: \'correct_wallet\'');
  const coda = src.slice(i, i + 9000);
  const iFicha = coda.indexOf("dismissSwalOk(page, diagnostic, 'ficha_pre')");
  const iLedger = coda.indexOf('_openWalletSaldoLedger(page, diagnostic)');
  ok('nella correzione borsellino l\'avviso si toglie PRIMA di aprire il ledger', iFicha > 0 && iLedger > 0 && iFicha < iLedger, `ficha_pre@${iFicha} ledger@${iLedger}`);
  ok('la sonda dei candidati percorre TUTTI i frame', /for \(const fr of page\.frames\(\)\)/.test(estrai('_collectCorrezioneCandidates') || ''), 'guarderebbe di nuovo in una stanza sola');
  ok('l\'errore porta con sé le stanze e se il ledger si era aperto', /ledgerAperto, correzioneCandidates: candidates, stanze/.test(src));
}

console.log(`\n${falliti === 0 ? '✅' : '❌'} ${passati} passati, ${falliti} falliti`);
process.exit(falliti === 0 ? 0 : 1);
