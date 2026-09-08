// 💶 L'importo a carico che nasce dal listino — voce 180. Prove deterministiche, nessuna rete.
// Esegui:  node --experimental-strip-types supabase/functions/matchpoint-bookings-create/importo-dal-listino.test.ts
//
// ⭐ I dati NON sono inventati: le fasce sono quelle vere della griglia base misurate su `cudi`
// l'08/09/2026 (lunedì: 12:30 → 10,00 · 16:30 → 8,00 · 18:00 → 12,00 · 19:30 → 13,00), e la forma
// con `HH:MM` è quella che rende `pmo_calendario_effettivo`.
//
// ⚖️ In fondo ci sono i SABOTAGGI: si rompe una riga della cura per volta e si pretende che il
// banco diventi rosso. Un banco che non cade quando si rompe ciò che difende non difende niente.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importiDalListino, prezzoDellaFascia, quantiConImporto } from './importo-dal-listino.ts';

const QUI = dirname(fileURLToPath(import.meta.url));
const SORGENTE = join(QUI, 'importo-dal-listino.ts');
const TANA = mkdtempSync(join(tmpdir(), 'importo-listino-'));

let passed = 0, failed = 0;
function prova(nome: string, corpo: () => void) {
  try { corpo(); passed += 1; console.log(`ok   - ${nome}`); }
  catch (e) { failed += 1; console.error(`FAIL - ${nome}\n       ${(e as Error).message}`); }
}

const LUNEDI = [
  { ora_inizio: '12:30', ora_fine: '14:00', prezzo_cents: 1000 },
  { ora_inizio: '16:30', ora_fine: '18:00', prezzo_cents: 800 },
  { ora_inizio: '18:00', ora_fine: '19:30', prezzo_cents: 1200 },
  { ora_inizio: '19:30', ora_fine: '21:00', prezzo_cents: 1300 },
];
const QUANDO = '2026-09-08T20:30:00.000Z';

// ── il prezzo ───────────────────────────────────────────────────────────────────
prova('la fascia si trova per ora d\'inizio', () => {
  assert.equal(prezzoDellaFascia(LUNEDI, '18:00'), 1200);
  assert.equal(prezzoDellaFascia(LUNEDI, '19:30'), 1300);
});

prova('PostgREST rende HH:MM:SS e non deve ingannare', () => {
  assert.equal(prezzoDellaFascia([{ ora_inizio: '18:00:00', prezzo_cents: 1200 }], '18:00'), 1200);
  assert.equal(prezzoDellaFascia(LUNEDI, '18:00:00'), 1200);
});

prova('un\'ora FUORI dalla griglia non prende un prezzo a caso', () => {
  // 🚨 18:45 cade DENTRO la fascia 18:00-19:30, e proprio per questo non deve prenderne il prezzo:
  // una prenotazione che comincia a metà fascia non è quella fascia.
  assert.equal(prezzoDellaFascia(LUNEDI, '18:45'), null);
  assert.equal(prezzoDellaFascia(LUNEDI, '07:00'), null);
});

prova('prezzo non deciso ⇒ null, che NON è zero', () => {
  assert.equal(prezzoDellaFascia([{ ora_inizio: '18:00', prezzo_cents: null }], '18:00'), null);
  assert.equal(prezzoDellaFascia([{ ora_inizio: '18:00' }], '18:00'), null);
});

prova('zero è un prezzo legittimo («gratis»), e passa', () => {
  assert.equal(prezzoDellaFascia([{ ora_inizio: '18:00', prezzo_cents: 0 }], '18:00'), 0);
});

prova('niente fasce, ore storte, robaccia ⇒ null senza esplodere', () => {
  assert.equal(prezzoDellaFascia([], '18:00'), null);
  assert.equal(prezzoDellaFascia(null, '18:00'), null);
  assert.equal(prezzoDellaFascia(LUNEDI, ''), null);
  assert.equal(prezzoDellaFascia(LUNEDI, '99:99'), null);
  assert.equal(prezzoDellaFascia([{ ora_inizio: '18:00', prezzo_cents: -5 }], '18:00'), null);
});

// ── gli importi ─────────────────────────────────────────────────────────────────
prova('ogni giocatore prende il prezzo, e il pendente nasce uguale', () => {
  const out = importiDalListino([{ nome: 'Lidia' }, { nome: 'Fabiola' }], 1200, QUANDO);
  assert.equal(out.length, 2);
  for (const g of out) {
    assert.equal(g.importoCents, 1200);
    assert.equal(g.pendenteCents, 1200, 'nessuno ha ancora pagato: pendente = importo');
    assert.equal(g.origineImporto, 'listino');
    assert.equal(g.importoAt, QUANDO);
  }
});

prova('🚨 NIENTE `lettoAt`: quel campo vuol dire «letto dal circolo»', () => {
  const out = importiDalListino([{ nome: 'Lidia' }], 1200, QUANDO);
  assert.ok(!('lettoAt' in out[0]), 'un importo nato qui non è stato letto da nessuna parte');
});

prova('🚨 prezzo NULL ⇒ non si scrive niente (non zero)', () => {
  const out = importiDalListino([{ nome: 'Lidia' }], null, QUANDO);
  assert.deepEqual(out, [{ nome: 'Lidia' }]);
  assert.ok(!('importoCents' in out[0]), 'un importo inventato è peggio di uno mancante');
});

prova('🚨 un importo GIÀ PRESENTE non si sovrascrive', () => {
  // può venire dal circolo (letto) o dalla segreteria (deciso): il listino è il valore di
  // partenza, non un'autorità che passa sopra a una decisione presa.
  const out = importiDalListino(
    [{ nome: 'Lidia', importoCents: 500, lettoAt: 'ieri' }, { nome: 'Fabiola' }], 1200, QUANDO,
  );
  assert.equal(out[0].importoCents, 500);
  assert.equal(out[0].lettoAt, 'ieri', 'la riga di prima resta intatta');
  assert.ok(!('origineImporto' in out[0]), 'e non si riscrive nemmeno la provenienza');
  assert.equal(out[1].importoCents, 1200);
});

prova('un pendente già presente resta quello', () => {
  const out = importiDalListino([{ nome: 'Lidia', pendenteCents: 0 }], 1200, QUANDO);
  assert.equal(out[0].importoCents, 1200);
  assert.equal(out[0].pendenteCents, 0, 'chi ha già pagato non torna a dovere');
});

prova('zero come prezzo si scrive davvero (gratis è una decisione)', () => {
  const out = importiDalListino([{ nome: 'Lidia' }], 0, QUANDO);
  assert.equal(out[0].importoCents, 0);
  assert.equal(out[0].pendenteCents, 0);
});

prova('l\'elenco ricevuto NON viene toccato', () => {
  const dentro = [{ nome: 'Lidia' }];
  importiDalListino(dentro, 1200, QUANDO);
  assert.deepEqual(dentro, [{ nome: 'Lidia' }], 'la funzione è pura: chi chiama non si trova la roba cambiata');
});

prova('elenco vuoto o assente ⇒ elenco vuoto, senza errori', () => {
  assert.deepEqual(importiDalListino([], 1200, QUANDO), []);
  assert.deepEqual(importiDalListino(null, 1200, QUANDO), []);
});

prova('quantiConImporto conta quelli che ce l\'hanno davvero', () => {
  assert.equal(quantiConImporto(importiDalListino([{ nome: 'A' }, { nome: 'B' }], 1200, QUANDO)), 2);
  assert.equal(quantiConImporto(importiDalListino([{ nome: 'A' }], null, QUANDO)), 0);
  assert.equal(quantiConImporto([{ nome: 'A', importoCents: '1200' }]), 0, 'una stringa non è un importo');
});

// ── i sabotaggi ─────────────────────────────────────────────────────────────────
function reggeAncora(M: Record<string, any>): boolean {
  try {
    if (M.prezzoDellaFascia(LUNEDI, '18:00') !== 1200) return false;
    if (M.prezzoDellaFascia(LUNEDI, '18:45') !== null) return false;
    if (M.prezzoDellaFascia([{ ora_inizio: '18:00', prezzo_cents: null }], '18:00') !== null) return false;
    const nulla = M.importiDalListino([{ nome: 'A' }], null, QUANDO);
    if ('importoCents' in nulla[0]) return false;
    const uno = M.importiDalListino([{ nome: 'A' }], 1200, QUANDO);
    if (uno[0].importoCents !== 1200 || uno[0].pendenteCents !== 1200) return false;
    if ('lettoAt' in uno[0]) return false;
    const gia = M.importiDalListino([{ nome: 'A', importoCents: 500 }], 1200, QUANDO);
    if (gia[0].importoCents !== 500) return false;
    return true;
  } catch { return false; }
}

let nSabotaggio = 0;
async function sabota(nome: string, cerca: string, sostituisci: string) {
  const testo = readFileSync(SORGENTE, 'utf8');
  // 🚨 Un sabotaggio che non trova il suo bersaglio passa verde senza aver guardato niente.
  if (!testo.includes(cerca)) {
    failed += 1;
    console.error(`FAIL - sabotaggio «${nome}»: la riga da rompere non esiste più nel sorgente`);
    return;
  }
  const via = join(TANA, `s${++nSabotaggio}.ts`);
  writeFileSync(via, testo.replace(cerca, sostituisci));
  const rotto = await import(`file://${via}`);
  if (reggeAncora(rotto as Record<string, any>)) {
    failed += 1;
    console.error(`FAIL - sabotaggio «${nome}»: ho rotto la cura e il banco è rimasto VERDE`);
  } else {
    passed += 1;
    console.log(`ok   - sabotaggio visto: ${nome}`);
  }
}

await sabota('il prezzo non deciso diventa zero',
  'if (prezzoCents === null || !Number.isFinite(prezzoCents) || prezzoCents < 0) {',
  'if (false) {');
await sabota('si sovrascrive un importo già presente',
  'if (typeof gia === \'number\' && Number.isFinite(gia)) return riga;',
  'if (false) return riga;');
await sabota('torna a scriversi `lettoAt`',
  'riga.importoAt = String(quando || \'\');',
  'riga.importoAt = String(quando || \'\'); riga.lettoAt = String(quando || \'\');');
await sabota('la fascia si cerca «dentro» invece che sull\'inizio',
  'if (oraPulita(f.ora_inizio) !== cercata) continue;',
  'if (oraPulita(f.ora_inizio) > cercata) continue;');
await sabota('il pendente nasce a zero invece che uguale all\'importo',
  'if (!(typeof pen === \'number\' && Number.isFinite(pen))) riga.pendenteCents = prezzoCents;',
  'if (!(typeof pen === \'number\' && Number.isFinite(pen))) riga.pendenteCents = 0;');

console.log(`\n${failed ? '🔴' : '🟢'} ${passed} verdi, ${failed} rosse — importo-dal-listino.ts (voce 180)`);
if (failed) process.exit(1);
