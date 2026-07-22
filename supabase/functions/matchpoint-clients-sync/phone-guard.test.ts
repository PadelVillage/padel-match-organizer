// Test deterministici della guardia sul telefono (nessuna dipendenza esterna).
// Esegui:  node supabase/functions/matchpoint-clients-sync/phone-guard.test.ts
//
// ⭐ TARATURA — questa suite è stata verificata SABOTANDO il codice, non solo guardandola verde.
// Ogni metà del fix ha il caso che la isola, e il primo giro l'aveva rivelata monca:
//
//   sabotaggio                                        casi che diventano rossi
//   ───────────────────────────────────────────────── ────────────────────────
//   nessuno                                           —  (tutti verdi)
//   phoneCellIsScientific = false                     B
//   soglia d'import misurata con phoneDigits()        G    ← senza G il sabotaggio passava INOSSERVATO
//   tutti e due (= il codice del 21/07)               A B G
//   ── marcatore del report (22/07 sera) ────────────
//   marcatore misurato con phoneDigits() (= IL RESIDUO)  H
//   marcatore senza soglia (solo il gate)             I
//   marcatore senza gate (solo la soglia)             J
//   marcatore sempre spento                           H, K
//   normalizedPhoneDigits che NORMALIZZA              G, H, L
//
// Il caso A da solo NON discrimina la doppia normalizzazione: il controllo sulla notazione
// scientifica lo intercetta prima. Serviva G — cella non scientifica che normalizza a 10 cifre.
//
// ⭐ NOTA CONTROCORRENTE su H, che vale la pena tenere. La regola di questo archivio è «il caso
// reale non discrimina quasi mai», perché nel mondo vero il guasto ha più difese addosso e una
// copre l'altra. Qui è il contrario: il valore REALE in archivio di Vitagliano `000827`
// (`+3939544457`) è l'unico caso che smonta il residuo, ed è rosso da solo. Il motivo è che il
// residuo NON ha una seconda difesa davanti — è l'ultima riga prima del payload — quindi non c'è
// niente che possa mascherarlo. → La regola non dice «usa casi costruiti»: dice «cerca la
// difesa che copre». Dove non ce n'è, il caso reale torna a essere il più informativo.
import assert from 'node:assert/strict';
import {
  decidePhoneImport,
  keepPhoneImportRejected,
  normalizePhone,
  normalizedPhoneDigits,
  PLAUSIBLE_PHONE_MIN_DIGITS,
} from './phone-guard.ts';

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

// ── keepPhoneImportRejected · il marcatore del report (residuo chiuso il 22/07 sera) ─────────

// H) ⭐ IL CASO CHE DISCRIMINA, ed è REALE: Vitagliano `000827` ha in archivio `+3939544457` —
//    10 cifre, cioè SOTTO la soglia di 11, quindi il marcatore deve restare acceso. Misurando
//    con `phoneDigits()` il numero rientra in `normalizePhone`, si prende un secondo `39`,
//    arriva a 12 e il marcatore si spegne: il record rotto sparisce dal report.
//    Stessa storia per Carla Tpc `000704` (`+39363359+11`), l'altro dei 2 misurati su PROD.
test('H · marcatore ACCESO su un numero a 10 cifre in archivio (Vitagliano 000827)', () => {
  assert.equal(keepPhoneImportRejected(true, '+3939544457'), true);
  assert.equal(keepPhoneImportRejected(true, '+39363359+11'), true);
  // la trappola, nero su bianco: rinormalizzare gonfia 10 → 12 e porta SOPRA soglia
  assert.equal(normalizedPhoneDigits('+3939544457').length, 10);
  assert.equal(normalizePhone('+3939544457').replace(/\D/g, '').length, 12);
});

// I) ⭐ L'ESITO OPPOSTO, che impedisce il fix pigro «marcatore sempre acceso»: se in archivio
//    c'è già un numero pieno non c'è niente da segnalare, altrimenti il report giornaliero si
//    riempie di soci a posto e smette di essere letto (guardia `phoneSuspectKept`, casi Aprea
//    e Comes). ⚠️ Senza questo caso, «return true» passerebbe la suite.
test('I · marcatore SPENTO se in archivio c\'è già un numero pieno', () => {
  assert.equal(keepPhoneImportRejected(true, '+393357615855'), false);
});

// J) ⭐ ISOLA IL GATE: il marcatore può solo SPEGNERE quello deciso all'import, mai accenderlo.
//    Un socio che l'import NON ha scartato non deve finire nel report solo perché il suo numero
//    in archivio è corto — quello è un dato vecchio, non uno scarto di oggi.
test('J · import che non ha scartato → marcatore spento anche con numero corto', () => {
  assert.equal(keepPhoneImportRejected(false, '+3939544457'), false);
  assert.equal(keepPhoneImportRejected(undefined, '+3939544457'), false);
  // gated davvero: solo il booleano `true` accende, non un valore verosimile
  assert.equal(keepPhoneImportRejected('true', '+3939544457'), false);
});

// K) Record senza telefono: è il caso in cui il marcatore serve DI PIÙ — cella scartata e cella
//    vuota danno entrambe `phone: ''`, e questo marcatore è l'unico segnale che le distingue.
test('K · nessun telefono in archivio → marcatore acceso (distingue scartata da vuota)', () => {
  assert.equal(keepPhoneImportRejected(true, ''), true);
  assert.equal(keepPhoneImportRejected(true, null), true);
});

// L) `normalizedPhoneDigits` non deve MAI normalizzare: è tutta la sua ragione d'essere.
test('L · normalizedPhoneDigits conta e basta, non aggiunge prefissi', () => {
  assert.equal(normalizedPhoneDigits('+3911314911'), '3911314911');
  assert.equal(normalizedPhoneDigits('+39 335 7615855'), '393357615855');
  assert.equal(normalizedPhoneDigits(''), '');
  assert.equal(normalizedPhoneDigits(undefined), '');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
