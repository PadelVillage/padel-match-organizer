// Test deterministici della guardia sui soci assenti dall'export (nessuna dipendenza esterna).
// Esegui:  node supabase/functions/matchpoint-clients-sync/stale-guard.test.ts
//
// ⭐ TARATURA — tabella MISURATA sabotando il codice una modifica alla volta, non prevista a
// tavolino. (Vedi la testata di stale-guard.ts per il perché delle regole.)
//
//   sabotaggio                                              casi che diventano rossi
//   ─────────────────────────────────────────────────────── ────────────────────────
//   nessuno                                                 —  (tutti verdi)
//   tolto il controllo churn (codice presente nell'import)   A, G
//   tolta la guardia isMatchpointCode                        E, F
//   `active === false` valutato PRIMA del churn              G
//   tolto del tutto il controllo su `active === false`       D
//   tolto il filtro «è un record Matchpoint»                 C
//   MP riconosciuto dal solo `source` (via matchpointImportedAt)  H
//   la disattivazione scrive `deleted: true`                 I
//   activeFieldsOnImport non riattiva mai (= comportamento vecchio)  L
//   activeFieldsOnImport riattiva sempre (ignora la scelta a mano)   K
//   esito ② = tombstone  (= IL CODICE DI PRIMA della modifica)  B, H
//
// Ogni sabotaggio ne fa cadere almeno uno: nessuna metà della regola è priva del caso che la
// isola. L'unico caso che non discrimina nulla è J — è la linea di base (socio normale, nessun
// marcatore), tenuta apposta perché documenta il comportamento invariato.
import assert from 'node:assert/strict';
import {
  activeFieldsOnImport,
  buildDeactivatedMemberRecord,
  decideStaleMember,
  MATCHPOINT_INACTIVE_REASON,
} from './stale-guard.ts';

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

const IMPORTED = new Set(['001068', '000010', '001070']);

// ── decideStaleMember ────────────────────────────────────────────────────────

// A) Caso REALE del 19/07: Stefano Longato aveva due chiavi (`phone:39347411`, dal telefono
//    troncato, e `phone:393474242644`), l'import ne ha ri-chiavata una e l'altra è rimasta
//    indietro. Il codice 001068 è ancora nell'export ⇒ doppione morto, si pota.
test('A · churn di chiave: il codice è ancora nell\'import → tombstone (Longato 001068)', () => {
  assert.equal(
    decideStaleMember({ source: 'matchpoint_auto', memberId: '001068', active: true }, IMPORTED),
    'tombstone',
  );
});

// B) Caso che il percorso non ha MAI incontrato: disiscritto su Matchpoint. Il codice non c'è in
//    nessuna riga dell'export ⇒ è uscito davvero, e va disattivato, non fatto sparire.
//    (000344 = Giorgia Balzarini, scheda disattivata su Matchpoint.)
test('B · uscita vera: codice assente dall\'import → deactivate (000344)', () => {
  assert.equal(
    decideStaleMember({ source: 'matchpoint_auto', memberId: '000344', active: true }, IMPORTED),
    'deactivate',
  );
});

// C) Un record che Matchpoint non ha mai toccato (nato nell'app o dalla rubrica Google) non è
//    governato dall'export: non si tocca. Era già così prima ed è la garanzia che questa regola
//    non allarga il proprio raggio.
test('C · record non-Matchpoint → keep', () => {
  assert.equal(
    decideStaleMember({ memberId: 'PMO-000326', active: true }, IMPORTED),
    'keep',
  );
});

// D) Già disattivato (dallo staff, o da una passata precedente di questa stessa regola):
//    riscriverlo non aggiunge nulla e ribatterebbe `updatedAt` a ogni import.
test('D · già inattivo e assente → keep (nessuna riscrittura a ogni passata)', () => {
  assert.equal(
    decideStaleMember({ source: 'matchpoint_auto', memberId: '000344', active: false }, IMPORTED),
    'keep',
  );
});

// E) Senza codice Matchpoint non c'è l'identificatore su cui l'export è autorevole: comportamento
//    di prima, tombstone. Isola la guardia `isMatchpointCode` dal lato del codice VUOTO.
test('E · MP-sourced senza codice → tombstone (comportamento invariato)', () => {
  assert.equal(
    decideStaleMember({ source: 'matchpoint_auto', memberId: '', active: true }, IMPORTED),
    'tombstone',
  );
});

// F) ⭐ ISOLA `isMatchpointCode` dal lato del segnaposto: un `PMO-…` Matchpoint non lo conosce,
//    quindi «assente dall'export» non significa niente. Senza questo controllo il caso finirebbe
//    in ② e disattiveremmo soci che nessuno ha disiscritto.
test('F · MP-sourced con codice PMO- → tombstone', () => {
  assert.equal(
    decideStaleMember({ source: 'matchpoint_auto', memberId: 'PMO-061980', active: true }, IMPORTED),
    'tombstone',
  );
});

// G) ⭐ ISOLA L'ORDINE delle regole: doppione morto (codice presente) che era ANCHE già inattivo.
//    Se il controllo su `active === false` venisse prima, la chiave morta resterebbe viva per
//    sempre come scheda «disattivata» — cioè un doppione visibile in anagrafica.
test('G · doppione morto già inattivo → tombstone, non keep', () => {
  assert.equal(
    decideStaleMember({ source: 'matchpoint_auto', memberId: '001070', active: false }, IMPORTED),
    'tombstone',
  );
});

// H) ⭐ ISOLA la seconda metà del riconoscimento «è un record Matchpoint»: `source` vuoto ma
//    `matchpointImportedAt` valorizzato (record importati prima che si scrivesse `source`).
test('H · MP riconosciuto dal solo matchpointImportedAt → deactivate', () => {
  assert.equal(
    decideStaleMember({ matchpointImportedAt: '2026-07-01T05:00:00.000Z', memberId: '000344', active: true }, IMPORTED),
    'deactivate',
  );
});

// ── buildDeactivatedMemberRecord ─────────────────────────────────────────────

// I) La scheda deve RESTARE (deleted:false) e conservare il payload: è tutta la differenza col
//    tombstone. Il livello curato nell'app è il dato che il tombstone si portava via.
test('I · disattivazione: deleted resta false e il payload è conservato', () => {
  const out = buildDeactivatedMemberRecord(
    { local_key: 'phone:393889216485', payload: { memberId: '000344', level: 4, name: 'Giorgia Balzarini', active: true } },
    '2026-07-22T20:00:00.000Z',
  );
  assert.equal(out.deleted, false);
  assert.equal(out.payload.active, false);
  assert.equal(out.payload.level, 4);
  assert.equal(out.payload.name, 'Giorgia Balzarini');
  assert.equal(out.payload.matchpointInactiveReason, MATCHPOINT_INACTIVE_REASON);
  assert.equal(out.payload.matchpointInactiveAt, '2026-07-22T20:00:00.000Z');
  // Non deve fingersi un tombstone: il report giornaliero legge questi due campi.
  assert.equal(out.payload.matchpointDeletedAt, undefined);
  assert.equal(out.payload.matchpointDeleteReason, undefined);
});

// ── activeFieldsOnImport ─────────────────────────────────────────────────────

// J) Socio normale: nessun marcatore, resta attivo.
test('J · esistente attivo → active true, nessun marcatore', () => {
  assert.deepEqual(activeFieldsOnImport({ active: true }), { active: true });
});

// K) ⭐ Disattivazione MANUALE dello staff: non ha il marcatore e NON va sciolta dall'import.
//    È il caso che impedisce a questa regola di calpestare una decisione umana.
test('K · disattivato a mano → resta disattivato', () => {
  assert.deepEqual(activeFieldsOnImport({ active: false }), { active: false });
});

// L) ⭐ Il socio torna nell'export dopo un «Riattivare» su Matchpoint: la disattivazione
//    automatica si scioglie e i marcatori si azzerano. Senza questo, la riattivazione fatta su
//    Matchpoint non arriverebbe MAI — lo stesso guasto che stiamo chiudendo, al contrario.
test('L · disattivato da noi e tornato nell\'export → riattivato, marcatori azzerati', () => {
  assert.deepEqual(
    activeFieldsOnImport({ active: false, matchpointInactiveReason: MATCHPOINT_INACTIVE_REASON, matchpointInactiveAt: '2026-07-22T20:00:00.000Z' }),
    { active: true, matchpointInactiveAt: '', matchpointInactiveReason: '' },
  );
});

console.log(`\n${passed} passati, ${failed} falliti`);
if (failed) process.exit(1);
