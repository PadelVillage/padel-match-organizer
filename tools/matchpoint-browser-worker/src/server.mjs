import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const DEFAULT_BASE_URL = 'https://app-padelvillage-it.matchpoint.com.es';
const DEFAULT_CLIENTS_PATH = '/clientes/Listadoclientes.aspx?pagesize=15';
const DEFAULT_PLAYERS_PATH = '/Reservas/ListadoJugadores.aspx';
const DEFAULT_EXPORT_TARGET = 'ctl01$ctl00$CC$ContentPlaceHolderAcciones$LinkButtonExportar';
const DEFAULT_HISTORY_DAYS = 30;
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

function parseIsoDate(value) {
  const raw = clean(value);
  if (!raw) return '';
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    const year = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
    return `${year}-${slash[2].padStart(2, '0')}-${slash[1].padStart(2, '0')}`;
  }
  return '';
}

function todayIsoRome() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDaysIso(isoDate, days) {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return '';
  const [year, month, day] = parsed.split('-').map((item) => parseInt(item, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isoToItalianDate(isoDate) {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return '';
  const [year, month, day] = parsed.split('-');
  return `${day}/${month}/${year}`;
}

function resolveHistoryRange(options = {}) {
  const toDate = parseIsoDate(options.toDate) || todayIsoRome();
  const days = Math.max(1, Math.min(120, parseInt(options.days ?? DEFAULT_HISTORY_DAYS, 10) || DEFAULT_HISTORY_DAYS));
  const fromDate = parseIsoDate(options.fromDate) || addDaysIso(toDate, -days);
  return {
    fromDate,
    toDate,
    fromDisplay: isoToItalianDate(fromDate),
    toDisplay: isoToItalianDate(toDate),
    days,
  };
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

async function clickMenuEntryByDomText(targetContext, label, actionName, diagnostic) {
  const result = await targetContext.evaluate((wantedLabel) => {
    const normalize = (value) => String(value || '')
      .toLocaleLowerCase('it-IT')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const wanted = normalize(wantedLabel);
    const isVisible = (el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };
    const nodes = [...document.querySelectorAll('a, button, [role="button"], [onclick], li, span, div')];
    const candidates = nodes
      .filter((el) => isVisible(el) && normalize(el.textContent).includes(wanted))
      .slice(0, 20)
      .map((el) => {
        const action = el.closest('a[href], button, [role="button"], [onclick]') || el;
        return {
          text: String(el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160),
          tag: action.tagName,
          href: action.getAttribute('href') || '',
          id: action.id || '',
          className: String(action.className || '').slice(0, 160),
          hasOnclick: !!action.getAttribute('onclick'),
        };
      });
    const found = nodes.find((el) => isVisible(el) && normalize(el.textContent).includes(wanted));
    if (!found) return { clicked: false, candidates };
    const action = found.closest('a[href], button, [role="button"], [onclick]') || found;
    action.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
    action.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    action.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    action.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return {
      clicked: true,
      candidate: {
        text: String(found.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160),
        tag: action.tagName,
        href: action.getAttribute('href') || '',
        id: action.id || '',
        className: String(action.className || '').slice(0, 160),
        hasOnclick: !!action.getAttribute('onclick'),
      },
      candidates,
    };
  }, label).catch((error) => ({ clicked: false, error: error.message, candidates: [] }));
  diagnostic.navigationAttempts = diagnostic.navigationAttempts || [];
  diagnostic.navigationAttempts.push({ action: `${actionName}_dom_text`, clicked: !!result.clicked, candidate: result.candidate || null, candidates: result.candidates || [], error: result.error || '' });
  return !!result.clicked;
}

async function clickMenuEntry(targetContext, label, actionName, diagnostic) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const labelRe = new RegExp(escaped, 'i');
  const locators = [
    targetContext.locator('a, button, [role="button"], [onclick]').filter({ hasText: labelRe }),
    targetContext.locator(`a:has-text("${label}"), button:has-text("${label}"), [role="button"]:has-text("${label}")`),
    targetContext.getByText(label, { exact: true }),
    targetContext.locator(`text=/${escaped}/i`),
  ];
  for (const locator of locators) {
    if (await clickFirstVisibleLocator(locator, actionName, diagnostic)) return true;
  }
  return clickMenuEntryByDomText(targetContext, label, actionName, diagnostic);
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

async function contextSamples(page, timeout = 1200) {
  const samples = [];
  for (const entry of pageContentContexts(page)) {
    const bodyText = await readContextBody(entry.target, timeout);
    samples.push({
      kind: entry.kind,
      index: entry.index,
      url: entry.url,
      bodySample: bodyText.replace(/\s+/g, ' ').trim().slice(0, 1400),
    });
  }
  return samples;
}

async function clickMenuEntryEverywhere(page, label, actionName, diagnostic) {
  for (const entry of pageContentContexts(page)) {
    if (await clickMenuEntry(entry.target, label, `${actionName}_${entry.kind}_${entry.index}`, diagnostic)) {
      diagnostic.navigationAttempts = diagnostic.navigationAttempts || [];
      diagnostic.navigationAttempts.push({ action: actionName, contextKind: entry.kind, contextIndex: entry.index, contextUrl: entry.url });
      return true;
    }
  }
  return false;
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

async function navigateDirectToPlayersList(page, baseUrl, playersPath, diagnostic, reason) {
  diagnostic.steps.push('players_direct_fallback');
  diagnostic.navigationAttempts = diagnostic.navigationAttempts || [];
  diagnostic.navigationAttempts.push({
    action: 'direct_players_page',
    reason,
    path: playersPath,
  });
  await page.goto(absoluteUrl(baseUrl, playersPath), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(1500);
  diagnostic.directPlayersUrl = page.url();
  diagnostic.directPlayersTitle = await page.title().catch(() => '');

  if (/Login\.aspx/i.test(page.url())) {
    diagnostic.directPlayersError = 'MATCHPOINT_DIRECT_PLAYERS_NOT_AUTHENTICATED';
    return null;
  }
  if (/Error\.aspx|aspxerrorpath=/i.test(page.url())) {
    diagnostic.directPlayersError = 'MATCHPOINT_DIRECT_PLAYERS_PAGE_ERROR';
    return null;
  }
  return findPlayersExportContext(page, diagnostic, 20000);
}

async function navigateToPlayersList(page, baseUrl, playersPath, diagnostic) {
  diagnostic.steps.push('players_menu_open');
  const menuClicked = await clickMenuEntry(page, 'Programmazione', 'open_programmazione_menu', diagnostic);
  if (!menuClicked) {
    const directContext = await navigateDirectToPlayersList(page, baseUrl, playersPath, diagnostic, 'programmazione_menu_missing');
    if (directContext) return directContext;
    throw fail('MATCHPOINT_PLAYERS_MENU_NOT_FOUND', 'Menu Programmazione non trovato nel worker browser.', {
      url: page.url(),
      title: await page.title().catch(() => ''),
      navigationAttempts: diagnostic.navigationAttempts || [],
      directPlayersUrl: diagnostic.directPlayersUrl || '',
      directPlayersError: diagnostic.directPlayersError || '',
      playersContextSamples: diagnostic.playersContextSamples || [],
    });
  }
  await page.waitForTimeout(800);

  diagnostic.steps.push('players_menu_click');
  const playersClicked = await clickMenuEntry(page, 'Elenco dei giocatori', 'click_elenco_giocatori', diagnostic);
  if (!playersClicked) {
    const directContext = await navigateDirectToPlayersList(page, baseUrl, playersPath, diagnostic, 'elenco_giocatori_menu_missing');
    if (directContext) return directContext;
    throw fail('MATCHPOINT_PLAYERS_LIST_NOT_FOUND', 'Voce Elenco dei giocatori non trovata nel menu Programmazione.', {
      url: page.url(),
      title: await page.title().catch(() => ''),
      navigationAttempts: diagnostic.navigationAttempts || [],
      directPlayersUrl: diagnostic.directPlayersUrl || '',
      directPlayersError: diagnostic.directPlayersError || '',
      playersContextSamples: diagnostic.playersContextSamples || [],
    });
  }

  await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const exportContext = await findPlayersExportContext(page, diagnostic);
  if (!exportContext) {
    const directContext = await navigateDirectToPlayersList(page, baseUrl, playersPath, diagnostic, 'players_page_not_ready');
    if (directContext) return directContext;
  }
  if (!exportContext) {
    throw fail('MATCHPOINT_PLAYERS_PAGE_NOT_READY', 'Pagina Elenco giocatori non pronta o pulsante export non trovato.', {
      url: page.url(),
      title: await page.title().catch(() => ''),
      playersContextSamples: diagnostic.playersContextSamples || [],
      navigationAttempts: diagnostic.navigationAttempts || [],
      directPlayersUrl: diagnostic.directPlayersUrl || '',
      directPlayersError: diagnostic.directPlayersError || '',
    });
  }
  return exportContext;
}

async function findHistoryReportContext(page, diagnostic, timeout = 45000) {
  const deadline = Date.now() + timeout;
  let samples = [];
  while (Date.now() < deadline) {
    samples = [];
    for (const entry of pageContentContexts(page)) {
      const bodyText = await readContextBody(entry.target);
      const compactText = bodyText.replace(/\s+/g, ' ').trim();
      const historyPageFound = /Utenti\s+negli\s+spazi|Elenco\s+degli\s+utenti\s+negli\s+spazi|Spazi\s+occupati|Elenco\s+degli\s+spazi\s+occupati/i.test(compactText);
      const dateFiltersFound = /Dal\s+Giorno/i.test(compactText) && /Al\s+Giorno/i.test(compactText);
      const generateButtonFound = /Generare\s+una\s+relazione|Genera(?:re)?\s+relazione|Relazione/i.test(compactText);
      const sample = {
        kind: entry.kind,
        index: entry.index,
        url: entry.url,
        historyPageFound,
        dateFiltersFound,
        generateButtonFound,
        bodySample: compactText.slice(0, 500),
      };
      samples.push(sample);
      if (historyPageFound && dateFiltersFound) {
        diagnostic.historyReportContext = sample;
        diagnostic.historyReportUrl = entry.url;
        diagnostic.historyReportTitle = await readContextTitle(entry.target);
        diagnostic.historyPageFound = true;
        diagnostic.historyGenerateButtonFound = true;
        return entry.target;
      }
    }
    await page.waitForTimeout(600);
  }
  diagnostic.historyReportContextSamples = samples;
  return null;
}

async function findHistoryResultsContext(page, diagnostic, timeout = 45000) {
  const deadline = Date.now() + timeout;
  let samples = [];
  while (Date.now() < deadline) {
    samples = [];
    for (const entry of pageContentContexts(page)) {
      const bodyText = await readContextBody(entry.target);
      const compactText = bodyText.replace(/\s+/g, ' ').trim();
      const exportFound = /Esportare\s+in\s+excel/i.test(compactText);
      const historyTableFound = /Utenti\s+negli\s+spazi|Cod\.\s+Identificatore\s+Nome|Giorno\s+Ora\s+Ore/i.test(compactText);
      const sample = {
        kind: entry.kind,
        index: entry.index,
        url: entry.url,
        exportFound,
        historyTableFound,
        bodySample: compactText.slice(0, 500),
      };
      samples.push(sample);
      if (exportFound && historyTableFound) {
        diagnostic.historyResultsContext = sample;
        diagnostic.historyResultsUrl = entry.url;
        diagnostic.historyResultsTitle = await readContextTitle(entry.target);
        return entry.target;
      }
    }
    await page.waitForTimeout(600);
  }
  diagnostic.historyResultsContextSamples = samples;
  return null;
}

async function navigateToHistoryReport(page, diagnostic) {
  diagnostic.steps.push('stats_menu_open');
  const statsClicked = await clickMenuEntryEverywhere(page, 'Inf. e statistiche', 'open_inf_statistiche_menu', diagnostic);
  if (!statsClicked) {
    throw fail('MATCHPOINT_STATS_MENU_NOT_FOUND', 'Menu Inf. e statistiche non trovato nel worker browser.', {
      url: page.url(),
      title: await page.title().catch(() => ''),
      navigationAttempts: diagnostic.navigationAttempts || [],
      contextSamples: await contextSamples(page),
    });
  }
  await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2500);

  diagnostic.steps.push('history_occupancy_click');
  let historyClicked = false;
  const historyLabels = [
    'Elenco degli utenti negli spazi',
    'Elenco degli spazi occupati',
  ];
  for (const label of historyLabels) {
    historyClicked = await clickMenuEntryEverywhere(page, label, `click_${label.toLowerCase().replace(/\s+/g, '_')}`, diagnostic);
    if (historyClicked) break;
  }
  if (!historyClicked) {
    throw fail('MATCHPOINT_HISTORY_LINK_NOT_FOUND', 'Voce Elenco degli utenti negli spazi non trovata nel capitolo Occupazione.', {
      url: page.url(),
      title: await page.title().catch(() => ''),
      navigationAttempts: diagnostic.navigationAttempts || [],
      contextSamples: await contextSamples(page),
    });
  }
  await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const reportContext = await findHistoryReportContext(page, diagnostic);
  if (!reportContext) {
    throw fail('MATCHPOINT_HISTORY_PAGE_NOT_READY', 'Pagina storico Matchpoint non pronta o pulsante relazione non trovato.', {
      url: page.url(),
      title: await page.title().catch(() => ''),
      historyReportContextSamples: diagnostic.historyReportContextSamples || [],
      navigationAttempts: diagnostic.navigationAttempts || [],
    });
  }
  return reportContext;
}

async function setVisibleInputValue(locator, value) {
  try {
    await locator.fill(value, { timeout: 10000 });
  } catch {
    await locator.evaluate((el, nextValue) => {
      el.value = nextValue;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  }
}

async function visibleInputs(targetContext) {
  const locator = targetContext.locator('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"])');
  const count = await locator.count().catch(() => 0);
  const inputs = [];
  for (let i = 0; i < Math.min(count, 20); i += 1) {
    const item = locator.nth(i);
    if (await item.isVisible().catch(() => false)) inputs.push(item);
  }
  return inputs;
}

async function generateHistoryReport(page, reportContext, range, diagnostic) {
  diagnostic.steps.push('history_dates_fill');
  diagnostic.historyRange = range;
  const inputs = await visibleInputs(reportContext);
  diagnostic.historyVisibleInputCount = inputs.length;
  if (inputs.length < 2) {
    throw fail('MATCHPOINT_HISTORY_DATE_INPUTS_NOT_FOUND', 'Campi data storico Matchpoint non trovati.', {
      url: page.url(),
      title: await page.title().catch(() => ''),
      inputCount: inputs.length,
    });
  }

  await setVisibleInputValue(inputs[0], range.fromDisplay);
  await setVisibleInputValue(inputs[1], range.toDisplay);
  if (inputs[2]) await setVisibleInputValue(inputs[2], '').catch(() => {});
  if (inputs[3]) await setVisibleInputValue(inputs[3], '').catch(() => {});

  diagnostic.steps.push('history_generate_click');
  let generated = false;
  const generateLocators = [
    reportContext.locator('button:has-text("Generare una relazione"), a:has-text("Generare una relazione"), input[value*="Generare una relazione"]'),
    reportContext.locator('button:has-text("Genera"), a:has-text("Genera"), input[value*="Genera"]'),
    reportContext.locator('button:has-text("Relazione"), a:has-text("Relazione"), input[value*="Relazione"]'),
    reportContext.locator('input[type="submit"], button[type="submit"]'),
  ];
  for (const locator of generateLocators) {
    generated = await clickFirstVisibleLocator(locator, 'click_generare_relazione', diagnostic, 15000);
    if (generated) break;
  }
  if (!generated) {
    generated = await clickMenuEntry(reportContext, 'Generare una relazione', 'click_generare_relazione', diagnostic);
  }
  if (!generated) {
    throw fail('MATCHPOINT_HISTORY_GENERATE_BUTTON_NOT_FOUND', 'Pulsante Generare una relazione non trovato.', {
      url: page.url(),
      title: await page.title().catch(() => ''),
      navigationAttempts: diagnostic.navigationAttempts || [],
      contextSamples: await contextSamples(page),
    });
  }
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);

  const resultsContext = await findHistoryResultsContext(page, diagnostic);
  if (!resultsContext) {
    throw fail('MATCHPOINT_HISTORY_RESULTS_NOT_READY', 'Relazione storico generata ma export Excel non trovato.', {
      url: page.url(),
      title: await page.title().catch(() => ''),
      historyResultsContextSamples: diagnostic.historyResultsContextSamples || [],
    });
  }
  return resultsContext;
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

async function triggerExportDownload(page, exportContext, exportTarget, diagnostic, label = 'export') {
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

  throw fail('MATCHPOINT_EXPORT_BUTTON_NOT_FOUND', `Pulsante ${label} non trovato nel browser worker.`, {
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
  const playersPath = clean(options.playersPath) || env('MATCHPOINT_PLAYERS_PATH', DEFAULT_PLAYERS_PATH);
  const exportTarget = clean(options.exportTarget) || env('MATCHPOINT_EXPORT_TARGET', DEFAULT_EXPORT_TARGET);
  const navigationMode = clean(options.navigationMode) || env('MATCHPOINT_BROWSER_NAVIGATION_MODE', 'players_menu');
  const diagnostic = {
    mode: 'browser_worker_headless',
    baseUrl,
    clientsPath,
    playersPath,
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
      exportContext = await navigateToPlayersList(page, baseUrl, playersPath, diagnostic);
    }

    diagnostic.steps.push('export_click');
    const download = await triggerExportDownload(page, exportContext, exportTarget, diagnostic, 'export clienti');
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

async function exportBookingHistoryWithBrowser(options = {}) {
  const username = clean(options.username) || env('MATCHPOINT_USERNAME');
  const password = clean(options.password) || env('MATCHPOINT_PASSWORD');
  if (!username || !password) {
    throw fail('MATCHPOINT_WORKER_SECRETS_MISSING', 'Mancano credenziali Matchpoint nel worker o nella richiesta server-to-server.');
  }

  const baseUrl = clean(options.baseUrl) || env('MATCHPOINT_BASE_URL', DEFAULT_BASE_URL);
  const exportTarget = clean(options.exportTarget) || env('MATCHPOINT_HISTORY_EXPORT_TARGET', env('MATCHPOINT_EXPORT_TARGET', DEFAULT_EXPORT_TARGET));
  const range = resolveHistoryRange(options);
  const diagnostic = {
    mode: 'browser_worker_headless',
    flow: 'booking_history',
    baseUrl,
    startedAt: new Date().toISOString(),
    steps: [],
    historyRange: range,
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

    const reportContext = await navigateToHistoryReport(page, diagnostic);
    const resultsContext = await generateHistoryReport(page, reportContext, range, diagnostic);

    diagnostic.steps.push('history_export_click');
    const download = await triggerExportDownload(page, resultsContext, exportTarget, diagnostic, 'export storico');
    const filename = download.suggestedFilename() || `matchpoint-storico-${range.fromDate}-${range.toDate}.xlsx`;
    const bytes = await bufferFromDownload(download);
    diagnostic.downloadedAt = new Date().toISOString();
    diagnostic.filename = filename;
    diagnostic.byteLength = bytes.byteLength;

    if (!bytes.byteLength) {
      throw fail('MATCHPOINT_BROWSER_EMPTY_DOWNLOAD', 'Download storico Matchpoint vuoto.', diagnostic);
    }

    return {
      ok: true,
      filename,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      base64: bytes.toString('base64'),
      diagnostic,
      range,
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

async function handleHistoryExport(req, res) {
  requireWorkerAuth(req);
  const body = await readBody(req);
  const result = await exportBookingHistoryWithBrowser(body);
  json(res, 200, result);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      return json(res, 200, {
        ok: true,
        service: 'pmo-matchpoint-browser-worker',
        routes: ['/export-clients', '/export-booking-history'],
        historyLabels: ['Elenco degli utenti negli spazi', 'Elenco degli spazi occupati'],
        historyNavigation: 'all-contexts-dom-fallback',
        historyReportRecognition: 'utenti-spazi-date-filters',
        time: new Date().toISOString(),
      });
    }
    if (req.method === 'POST' && req.url === '/export-clients') {
      return await handleExport(req, res);
    }
    if (req.method === 'POST' && req.url === '/export-booking-history') {
      return await handleHistoryExport(req, res);
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
