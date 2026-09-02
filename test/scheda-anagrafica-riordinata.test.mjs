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
 * 🔪🚨 COME SI SABOTANO, e va letto prima di farlo: DUE VOLTE il 02/09 un sabotaggio è passato
 *   verde non perché la guardia fosse debole, ma perché il colpo era andato **altrove** —
 *   `@media (max-width: 760px)` compare 9 volte nel file, e la riga
 *   `g.active !== false ? 'Attivo' : 'Inattivo'` compare 2 volte (la lista soci e la scheda).
 *   Una sostituzione «la prima occorrenza» colpiva un'altra regola, e la guardia restava
 *   inesercitata mentre sembrava esercitata.
 *   ⇒ Si sabota ANCORANDO il punto (cercare prima `<div class="member-card-badges">`, poi
 *   sostituire da lì), e si conta quante volte esiste la stringa PRIMA di toccarla.
 *   📌 *Un sabotaggio che non fallisce va sospettato prima della guardia: può essere la guardia
 *   debole, o il colpo andato altrove — e le due si distinguono solo contando.*
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
  /* 🔄 02/09 pomeriggio — le azioni sono salite nell'INTESTAZIONE (sua richiesta: «li metterei
     tutti in alto a seguire di attivo livello avanzato»). Il permesso non si è mosso: è la
     riga sopra a garantirlo, e resta la parte che conta. */
  const testa = app.slice(app.indexOf('<div class="member-card-head">'), app.indexOf('<div class="member-card-body'));
  assert.match(testa, /\$\{_azioniSulSocio\}/,
    'le azioni non compaiono più nell\'intestazione: la richiesta è annullata');
  assert.ok(!/\$\{_azioniSulSocio\}/.test(corpoAnagrafica()),
    'le azioni sono rimaste ANCHE nel corpo del tab: due porte per lo stesso gesto');
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
  /* 🔄 02/09 pomeriggio — la riga delle azioni è TORNATA, ma con dentro qualcosa: «↻ Aggiorna»
     e «＋ Ricarica». Quello che la guardia vieta non è il contenitore, è il contenitore VUOTO —
     e vietare il contenitore era una scorciatoia che ha smesso di dire la verità appena la
     fascia ha avuto di nuovo un motivo per esistere.
     📌 *Una guardia scritta sulla forma di oggi diventa un ostacolo il giorno dopo: si scrive
     su cosa NON deve succedere.* */
  const fascia = app.match(/<div class="member-hero">[\s\S]*?<\/div>` : ''\}/);
  assert.ok(fascia, 'la fascia del borsellino non si trova: questa prova non guarda più niente');
  assert.ok(!/<div class="member-hero-actions"><\/div>/.test(app),
    'la riga delle azioni è di nuovo VUOTA: la fascia torna a essere una cornice attorno al nulla');
  assert.match(fascia[0], /pmoApriRicarica\('/,
    'sparito «＋ Ricarica» dalla fascia: era la ragione per cui la fascia occupa spazio');
  assert.match(app, /\$\{\(PMO_PAYMENTS_UI_ENABLED && showSecBorsellino\) \? `<div class="member-hero">/,
    'la fascia non è più condizionata al borsellino: senza quel permesso si disegna una cornice vuota');
});

test('11. le sette caselle di «Dati socio» stanno su righe fisse, non a caso', () => {
  /* 🗣️ Sua richiesta: nome, cognome e sesso sulla stessa riga; telefono ed email insieme; bot
     Telegram e livello insieme. ⚖️ La classe è SUA e non tocca `.member-form-grid`, che serve
     anche alle pieghe e ad altre sezioni: cambiarla lì avrebbe riordinato schermate che nessuno
     ha chiesto di toccare. */
  const corpo = corpoAnagrafica();
  assert.match(corpo, /<div class="member-form-grid member-griglia-fissa">/,
    'la griglia di «Dati socio» non ha più le righe fisse: i campi tornano a disporsi da soli');
  for (const [et, cls] of [['Nome','c2'], ['Cognome','c2'], ['Sesso','c2'],
                           ['Telefono','c3'], ['Email','c3'], ['Livello di gioco','c3']]) {
    assert.ok(corpo.includes(`<div class="${cls}"><label>${et}</label>`),
      `il campo «${et}» non occupa più ${cls === 'c2' ? 'un terzo' : 'metà'} riga: le righe si scompongono`);
  }
  assert.match(corpo, /<div class="c3" id="cardBotTelegramRow" hidden>/,
    'la riga del bot Telegram non sta più a metà riga accanto al livello');
  assert.match(app, /\.member-form-grid\.member-griglia-fissa \{ grid-template-columns:repeat\(6, 1fr\); \}/,
    'le sei colonne non ci sono più: 3+3 e 2+2 non tornerebbero esatte');
  assert.match(app, /@media \(max-width: 760px\) \{\s*\.member-form-grid\.member-griglia-fissa \{ grid-template-columns:1fr; \}/,
    'tolto il ritorno a una colonna sotto i 760px: su un telefono i campi diventano illeggibili');
});

test('12. i bottoni in fondo non tornano: erano gli STESSI di quelli in alto', () => {
  /* 📏 Misurato prima di toglierli: «Annulla» chiamava closeMemberCard() e «Salva scheda»
     saveMemberCard(id) — le stesse identiche funzioni di «Chiudi» e «Salva». Una coppia sola
     scritta due volte con due nomi diversi, e due nomi per lo stesso gesto fanno credere che i
     gesti siano due. */
  const i = app.indexOf('<div class="member-card-footer">');
  const j = app.indexOf('</div>`;', i);
  assert.ok(i > 0 && j > i, 'il piede della scheda non si trova: questa prova non guarda più niente');
  const piede = app.slice(i, j);
  assert.ok(!/>Salva scheda</.test(piede), 'è tornato «Salva scheda»: fa esattamente quello che fa «Salva» in alto');
  assert.ok(!/>Annulla</.test(piede), 'è tornato «Annulla»: fa esattamente quello che fa «Chiudi» in alto');
  /* 🔒 E che i due in alto ci siano ancora: toglierne uno per sbaglio lascerebbe la scheda
     senza modo di salvare, che è il difetto peggiore di tutti. */
  const testa = app.slice(app.indexOf('<div class="member-card-head">'), app.indexOf('<div class="member-card-body'));
  assert.match(testa, /onclick="closeMemberCard\(\)">Chiudi</, 'sparito «Chiudi» dall\'intestazione');
  assert.match(testa, /saveMemberCard\('\$\{escapeHtml\(String\(g\.id\)\)\}'\)">Salva</, 'sparito «Salva» dall\'intestazione: la scheda non si salverebbe più');
});

test('13. 🔒 «Disattiva» chiede conferma — e solo quando disattiva', () => {
  /* 📏 Prima dello spostamento `toggleMemberActive` agiva al PRIMO click, e stava in fondo a un
     tab: la distanza era la sua unica protezione. Salito accanto a «Salva», che è il bottone più
     premuto della scheda, quella protezione non c\'è più.
     ⚖️ Solo per disattivare: riattivare non toglie niente a nessuno, e una conferma su un gesto
     innocuo è la strada per farle ignorare tutte. */
  assert.match(app, /const staDisattivando = giocatori\[idx\]\.active !== false;/,
    'sparita la distinzione fra disattivare e riattivare: la conferma finirebbe anche su un gesto innocuo');
  assert.match(app, /if \(staDisattivando && !confirm\(/,
    'tolta la conferma su «Disattiva»: il bottone è accanto a «Salva» e agirebbe al primo click');
  assert.match(app, /function deleteMemberCard[\s\S]{0,400}?if \(!confirm\(/,
    'sparita la conferma di «Cancella socio»: è il gesto che non si disfa');
});

test('14. 🚨⭐ «＋ Ricarica» apre la FINESTRA, e la finestra è la conferma', () => {
  /* 📏 Misurato prima di disegnarlo: la ricarica vera (`_pmoRechargeWallet` → edge
     `matchpoint-wallet-correct`) scrive DAVVERO sul Matchpoint del circolo e NON chiede nessuna
     conferma. Oggi la protegge solo il fatto che devi aprire apposta il tab Borsellino.
     ⇒ Il bottone in cima apre quel riquadro e mette il cursore nell'importo.
     📌 *Avvicinare un gesto senza conferma al posto più battuto equivale a togliergliela.* */
  const fascia = app.match(/<div class="member-hero">[\s\S]*?<\/div>` : ''\}/);
  assert.ok(fascia, 'la fascia non si trova');
  assert.ok(!/pmoWalletRechargeClick\(/.test(fascia[0]),
    'la SCRITTURA della ricarica è finita nella fascia in cima: è una scrittura reale su Matchpoint e non chiede conferma');
  assert.ok(!/pmoWalletRechargeAmt/.test(fascia[0]),
    'il campo dell\'importo è finito in cima: la cifra si digita dove si conferma il gesto, non in testa a ogni scheda');
  assert.match(fascia[0], /pmoApriRicarica\('/,
    'il bottone in cima non apre più la finestra della ricarica');
  assert.match(app, /const okGo = \(opts\.giaConfermato === true\) \? true : await _pmoConfirmRecharge/,
    'la finestra non sostituisce più la conferma dell\'Assistente AI: due domande per un gesto solo, e la seconda invisibile');
  /* 🔄 02/09 sera — questa riga cercava `.then(chiudiSeVa)`, che era la forma di poche ore fa.
     La chiusura ora vive dentro `_pmoFinestraEsito`, condiviso con lo storno. ⇒ La guardia è stata
     CORRETTA, non tolta: controlla la stessa cosa (si chiude solo se è andata) nel punto in cui
     quella cosa adesso succede. 📌 *Una guardia scritta sulla forma di oggi diventa un ostacolo
     domani: si riscrive sul fatto, non sulla riga.* */
  assert.match(app, /_pmoFinestraEsito\(btn, '<span class="pmo-spin">↻<\/span> Ricarica in corso…', function \(\) \{\s*return _pmoRechargeWallet\(\{ giaConfermato: true/,
    'la ricarica non passa più dalla finestra: il suo esito tornerebbe solo nel pannello dell\'Assistente AI');
  assert.match(app, /if \(esito && esito\.ok\) \{ pmoChiudiRicarica\(\); return esito; \}/,
    'la finestra si chiude anche quando il gesto NON è riuscito, oppure non si chiude mai');
  assert.strictEqual((app.match(/id="pmoWalletRechargeAmt"/g) || []).length, 1,
    'la casella dell\'importo esiste in due posti: la finestra leggerebbe quella sbagliata');
});

test('15. il livello sta su UNA riga, così non lascia il buco accanto al bot Telegram', () => {
  /* 🗣️ Sua richiesta: «sistema anche lo spazio del bot Telegram».
     📌 Uno spazio vuoto in una griglia non è quasi mai colpa della casella vuota: è l'altezza
     della sua vicina. Qui la vicina era il livello, con cifra, parola e lucchetto IMPILATI. */
  const corpo = corpoAnagrafica();
  assert.match(corpo, /<div class="member-livello-riga"><input type="number"/,
    'il livello è tornato impilato: la sua casella ricresce e il buco sotto «Bot Telegram» torna');
  assert.ok(!/id="cardLevelUnlock" style="margin-top:6px;"/.test(corpo),
    'il lucchetto è tornato sotto invece che in linea');
  assert.match(app, /\.member-livello-riga \{ display:flex; align-items:center;/,
    'tolta la regola che mette cifra, parola e lucchetto in linea');
});

test('16. 🚨⭐ le tre etichette in cima sono via — ma «Inattivo» resta, e solo quando lo è', () => {
  /* 🗣️ Sua richiesta: «ci sono queste 3 label che non servono a nulla, levale».
     ⚖️ Due erano DOPPIONI: l'ID sta nei «Riferimenti tecnici», il livello nel campo «Livello di
     gioco» — e da questo giro si leggono nella stessa schermata, quindi ripeterli in cima non
     aggiungeva niente.
     🚨 La terza no: «Attivo/Inattivo» era l'unico posto che diceva se il socio è disattivato.
     📏 Su 5766 schede di PROD 2001 sono disattivate (35%) ⇒ «Attivo» è il caso normale, cioè
     rumore su due schede su tre; «Inattivo» è l'eccezione, cioè informazione.
     📌 *Un'etichetta che dice sempre la stessa cosa non informa; la stessa etichetta, quando
     dice l'eccezione, è l'unica cosa da leggere.* */
  const i = app.indexOf('<div class="member-card-badges">');
  const j = app.indexOf('</div>', i);
  assert.ok(i > 0 && j > i, 'la riga delle etichette non si trova: questa prova non guarda più niente');
  const badges = app.slice(i, j);
  assert.ok(!/>ID \$\{escapeHtml\(formatMemberIdLabel/.test(badges),
    'è tornata l\'etichetta dell\'ID: lo stesso codice sta già nei «Riferimenti tecnici»');
  assert.ok(!/Livello \$\{escapeHtml\(pmoLivelloEtichettaStaff/.test(badges),
    'è tornata l\'etichetta del livello: lo stesso valore sta già nel campo «Livello di gioco»');
  /* 🔄 Corretto da lui: «va bene lascia solo attivo» ⇒ l'etichetta di stato si vede SEMPRE, in
     tutti e due gli stati, non solo quando è inattiva. La mia versione la mostrava solo
     nell'eccezione; la sua ragione batte la mia — chi apre venti schede di fila legge lo stesso
     posto ogni volta, e un'etichetta che a volte c'è e a volte no costringe a chiedersi se
     manca o se non è stata disegnata. */
  assert.match(badges, /\$\{g\.active !== false \? 'Attivo' : 'Inattivo'\}/,
    'lo stato del socio non si vede più in entrambi i casi: una scheda disattivata diventa indistinguibile da una viva');
});

if (failed > 0) process.exit(1);

test('17. 🚨⭐ «↩︎ Storna» chiede conferma nella SUA finestra, e conferma la cifra che ha mostrato', () => {
  /* 🗣️ Sua domanda del 02/09 sera: «se sbaglio a fare una ricarica come la correggo?». Lo
     strumento c'era già — lo storno nel tab Borsellino — ma con **lo stesso difetto** appena curato
     sulla ricarica: `_pmoConfirmVoidWallet` fa la domanda con `svcAddMessage`, cioè nel pannello
     dell'Assistente AI, lontano dal bottone premuto. Si premeva «Storna» e nella scheda non
     succedeva niente.
     🔪 SABOTAGGI, contando prima (trappola del 02/09 mattina): `giaConfermato` compare 4 volte nel
     sorgente e `_pmoStornoInCorso` 6 — ancorare al nome della funzione, non alla prima occorrenza. */
  assert.match(app, /const okGo = \(opts\.giaConfermato === true\) \? true : await _pmoConfirmVoidWallet/,
    'la finestra non sostituisce la conferma dell\'Assistente AI: sarebbero due domande per un gesto solo, e la seconda invisibile');
  assert.match(app, /function pmoWalletVoidClick[\s\S]{0,1400}?return pmoApriStorno\(/,
    'il bottone «Storna» non apre più la finestra: la domanda tornerebbe nel pannello AI');
  assert.ok(!/function pmoWalletVoidClick[\s\S]{0,1400}?return _pmoVoidWallet\(/.test(app),
    'il bottone «Storna» scrive DIRETTAMENTE su Matchpoint saltando la finestra');
  // ③ l'importo confermato è quello congelato all'apertura, non riletto dalla casella dietro.
  assert.match(app, /function pmoConfermaStorno[\s\S]{0,1200}?subtractCents: inCorso\.subtractCents/,
    'lo storno rilegge l\'importo al momento del sì: si confermerebbe una cifra e se ne stornerebbe un\'altra');
  assert.ok(!/function pmoConfermaStorno[\s\S]{0,1200}?pmoWalletVoidAmt/.test(app),
    'la conferma torna a leggere la casella viva dietro la finestra');
  assert.match(app, /function pmoConfermaStorno[\s\S]{0,1200}?inCorso\.memberId !== String\(memberId\)/,
    'sparito il controllo che la finestra stia confermando il socio che ha mostrato');
  // La finestra muore con lo storno congelato, da QUALUNQUE porta (compreso il click sullo sfondo).
  assert.match(app, /function pmoChiudiRicarica\(\)[\s\S]{0,600}?_pmoStornoInCorso = null;/,
    'chiudendo dallo sfondo lo storno congelato sopravvive alla finestra che lo ha mostrato');
  // Una sola casella dell'importo: due con lo stesso id a schermo è il guasto già pagato.
  assert.strictEqual((app.match(/id="pmoWalletVoidAmt"/g) || []).length, 1,
    'la casella dell\'importo dello storno esiste in due posti: si leggerebbe quella sbagliata');
  assert.match(app, /_pmoFinestraEsito\(btn, '<span class="pmo-spin">↻<\/span> Storno in corso…', function \(\) \{\s*return _pmoVoidWallet\(\{ giaConfermato: true/,
    'lo storno non passa dall\'helper dell\'esito: errore e attesa tornerebbero solo nel pannello AI');
});

console.log(`\n${passed} verdi · ${failed} rossi`);
