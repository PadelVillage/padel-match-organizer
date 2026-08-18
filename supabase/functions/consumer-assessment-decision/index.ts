import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  TENTATIVI_PER_GIRO,
  SCELTA_MI_FERMO,
  SCELTA_RIPROVO,
  esitoDellaProva,
  quandoMs,
  laProvaEsaurisceIlGiro,
} from './giro-del-test.ts';

// consumer-assessment-decision — LA RISPOSTA DEL SOCIO alla domanda «ti fermi o riprovi?»,
// per il bot dei soci. Voce 61 § A ④ (19/08/2026).
//
// 🗣️ Nasce dalla sua regola del 17/08: *«decidi tu a quale delle tre volte ti vuoi
// fermare»*. Fino a oggi il livello lo applicava un automatismo da sé
// (`assessment-apply-level`, cron ogni 15′) — nessuno chiedeva niente al socio, e la
// risposta non aveva nemmeno una strada per arrivare. QUESTA è quella strada: il bot fa la
// domanda, il socio tocca un bottone, e la scelta atterra dove vive la verità — sulla
// scheda, nel gestionale. È la divisione di sempre: **il gestionale SA, il bot DICE** — la
// scelta è un fatto sulla scheda del socio, non un ricordo del bot, che si riavvia e
// dimentica.
//
// SCRITTURA, ed è l'unica: `member_decision` e `member_decision_at` sulla scheda
// (`self_assessments`). Non entra nel RECINTO delle scritture al circolo per lo stesso
// motivo di `consumer-assessment-link`: qui si scrive in una tabella NOSTRA, e ogni
// ambiente scrive sulla propria — TEST su `cudi…`, PROD su `qqbf…`.
//
// 🚨 COSA RIFIUTA, e perché ogni rifiuto esiste (la regola pura è `motivoDelRifiuto`,
// provata da `test/consumer-assessment-decision.test.mjs`):
//   · una scelta che non è «mi fermo» né «riprovo» — qui non si inventano scelte;
//   · una scheda che non è del socio, o che non esiste: rifiuto UGUALE nei due casi,
//     per non far scoprire a nessuno le schede degli altri;
//   · una prova senza il cancello `pass`: su una bocciatura non c'è un livello da
//     tenere — «riprovare» dopo una bocciatura si fa RIFACENDO il test, non scrivendo
//     una scelta;
//   · una scheda già applicata: la scelta è arrivata dopo i fatti;
//   · una scheda SUPERATA da una prova più recente: il socio ha già riprovato coi
//     fatti, e una scelta sul passato riscriverebbe la storia del giro — il bottone
//     vecchio di Telegram resta lì per sempre, e schiacciarlo non deve poter niente;
//   · la prova che ESAURISCE il giro (la terza): lì non c'è una domanda — il suo
//     esito si applica da solo, e una scelta registrata lì potrebbe solo bloccarlo.
//
// ⚖️ La scelta si può CAMBIARE finché è viva (non applicata, non superata): l'ultima
// parola vince. «Mi fermo» e poi «riprovo» dieci minuti dopo è un ripensamento, non un
// guasto — i fatti (l'applicazione del cron, una prova nuova) la congelano da soli.
//
// Autenticazione: come gli altri ponti, la CI deploya con --no-verify-jwt e il gate è
// l'header X-Consumer-Secret confrontato in tempo costante con CONSUMER_BRIDGE_SECRET.
// Secret assente in env → 503, funzione disarmata.

type JsonMap = Record<string, unknown>;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-consumer-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
function ok(body: JsonMap) { return json({ ok: true, ...body }); }
function err(status: number, code: string, message: string) {
  return json({ ok: false, error: code, message }, status);
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

// Confronto in tempo costante: il secret è l'unico gate della funzione.
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

// ── LA REGOLA, in JavaScript nudo (`: any`) per il banco ─────────────────────────────────
// Torna '' se la scelta è ammissibile, altrimenti il CODICE del rifiuto — sempre uno dei
// sei qui sopra, mai una frase: le frasi stanno in `RIFIUTI`, accanto allo status HTTP,
// così il bot riconosce il caso dal codice e la persona lo capisce dal messaggio.
// `schedeDelSocio` sono le schede di QUEL socio (questa compresa), la stessa lettura che
// fa il ponte del link: il giro è lo stesso fatto guardato da tre funzioni, e la camminata
// sta in `giro-del-test.ts`, in copia identica qui accanto.
function motivoDelRifiuto(scelta: any, scheda: any, schedeDelSocio: any) {
  const cosa = String(scelta ?? '').trim();
  if (cosa !== SCELTA_MI_FERMO && cosa !== SCELTA_RIPROVO) return 'SCELTA_SCONOSCIUTA';
  if (!scheda) return 'SCHEDA_NON_TROVATA';
  if (esitoDellaProva(scheda) !== 'pass') return 'PROVA_NON_PASSATA';
  if (String((scheda || {}).applied_at ?? '').trim() !== '') return 'GIA_APPLICATA';
  const quandoScheda = quandoMs((scheda || {}).submitted_at);
  const elenco = Array.isArray(schedeDelSocio) ? schedeDelSocio : [];
  for (const s of elenco) {
    const e = esitoDellaProva(s);
    if ((e === 'pass' || e === 'fail') && quandoMs(s?.submitted_at) > quandoScheda) return 'SCHEDA_SUPERATA';
  }
  if (laProvaEsaurisceIlGiro(elenco, scheda, TENTATIVI_PER_GIRO)) return 'GIRO_FINITO';
  return '';
}

const RIFIUTI: Record<string, { stato: number; frase: string }> = {
  SCELTA_SCONOSCIUTA: { stato: 400, frase: 'La scelta può essere solo «mi_fermo» o «riprovo».' },
  SCHEDA_NON_TROVATA: { stato: 404, frase: 'Nessuna scheda di questo socio con questo gettone.' },
  PROVA_NON_PASSATA: { stato: 409, frase: 'Questa prova non ha superato il quiz: non c\'è un livello da tenere. Per riprovare si rifà il test.' },
  GIA_APPLICATA: { stato: 409, frase: 'Il livello di questa prova è già stato applicato: la scelta è arrivata dopo i fatti.' },
  SCHEDA_SUPERATA: { stato: 409, frase: 'C\'è una prova più recente: la scelta si fa sull\'ultima, non sul passato.' },
  GIRO_FINITO: { stato: 409, frase: 'Questa era l\'ultima prova del giro: il suo esito si applica da solo, non c\'è niente da scegliere.' },
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return err(405, 'METHOD_NOT_ALLOWED', 'Usare POST.');
  }

  const bridgeSecret = clean(Deno.env.get('CONSUMER_BRIDGE_SECRET'));
  if (!bridgeSecret) {
    return err(503, 'BRIDGE_DISARMED', 'CONSUMER_BRIDGE_SECRET non configurato.');
  }
  const provided = clean(req.headers.get('x-consumer-secret'));
  if (!provided || !safeEqual(provided, bridgeSecret)) {
    return err(401, 'UNAUTHORIZED', 'X-Consumer-Secret assente o non valido.');
  }

  let body: JsonMap;
  try {
    body = (await req.json()) as JsonMap;
  } catch {
    return err(400, 'BAD_JSON', 'Corpo della richiesta non leggibile.');
  }

  // L'id è quello dell'APP (`payload.id`), lo stesso che usano readmodel e link: il bot ce
  // l'ha già in mano quando arriva qui. Il gettone dice QUALE prova; l'id dice DI CHI, e i
  // due devono combaciare — il gettone da solo basterebbe a trovare la scheda, ma una
  // scelta scritta su fede del solo gettone permetterebbe a un client confuso di decidere
  // per la persona sbagliata.
  const memberId = clean(body.member_id ?? body.memberId);
  if (!memberId) {
    return err(400, 'MEMBER_ID_REQUIRED', 'Serve member_id (l\'id del socio nel gestionale).');
  }
  const token = clean(body.token);
  if (!token) {
    return err(400, 'TOKEN_REQUIRED', 'Serve il gettone della prova su cui si sceglie.');
  }
  const scelta = clean(body.scelta);

  const db = createClient(
    clean(Deno.env.get('SUPABASE_URL')),
    clean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')),
    { auth: { persistSession: false } },
  );

  // Il gettone deve essere SUO: mismatch e gettone inesistente rispondono uguale
  // (vedi l'intestazione — non si fanno scoprire le schede degli altri).
  const { data: gettone, error: erroreGettone } = await db
    .from('assessment_tokens')
    .select('token, member_local_id')
    .eq('token', token)
    .limit(1);
  if (erroreGettone) {
    return err(500, 'DB_ERROR', `Lettura del gettone non riuscita: ${erroreGettone.message}`);
  }
  if (!gettone?.length || clean((gettone[0] as JsonMap).member_local_id) !== memberId) {
    const r = RIFIUTI.SCHEDA_NON_TROVATA;
    return err(r.stato, 'SCHEDA_NON_TROVATA', r.frase);
  }

  // La scheda di quel gettone. Due schede sullo stesso gettone non dovrebbero esistere
  // (il gettone completato non si riusa): se succede NON si sceglie a caso — stessa
  // difesa dell'ambiguità sul socio nel readmodel e nel link.
  const { data: schede, error: erroreScheda } = await db
    .from('self_assessments')
    .select('id, token, submitted_at, raw_response, applied_at, member_decision, member_decision_at')
    .eq('token', token)
    .order('submitted_at', { ascending: false })
    .limit(2);
  if (erroreScheda) {
    return err(500, 'DB_ERROR', `Lettura della scheda non riuscita: ${erroreScheda.message}`);
  }
  if ((schede?.length ?? 0) > 1) {
    return err(409, 'AMBIGUA', 'Più di una scheda su questo gettone: non scelgo.');
  }
  const scheda = (schede?.[0] ?? null) as JsonMap | null;

  // Tutte le schede del socio, per il confronto «superata?» e per il giro: la stessa
  // strada del link — i gettoni sono il filo fra la persona e le schede.
  let elencoSchede: JsonMap[] = [];
  const { data: gettoniSuoi, error: erroreElenco } = await db
    .from('assessment_tokens')
    .select('token')
    .eq('member_local_id', memberId);
  if (erroreElenco) {
    return err(500, 'DB_ERROR', `Lettura dei gettoni non riuscita: ${erroreElenco.message}`);
  }
  // ⚠️ `r` annotato di proposito: il gate `typecheck-edge-functions` è differenziale ma
  // pretende che una funzione NUOVA nasca pulita, e senza il tipo esplicito `deno check`
  // in `strict` alza un TS7006 (implicit any). Il ponte del link ha la stessa riga senza
  // annotazione: è uno dei suoi errori preesistenti, che il cricchetto tollera solo perché
  // è più vecchio della guardia.
  const suoi = (gettoniSuoi ?? []).map((r: JsonMap) => clean(r.token)).filter(Boolean);
  if (suoi.length) {
    const { data: tutte, error: erroreTutte } = await db
      .from('self_assessments')
      .select('token, submitted_at, raw_response, member_decision, member_decision_at')
      .in('token', suoi)
      .order('submitted_at', { ascending: false })
      .limit(20);
    if (erroreTutte) {
      return err(500, 'DB_ERROR', `Lettura delle schede non riuscita: ${erroreTutte.message}`);
    }
    elencoSchede = (tutte ?? []) as JsonMap[];
  }

  const rifiuto = motivoDelRifiuto(scelta, scheda, elencoSchede);
  if (rifiuto) {
    const r = RIFIUTI[rifiuto] ?? { stato: 400, frase: rifiuto };
    return err(r.stato, rifiuto, r.frase);
  }

  const precedente = clean(scheda!.member_decision);
  const adesso = new Date().toISOString();
  const { error: erroreScrittura } = await db
    .from('self_assessments')
    .update({ member_decision: scelta, member_decision_at: adesso, updated_at: adesso })
    .eq('id', clean(scheda!.id));
  if (erroreScrittura) {
    return err(500, 'DB_ERROR', `Scrittura della scelta non riuscita: ${erroreScrittura.message}`);
  }

  // ⚖️ Cosa NON si promette qui: quando il livello sarà scritto. Lo applica il cron di
  // `assessment-apply-level` (ogni 15′ su PROD), e il bot lo racconta col campo
  // `livello_applicato` del link — un «fatto» detto prima dei fatti è il difetto del
  // 9/08 (l'email che dichiarava aggiornato un livello che non lo era).
  return ok({
    scelta,
    registrata_il: adesso,
    scelta_precedente: precedente || null,
    cambiata: precedente !== '' && precedente !== scelta,
  });
});
