/**
 * 🧬⭐⭐ LA CHIAVE DI UNA SCHEDA NON PUÒ RETROCEDERE — voce 69, 28/08/2026.
 *
 * 🚨 IL DIFETTO CHE CHIUDE, letto nel sorgente in servizio e non dedotto. In `index.ts` la
 * chiave con cui si riscrive un socio già esistente si sceglie così:
 *
 *     const localKey = (match && !shouldNormalizeMemberLocalKey(match) && match.local_key)
 *       ? match.local_key          // ← non si passa di qui per i soci Matchpoint
 *       : (canonicalKey || …);     // ← si passa di qui
 *
 * `shouldNormalizeMemberLocalKey` è **vera** per ogni riga `source: matchpoint_auto`, cioè per
 * quasi tutto il circolo ⇒ si usa la **canonica dell'import**. E `memberCloudKey` la calcola
 * col telefono se c'è, **altrimenti con l'email**.
 * ⇒ Un export senza telefono sposta la chiave da `phone:…` a `email:…`, e siccome nessuno
 * cancella la vecchia, la stessa persona resta viva su **due righe**.
 *
 * 📏 MISURATO su PROD il 28/08: Laura Aprea e Marco Aprea, riga `phone:` del 31/07 e riga
 * `email:` del **09/08 alle 16:30:38** — un solo import senza telefono, due doppioni. Da lì il
 * ponte trova due soci vivi con lo stesso id, risponde `AMBIGUOUS`, e il bot dice al socio
 * *«Non riesco ad aprire il test adesso»*. Prima ancora aveva detto *«Non hai prenotazioni»* a
 * Fabiola (23/08) e *«Non sono riuscito a farti entrare»* a Lidia (24/08): **stessa causa, tre
 * gesti diversi**.
 *
 * ⚖️ PERCHÉ LA CURA STA QUI E NON NELLA RICERCA. La scheda della 69 proponeva *«far cercare al
 * sync anche per `payload.id`»*: non avrebbe curato niente, perché **il match c'è già** —
 * `collectExistingMemberCandidates` trova benissimo la riga `phone:` cercando per `email:` e per
 * `name:`. Il difetto non è trovare la riga: è **riscriverla sotto un'altra chiave**.
 * 📌 *Una cura si disegna sul difetto raccontato e si convalida sul codice: se il racconto e il
 * codice non combaciano, il difetto è dove sta il codice.*
 *
 * ⭐ LA REGOLA, in una riga: **si normalizza verso l'alto o alla pari, mai verso il basso.**
 * Un telefono identifica una persona meglio di un'email, e un'email meglio di un nome. Se
 * l'import di stanotte è più povero della riga che c'è già, è l'import a essere povero — non
 * l'identità del socio a essere cambiata.
 *
 * 🔒 COSA QUESTA FUNZIONE NON PUÒ FARE, ed è ciò che la rende sicura: decide **sotto che chiave**
 * si scrive, mai **se** si scrive. Non cancella, non disattiva, non fonde due schede. Il caso
 * peggiore di un suo errore è una chiave meno bella; non una persona persa.
 */

/** Quanto una chiave identifica una persona. Più alto = più forte. */
export function rangoChiave(chiave: unknown): number {
  const k = String(chiave ?? '').trim();
  if (k.startsWith('phone:')) return 3;
  if (k.startsWith('email:')) return 2;
  if (k.startsWith('name:')) return 1;
  /* 0 = tutto il resto: l'uuid nudo che scrive l'app dello staff quando il telefono manca
     (`pmoMemberCloudLocalKey`), `member:…`, `member|<hash>`, le chiavi legacy del 2026.
     ⚖️ Zero e non «illeggibile»: verso quelle la normalizzazione DEVE poter salire, ed è
     esattamente il lavoro per cui `shouldNormalizeMemberLocalKey` esiste. Toglierlo curerebbe
     il doppione spegnendo una cosa che funziona. */
  return 0;
}

/**
 * La chiave con cui riscrivere una scheda già esistente.
 *
 * @param chiaveEsistente la `local_key` della riga trovata (vuota se non c'è nessuna riga)
 * @param chiaveCanonica  la chiave che l'import di adesso produrrebbe
 */
export function chiaveDaScrivere(chiaveEsistente: unknown, chiaveCanonica: unknown): string {
  const esistente = String(chiaveEsistente ?? '').trim();
  const canonica = String(chiaveCanonica ?? '').trim();
  // Nessuna riga da conservare, o niente di nuovo da proporre: non c'è nessuna scelta da fare.
  if (!esistente) return canonica;
  if (!canonica) return esistente;
  if (esistente === canonica) return esistente;
  /* ⭐ «>=» e non «>»: a parità di rango vince la canonica, che è il comportamento di prima.
     Due chiavi dello stesso rango sono due indirizzi ugualmente buoni della stessa persona
     (`phone:` vecchio → `phone:` nuovo è un socio che ha cambiato numero), e lì seguire
     l'import è giusto. È SOLO la discesa che va fermata. */
  return rangoChiave(canonica) >= rangoChiave(esistente) ? canonica : esistente;
}
