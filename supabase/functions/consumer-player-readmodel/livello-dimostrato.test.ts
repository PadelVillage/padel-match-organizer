// «Il livello l'ha dimostrato?» — test deterministici, nessuna dipendenza esterna.
// Esegui:  node supabase/functions/consumer-player-readmodel/livello-dimostrato.test.ts
//
// ⭐ I casi del gruppo 2 sono quelli che DISCRIMINANO: girati sulla riga vecchia
// (`!!level && level !== '0.5'`) diventano rossi, perché quella riga non sa niente
// dell'origine. Se un giorno diventassero verdi anche senza il modulo, vorrebbe dire che
// il modulo è stato scavalcato.
// ⭐ I casi del gruppo 3 sono l'altra metà, ed è quella che protegge le persone vere: i 517
// soci di PROD che il livello ce l'hanno con l'origine VUOTA. Se questi diventassero rossi,
// il circolo perderebbe il diritto di organizzare dall'oggi al domani.
import assert from 'node:assert/strict';
import { livelloDimostrato, livelloInPrestito } from './livello-dimostrato.ts';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`ok   - ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`FAIL - ${name}`);
    console.log(`       ${(e as Error).message.split('\n')[0]}`);
  }
}

// ── 1. Quello che valeva prima, e deve continuare a valere ─────────────────

test('1. un livello vero è dimostrato', () => {
  assert.equal(livelloDimostrato('4.5', 'autovalutazione'), true);
  assert.equal(livelloDimostrato('2', 'autovalutazione'), true);
});

test('2. «0.5» è «da definire», non un livello — con qualunque origine', () => {
  assert.equal(livelloDimostrato('0.5', ''), false);
  assert.equal(livelloDimostrato('0.5', 'autovalutazione'), false);
  assert.equal(livelloDimostrato(' 0.5 ', 'ereditato'), false);
});

test('3. niente livello, niente da dimostrare', () => {
  assert.equal(livelloDimostrato('', 'autovalutazione'), false);
  assert.equal(livelloDimostrato(null, ''), false);
  assert.equal(livelloDimostrato(undefined, undefined), false);
  assert.equal(livelloDimostrato('   ', ''), false);
});

// ── 2. Il livello IN PRESTITO — i casi che discriminano ────────────────────

test('4. un livello ereditato da chi invita NON è dimostrato', () => {
  assert.equal(livelloDimostrato('4.5', 'ereditato'), false);
});

test('5. e nemmeno nella sua forma «da confermare»', () => {
  assert.equal(livelloDimostrato('4.5', 'ereditato_da_confermare'), false);
});

test('6. maiuscole e spazi non sono una scappatoia (il campo lo scrive del codice)', () => {
  assert.equal(livelloDimostrato('4.5', '  Ereditato  '), false);
  assert.equal(livelloDimostrato('4.5', 'EREDITATO_DA_CONFERMARE'), false);
});

// 🚨⭐⭐ QUESTO CASO È STATO RIFATTO, e il perché vale più del caso.
// La prima versione provava `autovalutazione_ereditata`, ed era **inerte**: quella parola
// finisce in «a», quindi non contiene «ereditato» e passava identica con `startsWith` e con
// `includes`. Il sabotaggio l'ha smascherata — messo `includes` al posto di `startsWith`, il
// banco restava **verde**. Ci vuole un valore che CONTENGA «ereditato» senza cominciarci:
// il livello di chi aveva un prestito e poi l'ha dimostrato col test.
// ⇒ *Un caso che non discrimina non è un caso: è una riga che rassicura.*
test('7. «ereditato» si cerca IN TESTA, non dentro: chi ha dimostrato dopo un prestito resta valido', () => {
  assert.equal(livelloDimostrato('4.5', 'autovalutazione_dopo_ereditato'), true);
  assert.equal(livelloInPrestito('autovalutazione_dopo_ereditato'), false);
  assert.equal(livelloInPrestito('ereditato'), true);
});

// ── 3. I 517 di PROD — chi il livello ce l'ha da prima che ci fosse un campo per dirlo ──

test('8. livello vero con origine VUOTA: resta dimostrato', () => {
  assert.equal(livelloDimostrato('4.5', ''), true);
  assert.equal(livelloDimostrato('3', null), true);
  assert.equal(livelloDimostrato('5.5', undefined), true);
});

test('9. un\'origine che non conosciamo non toglie il livello a nessuno', () => {
  assert.equal(livelloDimostrato('4.5', 'import_excel'), true);
  assert.equal(livelloDimostrato('4.5', 'segreteria'), true);
  assert.equal(livelloDimostrato('4.5', 'autovalutazione_da_verificare'), true);
});

console.log(`\n${passed} verdi · ${failed} rossi`);
if (failed > 0) process.exit(1);
