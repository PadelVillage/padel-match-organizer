// Il RECINTO delle scritture sul gestionale del circolo — test deterministici.
// Esegui:  node supabase/functions/matchpoint-bookings-edit/scrittura-al-circolo.test.ts
//
// 🚨⭐⭐ Questo banco misura TRE cose diverse, e la terza è quella che di solito manca:
//   ① la REGOLA è giusta (chi passa e chi no);
//   ② le OTTO COPIE del modulo sono identiche — il deploy salta `_shared/`, quindi il modulo è
//      duplicato per forza e la deriva fra copie è il modo in cui questi fix si riaprono;
//   ③ 🚨 la regola è COLLEGATA: in tutte e otto le funzioni la chiamata sta PRIMA del punto di
//      non ritorno. Una guardia perfetta che nessuno chiama resta verde e non difende niente —
//      è la trappola più cara di questo progetto, e qui si misura la POSIZIONE, non la parola;
//   ④ 🆕 9/08/2026 — e cosa c'è DENTRO il ramo del rifiuto, che è il punto cieco del ③: una
//      chiamata al circolo messa lì dentro lascerebbe il ③ verde, perché risalendo troverebbe
//      il recinto proprio lì sopra.
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

// ── ② le otto copie ────────────────────────────────────────────────────────────────────────

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
  // 🆕💰 9/08/2026 — il BORSELLINO: era l'ultima funzione di scrittura rimasta fuori dal recinto,
  // e le sue correzioni (storno e ricarica) toccavano il circolo da qualunque ambiente.
  'matchpoint-wallet-correct/scrittura-al-circolo.ts',
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
  // 💰 Il borsellino: `/correct-wallet` muove denaro vero in tutte e due le direzioni (storno e
  // ricarica). Una strada sola, e il recinto le sta davanti.
  'matchpoint-wallet-correct/index.ts': [/await callWorkerCorrect\(/],
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

// ── ④ 🆕 9/08/2026 · IL «NO» VA MISURATO QUANTO IL «SÌ» ───────────────────────────────────
//
// 🚨⭐⭐ IL BUCO CHE QUESTA SEZIONE CHIUDE, ed era aperto qui da quando il recinto esiste: il caso
// 9 pretende che il recinto stia PRIMA della chiamata al circolo. Ma se qualcuno mettesse quella
// chiamata **dentro** il ramo del rifiuto, risalendo si troverebbe il recinto lì sopra e il caso 9
// resterebbe **verde** — mentre la funzione, fuori dalla produzione, scriverebbe eccome.
// ⇒ Qui si guarda cosa c'è DENTRO quel ramo: il circolo non si chiama, e si dice di no con il
//   codice giusto. Non le parole della risposta: i gesti.

/**
 * TUTTI i blocchi `{…}` che cominciano su una riga di guardia, ritagliati contando le graffe.
 *
 * 🚨⭐⭐ AL PLURALE, e non è un dettaglio: `bookings-create` ha **due** recinti — davanti al bivio
 * e dentro il giro asincrono, la strada che risponde prima di lavorare. La prima versione di
 * questa funzione ne ritagliava **uno solo** (il primo del file) e avrebbe lasciato l'altro
 * completamente fuori dalla misura: un caso che guarda una strada sola su due la difende a metà.
 */
function ramiDelRifiuto(rel: string): string[] {
  const righe = readFileSync(join(FUNZIONI, rel), 'utf8').split('\n');
  const inizi = righe
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => /if \(.*!scritturaAlCircoloConsentita\(/.test(r))
    .map(({ i }) => i);
  assert.notEqual(inizi.length, 0, `${rel}: non trovo nessun ramo del rifiuto`);
  return inizi.map((inizio) => {
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
  });
}

const CHI_RIFIUTA: Record<string, RegExp> = {
  'matchpoint-bookings-create/index.ts': /callWorkerCreateBooking\(/,
  'matchpoint-bookings-edit/index.ts': /callWorkerEditBooking\(/,
  'matchpoint-bookings-cancel/index.ts': /callWorkerCancelBooking\(/,
  'matchpoint-clients-create/index.ts': /callWorkerCreateClient\(/,
  'matchpoint-clients-update/index.ts': /callWorkerUpdateClient\(/,
  'matchpoint-clients-disable/index.ts': /callWorkerDisableClient\(/,
  'matchpoint-clients-reactivate/index.ts': /callWorkerReactivateClient\(/,
  // 💰 Il borsellino rifiuta e basta, e la ragione non è la pigrizia della copia: Matchpoint è il
  // libro mastro UNICO, quindi «registrare qui una correzione di prova» aprirebbe il secondo
  // libro che la regola del progetto vieta.
  'matchpoint-wallet-correct/index.ts': /callWorkerCorrect\(/,
};

for (const [rel, maiChiamare] of Object.entries(CHI_RIFIUTA)) {
  const nome = rel.split('/')[0];

  test(`10) 🚨 in ${nome} NESSUN ramo del rifiuto chiama il circolo`, () => {
    const rami = ramiDelRifiuto(rel);
    for (const [n, ramo] of rami.entries()) {
      // 🚨 Un ritaglio a vuoto renderebbe «non c'è il worker qui dentro» vero e inutile.
      assert.ok(ramo.split('\n').length > 2, `${rel}: ramo ${n + 1} troppo corto, non misura niente`);
      assert.equal(
        maiChiamare.test(ramo), false,
        `nel ramo ${n + 1} del rifiuto c'è ${maiChiamare}: da lì si arriva al Matchpoint VERO`,
      );
    }
  });

  test(`11) in ${nome} ogni rifiuto DICHIARA di esserlo, e USCE`, () => {
    for (const [n, ramo] of ramiDelRifiuto(rel).entries()) {
      const dove = `${rel} ramo ${n + 1}`;
      // ① Ogni ramo, comunque sia fatto, deve usare la parola condivisa del recinto.
      assert.ok(
        /MESSAGGIO_AMBIENTE_DI_PROVA|CODICE_AMBIENTE_DI_PROVA/.test(ramo),
        `${dove}: non usa il messaggio condiviso — chi legge dovrebbe indovinare cos'è successo`,
      );
      // ② E deve USCIRE: un ramo che non torna indietro prosegue verso il worker.
      assert.ok(/\breturn\b/.test(ramo), `${dove}: non esce, la strada continua verso il circolo`);

      // ③ Il ramo che RISPONDE deve anche dire cosa avrebbe fatto.
      // ⚖️ Non tutti rispondono, ed è giusto: il secondo recinto di `bookings-create` sta dentro
      // il giro asincrono, dove al chiamante si è già risposto — là l'esito si registra nel job.
      // 🚨⭐⭐ Si guarda dentro la RISPOSTA, non in tutto il ramo: la prima versione cercava le
      // parole ovunque e restava VERDE anche togliendo `avrebbe_…` dalla risposta, perché la
      // parola sopravviveva in una variabile locale e nel log. L'ha trovato un sabotaggio che
      // «non mordeva» — cioè il difetto stava nel caso, non nel sabotaggio.
      const risposta = ramo.match(/return err\([\s\S]*?\);/);
      if (!risposta) continue;
      const testo = risposta[0];
      assert.ok(/\b503\b/.test(testo), `${dove}: il rifiuto non risponde 503`);
      assert.ok(/CODICE_AMBIENTE_DI_PROVA/.test(testo), `${dove}: il rifiuto non usa il codice condiviso`);
      // ⭐ Un rifiuto che non dice cosa avrebbe fatto costringe a rifare la prova per capirlo.
      // ⚖️ `avrebbe_…` e non `avrebbe_scritto`: `cancel` dice `avrebbe_annullato`, ed è la parola
      // giusta per un annullamento. Si pretende il gesto, non il vocabolario.
      assert.ok(/avrebbe_\w+/.test(testo), `${dove}: il rifiuto non dice cosa avrebbe fatto`);
    }
  });
}

console.log(`\n${passed} passati, ${failed} falliti`);
if (failed) process.exit(1);
