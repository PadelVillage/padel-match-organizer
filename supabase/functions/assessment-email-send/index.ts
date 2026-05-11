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

const ALLOWED_MODES = new Set(['primary-email', 'recall-email', 'received-email', 'level-email']);
const EMAIL_RECORD_TYPE = 'assessment_email';

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

function encodeMimeHeader(value: string) {
  return `=?UTF-8?B?${base64UrlEncode(value).replace(/-/g, '+').replace(/_/g, '/')}${'='.repeat((4 - (base64UrlEncode(value).length % 4)) % 4)}?=`;
}

function safeHeader(value: unknown) {
  return clean(value).replace(/[\r\n]+/g, ' ');
}

function escapeAddressName(value: unknown) {
  return safeHeader(value).replace(/"/g, '\\"');
}

function buildMimeMessage(params: {
  to: string;
  subject: string;
  body: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
}) {
  const headers = [
    params.fromEmail ? `From: "${escapeAddressName(params.fromName || 'Padel Village')}" <${safeHeader(params.fromEmail)}>` : '',
    `To: ${safeHeader(params.to)}`,
    params.replyTo ? `Reply-To: ${safeHeader(params.replyTo)}` : '',
    `Subject: ${encodeMimeHeader(params.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
  ].filter(Boolean);
  return `${headers.join('\r\n')}\r\n\r\n${params.body}`;
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
    if (action !== 'send') return errorResponse(400, 'INVALID_ACTION', 'Azione email autovalutazione non valida.');

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
    if ((mode === 'primary-email' || mode === 'recall-email') && (!token || !link)) {
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
    const finalBody = forceTestRecipients
      ? `[TEST INTERNO PMO]\nQuesta email e' stata inviata in modalita prova.\nSocio selezionato: ${memberName}\nEmail socio in anagrafica: ${originalRecipient}\n\n---\n\n${bodyText}`
      : bodyText;

    const accessToken = await getGmailAccessToken();
    const rawMessage = buildMimeMessage({
      to: actualRecipient,
      subject: finalSubject,
      body: finalBody,
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

    const logKeys = await saveEmailLog(admin, logPayload);
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
    });
  } catch (err) {
    const message = errorText(err);
    if (message.includes('AUTH_REQUIRED')) return errorResponse(401, 'AUTH_REQUIRED', 'Accesso staff richiesto.');
    if (message.includes('GMAIL_SECRETS_MISSING')) return errorResponse(500, 'GMAIL_SECRETS_MISSING', 'Segreti Gmail non configurati nella Edge Function.');
    if (message.includes('GMAIL_SENDER_EMAIL_MISSING')) return errorResponse(500, 'GMAIL_SENDER_EMAIL_MISSING', 'Email mittente Gmail non configurata.');
    if (message.includes('GMAIL_TOKEN_FAILED')) return errorResponse(502, 'GMAIL_TOKEN_FAILED', message);
    if (message.includes('GMAIL_SEND_FAILED')) return errorResponse(502, 'GMAIL_SEND_FAILED', message);
    return errorResponse(500, 'ASSESSMENT_EMAIL_SEND_FAILED', message || 'Invio email autovalutazione non riuscito.');
  }
});
