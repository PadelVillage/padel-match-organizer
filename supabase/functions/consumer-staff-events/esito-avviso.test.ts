// Il PERCHÉ di una riga chiusa (voce 68) — test deterministici, nessuna rete.
// Esegui:  node supabase/functions/consumer-staff-events/esito-avviso.test.ts
//
// ⭐ IL CASO 4 È QUELLO CHE PROTEGGE LA DECISIONE e non un calcolo: dice che `consegnato_at`
// e `esito` rispondono a due domande diverse, e che la prima non si può dedurre dalla seconda
// né viceversa. È l'intera ragione per cui la colonna esiste.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ESITO, ESITI, ePassatoAlBot } from './esito-avviso.ts';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed += 1; console.log(`ok   - ${name}`); }
  catch (e) { failed += 1; console.log(`FAIL - ${name}`); console.log(`       ${(e as Error).message.split('\n')[0]}`); }
}

test('1. gli esiti sono SEI, distinti, e in minuscolo', () => {
  /* 🔢 Da 5 a 6 il 05/09/2026 con `gesto_dal_bot` (voce 115): la strada della ricevuta
   * (voce 70) chiudeva le righe senza scrivere PERCHÉ, e il suo NULL era indistinguibile
   * dalle 605 righe chiuse prima che la colonna esistesse. */
  /* 🔢 Il numero è salito da 4 a 5 il 02/09/2026 con `suo_gesto` (voce 123), e va alzato solo
   * perché il punto nuovo OBBEDISCE alla regola: è un modo in più in cui una riga si chiude
   * senza che un messaggio parta, e sta qui insieme agli altri quattro invece che sparso.
   * ⚖️ Un numero di guardia si alza dichiarando il perché, o smette di essere una guardia e
   * diventa la fotografia di ciò che c'è. */
  assert.equal(ESITI.length, 6);
  assert.equal(new Set(ESITI).size, 6);
  for (const e of ESITI) assert.match(e, /^[a-z_]+$/);
});

test('2. solo «passato_al_bot» dice che la riga è uscita di qui', () => {
  assert.equal(ePassatoAlBot(ESITO.PASSATO_AL_BOT), true);
  for (const e of [ESITO.NON_RICONOSCIUTO, ESITO.NETTO_NULLO, ESITO.CORSA_PERSA, ESITO.SUO_GESTO, ESITO.GESTO_DAL_BOT]) {
    assert.equal(ePassatoAlBot(e), false, `«${e}» non è uscito verso il bot`);
  }
});

test('2bis. 🚨⭐⭐ e NESSUN valore promette che il socio lo sappia', () => {
  /* 📏 Il difetto, misurato il 01/09 poche ore dopo aver scritto questa colonna: alle
   * 18:22:07 il gestionale ha scritto `consegnato` su due righe e il registro del bot diceva
   * **«2 ritirati, 0 detti, 2 scartati»**. Quelle due persone il bot non ce l'hanno.
   * ⇒ Il nome e la funzione promettevano una cosa che da questa parte NON si può sapere: la
   * stessa bugia di `consegnato_at`, spostata di un passo.
   * 🚨 Questo caso è la guardia di quella lezione: vieta il vocabolario dell'arrivo, non un
   * valore in particolare. Chi domani volesse riaggiungere «consegnato» lo trova rosso qui. */
  for (const v of ESITI) {
    assert.doesNotMatch(v, /consegnat|arrivat|ricevut|letto/i,
      `«${v}» promette che il socio lo sappia: è un fatto che vive nel BOT, non qui`);
  }
  const src = readFileSync(new URL('./esito-avviso.ts', import.meta.url), 'utf8');
  assert.ok(!/export function eArrivatoAlSocio/.test(src),
    'è tornata una funzione che dichiara di sapere se il socio lo sa');
});

test('3. ⚠️ un esito ASSENTE è «non misurato», e vale falso — non «passato»', () => {
  // 🚨 Le 605 righe chiuse prima del 01/09 hanno `esito` a NULL. Farle valere per «passato»
  // sarebbe inventare un esito che nessuno ha osservato: esattamente il difetto che questa
  // colonna esiste per togliere.
  for (const niente of [null, undefined, '', '   ', 'boh']) {
    assert.equal(ePassatoAlBot(niente), false, `«${String(niente)}»`);
  }
});

test('4. ⭐⭐ le due colonne rispondono a DUE domande, e il codice le tiene separate', () => {
  const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.ok(src.length > 5000, 'sorgente non letto: questa prova non direbbe niente');
  // 🚨 La CHIUSURA resta quella atomica del 24/08 — `consegnato_at` più la pretesa che la
  // riga sia ancora libera. È la protezione contro il doppio invio, e l'esito non la tocca.
  assert.match(src, /\.update\(\{ consegnato_at: new Date\(\)\.toISOString\(\) \}\)[\s\S]{0,200}\.is\('consegnato_at', null\)/,
    'la chiusura atomica non pretende più che la riga sia libera: la protezione del 24/08 è saltata');
  // 🚨 E l'esito si scrive DOPO, su righe già nostre, quindi NON deve pretendere quel vincolo:
  // se lo pretendesse non scriverebbe mai niente (`consegnato_at` l'abbiamo appena messo noi).
  const ramoEsito = src.match(/\.update\(\{ esito \}\)[\s\S]{0,120}/);
  assert.ok(ramoEsito, "l'esito non si scrive: la colonna resta muta");
  assert.ok(!/\.is\('consegnato_at', null\)/.test(ramoEsito![0]),
    "l'esito pretende una riga libera: non ne scriverebbe mai nessuno");
});

test('5. ⛔ un errore sull\'esito non ferma la consegna', () => {
  // ⚖️ È diagnostica: far cadere un avviso vero per una riga di contabilità sarebbe il verso
  // sbagliato — lo stesso già scelto per la ricevuta della voce 70.
  const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  const ramo = src.match(/if \(esitoErr\) \{[\s\S]{0,400}?\n      \}/);
  assert.ok(ramo, 'il ramo d\'errore dell\'esito non si trova');
  assert.ok(!/return err\(/.test(ramo![0]), "un esito non scritto fa fallire la risposta: la diagnostica è diventata un cancello");
});

test('6. i nomi degli esiti stanno in UN posto: il codice non se li riscrive a mano', () => {
  const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  const senzaCommenti = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const valore of ESITI) {
    assert.ok(!senzaCommenti.includes(`'${valore}'`),
      `«${valore}» è scritto a mano in index.ts invece di venire da ESITO: due copie divergono`);
  }
  assert.match(src, /from '\.\/esito-avviso\.ts'/, "index.ts non importa il modulo degli esiti");
});

test('7. 🆕 VOCE 123 — lo scarto «era suo» è nel GESTIONALE, e chiude la riga', () => {
  /* 🚨 Le due metà che questa prova protegge, e sono tutte e due state sbagliate altrove:
   * ① lo scarto NON deve uscire verso il bot — se uscisse, il gestionale direbbe una cosa
   *    e chiederebbe al bot di non dirla, che è la regola di casa rovesciata;
   * ② la riga si CHIUDE lo stesso — un fatto che non si consegna e non si chiude si
   *    riesamina a ogni giro, per sempre. */
  const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.ok(src.length > 5000, 'sorgente non letto: questa prova non direbbe niente');
  const ramo = src.match(/if \(e\.chiestoDaUnanime[\s\S]{0,700}?\n    \}/);
  assert.ok(ramo, 'lo scarto della voce 123 non si trova: il difetto è tornato');
  assert.match(ramo![0], /daChiudere\.push\(\.\.\.e\.ids\)/,
    'la riga scartata non si chiude: si riesaminerà a ogni giro per sempre');
  assert.match(ramo![0], /segnaEsito\(e\.ids, ESITO\.SUO_GESTO\)/,
    'lo scarto non lascia il suo perché: sarebbe indistinguibile da un netto nullo');
  assert.ok(!/eventi\.push/.test(ramo![0]),
    'lo scarto manda comunque l\'evento al bot: non è più uno scarto');
});

test('8. 🆕 VOCE 123 — si scarta SOLO se tutta la raffica è sua', () => {
  // 🚨 Senza `chiestoDaUnanime` un gruppo che mescola un suo gesto e uno della segreteria
  // verrebbe zittito per intero, e quella del circolo è l'unica notizia che nessun altro
  // gli darà. *Ogni scarto in più è un avviso che qualcuno non riceve.*
  const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.match(src, /if \(e\.chiestoDaUnanime && stessaPersona\(/,
    'lo scarto non pretende più che la raffica sia tutta dello stesso richiedente');
});

test('9. 🆕 VOCE 123 — i nomi si confrontano passando dall\'ANAGRAFICA, non fra loro', () => {
  /* 📏 `persona` è il nome come lo scrive la scheda del circolo, `chiesto_da` viene
   * dall'anagrafica: il progetto sa già che le due grafie divergono (vedi l'`add` di
   * `consumer-booking-write`). Un `normNome(a) === normNome(b)` fallirebbe **in silenzio**
   * proprio dove la cura serve, cioè restituendo il difetto senza nessun errore. */
  const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  const ramo = src.match(/if \(e\.chiestoDaUnanime[\s\S]{0,300}?\)\) \{/);
  assert.ok(ramo, 'lo scarto non si trova');
  assert.match(ramo![0], /destinatarioPerNome\(e\.chiestoDa/,
    'il richiedente non passa dall\'anagrafica: il confronto è tornato fra stringhe');
  assert.ok(!/normNome\(e\.chiestoDa/.test(ramo![0]),
    'il confronto è fra nomi normalizzati: due grafie diverse della stessa persona non combaciano');
});

test('10. 🆕 VOCE 123 — l\'anagrafica si legge ANCHE per chi ha chiesto, o lo scarto è morto', () => {
  /* 📏 Difetto trovato prima di spingere, rileggendo la cura invece del difetto: `schede` è
   * filtrato sui nomi cercati, e quelli nascevano dalle sole `persona`. Un richiedente scritto
   * in anagrafica diversamente da come lo scrive la scheda del circolo non si sarebbe trovato,
   * `destinatarioPerNome` avrebbe risposto `null`, e lo scarto non sarebbe MAI scattato — senza
   * nessun errore e senza nessun rosso. Questa prova è l\'unica cosa che se ne accorgerebbe. */
  const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  const ramo = src.match(/const nomi = \[[\s\S]{0,400}?\]\)\];/);
  assert.ok(ramo, 'la composizione dei nomi da cercare è cambiata forma: questa prova non guarda più niente');
  assert.match(ramo![0], /e\.chiestoDa/,
    'i nomi di chi ha chiesto non entrano più fra quelli cercati: lo scarto della voce 123 non può scattare');
});

test('11. 🆕🔇 VOCE 115 — la strada della ricevuta scrive il suo esito NELLO STESSO update che chiude', () => {
  /* ⚖️ Non «da qualche parte»: nello stesso `.update` di `consegnato_at`. Scriverlo in un
   * secondo passo riaprirebbe la finestra in cui la riga è chiusa e muta — cioè il difetto.
   * 📏 Al 05/09 erano 26 righe su 26 ricevute consumate, tutte con `esito` NULL. */
  const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  const i = src.indexOf('const { error: chiudiRicErr }');
  assert.ok(i > 0, 'la chiusura dei coperti non si trova più');
  const pezzo = src.slice(i, src.indexOf(';', i));
  assert.match(pezzo, /\.update\(\{ consegnato_at: adesso, esito: ESITO\.GESTO_DAL_BOT \}\)/,
    'i fatti coperti da ricevuta si chiudono senza esito: il loro NULL torna a voler dire due cose');
  assert.equal(ESITO.GESTO_DAL_BOT, 'gesto_dal_bot');
});

console.log(`\n${passed} verdi · ${failed} rossi`);
if (failed > 0) process.exit(1);
