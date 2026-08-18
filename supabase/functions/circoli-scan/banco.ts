// Banco di prova di circoli-scan, senza toccare nessun portale vero.
//
//   deno run -A --import-map=banco-map.json banco.ts
//
// Mette in piedi un FINTO Joomla che si comporta come Wansport — gettone CSRF dal
// nome casuale, redirect 303 dopo il login, sessione nei cookie — e ci fa girare
// contro la funzione vera. Serve a provare le cose che dal vivo si romperebbero in
// silenzio: soprattutto il barattolo dei biscotti attraverso i redirect, perché se
// i cookie si perdono il login «riesce» e /start torna la pagina da sloggati.
//
// 🚨 Ogni caso ha il suo SABOTAGGIO possibile: un banco che non si è mai visto
//    diventare rosso non prova niente (regola di casa).

type Caso = { nome: string; atteso: string; ottenuto?: string; ok?: boolean };
const casi: Caso[] = [];
const prova = (nome: string, atteso: string, ottenuto: string) => {
  casi.push({ nome, atteso, ottenuto, ok: atteso === ottenuto });
};

// ── Il finto circolo ──────────────────────────────────────────────────────────
const GETTONE = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
let modo: 'ok' | 'login-rifiutato' | 'niente-gettone' | 'start-ributta' = 'ok';
let cookieVistiSuStart = '';
let richieste: string[] = [];

const finto = Deno.serve({ port: 8791, onListen: () => {} }, (req) => {
  const url = new URL(req.url);
  richieste.push(`${req.method} ${url.pathname}`);
  const cookie = req.headers.get('cookie') || '';

  if (url.pathname === '/' && req.method === 'GET') {
    const gettone = modo === 'niente-gettone' ? '' : `<input type="hidden" name="${GETTONE}" value="1" />`;
    return new Response(
      `<html><body><form method="post"><input name="username"><input name="password">${gettone}</form></body></html>`,
      { headers: { 'content-type': 'text/html', 'set-cookie': 'JSESS=abc123; Path=/; HttpOnly' } },
    );
  }
  if (url.pathname === '/' && req.method === 'POST') {
    if (modo === 'login-rifiutato') {
      return new Response('<html><body>Nome utente e la password non corrispondono</body></html>', { headers: { 'content-type': 'text/html' } });
    }
    // Joomla risponde 303 e mette il cookie di autenticazione: se il barattolo non
    // lo raccoglie qui, /start non vedrà mai la sessione.
    return new Response(null, { status: 303, headers: { location: '/', 'set-cookie': 'AUTH=si; Path=/' } });
  }
  if (url.pathname === '/start') {
    cookieVistiSuStart = cookie;
    if (modo === 'start-ributta' || !cookie.includes('AUTH=si')) {
      return new Response('<html><body><form><input name="password"></form></body></html>', { headers: { 'content-type': 'text/html' } });
    }
    return new Response(
      `<html><body><a href="/index.php?option=com_wansport&view=calendar">Prenota</a>
       <div class="court">Campo 1</div><div class="court">Campo 2</div>
       <span>07:30</span><span>09:00</span><span>10:30</span><span>12:00</span>
       padel padel <a href="/logout">Esci</a></body></html>`,
      { headers: { 'content-type': 'text/html' } },
    );
  }
  return new Response('nope', { status: 404 });
});

// ── Finto gestionale: una riga di circolo che punta al finto portale ──────────
let riga: Record<string, unknown> = {
  id: 'finto', nome: 'Circolo Finto', piattaforma: 'wansport',
  base_url: 'http://127.0.0.1:8791/', attivo: true, stato_utenza: 'attiva',
  ultimo_scan_at: null,
};
let scritture: Record<string, unknown>[] = [];
let profiloStaff: Record<string, unknown> | null = { status: 'active', role: 'owner' };

(globalThis as any).__stubSupabase = () => ({
  auth: { getUser: async () => (profiloStaff ? { data: { user: { id: 'u1' } }, error: null } : { data: null, error: 'no' }) },
  rpc: async () => ({ data: profiloStaff ? [profiloStaff] : [], error: null }),
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: riga.id ? riga : null, error: null }) }) }),
    update: (v: Record<string, unknown>) => ({ eq: async () => { scritture.push(v); return { error: null }; } }),
  }),
});

Deno.env.set('SUPABASE_URL', 'http://x'); Deno.env.set('SUPABASE_ANON_KEY', 'k'); Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'k');
Deno.env.set('WANSPORT_USER', 'tizio'); Deno.env.set('WANSPORT_PASS', 'segreto');

// Cattura l'handler della funzione vera senza farle aprire una porta.
let handler: (r: Request) => Promise<Response>;
const serveVero = Deno.serve;
(Deno as any).serve = (h: any) => { handler = h; return { finished: Promise.resolve(), shutdown: async () => {} } as any; };
await import('./index.ts');
(Deno as any).serve = serveVero;

const chiama = async (body: unknown, conToken = true) => {
  const res = await handler(new Request('http://f/', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(conToken ? { Authorization: 'Bearer t' } : {}) },
    body: JSON.stringify(body),
  }));
  return { http: res.status, corpo: await res.json() };
};

// ═══ I CASI ═══════════════════════════════════════════════════════════════════
// ① strada felice
let r = await chiama({ circolo: 'finto' });
prova('① sonda riuscita', 'true', String(r.corpo.ok));
prova('① radiografia vede com_wansport', 'true', String((r.corpo.radiografia?.citaWansport ?? 0) > 0));
prova('① trova gli orari della griglia', '4', String(r.corpo.radiografia?.quantiOrari));
prova('① riconosce i campi', 'true', String((r.corpo.radiografia?.paroleCampo ?? []).length >= 2));
prova('① dichiara di non essere un parser', 'true', String(/non una lettura dei campi liberi/.test(r.corpo.avvertenza || '')));
// ⭐ il caso che smaschera il difetto silenzioso: i cookie hanno attraversato il 303?
prova('① i cookie arrivano a /start dopo il redirect', 'true', String(cookieVistiSuStart.includes('AUTH=si')));
prova('① registra l\'esito sulla riga', 'sonda ok', String(scritture.at(-1)?.ultimo_esito));
prova('① registra la latenza', 'true', String(typeof scritture.at(-1)?.ultima_latenza_ms === 'number'));

// ② login rifiutato — e Joomla risponde 200, non un errore HTTP
modo = 'login-rifiutato'; riga.ultimo_scan_at = null;
r = await chiama({ circolo: 'finto' });
prova('② login rifiutato riconosciuto (HTTP 200!)', 'LOGIN_RIFIUTATO', String(r.corpo.error));
prova('② il rifiuto finisce sulla riga', 'LOGIN_RIFIUTATO', String(scritture.at(-1)?.ultimo_esito));

// ③ /start ci ributta al login: il login NON è riuscito, anche se sembrava
modo = 'start-ributta'; riga.ultimo_scan_at = null;
r = await chiama({ circolo: 'finto' });
prova('③ /start che richiede il login è un fallimento', 'START_CHIEDE_ANCORA_IL_LOGIN', String(r.corpo.error));

// ④ niente gettone CSRF
modo = 'niente-gettone'; riga.ultimo_scan_at = null;
r = await chiama({ circolo: 'finto' });
prova('④ gettone CSRF assente', 'GETTONE_CSRF_NON_TROVATO', String(r.corpo.error));

// ⑤ disarmata senza credenziali
modo = 'ok'; riga.ultimo_scan_at = null;
Deno.env.delete('WANSPORT_USER');
// 🧯 Il conto si fa PRIMA e DOPO, non a memoria: la prima stesura sottraeva un
//    numero fisso di richieste precedenti e sbagliava, perché i casi che falliscono
//    presto non arrivano mai a /start. Era la sonda a essere rotta, non la funzione.
const primaDelDisarmo = richieste.length;
r = await chiama({ circolo: 'finto' });
prova('⑤ senza credenziali: disarmata', 'SCANNER_DISARMATO', String(r.corpo.error));
prova('⑤ e risponde 503', '503', String(r.http));
prova('⑤ e NON ha contattato il portale', '0', String(richieste.length - primaDelDisarmo));
Deno.env.set('WANSPORT_USER', 'tizio');

// ⑥ circolo fermo: non si interroga chi ci rifiuta il login
riga.attivo = false; riga.stato_utenza = 'in_approvazione'; riga.ultimo_scan_at = null;
r = await chiama({ circolo: 'finto' });
prova('⑥ circolo fermo non si interroga', 'CIRCOLO_FERMO', String(r.corpo.error));
riga.attivo = true; riga.stato_utenza = 'attiva';

// ⑦ Padel Village non si interroga mai
riga.piattaforma = 'matchpoint'; riga.ultimo_scan_at = null;
r = await chiama({ circolo: 'finto' });
prova('⑦ matchpoint non si interroga', 'NON_SI_INTERROGA', String(r.corpo.error));
riga.piattaforma = 'wansport';

// ⑧ intervallo minimo
riga.ultimo_scan_at = new Date().toISOString();
r = await chiama({ circolo: 'finto' });
prova('⑧ due sonde ravvicinate: la seconda no', 'TROPPO_PRESTO', String(r.corpo.error));
prova('⑧ e risponde 429', '429', String(r.http));
riga.ultimo_scan_at = null;

// ⑨ senza token staff
r = await chiama({ circolo: 'finto' }, false);
prova('⑨ senza token: AUTH_REQUIRED', 'AUTH_REQUIRED', String(r.corpo.error));
// ⑨b con token ma profilo non attivo
profiloStaff = { status: 'suspended' };
r = await chiama({ circolo: 'finto' });
prova('⑨b profilo non attivo respinto', 'AUTH_REQUIRED', String(r.corpo.error));
profiloStaff = { status: 'active', role: 'owner' };

// ⑩ il parser non esiste e non si finge
r = await chiama({ circolo: 'finto', azione: 'scan' });
prova('⑩ azione scan non finge zero campi liberi', 'NON_ANCORA_IMPLEMENTATO', String(r.corpo.error));
prova('⑩ e risponde 501', '501', String(r.http));

// ⑪ CONTROLLO POSITIVO finale: dopo tutti i rifiuti, la strada buona funziona ancora
riga.ultimo_scan_at = null;
r = await chiama({ circolo: 'finto' });
prova('⑪ controllo positivo: la strada buona regge', 'true', String(r.corpo.ok));

// ═══ ESITO ════════════════════════════════════════════════════════════════════
await finto.shutdown();
const rossi = casi.filter(c => !c.ok);
for (const c of casi) console.log(`  ${c.ok ? '✅' : '🚨'} ${c.nome.padEnd(46)} atteso=${c.atteso} ottenuto=${c.ottenuto}`);
console.log(`\n${casi.length - rossi.length}/${casi.length}${rossi.length ? '  🚨 ROSSO' : '  ✅ tutti verdi'}`);
Deno.exit(rossi.length ? 1 : 0);
