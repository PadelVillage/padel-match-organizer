// 🎭 VOCE 205 — CHI TIENE LA LEZIONE, e chi invece la subisce.
//
// 📍 IL DIFETTO CHE QUESTO MODULO CURA, in una riga: il bot diceva *«Lezione · con X»* dove X
// erano i `compagni` — cioè «gli altri, come li nomina il ponte». Su una PARTITA quella frase è
// giusta; su una LEZIONE, in italiano, *«lezione con X»* vuol dire **«lezione tenuta da X»** ⇒ il
// bot nominava come maestro un compagno di banco.
// 📌 La parola «con» cambia mestiere a seconda di cosa la precede, e una riga che vale per due
// tipi di prenotazione non se ne accorge.
//
// 📏 LE DUE MISURE CHE HANNO DECISO LA FORMA DELLA CURA (10/09/2026, su `cudi`):
//   ① **il maestro OCCUPA UN POSTO IN CAMPO**: su 93 lezioni con maestro dichiarato, il roster
//      contiene la persona del maestro **93 volte su 93**. Non è quindi un dato che manca — è un
//      dato che nessuno sapeva riconoscere;
//   ② **il codice non è il nome**: il campo `istruttore` porta `Spinazze`, il roster porta
//      `Gianluca Spinazzè`. Senza `pmo_maestri` (voce 202) i due non si legano, e il maestro
//      resterebbe indistinguibile da un allievo.
//
// ⚠️ E LA MISURA CHE HA SALVATO LA CURA DA UN SECONDO DIFETTO: delle 93 lezioni, **18 sono
// tenute dal committente stesso** (`LoZio` = Maurizio Aprea, confermato da lui il 10/09), che è
// anche un utente del bot. ⇒ Una cura che si fermasse a «Lezione con <maestro>» gli direbbe
// *«Lezione con Maurizio Aprea»* — cioè che prende lezione **da sé stesso**. Il difetto sarebbe
// stato spostato, non tolto, e su un caso su cinque.
// 📌 Una cura si prova anche dal punto di vista di chi NON è il destinatario tipico: qui il
// maestro legge le stesse righe dell'allievo, e la frase giusta per uno è assurda per l'altro.
//
// ⚖️ PERCHÉ LA REGOLA STA QUI E NON NEL BOT — «il gestionale SA, il bot DICE» (`CLAUDE.md`).
// Il bot riceve il nome già risolto e l'elenco già ripulito: non conosce `pmo_maestri`, non
// confronta nomi, non sa che `Spinazze` e `Gianluca Spinazzè` sono la stessa persona. Il giorno in
// cui i maestri cambiano forma, il bot **non si tocca**.

import { clean, normName } from './compagni-slot.ts';

/** Una riga di `pmo_maestri`: il codice che il circolo scrive, e la persona che è. */
export type Maestro = { codice: string; nome: string };

/**
 * Il NOME DELLA PERSONA che tiene questa lezione, a partire dal codice della prenotazione.
 *
 * ⚠️ Torna `null` — e non una stringa vuota né il codice stesso — quando il maestro non si sa:
 * codice assente, oppure un codice che in `pmo_maestri` non c'è (un maestro nuovo che nessuno ha
 * ancora aggiunto). ⭐ Quel `null` è il segnale che tiene onesta tutta la catena: chi legge deve
 * **lasciare la frase com'era** invece di inventare un maestro. Tornare il codice grezzo
 * sembrerebbe più utile e sarebbe peggio — il socio leggerebbe *«Lezione con Spinazze»*, un nome
 * che sulla porta del circolo non c'è.
 *
 * 🚨 Il confronto è su `normName` e non sulla stringa: i codici arrivano dal circolo con
 * maiuscole e accenti ballerini, e un confronto esatto fallirebbe **in silenzio** — cioè
 * esattamente come se il maestro non fosse in tabella.
 */
export function nomeDelMaestro(codice: unknown, maestri: Maestro[]): string | null {
  const cercato = normName(codice);
  if (!cercato) return null;
  for (const m of maestri) {
    if (normName(m.codice) === cercato) {
      const nome = clean(m.nome);
      // Una riga senza nome è come non averla: meglio «non lo so» che una stringa vuota, che a
      // valle diventerebbe «Lezione con » — una frase troncata a metà.
      return nome || null;
    }
  }
  return null;
}

/**
 * Vero se il socio che sta leggendo È il maestro di questa lezione.
 *
 * @param varianti Le forme del nome del socio già raccolte dal chiamante (`nameVariants`), nella
 *                 stessa forma normalizzata usata per i compagni. Passarle invece di ricalcolarle
 *                 tiene UNA sola idea di «come si chiama questo socio»: due idee gemelle in due
 *                 posti si accorgono di essere diverse il giorno in cui una cambia.
 */
export function ilMaestroSonoIo(nomeMaestro: string | null, varianti: Set<string>): boolean {
  const m = normName(nomeMaestro);
  return !!m && varianti.has(m);
}

/**
 * Gli ALLIEVI: i compagni meno il maestro.
 *
 * ⭐ Perché un elenco NUOVO e non `compagni` corretto sul posto: `compagni` è letto in mezza
 * dozzina di punti del bot che non c'entrano niente con questa frase — quanti sono in campo, «X
 * resta in campo» quando qualcuno esce, i conteggi dei promemoria. Togliere il maestro di lì
 * cambierebbe tutti quei numeri di uno, in silenzio, per curare una frase.
 * 📌 Una cura che per sistemare una frase cambia un conteggio non è più piccola del difetto:
 * è più grande, e non lo dice.
 * ⇒ `allievi` si AGGIUNGE. Un bot più vecchio di questa funzione continua a leggere esattamente
 * ciò che leggeva — la stessa scelta già fatta per `ordine` (voce 71) e `aperta` (voce 88).
 *
 * ⚠️ Con `nomeMaestro` a `null` torna i compagni **tali e quali**: non sapendo chi sia il maestro
 * non c'è niente da togliere, e togliere «per prudenza» il primo della lista sarebbe indovinare.
 */
export function allieviSenzaIlMaestro(compagni: string[], nomeMaestro: string | null): string[] {
  const m = normName(nomeMaestro);
  if (!m) return [...compagni];
  // 🚨 Si toglie OGNI occorrenza, non la prima: lo stesso nome può arrivare da due fonti dello
  // stesso slot (la scheda del circolo e l'array `giocatori`), e `compagniDelloSlot` le unisce
  // per nome — ma un maestro scritto in due modi diversi («Lucas Vidal» e «lucas vidal») ha già
  // attraversato quell'unione come due persone. Qui la normalizzazione li ricongiunge.
  return compagni.filter((c) => normName(c) !== m);
}
