// Prove di `leggiImpaginato`. Girano su Node: importano solo `node:test` e `node:assert`.
//
// 🎯 Il caso che conta è il **2**: è quello che riproduce il difetto vero del 21/08/2026 —
// 2810 schede lette con una chiamata sola ne davano 1000, e il socio in posizione 2721 non
// esisteva per il ponte. Se un domani qualcuno rimettesse la lettura singola, quel caso
// diventa rosso.

import assert from 'node:assert';
import test from 'node:test';

import { leggiImpaginato } from './impaginazione.ts';

/** Un finto client che tronca a `pagina` righe per volta, come fa quello vero. */
function clientCon(totale: number, pagina: number, erroreA?: number) {
  const chiamate: Array<[number, number]> = [];
  const leggi = (from: number, to: number) => {
    chiamate.push([from, to]);
    if (erroreA !== undefined && from === erroreA) {
      return Promise.resolve({ righe: [] as number[], errore: 'DB_ERROR' });
    }
    const fine = Math.min(to + 1, totale);
    const righe: number[] = [];
    for (let i = from; i < fine; i++) righe.push(i);
    // 🚨 Il taglio è del CLIENT: anche chiedendo di più, non torna mai più di `pagina`.
    return Promise.resolve({ righe: righe.slice(0, pagina), errore: null });
  };
  return { leggi, chiamate };
}

test('1. anagrafica vuota ⇒ nessuna riga, nessun errore, una lettura sola', async () => {
  const c = clientCon(0, 1000);
  const r = await leggiImpaginato(c.leggi, { pagina: 1000, tetto: 30000 });
  assert.deepEqual(r, { righe: [], errore: null, troncato: false });
  assert.equal(c.chiamate.length, 1);
});

test('2. 2810 schede con pagine da 1000 ⇒ le legge TUTTE (il difetto del 21/08)', async () => {
  const c = clientCon(2810, 1000);
  const r = await leggiImpaginato(c.leggi, { pagina: 1000, tetto: 30000 });
  assert.equal(r.righe.length, 2810);
  assert.equal(r.errore, null);
  assert.equal(r.troncato, false);
  // Le due persone del collaudo vero: una dentro il primo taglio, una fuori.
  assert.ok(r.righe.includes(628), 'Maurizio Aprea, posizione 628');
  assert.ok(r.righe.includes(2721), 'Lidia Comes, posizione 2721 — quella che mancava');
  assert.equal(c.chiamate.length, 3);
});

test('3. un multiplo esatto della pagina ⇒ serve una lettura in più per saperlo finito', async () => {
  const c = clientCon(2000, 1000);
  const r = await leggiImpaginato(c.leggi, { pagina: 1000, tetto: 30000 });
  assert.equal(r.righe.length, 2000);
  assert.equal(r.troncato, false);
  // Due pagine piene non bastano a dire «è finita»: la terza torna vuota ed è quella che lo dice.
  assert.equal(c.chiamate.length, 3);
});

test('4. meno di una pagina ⇒ una lettura sola', async () => {
  const c = clientCon(42, 1000);
  const r = await leggiImpaginato(c.leggi, { pagina: 1000, tetto: 30000 });
  assert.equal(r.righe.length, 42);
  assert.equal(c.chiamate.length, 1);
});

test('5. un errore FERMA la lettura e si dichiara', async () => {
  const c = clientCon(5000, 1000, 1000);   // la seconda pagina fallisce
  const r = await leggiImpaginato(c.leggi, { pagina: 1000, tetto: 30000 });
  assert.equal(r.errore, 'DB_ERROR');
  assert.equal(r.righe.length, 1000);      // quelle raccolte prima, da NON usare
  assert.equal(c.chiamate.length, 2);      // non si insiste
});

test('6. il freno d\'emergenza morde e lo DICHIARA', async () => {
  const c = clientCon(100000, 1000);
  const r = await leggiImpaginato(c.leggi, { pagina: 1000, tetto: 3000 });
  assert.equal(r.troncato, true);
  assert.equal(r.errore, null);
  assert.equal(r.righe.length, 3000);
});

test('7. una pagina di zero non manda in giro infinito', async () => {
  const c = clientCon(10, 0);
  const r = await leggiImpaginato(c.leggi, { pagina: 0, tetto: 30000 });
  assert.equal(r.errore, 'PAGINA_NON_VALIDA');
  assert.equal(c.chiamate.length, 0);
});

// ⭐ Il metro che misura il metro: un caso che NON deve trovare niente di rotto. Se anche
// questo diventasse rosso, il problema è nella prova, non nel codice.
test('8. controllo negativo: leggere zero righe con tetto zero non inventa un errore', async () => {
  const c = clientCon(0, 1000);
  const r = await leggiImpaginato(c.leggi, { pagina: 1000, tetto: 0 });
  assert.equal(r.errore, null);
  assert.equal(r.righe.length, 0);
});
