// 🚨⭐⭐ LA DIAGNOSTICA DI UN FALLIMENTO DEVE AVERE UNA CASA ANCHE SULLA STRADA SINCRONA.
// Voce 66, 23/08/2026 — e questo modulo nasce da una misura, non da un'idea di ordine.
//
// 📏 IL REPERTO. `matchpoint-bookings-{create,edit,cancel}` hanno due strade: quella
// **asincrona** (`async: true`, la usa l'app della segreteria), che quando il worker fallisce
// deposita l'errore INTERO — diagnostica compresa — nella riga `booking_job`; e quella
// **sincrona**, che è quella da cui passa il BOT DEI SOCI, dove il fallimento esce come
// `err(502, …)` e **non lascia riga da nessuna parte**.
// ⇒ La diagnostica aggiunta apposta dalla #944 per capire `PLAYER_ID_NOT_LOCKED` aveva una casa
//   su metà dei casi, e la metà scoperta era proprio quella da cui il socio prenota.
//
// 💸 QUANTO È COSTATO, ed è la ragione per cui questa riga esiste. Il fallimento del 22/08
// 22:14:52Z è arrivato con la traccia troncata, e per leggerla è servito andarla a pescare nel
// registro del worker sulla VM. Si è potuto perché era vecchia di 13 ore: quel registro è una
// **finestra che scorre**, e un caso più vecchio non si recupera più. Nel database, invece, un
// fallimento resta.
//
// ⛔ QUELLO CHE QUESTA CURA NON FA, ed è deliberato: **non allarga di un carattere ciò che arriva
// al bot**. I due tagli che si vedono — `slice(0, 300)` nel registro di `consumer-booking-write`
// e `slice(0, 200)` di `dettaglioPerIlBot` — sono corti APPOSTA, perché quello è un messaggio
// per il socio, e per la regola ferma di `CLAUDE.md` i nomi interni (worker, Matchpoint, browser)
// al bot non devono arrivare affatto. ⇒ Il fatto si scrive **nel gestionale**, che è chi deve
// saperlo. È *il gestionale SA, il bot DICE* applicato alla diagnostica.
//
// ⚖️ È BEST-EFFORT, e non può essere altro: si chiama dentro il ramo di errore di una risposta
// già decisa. Se questa scrittura fallisce, il chiamante deve rispondere lo stesso — un'eccezione
// qui trasformerebbe un rifiuto raccontato bene in un 500 muto, cioè romperebbe esattamente la
// cosa che sta cercando di raccontare. Per questo non lancia mai e torna un booleano.
//
// 📌 Scrive con `fetch` su PostgREST invece che con supabase-js, come fa il vicino
// `aiUsage.ts`: così il modulo non ha bisogno dell'import map di chi lo importa, e le tre
// funzioni che lo usano non devono cambiare le proprie dipendenze per una riga di registro.

/** Le tre scritture verso il circolo che hanno una strada sincrona. */
export type AzioneAlCircolo = 'create' | 'edit' | 'cancel';

/**
 * Deposita nel gestionale la traccia INTERA di una scrittura al circolo fallita sulla strada
 * sincrona. La riga ha la stessa forma di quelle della strada asincrona (`record_type`
 * `booking_job`, `payload.status` + `payload.error`), così un domani una sola query trova
 * entrambe le strade — che è ciò che ha reso possibile la misura del 23/08.
 *
 * ⭐ `strada: 'sincrona'` è il campo che le distingue. Le righe asincrone non ce l'hanno:
 * l'assenza vale «asincrona», e non si va a riscrivere lo storico per simmetria.
 *
 * @returns `true` se la riga è stata scritta. Non lancia MAI.
 */
export async function annotaFallimentoAlCircolo(opts: {
  azione: AzioneAlCircolo;
  /** `'error'` (rifiuto noto) oppure `'unknown'` (il terzo esito: non è arrivata risposta). */
  status: 'error' | 'unknown';
  /** Il testo intero dell'errore del worker, diagnostica e `steps=[…]` compresi. */
  errore: string;
  /** La richiesta com'era: `booking`, `edit` o `cancel`. */
  richiesta: unknown;
  /** Email di chi ha chiesto la scrittura. */
  attore: string;
}): Promise<boolean> {
  try {
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!url || !svc) return false;
    const adesso = new Date().toISOString();
    const risposta = await fetch(`${url}/rest/v1/pmo_cloud_records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: svc,
        Authorization: `Bearer ${svc}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        record_type: 'booking_job',
        local_key: crypto.randomUUID(),
        payload: {
          status: opts.status,
          azione: opts.azione,
          strada: 'sincrona',
          error: opts.errore,
          richiesta: opts.richiesta,
          created_by_email: opts.attore,
          created_at: adesso,
          updated_at: adesso,
        },
        deleted: false,
        updated_at: adesso,
        synced_at: adesso,
      }),
    });
    if (!risposta.ok) {
      // ⚠️ Si dice, e non si tace: un registro che non riesce a registrare e non lo dichiara è
      // peggio di un registro assente, perché la prossima misura leggerà la sua assenza come
      // «non è successo niente».
      console.error(JSON.stringify({
        event: 'traccia_fallimento_non_scritta',
        azione: opts.azione,
        http: risposta.status,
        detail: (await risposta.text().catch(() => '')).slice(0, 300),
      }));
      return false;
    }
    return true;
  } catch (e) {
    console.error(JSON.stringify({
      event: 'traccia_fallimento_non_scritta',
      azione: opts.azione,
      error: e instanceof Error ? e.message : String(e),
    }));
    return false;
  }
}
