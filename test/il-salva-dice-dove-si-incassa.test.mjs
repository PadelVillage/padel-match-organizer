/* 💶 «Il Salva dice dove si incassa» — banco della voce 214 (11/09/2026).
 *
 * 🗣️ NASCE DALLA SUA DOMANDA della 211: «perché non mi fa salvare il pagamento?» — con davanti una
 *    scheda che diceva *A carico 12,00 € · Manca all'appello 12,00 €*, e un Salva che rispondeva
 *    solo «Nessuna modifica da salvare». Aveva ragione l'app: lui non aveva cambiato niente. Ma da
 *    quella risposta vera-e-inutile è nata la 210, cioè dieci click sui bottoni dell'incasso.
 *    ⇒ Sua decisione, 11/09: il Salva **deve dire dove si incassa**.
 *
 * ⚖️ QUELLO CHE QUESTO BANCO DIFENDE NON È IL TESTO, È LA SEPARAZIONE: il Salva continua a NON
 *    incassare (voce 132 — *un importo a carico non è un pagamento*). Cambia che indica la strada
 *    invece di lasciare la persona ferma.
 *
 * 🚨⭐ E la cosa che più facilmente si sbaglia: un conto PARZIALE è un **minimo**, non un totale.
 *    Scriverlo come totale sarebbe un numero falso con la faccia di una misura — il difetto che la
 *    152 aveva già curato nel riquadro, ripetuto in una frase nuova.
 *
 * ⛔ QUESTO BANCO NON DICE che la frase si veda sullo schermo: gira senza browser. Lo dice il gesto
 *    sulla pagina viva, ed è quello che chiude la voce.
 *
 * Esegui:  node test/il-salva-dice-dove-si-incassa.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(QUI, '..', 'index.html'), 'utf8');
assert.ok(APP.length > 500000, 'sorgente non letto: questo banco non direbbe niente');

let passed = 0, failed = 0;
function test(nome, fn) {
  try { fn(); passed++; console.log('ok   - ' + nome); }
  catch (e) { failed++; console.log('FAIL - ' + nome + '\n       ' + e.message); }
}

/** Solo le righe di CODICE: via i commenti — il commento qui sopra nomina «Cash · Card · Wallet»,
 *  «incassa» e «Nessuna modifica», cioè tutto ciò che le sonde cercano. Senza questo filtro il
 *  banco si misurerebbe addosso (lezione della 118ª, presa in flagrante mentre nasceva una sonda). */
function soloCodice(testo) {
  return String(testo).split('\n').filter(function (r) {
    return !/^\s*(\/\/|\*|\/\*)/.test(r);
  }).join('\n');
}

/** Ritaglia una funzione contando le graffe, invece di indovinare dove finisce. */
function estrai(nome) {
  const i = APP.indexOf('function ' + nome + '(');
  assert.ok(i > 0, nome + ' non c\'è più: questo banco non sa dove guardare');
  let liv = 0, j = APP.indexOf('{', i), fine = -1;
  for (let k = j; k < APP.length; k++) {
    if (APP[k] === '{') liv++;
    else if (APP[k] === '}') { liv--; if (liv === 0) { fine = k + 1; break; } }
  }
  assert.ok(fine > j, 'non sono riuscito a ritagliare ' + nome + ': la fetta sarebbe una bugia');
  return APP.slice(i, fine);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ① IL TESTO SI ESEGUE, non si rilegge. Una guardia che cercasse la PAROLA «Wallet»
 *    proverebbe che la parola c'è nel sorgente, non che esca nel caso giusto.
 * ────────────────────────────────────────────────────────────────────────────*/
const testoSalva = new Function(estrai('_pmoTestoSalvaSenzaModifiche') + '; return _pmoTestoSalvaSenzaModifiche;')();
const euro = (c) => (c / 100).toFixed(2).replace('.', ',') + ' €';

test('① NIENTE DA INCASSARE ⇒ la frase resta quella di prima, e basta', () => {
  /* ⚖️ La partita saldata non deve leggersi un rimando a un incasso che non esiste: sarebbe
     rumore proprio dove prima c'era una risposta corta e giusta. */
  const t = testoSalva({ mancaCents: 0, completo: true }, euro);
  assert.equal(t, 'ℹ️ Nessuna modifica da salvare.');
});

test('① RESTA DENARO ⇒ dice QUANTO e DOVE', () => {
  const t = testoSalva({ mancaCents: 1200, completo: true }, euro);
  assert.match(t, /Nessuna modifica da salvare/, 'la risposta vera di prima non si perde');
  assert.match(t, /12,00 €/, 'non dice quanto resta');
  assert.match(t, /Cash · Card · Wallet/, 'non dice DOVE si incassa: è la voce intera');
  assert.ok(!/almeno/.test(t), 'un conto completo non si annacqua con «almeno»');
});

test('① CONTO PARZIALE ⇒ «almeno», perché quel numero è un MINIMO', () => {
  /* 🚨 È il caso che fa danno in silenzio: 12,00 € letti come totale quando una riga non ha
     ancora l'importo. Il riquadro del conto (152) lo dichiara già; una frase nuova che lo
     dimenticasse rimetterebbe in circolo il numero falso da un'altra porta. */
  const t = testoSalva({ mancaCents: 1200, completo: false }, euro);
  assert.match(t, /almeno 12,00 €/, 'un conto parziale viene spacciato per totale');
});

test('① SENZA CONTO non inventa: torna la frase secca', () => {
  assert.equal(testoSalva(null, euro), 'ℹ️ Nessuna modifica da salvare.');
  assert.equal(testoSalva({}, euro), 'ℹ️ Nessuna modifica da salvare.');
  assert.equal(testoSalva({ mancaCents: 'dodici' }, euro), 'ℹ️ Nessuna modifica da salvare.');
});

test('① NON NOMINA MATCHPOINT: il giorno che si spegne, questa frase non si tocca', () => {
  /* 🎯 È la prova del futuro del progetto applicata a una riga di testo. Sul sistema nuovo la
     cassa è nostra: un rimando a Matchpoint qui sarebbe già sbagliato oggi. */
  const t = testoSalva({ mancaCents: 1200, completo: false }, euro);
  assert.ok(!/matchpoint/i.test(t), 'la frase nomina Matchpoint');
});

/* ─────────────────────────────────────────────────────────────────────────────
 * ② LE VOCI DEL CONTO SI LEGGONO IN UN POSTO SOLO.
 * ────────────────────────────────────────────────────────────────────────────*/
const centsDelConto = new Function(estrai('_pmoEuroToCents') + estrai('_pmoCentsDelConto') + '; return _pmoCentsDelConto;')();

test('② LA CASELLA VUOTA È «NON LO SO», LO ZERO SCRITTO È UN DATO', () => {
  /* ⛔ È la distinzione su cui poggia tutto il resto: `null` non entra nella somma e fa scattare
     «almeno», lo zero ci entra (è l'omaggio della voce 149). Confonderli fa sparire l'avviso. */
  assert.equal(centsDelConto(''), null);
  assert.equal(centsDelConto('   '), null);
  assert.equal(centsDelConto(null), null);
  assert.equal(centsDelConto('0,00'), 0);
  assert.equal(centsDelConto('0'), 0);
  assert.equal(centsDelConto('12,00'), 1200);
});

test('② `_pmoVociContoDaScheda` esiste, ed è l\'UNICA lettura rimasta', () => {
  assert.ok(/function _pmoVociContoDaScheda\(/.test(APP), 'la lettura condivisa non c\'è');
  const src = soloCodice(APP);
  assert.ok(!/const _centsPerConto = function/.test(src),
    'la vecchia copia dentro il disegno è tornata: due conti sulla stessa scheda');
});

test('② IL DISEGNO DELLA SCHEDA usa la lettura condivisa, non una sua', () => {
  const i = APP.indexOf('const _vociConto = function ()');
  assert.ok(i > 0, 'il disegno non chiede più le voci: rileggere la voce 152');
  const fetta = soloCodice(APP.slice(i, i + 300));
  assert.match(fetta, /_pmoVociContoDaScheda\(st\)/, 'il disegno si è rifatto un conto suo');
});

/* ─────────────────────────────────────────────────────────────────────────────
 * ③ LA CURA È CABLATA NEL RAMO «NIENTE DA SALVARE» — e NON altrove.
 * ────────────────────────────────────────────────────────────────────────────*/
function ramoNienteDaSalvare() {
  const i = APP.indexOf('if (!moveChanged && !playersChanged && !noteChanged');
  assert.ok(i > 0, 'il ramo «niente da salvare» non c\'è più');
  return APP.slice(i, i + 1400);
}

test('③ IL SALVA CHIEDE IL CONTO e ne fa uscire il testo', () => {
  const src = soloCodice(ramoNienteDaSalvare());
  assert.match(src, /_pmoTestoSalvaSenzaModifiche\(/, 'il Salva non dice più dove si incassa');
  assert.match(src, /_pmoContoPartita\(_pmoVociContoDaScheda\(st\)\)/,
    'il Salva si calcola il conto per conto suo invece di chiederlo al giudice');
});

test('③ …e NON incassa: la separazione della 132 resta in piedi', () => {
  /* 🚨 La cura sbagliata che veniva comoda: far partire l'incasso dal Salva quando manca qualcosa.
     Sarebbe denaro mosso da un bottone che dichiara di non muoverne. */
  const src = soloCodice(ramoNienteDaSalvare());
  assert.ok(!/_pmoCollectPayment\(|_pmoCassaScriviIncasso\(/.test(src),
    'il ramo «niente da salvare» fa partire un incasso: il Salva non incassa');
});

test('③ LA FRASE ARRIVA IN CHAT, non solo nella barra', () => {
  /* 🩹 `svcAddMessage` esce PRIMA di appendere per i testi che stanno in `SVC_ESITI_NELLA_SCHEDA`
     — è la causa misurata della 209. Se un domani questa frase finisse in quella lista, l'operatore
     non la leggerebbe e la voce tornerebbe aperta senza che nessuno tocchi questo codice. */
  const i = APP.indexOf('const SVC_ESITI_NELLA_SCHEDA = [');
  assert.ok(i > 0, 'la lista degli esiti non c\'è più');
  const lista = APP.slice(i, APP.indexOf('];', i));
  assert.ok(!/Nessuna modifica/i.test(lista),
    '«Nessuna modifica» è finita fra gli esiti-da-barra: la frase non entrerebbe in chat');
});

console.log('\n' + passed + ' verdi, ' + failed + ' rossi');
process.exit(failed ? 1 : 0);
