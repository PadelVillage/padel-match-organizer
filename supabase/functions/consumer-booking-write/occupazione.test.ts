// Chi occupa un campo — test deterministici, nessuna dipendenza esterna.
// Esegui:  node supabase/functions/consumer-booking-write/occupazione.test.ts
//
// ⭐ I casi 1-6 NON sono inventati: sono i payload VERI letti da PROD il 28/07 in sola lettura
// (`pmo_cloud_records`, `deleted is not true`, `data >= 2026-07-28`). Sono la ragione per cui
// il modulo esiste — la manutenzione da 4,5 ore e la lezione da 60 minuti sono forme di dato
// che nessuno stava leggendo.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DURATA_DEFAULT_MIN,
  TIPI_CHE_OCCUPANO,
  TIPO_SOLO_OCCUPAZIONE,
  campiOccupati,
  minutiInOra,
  occupazioneDellaRiga,
  oraInMinuti,
  parseBookingDurationMinutes,
} from './occupazione.ts';

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

/** L'intervallo di una riga scritto come lo leggerebbe una persona: «12:00-16:30». */
const intervallo = (payload: Record<string, unknown>) => {
  const o = occupazioneDellaRiga(payload);
  return o ? `C${o.campo} ${minutiInOra(o.inizioMin)}-${minutiInOra(o.fineMin)}` : null;
};
const fascia = (occs: Record<string, unknown>[], da: string, a: string) =>
  [...campiOccupati(
    occs.map(occupazioneDellaRiga).filter((o) => o !== null),
    oraInMinuti(da), oraInMinuti(a),
  )].sort((x, y) => x - y);

// ── I payload VERI di PROD (28/07/2026, sola lettura) ────────────────────────
const MANUTENZIONE_45 = { data: '2026-08-01', ora: '12:00', ora_fine: null, durata: '4.5', campo: 'Campo 4', tipo: 'manutenzione' };
const MANUTENZIONE_135 = { data: '2026-08-15', ora: '07:00', ora_fine: null, durata: '13.5', campo: 'Campo 3', tipo: 'manutenzione' };
const LEZIONE_60 = { data: '2026-07-28', ora: '17:00', ora_fine: null, durata: '1', campo: 'Campo 1', tipo: 'Lezione Libera' };
const PARTITA_90 = { data: '2026-07-28', ora: '21:00', ora_fine: null, durata: '1.5', campo: 'Campo 4', tipo: 'Partita' };
const STAFF_90 = { data: '2026-07-28', ora: '16:30', ora_fine: '18:00', durata: '90', campo: '3', tipo: 'partita' };

// ══ ① La durata, nelle DUE unità che convivono nell'archivio ═════════════════

test('1 · manutenzione VERA da 4,5 ore: 12:00 → 16:30, non 13:30', () => {
  assert.equal(intervallo(MANUTENZIONE_45), 'C4 12:00-16:30');
});

test('2 · manutenzione VERA da 13,5 ore: 07:00 → 20:30 (col +90 fisso era 08:30)', () => {
  assert.equal(intervallo(MANUTENZIONE_135), 'C3 07:00-20:30');
});

test('3 · lezione VERA da 60 minuti: finisce alle 18:00, non alle 18:30', () => {
  assert.equal(intervallo(LEZIONE_60), 'C1 17:00-18:00');
});

test('4 · partita VERA del circolo, durata «1.5» = ORE → 90 minuti', () => {
  assert.equal(intervallo(PARTITA_90), 'C4 21:00-22:30');
});

test('5 · copia in app: ha `ora_fine`, e vince quella (durata «90» = MINUTI, stesso esito)', () => {
  // ⚠️ Avevo scritto qui che questo era il controllo contro un fix che moltiplica sempre per
  // 60. È falso, e l'ha detto la tabella dei sabotaggi: su questa riga `ora_fine` c'è, quindi
  // la durata non viene nemmeno guardata. A misurare quel difetto è il caso 6.
  assert.equal(intervallo(STAFF_90), 'C3 16:30-18:00');
});

test('6 · la stessa durata scritta nelle due unità dà lo stesso numero di minuti', () => {
  // Caso vero: 31/07 13:00 campo 2 esiste sia come `booking` («1.5») sia come `staff_booking`
  // («90», con `ora_fine` 14:30). Se le due letture divergessero, lo stesso slot risulterebbe
  // occupato per due durate diverse a seconda di quale copia si guarda.
  assert.equal(parseBookingDurationMinutes('1.5'), 90);
  assert.equal(parseBookingDurationMinutes('90'), 90);
  assert.equal(parseBookingDurationMinutes(1.5), 90);
  assert.equal(parseBookingDurationMinutes(90), 90);
});

test('7 · durata assente o illeggibile → i 90 minuti dello slot standard', () => {
  assert.equal(intervallo({ ora: '12:00', campo: '2' }), 'C2 12:00-13:30');
  assert.equal(intervallo({ ora: '12:00', campo: '2', durata: '' }), 'C2 12:00-13:30');
  assert.equal(intervallo({ ora: '12:00', campo: '2', durata: 'boh' }), 'C2 12:00-13:30');
  assert.equal(DURATA_DEFAULT_MIN, 90);
});

test('8 · `ora_fine` VINCE sulla durata quando c\'è (le due potrebbero discordare)', () => {
  assert.equal(intervallo({ ora: '12:00', campo: '2', ora_fine: '13:00', durata: '4.5' }), 'C2 12:00-13:00');
});

test('9 · `ora_fine` PRIMA dell\'inizio è un dato rotto: si ricade sulla durata', () => {
  // Il circolo chiude prima di mezzanotte: una fine che precede l'inizio non è una
  // prenotazione a cavallo del giorno, è spazzatura. Occupare all'indietro renderebbe libero
  // tutto il pomeriggio e occupato il mattino.
  assert.equal(intervallo({ ora: '21:00', campo: '1', ora_fine: '07:00', durata: '1.5' }), 'C1 21:00-22:30');
});

test('10 · riga senza campo o senza ora: non si inventa nulla, esce `null`', () => {
  assert.equal(occupazioneDellaRiga({ ora: '12:00' }), null);
  assert.equal(occupazioneDellaRiga({ campo: 'Campo 2' }), null);
  assert.equal(occupazioneDellaRiga({ campo: 'Campo 2', ora: '25' }), null);
  // ⭐ E il campo si legge in tutt'e due le grafie: «Campo 2» dal circolo, «2» dall'app.
  assert.equal(occupazioneDellaRiga({ campo: 'Campo 2', ora: '12:00' })?.campo, 2);
  assert.equal(occupazioneDellaRiga({ campo: '2', ora: '12:00' })?.campo, 2);
});

// ══ ② La fascia: chi è occupato e chi NO ════════════════════════════════════

test('11 · sabato 1 agosto, fascia 12:00: la manutenzione VERA prende 2·3·4 e lascia il campo 1', () => {
  // 📊 Caso vero di PROD: tre manutenzioni 12:00 durata 4,5 sui campi 2, 3, 4. Oggi il ponte
  // dice tutti e quattro liberi.
  // ⭐⭐ Il campo 1 è il controllo che rende valida la prova: senza di lui, un fix che «occupa
  // tutto» passerebbe identico.
  const righe = [
    { ...MANUTENZIONE_45, campo: 'Campo 2' },
    { ...MANUTENZIONE_45, campo: 'Campo 3' },
    { ...MANUTENZIONE_45, campo: 'Campo 4' },
  ];
  assert.deepEqual(fascia(righe, '12:00', '13:30'), [2, 3, 4]);
});

test('12 · e la stessa manutenzione occupa ANCHE le fasce dopo, che non comincia lei', () => {
  // La fascia delle 15:00 non ha nessuna riga che comincia alle 15:00: se si guardasse l'ora
  // esatta invece della sovrapposizione, risulterebbe libera. È l'errore che avevo fatto io
  // nella prima misura del 28/07.
  const righe = [{ ...MANUTENZIONE_45, campo: 'Campo 2' }];
  assert.deepEqual(fascia(righe, '13:30', '15:00'), [2]);
  assert.deepEqual(fascia(righe, '15:00', '16:30'), [2]);
  assert.deepEqual(fascia(righe, '16:30', '18:00'), []); // finita alle 16:30: la fascia dopo è libera
});

test('13 · la lezione da 60 minuti NON occupa più la fascia delle 18:00 (difetto ②)', () => {
  // Col +90 fisso questa lezione arrivava alle 18:30 e nascondeva un campo LIBERO.
  assert.deepEqual(fascia([LEZIONE_60], '18:00', '19:30'), []);
  assert.deepEqual(fascia([LEZIONE_60], '17:30', '19:00'), [1]); // ma dove si sovrappone davvero, sì
});

test('14 · estremi esclusi: chi finisce quando la fascia comincia non la occupa', () => {
  assert.deepEqual(fascia([STAFF_90], '18:00', '19:30'), []);   // finisce alle 18:00
  assert.deepEqual(fascia([STAFF_90], '16:30', '18:00'), [3]);  // è la sua fascia
  assert.deepEqual(fascia([STAFF_90], '15:00', '16:30'), []);   // comincia alle 16:30
});

test('15 · la stessa prenotazione in DUE copie occupa UN campo, non due', () => {
  // `booking` e `booking_occupancy` convivono sulla stessa prenotazione (96 in comune su PROD):
  // il conto sta in un insieme, quindi i doppioni non gonfiano niente.
  assert.deepEqual(fascia([PARTITA_90, { ...PARTITA_90 }, { ...PARTITA_90, durata: '1' }], '21:00', '22:30'), [4]);
});

test('16 · nessuna riga → nessun campo occupato (il controllo negativo)', () => {
  assert.deepEqual(fascia([], '12:00', '13:30'), []);
});

// ══ ③ Le due reti strutturali ═══════════════════════════════════════════════

test('17 · i tipi che occupano sono TRE, e il terzo è quello che non porta giocatori', () => {
  assert.deepEqual([...TIPI_CHE_OCCUPANO], ['booking', 'staff_booking', 'booking_occupancy']);
  assert.ok(TIPI_CHE_OCCUPANO.includes(TIPO_SOLO_OCCUPAZIONE));
});

test('18 · la copia di `parseBookingDurationMinutes` è IDENTICA a quella del sync', () => {
  // 🚨 La regola sta in due file perché deve: i moduli in `_shared/` non vengono deployati
  // (il workflow scarta le cartelle che iniziano per `_`), quindi una copia dentro la function
  // è l'unico modo di essere sicuri che il cambiamento arrivi. Il prezzo è la deriva fra copie,
  // ed è esattamente il modo in cui un fix si riapre: questo test è la contropartita.
  // Unica differenza ammessa: la parola `export` davanti, che qui serve e là no.
  const blocco = (percorso: string) => {
    const src = readFileSync(percorso, 'utf8');
    const da = src.indexOf('function parseBookingDurationMinutes(');
    assert.notEqual(da, -1, `funzione non trovata in ${percorso}`);
    const a = src.indexOf('\n}\n', da);
    assert.notEqual(a, -1, `fine della funzione non trovata in ${percorso}`);
    return src.slice(da, a + 2);
  };
  // 🚨 NON `import.meta.dirname`: è `string | undefined` (vale `undefined` per i moduli non
  // serviti da `file:`), e dentro `join(...)` faceva cadere `deno test` sul TYPECHECK **prima di
  // eseguire un solo caso** — un rosso che sembra un difetto del codice provato ed è invece un
  // difetto del banco. `import.meta.url`, che è sempre una stringa, dà lo stesso percorso senza
  // il ramo impossibile da soddisfare.
  const cartella = fileURLToPath(new URL('.', import.meta.url));
  const qui = blocco(join(cartella, 'occupazione.ts'));
  const nelSync = blocco(join(cartella, '..', 'matchpoint-bookings-sync', 'index.ts'));
  assert.equal(qui, nelSync, 'le due copie della lettura della durata sono DIVERSE');
});

// 📊 Tabella dei sabotaggi — MISURATA il 28/07, non prevista (7 sabotaggi → 7 rossi):
//   A il terzo tipo non occupa più         → 17
//   B la durata si ignora, +90 fissi       → 1, 2, 3, 12, 13
//   C la durata è sempre in ore (×60)      → 6, 18
//   D sovrapposizione a estremi inclusi    → 12, 13, 14
//   E `ora_fine` perde contro la durata    → 8
//   F l'`ora_fine` rotta viene accettata   → 9
//   G la copia verbatim viene «migliorata» → 18
// ⚠️ LIMITE DICHIARATO, lo dice il sabotaggio A: qui si provano le funzioni pure, NON lo
// smistamento dentro `index.ts` — cioè che il terzo tipo entri nell'occupazione e resti fuori
// dal roster. Quello lo prova solo una chiamata al ponte vivo, con i controlli opposti (uno
// slot con manutenzione deve sparire dai liberi, uno slot normale deve restare identico).

console.log(`\n${passed} passati, ${failed} falliti`);
if (failed > 0) process.exitCode = 1;
