import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { collectTabelloneOnlyOccupancies } from './tabellone-rescue.ts';

type JsonMap = Record<string, any>;

type StaffActor = {
  userId: string;
  email: string;
  role: string;
  permissions: JsonMap;
};

type MatchpointExport = {
  bytes: Uint8Array;
  filename: string;
  contentType: string;
  finalUrl: string;
  diagnostic: JsonMap;
  mode?: string;
  range?: JsonMap;
};

type ParsedBooking = {
  numero: string;
  giocatore: string;
  giocatori?: string[];
  idReserva?: string;
  data: string;
  ora: string;
  durata: string;
  campo: string;
  tipo: string;
  descrizione: string;
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pmo-routine-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const REQUIRED_BOOKING_COLUMNS = ['Nome', 'Numero', 'Giorno', 'Ora', 'Ore', 'Spazio'];
const DEFAULT_BASE_URL = 'https://app-padelvillage-it.matchpoint.com.es';
const DEFAULT_FUTURE_DAYS = 30;
const PAGE_SIZE = 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function okResponse(body: JsonMap) {
  return json({ ok: true, ...body });
}

// Canale broadcast staff-cal: derivato dall'ambiente come fa l'app (pv-staff-cal-<env>).
// Override via secret STAFFCAL_RT_CHANNEL; altrimenti dal project ref in SUPABASE_URL
// (PROD => -prod, tutto il resto incl. TEST => -test). Su TEST resta 'pv-staff-cal-test'.
function staffCalChannel(): string {
  const explicit = (Deno.env.get('STAFFCAL_RT_CHANNEL') ?? '').trim();
  if (explicit) return explicit;
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  return url.includes('qqbfphyslczzkxoncgex') ? 'pv-staff-cal-prod' : 'pv-staff-cal-test';
}

// Broadcast realtime sul canale che l'app ascolta: sveglia gli altri device. Best-effort.
// Stesso pattern di matchpoint-bookings-cancel (evento 'staff-changed', private:false).
async function notifyStaffCalRealtime(supabaseUrl: string, supabaseKey: string, source: string, extra: JsonMap = {}) {
  const channel = staffCalChannel();
  try {
    const res = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        messages: [{ topic: channel, event: 'staff-changed', payload: { ts: Date.now(), source, ...extra }, private: false }],
      }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(JSON.stringify({ event: 'realtime_broadcast_http_error', channel, status: res.status, body: errBody.slice(0, 500) }));
    } else {
      console.log(JSON.stringify({ event: 'realtime_broadcast_ok', channel, status: res.status }));
    }
  } catch (e) {
    console.error(JSON.stringify({ event: 'realtime_broadcast_failed', channel, error: errorText(e) }));
  }
}

function errorResponse(status: number, code: string, message: string, extra: JsonMap = {}) {
  return json({ ok: false, error: code, message: errorText(message), ...extra }, status);
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function errorText(value: unknown) {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message || value.name || String(value);
  if (value && typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value ?? '');
}

function compactSpaces(value: unknown) {
  return clean(value).replace(/\s+/g, ' ');
}

function normalizeKey(value: unknown) {
  return compactSpaces(value)
    .toLocaleLowerCase('it-IT')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function normalizeHeader(value: unknown) {
  return normalizeKey(value);
}

function normalizeText(value: unknown) {
  return compactSpaces(value)
    .toLocaleLowerCase('it-IT')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s:.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCell(row: JsonMap, names: string[]) {
  const normalized = new Map<string, string>();
  Object.keys(row || {}).forEach((key) => normalized.set(normalizeHeader(key), key));
  for (const name of names) {
    const key = normalized.get(normalizeHeader(name));
    if (key !== undefined) return row[key];
  }
  return '';
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return formatLocalDate(value);
  if (typeof value === 'number' && Number.isFinite(value) && value > 20000 && value < 60000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    excelEpoch.setUTCDate(excelEpoch.getUTCDate() + Math.floor(value));
    return `${excelEpoch.getUTCFullYear()}-${String(excelEpoch.getUTCMonth() + 1).padStart(2, '0')}-${String(excelEpoch.getUTCDate()).padStart(2, '0')}`;
  }
  const raw = clean(value);
  if (!raw) return '';
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slash) {
    const year = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
    return `${year}-${slash[2].padStart(2, '0')}-${slash[1].padStart(2, '0')}`;
  }
  const dash = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dash) return `${dash[3]}-${dash[2].padStart(2, '0')}-${dash[1].padStart(2, '0')}`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : formatLocalDate(parsed);
}

function parseTimeValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    let totalMinutes: number | null = null;
    if (value > 0 && value < 1) totalMinutes = Math.round(value * 24 * 60);
    else if (Number.isInteger(value) && value >= 100 && value <= 2359 && value % 100 < 60) totalMinutes = Math.floor(value / 100) * 60 + (value % 100);
    else if (value >= 0 && value < 24) totalMinutes = Math.round(value * 60);
    else if (value >= 24 && value < 1440) totalMinutes = Math.round(value);
    if (totalMinutes !== null) {
      totalMinutes = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
      return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
    }
  }
  let raw = clean(value).replace(/\./g, ':');
  if (!raw) return '';
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(raw) || /^\d{4}-\d{1,2}-\d{1,2}$/.test(raw)) return '';
  const compact = raw.match(/^([01]?\d|2[0-3])([0-5]\d)$/);
  if (compact) return `${compact[1].padStart(2, '0')}:${compact[2]}`;
  const timeMatch = raw.match(/(?:^|\D)([01]?\d|2[0-3])[:](\d{1,2})(?::\d{1,2})?(?:\D|$)/);
  if (timeMatch) return `${timeMatch[1].padStart(2, '0')}:${timeMatch[2].padStart(2, '0')}`;
  const hour = raw.match(/^([01]?\d|2[0-3])$/);
  return hour ? `${hour[1].padStart(2, '0')}:00` : '';
}

function parseBookingDurationMinutes(value: unknown, fallbackMinutes = 90) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    if (value > 0 && value < 1) return Math.max(30, Math.round(value * 24 * 60));
    if (value >= 30) return Math.max(30, Math.round(value));
    return Math.max(30, Math.round(value * 60));
  }
  const text = clean(value).toLowerCase().replace(',', '.');
  if (!text) return fallbackMinutes;
  const hhmm = text.match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?$/);
  if (hhmm) return Math.max(30, (parseInt(hhmm[1], 10) || 0) * 60 + (parseInt(hhmm[2], 10) || 0));
  const number = parseFloat(text);
  if (Number.isFinite(number) && number > 0) {
    if (number > 0 && number < 1) return Math.max(30, Math.round(number * 24 * 60));
    if (number >= 30) return Math.max(30, Math.round(number));
    return Math.max(30, Math.round(number * 60));
  }
  return fallbackMinutes;
}

function extractBookingField(row: JsonMap) {
  const direct = clean(getCell(row, [
    'Spazio', 'Campo', 'Field', 'Court', 'Risorsa', 'Resource', 'Campo/Spazio',
    'Spazio prenotato', 'Campo prenotato', 'Campo/risorsa',
  ]));
  const values = Object.values(row || {}).map(clean);
  const directMatch = direct.match(/\b(?:campo|court|c)\s*([1-4])\b/i);
  if (directMatch) return `Campo ${directMatch[1]}`;
  for (const value of values) {
    const match = value.match(/\b(?:campo|court|c)\s*([1-4])\b/i);
    if (match) return `Campo ${match[1]}`;
  }
  const rowText = normalizeText(values.join(' '));
  if (rowText.includes('manutenz') || rowText.includes('blocco') || rowText.includes('chiusura')) return '__ALL_FIELDS__';
  return direct;
}

function fieldOccupancyKey(booking: ParsedBooking) {
  const numero = normalizeText(booking?.numero || '');
  const data = booking?.data || '';
  const ora = booking?.ora || '';
  const campo = normalizeText(booking?.campo || '');
  const durata = String(parseBookingDurationMinutes(booking?.durata, 90));
  if (numero) return `numero:${numero}|data:${data}|ora:${ora}|campo:${campo}`;
  return [
    data,
    ora,
    campo,
    durata,
    normalizeText(booking?.tipo || ''),
    normalizeText(booking?.descrizione || ''),
    normalizeText(booking?.giocatore || ''),
  ].join('|');
}

function bookingKey(booking: ParsedBooking) {
  const numero = normalizeText(booking.numero || '');
  const giocatore = normalizeText(booking.giocatore || '');
  const data = booking.data || '';
  const ora = booking.ora || '';
  const campo = normalizeText(booking.campo || '');
  if (numero) return `numero:${numero}_giocatore:${giocatore}`;
  return `${giocatore}_${data}_${ora}_${campo}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as JsonMap).sort().map((key) => `${JSON.stringify(key)}:${stableStringify((value as JsonMap)[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function shortHash(value: unknown) {
  const text = stableStringify(value);
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h) ^ text.charCodeAt(i);
  return (h >>> 0).toString(36);
}

function bookingCloudKey(row: ParsedBooking, index: number, prefix = 'booking') {
  const parts = [prefix, row?.numero, row?.data, row?.ora, row?.campo, row?.giocatore, row?.durata].map(clean).filter(Boolean);
  return parts.length > 2 ? parts.join('|') : `${prefix}|${index}|${shortHash(row)}`;
}

function parseBookingRows(rows: JsonMap[]) {
  const seen = new Set<string>();
  const occupancySeen = new Set<string>();
  let skipped = 0;
  const occupancyBookings: ParsedBooking[] = [];
  const mapped: ParsedBooking[] = (rows || []).map((row) => ({
    numero: clean(getCell(row, ['Numero', 'N. prenotazione', 'Prenotazione'])),
    giocatore: clean(getCell(row, ['Nome', 'Giocatore', 'Utente', 'Cliente'])),
    data: parseDateValue(getCell(row, ['Giorno', 'Data', 'Date', 'Data prenotazione'])),
    ora: parseTimeValue(getCell(row, ['Ora', 'Time', 'Orario', 'Ora inizio', 'Inizio', 'Dalle'])),
    durata: clean(getCell(row, ['Ore', 'Durata', 'Duration', 'Durata prenotazione'])).replace(',', '.') || '1.5',
    campo: extractBookingField(row),
    tipo: clean(getCell(row, ['Tipo', 'Tipologia', 'Descrizione', 'Servizio', 'Categoria'])),
    descrizione: clean(getCell(row, ['Descrizione', 'Note', 'Oggetto', 'Causale'])),
  }));

  for (const booking of mapped) {
    if (!booking.data || !booking.ora || !booking.campo) continue;
    const occKey = fieldOccupancyKey(booking);
    if (occupancySeen.has(occKey)) continue;
    occupancySeen.add(occKey);
    occupancyBookings.push(booking);
  }

  const bookings = mapped.filter((booking) => {
    if (!booking.giocatore || !booking.data || !booking.ora || !booking.campo) {
      skipped += 1;
      return false;
    }
    if (normalizeText(booking.giocatore) === 'ospite') {
      skipped += 1;
      return false;
    }
    const key = bookingKey(booking);
    if (seen.has(key)) {
      skipped += 1;
      return false;
    }
    seen.add(key);
    return true;
  });

  return { bookings, occupancyBookings, occupancyRows: occupancyBookings.length, skipped };
}

function workbookRows(bytes: Uint8Array) {
  const workbook = XLSX.read(bytes, { type: 'array', cellDates: true });
  if (!workbook.SheetNames.includes('Risultati')) {
    return { ok: false as const, error: 'SHEET_MISSING', message: 'Il file non contiene il foglio Risultati.', sheetNames: workbook.SheetNames };
  }
  const sheet = workbook.Sheets.Risultati;
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as unknown[][];
  const headers = (matrix[0] || []).map((item) => clean(item));
  const normalizedHeaders = new Set(headers.map(normalizeHeader));
  const missing = REQUIRED_BOOKING_COLUMNS.filter((name) => !normalizedHeaders.has(normalizeHeader(name)));
  if (missing.length) {
    return { ok: false as const, error: 'BOOKINGS_COLUMNS_MISSING', message: 'Il file non contiene le colonne minime delle prenotazioni future.', missing, headers, sheetNames: workbook.SheetNames };
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }) as JsonMap[];
  return { ok: true as const, rows, headers, sheetName: 'Risultati' };
}

function todayIsoRome() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function parseIsoDate(value: unknown) {
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

function addDaysIso(isoDate: string, days: number) {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return '';
  const [year, month, day] = parsed.split('-').map((item) => parseInt(item, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function validateFutureBookingsWorkbook(bytes: Uint8Array) {
  const parsed = workbookRows(bytes);
  if (!parsed.ok) return parsed;

  const result = parseBookingRows(parsed.rows);
  if (!result.occupancyBookings.length) {
    return {
      ok: false as const,
      error: 'NO_IMPORTABLE_BOOKING_ROWS',
      message: 'Il file prenotazioni future e leggibile ma non contiene occupazioni importabili.',
      sourceRows: parsed.rows.length,
      skipped: result.skipped,
      occupancyRows: result.occupancyRows,
    };
  }
  if (parsed.rows.length && result.occupancyBookings.length / parsed.rows.length < 0.05) {
    return {
      ok: false as const,
      error: 'LOW_BOOKING_ROW_RATIO',
      message: 'Troppe poche righe sembrano prenotazioni future valide: import bloccato.',
      sourceRows: parsed.rows.length,
      importableRows: result.bookings.length,
      skipped: result.skipped,
      occupancyRows: result.occupancyRows,
    };
  }

  const dates = result.occupancyBookings.map((item) => item.data).filter(Boolean).sort();
  const today = todayIsoRome();
  const pastRows = result.occupancyBookings.filter((item) => item.data && item.data < today).length;
  const futureOrTodayRows = result.occupancyBookings.filter((item) => item.data && item.data >= today).length;
  if (pastRows && !futureOrTodayRows) {
    return {
      ok: false as const,
      error: 'ONLY_PAST_BOOKING_ROWS',
      message: 'Il file contiene solo date passate: sembra uno storico, non prenotazioni future.',
      sourceRows: parsed.rows.length,
      importableRows: result.bookings.length,
      occupancyRows: result.occupancyRows,
      skipped: result.skipped,
      fromDate: dates[0] || '',
      toDate: dates[dates.length - 1] || '',
    };
  }
  return {
    ok: true as const,
    bookings: result.bookings,
    occupancyBookings: result.occupancyBookings,
    headers: parsed.headers,
    sheetName: parsed.sheetName,
    sourceRows: parsed.rows.length,
    importableRows: result.bookings.length,
    occupancyRows: result.occupancyRows,
    skipped: result.skipped,
    fromDate: dates[0] || '',
    toDate: dates[dates.length - 1] || '',
    warnings: { pastRows, futureOrTodayRows },
  };
}

function bytesFromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function workerBaseUrl(rawUrl: string) {
  return rawUrl.replace(/\/+$/, '').replace(/\/export-clients$/i, '').replace(/\/export-booking-history$/i, '');
}

function workerBookingExportUrl(rawUrl: string) {
  return `${workerBaseUrl(rawUrl)}/export-booking-history`;
}

function workerHealthUrl(rawUrl: string) {
  return `${workerBaseUrl(rawUrl)}/health`;
}

// ROSTER AUTOREVOLE = la descrizione dell'export Excel Matchpoint (es. "-Santiago Carabajal."
// o "-Ospite.-Andrea Antoniazzi.-Stefano Borsoi."). È la fonte di verità di CHI è sulla
// prenotazione: combacia sempre con ciò che l'operatore vede su Matchpoint. L'arricchimento dal
// tabellone (/read-tabellone) è invece non-deterministico (settle/fullest-wins) e può introdurre
// nomi fantasma o, in caso di disallineamento cella↔prenotazione, un roster del tutto sbagliato.
// Qui estraiamo i nomi SOLO quando la descrizione ha il formato lista "-Nome.-Nome." (inizia con
// '-'); i titoli liberi (es. "Torneo aziendale") non iniziano con '-' → ritorniamo [] e si lascia
// decidere al tabellone.
function playersFromDescrizione(descr: string | undefined | null): string[] {
  const text = String(descr || '').trim();
  if (!text.startsWith('-')) return [];
  return text
    .split('.')
    .map((s) => s.replace(/^-+/, '').trim())
    .filter(Boolean);
}

async function enrichBookingsWithTabellone(
  bookings: ParsedBooking[],
  workerUrl: string,
  workerApiKey: string,
  username: string,
  password: string,
  baseUrl: string,
  opts: { fullWindow?: boolean; settleMaxMs?: number } = {},
): Promise<void> {
  // fullWindow=true (tick "full", periodico): leggiamo il tabellone per OGNI giorno futuro
  // (oggi..+DEFAULT_FUTURE_DAYS), non solo i prenotati. Motivo: la MANUTENZIONE vive solo sul
  // tabellone e un giorno di SOLA manutenzione altrimenti non verrebbe mai letto (bug "sabato
  // sì / domenica no"). Su questi tick la riconciliazione manutenzione resta coerente.
  // fullWindow=false (tick "light", frequente): SOLO i giorni con prenotazioni → arricchiamo
  // roster/idReserva dei booking reali senza pagare la navigazione dei giorni vuoti. La
  // manutenzione NON viene toccata qui (l'add è gated sotto e il reconcile non la tombstona).
  const fullWindow = opts.fullWindow !== false;
  const today = todayIsoRome();
  const dateSet = new Set<string>();
  if (fullWindow) {
    for (let i = 0; i <= DEFAULT_FUTURE_DAYS; i++) dateSet.add(addDaysIso(today, i));
  }
  for (const b of bookings) { if (b.data && b.data >= today) dateSet.add(b.data); }
  const dates = [...dateSet].sort();

  if (!dates.length) return;

  const endpoint = `${workerBaseUrl(workerUrl)}/read-tabellone`;
  let tabelloneData: Record<string, Array<{ id?: string; campo: number; ora: string; giocatori: string[] }>> = {};

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${workerApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      // settleMaxMs (se fornito) accorcia l'attesa di assestamento roster per-giorno → sync
      // più rapido, sotto il limite 150s dell'edge. Il worker lo legge da options.settleMaxMs.
      body: JSON.stringify({ username, password, baseUrl, dates, ...(opts.settleMaxMs ? { settleMaxMs: opts.settleMaxMs } : {}) }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data?.ok && data?.result) tabelloneData = data.result;
    }
  } catch (err) {
    console.warn(JSON.stringify({ event: 'tabellone_enrich_failed', error: String(err) }));
    return; // non bloccante
  }

  // Arricchisce ogni booking con i giocatori + idReserva (Tappa 43). Il ROSTER è AUTOREVOLE dalla
  // descrizione (fonte MP): se presente in formato lista, vince sempre sul tabellone — così i nomi
  // fantasma o i roster sbagliati introdotti dallo scrape del tabellone non finiscono sulla card.
  // Il tabellone resta usato per il roster SOLO quando la descrizione non è una lista di nomi
  // (occupazioni senza descrizione) e SEMPRE per l'idReserva (che l'export Excel non fornisce).
  const matchedKeys = new Set<string>();
  for (const booking of bookings) {
    const dayData = tabelloneData[booking.data] || [];
    const campoNum = Number(String(booking.campo).replace(/\D/g, '')) || 0;
    const match = dayData.find(
      (ev) => ev.campo === campoNum && ev.ora === booking.ora,
    );
    const descPlayers = playersFromDescrizione(booking.descrizione);
    if (descPlayers.length) {
      booking.giocatori = descPlayers;
    } else if (match && match.giocatori.length) {
      booking.giocatori = match.giocatori;
    }
    if (match) {
      if (match.id) booking.idReserva = String(match.id);
      matchedKeys.add(`${booking.data}|${campoNum}|${booking.ora}`);
    }
  }

  // Tick "light": abbiamo scrapato solo i giorni prenotati → NON ricalcolare la manutenzione
  // (i giorni di sola manutenzione non sono stati letti). La manutenzione esistente resta
  // com'è: il reconcile NON la tombstona sui light tick (vedi handler principale). Il tick
  // "full" periodico la ri-aggiunge/riconcilia sull'intera finestra.
  if (!fullWindow) return;

  // MANUTENZIONE (import 2026-06-19): i blocchi del tabellone marcati 'manutenzione' (senza
  // giocatori, solo eventuale nota) NON sono nell'export Excel → li aggiungiamo come occupancy
  // con tipo 'manutenzione', così l'app li mostra e li tratta come slot occupati. Il worker li
  // marca con ev.tipo==='manutenzione' e ev.nota. Saltiamo quelli già coperti da una prenotazione.
  const toMin = (t: string) => { const m = String(t || '').match(/(\d{1,2})[:.](\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : NaN; };
  let added = 0;
  try {
    for (const [data, evs] of Object.entries(tabelloneData)) {
      for (const ev of (evs || [])) {
        if ((ev as any).tipo !== 'manutenzione') continue;
        const campoNum = Number(ev.campo) || 0;
        if (!campoNum || !ev.ora) continue;
        if (matchedKeys.has(`${data}|${campoNum}|${ev.ora}`)) continue;
        const mins = toMin((ev as any).oraFine) - toMin(ev.ora);
        const oreStr = (Number.isFinite(mins) && mins > 0) ? String(mins / 60) : '1.5';
        bookings.push({
          numero: '',
          giocatore: '',
          data,
          ora: ev.ora,
          durata: oreStr,
          campo: `Campo ${campoNum}`,
          tipo: 'manutenzione',
          descrizione: String((ev as any).nota || ''),
        } as ParsedBooking);
        added += 1;
      }
    }
  } catch (err) {
    console.warn(JSON.stringify({ event: 'manutenzione_occupancy_failed', error: String(err) }));
  }
  console.log(JSON.stringify({ event: 'manutenzione_occupancy_added', added }));

  // LEZIONI SENZA GIOCATORI (fix "campo Libero mentre su Matchpoint c'è la lezione"): gli eventi
  // del tabellone privi di riga nell'export (tipicamente lezioni senza giocatori) diventano
  // occupancy, così lo slot risulta occupato in app. Logica + sicurezze anti-fantasma nel modulo
  // puro tabellone-rescue.ts (testato). Marcate `_tabelloneOnly:true` → come la manutenzione:
  // aggiunte SOLO su full tick e il reconcile NON le tombstona sui light tick (vedi handler),
  // così non lampeggiano.
  const exportNumeri = new Set(bookings.map((b) => clean(b.numero || '')).filter(Boolean));
  const rescuedLezioni = collectTabelloneOnlyOccupancies(tabelloneData, matchedKeys, exportNumeri);
  for (const r of rescuedLezioni) bookings.push(r as unknown as ParsedBooking);
  console.log(JSON.stringify({ event: 'lezione_senza_giocatori_added', added: rescuedLezioni.length }));
}

async function exportFutureBookingsViaBrowserWorker(): Promise<MatchpointExport> {
  const workerUrl = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_URL') || '');
  const workerApiKey = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_API_KEY') || '');
  if (!workerUrl || !workerApiKey) {
    throw errorWithDiagnostic('MATCHPOINT_BROWSER_WORKER_SECRETS_MISSING', {
      hasWorkerUrl: !!workerUrl,
      hasWorkerApiKey: !!workerApiKey,
    });
  }
  const username = clean(Deno.env.get('MATCHPOINT_USERNAME') || '');
  const password = clean(Deno.env.get('MATCHPOINT_PASSWORD') || '');
  if (!username || !password) throw new Error('MATCHPOINT_SECRETS_MISSING');

  const baseUrl = (Deno.env.get('MATCHPOINT_BASE_URL') || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const fromDate = todayIsoRome();
  const toDate = addDaysIso(fromDate, DEFAULT_FUTURE_DAYS);
  const endpoint = workerBookingExportUrl(workerUrl);
  const healthEndpoint = workerHealthUrl(workerUrl);
  const requestBody = JSON.stringify({
    username,
    password,
    baseUrl,
    days: DEFAULT_FUTURE_DAYS,
    fromDate,
    toDate,
    credentialSource: 'supabase_secret',
  });
  let payload: JsonMap = {};
  let lastDiagnostic: JsonMap = {};

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (attempt > 1) {
      await fetch(healthEndpoint, { headers: { Accept: 'application/json' } }).catch(() => null);
      await sleep(attempt === 2 ? 3000 : 7000);
    }

    let response: Response | null = null;
    let text = '';
    let networkError = '';
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${workerApiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: requestBody,
      });
      text = await response.text();
    } catch (error) {
      networkError = errorText(error);
    }

    payload = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text.slice(0, 800) }; }
    lastDiagnostic = {
      attempt,
      status: response?.status || 0,
      endpoint,
      healthEndpoint,
      networkError,
      workerError: payload.error || '',
      workerMessage: payload.message || '',
      workerDiagnostic: payload.diagnostic || null,
    };

    if (response?.ok && payload.ok === true && payload.base64) break;
    if (attempt >= 3) throw errorWithDiagnostic('MATCHPOINT_BROWSER_WORKER_FAILED', lastDiagnostic);
    // Il worker ritorna HTTP 500 per i suoi fail() interni (navigazione finita per
    // sbaglio sulla home invece che sul report, pulsante export non trovato, login
    // glitch, download vuoto…): sono per lo più TRANSITORI (Matchpoint lento/redirect
    // occasionale) e un ritentativo con backoff di norma riesce — confermato sul campo.
    // Prima si ritentava solo su 502/503/504, quindi un singolo 500 transitorio emergeva
    // subito come errore. Ora si ritenta anche sul 500 con codice worker transitorio; NON
    // sugli errori logici (secret/credenziali mancanti, che un retry non risolverebbe).
    const workerCode = String(payload.error || '');
    const transientWorkerCode = !!workerCode && !/SECRETS_MISSING|CREDENTIALS_MISSING/i.test(workerCode);
    const retryable = !response || response.status === 0 || [502, 503, 504].includes(response.status)
      || (response.status === 500 && transientWorkerCode);
    if (!retryable) throw errorWithDiagnostic('MATCHPOINT_BROWSER_WORKER_FAILED', lastDiagnostic);
  }

  return {
    bytes: bytesFromBase64(clean(payload.base64)),
    filename: clean(payload.filename) || `matchpoint-prenotazioni-future-${fromDate}-${toDate}.xlsx`,
    contentType: clean(payload.contentType) || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    finalUrl: clean(payload.diagnostic?.historyResultsUrl || payload.diagnostic?.downloadUrl || endpoint),
    mode: 'browser_worker_headless',
    range: payload.range || { fromDate, toDate, days: DEFAULT_FUTURE_DAYS },
    diagnostic: {
      mode: 'browser_worker_headless',
      worker: payload.diagnostic || null,
    },
  };
}

async function authenticateStaff(req: Request, supabaseUrl: string, anonKey: string): Promise<StaffActor> {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('AUTH_REQUIRED');
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData?.user) throw new Error('AUTH_REQUIRED');
  const { data: profileData, error: profileError } = await authClient.rpc('pmo_get_my_staff_profile');
  if (profileError) throw new Error(profileError.message || 'AUTH_REQUIRED');
  const profile = Array.isArray(profileData) ? profileData[0] : profileData;
  if (!profile || profile.status !== 'active') throw new Error('AUTH_REQUIRED');
  return {
    userId: userData.user.id,
    email: clean(profile.email || userData.user.email || ''),
    role: clean(profile.role || 'staff'),
    permissions: profile.permissions || {},
  };
}

async function verifyRoutineSecret(admin: any, secret: string) {
  const value = clean(secret);
  if (!value) return false;
  const { data, error } = await admin.rpc('pmo_verify_data_routine_secret', { p_secret: value });
  if (error) {
    console.log(JSON.stringify({
      event: 'pmo_data_routine_secret_verify_error',
      function: 'matchpoint-bookings-sync',
      message: error.message || String(error),
    }));
    return false;
  }
  return data === true;
}

async function authenticateStaffOrRoutine(req: Request, supabaseUrl: string, anonKey: string, admin: any): Promise<StaffActor> {
  const routineSecret = req.headers.get('x-pmo-routine-secret') || '';
  if (await verifyRoutineSecret(admin, routineSecret)) {
    const routineEnv = supabaseUrl.includes('qqbfphyslczzkxoncgex') ? 'prod' : 'test';
    return {
      userId: '00000000-0000-0000-0000-000000000000',
      email: 'routine-dati@' + routineEnv + '.padel-match-organizer',
      role: 'system',
      permissions: { cloud_sync: true },
    };
  }
  return authenticateStaff(req, supabaseUrl, anonKey);
}

function hasPermission(actor: StaffActor, permission: string) {
  if (['owner', 'admin'].includes(actor.role)) return true;
  return actor.permissions?.[permission] === true;
}

async function logAudit(admin: any, actor: StaffActor | null, action: string, detail: JsonMap) {
  if (!actor) return;
  await admin.from('pmo_audit_log').insert({
    actor_user_id: actor.userId,
    actor_email: actor.email,
    actor_role: actor.role,
    action,
    detail,
  });
}

const STAFF_RECONCILE_GRACE_MS = 2 * 60 * 1000; // 120s: copre la finestra worker (~8s) per slot MAI confermati; gli slot gia confermati e poi spariti bypassano il grace

function staffSlotKeyFromOccupancy(b: ParsedBooking) {
  const campoN = String(b?.campo || '').replace(/\D/g, '');
  return `${b?.data || ''}|${campoN}|${b?.ora || ''}`;
}
function staffSlotKeyFromPayload(p: any) {
  const campoN = String(p?.campo ?? '').replace(/\D/g, '');
  return `${p?.data || ''}|${campoN}|${p?.ora || ''}`;
}

// staff_booking ATTIVI (deleted=false). Il reconcile booking/occupancy NON li tocca.
async function loadActiveStaffBookings(admin: any) {
  const records: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from('pmo_cloud_records')
      .select('local_key,payload,updated_at,synced_at')
      .eq('record_type', 'staff_booking')
      .eq('deleted', false)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = Array.isArray(data) ? data : [];
    records.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return records;
}

async function loadExistingBookingRecords(admin: any) {
  const records: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from('pmo_cloud_records')
      .select('record_type,local_key,payload,deleted,synced_at')
      .in('record_type', ['booking', 'booking_occupancy'])
      .eq('deleted', false)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = Array.isArray(data) ? data : [];
    records.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return records;
}

async function saveDiagnosticExport(_admin: any, exported: MatchpointExport, importedAt: string) {
  return {
    saved: false,
    reason: 'POLICY_NO_BOOKINGS_FILE_ARCHIVE',
    filename: exported.filename,
    size: exported.bytes.byteLength,
    contentType: exported.contentType,
    importedAt,
  };
}

function parseErrorInfo(error: unknown) {
  const messageValue = error instanceof Error
    ? error.message
    : (error && typeof error === 'object' && Object.prototype.hasOwnProperty.call(error, 'message') ? (error as any).message : error);
  const message = errorText(messageValue);
  const attachedDiagnostic = error && typeof error === 'object' ? (error as any).diagnostic : null;
  const attachedCode = error && typeof error === 'object' ? clean((error as any).code || '') : '';
  const splitIndex = message.indexOf(':');
  const code = attachedCode || (splitIndex > 0 && message.slice(0, splitIndex).startsWith('MATCHPOINT_')
    ? message.slice(0, splitIndex)
    : message);
  let diagnostic = attachedDiagnostic || null;
  if (!diagnostic && splitIndex > 0 && message.slice(0, splitIndex).startsWith('MATCHPOINT_')) {
    try { diagnostic = JSON.parse(message.slice(splitIndex + 1)); } catch { diagnostic = null; }
  }
  return {
    code,
    message,
    publicMessage: code.startsWith('MATCHPOINT_') ? code : message.slice(0, 500),
    diagnostic,
  };
}

function errorWithDiagnostic(code: string, diagnostic: JsonMap) {
  const error = new Error(`${code}:${JSON.stringify(diagnostic)}`);
  (error as any).code = code;
  (error as any).diagnostic = diagnostic;
  return error;
}

async function saveFailureDiagnostic(admin: any, actor: StaffActor | null, importedAt: string, errorInfo: JsonMap) {
  if (!String(errorInfo.code || '').startsWith('MATCHPOINT_')) return { saved: false, reason: 'SKIPPED' };
  const payload = {
    id: 'matchpoint_bookings_auto_diagnostic_last',
    type: 'prenotazioni future',
    source: 'matchpoint_bookings_auto',
    importedAt,
    actorEmail: actor?.email || '',
    code: errorInfo.code,
    message: errorInfo.publicMessage,
    diagnostic: errorInfo.diagnostic || null,
  };
  const { error } = await admin
    .from('pmo_cloud_records')
    .upsert([{
      record_type: 'matchpoint_data',
      local_key: 'matchpoint_bookings_auto_diagnostic_last',
      payload,
      payload_hash: null,
      deleted: false,
      synced_at: importedAt,
    }], { onConflict: 'record_type,local_key' });
  if (error) return { saved: false, error: error.message || String(error) };
  return { saved: true };
}

async function saveValidationDiagnostic(
  admin: any,
  actor: StaffActor | null,
  importedAt: string,
  exported: MatchpointExport,
  validation: JsonMap,
  diagnosticFile: JsonMap,
) {
  const payload = {
    id: 'matchpoint_bookings_auto_diagnostic_last',
    type: 'prenotazioni future',
    source: 'matchpoint_bookings_auto',
    importedAt,
    actorEmail: actor?.email || '',
    code: validation.error || 'BOOKINGS_VALIDATION_FAILED',
    message: validation.message || 'Validazione file prenotazioni future non superata.',
    validation: {
      error: validation.error || '',
      missing: validation.missing || [],
      headers: validation.headers || [],
      sheetNames: validation.sheetNames || [],
    },
    file: {
      filename: exported.filename,
      size: exported.bytes.byteLength,
      contentType: exported.contentType,
      diagnosticFile,
    },
    diagnostic: exported.diagnostic || null,
  };
  const { error } = await admin
    .from('pmo_cloud_records')
    .upsert([{
      record_type: 'matchpoint_data',
      local_key: 'matchpoint_bookings_auto_diagnostic_last',
      payload,
      payload_hash: null,
      deleted: false,
      synced_at: importedAt,
    }], { onConflict: 'record_type,local_key' });
  if (error) return { saved: false, error: error.message || String(error) };
  return { saved: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Usa POST per avviare import prenotazioni future Matchpoint.');

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return errorResponse(500, 'SUPABASE_ENV_MISSING', 'Configurazione Supabase Edge Function incompleta.');
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  let actor: StaffActor | null = null;
  const importedAt = new Date().toISOString();

  try {
    actor = await authenticateStaffOrRoutine(req, supabaseUrl, anonKey, admin);
    if (!hasPermission(actor, 'cloud_sync')) {
      return errorResponse(403, 'PERMISSION_DENIED', 'Il profilo staff non ha il permesso cloud_sync.');
    }

    // ── DECOUPLING MANUTENZIONE (fix 504 sync lento) ──────────────────────────────
    // Il tabellone si scrapea giorno-per-giorno: sui 31 giorni pieni il sync arrivava a
    // 80-150s e sbatteva sul limite 150s dell'edge (504) → gli slot si aggiornavano "a
    // fatica" in PROD e il sync manuale falliva sempre in TEST. La finestra piena serve
    // SOLO alla manutenzione (che vive solo sul tabellone). Quindi:
    //  • tick "light" (frequente): scrape SOLO i giorni con prenotazioni (roster/idReserva
    //    dei booking reali) + settle più corto → veloce, sotto i 150s. NON tocca la
    //    manutenzione (né la aggiunge né la tombstona: vedi reconcile sotto).
    //  • tick "full" (periodico ~ogni 15 min): finestra piena 31gg + manutenzione, come prima.
    // I booking REALI arrivano SEMPRE dall'export Excel completo → la loro freschezza e
    // riconciliazione sono invariate su OGNI tick. Solo la manutenzione è a bassa cadenza.
    // Il manuale ("Aggiorna prenotazioni") è light = veloce: all'operatore servono le
    // prenotazioni, non la manutenzione. Scelta stateless via orologio (niente cron da toccare).
    const reqBodyForMode = await req.clone().json().catch(() => ({} as JsonMap));
    const syncSource = clean((reqBodyForMode as JsonMap)?.source as string || '');
    const isManualSync = syncSource === 'pmo_dati_in_out';
    const isFullTick = !isManualSync && ((new Date().getUTCMinutes() % 15) < 2);

    const exported = await exportFutureBookingsViaBrowserWorker();
    const validation = validateFutureBookingsWorkbook(exported.bytes);
    if (!validation.ok) {
      const diagnosticFile = await saveDiagnosticExport(admin, exported, importedAt);
      const diagnosticSaved = await saveValidationDiagnostic(admin, actor, importedAt, exported, validation, diagnosticFile);
      await logAudit(admin, actor, 'matchpoint_bookings_auto_import_blocked', {
        error: validation.error,
        message: validation.message,
        source: 'matchpoint_bookings_auto',
        diagnosticSaved,
        file: {
          filename: exported.filename,
          size: exported.bytes.byteLength,
          contentType: exported.contentType,
          diagnosticFile,
        },
        validation: {
          missing: validation.missing || [],
          headers: validation.headers || [],
          sheetNames: validation.sheetNames || [],
        },
      });
      return errorResponse(422, validation.error, validation.message, { validation, diagnosticSaved });
    }

    // Arricchisci con giocatori completi dal tabellone (Tappa 38) — non bloccante.
    // workerUrl/credenziali non sono in scope qui: si leggono dalle env var.
    try {
      const enrichWorkerUrl = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_URL') || '');
      const enrichWorkerApiKey = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_API_KEY') || '');
      const enrichUsername = clean(Deno.env.get('MATCHPOINT_USERNAME') || '');
      const enrichPassword = clean(Deno.env.get('MATCHPOINT_PASSWORD') || '');
      const enrichBaseUrl = (Deno.env.get('MATCHPOINT_BASE_URL') || DEFAULT_BASE_URL).replace(/\/+$/, '');
      if (enrichWorkerUrl && enrichWorkerApiKey && enrichUsername && enrichPassword) {
        await enrichBookingsWithTabellone(
          validation.occupancyBookings,
          enrichWorkerUrl,
          enrichWorkerApiKey,
          enrichUsername,
          enrichPassword,
          enrichBaseUrl,
          // Light tick: solo giorni prenotati, niente manutenzione, settle più corto (il
          // roster è comunque autorevole dall'Excel + protetto dallo STICKY ROSTER sotto).
          // Full tick: finestra piena + manutenzione, settle moderato (sotto i 150s edge).
          { fullWindow: isFullTick, settleMaxMs: isFullTick ? 5000 : 3500 },
        );
      }
    } catch (err) {
      console.warn(JSON.stringify({ event: 'tabellone_enrich_error', error: String(err) }));
    }

    const existingRecords = await loadExistingBookingRecords(admin);
    const existingPayloadByTypedKey = new Map<string, any>();
    for (const record of existingRecords) {
      const type = clean(record?.record_type || '');
      const key = clean(record?.local_key || '');
      if (!type || !key) continue;
      existingPayloadByTypedKey.set(`${type}|${key}`, record?.payload || {});
    }

    const records: any[] = [];
    const currentKeysByType = new Map<string, Set<string>>([
      ['booking', new Set<string>()],
      ['booking_occupancy', new Set<string>()],
    ]);
    let newBookingRows = 0;
    let unchangedBookingRows = 0;
    let changedBookingRows = 0;
    let newOccupancyRows = 0;
    let unchangedOccupancyRows = 0;
    let changedOccupancyRows = 0;

    const addSnapshotRecord = (recordType: string, localKey: string, payload: ParsedBooking) => {
      currentKeysByType.get(recordType)?.add(localKey);
      const existingPayload = existingPayloadByTypedKey.get(`${recordType}|${localKey}`);
      if (!existingPayload) {
        if (recordType === 'booking') newBookingRows += 1;
        else newOccupancyRows += 1;
      } else if (stableStringify(existingPayload) === stableStringify(payload)) {
        if (recordType === 'booking') unchangedBookingRows += 1;
        else unchangedOccupancyRows += 1;
      } else if (recordType === 'booking') changedBookingRows += 1;
      else changedOccupancyRows += 1;
      records.push({
        record_type: recordType,
        local_key: localKey,
        payload,
        payload_hash: null,
        deleted: false,
        synced_at: importedAt,
      });
    };

    validation.bookings.forEach((booking, index) => {
      addSnapshotRecord('booking', bookingCloudKey(booking, index, 'booking'), booking);
    });
    validation.occupancyBookings.forEach((booking, index) => {
      const occKey = bookingCloudKey(booking, index, 'occupancy');
      // STICKY ROSTER: l'arricchimento giocatori dal tabellone (/read-tabellone) è
      // non-deterministico — ad ogni run riempie solo un sottoinsieme degli slot e per gli altri
      // resta solo l'intestatario. Senza questa protezione ogni sync SOVRASCRIVE l'occupazione con
      // quel roster parziale, facendo "lampeggiare" i giocatori sulla card. Qui: se il roster appena
      // letto è degenere (0/1 nome) ma quello già salvato in cloud per lo stesso slot era completo
      // (>=2), si tiene il completo. Se il nuovo ha >=2 nomi ci si fida (così una vera rimozione
      // 4->2 passa comunque). Idem per idReserva, che l'enrich riempie in modo altrettanto flaky.
      // ECCEZIONE: se la prenotazione ha una descrizione-lista autorevole (vedi playersFromDescrizione),
      // il roster è GIÀ la verità MP → lo sticky NON deve mai re-gonfiarlo col vecchio (era la causa
      // dei nomi fantasma che riapparivano dopo una rimozione su Matchpoint).
      const prevOcc = existingPayloadByTypedKey.get(`booking_occupancy|${occKey}`) as JsonMap | undefined;
      if (prevOcc) {
        const hasAuthoritativeRoster = playersFromDescrizione((booking as JsonMap).descrizione as string).length > 0;
        const freshG = Array.isArray(booking.giocatori) ? booking.giocatori : [];
        const prevG = Array.isArray(prevOcc.giocatori) ? prevOcc.giocatori : [];
        // STICKY ROSTER **con CONFERMA** (fix "le formazioni non si aggiornano dentro gli slot"):
        // un roster fresco degenere (0/1 nome) su una prenotazione che prima ne aveva >=2, senza
        // descrizione autorevole, può essere (a) una lettura tabellone flaky oppure (b) una VERA
        // riduzione. Non distinguibili in un colpo. Il vecchio sticky teneva SEMPRE il completo →
        // una riduzione reale (es. lezione 2->1, roster svuotato) restava congelata all'infinito.
        // Ora confermiamo su 2 sync: la 1ª volta teniamo il completo (assorbe il flake) e marchiamo
        // `_rosterShrinkSeen`; se ANCHE il sync successivo legge degenere, accettiamo il fresco
        // (riduzione confermata). Una lettura >=2 in mezzo NON rimette il marker → il flake è
        // dimenticato. Una vera rimozione 4->2/3 ha freshG>=2 e passa comunque subito (invariato).
        if (!hasAuthoritativeRoster && freshG.length <= 1 && prevG.length >= 2) {
          if (prevOcc._rosterShrinkSeen === true) {
            // 2ª lettura degenere consecutiva → riduzione reale confermata: tieni il roster fresco
            // (nessun marker ripristinato).
          } else {
            booking.giocatori = prevG as string[];          // 1ª volta: mantieni il roster completo…
            (booking as JsonMap)._rosterShrinkSeen = true;   // …e marca, per confermare al giro dopo.
          }
        }
        if (!clean((booking as JsonMap).idReserva) && clean(prevOcc.idReserva)) {
          booking.idReserva = String(prevOcc.idReserva);
        }
      }
      addSnapshotRecord('booking_occupancy', occKey, booking);
    });

    let deletedBookings = 0;
    let deletedOccupancies = 0;
    for (const record of existingRecords) {
      const type = clean(record?.record_type || '');
      const key = clean(record?.local_key || '');
      if (!type || !key) continue;
      if (currentKeysByType.get(type)?.has(key)) continue;
      // LIVE/LIGHT TICK — decoupling manutenzione: sui tick frequenti non scrapiamo la
      // finestra piena → le occupancy di MANUTENZIONE non sono nei current keys. NON vanno
      // tombstonate qui (le possiede il tick "full" periodico): senza questo skip
      // ri-lampeggerebbero ad ogni sync (regressione del fix PR#425). I booking REALI
      // arrivano sempre dall'export Excel completo → la loro riconciliazione è invariata.
      if (!isFullTick && type === 'booking_occupancy' && (clean((record?.payload as JsonMap)?.tipo as string) === 'manutenzione' || (record?.payload as JsonMap)?._tabelloneOnly === true)) continue;
      if (type === 'booking') deletedBookings += 1;
      if (type === 'booking_occupancy') deletedOccupancies += 1;
      records.push({
        record_type: type,
        local_key: key,
        payload: record?.payload || {},
        payload_hash: null,
        deleted: true,
        synced_at: importedAt,
      });
    }

    const diagnosticFile = await saveDiagnosticExport(admin, exported, importedAt);
    const totalBookingsBefore = existingRecords.filter((record) => record?.record_type === 'booking').length;
    const totalOccupanciesBefore = existingRecords.filter((record) => record?.record_type === 'booking_occupancy').length;
    const totalBookingsAfter = validation.bookings.length;
    const totalOccupanciesAfter = validation.occupancyBookings.length;
    const range = exported.range || {};

    // --- Reconcile staff_booking sparite da Matchpoint (annullamenti DIRETTI) ---
    let deletedStaffBookings = 0;
    let skippedStaffFresh = 0;
    let skippedStaffOutOfRange = 0;
    try {
      const reconcileFrom = clean(range.fromDate || validation.fromDate || '');
      const reconcileTo = clean(range.toDate || validation.toDate || '');
      const occupancySlotSet = new Set<string>();
      validation.occupancyBookings.forEach((b) => occupancySlotSet.add(staffSlotKeyFromOccupancy(b)));
      // DEMOTE (Tappa 45): idReserva presenti nell'occupancy fresca. Una entry staff_booking
      // "promoted" (creata dallo spostamento di un booking Matchpoint) il cui idReserva ricompare
      // qui va eliminata: l'occupancy autorevole è di nuovo materializzata da Matchpoint.
      const occupancyIdReservaSet = new Set<string>();
      validation.occupancyBookings.forEach((b) => { const ir = clean((b as any).idReserva || ''); if (ir) occupancyIdReservaSet.add(ir); });
      let demotedStaffBookings = 0;
      // Slot con occupancy ATTIVA prima di questo sync: se ora spariti => cancellazione reale.
      const existingOccupancySlotSet = new Set<string>();
      for (const rec of existingRecords) {
        if (clean(rec?.record_type || '') !== 'booking_occupancy') continue;
        existingOccupancySlotSet.add(staffSlotKeyFromOccupancy(rec?.payload || {}));
      }
      const nowMs = Date.now();
      let bypassedGraceConfirmed = 0;
      const activeStaff = await loadActiveStaffBookings(admin);
      for (const row of activeStaff) {
        const p = row?.payload || {};
        const sData = clean(p?.data || '');
        if (!sData) continue;
        if (reconcileFrom && sData < reconcileFrom) { skippedStaffOutOfRange += 1; continue; }
        if (reconcileTo && sData > reconcileTo) { skippedStaffOutOfRange += 1; continue; }
        // DEMOTE per idReserva: solo per le entry nate dal promote (promoted===true).
        // Le prenotazioni/lezioni create dall'app NON sono promoted → restano intatte
        // (così il maestro delle lezioni app non viene perso).
        const sIdReserva = clean((p as any)?.id_reserva || '');
        const sPromoted = (p as any)?.promoted === true;
        if (sPromoted && sIdReserva && occupancyIdReservaSet.has(sIdReserva)) {
          records.push({ record_type: 'staff_booking', local_key: row.local_key, payload: p, payload_hash: null, deleted: true, synced_at: importedAt });
          demotedStaffBookings += 1;
          continue;
        }
        const slotKey = staffSlotKeyFromPayload(p);
        if (occupancySlotSet.has(slotKey)) continue;
        // Bypass grace se lo slot era confermato (occupancy attiva prima del sync) ed e sparito.
        const wasConfirmed = existingOccupancySlotSet.has(slotKey);
        if (wasConfirmed) {
          bypassedGraceConfirmed += 1;
        } else {
          const tsRaw = row?.updated_at || row?.synced_at || '';
          const tsMs = tsRaw ? Date.parse(tsRaw) : 0;
          if (tsMs && (nowMs - tsMs) < STAFF_RECONCILE_GRACE_MS) { skippedStaffFresh += 1; continue; }
        }
        records.push({
          record_type: 'staff_booking',
          local_key: row.local_key,
          payload: p,
          payload_hash: null,
          deleted: true,
          synced_at: importedAt,
        });
        deletedStaffBookings += 1;
      }
      console.log(JSON.stringify({ event: 'staff_reconcile_done', deletedStaffBookings, demotedStaffBookings, skippedStaffFresh, bypassedGraceConfirmed, skippedStaffOutOfRange, activeStaff: activeStaff.length, reconcileFrom, reconcileTo }));
    } catch (staffErr) {
      console.error(JSON.stringify({ event: 'staff_reconcile_failed', error: errorText(staffErr) }));
    }

    const summaryPayload = {
      id: 'matchpoint_bookings_auto_import_last',
      type: 'prenotazioni future',
      source: 'matchpoint_bookings_auto',
      importedAt,
      actorEmail: actor.email,
      rows: {
        sourceRows: validation.sourceRows,
        importableRows: validation.importableRows,
        occupancyRows: validation.occupancyRows,
        skipped: validation.skipped,
        newBookingRows,
        unchangedBookingRows,
        changedBookingRows,
        deletedBookings,
        newOccupancyRows,
        unchangedOccupancyRows,
        changedOccupancyRows,
        deletedOccupancies,
        totalBookingsBefore,
        totalBookingsAfter,
        totalOccupanciesBefore,
        totalOccupanciesAfter,
        totalBefore: totalOccupanciesBefore,
        totalAfter: totalOccupanciesAfter,
        fromDate: validation.fromDate || range.fromDate || '',
        toDate: validation.toDate || range.toDate || '',
        requestedFromDate: range.fromDate || '',
        requestedToDate: range.toDate || '',
      },
      file: {
        filename: exported.filename,
        size: exported.bytes.byteLength,
        contentType: exported.contentType,
        diagnosticFile,
      },
      validation: {
        sheetName: validation.sheetName,
        requiredColumns: REQUIRED_BOOKING_COLUMNS,
        headers: validation.headers,
        warnings: validation.warnings,
      },
      diagnostic: exported.diagnostic,
    };
    records.push({
      record_type: 'matchpoint_data',
      local_key: 'matchpoint_bookings_auto_import_last',
      payload: summaryPayload,
      payload_hash: null,
      deleted: false,
      synced_at: importedAt,
    });

    const { error: upsertError } = await admin
      .from('pmo_cloud_records')
      .upsert(records, { onConflict: 'record_type,local_key' });
    if (upsertError) throw upsertError;

    await logAudit(admin, actor, 'matchpoint_bookings_auto_import_success', {
      sourceRows: validation.sourceRows,
      importableRows: validation.importableRows,
      occupancyRows: validation.occupancyRows,
      newBookingRows,
      changedBookingRows,
      deletedBookings,
      newOccupancyRows,
      changedOccupancyRows,
      deletedOccupancies,
      deletedStaffBookings,
      skipped: validation.skipped,
      totalBookingsBefore,
      totalBookingsAfter,
      totalOccupanciesBefore,
      totalOccupanciesAfter,
      diagnosticFile,
      upserted: records.length,
    });

    // Sveglia gli altri device se qualcosa e cambiato (incl. annullamenti diretti riconciliati).
    if (newBookingRows || changedBookingRows || deletedBookings || newOccupancyRows || changedOccupancyRows || deletedOccupancies || deletedStaffBookings) {
      await notifyStaffCalRealtime(supabaseUrl, serviceRoleKey, 'edge-bookings-sync', { deletedStaffBookings, deletedBookings, deletedOccupancies });
    }

    const sortBookings = (items: ParsedBooking[]) => [...items].sort((a, b) => `${a.data || ''} ${a.ora || ''} ${a.campo || ''}`.localeCompare(`${b.data || ''} ${b.ora || ''} ${b.campo || ''}`));

    return okResponse({
      importedAt,
      mode: exported.mode || exported.diagnostic?.mode || 'browser_worker_headless',
      recordType: 'booking',
      summary: summaryPayload,
      cloud: {
        upserted: records.length,
        bookingRows: validation.bookings.length,
        occupancyRows: validation.occupancyRows,
        deletedBookings,
        deletedOccupancies,
        deletedStaffBookings,
        totalBookingsBefore,
        totalBookingsAfter,
        totalOccupanciesBefore,
        totalOccupanciesAfter,
        bookings: sortBookings(validation.bookings),
        occupancyBookings: sortBookings(validation.occupancyBookings),
      },
    });
  } catch (error) {
    const errorInfo = parseErrorInfo(error);
    const message = errorInfo.message;
    const diagnosticSaved = await saveFailureDiagnostic(admin, actor, importedAt, errorInfo).catch((diagnosticError) => ({
      saved: false,
      error: diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError),
    }));
    console.log(JSON.stringify({
      event: 'matchpoint_bookings_auto_import_error',
      importedAt,
      actorEmail: actor?.email || '',
      code: errorInfo.code,
      message: errorInfo.publicMessage,
      diagnosticSaved,
      diagnostic: errorInfo.diagnostic || null,
    }));
    await logAudit(admin, actor, 'matchpoint_bookings_auto_import_error', {
      message: errorInfo.publicMessage,
      code: errorInfo.code,
      diagnosticSaved,
    }).catch(() => {});

    if (message === 'AUTH_REQUIRED') return errorResponse(401, 'AUTH_REQUIRED', 'Accesso staff Supabase richiesto.');
    if (message === 'MATCHPOINT_SECRETS_MISSING') {
      return errorResponse(500, 'MATCHPOINT_SECRETS_MISSING', 'Mancano MATCHPOINT_USERNAME o MATCHPOINT_PASSWORD nei secret Supabase.');
    }
    if (errorInfo.code === 'MATCHPOINT_BROWSER_WORKER_FAILED') {
      return errorResponse(500, errorInfo.code, 'Worker browser/headless Matchpoint non riuscito.', {
        diagnosticSaved,
        diagnostic: errorInfo.diagnostic || null,
      });
    }
    if (errorInfo.code === 'MATCHPOINT_BROWSER_WORKER_SECRETS_MISSING') {
      return errorResponse(500, errorInfo.code, 'Mancano i secret del worker browser/headless Matchpoint su Supabase.', {
        diagnosticSaved,
        diagnostic: errorInfo.diagnostic || null,
      });
    }
    return errorResponse(500, 'MATCHPOINT_BOOKINGS_SYNC_FAILED', message, {
      diagnosticSaved,
      diagnostic: errorInfo.diagnostic || null,
    });
  }
});
