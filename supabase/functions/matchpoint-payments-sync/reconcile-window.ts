// Regole PURE della finestra di riconciliazione tombstone, estratte da index.ts per poterle
// provare senza far girare il sync (stesso schema di ./member-code-guard.ts).
//
// ⚠️ Il difetto che questo modulo esiste per chiudere — PROD, 22/07: 768 incassi cancellati per
// €9.866, invisibili nella sezione Incassi. La riconciliazione deduceva la propria finestra da
// min/max delle DATE DI PAGAMENTO presenti nel report, ma il report 11.13 è filtrato sul GIORNO
// DELLA PRENOTAZIONE. Sono due assi diversi, e ai bordi il report è incompleto PER COSTRUZIONE:
// chi paga il 9 per giocare l'11 fa sbordare la finestra al 9, giorno in cui il report contiene
// SOLO i pagamenti legati a prenotazioni della finestra richiesta. La riconciliazione lo
// trattava come completo e stornava tutto il resto di quel giorno.
//
// Due decisioni di disegno, misurate PRIMA di scrivere il codice:
//
// 1. La finestra non si deduce dal CONTENUTO del report: la si prende da chi l'ha imposta.
//    Il worker la calcola (`days` → [oggi−days, oggi]), la scrive nel filtro del report e la
//    RESTITUISCE nella risposta (server.mjs, `dateFrom`/`dateTo`). L'edge la buttava via e la
//    ri-derivava a valle: la radice del guasto è tutta in quel dato scartato.
//
// 2. Il confronto va fatto sull'asse su cui il report è FILTRATO — `booking_data` — non sulla
//    data di pagamento. Restringere la finestra tenendo l'asse sbagliato NON basta, ed è la
//    ragione per cui le due strade annotate a caldo il 22/07 sera sarebbero state entrambe
//    ancora sbagliate: misurato su PROD, riconciliare sull'asse del pagamento lungo 46 passate
//    cron simulate avrebbe stornato a torto 30 incassi veri (€331). Su 1815 record vivi, 41
//    hanno data di pagamento diversa dal giorno prenotato — fino a 16 giorni di anticipo e 13
//    di ritardo — e sono esattamente quelli che i due assi trattano in modo opposto.

export type ReconcileWindowSource = 'worker' | 'body' | 'observed' | 'none';
export type ReconcileWindow = { from: string; to: string; source: ReconcileWindowSource };
export type ExistingPayment = { local_key: string; payload: Record<string, unknown> };

// L'ASSE della riconciliazione, in un posto solo. È il campo su cui il report 11.13 è filtrato,
// e sceglierlo È il fix: sta qui, dentro il modulo provato, e non nel chiamante, perché una
// suite che riceve già estratto il valore giusto non può accorgersi che qualcuno le passa
// l'altro campo. Lo usa anche index.ts per il filtro della query, così i due lati non possono
// divergere per distrazione.
export const RECONCILE_DATE_FIELD = 'booking_data';

export function bookingDayOf(payload: Record<string, unknown> | null | undefined): string {
  return toIsoDate((payload || {})[RECONCILE_DATE_FIELD]);
}

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const IT_DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function clean(value: unknown) {
  return String(value ?? '').trim();
}

// Accetta ISO ("2026-06-11") e italiano ("11/06/2026"), che è la forma in cui il worker
// restituisce la finestra (`fmtDateIt`). La conversione sta QUI e non al confine in index.ts
// apposta: è il punto in cui la finestra entra nel ragionamento, e va coperta dalla suite
// invece di vivere in una riga non provata.
export function toIsoDate(value: unknown): string {
  const s = clean(value);
  const iso = s.match(ISO_DATE_RE);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const it = s.match(IT_DATE_RE);
  if (it) return `${it[3]}-${it[2].padStart(2, '0')}-${it[1].padStart(2, '0')}`;
  return '';
}

// Span OSSERVATO dei giorni prenotati nel report. Usato solo come ripiego (vedi sotto).
export function observedBookingDaySpan(bookingDays: unknown[]): { from: string; to: string } {
  let from = '';
  let to = '';
  for (const raw of bookingDays || []) {
    const day = toIsoDate(raw);
    if (!day) continue;
    if (!from || day < from) from = day;
    if (!to || day > to) to = day;
  }
  return { from, to };
}

// Precedenza: worker → body → span osservato.
//
// Il WORKER vince sul body e non è un dettaglio: la finestra che conta è quella davvero digitata
// nel filtro del report, e solo il worker la conosce. Il body è una RICHIESTA, l'eco del worker è
// un FATTO — e le due possono divergere (il worker completa la parte mancante: con solo
// `dateFrom` mette `dateTo` = oggi, con `days` calcola entrambe). Il body resta come sorgente per
// il percorso manuale `xlsxBase64`, dove nessun worker ha girato.
//
// Il ripiego sullo span osservato è sicuro PROPRIO perché sta sull'asse del filtro: se il report
// copre i giorni prenotati [F,T] e quelli osservati sono [minB,maxB] ⊆ [F,T], allora per ogni
// giorno d in [minB,maxB] il report contiene TUTTI i pagamenti di quel giorno. Restringere così
// può al massimo far PERDERE uno storno (un giorno di bordo interamente annullato), mai
// cancellare un incasso vero. Sull'asse del PAGAMENTO questa proprietà non vale — ed è
// esattamente il difetto del 22/07.
export function resolveReconcileWindow(opts: {
  workerDateFrom?: unknown;
  workerDateTo?: unknown;
  bodyDateFrom?: unknown;
  bodyDateTo?: unknown;
  reportBookingDays?: unknown[];
}): ReconcileWindow {
  const workerFrom = toIsoDate(opts.workerDateFrom);
  const workerTo = toIsoDate(opts.workerDateTo);
  if (workerFrom && workerTo) return { from: workerFrom, to: workerTo, source: 'worker' };

  const bodyFrom = toIsoDate(opts.bodyDateFrom);
  const bodyTo = toIsoDate(opts.bodyDateTo);
  if (bodyFrom && bodyTo) return { from: bodyFrom, to: bodyTo, source: 'body' };

  const observed = observedBookingDaySpan(opts.reportBookingDays || []);
  if (observed.from && observed.to) return { from: observed.from, to: observed.to, source: 'observed' };

  return { from: '', to: '', source: 'none' };
}

// Le chiavi da tombstonare: i `pay|…` vivi il cui GIORNO PRENOTATO cade nella finestra del
// report e che dal report sono spariti (= stornati/mutati in Matchpoint).
export function selectTombstoneKeys(opts: {
  existing: ExistingPayment[];
  reportKeys: Set<string>;
  window: ReconcileWindow;
  reportRowCount: number;
}): string[] {
  const { existing, reportKeys, window, reportRowCount } = opts;

  // Report VUOTO ⇒ non stornare NULLA. Un export fallito, una sessione scaduta e un periodo
  // realmente senza incassi producono lo stesso file vuoto, e i tre casi non si distinguono da
  // qui. La protezione esisteva già nel codice vecchio ed è PIÙ importante adesso, non meno:
  // prima una finestra vuota si auto-annullava (nessuna data ⇒ nessuna riconciliazione), ora la
  // finestra arriva dal worker ed è sempre valida, quindi senza questa riga un export a vuoto
  // cancellerebbe l'intero periodo in un colpo.
  if (reportRowCount <= 0) return [];
  if (!window.from || !window.to) return [];

  const keys: string[] = [];
  for (const row of existing || []) {
    const day = bookingDayOf(row.payload);
    // Senza giorno prenotato non si può sapere se il report avrebbe dovuto contenerlo → si
    // lascia stare. Conservativo nella direzione giusta: al massimo resta contato un pagamento
    // già stornato, mai cancellato un incasso vero. Misurato su PROD il 22/07: 0 record vivi su
    // 1815 senza `booking_data`, quindi oggi questo ramo non scatta — ma il giorno che scattasse
    // è meglio che sbagli così.
    if (!day) continue;
    if (day < window.from || day > window.to) continue;
    if (reportKeys.has(row.local_key)) continue;
    keys.push(row.local_key);
  }
  return keys;
}
