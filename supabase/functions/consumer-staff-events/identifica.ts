// identifica.ts — da un NOME sul roster alla persona a cui scrivere. O a nessuno.
//
// 🚨⭐⭐ È LA PROTEZIONE PIÙ IMPORTANTE DI QUESTA FUNZIONE, e la più facile da sbagliare in
// tutte e due le direzioni. Le prenotazioni identificano i giocatori **solo per nome**: nel
// payload Matchpoint non c'è un id. Da qui in poi bisogna decidere a chi arriva un messaggio
// che dice «non sei più nella partita», e sbagliare persona è un danno che per giunta rivela
// al destinatario sbagliato chi gioca e quando.
//
// ⚖️ MA IL FAIL CLOSED SECCO — «più di una scheda ⇒ nessuno» — È SBAGLIATO, e lo si è scoperto
// al primo collaudo su dati veri (21/08/2026, PROD).
//
// 📏 Misurato: «Lidia Comes» ha **due schede vive** in anagrafica. Non sono due persone: sono
// due copie della STESSA, con lo stesso ID Padel Village (`PMO-000583`) e lo stesso codice del
// circolo (`001013`). Con la regola secca non avrebbe mai ricevuto niente — e nessuno se ne
// sarebbe accorto, perché *un avviso che non parte è indistinguibile da un fatto che non è
// successo*.
//
// ⇒ LA DOMANDA GIUSTA NON È «quante schede?» MA «puntano alla stessa persona?». Due schede che
// portano lo stesso identificativo non sono un'ambiguità, sono un duplicato dell'anagrafica —
// e un duplicato non deve costare a un socio i suoi messaggi. L'ambiguità vera è quando gli
// identificativi **differiscono**: lì non si sceglie, si tace.
//
// 🚨 E l'ambiguità vera esiste davvero in questo archivio, non è teorica: 24 codici socio
// condivisi da 48 persone (misurati il 9/08/2026), che è il caso da cui questa guardia nasce.

/** Una scheda dell'anagrafica, ridotta a ciò che serve per riconoscere una persona. */
export type SchedaMinima = {
  id: string;
  pmoPlayerId: string;
  memberId: string;
  nome: string;
};

/** Chi scrivere: gli identificativi che il bot userà per trovare la chat. */
export type Destinatario = {
  id: string;
  pmoPlayerId: string;
  memberId: string;
};

/** Forma normalizzata per confrontare due nomi, mai per mostrarli. */
export function normNome(value: unknown): string {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * L'impronta con cui si decide se due schede sono la stessa persona.
 *
 * ⭐ Si guardano i DUE identificativi insieme, non uno solo: l'ID Padel Village è quello che
 * conta, ma non tutte le schede ce l'hanno, e il codice del circolo da solo è notoriamente
 * condiviso. Presi in coppia, due schede della stessa persona combaciano e due persone
 * diverse quasi mai.
 *
 * ⚠️ Una scheda senza NESSUNO dei due non ha impronta: non si può dire che sia la stessa di
 * un'altra, e nemmeno che sia diversa. Vale come sconosciuta ⇒ fa scattare la prudenza.
 */
export function impronta(s: SchedaMinima): string | null {
  const p = s.pmoPlayerId.trim().toUpperCase();
  const m = s.memberId.trim();
  if (!p && !m) return null;
  return `${p}|${m}`;
}

/**
 * La persona a cui scrivere, oppure `null` se non si può dire con certezza.
 *
 * | cosa si trova | cosa si fa | perché |
 * |---|---|---|
 * | nessuna scheda | **niente** | non è del circolo, o il nome è scritto diversamente |
 * | una scheda | **si scrive** | il caso normale |
 * | più schede, stessa impronta | **si scrive** ⭐ | duplicato d'anagrafica: la persona è una |
 * | più schede, impronte diverse | **niente** 🚨 | omonimi veri: scegliere è scrivere a un estraneo |
 * | più schede, una senza impronta | **niente** | non si può escludere che sia un'altra persona |
 *
 * ⇒ Fra le copie si tiene la prima che porta un ID Padel Village, che è la via preferita del
 * progetto (regola del 2/08: *«l'ID che il bot deve leggere è l'ID PMO»*); se nessuna ce l'ha,
 * la prima.
 */
export function destinatarioPerNome(
  nome: string,
  schede: SchedaMinima[],
): Destinatario | null {
  const n = normNome(nome);
  if (!n) return null;

  const trovate = schede.filter((s) => normNome(s.nome) === n);
  if (trovate.length === 0) return null;
  if (trovate.length > 1) {
    const impronte = new Set<string>();
    for (const s of trovate) {
      const i = impronta(s);
      // 🚨 Senza impronta non si sa: si tratta come una persona a sé, così il confronto qui
      // sotto fallisce e si tace. Il verso prudente è non scrivere.
      if (!i) return null;
      impronte.add(i);
    }
    if (impronte.size > 1) return null;   // omonimi veri
  }

  const scelta = trovate.find((s) => s.pmoPlayerId.trim()) ?? trovate[0];
  return { id: scelta.id, pmoPlayerId: scelta.pmoPlayerId, memberId: scelta.memberId };
}
