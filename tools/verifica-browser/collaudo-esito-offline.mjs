// Collaudo esito-offline — v6.235 (esito ignoto) + v6.236 (il lavoro col numero).
//
// A: la modifica viene CONSEGNATA (jobId), poi lo schermo si spegne durante l'attesa: le
//    interrogazioni muoiono offline, e al ritorno della rete il numero risponde `done`.
//    Atteso: ✅ dalla riga del lavoro, ZERO riletture del roster (`read: true`).
// B: la richiesta NON parte mai → resta il ❌ «non sono riuscito a mandarla» (ramo conservato).
// C: la CONSEGNA stessa si perde (niente jobId) con la rete giù → al risveglio si va a
//    guardare il roster su Matchpoint (il ripiego della 6.235, che resta la rete di sicurezza).
// D: il numero riporta un RIFIUTO del worker → ❌ «Modifica non eseguita», nessuna applicazione.
//
// Come si lancia (da questa cartella, con le dipendenze di console.mjs installate):
//   1. dalla RADICE del repo:  python3 -m http.server 8123
//   2. da qui:                 node collaudo-esito-offline.mjs
// Esce 0 se A, B, C e D passano. Il valore del verde sta anche nei contatori: A deve vincere
// COL numero (poll > 0, read = 0), C SENZA numero (read > 0) — non basta il ✅ finale.
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

// Base comune degli scenari: scheda aperta con Luca, si aggiunge Anna, stub di config/permessi,
// e un fetch finto che governa consegna/interrogazioni/letture contandole. `piano` decide le
// risposte; il resto (config.js, cloud) passa alla rete vera della pagina.
const preparaBase = String(function base(piano) {
  const H = window.__PMOStaffCalTest;
  const iso = (function () { const d = new Date(Date.now() + 86400000); return d.toISOString().slice(0, 10); })();
  H.setBookings([{ data: iso, campo: 2, ora: '18:00', oraFine: '19:30', durata: 90, nome: 'Luca Rossi', tipo: 'partita', giocatori: ['Luca Rossi'] }]);
  H.openCard(iso, 2, '18:00', 'Luca Rossi', 90, 'partita');
  H.setPollTimings({ stepMs: 250, maxMs: 15000, lateMaxMs: 4000, lateStepMs: 500 });
  const st = H.getPlayersState();
  if (!st) return { errore: 'scheda non aperta' };
  st.add.push({ nome: 'Anna Verdi' });
  window.confirm = function () { return true; };
  window.loadAssessmentSupabaseConfig = async function () { return { supabaseUrl: 'http://localhost:8123/finto-supabase', supabaseKey: 'k' }; };
  window.pmoRequireStaffPermission = async function () { return { accessToken: 'tok-di-prova' }; };
  const conta = { submit: 0, poll: 0, read: 0 };
  const setOnline = function (v) { Object.defineProperty(navigator, 'onLine', { get: () => v, configurable: true }); };
  const fetchVera = window.fetch.bind(window);
  const rispondi = function (obj) { return new Response(JSON.stringify(obj), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
  window.fetch = async function (url, opts) {
    const u = String(url);
    if (u.indexOf('matchpoint-bookings-edit') === -1) return fetchVera(url, opts);
    if (u.indexOf('jobId=') !== -1) { conta.poll++; return piano.poll(conta, setOnline, rispondi); }
    const body = opts && opts.body ? JSON.parse(opts.body) : {};
    if (body.read === true) { conta.read++; return piano.read(conta, setOnline, rispondi); }
    conta.submit++;
    return piano.submit(conta, setOnline, rispondi);
  };
  if (piano.dopo) piano.dopo(setOnline);
  const note = [];
  const raccogli = setInterval(function () {
    document.querySelectorAll('.mp-sync-note, .mp-sync-head').forEach(function (n) {
      const t = (n.textContent || '').trim();
      if (t && note.indexOf(t) === -1) note.push(t);
    });
  }, 100);
  staffCalPlayersSave({ skipConfirm: true });
  return new Promise(function (res) {
    setTimeout(function () { clearInterval(raccogli); res({ conta: conta, note: note }); }, piano.attesaMs || 8000);
  });
});

const A = await scenario('A: consegnata (jobId) + schermo spento in attesa → il NUMERO risponde → ✅ senza riletture', new Function(`
  const base = (${preparaBase});
  let fase = 'spento';
  return base({
    submit: function (c, setOnline, rispondi) { return rispondi({ ok: true, jobId: 'job-A', status: 'pending' }); },
    poll: function (c, setOnline, rispondi) {
      if (fase === 'spento') { setOnline(false); throw new TypeError('Failed to fetch'); }
      return rispondi({ ok: true, status: 'done', message: 'Modifica eseguita', worker_result: { partecipantiFinali: [{ nome: 'Luca Rossi' }, { nome: 'Anna Verdi' }] } });
    },
    read: function (c, setOnline, rispondi) { return rispondi({ ok: true, worker: { partecipantiFinali: [] } }); },
    dopo: function (setOnline) {
      setTimeout(function () { fase = 'acceso'; setOnline(true); window.dispatchEvent(new Event('online')); }, 1500);
    },
    attesaMs: 9000,
  });
`));

const C = await scenario('C: CONSEGNA persa offline (niente numero) → al risveglio verifica dal roster → ✅', new Function(`
  const base = (${preparaBase});
  return base({
    submit: function (c, setOnline, rispondi) { setOnline(false); throw new TypeError('Failed to fetch'); },
    poll: function (c, setOnline, rispondi) { return rispondi({ ok: true, status: 'pending' }); },
    read: function (c, setOnline, rispondi) {
      return rispondi({ ok: true, worker: { partecipantiFinali: [{ nome: 'Luca Rossi' }, { nome: 'Anna Verdi' }] } });
    },
    dopo: function (setOnline) {
      setTimeout(function () { setOnline(true); window.dispatchEvent(new Event('online')); }, 1200);
    },
    attesaMs: 8000,
  });
`));

const D = await scenario('D: il numero riporta un RIFIUTO del worker → ❌ Modifica non eseguita', new Function(`
  const base = (${preparaBase});
  return base({
    submit: function (c, s, rispondi) { return rispondi({ ok: true, jobId: 'job-D', status: 'pending' }); },
    poll: function (c, s, rispondi) { return rispondi({ ok: false, status: 'error', error: 'Worker error 500: PLAYER_ID_NOT_LOCKED (prova)' }); },
    read: function (c, s, rispondi) { return rispondi({ ok: true }); },
    attesaMs: 5000,
  });
`));

// B a parte: per farla «mai partita» il permesso deve morire PRIMA della fetch.
// La base sopra non lo prevede: si fa qui, breve, con lo stub del permesso che lancia.
const B = await (async function () {
  const page = await ctx.newPage();
  await page.goto('http://localhost:8123/index.html?env=test', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__PMOStaffCalTest && typeof window.staffCalPlayersSave === 'function', null, { timeout: 90000 });
  const esito = await page.evaluate(async () => {
    const H = window.__PMOStaffCalTest;
    const iso = (function () { const d = new Date(Date.now() + 86400000); return d.toISOString().slice(0, 10); })();
    H.setBookings([{ data: iso, campo: 2, ora: '18:00', oraFine: '19:30', durata: 90, nome: 'Luca Rossi', tipo: 'partita', giocatori: ['Luca Rossi'] }]);
    H.openCard(iso, 2, '18:00', 'Luca Rossi', 90, 'partita');
    const st = H.getPlayersState();
    if (!st) return { errore: 'scheda non aperta' };
    st.add.push({ nome: 'Anna Verdi' });
    window.confirm = function () { return true; };
    window.loadAssessmentSupabaseConfig = async function () { return { supabaseUrl: 'http://localhost:8123/finto-supabase', supabaseKey: 'k' }; };
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
  await page.close();
  console.log('\n── B: richiesta MAI partita → ❌ onesto ──');
  console.log(JSON.stringify(esito, null, 1));
  return esito;
})();

const okA = A.note && A.note.some(t => t.indexOf('Operazione confermata su Matchpoint') !== -1)
  && A.conta && A.conta.poll > 0 && A.conta.read === 0;
const okC = C.note && C.note.some(t => t.indexOf('Sei senza linea') !== -1)
  && C.note.some(t => t.indexOf('verificata su Matchpoint') !== -1)
  && C.conta && C.conta.read > 0;
const okD = D.note && D.note.some(t => t.indexOf('Modifica non eseguita') !== -1)
  && !D.note.some(t => t.indexOf('aggiornata') !== -1);
const okB = B.note && B.note.some(t => t.indexOf('Non sono riuscito a mandarla') !== -1);
console.log('\nVERDETTO A (numero + risveglio, zero riletture):', okA ? 'PASSA' : 'NON PASSA');
console.log('VERDETTO B (mai partita resta ❌):', okB ? 'PASSA' : 'NON PASSA');
console.log('VERDETTO C (consegna persa → verifica roster):', okC ? 'PASSA' : 'NON PASSA');
console.log('VERDETTO D (rifiuto dal numero → ❌):', okD ? 'PASSA' : 'NON PASSA');
await browser.close();
process.exit(okA && okB && okC && okD ? 0 : 1);
