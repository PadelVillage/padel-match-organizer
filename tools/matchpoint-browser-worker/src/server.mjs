import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const DEFAULT_BASE_URL = 'https://app-padelvillage-it.matchpoint.com.es';
const DEFAULT_CLIENTS_PATH = '/clientes/Listadoclientes.aspx?pagesize=15';
const DEFAULT_EXPORT_TARGET = 'ctl01$ctl00$CC$ContentPlaceHolderAcciones$LinkButtonExportar';
const MAX_BODY_BYTES = 64 * 1024;

function clean(value) {
  return String(value ?? '').trim();
}

function env(name, fallback = '') {
  return clean(process.env[name] || fallback);
}

function boolEnv(name, fallback = true) {
  const value = clean(process.env[name]);
  if (!value) return fallback;
  return !['0', 'false', 'no', 'off'].includes(value.toLowerCase());
}

function json(res, status, body) {
  const text = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        const error = new Error('REQUEST_BODY_TOO_LARGE');
        error.status = 413;
        reject(error);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text) return resolve({});
      try {
        resolve(JSON.parse(text));
      } catch (error) {
        reject(new Error(`INVALID_JSON:${error.message}`));
      }
    });
    req.on('error', reject);
  });
}

function requireWorkerAuth(req) {
  const apiKey = env('MATCHPOINT_WORKER_API_KEY');
  if (!apiKey) {
    const error = new Error('MATCHPOINT_WORKER_API_KEY_MISSING');
    error.status = 500;
    throw error;
  }
  const auth = clean(req.headers.authorization || '');
  if (auth !== `Bearer ${apiKey}`) {
    const error = new Error('WORKER_UNAUTHORIZED');
    error.status = 401;
    throw error;
  }
}

function fail(code, message, diagnostic = {}) {
  const error = new Error(message || code);
  error.code = code;
  error.diagnostic = diagnostic;
  return error;
}

function absoluteUrl(baseUrl, pathOrUrl) {
  return new URL(pathOrUrl, baseUrl).toString();
}

async function visibleCount(locator) {
  const count = await locator.count().catch(() => 0);
  let visible = 0;
  for (let i = 0; i < Math.min(count, 8); i += 1) {
    if (await locator.nth(i).isVisible().catch(() => false)) visible += 1;
  }
  return visible;
}

async function clickFirstVisibleWithDownload(page, targetContext, selector, diagnostic) {
  const locator = targetContext.locator(selector);
  const count = await locator.count().catch(() => 0);
  diagnostic.exportSelectorAttempts.push({ selector, count });
  for (let i = 0; i < Math.min(count, 8); i += 1) {
    const item = locator.nth(i);
    if (!(await item.isVisible().catch(() => false))) continue;
    const downloadPromise = page.waitForEvent('download', { timeout: 45000 });
    await item.click({ timeout: 10000, noWaitAfter: true });
    return downloadPromise;
  }
  return null;
}

async function clickFirstVisibleLocator(locator, actionName, diagnostic, timeout = 10000) {
  const count = await locator.count().catch(() => 0);
  diagnostic.navigationAttempts = diagnostic.navigationAttempts || [];
  diagnostic.navigationAttempts.push({ action: actionName, count });
  for (let i = 0; i < Math.min(count, 12); i += 1) {
    const item = locator.nth(i);
    if (!(await item.isVisible().catch(() => false))) continue;
    await item.click({ timeout, noWaitAfter: true });
    diagnostic.navigationAttempts.push({ action: actionName, clickedIndex: i });
    return true;
  }
  return false;
}

async function clickMenuEntry(page, label, actionName, diagnostic) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const locators = [
    page.locator(`a:has-text("${label}"), button:has-text("${label}"), [role="button"]:has-text("${label}")`),
    page.getByText(label, { exact: true }),
    page.locator(`text=/${escaped}/i`),
  ];
  for (const locator of locators) {
    if (await clickFirstVisibleLocator(locator, actionName, diagnostic)) return true;
  }
  return false;
}

function pageContentContexts(page) {
  const frames = page.frames().filter((frame) => frame !== page.mainFrame());
  return [
    { kind: 'page', index: 0, target: page, url: page.url() },
    ...frames.map((frame, index) => ({
      kind: 'frame',
      index,
      target: frame,
      url: frame.url(),
    })),
  ];
}

async function readContextTitle(target) {
  if (typeof target.title === 'function') {
    return target.title().catch(() => '');
  }
  return target.evaluate(() => document.title || '').catch(() => '');
}

async function readContextBody(target, timeout = 1200) {
  return target.locator('body').innerText({ timeout }).catch(() => '');
}

async function findPlayersExportContext(page, diagnostic, timeout = 45000) {
  const deadline = Date.now() + timeout;
  let samples = [];
  while (Date.now() < deadline) {
    samples = [];
    for (const entry of pageContentContexts(page)) {
      const bodyText = await readContextBody(entry.target);
      const compactText = bodyText.replace(/\s+/g, ' ').trim();
      const playersPageFound = compactText.includes('Giocatori');
      const playersExportFound = /Esportare\s+in\s+excel/i.test(compactText);
      const sample = {
        kind: entry.kind,
        index: entry.index,
        url: entry.url,
        playersPageFound,
        playersExportFound,
        bodySample: compactText.slice(0, 500),
      };
      samples.push(sample);
      if (playersPageFound && playersExportFound) {
        diagnostic.playersContext = sample;
        diagnostic.playersUrl = entry.url;
        diagnostic.playersTitle = await readContextTitle(entry.target);
        diagnostic.playersPageFound = true;
        diagnostic.playersExportFound = true;
        return entry.target;
      }
    }
    await page.waitForTimeout(600);
  }
  diagnostic.playersContextSamples = samples;
  return null;
}

async function navigateToPlayersList(page, diagnostic) {
  diagnostic.steps.push('players_menu_open');
  const menuClicked = await clickMenuEntry(page, 'Programmazione', 'open_programmazione_menu', diagnostic);
  if (!menuClicked) {
    throw fail('MATCHPOINT_PLAYERS_MENU_NOT_FOUND', 'Menu Programmazione non trovato nel worker browser.', {
      url: page.url(),
      title: await page.title().catch(() => ''),
      navigationAttempts: diagnostic.navigationAttempts || [],
    });
  }
  await page.waitForTimeout(800);

  diagnostic.steps.push('players_menu_click');
  const playersClicked = await clickMenuEntry(page, 'Elenco dei giocatori', 'click_elenco_giocatori', diagnostic);
  if (!playersClicked) {
    throw fail('MATCHPOINT_PLAYERS_LIST_NOT_FOUND', 'Voce Elenco dei giocatori non trovata nel menu Programmazione.', {
      url: page.url(),
      title: await page.title().catch(() => ''),
      navigationAttempts: diagnostic.navigationAttempts || [],
    });
  }

  await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const exportContext = await findPlayersExportContext(page, diagnostic);
  if (!exportContext) {
    throw fail('MATCHPOINT_PLAYERS_PAGE_NOT_READY', 'Pagina Elenco giocatori non pronta o pulsante export non trovato.', {
      url: page.url(),
      title: await page.title().catch(() => ''),
      playersContextSamples: diagnostic.playersContextSamples || [],
      navigationAttempts: diagnostic.navigationAttempts || [],
    });
  }
  return exportContext;
}

async function triggerPostbackDownload(page, targetContext, target, diagnostic) {
  if (!target) return null;
  diagnostic.exportPostbackTarget = target;
  const downloadPromise = page.waitForEvent('download', { timeout: 45000 });
  await targetContext.evaluate((postbackTarget) => {
    if (typeof window.__doPostBack === 'function') {
      window.__doPostBack(postbackTarget, '');
      return;
    }
    const eventTarget = document.querySelector('input[name="__EVENTTARGET"]');
    const eventArgument = document.querySelector('input[name="__EVENTARGUMENT"]');
    if (eventTarget) eventTarget.value = postbackTarget;
    if (eventArgument) eventArgument.value = '';
    const form = document.forms[0];
    if (!form) throw new Error('FORM_NOT_FOUND');
    form.submit();
  }, target);
  return downloadPromise;
}

async function triggerExportDownload(page, exportContext, exportTarget, diagnostic) {
  diagnostic.exportSelectorAttempts = [];
  const selectors = [
    'button:has-text("Esportare in excel"), a:has-text("Esportare in excel"), input[value*="Esportare in excel"]',
    'button:has-text("Esportare"), a:has-text("Esportare"), input[value*="Esportare"]',
    '#ctl01_ctl00_CC_ContentPlaceHolderAcciones_LinkButtonExportar',
    '[id$="LinkButtonExportar"]',
    '[name$="LinkButtonExportar"]',
    'a[href*="LinkButtonExportar"]',
    'input[id*="Exportar"], button[id*="Exportar"], a[id*="Exportar"]',
    'input[name*="Exportar"], button[name*="Exportar"], a[name*="Exportar"]',
    'input[value*="Excel"], button:has-text("Excel"), a:has-text("Excel")',
    'input[value*="Export"], button:has-text("Export"), a:has-text("Export")',
    'input[value*="Esporta"], button:has-text("Esporta"), a:has-text("Esporta")',
    'input[value*="Scarica"], button:has-text("Scarica"), a:has-text("Scarica")',
  ];

  for (const selector of selectors) {
    const download = await clickFirstVisibleWithDownload(page, exportContext, selector, diagnostic).catch((error) => {
      diagnostic.exportSelectorAttempts.push({ selector, error: error.message });
      return null;
    });
    if (download) return download;
  }

  const postbackDownload = await triggerPostbackDownload(page, exportContext, exportTarget, diagnostic).catch((error) => {
    diagnostic.exportPostbackError = error.message;
    return null;
  });
  if (postbackDownload) return postbackDownload;

  throw fail('MATCHPOINT_EXPORT_BUTTON_NOT_FOUND', 'Pulsante export clienti non trovato nel browser worker.', {
    url: page.url(),
    title: await page.title().catch(() => ''),
    exportSelectorAttempts: diagnostic.exportSelectorAttempts,
    exportPostbackError: diagnostic.exportPostbackError || '',
  });
}

async function maybeClickCashEnter(page, diagnostic) {
  const selectors = [
    '#btnAcceder',
    '[id*="Acceder"]',
    '[name*="Acceder"]',
    'input[value*="Entra"]',
    'input[value*="Accedi"]',
    'input[value*="Acceder"]',
    'button:has-text("Entra")',
    'button:has-text("Accedi")',
    'button:has-text("Acceder")',
    'a:has-text("Entra")',
    'a:has-text("Accedi")',
    'a:has-text("Acceder")',
  ];
  for (const selector of selectors) {
    const locator = page.locator(selector);
    if ((await visibleCount(locator)) <= 0) continue;
    diagnostic.cashEnterSelector = selector;
    await Promise.all([
      page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {}),
      locator.first().click({ timeout: 10000 }),
    ]);
    await page.waitForTimeout(1500);
    return true;
  }
  return false;
}

async function bufferFromDownload(download) {
  const stream = await download.createReadStream();
  if (!stream) throw fail('MATCHPOINT_DOWNLOAD_STREAM_MISSING', 'Download Matchpoint non leggibile.');
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function exportClientsWithBrowser(options = {}) {
  const username = clean(options.username) || env('MATCHPOINT_USERNAME');
  const password = clean(options.password) || env('MATCHPOINT_PASSWORD');
  if (!username || !password) {
    throw fail('MATCHPOINT_WORKER_SECRETS_MISSING', 'Mancano credenziali Matchpoint nel worker o nella richiesta server-to-server.');
  }

  const baseUrl = clean(options.baseUrl) || env('MATCHPOINT_BASE_URL', DEFAULT_BASE_URL);
  const clientsPath = clean(options.clientsPath) || env('MATCHPOINT_CLIENTS_PATH', DEFAULT_CLIENTS_PATH);
  const exportTarget = clean(options.exportTarget) || env('MATCHPOINT_EXPORT_TARGET', DEFAULT_EXPORT_TARGET);
  const navigationMode = clean(options.navigationMode) || env('MATCHPOINT_BROWSER_NAVIGATION_MODE', 'players_menu');
  const diagnostic = {
    mode: 'browser_worker_headless',
    baseUrl,
    clientsPath,
    navigationMode,
    startedAt: new Date().toISOString(),
    steps: [],
  };

  const browser = await chromium.launch({
    headless: boolEnv('MATCHPOINT_HEADLESS', true),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const context = await browser.newContext({
      acceptDownloads: true,
      locale: 'it-IT',
      timezoneId: 'Europe/Rome',
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
    });
    const page = await context.newPage();

    diagnostic.steps.push('login_page');
    await page.goto(absoluteUrl(baseUrl, '/Login.aspx'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('#username, input[name="username"]').first().fill(username, { timeout: 20000 });
    await page.locator('#password, input[name="password"]').first().fill(password, { timeout: 20000 });
    const language = page.locator('select[name="ddlLenguaje"]');
    if (await language.count().catch(() => 0)) {
      await language.first().selectOption('it-IT', { timeout: 5000 }).catch(() => {});
    }

    diagnostic.steps.push('login_submit');
    await Promise.all([
      page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {}),
      page.locator('#btnLogin, input[name="btnLogin"]').first().click({ timeout: 15000 }),
    ]);
    await page.waitForTimeout(2500);
    diagnostic.loginUrl = page.url();
    diagnostic.loginTitle = await page.title().catch(() => '');

    if (/Login\.aspx/i.test(page.url()) && await page.locator('input[type="password"]').count().catch(() => 0)) {
      throw fail('MATCHPOINT_BROWSER_LOGIN_FAILED', 'Login Matchpoint non riuscito nel worker browser.', {
        url: page.url(),
        title: diagnostic.loginTitle,
        hasPasswordField: true,
      });
    }

    await maybeClickCashEnter(page, diagnostic);
    diagnostic.afterCashUrl = page.url();

    let exportContext = page;
    if (navigationMode === 'direct_clients') {
      diagnostic.steps.push('clients_page');
      await page.goto(absoluteUrl(baseUrl, clientsPath), { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
      diagnostic.clientsUrl = page.url();
      diagnostic.clientsTitle = await page.title().catch(() => '');

      if (/Login\.aspx/i.test(page.url())) {
        throw fail('MATCHPOINT_BROWSER_CLIENTS_NOT_AUTHENTICATED', 'Pagina clienti non autenticata nel worker browser.', {
          url: page.url(),
          title: diagnostic.clientsTitle,
        });
      }
      if (/Error\.aspx|aspxerrorpath=/i.test(page.url())) {
        throw fail('MATCHPOINT_BROWSER_CLIENTS_PAGE_ERROR', 'Matchpoint ha aperto una pagina errore al posto dei clienti.', {
          url: page.url(),
          title: diagnostic.clientsTitle,
        });
      }
    } else {
      exportContext = await navigateToPlayersList(page, diagnostic);
    }

    diagnostic.steps.push('export_click');
    const download = await triggerExportDownload(page, exportContext, exportTarget, diagnostic);
    const filename = download.suggestedFilename() || `matchpoint-clienti-${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
    const bytes = await bufferFromDownload(download);
    diagnostic.downloadedAt = new Date().toISOString();
    diagnostic.filename = filename;
    diagnostic.byteLength = bytes.byteLength;

    if (!bytes.byteLength) {
      throw fail('MATCHPOINT_BROWSER_EMPTY_DOWNLOAD', 'Download clienti Matchpoint vuoto.', diagnostic);
    }

    return {
      ok: true,
      filename,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      base64: bytes.toString('base64'),
      diagnostic,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

async function handleExport(req, res) {
  requireWorkerAuth(req);
  const body = await readBody(req);
  const result = await exportClientsWithBrowser(body);
  json(res, 200, result);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      return json(res, 200, {
        ok: true,
        service: 'pmo-matchpoint-browser-worker',
        time: new Date().toISOString(),
      });
    }
    if (req.method === 'POST' && req.url === '/export-clients') {
      return await handleExport(req, res);
    }
    return json(res, 404, { ok: false, error: 'NOT_FOUND' });
  } catch (error) {
    const status = error.status || 500;
    json(res, status, {
      ok: false,
      error: error.code || error.message || 'WORKER_ERROR',
      message: error.message || 'Errore worker Matchpoint.',
      diagnostic: error.diagnostic || null,
    });
  }
});

const port = Number(env('PORT', '8787'));
server.listen(port, () => {
  console.log(JSON.stringify({
    event: 'matchpoint_browser_worker_started',
    port,
    headless: boolEnv('MATCHPOINT_HEADLESS', true),
  }));
});
