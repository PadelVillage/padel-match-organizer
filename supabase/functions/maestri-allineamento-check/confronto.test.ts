import { assertEquals } from 'jsr:@std/assert@1';
import { confronta, impronta } from './confronto.ts';

// Le voci vere del dropdown Monitor al 29/07/2026 (dallo screenshot del committente).
const MATCHPOINT = ['LoZio', 'Lucas Vidal', 'Santiago Carabajal', 'Spinazze'];

Deno.test('oggi è allineato: la lista dopo il fix copre tutto Matchpoint', () => {
  const esito = confronta(['Santiago', 'LoZio', 'Spinazze', 'Lucas Vidal'], MATCHPOINT);
  assertEquals(esito.allineato, true);
  assertEquals(esito.daAggiungere, []);
  assertEquals(esito.rotti, []);
});

Deno.test('IL CASO DI OGGI: con la vecchia terna avrebbe segnalato Lucas Vidal', () => {
  // Se questo test non fosse rosso senza il fix, il controllo notturno sarebbe inutile.
  const esito = confronta(['Santiago', 'LoZio', 'Spinazze'], MATCHPOINT);
  assertEquals(esito.allineato, false);
  assertEquals(esito.daAggiungere, ['Lucas Vidal']);
  assertEquals(esito.rotti, []);
});

Deno.test('«Santiago» vs «Santiago Carabajal» NON è un disallineamento', () => {
  // Il falso positivo che ucciderebbe il controllo: un'email inutile ogni notte e
  // dopo una settimana nessuno la legge più. La regola è «contiene», non «uguale».
  const esito = confronta(['Santiago'], ['Santiago Carabajal']);
  assertEquals(esito.allineato, true);
  assertEquals(esito.coperti, [{ nostro: 'Santiago', matchpoint: 'Santiago Carabajal' }]);
});

Deno.test('un maestro rinominato su Matchpoint risulta ROTTO, non semplicemente assente', () => {
  // È il caso pericoloso: la voce resta nel menu del gestionale, ma al salvataggio
  // il worker non trova più nulla e la lezione non prende il maestro, in silenzio.
  const esito = confronta(['Spinazze'], ['Spinazzè Gianluca']);
  assertEquals(esito.allineato, false);
  assertEquals(esito.rotti, ['Spinazze']);
  assertEquals(esito.daAggiungere, ['Spinazzè Gianluca']);
});

Deno.test('CASO STORTO: due maestri con lo stesso cognome non generano un falso allarme', () => {
  // "Vidal" intercetta ENTRAMBE le voci. Contando solo la prima corrispondenza
  // (implementazione ingenua) "Marco Vidal" risulterebbe un maestro nuovo: email
  // sbagliata, e la fiducia nel controllo se ne va.
  const esito = confronta(['Vidal'], ['Lucas Vidal', 'Marco Vidal']);
  assertEquals(esito.daAggiungere, []);
  assertEquals(esito.allineato, true);
});

Deno.test('maiuscole e spazi non contano', () => {
  const esito = confronta(['  lucas vidal  '], ['LUCAS VIDAL']);
  assertEquals(esito.allineato, true);
});

Deno.test('se Matchpoint non restituisce nulla, TUTTO risulta rotto (lo deve intercettare il chiamante)', () => {
  // confronta() dice la verità sui dati che riceve; distinguere «nessun maestro» da
  // «lettura fallita» non è compito suo — index.ts si ferma prima di mandare l'email.
  const esito = confronta(['Santiago', 'LoZio'], []);
  assertEquals(esito.rotti, ['Santiago', 'LoZio']);
  assertEquals(esito.allineato, false);
});

Deno.test('impronta: stesso disallineamento = stessa impronta, ordine irrilevante', () => {
  // Serve a non rimandare la stessa email tutte le notti.
  const a = confronta(['Santiago'], ['Santiago Carabajal', 'Lucas Vidal', 'LoZio']);
  const b = confronta(['Santiago'], ['LoZio', 'Santiago Carabajal', 'Lucas Vidal']);
  assertEquals(impronta(a), impronta(b));
});

Deno.test('impronta: un maestro nuovo in più cambia l\'impronta (l\'email riparte)', () => {
  const a = confronta(['Santiago'], ['Santiago Carabajal', 'Lucas Vidal']);
  const b = confronta(['Santiago'], ['Santiago Carabajal', 'Lucas Vidal', 'Nuovo Maestro']);
  assertEquals(impronta(a) === impronta(b), false);
});
