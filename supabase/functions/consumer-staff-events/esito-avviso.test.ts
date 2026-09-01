// Il PERCHÉ di una riga chiusa (voce 68) — test deterministici, nessuna rete.
// Esegui:  node supabase/functions/consumer-staff-events/esito-avviso.test.ts
//
// ⭐ IL CASO 4 È QUELLO CHE PROTEGGE LA DECISIONE e non un calcolo: dice che `consegnato_at`
// e `esito` rispondono a due domande diverse, e che la prima non si può dedurre dalla seconda
// né viceversa. È l'intera ragione per cui la colonna esiste.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ESITO, ESITI, eArrivatoAlSocio } from './esito-avviso.ts';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed += 1; console.log(`ok   - ${name}`); }
  catch (e) { failed += 1; console.log(`FAIL - ${name}`); console.log(`       ${(e as Error).message.split('\n')[0]}`); }
}

test('1. i quattro esiti sono quattro, distinti, e in minuscolo', () => {
  assert.equal(ESITI.length, 4);
  assert.equal(new Set(ESITI).size, 4);
  for (const e of ESITI) assert.match(e, /^[a-z_]+$/);
});

test('2. solo «consegnato» vuol dire che il socio lo saprà', () => {
  assert.equal(eArrivatoAlSocio(ESITO.CONSEGNATO), true);
  for (const e of [ESITO.NON_RICONOSCIUTO, ESITO.NETTO_NULLO, ESITO.CORSA_PERSA]) {
    assert.equal(eArrivatoAlSocio(e), false, `«${e}» non è un avviso arrivato`);
  }
});

test('3. ⚠️ un esito ASSENTE è «non misurato», e vale falso — non «consegnato»', () => {
  // 🚨 Le 605 righe chiuse prima del 01/09 hanno `esito` a NULL. Farle valere «consegnato»
  // sarebbe inventare un esito che nessuno ha osservato: esattamente il difetto che questa
  // colonna esiste per togliere.
  for (const niente of [null, undefined, '', '   ', 'boh']) {
    assert.equal(eArrivatoAlSocio(niente), false, `«${String(niente)}»`);
  }
});

test('4. ⭐⭐ le due colonne rispondono a DUE domande, e il codice le tiene separate', () => {
  const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.ok(src.length > 5000, 'sorgente non letto: questa prova non direbbe niente');
  // 🚨 La CHIUSURA resta quella atomica del 24/08 — `consegnato_at` più la pretesa che la
  // riga sia ancora libera. È la protezione contro il doppio invio, e l'esito non la tocca.
  assert.match(src, /\.update\(\{ consegnato_at: new Date\(\)\.toISOString\(\) \}\)[\s\S]{0,200}\.is\('consegnato_at', null\)/,
    'la chiusura atomica non pretende più che la riga sia libera: la protezione del 24/08 è saltata');
  // 🚨 E l'esito si scrive DOPO, su righe già nostre, quindi NON deve pretendere quel vincolo:
  // se lo pretendesse non scriverebbe mai niente (`consegnato_at` l'abbiamo appena messo noi).
  const ramoEsito = src.match(/\.update\(\{ esito \}\)[\s\S]{0,120}/);
  assert.ok(ramoEsito, "l'esito non si scrive: la colonna resta muta");
  assert.ok(!/\.is\('consegnato_at', null\)/.test(ramoEsito![0]),
    "l'esito pretende una riga libera: non ne scriverebbe mai nessuno");
});

test('5. ⛔ un errore sull\'esito non ferma la consegna', () => {
  // ⚖️ È diagnostica: far cadere un avviso vero per una riga di contabilità sarebbe il verso
  // sbagliato — lo stesso già scelto per la ricevuta della voce 70.
  const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  const ramo = src.match(/if \(esitoErr\) \{[\s\S]{0,400}?\n      \}/);
  assert.ok(ramo, 'il ramo d\'errore dell\'esito non si trova');
  assert.ok(!/return err\(/.test(ramo![0]), "un esito non scritto fa fallire la risposta: la diagnostica è diventata un cancello");
});

test('6. i quattro nomi stanno in UN posto: il codice non se li riscrive a mano', () => {
  const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  const senzaCommenti = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const valore of ESITI) {
    assert.ok(!senzaCommenti.includes(`'${valore}'`),
      `«${valore}» è scritto a mano in index.ts invece di venire da ESITO: due copie divergono`);
  }
  assert.match(src, /from '\.\/esito-avviso\.ts'/, "index.ts non importa il modulo degli esiti");
});

console.log(`\n${passed} verdi · ${failed} rossi`);
if (failed > 0) process.exit(1);
