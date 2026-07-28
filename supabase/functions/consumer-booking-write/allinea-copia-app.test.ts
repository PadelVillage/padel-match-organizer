// L'allineamento della copia in app dopo un'uscita — test deterministici, nessuna rete.
// Esegui:  node supabase/functions/consumer-booking-write/allinea-copia-app.test.ts
//
// ⭐ I casi 1, 2 e 3 NON sono inventati: sono i payload VERI letti da PROD in sola lettura il
// 28/07/2026. È l'unico modo di provare questo codice, perché l'ambiente di TEST **non
// contiene la forma del dato**: là ci sono 24 righe `staff_booking` vive e NESSUNA futura
// (l'ultima è del 25/07), quindi una prova fatta di là non toccherebbe mai questo percorso e
// passerebbe. Stessa ragione per cui esiste `roster-slot.test.ts`.
import assert from 'node:assert/strict';
import { allineaCopiaInApp, type RigaCopiaInApp } from './allinea-copia-app.ts';
import { normName } from './roster-slot.ts';

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

/** Le stesse forme del nome che il ponte usa per riconoscere il socio nel roster. */
const varianti = (...n: string[]) => new Set(n.map(normName));
const APREA = varianti('Maurizio Aprea', 'Aprea Maurizio');

const riga = (id: string, payload: Record<string, unknown>): RigaCopiaInApp => ({ id, payload });

/** I nomi che la riga porterebbe dopo, letti dal payload nuovo e non dal riassunto. */
const nomiDi = (p: Record<string, unknown> | undefined) => {
  const gio = Array.isArray(p?.giocatori) ? (p!.giocatori as unknown[]) : [];
  return gio.map((g) => String(typeof g === 'object' && g !== null ? (g as Record<string, unknown>).nome : g));
};

// ── I payload VERI di PROD (28/07/2026, sola lettura) ─────────────────────────────────────

// 28/07 16:30 campo 3 — riga unica, `giocatori` a OGGETTI col codice socio.
const PROD_2807_1630_C3 = {
  campo: '3', data: '2026-07-28', ora: '16:30', tipo: 'partita', durata: 90,
  nome: 'Maurizio Aprea, Fabio De Luca, Nicola Stella, Filipe Neves De Sa',
  id_reserva: '9061', note: '',
  giocatori: [
    { nome: 'Maurizio Aprea', codice: '4', codiceCliente: '000004' },
    { nome: 'Fabio De Luca', codice: '', codiceCliente: '000130' },
    { nome: 'Nicola Stella', codice: '', codiceCliente: '000061' },
    { nome: 'Filipe Neves De Sa', codice: '' },
  ],
};

// 29/07 18:00 campo 2 — 🚨 `giocatori` MESCOLA una stringa e tre oggetti nello stesso elenco.
const PROD_2907_1800_C2 = {
  campo: '2', data: '2026-07-29', ora: '18:00', tipo: 'partita',
  nome: 'Fabio De Luca, Gianluca Bologna, Carlo Ceriali, Federico De Lorenzi',
  giocatori: [
    'Fabio De Luca',
    { nome: 'Gianluca Bologna', codice: '' },
    { nome: 'Carlo Ceriali', codice: '' },
    { nome: 'Federico De Lorenzi', codice: '' },
  ],
};

// 31/07 13:00 campo 2 — 🚨 lo STESSO slot ha DUE righe: quella dell'app (chiave a UUID) e
// quella che scrive `matchpoint-bookings-create` (chiave `staff_booking|…|utente`).
const PROD_3107_1300_C2_APP = {
  campo: '2', data: '2026-07-31', ora: '13:00', tipo: 'partita',
  nome: 'Maurizio Aprea, Luca Allera, Andrei Romano, Ospite',
  giocatori: [
    { nome: 'Maurizio Aprea', codice: '4', codiceCliente: '000004' },
    { nome: 'Luca Allera', codice: '', codiceCliente: '000029' },
    { nome: 'Andrei Romano', codice: '', codiceCliente: '000380' },
    { nome: 'Ospite', codice: '', codiceCliente: '000001' },
  ],
};
const PROD_3107_1300_C2_PONTE = {
  campo: '2', data: '2026-07-31', ora: '13:00', tipo: 'partita',
  nome: 'Maurizio Aprea, Luca Allera, Andrei Romano, Ospite',
  giocatori: [
    { nome: 'Maurizio Aprea', codice: '4' },
    { nome: 'Luca Allera', codice: '' },
    { nome: 'Andrei Romano', codice: '' },
    { nome: 'Ospite', codice: '' },
  ],
};

// ── I casi ────────────────────────────────────────────────────────────────────────────────

test('1) payload VERO di PROD: il socio esce da `giocatori` E da `nome`, gli altri tre restano', () => {
  const a = allineaCopiaInApp([riga('r1', PROD_2807_1630_C3)], APREA);
  assert.equal(a.conteggi.righe, 1);
  assert.equal(a.conteggi.allineate, 1);
  assert.equal(a.righe[0].da_giocatori, true, 'doveva trovarlo in `giocatori`');
  assert.equal(a.righe[0].da_nome, true, 'doveva trovarlo anche in `nome`');
  const p = a.daScrivere[0].payload;
  assert.deepEqual(nomiDi(p), ['Fabio De Luca', 'Nicola Stella', 'Filipe Neves De Sa']);
  assert.equal(p.nome, 'Fabio De Luca, Nicola Stella, Filipe Neves De Sa');
});

test('2) payload VERO di PROD: `giocatori` mescola STRINGHE e OGGETTI, e gli altri restano com\'erano', () => {
  const a = allineaCopiaInApp([riga('r2', PROD_2907_1800_C2)], varianti('Fabio De Luca'));
  const p = a.daScrivere[0].payload;
  assert.deepEqual(nomiDi(p), ['Gianluca Bologna', 'Carlo Ceriali', 'Federico De Lorenzi']);
  // 🚨 Gli elementi non toccati si ricopiano IDENTICI: normalizzarli qui riscriverebbe dati
  // che nessuno ci ha chiesto di toccare (il codice socio sparirebbe dalla copia).
  assert.deepEqual((p.giocatori as unknown[])[0], { nome: 'Gianluca Bologna', codice: '' });
  assert.equal(p.nome, 'Gianluca Bologna, Carlo Ceriali, Federico De Lorenzi');
});

test('3) payload VERI di PROD: lo stesso slot ha DUE righe e si allineano TUTTE E DUE', () => {
  const a = allineaCopiaInApp(
    [riga('app', PROD_3107_1300_C2_APP), riga('ponte', PROD_3107_1300_C2_PONTE)],
    APREA,
  );
  assert.equal(a.conteggi.righe, 2);
  assert.equal(a.conteggi.allineate, 2, 'allinearne una sola lascerebbe l\'altra a rimettere il socio in campo');
  assert.equal(a.daScrivere.length, 2);
  for (const s of a.daScrivere) {
    assert.deepEqual(nomiDi(s.payload), ['Luca Allera', 'Andrei Romano', 'Ospite']);
    assert.equal(s.payload.nome, 'Luca Allera, Andrei Romano, Ospite');
  }
});

test('4) CONTROLLO OPPOSTO — chi non è in quella copia non la fa riscrivere', () => {
  // Senza questo caso, un codice che «allinea sempre» passerebbe tutti gli altri.
  const a = allineaCopiaInApp([riga('r1', PROD_2807_1630_C3)], varianti('Lidia Comes'));
  assert.equal(a.conteggi.invariate, 1);
  assert.equal(a.conteggi.allineate, 0);
  assert.equal(a.daScrivere.length, 0, 'una riga che non contiene il socio non si scrive');
});

test('5) il `nome` TRONCATO a metà parola: il socio si toglie lo stesso', () => {
  // 🚨 «Aldo Bianchi, Bruna Conti, Nicola St» è la forma vera: `nome` è troncato, e un
  // confronto esatto manca proprio l'ultima voce.
  const a = allineaCopiaInApp([riga('r', {
    nome: 'Aldo Bianchi, Bruna Conti, Nicola St',
    giocatori: [{ nome: 'Aldo Bianchi' }, { nome: 'Bruna Conti' }, { nome: 'Nicola Stella' }],
  })], varianti('Nicola Stella'));
  assert.equal(a.conteggi.allineate, 1);
  assert.equal(a.righe[0].da_nome, true, 'la voce troncata andava riconosciuta');
  assert.equal(a.daScrivere[0].payload.nome, 'Aldo Bianchi, Bruna Conti');
});

test('6) …ma il prefisso NON vale se quella voce è una persona vera (falso positivo)', () => {
  // «Mario» è un prefisso di «Mario Bianchi», però compare INTERO fra i `giocatori`: allora
  // non è un troncamento, è qualcuno che gioca — e toglierlo lo cancellerebbe dalla copia.
  const a = allineaCopiaInApp([riga('r', {
    nome: 'Carla Neri, Mario',
    giocatori: [{ nome: 'Carla Neri' }, { nome: 'Mario' }, { nome: 'Mario Bianchi' }],
  })], varianti('Mario Bianchi'));
  assert.equal(a.righe[0].da_giocatori, true, 'da `giocatori` esce comunque, ed è giusto');
  assert.equal(a.righe[0].da_nome, false, 'da `nome` NON si tocca «Mario», che è un altro');
  assert.equal(a.daScrivere[0].payload.nome, 'Carla Neri, Mario');
});

test('7) MAI SVUOTARE: se resterebbe senza nessuno, la riga non si tocca', () => {
  const a = allineaCopiaInApp([riga('sola', {
    nome: 'Maurizio Aprea',
    giocatori: [{ nome: 'Maurizio Aprea' }],
  })], APREA);
  assert.equal(a.conteggi.non_svuotate, 1);
  assert.equal(a.conteggi.allineate, 0);
  assert.equal(a.daScrivere.length, 0, 'una copia ferma è meno dannosa di una copia vuota');
});

test('8) un `nome` che è un TITOLO e non un roster resta intatto', () => {
  // `nome` non è per forza una lista di persone. Togliendo per confronto — e non
  // ricostruendolo dai `giocatori` — un titolo che non contiene il socio sopravvive.
  const a = allineaCopiaInApp([riga('r', {
    nome: 'Torneo sociale',
    giocatori: [{ nome: 'Maurizio Aprea' }, { nome: 'Lidia Comes' }],
  })], APREA);
  assert.equal(a.righe[0].da_nome, false);
  assert.equal(a.daScrivere[0].payload.nome, 'Torneo sociale');
  assert.deepEqual(nomiDi(a.daScrivere[0].payload), ['Lidia Comes']);
});

test('9) si toglie UNA occorrenza sola, non tutti gli omonimi', () => {
  const a = allineaCopiaInApp([riga('r', {
    nome: 'Ospite, Ospite, Lidia Comes',
    giocatori: [{ nome: 'Ospite' }, { nome: 'Ospite' }, { nome: 'Lidia Comes' }],
  })], varianti('Ospite'));
  assert.deepEqual(nomiDi(a.daScrivere[0].payload), ['Ospite', 'Lidia Comes']);
  assert.equal(a.daScrivere[0].payload.nome, 'Ospite, Lidia Comes');
});

test('10) tutte le altre chiavi del payload restano dov\'erano', () => {
  const a = allineaCopiaInApp([riga('r1', PROD_2807_1630_C3)], APREA);
  const p = a.daScrivere[0].payload;
  assert.equal(p.id_reserva, '9061');
  assert.equal(p.tipo, 'partita');
  assert.equal(p.durata, 90);
  assert.equal(p.campo, '3');
  assert.equal(p.data, '2026-07-28');
  assert.equal(p.ora, '16:30');
  // E l'originale non è stato modificato sotto i piedi di nessuno.
  assert.equal((PROD_2807_1630_C3.giocatori as unknown[]).length, 4);
});

test('11) il socio scritto AL CONTRARIO nella copia viene riconosciuto lo stesso', () => {
  // 🚨 Il gestionale scrive ora «Nome Cognome» ora «Cognome Nome», e le due copie possono
  // averlo scritto in versi diversi. Con una forma sola questa riga risulterebbe «invariata»,
  // cioè il difetto intero con una misura che dice «fatto».
  const a = allineaCopiaInApp([riga('r', {
    nome: 'Aprea Maurizio, Lidia Comes',
    giocatori: [{ nome: 'Aprea Maurizio' }, { nome: 'Lidia Comes' }],
  })], APREA);
  assert.equal(a.conteggi.allineate, 1);
  assert.deepEqual(nomiDi(a.daScrivere[0].payload), ['Lidia Comes']);
  // 🚨 Questa riga è stata aggiunta DOPO un sabotaggio uscito VERDE: senza, il caso guardava
  // solo `giocatori` e una copia col nome rovesciato sarebbe rimasta scritta in `nome`. Era
  // debole la misura, non il codice — ed è la sola parte che il sabotaggio toccava.
  assert.equal(a.daScrivere[0].payload.nome, 'Lidia Comes');
});

test('12) `giocatori` e `nome` sono INDIPENDENTI: il socio in uno solo dei due esce lo stesso', () => {
  const soloNome = allineaCopiaInApp([riga('r', {
    nome: 'Maurizio Aprea, Lidia Comes',
    giocatori: [{ nome: 'Lidia Comes' }],
  })], APREA);
  assert.equal(soloNome.righe[0].da_giocatori, false);
  assert.equal(soloNome.righe[0].da_nome, true);
  assert.equal(soloNome.daScrivere[0].payload.nome, 'Lidia Comes');

  const soloGiocatori = allineaCopiaInApp([riga('r', {
    nome: 'Partita del giovedì',
    giocatori: [{ nome: 'Maurizio Aprea' }, { nome: 'Lidia Comes' }],
  })], APREA);
  assert.equal(soloGiocatori.righe[0].da_giocatori, true);
  assert.equal(soloGiocatori.righe[0].da_nome, false);
});

test('13) nessuna copia in app: zero righe, zero scritture, e lo dice', () => {
  // ⭐ Il caso NORMALE di TEST, e di ogni prenotazione nata fuori dall'app. Deve rispondere
  // con dei conteggi, non con l'assenza: uno zero dichiarato è un'informazione, un campo che
  // manca è indistinguibile da un codice che non c'è.
  const a = allineaCopiaInApp([], APREA);
  assert.deepEqual(a.conteggi, { righe: 0, allineate: 0, invariate: 0, non_svuotate: 0 });
  assert.deepEqual(a.daScrivere, []);
});

test('14) una riga senza `giocatori` e senza `nome` non si scrive', () => {
  const a = allineaCopiaInApp([riga('vuota', { campo: '1', data: '2026-08-01', ora: '10:00' })], APREA);
  assert.equal(a.conteggi.invariate, 1);
  assert.equal(a.daScrivere.length, 0);
});

console.log(`\n${passed} passati, ${failed} falliti`);
if (failed) process.exit(1);
