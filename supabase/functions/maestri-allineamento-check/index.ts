import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';
import { confronta, impronta, type Esito } from './confronto.ts';

// ─────────────────────────────────────────────────────────────────────────────
// maestri-allineamento-check — controllo notturno dei MAESTRI.
//
// Il problema che risolve (caso Lucas Vidal, #603): la lista dei maestri del
// gestionale è scritta a mano in parser_rules.json, e creare un maestro su
// Matchpoint NON la aggiorna. Finché nessuno se ne accorge, il maestro nuovo non
// è selezionabile — e nel verso opposto è peggio: se un maestro viene rinominato
// o tolto su Matchpoint, la voce resta nel nostro menu ma al salvataggio il
// worker non trova più nulla e la lezione perde il maestro IN SILENZIO.
//
// Dal dato che già abbiamo non si può dedurre niente: sulle lezioni
// sincronizzate `istruttore` è sempre null. Va letto Matchpoint → worker
// /read-instructors (sola lettura).
//
// ⭐ Confronta la lista che l'app SCARICA DAVVERO (parser_rules.json dal ramo
// giusto su GitHub), non una copia locale: così controlla la verità operativa.
//
// Invocata da pg_cron (pmo_dispatch_maestri_allineamento → net.http_post con
// header x-pmo-routine-secret). Silenziosa quando è tutto a posto.
// ─────────────────────────────────────────────────────────────────────────────

type JsonMap = Record<string, unknown>;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pmo-routine-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PROD_PROJECT_REF = 'qqbfphyslczzkxoncgex';
const RULES_URL_BASE = 'https://raw.githubusercontent.com/PadelVillage/padel-match-organizer';
const DEFAULT_ALERT_TO = 'padelvillage.club@gmail.com';
const WORKER_TIMEOUT_MS = 120000;
const AUDIT_ACTION = 'maestri_allineamento_check';

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

function base64UrlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function encodeMimeHeader(value: string): string {
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(value)));
  return `=?UTF-8?B?${b64}?=`;
}

// ── La lista che l'app scarica davvero ───────────────────────────────────────
// Il ramo dipende dall'ambiente, esattamente come in index.html: PROD legge
// `main`, TEST legge `test-preview`. Sbagliare ramo qui farebbe confrontare
// Matchpoint con la lista dell'ALTRO ambiente.
async function leggiNostriMaestri(supabaseUrl: string): Promise<{ maestri: string[]; ramo: string; versione: string }> {
  const ramo = supabaseUrl.includes(PROD_PROJECT_REF) ? 'main' : 'test-preview';
  const url = `${RULES_URL_BASE}/${ramo}/supabase/functions/parser-rules/parser_rules.json?_=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`PARSER_RULES_FETCH_FAILED: HTTP ${res.status}`);
  const rules = await res.json();
  const maestri = rules?.campi_opzionali?.istruttore?.valori_validi;
  if (!Array.isArray(maestri) || !maestri.length) {
    // Nessun maestro nelle regole = regole corrotte, non «zero maestri»: fermarsi
    // qui evita un'email che dichiara rotto tutto quanto.
    throw new Error('PARSER_RULES_SENZA_MAESTRI');
  }
  return { maestri: maestri.map((m: unknown) => clean(m)).filter(Boolean), ramo, versione: clean(rules?.versione) };
}

// ── I maestri veri, dal dropdown Monitor di Matchpoint ───────────────────────
async function leggiMaestriMatchpoint(): Promise<string[]> {
  const workerUrl = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_URL'));
  const workerApiKey = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_API_KEY'));
  const username = clean(Deno.env.get('MATCHPOINT_USERNAME'));
  const password = clean(Deno.env.get('MATCHPOINT_PASSWORD'));
  if (!workerUrl || !workerApiKey) throw new Error('MATCHPOINT_BROWSER_WORKER_SECRETS_MISSING');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WORKER_TIMEOUT_MS);
  try {
    const res = await fetch(`${workerUrl.replace(/\/+$/, '')}/read-instructors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${workerApiKey}` },
      body: JSON.stringify({ username, password }),
      signal: controller.signal,
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || payload?.ok !== true) {
      throw new Error(`WORKER_READ_INSTRUCTORS_FAILED: ${clean(payload?.message) || clean(payload?.error) || `HTTP ${res.status}`}`);
    }
    const istruttori = payload?.istruttori;
    if (!Array.isArray(istruttori)) throw new Error('WORKER_RISPOSTA_SENZA_ISTRUTTORI');
    return istruttori.map((m: unknown) => clean(m)).filter(Boolean);
  } finally {
    clearTimeout(timer);
  }
}

// ── Email (stesso canale Gmail dell'autovalutazione) ─────────────────────────
async function getGmailAccessToken(): Promise<string> {
  const clientId = clean(Deno.env.get('GMAIL_CLIENT_ID'));
  const clientSecret = clean(Deno.env.get('GMAIL_CLIENT_SECRET'));
  const refreshToken = clean(Deno.env.get('GMAIL_REFRESH_TOKEN'));
  if (!clientId || !clientSecret || !refreshToken) throw new Error('GMAIL_SECRETS_MISSING');

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
  if (!response.ok || !data?.access_token) throw new Error('GMAIL_TOKEN_FAILED');
  return clean(data.access_token);
}

function corpoEmail(esito: Esito, ambiente: string, ramo: string): { subject: string; text: string; html: string } {
  const nuovi = esito.daAggiungere;
  const rotti = esito.rotti;

  const titolo = nuovi.length && rotti.length
    ? 'Maestri: uno nuovo su Matchpoint e uno che non risponde più'
    : nuovi.length
      ? (nuovi.length === 1 ? `Nuovo maestro su Matchpoint: ${nuovi[0]}` : `${nuovi.length} maestri nuovi su Matchpoint`)
      : (rotti.length === 1 ? `Il maestro «${rotti[0]}» non esiste più su Matchpoint` : `${rotti.length} maestri del gestionale non esistono più su Matchpoint`);

  const righe: string[] = [];
  if (nuovi.length) {
    righe.push('');
    righe.push('DA AGGIUNGERE al gestionale (esistono su Matchpoint ma non si possono selezionare):');
    nuovi.forEach((n) => righe.push(`  • ${n}`));
  }
  if (rotti.length) {
    righe.push('');
    righe.push('ATTENZIONE — questi sono nel menu del gestionale ma su Matchpoint non esistono più.');
    righe.push('Se qualcuno li sceglie, la lezione viene salvata SENZA maestro e nessuno se ne accorge:');
    rotti.forEach((n) => righe.push(`  • ${n}`));
  }
  righe.push('');
  righe.push(`Maestri che invece corrispondono: ${esito.coperti.map((c) => c.nostro).join(', ') || '(nessuno)'}`);
  righe.push('');
  righe.push('Come si sistema: la lista è scritta a mano in parser_rules.json (ramo ' + ramo + '),');
  righe.push('più quattro copie di riserva in index.html. Il nome va scritto ESATTAMENTE come');
  righe.push('compare nel menu «Istruttore» di Matchpoint: il salvataggio cerca la voce che');
  righe.push('CONTIENE quel testo, quindi una lettera di differenza lo fa fallire in silenzio.');
  righe.push('');
  righe.push(`(controllo automatico ${ambiente} — nessuna azione è stata fatta da solo)`);

  const text = `${titolo}\n${righe.join('\n')}`;

  const lista = (items: string[], colore: string) => items
    .map((n) => `<li style="margin:4px 0"><strong style="color:${colore}">${escapeHtml(n)}</strong></li>`).join('');

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;line-height:1.5">
<h2 style="margin:0 0 12px">${escapeHtml(titolo)}</h2>
${nuovi.length ? `<p style="margin:16px 0 4px"><strong>Da aggiungere al gestionale</strong><br>
<span style="color:#555;font-size:14px">Esistono su Matchpoint, ma nel gestionale non si possono selezionare.</span></p>
<ul style="margin:4px 0">${lista(nuovi, '#0a7d32')}</ul>` : ''}
${rotti.length ? `<p style="margin:16px 0 4px"><strong style="color:#b00">Attenzione</strong><br>
<span style="color:#555;font-size:14px">Sono nel menu del gestionale ma su Matchpoint non esistono più. Se qualcuno li sceglie, la lezione viene salvata <strong>senza maestro</strong> e nessuno se ne accorge.</span></p>
<ul style="margin:4px 0">${lista(rotti, '#b00')}</ul>` : ''}
<p style="margin:16px 0 4px;color:#555;font-size:14px">Maestri che invece corrispondono: ${escapeHtml(esito.coperti.map((c) => c.nostro).join(', ')) || '(nessuno)'}</p>
<hr style="border:none;border-top:1px solid #ddd;margin:20px 0">
<p style="color:#555;font-size:13px">La lista è scritta a mano in <code>parser_rules.json</code> (ramo <code>${escapeHtml(ramo)}</code>), più quattro copie di riserva in <code>index.html</code>. Il nome va scritto <strong>esattamente</strong> come compare nel menu «Istruttore» di Matchpoint: il salvataggio cerca la voce che <em>contiene</em> quel testo, quindi una lettera di differenza lo fa fallire in silenzio.</p>
<p style="color:#888;font-size:12px">Controllo automatico ${escapeHtml(ambiente)} — nessuna azione è stata fatta da solo.</p>
</div>`;

  return { subject: titolo, text, html };
}

async function mandaEmail(to: string, subject: string, text: string, html: string): Promise<string> {
  const accessToken = await getGmailAccessToken();
  const boundary = `pmo_maestri_${Date.now()}`;
  const raw = [
    `To: ${to}`,
    `Subject: ${encodeMimeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].join('\r\n')
    + `\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${text}\r\n\r\n`
    + `--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${html}\r\n\r\n--${boundary}--`;

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: base64UrlEncode(raw) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.id) throw new Error('GMAIL_SEND_FAILED');
  return clean(data.id);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);

  const supabaseUrl = clean(Deno.env.get('SUPABASE_URL'));
  const serviceKey = clean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  if (!supabaseUrl || !serviceKey) return json({ ok: false, error: 'SUPABASE_SECRETS_MISSING' }, 500);
  const admin = createClient(supabaseUrl, serviceKey);

  // Autenticazione: solo la routine. Non c'è una porta d'ingresso per lo staff —
  // questa funzione non serve a mano, e ogni porta in più è una porta da difendere.
  const secret = clean(req.headers.get('x-pmo-routine-secret'));
  if (!secret) return json({ ok: false, error: 'ROUTINE_SECRET_REQUIRED' }, 401);
  const { data: secretOk, error: secretErr } = await admin.rpc('pmo_verify_data_routine_secret', { p_secret: secret });
  if (secretErr || secretOk !== true) return json({ ok: false, error: 'ROUTINE_SECRET_INVALID' }, 401);

  const body: JsonMap = await req.json().catch(() => ({}));
  const forza = body?.force === true; // rimanda l'email anche se già segnalata (per la prova)
  const ambiente = supabaseUrl.includes(PROD_PROJECT_REF) ? 'PROD' : 'TEST';

  try {
    const [nostri, matchpoint] = await Promise.all([
      leggiNostriMaestri(supabaseUrl),
      leggiMaestriMatchpoint(),
    ]);

    // 🚨 Guardia anti-falso-allarme: se Matchpoint non ha restituito NESSUN maestro
    // non è «li hanno cancellati tutti», è una lettura andata storta. Senza questa
    // riga la prima ficha che non si apre manda un'email che dichiara rotto tutto.
    if (!matchpoint.length) {
      await admin.from('pmo_audit_log').insert({
        actor_user_id: '00000000-0000-0000-0000-000000000000',
        actor_email: `routine-maestri@${ambiente.toLowerCase()}.padel-match-organizer`,
        actor_role: 'system',
        action: `${AUDIT_ACTION}_error`,
        detail: { motivo: 'MATCHPOINT_LISTA_VUOTA', nostri: nostri.maestri },
      });
      return json({ ok: false, error: 'MATCHPOINT_LISTA_VUOTA', emailInviata: false }, 502);
    }

    const esito = confronta(nostri.maestri, matchpoint);
    const firma = impronta(esito);

    const base = {
      ambiente,
      ramo: nostri.ramo,
      versioneRegole: nostri.versione,
      nostri: nostri.maestri,
      matchpoint,
      esito,
    };

    if (esito.allineato) {
      await admin.from('pmo_audit_log').insert({
        actor_user_id: '00000000-0000-0000-0000-000000000000',
        actor_email: `routine-maestri@${ambiente.toLowerCase()}.padel-match-organizer`,
        actor_role: 'system',
        action: `${AUDIT_ACTION}_ok`,
        detail: base,
      });
      return json({ ok: true, allineato: true, emailInviata: false, ...base });
    }

    // Non rimandare la stessa email tutte le notti: se il disallineamento è
    // identico a quello già segnalato, basta il log. Un disallineamento DIVERSO
    // (un maestro in più) cambia l'impronta e fa ripartire l'avviso.
    const { data: ultimo } = await admin
      .from('pmo_audit_log')
      .select('detail')
      .eq('action', `${AUDIT_ACTION}_alert`)
      .order('created_at', { ascending: false })
      .limit(1);
    const giaSegnalato = !forza && clean((ultimo?.[0] as JsonMap | undefined)?.detail && ((ultimo![0] as JsonMap).detail as JsonMap)?.firma) === firma;

    let emailId = '';
    if (!giaSegnalato) {
      const to = clean(Deno.env.get('MAESTRI_ALERT_EMAIL_TO')) || DEFAULT_ALERT_TO;
      const { subject, text, html } = corpoEmail(esito, ambiente, nostri.ramo);
      emailId = await mandaEmail(to, `[Padel Village] ${subject}`, text, html);
      await admin.from('pmo_audit_log').insert({
        actor_user_id: '00000000-0000-0000-0000-000000000000',
        actor_email: `routine-maestri@${ambiente.toLowerCase()}.padel-match-organizer`,
        actor_role: 'system',
        action: `${AUDIT_ACTION}_alert`,
        detail: { ...base, firma, emailId, destinatario: to },
      });
    }

    return json({ ok: true, allineato: false, emailInviata: !giaSegnalato, giaSegnalato, ...base });
  } catch (err) {
    const message = String((err as Error)?.message || err);
    // Il log non deve poter nascondere l'errore vero: se anche l'insert fallisce,
    // si risponde comunque con il motivo originale.
    try {
      await admin.from('pmo_audit_log').insert({
        actor_user_id: '00000000-0000-0000-0000-000000000000',
        actor_email: `routine-maestri@${ambiente.toLowerCase()}.padel-match-organizer`,
        actor_role: 'system',
        action: `${AUDIT_ACTION}_error`,
        detail: { message },
      });
    } catch { /* ignorato di proposito */ }
    return json({ ok: false, error: 'MAESTRI_CHECK_FAILED', message }, 500);
  }
});
