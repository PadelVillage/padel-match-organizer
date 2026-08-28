import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  SCELTA_MI_FERMO,
  SCELTA_RIPROVO,
  SCELTA_SCENDO,
  esitoDellaProva,
  gradinoOfferto,
  quandoMs,
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
function motivoDelRifiuto(scelta: any, scheda: any, schedeDelSocio: any, gradino: any) {
  const cosa = String(scelta ?? '').trim();
  if (cosa !== SCELTA_MI_FERMO && cosa !== SCELTA_RIPROVO && cosa !== SCELTA_SCENDO) return 'SCELTA_SCONOSCIUTA';
  if (!scheda) return 'SCHEDA_NON_TROVATA';
  /* 🆕🗣️⭐⭐ 27/08/2026 sera — LA TERZA SCELTA: «va bene, prendo il gradino». Sua regola —
     *«non dobbiamo ferire l'orgoglio del giocatore: possiamo proporgli di scendere di un
     gradino, o di rimanere al livello dell'ultimo test fatto, oppure di rifare il test»*.
     ⚖️ È l'unica delle tre che SCRIVE un livello, e l'unica che può scriverne uno più basso:
     per questo il gradino non lo decide questa funzione né il bot, lo calcola il modulo del
     giro (`gradinoOfferto`) dalla prova e dal livello che il socio ha in anagrafica. Qui si
     controlla soltanto che ci sia — un «scendo» su una prova che non offre niente è un
     bottone vecchio schiacciato tardi, e va rifiutato come tutti gli altri.
     🔒 Il gradino arriva già calcolato da chi chiama: questa funzione resta una REGOLA PURA,
     senza letture, ed è ciò che permette al banco di provarla senza database. */
  if (cosa === SCELTA_SCENDO && !String(gradino ?? '').trim()) return 'NIENTE_DA_SCENDERE';
  /* 🔄🗣️⭐⭐ 27/08/2026 — «MI FERMO» VALE ANCHE SU UNA PROVA NON RIUSCITA. Sua segnalazione,
     con lo schermo davanti: *«manca il bottone che mi lascia il livello come per il precedente»*.
     🚨 Il difetto e il perché era stato fatto così: sotto una prova con l'incongruenza il bot
     scriveva il «no» come **una riga di testo**, non come bottone, e la ragione dichiarata il
     26/08 era buona — *«qui non è stato scritto nessun livello, quindi mi tengo quello che ho
     non è un gesto, è l'assenza di un gesto; un bottone che non cambia niente direbbe al socio
     che una decisione è stata registrata mentre il gestionale non ne saprebbe nulla»*.
     ⇒ La cura non è dare un bottone finto: è **rendere vero il gesto**. Da qui in poi un «mi
     fermo» su una prova non riuscita è un FATTO che il gestionale registra — *ho letto, mi
     tengo il livello che ho, non richiedermelo* — con data e autore, come tutti gli altri.
     ⚖️ E non può scrivere nessun livello, che è ciò che lo rende sicuro: `assessment-apply-level`
     ferma le schede col quiz non superato **prima** di guardare la scelta del socio
     (`test di conoscenza non superato`), e quelle incoerenti subito dopo. Il gesto chiude la
     domanda, non apre una scrittura.
     📌 *Un bottone che non ha un fatto dietro non si aggiunge: gli si dà un fatto, oppure resta
     una riga di testo.*
     ⛔ Il «riprovo», invece, su una prova non riuscita resta rifiutato: lì non c'è niente da
     scartare — rifare il test è una cosa che si fa dal link, non una scelta da registrare. */
  const esito = esitoDellaProva(scheda);
  const provaSuperata = esito === 'pass';
  /* ⛔ E vale sulla BOCCIATA, non su `skip`: a Semi-Pro e Professionista il quiz non viene
     nemmeno posto, il bot non fa loro nessuna domanda e non mostra nessun bottone — accettare
     lì un «mi fermo» vorrebbe dire registrare una risposta a una domanda mai fatta. */
  /* 🔄 27/08 sera — e sulla BOCCIATA passa anche «scendo»: è proprio lì che serve di più.
     📏 Misurato quel giorno: delle 6 prove bocciate di sempre, ZERO hanno prodotto un livello
     — sei soci rimasti dov'erano, quasi tutti a 0,5. Il gradino è la strada che a quei sei
     mancava. ⛔ Il «riprovo» resta fuori come prima: rifare il test si fa dal link, non
     registrando una scelta. */
  if (!provaSuperata && !((cosa === SCELTA_MI_FERMO || cosa === SCELTA_SCENDO) && esito === 'fail')) return 'PROVA_NON_PASSATA';
  if (String((scheda || {}).applied_at ?? '').trim() !== '') return 'GIA_APPLICATA';
  const quandoScheda = quandoMs((scheda || {}).submitted_at);
  const elenco = Array.isArray(schedeDelSocio) ? schedeDelSocio : [];
  for (const s of elenco) {
    const e = esitoDellaProva(s);
    if ((e === 'pass' || e === 'fail') && quandoMs(s?.submitted_at) > quandoScheda) return 'SCHEDA_SUPERATA';
  }
  /* 🔄🚨⭐⭐ 27/08/2026 — VIA IL RIFIUTO `GIRO_FINITO`, gemello della riga tolta oggi in
     `consumer-assessment-link` (il vincolo del giro su `puo_scegliere`): le due si cambiano
     INSIEME, o il bot mostra due bottoni che questo ponte rifiuta.
     📏 Il fatto che le smonta è misurato sul test vero di Maurizio del 27/08 alle 10:12:51:
     alla TERZA prova del giro il gestionale non faceva la domanda e non lasciava parlare il
     bot, e il livello non si sarebbe scritto comunque ⇒ silenzio eterno dopo «fra poco ti
     scrivo com'è andata».
     ⚖️ La ragione del rifiuto — «l'esito dell'ultima prova si applica da solo, non c'è niente
     da scegliere» — poggiava su due cose che oggi non valgono più:
       · l'attesa fra un giro e l'altro è ZERO dal 25/08 ⇒ la quarta prova esiste, quindi
         rimandare la scelta a «dopo» ha di nuovo un dopo;
       · il silenzio-assenso è ZERO dal 26/08 ⇒ in `assessment-apply-level` la porta che
         aspettava la scelta non scatta MAI, e `laProvaEsaurisceIlGiro` non decide più niente
         nemmeno là: ogni prova si applica da sé, non solo la terza.
     ⇒ Alla terza prova la scelta è possibile come alle altre. Chi dice «riprovo» blocca
     l'applicazione come sempre (è il primo controllo di `decidi`), chi dice «mi fermo» la
     conferma: nessuna delle due strade cambia, si toglie solo il divieto di percorrerle.
     🔒 Restano in piedi i rifiuti che poggiano su FATTI e non su conteggi: `SCHEDA_SUPERATA`
     (c'è una prova più recente), `GIA_APPLICATA` (il livello è già scritto),
     `PROVA_NON_PASSATA`. Quelli non scadono. */
  return '';
}

const RIFIUTI: Record<string, { stato: number; frase: string }> = {
  SCELTA_SCONOSCIUTA: { stato: 400, frase: 'La scelta può essere solo «mi_fermo», «riprovo» o «scendo».' },
  NIENTE_DA_SCENDERE: { stato: 409, frase: 'Su questa prova non c\'è nessun livello da prendere: il gradino non è più offerto.' },
  SCHEDA_NON_TROVATA: { stato: 404, frase: 'Nessuna scheda di questo socio con questo gettone.' },
  PROVA_NON_PASSATA: { stato: 409, frase: 'Questa prova non ha superato il quiz: non c\'è un livello da tenere. Per riprovare si rifà il test.' },
  GIA_APPLICATA: { stato: 409, frase: 'Il livello di questa prova è già stato applicato: la scelta è arrivata dopo i fatti.' },
  SCHEDA_SUPERATA: { stato: 409, frase: 'C\'è una prova più recente: la scelta si fa sull\'ultima, non sul passato.' },
  /* ⚠️ `GIRO_FINITO` non viene più EMESSO dal 27/08 (vedi `motivoDelRifiuto`), ma la frase
     resta: i bottoni di Telegram non scadono, e un tocco su un messaggio vecchio potrebbe
     ancora incontrarlo se un giorno il rifiuto tornasse. Una tabella di traduzione senza la
     sua voce farebbe uscire il CODICE al socio. */
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
    /* 🩹🚨⭐⭐ 27/08 sera — QUI MANCAVANO DUE COLONNE, ed è la metà peggiore dello stesso
       difetto: senza `declared_level` e `calculated_level` la `gradinoOfferto` di questa
       funzione tornava SEMPRE vuota ⇒ un «scendo» sarebbe stato rifiutato con
       `NIENTE_DA_SCENDERE` **anche dove il bottone c'era davvero**. ⇒ Il gradino non era
       lento o parziale: era inerte, e il socio che lo toccava si prendeva un errore.
       📌 *Una regola giusta con in pasto una riga monca è una regola che non gira.* */
    .select('id, token, submitted_at, raw_response, declared_level, calculated_level, applied_at, member_decision, member_decision_at')
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
  /* 🆕 27/08 — la stessa domanda che si fa `motivoDelRifiuto`, e si rifà QUI invece di
     farla tornare da là: quella funzione risponde «si può o no», e farle portare anche un
     secondo dato la trasformerebbe in due funzioni con un nome solo. La camminata è la
     stessa riga (`esitoDellaProva`), quindi non c'è nessuna regola in due copie. */
  const provaSuperata = esitoDellaProva(scheda) === 'pass';

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

  /* 🆕 27/08 sera — IL LIVELLO CHE IL SOCIO HA IN ANAGRAFICA, e serve solo al gradino: senza
     di quello «scendo» non si può nemmeno validare — la stessa fascia dimostrata è un gradino
     per chi sta più in alto e un livello nuovo per chi non ce l'ha. È la stessa lettura che fa
     il ponte del link (`pmo_cloud_records`, record `member`, `payload->>id`), e si fa QUI e non
     là perché una scelta si valida sui fatti di adesso, non su quelli di quando il bot ha
     disegnato il bottone.
     ⚖️ Un guasto in questa lettura NON fa cadere le altre due scelte: `mi_fermo` e `riprovo`
     non guardano il livello, e farle morire per un campo che non le riguarda sarebbe togliere
     due strade sane per una terza. Il gradino, senza il livello, resta semplicemente vuoto —
     e un «scendo» senza gradino è già un rifiuto pulito. */
  let gradino = '';
  if (scelta === SCELTA_SCENDO) {
    const { data: soci, error: erroreSocio } = await db
      .from('pmo_cloud_records')
      .select('payload')
      .eq('record_type', 'member')
      .not('deleted', 'is', true)
      .eq('payload->>id', memberId)
      .limit(2);
    if (erroreSocio) {
      return err(500, 'DB_ERROR', `Lettura del socio non riuscita: ${erroreSocio.message}`);
    }
    // ⚠️ Due soci con lo stesso id non dovrebbero esistere: se succede non si sceglie a caso,
    // stessa difesa dell'ambiguità sulla scheda qui sopra.
    if ((soci?.length ?? 0) > 1) {
      return err(409, 'AMBIGUA', 'Più di un socio con questo id: non scelgo.');
    }
    const socio = (soci?.[0] as JsonMap | undefined)?.payload as JsonMap | undefined;
    gradino = gradinoOfferto(scheda, clean(socio?.level));
  }

  const rifiuto = motivoDelRifiuto(scelta, scheda, elencoSchede, gradino);
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

  // ══════════════════════════════════════════════════════════════════════════════════════
  // ⚡⭐⭐ IL LIVELLO SI APPLICA ADESSO, NON AL PROSSIMO CRON — voce 84 ⓒ, 24/08/2026.
  //
  // 🗣️ Sua domanda, ed è quella che ha trasformato una frase da sistemare in una cura:
  // *«ma devono passare obbligatoriamente quindici minuti per aggiornare la scheda?»* — poi:
  // *«di logica, quando sul bot viene detto che il tuo livello è stato accettato, uno va a
  // vedere dentro al bot il suo livello»*. ⇒ Esatto: «accettato» e poi il livello che non
  // c'è è una bugia che dura un quarto d'ora, e la scopre chi fa la cosa più naturale.
  //
  // 📏 MISURATO il 24/08: `pmo-assessment-apply-level-prod` ha schedule `*/15 * * * *`. ⇒ fra
  // il tocco del socio e il livello sulla sua scheda passavano **fino a 15 minuti**, e in quel
  // buco il bot aveva già detto «Te lo registro sulla scheda a breve».
  //
  // 🔒 **È LA REGOLA DEL COMMITTENTE DEL 22/08 APPLICATA QUI**: *«ogni gesto va detto al socio
  // SOLO DOPO che il circolo l'ha confermato — e nello STESSO ISTANTE dev'essere registrato dal
  // gestionale»*. La metà «stesso istante» qui mancava: si registrava la SCELTA, non il suo
  // effetto. È lo stesso difetto che la voce 75 ha curato sulla creazione.
  //
  // ⛔ COME NON SI FA, ed è la parte che conta: qui **non si ricopia** la regola
  // dell'applicazione — il non-scendere al ribasso, la scheda più recente dell'ultimo
  // aggiornamento del livello, il giro delle tre prove. Sono tre regole delicate, vivono in
  // `assessment-apply-level`, e una seconda copia divergerebbe al primo ripensamento.
  // ✅ Si CHIAMA quella funzione, che è già a sé e non vuole parametri obbligatori.
  //
  // ⚖️ E NON SI ASPETTA IL SUO ESITO PER RISPONDERE AL SOCIO: la risposta al tocco è la
  // conferma della SCELTA, che è già scritta e vera. Se il giro non parte o fallisce, il
  // livello arriva col cron come prima — **si perde la fretta, non il fatto**. Per questo
  // l'errore si scrive nel registro e non esce di qui.
  // 🚨 Solo su «mi fermo»: chi ha risposto «riprovo» ha SCARTATO quella prova, e lanciare il
  // giro per lui non applicherebbe niente — sarebbe una chiamata a vuoto a ogni tocco.
  // ⭐ Il cron RESTA, ed è la rete: copre i due casi che non passano da un tocco — il
  // silenzio-assenso delle 24 ore e la terza prova, che chiude il giro da sé.
  // ══════════════════════════════════════════════════════════════════════════════════════
  /* 🔄🚨⭐ 28/08/2026 (E6) — VIA `applicazione_lanciata` dalla risposta, e con lui la
     variabile che lo teneva. 📏 Due misure indipendenti, e bastava la seconda:
     ① il campo poteva **dire il vero a vuoto**: il dispatcher è «spara e dimentica», quindi
        `rpc` senza errore vuol dire *la richiesta è partita*, non *il livello è scritto*. Un
        bot che ne avesse tratto «te l'ho registrato» avrebbe promesso una cosa non ancora
        successa — il difetto del 9/08 nell'email alla segreteria, un piano più in là;
     ② il bot **non lo leggeva**: zero occorrenze in tutto `src/` del repo del bot.
     ⇒ Era un campo morto che prometteva di poter mentire. La forma l'ha scelta lui: toglierlo
     adesso; se un domani servirà dire «te l'ho registrato» con certezza, il campo giusto non è
     questo — è uno che dica **scritto**, e nascerà col lavoro dei 4 secondi (D10).
     📌 *Un campo che nessuno legge non è innocuo: è la prossima promessa falsa.* */
  // 🚨 …e SOLO se la prova era superata: su una non riuscita il giro non applicherebbe niente
  //    (lo ferma il quiz non superato), quindi sarebbe una chiamata a vuoto a ogni tocco.
  /* 🔄 27/08 sera — e si lancia anche su «scendo», che è la scelta che scrive DAVVERO un
     livello: farla aspettare il cron vorrebbe dire dire al socio «va bene, Principiante» e
     lasciarlo con Base in scheda fino a un quarto d'ora dopo. È la regola sua del 22/08 —
     *«nello stesso istante dev'essere registrato dal gestionale»* — applicata alla terza
     scelta come già alla prima.
     ⚠️ E QUI la prova superata non è una condizione: il gradino nasce apposta anche sulle
     bocciate, ed è lì che il giro ha più da fare. */
  if ((scelta === SCELTA_MI_FERMO && provaSuperata) || scelta === SCELTA_SCENDO) {
    // ⭐⭐ SI CHIAMA IL DISPATCHER, NON L'EDGE DIRETTAMENTE, e la ragione è la porta:
    // `assessment-apply-level` entra solo col segreto delle routine, che vive nel **vault** e
    // che questa funzione non ha (né deve avere: sarebbe un secondo posto da cui può uscire).
    // `pmo_dispatch_assessment_apply_level` il vault lo legge da sé — è `SECURITY DEFINER`, ed
    // è **la stessa identica strada che percorre il cron**. ⇒ Nessuna chiave in più in giro, e
    // nessun secondo modo di far partire quel giro che possa divergere dal primo.
    const { error: erroreGiro } = await db.rpc('pmo_dispatch_assessment_apply_level', { p_simula: false });
    if (erroreGiro) {
      console.error(`[assessment-decision] giro d'applicazione non partito (${erroreGiro.message}) — il livello arriverà col cron`);
    }
  }

  return ok({
    scelta,
    registrata_il: adesso,
    /* 🆕 27/08 — LO DICE IL GESTIONALE, non lo deduce il bot: la stessa scelta significa due
       cose diverse a seconda che la prova avesse prodotto un livello o no («tengo Avanzato» /
       «mi tengo quello che ho in scheda»), e il bot che lo indovinasse da una lettura sua
       potrebbe promettere una registrazione che non avverrà. *Il gestionale SA, il bot DICE.* */
    prova_superata: provaSuperata,
    /* ⭐ La PAROLA del gradino torna insieme alla scrittura, e non è un di più: è la stessa
       chiamata che l'ha registrata, quindi non può parlare di una prova diversa. Il bot la
       usa per rispondere («Va bene: Principiante») senza rileggere niente — e una seconda
       lettura, fra il tocco e la risposta, ci starebbe una corsa. */
    gradino: gradino || null,
    scelta_precedente: precedente || null,
    cambiata: precedente !== '' && precedente !== scelta,
  });
});
