import { assert, assertEquals } from 'jsr:@std/assert@1';
import { senzaNumeroDiScheda } from './esporta.ts';

Deno.test('il numero di scheda NON esce dal ponte', () => {
  const uscita = senzaNumeroDiScheda({
    id: 'matchpoint_n29tlt',
    name: 'Mario Rossi',
    phone: '3401234567',
  });
  assertEquals('id' in uscita, false);
});

Deno.test('tutto il resto esce intatto', () => {
  // Il rovescio del caso sopra: se togliessimo troppo, lo specchio smetterebbe
  // di copiare dei dati veri e nessuno se ne accorgerebbe — sarebbe un ponte
  // che «funziona» e consegna schede monche.
  const uscita = senzaNumeroDiScheda({
    id: 'x',
    name: 'Mario Rossi',
    firstName: 'Mario',
    surname: 'Rossi',
    phone: '3401234567',
    email: 'mario@example.com',
    gender: 'M',
    memberId: '000140',
    pmoPlayerId: 'PMO-000140',
    level: 3,
    active: true,
  });
  assertEquals(uscita.name, 'Mario Rossi');
  assertEquals(uscita.firstName, 'Mario');
  assertEquals(uscita.surname, 'Rossi');
  assertEquals(uscita.phone, '3401234567');
  assertEquals(uscita.email, 'mario@example.com');
  assertEquals(uscita.gender, 'M');
  assertEquals(uscita.memberId, '000140');
  assertEquals(uscita.pmoPlayerId, 'PMO-000140');
  assertEquals(uscita.level, 3);
  assertEquals(uscita.active, true);
  assertEquals(Object.keys(uscita).length, 10);
});

Deno.test('la scheda originale non viene toccata (si lavora su una copia)', () => {
  // Se togliesse l'id all'oggetto vero invece che a una copia, il ponte
  // starebbe modificando ciò che ha appena letto dal database: un effetto
  // collaterale dentro una funzione che deve essere di sola lettura.
  const originale = { id: 'resta-qui', name: 'Mario' };
  senzaNumeroDiScheda(originale);
  assertEquals(originale.id, 'resta-qui');
});

Deno.test('una scheda senza id non si rompe', () => {
  const uscita = senzaNumeroDiScheda({ name: 'Senza Numero' });
  assertEquals(uscita.name, 'Senza Numero');
  assert(!('id' in uscita));
});
