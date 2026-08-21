// impaginazione.ts — leggere TUTTE le righe da un client che ne restituisce mille per volta.
//
// 🚨⭐⭐ NASCE DA UN DIFETTO MISURATO SU PROD IL 21/08/2026, e la forma serve a renderlo
// impossibile una seconda volta. `consumer-staff-events` leggeva l'anagrafica con
// `.limit(5000)` — più delle schede che esistono — e ne riceveva **1000**: il client tronca a
// mille comunque lo si chieda. Il ponte vedeva le prime 1000 schede su 2810.
//
// 📏 Come si è visto, e non si sarebbe visto altrimenti: due collaudi con due persone diverse.
// «Maurizio Aprea» sta in posizione 628 dell'elenco ⇒ avviso consegnato. «Lidia Comes» in
// posizione 2721 ⇒ nessun destinatario trovato, riga chiusa come consegnata, messaggio mai
// partito. **1810 soci su 2810 non potevano ricevere niente**, in silenzio.
//
// ⚖️ LA TRAPPOLA, che è la parte da ricordare: chiedere 5000 *sembrava* prudente proprio
// perché era più del vero. *Un limite che si dichiara non è un limite che si ottiene* — e un
// tetto chiesto più alto di quello imposto non protegge, nasconde.
//
// 🔎 E il difetto era invisibile a ogni prova immaginabile su dati finti: con venti schede di
// collaudo la lettura sola funziona benissimo. Si vede solo con un'anagrafica vera, o
// scrivendo la prova che sta qui accanto — che è il motivo per cui questo pezzo è un modulo
// a sé e non tre righe dentro `index.ts`.

/** Il risultato di UNA pagina: le righe, oppure il motivo per cui non si è potuto leggerle. */
export type Pagina<T> = { righe: T[]; errore: string | null };

/** Come è finita la lettura completa. */
export type Lettura<T> = {
  righe: T[];
  /** Il primo errore incontrato: se c'è, `righe` è incompleto e NON va usato. */
  errore: string | null;
  /** Vero se si è smesso di leggere per il freno d'emergenza, non perché i dati erano finiti. */
  troncato: boolean;
};

/**
 * Legge pagina dopo pagina finché non finiscono.
 *
 * ⭐ Si esce quando una pagina è **più corta** del massimo: è l'ultima. Un `count` separato
 * costerebbe una lettura in più e potrebbe cambiare fra le due.
 *
 * 🚨 Il `tetto` è un freno d'emergenza, non una scelta di prodotto: protegge dal giro infinito
 * se il client smettesse di accorciare l'ultima pagina. Quando morde lo si DICHIARA
 * (`troncato: true`), perché una troncatura silenziosa si legge come «non c'era altro» — che è
 * lo stesso inganno del difetto da cui questo file nasce.
 *
 * 🚨 Un errore FERMA la lettura e si porta dietro le righe raccolte fin lì: chi chiama deve
 * guardare `errore` PRIMA di `righe`. Continuare dopo un errore darebbe un elenco incompleto
 * che non si distingue da uno completo.
 */
export async function leggiImpaginato<T>(
  leggiPagina: (from: number, to: number) => Promise<Pagina<T>>,
  opts: { pagina: number; tetto: number },
): Promise<Lettura<T>> {
  const { pagina, tetto } = opts;
  if (pagina <= 0) return { righe: [], errore: 'PAGINA_NON_VALIDA', troncato: false };

  const righe: T[] = [];
  for (let from = 0; ; from += pagina) {
    const p = await leggiPagina(from, from + pagina - 1);
    if (p.errore) return { righe, errore: p.errore, troncato: false };
    righe.push(...p.righe);
    if (p.righe.length < pagina) return { righe, errore: null, troncato: false };
    if (righe.length >= tetto) return { righe, errore: null, troncato: true };
  }
}
