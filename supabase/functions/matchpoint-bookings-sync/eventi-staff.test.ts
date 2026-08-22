// Prove deterministiche del confronto fra due fotografie del calendario (voce 68).
// Esegui:  node supabase/functions/matchpoint-bookings-sync/eventi-staff.test.ts
import assert from 'node:assert/strict';
import {
  chiaveSlot,
  confrontoAttendibile,
  fattiDaConfronto as fattiDaConfrontoReale,
  fotografia,
  normNome,
  puoRicevere,
  eLezione,
  tipoDelloSlot,
  sepoltiDaResuscitare,
  slotDichiaratiAnnullati,
  type SlotRoster,
} from './eventi-staff.ts';

/** Il parser del roster, com'è in `index.ts`: si passa da fuori per non farne una terza copia. */
const roster = (d: unknown): string[] => {
  const t = String(d ?? '').trim();
  if (!t.startsWith('-')) return [];
  return t.split('.').map((s) => s.replace(/^-+/, '').trim()).filter(Boolean);
};

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

/**
 * Il giorno in cui «girano» le prove esistenti. Tutte usano il 31/08 o il 15/09, quindi con
 * questo `oggi` sono tutte nel futuro e si comportano esattamente come prima che la finestra
 * esistesse. I casi che la finestra la provano davvero passano la data per esteso.
 */
const OGGI = '2026-08-21';

/** Le prove storiche non passavano `oggi`: lo mette questa scorciatoia, sempre lo stesso. */
function fattiDaConfronto(
  prima: Map<string, SlotRoster>,
  dopo: Map<string, SlotRoster>,
  oggi: string = OGGI,
): ReturnType<typeof fattiDaConfrontoReale> {
  return fattiDaConfrontoReale(prima, dopo, oggi);
}

/** Scorciatoia: una fotografia con gli slot indicati. */
function foto(...slots: Array<[string, string[]]>): Map<string, SlotRoster> {
  const m = new Map<string, SlotRoster>();
  for (const [slot, roster] of slots) {
    const [data, ora, campo] = slot.split('|');
    m.set(slot, { slot, data, ora, campo, roster });
  }
  return m;
}
/** Riempitivo per superare la guardia del crollo senza rumore nei casi sotto esame. */
function contorno(quanti: number): Array<[string, string[]]> {
  return Array.from({ length: quanti }, (_, i) =>
    [`2026-09-0${(i % 9) + 1}|10:00|${i + 20}`, ['Tizio Riempitivo']] as [string, string[]]);
}

// ── Il caso vero che ha aperto la voce ───────────────────────────────────────────────────
test('lo staff toglie un giocatore da una partita esistente → un fatto, per lui solo', () => {
  const prima = foto(['2026-08-31|09:30|1', ['Maurizio Aprea', 'Lidia Comes']], ...contorno(4));
  const dopo = foto(['2026-08-31|09:30|1', ['Maurizio Aprea']], ...contorno(4));
  const f = fattiDaConfronto(prima, dopo);
  assert.equal(f.length, 1);
  assert.equal(f[0].persona, 'Lidia Comes');
  assert.equal(f[0].gesto, 'tolto');
  assert.equal(f[0].data, '2026-08-31');
});

test('lo staff aggiunge un giocatore → un fatto, e NON lo ricevono gli altri in campo (decisione ①)', () => {
  const prima = foto(['2026-08-31|09:30|1', ['Maurizio Aprea', 'Marco Rossi']], ...contorno(4));
  const dopo = foto(['2026-08-31|09:30|1', ['Maurizio Aprea', 'Marco Rossi', 'Lidia Comes']], ...contorno(4));
  const f = fattiDaConfronto(prima, dopo);
  assert.equal(f.length, 1, 'un solo destinatario: chi il gesto ha toccato');
  assert.equal(f[0].persona, 'Lidia Comes');
  assert.equal(f[0].gesto, 'aggiunto');
});

test('una SOSTITUZIONE è due fatti — il conteggio non cambia, ma le persone sì', () => {
  const prima = foto(['2026-08-31|09:30|1', ['Maurizio Aprea', 'Marco Rossi']], ...contorno(4));
  const dopo = foto(['2026-08-31|09:30|1', ['Maurizio Aprea', 'Lidia Comes']], ...contorno(4));
  const f = fattiDaConfronto(prima, dopo);
  assert.equal(f.length, 2);
  assert.deepEqual(
    f.map((x) => `${x.gesto}:${x.persona}`).sort(),
    ['aggiunto:Lidia Comes', 'tolto:Marco Rossi'],
  );
});

// ── La decisione ③: toccato ≠ cambiato ───────────────────────────────────────────────────
test('lo staff salva senza modificare niente → nessun fatto', () => {
  const uguale: Array<[string, string[]]> = [['2026-08-31|09:30|1', ['Maurizio Aprea', 'Lidia Comes']]];
  const f = fattiDaConfronto(foto(...uguale, ...contorno(4)), foto(...uguale, ...contorno(4)));
  assert.deepEqual(f, []);
});

test("l'ordine dei nomi non è un cambiamento", () => {
  const prima = foto(['2026-08-31|09:30|1', ['Maurizio Aprea', 'Lidia Comes']], ...contorno(4));
  const dopo = foto(['2026-08-31|09:30|1', ['Lidia Comes', 'Maurizio Aprea']], ...contorno(4));
  assert.deepEqual(fattiDaConfronto(prima, dopo), []);
});

// ── L'annullamento ───────────────────────────────────────────────────────────────────────
test('partita annullata → lo sanno TUTTI quelli che ci giocavano', () => {
  const prima = foto(['2026-08-31|09:30|1', ['Maurizio Aprea', 'Lidia Comes', 'Marco Rossi']], ...contorno(6));
  const dopo = foto(...contorno(6));
  const f = fattiDaConfronto(prima, dopo);
  assert.equal(f.length, 3);
  assert.ok(f.every((x) => x.gesto === 'annullata'));
});

// ── Gli «Ospite»: si contano, non si avvisano ────────────────────────────────────────────
test('un «Ospite» tolto non produce nessun fatto: non ha una scheda a cui scrivere', () => {
  const prima = foto(['2026-08-31|09:30|1', ['Maurizio Aprea', 'Ospite', 'Ospite']], ...contorno(4));
  const dopo = foto(['2026-08-31|09:30|1', ['Maurizio Aprea', 'Ospite']], ...contorno(4));
  assert.deepEqual(fattiDaConfronto(prima, dopo), []);
});

test('tre «Ospite» accanto a una persona vera: il fatto esce solo per la persona', () => {
  const prima = foto(['2026-08-31|09:30|1', ['Sergio Dal Bianco', 'Ospite', 'Ospite', 'Ospite']], ...contorno(4));
  const dopo = foto(['2026-08-31|09:30|1', ['Sergio Dal Bianco', 'Ospite', 'Ospite', 'Lidia Comes']], ...contorno(4));
  const f = fattiDaConfronto(prima, dopo);
  assert.equal(f.length, 1);
  assert.equal(f[0].persona, 'Lidia Comes');
  assert.equal(f[0].gesto, 'aggiunto');
});

// ── La guardia del crollo: la protezione che vale più di tutte ───────────────────────────
test('🚨 export mozzato (tutte le partite sparite) → ZERO fatti, non un annullamento di massa', () => {
  const prima = foto(...contorno(40));
  const dopo = new Map<string, SlotRoster>();
  assert.deepEqual(fattiDaConfronto(prima, dopo), []);
});

test('🚨 metà calendario sparito in un colpo → non è una giornata di disdette, è un guasto', () => {
  const prima = foto(...contorno(40));
  const dopo = foto(...contorno(9));
  assert.deepEqual(fattiDaConfronto(prima, dopo), []);
});

test('primo giro (nessuna fotografia di prima) → nessun fatto', () => {
  assert.deepEqual(fattiDaConfronto(new Map(), foto(...contorno(10))), []);
});

test('un calo normale resta sotto la guardia e i fatti escono', () => {
  assert.equal(confrontoAttendibile(40, 39), true);
  assert.equal(confrontoAttendibile(40, 20), true, 'esattamente la soglia: ancora attendibile');
  assert.equal(confrontoAttendibile(40, 19), false);
  assert.equal(confrontoAttendibile(0, 10), false);
  assert.equal(confrontoAttendibile(10, 0), false);
});

// ── Le partite nuove ─────────────────────────────────────────────────────────────────────
test('partita nuova: avvisati tutti tranne il primo, che è chi ha organizzato', () => {
  const prima = foto(...contorno(10));
  const dopo = foto(['2026-09-15|18:00|3', ['Maurizio Aprea', 'Lidia Comes', 'Marco Rossi']], ...contorno(10));
  const f = fattiDaConfronto(prima, dopo);
  assert.equal(f.length, 2);
  assert.ok(!f.some((x) => x.persona === 'Maurizio Aprea'), "l'organizzatore non si avvisa da solo");
  assert.deepEqual(f.map((x) => x.persona).sort(), ['Lidia Comes', 'Marco Rossi']);
});

test('partita nuova con un solo nome → nessun fatto: quella persona ha prenotato lei', () => {
  const prima = foto(...contorno(10));
  const dopo = foto(['2026-09-15|18:00|3', ['Maurizio Aprea']], ...contorno(10));
  assert.deepEqual(fattiDaConfronto(prima, dopo), []);
});

// ── Il confronto dei nomi ────────────────────────────────────────────────────────────────
test('accenti e spazi doppi non fanno sembrare cambiato un roster fermo', () => {
  const prima = foto(['2026-08-31|09:30|1', ['Niccolò  D’Amico']], ...contorno(4));
  const dopo = foto(['2026-08-31|09:30|1', ['Niccolò D’Amico']], ...contorno(4));
  assert.deepEqual(fattiDaConfronto(prima, dopo), []);
});

test('normNome e puoRicevere', () => {
  assert.equal(normNome('  Maurizio   Aprea '), 'maurizio aprea');
  assert.equal(puoRicevere('Ospite'), false);
  assert.equal(puoRicevere('OSPITE'), false);
  assert.equal(puoRicevere(''), false);
  assert.equal(puoRicevere('Lidia Comes'), true);
});

// ── La fotografia: da righe sparse a uno slot per partita ────────────────────────────────
test('le copie della stessa partita cadono in UNO slot, e vince la più completa', () => {
  const f = fotografia([
    { data: '2026-08-31', ora: '09:30', campo: 'Campo 1', descrizione: '-Maurizio Aprea.' },
    { data: '2026-08-31', ora: '09:30', campo: '1', descrizione: '-Maurizio Aprea.-Lidia Comes.' },
  ], roster);
  assert.equal(f.size, 1, '«Campo 1» e «1» sono la stessa partita');
  assert.deepEqual(f.get('2026-08-31|09:30|1')?.roster, ['Maurizio Aprea', 'Lidia Comes']);
});

test('un titolo libero non è un roster e non entra nella fotografia', () => {
  const f = fotografia([
    { data: '2026-08-31', ora: '09:30', campo: '1', descrizione: 'Torneo aziendale' },
  ], roster);
  assert.equal(f.size, 0);
});

test('chiaveSlot tiene solo le cifre del campo', () => {
  assert.equal(chiaveSlot('2026-08-31', '09:30', 'Campo 12'), '2026-08-31|09:30|12');
  assert.equal(chiaveSlot('2026-08-31', '09:30', '12'), '2026-08-31|09:30|12');
});

test('🔗 dal payload al fatto, senza scorciatoie: il caso vero del 21/08', () => {
  // Le righe come le scrive il circolo, prima e dopo il gesto dello staff.
  const prima = fotografia([
    { data: '2026-08-31', ora: '09:30', campo: 'Campo 1', descrizione: '-Maurizio Aprea.-Fabiola Limuti.-Lidia Comes.' },
  ], roster);
  const dopo = fotografia([
    { data: '2026-08-31', ora: '09:30', campo: 'Campo 1', descrizione: '-Maurizio Aprea.-Lidia Comes.' },
  ], roster);
  // Un solo slot per parte: la guardia del crollo direbbe di no (1 → 1 va bene, 1 → 0 no).
  const f = fattiDaConfronto(prima, dopo);
  assert.equal(f.length, 1);
  assert.equal(f[0].persona, 'Fabiola Limuti');
  assert.equal(f[0].gesto, 'tolto');
});



// ── LA MEZZANOTTE (21/08/2026): il giorno che esce dalla finestra ───────────────────────────
// 📏 Danno vero, non ipotesi: 36 falsi «la tua partita non c'è più» a 32 persone, tutti alle
// 00:01:47, tutti per le partite del giorno prima.

test('30. le partite di IERI escono dalla finestra e NON sono annullamenti', () => {
  const ieri: [string, string[]] = ['2026-08-21|09:30|2', ['Maurizio Aprea', 'Fabio De Luca']];
  const domani: [string, string[]] = ['2026-08-31|11:00|1', ['Maurizio Aprea']];
  // Prima di mezzanotte la fotografia ha entrambe; dopo, solo quella futura.
  const f = fattiDaConfronto(foto(ieri, domani), foto(domani), '2026-08-22');
  assert.deepEqual(f, [], 'una partita già giocata non è stata annullata');
});

test('31. un annullamento VERO nel futuro continua a passare', () => {
  const futura: [string, string[]] = ['2026-08-31|11:00|1', ['Maurizio Aprea', 'Lidia Comes']];
  const altra: [string, string[]] = ['2026-09-15|10:00|2', ['Marco Aprea']];
  const f = fattiDaConfronto(foto(futura, altra), foto(altra), '2026-08-22');
  assert.equal(f.length, 2, 'la partita futura sparita avvisa tutti e due i giocatori');
  assert.ok(f.every((x) => x.gesto === 'annullata'));
});

test('32. OGGI resta dentro la finestra: una partita di stamattina annullata si dice', () => {
  const stamattina: [string, string[]] = ['2026-08-22|09:30|2', ['Maurizio Aprea']];
  const altra: [string, string[]] = ['2026-09-15|10:00|2', ['Marco Aprea']];
  const f = fattiDaConfronto(foto(stamattina, altra), foto(altra), '2026-08-22');
  assert.equal(f.length, 1);
  assert.equal(f[0].gesto, 'annullata');
});

test('33. il calo fisiologico della mezzanotte non falsa la guardia del crollo', () => {
  // Sei slot di ieri e due di domani: dopo mezzanotte restano due. Sul conteggio GREZZO il
  // calo è del 75% e la guardia si sarebbe spenta, zittendo anche gli annullamenti veri.
  // Filtrando prima, il confronto è 2 contro 2 e l'annullamento vero esce.
  const ieri: Array<[string, string[]]> = [1, 2, 3, 4, 5, 6].map(
    (i) => [`2026-08-21|0${i}:00|1`, ['Tizio Uno']] as [string, string[]],
  );
  const a: [string, string[]] = ['2026-08-31|11:00|1', ['Maurizio Aprea']];
  const b: [string, string[]] = ['2026-09-15|10:00|2', ['Marco Aprea']];
  const f = fattiDaConfronto(foto(...ieri, a, b), foto(b), '2026-08-22');
  assert.equal(f.length, 1);
  assert.equal(f[0].persona, 'Maurizio Aprea');
});

// ── VOCE 73 — le righe che l'app ha seppellito tornano nella fotografia di PRIMA ────────────
//
// 🚨 Il caso 34 è quello MISURATO il 22/08: due partite annullate dal gestionale, zero fatti.
// I dati sono le righe vere lette su PROD, `descrizione` compresa.

/** Una lapide come sta in `pmo_cloud_records`: il payload se lo porta dietro intero. */
const lapide = (data: string, ora: string, campo: string, descr: string) =>
  ({ payload: { data, ora, campo, descrizione: descr } });

/** Una soppressione dichiarata dall'app per uno slot, a un certo istante. */
const soppressione = (data: string, ora: string, campo: number, updated_at: string, deleted = false) =>
  ({ payload: { data, ora, campo }, deleted, updated_at });

const CONFINE = '2026-08-22T10:52:00.000Z';

test('34. l\'annullo dal gestionale torna a produrre fatti (il caso del 22/08)', () => {
  const sepolti = [
    lapide('2026-08-31', '09:30', 'Campo 1', '-Maurizio Aprea.-Lidia Comes.'),
    lapide('2026-08-31', '09:30', 'Campo 1', '-Maurizio Aprea.-Lidia Comes.'),
  ];
  const supp = [soppressione('2026-08-31', '09:30', 1, '2026-08-22T10:53:59.000Z')];
  const risorti = sepoltiDaResuscitare(sepolti, supp, CONFINE);
  assert.equal(risorti.length, 2, 'tornano tutte le copie dello slot');

  // E dal confronto escono i due `annullata`, uno per persona — che è ciò che mancava.
  // Il contorno c'è per la guardia del crollo: un «dopo» vuoto non è un annullamento di massa,
  // è un export mozzato, e da lì non deve uscire NIENTE (caso 8).
  const prima = new Map([...fotografia(risorti, roster), ...foto(...contorno(4))]);
  const f = fattiDaConfronto(prima, foto(...contorno(4)), '2026-08-22');
  assert.equal(f.length, 2);
  assert.deepEqual(f.map((x) => x.persona).sort(), ['Lidia Comes', 'Maurizio Aprea']);
  assert.ok(f.every((x) => x.gesto === 'annullata'));
});

test('35. le lapidi del SYNC non risorgono: senza soppressione non passa niente', () => {
  // È la protezione che rende la cura possibile. Il sync seppellisce righe a ogni giro, quando
  // una partita sparisce da Matchpoint per davvero: se entrassero anche loro, il fatto già
  // dichiarato rinascerebbe a ogni giro, per sempre.
  const sepolti = [lapide('2026-08-31', '09:30', 'Campo 1', '-Maurizio Aprea.')];
  assert.deepEqual(sepoltiDaResuscitare(sepolti, [], CONFINE), []);
});

test('36. una soppressione PRIMA del confine non resuscita niente (niente doppioni al giro dopo)', () => {
  const sepolti = [lapide('2026-08-31', '09:30', 'Campo 1', '-Maurizio Aprea.')];
  const supp = [soppressione('2026-08-31', '09:30', 1, '2026-08-22T10:40:00.000Z')];
  assert.deepEqual(sepoltiDaResuscitare(sepolti, supp, CONFINE), []);
});

test('37. una soppressione RITIRATA non resuscita niente', () => {
  // L'annullo rifiutato da Matchpoint: l'app rimette a posto e ritira la soppressione. Lì la
  // partita non è mai sparita, e un «annullata» sarebbe una bugia.
  const sepolti = [lapide('2026-08-31', '09:30', 'Campo 1', '-Maurizio Aprea.')];
  const supp = [soppressione('2026-08-31', '09:30', 1, '2026-08-22T10:53:59.000Z', true)];
  assert.deepEqual(sepoltiDaResuscitare(sepolti, supp, CONFINE), []);
});

test('38. la soppressione resuscita SOLO il proprio slot', () => {
  const sepolti = [
    lapide('2026-08-31', '09:30', 'Campo 1', '-Maurizio Aprea.'),
    lapide('2026-08-31', '11:00', 'Campo 1', '-Marco Aprea.'),
    lapide('2026-08-31', '09:30', 'Campo 2', '-Lidia Comes.'),
  ];
  const supp = [soppressione('2026-08-31', '09:30', 1, '2026-08-22T10:53:59.000Z')];
  const risorti = sepoltiDaResuscitare(sepolti, supp, CONFINE);
  assert.equal(risorti.length, 1);
  assert.equal(risorti[0].descrizione, '-Maurizio Aprea.');
});

test('39. un istante illeggibile vale FUORI finestra: si tace, non si ripete', () => {
  const sepolti = [lapide('2026-08-31', '09:30', 'Campo 1', '-Maurizio Aprea.')];
  assert.deepEqual(sepoltiDaResuscitare(sepolti, [soppressione('2026-08-31', '09:30', 1, 'boh')], CONFINE), []);
  assert.deepEqual(sepoltiDaResuscitare(sepolti, [soppressione('2026-08-31', '09:30', 1, '')], CONFINE), []);
  // E un CONFINE illeggibile spegne tutto: non si sa da quando guardare ⇒ non si guarda.
  const supp = [soppressione('2026-08-31', '09:30', 1, '2026-08-22T10:53:59.000Z')];
  assert.deepEqual(sepoltiDaResuscitare(sepolti, supp, 'mai'), []);
  assert.equal(slotDichiaratiAnnullati(supp, '').size, 0);
});

test('40. una soppressione senza slot leggibile non entra', () => {
  const rotte = [
    { payload: { data: '', ora: '09:30', campo: 1 }, deleted: false, updated_at: '2026-08-22T10:53:59.000Z' },
    { payload: { data: '2026-08-31', ora: '', campo: 1 }, deleted: false, updated_at: '2026-08-22T10:53:59.000Z' },
    { payload: { data: '2026-08-31', ora: '09:30', campo: '' }, deleted: false, updated_at: '2026-08-22T10:53:59.000Z' },
  ];
  assert.equal(slotDichiaratiAnnullati(rotte, CONFINE).size, 0);
});

test('41. il campo si confronta a CIFRE: «Campo 1» della lapide e l\'1 della soppressione sono lo stesso slot', () => {
  // La lapide porta `campo: "Campo 1"` (come lo scrive Matchpoint), la soppressione `campo: 1`
  // (come lo scrive l'app). Confrontarli come stringhe non troverebbe mai niente — e la cura
  // sarebbe verde nelle prove e muta in produzione.
  const sepolti = [lapide('2026-08-31', '09:30', 'Campo 1', '-Maurizio Aprea.')];
  const supp = [soppressione('2026-08-31', '09:30', 1, '2026-08-22T10:53:59.000Z')];
  assert.equal(sepoltiDaResuscitare(sepolti, supp, CONFINE).length, 1);
});

// ── VOCE 74 — in una LEZIONE non si salta nessuno ───────────────────────────────────────
//
// 🗣️ «Quando si tratta di una lezione, quei giocatori che stanno nell'elenco devono ricevere
// la notifica.» — committente, 22/08/2026.

/** Una fotografia in cui gli slot portano anche il tipo. */
function fotoT(tipo: string, ...slots: Array<[string, string[]]>): Map<string, SlotRoster> {
  const m = foto(...slots);
  for (const v of m.values()) v.tipo = tipo;
  return m;
}

test('42. una LEZIONE nuova avvisa anche il PRIMO — il caso di Maria Pia, che era sola', () => {
  // È il caso misurato il 22/08: lezione spostata, slot nuovo con un nome solo, zero fatti.
  const dopo = new Map([
    ...fotoT('Lezione Libera', ['2026-08-25|12:30|1', ['Maria Pia Bettiol']]),
    ...foto(...contorno(4)),
  ]);
  const f = fattiDaConfronto(foto(...contorno(4)), dopo, '2026-08-22');
  assert.equal(f.length, 1);
  assert.equal(f[0].persona, 'Maria Pia Bettiol');
  assert.equal(f[0].gesto, 'aggiunto');
  assert.equal(f[0].tipo, 'lezione', 'il fatto porta la parola NOSTRA, non quella di Matchpoint');
});

test('43bis. il fatto di una PARTITA porta `tipo: partita`, non il nome di Matchpoint', () => {
  const dopo = new Map([
    ...fotoT('Partita', ['2026-08-31|09:30|1', ['Maurizio Aprea', 'Lidia Comes']]),
    ...foto(...contorno(4)),
  ]);
  const f = fattiDaConfronto(foto(...contorno(4)), dopo, '2026-08-22');
  assert.equal(f[0].tipo, 'partita');
});

test('43. una PARTITA nuova continua a saltare il primo — la voce 70 non si riapre', () => {
  const dopo = new Map([
    ...fotoT('Partita', ['2026-08-31|09:30|1', ['Maurizio Aprea', 'Lidia Comes']]),
    ...foto(...contorno(4)),
  ]);
  const f = fattiDaConfronto(foto(...contorno(4)), dopo, '2026-08-22');
  assert.equal(f.length, 1);
  assert.equal(f[0].persona, 'Lidia Comes', 'l\'organizzatore non si annuncia da sé');
});

test('44. una LEZIONE con più giocatori li avvisa TUTTI', () => {
  const dopo = new Map([
    ...fotoT('Lezione Libera', ['2026-08-25|12:30|1', ['Maria Pia Bettiol', 'Carla Mattana']]),
    ...foto(...contorno(4)),
  ]);
  const f = fattiDaConfronto(foto(...contorno(4)), dopo, '2026-08-22');
  assert.deepEqual(f.map((x) => x.persona).sort(), ['Carla Mattana', 'Maria Pia Bettiol']);
});

test('45. `tipo` assente vale NON lezione: il comportamento di prima non cambia', () => {
  const dopo = new Map([
    ...foto(['2026-08-31|09:30|1', ['Maurizio Aprea', 'Lidia Comes']]),
    ...foto(...contorno(4)),
  ]);
  const f = fattiDaConfronto(foto(...contorno(4)), dopo, '2026-08-22');
  assert.equal(f.length, 1);
  assert.equal(f[0].persona, 'Lidia Comes');
});

test('46. un tipo SCONOSCIUTO non è una lezione — si tace, non si avvisa', () => {
  // 🚨 Il caso da cui la regola si difende: se domani Matchpoint aggiungesse «Torneo», una
  // regola scritta come «diverso da Partita» lo tratterebbe da lezione senza che nessuno se ne
  // accorga. Il verso in cui si sbaglia dev'essere tacere.
  assert.equal(eLezione('Torneo aziendale'), false);
  assert.equal(eLezione('Manutenzione'), false);
  assert.equal(eLezione(undefined), false);
  assert.equal(eLezione('Partita'), false);
  assert.equal(eLezione('Lezione Libera'), true);
  assert.equal(eLezione('lezione'), true);
  // 🔒 E ciò che ESCE non nomina mai Matchpoint: «Lezione Libera» è una parola sua.
  assert.equal(tipoDelloSlot('Lezione Libera'), 'lezione');
  assert.equal(tipoDelloSlot('Partita'), 'partita');
  assert.equal(tipoDelloSlot('Torneo aziendale'), 'partita');
  assert.equal(tipoDelloSlot(undefined), 'partita');
  const dopo = new Map([
    ...fotoT('Torneo aziendale', ['2026-08-25|12:30|1', ['Maria Pia Bettiol']]),
    ...foto(...contorno(4)),
  ]);
  assert.deepEqual(fattiDaConfronto(foto(...contorno(4)), dopo, '2026-08-22'), []);
});

test('47. il tipo viaggia anche sui fatti che NON nascono da uno slot nuovo', () => {
  // Serve al bot, che con quel campo sceglie la parola: senza, direbbe «partita» a una lezione.
  const prima = new Map([
    ...fotoT('Lezione Libera', ['2026-08-25|10:00|1', ['Maria Pia Bettiol', 'Carla Mattana']]),
    ...foto(...contorno(4)),
  ]);
  const tolto = fattiDaConfronto(
    prima,
    new Map([...fotoT('Lezione Libera', ['2026-08-25|10:00|1', ['Maria Pia Bettiol']]), ...foto(...contorno(4))]),
    '2026-08-22',
  );
  assert.equal(tolto.length, 1);
  assert.equal(tolto[0].gesto, 'tolto');
  assert.equal(tolto[0].tipo, 'lezione');

  const annullata = fattiDaConfronto(prima, foto(...contorno(4)), '2026-08-22');
  assert.equal(annullata.length, 2);
  assert.ok(annullata.every((x) => x.tipo === 'lezione' && x.gesto === 'annullata'));
});

test('48. dal payload al fatto: il tipo si legge dalla riga vera, non si passa a mano', () => {
  // La riga è quella misurata su PROD il 22/08, `tipo` compreso.
  const dopo = new Map([
    ...fotografia(
      [{ data: '2026-08-25', ora: '12:30', campo: 'Campo 1', descrizione: '-Maria Pia Bettiol.', tipo: 'Lezione Libera' }],
      roster,
    ),
    ...foto(...contorno(4)),
  ]);
  const f = fattiDaConfronto(foto(...contorno(4)), dopo, '2026-08-22');
  assert.equal(f.length, 1);
  assert.equal(f[0].persona, 'Maria Pia Bettiol');
  assert.equal(f[0].tipo, 'lezione', 'il fatto porta la parola NOSTRA, non quella di Matchpoint');
});

console.log(`\n${passed} passati, ${failed} falliti`);
if (failed > 0) process.exit(1);
