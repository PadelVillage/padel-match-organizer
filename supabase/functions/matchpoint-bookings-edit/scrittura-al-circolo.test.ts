// Il RECINTO delle scritture sul gestionale del circolo — test deterministici.
// Esegui:  node supabase/functions/matchpoint-bookings-edit/scrittura-al-circolo.test.ts
//
// 🚨⭐⭐ Questo banco misura TRE cose diverse, e la terza è quella che di solito manca:
//   ① la REGOLA è giusta (chi passa e chi no);
//   ② le TRE COPIE del modulo sono identiche — il deploy salta `_shared/`, quindi il modulo è
//      duplicato per forza e la deriva fra copie è il modo in cui questi fix si riaprono;
//   ③ 🚨 la regola è COLLEGATA: in tutte e tre le funzioni la chiamata sta PRIMA del punto di
//      non ritorno. Una guardia perfetta che nessuno chiama resta verde e non difende niente —
//      è la trappola più cara di questo progetto, e qui si misura la POSIZIONE, non la parola.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REF_PROD, scritturaAlCircoloConsentita } from './scrittura-al-circolo.ts';

const QUI = dirname(fileURLToPath(import.meta.url));
const FUNZIONI = join(QUI, '..');

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`ok   - ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL - ${name}\n       ${(e as Error).message}`);
  }
}

// ── ① la regola ────────────────────────────────────────────────────────────────────────────

test('1) l\'indirizzo VERO della produzione: si scrive', () => {
  // 🚨⭐⭐ L'indirizzo è scritto A MANO, non composto con `REF_PROD`, e la ragione è un difetto
  // trovato sabotando: cambiando il codice del progetto dentro il modulo, tutti i casi che lo
  // compongono si spostano INSIEME a lui e restano verdi — misurerebbero la coerenza del modulo
  // con sé stesso, non la verità. Un caso che segue ciò che deve giudicare non giudica niente.
  assert.equal(scritturaAlCircoloConsentita('https://qqbfphyslczzkxoncgex.supabase.co'), true);
  assert.equal(REF_PROD, 'qqbfphyslczzkxoncgex', 'il codice del progetto di produzione è cambiato');
});

test('2) 🚨 l\'indirizzo di TEST: NON si scrive', () => {
  assert.equal(scritturaAlCircoloConsentita('https://cudiqnrrlbyqryrtaprd.supabase.co'), false);
});

test('3) niente indirizzo (variabile mancante o vuota): NON si scrive', () => {
  // Il verso del dubbio: un ambiente che non sa dire chi è, non scrive.
  assert.equal(scritturaAlCircoloConsentita(''), false);
  assert.equal(scritturaAlCircoloConsentita(undefined), false);
  assert.equal(scritturaAlCircoloConsentita(null), false);
});

test('4) il solo codice del progetto, senza indirizzo: NON si scrive', () => {
  // Non è un URL: `new URL` fallisce e il rifiuto è la risposta giusta.
  assert.equal(scritturaAlCircoloConsentita(REF_PROD), false);
});

test('5) 🚨⭐⭐ un dominio che CONTIENE il codice di produzione: NON si scrive', () => {
  // È il caso per cui la regola guarda l'host e non la stringa: con un `includes` questo
  // sarebbe passato, e la guardia sarebbe rimasta verde difendendo niente.
  assert.equal(scritturaAlCircoloConsentita(`https://${REF_PROD}.supabase.co.qualcunaltro.it`), false);
  assert.equal(scritturaAlCircoloConsentita(`https://non-${REF_PROD}.supabase.co`), false);
});

test('6) un sottodominio dello STESSO progetto: si scrive', () => {
  assert.equal(scritturaAlCircoloConsentita(`https://${REF_PROD}.functions.supabase.co`), true);
});

test('7) maiuscole e spazi non cambiano la risposta', () => {
  assert.equal(scritturaAlCircoloConsentita(`  HTTPS://${REF_PROD.toUpperCase()}.SUPABASE.CO  `), true);
});

// ── ② le tre copie ─────────────────────────────────────────────────────────────────────────

const GEMELLI = [
  'matchpoint-bookings-create/scrittura-al-circolo.ts',
  'matchpoint-bookings-edit/scrittura-al-circolo.ts',
  'matchpoint-bookings-cancel/scrittura-al-circolo.ts',
];

test('8) ⚠️ le TRE copie del modulo sono identiche byte per byte', () => {
  // 🚨 `readFileSync` senza rete: un percorso sbagliato fa FALLIRE il caso, non passare.
  const testi = GEMELLI.map((rel) => readFileSync(join(FUNZIONI, rel), 'utf8'));
  assert.equal(testi.length, 3);
  assert.equal(testi[1], testi[0], 'edit diverge da create');
  assert.equal(testi[2], testi[0], 'cancel diverge da create');
});

// ── ③ il collegamento (la posizione, non la parola) ────────────────────────────────────────

/** Per ogni funzione: dov'è il punto oltre il quale il gestionale del circolo viene toccato. */
const PUNTI_DI_NON_RITORNO: Record<string, RegExp[]> = {
  'matchpoint-bookings-create/index.ts': [
    /await callWorkerCreateBooking\(/,
    // 🚨 La strada asincrona: risponde subito e prenota in sottofondo. È quella che non si vede
    // tornare indietro, ed è il motivo per cui il recinto sta prima del bivio.
    /waitUntil\(runBookingJobInBackground/,
  ],
  'matchpoint-bookings-edit/index.ts': [/await callWorkerEditBooking\(/],
  'matchpoint-bookings-cancel/index.ts': [/await callWorkerCancelBooking\(/],
};

for (const [rel, punti] of Object.entries(PUNTI_DI_NON_RITORNO)) {
  test(`9) 🚨 in ${rel.split('/')[0]} OGNI strada verso il gestionale passa dal recinto`, () => {
    const righe = readFileSync(join(FUNZIONI, rel), 'utf8').split('\n');
    assert.notEqual(
      righe.findIndex((r) => /from '\.\/scrittura-al-circolo\.ts'/.test(r)), -1,
      'il modulo non è nemmeno importato',
    );
    const guardie = righe
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => /scritturaAlCircoloConsentita\(/.test(r) && !/from '/.test(r))
      .map(({ i }) => i);
    assert.ok(guardie.length > 0, 'il modulo è importato ma non lo chiama nessuno');

    // ⭐ La regola non è «il recinto sta prima del primo worker», che sarebbe falsa: in `create`
    // il worker si chiama anche dentro il giro asincrono, che nel file sta più su.
    // 🚨⭐⭐ E non basta nemmeno «c'è un recinto da qualche parte più su»: un recinto messo in
    // un'ALTRA funzione accontenterebbe il caso senza difendere questa strada — cioè il test
    // resterebbe verde mentre la difesa è sparita. Perciò dal punto in cui si scrive si RISALE, e
    // la prima cosa che si incontra dev'essere il recinto: se prima si incontra l'inizio di una
    // funzione, vuol dire che in questa strada il recinto non c'è.
    // 🚨 E il caso deve MISURARE qualcosa: se i punti di non ritorno non si trovassero più (file
    // riscritto, nome cambiato), passerebbe a vuoto. Si pretende che ci siano.
    const INIZIO_FUNZIONE = /^\s*(export\s+)?(async\s+)?function\s|^Deno\.serve\(/;
    for (const punto of punti) {
      const righeDelPunto = righe.map((r, i) => ({ r, i })).filter(({ r }) => punto.test(r)).map(({ i }) => i);
      assert.ok(righeDelPunto.length > 0, `punto di non ritorno non trovato: ${punto}`);
      for (const rigaPunto of righeDelPunto) {
        let trovato = '';
        for (let i = rigaPunto - 1; i >= 0 && !trovato; i--) {
          if (guardie.includes(i)) trovato = 'recinto';
          else if (INIZIO_FUNZIONE.test(righe[i])) trovato = `inizio funzione (riga ${i + 1})`;
        }
        assert.equal(
          trovato, 'recinto',
          `risalendo dalla riga ${rigaPunto + 1} (${punto}) ho incontrato prima ${trovato || 'niente'}: `
          + 'quella strada arriva al gestionale senza passare dal recinto',
        );
      }
    }
  });
}

console.log(`\n${passed} passati, ${failed} falliti`);
if (failed) process.exit(1);
