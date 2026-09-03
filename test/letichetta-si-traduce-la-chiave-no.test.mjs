/* 🏷️ «L'etichetta si traduce, la chiave no» — banco della voce 128 (03/09/2026).
 *
 * 🗣️ LA RICHIESTA, sua, del 02/09 in due messaggi: *«chiamiamolo ovunque wallet»* e *«anche gli
 * altri chiamiamoli comunque cash e card, perché sono più brevi e mi aiutano quando apro la scheda
 * della partita a non andare a capo»*.
 * ⭐ La ragione è una MISURA, non un gusto: `Contanti`+`Carta`+`Borsellino` = 24 caratteri contro
 * `Cash`+`Card`+`Wallet` = 14, e nella scheda della partita la colonna è stretta.
 *
 * 🚨⭐⭐ PERCHÉ QUESTO BANCO ESISTE: la stessa parola fa due mestieri, e un `sed` cieco li confonde.
 *   · `view_members_borsellino` è una CHIAVE DI PERMESSO salvata nei profili staff sul database:
 *     rinominarla fa sparire la colonna, la fascia e il tab Pagamenti a chi li vedeva;
 *   · `come:'borsellino'`, `sel.borsellino`, `d.carta`, `pl.contanti` sono CHIAVI DI DATO
 *     dell'aggregazione della sezione Incassi: rinominarle manda i totali per metodo a zero;
 *   · su MATCHPOINT la voce si chiama «Saldo disponibile», e il worker la clicca PER TESTO:
 *     cambiarla vuol dire che l'incasso dal wallet non trova più il bottone.
 * 📌 *In una stessa parola convivono l'etichetta e la chiave: la prima si traduce, la seconda no —
 * e si distinguono solo guardandole una per una.*
 *
 * ⛔ E IL BOT RESTA IN ITALIANO, per sua decisione esplicita: *«non ti preoccupare che nel bot si
 * chiama Borsellino. Il bot lo vedono i soci, il gestionale di prod lo vede la segreteria.»*
 * ⇒ La stessa cosa ha QUATTRO nomi per ragioni buone, e questo banco è la tabella che li tiene
 * insieme: senza, il primo che ne trova due pensa di aver trovato un difetto — e «aggiusta».
 *
 * ⛔ Quello che questo banco NON dice: legge il repo del GESTIONALE. Il bot vive in un altro repo
 * (`assistente-padel-agent`) e da qui non si controlla.
 *
 * Esegui:  node test/letichetta-si-traduce-la-chiave-no.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = join(QUI, '..');
const APP = readFileSync(join(RADICE, 'index.html'), 'utf8');
const WORKER_PATH = join(RADICE, 'tools', 'matchpoint-browser-worker', 'src', 'server.mjs');

let passed = 0, failed = 0;
function test(nome, fn) {
  try { fn(); passed++; console.log('ok   - ' + nome); }
  catch (e) { failed++; console.log('FAIL - ' + nome + '\n       ' + e.message); }
}

/* ── LE ETICHETTE: quello che la segreteria legge ─────────────────────────── */
test('la segreteria legge Cash · Card · Wallet, non le tre parole italiane', () => {
  const m = APP.match(/const _PAY_METHOD_LABEL = \{([^}]+)\}/);
  assert.ok(m, '_PAY_METHOD_LABEL non c\'è più: se è stata rinominata, questo banco va aggiornato con lei');
  for (const [chiave, etichetta] of [['contanti', 'Cash'], ['carta', 'Card'], ['borsellino', 'Wallet']]) {
    assert.match(m[1], new RegExp(chiave + ":\\s*'" + etichetta + "'"),
      `_PAY_METHOD_LABEL deve tradurre ${chiave} → ${etichetta}: è la mappa da cui nascono le pastiglie di chi ha già pagato e la colonna «come» della scheda socio`);
  }
});

test('nessuna etichetta italiana è rimasta viva nel gestionale', () => {
  // La CLASSE, non i punti curati: un'etichetta italiana aggiunta domani cade qui.
  // Si guardano le stringhe letterali e i testi HTML, non i commenti — un commento che dice
  // «borsellino» descrive la chiave, ed è giusto che resti.
  const righe = APP.split('\n');
  const colpevoli = [];
  righe.forEach((riga, i) => {
    const t = riga.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    // valore di stringa: '…Borsellino…' / "…Contanti…"  ·  testo HTML: >Carta<
    if (/'[^']*\b(Borsellino|Contanti|Carta)\b[^']*'/.test(riga)
      || /"[^"]*\b(Borsellino|Contanti|Carta)\b[^"]*"/.test(riga)
      || />\s*(Borsellino|Contanti|Carta)\s*</.test(riga)) colpevoli.push((i + 1) + ': ' + t.slice(0, 90));
  });
  assert.deepEqual(colpevoli, [],
    'etichette italiane ancora mostrate alla segreteria (la 128 le vuole Cash/Card/Wallet):\n       ' + colpevoli.join('\n       '));
});

/* ── LE CHIAVI: quello che NON si traduce ─────────────────────────────────── */
test('la CHIAVE DI PERMESSO `view_members_borsellino` è intatta', () => {
  // Sta nei profili staff SUL DATABASE: rinominarla nel codice non rinomina i profili, e chi
  // vedeva la colonna/la fascia/il tab Pagamenti smette di vederli, senza errori.
  assert.ok(APP.includes('view_members_borsellino'),
    'la chiave di permesso è stata rinominata: la colonna, la fascia e il tab Pagamenti spariscono a chi li vedeva');
});

test('le CHIAVI DI DATO della sezione Incassi sono intatte', () => {
  // Se una di queste cambia nome, la somma si fa su un campo che non esiste e il totale per
  // metodo esce 0,00 € — senza nessun errore in console.
  for (const chiave of ["come: 'borsellino'", 'sel.borsellino', 'sel.carta', 'sel.contanti', 'd.borsellino', 'pl.borsellino']) {
    assert.ok(APP.includes(chiave),
      `la chiave di dato \`${chiave}\` è sparita: i totali per metodo della sezione Incassi vanno a zero`);
  }
  const m = APP.match(/const _PAY_METHOD_LABEL = \{([^}]+)\}/);
  for (const chiave of ['contanti', 'carta', 'borsellino']) {
    assert.match(m[1], new RegExp('(^|[\\s{,])' + chiave + '\\s*:'),
      `_PAY_METHOD_LABEL non ha più la chiave \`${chiave}\`: le pastiglie non trovano più la loro etichetta`);
  }
});

test('su MATCHPOINT la voce resta «Saldo disponibile»: il worker la clicca PER TESTO', () => {
  if (!existsSync(WORKER_PATH)) { console.log('       (worker non presente in questo checkout: saltato)'); return; }
  const W = readFileSync(WORKER_PATH, 'utf8');
  const m = W.match(/cobroMethodLabels:\s*\{([^}]+)\}/);
  assert.ok(m, 'cobroMethodLabels non c\'è più nel worker: è la mappa con cui sceglie la forma di pagamento nel dialog di Matchpoint');
  assert.match(m[1], /borsellino:\s*'Saldo disponibile'/,
    'la voce del dialog Matchpoint è stata tradotta: il worker la cerca PER TESTO, quindi l\'incasso dal wallet non troverebbe più il bottone');
  assert.match(m[1], /contanti:\s*'Contanti'/,
    'idem per i contanti: quelle sono le parole che Matchpoint scrive, non le nostre');
  assert.match(m[1], /carta:\s*'Carta'/,
    'idem per la carta: quelle sono le parole che Matchpoint scrive, non le nostre');
});

/* ── LA COLONNA «COME»: scriveva la chiave grezza ─────────────────────────── */
test('la colonna «come» della scheda socio mostra l\'ETICHETTA, non la chiave', () => {
  // Prima scriveva `r.come` così com'è — cioè `contanti`/`carta`/`borsellino` in minuscolo —
  // ed era metà del difetto che lui ha visto: le due metà dello stesso pannello parlavano
  // due lingue.
  const i = APP.indexOf('class="pmo-pag-come"');
  assert.ok(i > 0, 'la colonna «come» non c\'è più');
  const riga = APP.slice(i, APP.indexOf('\n', i));
  assert.ok(riga.includes('_PAY_METHOD_LABEL'),
    'la colonna «come» scrive di nuovo la chiave grezza invece dell\'etichetta');
});

console.log('\n' + passed + ' passati, ' + failed + ' falliti');
process.exit(failed ? 1 : 0);
