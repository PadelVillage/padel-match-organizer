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

export type Permessi = Record<string, unknown>;

export type RigaOperatore = {
  chat_id: number | string;
  member_id: string;
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
  invitante_member_id: string;
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
  memberId: string;
  nome: string;
  telefono: string;
  livello: string;
  autovalutato: boolean;
};

export type PersonaVista = {
  chatId: string;
  memberId: string;
  nome: string;
  telefono: string;
  livello: string;
  schedaTrovata: boolean;
  invitatoDa: string;
  invitatoDaMemberId: string;
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

/** Indicizza le schede dei soci per codice, così la ricerca è una lettura sola
 *  invece di una query per riga. Le righe arrivano da `pmo_cloud_records`. */
export function indicizzaSoci(records: Array<{ payload?: unknown }>): Map<string, Socio> {
  const out = new Map<string, Socio>();
  for (const r of records || []) {
    const payload = (r && typeof r.payload === 'object' && r.payload) ? r.payload as Record<string, unknown> : null;
    if (!payload) continue;
    const memberId = testo(payload.memberId);
    if (!memberId) continue;
    out.set(memberId, {
      memberId,
      nome: nomeDaPayload(payload),
      telefono: testo(payload.phone),
      livello: testo(payload.level),
      autovalutato: !!testo(payload.selfAssessmentDate),
    });
  }
  return out;
}

/** Come si chiama chi ha invitato. Se la sua scheda non c'è si dice il codice:
 *  mai una riga vuota, perché «chi ha invitato chi» è la traccia su cui posa
 *  tutta la sicurezza del progetto — un trattino al suo posto sarebbe una perdita. */
function nomeInvitante(memberId: string, soci: Map<string, Socio>, etichetta?: string | null): string {
  const codice = testo(memberId);
  const socio = codice ? soci.get(codice) : undefined;
  if (socio && socio.nome) return socio.nome;
  const dalBot = testo(etichetta);
  if (dalBot) return dalBot;
  return codice ? `socio ${codice}` : '—';
}

export function componiPersona(riga: RigaOperatore, soci: Map<string, Socio>): PersonaVista {
  const memberId = testo(riga.member_id);
  const socio = soci.get(memberId);
  const invitatoDaId = testo(riga.invitato_da_member_id);
  return {
    chatId: testo(riga.chat_id),
    memberId,
    // Senza scheda si mostra l'etichetta scritta dal bot, e `schedaTrovata` resta
    // false: chi guarda deve poter distinguere «non ha un nome» da «non l'ho trovato».
    nome: (socio && socio.nome) || testo(riga.etichetta) || (memberId ? `socio ${memberId}` : '—'),
    telefono: (socio && socio.telefono) || '',
    livello: socio ? livelloLeggibile(socio.livello, socio.autovalutato) : '—',
    schedaTrovata: !!socio,
    invitatoDa: invitatoDaId ? nomeInvitante(invitatoDaId, soci) : '',
    invitatoDaMemberId: invitatoDaId,
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

export function componiInvito(riga: RigaInvito, soci: Map<string, Socio>, adesso: Date): InvitoVista {
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
    invitante: nomeInvitante(testo(riga.invitante_member_id), soci, riga.invitante_etichetta),
    invitanteMemberId: testo(riga.invitante_member_id),
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
