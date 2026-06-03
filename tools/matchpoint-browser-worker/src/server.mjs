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
const RECURSO_BY_CAMPO = { 1: 13, 2: 14, 3: 15, 4: 16 }; // padel: Campo N → id_recurso Matchpoint
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

// ── Coda operazioni browser Matchpoint (concorrenza 1) ───────────────────────
// Il worker usa UN solo account Matchpoint e regge una sola sessione browser per
// volta. Ogni operazione che lancia Chromium DEVE essere serializzata: mai due
// sessioni Matchpoint in parallelo (collisione di sessione + carico VM). La coda è
// in memoria, nel processo singolo del worker, e si azzera al restart (accettabile).
const QUEUE_JOB_TIMEOUT_MS = Number(env('MATCHPOINT_QUEUE_TIMEOUT_MS', '180000')); // 3 min di sicurezza
const mpQueue = {
  seq: 0,
  running: null, // { id, op, label, operatore, startedAt }
  waiting: [],   // [{ id, op, label, operatore, enqueuedAt }]
  _chain: Promise.resolve(),
};

// Etichetta leggibile ("cosa") per /queue/status, ricavata dal payload della richiesta.
// `operatore` ("chi") arriverà dall'app in Fase 2; per ora ripiega su '—'.
function mpJobMeta(op, body = {}) {
  const operatore = clean(body.operatore) || '—';
  const b = body.booking || body || {};
  const campoTxt = (b.campo !== undefined && b.campo !== null && b.campo !== '')
    ? `Campo ${b.campo}`
    : (body.idReserva ? `#${body.idReserva}` : '');
  const ora = clean(b.ora || body.ora) || '';
  if (op === 'create') {
    const tipo = clean(b.tipo) || 'prenotazione';
    return { op, operatore, label: ['prenotazione', tipo, campoTxt, ora].filter(Boolean).join(' · ') };
  }
  if (op === 'edit')   return { op, operatore, label: ['modifica', campoTxt, ora].filter(Boolean).join(' · ') };
  if (op === 'cancel') return { op, operatore, label: ['annullamento', campoTxt, ora].filter(Boolean).join(' · ') };
  if (op === 'client') {
    const c = body.client || {};
    const nome = [clean(c.nome || c.firstName), clean(c.cognome || c.surname)].filter(Boolean).join(' ');
    return { op, operatore, label: ['nuovo cliente', nome].filter(Boolean).join(' · ') };
  }
  return { op, operatore, label: op };
}

// Fotografia dello stato della coda per GET /queue/status.
function mpQueueSnapshot() {
  const now = Date.now();
  return {
    ok: true,
    busy: !!mpQueue.running,
    running: mpQueue.running ? {
      id: mpQueue.running.id,
      op: mpQueue.running.op,
      label: mpQueue.running.label,
      operatore: mpQueue.running.operatore,
      runningMs: now - mpQueue.running.startedAt,
    } : null,
    waitingCount: mpQueue.waiting.length,
    waiting: mpQueue.waiting.map((j) => ({ id: j.id, op: j.op, label: j.label, operatore: j.operatore })),
    time: new Date().toISOString(),
  };
}

// Esegue `fn` (async) in modo serializzato: una sola operazione browser alla volta.
// `meta` = { op, label, operatore } (solo per /queue/status).
// Ritorna/propaga ESATTAMENTE ciò che ritorna/lancia `fn`, così gli handler non cambiano semantica.
function mpQueueRun(meta, fn) {
  const job = {
    id: ++mpQueue.seq,
    op: meta.op || 'op',
    label: meta.label || meta.op || 'operazione',
    operatore: meta.operatore || '—',
    enqueuedAt: Date.now(),
  };
  mpQueue.waiting.push(job);

  const result = mpQueue._chain.then(async () => {
    const idx = mpQueue.waiting.findIndex((j) => j.id === job.id);
    if (idx >= 0) mpQueue.waiting.splice(idx, 1);
    mpQueue.running = { id: job.id, op: job.op, label: job.label, operatore: job.operatore, startedAt: Date.now() };
    let timer = null;
    try {
      // Timeout di sicurezza: un job piantato non deve bloccare la coda all'infinito.
      const guard = new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(fail('QUEUE_JOB_TIMEOUT',
          `Operazione "${job.label}" oltre ${Math.round(QUEUE_JOB_TIMEOUT_MS / 1000)}s: annullata per non bloccare la coda.`)),
          QUEUE_JOB_TIMEOUT_MS);
      });
      return await Promise.race([Promise.resolve().then(fn), guard]);
    } finally {
      if (timer) clearTimeout(timer);
      mpQueue.running = null;
    }
  });

  // La catena prosegue SEMPRE (anche se questo job fallisce) così il prossimo parte.
  mpQueue._chain = result.then(() => {}, () => {});
  return result;
}

// Handler per GET /queue/status (autenticato come gli altri).
function handleQueueStatus(req, res) {
  requireWorkerAuth(req);
  return json(res, 200, mpQueueSnapshot());
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
  } else {
    // L'editor della scheda si carica in un iframe del modal. `networkidle`
    // sulla pagina principale può tornare verde prima che l'iframe popoli,
    // lasciando il parser su un about:blank.
    await waitForSlotScheduleReady(page, diagnostic);
  }
  diagnostic.slotScheduleUrl = page.url();
  diagnostic.slotScheduleTitle = await page.title().catch(() => '');
  return true;
}

async function waitForSlotScheduleReady(page, diagnostic) {
  diagnostic.steps.push('slot_schedule_wait_iframe');
  const startedAt = Date.now();
  const deadlineMs = 30000;
  const pollIntervalMs = 500;
  const dayHintRe = /lune[dt]i|martedì|mercoledì|giovedì|venerdì|sabato|domenica/i;
  const slotHintRe = /\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}/;
  let lastSummary = null;

  while (Date.now() - startedAt < deadlineMs) {
    // Check every frame for day names + at least one slot range
    for (const frame of page.frames()) {
      const url = frame.url();
      if (!url || url === 'about:blank') continue;
      const summary = await frame.evaluate(() => ({
        url: location.href,
        readyState: document.readyState,
        bodyLen: document.body?.innerText?.length || 0,
        bodyText: (document.body?.innerText || '').slice(0, 4000),
      })).catch(() => null);
      if (!summary) continue;
      const hasDay = dayHintRe.test(summary.bodyText);
      const hasSlot = slotHintRe.test(summary.bodyText);
      lastSummary = { url: summary.url, readyState: summary.readyState, bodyLen: summary.bodyLen, hasDay, hasSlot };
      if (hasDay && hasSlot && summary.readyState === 'complete') {
        // Stable: also wait for networkidle within the frame
        await frame.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        diagnostic.slotScheduleFrameUrl = summary.url;
        diagnostic.slotScheduleWaitMs = Date.now() - startedAt;
        diagnostic.slotScheduleWaitOutcome = 'frame_ready';
        return true;
      }
    }
    await page.waitForTimeout(pollIntervalMs);
  }
  diagnostic.slotScheduleWaitMs = Date.now() - startedAt;
  diagnostic.slotScheduleWaitOutcome = 'timeout';
  diagnostic.slotScheduleLastFrameSummary = lastSummary;
  return false;
}


async function collectSlotScheduleStructureDump(page) {
  const contexts = pageContentContexts(page);
  const dump = { contextCount: contexts.length, contexts: [] };

  for (const entry of contexts) {
    const target = entry.kind === 'page' ? page : page.frames()[entry.index];
    if (!target) continue;
    const ctxInfo = await target.evaluate((dayVariants) => {
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
      const timeRangeReG = /\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}/g;

      // 1. Element counts of structural candidates
      const tagCounts = {};
      ['table', 'thead', 'tbody', 'tr', 'td', 'th', 'iframe', 'svg', 'canvas'].forEach((tag) => {
        tagCounts[tag] = document.querySelectorAll(tag).length;
      });
      const roleCounts = {};
      ['table', 'grid', 'row', 'cell', 'columnheader', 'rowheader'].forEach((role) => {
        roleCounts[role] = document.querySelectorAll(`[role="${role}"]`).length;
      });
      // grid-like divs
      const gridLikeDivs = [...document.querySelectorAll('div, ul')]
        .filter((el) => {
          const cs = getComputedStyle(el);
          return cs.display === 'grid' || cs.display === 'inline-grid' || cs.display === 'flex';
        }).length;

      // 2. Locate elements whose text is exactly (or contains) a day name
      const dayElements = [];
      const allEls = [...document.querySelectorAll('body *')];
      for (const el of allEls) {
        if (el.children.length > 0) continue; // leaf-ish only
        const txt = compact(el.innerText || el.textContent || '');
        if (!txt || txt.length > 40) continue;
        const day = normalizeDay(txt);
        if (!day) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        dayElements.push({
          day,
          text: txt,
          tag: el.tagName.toLowerCase(),
          x: Math.round(r.x), y: Math.round(r.y),
          w: Math.round(r.width), h: Math.round(r.height),
        });
        if (dayElements.length >= 50) break;
      }

      // 3. Locate elements containing time-range patterns (slots)
      const slotElements = [];
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        const txt = compact(el.innerText || el.textContent || '');
        if (!txt || !timeRangeRe.test(txt)) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        const matches = txt.match(timeRangeReG) || [];
        slotElements.push({
          slots: matches,
          tag: el.tagName.toLowerCase(),
          x: Math.round(r.x), y: Math.round(r.y),
          w: Math.round(r.width), h: Math.round(r.height),
        });
        if (slotElements.length >= 200) break;
      }

      // 4. HTML sample (truncated) for visual inspection
      const htmlSample = (document.body?.innerHTML || '').slice(0, 4000);

      return {
        url: location.href,
        title: document.title,
        tagCounts,
        roleCounts,
        gridLikeDivs,
        dayElementCount: dayElements.length,
        dayElements: dayElements.slice(0, 20),
        slotElementCount: slotElements.length,
        slotElementsSample: slotElements.slice(0, 30),
        htmlSampleLength: (document.body?.innerHTML || '').length,
        htmlSample,
      };
    }, ALL_DAY_VARIANTS).catch((err) => ({ error: String(err?.message || err) }));

    dump.contexts.push({ kind: entry.kind, index: entry.index, url: entry.url, ...ctxInfo });
  }
  return dump;
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

  // ── Strategy 0: Coordinate-based (layout-agnostic) ───────────────────────
  // Works whether the grid is built with <table>, <div> + CSS grid, ARIA
  // roles, or any other layout. Locate day-name labels and slot labels by
  // text, then attribute each slot to the day whose column its center X is
  // closest to.
  const strategy0Trace = { dayColumns: null, slotElementCount: 0, unmatched: 0, contextChosen: null };
  for (const source of htmlSources) {
    if (parsedBy) break;
    const result = await (async () => {
      const target = source.kind === 'page' ? page : page.frames()[source.index];
      if (!target) return null;
      return target.evaluate(({ dayVariants, canonicalOrder }) => {
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
        const timeRangeReG = /\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}/g;

        // Collect candidate day-name labels: leaf-ish elements whose
        // (trimmed) text matches a known day variant. Skip hidden boxes.
        const dayCandidates = [];
        for (const el of document.querySelectorAll('body *')) {
          if (el.children.length > 0) continue;
          const txt = compact(el.innerText || el.textContent || '');
          if (!txt || txt.length > 20) continue;
          const day = normalizeDay(txt);
          if (!day) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          dayCandidates.push({
            day,
            x: r.x, y: r.y, w: r.width, h: r.height,
            cx: r.x + r.width / 2,
          });
        }
        if (dayCandidates.length < 2) return { reason: 'few_day_candidates', dayCandidateCount: dayCandidates.length };

        // Cluster day candidates by Y to find the header row (the cluster
        // containing the most DISTINCT days, then prefer the one closer to
        // the top of the page).
        const yTolerance = 30; // px
        const clusters = [];
        const sorted = [...dayCandidates].sort((a, b) => a.y - b.y);
        for (const c of sorted) {
          const last = clusters[clusters.length - 1];
          if (last && Math.abs(c.y - last.yMean) <= yTolerance) {
            last.items.push(c);
            last.yMean = last.items.reduce((s, it) => s + it.y, 0) / last.items.length;
          } else {
            clusters.push({ items: [c], yMean: c.y });
          }
        }
        clusters.sort((a, b) => {
          const distA = new Set(a.items.map((it) => it.day)).size;
          const distB = new Set(b.items.map((it) => it.day)).size;
          if (distB !== distA) return distB - distA;
          return a.yMean - b.yMean;
        });
        const headerCluster = clusters[0];
        const distinctDays = new Set(headerCluster.items.map((it) => it.day));
        if (distinctDays.size < 2) return { reason: 'header_cluster_too_small', dayCandidateCount: dayCandidates.length };

        // Within the header cluster, keep one entry per day (the leftmost
        // occurrence — labels rendered twice would skew column assignment).
        const dayCenters = {};
        for (const it of headerCluster.items) {
          if (dayCenters[it.day] === undefined || it.cx < dayCenters[it.day]) {
            dayCenters[it.day] = it.cx;
          }
        }
        // Sort days by ascending X center, derive column-range midpoints.
        const dayOrder = Object.entries(dayCenters)
          .map(([day, cx]) => ({ day, cx }))
          .sort((a, b) => a.cx - b.cx);
        const ranges = dayOrder.map((d, i) => {
          const prev = dayOrder[i - 1];
          const next = dayOrder[i + 1];
          const lo = prev ? (prev.cx + d.cx) / 2 : -Infinity;
          const hi = next ? (d.cx + next.cx) / 2 : Infinity;
          return { day: d.day, lo, hi, cx: d.cx };
        });

        // Only consider slots strictly BELOW the header row.
        const headerBottom = Math.max(...headerCluster.items.map((it) => it.y + it.h));

        // Collect slot elements: leaf-ish, visible, text contains time range.
        const sched = {};
        for (const d of canonicalOrder) sched[d] = [];
        let slotElementCount = 0;
        let unmatched = 0;
        for (const el of document.querySelectorAll('body *')) {
          if (el.children.length > 0) continue;
          const txt = compact(el.innerText || el.textContent || '');
          if (!txt || !timeRangeRe.test(txt)) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.y + r.height <= headerBottom) continue; // skip anything in/above the header
          const cx = r.x + r.width / 2;
          const range = ranges.find((rg) => cx >= rg.lo && cx < rg.hi);
          if (!range) { unmatched += 1; continue; }
          const matches = txt.match(timeRangeReG) || [];
          slotElementCount += 1;
          for (const raw of matches) sched[range.day].push(raw);
        }

        // Deduplicate.
        for (const d of canonicalOrder) sched[d] = [...new Set(sched[d])];
        const totalSlots = Object.values(sched).reduce((n, arr) => n + arr.length, 0);
        if (totalSlots === 0) return { reason: 'no_slot_elements', dayColumns: dayCenters, slotElementCount, unmatched };

        return {
          sched,
          parsedBy: 'coordinate_based',
          dayColumns: dayCenters,
          slotElementCount,
          unmatched,
        };
      }, { dayVariants: ALL_DAY_VARIANTS, canonicalOrder: CANONICAL_DAY_ORDER }).catch((err) => ({ reason: 'evaluate_error', error: String(err?.message || err) }));
    })();

    if (result?.sched) {
      for (const [day, slots] of Object.entries(result.sched)) {
        schedule[day] = [...new Set(slots.map(normalizeSlot).filter(Boolean))];
      }
      parsedBy = result.parsedBy;
      strategy0Trace.dayColumns = result.dayColumns;
      strategy0Trace.slotElementCount = result.slotElementCount;
      strategy0Trace.unmatched = result.unmatched;
      strategy0Trace.contextChosen = { kind: source.kind, index: source.index, url: source.url };
    } else if (result && !strategy0Trace.contextChosen) {
      // Keep the most informative failure reason (first non-empty context).
      strategy0Trace.contextChosen = { kind: source.kind, index: source.index, url: source.url };
      strategy0Trace.reason = result.reason;
      strategy0Trace.dayCandidateCount = result.dayCandidateCount;
      strategy0Trace.slotElementCount = result.slotElementCount;
      strategy0Trace.unmatched = result.unmatched;
      strategy0Trace.dayColumns = result.dayColumns;
      strategy0Trace.error = result.error;
    }
  }
  diagnostic.slotScheduleStrategy0 = strategy0Trace;

  // ── Strategy 1: Table with day-name headers (rowspan-aware) ──────────────
  // Find tables whose header row contains day names. For each body row, build
  // a virtual column→cell map that respects rowspan from prior rows, then for
  // each day column extract every HH:MM-HH:MM range found in the cell text.
  // Empty cells (only the hour label like "09:00") and rowspan-covered slots
  // are handled correctly: the slot text "09:00-10:30" appears once in the
  // source cell and is attributed to its day column.
  const strategy1Trace = { tablesScanned: 0, tablesWithHeader: 0, bestTable: null };
  for (const source of htmlSources) {
    if (parsedBy) break;
    const result = await (async () => {
      const target = source.kind === 'page' ? page : page.frames()[source.index];
      if (!target) return null;
      return target.evaluate(({ dayVariants, canonicalOrder }) => {
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
        const timeRangeReG = /\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}/g;

        const trace = { tablesScanned: 0, tablesWithHeader: 0, bestTable: null };

        for (const table of document.querySelectorAll('table')) {
          trace.tablesScanned += 1;
          const rows = [...table.querySelectorAll('tr')];
          if (rows.length < 2) continue;

          // Find header row with day names. Header column maps the LOGICAL
          // column index (accounting for colspan) to a canonical day.
          let dayColMap = null; // { canonicalDay: logicalColIndex }
          let headerRowIdx = -1;
          for (let ri = 0; ri < Math.min(rows.length, 5); ri++) {
            const cells = [...rows[ri].querySelectorAll('td, th')];
            const found = {};
            let col = 0;
            for (const cell of cells) {
              const colspan = parseInt(cell.getAttribute('colspan') || '1', 10) || 1;
              const day = normalizeDay(compact(cell.innerText));
              if (day && found[day] === undefined) found[day] = col;
              col += colspan;
            }
            if (Object.keys(found).length >= 2) {
              dayColMap = found;
              headerRowIdx = ri;
              break;
            }
          }
          if (!dayColMap || headerRowIdx < 0) continue;
          trace.tablesWithHeader += 1;
          if (!trace.bestTable) {
            trace.bestTable = {
              rowCount: rows.length,
              headerRowIdx,
              dayColMap,
              firstBodyRowSample: rows[headerRowIdx + 1]
                ? [...rows[headerRowIdx + 1].querySelectorAll('td, th')]
                    .slice(0, 10)
                    .map((c) => compact(c.innerText).slice(0, 30))
                : null,
            };
          }

          const sched = {};
          for (const d of canonicalOrder) sched[d] = [];

          // pendingRowspan[col] = { cell, rowsLeft } for cells that span
          // multiple rows starting in a previous iteration.
          const pendingRowspan = new Map();

          for (let ri = headerRowIdx + 1; ri < rows.length; ri++) {
            const cells = [...rows[ri].querySelectorAll('td, th')];
            // Build colIdx -> cell map for THIS row, advancing past columns
            // already occupied by rowspans from earlier rows.
            const rowCellByCol = new Map();
            let colCursor = 0;
            for (const cell of cells) {
              while (pendingRowspan.has(colCursor)) colCursor++;
              const colspan = parseInt(cell.getAttribute('colspan') || '1', 10) || 1;
              const rowspan = parseInt(cell.getAttribute('rowspan') || '1', 10) || 1;
              for (let cs = 0; cs < colspan; cs++) {
                rowCellByCol.set(colCursor + cs, cell);
                if (rowspan > 1) {
                  pendingRowspan.set(colCursor + cs, { cell, rowsLeft: rowspan - 1 });
                }
              }
              colCursor += colspan;
            }
            // Merge in cells still active from earlier rowspans.
            for (const [col, info] of pendingRowspan.entries()) {
              if (!rowCellByCol.has(col)) rowCellByCol.set(col, info.cell);
            }

            // Extract time ranges per day column.
            for (const [day, ci] of Object.entries(dayColMap)) {
              const cell = rowCellByCol.get(ci);
              if (!cell) continue;
              const text = compact(cell.innerText);
              if (!text) continue;
              const matches = text.match(timeRangeReG);
              if (!matches) continue;
              for (const raw of matches) sched[day].push(raw);
            }

            // Decrement rowspan counters; drop entries that are exhausted.
            for (const [col, info] of [...pendingRowspan.entries()]) {
              info.rowsLeft -= 1;
              if (info.rowsLeft <= 0) pendingRowspan.delete(col);
            }
          }

          // Deduplicate slot ranges per day (rowspan cells repeat the same
          // text on every row they cover).
          for (const d of canonicalOrder) sched[d] = [...new Set(sched[d])];

          const totalSlots = Object.values(sched).reduce((n, arr) => n + arr.length, 0);
          if (trace.bestTable) trace.bestTable.slotsFound = totalSlots;
          if (totalSlots > 0) return { sched, parsedBy: 'table_day_headers', trace };
        }
        return { trace };
      }, { dayVariants: ALL_DAY_VARIANTS, canonicalOrder: CANONICAL_DAY_ORDER }).catch(() => null);
    })();

    if (result?.trace) {
      strategy1Trace.tablesScanned += result.trace.tablesScanned;
      strategy1Trace.tablesWithHeader += result.trace.tablesWithHeader;
      if (!strategy1Trace.bestTable && result.trace.bestTable) {
        strategy1Trace.bestTable = result.trace.bestTable;
      }
    }
    if (result?.sched) {
      for (const [day, slots] of Object.entries(result.sched)) {
        schedule[day] = [...new Set(slots.map(normalizeSlot).filter(Boolean))];
      }
      parsedBy = result.parsedBy;
    }
  }
  diagnostic.slotScheduleStrategy1 = strategy1Trace;

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

    // Optional structural dump for off-line analysis. Triggered with
    // { debug: true } in request body. Returns DOM structure samples
    // (no parsing attempt) so we can reverse-engineer non-<table> layouts.
    if (options.debug === true) {
      const dump = await collectSlotScheduleStructureDump(page);
      diagnostic.finishedAt = new Date().toISOString();
      return {
        ok: true,
        debug: true,
        structureDump: dump,
        diagnostic,
      };
    }

    // Parse the schedule
    const { schedule, parsedBy, totalSlots } = await parseSlotSchedulePage(page, diagnostic);
    diagnostic.finishedAt = new Date().toISOString();

    return {
      ok: true,
      schedule,
      totalSlots,
      parsedBy: parsedBy || 'none',
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

async function handleCreateBooking(req, res) {
  requireWorkerAuth(req);
  const body = await readBody(req);
  const result = await mpQueueRun(mpJobMeta('create', body), () => createBookingWithBrowser(body));
  json(res, 200, result);
}

async function handleCancelBooking(req, res) {
  requireWorkerAuth(req);
  const body = await readBody(req);
  const result = await mpQueueRun(mpJobMeta('cancel', body), () => cancelBookingWithBrowser(body));
  json(res, 200, result);
}

async function handleEditBooking(req, res) {
  requireWorkerAuth(req);
  const body = await readBody(req);
  const result = await mpQueueRun(mpJobMeta('edit', body), () => editBookingWithBrowser(body));
  json(res, 200, result);
}

async function handleCreateClient(req, res) {
  requireWorkerAuth(req);
  const body = await readBody(req);
  const result = await mpQueueRun(mpJobMeta('client', body), () => createClientWithBrowser(body));
  json(res, 200, result);
}

// ── createClientWithBrowser: crea un cliente in Matchpoint, legge il Codice e
//    gli assegna un livello (default 0,5) cosi' compare nel report livelli. ──
async function createClientWithBrowser(options = {}) {
  const username = clean(options.username) || env('MATCHPOINT_USERNAME');
  const password = clean(options.password) || env('MATCHPOINT_PASSWORD');
  if (!username || !password) {
    throw fail('MATCHPOINT_WORKER_SECRETS_MISSING', 'Mancano credenziali Matchpoint nel worker.');
  }

  const client = options.client || {};
  const nome = clean(client.nome || client.firstName);
  const cognome = clean(client.cognome || client.surname);
  const telefono = clean(client.telefono || client.phone || '');
  const email = clean(client.email || '');
  const sessoRaw = clean(client.sesso || client.gender || '');
  if (!nome || !cognome) throw fail('INVALID_CLIENT_NAME', 'Nome e cognome del cliente sono obbligatori.');
  if (!email || !telefono || !sessoRaw) {
    throw fail('CLIENT_CREATE_MISSING_REQUIRED',
      'Campi obbligatori mancanti per la creazione cliente: servono sesso, email e telefono.',
      { nome, cognome, email, telefono, sesso: sessoRaw });
  }

  // Data nascita: usa quella fornita (ISO o gg/mm/aaaa); altrimenti default oggi -20 anni.
  let dataNascita = clean(client.dataNascita || client.birthDate || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataNascita)) dataNascita = isoToItalianDate(dataNascita);
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dataNascita)) {
    const [y, m, d] = todayIsoRome().split('-');
    dataNascita = `${d}/${m}/${String(Number(y) - 20)}`;
  }

  // Livello default 0,5 (segnaposto: il livello vero resta nell'app). Formato italiano con virgola.
  const livelloNum = (client.livello === undefined || client.livello === null || client.livello === '')
    ? 0.5 : Number(client.livello);
  const livelloStr = String(Number.isFinite(livelloNum) ? livelloNum : 0.5).replace('.', ',');

  // Sesso -> etichetta della select Matchpoint
  let sessoLabel = 'N.D.';
  if (/^f|donna|female|mujer/i.test(sessoRaw)) sessoLabel = 'Donna';
  else if (/^m|uomo|male|hombre/i.test(sessoRaw)) sessoLabel = 'Uomo';

  const baseUrl = clean(options.baseUrl) || env('MATCHPOINT_BASE_URL', DEFAULT_BASE_URL);
  const diagnostic = {
    mode: 'create_client',
    nome, cognome, telefono, email, sessoLabel, dataNascita, livello: livelloStr, baseUrl,
    startedAt: new Date().toISOString(),
    steps: [],
  };

  const browser = await chromium.launch({
    headless: boolEnv('MATCHPOINT_HEADLESS', true),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  let page;
  try {
    const context = await browser.newContext({
      acceptDownloads: false,
      locale: 'it-IT',
      timezoneId: 'Europe/Rome',
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
    });
    page = await context.newPage();
    // Matchpoint mette un confirm() sull'onclick di "Iscrizione cliente".
    // Lo neutralizziamo: ritorna sempre true, così il postback parte senza dialog.
    await page.addInitScript(() => {
      window.confirm = () => true;
    });
    page.setDefaultTimeout(12000);
    page.setDefaultNavigationTimeout(20000);

    // ── Login (stessa sequenza di createBookingWithBrowser) ──
    diagnostic.steps.push('login');
    await page.goto(absoluteUrl(baseUrl, '/Login.aspx'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('#username, input[name="username"]').first().fill(username, { timeout: 20000 });
    await page.locator('#password, input[name="password"]').first().fill(password, { timeout: 20000 });
    const language = page.locator('select[name="ddlLenguaje"]');
    if (await language.count().catch(() => 0)) {
      await language.first().selectOption('it-IT', { timeout: 5000 }).catch(() => {});
    }
    await Promise.all([
      page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {}),
      page.locator('#btnLogin, input[name="btnLogin"]').first().click({ timeout: 15000 }),
    ]);
    await page.waitForTimeout(2500);
    diagnostic.loginUrl = page.url();
    if (/Login\.aspx/i.test(page.url()) && await page.locator('input[type="password"]').count().catch(() => 0)) {
      throw fail('MATCHPOINT_BROWSER_LOGIN_FAILED', 'Login Matchpoint non riuscito.', diagnostic);
    }
    await maybeClickCashEnter(page, diagnostic);

    // ── Form creazione cliente ──
    diagnostic.steps.push('goto_alta_cliente');
    await page.goto(absoluteUrl(baseUrl, '/Clientes/FichaAltaCliente.aspx'), { waitUntil: 'domcontentloaded', timeout: 20000 });
    const P = '#CC_Datos_FormViewFicha_WUCDatosAltaCliente_';
    await page.locator(P + 'TextBoxNombre').first().fill(nome, { timeout: 15000 });
    await page.locator(P + 'TextBoxApellido1').first().fill(cognome, { timeout: 10000 });
    const fechaSel = '#CC_Datos_FormViewFicha_WUCDatosAltaCliente_TextBoxFecha_Nacimiento';
    const fld = page.locator(fechaSel);
    await fld.click();
    await fld.fill('');
    await fld.pressSequentially(dataNascita, { delay: 50 });
    await page.evaluate((id) => {
      const e = document.getElementById(id);
      if (!e) return;
      e.dispatchEvent(new Event('input',  { bubbles: true }));
      e.dispatchEvent(new Event('change', { bubbles: true }));
      e.dispatchEvent(new Event('blur',   { bubbles: true }));
    }, 'CC_Datos_FormViewFicha_WUCDatosAltaCliente_TextBoxFecha_Nacimiento');
    // click su un altro campo per chiudere l'eventuale datepicker e far validare la data
    await page.locator(P + 'TextBoxApellido1').first().click({ timeout: 5000 }).catch(() => {});
    await page.locator(P + 'DropDownListSexo').first().selectOption({ label: sessoLabel }, { timeout: 5000 }).catch(() => {});
    await page.locator(P + 'TextBoxMovil').first().fill(telefono || '', { timeout: 10000 });
    await page.locator(P + 'TextBoxEmail').first().fill(email || '', { timeout: 10000 });
    // Deselezionare "Creare utente (accesso al sito)" per NON inviare email di sistema all'interessato.
    const accesso = page.locator(P + 'CheckBoxDar_Acceso_Extranet').first();
    if (await accesso.isChecked().catch(() => false)) {
      await accesso.uncheck({ timeout: 5000 }).catch(async () => {
        await accesso.click({ timeout: 5000 }).catch(() => {});
      });
    }

    diagnostic.steps.push('salva_cliente');
    // Ribadisce la soppressione del confirm() sulla pagina corrente prima del click.
    await page.evaluate(() => { window.confirm = () => true; }).catch(() => {});
    // Lasciato come rete di sicurezza per eventuali alert() post-salvataggio.
    page.once('dialog', async (dialog) => {
      diagnostic.dialogMessage = dialog.message();
      diagnostic.dialogType = dialog.type();
      await dialog.accept().catch(() => {});
    });
    await Promise.all([
      page.waitForLoadState('domcontentloaded', { timeout: 25000 }).catch(() => {}),
      page.evaluate(() => {
        const btn = document.getElementById('CC_Datos_FormViewFicha_ButtonActualizar');
        if (btn && typeof btn.click === 'function') { btn.click(); return; }
        // fallback: postback diretto ASP.NET
        if (typeof window.__doPostBack === 'function') {
          window.__doPostBack('ctl01$ctl00$CC$Datos$FormViewFicha$ButtonActualizar', '');
        }
      }),
    ]);
    // ── Attesa robusta post-salvataggio (Matchpoint può essere lento) ──
    // Polling: si RI-LEGGE la pagina a intervalli finché compaiono Codice + id
    // interno, oppure finché scade il budget. NON si ri-clicca mai "salva"
    // (rischio doppione): qui si legge soltanto.
    const POST_SAVE_BUDGET_MS = 75000; // budget totale d'attesa post-salvataggio
    const POST_SAVE_POLL_MS = 1500;    // intervallo fra un controllo e l'altro
    const postSaveDeadline = Date.now() + POST_SAVE_BUDGET_MS;

    const readValidationMessages = () => page.evaluate(() => {
      const sels = ['[id*="ValidationSummary"]', '.field-validation-error',
                    'span[style*="color:Red"]', 'span[style*="color:red"]', '[id*="Label"][style*="red" i]'];
      const out = [];
      for (const s of sels) {
        document.querySelectorAll(s).forEach((el) => {
          const t = (el.textContent || '').trim();
          if (t) out.push(t);
        });
      }
      return out.slice(0, 20);
    }).catch(() => []);

    let codice = '';
    let idInterno = '';
    let bodyText = '';
    let earlyValidation = null;

    while (Date.now() < postSaveDeadline) {
      bodyText = await page.evaluate(() => (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').trim()).catch(() => '');
      const codiceMatch = bodyText.match(/Scheda cliente\s*:\s*(\d{4,6})\s*-/i);
      codice = codiceMatch ? codiceMatch[1] : '';
      const idMatch = decodeURIComponent(page.url()).match(/[?&]id=\s*(\d+)/i);
      idInterno = idMatch ? idMatch[1] : '';
      idInterno = decodeURIComponent(String(idInterno || '')).replace(/\s+/g, '').trim();

      if (codice && idInterno) break; // successo: scheda cliente arrivata

      // Fail-fast: ancora sul form di inserimento + messaggi di validazione
      // = errore di dato, inutile aspettare l'intero budget.
      if (/FichaAltaCliente\.aspx/i.test(page.url())) {
        const vmsgs = await readValidationMessages();
        if (vmsgs && vmsgs.length) { earlyValidation = vmsgs; break; }
      }

      await page.waitForTimeout(POST_SAVE_POLL_MS);
    }

    diagnostic.afterSaveUrl = page.url();
    diagnostic.postbackFired = !/FichaAltaCliente\.aspx/i.test(page.url());
    diagnostic.codice = codice;
    diagnostic.idInterno = idInterno;

    // Errore di validazione rilevato presto → fallimento esplicito e immediato.
    if (earlyValidation && (!codice || !idInterno)) {
      diagnostic.validationMessages = earlyValidation;
      diagnostic.bodySample = bodyText.slice(0, 1000);
      try { diagnostic.formInputsDump = await dumpFormInputs(page); } catch {}
      throw fail('CLIENT_CREATE_VALIDATION', `Matchpoint ha rifiutato i dati del cliente. url=${page.url()}`, diagnostic);
    }

    // Budget esaurito senza Codice/id → comportamento storico (con diagnostica).
    if (!codice || !idInterno) {
      diagnostic.bodySample = bodyText.replace(/\s+/g, ' ').trim().slice(0, 1000);
      try { diagnostic.formInputsDump = await dumpFormInputs(page); } catch {}
      try { diagnostic.validationMessages = await readValidationMessages(); } catch {}
      throw fail('CLIENT_CREATE_NO_CODICE', `Cliente forse creato ma Codice/id non letti dopo ${Math.round(POST_SAVE_BUDGET_MS / 1000)}s. url=${page.url()}`, diagnostic);
    }

    // ── Assegna livello (per far comparire il cliente nel report livelli) ──
    let livelloAssegnato = false;
    try {
      diagnostic.steps.push('goto_livello');
      const livelloUrl = absoluteUrl(baseUrl,
        `/Clientes/FichaDeportePracticaClienteDatosNivel.aspx?id_people=${encodeURIComponent(idInterno)}`
        + `&cbf=callbackRefrescarPestanyaJuegoNivel`
        + `&return_url=${encodeURIComponent('/Clientes/FichaCliente.aspx?id=' + idInterno)}`);
      await page.goto(livelloUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      const L = '#CC_Datos_FormViewFicha_WUCDeportePraticaClienteEdicionNivel_';
      // Sport "Padel" e' gia' selezionato di default; impostiamo solo il livello numerico.
      await page.locator(L + 'TextBoxNivelNumerico').first().fill(livelloStr, { timeout: 10000 });
      diagnostic.steps.push('salva_livello');
      await Promise.all([
        page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => {}),
        page.locator('#CC_Datos_FormViewFicha_ButtonActualizar').first().click({ timeout: 15000 }),
      ]);
      await page.waitForTimeout(2000);
      livelloAssegnato = true;
    } catch (levelError) {
      diagnostic.levelError = (levelError && levelError.message) || String(levelError);
    }
    diagnostic.livelloAssegnato = livelloAssegnato;

    return {
      ok: true,
      codice,
      idInterno,
      nome,
      cognome,
      telefono,
      email,
      livello: livelloStr,
      livelloAssegnato,
      diagnostic,
    };
  } catch (error) {
    if (error && error.code && error.diagnostic) throw error;
    throw fail('CLIENT_CREATE_FAILED', (error && error.message) || String(error), diagnostic);
  } finally {
    await browser.close().catch(() => {});
  }
}

// ── Helper: attende il form di prenotazione in qualunque contesto ─────────────
// Cerca il titolo "Nuova lezione" o "Nuova partita" in tutti i frame/pagina.
async function waitForBookingForm(page, tipo, diagnostic, timeoutMs = 15000) {
  const title = tipo === 'lezione' ? 'Nuova lezione' : 'Nuova partita';
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const ctx of pageContentContexts(page)) {
      const body = await readContextBody(ctx.target, 2000);
      if (body.includes(title)) {
        diagnostic.formFoundAt = ctx.kind;
        diagnostic.formTitle = title;
        return ctx.target;
      }
    }
    await page.waitForTimeout(500);
  }
  return null;
}

// ── Helper: seleziona istruttore nel dropdown "Monitor" del form Lezione ──────
// FIX: aggancio DIRETTO al select corretto (DropDownListMonitor) per id, invece
// della ricerca per label, che agganciava per errore il select "Lezione"
// (DropDownListTipoActividad). Il Monitor fa AutoPostBack → si usa selectOption
// di Playwright e si attende il ricaricamento del pannello.
async function selectIstruttore(formCtx, page, istruttore, diagnostic) {
  if (!istruttore) return;

  // 1. Individua il select dei maestri per id (con fallback robusto)
  let sel = formCtx.locator('#CC_Datos_FormViewFicha_WUCCabeceraClaseSuelta_DropDownListMonitor');
  if (!(await sel.count().catch(() => 0))) {
    sel = formCtx.locator('select[id*="DropDownListMonitor" i]');
  }
  if (!(await sel.count().catch(() => 0))) {
    diagnostic.istruttoreResult = { found: false };
    diagnostic.steps.push('istruttore_select_not_found');
    return;
  }

  // 2. Trova l'opzione il cui testo contiene il nome del maestro (esclude la vuota)
  const opts = await sel.first().evaluate((el) =>
    [...el.options].map((o) => ({ value: o.value, text: (o.text || '').trim() })),
  ).catch(() => []);
  const target = opts.find((o) =>
    o.text && o.value && o.value !== '0' &&
    o.text.toLowerCase().includes(istruttore.toLowerCase()),
  );

  if (!target) {
    diagnostic.istruttoreResult = { found: true, matched: false, opts: opts.map((o) => o.text) };
    diagnostic.istruttoreOpts = opts.map((o) => o.text);
    diagnostic.steps.push(`istruttore_not_matched:${istruttore}`);
    return;
  }

  // 3. Seleziona (eventi corretti via Playwright) e attendi l'AutoPostBack
  await sel.first().selectOption(target.value, { timeout: 6000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);

  diagnostic.istruttoreResult = { found: true, matched: true, value: target.value, text: target.text };
  diagnostic.steps.push(`istruttore_selected:${target.text}`);
}

// ── Helper: cerca giocatore in autocomplete e lo aggiunge all'elenco ──────────
// ⚠️ INDURIMENTO: verifica HiddenFieldIdPeople dopo selezione <li>, ritenta fino a
// 3 volte se vuoto, poi fallisce esplicitamente. Verifica anche la riga post-aggiunta.
async function searchAndAddPlayer(formCtx, page, nome, diagnostic, pfx = '#CC_Datos_FormViewFicha_WUCUsuarioPartida_Anyadir_', expectedCode = '') {
  const PFX = pfx;
  const norm = (s) => String(s || '').toLowerCase().trim();
  const onlyDigits = (s) => String(s || '').replace(/\D/g, '').replace(/^0+/, '');
  if (!nome || !nome.trim()) { diagnostic.steps.push('player_skip_no_name'); return { nome, added: false, reason: 'no_name' }; }

  const inputEl = formCtx.locator(PFX + 'TextBoxTitular');
  if (!(await inputEl.count().catch(() => 0))) { diagnostic.steps.push('player_input_not_found'); return { nome, added: false, reason: 'input_not_found' }; }

  const addLink = formCtx.locator(PFX + 'LinkButtonAnyadir');
  if (!(await addLink.count().catch(() => 0))) { diagnostic.steps.push('player_add_link_not_found'); return { nome, added: false, reason: 'add_link_missing' }; }

  const hiddenId = formCtx.locator(PFX + 'HiddenFieldIdPeople');
  const ul = formCtx.locator(PFX + 'AutoCompleteTitular_completionListElem');
  const li = ul.locator('li');

  let lockedId = '';
  let codeCheckFailed = false;
  outer: for (let attempt = 0; attempt < 3; attempt++) {
    // Pulisce campo e digita nome con keystroke reali
    await inputEl.first().click({ timeout: 5000 }).catch(() => {});
    await page.keyboard.press('Control+A').catch(() => {});
    await page.keyboard.press('Delete').catch(() => {});
    await inputEl.first().type(nome, { delay: 80 });

    // Attende autocomplete
    let appeared = false;
    for (let i = 0; i < 24; i++) {
      const n = await li.count().catch(() => 0);
      if (n > 0 && await ul.isVisible().catch(() => false)) { appeared = true; break; }
      await page.waitForTimeout(250);
    }
    if (!appeared) { diagnostic.steps.push(`player_option_not_found:${nome}:attempt${attempt}`); continue; }

    // ⚠️ Sceglie SOLO un <li> che CONTIENE davvero il nome richiesto.
    // Con expectedCode, itera TUTTI i candidati per nome e scarta quelli il cui
    // HiddenFieldIdPeople non coincide col codice atteso (evita omonimi).
    // NIENTE fallback al primo elemento: con un input spurio (es. "ok") nessun <li>
    // combacia → non selezioniamo nulla → l'id non si aggancia → si aborta senza
    // scrivere su Matchpoint. (È così che era finito il cliente 921.)
    const count = await li.count().catch(() => 0);
    let foundNameMatch = false;
    for (let i = 0; i < count; i++) {
      const t = norm(await li.nth(i).innerText().catch(() => ''));
      if (!t.includes(norm(nome))) continue;
      foundNameMatch = true;
      await li.nth(i).click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(400);
      const candidateId = (await hiddenId.first().inputValue().catch(() => '')).trim();
      diagnostic.steps.push(`player_id_check:${nome}:attempt${attempt}:i=${i}:id=${candidateId}`);
      if (!candidateId) break; // id non agganciato: riprova col prossimo attempt
      if (expectedCode && onlyDigits(candidateId) !== onlyDigits(expectedCode)) {
        // Codice non combacia: pulisce il campo, ri-digita il nome e prova il prossimo candidato
        codeCheckFailed = true;
        await inputEl.first().click({ timeout: 5000 }).catch(() => {});
        await page.keyboard.press('Control+A').catch(() => {});
        await page.keyboard.press('Delete').catch(() => {});
        await inputEl.first().type(nome, { delay: 80 });
        for (let j = 0; j < 24; j++) {
          const n2 = await li.count().catch(() => 0);
          if (n2 > 0 && await ul.isVisible().catch(() => false)) break;
          await page.waitForTimeout(250);
        }
        continue;
      }
      // Candidato valido (codice combacia o nessun codice richiesto)
      lockedId = candidateId;
      codeCheckFailed = false;
      break outer;
    }
    if (!foundNameMatch) diagnostic.steps.push(`player_no_matching_option:${nome}:attempt${attempt}`);
  }

  if (!lockedId) {
    if (expectedCode && codeCheckFailed) {
      throw fail('PLAYER_CODE_MISMATCH',
        `Nessun socio Matchpoint con codice ${expectedCode} tra i risultati per "${nome}". Aggiunta annullata per sicurezza.`,
        diagnostic);
    }
    throw fail('PLAYER_ID_NOT_LOCKED',
      `Autocomplete non agganciato (HiddenFieldIdPeople vuoto) per: ${nome}`,
      diagnostic);
  }

  // ⚠️ SICUREZZA PRIMA DI SCRIVERE: "+ Aggiungere" persiste SUBITO su Matchpoint,
  // quindi il nome selezionato va verificato ADESSO, non dopo. Se la selezione non
  // combacia col richiesto, NON aggiungere (aborta).
  const selName = norm(await inputEl.first().inputValue().catch(() => ''));
  diagnostic.steps.push(`player_name_precheck:req=${norm(nome)}:sel=${selName.slice(0, 40)}`);
  if (selName && !selName.includes(norm(nome)) && !norm(nome).includes(selName)) {
    throw fail('PLAYER_NAME_MISMATCH',
      `Selezione autocomplete diversa dal richiesto "${nome}" (selezionato: "${selName}"). Aggiunta annullata per sicurezza.`,
      diagnostic);
  }

  // Clicca "Aggiungere" solo con id valido E nome combaciante
  await addLink.first().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(1200);

  // Verifica post-aggiunta: scansiona TUTTE le righe partecipanti, qualunque sia il
  // tipo di form. La partita usa il repeater "WUCUsuarioPartida", la lezione
  // "WUCUsuarioClase": il vecchio selettore fisso su WUCUsuarioPartida falliva sulle
  // lezioni (allievo in realtà aggiunto, ma cercato nel repeater sbagliato → falso
  // PLAYER_ADD_NOT_CONFIRMED). Ora si cerca per nome tra TUTTI gli input
  // "TextBoxNombreValor" e si ricava l'id cliente sostituendo, nello stesso id,
  // "TextBoxNombreValor" → "HiddenFieldIdCliente".
  let addedIdCliente = null;
  const righeViste = [];
  const nomeInputs = page.locator('input[id*="TextBoxNombreValor"]');
  const righeTot = await nomeInputs.count().catch(() => 0);
  for (let r = 0; r < righeTot; r++) {
    const rowId = (await nomeInputs.nth(r).getAttribute('id').catch(() => '')) || '';
    const nomeVal = (await nomeInputs.nth(r).inputValue().catch(() => '')).toLowerCase().trim();
    righeViste.push(`${rowId}=${nomeVal}`);
    if (nomeVal && (nomeVal.includes(norm(nome)) || norm(nome).includes(nomeVal))) {
      if (rowId) {
        const idCliId = rowId.replace(/TextBoxNombreValor/g, 'HiddenFieldIdCliente');
        addedIdCliente = (await page.locator(`input[id="${idCliId}"]`).first().inputValue().catch(() => '')).trim();
      }
      if (addedIdCliente === null) addedIdCliente = ''; // riga trovata; id non determinabile, ma aggiunta confermata
      break;
    }
  }
  diagnostic.partecipantiRighe = righeViste.slice(0, 30);

  if (addedIdCliente === null) {
    throw fail('PLAYER_ADD_NOT_CONFIRMED',
      `Giocatore ${nome} non trovato nelle righe partecipanti dopo l'aggiunta.`,
      diagnostic);
  }

  diagnostic.steps.push('player_added:' + nome);
  return { nome, added: true, idCliente: addedIdCliente };
}

// ── Helper: clicca il bottone di salvataggio ──────────────────────────────────
async function clickFormSave(formCtx, page, labels, diagnostic) {
  const selectors = [
    '#CC_Datos_FormViewFicha_ButtonInsertarYSalir',
    '#CC_Datos_FormViewFicha_ButtonInsertar',
    ...labels.map((l) => `button:has-text("${l}")`),
    ...labels.map((l) => `a:has-text("${l}")`),
    'input[type="submit"]',
    'button[type="submit"]',
  ];
  for (const sel of selectors) {
    const btn = formCtx.locator(sel).first();
    if (!await btn.isVisible({ timeout: 2000 }).catch(() => false)) continue;
    try {
      await Promise.all([
        page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {}),
        btn.click({ timeout: 10000 }),
      ]);
      diagnostic.submitSelector = sel;
      diagnostic.steps.push('form_saved');
      return true;
    } catch (e) {
      diagnostic.navigationAttempts.push({ action: 'save_attempt', sel, error: e.message.slice(0, 80) });
    }
  }
  const inputs = await dumpFormInputs(formCtx).catch(() => []);
  diagnostic.steps.push('save_button_not_found');
  throw fail('SAVE_BUTTON_NOT_FOUND',
    `Bottone salvataggio non trovato (labels=${JSON.stringify(labels)}). inputs=${JSON.stringify(inputs).slice(0, 400)}`,
    { ...diagnostic, formInputsDump: inputs });
}

// ── Helper: calcola ora fine da ora inizio + durata minuti ───────────────────
function computeEndTime(startHHMM, durationMinutes) {
  const [h, m] = startHHMM.split(':').map(Number);
  const total = h * 60 + m + (durationMinutes || 90);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// ── Helper: discovery — dumpa tutti gli input del form per calibrazione ───────
async function dumpFormInputs(formCtx) {
  return formCtx.evaluate(() => {
    const compact = (v) => String(v || '').replace(/\s+/g, ' ').trim();
    return [...document.querySelectorAll('input, select, button, textarea')].map((el) => {
      const labelFor = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
      const closestLabel = el.closest('td, tr, div')?.querySelector('label, th, td:first-child, span');
      return {
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || '',
        id: el.id || '',
        name: el.name || '',
        placeholder: el.placeholder || '',
        value: String(el.value || '').slice(0, 40),
        checked: el.type === 'checkbox' ? el.checked : undefined,
        labelText: compact((labelFor?.innerText || closestLabel?.innerText || '')).slice(0, 60),
        nearbyText: compact(el.parentElement?.innerText || '').slice(0, 80),
      };
    });
  }).catch(() => []);
}

// ── Helper: spunta la checkbox "Privato" nel form partita ─────────────────────
async function checkPrivatoCheckbox(formCtx, diagnostic) {
  const cb = formCtx.locator('#CC_Datos_FormViewFicha_WUCCabeceraReserva_CheckBoxPrivada');
  if (await cb.count().catch(() => 0)) {
    await cb.first().check({ timeout: 6000 }).catch(async () => {
      // fallback: alcuni temi nascondono l'input; cliccare la label associata
      await formCtx.locator('label[for="CC_Datos_FormViewFicha_WUCCabeceraReserva_CheckBoxPrivada"]').first().click({ timeout: 4000 }).catch(() => {});
    });
    diagnostic.steps.push('privato_checked:CheckBoxPrivada');
    return { found: true };
  }
  diagnostic.steps.push('privato_checkbox_not_found');
  return { found: false };
}

// ── Helper: imposta un campo ora con maschera HH:MM (scrivendo solo cifre HHMM) ─
// I campi ora nel sotto-dialogo "Personalizzare" di Matchpoint usano una maschera:
// vanno scritti come pure cifre (es. "0900") e la maschera inserisce i due punti.
async function setMaskedTime(page, formCtx, labelText, digits) {
  // Strategia 1: locator near testo etichetta
  let field = null;
  try {
    const loc = formCtx.locator('input').filter({
      near: formCtx.getByText(labelText, { exact: false }),
    }).first();
    if (await loc.isVisible({ timeout: 2000 }).catch(() => false)) field = loc;
  } catch { /* prossima strategia */ }

  // Strategia 2: evaluate → cerca input vicino alla label testuale
  if (!field) {
    const elInfo = await formCtx.evaluate((label) => {
      const compact = (v) => String(v || '').replace(/\s+/g, ' ').trim();
      for (const lbl of document.querySelectorAll('label, span, td, th')) {
        const lblText = compact(lbl.innerText || '');
        if (!label.toLowerCase().split(' ').every((w) => lblText.toLowerCase().includes(w))) continue;
        const inp = lbl.control
          || lbl.nextElementSibling?.querySelector?.('input')
          || lbl.closest('td, tr')?.nextElementSibling?.querySelector('input')
          || lbl.parentElement?.querySelector('input');
        if (inp) return { id: inp.id || '', name: inp.name || '' };
      }
      return null;
    }, labelText).catch(() => null);
    if (elInfo?.id) field = formCtx.locator(`#${CSS.escape(elInfo.id)}`).first();
    else if (elInfo?.name) field = formCtx.locator(`input[name="${elInfo.name}"]`).first();
  }

  if (!field) return false;
  try {
    await field.click({ timeout: 5000 });
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await field.type(digits, { delay: 40 });
    return true;
  } catch { return false; }
}

// ── Helper: apre form Ficha Partita via URL diretto ────────────────────────────
// Verifica che il form "Nuova partita" sia effettivamente apparso (fuori fancybox).
// Restituisce il contesto del form o null se la pagina non ha reso il form.
async function openFichaPartita(page, baseUrl, idrecurso, fecha, oraInizio, oraFine2, diagnostic) {
  const fichaUrl = `${baseUrl}/Reservas/FichaPartidaPagoPorUsuario.aspx`
    + `?modo=fancy&id_recurso=${encodeURIComponent(idrecurso)}`
    + `&fecha=${encodeURIComponent(fecha)}`
    + `&hora_inicio=${encodeURIComponent(oraInizio)}`
    + `&hora_fin=${encodeURIComponent(oraFine2)}`;
  diagnostic.fichaUrl = fichaUrl;
  diagnostic.steps.push('ficha_goto');
  try {
    await page.goto(fichaUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1000);
  } catch (err) {
    diagnostic.fichaGotoError = err.message.slice(0, 120);
    return null;
  }
  // Cerca "Nuova partita" su pagina principale e frame
  const formCtx = await waitForBookingForm(page, 'partita', diagnostic, 8000);
  if (formCtx) {
    diagnostic.steps.push('ficha_form_found');
    return formCtx;
  }
  // Form non comparso — raccoglie diagnostica ricca e fallisce subito
  const url = page.url();
  const bodySample = await page.evaluate(
    () => (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').trim().slice(0, 300),
  ).catch(() => '');
  let inputs = [];
  try { inputs = await dumpFormInputs(page); } catch {}
  diagnostic.afterGotoUrl = url;
  diagnostic.bodySample = bodySample;
  diagnostic.formInputsDump = inputs;
  diagnostic.steps.push('ficha_form_not_visible');
  throw fail('FICHA_FORM_NOT_VISIBLE',
    `Form non visibile dopo goto Ficha. afterUrl=${url} | body="${bodySample}" | inputs=${JSON.stringify(inputs).slice(0, 500)}`,
    diagnostic);
}

// ── Helper: fallback clic reale mouse sulla cella tabellone ───────────────────
// Usato quando l'URL Ficha non rende il form standalone.
// Naviga di nuovo al tabellone, imposta la data, esegue un clic "vero" sulla cella
// (con eventi mouse nativi a coordinate, non element.click()) per far apparire
// il menu tipologia, poi sceglie la voce indicata e attende il form.
async function openFormViaCellClick(page, tabCtx, cellSel, data, tipoLabel, tipo, baseUrl, diagnostic) {
  diagnostic.steps.push('fallback_cell_click');
  // Ricarica tabellone se non siamo più lì (potremmo essere sulla Ficha URL)
  let ctx = tabCtx;
  const isTab = await isTabelloneVisible(ctx).catch(() => false);
  if (!isTab) {
    diagnostic.steps.push('fallback_reload_tabellone');
    ctx = await navigaFinoAlTabellone(page, diagnostic, baseUrl);
    await impostaDataTabellone(ctx, page, data, diagnostic);
  }

  // Clic vero con eventi mouse a coordinate (non element.click())
  const bbox = await ctx.locator(cellSel).first().boundingBox().catch(() => null);
  if (!bbox) {
    diagnostic.steps.push('fallback_cell_bbox_missing');
    return null;
  }
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(900);

  // Seleziona tipo dal menu contestuale
  const menuClicked = await clickMenuEntryEverywhere(page, tipoLabel, `fallback_context_menu_${tipo}`, diagnostic);
  if (!menuClicked) {
    diagnostic.steps.push('fallback_menu_not_found');
    return null;
  }
  await page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1000);

  // Attendi form
  const formCtx = await waitForBookingForm(page, tipo, diagnostic, 18000);
  if (formCtx) diagnostic.steps.push('fallback_form_found');
  else diagnostic.steps.push('fallback_form_not_found');
  return formCtx;
}

// ── Helper: verifica prenotazione creata tornando al tabellone ────────────────
async function verifyBookingCreated(page, tabCtx, cellSel, data, baseUrl, diagnostic) {
  diagnostic.steps.push('verify_booking');
  try {
    let ctx = tabCtx;
    const isTab = await isTabelloneVisible(ctx).catch(() => false);
    if (!isTab) {
      ctx = await navigaFinoAlTabellone(page, diagnostic, baseUrl);
      await impostaDataTabellone(ctx, page, data, diagnostic);
    }
    const bloccatoAfter = await ctx.locator(cellSel).first().getAttribute('bloqueado').catch(() => null);
    diagnostic.verifyBloccato = bloccatoAfter;
    if (bloccatoAfter === 'true') {
      diagnostic.verified = true;
    } else {
      diagnostic.verified = false;
      diagnostic.verifyNote = 'Cella non risulta bloccata dopo il salvataggio';
    }
  } catch (err) {
    diagnostic.verifyError = err.message.slice(0, 120);
  }
}

// createBookingWithBrowser: naviga al tabellone Matchpoint, imposta la data, trova la cella
// libera per il campo e l'ora target.
// Per tipo=partita: apre il form Ficha via URL diretto (più affidabile del clic-cella);
// fallback al clic mouse reale se il form non appare.
// Per altri tipi: clic mouse reale sulla cella + menu contestuale.
async function createBookingWithBrowser(options = {}) {
  const username = clean(options.username) || env('MATCHPOINT_USERNAME');
  const password = clean(options.password) || env('MATCHPOINT_PASSWORD');
  if (!username || !password) {
    throw fail('MATCHPOINT_WORKER_SECRETS_MISSING', 'Mancano credenziali Matchpoint nel worker.');
  }

  const booking = options.booking || {};
  const campo = parseInt(booking.campo || 0);
  const data = clean(booking.data);
  const ora = clean(booking.ora);
  const oraFine = clean(booking.oraFine || '');
  const nome = clean(booking.nome);
  const durata = parseInt(booking.durata || 90);
  const tipo = clean(booking.tipo || 'partita').toLowerCase(); // 'partita' | 'lezione' | 'manutenzione'
  const istruttore = clean(booking.istruttore || '');

  if (!campo || campo < 1 || campo > 4) throw fail('INVALID_CAMPO', 'Campo deve essere 1-4.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw fail('INVALID_DATA', 'Data deve essere YYYY-MM-DD.');
  if (!/^\d{2}:\d{2}$/.test(ora)) throw fail('INVALID_ORA', 'Ora deve essere HH:MM.');
  if (!nome) throw fail('INVALID_NOME', 'Nome giocatore/istruttore/lezione richiesto.');
  if (!['partita', 'lezione', 'manutenzione', 'stagionale'].includes(tipo)) {
    throw fail('INVALID_TIPO', 'tipo deve essere partita | lezione | manutenzione | stagionale.');
  }

  // Label italiana nel menu contestuale Matchpoint
  const TIPO_LABEL = { partita: 'Partita', lezione: 'Lezione', manutenzione: 'Manutenzione', stagionale: 'Prenotazione stagionale' };
  const tipoLabel = TIPO_LABEL[tipo];

  const baseUrl = clean(options.baseUrl) || env('MATCHPOINT_BASE_URL', DEFAULT_BASE_URL);
  const diagnostic = {
    mode: 'create_booking',
    campo, data, ora, oraFine, nome, durata, tipo, istruttore, baseUrl,
    startedAt: new Date().toISOString(),
    steps: [],
    navigationAttempts: [],
  };

  const browser = await chromium.launch({
    headless: boolEnv('MATCHPOINT_HEADLESS', true),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  let page;
  try {
    const context = await browser.newContext({
      acceptDownloads: false,
      locale: 'it-IT',
      timezoneId: 'Europe/Rome',
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
    });
    page = await context.newPage();
    page.setDefaultTimeout(12000);
    page.setDefaultNavigationTimeout(20000);

    // ── Login ─────────────────────────────────────────────────────────────────
    diagnostic.steps.push('login');
    await page.goto(absoluteUrl(baseUrl, '/Login.aspx'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('#username, input[name="username"]').first().fill(username, { timeout: 20000 });
    await page.locator('#password, input[name="password"]').first().fill(password, { timeout: 20000 });
    const language = page.locator('select[name="ddlLenguaje"]');
    if (await language.count().catch(() => 0)) {
      await language.first().selectOption('it-IT', { timeout: 5000 }).catch(() => {});
    }
    await Promise.all([
      page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {}),
      page.locator('#btnLogin, input[name="btnLogin"]').first().click({ timeout: 15000 }),
    ]);
    await page.waitForTimeout(1000);
    diagnostic.loginUrl = page.url();
    if (/Login\.aspx/i.test(page.url()) && await page.locator('input[type="password"]').count().catch(() => 0)) {
      throw fail('MATCHPOINT_BROWSER_LOGIN_FAILED', 'Login Matchpoint non riuscito.', diagnostic);
    }

    await maybeClickCashEnter(page, diagnostic);
    diagnostic.afterCashUrl = page.url();

    // ── Ora fine: usata da entrambi i percorsi ────────────────────────────────
    const oraFineCalc = oraFine || computeEndTime(ora, durata);
    diagnostic.oraFineCalc = oraFineCalc;

    if (tipo === 'partita') {
      // ── Percorso diretto Ficha (salta tabellone e lettura cella) ─────────────
      const recurso = RECURSO_BY_CAMPO[Number(campo)];
      if (!recurso) throw fail('CAMPO_NON_VALIDO', `Campo ${campo} senza id_recurso noto.`, diagnostic);

      const [yyyy, mm, dd] = data.split('-');
      const fecha = `${dd}/${mm}/${yyyy}`;
      const fichaUrl = `${baseUrl}/Reservas/FichaPartidaPagoPorUsuario.aspx`
        + `?modo=fancy&id_recurso=${recurso}`
        + `&fecha=${encodeURIComponent(fecha)}`
        + `&hora_inicio=${encodeURIComponent(ora)}`
        + `&hora_fin=${encodeURIComponent(oraFineCalc)}`;

      diagnostic.steps.push('goto_ficha');
      diagnostic.fichaUrl = fichaUrl;
      await page.goto(fichaUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

      diagnostic.steps.push('wait_form');
      const formOk = await page.getByText('Nuova partita', { exact: false })
        .first().isVisible({ timeout: 8000 }).catch(() => false);
      if (!formOk) {
        const afterUrl = page.url();
        const bodySample = await page.evaluate(() =>
          (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').trim().slice(0, 300),
        ).catch(() => '');
        let inputs = [];
        try { inputs = await dumpFormInputs(page); } catch {}
        diagnostic.afterGotoUrl = afterUrl;
        diagnostic.bodySample = bodySample;
        diagnostic.formInputsDump = inputs;
        throw fail('FICHA_FORM_NOT_VISIBLE',
          `Form non visibile. afterUrl=${afterUrl} body="${bodySample}" inputs=${JSON.stringify(inputs).slice(0, 400)}`,
          diagnostic);
      }

      // Il form è sulla pagina principale (non in un iframe): usare `page`
      const formCtx = page;
      diagnostic.formInputsDump = await dumpFormInputs(formCtx);
      diagnostic.steps.push(`fill_form_${tipo}`);

      // 1. Spunta "Privato" (obbligatorio)
      await checkPrivatoCheckbox(formCtx, diagnostic);

      // 2. Aggiungi giocatori via autocomplete
      const players = (Array.isArray(booking.giocatori) && booking.giocatori.length)
        ? booking.giocatori.map((g) => typeof g === 'string'
            ? { nome: g, codice: '' }
            : { nome: (g && (g.nome || g.name)) || '', codice: (g && (g.codice || g.memberId || g.id)) || '' }
          ).filter((p) => p.nome)
        : (nome ? [{ nome, codice: booking.codice || '' }] : []);
      diagnostic.playersRequested = players.map((p) => ({ nome: p.nome, codice: p.codice }));
      const playersResult = [];
      for (const p of players) {
        playersResult.push(await searchAndAddPlayer(formCtx, page, p.nome, diagnostic, undefined, p.codice));
      }
      diagnostic.playersResult = playersResult;

      // 3. Salva
      const saved = await clickFormSave(formCtx, page, ['Salvare e chiudere', 'Salvare'], diagnostic);
      if (!saved) {
        let inputs2 = [];
        try { inputs2 = await dumpFormInputs(formCtx); } catch {}
        diagnostic.formInputsDump = inputs2;
        throw fail('SAVE_BUTTON_NOT_FOUND', 'Bottone di salvataggio non trovato nel form Partita.', diagnostic);
      }

      // 4. Breve attesa — NON ricaricare il tabellone pesante
      await page.waitForTimeout(800);
      diagnostic.postSubmitUrl = page.url();
      diagnostic.steps.push('done');
      return {
        ok: true,
        campo, data, ora, oraFine: oraFineCalc, nome, durata, tipo, istruttore,
        diagnostic,
      };
    }

    if (tipo === 'lezione') {
      // ── Percorso diretto Ficha lezione (salta il tabellone) ──────────────────
      const recurso = RECURSO_BY_CAMPO[Number(campo)];
      if (!recurso) throw fail('CAMPO_NON_VALIDO', `Campo ${campo} senza id_recurso noto.`, diagnostic);

      const [yyyy, mm, dd] = data.split('-');
      const fecha = `${dd}/${mm}/${yyyy}`;
      const fichaUrl = `${baseUrl}/ClasesYCursos/FichaClaseSueltaPorUsuario.aspx`
        + `?modo=fancy&id_recurso=${recurso}`
        + `&fecha=${encodeURIComponent(fecha)}`
        + `&hora_inicio=${encodeURIComponent(ora)}`
        + `&hora_fin=${encodeURIComponent(oraFineCalc)}`;

      diagnostic.steps.push('goto_ficha_lezione');
      diagnostic.fichaUrl = fichaUrl;
      await page.goto(fichaUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

      diagnostic.steps.push('wait_form');
      const formOk = await page.getByText('Nuova lezione', { exact: false })
        .first().isVisible({ timeout: 8000 }).catch(() => false);
      if (!formOk) {
        const afterUrl = page.url();
        const bodySample = await page.evaluate(() =>
          (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').trim().slice(0, 300),
        ).catch(() => '');
        let inputs = [];
        try { inputs = await dumpFormInputs(page); } catch {}
        diagnostic.afterGotoUrl = afterUrl;
        diagnostic.bodySample = bodySample;
        diagnostic.formInputsDump = inputs;
        throw fail('FICHA_LEZIONE_FORM_NOT_VISIBLE',
          `Form lezione non visibile. afterUrl=${afterUrl} body="${bodySample}" inputs=${JSON.stringify(inputs).slice(0, 400)}`,
          diagnostic);
      }

      const formCtx = page; // il form è sulla pagina principale, non in un iframe
      diagnostic.formInputsDump = await dumpFormInputs(formCtx);
      diagnostic.steps.push('fill_form_lezione');

      // 1. Aggiungi gli ALLIEVI per primi, su form "pulito" (autocomplete affidabile).
      //    NB: l'istruttore va selezionato DOPO: il suo AutoPostBack ricarica il
      //    pannello e impedirebbe all'autocomplete dell'allievo di agganciarsi.
      const LEZIONE_PLAYER_PFX = '#CC_Datos_FormViewFicha_WUCUsuarioClase_Anyadir_';
      const players = (Array.isArray(booking.giocatori) && booking.giocatori.length)
        ? booking.giocatori.map((g) => typeof g === 'string'
            ? { nome: g, codice: '' }
            : { nome: (g && (g.nome || g.name)) || '', codice: (g && (g.codice || g.memberId || g.id)) || '' }
          ).filter((p) => p.nome)
        : (nome ? [{ nome, codice: booking.codice || '' }] : []);
      diagnostic.playersRequested = players.map((p) => ({ nome: p.nome, codice: p.codice }));
      const playersResult = [];
      for (const p of players) {
        playersResult.push(await searchAndAddPlayer(formCtx, page, p.nome, diagnostic, LEZIONE_PLAYER_PFX, p.codice));
      }
      diagnostic.playersResult = playersResult;

      // 2. Seleziona l'ISTRUTTORE per ultimo (il suo AutoPostBack resta dopo
      //    l'inserimento allievi). selectIstruttore attende già il networkidle.
      await selectIstruttore(formCtx, page, istruttore, diagnostic);

      // 3. NIENTE "Privato" nelle lezioni → non chiamare checkPrivatoCheckbox

      // 4. Salva
      const saved = await clickFormSave(formCtx, page, ['Salvare e uscire', 'Salvare'], diagnostic);
      if (!saved) {
        let inputs2 = [];
        try { inputs2 = await dumpFormInputs(formCtx); } catch {}
        diagnostic.formInputsDump = inputs2;
        throw fail('SAVE_BUTTON_NOT_FOUND', 'Bottone di salvataggio non trovato nel form Lezione.', diagnostic);
      }

      await page.waitForTimeout(2000);
      diagnostic.postSubmitUrl = page.url();
      diagnostic.steps.push('done');
      return {
        ok: true,
        campo, data, ora, oraFine: oraFineCalc, nome, durata, tipo, istruttore,
        diagnostic,
      };
    }

    if (tipo === 'manutenzione') {
      // ── Percorso diretto Ficha manutenzione (salta il tabellone) ─────────────
      const recurso = RECURSO_BY_CAMPO[Number(campo)];
      if (!recurso) throw fail('CAMPO_NON_VALIDO', `Campo ${campo} senza id_recurso noto.`, diagnostic);

      const [yyyy, mm, dd] = data.split('-');
      const fecha = `${dd}/${mm}/${yyyy}`;
      const fichaUrl = `${baseUrl}/Reservas/FichaReservaMantenimiento.aspx`
        + `?modo=fancy&id_recurso=${recurso}`
        + `&fecha=${encodeURIComponent(fecha)}`
        + `&hora_inicio=${encodeURIComponent(ora)}`
        + `&hora_fin=${encodeURIComponent(oraFineCalc)}`;

      diagnostic.steps.push('goto_ficha_manutenzione');
      diagnostic.fichaUrl = fichaUrl;
      await page.goto(fichaUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

      // Form pronto = bottone "Salvare" (ButtonInsertar) o textarea descrizione visibili
      diagnostic.steps.push('wait_form');
      const descBox = page.locator('#CC_Datos_FormViewFicha_TextBox2');
      const saveBtn = page.locator('#CC_Datos_FormViewFicha_ButtonInsertar');
      const formOk = (await saveBtn.first().isVisible({ timeout: 8000 }).catch(() => false))
        || (await descBox.first().isVisible({ timeout: 2000 }).catch(() => false));
      if (!formOk) {
        const afterUrl = page.url();
        const bodySample = await page.evaluate(() =>
          (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').trim().slice(0, 300),
        ).catch(() => '');
        let inputs = [];
        try { inputs = await dumpFormInputs(page); } catch {}
        diagnostic.afterGotoUrl = afterUrl;
        diagnostic.bodySample = bodySample;
        diagnostic.formInputsDump = inputs;
        throw fail('FICHA_MANUTENZIONE_FORM_NOT_VISIBLE',
          `Form manutenzione non visibile. afterUrl=${afterUrl} body="${bodySample}" inputs=${JSON.stringify(inputs).slice(0, 400)}`,
          diagnostic);
      }

      const formCtx = page; // il form è sulla pagina principale, non in un iframe
      diagnostic.formInputsDump = await dumpFormInputs(formCtx);
      diagnostic.steps.push('fill_form_manutenzione');

      // Descrizione manutenzione (← nome) e Osservazioni (← note). Niente altro.
      if (nome) {
        await descBox.first().fill(nome, { timeout: 6000 }).catch(() => {});
        diagnostic.steps.push('manutenzione_descrizione_set');
      }
      const noteManut = clean(booking.note || '');
      if (noteManut) {
        await formCtx.locator('#CC_Datos_FormViewFicha_TextBoxObservaciones')
          .first().fill(noteManut, { timeout: 6000 }).catch(() => {});
        diagnostic.steps.push('manutenzione_osservazioni_set');
      }

      // Salva (questo form ha solo "Salvare" = ButtonInsertar)
      const saved = await clickFormSave(formCtx, page, ['Salvare'], diagnostic);
      if (!saved) {
        let inputs2 = [];
        try { inputs2 = await dumpFormInputs(formCtx); } catch {}
        diagnostic.formInputsDump = inputs2;
        throw fail('SAVE_BUTTON_NOT_FOUND', 'Bottone di salvataggio non trovato nel form Manutenzione.', diagnostic);
      }

      await page.waitForTimeout(2000);
      diagnostic.postSubmitUrl = page.url();
      diagnostic.steps.push('done');
      return {
        ok: true,
        campo, data, ora, oraFine: oraFineCalc, nome, durata, tipo, istruttore,
        diagnostic,
      };
    }

    // ── Percorso tabellone (lezione / manutenzione / stagionale) ─────────────
    diagnostic.steps.push('navigate_tabellone');
    const tabCtx = await navigaFinoAlTabellone(page, diagnostic, baseUrl);
    diagnostic.tabelloneUrl = page.url();

    diagnostic.steps.push('set_date');
    await impostaDataTabellone(tabCtx, page, data, diagnostic);

    // ── Seleziona e clicca la cella reale (div.division) per attributi ──────────
    diagnostic.steps.push('find_division_cell');
    const cellSel = `div.division[columna="${campo}"][time="${ora}"]`;
    diagnostic.cellSelector = cellSel;
    const cellCount = await tabCtx.locator(cellSel).count().catch(() => 0);
    diagnostic.cellCount = cellCount;

    if (cellCount === 0) {
      const avail = await tabCtx.evaluate((col) => {
        return [...document.querySelectorAll(`div.division[columna="${col}"]`)]
          .slice(0, 30)
          .map((d) => ({
            time: d.getAttribute('time'),
            end: d.getAttribute('timeend'),
            bloccato: d.getAttribute('bloqueado'),
            libero: d.getAttribute('horariolibre'),
          }));
      }, String(campo)).catch(() => []);
      diagnostic.availableDivisions = avail;
      throw fail('TABELLONE_CELL_NOT_FOUND',
        `Nessuna cella div.division per Campo ${campo} · ${ora}. DIAG=${JSON.stringify(avail).slice(0, 800)}`,
        diagnostic);
    }

    const cellMeta = await tabCtx.locator(cellSel).first().evaluate((el) => ({
      bloqueado: el.getAttribute('bloqueado'),
      idrecurso: el.getAttribute('idrecurso'),
      idcentro: el.getAttribute('idcentro'),
    })).catch(() => ({}));
    if (cellMeta.bloqueado === 'true') {
      throw fail('SLOT_NOT_FREE', `Lo slot Campo ${campo} · ${data} · ${ora} risulta bloccato/occupato.`, diagnostic);
    }
    diagnostic.cellIdRecurso = cellMeta.idrecurso;
    diagnostic.cellIdCentro = cellMeta.idcentro;

    // ── Ottieni il form via clic cella + menu contestuale ─────────────────────
    const formCtxNonPartita = await openFormViaCellClick(page, tabCtx, cellSel, data, tipoLabel, tipo, baseUrl, diagnostic);

    if (!formCtxNonPartita) {
      diagnostic.postAttemptUrl = page.url();
      diagnostic.postAttemptBodySample = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '').then((t) => t.slice(0, 600));
      throw fail('BOOKING_FORM_NOT_FOUND',
        `Il form di prenotazione non è apparso (tipo=${tipo}). ` +
        'Verificare che la cella sia libera e che il menu contestuale sia accessibile.',
        diagnostic);
    }

    diagnostic.formInputsDump = await dumpFormInputs(formCtxNonPartita);
    diagnostic.steps.push(`fill_form_${tipo}`);

    if (tipo === 'lezione') {
      await selectIstruttore(formCtxNonPartita, page, nome || istruttore, diagnostic);
      const saved = await clickFormSave(formCtxNonPartita, page, ['Salvare e uscire', 'Salvare e chiudere', 'Salva'], diagnostic);
      if (!saved) throw fail('BOOKING_FORM_SUBMIT_FAILED', 'Bottone di salvataggio non trovato nel form Lezione.', diagnostic);
    } else {
      // manutenzione / stagionale
      const saved = await clickFormSave(formCtxNonPartita, page, ['Salvare e chiudere', 'Salvare e uscire', 'Salva'], diagnostic);
      if (!saved) throw fail('BOOKING_FORM_SUBMIT_FAILED', `Bottone di salvataggio non trovato nel form ${tipo}.`, diagnostic);
    }

    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(2000);
    diagnostic.postSubmitUrl = page.url();
    diagnostic.postSubmitTitle = await page.title().catch(() => '');

    const postSubmitText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    const hasError = /error[ei]?|ocupad|occupat|no disponib|non disponib/i.test(postSubmitText);
    if (hasError) diagnostic.postSubmitBodySample = postSubmitText.slice(0, 500);

    await verifyBookingCreated(page, tabCtx, cellSel, data, baseUrl, diagnostic);

    diagnostic.steps.push('done');
    return {
      ok: true,
      campo, data, ora, oraFine: oraFineCalc, nome, durata, tipo, istruttore,
      diagnostic,
      warning: hasError ? 'Possibile errore rilevato nel DOM post-submit — verificare manualmente.' : undefined,
    };
  } catch (err) {
    const urlStr = (() => { try { return page?.url() ?? '?'; } catch { return '?'; } })();
    const extra = ` | steps=${JSON.stringify(diagnostic.steps)} url=${urlStr}`;
    if (!err.message.includes('steps=')) err.message = `${err.message}${extra}`;
    if (!err.diagnostic) err.diagnostic = diagnostic;
    throw err;
  } finally {
    await browser.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// CANCELLAZIONE PRENOTAZIONE — annulla una prenotazione esistente su Matchpoint
// ---------------------------------------------------------------------------
// Input: { idReserva?, campo?, data?, ora? }
// Se idReserva è fornito viene usato direttamente; altrimenti il worker ricava
// l'id dal tabellone usando campo + data (YYYY-MM-DD) + ora (HH:MM).
async function editBookingWithBrowser(input = {}) {
  const username = clean(input.username) || env('MATCHPOINT_USERNAME');
  const password = clean(input.password) || env('MATCHPOINT_PASSWORD');
  if (!username || !password) {
    throw fail('MATCHPOINT_WORKER_SECRETS_MISSING', 'Mancano credenziali Matchpoint nel worker.');
  }

  const baseUrl = clean(input.baseUrl) || env('MATCHPOINT_BASE_URL', DEFAULT_BASE_URL);
  // idReserva può arrivare diretto, oppure essere ricavato dopo il login da campo+data+ora
  // (stesso metodo di cancelBookingWithBrowser). La risoluzione vera avviene dopo il login,
  // dove esiste `page`; qui validiamo solo di avere almeno una delle due forme.
  let idReserva = input.idReserva ? String(input.idReserva) : null;
  const hasTerna = input.campo != null && !!input.data && !!input.ora;
  if (!idReserva && !hasTerna) throw fail('PARAMS_MANCANTI', 'Serve idReserva, oppure campo+data+ora.');

  const move = input.move || null;
  const players = input.players || null;
  const readOnly = input.read === true;
  if (!move && !players && !readOnly) throw fail('EDIT_NESSUNA_MODIFICA', 'Nessun blocco move/players fornito.');

  const diagnostic = { mode: 'edit_booking', steps: [], input: { idReserva, campo: input.campo, data: input.data, ora: input.ora, move, players } };
  let fichaUrl = null; // rilevata dopo il login: partita / lezione / manutenzione

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
    page.on('dialog', (d) => d.accept().catch(() => {}));

    // === LOGIN (stessa sequenza di cancelBookingWithBrowser) ===
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
    diagnostic.afterCashUrl = page.url();

    // Se non ho l'idReserva, lo ricavo dal tabellone per campo+data+ora
    // (stesso identico metodo già usato e validato in cancelBookingWithBrowser).
    if (!idReserva) {
      const recurso = RECURSO_BY_CAMPO[Number(input.campo)];
      if (!recurso) throw fail('CAMPO_NON_VALIDO', `Campo ${input.campo} senza id_recurso noto.`, diagnostic);
      if (!input.data || !input.ora) throw fail('PARAMS_MANCANTI', 'Servono idReserva, oppure campo+data+ora.', diagnostic);
      const [yyyy, mm, dd] = input.data.split('-');
      const fechaTab = `${dd}/${mm}/${yyyy}`;

      diagnostic.steps.push('goto_tabellone');
      await page.goto(`${baseUrl}/Reservas/CuadroReservas.aspx?id_cuadro=3`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.evaluate((f) => {
        const el = document.getElementById('fechaTabla');
        if (el) {
          el.value = f;
          ['input', 'change', 'keyup', 'blur'].forEach((ev) => el.dispatchEvent(new Event(ev, { bubbles: true })));
        }
      }, fechaTab);
      await page.waitForTimeout(4000);

      diagnostic.steps.push('cerca_evento');
      idReserva = await page.evaluate(({ recurso: rec, ora }) => {
        const eventi = [...document.querySelectorAll('div.evento')]
          .filter((e) => String(e.getAttribute('idrecurso')) === String(rec));
        const hit = eventi.find((e) => (e.innerText || '').includes(ora));
        return hit ? hit.id : null;
      }, { recurso, ora: input.ora });

      if (!idReserva) throw fail('PRENOTAZIONE_NON_TROVATA',
        `Nessun evento su campo ${input.campo} (recurso ${recurso}) all'ora ${input.ora} del ${fechaTab}.`, diagnostic);
      diagnostic.idReserva = idReserva;
    }

    // === APRI FICHA (auto-rileva il tipo) ===
    // Il pulsante "Spostare/Cambiare" (#CC_Datos_FormViewFicha_ButtonExtender) ha lo STESSO id
    // su partita/lezione/manutenzione, ma la pagina-scheda è a URL diverso per tipo. Aprendo
    // l'URL sbagliato Matchpoint rende una pagina vuota (niente pulsante). Proviamo le 3 schede
    // e teniamo quella in cui il pulsante esiste.
    diagnostic.steps.push('goto_ficha');
    const fichaCandidates = [
      `${baseUrl}/Reservas/FichaPartidaPagoPorUsuario.aspx?modo=fancy&id=${idReserva}`,
      `${baseUrl}/ClasesYCursos/FichaClaseSueltaPorUsuario.aspx?modo=fancy&id=${idReserva}`,
      `${baseUrl}/Reservas/FichaReservaMantenimiento.aspx?modo=fancy&id=${idReserva}`,
    ];
    for (const cand of fichaCandidates) {
      await page.goto(cand, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(400);
      const hasExtender = await page.locator('#CC_Datos_FormViewFicha_ButtonExtender').count().catch(() => 0);
      if (hasExtender) { fichaUrl = cand; break; }
    }
    if (!fichaUrl) {
      throw fail('FICHA_NON_TROVATA',
        `Nessuna scheda con pulsante "Spostare" per id ${idReserva} (partita/lezione/manutenzione).`,
        diagnostic);
    }
    diagnostic.steps.push('ficha_detected:' + (
      fichaUrl.includes('ClaseSuelta') ? 'lezione' :
      fichaUrl.includes('Mantenimiento') ? 'manutenzione' : 'partita'
    ));

    // === LETTURA SOLA (read) — restituisce i partecipanti attuali senza modificare nulla ===
    if (readOnly) {
      diagnostic.steps.push('read_only_roster');
      const partecipantiLettura = [];
      let ridx = 0;
      while (true) {
        const nomeInput = page.locator(
          `input[id*="RepeaterParticipantes_WUCUsuarioPartida_Listado_${ridx}_TextBoxNombreValor_${ridx}"]`,
        );
        if (!(await nomeInput.count().catch(() => 0))) break;
        const nome = (await nomeInput.first().inputValue().catch(() => '')).trim();
        const idClienteInput = page.locator(
          `input[id*="RepeaterParticipantes_WUCUsuarioPartida_Listado_${ridx}_HiddenFieldIdCliente_${ridx}"]`,
        );
        const idCliente = (await idClienteInput.first().inputValue().catch(() => '')).trim();
        const costoInput = page.locator(
          `input[id*="RepeaterParticipantes_WUCUsuarioPartida_Listado_${ridx}_TextBoxCargoReserva_${ridx}"]`,
        );
        const costo = (await costoInput.first().inputValue().catch(() => '')).trim();
        partecipantiLettura.push({ idx: String(ridx), nome, idCliente, costo });
        ridx++;
      }
      diagnostic.partecipantiFinali = partecipantiLettura;
      diagnostic.steps.push('done');
      return { ok: true, idReserva, readOnly: true, partecipantiFinali: partecipantiLettura, diagnostic };
    }

    let moved = false;

    // === SPOSTAMENTO ===
    if (move) {
      const recurso = move.campo != null ? RECURSO_BY_CAMPO[Number(move.campo)] : null;
      if (move.campo != null && !recurso) throw fail('CAMPO_NON_VALIDO', `Campo ${move.campo} senza id_recurso noto.`, diagnostic);
      const oraFine = move.oraFine || (move.oraInizio && move.durationMinutes ? computeEndTime(move.oraInizio, move.durationMinutes) : null);
      const fecha = move.data ? (() => { const [y, m, d] = move.data.split('-'); return `${d}/${m}/${y}`; })() : null;

      diagnostic.steps.push('open_extender');
      await page.locator('#CC_Datos_FormViewFicha_ButtonExtender').first().click({ timeout: 10000 });
      await page.waitForTimeout(1500);

      const f = page.frameLocator('iframe[src*="ExtenderHorarioReserva.aspx"]');
      if (recurso)        await f.locator('#CC_Datos_DropDownListRecursos').selectOption(String(recurso), { timeout: 8000 });
      if (fecha) {
        // ⚠️ Il campo data ha un datepicker jQuery UI: con .fill() il popup (#ui-datepicker-div)
        // resta aperto SOPRA i campi ORA e ne intercetta i click (locator.click Timeout).
        // Lo impostiamo via JS SENZA dare focus (niente datepicker) e nascondiamo il popup residuo.
        const fr = page.frames().find((x) => /ExtenderHorarioReserva/i.test(x.url()));
        if (fr) {
          await fr.evaluate((val) => {
            const el = document.getElementById('CC_Datos_TextBoxFecha');
            if (el) { el.value = val; el.dispatchEvent(new Event('change', { bubbles: true })); }
            const d = document.getElementById('ui-datepicker-div'); if (d) d.style.display = 'none';
          }, fecha).catch(() => {});
          diagnostic.steps.push(`fecha_set_js:${fecha}`);
        } else {
          await f.locator('#CC_Datos_TextBoxFecha').fill(fecha, { timeout: 8000 });
        }
      }
      // ⚠️ I campi ORA hanno un MaskedEditExtender (AjaxControlToolkit) + RequiredFieldValidator.
      // .fill() imposta il value ma NON aggiorna lo stato della maschera → la validazione blocca
      // il postback di "Accettare" e lo spostamento NON si applica. Vanno scritti con KEYSTROKE
      // VERI (solo cifre HHMM): la maschera formatta in HH:MM e popola il ClientState.
      if (move.oraInizio) {
        const hi = f.locator('#CC_Datos_TextBoxHoraInicio');
        await hi.click({ timeout: 8000 });
        await page.keyboard.press('Control+A').catch(() => {});
        await page.keyboard.press('Delete').catch(() => {});
        await hi.type(String(move.oraInizio).replace(/[^0-9]/g, ''), { delay: 60 });
        await page.keyboard.press('Tab').catch(() => {});
        diagnostic.steps.push(`ora_inizio_typed:${String(move.oraInizio).replace(/[^0-9]/g, '')}`);
      }
      if (oraFine) {
        const hf = f.locator('#CC_Datos_TextBoxHoraFin');
        await hf.click({ timeout: 8000 });
        await page.keyboard.press('Control+A').catch(() => {});
        await page.keyboard.press('Delete').catch(() => {});
        await hf.type(String(oraFine).replace(/[^0-9]/g, ''), { delay: 60 });
        await page.keyboard.press('Tab').catch(() => {});
        diagnostic.steps.push(`ora_fine_typed:${String(oraFine).replace(/[^0-9]/g, '')}`);
      }

      diagnostic.steps.push('click_aceptar');
      await f.locator('#CC_Datos_ButtonAceptar').click({ timeout: 10000 });

      // SweetAlert2 conferma: cercalo prima nell'iframe, poi nella pagina
      diagnostic.steps.push('attendi_swal');
      const okFrame = f.locator('button.swal2-confirm');
      const okPage  = page.locator('button.swal2-confirm');
      const t0 = Date.now();
      let clicked = false;
      while (Date.now() - t0 < 12000 && !clicked) {
        if (await okFrame.isVisible().catch(() => false)) {
          await okFrame.click({ timeout: 4000 }).catch(() => {});
          clicked = true;
        } else if (await okPage.isVisible().catch(() => false)) {
          await okPage.click({ timeout: 4000 }).catch(() => {});
          clicked = true;
        } else {
          await page.waitForTimeout(300);
        }
      }
      await page.waitForTimeout(2500);
      moved = true;

      // Ricarica Ficha pulita prima di toccare i giocatori e per la verifica
      diagnostic.steps.push('reload_after_move');
      await page.goto(fichaUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    }

    // === GIOCATORI ===
    if (players) {
      const removeNames = (players.remove || []).map((n) => n.toLowerCase().trim());
      const removeAll = players.removeAll === true;

      // RIMOZIONI — loop con ri-scan (no indici cached: il repeater si re-indicizza dopo ogni postback)
      if (removeAll || removeNames.length > 0) {
        diagnostic.steps.push('rimozioni_start');
        let keepRemoving = true;
        while (keepRemoving) {
          keepRemoving = false;
          let idx = 0;
          while (true) {
            const nomeInput = page.locator(
              `input[id*="RepeaterParticipantes_WUCUsuarioPartida_Listado_${idx}_TextBoxNombreValor_${idx}"]`,
            );
            if (!(await nomeInput.count().catch(() => 0))) break;
            const nomeVal = (await nomeInput.first().inputValue().catch(() => '')).toLowerCase().trim();
            const doRemove = removeAll || removeNames.includes(nomeVal);
            if (doRemove) {
              diagnostic.steps.push(`elimina:${nomeVal}`);
              const elimBtn = page.locator(
                `#CC_Datos_FormViewFicha_RepeaterParticipantes_WUCUsuarioPartida_Listado_${idx}_LinkButtonEliminar_${idx}`,
              );
              await elimBtn.first().click({ timeout: 8000 });
              await page.waitForTimeout(1200);
              keepRemoving = true;
              break; // ri-scan dall'inizio dopo il postback
            }
            idx++;
          }
        }
      }

      // AGGIUNTE
      for (const p of (players.add || [])) {
        const r = await searchAndAddPlayer(page, page, p.nome, diagnostic, undefined, p.codice);
        diagnostic.steps.push(`add_result:${p.nome}:added=${r.added}`);

        // Imposta costo se fornito
        if (p.costo != null && r.added) {
          let idx = 0;
          while (true) {
            const nomeInput = page.locator(
              `input[id*="RepeaterParticipantes_WUCUsuarioPartida_Listado_${idx}_TextBoxNombreValor_${idx}"]`,
            );
            if (!(await nomeInput.count().catch(() => 0))) break;
            const nomeVal = (await nomeInput.first().inputValue().catch(() => '')).toLowerCase().trim();
            if (nomeVal === p.nome.toLowerCase().trim()) {
              const costoField = page.locator(
                `#CC_Datos_FormViewFicha_RepeaterParticipantes_WUCUsuarioPartida_Listado_${idx}_TextBoxCargoReserva_${idx}`,
              );
              if (await costoField.count().catch(() => 0)) {
                await costoField.first().fill(String(p.costo), { timeout: 5000 });
                await costoField.first().dispatchEvent('change');
                diagnostic.steps.push(`costo_set:${p.nome}=${p.costo}`);
              }
              break;
            }
            idx++;
          }
        }
      }

      // SALVA giocatori con ButtonActualizar
      diagnostic.steps.push('salva');
      await Promise.all([
        page.waitForLoadState('networkidle', { timeout: 9000 }).catch(() => {}),
        page.locator('#CC_Datos_FormViewFicha_ButtonActualizar').first().click({ timeout: 10000 }),
      ]);
      await page.waitForTimeout(2500);
    }

    // === VERIFICA (reload + lettura) ===
    diagnostic.steps.push('verifica_reload');
    await page.goto(fichaUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

    const pageText = await page.evaluate(() => document.body.innerText || '').catch(() => '');

    // Leggi slot dal testo
    let slotFinale = null;
    if (move) {
      const normalizeHour = (hhmm) => (hhmm ? hhmm.replace(/^0(\d:)/, '$1') : '');
      const expectedData = move.data
        ? (() => { const [y, m, d] = move.data.split('-'); return `${d}/${m}/${y}`; })()
        : null;
      const oraFineCalc = move.oraFine || (move.oraInizio && move.durationMinutes
        ? computeEndTime(move.oraInizio, move.durationMinutes) : null);
      const expectedOraInizio = normalizeHour(move.oraInizio);

      const dataMatch = pageText.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{1,2}:\d{2})\s*[-–]?\s*(\d{1,2}:\d{2})/);
      const campoMatch = pageText.match(/Prenotazione\s+(Campo\s+\d+)/i) || pageText.match(/(Campo\s+\d+)/i);
      const campoName = campoMatch ? campoMatch[1] : null;
      slotFinale = dataMatch
        ? `${campoName || '?'} · ${dataMatch[1]} · ${dataMatch[2]}–${dataMatch[3]}`
        : null;

      if (expectedData && dataMatch && !dataMatch[1].includes(expectedData)) {
        throw fail('EDIT_VERIFICA_FALLITA',
          `Data attesa ${expectedData} ma pagina mostra ${dataMatch[1]}`, diagnostic);
      }
      if (expectedOraInizio && dataMatch) {
        // Normalizza ENTRAMBI i lati allo stesso formato: la manutenzione mostra "07:00",
        // partita/lezione "7:00". Senza normalizzare anche pageOra il confronto dava un
        // falso EDIT_VERIFICA_FALLITA pur essendo lo spostamento corretto.
        const pageOra = normalizeHour(dataMatch[2]);
        const expOra  = expectedOraInizio; // già normalizzato
        if (pageOra !== expOra) {
          throw fail('EDIT_VERIFICA_FALLITA',
            `Ora inizio attesa ${expOra} ma trovata ${pageOra}`, diagnostic);
        }
      }
      diagnostic.slotFinale = slotFinale;
    }

    // Scansiona righe partecipanti
    const partecipantiFinali = [];
    let idx = 0;
    while (true) {
      const nomeInput = page.locator(
        `input[id*="RepeaterParticipantes_WUCUsuarioPartida_Listado_${idx}_TextBoxNombreValor_${idx}"]`,
      );
      if (!(await nomeInput.count().catch(() => 0))) break;
      const nome = (await nomeInput.first().inputValue().catch(() => '')).trim();
      const idClienteInput = page.locator(
        `input[id*="RepeaterParticipantes_WUCUsuarioPartida_Listado_${idx}_HiddenFieldIdCliente_${idx}"]`,
      );
      const idCliente = (await idClienteInput.first().inputValue().catch(() => '')).trim();
      const costoInput = page.locator(
        `input[id*="RepeaterParticipantes_WUCUsuarioPartida_Listado_${idx}_TextBoxCargoReserva_${idx}"]`,
      );
      const costo = (await costoInput.first().inputValue().catch(() => '')).trim();
      partecipantiFinali.push({ idx: String(idx), nome, idCliente, costo });
      idx++;
    }
    diagnostic.partecipantiFinali = partecipantiFinali;

    // Verifica giocatori vs richiesta
    if (players) {
      const nomiFinali = partecipantiFinali.map((p) => p.nome.toLowerCase().trim());
      for (const p of (players.add || [])) {
        if (!nomiFinali.includes(p.nome.toLowerCase().trim())) {
          throw fail('EDIT_VERIFICA_FALLITA',
            `Giocatore aggiunto ${p.nome} non trovato nella verifica finale.`, diagnostic);
        }
      }
      if (!players.removeAll) {
        for (const nome of (players.remove || [])) {
          if (nomiFinali.includes(nome.toLowerCase().trim())) {
            throw fail('EDIT_VERIFICA_FALLITA',
              `Giocatore ${nome} doveva essere rimosso ma è ancora presente.`, diagnostic);
          }
        }
      }
    }

    diagnostic.steps.push('done');
    return { ok: true, idReserva, moved, slotFinale, partecipantiFinali, diagnostic };
  } finally {
    await browser.close().catch(() => {});
  }
}

async function cancelBookingWithBrowser(input = {}) {
  const username = clean(input.username) || env('MATCHPOINT_USERNAME');
  const password = clean(input.password) || env('MATCHPOINT_PASSWORD');
  if (!username || !password) {
    throw fail('MATCHPOINT_WORKER_SECRETS_MISSING', 'Mancano credenziali Matchpoint nel worker.');
  }

  const baseUrl = clean(input.baseUrl) || env('MATCHPOINT_BASE_URL', DEFAULT_BASE_URL);
  const diagnostic = {
    mode: 'cancel_booking',
    steps: [],
    input: { idReserva: input.idReserva, campo: input.campo, data: input.data, ora: input.ora },
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

    // Login (stessa sequenza di createBookingWithBrowser)
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
    diagnostic.afterCashUrl = page.url();

    let idReserva = input.idReserva ? String(input.idReserva) : null;

    // Se non ho l'id, lo ricavo dal tabellone per campo+data+ora
    if (!idReserva) {
      const recurso = RECURSO_BY_CAMPO[Number(input.campo)];
      if (!recurso) throw fail('CAMPO_NON_VALIDO', `Campo ${input.campo} senza id_recurso noto.`, diagnostic);
      if (!input.data || !input.ora) throw fail('PARAMS_MANCANTI', 'Servono idReserva, oppure campo+data+ora.', diagnostic);
      const [yyyy, mm, dd] = input.data.split('-');
      const fechaTab = `${dd}/${mm}/${yyyy}`;

      diagnostic.steps.push('goto_tabellone');
      await page.goto(`${baseUrl}/Reservas/CuadroReservas.aspx?id_cuadro=3`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.evaluate((f) => {
        const el = document.getElementById('fechaTabla');
        if (el) {
          el.value = f;
          ['input', 'change', 'keyup', 'blur'].forEach((ev) => el.dispatchEvent(new Event(ev, { bubbles: true })));
        }
      }, fechaTab);
      await page.waitForTimeout(4000);

      diagnostic.steps.push('cerca_evento');
      idReserva = await page.evaluate(({ recurso: rec, ora }) => {
        const eventi = [...document.querySelectorAll('div.evento')]
          .filter((e) => String(e.getAttribute('idrecurso')) === String(rec));
        const hit = eventi.find((e) => (e.innerText || '').includes(ora));
        return hit ? hit.id : null;
      }, { recurso, ora: input.ora });

      if (!idReserva) throw fail('PRENOTAZIONE_NON_TROVATA',
        `Nessun evento su campo ${input.campo} (recurso ${recurso}) all'ora ${input.ora} del ${fechaTab}.`, diagnostic);
    }
    diagnostic.idReserva = idReserva;

    // === APRI FICHA (auto-rileva il tipo) — stesso approccio della FIX 5 dell'edit ===
    // La scheda ha URL DIVERSA per tipo (partita/lezione/manutenzione). Aprendo la URL
    // sbagliata Matchpoint rende una pagina vuota (nessun pulsante). Proviamo le 3 schede e
    // teniamo la prima valida: pulsante presente, oppure prenotazione già ANNULLATA.
    diagnostic.steps.push('goto_ficha');
    let fichaUrl = null;
    const fichaCandidates = [
      `${baseUrl}/Reservas/FichaPartidaPagoPorUsuario.aspx?modo=fancy&id=${idReserva}`,
      `${baseUrl}/ClasesYCursos/FichaClaseSueltaPorUsuario.aspx?modo=fancy&id=${idReserva}`,
      `${baseUrl}/Reservas/FichaReservaMantenimiento.aspx?modo=fancy&id=${idReserva}`,
    ];
    for (const cand of fichaCandidates) {
      await page.goto(cand, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(400);
      const valida = await page.evaluate(() =>
        !!document.querySelector('#CC_Datos_FormViewFicha_ButtonAnularReserva') ||
        !!document.querySelector('#CC_Datos_FormViewFicha_ButtonExtender') ||
        /ANNULLAT/i.test(document.body.innerText || '')
      );
      if (valida) { fichaUrl = cand; break; }
    }
    if (!fichaUrl) {
      throw fail('FICHA_NON_TROVATA',
        `Nessuna scheda valida per id ${idReserva} (partita/lezione/manutenzione).`,
        diagnostic);
    }
    diagnostic.steps.push('ficha_detected:' + (
      fichaUrl.includes('ClaseSuelta') ? 'lezione' :
      fichaUrl.includes('Mantenimiento') ? 'manutenzione' : 'partita'
    ));

    // Verifica stato iniziale (se già annullata, esci ok)
    const giaAnnullata = await page.evaluate(() => /ANNULLATA/i.test(document.body.innerText || ''));
    if (giaAnnullata) {
      diagnostic.steps.push('gia_annullata');
      diagnostic.alreadyCancelled = true;
      return { ok: true, idReserva, alreadyCancelled: true, diagnostic };
    }

    // ⚠️ CRUCIALE: registra l'handler per il popup nativo window.confirm PRIMA di cliccare.
    // Matchpoint mostra un confirm() nativo dopo la conferma; se non viene accettato
    // l'annullamento non si finalizza pur tornando HTTP 200 (falso successo silenzioso).
    page.on('dialog', (d) => d.accept().catch(() => {}));

    // Il flusso di conferma DIPENDE DAL TIPO:
    //  • PARTITA/LEZIONE → "Annullare" apre un iframe fancybox anularreserva.aspx (ButtonAnular).
    //  • MANUTENZIONE    → NON supportata dal worker. La procedura reale di cancellazione si
    //    innesca SOLO entrando dal tabellone (non dall'URL diretta ?modo=fancy usata dal worker)
    //    e tocca rimborsi/pagamenti. Falliamo SUBITO con un errore chiaro invece di tentare un
    //    flusso che non cancella nulla (vecchia "FIX B": ~30s di attesa inutile e poi 502).
    const isManutenzione = fichaUrl.includes('Mantenimiento');
    if (isManutenzione) {
      throw fail('MANUTENZIONE_CANCEL_NON_SUPPORTATA',
        'Cancellazione manutenzione non supportata dal worker: va eseguita a mano dal tabellone su Matchpoint.',
        diagnostic);
    }

    // PARTITA / LEZIONE: il click apre l'iframe fancybox anularreserva.aspx con ButtonAnular.
    diagnostic.steps.push('click_annulla:partita/lezione');
    await page.locator('#CC_Datos_FormViewFicha_ButtonAnularReserva').first().click({ timeout: 10000 });
    diagnostic.steps.push('attendi_dialogo');
    const dlg = page.frameLocator('iframe[src*="anularreserva.aspx"]');
    await dlg.locator('#CC_Datos_ButtonAnular').first().waitFor({ state: 'visible', timeout: 10000 });
    diagnostic.steps.push('conferma_annulla');
    await dlg.locator('#CC_Datos_ButtonAnular').first().click({ timeout: 10000 });
    // Attendi il completamento del postback (operazione lenta su Matchpoint)
    await page.waitForTimeout(6000);

    // Verifica esito ricaricando la SCHEDA GIUSTA (stessa URL auto-rilevata sopra)
    diagnostic.steps.push('verifica');
    await page.goto(fichaUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    const annullata = await page.evaluate(() => /ANNULLATA/i.test(document.body.innerText || ''));
    diagnostic.statoFinale = annullata ? 'ANNULLATA' : 'NON_ANNULLATA';
    if (!annullata) {
      throw fail('ANNULLAMENTO_NON_RIUSCITO',
        'La prenotazione risulta ancora attiva dopo la conferma (popup OK non accettato?).',
        diagnostic);
    }

    diagnostic.steps.push('done');
    return { ok: true, idReserva, statoFinale: 'ANNULLATA', diagnostic };
  } finally {
    await browser.close().catch(() => {});
  }
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
      const result = await mpQueueRun(
        { op: 'poll', label: `sync slot ${isoDate}`, operatore: 'sistema' },
        () => getSlotsWithBrowser({ date: isoDate }),
      );
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
          '/create-booking', '/cancel-booking', '/edit-booking', '/create-client',
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
    if (req.method === 'POST' && req.url === '/create-booking') {
      return await handleCreateBooking(req, res);
    }
    if (req.method === 'POST' && req.url === '/cancel-booking') {
      return await handleCancelBooking(req, res);
    }
    if (req.method === 'POST' && req.url === '/edit-booking') {
      return await handleEditBooking(req, res);
    }
    if (req.method === 'POST' && req.url === '/create-client') {
      return await handleCreateClient(req, res);
    }
    if (req.method === 'GET' && req.url === '/queue/status') {
      return handleQueueStatus(req, res);
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
