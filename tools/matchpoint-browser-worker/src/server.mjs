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

// ─── Selettori pagamenti/borsellino Matchpoint (mappati in Fase 0, 27/06/2026) ──
// UNICO punto con la conoscenza del DOM di pagamento. Gli handler referenziano
// solo queste costanti. Tutto verificato dal vivo sulla Matchpoint reale.
//
// SCHEDA PARTITA  /Reservas/FichaPartidaPagoPorUsuario.aspx?modo=fancy&id={idReserva}
//   repeater per partecipante: RepeaterParticipantes_{RP}_Listado_{idx}_<suffisso>_{idx}
//   (RP = WUCUsuarioPartida per partita/lezione). I suffissi già usati dal worker
//   (TextBoxNombreValor / HiddenFieldIdCliente / TextBoxCargoReserva) restano dove
//   sono; qui aggiungiamo SOLO i campi economici di sola lettura.
// SCHEDA CLIENTE  /Clientes/FichaCliente.aspx?id={idInterno}
//   borsellino ("Portafoglio") nell'header.
const MP_PAYMENT_SELECTORS = {
  // -- scheda partita, per partecipante (idx) — sola lettura --
  // stato pagamento: "In sospeso" (>0) / "Riscosso" (=0) si deduce dall'importo pendente
  partImportePendiente: (idx) => `[id*="RepeaterParticipantes"][id*="Listado_${idx}_LabelImportePendienteValor_${idx}"]`,
  partImporteTotale:    (idx) => `[id*="RepeaterParticipantes"][id*="Listado_${idx}_LabelImporteTotalValor_${idx}"]`,
  partSaldoAttuale:     (idx) => `[id*="RepeaterParticipantes"][id*="Listado_${idx}_LabelSaldoActual_${idx}"]`,
  partHiddenImporte:    (idx) => `input[id*="RepeaterParticipantes"][id*="Listado_${idx}_HiddenFieldImporteReserva_${idx}"]`,
  partHiddenPendiente:  (idx) => `input[id*="RepeaterParticipantes"][id*="Listado_${idx}_HiddenFieldSaldoPendiente_${idx}"]`,
  // azione incasso (apre il dialog forma-pago: Contanti/Carta/…) — usata SOLO in scrittura (Fase 2 write)
  partIncassaBtn:       (idx) => `a[id*="RepeaterParticipantes"][id*="Listado_${idx}_LinkButtonCobrar_${idx}"]`,
  // dialog "Incassare": metodo a PULSANTI, click per testo visibile
  cobroMethodLabels: { contanti: 'Contanti', carta: 'Carta', borsellino: 'Saldo disponibile' },

  // -- scheda cliente: borsellino / Portafoglio --
  walletSaldoLabel: '#CC_Cabecera_LabelSaldo_Actual', // testo "Portafoglio: X,XX €"
  walletBillingTab: 'Fatturazione e pagamenti',       // tab (testo) che apre la sezione pagamenti
  walletRicaricaBtn: '#CC_Datos_FormViewFicha_LinkButton11', // "Ricaricare" → dialog "Effettuare ricarica"
  // -- STORNO borsellino (Fase 2b write): sotto-tab "Saldo" della sezione Fatturazione e
  //    pagamenti = ledger del borsellino, coi pulsanti "Ricarica credito / Correzione del
  //    saldo / Trasferimento di credito residuo / Ricaricare". La "Correzione del saldo"
  //    è quella che useremo per sottrarre (storno totale/parziale). ⚠️ DOM dialog NON
  //    mappato dal vivo → diagnostic-first (vedi _clickCorrezioneSaldo). Testi candidati:
  walletSaldoSubTabLabels: ['Saldo'],                  // sotto-tab "Saldo" (ledger borsellino)
  walletCorrezioneLabels: ['Correzione del saldo', 'Correzione saldo', 'Corrección de saldo', 'Corregir saldo'],
};

// Estrae i centesimi interi da una stringa importo IT/MP ("Portafoglio: 1.234,50 €", "8,00").
function mpMoneyToCents(text) {
  const s = String(text == null ? '' : text);
  const m = s.match(/-?\d[\d.\s]*,\d{1,2}|-?\d[\d.\s]*/);
  if (!m) return null;
  let num = m[0].replace(/\s/g, '');
  if (num.includes(',')) num = num.replace(/\./g, '').replace(',', '.'); // formato IT: . migliaia, , decimali
  const val = Number(num);
  return Number.isFinite(val) ? Math.round(val * 100) : null;
}

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
  running: null, // { id, op, label, operatore, priority, startedAt }
  waiting: [],   // [{ id, op, label, operatore, priority, enqueuedAt, fn, resolve, reject }]
};

// PRIORITÀ CODA (fix latenza BUG2): le operazioni INTERATTIVE dell'operatore
// (create/edit/cancel + gestione cliente) scavalcano in coda i job di BACKGROUND
// (read-tabellone del sync, poll, keepalive), così l'operatore non aspetta ~30s
// dietro una lettura tabellone in coda. NON è preemption: un job già in esecuzione
// non si interrompe (page warm condivisa → una sola op per volta sulla pagina); la
// priorità agisce solo nella SCELTA del prossimo job. Il "cedere il passo" durante
// il sync è ottenuto spezzando read-tabellone in chunk (vedi handleReadTabellone).
const MP_INTERACTIVE_OPS = new Set(['create', 'edit', 'cancel', 'client', 'disable-client', 'reactivate-client']);
function mpJobPriority(meta) {
  if (meta && typeof meta.priority === 'number') return meta.priority;
  return (meta && MP_INTERACTIVE_OPS.has(meta.op)) ? 1 : 0;
}

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
      priority: mpQueue.running.priority,
      runningMs: now - mpQueue.running.startedAt,
    } : null,
    waitingCount: mpQueue.waiting.length,
    waiting: mpQueue.waiting.map((j) => ({ id: j.id, op: j.op, label: j.label, operatore: j.operatore, priority: j.priority })),
    time: new Date().toISOString(),
  };
}

// DIAGNOSI LATENZA (BUG2 >120s): stampa ogni step del diagnostic col tempo cumulato
// (ms dall'inizio dell'operazione), così i log pm2 mostrano ESATTAMENTE quale attesa
// pesa. Avvolge `diagnostic.steps.push` lasciando le etichette intatte e accodando il
// tempo in `diagnostic.stepTimes` (parallelo). Best-effort: se qualcosa va storto,
// l'array resta quello standard. Da chiamare subito dopo aver creato `diagnostic`.
function instrumentStepTiming(diagnostic) {
  try {
    if (!diagnostic || !Array.isArray(diagnostic.steps) || diagnostic.__timed) return diagnostic;
    const t0 = Date.now();
    diagnostic.__timed = true;
    diagnostic.stepTimes = [];
    const arr = diagnostic.steps;
    const origPush = arr.push.bind(arr);
    arr.push = function (...labels) {
      const t = Date.now() - t0;
      for (let i = 0; i < labels.length; i++) diagnostic.stepTimes.push(t);
      return origPush(...labels);
    };
  } catch (_e) {}
  return diagnostic;
}

// Esegue `fn` (async) in modo serializzato: una sola operazione browser alla volta.
// `meta` = { op, label, operatore, priority? } (priority opzionale; default da mpJobPriority).
// Ritorna/propaga ESATTAMENTE ciò che ritorna/lancia `fn`, così gli handler non cambiano
// semantica. La scelta del prossimo job è per PRIORITÀ (poi FIFO a pari priorità).
function mpQueueRun(meta, fn) {
  return new Promise((resolve, reject) => {
    const job = {
      id: ++mpQueue.seq,
      op: meta.op || 'op',
      label: meta.label || meta.op || 'operazione',
      operatore: meta.operatore || '—',
      priority: mpJobPriority(meta),
      enqueuedAt: Date.now(),
      fn,
      resolve,
      reject,
    };
    mpQueue.waiting.push(job);
    mpQueuePump();
  });
}

// Sceglie l'indice del prossimo job: priorità più alta; a pari priorità, chi è in
// coda da più tempo (FIFO stabile). Ritorna -1 se non c'è nulla in attesa.
function mpQueuePickNextIdx() {
  let best = -1;
  for (let i = 0; i < mpQueue.waiting.length; i++) {
    const j = mpQueue.waiting[i];
    if (best < 0) { best = i; continue; }
    const b = mpQueue.waiting[best];
    if (j.priority > b.priority || (j.priority === b.priority && j.enqueuedAt < b.enqueuedAt)) best = i;
  }
  return best;
}

// Pompa la coda: se nessun job è in esecuzione, pesca il prossimo (per priorità) e lo
// avvia. Concorrenza 1 garantita dal guard `mpQueue.running`. Richiamato all'enqueue e
// a fine di ogni job. La sezione fino a `mpQueue.running = …` è SINCRONA → niente race.
function mpQueuePump() {
  if (mpQueue.running) return;
  const idx = mpQueuePickNextIdx();
  if (idx < 0) return;
  const job = mpQueue.waiting.splice(idx, 1)[0];
  const startedAt = Date.now();
  const queueWaitMs = startedAt - job.enqueuedAt;
  mpQueue.running = { id: job.id, op: job.op, label: job.label, operatore: job.operatore, priority: job.priority, startedAt };
  (async () => {
    let timer = null;
    let _err = null;
    let _val;
    let _hasErr = false;
    try {
      // Timeout di sicurezza: un job piantato non deve bloccare la coda all'infinito.
      const guard = new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(fail('QUEUE_JOB_TIMEOUT',
          `Operazione "${job.label}" oltre ${Math.round(QUEUE_JOB_TIMEOUT_MS / 1000)}s: annullata per non bloccare la coda.`)),
          QUEUE_JOB_TIMEOUT_MS);
      });
      _val = await Promise.race([Promise.resolve().then(job.fn), guard]);
    } catch (e) {
      _err = e;
      _hasErr = true;
    } finally {
      if (timer) clearTimeout(timer);
      mpQueue.running = null;
      // DIAGNOSI LATENZA: una riga per operazione con attesa-in-coda, durata e — se
      // disponibile — la sequenza di step coi tempi cumulati. Vale per successi ED errori.
      try {
        const runMs = Date.now() - startedAt;
        const diag = (_err && _err.diagnostic) || (_val && _val.diagnostic) || null;
        console.log(JSON.stringify({
          event: 'mp_op_timing',
          op: job.op,
          label: job.label,
          operatore: job.operatore,
          priority: job.priority,
          ok: !_hasErr,
          code: (_err && _err.code) || undefined,
          queueWaitMs,
          runMs,
          session: (diag && diag.session) || undefined,
          steps: (diag && Array.isArray(diag.steps)) ? diag.steps : undefined,
          stepTimes: (diag && Array.isArray(diag.stepTimes)) ? diag.stepTimes : undefined,
          time: new Date().toISOString(),
        }));
      } catch (_e) {}
      // Risolve/rigetta il chiamante con ESATTAMENTE ciò che fn ha prodotto, poi avvia
      // il prossimo job (eventuale op interattiva accodata nel frattempo passa avanti).
      if (_hasErr) job.reject(_err); else job.resolve(_val);
      mpQueuePump();
    }
  })();
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

// Normalizza un'ora "H:MM"/"HH:MM" a "HH:MM" (zero-padded), per il match col tabellone.
function padOraHHMM(value) {
  const m = clean(value).match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : clean(value);
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

// Legge la data attualmente mostrata dal tabellone (input datepicker #fechaTabla),
// normalizzata a 'dd/mm/yyyy'. '' se non leggibile. Serve a VERIFICARE che la griglia
// sia passata davvero al giorno richiesto (vedi nota minDate in impostaDataTabellone).
async function leggiDataTabellone(tabCtx) {
  return await tabCtx.evaluate(() => {
    try {
      const el = document.querySelector('#fechaTabla');
      const v = el && el.value ? String(el.value).trim() : '';
      const m = v.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
      if (!m) return '';
      const dd = String(m[1]).padStart(2, '0');
      const mm = String(m[2]).padStart(2, '0');
      let yy = String(m[3]); if (yy.length === 2) yy = '20' + yy;
      return `${dd}/${mm}/${yy}`;
    } catch (e) { return ''; }
  }).catch(() => '');
}

// Imposta la data sul tabellone e attende che la griglia si aggiorni.
// isoDate: 'YYYY-MM-DD'
async function impostaDataTabellone(tabCtx, page, isoDate, diagnostic, opts = {}) {
  const [year, month, day] = isoDate.split('-');
  const italianDate = `${day}/${month}/${year}`;
  diagnostic.steps.push(`tabellone_set_date_${isoDate}`);

  // ── Strategia 1: jQuery datepicker onSelect → AJAX grid reload ───────────
  // CuadroReservasNuevo.aspx usa un jQuery UI datepicker collegato a #fechaTabla.
  // Il suo callback onSelect() aggiorna la griglia via AJAX (non postback ASP.NET).
  // Chiamarlo direttamente è l'unico modo affidabile per cambiare data senza
  // navigazione diretta (bloccata da EventValidation / Error.aspx).
  const _fireOnSelect = () => tabCtx.evaluate((dateStr) => {
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

  const onSelectResult = await _fireOnSelect();

  if (onSelectResult?.ok) {
    diagnostic.dateInputSelector = onSelectResult.method;
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1200);
    // VERIFICA che la griglia mostri davvero il giorno richiesto. Il datepicker jQuery UI,
    // se ha un minDate, CLAMPA setDate() a oggi: onSelect scatta con la data di oggi e la
    // griglia non si sposta sul giorno passato → l'evento non si trova ("nessun evento").
    // Se la data mostrata ≠ target, NON usciamo: passiamo alla navigazione esplicita del
    // popup (Strategia 2), che è esattamente ciò che fa l'operatore a mano.
    const shown1 = await leggiDataTabellone(tabCtx);
    diagnostic.dateShownAfterOnSelect = shown1;
    if (!shown1 || shown1 === italianDate) {
      diagnostic.dateShown = shown1 || italianDate;
      return;
    }
    diagnostic.steps.push(`date_mismatch_onSelect:want=${italianDate}:got=${shown1}`);
  }

  // Modalità FAST (solo lookup idReserva post-create): NIENTE Strategia 2 (navigazione popup
  // mesi, lenta e a volte buggata: ~15-20s, ha persino sbagliato anno → 2028). Il grid però è
  // spesso solo IN RITARDO sull'AJAX dell'onSelect → ritenta la via VELOCE qualche volta (cap
  // ~5s) prima di rinunciare. Se non ci riesce, id nullo: il sync ogni 2 min lo riassegna.
  if (opts.fast) {
    for (let i = 0; i < 3; i++) {
      await _fireOnSelect();
      await page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(500);
      const shownF = await leggiDataTabellone(tabCtx);
      if (shownF === italianDate) { diagnostic.dateShown = shownF; diagnostic.steps.push(`date_fast_ok:retry${i}`); return; }
    }
    diagnostic.steps.push('date_fast_giveup');
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
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(1200);
        const shown2 = await leggiDataTabellone(tabCtx);
        diagnostic.dateShownAfterPopup = shown2;
        if (!shown2 || shown2 === italianDate) {
          diagnostic.dateShown = shown2 || italianDate;
          return;
        }
        // La data ancora non combacia (es. giorno disabilitato da minDate): non usciamo,
        // proviamo le strategie successive (fill/DOM).
        diagnostic.steps.push(`date_mismatch_popup:want=${italianDate}:got=${shown2}`);
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

  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1200);
  diagnostic.afterDateUrl = page.url();
  // Registra anche l'URL del frame (più utile di page.url() per capire se c'è stato reload)
  diagnostic.afterDateFrameUrl = await tabCtx.evaluate(() => location.href).catch(() => '');
  // Data effettivamente mostrata dopo tutti i tentativi: se ≠ target, chi cerca l'evento
  // saprà (e potrà segnalarlo) che la griglia non si è spostata sul giorno richiesto.
  diagnostic.dateShown = await leggiDataTabellone(tabCtx);
  if (diagnostic.dateShown && diagnostic.dateShown !== italianDate) {
    diagnostic.dateMismatch = `want=${italianDate}:got=${diagnostic.dateShown}`;
  }
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

// ════════════════════════════════════════════════════════════════════════════
// SESSIONE "CALDA" CONDIVISA (Fase 1: poller + editor)
// ────────────────────────────────────────────────────────────────────────────
// Evita avvio Chromium + login a OGNI operazione: un solo browser già loggato,
// riusato dalle operazioni e tenuto vivo dal poller. Reti di sicurezza:
//  1) FALLBACK: se la sessione calda manca o dà errore → browser a freddo (come prima).
//  2) INTERRUTTORE: env MATCHPOINT_WARM_SESSION=false → sempre a freddo.
//  3) VALIDITÀ: prima di riusare si verifica di essere loggati; se scaduta, re-login.
//     Età massima 30 min (sicurezza memoria/stato).
const MP_WARM_ENABLED = boolEnv('MATCHPOINT_WARM_SESSION', true);
const MP_WARM_MAX_AGE_MS = 30 * 60 * 1000;
const MP_WARM_FRESH_MS = 5 * 60 * 1000; // se usata con successo da meno di 5 min, salta la verifica
let _mpWarm = null; // { browser, context, page, createdAt }

function mpLaunchOptions() {
  return { headless: boolEnv('MATCHPOINT_HEADLESS', true), args: ['--no-sandbox', '--disable-dev-shm-usage'] };
}

async function mpNewContextPage(browser) {
  const context = await browser.newContext({
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
  });
  const page = await context.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  return { context, page };
}

async function mpDoLogin(page, baseUrl, username, password, diagnostic) {
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
}

async function mpWarmInvalidate() {
  const w = _mpWarm;
  _mpWarm = null;
  if (w && w.browser) { try { await w.browser.close(); } catch (_e) {} }
}

async function mpWarmEnsureLogged(baseUrl, username, password, diagnostic) {
  const w = _mpWarm;
  await w.page.goto(absoluteUrl(baseUrl, '/Reservas/CuadroReservas.aspx?id_cuadro=3'), { waitUntil: 'domcontentloaded', timeout: 25000 });
  if (/Login\.aspx/i.test(w.page.url()) && await w.page.locator('input[type="password"]').count().catch(() => 0)) {
    diagnostic.steps.push('warm_relogin');
    await mpDoLogin(w.page, baseUrl, username, password, diagnostic);
  } else {
    diagnostic.steps.push('warm_reuse');
  }
}

// Costruisce la sessione warm (login a freddo). Guard `_mpWarmBuilding` per
// deduplicare chiamate concorrenti (warmup all'avvio + primo request reale): la
// seconda attende il login già in corso invece di lanciare un secondo browser.
let _mpWarmBuilding = null;
async function mpBuildWarm(baseUrl, username, password, diagnostic) {
  if (_mpWarmBuilding) { await _mpWarmBuilding; return; }
  _mpWarmBuilding = (async () => {
    const browser = await chromium.launch(mpLaunchOptions());
    const { context, page } = await mpNewContextPage(browser);
    await mpDoLogin(page, baseUrl, username, password, diagnostic);
    _mpWarm = { browser, context, page, createdAt: Date.now(), lastOkAt: Date.now() };
  })();
  try { await _mpWarmBuilding; } finally { _mpWarmBuilding = null; }
}

// Scalda la sessione all'avvio del worker, così la PRIMA operazione reale dopo
// un deploy/restart (pm2) non paga il login a freddo (~13s). Best-effort.
async function mpWarmStartup() {
  if (!MP_WARM_ENABLED) return;
  const baseUrl = env('MATCHPOINT_BASE_URL', DEFAULT_BASE_URL);
  const username = env('MATCHPOINT_USERNAME');
  const password = env('MATCHPOINT_PASSWORD');
  if (!username || !password) return;
  const t0 = Date.now();
  try {
    await mpBuildWarm(baseUrl, username, password, { steps: [] });
    console.log(JSON.stringify({ event: 'mp_warm_startup_ok', ms: Date.now() - t0 }));
  } catch (e) {
    await mpWarmInvalidate();
    console.log(JSON.stringify({ event: 'mp_warm_startup_failed', error: String((e && e.message) || e) }));
  }
}

// Keepalive proattivo: ricostruisce la sessione warm PRIMA del tetto `createdAt`
// (MP_WARM_MAX_AGE_MS), così nessuna operazione utente paga il login a freddo
// dopo ~30 min di inattività. Passa per la coda (serializzato con le altre op →
// nessun login concorrente sull'account Matchpoint unico). Il rebuild è raro
// (~ogni 24 min) e occupa la coda ~13s solo se serve davvero.
const MP_WARM_KEEPALIVE_MS = 4 * 60 * 1000;       // controlla ogni 4 min
const MP_WARM_REBUILD_MARGIN_MS = 6 * 60 * 1000;  // ricostruisci 6 min prima del cap
function startWarmKeepalive() {
  if (!MP_WARM_ENABLED) return;
  const baseUrl = env('MATCHPOINT_BASE_URL', DEFAULT_BASE_URL);
  const username = env('MATCHPOINT_USERNAME');
  const password = env('MATCHPOINT_PASSWORD');
  if (!username || !password) return;
  const tick = () => {
    mpQueueRun({ op: 'keepalive', label: 'keepalive sessione', operatore: '—' }, async () => {
      const dead = !_mpWarm || !_mpWarm.page || _mpWarm.page.isClosed();
      const age = _mpWarm ? Date.now() - (_mpWarm.createdAt || 0) : Infinity;
      if (dead || age > (MP_WARM_MAX_AGE_MS - MP_WARM_REBUILD_MARGIN_MS)) {
        await mpWarmInvalidate();
        await mpBuildWarm(baseUrl, username, password, { steps: [] });
        console.log(JSON.stringify({ event: 'mp_warm_keepalive_rebuild' }));
      }
      return { ok: true };
    }).catch((e) => {
      console.log(JSON.stringify({ event: 'mp_warm_keepalive_error', error: String((e && e.message) || e) }));
    });
  };
  const t = setInterval(tick, MP_WARM_KEEPALIVE_MS);
  if (t && t.unref) t.unref();
}

async function mpAcquirePage(baseUrl, username, password, diagnostic) {
  if (MP_WARM_ENABLED) {
    try {
      if (_mpWarm && (Date.now() - (_mpWarm.createdAt || 0) > MP_WARM_MAX_AGE_MS)) await mpWarmInvalidate();
      if (!_mpWarm || !_mpWarm.page || _mpWarm.page.isClosed()) {
        await mpBuildWarm(baseUrl, username, password, diagnostic);
        diagnostic.session = 'warm_new';
      } else if (Date.now() - (_mpWarm.lastOkAt || 0) < MP_WARM_FRESH_MS) {
        // Usata con successo da poco → riuso diretto, niente navigazione di verifica.
        diagnostic.session = 'warm_fresh';
      } else {
        await mpWarmEnsureLogged(baseUrl, username, password, diagnostic);
        diagnostic.session = 'warm';
      }
      return {
        page: _mpWarm.page,
        isWarm: true,
        release: async (failed) => { if (failed) { await mpWarmInvalidate(); } else if (_mpWarm) { _mpWarm.lastOkAt = Date.now(); } },
      };
    } catch (e) {
      await mpWarmInvalidate();
      diagnostic.warmError = String((e && e.message) || e);
    }
  }
  const browser = await chromium.launch(mpLaunchOptions());
  const { page } = await mpNewContextPage(browser);
  await mpDoLogin(page, baseUrl, username, password, diagnostic);
  diagnostic.session = 'cold';
  return {
    page,
    isWarm: false,
    release: async () => { try { await browser.close(); } catch (_e) {} },
  };
}

// ── W2 — RETRY per operazioni di SOLA LETTURA del tabellone (idempotenti) ────
// `MATCHPOINT_TABELLONE_NOT_FOUND` è una flakiness TRANSITORIA della navigazione
// (Matchpoint lento / interstiziale / sessione scaduta lato server): oggi esce come
// 500 al primo colpo e rompe il READ (idReserva stantio → edit per coordinate) e il
// POLLER (occupancy non aggiornato → fantasmi/ricomparse). Qui la ritentiamo a parità
// di operazione: invalidiamo la sessione calda (→ login fresco al prossimo acquire) e
// riproviamo. USARE SOLO su letture idempotenti (get-slots/poller, read-tabellone):
// MAI su create/edit/cancel (un retry su una mutazione parzialmente riuscita = doppione).
const MP_READ_NAV_RETRIES = Math.max(0, Math.min(4, Number(env('MATCHPOINT_READ_NAV_RETRIES', '2'))));
const MP_READ_NAV_RETRY_GAP_MS = Math.max(0, Number(env('MATCHPOINT_READ_NAV_RETRY_GAP_MS', '800')));
function _isRetriableNavError(e) {
  return !!(e && e.code === 'MATCHPOINT_TABELLONE_NOT_FOUND');
}
async function mpReadRetry(label, fn) {
  let lastErr = null;
  for (let attempt = 0; attempt <= MP_READ_NAV_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!_isRetriableNavError(e) || attempt === MP_READ_NAV_RETRIES) throw e;
      console.log(JSON.stringify({ event: 'mp_read_nav_retry', label: String(label || ''), attempt: attempt + 1, code: e.code, time: new Date().toISOString() }));
      await mpWarmInvalidate();        // forza un login fresco al prossimo mpAcquirePage
      if (MP_READ_NAV_RETRY_GAP_MS) await new Promise((r) => setTimeout(r, MP_READ_NAV_RETRY_GAP_MS));
    }
  }
  throw lastErr;
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

  const acq = await mpAcquirePage(baseUrl, username, password, diagnostic);
  const page = acq.page;
  let _opFailed = false;
  try {
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
  } catch (_e) {
    _opFailed = true;
    throw _e;
  } finally {
    await acq.release(_opFailed);
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

// ── readTabelloneWithBrowser: legge tutti gli eventi (con giocatori completi)
//    di una o piu' date dal tabellone, una navigazione per data. ──
async function readTabelloneWithBrowser(options = {}) {
  const username = clean(options.username) || env('MATCHPOINT_USERNAME');
  const password = clean(options.password) || env('MATCHPOINT_PASSWORD');
  if (!username || !password) {
    throw fail('MATCHPOINT_WORKER_SECRETS_MISSING', 'Mancano credenziali Matchpoint per read-tabellone.');
  }

  const baseUrl = clean(options.baseUrl) || env('MATCHPOINT_BASE_URL', DEFAULT_BASE_URL);
  const dates = (Array.isArray(options.dates) ? options.dates : [options.date])
    .map((d) => parseIsoDate(clean(d)))
    .filter(Boolean);
  if (!dates.length) throw fail('INVALID_DATES', 'Nessuna data valida fornita per read-tabellone.');

  const CAMPO_BY_RECURSO = { 13: 1, 14: 2, 15: 3, 16: 4 };
  const diagnostic = {
    mode: 'browser_worker_headless',
    flow: 'read_tabellone',
    baseUrl,
    dates,
    startedAt: new Date().toISOString(),
    steps: [],
  };
  const result = {}; // { 'YYYY-MM-DD': [ { campo, ora, oraFine, giocatori: [] } ] }

  // ── DIAGNOSTICA opt-in (Fase 0): quantifica la (non)determinatezza del roster.
  //    Attiva SOLO se options.debugStability > 0 → il percorso del cron è invariato.
  const debugStability = Math.max(0, Math.min(20, Number(options.debugStability) || 0));
  const stabilityGapMs = Math.max(150, Math.min(3000, Number(options.stabilityGapMs) || 500));

  // ── SETTLE deterministico (fix causa #1): dopo il cambio data l'attesa fissa di
  //    impostaDataTabellone (networkidle + 1200ms) basta su macchine veloci ma sul
  //    box condiviso lento a volte legge la griglia a render incompleto → roster
  //    parziale per alcune date. Qui, prima di leggere, attendiamo che lo snapshot
  //    degli eventi sia STABILE (firma roster invariata per N poll) e che ogni
  //    evento prenotato abbia almeno un nome; in più fondiamo gli snapshot con
  //    "fullest-wins" (per ogni evento si tiene il roster più completo osservato),
  //    così anche senza stabilità perfetta non si restituisce mai un roster parziale.
  const settleMaxMs = Math.max(800, Math.min(20000, Number(options.settleMaxMs) || Number(env('MATCHPOINT_TAB_SETTLE_MAX_MS', '7000'))));
  const settlePollMs = Math.max(120, Math.min(2000, Number(options.settlePollMs) || Number(env('MATCHPOINT_TAB_SETTLE_POLL_MS', '300'))));
  const settleStableHits = Math.max(2, Math.min(6, Number(options.settleStableHits) || Number(env('MATCHPOINT_TAB_SETTLE_STABLE_HITS', '2'))));

  const acq = await mpAcquirePage(baseUrl, username, password, diagnostic);
  const page = acq.page;
  let _opFailed = false;
  try {
    const tabCtx = await navigaFinoAlTabellone(page, diagnostic, baseUrl);

    // Estrae lo snapshot grezzo degli eventi (div.evento + roster da .eventoTexto2).
    // Identico all'estrazione inline storica: usato sia dal read normale sia dalla
    // diagnostica di stabilità, così misuriamo esattamente ciò che il cron legge.
    const snapshotEventi = () => tabCtx.evaluate(() => {
      return [...document.querySelectorAll('div.evento')].map((e) => {
        const testoEl = e.querySelector('.eventoTexto2');
        const testo = testoEl ? testoEl.innerHTML : '';
        const giocatori = testo
          .split(/<br\s*\/?>/i)
          .map((s) => s.replace(/<[^>]+>/g, '').trim())
          .filter(Boolean);
        // Manutenzione = chiusura campo. Matchpoint NON espone un id/classe/attributo dedicato (tutti
        // gli eventi sono "evento cursorNormal"). Richiediamo ENTRAMBI i segnali DETERMINISTICI
        // (verificati 19/06, coesistono sempre): il testo contiene "Manutenzione" (anche i blocchi con
        // nota tipo "STAGE SANTIAGO") E lo sfondo è il grigio esatto rgb(221,221,221) a canali uguali
        // (le prenotazioni reali hanno colori netti). L'AND elimina ogni falso positivo. Il testo è la nota.
        const fullText = (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim();
        let greyBlock = false;
        try {
          const bg = window.getComputedStyle(e).backgroundColor || '';
          const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          if (m) { const r = +m[1], g = +m[2], b = +m[3]; greyBlock = Math.abs(r - g) < 12 && Math.abs(g - b) < 12 && r >= 200 && r <= 235; }
        } catch (_e) {}
        const manutenzione = /manutenz/i.test(fullText) && greyBlock;
        // Nota manutenzione: testo senza orari e senza la parola "Manutenzione".
        const nota = manutenzione
          ? fullText.replace(/\d{1,2}[:.]\d{2}\s*[-–]?\s*\d{0,2}[:.]?\d{0,2}/g, ' ').replace(/manutenzione/ig, ' ').replace(/\s+/g, ' ').trim()
          : '';
        return {
          id: e.getAttribute('id') || e.id || '',
          idrecurso: e.getAttribute('idrecurso') || '',
          inicio: e.getAttribute('inicio') || '',
          fin: e.getAttribute('fin') || '',
          giocatori,
          manutenzione,
          nota,
        };
      });
    });
    const isRosterEv = (ev) => CAMPO_BY_RECURSO[Number(ev.idrecurso)] > 0;
    const evKey = (ev) => ev.id || `${ev.idrecurso}|${ev.inicio}|${ev.fin}`;

    // Legge gli eventi attendendo che il roster sia assestato, fondendo gli snapshot
    // con "fullest-wins". Ritorna la lista eventi più completa osservata nella finestra.
    const readEventiStable = async (isoDate) => {
      const best = new Map(); // key -> ev (con il roster più ricco visto)
      let lastSig = null;
      let stable = 0;
      let polls = 0;
      let improvedByMerge = 0;
      const t0 = Date.now();
      while (Date.now() - t0 < settleMaxMs) {
        const snap = await snapshotEventi().catch(() => []);
        polls++;
        for (const ev of snap) {
          const k = evKey(ev);
          const prev = best.get(k);
          if (!prev || ev.giocatori.length > prev.giocatori.length) {
            if (prev) improvedByMerge++;
            best.set(k, ev);
          }
        }
        const booked = snap.filter(isRosterEv);
        const sig = booked.map((ev) => `${evKey(ev)}:${ev.giocatori.length}`).sort().join('|');
        const allHaveRoster = booked.every((ev) => ev.giocatori.length >= 1);
        if (sig === lastSig) stable++; else { stable = 0; lastSig = sig; }
        // Esce presto quando la firma è stabile e ogni prenotazione ha un roster.
        if (booked.length > 0 && stable >= settleStableHits - 1 && allHaveRoster) break;
        // Esce comunque se la firma è molto stabile (giornata vuota o blocchi senza nomi).
        if (stable >= settleStableHits + 1) break;
        await page.waitForTimeout(settlePollMs);
      }
      const merged = [...best.values()];
      diagnostic.settle = diagnostic.settle || {};
      diagnostic.settle[isoDate] = {
        polls,
        ms: Date.now() - t0,
        stabilized: stable >= settleStableHits - 1,
        improvedByMerge,
        bookedEvents: merged.filter(isRosterEv).length,
      };
      return merged;
    };

    for (const isoDate of dates) {
      diagnostic.steps.push(`read_tabellone:${isoDate}`);
      try {
        await impostaDataTabellone(tabCtx, page, isoDate, diagnostic);

        if (debugStability > 0) {
          const samples = [];
          for (let s = 0; s < debugStability; s++) {
            samples.push(await snapshotEventi().catch(() => []));
            if (s < debugStability - 1) await page.waitForTimeout(stabilityGapMs);
          }
          // Traccia, per ogni evento prenotato, il numero di nomi visto in ciascun sample.
          const byKey = {};
          for (const snap of samples) {
            for (const ev of snap) {
              if (!isRosterEv(ev)) continue;
              const k = ev.id || `${ev.idrecurso}|${ev.inicio}`;
              (byKey[k] = byKey[k] || []).push(ev.giocatori.length);
            }
          }
          const changed = Object.entries(byKey).filter(([, ns]) => new Set(ns).size > 1);
          diagnostic.stability = diagnostic.stability || {};
          diagnostic.stability[isoDate] = {
            samples: samples.length,
            gapMs: stabilityGapMs,
            perSampleEventCount: samples.map((s) => s.filter(isRosterEv).length),
            perSampleTotalNames: samples.map((s) => s.reduce((a, ev) => a + (isRosterEv(ev) ? ev.giocatori.length : 0), 0)),
            eventsTracked: Object.keys(byKey).length,
            eventsRosterChanged: changed.length,
            changedSample: changed.slice(0, 25).map(([k, ns]) => ({ key: k, rosterCounts: ns })),
          };
        }

        const eventi = await readEventiStable(isoDate);
        result[isoDate] = eventi
          .map((ev) => ({
            id: ev.id || '',
            campo: CAMPO_BY_RECURSO[Number(ev.idrecurso)] || 0,
            ora: padOraHHMM(ev.inicio),
            oraFine: padOraHHMM(ev.fin),
            giocatori: ev.giocatori,
            // Campi additivi (manutenzione import 2026-06-19): i consumatori che non li conoscono
            // li ignorano. Solo per i blocchi manutenzione (senza giocatori, solo nota).
            ...(ev.manutenzione ? { tipo: 'manutenzione', nota: ev.nota || '' } : {}),
          }))
          .filter((ev) => ev.campo > 0);
      } catch (err) {
        diagnostic.steps.push(`read_tabellone_error:${isoDate}:${err && err.message}`);
        result[isoDate] = [];
      }
    }
    diagnostic.finishedAt = new Date().toISOString();
  } catch (_e) {
    _opFailed = true;
    throw _e;
  } finally {
    await acq.release(_opFailed);
  }

  return { ok: true, result, diagnostic };
}

async function handleGetSlots(req, res) {
  requireWorkerAuth(req);
  const body = await readBody(req);
  const result = await getSlotsWithBrowser(body);
  json(res, 200, result);
}

// Quante date legge ogni job read-tabellone. Letture multi-giorno (il sync ~22 date,
// ~32s) vengono spezzate in più job low-priority così le op interattive si infilano TRA
// un chunk e l'altro (attesa max ~1 chunk invece dell'intera lettura). Vedi mpQueuePump.
// Il caso peggiore di attesa per un'op interattiva ≈ chunkSize × settleMaxMs (~7s/data):
// con chunk=2 → ~14-16s anche se ogni data del chunk tarda ad assestarsi (misurato live:
// un chunk da 4 date "lente" arrivava a ~35s e una cancel ci finiva dietro).
const MP_READ_TAB_CHUNK = Math.max(1, Math.min(31, Number(env('MATCHPOINT_READ_TAB_CHUNK', '2'))));

async function handleReadTabellone(req, res) {
  requireWorkerAuth(req);
  const body = await readBody(req);
  // Serializzato come le altre operazioni browser: /read-tabellone usa la stessa
  // sessione warm condivisa (_mpWarm.page); senza coda, due read sovrapposti (o un
  // read + poller/edit) pilotano la stessa pagina insieme → cambi data incrociati e
  // roster parziali/scambiati (causa #1 del "lampeggio" dei nomi). La coda con
  // concorrenza 1 garantisce che un read non condivida mai la pagina con un'altra op.
  const allDates = (Array.isArray(body.dates) ? body.dates : [body.date]).filter(Boolean);
  // CHUNKING (fix latenza BUG2): se ci sono più date della soglia, spezza in job
  // separati ed esegui in sequenza. Ogni chunk è un job a sé in coda → tra un chunk e
  // l'altro un'op interattiva (priorità più alta) viene servita prima del chunk
  // successivo. Risultato merge identico ({ 'YYYY-MM-DD': [...] }). Sotto soglia: 1 job.
  if (allDates.length > MP_READ_TAB_CHUNK) {
    const merged = {};
    const parts = [];
    for (let i = 0; i < allDates.length; i += MP_READ_TAB_CHUNK) {
      const slice = allDates.slice(i, i + MP_READ_TAB_CHUNK);
      const chunkBody = { ...body, dates: slice, date: undefined };
      // eslint-disable-next-line no-await-in-loop
      const r = await mpQueueRun(mpJobMeta('read-tabellone', chunkBody), () => mpReadRetry('read-tabellone', () => readTabelloneWithBrowser(chunkBody)));
      if (r && r.result) Object.assign(merged, r.result);
      if (r && r.diagnostic && r.diagnostic.settle) parts.push({ dates: slice, settle: r.diagnostic.settle });
    }
    return json(res, 200, { ok: true, result: merged, diagnostic: { flow: 'read_tabellone', chunked: allDates.length, chunkSize: MP_READ_TAB_CHUNK, parts } });
  }
  const result = await mpQueueRun(mpJobMeta('read-tabellone', body), () => mpReadRetry('read-tabellone', () => readTabelloneWithBrowser(body)));
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

async function handleCollectPayment(req, res) {
  requireWorkerAuth(req);
  const body = await readBody(req);
  // SCRITTURA NON-IDEMPOTENTE (denaro reale): nessun retry, a differenza delle letture.
  const result = await mpQueueRun(mpJobMeta('collect-payment', body), () => collectPaymentWithBrowser(body));
  json(res, 200, result);
}

async function handleVoidPayment(req, res) {
  requireWorkerAuth(req);
  const body = await readBody(req);
  // SCRITTURA NON-IDEMPOTENTE (storno, denaro reale): nessun retry.
  const result = await mpQueueRun(mpJobMeta('void-payment', body), () => voidPaymentWithBrowser(body));
  json(res, 200, result);
}

async function handleCorrectWallet(req, res) {
  requireWorkerAuth(req);
  const body = await readBody(req);
  // SCRITTURA NON-IDEMPOTENTE (storno borsellino, denaro reale): nessun retry.
  const result = await mpQueueRun(mpJobMeta('correct-wallet', body), () => correctWalletWithBrowser(body));
  json(res, 200, result);
}

async function handleUpdateClient(req, res) {
  requireWorkerAuth(req);
  const body = await readBody(req);
  const result = await mpQueueRun(mpJobMeta('client', body), () => updateClientWithBrowser(body));
  json(res, 200, result);
}

async function debugFindClientWithBrowser(options = {}) {
  const username = clean(options.username) || env('MATCHPOINT_USERNAME');
  const password = clean(options.password) || env('MATCHPOINT_PASSWORD');
  const codice = clean(options.codice || '');
  const baseUrl = clean(options.baseUrl) || env('MATCHPOINT_BASE_URL', DEFAULT_BASE_URL);
  if (!username || !password) throw fail('MATCHPOINT_WORKER_SECRETS_MISSING', 'Mancano credenziali Matchpoint.');
  const diagnostic = { mode: 'debug_find_client', codice, baseUrl, steps: [] };

  const browser = await chromium.launch({ headless: boolEnv('MATCHPOINT_HEADLESS', true), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  let page;
  try {
    const context = await browser.newContext({ acceptDownloads: false, locale: 'it-IT', timezoneId: 'Europe/Rome', viewport: { width: 1440, height: 900 }, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' });
    page = await context.newPage();
    page.setDefaultTimeout(12000);
    page.setDefaultNavigationTimeout(20000);

    diagnostic.steps.push('login');
    await page.goto(absoluteUrl(baseUrl, '/Login.aspx'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('#username, input[name="username"]').first().fill(username, { timeout: 20000 });
    await page.locator('#password, input[name="password"]').first().fill(password, { timeout: 20000 });
    const language = page.locator('select[name="ddlLenguaje"]');
    if (await language.count().catch(() => 0)) { await language.first().selectOption('it-IT', { timeout: 5000 }).catch(() => {}); }
    await Promise.all([
      page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {}),
      page.locator('#btnLogin, input[name="btnLogin"]').first().click({ timeout: 15000 }),
    ]);
    await page.waitForTimeout(2500);
    await maybeClickCashEnter(page, diagnostic);

    diagnostic.steps.push('goto_listado');
    await page.goto(absoluteUrl(baseUrl, '/clientes/Listadoclientes.aspx?pagesize=15'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    diagnostic.listadoUrl = page.url();
    diagnostic.listadoTitle = await page.title().catch(() => '');

    diagnostic.controls = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('input, select, button, a[onclick]').forEach((el) => {
        out.push({ tag: el.tagName, id: el.id || '', name: el.getAttribute('name') || '', type: el.getAttribute('type') || '', placeholder: el.getAttribute('placeholder') || '', text: (el.innerText || el.value || '').slice(0, 40) });
      });
      return out.slice(0, 200);
    }).catch(() => []);

    if (codice) {
      const searchSel = 'input[id*="buscar" i], input[id*="filtro" i], input[id*="search" i], input[id*="codigo" i], input[id*="texto" i], input[name*="buscar" i], input[name*="filtro" i]';
      const search = page.locator(searchSel).first();
      if (await search.count().catch(() => 0)) {
        diagnostic.steps.push('search_fill');
        await search.fill(codice, { timeout: 8000 }).catch(() => {});
        await search.press('Enter', { timeout: 5000 }).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        diagnostic.afterSearchUrl = page.url();
      } else {
        diagnostic.steps.push('search_field_not_found');
      }
    }

    diagnostic.rows = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('table tr').forEach((tr) => {
        const text = (tr.innerText || '').replace(/\s+/g, ' ').trim();
        if (!text) return;
        const hrefs = Array.from(tr.querySelectorAll('a')).map((a) => a.getAttribute('href') || a.getAttribute('onclick') || '').filter(Boolean);
        out.push({ text: text.slice(0, 200), hrefs });
      });
      return out.slice(0, 60);
    }).catch(() => []);

    return { ok: true, diagnostic };
  } catch (error) {
    if (error && error.code && error.diagnostic) throw error;
    throw fail('DEBUG_FIND_CLIENT_FAILED', (error && error.message) || String(error), diagnostic);
  } finally {
    await browser.close().catch(() => {});
  }
}

async function handleDebugFindClient(req, res) {
  requireWorkerAuth(req);
  const body = await readBody(req);
  const result = await mpQueueRun(mpJobMeta('debug', body), () => debugFindClientWithBrowser(body));
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

// ── updateClientWithBrowser: aggiorna i dati anagrafici di un cliente ESISTENTE
//    su Matchpoint. Il payload porta il `codice` visibile (4-6 cifre, = memberId
//    dell'app); va prima risolto nell'`id` interno usato dall'URL della Ficha.
//    NON crea: se il cliente non esiste ritorna CLIENT_NOT_FOUND.
//    I selettori del form di modifica usano lo stesso container FormView del
//    create (`CC_Datos_FormViewFicha_`) ma un WUC diverso e non documentato:
//    per questo si individuano i campi per SUFFISSO (TextBoxNombre, ...) invece
//    di assumere il prefisso `WUCDatosAltaCliente_` del create. ──
async function updateClientWithBrowser(options = {}) {
  const username = clean(options.username) || env('MATCHPOINT_USERNAME');
  const password = clean(options.password) || env('MATCHPOINT_PASSWORD');
  if (!username || !password) {
    throw fail('MATCHPOINT_WORKER_SECRETS_MISSING', 'Mancano credenziali Matchpoint nel worker.');
  }

  const client = options.client || {};
  const codice = clean(client.codice || client.memberId || '');
  if (!/^\d{3,6}$/.test(codice)) {
    throw fail('INVALID_CLIENT_CODICE', 'Codice Matchpoint (4-6 cifre) richiesto per aggiornare il cliente.', { codice });
  }
  const nome = clean(client.nome || client.firstName || '');
  const cognome = clean(client.cognome || client.surname || '');
  const telefono = clean(client.telefono || client.phone || '');
  const email = clean(client.email || '');
  const sessoRaw = clean(client.sesso || client.gender || '');
  const livelloRaw = (client.livello !== undefined ? client.livello : client.level);
  const hasLivello = !(livelloRaw === undefined || livelloRaw === null || String(livelloRaw).trim() === '');
  const livelloNum = hasLivello ? Number(livelloRaw) : NaN;
  const livelloStr = hasLivello && Number.isFinite(livelloNum) ? String(livelloNum).replace('.', ',') : '';

  // Sesso -> etichetta della select Matchpoint (vuoto = non toccare il campo).
  let sessoLabel = '';
  if (/^f|donna|female|mujer/i.test(sessoRaw)) sessoLabel = 'Donna';
  else if (/^m|uomo|male|hombre/i.test(sessoRaw)) sessoLabel = 'Uomo';

  const baseUrl = clean(options.baseUrl) || env('MATCHPOINT_BASE_URL', DEFAULT_BASE_URL);
  const diagnostic = {
    mode: 'update_client',
    codice, nome, cognome, telefono, email, sessoLabel, livello: livelloStr, baseUrl,
    startedAt: new Date().toISOString(),
    steps: [], updatedFields: [], skippedFields: [],
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
    await page.addInitScript(() => { window.confirm = () => true; });
    page.setDefaultTimeout(12000);
    page.setDefaultNavigationTimeout(20000);

    // ── Login (stessa sequenza di createClientWithBrowser) ──
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

    // ── Risoluzione codice -> id interno (riusa la ricerca lista clienti) ──
    // Il buscador Matchpoint NON cerca per "Codice" (solo Cliente / Telefono /
    // E-mail / Carta). Cerco quindi per un valore noto e identifico la riga giusta
    // dal CODICE. Se l'utente ha appena cambiato email/telefono, il valore NUOVO non
    // esiste ancora su Matchpoint: provo una CASCATA di termini (anche i valori
    // VECCHI, passati da client.prev) finche' uno fa comparire la riga col codice.
    const prev = (client.prev && typeof client.prev === 'object') ? client.prev : {};
    const prevEmail = clean(prev.email || '');
    const prevTelefono = clean(prev.telefono || prev.phone || '');
    const prevCognome = clean(prev.cognome || prev.surname || '');

    // Termini in ordine di affidabilita': email/telefono danno risultato UNICO (match
    // sicuro anche senza codice visibile) -> acceptSingle. Cognome/nome possono dare
    // omonimi -> accetto solo il match esatto sul codice (code_token).
    const searchPlan = [
      { by: 'E-mail', val: email, acceptSingle: true },
      { by: 'Telefono cellulare', val: telefono, acceptSingle: true },
      { by: 'E-mail', val: prevEmail, acceptSingle: true },
      { by: 'Telefono cellulare', val: prevTelefono, acceptSingle: true },
      { by: 'Cliente', val: cognome || nome, acceptSingle: false },
      { by: 'Cliente', val: prevCognome, acceptSingle: false },
    ];
    // Dedup (stesso by+val) e scarta i termini vuoti.
    const seenTerms = new Set();
    const attempts = [];
    for (const a of searchPlan) {
      const v = clean(a.val);
      if (!v) continue;
      const key = `${a.by}|${v.toLowerCase()}`;
      if (seenTerms.has(key)) continue;
      seenTerms.add(key);
      attempts.push({ by: a.by, val: v, acceptSingle: a.acceptSingle });
    }

    // Esegue UNA ricerca e prova a risolvere l'id interno dal codice. Non lancia.
    // Ritorna { id, onFicha, how }: id='' se questo termine non individua il cliente.
    const trySearch = async (by, val, acceptSingle) => {
      await page.goto(absoluteUrl(baseUrl, '/clientes/Listadoclientes.aspx?pagesize=15'), { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      const optSel = page.locator('#CC_ContentPlaceHolderBuscador_DropDownListOpcionesBusqueda, select[id$="DropDownListOpcionesBusqueda"]').first();
      if (await optSel.count().catch(() => 0)) {
        await optSel.selectOption({ label: by }, { timeout: 5000 }).catch(() => {});
      }
      const valBox = page.locator('#CC_ContentPlaceHolderBuscador_TextBoxValorBusqueda, input[id$="TextBoxValorBusqueda"]').first();
      if (!(await valBox.count().catch(() => 0))) return { id: '', onFicha: false, how: 'search_field_not_found' };
      await valBox.fill(String(val), { timeout: 8000 }).catch(() => {});
      const btnBuscar = page.locator('#CC_ContentPlaceHolderBuscador_ImageButtonBuscar, input[id$="ImageButtonBuscar"]').first();
      if (await btnBuscar.count().catch(() => 0)) {
        await Promise.all([
          page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {}),
          btnBuscar.click({ timeout: 8000 }).catch(() => {}),
        ]);
      } else {
        await Promise.all([
          page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {}),
          valBox.press('Enter', { timeout: 5000 }).catch(() => {}),
        ]);
      }
      await page.waitForTimeout(1200);

      const ss = await page.evaluate(() => ({
        bodySample: (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').trim().slice(0, 300),
      })).catch(() => ({ bodySample: '' }));

      // Risultato UNICO -> Matchpoint apre direttamente la FichaCliente. Verifico che
      // il codice della scheda coincida (evita di aggiornare un omonimo).
      const codNorm = String(codice).replace(/^0+/, '');
      const schedaMatch = String(ss.bodySample || '').match(/Scheda cliente\s*:\s*0*(\d{1,6})\s*-/i);
      const onFichaNow = /FichaCliente\.aspx/i.test(page.url()) || !!schedaMatch;
      if (onFichaNow) {
        const schedaCod = schedaMatch ? schedaMatch[1].replace(/^0+/, '') : '';
        if (schedaCod && schedaCod !== codNorm) {
          return { id: '', onFicha: false, how: `ficha_codice_mismatch(${schedaMatch[1]})` };
        }
        const idm = decodeURIComponent(page.url()).match(/[?&]id=(\d+)/i);
        return { id: idm ? idm[1] : '', onFicha: true, how: 'direct_ficha' };
      }

      const resolved = await page.evaluate((cod) => {
        const codNorm = String(cod).replace(/^0+/, '');
        const matchId = (str) => {
          const s2 = decodeURIComponent(String(str || ''));
          let m = s2.match(/gotoClient\((\d+)\)/i); if (m) return m[1];
          m = s2.match(/[?&]id=(\d+)/i); if (m) return m[1];
          return '';
        };
        const rowAnchors = (tr) => [...tr.querySelectorAll('a')].map((a) => a.getAttribute('href') || a.getAttribute('onclick') || '');
        const rows = [...document.querySelectorAll('table tr')];
        const candidates = [];
        for (const tr of rows) {
          const text = (tr.innerText || '').replace(/\s+/g, ' ').trim();
          if (!text) continue;
          let id = '';
          for (const h of rowAnchors(tr)) { id = matchId(h); if (id) break; }
          if (!id) continue;
          const codeHit = text.split(' ').some((t) => {
            const tn = t.replace(/\D/g, '');
            return tn && (tn === String(cod) || tn.replace(/^0+/, '') === codNorm);
          });
          candidates.push({ id, codeHit });
        }
        // code_token affidabile SOLO se UNA sola riga (id distinto) contiene il codice:
        // con codici corti (es. "000004" -> "4") un "4" qualsiasi in un'altra riga creava
        // falsi match. Se piu' righe "matchano" il codice -> ambiguo, non indovinare.
        const hitIds = [...new Set(candidates.filter((c) => c.codeHit).map((c) => c.id))];
        if (hitIds.length === 1) return { id: hitIds[0], how: 'code_token', rows: rows.length, candidates: candidates.length };
        if (hitIds.length > 1) return { id: '', how: 'ambiguous_code', rows: rows.length, candidates: candidates.length };
        const uniqueIds = [...new Set(candidates.map((c) => c.id))];
        if (uniqueIds.length === 1) return { id: uniqueIds[0], how: 'single_candidate', rows: rows.length, candidates: candidates.length };
        return { id: '', how: candidates.length ? 'ambiguous' : 'no_candidate', rows: rows.length, candidates: candidates.length };
      }, codice).catch(() => ({ id: '', how: 'eval_error', rows: 0, candidates: 0 }));

      // code_token = match esatto sul codice -> sempre valido. single_candidate
      // (risultato unico senza codice visibile) accettato solo per termini univoci
      // (email/telefono); per cognome/nome verrebbe scartato per evitare omonimi.
      if (resolved.how === 'code_token') return { id: resolved.id, onFicha: false, how: resolved.how };
      if (resolved.how === 'single_candidate' && acceptSingle) return { id: resolved.id, onFicha: false, how: resolved.how };
      return { id: '', onFicha: false, how: resolved.how };
    };

    diagnostic.steps.push('resolve_codice');
    diagnostic.attempts = [];
    let idInterno = '';
    let onFichaNow = false;
    let resolvedOk = false;
    const codNormTarget = String(codice).replace(/^0+/, '');
    const readFichaCodice = () => page.evaluate(() => {
      const t = (document.body ? document.body.innerText : '');
      const m = t.match(/Scheda cliente\s*:\s*0*(\d{1,6})\s*-/i);
      return m ? m[1] : '';
    }).catch(() => '');
    for (const a of attempts) {
      const r = await trySearch(a.by, a.val, a.acceptSingle);
      const att = { by: a.by, how: r.how, id: r.id || '' };
      diagnostic.attempts.push(att);
      if (!(r.id || r.onFicha)) continue;
      if (r.onFicha) {
        // trySearch ha gia' verificato il codice inline (schedaMatch) prima di tornare onFicha.
        idInterno = r.id || ''; onFichaNow = true; resolvedOk = true;
        diagnostic.resolve = { how: r.how, by: a.by, id: idInterno };
        break;
      }
      // id risolto da una LISTA (code_token/single_candidate): il match sul testo puo'
      // agganciare la riga SBAGLIATA. Carico la Ficha e VERIFICO il codice; se non
      // coincide NON mi fermo: provo il termine di ricerca successivo (telefono/email/
      // cognome, anche i valori 'prev'). Cosi' un mismatch transitorio si auto-corregge
      // invece di dare CLIENT_NOT_FOUND.
      await page.goto(absoluteUrl(baseUrl, `/Clientes/FichaCliente.aspx?id=${encodeURIComponent(r.id)}`), { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      const cod = await readFichaCodice();
      if (cod && cod.replace(/^0+/, '') !== codNormTarget) {
        att.rejected = `codice_diverso(${cod})`;
        continue; // scheda sbagliata: prova il termine successivo
      }
      // Codice giusto (o non leggibile -> best-effort come prima): accetto, gia' sulla Ficha.
      idInterno = r.id; onFichaNow = true; resolvedOk = true;
      diagnostic.resolve = { how: r.how, by: a.by, id: idInterno };
      break;
    }
    diagnostic.idInterno = idInterno;
    diagnostic.afterSearchUrl = page.url();
    if (!resolvedOk) {
      throw fail('CLIENT_NOT_FOUND', `Cliente con codice ${codice} non trovato in Matchpoint (tentativi=${diagnostic.attempts.length}).`, diagnostic);
    }
    if (!onFichaNow && idInterno) {
      diagnostic.steps.push('goto_ficha');
      await page.goto(absoluteUrl(baseUrl, `/Clientes/FichaCliente.aspx?id=${encodeURIComponent(idInterno)}`), { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    }
    diagnostic.fichaUrl = page.url();

    // ── Verifica DEFINITIVA del codice sulla scheda aperta, prima di scrivere ──
    // Rete di sicurezza anti-omonimo valida per OGNI percorso di risoluzione (anche
    // single_candidate su email/telefono NUOVI, che potrebbero appartenere a un ALTRO
    // cliente gia' esistente in Matchpoint): leggo "Scheda cliente : <codice>" dalla
    // ficha e confronto. Se il codice e' leggibile e NON coincide, rifiuto la scrittura.
    // Se non e' leggibile (locale/markup diverso) procedo (best-effort, come prima).
    const fichaCod = await page.evaluate(() => {
      const t = (document.body ? document.body.innerText : '');
      const m = t.match(/Scheda cliente\s*:\s*0*(\d{1,6})\s*-/i);
      return m ? m[1] : '';
    }).catch(() => '');
    diagnostic.fichaCodice = fichaCod;
    if (fichaCod && fichaCod.replace(/^0+/, '') !== String(codice).replace(/^0+/, '')) {
      throw fail('CLIENT_NOT_FOUND', `Scheda trovata ma con codice diverso (${fichaCod} != ${codice}): nessuna scrittura per non aggiornare un omonimo.`, diagnostic);
    }

    // Localizza un controllo per suffisso: prima dentro il FormView, poi globale.
    const locateBySuffix = async (suffix) => {
      const scoped = page.locator(`[id^="CC_Datos_FormViewFicha_"][id$="${suffix}"]`).first();
      if (await scoped.count().catch(() => 0)) return scoped;
      const loose = page.locator(`[id$="${suffix}"]`).first();
      if (await loose.count().catch(() => 0)) return loose;
      return null;
    };
    const fillSuffix = async (suffix, value, label) => {
      if (value === '' || value == null) { diagnostic.skippedFields.push(label || suffix); return; }
      const loc = await locateBySuffix(suffix);
      if (!loc) { diagnostic.steps.push(`field_not_found:${suffix}`); return; }
      try {
        await loc.fill(String(value), { timeout: 10000 });
      } catch {
        // fallback: imposta il valore via DOM e notifica i listener ASP.NET
        await loc.evaluate((el, v) => {
          el.value = v;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }, String(value)).catch(() => {});
      }
      diagnostic.updatedFields.push(label || suffix);
    };

    await fillSuffix('TextBoxNombre', nome, 'nome');
    await fillSuffix('TextBoxApellido1', cognome, 'cognome');
    await fillSuffix('TextBoxMovil', telefono, 'telefono');
    await fillSuffix('TextBoxEmail', email, 'email');

    if (sessoLabel) {
      const sel = await locateBySuffix('DropDownListSexo');
      if (sel) {
        await sel.selectOption({ label: sessoLabel }, { timeout: 5000 }).catch(() => {});
        diagnostic.updatedFields.push('sesso');
      } else {
        diagnostic.steps.push('field_not_found:DropDownListSexo');
      }
    } else {
      diagnostic.skippedFields.push('sesso');
    }

    // Dump del form solo in caso di anomalia (nessun campo compilato): aiuta a
    // diagnosticare selettori diversi senza appesantire le risposte normali.
    if (!diagnostic.updatedFields.length) {
      try { diagnostic.formInputsDump = await dumpFormInputs(page); } catch {}
    }

    // ── Salva (bottone Actualizar della Ficha) ──
    diagnostic.steps.push('salva');
    await page.evaluate(() => { window.confirm = () => true; }).catch(() => {});
    page.once('dialog', async (dialog) => {
      diagnostic.dialogMessage = dialog.message();
      diagnostic.dialogType = dialog.type();
      await dialog.accept().catch(() => {});
    });
    await Promise.all([
      page.waitForLoadState('domcontentloaded', { timeout: 25000 }).catch(() => {}),
      page.evaluate(() => {
        const btn = document.getElementById('CC_Datos_FormViewFicha_ButtonActualizar')
          || document.querySelector('[id$="ButtonActualizar"]');
        if (btn && typeof btn.click === 'function') { btn.click(); return; }
        if (typeof window.__doPostBack === 'function') {
          window.__doPostBack('ctl01$ctl00$CC$Datos$FormViewFicha$ButtonActualizar', '');
        }
      }),
    ]);
    await page.waitForTimeout(2500);
    diagnostic.afterSaveUrl = page.url();

    // ── Verifica messaggi di validazione (errori dato) ──
    const vmsgs = await page.evaluate(() => {
      const sels = ['[id*="ValidationSummary"]', '.field-validation-error',
        'span[style*="color:Red"]', 'span[style*="color:red"]'];
      const out = [];
      for (const s of sels) {
        document.querySelectorAll(s).forEach((el) => {
          const t = (el.textContent || '').trim();
          if (t) out.push(t);
        });
      }
      return out.slice(0, 20);
    }).catch(() => []);
    diagnostic.validationMessages = vmsgs;
    const realErrors = vmsgs.filter((m) => m && m.replace(/\s+/g, '').length > 1);
    if (realErrors.length) {
      throw fail('CLIENT_UPDATE_VALIDATION', `Matchpoint ha rifiutato l'aggiornamento del cliente ${codice}.`, diagnostic);
    }

    // ── VERIFICA contatti: ricarico la Ficha e rileggo i campi per confermare che i
    // valori siano DAVVERO persistiti su Matchpoint (no falso "updatedFields", come
    // imparato col livello). verifiedFields = confermati; contactMismatches = scritti
    // ma non confermati (atteso vs trovato). ──
    try {
      if (idInterno) {
        await page.goto(absoluteUrl(baseUrl, `/Clientes/FichaCliente.aspx?id=${encodeURIComponent(idInterno)}`),
          { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(1200);
      }
      const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
      const readSuffixValue = async (suffix) => {
        const loc = await locateBySuffix(suffix);
        if (!loc) return null;
        return loc.evaluate((el) => (el.value != null ? el.value : (el.textContent || ''))).catch(() => null);
      };
      const checks = [
        { key: 'nome', suffix: 'TextBoxNombre', want: nome, cmp: (s) => norm(s) },
        { key: 'cognome', suffix: 'TextBoxApellido1', want: cognome, cmp: (s) => norm(s) },
        { key: 'telefono', suffix: 'TextBoxMovil', want: telefono, cmp: (s) => norm(s).replace(/[^\d+]/g, '') },
        { key: 'email', suffix: 'TextBoxEmail', want: email, cmp: (s) => norm(s).toLowerCase() },
      ];
      const verified = [];
      const mismatches = [];
      for (const c of checks) {
        if (!c.want) continue; // campo non inviato -> niente da verificare
        const got = await readSuffixValue(c.suffix);
        if (got == null) { diagnostic.steps.push('verify_missing:' + c.suffix); continue; }
        if (c.cmp(got) === c.cmp(c.want)) verified.push(c.key);
        else mismatches.push({ field: c.key, want: c.want, got: norm(got).slice(0, 80) });
      }
      // sesso: confronto la label dell'opzione selezionata nella select
      if (sessoLabel) {
        const sel = await locateBySuffix('DropDownListSexo');
        if (sel) {
          const got = await sel.evaluate((el) => {
            const o = el.options && el.options[el.selectedIndex];
            return o ? (o.text || o.value || '') : (el.value || '');
          }).catch(() => null);
          if (got != null) {
            if (norm(got).toLowerCase() === norm(sessoLabel).toLowerCase()) verified.push('sesso');
            else mismatches.push({ field: 'sesso', want: sessoLabel, got: norm(got).slice(0, 40) });
          }
        }
      }
      diagnostic.verifiedFields = verified;
      if (mismatches.length) diagnostic.contactMismatches = mismatches;
    } catch (_) { /* la verifica è best-effort: non deve far fallire l'update */ }

    // ── Aggiornamento livello ─────────────────────────────────────────────────
    // ATTENZIONE: per un cliente ESISTENTE il livello va MODIFICATO sulla riga gia'
    // presente. La pagina "Nuovo" (FichaDeportePracticaClienteDatosNivel?id_people)
    // funziona solo nel CREATE (cliente senza alcun livello): per chi ha gia' la riga
    // sport NON la tocca, quindi il livello restava invariato pur dando esito "ok"
    // (bug confermato live 23/06: app=4, Matchpoint restava 5). Qui:
    //  1) apro la tab "Livello" della Ficha aperta e leggo la griglia (arg "Editar$<id>");
    //  2) se la riga sport esiste -> lancio il postback "Editar$<id>#..." e compilo/salvo
    //     il campo livello (stessi controlli del create); se NON esiste -> fallback "Nuovo";
    //  3) VERIFICA OBBLIGATORIA: rileggo la griglia. 'livello' va in updatedFields SOLO
    //     se il valore e' davvero cambiato, altrimenti levelError reale (niente falso ok).
    if (hasLivello && livelloStr) {
      const GRID_PB = 'ctl01$ctl00$CC$Datos$FormViewFicha$GridViewListadoDeportes';
      const L = '#CC_Datos_FormViewFicha_WUCDeportePraticaClienteEdicionNivel_';
      const livelloNumTarget = Number(String(livelloStr).replace(',', '.'));
      const GRID_SEL = '[id$="GridViewListadoDeportes"]';
      // Restituisce il frame che contiene la griglia livelli (la Ficha potrebbe essere
      // in un iframe; il postback Editar va lanciato nel frame giusto).
      const findGridFrame = async () => {
        for (const fr of page.frames()) {
          try { if (await fr.locator(GRID_SEL).count().catch(() => 0)) return fr; } catch (_) {}
        }
        return null;
      };
      // La sezione "Livelli" si renderizza SOLO dentro la shell default.aspx (iframe
      // #iframeContenido). Carico li' la Ficha via navIframe e opero DENTRO quel frame.
      const fichaFrame = () => page.frames().find((f) => /FichaCliente\.aspx/i.test(f.url())) || null;
      const loadFichaInShell = async (id) => {
        await page.goto(absoluteUrl(baseUrl, '/default.aspx'), { waitUntil: 'domcontentloaded', timeout: 25000 });
        await page.waitForTimeout(1200);
        await page.evaluate((cid) => {
          const url = 'Clientes/FichaCliente.aspx?id=' + cid;
          if (typeof navIframe === 'function') { try { navIframe(url); return; } catch (_) {} }
          const f = document.getElementById('iframeContenido');
          if (f) f.src = url;
        }, id).catch(() => {});
        // attendi che il frame Ficha esista e abbia caricato (menu "Livelli" presente)
        for (let i = 0; i < 30; i++) {
          const fr = fichaFrame();
          if (fr) {
            const ok = await fr.locator('a:has-text("Livelli"), a:has-text("Livello")').count().catch(() => 0);
            if (ok) { await page.waitForTimeout(400); return fr; }
          }
          await page.waitForTimeout(700);
        }
        return fichaFrame();
      };
      const gridInFrame = async () => {
        const f = fichaFrame();
        if (!f) return false;
        return (await f.locator(`${GRID_SEL}, [onclick*="Editar$"]`).count().catch(() => 0)) > 0;
      };
      // Apre la sezione Livelli DENTRO il frame Ficha. Prima un CLICK REALE (trusted) come
      // fa il mouse dell'utente, poi __doPostBack estratto come fallback.
      const openLivelloInFrame = async () => {
        const fr = fichaFrame();
        if (!fr) return false;
        // metodo 1: click reale Playwright sull'anchor "Livelli" del frame
        try {
          const link = fr.locator('a').filter({ hasText: /^\s*Livelli\s*$/ }).first();
          if (await link.count().catch(() => 0)) await link.click({ timeout: 6000 });
        } catch (_) {}
        await page.waitForTimeout(2800);
        if (await gridInFrame()) return true;
        // metodo 2 (fallback): __doPostBack dell'anchor "Livelli" estratto, dentro il frame
        await (async () => {
          const f = fichaFrame();
          if (!f) return;
          await f.evaluate(() => {
            const a = Array.from(document.querySelectorAll('a'))
              .find((x) => (x.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() === 'livelli');
            if (!a) return;
            const h = a.getAttribute('href') || a.getAttribute('onclick') || '';
            const m = h.match(/__doPostBack\('([^']+)'\s*,\s*'([^']*)'\)/);
            if (m && typeof window.__doPostBack === 'function') { window.__doPostBack(m[1], m[2]); return; }
            a.click();
          }).catch(() => {});
        })();
        await page.waitForTimeout(2800);
        return await gridInFrame();
      };
      // Legge le righe della griglia livelli da QUALSIASI frame:
      // { sport, livelloNum, arg("<id>#<people>#<sport>") }. Ritorna null se la griglia
      // NON e' leggibile (per non fare un ADD alla cieca che creerebbe un duplicato),
      // [] se trovata ma senza righe.
      const readLivelloRows = async () => {
        for (const fr of page.frames()) {
          try {
            const res = await fr.evaluate((sel) => {
              const grid = document.querySelector(sel);
              if (!grid) return null;
              const out = [];
              grid.querySelectorAll('tr').forEach((tr) => {
                const tds = tr.querySelectorAll('td');
                if (tds.length < 2) return;
                const editBtn = tr.querySelector('[onclick*="Editar$"]');
                const m = editBtn ? (editBtn.getAttribute('onclick') || '').match(/Editar\$([^']+)/) : null;
                const sport = (tds[0].innerText || '').replace(/\s+/g, ' ').trim();
                const lvlTxt = (tds[1].innerText || '').replace(/\s+/g, ' ').trim();
                const lvlNum = parseFloat(lvlTxt.replace(',', '.').replace(/[^\d.]/g, ''));
                out.push({ sport, lvlTxt, lvlNum: Number.isFinite(lvlNum) ? lvlNum : null, arg: m ? m[1] : '' });
              });
              return out;
            }, GRID_SEL);
            if (res) return res;
          } catch (_) { /* prova frame successivo */ }
        }
        return null;
      };
      // Cerca il campo livello in QUALSIASI frame (inline o popup) e lo salva.
      const fillAndSaveLivello = async () => {
        for (const fr of page.frames()) {
          try {
            let field = fr.locator(L + 'TextBoxNivelNumerico').first();
            if (!(await field.count().catch(() => 0))) field = fr.locator('[id$="TextBoxNivelNumerico"]').first();
            if (!(await field.count().catch(() => 0))) continue;
            await field.fill(livelloStr, { timeout: 10000 });
            diagnostic.steps.push('salva_livello');
            const saveBtn = fr.locator(L + 'ButtonActualizar, #CC_Datos_FormViewFicha_ButtonActualizar, [id$="ButtonActualizar"]').first();
            await Promise.all([
              page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => {}),
              saveBtn.click({ timeout: 15000 }).catch(() => {}),
            ]);
            await page.waitForTimeout(1800);
            return true;
          } catch (_) { /* prova il frame successivo */ }
        }
        diagnostic.steps.push('field_not_found:TextBoxNivelNumerico');
        return false;
      };
      try {
        diagnostic.steps.push('shell_load_ficha');
        await loadFichaInShell(idInterno);
        await openLivelloInFrame();
        const rows = await readLivelloRows();
        diagnostic.livelloRows = rows;
        const target = Array.isArray(rows)
          ? (rows.find((r) => /padel/i.test(r.sport) && r.arg) || rows.find((r) => r.arg) || null)
          : null;

        // Apre il form di modifica della riga. Come per il tab "Livelli", il postback
        // programmatico (__doPostBack) NON basta: serve un CLICK REALE sulla matita
        // "Editar" (trusted), con fallback al __doPostBack. Poi attende che il campo
        // TextBoxNivelNumerico compaia (AJAX) prima di compilarlo.
        const openEditRow = async (arg) => {
          const gf = (await findGridFrame()) || fichaFrame() || page.mainFrame();
          // metodo 1: click reale sull'elemento con onclick Editar$<arg> (matita)
          try {
            const pencil = gf.locator(`[onclick*="Editar$${arg}"]`).first();
            if (await pencil.count().catch(() => 0)) await pencil.click({ timeout: 6000 });
          } catch (_) {}
          // metodo 2: fallback __doPostBack nel frame della griglia
          await page.waitForTimeout(800);
          await gf.evaluate(({ pb, a }) => {
            if (!document.querySelector('[id$="TextBoxNivelNumerico"]') && typeof window.__doPostBack === 'function') {
              window.__doPostBack(pb, 'Editar$' + a);
            }
          }, { pb: GRID_PB, a: arg }).catch(() => {});
          // attendi la comparsa del campo livello in QUALSIASI frame (max ~9s)
          for (let i = 0; i < 12; i++) {
            for (const fr of page.frames()) {
              try { if (await fr.locator('[id$="TextBoxNivelNumerico"]').count().catch(() => 0)) return true; } catch (_) {}
            }
            await page.waitForTimeout(750);
          }
          return false;
        };

        let attempted = false;
        if (target && target.arg) {
          diagnostic.steps.push('editar_riga:' + target.arg);
          await openEditRow(target.arg);
          attempted = await fillAndSaveLivello();
        } else if (Array.isArray(rows) && rows.length === 0 && idInterno) {
          // Griglia confermata VUOTA (nessun livello) -> AGGIUNGI (form "Nuovo", standalone).
          diagnostic.steps.push('aggiungi_livello');
          const livelloUrl = absoluteUrl(baseUrl,
            `/Clientes/FichaDeportePracticaClienteDatosNivel.aspx?id_people=${encodeURIComponent(idInterno)}`
            + `&cbf=callbackRefrescarPestanyaJuegoNivel`
            + `&return_url=${encodeURIComponent('/Clientes/FichaCliente.aspx?id=' + idInterno)}`);
          await page.goto(livelloUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
          attempted = await fillAndSaveLivello();
        } else {
          diagnostic.steps.push('skip_livello:griglia_non_letta_o_riga_assente');
        }

        // ── VERIFICA: ricarico la Ficha nella shell, riapro Livelli, rileggo la riga ──
        if (attempted) {
          await loadFichaInShell(idInterno);
          await openLivelloInFrame();
          const after = await readLivelloRows();
          diagnostic.livelloRowsAfter = after;
          const confirmed = Array.isArray(after) && after.some((r) => r.lvlNum != null && Math.abs(r.lvlNum - livelloNumTarget) < 0.001);
          if (confirmed) {
            diagnostic.updatedFields.push('livello');
            diagnostic.livelloVerified = true;
          } else {
            diagnostic.livelloVerified = false;
            diagnostic.levelError = `Livello NON confermato dopo il salvataggio (atteso ${livelloStr}); righe=${JSON.stringify(after).slice(0, 220)}`;
          }
        } else {
          diagnostic.levelError = diagnostic.levelError || 'Livello non salvato: riga/campo non trovati nella sezione Livelli.';
        }
      } catch (levelError) {
        diagnostic.livelloVerified = false;
        diagnostic.levelError = (levelError && levelError.message) || String(levelError);
      }
    }

    return {
      ok: true,
      message: `Cliente ${codice} aggiornato su Matchpoint`,
      codice,
      idInterno,
      nome,
      cognome,
      telefono,
      email,
      sesso: sessoLabel,
      livello: livelloStr,
      updatedFields: diagnostic.updatedFields,
      diagnostic,
    };
  } catch (error) {
    if (error && error.code && error.diagnostic) throw error;
    throw fail('CLIENT_UPDATE_FAILED', (error && error.message) || String(error), diagnostic);
  } finally {
    await browser.close().catch(() => {});
  }
}

// ── disableClientWithBrowser: DISISCRIVE un cliente su Matchpoint ─────────────
//    L'assistente può solo DISATTIVARE un socio (mai eliminarlo). Su Matchpoint la
//    disattivazione = bottone "Disiscrivere" sulla Ficha (NON "Bloccare", che è altro).
//    Riusa il login + la risoluzione codice→idInterno della Ficha (stesso approccio di
//    updateClientWithBrowser), poi clicca "Disiscrivere" e verifica in modo best-effort.
async function disableClientWithBrowser(options = {}) {
  const username = clean(options.username) || env('MATCHPOINT_USERNAME');
  const password = clean(options.password) || env('MATCHPOINT_PASSWORD');
  if (!username || !password) {
    throw fail('MATCHPOINT_WORKER_SECRETS_MISSING', 'Mancano credenziali Matchpoint nel worker.');
  }

  const client = options.client || {};
  const codice = clean(client.codice || client.memberId || '');
  if (!/^\d{3,6}$/.test(codice)) {
    throw fail('INVALID_CLIENT_CODICE', 'Codice Matchpoint (4-6 cifre) richiesto per disiscrivere il cliente.', { codice });
  }
  // Termini per ritrovare la scheda (il buscador NON cerca per Codice): email/telefono
  // danno match UNICO; cognome/nome possono avere omonimi (accettati solo se il codice combacia).
  const nome = clean(client.nome || client.firstName || '');
  const cognome = clean(client.cognome || client.surname || '');
  const telefono = clean(client.telefono || client.phone || '');
  const email = clean(client.email || '');

  const baseUrl = clean(options.baseUrl) || env('MATCHPOINT_BASE_URL', DEFAULT_BASE_URL);
  const diagnostic = {
    mode: 'disable_client',
    codice, nome, cognome, telefono, email, baseUrl,
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
    // Matchpoint può mettere un confirm() su "Disiscrivere": lo neutralizziamo.
    await page.addInitScript(() => { window.confirm = () => true; });
    page.setDefaultTimeout(12000);
    page.setDefaultNavigationTimeout(20000);

    // ── Login ──
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

    // ── Risoluzione codice → id interno (stessa cascata di updateClientWithBrowser) ──
    const trySearch = async (by, val, acceptSingle) => {
      await page.goto(absoluteUrl(baseUrl, '/clientes/Listadoclientes.aspx?pagesize=15'), { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      const optSel = page.locator('#CC_ContentPlaceHolderBuscador_DropDownListOpcionesBusqueda, select[id$="DropDownListOpcionesBusqueda"]').first();
      if (await optSel.count().catch(() => 0)) {
        await optSel.selectOption({ label: by }, { timeout: 5000 }).catch(() => {});
      }
      const valBox = page.locator('#CC_ContentPlaceHolderBuscador_TextBoxValorBusqueda, input[id$="TextBoxValorBusqueda"]').first();
      if (!(await valBox.count().catch(() => 0))) return { id: '', onFicha: false, how: 'search_field_not_found' };
      await valBox.fill(String(val), { timeout: 8000 }).catch(() => {});
      const btnBuscar = page.locator('#CC_ContentPlaceHolderBuscador_ImageButtonBuscar, input[id$="ImageButtonBuscar"]').first();
      if (await btnBuscar.count().catch(() => 0)) {
        await Promise.all([
          page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {}),
          btnBuscar.click({ timeout: 8000 }).catch(() => {}),
        ]);
      } else {
        await Promise.all([
          page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {}),
          valBox.press('Enter', { timeout: 5000 }).catch(() => {}),
        ]);
      }
      await page.waitForTimeout(1200);

      const ss = await page.evaluate(() => ({
        bodySample: (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').trim().slice(0, 300),
      })).catch(() => ({ bodySample: '' }));

      const codNorm = String(codice).replace(/^0+/, '');
      const schedaMatch = String(ss.bodySample || '').match(/Scheda cliente\s*:\s*0*(\d{1,6})\s*-/i);
      const onFichaNow = /FichaCliente\.aspx/i.test(page.url()) || !!schedaMatch;
      if (onFichaNow) {
        const schedaCod = schedaMatch ? schedaMatch[1].replace(/^0+/, '') : '';
        if (schedaCod && schedaCod !== codNorm) {
          return { id: '', onFicha: false, how: `ficha_codice_mismatch(${schedaMatch[1]})` };
        }
        const idm = decodeURIComponent(page.url()).match(/[?&]id=(\d+)/i);
        return { id: idm ? idm[1] : '', onFicha: true, how: 'direct_ficha' };
      }

      const resolved = await page.evaluate((cod) => {
        const codNorm = String(cod).replace(/^0+/, '');
        const matchId = (str) => {
          const s2 = decodeURIComponent(String(str || ''));
          let m = s2.match(/gotoClient\((\d+)\)/i); if (m) return m[1];
          m = s2.match(/[?&]id=(\d+)/i); if (m) return m[1];
          return '';
        };
        const rowAnchors = (tr) => [...tr.querySelectorAll('a')].map((a) => a.getAttribute('href') || a.getAttribute('onclick') || '');
        const rows = [...document.querySelectorAll('table tr')];
        const candidates = [];
        for (const tr of rows) {
          const text = (tr.innerText || '').replace(/\s+/g, ' ').trim();
          if (!text) continue;
          let id = '';
          for (const h of rowAnchors(tr)) { id = matchId(h); if (id) break; }
          if (!id) continue;
          const codeHit = text.split(' ').some((t) => {
            const tn = t.replace(/\D/g, '');
            return tn && (tn === String(cod) || tn.replace(/^0+/, '') === codNorm);
          });
          candidates.push({ id, codeHit });
        }
        const hit = candidates.find((c) => c.codeHit);
        if (hit) return { id: hit.id, how: 'code_token' };
        const uniqueIds = [...new Set(candidates.map((c) => c.id))];
        if (uniqueIds.length === 1) return { id: uniqueIds[0], how: 'single_candidate' };
        return { id: '', how: candidates.length ? 'ambiguous' : 'no_candidate' };
      }, codice).catch(() => ({ id: '', how: 'eval_error' }));

      if (resolved.how === 'code_token') return { id: resolved.id, onFicha: false, how: resolved.how };
      if (resolved.how === 'single_candidate' && acceptSingle) return { id: resolved.id, onFicha: false, how: resolved.how };
      return { id: '', onFicha: false, how: resolved.how };
    };

    const codNorm = String(codice).replace(/^0+/, '');
    const idInternoHint = clean(client.idInterno || client.matchpointIdInterno || '');
    const readFichaCodice = async () => page.evaluate(() => {
      const t = (document.body ? document.body.innerText : '');
      const m = t.match(/Scheda cliente\s*:\s*0*(\d{1,6})\s*-/i);
      return m ? m[1] : '';
    }).catch(() => '');
    const fichaMatchesCodice = (c) => !!c && c.replace(/^0+/, '') === codNorm;

    diagnostic.steps.push('resolve');
    diagnostic.attempts = [];
    let idInterno = '';
    let fichaCod = '';

    // ── Path A: id interno noto (matchpointIdInterno = id_people, l'analogo di idReserva
    //    per le prenotazioni) → DIRETTO alla Ficha, niente ricerca per email/telefono/
    //    cognome (che può beccare un omonimo). Accetto solo se il codice combacia. ──
    if (/^\d{2,9}$/.test(idInternoHint)) {
      diagnostic.steps.push('goto_ficha_by_id');
      await page.goto(absoluteUrl(baseUrl, `/Clientes/FichaCliente.aspx?id=${encodeURIComponent(idInternoHint)}`), { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      const cod = await readFichaCodice();
      diagnostic.attempts.push({ by: 'id_interno', id: idInternoHint, fichaCod: cod });
      if (fichaMatchesCodice(cod)) { idInterno = idInternoHint; fichaCod = cod; diagnostic.resolve = { how: 'id_hint', id: idInterno }; }
    }

    // ── Path B (fallback): ricerca, ma con VERIFICA del codice sulla Ficha per OGNI
    //    candidato: se non combacia provo il termine successivo (niente abort sull'omonimo,
    //    niente single_candidate accettato alla cieca). Cognome per primo (espone il codice). ──
    if (!idInterno) {
      const searchPlan = [
        { by: 'Cliente', val: cognome || nome, acceptSingle: false },
        { by: 'E-mail', val: email, acceptSingle: true },
        { by: 'Telefono cellulare', val: telefono, acceptSingle: true },
      ];
      const seenTerms = new Set();
      for (const a of searchPlan) {
        const v = clean(a.val);
        if (!v) continue;
        const key = `${a.by}|${v.toLowerCase()}`;
        if (seenTerms.has(key)) continue;
        seenTerms.add(key);
        const r = await trySearch(a.by, a.val, a.acceptSingle);
        let cod = '';
        if (r.onFicha) {
          cod = await readFichaCodice();
        } else if (r.id) {
          await page.goto(absoluteUrl(baseUrl, `/Clientes/FichaCliente.aspx?id=${encodeURIComponent(r.id)}`), { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
          await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
          cod = await readFichaCodice();
        }
        diagnostic.attempts.push({ by: a.by, how: r.how, id: r.id || '', fichaCod: cod });
        if ((r.id || r.onFicha) && fichaMatchesCodice(cod)) {
          idInterno = r.id || '';
          if (!idInterno) { const mm = decodeURIComponent(page.url()).match(/[?&]id=(\d+)/i); if (mm) idInterno = mm[1]; }
          fichaCod = cod;
          diagnostic.resolve = { how: r.how, by: a.by, id: idInterno };
          break;
        }
      }
    }

    diagnostic.idInterno = idInterno;
    diagnostic.fichaCodice = fichaCod;
    diagnostic.fichaUrl = page.url();
    if (!idInterno || !fichaMatchesCodice(fichaCod)) {
      throw fail('CLIENT_NOT_FOUND', `Cliente con codice ${codice} non trovato in Matchpoint (tentativi=${diagnostic.attempts.length}).`, diagnostic);
    }

    // Legge lo stato della Ficha: bottoni (Disiscrivere/Riattivare), valore della select
    // "Stato" (Iscrizione/Disiscrizione) e "Data disiscrizione". Usato prima e dopo.
    const readFichaState = async () => page.evaluate(() => {
      const buttons = [...document.querySelectorAll('a, input[type="submit"], input[type="button"], button')]
        .map((el) => (el.innerText || el.value || '').trim()).filter(Boolean);
      const hasDisiscrivi = buttons.some((b) => /disiscriv/i.test(b));
      const hasRiattiva = buttons.some((b) => /riattiv/i.test(b));
      // "Stato": testo dell'opzione selezionata della select che contiene Iscrizione/Disiscrizione.
      let stato = '';
      const sel = [...document.querySelectorAll('select')].find((s) => {
        const t = ((s.options[s.selectedIndex] || {}).text || '');
        return /\b(Iscrizione|Disiscrizione)\b/i.test(t);
      });
      if (sel) stato = ((sel.options[sel.selectedIndex] || {}).text || '').trim();
      // "Data disiscrizione": input con id/name che richiama la disiscrizione/baja, valorizzato.
      const dataDisInput = [...document.querySelectorAll('input')]
        .find((el) => /disiscriz|baja|fechabaja/i.test((el.id || '') + '|' + (el.name || '')));
      const dataDis = dataDisInput ? (dataDisInput.value || '').trim() : '';
      return { hasDisiscrivi, hasRiattiva, stato, dataDis, buttons: buttons.slice(0, 30) };
    }).catch(() => ({ hasDisiscrivi: false, hasRiattiva: false, stato: '', dataDis: '', buttons: [] }));

    // ── Stato PRIMA (idempotenza): se la Ficha mostra "Riattivare" (e non "Disiscrivere")
    //    il cliente è GIÀ disiscritto → niente da fare. ──
    const before = await readFichaState();
    diagnostic.before = before;
    if (before.hasRiattiva && !before.hasDisiscrivi) {
      return { ok: true, alreadyDisabled: true, message: `Cliente ${codice} risulta già disiscritto su Matchpoint.`, codice, idInterno, diagnostic };
    }
    if (!before.hasDisiscrivi) {
      throw fail('DISISCRIVI_BUTTON_NOT_FOUND', 'Bottone "Disiscrivere" non trovato sulla scheda cliente.', diagnostic);
    }

    // Click su un bottone/anchor il cui testo inizia per "disiscriv" (NON "Annullare").
    const clickByText = async (reSrc) => page.evaluate((src) => {
      const rx = new RegExp(src, 'i');
      const els = [...document.querySelectorAll('a, input[type="submit"], input[type="button"], button')];
      for (const el of els) {
        const t = (el.innerText || el.value || '').trim();
        if (t && rx.test(t) && typeof el.click === 'function') { el.click(); return { clicked: true, text: t, tag: el.tagName, id: el.id || '' }; }
      }
      return { clicked: false };
    }, reSrc).catch((e) => ({ clicked: false, error: String(e) }));

    // ── Step 1: "Disiscrivere" sulla Ficha → apre la "Scheda disiscrizione cliente" ──
    diagnostic.steps.push('click_disiscrivere_ficha');
    await page.evaluate(() => { window.confirm = () => true; }).catch(() => {});
    const c1 = await clickByText('^\\s*disiscriv');
    diagnostic.click1 = c1;
    if (!c1.clicked) throw fail('DISISCRIVI_BUTTON_NOT_FOUND', 'Bottone "Disiscrivere" non trovato sulla scheda cliente.', diagnostic);
    await page.waitForLoadState('domcontentloaded', { timeout: 25000 }).catch(() => {});
    await page.waitForFunction(() => /scheda\s+disiscrizione\s+cliente/i.test(document.body ? document.body.innerText : ''), { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(1000);
    diagnostic.afterClick1Url = page.url();
    const onForm = await page.evaluate(() => /scheda\s+disiscrizione\s+cliente/i.test(document.body ? document.body.innerText : '')).catch(() => false);
    diagnostic.onDisiscrizioneForm = onForm;
    if (!onForm) throw fail('DISISCRIVI_FORM_NOT_FOUND', 'La "Scheda disiscrizione cliente" non si è aperta dopo il click su Disiscrivere.', diagnostic);

    // ── Step 2: conferma con "Disiscrivere" sul form (NON "Annullare"). Compare poi un
    //    popup "Disiscrizione effettuata" che si chiude DA SOLO → non va cliccato, solo atteso. ──
    diagnostic.steps.push('confirm_disiscrivere_form');
    page.once('dialog', async (dialog) => { diagnostic.dialogMessage = dialog.message(); await dialog.accept().catch(() => {}); });
    const c2 = await clickByText('^\\s*disiscriv');
    diagnostic.click2 = c2;
    if (!c2.clicked) throw fail('DISISCRIVI_CONFIRM_NOT_FOUND', 'Bottone di conferma "Disiscrivere" non trovato sul form di disiscrizione.', diagnostic);
    await page.waitForLoadState('domcontentloaded', { timeout: 25000 }).catch(() => {});
    await page.waitForFunction(() => /disiscrizione\s+effettuata/i.test(document.body ? document.body.innerText : ''), { timeout: 10000 })
      .then(() => { diagnostic.successPopup = true; }).catch(() => { diagnostic.successPopup = false; });
    await page.waitForTimeout(3000);

    // ── Verifica DEFINITIVA: ricarico la Ficha e controllo lo stato reale ──
    diagnostic.steps.push('verify_reload_ficha');
    await page.goto(absoluteUrl(baseUrl, `/Clientes/FichaCliente.aspx?id=${encodeURIComponent(idInterno)}`), { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    const after = await readFichaState();
    diagnostic.after = after;
    const verified = after.hasRiattiva || /disiscriz/i.test(after.stato) || (!!after.dataDis && !before.dataDis);
    diagnostic.verified = verified;
    if (!verified) {
      // Niente più falsi positivi: se la scheda risulta ancora iscritta, è un errore.
      throw fail('CLIENT_DISABLE_NOT_CONFIRMED', `Disiscrizione cliente ${codice} non confermata: la scheda risulta ancora iscritta dopo l'operazione.`, diagnostic);
    }

    return {
      ok: true,
      message: `Cliente ${codice} disiscritto su Matchpoint`,
      codice,
      idInterno,
      verified: true,
      diagnostic,
    };
  } catch (error) {
    if (error && error.code && error.diagnostic) throw error;
    throw fail('CLIENT_DISABLE_FAILED', (error && error.message) || String(error), diagnostic);
  } finally {
    await browser.close().catch(() => {});
  }
}

async function handleDisableClient(req, res) {
  requireWorkerAuth(req);
  const body = await readBody(req);
  const codice = clean((body.client && body.client.codice) || body.codice || '');
  const meta = { op: 'disable-client', operatore: clean(body.operatore) || '—', label: ['disiscrivere cliente', codice].filter(Boolean).join(' · ') };
  const result = await mpQueueRun(meta, () => disableClientWithBrowser(body));
  json(res, 200, result);
}

// ── Helper condivisi clienti Matchpoint (login + risoluzione Ficha + stato) ───
// Usati da reactivateClientWithBrowser. (disable/update tengono ancora la loro copia
// inline; convergenza futura su questi helper.)
async function mpClientLogin(page, username, password, baseUrl, diagnostic) {
  diagnostic.steps.push('login');
  await page.goto(absoluteUrl(baseUrl, '/Login.aspx'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#username, input[name="username"]').first().fill(username, { timeout: 20000 });
  await page.locator('#password, input[name="password"]').first().fill(password, { timeout: 20000 });
  const language = page.locator('select[name="ddlLenguaje"]');
  if (await language.count().catch(() => 0)) { await language.first().selectOption('it-IT', { timeout: 5000 }).catch(() => {}); }
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
}

async function mpReadFichaState(page) {
  return page.evaluate(() => {
    const buttons = [...document.querySelectorAll('a, input[type="submit"], input[type="button"], button')]
      .map((el) => (el.innerText || el.value || '').trim()).filter(Boolean);
    const hasDisiscrivi = buttons.some((b) => /disiscriv/i.test(b));
    const hasRiattiva = buttons.some((b) => /riattiv/i.test(b));
    let stato = '';
    const sel = [...document.querySelectorAll('select')].find((s) => {
      const t = ((s.options[s.selectedIndex] || {}).text || '');
      return /\b(Iscrizione|Disiscrizione)\b/i.test(t);
    });
    if (sel) stato = ((sel.options[sel.selectedIndex] || {}).text || '').trim();
    const dataDisInput = [...document.querySelectorAll('input')]
      .find((el) => /disiscriz|baja|fechabaja/i.test((el.id || '') + '|' + (el.name || '')));
    const dataDis = dataDisInput ? (dataDisInput.value || '').trim() : '';
    return { hasDisiscrivi, hasRiattiva, stato, dataDis, buttons: buttons.slice(0, 30) };
  }).catch(() => ({ hasDisiscrivi: false, hasRiattiva: false, stato: '', dataDis: '', buttons: [] }));
}

async function mpClickByText(page, reSrc) {
  return page.evaluate((src) => {
    const rx = new RegExp(src, 'i');
    const els = [...document.querySelectorAll('a, input[type="submit"], input[type="button"], button')];
    for (const el of els) {
      const t = (el.innerText || el.value || '').trim();
      if (t && rx.test(t) && typeof el.click === 'function') { el.click(); return { clicked: true, text: t, tag: el.tagName, id: el.id || '' }; }
    }
    return { clicked: false };
  }, reSrc).catch((e) => ({ clicked: false, error: String(e) }));
}

// Risolve codice→idInterno e LASCIA la page sulla Ficha corretta (Path A id interno noto,
// Path B ricerca cognome-first con verifica del codice per candidato). Throw CLIENT_NOT_FOUND.
async function mpResolveClientFicha(page, opts, diagnostic) {
  const baseUrl = opts.baseUrl;
  const codice = String(opts.codice || '');
  const codNorm = codice.replace(/^0+/, '');
  const idInternoHint = clean(opts.idInternoHint || '');
  const nome = clean(opts.nome || ''), cognome = clean(opts.cognome || '');
  const telefono = clean(opts.telefono || ''), email = clean(opts.email || '');

  const readFichaCodice = async () => page.evaluate(() => {
    const t = (document.body ? document.body.innerText : '');
    const m = t.match(/Scheda cliente\s*:\s*0*(\d{1,6})\s*-/i);
    return m ? m[1] : '';
  }).catch(() => '');
  const fichaMatchesCodice = (c) => !!c && c.replace(/^0+/, '') === codNorm;

  const trySearch = async (by, val, acceptSingle) => {
    await page.goto(absoluteUrl(baseUrl, '/clientes/Listadoclientes.aspx?pagesize=15'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    const optSel = page.locator('#CC_ContentPlaceHolderBuscador_DropDownListOpcionesBusqueda, select[id$="DropDownListOpcionesBusqueda"]').first();
    if (await optSel.count().catch(() => 0)) { await optSel.selectOption({ label: by }, { timeout: 5000 }).catch(() => {}); }
    const valBox = page.locator('#CC_ContentPlaceHolderBuscador_TextBoxValorBusqueda, input[id$="TextBoxValorBusqueda"]').first();
    if (!(await valBox.count().catch(() => 0))) return { id: '', onFicha: false, how: 'search_field_not_found' };
    await valBox.fill(String(val), { timeout: 8000 }).catch(() => {});
    const btnBuscar = page.locator('#CC_ContentPlaceHolderBuscador_ImageButtonBuscar, input[id$="ImageButtonBuscar"]').first();
    if (await btnBuscar.count().catch(() => 0)) {
      await Promise.all([ page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {}), btnBuscar.click({ timeout: 8000 }).catch(() => {}) ]);
    } else {
      await Promise.all([ page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {}), valBox.press('Enter', { timeout: 5000 }).catch(() => {}) ]);
    }
    await page.waitForTimeout(1200);
    const ss = await page.evaluate(() => ({ bodySample: (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').trim().slice(0, 300) })).catch(() => ({ bodySample: '' }));
    const schedaMatch = String(ss.bodySample || '').match(/Scheda cliente\s*:\s*0*(\d{1,6})\s*-/i);
    const onFichaNow = /FichaCliente\.aspx/i.test(page.url()) || !!schedaMatch;
    if (onFichaNow) {
      const schedaCod = schedaMatch ? schedaMatch[1].replace(/^0+/, '') : '';
      if (schedaCod && schedaCod !== codNorm) return { id: '', onFicha: false, how: `ficha_codice_mismatch(${schedaMatch[1]})` };
      const idm = decodeURIComponent(page.url()).match(/[?&]id=(\d+)/i);
      return { id: idm ? idm[1] : '', onFicha: true, how: 'direct_ficha' };
    }
    const resolved = await page.evaluate((cod) => {
      const cn = String(cod).replace(/^0+/, '');
      const matchId = (str) => { const s2 = decodeURIComponent(String(str || '')); let m = s2.match(/gotoClient\((\d+)\)/i); if (m) return m[1]; m = s2.match(/[?&]id=(\d+)/i); if (m) return m[1]; return ''; };
      const rowAnchors = (tr) => [...tr.querySelectorAll('a')].map((a) => a.getAttribute('href') || a.getAttribute('onclick') || '');
      const rows = [...document.querySelectorAll('table tr')];
      const candidates = [];
      for (const tr of rows) {
        const text = (tr.innerText || '').replace(/\s+/g, ' ').trim();
        if (!text) continue;
        let id = '';
        for (const h of rowAnchors(tr)) { id = matchId(h); if (id) break; }
        if (!id) continue;
        const codeHit = text.split(' ').some((t) => { const tn = t.replace(/\D/g, ''); return tn && (tn === String(cod) || tn.replace(/^0+/, '') === cn); });
        candidates.push({ id, codeHit });
      }
      const hit = candidates.find((c) => c.codeHit);
      if (hit) return { id: hit.id, how: 'code_token' };
      const uniqueIds = [...new Set(candidates.map((c) => c.id))];
      if (uniqueIds.length === 1) return { id: uniqueIds[0], how: 'single_candidate' };
      return { id: '', how: candidates.length ? 'ambiguous' : 'no_candidate' };
    }, codice).catch(() => ({ id: '', how: 'eval_error' }));
    if (resolved.how === 'code_token') return { id: resolved.id, onFicha: false, how: resolved.how };
    if (resolved.how === 'single_candidate' && acceptSingle) return { id: resolved.id, onFicha: false, how: resolved.how };
    return { id: '', onFicha: false, how: resolved.how };
  };

  diagnostic.steps.push('resolve');
  diagnostic.attempts = [];
  let idInterno = '';
  let fichaCod = '';
  if (/^\d{2,9}$/.test(idInternoHint)) {
    diagnostic.steps.push('goto_ficha_by_id');
    await page.goto(absoluteUrl(baseUrl, `/Clientes/FichaCliente.aspx?id=${encodeURIComponent(idInternoHint)}`), { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    const cod = await readFichaCodice();
    diagnostic.attempts.push({ by: 'id_interno', id: idInternoHint, fichaCod: cod });
    if (fichaMatchesCodice(cod)) { idInterno = idInternoHint; fichaCod = cod; diagnostic.resolve = { how: 'id_hint', id: idInterno }; }
  }
  if (!idInterno) {
    const searchPlan = [
      { by: 'Cliente', val: cognome || nome, acceptSingle: false },
      { by: 'E-mail', val: email, acceptSingle: true },
      { by: 'Telefono cellulare', val: telefono, acceptSingle: true },
    ];
    const seenTerms = new Set();
    for (const a of searchPlan) {
      const v = clean(a.val);
      if (!v) continue;
      const key = `${a.by}|${v.toLowerCase()}`;
      if (seenTerms.has(key)) continue;
      seenTerms.add(key);
      const r = await trySearch(a.by, a.val, a.acceptSingle);
      let cod = '';
      if (r.onFicha) { cod = await readFichaCodice(); }
      else if (r.id) {
        await page.goto(absoluteUrl(baseUrl, `/Clientes/FichaCliente.aspx?id=${encodeURIComponent(r.id)}`), { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        cod = await readFichaCodice();
      }
      diagnostic.attempts.push({ by: a.by, how: r.how, id: r.id || '', fichaCod: cod });
      if ((r.id || r.onFicha) && fichaMatchesCodice(cod)) {
        idInterno = r.id || '';
        if (!idInterno) { const mm = decodeURIComponent(page.url()).match(/[?&]id=(\d+)/i); if (mm) idInterno = mm[1]; }
        fichaCod = cod;
        diagnostic.resolve = { how: r.how, by: a.by, id: idInterno };
        break;
      }
    }
  }
  diagnostic.idInterno = idInterno;
  diagnostic.fichaCodice = fichaCod;
  diagnostic.fichaUrl = page.url();
  if (!idInterno || !fichaMatchesCodice(fichaCod)) {
    throw fail('CLIENT_NOT_FOUND', `Cliente con codice ${codice} non trovato in Matchpoint (tentativi=${diagnostic.attempts.length}).`, diagnostic);
  }
  return idInterno;
}

// ── reactivateClientWithBrowser: RI-ISCRIVE un cliente disiscritto ────────────
//    Su Matchpoint la riattivazione è il bottone "Riattivare" sulla Ficha: azione
//    DIRETTA (1 click, niente form intermedio) → Stato torna "Iscrizione" e la
//    "Data disiscrizione" si svuota. Verifica reale ricaricando la Ficha.
async function reactivateClientWithBrowser(options = {}) {
  const username = clean(options.username) || env('MATCHPOINT_USERNAME');
  const password = clean(options.password) || env('MATCHPOINT_PASSWORD');
  if (!username || !password) throw fail('MATCHPOINT_WORKER_SECRETS_MISSING', 'Mancano credenziali Matchpoint nel worker.');
  const client = options.client || {};
  const codice = clean(client.codice || client.memberId || '');
  if (!/^\d{3,6}$/.test(codice)) throw fail('INVALID_CLIENT_CODICE', 'Codice Matchpoint (4-6 cifre) richiesto per riattivare il cliente.', { codice });
  const nome = clean(client.nome || client.firstName || '');
  const cognome = clean(client.cognome || client.surname || '');
  const telefono = clean(client.telefono || client.phone || '');
  const email = clean(client.email || '');
  const idInternoHint = clean(client.idInterno || client.matchpointIdInterno || '');
  const baseUrl = clean(options.baseUrl) || env('MATCHPOINT_BASE_URL', DEFAULT_BASE_URL);
  const diagnostic = { mode: 'reactivate_client', codice, nome, cognome, telefono, email, baseUrl, startedAt: new Date().toISOString(), steps: [] };

  const browser = await chromium.launch({ headless: boolEnv('MATCHPOINT_HEADLESS', true), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  let page;
  try {
    const context = await browser.newContext({ acceptDownloads: false, locale: 'it-IT', timezoneId: 'Europe/Rome', viewport: { width: 1440, height: 900 }, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' });
    page = await context.newPage();
    await page.addInitScript(() => { window.confirm = () => true; });
    page.setDefaultTimeout(12000);
    page.setDefaultNavigationTimeout(20000);

    await mpClientLogin(page, username, password, baseUrl, diagnostic);
    const idInterno = await mpResolveClientFicha(page, { baseUrl, codice, idInternoHint, nome, cognome, telefono, email }, diagnostic);

    // ── Stato PRIMA (idempotenza): se già iscritto ("Disiscrivere" presente, niente
    //    "Riattivare") → niente da fare. ──
    const before = await mpReadFichaState(page);
    diagnostic.before = before;
    if (before.hasDisiscrivi && !before.hasRiattiva) {
      return { ok: true, alreadyActive: true, message: `Cliente ${codice} risulta già iscritto su Matchpoint.`, codice, idInterno, diagnostic };
    }
    if (!before.hasRiattiva) {
      throw fail('RIATTIVA_BUTTON_NOT_FOUND', 'Bottone "Riattivare" non trovato sulla scheda cliente.', diagnostic);
    }

    // ── Click "Riattivare" (diretto). Eventuale popup di conferma si autodismette → solo attesa. ──
    diagnostic.steps.push('click_riattiva');
    await page.evaluate(() => { window.confirm = () => true; }).catch(() => {});
    page.once('dialog', async (dialog) => { diagnostic.dialogMessage = dialog.message(); await dialog.accept().catch(() => {}); });
    const c1 = await mpClickByText(page, '^\\s*riattiv');
    diagnostic.click = c1;
    if (!c1.clicked) throw fail('RIATTIVA_BUTTON_NOT_FOUND', 'Bottone "Riattivare" non trovato sulla scheda cliente.', diagnostic);
    await page.waitForLoadState('domcontentloaded', { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // ── Verifica DEFINITIVA: ricarico la Ficha e controllo che sia tornato iscritto ──
    diagnostic.steps.push('verify_reload_ficha');
    await page.goto(absoluteUrl(baseUrl, `/Clientes/FichaCliente.aspx?id=${encodeURIComponent(idInterno)}`), { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    const after = await mpReadFichaState(page);
    diagnostic.after = after;
    const verified = (after.hasDisiscrivi && !after.hasRiattiva) || /^iscrizione$/i.test(after.stato) || (!after.dataDis && !!before.dataDis);
    diagnostic.verified = verified;
    if (!verified) {
      throw fail('CLIENT_REACTIVATE_NOT_CONFIRMED', `Riattivazione cliente ${codice} non confermata: la scheda risulta ancora disiscritta dopo l'operazione.`, diagnostic);
    }

    return { ok: true, message: `Cliente ${codice} riattivato su Matchpoint`, codice, idInterno, verified: true, diagnostic };
  } catch (error) {
    if (error && error.code && error.diagnostic) throw error;
    throw fail('CLIENT_REACTIVATE_FAILED', (error && error.message) || String(error), diagnostic);
  } finally {
    await browser.close().catch(() => {});
  }
}

async function handleReactivateClient(req, res) {
  requireWorkerAuth(req);
  const body = await readBody(req);
  const codice = clean((body.client && body.client.codice) || body.codice || '');
  const meta = { op: 'reactivate-client', operatore: clean(body.operatore) || '—', label: ['riattivare cliente', codice].filter(Boolean).join(' · ') };
  const result = await mpQueueRun(meta, () => reactivateClientWithBrowser(body));
  json(res, 200, result);
}

// ── readWalletWithBrowser: legge il saldo BORSELLINO/Portafoglio di un cliente ──
// SOLA LETTURA (nessuna scrittura, nessun denaro mosso). idInterno = id URL della
// FichaCliente = stesso HiddenFieldIdCliente dei partecipanti partita (vedi Fase 0).
async function readWalletWithBrowser(options = {}) {
  const username = clean(options.username) || env('MATCHPOINT_USERNAME');
  const password = clean(options.password) || env('MATCHPOINT_PASSWORD');
  if (!username || !password) {
    throw fail('MATCHPOINT_WORKER_SECRETS_MISSING', 'Mancano credenziali Matchpoint nel worker.');
  }
  const idInterno = clean(options.idInterno || options.idCliente || options.id || '');
  if (!/^\d{1,8}$/.test(idInterno)) {
    throw fail('INVALID_CLIENT_ID', 'idCliente (id interno Matchpoint) richiesto per leggere il borsellino.', { idInterno });
  }
  const baseUrl = clean(options.baseUrl) || env('MATCHPOINT_BASE_URL', DEFAULT_BASE_URL);
  const diagnostic = { mode: 'read_wallet', idInterno, baseUrl, startedAt: new Date().toISOString(), steps: [] };

  const browser = await chromium.launch(mpLaunchOptions());
  try {
    const { page } = await mpNewContextPage(browser);
    page.setDefaultTimeout(12000);
    page.setDefaultNavigationTimeout(20000);
    await mpDoLogin(page, baseUrl, username, password, diagnostic);
    diagnostic.steps.push('open_ficha');
    await page.goto(absoluteUrl(baseUrl, `/Clientes/FichaCliente.aspx?id=${encodeURIComponent(idInterno)}`), { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1200);
    const txt = await page.locator(MP_PAYMENT_SELECTORS.walletSaldoLabel).first().innerText({ timeout: 6000 }).catch(() => '');
    diagnostic.walletText = txt;
    const balanceCents = mpMoneyToCents(txt);
    if (balanceCents == null) {
      throw fail('WALLET_BALANCE_NOT_FOUND', 'Saldo Portafoglio non leggibile sulla scheda cliente.', diagnostic);
    }
    return { ok: true, idCliente: idInterno, balanceCents, balanceText: clean(txt), diagnostic };
  } finally {
    await browser.close().catch(() => {});
  }
}

async function handleReadWallet(req, res) {
  requireWorkerAuth(req);
  const body = await readBody(req);
  const result = await mpQueueRun(mpJobMeta('read-wallet', body), () => mpReadRetry('read-wallet', () => readWalletWithBrowser(body)));
  json(res, 200, result);
}

// ── Report SALDI BORSELLINO di massa (Inf. e statistiche → "Clienti con credito residuo") ──
// SOLA LETTURA: genera il report (nome filtro vuoto = tutti i clienti con credito>0) e scarica
// l'Excel (Cod./Cliente/E-mail/Telefono/Saldo). Modellato sul flusso storico (menu → genera →
// esporta). NB: l'etichetta esatta della voce di menu si conferma solo dal vivo → si provano più
// varianti e si lascia diagnostica ricca (contextSamples) per affinare in smoke test.
async function findWalletReportContext(page, diagnostic, timeout = 45000) {
  const deadline = Date.now() + timeout;
  let samples = [];
  while (Date.now() < deadline) {
    samples = [];
    for (const entry of pageContentContexts(page)) {
      const compactText = (await readContextBody(entry.target)).replace(/\s+/g, ' ').trim();
      const reportPageFound = /credito\s+residuo|clienti\s+con\s+saldo/i.test(compactText);
      const filterFound = /Nome\s+e\s+cognom/i.test(compactText);
      const generateButtonFound = /Generare\s+una\s+relazione|Genera(?:re)?\s+relazione/i.test(compactText);
      const sample = { kind: entry.kind, index: entry.index, url: entry.url, reportPageFound, filterFound, generateButtonFound, bodySample: compactText.slice(0, 500) };
      samples.push(sample);
      if ((reportPageFound || filterFound) && generateButtonFound) {
        diagnostic.walletReportContext = sample;
        diagnostic.walletReportUrl = entry.url;
        return entry.target;
      }
    }
    await page.waitForTimeout(600);
  }
  diagnostic.walletReportContextSamples = samples;
  return null;
}

async function findWalletResultsContext(page, diagnostic, timeout = 45000) {
  const deadline = Date.now() + timeout;
  let samples = [];
  while (Date.now() < deadline) {
    samples = [];
    for (const entry of pageContentContexts(page)) {
      const compactText = (await readContextBody(entry.target)).replace(/\s+/g, ' ').trim();
      const candidates = await exportCandidates(entry.target);
      const exportFound = /Esportare\s+in\s+excel|Exportar/i.test(compactText) || candidates.length > 0;
      // Il report "Clienti con saldo" (ListadoClientesConSaldo.aspx) è un LISTING diretto:
      // mostra subito i record ("Registri: N") con colonna Saldo e "Esportare in excel" — NON
      // c'è uno step "Generare una relazione". Riconosco la pagina dei risultati così.
      const resultsTableFound = /Saldo/i.test(compactText)
        && /(Registri\s*:|Codice\s+Nome|Cod\.?\s+Socio|credito\s+residuo|Totale)/i.test(compactText);
      const sample = { kind: entry.kind, index: entry.index, url: entry.url, exportFound, resultsTableFound, exportCandidates: candidates.slice(0, 6), bodySample: compactText.slice(0, 900) };
      samples.push(sample);
      if (resultsTableFound && exportFound) {
        diagnostic.walletResultsContext = sample;
        diagnostic.walletResultsUrl = entry.url;
        return entry.target;
      }
    }
    await page.waitForTimeout(600);
  }
  diagnostic.walletResultsContextSamples = samples;
  return null;
}

// Apre una voce del menu report "Inf. e statistiche" (frame Estadisticas/Menu.aspx) cercandola
// per TESTO tra gli <a>, e cliccando l'ancora NEL SUO contesto (fa partire navlframe di MP). Più
// robusto del click per-locator: enumera i link, abbina per regex e clicca l'elemento esatto.
// Registra in diagnostic il link abbinato e un campione dei testi (per affinare dal vivo).
async function openEstadisticasReportByLabel(page, labelRe, diagnostic, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const entry of pageContentContexts(page)) {
      let links = [];
      try {
        links = await entry.target.evaluate(() => Array.from(document.querySelectorAll('a')).map((a) => ({
          text: (a.textContent || '').replace(/\s+/g, ' ').trim(),
          href: a.getAttribute('href') || '',
          onclick: a.getAttribute('onclick') || '',
        })).filter((l) => l.text));
      } catch { links = []; }
      if (!links.length) continue;
      const match = links.find((l) => labelRe.test(l.text));
      if (match) {
        diagnostic.estadisticasMatch = { text: match.text, href: match.href, onclick: match.onclick, ctx: `${entry.kind}:${entry.index}`, ctxUrl: entry.url };
        const did = await entry.target.evaluate((wanted) => {
          const a = Array.from(document.querySelectorAll('a')).find((x) => (x.textContent || '').replace(/\s+/g, ' ').trim() === wanted);
          if (!a) return false;
          a.click();
          return true;
        }, match.text).catch(() => false);
        if (did) return true;
      } else {
        diagnostic.estadisticasLinksSample = links.slice(0, 80).map((l) => l.text);
        diagnostic.estadisticasLinksContext = { kind: entry.kind, index: entry.index, url: entry.url, count: links.length };
      }
    }
    await page.waitForTimeout(500);
  }
  return false;
}

async function exportWalletReportWithBrowser(options = {}) {
  const username = clean(options.username) || env('MATCHPOINT_USERNAME');
  const password = clean(options.password) || env('MATCHPOINT_PASSWORD');
  if (!username || !password) {
    throw fail('MATCHPOINT_WORKER_SECRETS_MISSING', 'Mancano credenziali Matchpoint nel worker.');
  }
  const baseUrl = clean(options.baseUrl) || env('MATCHPOINT_BASE_URL', DEFAULT_BASE_URL);
  const exportTarget = clean(options.exportTarget) || env('MATCHPOINT_EXPORT_TARGET', DEFAULT_EXPORT_TARGET);
  const diagnostic = { mode: 'export_wallet_report', flow: 'wallet_balance', baseUrl, startedAt: new Date().toISOString(), steps: [] };

  const browser = await chromium.launch(mpLaunchOptions());
  try {
    const { page } = await mpNewContextPage(browser);
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(45000);
    await mpDoLogin(page, baseUrl, username, password, diagnostic);
    await maybeClickCashEnter(page, diagnostic);

    // 1) Naviga DIRETTAMENTE al report listing "Clienti con saldo/credito residuo"
    // (ListadoClientesConSaldo.aspx): mostra subito tutti i clienti con credito + "Esportare in
    // excel", senza step "Generare una relazione". Più robusto del giro nei menu (come read-wallet).
    diagnostic.steps.push('goto_report_direct');
    const reportUrl = absoluteUrl(baseUrl, '/Clientes/ListadoClientesConSaldo.aspx');
    await page.goto(reportUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    diagnostic.directReportUrl = page.url();
    let resultsContext = await findWalletResultsContext(page, diagnostic, 15000);

    // 2) Fallback: passa dal menu "Inf. e statistiche" → "Clienti con saldo".
    if (!resultsContext) {
      diagnostic.steps.push('menu_fallback');
      if (await clickMenuEntryEverywhere(page, 'Inf. e statistiche', 'open_inf_statistiche_menu', diagnostic)) {
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(1500);
        const reportLabelRe = /clienti\s+con\s+saldo|credito\s+residuo/i;
        const clicked = (await openEstadisticasReportByLabel(page, reportLabelRe, diagnostic))
          || (await clickMenuEntryEverywhere(page, 'Clienti con saldo', 'click_wallet_report', diagnostic));
        if (clicked) {
          await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
          await page.waitForTimeout(2000);
          resultsContext = await findWalletResultsContext(page, diagnostic, 30000);
        }
      }
    }
    if (!resultsContext) {
      throw fail('MATCHPOINT_WALLET_RESULTS_NOT_READY', 'Report saldi non pronto o export Excel non trovato.', { url: page.url(), walletResultsContextSamples: diagnostic.walletResultsContextSamples || [], estadisticasLinksSample: diagnostic.estadisticasLinksSample || [] });
    }

    // 6) Esporta in Excel.
    diagnostic.steps.push('wallet_export_click');
    const download = await triggerExportDownload(page, resultsContext, exportTarget, diagnostic, 'export saldi');
    const filename = download.suggestedFilename() || `matchpoint-saldi-${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
    const bytes = await bufferFromDownload(download);
    diagnostic.downloadedAt = new Date().toISOString();
    diagnostic.filename = filename;
    diagnostic.byteLength = bytes.byteLength;
    if (!bytes.byteLength) {
      throw fail('MATCHPOINT_BROWSER_EMPTY_DOWNLOAD', 'Download saldi Matchpoint vuoto.', diagnostic);
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

async function handleExportWalletReport(req, res) {
  requireWorkerAuth(req);
  const body = await readBody(req);
  const result = await mpQueueRun(mpJobMeta('export-wallet-report', body), () => mpReadRetry('export-wallet-report', () => exportWalletReportWithBrowser(body)));
  json(res, 200, result);
}

// ── Report PAGAMENTI prenotazioni (Inf. e statistiche → 11.13 "Pagamenti effettuati") ──
// SOLA LETTURA: genera il report dei cobros sulle prenotazioni dei campi tra due date e scarica
// l'Excel (Data Pagamento / D. Pagamento=metodo / Importo / Cod. / Nome / N° prenotazione /
// Giorno / Ora / Spazio). Stesso meccanismo di exportWalletReportWithBrowser
// (login → URL diretto del report → riempi date → "Generare una relazione" → "Esportare in Excel").
const DEFAULT_PAYMENTS_REPORT_PATH = '/Estadisticas/Reservas/ListadoPagosRealizados.aspx';

function fmtDateIt(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}
// Accetta 'yyyy-mm-dd' o 'dd/MM/yyyy'; altrimenti il fallback.
function parseDateInput(value, fallback) {
  const t = clean(value);
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return fallback;
}

// Riempie i campi data desde/hasta nel contesto giusto (la pagina report aperta in diretto è a
// livello page, ma iteriamo i contesti per robustezza). Formato IT dd/MM/yyyy.
async function fillReportDateRange(page, fromStr, toStr, diagnostic) {
  const result = { desde: false, hasta: false };
  const fillIn = async (target, sel, val) => {
    const loc = target.locator(sel).first();
    if (!(await loc.count().catch(() => 0))) return false;
    await loc.fill('', { timeout: 4000 }).catch(() => {});
    await loc.fill(val, { timeout: 4000 }).catch(() => {});
    return true;
  };
  for (const entry of pageContentContexts(page)) {
    if (!result.desde) result.desde = await fillIn(entry.target, 'input[id*="TextBoxFechaDesde"], input[id*="TextBoxFechaCobroDesde"], input[id*="FechaDesde"]', fromStr).catch(() => false);
    if (!result.hasta) result.hasta = await fillIn(entry.target, 'input[id*="TextBoxFechaHasta"], input[id*="TextBoxFechaCobroHasta"], input[id*="FechaHasta"]', toStr).catch(() => false);
    if (result.desde && result.hasta) break;
  }
  diagnostic.datesFilled = result;
  return result;
}

// Clicca "Generare una relazione" nel contesto in cui appare (fa partire il postback del report).
async function clickGenerateReport(page, diagnostic, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const entry of pageContentContexts(page)) {
      const did = await entry.target.evaluate(() => {
        const re = /Generare\s+una\s+relazione|Genera(?:re)?\s+relazione|Generare/i;
        const el = Array.from(document.querySelectorAll('a,input,button')).find((e) => re.test((e.value || e.textContent || '').trim()));
        if (!el) return false;
        el.click();
        return true;
      }).catch(() => false);
      if (did) { diagnostic.generateClickedIn = `${entry.kind}:${entry.index}`; return true; }
    }
    await page.waitForTimeout(500);
  }
  return false;
}

// Trova il contesto coi risultati del report + il pulsante export (tabella con colonne pagamenti).
async function findExportableResultsContext(page, diagnostic, timeout = 30000) {
  const deadline = Date.now() + timeout;
  let samples = [];
  while (Date.now() < deadline) {
    samples = [];
    for (const entry of pageContentContexts(page)) {
      const compactText = (await readContextBody(entry.target)).replace(/\s+/g, ' ').trim();
      const candidates = await exportCandidates(entry.target);
      const exportFound = /Esportare\s+in\s+excel|Esportare|Exportar/i.test(compactText) || candidates.length > 0;
      const resultsTableFound = /(Importo\s+Totale|Data\s+Pagamento|D\.\s*Pagamento|Numero\s+di\s+prenotazione|Registri\s*:|Totale)/i.test(compactText);
      const sample = { kind: entry.kind, index: entry.index, url: entry.url, exportFound, resultsTableFound, exportCandidates: candidates.slice(0, 6), bodySample: compactText.slice(0, 600) };
      samples.push(sample);
      if (resultsTableFound && exportFound) { diagnostic.paymentsResultsContext = sample; return entry.target; }
    }
    await page.waitForTimeout(600);
  }
  diagnostic.paymentsResultsContextSamples = samples;
  return null;
}

async function exportPaymentsReportWithBrowser(options = {}) {
  const username = clean(options.username) || env('MATCHPOINT_USERNAME');
  const password = clean(options.password) || env('MATCHPOINT_PASSWORD');
  if (!username || !password) throw fail('MATCHPOINT_WORKER_SECRETS_MISSING', 'Mancano credenziali Matchpoint nel worker.');
  const baseUrl = clean(options.baseUrl) || env('MATCHPOINT_BASE_URL', DEFAULT_BASE_URL);
  const exportTarget = clean(options.exportTarget) || env('MATCHPOINT_EXPORT_TARGET', DEFAULT_EXPORT_TARGET);
  const reportPath = clean(options.reportPath) || DEFAULT_PAYMENTS_REPORT_PATH;
  const now = new Date();
  const days = Number(options.days) > 0 ? Number(options.days) : 31;
  const dFrom = parseDateInput(options.dateFrom, new Date(now.getTime() - days * 86400000));
  const dTo = parseDateInput(options.dateTo, now);
  const diagnostic = { mode: 'export_payments_report', flow: 'payments', baseUrl, reportPath, dateFrom: fmtDateIt(dFrom), dateTo: fmtDateIt(dTo), startedAt: new Date().toISOString(), steps: [] };

  // Riusa la sessione calda condivisa (come le altre LETTURE: read-tabellone, get-slots)
  // invece di lanciare+chiudere un browser proprio ad ogni run. Evita launch+login (~13s)
  // per ogni export → job molto più corto, così il cron "oggi" può girare fitto (~5 min)
  // senza tenere occupata la coda e far aspettare le azioni staff. Fallback a login a
  // freddo gestito da mpAcquirePage; l'export è idempotente (già avvolto in mpReadRetry).
  const acq = await mpAcquirePage(baseUrl, username, password, diagnostic);
  const page = acq.page;
  let _opFailed = false;
  try {
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(45000);
    await maybeClickCashEnter(page, diagnostic);

    diagnostic.steps.push('goto_report');
    await page.goto(absoluteUrl(baseUrl, reportPath), { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1200);
    diagnostic.reportUrl = page.url();

    diagnostic.steps.push('fill_dates');
    await fillReportDateRange(page, fmtDateIt(dFrom), fmtDateIt(dTo), diagnostic);

    diagnostic.steps.push('generate');
    await Promise.all([
      page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {}),
      clickGenerateReport(page, diagnostic),
    ]);
    await page.waitForTimeout(2000);

    const resultsContext = await findExportableResultsContext(page, diagnostic, 25000);
    if (!resultsContext) {
      throw fail('MATCHPOINT_PAYMENTS_RESULTS_NOT_READY', 'Report pagamenti non pronto o export Excel non trovato.', { url: page.url(), paymentsResultsContextSamples: diagnostic.paymentsResultsContextSamples || [] });
    }

    diagnostic.steps.push('payments_export_click');
    const download = await triggerExportDownload(page, resultsContext, exportTarget, diagnostic, 'export pagamenti');
    const filename = download.suggestedFilename() || `matchpoint-pagamenti-${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
    const bytes = await bufferFromDownload(download);
    diagnostic.downloadedAt = new Date().toISOString();
    diagnostic.filename = filename;
    diagnostic.byteLength = bytes.byteLength;
    if (!bytes.byteLength) throw fail('MATCHPOINT_BROWSER_EMPTY_DOWNLOAD', 'Download pagamenti Matchpoint vuoto.', diagnostic);

    return {
      ok: true,
      filename,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      base64: bytes.toString('base64'),
      dateFrom: fmtDateIt(dFrom),
      dateTo: fmtDateIt(dTo),
      diagnostic,
    };
  } catch (_e) {
    _opFailed = true;
    throw _e;
  } finally {
    await acq.release(_opFailed);
  }
}

async function handleExportPaymentsReport(req, res) {
  requireWorkerAuth(req);
  const body = await readBody(req);
  const result = await mpQueueRun(mpJobMeta('export-payments-report', body), () => mpReadRetry('export-payments-report', () => exportPaymentsReportWithBrowser(body)));
  json(res, 200, result);
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

// ── Helper: attende che un postback parziale ASP.NET (UpdatePanel) sia concluso ──
// Dopo aver aggiunto un giocatore, Matchpoint fa un postback async che ricostruisce
// il blocco "Aggiungi giocatore". Se si digita il giocatore successivo PRIMA che il
// postback sia finito, l'AutoCompleteExtender non è ancora riagganciato e
// l'autocomplete non compare → HiddenFieldIdPeople resta vuoto (PLAYER_ID_NOT_LOCKED).
// Se ScriptManager non è presente, la funzione non blocca (fallback sicuro).
async function mpWaitAsyncPostbackIdle(page, timeoutMs = 12000) {
  try {
    await page.waitForFunction(() => {
      try {
        const S = window.Sys;
        if (S && S.WebForms && S.WebForms.PageRequestManager) {
          const prm = S.WebForms.PageRequestManager.getInstance();
          return prm ? !prm.get_isInAsyncPostBack() : true;
        }
      } catch (e) {}
      return true;
    }, { timeout: timeoutMs });
  } catch (e) { /* timeout: proseguiamo comunque, c'è il fallback dei 3 tentativi */ }
}

// ── Helper: chiude un avviso SweetAlert2 ("importi in attesa", semaforo) se presente ──
// Alcuni soci con semaforo GIALLO (es. pagamenti in sospeso) fanno comparire uno swal2
// al momento della SELEZIONE / dell'AGGIUNTA dell'allievo in una lezione: il popup copre
// la pagina, il click su "+ Aggiungere" viene intercettato e l'allievo non entra mai in
// elenco → falso PLAYER_ADD_NOT_CONFIRMED (caso reale "Lidia Ciao Comes": 8,00 in attesa).
// ⚠️ Controllo IMMEDIATO e non bloccante: isVisible() non auto-attende, quindi se l'avviso
// non c'è si esce subito (nessun rischio del timeout-trap che ruppe le prenotazioni).
async function dismissSwalOk(page, diagnostic, where) {
  let dismissed = false;
  for (let i = 0; i < 6; i++) {
    const ok = page.locator('button.swal2-confirm');
    if (!(await ok.isVisible().catch(() => false))) break;
    await ok.first().click({ timeout: 1500 }).catch(() => {});
    dismissed = true;
    diagnostic.steps.push('swal_dismiss:' + where);
    await page.waitForTimeout(300);
  }
  return dismissed;
}

// ── Helper: clic robusto su "Salva/Actualizar" della Ficha ───────────────────
// Dopo più postback consecutivi (es. aggiunta di più giocatori, di cui un Ospite)
// il bottone "Actualizar" può restare momentaneamente NON cliccabile — o coperto
// da un avviso swal2 (semaforo) — e un singolo click({timeout:10000}) va in 500
// isolato (incidente reale 29/06: edit Campo 2 +3 giocatori). Strategia: chiudi
// eventuali swal, attendi che il postback async sia concluso, poi clicca; se il
// click non riesce, richiudi swal + riattendi e ritenta una volta con timeout più
// ampio. Solo dopo 2 tentativi falliti propaga un errore (resta 500 ma con retry).
async function clickSaveActualizar(page, diagnostic, tag = 'salva') {
  for (let attempt = 0; attempt < 2; attempt++) {
    await dismissSwalOk(page, diagnostic, tag + '_pre' + attempt);
    await mpWaitAsyncPostbackIdle(page, attempt === 0 ? 6000 : 12000);
    try {
      await Promise.all([
        page.waitForLoadState('networkidle', { timeout: 9000 }).catch(() => {}),
        page.locator('#CC_Datos_FormViewFicha_ButtonActualizar').first().click({ timeout: attempt === 0 ? 10000 : 15000 }),
      ]);
      diagnostic.steps.push(`${tag}_click_ok:attempt${attempt}`);
      return;
    } catch (e) {
      diagnostic.steps.push(`${tag}_click_retry:attempt${attempt}:${String((e && e.message) || e).slice(0, 60)}`);
    }
  }
  throw fail('SAVE_BUTTON_CLICK_TIMEOUT',
    'Salvataggio su Matchpoint non riuscito: bottone "Actualizar" non cliccabile dopo 2 tentativi.',
    diagnostic);
}

// ── Helper: cerca una riga partecipante già presente (per nome o per id) ──────
// Scansiona TUTTI gli input "TextBoxNombreValor" (qualunque repeater: partita
// WUCUsuarioPartida o lezione WUCUsuarioClase_Listado) e ricava l'id cliente
// sostituendo nello stesso id "TextBoxNombreValor" → "HiddenFieldIdCliente".
// Match per nome (substring bidirezionale) o per id (onlyDigits, ignora zeri
// iniziali) contro wantCode (codice cliente atteso) / wantPeople (id agganciato).
// ⚠️ OSPITE / righe senza nome: il match per id copre i partecipanti che NON
// espongono il nome nel campo (es. cliente "Ospite", codice 000001).
// Ritorna { idCliente, matchBy, righeViste }: idCliente === null se non trovato.
async function scanParticipantRow(page, nome, wantCode, wantPeople) {
  const _norm = (s) => String(s || '').toLowerCase().trim();
  const _onlyDigits = (s) => String(s || '').replace(/\D/g, '').replace(/^0+/, '');
  const righeViste = [];
  const nomeInputs = page.locator('input[id*="TextBoxNombreValor"]');
  const righeTot = await nomeInputs.count().catch(() => 0);
  for (let r = 0; r < righeTot; r++) {
    const rowId = (await nomeInputs.nth(r).getAttribute('id').catch(() => '')) || '';
    const nomeVal = (await nomeInputs.nth(r).inputValue().catch(() => '')).toLowerCase().trim();
    let idCliVal = '';
    if (rowId) {
      const idCliId = rowId.replace(/TextBoxNombreValor/g, 'HiddenFieldIdCliente');
      idCliVal = (await page.locator(`input[id="${idCliId}"]`).first().inputValue().catch(() => '')).trim();
    }
    const idCliDigits = _onlyDigits(idCliVal);
    righeViste.push(`${rowId}=${nomeVal}#${idCliVal}`);
    const matchByName = !!nomeVal && (nomeVal.includes(_norm(nome)) || _norm(nome).includes(nomeVal));
    const matchById = !!idCliDigits && ((wantCode && idCliDigits === wantCode) || (wantPeople && idCliDigits === wantPeople));
    if (matchByName || matchById) {
      return { idCliente: idCliVal || '', matchBy: matchByName ? 'name' : 'id', righeViste };
    }
  }
  return { idCliente: null, matchBy: null, righeViste };
}

// ── Helper: cerca giocatore in autocomplete e lo aggiunge all'elenco ──────────
// ⚠️ INDURIMENTO: verifica HiddenFieldIdPeople dopo selezione <li>, ritenta fino a
// 3 volte se vuoto, poi fallisce esplicitamente. Verifica anche la riga post-aggiunta.
async function searchAndAddPlayer(formCtx, page, nome, diagnostic, pfx = '#CC_Datos_FormViewFicha_WUCUsuarioPartida_Anyadir_', expectedCode = '', expectedClientCode = '') {
  const PFX = pfx;
  const norm = (s) => String(s || '').toLowerCase().trim();
  const onlyDigits = (s) => String(s || '').replace(/\D/g, '').replace(/^0+/, '');
  if (!nome || !nome.trim()) { diagnostic.steps.push('player_skip_no_name'); return { nome, added: false, reason: 'no_name' }; }

  // ⚠️ Dopo il postback del 1° giocatore, Matchpoint lascia in pagina la VECCHIA
  // copia (nascosta) del campo "aggiungi giocatore" accanto a quella nuova, con lo
  // STESSO id. Digitando nella copia vecchia/nascosta l'autocomplete non parte mai.
  // Per campo e link usiamo quindi la copia VISIBILE (quella su cui digiterebbe
  // l'operatore); col 1° giocatore c'è un'unica copia, quindi invariato.
  const inputEl = formCtx.locator(PFX + 'TextBoxTitular:visible').last();
  if (!(await formCtx.locator(PFX + 'TextBoxTitular').count().catch(() => 0))) { diagnostic.steps.push('player_input_not_found'); return { nome, added: false, reason: 'input_not_found' }; }

  const addLink = formCtx.locator(PFX + 'LinkButtonAnyadir:visible').last();
  if (!(await formCtx.locator(PFX + 'LinkButtonAnyadir').count().catch(() => 0))) { diagnostic.steps.push('player_add_link_not_found'); return { nome, added: false, reason: 'add_link_missing' }; }

  const hiddenId = formCtx.locator(PFX + 'HiddenFieldIdPeople').last();
  try {
    const nInputTot = await formCtx.locator(PFX + 'TextBoxTitular').count();
    const nInputVis = await formCtx.locator(PFX + 'TextBoxTitular:visible').count();
    const nList = await formCtx.locator(PFX + 'AutoCompleteTitular_completionListElem').count();
    diagnostic.steps.push(`player_ctrl_count:${nome}:inputTot=${nInputTot}:inputVis=${nInputVis}:list=${nList}`);
  } catch (e) {}
  // ⚠️ Dopo un postback parziale, Matchpoint lascia in pagina la VECCHIA lista di
  // autocomplete (vuota/nascosta) e ne crea una NUOVA con lo STESSO id: il selettore
  // matcha 2 elementi e `ul.isVisible()` va in errore strict-mode (catturato come
  // "non visibile") → la tendina del 2° giocatore non viene mai rilevata. Prendendo
  // sempre l'ULTIMA (la nuova/attiva) il match è singolo e il problema sparisce; col
  // 1° giocatore (match unico) .last() resta quell'unico elemento, quindi invariato.
  const ul = formCtx.locator(PFX + 'AutoCompleteTitular_completionListElem').last();
  // I <li> dei suggerimenti: prendiamo quelli VISIBILI di QUALUNQUE lista (solo la
  // tendina realmente mostrata ha <li> visibili), così non dipendiamo da quale copia
  // della lista sia attiva dopo il postback.
  const li = formCtx.locator(PFX + 'AutoCompleteTitular_completionListElem li:visible');

  // ⚙️ Stabilizza il form PRIMA di digitare. Per il 2°+ giocatore, l'aggiunta
  // precedente ha appena fatto un postback parziale: attendi che sia concluso e
  // ri-sveglia il campo (focus → blur), così l'AutoCompleteExtender è riagganciato
  // e l'autocomplete compare anche per i giocatori successivi.
  await mpWaitAsyncPostbackIdle(page, 12000);
  await inputEl.first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  await inputEl.first().click({ timeout: 5000 }).catch(() => {});
  await inputEl.first().blur({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  diagnostic.steps.push(`player_form_settled:${nome}`);

  // Preferisce codiceCliente come query di ricerca: risultato unico e immediato in Matchpoint.
  // Fallback al nome se codiceCliente non disponibile.
  const searchTerm = expectedClientCode || nome;

  let lockedId = '';
  let codeCheckFailed = false;
  let clientCodeChecked = false;
  outer: for (let attempt = 0; attempt < 3; attempt++) {
    // Pulisce campo e digita searchTerm (codiceCliente o nome) con keystroke reali
    await inputEl.first().click({ timeout: 5000 }).catch(() => {});
    await page.keyboard.press('Control+A').catch(() => {});
    await page.keyboard.press('Delete').catch(() => {});
    await inputEl.first().type(searchTerm, { delay: 80 });

    // Attende autocomplete (i <li> sono già filtrati per :visible → n>0 = tendina mostrata)
    let appeared = false;
    for (let i = 0; i < 24; i++) {
      const n = await li.count().catch(() => 0);
      if (n > 0) { appeared = true; break; }
      await page.waitForTimeout(250);
    }
    if (!appeared) { diagnostic.steps.push(`player_option_not_found:${nome}:attempt${attempt}`); continue; }

    // ⚠️ Sceglie SOLO un <li> che CONTIENE davvero il nome richiesto.
    // Algoritmo di selezione (4 regole, in ordine di priorità):
    // 1. Match primario per id interno (expectedCode): HiddenFieldIdPeople === expectedCode.
    // 2. Fallback per codice cliente (expectedClientCode): confronto numerico col prefisso
    //    dell'etichetta (es. "000005-Nome"). Se esattamente un'opzione combacia → seleziona.
    //    NON confrontare expectedClientCode con HiddenFieldIdPeople (namespace diverso).
    // 3. Rete di sicurezza: se nessuna etichetta espone un codice confrontabile E c'è un
    //    solo risultato E il nome corrisponde → accetta.
    // 4. Più candidati non confermabili → annulla (sicurezza preservata).
    const count = await li.count().catch(() => 0);
    let foundNameMatch = false;
    for (let i = 0; i < count; i++) {
      const rawLabel = await li.nth(i).innerText().catch(() => '');
      const t = norm(rawLabel);
      // Log diagnostico per ogni opzione visibile (utile per calibrare il formato etichetta)
      diagnostic.steps.push(`player_option_label:${nome}:i=${i}:${rawLabel.replace(/\n/g, ' ').slice(0, 80)}`);
      if (!t.includes(norm(nome))) continue;

      // 🔒 Guardia anti-omonimia col CODICE CLIENTE: la riga è "000005-Nome Cognome".
      // Se l'app passa il codice atteso (memberId), scarta i candidati col codice
      // diverso PRIMA di cliccare. Confronto su onlyDigits (ignora gli zeri iniziali).
      let clientCodeConfirmed = false;
      if (expectedClientCode) {
        const liCode = (t.match(/^\s*(\d+)\s*-/) || [])[1] || '';
        if (liCode) {
          // L'etichetta espone un codice: confronto numerico
          if (onlyDigits(liCode) !== onlyDigits(expectedClientCode)) {
            clientCodeChecked = true;
            diagnostic.steps.push(`player_clientcode_skip:${nome}:li=${liCode}:exp=${expectedClientCode}`);
            continue;
          }
          clientCodeConfirmed = true; // confermato via etichetta (regola 2)
        } else if (count !== 1) {
          // Nessun codice nell'etichetta E più risultati: impossibile confermare → salta
          diagnostic.steps.push(`player_no_label_code_multiresult:${nome}:i=${i}:count=${count}`);
          continue;
        } else {
          // Nessun codice nell'etichetta MA risultato unico: rete di sicurezza (regola 3)
          diagnostic.steps.push(`player_single_result_net:${nome}:i=${i}`);
        }
      }

      foundNameMatch = true;
      await li.nth(i).click({ timeout: 4000 }).catch(() => {});
      // L'id si aggancia via callback async dell'autocomplete: attendi finché compare (fino a ~2.4s)
      let candidateId = '';
      for (let w = 0; w < 12; w++) {
        await page.waitForTimeout(200);
        candidateId = (await hiddenId.first().inputValue().catch(() => '')).trim();
        if (candidateId) break;
      }
      diagnostic.steps.push(`player_id_check:${nome}:attempt${attempt}:i=${i}:id=${candidateId}`);
      if (!candidateId) break; // id non agganciato: riprova col prossimo attempt
      // Verifica id interno SOLO per match primario (regola 1) e SOLO se il candidato
      // non è già stato confermato via codice cliente dall'etichetta (regole 2/3).
      if (expectedCode && !clientCodeConfirmed && onlyDigits(candidateId) !== onlyDigits(expectedCode)) {
        // Codice non combacia: pulisce il campo, ri-digita e prova il prossimo candidato
        codeCheckFailed = true;
        await inputEl.first().click({ timeout: 5000 }).catch(() => {});
        await page.keyboard.press('Control+A').catch(() => {});
        await page.keyboard.press('Delete').catch(() => {});
        await inputEl.first().type(searchTerm, { delay: 80 });
        for (let j = 0; j < 24; j++) {
          const n2 = await li.count().catch(() => 0);
          if (n2 > 0) break;
          await page.waitForTimeout(250);
        }
        continue;
      }
      // Candidato valido (codice combacia, confermato via etichetta, o nessun codice richiesto)
      lockedId = candidateId;
      codeCheckFailed = false;
      break outer;
    }
    if (!foundNameMatch) diagnostic.steps.push(`player_no_matching_option:${nome}:attempt${attempt}`);
  }

  if (!lockedId) {
    if (expectedClientCode && clientCodeChecked) {
      throw fail('PLAYER_CLIENTCODE_MISMATCH',
        `Nessun socio con codice ${expectedClientCode} tra i risultati per "${nome}". Aggiunta annullata per sicurezza.`,
        diagnostic);
    }
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

  // Avviso semaforo (es. "importi in attesa") eventualmente già presente: chiudilo.
  await dismissSwalOk(page, diagnostic, 'pre_add');

  // Identità del giocatore agganciato: codice cliente atteso (etichetta) e id interno
  // (HiddenFieldIdPeople). Serve sia al pre-check d'idempotenza sia alla verifica.
  const wantCode = onlyDigits(expectedClientCode);
  const wantPeople = onlyDigits(lockedId);

  // 🔒 PRE-CHECK IDEMPOTENZA: se questo giocatore è GIÀ tra i partecipanti (per id o
  // per nome) non aggiungerlo di nuovo. Evita il doppione quando un click precedente
  // (o un EDIT che re-invia lo stesso add) lo ha già inserito.
  {
    const pre = await scanParticipantRow(page, nome, wantCode, wantPeople);
    if (pre.idCliente !== null) {
      diagnostic.steps.push('player_already_present:' + nome);
      diagnostic.partecipantiRighe = pre.righeViste.slice(0, 30);
      diagnostic.steps.push('player_added:' + nome);
      return { nome, added: true, alreadyPresent: true, idCliente: pre.idCliente, idPeople: lockedId, codiceCliente: expectedClientCode };
    }
  }

  // Clicca "+ Aggiungere all'elenco". Per un socio con semaforo GIALLO il PRIMO click
  // mostra solo l'avviso swal2 ("importi in attesa") e NON inserisce l'allievo: va
  // chiuso l'avviso (OK) e ri-cliccato "Aggiungere" per inserirlo davvero.
  // ⚠️ Il RE-CLICK è condizionato alla CHIUSURA di un avviso swal, NON a un timeout:
  // se il primo click NON ha aperto avvisi, l'aggiunta è già stata registrata →
  // ri-cliccare sotto latenza alta (postback non ancora riflesso) inserirebbe il
  // giocatore DUE volte. Senza swal si attende solo il postback; con swal si ritenta
  // (max 3). A inizio iterazione si esce comunque se la riga è già comparsa.
  const rowSel = 'input[id*="Listado"][id*="TextBoxNombreValor"]';
  const baseRows = await page.locator(rowSel).count().catch(() => 0);
  let prevDismissedSwal = true; // addTry 0 clicca sempre
  for (let addTry = 0; addTry < 3; addTry++) {
    if ((await scanParticipantRow(page, nome, wantCode, wantPeople)).idCliente !== null) break;
    if (addTry > 0 && !prevDismissedSwal) {
      // Click precedente già registrato (nessun avviso): attendi il postback, non ri-cliccare.
      await mpWaitAsyncPostbackIdle(page, 6000).catch(() => {});
      await page.waitForTimeout(700);
      continue;
    }
    await addLink.first().click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(1000);
    prevDismissedSwal = await dismissSwalOk(page, diagnostic, 'add' + addTry);
    await mpWaitAsyncPostbackIdle(page, 6000).catch(() => {});
    const rows = await page.locator(rowSel).count().catch(() => 0);
    diagnostic.steps.push(`player_add_try:${addTry}:rows=${rows}/base${baseRows}:swal=${prevDismissedSwal}`);
  }

  // Verifica post-aggiunta: scansiona TUTTE le righe partecipanti, qualunque sia il
  // tipo di form. La partita usa il repeater "WUCUsuarioPartida", la lezione
  // "WUCUsuarioClase": il vecchio selettore fisso su WUCUsuarioPartida falliva sulle
  // lezioni (allievo in realtà aggiunto, ma cercato nel repeater sbagliato → falso
  // PLAYER_ADD_NOT_CONFIRMED). Ora si cerca tra TUTTI gli input "TextBoxNombreValor"
  // e si ricava l'id cliente sostituendo, nello stesso id, "TextBoxNombreValor" →
  // "HiddenFieldIdCliente".
  // ⚠️ OSPITE / righe senza nome: alcuni partecipanti (es. il cliente "Ospite",
  // codice 000001) NON espongono il nome nel campo TextBoxNombreValor → il match per
  // solo-nome dava un falso PLAYER_ADD_NOT_CONFIRMED. Poiché il giocatore è agganciato
  // PER ID (lockedId = HiddenFieldIdPeople / codice cliente), confermiamo ANCHE per id:
  // una riga è valida se il suo HiddenFieldIdCliente combacia col codice cliente atteso
  // o con l'id agganciato (confronto su onlyDigits, ignora gli zeri iniziali).
  let addedIdCliente = null;
  let righeViste = [];
  // Verifica post-aggiunta con RETRY: il Repeater partecipanti (RepeaterParticipantes
  // → WUCUsuarioClase_Listado / WUCUsuarioPartida) si popola via postback async; una
  // lettura singola può arrivare PRIMA che la riga compaia → falso PLAYER_ADD_NOT_CONFIRMED.
  // È il caso "Lidia" su ficha LEZIONE nuova: l'allievo viene aggiunto ma la scansione,
  // letta troppo presto, trova `rows=(nessuna)`. Si ritenta la scansione per ~5s,
  // chiudendo eventuali avvisi swal residui ("importi in attesa") tra i tentativi.
  for (let vTry = 0; vTry < 5 && addedIdCliente === null; vTry++) {
    if (vTry > 0) {
      await dismissSwalOk(page, diagnostic, 'verify' + vTry);
      await mpWaitAsyncPostbackIdle(page, 4000).catch(() => {});
      await page.waitForTimeout(700);
    }
    const found = await scanParticipantRow(page, nome, wantCode, wantPeople);
    righeViste = found.righeViste;
    if (found.idCliente !== null) {
      addedIdCliente = found.idCliente; // riga confermata (per nome o per id); id può mancare
      diagnostic.steps.push(`player_row_match:${nome}:by=${found.matchBy}:idCli=${found.idCliente}:vtry=${vTry}`);
    }
    diagnostic.steps.push(`player_verify_scan:vtry=${vTry}:rows=${righeViste.length || '(nessuna)'}`);
  }
  diagnostic.partecipantiRighe = righeViste.slice(0, 30);

  if (addedIdCliente === null) {
    throw fail('PLAYER_ADD_NOT_CONFIRMED',
      `Giocatore ${nome} non trovato nelle righe partecipanti dopo l'aggiunta.`,
      diagnostic);
  }

  diagnostic.steps.push('player_added:' + nome);
  return { nome, added: true, idCliente: addedIdCliente, idPeople: lockedId, codiceCliente: expectedClientCode };
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

const OSSERVAZIONI_TEXTAREA = '#CC_Datos_FormViewFicha_TextBoxObservaciones';

// ── Helper: clicca il link-tab "Osservazioni" (postback ASP.NET) ──────────────
// ⚠️ NON usare getByText('Osservazioni'): match anche il contenitore "Generale
// Osservazioni" (un div senza onclick) → click a vuoto, niente postback. Si punta
// al vero <a> della tab: id-prefix `..._RepeaterPestanyas_LinkButtonPestanya_`
// stabile (il suffisso numerico varia: create=_1, edit=_4). Dopo il click si
// attende la comparsa del textarea (reso dal reload del pannello).
async function _clickOsservazioniTab(page, diagnostic) {
  const tabLink = page.locator('a[id*="RepeaterPestanyas_LinkButtonPestanya_"]')
    .filter({ hasText: /Osservazioni/i }).first();
  if (!(await tabLink.count().catch(() => 0))) {
    diagnostic.steps.push('osservazioni_tab_not_found');
    return false;
  }
  await Promise.all([
    page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {}),
    tabLink.click({ timeout: 6000 }).catch(() => {}),
  ]);
  diagnostic.steps.push('osservazioni_tab_click');
  await page.locator(OSSERVAZIONI_TEXTAREA).first()
    .waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  return true;
}

// ── Helper: scrive le Osservazioni (← note) nei form ficha ────────────────────
// Va chiamata PER ULTIMO, prima del salvataggio (i giocatori già inseriti restano
// nel viewstate). La manutenzione ha il textarea già visibile (nessuna tab) → fill
// diretto; partita/lezione richiedono prima il click sulla tab (postback).
async function fillOsservazioni(formCtx, page, note, diagnostic) {
  let visible = await formCtx.locator(OSSERVAZIONI_TEXTAREA).first().isVisible({ timeout: 800 }).catch(() => false);
  if (!visible) {
    await _clickOsservazioniTab(page, diagnostic);
    visible = await formCtx.locator(OSSERVAZIONI_TEXTAREA).first().isVisible({ timeout: 2000 }).catch(() => false);
  }
  if (!visible) {
    diagnostic.steps.push('osservazioni_textarea_absent');
    return false;
  }
  await formCtx.locator(OSSERVAZIONI_TEXTAREA).first().fill(String(note ?? ''), { timeout: 6000 }).catch(() => {});
  diagnostic.steps.push('osservazioni_set');
  return true;
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

// Post-save la Ficha (partita/lezione) espone l'idReserva nel campo nascosto
// `CC_Datos_HiddenFieldId`. Il postback ASP.NET può popolarlo con lieve ritardo →
// poll breve (≤maxMs). Ritorna l'id numerico o '' (→ fallback tabellone).
async function readReservaIdFromFicha(page, maxMs = 1200) {
  const deadline = Date.now() + maxMs;
  for (;;) {
    const v = await page.evaluate(() => {
      const el = document.getElementById('CC_Datos_HiddenFieldId');
      const s = el && el.value ? el.value.trim() : '';
      return /^\d+$/.test(s) ? s : '';
    }).catch(() => '');
    if (v) return v;
    if (Date.now() >= deadline) return '';
    await page.waitForTimeout(250);
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
  instrumentStepTiming(diagnostic);
  const acq = await mpAcquirePage(baseUrl, username, password, diagnostic);
  const page = acq.page;
  let _opFailed = false;
  try {
    page.setDefaultTimeout(12000);
    page.setDefaultNavigationTimeout(20000);
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
            ? { nome: g, codice: '', codiceCliente: '' }
            : { nome: (g && (g.nome || g.name)) || '', codice: (g && (g.codice || g.id)) || '', codiceCliente: (g && (g.codiceCliente || g.memberId)) || '' }
          ).filter((p) => p.nome)
        : (nome ? [{ nome, codice: booking.codice || '', codiceCliente: '' }] : []);
      diagnostic.playersRequested = players.map((p) => ({ nome: p.nome, codice: p.codice }));
      const playersResult = [];
      for (const p of players) {
        playersResult.push(await searchAndAddPlayer(formCtx, page, p.nome, diagnostic, undefined, p.codice, p.codiceCliente));
      }
      diagnostic.playersResult = playersResult;

      // 2b. Osservazioni (← note): per ultimo, prima del salvataggio.
      const notePartita = clean(booking.note || '');
      if (notePartita) await fillOsservazioni(formCtx, page, notePartita, diagnostic);

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

      // idReserva veloce: post-save la Ficha espone l'id nel campo nascosto
      // `CC_Datos_HiddenFieldId`. Se è numerico lo usiamo e saltiamo del tutto il
      // tabellone (~3.5s risparmiati). Fallback al lookup tabellone solo se vuoto.
      let _idReservaCreated = null;
      const _hiddenId = await readReservaIdFromFicha(page);
      if (_hiddenId) {
        _idReservaCreated = _hiddenId;
        diagnostic.steps.push(`idReserva_from_hidden:${_hiddenId}`);
        // Parcheggia la sessione warm sul tabellone: lasciarla sulla Ficha "fancy"
        // romperebbe la navigazione dell'op successiva (read/get-slots/sync 2min).
        // `commit` ritorna appena parte la navigazione (la coda serializza le op,
        // basta sganciarsi dalla Ficha) → quasi gratis.
        await page.goto(`${baseUrl}/Reservas/CuadroReservas.aspx?id_cuadro=3`, { waitUntil: 'commit', timeout: 20000 }).catch(() => {});
        diagnostic.steps.push('park_tabellone');
      } else {
        // Fallback: cattura idReserva dal tabellone (più lento ma affidabile)
        try {
          await page.goto(`${baseUrl}/Reservas/CuadroReservas.aspx?id_cuadro=3`, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await impostaDataTabellone(page, page, data, diagnostic, { fast: true });
          diagnostic.steps.push('cerca_idreserva');
          const _resEv = await page.evaluate(({ rec, oraStr }) => {
            const variants = [oraStr, oraStr.replace(/^0(\d:)/, '$1')];
            const eventi = [...document.querySelectorAll('div.evento')]
              .filter((e) => String(e.getAttribute('idrecurso')) === String(rec));
            const hit = eventi.find((e) => variants.some((v) => (e.innerText || '').includes(v)));
            return { id: hit ? hit.id : null };
          }, { rec: recurso, oraStr: ora });
          _idReservaCreated = _resEv.id || null;
          diagnostic.steps.push(`idReserva:${_idReservaCreated}`);
        } catch (err) {
          diagnostic.steps.push(`idReserva_lookup_error:${String(err.message || err)}`);
        }
      }

      const resolvedPlayers = playersResult
        .filter((r) => r.added && r.idPeople)
        .map((r) => ({ nome: r.nome, codiceCliente: r.codiceCliente, idPeople: r.idPeople }));
      return {
        ok: true,
        idReserva: _idReservaCreated,
        campo, data, ora, oraFine: oraFineCalc, nome, durata, tipo, istruttore,
        resolvedPlayers,
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
            ? { nome: g, codice: '', codiceCliente: '' }
            : { nome: (g && (g.nome || g.name)) || '', codice: (g && (g.codice || g.id)) || '', codiceCliente: (g && (g.codiceCliente || g.memberId)) || '' }
          ).filter((p) => p.nome)
        : (nome ? [{ nome, codice: booking.codice || '', codiceCliente: '' }] : []);
      diagnostic.playersRequested = players.map((p) => ({ nome: p.nome, codice: p.codice }));
      const playersResult = [];
      for (const p of players) {
        playersResult.push(await searchAndAddPlayer(formCtx, page, p.nome, diagnostic, LEZIONE_PLAYER_PFX, p.codice, p.codiceCliente));
      }
      diagnostic.playersResult = playersResult;

      // 2. Seleziona l'ISTRUTTORE per ultimo (il suo AutoPostBack resta dopo
      //    l'inserimento allievi). selectIstruttore attende già il networkidle.
      await selectIstruttore(formCtx, page, istruttore, diagnostic);

      // 3. NIENTE "Privato" nelle lezioni → non chiamare checkPrivatoCheckbox

      // 3b. Osservazioni (← note): per ultimo, prima del salvataggio.
      const noteLezione = clean(booking.note || '');
      if (noteLezione) await fillOsservazioni(formCtx, page, noteLezione, diagnostic);

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
      // idReserva veloce dal campo nascosto post-save (vedi ramo partita); fallback
      // al tabellone se vuoto. Stessa logica → ~3s risparmiati anche sulle lezioni.
      let _idReservaLezione = null;
      const _hiddenIdLez = await readReservaIdFromFicha(page);
      if (_hiddenIdLez) {
        _idReservaLezione = _hiddenIdLez;
        diagnostic.steps.push(`idReserva_from_hidden:${_hiddenIdLez}`);
        // Parcheggia la sessione warm sul tabellone (sgancia dalla Ficha fancy).
        await page.goto(`${baseUrl}/Reservas/CuadroReservas.aspx?id_cuadro=3`, { waitUntil: 'commit', timeout: 20000 }).catch(() => {});
        diagnostic.steps.push('park_tabellone');
      } else {
        try {
          await page.goto(`${baseUrl}/Reservas/CuadroReservas.aspx?id_cuadro=3`, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await impostaDataTabellone(page, page, data, diagnostic, { fast: true });
          diagnostic.steps.push('cerca_idreserva');
          const _resEvLezione = await page.evaluate(({ rec, oraStr }) => {
            const variants = [oraStr, oraStr.replace(/^0(\d:)/, '$1')];
            const eventi = [...document.querySelectorAll('div.evento')]
              .filter((e) => String(e.getAttribute('idrecurso')) === String(rec));
            const hit = eventi.find((e) => variants.some((v) => (e.innerText || '').includes(v)));
            return { id: hit ? hit.id : null };
          }, { rec: recurso, oraStr: ora });
          _idReservaLezione = _resEvLezione.id || null;
          diagnostic.steps.push(`idReserva:${_idReservaLezione}`);
        } catch (err) {
          diagnostic.steps.push(`idReserva_lookup_error:${String(err.message || err)}`);
        }
      }

      const resolvedPlayersLezione = playersResult
        .filter((r) => r.added && r.idPeople)
        .map((r) => ({ nome: r.nome, codiceCliente: r.codiceCliente, idPeople: r.idPeople }));
      return {
        ok: true,
        idReserva: _idReservaLezione,
        campo, data, ora, oraFine: oraFineCalc, nome, durata, tipo, istruttore,
        resolvedPlayers: resolvedPlayersLezione,
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

      // Cattura idReserva dal tabellone subito dopo la creazione (manutenzione)
      let _idReservaManutenzione = null;
      try {
        await page.goto(`${baseUrl}/Reservas/CuadroReservas.aspx?id_cuadro=3`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await impostaDataTabellone(page, page, data, diagnostic, { fast: true });
        diagnostic.steps.push('cerca_idreserva');
        const _resEvMan = await page.evaluate(({ rec, oraStr }) => {
          const variants = [oraStr, oraStr.replace(/^0(\d:)/, '$1')];
          const eventi = [...document.querySelectorAll('div.evento')]
            .filter((e) => String(e.getAttribute('idrecurso')) === String(rec));
          const hit = eventi.find((e) => variants.some((v) => (e.innerText || '').includes(v)));
          return { id: hit ? hit.id : null };
        }, { rec: recurso, oraStr: ora });
        _idReservaManutenzione = _resEvMan.id || null;
        diagnostic.steps.push(`idReserva:${_idReservaManutenzione}`);
      } catch (err) {
        diagnostic.steps.push(`idReserva_lookup_error:${String(err.message || err)}`);
      }

      return {
        ok: true,
        idReserva: _idReservaManutenzione,
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
    _opFailed = true;
    const urlStr = (() => { try { return page?.url() ?? '?'; } catch { return '?'; } })();
    const extra = ` | steps=${JSON.stringify(diagnostic.steps)} url=${urlStr}`;
    if (!err.message.includes('steps=')) err.message = `${err.message}${extra}`;
    if (!err.diagnostic) err.diagnostic = diagnostic;
    throw err;
  } finally {
    await acq.release(_opFailed);
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
  // note: stringa (anche vuota, per azzerare). null = campo non fornito → non toccare le Osservazioni.
  const note = (typeof input.note === 'string') ? input.note : null;
  const noteProvided = note !== null;
  // descrizione: SOLO manutenzione (TextBox2 = il testo visibile sul tabellone, es. "STAGE SANTIAGO").
  // stringa (anche vuota) = scrivi; null = non fornito → non toccare la descrizione.
  const descrizione = (typeof input.descrizione === 'string') ? input.descrizione : null;
  const descrizioneProvided = descrizione !== null;
  if (!move && !players && !readOnly && !noteProvided && !descrizioneProvided) throw fail('EDIT_NESSUNA_MODIFICA', 'Nessun blocco move/players/note/descrizione fornito.');

  const diagnostic = { mode: 'edit_booking', steps: [], input: { idReserva, campo: input.campo, data: input.data, ora: input.ora, move, players, noteProvided, descrizioneProvided } };
  instrumentStepTiming(diagnostic);
  let fichaUrl = null; // rilevata dopo il login: partita / lezione / manutenzione

  const acq = await mpAcquirePage(baseUrl, username, password, diagnostic);
  const page = acq.page;
  let _opFailed = false;
  try {
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
      // ⚠️ Imposta la data col metodo robusto (datepicker onSelect → ricarica AJAX
      // della griglia). Il vecchio `.value=` + eventi NON ricaricava la griglia per un
      // giorno diverso da oggi → una prenotazione di un altro giorno non veniva trovata.
      await impostaDataTabellone(page, page, input.data, diagnostic);

      diagnostic.steps.push('cerca_evento');
      const _resEvento = await page.evaluate(({ recurso: rec, ora }) => {
        const variants = [ora, ora.replace(/^0(\d:)/, '$1')];
        const _norm = (s) => { const m = String(s || '').match(/(\d{1,2}):(\d{2})/); return m ? `${m[1].padStart(2, '0')}:${m[2]}` : ''; };
        const _target = _norm(ora);
        const eventi = [...document.querySelectorAll('div.evento')]
          .filter((e) => String(e.getAttribute('idrecurso')) === String(rec));
        // Match per ATTRIBUTO `inicio` (l'orario dell'evento sta lì, NON nel testo: una card
        // che non scrive l'ora — es. "Ospite" — col vecchio innerText.includes non si trovava).
        // Fallback al testo per compatibilità.
        const hit = eventi.find((e) => {
          const ini = _norm(e.getAttribute('inicio'));
          if (_target && ini === _target) return true;
          const t = e.innerText || '';
          return variants.some((v) => t.includes(v));
        });
        return { id: hit ? hit.id : null, eventiRecurso: eventi.length, eventiTot: document.querySelectorAll('div.evento').length };
      }, { recurso, ora: input.ora });
      idReserva = _resEvento.id;
      diagnostic.steps.push(`cerca_evento_esito:recurso=${recurso}:eventiRecurso=${_resEvento.eventiRecurso}:eventiTot=${_resEvento.eventiTot}:found=${!!idReserva}`);

      if (!idReserva) throw fail('PRENOTAZIONE_NON_TROVATA',
        `Nessun evento su campo ${input.campo} (recurso ${recurso}) all'ora ${input.ora} del ${fechaTab}` +
        ` (griglia su ${diagnostic.dateShown || '?'}, eventi totali ${_resEvento.eventiTot}, su questo campo ${_resEvento.eventiRecurso}).`, diagnostic);
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
      await page.goto(cand, { waitUntil: 'domcontentloaded', timeout: 12000 });
      await page.waitForTimeout(300);
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

    // Repeater partecipanti dipendente dal tipo scheda: partita = WUCUsuarioPartida,
    // lezione = WUCUsuarioClase. Stessi soci, stessa ricerca per nome; cambia solo il
    // contenitore in pagina. ADD_PFX = controllo "aggiungi" del tipo giusto.
    const RP = fichaUrl.includes('ClaseSuelta') ? 'WUCUsuarioClase' : 'WUCUsuarioPartida';
    const ADD_PFX = `#CC_Datos_FormViewFicha_${RP}_Anyadir_`;
    diagnostic.steps.push('repeater_mode:' + RP);

    // === LETTURA SOLA (read) — restituisce i partecipanti attuali senza modificare nulla ===
    if (readOnly) {
      diagnostic.steps.push('read_only_roster');
      const partecipantiLettura = [];
      let ridx = 0;
      while (true) {
        const nomeInput = page.locator(
          `input[id*="RepeaterParticipantes_${RP}_Listado_${ridx}_TextBoxNombreValor_${ridx}"]`,
        );
        if (!(await nomeInput.count().catch(() => 0))) break;
        const nome = (await nomeInput.first().inputValue().catch(() => '')).trim();
        const idClienteInput = page.locator(
          `input[id*="RepeaterParticipantes_${RP}_Listado_${ridx}_HiddenFieldIdCliente_${ridx}"]`,
        );
        const idCliente = (await idClienteInput.first().inputValue().catch(() => '')).trim();
        const costoInput = page.locator(
          `input[id*="RepeaterParticipantes_${RP}_Listado_${ridx}_TextBoxCargoReserva_${ridx}"]`,
        );
        const costo = (await costoInput.first().inputValue().catch(() => '')).trim();
        // Stato economico (sola lettura): importo totale, pendente, saldo borsellino del giocatore.
        // Stato = "riscosso" se pendente=0, "in_sospeso" se pendente>0 (vedi Fase 0).
        const pendTxt = await page.locator(MP_PAYMENT_SELECTORS.partImportePendiente(ridx)).first().innerText({ timeout: 1500 }).catch(() => '');
        const totTxt = await page.locator(MP_PAYMENT_SELECTORS.partImporteTotale(ridx)).first().innerText({ timeout: 1500 }).catch(() => '');
        const saldoTxt = await page.locator(MP_PAYMENT_SELECTORS.partSaldoAttuale(ridx)).first().innerText({ timeout: 1500 }).catch(() => '');
        const pendenteCents = mpMoneyToCents(pendTxt);
        const importoCents = mpMoneyToCents(totTxt);
        const saldoCents = mpMoneyToCents(saldoTxt);
        const stato = pendenteCents == null ? null : (pendenteCents === 0 ? 'riscosso' : 'in_sospeso');
        partecipantiLettura.push({ idx: String(ridx), nome, idCliente, costo, importoCents, pendenteCents, saldoCents, stato });
        ridx++;
      }
      diagnostic.partecipantiFinali = partecipantiLettura;
      // Nota (Osservazioni): è dietro la tab → click (postback) + lettura del textarea.
      // Serve per la lettura on-demand (ripiego G1=no) e per pre-popolare la modifica.
      let notaLetta = null;
      try {
        const ta0 = page.locator(OSSERVAZIONI_TEXTAREA).first();
        if (!(await ta0.isVisible({ timeout: 600 }).catch(() => false))) {
          await _clickOsservazioniTab(page, diagnostic);
        }
        const ta = page.locator(OSSERVAZIONI_TEXTAREA).first();
        if (await ta.isVisible({ timeout: 4000 }).catch(() => false)) {
          notaLetta = (await ta.inputValue().catch(() => '')) || '';
        }
      } catch { /* nota non leggibile → null */ }
      diagnostic.steps.push('read_only_nota:' + (notaLetta == null ? 'null' : 'len' + notaLetta.length));
      // MANUTENZIONE — leggi anche la DESCRIZIONE (TextBox2): è il testo visibile sul tabellone.
      // Lettura via evaluate (niente auto-wait del locator: se assente torna null, no timeout lungo).
      let descrizioneLetta = null;
      if (fichaUrl.includes('Mantenimiento')) {
        descrizioneLetta = await page.evaluate(() => {
          const el = document.querySelector('#CC_Datos_FormViewFicha_TextBox2');
          return el ? (el.value || '') : null;
        }).catch(() => null);
        diagnostic.steps.push('read_only_descrizione:' + (descrizioneLetta == null ? 'null' : 'len' + descrizioneLetta.length));
      }
      diagnostic.steps.push('done');
      return { ok: true, idReserva, readOnly: true, partecipantiFinali: partecipantiLettura, note: notaLetta, descrizione: descrizioneLetta, diagnostic };
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

      // Ricarica Ficha pulita SOLO se seguono modifiche ai giocatori (per agganciare
      // l'autocomplete in modo affidabile). Per uno spostamento puro è ridondante:
      // subito dopo c'è verifica_reload che ricarica comunque la Ficha → si evita un reload.
      if (players) {
        diagnostic.steps.push('reload_after_move');
        await page.goto(fichaUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      }
    }

    // === MANUTENZIONE (descrizione + osservazioni) ===
    // La manutenzione non ha giocatori: ha la DESCRIZIONE (TextBox2, il testo del tabellone) e le
    // OSSERVAZIONI (TextBoxObservaciones). Le gestiamo qui, prima del ramo giocatori.
    let addResults = [];
    const isManutFicha = fichaUrl.includes('Mantenimiento');
    if (isManutFicha && (descrizioneProvided || noteProvided)) {
      if (descrizioneProvided) {
        await page.locator('#CC_Datos_FormViewFicha_TextBox2').first().fill(String(descrizione ?? ''), { timeout: 6000 }).catch(() => {});
        diagnostic.steps.push('manut_descrizione_set');
      }
      if (noteProvided) {
        // Sul form manutenzione il textarea Osservazioni è già visibile (nessuna tab) → fill diretto.
        await page.locator(OSSERVAZIONI_TEXTAREA).first().fill(String(note ?? ''), { timeout: 6000 }).catch(() => {});
        diagnostic.steps.push('manut_osservazioni_set');
      }
      // Salvataggio TOLLERANTE: la scheda di MODIFICA manutenzione può esporre ButtonActualizar
      // (update); se non c'è, ripieghiamo su clickFormSave (Salvare/Actualizar/Guardar/Insertar).
      diagnostic.steps.push('salva_manut');
      const _actBtn = page.locator('#CC_Datos_FormViewFicha_ButtonActualizar').first();
      if (await _actBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
        await Promise.all([
          page.waitForLoadState('networkidle', { timeout: 9000 }).catch(() => {}),
          _actBtn.click({ timeout: 10000 }),
        ]);
        diagnostic.submitSelector = '#CC_Datos_FormViewFicha_ButtonActualizar';
      } else {
        await clickFormSave(page, page, ['Salvare', 'Actualizar', 'Guardar'], diagnostic);
      }
      await page.waitForTimeout(2500);
    } else if (players) {
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
              `input[id*="RepeaterParticipantes_${RP}_Listado_${idx}_TextBoxNombreValor_${idx}"]`,
            );
            if (!(await nomeInput.count().catch(() => 0))) break;
            const nomeVal = (await nomeInput.first().inputValue().catch(() => '')).toLowerCase().trim();
            const doRemove = removeAll || removeNames.includes(nomeVal);
            if (doRemove) {
              diagnostic.steps.push(`elimina:${nomeVal}`);
              const elimBtn = page.locator(
                `#CC_Datos_FormViewFicha_RepeaterParticipantes_${RP}_Listado_${idx}_LinkButtonEliminar_${idx}`,
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

      // Dopo le RIMOZIONI il form ha subito postback: ricarica la Ficha pulita prima
      // delle AGGIUNTE, così l'autocomplete del giocatore si aggancia in modo affidabile
      // (senza, un add subito dopo un remove puo' lasciare HiddenFieldIdPeople vuoto).
      // NB: serve SOLO se seguono delle aggiunte. Per una rimozione pura il reload è
      // un giro a vuoto (una ricarica completa di Ficha) → si salta e si va al salvataggio.
      if ((removeAll || removeNames.length > 0) && (players.add || []).length > 0) {
        diagnostic.steps.push('reload_after_removals');
        await page.goto(fichaUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await page.waitForTimeout(800);
      }

      // AGGIUNTE
      for (const p of (players.add || [])) {
        const r = await searchAndAddPlayer(page, page, p.nome, diagnostic, ADD_PFX, p.codice, p.codiceCliente);
        addResults.push(r);
        diagnostic.steps.push(`add_result:${p.nome}:added=${r.added}`);

        // Imposta costo se fornito
        if (p.costo != null && r.added) {
          let idx = 0;
          while (true) {
            const nomeInput = page.locator(
              `input[id*="RepeaterParticipantes_${RP}_Listado_${idx}_TextBoxNombreValor_${idx}"]`,
            );
            if (!(await nomeInput.count().catch(() => 0))) break;
            const nomeVal = (await nomeInput.first().inputValue().catch(() => '')).toLowerCase().trim();
            if (nomeVal === p.nome.toLowerCase().trim()) {
              const costoField = page.locator(
                `#CC_Datos_FormViewFicha_RepeaterParticipantes_${RP}_Listado_${idx}_TextBoxCargoReserva_${idx}`,
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

      // Osservazioni (← note): riempi PRIMA del salvataggio giocatori → un solo save.
      if (noteProvided) await fillOsservazioni(page, page, note, diagnostic);

      // SALVA giocatori con ButtonActualizar (clic robusto: dismiss-swal + retry)
      diagnostic.steps.push('salva');
      await clickSaveActualizar(page, diagnostic, 'salva');
      await page.waitForTimeout(2500);
    } else if (noteProvided) {
      // Solo nota (eventualmente dopo un move): riempi le Osservazioni e salva con ButtonActualizar.
      await fillOsservazioni(page, page, note, diagnostic);
      diagnostic.steps.push('salva_nota');
      await clickSaveActualizar(page, diagnostic, 'salva_nota');
      await page.waitForTimeout(2500);
    }

    // === VERIFICA (reload + lettura) ===
    diagnostic.steps.push('verifica_reload');
    await page.goto(fichaUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

    const pageText = await page.evaluate(() => document.body.innerText || '').catch(() => '');

    // Leggi slot dal testo (best-effort, solo per diagnostica/visualizzazione)
    let slotFinale = null;
    if (move) {
      const normalizeHour = (hhmm) => (hhmm ? hhmm.replace(/^0(\d:)/, '$1') : '');
      const dataMatch = pageText.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{1,2}:\d{2})\s*[-–]?\s*(\d{1,2}:\d{2})/);
      const campoMatch = pageText.match(/Prenotazione\s+(Campo\s+\d+)/i) || pageText.match(/(Campo\s+\d+)/i);
      const campoName = campoMatch ? campoMatch[1] : null;
      slotFinale = dataMatch ? `${campoName || '?'} · ${dataMatch[1]} · ${dataMatch[2]}–${dataMatch[3]}` : null;
      diagnostic.slotFinale = slotFinale;

      // ── VERIFICA ROBUSTA dello spostamento ──────────────────────────────────
      // La vecchia verifica si fidava di UNA regex rigida (data-ora-ora adiacenti, separatori
      // fissi e PRIMO match nella pagina): una minima variazione di formato della Ficha — o un
      // altro orario presente nel testo — faceva scattare un FALSO EDIT_VERIFICA_FALLITA PUR
      // essendo lo spostamento applicato su Matchpoint. L'app faceva quindi il revert ottimistico
      // → lo slot restava vecchio in app ma spostato su MP (disallineamento cross-device).
      // Ora cerchiamo data e ora-inizio ATTESE in modo INDIPENDENTE e TOLLERANTE al formato:
      //  • entrambe presenti → confermato OK;
      //  • altrimenti, se la scheda mostra ANCORA lo slot di ORIGINE (e origine≠destinazione)
      //    → fallimento REALE (non spostato): solo qui falliamo;
      //  • altrimenti → inconcludente: NON falliamo (l'Actualizar è già andato a buon fine; il
      //    sync periodico riconcilia), lo segnaliamo solo nella diagnostica.
      const _dateForms = (iso) => { if (!iso) return []; const [y, m, d] = String(iso).split('-'); const dd = String(d).padStart(2, '0'), mm = String(m).padStart(2, '0'); return [`${dd}/${mm}/${y}`, `${+d}/${+m}/${y}`, `${dd}-${mm}-${y}`, `${dd}.${mm}.${y}`]; };
      const _hourForms = (h) => { if (!h) return []; const n = normalizeHour(h); const [hh, mi] = n.split(':'); return [n, `${String(hh).padStart(2, '0')}:${mi}`]; };
      const _present = (forms) => forms.length === 0 ? true : forms.some((f) => pageText.includes(f));
      const targetConfirmed = _present(_dateForms(move.data)) && _present(_hourForms(move.oraInizio));
      const sameAsOrigin = String(move.data || '') === String(input.data || '')
        && normalizeHour(move.oraInizio || '') === normalizeHour(input.ora || '');
      const stillAtOrigin = !sameAsOrigin && _present(_dateForms(input.data)) && _present(_hourForms(input.ora));
      if (targetConfirmed) {
        diagnostic.steps.push('move_verify_ok');
      } else if (stillAtOrigin) {
        throw fail('EDIT_VERIFICA_FALLITA',
          `Spostamento non applicato: la scheda mostra ancora lo slot di origine (${input.data} ${input.ora}).`, diagnostic);
      } else {
        diagnostic.moveVerifyInconclusive = true;
        diagnostic.steps.push('move_verify_inconclusive');
      }
    }

    // Scansiona righe partecipanti
    const partecipantiFinali = [];
    let idx = 0;
    while (true) {
      const nomeInput = page.locator(
        `input[id*="RepeaterParticipantes_${RP}_Listado_${idx}_TextBoxNombreValor_${idx}"]`,
      );
      if (!(await nomeInput.count().catch(() => 0))) break;
      const nome = (await nomeInput.first().inputValue().catch(() => '')).trim();
      const idClienteInput = page.locator(
        `input[id*="RepeaterParticipantes_${RP}_Listado_${idx}_HiddenFieldIdCliente_${idx}"]`,
      );
      const idCliente = (await idClienteInput.first().inputValue().catch(() => '')).trim();
      const costoInput = page.locator(
        `input[id*="RepeaterParticipantes_${RP}_Listado_${idx}_TextBoxCargoReserva_${idx}"]`,
      );
      const costo = (await costoInput.first().inputValue().catch(() => '')).trim();
      partecipantiFinali.push({ idx: String(idx), nome, idCliente, costo });
      idx++;
    }
    diagnostic.partecipantiFinali = partecipantiFinali;

    // Verifica giocatori vs richiesta — TOLLERANTE al formato del nome.
    if (players) {
      const _stripAccents = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
      const _tokens = (s) => _stripAccents(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
      // match per SOTTOINSIEME di token: "Anna" combacia con "Anna Verdi" e viceversa,
      // tollerante ad accenti/spazi/maiuscole. La verifica esatta del vecchio codice dava
      // falsi EDIT_VERIFICA_FALLITA quando la Ficha rendeva il nome in forma diversa.
      const _nameMatch = (a, b) => { const ta = _tokens(a), tb = _tokens(b); if (!ta.length || !tb.length) return false; const A = new Set(ta), B = new Set(tb); return ta.every((t) => B.has(t)) || tb.every((t) => A.has(t)); };
      const rosterNames = partecipantiFinali.map((p) => p.nome);
      // ADD: l'inserimento è già verificato a monte da searchAndAddPlayer (che fallisce con
      // PLAYER_ADD_NOT_CONFIRMED se non entra). Qui NON falliamo per un mancato match di nome:
      // confermiamo per sottoinsieme di token, altrimenti segnaliamo soltanto (soft-pass) per
      // non revertire un'aggiunta in realtà riuscita.
      for (const p of (players.add || [])) {
        if (!rosterNames.some((rn) => _nameMatch(rn, p.nome))) {
          diagnostic.addVerifyInconclusive = (diagnostic.addVerifyInconclusive || []).concat(p.nome);
          diagnostic.steps.push('add_verify_inconclusive:' + p.nome);
        }
      }
      // REMOVE: qui invece FALLIAMO se il giocatore risulta ANCORA presente. Il match per
      // sottoinsieme di token lo riconosce anche con formato diverso → niente falso "rimosso ok".
      if (!players.removeAll) {
        for (const nome of (players.remove || [])) {
          if (rosterNames.some((rn) => _nameMatch(rn, nome))) {
            throw fail('EDIT_VERIFICA_FALLITA',
              `Giocatore ${nome} doveva essere rimosso ma è ancora presente.`, diagnostic);
          }
        }
      }
    }

    diagnostic.steps.push('done');
    const resolvedPlayersEdit = addResults
      .filter((r) => r.added && r.idPeople)
      .map((r) => ({ nome: r.nome, codiceCliente: r.codiceCliente, idPeople: r.idPeople }));
    return { ok: true, idReserva, moved, slotFinale, partecipantiFinali, note: noteProvided ? note : undefined, descrizione: descrizioneProvided ? descrizione : undefined, resolvedPlayers: resolvedPlayersEdit, diagnostic };
  } catch (_e) {
    _opFailed = true;
    throw _e;
  } finally {
    await acq.release(_opFailed);
  }
}

// ── INCASSO pagamento partita (Fase 2b — SCRITTURA, DENARO REALE) ─────────────
// Helper: trova la riga partecipante per idCliente (HiddenFieldIdCliente = id URL,
// quello passato dall'app), fallback per nome. Ritorna ridx o null.
async function _findParticipantRow(page, RP, idClienteWanted, playerName) {
  const _digits = (s) => String(s || '').replace(/\D/g, '').replace(/^0+/, '');
  const _norm = (s) => String(s || '').toLowerCase().trim();
  const wantId = _digits(idClienteWanted);
  const righeViste = [];
  let ridx = 0;
  while (true) {
    const nomeInput = page.locator(`input[id*="RepeaterParticipantes_${RP}_Listado_${ridx}_TextBoxNombreValor_${ridx}"]`);
    if (!(await nomeInput.count().catch(() => 0))) break;
    const nome = (await nomeInput.first().inputValue().catch(() => '')).trim();
    const idCli = (await page.locator(`input[id*="RepeaterParticipantes_${RP}_Listado_${ridx}_HiddenFieldIdCliente_${ridx}"]`).first().inputValue().catch(() => '')).trim();
    righeViste.push(`${ridx}:${nome}#${idCli}`);
    const byId = !!wantId && _digits(idCli) === wantId;
    const byName = !byId && !!playerName && !!_norm(nome) && (_norm(nome).includes(_norm(playerName)) || _norm(playerName).includes(_norm(nome)));
    if (byId || byName) return { ridx, idCliente: idCli, matchBy: byId ? 'id' : 'name', righeViste };
    ridx++;
  }
  return { ridx: null, idCliente: null, matchBy: null, righeViste };
}

async function _readPendenteCents(page, ridx) {
  const txt = await page.locator(MP_PAYMENT_SELECTORS.partImportePendiente(ridx)).first().innerText({ timeout: 1500 }).catch(() => '');
  return mpMoneyToCents(txt);
}

// Dialog "Incassare" = forma-de-pago a PULSANTI (testo visibile). Click per testo.
// Le etichette (Contanti/Carta/Saldo disponibile) sono uniche tra i pulsanti del
// dialog → has-text (substring) è robusto. ⚠️ Il DOM esatto del dialog si conferma
// solo dal vivo: lascio diagnostica ricca e più selettori di ripiego.
async function _clickCobroMethod(page, methodLabel, diagnostic) {
  await page.waitForTimeout(400); // lascia aprire il dialog dopo il postback di Cobrar
  const tries = [
    `button:visible:has-text("${methodLabel}")`,
    `a:visible:has-text("${methodLabel}")`,
    `[onclick]:visible:has-text("${methodLabel}")`,
    `:is(button,a,div,span,label):visible:has-text("${methodLabel}")`,
  ];
  for (const sel of tries) {
    const loc = page.locator(sel);
    const n = await loc.count().catch(() => 0);
    if (n) {
      try {
        await loc.first().click({ timeout: 6000 });
        diagnostic.steps.push('cobro_method:' + methodLabel);
        await page.waitForTimeout(300);
        return;
      } catch (e) {
        diagnostic.steps.push('cobro_method_retry:' + String((e && e.message) || e).slice(0, 40));
      }
    }
  }
  throw fail('FORMA_PAGO_NON_TROVATA', `Pulsante metodo "${methodLabel}" non trovato nel dialog incasso.`, diagnostic);
}

// Apre la scheda partita/lezione, trova il partecipante, (opz.) corregge l'importo
// a carico (TextBoxCargoReserva → Actualizar), poi "Incassare" (LinkButtonCobrar) →
// metodo per testo nel dialog → salva con Actualizar. NON-IDEMPOTENTE: NIENTE retry.
// Kill-switch env MATCHPOINT_PAYMENT_WRITE_ENABLED (default OFF) = backstop
// server-side: con OFF l'endpoint rifiuta senza mai cobrare.
async function collectPaymentWithBrowser(input = {}) {
  const username = clean(input.username) || env('MATCHPOINT_USERNAME');
  const password = clean(input.password) || env('MATCHPOINT_PASSWORD');
  if (!username || !password) throw fail('MATCHPOINT_WORKER_SECRETS_MISSING', 'Mancano credenziali Matchpoint nel worker.');

  const baseUrl = clean(input.baseUrl) || env('MATCHPOINT_BASE_URL', DEFAULT_BASE_URL);
  const idReserva = input.idReserva ? String(input.idReserva) : null;
  const idClienteWanted = clean(input.idCliente);
  const playerName = clean(input.playerName);
  const method = clean(input.method).toLowerCase(); // cash | card | wallet
  const amountCents = (input.amountCents != null && Number.isFinite(Number(input.amountCents))) ? Math.round(Number(input.amountCents)) : null;
  const methodLabel = {
    cash: MP_PAYMENT_SELECTORS.cobroMethodLabels.contanti,
    card: MP_PAYMENT_SELECTORS.cobroMethodLabels.carta,
    wallet: MP_PAYMENT_SELECTORS.cobroMethodLabels.borsellino,
  }[method];

  const diagnostic = { mode: 'collect_payment', steps: [], input: { idReserva, idCliente: idClienteWanted, method, amountCents } };
  instrumentStepTiming(diagnostic);

  // Validazioni DURE prima di toccare il browser (mai un cobro a vuoto).
  if (!idReserva) throw fail('PARAMS_MANCANTI', 'idReserva richiesto per incassare.', diagnostic);
  if (!idClienteWanted && !playerName) throw fail('PARAMS_MANCANTI', 'idCliente o playerName richiesto per identificare il giocatore.', diagnostic);
  if (!methodLabel) throw fail('METODO_NON_VALIDO', `Metodo "${method}" non valido (atteso cash|card|wallet).`, diagnostic);
  if (amountCents == null || amountCents <= 0) throw fail('IMPORTO_NON_VALIDO', 'amountCents deve essere un intero > 0.', diagnostic);

  // KILL-SWITCH server-side: con OFF (default) NON si incassa MAI.
  if (!boolEnv('MATCHPOINT_PAYMENT_WRITE_ENABLED', false)) {
    throw fail('PAYMENT_WRITE_DISABLED', 'Scrittura pagamenti disattivata sul worker (kill-switch MATCHPOINT_PAYMENT_WRITE_ENABLED=OFF).', diagnostic);
  }

  const acq = await mpAcquirePage(baseUrl, username, password, diagnostic);
  const page = acq.page;
  let _opFailed = false;
  try {
    // Apri la scheda (partita o lezione) — auto-detect come edit-booking.
    diagnostic.steps.push('goto_ficha');
    const fichaCandidates = [
      `${baseUrl}/Reservas/FichaPartidaPagoPorUsuario.aspx?modo=fancy&id=${idReserva}`,
      `${baseUrl}/ClasesYCursos/FichaClaseSueltaPorUsuario.aspx?modo=fancy&id=${idReserva}`,
    ];
    let fichaUrl = null;
    for (const cand of fichaCandidates) {
      await page.goto(cand, { waitUntil: 'domcontentloaded', timeout: 12000 });
      await page.waitForTimeout(300);
      const hasExtender = await page.locator('#CC_Datos_FormViewFicha_ButtonExtender').count().catch(() => 0);
      if (hasExtender) { fichaUrl = cand; break; }
    }
    if (!fichaUrl) throw fail('FICHA_NON_TROVATA', `Scheda partita/lezione non trovata per id ${idReserva}.`, diagnostic);
    const RP = fichaUrl.includes('ClaseSuelta') ? 'WUCUsuarioClase' : 'WUCUsuarioPartida';
    diagnostic.steps.push('ficha:' + (RP === 'WUCUsuarioClase' ? 'lezione' : 'partita'));

    // Trova la riga del partecipante (preferisci idCliente, fallback nome).
    const found = await _findParticipantRow(page, RP, idClienteWanted, playerName);
    if (found.ridx == null) {
      throw fail('GIOCATORE_NON_TROVATO', `Partecipante (idCliente ${idClienteWanted || '-'} / "${playerName || '-'}") non trovato nella scheda.`, Object.assign({}, diagnostic, { righeViste: found.righeViste }));
    }
    let ridx = found.ridx;
    let idClienteReale = found.idCliente || idClienteWanted;
    diagnostic.steps.push(`row:${ridx}:matchBy=${found.matchBy}`);

    // GUARDIA ANTI-DOPPIO: già riscosso (pendente=0) → non incassare di nuovo.
    let pend = await _readPendenteCents(page, ridx);
    diagnostic.steps.push('pendente_pre:' + pend);
    if (pend === 0) {
      return { ok: false, code: 'ALREADY_PAID', idReserva, idCliente: idClienteReale, message: 'Giocatore già riscosso su Matchpoint: nessun incasso effettuato.', diagnostic };
    }

    // (opz.) Correggi importo a carico → salva → ri-scansiona (il postback ridisegna le righe).
    const cargoSel0 = `input[id*="RepeaterParticipantes_${RP}_Listado_${ridx}_TextBoxCargoReserva_${ridx}"]`;
    const curTxt = (await page.locator(cargoSel0).first().inputValue().catch(() => '')).trim();
    const curCents = mpMoneyToCents(curTxt);
    if (curCents !== amountCents) {
      const itAmount = (amountCents / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      await page.locator(cargoSel0).first().fill(itAmount, { timeout: 6000 });
      diagnostic.steps.push(`cargo_set:${curCents}->${amountCents}`);
      await clickSaveActualizar(page, diagnostic, 'set_cargo');
      await page.goto(fichaUrl, { waitUntil: 'domcontentloaded', timeout: 12000 });
      await page.waitForTimeout(300);
      const re = await _findParticipantRow(page, RP, idClienteReale, playerName);
      if (re.ridx == null) throw fail('GIOCATORE_NON_TROVATO', 'Partecipante non più trovato dopo l\'aggiornamento importo.', diagnostic);
      ridx = re.ridx; idClienteReale = re.idCliente || idClienteReale;
      pend = await _readPendenteCents(page, ridx);
      diagnostic.steps.push(`row_after_cargo:${ridx}:pendente=${pend}`);
      if (pend === 0) {
        return { ok: false, code: 'ALREADY_PAID', idReserva, idCliente: idClienteReale, message: 'Giocatore risulta già riscosso dopo l\'aggiornamento importo.', diagnostic };
      }
    }

    // INCASSA: click "Incassare" → dialog forma-de-pago → click metodo per testo.
    diagnostic.steps.push('cobrar_click');
    await dismissSwalOk(page, diagnostic, 'cobro_pre');
    await page.locator(MP_PAYMENT_SELECTORS.partIncassaBtn(ridx)).first().click({ timeout: 12000 });
    await _clickCobroMethod(page, methodLabel, diagnostic);

    // Salva il cobro con Actualizar (clic robusto anti-swal2).
    await clickSaveActualizar(page, diagnostic, 'salva_cobro');

    // Verifica esito: ri-leggi pendente per la riga (riscosso = 0).
    await page.goto(fichaUrl, { waitUntil: 'domcontentloaded', timeout: 12000 });
    await page.waitForTimeout(300);
    const reAfter = await _findParticipantRow(page, RP, idClienteReale, playerName);
    const pendAfter = reAfter.ridx != null ? await _readPendenteCents(page, reAfter.ridx) : null;
    const statoPost = pendAfter == null ? null : (pendAfter === 0 ? 'riscosso' : 'in_sospeso');
    diagnostic.steps.push('pendente_post:' + pendAfter);
    diagnostic.steps.push('done');
    return { ok: true, idReserva, idCliente: idClienteReale, method, methodLabel, amountCents, statoPost, pendentePostCents: pendAfter, diagnostic };
  } catch (_e) {
    _opFailed = true;
    throw _e;
  } finally {
    await acq.release(_opFailed);
  }
}

// ── STORNO pagamento (Fase 2b — SCRITTURA, denaro reale: annulla un cobro) ─────
// Helper: conferma un dialog "Sei sicuro?" (swal2 o pulsanti Sì/Confermare/Aceptar).
async function _confirmDialogYes(page, diagnostic, tag) {
  await page.waitForTimeout(300);
  // 1) swal2 confirm (il più probabile su MP)
  const swal = page.locator('.swal2-confirm:visible').first();
  if (await swal.count().catch(() => 0)) {
    try { await swal.click({ timeout: 4000 }); diagnostic.steps.push(`${tag}_confirm:swal`); await page.waitForTimeout(300); return true; } catch (e) { /* fallthrough */ }
  }
  // 2) pulsanti per testo
  for (const lab of ['Sì', 'Si', 'Sí', 'Confermare', 'Conferma', 'Accettare', 'Accetta', 'Aceptar', 'OK']) {
    const loc = page.locator(`button:visible:has-text("${lab}"), a:visible:has-text("${lab}")`).first();
    if (await loc.count().catch(() => 0)) {
      try { await loc.click({ timeout: 3000 }); diagnostic.steps.push(`${tag}_confirm:${lab}`); await page.waitForTimeout(300); return true; } catch (e) { /* prova prossima */ }
    }
  }
  diagnostic.steps.push(`${tag}_confirm:none`);
  return false;
}

// Raccoglie i possibili "aggancia" per l'annullo pagamento (per diagnostica live: la UI
// "anular pago" non è ancora mappata dal vivo → al primo storno restituiamo i candidati).
async function _collectAnularCandidates(page) {
  return await page.evaluate(() => {
    const out = [];
    const els = [...document.querySelectorAll('a,button,input[type="button"],input[type="submit"]')];
    for (const el of els) {
      const txt = (el.innerText || el.value || '').replace(/\s+/g, ' ').trim();
      const id = el.id || '';
      const onclick = el.getAttribute('onclick') || '';
      if (/annull|anular|storn|reembols|devol|reintegr/i.test(txt + ' ' + id + ' ' + onclick)) {
        const vis = !!(el.offsetParent || el.getClientRects().length);
        out.push({ txt: txt.slice(0, 40), id: id.slice(0, 80), vis });
      }
    }
    return out.slice(0, 25);
  }).catch(() => []);
}

// Trova e clicca il controllo "annulla pagamento" del giocatore. La scheda partita ha i
// campi hidden HiddenFieldIdPagoAnular / HiddenFieldConfirmaAnularPago (Fase 0): il link
// di annullo è verosimilmente nella tab Pagamenti/Movimenti o accanto alla riga riscossa.
// ⚠️ DOM non mappato dal vivo → tentativi multipli + (se nulla) diagnostica coi candidati.
async function _clickAnularPago(page, diagnostic) {
  // Prova ad aprire la tab Pagamenti / Movimenti (dove sono elencati i cobros) — best effort.
  for (const tabTxt of ['Pagamenti', 'Movimenti', 'Pagos', 'Movimientos']) {
    const tab = page.locator(`a:visible:has-text("${tabTxt}"), li:visible:has-text("${tabTxt}") a:visible`).first();
    if (await tab.count().catch(() => 0)) {
      try { await tab.click({ timeout: 3000 }); await page.waitForTimeout(500); diagnostic.steps.push('anular_tab:' + tabTxt); break; } catch (e) { /* prova prossima */ }
    }
  }
  await dismissSwalOk(page, diagnostic, 'anular_pre');
  const tries = [
    'a[id*="Anular"]:visible',
    '[id*="LinkButtonAnular"]:visible',
    '[onclick*="Anular"]:visible',
    'a:visible:has-text("Annulla pagamento")',
    'a:visible:has-text("Annulla")',
    'a:visible:has-text("Anular")',
    'a:visible:has-text("Storna")',
    'button:visible:has-text("Annulla")',
  ];
  for (const sel of tries) {
    const loc = page.locator(sel).first();
    if (await loc.count().catch(() => 0)) {
      try {
        await loc.click({ timeout: 5000 });
        diagnostic.steps.push('anular_click:' + sel.slice(0, 24));
        await _confirmDialogYes(page, diagnostic, 'anular');
        return true;
      } catch (e) {
        diagnostic.steps.push('anular_retry:' + String((e && e.message) || e).slice(0, 40));
      }
    }
  }
  const candidates = await _collectAnularCandidates(page);
  throw fail('ANULAR_UI_NON_TROVATA', 'Controllo "annulla pagamento" non trovato nella scheda (DOM da mappare dal vivo).', Object.assign({}, diagnostic, { anularCandidates: candidates }));
}

// Annulla (storna) un cobro già effettuato per un giocatore. Riapre la scheda, verifica
// che sia RISCOSSO, clicca l'annullo, conferma, salva, e verifica che il pendente torni > 0.
// Stesso KILL-SWITCH del cobro (MATCHPOINT_PAYMENT_WRITE_ENABLED). NON-IDEMPOTENTE: no retry.
async function voidPaymentWithBrowser(input = {}) {
  const username = clean(input.username) || env('MATCHPOINT_USERNAME');
  const password = clean(input.password) || env('MATCHPOINT_PASSWORD');
  if (!username || !password) throw fail('MATCHPOINT_WORKER_SECRETS_MISSING', 'Mancano credenziali Matchpoint nel worker.');

  const baseUrl = clean(input.baseUrl) || env('MATCHPOINT_BASE_URL', DEFAULT_BASE_URL);
  const idReserva = input.idReserva ? String(input.idReserva) : null;
  const idClienteWanted = clean(input.idCliente);
  const playerName = clean(input.playerName);

  const diagnostic = { mode: 'void_payment', steps: [], input: { idReserva, idCliente: idClienteWanted } };
  instrumentStepTiming(diagnostic);

  if (!idReserva) throw fail('PARAMS_MANCANTI', 'idReserva richiesto per stornare.', diagnostic);
  if (!idClienteWanted && !playerName) throw fail('PARAMS_MANCANTI', 'idCliente o playerName richiesto per identificare il giocatore.', diagnostic);

  // KILL-SWITCH server-side (condiviso col cobro): con OFF (default) non si storna MAI.
  if (!boolEnv('MATCHPOINT_PAYMENT_WRITE_ENABLED', false)) {
    throw fail('PAYMENT_WRITE_DISABLED', 'Scrittura pagamenti disattivata sul worker (kill-switch MATCHPOINT_PAYMENT_WRITE_ENABLED=OFF).', diagnostic);
  }

  const acq = await mpAcquirePage(baseUrl, username, password, diagnostic);
  const page = acq.page;
  let _opFailed = false;
  try {
    diagnostic.steps.push('goto_ficha');
    const fichaCandidates = [
      `${baseUrl}/Reservas/FichaPartidaPagoPorUsuario.aspx?modo=fancy&id=${idReserva}`,
      `${baseUrl}/ClasesYCursos/FichaClaseSueltaPorUsuario.aspx?modo=fancy&id=${idReserva}`,
    ];
    let fichaUrl = null;
    for (const cand of fichaCandidates) {
      await page.goto(cand, { waitUntil: 'domcontentloaded', timeout: 12000 });
      await page.waitForTimeout(300);
      const hasExtender = await page.locator('#CC_Datos_FormViewFicha_ButtonExtender').count().catch(() => 0);
      if (hasExtender) { fichaUrl = cand; break; }
    }
    if (!fichaUrl) throw fail('FICHA_NON_TROVATA', `Scheda partita/lezione non trovata per id ${idReserva}.`, diagnostic);
    const RP = fichaUrl.includes('ClaseSuelta') ? 'WUCUsuarioClase' : 'WUCUsuarioPartida';
    diagnostic.steps.push('ficha:' + (RP === 'WUCUsuarioClase' ? 'lezione' : 'partita'));

    const found = await _findParticipantRow(page, RP, idClienteWanted, playerName);
    if (found.ridx == null) {
      throw fail('GIOCATORE_NON_TROVATO', `Partecipante (idCliente ${idClienteWanted || '-'} / "${playerName || '-'}") non trovato nella scheda.`, Object.assign({}, diagnostic, { righeViste: found.righeViste }));
    }
    const idClienteReale = found.idCliente || idClienteWanted;
    diagnostic.steps.push(`row:${found.ridx}:matchBy=${found.matchBy}`);

    // Si può stornare SOLO se è stato riscosso (pendente == 0).
    const pend = await _readPendenteCents(page, found.ridx);
    diagnostic.steps.push('pendente_pre:' + pend);
    if (pend !== 0) {
      return { ok: false, code: 'NOTHING_TO_VOID', idReserva, idCliente: idClienteReale, message: 'Nessun pagamento riscosso da stornare per questo giocatore.', diagnostic };
    }

    // Annulla il pagamento + conferma + salva.
    await _clickAnularPago(page, diagnostic);
    await clickSaveActualizar(page, diagnostic, 'salva_storno');

    // Verifica: dopo lo storno il pendente deve tornare > 0 (stato in_sospeso).
    await page.goto(fichaUrl, { waitUntil: 'domcontentloaded', timeout: 12000 });
    await page.waitForTimeout(300);
    const reAfter = await _findParticipantRow(page, RP, idClienteReale, playerName);
    const pendAfter = reAfter.ridx != null ? await _readPendenteCents(page, reAfter.ridx) : null;
    const statoPost = pendAfter == null ? null : (pendAfter === 0 ? 'riscosso' : 'in_sospeso');
    diagnostic.steps.push('pendente_post:' + pendAfter);
    diagnostic.steps.push('done');
    return { ok: true, idReserva, idCliente: idClienteReale, statoPost, pendentePostCents: pendAfter, diagnostic };
  } catch (_e) {
    _opFailed = true;
    throw _e;
  } finally {
    await acq.release(_opFailed);
  }
}

// ── STORNO / Correzione borsellino (Fase 2b — SCRITTURA, denaro reale) ─────────
// Apre la sezione "Fatturazione e pagamenti" → sotto-tab "Saldo" (ledger borsellino),
// dove vivono i pulsanti Ricarica credito / Correzione del saldo / ...
async function _openWalletSaldoLedger(page, diagnostic) {
  for (const lab of [MP_PAYMENT_SELECTORS.walletBillingTab, 'Facturación y pagos', 'Fatturazione']) {
    const tab = page.locator(`a:visible:has-text("${lab}")`).first();
    if (await tab.count().catch(() => 0)) {
      try { await tab.click({ timeout: 4000 }); await page.waitForTimeout(700); diagnostic.steps.push('wallet_tab:' + lab); break; } catch (e) { /* prova prossima */ }
    }
  }
  for (const lab of MP_PAYMENT_SELECTORS.walletSaldoSubTabLabels) {
    const sub = page.locator(`a:visible:has-text("${lab}"), li:visible:has-text("${lab}") a:visible`).first();
    if (await sub.count().catch(() => 0)) {
      try { await sub.click({ timeout: 4000 }); await page.waitForTimeout(700); diagnostic.steps.push('wallet_subtab:' + lab); return true; } catch (e) { /* prova prossima */ }
    }
  }
  diagnostic.steps.push('wallet_subtab:none');
  return false;
}

// Candidati DOM per il pulsante "Correzione del saldo" (e affini) — mappatura dal vivo.
async function _collectCorrezioneCandidates(page) {
  return await page.evaluate(() => {
    const out = [];
    const els = [...document.querySelectorAll('a,button,input[type="button"],input[type="submit"]')];
    for (const el of els) {
      const txt = (el.innerText || el.value || '').replace(/\s+/g, ' ').trim();
      const id = el.id || '';
      const onclick = el.getAttribute('onclick') || '';
      if (/corre[czs]ion|correggi|saldo|ricarica|rimbors|reembols|storn|ajust/i.test(txt + ' ' + id + ' ' + onclick)) {
        const vis = !!(el.offsetParent || el.getClientRects().length);
        out.push({ txt: txt.slice(0, 50), id: id.slice(0, 90), vis });
      }
    }
    return out.slice(0, 30);
  }).catch(() => []);
}

// Candidati dei CAMPI/pulsanti VISIBILI (verosimilmente del dialog correzione) — mappatura dialog.
async function _collectDialogFieldCandidates(page) {
  return await page.evaluate(() => {
    const visible = (el) => !!(el.offsetParent || el.getClientRects().length);
    const fields = [...document.querySelectorAll('input,select,textarea')].filter(visible).map((el) => ({
      tag: el.tagName.toLowerCase(), type: String(el.type || '').slice(0, 16),
      id: String(el.id || '').slice(0, 90), name: String(el.name || '').slice(0, 90), ph: String(el.placeholder || '').slice(0, 40),
    }));
    const buttons = [...document.querySelectorAll('button,input[type="button"],input[type="submit"],a')].filter(visible)
      .map((el) => ({ btn: (el.innerText || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 40), id: String(el.id || '').slice(0, 80) }))
      .filter((b) => b.btn);
    return { fields: fields.slice(0, 30), buttons: buttons.slice(0, 30) };
  }).catch(() => ({ fields: [], buttons: [] }));
}

// Storna (totale o parziale) il saldo del borsellino via "Correzione del saldo".
// idInterno = id URL FichaCliente; subtractCents = importo da sottrarre (>0).
// Stesso KILL-SWITCH del cobro/storno partita (MATCHPOINT_PAYMENT_WRITE_ENABLED).
// ⚠️ DIAGNOSTIC-FIRST: il dialog "Correzione del saldo" non è ancora mappato dal vivo →
// il worker lo APRE e restituisce i candidati DOM (campi + pulsanti) SENZA inviare nulla
// (mai un movimento di denaro alla cieca). Dopo la mappatura live si aggiunge qui il
// fill importo + conferma + verifica saldo, in 1 iterazione (vedi handoff). NON-IDEMPOTENTE.
async function correctWalletWithBrowser(input = {}) {
  const username = clean(input.username) || env('MATCHPOINT_USERNAME');
  const password = clean(input.password) || env('MATCHPOINT_PASSWORD');
  if (!username || !password) throw fail('MATCHPOINT_WORKER_SECRETS_MISSING', 'Mancano credenziali Matchpoint nel worker.');

  const baseUrl = clean(input.baseUrl) || env('MATCHPOINT_BASE_URL', DEFAULT_BASE_URL);
  const idInterno = clean(input.idInterno || input.idCliente || input.id || '');
  const subtractCents = (input.subtractCents != null && Number.isFinite(Number(input.subtractCents))) ? Math.round(Number(input.subtractCents)) : null;

  const diagnostic = { mode: 'correct_wallet', steps: [], input: { idInterno, subtractCents } };
  instrumentStepTiming(diagnostic);

  if (!/^\d{1,8}$/.test(idInterno)) throw fail('INVALID_CLIENT_ID', 'idCliente (id interno Matchpoint) richiesto per lo storno borsellino.', diagnostic);
  if (subtractCents == null || subtractCents <= 0) throw fail('IMPORTO_NON_VALIDO', 'subtractCents deve essere un intero > 0.', diagnostic);

  // KILL-SWITCH server-side condiviso con cobro/storno partita: con OFF (default) non si storna MAI.
  if (!boolEnv('MATCHPOINT_PAYMENT_WRITE_ENABLED', false)) {
    throw fail('PAYMENT_WRITE_DISABLED', 'Scrittura pagamenti disattivata sul worker (kill-switch MATCHPOINT_PAYMENT_WRITE_ENABLED=OFF).', diagnostic);
  }

  const acq = await mpAcquirePage(baseUrl, username, password, diagnostic);
  const page = acq.page;
  let _opFailed = false;
  try {
    diagnostic.steps.push('open_ficha');
    await page.goto(absoluteUrl(baseUrl, `/Clientes/FichaCliente.aspx?id=${encodeURIComponent(idInterno)}`), { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1000);

    // Saldo borsellino PRE (per guardia + verifica post-mappatura).
    const preTxt = await page.locator(MP_PAYMENT_SELECTORS.walletSaldoLabel).first().innerText({ timeout: 6000 }).catch(() => '');
    const currentCents = mpMoneyToCents(preTxt);
    diagnostic.walletTextPre = preTxt;
    diagnostic.steps.push('saldo_pre:' + currentCents);
    if (currentCents == null) throw fail('WALLET_BALANCE_NOT_FOUND', 'Saldo Portafoglio non leggibile sulla scheda cliente.', diagnostic);
    if (currentCents === 0) {
      return { ok: false, code: 'NOTHING_TO_VOID', idCliente: idInterno, currentCents, message: 'Borsellino già a 0: niente da stornare.', diagnostic };
    }
    if (subtractCents > currentCents) {
      return { ok: false, code: 'IMPORTO_ECCEDE_SALDO', idCliente: idInterno, currentCents, subtractCents, message: 'Importo di storno superiore al saldo disponibile.', diagnostic };
    }
    const targetCents = currentCents - subtractCents;
    diagnostic.targetCents = targetCents;

    // Apri il ledger "Saldo" del borsellino.
    await _openWalletSaldoLedger(page, diagnostic);

    // Clicca "Correzione del saldo" (candidati testo). Se non c'è → candidati DOM.
    await dismissSwalOk(page, diagnostic, 'corr_pre');
    let opened = false;
    for (const lab of MP_PAYMENT_SELECTORS.walletCorrezioneLabels) {
      const loc = page.locator(`a:visible:has-text("${lab}"), button:visible:has-text("${lab}"), input[type="button"][value*="${lab}"]:visible`).first();
      if (await loc.count().catch(() => 0)) {
        try { await loc.click({ timeout: 5000 }); diagnostic.steps.push('corr_click:' + lab); await page.waitForTimeout(800); opened = true; break; }
        catch (e) { diagnostic.steps.push('corr_retry:' + String((e && e.message) || e).slice(0, 40)); }
      }
    }
    if (!opened) {
      const candidates = await _collectCorrezioneCandidates(page);
      throw fail('WALLET_CORRECTION_UI_NON_TROVATA', 'Pulsante "Correzione del saldo" non trovato (DOM da mappare dal vivo).', Object.assign({}, diagnostic, { correzioneCandidates: candidates }));
    }

    // DIALOG aperto ma NON mappato → restituisci i candidati (campi + pulsanti) senza
    // inviare. Dopo la mappatura live, qui andrà: fill importo (subtractCents o targetCents),
    // _confirmDialogYes, ri-lettura saldo == targetCents. NIENTE movimento alla cieca.
    const dlg = await _collectDialogFieldCandidates(page);
    diagnostic.dialogFields = dlg.fields;
    diagnostic.dialogButtons = dlg.buttons;
    throw fail('WALLET_CORRECTION_DIALOG_NON_MAPPATO', 'Dialog "Correzione del saldo" aperto ma non ancora mappato: nessun importo inviato. Mappare campi dal vivo.', Object.assign({}, diagnostic, { currentCents, subtractCents, targetCents }));
  } catch (_e) {
    _opFailed = true;
    throw _e;
  } finally {
    await acq.release(_opFailed);
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
  instrumentStepTiming(diagnostic);

  const acq = await mpAcquirePage(baseUrl, username, password, diagnostic);
  const page = acq.page;
  let _opFailed = false;
  try {
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
      // ⚠️ Imposta la data col metodo robusto (datepicker onSelect → ricarica AJAX
      // della griglia). Il vecchio `.value=` + eventi NON ricaricava la griglia per un
      // giorno diverso da oggi → una prenotazione di un altro giorno non veniva trovata.
      await impostaDataTabellone(page, page, input.data, diagnostic);

      diagnostic.steps.push('cerca_evento');
      const _resEvento = await page.evaluate(({ recurso: rec, ora }) => {
        const variants = [ora, ora.replace(/^0(\d:)/, '$1')];
        const _norm = (s) => { const m = String(s || '').match(/(\d{1,2}):(\d{2})/); return m ? `${m[1].padStart(2, '0')}:${m[2]}` : ''; };
        const _target = _norm(ora);
        const eventi = [...document.querySelectorAll('div.evento')]
          .filter((e) => String(e.getAttribute('idrecurso')) === String(rec));
        // Match per ATTRIBUTO `inicio` (l'orario dell'evento sta lì, NON nel testo: una card
        // che non scrive l'ora — es. "Ospite" — col vecchio innerText.includes non si trovava).
        // Fallback al testo per compatibilità.
        const hit = eventi.find((e) => {
          const ini = _norm(e.getAttribute('inicio'));
          if (_target && ini === _target) return true;
          const t = e.innerText || '';
          return variants.some((v) => t.includes(v));
        });
        return { id: hit ? hit.id : null, eventiRecurso: eventi.length, eventiTot: document.querySelectorAll('div.evento').length };
      }, { recurso, ora: input.ora });
      idReserva = _resEvento.id;
      diagnostic.steps.push(`cerca_evento_esito:recurso=${recurso}:eventiRecurso=${_resEvento.eventiRecurso}:eventiTot=${_resEvento.eventiTot}:found=${!!idReserva}`);

      if (!idReserva) throw fail('PRENOTAZIONE_NON_TROVATA',
        `Nessun evento su campo ${input.campo} (recurso ${recurso}) all'ora ${input.ora} del ${fechaTab}` +
        ` (griglia su ${diagnostic.dateShown || '?'}, eventi totali ${_resEvento.eventiTot}, su questo campo ${_resEvento.eventiRecurso}).`, diagnostic);
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
      await page.goto(cand, { waitUntil: 'domcontentloaded', timeout: 12000 });
      await page.waitForTimeout(300);
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
    // PARTITA / LEZIONE / MANUTENZIONE: il click apre l'iframe fancybox anularreserva.aspx con ButtonAnular.
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
  } catch (_e) {
    _opFailed = true;
    throw _e;
  } finally {
    await acq.release(_opFailed);
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
        () => mpReadRetry(`poller ${isoDate}`, () => getSlotsWithBrowser({ date: isoDate })),
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
          '/export-clients', '/export-booking-history', '/get-slots', '/export-slot-schedule', '/read-tabellone',
          '/create-booking', '/cancel-booking', '/edit-booking', '/collect-payment', '/void-payment', '/correct-wallet', '/create-client', '/update-client', '/disable-client', '/reactivate-client', '/debug-find-client', '/read-wallet', '/export-wallet-report', '/export-payments-report',
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
    if (req.method === 'POST' && req.url === '/read-tabellone') {
      return await handleReadTabellone(req, res);
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
    if (req.method === 'POST' && req.url === '/collect-payment') {
      return await handleCollectPayment(req, res);
    }
    if (req.method === 'POST' && req.url === '/void-payment') {
      return await handleVoidPayment(req, res);
    }
    if (req.method === 'POST' && req.url === '/correct-wallet') {
      return await handleCorrectWallet(req, res);
    }
    if (req.method === 'POST' && req.url === '/create-client') {
      return await handleCreateClient(req, res);
    }
    if (req.method === 'POST' && req.url === '/update-client') {
      return await handleUpdateClient(req, res);
    }
    if (req.method === 'POST' && req.url === '/disable-client') {
      return await handleDisableClient(req, res);
    }
    if (req.method === 'POST' && req.url === '/reactivate-client') {
      return await handleReactivateClient(req, res);
    }
    if (req.method === 'POST' && req.url === '/read-wallet') {
      return await handleReadWallet(req, res);
    }
    if (req.method === 'POST' && req.url === '/export-wallet-report') {
      return await handleExportWalletReport(req, res);
    }
    if (req.method === 'POST' && req.url === '/export-payments-report') {
      return await handleExportPaymentsReport(req, res);
    }
    if (req.method === 'POST' && req.url === '/debug-find-client') {
      return await handleDebugFindClient(req, res);
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
  // Scalda la sessione Matchpoint subito dopo il boot: la prima op reale dopo un
  // deploy/restart non paga il login a freddo (~13s). Non blocca il listen.
  mpWarmStartup().catch(() => {});
  // Mantiene la sessione sempre calda: rebuild proattivo prima del tetto 30 min,
  // così nessuna op utente paga il login a freddo dopo inattività.
  startWarmKeepalive();
});
