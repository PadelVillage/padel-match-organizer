-- 👥 VOCE 79 — CHI RESTA IN CAMPO VIENE AVVISATO: il quinto gesto, `formazione`.
--
-- 🗣️ Regola del committente del 23/08/2026: *«quando la segreteria fa un qualsiasi tipo di
-- operazione, le persone che sono dentro la partita devono essere avvisate»*, e *«gli avvisi
-- se devono arrivare devono arrivare corretti fino in fondo»*.
--
-- 📏 Il difetto, segnalato da lui guardando il proprio telefono: *«a Maurizio sul bot non è
-- arrivato nessun messaggio che si è aggiunto un ospite o si era levato un ospite»*. Misurato
-- su `pmo_eventi_staff`: non un messaggio perso, un messaggio **mai nato** — i fatti
-- `aggiunto`/`tolto` nascono intestati a chi si è MOSSO, e chi resta non era previsto.
-- Rimisurato la notte del 23/08 su tre gesti insieme (fuori Lidia, fuori Fabiola, dentro
-- Marco): tre fatti, per loro tre. A Maurizio e a Laura, che restavano in campo: zero.
--
-- ⚖️ La regola era già stata applicata all'annullo (voce 74) e allo spostamento (voce 76).
-- Restava fuori l'entrata e l'uscita di un giocatore, che è **il caso più frequente di
-- tutti**: la segreteria che compone una partita.
--
-- 🚨⭐⭐ L'ORDINE DI MESSA IN SERVIZIO, e non è un dettaglio: **prima il bot, poi questa
-- migrazione, poi il gestionale**. `ponte.ts` scarta i gesti che non conosce, quindi un bot
-- più vecchio del gestionale butterebbe via i fatti `formazione` in silenzio — e per la
-- finestra fra i due deploy quel cambiamento non lo direbbe nessuno, che è peggio di un
-- messaggio sbagliato.

-- ── ① Il quinto gesto entra nel vincolo ──────────────────────────────────────────────────
-- 📌 È la lezione di `staff_edit`, pagata l'11/08/2026: un CHECK che non ammetteva il tipo
-- faceva rifiutare la riga dal database, e per mesi le righe sono state **zero** su TEST e su
-- PROD senza che nessuno se ne accorgesse. Un vincolo dimenticato non urla: tace.
alter table public.pmo_eventi_staff
  drop constraint if exists pmo_eventi_staff_gesto_check;

alter table public.pmo_eventi_staff
  add constraint pmo_eventi_staff_gesto_check
  check (gesto = any (array['aggiunto', 'tolto', 'annullata', 'spostata', 'formazione']));

-- ── ② Chi è entrato e chi è uscito ───────────────────────────────────────────────────────
-- ⚖️ `jsonb` e non `text[]`: sono elenchi che viaggiano fino al bot dentro una risposta JSON,
-- e `text[]` costringerebbe a una conversione in ogni punto che li legge.
-- 🚨 Le RIPETIZIONI contano, ed è la ragione per cui non è un insieme: tre «Ospite» entrati
-- sono tre posti presi, non uno — è la stessa distinzione che `conteggio()` fa in
-- `eventi-staff.ts`, e fonderli direbbe che togliendone due su tre non è cambiato niente.
-- ⚠️ NULL = «non lo so» e vale elenco vuoto a valle: i fatti già in coda al momento della
-- migrazione non devono cambiare di significato.
alter table public.pmo_eventi_staff
  add column if not exists entrati jsonb,
  add column if not exists usciti jsonb;

comment on column public.pmo_eventi_staff.entrati is
  'Voce 79: solo su gesto=formazione — chi è ENTRATO nella partita, coi nomi come li scrive il '
  'circolo, «Ospite» compreso e con le ripetizioni. NULL = non lo so (vale elenco vuoto).';
comment on column public.pmo_eventi_staff.usciti is
  'Voce 79: solo su gesto=formazione — chi è USCITO dalla partita, stesse regole di `entrati`.';
