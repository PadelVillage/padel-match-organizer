// 🚨⭐⭐ VOCE 77 — LA FOTOGRAFIA DI PRIMA SI PRENDE TUTTA NELLO STESSO ISTANTE.
//
// Esegui:  node supabase/functions/matchpoint-bookings-sync/ordine-fotografia.test.ts
//
// Questa non prova una regola: prova un ORDINE, che è l'unica forma in cui il difetto del
// 23/08 esisteva. Le due letture che compongono la fotografia di «prima» — le righe VIVE
// (`loadExistingBookingRecords`) e le righe SEPOLTE da resuscitare
// (`loadSepoltiESoppressioni`, voce 73) — stavano ai due lati dell'upsert. In mezzo c'è una
// scrittura che rimette `deleted = false` su ciò che la seconda va a cercare: l'export del
// giro era stato scattato PRIMA dell'annullo, quindi conteneva ancora la prenotazione.
//
// 📏 Misurato alle 14:35:59 del 23/08: `risorti: 0`, `slotPrima: 76`, `slotDopo: 77`,
// `accodati: 1` ⇒ al socio è arrivato «Sei in campo» per la partita appena annullata.
// Il giro dopo (14:37:22), con l'export scattato DOPO l'annullo, la resurrezione è avvenuta
// (`righe: 1`) e non è stato accodato niente: la differenza fra i due giri è solo QUANDO
// l'upsert cade rispetto all'annullo — cioè una corsa, non una regola.
//
// ⚠️ È una guardia TESTUALE, e va detto invece di lasciarlo credere: legge il sorgente e
// misura una posizione, quindi prova che le due chiamate stanno nell'ordine giusto — non che
// facciano la cosa giusta. Quello lo provano `eventi-staff.test.ts` e il giro vero. Serve
// perché l'ordine è esattamente ciò che nessuna prova sulle funzioni pure può vedere: quelle
// ricevono i dati già letti, e il difetto sta in QUANDO li si legge.
//
// 🚨 Le righe di commento si tolgono PRIMA di cercare, ed è la lezione ③ della voce 61: una
// guardia che conta le parole conta anche quelle scritte per spiegare perché la guardia
// esiste — compreso questo blocco, che le nomina tutte e tre.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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

/** Via i commenti di riga: restano solo le righe che il programma ESEGUE. */
function righeVive(testo: string): string[] {
  return testo.split('\n').map((r) => (/^\s*(\/\/|\*|\/\*)/.test(r) ? '' : r));
}

/**
 * La posizione (indice di riga) della prima riga ESEGUITA che contiene `ago`, o `-1`.
 * Si passa il testo da fuori così il caso di controllo può darne uno costruito apposta.
 */
export function doveSuccede(testo: string, ago: string): number {
  return righeVive(testo).findIndex((r) => r.includes(ago));
}

const QUI = dirname(fileURLToPath(import.meta.url));
const SORGENTE = readFileSync(join(QUI, 'index.ts'), 'utf8');

const LETTURA_VIVE = 'await loadExistingBookingRecords(admin)';
const LETTURA_SEPOLTI = 'await loadSepoltiESoppressioni(admin,';
const SCRITTURA = ".from('pmo_cloud_records')";
const UPSERT = '.upsert(records,';

test('le tre chiamate esistono davvero nel sorgente (se no la guardia non guarda niente)', () => {
  for (const ago of [LETTURA_VIVE, LETTURA_SEPOLTI, UPSERT]) {
    assert.ok(
      doveSuccede(SORGENTE, ago) >= 0,
      `«${ago}» non c'è più in index.ts: è cambiata la forma della chiamata? ` +
        'Meglio rosso che un verde che non ha controllato nulla.',
    );
  }
});

test('🚨 i SEPOLTI si leggono PRIMA dell\'upsert — è il difetto del 23/08', () => {
  const sepolti = doveSuccede(SORGENTE, LETTURA_SEPOLTI);
  const upsert = doveSuccede(SORGENTE, UPSERT);
  assert.ok(
    sepolti < upsert,
    `loadSepoltiESoppressioni sta alla riga ${sepolti + 1} e l'upsert alla ${upsert + 1}: ` +
      "l'upsert riporta in vita (deleted=false) le righe che la resurrezione cerca fra i sepolti, " +
      'e la fotografia di «prima» esce mutilata ⇒ un `aggiunto` falso al socio.',
  );
});

test('🔒 e le due metà della fotografia si leggono INSIEME: vive, poi sepolti, poi si scrive', () => {
  const vive = doveSuccede(SORGENTE, LETTURA_VIVE);
  const sepolti = doveSuccede(SORGENTE, LETTURA_SEPOLTI);
  const upsert = doveSuccede(SORGENTE, UPSERT);
  assert.ok(vive < upsert, 'le righe vive si leggono prima di scrivere');
  assert.ok(
    Math.abs(sepolti - vive) < 60,
    `le due letture distano ${Math.abs(sepolti - vive)} righe: se si allontanano, fra loro ` +
      'torna a starci una scrittura e il difetto rinasce senza che nessuno lo veda.',
  );
});

test('⚠️ la guardia NON conta le parole nei commenti (lezione ③ della voce 61)', () => {
  const finto = [
    '// qui si spiega che await loadSepoltiESoppressioni(admin, confine) va prima',
    "  const { error } = await admin.from('pmo_cloud_records').upsert(records, {});",
    '  const x = await loadSepoltiESoppressioni(admin, confine);',
  ].join('\n');
  // Se contasse il commento, la troverebbe alla riga 0 e direbbe «ordine giusto»: è
  // esattamente il verde falso che questa prova esiste per non dare.
  assert.equal(doveSuccede(finto, LETTURA_SEPOLTI), 2);
  assert.ok(doveSuccede(finto, UPSERT) < doveSuccede(finto, LETTURA_SEPOLTI));
});

test('🔪 IL CONTROLLO CHE MISURA IL METRO: su un sorgente sbagliato la guardia DEVE farsi rossa', () => {
  const sbagliato = [
    '  const existingRecords = await loadExistingBookingRecords(admin);',
    "  const { error: upsertError } = await admin.from('pmo_cloud_records').upsert(records, {});",
    '  const { sepolti } = await loadSepoltiESoppressioni(admin, confine);',
  ].join('\n');
  assert.ok(
    doveSuccede(sbagliato, LETTURA_SEPOLTI) > doveSuccede(sbagliato, UPSERT),
    'su questo sorgente la guardia deve vedere l\'ordine SBAGLIATO: se non lo vede, ' +
      'il verde che dà su index.ts non vuol dire niente.',
  );
});

test('🔪 …e il sabotaggio che NON tocca niente deve restare verde', () => {
  const giusto = [
    '  const existingRecords = await loadExistingBookingRecords(admin);',
    '  const { sepolti } = await loadSepoltiESoppressioni(admin, confine);',
    "  const { error: upsertError } = await admin.from('pmo_cloud_records').upsert(records, {});",
  ].join('\n');
  assert.ok(doveSuccede(giusto, LETTURA_SEPOLTI) < doveSuccede(giusto, UPSERT));
  assert.ok(SORGENTE.includes(SCRITTURA), 'la tabella scritta è ancora quella');
});

console.log(`\n${passed} passati, ${failed} falliti`);
if (failed > 0) process.exit(1);
