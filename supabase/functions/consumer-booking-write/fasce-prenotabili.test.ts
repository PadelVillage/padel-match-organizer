// 🗓️ La griglia delle fasce prenotabili — test deterministici, nessuna dipendenza esterna.
// Esegui:  node supabase/functions/consumer-booking-write/fasce-prenotabili.test.ts
//
// ⭐ I dati del lunedì NON sono inventati: sono le sei fasce vere lette l'08/09/2026 da
// `pmo_fasce_prenotabili` sul sistema nuovo, comprese le `HH:MM:SS` che PostgREST rende
// davvero — che è il formato su cui questo modulo esiste per non inciampare.
//
// ⚖️ In fondo ci sono i SABOTAGGI: si rompe una riga della cura per volta e si pretende che
// il banco diventi rosso. Un banco che non cade quando si rompe ciò che difende non difende
// niente.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fasceComeGriglia, fasceDelGiorno, giornoDalCalendario, grigliaDalCalendario, normalizzaOra } from './fasce-prenotabili.ts';

const SORGENTE = join(dirname(fileURLToPath(import.meta.url)), 'fasce-prenotabili.ts');

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`ok   - ${name}`);
    })
    .catch((e) => {
      failed += 1;
      console.error(`FAIL - ${name}\n      ${(e as Error).message}`);
    });
}

/** Le sei fasce vere del lunedì, nell'ordine sparso in cui il database non promette niente. */
const LUNEDI = [
  { giorno: 1, ora_inizio: '18:00:00', ora_fine: '19:30:00', attiva: true },
  { giorno: 1, ora_inizio: '12:30:00', ora_fine: '14:00:00', attiva: true },
  { giorno: 1, ora_inizio: '16:30:00', ora_fine: '18:00:00', attiva: true },
];

/** Il blocco vecchio, nella forma che ha davvero dentro `app_setting`. */
const BLOCCO = { '1': [{ start: '12:30', end: '14:00', name: '12:30-14:00' }] };

const casi: Promise<void>[] = [];

// ── le DUE COPIE devono restare identiche ────────────────────────────────────
// ⚖️ Deno non importa fuori dalla cartella della funzione, quindi il modulo vive in due
// posti. Due copie che divergono sono esattamente il difetto che questa voce cura, commesso
// una volta di più: l'app leggerebbe una griglia, il bot un'altra. Questo caso costa niente
// e toglie quella possibilità — è la stessa protezione che `scrittura-al-circolo.ts` ha
// nelle sue 11 copie.
casi.push(test('le due copie del modulo sono byte-identiche', () => {
  const gemella = join(
    dirname(dirname(SORGENTE)),
    'consumer-player-readmodel',
    'fasce-prenotabili.ts',
  );
  assert.equal(
    readFileSync(SORGENTE, 'utf8'),
    readFileSync(gemella, 'utf8'),
    'le due copie di fasce-prenotabili.ts sono DIVERSE: app e bot leggerebbero griglie diverse',
  );
}));

// ── normalizzaOra ────────────────────────────────────────────────────────────
casi.push(test('PostgREST rende HH:MM:SS e va accorciato', () => {
  assert.equal(normalizzaOra('16:30:00'), '16:30');
}));
casi.push(test('un HH:MM già buono passa intatto', () => {
  assert.equal(normalizzaOra('16:30'), '16:30');
}));
casi.push(test('i secondi con decimali non ingannano', () => {
  assert.equal(normalizzaOra('09:05:00.000'), '09:05');
}));
casi.push(test('ciò che non è un orario torna null, non una stringa storta', () => {
  for (const v of ['', '  ', 'mezzogiorno', '9:30', '1630', null, undefined, 42, {}]) {
    assert.equal(normalizzaOra(v), null, `«${String(v)}» doveva essere null`);
  }
}));
casi.push(test('un orario impossibile è null, non accettato per forma', () => {
  assert.equal(normalizzaOra('24:00'), null, '24:00 non esiste');
  assert.equal(normalizzaOra('12:60'), null, '12:60 non esiste');
}));

// ── fasceComeGriglia ─────────────────────────────────────────────────────────
casi.push(test("le fasce del giorno escono ORDINATE per ora d'inizio", () => {
  const g = fasceComeGriglia(LUNEDI)!;
  assert.deepEqual(g['1'].map((f) => f.start), ['12:30', '16:30', '18:00']);
}));
casi.push(test('il `name` ha la forma che i chiamanti già si aspettano', () => {
  const g = fasceComeGriglia(LUNEDI)!;
  assert.deepEqual(g['1'][1], { start: '16:30', end: '18:00', name: '16:30-18:00' });
}));
casi.push(test('i sette giorni ci sono tutti, anche quelli vuoti', () => {
  const g = fasceComeGriglia(LUNEDI)!;
  assert.deepEqual(Object.keys(g).sort(), ['0', '1', '2', '3', '4', '5', '6']);
  assert.deepEqual(g['3'], []);
}));
casi.push(test('una fascia SPENTA non compare', () => {
  const g = fasceComeGriglia([...LUNEDI, { giorno: 1, ora_inizio: '07:00', ora_fine: '08:30', attiva: false }])!;
  assert.deepEqual(g['1'].map((f) => f.start), ['12:30', '16:30', '18:00']);
}));
casi.push(test('`attiva` mancante NON spegne la fascia (spegne solo il false esplicito)', () => {
  const g = fasceComeGriglia([{ giorno: 2, ora_inizio: '10:00', ora_fine: '11:30' }])!;
  assert.equal(g['2'].length, 1);
}));
casi.push(test('un giorno fuori da 0-6 si scarta invece di inventare una chiave', () => {
  const g = fasceComeGriglia([...LUNEDI, { giorno: 9, ora_inizio: '10:00', ora_fine: '11:30', attiva: true }])!;
  assert.deepEqual(Object.keys(g).sort(), ['0', '1', '2', '3', '4', '5', '6']);
}));
casi.push(test('una riga con ore storte si scarta, e le sane restano', () => {
  const g = fasceComeGriglia([...LUNEDI, { giorno: 1, ora_inizio: 'boh', ora_fine: '11:30', attiva: true }])!;
  assert.equal(g['1'].length, 3);
}));

// 🚨 Il caso che vale più di tutti: `null` vuol dire «chiedi al ripiego», e va tenuto distinto
// da «una griglia in cui non c'è niente». Confonderli fa dire al socio che il circolo è
// chiuso — che è una bugia, non un'attesa.
casi.push(test('nessuna riga ⇒ null (= usa il ripiego), NON una griglia vuota', () => {
  assert.equal(fasceComeGriglia([]), null);
  assert.equal(fasceComeGriglia(null), null);
  assert.equal(fasceComeGriglia(undefined), null);
}));
casi.push(test('righe tutte inutilizzabili ⇒ null, non sette giorni vuoti', () => {
  assert.equal(fasceComeGriglia([{ giorno: 99, ora_inizio: 'x', ora_fine: 'y' }]), null);
}));
casi.push(test('una sola fascia buona basta a NON ripiegare', () => {
  const g = fasceComeGriglia([{ giorno: 0, ora_inizio: '09:00:00', ora_fine: '10:30:00', attiva: true }])!;
  assert.equal(g['0'].length, 1);
}));

// ── fasceDelGiorno: il punto unico in cui si ripiega ──────────────────────────
casi.push(test('con la griglia si usa la GRIGLIA, e il blocco vecchio è ignorato', () => {
  assert.equal(fasceDelGiorno(fasceComeGriglia(LUNEDI), BLOCCO, 1).length, 3);
}));
casi.push(test('senza griglia si ripiega sul blocco vecchio invece di rendere vuoto', () => {
  assert.deepEqual(fasceDelGiorno(null, BLOCCO, 1), BLOCCO['1']);
}));
casi.push(test('senza griglia E senza blocco si rende [] senza esplodere', () => {
  assert.deepEqual(fasceDelGiorno(null, null, 1), []);
  assert.deepEqual(fasceDelGiorno(null, undefined, 3), []);
}));
casi.push(test('un giorno che la griglia non ha rende [], NON il ripiego', () => {
  // ⚖️ Se la tabella c'è ed è muta su martedì, il circolo martedì è chiuso davvero:
  // ripiegare qui rimetterebbe in vita fasce che il committente ha tolto apposta.
  const g = fasceComeGriglia(LUNEDI);
  assert.deepEqual(fasceDelGiorno(g, { '2': [{ start: '08:00', end: '09:30', name: 'x' }] }, 2), []);
}));

// ── SABOTAGGI: si rompe la cura e il banco DEVE diventare rosso ───────────────
const TANA = mkdtempSync(join(tmpdir(), 'fasce-sabotaggi-'));
let nSabotaggio = 0;

/**
 * Gli stessi fatti dei casi qui sopra, in miniatura: se uno cade, il sabotaggio è stato visto.
 *
 * 🩹 **Trappola pagata scrivendo questo banco, e lasciata scritta.** Qui la sonda del «niente
 * fasce» era `fasceComeGriglia([])`, e il sabotaggio su `if (utili === 0) return null;`
 * restava **VERDE**: l'array vuoto esce da una riga *precedente* (`righe.length === 0`), quindi
 * quella sonda non toccava mai la riga che diceva di difendere. Il caso che la esercita è un
 * array **pieno di righe inutilizzabili** — non vuoto.
 * 📌 *Due strade diverse verso lo stesso `null` non sono lo stesso caso: una sonda che prende
 * la prima non ha ancora guardato la seconda.*
 */
function reggeAncora(M: Record<string, any>): boolean {
  try {
    const g = M.fasceComeGriglia(LUNEDI);
    if (JSON.stringify(g?.['1']?.map((f: any) => f.start)) !== '["12:30","16:30","18:00"]') return false;
    if (M.fasceComeGriglia([]) !== null) return false;
    // ⭐ questa riga, e non quella sopra, è quella che copre `utili === 0`
    if (M.fasceComeGriglia([{ giorno: 99, ora_inizio: 'x', ora_fine: 'y' }]) !== null) return false;
    if (JSON.stringify(M.fasceDelGiorno(null, BLOCCO, 1)) !== JSON.stringify(BLOCCO['1'])) return false;
    if (M.normalizzaOra('16:30:00') !== '16:30') return false;
    // voce 185 — si prova con l'input OSTILE, non con quello vero: un giorno chiuso che arriva
    // SENZA fasce non distingue la cura dal difetto, e il sabotaggio resterebbe verde.
    if (M.giornoDalCalendario(OSTILE, '2026-11-06')?.fasce?.length !== 0) return false;
    if (JSON.stringify(M.grigliaDalCalendario(OSTILE)?.['5']?.map((f: any) => f.start)) !== '["19:00"]') return false;
    return true;
  } catch {
    return false;
  }
}

async function sabota(nome: string, cerca: string, sostituisci: string) {
  const testo = readFileSync(SORGENTE, 'utf8');
  // 🚨 Se la riga da rompere non c'è più, il sabotaggio non sta provando niente e va detto:
  // un sabotaggio che non trova il suo bersaglio passa VERDE senza aver guardato nulla.
  if (!testo.includes(cerca)) {
    failed += 1;
    console.error(`FAIL - sabotaggio «${nome}»: la riga da rompere non esiste più nel sorgente`);
    return;
  }
  const via = join(TANA, `s${++nSabotaggio}.ts`);
  writeFileSync(via, testo.replace(cerca, sostituisci));
  const rotto = await import(`file://${via}`);
  if (reggeAncora(rotto as Record<string, any>)) {
    failed += 1;
    console.error(`FAIL - sabotaggio «${nome}»: ho rotto la cura e il banco è rimasto VERDE`);
  } else {
    passed += 1;
    console.log(`ok   - sabotaggio visto: ${nome}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// VOCE 185 — la risposta di `pmo_calendario_effettivo`
// ══════════════════════════════════════════════════════════════════════════════
// ⭐ Le risposte qui sotto NON sono inventate: sono la forma vera misurata su `cudi` l'08/09/2026,
// compreso il fatto che un giorno chiuso torna con `fasce: []`.
const RISPOSTA = {
  ok: true,
  giorni: [
    { data: '2026-11-05', periodo_id: 'inverno', periodo_nome: 'Inverno', chiuso: false, motivo: null,
      fasce: [{ ora_inizio: '19:30', ora_fine: '21:00', prezzo_cents: 1500, note: null },
              { ora_inizio: '18:00', ora_fine: '19:30', prezzo_cents: 1400, note: null }] },
    { data: '2026-11-06', periodo_id: 'inverno', periodo_nome: 'Inverno', chiuso: true, motivo: 'Ponte',
      fasce: [] },
    { data: '2026-11-13', periodo_id: 'inverno', periodo_nome: 'Inverno', chiuso: false, motivo: null,
      fasce: [{ ora_inizio: '19:00', ora_fine: '20:30', prezzo_cents: 1200, note: null }] },
  ],
};

// 🚨 E questa è la stessa risposta CON UN DIFETTO DENTRO: un giorno chiuso che si porta dietro
// le sue fasce. Oggi il gestionale non lo fa — ma la guardia esiste per il giorno in cui qualcuno
// cambiasse quella funzione, e una guardia si prova sull'input che dovrebbe fermare, non su quello
// che non ha bisogno di lei. 📌 *Un sabotaggio provato con un input innocuo resta verde sempre.*
const OSTILE = {
  ok: true,
  giorni: [
    { data: '2026-11-06', periodo_nome: 'Inverno', chiuso: true, motivo: 'Ponte',
      fasce: [{ ora_inizio: '10:00', ora_fine: '11:30', prezzo_cents: 800, note: null }] },
    { data: '2026-11-13', periodo_nome: 'Inverno', chiuso: false, motivo: null,
      fasce: [{ ora_inizio: '19:00', ora_fine: '20:30', prezzo_cents: 1200, note: null }] },
  ],
};

casi.push(test('un giorno chiuso NON rende fasce, nemmeno se gliene arrivano', () => {
  assert.deepEqual(giornoDalCalendario(OSTILE, '2026-11-06')?.fasce, []);
}));

casi.push(test('la settimana scavalca il chiuso anche quando il chiuso ha fasce', () => {
  assert.deepEqual(grigliaDalCalendario(OSTILE)?.['5'].map((f) => f.start), ['19:00']);
}));

casi.push(test('il giorno chiesto torna con le sue fasce, ordinate', () => {
  const g = giornoDalCalendario(RISPOSTA, '2026-11-05');
  assert.equal(g?.chiuso, false);
  assert.deepEqual(g?.fasce.map((f) => f.start), ['18:00', '19:30']);
  assert.equal(g?.periodo_nome, 'Inverno');
}));

casi.push(test('un giorno CHIUSO torna chiuso e senza fasce, col motivo', () => {
  const g = giornoDalCalendario(RISPOSTA, '2026-11-06');
  assert.equal(g?.chiuso, true);
  assert.equal(g?.motivo, 'Ponte');
  assert.deepEqual(g?.fasce, []);
}));

casi.push(test('un giorno che non c\'è torna null: è il segnale del ripiego', () => {
  assert.equal(giornoDalCalendario(RISPOSTA, '2026-12-25'), null);
  assert.equal(giornoDalCalendario({ ok: false, error: 'AUTH_REQUIRED' }, '2026-11-05'), null);
  assert.equal(giornoDalCalendario(null, '2026-11-05'), null);
}));

casi.push(test('la griglia della settimana salta il giorno chiuso e prende quello dopo', () => {
  // 🚨 Il 06/11 (venerdì) è chiuso, il 13/11 è il venerdì successivo: il venerdì NON deve
  // risultare senza orari solo perché in quella settimana c'era un ponte.
  const griglia = grigliaDalCalendario(RISPOSTA);
  assert.deepEqual(griglia?.['4'].map((f) => f.start), ['18:00', '19:30']); // giovedì 05/11
  assert.deepEqual(griglia?.['5'].map((f) => f.start), ['19:00']);          // venerdì 13/11
  assert.deepEqual(griglia?.['1'], []);                                     // lunedì: non chiesto
}));

casi.push(test('nessuna fascia utile ⇒ null, non una griglia vuota', () => {
  assert.equal(grigliaDalCalendario({ ok: true, giorni: [] }), null);
  assert.equal(grigliaDalCalendario({ ok: true, giorni: [{ data: '2026-11-06', chiuso: true, fasce: [] }] }), null);
}));

await Promise.all(casi);

await sabota('i secondi non vengono più tolti', 'return `${m[1]}:${m[2]}`;', 'return v.trim();');
await sabota('non si ordina più per ora', 'griglia[k].sort((a, b) => a.start.localeCompare(b.start));', 'void k;');
await sabota('«niente fasce» torna una griglia vuota invece di null', 'if (utili === 0) return null;', 'if (utili === -1) return null;');
await sabota('il ripiego non si applica più', 'if (griglia) return Array.isArray(griglia[k]) ? griglia[k] : [];', 'if (griglia || true) return Array.isArray(griglia?.[k]) ? griglia[k] : [];');
await sabota('un giorno chiuso rende le sue fasce lo stesso', 'fasce: g.chiuso === true ? [] : fasceDellaRiga(g.fasce),', 'fasce: fasceDellaRiga(g.fasce),');
await sabota('la settimana non salta più i giorni chiusi', 'if (g.chiuso === true) continue;', 'if (g.chiuso === undefined) continue;');

console.log(`\n${failed ? '🔴' : '🟢'} ${passed} verdi, ${failed} rosse — fasce-prenotabili.ts (voci 177 e 185)`);
if (failed) process.exit(1);
