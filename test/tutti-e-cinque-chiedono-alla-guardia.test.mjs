// 🚨⭐⭐ TUTTI E CINQUE I GESTI CHIEDONO ALLA GUARDIA — voce 106, 29/08/2026.
//
// 📏 IL FATTO. Il 29/08 alle 15:28:58 il bot ha detto «Fabiola Limuti: non ci sono riuscito»
// su una rimozione di cui NESSUNO sapeva l'esito: sotto c'era un `locator.click: Timeout
// 8000ms`, e un timeout non dice se la scrittura è arrivata. Il gestionale ha tradotto un
// esito IGNOTO in «non è passata» — un'affermazione sul passato che da lì non si può fare.
//
// 🔎 LA CAUSA non era un difetto nuovo: `esitoIgnotoDaRisposta` esisteva dal 19/08, ma la
// chiamava **un ramo solo** (`create`). Gli altri quattro rispondevano `scrittura_rifiutata`
// comunque, e il commento della funzione lo dichiarava — per un motivo che allora reggeva:
// il bot non aveva nessuna frase «non lo so» per quei gesti.
//
// ⚖️ COSA SORVEGLIA QUESTO BANCO, e cosa no:
//   ✅ che tutti e cinque i rami la chiamino, e che nessuno scriva la parola a mano;
//   ⛔ NON prova cosa legge il socio: quello sta di là, nel repo del bot
//      (`test/non-lo-so-sui-quattro-gesti.test.ts`). I due lati sono un contratto solo e si
//      cambiano insieme — questo file guarda la metà che parla, quello la metà che ascolta.
//
// 📌 *Chiamare la guardia giusta non serve se la guardia non la chiama nessuno* — che è la
//   coda della lezione già scritta il 23/08 nel riquadro della voce 83, un piano più in su.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const QUI = dirname(fileURLToPath(import.meta.url));
const CARTELLA = join(QUI, '..', 'supabase', 'functions', 'consumer-booking-write');
const index = readFileSync(join(CARTELLA, 'index.ts'), 'utf8');
const modulo = readFileSync(join(CARTELLA, 'esito-scrittura.ts'), 'utf8');

/** Il codice senza commenti: il banco deve misurare il CODICE, non la prosa che lo spiega. */
const codice = index.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/** I cinque gesti che scrivono, col nome che compare nel loro `console.error`. */
const GESTI = ['create', 'leave', 'remove', 'add', 'cancel'];

test('la guardia dell\'esito ignoto esiste ed è esportata', () => {
  assert.ok(/export function esitoIgnotoDaRisposta/.test(modulo),
    'esitoIgnotoDaRisposta non è più esportata: il banco non sa più cosa sorvegliare');
  assert.ok(/export const MOTIVO_ESITO_IGNOTO/.test(modulo),
    'manca la costante MOTIVO_ESITO_IGNOTO: la parola tornerebbe scritta a mano');
});

test('🚨⭐⭐ tutti e CINQUE i rami che scrivono la interrogano', () => {
  // ⚖️ Si conta sulle CHIAMATE e non sui nomi dei gesti: un ramo può cambiare nome, ma se
  // smette di chiedere alla guardia il conto cala — ed è quello il difetto.
  const chiamate = (codice.match(/esitoIgnotoDaRisposta\s*\(/g) ?? []).length;
  assert.equal(chiamate, GESTI.length,
    `la guardia è chiamata ${chiamate} volte invece di ${GESTI.length}: qualche gesto è tornato a dire «rifiutata» su un esito che non conosce`);
});

test('🚨 e nessuno di loro decide da solo: il `reason` esce sempre dal ternario', () => {
  // Un `reason: MOTIVO_SCRITTURA_RIFIUTATA` nudo su un ramo di scrittura è la forma esatta
  // del difetto del 29/08: afferma «non è passata» senza aver chiesto a nessuno.
  const nudi = (codice.match(/reason:\s*MOTIVO_SCRITTURA_RIFIUTATA\s*,/g) ?? []).length;
  assert.equal(nudi, 0,
    `${nudi} rami rispondono «rifiutata» senza passare dalla guardia`);
});

test('⛔ la parola non è scritta a mano da nessuna parte', () => {
  // 🚨 Era in tre punti fino al 29/08. Tre copie di una parola divergono al primo
  // ripensamento — e qui il ripensamento cambierebbe cosa legge un socio.
  const aMano = (codice.match(/'esito_ignoto'|"esito_ignoto"/g) ?? []).length;
  assert.equal(aMano, 0, `la parola «esito_ignoto» è scritta a mano ${aMano} volte invece di venire dalla costante`);
});

test('📌 il registro distingue i due casi, o la prossima diagnosi ricomincia da zero', () => {
  // ⚠️ Trappola ③ del 29/08, pagata sulle 67 spinte a vuoto: *un registro che annota il
  // risultato e non l'oggetto non può chiudere una diagnosi.* Qui il `console.error` deve
  // dire se quel KO era un rifiuto o un ignoto: senza, fra un mese si rilegge un elenco di
  // «KO HTTP 500» tutti uguali.
  // ⚠️ Si conta la forma CONDIZIONALE — quella che distingue i due esiti sullo stesso KO —
  // e non ogni occorrenza della parola: `create` e `add` hanno anche un ramo «nessuna
  // risposta» che è ignoto *per costruzione* e lo scrive dritto, senza ternario.
  const marchi = (codice.match(/\?\s*' \(ESITO IGNOTO\)'\s*:\s*''/g) ?? []).length;
  assert.equal(marchi, GESTI.length,
    `solo ${marchi} rami su ${GESTI.length} distinguono nel registro un rifiuto da un ignoto`);
});

test('⚖️ e il commento del modulo non dichiara più il limite che è stato tolto', () => {
  // 🚨 Regola di casa: *quando una misura smentisce una riga vecchia, la riga si CORREGGE,
  // non si affianca* — o il file smette di essere una fonte e diventa un archivio di
  // versioni. Il commento diceva «oggi la chiama solo il ramo create»: era vero, e non lo è
  // più. ⚠️ Prova TESTUALE, e si dichiara: sorveglia la prosa, non il comportamento.
  assert.ok(!/Oggi la chiama\s*\n?\s*\*?\s*solo il ramo `create`/.test(modulo),
    'il modulo dichiara ancora che solo `create` chiama la guardia: la riga è falsa da oggi');
});
