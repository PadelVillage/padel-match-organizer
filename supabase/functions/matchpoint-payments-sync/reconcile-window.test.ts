// Test deterministici della finestra di riconciliazione (nessuna dipendenza esterna).
// Esegui:  node supabase/functions/matchpoint-payments-sync/reconcile-window.test.ts
//
// ⭐ TARATURA — MISURATA sabotando (un sabotaggio alla volta, ripristino e riverifica del verde),
// non prevista:
//
//   sabotaggio                                             casi che diventano rossi
//   ────────────────────────────────────────────────       ────────────────────────
//   nessuno                                                —  (13 verdi)
//   RECONCILE_DATE_FIELD = 'data' (asse del PAGAMENTO)     B G E J L      ← ma NON A
//   tolto il filtro della finestra                         A B L
//   tolta la protezione report vuoto                       D
//   eco del worker ignorata (vince il body)                F
//   tolto il salto per booking_data assente                nessuno  (vedi ⚠️ sotto)
//   tolta la protezione finestra assente                   nessuno  (vedi ⚠️ sotto)
//
// 🚨 **A resta VERDE quando si rimette l'asse sbagliato**, ed è il punto di tutta la suite. A è
// il guasto reale del 22/07 (768 record, €9.866): un pagamento pagato E prenotato fuori finestra.
// Le due strade annotate a caldo quella sera («riconcilia su [dateFrom,dateTo] richiesti» e
// «riconcilia sull'intersezione») lo superano ENTRAMBE pur restando sbagliate, perché lavorano
// sull'asse della data di pagamento e in A le due date coincidono. Chi si fosse tarato sul caso
// vero avrebbe promosso un fix ancora rotto — stavolta con la firma verde della regressione.
//
// ⚠️ SAB.5 e SAB.6 non fanno cadere NIENTE: `if (!day) continue` e `if (!window.from || ...)`
// sono ridondanti col confronto d'intervallo, che scarta già le stringhe vuote (`'' < '2026-…'`
// è vero). Restano come difesa in profondità, ma vanno considerate NON COPERTE dalla suite: se
// un domani il confronto passasse a oggetti Date o a un ordinamento diverso, quelle due righe
// diventerebbero portanti senza che un rosso lo segnali. Misurato, non supposto.
// → Il caso che discrimina è B, ed è COSTRUITO: pagato DENTRO la finestra ma prenotato FUORI.
//   Lì i due assi danno esito opposto, e solo quello sulla prenotazione salva l'incasso.
//   Non è ipotetico: misurati su PROD il 22/07, 41 incassi vivi su 1815 hanno le due date
//   diverse (fino a 16 giorni di anticipo), e su 46 passate cron simulate l'asse sbagliato
//   avrebbe stornato a torto 30 record veri per €331.
//
// C e G sono i controlli NEGATIVI, e senza di loro la suite premierebbe il difetto peggiore:
// un'implementazione che non storna MAI supererebbe A, B, D ed E a pieni voti. G è il gemello
// speculare di B (prenotato dentro, pagato fuori) ed è il caso che il codice VECCHIO mancava:
// l'asse sbagliato non solo cancellava incassi veri, si lasciava anche sfuggire storni veri.
import assert from 'node:assert/strict';
import {
  bookingDayOf,
  observedBookingDaySpan,
  resolveReconcileWindow,
  selectTombstoneKeys,
  toIsoDate,
  type ExistingPayment,
} from './reconcile-window.ts';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`ok   - ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL - ${name}\n      ${(e as Error).message}`);
  }
}

// Un `payment` vivo come sta in pmo_cloud_records: `data` = giorno del PAGAMENTO,
// `booking_data` = giorno PRENOTATO (l'asse su cui il report è filtrato).
const rec = (local_key: string, bookingData: string, payData: string): ExistingPayment => ({
  local_key,
  payload: { booking_data: bookingData, data: payData, amount_cents: 2000 },
});

// La finestra del report usata da quasi tutti i casi: giorni PRENOTATI 11→15 giugno.
// È la stessa della misura del 22/07 su TEST che ha scoperto il difetto (tombstoned: 92).
const WINDOW = { from: '2026-06-11', to: '2026-06-15', source: 'worker' as const };

const run = (existing: ExistingPayment[], reportKeys: string[], opts: { window?: typeof WINDOW; rows?: number } = {}) =>
  selectTombstoneKeys({
    existing,
    reportKeys: new Set(reportKeys),
    window: opts.window ?? WINDOW,
    reportRowCount: opts.rows ?? 196,
  });

// A) IL CASO REALE — il guasto del 22/07 su PROD (768 record, €9.866). Un incasso pagato il
//    09/06 per una prenotazione del 09/06: fuori finestra su ENTRAMBI gli assi, quindi il report
//    legittimamente non lo contiene. Il codice vecchio faceva sbordare minPayDate al 09/06
//    (per via di chi paga in anticipo) e stornava tutto il resto di quel giorno.
test('A) pagato e prenotato FUORI finestra → non si tocca (il guasto dei 768)', () => {
  const keys = run([rec('pay|336|326|2026-06-09|2000|card|1', '2026-06-09', '2026-06-09')], []);
  assert.deepEqual(keys, []);
});

// B) 🎯 IL CASO CHE DISCRIMINA — pagamento ANTICIPATO. Pagato il 12/06, cioè DENTRO la finestra
//    se si guarda la data di pagamento, ma prenotato il 20/06, cioè FUORI se si guarda il giorno
//    prenotato. Il report (filtrato sulle prenotazioni 11→15) non lo contiene, e ha ragione.
//    Chi riconcilia sull'asse del pagamento lo storna: è un incasso VERO che sparisce.
//    Questo caso separa il fix giusto dalle due strade scritte a caldo il 22/07 sera.
test('B) pagato DENTRO ma prenotato FUORI → non si tocca (uccide l\'asse del pagamento)', () => {
  const keys = run([rec('pay|501|77|2026-06-12|2000|card|1', '2026-06-20', '2026-06-12')], []);
  assert.deepEqual(keys, []);
});

// C) CONTROLLO NEGATIVO — lo storno VERO. Prenotato il 12/06 (dentro la finestra), quindi il
//    report avrebbe dovuto contenerlo; non c'è ⇒ è stato annullato in Matchpoint ⇒ va tombstonato.
//    Senza questo caso, «non stornare mai» passerebbe la suite.
test('C) prenotato DENTRO e sparito dal report → si storna', () => {
  const keys = run([rec('pay|502|78|2026-06-12|2000|card|1', '2026-06-12', '2026-06-12')], []);
  assert.deepEqual(keys, ['pay|502|78|2026-06-12|2000|card|1']);
});

// G) CONTROLLO NEGATIVO, gemello speculare di B — pagato DOPO. Prenotato il 12/06 (dentro), ma
//    saldato il 20/06 (fuori finestra sull'asse del pagamento). È sparito dal report ⇒ va
//    stornato. Il codice vecchio lo MANCAVA: l'asse sbagliato sbagliava in tutt'e due i versi.
test('G) prenotato DENTRO ma pagato FUORI e sparito → si storna (il vecchio lo mancava)', () => {
  const keys = run([rec('pay|503|79|2026-06-20|2000|card|1', '2026-06-12', '2026-06-20')], []);
  assert.deepEqual(keys, ['pay|503|79|2026-06-20|2000|card|1']);
});

// H) CONTROLLO NEGATIVO di base: chi è ancora nel report non si tocca mai.
test('H) chiave ancora presente nel report → non si tocca', () => {
  const key = 'pay|504|80|2026-06-12|2000|card|1';
  assert.deepEqual(run([rec(key, '2026-06-12', '2026-06-12')], [key]), []);
});

// D) Report VUOTO ⇒ non si storna NULLA, anche con una finestra valida. Export fallito, sessione
//    scaduta e periodo davvero senza incassi sono indistinguibili da qui; con la finestra ora
//    sempre valida, senza questa protezione un export a vuoto cancellerebbe l'intero periodo.
test('D) report vuoto → non storna nulla nemmeno con finestra valida', () => {
  const keys = run([rec('pay|505|81|2026-06-12|2000|card|1', '2026-06-12', '2026-06-12')], [], { rows: 0 });
  assert.deepEqual(keys, []);
});

// E) Record senza giorno prenotato: non si può sapere se il report avrebbe dovuto contenerlo →
//    si lascia stare. Su PROD oggi sono 0 su 1815, ma il ramo deve sbagliare in modo conservativo.
test('E) booking_data assente → non si tocca (conservativo)', () => {
  const orphan: ExistingPayment = { local_key: 'pay|506|82|2026-06-12|2000|card|1', payload: { data: '2026-06-12' } };
  assert.deepEqual(run([orphan], []), []);
});

// F) Precedenza della finestra: il WORKER vince sul body, perché è l'unico che sa cosa è stato
//    davvero digitato nel filtro del report. Il body è una richiesta, l'eco del worker un fatto.
test('F) precedenza worker > body > osservata', () => {
  const w = resolveReconcileWindow({
    workerDateFrom: '11/06/2026', workerDateTo: '15/06/2026',
    bodyDateFrom: '2026-01-01', bodyDateTo: '2026-12-31',
    reportBookingDays: ['2026-06-13'],
  });
  assert.deepEqual(w, { from: '2026-06-11', to: '2026-06-15', source: 'worker' });

  const b = resolveReconcileWindow({
    bodyDateFrom: '2026-06-11', bodyDateTo: '2026-06-15',
    reportBookingDays: ['2026-06-13'],
  });
  assert.deepEqual(b, { from: '2026-06-11', to: '2026-06-15', source: 'body' });

  const o = resolveReconcileWindow({ reportBookingDays: ['2026-06-13', '2026-06-11', '2026-06-15'] });
  assert.deepEqual(o, { from: '2026-06-11', to: '2026-06-15', source: 'observed' });

  const none = resolveReconcileWindow({});
  assert.equal(none.source, 'none');
});

// F2) Una finestra a metà (solo `dateFrom`) NON è una finestra: il worker la completa e la sua
//     eco è quella giusta. Se non c'è worker si ripiega, non si inventa il bordo mancante.
test('F2) body incompleto non produce una finestra', () => {
  const w = resolveReconcileWindow({ bodyDateFrom: '2026-06-11', reportBookingDays: ['2026-06-13'] });
  assert.equal(w.source, 'observed');
  assert.deepEqual({ from: w.from, to: w.to }, { from: '2026-06-13', to: '2026-06-13' });
});

// I) Il worker restituisce la finestra in formato italiano (`fmtDateIt`): va letta, non ignorata.
//    Una conversione sbagliata qui produrrebbe una finestra vuota → riconciliazione muta.
test('I) toIsoDate accetta la forma del worker (italiana) e l\'ISO', () => {
  assert.equal(toIsoDate('11/06/2026'), '2026-06-11');
  assert.equal(toIsoDate('1/6/2026'), '2026-06-01');
  assert.equal(toIsoDate('2026-06-11'), '2026-06-11');
  assert.equal(toIsoDate(''), '');
  assert.equal(toIsoDate('giovedì'), '');
  assert.equal(toIsoDate(null), '');
});

// J) L'estrazione dell'asse, isolata: `bookingDayOf` deve leggere il GIORNO PRENOTATO.
//    È il punto che, cambiato, riapre il difetto — per questo ha un caso suo.
test('J) bookingDayOf legge il giorno PRENOTATO, non quello del pagamento', () => {
  assert.equal(bookingDayOf({ booking_data: '2026-06-20', data: '2026-06-12' }), '2026-06-20');
  assert.equal(bookingDayOf({ data: '2026-06-12' }), '');
  assert.equal(bookingDayOf(null), '');
});

// K) Lo span osservato ignora le celle non parsabili invece di allargarsi a caso.
test('K) observedBookingDaySpan ignora i valori non parsabili', () => {
  assert.deepEqual(observedBookingDaySpan(['2026-06-14', '', 'x', '2026-06-12']), { from: '2026-06-12', to: '2026-06-14' });
  assert.deepEqual(observedBookingDaySpan([]), { from: '', to: '' });
});

// L) Prova d'insieme sulla forma del guasto reale: un lotto misto in cui SOLO i due sparsi
//    dentro finestra vanno stornati. È il caso che riproduce la misura di TEST del 22/07
//    (tombstoned atteso 0 sui record fuori asse, non 92).
test('L) lotto misto → si stornano solo i prenotati-dentro spariti', () => {
  const keys = run([
    rec('k-fuori-entrambi', '2026-06-09', '2026-06-09'),   // A
    rec('k-anticipato', '2026-06-20', '2026-06-12'),        // B
    rec('k-dentro-sparito', '2026-06-13', '2026-06-13'),    // C → storna
    rec('k-pagato-dopo', '2026-06-12', '2026-06-20'),       // G → storna
    rec('k-ancora-nel-report', '2026-06-14', '2026-06-14'), // H
  ], ['k-ancora-nel-report']);
  assert.deepEqual(keys.sort(), ['k-dentro-sparito', 'k-pagato-dopo']);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
