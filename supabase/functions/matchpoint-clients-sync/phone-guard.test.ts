// Test deterministici della guardia sul telefono (nessuna dipendenza esterna).
// Esegui:  node supabase/functions/matchpoint-clients-sync/phone-guard.test.ts
//
// ⭐ TARATURA — questa suite è stata verificata SABOTANDO il codice, non solo guardandola verde.
// Ogni metà del fix ha il caso che la isola, e il primo giro l'aveva rivelata monca:
//
//   sabotaggio                              casi che diventano rossi
//   ─────────────────────────────────────── ────────────────────────
//   nessuno                                 —  (tutti verdi)
//   phoneCellIsScientific = false           B
//   soglia misurata con phoneDigits()       G      ← senza G il sabotaggio passava INOSSERVATO
//   tutti e due (= il codice del 21/07)     A B G
//
// Il caso A da solo NON discrimina la doppia normalizzazione: il controllo sulla notazione
// scientifica lo intercetta prima. Serviva G — cella non scientifica che normalizza a 10 cifre.
import assert from 'node:assert/strict';
import { decidePhoneImport, normalizePhone, PLAUSIBLE_PHONE_MIN_DIGITS } from './phone-guard.ts';

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

// A) Il caso reale del 22/07, socio 001070. Su Matchpoint c'era "+113148914544" senza spazio:
//    Excel lo legge come NUMERO e lo esporta "1,13149E+11". Tolti i non-cifra resta "11314911"
//    (8 cifre, di cui "11" è l'ESPONENTE), il fallback italiano gli mette "39" davanti e ne
//    esce "+3911314911" — un numero che non esiste, usato però come identità del socio.
test('la cella in notazione scientifica non entra (caso 001070)', () => {
  assert.deepEqual(decidePhoneImport('1,13149E+11'), { phone: '', phoneImportRejected: true });
});

// B) ⭐ ISOLA il controllo sulla cella grezza. Con più cifre significative il resto è più lungo,
//    il "39" lo porta a 12 e la SOGLIA DA SOLA non lo vedrebbe: solo riconoscere la notazione
//    scientifica sulla cella lo ferma. Togli quel controllo e questo caso diventa rosso.
test('TARATURA scientifica: anche una scientifica lunga (12 cifre) viene fermata', () => {
  assert.deepEqual(decidePhoneImport('1,1314891E+11'), { phone: '', phoneImportRejected: true });
  // la prova che senza il controllo sarebbe passata: da sola la soglia la promuove
  assert.equal(normalizePhone('1,1314891E+11').replace(/\D/g, '').length >= PLAUSIBLE_PHONE_MIN_DIGITS, true);
});

// G) ⭐ ISOLA la soglia. Cella NON scientifica che normalizza a 10 cifre: il controllo del
//    punto B non c'entra nulla, decide solo la soglia. E la soglia funziona SOLO se misura il
//    valore salvato: `normalizePhone` non è idempotente e rimisurando gonfia 10 → 12.
test('TARATURA soglia: una cella corta non scientifica viene scartata', () => {
  assert.deepEqual(decidePhoneImport('11314911'), { phone: '', phoneImportRejected: true });
  // la non-idempotenza, messa nero su bianco: è la trappola che rendeva cieca la guardia
  assert.equal(normalizePhone('11314911'), '+3911314911');
  assert.equal(normalizePhone('+3911314911'), '+393911314911');
});

// C) I quattro monchi italiani storici (Aprea, Carnevale, Longato, Comes) restano scartati:
//    il fix non deve barattare il buco nuovo con una regressione su quelli vecchi.
test('i monchi italiani storici restano scartati', () => {
  for (const cella of ['3,93358E+11', '3,93896E+11', '3,93474E+11', '3,93385E+11']) {
    assert.deepEqual(decidePhoneImport(cella), { phone: '', phoneImportRejected: true }, cella);
  }
});

// D/E) ⭐ L'esito OPPOSTO con la stessa funzione: se scartasse tutto, questi fallirebbero.
test('i numeri sani passano, scritti internazionali o locali', () => {
  assert.deepEqual(decidePhoneImport('+39 3474994381'), { phone: '+393474994381', phoneImportRejected: false });
  assert.deepEqual(decidePhoneImport('3474994381'), { phone: '+393474994381', phoneImportRejected: false });
});

// F) Il socio 001070 scritto BENE su Matchpoint: prefisso estero e uno spazio. Lo spazio è ciò
//    che impedisce a Excel di leggere la cella come numero — è la difesa che costa niente.
test('l\'estero scritto con lo spazio arriva intatto', () => {
  assert.deepEqual(decidePhoneImport('+1 3148914544'), { phone: '+13148914544', phoneImportRejected: false });
});

// I 5 italiani storici a 9 cifre (Novati, Bazzo, Cimbalo, Vazzola, Sansoni) non devono perdere
// il 39 nemmeno se scritti col "+": è il motivo per cui esiste ITALIAN_LOCAL_MOBILE_RE.
test('gli italiani a 9 cifre col + restano italiani', () => {
  assert.deepEqual(decidePhoneImport('+335228405'), { phone: '+39335228405', phoneImportRejected: false });
});

test('cella vuota: nessun telefono e nessuno scarto da segnalare', () => {
  assert.deepEqual(decidePhoneImport(''), { phone: '', phoneImportRejected: false });
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
