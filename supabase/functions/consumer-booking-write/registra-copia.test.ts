// 🕰️ IL BANCO DELLA VOCE 121 — registrare prima di parlare.
// Esegui:  node supabase/functions/consumer-booking-write/registra-copia.test.ts
//
// ⛔ COSA NON PROVA, dichiarato: che `index.ts` la chiami, e che il socio legga la frase
// giusta. Il primo è sorvegliato testualmente in fondo a questo file; il secondo vuole una
// rimozione vera dal bot e non si fa da un banco.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registraConRitenta, ATTESE_MS } from './registra-copia.ts';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => unknown | Promise<unknown>) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed++; console.log(`  ✅ ${name}`); })
    .catch((e) => { failed++; console.log(`  ❌ ${name}\n     ${(e as Error).message}`); });
}

const senzaAttese = { attese: [0, 0, 0], aspetta: async () => {} };
const ok = () => [{ error: null }];
const ko = (m = 'boom') => [{ error: { message: m } }];

await test('al primo colpo: registrata, un tentativo solo', async () => {
  const r = await registraConRitenta(1, async () => ok(), senzaAttese);
  assert.equal(r.registrata, true);
  assert.equal(r.tentativi, 1);
  assert.equal(r.scritte, 1);
});

await test('niente da scrivere non si ritenta: registrata a zero giri', async () => {
  let chiamate = 0;
  const r = await registraConRitenta(0, async () => { chiamate++; return []; }, senzaAttese);
  assert.equal(r.registrata, true);
  assert.equal(r.tentativi, 0);
  assert.equal(chiamate, 0, 'non deve nemmeno provare a scrivere');
});

await test('fallisce due volte poi passa: registrata al terzo', async () => {
  let n = 0;
  const r = await registraConRitenta(1, async () => (++n < 3 ? ko() : ok()), senzaAttese);
  assert.equal(r.registrata, true);
  assert.equal(r.tentativi, 3);
});

await test('non ce la fa mai: NON registrata, e porta il motivo', async () => {
  const r = await registraConRitenta(1, async () => ko('permission denied'), senzaAttese);
  assert.equal(r.registrata, false);
  assert.equal(r.tentativi, 4, 'tre ritentativi più il primo giro');
  assert.equal(r.errore, 'permission denied');
});

await test("un'eccezione è un tentativo fallito, non un'uscita", async () => {
  let n = 0;
  const r = await registraConRitenta(1, async () => {
    if (++n < 3) throw new Error('rete caduta');
    return ok();
  }, senzaAttese);
  assert.equal(r.registrata, true, 'deve ritentare anche dopo un throw');
  assert.equal(r.tentativi, 3);
});

// 🚨 IL SABOTAGGIO CHE CONTA: due righe su tre scritte NON è un successo. Una copia a metà è
// discorde, e una copia discorde è ciò che rimette in campo chi ne è uscito.
await test('il PARZIALE non è registrato', async () => {
  const r = await registraConRitenta(3, async () => [{ error: null }, { error: null }, { error: { message: 'ko' } }], senzaAttese);
  assert.equal(r.registrata, false);
  assert.equal(r.scritte, 2);
  assert.equal(r.totali, 3);
});

// 🚨 E il secondo: meno esiti che righe da scrivere. Se la scrittura ne torna una sola su tre,
// «nessun errore» non vuol dire «tutte passate» — vuol dire che due non le ha nemmeno provate.
await test('meno esiti che righe non è registrato', async () => {
  const r = await registraConRitenta(3, async () => [{ error: null }], senzaAttese);
  assert.equal(r.registrata, false);
});

await test('le attese dichiarate governano il numero di giri', () => {
  assert.equal(ATTESE_MS.length, 3, 'tre ritentativi: se cambia, cambia anche il racconto nella scheda');
});

// ── Sorveglianza TESTUALE del cablaggio in index.ts ───────────────────────────
// ⚠️ È una prova testuale e si dichiara tale: dice che il ramo `remove` chiama la funzione e
// che non torna più `removed: true` a registrazione fallita. NON dice che funzioni.
const INDEX = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

await test('index.ts importa e chiama registraConRitenta', () => {
  assert.match(INDEX, /from '\.\/registra-copia\.ts'/, "manca l'import");
  assert.match(INDEX, /registraConRitenta\(/, 'nessuna chiamata');
});

await test('il ramo remove non promette «tolto» senza aver registrato', () => {
  assert.match(
    INDEX,
    /copiaRemove\.registrata/,
    'il ramo remove deve guardare l\'esito della registrazione prima di rispondere',
  );
});

console.log(`\n${passed} verdi, ${failed} rossi`);
if (failed) process.exit(1);
