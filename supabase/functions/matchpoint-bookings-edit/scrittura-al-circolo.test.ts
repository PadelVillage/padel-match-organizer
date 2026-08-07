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
import {
  esitoDiProva,
  esitoVieneDaUnaProva,
  MARCHIO_NATA_IN_PROVA,
  REF_PROD,
  scritturaAlCircoloConsentita,
} from './scrittura-al-circolo.ts';

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
  // 🆕 6/08/2026 — l'anagrafica: creare, cambiare, disattivare e riattivare un CLIENTE del
  // circolo. Sono entrate dopo le prenotazioni, per una ragione sua: lo specchio notturno
  // riscrive l'anagrafica di TEST, non quella del circolo ⇒ una scheda toccata per gioco
  // sarebbe l'unica cosa che la notte NON ripulisce.
  'matchpoint-clients-create/scrittura-al-circolo.ts',
  'matchpoint-clients-update/scrittura-al-circolo.ts',
  'matchpoint-clients-disable/scrittura-al-circolo.ts',
  'matchpoint-clients-reactivate/scrittura-al-circolo.ts',
];

test(`8) ⚠️ le ${GEMELLI.length} copie del modulo sono identiche byte per byte`, () => {
  // 🚨 `readFileSync` senza rete: un percorso sbagliato fa FALLIRE il caso, non passare.
  const testi = GEMELLI.map((rel) => readFileSync(join(FUNZIONI, rel), 'utf8'));
  assert.equal(testi.length, GEMELLI.length);
  for (let i = 1; i < testi.length; i++) {
    assert.equal(testi[i], testi[0], `${GEMELLI[i]} diverge da ${GEMELLI[0]}`);
  }
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
  // L'anagrafica. ⚖️ In `create` la RICERCA per telefono (`soloRicerca`) passa dal worker e
  // resta viva anche fuori dalla produzione: non scrive niente ed è la guardia contro i
  // doppioni. Il punto di non ritorno è solo la chiamata che CREA.
  'matchpoint-clients-create/index.ts': [/await callWorkerCreateClient\(/],
  'matchpoint-clients-update/index.ts': [/await callWorkerUpdateClient\(/],
  'matchpoint-clients-disable/index.ts': [/await callWorkerDisableClient\(/],
  'matchpoint-clients-reactivate/index.ts': [/await callWorkerReactivateClient\(/],
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

// ── ④ 🆕 7/08/2026 · IL RECINTO REGISTRA INVECE DI RIFIUTARE ───────────────────────────────
//
// 🚨⭐⭐ Il rischio nuovo, e va detto in faccia: fino a ieri il ramo «non sono la produzione»
// era un vicolo cieco — usciva e basta, e non poteva far danno. Adesso quel ramo LAVORA. Se
// qualcuno ci rimettesse dentro la chiamata al circolo, la difesa sarebbe sparita **restando
// verde** su tutti i casi di sopra, che guardano solo la strada normale.
// ⇒ I casi qui sotto misurano cosa c'è DENTRO quel ramo: che il worker non ci sia, e che la
//   registrazione ci sia. Non le parole della risposta: i gesti.

/** Il blocco `{…}` che comincia sulla riga della guardia, ritagliato contando le graffe. */
function ramoDiProva(rel: string): string {
  const testo = readFileSync(join(FUNZIONI, rel), 'utf8');
  const righe = testo.split('\n');
  const inizio = righe.findIndex((r) => /if \(.*!scritturaAlCircoloConsentita\(/.test(r));
  assert.notEqual(inizio, -1, `${rel}: non trovo il ramo di prova`);
  let graffe = 0;
  let dentro = '';
  for (let i = inizio; i < righe.length; i++) {
    dentro += righe[i] + '\n';
    for (const c of righe[i]) {
      if (c === '{') graffe += 1;
      else if (c === '}') graffe -= 1;
    }
    if (graffe === 0 && i > inizio) break;
  }
  return dentro;
}

const DENTRO_IL_RAMO: Record<string, { maiChiamare: RegExp; deveFare: RegExp[] }> = {
  'matchpoint-bookings-create/index.ts': {
    maiChiamare: /callWorkerCreateBooking\(/,
    deveFare: [/saveStaffBookingRecord\(/],
  },
  'matchpoint-bookings-edit/index.ts': {
    maiChiamare: /callWorkerEditBooking\(/,
    deveFare: [/saveStaffEditRecord\(/],
  },
  'matchpoint-bookings-cancel/index.ts': {
    maiChiamare: /callWorkerCancelBooking\(/,
    // 🚨 Due cose, e la prima è quella trovata ragionando: chi fa sparire una partita annullata
    // NON è questa funzione ma il giro di sincronizzazione, che su una partita di prova non ha
    // niente da leggere. Senza `spegni…`, l'annullamento di prova lascerebbe la partita in piedi.
    deveFare: [/spegniPartiteDiProvaSulloSlot\(/, /saveStaffCancelRecord\(/],
  },
};

for (const [rel, atteso] of Object.entries(DENTRO_IL_RAMO)) {
  const nome = rel.split('/')[0];
  test(`10) 🚨 in ${nome} il ramo di prova NON chiama il circolo`, () => {
    const ramo = ramoDiProva(rel);
    assert.ok(ramo.length > 0, 'ramo vuoto: il ritaglio non ha misurato niente');
    assert.equal(
      atteso.maiChiamare.test(ramo), false,
      `dentro il ramo di prova c'è ${atteso.maiChiamare}: da lì si arriva al Matchpoint VERO`,
    );
  });

  test(`11) in ${nome} il ramo di prova REGISTRA (se no non è una prova, è un no)`, () => {
    const ramo = ramoDiProva(rel);
    for (const gesto of atteso.deveFare) {
      assert.ok(gesto.test(ramo), `dentro il ramo di prova manca ${gesto}`);
    }
  });
}

test('12) ⚠️ il ramo di prova esiste in tutte e tre, e il ritaglio le trova davvero', () => {
  // ⭐ Il caso che difende gli altri due: se il ritaglio non trovasse più il ramo, i casi 10 e 11
  // girerebbero su una stringa vuota — «nessun worker qui dentro» sarebbe vero e non vorrebbe
  // dire niente. È la 29ª: un banco che misura ZERO.
  for (const rel of Object.keys(DENTRO_IL_RAMO)) {
    const ramo = ramoDiProva(rel);
    assert.ok(ramo.split('\n').length > 3, `${rel}: ramo troppo corto, il ritaglio non ha funzionato`);
    assert.ok(/esitoDiProva\(/.test(ramo), `${rel}: nel ramo non si compone nemmeno l'esito di prova`);
  }
});

test('13) 🚨⭐⭐ il MARCHIO è la stessa parola nel sync — due verità non si tengono a mano', () => {
  // Il sync sta in un'altra funzione e NON può importare questo modulo (ogni edge è isolata):
  // là dentro il marchio è scritto a mano. Se qualcuno cambiasse la costante qui, il reconcile
  // ricomincerebbe a cancellare le partite di prova **senza un errore da nessuna parte**.
  // ⇒ L'unico modo di legarle è un caso che rilegge i due file dal disco.
  const sync = readFileSync(join(FUNZIONI, 'matchpoint-bookings-sync/index.ts'), 'utf8');
  assert.ok(
    sync.includes(MARCHIO_NATA_IN_PROVA),
    `il sync non conosce il marchio «${MARCHIO_NATA_IN_PROVA}»: le partite di prova verrebbero cancellate`,
  );
});

test('14) 🚨 nel sync il salto delle prove sta PRIMA del tombstone (posizione, non parola)', () => {
  // Stessa idea del caso 9: una riga che salta le prove messa DOPO il `push` che le cancella
  // sarebbe una riga inutile, e la parola ci sarebbe lo stesso.
  const righe = readFileSync(join(FUNZIONI, 'matchpoint-bookings-sync/index.ts'), 'utf8').split('\n');
  const salto = righe.findIndex((r) => r.includes(MARCHIO_NATA_IN_PROVA) && /continue/.test(r));
  assert.notEqual(salto, -1, 'nel sync non c\'è nessuna riga che SALTA le righe di prova');
  // Il tombstone dello staff_booking dentro il ciclo del reconcile: `deleted: true` + push.
  const tombstone = righe.findIndex((r, i) => i > salto && /deleted:\s*true/.test(r));
  assert.notEqual(tombstone, -1, 'non trovo il tombstone dopo il salto: il caso non misura niente');
  assert.ok(salto < tombstone, 'il salto delle prove viene DOPO la cancellazione: non serve a nulla');
});

test('15) l\'esito di prova si riconosce, e quello vero NON si scambia per una prova', () => {
  const prova = esitoDiProva('create');
  assert.equal(esitoVieneDaUnaProva(prova), true);
  assert.ok(String(prova.idReserva).startsWith('PROVA-'), 'l\'idReserva di prova deve dirsi');
  // 🚨 Il verso che conta: un esito VERO del worker non deve mai passare per prova, se no la sua
  // riga verrebbe marcata e il reconcile smetterebbe di sorvegliarla — una partita vera che
  // nessuno controlla più.
  assert.equal(esitoVieneDaUnaProva({ idReserva: '123456', ok: true }), false);
  assert.equal(esitoVieneDaUnaProva({ simulato: 'sì' }), false, 'solo il booleano vero conta');
  assert.equal(esitoVieneDaUnaProva(null), false);
  assert.equal(esitoVieneDaUnaProva(undefined), false);
});

test('16) due prove di fila non sono la stessa prenotazione', () => {
  // Se l'idReserva fosse fisso, la seconda partita di prova sovrascriverebbe la prima.
  assert.notEqual(esitoDiProva('create').idReserva, esitoDiProva('create').idReserva);
});

console.log(`\n${passed} passati, ${failed} falliti`);
if (failed) process.exit(1);
