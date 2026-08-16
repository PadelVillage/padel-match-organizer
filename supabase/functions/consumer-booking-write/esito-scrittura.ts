// Com'è andata davvero una scrittura di cui non si è saputo l'esito — la regola in UN posto solo.
//
// Nasce dalla voce 53 e dalla regola d'architettura del committente (16/08/2026):
// **il gestionale SA, il bot DICE**. Il bot non deve dedurre niente da quello che vede: chiede
// qui, e qui esce un `si` / `no` / `non_ancora` già pronto da tradurre in italiano.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🚨⭐⭐ PERCHÉ NON BASTA GUARDARE SE LA PRENOTAZIONE C'È
//
// La copia del gestionale è alimentata dal sync, e **il sync passa dal worker**
// (`matchpoint-bookings-sync` → `/export-booking-history`). ⇒ Quando il worker è giù la copia
// si CONGELA — e il worker giù è esattamente la condizione che ha prodotto l'esito ignoto.
// Misurato il 16/08 (📄 `docs/voce-53-ritardo-sync.md`): la notte del 15/08 il sync registrava
// `MATCHPOINT_BROWSER_WORKER_FAILED` alle 22:28:02, un minuto dopo la scrittura rimasta ignota
// delle 22:27:16. I due guasti arrivano INSIEME, non a caso: hanno la stessa causa.
//
// ⇒ **L'assenza dalla copia non è una prova di assenza dal circolo.** Un «no» detto guardando
// solo la copia è falso proprio nel caso per cui questa funzione è stata scritta. Il «no» si
// può dire **solo** se un giro di sync è atterrato DOPO la scrittura: allora, e solo allora,
// «non c'è» vuol dire «non c'è».
//
// ⭐ Il segnale della freschezza esiste già: `synced_at` sulle righe `booking`, che il sync
// riscrive a ogni giro ATTERRATO. ⚠️ Non vanno usati per questo:
//   · `matchpoint_bookings_full_tick_last` → segue solo i giri PIENI (uno ogni 15 minuti), ed è
//     la trappola della 24ª in persona: `lastFullSuccessAt` «appartiene a un'altra strada»;
//   · `matchpoint_bookings_auto_diagnostic_last` → lo scrivono sia gli errori sia le
//     diagnostiche di validazione, quindi non è un «ultimo successo».
// ✅ E `synced_at` regge la prova che conta: un giro FALLITO **non** lo sposta, perché le righe
// si scrivono solo a esportazione riuscita. Verificato sui dati veri il 16/08 — il fallimento
// delle 22:28:02 non compare fra i valori di `synced_at` di quella sera.
// ══════════════════════════════════════════════════════════════════════════════════════════

/**
 * La finestra che l'export copre a OGNI giro: `oggi … oggi+30`.
 * 🚨 Copiata da `DEFAULT_FUTURE_DAYS` di `matchpoint-bookings-sync/index.ts` (le cartelle
 * `_shared/` non si deployano, stessa ragione di `playersFromDescrizione`): se cambia là,
 * cambia qui. Oltre questa soglia la copia **non saprà mai** della prenotazione — misurato:
 * `idReserva 9434`, creata per 121 giorni avanti, non è mai comparsa.
 */
export const FINESTRA_SYNC_GIORNI = 30;

/**
 * Quanto si concede alla scrittura per atterrare DOPO che il bot ha perso il contatto.
 *
 * ⚖️ Il numero non è a sentimento e non è la durata tipica: quando l'esito è ignoto il worker
 * si è **piantato**, quindi la durata dei giri riusciti (massimo misurato: **31 s**) non lo
 * limita. Si prende allora il tetto STRUTTURALE — i **150 s** oltre i quali l'edge viene
 * uccisa comunque, citati nel commento del decoupling di `matchpoint-bookings-sync`. Oltre
 * quel punto non c'è più nessuno che possa scrivere.
 * ⭐ Sbagliare in eccesso qui costa solo un «non ancora» in più; sbagliare in difetto produce
 * un «no» falso, che è il danno che tutta questa funzione esiste per evitare.
 */
export const MARGINE_SCRITTURA_S = 150;

export type Verdetto = {
  /** `si` = c'è, `no` = non c'è (e lo sappiamo davvero), `non_ancora` = non lo sappiamo. */
  esito: 'si' | 'no' | 'non_ancora';
  /** Perché, in una parola sola: è quello che il bot traduce, e serve identico nei log. */
  motivo: string;
  /**
   * Ha senso richiedere fra un po'? ⭐ È separato dall'esito di proposito: ci sono due
   * `non_ancora` diversissimi — «aspetta e saprai» e «qui non si saprà mai», e dirli con la
   * stessa parola manderebbe il bot ad aspettare a vuoto un dato che non arriverà.
   */
  attendere: boolean;
};

/** ISO → millisecondi, oppure null se non è una data (mai un NaN che gira per il codice). */
function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const v = Date.parse(String(iso));
  return Number.isFinite(v) ? v : null;
}

/** `YYYY-MM-DD` + n giorni, senza fusi: si confrontano stringhe di date, non istanti. */
export function giornoPiu(giorno: string, n: number): string {
  const d = new Date(`${giorno}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Il verdetto su una scrittura di cui non si è saputo l'esito.
 *
 * 🚨 L'ORDINE DEI CONTROLLI È LA FUNZIONE. Il `si` viene per primo perché una presenza è una
 * presenza comunque: se la riga c'è, che la copia sia fresca o stantia non cambia niente —
 * nessun sync inventa una prenotazione. Tutti gli altri rami servono solo a distinguere il
 * «no» vero dal «non lo so», che è l'unica cosa difficile qui dentro.
 */
export function verdettoScrittura(o: {
  /** Il socio risulta dentro quello slot nella copia del gestionale? */
  presente: boolean;
  /** Istante in cui la scrittura è partita (ISO). Senza, un «no» non si può dire. */
  scrittaAlle: string | null;
  /** `max(synced_at)` delle righe prenotazione: l'ultimo giro di sync ATTERRATO (ISO). */
  copiaFrescaAl: string | null;
  /** Giorno dello slot, `YYYY-MM-DD`. */
  giornoSlot: string;
  /** Oggi a Roma, `YYYY-MM-DD`. */
  oggi: string;
}): Verdetto {
  if (o.presente) return { esito: 'si', motivo: 'trovata', attendere: false };

  // Fuori dalla finestra dell'export: la copia non ne saprà mai niente, e aspettare è tempo
  // regalato. ⚖️ Sta DOPO il `si` apposta — una prenotazione oltre i 30 giorni può essere
  // visibile lo stesso come `staff_booking`, che è scritto di qua e non dipende dal sync.
  if (o.giornoSlot > giornoPiu(o.oggi, FINESTRA_SYNC_GIORNI)) {
    return { esito: 'non_ancora', motivo: 'fuori_finestra', attendere: false };
  }

  const tScrittura = ms(o.scrittaAlle);
  // Senza l'istante della scrittura non c'è niente con cui confrontare la freschezza. Non è un
  // guasto — è che il chiamante non ce l'ha detto — e la risposta onesta resta «non lo so».
  if (tScrittura === null) return { esito: 'non_ancora', motivo: 'istante_ignoto', attendere: true };

  const tCopia = ms(o.copiaFrescaAl);
  // Nessuna riga prenotazione con `synced_at`: il sync non è mai atterrato, o non c'è nulla da
  // sincronizzare. In entrambi i casi la copia non testimonia niente.
  if (tCopia === null) return { esito: 'non_ancora', motivo: 'copia_muta', attendere: true };

  if (tCopia >= tScrittura + MARGINE_SCRITTURA_S * 1000) {
    return { esito: 'no', motivo: 'copia_aggiornata_dopo', attendere: false };
  }
  return { esito: 'non_ancora', motivo: 'copia_ferma', attendere: true };
}
