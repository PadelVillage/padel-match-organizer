import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// consumer-assessment-link — il LINK PERSONALE del test di livello, per il bot dei soci.
//
// 🗣️ Nasce da un fatto del 9/08/2026: chiuso il link GENERICO (sua decisione, riga 11 della
// Tabella 1), il bot è rimasto **senza strada** verso il test — nel suo codice c'era scritto
// nero su bianco che «`?t=…` è legata a UN socio e da qui non si fabbrica». Questa funzione è
// il pezzo che mancava: dato il socio che il bot ha GIÀ riconosciuto, restituisce il suo
// indirizzo personale.
//
// ⭐⭐ Perché personale e non generico: il generico non riconosce nessuno, quindi chiede nome,
// cognome, telefono ed e-mail a una persona che il circolo conosce già — e la scheda che ne
// esce non si attacca a nessuna anagrafica. Il personale porta il gettone, e il gestionale sa
// di chi è la scheda.
//
// SCRITTURA, ed è l'unica: crea (o riusa) una riga in `assessment_tokens`.
// 🚨 Non entra nel RECINTO delle scritture al circolo, e va detto perché non sembri una
// dimenticanza: il recinto difende **Matchpoint** (le `matchpoint-*`), cioè il sistema del
// circolo, da chi lo tocca girando fuori dalla produzione. Qui si scrive in una tabella
// NOSTRA, e ogni ambiente scrive sulla propria — TEST su `cudi…`, PROD su `qqbf…`. Non c'è un
// sistema di terzi da proteggere.
// ⚖️ Ma il verso del dubbio è lo stesso del recinto: l'indirizzo di casa decide, e un
// indirizzo che non si riconosce NON produce un link (vedi `indirizzoScheda`).
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

const PROD_REF = 'qqbfphyslczzkxoncgex';
const TEST_REF = 'cudiqnrrlbyqryrtaprd';

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

/**
 * Dove vive la scheda, deciso dall'indirizzo di CASA PROPRIA.
 *
 * 🚨⭐⭐ FAIL CLOSED su un indirizzo che non si riconosce, e non è pignoleria: sbagliare qui
 * manderebbe un socio VERO a compilare la scheda nell'ambiente di PROVA — la sua
 * autovalutazione finirebbe su `cudi…`, il gestionale vero non la vedrebbe mai, e nessuno se
 * ne accorgerebbe perché al socio la pagina si apre uguale.
 * ⇒ Meglio nessun link (il bot ripiega da sé sulla segreteria) che il link giusto per
 * l'ambiente sbagliato.
 *
 * 📏 E l'indirizzo di TEST non è `test.padelvillage.club/autovalutazione.html`: quel dominio
 * serve SOLO `index.html` e quella pagina risponde 404 (misurato il 9/08). Il file con
 * l'anteprima per le chat vive su `app.padelvillage.club/test/`, ed è lo stesso che usa già
 * l'edge delle email — un secondo indirizzo diverso sarebbe la solita copia che diverge.
 */
function indirizzoScheda(supabaseUrl: string): string {
  const u = clean(supabaseUrl).toLowerCase();
  if (u.includes(PROD_REF)) return 'https://app.padelvillage.club/autovalutazione.html';
  if (u.includes(TEST_REF)) return 'https://app.padelvillage.club/test/autovalutazione.html?env=test';
  return '';
}

/**
 * Un gettone della STESSA forma di quelli che fabbrica il gestionale (`makeAssessmentToken`):
 * maiuscole e cifre, 14 caratteri. ⚖️ Stessa forma, non stesso codice: là si parte da
 * `btoa(Date.now()+id+random)`, qui non c'è `btoa` sul lato server e ricopiarne il giro non
 * aggiungerebbe niente. Quello che conta è che l'app lo sappia leggere, e legge una stringa.
 */
function nuovoGettone(): string {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += alfabeto[b % alfabeto.length];
  return out;
}

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

  // L'id è quello dell'APP (`payload.id`), lo stesso che `consumer-player-readmodel`
  // restituisce come `member.id`: il bot ce l'ha già in mano quando arriva qui, quindi non si
  // rifà il riconoscimento. ⭐ E non si RICOPIA la regola dell'ambiguità che vive nel
  // readmodel: due copie di quella regola sarebbero due modi diversi di sbagliare persona.
  const memberId = clean(body.member_id ?? body.memberId);
  if (!memberId) {
    return err(400, 'MEMBER_ID_REQUIRED', 'Serve member_id (l\'id del socio nel gestionale).');
  }

  const supabaseUrl = clean(Deno.env.get('SUPABASE_URL'));
  const base = indirizzoScheda(supabaseUrl);
  if (!base) {
    // Vedi `indirizzoScheda`: non si tira a indovinare l'ambiente di una persona vera.
    return err(503, 'AMBIENTE_SCONOSCIUTO', 'Indirizzo del progetto non riconosciuto: nessun link prodotto.');
  }

  const db = createClient(
    supabaseUrl,
    clean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')),
    { auth: { persistSession: false } },
  );

  // Il socio, per riempire nome e ultime 4 cifre: sono i campi che il gestionale mostra
  // accanto al gettone. Se non lo si trova NON si crea niente — un gettone senza padrone
  // produrrebbe una scheda che non si attacca a nessuno, cioè il difetto del link generico.
  const { data: righe, error: erroreSocio } = await db
    .from('pmo_cloud_records')
    .select('payload')
    .eq('record_type', 'member')
    .not('deleted', 'is', true)
    .eq('payload->>id', memberId)
    .limit(2);

  if (erroreSocio) {
    return err(500, 'DB_ERROR', `Lettura del socio non riuscita: ${erroreSocio.message}`);
  }
  if (!righe || righe.length === 0) {
    return err(404, 'MEMBER_NOT_FOUND', 'Nessun socio vivo con questo id.');
  }
  if (righe.length > 1) {
    // Stessa difesa del readmodel: meglio non rispondere che rispondere per la persona
    // sbagliata → vedi il caso dei `pmoPlayerId` condivisi (9/08).
    return err(409, 'AMBIGUOUS', 'Più di un socio vivo con questo id: non scelgo.');
  }

  const payload = (righe[0]?.payload ?? {}) as JsonMap;
  const nome = clean(payload.name)
    || [clean(payload.firstName), clean(payload.surname)].filter(Boolean).join(' ').trim()
    || 'Socio';
  const ultime4 = clean(payload.phone).replace(/\D/g, '').slice(-4);

  /* ═══════════════════════════════════════════════════════════════════════════════════════
     🆕🔁⭐⭐ 9/08/2026 — LA REGOLA DEI TRE TENTATIVI, e sta QUI di proposito.

     🗣️ Sua: *«quando faccio un test lo posso affinare provando TRE VOLTE DI SEGUITO. Dopodiché
     scattano i TRENTA GIORNI. Se lo sbaglio per tre volte c'è il messaggio che posso contattare
     la segreteria»*. E «affinare» l'ha precisato: *«se non passa, il bot mi dice se voglio
     rifarlo»* — nessun suggerimento su cosa fosse sbagliato, solo l'offerta di ripetere.

     ⭐⭐ **Perché il conto vive nel ponte e non nel bot**: il bot è un client, e un client si
     riavvia, si sdoppia, si aggiorna. Un contatore che vive là dura quanto il processo. Qui il
     conto non è tenuto: è **CALCOLATO dai fatti** — le schede che quel socio ha davvero
     mandato. Non c'è niente da azzerare, niente da sincronizzare, e due bot che chiedono
     insieme leggono lo stesso numero.

     ⭐ **Cosa conta come tentativo**: una scheda ARRIVATA il cui cancello è `fail`. Non un
     gettone chiesto — chi tocca il bottone dieci volte senza compilare non consuma niente, e
     infatti il gettone non usato si riusa (più sotto).
     ⭐ **Cosa azzera il conto**: una scheda che PASSA. Da lì in poi si riparte da zero, perché
     la strada l'ha percorsa. (Quando la segreteria mette il livello a mano il conto non serve
     più: quella persona un livello ce l'ha.)
     ⚖️ **I 30 giorni partono dal TERZO fallimento**, non da ogni tentativo: chi ne fa tre in
     dieci minuti aspetta da quel momento, non tre volte.
     ═══════════════════════════════════════════════════════════════════════════════════════ */
  const TENTATIVI_PER_GIRO = 3;
  const GIORNI_DI_ATTESA = 30;

  // Le schede di QUESTO socio: si passa per i suoi gettoni, che sono il filo fra la persona e
  // la scheda (la scheda pubblica non porta l'anagrafica, porta il gettone).
  const { data: gettoniSuoi, error: erroreElenco } = await db
    .from('assessment_tokens')
    .select('token')
    .eq('member_local_id', memberId);

  if (erroreElenco) {
    return err(500, 'DB_ERROR', `Lettura dei gettoni non riuscita: ${erroreElenco.message}`);
  }

  const suoi = (gettoniSuoi ?? []).map(r => clean((r as JsonMap).token)).filter(Boolean);
  let falliti = 0;
  let ultimoFallitoIl = '';
  /**
   * 🆕🔔 L'ULTIMA scheda arrivata, qualunque sia andata: serve all'avviso che il bot manda
   * DOPO il test — sua richiesta del 9/08: *«dopo aver fatto il test, il bot ti deve
   * rispondere qualcosa»*, e in tutti e due i casi, non solo quando si viene bocciati.
   * ⭐ Si porta la FASCIA e non il numero: al socio il livello si dice a PAROLE (regola sua),
   * e la fascia è già dentro la scheda — così non serve una terza copia della scala qui
   * dentro, che sarebbe l'ennesima cosa da tenere allineata a mano.
   */
  let ultimaScheda: JsonMap | null = null;

  if (suoi.length) {
    const { data: schede, error: erroreSchede } = await db
      .from('self_assessments')
      .select('token, submitted_at, raw_response')
      .in('token', suoi)
      .order('submitted_at', { ascending: false })
      .limit(20);

    if (erroreSchede) {
      return err(500, 'DB_ERROR', `Lettura delle schede non riuscita: ${erroreSchede.message}`);
    }

    // Si scorre dalla PIÙ RECENTE all'indietro e ci si ferma alla prima passata: quello è
    // l'inizio del giro corrente. ⭐ Contare tutte le fallite di sempre punirebbe per errori
    // già rimediati.
    const elenco = (schede ?? []) as JsonMap[];
    if (elenco.length) {
      const s = elenco[0];
      const k = ((s.raw_response as JsonMap)?.knowledge ?? {}) as JsonMap;
      const esito = clean(k.status);
      ultimaScheda = {
        token: clean(s.token),
        // ⚖️ `skip` resta `skip`: non è né passato né bocciato, è «questa la guarda una
        // persona». Appiattirlo su uno dei due farebbe dire al bot una cosa falsa.
        esito: esito || 'ignoto',
        quando: clean(s.submitted_at),
        fascia: clean(k.fascia),
        senza_cancello: k.senza_cancello === true,
        /**
         * 🚨⭐⭐ IL LIVELLO C'È DAVVERO? — e non è una sfumatura.
         *
         * 🗣️ Lui vuole che il bot, a test superato, dica *«il livello che ti è stato messo»*,
         * con la PAROLA e non col numero. Giusto — ma quel livello, oggi, lo scrive il
         * GESTIONALE quando qualcuno lo apre, non questo server. Mandare l'avviso appena la
         * scheda passa vorrebbe dire dichiarare fatta una cosa che deve ancora succedere: è
         * esattamente il difetto trovato il 9/08 nell'email alla segreteria — *«il livello è
         * stato aggiornato da solo»* quando non lo era.
         * ⇒ Qui si dice se la scheda del socio porta già il segno di QUESTO test, e il bot
         * aspetta di poterlo dire vero. Un avviso in ritardo è meglio di un avviso bugiardo.
         * ⏭️ Quando l'applicazione passerà su un'edge con cron (voce A4ter), il ritardo si
         * accorcia da solo e qui non cambia niente.
         */
        livello_applicato: (() => {
          const quandoScheda = Date.parse(clean(s.submitted_at));
          const quandoLivello = Date.parse(clean(payload.selfAssessmentDate));
          if (!Number.isFinite(quandoScheda) || !Number.isFinite(quandoLivello)) return false;
          // Tolleranza di un minuto: le due date le scrivono due macchine diverse.
          return quandoLivello >= quandoScheda - 60_000;
        })(),
        livello: clean(payload.level),
      };
    }
    for (const s of elenco) {
      const conoscenza = ((s.raw_response as JsonMap)?.knowledge ?? {}) as JsonMap;
      const stato = clean(conoscenza.status);
      // 🚨 `skip` non è un fallimento: sono Semi-Pro e Professionista, che il quiz non ce
      // l'hanno e vanno in segreteria per un'altra strada. Trattarlo come fallito li
      // manderebbe in attesa di 30 giorni per una regola che non li riguarda.
      if (stato === 'fail') {
        falliti++;
        if (!ultimoFallitoIl) ultimoFallitoIl = clean(s.submitted_at);
      } else if (stato === 'pass') {
        break;
      }
    }
  }

  if (falliti >= TENTATIVI_PER_GIRO) {
    const ultimo = new Date(ultimoFallitoIl);
    const sbloccoMs = ultimo.getTime() + GIORNI_DI_ATTESA * 24 * 60 * 60 * 1000;
    const adesso = Date.now();
    if (Number.isFinite(sbloccoMs) && adesso < sbloccoMs) {
      // ⚖️ NON è un errore HTTP: la richiesta è stata capita ed eseguita, la risposta è «non
      // adesso». Un 4xx qui farebbe scattare nel bot il ripiego dei guasti — cioè un «riprova
      // più tardi» generico — proprio dove serve la frase precisa con la data e la segreteria.
      return ok({
        stato: 'attesa',
        ultima_scheda: ultimaScheda,
        tentativi_falliti: falliti,
        riprova_dal: new Date(sbloccoMs).toISOString(),
        giorni_mancanti: Math.max(1, Math.ceil((sbloccoMs - adesso) / (24 * 60 * 60 * 1000))),
      });
    }
    // Passati i 30 giorni il giro riparte: non si azzera niente nei dati, semplicemente le
    // vecchie fallite non contano più. ⭐ È il vantaggio del conto CALCOLATO: il tempo fa da
    // sé quello che altrove sarebbe una riga da aggiornare (e da dimenticare).
    falliti = 0;
  }

  // 1) Si RIUSA il gettone che il socio ha già, se non l'ha ancora usato.
  // ⭐ Perché: chi tocca il bottone due volte deve ritrovare la SUA scheda, non aprirne una
  // seconda. E il gestionale mostra una riga per socio invece di una collezione di gettoni
  // morti. Un gettone già completato invece non si riusa: quella scheda è chiusa.
  const { data: esistenti, error: erroreGettoni } = await db
    .from('assessment_tokens')
    .select('token, status, completed_at')
    .eq('member_local_id', memberId)
    .is('completed_at', null)
    .neq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1);

  if (erroreGettoni) {
    return err(500, 'DB_ERROR', `Lettura dei gettoni non riuscita: ${erroreGettoni.message}`);
  }

  const separatore = base.includes('?') ? '&' : '?';

  /**
   * 🆕 9/08 sera — nell'indirizzo va anche il NOME, e non è un ornamento.
   *
   * 📏 Misurato sulla prima scheda arrivata davvero dal bot: si è salvata come **«Socio Padel
   * Village»**, il segnaposto, invece che col nome del socio. La pagina, dal link personale,
   * gira **senza anagrafica** — non ha modo di sapere chi sei se non glielo dice l'indirizzo:
   * legge `?nome=` e, in mancanza, ripiega sul segnaposto.
   * ⇒ Senza questo, ogni scheda che arriva dal bot entra in gestionale **senza nome**. Si
   * attacca lo stesso alla persona giusta (il gettone sa di chi è), ma chi guarda l'elenco
   * non lo capisce — ed è il tipo di difetto che nessuno segnala perché non rompe niente.
   * ⚖️ Resta un'ETICHETTA, non un'identità: chi decide di chi è la scheda è sempre il gettone.
   */
  const conNome = (token: string) =>
    `${base}${separatore}t=${encodeURIComponent(token)}&nome=${encodeURIComponent(nome)}`;

  // Il conto si racconta INSIEME al link: il bot deve poter dire «è il tuo secondo tentativo,
  // te ne resta uno» senza tenere niente in memoria fra un messaggio e l'altro.
  const conteggio = {
    stato: 'link',
    ultima_scheda: ultimaScheda,
    tentativi_falliti: falliti,
    tentativo: falliti + 1,
    tentativi_totali: TENTATIVI_PER_GIRO,
    ultimo_tentativo: falliti + 1 >= TENTATIVI_PER_GIRO,
  };

  if (esistenti && esistenti.length > 0 && clean(esistenti[0].token)) {
    const token = clean(esistenti[0].token);
    return ok({ ...conteggio, token, url: conNome(token), riusato: true });
  }

  // 2) Altrimenti se ne fabbrica uno. `token` ha un vincolo di unicità (il gestionale ci fa
  // sopra `on conflict (token)`): su collisione si riprova, invece di rispondere un errore
  // per un dado uscito male. Tre giri sono già oltre l'assurdo con 36^14 possibilità.
  for (let giro = 0; giro < 3; giro++) {
    const token = nuovoGettone();
    const { error: erroreInserimento } = await db
      .from('assessment_tokens')
      .insert({
        token,
        member_local_id: memberId,
        member_name: nome,
        phone_last4: ultime4,
        status: 'created',
      });

    if (!erroreInserimento) {
      return ok({ ...conteggio, token, url: conNome(token), riusato: false });
    }
    // 23505 = unique_violation: solo in quel caso ha senso ritentare.
    if (clean((erroreInserimento as { code?: string }).code) !== '23505') {
      return err(500, 'DB_ERROR', `Creazione del gettone non riuscita: ${erroreInserimento.message}`);
    }
  }

  return err(500, 'TOKEN_COLLISION', 'Non sono riuscito a fabbricare un gettone libero.');
});
