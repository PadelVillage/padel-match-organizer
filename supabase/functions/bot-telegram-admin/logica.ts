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
