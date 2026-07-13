import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

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
};

type ExportDiscovery = {
  target: string;
  candidates: Array<{ target: string; score: number; reason: string }>;
};

type ParsedMember = {
  id: string;
  memberId: string;
  firstName: string;
  surname: string;
  name: string;
  phone: string;
  email: string;
  gender: string;
  birthDate: string;
  age: number | null;
  level: number;
  playingPosition: string;
  city: string;
  cap: string;
  province: string;
  address: string;
  active: boolean;
  prefDays: any[];
  prefHours: any[];
  source: string;
  matchpointImportedAt: string;
  updatedAt: string;
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pmo-routine-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const REQUIRED_CLIENT_COLUMNS = ['Cliente', 'Telefono cellulare', 'E-mail', 'Eta', 'Sesso', 'Livello'];
const CLIENT_FULL_NAME_COLUMNS = ['Cliente', 'Nominativo', 'Nome e cognome', 'Nome completo', 'Full Name'];
const CLIENT_FIRST_NAME_COLUMNS = ['Nome', 'First Name'];
const CLIENT_SURNAME_COLUMNS = ['Cognome', 'Last Name', 'Surname'];
const SUPABASE_PAGE_SIZE = 1000;
const DEFAULT_BASE_URL = 'https://app-padelvillage-it.matchpoint.com.es';
const DEFAULT_CLIENTS_PATH = '/clientes/Listadoclientes.aspx?pagesize=15';
const DEFAULT_EXPORT_TARGET = 'ctl01$ctl00$CC$ContentPlaceHolderAcciones$LinkButtonExportar';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function okResponse(body: JsonMap) {
  return json({ ok: true, ...body });
}

function errorResponse(status: number, code: string, message: string, extra: JsonMap = {}) {
  return json({ ok: false, error: code, message: errorText(message), ...extra }, status);
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function chooseMemberId(existingId: unknown, importedId: unknown) {
  const existing = clean(existingId);
  const imported = clean(importedId);
  const isMatchpointCode = (v: string) => /^\d{3,}$/.test(v); // codice Matchpoint = sole cifre (3+)
  // Il codice Matchpoint numerico vince su un segnaposto PMO-... o su un campo vuoto.
  if (isMatchpointCode(imported) && !isMatchpointCode(existing)) return imported;
  return existing || imported || '';
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
  return compactSpaces(value)
    .toLocaleLowerCase('it-IT')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function htmlDecode(value: string) {
  return clean(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function shortHash(value: unknown) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h) ^ text.charCodeAt(i);
  return (h >>> 0).toString(36);
}

function titleCaseNamePart(value: unknown) {
  return compactSpaces(value).split(/\s+/).map((part) => (
    part.split('-').map((piece) => {
      const lower = piece.toLocaleLowerCase('it-IT');
      return lower ? lower.charAt(0).toLocaleUpperCase('it-IT') + lower.slice(1) : '';
    }).join('-')
  )).join(' ');
}

function splitClienteName(fullName: unknown) {
  const value = compactSpaces(fullName);
  if (!value) return { firstName: '', surname: '' };
  if (value.includes(',')) {
    const parts = value.split(',').map((item) => item.trim());
    return { firstName: parts[1] || '', surname: parts[0] || '' };
  }
  const parts = value.split(' ');
  if (parts.length === 1) return { firstName: parts[0], surname: '' };
  return { firstName: parts[0], surname: parts.slice(1).join(' ') };
}

function parseAgeValue(value: unknown) {
  const text = clean(value).replace(',', '.');
  const n = parseFloat(text);
  return Number.isFinite(n) && n >= 0 && n <= 120 ? Math.round(n) : null;
}

function parseLevel(value: unknown, fallback = 3) {
  const n = parseFloat(clean(value).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

function genderFromValue(value: unknown, firstName = '') {
  const key = normalizeKey(value);
  if (['uomo', 'm', 'maschio', 'male'].includes(key)) return 'M';
  if (['donna', 'f', 'femmina', 'female'].includes(key)) return 'F';
  const nameKey = normalizeKey(firstName);
  if (nameKey.endsWith('a')) return 'F';
  if (nameKey.endsWith('o')) return 'M';
  return 'NA';
}

function parseDateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
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
  return '';
}

function normalizePhone(value: unknown) {
  const raw = clean(value);
  let digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  // v6.090: collassa prefisso 39 duplicato (dato sporco Matchpoint "+39+39..." / "+3939...").
  // Rende canonici i soci MP double-39 → agganciano per telefono il gemello Google e si fondono.
  if (digits.length === 14 && digits.startsWith('3939') && /^393\d{9}$/.test(digits.slice(2))) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('3')) digits = `39${digits}`;
  else if (digits.startsWith('0') && digits.length >= 7 && digits.length <= 11) digits = `39${digits}`;
  else if (!digits.startsWith('39') && digits.length >= 8 && digits.length <= 11) digits = `39${digits}`;
  if (['3939561626', '393939561626', '03939561626'].includes(raw.replace(/\D/g, '')) || digits === '393939561626') {
    digits = '393939561626';
  }
  return digits ? `+${digits}` : '';
}

function phoneDigits(value: unknown) {
  return normalizePhone(value).replace(/\D/g, '');
}

function emailKey(value: unknown) {
  return clean(value).toLocaleLowerCase('it-IT').replace(/\s+/g, '');
}

function memberName(member: JsonMap) {
  return compactSpaces(member.name || `${clean(member.firstName)} ${clean(member.surname)}`);
}

function memberCloudKey(member: JsonMap) {
  const phone = phoneDigits(member.phone || member.telefono || '');
  if (phone) return `phone:${phone}`;
  const email = emailKey(member.email || '');
  if (email) return `email:${email}`;
  return `name:${normalizeKey(memberName(member))}`;
}

function memberLookupKeys(member: JsonMap) {
  const keys: string[] = [];
  const phone = phoneDigits(member.phone || member.telefono || '');
  if (phone) keys.push(`phone:${phone}`);
  const email = emailKey(member.email || '');
  if (email) keys.push(`email:${email}`);
  const name = normalizeKey(memberName(member));
  if (name) keys.push(`name:${name}`);
  return keys;
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

function parseMemberRow(row: JsonMap, importedAt: string): ParsedMember | null {
  const cliente = clean(getCell(row, CLIENT_FULL_NAME_COLUMNS));
  let firstName = clean(getCell(row, CLIENT_FIRST_NAME_COLUMNS));
  let surname = clean(getCell(row, CLIENT_SURNAME_COLUMNS));
  if ((!firstName || !surname) && cliente) {
    const split = splitClienteName(cliente);
    firstName = firstName || split.firstName;
    surname = surname || split.surname;
  }
  firstName = titleCaseNamePart(firstName);
  surname = titleCaseNamePart(surname);
  const fullName = compactSpaces(`${firstName} ${surname}`);
  if (!firstName || !surname) return null;
  if (normalizeKey(fullName).includes('tpcappnoncancellare')) return null;
  const keySource = memberCloudKey({ phone: getCell(row, ['Telefono cellulare', 'Cellulare', 'Telefono', 'Phone', 'Mobile']), email: getCell(row, ['E-mail', 'Email', 'Mail']), name: fullName });
  return {
    id: `matchpoint_${shortHash(keySource || fullName)}`,
    memberId: '',
    firstName,
    surname,
    name: fullName,
    phone: normalizePhone(getCell(row, ['Telefono cellulare', 'Cellulare', 'Telefono', 'Phone', 'Mobile'])),
    email: clean(getCell(row, ['E-mail', 'Email', 'Mail'])),
    gender: genderFromValue(getCell(row, ['Sesso', 'Genere', 'Gender']), firstName),
    birthDate: parseDateValue(getCell(row, ['Data di nascita', 'Data nascita', 'Nascita', 'Birth Date', 'Birthday', 'DOB'])),
    age: parseAgeValue(getCell(row, ['Eta', 'Età', 'Age'])),
    level: parseLevel(getCell(row, ['Livello', 'Level', 'Livello Padel']), 0.5),
    playingPosition: clean(getCell(row, ['Posizione', 'Position', 'Lato', 'Lato preferito', 'Posizione preferita'])),
    city: clean(getCell(row, ['Comune', 'Citta', 'Città', 'City', 'Localita', 'Località', 'Zona'])),
    cap: clean(getCell(row, ['CAP', 'Cap', 'Codice postale', 'Zip'])),
    province: clean(getCell(row, ['Provincia', 'Province', 'Prov.'])),
    address: clean(getCell(row, ['Indirizzo', 'Address', 'Via'])),
    active: true,
    prefDays: [],
    prefHours: [],
    source: 'matchpoint_auto',
    matchpointImportedAt: importedAt,
    updatedAt: importedAt,
  };
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
  const missing = REQUIRED_CLIENT_COLUMNS.filter((name) => !normalizedHeaders.has(normalizeHeader(name)));
  if (missing.length) {
    return { ok: false as const, error: 'CLIENT_COLUMNS_MISSING', message: 'Il file non contiene le colonne minime clienti.', missing, headers, sheetNames: workbook.SheetNames };
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }) as JsonMap[];
  return { ok: true as const, rows, headers, sheetName: 'Risultati' };
}

function validateClientWorkbook(bytes: Uint8Array, importedAt: string) {
  const parsed = workbookRows(bytes);
  if (!parsed.ok) return parsed;

  let skipped = 0;
  let technicalSkipped = 0;
  const members: ParsedMember[] = [];
  for (const row of parsed.rows) {
    const label = compactSpaces(getCell(row, CLIENT_FULL_NAME_COLUMNS) || `${getCell(row, CLIENT_FIRST_NAME_COLUMNS)} ${getCell(row, CLIENT_SURNAME_COLUMNS)}`);
    if (normalizeKey(label).includes('tpcappnoncancellare')) technicalSkipped += 1;
    const member = parseMemberRow(row, importedAt);
    if (!member) {
      skipped += 1;
      continue;
    }
    members.push(member);
  }

  if (!members.length) {
    return {
      ok: false as const,
      error: 'NO_IMPORTABLE_CLIENT_ROWS',
      message: 'Il file clienti e leggibile ma non contiene righe cliente importabili.',
      sourceRows: parsed.rows.length,
      skipped,
      technicalSkipped,
    };
  }
  if (parsed.rows.length && members.length / parsed.rows.length < 0.2) {
    return {
      ok: false as const,
      error: 'LOW_CLIENT_ROW_RATIO',
      message: 'Troppe poche righe sembrano clienti validi: import bloccato.',
      sourceRows: parsed.rows.length,
      importableRows: members.length,
      skipped,
      technicalSkipped,
    };
  }

  const missingPhone = members.filter((item) => !item.phone).length;
  const missingEmail = members.filter((item) => !item.email).length;
  const missingGender = members.filter((item) => !item.gender || item.gender === 'NA').length;
  return {
    ok: true as const,
    members,
    headers: parsed.headers,
    sheetName: parsed.sheetName,
    sourceRows: parsed.rows.length,
    importableRows: members.length,
    skipped,
    technicalSkipped,
    warnings: {
      missingPhone,
      missingEmail,
      missingGender,
    },
  };
}

function mergeProtectedMember(existing: JsonMap, imported: ParsedMember, importedAt: string) {
  const hasExistingGender = existing.gender && existing.gender !== 'NA';
  const existingAge = parseAgeValue(existing.age);
  const importedAge = parseAgeValue(imported.age);
  return {
    ...existing,
    id: existing.id || imported.id,
    memberId: chooseMemberId(existing.memberId, imported.memberId),
    firstName: titleCaseNamePart(existing.firstName || imported.firstName),
    surname: titleCaseNamePart(existing.surname || imported.surname),
    name: compactSpaces(`${titleCaseNamePart(existing.firstName || imported.firstName)} ${titleCaseNamePart(existing.surname || imported.surname)}`),
    phone: existing.phone || imported.phone || '',
    email: existing.email || imported.email || '',
    gender: hasExistingGender ? existing.gender : (imported.gender !== 'NA' ? imported.gender : (existing.gender || 'NA')),
    birthDate: existing.birthDate || imported.birthDate || '',
    age: importedAge !== null ? importedAge : (existingAge !== null ? existingAge : null),
    city: existing.city || imported.city || '',
    cap: existing.cap || imported.cap || '',
    province: existing.province || imported.province || '',
    address: existing.address || imported.address || '',
    level: existing.level || imported.level || 0.5,
    playingPosition: existing.playingPosition || existing.position || imported.playingPosition || '',
    active: existing.active !== false,
    prefDays: Array.isArray(existing.prefDays) ? existing.prefDays : [],
    prefHours: Array.isArray(existing.prefHours) ? existing.prefHours : [],
    source: existing.source || 'matchpoint_auto',
    matchpointImportedAt: importedAt,
    updatedAt: existing.updatedAt || importedAt,
  };
}

// Direzione B (Matchpoint → app): a differenza di mergeProtectedMember (che protegge i dati
// curati nell'app), qui Matchpoint È autorevole sui campi anagrafici "di contatto": Nome,
// Cognome, Telefono, Email, Sesso. Il Livello NON viene mai sovrascritto (resta curato nell'app
// tramite l'autovalutazione). Ritorna anche `changed`: true se uno di quei campi è davvero
// cambiato rispetto al payload memorizzato (confronto normalizzato, così differenze di sola
// formattazione non generano falsi cambiamenti né broadcast inutili).
function applyMatchpointContacts(existing: JsonMap, imported: ParsedMember, importedAt: string) {
  const pickText = (imp: string, exi: string) => {
    const i = clean(imp);
    const e = clean(exi);
    if (!i) return { value: e, changed: false };
    if (normalizeKey(i) === normalizeKey(e)) return { value: e, changed: false };
    return { value: i, changed: true };
  };
  let changed = false;
  const fn = pickText(titleCaseNamePart(imported.firstName), existing.firstName);
  if (fn.changed) changed = true;
  const sn = pickText(titleCaseNamePart(imported.surname), existing.surname);
  if (sn.changed) changed = true;

  // Telefono: confronto sulle sole cifre normalizzate.
  let phone = clean(existing.phone);
  if (clean(imported.phone) && phoneDigits(imported.phone) !== phoneDigits(existing.phone)) {
    phone = clean(imported.phone);
    changed = true;
  }
  // Email: confronto su chiave normalizzata.
  let email = clean(existing.email);
  if (clean(imported.email) && emailKey(imported.email) !== emailKey(existing.email)) {
    email = clean(imported.email);
    changed = true;
  }
  // Sesso: sovrascrive solo se Matchpoint ha un valore reale (M/F) diverso.
  let gender = existing.gender || 'NA';
  if (imported.gender && imported.gender !== 'NA' && imported.gender !== existing.gender) {
    gender = imported.gender;
    changed = true;
  }

  const firstName = fn.value || titleCaseNamePart(existing.firstName || imported.firstName);
  const surname = sn.value || titleCaseNamePart(existing.surname || imported.surname);
  const importedAge = parseAgeValue(imported.age);
  const existingAge = parseAgeValue(existing.age);
  const payload: JsonMap = {
    ...existing,
    id: existing.id || imported.id,
    memberId: chooseMemberId(existing.memberId, imported.memberId),
    firstName,
    surname,
    name: compactSpaces(`${firstName} ${surname}`),
    phone,
    email,
    gender,
    birthDate: existing.birthDate || imported.birthDate || '',
    age: importedAge !== null ? importedAge : (existingAge !== null ? existingAge : null),
    city: existing.city || imported.city || '',
    cap: existing.cap || imported.cap || '',
    province: existing.province || imported.province || '',
    address: existing.address || imported.address || '',
    level: existing.level || imported.level || 0.5, // Livello: curato nell'app, mai sovrascritto da Matchpoint
    playingPosition: existing.playingPosition || existing.position || imported.playingPosition || '',
    active: existing.active !== false,
    prefDays: Array.isArray(existing.prefDays) ? existing.prefDays : [],
    prefHours: Array.isArray(existing.prefHours) ? existing.prefHours : [],
    source: existing.source || 'matchpoint_auto',
    matchpointImportedAt: importedAt,
    updatedAt: changed ? importedAt : (clean(existing.updatedAt) || importedAt),
  };
  return { payload, changed };
}

// Invia un broadcast Realtime "member-mp-changed" sul canale pv-staff-cal-{prod|test}, così i
// device connessi applicano subito la modifica via staffCalRtApplyMatchpointMember (che preserva
// il Livello curato in locale), senza refresh. Usa la REST API broadcast di Supabase Realtime
// (canale pubblico → basta la apikey anon). Niente postgres_changes: pmo_cloud_records è RPC-only
// (RLS senza policy), quindi i postgres_changes non verrebbero mai consegnati.
async function broadcastMemberChanges(supabaseUrl: string, apiKey: string, members: JsonMap[]) {
  const list = (Array.isArray(members) ? members : []).filter(Boolean);
  if (!list.length) return { sent: 0, ok: true, skipped: true };
  const env = supabaseUrl.includes('qqbfphyslczzkxoncgex') ? 'prod' : 'test';
  const topic = `pv-staff-cal-${env}`;
  const ts = Date.now();
  const CAP = 200;
  const capped = list.length > CAP;
  const slice = list.slice(0, CAP);
  const endpoint = `${supabaseUrl.replace(/\/+$/, '')}/realtime/v1/api/broadcast`;
  let sent = 0;
  let lastStatus = 0;
  let okAll = true;
  // Chunk da 50 messaggi per restare sotto i rate-limit del broadcast.
  for (let i = 0; i < slice.length; i += 50) {
    const messages = slice.slice(i, i + 50).map((m) => ({ topic, event: 'member-mp-changed', payload: { member: m, ts } }));
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey, Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ messages }),
      });
      lastStatus = res.status;
      if (res.ok) sent += messages.length; else okAll = false;
    } catch {
      okAll = false;
    }
  }
  return { sent, ok: okAll, status: lastStatus, capped, total: list.length };
}

function attr(tag: string, name: string) {
  const re = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = tag.match(re);
  return htmlDecode(match?.[2] || match?.[3] || match?.[4] || '');
}

function splitSetCookie(header: string) {
  if (!header) return [];
  return header.split(/,(?=\s*[^;,=\s]+=[^;,]+)/g).map((item) => item.trim()).filter(Boolean);
}

class CookieJar {
  private items = new Map<string, string>();

  store(headers: Headers) {
    const rawList = typeof (headers as any).getSetCookie === 'function'
      ? (headers as any).getSetCookie()
      : splitSetCookie(headers.get('set-cookie') || '');
    for (const raw of rawList) {
      const [pair] = raw.split(';');
      const eq = pair.indexOf('=');
      if (eq <= 0) continue;
      this.items.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }

  header() {
    return [...this.items.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
  }
}

class MatchpointSession {
  private readonly jar = new CookieJar();

  constructor(private readonly baseUrl: string) {}

  resolve(pathOrUrl: string) {
    return new URL(pathOrUrl, this.baseUrl).toString();
  }

  async fetch(pathOrUrl: string, init: RequestInit = {}, redirects = 0): Promise<Response> {
    const url = this.resolve(pathOrUrl);
    const headers = new Headers(init.headers || {});
    const cookie = this.jar.header();
    if (cookie) headers.set('Cookie', cookie);
    if (!headers.has('User-Agent')) {
      headers.set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36');
    }
    if (!headers.has('Accept-Language')) headers.set('Accept-Language', 'it-IT,it;q=0.9,en;q=0.8');
    const response = await fetch(url, { ...init, headers, redirect: 'manual' });
    this.jar.store(response.headers);
    if ([301, 302, 303, 307, 308].includes(response.status) && redirects < 8) {
      const location = response.headers.get('location');
      if (location) {
        if ([307, 308].includes(response.status)) {
          return this.fetch(new URL(location, url).toString(), init, redirects + 1);
        }
        return this.fetch(new URL(location, url).toString(), { method: 'GET', headers: init.headers }, redirects + 1);
      }
    }
    return response;
  }

  async text(pathOrUrl: string, init: RequestInit = {}) {
    const response = await this.fetch(pathOrUrl, init);
    return { response, text: await response.text() };
  }

  async postForm(pathOrUrl: string, fields: JsonMap, referer = '') {
    const targetUrl = this.resolve(pathOrUrl);
    const body = new URLSearchParams();
    Object.entries(fields).forEach(([key, value]) => body.set(key, clean(value)));
    return this.fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Origin': new URL(targetUrl).origin,
        ...(referer ? { Referer: referer } : {}),
      },
      body,
    });
  }
}

function alignLoginLanguage(fields: JsonMap) {
  const hiddenLang = clean(fields.HiddenFieldLang);
  if (hiddenLang && Object.prototype.hasOwnProperty.call(fields, 'ddlLenguaje')) {
    fields.ddlLenguaje = hiddenLang;
  }
  return hiddenLang;
}

async function syncLoginLanguage(session: MatchpointSession, currentUrl: string, lang: string) {
  if (!lang) return;
  const endpoint = new URL('Login.aspx/CambiarLenguaje', currentUrl).toString();
  await session.fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': currentUrl,
    },
    body: JSON.stringify({ lang }),
  }).catch(() => {});
}

function extractForms(html: string, currentUrl: string) {
  const forms: Array<{ html: string; actionUrl: string; fields: JsonMap }> = [];
  const matches = html.matchAll(/<form\b[\s\S]*?<\/form>/gi);
  for (const match of matches) {
    const formHtml = match[0];
    const firstTag = formHtml.match(/<form\b[^>]*>/i)?.[0] || '';
    const action = attr(firstTag, 'action');
    forms.push({
      html: formHtml,
      actionUrl: action ? new URL(action, currentUrl).toString() : currentUrl,
      fields: collectFormFields(formHtml),
    });
  }
  if (!forms.length) {
    forms.push({ html, actionUrl: currentUrl, fields: collectFormFields(html) });
  }
  return forms;
}

function collectFormFields(html: string) {
  const fields: JsonMap = {};
  const inputs = html.matchAll(/<input\b[^>]*>/gi);
  for (const input of inputs) {
    const tag = input[0];
    const name = attr(tag, 'name');
    if (!name) continue;
    const type = attr(tag, 'type').toLocaleLowerCase('it-IT');
    if (['submit', 'button', 'image', 'file', 'reset'].includes(type)) continue;
    if (['checkbox', 'radio'].includes(type) && !/\bchecked\b/i.test(tag)) continue;
    fields[name] = attr(tag, 'value');
  }
  const textareas = html.matchAll(/<textarea\b[^>]*name\s*=\s*["']?([^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/textarea>/gi);
  for (const textarea of textareas) fields[htmlDecode(textarea[1])] = htmlDecode(textarea[2] || '');
  const selects = html.matchAll(/<select\b[\s\S]*?<\/select>/gi);
  for (const select of selects) {
    const tag = select[0].match(/<select\b[^>]*>/i)?.[0] || '';
    const name = attr(tag, 'name');
    if (!name) continue;
    const options = [...select[0].matchAll(/<option\b[^>]*>[\s\S]*?<\/option>/gi)].map((item) => item[0]);
    const selected = options.find((item) => /\bselected\b/i.test(item)) || options[0];
    if (selected) fields[name] = attr(selected, 'value') || htmlDecode(selected.replace(/<[^>]+>/g, ''));
  }
  return fields;
}

function inputNameByType(formHtml: string, type: string) {
  for (const match of formHtml.matchAll(/<input\b[^>]*>/gi)) {
    const tag = match[0];
    if (attr(tag, 'type').toLocaleLowerCase('it-IT') === type) return attr(tag, 'name');
  }
  return '';
}

function usernameInputName(formHtml: string, passwordName: string) {
  const candidates: Array<{ name: string; score: number }> = [];
  for (const match of formHtml.matchAll(/<input\b[^>]*>/gi)) {
    const tag = match[0];
    const name = attr(tag, 'name');
    if (!name || name === passwordName) continue;
    const type = attr(tag, 'type').toLocaleLowerCase('it-IT') || 'text';
    if (!['text', 'email', 'tel', ''].includes(type)) continue;
    const joined = `${name} ${attr(tag, 'id')} ${attr(tag, 'placeholder')}`.toLocaleLowerCase('it-IT');
    let score = 0;
    if (/usuario|usuari|user|login|email|mail|utente/.test(joined)) score += 10;
    if (/txt|input|ctl/.test(joined)) score += 1;
    candidates.push({ name, score });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.name || '';
}

function submitControl(formHtml: string, pattern: RegExp) {
  for (const match of formHtml.matchAll(/<(input|button)\b[^>]*>(?:[\s\S]*?<\/button>)?/gi)) {
    const tag = match[0];
    const type = attr(tag, 'type').toLocaleLowerCase('it-IT');
    if (match[1].toLocaleLowerCase('it-IT') === 'input' && !['submit', 'button', 'image'].includes(type)) continue;
    const label = compactSpaces(`${attr(tag, 'value')} ${tag.replace(/<[^>]+>/g, ' ')}`);
    if (!pattern.test(label)) continue;
    const eventTarget = htmlDecode(attr(tag, 'onclick')).match(/__doPostBack\(\s*['"]([^'"]+)['"]/i)?.[1] || '';
    return { name: attr(tag, 'name'), value: attr(tag, 'value') || label, eventTarget };
  }
  return { name: '', value: '', eventTarget: '' };
}

function stripTags(value: string) {
  return compactSpaces(value.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
}

function exportPattern() {
  return /export|exportar|excel|xls|xlsx|csv|descargar|download|scarica|esporta/i;
}

function discoverExportPostbackTarget(html: string, configuredTarget: string) {
  if (configuredTarget && html.includes(configuredTarget)) {
    return { target: configuredTarget, candidates: [{ target: configuredTarget, score: 999, reason: 'configured' }] };
  }
  const decoded = htmlDecode(html);
  const candidates: Array<{ target: string; score: number; reason: string }> = [];
  const addCandidate = (target: string, context: string, reason: string) => {
    const cleanTarget = htmlDecode(target);
    if (!cleanTarget) return;
    const haystack = `${cleanTarget} ${stripTags(context)}`;
    let score = 0;
    if (/exportar/i.test(haystack)) score += 80;
    if (/export/i.test(haystack)) score += 70;
    if (/excel|xls|xlsx/i.test(haystack)) score += 60;
    if (/csv/i.test(haystack)) score += 35;
    if (/descargar|download|scarica|esporta/i.test(haystack)) score += 30;
    if (/LinkButton|Button|ImageButton/i.test(cleanTarget)) score += 10;
    if (/delete|eliminar|remove|borrar|logout|login|page|sort/i.test(haystack)) score -= 100;
    if (score > 0) candidates.push({ target: cleanTarget, score, reason });
  };

  for (const match of decoded.matchAll(/__doPostBack\(\s*['"]([^'"]+)['"]\s*,\s*['"][^'"]*['"]\s*\)/gi)) {
    const index = match.index || 0;
    addCandidate(match[1], decoded.slice(Math.max(0, index - 500), index + 500), '__doPostBack');
  }
  for (const match of decoded.matchAll(/WebForm_DoPostBackWithOptions\(\s*new\s+WebForm_PostBackOptions\(\s*['"]([^'"]+)['"]/gi)) {
    const index = match.index || 0;
    addCandidate(match[1], decoded.slice(Math.max(0, index - 500), index + 500), 'WebForm_PostBackOptions');
  }

  const bestByTarget = new Map<string, { target: string; score: number; reason: string }>();
  for (const candidate of candidates) {
    const previous = bestByTarget.get(candidate.target);
    if (!previous || candidate.score > previous.score) bestByTarget.set(candidate.target, candidate);
  }
  const sorted = [...bestByTarget.values()].sort((a, b) => b.score - a.score);
  return { target: sorted[0]?.target || '', candidates: sorted.slice(0, 10) };
}

function discoverExportSubmitControl(formHtml: string) {
  const pattern = exportPattern();
  for (const match of formHtml.matchAll(/<(input|button)\b[^>]*>(?:[\s\S]*?<\/button>)?/gi)) {
    const tag = match[0];
    const type = attr(tag, 'type').toLocaleLowerCase('it-IT');
    if (match[1].toLocaleLowerCase('it-IT') === 'input' && !['submit', 'button', 'image'].includes(type)) continue;
    const name = attr(tag, 'name');
    const value = attr(tag, 'value');
    const context = `${name} ${attr(tag, 'id')} ${value} ${stripTags(tag)}`;
    if (name && pattern.test(context) && !/delete|eliminar|remove|borrar|logout|login/i.test(context)) {
      return { name, value: value || stripTags(tag) || 'Export' };
    }
  }
  return { name: '', value: '' };
}

function discoverExportLink(html: string, currentUrl: string) {
  const pattern = exportPattern();
  const candidates: Array<{ url: string; href: string; score: number; reason: string }> = [];
  for (const match of htmlDecode(html).matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)) {
    const tag = match[0];
    const href = attr(tag, 'href');
    if (!href || /^javascript:/i.test(href) || href === '#') continue;
    const label = stripTags(tag);
    const context = compactSpaces(`${href} ${attr(tag, 'id')} ${attr(tag, 'class')} ${attr(tag, 'title')} ${label}`);
    if (!pattern.test(context) || /delete|eliminar|remove|borrar|logout|login/i.test(context)) continue;
    let score = 0;
    if (/exportar|export/i.test(context)) score += 70;
    if (/excel|xls|xlsx/i.test(context)) score += 60;
    if (/csv/i.test(context)) score += 35;
    if (/descargar|download|scarica|esporta/i.test(context)) score += 30;
    candidates.push({ url: new URL(href, currentUrl).toString(), href, score, reason: 'anchor' });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || { url: '', href: '', score: 0, reason: '' };
}

function collectPostbackTargets(html: string) {
  const decoded = htmlDecode(html);
  const targets: string[] = [];
  const add = (target: string) => {
    const value = htmlDecode(target);
    if (value && !targets.includes(value)) targets.push(value);
  };
  for (const match of decoded.matchAll(/__doPostBack\(\s*['"]([^'"]+)['"]\s*,\s*['"][^'"]*['"]\s*\)/gi)) add(match[1]);
  for (const match of decoded.matchAll(/WebForm_DoPostBackWithOptions\(\s*new\s+WebForm_PostBackOptions\(\s*['"]([^'"]+)['"]/gi)) add(match[1]);
  return targets.slice(0, 80);
}

function safeTagControl(tag: string) {
  const name = attr(tag, 'name');
  const id = attr(tag, 'id');
  const type = attr(tag, 'type');
  const className = attr(tag, 'class');
  const title = attr(tag, 'title');
  const alt = attr(tag, 'alt');
  const href = attr(tag, 'href');
  const onclick = attr(tag, 'onclick');
  return {
    tag: (tag.match(/^<\s*([a-z0-9]+)/i)?.[1] || '').toLocaleLowerCase('it-IT'),
    name,
    id,
    type,
    className,
    title,
    alt,
    href: href ? href.slice(0, 240) : '',
    onclickHint: onclick ? onclick.replace(/\s+/g, ' ').slice(0, 240) : '',
  };
}

function collectTechnicalControls(html: string) {
  const pattern = /export|exportar|excel|xls|xlsx|csv|descargar|download|scarica|esporta|acciones|accion|toolbar|tool|grid|listado/i;
  const controls: JsonMap[] = [];
  for (const match of htmlDecode(html).matchAll(/<(a|input|button|img|span)\b[^>]*(?:>[\s\S]*?<\/\1>)?/gi)) {
    const tag = match[0];
    const summary = safeTagControl(tag);
    const label = stripTags(tag);
    const context = compactSpaces(`${summary.name} ${summary.id} ${summary.type} ${summary.className} ${summary.title} ${summary.alt} ${summary.href} ${summary.onclickHint} ${label}`);
    if (!pattern.test(context)) continue;
    controls.push({
      ...summary,
      labelHint: exportPattern().test(label) ? label.slice(0, 120) : '',
    });
    if (controls.length >= 80) break;
  }
  return controls;
}

function collectExportDiagnostics(
  html: string,
  currentUrl: string,
  configuredTarget: string,
  discoveredPostback: ExportDiscovery | null = null,
  submitExport: JsonMap | null = null,
  exportLink: JsonMap | null = null,
) {
  const forms = extractForms(html, currentUrl);
  const title = stripTags((html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').slice(0, 240));
  return {
    url: currentUrl,
    title,
    htmlSize: html.length,
    hasViewState: html.includes('__VIEWSTATE'),
    hasEventValidation: html.includes('__EVENTVALIDATION'),
    configuredTarget,
    configuredTargetFound: !!configuredTarget && html.includes(configuredTarget),
    formCount: forms.length,
    formActions: forms.slice(0, 8).map((form) => ({
      actionUrl: form.actionUrl,
      fieldCount: Object.keys(form.fields || {}).length,
      hasViewState: Object.prototype.hasOwnProperty.call(form.fields || {}, '__VIEWSTATE'),
    })),
    postbackTargets: collectPostbackTargets(html),
    exportCandidates: discoveredPostback?.candidates || [],
    submitControl: submitExport?.name ? submitExport : null,
    exportLink: exportLink?.url ? exportLink : null,
    technicalControls: collectTechnicalControls(html),
  };
}

function errorWithDiagnostic(code: string, diagnostic: JsonMap) {
  const error = new Error(`${code}:${JSON.stringify(diagnostic)}`);
  (error as any).code = code;
  (error as any).diagnostic = diagnostic;
  return error;
}

function looksLikeLoginPage(html: string, url = '') {
  return /type\s*=\s*["']?password/i.test(html) || /Login\.aspx/i.test(url);
}

function looksLikeCashSelection(html: string, url = '') {
  const text = normalizeKey(html.replace(/<[^>]+>/g, ' '));
  return !/type\s*=\s*["']?password/i.test(html) && text.includes('cassa') && (text.includes('entra') || text.includes('entrar'));
}

function looksLikeMatchpointErrorPage(html: string, url = '') {
  if (/\/Error\.aspx/i.test(url) || /aspxerrorpath=/i.test(url)) return true;
  const text = normalizeKey(stripTags(html).slice(0, 1600));
  return text.includes('error') && (text.includes('aspx') || text.includes('matchpoint'));
}

function titleFromHtml(html: string) {
  return stripTags((html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').slice(0, 240));
}

function clientPageProbeSummary(requestedUrl: string, response: Response, html: string) {
  return {
    requestedUrl,
    finalUrl: response.url,
    status: response.status,
    title: titleFromHtml(html),
    htmlSize: html.length,
    hasViewState: html.includes('__VIEWSTATE'),
    isLogin: looksLikeLoginPage(html, response.url),
    isError: looksLikeMatchpointErrorPage(html, response.url),
  };
}

function normalizeCandidateUrl(raw: string, currentUrl: string) {
  const value = htmlDecode(raw).replace(/\\\//g, '/').trim();
  if (!value || /^javascript:/i.test(value) || value === '#') return '';
  try {
    return new URL(value, currentUrl).toString();
  } catch {
    return '';
  }
}

function collectClientPageCandidates(html: string, currentUrl: string) {
  const candidates: string[] = [];
  const add = (raw: string) => {
    const url = normalizeCandidateUrl(raw, currentUrl);
    if (!url || !/client/i.test(url) || !/\.aspx/i.test(url)) return;
    if (/Login\.aspx|Error\.aspx/i.test(url)) return;
    if (!candidates.includes(url)) candidates.push(url);
  };

  for (const match of html.matchAll(/\b(?:href|src|action)\s*=\s*["']([^"']*client[^"']*\.aspx[^"']*)["']/gi)) add(match[1]);
  for (const match of html.matchAll(/["']([^"']*client[^"']*\.aspx[^"']*)["']/gi)) add(match[1]);
  for (const match of html.matchAll(/(\/[A-Za-z0-9_.~/%-]*client[A-Za-z0-9_.~/%-]*\.aspx(?:\?[^"'\s<>)]*)?)/gi)) add(match[1]);

  return candidates.slice(0, 20);
}

function configuredClientCandidates(session: MatchpointSession, clientsPath: string) {
  const paths = [
    clientsPath,
    '/clientes/Listadoclientes.aspx?pagesize=15',
    '/clientes/ListadoClientes.aspx?pagesize=15',
    '/Clientes/Listadoclientes.aspx?pagesize=15',
    '/Clientes/ListadoClientes.aspx?pagesize=15',
    '/clientes/Listadoclientes.aspx',
    '/clientes/ListadoClientes.aspx',
    '/clientes/clientes.aspx',
    '/Clientes/Clientes.aspx',
  ];
  const urls: string[] = [];
  for (const path of paths) {
    const url = session.resolve(path);
    if (!urls.includes(url)) urls.push(url);
  }
  return urls;
}

async function loginToMatchpoint(session: MatchpointSession) {
  const username = clean(Deno.env.get('MATCHPOINT_USERNAME') || '');
  const password = clean(Deno.env.get('MATCHPOINT_PASSWORD') || '');
  if (!username || !password) throw new Error('MATCHPOINT_SECRETS_MISSING');

  let { response, text } = await session.text('/Login.aspx');
  let currentUrl = response.url;
  if (!response.ok && response.status !== 404) throw new Error(`MATCHPOINT_LOGIN_PAGE_HTTP_${response.status}`);
  if (!looksLikeLoginPage(text, currentUrl)) {
    ({ response, text } = await session.text('/default.aspx'));
    currentUrl = response.url;
  }

  const loginForms = extractForms(text, currentUrl).filter((form) => /type\s*=\s*["']?password/i.test(form.html));
  const loginForm = loginForms[0] || extractForms(text, currentUrl)[0];
  const passwordName = inputNameByType(loginForm.html, 'password');
  const userName = usernameInputName(loginForm.html, passwordName);
  if (!passwordName || !userName) {
    throw new Error(`MATCHPOINT_LOGIN_FIELDS_NOT_FOUND:${JSON.stringify({ userNameFound: !!userName, passwordNameFound: !!passwordName })}`);
  }
  const fields = { ...loginForm.fields, [userName]: username, [passwordName]: password };
  const loginLang = alignLoginLanguage(fields);
  await syncLoginLanguage(session, currentUrl, loginLang);
  const submit = submitControl(loginForm.html, /entra|entrar|login|accedi|acceder|iniciar/i);
  if (submit.eventTarget) {
    fields.__EVENTTARGET = submit.eventTarget;
    fields.__EVENTARGUMENT = '';
  } else if (submit.name) {
    fields[submit.name] = submit.value;
  }

  response = await session.postForm(loginForm.actionUrl, fields, currentUrl);
  text = await response.text();
  currentUrl = response.url;
  if (looksLikeLoginPage(text, currentUrl) && !looksLikeCashSelection(text, currentUrl)) {
    throw errorWithDiagnostic('MATCHPOINT_LOGIN_FAILED', {
      finalUrl: currentUrl,
      title: titleFromHtml(text),
      hasPasswordField: /type\s*=\s*["']?password/i.test(text),
      formCount: extractForms(text, currentUrl).length,
    });
  }

  if (looksLikeCashSelection(text, currentUrl)) {
    const forms = extractForms(text, currentUrl);
    const enterForm = forms.find((form) => /entra|entrar|acceder/i.test(form.html)) || forms[0];
    const enterFields = { ...enterForm.fields };
    const enterSubmit = submitControl(enterForm.html, /entra|entrar|acceder/i);
    if (enterSubmit.eventTarget) {
      enterFields.__EVENTTARGET = enterSubmit.eventTarget;
      enterFields.__EVENTARGUMENT = '';
    } else if (enterSubmit.name) {
      enterFields[enterSubmit.name] = enterSubmit.value;
    }
    response = await session.postForm(enterForm.actionUrl, enterFields, currentUrl);
    text = await response.text();
    currentUrl = response.url;
  }

  return { finalUrl: currentUrl, html: text, htmlSample: text.slice(0, 1000) };
}

function filenameFromDisposition(value: string) {
  const match = value.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  return match ? decodeURIComponent(match[1].replace(/^"|"$/g, '')) : '';
}

function isExcelResponse(bytes: Uint8Array, contentType: string, disposition: string) {
  const ct = contentType.toLocaleLowerCase('it-IT');
  const cd = disposition.toLocaleLowerCase('it-IT');
  const zip = bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  const xls = bytes.length > 8 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
  return zip || xls || cd.includes('.xls') || ct.includes('spreadsheet') || ct.includes('excel');
}

async function downloadReportFromSession(
  session: MatchpointSession,
  login: { finalUrl: string; html: string },
  clientsPath: string,
  exportTarget: string,
): Promise<MatchpointExport> {
  let homeResponse: Response | null = null;
  let homeText = '';
  try {
    const home = await session.text('/default.aspx');
    homeResponse = home.response;
    homeText = home.text;
  } catch {
    homeResponse = null;
    homeText = '';
  }

  const candidateUrls = [
    ...configuredClientCandidates(session, clientsPath),
    ...collectClientPageCandidates(login.html || '', login.finalUrl),
    ...collectClientPageCandidates(homeText, homeResponse?.url || login.finalUrl),
  ].filter((url, index, list) => !!url && list.indexOf(url) === index);

  const clientPageAttempts: JsonMap[] = [];
  let response: Response | null = null;
  let text = '';
  for (const candidateUrl of candidateUrls) {
    const probe = await session.text(candidateUrl);
    clientPageAttempts.push(clientPageProbeSummary(candidateUrl, probe.response, probe.text));
    if (
      probe.response.ok
      && !looksLikeLoginPage(probe.text, probe.response.url)
      && !looksLikeMatchpointErrorPage(probe.text, probe.response.url)
      && probe.text.includes('__VIEWSTATE')
    ) {
      response = probe.response;
      text = probe.text;
      break;
    }
  }

  if (!response) {
    throw errorWithDiagnostic(
      'MATCHPOINT_CLIENTS_EXPORT_TARGET_NOT_FOUND',
      {
        loginFinalUrl: login.finalUrl,
        homeFinalUrl: homeResponse?.url || '',
        configuredClientsPath: clientsPath,
        candidateUrls,
        clientPageAttempts,
        homeClientCandidates: collectClientPageCandidates(homeText, homeResponse?.url || login.finalUrl),
      },
    );
  }

  if (looksLikeLoginPage(text, response.url)) throw new Error('MATCHPOINT_CLIENTS_PAGE_NOT_AUTHENTICATED');
  if (looksLikeMatchpointErrorPage(text, response.url)) {
    throw errorWithDiagnostic(
      'MATCHPOINT_CLIENTS_EXPORT_TARGET_NOT_FOUND',
      {
        loginFinalUrl: login.finalUrl,
        homeFinalUrl: homeResponse?.url || '',
        configuredClientsPath: clientsPath,
        clientPageAttempts,
        selectedErrorPage: clientPageProbeSummary(response.url, response, text),
      },
    );
  }
  if (!text.includes('__VIEWSTATE')) {
    throw errorWithDiagnostic(
      'MATCHPOINT_CLIENTS_EXPORT_TARGET_NOT_FOUND',
      {
        loginFinalUrl: login.finalUrl,
        homeFinalUrl: homeResponse?.url || '',
        configuredClientsPath: clientsPath,
        clientPageAttempts,
        exportPageDiagnostic: collectExportDiagnostics(text, response.url, exportTarget),
      },
    );
  }

  const form = extractForms(text, response.url).find((item) => item.html.includes('__VIEWSTATE')) || extractForms(text, response.url)[0];
  const discoveredPostback = discoverExportPostbackTarget(text, exportTarget);
  const submitExport = discoveredPostback.target ? { name: '', value: '' } : discoverExportSubmitControl(form.html);
  const exportLink = (!discoveredPostback.target && !submitExport.name)
    ? discoverExportLink(text, response.url)
    : { url: '', href: '', score: 0, reason: '' };
  if (!discoveredPostback.target && !submitExport.name && !exportLink.url) {
    throw errorWithDiagnostic(
      'MATCHPOINT_CLIENTS_EXPORT_TARGET_NOT_FOUND',
      collectExportDiagnostics(text, response.url, exportTarget, discoveredPostback, submitExport, exportLink),
    );
  }
  let exportResponse: Response;
  if (exportLink.url) {
    exportResponse = await session.fetch(exportLink.url, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,*/*',
        Referer: response.url,
      },
    });
  } else {
    const fields = {
      ...form.fields,
      __EVENTTARGET: discoveredPostback.target,
      __EVENTARGUMENT: '',
    };
    if (submitExport.name) fields[submitExport.name] = submitExport.value;
    exportResponse = await session.postForm(form.actionUrl, fields, response.url);
  }
  const bytes = new Uint8Array(await exportResponse.arrayBuffer());
  const contentType = exportResponse.headers.get('content-type') || '';
  const disposition = exportResponse.headers.get('content-disposition') || '';
  if (!exportResponse.ok || !isExcelResponse(bytes, contentType, disposition)) {
    let snippet = '';
    try { snippet = new TextDecoder().decode(bytes.slice(0, 1200)); } catch {}
    throw new Error(`MATCHPOINT_EXPORT_FAILED:${JSON.stringify({
      status: exportResponse.status,
      contentType,
      disposition,
      finalUrl: exportResponse.url,
      snippet: snippet.replace(/\s+/g, ' ').slice(0, 500),
      fallback: 'browser_worker_headless',
    })}`);
  }

  return {
    bytes,
    filename: filenameFromDisposition(disposition) || `matchpoint-clienti-${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`,
    contentType: contentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    finalUrl: exportResponse.url,
    mode: 'http_postback',
    diagnostic: {
      mode: 'http_postback',
      loginFinalUrl: login.finalUrl,
      clientsFinalUrl: response.url,
      exportFinalUrl: exportResponse.url,
      exportStatus: exportResponse.status,
      exportPostbackTarget: discoveredPostback.target,
      exportSubmitControl: submitExport.name,
      exportLink: exportLink.url,
    },
  };
}

async function exportClientsViaHttp(clientsPathOverride?: string, exportTargetOverride?: string): Promise<MatchpointExport> {
  const baseUrl = (Deno.env.get('MATCHPOINT_BASE_URL') || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const clientsPath = clientsPathOverride ?? (Deno.env.get('MATCHPOINT_CLIENTS_PATH') || DEFAULT_CLIENTS_PATH);
  const exportTarget = exportTargetOverride ?? (Deno.env.get('MATCHPOINT_EXPORT_TARGET') || DEFAULT_EXPORT_TARGET);
  const session = new MatchpointSession(baseUrl);
  const login = await loginToMatchpoint(session);
  return downloadReportFromSession(session, login, clientsPath, exportTarget);
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

function workerExportUrl(rawUrl: string) {
  const url = rawUrl.replace(/\/+$/, '');
  return /\/export-clients$/i.test(url) ? url : `${url}/export-clients`;
}

function workerHealthUrl(rawUrl: string) {
  const url = rawUrl.replace(/\/+$/, '').replace(/\/export-clients$/i, '');
  return `${url}/health`;
}

function shouldFallbackToBrowserWorker(error: unknown) {
  const code = parseErrorInfo(error).code;
  return [
    'MATCHPOINT_LOGIN_FAILED',
    'MATCHPOINT_CLIENTS_PAGE_NOT_AUTHENTICATED',
    'MATCHPOINT_CLIENTS_EXPORT_TARGET_NOT_FOUND',
    'MATCHPOINT_EXPORT_FAILED',
  ].includes(code);
}

async function exportClientsViaBrowserWorker(
  originalError: unknown,
  options?: { navigationMode?: string; clientsPath?: string; exportTarget?: string; fallbackLabel?: string },
): Promise<MatchpointExport> {
  const fallbackFrom = options?.fallbackLabel ? { code: options.fallbackLabel } : parseErrorInfo(originalError);
  const workerUrl = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_URL') || '');
  const workerApiKey = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_API_KEY') || '');
  if (!workerUrl || !workerApiKey) {
    throw errorWithDiagnostic('MATCHPOINT_BROWSER_WORKER_SECRETS_MISSING', {
      fallbackFrom: fallbackFrom.code,
      hasWorkerUrl: !!workerUrl,
      hasWorkerApiKey: !!workerApiKey,
    });
  }
  const username = clean(Deno.env.get('MATCHPOINT_USERNAME') || '');
  const password = clean(Deno.env.get('MATCHPOINT_PASSWORD') || '');
  if (!username || !password) throw new Error('MATCHPOINT_SECRETS_MISSING');

  const baseUrl = (Deno.env.get('MATCHPOINT_BASE_URL') || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const clientsPath = options?.clientsPath ?? (Deno.env.get('MATCHPOINT_CLIENTS_PATH') || DEFAULT_CLIENTS_PATH);
  const exportTarget = options?.exportTarget ?? (Deno.env.get('MATCHPOINT_EXPORT_TARGET') || DEFAULT_EXPORT_TARGET);
  const endpoint = workerExportUrl(workerUrl);
  const healthEndpoint = workerHealthUrl(workerUrl);
  const bodyObj: JsonMap = {
    username,
    password,
    baseUrl,
    clientsPath,
    exportTarget,
    fallbackFrom: fallbackFrom.code,
    credentialSource: 'supabase_secret',
  };
  if (options?.navigationMode) bodyObj.navigationMode = options.navigationMode;
  const requestBody = JSON.stringify(bodyObj);
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
      fallbackFrom: fallbackFrom.code,
      networkError,
      workerError: payload.error || '',
      workerMessage: payload.message || '',
      workerDiagnostic: payload.diagnostic || null,
    };

    if (response?.ok && payload.ok === true && payload.base64) break;
    if (attempt >= 3) {
      throw errorWithDiagnostic('MATCHPOINT_BROWSER_WORKER_FAILED', lastDiagnostic);
    }
    // Il worker ritorna HTTP 500 per i suoi fail() interni (navigazione, pulsante export
    // non trovato, login glitch, download vuoto…): per lo più TRANSITORI, un retry con
    // backoff di norma riesce. Prima si ritentava solo su 502/503/504; ora anche sul 500
    // con codice worker transitorio, NON sugli errori logici (secret/credenziali mancanti).
    const workerCode = String(payload.error || '');
    const transientWorkerCode = !!workerCode && !/SECRETS_MISSING|CREDENTIALS_MISSING/i.test(workerCode);
    const retryable = !response || response.status === 0 || [502, 503, 504].includes(response.status)
      || (response.status === 500 && transientWorkerCode);
    if (!retryable) {
      throw errorWithDiagnostic('MATCHPOINT_BROWSER_WORKER_FAILED', lastDiagnostic);
    }
  }

  return {
    bytes: bytesFromBase64(clean(payload.base64)),
    filename: clean(payload.filename) || `matchpoint-clienti-${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`,
    contentType: clean(payload.contentType) || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    finalUrl: clean(payload.diagnostic?.clientsUrl || payload.diagnostic?.downloadUrl || endpoint),
    mode: 'browser_worker_headless',
    diagnostic: {
      mode: 'browser_worker_headless',
      fallbackFrom: fallbackFrom.code,
      worker: payload.diagnostic || null,
    },
  };
}

async function exportCodiceViaBrowserWorker(): Promise<MatchpointExport> {
  const codicePath = Deno.env.get('MATCHPOINT_CODICE_PATH') || DEFAULT_CLIENTS_PATH;
  const codiceTarget = Deno.env.get('MATCHPOINT_CODICE_EXPORT_TARGET') || DEFAULT_EXPORT_TARGET;
  const codiceNavMode = Deno.env.get('MATCHPOINT_CODICE_NAV_MODE') || 'direct_clients';
  return exportClientsViaBrowserWorker(null, {
    navigationMode: codiceNavMode,
    clientsPath: codicePath,
    exportTarget: codiceTarget,
    fallbackLabel: 'CODICE_VIA_WORKER',
  });
}

async function exportClientsFromMatchpoint(): Promise<MatchpointExport> {
  try {
    return await exportClientsViaHttp();
  } catch (error) {
    if (!shouldFallbackToBrowserWorker(error)) throw error;
    return await exportClientsViaBrowserWorker(error);
  }
}

type CodiceDownloadResult = { ok: boolean; bytes?: Uint8Array; skippedReason?: string };

async function exportClientsWithCodice(): Promise<{ main: MatchpointExport; codice: CodiceDownloadResult }> {
  const baseUrl = (Deno.env.get('MATCHPOINT_BASE_URL') || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const mainPath = Deno.env.get('MATCHPOINT_CLIENTS_PATH') || DEFAULT_CLIENTS_PATH;
  const mainTarget = Deno.env.get('MATCHPOINT_EXPORT_TARGET') || DEFAULT_EXPORT_TARGET;
  const codicePath = Deno.env.get('MATCHPOINT_CODICE_PATH') || DEFAULT_CLIENTS_PATH;
  const codiceTarget = Deno.env.get('MATCHPOINT_CODICE_EXPORT_TARGET') || DEFAULT_EXPORT_TARGET;

  const session = new MatchpointSession(baseUrl);

  let main: MatchpointExport;
  let viaWorker = false;
  let login: { finalUrl: string; html: string } | null = null;
  try {
    login = await loginToMatchpoint(session);
    main = await downloadReportFromSession(session, login, mainPath, mainTarget);
  } catch (error) {
    if (!shouldFallbackToBrowserWorker(error)) throw error;
    main = await exportClientsViaBrowserWorker(error);
    viaWorker = true;
  }

  let codice: CodiceDownloadResult;
  if (!viaWorker && login) {
    // Sessione HTTP disponibile: scarica il Codice riusando la stessa sessione.
    try {
      const codiceExported = await downloadReportFromSession(session, login, codicePath, codiceTarget);
      codice = { ok: true, bytes: codiceExported.bytes };
    } catch (error) {
      codice = { ok: false, skippedReason: errorText(error).slice(0, 500) };
    }
  } else {
    // Login HTTP non disponibile (principale arrivato dal worker): scarica il Codice anch'esso dal worker.
    try {
      const codiceExported = await exportCodiceViaBrowserWorker();
      codice = { ok: true, bytes: codiceExported.bytes };
    } catch (error) {
      codice = { ok: false, skippedReason: errorText(error).slice(0, 500) };
    }
  }

  return { main, codice };
}

type CodiceMap = Map<string, string>;

function parseCodiceWorkbook(bytes: Uint8Array): { ok: true; map: CodiceMap; nameMap: CodiceMap; rowsParsed: number } | { ok: false; error: string; message: string } {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, { type: 'array', cellDates: true });
  } catch (e) {
    return { ok: false, error: 'CODICE_PARSE_ERROR', message: errorText(e) };
  }
  if (!workbook.SheetNames.includes('Risultati')) {
    return { ok: false, error: 'CODICE_SHEET_MISSING', message: 'Il report Codice non contiene il foglio Risultati.' };
  }
  const sheet = workbook.Sheets['Risultati'];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }) as JsonMap[];
  const map: CodiceMap = new Map();
  // Indice per nome completo: raccoglie tutti i codici visti per ciascun nome normalizzato,
  // ANCHE dalle righe senza telefono/email (servono per i soci senza contatti, es. Fabio De Luca).
  const nameCodes = new Map<string, Set<string>>();
  let rowsParsed = 0;
  for (const row of rows) {
    const codiceRaw = clean(getCell(row, ['Codice']));
    if (!codiceRaw) continue;
    const codiceDigits = codiceRaw.replace(/\D/g, '');
    if (!codiceDigits) continue;
    const memberId = codiceDigits.length <= 6 ? codiceDigits.padStart(6, '0') : codiceDigits;
    // Nome completo della riga Codice, con le stesse colonne/normalizzazione del parser principale.
    const cliente = clean(getCell(row, CLIENT_FULL_NAME_COLUMNS));
    let firstName = clean(getCell(row, CLIENT_FIRST_NAME_COLUMNS));
    let surname = clean(getCell(row, CLIENT_SURNAME_COLUMNS));
    if ((!firstName || !surname) && cliente) {
      const split = splitClienteName(cliente);
      firstName = firstName || split.firstName;
      surname = surname || split.surname;
    }
    const nameKey = normalizeKey(compactSpaces(`${titleCaseNamePart(firstName)} ${titleCaseNamePart(surname)}`));
    if (nameKey) {
      if (!nameCodes.has(nameKey)) nameCodes.set(nameKey, new Set());
      nameCodes.get(nameKey)!.add(memberId);
    }
    const phone = phoneDigits(getCell(row, ['Telefono cellulare', 'Cellulare', 'Telefono', 'Phone', 'Mobile']));
    const email = emailKey(getCell(row, ['E-mail', 'Email', 'Mail']));
    if (!phone && !email) continue;
    rowsParsed += 1;
    if (phone) map.set(`phone:${phone}`, memberId);
    if (email) map.set(`email:${email}`, memberId);
  }
  // nameMap: SOLO nomi univoci nel report (un unico codice). Guardia anti-omonimia.
  const nameMap: CodiceMap = new Map();
  for (const [nameKey, codes] of nameCodes) {
    if (codes.size === 1) nameMap.set(nameKey, [...codes][0]);
  }
  return { ok: true, map, nameMap, rowsParsed };
}

async function exportCodiceFromMatchpoint(): Promise<MatchpointExport> {
  const codicePath = Deno.env.get('MATCHPOINT_CODICE_PATH') || DEFAULT_CLIENTS_PATH;
  const codiceTarget = Deno.env.get('MATCHPOINT_CODICE_EXPORT_TARGET') || DEFAULT_EXPORT_TARGET;
  return exportClientsViaHttp(codicePath, codiceTarget);
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
      function: 'matchpoint-clients-sync',
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

async function loadExistingMemberRecords(admin: any) {
  const records: any[] = [];
  for (let from = 0, page = 0; page < 50; page += 1, from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await admin
      .from('pmo_cloud_records')
      .select('record_type,local_key,payload,deleted,synced_at')
      .eq('record_type', 'member')
      .eq('deleted', false)
      .order('synced_at', { ascending: true })
      .order('local_key', { ascending: true })
      .range(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) throw error;
    const pageRecords = Array.isArray(data) ? data : [];
    records.push(...pageRecords);
    if (pageRecords.length < SUPABASE_PAGE_SIZE) break;
    if (page === 49) throw new Error('SUPABASE_MEMBER_PAGE_LIMIT_EXCEEDED');
  }
  const byKey = new Map<string, any[]>();
  for (const record of records) {
    const payload = record.payload || {};
    for (const key of memberLookupKeys(payload)) {
      const list = byKey.get(key) || [];
      list.push(record);
      byKey.set(key, list);
    }
  }
  return { records, byKey };
}

function collectExistingMemberCandidates(existing: { byKey: Map<string, any[]> }, member: ParsedMember) {
  const candidates = new Map<string, any>();
  for (const key of memberLookupKeys(member)) {
    for (const record of existing.byKey.get(key) || []) {
      if (record?.local_key) candidates.set(record.local_key, record);
    }
  }
  return [...candidates.values()];
}

function chooseExistingMemberRecord(candidates: any[], member: ParsedMember) {
  const canonicalKey = memberCloudKey(member);
  const scored = candidates.map((record) => {
    const payload = record.payload || {};
    const source = clean(payload.source || '');
    let score = 0;
    if (record.local_key === canonicalKey) score += 220;
    if (source && source !== 'matchpoint_auto') score += 120;
    if (!source) score += 100;
    if (source === 'matchpoint_auto') score += 20;
    if (payload.matchpointImportedAt) score += 5;
    const syncedAt = new Date(record.synced_at || payload.updatedAt || 0).getTime() || 0;
    return { record, score, syncedAt };
  });
  scored.sort((a, b) => (b.score - a.score) || (b.syncedAt - a.syncedAt));
  return scored[0]?.record || null;
}

function buildDeletedMemberRecord(record: any, importedAt: string, reason: string) {
  const payload = record.payload || {};
  const source = clean(payload.source || '');
  return {
    record_type: 'member',
    local_key: clean(record?.local_key || ''),
    payload: {
      ...payload,
      active: false,
      source: source || 'legacy_duplicate',
      matchpointDeletedAt: importedAt,
      matchpointDeleteReason: reason,
      updatedAt: importedAt,
    },
    payload_hash: null,
    deleted: true,
    synced_at: importedAt,
  };
}

function shouldDeleteDuplicateMemberRecord(record: any) {
  const payload = record?.payload || {};
  const source = clean(payload.source || '');
  return !source || source === 'matchpoint_auto' || !!payload.matchpointImportedAt;
}

function legacyMemberHasCuratedData(payload: any): boolean {
  try {
    const p = payload || {};
    const nonEmptyStr = (v: unknown) => typeof v === 'string' && v.trim() !== '';
    const nonEmptyArr = (v: unknown) => Array.isArray(v) && v.length > 0;
    if (nonEmptyArr(p.prefDays) || nonEmptyArr(p.prefHours)) return true;
    if (nonEmptyStr(p.preferredDays) || nonEmptyStr(p.preferredTimes)) return true;
    if (nonEmptyStr(p.availabilityTime) || nonEmptyStr(p.desiredFrequency)) return true;
    if (nonEmptyStr(p.preferredMatchType)) return true;
    if (nonEmptyStr(p.notice) || nonEmptyStr(p.note) || nonEmptyStr(p.staffNotes)) return true;
    const ap = p.availabilityProfile;
    if (ap && typeof ap === 'object') {
      for (const k of ['days', 'time', 'notice', 'frequency', 'matchType']) {
        if (nonEmptyStr((ap as any)[k])) return true;
      }
    }
    if (nonEmptyArr(p.groups) || nonEmptyArr(p.tags) || nonEmptyArr(p.partners)) return true;
    if (p.preferences && typeof p.preferences === 'object' && Object.keys(p.preferences).length > 0) return true;
    return false;
  } catch {
    return true; // nel dubbio, NON cancellare
  }
}

function shouldNormalizeMemberLocalKey(record: any) {
  if (!record) return false;
  const payload = record.payload || {};
  const source = clean(payload.source || '');
  return !source || source === 'matchpoint_auto' || !!payload.matchpointImportedAt;
}

function buildStaleMatchpointMemberDeletes(records: any[], excludedLocalKeys: Set<string>, importedAt: string) {
  const deletes = [];
  for (const record of records || []) {
    const localKey = clean(record?.local_key || '');
    if (!localKey || excludedLocalKeys.has(localKey)) continue;
    const payload = record.payload || {};
    const source = clean(payload.source || '');
    const isMatchpointRecord = source === 'matchpoint_auto' || !!payload.matchpointImportedAt;
    if (!isMatchpointRecord) continue;
    deletes.push(buildDeletedMemberRecord(record, importedAt, 'matchpoint_snapshot_stale'));
  }
  return deletes;
}

function cloudRecordBatchKey(record: any) {
  const recordType = clean(record?.record_type || '');
  const localKey = clean(record?.local_key || '');
  return recordType && localKey ? `${recordType}|${localKey}` : '';
}

function dedupeCloudRecordBatch(records: any[]) {
  const byKey = new Map<string, any>();
  for (const record of records || []) {
    const key = cloudRecordBatchKey(record);
    if (!key) continue;
    const existing = byKey.get(key);
    if (existing && existing.deleted !== true && record.deleted === true) {
      continue;
    }
    byKey.set(key, {
      ...record,
      local_key: clean(record.local_key || ''),
      record_type: clean(record.record_type || ''),
    });
  }
  return [...byKey.values()];
}

async function saveDiagnosticExport(_admin: any, exported: MatchpointExport, importedAt: string) {
  return {
    saved: false,
    reason: 'POLICY_NO_CLIENT_FILE_ARCHIVE',
    filename: exported.filename,
    size: exported.bytes.byteLength,
    contentType: exported.contentType,
    importedAt,
  };
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

async function saveFailureDiagnostic(admin: any, actor: StaffActor | null, importedAt: string, errorInfo: JsonMap) {
  if (!String(errorInfo.code || '').startsWith('MATCHPOINT_')) return { saved: false, reason: 'SKIPPED' };
  const payload = {
    id: 'matchpoint_clients_auto_diagnostic_last',
    type: 'clienti',
    source: 'matchpoint_auto',
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
      local_key: 'matchpoint_clients_auto_diagnostic_last',
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
    id: 'matchpoint_clients_auto_diagnostic_last',
    type: 'clienti',
    source: 'matchpoint_auto',
    importedAt,
    actorEmail: actor?.email || '',
    code: validation.error || 'CLIENT_VALIDATION_FAILED',
    message: validation.message || 'Validazione file clienti non superata.',
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
      local_key: 'matchpoint_clients_auto_diagnostic_last',
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
  if (req.method !== 'POST') return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Usa POST per avviare import clienti Matchpoint.');

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

    const syncResult = await exportClientsWithCodice();
    const exported = syncResult.main;
    const validation = validateClientWorkbook(exported.bytes, importedAt);
    if (!validation.ok) {
      const diagnosticFile = await saveDiagnosticExport(admin, exported, importedAt);
      const diagnosticSaved = await saveValidationDiagnostic(admin, actor, importedAt, exported, validation, diagnosticFile);
      await logAudit(admin, actor, 'matchpoint_clients_auto_import_blocked', {
        error: validation.error,
        message: validation.message,
        source: 'matchpoint_auto',
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
      return errorResponse(422, validation.error, validation.message, {
        validation,
        diagnosticSaved,
      });
    }

    const memberIdEnrichment = {
      attempted: true,
      ok: false,
      skippedReason: null as string | null,
      codiceRowsParsed: 0,
      matched: 0,
      matchedByName: 0,
      unmatched: 0,
      unmatchedSample: [] as Array<{ firstName: string; surname: string }>,
    };
    try {
      if (!syncResult.codice.ok || !syncResult.codice.bytes) {
        memberIdEnrichment.skippedReason = syncResult.codice.skippedReason || 'CODICE_NOT_AVAILABLE';
      } else {
        const codiceResult = parseCodiceWorkbook(syncResult.codice.bytes);
        if (!codiceResult.ok) {
          memberIdEnrichment.skippedReason = `${codiceResult.error}: ${codiceResult.message}`;
        } else {
          memberIdEnrichment.ok = true;
          memberIdEnrichment.codiceRowsParsed = codiceResult.rowsParsed;
          const codiceMap = codiceResult.map;
          const codiceNameMap = codiceResult.nameMap;
          const unmatchedSample: Array<{ firstName: string; surname: string }> = [];
          let enrichMatched = 0;
          let enrichMatchedByName = 0;
          let enrichUnmatched = 0;
          for (const member of validation.members) {
            const pDigits = phoneDigits(member.phone);
            const eKey = emailKey(member.email);
            let found = (pDigits && codiceMap.get(`phone:${pDigits}`)) || (eKey && codiceMap.get(`email:${eKey}`)) || '';
            // Fallback per nome: SOLO se il socio non ha ne telefono ne email,
            // e SOLO se quel nome e' univoco nel report Codice (guardia anti-omonimia).
            if (!found && !pDigits && !eKey) {
              const nKey = normalizeKey(memberName(member));
              const byName = nKey ? (codiceNameMap.get(nKey) || '') : '';
              if (byName) {
                found = byName;
                enrichMatchedByName += 1;
              }
            }
            if (found) {
              member.memberId = found;
              enrichMatched += 1;
            } else {
              enrichUnmatched += 1;
              if (unmatchedSample.length < 50) {
                unmatchedSample.push({ firstName: member.firstName, surname: member.surname });
              }
            }
          }
          memberIdEnrichment.matched = enrichMatched;
          memberIdEnrichment.matchedByName = enrichMatchedByName;
          memberIdEnrichment.unmatched = enrichUnmatched;
          memberIdEnrichment.unmatchedSample = unmatchedSample;
        }
      }
    } catch (enrichError) {
      memberIdEnrichment.skippedReason = errorText(enrichError).slice(0, 500);
    }

    const existing = await loadExistingMemberRecords(admin);
    const records = [];
    // Direzione B: soci la cui anagrafica di contatto è cambiata in Matchpoint (o nuovi),
    // da propagare in realtime ai device connessi dopo l'upsert.
    const broadcastMembers: JsonMap[] = [];
    const memberRecordKeys = new Set<string>();
    const duplicateDeletesByKey = new Map<string, any>();
    let added = 0;
    let updated = 0;
    let duplicateRows = 0;
    let duplicateDeleted = 0;
    let staleDeleted = 0;
    let legacyDuplicateDeleted = 0;
    let legacyDuplicateReview = 0;
    const legacyDuplicateReviewSample: Array<{ firstName: string; surname: string }> = [];

    for (const member of validation.members) {
      const candidates = collectExistingMemberCandidates(existing, member);
      const match = chooseExistingMemberRecord(candidates, member);
      const canonicalKey = memberCloudKey(member);
      const localKey = clean((match && !shouldNormalizeMemberLocalKey(match) && match.local_key)
        ? match.local_key
        : (canonicalKey || match?.local_key || `member:${member.id}`));
      let payload: JsonMap;
      let memberChangedForBroadcast = false;
      if (match) {
        const applied = applyMatchpointContacts(match.payload || {}, member, importedAt);
        payload = applied.payload;
        memberChangedForBroadcast = applied.changed;
      } else {
        payload = member;
        memberChangedForBroadcast = true; // socio nuovo: va mostrato subito sui device
      }
      const memberRecordKey = `member|${localKey}`;
      if (memberRecordKeys.has(memberRecordKey)) {
        duplicateRows += 1;
        continue;
      }
      memberRecordKeys.add(memberRecordKey);
      if (match) updated += 1;
      else added += 1;
      if (memberChangedForBroadcast) broadcastMembers.push(payload);
      records.push({
        record_type: 'member',
        local_key: localKey,
        payload,
        payload_hash: null,
        deleted: false,
        synced_at: importedAt,
      });
      for (const candidate of candidates) {
        const candidateKey = clean(candidate?.local_key || '');
        if (!candidateKey || candidateKey === localKey) continue;
        // v6.090: i record della rubrica Google (numero WhatsApp curato) non vanno MAI tombstonati
        // come duplicato quando la chiave differisce dal sopravvissuto. La chiave differisce solo se
        // il numero è diverso: è il numero corretto di un socio il cui telefono in Matchpoint è
        // rotto/troncato. Cancellarlo perde il dato e innesca il churn con google-contacts-import
        // (ricrea → clients-sync ricancella → «new:N» ogni notte). Va a revisione manuale, non delete.
        if (clean(candidate?.payload?.importedFrom) === 'rubrica-google') {
          legacyDuplicateReview += 1;
          if (legacyDuplicateReviewSample.length < 50) {
            legacyDuplicateReviewSample.push({
              firstName: clean(candidate?.payload?.firstName || ''),
              surname: clean(candidate?.payload?.surname || ''),
            });
          }
          continue;
        }
        if (shouldDeleteDuplicateMemberRecord(candidate)) {
          duplicateDeletesByKey.set(candidateKey, buildDeletedMemberRecord(candidate, importedAt, 'matchpoint_snapshot_duplicate'));
          continue;
        }
        // Doppione "legacy" (non-Matchpoint) con gemello Matchpoint per lo stesso socio.
        // Guardia A: si elimina solo se il record che sopravvive e' davvero Matchpoint.
        const survivorIsMatchpoint = payload?.source === 'matchpoint_auto' || !!payload?.matchpointImportedAt;
        if (!survivorIsMatchpoint) continue;
        // Guardia B: se ha dati curati, NON cancellare: segnalare per controllo manuale.
        if (legacyMemberHasCuratedData(candidate?.payload || {})) {
          legacyDuplicateReview += 1;
          if (legacyDuplicateReviewSample.length < 50) {
            legacyDuplicateReviewSample.push({
              firstName: clean(candidate?.payload?.firstName || ''),
              surname: clean(candidate?.payload?.surname || ''),
            });
          }
          continue;
        }
        duplicateDeletesByKey.set(candidateKey, buildDeletedMemberRecord(candidate, importedAt, 'legacy_duplicate_superseded'));
      }
    }

    const currentMemberLocalKeys = new Set([...memberRecordKeys].map((key) => key.replace(/^member\|/, '')));
    for (const key of currentMemberLocalKeys) duplicateDeletesByKey.delete(key);
    const duplicateDeletes = [...duplicateDeletesByKey.values()];
    duplicateDeleted = duplicateDeletes.length;
    records.push(...duplicateDeletes);
    const staleDeleteExclusions = new Set([...currentMemberLocalKeys, ...duplicateDeletesByKey.keys()]);
    const staleDeletes = buildStaleMatchpointMemberDeletes(existing.records, staleDeleteExclusions, importedAt);
    staleDeleted = staleDeletes.length;
    records.push(...staleDeletes);

    const diagnosticFile = await saveDiagnosticExport(admin, exported, importedAt);
    const summaryPayload = {
      id: 'matchpoint_clients_auto_import_last',
      type: 'clienti',
      source: 'matchpoint_auto',
      importedAt,
      actorEmail: actor.email,
      rows: {
        sourceRows: validation.sourceRows,
        importableRows: validation.importableRows,
        skipped: validation.skipped,
        technicalSkipped: validation.technicalSkipped,
        duplicateRows,
        duplicateDeleted,
        staleDeleted,
        legacyDuplicateDeleted,
        legacyDuplicateReview,
        added,
        updated,
      },
      file: {
        filename: exported.filename,
        size: exported.bytes.byteLength,
        contentType: exported.contentType,
        diagnosticFile,
      },
      validation: {
        sheetName: validation.sheetName,
        requiredColumns: REQUIRED_CLIENT_COLUMNS,
        headers: validation.headers,
        warnings: validation.warnings,
      },
      diagnostic: exported.diagnostic,
      memberIdEnrichment,
      legacyDuplicateReviewSample,
    };
    records.push({
      record_type: 'matchpoint_data',
      local_key: 'matchpoint_clients_auto_import_last',
      payload: summaryPayload,
      payload_hash: null,
      deleted: false,
      synced_at: importedAt,
    });

    const finalRecords = dedupeCloudRecordBatch(records);
    duplicateDeleted = finalRecords.filter((record) => (
      record.record_type === 'member' &&
      record.deleted === true &&
      record.payload?.matchpointDeleteReason === 'matchpoint_snapshot_duplicate'
    )).length;
    staleDeleted = finalRecords.filter((record) => (
      record.record_type === 'member' &&
      record.deleted === true &&
      record.payload?.matchpointDeleteReason === 'matchpoint_snapshot_stale'
    )).length;
    summaryPayload.rows.duplicateDeleted = duplicateDeleted;
    summaryPayload.rows.staleDeleted = staleDeleted;
    legacyDuplicateDeleted = finalRecords.filter((record) => (
      record.record_type === 'member' &&
      record.deleted === true &&
      record.payload?.matchpointDeleteReason === 'legacy_duplicate_superseded'
    )).length;
    summaryPayload.rows.legacyDuplicateDeleted = legacyDuplicateDeleted;
    summaryPayload.rows.legacyDuplicateReview = legacyDuplicateReview;

    const { error: upsertError } = await admin
      .from('pmo_cloud_records')
      .upsert(finalRecords, { onConflict: 'record_type,local_key' });
    if (upsertError) throw upsertError;

    // Direzione B: propaga in realtime ai device connessi i soci cambiati/nuovi (no postgres_changes).
    const broadcastResult = await broadcastMemberChanges(supabaseUrl, anonKey, broadcastMembers)
      .catch((e) => ({ sent: 0, ok: false, error: errorText(e) }));

    await logAudit(admin, actor, 'matchpoint_clients_auto_import_success', {
      sourceRows: validation.sourceRows,
      importableRows: validation.importableRows,
      added,
      updated,
      skipped: validation.skipped,
      duplicateRows,
      duplicateDeleted,
      staleDeleted,
      legacyDuplicateDeleted,
      legacyDuplicateReview,
      legacyDuplicateReviewSample,
      diagnosticFile,
      upserted: finalRecords.length,
      memberIdEnrichment,
      broadcast: broadcastResult,
    });

    return okResponse({
      importedAt,
      mode: exported.mode || exported.diagnostic?.mode || 'http_postback',
      recordType: 'member',
      summary: summaryPayload,
      cloud: {
        upserted: finalRecords.length,
        members: validation.members.length,
        duplicateRows,
        duplicateDeleted,
        staleDeleted,
        added,
        updated,
        broadcast: broadcastResult,
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
      event: 'matchpoint_clients_auto_import_error',
      importedAt,
      actorEmail: actor?.email || '',
      code: errorInfo.code,
      message: errorInfo.publicMessage,
      diagnosticSaved,
      diagnostic: errorInfo.diagnostic || null,
    }));
    await logAudit(admin, actor, 'matchpoint_clients_auto_import_error', {
      message: errorInfo.publicMessage,
      code: errorInfo.code,
      diagnosticSaved,
      fallback: shouldFallbackToBrowserWorker(error) ? 'browser_worker_headless' : null,
    }).catch(() => {});
    if (message === 'AUTH_REQUIRED') return errorResponse(401, 'AUTH_REQUIRED', 'Accesso staff Supabase richiesto.');
    if (message === 'MATCHPOINT_SECRETS_MISSING') {
      return errorResponse(500, 'MATCHPOINT_SECRETS_MISSING', 'Mancano MATCHPOINT_USERNAME o MATCHPOINT_PASSWORD nei secret Supabase.');
    }
    if (errorInfo.code === 'MATCHPOINT_LOGIN_FAILED') {
      return errorResponse(500, errorInfo.code, 'Login Matchpoint non riuscito con i secret configurati su Supabase.', {
        diagnosticSaved,
        diagnostic: errorInfo.diagnostic || null,
      });
    }
    if (errorInfo.code === 'MATCHPOINT_CLIENTS_EXPORT_TARGET_NOT_FOUND') {
      return errorResponse(500, errorInfo.code, errorInfo.publicMessage, { diagnosticSaved, diagnostic: errorInfo.diagnostic || null });
    }
    if (errorInfo.code === 'MATCHPOINT_EXPORT_FAILED') {
      return errorResponse(500, errorInfo.code, errorInfo.publicMessage, { diagnosticSaved, diagnostic: errorInfo.diagnostic || null, fallback: 'browser_worker_headless' });
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
    return errorResponse(500, 'MATCHPOINT_CLIENTS_SYNC_FAILED', message);
  }
});
