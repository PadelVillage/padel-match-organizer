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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_MODES = new Set(['primary-email', 'recall-email', 'third-email', 'received-email', 'level-email']);
const ALLOWED_ACTIONS = new Set(['send', 'scan-bounces', 'scan-replies']);
const EMAIL_RECORD_TYPE = 'assessment_email';
const ASSESSMENT_SUPPORT_PHONE_DISPLAY = '+39 379 115 1472';
const ASSESSMENT_SUPPORT_WHATSAPP_BASE_URL = 'https://wa.me/393791151472';
const ASSESSMENT_SUPPORT_WHATSAPP_URL = ASSESSMENT_SUPPORT_WHATSAPP_BASE_URL;

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

function matchGmailInfoToSent(info: JsonMap, sentRecords: JsonMap[]) {
  const haystack = `${info.from || ''}\n${info.to || ''}\n${info.subject || ''}\n${info.snippet || ''}\n${info.text || ''}`.toLocaleLowerCase('it-IT');
  return sentRecords.find((record) => {
    if (record.gmailThreadId && record.gmailThreadId === info.threadId) return true;
    if (record.originalRecipient && haystack.includes(record.originalRecipient)) return true;
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
  }).filter((item): item is JsonMap => !!item);
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
    };
  }).filter((item): item is JsonMap => !!item);
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
    const actor = await authenticateStaff(req, supabaseUrl, anonKey);
    if (!hasPermission(actor, 'cloud_sync')) {
      return errorResponse(403, 'PERMISSION_DENIED', 'Il profilo staff non ha il permesso cloud_sync.');
    }

    const body = await req.json().catch(() => ({}));
    const action = clean(body.action || 'send');
    if (!ALLOWED_ACTIONS.has(action)) return errorResponse(400, 'INVALID_ACTION', 'Azione email autovalutazione non valida.');

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

    const mode = clean(body.mode || 'primary-email');
    if (!ALLOWED_MODES.has(mode)) return errorResponse(400, 'INVALID_MODE', 'Tipo email autovalutazione non valido.');

    const member = body.member && typeof body.member === 'object' ? body.member : {};
    const memberId = clean(body.memberId || member.id || member.memberId || '');
    const memberName = clean(body.memberName || member.name || `${clean(member.firstName)} ${clean(member.surname)}` || 'Socio');
    const originalRecipient = clean(body.originalRecipient || member.email || '');
    const token = clean(body.token || '');
    const link = clean(body.link || '');
    const subject = safeHeader(body.subject || '');
    const bodyText = clean(body.body || '');

    if (!memberId) return errorResponse(400, 'MEMBER_REQUIRED', 'Socio mancante.');
    if (!isValidEmail(originalRecipient)) return errorResponse(400, 'INVALID_ORIGINAL_RECIPIENT', 'Email socio mancante o non valida.');
    if (!subject) return errorResponse(400, 'SUBJECT_REQUIRED', 'Oggetto email mancante.');
    if (!bodyText) return errorResponse(400, 'BODY_REQUIRED', 'Testo email mancante.');
    if ((mode === 'primary-email' || mode === 'recall-email' || mode === 'third-email') && (!token || !link)) {
      return errorResponse(400, 'TOKEN_LINK_REQUIRED', 'Link personale non pronto.');
    }

    const forceTestRecipients = clean(Deno.env.get('ASSESSMENT_EMAIL_FORCE_TEST_RECIPIENTS')).toLocaleLowerCase('it-IT') !== 'false';
    const configuredTestTo = clean(Deno.env.get('ASSESSMENT_EMAIL_TEST_TO'));
    const actualRecipient = forceTestRecipients ? (configuredTestTo || actor.email) : originalRecipient;
    if (!isValidEmail(actualRecipient)) {
      return errorResponse(500, 'TEST_RECIPIENT_MISSING', 'Destinatario prova non configurato.');
    }

    const fromName = clean(Deno.env.get('ASSESSMENT_EMAIL_FROM_NAME')) || 'Padel Village';
    const fromEmail = clean(Deno.env.get('GMAIL_SENDER_EMAIL'));
    const replyTo = clean(Deno.env.get('ASSESSMENT_EMAIL_REPLY_TO')) || fromEmail;
    if (!isValidEmail(fromEmail)) {
      return errorResponse(500, 'GMAIL_SENDER_EMAIL_MISSING', 'Email mittente Gmail non configurata.');
    }
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
      level: clean(body.level || member.level || ''),
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
      appVersion: clean(body.appVersion || ''),
      runtimeEnv: clean(body.runtimeEnv || ''),
      source: clean(body.source || 'pmo_assessment_email'),
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

    return okResponse({
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
    });
  } catch (err) {
    const message = errorText(err);
    if (message.includes('AUTH_REQUIRED')) return errorResponse(401, 'AUTH_REQUIRED', 'Accesso staff richiesto.');
    if (message.includes('GMAIL_SECRETS_MISSING')) return errorResponse(500, 'GMAIL_SECRETS_MISSING', 'Segreti Gmail non configurati nella Edge Function.');
    if (message.includes('GMAIL_SENDER_EMAIL_MISSING')) return errorResponse(500, 'GMAIL_SENDER_EMAIL_MISSING', 'Email mittente Gmail non configurata.');
    if (message.includes('GMAIL_TOKEN_FAILED')) return errorResponse(502, 'GMAIL_TOKEN_FAILED', message);
    if (message.includes('GMAIL_SEND_FAILED')) return errorResponse(502, 'GMAIL_SEND_FAILED', message);
    if (message.includes('GMAIL_READ_FAILED')) return errorResponse(502, 'GMAIL_READ_FAILED', message);
    return errorResponse(500, 'ASSESSMENT_EMAIL_SEND_FAILED', message || 'Invio email autovalutazione non riuscito.');
  }
});
