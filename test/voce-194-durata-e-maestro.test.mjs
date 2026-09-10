// ── BANCO: I DUE GESTI NUOVI — «durata» e «maestro» (voce 194 ②) ──────────────────
//
// 🗣️ Sua richiesta del 10/09/2026: «bisogna attivare le notifiche sul chatbot quando c'è
//    qualsiasi operazione», col criterio che ha approvato lui: **si avvisa se il socio deve
//    comportarsi diversamente**, non se è cambiato un campo.
//
// ⛔ IL TERZO GESTO APPROVATO — partita ↔ lezione — NON È QUI, per una misura: quel gesto non
//    esiste (il tipo si sceglie solo in creazione, e in 3621 prenotazioni non è mai cambiato,
//    con lo stesso conto che sulle durate ne trova 18 come controllo negativo).
//
// 🚨⭐⭐ IL CASO PIÙ IMPORTANTE DI QUESTO FILE È `statoFinale` CON `['durata']`, e non riguarda
//    nessuno dei pezzi nuovi: riguarda un pezzo VECCHIO che riceve una parola per cui non era
//    stato scritto. È una macchina «dentro o fuori», e a una domanda che non è quella rispondeva
//    lo stesso — con una risposta della stessa forma di una giusta: **`tolto`**.
//
// Uso:  node --experimental-strip-types test/voce-194-durata-e-maestro.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fattiDaDurata,
  fattiDaMaestro,
  soloLaDurataECambiata,
} from '../supabase/functions/_shared/fatti-da-conferma.ts';
import { riduci, statoFinale } from '../supabase/functions/consumer-staff-events/riduzione.ts';

const OGGI = '2026-09-10';
const SLOT = { data: '2026-09-15', ora: '09:00', campo: 'Campo 4' };
const ROSTER = ['Maurizio Aprea', 'Lidia Comes', 'Ospite'];

// ══════════════════════════════════════════════════════════════════════════════════
// 🚨 ① IL CASO CHE VALE PIÙ DI TUTTI: un cambio di durata NON è un'uscita
// ══════════════════════════════════════════════════════════════════════════════════

test('🚨 `statoFinale([durata])` dice «durata», NON «tolto»', () => {
  // ⛔ Col codice di prima: `suoi = ['durata']` ⇒ eraDentro=true, eDentro=false ⇒ 'tolto'.
  //    Al socio sarebbe arrivato «Non sei più nella partita» per una partita allungata.
  assert.equal(statoFinale(['durata']), 'durata');
  assert.equal(statoFinale(['maestro']), 'maestro');
});

test('🚨 e nemmeno in coppia, che è il caso della raffica', () => {
  assert.equal(statoFinale(['durata', 'durata']), 'durata');
  assert.equal(statoFinale(['durata', 'maestro']), 'maestro', 'vince l\'ultimo della partita');
});

test('✅ e i cinque gesti di prima rispondono ESATTAMENTE come rispondevano', () => {
  // 🚨 Il controllo che impedisce alla cura di essere una regressione travestita: la tabella
  //    qui sotto è il comportamento di ieri, riga per riga.
  assert.equal(statoFinale(['aggiunto']), 'aggiunto');
  assert.equal(statoFinale(['tolto']), 'tolto');
  assert.equal(statoFinale(['annullata']), 'annullata');
  assert.equal(statoFinale(['spostata']), 'spostata');
  assert.equal(statoFinale(['formazione']), 'formazione');
  assert.equal(statoFinale(['tolto', 'aggiunto']), null, 'il tolto-e-rimesso resta muto');
  /* 🩹 QUESTA RIGA DICEVA `'tolto'`, E LA SBAGLIATA ERA L'ASSERZIONE — non il codice.
   * Entrato e uscito nella stessa raffica è **netto nullo**: il socio non ha mai saputo di
   * essere dentro, quindi non c'è niente da dirgli. Il caso ha fatto il suo mestiere prima di
   * essere giusto — ha accusato la cura, e a essere sbagliata era l'idea che avevo io.
   * 📏 Verificato eseguendo il `statoFinale` di PARTENZA sugli stessi 15 casi: **0 cambiano
   * risposta**, cioè la cura è additiva sul vocabolario vecchio. */
  assert.equal(statoFinale(['aggiunto', 'tolto']), null);
  assert.equal(statoFinale(['spostata', 'formazione']), 'spostata');
  assert.equal(statoFinale(['aggiunto', 'formazione']), 'aggiunto');
  assert.equal(statoFinale(['aggiunto', 'spostata']), 'spostata');
  assert.equal(statoFinale(['annullata', 'aggiunto']), null);
  assert.equal(statoFinale([]), null);
});

test('⚖️ a chi è stato TOLTO non importa fino a che ora si gioca: vince il gesto suo', () => {
  assert.equal(statoFinale(['durata', 'tolto']), 'tolto');
  assert.equal(statoFinale(['maestro', 'annullata']), 'annullata');
  assert.equal(statoFinale(['durata', 'spostata']), 'spostata');
});

test('⭐ ma nel «tolto e rimesso» l\'allungamento NON si perde più', () => {
  // 🚨 Prima questa riga sapeva solo di `formazione`: un allungamento nella stessa raffica
  //    veniva chiuso come «niente da dire» — il modo più silenzioso di perdere un fatto.
  assert.equal(statoFinale(['tolto', 'aggiunto', 'durata']), 'durata');
  assert.equal(statoFinale(['tolto', 'aggiunto', 'formazione']), 'formazione', 'e la formazione regge');
});

// ══════════════════════════════════════════════════════════════════════════════════
// 🔀 ② LO STESSO `move` PORTA DUE GESTI
// ══════════════════════════════════════════════════════════════════════════════════

test('🔀 stesso posto e stessa ora d\'inizio ⇒ è una DURATA, non uno spostamento', () => {
  assert.equal(soloLaDurataECambiata(SLOT, { ...SLOT }), true);
});

test('🔀 e il campo scritto in due modi è lo STESSO campo', () => {
  // 🚨 La stessa partita esiste in copie che scrivono «Campo 4» e «4»: un confronto sul testo
  //    direbbe «si è spostata» di una partita che non si è mossa di un metro.
  assert.equal(soloLaDurataECambiata(SLOT, { ...SLOT, campo: '4' }), true);
});

test('🔀 se si muove qualcosa è uno SPOSTAMENTO, e vince lui', () => {
  assert.equal(soloLaDurataECambiata(SLOT, { ...SLOT, ora: '10:00' }), false);
  assert.equal(soloLaDurataECambiata(SLOT, { ...SLOT, data: '2026-09-16' }), false);
  assert.equal(soloLaDurataECambiata(SLOT, { ...SLOT, campo: 'Campo 1' }), false);
});

test('🔀 partenza incompleta ⇒ si tratta come spostamento (il ramo di prima)', () => {
  assert.equal(soloLaDurataECambiata({ data: '', ora: '09:00', campo: '4' }, SLOT), false);
  assert.equal(soloLaDurataECambiata({ data: '2026-09-15', ora: '', campo: '4' }, SLOT), false);
});

// ══════════════════════════════════════════════════════════════════════════════════
// ⏱️ ③ I FATTI DELLA DURATA
// ══════════════════════════════════════════════════════════════════════════════════

test('⏱️ un fatto per ciascuno di quelli in campo, con la coppia di orari', () => {
  const f = fattiDaDurata({ slot: SLOT, fine: '11:00', finePrima: '10:30', roster: ROSTER, oggi: OGGI });
  assert.equal(f.length, 2, 'l\'ospite non riceve messaggi');
  assert.deepEqual(f.map((x) => x.gesto), ['durata', 'durata']);
  assert.equal(f[0].fine, '11:00');
  assert.equal(f[0].fine_prima, '10:30');
  // 🚨 I nomi sono NOMI DI COLONNA: questi oggetti finiscono nel database per spread. Un
  //    `finePrima` in camelCase farebbe fallire l'insert dell'intero lotto — cioè perderebbe
  //    l'avviso, non solo quel campo.
  assert.ok(!('finePrima' in f[0]), 'camelCase: l\'insert fallirebbe in blocco');
});

test('⏱️ il «prima» UGUALE al «dopo» non si manda: non descrive niente di successo', () => {
  const f = fattiDaDurata({ slot: SLOT, fine: '11:00', finePrima: '11:00', roster: ROSTER, oggi: OGGI });
  assert.ok(!('fine_prima' in f[0]), 'direbbe «allungata» di zero minuti');
});

test('⏱️ un «prima» che non è un orario si butta, e il fatto NASCE lo stesso', () => {
  const f = fattiDaDurata({ slot: SLOT, fine: '11:00', finePrima: 'boh', roster: ROSTER, oggi: OGGI });
  assert.equal(f.length, 2);
  assert.ok(!('fine_prima' in f[0]));
});

test('⏱️ ma senza il «dopo» NON nasce niente: resterebbe un invito a telefonare', () => {
  assert.deepEqual(fattiDaDurata({ slot: SLOT, fine: '', finePrima: '10:30', roster: ROSTER, oggi: OGGI }), []);
  assert.deepEqual(fattiDaDurata({ slot: SLOT, fine: '25:99', roster: ROSTER, oggi: OGGI }), []);
});

test('⏱️ una partita GIÀ GIOCATA non produce fatti — come tutte le sorelle', () => {
  const f = fattiDaDurata({ slot: { ...SLOT, data: '2026-09-01' }, fine: '11:00', roster: ROSTER, oggi: OGGI });
  assert.deepEqual(f, []);
});

// ══════════════════════════════════════════════════════════════════════════════════
// 👨‍🏫 ④ I FATTI DEL MAESTRO
// ══════════════════════════════════════════════════════════════════════════════════

test('👨‍🏫 col nome, e con la parola del gestionale sul tipo', () => {
  const f = fattiDaMaestro({ slot: SLOT, maestro: 'Marco Rossi', roster: ROSTER, tipo: 'Lezione Libera', oggi: OGGI });
  assert.equal(f.length, 2);
  assert.equal(f[0].gesto, 'maestro');
  assert.equal(f[0].maestro, 'Marco Rossi');
  // 🔒 Al bot non arriva MAI il tipo di Matchpoint: «Lezione Libera» è una parola sua.
  assert.equal(f[0].tipo, 'lezione');
});

test('👨‍🏫 senza il nome il fatto nasce lo stesso, e il campo NON c\'è', () => {
  // ⚖️ Al socio si dirà «è cambiato il maestro» senza dire chi: un nome inventato lo manderebbe
  //    a cercare la persona sbagliata. Ma il fatto che è cambiato resta una notizia vera.
  const f = fattiDaMaestro({ slot: SLOT, maestro: '  ', roster: ROSTER, oggi: OGGI });
  assert.equal(f.length, 2);
  assert.ok(!('maestro' in f[0]), 'un campo vuoto in colonna farebbe dire «Adesso è .»');
});

// ══════════════════════════════════════════════════════════════════════════════════
// 🌊 ⑤ LA RAFFICA: i due capi, non l'ultimo fatto
// ══════════════════════════════════════════════════════════════════════════════════

function inCoda(i, extra) {
  return {
    id: `id${i}`, slot: '2026-09-15|09:00|4', data: '2026-09-15', ora: '09:00', campo: 'Campo 4',
    persona: 'Maurizio Aprea', gesto: 'durata', origine: 'conferma',
    visto_at: new Date(Date.now() - 3600_000).toISOString(), ...extra,
  };
}

test('🌊 due allungamenti di fila: «adesso» dall\'ultimo, «prima» dal PRIMO', () => {
  // 📏 Il caso: 10:30 → 11:00 → 11:30 nello stesso giro. Dall'ultimo fatto uscirebbe «da 11:00
  //    a 11:30» — vero di un pezzo e falso del gesto: il socio aveva in testa 10:30, e le
  //    11:00 non le ha mai sapute.
  const out = riduci([
    inCoda(1, { fine: '11:00', fine_prima: '10:30' }),
    inCoda(2, { fine: '11:30', fine_prima: '11:00' }),
  ], Date.now());
  assert.equal(out.length, 1, 'la raffica si fonde in una notizia sola');
  assert.equal(out[0].gesto, 'durata');
  assert.equal(out[0].fine, '11:30');
  assert.equal(out[0].fine_prima, '10:30');
  assert.deepEqual(out[0].ids, ['id1', 'id2'], 'tutte e due le righe si chiudono');
});

test('🌊 e su un gesto che non è «durata» quei campi non compaiono affatto', () => {
  const out = riduci([inCoda(1, { gesto: 'annullata', fine: '11:00' })], Date.now());
  assert.equal(out[0].gesto, 'annullata');
  assert.ok(!('fine' in out[0]), 'un campo pieno dove non serve fa credere che serva');
});

test('🌊 due maestri di fila: si dice l\'ULTIMO, i nomi in mezzo non sono mai stati veri', () => {
  const out = riduci([
    inCoda(1, { gesto: 'maestro', maestro: 'Marco Rossi' }),
    inCoda(2, { gesto: 'maestro', maestro: 'Anna Bianchi' }),
  ], Date.now());
  assert.equal(out[0].gesto, 'maestro');
  assert.equal(out[0].maestro, 'Anna Bianchi');
});

// ══════════════════════════════════════════════════════════════════════════════════
// 🗄️ ⑥ LA COPIA LOCALE GUARDA TUTT'E DUE I CASSETTI
//
// 🚨⭐⭐ NON È UN CONTORNO DELLA VOCE: È LA STRADA SU CUI LA VOCE DOVEVA SALIRE.
// 📏 Misurato su `cudi` il 10/09 prima di toccare una riga: le 288 righe `booking` sono ferme
//    al **07/09 15:32** (l'ultimo giro di sync prima che le sei routine venissero tolte),
//    mentre le `staff_booking` erano state aggiornate **quella mattina**. ⇒ Guardando solo
//    `booking`, ogni prenotazione nata dopo l'08/09 è invisibile — e con lei `spostata` e
//    `formazione`, che viaggiano sulla stessa funzione ed erano **già mute**, in silenzio.
// ══════════════════════════════════════════════════════════════════════════════════

import { rosterDaCopiaLocale } from '../supabase/functions/_shared/dichiara-fatti.ts';

/** Un client finto: risponde con le righe che gli si danno, e dice cosa gli è stato chiesto. */
function clienteFinto(righe) {
  const chiesto = { tipi: null };
  const q = {
    select: () => q,
    in: (_c, v) => { chiesto.tipi = v; return q; },
    eq: () => q,
    then: (ok) => ok({ data: righe, error: null }),
  };
  return { client: { from: () => q }, chiesto };
}

const VIVA = {
  record_type: 'staff_booking',
  payload: {
    data: '2026-09-15', ora: '09:00', campo: '4', tipo: 'lezione',
    durata: 90, ora_fine: '10:30', istruttore: 'Marco Rossi',
    // ⭐ La forma NATURALE dei giocatori: `{ nome, codice }`. È esattamente quella che il banco
    //    della 194 ① ha trovato diventare '[object Object]' in silenzio.
    giocatori: [{ nome: 'Maurizio Aprea', codice: '000004' }, { nome: 'Lidia Comes' }],
  },
};

test('🗄️ una riga del cassetto VIVO si trova, e il roster esce dai «giocatori»', async () => {
  const { client, chiesto } = clienteFinto([VIVA]);
  const s = await rosterDaCopiaLocale({ client, data: '2026-09-15', ora: '09:00', campo: 4 });
  assert.ok(s, 'la prenotazione nata dopo l\'08/09 era invisibile');
  assert.deepEqual(s.roster, ['Maurizio Aprea', 'Lidia Comes']);
  assert.deepEqual(chiesto.tipi, ['booking', 'staff_booking'], 'guarda un cassetto solo');
  assert.equal(s.fine, '10:30');
  assert.equal(s.istruttore, 'Marco Rossi');
});

test('🗄️⏱️ senza `ora_fine` la fine si CALCOLA — e «1.5» sono 90 minuti, non 1,5', () => {
  // 🚨 `durata` ha DUE unità con lo stesso nome, misurate su `cudi` il 10/09: `booking` la
  //    scrive in ORE (1.5 · 2 · 1), `staff_booking` in MINUTI (90 · 60 · 120). Leggerla come
  //    minuti darebbe a una partita di un'ora e mezza una durata di un minuto e mezzo, e l'ora
  //    di fine sarebbe quella d'inizio: un messaggio che sembra giusto e non lo è.
  const casi = [
    { durata: '1.5', atteso: '10:30' },   // booking: ore
    { durata: '2', atteso: '11:00' },     // booking: ore
    { durata: 90, atteso: '10:30' },      // staff_booking: minuti
    { durata: 120, atteso: '11:00' },     // staff_booking: minuti
  ];
  return Promise.all(casi.map(async ({ durata, atteso }) => {
    const riga = { record_type: 'booking', payload: { ...VIVA.payload, durata, ora_fine: undefined } };
    const { client } = clienteFinto([riga]);
    const s = await rosterDaCopiaLocale({ client, data: '2026-09-15', ora: '09:00', campo: 4 });
    assert.equal(s.fine, atteso, `durata ${durata} letta male`);
  }));
});

test('🗄️ il campo scritto «Campo 4» e «4» è lo stesso campo', async () => {
  const riga = { record_type: 'booking', payload: { ...VIVA.payload, campo: 'Campo 4', descrizione: '-Maurizio Aprea.-Lidia Comes.' } };
  const { client } = clienteFinto([riga]);
  const s = await rosterDaCopiaLocale({ client, data: '2026-09-15', ora: '09:00', campo: 4 });
  assert.ok(s, 'un filtro sul testo esatto avrebbe reso zero righe, in silenzio');
});

test('🗄️ fra due copie della stessa partita vince il roster PIÙ COMPLETO', async () => {
  const magra = { record_type: 'staff_booking', payload: { ...VIVA.payload, giocatori: [{ nome: 'Maurizio Aprea' }] } };
  const { client } = clienteFinto([magra, VIVA]);
  const s = await rosterDaCopiaLocale({ client, data: '2026-09-15', ora: '09:00', campo: 4 });
  assert.equal(s.roster.length, 2, 'le righe sono la stessa partita ripetuta, non pezzi da sommare');
});

test('🗄️ un titolo libero senza roster non è un roster', async () => {
  const titolo = { record_type: 'booking', payload: { data: '2026-09-15', ora: '09:00', campo: '4', descrizione: 'Torneo aziendale' } };
  const { client } = clienteFinto([titolo]);
  assert.equal(await rosterDaCopiaLocale({ client, data: '2026-09-15', ora: '09:00', campo: 4 }), null);
});

// ══════════════════════════════════════════════════════════════════════════════════
// 🎯 ⑦ LA STRADA NATIVA DICHIARA — il buco che il banco NON aveva preso
//
// 🚨⭐⭐ QUESTO CASO NASCE DA UNA PROVA FISICA ANDATA STORTA, non da una rilettura. Una
//    modifica vera su `cudi` è passata (`ok: true`, `nativa: true`) e in `pmo_eventi_staff`
//    non è nato NIENTE: le dichiarazioni stavano tutt'e due le volte **dopo** la chiamata al
//    worker, e su quel gestionale il worker non si chiama mai.
// 🎯 E non è un dettaglio di TEST: la strada nativa è quella che dopo il distacco sarà
//    l'UNICA. Un avviso che vive solo sul ramo del worker muore con Matchpoint — cioè
//    esattamente ciò che la voce 76 esisteva per evitare, lasciato su metà dei rami.
// 📌 *Un banco che prova le funzioni non prova le STRADE: queste tre erano tutte giuste, e
//    non le percorreva nessuno.*
// ══════════════════════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const QUI = dirname(fileURLToPath(import.meta.url));

/** 🚨 Senza i commenti: la cura porta accanto a sé un commento che cita il difetto per dire
 *  che l'ha tolto, e un controllo testuale lo leggerebbe come se fosse ancora vivo. */
function senzaCommenti(t) {
  let out = '', i = 0, str = null, prec = '';
  while (i < t.length) {
    const c = t[i], n = t[i + 1];
    if (str) { out += c; if (c === str && prec !== '\\') str = null; prec = (prec === '\\' && c === '\\') ? '' : c; i++; continue; }
    if (c === '/' && n === '/') { const f = t.indexOf('\n', i); i = f < 0 ? t.length : f; continue; }
    if (c === '/' && n === '*') { const f = t.indexOf('*/', i + 2); i = f < 0 ? t.length : f + 2; continue; }
    if (c === '"' || c === "'" || c === '`') str = c;
    out += c; prec = c; i++;
  }
  return out;
}

/** Il corpo del ramo nativo che REGISTRA: da `esitoNativo(azione)` al suo `return ok(`.
 *
 * 🩹⭐ QUESTA FUNZIONE È STATA RIFATTA, e la prima versione era il difetto ② del passaggio di
 * consegne — *una sonda che guarda più larga del suo bersaglio non è più severa: è sbagliata*.
 * Ritagliava da `!scritturaAlCircoloConsentita`, che in `cancel` compare **due** volte: la
 * prima è il ramo ASINCRONO, che non registra niente e si limita a rifiutare. Il perimetro
 * prendeva quello, correva fino a un `return ok(` lontanissimo, e falliva su una cura che c'era.
 * ⇒ Si àncora sul **blocco** — `esitoNativo(azione)` è la riga che identifica il ramo che
 * scrive davvero — non sulla distanza. */
function ramoNativo(nudo, azione) {
  const da = nudo.indexOf(`esitoNativo('${azione}')`);
  assert.ok(da > 0, `il ramo nativo di ${azione} non si trova più: il perimetro va rifatto`);
  const a = nudo.indexOf('return ok({', da);
  assert.ok(a > da, 'il ramo nativo non ha un `return ok(`');
  return nudo.slice(da, a);
}

test('🎯 la strada NATIVA di `edit` dichiara tutt\'e tre le cose al socio', () => {
  const nudo = senzaCommenti(readFileSync(join(QUI, '..', 'supabase/functions/matchpoint-bookings-edit/index.ts'), 'utf8'));
  const ramo = ramoNativo(nudo, 'edit');
  for (const f of ['rosterPrimaDelloSpostamento', 'dichiaraSpostamentoAlSocio', 'dichiaraCambioRosterAlSocio', 'dichiaraCambioMaestroAlSocio']) {
    assert.ok(ramo.includes(f), `la strada nativa non chiama ${f}: su questo gestionale nessuno lo dice al socio`);
  }
});

test('🎯 e quella di `cancel` pure — ed è il silenzio che costa di più', () => {
  const nudo = senzaCommenti(readFileSync(join(QUI, '..', 'supabase/functions/matchpoint-bookings-cancel/index.ts'), 'utf8'));
  const ramo = ramoNativo(nudo, 'cancel');
  assert.ok(ramo.includes('dichiaraAnnulloAlSocio'),
    'un annullo che non si dice manda qualcuno al campo per una partita che non esiste');
  // 🚨⭐ L'ORDINE: il roster si legge PRIMA della riga che seppellisce la copia locale. Leggendo
  //    dopo si troverebbe una tomba, cioè zero destinatari — un annullo che continua a non dirsi.
  const iLettura = ramo.indexOf('rosterPrimaDellAnnullo');
  const iTomba = ramo.indexOf('spegniPartiteNativeSulloSlot');
  assert.ok(iLettura > 0 && iTomba > 0, 'il ramo nativo non ha più le due chiamate');
  assert.ok(iLettura < iTomba, 'si legge DOPO aver seppellito la copia: il roster sarebbe vuoto');
});
