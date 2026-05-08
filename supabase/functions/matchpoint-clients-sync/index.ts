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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const REQUIRED_CLIENT_COLUMNS = ['Cliente', 'Telefono cellulare', 'E-mail', 'Eta', 'Sesso', 'Livello'];
const CLIENT_FULL_NAME_COLUMNS = ['Cliente', 'Nominativo', 'Nome e cognome', 'Nome completo', 'Full Name'];
const CLIENT_FIRST_NAME_COLUMNS = ['Nome', 'First Name'];
const CLIENT_SURNAME_COLUMNS = ['Cognome', 'Last Name', 'Surname'];
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
  return json({ ok: false, error: code, message, ...extra }, status);
}

function clean(value: unknown) {
  return String(value ?? '').trim();
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
    memberId: existing.memberId || imported.memberId || '',
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

async function exportClientsViaHttp(): Promise<MatchpointExport> {
  const baseUrl = (Deno.env.get('MATCHPOINT_BASE_URL') || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const clientsPath = Deno.env.get('MATCHPOINT_CLIENTS_PATH') || DEFAULT_CLIENTS_PATH;
  const exportTarget = Deno.env.get('MATCHPOINT_EXPORT_TARGET') || DEFAULT_EXPORT_TARGET;
  const session = new MatchpointSession(baseUrl);

  const login = await loginToMatchpoint(session);
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

function bytesFromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function workerExportUrl(rawUrl: string) {
  const url = rawUrl.replace(/\/+$/, '');
  return /\/export-clients$/i.test(url) ? url : `${url}/export-clients`;
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

async function exportClientsViaBrowserWorker(originalError: unknown): Promise<MatchpointExport> {
  const fallbackFrom = parseErrorInfo(originalError);
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
  const clientsPath = Deno.env.get('MATCHPOINT_CLIENTS_PATH') || DEFAULT_CLIENTS_PATH;
  const exportTarget = Deno.env.get('MATCHPOINT_EXPORT_TARGET') || DEFAULT_EXPORT_TARGET;
  const endpoint = workerExportUrl(workerUrl);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${workerApiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      username,
      password,
      baseUrl,
      clientsPath,
      exportTarget,
      fallbackFrom: fallbackFrom.code,
      credentialSource: 'supabase_secret',
    }),
  });

  const text = await response.text();
  let payload: JsonMap = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text.slice(0, 800) }; }
  if (!response.ok || payload.ok !== true || !payload.base64) {
    throw errorWithDiagnostic('MATCHPOINT_BROWSER_WORKER_FAILED', {
      status: response.status,
      endpoint,
      fallbackFrom: fallbackFrom.code,
      workerError: payload.error || '',
      workerMessage: payload.message || '',
      workerDiagnostic: payload.diagnostic || null,
    });
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

async function exportClientsFromMatchpoint(): Promise<MatchpointExport> {
  try {
    return await exportClientsViaHttp();
  } catch (error) {
    if (!shouldFallbackToBrowserWorker(error)) throw error;
    return await exportClientsViaBrowserWorker(error);
  }
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

function hasPermission(actor: StaffActor, permission: string) {
  if (['owner', 'admin'].includes(actor.role)) return true;
  return actor.permissions?.[permission] === true;
}

async function loadExistingMemberRecords(admin: any) {
  const { data, error } = await admin
    .from('pmo_cloud_records')
    .select('record_type,local_key,payload,deleted')
    .eq('record_type', 'member')
    .eq('deleted', false);
  if (error) throw error;
  const records = Array.isArray(data) ? data : [];
  const byKey = new Map<string, any>();
  for (const record of records) {
    const payload = record.payload || {};
    for (const key of memberLookupKeys(payload)) {
      if (!byKey.has(key)) byKey.set(key, record);
    }
  }
  return { records, byKey };
}

async function saveDiagnosticExport(admin: any, exported: MatchpointExport, importedAt: string) {
  const bucket = clean(Deno.env.get('MATCHPOINT_EXPORT_BUCKET') || '');
  if (!bucket) return { saved: false, reason: 'MATCHPOINT_EXPORT_BUCKET_NOT_SET' };
  const path = `matchpoint/clienti/${importedAt.slice(0, 10)}/${exported.filename}`;
  const { error } = await admin.storage.from(bucket).upload(path, exported.bytes, {
    contentType: exported.contentType,
    upsert: true,
  });
  if (error) return { saved: false, bucket, path, error: error.message || String(error) };
  return { saved: true, bucket, path };
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
  const message = error instanceof Error ? error.message : String(error);
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
    actor = await authenticateStaff(req, supabaseUrl, anonKey);
    if (!hasPermission(actor, 'cloud_sync')) {
      return errorResponse(403, 'PERMISSION_DENIED', 'Il profilo staff non ha il permesso cloud_sync.');
    }

    const exported = await exportClientsFromMatchpoint();
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

    const existing = await loadExistingMemberRecords(admin);
    const records = [];
    let added = 0;
    let updated = 0;

    for (const member of validation.members) {
      const match = memberLookupKeys(member).map((key) => existing.byKey.get(key)).find(Boolean);
      const localKey = match?.local_key || memberCloudKey(member) || `member:${member.id}`;
      const payload = match ? mergeProtectedMember(match.payload || {}, member, importedAt) : member;
      if (match) updated += 1;
      else added += 1;
      records.push({
        record_type: 'member',
        local_key: localKey,
        payload,
        payload_hash: null,
        deleted: false,
        synced_at: importedAt,
      });
    }

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
    };
    records.push({
      record_type: 'matchpoint_data',
      local_key: 'matchpoint_clients_auto_import_last',
      payload: summaryPayload,
      payload_hash: null,
      deleted: false,
      synced_at: importedAt,
    });

    const { error: upsertError } = await admin
      .from('pmo_cloud_records')
      .upsert(records, { onConflict: 'record_type,local_key' });
    if (upsertError) throw upsertError;

    await logAudit(admin, actor, 'matchpoint_clients_auto_import_success', {
      sourceRows: validation.sourceRows,
      importableRows: validation.importableRows,
      added,
      updated,
      skipped: validation.skipped,
      diagnosticFile,
    });

    return okResponse({
      importedAt,
      mode: exported.mode || exported.diagnostic?.mode || 'http_postback',
      recordType: 'member',
      summary: summaryPayload,
      cloud: {
        upserted: records.length,
        members: validation.members.length,
        added,
        updated,
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
