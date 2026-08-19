// Com'è andata una scrittura di esito ignoto — test deterministici, nessuna dipendenza esterna.
// Esegui:  node supabase/functions/consumer-booking-write/esito-scrittura.test.ts
//
// ⭐ Gli istanti dei casi 1-3 NON sono inventati: sono la notte del 15/08/2026 letta su PROD in
// sola lettura — la scrittura rimasta ignota delle 22:27:16, il fallimento del sync delle
// 22:28:02, i giri atterrati delle 22:18:02 e 22:06:02. È la sera che ha fatto nascere la voce
// 53, ed è il caso che questa funzione esiste per non sbagliare.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  esitoIgnotoDaRisposta,
  FINESTRA_SYNC_GIORNI,
  MARGINE_SCRITTURA_S,
  MOTIVO_SCRITTURA_RIFIUTATA,
  giornoPiu,
  verdettoScrittura,
} from './esito-scrittura.ts';
import { rosterDelloSlot, type RigaSlot } from './roster-slot.ts';

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

const cartella = dirname(fileURLToPath(import.meta.url));
const OGGI = '2026-08-15';
/** Il verdetto in una stringa sola: `esito/motivo/attendere`. */
const v = (o: Parameters<typeof verdettoScrittura>[0]) => {
  const r = verdettoScrittura(o);
  return `${r.esito}/${r.motivo}/${r.attendere ? 'aspetta' : 'basta'}`;
};

// ── La notte vera ──────────────────────────────────────────────────────────────────────────
const SCRITTA = '2026-08-15T22:27:16.314Z';   // il booking_job rimasto ignoto
const SYNC_PRIMA = '2026-08-15T22:18:02.636Z'; // ultimo giro atterrato PRIMA
const SYNC_DOPO = '2026-08-15T22:31:00.000Z';  // un giro atterrato dopo, oltre il margine

test('1) LA NOTTE DEL 15/08: copia ferma a prima della scrittura ⇒ non si dice «no»', () => {
  assert.equal(
    v({ presente: false, scrittaAlle: SCRITTA, copiaFrescaAl: SYNC_PRIMA, giornoSlot: '2026-09-01', oggi: OGGI }),
    'non_ancora/copia_ferma/aspetta',
  );
});

test('2) LA NOTTE DEL 15/08: la prenotazione C’ERA ⇒ «si», e la freschezza non c’entra', () => {
  // ⭐ Il verdetto vero di quella sera, dato dall'app dopo 8 tentativi: `verdetto: "si"`.
  // Qui si dà la copia FERMA apposta: una presenza non ha bisogno di essere fresca.
  assert.equal(
    v({ presente: true, scrittaAlle: SCRITTA, copiaFrescaAl: SYNC_PRIMA, giornoSlot: '2026-09-01', oggi: OGGI }),
    'si/trovata/basta',
  );
});

test('3) un giro atterrato DOPO la scrittura ⇒ allora sì che «non c’è» vuol dire no', () => {
  assert.equal(
    v({ presente: false, scrittaAlle: SCRITTA, copiaFrescaAl: SYNC_DOPO, giornoSlot: '2026-08-17', oggi: OGGI }),
    'no/copia_aggiornata_dopo/basta',
  );
});

test('4) IL MARGINE: un giro atterrato SUBITO dopo non basta, uno oltre i 150 s sì', () => {
  const t0 = Date.parse(SCRITTA);
  const dopo = (s: number) => new Date(t0 + s * 1000).toISOString();
  // 🚨 È il cuore del margine: quando l'esito è ignoto il worker si è piantato, e la scrittura
  // può atterrare DOPO che il bot ha perso il contatto. Un giro partito nel frattempo non l'ha
  // vista, e il suo silenzio non è una prova.
  assert.equal(v({ presente: false, scrittaAlle: SCRITTA, copiaFrescaAl: dopo(30), giornoSlot: '2026-08-17', oggi: OGGI }), 'non_ancora/copia_ferma/aspetta');
  assert.equal(v({ presente: false, scrittaAlle: SCRITTA, copiaFrescaAl: dopo(MARGINE_SCRITTURA_S - 1), giornoSlot: '2026-08-17', oggi: OGGI }), 'non_ancora/copia_ferma/aspetta');
  assert.equal(v({ presente: false, scrittaAlle: SCRITTA, copiaFrescaAl: dopo(MARGINE_SCRITTURA_S), giornoSlot: '2026-08-17', oggi: OGGI }), 'no/copia_aggiornata_dopo/basta');
});

test('5) OLTRE LA FINESTRA: non è «aspetta», è «qui non si saprà mai»', () => {
  // 📏 Misurato: `idReserva 9434`, creata il 14/08 per il 14/12/2026 (121 giorni avanti), non è
  // mai comparsa nella copia. Aspettarla sarebbe tempo regalato, e il bot deve poterlo dire.
  //
  // 🚨 I GIORNI SONO SCRITTI A MANO, e la prima stesura non lo faceva: costruiva l'ingresso con
  // `giornoPiu(OGGI, FINESTRA_SYNC_GIORNI + 1)`, cioè **con la costante che avrebbe dovuto
  // provare**. Allargando la finestra a 60 si spostava anche il caso, e restava VERDE —
  // scoperto sabotando, non rileggendo. Un caso che deriva il proprio ingresso da ciò che
  // controlla non controlla niente.
  assert.equal(
    v({ presente: false, scrittaAlle: SCRITTA, copiaFrescaAl: SYNC_DOPO, giornoSlot: '2026-09-15', oggi: OGGI }),
    'non_ancora/fuori_finestra/basta',
  );
  // L'ultimo giorno dentro la finestra si comporta invece da giorno normale: 15/08 + 30 = 14/09.
  assert.equal(
    v({ presente: false, scrittaAlle: SCRITTA, copiaFrescaAl: SYNC_DOPO, giornoSlot: '2026-09-14', oggi: OGGI }),
    'no/copia_aggiornata_dopo/basta',
  );
});

test('6) OLTRE LA FINESTRA ma la riga c’è lo stesso ⇒ «si» (l’ordine dei controlli conta)', () => {
  // Una prenotazione oltre i 30 giorni può essere visibile come `staff_booking`, che si scrive
  // di qua e non dipende dal sync. Se il `si` non venisse per primo, si direbbe «non lo so» su
  // una prenotazione che si sta guardando.
  assert.equal(
    v({ presente: true, scrittaAlle: SCRITTA, copiaFrescaAl: null, giornoSlot: giornoPiu(OGGI, 90), oggi: OGGI }),
    'si/trovata/basta',
  );
});

test('7) FAIL CLOSED: senza istante di scrittura, o senza copia, non esce mai un «no»', () => {
  assert.equal(v({ presente: false, scrittaAlle: null, copiaFrescaAl: SYNC_DOPO, giornoSlot: '2026-08-17', oggi: OGGI }), 'non_ancora/istante_ignoto/aspetta');
  assert.equal(v({ presente: false, scrittaAlle: '', copiaFrescaAl: SYNC_DOPO, giornoSlot: '2026-08-17', oggi: OGGI }), 'non_ancora/istante_ignoto/aspetta');
  assert.equal(v({ presente: false, scrittaAlle: 'ieri sera', copiaFrescaAl: SYNC_DOPO, giornoSlot: '2026-08-17', oggi: OGGI }), 'non_ancora/istante_ignoto/aspetta');
  assert.equal(v({ presente: false, scrittaAlle: SCRITTA, copiaFrescaAl: null, giornoSlot: '2026-08-17', oggi: OGGI }), 'non_ancora/copia_muta/aspetta');
  assert.equal(v({ presente: false, scrittaAlle: SCRITTA, copiaFrescaAl: 'boh', giornoSlot: '2026-08-17', oggi: OGGI }), 'non_ancora/copia_muta/aspetta');
});

test('8) una scrittura VECCHIA: la copia è stata rinfrescata cento volte ⇒ «no» netto', () => {
  assert.equal(
    v({ presente: false, scrittaAlle: '2026-08-01T10:00:00.000Z', copiaFrescaAl: SYNC_DOPO, giornoSlot: '2026-08-17', oggi: OGGI }),
    'no/copia_aggiornata_dopo/basta',
  );
});

test('9) giornoPiu non slitta sui cambi di mese né sull’ora legale', () => {
  assert.equal(giornoPiu('2026-08-15', 30), '2026-09-14');
  assert.equal(giornoPiu('2026-10-24', 7), '2026-10-31');   // il weekend dell'ora legale
  assert.equal(giornoPiu('2026-12-31', 1), '2027-01-01');
  assert.equal(giornoPiu('2026-02-28', 1), '2026-03-01');   // 2026 non è bisestile
});

// ── I COLLEGAMENTI: la regola sta dove si crede, e la usa chi si crede ─────────────────────

test('10) IL COLLEGAMENTO: l’edge dichiara l’azione «verifica» e chiama QUESTA funzione', () => {
  const src = readFileSync(join(cartella, 'index.ts'), 'utf8');
  assert.match(src, /'verifica'\]\.includes\(action\)/, "l'azione «verifica» non è fra quelle ammesse");
  assert.match(src, /if \(action === 'verifica'\)/, "manca il ramo dell'azione «verifica»");
  assert.match(src, /verdettoScrittura\(\{/, "l'edge non chiama verdettoScrittura: sta decidendo per conto suo");
  assert.match(src, /from '\.\/esito-scrittura\.ts'/, 'manca l’import del modulo');
});

test('11) IL COLLEGAMENTO: la freschezza si legge da synced_at delle righe prenotazione', () => {
  const src = readFileSync(join(cartella, 'index.ts'), 'utf8');
  // 🚨 È il punto in cui si sbaglia per primo: `matchpoint_bookings_full_tick_last` sembra fatto
  // apposta e segue SOLO i giri pieni (trappola della 24ª), e il marker diagnostico lo scrivono
  // anche i FALLIMENTI. Se un domani qualcuno li usasse, questo caso diventa rosso.
  assert.match(src, /\.select\('synced_at'\)/, 'la freschezza non si legge da synced_at');
  assert.ok(!/full_tick_last/.test(src), 'la freschezza NON si prende dal marker dei giri pieni');
  assert.ok(!/auto_diagnostic_last/.test(src), 'la freschezza NON si prende dal marker diagnostico');
});

test('12) IL COLLEGAMENTO: la finestra è la STESSA che usa il sync per l’export', () => {
  // Le due copie non si possono importare fra loro (`_shared/` non si deploya), quindi si
  // confrontano: una finestra più larga di quella vera farebbe aspettare un dato che non
  // arriverà, una più stretta direbbe «mai» a una prenotazione che invece si vedrà.
  const sync = readFileSync(join(cartella, '..', 'matchpoint-bookings-sync', 'index.ts'), 'utf8');
  const m = sync.match(/const DEFAULT_FUTURE_DAYS = (\d+);/);
  assert.ok(m, 'DEFAULT_FUTURE_DAYS non trovato nel sync: è cambiata la forma?');
  assert.equal(Number(m![1]), FINESTRA_SYNC_GIORNI, 'la finestra qui e quella del sync sono DIVERSE');
});

test('13) IL COLLEGAMENTO: anche la fetch di «add» dice «non lo so» invece di saltare', () => {
  const src = readFileSync(join(cartella, 'index.ts'), 'utf8');
  // Il pezzo fra la dichiarazione di `resAdd` e la sua risposta: là dentro ci deve essere un
  // try/catch che esce con `esito_ignoto`, come in `create`.
  const blocco = src.slice(src.indexOf('let resAdd: Response;'), src.indexOf('const dataAdd'));
  assert.ok(blocco.length > 0, 'non trovo più il punto in cui `add` chiama il gestionale');
  assert.match(blocco, /try \{/, 'la fetch di `add` non è protetta');
  assert.match(blocco, /reason: 'esito_ignoto'/, '`add` non risponde `esito_ignoto` quando non sa');
});

test('15) IL GIRO SI CHIUDE: chi dice «non lo so» consegna anche CON CHE COSA richiedere', () => {
  // ⭐ Senza questo il ponte sarebbe a metà: `verifica` esiste, e il bot non ha l'istante con
  // cui chiamarla. ⚠️ E l'istante va preso PRIMA della fetch, non dopo: uno preso al ritorno,
  // o ricostruito dal bot quando si accorge del guasto, è già in ritardo — e un riferimento in
  // ritardo fa scattare il «no» troppo presto.
  // 🩹 19/08: qui c'era un percorso ASSOLUTO della macchina di chi l'ha scritto. Funzionava
  // per caso — in un'altra cartella o su un runner questo caso non sarebbe diventato rosso:
  // sarebbe **esploso**, che è un modo diverso e peggiore di non misurare niente.
  const src = readFileSync(join(cartella, 'index.ts'), 'utf8');
  const primaDellaFetch = src.indexOf('const scrittaAlle = new Date().toISOString();');
  const fetchCreate = src.indexOf("fetch(`${supabaseUrl}/functions/v1/matchpoint-bookings-create`");
  assert.ok(primaDellaFetch > 0, "`create` non registra più l'istante della scrittura");
  assert.ok(primaDellaFetch < fetchCreate, "l'istante è preso DOPO la fetch: sarebbe in ritardo");
  // Ogni punto che risponde «non lo so» deve consegnare l'istante. Sono TRE: i due di `create`
  // e quello di `add`.
  // 🚨 Non si contano i letterali, e la prima stesura di questo caso lo faceva: cercava
  // `reason: 'esito_ignoto'` e ne trovava 2 su 3, perché il secondo ramo di `create` lo scrive
  // in forma condizionale (`reason: ignoto ? …`). Contava una GRAFIA, non i punti. Ed è la
  // stessa trappola due volte: `scritta_alle: scritta` ne trovava 4, perché uno è l'eco dentro
  // `verifica`. ⇒ Si cercano i **siti di risposta**, e si guarda cosa c'è dentro ciascuno.
  const siti = [...src.matchAll(/reason: (?:'esito_ignoto'|ignoto \? 'esito_ignoto')/g)].map((m) => m.index!);
  assert.equal(siti.length, 3, `i punti che rispondono «non lo so» sono ${siti.length}, attesi 3 (create ×2, add)`);
  for (const i of siti) {
    const risposta = src.slice(i, src.indexOf('});', i));
    assert.match(risposta, /scritta_alle:/, `un «non lo so» non consegna l’istante (offset ${i})`);
    assert.match(risposta, /slot: \{ data: slot\.data/, `un «non lo so» non consegna lo slot (offset ${i})`);
  }
});

// ── IL LIMITE DICHIARATO, misurato eseguendo il 16/08/2026 ─────────────────────────────────

test('14) LIMITE: la rete del «mai più di quattro» NON ferma il doppio `add`', () => {
  // 🚨 Questo caso NON descrive un comportamento voluto: descrive un LIMITE misurato, e sta qui
  // perché non torni da sé senza che nessuno se ne accorga. Le fonti della rete sono TUTTE la
  // copia del gestionale — anche la «scheda del circolo», che è la `descrizione` delle righe
  // sincronizzate — quindi dentro la finestra del sync (fino a 10′04″ misurati) il quarto
  // appena entrato non c'è ancora, e il quinto passa.
  // ⇒ Il giorno in cui `add` rileggesse la scheda DAL VIVO, questo caso diventa rosso: è il
  // segnale che il limite è stato chiuso, e allora si riscrive.
  const GIOCATORI_PARTITA = 4;
  const riga = (g: string[]): RigaSlot => ({ liste: [g], descrizione: g.map((n) => `-${n}.`).join('') });
  const cancello = (righe: RigaSlot[]) => {
    const e = rosterDelloSlot(righe, GIOCATORI_PARTITA);
    if (e.incoerente) return 'roster_incoerente';
    return e.roster.length >= GIOCATORI_PARTITA ? 'al_completo' : 'SCRIVE';
  };
  const copiaFerma = [riga(['Anna Rossi', 'Bruno Verdi', 'Carla Neri'])];

  // Il primo `add` passa (giusto), la fetch cade, su Matchpoint sono in 4.
  assert.equal(cancello(copiaFerma), 'SCRIVE');
  // Il secondo passa lo stesso: la copia dice ancora 3. È il limite.
  assert.equal(cancello(copiaFerma), 'SCRIVE');
  // E nemmeno il controllo «ci sei già» lo vede.
  const gia = rosterDelloSlot(copiaFerma, GIOCATORI_PARTITA).roster
    .some((n) => n.toLowerCase() === 'dario blu');
  assert.equal(gia, false, 'la copia ferma vede il quarto: il limite è cambiato, riscrivi il caso');

  // ⭐ CONTROPROVA POSITIVA, e senza di lei le tre righe sopra si leggerebbero come «la rete è
  // rotta»: la rete funziona benissimo, le manca il DATO.
  assert.equal(cancello([riga(['Anna Rossi', 'Bruno Verdi', 'Carla Neri', 'Dario Blu'])]), 'al_completo');
});

// 📊 Tabella dei sabotaggi — MISURATA il 16/08 (8 sabotaggi → 8 rossi), non prevista:
//   A il `si` non viene per primo (spostato dopo la finestra) → 6
//   B il margine sparisce (`+ 0` invece di `+ MARGINE`)       → 4
//   C il confronto diventa `>` fra istanti uguali             → 4
//   D `scrittaAlle` illeggibile trattata come 0               → 7
//   E la finestra diventa 60 giorni                           → 5, 12
//   F `presente` ignorato                                     → 2, 6
//   G l'istante sparisce dal ramo di `add`                    → 15
//   H l'istante preso DOPO la fetch invece che prima          → 15
// 🚨 E il sabotaggio E è servito davvero, alla prima passata: dava **solo 12**, perché il caso 5
// costruiva il proprio ingresso con `FINESTRA_SYNC_GIORNI` — cioè con la costante che doveva
// provare — e allargandola si spostava anche lui. Era **inerte**, e nessuna rilettura l'avrebbe
// mostrato: verde col difetto acceso. Corretto con giorni scritti a mano, il sabotaggio lo
// prende. ⇒ È la 24ª nella forma della 20ª: un caso di prova non vale finché non lo si sabota.
// ⚠️ LIMITE DICHIARATO: qui si prova la funzione PURA e i collegamenti nel sorgente, non la
// chiamata viva al ponte. Che `presente` sia calcolato sulle righe giuste e che `synced_at`
// letto dal database sia davvero l'ultimo giro atterrato lo prova solo una chiamata all'edge
// vera — è la stessa distinzione che `occupazione.test.ts` dichiara in fondo a sé stesso.


// ── IL VOCABOLARIO CHE ESCE DAL GESTIONALE (regola ferrea del 19/08) ───────────────────────

test('16) «non lo so» si riconosce da una PROPRIETÀ, non dalle parole del messaggio', () => {
  assert.equal(esitoIgnotoDaRisposta({ esitoIgnoto: true }), true, 'il marchio esplicito non è visto');
  assert.equal(esitoIgnotoDaRisposta({ error: 'WORKER_ESITO_IGNOTO' }), true, 'il codice non è visto');
  assert.equal(esitoIgnotoDaRisposta({ error: '  WORKER_ESITO_IGNOTO  ' }), true, 'gli spazi lo nascondono');
  // 🚨 IL CASO CHE CONTA: la stessa parola dentro un MESSAGGIO non è un marchio. Un fallimento
  // certo che per caso racconta l'altro non deve diventare «non lo so» — sarebbe la regola
  // dell'`esito-prenotazione` al contrario, e trasformerebbe dei «no» veri in attese inutili.
  assert.equal(
    esitoIgnotoDaRisposta({ error: 'SAVE_BUTTON_NOT_FOUND', message: 'niente WORKER_ESITO_IGNOTO qui' }),
    false,
    'legge le parole del messaggio invece della proprietà',
  );
  assert.equal(esitoIgnotoDaRisposta({ ok: false, error: 'SAVE_BUTTON_NOT_FOUND' }), false);
  assert.equal(esitoIgnotoDaRisposta(null), false, 'una risposta assente non è «non lo so»: è niente');
  assert.equal(esitoIgnotoDaRisposta(undefined), false);
});

test('17) 🔒 NESSUN NOME INTERNO esce dal gestionale come «reason»', () => {
  // 🗣️ La regola ferrea del committente (19/08): *«il worker il bot non deve proprio filarselo»*
  // — né indirizzo, né stato, **né nome**. Il 19/08 alle 18:53 il registro del bot scriveva
  // «rifiutata (worker_error)»: il gestionale gli aveva risposto col nome di un suo pezzo interno.
  // 🎯 La prova: il giorno in cui Matchpoint si spegne, il bot non si tocca.
  const src = readFileSync(join(cartella, 'index.ts'), 'utf8');
  const reasons = src.match(/reason:[^,\n]+/g) ?? [];
  // ⭐ IL CONTROLLO POSITIVO, e la prima stesura NON REGGEVA: diceva solo `reasons.length >= 5`,
  // e il sabotaggio «cambio `reason:` in `motivo:` nei cinque punti» **non lo faceva cadere** —
  // perché nel file ci sono altri `reason:` che tenevano su il conto da soli. Era la guardia che
  // non difende niente, trovata dove si trova sempre: sabotando, non rileggendo.
  // ⇒ Adesso il controllo NOMINA quello che deve vedere: se i due motivi veri escono dalla presa
  //   della regex, questo caso cade PRIMA di quello sotto, invece di lasciarlo passare a vuoto.
  const testi = reasons.join(' | ');
  assert.ok(reasons.length >= 5, `trovati solo ${reasons.length} «reason»: la forma è cambiata`);
  assert.ok(
    testi.includes('MOTIVO_SCRITTURA_RIFIUTATA'),
    'il rifiuto non è più fra i «reason» visti dalla guardia: è cambiata la forma, e la guardia sta guardando altrove',
  );
  assert.ok(
    testi.includes("'esito_ignoto'"),
    'l’esito ignoto non è più fra i «reason» visti dalla guardia',
  );
  const vietati = reasons.filter((r) => /worker|matchpoint|hetzner|browser|playwright|caddy/i.test(r));
  assert.deepEqual(vietati, [], `un pezzo interno esce col suo nome verso il bot: ${vietati.join(' | ')}`);
  // E il nome vecchio non deve tornare nemmeno di straforo, fuori da un `reason:`.
  assert.ok(!/'worker_error'/.test(src), 'il letterale `worker_error` è tornato in `index.ts`');
});

test('18) 🔗 il nome del rifiuto sta in UNA costante, e la usano tutti e cinque i punti', () => {
  // Erano cinque copie della stessa stringa scritta a mano. Cinque copie divergono al primo
  // ripensamento — o se ne corregge una e le altre quattro continuano a dire la parola vietata.
  const src = readFileSync(join(cartella, 'index.ts'), 'utf8');
  // 🚨 Si contano gli usi COME VALORE DI `reason:`, non le apparizioni della parola nel file —
  // e la differenza l'ha trovata un sabotaggio, non una rilettura. Contando le apparizioni, il
  // sabotaggio «`reason:` diventa `motivo:` nei cinque punti» NON cadeva: la parola restava lì,
  // e il bot avrebbe ricevuto `reason: undefined` con la guardia tutta verde.
  // ⇒ Una guardia deve contare la cosa che il bot LEGGE, non la cosa che il file CONTIENE.
  const comeReason = src.match(/reason:[^,\n]*MOTIVO_SCRITTURA_RIFIUTATA/g) ?? [];
  assert.equal(comeReason.length, 5, `il rifiuto esce come «reason» in ${comeReason.length} punti invece di 5`);
  const usi = src.match(/MOTIVO_SCRITTURA_RIFIUTATA/g) ?? [];
  assert.equal(usi.length, 6, `attesi 5 usi + 1 import, trovati ${usi.length}`);
  assert.match(src, /from '\.\/esito-scrittura\.ts'/, 'manca l’import del modulo');
  assert.equal(MOTIVO_SCRITTURA_RIFIUTATA, 'scrittura_rifiutata');
  // 🚨 E il riconoscimento dell'ignoto non deve tornare a essere scritto a mano nel ramo create:
  // è uscito di lì proprio perché era l'unica copia e nessun altro poteva riusarla.
  assert.match(src, /esitoIgnotoDaRisposta\(data\)/, 'il ramo `create` non usa più la funzione condivisa');
  assert.ok(!/esitoIgnoto === true \|\|/.test(src), 'il riconoscimento è stato ricopiato a mano dentro index.ts');
});

console.log(`\n${passed} passati, ${failed} falliti`);
if (failed > 0) process.exitCode = 1;
