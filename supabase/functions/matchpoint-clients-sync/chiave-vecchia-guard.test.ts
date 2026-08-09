// Test deterministici della guardia «chiave vecchia della stessa scheda» (nessuna dipendenza).
// Esegui:  node supabase/functions/matchpoint-clients-sync/chiave-vecchia-guard.test.ts
//
// ⭐ TARATURA — verificata SABOTANDO il codice, non solo guardandola verde (9/08/2026).
//
//   sabotaggio                                            casi rossi (MISURATI)
//   ────────────────────────────────────────────────────  ─────────────────────────
//   nessuno                                               —  (11 verdi)
//   tolto il confronto sull'id (basta il telefono)        E, F, G, H
//   tolto il confronto sul telefono (basta l'id)          C, D, I, L
//   tolto il controllo «id non vuoto»                     G
//   tolto il controllo «telefono non vuoto»               I, L
//   confronto telefono sulle cifre INTERE (no ultime 10)  B
//   ritorna sempre true                                   C, D, E, F, G, H, I, L, M
//   ritorna sempre false                                  A, B
//
// 🚨⭐⭐ QUESTA TABELLA È STATA CORRETTA DOPO LA MISURA, e la differenza è la ragione per cui
//    si sabota invece di ragionarci: l'avevo scritta a tavolino e sbagliava in QUATTRO righe su
//    sette. Avevo previsto «tolto l'id → E, F» (sono quattro), «tolto il controllo id non vuoto
//    → G, H» (è solo G), e avevo messo M fra i rossi di «sempre false» quando M si aspetta
//    proprio `false`. ⇒ *Una tabella di taratura scritta e non misurata è una previsione
//    travestita da prova, e sembra identica a quella vera.*
//
// 🚨 I casi che contano più di tutti sono **E** e **F**: lì un `true` sbagliato
//    CANCELLEREBBE UNA PERSONA VERA. Se un domani qualcuno «semplifica» la guardia lasciando
//    solo il telefono, sono loro (con G e H) a diventare rossi.

import assert from 'node:assert/strict';
import test from 'node:test';
import { eChiaveVecchiaDellaStessaScheda as guardia } from './chiave-vecchia-guard.ts';

// ── I casi VERI, misurati su PROD il 9/08/2026: la chiave passa da `phone:` a `email:`
//    quando il socio «entra da Matchpoint». Stessa scheda, stesso numero. ─────────────
test('A · Ivana Tadiotto: stessa scheda, stesso numero → è una chiave vecchia', () => {
  const s = { id: '49927a6e-d112-4028-8e71-e91b90499450', phone: '+393403603459' };
  assert.equal(guardia({ ...s }, s), true);
});

test('B · il confronto regge prefissi e spaziature diverse (ultime 10 cifre)', () => {
  assert.equal(
    guardia({ id: 'x', phone: '3403603459' }, { id: 'x', phone: '+39 340 360 3459' }),
    true,
  );
});

// ── I casi in cui deve dire NO. ──────────────────────────────────────────────────────

test('C · 🚨 il caso che la v6.090 protegge: stessa scheda ma NUMERO DIVERSO → NO', () => {
  // È il recapito curato in rubrica di un socio col telefono rotto in Matchpoint.
  // Archiviarlo perderebbe il numero buono e farebbe ripartire il churn notturno.
  assert.equal(
    guardia({ id: 'x', phone: '3939561626' }, { id: 'x', phone: '3939651626' }),
    false,
  );
});

test('D · numero presente da una parte sola → NO', () => {
  assert.equal(guardia({ id: 'x', phone: '3403603459' }, { id: 'x', phone: '' }), false);
});

test('E · 🚨🚨 DUE FAMILIARI CON LO STESSO NUMERO sono due PERSONE → NO', () => {
  // Il caso per cui il solo telefono non può bastare: qui un `true` cancellerebbe qualcuno.
  assert.equal(
    guardia({ id: 'figlio', phone: '3403603459' }, { id: 'padre', phone: '3403603459' }),
    false,
  );
});

test('F · 🚨🚨 stesso nome e stesso numero ma schede diverse → NO', () => {
  assert.equal(
    guardia({ id: 'scheda-1', phone: '+393474994381' }, { id: 'scheda-2', phone: '+393474994381' }),
    false,
  );
});

test('G · id mancante nel candidato → NO (non si deduce niente dal vuoto)', () => {
  assert.equal(guardia({ id: '', phone: '3403603459' }, { id: '', phone: '3403603459' }), false);
});

test('H · id mancante nel sopravvissuto → NO', () => {
  assert.equal(guardia({ id: 'x', phone: '3403603459' }, { id: '', phone: '3403603459' }), false);
});

test('I · telefono mancante in tutt\'e due → NO (due vuoti non sono «uguali»)', () => {
  // 🚨 Se questo diventasse `true`, le utenze di servizio senza telefono (Ospite, Demo App)
  //    si archivierebbero a vicenda.
  assert.equal(guardia({ id: 'x', phone: '' }, { id: 'x', phone: '' }), false);
});

test('L · telefono fatto di soli caratteri non numerici → NO', () => {
  assert.equal(guardia({ id: 'x', phone: '---' }, { id: 'x', phone: '---' }), false);
});

test('M · candidato o sopravvissuto assenti → NO, senza scoppiare', () => {
  assert.equal(guardia(null, { id: 'x', phone: '3403603459' }), false);
  assert.equal(guardia({ id: 'x', phone: '3403603459' }, undefined), false);
  assert.equal(guardia(null, null), false);
});
