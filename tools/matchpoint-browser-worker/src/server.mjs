import http from 'node:http';
import fs from 'node:fs';
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
    try {
      await item.click({ timeout, noWaitAfter: true });
      diagnostic.navigationAttempts.push({ action: actionName, clickedIndex: i });
      return true;
    } catch (error) {
      diagnostic.navigationAttempts.push({
        action: actionName,
        clickErrorIndex: i,
        error: error instanceof Error ? error.message : String(error),
      });
    }
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

async function exportCandidates(targetContext) {
  return targetContext.evaluate(() => {
    const compact = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const nodes = Array.from(document.querySelectorAll('a, button, input, img, [onclick], [title], [aria-label]'));
    return nodes
      .map((node) => {
        const attrs = ['id', 'name', 'value', 'title', 'alt', 'aria-label', 'href', 'onclick']
          .map((attr) => compact(node.getAttribute?.(attr)))
          .filter(Boolean);
        const label = compact([node.innerText, ...attrs].filter(Boolean).join(' '));
        return {
          tag: node.tagName,
          id: compact(node.id),
          name: compact(node.getAttribute?.('name')),
          label: label.slice(0, 220),
        };
      })
      .filter((entry) => /esport|excel|export/i.test(entry.label))
      .slice(0, 20);
  }).catch(() => []);
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
      const historyPageFound = /Utenti\s+negli\s+spazi|Elenco\s+degli\s+utenti\s+negli\s+spazi/i.test(compactText);
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
      const candidates = await exportCandidates(entry.target);
      const exportFound = /Esportare\s+in\s+excel|Excel|Exportar/i.test(compactText) || candidates.length > 0;
      const historyTableFound = /Utenti\s+negli\s+spazi|Cod\.\s+Identificatore\s+Nome|Giorno\s+Ora\s+Ore/i.test(compactText);
      const sample = {
        kind: entry.kind,
        index: entry.index,
        url: entry.url,
        exportFound,
        historyTableFound,
        exportCandidates: candidates.slice(0, 6),
        bodySample: compactText.slice(0, 900),
      };
      samples.push(sample);
      if (historyTableFound) {
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

async function exportPostbackTargets(targetContext) {
  return targetContext.evaluate(() => {
    const compact = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const nodes = Array.from(document.querySelectorAll('a, button, input, img, [onclick], [href]'));
    const targets = [];
    for (const node of nodes) {
      const fields = [
        node.innerText,
        node.getAttribute?.('id'),
        node.getAttribute?.('name'),
        node.getAttribute?.('value'),
        node.getAttribute?.('title'),
        node.getAttribute?.('alt'),
        node.getAttribute?.('href'),
        node.getAttribute?.('onclick'),
      ].map(compact);
      const haystack = fields.join(' ');
      if (!/esport|excel|export/i.test(haystack)) continue;
      const match = haystack.match(/__doPostBack\(['"]([^'"]+)['"]/i);
      if (match?.[1]) targets.push(match[1]);
      const name = compact(node.getAttribute?.('name'));
      if (/LinkButtonExportar|Exportar/i.test(name) && name.includes('$')) targets.push(name);
    }
    return Array.from(new Set(targets)).slice(0, 12);
  }).catch(() => []);
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
    '[onclick*="Exportar"], [onclick*="exportar"], [onclick*="Excel"], [onclick*="excel"]',
    '[title*="Excel"], [title*="excel"], [aria-label*="Excel"], [aria-label*="excel"], img[alt*="Excel"], img[alt*="excel"]',
  ];

  for (const selector of selectors) {
    const download = await clickFirstVisibleWithDownload(page, exportContext, selector, diagnostic).catch((error) => {
      diagnostic.exportSelectorAttempts.push({ selector, error: error.message });
      return null;
    });
    if (download) return download;
  }

  const dynamicTargets = await exportPostbackTargets(exportContext);
  const postbackTargets = Array.from(new Set([...dynamicTargets, exportTarget].filter(Boolean)));
  diagnostic.exportPostbackTargets = postbackTargets;
  for (const target of postbackTargets) {
    const postbackDownload = await triggerPostbackDownload(page, exportContext, target, diagnostic).catch((error) => {
      diagnostic.exportPostbackError = error.message;
      return null;
    });
    if (postbackDownload) return postbackDownload;
  }

  throw fail('MATCHPOINT_EXPORT_BUTTON_NOT_FOUND', `Pulsante ${label} non trovato nel browser worker.`, {
    url: page.url(),
    title: await page.title().catch(() => ''),
    exportSelectorAttempts: diagnostic.exportSelectorAttempts,
    exportCandidates: await exportCandidates(exportContext),
    exportPostbackTargets: diagnostic.exportPostbackTargets || [],
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

// ---------------------------------------------------------------------------
// TABELLONE — lettura slot liberi/occupati per data
// ---------------------------------------------------------------------------

// Testi UI Matchpoint che confermano che il tabellone è visibile sulla pagina.
// Case-insensitive: Matchpoint può usare maiuscole miste nella localizzazione IT.
const TABELLONE_MARKERS = ['tabella', 'occupazione', 'relazione'];

async function isTabelloneVisible(target) {
  return target.evaluate((markers) => {
    const body = (document.body?.innerText || '').toLowerCase();
    // Basta trovare 2 marker su 3 per confermare la pagina (più robusto)
    const found = markers.filter((m) => body.includes(m));
    return found.length >= 2;
  }, TABELLONE_MARKERS).catch(() => false);
}

// Tenta di portare Playwright sulla vista tabellone.
// Strategia a tre livelli:
//   1. Già visibile dopo login / selezione cassa → nessun click.
//   2. Menu "Programmazione" → sotto-voci plausibili per prenotazioni/tabellone.
//   3. Click sulle icone della toolbar testuale (fallback DOM).
async function navigaFinoAlTabellone(page, diagnostic, baseUrl = DEFAULT_BASE_URL) {
  diagnostic.steps = diagnostic.steps || [];
  diagnostic.navigationAttempts = diagnostic.navigationAttempts || [];
  diagnostic.steps.push('tabellone_check_default');

  // Livello 1 — tabellone già presente (è spesso la home del ruolo Club)
  for (const entry of pageContentContexts(page)) {
    if (await isTabelloneVisible(entry.target)) {
      diagnostic.tabelloneFoundAt = 'default_after_login';
      diagnostic.tabelloneContextKind = entry.kind;
      return entry.target;
    }
  }

  // Livello 1.5 — Fast-path: click diretto su ID iconici noti del tabellone.
  // Confermato in produzione (2026-05-24): per l'utente 'club', l'elemento con
  // id="imgCuadroReservas" è l'icona "Tabella prenotazioni" che chiama
  // navIframe('/Reservas/CuadroReservas.aspx') — il percorso preferenziale.
  // Lista estesa con alias alternativi per altri ruoli Matchpoint.
  diagnostic.steps.push('tabellone_fast_path');
  const FAST_PATH_IDS = ['imgCuadroReservas', 'imgTablaOcupacion', 'imgTablaReservas', 'imgReservas'];
  for (const fpId of FAST_PATH_IDS) {
    const fpLoc = page.locator(`#${fpId}`).first();
    const fpVis = await fpLoc.isVisible({ timeout: 2000 }).catch(() => false);
    if (!fpVis) {
      diagnostic.navigationAttempts.push({ action: 'fast_path', id: fpId, visible: false });
      continue;
    }
    try {
      await fpLoc.click({ timeout: 8000, force: false, noWaitAfter: true });
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(2000);
      for (const check of pageContentContexts(page)) {
        if (await isTabelloneVisible(check.target)) {
          diagnostic.tabelloneFoundAt = `fast_path_${fpId}`;
          diagnostic.tabelloneContextKind = check.kind;
          diagnostic.navigationAttempts.push({ action: 'fast_path_success', id: fpId });
          return check.target;
        }
      }
      diagnostic.navigationAttempts.push({ action: 'fast_path_miss', id: fpId });
    } catch (fpErr) {
      diagnostic.navigationAttempts.push({ action: 'fast_path_err', id: fpId, error: fpErr.message });
    }
  }

  // Livello 2 — Click Esplorativo Continuo via PostBack ASP.NET nativo
  // Matchpoint blocca qualsiasi navigazione URL diretta (risponde con Error.aspx).
  // L'unica strada è cliccare gli elementi di navigazione usando il meccanismo REALE
  // di Playwright (genera mouseenter → mouseover → mousedown → mouseup → click con
  // isTrusted=true, passando per tutta la catena di eventi browser).
  //
  // Strategia:
  //   2a) Raccoglie TUTTI i candidati cliccabili da ogni contesto (page + frame)
  //   2b) Li ordina: postback tabellone-related → postback generici → link con kw → resto
  //   2c) Clicca ciascuno con Playwright locator.click() e verifica subito il tabellone
  //   2d) Scansione mirata su attributi TablaOcupacion + click Playwright (fallback specifico)
  diagnostic.steps.push('tabellone_exploratory_click');

  // ── 2a: raccolta candidati ────────────────────────────────────────────────
  const exploratoryItems = [];
  const seenItemKeys = new Set();

  for (const entry of pageContentContexts(page)) {
    const candidates = await entry.target.evaluate((ctxMeta) => {
      const compact = (v) => String(v || '').replace(/\s+/g, ' ').trim();
      const isVis = (el) => {
        const s = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
      };
      const out = [];
      const els = document.querySelectorAll(
        '[onclick], a[href*="doPostBack"], a[href]:not([href="#"]):not([href=""]), button, [role="menuitem"]',
      );
      for (const el of els) {
        if (!isVis(el)) continue;
        const id = el.id || '';
        const onclick = compact(el.getAttribute('onclick') || '');
        const href = compact(el.getAttribute('href') || '');
        const text = compact(el.innerText || el.title || el.getAttribute('aria-label') || '');
        if (!id && !onclick && !text) continue;
        out.push({
          id,
          tag: el.tagName,
          onclick: onclick.slice(0, 200),
          href: href.slice(0, 100),
          text: text.slice(0, 80),
          hasPostBack: onclick.includes('__doPostBack') || href.includes('__doPostBack'),
          ctxKind: ctxMeta.kind,
          ctxUrl: ctxMeta.url,
        });
      }
      return out;
    }, { kind: entry.kind, url: entry.url }).catch(() => []);

    for (const c of candidates) {
      const key = `${c.ctxKind}|${c.id}|${c.onclick.slice(0, 60)}|${c.text.slice(0, 40)}`;
      if (seenItemKeys.has(key)) continue;
      seenItemKeys.add(key);
      exploratoryItems.push(c);
    }
  }

  // ── 2b: ordina per rilevanza ──────────────────────────────────────────────
  const EXPL_KW = ['tablaocupacion', 'tablareservas', 'ocupacion', 'reserva', 'prenotaz', 'tabellone', 'campo', 'giornaliero', 'calendario'];
  const hasTabKw = (i) => EXPL_KW.some((k) => `${i.onclick} ${i.text} ${i.href}`.toLowerCase().includes(k));

  const exploratoryOrder = [
    ...exploratoryItems.filter((i) => i.hasPostBack && hasTabKw(i)),
    ...exploratoryItems.filter((i) => i.hasPostBack && !hasTabKw(i)),
    ...exploratoryItems.filter((i) => !i.hasPostBack && hasTabKw(i)),
    ...exploratoryItems.filter((i) => !i.hasPostBack && !hasTabKw(i) && i.text),
  ].slice(0, 60);

  diagnostic.navigationAttempts.push({
    action: 'exploratory_collected',
    total: exploratoryItems.length,
    inOrder: exploratoryOrder.length,
    sample: exploratoryOrder.slice(0, 20).map((i) => ({
      id: i.id, text: i.text, ctx: i.ctxKind, pb: i.hasPostBack, kw: hasTabKw(i),
    })),
  });

  // ── 2c: click reale su ogni candidato ────────────────────────────────────
  for (const item of exploratoryOrder) {
    try {
      // Risolvi il contesto giusto (main page o frame specifico per URL)
      let targetCtx;
      if (item.ctxKind === 'page') {
        targetCtx = page;
      } else {
        const matchingFrame = page.frames().find((f) => f.url() === item.ctxUrl);
        targetCtx = matchingFrame || page;
      }

      // Costruisci il locator: ID → onclick attr → testo+tag
      let loc;
      if (item.id) {
        loc = targetCtx.locator(`[id="${item.id}"]`).first();
      } else if (item.onclick) {
        // Usa contains(*) per robustezza con variazioni di spaziatura
        const onclickSnippet = item.onclick.slice(0, 60).replace(/"/g, '\\"');
        loc = targetCtx.locator(`[onclick*="${onclickSnippet}"]`).first();
      } else if (item.text && item.tag) {
        loc = targetCtx.locator(item.tag).filter({ hasText: item.text }).first();
      }
      if (!loc) continue;

      const vis = await loc.isVisible({ timeout: 1500 }).catch(() => false);
      if (!vis) continue;

      await loc.click({ timeout: 6000, force: false, noWaitAfter: true });
      await page.waitForLoadState('networkidle', { timeout: 18000 }).catch(() => {});
      await page.waitForTimeout(1800);

      for (const check of pageContentContexts(page)) {
        if (await isTabelloneVisible(check.target)) {
          diagnostic.tabelloneFoundAt = `exploratory_${item.ctxKind}_${(item.text || item.id || 'notext').slice(0, 30)}`;
          diagnostic.tabelloneContextKind = check.kind;
          diagnostic.navigationAttempts.push({ action: 'exploratory_success', item });
          return check.target;
        }
      }
      diagnostic.navigationAttempts.push({
        action: 'exploratory_miss',
        id: item.id, text: item.text.slice(0, 40), pb: item.hasPostBack,
      });
    } catch (explErr) {
      diagnostic.navigationAttempts.push({
        action: 'exploratory_err',
        id: item.id, text: (item.text || '').slice(0, 40), error: explErr.message.slice(0, 80),
      });
    }
  }

  // ── 2d: scansione mirata TablaOcupacion + click Playwright reale ─────────
  diagnostic.steps.push('tabellone_dom_link_scan');
  for (const entry of pageContentContexts(page)) {
    const found = await entry.target.evaluate(() => {
      const KW = ['TablaOcupacion', 'tablaocupacion', 'TablaReservas', 'tablareservas'];
      const ATTRS = ['href', 'onclick', 'data-url', 'data-href', 'data-page', 'title', 'alt'];
      for (const el of document.querySelectorAll('a, button, [onclick], [href], [data-url], [data-href], [data-page], li, div, span, img')) {
        const hay = ATTRS.map((a) => el.getAttribute(a) || '').join(' ');
        if (!KW.some((k) => hay.toLowerCase().includes(k.toLowerCase()))) continue;
        return {
          id: el.id || '',
          tag: el.tagName,
          onclick: (el.getAttribute('onclick') || '').slice(0, 200),
          text: (el.innerText || '').slice(0, 80),
        };
      }
      return null;
    }).catch(() => null);

    diagnostic.navigationAttempts.push({ action: 'dom_scan', ctx: entry.kind, found: !!found, el: found || undefined });
    if (!found) continue;

    try {
      let loc;
      if (found.id) {
        loc = entry.target.locator(`[id="${found.id}"]`).first();
      } else if (found.onclick) {
        loc = entry.target.locator(`[onclick*="${found.onclick.slice(0, 60).replace(/"/g, '\\"')}"]`).first();
      } else if (found.text && found.tag) {
        loc = entry.target.locator(found.tag).filter({ hasText: found.text }).first();
      }
      if (!loc) continue;
      const vis = await loc.isVisible({ timeout: 1500 }).catch(() => false);
      if (!vis) continue;
      await loc.click({ timeout: 6000, force: false, noWaitAfter: true });
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(2500);
      for (const check of pageContentContexts(page)) {
        if (await isTabelloneVisible(check.target)) {
          diagnostic.tabelloneFoundAt = `dom_link_click_${entry.kind}`;
          diagnostic.tabelloneContextKind = check.kind;
          return check.target;
        }
      }
    } catch (domClickErr) {
      diagnostic.navigationAttempts.push({ action: 'dom_link_click_err', error: domClickErr.message.slice(0, 80) });
    }
  }

  // Livello 2b — richiama navIframe() o funzioni simili esposte da Matchpoint globalmente.
  // navIframe(url) è la funzione CONFERMATA in produzione per l'utente 'club' (2026-05-24).
  // URL confermato: /Reservas/CuadroReservas.aspx (alias tabellone per ruolo club).
  diagnostic.steps.push('tabellone_js_nav_function');
  const jsFnResult = await page.evaluate(() => {
    // URL confermati: CuadroReservas per 'club', TablaOcupacion come fallback altri ruoli
    const URL_CANDIDATES = ['/Reservas/CuadroReservas.aspx', 'Reservas/TablaOcupacion.aspx'];
    // navIframe è la funzione reale di Matchpoint (confermata); le altre sono comuni in ASP.NET
    const FN_CANDIDATES = ['navIframe', 'CargarPagina', 'LoadPage', 'loadPage', 'Navigate', 'navigate',
      'GoTo', 'goTo', 'LoadContent', 'loadContent', 'ShowPage', 'showPage',
      'CargarContenido', 'loadContenido'];
    for (const fn of FN_CANDIDATES) {
      if (typeof window[fn] !== 'function') continue;
      for (const url of URL_CANDIDATES) {
        try { window[fn](url); return { called: fn, url }; } catch { /* prossimo */ }
      }
    }
    // Fallback: cerca inline script che menzioni CuadroReservas o TablaOcupacion
    const scripts = [...document.scripts].map((s) => s.textContent).join('\n');
    const match = scripts.match(/(\w+)\s*\(\s*['"][^'"]*(?:CuadroReservas|TablaOcupacion)[^'"]*['"]\s*\)/i);
    if (match) {
      const fnName = match[0].split('(')[0].trim();
      if (typeof window[fnName] === 'function') {
        for (const url of URL_CANDIDATES) {
          try { window[fnName](url); return { called: fnName, url, method: 'script_scan' }; } catch { /* skip */ }
        }
      }
    }
    return { called: null };
  }).catch(() => ({ called: null }));

  diagnostic.navigationAttempts.push({ action: 'js_nav_function', result: jsFnResult });

  if (jsFnResult.called) {
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);
    for (const entry of pageContentContexts(page)) {
      if (await isTabelloneVisible(entry.target)) {
        diagnostic.tabelloneFoundAt = `js_function_${jsFnResult.called}`;
        diagnostic.tabelloneContextKind = entry.kind;
        return entry.target;
      }
    }
  }

  // Livello 3 — menu Programmazione → sotto-voci prenotazioni
  diagnostic.steps.push('tabellone_menu_programmazione');
  const progClicked = await clickMenuEntryEverywhere(page, 'Programmazione', 'open_programmazione_menu_tabellone', diagnostic);
  if (progClicked) {
    await page.waitForTimeout(1000);
    const submenuLabels = [
      'Tabellone', 'Prenotazioni', 'Occupazione campi', 'Campi',
      'Giornaliero', 'Calendario', 'Vista giornaliera', 'Reservas',
      'Tabla de ocupación', 'Tabla reservas',
    ];
    for (const label of submenuLabels) {
      const clicked = await clickMenuEntryEverywhere(page, label, `click_${label.toLowerCase().replace(/\s+/g, '_')}`, diagnostic);
      if (clicked) {
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(1500);
        for (const entry of pageContentContexts(page)) {
          if (await isTabelloneVisible(entry.target)) {
            diagnostic.tabelloneFoundAt = `programmazione_submenu_${label}`;
            diagnostic.tabelloneContextKind = entry.kind;
            return entry.target;
          }
        }
        break;
      }
    }
  }

  // Livello 4 — click su icone toolbar
  diagnostic.steps.push('tabellone_toolbar_icon_fallback');
  const tabelloneIconClicked = await page.evaluate(() => {
    const normalize = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const candidates = [...document.querySelectorAll('a[href], [onclick], img[title], img[alt]')];
    const keywords = ['tabellone', 'prenotazion', 'campo', 'reserva', 'calendario', 'giornalier', 'ocupacion', 'tabla'];
    for (const el of candidates) {
      const haystack = normalize([el.title, el.alt, el.getAttribute('onclick'), el.getAttribute('href'), el.innerText].join(' '));
      if (keywords.some((k) => haystack.includes(k))) {
        const action = el.closest('a[href], [onclick]') || el;
        action.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return true;
      }
    }
    return false;
  }).catch(() => false);

  if (tabelloneIconClicked) {
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
    for (const entry of pageContentContexts(page)) {
      if (await isTabelloneVisible(entry.target)) {
        diagnostic.tabelloneFoundAt = 'toolbar_icon_fallback';
        diagnostic.tabelloneContextKind = entry.kind;
        return entry.target;
      }
    }
  }

  throw fail(
    'MATCHPOINT_TABELLONE_NOT_FOUND',
    'Impossibile navigare al tabellone prenotazioni Matchpoint.',
    {
      steps: diagnostic.steps,
      url: page.url(),
      title: await page.title().catch(() => ''),
      contentFrameUrl: diagnostic.contentFrameUrl || '',
      navigationAttempts: diagnostic.navigationAttempts,
      contextSamples: await contextSamples(page),
    },
  );
}

// Imposta la data sul tabellone e attende che la griglia si aggiorni.
// isoDate: 'YYYY-MM-DD'
async function impostaDataTabellone(tabCtx, page, isoDate, diagnostic) {
  const [year, month, day] = isoDate.split('-');
  const italianDate = `${day}/${month}/${year}`;
  diagnostic.steps.push(`tabellone_set_date_${isoDate}`);

  // ── Strategia 1: jQuery datepicker onSelect → AJAX grid reload ───────────
  // CuadroReservasNuevo.aspx usa un jQuery UI datepicker collegato a #fechaTabla.
  // Il suo callback onSelect() aggiorna la griglia via AJAX (non postback ASP.NET).
  // Chiamarlo direttamente è l'unico modo affidabile per cambiare data senza
  // navigazione diretta (bloccata da EventValidation / Error.aspx).
  const onSelectResult = await tabCtx.evaluate((dateStr) => {
    const [d2, m2, y2] = dateStr.split('/').map(Number);
    const targetDate = new Date(y2, m2 - 1, d2);
    // 1a. jQuery onSelect diretto
    try {
      if (typeof $ !== 'undefined') {
        const $inp = $('#fechaTabla');
        if ($inp.length > 0) {
          const dpInst = $inp.data('datepicker');
          const onSel = dpInst?.settings?.onSelect || $inp.datepicker('option', 'onSelect');
          $inp.datepicker('setDate', targetDate);
          const formatted = $.datepicker.formatDate($inp.datepicker('option', 'dateFormat') || 'dd/mm/yy', targetDate);
          if (typeof onSel === 'function') {
            onSel.call($inp[0], formatted, dpInst);
            return { ok: true, method: 'jquery_onSelect', formatted };
          }
          // onSelect assente: prova trigger change (potrebbe bastare)
          $inp.trigger('change');
          return { ok: true, method: 'jquery_trigger_change', formatted };
        }
      }
    } catch (e2) { return { ok: false, reason: `jquery_err:${String(e2)}` }; }
    return { ok: false, reason: 'jquery_not_available' };
  }, italianDate).catch((err) => ({ ok: false, reason: String(err) }));

  if (onSelectResult?.ok) {
    diagnostic.dateInputSelector = onSelectResult.method;
    await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(2000);
    return;
  }

  // ── Strategia 2: clic nativo sul popup jQuery datepicker ─────────────────
  // Apre il popup calendiaro, naviga al mese giusto, clicca il giorno target.
  // Unica strada quando onSelect non è accessibile via evaluate.
  try {
    const dateInputLoc = tabCtx.locator('#fechaTabla').first();
    if (await dateInputLoc.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dateInputLoc.click({ timeout: 5000 });
      await page.waitForTimeout(400);

      // Il popup compare come .ui-datepicker (staccato dal DOM dell'input)
      const popup = tabCtx.locator('.ui-datepicker').first();
      const popupVisible = await popup.isVisible({ timeout: 3000 }).catch(() => false);
      if (popupVisible) {
        // Leggi mese/anno correnti e naviga se necessario
        const [targetYear, targetMonth] = isoDate.split('-').map(Number); // month 1-12
        for (let nav = 0; nav < 24; nav++) {
          const shownYear = parseInt(await tabCtx.locator('.ui-datepicker-year').innerText({ timeout: 1000 }).catch(() => '0'), 10);
          const shownMonthText = (await tabCtx.locator('.ui-datepicker-month').innerText({ timeout: 1000 }).catch(() => '')).toLowerCase();
          const itMonths = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
          const shownMonth = itMonths.findIndex((m) => shownMonthText.startsWith(m)) + 1;
          if (shownYear === targetYear && shownMonth === targetMonth) break;
          const delta = (targetYear - shownYear) * 12 + (targetMonth - shownMonth);
          const arrowSel = delta > 0 ? '.ui-datepicker-next' : '.ui-datepicker-prev';
          await tabCtx.locator(arrowSel).first().click({ timeout: 3000 });
          await page.waitForTimeout(200);
        }
        // Clicca il giorno target nel calendario
        const [,, targetDay] = isoDate.split('-');
        const dayLoc = tabCtx.locator(`.ui-datepicker-calendar td a`).filter({ hasText: new RegExp(`^${parseInt(targetDay, 10)}$`) }).first();
        await dayLoc.click({ timeout: 5000 });
        diagnostic.dateInputSelector = 'datepicker_popup_click';
        await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {});
        await page.waitForTimeout(2000);
        return;
      }
    }
  } catch (dpErr) {
    diagnostic.datePickerClickErr = String(dpErr).slice(0, 200);
  }

  // ── Strategia 2: Playwright fill() sui selettori noti ───────────────────
  const dateInputSelectors = [
    'input[name*="Date"], input[id*="Date"], input[name*="Fecha"], input[id*="Fecha"]',
    'input[name*="date"], input[id*="date"], input[name*="fecha"], input[id*="fecha"]',
    'input[type="text"][value*="/"]',
  ];
  let filled = false;
  for (const sel of dateInputSelectors) {
    const loc = tabCtx.locator(sel).first();
    if (!(await loc.isVisible().catch(() => false))) continue;
    try {
      await loc.click({ clickCount: 3, timeout: 5000 });
      await loc.fill(italianDate, { timeout: 8000 });
      // Cerca un pulsante "Buscar/Cerca" nel frame e cliccalo
      const btnSel = '#btnBuscar, #btnSearch, #btnCerca, input[value*="Buscar"], input[value*="Cerca"], input[type="submit"]';
      const btn = tabCtx.locator(btnSel).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click({ timeout: 5000 });
      } else {
        await loc.press('Tab');
        await loc.press('Enter');
      }
      filled = true;
      diagnostic.dateInputSelector = sel;
      break;
    } catch { /* prossimo selettore */ }
  }

  // ── Strategia 3: DOM evaluate + onchange / __doPostBack ─────────────────
  if (!filled) {
    const result3 = await tabCtx.evaluate((dateStr) => {
      const inputs = [...document.querySelectorAll('input[type="text"], input:not([type])')];
      const dateInput = inputs.find((el) =>
        /\d{1,2}\/\d{1,2}\/\d{4}/.test(el.value) ||
        el.id?.toLowerCase().includes('date') || el.id?.toLowerCase().includes('fecha') ||
        el.name?.toLowerCase().includes('date') || el.name?.toLowerCase().includes('fecha')
      );
      if (!dateInput) return false;
      const prevVal = dateInput.value;
      dateInput.value = dateStr;
      const onch = dateInput.getAttribute('onchange') || '';
      if (onch) {
        try { new Function(onch).call(dateInput); } catch (e4) {}
      }
      ['input', 'change', 'blur'].forEach((evt) =>
        dateInput.dispatchEvent(new Event(evt, { bubbles: true }))
      );
      dateInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
      dateInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
      // Cerca e clicca pulsante submit nel form
      const form = dateInput.closest('form');
      if (form) {
        const btn = form.querySelector('input[type="submit"], button[type="submit"], input[type="button"]');
        if (btn) { try { btn.click(); return `form_btn_${btn.id || btn.value}`; } catch (e5) {} }
        try { form.submit(); return 'form_submit'; } catch (e6) {}
      }
      return `dom_events_prevVal=${prevVal}`;
    }, italianDate).catch(() => false);
    if (result3) {
      filled = true;
      diagnostic.dateInputSelector = String(result3);
    }
  }

  if (!filled) {
    diagnostic.dateSetWarning = 'date_input_not_found_proceeding_with_current_date';
  }

  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  diagnostic.afterDateUrl = page.url();
  // Registra anche l'URL del frame (più utile di page.url() per capire se c'è stato reload)
  diagnostic.afterDateFrameUrl = await tabCtx.evaluate(() => location.href).catch(() => '');
}

// Legge l'intera griglia del tabellone e restituisce uno snapshot strutturato.
// Include discovery DOM per calibrazione se il parsing non ha successo.
async function parseGrigliaTabellone(tabCtx, diagnostic) {
  diagnostic.steps.push('tabellone_parse_grid');

  const rawGrid = await tabCtx.evaluate(() => {
    const compact = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
    const timePattern = /^\d{1,2}:\d{2}$/;
    const timePatternLoose = /\b\d{1,2}:\d{2}\b/;

    const isVisible = (el) => {
      if (!el) return false;
      const s = window.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    };

    const getBg = (el) => window.getComputedStyle(el).backgroundColor || '';

    const classifyColor = (bg) => {
      if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'rgb(255, 255, 255)' || bg === 'transparent') return 'libero';
      const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return 'prenotato';
      const [r, g, b] = [+m[1], +m[2], +m[3]];
      if (r > 200 && g < 150 && b < 150) return 'confermato';
      if (Math.abs(r - g) < 35 && Math.abs(g - b) < 35 && r > 80) return 'manutenzione';
      return 'prenotato';
    };

    // ── DISCOVERY: analisi strutturale della pagina ──────────────────────────
    const allEls = [...document.querySelectorAll('*')].filter(isVisible);

    const timeLeafEls = allEls.filter(
      (el) => el.children.length === 0 && timePattern.test(compact(el.innerText)),
    );

    const campoEls = allEls.filter(
      (el) => /campo\s*\d+/i.test(compact(el.innerText)) && compact(el.innerText).length < 40,
    );

    const bookingBlocks = allEls
      .filter((el) => {
        const bg = getBg(el);
        if (classifyColor(bg) === 'libero') return false;
        return timePatternLoose.test(compact(el.innerText)) && el.children.length <= 6;
      })
      .map((el) => ({
        tag: el.tagName,
        text: compact(el.innerText).slice(0, 200),
        bg: getBg(el),
        colore: classifyColor(getBg(el)),
        class: (el.className || '').slice(0, 80),
        id: el.id || '',
        parentTag: el.parentElement?.tagName || '',
        parentClass: (el.parentElement?.className || '').slice(0, 80),
      }));

    const tableStructures = [...document.querySelectorAll('table')].map((t, idx) => {
      const rows = [...t.querySelectorAll('tr')];
      const headerCells = rows[0]
        ? [...rows[0].querySelectorAll('td,th')].map((c) => compact(c.innerText).slice(0, 40))
        : [];
      const hasTimeRows = rows.some((row) => {
        const first = row.querySelector('td,th');
        return first && timePattern.test(compact(first.innerText));
      });
      return {
        idx, id: t.id || '', class: (t.className || '').slice(0, 80),
        rows: rows.length, cols: headerCells.length,
        headerCells: headerCells.slice(0, 8), hasTimeRows,
      };
    });

    const discovery = {
      url: location.href,
      title: document.title,
      tableCount: tableStructures.length,
      tables: tableStructures.slice(0, 8),
      timeElements: timeLeafEls.slice(0, 8).map((el) => ({
        tag: el.tagName,
        text: compact(el.innerText),
        parentTag: el.parentElement?.tagName,
        parentClass: (el.parentElement?.className || '').slice(0, 80),
        grandparentTag: el.parentElement?.parentElement?.tagName,
      })),
      campoElements: campoEls.slice(0, 6).map((el) => ({
        tag: el.tagName,
        text: compact(el.innerText).slice(0, 60),
        parentTag: el.parentElement?.tagName,
        class: (el.className || '').slice(0, 80),
      })),
      bookingBlocks: bookingBlocks.slice(0, 6),
      bodyTextSample: (document.body?.innerText || '').slice(0, 800),
    };

    // ── STRATEGIA 1: tabella con righe orarie (matrix) ───────────────────────
    // Fix rowspan/colspan: costruisce una cell-matrix 2D che "virtualizza" le celle
    // occupate da span di righe precedenti, evitando lo slittamento degli indici.
    //
    // Trova il gridTable in due passi:
    // A1 fast-path : elementi con testo "Campo N" → closest('table')
    // A2 fallback  : scansiona tutte le <table>, prende quella con più righe HH:MM
    {
      let gridTable = null;

      // A1: fast-path via campo-header elements (testo "Campo N")
      if (campoEls.length > 0) {
        const hdrRow0 = campoEls[0].closest('tr') || campoEls[0].parentElement;
        gridTable = hdrRow0?.closest('table') || hdrRow0?.parentElement;
      }

      // A2: fallback — tabella con più righe dove la prima cella è HH:MM esatto
      if (!gridTable) {
        let bestTimeRowCount = 0;
        for (const t of document.querySelectorAll('table')) {
          const tRows = [...t.querySelectorAll('tr')];
          const cnt = tRows.filter((row) => {
            const first = row.querySelector('td,th');
            return first && timePattern.test(compact(first.innerText));
          }).length;
          if (cnt > bestTimeRowCount) { bestTimeRowCount = cnt; gridTable = t; }
        }
        if (bestTimeRowCount < 5) gridTable = null; // soglia: almeno 5 righe orarie
      }

      if (gridTable) {
        // ── Costruisce matrice 2D che rispetta rowspan e colspan ──────────────
        const allTableRows = [...gridTable.querySelectorAll('tr')];
        const cellMatrix = []; // cellMatrix[ri][ci] = { cell, isPrimary }
        for (let ri = 0; ri < allTableRows.length; ri++) {
          if (!cellMatrix[ri]) cellMatrix[ri] = [];
          let ci = 0;
          for (const cell of allTableRows[ri].querySelectorAll('td, th')) {
            while (cellMatrix[ri][ci] !== undefined) ci++;
            const rs = Math.max(1, parseInt(cell.getAttribute('rowspan') || '1', 10));
            const cs = Math.max(1, parseInt(cell.getAttribute('colspan') || '1', 10));
            for (let r = 0; r < rs; r++) {
              if (!cellMatrix[ri + r]) cellMatrix[ri + r] = [];
              for (let c = 0; c < cs; c++) {
                cellMatrix[ri + r][ci + c] = { cell, isPrimary: r === 0 && c === 0 };
              }
            }
            ci += cs;
          }
        }

        // Trova righe orarie: colonna 0 della matrice contiene un orario esatto
        const timeRowIndices = [];
        for (let ri = 0; ri < cellMatrix.length; ri++) {
          const firstEntry = cellMatrix[ri]?.[0];
          if (firstEntry?.isPrimary && timePattern.test(compact(firstEntry.cell.innerText))) {
            timeRowIndices.push(ri);
          }
        }

        if (timeRowIndices.length > 0) {
          // ── B: campo headers ──────────────────────────────────────────────
          // B1: usa campoEls se disponibili (percorso normale con "Campo N")
          let campoHeaders = [];
          if (campoEls.length > 0) {
            campoHeaders = campoEls.map((el) => {
              const lines = compact(el.innerText).split(/[\n\r]/).map(compact).filter(Boolean);
              const hdrRow = el.closest('tr');
              const hdrRi = hdrRow ? allTableRows.indexOf(hdrRow) : -1;
              let colIdx = 0;
              if (hdrRi >= 0 && cellMatrix[hdrRi]) {
                const anchor = el.closest('td,th') || el;
                for (let ci2 = 0; ci2 < (cellMatrix[hdrRi].length || 0); ci2++) {
                  if (cellMatrix[hdrRi][ci2]?.cell === anchor) { colIdx = ci2; break; }
                }
              } else {
                colIdx = el.cellIndex ?? [...(el.parentElement?.children || [])].indexOf(el);
              }
              return { nome: lines[0], sport: lines[1] || '', colIndex: colIdx };
            });
          }

          // B2: fallback — riga immediatamente prima del primo time-row come header
          // Prende qualsiasi testo/alt, salta la colonna 0 (asse orario)
          if (campoHeaders.length === 0) {
            const hdrRiFallback = timeRowIndices[0] - 1;
            if (hdrRiFallback >= 0 && cellMatrix[hdrRiFallback]) {
              for (let ci2 = 1; ci2 < (cellMatrix[hdrRiFallback].length || 0); ci2++) {
                const entry2 = cellMatrix[hdrRiFallback][ci2];
                if (!entry2?.isPrimary) continue;
                const imgAlt = entry2.cell.querySelector('img')?.getAttribute('alt') || '';
                const cellTxt = compact(entry2.cell.innerText) || compact(imgAlt) || `Campo ${campoHeaders.length + 1}`;
                campoHeaders.push({ nome: cellTxt, sport: '', colIndex: ci2 });
              }
            }
          }

          if (campoHeaders.length > 0) {
            const campiData = campoHeaders.map((campo) => {
              const slots = [];
              for (const ri of timeRowIndices) {
                const firstEntry = cellMatrix[ri]?.[0];
                if (!firstEntry) continue;
                const oraLabel = compact(firstEntry.cell.innerText);
                const entry = cellMatrix[ri]?.[campo.colIndex];

                if (!entry) {
                  // Cella fuori range: slot libero
                  slots.push({ ora: oraLabel, libero: true, colore: 'libero' });
                  continue;
                }
                if (!entry.isPrimary) {
                  // Continuazione rowspan: entry.cell è la stessa cella primaria →
                  // eredita colore e testo dal blocco radice (fix occupato_span vuoto)
                  let spanColor = classifyColor(getBg(entry.cell));
                  let spanText = compact(entry.cell.innerText);
                  if (spanColor === 'libero') {
                    for (const desc of entry.cell.querySelectorAll('div, span, a')) {
                      const dc = classifyColor(getBg(desc));
                      if (dc !== 'libero') {
                        spanColor = dc;
                        const dt = compact(desc.innerText);
                        if (dt) spanText = dt;
                        break;
                      }
                    }
                  }
                  const spanLines = spanText.split(/[\n\r]/).map(compact).filter(Boolean);
                  const spanRange = spanLines[0]?.match(/^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
                  slots.push({
                    ora: oraLabel, libero: false, colore: 'occupato_span',
                    ...(spanRange ? { oraFine: spanRange[2] } : {}),
                    ...(spanLines[1] ? { tipo: spanLines[1] } : {}),
                    ...(spanLines.length > 2 ? { giocatori: spanLines.slice(2).filter((l) => !/^\d+\/\d+/.test(l)) } : {}),
                    ...(spanText ? { testoCompleto: spanText.slice(0, 300) } : {}),
                  });
                  continue;
                }
                // Fix: su CuadroReservas i booking sono div assoluti dentro il <td>.
                // Cerca il colore e il testo anche sui discendenti se la cella è bianca.
                let colore = classifyColor(getBg(entry.cell));
                let cellText = compact(entry.cell.innerText);
                if (colore === 'libero') {
                  for (const desc of entry.cell.querySelectorAll('div, span, a')) {
                    const dc = classifyColor(getBg(desc));
                    if (dc !== 'libero') {
                      colore = dc;
                      const dt = compact(desc.innerText);
                      if (dt) cellText = dt;
                      break;
                    }
                  }
                }
                const libero = colore === 'libero';
                const lines = cellText.split(/[\n\r]/).map(compact).filter(Boolean);
                const rangeMatch = lines[0]?.match(/^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
                slots.push({
                  ora: rangeMatch ? rangeMatch[1] : oraLabel,
                  ...(rangeMatch ? { oraFine: rangeMatch[2] } : {}),
                  libero, colore,
                  ...(lines[1] ? { tipo: lines[1] } : {}),
                  ...(lines.length > 2 ? { giocatori: lines.slice(2).filter((l) => !/^\d+\/\d+/.test(l)) } : {}),
                  ...(!libero && cellText ? { testoCompleto: cellText.slice(0, 300) } : {}),
                });
              }
              return { nome: campo.nome, sport: campo.sport, slots };
            });
            return { campi: campiData, campiCount: campiData.length, timeSlotsCount: timeRowIndices.length, parsedBy: 'table_matrix', discovery };
          }
        }
      }
    }

    // ── STRATEGIA 2: TEXT-RANGE deterministica ────────────────────────────────
    // Sostituisce il calcolo geometrico Y (S1–S4) che generava allucinazioni:
    // manutenzioni fantasma, over-blocking cross-colonna, lezioni verdi perse.
    //
    // Principio fisso: ogni booking dichiara ESPLICITAMENTE "HH:MM–HH:MM" nel testo.
    // → Usiamo SOLO quel range per determinare l'occupazione (mai pixel Y).
    // → Per il campo: X-center del blocco vs X-center header campo nel DOM.
    // → Nessun elemento senza range testuale esplicito entra nel risultato.

    // ── 2a: X-center di ogni colonna campo ───────────────────────────────────
    // Cerca "Campo N" in: innerText, alt, title, aria-label, data-* attributes.
    const campoHeaderCells = [];
    {
      const seenCHNames = new Set();
      const campoRe = /campo\s*\d+/i;
      for (const el of allEls) {
        // Prova sia innerText sia attributi comuni (img alt, th title, aria-label)
        const candidates = [
          compact(el.innerText),
          compact(el.getAttribute('alt') || ''),
          compact(el.getAttribute('title') || ''),
          compact(el.getAttribute('aria-label') || ''),
          compact(el.getAttribute('data-campo') || ''),
          compact(el.getAttribute('data-name') || ''),
        ];
        const matched = candidates.find((c) => campoRe.test(c) && c.length <= 200);
        if (!matched) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 20 || r.height < 6) continue;
        const nome = (matched.match(campoRe)?.[0] || '').trim();
        if (!nome || seenCHNames.has(nome)) continue;
        seenCHNames.add(nome);
        const lines = matched.split(/[\n\r\s]{2,}/).map(compact).filter(Boolean);
        campoHeaderCells.push({
          nome,
          sport: lines.find((l) => !campoRe.test(l)) || '',
          xCenter: r.left + r.width / 2,
        });
      }
      campoHeaderCells.sort((a, b) => a.xCenter - b.xCenter);
    }

    // ── 2b: blocchi con range orario esplicito nel testo ─────────────────────
    // Guard critico: /HH:MM[-–]HH:MM/ esclude header, etichette ore, elementi
    // di layout/navigazione — solo prenotazioni/lezioni reali dichiarano il range.
    // IMPORTANTE: popolazione INCONDIZIONALE — serve sia per 2c (con campo headers)
    // sia per 2e (fallback X-cluster senza campo headers).
    const realBookingBlocks = [];
    {
      const timeRangeRe = /(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/g;
      const seenRBKeys = new Set();
      for (const el of allEls) {
        const bg = getBg(el);
        if (classifyColor(bg) === 'libero') continue;
        const r = el.getBoundingClientRect();
        if (r.width < 20 || r.height < 8) continue;
        const textInner = compact(el.innerText);
        const textAttr  = compact(
          el.getAttribute('title') || el.getAttribute('data-original-title') ||
          el.getAttribute('data-tooltip') || el.getAttribute('alt') || '',
        );
        const text = textInner || textAttr;

        // Guard principale: deve contenere almeno un range HH:MM–HH:MM
        const allMatches = [...text.matchAll(timeRangeRe)];
        if (allMatches.length === 0) continue; // nessun range → non è un booking

        // Guard contenitore: se ci sono PIÙ range nel testo, questo elemento wrappa
        // più booking → lo saltiamo e ci aspettiamo di trovare i figli individualmente.
        // (Es. un <div> campo con "13:30-16:30 Manutenzione 16:30-18:00 Partita..." )
        if (allMatches.length > 1) continue;

        const m = allMatches[0];

        // Dedup: stesso range + stessa colonna X (bucket 60 px) → stesso blocco
        const xCenter = r.left + r.width / 2;
        const rKey = `${m[1]}|${m[2]}|${Math.round(xCenter / 60)}`;
        if (seenRBKeys.has(rKey)) continue;
        seenRBKeys.add(rKey);

        const lines = text.split(/[\n\r]/).map(compact).filter(Boolean);
        // tipo = prima riga senza orari e senza header "(N/Np)"
        const tipo = lines.find((l) => l && !/\d{1,2}:\d{2}/.test(l) && !/^\(\d/.test(l)) || '';
        const giocatori = lines.filter((l) => l && !/\d{1,2}:\d{2}/.test(l) && !/^\(\d/.test(l) && l !== tipo);
        realBookingBlocks.push({
          ora: m[1], oraFine: m[2],
          xCenter,
          tipo, giocatori,
          colore: classifyColor(bg),
          testoCompleto: text.slice(0, 300),
        });
      }
    }

    // ── 2c + 2d: assegna campo → genera slot list ─────────────────────────────
    if (campoHeaderCells.length > 0) {
      // Assegna ogni blocco al campo con X-center più vicino
      for (const block of realBookingBlocks) {
        let minDist2 = Infinity;
        let best2 = campoHeaderCells[0];
        for (const ch of campoHeaderCells) {
          const d = Math.abs(block.xCenter - ch.xCenter);
          if (d < minDist2) { minDist2 = d; best2 = ch; }
        }
        block.campoNome = best2.nome;
      }

      // Fascia 07:00–23:00, granularità 30 min — ZERO geometria Y
      const toMin2 = (t) => { const [h2, m2] = t.split(':').map(Number); return h2 * 60 + m2; };
      const timeAxis2 = [];
      for (let mm = 7 * 60; mm < 23 * 60; mm += 30) {
        timeAxis2.push(`${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`);
      }

      const campiData2 = campoHeaderCells.map((campo) => {
        const campoBlocks = realBookingBlocks.filter((b) => b.campoNome === campo.nome);
        const slots = timeAxis2.map((ora) => {
          const oraMin = toMin2(ora);
          // Il range testuale [b.ora, b.oraFine) determina quali slot copre il blocco
          const hit = campoBlocks.find((b) => {
            const s = toMin2(b.ora);
            const e = toMin2(b.oraFine);
            return e > s && oraMin >= s && oraMin < e;
          });
          if (!hit) return { ora, libero: true, colore: 'libero' };
          const isPrimary = oraMin === toMin2(hit.ora);
          if (!isPrimary) {
            return {
              ora, libero: false, colore: 'occupato_span',
              oraFine: hit.oraFine,
              ...(hit.tipo ? { tipo: hit.tipo } : {}),
              ...(hit.giocatori?.length ? { giocatori: hit.giocatori } : {}),
              testoCompleto: hit.testoCompleto,
            };
          }
          return {
            ora: hit.ora, oraFine: hit.oraFine,
            libero: false, colore: hit.colore,
            ...(hit.tipo ? { tipo: hit.tipo } : {}),
            ...(hit.giocatori?.length ? { giocatori: hit.giocatori } : {}),
            testoCompleto: hit.testoCompleto,
          };
        });
        return { nome: campo.nome, sport: campo.sport, slots };
      });

      return {
        campi: campiData2,
        campiCount: campiData2.length,
        timeSlotsCount: timeAxis2.length,
        parsedBy: 'text_range_deterministic',
        discovery,
      };
    }

    // ── 2e: fallback X-cluster — campo headers non trovati ───────────────────
    // Si attiva quando gli header campo non sono rilevabili via testo/attributi
    // (es. immagini prive di alt, CSS generated content, struttura non standard).
    // Raggruppa i realBookingBlocks per colonna X con bucket 150 px.
    // Esclude blocchi nella fascia sinistra (asse orario ≤ 12% del viewport).
    // Il guard HH:MM–HH:MM su realBookingBlocks assicura zero allucinazioni.
    if (realBookingBlocks.length > 0) {
      const vpW = document.documentElement.clientWidth || 1440;
      const timeAxisMaxX = vpW * 0.12; // asse orario: primi ~12% del viewport

      const visBlocks = realBookingBlocks.filter((b) => b.xCenter > timeAxisMaxX);
      if (visBlocks.length > 0) {
        const xBuckets = {};
        for (const b of visBlocks) {
          const bucket = Math.round(b.xCenter / 150) * 150;
          if (!xBuckets[bucket]) xBuckets[bucket] = [];
          xBuckets[bucket].push(b);
        }
        const sortedBuckets = Object.entries(xBuckets).sort(([a], [b2]) => Number(a) - Number(b2));

        const toMin3 = (t) => { const [h3, m3] = t.split(':').map(Number); return h3 * 60 + m3; };
        const timeAxis3 = [];
        for (let mm = 7 * 60; mm < 23 * 60; mm += 30) {
          timeAxis3.push(`${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`);
        }

        const campiData3 = sortedBuckets.map(([, blocks], i) => {
          const slots = timeAxis3.map((ora) => {
            const oraMin = toMin3(ora);
            const hit = blocks.find((b) => {
              const s = toMin3(b.ora);
              const e = toMin3(b.oraFine);
              return e > s && oraMin >= s && oraMin < e;
            });
            if (!hit) return { ora, libero: true, colore: 'libero' };
            const isPrimary3 = oraMin === toMin3(hit.ora);
            if (!isPrimary3) {
              return {
                ora, libero: false, colore: 'occupato_span',
                oraFine: hit.oraFine,
                ...(hit.tipo ? { tipo: hit.tipo } : {}),
                ...(hit.giocatori?.length ? { giocatori: hit.giocatori } : {}),
                testoCompleto: hit.testoCompleto,
              };
            }
            return {
              ora: hit.ora, oraFine: hit.oraFine,
              libero: false, colore: hit.colore,
              ...(hit.tipo ? { tipo: hit.tipo } : {}),
              ...(hit.giocatori?.length ? { giocatori: hit.giocatori } : {}),
              testoCompleto: hit.testoCompleto,
            };
          });
          return { nome: `Campo ${i + 1}`, sport: '', slots };
        });

        return {
          campi: campiData3,
          campiCount: campiData3.length,
          timeSlotsCount: timeAxis3.length,
          parsedBy: 'text_range_x_cluster',
          discovery,
        };
      }
    }

    // ── Nessuna strategia riuscita: restituisce la discovery per calibrazione ──
    return { error: 'GRID_PARSE_NEEDS_CALIBRATION', discovery };
  }).catch((err) => ({ error: String(err) }));

  if (rawGrid.error) {
    diagnostic.gridParseError = rawGrid.error;
    if (rawGrid.discovery) diagnostic.domDiscovery = rawGrid.discovery;
  }

  return rawGrid;
}

async function getSlotsWithBrowser(options = {}) {
  const username = clean(options.username) || env('MATCHPOINT_USERNAME');
  const password = clean(options.password) || env('MATCHPOINT_PASSWORD');
  if (!username || !password) {
    throw fail('MATCHPOINT_WORKER_SECRETS_MISSING', 'Mancano credenziali Matchpoint per get-slots.');
  }

  const baseUrl = clean(options.baseUrl) || env('MATCHPOINT_BASE_URL', DEFAULT_BASE_URL);
  const isoDate = parseIsoDate(clean(options.date)) || todayIsoRome();

  const diagnostic = {
    mode: 'browser_worker_headless',
    flow: 'get_slots',
    baseUrl,
    date: isoDate,
    startedAt: new Date().toISOString(),
    steps: [],
  };

  const browser = await chromium.launch({
    headless: boolEnv('MATCHPOINT_HEADLESS', true),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const context = await browser.newContext({
      locale: 'it-IT',
      timezoneId: 'Europe/Rome',
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
    });
    const page = await context.newPage();

    // Login
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

    if (/Login\.aspx/i.test(page.url()) && await page.locator('input[type="password"]').count().catch(() => 0)) {
      throw fail('MATCHPOINT_BROWSER_LOGIN_FAILED', 'Login Matchpoint non riuscito.', { url: page.url() });
    }

    await maybeClickCashEnter(page, diagnostic);

    // Navigazione al tabellone
    const tabCtx = await navigaFinoAlTabellone(page, diagnostic, baseUrl);

    // Impostazione data
    await impostaDataTabellone(tabCtx, page, isoDate, diagnostic);

    // Parsing griglia
    const grid = await parseGrigliaTabellone(tabCtx, diagnostic);
    diagnostic.finishedAt = new Date().toISOString();

    return {
      ok: true,
      date: isoDate,
      ...grid,
      diagnostic,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// SLOT SCHEDULE — lettura configurazione orari slot settimanale
// ---------------------------------------------------------------------------

// Nomi giorno in italiano e spagnolo → chiave canonica italiana
const DAY_NAMES_IT = {
  lunedi: 'Lunedì', martedi: 'Martedì', mercoledi: 'Mercoledì',
  giovedi: 'Giovedì', venerdi: 'Venerdì', sabato: 'Sabato', domenica: 'Domenica',
};
const DAY_NAMES_ES = {
  lunes: 'Lunedì', martes: 'Martedì', miercoles: 'Mercoledì',
  jueves: 'Giovedì', viernes: 'Venerdì', sabado: 'Sabato', domingo: 'Domenica',
};
const ALL_DAY_VARIANTS = { ...DAY_NAMES_IT, ...DAY_NAMES_ES };

// Ordine canonico dei giorni nel risultato (domenica come giorno 0 in JS)
const CANONICAL_DAY_ORDER = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

function normalizeSlot(raw) {
  // Normalizza a HH:MM-HH:MM (zero-padded, solo se end > start)
  const m = String(raw).match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const [, h1, m1, h2, m2] = m;
  const start = `${h1.padStart(2, '0')}:${m1}`;
  const end = `${h2.padStart(2, '0')}:${m2}`;
  const startMin = parseInt(h1, 10) * 60 + parseInt(m1, 10);
  const endMin = parseInt(h2, 10) * 60 + parseInt(m2, 10);
  if (endMin <= startMin) return null;
  return `${start}-${end}`;
}

function normalizeDayKey(raw) {
  // Normalizza accenti e spazi, cerca in tutte le varianti
  const key = String(raw)
    .toLocaleLowerCase('it-IT')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '')
    .trim();
  return ALL_DAY_VARIANTS[key] || null;
}

function emptySchedule() {
  const s = {};
  for (const d of CANONICAL_DAY_ORDER) s[d] = [];
  return s;
}

async function openScheduleByName(page, diagnostic, preferredName) {
  // La pagina elenco mostra una tabella con righe nominate (es. "Orari fissi",
  // "Orari settimana + venerdì") + icone matita/cestino. Per leggere la griglia
  // bisogna cliccare la matita della riga giusta. Strategia:
  //   1. Cerca riga che contiene esattamente preferredName (case-insensitive)
  //   2. Se non trovata, prova chiavi parziali (venerdi, settimana, ...)
  //   3. Se ancora niente, prende la PRIMA riga editabile della tabella
  diagnostic.steps.push('schedule_list_open_row');
  const wanted = String(preferredName || 'Orari settimana + venerdi').toLowerCase();

  for (const entry of pageContentContexts(page)) {
    const found = await entry.target.evaluate((wantedName) => {
      const normalize = (v) => String(v || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      const w = normalize(wantedName);
      const partialKeywords = ['venerdi', 'settimana', 'fissi'];

      const rows = [...document.querySelectorAll('tr')];
      // Tenta match esatto
      let target = rows.find((tr) => normalize(tr.innerText).includes(w));
      // Tenta match parziale con parole-chiave note (in ordine di preferenza)
      if (!target) {
        for (const kw of partialKeywords) {
          target = rows.find((tr) => normalize(tr.innerText).includes(kw));
          if (target) break;
        }
      }
      // Fallback: prima riga con un'icona/link cliccabile
      if (!target) {
        target = rows.find((tr) => tr.querySelector('a[href], img[onclick], [onclick]'));
      }
      if (!target) return { clicked: false, reason: 'no_editable_row' };

      // Cerca l'azione di modifica nella riga: matita verde, edit, modifica
      const candidates = [
        ...target.querySelectorAll('a[href]:not([href="#"]), img[onclick], [onclick]'),
      ];
      // Preferisci link con title/alt/class che indicano "modifica/edit"
      const scoreOf = (el) => {
        const hay = [
          el.getAttribute?.('title') || '',
          el.getAttribute?.('alt') || '',
          el.getAttribute?.('href') || '',
          el.getAttribute?.('onclick') || '',
          el.className || '',
        ].join(' ').toLowerCase();
        if (/edit|modif|matita|pencil|verde|green/i.test(hay)) return 3;
        if (/delete|cancel|elimin|rosso|red/i.test(hay)) return -1;
        return 1;
      };
      candidates.sort((a, b) => scoreOf(b) - scoreOf(a));
      const editEl = candidates[0];
      if (!editEl) return { clicked: false, reason: 'no_action_link', rowText: target.innerText.slice(0, 120) };
      const action = editEl.closest('a[href], [onclick]') || editEl;
      action.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return { clicked: true, rowText: target.innerText.slice(0, 120) };
    }, wanted).catch(() => null);

    if (found?.clicked) {
      diagnostic.navigationAttempts.push({ action: 'edit_row_click', rowText: found.rowText, contextKind: entry.kind });
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(1500);
      return true;
    } else if (found) {
      diagnostic.navigationAttempts.push({ action: 'edit_row_miss', reason: found.reason, contextKind: entry.kind });
    }
  }
  return false;
}

async function navigateToSlotSchedule(page, baseUrl, diagnostic, options = {}) {
  diagnostic.steps.push('slot_schedule_navigate');
  diagnostic.navigationAttempts = diagnostic.navigationAttempts || [];

  // Step 1: click "Sistema" in top menu
  const sistemaClicked = await clickMenuEntryEverywhere(page, 'Sistema', 'click_sistema_menu', diagnostic);
  if (!sistemaClicked) {
    diagnostic.navigationAttempts.push({ action: 'sistema_menu_miss', url: page.url() });
  } else {
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1200);
  }

  // Step 2: click "Campi" / "Installazioni" / "Instalaciones" sub-menu
  const campiLabels = ['Campi', 'Installazioni', 'Instalaciones', 'Pistas'];
  let campiClicked = false;
  for (const label of campiLabels) {
    campiClicked = await clickMenuEntryEverywhere(page, label, `click_${label.toLowerCase()}`, diagnostic);
    if (campiClicked) break;
  }
  if (campiClicked) {
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1200);
  } else {
    diagnostic.navigationAttempts.push({ action: 'campi_submenu_miss', url: page.url() });
  }

  // Step 3: click "Orari di utilizzo delle installazioni" / "Horarios de uso"
  const orariLabels = [
    'Orari di utilizzo delle installazioni',
    'Orari di utilizzo',
    'Horarios de uso de las instalaciones',
    'Horarios de uso',
    'Orari slot',
  ];
  let orariClicked = false;
  for (const label of orariLabels) {
    orariClicked = await clickMenuEntryEverywhere(page, label, `click_${label.toLowerCase().replace(/\s+/g, '_')}`, diagnostic);
    if (orariClicked) break;
  }
  let reachedList = false;
  if (orariClicked) {
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    diagnostic.slotScheduleListUrl = page.url();
    diagnostic.slotScheduleListTitle = await page.title().catch(() => '');
    reachedList = true;
  }

  // Fallback: direct URL candidates per arrivare alla lista
  if (!reachedList) {
    diagnostic.steps.push('slot_schedule_direct_url_fallback');
    const urlCandidates = [
      '/Sistema/HorariosInstalacion.aspx',
      '/Sistema/OrarioInstalaciones.aspx',
      '/Configuracion/HorariosInstalacion.aspx',
    ];
    for (const path of urlCandidates) {
      try {
        await page.goto(absoluteUrl(baseUrl, path), { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(1000);
        const url = page.url();
        diagnostic.navigationAttempts.push({ action: 'direct_url', path, resultUrl: url });
        if (!/Login\.aspx/i.test(url) && !/Error\.aspx|aspxerrorpath=/i.test(url)) {
          diagnostic.slotScheduleListUrl = url;
          diagnostic.slotScheduleListTitle = await page.title().catch(() => '');
          reachedList = true;
          break;
        }
      } catch (err) {
        diagnostic.navigationAttempts.push({ action: 'direct_url_err', path, error: err.message });
      }
    }
  }

  if (!reachedList) return false;

  // Step 4: la pagina mostra una lista di schede (es. "Orari fissi",
  // "Orari settimana + venerdì"). Cliccare la matita per aprire quella attiva.
  const opened = await openScheduleByName(page, diagnostic, options.preferredScheduleName);
  if (!opened) {
    diagnostic.navigationAttempts.push({ action: 'schedule_row_not_opened' });
    // Comunque torna true: il parser può tentare di leggere la lista nuda
    // (alcuni layout potrebbero mostrare gli orari inline).
  }
  diagnostic.slotScheduleUrl = page.url();
  diagnostic.slotScheduleTitle = await page.title().catch(() => '');
  return true;
}


async function parseSlotSchedulePage(page, diagnostic) {
  diagnostic.steps.push('slot_schedule_parse');
  const schedule = emptySchedule();
  let parsedBy = null;

  // Collect HTML from page + all frames
  const htmlSources = [];
  for (const entry of pageContentContexts(page)) {
    const html = await entry.target.evaluate(() => document.body?.innerHTML || '').catch(() => '');
    const text = await readContextBody(entry.target).catch(() => '');
    htmlSources.push({ kind: entry.kind, index: entry.index, url: entry.url, html, text });
  }
  diagnostic.slotScheduleContextCount = htmlSources.length;

  // ── Strategy 1: Table with day-name headers ──────────────────────────────
  // Find tables where the header row contains day names; rows with HH:MM-HH:MM
  // in the first cell indicate a slot; non-empty or checked cells in day columns
  // mean that slot is active for that day.
  for (const source of htmlSources) {
    if (parsedBy) break;
    const result = await (async () => {
      const target = source.kind === 'page' ? page : page.frames()[source.index];
      if (!target) return null;
      return target.evaluate((dayVariants, canonicalOrder) => {
        const compact = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
        const normalizeDay = (raw) => {
          const key = String(raw)
            .toLocaleLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/\s+/g, '')
            .trim();
          return dayVariants[key] || null;
        };
        const timeRangeRe = /\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}/;

        for (const table of document.querySelectorAll('table')) {
          const rows = [...table.querySelectorAll('tr')];
          if (rows.length < 2) continue;

          // Find header row with day names
          let dayColMap = null; // { canonicalDay: colIndex }
          let headerRowIdx = -1;
          for (let ri = 0; ri < Math.min(rows.length, 5); ri++) {
            const cells = [...rows[ri].querySelectorAll('td, th')];
            const found = {};
            cells.forEach((cell, ci) => {
              const day = normalizeDay(compact(cell.innerText));
              if (day) found[day] = ci;
            });
            if (Object.keys(found).length >= 2) {
              dayColMap = found;
              headerRowIdx = ri;
              break;
            }
          }
          if (!dayColMap || headerRowIdx < 0) continue;

          const sched = {};
          for (const d of canonicalOrder) sched[d] = [];

          for (let ri = headerRowIdx + 1; ri < rows.length; ri++) {
            const cells = [...rows[ri].querySelectorAll('td, th')];
            if (cells.length === 0) continue;
            const firstText = compact(cells[0]?.innerText || '');
            if (!timeRangeRe.test(firstText)) continue;
            const slotRaw = firstText.match(/\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}/)?.[0];
            if (!slotRaw) continue;

            for (const [day, ci] of Object.entries(dayColMap)) {
              if (ci >= cells.length) continue;
              const cell = cells[ci];
              const cellText = compact(cell.innerText);
              const hasCheck = cell.querySelector('input[type="checkbox"]:checked, input[type="radio"]:checked') !== null;
              const isNonEmpty = cellText.length > 0 || hasCheck || cell.querySelector('img, .active, .checked') !== null;
              if (isNonEmpty) sched[day].push(slotRaw);
            }
          }

          const totalSlots = Object.values(sched).reduce((n, arr) => n + arr.length, 0);
          if (totalSlots > 0) return { sched, parsedBy: 'table_day_headers' };
        }
        return null;
      }, ALL_DAY_VARIANTS, CANONICAL_DAY_ORDER).catch(() => null);
    })();

    if (result?.sched) {
      for (const [day, slots] of Object.entries(result.sched)) {
        schedule[day] = [...new Set(slots.map(normalizeSlot).filter(Boolean))];
      }
      parsedBy = result.parsedBy;
    }
  }

  // ── Strategy 2: Day-section scan (list layout) ────────────────────────────
  // Walk page text line by line; when a line is a day name start collecting
  // time ranges for that day until the next day name.
  if (!parsedBy) {
    for (const source of htmlSources) {
      if (parsedBy) break;
      const lines = source.text.split(/[\n\r]+/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
      let currentDay = null;
      let found = false;
      for (const line of lines) {
        const day = normalizeDayKey(line);
        if (day) {
          currentDay = day;
          found = true;
          continue;
        }
        if (!currentDay) continue;
        const slotMatch = line.match(/\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}/g);
        if (slotMatch) {
          for (const raw of slotMatch) {
            const normalized = normalizeSlot(raw);
            if (normalized) schedule[currentDay].push(normalized);
          }
        }
      }
      if (found) {
        // Deduplicate
        for (const d of CANONICAL_DAY_ORDER) {
          schedule[d] = [...new Set(schedule[d])];
        }
        const total = CANONICAL_DAY_ORDER.reduce((n, d) => n + schedule[d].length, 0);
        if (total > 0) parsedBy = 'day_section_scan';
      }
    }
  }

  // ── Strategy 3: Generic extraction — all time ranges grouped by proximity ─
  if (!parsedBy) {
    for (const source of htmlSources) {
      if (parsedBy) break;
      // Extract all (dayName, timeRange) pairs from the text by proximity
      const text = source.text;
      const tokenRe = /(\b(?:lune[ds]í?|martedì|martes|mercoledì|mi[eé]rcoles|giovedì|jueves|venerdì|viernes|sabato|s[aá]bado|domenica|domingo)\b)|(\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2})/gi;
      let match;
      let lastDay = null;
      while ((match = tokenRe.exec(text)) !== null) {
        if (match[1]) {
          lastDay = normalizeDayKey(match[1]);
        } else if (match[2] && lastDay) {
          const normalized = normalizeSlot(match[2]);
          if (normalized) schedule[lastDay].push(normalized);
        }
      }
      for (const d of CANONICAL_DAY_ORDER) {
        schedule[d] = [...new Set(schedule[d])];
      }
      const total = CANONICAL_DAY_ORDER.reduce((n, d) => n + schedule[d].length, 0);
      if (total > 0) parsedBy = 'generic_proximity';
    }
  }

  const totalSlots = CANONICAL_DAY_ORDER.reduce((n, d) => n + schedule[d].length, 0);
  diagnostic.slotScheduleParsedBy = parsedBy || 'none';
  diagnostic.slotScheduleTotalSlots = totalSlots;

  return { schedule, parsedBy, totalSlots };
}

async function exportSlotScheduleWithBrowser(options = {}) {
  const username = clean(options.username) || env('MATCHPOINT_USERNAME');
  const password = clean(options.password) || env('MATCHPOINT_PASSWORD');
  if (!username || !password) {
    throw fail('MATCHPOINT_WORKER_SECRETS_MISSING', 'Mancano credenziali Matchpoint nel worker o nella richiesta server-to-server.');
  }

  const baseUrl = clean(options.baseUrl) || env('MATCHPOINT_BASE_URL', DEFAULT_BASE_URL);
  const diagnostic = {
    mode: 'browser_worker_headless',
    flow: 'slot_schedule',
    baseUrl,
    startedAt: new Date().toISOString(),
    steps: [],
  };

  const browser = await chromium.launch({
    headless: boolEnv('MATCHPOINT_HEADLESS', true),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const context = await browser.newContext({
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

    // Navigate to "Orari di utilizzo delle installazioni" e apri la scheda attiva
    const preferredScheduleName = clean(options.scheduleName) || env('MATCHPOINT_SLOT_SCHEDULE_NAME', 'Orari settimana + venerdi');
    diagnostic.preferredScheduleName = preferredScheduleName;
    const navigated = await navigateToSlotSchedule(page, baseUrl, diagnostic, { preferredScheduleName });
    if (!navigated) {
      throw fail('MATCHPOINT_SLOT_SCHEDULE_NOT_FOUND', 'Impossibile navigare alla pagina orari slot Matchpoint.', {
        url: page.url(),
        title: await page.title().catch(() => ''),
        navigationAttempts: diagnostic.navigationAttempts || [],
        contextSamples: await contextSamples(page),
      });
    }

    // Parse the schedule
    const { schedule, parsedBy, totalSlots } = await parseSlotSchedulePage(page, diagnostic);
    diagnostic.finishedAt = new Date().toISOString();

    return {
      ok: true,
      schedule,
      totalSlots,
      diagnostic,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

async function handleSlotScheduleExport(req, res) {
  requireWorkerAuth(req);
  const body = await readBody(req);
  const result = await exportSlotScheduleWithBrowser(body);
  json(res, 200, result);
}

async function handleGetSlots(req, res) {
  requireWorkerAuth(req);
  const body = await readBody(req);
  const result = await getSlotsWithBrowser(body);
  json(res, 200, result);
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND POLLER — controllo automatico disponibilità Matchpoint
// ─────────────────────────────────────────────────────────────────────────────
// Variabili d'ambiente (da .env sul server):
//
//   POLLER_ENABLED=true            Attiva il loop (default: false — sicuro out-of-box)
//   POLLER_INTERVAL_MS=300000      Ogni 5 minuti (default; minimo 60000)
//   POLLER_DAYS_AHEAD=3            Quanti giorni mobili controllare (default 3, max 14)
//   POLLER_STATE_FILE=             Path JSON su disco (default: /opt/matchpoint-worker/poller-state.json)
//   POLLER_WEBHOOK_URL=            URL POST per notifiche di cambio slot (facoltativo)
//   POLLER_FASCIA_START=08:00      Filtra solo slot >= quest'ora (facoltativo)
//   POLLER_FASCIA_END=23:00        Filtra solo slot < quest'ora (facoltativo)

const POLLER_ENABLED       = boolEnv('POLLER_ENABLED', false);
const POLLER_INTERVAL_MS   = Math.max(60_000, Number(env('POLLER_INTERVAL_MS', '300000')) || 300_000);
const POLLER_DAYS_AHEAD    = Math.max(1, Math.min(14, Number(env('POLLER_DAYS_AHEAD', '3')) || 3));
const POLLER_STATE_FILE    = env('POLLER_STATE_FILE', '/opt/matchpoint-worker/poller-state.json');
const POLLER_WEBHOOK_URL   = env('POLLER_WEBHOOK_URL', '');
const POLLER_FASCIA_START  = env('POLLER_FASCIA_START', '');
const POLLER_FASCIA_END    = env('POLLER_FASCIA_END', '');

// ── Stato in memoria ──────────────────────────────────────────────────────────
const pollerMem = {
  running: false,
  lastRunAt: null,
  lastRunDurationMs: null,
  lastRunError: null,
  nextRunAt: null,
  runCount: 0,
  // { 'YYYY-MM-DD': { fetchedAt, parsedBy, timeSlotsCount, campi: [...] } }
  snapshots: {},
  // Ultimi 200 cambi rilevati
  changes: [],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function pollerLog(event, extra = {}) {
  console.log(JSON.stringify({ event: `poller_${event}`, time: new Date().toISOString(), ...extra }));
}

function pollerTargetDates() {
  const dates = [];
  for (let i = 0; i < POLLER_DAYS_AHEAD; i++) dates.push(addDaysIso(todayIsoRome(), i));
  return dates;
}

function pollerSlotInFascia(slot) {
  const ora = slot.ora || '';
  if (!ora) return false;
  if (POLLER_FASCIA_START && ora < POLLER_FASCIA_START) return false;
  if (POLLER_FASCIA_END   && ora >= POLLER_FASCIA_END)  return false;
  return true;
}

// Mappa { campoNome → { 'HH:MM' → { libero, colore } } } per confronto rapido
function buildSlotMap(result) {
  const map = {};
  for (const campo of (result.campi || [])) {
    map[campo.nome] = {};
    for (const slot of (campo.slots || []).filter(pollerSlotInFascia)) {
      map[campo.nome][slot.ora] = { libero: !!slot.libero, colore: slot.colore || '' };
    }
  }
  return map;
}

// Confronta snapshot precedente vs corrente, restituisce array di cambi
function detectChanges(isoDate, prevResult, currResult) {
  if (!prevResult || !currResult) return [];
  const prev = buildSlotMap(prevResult);
  const curr = buildSlotMap(currResult);
  const changes = [];
  const now = new Date().toISOString();
  for (const [campoNome, currSlots] of Object.entries(curr)) {
    const prevSlots = prev[campoNome] || {};
    for (const [ora, currState] of Object.entries(currSlots)) {
      const prevState = prevSlots[ora];
      if (!prevState) continue; // slot non presente nello snapshot prev: non confrontabile
      if (!prevState.libero && currState.libero) {
        // ⭐ DISDETTA: slot tornato libero (opportunità!)
        changes.push({ tipo: 'disdetta', data: isoDate, campo: campoNome, ora, detectedAt: now });
      } else if (prevState.libero && !currState.libero) {
        // Nuova prenotazione: slot appena occupato
        changes.push({ tipo: 'prenotazione', data: isoDate, campo: campoNome, ora, detectedAt: now });
      }
    }
  }
  return changes;
}

// ── Persistenza su disco ──────────────────────────────────────────────────────

function pollerLoadFromDisk() {
  if (!POLLER_STATE_FILE) return;
  try {
    const raw = fs.readFileSync(POLLER_STATE_FILE, 'utf8');
    const saved = JSON.parse(raw);
    if (saved.snapshots) Object.assign(pollerMem.snapshots, saved.snapshots);
    if (Array.isArray(saved.changes)) pollerMem.changes = saved.changes.slice(-200);
    pollerLog('state_loaded', {
      snapshotDates: Object.keys(pollerMem.snapshots),
      recentChanges: pollerMem.changes.length,
    });
  } catch { /* file non ancora esistente — prima esecuzione */ }
}

function pollerSaveToDisk() {
  if (!POLLER_STATE_FILE) return;
  try {
    fs.writeFileSync(POLLER_STATE_FILE, JSON.stringify({
      savedAt: new Date().toISOString(),
      snapshots: pollerMem.snapshots,
      changes: pollerMem.changes.slice(-200),
    }, null, 2), 'utf8');
  } catch (err) {
    pollerLog('state_save_error', { error: err.message });
  }
}

// ── Notifica webhook ──────────────────────────────────────────────────────────

async function pollerNotifyWebhook(payload) {
  if (!POLLER_WEBHOOK_URL) return;
  try {
    const res = await fetch(POLLER_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    pollerLog('webhook_sent', { status: res.status, changes: payload.changes?.length });
  } catch (err) {
    pollerLog('webhook_error', { error: err.message });
  }
}

// ── Ciclo principale ──────────────────────────────────────────────────────────

// Codici d'errore che indicano Matchpoint irraggiungibile — inutile continuare
// con le date successive se già 3 consecutivi falliscono per lo stesso motivo.
const BAIL_EARLY_CODES = new Set([
  'MATCHPOINT_TABELLONE_NOT_FOUND',
  'MATCHPOINT_BROWSER_LOGIN_FAILED',
  'MATCHPOINT_WORKER_SECRETS_MISSING',
]);
const BAIL_EARLY_THRESHOLD = 3;

async function runPollCycle() {
  if (pollerMem.running) {
    pollerLog('cycle_skipped', { reason: 'previous_cycle_still_running' });
    return;
  }
  pollerMem.running = true;
  const cycleStart = Date.now();
  pollerMem.runCount++;
  const dates = pollerTargetDates();
  pollerLog('cycle_start', { run: pollerMem.runCount, dates });

  const allChanges = [];
  let consecutiveFails = 0;
  let bailCode = null;

  for (const isoDate of dates) {
    if (consecutiveFails >= BAIL_EARLY_THRESHOLD) {
      pollerLog('cycle_bail_early', { reason: bailCode, skippedFrom: isoDate });
      break;
    }
    try {
      const result = await getSlotsWithBrowser({ date: isoDate });
      consecutiveFails = 0;
      bailCode = null;
      const prevSnap = pollerMem.snapshots[isoDate];
      const changes  = detectChanges(isoDate, prevSnap, result);

      // Aggiorna snapshot
      pollerMem.snapshots[isoDate] = {
        fetchedAt: new Date().toISOString(),
        parsedBy: result.parsedBy || '',
        timeSlotsCount: result.timeSlotsCount,
        campi: result.campi || [],
      };

      if (changes.length > 0) {
        allChanges.push(...changes);
        pollerMem.changes.push(...changes);
        if (pollerMem.changes.length > 200) pollerMem.changes = pollerMem.changes.slice(-200);
        pollerLog('changes_detected', { date: isoDate, count: changes.length, changes });
      } else {
        const liberiCount = (result.campi || [])
          .reduce((n, c) => n + (c.slots || []).filter((s) => s.libero).length, 0);
        pollerLog('cycle_date_ok', {
          date: isoDate,
          parsedBy: result.parsedBy,
          campi: (result.campi || []).length,
          liberi: liberiCount,
        });
      }
    } catch (err) {
      pollerLog('cycle_date_error', { date: isoDate, error: err.message, code: err.code || '' });
      if (BAIL_EARLY_CODES.has(err.code)) {
        consecutiveFails++;
        bailCode = err.code;
      } else {
        consecutiveFails = 0;
        bailCode = null;
      }
    }
  }

  if (allChanges.length > 0) {
    await pollerNotifyWebhook({
      event: 'slot_changes',
      detectedAt: new Date().toISOString(),
      changes: allChanges,
    });
  }

  pollerSaveToDisk();
  pollerMem.running = false;
  pollerMem.lastRunAt = new Date().toISOString();
  pollerMem.lastRunDurationMs = Date.now() - cycleStart;
  pollerMem.lastRunError = null;
  pollerMem.nextRunAt = new Date(Date.now() + POLLER_INTERVAL_MS).toISOString();
  pollerLog('cycle_end', {
    run: pollerMem.runCount,
    durationMs: pollerMem.lastRunDurationMs,
    changes: allChanges.length,
  });
}

// ── Avvio ─────────────────────────────────────────────────────────────────────

function startPoller() {
  if (!POLLER_ENABLED) {
    pollerLog('disabled', { hint: 'Set POLLER_ENABLED=true in .env to activate' });
    return;
  }
  pollerLoadFromDisk();
  pollerLog('starting', {
    intervalMs: POLLER_INTERVAL_MS,
    daysAhead: POLLER_DAYS_AHEAD,
    fascia: POLLER_FASCIA_START ? `${POLLER_FASCIA_START}–${POLLER_FASCIA_END}` : 'all day',
    webhook: POLLER_WEBHOOK_URL ? 'configured' : 'none',
    stateFile: POLLER_STATE_FILE,
  });

  // Prima esecuzione dopo 10s (dà tempo al server di completare il listen)
  const firstRun = setTimeout(() => {
    runPollCycle().catch((err) => {
      pollerMem.lastRunError = err.message;
      pollerMem.running = false;
      pollerLog('cycle_fatal_error', { error: err.message });
    });
  }, 10_000);
  firstRun.unref();

  // Esecuzioni periodiche
  const timer = setInterval(() => {
    runPollCycle().catch((err) => {
      pollerMem.lastRunError = err.message;
      pollerMem.running = false;
      pollerLog('cycle_fatal_error', { error: err.message });
    });
  }, POLLER_INTERVAL_MS);
  timer.unref(); // Non impedisce a PM2 di terminare il processo se necessario

  pollerMem.nextRunAt = new Date(Date.now() + 10_000).toISOString();
}

// ── HTTP handlers poller ──────────────────────────────────────────────────────

function handlePollerStatus(req, res) {
  requireWorkerAuth(req);
  json(res, 200, {
    ok: true,
    enabled: POLLER_ENABLED,
    running: pollerMem.running,
    lastRunAt: pollerMem.lastRunAt,
    lastRunDurationMs: pollerMem.lastRunDurationMs,
    lastRunError: pollerMem.lastRunError,
    nextRunAt: pollerMem.nextRunAt,
    runCount: pollerMem.runCount,
    intervalMs: POLLER_INTERVAL_MS,
    daysAhead: POLLER_DAYS_AHEAD,
    trackedDates: Object.keys(pollerMem.snapshots),
    recentChangesCount: pollerMem.changes.length,
    webhookConfigured: !!POLLER_WEBHOOK_URL,
  });
}

function handlePollerSlots(req, res) {
  requireWorkerAuth(req);
  // Restituisce gli snapshot in cache senza aprire il browser
  json(res, 200, { ok: true, snapshots: pollerMem.snapshots });
}

function handlePollerChanges(req, res) {
  requireWorkerAuth(req);
  json(res, 200, {
    ok: true,
    changes: pollerMem.changes.slice(-50),
    total: pollerMem.changes.length,
  });
}

async function handlePollerForceRun(req, res) {
  requireWorkerAuth(req);
  if (pollerMem.running) {
    return json(res, 409, { ok: false, error: 'POLLER_ALREADY_RUNNING' });
  }
  json(res, 202, { ok: true, message: 'Poll cycle started in background', nextRun: pollerMem.runCount + 1 });
  runPollCycle().catch((err) => {
    pollerMem.lastRunError = err.message;
    pollerMem.running = false;
    pollerLog('force_run_error', { error: err.message });
  });
}

const server = http.createServer(async (req, res) => {
  console.log(JSON.stringify({
    event: 'incoming_request',
    method: req.method,
    url: req.url,
    headers: {
      host: req.headers.host,
      authorization: req.headers.authorization ? 'Present' : 'Absent',
      'content-type': req.headers['content-type'],
    },
    time: new Date().toISOString(),
  }));
  try {
    if (req.method === 'GET' && req.url === '/health') {
      return json(res, 200, {
        ok: true,
        service: 'pmo-matchpoint-browser-worker',
        routes: [
          '/export-clients', '/export-booking-history', '/get-slots', '/export-slot-schedule',
          '/poller/status', '/poller/slots', '/poller/changes', '/poller/force-run',
        ],
        pollerEnabled: POLLER_ENABLED,
        pollerIntervalMs: POLLER_INTERVAL_MS,
        pollerDaysAhead: POLLER_DAYS_AHEAD,
        historyLabels: ['Elenco degli utenti negli spazi'],
        historyNavigation: 'all-contexts-dom-fallback',
        historyReportRecognition: 'utenti-spazi-only',
        historyExportRecognition: 'table-first-dom-export',
        clientsNavigationFallback: 'click-timeout-direct-players',
        getSlotsNavigation: 'default-then-programmazione-then-toolbar',
        getSlotsDateFormat: 'dd/mm/yyyy italian input',
        slotScheduleNavigation: 'sistema-campi-orari',
        time: new Date().toISOString(),
      });
    }
    if (req.method === 'POST' && req.url === '/export-clients') {
      return await handleExport(req, res);
    }
    if (req.method === 'POST' && req.url === '/export-booking-history') {
      return await handleHistoryExport(req, res);
    }
    if (req.method === 'POST' && req.url === '/get-slots') {
      return await handleGetSlots(req, res);
    }
    if (req.method === 'POST' && req.url === '/export-slot-schedule') {
      return await handleSlotScheduleExport(req, res);
    }
    if (req.method === 'GET' && req.url === '/poller/status') {
      return handlePollerStatus(req, res);
    }
    if (req.method === 'GET' && req.url === '/poller/slots') {
      return handlePollerSlots(req, res);
    }
    if (req.method === 'GET' && req.url === '/poller/changes') {
      return handlePollerChanges(req, res);
    }
    if (req.method === 'POST' && req.url === '/poller/force-run') {
      return await handlePollerForceRun(req, res);
    }
    return json(res, 404, { ok: false, error: 'NOT_FOUND' });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'request_error',
      method: req.method,
      url: req.url,
      error: error.message || String(error),
      code: error.code || null,
      status: error.status || 500,
      time: new Date().toISOString(),
    }));
    const status = error.status || 500;
    json(res, status, {
      ok: false,
      error: error.code || error.message || 'WORKER_ERROR',
      message: error.message || 'Errore worker Matchpoint.',
      diagnostic: error.diagnostic || null,
    });
  }
});

// Playwright può emettere eventi (page crash, browser disconnect) come promise
// rejection al di fuori dei try/catch del ciclo. In Node.js 15+ questo uccide
// il processo senza log. Catturiamo qui per loggare e mantenere il server vivo.
process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error(JSON.stringify({
    event: 'unhandled_rejection',
    error: msg,
    time: new Date().toISOString(),
  }));
  // Se il poller era in esecuzione al momento del crash, sblocca il flag.
  if (pollerMem.running) {
    pollerMem.running = false;
    pollerMem.lastRunError = `unhandled_rejection: ${msg}`;
    pollerLog('cycle_interrupted_by_rejection', { error: msg });
  }
});

const port = Number(env('PORT', '8787'));
server.listen(port, () => {
  // Assicura che il flag running sia falso all'avvio (importante dopo un restart
  // dovuto a crash mid-cycle, dove pollerSaveToDisk potrebbe non essere stato chiamato).
  pollerMem.running = false;
  console.log(JSON.stringify({
    event: 'matchpoint_browser_worker_started',
    port,
    headless: boolEnv('MATCHPOINT_HEADLESS', true),
  }));
  startPoller();
});
