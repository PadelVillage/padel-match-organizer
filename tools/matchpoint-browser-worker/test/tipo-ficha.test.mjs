// Il PRIMO banco del worker. Fino al 20/08/2026 questa cartella non esisteva: `npm run check`
// era `node --check`, cioè «il file è sintatticamente valido» — che non è una prova di niente.
//
// ⚠️ Perché il banco può esistere solo adesso: `server.mjs` chiama `server.listen()` appena lo si
// importa, quindi non è importabile. Le prove qui sotto sono di due nature diverse, e la
// differenza va tenuta a mente leggendo un verde:
//   ① sulla FUNZIONE PURA (`tipo-ficha.mjs`) — prove vere, la si esegue;
//   ② sul SORGENTE di `server.mjs` — prove di CUCITURA: dicono che il pezzo è cablato dove deve,
//      e non che funziona. È la stessa forma usata dalle edge (`roster-slot.test.ts`), e serve
//      perché il difetto curato oggi era esattamente un cablaggio mancante: la regola c'era
//      scritta in un commento e non era collegata a niente.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  tipoFichaDa, annulloSupportato,
  CODICE_ANNULLO_NON_SUPPORTATO, MOTIVO_ANNULLO_NON_SUPPORTATO,
} from '../src/tipo-ficha.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const SORGENTE = fs.readFileSync(path.join(QUI, '..', 'src', 'server.mjs'), 'utf8');

const BASE = 'https://app-padelvillage-it.matchpoint.com.es';
const URL_PARTITA = `${BASE}/Reservas/FichaPartidaPagoPorUsuario.aspx?modo=fancy&id=9454`;
const URL_LEZIONE = `${BASE}/ClasesYCursos/FichaClaseSueltaPorUsuario.aspx?modo=fancy&id=9454`;
const URL_MANUT = `${BASE}/Reservas/FichaReservaMantenimiento.aspx?modo=fancy&id=9454`;

// ── ① la funzione pura ───────────────────────────────────────────────────────

test('riconosce i tre tipi dalle URL vere di Matchpoint', () => {
  assert.equal(tipoFichaDa(URL_PARTITA), 'partita');
  assert.equal(tipoFichaDa(URL_LEZIONE), 'lezione');
  assert.equal(tipoFichaDa(URL_MANUT), 'manutenzione');
});

test('la lezione vince sulla manutenzione: sono URL diverse, mai la stessa', () => {
  // Difende l'ORDINE dei due `if`: invertendoli una lezione resterebbe lezione (le due parole non
  // convivono in nessuna URL vera), ma l'ordine è comunque ciò che rende la funzione leggibile
  // come «prima il caso più specifico». Il caso qui sotto è quello che lo rende MISURATO.
  assert.equal(tipoFichaDa('/ClasesYCursos/ClaseSuelta_Mantenimiento.aspx'), 'lezione');
});

test('un URL sconosciuto ripiega su «partita», e non su «manutenzione»', () => {
  // 🚨 Il verso di questo ripiego è una decisione di sicurezza, non un dettaglio: sbagliando
  // verso, una scheda non riconosciuta diventerebbe «manutenzione» e il worker RIFIUTEREBBE
  // annulli legittimi — cioè la cura di oggi diventerebbe un guasto peggiore di quello curato.
  assert.equal(tipoFichaDa('https://esempio.invalido/qualcosa.aspx'), 'partita');
  assert.equal(tipoFichaDa(''), 'partita');
  assert.equal(tipoFichaDa(null), 'partita');
  assert.equal(tipoFichaDa(undefined), 'partita');
});

test('l\'annullo è supportato su partita e lezione, e NON sulla manutenzione', () => {
  assert.equal(annulloSupportato('partita'), true);
  assert.equal(annulloSupportato('lezione'), true);
  assert.equal(annulloSupportato('manutenzione'), false);
});

test('il motivo non nomina NESSUN pezzo interno — regola ferrea del 19/08', () => {
  // Questo testo può risalire fino al socio (vedi il commento in `tipo-ficha.mjs`). La regola del
  // committente: il bot non deve sentir nominare né il worker né Matchpoint.
  for (const parola of ['worker', 'matchpoint', 'browser', 'hetzner', 'playwright', 'anular']) {
    assert.ok(!MOTIVO_ANNULLO_NON_SUPPORTATO.toLowerCase().includes(parola),
      `il motivo nomina un pezzo interno: «${parola}»`);
  }
  // …e dice cosa FARE, altrimenti è un «no» e basta.
  assert.match(MOTIVO_ANNULLO_NON_SUPPORTATO, /tabellone/i);
});

// ── ② la cucitura dentro server.mjs ──────────────────────────────────────────

test('server.mjs importa la regola invece di riscriverla', () => {
  assert.match(SORGENTE, /from '\.\/tipo-ficha\.mjs'/,
    'il modulo non è importato: la regola sarebbe di nuovo una copia');
});

test('l\'annullo RIFIUTA prima di cercare il bottone di conferma', () => {
  // 🩹 ANCORAGGIO SBAGLIATO AL PRIMO GIRO, e il rosso era del CASO — 20/08. Cercavo la stringa
  // nuda `#CC_Datos_ButtonAnular`, che compare per PRIMA dentro un COMMENTO tre righe sopra il
  // ramo: il caso dichiarava «il rifiuto sta dopo il bottone» mentre il rifiuto stava dove
  // doveva. ⇒ Si ancora all'ATTESA vera (`waitFor`), che è la riga che costa i dieci secondi.
  // È la 24ª — *la sonda che guarda nel cassetto sbagliato* — dentro il banco che dovrebbe
  // difendere la cura: un caso che nomina il codice invece di eseguirlo può sbagliare bersaglio
  // senza che si veda, ed è il prezzo dichiarato delle prove di cucitura.
  const rifiuto = SORGENTE.indexOf('if (!annulloSupportato(tipoFicha))');
  const attesaBottone = SORGENTE.indexOf("locator('#CC_Datos_ButtonAnular').first().waitFor");
  assert.ok(rifiuto > 0, 'il ramo del rifiuto non c\'è');
  assert.ok(attesaBottone > 0, 'non trovo l\'attesa del bottone di conferma');
  assert.ok(rifiuto < attesaBottone,
    'il rifiuto sta DOPO l\'attesa: la manutenzione tornerebbe ad aspettare i 10 secondi');
});

test('il rifiuto sta DOPO «già annullata», così una manutenzione già cancellata risponde ok', () => {
  // ⭐ È il caso che difende l'ORDINE scelto. Invertendo, una manutenzione già cancellata
  // smetterebbe di rispondere `alreadyCancelled: true` e diventerebbe un errore: si romperebbe
  // un caso che funziona per curarne uno che non funziona.
  const giaAnnullata = SORGENTE.indexOf("diagnostic.steps.push('gia_annullata')");
  const rifiuto = SORGENTE.indexOf('if (!annulloSupportato(tipoFicha))');
  assert.ok(giaAnnullata > 0 && rifiuto > 0);
  assert.ok(giaAnnullata < rifiuto,
    'il rifiuto precede il controllo «già annullata»: una manutenzione già cancellata darebbe errore');
});

test('il rifiuto viaggia col suo codice e col suo motivo, non con un errore grezzo', () => {
  // Il difetto curato oggi usciva come timeout nudo di Playwright: `code: null` e nessuna
  // diagnostica nel registro. `fail()` invece attacca l'una e l'altro.
  assert.match(SORGENTE,
    /throw fail\(CODICE_ANNULLO_NON_SUPPORTATO, MOTIVO_ANNULLO_NON_SUPPORTATO, diagnostic\)/,
    'il rifiuto non passa da fail() coi nomi giusti: nel registro non resterebbe traccia del perché');
  assert.match(SORGENTE, /annullo_non_supportato:/,
    'manca il passo nella diagnostica: chi legge il registro non saprebbe che è stato rifiutato qui');
  assert.equal(CODICE_ANNULLO_NON_SUPPORTATO, 'ANNULLO_MANUTENZIONE_NON_SUPPORTATO');
});

test('i due commenti che si contraddicevano non si contraddicono più', () => {
  // 🩹 Il difetto di partenza: un commento diceva «MANUTENZIONE → non supportata, falliamo
  // subito» e la riga sotto diceva «PARTITA / LEZIONE / MANUTENZIONE» trattandole uguali.
  assert.ok(!SORGENTE.includes('PARTITA / LEZIONE / MANUTENZIONE'),
    'la riga che tratta i tre tipi uguali è ancora lì');
  assert.ok(!SORGENTE.includes("click_annulla:partita/lezione"),
    'il passo dichiara ancora due tipi insieme invece del tipo vero');
});
