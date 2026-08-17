// Collaudo del fix 6.235: esito ignoto con telefono offline (prenotazione 9476, 17/08/2026).
// A: la fetch dell'edit PARTE e muore con la rete giù → l'app NON deve dire «rimasta com'era»,
//    deve aspettare la rete (pmoAspettaRete) e andare a guardare, fino al ✅ verificato.
// B (controllo opposto): la richiesta NON parte mai → deve restare il ❌ «non sono riuscito a mandarla».
//
// Come si lancia (da questa cartella, con le dipendenze di console.mjs installate):
//   1. dalla RADICE del repo:  python3 -m http.server 8123
//   2. da qui:                 node collaudo-esito-offline.mjs
// Esce 0 se A e B passano. Il sabotaggio che dà valore al verde: lanciato su un albero SENZA
// il fix (checkout precedente servito su 8123), lo scenario A deve andare NON PASSA — è così
// che è stato provato che il collaudo misura il fix e non sé stesso.
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext();
await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());

async function scenario(nome, prepara) {
  const page = await ctx.newPage();
  await page.goto('http://localhost:8123/index.html?env=test', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__PMOStaffCalTest && typeof window.staffCalPlayersSave === 'function', null, { timeout: 90000 });
  const esito = await page.evaluate(prepara);
  await page.close();
  console.log('\n── ' + nome + ' ──');
  console.log(JSON.stringify(esito, null, 1));
  return esito;
}

const A = await scenario('A: fetch partita e morta OFFLINE → aspetta la rete → verifica → ✅', async () => {
  const H = window.__PMOStaffCalTest;
  const iso = (function () { const d = new Date(Date.now() + 86400000); return d.toISOString().slice(0, 10); })();
  H.setBookings([{ data: iso, campo: 2, ora: '18:00', oraFine: '19:30', durata: 90, nome: 'Luca Rossi', tipo: 'partita', giocatori: ['Luca Rossi'] }]);
  H.openCard(iso, 2, '18:00', 'Luca Rossi', 90, 'partita');
  const st = H.getPlayersState();
  if (!st) return { errore: 'scheda non aperta' };
  st.add.push({ nome: 'Anna Verdi' });
  window.confirm = function () { return true; };
  window.loadAssessmentSupabaseConfig = async function () { return { supabaseUrl: 'http://localhost:8123/finto-supabase', supabaseKey: 'k' }; };
  window.pmoRequireStaffPermission = async function () { return { accessToken: 'tok-di-prova' }; };
  let chiamate = 0;
  const setOnline = function (v) { Object.defineProperty(navigator, 'onLine', { get: () => v, configurable: true }); };
  window.fetch = async function (url, opts) {
    chiamate++;
    const body = opts && opts.body ? JSON.parse(opts.body) : {};
    if (chiamate === 1 && !body.read) {
      // la scrittura: parte, poi la linea cade e la risposta non torna mai
      setOnline(false);
      throw new TypeError('Failed to fetch');
    }
    // la verifica (read:true): Matchpoint risponde col roster che CONTIENE Anna
    return new Response(JSON.stringify({ ok: true, worker: { partecipantiFinali: [{ nome: 'Luca Rossi' }, { nome: 'Anna Verdi' }] } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  // la linea torna dopo 1,2 s
  setTimeout(function () { setOnline(true); window.dispatchEvent(new Event('online')); }, 1200);

  const note = [];
  const raccogli = setInterval(function () {
    document.querySelectorAll('.mp-sync-note, .mp-sync-head').forEach(function (n) {
      const t = (n.textContent || '').trim();
      if (t && note.indexOf(t) === -1) note.push(t);
    });
  }, 100);
  staffCalPlayersSave({ skipConfirm: true });
  await new Promise(function (r) { setTimeout(r, 8000); });
  clearInterval(raccogli);
  return { chiamateFetch: chiamate, note: note };
});

const B = await scenario('B: richiesta MAI partita → ❌ onesto (ramo conservato)', async () => {
  const H = window.__PMOStaffCalTest;
  const iso = (function () { const d = new Date(Date.now() + 86400000); return d.toISOString().slice(0, 10); })();
  H.setBookings([{ data: iso, campo: 2, ora: '18:00', oraFine: '19:30', durata: 90, nome: 'Luca Rossi', tipo: 'partita', giocatori: ['Luca Rossi'] }]);
  H.openCard(iso, 2, '18:00', 'Luca Rossi', 90, 'partita');
  const st = H.getPlayersState();
  if (!st) return { errore: 'scheda non aperta' };
  st.add.push({ nome: 'Anna Verdi' });
  window.confirm = function () { return true; };
  window.loadAssessmentSupabaseConfig = async function () { return { supabaseUrl: 'http://localhost:8123/finto-supabase', supabaseKey: 'k' }; };
  // il permesso FALLISCE: si muore PRIMA della fetch → esito noto, «mai partita»
  window.pmoRequireStaffPermission = async function () { throw new Error('permesso non disponibile (prova)'); };
  let chiamate = 0;
  window.fetch = async function () { chiamate++; return new Response('{}', { status: 200 }); };
  const note = [];
  const raccogli = setInterval(function () {
    document.querySelectorAll('.mp-sync-note, .mp-sync-head').forEach(function (n) {
      const t = (n.textContent || '').trim();
      if (t && note.indexOf(t) === -1) note.push(t);
    });
  }, 100);
  staffCalPlayersSave({ skipConfirm: true });
  await new Promise(function (r) { setTimeout(r, 3000); });
  clearInterval(raccogli);
  return { chiamateFetch: chiamate, note: note };
});

const okA = A.note && A.note.some(t => t.indexOf('Sei senza linea') !== -1) && A.note.some(t => t.indexOf('verificata su Matchpoint') !== -1);
const okB = B.note && B.note.some(t => t.indexOf('Non sono riuscito a mandarla') !== -1) && !B.note.some(t => t.indexOf('verificata') !== -1);
console.log('\nVERDETTO A (aspetta la rete e verifica):', okA ? 'PASSA' : 'NON PASSA');
console.log('VERDETTO B (mai partita resta ❌):', okB ? 'PASSA' : 'NON PASSA');
await browser.close();
process.exit(okA && okB ? 0 : 1);
