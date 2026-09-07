/* 🔪 BANCO della VOCE 171 ② — «il repeater si ASPETTA, non si cronometra».
 *
 * Il fatto da difendere si dice in una riga: *prima di dire che una persona non c'è nella scheda,
 * si aspetta che la scheda ci sia.* Tutto il resto sono i modi in cui quel fatto si rompe.
 *
 * ⚖️ **Si guarda il FATTO, non la regola.** I casi non chiedono «hai chiamato l'attesa?»: montano
 *    una pagina finta che si popola dopo N giri e chiedono *«alla fine le righe le hai viste?»* —
 *    così la guardia resta valida anche se domani l'attesa si scrive in un altro modo.
 *
 * 🚨 E si prova anche il caso OPPOSTO, che è quello che una guardia distratta lascia scoperto:
 *    una scheda che righe non ne ha davvero **non deve** diventare un'attesa infinita.
 *
 * Si lancia con:  node test/il-repeater-si-aspetta-non-si-cronometra.test.mjs
 */
import { readFileSync } from 'node:fs';

let passati = 0, falliti = 0;
function ok(nome, cond, dettaglio = '') {
  if (cond) { passati += 1; console.log('  ✅ ' + nome); }
  else { falliti += 1; console.log('  ❌ ' + nome + (dettaglio ? '  → ' + dettaglio : '')); }
}
const uguale = (nome, a, b) => ok(nome, JSON.stringify(a) === JSON.stringify(b), `avuto ${JSON.stringify(a)}, atteso ${JSON.stringify(b)}`);

/* ── La funzione in prova, estratta dal worker che gira davvero ─────────────────────────────
   ⚠️ Si ESTRAE dal sorgente invece di ricopiarla: una copia nel banco prova la copia, e il
   giorno in cui il worker cambia il banco resta verde su codice che non esiste più.
   📌 Già pagata in questo progetto: *un banco che non tocca il codice in servizio misura sé
      stesso.* */
const SORGENTE = 'tools/matchpoint-browser-worker/src/server.mjs';
const src = readFileSync(new URL('../' + SORGENTE, import.meta.url), 'utf8');
const i = src.indexOf('async function _attendiRighePartecipanti(');
ok('la funzione esiste ancora nel worker', i > 0, 'rinominata o sparita: il banco non prova più niente');
const j = src.indexOf('\n}\n', i);
const codice = src.slice(i, j + 2);
const _attendiRighePartecipanti = new Function(`return (${codice.replace('async function _attendiRighePartecipanti', 'async function')})`)();

/* ── La pagina finta: un Playwright ridotto all'osso ──────────────────────────────────────── */
function paginaFinta({ compareAlGiro = 1, compareDopoReload = null }) {
  const st = { conte: 0, attese: 0, reload: 0, msAttesi: 0, adesso: 0 };
  const page = {
    locator() {
      return { count: async () => {
        st.conte += 1;
        if (compareDopoReload != null) return st.reload >= compareDopoReload ? 1 : 0;
        return st.conte >= compareAlGiro ? 1 : 0;
      } };
    },
    waitForTimeout: async (ms) => { st.attese += 1; st.msAttesi += ms; st.adesso += ms; },
    reload: async () => { st.reload += 1; },
  };
  // l'orologio non è quello vero: il banco non deve durare otto secondi per provare otto secondi
  const veroNow = Date.now;
  page.__installaOrologio = () => { const t0 = veroNow(); Date.now = () => t0 + st.adesso; };
  page.__togliOrologio = () => { Date.now = veroNow; };
  return { page, st };
}
const diag = () => ({ steps: [] });

async function corri(opzioni, d, optsAttesa) {
  const { page, st } = paginaFinta(opzioni);
  page.__installaOrologio();
  try { return { esito: await _attendiRighePartecipanti(page, 'WUCUsuarioPartida', d, optsAttesa), st }; }
  finally { page.__togliOrologio(); }
}

console.log('\n① la strada NORMALE non paga niente');
{
  const d = diag();
  const { esito, st } = await corri({ compareAlGiro: 1 }, d);
  ok('le righe ci sono subito', esito.presenti === true);
  uguale('un giro solo', esito.giri, 1);
  uguale('zero attese', st.attese, 0);
  uguale('zero ricariche', st.reload, 0);
  uguale('e lo dichiara', d.steps, ['repeater:comparso:giro1']);
}

console.log('\n② IL FATTO: se compare dopo, lo si vede lo stesso');
{
  const d = diag();
  const { esito, st } = await corri({ compareAlGiro: 4 }, d);
  ok('le righe vengono viste', esito.presenti === true, 'è il guasto della 171: viste zero e detto «non c\'è»');
  uguale('ci sono voluti quattro giri', esito.giri, 4);
  ok('ha aspettato davvero', st.attese === 3);
  ok('senza ricaricare: non serviva', st.reload === 0);
  uguale('e il reperto dice a che giro', d.steps, ['repeater:comparso:giro4']);
  ok('⭐ «giro1» NON compare: la strada normale resta muta', !d.steps.includes('repeater:comparso:giro1'));
}

console.log('\n③ la seconda ipotesi: la pagina è venuta su male → UNA ricarica');
{
  const d = diag();
  const { esito, st } = await corri({ compareDopoReload: 1 }, d);
  ok('dopo la ricarica le righe si vedono', esito.presenti === true);
  uguale('ha ricaricato UNA volta sola', st.reload, 1);
  ok('lo dichiara di aver ricaricato', d.steps.some(s => s.startsWith('repeater:vuoto_dopo_')));
  ok('e dichiara che dopo la ricarica è comparso', d.steps.some(s => s.startsWith('repeater:ricaricata:comparso')));
}

console.log('\n④ il caso OPPOSTO: righe non ce ne sono davvero');
{
  const d = diag();
  const { esito, st } = await corri({ compareAlGiro: Infinity }, d);
  ok('non inventa righe che non ci sono', esito.presenti === false);
  uguale('ricarica una volta e basta — non ci prova all\'infinito', st.reload, 1);
  ok('e lo dice con una parola sola', d.steps.includes('repeater:mai_comparso'));
  ok('l\'attesa è LIMITATA: non blocca il worker', st.msAttesi <= 2 * 8000 + 1000, `attesi ${st.msAttesi} ms`);
}

console.log('\n⑤ le cose che non devono rompersi');
{
  const d = diag();
  const { esito } = await corri({ compareAlGiro: 2 }, d, { attesaMs: 500 });
  ok('un\'attesa più corta si può chiedere', esito.presenti === true);
}
{
  // 🚨 Le RI-scansioni dopo un postback chiamano la funzione SENZA diagnostic: se esplodesse lì,
  //    romperebbe l'incasso proprio nel punto in cui il denaro si è già mosso.
  const { esito } = await corri({ compareAlGiro: 1 }, undefined);
  ok('senza diagnostic non esplode (strada corta)', esito.presenti === true);
}
/* 🩹⭐ QUESTI DUE CASI SONO NATI DA UN SABOTAGGIO CHE NON FACEVA CADERE NIENTE.
   I due qui sopra escono al PRIMO giro, cioè **prima** del ramo della ricarica — quindi
   togliere la difesa `Array.isArray(diagnostic.steps)` da quel ramo lasciava il banco verde.
   ⇒ Le stesse due prove rifatte sulla strada LUNGA, che è l'unica dove quel ramo si percorre.
   📌 *Un caso che non attraversa la riga che dice di difendere non la difende: la guarda da
      lontano.* */
{
  let esploso = false;
  try { await corri({ compareAlGiro: Infinity }, undefined, { attesaMs: 300 }); } catch (e) { esploso = true; }
  ok('senza diagnostic non esplode NEMMENO sul ramo della ricarica', esploso === false);
}
{
  let esploso = false;
  try { await corri({ compareAlGiro: Infinity }, { steps: 'non un array' }, { attesaMs: 300 }); } catch (e) { esploso = true; }
  ok('con un diagnostic malformato non esplode nemmeno lì', esploso === false);
}
{
  const { esito } = await corri({ compareAlGiro: 1 }, { steps: 'non un array' });
  ok('con un diagnostic malformato non esplode (strada corta)', esito.presenti === true);
}
{
  const { page, st } = paginaFinta({ compareAlGiro: Infinity });
  page.reload = async () => { st.reload += 1; throw new Error('reload fallito'); };
  page.__installaOrologio();
  let esploso = false;
  try { await _attendiRighePartecipanti(page, 'WUCUsuarioPartida', diag(), { attesaMs: 300 }); }
  catch (e) { esploso = true; }
  finally { page.__togliOrologio(); }
  ok('se la ricarica fallisce si riguarda lo stesso, non si esplode', esploso === false);
}

console.log(`\n${falliti === 0 ? '✅' : '❌'} ${passati} passati, ${falliti} falliti\n`);
if (falliti > 0) process.exitCode = 1;
