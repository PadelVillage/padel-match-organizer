// 🧾🚨 LA RICEVUTA DELL'ESITO IGNOTO — voce 83, 31/08/2026.
// Esegui:  node supabase/functions/consumer-booking-write/ricevuta-ignoto.test.ts
//
// 📏 IL DIFETTO, misurato la notte del 23/08 e terzo effetto di quella catena. L'annullo del
// socio è passato su Matchpoint, il gestionale l'ha classificato **fallito**, quindi nessuna
// ricevuta è stata scritta. Alle 23:47 il sync ha trovato la partita sparita e l'ha attribuita
// al circolo: al socio è arrivato *«La tua partita non c'è più — È stata annullata dal
// circolo»*, dieci minuti dopo che l'aveva annullata lui dal bot.
// ⇒ *Una ricevuta non scritta non protegge niente.*
//
// ⚖️ E QUESTO FILE ESISTE SOPRATTUTTO PER LA CURA CHE NON SI È FATTA. «Scrivi la ricevuta anche
// sull'ignoto, per tutti» è la mossa ovvia ed è sbagliata: su una scrittura riuscita il bot
// avvisa lui le persone toccate, e la ricevuta serve a non dire la stessa cosa due volte; sull'
// IGNOTO il bot non avvisa nessuno, perché non sa. Una ricevuta per tutti produrrebbe un
// **silenzio** — tre persone senza campo e senza notizia — che è la regola del 23/08 rovesciata.
// ⇒ Sull'ignoto la ricevuta copre **solo chi ha chiesto**. I casi qui sotto lo eseguono.
//
// ⛔ COSA NON PROVA, dichiarato: il cablaggio dentro `index.ts` (i tre punti che la scrivono e i
// due che non devono) è sorvegliato **testualmente**, in fondo. Quei rami si raggiungono solo
// con una scrittura vera verso il worker, che da un banco non parte.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mioNomeNelRoster } from './roster-slot.ts';
import { copertura, type Ricevuta } from '../consumer-staff-events/ricevute.ts';
import type { FattoInCoda } from '../consumer-staff-events/riduzione.ts';

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

// ── 1. Il nome del richiedente, com'è scritto dal gestionale ────────────────

test('mioNomeNelRoster torna il nome del GESTIONALE, non quello che abbiamo cercato', () => {
  // 🚨 È il punto in cui una ricevuta può nascere morta: a valle il confronto è per nome, e
  // «MAURIZIO APREA» in anagrafica contro «Maurizio Aprea» sulla scheda non si accoppiano.
  const chiavi = new Map([['maurizio aprea', 'Maurizio Aprea'], ['lidia comes', 'Lidia Comes']]);
  assert.equal(mioNomeNelRoster(chiavi, new Set(['maurizio aprea'])), 'Maurizio Aprea');
});

test('e torna undefined se in quel roster il socio non c\'è', () => {
  // ⭐ Serve: l'edge, davanti a undefined, NON scrive nessuna ricevuta. Una ricevuta col nome
  // sbagliato non copre il fatto giusto e potrebbe coprirne un altro.
  const chiavi = new Map([['lidia comes', 'Lidia Comes']]);
  assert.equal(mioNomeNelRoster(chiavi, new Set(['maurizio aprea'])), undefined);
});

// ── 2. La semantica che conta: chi viene coperto e chi no ───────────────────

const T0 = Date.parse('2026-08-23T21:37:28Z');   // il gesto vero della notte del 23/08
const iso = (ms: number) => new Date(ms).toISOString();
const SLOT = { data: '2026-08-31', ora: '09:00' };

let seqF = 0;
function fatto(persona: string, offsetMs: number): FattoInCoda {
  seqF += 1;
  return {
    id: `f${seqF}`,
    slot: `${SLOT.data}|${SLOT.ora}|1`,
    ...SLOT,
    campo: 'Campo 1',            // come lo scrive il sync di Matchpoint
    persona,
    gesto: 'annullata',
    visto_at: iso(T0 + offsetMs),
  };
}

function ricevutaAnnullo(persona: string, offsetMs: number): Ricevuta {
  return {
    id: `r-${persona}`,
    ...SLOT,
    campo: '1',                  // come lo scrive l'edge
    persona,
    gesto: 'annullata',
    scritta_at: iso(T0 + offsetMs),
  };
}

/** La partita di quella notte: chi annulla, più due compagni. */
const CHI_ANNULLA = 'Maurizio Aprea';
const COMPAGNI = ['Lidia Comes', 'Marco Aprea'];

test('🚨🚨 IL CASO DEL 23/08: a chi ha annullato il circolo NON lo riannuncia', () => {
  // 📏 10′07″ è la distanza vera fra il gesto (23:37:28) e l'avviso sbagliato (23:47:35).
  const fatti = [fatto(CHI_ANNULLA, 607_000)];
  const c = copertura(fatti, [ricevutaAnnullo(CHI_ANNULLA, 151_000)]);
  assert.equal(c.daConsegnare.length, 0, 'gli sarebbe arrivato «annullata dal circolo» su un gesto suo');
  assert.equal(c.coperti.length, 1);
});

test('⭐⭐ ma i COMPAGNI la notizia la ricevono: sull\'ignoto il bot non l\'ha data a nessuno', () => {
  // ⚖️ È il caso che boccia la cura ovvia. Con una ricevuta per tutto il roster questi due
  // fatti sparirebbero, e due persone resterebbero senza campo e **senza che nessuno glielo
  // dica** — un silenzio, non un doppione.
  const fatti = [fatto(CHI_ANNULLA, 607_000), fatto(COMPAGNI[0], 607_000), fatto(COMPAGNI[1], 607_000)];
  const c = copertura(fatti, [ricevutaAnnullo(CHI_ANNULLA, 151_000)]);
  assert.deepEqual(
    c.daConsegnare.map((f) => f.persona).sort(),
    [...COMPAGNI].sort(),
    'i compagni devono ricevere l\'avviso: è l\'unico che avranno',
  );
  assert.equal(c.coperti.length, 1);
  assert.equal(c.coperti[0].fatto.persona, CHI_ANNULLA);
});

test('⛔ la CURA OVVIA, eseguita per mostrare cosa perde: ricevuta per tutti ⇒ silenzio totale', () => {
  // 📌 Una prova che confronta la strada giusta con quella sbagliata non prova un calcolo:
  // protegge una DECISIONE, e le decisioni sono ciò che il codice dimentica per primo.
  const fatti = [fatto(CHI_ANNULLA, 607_000), fatto(COMPAGNI[0], 607_000), fatto(COMPAGNI[1], 607_000)];
  const perTutti = [CHI_ANNULLA, ...COMPAGNI].map((p) => ricevutaAnnullo(p, 151_000));
  const c = copertura(fatti, perTutti);
  assert.equal(c.daConsegnare.length, 0, 'ecco cosa costerebbe: nessuno dei tre saprebbe niente');
});

test('⚖️ e se la scrittura NON era passata, la ricevuta non copre niente: non c\'è nessun fatto', () => {
  // ⭐ È la metà che rende accettabile il costo dichiarato: una ricevuta senza un fatto
  // corrispondente non fa danno, scade e basta.
  const c = copertura([], [ricevutaAnnullo(CHI_ANNULLA, 0)]);
  assert.equal(c.daConsegnare.length, 0);
  assert.equal(c.coperti.length, 0);
});

test('🩹 il COSTO dichiarato, eseguito: un gesto della segreteria entro la finestra viene coperto UNA volta', () => {
  // ⚠️ Se la scrittura non era passata e la segreteria rifà lo stesso gesto sulla stessa
  // persona, il primo fatto è coperto — uno solo, perché la ricevuta si consuma. Non si tace
  // il costo: si mostra il suo confine.
  const due = [fatto(CHI_ANNULLA, 60_000), fatto(CHI_ANNULLA, 120_000)];
  const c = copertura(due, [ricevutaAnnullo(CHI_ANNULLA, 0)]);
  assert.equal(c.coperti.length, 1, 'una ricevuta copre un fatto solo');
  assert.equal(c.daConsegnare.length, 1, 'il secondo passa, ed è giusto che passi');
});

test('⭐ le due grafie del campo non fanno cadere l\'accoppiamento («Campo 1» contro «1»)', () => {
  // 🚨 È il modo silenzioso in cui questa cura potrebbe non mordere: nessun errore da nessuna
  // parte, e l'avviso falso che torna. Il caso lo esercita di proposito.
  const c = copertura([fatto(CHI_ANNULLA, 1000)], [ricevutaAnnullo(CHI_ANNULLA, 0)]);
  assert.equal(c.coperti.length, 1);
});

// ── 3. Il CABLAGGIO in index.ts — guardie TESTUALI, e si dicono testuali ────

const SRC = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

test('🩹 TESTUALE: i tre rami che devono lasciare la ricevuta sull\'ignoto la lasciano', () => {
  for (const azione of ['create-ignoto', 'leave-ignoto', 'cancel-ignoto']) {
    assert.ok(
      SRC.includes(`lasciaRicevuta('${azione}'`),
      `il ramo ${azione} non lascia più la ricevuta: torna il terzo effetto della voce 83`,
    );
  }
});

test('🩹⛔ TESTUALE: `remove` e `add` NON la lasciano — coprirebbero un TERZO', () => {
  // ⚖️ Non è una dimenticanza ed è la metà che si perde per prima: in quei due gesti chi chiede
  // non è chi viene toccato, e sull'ignoto il bot non ha avvisato la persona toccata. Coprirla
  // la lascerebbe senza notizia.
  for (const azione of ['remove-ignoto', 'add-ignoto']) {
    assert.ok(
      !SRC.includes(`lasciaRicevuta('${azione}'`),
      `il ramo ${azione} lascia una ricevuta: copre una persona che nessuno ha avvisato`,
    );
  }
});

test('🩹🚨 TESTUALE: l\'annullo ignoto NON scrive il roster intero', () => {
  // 🚨 La forma sbagliata è a una riga di distanza da quella giusta: la `cancel` riuscita passa
  // `rosterSlot.map(...)`, ed è corretto **là** perché il bot ha già avvisato tutti. Copiata qui
  // dentro produrrebbe il silenzio del caso qui sopra, e nessun banco che guardi solo il ramo
  // riuscito se ne accorgerebbe.
  const blocco = SRC.slice(SRC.indexOf("lasciaRicevuta('cancel-ignoto'"));
  const fine = blocco.indexOf(']);');
  assert.ok(fine > 0, 'blocco della ricevuta cancel-ignoto non trovato');
  assert.ok(
    !blocco.slice(0, fine).includes('rosterSlot'),
    'la ricevuta dell\'annullo ignoto copre tutto il roster: i compagni resterebbero senza avviso',
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
