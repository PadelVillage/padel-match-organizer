import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// assessment-quiz — IL CANCELLO DI CONOSCENZA, spostato dal telefono al server.
//
// 🚨 IL BUCO CHE CHIUDE (voce 27, punti 1-2-3). Fino a oggi il test di livello si correggeva
// NEL BROWSER: la banca delle domande — risposte comprese — stava dentro `index.html`, che è
// il file che si scarica per fare il test. Il telefono pescava, correggeva, decideva l'esito
// e poi scriveva LUI la riga in `self_assessments` (tre policy di INSERT anonimo a
// `WITH CHECK (true)`), e il cron `assessment-apply-level` la applicava entro 15 minuti.
// ⇒ Chi aveva il proprio link poteva **darsi il livello che voleva**. Il muro «senza livello
// non si organizza» non si superava: si scavalcava.
// Il codice lo sapeva già di sé, nel commento sopra la banca: *«la pagina è statica, quindi le
// risposte stanno nel sorgente… in Fase 2 il bot correggerà da server e nemmeno quello resterà
// visibile»*. Questa funzione è quella Fase 2, per la sola parte che serviva davvero.
//
// ⭐ LA BANCA È STATA SPOSTATA, NON COPIATA. È la differenza fra chiudere il buco e aggiungere
// un giro: se le domande restassero anche in `index.html`, le risposte resterebbero pubbliche
// e tutto questo non servirebbe a niente. Vive fra le sentinelle ASSESS-KNOWLEDGE SHARED, e
// `test/autovalutazione-conoscenza.test.mjs` la **estrae da QUI** ed esegue il blocco vero.
//
// 🎲 PERCHÉ LE DOMANDE SI RIPESCANO INVECE DI SALVARLE. La correzione deve sapere quali domande
// erano state fatte. Farsele rimandare dal telefono rimetterebbe il coltello dalla parte del
// manico — bastava dichiarare «zero domande pescate» per ottenere `skip`, o una fascia senza
// cancello per ottenere `pass`. Salvarle vorrebbe una colonna nuova e una riga di stato da
// tenere pulita. ⇒ Si pescano DUE VOLTE con lo stesso seme, che è il gettone del socio: stesso
// gettone e stessa fascia ⇒ stesse quattro domande, senza salvare niente. Il telefono non ha
// voce in capitolo su quali fossero.
// ⚠️ Cambiare fascia cambia le domande, ed è giusto: la scheda le ridisegna già a ogni cambio.
//
// 🔑 AUTENTICAZIONE: nessun secret. Il gate è il **gettone stesso**, che è la credenziale del
// socio — questa funzione la chiama il telefono di chi fa il test, non un ponte. Si deploya con
// --no-verify-jwt come le altre pubbliche. Un gettone sconosciuto, già usato o scaduto non
// ottiene domande e non scrive niente.
// ⏳ E qui vive il PUNTO 3 della voce 27: `expires_at` finora non lo leggeva nessuno. Adesso sì.
//
// ✍️ SCRITTURE, con la chiave di servizio: una riga in `self_assessments` e il gettone portato a
// `completed`. Sono le stesse due scritture che prima faceva il browser — cambia chi le fa e su
// che base. ⛔ Nessuna scrittura verso Matchpoint: qui non c'entra il recinto delle `matchpoint-*`.

type JsonMap = Record<string, unknown>;

/* La forma di una domanda pescata. Vive QUI e non in `conoscenza.js` perché di là il tipo non
   si può scrivere — è JavaScript apposta, per poter girare nel banco. ⇒ Il confine fra i due
   file è anche il confine fra «codice che il banco esegue» e «codice che il compilatore
   controlla», e ognuno dei due dichiara ciò che sa dichiarare. */
type Domanda = { id: string; fascia: string; trap: boolean; q: string; opts: string[] };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

import {
  ASSESS_KNOWLEDGE_BANK,
  PMO_LIVELLI,
  assessKey,
  assessKnowledgeEvaluate,
  assessKnowledgeFasciaFor,
  assessKnowledgePick,
  assessKnowledgeRegole,
  assessKnowledgeShuffle,
  assessTxt,
  assessmentPublicParseLevel,
  assessmentPublicScoreFromText,
  assessmentPublicTechnicalScores,
  calculateAssessmentPublicLevel,
  cleanCell,
  fasciaDaLivello,
  normalizeText,
  numero,
  pescaPerGettone,
  pmoLivelloDefinizione,
  pmoLivelloFascia,
  roundAssessmentToHalf,
  seme,
  sorteDa,
} from './conoscenza.js';

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

/* Il tipo del client si prende da CHI lo fabbrica, non riscrivendo `ReturnType<typeof
   createClient>`: quella forma risolve con parametri generici diversi da quelli del client
   vero, e `deno check` la respinge — «SupabaseClient<any,…> non assegnabile a
   SupabaseClient<unknown,…>». Legandolo a `servizio()` combaciano per costruzione. */
type Db = NonNullable<ReturnType<typeof servizio>>;

function servizio() {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Il gettone, e i tre modi in cui può non valere. Il verso del dubbio è sempre «no». */
async function gettoneValido(db: Db, token: string) {
  const { data, error } = await db
    .from('assessment_tokens')
    // 🚨 SOLO colonne che esistono su ENTRAMBI i progetti. Misurato il 14/08 dopo che questa
    // riga ha fatto fallire la prima prova su TEST: `member_email` c'è su `qqbf…` e NON su
    // `cudi…`. Le due tabelle sono divergenti, come lo erano le funzioni SQL della voce 33 —
    // solo che di questa divergenza non lo sapeva nessuno. Scrivere una query guardando un
    // solo database è scrivere metà query.
    .select('token, member_local_id, member_name, phone_last4, status, expires_at')
    .eq('token', token)
    .maybeSingle();
  /* 🔢 Il client non conosce lo schema, quindi PostgREST risolve la `select` a `never` e
     leggere `data.status` è un errore di tipo. La forma la dichiariamo noi, qui, una volta:
     è la stessa lista di colonne della `select` qui sopra — se una cambia, cambiano entrambe. */
  const riga = data as
    | { token: string; member_local_id: string | null; member_name: string | null;
        phone_last4: string | null; status: string; expires_at: string | null }
    | null;
  if (error) {
    // Il motivo VERO nel log della funzione: al socio si dice una cosa comprensibile, ma chi
    // deve capire perché non deve ripartire da «Failed to fetch». È il buco di diagnosi che
    // ha fatto perdere il primo giro di prove.
    console.error('assessment-quiz: lettura gettone fallita —', error.message, error.details ?? '');
    return { errore: err(500, 'LETTURA_FALLITA', 'Non riesco a leggere il gettone.') };
  }
  if (!riga) return { errore: err(404, 'GETTONE_SCONOSCIUTO', 'Questo link non risulta valido.') };
  if (riga.status === 'completed') {
    return { errore: err(409, 'GIA_COMPILATA', 'Questa scheda risulta già compilata.') };
  }
  // ⏳ PUNTO 3 della voce 27: la scadenza, che prima non leggeva nessuno.
  if (riga.expires_at && new Date(String(riga.expires_at)).getTime() < Date.now()) {
    return { errore: err(410, 'GETTONE_SCADUTO', 'Questo link è scaduto: chiedi in segreteria.') };
  }
  return { riga };
}

/* 🔐 LA SECONDA PORTA: la sessione dello STAFF.
   L'anteprima del gestionale — «prova il test» — non ha un gettone di socio, ma le domande
   e la correzione le servono lo stesso. Aprirle senza gate sarebbe peggio che lasciarle in
   `index.html`: quattro domande da quattro opzioni fanno **256 combinazioni**, e un oracolo
   che risponde «giusto/sbagliato» le svela in pochi secondi — a chiunque, non solo allo staff.
   ⇒ Le azioni `staff-*` vogliono un JWT vero, verificato qui contro Supabase.
   📌 La chiave pubblicabile NON passa questo controllo: è un JWT senza utente dietro. */
async function staffValido(db: Db, req: Request): Promise<boolean> {
  const intestazione = req.headers.get('Authorization') || '';
  const jwt = intestazione.startsWith('Bearer ') ? intestazione.slice(7).trim() : '';
  if (!jwt) return false;
  try {
    const { data, error } = await db.auth.getUser(jwt);
    return !error && !!data?.user?.id;
  } catch {
    return false;
  }
}

/* 🚨 LA RETE SOTTO TUTTO — nata dal guasto del 14/08, e vale più del guasto.
   Un'eccezione non catturata la risponde il RUNTIME, non questa funzione: 500 senza le
   intestazioni CORS ⇒ il browser non vede l'errore, vede il CORS che salta, e dice
   «Failed to fetch». Cioè: il nulla. Ci sono voluti tre giri di prove per arrivare a un
   `ReferenceError` che il server conosceva dal primo istante.
   ⇒ Da qui in poi QUALSIASI cosa vada storta esce come JSON con CORS, e il motivo vero
   finisce nel log. Un errore che si sa leggere vale più di un errore che non capita. */
Deno.serve(async (req: Request) => {
  try {
    return await gestisci(req);
  } catch (e) {
    console.error('assessment-quiz: eccezione non prevista —', (e as Error)?.stack || String(e));
    return err(500, 'GUASTO_INTERNO', 'Qualcosa è andato storto. Riprova, o scrivi in segreteria.');
  }
});

async function gestisci(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return err(405, 'METODO', 'Solo POST.');

  const db = servizio();
  if (!db) return err(503, 'NON_CONFIGURATA', 'Manca la chiave di servizio.');

  let corpo: JsonMap;
  try { corpo = await req.json(); } catch { return err(400, 'CORPO', 'Corpo non leggibile.'); }

  const azione = assessTxt(corpo.azione);

  // ── Le azioni dello STAFF: nessun gettone, ma una sessione vera. Non scrivono niente. ──
  if (azione === 'staff-pesca' || azione === 'staff-valuta') {
    if (!await staffValido(db, req)) {
      return err(401, 'NON_AUTORIZZATO', 'Serve una sessione staff.');
    }
    // Il seme lo sceglie il SERVER e torna opaco: il telefono non decide le domande, e alla
    // valutazione le ripesca identiche senza che nessuno abbia salvato niente.
    const fascia = fasciaDaLivello(
      azione === 'staff-pesca' ? corpo.livello_dichiarato : (corpo.scheda as JsonMap)?.declaredLevel,
    );
    const semeStaff = assessTxt(corpo.seme) || crypto.randomUUID();
    const pescate = fascia ? assessKnowledgePick(fascia, sorteDa(seme(semeStaff, assessTxt(fascia)))) : [];

    if (azione === 'staff-pesca') {
      return ok({
        seme: semeStaff,
        fascia,
        cancello: !!fascia && assessKnowledgeRegole(fascia).cancello,
        domande: pescate.map((d: Domanda) => ({ id: d.id, fascia: d.fascia, q: d.q, opts: d.opts })),
      });
    }
    const scheda = (corpo.scheda ?? {}) as JsonMap;
    return ok({
      conoscenza: assessKnowledgeEvaluate(
        pescate.map((d: Domanda) => d.id), (corpo.risposte ?? {}) as Record<string, string>, fascia,
      ),
      livello: calculateAssessmentPublicLevel(scheda),
    });
  }

  const token = assessTxt(corpo.token);
  if (!token) return err(400, 'GETTONE_MANCANTE', 'Manca il gettone.');

  const g = await gettoneValido(db, token);
  if (g.errore) return g.errore;

  // ── PESCA: le domande, SENZA la risposta giusta ──────────────────────────────────────
  if (azione === 'pesca') {
    const fascia = fasciaDaLivello(corpo.livello_dichiarato);
    const regole = assessKnowledgeRegole(fascia);
    // 🚨 `opts` esce così com'è; `correct` non compare da nessuna parte in questa risposta.
    // È l'intero motivo per cui questa funzione esiste: la risposta giusta non attraversa
    // più la rete verso il telefono.
    const domande = fascia ? pescaPerGettone(token, fascia).map((d: Domanda) => ({
      id: d.id, fascia: d.fascia, q: d.q, opts: d.opts,
    })) : [];
    return ok({ fascia, cancello: !!fascia && regole.cancello, domande });
  }

  // ── CONSEGNA: si corregge qui, si decide qui, si scrive qui ──────────────────────────
  if (azione === 'consegna') {
    const scheda = (corpo.scheda ?? {}) as JsonMap;
    const risposte = (corpo.risposte ?? {}) as Record<string, string>;

    const livCalc = calculateAssessmentPublicLevel(scheda);
    const fascia = fasciaDaLivello(scheda.declaredLevel);
    // 🚨 Gli id NON arrivano dal telefono: si ripescano. Vedi il perché in testa al file.
    const pescate = fascia ? pescaPerGettone(token, fascia) : [];
    const conoscenza = assessKnowledgeEvaluate(pescate.map((d: Domanda) => d.id), risposte, fascia);

    const genere = assessTxt(scheda.gender) || 'NA';
    const dichiarato = parseFloat(assessmentPublicParseLevel(scheda.declaredLevel));
    const pocaEsperienza = Number.isFinite(dichiarato) && dichiarato >= 3.0
      && ['Meno di 1 mese', '1-3 mesi', '3-6 mesi', '6-12 mesi']
        .some((v) => assessKey(v) === assessKey(scheda.experience));
    // Il cancello: senza conoscenza dimostrata la scheda non si applica da sola.
    const statoStaff = (genere === 'NA' || conoscenza.status !== 'pass' || pocaEsperienza)
      ? 'review' : livCalc.staff_status;

    const riga = {
      token,
      first_name: assessTxt(scheda.first_name) || null,
      last_name: assessTxt(scheda.last_name) || null,
      phone: assessTxt(scheda.phone) || null,
      // ⛔ NIENTE `email`: la colonna c'è su PROD e NON su TEST (misurato il 14/08). Per la
      // strada col gettone non si perde nulla — là l'indirizzo era sempre vuoto, lo riempiva
      // solo il link esterno, che questa strada non la fa. 🔗 Stessa ragione per cui mancano
      // `consistency_score`, `inconsistency_reasons` e `review_note`: non le scriviamo, e su
      // TEST non esistono. La riga è l'INTERSEZIONE dei due schemi, per costruzione.
      experience: assessTxt(scheda.experience) || null,
      monthly_frequency: assessTxt(scheda.monthly_frequency) || null,
      basic_strokes: assessTxt(scheda.basic_strokes) || null,
      glass_usage: assessTxt(scheda.glass_usage) || null,
      net_play: assessTxt(scheda.net_play) || null,
      positioning: assessTxt(scheda.positioning) || null,
      rally_patience: assessTxt(scheda.rally_patience) || null,
      competitions: assessTxt(scheda.competitions) || null,
      wants_matches: assessTxt(scheda.wants_matches) || null,
      preferred_days: assessTxt(scheda.preferred_days) || null,
      preferred_hours: assessTxt(scheda.preferred_hours) || null,
      availability_time: assessTxt(scheda.availability_time) || null,
      desired_frequency: assessTxt(scheda.desired_frequency) || null,
      notice: assessTxt(scheda.notice) || null,
      preferred_match_type: assessTxt(scheda.preferred_match_type) || null,
      notes: assessTxt(scheda.notes) || null,
      // 🚨 TUTTI e cinque passano da `numero`, non solo quello che mi era capitato vuoto.
      declared_level: numero(dichiarato),
      calculated_level: numero(livCalc.calculated_level),
      balanced_level: numero(livCalc.balanced_level),
      technical_average: numero(livCalc.technical_average),
      raw_score: numero(livCalc.raw_score),
      consistency_status: livCalc.coherence,
      staff_status: statoStaff,
      raw_response: {
        ...scheda,
        knowledge: conoscenza,
        experience_flag: pocaEsperienza,
        calculation_note: livCalc.note,
        technical_scores: livCalc.technical_scores,
        corretta_dal_server: true,
      },
    };

    const { error: eIns } = await db
      .from('self_assessments')
      .upsert(riga, { onConflict: 'token' });
    if (eIns) {
      console.error('assessment-quiz: scrittura scheda fallita —', eIns.message, eIns.details ?? '');
      return err(500, 'SCRITTURA_FALLITA', 'Non riesco a salvare la scheda.');
    }

    // Il gettone si brucia DOPO la scrittura: se il salvataggio fallisse, il socio deve poter
    // riprovare. L'ordine inverso lo lascerebbe fuori con la scheda persa.
    await db.from('assessment_tokens')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('token', token);

    // Al telefono torna l'ESITO, non il come: né le risposte giuste né le soglie.
    return ok({
      esito: conoscenza.status,
      staff_status: statoStaff,
      livello: livCalc.calculated_level,
    });
  }

  return err(400, 'AZIONE', 'Azione non riconosciuta.');
}
