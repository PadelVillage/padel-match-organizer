// La SCHEDA DEL CIRCOLO di una partita nata in prova. Regola pura, senza database.
//
// 🚨⭐⭐ IL FATTO CHE LA RENDE NECESSARIA, trovato provando l'11/08/2026 e non dedotto: fuori
// dalla produzione il recinto registra la partita qui e **non chiama il circolo**
// (`scrittura-al-circolo.ts`). Quella riga è uno `staff_booking`, cioè la COPIA IN APP — e la
// copia in app la `descrizione` non ce l'ha mai, per costruzione: la `descrizione` è la scheda
// che scrive **Matchpoint**, e su TEST da Matchpoint non torna niente.
// ⇒ Ma `organizzatoreDelloSlot` (`consumer-booking-write/roster-slot.ts`) legge **SOLO** la
//   `descrizione`. Quindi una partita nata in prova non ha un organizzatore, e il ponte risponde
//   `organizzatore_ignoto` a chiunque provi a gestirla: né aggiungere né togliere.
// 📏 Misurato: per montare la prova dell'avviso al tolto (`A6`) la `descrizione` è stata scritta
//   **a mano** dentro la riga. Senza quel gesto la prova non partiva. Questo modulo lo toglie.
//
// ⛔🚨⭐⭐ E VALE SOLO IN PROVA — questa è la parte da non «uniformare per simmetria».
// In produzione uno `staff_booking` NON deve portare una `descrizione`, e non è un vezzo:
// `rosterOrdinatoDelloSlot` confronta le copie dello stesso slot e, se il primo nome non
// concorda, torna **vuoto** ⇒ `organizzatore_ignoto`. Una scheda fabbricata da noi accanto a
// quella vera del circolo è una **seconda voce** che può contraddire la prima: il giorno in cui
// il roster cambia da fuori l'app, le due divergono e l'organizzatore sparisce — cioè romperemmo
// sul circolo VERO esattamente la cosa che qui stiamo riparando.
// ⇒ Chi chiama questa funzione deve averlo già deciso guardando l'esito (`esitoVieneDaUnaProva`).
//   Il modulo è puro apposta: non sa in che ambiente gira e non deve saperlo.
//
// ⭐ Perché un modulo a sé e non tre righe dentro l'edge: è la stessa ragione di
// `bersaglio-prova.ts` e di `roster-slot.ts` — una regola che si può sbagliare va messa dove la
// si può misurare **da sola**, e qui il modo di sbagliare è silenzioso (una scheda che si rilegge
// storta nomina la persona sbagliata, e nessuno se ne accorge).

/** Un giocatore come arriva nella richiesta: dell'elenco ci interessa solo il nome. */
export type GiocatoreDellaRichiesta = { nome?: unknown };

function pulisci(v: unknown): string {
  return String(v ?? '').trim();
}

/**
 * La `descrizione` da mettere nella riga, o `null` se non la si può scrivere fedelmente.
 *
 * 📐 **La forma è quella di Matchpoint**, non una nostra invenzione: `-Nome Cognome.` per ogni
 * giocatore, attaccati (`-Uno Rossi.-Due Bianchi.`). È esattamente ciò che
 * `playersFromDescrizione` sa rileggere — e l'ordine è quello del roster, perché
 * **il primo è l'organizzatore** (regola del committente del 29/07: «l'organizzatore è la prima
 * persona in alto che appare in una scheda»).
 *
 * 🚨⭐⭐ FAIL CLOSED SULLA RILETTURA, ed è il cuore di questa funzione. Il separatore è il punto:
 * un nome che contenga un `.` (o che cominci per `-`) si rileggerebbe **spezzato o mutilato**, e
 * il risultato non sarebbe un errore visibile — sarebbe una scheda che nomina come organizzatore
 * una persona che non lo è. Perciò non si vieta un elenco di caratteri (che invecchia): si
 * **rilegge quello che si è appena scritto** con la stessa regola di chi lo leggerà davvero, e se
 * non torna identico **non si scrive niente**.
 * ⚖️ Il ripiego è `organizzatore_ignoto`, che è un esito **già previsto e gestito** (porta alla
 * segreteria, mai a un vicolo cieco). Meglio quello di un nome sbagliato: è lo stesso verso del
 * dubbio del recinto — un errore può **fermare** una prova, non può **attribuirla** a un altro.
 */
export function schedaDiProva(giocatori: unknown): string | null {
  if (!Array.isArray(giocatori)) return null;
  const nomi = giocatori
    .map((g) => pulisci((g as GiocatoreDellaRichiesta | null)?.nome ?? g))
    .filter(Boolean);
  if (!nomi.length) return null;

  const scheda = nomi.map((n) => `-${n}.`).join('');
  const riletti = rileggiScheda(scheda);
  if (riletti.length !== nomi.length) return null;
  if (riletti.some((n, i) => n !== nomi[i])) return null;
  return scheda;
}

/**
 * Come si rilegge una scheda del circolo.
 *
 * 🚨 È una COPIA di `playersFromDescrizione` (`consumer-booking-write/roster-slot.ts`), e la
 * copia è voluta: il deploy sceglie le funzioni dalle cartelle toccate e **salta `_shared/`**,
 * quindi un modulo condiviso non si deployerebbe — stessa ragione delle otto copie del recinto.
 * ⭐ A tenerle uguali non è la buona volontà: il banco importa **quella vera** e verifica che la
 * scheda scritta qui si rilegga giusta di là. Se divergono, il rosso è là.
 */
function rileggiScheda(descr: string): string[] {
  const text = String(descr || '').trim();
  if (!text.startsWith('-')) return [];
  return text
    .split('.')
    .map((s) => s.replace(/^-+/, '').trim())
    .filter(Boolean);
}
