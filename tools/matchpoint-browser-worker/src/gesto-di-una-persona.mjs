/* gesto-di-una-persona.mjs — CHI, fra i job della coda, è un gesto che qualcuno ha appena
 * fatto. Regola pura, 03/09/2026, primo pezzo della voce 137 (il semaforo sul calendario).
 *
 * ⭐ In un modulo a sé e in `.mjs` per la stessa ragione di `coda-priorita.mjs` e
 * `tipo-ficha.mjs`: `server.mjs` chiama `server.listen()` appena lo si importa, quindi non è
 * importabile, quindi una regola che vive là dentro è una regola che nessuno può ESEGUIRE in
 * un banco. Qui invece si prova davvero — ed è precisamente quello che questa regola chiede,
 * perché il suo difetto tipico è **restare vera mentre il mondo cambia sotto**.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * 🚦 A COSA SERVE, con le parole del committente (03/09/2026):
 *   «come poter avere sul gestionale la visione di quello che sta succedendo sul Matchpoint
 *    NON legato alla scheda… tipo in sovrapposizione sul calendario»
 * e, misurando lui stesso il limite del disegno:
 *   «ogni due minuti la pagina si aggiorna con i dati importati da Matchpoint. Questo io non
 *    vorrei vederlo sul calendario segnalato.»
 *
 * ⇒ Il semaforo mostra i **gesti**, non il **traffico**. Chi guarda il calendario deve poter
 * credere che una barra accesa significhi *qualcuno sta facendo qualcosa*: se si accendesse
 * anche per il giro automatico dei 2 minuti sarebbe accesa quasi sempre, e una segnalazione
 * accesa quasi sempre non è una segnalazione — è uno sfondo. È il modo in cui si perde un
 * avviso senza mai toglierlo.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 *
 * 🚨⭐⭐ E LE DUE TRAPPOLE MISURATE, che sono la ragione per cui questo file esiste invece di
 * un `MP_INTERACTIVE_OPS.has(op)` scritto dentro l'edge. **Il nome dell'operazione non basta**:
 *
 *   ① `edit` con `read:true` NON è una modifica, è una LETTURA. La lettura autorevole dei
 *      giocatori — quella che parte da sola quando si APRE una scheda — passa da lì
 *      (`readOnly = input.read === true`, `server.mjs`). Il worker lo sa; la coda no, e la
 *      etichetta «modifica». ⇒ Senza questa regola, chi guarda il calendario vedrebbe
 *      *«sta modificando una prenotazione»* mentre qualcuno ha soltanto **aperto una scheda**:
 *      un allarme su un gesto che non tocca niente, e per giunta il gesto più frequente che
 *      esista in segreteria.
 *
 *   ② `client` con `soloRicerca` NON crea niente: è la ricerca per telefono che si fa PRIMA di
 *      creare un socio (`soloRicerca = !!(options.soloRicerca || client.soloRicerca)`), e la
 *      coda la etichetta «nuovo cliente». ⇒ Direbbe che è nato un socio quando nessuno è nato.
 *
 * 📌 *Una regola che guarda solo il nome dell'op è una regola che crede all'etichetta invece
 * che al fatto.* Le due trappole non si vedono leggendo l'elenco delle operazioni: si vedono
 * andando a guardare **cosa fa** ciascuna quando arriva con certi flag.
 *
 * ⚖️ E il precedente che rende obbligatorio il modulo invece dell'elenco a mano: `MP_INTERACTIVE_OPS`
 * è rimasto senza i quattro gesti sui soldi per due settimane, e `HANDLER_CHE_APRONO_UN_BROWSER`
 * senza `handleSetCharge`. Due elenchi scritti a mano, due fotografie del giorno in cui furono
 * scritte. Qui l'elenco c'è lo stesso — non si scappa — ma la **regola sui flag** sta accanto e
 * il banco la esegue: il giorno in cui `edit` prendesse un terzo flag di lettura, la prova che
 * lo esercita è a due righe da qui.
 */

import { MP_INTERACTIVE_OPS } from './coda-priorita.mjs';

/**
 * Le operazioni che, quando arrivano, sono sempre e solo un gesto di una persona.
 *
 * ⚠️ NON è un elenco nuovo: è `MP_INTERACTIVE_OPS`, cioè **la stessa lista** che decide la
 * priorità in coda. Due liste divergerebbero, e divergerebbero in silenzio — un'operazione
 * aggiunta là e non qui sparirebbe dal semaforo senza che niente diventi rosso.
 * 📌 *Il modo di non far divergere due elenchi non è ricopiarli bene: è averne uno.*
 */
export { MP_INTERACTIVE_OPS };

/**
 * `true` se questo job è un gesto che una persona ha appena fatto — da segreteria **o dal bot**.
 *
 * 🔄 Il chatbot è DENTRO, ed è una decisione sua che ha ribaltato sé stessa: prima li aveva
 * esclusi (*«saranno molte più di quattro, diventa un rumore»*), poi *«io che sono di segreteria
 * devo vedere le azioni di chi le fa dal chatbot e le azioni che faccio io da gestionale»*.
 * ⚖️ Il rumore che temeva resta fuori **per costruzione, non per fiducia**: «in corso» dura
 * pochi secondi e si spegne da sé — non è una lista che si accumula.
 *
 * ⛔ Quello che questa funzione NON decide: **come** si scrive la frase, e **se** mostrarla.
 * Qui si risponde a una sola domanda — *c'è una persona dietro?* — e il vocabolario verso
 * l'operatore lo mette il gestionale, mai il worker.
 *
 * @param {{op?: string} & Record<string, unknown>} meta  la meta del job in coda
 * @param {Record<string, unknown>} [body]  il payload della richiesta, da cui si leggono i flag
 */
export function eGestoDiUnaPersona(meta, body = {}) {
  const op = meta && meta.op;
  if (!MP_INTERACTIVE_OPS.has(op)) return false;
  if (op === 'edit' && eSolaLettura(body)) return false;       // ① aprire una scheda
  if (op === 'client' && eSolaRicerca(body)) return false;      // ② cercare un telefono
  return true;
}

/**
 * La `edit` che non modifica niente: `read:true`, cioè la lettura autorevole del roster.
 *
 * 🚨 Si legge sul payload e **non** sul nome dell'operazione, che qui mente. La forma è quella
 * che `server.mjs` usa davvero (`input.read === true`), non una più permissiva: se un domani
 * arrivasse `read:'1'` questa regola direbbe «è una modifica» — cioè sbaglierebbe **verso
 * l'allarme**, che è il verso giusto in cui sbagliare. Un falso «sta succedendo qualcosa» si
 * guarda e si scopre; un falso silenzio no.
 */
export function eSolaLettura(body = {}) {
  const b = body || {};
  // 🩹 `!!` non è ornamentale: senza, `b.booking && …` torna **`undefined`** quando `booking`
  //    non c'è — e `undefined` è falsy, quindi tutto sembrava funzionare. Una funzione che
  //    promette un booleano e ogni tanto ne restituisce uno diverso è una bugia che nessuno
  //    incontra finché qualcuno non la confronta con `false`. Il banco l'ha presa così.
  return b.read === true || !!(b.booking && b.booking.read === true);
}

/**
 * La `client` che non crea niente: la ricerca per telefono prima di creare un socio.
 *
 * ⚠️ Il flag arriva in DUE posti — `options.soloRicerca` e `client.soloRicerca` — e li guarda
 * tutt'e due proprio come fa il worker. Guardarne uno solo lascerebbe passare metà dei casi,
 * ed è un errore che nessuna rilettura trova: le due strade si somigliano troppo.
 */
export function eSolaRicerca(body = {}) {
  const b = body || {};
  const opts = b.options || {};
  const cli = b.client || {};
  return !!(opts.soloRicerca || cli.soloRicerca || b.soloRicerca);
}
