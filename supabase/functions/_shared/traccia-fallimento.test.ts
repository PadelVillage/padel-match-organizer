// Guardia della voce 66: la traccia di un fallimento del circolo deve avere una casa ANCHE
// sulla strada sincrona — quella del bot dei soci.
// Esegui:  node supabase/functions/_shared/traccia-fallimento.test.ts
//
// ⚖️ PERCHÉ UNA GUARDIA SUL SORGENTE E NON UNA PROVA DEL MODULO. `annotaFallimentoAlCircolo` è
// I/O e nient'altro: una prova che la esercita proverebbe che `fetch` fa `fetch`. Quello che si
// può rompere davvero non è il modulo — è che qualcuno, ripulendo un ramo di errore fra sei mesi,
// tolga la CHIAMATA da uno dei tre `catch` e nessuno se ne accorga, perché togliendola non si
// rompe niente di visibile: le prenotazioni continuano a funzionare, e a mancare è solo ciò che
// si potrà leggere il giorno del prossimo guasto. ⇒ Il difetto da sorvegliare è un'ASSENZA, e le
// assenze si sorvegliano sul testo.
//
// 🚨 TARATURA MISURATA SABOTANDO, non prevista guardandola verde (23/08/2026):
//
//   sabotaggio                                              esito
//   ─────────────────────────────────────────────────       ──────────────────────────────
//   nessuno                                                 7 verdi
//   tolta la chiamata dal `catch` sincrono di create        ❌ «create: … non annota»
//   tolto l'import da edit (chiamata lasciata)              ❌ «edit: non importa il modulo»
//
// 📌 E il modo in cui i tre `catch` sincroni si riconoscono è un fatto, non una convenzione:
// sono gli UNICI che contengono un `return err(502,` — quelli asincroni non rispondono a
// nessuno (si arriva lì dopo aver già risposto) e chiudono il lavoro con `writeBookingJob`.
// Cercare «l'ultimo catch del file» sarebbe stato più corto e avrebbe smesso di guardare al
// primo riordino delle funzioni.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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

const functionsDir = dirname(dirname(fileURLToPath(import.meta.url)));
const CHIAMATA = 'annotaFallimentoAlCircolo(';
const IMPORT = "from '../_shared/traccia-fallimento.ts'";

/** I `catch` che RISPONDONO a chi ha chiesto: uno per ogni `return err(502,` del file. */
function catchSincroni(sorgente: string): string[] {
  const blocchi: string[] = [];
  let da = 0;
  for (;;) {
    const fine = sorgente.indexOf('return err(502,', da);
    if (fine === -1) break;
    const inizio = sorgente.lastIndexOf('catch (', fine);
    assert.notEqual(inizio, -1, 'un `return err(502,` fuori da qualunque catch');
    blocchi.push(sorgente.slice(inizio, fine));
    da = fine + 1;
  }
  return blocchi;
}

for (const funzione of ['create', 'edit', 'cancel']) {
  const percorso = join(functionsDir, `matchpoint-bookings-${funzione}`, 'index.ts');
  const sorgente = readFileSync(percorso, 'utf8');

  test(`${funzione}: ogni rifiuto della strada sincrona annota la traccia nel gestionale`, () => {
    const blocchi = catchSincroni(sorgente);
    assert.ok(blocchi.length > 0, `${funzione}: nessun \`return err(502,\` trovato — la strada sincrona è cambiata, e questa guardia non guarda più niente`);
    for (const [i, blocco] of blocchi.entries()) {
      assert.ok(
        blocco.includes(CHIAMATA),
        `${funzione}: il catch sincrono #${i + 1} risponde 502 e NON annota il fallimento.\n`
        + '      Senza quella riga la diagnostica del worker non resta da nessuna parte, e\n'
        + '      l\'unico posto dove leggerla torna a essere il registro sulla VM — che scorre.',
      );
    }
  });

  test(`${funzione}: importa il modulo condiviso`, () => {
    assert.ok(
      sorgente.includes(IMPORT),
      `${funzione}: manca l'import di ${IMPORT} — la chiamata non risolverebbe`,
    );
  });
}

// ⛔ CONTROLLO NEGATIVO. La regola qui sopra è «di là dal 502 si annota»; questa dice dove NON
// deve arrivare. Il testo intero dell'errore contiene i nomi interni (worker, Matchpoint, gli
// `steps=[…]`), e per la regola ferma di `CLAUDE.md` al bot non devono arrivare affatto: se un
// domani qualcuno «migliorasse» il modulo facendogli restituire la traccia perché il chiamante la
// rimandi indietro, questa prova diventerebbe rossa prima che ci arrivi un socio.
test('il modulo non restituisce la traccia a chi lo chiama (solo un booleano)', () => {
  const modulo = readFileSync(join(functionsDir, '_shared', 'traccia-fallimento.ts'), 'utf8');
  assert.ok(
    /\}\): Promise<boolean>/.test(modulo),
    'annotaFallimentoAlCircolo non torna più `Promise<boolean>`: se ora restituisce la traccia,\n'
    + '      il passo dopo è che qualcuno la rimandi al bot — che è la cosa vietata.',
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
