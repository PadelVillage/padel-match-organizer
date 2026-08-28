// Test deterministici della regola «la chiave non retrocede» (nessuna dipendenza).
// Esegui:  node supabase/functions/matchpoint-clients-sync/chiave-canonica.test.ts
//
// 🚨 QUESTA È LA CURA DELLA VOCE 69, e il difetto che chiude ha fatto tre danni diversi con la
//    stessa causa: «Non hai prenotazioni» a Fabiola (23/08), «Non sono riuscito a farti entrare»
//    a Lidia (24/08), «Non riesco ad aprire il test adesso» a Laura (28/08).
//
// ⭐ TARATURA — MISURATA sabotando il codice, non scritta a tavolino (28/08/2026).
//
//   sabotaggio                                     casi rossi (MISURATI)
//   ─────────────────────────────────────────────  ─────────────────────────────
//   nessuno                                        —  (12 verdi)
//   torna sempre la canonica (il difetto di oggi)  A, B, L, N
//   torna sempre l'esistente                       C, D, E, H, N
//   «>» invece di «>=»                             H, N
//   email: e phone: allo stesso rango              A, B, L, M, N
//   il rango del legacy diventa il massimo         C, M
//
// 🚨⭐⭐ QUESTA TABELLA È STATA CORRETTA DOPO LA MISURA, ed è la seconda volta che succede in
//    questo file (la prima è in `chiave-vecchia-guard.test.ts`, 9/08). L'avevo scritta prevedendo
//    e sbagliava in QUATTRO righe su cinque: mancava sempre **N**, che è il controllo del metro e
//    cade per costruzione a ogni sabotaggio; avevo previsto «A» per il rango appiattito (sono
//    cinque casi) e «C, D» per il legacy al massimo (sono C e M, non D — la D confronta `email:`
//    con `phone:`, e lì il legacy non c'entra).
//    ⇒ *Una tabella di taratura scritta e non misurata è una previsione travestita da prova, e
//    sembra identica a quella vera.* Vale a maggior ragione per chi l'ha già letta una volta:
//    saperlo non basta, va rifatta la misura.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { chiaveDaScrivere, rangoChiave } from './chiave-canonica.ts';

// ── I casi VERI, misurati su PROD il 28/08 ────────────────────────────────────────────
test('A · Laura Aprea: riga `phone:`, import senza telefono → si TIENE `phone:`', () => {
  // È il doppione nato il 09/08 alle 16:30:38, quello che oggi ha bloccato il test di livello.
  assert.equal(
    chiaveDaScrivere('phone:393338979606', 'email:aprea.lalla@gmail.com'),
    'phone:393338979606',
  );
});

test('B · Marco Aprea: stessa forma, stessa risposta', () => {
  assert.equal(
    chiaveDaScrivere('phone:393518560591', 'email:marco.aprea910@gmail.com'),
    'phone:393518560591',
  );
});

// ── E la normalizzazione che FUNZIONA non si tocca: è il lavoro per cui il ramo esiste ──
test('C · una riga legacy (uuid nudo) si normalizza a `phone:`', () => {
  assert.equal(
    chiaveDaScrivere('7a4186a7-1a04-422d-8b3d-8de044bc8184', 'phone:393338979606'),
    'phone:393338979606',
  );
});

test('D · una riga `email:` si normalizza a `phone:` quando il telefono arriva', () => {
  assert.equal(chiaveDaScrivere('email:tizio@x.it', 'phone:393331112222'), 'phone:393331112222');
});

test('E · una riga `name:` si normalizza a `email:`', () => {
  assert.equal(chiaveDaScrivere('name:mariorossi', 'email:mario@x.it'), 'email:mario@x.it');
});

// ── I bordi: qui non c'è nessuna scelta da fare ────────────────────────────────────────
test('F · senza riga esistente si usa la canonica', () => {
  assert.equal(chiaveDaScrivere('', 'phone:393331112222'), 'phone:393331112222');
  assert.equal(chiaveDaScrivere(null, 'email:x@y.it'), 'email:x@y.it');
  assert.equal(chiaveDaScrivere(undefined, 'name:x'), 'name:x');
});

test('G · senza canonica si tiene quella che c\'è (nessuna riga resta senza chiave)', () => {
  assert.equal(chiaveDaScrivere('phone:393331112222', ''), 'phone:393331112222');
  assert.equal(chiaveDaScrivere('email:x@y.it', null), 'email:x@y.it');
  assert.equal(chiaveDaScrivere('', ''), '');
});

test('H · a PARITÀ di rango vince la canonica: chi cambia numero cambia chiave', () => {
  // ⚖️ Non è un caso di bordo: è un socio che ha davvero cambiato telefono in Matchpoint, e
  //    lì seguire l'import è giusto. Fermare anche questo sarebbe curare troppo.
  assert.equal(chiaveDaScrivere('phone:393331112222', 'phone:393339998888'), 'phone:393339998888');
  assert.equal(chiaveDaScrivere('email:vecchia@x.it', 'email:nuova@x.it'), 'email:nuova@x.it');
});

test('I · una chiave identica a sé stessa resta identica', () => {
  assert.equal(chiaveDaScrivere('phone:393331112222', 'phone:393331112222'), 'phone:393331112222');
});

test('L · spazi intorno non cambiano la decisione', () => {
  assert.equal(chiaveDaScrivere('  phone:393331112222 ', ' email:x@y.it '), 'phone:393331112222');
});

// ── La scala, presa da sola ───────────────────────────────────────────────────────────
test('M · il rango: telefono > email > nome > tutto il resto', () => {
  assert.ok(rangoChiave('phone:39333') > rangoChiave('email:x@y.it'));
  assert.ok(rangoChiave('email:x@y.it') > rangoChiave('name:mariorossi'));
  assert.ok(rangoChiave('name:mariorossi') > rangoChiave('7a4186a7-1a04-422d-8b3d-8de044bc8184'));
  assert.equal(rangoChiave('member:abc'), 0);
  assert.equal(rangoChiave(''), 0);
  assert.equal(rangoChiave(null), 0);
});

// ── SABOTAGGIO: la prova che il caso A non è verde per caso ───────────────────────────
test('N · 🧪 IL CONTROLLO DEL METRO: la regola sa dire di NO in tutt\'e due i versi', () => {
  /* 🩹 La prima stesura di questo caso era SBAGLIATA: pretendeva che i due versi dessero
     risultati diversi, e li dà uguali — perché in tutt'e due vince il telefono, che è tutto il
     punto della regola. L'ha trovata il banco, non la rilettura.
     ⇒ Rifatto con chiavi distinguibili: si guarda QUALE delle due entra, non che stringa esce.
     📌 *Una prova che si aspetta due risultati diversi da una regola che ne ha uno solo non
     prova la regola: prova che chi l'ha scritta non l'aveva capita.* */
  const VECCHIA = 'phone:111';
  const NUOVA = 'phone:222';
  const DEBOLE = 'email:x@y.it';
  // ① non torna SEMPRE la canonica — sarebbe il difetto di oggi
  assert.equal(chiaveDaScrivere(VECCHIA, DEBOLE), VECCHIA, 'ha seguito un import piu\' povero');
  // ② non torna SEMPRE l'esistente — spegnerebbe la normalizzazione
  assert.equal(chiaveDaScrivere(DEBOLE, NUOVA), NUOVA, 'non si e\' normalizzata verso l\'alto');
  // ③ e a parita\' segue l'import: e\' il socio che ha cambiato numero
  assert.equal(chiaveDaScrivere(VECCHIA, NUOVA), NUOVA, 'a parita\' non ha seguito l\'import');
});

// ══════════════════════════════════════════════════════════════════════════════════════
// 🚨⭐⭐ IL CABLAGGIO — la metà che i casi qui sopra NON provano.
//
// 📏 Lezione pagata il 28/08 sulla voce 103: una regola giusta a cui nessuno passa il dato
//    lascia il banco **tutto verde** mentre il socio vede il difetto di prima. Qui è identico:
//    `chiaveDaScrivere` può essere perfetta e `index.ts` continuare a scrivere `canonicalKey`
//    nudo — e i dodici casi sopra non se ne accorgerebbero.
//
// ⚖️ COSA QUESTA GUARDIA PUÒ E NON PUÒ FARE, dichiarato: legge il sorgente, quindi prova che
//    la chiamata **c'è**, non che il giro del sync la esegua. È meno di un banco che gira il
//    codice vero — e `index.ts` non si può importare da qui, perché tira dentro Deno.
//    ⇒ È una rete, non una prova. Ma è la rete che il 28/08 mancava.
// ⭐ Tollerante alla FORMA: non pretende una riga scritta in un modo, pretende che nel punto in
//    cui si decide la `local_key` compaia la funzione e NON ci sia più il ripiego nudo.
test('O · 🚨 CABLAGGIO: `index.ts` decide la local_key passando da `chiaveDaScrivere`', () => {
  const sorgente = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.ok(
    /import\s*\{[^}]*chiaveDaScrivere[^}]*\}\s*from\s*['"]\.\/chiave-canonica\.ts['"]/.test(sorgente),
    'index.ts non importa piu\' chiaveDaScrivere: la cura e\' staccata',
  );
  /* 🩹 In `index.ts` di `const localKey = clean(` ce ne sono DUE — l'altro sta in
     `buildStaleMatchpointMemberOutcomes` e legge una riga, non decide niente. La prima stesura
     di questa guardia agganciava quello e falliva su un codice giusto.
     ⇒ Il punto si riconosce da `shouldNormalizeMemberLocalKey`, che compare solo in quello che
     conta. 📌 *Una guardia che cerca un testo deve cercare quello che identifica il punto, non
     quello che lo descrive: il secondo lo scrivono in tanti posti.* */
  const blocchi = [...sorgente.matchAll(/const localKey = clean\([\s\S]*?\);/g)]
    .map((m) => m[0])
    .filter((b) => b.includes('shouldNormalizeMemberLocalKey'));
  assert.equal(blocchi.length, 1,
    `mi aspetto UN solo punto che normalizza la local_key, ne ho trovati ${blocchi.length}`);
  const blocco = blocchi[0];
  assert.ok(
    blocco.includes('chiaveDaScrivere('),
    `la local_key non passa da chiaveDaScrivere:\n${blocco}`,
  );
  // 🚨 E il ripiego nudo NON deve tornare: era esattamente quello a fabbricare il doppione.
  assert.ok(
    !/:\s*\(canonicalKey\s*\|\|/.test(blocco),
    `il ripiego \`canonicalKey || …\` e' tornato nel ramo della normalizzazione:\n${blocco}`,
  );
});
