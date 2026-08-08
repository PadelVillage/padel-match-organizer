// ─────────────────────────────────────────────────────────────────────────────
// bot-telegram-admin — LA LOGICA, tenuta fuori da index.ts per poterla PROVARE.
//
// Il deploy delle edge NON controlla i tipi e non esegue niente: l'unico gate
// vero sono `deno check` e i test qui accanto (logica.test.ts). Tutto ciò che
// decide qualcosa — chi vede la sezione, com'è finito un invito, che livello
// scrivere accanto a un nome — sta qui, in funzioni pure senza rete.
// ─────────────────────────────────────────────────────────────────────────────

/** Il progetto di PRODUZIONE del gestionale. L'ambiente si legge dall'indirizzo
 *  su cui la funzione sta girando, esattamente come fa `ai-settings`: è un fatto
 *  della macchina, non una variabile che qualcuno può dimenticare di impostare. */
export const REF_PROD = 'qqbfphyslczzkxoncgex';

/** La chiave del permesso di sezione. Deve restare uguale a quella dichiarata in
 *  PMO_SECTION_TREE dentro index.html: sono i due lati della stessa serratura. */
export const CHIAVE_SEZIONE = 'view_admin_telegram';

/** Il livello che l'app assegna alla creazione di un socio (index.html: `level: 0.5`).
 *  Non è un'informazione: è un segnaposto, e su TEST ce l'hanno 2.320 soci su 2.828.
 *  Mostrarlo come fosse un livello vero direbbe una bugia a chi guarda il pannello. */
export const LIVELLO_DI_PARTENZA = '0.5';

/** Il codice cliente del circolo: sei cifre esatte, com'è nell'Elenco clienti.
 *
 *  🚨⭐⭐ Specchio VOLUTO di `codiceSocio()` del bot (`lib/identita.ts`): è la stessa
 *  regola dai due lati del filo, ed è quella che decide chi può prenotare. Conta
 *  perché in anagrafica un `memberId` **c'è quasi sempre** — solo che spesso è un
 *  `PMO-000060`, cioè un segnaposto messo da noi, non un codice del circolo.
 *  Trattarlo come un codice vero direbbe «questa persona prenota» di chi non prenota. */
const FORMA_CODICE = /^[0-9]{6}$/;

export function codiceSocio(v: unknown): string {
  const s = testo(v);
  return FORMA_CODICE.test(s) ? s : '';
}

export type Permessi = Record<string, unknown>;

export type RigaOperatore = {
  chat_id: number | string;
  /** 🚨 Dal passo 1b è NULL per chi al circolo non ha un codice cliente (1.722 soci
   *  su 2.789 al 1/08/2026): non è più il modo di riconoscere una persona. */
  member_id?: string | null;
  /** Il numero di scheda della nostra app: il nome del cassetto del bot. Ce l'hanno tutti. */
  persona_id?: string | null;
  /** Le ultime 10 cifre del telefono — la CHIAVE con cui il ponte cerca, non il numero. */
  telefono_chiave?: string | null;
  etichetta?: string | null;
  attivo: boolean;
  ambiente: string;
  created_at: string;
  invitato_da_member_id?: string | null;
  invito_token?: string | null;
};

export type RigaInvito = {
  token: string;
  ambiente: string;
  invitante_member_id?: string | null;
  /** Chi ha invitato, per numero di scheda: c'è SEMPRE, anche quando il codice manca. */
  invitante_persona_id?: string | null;
  invitante_etichetta?: string | null;
  partita?: string | null;
  creato_il: string;
  scade_il?: string | null;
  annullato: boolean;
  aperto_da_chat_id?: number | string | null;
  aperto_il?: string | null;
  usato_da_chat_id?: number | string | null;
  usato_il?: string | null;
  esito?: string | null;
};

export type Socio = {
  /** Il numero di scheda della nostra app (`payload.id`): ce l'hanno tutti. */
  schedaId: string;
  /** Il codice cliente del circolo, o stringa vuota se non ce l'ha. */
  memberId: string;
  nome: string;
  telefono: string;
  livello: string;
  autovalutato: boolean;
};

/** L'anagrafica indicizzata nei DUE modi in cui la si può cercare. Due mappe e non
 *  una perché le due chiavi non sono intercambiabili: il numero di scheda ce l'hanno
 *  tutti, il codice solo chi è cliente del circolo. */
export type Rubrica = { perScheda: Map<string, Socio>; perCodice: Map<string, Socio> };

export type PersonaVista = {
  chatId: string;
  memberId: string;
  personaId: string;
  telefonoChiave: string;
  nome: string;
  telefono: string;
  livello: string;
  schedaTrovata: boolean;
  /** 🚪 Vero se al circolo questa persona non risulta cliente ⇒ dal bot non può prenotare,
   *  e riceve la scheda che glielo spiega. È il fatto che la segreteria non può vedere da
   *  nessun'altra parte. */
  senzaCodice: boolean;
  invitatoDa: string;
  invitatoDaMemberId: string;
  /** Vero se è entrata da un invito, anche quando di chi l'ha invitata non resta il nome. */
  viaInvito: boolean;
  entratoIl: string;
  attivo: boolean;
};

export type InvitoVista = {
  token: string;
  stato: 'in giro' | 'usato' | 'ritirato' | 'scaduto';
  motivo: string;
  invitante: string;
  invitanteMemberId: string;
  partita: string;
  creatoIl: string;
  scadeIl: string;
  usatoIl: string;
  esito: string;
  ritirabile: boolean;
};

function testo(v: unknown): string {
  return String(v ?? '').trim();
}

/** 'prod' solo se l'indirizzo è CERTAMENTE quello di produzione: il verso del
 *  dubbio è quello di sempre — un indirizzo sconosciuto o vuoto finisce su 'test',
 *  cioè nell'ambiente dove un errore non tocca il bot vero. */
export function ambienteDa(supabaseUrl: string): 'test' | 'prod' {
  return testo(supabaseUrl).includes(REF_PROD) ? 'prod' : 'test';
}

/** Specchio VOLUTO di `pmoSubsectionVisibleFor('view_admin_telegram','administration')`
 *  dell'app. Non è una seconda regola: è la stessa regola dall'altra parte del filo,
 *  perché nascondere una voce di menu è comodità, mentre la barriera è qui.
 *  🚨 Se un giorno cambia la regola dell'app, cambia anche questa — o la sezione
 *  sparirebbe dal menu restando aperta a chi conosce l'indirizzo. */
export function vedeLaSezione(ruolo: string, permessi: Permessi | null | undefined): boolean {
  if (['owner', 'admin'].includes(testo(ruolo))) return true;
  const p = (permessi && typeof permessi === 'object') ? permessi : {};
  // Nessuna chiave `view_*` = profilo nato prima dei permessi per sezione: vede tutto
  // (retrocompatibilità, identica all'app). Con una configurazione presente, invece,
  // basta che la voce non sia stata spuntata via.
  const haConfigurazione = Object.keys(p).some((k) => k.startsWith('view_'));
  if (!haConfigurazione) return true;
  if (p['view_administration'] === false) return false;
  return p[CHIAVE_SEZIONE] !== false;
}

/** La chiave del permesso con cui si modifica una prenotazione del circolo — la stessa
 *  che l'app chiede prima di salvare un giocatore aggiunto
 *  (`pmoRequireStaffPermission('cloud_sync', 'modificare la prenotazione Matchpoint')`). */
export const CHIAVE_CALENDARIO = 'cloud_sync';

/**
 * Chi può creare il link d'ingresso al bot.
 *
 * ⭐⭐ SCELTO DA LUI il 6/08 fra tre, e la ragione è quella già usata per «togliere un
 * giocatore»: **il permesso segue il gesto**, e non se ne inventa uno nuovo. Chi può
 * mettere una persona in partita può mandarle il link per entrare nel bot.
 *
 * 🚨 Il fatto che ha reso necessaria questa regola, misurato prima di scriverla: sui DUE
 * ambienti le persone che inseriscono davvero i giocatori (`cloud_sync`) sono proprio
 * quelle che **non** vedono la sezione «Bot Telegram» — con la sola `vedeLaSezione` questa
 * funzione sarebbe stata negata esattamente a chi le serve, e aperta solo all'owner.
 *
 * ⚖️ E non allarga nient'altro: chi entra da questa porta crea un invito e basta. L'elenco
 * di chi è nel bot, la revoca e il ritiro degli inviti restano dietro `vedeLaSezione`.
 *
 * 🔒 `readonly` è fuori, e va per primo: creare un invito **scrive** una riga: l'app lo
 * ferma già di suo (`pmoBlockWriteIfReadonly`), ma quello è un riparo del browser — la
 * barriera vera è questa. Il ruolo batte il permesso: un `readonly` con `cloud_sync`
 * spuntato non deve passare.
 */
export function puoMandareIlLink(ruolo: string, permessi: Permessi | null | undefined): boolean {
  const r = testo(ruolo).toLowerCase();
  if (r === 'readonly') return false;
  if (vedeLaSezione(ruolo, permessi)) return true;
  const p = (permessi && typeof permessi === 'object') ? permessi : {};
  return p[CHIAVE_CALENDARIO] === true;
}

/**
 * QUALE porta per quale azione — e sta qui, non dentro `index.ts`, di proposito.
 *
 * 🚨⭐⭐ La lezione della 38ª: una guardia che vive solo dentro il corpo della funzione
 * servita **non la misura nessuno**, e un sabotaggio che la toglie lascia tutto verde.
 * Le due regole sopra sono provate una per una, ma «quale delle due si applica a
 * `crea_invito`» è la decisione che conta davvero — chi rimettesse `vedeLaSezione` su
 * tutto richiuderebbe la porta alla segreteria **senza far arrossire niente**.
 *
 * ⚖️ Passano dalla porta larga **due** azioni, e sono i due tempi dello stesso gesto:
 * `stato_bot` chiede «serve il link?» e `crea_invito` lo fa. Tutto il resto — l'elenco di
 * chi è nel bot, la revoca, il ritiro di un invito — resta dietro quella stretta, e
 * un'azione ignota ci finisce **per default**: chi domani ne aggiungerà una la troverà
 * chiusa, che è il verso giusto in cui sbagliare.
 *
 * 🚨 L'elenco è scritto **per esteso e in un posto solo**: una regola come «tutto ciò che
 * comincia per…» avrebbe fatto entrare dalla porta larga la prossima azione che càpita di
 * chiamare in un modo somigliante.
 */
export const AZIONI_DELLA_SEGRETERIA = ['stato_bot', 'crea_invito'];

export function ammessoAAzione(
  azione: string,
  ruolo: string,
  permessi: Permessi | null | undefined,
): boolean {
  return AZIONI_DELLA_SEGRETERIA.includes(testo(azione))
    ? puoMandareIlLink(ruolo, permessi)
    : vedeLaSezione(ruolo, permessi);
}

/**
 * Fra le righe che una persona ha nella whitelist, QUELLA da mostrare nella sua scheda.
 *
 * 🚨 Le righe possono essere più d'una davvero: chi entra, gli si toglie l'accesso e poi
 * rientra da un altro telefono lascia due righe, tutt'e due sue. La scheda del socio ha
 * spazio per **un fatto solo**, quindi va scelto — e la scelta non può stare dentro
 * l'edge, dove nessun test la guarderebbe (è la 38ª: una guardia che vive solo nella
 * funzione servita non la misura nessuno).
 *
 * ⚖️ La regola, in due righe:
 * - se **almeno una** riga è attiva, vince la **più VECCHIA fra le attive** — la domanda
 *   dello staff è «da quando ha il bot», e la risposta è da quando è entrato, non da
 *   quando ha cambiato telefono;
 * - se **nessuna** è attiva, vince la **più RECENTE** — lì la domanda è cambiata: non
 *   «da quando è dentro» ma «cos'è successo per ultimo», e il fatto più fresco è quello.
 *
 * ⚠️ Una data illeggibile non fa vincere né perdere: si tiene l'ordine in cui sono
 * arrivate. Ordinare su `NaN` scambierebbe le righe a caso, e la scheda direbbe una data
 * sbagliata con la stessa faccia sicura con cui dice quella giusta.
 */
export function rigaDaMostrare(righe: RigaOperatore[] | null | undefined): RigaOperatore | null {
  const tutte = (righe ?? []).filter(Boolean);
  if (!tutte.length) return null;
  const attive = tutte.filter((r) => r.attivo !== false);
  const gruppo = attive.length ? attive : tutte;
  const quando = (r: RigaOperatore): number => {
    const t = Date.parse(testo(r.created_at));
    return Number.isFinite(t) ? t : NaN;
  };
  return gruppo.reduce((scelta, r) => {
    const a = quando(scelta);
    const b = quando(r);
    if (!Number.isFinite(b)) return scelta;      // data illeggibile: non scalza nessuno
    if (!Number.isFinite(a)) return r;
    // fra le attive la più vecchia, fra le spente la più recente
    return attive.length ? (b < a ? r : scelta) : (b > a ? r : scelta);
  });
}

/**
 * Quello che della riga del bot può uscire verso la SCHEDA DEL SOCIO — e nient'altro.
 *
 * 🚨⭐⭐ Esiste per una ragione sola: **il `chat_id` non deve uscire**, qui come in tutta
 * questa porta. `PersonaVista` ce l'ha dentro (il pannello lo usa per revocare), quindi
 * restituirla intera sarebbe bastato a farlo arrivare nella scheda di ogni socio.
 * ⇒ I campi si **elencano**, non si tolgono: una lista di ciò che passa lascia fuori da
 * sé anche i campi che qualcuno aggiungerà domani, mentre un `delete vista.chatId`
 * protegge solo dal campo che conoscevamo il giorno che l'abbiamo scritto.
 *
 * ⭐ E sta qui, non dentro l'edge, perché una regola che vive solo nella funzione servita
 * non la misura nessuno: così un test può chiedere «quali chiavi escono?» e accorgersi
 * il giorno in cui ne esce una di troppo.
 *
 * ⚠️ `entrato_il` è la data dell'INGRESSO anche quando l'accesso è stato tolto: la
 * tabella del bot non registra quando è stato revocato (solo `created_at` e `attivo`,
 * misurato l'8/08/2026). Il nome del campo dice quale data è, così chi la stampa non può
 * scambiarla per un'altra.
 */
export type RigaBotPerScheda = {
  accesso_attivo: boolean;
  entrato_il: string;
  su_invito_di: string;
  via_invito: boolean;
};

export function rigaPerLaScheda(vista: PersonaVista | null | undefined): RigaBotPerScheda | null {
  if (!vista) return null;
  return {
    accesso_attivo: vista.attivo,
    entrato_il: testo(vista.entratoIl),
    su_invito_di: testo(vista.invitatoDa),
    via_invito: !!vista.viaInvito,
  };
}

/** Il livello, scritto come si può leggere senza sbagliarsi. */
export function livelloLeggibile(livello: unknown, autovalutato = false): string {
  const v = testo(livello).replace(',', '.');
  if (!v) return '—';
  if (autovalutato) return `${v} · autovalutato`;
  if (v === LIVELLO_DI_PARTENZA) return `${v} · valore di partenza`;
  return v;
}

function nomeDaPayload(payload: Record<string, unknown>): string {
  const nome = testo(payload.firstName);
  const cognome = testo(payload.surname);
  const unito = `${nome} ${cognome}`.trim().replace(/\s+/g, ' ');
  return unito || testo(payload.name);
}

/** Indicizza le schede dei soci nei due modi in cui si cercano, così la ricerca è una
 *  lettura sola invece di una query per riga. Le righe arrivano da `pmo_cloud_records`.
 *
 *  🚨⭐⭐ Prima si indicizzava SOLO per codice, e chi non ce l'aveva veniva **saltato**
 *  (`if (!memberId) continue`). Era giusto finché nel bot entrava solo chi il codice ce
 *  l'ha; dal passo 1b sarebbe diventato il difetto peggiore di questo pannello — le
 *  1.722 persone senza codice sarebbero comparse tutte come «scheda non trovata»,
 *  cioè come un guasto, mentre la loro scheda c'è eccome. */
export function indicizzaSoci(records: Array<{ payload?: unknown }>): Rubrica {
  const perScheda = new Map<string, Socio>();
  const perCodice = new Map<string, Socio>();
  for (const r of records || []) {
    const payload = (r && typeof r.payload === 'object' && r.payload) ? r.payload as Record<string, unknown> : null;
    if (!payload) continue;
    const schedaId = testo(payload.id);
    // ⭐ Il codice si tiene solo se è quello VERO del circolo: un `PMO-000060` non
    // apre nessuna porta, e indicizzarlo farebbe credere di aver trovato una persona
    // per una chiave che il bot non userà mai.
    const memberId = codiceSocio(payload.memberId);
    if (!schedaId && !memberId) continue;
    const socio: Socio = {
      schedaId,
      memberId,
      nome: nomeDaPayload(payload),
      telefono: testo(payload.phone),
      livello: testo(payload.level),
      autovalutato: !!testo(payload.selfAssessmentDate),
    };
    if (schedaId) perScheda.set(schedaId, socio);
    if (memberId) perCodice.set(memberId, socio);
  }
  return { perScheda, perCodice };
}

/** La scheda di una persona, cercata prima per numero di scheda e poi per codice.
 *
 *  ⭐ L'ordine non è indifferente: il numero di scheda ce l'hanno tutti e non cambia
 *  mai, il codice ce l'ha una persona su tre e cambia il giorno in cui il circolo la
 *  attiva. Si cerca prima per la chiave che non si muove. Il codice resta come ripiego
 *  per le righe scritte prima del passo 1b, che il numero di scheda non ce l'hanno. */
export function trovaSocio(rubrica: Rubrica, personaId: string, memberId: string): Socio | undefined {
  const perScheda = testo(personaId) ? rubrica.perScheda.get(testo(personaId)) : undefined;
  if (perScheda) return perScheda;
  const codice = codiceSocio(memberId);
  return codice ? rubrica.perCodice.get(codice) : undefined;
}

/** Come si chiama chi ha invitato. Se la sua scheda non c'è si dice quel che si sa:
 *  mai una riga vuota, perché «chi ha invitato chi» è la traccia su cui posa
 *  tutta la sicurezza del progetto — un trattino al suo posto sarebbe una perdita. */
function nomeInvitante(
  rubrica: Rubrica,
  personaId: string,
  memberId: string,
  etichetta?: string | null,
): string {
  const socio = trovaSocio(rubrica, personaId, memberId);
  if (socio && socio.nome) return socio.nome;
  const dalBot = testo(etichetta);
  if (dalBot) return dalBot;
  const codice = codiceSocio(memberId);
  if (codice) return `socio ${codice}`;
  // Ultimo gradino: si dichiara che qualcuno c'è stato, anche senza saperne il nome.
  return testo(personaId) ? 'socio senza scheda leggibile' : '—';
}

/** Chi ha invitato, ricostruito dall'invito quando la riga della guardia non lo dice.
 *
 *  🚨⭐⭐ La guardia registra chi ha invitato SOLO come codice cliente
 *  (`invitato_da_member_id`), e dal passo 1b anche chi invita può non averlo: in quel
 *  caso la colonna resta vuota e questo pannello direbbe «riga messa a mano» di una
 *  persona che invece è entrata regolarmente da un invito. Il dato però non è perso —
 *  la riga porta il `invito_token`, e l'invito sa chi l'ha fatto anche per numero di
 *  scheda. Si recupera di là. */
export type InvitiPerToken = Map<string, RigaInvito>;

export function componiPersona(
  riga: RigaOperatore,
  rubrica: Rubrica,
  inviti: InvitiPerToken = new Map(),
): PersonaVista {
  const codiceNellaRiga = codiceSocio(riga.member_id);
  const personaId = testo(riga.persona_id);
  const socio = trovaSocio(rubrica, personaId, codiceNellaRiga);

  // 🚪⭐⭐ «Senza codice» si legge dall'ANAGRAFICA, non dalla riga del bot — e la riga del
  // bot vale come ripiego, non come verità.
  //
  // 🚨 Il perché è una cosa che il bot ha imparato a fare il 1/08/2026. La sua riga è una
  // FOTOGRAFIA del giorno dell'ingresso e nessuno la riscrive; se fosse lei a decidere,
  // questo pannello direbbe «senza codice» per sempre anche di una persona che il circolo
  // ha attivato ieri. Adesso il bot, prima di rifiutare una prenotazione, richiede al
  // circolo — quindi ciò che decide davvero se questa persona prenota è l'anagrafica.
  // ⇒ Le due fonti si sommano invece di escludersi: basta che UNA delle due abbia un codice
  // vero. Prendere solo l'anagrafica renderebbe «senza codice» una persona che il bot
  // servirebbe lo stesso (la sua riga il codice ce l'ha), e sarebbe un allarme falso.
  const memberId = codiceNellaRiga || (socio ? socio.memberId : '');
  const senzaCodice = !memberId;

  const token = testo(riga.invito_token);
  const invito = token ? inviti.get(token) : undefined;
  const invitanteMemberId = codiceSocio(riga.invitato_da_member_id) || codiceSocio(invito?.invitante_member_id);
  const invitantePersonaId = testo(invito?.invitante_persona_id);
  const viaInvito = !!token || !!invitanteMemberId || !!invitantePersonaId;

  return {
    chatId: testo(riga.chat_id),
    memberId,
    personaId,
    telefonoChiave: testo(riga.telefono_chiave),
    // Senza scheda si mostra l'etichetta scritta dal bot, e `schedaTrovata` resta
    // false: chi guarda deve poter distinguere «non ha un nome» da «non l'ho trovato».
    nome: (socio && socio.nome) || testo(riga.etichetta) || (memberId ? `socio ${memberId}` : '—'),
    telefono: (socio && socio.telefono) || '',
    livello: socio ? livelloLeggibile(socio.livello, socio.autovalutato) : '—',
    schedaTrovata: !!socio,
    senzaCodice,
    invitatoDa: viaInvito
      ? nomeInvitante(rubrica, invitantePersonaId, invitanteMemberId, invito?.invitante_etichetta)
      : '',
    invitatoDaMemberId: invitanteMemberId,
    viaInvito,
    entratoIl: testo(riga.created_at),
    attivo: riga.attivo !== false,
  };
}

/** Lo stato di un invito in una parola sola, nell'ordine in cui i fatti pesano:
 *  ritirato batte tutto (è una decisione presa), poi «usato» (è successo davvero),
 *  poi la scadenza, che è solo il passare del tempo. */
export function statoInvito(riga: RigaInvito, adesso: Date): InvitoVista['stato'] {
  if (riga.annullato === true) return 'ritirato';
  if (testo(riga.usato_il)) return 'usato';
  const scade = testo(riga.scade_il);
  if (scade) {
    const t = Date.parse(scade);
    // Una data illeggibile non fa scadere niente: sarebbe un invito spento per un refuso.
    if (Number.isFinite(t) && t <= adesso.getTime()) return 'scaduto';
  }
  return 'in giro';
}

export function componiInvito(riga: RigaInvito, rubrica: Rubrica, adesso: Date): InvitoVista {
  const stato = statoInvito(riga, adesso);
  const partita = testo(riga.partita);
  const aperto = testo(riga.aperto_il);
  const motivo = stato === 'in giro' && aperto
    ? 'aperto, non ancora completato'
    : (stato === 'usato' ? testo(riga.esito) || 'usato' : '');
  return {
    token: testo(riga.token),
    stato,
    motivo,
    invitante: nomeInvitante(
      rubrica,
      testo(riga.invitante_persona_id),
      testo(riga.invitante_member_id),
      riga.invitante_etichetta,
    ),
    invitanteMemberId: codiceSocio(riga.invitante_member_id),
    // Oggi la colonna `partita` non la scrive ancora nessuno: la forma è pronta e
    // spenta, e si accenderà da sé quando l'invito sarà legato a un posto.
    partita: partita || 'per entrare nel bot',
    creatoIl: testo(riga.creato_il),
    scadeIl: testo(riga.scade_il),
    usatoIl: testo(riga.usato_il),
    esito: testo(riga.esito),
    // Si ritira solo ciò che è ancora in giro: ritirare un invito già speso non
    // toglierebbe niente a nessuno, ma farebbe credere di aver chiuso una porta.
    ritirabile: stato === 'in giro',
  };
}

// ── L'INVITO MANDATO DALLA SEGRETERIA (6/08/2026) ────────────────────────────
//
// 🧭 Nasce da una riflessione del committente: se lo staff mette in partita un socio che
// nel bot non è mai entrato, quella persona è **irraggiungibile** — non riceve i promemoria,
// non vede le sue partite, e se l'organizzatore la toglie non lo sa da nessuno.
//
// ⭐⭐ E nasce da una sua correzione: avevo proposto che fosse il BOT a chiedere
// all'organizzatore di invitarla. Sbagliato — per inserire qualcuno l'organizzatore lo deve
// avere in RUBRICA, e in rubrica ci si entra **solo passando dalla porta del bot** ⇒ chi
// inserisce l'organizzatore è già dentro, sempre. Le uniche persone «fuori» sono quelle
// messe dalla segreteria: la cura va dove nasce il problema.
//
// ⚖️ Regola sua, nella lettura MORBIDA che ha scelto fra le due: la segreteria inserisce
// dall'anagrafica come ha sempre fatto, **e le tocca mandare il link**. Non un divieto —
// che sarebbe stato aggirabile lavorando dritti su Matchpoint, cioè proprio da chi doveva
// rispettarlo — ma un gesto in più nel punto giusto.
//
// 🚨 QUELLO CHE QUESTO INVITO NON FA, e va detto perché è facile crederlo: **non è legato
// al numero del destinatario**. Il link si lega al PRIMO che lo apre. Le tre serrature
// garantiscono che chi entra sia un socio vero col numero certificato da Telegram — non che
// sia *quel* socio. È il disegno dell'ingresso e non si cambia da qui.

/**
 * Il nome che legge chi riceve il link.
 *
 * ⭐⭐ SCELTO DA LUI fra due (6/08): «la segreteria», non il nome dell'operatore. Chi riceve
 * il messaggio riconosce il circolo, e non deve chiedersi chi sia una persona che magari
 * non conosce. ⚠️ Non è un dettaglio di forma: questa stringa finisce dentro la frase «ti
 * ha invitato …» che l'invitato legge nel bot, ed è il primo contatto col circolo.
 */
export const ETICHETTA_SEGRETERIA = 'la segreteria del Padel Village';

/**
 * Il nome utente del bot che apre l'invito, per ambiente.
 *
 * 🚨⭐⭐ È DEDOTTO dall'ambiente e non letto da una variabile, per la stessa ragione per
 * cui lo è `ambienteDa`: è un **fatto della macchina**, non una configurazione che
 * qualcuno può dimenticare — o peggio, sbagliare. Un segreto assente si vede subito
 * (503); un segreto scritto storto no: il link partirebbe **verso un'altra chat**, e
 * chi lo manda leggerebbe «link pronto».
 *
 * ⭐ Il legame non è una convenzione, è una CATENA: l'edge di TEST scrive l'invito con
 * `ambiente='test'`, e quella riga la sa leggere **solo** il bot che si dichiara di
 * prova. Mandare un invito di TEST al bot dei soci darebbe un link che non apre niente.
 * ⇒ Il nome utente non è una preferenza: discende da dove la funzione sta girando.
 *
 * ⚖️ La variabile resta e VINCE se c'è: serve il giorno in cui un bot cambia nome, per
 * non dover deployare. È una via di fuga, non la strada normale.
 */
export const NOMI_UTENTE_BOT: Record<'test' | 'prod', string> = {
  prod: 'loziocoach_bot',
  test: 'padelvillage_prova_bot',
};

export function nomeUtenteBotPer(ambiente: 'test' | 'prod', dallaConfigurazione?: unknown): string {
  const scavalco = testo(dallaConfigurazione).replace(/^@/, '');
  return scavalco || NOMI_UTENTE_BOT[ambiente] || '';
}

/** Il link da incollare: `https://t.me/<bot>?start=<token>`. */
export function linkDiIngresso(nomeUtenteBot: unknown, token: unknown): string {
  const bot = testo(nomeUtenteBot).replace(/^@/, '');
  const t = testo(token);
  // 🚨 Fail closed: senza nome utente il link sarebbe `https://t.me/?start=…`, che non
  // fallisce — porta altrove. Meglio niente link che un link che apre un'altra chat.
  if (!bot || !t) return '';
  return `https://t.me/${bot}?start=${encodeURIComponent(t)}`;
}

/**
 * Il messaggio già scritto che la segreteria manda su WhatsApp.
 *
 * ⭐ Gemello di `messaggioAttivazione` nel bot: il testo parte insieme al link perché chi lo
 * riceve capisca **da chi arriva e a cosa serve** prima di toccarlo — un link nudo dentro
 * WhatsApp, da un numero non salvato, si scambia per spam.
 * ⚠️ È una PROPOSTA: la persona in segreteria può cambiarlo prima di inviare.
 */
export function messaggioInvitoSegreteria(nome: unknown, link: unknown): string {
  const chi = testo(nome);
  const l = testo(link);
  if (!l) return '';
  const saluto = chi ? `Ciao ${chi}, ` : 'Ciao, ';
  return `${saluto}sono la segreteria del Padel Village. Ti ho messo in una partita: con questo link puoi entrare nel nostro assistente su Telegram e vedere quando giochi, con chi, e ricevere i promemoria. ${l}`;
}

export type EsitoNuovoInvito =
  | { ok: true; token: string }
  | { ok: false; motivo: 'socio_ignoto' | 'gia_nel_bot' | 'senza_token' };

/**
 * Si può creare un invito per questa persona?
 *
 * 🚨 Due rifiuti distinti, e non si accorpano: «non la trovo in anagrafica» è un guasto da
 * segnalare, «è già nel bot» è una buona notizia — mandarle un secondo link la manderebbe a
 * rifare una porta che ha già passato, e ci farebbe sembrare che non lo sappiamo.
 * ⭐ Puro: chi chiama gli passa quello che ha letto. Così la decisione si misura senza
 * database, che è il punto in cui su questo progetto i guasti si nascondono.
 */
export function puoCreareInvito(input: {
  socio: Socio | undefined;
  chatGiaNelBot: boolean;
  token: string;
}): EsitoNuovoInvito {
  if (!input.socio) return { ok: false, motivo: 'socio_ignoto' };
  if (input.chatGiaNelBot) return { ok: false, motivo: 'gia_nel_bot' };
  if (!testo(input.token)) return { ok: false, motivo: 'senza_token' };
  return { ok: true, token: testo(input.token) };
}
