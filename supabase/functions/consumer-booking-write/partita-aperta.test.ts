// Le regole delle «Partite Aperte» (voce 88) — test deterministici, nessuna rete.
// Esegui:  node supabase/functions/consumer-booking-write/partita-aperta.test.ts
//
// ⭐ IL GRUPPO 4 È QUELLO CHE PROTEGGE UNA DECISIONE, non un calcolo: esegue la regola ④
// **senza** la decisione ① — cioè trattando lo 0,5 come un livello qualunque — e mostra i due
// buchi che ne uscivano. Un caso che confronta la strada giusta con quella sbagliata non
// misura una funzione: tiene ferma una scelta, e sopravvive a chi non era nella stanza.
// ⭐ IL GRUPPO 6 tiene l'ORDINE dei rifiuti. È l'unica parte che un riordino «per pulizia»
// romperebbe senza far cadere nient'altro, e il danno sarebbe una frase falsa detta a una
// persona vera.
import assert from 'node:assert/strict';
import {
  chiaveApertura,
  mezziPunti,
  bandaDiLivello,
  dentroLaBanda,
  puoAprire,
  decidiIngresso,
  MOTIVI,
  GIOCATORI_PARTITA,
  TIPO_RECORD_APERTURA,
} from './partita-aperta.ts';

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

/** Una scheda con un livello dimostrato: l'origine vuota è il caso dei 517 soci di PROD. */
const conLivello = (l: string) => ({ level: l, levelSource: '' });
/** La scheda dell'81% del circolo: «da definire», che non è un livello. */
const senzaLivello = { level: '0.5', levelSource: '' };

/** L'ingresso che passa, da cui i casi partono cambiando una cosa per volta. */
function ingressoBuono(patch: Record<string, unknown> = {}) {
  return decidiIngresso({
    aperta: true,
    organizzatore: conLivello('3'),
    candidato: { ...conLivello('3.5'), memberId: '001013' },
    giocatoriInCampo: 2,
    giaInPartita: false,
    clienteDelCircolo: true,
    ...patch,
  } as Parameters<typeof decidiIngresso>[0]);
}

// ── 1. La chiave dello slot ────────────────────────────────────────────────

test('1. la chiave usa le sole CIFRE del campo: «Campo 1» e «1» sono la stessa partita', () => {
  assert.equal(chiaveApertura('2026-09-04', '18:30', 'Campo 1'), '2026-09-04|18:30|1');
  assert.equal(chiaveApertura('2026-09-04', '18:30', '1'), '2026-09-04|18:30|1');
  assert.equal(
    chiaveApertura('2026-09-04', '18:30', 'Campo 1'),
    chiaveApertura('2026-09-04', '18:30', '1'),
  );
});

test('2. senza uno dei tre pezzi la chiave è VUOTA, non parziale', () => {
  assert.equal(chiaveApertura('', '18:30', '1'), '');
  assert.equal(chiaveApertura('2026-09-04', '', '1'), '');
  assert.equal(chiaveApertura('2026-09-04', '18:30', ''), '');
  assert.equal(chiaveApertura('2026-09-04', '18:30', 'Campo'), '');
});

// ── 2. I livelli, contati in mezzi punti ───────────────────────────────────

test('3. il livello si legge anche con la virgola', () => {
  assert.equal(mezziPunti('2,5'), 5);
  assert.equal(mezziPunti('2.5'), 5);
  assert.equal(mezziPunti(' 3 '), 6);
});

test('4. un livello illeggibile è null, non zero', () => {
  assert.equal(mezziPunti(''), null);
  assert.equal(mezziPunti(null), null);
  assert.equal(mezziPunti(undefined), null);
  assert.equal(mezziPunti('boh'), null);
  // 🚨 Lo zero sarebbe il difetto: un livello illeggibile diventerebbe un centro di banda
  // valido, e chi sta a 0,5 entrerebbe in una partita di cui non si sa niente.
  assert.notEqual(mezziPunti('boh'), 0);
});

test('5. la banda è L−0,5 · L · L+0,5', () => {
  assert.deepEqual(bandaDiLivello('3'), { min: 2.5, max: 3.5 });
  assert.deepEqual(bandaDiLivello('4,5'), { min: 4, max: 5 });
});

test('6. una banda senza centro è null, MAI una banda vuota', () => {
  // ⚖️ «non so dove sta il centro» e «attorno a questo centro non c'è nessuno» sono due
  // risposte diverse: confonderle fa dire «nessuno è del tuo livello» a chi il livello non
  // ce l'ha, che è la frase sbagliata detta alla persona sbagliata.
  assert.equal(bandaDiLivello(''), null);
  assert.equal(bandaDiLivello('boh'), null);
});

test('7. dentroLaBanda: un passo sì, due no', () => {
  assert.equal(dentroLaBanda('3', '3'), true);
  assert.equal(dentroLaBanda('3', '2.5'), true);
  assert.equal(dentroLaBanda('3', '3.5'), true);
  assert.equal(dentroLaBanda('3', '2'), false);
  assert.equal(dentroLaBanda('3', '4'), false);
});

test('8. i decimali non mentono, perché non si sommano decimali', () => {
  // 0.1+0.2 ≠ 0.3 in virgola mobile: contando in mezzi punti la domanda diventa |a−b| ≤ 1.
  assert.equal(dentroLaBanda('4.5', '5'), true);
  assert.equal(dentroLaBanda('5.5', '5'), true);
  assert.equal(dentroLaBanda('5.5', '4.5'), false);
});

// ── 3. Chi può APRIRE ──────────────────────────────────────────────────────

test('9. apre chi ha un livello DIMOSTRATO', () => {
  assert.equal(puoAprire(conLivello('3')), true);
  assert.equal(puoAprire({ level: '4.5', levelSource: 'autovalutazione' }), true);
});

test('10. non apre chi è a «da definire» — decisione ① del 01/09', () => {
  assert.equal(puoAprire(senzaLivello), false);
  assert.equal(puoAprire({ level: '', levelSource: '' }), false);
});

test('11. non apre chi ha un livello IN PRESTITO', () => {
  // Un 4.5 preso a prestito da chi invita centrerebbe una banda su un numero mai misurato.
  assert.equal(puoAprire({ level: '4.5', levelSource: 'ereditato_da_confermare' }), false);
});

// ── 4. ⭐ LA DECISIONE ①, eseguita contro la strada che NON è stata presa ───

test('12. ⭐ regola ④ SENZA la decisione ①, primo buco: l\'81% resta fuori', () => {
  // La ④ letterale, applicata allo 0,5 come se fosse un livello: chi sta a 0,5 non arriva
  // a un passo da NESSUN livello vero (il più basso della tabella è 1,5), quindi resta
  // fuori da ogni partita aperta di chi un livello ce l'ha. Sono 2.283 soci su 2.821.
  assert.equal(dentroLaBanda('0.5', '1.5'), false);
  assert.equal(dentroLaBanda('0.5', '2.5'), false);
  // ⇒ La decisione ① non peggiora questo caso: lo NOMINA. Al posto di un silenzio
  // aritmetico esce `serve_il_test`, che è una strada.
  const esito = ingressoBuono({ candidato: { ...senzaLivello, memberId: '001013' } });
  assert.deepEqual(esito, { ok: false, motivo: MOTIVI.SERVE_IL_TEST });
});

test('13. ⭐⭐ regola ④ SENZA la decisione ①, secondo buco: la partita aperta a 2.283', () => {
  // Se ad APRIRE è chi sta a 0,5, la banda letterale attorno a 0,5 contiene 0,5 stesso ⇒
  // quella partita risulta aperta a tutti i 2.283 che stanno lì: il vincolo di livello,
  // dentro una regola che sembra un filtro, non filtra nessuno.
  assert.equal(dentroLaBanda('0.5', '0.5'), true);
  // ⇒ È la metà che si chiude impedendo di APRIRE, e va provata su un candidato che TUTTE le
  // altre porte le passa — o a fermarlo è il cancello sbagliato e questo caso non prova niente.
  //
  // 🚨⭐⭐ PRIMA STESURA SBAGLIATA, e vale più del caso: qui c'erano DUE persone a 0,5, e il
  // rosso lo dava `serve_il_test` sul candidato. Sabotando `puoAprire` il caso restava VERDE —
  // cioè sorvegliava una riga e ne provava un'altra. 📌 *Un caso che passa da due cancelli
  // misura il primo, non quello che voleva.* Adesso il candidato è a **1,0**: livello
  // dimostrato, cliente, dentro la banda del ±0,5 attorno a 0,5 — passa tutto, e l'unica cosa
  // che lo può fermare è che chi ha aperto un livello non ce l'ha.
  assert.equal(dentroLaBanda('0.5', '1'), true, 'premessa del caso: il candidato è nella banda');
  const esito = decidiIngresso({
    aperta: true,
    organizzatore: senzaLivello,
    candidato: { ...conLivello('1'), memberId: '001013' },
    giocatoriInCampo: 2,
    giaInPartita: false,
    clienteDelCircolo: true,
  });
  assert.deepEqual(esito, { ok: false, motivo: MOTIVI.APERTURA_SENZA_LIVELLO });
});

test('14. ⭐ e l\'apertura si RICONTROLLA adesso: un livello tolto dopo chiude la porta', () => {
  // Fra l'apertura e questo istante la segreteria può aver rimesso quella scheda a «da
  // definire». Credere all'apertura vorrebbe dire calcolare la banda attorno a un non-dato.
  const esito = ingressoBuono({ organizzatore: senzaLivello });
  assert.deepEqual(esito, { ok: false, motivo: MOTIVI.APERTURA_SENZA_LIVELLO });
});

// ── 5. Le quattro regole, una per volta ────────────────────────────────────

test('15. l\'ingresso buono passa', () => {
  assert.deepEqual(ingressoBuono(), { ok: true });
});

test('16. regola ②: una partita non aperta non si tocca', () => {
  assert.deepEqual(ingressoBuono({ aperta: false }), { ok: false, motivo: MOTIVI.NON_APERTA });
});

test('17. regola ③: la rubrica cade, il CLIENTE DEL CIRCOLO resta', () => {
  assert.deepEqual(
    ingressoBuono({ clienteDelCircolo: false }),
    { ok: false, motivo: MOTIVI.NON_CLIENTE },
  );
});

test('18. regola ④: un livello a due passi non entra', () => {
  assert.deepEqual(
    ingressoBuono({ candidato: { ...conLivello('4.5'), memberId: '001013' } }),
    { ok: false, motivo: MOTIVI.LIVELLO_LONTANO },
  );
});

test('19. il posto si conta ADESSO: a quattro non si entra', () => {
  assert.deepEqual(
    ingressoBuono({ giocatoriInCampo: GIOCATORI_PARTITA }),
    { ok: false, motivo: MOTIVI.AL_COMPLETO },
  );
  assert.deepEqual(ingressoBuono({ giocatoriInCampo: 3 }), { ok: true });
});

test('20. chi c\'è già legge «ci sei già», non «non entri»', () => {
  assert.deepEqual(
    ingressoBuono({ giaInPartita: true }),
    { ok: false, motivo: MOTIVI.GIA_IN_PARTITA },
  );
});

// ── 6. ⭐ L'ORDINE dei rifiuti — ogni motivo è una frase che qualcuno legge ─

test('21. ⭐ di una partita NON APERTA non si dice altro, nemmeno che è piena', () => {
  // Se `al_completo` uscisse per primo, il socio saprebbe che quella partita esiste e che è
  // di quattro persone: è la serratura della regola ① aperta di uno spiraglio.
  const esito = decidiIngresso({
    aperta: false,
    organizzatore: conLivello('3'),
    candidato: { ...conLivello('3'), memberId: '001013' },
    giocatoriInCampo: GIOCATORI_PARTITA,
    giaInPartita: false,
    clienteDelCircolo: false,
  });
  assert.deepEqual(esito, { ok: false, motivo: MOTIVI.NON_APERTA });
});

test('22. ⭐⭐ a chi non ha il livello NON si dice «sei di un altro livello»', () => {
  // `serve_il_test` deve battere `livello_lontano`: la seconda è un'affermazione su un
  // numero che nessuno ha mai misurato, cioè una frase falsa detta a 2.283 persone.
  const esito = ingressoBuono({ candidato: { ...senzaLivello, memberId: '001013' } });
  assert.deepEqual(esito, { ok: false, motivo: MOTIVI.SERVE_IL_TEST });
});

test('23. e la porta della regola ③ viene PRIMA di quella del livello', () => {
  // Chi non è cliente del circolo non entra comunque: proporgli il test lo manderebbe a
  // fare venti domande per poi trovare la stessa porta chiusa un passo più in là.
  const esito = ingressoBuono({
    clienteDelCircolo: false,
    candidato: { ...senzaLivello, memberId: '' },
  });
  assert.deepEqual(esito, { ok: false, motivo: MOTIVI.NON_CLIENTE });
});

// ── 7. Le costanti che attraversano il confine ─────────────────────────────

test('24. il tipo di record non è uno di quelli che l\'app scarica', () => {
  assert.equal(TIPO_RECORD_APERTURA, 'partita_aperta');
  // L'app chiede ['booking','booking_occupancy','matchpoint_data','staff_booking',
  // 'staff_suppress'] (index.html): un tipo fuori da quella lista non la può disturbare.
  assert.equal(
    ['booking', 'booking_occupancy', 'matchpoint_data', 'staff_booking', 'staff_suppress']
      .includes(TIPO_RECORD_APERTURA),
    false,
  );
});

console.log(`\n${passed} verdi · ${failed} rossi`);
if (failed > 0) process.exit(1);
