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

export function decideStaleMember(payload: Payload, importedMemberIds: Set<string>): StaleOutcome {
  const p = payload || {};
  const isMatchpointRecord = clean(p.source) === 'matchpoint_auto' || !!clean(p.matchpointImportedAt);
  if (!isMatchpointRecord) return 'keep';

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
