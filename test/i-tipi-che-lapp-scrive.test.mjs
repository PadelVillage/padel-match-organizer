// i-tipi-che-lapp-scrive.test.mjs — VOCE 109 (29/08/2026)
//
// 🚨⭐⭐ IL GUASTO CHE QUESTO BANCO ESISTE PER FERMARE, misurato su PROD.
// Quali `record_type` si possono scrivere nel cloud è dichiarato in DUE posti che devono
// restare in passo e non lo erano:
//   ① il vincolo della TABELLA (`pmo_cloud_records_type_check`) — 22 tipi, `payment` compreso
//      dal 27/06/2026;
//   ② la lista DENTRO `pmo_upsert_records_admin` — ferma a 15, mai estesa.
// ⇒ I sette tipi che stanno solo nella prima venivano scartati dalla seconda **in silenzio**:
// `ok: true` con `count: 0`.
//
// 📏 Il prezzo, misurato: **67 spinte su 411** in quindici giorni hanno scritto ZERO record, e
// nel cloud ci sono **3032** record `payment` di cui **ZERO** scritti dall'app. Ogni «quota
// offerta» registrata dalla segreteria è andata perduta — visibile sullo schermo fino al primo
// ricaricamento, perché l'indice locale si scrive senza aspettare la sync.
//
// ⚖️ COSA QUESTO BANCO PRETENDE, E COSA NO — ed è la differenza che lo rende utile.
// **NON** pretende che le due liste siano uguali: non devono esserlo, e imporlo darebbe al
// browser il permesso di scrivere `wallet_txn` e `wallet_balance`, che nessuno gli chiede
// (decisione del committente del 29/08: *si allarga su un bisogno misurato, non per simmetria*).
// **Pretende** che ogni tipo che l'APP spinge davvero stia in tutt'e due — cioè che nessun tipo
// usato cada nella fessura fra le due liste, che è esattamente il difetto di cui sopra.
// 📌 *Due liste che devono restare in passo non si tengono con la buona volontà: si tengono con
// qualcosa che diventa rosso.*
//
// 🚨 Le liste si leggono dalla migrazione PIÙ RECENTE che le definisce, non da un nome di file
// scritto qui: chi ne aggiunge una nuova non deve ricordarsi di aggiornare anche questo banco.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = join(QUI, '..');
const html = readFileSync(join(RADICE, 'index.html'), 'utf8');

const MIGRAZIONI = join(RADICE, 'supabase', 'migrations');
const files = readdirSync(MIGRAZIONI).filter(f => f.endsWith('.sql')).sort();

/** L'ultima migrazione che contiene il blocco cercato vince: è quella in servizio. */
function ultimaChe(regex) {
  for (let i = files.length - 1; i >= 0; i--) {
    const testo = readFileSync(join(MIGRAZIONI, files[i]), 'utf8');
    const m = testo.match(regex);
    if (m) return { file: files[i], blocco: m[1] };
  }
  return null;
}

function tipiDa(blocco) {
  // I commenti in italiano sono pieni di apostrofi: si tolgono prima di cercare le stringhe,
  // o una parola fra apostrofi dentro un commento entrerebbe nella lista.
  const pulito = blocco.replace(/--[^\n]*/g, ' ');
  return new Set(pulito.match(/'([a-z_]+)'/g)?.map(x => x.replace(/'/g, '')) ?? []);
}

const rpc = ultimaChe(/record_type in \(([\s\S]*?)\)\s*\)/);
const tabella = ultimaChe(/pmo_cloud_records_type_check[\s\S]*?CHECK \(record_type = ANY \(ARRAY\[([\s\S]*?)\]/i);

test('le due liste si trovano: senza, un verde qui vorrebbe dire «non ho controllato»', () => {
  assert.ok(rpc, 'nessuna migrazione definisce la lista dentro pmo_upsert_records_admin');
  assert.ok(tabella, 'nessuna migrazione definisce il vincolo pmo_cloud_records_type_check');
});

const tipiRpc = tipiDa(rpc.blocco);
const tipiTabella = tipiDa(tabella.blocco);

/** I `record_type` che l'app COSTRUISCE per spingerli nel cloud. */
const tipiApp = new Set(
  (html.match(/record_type:\s*'([a-z_]+)'/g) ?? []).map(x => x.replace(/.*'([a-z_]+)'.*/, '$1')),
);

test('l’app spinge almeno i tipi che ci aspettiamo: la sonda guarda dove deve', () => {
  assert.ok(tipiApp.size >= 5, `trovati solo ${tipiApp.size} tipi in index.html: è cambiata la forma della riga?`);
  assert.ok(tipiApp.has('member'), 'nemmeno «member»: la sonda non sta leggendo il posto giusto');
  assert.ok(tipiApp.has('payment'), 'l’app non spinge più «payment»: se è voluto, va tolto anche da qui');
});

test('🚨 ogni tipo che l’app scrive è ammesso dalla RPC — è il difetto della voce 109', () => {
  const fuori = [...tipiApp].filter(t => !tipiRpc.has(t)).sort();
  assert.deepEqual(fuori, [],
    `l’app spinge ${fuori.join(', ')} ma ${rpc.file} non li ammette: verrebbero scartati in SILENZIO (ok:true, count:0)`);
});

test('🚨 ogni tipo che l’app scrive è ammesso dal vincolo della tabella', () => {
  const fuori = [...tipiApp].filter(t => !tipiTabella.has(t)).sort();
  assert.deepEqual(fuori, [],
    `l’app spinge ${fuori.join(', ')} ma il vincolo in ${tabella.file} li rifiuta: la scrittura fallirebbe`);
});

test('la RPC non ammette tipi che la tabella rifiuterebbe: sarebbe un permesso che non serve a niente', () => {
  // ⚖️ Questo verso sì che dev'essere stretto: un tipo ammesso dalla RPC e vietato dalla tabella
  // farebbe fallire l'intero lotto sul vincolo, portandosi via anche i record buoni.
  const fuori = [...tipiRpc].filter(t => !tipiTabella.has(t)).sort();
  assert.deepEqual(fuori, [], `la RPC ammette ${fuori.join(', ')} che la tabella rifiuta`);
});

test('📌 le due liste NON devono essere uguali, e questo banco non lo pretende', () => {
  // Sta qui per dire una cosa che altrimenti la prossima sessione proverebbe a «sistemare»:
  // la tabella ne accetta di più della RPC, ed è VOLUTO. `wallet_txn` e `wallet_balance`
  // riguardano soldi e l'app non li scrive mai — decisione del committente del 29/08/2026.
  const soloTabella = [...tipiTabella].filter(t => !tipiRpc.has(t));
  assert.ok(soloTabella.length > 0,
    'le due liste coincidono: se è stato fatto apposta, questa prova va tolta con la sua ragione');
  assert.ok(soloTabella.every(t => !tipiApp.has(t)),
    'un tipo che sta solo nella tabella è anche spinto dall’app: è di nuovo la fessura della voce 109');
});
