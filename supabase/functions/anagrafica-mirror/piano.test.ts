import { assertEquals, assertNotEquals } from 'jsr:@std/assert@1';
import {
  calcolaPiano,
  payloadPerTest,
  type SchedaLocale,
  type SocioDaProd,
  sorgenteAffidabile,
} from './piano.ts';

const prod = (chiave: string): SocioDaProd => ({
  local_key: chiave,
  payload: { name: 'Tizio', phone: chiave.replace('phone:', '') },
});
const test = (chiave: string, id = 'id-' + chiave, deleted = false): SchedaLocale => ({
  local_key: chiave,
  id,
  deleted,
});

// ── Che cosa fa lo specchio ────────────────────────────────────────────────

Deno.test('i tre esiti: si aggiorna chi c\'è, si aggiunge chi manca, si toglie chi avanza', () => {
  const piano = calcolaPiano(
    [prod('phone:1'), prod('phone:2'), prod('phone:3')],
    [test('phone:2'), test('phone:3'), test('phone:99')],
  );
  assertEquals(piano.aggiornati, ['phone:2', 'phone:3']);
  assertEquals(piano.aggiunti, ['phone:1']);
  assertEquals(piano.cancellati, ['phone:99']);
});

Deno.test('IL CASO VERO misurato il 3/08: 49 solo su TEST, 3 solo su PROD', () => {
  // I numeri della misura di stasera. Se un domani lo specchio smettesse di
  // cancellare, questo caso lo direbbe con i numeri veri e non con un esempio.
  const comuni = Array.from({ length: 2769 }, (_, i) => `phone:c${i}`);
  const soloProd = ['phone:3479113006', 'phone:3401112233', 'phone:3889216485'];
  const soloTest = Array.from({ length: 49 }, (_, i) => `phone:t${i}`);

  const piano = calcolaPiano(
    [...comuni, ...soloProd].map(prod),
    [...comuni, ...soloTest].map((k) => test(k)),
  );

  assertEquals(piano.aggiornati.length, 2769);
  assertEquals(piano.aggiunti.length, 3);
  assertEquals(piano.cancellati.length, 49);
  // E il conto deve chiudere come ha chiuso nella misura: 49 − 3 = 46.
  assertEquals(piano.cancellati.length - piano.aggiunti.length, 46);
});

Deno.test('una scheda cancellata su TEST che su PROD c\'è TORNA IN VITA (e non è un doppione)', () => {
  const piano = calcolaPiano([prod('phone:7')], [test('phone:7', 'id-vecchio', true)]);
  assertEquals(piano.aggiornati, ['phone:7']);
  assertEquals(piano.aggiunti, []);
  // 🚨 Il punto: NON deve finire fra gli aggiunti, o si creerebbe una seconda
  // riga per la stessa persona — che è esattamente come nascono i doppioni.
  assertEquals(piano.cancellati, []);
});

Deno.test('chi era già cancellato su TEST e su PROD non c\'è NON viene ricancellato', () => {
  const piano = calcolaPiano([], [test('phone:8', 'id-8', true)]);
  assertEquals(piano.cancellati, []);
});

Deno.test('lo specchio prende anche le schede agganciate a EMAIL e ID, non solo al telefono', () => {
  // Misurato il 3/08: nel cloud la chiave non è sempre il telefono (PROD 2792
  // vive contro 2772 con `phone:`). Agganciando per telefono queste sarebbero
  // rimaste fuori — e, peggio, sarebbero finite fra le cancellate.
  const piano = calcolaPiano(
    [prod('email:tizio@example.com'), prod('id:8ee6ad2043')],
    [test('email:tizio@example.com')],
  );
  assertEquals(piano.aggiornati, ['email:tizio@example.com']);
  assertEquals(piano.aggiunti, ['id:8ee6ad2043']);
  assertEquals(piano.cancellati, []);
});

// ── Il numero di scheda: la regola che tiene in piedi TEST ──────────────────

Deno.test('chi esiste già SI TIENE il numero di scheda di TEST', () => {
  const risultato = payloadPerTest(
    { name: 'Mario Rossi', email: 'mario@example.com' },
    'numero-di-TEST',
    () => 'MAI-USATO',
  );
  assertEquals(risultato.id, 'numero-di-TEST');
  assertEquals(risultato.name, 'Mario Rossi');
});

Deno.test('chi arriva nuovo prende un numero NUOVO, nato su TEST', () => {
  const risultato = payloadPerTest({ name: 'Nuovo Socio' }, '', () => 'numero-nuovo');
  assertEquals(risultato.id, 'numero-nuovo');
});

Deno.test('🚨 se il numero di PROD arrivasse lo stesso, NON deve vincere', () => {
  // Difesa in profondità: il ponte `anagrafica-export` il numero non lo manda,
  // ma se un domani qualcuno lo rimettesse là dentro, questo caso diventerebbe
  // rosso invece di lasciar passare in silenzio ~2800 numeri di scheda riscritti.
  const risultato = payloadPerTest(
    { name: 'Mario Rossi', id: 'numero-di-PROD' },
    'numero-di-TEST',
    () => 'MAI-USATO',
  );
  assertEquals(risultato.id, 'numero-di-TEST');
  assertNotEquals(risultato.id, 'numero-di-PROD');
});

Deno.test('e chi arriva nuovo non si prende comunque il numero di PROD', () => {
  const risultato = payloadPerTest({ id: 'numero-di-PROD' }, '', () => 'numero-nuovo');
  assertEquals(risultato.id, 'numero-nuovo');
});

// ── La guardia che impedisce di svuotare TEST ───────────────────────────────

Deno.test('sorgente piena: si procede', () => {
  assertEquals(sorgenteAffidabile(2792, 2834, 0.9), true);
});

Deno.test('🚨 sorgente VUOTA con TEST piena: NON si tocca niente', () => {
  // Il caso catastrofico: l'export risponde «ok» con zero soci e lo specchio,
  // preso alla lettera, cancellerebbe l'intera anagrafica di TEST dichiarando
  // successo. Senza questa guardia il difetto sarebbe invisibile fino al giorno
  // dopo, quando allo sportello non si trova più nessuno.
  assertEquals(sorgenteAffidabile(0, 2834, 0.9), false);
});

Deno.test('sorgente monca (metà dei soci): NON si tocca niente', () => {
  assertEquals(sorgenteAffidabile(1400, 2834, 0.9), false);
});

Deno.test('appena sopra e appena sotto la quota: la soglia è dove diciamo che sia', () => {
  assertEquals(sorgenteAffidabile(90, 100, 0.9), true);
  assertEquals(sorgenteAffidabile(89, 100, 0.9), false);
});

Deno.test('TEST vuota: la guardia non blocca la prima passata', () => {
  // Senza questo, il primo popolamento di un ambiente nuovo sarebbe impossibile:
  // la guardia dividerebbe per zero soci e non lascerebbe passare niente.
  assertEquals(sorgenteAffidabile(2792, 0, 0.9), true);
});
