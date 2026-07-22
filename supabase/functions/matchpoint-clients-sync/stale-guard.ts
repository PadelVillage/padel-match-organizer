// Cosa fare di un socio Matchpoint che NON compare più nell'export appena scaricato.
//
// Fino alla v6.124 la risposta era una sola: tombstone (`deleted = true`), cioè il socio SPARISCE
// dall'anagrafica portandosi via livello, note e curatura. Ma «non è più nell'export» ha due
// cause diverse, che meritano esiti diversi:
//
//   ① CHURN DI CHIAVE — la persona è nell'export, solo sotto un'altra `local_key`: il telefono o
//      l'email sono cambiati (o erano storpiati) e l'import l'ha ri-chiavata. Il record vecchio è
//      un doppione morto e il tombstone è giusto. Sono gli 8 casi realmente avvenuti fra il 13 e
//      il 22/07/2026 — Filipe ×3, Longato ×2, Carabajal, Ruzzini, Ceschin: TUTTI churn, nessuna
//      disattivazione vera. Il percorso non è quindi mai stato esercitato sul caso ②.
//   ② USCITA VERA — su Matchpoint il cliente è stato disiscritto (o cancellato, o non è più
//      giocatore) e non compare in nessuna forma. Qui il tombstone è la risposta sbagliata:
//      l'equivalente Matchpoint di «disattivato» è il nostro `active: false`, che la scheda la
//      lascia in piedi. È esattamente ciò che fa il pulsante Disattiva dell'app, e la scrittura
//      nell'altro verso esiste già (matchpoint-clients-disable / -reactivate).
//
// ⭐ IL DISCRIMINANTE È IL CODICE MATCHPOINT, non l'identità del record. Se il codice è fra quelli
// importati in questa passata la persona c'è ancora, punto. Confrontare invece `payload.id`, il
// telefono o l'email dà l'esito SBAGLIATO su 2 degli 8 casi reali (le due chiavi di Filipe del
// 20 e 22/07): proprio nel churn i contatti sono quelli storpiati, quindi non combaciano più —
// misurato, non previsto. Il codice invece l'export lo riporta identico.
//
// Perché non serve leggere i disattivati da Matchpoint: nessuna delle due esportazioni che
// scarichiamo ha una colonna di stato (né l'Elenco giocatori né l'Elenco clienti), quindi
// «assente dall'export» è l'unico segnale disponibile — e basta.

export const MATCHPOINT_INACTIVE_REASON = 'matchpoint_snapshot_absent';

export type StaleOutcome = 'tombstone' | 'deactivate' | 'keep';

type Payload = Record<string, unknown> | null | undefined;

function clean(value: unknown) {
  return String(value ?? '').trim();
}

// Codice Matchpoint = sole cifre (3+). I segnaposto `PMO-…` li genera l'app: su quelli l'export
// non è autorevole, perché Matchpoint non li conosce affatto.
export function isMatchpointCode(value: unknown) {
  return /^\d{3,}$/.test(clean(value));
}

// «Questo record lo governa l'export di Matchpoint?» — due firme perché `source` è stato
// introdotto dopo: i record importati prima hanno solo `matchpointImportedAt`.
// Estratta per essere anche il DENOMINATORE del tetto qui sotto: la stessa definizione che
// decide chi può essere potato deve contare chi è a rischio, altrimenti il tetto si tara su
// una popolazione diversa da quella che protegge.
export function isMatchpointGoverned(payload: Payload) {
  const p = payload || {};
  return clean(p.source) === 'matchpoint_auto' || !!clean(p.matchpointImportedAt);
}

export function decideStaleMember(payload: Payload, importedMemberIds: Set<string>): StaleOutcome {
  const p = payload || {};
  if (!isMatchpointGoverned(p)) return 'keep';

  const code = clean(p.memberId);
  // Senza un codice Matchpoint manca l'identificatore su cui l'export è autorevole: non possiamo
  // affermare «è uscito dall'elenco». Resta il comportamento di prima.
  if (!isMatchpointCode(code)) return 'tombstone';

  // ① La persona è in questa passata, sotto un'altra chiave: questo record è un doppione morto.
  // Va PRIMA del controllo su `active`: un doppione va potato anche se era già inattivo.
  if (importedMemberIds.has(code)) return 'tombstone';

  // Già disattivato — dallo staff a mano, o da una passata precedente di questa stessa regola:
  // non c'è niente da riscrivere.
  if (p.active === false) return 'keep';

  // ② Uscita vera.
  return 'deactivate';
}

// ── Tetto per passata ────────────────────────────────────────────────────────
//
// `decideStaleMember` decide RECORD PER RECORD, quindi da sola non ha idea di quanti ne stia
// toccando: è corretta su ogni singolo socio e catastrofica su tutti insieme. Se l'export
// arriva troncato, filtrato, o semplicemente DIVERSO da quello di ieri, centinaia di codici
// spariscono in un colpo e ognuno di quei record prende la strada ② — disattivato, in
// silenzio, di notte, senza che nessuno guardi.
//
// ⚠️ Non è un'ipotesi di scuola: il 22/07 l'import di produzione è entrato dal FALLBACK
// (`fallbackFrom: MATCHPOINT_LOGIN_FAILED`, `navigationMode: players_menu`), cioè il percorso
// primario — l'Elenco CLIENTI — è fallito e si è ripiegato sull'Elenco GIOCATORI. Sono due
// export con popolazioni diverse per costruzione (giocatori ⊆ clienti attivi). Oggi coincidono
// quasi (1053 contro 1057) e infatti non è successo nulla, ma è una coincidenza, non una
// garanzia: il giorno che divergono, la differenza diventa disattivazioni di massa.
//
// TARATURA, misurata su PROD il 22/07 — non scelta a occhio:
//   · popolazione governata dall'export ......... 1050 soci Matchpoint
//   · esito del giro stale, per GIORNO .......... 0-3 (13→22/07, sei passate al giorno)
//   · disattivazioni vere mai avvenute .......... 0
// Il tetto sta quindi ~8× sopra il rumore osservato e ~40× sotto il danno possibile.
//
// ⚠️ Conta il TOTALE dei due esiti, non le sole disattivazioni. Nascono dallo stesso segnale
// («questo codice non è nell'export») e il tombstone è il più distruttivo dei due — si porta
// via livello, note e curatura. Cappare solo le disattivazioni lascerebbe aperta la strada
// peggiore: sotto un export troncato cresce anche il tombstone dei record senza codice MP.
//
// Quando scatta NON annulla l'import: le righe PRESENTI nell'export sono comunque buone, è
// l'ASSENZA a non essere affidabile. Salta il solo giro stale, e la passata dopo — se l'export
// è tornato normale — fa la cosa giusta da sé. Un falso positivo costa una passata di ritardo;
// un falso negativo costa l'anagrafica. L'asimmetria decide da che parte sbagliare.
//
// ⭐ È la stessa forma della protezione «report vuoto ⇒ non stornare nulla» che regge la
// riconciliazione dei pagamenti, generalizzata da «vuoto» a «troppo».

// Tetto PIATTO, non una percentuale della popolazione. Ci ero arrivato con un
// `max(25, 2% dei soci)` e la misura l'ha bocciato: con 1050 soci il 2% fa 21, quindi il
// termine relativo non entra MAI in gioco — è inerte — e il giorno che entrasse andrebbe nella
// direzione sbagliata, allargando il tetto a 100 disattivazioni silenziose su 5000 soci.
// Un numero che oggi non fa nulla e domani fa danno non vale la riga che costa.
export const STALE_SWEEP_MAX_PER_PASS = 25;

export type StaleSweepVerdict = {
  apply: boolean;
  total: number;
  cap: number;
  considered: number;
};

// `considered` NON entra nella decisione: è solo diagnostica, serve a leggere «25 su quanti».
// Tenerlo fuori dal confronto è deliberato — vedi sopra.
export function decideStaleSweep(counts: {
  tombstones?: unknown;
  deactivations?: unknown;
  considered?: unknown;
}): StaleSweepVerdict {
  const count = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  };
  const total = count(counts?.tombstones) + count(counts?.deactivations);
  return {
    apply: total <= STALE_SWEEP_MAX_PER_PASS,
    total,
    cap: STALE_SWEEP_MAX_PER_PASS,
    considered: count(counts?.considered),
  };
}

// 🔜 SE UN GIORNO SCATTA DAVVERO e l'export è genuino (il circolo ha disiscritto 40 persone in
// un colpo), non c'è un interruttore: questa funzione non legge opzioni, e il handler non
// legge nemmeno un body. È una scelta, non una dimenticanza — aggiungere un override significa
// toccare la superficie d'autenticazione di una funzione che gira anche da routine, per un
// caso MAI avvenuto (disattivazioni vere misurate su PROD: 0, sempre).
// Le due vie, in ordine di preferenza: ① disattivare i soci dall'app, che scrive anche su
// Matchpoint; ② alzare questa costante, deployare, lasciar girare una passata, rimetterla.
// Lo stato bloccato è RUMOROSO, non silenzioso: `staleSweepBlocked` e il campione stanno nel
// report di ogni passata, quindi nessuno ci finisce dentro senza accorgersene.

export type MemberCloudRecord = {
  record_type: string;
  local_key: string;
  payload: Record<string, unknown>;
  payload_hash: null;
  deleted: boolean;
  synced_at: string;
};

// Il tipo di ritorno è annotato di proposito: senza, lo spread del payload fa collassare
// l'inferenza sulle sole chiavi scritte qui sotto, e chi legge `payload.memberId` a valle
// (il campione nel report) non compila.
export function buildDeactivatedMemberRecord(
  record: { local_key?: unknown; payload?: Payload },
  importedAt: string,
): MemberCloudRecord {
  const payload: Record<string, unknown> = record?.payload || {};
  return {
    record_type: 'member',
    local_key: clean(record?.local_key),
    payload: {
      ...payload,
      active: false,
      matchpointInactiveAt: importedAt,
      matchpointInactiveReason: MATCHPOINT_INACTIVE_REASON,
      updatedAt: importedAt,
    },
    payload_hash: null,
    deleted: false,
    synced_at: importedAt,
  };
}

// Campi `active…` da scrivere quando il socio VIENE importato. Se torna nell'export dopo essere
// stato disattivato da questa regola, la disattivazione va sciolta: altrimenti un «Riattivare»
// fatto su Matchpoint non arriverebbe mai fino a noi — lo stesso guasto, al contrario.
// Una disattivazione fatta A MANO nell'app non ha il marcatore e resta intatta.
export function activeFieldsOnImport(existing: Payload) {
  const e = existing || {};
  const auto = clean(e.matchpointInactiveReason) === MATCHPOINT_INACTIVE_REASON;
  if (e.active === false && !auto) return { active: false };
  if (auto) return { active: true, matchpointInactiveAt: '', matchpointInactiveReason: '' };
  return { active: true };
}
