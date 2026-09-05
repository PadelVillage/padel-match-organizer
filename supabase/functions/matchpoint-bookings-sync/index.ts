import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { collectTabelloneOnlyOccupancies, maestroDaTestoTabellone } from './tabellone-rescue.ts';
import { resolveIdReserva } from './idreserva-resolve.ts';
import { decideTick, FULL_TICK_MARKER_KEY, NEAR_WINDOW_DAYS, type FullTickMarker } from './full-tick.ts';
import {
  fattiDaConfronto,
  finestraDedup,
  fotografia,
  sepoltiDaResuscitare,
  togliGiaDichiarati,
} from './eventi-staff.ts';

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
  // Solo lezioni, e solo quando il tabellone ha agganciato lo slot: l'export Matchpoint non ha
  // una colonna istruttore. Chiave ASSENTE = tabellone non letto; chiave VUOTA = letto, nessun
  // maestro dichiarato. La differenza serve allo sticky (vedi il ramo occupancy).
  istruttore?: string;
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pmo-routine-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const REQUIRED_BOOKING_COLUMNS = ['Nome', 'Numero', 'Giorno', 'Ora', 'Ore', 'Spazio'];
const DEFAULT_BASE_URL = 'https://app-padelvillage-it.matchpoint.com.es';
/**
 * 🆕🗣️⭐⭐ LA FINESTRA DELL'EXPORT — 60 giorni dal 01/09/2026, sua richiesta.
 *
 * 🚨 QUESTA COSTANTE ERA UNA SOLA E GOVERNAVA DUE COSE CHE NON SCALANO ALLO STESSO MODO, ed è
 * la ragione per cui è stata divisa invece che alzata:
 *   · **l'export delle prenotazioni** (qui sotto) è **UN** report Matchpoint con «Dal / Al
 *     Giorno». Il costo è quasi tutto FISSO — avvio del browser, login, navigazione — e la
 *     parte che scala sono le RIGHE, non i giorni;
 *   · **il tabellone del tick pieno** (`TABELLONE_FULL_DAYS`) è **UNA PAGINA PER GIORNO**.
 *     Quello scala per davvero, ed è da lì che sono nati i tre tipi di tick: a 31 giorni il
 *     giro arrivava già a 80-150 s contro il tetto di 150 s dell'edge.
 * ⇒ Alzare la costante UNICA a 60 avrebbe portato il tabellone a 61 pagine, cioè **504
 *   sistematico** — e un 504 fa fallire il giro INTERO, export compreso. Si sarebbe perso il
 *   sync per allargare il calendario.
 *
 * 📏 E IL COSTO È STATO MISURATO PRIMA DI TOCCARLA, non stimato. Sui log delle edge il 01/09
 * il tick ha mediana **78,4 s**, p90 **102,5 s**, e **7 giri su 524** in 24 ore sbattono già
 * sul tetto; l'export gira su OGNI tick (~720 al giorno) ⇒ ogni secondo in più li paga tutti.
 * La misura dell'export si prende **dalla VM** con `.github/workflows/misura-export-matchpoint.yml`,
 * che esiste per questo — ed è il TEMPO NETTO, letto dai timbri che il worker mette dopo la
 * coda, perché il worker è condiviso e il cronometro di fuori conta anche l'attesa.
 *
 * ⭐⭐ **Due coppie indipendenti, 01/09 sera:**
 *   30 giorni → **19,772 s** e **19,693 s**, xlsx **29.830 byte**
 *   60 giorni → **19,982 s** e **19,782 s**, xlsx **31.442 byte**
 * ⇒ **+0,15 s e +5,4% di file.** I pesi coincidono byte per byte fra i due giri: l'export è
 * riproducibile, non è rumore.
 * ⚖️ Il perché è strutturale e va saputo, perché è ciò che rende sicuro il 60: l'export è **UN
 * SOLO report** e il tempo se ne va quasi tutto in cose che coi giorni non c'entrano — avviare
 * Chromium, fare login, navigare. Le righe in più sono poche perché i giorni 31-60 sono quasi
 * vuoti: 📏 la coda della finestra sta a ~6,8 prenotazioni al giorno contro le 40 di oggi.
 * ⇒ 0,15 s su un margine di 150 s è lo **0,1%**.
 *
 * 🚨 E LA MISURA CHE SI SAREBBE LETTA COL CRONOMETRO SBAGLIATO: nella coppia di conferma il
 * giro a 60 ha aspettato **15,0 s in coda** e il totale diceva **34,8 s**. Da lì si sarebbe
 * concluso che 60 giorni costano il 75% in più — e la costante sarebbe rimasta a 30 per un
 * numero che misurava la congestione di quel minuto.
 */
const EXPORT_FUTURE_DAYS = 60;

/**
 * 🆕 La finestra del TABELLONE nel tick pieno: **resta 30**, e non è una dimenticanza.
 *
 * ⚖️ Qui si paga una pagina per giorno, e il tabellone serve alla MANUTENZIONE (gli slot
 * occupati senza giocatori, che l'export non porta). Allargarlo non aggiunge prenotazioni:
 * aggiunge solo secondi a un giro che è già il più lungo che facciamo.
 * 🚨 Chi un domani volesse allargare anche questo deve prima rifare la misura del tick pieno,
 * non questa: sono due costi diversi, ed è tutto il senso di averle separate.
 */
const TABELLONE_FULL_DAYS = 30;
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
  opts: { windowDays?: number | null; settleMaxMs?: number } = {},
): Promise<boolean> {
  // windowDays=numero (tick "full" 31gg o "near" 7gg): leggiamo il tabellone per OGNI giorno
  // di quella finestra, non solo i prenotati. Motivo: la MANUTENZIONE vive solo sul tabellone
  // e un giorno di SOLA manutenzione altrimenti non verrebbe mai letto (bug "sabato sì /
  // domenica no"). Su questi tick la riconciliazione manutenzione resta coerente (il reconcile
  // la limita alla finestra letta: vedi handler).
  // windowDays=null (tick "light", frequente): SOLO i giorni con prenotazioni → arricchiamo
  // roster/idReserva dei booking reali senza pagare la navigazione dei giorni vuoti. La
  // manutenzione NON viene toccata qui (l'add è gated sotto e il reconcile non la tombstona).
  // Ritorna true SOLO se il tabellone è stato davvero letto: il reconcile tombstona
  // manutenzione/lezioni-rescue solo in quel caso (un fetch fallito non deve farle lampeggiare).
  const windowDays = opts.windowDays ?? null;
  const today = todayIsoRome();
  const dateSet = new Set<string>();
  if (windowDays != null) {
    for (let i = 0; i <= windowDays; i++) dateSet.add(addDaysIso(today, i));
  }
  for (const b of bookings) { if (b.data && b.data >= today) dateSet.add(b.data); }
  const dates = [...dateSet].sort();

  if (!dates.length) return false;

  const endpoint = `${workerBaseUrl(workerUrl)}/read-tabellone`;
  // `testo` (dal 21/07) è il testo della casella: lo usa il recupero delle prenotazioni senza
  // giocatori per leggere il TIPO invece di inventarlo. Assente se il worker è più vecchio.
  let tabelloneData: Record<string, Array<{ id?: string; campo: number; ora: string; giocatori: string[]; testo?: string }>> = {};
  let tabelloneOk = false;

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
      if (data?.ok && data?.result) { tabelloneData = data.result; tabelloneOk = true; }
    }
  } catch (err) {
    // non bloccante: il roster dalla descrizione (fonte MP) si applica comunque, sotto.
    console.warn(JSON.stringify({ event: 'tabellone_enrich_failed', error: String(err) }));
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
      if (match.id) {
        // L'id del tabellone resta l'AUTORITÀ. Il `numero` dell'export è solo il ripiego quando qui
        // non arriva nulla (vedi il fallback nello snapshot): loggiamo le divergenze per verificare
        // sul campo l'invariante idReserva === numero prima di valutare se il numero possa vincere.
        const numeroExport = clean(booking.numero || '');
        if (numeroExport && numeroExport !== clean(String(match.id))) {
          console.warn(JSON.stringify({
            event: 'idreserva_numero_mismatch',
            numero: numeroExport, tabellone: String(match.id),
            data: booking.data, campo: booking.campo, ora: booking.ora,
          }));
        }
        booking.idReserva = String(match.id);
      }
      // MAESTRO (solo lezioni): la casella del tabellone è l'UNICA fonte. L'export "Elenco utenti
      // negli spazi" non ha una colonna istruttore e la sua Descrizione elenca solo gli allievi —
      // provato sulla lezione del 30/07 21:00, creata dalla nostra app con maestro «LoZio», che
      // nella descrizione porta i 4 allievi e non lui. Senza questo, per ogni lezione nata su
      // Matchpoint la card restava muta sul maestro.
      // Scriviamo la chiave SOLO qui dentro, cioè solo quando il tabellone ha davvero agganciato
      // lo slot: a valle «chiave assente» significa «non ne so nulla» e lo sticky può proteggere
      // il valore già salvato, mentre «chiave vuota» significa «letto, maestro non dichiarato» e
      // deve poter cancellare un maestro tolto davvero su Matchpoint.
      if (/lezion/i.test(clean(booking.tipo))) {
        booking.istruttore = maestroDaTestoTabellone(match.testo);
      }
      matchedKeys.add(`${booking.data}|${campoNum}|${booking.ora}`);
    }
  }

  // Tick "light": abbiamo scrapato solo i giorni prenotati → NON ricalcolare la manutenzione
  // (i giorni di sola manutenzione non sono stati letti). La manutenzione esistente resta
  // com'è: il reconcile NON la tombstona sui light tick (vedi handler principale). I tick
  // "near"/"full" la ri-aggiungono/riconciliano sulla loro finestra.
  if (windowDays == null) return tabelloneOk;
  if (!tabelloneOk) return false;

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
  return true;
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
  const toDate = addDaysIso(fromDate, EXPORT_FUTURE_DAYS);
  const endpoint = workerBookingExportUrl(workerUrl);
  const healthEndpoint = workerHealthUrl(workerUrl);
  const requestBody = JSON.stringify({
    username,
    password,
    baseUrl,
    days: EXPORT_FUTURE_DAYS,
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
    range: payload.range || { fromDate, toDate, days: EXPORT_FUTURE_DAYS },
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

// ── VOCE 73 — ciò che l'APP ha seppellito da quando ho guardato l'ultima volta ─────────────
// La regola (e il perché) sta in `eventi-staff.ts`, accanto a `sepoltiDaResuscitare`. Qui c'è
// solo il gesto di andarle a prendere. 🚨 Sono DUE letture e non una: le lapidi da sole non
// bastano — il sync ne produce a ogni giro — e a distinguerle è la soppressione, che l'app
// scrive e il sync non scrive mai.

/** L'istante dell'export del giro precedente: il confine oltre il quale «non l'ho ancora visto». */
async function ultimoGiroImportedAt(admin: any): Promise<string | null> {
  const { data, error } = await admin
    .from('pmo_audit_log')
    .select('created_at,detail')
    .eq('action', 'matchpoint_bookings_auto_import_success')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const riga = Array.isArray(data) ? data[0] : null;
  if (!riga) return null;
  // ⚠️ `created_at` è il RIPIEGO, ed è la fine del giro invece del suo inizio: vale solo per il
  // primo giro dopo questo deploy, quando `importedAt` nel dettaglio ancora non c'è. Sbaglia
  // per DIFETTO — guarda una finestra più stretta — quindi al massimo perde un avviso.
  return clean((riga?.detail || {})?.importedAt || '') || riga?.created_at || null;
}

/**
 * Quanto si guarda INDIETRO rispetto al confine per le sole lapidi.
 *
 * 🚨 Non allarga la finestra dei fatti — quella la decide la SOPPRESSIONE, che resta sul
 * confine esatto. Serve perché lapide e soppressione le scrive la stessa funzione dell'app ma
 * come righe diverse dello stesso invio: se il confine cadesse esattamente fra loro, la
 * soppressione entrerebbe e la sua lapide no, e la cura sarebbe muta proprio nel caso limite.
 */
const MARGINE_LAPIDI_MS = 5 * 60 * 1000;

/** Le lapidi `booking` e le soppressioni dichiarate dall'app, dal confine in poi. */
async function loadSepoltiESoppressioni(admin: any, confineIso: string) {
  const daQuandoLapidi = new Date(Date.parse(confineIso) - MARGINE_LAPIDI_MS).toISOString();
  const [sepolti, soppressioni] = await Promise.all([
    admin
      .from('pmo_cloud_records')
      .select('local_key,payload,updated_at')
      .eq('record_type', 'booking')
      .eq('deleted', true)
      .gte('updated_at', daQuandoLapidi)
      .limit(PAGE_SIZE),
    admin
      .from('pmo_cloud_records')
      .select('local_key,payload,deleted,updated_at')
      .eq('record_type', 'staff_suppress')
      .gt('updated_at', confineIso)
      .limit(PAGE_SIZE),
  ]);
  if (sepolti.error) throw sepolti.error;
  if (soppressioni.error) throw soppressioni.error;
  return {
    sepolti: Array.isArray(sepolti.data) ? sepolti.data : [],
    soppressioni: Array.isArray(soppressioni.data) ? soppressioni.data : [],
  };
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
    //  • tick "near" (~ogni 5 min, dal 28/07): finestra 7gg + manutenzione di quei giorni —
    //    una manutenzione della settimana appare entro ~5 min. Costo marginale basso: i
    //    giorni prenotati della finestra si scrapano già a ogni light, si pagano solo i vuoti.
    //  • tick "full" (periodico ~ogni 15 min): finestra piena 31gg + manutenzione, come prima.
    // I booking REALI arrivano SEMPRE dall'export Excel completo → la loro freschezza e
    // riconciliazione sono invariate su OGNI tick. Solo la manutenzione è a bassa cadenza.
    // Il manuale ("Aggiorna prenotazioni") è light = veloce: all'operatore servono le
    // prenotazioni, non la manutenzione. Scelta via orologio + RECUPERO (28/07): se il giro
    // pieno di un quarto d'ora salta (es. 502 del gateway), il primo tick utile diventa
    // pieno, così la manutenzione non aspetta il quarto d'ora dopo. Decisione e paracadute
    // (cooldown anti-504) in full-tick.ts; il marker sta in matchpoint_data.
    const reqBodyForMode = await req.clone().json().catch(() => ({} as JsonMap));
    const syncSource = clean((reqBodyForMode as JsonMap)?.source as string || '');
    const isManualSync = syncSource === 'pmo_dati_in_out';
    let fullTickMarker: FullTickMarker | null = null;
    if (!isManualSync) {
      try {
        const { data } = await admin
          .from('pmo_cloud_records')
          .select('payload')
          .eq('record_type', 'matchpoint_data')
          .eq('local_key', FULL_TICK_MARKER_KEY)
          .maybeSingle();
        fullTickMarker = (data?.payload as FullTickMarker) || null;
      } catch (err) {
        // Marker illeggibile → si torna alla sola regola dell'orologio (comportamento storico).
        console.warn(JSON.stringify({ event: 'full_tick_marker_read_failed', error: errorText(err) }));
      }
    }
    const tickDecision = decideTick({ isManualSync, nowMs: Date.now(), marker: fullTickMarker });
    const isFullTick = tickDecision.kind === 'full';
    if (isFullTick) {
      // Marker "tentativo" scritto PRIMA del lavoro pesante: se questo giro muore a metà
      // (timeout), il prossimo recupero parte solo a cooldown scaduto — la protezione
      // anti-504 del decoupling resta in piedi anche nel guasto cronico.
      const attemptPayload: JsonMap = {
        ...(fullTickMarker || {}),
        id: FULL_TICK_MARKER_KEY,
        lastFullAttemptAt: importedAt,
      };
      if (tickDecision.recovered) attemptPayload.lastRecoveredAt = importedAt;
      const { error: markerError } = await admin
        .from('pmo_cloud_records')
        .upsert([{
          record_type: 'matchpoint_data',
          local_key: FULL_TICK_MARKER_KEY,
          payload: attemptPayload,
          payload_hash: null,
          deleted: false,
          synced_at: importedAt,
        }], { onConflict: 'record_type,local_key' });
      if (markerError) console.warn(JSON.stringify({ event: 'full_tick_marker_write_failed', error: errorText(markerError) }));
      console.log(JSON.stringify({ event: 'full_tick_start', recovered: tickDecision.recovered }));
    }

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
    // tabelloneRead=true SOLO se il tabellone è stato letto davvero: senza, il reconcile
    // non tombstona manutenzione/lezioni-rescue (un fetch fallito non deve farle sparire).
    let tabelloneRead = false;
    try {
      const enrichWorkerUrl = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_URL') || '');
      const enrichWorkerApiKey = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_API_KEY') || '');
      const enrichUsername = clean(Deno.env.get('MATCHPOINT_USERNAME') || '');
      const enrichPassword = clean(Deno.env.get('MATCHPOINT_PASSWORD') || '');
      const enrichBaseUrl = (Deno.env.get('MATCHPOINT_BASE_URL') || DEFAULT_BASE_URL).replace(/\/+$/, '');
      if (enrichWorkerUrl && enrichWorkerApiKey && enrichUsername && enrichPassword) {
        tabelloneRead = await enrichBookingsWithTabellone(
          validation.occupancyBookings,
          enrichWorkerUrl,
          enrichWorkerApiKey,
          enrichUsername,
          enrichPassword,
          enrichBaseUrl,
          // Light: solo giorni prenotati, niente manutenzione, settle più corto (il roster
          // è comunque autorevole dall'Excel + protetto dallo STICKY ROSTER sotto).
          // Near: finestra 7gg + manutenzione di quei giorni, settle corto come il light.
          // Full: finestra piena 31gg + manutenzione, settle moderato (sotto i 150s edge).
          {
            windowDays: isFullTick ? TABELLONE_FULL_DAYS : (tickDecision.kind === 'near' ? NEAR_WINDOW_DAYS : null),
            settleMaxMs: isFullTick ? 5000 : 3500,
          },
        );
      }
    } catch (err) {
      console.warn(JSON.stringify({ event: 'tabellone_enrich_error', error: String(err) }));
    }

    const existingRecords = await loadExistingBookingRecords(admin);

    // ── 🚨⭐⭐ VOCE 77 — LA FOTOGRAFIA DI PRIMA SI PRENDE TUTTA NELLO STESSO ISTANTE ──────
    // Questa lettura stava PIÙ IN BASSO, dentro il blocco degli eventi staff, cioè **dopo
    // l'upsert**. Le due metà della stessa fotografia venivano quindi prese in due momenti
    // diversi, e fra i due momenti c'è una scrittura che cambia proprio ciò che la seconda
    // metà va a cercare.
    //
    // 📏 MISURATO IL 23/08 alle 14:35:59, sull'annullo delle 14:34:29 (prenotazione `9595`):
    //   · `existingRecords` (righe VIVE) è letto QUI ⇒ lo slot annullato non c'è ⇒ 76 slot;
    //   · l'upsert riscrive i record dell'export, e quell'export era stato scattato alle
    //     14:34:01, cioè **28 secondi PRIMA dell'annullo** ⇒ `booking|9595` torna `deleted=false`;
    //   · la resurrezione (voce 73) cercava i sepolti DOPO quell'upsert, con
    //     `.eq('deleted', true)` ⇒ **non trovava più niente da resuscitare** (`risorti: 0`),
    //     perché la riga nel frattempo era tornata viva.
    // ⇒ prima 76, dopo 77, e ne è uscito un `aggiunto` **falso**: al socio è arrivato
    //   «Sei in campo» per la partita che aveva appena annullato.
    //
    // ⚖️ NON È UN DIFETTO DELLA CURA RITIRATA, ed è il punto che conta: la stessa finestra si
    // apre per un annullo fatto dalla SEGRETERIA (l'app seppellisce le proprie copie subito),
    // ogni volta che cade fra lo scatto dell'export e l'upsert del giro — due minuti buoni.
    // La cura della 77 non ha creato la corsa: l'ha solo resa facile da vedere.
    //
    // ⇒ La regola, in una riga: *le righe vive e le righe sepolte si leggono nello stesso
    //   istante, o non sono la stessa fotografia.* La prova che il rimedio è quello giusto la
    //   dà il giro delle 14:37:22, che con l'export scattato DOPO l'annullo ha resuscitato
    //   (`righe: 1`) e non ha accodato niente.
    //
    // 🚨 Fallisce APERTO come il resto del blocco: se questa lettura in più non riesce si
    // perde una resurrezione (cioè al massimo un avviso), non il calendario.
    let confineVoce73: string | null = null;
    let risorti: JsonMap[] = [];
    try {
      confineVoce73 = await ultimoGiroImportedAt(admin);
      if (confineVoce73) {
        const { sepolti, soppressioni } = await loadSepoltiESoppressioni(admin, confineVoce73);
        risorti = sepoltiDaResuscitare(sepolti, soppressioni, confineVoce73) as JsonMap[];
        if (risorti.length) {
          console.log(JSON.stringify({
            event: 'eventi_staff_sepolti_risorti',
            confine: confineVoce73,
            soppressioni: soppressioni.length,
            righe: risorti.length,
          }));
        }
      }
    } catch (errSepolti) {
      console.warn(JSON.stringify({
        event: 'eventi_staff_sepolti_saltati',
        error: String(errSepolti),
      }));
    }
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
    let occupancyIdReservaFromNumero = 0;

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

      /* 🚨⭐⭐ QUELLO CHE NON È CAMBIATO NON SI RISCRIVE — 05/09/2026.
         Qui le righe invariate venivano contate come tali (`unchangedBookingRows`, due righe
         più su) **e poi riscritte lo stesso**. Sapevamo che erano uguali, e le scrivevamo.

         📏 Misurato su PROD il 05/09, dal timbro dell'ultimo giro: `unchangedBookingRows: 272`
         e `unchangedOccupancyRows: 165` contro `changed: 0` e `new: 0`.
         ⇒ **437 righe riscritte, zero cambiate.** Ogni 2 minuti, ~570 giri al giorno:
         ~250.000 scritture inutili al giorno. Su `pmo_cloud_records`: `n_tup_upd`
         **14.343.602** su **31.193** righe vive, e `n_tup_hot_upd` **ZERO** — nessuna
         riscrittura economica, quindi ognuna è una riga nuova PIÙ tutte le voci d'indice.
         ⇒ Una fabbrica di WAL. Quella mattina l'archiviazione del WAL ha smesso di farcela
         (`archiving WAL file failed too many times`) e il database è diventato irraggiungibile
         perfino per il servizio di autenticazione.

         ⚖️ SI POTEVA FARE SOLO INSIEME A UN'ALTRA COSA, e senza quella sarebbe stato un danno:
         `synced_at` su queste righe era il **certificato di freschezza** — ciò che permette al
         bot di dire «no, non hai prenotato» invece di «non lo so ancora». Smettere di
         riscriverle lo avrebbe congelato. ⇒ Il timbro è stato spostato sulla riga del GIRO
         (`matchpoint_bookings_auto_import_last`, in `consumer-booking-write`), che sta nello
         stesso upsert e porta la stessa garanzia: un giro fallito non la muove.
         📌 *Non è una micro-ottimizzazione: è aver scoperto che tenere fresco UN dato costava
            la riscrittura di MILLE righe, e aver spostato il dato invece di pagare il prezzo.*

         ⛔ E NON tocca chi guarda il `synced_at` della SINGOLA riga
         (`consumer-player-readmodel`, che distingue «il sync non ha ancora recepito» da
         «qualcuno l'ha rimessa»): quel caso nasce da un roster CAMBIATO, e una riga cambiata
         si scrive come prima. Una riga invariata non ha niente da rivelare. */
      if (existingPayload && stableStringify(existingPayload) === stableStringify(payload)) return;

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
      // 4->2 passa comunque). L'idReserva soffre della stessa flakiness: la sua risoluzione (sticky
      // incluso) sta sotto, in resolveIdReserva.
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
        // STICKY MAESTRO, con la stessa malattia del roster ma una cura più semplice: la lettura
        // del tabellone è flaky e a volte non aggancia lo slot. In quel caso `istruttore` non
        // viene proprio scritto (vedi enrichBookingsWithTabellone) → qui teniamo quello già
        // salvato, altrimenti il nome del maestro lampeggerebbe sulla card a ogni giro andato a
        // vuoto. Non serve la conferma a 2 sync del roster: lì il dubbio era fra «letto male» e
        // «ridotto davvero», qui invece i due casi si distinguono già dalla PRESENZA della chiave.
        if (!('istruttore' in (booking as JsonMap)) && typeof prevOcc.istruttore === 'string') {
          (booking as JsonMap).istruttore = prevOcc.istruttore;
        }
      }
      // idReserva: tabellone (autorità) → sticky → `numero` dell'export (RIPIEGO, fix «🔒 manca
      // l'idReserva» del 16/07/2026). Priorità e motivazioni in idreserva-resolve.ts, provate da
      // idreserva-resolve.test.ts. Qui il ripiego chiude il buco che lasciava la scheda non
      // modificabile quando il tabellone non agganciava lo slot e lo sticky non aveva nulla da
      // ereditare (rotazione del rappresentante dello slot su un record tombstonato).
      const idr = resolveIdReserva({
        tabellone: (booking as JsonMap).idReserva,
        sticky: prevOcc?.idReserva,
        numero: booking.numero,
      });
      if (idr.id) booking.idReserva = idr.id;
      if (idr.source === 'numero') occupancyIdReservaFromNumero += 1;
      addSnapshotRecord('booking_occupancy', occKey, booking);
    });
    console.log(JSON.stringify({ event: 'idreserva_from_numero', filled: occupancyIdReservaFromNumero, occupancy: validation.occupancyBookings.length }));

    let deletedBookings = 0;
    let deletedOccupancies = 0;
    // Ultimo giorno coperto dal tick "near": oltre, la manutenzione la possiede solo il full.
    const nearWindowEnd = addDaysIso(todayIsoRome(), NEAR_WINDOW_DAYS);
    for (const record of existingRecords) {
      const type = clean(record?.record_type || '');
      const key = clean(record?.local_key || '');
      if (!type || !key) continue;
      if (currentKeysByType.get(type)?.has(key)) continue;
      // DECOUPLING MANUTENZIONE — tombstona manutenzione/lezioni-rescue SOLO chi ha riletto
      // il tabellone di quel giorno: full = tutta la finestra, near = solo entro
      // NEAR_WINDOW_DAYS, light = mai (non scrapa i giorni vuoti). E MAI se la lettura del
      // tabellone è fallita (tabelloneRead=false): con lo scrape a vuoto i blocchi non sono
      // nei current keys e sparirebbero per poi riapparire al giro dopo (lampeggio, come la
      // regressione del fix PR#425). I booking REALI arrivano sempre dall'export Excel
      // completo → la loro riconciliazione è invariata su ogni tick.
      if (type === 'booking_occupancy' && (clean((record?.payload as JsonMap)?.tipo as string) === 'manutenzione' || (record?.payload as JsonMap)?._tabelloneOnly === true)) {
        const dataRecord = String((record?.payload as JsonMap)?.data || '');
        const withinNearWindow = !!dataRecord && dataRecord <= nearWindowEnd;
        const owned = tabelloneRead && (isFullTick || (tickDecision.kind === 'near' && withinNearWindow));
        if (!owned) continue;
      }
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
    // ⭐ Si CONTA, e finisce nel registro insieme agli altri: un numero che nessuno guarda non
    // distingue «non ce n'erano» da «non le sto più saltando». Su PROD dev'essere sempre 0.
    let skippedStaffDiProva = 0;
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
        // 🔒⭐⭐ LE PARTITE NATE DA UNA PROVA NON SI TOMBSTONANO — 7/08/2026.
        // Su Matchpoint non ci sono **per costruzione** (le registra il recinto di TEST, che il
        // circolo non lo chiama mai): questo ciclo, che cancella tutto ciò che l'occupazione non
        // conferma, le farebbe sparire al primo giro utile. E la beffa sarebbe che a far partire
        // il giro è proprio **aprire l'app di TEST per guardarle**.
        // ⚖️ Su PROD la riga è inerte: là il marchio non lo mette nessuno, perché il recinto è
        // inerte a sua volta (l'indirizzo È quello di produzione). Nessun `if` sull'ambiente:
        // ⭐ si guarda il DATO, non dove si sta girando — una condizione sull'ambiente sarebbe
        // una seconda verità da tenere allineata a mano.
        // 🚨 Chi le fa sparire, allora? Solo l'annullamento di prova, che le spegne per nome
        // (`spegniPartiteDiProvaSulloSlot` in `matchpoint-bookings-cancel`). Togliendo questa
        // riga, il ciclo di prova si rompe in silenzio: le partite spariscono da sole e chi
        // guarda pensa di aver sbagliato qualcosa.
        if ((p as any)?.nata_in_prova === true) { skippedStaffDiProva += 1; continue; }
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
      console.log(JSON.stringify({ event: 'staff_reconcile_done', deletedStaffBookings, demotedStaffBookings, skippedStaffFresh, bypassedGraceConfirmed, skippedStaffOutOfRange, skippedStaffDiProva, activeStaff: activeStaff.length, reconcileFrom, reconcileTo }));
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
    if (isFullTick) {
      // Giro pieno arrivato in fondo: da qui riparte il conto dei 15 minuti del recupero.
      records.push({
        record_type: 'matchpoint_data',
        local_key: FULL_TICK_MARKER_KEY,
        payload: {
          ...(fullTickMarker || {}),
          id: FULL_TICK_MARKER_KEY,
          lastFullAttemptAt: importedAt,
          lastFullSuccessAt: importedAt,
          ...(tickDecision.recovered ? { lastRecoveredAt: importedAt } : {}),
        },
        payload_hash: null,
        deleted: false,
        synced_at: importedAt,
      });
    }

    const { error: upsertError } = await admin
      .from('pmo_cloud_records')
      .upsert(records, { onConflict: 'record_type,local_key' });
    if (upsertError) throw upsertError;

    // ── VOCE 68: il gestionale DICHIARA cosa è cambiato, e il bot lo dirà ────────────────
    // 🗣️ Dalla segnalazione del committente: «quando da gestionale faccio un'azione — metto,
    // levo giocatori, attivo o elimino partite — sul bot dei soci non arriva nessun avviso».
    // Il dato arrivava già: mancava chi lo confrontasse. La regola sta in `eventi-staff.ts`,
    // qui c'è solo il gesto di accodare — *il gestionale SA, il bot DICE*.
    //
    // 🚨 STA DOPO L'UPSERT, di proposito: si dichiara un fatto solo su una realtà che è già
    // stata salvata. Dichiararlo prima vorrebbe dire che un upsert fallito lascerebbe in coda
    // l'annuncio di un cambiamento che non è mai avvenuto.
    //
    // ⚖️ E NON PUÒ ROMPERE IL SYNC: tutto dentro un try che al massimo scrive nel registro.
    // Il sync porta il calendario a 2800 soci e al gestionale del circolo; questa coda serve
    // a mandare dei messaggi. Se un giorno la seconda si guasta, la prima deve continuare —
    // *un avviso perso è un fastidio, un calendario fermo è un guasto del circolo.*
    let eventiStaffAccodati = 0;
    try {
      // 🚨⭐ VOCE 73 — la fotografia di PRIMA è ciò che c'era l'ULTIMA VOLTA CHE HO GUARDATO,
      // e l'app nel frattempo riscriveva il passato: annullando, seppellisce subito le proprie
      // copie `booking` dello slot, e `existingRecords` legge solo le righe vive ⇒ quello slot
      // «nella prima non c'era già più». Nessuna sparizione, nessun fatto, nessun avviso — e
      // l'annullo è il gesto che toglie il campo alle persone.
      // ⇒ Si rimettono nella fotografia solo le lapidi degli slot che l'APP dichiara di aver
      //   annullato dal giro scorso in qua (`staff_suppress`, che il sync non scrive mai): il
      //   perché sta per esteso accanto a `sepoltiDaResuscitare`.
      // ⚖️ Dentro il try che c'è già: se questa lettura in più fallisce, si perde un avviso —
      //   non il calendario. E `confine` nullo (primissimo giro) vuol dire «non so da quando
      //   guardare» ⇒ non si resuscita niente, che è il verso prudente.
      // 🚨 `confineVoce73` e `risorti` sono calcolati PIÙ SU, insieme a `existingRecords` e
      // **prima dell'upsert**: il perché per esteso sta là, ed è la voce 77. Leggerli qui
      // significherebbe cercare fra i sepolti righe che l'upsert ha appena riportato in vita.
      const primaFoto = fotografia(
        [
          ...existingRecords
            .filter((r) => clean(r?.record_type || '') === 'booking')
            .map((r) => (r?.payload || {}) as JsonMap),
          ...risorti,
        ],
        (d) => playersFromDescrizione(d as string),
      );
      const dopoFoto = fotografia(
        validation.bookings as unknown as JsonMap[],
        (d) => playersFromDescrizione(d as string),
      );
      const fatti = fattiDaConfronto(primaFoto, dopoFoto, todayIsoRome());

      // ── 🚨⭐⭐ VOCE 76 — CIÒ CHE IL GESTIONALE HA GIÀ DETTO NON SI RIDICE ──────────────
      // Dalla risposta del committente del 23/08: *il sync resta rete*. Le due strade si
      // sommano, ma un gesto raccontato due volte sono **due messaggi allo stesso socio** —
      // e un avviso doppio è allarme per un fatto che non è successo (voce 63).
      // ⚖️ La finestra è quella che il confronto copre davvero (dal giro precedente, più un
      // margine), non una costante: il perché — la pausa notturna del sync — sta per esteso
      // accanto a `finestraDedup`.
      // 🚨 FALLISCE APERTO, ed è deliberato: se questa lettura in più non riesce si accodano
      // TUTTI i fatti. Il rischio diventa un doppione; fallire chiuso vorrebbe dire non
      // accodare niente, cioè un silenzio — e fra i due il progetto ha già scelto che il
      // silenzio è il danno peggiore quando riguarda un campo che salta.
      let scartatiPerchéGiaDetti = 0;
      let daAccodare = fatti;
      const daQuandoConferme = finestraDedup(confineVoce73);
      if (fatti.length && daQuandoConferme) {
        try {
          const { data: gia, error: giaErr } = await admin
            .from('pmo_eventi_staff')
            // 👥 VOCE 79 — `entrati, usciti` servono al dedup che SOTTRAE invece di scartare:
            // su `formazione` la chiave dice a CHI, non COSA, e senza gli elenchi due cambi
            // diversi sullo stesso slot collasserebbero in uno. Vedi `togliGiaDichiarati`.
            .select('slot, persona, gesto, entrati, usciti')
            .eq('origine', 'conferma')
            .gte('visto_at', daQuandoConferme);
          if (giaErr) throw giaErr;
          const esito = togliGiaDichiarati(fatti, gia || []);
          daAccodare = esito.daAccodare;
          scartatiPerchéGiaDetti = esito.scartati.length;
        } catch (dedupErr) {
          console.warn(JSON.stringify({
            event: 'eventi_staff_dedup_saltato',
            error: String(dedupErr),
            daQuando: daQuandoConferme,
          }));
        }
      }

      if (daAccodare.length) {
        // 👥🚨⭐⭐ VOCE 79 — IL RIPIEGO CHE SALVA GLI ALTRI QUATTRO GESTI. Il gesto
        // `formazione` e le colonne `entrati`/`usciti` vogliono una migrazione: finché non è
        // applicata su QUESTO progetto, il `CHECK` rifiuta la riga e l'insert è un'unica
        // operazione ⇒ **cade tutto il blocco**, annullamenti compresi, e nessun socio riceve
        // niente. È il danno peggiore che questo modulo possa fare, e la testata qui sotto lo
        // dice già per `origine`.
        // ⚖️ ⇒ Al primo errore si riprova UNA volta con i fatti di prima della voce 79: i
        // quattro gesti vecchi passano comunque, e si perde solo la novità. *Il verso in cui
        // si sbaglia è dire meno, mai tacere del tutto.*
        // 📌 Non sostituisce l'ordine di messa in servizio (bot → migrazione → gestionale):
        // lo rende **non fatale** se qualcuno lo sbaglia, che è un'altra cosa.
        const senzaVoce79 = (righe: typeof daAccodare) =>
          righe.filter((f) => f.gesto !== 'formazione').map((f) => {
            const { entrati: _e, usciti: _u, ...resto } = f;
            return resto;
          });
        const accoda = async (righe: Array<Record<string, unknown>>) => await admin
          .from('pmo_eventi_staff')
          // 🚨⭐⭐ `origine` NON si scrive qui, ed è una scelta contro l'istinto. Scriverlo
          // esplicito sarebbe più chiaro da leggere, ma legherebbe **il calendario di 2800
          // soci** all'essere già stata applicata la migrazione della voce 76: colonna
          // assente ⇒ insert rifiutato ⇒ `eventi_staff_error` ⇒ **nessun avviso, a nessuno**.
          // ⚖️ Omettendolo, questa riga funziona identica nei due mondi — col default `'sync'`
          // se la colonna c'è, e senza colonna se non c'è ancora — e a valle `origine` assente
          // vale comunque `sync` (quiete piena). *Il verso in cui si sbaglia resta l'attesa.*
          // 📌 È la lezione di `staff_edit`, pagata l'11/08: un CHECK che non ammetteva il tipo
          // faceva rifiutare il registro dal database, e per mesi le righe sono state **zero**
          // su TEST e su PROD senza che nessuno se ne accorgesse.
          .insert(righe.map((f) => ({ ...f, visto_at: importedAt })));

        let { error: codaError } = await accoda(daAccodare);
        if (codaError) {
          const ripiego = senzaVoce79(daAccodare);
          console.warn(JSON.stringify({
            event: 'eventi_staff_senza_voce79',
            error: String(codaError.message ?? codaError),
            scartati: daAccodare.length - ripiego.length,
            nota: 'migrazione voce 79 non applicata? riprovo senza formazione/entrati/usciti',
          }));
          if (!ripiego.length) codaError = null;
          else ({ error: codaError } = await accoda(ripiego));
          if (!codaError) eventiStaffAccodati = ripiego.length;
        } else {
          eventiStaffAccodati = daAccodare.length;
        }
        if (codaError) throw codaError;
      }
      console.log(JSON.stringify({
        event: 'eventi_staff',
        slotPrima: primaFoto.size,
        slotDopo: dopoFoto.size,
        accodati: eventiStaffAccodati,
        // ⭐ Si conta a parte perché «ne ho accodati meno» e «il gestionale l'aveva già detto»
        // sono due cose diverse, e una delle due è un guasto. Senza questa riga la voce 76
        // non sarebbe verificabile dai log.
        giaDettiDallaConferma: scartatiPerchéGiaDetti,
      }));
    } catch (err) {
      // 🚨 `warn` e non `error`: al calendario non è successo niente: l'upsert è andato.
      // ⚠️ MA IL FATTO È PERSO, e va saputo: il prossimo giro NON lo ritrova. Il confronto è
      // fra la fotografia salvata e quella nuova, e la fotografia salvata a quel punto è già
      // quella aggiornata ⇒ il cambiamento, per il giro dopo, non è mai avvenuto.
      // ⚖️ Si accetta invece di rendere le due scritture una transazione sola: il prezzo
      // sarebbe far dipendere il calendario di 2800 soci dalla salute di una coda di
      // messaggi. *Un avviso perso è un fastidio, un calendario fermo è un guasto del
      // circolo* — e questa riga nel registro è ciò che rende il fastidio diagnosticabile.
      console.warn(JSON.stringify({ event: 'eventi_staff_error', error: String(err) }));
    }

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
      // ⭐ VOCE 73: è il CONFINE che il giro successivo userà per sapere che cosa l'app ha
      // seppellito da quando ha guardato l'ultima volta. È l'istante dell'export, non la fine
      // del giro, ed è la differenza che evita di perdere gli annulli fatti mentre giravo.
      importedAt,
      upserted: records.length,
      fullTick: isFullTick,
      fullTickRecovered: tickDecision.recovered,
      tickKind: tickDecision.kind,
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
