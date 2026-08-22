/* esito-prenotazione.js — I TRE ESITI, in JavaScript e per la stessa ragione di `conoscenza.js`.
 *
 * Qui vive la decisione della voce 23: come si chiama ciò che è successo quando si è chiesto al
 * worker di prenotare. Sta in un modulo a sé, e in `.js`, per due motivi che si tengono:
 *
 *   · è una REGOLA PURA — nessuna rete, nessun database, nessun `Deno` — quindi si può eseguire
 *     davvero in un banco di prova invece di essere constatata leggendo il sorgente;
 *   · `.js` perché il banco gira in Node e Node non compila TypeScript. La stessa medicina della
 *     voce 27: da un modulo vero non si estrae «a fette cercando marcatori di testo», si importa.
 *
 * ⭐⭐ GLI ESITI SONO TRE, non due: fatta, non fatta, e NON LO SO.
 *
 * Il terzo nasce quando la richiesta al worker non riceve MAI una risposta — rete caduta, tempo
 * scaduto. A quel punto il worker può avere già scritto la prenotazione sul Matchpoint del
 * circolo, oppure no, e da dentro l'edge non è dato saperlo. Fino alla v6.231 quel caso veniva
 * scritto come «errore», cioè appiattito sul secondo esito.
 *
 * 🚨 Non è una questione di parole: l'operatore legge «fallita», la rifà, e se la prima era
 *    passata il campo resta prenotato DUE VOLTE sul sistema del circolo. Sulla strada del
 *    ricorrente, che ne crea fino a quattro di fila, il danno si moltiplica.
 *
 * ⚖️ Perché non si ritenta e basta: il retry lo fa la sorella `cancel`, e lì è innocuo — disdire
 *    due volte non fa danno. Qui no, ed è per questo che il codice porta da sempre il commento
 *    «NESSUN retry: la prenotazione potrebbe essere già stata creata dal worker». Quel commento
 *    sapeva già tutto: quello che mancava era DIRLO a chi sta dall'altra parte.
 *
 * 📌 E dall'altra parte la macchina c'era già: la regola del committente (v6.150) — «quando
 *    l'esito resta IGNOTO non si indovina, si va a GUARDARE su Matchpoint» — è implementata in
 *    `staffCalAskMatchpoint`, coi suoi tre verdetti si/no/boh. Mancava solo che l'edge le
 *    consegnasse il caso invece di chiamarlo errore.
 */

/* Il marchio sta su una PROPRIETÀ, non sulle parole del messaggio, ed è deliberato.
 * ⚠️ La tentazione era riconoscere l'ignoto cercando «network» nel testo dell'errore: è lo stesso
 * setaccio a maglie larghe che nella voce 36 aveva classificato sette dispatcher come «letture»
 * perché non contenevano `insert`. Una condizione si riconosce da COSA È SUCCESSO — non abbiamo
 * ricevuto risposta — non da quali parole contiene la stringa che la racconta. */
export function esitoIgnoto(errore) {
  return !!(errore && typeof errore === 'object' && errore.esitoIgnoto === true);
}

/* Fabbrica l'errore del terzo esito. Si usa SOLO dove non è arrivata risposta: un rifiuto del
 * worker è una risposta, e quello resta un errore normale. */
export function erroreEsitoIgnoto(messaggio) {
  const e = new Error(messaggio);
  e.esitoIgnoto = true;
  return e;
}

/* Come si chiude il lavoro asincrono. Ritorna lo `status` da scrivere nella riga del job e, per
 * il terzo esito, la frase da mostrare a chi guarda — che deve contenere l'ISTRUZIONE, non solo
 * la constatazione: «controlla su Matchpoint prima di rifarla». */
export function decidiEsitoDelLavoro(errore, tipoLabel) {
  if (!esitoIgnoto(errore)) return { status: 'error' };
  const cosa = String(tipoLabel || 'prenotazione').toLowerCase();
  return {
    status: 'unknown',
    message: `Non ho ricevuto risposta dal gestionale: la ${cosa} potrebbe essere stata creata lo stesso. Controlla su Matchpoint prima di rifarla.`,
  };
}

/* Il gemello per la strada SINCRONA, da cui passa il RICORRENTE.
 * ⚖️ Resta un rifiuto (502) anche nel caso ignoto, perché contarlo come riuscito sarebbe la bugia
 * opposta e più cara. Cambia il CODICE, così chi legge distingue «rifiutata» da «non lo so»
 * invece di doverlo indovinare dal testo del messaggio. */
export function codiceDiRifiuto(errore) {
  return esitoIgnoto(errore) ? 'WORKER_ESITO_IGNOTO' : 'WORKER_ERROR';
}

/* ── ⏳→✅/❌ CHIUDERE UN LAVORO RIMASTO «IGNOTO» ───────────────────────────────────────────────
 *
 * 🚨 Il residuo della voce 23, misurato il 15/08/2026 collaudandola in produzione. Quando questa
 * funzione decide `unknown`, l'app poi VA A GUARDARE su Matchpoint e arriva a un verdetto — ma
 * fino a oggi quel verdetto restava nel `localStorage` di quel browser. Nel database il lavoro
 * rimaneva `unknown` PER SEMPRE: chi legge `pmo_cloud_records` vedeva una domanda ancora aperta
 * che era già stata chiusa. Piccola, ma della stessa famiglia dei documenti che mentono.
 *
 * ⭐ È qui, e non nella edge, per la ragione di tutto questo modulo: la decisione dev'essere
 * ESEGUIBILE in un banco. Le due condizioni che contano non si vedono leggendo il codice —
 * si vedono provandole.
 *
 * 🔒 ① SI CHIUDE SOLO CIÒ CHE È IGNOTO. Se il lavoro è già `done` o `error`, quella è la parola
 *    del worker, che la cosa l'ha vista da vicino; l'app ha guardato il calendario da fuori e non
 *    deve poterla sovrascrivere. Non è un errore chiederlo: si risponde «non chiudibile».
 * 🚨 ② `status` e `updated_at` VANNO TOLTI dal payload vecchio prima di ricopiarlo. Chi scrive la
 *    riga li mette per primo e ciò che arriva dopo li sovrascriverebbe: il lavoro resterebbe
 *    `unknown` avendo però risposto «chiuso» — cioè una bugia nuova al posto di quella tolta.
 *    Il resto si conserva: una riga di stato che perde il COSA non serve a chi la legge.
 * ⚖️ Il terzo verdetto (`boh`) non chiude niente, e nemmeno arriva fin qui: un «non lo so» che
 *    chiude un lavoro sarebbe il terzo esito arrotondato al secondo — il difetto di partenza,
 *    rifatto un piano più in là.
 */
export function chiusuraDelLavoroIgnoto(precedente, verdetto, opzioni) {
  if (verdetto !== 'si' && verdetto !== 'no') {
    return { chiudibile: false, motivo: 'VERDETTO_NON_VALIDO', status: null, payload: null };
  }
  const riga = (precedente && typeof precedente === 'object') ? precedente : {};
  const statusOra = String(riga.status ?? '').trim();
  if (statusOra !== 'unknown') {
    return { chiudibile: false, motivo: 'NON_IGNOTO', status: statusOra || null, payload: null };
  }
  const opts = opzioni || {};
  const tentativi = Number(opts.tentativi) || 0;
  const quando = String(opts.quando || '');
  const { status: _statusVecchio, updated_at: _updatedVecchio, error: erroreIniziale, ...resto } = riga;
  const payload = Object.assign({}, resto);
  // L'errore di rete di allora resta scritto, ma cambia nome: su un lavoro chiuso con `si`,
  // `error` significherebbe «non è stata creata», che è falso.
  if (erroreIniziale) payload.errore_iniziale = erroreIniziale;
  payload.chiusa_da = 'verifica-app';
  payload.verdetto = verdetto;
  if (quando) payload.chiusa_il = quando;
  if (tentativi > 0) payload.tentativi_verifica = tentativi;
  if (verdetto === 'si') {
    payload.message = 'Esito ignoto risolto guardando su Matchpoint: la prenotazione C’È.';
  } else {
    payload.message = 'Esito ignoto risolto guardando su Matchpoint: la prenotazione NON c’è, lo slot è rimasto libero.';
    payload.error = 'La richiesta non è arrivata a Matchpoint (verificato guardando: non risulta niente).';
  }
  return { chiudibile: true, motivo: '', status: verdetto === 'si' ? 'done' : 'error', payload };
}

/* ══════════════════════════════════════════════════════════════════════════════════════════
 * ⚖️⭐⭐ QUANDO UN RIFIUTO DEL WORKER È DAVVERO UN RIFIUTO — voce 72, 22/08/2026.
 *
 * 🚨 IL BUCO, misurato leggendo il codice e non supposto. Fin qui l'ignoto nasceva in UN punto
 * solo: la `fetch` verso il worker che non riceve risposta (`erroreEsitoIgnoto`, sopra). Il
 * commento che l'accompagna dice *«un rifiuto del worker è una risposta, e quello resta un
 * errore normale»* — vero per i rifiuti che il worker sa di dare, FALSO per uno che dà senza
 * saperlo:
 *
 *   · la coda del worker ha concorrenza 1 e un timeout di 180 s sulle interattive. Quando
 *     scatta, `Promise.race` **smette di aspettare ma non interrompe Playwright** — lo dice il
 *     commento del worker stesso, «l'operazione NON è stata interrotta… zombie» — e il browser
 *     viene chiuso sotto. Se il timeout cade DOPO il click su «Salvare», la prenotazione sul
 *     sistema del circolo **c'è**;
 *   · quel timeout esce come un errore qualunque (HTTP 500, `QUEUE_JOB_TIMEOUT`) ⇒ arrivava
 *     qui come `WORKER_ERROR`, cioè come **«non è passata»**.
 *
 * ⚖️ Il verso in cui si può sbagliare NON è simmetrico, ed è tutta la ragione di questa regola:
 *   · un «non lo so» di troppo costa **un'attesa** — il bot controlla e lo dice lui;
 *   · un «non è passata» falso costa **una doppia prenotazione**, cioè un campo occupato due
 *     volte e il socio che paga il conto di una cosa che non ha chiesto.
 * ⇒ Perciò si elencano i codici **CERTI**, e tutto il resto — codici nuovi compresi — cade
 *   nell'ignoto. È la stessa forma di `dettaglioPerIlBot`: fallisce CHIUSA.
 *
 * 📏 L'elenco non è a sentimento: sono i codici che `createBookingWithBrowser` può lanciare
 * **prima** del click su «Salvare» (validazioni, campo, tabellone, form non aperto, giocatore
 * non agganciato), più quelli che non arrivano nemmeno al browser (autenticazione, rotta
 * assente, endpoint non implementato). Chi ne aggiunge uno al worker lo aggiunga qui **solo se
 * sa dire dove sta rispetto al salvataggio**: nel dubbio, non aggiungerlo — il dubbio è già la
 * risposta giusta.
 * ══════════════════════════════════════════════════════════════════════════════════════════ */
export const CODICI_FALLIMENTO_CERTO = new Set([
  // Non è mai arrivato al browser
  'WORKER_UNAUTHORIZED',
  'MATCHPOINT_WORKER_API_KEY_MISSING',
  'MATCHPOINT_WORKER_SECRETS_MISSING',
  'NOT_FOUND',
  'WORKER_CREATE_BOOKING_NOT_IMPLEMENTED',
  // Validazioni della richiesta, prima di aprire qualunque pagina
  'INVALID_CAMPO', 'INVALID_DATA', 'INVALID_ORA', 'INVALID_NOME', 'INVALID_TIPO',
  'CAMPO_NON_VALIDO',
  // Il form non si è mai aperto, o lo slot era già occupato
  'TABELLONE_CELL_NOT_FOUND',
  'BOOKING_FORM_NOT_FOUND',
  'FICHA_FORM_NOT_VISIBLE',
  'FICHA_LEZIONE_FORM_NOT_VISIBLE',
  'FICHA_MANUTENZIONE_FORM_NOT_VISIBLE',
  'SLOT_NOT_FREE',
  // Il giocatore non si è agganciato: il worker si ferma APPOSTA prima di salvare
  // («NON salvare dichiarando "creata". Fallisci esplicito → l'app SA di dover ritentare»).
  'PLAYER_ADD_INCOMPLETE',
  // Il bottone di salvataggio non è stato trovato ⇒ non è stato premuto.
  // ⚠️ Con una riserva, che è il caso qui sotto: vale solo se non è stato nemmeno TENTATO.
  'SAVE_BUTTON_NOT_FOUND',
]);

/**
 * Il worker ha **provato** a premere «Salvare» prima di arrendersi?
 *
 * 🚨⭐ È la crepa dentro `SAVE_BUTTON_NOT_FOUND`, e senza questa funzione l'elenco di sopra
 * direbbe una bugia. `clickFormSave` prova i selettori in fila: se un click parte e poi
 * fallisce — l'elemento si stacca perché la pagina sta già navigando, cioè **proprio quando il
 * salvataggio è andato a buon fine** — l'errore viene messo da parte, il ciclo continua sui
 * selettori seguenti (che ormai non si vedono più) e finisce con «bottone non trovato».
 * ⇒ Lo stesso codice racconta due fatti opposti: *nessun bottone c'era* e *ho premuto e non so
 * com'è finita*. A distinguerli basta ciò che il worker **già scrive** in `navigationAttempts`,
 * senza toccarlo: `action: 'save_attempt'` compare solo dopo un click partito.
 */
export function salvataggioTentato(diagnostic) {
  const d = (diagnostic && typeof diagnostic === 'object') ? diagnostic : {};
  const tentativi = Array.isArray(d.navigationAttempts) ? d.navigationAttempts : [];
  return tentativi.some((t) => t && typeof t === 'object' && String(t.action || '') === 'save_attempt');
}

/**
 * Il corpo con cui il worker ha rifiutato → `'certo'` oppure `'ignoto'`.
 *
 * ⭐ Prende il CORPO, non il messaggio: la condizione si riconosce da cosa è successo, non da
 * quali parole contiene la stringa che la racconta — la stessa ragione per cui `esitoIgnoto`
 * guarda una proprietà (voce 36, i sette dispatcher classificati per le parole del sorgente).
 */
export function esitoDellaRispostaWorker(corpo) {
  const c = (corpo && typeof corpo === 'object') ? corpo : {};
  const codice = String(c.error ?? '').trim().toUpperCase();
  if (!CODICI_FALLIMENTO_CERTO.has(codice)) return 'ignoto';
  if (codice === 'SAVE_BUTTON_NOT_FOUND' && salvataggioTentato(c.diagnostic)) return 'ignoto';
  return 'certo';
}
