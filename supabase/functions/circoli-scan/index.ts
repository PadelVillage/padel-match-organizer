import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sondaMatchpoint, grigliaDaSlot } from './matchpoint.ts';

// circoli-scan — VOCE 60, PASSO 2. Legge i campi liberi nei circoli della zona.
// Disegno completo: docs/circoli-esterni-disegno.md
//
// ⭐ PERCHÉ VIVE QUI E NON SUL WORKER, che è la scelta che regge tutto il resto:
// il login Wansport è un Joomla `com_users` riproducibile con `fetch` puro — niente
// browser. Il worker Hetzner (`tools/matchpoint-browser-worker/`) MUORE con Matchpoint,
// perché i suoi 21 endpoint sono tutti automazione del browser su Matchpoint. Legando
// l'aggregatore al worker, quel giorno andrebbe riscritto; nascendo qui, quel giorno
// non si tocca. È «il gestionale SA, il bot DICE» applicato a una funzione nuova.
//
// ══════════════════════════════════════════════════════════════════════════════
// ⚠️ QUESTA VERSIONE NON HA UN PARSER, ED È VOLUTO.
// ══════════════════════════════════════════════════════════════════════════════
// Il disegno pone una condizione esplicita: «se il calendario dentro /start sia HTML
// da spolpare o abbia un endpoint JSON — DA MISURARE PRIMA DI SCRIVERE IL PARSER».
// Nessuno l'ha ancora misurato, perché richiede un login e il login richiede un
// account. Quindi il primo giro è uno STRUMENTO DI MISURA: fa il login, chiede
// /start, e riferisce che FORMA ha quello che è tornato — non che campi sono liberi.
// Scrivere il parser prima sarebbe indovinare la griglia, cioè esattamente la
// «trappola del parser» che il disegno descrive: una scorciatoia che funziona sui
// primi due circoli e si rompe al terzo.
// ⇒ `azione: 'sonda'` è l'unica implementata. `azione: 'scan'` risponde
//    NON_ANCORA_IMPLEMENTATO invece di restituire zero campi liberi, che sarebbe
//    un «non c'è posto» falso — il difetto peggiore che questo servizio possa avere.
//
// ══════════════════════════════════════════════════════════════════════════════
// 🚨 LE PROTEZIONI, e perché sono nel codice e non nelle buone intenzioni
// ══════════════════════════════════════════════════════════════════════════════
// Questa funzione parla con i server di ALTRI CIRCOLI. La questione aperta n.1 del
// disegno è che leggerli in automatico è probabilmente fuori dalle loro condizioni
// d'uso, e il rischio non è teorico: chiudono l'account e il servizio dei soci muore.
// Perciò:
//
//  ① DISARMATA SENZA CREDENZIALI. Niente WANSPORT_USER/WANSPORT_PASS in env → 503
//    SCANNER_DISARMATO. Come `consumer-identity-lookup` senza CONSUMER_BRIDGE_SECRET:
//    una funzione che non può fare danni finché qualcuno non decide che deve.
//  ② UN CIRCOLO PER CHIAMATA. Nessun ventaglio: quello è il passo 3, e ci arriva
//    dopo che questo ha misurato quanto costa UNA lettura.
//  ③ SOLO CIÒ CHE LA TABELLA AUTORIZZA. Il circolo deve essere `attivo`, con
//    `stato_utenza='attiva'`, piattaforma `wansport` e un `base_url`. È lo stesso
//    vincolo che sta nel database, ripetuto alla porta: interrogare un circolo che
//    ci rifiuta il login è rumore verso terzi, cioè il modo di farsi chiudere fuori.
//  ④ UNA LETTURA AL GIORNO PER CIRCOLO (24 ore). Non è una gentilezza, è la
//    differenza fra un cliente e un molestatore — e ha un costo dichiarato: con
//    questo ritmo la fotografia invecchia fino a 24 ore, quindi il servizio NON
//    può ancora dire «c'è posto». Vedi il commento sulla costante.
//  ⑤ SOLO LETTURA VERSO L'ESTERNO. Le uniche richieste che escono sono la GET della
//    home, la POST del login e la GET di /start. Nessuna prenotazione, mai.
//  ⑥ SI PRESENTA PER QUELLO CHE È. Lo User-Agent dichiara chi siamo e dove
//    scrivere. Travestirsi da browser sarebbe più efficace e più sbagliato: se un
//    circolo ci blocca, quella è un'informazione che ci serve — non un ostacolo da
//    aggirare. Chi vuole l'accesso da partner comincia col non nascondersi.

type JsonMap = Record<string, unknown>;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UA = 'PadelVillage-CircoliScan/1.0 (+https://padelvillage.club; contatto: padelvillage.club@gmail.com)';
const TIMEOUT_MS = 20000;         // per singola richiesta
const MAX_BYTES = 4 * 1024 * 1024; // /start è ~1 MB: oltre 4 non è più la pagina che credevamo
// 🗣️ UNA LETTURA AL GIORNO PER CIRCOLO — deciso dal committente il 18/08/2026.
// Era 60 secondi; ora sono 24 ore, e il numero non è tecnico ma una scelta di
// misura verso server che non sono nostri.
// ⚠️ E HA UNA CONSEGUENZA SUL PRODOTTO, scritta qui perché non si perda: con una
// lettura al giorno la fotografia può essere vecchia di 24 ore, mentre il disegno
// prometteva 5 minuti. Un campo prenotato stamattina risulterebbe ancora libero
// stasera ⇒ **in questo assetto il servizio non può rispondere «c'è posto»**, può
// solo dire com'era ieri. La regola della freschezza del gestionale vale qui
// identica: il verdetto si dà solo con una fotografia certificata fresca,
// altrimenti la risposta onesta è «non lo so».
// ⇒ È una postura da BETA, non il disegno finale: la frequenza vera si alza il
//    giorno che c'è un accordo con Wansport, non prima.
const INTERVALLO_MINIMO_MS = 24 * 60 * 60 * 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
const ko = (error: string, extra: JsonMap = {}, status = 400) => json({ ok: false, error, ...extra }, status);
const clean = (v: unknown) => String(v ?? '').trim();

// ── Barattolo dei biscotti ────────────────────────────────────────────────────
// Deno non tiene i cookie per noi e non li porta attraverso i redirect: il login
// Joomla vive proprio lì (sessione alla home, redirect dopo la POST). Quindi i
// redirect si seguono a mano, raccogliendo i Set-Cookie a ogni salto. Senza questo,
// il login «riesce» e /start torna la pagina da sloggati — che è il modo silenzioso
// di misurare la cosa sbagliata.
class Biscotti {
  private m = new Map<string, string>();
  raccogli(res: Response) {
    const set = (res.headers as any).getSetCookie?.() ?? [];
    const lista: string[] = set.length ? set : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')!] : []);
    for (const riga of lista) {
      const primo = riga.split(';')[0];
      const i = primo.indexOf('=');
      if (i > 0) this.m.set(primo.slice(0, i).trim(), primo.slice(i + 1).trim());
    }
  }
  intestazione() { return [...this.m].map(([k, v]) => `${k}=${v}`).join('; '); }
  get quanti() { return this.m.size; }
}

async function chiedi(url: string, opts: RequestInit, biscotti: Biscotti, maxSalti = 5) {
  let corrente = url;
  let salti = 0;
  const percorso: string[] = [];
  while (true) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(corrente, {
        ...opts,
        redirect: 'manual',
        signal: ctrl.signal,
        headers: {
          'User-Agent': UA,
          'Accept-Language': 'it-IT,it;q=0.9',
          ...(biscotti.quanti ? { Cookie: biscotti.intestazione() } : {}),
          ...(opts.headers || {}),
        },
      });
    } finally {
      clearTimeout(timer);
    }
    biscotti.raccogli(res);
    percorso.push(`${res.status} ${corrente}`);
    const dove = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && dove && salti < maxSalti) {
      corrente = new URL(dove, corrente).toString();
      salti += 1;
      // Dopo un redirect la richiesta diventa sempre una GET: è il 303 di Joomla
      // dopo il login, e ripostare il modulo qui rifarebbe il login a ogni salto.
      opts = { method: 'GET' };
      continue;
    }
    return { res, percorso };
  }
}

async function corpoLimitato(res: Response) {
  const buf = await res.arrayBuffer();
  const troncato = buf.byteLength > MAX_BYTES;
  const testo = new TextDecoder('utf-8', { fatal: false })
    .decode(troncato ? buf.slice(0, MAX_BYTES) : buf);
  return { testo, byte: buf.byteLength, troncato };
}

// ── Che FORMA ha quello che è tornato ────────────────────────────────────────
// Non «quali campi sono liberi»: quello lo dirà il parser, quando sapremo cosa
// stiamo parsando. Qui si raccolgono solo indizi, e si dichiara ciò che manca.
function radiografia(testo: string, contentType: string) {
  const sembraJson = /json/i.test(contentType) || /^\s*[[{]/.test(testo);
  const conta = (re: RegExp) => (testo.match(re) || []).length;
  const unici = (re: RegExp, max = 25) => [...new Set(testo.match(re) || [])].slice(0, max);
  return {
    contentType,
    sembra: sembraJson ? 'json' : (/<html/i.test(testo) ? 'html' : 'altro'),
    // La domanda che il disegno lascia aperta, in forma di misura.
    haEndpointDati: unici(/(?:index\.php)?\?option=com_[a-z_]+[^"'\s<>]{0,80}/gi, 20),
    citaWansport: conta(/com_wansport/gi),
    // Indizi di calendario: orari, durate, parole dei campi. Servono a capire SE
    // la griglia è nell'HTML o se l'HTML è solo un guscio che la carica dopo.
    oraritrovati: unici(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g, 30),
    quantiOrari: conta(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g),
    paroleCampo: unici(/\b(?:campo|court|pista|sintetico|indoor|outdoor|esterno|coperto)\s*[0-9A-Za-z]{0,12}/gi, 20),
    parolePadel: conta(/padel/gi),
    // ⭐ MISURATO IL 18/08 SU DUE CIRCOLI: `/start` è un GUSCIO. 1,07 MB di HTML con
    // zero orari e zero «padel», e segnaposto di template (`{{hash}}`) al posto dei
    // dati ⇒ la griglia NON è nell'HTML, la disegna il browser dopo aver chiesto i
    // dati a qualcuno. Un parser HTML qui troverebbe una tabella vuota e direbbe
    // «nessun campo libero»: il «no» falso che questo servizio non deve mai dire.
    // ⇒ La domanda non è più «html o json», è DA DOVE PRENDE I DATI. Queste sonde
    //    servono a quello, e non a spolpare la pagina.
    segnapostiTemplate: conta(/\{\{\s*[a-zA-Z_$][\w.$]*\s*\}\}/g),
    // Joomla espone gli endpoint dei componenti come `task=<controller>.<metodo>`:
    // l'unico visto finora è `profilo.downloadModelloDocumento&format=raw`, quindi
    // il calendario quasi certamente vive su un fratello di quella forma.
    tuttiITask: unici(/task=[a-zA-Z][\w.]{2,60}/g, 60),
    formatiRichiesti: unici(/format=[a-z]{3,8}/gi, 10),
    // Tutti i copioni caricati: se la logica sta in un bundle esterno, il prossimo
    // passo è leggere QUELLO, non la pagina.
    copioni: unici(/<script[^>]+src="([^"]+)"/gi, 40),
    // Qualunque cosa somigli a un indirizzo dentro il codice della pagina.
    indirizziNelCodice: unici(/["'](?:\/[a-z0-9._~\-]+){1,4}(?:\.(?:json|php))?(?:\?[^"']{0,80})?["']/gi, 40),
    chiamateAjax: unici(/(?:fetch|ajax|url|open)\s*[:(]\s*['"][^'"]{4,140}['"]/gi, 30),
    // Il pezzo che alla fine si legge con gli occhi. Bounded di proposito.
    assaggio: testo.slice(0, 1500),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return ko('METHOD_NOT_ALLOWED', {}, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !anonKey || !serviceKey) return ko('CONFIG_MANCANTE', {}, 500);

  // ── Guardia: profilo staff attivo. La funzione non espone dati personali, ma
  //    FA USCIRE RICHIESTE verso terzi con l'account del circolo: non è una lettura
  //    qualunque, e non deve poterla innescare chiunque abbia la chiave pubblica.
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return ko('AUTH_REQUIRED', {}, 401);
  const comeUtente = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: utente, error: erroreUtente } = await comeUtente.auth.getUser(token);
  if (erroreUtente || !utente?.user) return ko('AUTH_REQUIRED', {}, 401);
  const { data: profiloRaw } = await comeUtente.rpc('pmo_get_my_staff_profile');
  const profilo = Array.isArray(profiloRaw) ? profiloRaw[0] : profiloRaw;
  if (!profilo || profilo.status !== 'active') return ko('AUTH_REQUIRED', {}, 401);

  let corpo: JsonMap = {};
  try { corpo = await req.json(); } catch { /* corpo vuoto = errore sotto */ }
  const slug = clean(corpo.circolo);
  const azione = clean(corpo.azione) || 'sonda';
  if (!slug) return ko('CIRCOLO_MANCANTE', { dettaglio: 'Serve { circolo: "<slug>" }.' });

  // ⛔ Il parser non esiste ancora, e non si finge. Un «0 campi liberi» qui
  //    sarebbe un «non c'è posto» falso: il servizio nasce per dire il contrario.
  if (azione !== 'sonda') {
    return ko('NON_ANCORA_IMPLEMENTATO', {
      dettaglio: 'Solo azione "sonda". Il parser si scrive dopo aver MISURATO la forma di /start (passo 2b del disegno).',
    }, 501);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: circolo, error: erroreCircolo } = await admin
    .from('pmo_circoli_esterni').select('*').eq('id', slug).maybeSingle();
  if (erroreCircolo) return ko('LETTURA_FALLITA', { dettaglio: erroreCircolo.message }, 500);
  if (!circolo) return ko('CIRCOLO_SCONOSCIUTO', { circolo: slug }, 404);

  // ── Ciò che la tabella non autorizza, non esce di qui ──────────────────────
  // 🔄 Fino al 24/08/2026 qui c'era una guardia che rifiutava `matchpoint` con
  //    `NON_SI_INTERROGA`, e la sua ragione era buona: casa nostra si legge dal
  //    gestionale, che è più fresco (sync ogni 2 minuti) di qualunque sonda.
  //    Il committente ha chiesto di renderlo interrogabile **come gli altri**, e
  //    il motivo regge: questa sezione confronta i circoli fra loro, e due fonti
  //    diverse non si confrontano. La riga vecchia è stata CORRETTA, non
  //    affiancata — la ragione che portava resta scritta in `matchpoint.ts`.
  //    ⚖️ Le due strade non si escludono: per «cosa ho prenotato io» comanda
  //    sempre il gestionale; questa sonda serve al confronto fra circoli.
  if (circolo.piattaforma !== 'wansport' && circolo.piattaforma !== 'matchpoint') {
    return ko('PIATTAFORMA_NON_SUPPORTATA', { piattaforma: circolo.piattaforma, dettaglio: 'Playtomic è ancora da misurare (questione aperta del disegno).' });
  }
  if (!circolo.attivo || circolo.stato_utenza !== 'attiva') {
    return ko('CIRCOLO_FERMO', {
      circolo: slug, attivo: circolo.attivo, stato_utenza: circolo.stato_utenza,
      dettaglio: 'Si interroga solo un circolo con utenza attiva. Insistere su chi ci rifiuta il login è il modo di farsi chiudere l\'account.',
    });
  }
  if (!circolo.base_url) return ko('INDIRIZZO_NON_RILEVATO', { circolo: slug });

  // ④ intervallo minimo
  if (circolo.ultimo_scan_at) {
    const passati = Date.now() - new Date(circolo.ultimo_scan_at).getTime();
    if (passati >= 0 && passati < INTERVALLO_MINIMO_MS) {
      return ko('TROPPO_PRESTO', {
        circolo: slug, attendi_ms: INTERVALLO_MINIMO_MS - passati,
        dettaglio: `Ultima lettura ${Math.round(passati / 3600000)}h fa. Si legge lo stesso circolo UNA VOLTA AL GIORNO: è una scelta di misura verso server che non sono nostri.`,
      }, 429);
    }
  }

  const base = String(circolo.base_url).replace(/\/+$/, '') + '/';
  const biscotti = new Biscotti();
  const t0 = Date.now();
  const tappe: JsonMap[] = [];

  // ── RAMO MATCHPOINT ────────────────────────────────────────────────────────
  // Sta PRIMA dei segreti Wansport perché non ne ha bisogno: la ricerca degli
  // slot su Matchpoint è pubblica (misurato il 24/08/2026, vedi matchpoint.ts).
  // Chiedere qui una credenziale che non serve significherebbe custodirne una in
  // più senza guadagnarci niente.
  if (circolo.piattaforma === 'matchpoint') {
    // Data: quella chiesta, o OGGI a Roma. `sv-SE` dà già `YYYY-MM-DD`, e il
    // fuso va detto: su un server UTC dopo le 22:00 «oggi» sarebbe domani.
    const dataChiesta = clean(corpo.data) || new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
    try {
      const { slot, tappe: tappeMp } = await sondaMatchpoint(
        base, dataChiesta, async (u, o) => (await chiedi(u, o, biscotti)).res,
      );
      tappe.push(...tappeMp);
      const latenza = Date.now() - t0;
      const griglia = grigliaDaSlot(slot);

      // La griglia si scrive solo se c'è: un giorno pieno non deve CANCELLARE
      // quella rilevata ieri, perché «nessuno slot libero» non è «nessun campo».
      await admin.from('pmo_circoli_esterni').update({
        ultimo_scan_at: new Date().toISOString(), ultimo_esito: 'sonda ok',
        ultima_latenza_ms: latenza, updated_at: new Date().toISOString(),
        ...(slot.length ? { slot_minuti: griglia.slotMinuti, apertura: griglia.apertura, chiusura: griglia.chiusura, campi: griglia.campi } : {}),
      }).eq('id', slug);

      return json({
        ok: true, circolo: slug, nome: circolo.nome, azione: 'sonda',
        piattaforma: 'matchpoint', data: dataChiesta, latenza_ms: latenza,
        liberi: slot.length, slot, griglia, tappe,
      });
    } catch (e) {
      const esitoMp = String((e as Error).message || e);
      const latenza = Date.now() - t0;
      await admin.from('pmo_circoli_esterni').update({
        ultimo_scan_at: new Date().toISOString(), ultimo_esito: esitoMp,
        ultima_latenza_ms: latenza, updated_at: new Date().toISOString(),
      }).eq('id', slug);
      // 200 con ok:false, come il ramo Wansport: chi legge deve poter
      // distinguere «non ha risposto» da «non c'è posto».
      return json({ ok: false, error: esitoMp, circolo: slug, nome: circolo.nome, piattaforma: 'matchpoint', data: dataChiesta, latenza_ms: latenza, tappe });
    }
  }

  // ── RAMO WANSPORT ──────────────────────────────────────────────────────────
  const utenteWansport = Deno.env.get('WANSPORT_USER') || '';
  const passwordWansport = Deno.env.get('WANSPORT_PASS') || '';
  if (!utenteWansport || !passwordWansport) {
    // ① disarmata: lo dice, non finge un guasto di rete.
    return json({
      ok: false, error: 'SCANNER_DISARMATO',
      dettaglio: 'Mancano WANSPORT_USER / WANSPORT_PASS nei segreti della funzione. Finché non ci sono, questa funzione non contatta nessun portale.',
      circolo: slug,
    }, 503);
  }

  let esito = 'ok';

  try {
    // ── ① home: cookie di sessione + gettone CSRF ────────────────────────────
    const tA = Date.now();
    const { res: resHome, percorso: pHome } = await chiedi(base, { method: 'GET' }, biscotti);
    const home = await corpoLimitato(resHome);
    const gettone = (home.testo.match(/name="([0-9a-f]{32})"\s+value="1"/i) || [])[1] || '';
    tappe.push({ tappa: 'home', http: resHome.status, ms: Date.now() - tA, byte: home.byte, cookie: biscotti.quanti, gettoneCsrf: gettone ? `${gettone.slice(0, 8)}…` : null, percorso: pHome });
    if (!resHome.ok) throw new Error(`HOME_HTTP_${resHome.status}`);
    if (!gettone) throw new Error('GETTONE_CSRF_NON_TROVATO');

    // ── ② login ──────────────────────────────────────────────────────────────
    const tB = Date.now();
    const modulo = new URLSearchParams({
      username: utenteWansport, password: passwordWansport,
      option: 'com_users', task: 'user.login',
      return: 'aW5kZXgucGhw',   // base64 di "index.php", come nel modulo vero
      [gettone]: '1',
    });
    const { res: resLogin, percorso: pLogin } = await chiedi(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: modulo.toString(),
    }, biscotti);
    const dopoLogin = await corpoLimitato(resLogin);
    // Joomla risponde 200 anche quando RIFIUTA: il verdetto sta nella pagina,
    // non nel codice HTTP. Cercare solo l'HTTP sarebbe la sonda che guarda nel
    // cassetto sbagliato.
    const rifiutato = /nome utente e la password|username and password|non (?:sei|è) autorizzat|login failed|credenziali/i.test(dopoLogin.testo);
    const sembraDentro = /logout|esci|com_wansport|area\s*(?:riservata|personale)/i.test(dopoLogin.testo);
    tappe.push({ tappa: 'login', http: resLogin.status, ms: Date.now() - tB, byte: dopoLogin.byte, cookie: biscotti.quanti, rifiutato, sembraDentro, percorso: pLogin });
    if (rifiutato) throw new Error('LOGIN_RIFIUTATO');

    // ── ③ area giocatore ─────────────────────────────────────────────────────
    const tC = Date.now();
    const { res: resStart, percorso: pStart } = await chiedi(new URL('start', base).toString(), { method: 'GET' }, biscotti);
    const start = await corpoLimitato(resStart);
    const rx = radiografia(start.testo, resStart.headers.get('content-type') || '');
    // Se /start ci ributta al login, il login NON è riuscito: dirlo qui evita di
    // consegnare una radiografia della pagina sbagliata come se fosse il calendario.
    const ributtatoFuori = /name="password"/i.test(start.testo) && !rx.citaWansport;
    tappe.push({ tappa: 'start', http: resStart.status, ms: Date.now() - tC, byte: start.byte, troncato: start.troncato, ributtatoFuori, percorso: pStart });
    if (ributtatoFuori) throw new Error('START_CHIEDE_ANCORA_IL_LOGIN');

    const latenza = Date.now() - t0;
    await admin.from('pmo_circoli_esterni').update({
      ultimo_scan_at: new Date().toISOString(), ultimo_esito: 'sonda ok', ultima_latenza_ms: latenza, updated_at: new Date().toISOString(),
    }).eq('id', slug);

    return json({
      ok: true, circolo: slug, nome: circolo.nome, azione: 'sonda',
      latenza_ms: latenza, tappe,
      radiografia: rx,
      // Ciò che questa risposta NON dice, detto dalla risposta stessa.
      avvertenza: 'Questa è una MISURA della forma di /start, non una lettura dei campi liberi. Il parser si scrive dopo aver letto questa radiografia (passo 2b).',
    });
  } catch (err) {
    esito = (err as Error)?.message || String(err);
    const latenza = Date.now() - t0;
    await admin.from('pmo_circoli_esterni').update({
      ultimo_scan_at: new Date().toISOString(), ultimo_esito: esito, ultima_latenza_ms: latenza, updated_at: new Date().toISOString(),
    }).eq('id', slug);
    // Un guasto si DICHIARA: 200 con ok:false, così la sezione può distinguere
    // «non ha risposto» da «non c'è posto» — che è la regola della freschezza.
    return json({ ok: false, error: esito, circolo: slug, nome: circolo.nome, latenza_ms: latenza, tappe });
  }
});
