/* 🏷️ «Il nome del circolo si dice solo dove c'è» — banco della VOCE 190 (09/09/2026).
 *
 * 🗣️ NASCE DA UNA SUA DOMANDA, fatta due volte: *«Ma Matchpoint non c'è più un cavolo, perché vedo
 *   scritto ancora Matchpoint?»* — e sul gestionale nuovo quelle frasi sono **già false oggi**: la
 *   scrittura è nativa e il circolo esterno non viene chiamato.
 *
 * 🎯 LE TRE COSE CHE QUESTO BANCO DIFENDE:
 *   ① 🚨⭐⭐ **TRE STATI, NON DUE.** La configurazione arriva in modo **asincrono** ⇒ al primo
 *      disegno della pagina il ref **non si conosce**. Una funzione a due stati qui tirerebbe a
 *      indovinare e sbaglierebbe per costruzione metà delle volte;
 *   ② ⚖️ **il verso del dubbio è OPPOSTO a quello delle scritture**, e deliberatamente: sul denaro
 *      nel dubbio si resta su PROD (sbagliare di là **fallisce**, e si vede); qui nel dubbio si
 *      **tace il nome**, perché la frase generica è vera in tutti e due i mondi.
 *      📌 *Quando una delle due frasi è vera ovunque e l'altra solo in un posto, il dubbio ha una
 *         risposta giusta e non è una moneta.*
 *   ③ ⛔ si guarda il **ref Supabase**, mai l'hostname: quello scade col passaggio (⇒ voce 184).
 *
 * ⛔ QUELLO CHE NON DICE: che le frasi arrivino davvero sullo schermo giuste. Qui si prova la
 *    regola che le sceglie. Quello vuole la pagina viva.
 *
 * Esegui:  node test/il-nome-del-circolo-si-dice-solo-dove-ce.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(QUI, '..', 'index.html'), 'utf8');

let passed = 0, failed = 0;
function test(nome, fn) {
  try { fn(); passed++; console.log('ok   - ' + nome); }
  catch (e) { failed++; console.log('FAIL - ' + nome + '\n       ' + e.message); }
}

function corpoDi(nome) {
  const i = APP.indexOf('function ' + nome + '(');
  assert.ok(i > 0, 'funzione non trovata: ' + nome);
  const apre = APP.indexOf(') {', i);
  let g = 0, visto = false, out = '';
  for (let k = apre + 2; k < APP.length; k++) {
    const c = APP[k];
    out += c;
    if (c === '{') { g++; visto = true; }
    else if (c === '}') { g--; if (visto && g === 0) break; }
  }
  return out;
}
function parametriDi(nome) {
  const i = APP.indexOf('function ' + nome + '(');
  return APP.slice(i + ('function ' + nome + '(').length, APP.indexOf(') {', i));
}
function esegui(nome, dip) {
  const nomi = Object.keys(dip || {}), vals = nomi.map((k) => dip[k]);
  return new Function(...nomi,
    'return function ' + nome + '(' + parametriDi(nome) + ') ' + corpoDi(nome) + ';')(...vals);
}

const REF_PROD = 'qqbfphyslczzkxoncgex';
const collegato = esegui('pmoGestionaleCollegatoAlCircolo', { PMO_PROD_SUPABASE_PROJECT_REF: REF_PROD });

/** Monta le tre funzioni con una memoria di configurazione finta. */
function conConfig(memoria) {
  const stato = esegui('pmoCircoloEsternoCollegato', {
    pmoConfigMemoria: memoria, pmoGestionaleCollegatoAlCircolo: collegato,
  });
  const nome = esegui('pmoNomeCircoloEsterno', { pmoCircoloEsternoCollegato: stato });
  const su = esegui('pmoSuCircoloEsterno', { pmoNomeCircoloEsterno: nome });
  return { stato, nome, su };
}
const PROD  = { valore: { supabaseUrl: 'https://' + REF_PROD + '.supabase.co' } };
const NUOVO = { valore: { supabaseUrl: 'https://cudiqnrrlbyqryrtaprd.supabase.co' } };

// ── ① I TRE STATI ────────────────────────────────────────────────────────────────────────────

test('① collegato al circolo (PROD) ⇒ `true`, e il nome si dice', () => {
  const f = conConfig(PROD);
  assert.equal(f.stato(), true);
  assert.equal(f.nome(), 'Matchpoint');
  assert.equal(f.su(), ' su Matchpoint');
});

test('① il sistema NUOVO ⇒ `false`, e il nome si tace', () => {
  const f = conConfig(NUOVO);
  assert.equal(f.stato(), false);
  assert.equal(f.nome(), '');
  assert.equal(f.su(), '', 'la frase resta grammaticale: «Operazione confermata» e basta');
});

test('① 🚨⭐⭐ configurazione NON ancora arrivata ⇒ `null`, che NON è «no»', () => {
  // È il caso vero: `PADEL_CONFIG` si carica in modo asincrono, quindi al primo disegno della
  // pagina questo è lo stato in cui si è.
  for (const vuota of [null, undefined, {}, { valore: null }, { valore: {} }, { valore: { supabaseUrl: '' } }]) {
    assert.equal(conConfig(vuota).stato(), null, 'con ' + JSON.stringify(vuota) + ' deve dire «non lo so»');
  }
});

test('① e i tre stati sono DAVVERO tre: `null` non si confonde con `false`', () => {
  assert.notEqual(conConfig({}).stato(), conConfig(NUOVO).stato());
  assert.equal(conConfig({}).stato(), null);
  assert.equal(conConfig(NUOVO).stato(), false);
});

// ── ② IL VERSO DEL DUBBIO ────────────────────────────────────────────────────────────────────

test('② ⚖️ nel dubbio si TACE il nome — la frase generica è vera in tutti e due i mondi', () => {
  assert.equal(conConfig({}).nome(), '', 'non lo sappiamo ⇒ non si nomina');
  assert.equal(conConfig({ valore: { supabaseUrl: 'non-un-indirizzo' } }).nome(), '');
});

test('② 🚨 e un indirizzo che CONTIENE il ref di PROD non è PROD (host, non `includes`)', () => {
  assert.equal(conConfig({ valore: { supabaseUrl: 'https://' + REF_PROD + '.supabase.co.altrove.it' } }).nome(), '');
});

test('② 📏 e la copia dell\'APP è più STRETTA di quella dell\'edge — misurato, non supposto', () => {
  /* ⚖️ `scrittura-al-circolo.ts` (le edge) tollera un sottodominio dello **stesso** progetto
   *    (`<ref>.qualcosa.supabase.co`); `pmoGestionaleCollegatoAlCircolo` nell'app pretende
   *    **esattamente** `<ref>.supabase.co`. 🚨 Scritto qui perché me lo aspettavo uguale e non lo
   *    è: la differenza va nella direzione **sicura** (l'app nomina il circolo in meno casi, mai
   *    in più), quindi non è un difetto — ma è il tipo di divergenza che qualcuno un giorno
   *    "uniformerebbe" nel verso sbagliato credendo di ripulire.
   * 📌 *Due copie di una regola che non coincidono non sono per forza un guasto: diventano un
   *    guasto il giorno in cui qualcuno le allinea senza sapere quale delle due era la severa.* */
  assert.equal(conConfig({ valore: { supabaseUrl: 'https://' + REF_PROD + '.qualcosa.supabase.co' } }).nome(), '',
    'l\'app non tollera il sottodominio: se un giorno lo tollerasse, è un ALLARGAMENTO e va voluto');
});

// ── ③ GUARDIE TESTUALI ───────────────────────────────────────────────────────────────────────

test('③ ⛔ l\'helper non guarda MAI l\'hostname della pagina (che il passaggio farà scadere)', () => {
  const corpo = corpoDi('pmoCircoloEsternoCollegato');
  assert.doesNotMatch(corpo, /location|hostname|pmoIsTestHostname|PMO_IS_TEST_ENV/);
  assert.match(corpo, /pmoGestionaleCollegatoAlCircolo/);
});

test('③ i blocchi che esistono solo col circolo nascono NASCOSTI nell\'HTML', () => {
  // ⚖️ Così sul gestionale nuovo non compaiono mai, nemmeno nell'istante in cui la configurazione
  //    non è ancora arrivata. Comparire e poi sparire sarebbe peggio che non comparire.
  const marcati = APP.match(/<article[^>]*data-solo-col-circolo=/g) || [];
  assert.equal(marcati.length, 3, 'i tre import Excel da Matchpoint');
  for (const m of marcati) assert.match(m, /\shidden\s/, 'nasce hidden: ' + m.slice(0, 90));
});

test('③ e il riquadro che conta i giorni dall\'ultimo import tace dove l\'import non si fa più', () => {
  const corpo = corpoDi('renderMatchpointSecretaryPanel');
  assert.match(corpo, /pmoCircoloEsternoCollegato\(\)\s*!==\s*true/,
    'senza questa riga il contatore salirebbe per sempre, rimproverando un aggiornamento impossibile');
});

test('③ 🚨 il sottotitolo del calendario è GENERICO nell\'HTML, e il nome si aggiunge dopo', () => {
  // 📌 La prima pittura non deve mai mentire: si scrive il vero-ovunque, e si precisa se si scopre.
  const i = APP.indexOf('data-frase-col-circolo=');
  assert.ok(i > 0, 'il sottotitolo deve portare la variante col circolo in un attributo');
  const zona = APP.slice(i - 200, i + 400);
  assert.match(zona, /data-frase-col-circolo="[^"]*Matchpoint[^"]*"/, 'la variante col nome sta nell\'attributo');
  const testoVisibile = /data-frase-col-circolo="[^"]*">([^<]*)</.exec(zona);
  assert.ok(testoVisibile, 'il nodo deve avere un testo scritto');
  assert.doesNotMatch(testoVisibile[1], /Matchpoint/,
    'il testo scritto nell\'HTML è quello generico: è quello che si vede prima di sapere');
});

// ── ④ LE FRASI CHE SI RISCRIVONO ─────────────────────────────────────────────────────────────
// 🚨⭐⭐ Le prime nove erano della forma «…su Matchpoint» ⇒ bastava togliere il complemento e la
//   frase restava vera. Queste hanno il circolo come **soggetto** («Matchpoint ha rifiutato») o
//   descrivono un **gesto** che senza di lui non esiste («sto guardando su Matchpoint» — dove?).
//   ⇒ Togliere la parola le lascerebbe **monche o false**, non più generiche.
// 📌 *Una parola sbagliata si toglie; una frase costruita attorno a quella parola si riscrive.*

function frasi(memoria) {
  const stato = esegui('pmoCircoloEsternoCollegato', {
    pmoConfigMemoria: memoria, pmoGestionaleCollegatoAlCircolo: collegato,
  });
  const nome = esegui('pmoNomeCircoloEsterno', { pmoCircoloEsternoCollegato: stato });
  const d = { pmoNomeCircoloEsterno: nome };
  return {
    rifiutata: esegui('pmoFraseRifiutata', d),
    nonHoLaConferma: esegui('pmoFraseNonHoLaConferma', d),
    lento: esegui('pmoFraseLento', d),
    nessunaRisposta: esegui('pmoFraseNessunaRisposta', d),
    lentoAdesso: esegui('pmoFraseLentoAdesso', d),
    nonVerificabile: esegui('pmoFraseNonVerificabile', d),
  };
}

test('④ col circolo le frasi restano ESATTAMENTE quelle di sempre (PROD non cambia)', () => {
  const f = frasi(PROD);
  assert.equal(f.rifiutata(), '❌ Matchpoint ha rifiutato: ');
  assert.equal(f.nonHoLaConferma(1), '⌛ Non ho la conferma — sto guardando su Matchpoint…');
  assert.equal(f.nonHoLaConferma(3), '⌛ Non ho ancora la conferma — continuo a guardare su Matchpoint (3° tentativo)…');
  assert.equal(f.lento(), '⌛ Matchpoint è lento: aspetto ancora la conferma…');
  assert.equal(f.nessunaRisposta(), 'Matchpoint non ha risposto in tempo');
  assert.equal(f.nonVerificabile(), 'non riesco a raggiungere Matchpoint per verificare');
});

test('④ 🚨 senza circolo NESSUNA nomina Matchpoint — e nessuna resta monca', () => {
  const f = frasi(NUOVO);
  const tutte = [f.rifiutata(), f.nonHoLaConferma(1), f.nonHoLaConferma(3), f.lento(),
                 f.nessunaRisposta(), f.lentoAdesso(), f.nonVerificabile()];
  for (const t of tutte) {
    assert.doesNotMatch(t, /Matchpoint/i, 'nomina il circolo: ' + t);
    // ⛔ e non deve restare un buco dove stava la parola: niente doppi spazi, niente code appese
    assert.doesNotMatch(t, /\s{2,}/, 'doppio spazio (parola tolta male): ' + JSON.stringify(t));
    assert.doesNotMatch(t, /(su|a|di|il)\s*$/, 'frase monca: ' + JSON.stringify(t));
    assert.ok(t.trim().length > 5, 'frase svuotata: ' + JSON.stringify(t));
  }
});

test('④ 🚨⭐⭐ e senza circolo ogni frase è ESATTAMENTE questa — non «una che non dice Matchpoint»', () => {
  /* 🩹 QUESTA PROVA È NATA DA UN SABOTAGGIO CHE IL BANCO NON VEDEVA. I controlli generici qui
   * sopra (niente «Matchpoint», niente doppi spazi, niente coda appesa) lasciavano passare
   * `'non riesco a raggiungere'` — una frase **troncata a metà**, che non nomina il circolo e
   * finisce con un verbo che pretende un complemento. La regex della «frase monca» cercava una
   * forma (`…su`, `…a`, `…di`) e quella non ce l'aveva.
   * 📌 *Una guardia che descrive la forma di uno sbaglio prende quello sbaglio, non la classe:
   *    per una frase l'unico invariante è la frase stessa.* */
  const f = frasi(NUOVO);
  assert.equal(f.rifiutata(), '❌ Rifiutata: ');
  assert.equal(f.nonHoLaConferma(1), '⌛ Non ho la conferma — sto controllando…');
  assert.equal(f.nonHoLaConferma(3), '⌛ Non ho ancora la conferma — continuo a controllare (3° tentativo)…');
  assert.equal(f.lento(), '⌛ Ci sto mettendo più del previsto: aspetto ancora la conferma…');
  assert.equal(f.nessunaRisposta(), 'nessuna risposta in tempo');
  assert.equal(f.lentoAdesso(), '⌛ <strong>Sta prendendo più del previsto</strong>');
  assert.equal(f.nonVerificabile(), 'non riesco a verificare');
});

test('④ ⛔ e NON nominano nemmeno il WORKER, che è un nome interno', () => {
  // 🚨 «Matchpoint è lento adesso (coda del worker)» ne nominava DUE, e «worker» non lo deve
  //    sentire chi lavora né su PROD né sul sistema nuovo.
  for (const m of [PROD, NUOVO]) {
    const f = frasi(m);
    for (const t of [f.lentoAdesso(), f.nessunaRisposta(), f.lento()]) {
      assert.doesNotMatch(t, /worker|hetzner|playwright|coda del/i, 'nome interno in una frase: ' + t);
    }
  }
});

test('④ ⛔ e nel DUBBIO tacciono il nome, come tutte le altre', () => {
  const f = frasi({});   // configurazione non ancora arrivata
  assert.doesNotMatch(f.rifiutata(), /Matchpoint/);
  assert.doesNotMatch(f.nonHoLaConferma(1), /Matchpoint/);
  assert.doesNotMatch(f.lento(), /Matchpoint/);
});

test('④ 📏 e nel sorgente non resta nessuna di quelle frasi scritta a mano', () => {
  // ⚠️ Guardia TESTUALE, dichiarata per quello che è: dice che le stringhe non ci sono più, non
  //    che le funzioni vengano chiamate nel posto giusto.
  const codice = APP.split('\n')
    .filter((r) => { const t = r.trim(); return !(t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')); })
    .join('\n');
  for (const frase of ['❌ Matchpoint ha rifiutato: ',
                       'sto guardando su Matchpoint…',
                       'Matchpoint è lento: aspetto',
                       "'Matchpoint non ha risposto in tempo'",
                       'NON eseguita su Matchpoint',
                       'verificata su Matchpoint',
                       'raggiungere Matchpoint per verificare (']) {
    assert.ok(!codice.includes(frase), 'ancora scritta a mano nel codice: ' + frase);
  }
});

// ── CONTROLLO NEGATIVO ───────────────────────────────────────────────────────────────────────

test('🧪 SABOTAGGI — il banco deve saper cadere', () => {
  const cade = (fn) => { try { fn(); return false; } catch (e) { return true; } };

  // ⓵ due stati invece di tre: «non lo so» diventa «sì» ⇒ si nomina Matchpoint dove non c'è.
  const due = new Function('pmoConfigMemoria', 'pmoGestionaleCollegatoAlCircolo',
    'return function s(){ try { const u = pmoConfigMemoria && pmoConfigMemoria.valore && pmoConfigMemoria.valore.supabaseUrl; return u ? pmoGestionaleCollegatoAlCircolo(u) : true; } catch(e){ return true; } };')({}, collegato);
  assert.ok(cade(() => assert.equal(due(), null)), 'sabotaggio ⓵ non visto: il dubbio direbbe «Matchpoint»');

  // ⓶ il verso del dubbio rovesciato sul NOME.
  const nomeSbagliato = new Function('return function n(){ return "Matchpoint"; };')();
  assert.ok(cade(() => assert.equal(nomeSbagliato(), '')), 'sabotaggio ⓶ non visto');

  // ⓷ `includes` al posto del confronto sull'host.
  const lasco = new Function('REF', 'return function c(u){ return String(u||"").includes(REF); };')(REF_PROD);
  assert.ok(cade(() => assert.equal(lasco('https://' + REF_PROD + '.supabase.co.altrove.it'), false)),
    'sabotaggio ⓷ non visto: un dominio ostile passerebbe per PROD');
});

console.log('\n' + passed + ' passati, ' + failed + ' falliti');
if (failed) process.exit(1);
