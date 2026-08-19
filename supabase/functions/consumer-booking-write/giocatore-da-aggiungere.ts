// Il giocatore da aggiungere a una partita, nella forma che il worker si aspetta — in UN posto solo.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🚨⭐⭐ PERCHÉ ESISTE: DUE NUMERAZIONI DIVERSE, E IL BOT LE SCAMBIAVA (19/08/2026)
//
// Matchpoint conta le persone in due modi, e non sono lo stesso numero:
//   · il **codice cliente** — quello della tendina, «001013-Lidia Comes» — che nel gestionale
//     sta in `memberId`;
//   · l'**id interno** (`HiddenFieldIdPeople`), che nel gestionale sta in `matchpointIdInterno`.
//
// 📏 Misurato sul log del worker, non dedotto: la stessa persona porta i due numeri insieme —
//     player_option_label: 001013-Lidia Ciao Comes   →   player_id_check: id=1034
//     player_option_label: 000005-Pierangela Barbera →   player_id_check: id=10
//     player_option_label: 000213-Milena Rigolo      →   player_id_check: id=223
//
// 🚨 `consumer-booking-write` mandava il **codice cliente** dentro il campo `codice`, che il
// worker confronta con l'**id interno**. Per Lidia: 1013 contro 1034 ⇒ rifiuto, con la riga
// «Nessun socio Matchpoint con codice 001013 tra i risultati per "Lidia Comes"».
// ⚖️ La guardia del worker ha fatto il suo mestiere e ha fallito CHIUSA — non ha messo in campo
// la persona sbagliata. Lo sbaglio stava in chi le passava il numero.
// 📊 E non era un caso raro: **nessun `add` del bot ha mai potuto riuscire**. Il ramo `create`
// non manda nessun codice (guardia spenta) e infatti funziona: due rami della stessa funzione,
// due comportamenti, e a rompersi era solo quello che nessuno aveva ancora usato.
//
// 🕰️ La stessa malattia era già passata di qui: in giugno `/create-booking` rifiutava
// «codice 000005» per Pierangela mentre l'etichetta diceva `000005-Pierangela Barbera` e l'id
// era `10`. Fu curata in `matchpoint-bookings-create` il 2/08 — e **non** in questo ramo.
// ⇒ Perciò la composizione sta in una funzione sola, provata: una regola curata in un punto e
// non nell'altro è la forma in cui questo difetto è già tornato una volta.
//
// 📊 Quale dei due numeri si può davvero mandare, misurato su PROD il 19/08: su **2802** schede
// vive, `matchpointIdInterno` ce l'hanno **60**, il codice cliente a sei cifre **1092**.
// ⇒ Il codice cliente è la strada normale; l'id interno è il di più di quei 60. Si mandano
// tutt'e due quando ci sono — che è quello che l'app dello staff fa da sempre.
// ══════════════════════════════════════════════════════════════════════════════════════════

/** Un giocatore come lo legge `searchAndAddPlayer` del worker. */
export type GiocatoreDaAggiungere = {
  nome: string;
  /** L'id interno Matchpoint (`HiddenFieldIdPeople`). Assente per quasi tutti. */
  codice?: string;
  /** Il codice cliente, quello dell'etichetta «001013-Nome Cognome». */
  codiceCliente?: string;
};

/**
 * L'id interno Matchpoint, se la scheda ne porta uno credibile.
 *
 * ⭐ Gemella di `_staffCalPlayerCode` nell'app (`index.html`), stessa regola `\d{1,12}`: le due
 * rispondono alla stessa domanda da due sedi che non si possono importare fra loro. Se un
 * giorno divergono, divergono in silenzio — perciò la regola sta scritta in tutt'e due con la
 * stessa forma, e questa riga esiste per poterla provare.
 * 🚨 Un valore storto si SCARTA invece di mandarlo: un id inventato riaprirebbe esattamente il
 * confronto sbagliato che questa funzione esiste per chiudere.
 */
export function idInternoValido(grezzo: unknown): string {
  const s = String(grezzo ?? '').trim();
  return /^\d{1,12}$/.test(s) ? s : '';
}

/**
 * La forma del giocatore da mandare al worker.
 *
 * 🚨 Il `codiceCliente` arriva GIÀ validato da chi chiama (`/^[0-9]{6}$/`, la stessa regola che
 * decide se una persona è cliente del circolo): non si rivalida qui, perché quella regola ha
 * una gemella dichiarata in `consumer-player-readmodel` ed è già stata allineata una volta —
 * duplicarla in un terzo posto rifarebbe il difetto che l'allineamento aveva chiuso.
 *
 * ⚖️ I campi assenti non escono come stringa vuota ma **non escono affatto**: il worker legge
 * `expectedCode`/`expectedClientCode` come «guardia accesa o spenta», e una stringa vuota è
 * spenta esattamente come l'assenza — ma solo l'assenza lo dice guardando il payload.
 */
export function giocatoreDaAggiungere(input: {
  nome: string;
  codiceCliente: string;
  /** `matchpointIdInterno` della scheda, così com'è: qui dentro viene validato. */
  idInterno?: unknown;
}): GiocatoreDaAggiungere {
  const codice = idInternoValido(input.idInterno);
  return {
    nome: input.nome,
    ...(codice ? { codice } : {}),
    ...(input.codiceCliente ? { codiceCliente: input.codiceCliente } : {}),
  };
}
