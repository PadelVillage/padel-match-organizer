/* Banco della voce «scheda anagrafica riordinata» — 02/09/2026.
 *
 * 🗣️ Quattro richieste sue, in due messaggi:
 *   ① «Disattiva e cancella socio li porterei dentro la tab anagrafica»
 *   ② «le preferenze operative quando si apre la scheda è chiuso e si apre con un click di freccetta»
 *   ③ «leva anche il bottone whatsapp» → messo davanti alle tre strade: «tutti e due»
 *   ④ «anche la scritta conferma email da inviare va levata»
 * Più due proposte misurate e approvate («si procedi»): il riassunto della piega dice se dentro
 * c'è qualcosa, e i tre codici tecnici scendono anche loro sotto una piega.
 *
 * ⚠️ GUARDIE TESTUALI, E SI DICE: leggono `index.html` come TESTO. Dicono che il codice è nel
 * posto giusto, NON che la scheda si veda — la sezione si è già rotta una volta con guardie
 * verdi (voce 84 ⓑ, «la stanza murata»). La prova che vale è aprirla.
 */
import { readFileSync } from 'node:fs';
import assert from 'node:assert';

const app = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
let passed = 0, failed = 0;
function test(nome, fn) {
  try { fn(); passed++; console.log(`ok   - ${nome}`); }
  catch (e) { failed++; console.log(`FAIL - ${nome}\n       ${e.message}`); }
}

/** Il corpo del tab Anagrafica, ritagliato dal sorgente. */
function corpoAnagrafica() {
  const i = app.indexOf('const _anagraficaBody = showSecAnagrafica ? `');
  const j = app.indexOf('const _borsellinoBody = tabBorsellino ? `');
  assert.ok(i > 0 && j > i, 'il corpo del tab Anagrafica non si trova: questa prova non guarda più niente');
  return app.slice(i, j);
}

test('1. le due pieghe esistono, e sono CHIUSE all\'apertura della scheda', () => {
  /* Una `<details>` senza `open` nasce chiusa: è il comportamento chiesto. Se qualcuno le
     mettesse `open` la richiesta sarebbe annullata restando la stessa struttura, cioè in un modo
     che rileggendo il diff si vede appena. */
  const corpo = corpoAnagrafica();
  const pieghe = corpo.match(/<details class="member-piega">/g) || [];
  assert.strictEqual(pieghe.length, 2,
    `le pieghe dovrebbero essere due (riferimenti tecnici + preferenze), ne trovo ${pieghe.length}`);
  assert.ok(!/<details class="member-piega" open/.test(corpo),
    'una piega nasce APERTA: la richiesta era che la scheda si aprisse con le preferenze chiuse');
});

test('2. ⭐⭐ il riassunto della piega si CALCOLA, non è un numero fisso', () => {
  /* 📏 Misurato su 5766 schede di PROD: le preferenze sono compilate in 11 (0,19%). Un'etichetta
     «7 campi» sarebbe vera e inutile — 7 è sempre 7. 📌 Un contatore che non cambia mai non è
     un'informazione: è decorazione con l'aspetto di un dato. */
  assert.match(app, /const _prefPiene = _prefCampi\.filter\(c => cleanCell\(c\.v\) !== ''\)\.length;/,
    'il conto dei campi compilati non c\'è più: la piega tornerebbe a dire un numero fisso');
  assert.match(app, /_prefPiene \? `\$\{_prefPiene\} su \$\{_prefCampi\.length\} compilate` : 'vuote'/,
    'il riassunto non distingue più «vuote» da «N su 7 compilate»');
  /* 🔪 E che il calcolo sia USATO, non solo che esista. Sabotata il 02/09 sostituendo
     l'etichetta con «7 campi»: la guardia è passata verde, perché `_prefRiassunto` restava
     dichiarato lì accanto, inerte. È la stessa forma della guardia finta della voce 84 ⓑ, e
     nella stessa giornata. 📌 *Una dichiarazione non è un uso: si controlla il punto in cui il
     valore ARRIVA a chi legge, non quello in cui è stato calcolato.* */
  const sommario = corpoAnagrafica().match(/Preferenze operative<span class="member-piega-conta">[^<]*/);
  assert.ok(sommario, 'il sommario della piega delle preferenze non si trova');
  assert.match(sommario[0], /\$\{escapeHtml\(_prefRiassunto\)\}/,
    'il sommario mostra un\'etichetta fissa invece del riassunto calcolato: il conto esiste e non lo legge nessuno');
});

test('3. 🔒 il conto e gli input NASCONO DALLO STESSO elenco', () => {
  /* La parte che conta davvero: due elenchi separati divergono al primo che ne tocca uno, e a
     divergere sarebbe il NUMERO — cioè la metà che nessuno va a ricontrollare. */
  const corpo = corpoAnagrafica();
  assert.match(corpo, /\$\{_prefCampi\.map\(c => `<div\$\{c\.largo \? ' class="full"' : ''\}>/,
    'gli input delle preferenze non sono più generati da _prefCampi: il riassunto può mentire');
  assert.ok(!/<div><label>Giorni preferiti<\/label><input id="cardPrefDays"/.test(corpo),
    'gli input delle preferenze sono tornati scritti a mano accanto al conto che li conta');
});

test('4. i sette campi delle preferenze ci sono ancora TUTTI, con i loro id', () => {
  /* ⛔ Nasconderli non è toglierli: quegli 11 soci le preferenze ce le hanno, e un campo che
     sparisce non cancella il dato — lo rende non modificabile, che è peggio perché nessuno se
     ne accorge. */
  for (const id of ['cardPrefDays', 'cardPrefHours', 'cardAvailabilityDays', 'cardAvailabilityTime',
                    'cardDesiredFrequency', 'cardNotice', 'cardPreferredMatchType']) {
    assert.ok(app.includes(`id:'${id}'`), `il campo ${id} è sparito dalla scheda: il suo dato diventa non modificabile`);
  }
});

test('5. 🚨⭐⭐ le due azioni si vedono in Anagrafica ma restano legate al permesso ATTIVITÀ', () => {
  /* 📏 Misurato su `pmo_staff_profiles` di PROD: 4 profili, e uno è `staff` con
     view_members_anagrafica = true e view_members_attivita = FALSE. Legandole alla sezione che
     le ospita, quella persona guadagnerebbe la CANCELLAZIONE DI UN SOCIO — in silenzio, e su un
     gesto che non si disfa.
     📌 Un riordino grafico non deve allargare un permesso di passaggio. */
  assert.match(app, /const _azioniSulSocio = showSecAttivita \? `/,
    'le azioni sul socio non sono più legate a showSecAttivita: un profilo che oggi non può cancellare un socio comincerebbe a poterlo');
  const corpo = corpoAnagrafica();
  assert.match(corpo, /\$\{_azioniSulSocio\}/,
    'le azioni non compaiono più nel tab Anagrafica: la richiesta è annullata');
  assert.match(app, /_azioniSulSocio = showSecAttivita \? `[\s\S]*?deleteMemberCard\(/,
    'il bottone «Cancella socio» non è più dentro il blocco protetto');
});

test('6. il tab Attività non tiene più le azioni sul socio', () => {
  const i = app.indexOf('const _attivitaBody');
  const j = app.indexOf('const memberTabs = [');
  assert.ok(i > 0 && j > i, 'il corpo del tab Attività non si trova: questa prova non guarda più niente');
  const attivita = app.slice(i, j);
  assert.ok(!/deleteMemberCard\(/.test(attivita), '«Cancella socio» è tornato anche in Attività: due porte per lo stesso gesto');
  assert.ok(!/toggleMemberActive\(/.test(attivita), '«Disattiva» è tornato anche in Attività');
});

test('7. WhatsApp non è più cliccabile da nessun punto della scheda socio', () => {
  /* 🗣️ «tutti e due», scelto fra tre strade. ⚠️ È una funzione che si perde, non un bottone
     spostato: da qui non si scrive più a un socio. La funzione resta definita apposta —
     rimetterla è un onclick. */
  const chiamate = (app.match(/openMemberWhatsApp\('/g) || []).length;
  assert.strictEqual(chiamate, 0,
    `un bottone WhatsApp è tornato nella scheda socio (${chiamate} chiamate): la richiesta era toglierli tutti e due`);
  assert.match(app, /function openMemberWhatsApp\(memberId\)/,
    'la funzione è stata cancellata: toglierla è un\'altra decisione, e non è stata presa');
});

test('8. 🚨⭐⭐ tolte le due scritte sulla conferma email, NON il badge che ne ospita un\'altra', () => {
  /* Sotto lo stesso `notificationText` viveva anche «Livello validato da ripristinare», che è
     ROSSO e segnala un socio il cui livello certificato è ricaduto a 0,5. Toglierlo insieme
     avrebbe spento un allarme diverso, capitato lì per condivisione di riga.
     📌 Due avvisi che dividono lo stesso posto non sono lo stesso avviso. */
  assert.ok(!/'Conferma email da inviare'/.test(app), 'la scritta «Conferma email da inviare» è tornata');
  assert.ok(!/'Conferma email inviata'/.test(app), 'è tornata la gemella «Conferma email inviata»: il canale email è dismesso dal 13/08');
  assert.match(app, /needsLevelRestore \? 'Livello validato da ripristinare'/,
    'è sparito l\'avviso ROSSO del livello da ripristinare: era un allarme diverso, non la conferma email');
  assert.match(app, /\$\{notificationText \? `<span class="badge \$\{notificationClass\}">/,
    'il badge non è più condizionato al testo: comparirebbe vuoto');
});

test('9. i riferimenti tecnici sono sotto la piega, e il conto dei codici si calcola', () => {
  /* 🎯 L'argomento non è mio: la scheda lo promette già di sé, in fondo a sé stessa. */
  const corpo = corpoAnagrafica();
  const primaPiega = corpo.indexOf('Riferimenti tecnici');
  const idPadelVillage = corpo.indexOf('ID giocatore Padel Village');
  assert.ok(primaPiega > 0, 'la piega dei riferimenti tecnici non c\'è');
  assert.ok(idPadelVillage < 0, 'i codici sono tornati scritti in mezzo alla griglia «Dati socio» invece che dentro la piega');
  assert.match(app, /const _nIdTecnici = \(_idTecniciHtml\.match\(\/<label>\/g\) \|\| \[\]\)\.length;/,
    'il numero dei codici non si calcola più: l\'ID interno Matchpoint è condizionale, quindi un numero fisso mentirebbe');
  assert.match(app, /dati operativi visibili, dettagli tecnici richiudibili/,
    'è sparita la riga in fondo alla scheda che PROMETTE i dettagli tecnici richiudibili: è la ragione di questa piega');
});

test('10. 🆕 la fascia del borsellino non si disegna se non ha niente dentro', () => {
  /* 🚨 Conseguenza del togliere il WhatsApp, e il mockup non poteva mostrarla: la fascia era
     «borsellino a sinistra, azioni a destra», e per chi NON ha il permesso Borsellino il lato
     sinistro era già un div vuoto. Tolto il bottone restava una scatola bordata con dentro
     niente — una cornice attorno al nulla, che sembra un guasto.
     📌 *Togliere un elemento non è solo togliere lui: è chiedersi cosa reggeva il contenitore
     che lo teneva.* */
  assert.ok(!/<div class="member-hero-actions">/.test(app),
    'la riga delle azioni della fascia è tornata: era il solo motivo per cui la fascia aveva due colonne');
  assert.match(app, /\$\{\(PMO_PAYMENTS_UI_ENABLED && showSecBorsellino\) \? `<div class="member-hero">/,
    'la fascia non è più condizionata al borsellino: senza quel permesso si disegna una cornice vuota');
});

console.log(`\n${passed} verdi · ${failed} rossi`);
if (failed > 0) process.exit(1);
