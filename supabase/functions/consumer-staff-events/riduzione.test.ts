// Prove della riduzione della raffica (voce 68, decisione ② del committente).
// Esegui:  node supabase/functions/consumer-staff-events/riduzione.test.ts
import assert from 'node:assert/strict';
import {
  coppia,
  QUIETE_DA_CONFERMA_MS,
  QUIETE_MS,
  quietaDovuta,
  fondiFormazione,
  riduci,
  statoFinale,
  type FattoInCoda,
} from './riduzione.ts';

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

const T0 = Date.parse('2026-08-21T20:48:00Z');
const ADESSO = T0 + 10 * 60 * 1000;   // dieci minuti dopo: tutto maturo

let seq = 0;
function fatto(
  gesto: FattoInCoda['gesto'],
  offsetSec: number,
  persona = 'Lidia Comes',
  slot = '2026-08-31|09:30|1',
): FattoInCoda {
  const [data, ora, campo] = slot.split('|');
  return {
    id: `f${++seq}`,
    slot, data, ora, campo, persona, gesto,
    visto_at: new Date(T0 + offsetSec * 1000).toISOString(),
  };
}

/** 👥 Un fatto `formazione` con i suoi elenchi (voce 79). */
function formazione(
  offsetSec: number,
  entrati: string[],
  usciti: string[],
  persona = 'Maurizio Aprea',
  slot = '2026-08-31|09:30|1',
): FattoInCoda {
  return { ...fatto('formazione', offsetSec, persona, slot), entrati, usciti };
}

// ── Lo stato finale, la regola in sé ─────────────────────────────────────────────────────
test('la tabella della regola, riga per riga', () => {
  assert.equal(statoFinale(['tolto']), 'tolto');
  assert.equal(statoFinale(['tolto', 'aggiunto']), null, 'tolto e rimesso: non è successo niente');
  assert.equal(statoFinale(['aggiunto', 'tolto']), null);
  assert.equal(statoFinale(['aggiunto']), 'aggiunto');
  assert.equal(statoFinale(['aggiunto', 'tolto', 'aggiunto']), 'aggiunto');
  assert.equal(statoFinale(['tolto', 'aggiunto', 'tolto']), 'tolto');
  assert.equal(statoFinale([]), null);
});

test("l'annullamento vince quando è l'ultima parola", () => {
  assert.equal(statoFinale(['annullata']), 'annullata');
  assert.equal(statoFinale(['aggiunto', 'annullata']), 'annullata');
  assert.equal(statoFinale(['tolto', 'aggiunto', 'annullata']), 'annullata');
});

test('una partita annullata e poi ricreata: conta come uscita, e il seguito riprende da lì', () => {
  assert.equal(statoFinale(['annullata', 'aggiunto']), null, 'era dentro, è dentro');
});

// ── ⭐ Il caso che giustifica il modulo ───────────────────────────────────────────────────
test('⭐ tolto e rimesso in trenta secondi → NESSUN messaggio, ma le righe si chiudono', () => {
  const f = [fatto('tolto', 0), fatto('aggiunto', 30)];
  const e = riduci(f, ADESSO);
  assert.equal(e.length, 1);
  assert.equal(e[0].gesto, null, 'niente da dire: la persona è dove era');
  assert.equal(e[0].ids.length, 2, 'ma tutte e due le righe vanno marcate consegnate');
});

test('la raffica vera del 21/08 si riduce a una cosa sola', () => {
  // 20:50 tolte Fabiola e Lidia dal bot, ~20:52 Lidia rimessa dal gestionale.
  const f = [
    fatto('tolto', 0, 'Fabiola Limuti'),
    fatto('tolto', 0, 'Lidia Comes'),
    fatto('aggiunto', 120, 'Lidia Comes'),
  ];
  const e = riduci(f, ADESSO).sort((a, b) => a.persona.localeCompare(b.persona));
  assert.equal(e.length, 2, 'due persone, due coppie');
  assert.equal(e[0].persona, 'Fabiola Limuti');
  assert.equal(e[0].gesto, 'tolto', 'lei è uscita davvero e lo deve sapere');
  assert.equal(e[1].persona, 'Lidia Comes');
  assert.equal(e[1].gesto, null, 'lei non si è accorta di niente, e va bene così');
});

// ── I due minuti di quiete ───────────────────────────────────────────────────────────────
test('una raffica ancora calda non si consegna a metà', () => {
  const f = [fatto('tolto', 0)];
  assert.deepEqual(riduci(f, T0 + QUIETE_MS - 1000), [], 'un secondo prima: si aspetta');
  assert.equal(riduci(f, T0 + QUIETE_MS).length, 1, 'scaduti i due minuti: si consegna');
});

test('la quiete si misura sull\'ULTIMO gesto, non sul primo', () => {
  // Primo gesto vecchissimo, ultimo appena fatto: la segreteria sta ancora lavorando.
  const f = [fatto('tolto', 0), fatto('aggiunto', 590)];
  assert.deepEqual(riduci(f, T0 + 600 * 1000), [], 'l\'ultimo ha dieci secondi: si aspetta');
});

test('una coppia calda non trattiene le altre', () => {
  const f = [
    fatto('tolto', 0, 'Lidia Comes'),
    fatto('tolto', 595, 'Marco Rossi'),
  ];
  const e = riduci(f, T0 + 600 * 1000);
  assert.equal(e.length, 1);
  assert.equal(e[0].persona, 'Lidia Comes');
});

test('una data illeggibile non blocca la riga per sempre', () => {
  const f = [{ ...fatto('tolto', 0), visto_at: 'non-una-data' }];
  assert.equal(riduci(f, ADESSO).length, 1);
});

// ── Le coppie sono per persona E per partita ─────────────────────────────────────────────
test('la stessa persona in due partite diverse sono due esiti', () => {
  const f = [
    fatto('tolto', 0, 'Lidia Comes', '2026-08-31|09:30|1'),
    fatto('aggiunto', 0, 'Lidia Comes', '2026-09-01|18:00|2'),
  ];
  assert.equal(riduci(f, ADESSO).length, 2);
});

test('il nome si confronta senza badare a maiuscole e spazi', () => {
  assert.equal(coppia(' Lidia Comes ', 's'), coppia('lidia comes', 's'));
});

test('i gesti si ordinano per istante, non per come arrivano dal database', () => {
  const dopo = fatto('aggiunto', 60);
  const prima = fatto('tolto', 0);
  const e = riduci([dopo, prima], ADESSO);   // di proposito al contrario
  assert.equal(e[0].gesto, null, 'tolto poi aggiunto = niente; l\'ordine sbagliato direbbe «tolto»');
});

// ── VOCE 74 — il tipo dello slot arriva fino a chi consegna ─────────────────────────────
test('il tipo dello slot sopravvive alla riduzione: senza, il bot direbbe «partita» a una lezione', () => {
  const base = { slot: '2026-08-25|12:30|1', data: '2026-08-25', ora: '12:30', campo: 'Campo 1', persona: 'Maria Pia Bettiol' };
  const r = riduci([
    { id: 'a', ...base, gesto: 'aggiunto', visto_at: '2026-08-22T10:00:00.000Z', tipo: 'lezione' },
  ], new Date('2026-08-22T10:05:00.000Z'));
  assert.equal(r.length, 1);
  assert.equal(r[0].tipo, 'lezione');
});

test('un fatto VECCHIO senza tipo esce con null, non con undefined: il bot deve poter dire «non lo so»', () => {
  const base = { slot: '2026-08-25|12:30|1', data: '2026-08-25', ora: '12:30', campo: 'Campo 1', persona: 'Maria Pia Bettiol' };
  const r = riduci([
    { id: 'a', ...base, gesto: 'aggiunto', visto_at: '2026-08-22T10:00:00.000Z' },
  ], new Date('2026-08-22T10:05:00.000Z'));
  assert.equal(r[0].tipo, null);
});

test('🔄 lo SPOSTAMENTO vince da ultimo, come «annullata» — ma in mezzo va nel verso opposto', () => {
  // 🗣️ Voce 74, regola del committente del 23/08. `spostata` dice dov'è finita la PARTITA, non
  // dove si trova il giocatore: da ultimo vince, come `annullata`.
  assert.equal(statoFinale(['spostata']), 'spostata');
  assert.equal(statoFinale(['aggiunto', 'spostata']), 'spostata');
  assert.equal(statoFinale(['spostata', 'spostata']), 'spostata', 'due spostamenti si dicono una volta sola');
  assert.equal(statoFinale(['spostata', 'annullata']), 'annullata', 'spostata e poi annullata: non c\'è più');

  // 🚨 E QUI LE DUE PAROLE VANNO NEI VERSI OPPOSTI, che è il punto in cui è facile confonderle:
  // un annullo IN MEZZO è un'uscita (`annullata` conta come «fuori»), uno spostamento no — chi
  // era in campo ci resta, la partita si è solo mossa. ⇒ Non tocca il conto dentro/fuori.
  assert.equal(statoFinale(['spostata', 'tolto']), 'tolto', 'spostata e poi tolto: è fuori');
  assert.equal(statoFinale(['tolto', 'spostata']), 'spostata');
  // Chi era fuori, viene messo dentro e poi la partita si sposta: la notizia utile è lo
  // spostamento, e dice già che è dentro.
  assert.equal(statoFinale(['aggiunto', 'spostata']), 'spostata');
});

test('🔄 il «da» sopravvive alla riduzione, e viene dall\'ULTIMO fatto', () => {
  // ⚖️ Come il `tipo`: non si fonde e non si vota. Se una partita si sposta due volte in una
  // raffica, la partenza che serve al socio è quella da cui l'ha vista lui — la prima — ma
  // l'unica che questo modulo può conoscere senza tenere una storia è l'ultima. ⇒ Si dichiara.
  const base = fatto('spostata', 0, 'Maurizio Aprea', '2026-08-31|11:30|2');
  const con = { ...base, da: { data: '2026-08-31', ora: '09:30', campo: '1' } } as FattoInCoda;
  const dopoLaQuiete = Date.parse(con.visto_at) + QUIETE_MS + 1000;
  const r = riduci([con], dopoLaQuiete);
  assert.equal(r.length, 1);
  assert.equal(r[0].gesto, 'spostata');
  assert.deepEqual(r[0].da, { data: '2026-08-31', ora: '09:30', campo: '1' });
  // ⚠️ Sugli altri gesti resta nullo: non si porta dietro una partenza che non esiste.
  const senza = riduci([fatto('tolto', 0, 'Lidia Comes', '2026-08-31|11:30|2')], dopoLaQuiete);
  assert.equal(senza[0].da ?? null, null);
});

// ── VOCE 76: la quiete quando l'istante è quello VERO ────────────────────────────────────
/** Lo stesso fatto, ma dichiarato dal gestionale su una conferma in mano. */
function daConferma(f: FattoInCoda): FattoInCoda {
  return { ...f, origine: 'conferma' };
}

test('un fatto nato da una CONFERMA si consegna col solo margine, non coi due minuti', () => {
  const f = [daConferma(fatto('spostata', 0, 'Maurizio Aprea'))];
  assert.deepEqual(riduci(f, T0 + QUIETE_DA_CONFERMA_MS - 1000), [], 'il margine c\'è ed è rispettato');
  assert.equal(riduci(f, T0 + QUIETE_DA_CONFERMA_MS).length, 1, 'scaduto il margine: si parla');
  // 📏 Il guadagno, che è il punto della voce: un minuto e mezzo su ogni gesto confermato.
  assert.ok(QUIETE_DA_CONFERMA_MS < QUIETE_MS);
});

test('🚨 basta UN fatto dal sync perché il gruppo torni alla quiete piena', () => {
  // ⚖️ Il gruppo porta due timbri di natura diversa: uno esatto e uno approssimato. Misurare
  // una distanza fra i due dà un numero che non vuol dire niente ⇒ si tiene l'attesa lunga.
  const f = [daConferma(fatto('spostata', 0)), fatto('tolto', 0)];
  assert.deepEqual(riduci(f, T0 + QUIETE_DA_CONFERMA_MS + 1000), [], 'il margine corto NON si applica');
  assert.equal(riduci(f, T0 + QUIETE_MS).length, 1, 'coi due minuti pieni si consegna');
});

test('⚠️ origine assente vale sync: le righe di prima non cambiano comportamento', () => {
  const vecchio = fatto('tolto', 0);
  assert.equal(vecchio.origine, undefined, 'i fatti già in coda non hanno origine');
  assert.deepEqual(riduci([vecchio], T0 + QUIETE_DA_CONFERMA_MS + 1000), [], 'quiete piena, come prima');
});

test('quietaDovuta risponde alla domanda da sola, gruppo per gruppo', () => {
  assert.equal(quietaDovuta([daConferma(fatto('spostata', 0))]), QUIETE_DA_CONFERMA_MS);
  assert.equal(quietaDovuta([fatto('tolto', 0)]), QUIETE_MS);
  assert.equal(quietaDovuta([]), QUIETE_MS, 'un gruppo vuoto non è un gruppo di conferme');
});
// ── ⏱️ VOCE 89 (24/08/2026): la metà del minuto che QUESTO repo possiede ───────────────────
//
// 🗣️ Il committente ha scritto nella kb, di sua mano, «Quando arriva: entro 1 minuto». Quella
// frase non descrive il sistema: lo vincola. Il budget è 60 secondi in due metà da 30 —
// la quiete qui, il ritiro nel repo del bot (`PERIODO_CIRCOLO_MS`, che ha il suo caso là).
//
// ⚖️ Ogni lato difende la PROPRIA metà e non conosce il numero dell'altro: una copia della
// costante altrui resterebbe verde giurando su un valore che di là non esiste più. È la stessa
// ragione per cui, la stessa giornata, sono state tolte sei copie del nome di una voce di menu.
test('🚨⭐⭐ la quiete dei fatti DICHIARATI sta dentro la sua metà del minuto', () => {
  assert.ok(
    QUIETE_DA_CONFERMA_MS <= 30_000,
    `la quiete dei fatti da conferma è ${QUIETE_DA_CONFERMA_MS / 1000}s, oltre i 30 che questo `
    + 'repo si è impegnato a rispettare. La kb dice al socio «entro 1 minuto»: alzandola la '
    + 'frase diventa falsa, e a scoprirlo sarebbe il socio che aspetta.',
  );
});

test('⛔ e la quiete PIENA non ci entra, di proposito: quella misura un timbro approssimato', () => {
  // 🚨 Il budget vale solo per i fatti con l'istante VERO. Un fatto venuto dal sync porta il
  // timbro del giro, e su quello la quiete corta non fonderebbe niente (vedi il commento di
  // `QUIETE_DA_CONFERMA_MS`). ⇒ Questo caso impedisce la scorciatoia che verrebbe in mente a
  // chi legge il caso qui sopra: «allora abbassiamo tutte e due».
  assert.ok(
    QUIETE_MS > 30_000,
    'la quiete piena è scesa dentro il budget: sui fatti dal sync sta misurando una distanza '
    + 'fra timbri di giro, e accorciarla toglie la fusione senza dare velocità',
  );
});

// ── 👥 VOCE 79: il quinto gesto nella riduzione ──────────────────────────────────────────
//
// ⚖️ `formazione` è di una terza specie: `aggiunto`/`tolto` dicono dov'è chi legge,
// `annullata`/`spostata` dicono dov'è la partita, e questo dice **chi sono gli altri**. Perciò
// esce dal conto dentro/fuori invece di sommarcisi.

test('👥 la tabella del quinto gesto, riga per riga', () => {
  assert.equal(statoFinale(['formazione']), 'formazione');
  assert.equal(statoFinale(['formazione', 'formazione']), 'formazione', 'due passaggi, una cosa sola');
  // ⭐ A chi è stato TOLTO non si racconta come si è composta una partita che non è più sua:
  // è l'errore gemello di quello che la voce 76 ha curato sugli spostamenti.
  assert.equal(statoFinale(['formazione', 'tolto']), 'tolto');
  assert.equal(statoFinale(['tolto', 'formazione']), 'tolto');
  // ⭐ E a chi ENTRA si dice «sei in campo», che è la notizia — non «è cambiata la formazione».
  assert.equal(statoFinale(['formazione', 'aggiunto']), 'aggiunto');
  assert.equal(statoFinale(['aggiunto', 'formazione']), 'aggiunto');
  // ⭐ Tolto e rimesso: su di lui non c'è niente da dire, ma i compagni gli sono cambiati.
  assert.equal(statoFinale(['tolto', 'aggiunto', 'formazione']), 'formazione');
  assert.equal(statoFinale(['aggiunto', 'tolto', 'formazione']), 'formazione');
});

test('👥 annullata e spostata restano più forti, e un `formazione` dopo non le ribalta', () => {
  // 🚨 Il caso che si sbaglia scrivendo la regola: filtrando `formazione` e poi guardando
  // «l'ultimo in assoluto», uno `spostata` seguito da un `formazione` diventerebbe un `tolto`
  // — cioè si direbbe a qualcuno che è stato buttato fuori da una partita che ha solo
  // cambiato ora.
  assert.equal(statoFinale(['spostata', 'formazione']), 'spostata');
  assert.equal(statoFinale(['annullata', 'formazione']), 'annullata');
  assert.equal(statoFinale(['formazione', 'spostata']), 'spostata');
  assert.equal(statoFinale(['formazione', 'annullata']), 'annullata');
});

test('👥 gli elenchi si fondono AL NETTO della raffica, non si accodano', () => {
  // ⭐ Stessa regola del resto del modulo — com'era all'inizio contro com'è alla fine — ma
  // applicata ai compagni. Entra Marco in un giro ed esce in quello dopo: chi legge non l'ha
  // mai visto arrivare, e raccontarglielo sarebbe l'allarme inutile del «tolto e rimesso».
  const { entrati, usciti } = fondiFormazione([
    formazione(0, ['Marco Rossi'], ['Lidia Comes']),
    formazione(30, [], ['Marco Rossi']),
  ]);
  assert.deepEqual(entrati, []);
  assert.deepEqual(usciti.sort(), ['Lidia Comes']);
});

test('👥 e si contano le RIPETIZIONI: tre ospiti entrati meno uno uscito fanno due entrati', () => {
  const { entrati, usciti } = fondiFormazione([
    formazione(0, ['Ospite', 'Ospite', 'Ospite'], []),
    formazione(30, [], ['Ospite']),
  ]);
  assert.deepEqual(entrati, ['Ospite', 'Ospite']);
  assert.deepEqual(usciti, []);
});

test('👥 un cambio di formazione che si ANNULLA non produce nessun messaggio', () => {
  // 🚨 Ed è la metà che si dimentica: lo stato finale direbbe `formazione`, ma non c'è niente
  // da raccontare. Le righe si chiudono lo stesso (`gesto: null` porta gli `ids`), o
  // resterebbero in coda a farsi riesaminare per sempre.
  const esiti = riduci([
    formazione(0, ['Marco Rossi'], []),
    formazione(30, [], ['Marco Rossi']),
  ], ADESSO);
  assert.equal(esiti.length, 1);
  assert.equal(esiti[0].gesto, null);
  assert.equal(esiti[0].ids.length, 2, 'le righe si chiudono comunque');
});

test('👥 il giro intero: chi resta riceve UN esito, con dentro chi è entrato e chi è uscito', () => {
  const esiti = riduci([
    fatto('tolto', 0, 'Lidia Comes'),
    formazione(0, [], ['Lidia Comes']),
    formazione(40, ['Marco Rossi'], []),
  ], ADESSO);
  const perChi = new Map(esiti.map((e) => [e.persona, e]));
  assert.equal(perChi.get('Lidia Comes')?.gesto, 'tolto');
  const resta = perChi.get('Maurizio Aprea')!;
  assert.equal(resta.gesto, 'formazione');
  assert.deepEqual(resta.entrati, ['Marco Rossi']);
  assert.deepEqual(resta.usciti, ['Lidia Comes']);
  assert.equal(resta.ids.length, 2, 'i due passaggi si chiudono insieme');
  // ⚠️ Gli elenchi NON escono sugli altri gesti: un campo pieno dove non serve fa credere a
  // chi legge che serva.
  assert.equal(perChi.get('Lidia Comes')?.entrati, undefined);
});

// ── 🆕🗣️ VOCE 79 (01/09) — CHI HA CHIESTO il gesto attraversa la riduzione ──────────────
//
// 📏 Nati da una prova fisica: alle 20:01 una socia è entrata da sé in una partita aperta e
// agli altri tre in campo il bot ha detto «L'ha cambiata il circolo», col numero della
// segreteria in fondo. Il campo esiste per non far più dire quella frase quando è falsa — e la
// riduzione è il punto in cui si perderebbe senza che nessun banco se ne accorga.

test('🆕 l\'attore sopravvive alla riduzione: è lì che si perderebbe in silenzio', () => {
  const f = { ...fatto('formazione', 0), entrati: ['Laura Aprea'], usciti: [], chiesto_da: 'Laura Aprea' };
  const [e] = riduci([f], ADESSO);
  assert.equal(e.chiestoDa, 'Laura Aprea');
});

test('🆕 assente o vuoto ⇒ null, cioè «il circolo»: è il comportamento di sempre', () => {
  // ⚖️ Il caso che rende la metà del gestionale sicura da mettere in servizio: finché la
  // colonna non c'è (o è vuota) non cambia una virgola di quello che il socio legge.
  for (const niente of [undefined, null, '', '   ']) {
    const [e] = riduci([{ ...fatto('formazione', 0), chiesto_da: niente } as FattoInCoda], ADESSO);
    assert.equal(e.chiestoDa, null, `«${String(niente)}» non è caduto sul ramo del circolo`);
  }
});

test('🆕 in una raffica mista vince l\'ULTIMO, e non si fondono due attori', () => {
  // 🚨 Il verso sbagliato sarebbe inventare un terzo attore fondendo i due, o tenere il primo:
  // la raffica si racconta com'è finita, che è la regola con cui `tipo` e `da` sono già trattati.
  const esiti = riduci([
    { ...fatto('formazione', 0), entrati: ['Laura Aprea'], usciti: [], chiesto_da: 'Laura Aprea' },
    { ...fatto('formazione', 40), entrati: ['Marco Rossi'], usciti: [], chiesto_da: null },
  ], ADESSO);
  assert.equal(esiti[0].chiestoDa, null, 'un gesto della segreteria in coda alla raffica resta della segreteria');
  const rovescio = riduci([
    { ...fatto('formazione', 0), entrati: ['Marco Rossi'], usciti: [], chiesto_da: null },
    { ...fatto('formazione', 40), entrati: ['Laura Aprea'], usciti: [], chiesto_da: 'Laura Aprea' },
  ], ADESSO);
  assert.equal(rovescio[0].chiestoDa, 'Laura Aprea');
});

test('🆕 VOCE 123 — una raffica tutta chiesta dalla stessa persona è unanime', () => {
  const esiti = riduci([
    { ...fatto('formazione', 0), entrati: [], usciti: ['Marco Aprea'], chiesto_da: 'Maurizio Aprea' },
    { ...fatto('formazione', 40), entrati: [], usciti: ['Laura Aprea'], chiesto_da: 'Maurizio Aprea' },
  ], ADESSO);
  assert.equal(esiti[0].chiestoDaUnanime, true);
  assert.equal(esiti[0].chiestoDa, 'Maurizio Aprea');
});

test('🆕 VOCE 123 — basta UN fatto della segreteria e l\'unanimità cade', () => {
  // 🚨 È la guardia che impedisce allo scarto di zittire una notizia che nessun altro darà:
  // qui l'ultimo gesto è suo, quindi `chiestoDa` lo indica — ma in mezzo c'è la segreteria.
  const esiti = riduci([
    { ...fatto('formazione', 0), entrati: ['Ospite'], usciti: [], chiesto_da: null },
    { ...fatto('formazione', 40), entrati: [], usciti: ['Marco Aprea'], chiesto_da: 'Maurizio Aprea' },
  ], ADESSO);
  assert.equal(esiti[0].chiestoDa, 'Maurizio Aprea', 'l\'ultimo resta l\'ultimo');
  assert.equal(esiti[0].chiestoDaUnanime, false, 'ma la raffica NON è tutta sua');
});

test('🆕 VOCE 123 — due richiedenti diversi non sono unanimi', () => {
  const esiti = riduci([
    { ...fatto('formazione', 0), entrati: ['Laura Aprea'], usciti: [], chiesto_da: 'Laura Aprea' },
    { ...fatto('formazione', 40), entrati: [], usciti: ['Marco Aprea'], chiesto_da: 'Maurizio Aprea' },
  ], ADESSO);
  assert.equal(esiti[0].chiestoDaUnanime, false);
});

test('🆕 VOCE 123 — una raffica tutta della segreteria non è unanime (non c\'è un attore)', () => {
  const esiti = riduci([
    { ...fatto('formazione', 0), entrati: [], usciti: ['Marco Aprea'], chiesto_da: null },
  ], ADESSO);
  assert.equal(esiti[0].chiestoDaUnanime, false, 'senza richiedente non si scarta niente');
});

test('🆕 VOCE 123 — la grafia non rompe l\'unanimità (stesso nome, accenti e spazi diversi)', () => {
  const esiti = riduci([
    { ...fatto('formazione', 0), entrati: [], usciti: ['Marco Aprea'], chiesto_da: 'Niccolò  Rossi' },
    { ...fatto('formazione', 40), entrati: [], usciti: ['Laura Aprea'], chiesto_da: 'niccolo rossi' },
  ], ADESSO);
  assert.equal(esiti[0].chiestoDaUnanime, true);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
