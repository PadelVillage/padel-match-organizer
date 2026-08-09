import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// assessment-notify-staff — ogni autovalutazione ricevuta arriva via email.
//
// Chiesta dal committente il 9/08/2026: vuole leggere OGNI scheda, quelle che
// passano e quelle che no, per poi darle in pasto a un agente. Quindi qui non
// vale la regola del controllo maestri («silenzio quando è tutto a posto»): si
// manda sempre, e il corpo dice da sé com'è andata.
//
// ⭐ Il guardiano sta sul DATABASE, non nell'app: legge le righe nuove di
// `self_assessments`. Così copre la scheda pubblica, il link esterno e — quando
// arriverà — il bot Telegram, senza che nessuno debba ricordarsi di agganciare
// un canale in più.
//
// Doppioni: `pmo_assessment_notifications` tiene i token già mandati. La
// migration la riempie con lo storico, così l'accensione non spara all'indietro
// un'email per ogni scheda mai ricevuta.
//
// Invocata da pg_cron (pmo_dispatch_assessment_notify → net.http_post con
// header x-pmo-routine-secret), stesso schema delle altre routine.
// ─────────────────────────────────────────────────────────────────────────────

type JsonMap = Record<string, unknown>;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pmo-routine-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PROD_PROJECT_REF = 'qqbfphyslczzkxoncgex';
const DEFAULT_ALERT_TO = 'padelvillage.club@gmail.com';
const AUDIT_ACTION = 'assessment_notify_staff';
const FINESTRA_GIORNI = 7;     // oltre, è roba vecchia: non si rincorre
const MASSIMO_PER_GIRO = 25;   // un tetto: se qualcosa impazzisce, non manda 900 email

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : (value === null || value === undefined ? '' : String(value));
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

// ── La scala dei livelli ─────────────────────────────────────────────────────
// 🚨 Copia della tabella che in index.html sta fra le sentinelle
// «ASSESS-KNOWLEDGE SHARED»: qui serve solo a scrivere la parola accanto al
// numero. Il banco test/autovalutazione-conoscenza.test.mjs confronta le due
// liste e diventa rosso se qualcuno ne cambia una sola.
const LIVELLI: Array<{ max: number; definizione: string }> = [
  { max: 1.5, definizione: 'Principiante' },
  { max: 2.5, definizione: 'Base' },
  { max: 3.5, definizione: 'Intermedio' },
  { max: 4.5, definizione: 'Avanzato' },
  { max: 5.5, definizione: 'Agonista' },
  { max: 6.5, definizione: 'Semi-Pro' },
  { max: 7.0, definizione: 'Professionista' },
];

function definizione(value: unknown): string {
  const raw = clean(value).replace(',', '.');
  if (!raw) return '';
  const n = Number(raw);
  if (!Number.isFinite(n)) return '';
  return (LIVELLI.find((f) => n <= f.max) || LIVELLI[LIVELLI.length - 1]).definizione;
}

function livelloEsteso(value: unknown): string {
  const numero = clean(value);
  const parola = definizione(value);
  if (!numero) return '-';
  return parola ? `${parola} (${numero})` : numero;
}

const COERENZA_IN_PAROLE: Record<string, string> = {
  high: 'alta — dichiarato e risposte tecniche coincidono',
  medium: 'media — c\'è mezzo punto di differenza',
  low: 'bassa — dichiarato e risposte tecniche non tornano',
};

// ── Il corpo dell'email ──────────────────────────────────────────────────────
// Ordinato e sempre uguale: prima l'esito in una riga, poi i dati, poi tutte le
// risposte. Serve a essere letto da una persona di corsa e, un domani, da un
// agente — per questo i campi hanno sempre lo stesso nome e lo stesso ordine.
function corpoEmail(riga: JsonMap, ambiente: string, prova = false) {
  const raw = (riga.raw_response || {}) as JsonMap;
  const knowledge = (raw.knowledge || null) as JsonMap | null;
  const answers = (raw.answers || {}) as JsonMap;

  const nome = clean(`${clean(riga.first_name)} ${clean(riga.last_name)}`).trim() || 'Socio senza nome';
  const coerenza = clean(riga.consistency_status);
  const conoscenzaFatta = !!knowledge && Number(knowledge.total || 0) > 0;
  const conoscenzaPassata = !!knowledge && clean(knowledge.status) === 'pass';
  const inCoda = clean(riga.staff_status) === 'review' || clean(riga.staff_status) === 'da_controllare';

  const esito = inCoda
    ? 'DA CONTROLLARE — il livello non è stato cambiato'
    : 'Tutto torna — il livello si applica da solo';

  const motivi: string[] = [];
  if (conoscenzaFatta && !conoscenzaPassata) {
    motivi.push(`test di conoscenza non superato: ${clean(knowledge!.correct)}/${clean(knowledge!.total)} risposte giuste${knowledge!.trap_failed ? ', domanda trappola sbagliata' : ''}`);
  }
  if (knowledge && !conoscenzaFatta) motivi.push('livello alto dichiarato: per questa fascia il test di conoscenza non è previsto');
  if (coerenza === 'low') motivi.push('le risposte tecniche non tornano con il livello dichiarato');
  if (coerenza === 'medium') motivi.push('mezzo punto di differenza fra dichiarato e risposte tecniche');
  if (raw.experience_flag) motivi.push('dichiara un livello medio-alto ma gioca da poco');

  const titolo = `${nome} — ${conoscenzaFatta ? (conoscenzaPassata ? 'test superato' : 'test NON superato') : 'autovalutazione ricevuta'}`;

  const righe: string[] = [];
  righe.push(`ESITO: ${esito}`);
  if (motivi.length) {
    righe.push('');
    righe.push('PERCHÉ:');
    motivi.forEach((m) => righe.push(`  • ${m}`));
  }
  righe.push('');
  righe.push('DATI');
  righe.push(`  Socio: ${nome}`);
  righe.push(`  Telefono: ${clean(riga.phone) || '-'}`);
  righe.push(`  Ricevuta: ${clean(riga.submitted_at)}`);
  righe.push(`  Livello dichiarato: ${livelloEsteso(riga.declared_level)}`);
  righe.push(`  Livello calcolato: ${livelloEsteso(riga.calculated_level)}`);
  righe.push(`  Coerenza: ${COERENZA_IN_PAROLE[coerenza] || coerenza || '-'}`);
  righe.push(`  Conoscenza: ${conoscenzaFatta ? `${clean(knowledge!.correct)}/${clean(knowledge!.total)} (fascia ${clean(knowledge!.fascia)})${knowledge!.trap_failed ? ' — trappola sbagliata' : ''}` : 'non prevista per la fascia dichiarata'}`);
  righe.push(`  Origine: ${clean(raw.source) || '-'}`);

  if (conoscenzaFatta && Array.isArray(knowledge!.questions)) {
    righe.push('');
    righe.push('DOMANDE DI CONOSCENZA');
    (knowledge!.questions as JsonMap[]).forEach((q) => {
      righe.push(`  ${q.giusta ? '✅' : '❌'} ${clean(q.domanda)}${q.trap ? '  [trappola]' : ''}`);
      righe.push(`      ha risposto: ${clean(q.risposta) || '(nessuna risposta)'}`);
      if (!q.giusta) righe.push(`      giusta era: ${clean(q.attesa)}`);
    });
  }

  const etichette: Record<string, string> = {
    experience: 'Da quanto gioca',
    frequency: 'Volte al mese',
    declaredLevel: 'Livello che pensa di avere',
    balancedLevel: 'Gioca alla pari con',
    rally: 'Scambio',
    glass: 'Vetro in difesa',
    net: 'A rete',
    overhead: 'Bandeja / vibora / smash',
  };
  righe.push('');
  righe.push('RISPOSTE SUL PROPRIO GIOCO');
  Object.entries(etichette).forEach(([chiave, etichetta]) => {
    const valore = clean(answers[chiave]);
    if (!valore) return;
    const conParola = (chiave === 'declaredLevel' || chiave === 'balancedLevel') ? livelloEsteso(valore) : valore;
    righe.push(`  ${etichetta}: ${conParola}`);
  });

  righe.push('');
  righe.push(inCoda
    ? 'COSA FARE: apri il gestionale, sezione Autovalutazioni, e decidi tu. Il livello del socio è rimasto quello di prima.'
    : 'COSA FARE: niente. Il livello è stato aggiornato da solo e al socio è partita la conferma.');
  righe.push('');
  righe.push(`(avviso automatico del gestionale${ambiente === 'PROD' ? '' : ' — ambiente di prova'}: al socio non è stato detto nulla di questo riepilogo)`);

  const avvisoProva = prova
    ? 'QUESTA È UNA PROVA. Nessun socio ha mandato questa scheda: serve solo a verificare\nche l\'avviso automatico sappia arrivarti. I dati qui sotto sono inventati.\n\n'
    : '';

  const text = `${avvisoProva}${titolo}\n\n${righe.join('\n')}`;

  const colore = inCoda ? '#b00' : '#0a7d32';
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;line-height:1.5">
${prova ? `<div style="background:#fff4d6;border:1px solid #e0b400;border-radius:8px;padding:12px 14px;margin:0 0 16px">
<strong>Questa è una prova.</strong><br><span style="font-size:14px;color:#555">Nessun socio ha mandato questa scheda: serve solo a verificare che l'avviso automatico sappia arrivarti. I dati qui sotto sono inventati.</span></div>` : ''}
<h2 style="margin:0 0 4px">${escapeHtml(nome)}</h2>
<p style="margin:0 0 16px"><strong style="color:${colore}">${escapeHtml(esito)}</strong></p>
${motivi.length ? `<ul style="margin:0 0 16px;color:#555;font-size:14px">${motivi.map((m) => `<li style="margin:4px 0">${escapeHtml(m)}</li>`).join('')}</ul>` : ''}
<table style="border-collapse:collapse;font-size:14px;margin:0 0 16px">
<tr><td style="padding:3px 12px 3px 0;color:#777">Telefono</td><td><strong>${escapeHtml(clean(riga.phone) || '-')}</strong></td></tr>
<tr><td style="padding:3px 12px 3px 0;color:#777">Dichiarato</td><td><strong>${escapeHtml(livelloEsteso(riga.declared_level))}</strong></td></tr>
<tr><td style="padding:3px 12px 3px 0;color:#777">Calcolato</td><td><strong>${escapeHtml(livelloEsteso(riga.calculated_level))}</strong></td></tr>
<tr><td style="padding:3px 12px 3px 0;color:#777">Coerenza</td><td>${escapeHtml(COERENZA_IN_PAROLE[coerenza] || coerenza || '-')}</td></tr>
<tr><td style="padding:3px 12px 3px 0;color:#777">Conoscenza</td><td><strong>${escapeHtml(conoscenzaFatta ? `${clean(knowledge!.correct)}/${clean(knowledge!.total)}` : 'non prevista')}</strong>${conoscenzaFatta && knowledge!.trap_failed ? ' <span style="color:#b00">— trappola sbagliata</span>' : ''}</td></tr>
</table>
${conoscenzaFatta && Array.isArray(knowledge!.questions) ? `<p style="margin:0 0 4px"><strong>Domande di conoscenza</strong></p>
<ol style="margin:4px 0 16px;font-size:14px;color:#333">${(knowledge!.questions as JsonMap[]).map((q) => `<li style="margin:6px 0">${q.giusta ? '✅' : '❌'} ${escapeHtml(clean(q.domanda))}${q.trap ? ' <span style="color:#888">[trappola]</span>' : ''}<br><span style="color:#555">ha risposto: ${escapeHtml(clean(q.risposta) || '(nessuna risposta)')}</span>${q.giusta ? '' : `<br><span style="color:#0a7d32">giusta era: ${escapeHtml(clean(q.attesa))}</span>`}</li>`).join('')}</ol>` : ''}
<p style="margin:0 0 4px"><strong>Risposte sul proprio gioco</strong></p>
<table style="border-collapse:collapse;font-size:14px;margin:4px 0 16px">
${Object.entries(etichette).map(([chiave, etichetta]) => {
    const valore = clean(answers[chiave]);
    if (!valore) return '';
    const conParola = (chiave === 'declaredLevel' || chiave === 'balancedLevel') ? livelloEsteso(valore) : valore;
    return `<tr><td style="padding:3px 12px 3px 0;color:#777;vertical-align:top">${escapeHtml(etichetta)}</td><td>${escapeHtml(conParola)}</td></tr>`;
  }).join('')}
</table>
<hr style="border:none;border-top:1px solid #ddd;margin:20px 0">
<p style="margin:0 0 6px"><strong>Cosa fare</strong></p>
<p style="color:#555;font-size:14px;margin:0 0 12px">${inCoda
    ? 'Apri il gestionale, sezione Autovalutazioni, e decidi tu. Il livello del socio è rimasto quello di prima.'
    : 'Niente. Il livello è stato aggiornato da solo e al socio è partita la conferma.'}</p>
<p style="color:#888;font-size:12px">Avviso automatico del gestionale${ambiente === 'PROD' ? '' : ' — ambiente di prova'}: al socio non è stato detto nulla di questo riepilogo.</p>
</div>`;

  return { subject: titolo, text, html };
}

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

async function mandaEmail(to: string, subject: string, text: string, html: string): Promise<string> {
  const accessToken = await getGmailAccessToken();
  const boundary = `pmo_assessment_${Date.now()}`;
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

  // Solo la routine. Nessuna porta per lo staff: questa funzione non si usa a mano.
  const secret = clean(req.headers.get('x-pmo-routine-secret'));
  if (!secret) return json({ ok: false, error: 'ROUTINE_SECRET_REQUIRED' }, 401);
  const { data: secretOk, error: secretErr } = await admin.rpc('pmo_verify_data_routine_secret', { p_secret: secret });
  if (secretErr || secretOk !== true) return json({ ok: false, error: 'ROUTINE_SECRET_INVALID' }, 401);

  const body: JsonMap = await req.json().catch(() => ({}));
  const ambiente = supabaseUrl.includes(PROD_PROJECT_REF) ? 'PROD' : 'TEST';
  const destinatario = clean(Deno.env.get('ASSESSMENT_ALERT_EMAIL_TO')) || DEFAULT_ALERT_TO;

  // ── Prova del canale ──────────────────────────────────────────────────────
  // Con nessuna scheda nuova questa funzione tace, e non si saprebbe se l'email
  // sa arrivare. Questo ramo manda un riepilogo di ESEMPIO, marcato come prova:
  // non legge le schede, non segna niente come mandato. Si invoca a mano.
  if (body?.provaEmail === true) {
    const finta: JsonMap = {
      first_name: 'Mario', last_name: 'Rossi (nome di prova)',
      phone: '+39 000 0000000',
      submitted_at: new Date().toISOString(),
      declared_level: '4.5', calculated_level: '4.5',
      consistency_status: 'high', staff_status: 'review',
      raw_response: {
        source: 'prova',
        answers: { experience: 'Più di 3 anni', frequency: '4-6', declaredLevel: '4.5', balancedLevel: '4.5', rally: 'Tengo scambi anche con ritmo alto', glass: 'Lo uso per difendere e ripartire in attacco', net: 'Costruisco e chiudo il punto a rete', overhead: 'Uso colpi alti in modo tattico e affidabile' },
        knowledge: {
          status: 'fail', correct: 2, total: 4, trap_failed: true, fascia: 'Avanzato',
          questions: [
            { domanda: 'Che colpo è la vibora?', risposta: 'Un pallonetto difensivo molto profondo', attesa: 'Un colpo alto tagliato di lato, che dopo il rimbalzo resta basso e scivola', giusta: false, trap: false },
            { domanda: 'Che colpo è la chiquita?', risposta: 'Una palla bassa e lenta giocata ai piedi di chi sta a rete', attesa: 'Una palla bassa e lenta giocata ai piedi di chi sta a rete', giusta: true, trap: false },
            { domanda: 'Quando si gioca la bajada?', risposta: 'Su una palla che esce dal vetro, colpendola in discesa per attaccare', attesa: 'Su una palla che esce dal vetro, colpendola in discesa per attaccare', giusta: true, trap: false },
            { domanda: 'In quale situazione si usa il «cambio de pared australiano»?', risposta: 'Quando si difende sul vetro laterale', attesa: 'Non esiste un colpo con questo nome', giusta: false, trap: true },
          ],
        },
      },
    };
    const { subject, text, html } = corpoEmail(finta, ambiente, true);
    const emailId = await mandaEmail(destinatario, `[Padel Village] PROVA — ${subject}`, text, html);
    await admin.from('pmo_audit_log').insert({
      actor_user_id: '00000000-0000-0000-0000-000000000000',
      actor_email: `routine-autovalutazione@${ambiente.toLowerCase()}.padel-match-organizer`,
      actor_role: 'system',
      action: `${AUDIT_ACTION}_prova`,
      detail: { destinatario, emailId },
    });
    return json({ ok: true, prova: true, emailInviata: true, destinatario, emailId });
  }

  try {
    const dal = new Date(Date.now() - FINESTRA_GIORNI * 86400000).toISOString();
    const { data: righe, error: leggiErr } = await admin
      .from('self_assessments')
      .select('token, submitted_at, first_name, last_name, phone, declared_level, calculated_level, consistency_status, staff_status, raw_response')
      .gte('submitted_at', dal)
      .order('submitted_at', { ascending: true })
      .limit(200);
    if (leggiErr) throw new Error(`SELF_ASSESSMENTS_READ_FAILED: ${leggiErr.message}`);
    if (!righe?.length) return json({ ok: true, nuove: 0, inviate: 0 });

    const tokens = righe.map((r) => clean(r.token)).filter(Boolean);
    const { data: gia, error: giaErr } = await admin
      .from('pmo_assessment_notifications')
      .select('token')
      .in('token', tokens);
    if (giaErr) throw new Error(`NOTIFICATIONS_READ_FAILED: ${giaErr.message}`);
    const mandati = new Set((gia || []).map((r) => clean(r.token)));

    const daMandare = righe.filter((r) => !mandati.has(clean(r.token)));
    if (!daMandare.length) return json({ ok: true, nuove: 0, inviate: 0 });

    // 🚨 Il tetto vale per giro, non per sempre: quelle oltre restano non segnate
    // e partono al giro dopo. Meglio in ritardo che 200 email in un colpo.
    const lotto = daMandare.slice(0, MASSIMO_PER_GIRO);
    const esiti: JsonMap[] = [];

    for (const riga of lotto) {
      const token = clean(riga.token);
      try {
        const { subject, text, html } = corpoEmail(riga as JsonMap, ambiente);
        const prefisso = ambiente === 'PROD' ? '[Padel Village]' : '[Padel Village TEST]';
        const emailId = await mandaEmail(destinatario, `${prefisso} Autovalutazione — ${subject}`, text, html);
        // Si segna DOPO l'invio riuscito: se Gmail rifiuta, la scheda resta in
        // coda e riparte al giro dopo invece di sparire in silenzio.
        const { error: segnaErr } = await admin
          .from('pmo_assessment_notifications')
          .insert({ token, email_id: emailId, destinatario });
        if (segnaErr) throw new Error(`NOTIFICATION_MARK_FAILED: ${segnaErr.message}`);
        esiti.push({ token, ok: true, emailId });
      } catch (err) {
        esiti.push({ token, ok: false, errore: (err as Error).message });
      }
    }

    const inviate = esiti.filter((e) => e.ok).length;
    await admin.from('pmo_audit_log').insert({
      actor_user_id: '00000000-0000-0000-0000-000000000000',
      actor_email: `routine-autovalutazione@${ambiente.toLowerCase()}.padel-match-organizer`,
      actor_role: 'system',
      action: inviate === esiti.length ? `${AUDIT_ACTION}_ok` : `${AUDIT_ACTION}_parziale`,
      detail: { ambiente, destinatario, nuove: daMandare.length, inviate, esiti },
    });

    return json({ ok: true, nuove: daMandare.length, inviate, restano: daMandare.length - lotto.length, esiti });
  } catch (err) {
    const messaggio = (err as Error).message;
    await admin.from('pmo_audit_log').insert({
      actor_user_id: '00000000-0000-0000-0000-000000000000',
      actor_email: `routine-autovalutazione@${ambiente.toLowerCase()}.padel-match-organizer`,
      actor_role: 'system',
      action: `${AUDIT_ACTION}_error`,
      detail: { ambiente, errore: messaggio },
    });
    return json({ ok: false, error: messaggio }, 500);
  }
});
