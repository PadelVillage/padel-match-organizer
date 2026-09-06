/* 👛 «La fotografia del saldo» — banco della voce 143.
 *
 * 🎯 COSA DIFENDE, e nessuna di queste si vede rileggendo il codice:
 *   ① la **chiave è quella del sync** (`wbal|<memberLocalId>`) — una chiave diversa farebbe
 *      nascere DUE record `wallet_balance` per lo stesso socio, e l'app ne mostrerebbe uno a caso;
 *   ② senza `memberLocalId` **non si scrive**: una riga con una chiave inventata dal codice
 *      Matchpoint il sync non la ritroverebbe mai ⇒ un saldo fantasma che non si aggiorna più;
 *   ③ un saldo **non numerico** non si scrive: un `null` messo come saldo direbbe «zero» a chi
 *      legge, e zero su un borsellino è un'informazione, non un'assenza;
 *   ④ un saldo **negativo** si rifiuta: Matchpoint non li tiene, quindi sotto zero vuol dire
 *      lettura andata storta — scriverlo farebbe apparire un debito che non esiste;
 *   ⑤ **zero SI scrive**: è il caso del borsellino svuotato da uno storno, ed è la differenza fra
 *      «non ha più credito» e «non lo so» — che è tutto il punto della voce.
 *
 * ⛔ QUELLO CHE NON DICE: che il numero arrivi sullo schermo della segreteria. Dice che la regola
 *    è quella giusta. Che il saldo si veda cambiato lo dice solo una ricarica vera su PROD.
 *
 *   ⑥ la **provenienza** (`source`) dice per quale delle due strade è arrivato il numero — la
 *      ricarica che il saldo dopo ce l'ha in mano, o la rilettura dopo un pagamento col
 *      borsellino, dove il saldo dopo non c'è. Un valore inventato ricade sul default invece di
 *      finire in archivio come una parola che nessuna sonda cerca.
 *
 * Esegui:  deno test --allow-read supabase/functions/_shared/fotografia-saldo.test.ts
 */
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { decidiFotografiaSaldo } from './fotografia-saldo.ts';

const ADESSO = '2026-09-06T18:30:00.000Z';
const base = { memberLocalId: 'm-123', codice: '000042', playerName: 'Maurizio Aprea', adessoIso: ADESSO };

Deno.test('① la chiave è quella del sync: wbal|<memberLocalId>', () => {
  const e = decidiFotografiaSaldo({ ...base, balancePost: 100 });
  assert(e.scrivi);
  assertEquals(e.localKey, 'wbal|m-123');
});

Deno.test('② senza memberLocalId non si scrive (un saldo fantasma è peggio di nessun saldo)', () => {
  for (const v of [undefined, null, '', '   ']) {
    const e = decidiFotografiaSaldo({ ...base, memberLocalId: v, balancePost: 100 });
    assert(!e.scrivi);
    assertEquals(e.motivo, 'MEMBER_LOCAL_ID_MANCANTE');
  }
});

Deno.test('③ un saldo non numerico non si scrive: «non lo so» non è «zero»', () => {
  for (const v of [null, undefined, '100', NaN, Infinity, {}]) {
    const e = decidiFotografiaSaldo({ ...base, balancePost: v });
    assert(!e.scrivi, `atteso rifiuto per ${JSON.stringify(v)}`);
    assertEquals(e.motivo, 'SALDO_POST_IGNOTO');
  }
});

Deno.test('④ un saldo negativo si rifiuta: sarebbe un debito che non esiste', () => {
  const e = decidiFotografiaSaldo({ ...base, balancePost: -50 });
  assert(!e.scrivi);
  assertEquals(e.motivo, 'SALDO_NEGATIVO');
});

Deno.test('⑤ ZERO si scrive: è il borsellino svuotato, non un dato mancante', () => {
  const e = decidiFotografiaSaldo({ ...base, balancePost: 0 });
  assert(e.scrivi);
  assertEquals((e.payload as { balance_cents: number }).balance_cents, 0);
});

Deno.test('i campi sono quelli del sync, e `source` dice da dove viene il valore', () => {
  const e = decidiFotografiaSaldo({ ...base, balancePost: 1234 });
  assert(e.scrivi);
  assertEquals(Object.keys(e.payload).sort(), [
    'balance_cents', 'id_cliente', 'member_local_id', 'player_name', 'source', 'synced_at',
  ]);
  assertEquals(e.payload.member_local_id, 'm-123');
  assertEquals(e.payload.id_cliente, '000042');
  assertEquals(e.payload.balance_cents, 1234);
  // ⚖️ Non 'matchpoint': questa fotografia nasce da un gesto, non dal report. Distinguerle è ciò
  //    che permette di sapere, guardando una riga, se il numero viene da una cassa o da un giro.
  assertEquals(e.payload.source, 'pmo_wallet_correct');
  assertEquals(e.payload.synced_at, ADESSO);
});

Deno.test('senza codice il campo resta null, non la stringa vuota', () => {
  const e = decidiFotografiaSaldo({ ...base, codice: '', balancePost: 10 });
  assert(e.scrivi);
  assertEquals(e.payload.id_cliente, null);
});

Deno.test('⭐ il caso della prova su PROD: 1 € sul borsellino, saldo dopo 100 centesimi', () => {
  // 📏 È il gesto che il committente ha autorizzato il 06/09 per chiudere la voce.
  const e = decidiFotografiaSaldo({ ...base, balancePost: 100 });
  assert(e.scrivi);
  assertEquals(e.localKey, 'wbal|m-123');
  assertEquals((e.payload as { balance_cents: number }).balance_cents, 100);
  // 🚨 E nessun campo in più: il payload deve poter essere sovrascritto dal sync senza che la
  //    riga «cambi» per un campo che solo noi scriviamo — sarebbe la voce 160 in miniatura.
  assertEquals(Object.keys(e.payload).length, 6);
});

/* ── ⑥ LA PROVENIENZA — entrata il 06/09 sera con la seconda metà della voce 143 ────────────── */

Deno.test('⑥ chi non dichiara la provenienza resta il chiamante di sempre (la ricarica)', () => {
  const e = decidiFotografiaSaldo({ ...base, balancePost: 100 });
  assert(e.scrivi);
  assertEquals(e.payload.source, 'pmo_wallet_correct');
});

Deno.test('⑥ la rilettura dopo un pagamento col borsellino si dichiara, e si distingue', () => {
  const e = decidiFotografiaSaldo({ ...base, balancePost: 100, source: 'pmo_wallet_read' });
  assert(e.scrivi);
  assertEquals(e.payload.source, 'pmo_wallet_read');
  // 🔑 …e la CHIAVE resta la stessa: le due strade scrivono sullo stesso record, o il socio
  //    avrebbe due saldi e l'app ne mostrerebbe uno a caso.
  assertEquals(e.localKey, 'wbal|m-123');
  assertEquals(Object.keys(e.payload).length, 6);
});

Deno.test('⑥ una provenienza inventata NON finisce in archivio: ricade sul default', () => {
  for (const v of ['matchpoint', 'worker', '', 'PMO_WALLET_READ', null]) {
    const e = decidiFotografiaSaldo({ ...base, balancePost: 100, source: v as never });
    assert(e.scrivi);
    assertEquals(e.payload.source, 'pmo_wallet_correct',
      `una provenienza fuori dai due valori previsti deve ricadere sul default, ricevuto ${JSON.stringify(v)}`);
  }
});

Deno.test('⭐ il caso della prova di lunedì 7/09, coi dati veri della partita delle 10:30', () => {
  /* 📏 Copiati dall'archivio di PROD il 06/09, non inventati (lezione della 138: *un caso di
     prova si copia dai dati, non dall'idea che se ne ha*): Maurizio Aprea ha id interno `4` nel
     roster della prenotazione 9844, e `member_local_id` `7d454239…` in anagrafica. Il pagamento
     col borsellino gli toglie il dovuto, e la rilettura scrive QUEL saldo su QUELLA chiave. */
  const e = decidiFotografiaSaldo({
    memberLocalId: '7d454239-929a-4346-8ba0-ec778d7763a3',
    codice: '4',
    playerName: 'Maurizio Aprea',
    balancePost: 0,
    adessoIso: ADESSO,
    source: 'pmo_wallet_read',
  });
  assert(e.scrivi);
  assertEquals(e.localKey, 'wbal|7d454239-929a-4346-8ba0-ec778d7763a3');
  // ⑤ ZERO si scrive: dopo un pagamento che svuota il borsellino, «non ha più credito» non è
  //    «non lo so» — ed è esattamente il numero che la segreteria deve vedere in cassa.
  assertEquals(e.payload.balance_cents, 0);
  assertEquals(e.payload.id_cliente, '4');
  assertEquals(e.payload.source, 'pmo_wallet_read');
});
