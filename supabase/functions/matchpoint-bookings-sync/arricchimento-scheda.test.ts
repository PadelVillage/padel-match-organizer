/* 🪟 «La scheda completa senza chiedere a Matchpoint» — banco della voce 142, seconda metà.
 *
 * 🎯 COSA DIFENDE, e nessuna di queste si vede rileggendo il codice:
 *   ① 🚨 **nel payload non entra nessun timbro di tempo** — riletti gli stessi nomi il risultato
 *      è IDENTICO. È il freno che tiene in piedi «non riscrivere l'invariato» (voce 160): un
 *      `arricchitoAt` farebbe riscrivere ogni prenotazione ogni 2 minuti;
 *   ② un roster **riordinato** è lo stesso roster ⇒ non si rilegge (l'organizzatore cambia posto
 *      e basterebbe quello per far ripartire una lettura di Matchpoint a vuoto);
 *   ③ una lettura **vuota** non conta come fatta — o un guasto silenzioso del worker
 *      cancellerebbe il dato dichiarando di averlo;
 *   ④ le Osservazioni si scrivono **anche vuote**, o la scheda risulterebbe da leggere per sempre;
 *   ⑤ 🚨 `giocatori` **non viene toccato**: su quella lista `eventi-staff.ts` decide chi viene
 *      avvisato, e non si cambia la forma di un dato da cui dipende un avviso.
 *
 * ⛔ QUELLO CHE NON DICE: gira senza Matchpoint e senza database ⇒ dice che la regola è quella
 *    giusta, non che sul gestionale la scheda si apra completa. Quello lo dice la misura sulla
 *    pagina viva.
 *
 * Esegui:  deno test --allow-read supabase/functions/matchpoint-bookings-sync/arricchimento-scheda.test.ts
 */
import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  chiaveNome,
  improntaRoster,
  vaArricchita,
  scegliDaArricchire,
  fondiArricchimento,
  conservaArricchimento,
} from './arricchimento-scheda.ts';

Deno.test('chiaveNome: maiuscole, accenti e spazi doppi non fanno due persone', () => {
  assertEquals(chiaveNome('Lucas Vidal'), chiaveNome('lucas  vidal'));
  assertEquals(chiaveNome('NICOLÒ Rossi'), 'nicolo rossi');
  assertEquals(chiaveNome(null), '');
});

Deno.test('② un roster RIORDINATO è lo stesso roster: stessa impronta', () => {
  const a = improntaRoster(['Lidia Comes', 'Ospite', 'Fabiola Limuti']);
  const b = improntaRoster(['Fabiola Limuti', 'Lidia Comes', 'Ospite']);
  assertEquals(a, b);
});

Deno.test('un roster DIVERSO ha un\'impronta diversa', () => {
  const a = improntaRoster(['Lidia Comes', 'Fabiola Limuti']);
  const b = improntaRoster(['Lidia Comes', 'Marco Aprea']);
  assert(a !== b);
});

Deno.test('l\'impronta legge sia le stringhe sia gli oggetti {nome} (il payload ha tutt\'e due le forme)', () => {
  // 📏 Misurato su PROD il 04/09: 173 roster a oggetti e 67 a stringhe.
  assertEquals(
    improntaRoster(['Lidia Comes', 'Ospite']),
    improntaRoster([{ nome: 'Lidia Comes' }, { nome: 'Ospite' }]),
  );
});

Deno.test('mai letta ⇒ va letta', () => {
  assertEquals(vaArricchita({}, ['Lidia Comes']), true);
  assertEquals(vaArricchita(null, ['Lidia Comes']), true);
});

Deno.test('senza giocatori non c\'è scheda da completare ⇒ non si legge', () => {
  assertEquals(vaArricchita({}, []), false);
  assertEquals(vaArricchita({}, null), false);
});

Deno.test('① già letta con GLI STESSI nomi ⇒ NON si rilegge (è il freno anti-riscrittura)', () => {
  const giocatori = ['Lidia Comes', 'Fabiola Limuti'];
  const payload = { idClienti: { 'lidia comes': '10' }, arricchitoPer: improntaRoster(giocatori) };
  assertEquals(vaArricchita(payload, giocatori), false);
  // …e nemmeno se li riordina qualcuno
  assertEquals(vaArricchita(payload, ['Fabiola Limuti', 'Lidia Comes']), false);
});

Deno.test('i NOMI cambiati ⇒ si rilegge', () => {
  const payload = { idClienti: { 'lidia comes': '10' }, arricchitoPer: improntaRoster(['Lidia Comes']) };
  assertEquals(vaArricchita(payload, ['Lidia Comes', 'Marco Aprea']), true);
});

Deno.test('① IL PAYLOAD NON PORTA TIMBRI: due letture identiche danno un risultato IDENTICO', () => {
  // 🚨 Se questo caso cade, ogni prenotazione viene riscritta a ogni giro del sync — la fabbrica
  //    di WAL da cui nasce la voce 160, con PROD irraggiungibile per otto ore.
  const giocatori = ['Lidia Comes', 'Fabiola Limuti'];
  const lettura = { partecipantiFinali: [{ nome: 'Lidia Comes', idCliente: '10' }], note: 'ciao ciao' };
  const a = fondiArricchimento(lettura, giocatori);
  const b = fondiArricchimento(lettura, giocatori);
  assertEquals(JSON.stringify(a), JSON.stringify(b));
  const chiavi = Object.keys(a!).sort();
  assertEquals(chiavi, ['arricchitoPer', 'idClienti', 'note']);
  for (const k of chiavi) {
    assert(!/at$|_at$|time|stamp|data|ora/i.test(k), `«${k}» somiglia a un timbro di tempo`);
  }
});

Deno.test('④ le Osservazioni VUOTE si scrivono lo stesso (se c\'è almeno un id)', () => {
  const out = fondiArricchimento(
    { partecipantiFinali: [{ nome: 'Lidia Comes', idCliente: '10' }], note: '' },
    ['Lidia Comes'],
  );
  assertEquals(out!.note, '');
  assertEquals(out!.idClienti, { 'lidia comes': '10' });
});

Deno.test('③ una lettura VUOTA non conta come fatta', () => {
  // Senza questo freno un guasto silenzioso del worker scriverebbe una mappa vuota, e il giro
  // dopo la prenotazione risulterebbe «già arricchita»: si perderebbe il dato dichiarando di averlo.
  assertEquals(fondiArricchimento({ partecipantiFinali: [], note: '' }, ['Lidia Comes']), null);
  assertEquals(fondiArricchimento(null, ['Lidia Comes']), null);
  assertEquals(fondiArricchimento({ partecipantiFinali: [{ nome: 'X' }] }, ['X']), null);
});

Deno.test('…ma una lettura con la SOLA nota vale (una manutenzione non ha giocatori con id)', () => {
  const out = fondiArricchimento({ partecipantiFinali: [], note: 'STAGE SANTIAGO' }, ['Lidia Comes']);
  assertEquals(out!.note, 'STAGE SANTIAGO');
});

Deno.test('gli id si accostano per NOME normalizzato, così un riordino non li disallinea', () => {
  const out = fondiArricchimento(
    { partecipantiFinali: [{ nome: 'FABIOLA  LIMUTI', idCliente: 7 }, { nome: 'Lidia Comes', idCliente: '10' }], note: '' },
    ['Lidia Comes', 'Fabiola Limuti'],
  );
  assertEquals(out!.idClienti, { 'fabiola limuti': '7', 'lidia comes': '10' });
});

Deno.test('un partecipante SENZA id non entra nella mappa (un buco non si riempie con una bugia)', () => {
  const out = fondiArricchimento(
    { partecipantiFinali: [{ nome: 'Ospite', idCliente: '' }, { nome: 'Lidia Comes', idCliente: '10' }], note: '' },
    ['Lidia Comes', 'Ospite'],
  );
  assertEquals(out!.idClienti, { 'lidia comes': '10' });
});

Deno.test('⭐ si servono prima le prenotazioni PIÙ VICINE: sono quelle che qualcuno apre oggi', () => {
  const c = [
    { data: '2026-09-20', ora: '10:00' },
    { data: '2026-09-07', ora: '18:00' },
    { data: '2026-09-07', ora: '09:00' },
  ];
  assertEquals(scegliDaArricchire(c, 2), [
    { data: '2026-09-07', ora: '09:00' },
    { data: '2026-09-07', ora: '18:00' },
  ]);
});

Deno.test('il tetto è un tetto: il worker è UN browser solo, condiviso con PROD', () => {
  const c = [{ data: '2026-09-07', ora: '09:00' }, { data: '2026-09-08', ora: '09:00' }];
  assertEquals(scegliDaArricchire(c, 0).length, 0);
  assertEquals(scegliDaArricchire(c, 1).length, 1);
  assertEquals(scegliDaArricchire(c, 99).length, 2);
});

Deno.test('scegliDaArricchire non tocca la lista che riceve', () => {
  const c = [{ data: '2026-09-20' }, { data: '2026-09-07' }];
  const copia = JSON.stringify(c);
  scegliDaArricchire(c, 2);
  assertEquals(JSON.stringify(c), copia);
});

Deno.test('⑤ ciò che esce NON contiene `giocatori`: su quella lista eventi-staff.ts decide chi viene avvisato', () => {
  /* 🩹 Le prime due versioni di questa sonda leggevano il SORGENTE con una regex, e fallivano
     tutt'e due sul CODICE GIUSTO: la prima pescava l'annotazione di tipo `giocatori: unknown` di
     un parametro e la chiamava assegnazione; la seconda provava a togliere le liste di parametri
     con `\([^)]*\)`, che su una firma scritta su più righe non toglie niente.
     📌 *Una sonda che deve indovinare la grammatica per capire cosa guarda è già più fragile
        della cosa che sorveglia* — e quando sbaglia dice «rotto» di ciò che è sano, che è il modo
        più rapido di far smettere di leggere un banco.
     ⇒ Si guarda il COMPORTAMENTO, che è quello che davvero importa: dal payload che questo
        modulo produce, `giocatori` non esce. Se un domani ci finisse dentro, questo caso cade. */
  const out = fondiArricchimento(
    { partecipantiFinali: [{ nome: 'Lidia Comes', idCliente: '10' }], note: 'x' },
    ['Lidia Comes', 'Fabiola Limuti'],
  );
  assertEquals(Object.keys(out!).sort(), ['arricchitoPer', 'idClienti', 'note']);
  assert(!Object.prototype.hasOwnProperty.call(out!, 'giocatori'));
});

/* 🚨⭐⭐ I CASI NATI DAL DIFETTO VISTO SU PROD IL 06/09 — e che il banco di prima mancava tutto.
 *
 * 📏 Acceso a tetto 1 per 14 minuti: quattro giri, quattro `riuscite: 1`, e in archivio UNA sola
 *    prenotazione arricchita — ogni volta una DIVERSA. Le funzioni pure erano giuste; a perdere il
 *    lavoro era il collegamento, perché `validation.bookings` nasce dall'export a ogni giro e
 *    l'export questi campi non li porta.
 * ⚖️ Il primo caso qui sotto non prova una funzione: prova il GIRO, simulandone cinque. È l'unica
 *    forma in cui quel difetto si vede — guardando una fusione alla volta, tutto tornava.
 * 📌 *Un banco che prova solo i pezzi non vede il difetto che sta nel modo in cui si susseguono.* */

Deno.test('⭐ il difetto di PROD: dopo cinque giri il dato si è ACCUMULATO, non sostituito', () => {
  const archivio = new Map<string, unknown>();
  const partite = [
    { k: 'a', giocatori: ['Anna Bianchi', 'Bruno Neri'] },
    { k: 'b', giocatori: ['Carlo Verdi', 'Dario Blu'] },
    { k: 'c', giocatori: ['Elsa Rosa', 'Furio Gialli'] },
  ];
  const idPer: Record<string, Record<string, string>> = {
    a: { 'anna bianchi': '1', 'bruno neri': '2' },
    b: { 'carlo verdi': '3', 'dario blu': '4' },
    c: { 'elsa rosa': '5', 'furio gialli': '6' },
  };

  for (let giro = 0; giro < 5; giro++) {
    // il payload nuovo nasce dall'export: SOLO i nomi, nessun id — è il fatto da cui nasce il difetto
    const nuovi = partite.map((p) => ({ k: p.k, giocatori: [...p.giocatori] })) as Array<
      { k: string; giocatori: string[]; idClienti?: Record<string, string>; note?: string; arricchitoPer?: string }
    >;
    for (const b of nuovi) {
      const tenuto = conservaArricchimento(archivio.get(b.k), b.giocatori);
      if (tenuto) { b.idClienti = tenuto.idClienti; b.note = tenuto.note; b.arricchitoPer = tenuto.arricchitoPer; }
    }
    const cand = nuovi.filter((b) => vaArricchita(archivio.get(b.k), b.giocatori));
    if (cand.length) {
      const b = cand[0];
      const fuso = fondiArricchimento(
        { partecipantiFinali: Object.entries(idPer[b.k]).map(([nome, idCliente]) => ({ nome, idCliente })), note: '' },
        b.giocatori,
      );
      if (fuso) { b.idClienti = fuso.idClienti; b.note = fuso.note; b.arricchitoPer = fuso.arricchitoPer; }
    }
    for (const b of nuovi) archivio.set(b.k, { ...b });
  }

  const arricchite = [...archivio.values()].filter((v) => (v as { idClienti?: unknown }).idClienti).length;
  // ⛔ Senza la conservazione questo numero è 1 — ed è ESATTAMENTE ciò che PROD ha mostrato.
  assertEquals(arricchite, 3);
});

Deno.test('conservaArricchimento: si conserva solo se l\'impronta vale ancora per QUESTI nomi', () => {
  const roster = ['Maurizio Aprea', 'Fabio De Luca'];
  const archivio = {
    idClienti: { 'maurizio aprea': '4', 'fabio de luca': '137' },
    note: '', arricchitoPer: improntaRoster(roster),
  };
  assertEquals(conservaArricchimento(archivio, roster)?.idClienti, archivio.idClienti);
  // roster cambiato ⇒ quegli id non parlano più di questa partita: si lascia ricadere in lettura
  assertEquals(conservaArricchimento(archivio, ['Maurizio Aprea', 'Tizio Nuovo']), null);
  // riordinato ⇒ è lo stesso roster: si conserva
  assertEquals(conservaArricchimento(archivio, ['Fabio De Luca', 'Maurizio Aprea'])?.idClienti, archivio.idClienti);
});

Deno.test('conservaArricchimento: niente da conservare, e niente timbri di tempo', () => {
  const roster = ['Anna Bianchi'];
  const impronta = improntaRoster(roster);
  assertEquals(conservaArricchimento(undefined, roster), null);
  assertEquals(conservaArricchimento({}, roster), null);
  assertEquals(conservaArricchimento({ arricchitoPer: impronta, idClienti: {} }, roster), null);
  assertEquals(conservaArricchimento({ arricchitoPer: impronta, idClienti: ['4'] }, roster), null);
  const tenuto = conservaArricchimento({ arricchitoPer: impronta, idClienti: { 'anna bianchi': '9' }, note: 'x' }, roster);
  assertEquals(Object.keys(tenuto!).sort(), ['arricchitoPer', 'idClienti', 'note']);
  // conservato ⇒ non si rilegge
  assert(!vaArricchita(tenuto, roster));
});
