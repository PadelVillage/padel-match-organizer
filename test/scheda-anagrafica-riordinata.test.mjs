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
  /* 🔄 02/09 sera — il fondo era `const _borsellinoBody = tabBorsellino ? \`', sparito col tab
     Borsellino. La guardia si RIANCORA al blocco successivo: nove prove leggevano questo ritaglio,
     e tutte e nove sono cadute insieme con «non guarda più niente» — cioè fallendo bene, dicendo la
     verità invece di passare verdi su una stringa vuota.
     📌 *Un ritaglio delimitato da un vicino muore quando il vicino trasloca: che si accorga di
     esserlo, invece di misurare il nulla, è metà del suo valore.* */
  const j = app.indexOf('/* 🎓 VOCE 98 — IL RIQUADRO DEL MAESTRO');
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

test('6. 🔄 le azioni sul socio stanno in UN posto solo (il tab Attività non esiste più)', () => {
  /* 🔄 02/09 sera — la guardia diceva «il tab Attività non tiene più le azioni sul socio», e il
     tab Attività da questo giro NON C'È: al suo posto c'è «Pagamenti». Se restasse com'era
     leggerebbe una fetta vuota e passerebbe verde per sempre — la forma peggiore di guardia.
     ⇒ Riscritta sul FATTO che proteggeva, che il tab non lo nominava nemmeno: «Disattiva» e
     «Cancella socio» esistono in UN posto solo, cioè `_azioniSulSocio`.
     📌 *Una guardia scritta sul contenitore muore col contenitore; scritta sul fatto, sopravvive
     al trasloco.* */
  assert.ok(!/const _attivitaBody/.test(app), 'il tab Attività è tornato');
  assert.strictEqual((app.match(/deleteMemberCard\('/g) || []).length, 1,
    '«Cancella socio» è chiamato da più di un posto: due porte per il gesto che non si disfa');
  assert.strictEqual((app.match(/toggleMemberActive\('/g) || []).length, 1,
    '«Disattiva» è chiamato da più di un posto');
  assert.match(app, /const _azioniSulSocio = showSecAttivita \? `/,
    'le due azioni non sono più legate al permesso ATTIVITÀ: il profilo staff guadagnerebbe la cancellazione di un socio');
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

test('17. 🚨⭐ «↩︎ Storna» sta nella fascia e chiede conferma nella SUA finestra', () => {
  /* 🗣️ Nato dalla sua domanda «se sbaglio a fare una ricarica come la correggo?»: lo strumento
     c'era già — lo storno — ma faceva la domanda con svcAddMessage, cioè nel pannello
     dell'Assistente AI, lontano dal bottone premuto.
     🔄 **Questa guardia è stata RISCRITTA due volte in una sera, e la seconda volta di proposito.**
     Nel primo giro proteggeva `_pmoStornoInCorso` — l'importo congelato all'apertura — perché la
     casella viveva nel tab Borsellino, cioè FUORI dalla finestra, e restava viva dietro di essa.
     Col tab eliminato la casella è entrata nella finestra ⇒ quella variabile è sparita e la guardia
     si riscrive su ciò che protegge lo stesso fatto adesso: la casella è UNA, e sta dentro
     `pmoApriStorno`. 📌 *Quando la struttura rende impossibile un errore, la guardia che lo
     inseguiva si riscrive sulla struttura: tenerla com'era proteggerebbe un meccanismo morto.*
     🔪 SABOTAGGI, contando prima: `giaConfermato` compare 4 volte, `pmoApriStorno` 4 — si ancora
     al nome della funzione, mai alla prima occorrenza. */
  const fascia = app.match(/<div class="member-hero">[\s\S]*?<\/div>` : ''\}/);
  assert.ok(fascia, 'la fascia non si trova');
  assert.match(fascia[0], /pmoApriStorno\('/,
    'sparito «↩︎ Storna» dalla fascia: col tab Borsellino eliminato non resterebbe NESSUN modo di correggere una ricarica sbagliata');
  assert.ok(!/pmoConfermaStorno\(/.test(fascia[0]),
    'la SCRITTURA dello storno è finita nella fascia: è denaro reale su Matchpoint, si conferma dove si digita la cifra');
  assert.match(fascia[0], /PMO_WALLET_WRITE_ENABLED && _walletHaSaldo\(g\)/,
    'lo «Storna» si mostra anche su un borsellino a zero: un bottone che non può riuscire promette e delude');
  assert.match(app, /const okGo = \(opts\.giaConfermato === true\) \? true : await _pmoConfirmVoidWallet/,
    'la finestra non sostituisce la conferma dell\'Assistente AI: sarebbero due domande per un gesto solo, e la seconda invisibile');
  // La casella dell'importo è UNA sola e sta DENTRO la finestra: è questo che rende vero
  // «si conferma la cifra che si è vista», da quando il congelamento non serve più.
  assert.strictEqual((app.match(/id="pmoWalletVoidAmt"/g) || []).length, 1,
    'la casella dell\'importo dello storno esiste in due posti: si leggerebbe quella sbagliata');
  assert.match(app, /function pmoApriStorno[\s\S]{0,2600}?id="pmoWalletVoidAmt"/,
    'la casella dell\'importo è di nuovo FUORI dalla finestra: resterebbe viva dietro, e si confermerebbe una cifra stornandone un\'altra');
  assert.match(app, /function pmoApriStorno[\s\S]{0,2600}?id="pmoStornoDopo"/,
    'sparito il «saldo dopo lo storno»: è l\'unico numero che dice cosa sta per succedere');
  assert.match(app, /function pmoConfermaStorno[\s\S]{0,900}?sub > cur[\s\S]{0,200}?supera il saldo/,
    'tolto il controllo dell\'importo prima della chiamata: l\'errore tornerebbe dopo trenta secondi di browser remoto');
  assert.match(app, /_pmoFinestraEsito\(btn, '<span class="pmo-spin">↻<\/span> Storno in corso…', function \(\) \{\s*return _pmoVoidWallet\(\{ giaConfermato: true/,
    'lo storno non passa dall\'helper dell\'esito: errore e attesa tornerebbero solo nel pannello AI');
});

test('18. 🗑️ il tab «Borsellino» è sparito, e NIENTE di ciò che conteneva è sparito con lui', () => {
  /* 🗣️ Sua richiesta: «controllami che la tab borsellino non serve più… e se ti torna tutto, la
     puoi pure eliminare». 📏 **Controllato: NON tornava.** Saldo, «aggiornato» e «↻ Aggiorna»
     erano doppioni della fascia, ma lo Storna e la nota per i soci senza id Matchpoint vivevano
     SOLO lì. ⇒ Prima il trasloco, poi la chiusura.
     📌 *«L'abbiamo integrata totalmente» è un'ipotesi da verificare voce per voce, non una
     premessa: si conta cosa c'era, non si guarda cosa somiglia.*
     🚨 E questa guardia esiste per il verso opposto a quello che sembra: non sorveglia che il tab
     resti morto — sorveglia che i suoi DUE inquilini unici siano ancora a casa da qualche parte. */
  assert.ok(!/const _borsellinoBody/.test(app), 'il tab Borsellino è tornato: due porte per lo stesso gesto');
  assert.ok(!/key:'borsellino'/.test(app), 'la voce «Borsellino» è tornata nella barra dei tab');
  // ① lo Storna ha una casa (guardia 17 sopra) · ② la nota dei soci senza id Matchpoint pure:
  assert.match(app, /class="member-hero-nota">💡 Questo socio non ha un id Matchpoint collegato/,
    'persa la nota per i soci SENZA id Matchpoint: viveva solo nel tab, e diceva l\'unica cosa che quelle schede possono fare');
  // Il PERMESSO resta, e resta agganciato alla fascia: eliminare il tab non cambia CHI vede.
  assert.match(app, /\$\{\(PMO_PAYMENTS_UI_ENABLED && showSecBorsellino\) \? `<div class="member-hero">/,
    'la fascia non è più condizionata al permesso Borsellino: eliminando il tab il saldo si mostrerebbe a chi non lo vedeva');
  assert.match(app, /const showSecBorsellino = _canMemberSec\('view_members_borsellino'\)/,
    'sparito il permesso view_members_borsellino: era gated il tab E la fascia');
});

test('19. 💳 la sezione «Pagamenti» ha preso il posto di «Attività», e i due tipi restano separati', () => {
  /* 🗣️ *«devi crearmi la sezione pagamenti… sia le ricariche che i pagamenti delle partite e i
     rimborsi»* + *«mettiamolo al posto di attività che non serve più»*.
     📏 **Controllato prima di eliminare Attività**: feedback post-partita = **0 soci su 2823**;
     «Ultimo messaggio inviato» scritto fisso a `-`; i contatori messaggi vivono in localStorage.
     🚨 L'unica cosa viva era «Nuova autovalutazione» ⇒ traslocata, non persa. */
  assert.match(app, /\{ key:'pagamenti', label:'Pagamenti', visible:\(PMO_PAYMENTS_UI_ENABLED && showSecBorsellino\)/,
    'la sezione Pagamenti non è nella barra dei tab, o non è più legata al permesso Borsellino');
  /* 🔀 Ordine chiesto da lui: Anagrafica · Pagamenti · Autovalutazione. Non è solo estetica —
     `_firstTabKey` prende il PRIMO visibile, quindi l'ordine decide anche dove atterra chi non ha
     il permesso Anagrafica. 📌 *Riordinare una fila cambia anche dove si arriva quando la fila si
     accorcia.* */
  assert.match(app, /key:'anagrafica'[\s\S]{0,400}?key:'pagamenti'[\s\S]{0,400}?key:'autoval'/,
    'l\'ordine dei tab non è più Anagrafica · Pagamenti · Autovalutazione');
  assert.match(app, /const _nuovaAutovalBtn = showSecAttivita \? `/,
    'perso «Nuova autovalutazione»: era l\'unico posto da cui si lancia, e il permesso che la governa è quello di ATTIVITÀ');
  /* ⚠️ `[^`]*` qui NON funziona: il corpo del tab contiene template annidati, quindi la classe
     negata si ferma al primo apice inverso interno e la guardia accusava il codice invece di sé
     stessa. 📌 *Quando una guardia nuova è rossa su codice appena scritto, si sospetta prima la
     guardia.* */
  assert.match(app, /_autovalBody = showSecAutoval \? `[\s\S]{0,600}?\$\{_nuovaAutovalBtn\}` : '';/,
    '«Nuova autovalutazione» è dichiarata ma NON agganciata al tab Autovalutazione: una dichiarazione non è un uso');
});

test('20. 🚨⭐⭐ i movimenti del borsellino NON sono record `payment`, e gli storni si leggono', () => {
  /* 🚨 **La scelta ovvia era sbagliata.** Una ricarica è un movimento di denaro, quindi verrebbe
     da scriverla come `payment` — ma la sezione **Incassi** somma TUTTI i `payment`, e il circolo
     incassa quando il credito viene **speso**, non quando viene caricato: quella riga esiste già
     (`method: 'wallet'`). ⇒ Contarla due volte avrebbe gonfiato i totali del circolo di ogni euro
     ricaricato. Va in `wallet_txn`, che era già fra i tipi ammessi dal CHECK e aveva zero righe.
     📌 *Il tipo giusto per un dato non è quello che gli somiglia: è quello che non rompe i conti
     di chi legge gli altri.*
     🚨 E gli **storni** su PROD sono marcati `deleted: true` (20 righe): la lettura ovvia — quella
     che salta i deleted, come fa `_incassiFetch` — li farebbe sparire proprio dall'elenco che
     deve mostrarli. 📌 *Un rimborso cancellato dalla vista è un rimborso che il socio non può
     verificare.* */
  const edge = readFileSync(new URL('../supabase/functions/matchpoint-wallet-correct/index.ts', import.meta.url), 'utf8');
  assert.match(edge, /record_type: 'wallet_txn'/,
    'la traccia della ricarica non è più un wallet_txn');
  assert.ok(!/record_type: 'payment'/.test(edge),
    'la ricarica è tornata a scriversi come `payment`: la sezione Incassi la conterebbe, e i totali del circolo si gonfierebbero di ogni euro ricaricato');
  assert.match(edge, /const traccia = await scriviTraccia\(\{/,
    'la traccia è dichiarata e non chiamata: le ricariche tornerebbero a non esistere');
  assert.match(edge, /if \(error\) return \{ stato: 'non_scritta', motivo: error\.message \}/,
    'l\'esito della scrittura non si guarda: supabase-js RESTITUISCE l\'errore invece di lanciarlo, e la traccia mancherebbe in silenzio');
  assert.match(edge, /traccia: traccia\.stato/,
    'la risposta non dice più se la traccia è stata scritta: resterebbe un buco che nessuno sa spiegare');
  // Il segno è la direzione, così l'elenco si somma senza conoscere `op`.
  assert.match(edge, /opts\.op === 'recharge' \? Math\.abs\(opts\.amountCents\) : -Math\.abs\(opts\.amountCents\)/,
    'perso il segno del movimento: una ricarica e uno storno diventerebbero indistinguibili nella somma');
  // Lato app: i due tipi si chiedono insieme, e gli storni NON si saltano.
  /* 🔄 la guardia chiedeva esattamente `['payment', 'wallet_txn']`: da quando la sezione si
     carica anche le prenotazioni i tipi sono quattro. Il FATTO da proteggere non è la lunghezza
     della lista — è che i due tipi dei MOVIMENTI ci siano entrambi. */
  assert.match(app, /p_record_types: \['payment', 'wallet_txn',/,
    'la sezione Pagamenti non chiede più payment e wallet_txn insieme: sparirebbero le ricariche o le partite');
  /* 🔄 02/09 sera — la guardia chiedeva `r.deleted || pl.voided_at`. La distinzione è giusta ma
     **PREVENTIVA**: 📏 misurato, le righe `deleted` senza `voided_at` sono **zero** su entrambi gli
     ambienti, e i «3.001 € di rimborsi» che avevo preso per un difetto sono storni **veri**
     (`status: voided`, `source: matchpoint`). Avevo spiegato quel numero — «saranno le simulazioni
     ripulite» — invece di misurarlo, e l'avevo già scritto in un commit.
     📌 *Una spiegazione plausibile trovata subito è il modo più rapido per smettere di cercare
     quella vera.* ⇒ La guardia resta perché il giorno in cui una riga verrà cancellata per altri
     motivi non diventi un rimborso: protegge un caso che oggi non esiste, e lo dice. */
  assert.match(app, /const stornato = !!\(pl\.voided_at \|\| \(pl\.status && pl\.status !== 'paid'\)\);/,
    'lo storno è tornato a riconoscersi dal flag `deleted`: le righe semplicemente cancellate diventerebbero rimborsi mai avvenuti');
  assert.match(app, /if \(r\.deleted && !stornato\) continue;/,
    'i record cancellati (non stornati) rientrano nell\'elenco: sono righe tolte dai conti, non movimenti');
  // Un elenco senza tetto: «Ospite» ha 689 pagamenti su PROD, 1326 su TEST.
  assert.match(app, /const visibili = tutte \? righe : righe\.slice\(0, TETTO\);/,
    'tolto il tetto all\'elenco: la scheda del cliente generico disegnerebbe centinaia di righe');
  assert.match(app, /Mostrati i \$\{visibili\.length\} più recenti su \$\{righe\.length\}/,
    'il tetto non dice più quante righe nasconde: nascondere senza dirlo è peggio che mostrare tutto');
  // Il ciclo: un errore si RICORDA, o il ridisegno rilancia il caricamento all'infinito.
  /* 🚨 Il tab si rimette dov'era: senza, la sezione era INUTILIZZABILE e nessuna guardia lo
     vedeva. Misurato aprendola: click su «Pagamenti» → caricamento → `renderOpenMemberCard`
     ridisegna → il tab attivo torna al primo, e i 42 movimenti restano in un pannello nascosto.
     📌 *Ridisegnare non è aggiornare: chi ridisegna eredita il compito di rimettere le cose dove
     chi guarda le aveva lasciate.* */
  /* 🩹 La guardia controllava la cura NEL POSTO SBAGLIATO — dentro il caricamento — ed era verde
     mentre lui vedeva la scheda saltare ancora: a ridisegnarla è anche `displayMembers()`, in
     coda, da mezza applicazione. ⇒ Ora controlla il punto da cui il difetto nasce.
     📌 *Una guardia messa dove ho visto il sintomo certifica la cura del sintomo.* */
  assert.match(app, /function renderOpenMemberCard\(\)[\s\S]{0,900}?_tabAperto = document\.querySelector\('#memberCard \.member-tab\.active'\)[\s\S]{0,600}?pmoMemberTab\(_tabAperto\)/,
    'il ridisegno della scheda non conserva più il tab aperto: torna al primo mentre si sta leggendo');
  assert.match(app, /document\.querySelector\(`#memberCard \.member-tab\[data-mtab="\$\{_tabAperto\}"\]`\)\) pmoMemberTab/,
    'si riattiva un tab senza controllare che esista ancora: coi permessi cambiati la scheda resterebbe bianca');
  assert.match(app, /window\.__pmoPagamentiCache\.set\(chiave, \{ errore:/,
    'un caricamento fallito non si ricorda: la scheda rilancerebbe la lettura a ogni ridisegno, per sempre');
  // «Partita — campo Campo 2»: il payload porta già la parola. Visto guardando, non rileggendo.
  assert.match(app, /\/\^campo\\b\/i\.test\(_campoTxt\) \? _campoTxt : \('campo ' \+ _campoTxt\)/,
    'la parola «campo» è tornata a raddoppiarsi nell\'etichetta della riga');
  assert.match(app, /Le ricariche si registrano dal 2 settembre 2026/,
    'tolto l\'avviso sulle ricariche mancanti: un elenco che tace su un pezzo è peggio di uno che dice cosa non sa');
});

test('21. 🚨⭐⭐ stornare un pagamento: il flag è SEPARATO, e si storna una riga sola', () => {
  /* 🗣️ *«voglio avere la possibilità di stornare un pagamento fatto per errore»* → poi, messo
     davanti al fatto che `PMO_PAYMENTS_WRITE_ENABLED` accende **anche l'incasso**: *«sì»* allo
     storno da solo. ⇒ Un flag in più invece di uno acceso a metà.
     📌 *Due gesti dietro lo stesso interruttore sono un gesto solo: chi vuole il primo si porta
     via il secondo senza averlo chiesto.* */
  assert.match(app, /const PMO_PAYMENTS_VOID_ENABLED = true;/,
    'sparito il flag dello storno');
  assert.match(app, /const PMO_PAYMENTS_WRITE_ENABLED = false;/,
    '🚨 l\'INCASSO si è acceso: non è stato chiesto, e si vede in segreteria');
  /* ⚠️ Scritta per reggere su ENTRAMBI i rami: su `test-preview` la riga ha in più `&& !_simulate`
     (il ramo di simulazione), che su `main` non esiste — quella variabile lì non è nemmeno
     dichiarata. Una guardia ancorata alla forma di un ramo solo diventa rossa sull'altro **nel
     momento della promozione**, cioè quando serve di più.
     📌 *Un banco che vive su due rami si scrive su ciò che i due rami hanno in comune.* */
  assert.match(app, /if \(!PMO_PAYMENTS_VOID_ENABLED && !_harness/,
    'lo storno è tornato sotto il flag dell\'incasso: o resta spento, o accende anche il cobro');

  /* 🔎 Risalire alla prenotazione: il campo nello storico si chiama `numero`, NON `idReserva`.
     🩹 Avevo cercato `idReserva`, trovato zero, e concluso «solo 2 pagamenti su 3124 sono
     stornabili». Falso: sono la stessa cosa (identici su 158 righe su 158) e la misura vera è
     **2796 su 3126**. 📌 *Cercare un campo per nome è cercarlo in una forma sola.* */
  assert.match(app, /const num = String\(b\.idReserva \|\| b\.numero \|\| ''\)\.trim\(\);/,
    'la ricerca guarda di nuovo un nome solo: nello storico il campo è `numero` e le partite passate sparirebbero');
  /* 🚨 Le prenotazioni si CHIEDONO, non si leggono da `storicoPrenotazioni`.
     📏 Misurato su PROD nel browser: quella variabile è **vuota** — l'app non idrata lo storico
     all'avvio (le prenotazioni future sì, 303 righe; lo storico no). Leggerla avrebbe dato «non
     risale» su OGNI partita passata, con tutte le guardie verdi.
     📌 *Una funzione che legge una variabile globale scommette che qualcun altro l'abbia
     riempita: se le importa davvero, se la carica.* */
  assert.match(app, /p_record_types: \['payment', 'wallet_txn', 'booking', 'booking_history'\]/,
    'la sezione non chiede più le prenotazioni: tornerebbe a dipendere da una variabile che su PROD è vuota');
  assert.match(app, /const mappaSlot = new Map\(\);/,
    'sparita la mappa slot→prenotazione costruita al caricamento');
  assert.match(app, /r\.stornabile && r\.idReserva\) \? `<button/,
    'il bottone compare anche senza prenotazione risolta: fallirebbe su una riga su dieci invece di dirlo');

  // Il bottone c'è solo dove ha senso, e passa lo SLOT (senza, l'edge non marca niente).
  assert.match(app, /stornabile: !stornato && pl\.method !== 'gift' && cents > 0,/,
    'il bottone comparirebbe anche su omaggi, su righe già stornate o a importo zero');
  /* Lo slot viaggia col click perché l'edge, senza, non sa quale riga marcare stornata
     (`SLOT_INCOMPLETO`) — e preferisce non marcarne nessuna che marcarle tutte. */
  assert.match(app, /pmoStornaPagamentoDaScheda\('\$\{escapeHtml\(chiave\)\}','\$\{escapeHtml\(r\.idReserva\)\}','\$\{escapeHtml\(r\.data\)\}','\$\{escapeHtml\(r\.campoNum\)\}','\$\{escapeHtml\(r\.oraHm\)\}'/,
    'il bottone non passa più prenotazione, giorno, campo e ora: senza, l\'edge non sa quale riga marcare');
});

test('22. 🔪🚨 lo storno marca UNA riga, non tutte quelle del socio', () => {
  /* 🚨 Il difetto più grosso della giornata, preso **rileggendo il proprio codice prima che
     girasse**: in `marcaStornato` avevo scritto `clean(pl.__slot_ok) !== 'no'` — un campo che non
     esiste, quindi una condizione sempre vera. Senza filtro sullo slot, stornare UN pagamento
     avrebbe marcato «stornati» **tutti** i pagamenti di quel socio (58 su una scheda misurata), e
     il sync non li avrebbe rimessi a posto: riconcilia solo ciò che il report gli riporta.
     📌 *Una riga che ha la forma di un controllo e non controlla niente è peggio di un controllo
     assente: chi rilegge la conta come fatta.* */
  const edge = readFileSync(new URL('../supabase/functions/matchpoint-payment-void/index.ts', import.meta.url), 'utf8');
  assert.ok(!/__slot_ok/.test(edge.replace(/\/\*[\s\S]*?\*\//g, '')),
    'il controllo finto sullo slot è tornato nel CODICE: marcherebbe stornati tutti i pagamenti del socio');
  assert.match(edge, /const slotOk = slotChiave === /,
    'sparito il confronto sullo slot: «questo pagamento» tornerebbe a essere «ogni pagamento di questa persona»');
  assert.match(edge, /return \{ stato: 'non_marcata', motivo: 'SLOT_INCOMPLETO' \};/,
    'senza uno slot completo non fallisce più chiusa: marcare a caso non si disfa');
  // Il recinto: nona copia, e l'ultimo gradino prima del worker.
  assert.match(edge, /if \(!scritturaAlCircoloConsentita\(Deno\.env\.get\('SUPABASE_URL'\)\)\) \{/,
    'sparito il recinto: da TEST si stornerebbe sul registro cassa VERO, perché il worker è condiviso');
  assert.match(edge, /if \(!idCliente && !playerName\)/,
    'senza cliente né nome il worker sceglierebbe da sé quale giocatore stornare su una partita di quattro');
});

console.log(`\n${passed} verdi · ${failed} rossi`);
