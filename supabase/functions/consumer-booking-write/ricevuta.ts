// ricevuta.ts — cosa il gestionale ha scritto su richiesta di un socio, detto per iscritto (voce 70).
//
// 🗣️ Nasce da un difetto misurato al secondo la notte del 21/08/2026: Lidia accetta un invito
// dal bot, il bot le dice «✅ Sei in campo», e fra i 4 e i 19 minuti dopo il **circolo** le
// annuncia che è stata aggiunta alla partita. Il gesto era suo.
//
// ⭐⭐ PERCHÉ IL RIMEDIO PARTE DA QUI. Chi produce quegli avvisi (`eventi-staff.ts`) confronta
// due fotografie del calendario: vede *cosa* è cambiato e non può sapere **chi** l'ha cambiato.
// L'informazione che gli manca **questa funzione ce l'ha**, perché la scrittura l'ha eseguita
// lei. ⇒ Non la si indovina a valle: la si lascia detta. *Il gestionale SA, il bot DICE* — e
// per sapere, il gestionale deve prima ricordarsi di ciò che ha fatto.
//
// ⚖️ QUESTO MODULO NON DECIDE NIENTE, ed è voluto: compone le righe e basta. La regola di
// scarto vive dall'altra parte, in `consumer-staff-events/ricevute.ts`, insieme alla finestra
// e al consumo. Le due metà si provano separate, e nessuna delle due può cambiare l'altra di
// nascosto.

// 🚨⭐⭐ E LA RICEVUTA DELL'ESITO IGNOTO — voce 83, 31/08/2026. Regola stretta, e il perché
// vale più della regola.
//
// 📏 IL DIFETTO, misurato la notte del 23/08. L'annullo del socio è passato su Matchpoint, il
// gestionale l'ha classificato fallito, quindi **nessuna ricevuta è stata scritta**. Alle 23:47
// il sync ha trovato la partita sparita e l'ha attribuita al circolo: al socio è arrivato
// *«👋 La tua partita non c'è più — È stata annullata dal circolo»*, dieci minuti dopo che
// l'aveva annullata lui dal bot. ⇒ *Una ricevuta non scritta non protegge niente.*
//
// ⛔ E LA CURA OVVIA — «scrivi la ricevuta anche sull'ignoto, per tutti» — È SBAGLIATA, e va
// detto perché è quella che viene in mente. Su una scrittura RIUSCITA il bot avvisa lui le
// persone toccate (`compagni`, `testoPartitaAnnullata`, `testoSeiStatoTolto`), e la ricevuta
// serve a non dire la stessa cosa due volte. Sull'IGNOTO il bot **non avvisa nessuno**, perché
// non sa. ⇒ Una ricevuta per tutti produrrebbe un **silenzio**: né il bot né il circolo, e tre
// persone che scoprono da sole di non avere più il campo. È la regola del 23/08 rovesciata —
// *tutti quelli in campo devono essere avvisati*.
//
// ⇒ SULL'IGNOTO LA RICEVUTA COPRE **SOLO CHI HA CHIESTO**, mai un terzo. Gesto per gesto:
//
//   create  → chi chiede è chi entra          ⇒ ricevuta per lui
//   leave   → chi chiede è chi esce           ⇒ ricevuta per lui
//   cancel  → chi chiede è l'organizzatore    ⇒ ricevuta SOLO per lui; i compagni la notizia
//             devono averla, e l'unico che può dargliela è il circolo
//   remove  → chi chiede NON è chi viene tolto  ⇒ nessuna ricevuta
//   add     → chi chiede NON è chi entra        ⇒ nessuna ricevuta
//
// ⚖️ IL COSTO, dichiarato invece che taciuto: se la scrittura NON era passata e la segreteria
// rifà lo stesso gesto sulla stessa persona entro la finestra, quel socio perde **un** avviso
// — uno solo, perché la ricevuta si consuma, e solo lui. Contro un avviso falso nell'attribuzione
// mandato a chi il gesto l'ha fatto, è il verso giusto in cui sbagliare.
//
// 📌 *Una protezione che nasce da «il bot l'ha già detto» non si estende al caso in cui il bot
//    non ha detto niente: lì copre un silenzio invece di un doppione.*

/** Un gesto che la scrittura ha prodotto su UNA persona. */
export type GestoScritto = {
  /** Il nome come finisce SULLA SCHEDA DEL CIRCOLO: è quello che il sync rileggerà. */
  persona: string;
  gesto: 'aggiunto' | 'tolto' | 'annullata';
};

/** Una riga pronta per `pmo_ricevute_gesti`. */
export type RigaRicevuta = {
  slot: string;
  data: string;
  ora: string;
  campo: string;
  persona: string;
  gesto: GestoScritto['gesto'];
  richiesta_da: string;
  azione: string;
};

/**
 * Il nome che NON è una persona: un posto occupato da qualcuno che il circolo non ha in
 * anagrafica. ⚠️ Gemello di `NON_E_UNA_PERSONA` in `eventi-staff.ts`, e le due devono dire la
 * stessa cosa: là gli «Ospite» non producono mai un fatto, quindi qui una loro ricevuta
 * coprirebbe qualcosa che non esiste. Non è un guasto — è una riga inutile in una tabella che
 * dice chi gioca con chi, e quelle non si scrivono per abitudine.
 */
const NON_E_UNA_PERSONA = 'ospite';

/**
 * Forma normalizzata di un nome, per confrontare e mai per mostrare.
 * ⚠️ I segni diacritici si scrivono come sequenze di escape e non come caratteri letterali:
 * un carattere invisibile nel sorgente si paga in revisione, ed è la lezione del byte NUL
 * pagata il 21/08 in `consumer-staff-events/riduzione.ts`.
 */
function nomeConfrontabile(value: unknown): string {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * La chiave della partita: `data|ora|campo-in-cifre`.
 * ⚠️ Gemella di `chiaveSlot` (`eventi-staff.ts`) e della convenzione del readmodel. Qui serve
 * solo a rendere leggibile la riga: l'accoppiamento vero si fa sui tre campi separati,
 * normalizzati al momento del confronto — il perché sta in `consumer-staff-events/ricevute.ts`.
 */
export function chiaveSlot(data: unknown, ora: unknown, campo: unknown): string {
  const d = String(data ?? '').trim();
  const o = String(ora ?? '').trim();
  const c = String(campo ?? '').replace(/\D/g, '');
  return `${d}|${o}|${c}`;
}

/**
 * Le righe da scrivere per una scrittura andata a buon fine.
 *
 * ⭐ Si scartano i nomi vuoti e gli «Ospite» (dietro non c'è nessuno da avvisare, quindi non
 * c'è niente da coprire) e si tolgono i doppioni: la stessa partita arriva su più righe
 * sincronizzate, e un roster ricomposto può ripetere lo stesso nome.
 */
export function righeRicevuta(input: {
  azione: string;
  richiestaDa: string;
  data: string;
  ora: string;
  campo: unknown;
  gesti: GestoScritto[];
}): RigaRicevuta[] {
  const slot = chiaveSlot(input.data, input.ora, input.campo);
  const campo = String(input.campo ?? '').trim();
  const viste = new Set<string>();
  const righe: RigaRicevuta[] = [];

  for (const g of input.gesti ?? []) {
    const nome = String(g?.persona ?? '').trim();
    const n = nomeConfrontabile(nome);
    if (!n || n === NON_E_UNA_PERSONA) continue;
    const k = `${n} ${g.gesto}`;
    if (viste.has(k)) continue;
    viste.add(k);
    righe.push({
      slot,
      data: String(input.data ?? '').trim(),
      ora: String(input.ora ?? '').trim(),
      campo,
      persona: nome,
      gesto: g.gesto,
      richiesta_da: String(input.richiestaDa ?? '').trim(),
      azione: String(input.azione ?? '').trim(),
    });
  }
  return righe;
}
