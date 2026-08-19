// Le due numerazioni di Matchpoint non si scambiano — test deterministici, nessuna dipendenza.
// Esegui:  node supabase/functions/consumer-booking-write/giocatore-da-aggiungere.test.ts
//
// ⭐ I numeri dei casi NON sono inventati: sono le coppie lette sul log del worker di PROD il
// 19/08/2026, dove la stessa persona compare con tutt'e due —
//   «001013-Lidia Ciao Comes» → id 1034 · «000004-Maurizio Aprea» → id 4
//   «000005-Pierangela Barbera» → id 10 · «000213-Milena Rigolo» → id 223
// È la coppia 1013/1034 che ha prodotto il rifiuto di ieri sera, e questo file esiste perché
// non torni.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { giocatoreDaAggiungere, idInternoValido } from './giocatore-da-aggiungere.ts';

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

const cartella = dirname(fileURLToPath(import.meta.url));

// ── Il difetto del 19/08, in un caso ───────────────────────────────────────────────────────

test('🚨 IL DIFETTO DI IERI: il codice cliente NON esce mai come `codice`', () => {
  // Lidia non ha id interno nel gestionale (misurato: 60 schede su 2802 ce l'hanno).
  const g = giocatoreDaAggiungere({ nome: 'Lidia Comes', codiceCliente: '001013' });
  assert.equal(g.codiceCliente, '001013');
  // 🚨 È QUESTA la riga del difetto: con `codice: '001013'` il worker confronta 1013 con
  // l'id interno 1034 e rifiuta — «Nessun socio Matchpoint con codice 001013».
  assert.equal(g.codice, undefined, 'il codice cliente è finito nel campo dell’id interno');
});

test('🚨 i due numeri della stessa persona non si scambiano', () => {
  // La coppia vera di Lidia: cliente 001013, id interno 1034.
  const g = giocatoreDaAggiungere({ nome: 'Lidia Comes', codiceCliente: '001013', idInterno: '1034' });
  assert.equal(g.codiceCliente, '001013');
  assert.equal(g.codice, '1034');
});

test('l’id interno, quando c’è, viaggia come `codice`', () => {
  const g = giocatoreDaAggiungere({ nome: 'Maurizio Aprea', codiceCliente: '000004', idInterno: '4' });
  assert.deepEqual(g, { nome: 'Maurizio Aprea', codice: '4', codiceCliente: '000004' });
});

test('senza id interno il campo NON compare (non una stringa vuota)', () => {
  // ⚖️ Per il worker vuoto e assente sono la stessa cosa — guardia spenta — ma solo l'assenza
  // lo dice a chi guarda il payload nel log, che è il posto da cui questo difetto si è visto.
  const g = giocatoreDaAggiungere({ nome: 'Milena Rigolo', codiceCliente: '000213', idInterno: '' });
  assert.ok(!('codice' in g), 'un campo vuoto dice «guardia accesa» a chi legge il payload');
  assert.equal(g.codiceCliente, '000213');
});

test('un id interno storto si SCARTA invece di mandarlo', () => {
  // 🚨 Un id inventato riaprirebbe il confronto sbagliato: meglio guardia spenta che guardia
  // che confronta due numeri di due mondi diversi.
  for (const storto of ['PMO-000004', '4a', '  ', 'null', '1234567890123']) {
    const g = giocatoreDaAggiungere({ nome: 'X', codiceCliente: '000213', idInterno: storto });
    assert.ok(!('codice' in g), `«${storto}» è finito nel payload come id interno`);
  }
  assert.equal(idInternoValido(undefined), '');
  assert.equal(idInternoValido(4), '4', 'un numero vero va accettato anche se arriva non stringa');
});

test('il nome è quello sulla scheda del circolo, e resta intatto', () => {
  const g = giocatoreDaAggiungere({ nome: 'Lidia Ciao Comes', codiceCliente: '001013' });
  assert.equal(g.nome, 'Lidia Ciao Comes');
});

// ── Il CABLAGGIO: che la funzione venga davvero usata ──────────────────────────────────────

test('🔗 il ramo `add` compone il giocatore CON questa funzione', () => {
  // 🚨 La regola non è mai stata sbagliata: non la chiamava nessuno. Perciò qui si guarda il
  // collegamento, che è la cosa che si era rotta — e lo si guarda su ciò che il worker RICEVE.
  const src = readFileSync(join(cartella, 'index.ts'), 'utf8');
  assert.match(src, /from '\.\/giocatore-da-aggiungere\.ts'/, 'manca l’import del modulo');
  // ⭐ Ancorata a inizio riga come le guardie della voce 61: un `if` davanti sposta la riga, e
  // una regex che cerca la parola dovunque proverebbe che la parola c'è, non che il codice
  // succeda.
  assert.match(src, /^\s*add: \[giocatoreDaAggiungere\(/m, 'il payload dell’add non passa dalla funzione');
  // 🚨 E il difetto vecchio non deve poter tornare a mano dentro il corpo della richiesta: il
  // codice cliente non è più un valore di `codice:` in nessun punto del file.
  const comeCodice = src.match(/^\s*codice: codiceDaAggiungere/gm) ?? [];
  assert.equal(comeCodice.length, 0, `il codice cliente esce ancora come «codice» in ${comeCodice.length} punti`);
});

console.log(`\n${passed} passati, ${failed} falliti`);
if (failed > 0) process.exitCode = 1;
