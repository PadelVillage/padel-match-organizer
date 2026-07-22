// Test deterministici dell'aggancio incasso→socio (nessuna dipendenza esterna).
// Esegui:  node supabase/functions/matchpoint-payments-sync/member-code-guard.test.ts
//
// ⭐ TARATURA — verificata SABOTANDO il codice, non solo guardandola verde. Il fix ha due metà
// indipendenti e ognuna ha il caso che la isola:
//
//   sabotaggio                                        casi che diventano rossi
//   ─────────────────────────────────────────────     ────────────────────────
//   nessuno                                           —  (tutti verdi)
//   isMatchpointMemberCode → sempre true              D, F, G, H, I
//   tolta la potatura dei codici ambigui (codeCount)  B
//   tutti e due (= il codice del 22/07)               A, B, D, F, G, H, I
//
// 🚨 Tabella MISURATA sabotando, non prevista — e la previsione era sbagliata. Il caso A (quello
// REALE, 326) da solo NON discrimina l'esclusione dei PMO-: senza di essa Giorgia e Fava si
// riducono entrambi a "326", scatta la potatura degli AMBIGUI e il codice non aggancia più
// nessuno, così il ripiego sul nome riporta comunque a Fava. A resta verde per la metà sbagliata
// del fix. Serviva il caso I — un PMO- il cui numero non collide con nessun cliente Matchpoint,
// dove la potatura non ha niente da potare e solo l'esclusione può salvare l'incasso.
// (Stesso inganno del caso A di matchpoint-clients-sync/phone-guard.test.ts.)
//
// I casi C/D/E sono controlli NEGATIVI: se il fix escludesse troppo — cioè se rompesse
// l'aggancio buono invece di solo quello sbagliato — diventerebbero rossi loro.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildMemberIndex, lookupMemberForRow, isMatchpointMemberCode } from './member-code-guard.ts';

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

const m = (local_key: string, payload: Record<string, unknown>) => ({ local_key, payload });

// A) Il caso reale misurato in PROD il 22/07. Giorgia Balzarini è un socio creato dall'app
//    (PMO-000326, nessun euro mai speso); Stefano Fava è il cliente Matchpoint 000326. Il report
//    porta id_cliente=326, che È il codice di Fava. Giorgia è messa PER PRIMA di proposito:
//    è l'ordine che faceva vincere lei ("primo vince" su un indice non deterministico).
const CASO_REALE = [
  m('phone:393889216485', { id: 'giorgia', name: 'Giorgia Balzarini', memberId: 'PMO-000326' }),
  m('phone:393401112233', { id: 'fava', name: 'Stefano Fava', memberId: '000326' }),
];

test('il codice del report va al cliente Matchpoint, non al gemello PMO- (caso 326)', () => {
  const idx = buildMemberIndex(CASO_REALE);
  const rec = lookupMemberForRow(idx, { cod: '326', name: 'Stefano Fava' });
  assert.equal(rec?.payload.id, 'fava');
});

// B) ⭐ ISOLA la potatura dei codici ambigui. Due clienti Matchpoint che si riducono allo stesso
//    numero ("326" e "000326"): nessuno dei due può vincere per codice, perché chi vince lo
//    deciderebbe l'ordine di pagina. Si ripiega sul nome, che qui è univoco e corretto.
//    Togli la potatura e il "primo vince" attacca l'incasso a Tizio → rosso.
test('TARATURA ambiguità: due codici Matchpoint che collidono non agganciano per codice', () => {
  const idx = buildMemberIndex([
    m('a', { id: 'tizio', name: 'Tizio Primo', memberId: '326' }),
    m('b', { id: 'caio', name: 'Caio Secondo', memberId: '000326' }),
  ]);
  assert.equal(idx.byCode.has('326'), false);
  const rec = lookupMemberForRow(idx, { cod: '326', name: 'Caio Secondo' });
  assert.equal(rec?.payload.id, 'caio');
});

// C) CONTROLLO NEGATIVO — l'aggancio per codice normale deve continuare a funzionare. Se il fix
//    escludesse i codici in generale (invece dei soli PMO-) questo diventerebbe rosso.
test('un cliente Matchpoint qualunque resta agganciabile per codice', () => {
  const idx = buildMemberIndex([m('c', { id: 'tomasin', name: 'Christian Tomasin', memberId: '000948' })]);
  assert.equal(lookupMemberForRow(idx, { cod: '948' })?.payload.id, 'tomasin');
});

// D) CONTROLLO NEGATIVO — un socio creato dall'app NON deve restare orfano: esce dall'indice dei
//    CODICI, non dagli altri due. Altrimenti il fix gli toglierebbe anche gli incassi suoi.
test('un socio PMO- resta agganciabile per email e per nome', () => {
  const idx = buildMemberIndex([
    m('d', { id: 'giorgia', name: 'Giorgia Balzarini', memberId: 'PMO-000326', email: 'G.Balzarini@Example.com' }),
  ]);
  assert.equal(idx.byCode.size, 0);
  assert.equal(lookupMemberForRow(idx, { email: 'g.balzarini@example.com' })?.payload.id, 'giorgia');
  assert.equal(lookupMemberForRow(idx, { name: 'giorgia  balzarini' })?.payload.id, 'giorgia');
});

// E) CONTROLLO NEGATIVO — la guardia sugli OMONIMI c'era già (#4) e non deve essersi persa
//    nell'estrazione in modulo.
test('i nomi omonimi restano esclusi dal match per nome', () => {
  const idx = buildMemberIndex([
    m('e1', { id: 'uno', name: 'Mario Rossi' }),
    m('e2', { id: 'due', name: 'Mario Rossi' }),
  ]);
  assert.equal(lookupMemberForRow(idx, { name: 'Mario Rossi' }), undefined);
});

// F) ⭐ La PRECEDENZA è metà del difetto: il codice è provato per PRIMO, quindi una collisione di
//    codice BATTE un'email che sarebbe corretta. Qui l'email punta a Giorgia e il codice a Fava:
//    senza il fix vincerebbe Giorgia per codice; col fix il codice va a Fava, che è il pagatore.
test('il codice batte l\'email — perciò deve essere quello GIUSTO', () => {
  const idx = buildMemberIndex(CASO_REALE);
  const rec = lookupMemberForRow(idx, { cod: '326', email: '' });
  assert.equal(rec?.payload.id, 'fava');
  // e il ripiego resta vivo quando il codice non aggancia nessuno
  const solaEmail = buildMemberIndex([m('f', { id: 'x', name: 'X', email: 'x@y.z' })]);
  assert.equal(lookupMemberForRow(solaEmail, { cod: '999', email: 'x@y.z' })?.payload.id, 'x');
});

// G) Il cod arriva già normalizzato dal parser, ma la chiave si ricalcola comunque da entrambi i
//    lati: "000326" e "326" sono lo stesso codice e devono agganciare lo stesso socio.
test('gli zeri iniziali non cambiano l\'aggancio', () => {
  const idx = buildMemberIndex(CASO_REALE);
  assert.equal(lookupMemberForRow(idx, { cod: '000326' })?.payload.id, 'fava');
  assert.equal(lookupMemberForRow(idx, { cod: '326' })?.payload.id, 'fava');
});

// H) La discriminante, messa nero su bianco: è ciò che separa i due spazi di numerazione.
test('solo un codice di sole cifre è un codice Matchpoint', () => {
  assert.equal(isMatchpointMemberCode('000326'), true);
  assert.equal(isMatchpointMemberCode('PMO-000326'), false);
  assert.equal(isMatchpointMemberCode('pmo-000326'), false);
  assert.equal(isMatchpointMemberCode(''), false);
  // un prefisso futuro diverso da PMO- resta fuori da solo: è il motivo del test positivo
  assert.equal(isMatchpointMemberCode('APP-000326'), false);
});

// I) ⭐ ISOLA l'esclusione dei PMO-, ed è l'unico caso che ci riesce. Il pagatore (Christian
//    Tomasin, cliente Matchpoint 000948) NON è ancora in anagrafica; c'è però un socio creato
//    dall'app il cui progressivo si riduce allo stesso "948". Qui la potatura degli ambigui non
//    ha nulla da potare — il codice è uno solo — quindi l'incasso si salva SOLO se un PMO- non
//    entra affatto nell'indice dei codici. Senza l'esclusione finisce nella scheda di "Utente
//    Test", che è esattamente il danno misurato in PROD.
//    Nessun match è l'esito GIUSTO: l'incasso resta in cassa, ma non attribuito a un estraneo.
test('TARATURA esclusione: un PMO- non aggancia un codice Matchpoint nemmeno da solo', () => {
  const idx = buildMemberIndex([
    m('i', { id: 'utente-test', name: 'Utente Test', memberId: 'PMO-000948' }),
  ]);
  assert.equal(idx.byCode.size, 0);
  assert.equal(lookupMemberForRow(idx, { cod: '948', name: 'Christian Tomasin' }), undefined);
});

// J) ⚠️ ANTI-DERIVA. Il modulo esiste in DUE copie — matchpoint-payments-sync e
//    matchpoint-wallet-sync — perché il workflow di deploy sceglie le funzioni dalle cartelle
//    toccate e SCARTA quelle che iniziano per "_": un modulo in _shared/, modificato da solo,
//    non deployerebbe nulla (trappola già presente nel repo con _shared/aiUsage.ts, importato
//    da 4 funzioni AI). La copia è il male minore, ma va sorvegliata: è esattamente così che
//    un fix si riapre — una delle due copie viene aggiornata e l'altra no.
test('i due gemelli del modulo sono IDENTICI', () => {
  const functionsDir = dirname(dirname(fileURLToPath(import.meta.url)));
  const copie = ['matchpoint-payments-sync', 'matchpoint-wallet-sync']
    .map((fn) => join(functionsDir, fn, 'member-code-guard.ts'));
  const [a, b] = copie.map((p) => readFileSync(p, 'utf8'));
  assert.equal(a, b, `member-code-guard.ts è DIVERGENTE fra le due function:\n  ${copie.join('\n  ')}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
