import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

type JsonMap = Record<string, any>;

type StaffActor = {
  userId: string;
  email: string;
  role: string;
  permissions: JsonMap;
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pmo-routine-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_MODES = new Set(['primary-email', 'recall-email', 'third-email', 'received-email', 'level-email']);
const ALLOWED_ACTIONS = new Set(['send', 'scan-bounces', 'scan-replies', 'routine-plan', 'routine-approve', 'routine-send', 'routine-check']);
const EMAIL_RECORD_TYPE = 'assessment_email';
const ASSESSMENT_SUPPORT_PHONE_DISPLAY = '+39 379 115 1472';
const ASSESSMENT_SUPPORT_WHATSAPP_BASE_URL = 'https://wa.me/393791151472';
const ASSESSMENT_SUPPORT_WHATSAPP_URL = ASSESSMENT_SUPPORT_WHATSAPP_BASE_URL;
const ASSESSMENT_ROUTINE_DAILY_LIMIT = 10;
const ASSESSMENT_ROUTINE_DEFAULT_SPACING_MS = 10000;
const SUPABASE_PAGE_SIZE = 1000;

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

function errorText(value: unknown) {
  if (value instanceof Error) return value.message || value.name || String(value);
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value ?? '');
}

function isValidEmail(value: unknown) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value));
}

function hasPermission(actor: StaffActor, permission: string) {
  if (['owner', 'admin'].includes(actor.role)) return true;
  return actor.permissions?.[permission] === true;
}

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

function base64UrlDecode(value: unknown) {
  const text = clean(value).replace(/-/g, '+').replace(/_/g, '/');
  if (!text) return '';
  try {
    const padded = text + '='.repeat((4 - (text.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

function encodeMimeHeader(value: string) {
  return `=?UTF-8?B?${base64UrlEncode(value).replace(/-/g, '+').replace(/_/g, '/')}${'='.repeat((4 - (base64UrlEncode(value).length % 4)) % 4)}?=`;
}

function safeHeader(value: unknown) {
  return clean(value).replace(/[\r\n]+/g, ' ');
}

function escapeAddressName(value: unknown) {
  return safeHeader(value).replace(/"/g, '\\"');
}

function escapeHtml(value: unknown) {
  return clean(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function supportWhatsappMessage(mode: string, memberName: string, level: string) {
  const name = clean(memberName) || 'Socio';
  const levelText = clean(level) || 'indicato nella mail';
  if (mode === 'recall-email') {
    return `Ciao Padel Village,\nsono ${name}.\n\nHo ricevuto il promemoria per la scheda di autovalutazione, ma non l'ho ancora completata.\nMi serve aiuto per compilare la scheda oppure per recuperare il link.\n\nGrazie.`;
  }
  if (mode === 'third-email') {
    return `Ciao Padel Village,\nsono ${name}.\n\nHo ricevuto l'ultimo promemoria per la scheda di autovalutazione del livello di gioco.\nHo bisogno di aiuto per compilarla oppure preferisco spiegarvi perche' non riesco a farla.\n\nGrazie.`;
  }
  if (mode === 'received-email') {
    return `Ciao Padel Village,\nsono ${name}.\n\nHo compilato la scheda di autovalutazione e ho ricevuto la conferma.\nVorrei chiedere un chiarimento prima della validazione del livello di gioco.\n\nGrazie.`;
  }
  if (mode === 'level-email') {
    return `Ciao Padel Village,\nsono ${name}.\n\nHo ricevuto la conferma del livello di gioco aggiornato: ${levelText}.\nVorrei un chiarimento sul livello di gioco oppure chiedere una nuova verifica con lo staff.\n\nGrazie.`;
  }
  return `Ciao Padel Village,\nsono ${name}.\n\nHo ricevuto la mail per compilare la scheda di autovalutazione.\nPreferisco essere aiutato dallo staff/LoZio per definire il mio livello di gioco.\n\nMi potete contattare?\nGrazie.`;
}

function supportWhatsappUrlForMode(mode: string, memberName: string, level: string) {
  return `${ASSESSMENT_SUPPORT_WHATSAPP_BASE_URL}?text=${encodeURIComponent(supportWhatsappMessage(mode, memberName, level))}`;
}

function linkifyHtml(value: string, supportWhatsappUrl = ASSESSMENT_SUPPORT_WHATSAPP_URL) {
  return value
    .replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" style="color:#1f4f9a;word-break:break-all;">${url}</a>`)
    .replaceAll(
      ASSESSMENT_SUPPORT_PHONE_DISPLAY,
      `<a href="${supportWhatsappUrl}" style="color:#1f4f9a;font-weight:700;text-decoration:underline;">${ASSESSMENT_SUPPORT_PHONE_DISPLAY}</a>`,
    );
}

function paragraphHtml(value: string, supportWhatsappUrl = ASSESSMENT_SUPPORT_WHATSAPP_URL) {
  return linkifyHtml(escapeHtml(value), supportWhatsappUrl).replace(/\n+/g, '<br>');
}

function assessmentLinkButtonHtml(link: string) {
  const safeLink = escapeHtml(link);
  return `<p style="margin:22px 0;"><a href="${safeLink}" style="display:inline-block;background:#1f4f9a;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 18px;border-radius:8px;">Compila la scheda</a></p><p style="margin:8px 0 22px;color:#64748b;font-size:13px;line-height:1.45;">Se il pulsante non si apre, puoi usare questo link:<br><a href="${safeLink}" style="color:#1f4f9a;word-break:break-all;">${safeLink}</a></p>`;
}

function supportWhatsappHtml(supportWhatsappUrl = ASSESSMENT_SUPPORT_WHATSAPP_URL) {
  return `<p style="margin:8px 0 18px;"><a href="${supportWhatsappUrl}" style="display:inline-block;background:#25d366;color:#ffffff;text-decoration:none;font-weight:700;padding:11px 16px;border-radius:8px;">Scrivi alla segreteria su WhatsApp</a></p>`;
}

function buildHtmlBody(params: {
  body: string;
  link: string;
  testMode: boolean;
  memberName: string;
  originalRecipient: string;
  mode: string;
  level: string;
}) {
  const link = clean(params.link);
  const supportWhatsappUrl = supportWhatsappUrlForMode(params.mode, params.memberName, params.level);
  const blocks = clean(params.body)
    .split(/\n{2,}/)
    .map((block) => clean(block))
    .filter(Boolean);
  const bodyHtml = blocks.map((block) => {
    const lines = block
      .split(/\n+/)
      .map((line) => clean(line))
      .filter(Boolean);
    if (link) {
      const linkIndex = lines.findIndex((line) => line === link);
      if (linkIndex >= 0) {
        const before = lines.slice(0, linkIndex).join('\n');
        const after = lines.slice(linkIndex + 1).join('\n');
        return `${before ? `<p style="margin:0 0 18px;">${paragraphHtml(before, supportWhatsappUrl)}</p>` : ''}${assessmentLinkButtonHtml(link)}${after ? `<p style="margin:0 0 18px;">${paragraphHtml(after, supportWhatsappUrl)}</p>` : ''}`;
      }
    }
    const supportWhatsappIndex = lines.findIndex((line) => line === ASSESSMENT_SUPPORT_WHATSAPP_URL);
    if (supportWhatsappIndex >= 0) {
      const before = lines.slice(0, supportWhatsappIndex).join('\n');
      const after = lines.slice(supportWhatsappIndex + 1).join('\n');
      return `${before ? `<p style="margin:0 0 12px;">${paragraphHtml(before, supportWhatsappUrl)}</p>` : ''}${supportWhatsappHtml(supportWhatsappUrl)}${after ? `<p style="margin:0 0 18px;">${paragraphHtml(after, supportWhatsappUrl)}</p>` : ''}`;
    }
    return `<p style="margin:0 0 18px;">${paragraphHtml(block, supportWhatsappUrl)}</p>`;
  }).join('');
  const testBox = params.testMode ? `<div style="margin:0 0 24px;padding:14px 16px;border:1px solid #dbeafe;border-left:4px solid #1f4f9a;background:#f8fbff;border-radius:8px;color:#334155;font-size:14px;line-height:1.45;">
    <strong style="display:block;color:#1f4f9a;margin-bottom:4px;">TEST INTERNO PMO</strong>
    Questa email e' stata inviata in modalita prova.<br>
    Socio selezionato: ${escapeHtml(params.memberName)}<br>
    Email socio in anagrafica: ${escapeHtml(params.originalRecipient)}
  </div>` : '';
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f7fb;">
    <div style="max-width:620px;margin:0 auto;padding:24px 14px;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:26px 22px;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:16px;line-height:1.55;">
        ${testBox}
        ${bodyHtml}
      </div>
    </div>
  </body>
</html>`;
}

function buildMimeMessage(params: {
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
}) {
  const boundary = `pmo_assessment_${Date.now()}_${shortHash(params.subject)}`;
  const headers = [
    params.fromEmail ? `From: "${escapeAddressName(params.fromName || 'Padel Village')}" <${safeHeader(params.fromEmail)}>` : '',
    `To: ${safeHeader(params.to)}`,
    params.replyTo ? `Reply-To: ${safeHeader(params.replyTo)}` : '',
    `Subject: ${encodeMimeHeader(params.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean);
  return `${headers.join('\r\n')}\r\n\r\n`
    + `--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${params.textBody}\r\n\r\n`
    + `--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${params.htmlBody}\r\n\r\n`
    + `--${boundary}--`;
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
      event: 'pmo_assessment_routine_secret_verify_error',
      function: 'assessment-email-send',
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
      email: 'routine-autovalutazione@' + routineEnv + '.padel-match-organizer',
      role: 'system',
      permissions: { cloud_sync: true },
    };
  }
  return authenticateStaff(req, supabaseUrl, anonKey);
}

async function logAudit(admin: any, actor: StaffActor, action: string, detail: JsonMap) {
  await admin.from('pmo_audit_log').insert({
    actor_user_id: actor.userId,
    actor_email: actor.email,
    actor_role: actor.role,
    action,
    detail,
  });
}

async function getGmailAccessToken() {
  const clientId = clean(Deno.env.get('GMAIL_CLIENT_ID'));
  const clientSecret = clean(Deno.env.get('GMAIL_CLIENT_SECRET'));
  const refreshToken = clean(Deno.env.get('GMAIL_REFRESH_TOKEN'));
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('GMAIL_SECRETS_MISSING');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.access_token) {
    throw new Error(`GMAIL_TOKEN_FAILED: ${errorText(data?.error_description || data?.error || response.status)}`);
  }
  return clean(data.access_token);
}

async function sendGmailMessage(accessToken: string, rawMessage: string) {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: base64UrlEncode(rawMessage) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.id) {
    throw new Error(`GMAIL_SEND_FAILED: ${errorText(data?.error?.message || data?.error || response.status)}`);
  }
  return data;
}

async function listGmailMessages(accessToken: string, q: string, maxResults = 50) {
  const params = new URLSearchParams({
    q,
    maxResults: String(Math.max(1, Math.min(maxResults, 100))),
    includeSpamTrash: 'true',
  });
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`GMAIL_READ_FAILED: ${errorText(data?.error?.message || data?.error || response.status)}`);
  }
  return Array.isArray(data?.messages) ? data.messages : [];
}

async function getGmailMessage(accessToken: string, id: string) {
  const params = new URLSearchParams({ format: 'full' });
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?${params.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`GMAIL_READ_FAILED: ${errorText(data?.error?.message || data?.error || response.status)}`);
  }
  return data;
}

function gmailHeader(message: JsonMap, name: string) {
  const headers = message?.payload?.headers;
  if (!Array.isArray(headers)) return '';
  const row = headers.find((item: JsonMap) => clean(item?.name).toLocaleLowerCase('it-IT') === name.toLocaleLowerCase('it-IT'));
  return clean(row?.value);
}

function stripHtml(value: string) {
  return value.replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectGmailTextParts(payload: JsonMap, out: string[] = []) {
  if (!payload) return out;
  const mimeType = clean(payload.mimeType).toLocaleLowerCase('it-IT');
  const data = payload?.body?.data;
  if (data && (mimeType.includes('text/plain') || mimeType.includes('text/html') || !mimeType)) {
    const decoded = base64UrlDecode(data);
    out.push(mimeType.includes('text/html') ? stripHtml(decoded) : decoded);
  }
  const parts = Array.isArray(payload.parts) ? payload.parts : [];
  parts.forEach((part: JsonMap) => collectGmailTextParts(part, out));
  return out;
}

function normalizeEmailAddress(value: unknown) {
  const text = clean(value).toLocaleLowerCase('it-IT');
  const match = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return match ? match[0].toLocaleLowerCase('it-IT') : '';
}

function normalizeSentRecords(input: unknown) {
  const rows = Array.isArray(input) ? input : [];
  return rows.map((item: JsonMap) => ({
    memberId: clean(item?.memberId || item?.member_id || ''),
    memberName: clean(item?.memberName || item?.member_name || ''),
    token: clean(item?.token || ''),
    originalRecipient: normalizeEmailAddress(item?.originalRecipient || item?.email || item?.recipient || ''),
    actualRecipient: normalizeEmailAddress(item?.actualRecipient || item?.actual_recipient || ''),
    gmailMessageId: clean(item?.gmailMessageId || item?.gmail_message_id || ''),
    gmailThreadId: clean(item?.gmailThreadId || item?.gmail_thread_id || ''),
    sentAt: clean(item?.sentAt || item?.sent_at || ''),
  })).filter((item) => item.memberId && (item.originalRecipient || item.actualRecipient || item.gmailThreadId));
}

function gmailMessageInfo(message: JsonMap) {
  const text = [clean(message?.snippet), ...collectGmailTextParts(message?.payload || {})].join('\n');
  return {
    id: clean(message?.id),
    threadId: clean(message?.threadId),
    from: gmailHeader(message, 'From'),
    to: gmailHeader(message, 'To'),
    subject: gmailHeader(message, 'Subject'),
    date: gmailHeader(message, 'Date'),
    messageIdHeader: gmailHeader(message, 'Message-ID'),
    snippet: clean(message?.snippet),
    text,
  };
}

function compactReplyText(text: unknown, snippet: unknown) {
  const source = clean(text || snippet).replace(/\r/g, '').replace(/\u00a0/g, ' ');
  if (!source) return '';
  const kept: string[] = [];
  for (const rawLine of source.split('\n')) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (/^On .+wrote:$/i.test(trimmed) || /^Il .+ ha scritto:$/i.test(trimmed)) break;
    if (/^-{2,}\s*Original Message\s*-{2,}$/i.test(trimmed)) break;
    if (/^(Da|From|Inviato|Sent|A|To|Oggetto|Subject):\s+/i.test(trimmed) && kept.length > 0) break;
    if (/^>/.test(trimmed) && kept.length > 0) break;
    kept.push(line);
  }
  const normalized = clean(kept.join('\n'))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
  return clean(normalized || snippet || source).slice(0, 5000);
}

function matchGmailInfoToSent(info: JsonMap, sentRecords: JsonMap[]) {
  const haystack = `${info.from || ''}\n${info.to || ''}\n${info.subject || ''}\n${info.snippet || ''}\n${info.text || ''}`.toLocaleLowerCase('it-IT');
  return sentRecords.find((record) => {
    if (record.gmailThreadId && record.gmailThreadId === info.threadId) return true;
    if (record.originalRecipient && haystack.includes(record.originalRecipient)) return true;
    if (record.actualRecipient && haystack.includes(record.actualRecipient)) return true;
    const name = clean(record.memberName).toLocaleLowerCase('it-IT');
    return !!(name && name.length >= 6 && haystack.includes(name));
  }) || null;
}

async function fetchGmailInfos(accessToken: string, queries: string[], maxPerQuery = 50) {
  const refs = new Map<string, JsonMap>();
  for (const q of queries) {
    const rows = await listGmailMessages(accessToken, q, maxPerQuery);
    rows.forEach((row: JsonMap) => {
      const id = clean(row?.id);
      if (id && !refs.has(id)) refs.set(id, row);
    });
  }
  const infos: JsonMap[] = [];
  for (const id of refs.keys()) {
    const msg = await getGmailMessage(accessToken, id);
    infos.push(gmailMessageInfo(msg));
  }
  return infos;
}

function isBounceInfo(info: JsonMap) {
  const text = `${info.from || ''}\n${info.subject || ''}\n${info.snippet || ''}\n${info.text || ''}`.toLocaleLowerCase('it-IT');
  return /mailer-daemon|mail delivery subsystem|postmaster|delivery status notification|undeliver|undelivered|message not delivered|address not found|delivery incomplete|failure notice|mancata consegna|non recapitato|impossibile recapitare/.test(text);
}

async function scanGmailBounces(accessToken: string, sentRecords: JsonMap[]) {
  const queries = [
    'newer_than:30d from:mailer-daemon',
    'newer_than:30d from:postmaster',
    'newer_than:30d from:"Mail Delivery Subsystem"',
    'newer_than:30d "Delivery Status Notification"',
    'newer_than:30d "Message not delivered"',
    'newer_than:30d "Address not found"',
  ];
  const infos = await fetchGmailInfos(accessToken, queries, 30);
  const matches = infos.filter(isBounceInfo).map((info) => {
    const record = matchGmailInfoToSent(info, sentRecords);
    if (!record) return null;
    return {
      memberId: record.memberId,
      memberName: record.memberName,
      token: record.token,
      originalRecipient: record.originalRecipient,
      actualRecipient: record.actualRecipient,
      gmailThreadId: record.gmailThreadId,
      bounceGmailMessageId: info.id,
      bounceThreadId: info.threadId,
      bounceFrom: info.from,
      bounceSubject: info.subject,
      bounceDate: info.date,
      bounceSnippet: info.snippet,
      reason: clean(info.snippet || info.subject || 'Mancata consegna rilevata da Gmail'),
    };
  }).filter(Boolean) as JsonMap[];
  return { scanned: infos.length, matches };
}

async function scanGmailReplies(accessToken: string, sentRecords: JsonMap[]) {
  const infos = await fetchGmailInfos(accessToken, [
    'newer_than:30d in:inbox -from:mailer-daemon -from:postmaster',
  ], 80);
  const matches = infos.map((info) => {
    if (isBounceInfo(info)) return null;
    const record = matchGmailInfoToSent(info, sentRecords);
    if (!record) return null;
    if (record.gmailMessageId && record.gmailMessageId === info.id) return null;
    return {
      memberId: record.memberId,
      memberName: record.memberName,
      token: record.token,
      originalRecipient: record.originalRecipient,
      actualRecipient: record.actualRecipient,
      gmailThreadId: record.gmailThreadId,
      replyGmailMessageId: info.id,
      replyThreadId: info.threadId,
      replyFrom: info.from,
      replySubject: info.subject,
      replyDate: info.date,
      replySnippet: info.snippet,
      replyText: compactReplyText(info.text, info.snippet),
    };
  }).filter(Boolean) as JsonMap[];
  return { scanned: infos.length, matches };
}

async function saveEmailLog(admin: any, payload: JsonMap) {
  const sentAt = clean(payload.sentAt || new Date().toISOString());
  const memberId = clean(payload.memberId || 'unknown').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const tokenPart = clean(payload.token || payload.messageId || sentAt).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 80);
  const eventKey = `assessment_email|${memberId}|${payload.mode || 'email'}|${sentAt.replace(/[^0-9TZ]+/g, '')}`;
  const latestKey = `assessment_email_latest|${memberId}|${payload.mode || 'email'}|${tokenPart || 'no_token'}`;
  const rows = [eventKey, latestKey].map((localKey) => ({
    record_type: EMAIL_RECORD_TYPE,
    local_key: localKey,
    payload,
    payload_hash: shortHash(payload),
    deleted: false,
    synced_at: sentAt,
  }));
  const { error } = await admin
    .from('pmo_cloud_records')
    .upsert(rows, { onConflict: 'record_type,local_key' });
  if (error) throw error;
  return { eventKey, latestKey };
}

async function saveEmailScanLogs(admin: any, action: string, payloads: JsonMap[]) {
  if (!payloads.length) return { saved: 0 };
  const scannedAt = new Date().toISOString();
  const rows = payloads.map((payload) => {
    const memberId = clean(payload.memberId || 'unknown').replace(/[^a-zA-Z0-9_-]+/g, '_');
    const messageId = clean(payload.bounceGmailMessageId || payload.replyGmailMessageId || payload.gmailMessageId || scannedAt).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 80);
    return {
      record_type: EMAIL_RECORD_TYPE,
      local_key: `assessment_email_${action}|${memberId}|${messageId}`,
      payload: { id: `assessment_email_${action}_${messageId}`, type: `assessment_email_${action}`, scannedAt, ...payload },
      payload_hash: shortHash(payload),
      deleted: false,
      synced_at: scannedAt,
    };
  });
  const { error } = await admin
    .from('pmo_cloud_records')
    .upsert(rows, { onConflict: 'record_type,local_key' });
  if (error) throw error;
  return { saved: rows.length };
}

async function sendAssessmentEmailCore(admin: any, actor: StaffActor, params: JsonMap) {
  const mode = clean(params.mode || 'primary-email');
  if (!ALLOWED_MODES.has(mode)) throw new Error('INVALID_MODE');

  const member = params.member && typeof params.member === 'object' ? params.member : {};
  const memberId = clean(params.memberId || member.id || member.memberId || '');
  const memberName = clean(params.memberName || member.name || `${clean(member.firstName)} ${clean(member.surname)}` || 'Socio');
  const originalRecipient = clean(params.originalRecipient || member.email || '');
  const token = clean(params.token || '');
  const link = clean(params.link || '');
  const subject = safeHeader(params.subject || '');
  const bodyText = clean(params.body || '');

  if (!memberId) throw new Error('MEMBER_REQUIRED');
  if (!isValidEmail(originalRecipient)) throw new Error('INVALID_ORIGINAL_RECIPIENT');
  if (!subject) throw new Error('SUBJECT_REQUIRED');
  if (!bodyText) throw new Error('BODY_REQUIRED');
  if ((mode === 'primary-email' || mode === 'recall-email' || mode === 'third-email') && (!token || !link)) {
    throw new Error('TOKEN_LINK_REQUIRED');
  }

  const forceTestRecipients = clean(Deno.env.get('ASSESSMENT_EMAIL_FORCE_TEST_RECIPIENTS')).toLocaleLowerCase('it-IT') !== 'false';
  const configuredTestTo = clean(Deno.env.get('ASSESSMENT_EMAIL_TEST_TO'));
  const actualRecipient = forceTestRecipients ? (configuredTestTo || actor.email) : originalRecipient;
  if (!isValidEmail(actualRecipient)) throw new Error('TEST_RECIPIENT_MISSING');

  const fromName = clean(Deno.env.get('ASSESSMENT_EMAIL_FROM_NAME')) || 'Padel Village';
  const fromEmail = clean(Deno.env.get('GMAIL_SENDER_EMAIL'));
  const replyTo = clean(Deno.env.get('ASSESSMENT_EMAIL_REPLY_TO')) || fromEmail;
  if (!isValidEmail(fromEmail)) throw new Error('GMAIL_SENDER_EMAIL_MISSING');

  const sentAt = new Date().toISOString();
  const finalSubject = forceTestRecipients ? `[TEST] ${subject}` : subject;
  const finalTextBody = forceTestRecipients
    ? `[TEST INTERNO PMO]\nQuesta email e' stata inviata in modalita prova.\nSocio selezionato: ${memberName}\nEmail socio in anagrafica: ${originalRecipient}\n\n---\n\n${bodyText}`
    : bodyText;
  const finalHtmlBody = buildHtmlBody({
    body: bodyText,
    link,
    testMode: forceTestRecipients,
    memberName,
    originalRecipient,
    mode,
    level: clean(params.level || member.level || ''),
  });

  const accessToken = await getGmailAccessToken();
  const rawMessage = buildMimeMessage({
    to: actualRecipient,
    subject: finalSubject,
    textBody: finalTextBody,
    htmlBody: finalHtmlBody,
    fromName,
    fromEmail,
    replyTo,
  });
  const gmail = await sendGmailMessage(accessToken, rawMessage);
  const messageId = clean(gmail.id || '');
  const threadId = clean(gmail.threadId || '');

  const logPayload = {
    id: `assessment_email_${messageId || shortHash({ memberId, sentAt })}`,
    type: 'assessment_email_send',
    mode,
    memberId,
    memberName,
    token,
    link,
    originalRecipient,
    actualRecipient,
    testMode: forceTestRecipients,
    subject,
    sentAt,
    gmailMessageId: messageId,
    gmailThreadId: threadId,
    actorEmail: actor.email,
    appVersion: clean(params.appVersion || ''),
    runtimeEnv: clean(params.runtimeEnv || ''),
    source: clean(params.source || 'pmo_assessment_email'),
  };

  let logKeys: JsonMap | null = null;
  let logWarning = '';
  try {
    logKeys = await saveEmailLog(admin, logPayload);
    await logAudit(admin, actor, 'assessment_email_send', {
      mode,
      memberId,
      memberName,
      originalRecipient,
      actualRecipient,
      testMode: forceTestRecipients,
      gmailMessageId: messageId,
      gmailThreadId: threadId,
      appVersion: logPayload.appVersion,
      runtimeEnv: logPayload.runtimeEnv,
    });
  } catch (logErr) {
    logWarning = errorText(logErr);
    console.error('ASSESSMENT_EMAIL_LOG_FAILED', logWarning);
  }

  return {
    mode,
    memberId,
    memberName,
    originalRecipient,
    actualRecipient,
    testMode: forceTestRecipients,
    sentAt,
    gmailMessageId: messageId,
    gmailThreadId: threadId,
    logKeys,
    logWarning,
    logSaved: !logWarning,
  };
}

function parseLevel(value: unknown, fallback = 0) {
  const n = parseFloat(clean(value).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

function playerName(member: JsonMap) {
  return clean(member.name || `${clean(member.firstName)} ${clean(member.surname)}`) || 'Socio';
}

function firstName(member: JsonMap) {
  const first = clean(member.firstName);
  if (first) return first;
  return playerName(member).split(/\s+/)[0] || 'Socio';
}

function phoneLast4(value: unknown) {
  return clean(value).replace(/\D/g, '').slice(-4);
}

function isActiveMember(member: JsonMap) {
  return member.active !== false && clean(member.status).toLocaleLowerCase('it-IT') !== 'inactive';
}

function isLevelZeroPointFive(member: JsonMap) {
  return Math.abs(parseLevel(member.level, -1) - 0.5) < 0.001;
}

function localDateIso(value: Date, timeZone = 'Europe/Rome') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const out: JsonMap = {};
  parts.forEach((part) => { if (part.type !== 'literal') out[part.type] = part.value; });
  return `${out.year}-${out.month}-${out.day}`;
}

function targetMemberIdSet(body: JsonMap) {
  const rawList = Array.isArray(body.targetMemberIds) ? body.targetMemberIds : [];
  const ids = [
    clean(body.targetMemberId),
    ...rawList.map((item) => clean(item)),
  ].filter(Boolean);
  return new Set(ids.map((item) => item.toLocaleLowerCase('it-IT')));
}

function memberMatchesTarget(member: JsonMap, targets: Set<string>) {
  if (!targets.size) return true;
  return [
    member.id,
    member.memberId,
    member.__localKey,
    member.localKey,
  ].some((value) => targets.has(clean(value).toLocaleLowerCase('it-IT')));
}

function addQueryParams(url: string, params: JsonMap) {
  try {
    const parsed = new URL(url);
    Object.entries(params).forEach(([key, value]) => {
      if (clean(value)) parsed.searchParams.set(key, clean(value));
    });
    return parsed.toString();
  } catch {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (clean(value)) query.set(key, clean(value));
    });
    return `${url}${url.includes('?') ? '&' : '?'}${query.toString()}`;
  }
}

function assessmentPublicBaseUrl(supabaseUrl: string) {
  const configured = clean(Deno.env.get('ASSESSMENT_PUBLIC_BASE_URL'));
  if (configured) return configured;
  if (supabaseUrl.includes('cudiqnrrlbyqryrtaprd')) {
    return 'https://padelvillage.github.io/padel-match-organizer/test/autovalutazione.html?env=test';
  }
  return 'https://padelvillage.github.io/padel-match-organizer/autovalutazione.html';
}

function assessmentPublicLink(supabaseUrl: string, token: string, member: JsonMap) {
  return addQueryParams(assessmentPublicBaseUrl(supabaseUrl), {
    t: token,
    nome: playerName(member),
    email: clean(member.email || ''),
  });
}

function makeRoutineAssessmentToken(memberId: string) {
  const uuid = crypto.randomUUID().replace(/-/g, '').toUpperCase();
  const time = Date.now().toString(36).toUpperCase();
  return `${time}${uuid}`.replace(/[^A-Z0-9]/g, '').slice(-14);
}

async function loadAssessmentCommunicationTemplates(admin: any) {
  const { data, error } = await admin
    .from('pmo_cloud_records')
    .select('payload')
    .eq('record_type', 'app_setting')
    .eq('local_key', 'assessmentCommunicationTemplates')
    .eq('deleted', false)
    .maybeSingle();
  if (error) throw error;
  const value = data?.payload?.value;
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function renderRoutinePrimaryEmail(member: JsonMap, link: string, templates: JsonMap = {}) {
  const data: JsonMap = {
    nome: firstName(member),
    nome_completo: playerName(member),
    link_autovalutazione: link,
    telefono_segreteria: ASSESSMENT_SUPPORT_PHONE_DISPLAY,
    whatsapp_segreteria: ASSESSMENT_SUPPORT_WHATSAPP_URL,
  };
  const replaceTokens = (text: string) => Object.entries(data).reduce((out, [key, value]) => out.replaceAll(`{${key}}`, clean(value)), text);
  const subject = 'Padel Village - Completa la tua autovalutazione del livello di gioco';
  const body = `Ciao {nome},

stiamo aggiornando i livelli di gioco dei soci Padel Village per organizzare partite sempre piu equilibrate.

Ti chiediamo di compilare questa breve scheda di autovalutazione:
{link_autovalutazione}

Richiede meno di 1 minuto.

Se hai dubbi o preferisci non compilare la scheda da solo, nessun problema: ti aiutiamo noi.

Puoi scriverci su WhatsApp cliccando il bottone qui sotto. Lo staff Padel Village, con LoZio, ti aiutera a definire insieme il tuo livello di gioco.

Dopo l'invio controlleremo la scheda e aggiorneremo il tuo livello di gioco nel gestionale Padel Village.

Per informazioni o chiarimenti puoi contattare la segreteria Padel Village anche via WhatsApp:
{telefono_segreteria}
{whatsapp_segreteria}

Grazie,
Padel Village`;
  const template = templates['primary-email'] && typeof templates['primary-email'] === 'object' ? templates['primary-email'] : {};
  return {
    subject: replaceTokens(clean(template.subject || subject)),
    body: replaceTokens(clean(template.body || body)),
  };
}

function routineDelay(ms: number) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

async function loadCloudMembers(admin: any) {
  const rows: JsonMap[] = [];
  for (let from = 0, page = 0; page < 50; page += 1, from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await admin
      .from('pmo_cloud_records')
      .select('local_key,payload,deleted')
      .eq('record_type', 'member')
      .eq('deleted', false)
      .range(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) throw error;
    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);
    if (batch.length < SUPABASE_PAGE_SIZE) break;
  }
  return rows.map((row) => ({ ...(row.payload || {}), __localKey: row.local_key }))
    .filter((member) => clean(member.id || member.__localKey));
}

async function loadAssessmentTokens(admin: any) {
  const { data, error } = await admin
    .from('assessment_tokens')
    .select('token,member_local_id,member_name,status,created_at,sent_at,completed_at,registered_at');
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function loadAssessmentEmailRecords(admin: any) {
  const rows: JsonMap[] = [];
  for (let from = 0, page = 0; page < 20; page += 1, from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await admin
      .from('pmo_cloud_records')
      .select('payload,deleted,created_at')
      .eq('record_type', EMAIL_RECORD_TYPE)
      .eq('deleted', false)
      .range(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) throw error;
    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);
    if (batch.length < SUPABASE_PAGE_SIZE) break;
  }
  return rows.map((row) => row.payload || {});
}

async function loadCompletedAssessmentTokens(admin: any) {
  const { data, error } = await admin
    .from('self_assessments')
    .select('token');
  if (error) throw error;
  return new Set((Array.isArray(data) ? data : []).map((row) => clean(row.token)).filter(Boolean));
}

function routineMemberId(member: JsonMap) {
  return clean(member.id || member.__localKey || member.memberId || '');
}

function routineMemberAliases(member: JsonMap) {
  return [
    member.id,
    member.memberId,
    member.__localKey,
    member.localKey,
  ].map((value) => clean(value).toLocaleLowerCase('it-IT')).filter(Boolean);
}

function routineBatchLocalKey(localDate: string) {
  return `assessment_email_batch|primary-email|${clean(localDate)}`;
}

function isRoutineSystemActor(actor: StaffActor) {
  return actor.role === 'system' || clean(actor.email).startsWith('routine-autovalutazione@');
}

function assertStaffApprovalActor(actor: StaffActor) {
  if (isRoutineSystemActor(actor)) throw new Error('STAFF_APPROVAL_REQUIRED');
}

async function loadAssessmentRoutineBatch(admin: any, localDate: string) {
  const { data, error } = await admin
    .from('pmo_cloud_records')
    .select('local_key,payload,deleted,created_at,synced_at')
    .eq('record_type', EMAIL_RECORD_TYPE)
    .eq('local_key', routineBatchLocalKey(localDate))
    .eq('deleted', false)
    .maybeSingle();
  if (error) throw error;
  const payload = data?.payload && typeof data.payload === 'object' ? data.payload : null;
  return payload?.type === 'assessment_email_batch' ? payload : null;
}

async function saveAssessmentRoutineBatch(admin: any, localDate: string, payload: JsonMap) {
  const now = new Date().toISOString();
  const batchPayload = {
    ...payload,
    id: routineBatchLocalKey(localDate),
    type: 'assessment_email_batch',
    mode: 'primary-email',
    localDate,
    updatedAt: now,
  };
  const { error } = await admin
    .from('pmo_cloud_records')
    .upsert({
      record_type: EMAIL_RECORD_TYPE,
      local_key: routineBatchLocalKey(localDate),
      payload: batchPayload,
      payload_hash: shortHash(batchPayload),
      deleted: false,
      synced_at: now,
    }, { onConflict: 'record_type,local_key' });
  if (error) throw error;
  return batchPayload;
}

async function buildAssessmentRoutineContext(admin: any, body: JsonMap) {
  const localDate = clean(body.scheduledLocalDate || localDateIso(new Date()));
  const limit = Math.max(1, Math.min(ASSESSMENT_ROUTINE_DAILY_LIMIT, parseInt(clean(body.limit || ASSESSMENT_ROUTINE_DAILY_LIMIT), 10) || ASSESSMENT_ROUTINE_DAILY_LIMIT));
  const spacingMs = Math.max(0, Math.min(30000, parseInt(clean(Deno.env.get('ASSESSMENT_ROUTINE_SEND_SPACING_MS') || body.spacingMs || ASSESSMENT_ROUTINE_DEFAULT_SPACING_MS), 10) || 0));
  const targets = targetMemberIdSet(body);
  const isTargetedTest = targets.size > 0 && clean(body.runtimeEnv).toLocaleLowerCase('it-IT') === 'test';
  const ignoreDailyLimit = isTargetedTest && body.ignoreDailyLimit === true;
  const members = await loadCloudMembers(admin);
  const tokens = await loadAssessmentTokens(admin);
  const completedTokens = await loadCompletedAssessmentTokens(admin);
  const logs = await loadAssessmentEmailRecords(admin);
  const templates = await loadAssessmentCommunicationTemplates(admin);
  const todaySent = logs.filter((payload) => {
    return payload?.type === 'assessment_email_send'
      && payload.mode === 'primary-email'
      && clean(payload.sentAt).slice(0, 10) === localDate;
  });
  const remaining = ignoreDailyLimit ? limit : Math.max(0, limit - todaySent.length);
  const sentByMember = new Set(logs
    .filter((payload) => payload?.type === 'assessment_email_send' && ['primary-email', 'recall-email', 'third-email'].includes(clean(payload.mode)))
    .map((payload) => clean(payload.memberId))
    .filter(Boolean));
  const tokenByMember = new Map<string, JsonMap[]>();
  tokens.forEach((token) => {
    const key = clean(token.member_local_id);
    if (!key) return;
    if (!tokenByMember.has(key)) tokenByMember.set(key, []);
    tokenByMember.get(key)?.push(token);
  });
  tokenByMember.forEach((rows) => rows.sort((a,b) => clean(b.created_at).localeCompare(clean(a.created_at))));

  const candidates = members
    .filter((member) => memberMatchesTarget(member, targets))
    .filter((member) => isActiveMember(member))
    .filter((member) => isLevelZeroPointFive(member))
    .filter((member) => isValidEmail(member.email))
    .filter((member) => !sentByMember.has(clean(member.id || member.__localKey)))
    .filter((member) => {
      const memberTokens = tokenByMember.get(clean(member.id || member.__localKey)) || [];
      return !memberTokens.some((row) => completedTokens.has(clean(row.token)) || clean(row.status) === 'completed');
    })
    .sort((a,b) => playerName(a).localeCompare(playerName(b), 'it'));

  return {
    localDate,
    limit,
    spacingMs,
    targets,
    isTargetedTest,
    ignoreDailyLimit,
    members,
    tokens,
    completedTokens,
    logs,
    templates,
    todaySent,
    remaining,
    tokenByMember,
    candidates,
  };
}

function routineBatchMemberPayload(member: JsonMap, token = '') {
  return {
    memberId: routineMemberId(member),
    memberCode: clean(member.memberId || ''),
    memberName: playerName(member),
    email: clean(member.email || ''),
    phone: clean(member.phone || ''),
    level: clean(member.level || ''),
    token: clean(token || ''),
  };
}

async function runAssessmentRoutinePlan(admin: any, actor: StaffActor, body: JsonMap) {
  const startedAt = new Date().toISOString();
  const context = await buildAssessmentRoutineContext(admin, body);
  const existing = await loadAssessmentRoutineBatch(admin, context.localDate);
  if (existing && ['pending', 'approved', 'sending'].includes(clean(existing.status))) {
    return {
      action: 'routine-plan',
      localDate: context.localDate,
      status: existing.status,
      alreadyPrepared: true,
      batch: existing,
      selected: existing.selected || [],
    };
  }
  if (existing && ['sent', 'sent_with_errors'].includes(clean(existing.status))) {
    return {
      action: 'routine-plan',
      localDate: context.localDate,
      status: clean(existing.status),
      alreadySentBatch: true,
      batch: existing,
      selected: existing.selected || [],
    };
  }

  const selectedMembers = context.candidates.slice(0, context.remaining);
  const selected = selectedMembers.map((member) => {
    const memberId = routineMemberId(member);
    const existingToken = (context.tokenByMember.get(memberId) || []).find((row) => clean(row.status) !== 'completed');
    return routineBatchMemberPayload(member, existingToken?.token || '');
  });
  const batch = await saveAssessmentRoutineBatch(admin, context.localDate, {
    status: selected.length ? 'pending' : 'empty',
    createdAt: startedAt,
    createdBy: clean(actor.email || ''),
    approvedAt: '',
    approvedBy: '',
    sentAt: '',
    limit: context.limit,
    alreadySentToday: context.todaySent.length,
    remainingBeforePlan: context.remaining,
    candidates: context.candidates.length,
    selected,
    sent: [],
    failed: [],
    source: clean(body.source || 'pmo_assessment_email_scheduler'),
    appVersion: clean(body.appVersion || ''),
    runtimeEnv: clean(body.runtimeEnv || ''),
  });

  await logAudit(admin, actor, 'assessment_email_routine_plan', {
    source: clean(body.source || 'pmo_assessment_email_scheduler'),
    localDate: context.localDate,
    limit: context.limit,
    candidates: context.candidates.length,
    selected: selected.length,
    status: batch.status,
  });
  await logAssessmentRoutineRun(admin, 'assessment_email_daily_plan', selected.length ? 'success' : 'noop', startedAt, {
    localDate: context.localDate,
    limit: context.limit,
    alreadySentToday: context.todaySent.length,
    remainingBeforePlan: context.remaining,
    candidates: context.candidates.length,
    selected: selected.length,
    status: batch.status,
  }, selected);

  return {
    action: 'routine-plan',
    localDate: context.localDate,
    status: batch.status,
    batch,
    candidates: context.candidates.length,
    selected,
  };
}

async function upsertRoutineToken(admin: any, member: JsonMap, token: string, status = 'created', sentAt = '') {
  const now = new Date().toISOString();
  const row: JsonMap = {
    token,
    member_local_id: clean(member.id || member.__localKey),
    member_name: playerName(member),
    phone_last4: phoneLast4(member.phone),
    status,
    registered_at: now,
  };
  if (sentAt) row.sent_at = sentAt;
  const { error } = await admin
    .from('assessment_tokens')
    .upsert(row, { onConflict: 'token' });
  if (error) throw error;
}

async function logAssessmentRoutineRun(admin: any, routineType: string, runStatus: string, startedAt: string, summary: JsonMap, createdRecords: JsonMap[] = [], errorMessage = '') {
  await admin.from('pmo_routine_runs').insert({
    routine_type: routineType,
    run_status: runStatus,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    summary,
    created_records: createdRecords,
    error_message: errorMessage || null,
  });
}

function sentRecordsFromCloudLogs(logs: JsonMap[]) {
  return normalizeSentRecords(logs
    .filter((payload) => payload?.type === 'assessment_email_send')
    .map((payload) => ({
      memberId: payload.memberId,
      memberName: payload.memberName,
      token: payload.token,
      originalRecipient: payload.originalRecipient,
      actualRecipient: payload.actualRecipient,
      gmailMessageId: payload.gmailMessageId,
      gmailThreadId: payload.gmailThreadId,
      sentAt: payload.sentAt,
    })));
}

async function runAssessmentRoutineCheck(admin: any, actor: StaffActor, body: JsonMap) {
  const startedAt = new Date().toISOString();
  const logs = await loadAssessmentEmailRecords(admin);
  const sentRecords = sentRecordsFromCloudLogs(logs);
  if (!sentRecords.length) {
    await logAssessmentRoutineRun(admin, 'assessment_email_check', 'noop', startedAt, { scanned: 0, replies: 0, bounces: 0 });
    return { action: 'routine-check', scanned: 0, replies: [], bounces: [], saved: 0 };
  }
  const accessToken = await getGmailAccessToken();
  const replies = await scanGmailReplies(accessToken, sentRecords);
  const bounces = await scanGmailBounces(accessToken, sentRecords);
  const replyLog = await saveEmailScanLogs(admin, 'reply', replies.matches);
  const bounceLog = await saveEmailScanLogs(admin, 'bounce', bounces.matches);
  await logAudit(admin, actor, 'assessment_email_routine_check', {
    source: clean(body.source || 'pmo_assessment_email_scheduler'),
    scannedReplies: replies.scanned,
    scannedBounces: bounces.scanned,
    replies: replies.matches.length,
    bounces: bounces.matches.length,
  });
  await logAssessmentRoutineRun(admin, 'assessment_email_check', (replies.matches.length || bounces.matches.length) ? 'success' : 'noop', startedAt, {
    sentRecords: sentRecords.length,
    scannedReplies: replies.scanned,
    scannedBounces: bounces.scanned,
    replies: replies.matches.length,
    bounces: bounces.matches.length,
  }, [...replies.matches, ...bounces.matches]);
  return {
    action: 'routine-check',
    sentRecords: sentRecords.length,
    scanned: (replies.scanned || 0) + (bounces.scanned || 0),
    replies: replies.matches,
    bounces: bounces.matches,
    saved: (replyLog.saved || 0) + (bounceLog.saved || 0),
  };
}

async function runAssessmentRoutineSend(admin: any, actor: StaffActor, supabaseUrl: string, body: JsonMap) {
  const startedAt = new Date().toISOString();
  const context = await buildAssessmentRoutineContext(admin, body);
  let toSend = context.candidates.slice(0, context.remaining);
  let batch: JsonMap | null = null;

  if (!context.isTargetedTest) {
    batch = await loadAssessmentRoutineBatch(admin, context.localDate);
    if (batch && ['sent', 'sent_with_errors'].includes(clean(batch.status))) {
      return {
        action: 'routine-send',
        localDate: context.localDate,
        limit: context.limit,
        alreadySentToday: context.todaySent.length,
        candidates: context.candidates.length,
        selected: 0,
        sent: batch.sent || [],
        failed: batch.failed || [],
        alreadySentBatch: true,
        batch,
      };
    }
    if (!batch || !['approved', 'sending'].includes(clean(batch.status))) {
      await logAudit(admin, actor, 'assessment_email_routine_send_blocked', {
        source: clean(body.source || 'pmo_assessment_email_scheduler'),
        localDate: context.localDate,
        reason: batch ? `batch_${clean(batch.status || 'unknown')}` : 'approval_missing',
        candidates: context.candidates.length,
      });
      await logAssessmentRoutineRun(admin, 'assessment_email_daily_send', 'blocked', startedAt, {
        localDate: context.localDate,
        limit: context.limit,
        alreadySentToday: context.todaySent.length,
        remainingBeforeRun: context.remaining,
        candidates: context.candidates.length,
        selected: 0,
        sent: 0,
        failed: 0,
        approvalRequired: true,
        batchStatus: clean(batch?.status || ''),
      }, [], 'APPROVAL_REQUIRED');
      return {
        action: 'routine-send',
        localDate: context.localDate,
        limit: context.limit,
        alreadySentToday: context.todaySent.length,
        candidates: context.candidates.length,
        selected: 0,
        sent: [],
        failed: [],
        approvalRequired: true,
        batchStatus: clean(batch?.status || ''),
      };
    }
    const approvedIds = new Set((Array.isArray(batch.selected) ? batch.selected : [])
      .map((item) => clean(item?.memberId || item?.memberCode || item?.id).toLocaleLowerCase('it-IT'))
      .filter(Boolean));
    toSend = context.candidates
      .filter((member) => routineMemberAliases(member).some((id) => approvedIds.has(id)))
      .slice(0, context.remaining);
    batch = await saveAssessmentRoutineBatch(admin, context.localDate, {
      ...batch,
      status: 'sending',
      sendingAt: new Date().toISOString(),
    });
  }

  const sent: JsonMap[] = [];
  const failed: JsonMap[] = [];

  for (let i = 0; i < toSend.length; i += 1) {
    const member = toSend[i];
    const memberId = routineMemberId(member);
    const existing = (context.tokenByMember.get(memberId) || []).find((row) => clean(row.status) !== 'completed');
    const token = clean(existing?.token || makeRoutineAssessmentToken(memberId));
    try {
      await upsertRoutineToken(admin, member, token, 'created');
      const link = assessmentPublicLink(supabaseUrl, token, member);
      const rendered = renderRoutinePrimaryEmail(member, link, context.templates);
      const result = await sendAssessmentEmailCore(admin, actor, {
        mode: 'primary-email',
        memberId,
        member: {
          id: memberId,
          memberId: clean(member.memberId || ''),
          name: playerName(member),
          firstName: clean(member.firstName || ''),
          surname: clean(member.surname || ''),
          email: clean(member.email || ''),
          phone: clean(member.phone || ''),
          level: clean(member.level || ''),
        },
        level: clean(member.level || ''),
        originalRecipient: clean(member.email || ''),
        token,
        link,
        subject: rendered.subject,
        body: rendered.body,
        source: clean(body.source || 'pmo_assessment_email_scheduler'),
        appVersion: clean(body.appVersion || ''),
        runtimeEnv: clean(body.runtimeEnv || ''),
      });
      await upsertRoutineToken(admin, member, token, 'sent', result.sentAt);
      sent.push({ memberId, memberName: playerName(member), token, sentAt: result.sentAt, actualRecipient: result.actualRecipient });
      if (context.spacingMs && i < toSend.length - 1) await routineDelay(context.spacingMs);
    } catch (err) {
      failed.push({ memberId, memberName: playerName(member), error: errorText(err) });
    }
  }

  if (batch) {
    batch = await saveAssessmentRoutineBatch(admin, context.localDate, {
      ...batch,
      status: failed.length ? (sent.length ? 'sent_with_errors' : 'error') : 'sent',
      sentAt: new Date().toISOString(),
      sent,
      failed,
    });
  }

  await logAudit(admin, actor, 'assessment_email_routine_send', {
    source: clean(body.source || 'pmo_assessment_email_scheduler'),
    limit: context.limit,
    localDate: context.localDate,
    candidates: context.candidates.length,
    requested: toSend.length,
    sent: sent.length,
    failed: failed.length,
    targetedTest: context.isTargetedTest,
    targetMemberIds: [...context.targets],
    approvedBatch: !!batch,
  });
  await logAssessmentRoutineRun(admin, 'assessment_email_daily_send', failed.length ? (sent.length ? 'blocked' : 'error') : (sent.length ? 'success' : 'noop'), startedAt, {
    localDate: context.localDate,
    limit: context.limit,
    alreadySentToday: context.todaySent.length,
    ignoreDailyLimit: context.ignoreDailyLimit,
    remainingBeforeRun: context.remaining,
    candidates: context.candidates.length,
    selected: toSend.length,
    sent: sent.length,
    failed: failed.length,
    spacingMs: context.spacingMs,
    targetedTest: context.isTargetedTest,
    targetMemberIds: [...context.targets],
    approvedBatch: !!batch,
    batchStatus: clean(batch?.status || ''),
  }, sent, failed.length ? JSON.stringify(failed.slice(0, 10)) : '');

  return {
    action: 'routine-send',
    localDate: context.localDate,
    limit: context.limit,
    alreadySentToday: context.todaySent.length,
    ignoreDailyLimit: context.ignoreDailyLimit,
    targetedTest: context.isTargetedTest,
    targetMemberIds: [...context.targets],
    candidates: context.candidates.length,
    selected: toSend.length,
    sent,
    failed,
    batch,
  };
}

async function runAssessmentRoutineApprove(admin: any, actor: StaffActor, supabaseUrl: string, body: JsonMap) {
  assertStaffApprovalActor(actor);
  const localDate = clean(body.scheduledLocalDate || localDateIso(new Date()));
  const batch = await loadAssessmentRoutineBatch(admin, localDate);
  if (!batch) throw new Error('ROUTINE_BATCH_MISSING');
  if (['sent', 'sent_with_errors'].includes(clean(batch.status))) {
    return { action: 'routine-approve', localDate, alreadySentBatch: true, batch, sent: batch.sent || [], failed: batch.failed || [] };
  }
  if (!['pending', 'approved'].includes(clean(batch.status))) {
    throw new Error(`ROUTINE_BATCH_NOT_APPROVABLE:${clean(batch.status || 'unknown')}`);
  }
  const approved = await saveAssessmentRoutineBatch(admin, localDate, {
    ...batch,
    status: 'approved',
    approvedAt: new Date().toISOString(),
    approvedBy: clean(actor.email || ''),
  });
  await logAudit(admin, actor, 'assessment_email_routine_approve', {
    source: clean(body.source || 'pmo_assessment_email_manual_approval'),
    localDate,
    selected: Array.isArray(approved.selected) ? approved.selected.length : 0,
    appVersion: clean(body.appVersion || ''),
    runtimeEnv: clean(body.runtimeEnv || ''),
  });
  const result = await runAssessmentRoutineSend(admin, actor, supabaseUrl, {
    ...body,
    action: 'routine-send',
    scheduledLocalDate: localDate,
    source: clean(body.source || 'pmo_assessment_email_manual_approval'),
  });
  return { ...result, action: 'routine-approve', approvedAt: approved.approvedAt, approvedBy: approved.approvedBy };
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Usa POST per inviare email autovalutazione.');

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return errorResponse(500, 'SUPABASE_ENV_MISSING', 'Configurazione Supabase Edge Function incompleta.');
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  try {
    const actor = await authenticateStaffOrRoutine(req, supabaseUrl, anonKey, admin);
    if (!hasPermission(actor, 'cloud_sync')) {
      return errorResponse(403, 'PERMISSION_DENIED', 'Il profilo staff non ha il permesso cloud_sync.');
    }

    const body = await req.json().catch(() => ({}));
    const action = clean(body.action || 'send');
    if (!ALLOWED_ACTIONS.has(action)) return errorResponse(400, 'INVALID_ACTION', 'Azione email autovalutazione non valida.');

    if (action === 'routine-plan') {
      const result = await runAssessmentRoutinePlan(admin, actor, body);
      return okResponse(result);
    }

    if (action === 'routine-approve') {
      const result = await runAssessmentRoutineApprove(admin, actor, supabaseUrl, body);
      return okResponse(result);
    }

    if (action === 'routine-send') {
      const result = await runAssessmentRoutineSend(admin, actor, supabaseUrl, body);
      return okResponse(result);
    }

    if (action === 'routine-check') {
      const result = await runAssessmentRoutineCheck(admin, actor, body);
      return okResponse(result);
    }

    if (action === 'scan-bounces' || action === 'scan-replies') {
      const sentRecords = normalizeSentRecords(body.sentRecords || body.records || []);
      if (!sentRecords.length) {
        return okResponse({ action, scanned: 0, matches: [], saved: 0, message: 'Nessun invio email locale da confrontare.' });
      }
      const accessToken = await getGmailAccessToken();
      const result = action === 'scan-bounces'
        ? await scanGmailBounces(accessToken, sentRecords)
        : await scanGmailReplies(accessToken, sentRecords);
      const logAction = action === 'scan-bounces' ? 'bounce' : 'reply';
      let logWarning = '';
      let logResult: JsonMap = { saved: 0 };
      try {
        logResult = await saveEmailScanLogs(admin, logAction, result.matches);
        await logAudit(admin, actor, `assessment_email_${logAction}_scan`, {
          action,
          scanned: result.scanned,
          matches: result.matches.length,
          saved: logResult.saved,
          appVersion: clean(body.appVersion || ''),
          runtimeEnv: clean(body.runtimeEnv || ''),
        });
      } catch (logErr) {
        logWarning = errorText(logErr);
        console.error('ASSESSMENT_EMAIL_SCAN_LOG_FAILED', logWarning);
      }
      return okResponse({
        action,
        scanned: result.scanned,
        matches: result.matches,
        saved: logResult.saved || 0,
        logWarning,
        logSaved: !logWarning,
      });
    }

    const result = await sendAssessmentEmailCore(admin, actor, body);
    return okResponse(result);
  } catch (err) {
    const message = errorText(err);
    if (message.includes('AUTH_REQUIRED')) return errorResponse(401, 'AUTH_REQUIRED', 'Accesso staff richiesto.');
    if (message.includes('GMAIL_SECRETS_MISSING')) return errorResponse(500, 'GMAIL_SECRETS_MISSING', 'Segreti Gmail non configurati nella Edge Function.');
    if (message.includes('GMAIL_SENDER_EMAIL_MISSING')) return errorResponse(500, 'GMAIL_SENDER_EMAIL_MISSING', 'Email mittente Gmail non configurata.');
    if (message.includes('GMAIL_TOKEN_FAILED')) return errorResponse(502, 'GMAIL_TOKEN_FAILED', message);
    if (message.includes('GMAIL_SEND_FAILED')) return errorResponse(502, 'GMAIL_SEND_FAILED', message);
    if (message.includes('GMAIL_READ_FAILED')) return errorResponse(502, 'GMAIL_READ_FAILED', message);
    if (message.includes('STAFF_APPROVAL_REQUIRED')) return errorResponse(403, 'STAFF_APPROVAL_REQUIRED', 'Serve approvazione manuale da un operatore staff.');
    if (message.includes('ROUTINE_BATCH_MISSING')) return errorResponse(409, 'ROUTINE_BATCH_MISSING', 'Prima prepara il lotto di invio mattutino.');
    if (message.includes('ROUTINE_BATCH_NOT_APPROVABLE')) return errorResponse(409, 'ROUTINE_BATCH_NOT_APPROVABLE', 'Il lotto non e in uno stato approvabile.');
    return errorResponse(500, 'ASSESSMENT_EMAIL_SEND_FAILED', message || 'Invio email autovalutazione non riuscito.');
  }
});
