import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// google-contacts-import — Import contatti Google "padel" → anagrafica app.
//
// Elimina l'export CSV manuale: legge la rubrica di aprea.maurizio@gmail.com via
// People API, tiene solo i contatti la cui Organization Name/Title contiene "padel"
// (NON un'etichetta/contactGroup), deduplica per NUMERO contro pmo_cloud_records,
// deduce il sesso dal nome e crea i soci nuovi (app+cloud; scheda Matchpoint LAZY
// alla 1ª prenotazione). Tre percorsi in una sola function:
//   • preview (JWT staff)                 → fetch+filtro+dedup, NIENTE scrittura.
//   • apply   (JWT staff)                 → + scrive su pmo_cloud_records.
//   • apply   (header x-pmo-routine-secret) → cron notturno PROD: sesso "strict"
//                                             (NA quando incerto) + email riepilogo.
// apply è idempotente: il dedup gira sempre, i re-run non reinseriscono nulla.
//
// Riuso deliberato: helper puri PORTATI VERBATIM da index.html (nomi identici per
// auditabilità) e pattern auth/token/email da assessment-email-send. Il token
// Contatti è DISTINTO da quello Gmail (scope diverso): getContactsAccessToken()
// legge, getGmailAccessToken() invia il riepilogo.
// ─────────────────────────────────────────────────────────────────────────────

type JsonMap = Record<string, unknown>;

type StaffActor = {
  userId: string;
  email: string;
  role: string;
  permissions: JsonMap;
  isRoutine: boolean;
};

type Candidate = {
  firstName: string;
  surname: string;
  name: string;
  phone: string;
  phoneOk: boolean;
  phoneRaw: string;
  email: string;
  hasRealEmail: boolean;
  gender: 'M' | 'F' | 'NA';
};

type Row = { idx: number; cand: Candidate; status: 'new' | 'existing' | 'discard'; reason: string; isPadel: true };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pmo-routine-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_PAGE_SIZE = 1000;
const PEOPLE_ENDPOINT = 'https://people.googleapis.com/v1/people/me/connections';
const PEOPLE_PAGE_SIZE = 1000;
const PEOPLE_MAX_PAGES = 12;         // ~12k contatti di guardia (rubrica reale ~2.5k)
const UPSERT_CHUNK = 200;

// ── Helper base ──────────────────────────────────────────────────────────────
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}
function ok(body: JsonMap) { return json({ ok: true, ...body }); }
function err(status: number, code: string, message: string, extra: JsonMap = {}) { return json({ ok: false, error: code, message, ...extra }, status); }
function clean(value: unknown) { return String(value ?? '').trim(); }
function errorText(value: unknown) {
  if (value instanceof Error) return value.message || value.name || String(value);
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') { try { return JSON.stringify(value); } catch { return String(value); } }
  return String(value ?? '');
}
function isValidEmail(value: unknown) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value)); }

// Porti VERBATIM da index.html (cleanCell 9307, compactSpaces 9308, normalizeText 9309, normalizeKey 9318).
function cleanCell(value: unknown) { return String(value ?? '').replace(/\u00A0/g, ' ').trim(); }
function compactSpaces(value: unknown) { return cleanCell(value).replace(/\s+/g, ' '); }
function normalizeText(value: unknown) { return cleanCell(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(); }
function normalizeKey(value: unknown) { return normalizeText(value).replace(/[^a-z0-9]+/g, ''); }

// Porti da assessment-email-send (per l'email di riepilogo).
function shortHash(value: unknown) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
  return (hash >>> 0).toString(36);
}
function base64UrlEncode(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function safeHeader(value: unknown) { return clean(value).replace(/[\r\n]+/g, ' '); }
function escapeAddressName(value: unknown) { return safeHeader(value).replace(/"/g, '\\"'); }
function encodeMimeHeader(value: string) {
  const b64 = base64UrlEncode(value).replace(/-/g, '+').replace(/_/g, '/');
  return `=?UTF-8?B?${b64}${'='.repeat((4 - (b64.length % 4)) % 4)}?=`;
}
function escapeHtml(value: unknown) {
  return clean(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Nome (VERBATIM index.html 10561-10585, 10776) ────────────────────────────
function splitClienteName(fullName: string) {
  const c = compactSpaces(fullName);
  if (!c) return { firstName: '', surname: '' };
  if (c.includes(',')) {
    const parts = c.split(',').map((x) => x.trim());
    return { firstName: parts[1] || '', surname: parts[0] || '' };
  }
  const parts = c.split(' ');
  if (parts.length === 1) return { firstName: parts[0], surname: '' };
  return { firstName: parts[0], surname: parts.slice(1).join(' ') };
}
function titleCaseNamePart(value: string) {
  return compactSpaces(value || '').split(/\s+/).map((part) => {
    return part.split('-').map((piece) => {
      const lower = String(piece || '').toLocaleLowerCase('it-IT');
      return lower ? lower.charAt(0).toLocaleUpperCase('it-IT') + lower.slice(1) : '';
    }).join('-');
  }).join(' ');
}
// Via emoji/simboli/cifre/punteggiatura spuria, preservando lettere accentate, apostrofi, trattini.
function cleanNamePart(s: unknown) { return String(s ?? '').replace(/[^\p{L}\p{M}\s'\-]/gu, ' ').replace(/\s+/g, ' ').trim(); }

// ── Telefono (VERBATIM index.html 10602-10661, SENZA il caso di test "Mauro Fresch") ─
function getWhatsAppPhoneInfo(value: unknown) {
  const raw = cleanCell(value ?? '').trim();
  let digits = raw.replace(/\D/g, '');
  const notes: string[] = [];
  if (!digits) return { ok: false, raw, digits: '', e164: '', display: '', message: 'Telefono mancante.', notes };

  if (digits.startsWith('00')) { digits = digits.slice(2); notes.push('Rimosso prefisso internazionale 00.'); }

  if (digits.length === 10 && digits.startsWith('3')) {
    notes.push('Numero mobile italiano locale: aggiunto prefisso 39.');
    digits = '39' + digits;
  } else if (digits.startsWith('39') && digits.length === 12) {
    notes.push('Numero italiano già in formato internazionale.');
  } else if (digits.startsWith('0') && digits.length >= 7 && digits.length <= 11) {
    notes.push('Numero italiano locale non mobile: aggiunto prefisso 39.');
    digits = '39' + digits;
  } else if (raw.startsWith('+') && digits.length >= 8) {
    notes.push('Numero internazionale con prefisso già presente.');
  } else if (!digits.startsWith('39') && digits.length >= 8 && digits.length <= 11) {
    notes.push('Fallback: trattato come numero italiano locale.');
    digits = '39' + digits;
  }

  const e164 = digits ? (digits.startsWith('00') ? '+' + digits.slice(2) : '+' + digits) : '';
  const isItalianMobile = /^393\d{9}$/.test(digits);
  const isItalianLandlineOrBusiness = /^390\d{6,10}$/.test(digits);
  const okPhone = isItalianMobile || isItalianLandlineOrBusiness || (raw.startsWith('+') && digits.length >= 8 && digits.length <= 15);
  return {
    ok: okPhone,
    raw,
    digits,
    e164,
    display: e164,
    message: okPhone ? 'Numero WhatsApp normalizzato correttamente.' : `Numero WhatsApp non valido o incompleto: ${digits}.`,
    notes,
  };
}
function phoneDigitsForWhatsApp(value: unknown) { return getWhatsAppPhoneInfo(value).digits; }

// ── Email tecnica (VERBATIM index.html 10729-10733) ──────────────────────────
const PMO_SYNTHETIC_EMAIL_DOMAIN = 'nomail.padelvillage.club';
function pmoSyntheticEmailFor(phone: unknown) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  return digits ? `${digits}@${PMO_SYNTHETIC_EMAIL_DOMAIN}` : '';
}

// ── Sesso dal nome (VERBATIM index.html 8035-8036 + 10592-10600) con flag strict ─
// strict:true (cron, nessun umano) → il fallback -a→F/-o→M diventa NA ("da completare").
const maleNames = ['fabio','tobia','alberto','enrico','maurizio','santiago','riccardo','leonardo','stefano','michele','massimo','davide','alessandro','pietro','valentino','alan','omar','rudi','daniele','lucio','gabriele','gianluca','girolamo','sandro','samuele','mirko','remo','cristiano','federico','manuel','emanuele','diego','eddy','loris','valter','dario','maicol','enea','luciano','gianmario','nello','niccolo','patrizio','pierantonio','pierluigi','reiner','ubaldo','claudio','ferdinando','lamberto','vittorio','nicolas','gaetano','elio','william','kevin','danilo','salvatore','fabrizio','tommaso','luigi','giancarlo','tonino','flavio','giacomo','gianni','mario','mauro','renato','sergio','tiziano','marco','andrea','luca','giuseppe','antonio','giovanni','carlo','giorgio','roberto','paolo','matteo','francesco','lorenzo','filippo','simone','nicola','christian','adem','mattia'];
const femaleNames = ['paola','elisa','anastasia','pierangela','oriana','valentina','martina','giorgia','gloria','silvia','barbara','tiziana','jessica','maura','luisa','federica','priscilla','renza','arianna','simonetta','lisa','rosanna','giulia','michela','jasmine','alessandra','katia','serena','cinzia','silvana','miriam','roberta','vanessa','sabrina','valeria','stefania','milena','simona','matilde','alice','ilaria','erika','fabiana','veronica','sonia','daniela','rosita','diletta','viola','sheila','linda','lucia','antonella','sara','natasha','asia','diana','cristiana','sofia','elena','chiara','debora','eleonora','mara','eliana','maddalena','michelle','selene','emma','grazia','teresa','tania','carla','erica','isabella','jenny','aurora','irene','noemi','nadia','donatella','patrizia','manuela','maria','anna','francesca','rosa','angela','caterina','laura','marta'];
function detectGenderByName(firstName: string, opts: { strict?: boolean } = {}): 'M' | 'F' | 'NA' {
  const strict = opts.strict === true;
  const n = normalizeKey(firstName);
  if (maleNames.includes(n) && !femaleNames.includes(n)) return 'M';
  if (femaleNames.includes(n) && !maleNames.includes(n)) return 'F';
  if (['andrea','luca','mattia','nicola','tobia','elia','gianluca'].includes(n)) return 'M';
  if (['alice','irene','beatrice','matilde','adele'].includes(n)) return 'F';
  if (strict) return 'NA';           // cron: niente indovinello -a/-o → "da completare"
  if (n.endsWith('a')) return 'F';
  if (n.endsWith('o')) return 'M';
  return 'NA';
}

// ── Filtro anti-spazzatura (PROD entra senza revisione) ───────────────────────
// Scarta se nome/cognome ~ /padel/i (org name colato nel nome), onorifici-only,
// < 2 token alfabetici o token di 1 lettera.
const HONORIFIC_RE = /^(sig|sig\.?ra|signora|signore|dott|dott\.?ssa|dr|drssa|avv|ing|geom|arch|prof|rag|mr|mrs|ms)\.?$/i;
function looksLikeJunkName(cand: Candidate) {
  const first = clean(cand.firstName), sur = clean(cand.surname);
  if (/padel/i.test(first) || /padel/i.test(sur)) return true;
  const tokens = `${first} ${sur}`.split(/\s+/).filter(Boolean).filter((t) => !HONORIFIC_RE.test(t));
  const alpha = tokens.filter((t) => /[a-zà-ÿ]/i.test(t));
  if (alpha.length < 2) return true;
  if (alpha.some((t) => t.replace(/[^\p{L}]/gu, '').length <= 1)) return true;
  return false;
}

// ── Auth (pattern assessment-email-send 359-408) ─────────────────────────────
async function verifyRoutineSecret(admin: ReturnType<typeof createClient>, secret: string) {
  const value = clean(secret);
  if (!value) return false;
  const { data, error } = await admin.rpc('pmo_verify_data_routine_secret', { p_secret: value });
  if (error) return false;
  return data === true;
}
function hasPermission(actor: StaffActor, permission: string) {
  if (['owner', 'admin'].includes(actor.role)) return true;
  return actor.permissions?.[permission] === true;
}
async function authenticateStaff(req: Request, supabaseUrl: string, anonKey: string): Promise<StaffActor> {
  const token = clean(req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
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
    permissions: (profile.permissions && typeof profile.permissions === 'object') ? profile.permissions : {},
    isRoutine: false,
  };
}

// ── Token & fetch People API (clone di getGmailAccessToken 421-444, scope Contatti) ─
async function getContactsAccessToken() {
  const clientId = clean(Deno.env.get('GOOGLE_CONTACTS_CLIENT_ID')) || clean(Deno.env.get('GMAIL_CLIENT_ID'));
  const clientSecret = clean(Deno.env.get('GOOGLE_CONTACTS_CLIENT_SECRET')) || clean(Deno.env.get('GMAIL_CLIENT_SECRET'));
  const refreshToken = clean(Deno.env.get('GOOGLE_CONTACTS_REFRESH_TOKEN'));
  if (!clientId || !clientSecret || !refreshToken) throw new Error('CONTACTS_SECRETS_MISSING');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.access_token) {
    throw new Error(`CONTACTS_TOKEN_FAILED: ${errorText(data?.error_description || data?.error || response.status)}`);
  }
  return clean(data.access_token);
}
function isPadelOrg(orgs: unknown) {
  if (!Array.isArray(orgs)) return false;
  return orgs.some((o: JsonMap) => /padel/i.test(clean(o?.name)) || /padel/i.test(clean(o?.title)));
}
async function fetchPadelConnections(accessToken: string) {
  const padel: JsonMap[] = [];
  let scanned = 0;
  let pageToken = '';
  for (let page = 0; page < PEOPLE_MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      personFields: 'names,phoneNumbers,emailAddresses,organizations',
      pageSize: String(PEOPLE_PAGE_SIZE),
    });
    if (pageToken) params.set('pageToken', pageToken);
    const resp = await fetch(`${PEOPLE_ENDPOINT}?${params.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(`CONTACTS_FETCH_FAILED: ${errorText(data?.error?.message || data?.error || resp.status)}`);
    const conns = Array.isArray(data.connections) ? data.connections as JsonMap[] : [];
    scanned += conns.length;
    for (const p of conns) { if (isPadelOrg(p.organizations)) padel.push(p); }
    pageToken = clean(data.nextPageToken);
    if (!pageToken) break;
  }
  return { padel, scanned };
}

// ── Invio email di riepilogo (getGmailAccessToken/sendGmailMessage VERBATIM) ──
async function getGmailAccessToken() {
  const clientId = clean(Deno.env.get('GMAIL_CLIENT_ID'));
  const clientSecret = clean(Deno.env.get('GMAIL_CLIENT_SECRET'));
  const refreshToken = clean(Deno.env.get('GMAIL_REFRESH_TOKEN'));
  if (!clientId || !clientSecret || !refreshToken) throw new Error('GMAIL_SECRETS_MISSING');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.access_token) throw new Error(`GMAIL_TOKEN_FAILED: ${errorText(data?.error_description || data?.error || response.status)}`);
  return clean(data.access_token);
}
async function sendGmailMessage(accessToken: string, rawMessage: string) {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: base64UrlEncode(rawMessage) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.id) throw new Error(`GMAIL_SEND_FAILED: ${errorText(data?.error?.message || data?.error || response.status)}`);
  return data;
}
function buildSummaryMime(params: { to: string; fromEmail: string; fromName: string; subject: string; textBody: string; htmlBody: string }) {
  const boundary = `pmo_contacts_${shortHash(params.subject + params.textBody)}`;
  const headers = [
    params.fromEmail ? `From: "${escapeAddressName(params.fromName || 'Padel Village')}" <${safeHeader(params.fromEmail)}>` : '',
    `To: ${safeHeader(params.to)}`,
    `Subject: ${encodeMimeHeader(params.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean);
  return `${headers.join('\r\n')}\r\n\r\n`
    + `--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${params.textBody}\r\n\r\n`
    + `--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${params.htmlBody}\r\n\r\n`
    + `--${boundary}--`;
}
async function sendSummaryEmail(env: string, members: JsonMap[]) {
  const to = clean(Deno.env.get('CONTACTS_SUMMARY_EMAIL')) || clean(Deno.env.get('GMAIL_SENDER_EMAIL'));
  const fromEmail = clean(Deno.env.get('GMAIL_SENDER_EMAIL'));
  if (!isValidEmail(fromEmail) || !isValidEmail(to)) return { sent: false, reason: 'SUMMARY_EMAIL_NOT_CONFIGURED' };
  const n = members.length;
  const dateLabel = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' });
  const subject = n > 0 ? `Import contatti padel — ${n} nuovi soci` : 'Import contatti padel — nessun nuovo contatto';
  const lines = members.map((m) => `• ${clean(m.name)} (${clean(m.phone)})${clean(m.gender) === 'NA' ? ' — sesso da completare' : ''}`);
  const textBody = (n > 0
    ? `Import automatico rubrica Google (${env.toUpperCase()}) del ${dateLabel}.\n\nAggiunti ${n} nuovi soci:\n${lines.join('\n')}\n`
    : `Import automatico rubrica Google (${env.toUpperCase()}) del ${dateLabel}.\n\nNessun nuovo contatto padel da aggiungere oggi.\n`)
    + `\nI soci sono già in app e cloud; la scheda Matchpoint nasce alla prima prenotazione.\nSesso/nome correggibili in Gestione Soci.`;
  const htmlBody = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:14px;color:#0f172a;">`
    + `<p>Import automatico rubrica Google (<strong>${escapeHtml(env.toUpperCase())}</strong>) del ${escapeHtml(dateLabel)}.</p>`
    + (n > 0
      ? `<p>Aggiunti <strong>${n}</strong> nuovi soci:</p><ul>${members.map((m) => `<li>${escapeHtml(m.name)} (${escapeHtml(m.phone)})${clean(m.gender) === 'NA' ? ' — <em>sesso da completare</em>' : ''}</li>`).join('')}</ul>`
      : `<p>Nessun nuovo contatto padel da aggiungere oggi.</p>`)
    + `<p style="color:#64748b;">I soci sono già in app e cloud; la scheda Matchpoint nasce alla prima prenotazione. Sesso/nome correggibili in Gestione Soci.</p></div>`;
  try {
    const gmailToken = await getGmailAccessToken();
    const raw = buildSummaryMime({ to, fromEmail, fromName: 'Padel Village', subject, textBody, htmlBody });
    await sendGmailMessage(gmailToken, raw);
    return { sent: true, to };
  } catch (e) {
    return { sent: false, reason: errorText(e) };
  }
}

// ── Dedup: cifre telefono dei soci già in anagrafica (paginato, pattern clients-sync) ─
async function loadExistingPhoneDigits(admin: ReturnType<typeof createClient>) {
  const set = new Set<string>();
  for (let from = 0, page = 0; page < 50; page += 1, from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await admin
      .from('pmo_cloud_records')
      .select('payload')
      .eq('record_type', 'member')
      .eq('deleted', false)
      .order('local_key', { ascending: true })
      .range(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) throw new Error(`MEMBERS_READ_FAILED: ${errorText(error.message || error)}`);
    const rows = Array.isArray(data) ? data : [];
    for (const r of rows) {
      const p = (r.payload || {}) as JsonMap;
      const digits = phoneDigitsForWhatsApp(clean(p.phone) || clean(p.telefono));
      if (digits) set.add(digits);
    }
    if (rows.length < SUPABASE_PAGE_SIZE) break;
    if (page === 49) throw new Error('MEMBERS_PAGE_LIMIT_EXCEEDED');
  }
  return set;
}

// ── Parse di una connection People API → candidato (forma di parseGoogleContactRow) ─
function parseConnection(p: JsonMap, opts: { strict?: boolean } = {}): Candidate {
  const names = Array.isArray(p.names) ? p.names as JsonMap[] : [];
  const primary: JsonMap = names.find((n) => (n?.metadata as JsonMap | undefined)?.primary === true) || names[0] || {};
  let rawFirst = clean(primary.givenName);
  let rawLast = clean(primary.familyName);
  if (!rawFirst && !rawLast) {
    const split = splitClienteName(clean(primary.displayName));
    rawFirst = split.firstName; rawLast = split.surname;
  }
  const firstName = titleCaseNamePart(cleanNamePart(rawFirst));
  const surname = titleCaseNamePart(cleanNamePart(rawLast));

  const phones = Array.isArray(p.phoneNumbers) ? p.phoneNumbers as JsonMap[] : [];
  let chosen = getWhatsAppPhoneInfo('');
  let phoneRaw = '';
  for (const ph of phones) {
    const info = getWhatsAppPhoneInfo(clean(ph?.value));
    if (info.ok) { chosen = info; phoneRaw = clean(ph?.value); break; }        // preferisci il primo valido
    if (!chosen.digits && info.digits) { chosen = info; phoneRaw = clean(ph?.value); }  // altrimenti tieni il primo non vuoto
  }

  const emails = Array.isArray(p.emailAddresses) ? p.emailAddresses as JsonMap[] : [];
  let realEmail = '';
  for (const e of emails) { const v = clean(e?.value); if (isValidEmail(v)) { realEmail = v; break; } }
  const hasRealEmail = !!realEmail;

  return {
    firstName, surname,
    name: compactSpaces(`${firstName} ${surname}`),
    phone: chosen.e164, phoneOk: chosen.ok, phoneRaw,
    email: hasRealEmail ? realEmail : '', hasRealEmail,
    gender: detectGenderByName(firstName, { strict: opts.strict }),
  };
}

// ── Analisi (mirror server-side di rubricaImportAnalyze 10792-10835) ─────────
function analyzeConnections(connections: JsonMap[], existingPhones: Set<string>, strict: boolean) {
  const rows: Row[] = [];
  const seenPhone = new Map<string, string>();  // digits → nome del primo candidato con quel numero
  let cNew = 0, cExisting = 0, cDiscard = 0;
  connections.forEach((p, idx) => {
    const cand = parseConnection(p, { strict });
    const phoneDigits = phoneDigitsForWhatsApp(cand.phone || '');
    let status: Row['status'], reason = '';
    if (looksLikeJunkName(cand)) { status = 'discard'; reason = 'nome non valido'; }
    else if (!cand.firstName || !cand.surname) { status = 'discard'; reason = 'manca nome o cognome'; }
    else if (!cand.phoneOk || !phoneDigits) { status = 'discard'; reason = 'telefono mancante o non valido'; }
    else if (existingPhones.has(phoneDigits)) { status = 'existing'; reason = 'già in anagrafica'; }
    else if (seenPhone.has(phoneDigits)) { status = 'discard'; reason = `stesso numero di «${seenPhone.get(phoneDigits)}» già nel file`; }
    else { status = 'new'; seenPhone.set(phoneDigits, cand.name); }
    if (status === 'new') cNew++; else if (status === 'existing') cExisting++; else cDiscard++;
    rows.push({ idx, cand, status, reason, isPadel: true });
  });
  const summary = { total: connections.length, new: cNew, existing: cExisting, discard: cDiscard, anyLabelCol: true };
  return { rows, summary };
}

// ── Record cloud (forma di rubricaImportApply 10962-10971 + pmoBuildMemberCloudRecord) ─
function buildMemberRecord(cand: Candidate, gender: 'M' | 'F' | 'NA', now: string) {
  const digits = phoneDigitsForWhatsApp(cand.phone || '');
  if (!digits || digits.length < 8) return null;
  const localKey = `phone:${digits}`;
  const email = (cand.hasRealEmail && cand.email) ? cand.email : pmoSyntheticEmailFor(cand.phone);
  const g: 'M' | 'F' | 'NA' = (gender === 'M' || gender === 'F') ? gender : 'NA';
  const payload = {
    id: crypto.randomUUID(),
    memberId: '',
    firstName: cand.firstName, surname: cand.surname, name: cand.name,
    phone: cand.phone, email, level: 0.5, gender: g,
    guestJolly: false, active: true, importedFrom: 'rubrica-google',
    createdAt: now, updatedAt: now,
  };
  return { record: { record_type: 'member', local_key: localKey, payload, deleted: false }, payload };
}

// ── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return err(405, 'METHOD_NOT_ALLOWED', 'Usa POST.');

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !anonKey || !serviceKey) return err(500, 'CONFIG_MISSING', 'Configurazione Supabase incompleta.');
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const env = supabaseUrl.includes('qqbfphyslczzkxoncgex') ? 'prod' : 'test';

  const body = (await req.json().catch(() => ({}))) as JsonMap;
  const mode = clean(body.mode) || 'preview';
  if (mode !== 'preview' && mode !== 'apply') return err(400, 'BAD_MODE', 'mode deve essere "preview" o "apply".');

  // Auth: routine (cron, solo apply) OPPURE staff loggato con permesso cloud_sync.
  let actor: StaffActor;
  const routineOk = await verifyRoutineSecret(admin, req.headers.get('x-pmo-routine-secret') || '');
  if (routineOk) {
    if (mode !== 'apply') return err(400, 'ROUTINE_APPLY_ONLY', 'La routine può solo applicare (mode="apply").');
    actor = { userId: '00000000-0000-0000-0000-000000000000', email: `routine-google-contacts@${env}.padel-match-organizer`, role: 'system', permissions: { cloud_sync: true }, isRoutine: true };
  } else {
    try { actor = await authenticateStaff(req, supabaseUrl, anonKey); }
    catch { return err(401, 'UNAUTHORIZED', 'Serve la routine secret oppure una sessione staff.'); }
    if (!hasPermission(actor, 'cloud_sync')) return err(403, 'FORBIDDEN', 'Permesso cloud_sync richiesto.');
  }

  const strict = actor.isRoutine;  // cron: sesso NA quando incerto; staff: euristica -a/-o (l'umano corregge)

  // 1) Token contatti + fetch People API + filtro padel.
  let accessToken: string;
  try { accessToken = await getContactsAccessToken(); }
  catch (e) { return err(502, 'CONTACTS_TOKEN_FAILED', errorText(e)); }
  let fetched: { padel: JsonMap[]; scanned: number };
  try { fetched = await fetchPadelConnections(accessToken); }
  catch (e) { return err(502, 'CONTACTS_FETCH_FAILED', errorText(e)); }

  // 2) Dedup vs anagrafica + analisi.
  let existingPhones: Set<string>;
  try { existingPhones = await loadExistingPhoneDigits(admin); }
  catch (e) { return err(500, 'MEMBERS_READ_FAILED', errorText(e)); }
  const { rows, summary } = analyzeConnections(fetched.padel, existingPhones, strict);

  if (mode === 'preview') {
    return ok({ mode: 'preview', env, fileName: 'Google Contacts (live)', scanned: fetched.scanned, rows, summary });
  }

  // 3) apply → scrittura idempotente su pmo_cloud_records (chunk 200).
  //    Le correzioni di sesso fatte a mano in anteprima arrivano come overrides[{phoneDigits,gender}].
  const overrides = new Map<string, string>();
  for (const o of (Array.isArray(body.overrides) ? body.overrides as JsonMap[] : [])) {
    const d = clean(o.phoneDigits).replace(/\D/g, '');
    const g = clean(o.gender);
    if (d && (g === 'M' || g === 'F' || g === 'NA')) overrides.set(d, g);
  }
  const now = new Date().toISOString();
  const records: JsonMap[] = [];
  const members: JsonMap[] = [];
  for (const r of rows) {
    if (r.status !== 'new') continue;
    const digits = phoneDigitsForWhatsApp(r.cand.phone || '');
    const gender = (overrides.get(digits) as 'M' | 'F' | 'NA' | undefined) ?? r.cand.gender;
    const built = buildMemberRecord(r.cand, gender, now);
    if (built) { records.push(built.record); members.push(built.payload); }
  }

  let written = 0, failed = 0;
  for (let i = 0; i < records.length; i += UPSERT_CHUNK) {
    const slice = records.slice(i, i + UPSERT_CHUNK);
    const { error } = await admin.from('pmo_cloud_records').upsert(slice, { onConflict: 'record_type,local_key' });
    if (error) { failed += slice.length; console.log(JSON.stringify({ event: 'google_contacts_import_chunk_fail', env, message: errorText(error.message || error) })); }
    else written += slice.length;
  }

  // 4) Solo cron: email di riepilogo + log strutturato per get_logs.
  let emailResult: JsonMap | null = null;
  if (actor.isRoutine) {
    emailResult = await sendSummaryEmail(env, members);
    console.log(JSON.stringify({ event: 'google_contacts_import_cron', env, scanned: fetched.scanned, padel: fetched.padel.length, written, failed, email: emailResult }));
  }

  return ok({ mode: 'apply', env, summary, written, failed, members, ...(emailResult ? { email: emailResult } : {}) });
});
