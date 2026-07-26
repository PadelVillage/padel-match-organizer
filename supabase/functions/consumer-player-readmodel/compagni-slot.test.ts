// I compagni di uno slot — test deterministici, nessuna dipendenza esterna.
// Esegui:  node supabase/functions/consumer-player-readmodel/compagni-slot.test.ts
//
// ⭐ I casi 1-4 NON sono inventati: sono i roster VERI letti da PROD in sola lettura il
// 26/07. È il modo di provare una forma di dato che l'ambiente di TEST non contiene — là
// non esistono partite con più «Ospite».
import assert from 'node:assert/strict';
import { compagniDelloSlot, normName, rosterFromPayload } from './compagni-slot.ts';

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
const MAX = 8;

// ── I casi veri di PROD ────────────────────────────────────────────────────

test('1. un socio + TRE ospiti (Sergio Dal Bianco, 27/07 19:30 C2): tre compagni, non uno', () => {
  // Una sola riga `booking`: la scheda del circolo elenca quattro voci, `giocatori` è assente.
  const liste = [
    ['Sergio Dal Bianco', 'Ospite', 'Ospite', 'Ospite'], // descrizione
    ['Sergio Dal Bianco'],                               // intestatario
  ];
  const c = compagniDelloSlot(liste, varianti('Sergio Dal Bianco', 'Dal Bianco Sergio'), MAX);
  assert.deepEqual(c, ['Ospite', 'Ospite', 'Ospite']);
  assert.equal(c.length + 1, 4, 'la partita è completa: quattro in campo');
});

test('2. la stessa riga porta DUE elenchi uguali (Chiara Amato): restano tre ospiti, non sei', () => {
  // 🚨 Il caso che rende sbagliato il «massimo per riga»: dentro la stessa riga convivono la
  // scheda del circolo e l'array `giocatori`, che dicono la stessa cosa. Vanno confrontati,
  // non sommati.
  const liste = [
    ['Chiara Amato', 'Ospite', 'Ospite', 'Ospite'], // descrizione
    ['Chiara Amato', 'Ospite', 'Ospite', 'Ospite'], // giocatori
    ['Chiara Amato'],                               // intestatario
  ];
  const c = compagniDelloSlot(liste, varianti('Chiara Amato'), MAX);
  assert.deepEqual(c, ['Ospite', 'Ospite', 'Ospite']);
});

test('3. tre soci + UN ospite (Erika Poser, 28/07 18:00 C1) su tre righe: invariato', () => {
  // Il controllo che non fa passare un «conta sempre di più»: qui il comportamento di prima
  // era già giusto e deve restare identico.
  const riga = ['Andrea Bigaran', 'Alessandro Miraval', 'Ospite', 'Erika Poser'];
  const liste = [
    riga, ['Erika Poser'],
    riga, ['Alessandro Miraval'],
    riga, riga, ['Andrea Bigaran'], // la terza riga ha anche `giocatori`
  ];
  const c = compagniDelloSlot(liste, varianti('Erika Poser', 'Poser Erika'), MAX);
  assert.deepEqual(c, ['Andrea Bigaran', 'Alessandro Miraval', 'Ospite']);
});

test('4. la partita con la SOSTITUZIONE (27/07 13:00 C3): cinque nomi, nessuno moltiplicato', () => {
  // Le due copie si contraddicono (Barbera è entrata al posto di Da Rios). Questa funzione
  // non risolve la contraddizione — non è il suo mestiere, ci pensa la rete dei «quattro
  // giusti» in consumer-booking-write. Deve però lasciare le cose come stavano: un nome a
  // testa, nessuna moltiplicazione.
  const sincronizzate = ['Valeria Moschet', 'Silvia Balzarini', 'Giorgia Eporti', 'Pierangela Barbera'];
  const inApp = ['Valeria Moschet', 'Silvia Balzarini', 'Giorgia Eporti', 'Federica Da Rios'];
  const liste = [sincronizzate, sincronizzate, sincronizzate, sincronizzate, inApp, inApp];
  const c = compagniDelloSlot(liste, varianti('Silvia Balzarini'), MAX);
  assert.deepEqual(c, ['Valeria Moschet', 'Giorgia Eporti', 'Pierangela Barbera', 'Federica Da Rios']);
});

// ── Le proprietà che devono reggere comunque ───────────────────────────────

test('5. il socio non è compagno di sé stesso, in nessuna delle sue forme', () => {
  const liste = [['Mario Rossi', 'ROSSI MARIO', 'Ospite']];
  const c = compagniDelloSlot(liste, varianti('Mario Rossi', 'Rossi Mario'), MAX);
  assert.deepEqual(c, ['Ospite']);
});

test('6. ⭐ le stesse liste ROVESCIATE danno lo stesso conteggio', () => {
  // L'ordine con cui le righe arrivano dal database non è garantito (nessun `order by`):
  // un test che regge solo nell'ordine osservato misura una proprietà accidentale del dato.
  const liste = [
    ['Sergio Dal Bianco', 'Ospite', 'Ospite', 'Ospite'],
    ['Sergio Dal Bianco'],
  ];
  const dritte = compagniDelloSlot(liste, varianti('Sergio Dal Bianco'), MAX);
  const rovesce = compagniDelloSlot([...liste].reverse(), varianti('Sergio Dal Bianco'), MAX);
  assert.equal(rovesce.length, dritte.length);
  assert.deepEqual([...rovesce].sort(), [...dritte].sort());
});

test('7. il tetto taglia, e taglia in fondo', () => {
  const liste = [['A', 'B', 'C', 'D', 'E']];
  assert.deepEqual(compagniDelloSlot(liste, varianti(), 3), ['A', 'B', 'C']);
});

test('8. il tetto vale anche quando a sforare sono le RIPETIZIONI', () => {
  const liste = [['Ospite', 'Ospite', 'Ospite', 'Ospite', 'Ospite']];
  assert.equal(compagniDelloSlot(liste, varianti(), 2).length, 2);
});

test('9. niente liste, o solo nomi vuoti: nessun compagno e nessun errore', () => {
  assert.deepEqual(compagniDelloSlot([], varianti('Tizio'), MAX), []);
  assert.deepEqual(compagniDelloSlot([['', '   ', null as unknown as string]], varianti(), MAX), []);
});

test('10. una lista più informativa vince su una più povera', () => {
  // La copia in app conosce un solo ospite, la scheda del circolo ne elenca tre: si tiene tre.
  const liste = [
    ['Luca Verdi', 'Ospite'],                     // copia povera
    ['Luca Verdi', 'Ospite', 'Ospite', 'Ospite'], // scheda del circolo
  ];
  const c = compagniDelloSlot(liste, varianti('Luca Verdi'), MAX);
  assert.deepEqual(c, ['Ospite', 'Ospite', 'Ospite']);
});

// ── Dal PAYLOAD ai compagni: la catena intera ──────────────────────────────
//
// 🚨 Questi test nascono da un sabotaggio che PASSAVA: «la scheda del circolo non entra fra
// le liste» non faceva cadere nulla, perché tutti i casi qui sopra passano le liste già
// pronte e non esercitano mai la lettura del payload. Eppure per le righe `booking` senza
// `giocatori` la scheda è l'UNICA fonte che contiene gli ospiti: toglierla riporterebbe il
// difetto senza un solo rosso. → metodo-il-caso-reale-non-discrimina.
// I payload sono quelli VERI letti da PROD il 26/07.

/** La catena come la percorre l'edge: payload delle righe → liste → compagni. */
function compagniDaRighe(
  righe: Array<[string, Record<string, unknown>]>,
  ...varianti: string[]
): string[] {
  const liste = righe.flatMap(([tipo, p]) => rosterFromPayload(tipo, p).liste);
  return compagniDelloSlot(liste, new Set(varianti.map(normName)), MAX);
}

test('11. dal payload VERO: un socio + tre ospiti, con la sola scheda del circolo', () => {
  const riga: Record<string, unknown> = {
    descrizione: '-Sergio Dal Bianco.-Ospite.-Ospite.-Ospite.',
    giocatore: 'Sergio Dal Bianco',
  };
  assert.deepEqual(
    compagniDaRighe([['booking', riga]], 'Sergio Dal Bianco'),
    ['Ospite', 'Ospite', 'Ospite'],
  );
});

test('12. dal payload VERO: scheda e `giocatori` dicono la stessa cosa, tre ospiti non sei', () => {
  const riga: Record<string, unknown> = {
    descrizione: '-Chiara Amato.-Ospite.-Ospite.-Ospite.',
    giocatori: ['Chiara Amato', 'Ospite', 'Ospite', 'Ospite'],
    giocatore: 'Chiara Amato',
  };
  assert.deepEqual(
    compagniDaRighe([['booking', riga]], 'Chiara Amato'),
    ['Ospite', 'Ospite', 'Ospite'],
  );
});

test('13. dal payload VERO: quattro righe della stessa partita non moltiplicano i compagni', () => {
  const scheda = '-Andrea Bigaran.-Alessandro Miraval.-Ospite.-Erika Poser.';
  const righe: Array<[string, Record<string, unknown>]> = [
    ['booking', { descrizione: scheda, giocatore: 'Erika Poser' }],
    ['booking', { descrizione: scheda, giocatore: 'Alessandro Miraval' }],
    ['booking', {
      descrizione: scheda,
      giocatori: ['Andrea Bigaran', 'Alessandro Miraval', 'Ospite', 'Erika Poser'],
      giocatore: 'Andrea Bigaran',
    }],
  ];
  assert.deepEqual(
    compagniDaRighe(righe, 'Erika Poser'),
    ['Andrea Bigaran', 'Alessandro Miraval', 'Ospite'],
  );
});

test('14. `staff_booking.nome` non è una persona e non entra fra i compagni', () => {
  // La lista unita da virgole e troncata a metà parola: come rete per il match serve
  // ancora, come roster mai — ci aveva già fatto contare cinque giocatori su quattro.
  const riga: Record<string, unknown> = {
    nome: 'Maurizio Aprea, Fabio De Luca, Nicola Stella, Filipe Neves De Sa',
    giocatori: [{ nome: 'Fabio De Luca', codiceCliente: '000130' }],
  };
  const r = rosterFromPayload('staff_booking', riga);
  assert.deepEqual(r.liste, [['Fabio De Luca']]);
  assert.deepEqual(compagniDaRighe([['staff_booking', riga]], 'Maurizio Aprea'), ['Fabio De Luca']);
});

test('15. i giocatori scritti come OGGETTI arrivano fra i compagni (non "[object Object]")', () => {
  const riga: Record<string, unknown> = {
    giocatori: [
      { nome: 'Maurizio Aprea', codiceCliente: '000004' },
      { nome: 'Fabio De Luca' },
      { nome: 'Ospite' },
      { nome: 'Ospite' },
    ],
  };
  assert.deepEqual(
    compagniDaRighe([['staff_booking', riga]], 'Maurizio Aprea'),
    ['Fabio De Luca', 'Ospite', 'Ospite'],
  );
});

test('16. una descrizione LIBERA non è un roster: nessun compagno inventato', () => {
  // Regola ereditata dal sync: i nomi si leggono solo se la descrizione è una lista che
  // inizia per «-». Un titolo come «Torneo aziendale» non contiene persone, e prenderlo per
  // roster darebbe al socio un compagno che non esiste. Senza questo test il controllo del
  // trattino si poteva togliere senza far cadere nulla (sabotaggio misurato, 26/07).
  const riga: Record<string, unknown> = { descrizione: 'Torneo aziendale sponsor', giocatore: 'Mario Rossi' };
  const r = rosterFromPayload('booking', riga);
  assert.deepEqual(r.liste, [['Mario Rossi']]);
  assert.deepEqual(compagniDaRighe([['booking', riga]], 'Mario Rossi'), []);
});

console.log(`\n${passed} passati, ${failed} falliti`);
if (failed > 0) process.exit(1);
