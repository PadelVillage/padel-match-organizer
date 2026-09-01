// 🕰️ REGISTRARE PRIMA DI PARLARE — voce 121, 01/09/2026.
//
// 🗣️ Regola del committente, data la notte del 01/09: *«Quando togli un giocatore dal bot devi
// aspettare la conferma del gestionale che questo è avvenuto prima di mostrarlo sul bot.»*
//
// 📏 IL DIFETTO, misurato nel ramo `remove` di `index.ts`: il `removed: true` usciva **appena
// Matchpoint aveva risposto ok**, e l'allineamento della copia in app veniva DOPO, dichiarato
// best effort — *«qui la rimozione È GIÀ RIUSCITA, quindi si torna `removed: true` anche se
// questo passo fallisce»*. ⇒ Se quella scrittura falliva, il socio leggeva **«tolto»** e il
// gestionale **non lo sapeva**. È la voce 75 su un altro gesto.
//
// ⚖️ E LA RIGA DI DIFESA CHE C'ERA NEL CODICE ERA VERA, quindi la cura non è rovesciare il
// `true` in `false`: *«dire "non l'ho tolto" a chi l'ha tolto lo manderebbe a rifarlo»*. La
// rimozione su Matchpoint **è** avvenuta; a mancare è la nostra registrazione. Dire «non è
// passata» sarebbe la bugia opposta, e più cara.
//
// 🔨 LA CURA, scelta dal committente fra tre: *il gestionale ritenta finché non registra, e il
// bot parla solo quando ce l'ha fatta.* Esaurito il ritentativo la risposta onesta è
// **`esito_ignoto`** — «non lo so ancora» — mai un «non è passata».
//
// ⛔ COSA QUESTO MODULO NON DECIDE, e sta di proposito fuori: se lasciare la ricevuta. Quella
// scelta vive in `index.ts` perché dipende da CHI resta scoperto — e la risposta è che sulla
// registrazione fallita la ricevuta **non** si scrive, così l'avviso del circolo (che nascerà
// dal sync) raggiunge comunque la persona tolta invece di lasciarla senza campo e senza
// notizia. È la stessa regola di `ricevuta-ignoto.test.ts`, applicata al caso nuovo.

/** L'esito di UNA riga scritta: si guarda solo se c'è un errore. */
export type EsitoRiga = { error?: { message?: string } | null };

/** Scrive tutte le righe da allineare e torna un esito per ciascuna. */
export type ScriviRighe = () => Promise<EsitoRiga[]>;

export type EsitoRegistrazione = {
  /** `true` solo se TUTTE le righe sono passate. Il parziale non è un successo. */
  registrata: boolean;
  /** Quanti giri sono serviti (1 = è andata al primo colpo). */
  tentativi: number;
  scritte: number;
  totali: number;
  errore?: string;
};

// ⏱️ Le attese fra un tentativo e l'altro. Tre ritentativi, ~2,2 s in tutto: abbastanza per
// attraversare un intoppo passeggero del database, poco abbastanza da non tenere il socio
// fermo davanti a un messaggio che non arriva. Il numero di giri lo dice la lunghezza di
// questa lista, così non ci sono due costanti che possono divergere.
export const ATTESE_MS = [200, 600, 1400];

const dormi = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Scrive la copia in app RITENTANDO, e dice se ce l'ha fatta.
 *
 * 🚨 «Registrata» vuol dire **tutte** le righe, non la maggioranza: una copia scritta a metà
 * è discorde, e una copia discorde è esattamente la cosa che il sync poi risolve mettendo in
 * campo qualcuno che ne era uscito. Il parziale si racconta (`scritte`), non si promuove.
 */
export async function registraConRitenta(
  totali: number,
  scrivi: ScriviRighe,
  opzioni: { attese?: number[]; aspetta?: (ms: number) => Promise<void> } = {},
): Promise<EsitoRegistrazione> {
  const attese = opzioni.attese ?? ATTESE_MS;
  const aspetta = opzioni.aspetta ?? dormi;

  // Niente da scrivere = già a posto. ⚠️ NON è un caso da ritentare: ritentare il vuoto
  // girerebbe a vuoto per due secondi e finirebbe per dichiarare «non registrata» una
  // registrazione che non serviva.
  if (totali <= 0) return { registrata: true, tentativi: 0, scritte: 0, totali: 0 };

  let ultimoErrore = '';
  let ultimeScritte = 0;

  for (let giro = 0; giro <= attese.length; giro++) {
    if (giro > 0) await aspetta(attese[giro - 1]);
    try {
      const esiti = await scrivi();
      const rotte = esiti.filter((e) => e && e.error);
      ultimeScritte = esiti.length - rotte.length;
      if (!rotte.length && esiti.length >= totali) {
        return { registrata: true, tentativi: giro + 1, scritte: ultimeScritte, totali };
      }
      ultimoErrore = String(rotte[0]?.error?.message ?? 'UPDATE fallito').slice(0, 200);
    } catch (e) {
      // Un'eccezione è un tentativo fallito come un altro: si ritenta, non si esce. Uscire
      // qui renderebbe il ritentativo inutile proprio nel caso in cui serve (rete che cade).
      ultimoErrore = String((e as Error)?.message ?? 'errore').slice(0, 200);
      ultimeScritte = 0;
    }
  }

  return {
    registrata: false,
    tentativi: attese.length + 1,
    scritte: ultimeScritte,
    totali,
    errore: ultimoErrore,
  };
}
