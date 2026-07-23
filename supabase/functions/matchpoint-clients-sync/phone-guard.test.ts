// Test deterministici della guardia sul telefono (nessuna dipendenza esterna).
// Esegui:  node supabase/functions/matchpoint-clients-sync/phone-guard.test.ts
//
// ⭐ TARATURA — questa suite è stata verificata SABOTANDO il codice, non solo guardandola verde.
// La tabella è MISURATA (sabota davvero → guarda i rossi), RI-misurata il 23/07 dopo il ridisegno
// della riga 39: estrarre/ridisegnare sposta i punti di sabotaggio, e un verde non ri-verificato
// non vale.
//
//   sabotaggio                                             casi rossi (MISURATI)
//   ─────────────────────────────────────────────────────  ─────────────────────
//   nessuno                                                —  (15 verdi)
//   guard /^[30]/ tolto dalla riga 39 (= la regola vecchia)  M, G
//   controllo notazione scientifica spento                 B
//   soglia d'import misurata con phoneDigits()             (NESSUNO — vedi ⓘ)
//   soglia d'import spenta                                 G
//   ── marcatore del report (keepPhoneImportRejected) ───
//   marcatore misurato con phoneDigits() (= IL RESIDUO)    H
//   marcatore senza soglia (solo il gate)                  I
//   marcatore senza gate (solo la soglia)                  J
//   marcatore sempre spento                                H, K
//   normalizedPhoneDigits che RINORMALIZZA                 H, L
//
// ⓘ Il ridisegno del 23/07 ha reso MOOT il sabotaggio «soglia d'import con phoneDigits()», che il
//   22/07 accendeva G. Togliendo il "39" fittizio, sul percorso d'IMPORT phoneDigits e
//   normalizedPhoneDigits coincidono (importedPhone esce già canonico da normalizePhone), quindi
//   nessun caso li distingue più lì. Non è un buco: è che quel bug non può più avvenire sull'import.
//   Il residuo che li distingue vive ora solo nel MARCATORE (riga H), su un valore d'ARCHIVIO.
//
// Il caso A (scientifica reale, 001070) da solo NON discrimina: il controllo scientifica lo
// intercetta prima. Servono B (scientifica ad alta precisione) per isolare quel controllo, ed M
// (estero col "+" perso) per isolare il guard /^[30]/ del ridisegno.
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
  phoneDigits,
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

// B) ⭐ ISOLA il controllo sulla cella grezza. Una scientifica ad alta precisione strippa a ≥11
//    cifre da sé: la SOGLIA non la vede, e — dopo il ridisegno della riga 39, che non incolla più
//    un "39" fittizio (inizia per 1) — nemmeno quel gonfiaggio la ferma. La scarta SOLO il
//    riconoscere la notazione scientifica sulla cella grezza. Togli quel controllo e diventa rosso.
test('TARATURA scientifica: una scientifica ad alta precisione (12 cifre) viene fermata', () => {
  assert.deepEqual(decidePhoneImport('1,131489111E+11'), { phone: '', phoneImportRejected: true });
  // la prova che senza il controllo sarebbe passata: strippa a 12 cifre, sopra soglia da sola
  assert.equal(normalizePhone('1,131489111E+11').replace(/\D/g, '').length >= PLAUSIBLE_PHONE_MIN_DIGITS, true);
});

// G) ⭐ ISOLA la soglia. Cella NON scientifica e corta: la scientifica del punto B non c'entra,
//    decide solo la soglia. Dopo il ridisegno della riga 39 un "11314911" (inizia per 1) non
//    prende più il "39" fittizio e resta "+11314911" (8 cifre) — sotto soglia, scartato. Togli la
//    soglia e questo passerebbe come identità buona.
test('TARATURA soglia: una cella corta non scientifica viene scartata', () => {
  assert.deepEqual(decidePhoneImport('11314911'), { phone: '', phoneImportRejected: true });
  assert.equal(normalizePhone('11314911'), '+11314911');
  // la non-idempotenza resta reale sui 10-cifre-che-iniziano-per-3 (ramo riga 32, non toccato):
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

// ── il ridisegno della riga 39: il "39" fittizio SOLO per numeri plausibilmente italiani (23/07) ──

// M) ⭐ IL CASO CHE DISCRIMINA il ridisegno, ed è il socio 001070. Se Matchpoint scrive
//    "+13148914544" senza separatore, Excel legge la cella come numero e mangia il "+": arriva
//    "13148914544". Regola VECCHIA: !inizia-per-39 && 8..11 cifre → gli incolla "39" →
//    "+3913148914544", un numero inesistente usato come IDENTITÀ (memberCloudKey). Nuova: inizia
//    per 1, non può essere italiano → lasciato bare. Togli il guard `/^[30]/` e questo è rosso.
test('M · un estero che ha perso il + resta bare, non diventa +39<estero> (001070)', () => {
  assert.equal(normalizePhone('13148914544'), '+13148914544');
  // ⭐ la PROPRIETÀ che rompe il ciclo tombstone+resurrezione: col + o senza, la CHIAVE è la
  //    stessa. È ciò che rende stabili i 18 esteri MP il giorno che l'export perde il separatore.
  assert.equal(phoneDigits('13148914544'), phoneDigits('+13148914544'));
  assert.equal(phoneDigits('13148914544'), '13148914544');
});

// N) ⭐ CONTROLLO del ridisegno: i numeri plausibilmente italiani prendono ANCORA il "39", col
//    ridisegno o senza. Senza questo, un pigro «non incollare mai il 39» passerebbe la suite — e
//    toglierebbe il prefisso a mezza anagrafica. Copre il ramo riga 32 (10 cifre) e il rescue dei
//    9-cifre col + (riga 39, che inizia per 3 → ancora italiano).
test('N · gli italiani plausibili prendono ancora il 39 (controllo)', () => {
  assert.equal(normalizePhone('3474994381'), '+393474994381');
  assert.equal(normalizePhone('+335228405'), '+39335228405');
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
