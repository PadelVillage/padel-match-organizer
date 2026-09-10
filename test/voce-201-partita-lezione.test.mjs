// ── BANCO: L'OTTAVO GESTO — partita ↔ lezione (voce 201) ──────────────────────────
//
// 🗣️ Sua richiesta del 10/09/2026: «partita ↔ lezione — quel gesto non esiste, e se lo vuoi il
//    lavoro è prima creare l'operazione.. si lo voglio».
//
// 🚨⭐⭐ IL CASO PIÙ IMPORTANTE DI QUESTO FILE È `statoFinale(['tipo'])`, ed è la ripetizione
//    ESATTA della trappola che la voce 194 aveva già pagato una volta: la macchina «dentro o
//    fuori» risponde anche a una domanda che non è la sua, e la risposta ha la stessa forma di
//    una giusta — **`tolto`**. Al socio sarebbe arrivato «Non sei più nella partita» per una
//    partita diventata lezione, e sarebbe stato invisibile: banco del bot verde, vincolo del
//    database verde, edge verde.
//    📌 *Un gesto nuovo non si aggiunge dove lo si scrive: si aggiunge dove qualcuno lo LEGGE.*
//
// ⛔ COSA QUESTO BANCO NON DICE: che il gesto arrivi a un telefono. Questo è un banco.
//
// Uso:  node --experimental-strip-types test/voce-201-partita-lezione.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { fattiDaTipo } from '../supabase/functions/_shared/fatti-da-conferma.ts';
import { riduci, statoFinale } from '../supabase/functions/consumer-staff-events/riduzione.ts';

const OGGI = '2026-09-10';
const SLOT = { data: '2026-09-15', ora: '09:00', campo: 'Campo 4' };
const ROSTER = ['Maurizio Aprea', 'Lidia Comes', 'Ospite'];

// ══════════════════════════════════════════════════════════════════════════════════
// 🚨 ① IL CASO CHE VALE PIÙ DI TUTTI
// ══════════════════════════════════════════════════════════════════════════════════

test('🚨 `statoFinale([tipo])` dice «tipo», NON «tolto»', () => {
  assert.equal(statoFinale(['tipo']), 'tipo');
});

test('🚨 e nemmeno in raffica, né mescolato agli altri gesti della partita', () => {
  assert.equal(statoFinale(['tipo', 'tipo']), 'tipo');
  assert.equal(statoFinale(['durata', 'tipo']), 'tipo', 'vince l\'ultimo della partita');
  assert.equal(statoFinale(['tipo', 'maestro']), 'maestro');
});

test('✅ e i SETTE gesti di prima rispondono esattamente come rispondevano', () => {
  // 🚨 Il controllo che impedisce alla cura di essere una regressione travestita.
  assert.equal(statoFinale(['aggiunto']), 'aggiunto');
  assert.equal(statoFinale(['tolto']), 'tolto');
  assert.equal(statoFinale(['annullata']), 'annullata');
  assert.equal(statoFinale(['spostata']), 'spostata');
  assert.equal(statoFinale(['formazione']), 'formazione');
  assert.equal(statoFinale(['durata']), 'durata');
  assert.equal(statoFinale(['maestro']), 'maestro');
  assert.equal(statoFinale(['tolto', 'aggiunto']), null, 'il tolto-e-rimesso resta muto');
});

test('⚖️ un gesto SUO batte un gesto della partita: chi esce lo deve sapere', () => {
  // ⛔ Se il socio è stato tolto E la partita è diventata lezione, la notizia che lo riguarda
  //    è la prima. Dirgli «è diventata una lezione» di una partita che non è più sua sarebbe
  //    la regola del 23/08 rotta — «corretti fino in fondo».
  assert.equal(statoFinale(['tipo', 'tolto']), 'tolto');
  assert.equal(statoFinale(['tolto', 'tipo']), 'tolto');
});

// ══════════════════════════════════════════════════════════════════════════════════
// 🎭 ② IL FATTO
// ══════════════════════════════════════════════════════════════════════════════════

test('🎭 nasce un fatto per OGNI destinatario, col prima e col dopo', () => {
  const f = fattiDaTipo({ slot: SLOT, tipo: 'lezione', tipoPrima: 'partita', roster: ROSTER, oggi: OGGI });
  assert.equal(f.length, 2, 'l\'ospite non riceve messaggi, gli altri due sì');
  assert.equal(f[0].gesto, 'tipo');
  assert.equal(f[0].tipo, 'lezione');
  assert.equal(f[0].tipo_prima, 'partita');
});

test('⛔ senza il tipo NUOVO non nasce niente: «è cambiato il tipo» è un invito a telefonare', () => {
  assert.deepEqual(fattiDaTipo({ slot: SLOT, tipo: null, tipoPrima: 'partita', roster: ROSTER, oggi: OGGI }), []);
  assert.deepEqual(fattiDaTipo({ slot: SLOT, tipo: '', roster: ROSTER, oggi: OGGI }), []);
});

test('⛔ e se i due tipi sono UGUALI non è successo niente', () => {
  assert.deepEqual(fattiDaTipo({ slot: SLOT, tipo: 'lezione', tipoPrima: 'lezione', roster: ROSTER, oggi: OGGI }), []);
});

test('🩹 senza il «prima» il fatto nasce lo stesso, e dice solo cos\'è adesso', () => {
  const f = fattiDaTipo({ slot: SLOT, tipo: 'lezione', roster: ROSTER, oggi: OGGI });
  assert.equal(f.length, 2);
  assert.equal(f[0].tipo, 'lezione');
  assert.ok(!('tipo_prima' in f[0]), 'un «prima» inventato manderebbe una frase falsa');
});

test('👨‍🏫 il maestro viaggia SOLO verso la lezione', () => {
  const l = fattiDaTipo({ slot: SLOT, tipo: 'lezione', tipoPrima: 'partita', maestro: 'Marco Rossi', roster: ROSTER, oggi: OGGI });
  assert.equal(l[0].maestro, 'Marco Rossi');
  // ⛔ Su una partita un maestro non esiste: mandarlo sarebbe un dato che mente — il nodo
  //    esatto che il committente ha nominato aprendo il lavoro.
  const p = fattiDaTipo({ slot: SLOT, tipo: 'partita', tipoPrima: 'lezione', maestro: 'Marco Rossi', roster: ROSTER, oggi: OGGI });
  assert.ok(!('maestro' in p[0]), 'il maestro è rimasto appeso su una PARTITA');
});

test('🚨⭐ un tipo NON DICHIARATO vale «non lo so», non «partita»', () => {
  /* 📏 Questo caso nasce da un difetto vero della prima stesura, trovato da questo banco:
   * `tipoDelloSlot` non torna mai `null` (la sua regola è «assente ⇒ partita»), quindi
   *   · senza `tipoPrima` il fatto nasceva con un «prima» INVENTATO;
   *   · e il guardiano `if (!ora) return []` era codice MORTO.
   * ⇒ Due casi di questo file erano verdi **per la ragione sbagliata**: passavano perché il
   *   «prima» inventato coincideva col «dopo» inventato. Adesso il guardiano scatta davvero. */
  // Una parola che non è né l'una né l'altra: si tace, non si indovina.
  assert.deepEqual(fattiDaTipo({ slot: SLOT, tipo: 'colore', tipoPrima: 'partita', roster: ROSTER, oggi: OGGI }), []);
  // ⭐ E il caso che smaschera il codice morto: tipo nuovo assente, «prima» LEZIONE. Col
  //    lettore vecchio sarebbe nato «è diventata una partita», che nessuno aveva chiesto.
  assert.deepEqual(fattiDaTipo({ slot: SLOT, tipo: null, tipoPrima: 'lezione', roster: ROSTER, oggi: OGGI }), []);
});

test('🩹 un «prima» non dichiarato non blocca il fatto: lo lascia senza quel pezzo', () => {
  // ⚖️ I due «non lo so» hanno esiti OPPOSTI, ed è voluto: senza il tipo nuovo non c'è notizia,
  //    senza il vecchio la notizia c'è ed è più corta.
  const f = fattiDaTipo({ slot: SLOT, tipo: 'partita', tipoPrima: 'boh', roster: ROSTER, oggi: OGGI });
  assert.equal(f.length, 2);
  assert.equal(f[0].tipo, 'partita');
  assert.ok(!('tipo_prima' in f[0]));
});

test('🕰️ una partita GIÀ GIOCATA non produce fatti (voce 197)', () => {
  assert.deepEqual(
    fattiDaTipo({ slot: { ...SLOT, data: '2026-09-01' }, tipo: 'lezione', tipoPrima: 'partita', roster: ROSTER, oggi: OGGI }),
    [],
  );
});

test('🩹 «Lezione Libera» di Matchpoint vale «lezione»: la parola grezza si traduce', () => {
  // ⚖️ `tipoDelloSlot` è l'unico posto che traduce, e questo caso lo tiene legato: senza,
  //    una lezione arrivata dal sync non sarebbe riconosciuta e il gesto direbbe «partita».
  const f = fattiDaTipo({ slot: SLOT, tipo: 'Lezione Libera', tipoPrima: 'partita', roster: ROSTER, oggi: OGGI });
  assert.equal(f[0].tipo, 'lezione');
});

// ══════════════════════════════════════════════════════════════════════════════════
// 🔁 ③ LA RAFFICA
// ══════════════════════════════════════════════════════════════════════════════════

function inCoda(i, extra = {}) {
  return {
    id: 'f' + i, slot: 's1', data: SLOT.data, ora: SLOT.ora, campo: SLOT.campo,
    persona: 'Maurizio Aprea', gesto: 'tipo', tipo: 'lezione', origine: 'conferma',
    visto_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    ...extra,
  };
}

test('🔁 la coppia si prende ai DUE CAPI della raffica, non dall\'ultimo fatto', () => {
  /* 📏 Il caso: partita→lezione e poi lezione→partita nello stesso giro. Dall'ultimo fatto
   * uscirebbe «lezione → partita», che è vero di un pezzo e falso del gesto — il socio aveva
   * in testa **partita**. ⇒ `tipo` dall'ULTIMO, `tipo_prima` dal PRIMO. */
  const esiti = riduci([
    inCoda(1, { tipo: 'lezione', tipo_prima: 'partita' }),
    inCoda(2, { tipo: 'partita', tipo_prima: 'lezione' }),
  ], Date.now());
  assert.equal(esiti.length, 1, 'due fatti sullo stesso socio e slot sono UN messaggio');
  assert.equal(esiti[0].gesto, 'tipo');
  assert.equal(esiti[0].tipo, 'partita', 'il tipo è quello dell\'ULTIMO fatto');
  assert.equal(esiti[0].tipo_prima, 'partita', 'il «prima» è quello del PRIMO fatto');
  /* ⭐ E qui i due coincidono ⇒ a valle `testoStaffTipoCambiato` TACE, che è la cosa giusta:
   * la segreteria ha fatto e disfatto, e al socio non è successo niente. La cura non sta qui —
   * sta nel fatto che i due capi arrivano interi fino a chi decide. */
});

test('🔁 due cambi nello stesso verso: il «prima» resta quello di partenza', () => {
  const esiti = riduci([
    inCoda(1, { tipo: 'lezione', tipo_prima: 'partita' }),
    inCoda(2, { tipo: 'lezione', tipo_prima: 'lezione' }),
  ], Date.now());
  assert.equal(esiti[0].tipo_prima, 'partita');
  assert.equal(esiti[0].tipo, 'lezione');
});
