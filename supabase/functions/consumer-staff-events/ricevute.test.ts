// Prove della copertura fatto ↔ ricevuta (voce 70).
// Esegui:  node supabase/functions/consumer-staff-events/ricevute.test.ts
import assert from 'node:assert/strict';
import {
  chiaveGesto,
  copertura,
  FINESTRA_RICEVUTA_MS,
  TOLLERANZA_ANTICIPO_MS,
  type Ricevuta,
} from './ricevute.ts';
import { riduci, type FattoInCoda } from './riduzione.ts';

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

const T0 = Date.parse('2026-08-21T21:36:00Z');   // la scrittura vera del collaudo
const iso = (ms: number) => new Date(ms).toISOString();

let seqF = 0;
function fatto(
  gesto: FattoInCoda['gesto'],
  offsetMs: number,
  persona = 'Lidia Comes',
  { data = '2026-08-31', ora = '11:00', campo = 'Campo 1' } = {},
): FattoInCoda {
  seqF += 1;
  return {
    id: `f${seqF}`,
    slot: `${data}|${ora}|${campo.replace(/\D/g, '')}`,
    data, ora, campo, persona, gesto,
    visto_at: iso(T0 + offsetMs),
  };
}

let seqR = 0;
function ricevuta(
  gesto: Ricevuta['gesto'],
  offsetMs: number,
  persona = 'Lidia Comes',
  { data = '2026-08-31', ora = '11:00', campo = '1' } = {},
): Ricevuta {
  seqR += 1;
  return {
    id: `r${seqR}`,
    data, ora, campo, persona, gesto,
    scritta_at: iso(T0 + offsetMs),
  };
}

// ── Il caso da cui la voce nasce ────────────────────────────────────────────────────────
test('IL CASO DEL 21/08: Lidia entra dal bot, il fatto che ne nasce non si consegna', () => {
  // 1′33″ è la finestra misurata fra la scrittura e il ritorno del sync.
  const c = copertura([fatto('aggiunto', 93_000)], [ricevuta('aggiunto', 0)]);
  assert.equal(c.daConsegnare.length, 0, 'il circolo non deve annunciarle il proprio gesto');
  assert.equal(c.coperti.length, 1);
  assert.equal(c.coperti[0].ricevuta.id, 'r1');
});

test('senza ricevuta il fatto passa: è la segreteria, e va detto', () => {
  const c = copertura([fatto('aggiunto', 93_000)], []);
  assert.equal(c.daConsegnare.length, 1);
  assert.equal(c.coperti.length, 0);
});

// ── Le grafie che non devono far fallire l'accoppiamento ────────────────────────────────
test('«Campo 1» e «1» sono lo stesso campo', () => {
  const f = fatto('tolto', 60_000, 'Maurizio Aprea', { campo: 'Campo 3' });
  const r = ricevuta('tolto', 0, 'Maurizio Aprea', { campo: '3' });
  assert.equal(copertura([f], [r]).coperti.length, 1);
});

test('«11:00:00» e «11:00» sono la stessa ora', () => {
  const f = fatto('tolto', 60_000, 'Maurizio Aprea', { ora: '11:00:00' });
  const r = ricevuta('tolto', 0, 'Maurizio Aprea', { ora: '11:00' });
  assert.equal(copertura([f], [r]).coperti.length, 1);
});

test('il nome si confronta senza accenti, maiuscole e spazi doppi', () => {
  const f = fatto('tolto', 60_000, '  NICCOLÒ  Dè Rossi ');
  const r = ricevuta('tolto', 0, "niccolo de rossi");
  assert.equal(copertura([f], [r]).coperti.length, 1);
});

test('una partita diversa non si fa coprire', () => {
  const f = fatto('aggiunto', 60_000, 'Lidia Comes', { data: '2026-09-01' });
  const r = ricevuta('aggiunto', 0);
  assert.equal(copertura([f], [r]).daConsegnare.length, 1);
});

test('una persona diversa non si fa coprire', () => {
  const c = copertura([fatto('aggiunto', 60_000, 'Fabiola Neri')], [ricevuta('aggiunto', 0)]);
  assert.equal(c.daConsegnare.length, 1);
});

test('un gesto opposto non si fa coprire: entrare dal bot non copre un TOLTO del circolo', () => {
  const c = copertura([fatto('tolto', 60_000)], [ricevuta('aggiunto', 0)]);
  assert.equal(c.daConsegnare.length, 1, 'chi è stato tolto dalla segreteria deve saperlo');
});

// ── La finestra ─────────────────────────────────────────────────────────────────────────
test('dentro la finestra copre, appena fuori no', () => {
  assert.equal(copertura([fatto('aggiunto', FINESTRA_RICEVUTA_MS)], [ricevuta('aggiunto', 0)]).coperti.length, 1);
  assert.equal(copertura([fatto('aggiunto', FINESTRA_RICEVUTA_MS + 1000)], [ricevuta('aggiunto', 0)]).daConsegnare.length, 1);
});

test('la finestra copre il ritardo massimo di sync misurato (10′04″)', () => {
  const c = copertura([fatto('aggiunto', 604_000)], [ricevuta('aggiunto', 0)]);
  assert.equal(c.coperti.length, 1, '10′04″ è il massimo misurato il 16/08: deve starci dentro');
});

test('un fatto visto POCO PRIMA della ricevuta si copre lo stesso (il worker è lento)', () => {
  const c = copertura([fatto('aggiunto', -60_000)], [ricevuta('aggiunto', 0)]);
  assert.equal(c.coperti.length, 1);
});

test('ma un fatto visto MOLTO prima è di qualcun altro: passa', () => {
  const c = copertura([fatto('aggiunto', -TOLLERANZA_ANTICIPO_MS - 1000)], [ricevuta('aggiunto', 0)]);
  assert.equal(c.daConsegnare.length, 1);
});

// ── Il consumo: una ricevuta, un fatto ──────────────────────────────────────────────────
test('UNA ricevuta copre UN fatto: il secondo gesto uguale è della segreteria e passa', () => {
  const primo = fatto('aggiunto', 60_000);
  const secondo = fatto('aggiunto', 300_000);
  const c = copertura([primo, secondo], [ricevuta('aggiunto', 0)]);
  assert.equal(c.coperti.length, 1);
  assert.equal(c.daConsegnare.length, 1);
  assert.equal(c.coperti[0].fatto.id, primo.id, 'copre il più vecchio, non uno a caso');
  assert.equal(c.daConsegnare[0].id, secondo.id);
});

test('due ricevute uguali coprono due fatti uguali', () => {
  const c = copertura(
    [fatto('aggiunto', 60_000), fatto('aggiunto', 300_000)],
    [ricevuta('aggiunto', 0), ricevuta('aggiunto', 240_000)],
  );
  assert.equal(c.coperti.length, 2);
  assert.equal(c.daConsegnare.length, 0);
});

test('l\'ordine in cui arrivano dal database non conta', () => {
  const vecchio = fatto('aggiunto', 60_000);
  const nuovo = fatto('aggiunto', 300_000);
  const c = copertura([nuovo, vecchio], [ricevuta('aggiunto', 0)]);   // di proposito al contrario
  assert.equal(c.coperti[0].fatto.id, vecchio.id, 'la ricevuta va al fatto più vecchio');
});

// ── Il caso che decide se questo modulo cura o rompe ────────────────────────────────────
test('⭐ entra dal bot e poi la SEGRETERIA lo toglie: il tolto arriva', () => {
  // Se si scartasse DOPO la riduzione, i due gesti si sarebbero fusi in un netto nullo e la
  // persona non saprebbe di essere stata tolta. Qui restano separati, e resta il `tolto`.
  const c = copertura(
    [fatto('aggiunto', 90_000), fatto('tolto', 400_000)],
    [ricevuta('aggiunto', 0)],
  );
  assert.equal(c.coperti.length, 1);
  assert.equal(c.daConsegnare.length, 1);
  assert.equal(c.daConsegnare[0].gesto, 'tolto');
});

// ── I versi prudenti ────────────────────────────────────────────────────────────────────
test('un istante illeggibile consegna, non tace', () => {
  const f = { ...fatto('aggiunto', 0), visto_at: 'non-una-data' };
  assert.equal(copertura([f], [ricevuta('aggiunto', 0)]).daConsegnare.length, 1);
  const r = { ...ricevuta('aggiunto', 0), scritta_at: 'boh' };
  assert.equal(copertura([fatto('aggiunto', 60_000)], [r]).daConsegnare.length, 1);
});

test('nessuna ricevuta: tutto passa, e non si rompe niente', () => {
  const f = [fatto('aggiunto', 0), fatto('tolto', 0), fatto('annullata', 0)];
  assert.equal(copertura(f, []).daConsegnare.length, 3);
});

test('la chiave normalizza tutti e cinque i pezzi', () => {
  assert.equal(
    chiaveGesto('2026-08-31', '11:00:00', 'Campo 1', ' Lidia  Comes ', 'aggiunto'),
    chiaveGesto('2026-08-31', '11:00', '1', 'lidia comes', 'aggiunto'),
  );
});

// ── L'ORDINE FRA COPERTURA E RIDUZIONE, provato invertendolo ────────────────────────────
// 🚨 Questo caso non prova un calcolo: prova una DECISIONE DI ORDINE, che è il genere di cosa
// che qualcuno inverte fra sei mesi «per pulizia» senza che nessun altro caso se ne accorga.
// ⇒ Perciò gira tutte e due le strade e mostra cosa si perde nella sbagliata.
test('⭐⭐ prima la copertura, POI la riduzione: al contrario si perde un TOLTO vero', () => {
  const mioIngresso = fatto('aggiunto', 90_000);          // l'ha fatto lui, dal bot
  const toltoDalCircolo = fatto('tolto', 400_000);        // questo no
  const ric = [ricevuta('aggiunto', 0)];
  const ADESSO = Date.parse(toltoDalCircolo.visto_at) + 10 * 60 * 1000;

  // La strada giusta: si scarta il suo gesto, resta quello del circolo.
  const giusta = riduci(copertura([mioIngresso, toltoDalCircolo], ric).daConsegnare, ADESSO);
  assert.equal(giusta.length, 1);
  assert.equal(giusta[0].gesto, 'tolto', 'deve sapere che la segreteria l\'ha tolto');

  // La strada sbagliata: i due gesti si fondono PRIMA, il netto è nullo, e la copertura
  // arriva su un esito che non è più né l\'uno né l\'altro.
  const ridottoPrima = riduci([mioIngresso, toltoDalCircolo], ADESSO);
  assert.equal(ridottoPrima.length, 1);
  assert.equal(
    ridottoPrima[0].gesto,
    null,
    'ecco cosa si perderebbe: entra e viene tolto = «non è successo niente», e il tolto non si dice',
  );
});

test('e se il circolo NON tocca niente, dopo un ingresso dal bot non si dice nulla', () => {
  const solo = fatto('aggiunto', 90_000);
  const ADESSO = Date.parse(solo.visto_at) + 10 * 60 * 1000;
  const esiti = riduci(copertura([solo], [ricevuta('aggiunto', 0)]).daConsegnare, ADESSO);
  assert.equal(esiti.length, 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
