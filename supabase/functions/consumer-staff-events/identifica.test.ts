// Prove della risoluzione nome → persona (voce 68).
// Esegui:  node supabase/functions/consumer-staff-events/identifica.test.ts
import assert from 'node:assert/strict';
import { destinatarioPerNome, impronta, normNome, type SchedaMinima } from './identifica.ts';

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

function scheda(id: string, nome: string, pmo = '', member = ''): SchedaMinima {
  return { id, nome, pmoPlayerId: pmo, memberId: member };
}

// ── ⭐ IL CASO VERO che ha corretto questo modulo (PROD, 21/08/2026) ──────────────────────
test('⭐ due schede della STESSA persona (duplicato) → si scrive lo stesso', () => {
  // Misurato su PROD: «Lidia Comes» ha due schede vive, stesso PMO-000583 e stesso 001013.
  // Con la regola secca «più di una ⇒ nessuno» non avrebbe mai ricevuto un avviso, e il
  // silenzio sarebbe stato indistinguibile da «non è successo niente».
  const schede = [
    scheda('a', 'Lidia Comes', 'PMO-000583', '001013'),
    scheda('b', 'Lidia Comes', 'PMO-000583', '001013'),
  ];
  const d = destinatarioPerNome('Lidia Comes', schede);
  assert.ok(d, 'un duplicato d\'anagrafica non deve costare a un socio i suoi messaggi');
  assert.equal(d.pmoPlayerId, 'PMO-000583');
});

test('🚨 due schede di persone DIVERSE → non si scrive a nessuno', () => {
  // 24 codici socio condivisi da 48 persone, misurati il 9/08: l'ambiguità vera esiste.
  const schede = [
    scheda('a', 'Mario Rossi', 'PMO-000111', '000111'),
    scheda('b', 'Mario Rossi', 'PMO-000222', '000222'),
  ];
  assert.equal(destinatarioPerNome('Mario Rossi', schede), null);
});

test('🚨 due schede, una senza nessun identificativo → prudenza, non si scrive', () => {
  const schede = [
    scheda('a', 'Anna Bianchi', 'PMO-000333', '000333'),
    scheda('b', 'Anna Bianchi'),
  ];
  assert.equal(destinatarioPerNome('Anna Bianchi', schede), null);
});

// ── I casi normali ───────────────────────────────────────────────────────────────────────
test('una scheda sola: il caso di tutti i giorni', () => {
  const d = destinatarioPerNome('Maurizio Aprea', [scheda('x', 'Maurizio Aprea', 'PMO-000523', '000004')]);
  assert.equal(d?.pmoPlayerId, 'PMO-000523');
  assert.equal(d?.memberId, '000004');
});

test('nessuna scheda: non è del circolo, o il nome è scritto diversamente', () => {
  assert.equal(destinatarioPerNome('Chi Nonesiste', [scheda('x', 'Maurizio Aprea', 'PMO-000523')]), null);
});

test('un nome vuoto non cerca nessuno', () => {
  assert.equal(destinatarioPerNome('   ', [scheda('x', '', '')]), null);
});

test('fra due copie vince quella con l\'ID Padel Village', () => {
  // Regola del 2/08: «l'ID che il bot deve leggere è l'ID PMO, non quello Matchpoint».
  const schede = [
    scheda('a', 'Lidia Comes', '', '001013'),
    scheda('b', 'Lidia Comes', 'PMO-000583', '001013'),
  ];
  // ⚠️ Le impronte differiscono (una senza PMO) ⇒ prudenza: sono trattate come diverse.
  assert.equal(destinatarioPerNome('Lidia Comes', schede), null);
});

test('accenti e spazi non impediscono di riconoscere la persona', () => {
  const d = destinatarioPerNome('niccolò  d\'amico', [scheda('x', 'Niccolò D\'Amico', 'PMO-000999')]);
  assert.equal(d?.pmoPlayerId, 'PMO-000999');
});

// ── L'impronta ───────────────────────────────────────────────────────────────────────────
test('l\'impronta guarda i due identificativi insieme', () => {
  assert.equal(impronta(scheda('a', 'X', 'PMO-000001', '000001')), 'PMO-000001|000001');
  assert.equal(impronta(scheda('a', 'X', 'pmo-000001', '000001')), 'PMO-000001|000001', 'maiuscole indifferenti');
  assert.equal(impronta(scheda('a', 'X', '', '000001')), '|000001');
  assert.equal(impronta(scheda('a', 'X')), null, 'senza nessuno dei due non c\'è impronta');
});

test('normNome', () => {
  assert.equal(normNome('  Maurizio   Aprea '), 'maurizio aprea');
  assert.equal(normNome(''), '');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
