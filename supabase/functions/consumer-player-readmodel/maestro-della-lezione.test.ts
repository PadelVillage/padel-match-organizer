// 🎭 VOCE 205 — chi tiene la lezione. Test deterministici, nessuna dipendenza esterna.
// Esegui:  node supabase/functions/consumer-player-readmodel/maestro-della-lezione.test.ts
//
// ⭐ I casi NON sono inventati: sono i tre maestri veri di `cudi` e i roster veri delle lezioni
// misurate il 10/09/2026. In particolare i tre casi che hanno deciso la forma della cura:
//   · `Spinazze` → `Gianluca Spinazzè`  — il codice non è il nome (senza tabella non si lega);
//   · `-lucas vidal.`                    — lo stesso maestro scritto tutto minuscolo nel roster;
//   · `LoZio` letto DAL COMMITTENTE      — il socio che legge È il maestro (18 lezioni su 93).
import assert from 'node:assert/strict';
import { normName } from './compagni-slot.ts';
import {
  allieviSenzaIlMaestro,
  ilMaestroSonoIo,
  nomeDelMaestro,
  type Maestro,
} from './maestro-della-lezione.ts';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`ok   - ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`FAIL - ${name}`);
    console.log(`       ${(e as Error).message.split('\n')[0]}`);
  }
}

const varianti = (...nomi: string[]) => new Set(nomi.map(normName));

/** Il seme vero di `pmo_maestri`, misurato il 10/09/2026. */
const MAESTRI: Maestro[] = [
  { codice: 'LoZio', nome: 'Maurizio Aprea' },
  { codice: 'Spinazze', nome: 'Gianluca Spinazzè' },
  { codice: 'Lucas Vidal', nome: 'Lucas Vidal' },
];

// ── ① Dal codice alla persona ──────────────────────────────────────────────

test('1. il codice diventa la PERSONA: Spinazze → Gianluca Spinazzè', () => {
  assert.equal(nomeDelMaestro('Spinazze', MAESTRI), 'Gianluca Spinazzè');
});

test('2. codice e nome che coincidono restano quello che sono', () => {
  assert.equal(nomeDelMaestro('Lucas Vidal', MAESTRI), 'Lucas Vidal');
});

test('3. il codice si riconosce anche scritto storto (maiuscole, accenti, spazi)', () => {
  assert.equal(nomeDelMaestro('  lozio ', MAESTRI), 'Maurizio Aprea');
  assert.equal(nomeDelMaestro('LUCAS VIDAL', MAESTRI), 'Lucas Vidal');
});

test('4. un maestro NUOVO, non ancora in tabella, dà null — non il codice grezzo', () => {
  // 🚨 Il caso che tiene onesta tutta la catena: `null` fa lasciare la frase com'era.
  // Tornare 'Santiago' farebbe leggere al socio un nome che in tabella nessuno ha messo.
  assert.equal(nomeDelMaestro('Santiago', MAESTRI), null);
});

test('5. nessun maestro dichiarato (partita, o lezione senza istruttore) → null', () => {
  assert.equal(nomeDelMaestro(null, MAESTRI), null);
  assert.equal(nomeDelMaestro('', MAESTRI), null);
  assert.equal(nomeDelMaestro('   ', MAESTRI), null);
  assert.equal(nomeDelMaestro('LoZio', []), null);
});

test('6. una riga di tabella col nome vuoto vale come «non lo so», non come stringa vuota', () => {
  // Senza questo ramo a valle uscirebbe «Lezione con » — una frase troncata a metà.
  assert.equal(nomeDelMaestro('X', [{ codice: 'X', nome: '  ' }]), null);
});

// ── ② Il socio è il maestro ────────────────────────────────────────────────

test('7. il committente legge una SUA lezione: il maestro è lui', () => {
  // ⚠️ È il caso che una cura ingenua rompe, e vale 18 lezioni su 93: senza questo ramo il bot
  // gli direbbe «Lezione con Maurizio Aprea», cioè che prende lezione da sé stesso.
  assert.equal(ilMaestroSonoIo('Maurizio Aprea', varianti('Maurizio Aprea', 'Aprea Maurizio')), true);
});

test('8. un allievo della stessa lezione NON è il maestro', () => {
  assert.equal(ilMaestroSonoIo('Maurizio Aprea', varianti('Renza Lazzarin')), false);
});

test('9. senza maestro noto, nessuno è il maestro', () => {
  assert.equal(ilMaestroSonoIo(null, varianti('Maurizio Aprea')), false);
});

test('10. il riconoscimento passa dagli accenti: Spinazzè ↔ Spinazze', () => {
  assert.equal(ilMaestroSonoIo('Gianluca Spinazzè', varianti('Gianluca Spinazze')), true);
});

// ── ③ Gli allievi = i compagni meno il maestro ─────────────────────────────

test('11. il maestro esce dall\'elenco degli allievi', () => {
  // Caso vero: 29/09 13:00 C1, roster [Lucas Vidal, christian micheletto, Andrea Scaggiante],
  // letto da christian ⇒ compagni = [Lucas Vidal, Andrea Scaggiante].
  assert.deepEqual(
    allieviSenzaIlMaestro(['Lucas Vidal', 'Andrea Scaggiante'], 'Lucas Vidal'),
    ['Andrea Scaggiante'],
  );
});

test('12. il maestro esce anche scritto tutto minuscolo nel roster', () => {
  // Caso vero: 28/09 18:00 C1, descrizione «-lucas vidal.-Andrea Bigaran.».
  assert.deepEqual(
    allieviSenzaIlMaestro(['lucas vidal', 'Andrea Bigaran'], 'Lucas Vidal'),
    ['Andrea Bigaran'],
  );
});

test('13. il maestro esce anche quando il roster porta l\'accento e la tabella no', () => {
  assert.deepEqual(
    allieviSenzaIlMaestro(['Gianluca Spinazzè', 'Paola Tamagnone'], 'Gianluca Spinazzè'),
    ['Paola Tamagnone'],
  );
});

test('14. lezione a due: tolto il maestro non resta nessun allievo', () => {
  // Caso vero: 26/09 10:30 C3 letta da Paola ⇒ compagni = [Maurizio Aprea] = il maestro.
  assert.deepEqual(allieviSenzaIlMaestro(['Maurizio Aprea'], 'Maurizio Aprea'), []);
});

test('15. lo stesso maestro arrivato DUE volte da due fonti esce tutte e due le volte', () => {
  // 🚨 `.filter` e non «togli il primo»: la scheda del circolo e l'array `giocatori` sono due
  // fonti dello stesso slot, e lo stesso nome scritto in due modi le attraversa come due persone.
  assert.deepEqual(
    allieviSenzaIlMaestro(['Lucas Vidal', 'Andrea Bigaran', 'lucas vidal'], 'Lucas Vidal'),
    ['Andrea Bigaran'],
  );
});

test('16. maestro sconosciuto ⇒ i compagni restano TALI E QUALI', () => {
  // ⚖️ Il ramo che impedisce il peggioramento: non sapendo chi è il maestro non si toglie
  // niente, e la frase a valle resta quella di oggi.
  const compagni = ['Renza Lazzarin', 'Paola Tamagnone'];
  assert.deepEqual(allieviSenzaIlMaestro(compagni, null), compagni);
});

test('17. il maestro NON in campo (lezione nativa) non toglie nessun allievo', () => {
  // Su una lezione nata da noi `istruttore` e i giocatori sono due campi separati: il maestro
  // c'è, ma non fra i compagni. Nessuno deve sparire per sbaglio.
  assert.deepEqual(
    allieviSenzaIlMaestro(['Marco Aprea', 'Renza Lazzarin'], 'Gianluca Spinazzè'),
    ['Marco Aprea', 'Renza Lazzarin'],
  );
});

test('18. l\'elenco di partenza non viene modificato sul posto', () => {
  // `compagni` è letto da mezza dozzina di punti del bot: mutarlo qui li cambierebbe tutti.
  const compagni = ['Lucas Vidal', 'Andrea Bigaran'];
  allieviSenzaIlMaestro(compagni, 'Lucas Vidal');
  assert.deepEqual(compagni, ['Lucas Vidal', 'Andrea Bigaran']);
  assert.deepEqual(allieviSenzaIlMaestro(compagni, null), compagni);
  assert.notEqual(allieviSenzaIlMaestro(compagni, null), compagni);
});

console.log(`\n${passed} passati, ${failed} falliti`);
if (failed) process.exit(1);
