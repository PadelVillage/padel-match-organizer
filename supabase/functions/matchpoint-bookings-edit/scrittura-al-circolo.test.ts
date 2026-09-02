// Il RECINTO delle scritture sul gestionale del circolo — test deterministici.
// Esegui:  node supabase/functions/matchpoint-bookings-edit/scrittura-al-circolo.test.ts
//
// 🚨⭐⭐ Questo banco misura TRE cose diverse, e la terza è quella che di solito manca:
//   ① la REGOLA è giusta (chi passa e chi no);
//   ② le COPIE del modulo sono identiche — il deploy salta `_shared/`, quindi il modulo è
//      duplicato per forza e la deriva fra copie è il modo in cui questi fix si riaprono;
//   ③ 🚨 la regola è COLLEGATA: in tutte e otto le funzioni la chiamata sta PRIMA del punto di
//      non ritorno. Una guardia perfetta che nessuno chiama resta verde e non difende niente —
//      è la trappola più cara di questo progetto, e qui si misura la POSIZIONE, non la parola.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
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

// ── ② le copie ────────────────────────────────────────────────────────────────────────

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
  /* 🆕🧾 02/09/2026 — lo STORNO DI UN PAGAMENTO (`matchpoint-payment-void`). Nona copia, e nasce
     con la funzione: l'app la chiamava da mesi ma l'edge non esisteva **né in git né su Supabase**
     — a nasconderlo era il flag spento, che impediva al bottone di comparire e quindi anche al 404
     di arrivare a qualcuno.
     🚨 Sta nel recinto per la stessa ragione delle altre otto: il worker è **uno solo e condiviso**
     fra TEST e PROD, quindi uno storno «di prova» annullerebbe un incasso **vero** del circolo. */
  'matchpoint-payment-void/scrittura-al-circolo.ts',
  /* 🆕💶 03/09/2026 — l'INCASSO (`matchpoint-payment-write`). Decima copia, e non nasce con la
     funzione: la funzione esisteva **dal giugno 2026**, in `_archive/`, dove lui l'aveva mandata il
     9/08 proprio perché era una scrittura di denaro **fuori dal recinto**. ⇒ Torna viva adesso
     perché adesso il recinto ce l'ha: è la condizione a cui torna, non un dettaglio del ritorno.
     📌 *Una funzione si archivia per un difetto: riaccenderla senza aver curato quel difetto è
     rimettere in servizio il difetto, non la funzione.* */
  'matchpoint-payment-write/scrittura-al-circolo.ts',
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
  /* 🧾💶 03/09/2026 — LE DUE FUNZIONI DEI PAGAMENTI, e la prima delle due è un buco che era già
     aperto: `matchpoint-payment-void` era entrata nelle COPIE ieri (caso 8) ma **non qui**, dove si
     controlla che il recinto stia davvero sulla strada. ⇒ Il caso 8 certificava che il file era
     identico agli altri nove; nessuno certificava che qualcuno lo chiamasse prima di scrivere.
     📌 *Avere il modulo e attraversarlo sono due fatti diversi, e servono due guardie diverse:
     la prima da sola dice solo che la difesa è stata COPIATA.* */
  'matchpoint-payment-void/index.ts': [/await callWorkerVoid\(/],
  'matchpoint-payment-write/index.ts': [/await callWorkerCollect\(/],
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

/**
 * TUTTI i blocchi `{…}` che cominciano su una riga di guardia, ritagliati contando le graffe.
 *
 * 🚨⭐⭐ AL PLURALE dal 9/08/2026, e non è un dettaglio: `bookings-create` ha **due** recinti —
 * davanti al bivio e dentro il giro asincrono, la strada che risponde prima di lavorare. Fino a
 * ieri questa funzione ne ritagliava **uno solo** (il primo del file), quindi il secondo restava
 * completamente fuori dalla misura: chi ci avesse messo dentro una chiamata al circolo non
 * avrebbe fatto rosso niente. Trovato promuovendo la voce del borsellino, con un sabotaggio
 * costruito apposta su quel ramo.
 */
function ramiDiProva(rel: string): string[] {
  const righe = readFileSync(join(FUNZIONI, rel), 'utf8').split('\n');
  const inizi = righe
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => /if \(.*!scritturaAlCircoloConsentita\(/.test(r))
    .map(({ i }) => i);
  assert.notEqual(inizi.length, 0, `${rel}: non trovo nessun ramo di prova`);
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
  test(`10) 🚨 in ${nome} NESSUN ramo di prova chiama il circolo`, () => {
    for (const [n, ramo] of ramiDiProva(rel).entries()) {
      assert.ok(ramo.length > 0, `ramo ${n + 1} vuoto: il ritaglio non ha misurato niente`);
      assert.equal(
        atteso.maiChiamare.test(ramo), false,
        `nel ramo ${n + 1} di prova c'è ${atteso.maiChiamare}: da lì si arriva al Matchpoint VERO`,
      );
    }
  });

  test(`11) in ${nome} il ramo di prova REGISTRA (se no non è una prova, è un no)`, () => {
    // ⚖️ Basta che UNO dei rami registri: in `create` il secondo recinto sta nel giro asincrono,
    // che la partita l'ha già registrata prima di arrivare lì.
    const rami = ramiDiProva(rel);
    for (const gesto of atteso.deveFare) {
      assert.ok(rami.some((r) => gesto.test(r)), `in nessun ramo di prova c'è ${gesto}`);
    }
  });
}

test('12) ⚠️ il ramo di prova esiste in tutte e tre, e il ritaglio le trova davvero', () => {
  // ⭐ Il caso che difende gli altri due: se il ritaglio non trovasse più il ramo, i casi 10 e 11
  // girerebbero su una stringa vuota — «nessun worker qui dentro» sarebbe vero e non vorrebbe
  // dire niente. È la 29ª: un banco che misura ZERO.
  for (const rel of Object.keys(DENTRO_IL_RAMO)) {
    const rami = ramiDiProva(rel);
    for (const [n, ramo] of rami.entries()) {
      assert.ok(ramo.split('\n').length > 3, `${rel} ramo ${n + 1}: troppo corto, il ritaglio non ha funzionato`);
    }
    assert.ok(rami.some((r) => /esitoDiProva\(/.test(r)), `${rel}: in nessun ramo si compone l'esito di prova`);
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

// ── ⑤ 🆕 9/08/2026 · LE CINQUE CHE RIFIUTANO — anche il «no» va misurato ───────────────────
//
// 🚨⭐⭐ IL BUCO CHE QUESTA SEZIONE CHIUDE, e c'era da 3 giorni: il caso 9 pretende che il recinto
// stia PRIMA della chiamata al circolo. Ma se qualcuno mettesse quella chiamata **dentro** il ramo
// del rifiuto, risalendo si troverebbe il recinto lì sopra e il caso 9 resterebbe **verde** —
// mentre la funzione, fuori dalla produzione, scriverebbe eccome. Per le tre prenotazioni questo
// è già coperto (casi 10-12); per le quattro dell'anagrafica non lo era, e col borsellino
// diventano cinque. ⇒ Qui si guarda cosa c'è DENTRO il ramo: il circolo non si chiama, e si dice
// di no con il codice giusto.
// ⚖️ Le prenotazioni NON stanno in questo elenco perché il loro ramo **lavora** (registra la
// prova) invece di rifiutare: la loro misura è quella dei casi 10-12, non questa.

const CHI_RIFIUTA: Record<string, RegExp> = {
  'matchpoint-clients-create/index.ts': /callWorkerCreateClient\(/,
  'matchpoint-clients-update/index.ts': /callWorkerUpdateClient\(/,
  'matchpoint-clients-disable/index.ts': /callWorkerDisableClient\(/,
  'matchpoint-clients-reactivate/index.ts': /callWorkerReactivateClient\(/,
  // 💰 Il borsellino rifiuta e basta, e la ragione non è la pigrizia: Matchpoint è il libro
  // mastro UNICO, quindi «registrare qui una correzione di prova» aprirebbe il secondo libro
  // che la regola del progetto vieta. Chi un domani gli facesse registrare qualcosa deve prima
  // rispondere a QUELLA domanda, non copiare il ramo delle prenotazioni.
  'matchpoint-wallet-correct/index.ts': /callWorkerCorrect\(/,
};

for (const [rel, maiChiamare] of Object.entries(CHI_RIFIUTA)) {
  const nome = rel.split('/')[0];

  test(`17) 🚨 in ${nome} NESSUN ramo del rifiuto chiama il circolo`, () => {
    for (const [n, ramo] of ramiDiProva(rel).entries()) {
      // 🚨 La 29ª: un ritaglio a vuoto renderebbe «non c'è il worker qui dentro» vero e inutile.
      assert.ok(ramo.split('\n').length > 2, `${rel} ramo ${n + 1}: ritaglio troppo corto, non misura niente`);
      assert.equal(
        maiChiamare.test(ramo), false,
        `nel ramo ${n + 1} del rifiuto c'è ${maiChiamare}: da lì si arriva al Matchpoint VERO`,
      );
    }
  });

  test(`18) in ${nome} ogni rifiuto DICHIARA di esserlo (503 + codice)`, () => {
    for (const [n, ramo] of ramiDiProva(rel).entries()) {
      const dove = `${rel} ramo ${n + 1}`;
      // 🚨⭐⭐ Si guarda dentro la RISPOSTA, non dentro tutto il ramo: la prima versione di questo
      // caso cercava le parole ovunque e restava VERDE anche togliendo `avrebbe_…` dalla risposta,
      // perché la parola sopravviveva in una variabile locale e in un log. L'ha trovato un
      // sabotaggio che «non mordeva» — cioè il difetto stava nel caso, non nel sabotaggio.
      // ⚖️ Non tutti i rami rispondono: quello asincrono di `create` registra l'esito nel job,
      // perché al chiamante si è già risposto. Là non si pretende una risposta.
      const risposta = ramo.match(/return err\([\s\S]*?\);/);
      if (!risposta) {
        assert.ok(/MESSAGGIO_AMBIENTE_DI_PROVA/.test(ramo), `${dove}: non risponde e non registra nulla`);
        continue;
      }
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

test('19) 💰⭐⭐ il borsellino RIFIUTA: non registra da nessuna parte', () => {
  // 🚨 Il verso che conta, e vale i soldi: se un domani il ramo del borsellino cominciasse a
  // «registrare la prova» come fanno le prenotazioni, l'app di TEST vedrebbe un saldo che non
  // esiste su Matchpoint — cioè un SECONDO libro mastro, che in questo progetto è vietato.
  for (const ramo of ramiDiProva('matchpoint-wallet-correct/index.ts')) {
    assert.equal(/esitoDiProva\(/.test(ramo), false, 'il borsellino non deve comporre un esito di prova');
    assert.equal(/MARCHIO_NATA_IN_PROVA/.test(ramo), false, 'il borsellino non deve marchiare niente');
    assert.ok(/return err\(/.test(ramo), 'il ramo del borsellino deve USCIRE, non proseguire');
  }
});

/* ══ 🚨⭐⭐ 11/08/2026 — «REGISTRATA» DEV'ESSERE UN FATTO, NON UNA FRASE ══════════
 *
 * Trovato provando: il ponte rispondeva «Modifica di PROVA registrata» e in
 * `pmo_cloud_records` non c'era NIENTE — zero righe `staff_edit` in assoluto, su TEST e su
 * PROD. Due cose, e servono tutt'e due:
 *  · il CHECK sui tipi non ammetteva `staff_edit` né `staff_cancel` ⇒ il database rifiutava;
 *  · il codice **non guardava `{ error }`** — supabase-js lo RESTITUISCE invece di lanciarlo ⇒
 *    il `try/catch` di chi chiama non poteva scattare, e il rifiuto usciva come un «fatto».
 * ⭐⭐ Il caso 11 qui sopra era verde e restava verde: misurava che la funzione **venisse
 * chiamata**, non che **scrivesse**. È la differenza fra provare la struttura e provare la resa.
 */

test('20) 🚨⭐⭐ chi scrive il registro GUARDA l\'esito: un rifiuto del database non è un «fatto»', () => {
  // Ogni upsert su `pmo_cloud_records` dentro le tre funzioni delle prenotazioni dev'essere
  // seguito da un controllo dell'errore. Senza, il fallimento è muto — ed è già successo.
  const attesi: Array<[string, number]> = [
    ['matchpoint-bookings-edit/index.ts', 1],     // staff_edit
    ['matchpoint-bookings-cancel/index.ts', 2],   // spegnimento della prova + staff_cancel
    ['matchpoint-bookings-create/index.ts', 1],   // la riga della prenotazione
  ];
  for (const [rel, quanti] of attesi) {
    const src = readFileSync(join(FUNZIONI, rel), 'utf8');
    const conControllo = (src.match(/const \{ error: \w+ \} = await client\s*\n?\s*\.?from\('pmo_cloud_records'\)/g)
      ?? src.match(/const \{ error: \w+ \} = await client\.from\('pmo_cloud_records'\)/g) ?? []).length;
    assert.equal(conControllo, quanti,
      `${rel}: mi aspetto ${quanti} scritture che guardano l'errore, ne trovo ${conControllo}`);
    // 🚨 E il controllo deve LANCIARE: chi chiama tratta il fallimento in due modi opposti e
    // giusti (503 in prova, log in produzione), ma solo se gli arriva un'eccezione.
    assert.ok(/if \(errore\w*\) throw new Error\(/.test(src),
      `${rel}: l'errore si legge e non si lancia — il chiamante non lo saprà mai`);
  }
});

test('21) 🚨 la MIGRAZIONE che ammette i due tipi esiste, e li nomina tutt\'e due', () => {
  // ⚖️ Il codice del caso 16 senza questa migrazione trasformerebbe un difetto muto in un 503 a
  // ogni modifica di prova: la cura è la coppia, e questo caso lega le due metà.
  // 🚨 Il file NON prova che sia stata applicata (le migrazioni qui non partono da sole): prova
  // che esista e che non si perda in un merge. L'applicazione si verifica sul bersaglio.
  const MIGRAZIONI = join(FUNZIONI, '..', 'migrations');
  const file = readdirSync(MIGRAZIONI).filter((f) => /staff_edit_cancel\.sql$/.test(f));
  assert.equal(file.length, 1, 'la migrazione dei due tipi non c\'è (o ce n\'è più d\'una)');
  const sql = readFileSync(join(MIGRAZIONI, file[0]!), 'utf8');
  // Controllo opposto: se il CHECK non si ricostruisse, il file sarebbe innocuo e verde.
  assert.ok(/ADD CONSTRAINT pmo_cloud_records_type_check/.test(sql),
    'la migrazione non ricostruisce il vincolo: non cambierebbe niente');
  // 🚨⭐⭐ SI GUARDA SOLO L'ELENCO DEL VINCOLO, senza commenti — e non è pedanteria: la prima
  // stesura di questo caso cercava i nomi nel FILE INTERO ed è rimasta **verde** a un sabotaggio
  // che toglieva `staff_cancel` dal vincolo, perché il nome resta scritto qui sopra, nel
  // commento che racconta il difetto. Un caso che legge la spiegazione invece della regola
  // giudica il racconto, non il codice. → [[metodo-costruire-i-casi-storti]]
  const vincolo = (sql.split(/ADD CONSTRAINT pmo_cloud_records_type_check/)[1] ?? '')
    .split('\n').filter((r) => !/^\s*--/.test(r)).join('\n');
  assert.ok(vincolo.length > 200, 'non riesco a ritagliare l\'elenco del vincolo: caso cieco');
  for (const tipo of ['staff_edit', 'staff_cancel']) {
    assert.ok(new RegExp(`'${tipo}'`).test(vincolo), `il vincolo non ammette «${tipo}»`);
  }
  // 🚨 E i venti tipi di prima devono restarci TUTTI: un elenco riscritto a memoria che ne
  // perdesse uno spegnerebbe in silenzio una parte del gestionale.
  for (const vecchio of ['member', 'booking', 'staff_booking', 'payment', 'wallet_balance', 'booking_job']) {
    assert.ok(new RegExp(`'${vecchio}'`).test(vincolo), `il vincolo ha PERSO il tipo «${vecchio}»`);
  }
});

console.log(`\n${passed} passati, ${failed} falliti`);
if (failed) process.exit(1);
