#!/usr/bin/env node
// Console remota sul gestionale: apre l'app, fa login come staff, esegue uno
// snippet nella pagina e restituisce il risultato — quello che prima si chiedeva
// all'operatore di fare a mano in DevTools.
//
//   node console.mjs --env test --eval "return window.APP_VERSION"
//   node console.mjs --env prod --file snippet.js --shot /tmp/x.png
//
// Di default NON scrive: le chiamate che modificano dati vengono bloccate dalla
// guardia di rete (vedi README.md, che ne spiega anche i limiti).

import { chromium } from 'playwright';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AMBIENTI = {
  test: {
    url: 'https://test.padelvillage.club/',
    supabaseHost: 'cudiqnrrlbyqryrtaprd.supabase.co',
    varEmail: 'PMO_VERIFY_EMAIL_TEST',
    varPassword: 'PMO_VERIFY_PASSWORD_TEST',
  },
  prod: {
    url: 'https://app.padelvillage.club/',
    supabaseHost: 'qqbfphyslczzkxoncgex.supabase.co',
    varEmail: 'PMO_VERIFY_EMAIL',
    varPassword: 'PMO_VERIFY_PASSWORD',
  },
};

// Gli altri host Supabase del progetto: se la pagina di un ambiente prova a
// parlare col database di un altro, si ferma tutto. È lo stesso sospetto che
// in CLAUDE.md fa riconoscere TEST in due modi indipendenti.
const HOST_SUPABASE_NOTI = [
  'cudiqnrrlbyqryrtaprd.supabase.co',
  'qqbfphyslczzkxoncgex.supabase.co',
  'aylykijfirtegyxzdwgu.supabase.co',
];

const RPC_DI_LETTURA = /^pmo_(get|can)_/;
// 🚨⭐⭐ 29/08/2026 — LE DUE LETTURE DEL TEST DI LIVELLO, e la lezione che portano con sé.
// La regex qui sopra pretende il prefisso `pmo_`, e le RPC della catena `assessment-*` non ce
// l'hanno: `get_assessment_tokens_admin` e `get_self_assessments_by_tokens` sono **letture**
// che viaggiano in POST (come tutte le RPC di PostgREST) e finivano bloccate come scritture.
// 📏 Il sintomo era muto e credibile: la pagina si apriva, i 2815 soci si caricavano, e
// `assessmentResponses` restava a **0** — cioè la lista del maestro usciva **vuota senza un
// errore**, che è il modo peggiore in cui un attrezzo può sbagliare. Per un giorno intero la
// voce 101 ha dichiarato che il blocco era un permesso mancante (`view_members`) dell'utenza
// `readonly`: era la **guardia dell'attrezzo**, e l'anagrafica si vedeva benissimo.
// ⚖️ Si aggiungono NOMINATE e non allargando la regex a `^get_`: quella sarebbe una regola sul
// **nome**, e un domani un `get_and_lock_…` passerebbe da sola. 📏 E il permesso di entrare non
// l'ha dato il nome nemmeno oggi: letto `prosrc` in `pg_proc` sui due progetti — nessuna
// insert/update/delete dentro. `upsert_assessment_tokens_admin`, che invece ne ha, resta fuori.
const RPC_DI_LETTURA_EXTRA = new Set([
  'pmo_supabase_environment_check',
  'get_assessment_tokens_admin',
  'get_self_assessments_by_tokens',
]);

// Playwright pinna un build di Chromium preciso e lo cerca lì e basta. Il
// container però ne ha UNO solo, installato una volta per tutte in
// /opt/pw-browsers, e quasi mai è quel numero: al primo lancio il browser muore
// con «Executable doesn't exist» e invita a `npx playwright install` — che in
// questo ambiente è esattamente la cosa da non fare (l'immagine è preparata
// apposta per non riscaricare i browser).
//
// Quindi: se il build pinnato c'è, non ci si mette in mezzo e decide Playwright.
// Se non c'è, si ripiega sul Chromium che il container ha davvero.
function trovaChromium() {
  if (process.env.PMO_CHROMIUM_PATH) return process.env.PMO_CHROMIUM_PATH;

  try {
    if (existsSync(chromium.executablePath())) return undefined;   // il build pinnato c'è
  } catch {}                                                       // Playwright non sa dirlo: si ripiega

  const radice = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const candidati = [`${radice}/chromium`];                        // symlink stabile, se c'è
  try {
    for (const d of readdirSync(radice).filter(n => n.startsWith('chromium-')).sort().reverse()) {
      candidati.push(`${radice}/${d}/chrome-linux/chrome`);
    }
  } catch {}

  return candidati.find(p => existsSync(p));                       // undefined = nessuno: lo dirà Playwright
}

// Il magazzino dei certificati di Chromium nasce VUOTO e il proxy di uscita si mette in
// mezzo alle connessioni con una CA propria: senza importarla ogni pagina muore con
// ERR_CERT_AUTHORITY_INVALID mentre `curl` continua a funzionare — il più confondente dei
// tre inciampi del container, perché il sintomo dice «sito irraggiungibile» e la causa è
// qui dentro.
//
// prepara-ambiente.sh andrebbe incollato nel campo "Script di configurazione" dell'ambiente
// cloud, dove gira una volta sola prima di Claude. 📏 Misurato il 15/08 durante il collaudo:
// NON c'era, e il container era crudo — niente certutil, niente magazzino NSS. Un attrezzo
// che dipende da una casella di configurazione che nessuno vede è un attrezzo che si rompe
// nella sessione NUOVA, cioè esattamente quando lo si tira fuori per la prima diagnosi.
//
// Quindi se lo prepara da sé, e lo script resta l'unica fonte: è idempotente e costa nulla
// quando il lavoro è già fatto. Il campo dell'ambiente resta il posto MIGLIORE — lì il costo
// si paga una volta per sessione invece che a ogni lancio — ma non è più obbligatorio.
function preparaContainer() {
  if (process.env.PMO_SALTA_PREPARAZIONE) return 'saltata (PMO_SALTA_PREPARAZIONE)';

  const script = join(dirname(fileURLToPath(import.meta.url)), 'prepara-ambiente.sh');
  if (!existsSync(script)) return 'prepara-ambiente.sh non trovato accanto a console.mjs';

  const esito = spawnSync('bash', [script], { encoding: 'utf8', timeout: 300000 });
  if (esito.error) return `non eseguita: ${esito.error.message}`;

  // Lo script non fallisce mai di proposito (|| true): la sua ultima riga è il verdetto.
  const righe = `${esito.stdout || ''}\n${esito.stderr || ''}`
    .split('\n').map(r => r.trim()).filter(Boolean);
  return (righe.pop() || `uscita ${esito.status}`).replace('[prepara-ambiente] ', '');
}

function leggiArgomenti(argv) {
  const a = { env: null, url: null, eval: null, file: null, shot: null, out: null,
              storageIn: null, storageOut: null, login: true,
              allowWrites: false, attesa: 8000, timeout: 90000,
              // 🆕 02/09/2026 — la finestra era CABLATA a 1440×900, e per un lavoro di layout
              // quella è una misura sola. Le pieghe di questa app stanno a 1024 e a 760px: senza
              // poterci arrivare, «l'ho guardata» vuol dire «l'ho guardata su UNO schermo».
              // 📌 Un attrezzo di diagnosi che sa fare una sola domanda fa credere che ci sia una
              // sola risposta.
              viewport: { width: 1440, height: 900 } };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i], v = () => argv[++i];
    if (k === '--env') a.env = v();
    else if (k === '--url') a.url = v();
    else if (k === '--eval') a.eval = v();
    else if (k === '--file') a.file = v();
    else if (k === '--shot') a.shot = v();
    else if (k === '--out') a.out = v();
    else if (k === '--storage-in') a.storageIn = v();
    else if (k === '--storage-out') a.storageOut = v();
    else if (k === '--no-login') a.login = false;
    else if (k === '--allow-writes') a.allowWrites = true;
    else if (k === '--attesa') a.attesa = Number(v());
    else if (k === '--timeout') a.timeout = Number(v());
    else if (k === '--viewport') {
      const m = /^(\d{2,5})x(\d{2,5})$/.exec(String(v() || ''));
      // ⛔ Fallisce CHIUSA: un valore storpiato non deve ripiegare in silenzio su 1440×900, o la
      // foto direbbe «guardata a 800px» mentre mostra tutt'altro.
      if (!m) throw new Error('--viewport vuole la forma <larghezza>x<altezza>, per esempio 900x1200.');
      a.viewport = { width: Number(m[1]), height: Number(m[2]) };
    }
    else throw new Error(`Argomento sconosciuto: ${k}`);
  }
  if (!a.env || !AMBIENTI[a.env]) {
    throw new Error("Serve --env test | --env prod (nessun valore predefinito: l'ambiente si dichiara).");
  }
  return a;
}

// true = la richiesta può passare. Tutto ciò che non è riconosciuto come
// lettura viene fermato: la guardia sbaglia per eccesso, non per difetto.
function eLettura(method, url) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true;
  const p = url.pathname;
  if (p.startsWith('/auth/v1/')) return true;          // login, refresh, logout
  if (p.startsWith('/functions/v1/')) return false;    // edge → worker → Matchpoint vero
  if (p.startsWith('/rest/v1/rpc/')) {
    const nome = p.slice('/rest/v1/rpc/'.length);
    return RPC_DI_LETTURA.test(nome) || RPC_DI_LETTURA_EXTRA.has(nome);
  }
  return false;                                         // insert su tabella, PATCH, DELETE…
}

const arg = leggiArgomenti(process.argv);
const amb = { ...AMBIENTI[arg.env] };
// --url serve a puntare l'attrezzo su una copia locale dell'app. NON allenta il
// controllo di coerenza: la pagina servita deve comunque usare il database
// dell'ambiente dichiarato, altrimenti si ferma lo stesso.
if (arg.url) amb.url = arg.url;

const codice = arg.file ? readFileSync(arg.file, 'utf8') : arg.eval;
if (!codice) throw new Error('Serve --eval "<codice>" oppure --file <percorso>.');

const email = process.env[amb.varEmail];
const password = process.env[amb.varPassword];
if (arg.login && (!email || !password)) {
  throw new Error(`Credenziali mancanti: imposta ${amb.varEmail} e ${amb.varPassword} fra le variabili d'ambiente.`);
}

const report = {
  ambiente: arg.env,
  url: amb.url,
  scritture: arg.allowWrites ? 'CONSENTITE' : 'bloccate',
  appVersion: null,
  configSupabase: null,
  configFonte: null,
  avvisi: [],
  login: null,
  risultato: undefined,
  console: [],
  erroriPagina: [],
  richiesteBloccate: [],
  richiesteFallite: [],
  hostSupabaseContattati: [],
  screenshot: null,
};

// Prova comportamentale: non "cosa dice di essere" la pagina, ma con quale
// database ha davvero parlato. È l'unica che non si può sbagliare a dichiarare.
const hostVisti = new Set();

if (arg.allowWrites) {
  console.error(`\n  ⚠️  SCRITTURE CONSENTITE su ${arg.env.toUpperCase()} — questa esecuzione può modificare dati veri.\n`);
}

// Prima del browser, la CA del proxy nel suo magazzino (vedi preparaContainer).
report.caProxy = preparaContainer();
if (!/già presente|importata/.test(report.caProxy)) {
  // Non si ferma: un ambiente senza proxy è legittimo e lì non serve nulla. Ma non deve
  // TACERE — se la CA manca davvero, il lancio morirà fra poco con un errore di
  // certificato che sembra un guasto del sito, e questa riga è l'unico posto in cui la
  // vera causa è ancora leggibile.
  console.error(`\n  ⚠️  Preparazione del container: ${report.caProxy}\n      Se le pagine muoiono con ERR_CERT_AUTHORITY_INVALID, la causa è questa, non il sito.\n`);
}

// L'uscita di rete del container passa da un proxy: curl lo legge da HTTPS_PROXY,
// Chromium no — va detto al browser, altrimenti ogni pagina muore con
// ERR_CONNECTION_RESET e sembra un sito irraggiungibile invece di una svista qui.
const proxyServer = process.env.HTTPS_PROXY || process.env.https_proxy || null;
const chromiumPath = trovaChromium();
const browser = await chromium.launch({
  executablePath: chromiumPath,
  ...(proxyServer ? { proxy: { server: proxyServer, bypass: 'localhost,127.0.0.1' } } : {}),
  // Il proxy lascia passare questi host in tunnel cieco (certificato vero, non
  // sostituito) e quel tunnel si spezza sul TLS 1.3 di Chromium: la pagina muore
  // con ERR_CONNECTION_RESET, che sembra un sito irraggiungibile. Con TLS 1.2
  // passa. NON è un allentamento della verifica: il certificato viene validato
  // come prima, cambia solo la versione del protocollo. Da togliere il giorno in
  // cui il tunnel regge il 1.3 — si prova alzando questo tetto.
  args: [`--ssl-version-max=${process.env.PMO_TLS_MAX || 'tls1.2'}`],
});
report.proxy = proxyServer ? 'attivo' : 'nessuno';
report.chromium = chromiumPath || 'quello pinnato da Playwright';
const page = await browser.newPage({ viewport: arg.viewport });
report.viewport = `${arg.viewport.width}x${arg.viewport.height}`;
page.setDefaultTimeout(arg.timeout);

page.on('console', m => report.console.push({ tipo: m.type(), testo: m.text().slice(0, 500) }));
page.on('pageerror', e => report.erroriPagina.push(String(e).slice(0, 500)));
page.on('requestfailed', r => report.richiesteFallite.push({
  url: r.url().slice(0, 200), motivo: r.failure()?.errorText || '',
}));

await page.route('**/*', async route => {
  const req = route.request();
  let url;
  try { url = new URL(req.url()); } catch { return route.continue(); }

  if (HOST_SUPABASE_NOTI.includes(url.hostname)) hostVisti.add(url.hostname);

  const estraneo = HOST_SUPABASE_NOTI.includes(url.hostname) && url.hostname !== amb.supabaseHost;
  if (estraneo) {
    report.richiesteBloccate.push({ metodo: req.method(), url: req.url().slice(0, 200), motivo: 'DATABASE DI UN ALTRO AMBIENTE' });
    return route.abort();
  }

  if (!arg.allowWrites && url.hostname === amb.supabaseHost && !eLettura(req.method(), url)) {
    report.richiesteBloccate.push({ metodo: req.method(), url: req.url().slice(0, 200), motivo: 'scrittura (sola lettura attiva)' });
    return route.abort();
  }

  return route.continue();
});

if (arg.storageIn) {
  const dati = JSON.parse(readFileSync(arg.storageIn, 'utf8'));
  await page.addInitScript(d => {
    try { for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v); } catch (e) {}
  }, dati);
}

try {
  await page.goto(amb.url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(arg.attesa);

  // A questo punto PADEL_CONFIG non c'è ancora: l'app lo carica pigramente, al
  // primo login. Qui si prende solo ciò che è già disponibile; la coerenza
  // dell'ambiente si verifica sotto, dopo il login.
  const cfg = await page.evaluate(() => ({
    titolo: document.title || '',
    forceEnv: window.PMO_FORCE_ENV || null,
    baseUrl: window.PMO_PUBLIC_BASE_URL || null,
  }));
  report.appVersion = (cfg.titolo.match(/v([\d.]+)/) || [])[1] || null;
  report.forceEnv = cfg.forceEnv;

  if (arg.login) {
    /* 🔁 SI RIPROVA, e non è pignoleria: l'APP aborta il login da sé dopo 20 secondi
       (`PMO_SUPABASE_AUTH_TIMEOUT_MS`), e in una giornata in cui il database è lento
       l'autenticazione ci mette di più. Premere «Accedi» UNA volta sola rendeva l'attrezzo
       inutilizzabile proprio nel momento in cui serve per diagnosticare.
       📏 Misurato il 05/09/2026, durante l'avaria del database di PROD: quattro tentativi di
       fila caduti tutti sullo stesso «Accesso non completato entro 20 secondi», mentre una
       lettura REST passava in 5 secondi. ⇒ Non era il gestionale a essere irraggiungibile: era
       l'attrezzo a chiedere una volta e ad arrendersi.
       📌 *Uno strumento di diagnosi che non regge la giornata storta non c'è proprio, perché la
          giornata storta è l'unica in cui serve.* */
    const TENTATIVI_LOGIN = 5;
    let ultimoMsg = '';
    for (let t = 1; t <= TENTATIVI_LOGIN; t++) {
      await page.fill('#pmoStaffEmail', email);
      await page.fill('#pmoStaffAuthPassword', password);
      await page.click('#pmoLoginButton');
      try {
        await page.waitForFunction(
          () => document.body.classList.contains('pmo-auth-unlocked') ||
                getComputedStyle(document.getElementById('pmoLoginOverlay')).display === 'none',
          { timeout: 45000 }
        );
        report.login = t === 1 ? 'ok' : `ok (al ${t}º tentativo)`;
        break;
      } catch {
        ultimoMsg = await page.evaluate(() => document.getElementById('pmoLoginMessage')?.textContent || '');
        if (t === TENTATIVI_LOGIN) {
          throw new Error(`Login non riuscito dopo ${TENTATIVI_LOGIN} tentativi: ${ultimoMsg || 'nessun messaggio dalla pagina'}`);
        }
        // Si respira fra un tentativo e l'altro: insistere su un'autenticazione in affanno la
        // peggiora, e il tempo che si aspetta è quello che le serve per riprendersi.
        await page.waitForTimeout(4000 * t);
      }
    }
    await page.waitForTimeout(arg.attesa);
  } else {
    report.login = 'saltato';
  }

  // Controprova, ora che il login ha costretto l'app a leggere la sua
  // configurazione: l'ambiente su cui sto lavorando è quello dichiarato?
  // Che cosa la pagina DICE di essere. Si guardano due posti, non uno.
  //
  // Il motivo storico: su PROD `PADEL_CONFIG` restava **undefined** dopo il login, e chi
  // si fermava lì otteneva `null`, saltava il confronto in silenzio e lasciava questa metà
  // della guardia inerte proprio dove sbagliare costa. 📏 Dal 15/08 non è più così — PROD
  // 6.231 (#734, «la configurazione Supabase si ricorda anche in produzione») lo popola, e
  // il collaudo lo legge da `PADEL_CONFIG.SUPABASE_URL` su ENTRAMBI gli ambienti.
  //
  // ⚠️ Il ripiego resta, e non per inerzia: quel campo è popolato da una funzione dell'app,
  // quindi la sua presenza è una proprietà della VERSIONE che sta in pagina, non un fatto
  // stabile. La console gira anche su versioni vecchie e su `--url` che punta a copie
  // locali. Una guardia che si fida di un campo apparso ieri torna cieca il giorno in cui
  // qualcuno lo tocca — e torna cieca **in silenzio**, che è il difetto originale.
  const dichiarato = await page.evaluate(() => {
    const url = window.PADEL_CONFIG?.SUPABASE_URL || null;
    if (url) { try { return { ref: new URL(url).hostname.split('.')[0], fonte: 'PADEL_CONFIG.SUPABASE_URL', url }; } catch {} }
    try {
      const ref = typeof pmoExpectedSupabaseProjectRef === 'function' ? pmoExpectedSupabaseProjectRef() : null;
      if (ref) return { ref, fonte: 'pmoExpectedSupabaseProjectRef()', url: `https://${ref}.supabase.co` };
    } catch {}
    return null;
  });
  report.configSupabase = dichiarato?.url || null;
  report.configFonte = dichiarato?.fonte || null;

  const refAtteso = amb.supabaseHost.split('.')[0];
  if (dichiarato && dichiarato.ref !== refAtteso) {
    throw new Error(`AMBIENTE INCOERENTE: ho chiesto ${arg.env} (${amb.supabaseHost}) ma la pagina dichiara ${dichiarato.ref} (letto da ${dichiarato.fonte}). Fermo tutto prima di eseguire lo snippet.`);
  }
  if (!dichiarato) {
    // Non si ferma: la controprova comportamentale qui sotto è quella forte, e
    // fermarsi qui renderebbe l'attrezzo inservibile su una pagina che non
    // espone la sua configurazione. Ma non deve TACERE: un controllo saltato
    // che non lascia traccia si legge come un controllo superato.
    report.avvisi = [...(report.avvisi || []),
      'Guardia dichiarato/reale SALTATA: la pagina non espone né PADEL_CONFIG.SUPABASE_URL né pmoExpectedSupabaseProjectRef(). Resta valida la sola prova comportamentale (hostSupabaseContattati).'];
    console.error('\n  ⚠️  Guardia dichiarato/reale saltata: la pagina non dichiara il suo database. Vale solo la prova comportamentale.\n');
  }
  const estranei = [...hostVisti].filter(h => h !== amb.supabaseHost);
  if (estranei.length) {
    throw new Error(`AMBIENTE INCOERENTE: la pagina ha provato a contattare ${estranei.join(', ')}, che non è il database di ${arg.env}. Fermo tutto.`);
  }

  report.risultato = await page.evaluate(async src => {
    const fn = new Function(`return (async () => { ${src} })()`);
    const out = await fn();
    try { JSON.parse(JSON.stringify(out ?? null)); return out ?? null; }
    catch { return String(out); }
  }, codice);

  if (arg.shot) { await page.screenshot({ path: arg.shot, fullPage: false }); report.screenshot = arg.shot; }
  if (arg.storageOut) {
    const dump = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
    writeFileSync(arg.storageOut, JSON.stringify(dump, null, 2));
  }
  report.hostSupabaseContattati = [...hostVisti];
} catch (err) {
  report.hostSupabaseContattati = [...hostVisti];
  report.errore = String(err.message || err);
  if (arg.shot) { try { await page.screenshot({ path: arg.shot }); report.screenshot = arg.shot; } catch {} }
} finally {
  await browser.close();
}

const testo = JSON.stringify(report, null, 2);
if (arg.out) writeFileSync(arg.out, testo);
console.log(testo);
process.exit(report.errore ? 1 : 0);
