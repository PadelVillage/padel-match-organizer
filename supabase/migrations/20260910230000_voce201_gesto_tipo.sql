-- 🎭 VOCE 201 — L'OTTAVO GESTO: partita ↔ lezione.
--
-- 🗣️ Sue parole del 10/09/2026: *«partita ↔ lezione — quel gesto non esiste, e se lo vuoi il
--    lavoro è prima creare l'operazione.. si lo voglio»*.
--
-- ⭐⭐ QUESTA È LA SECONDA DELLE TRE MOSSE, E L'ORDINE NON È NEGOZIABILE (regola del 23/08):
--    ① il **bot** impara la parola — fatto, commit `fe52ad7` del repo del bot. Da solo è
--       inerte: `ponte.ts` scarta i gesti che non conosce, quindi impararla non fa succedere
--       niente finché nessuno gliela manda;
--    ② **questa migrazione** apre il `CHECK`, che oggi rifiuterebbe la riga;
--    ③ il **gestionale** comincia a emettere il fatto.
--    ⛔ Al contrario, per la finestra fra i due deploy quel fatto non lo direbbe **nessuno** —
--       peggio di un messaggio sbagliato, perché non lascia traccia.
--
-- ⚖️ E questa mossa da sola è **inerte come la prima**: allargare un `CHECK` non fa nascere
--    nessuna riga. È il gradino che permette al ③ di atterrare, non il ③.

alter table public.pmo_eventi_staff
  add column if not exists tipo_prima text;

-- 🩹 Testo fra dollari e non fra apici: la frase contiene apostrofi italiani, e raddoppiarli a
--    mano è il modo in cui una migrazione muore alla prima rilettura distratta.
comment on column public.pmo_eventi_staff.tipo_prima is $t$Voce 201: che cos'era PRIMA (partita/lezione), solo sul gesto «tipo». Vuota = si dice solo che cos'è adesso. Il tipo di ADESSO sta in `tipo`, come su tutti gli altri gesti: sono due domande diverse, e servono tutt'e due per dire «è diventata».$t$;

-- 🚨 IL `CHECK` SI RIFÀ INTERO, non si aggiunge un secondo vincolo accanto: due `check` sullo
--    stesso campo si leggono come una congiunzione, e chi ne trova uno solo crede di aver letto
--    la regola. ⇒ `drop` e `add`, con l'elenco per esteso e ogni voce commentata.
alter table public.pmo_eventi_staff drop constraint if exists pmo_eventi_staff_gesto_check;
alter table public.pmo_eventi_staff add constraint pmo_eventi_staff_gesto_check
  check (gesto = any (array[
    'aggiunto'::text,    -- il socio è entrato in campo
    'tolto'::text,       -- il socio non c'è più
    'annullata'::text,   -- la partita non c'è più
    'spostata'::text,    -- la partita si è mossa (voce 74/76)
    'formazione'::text,  -- sono cambiati i compagni (voce 79)
    'durata'::text,      -- si finisce a un'ora diversa (voce 194 ②)
    'maestro'::text,     -- la lezione la tiene un altro (voce 194 ②)
    'tipo'::text         -- 🆕 partita ↔ lezione (voce 201)
  ]));

-- ⛔ NESSUN VINCOLO SUI VALORI DI `tipo_prima`, ed è deliberato: la colonna gemella `tipo` non
--    ne ha, e il filtro vero sta **dove la parola viene letta** — il ponte del bot la accetta
--    solo se è `lezione` o `partita`, qualunque altra cosa vale «non lo dico». Mettere qui un
--    secondo elenco vorrebbe dire tenerne allineati due, e il giorno in cui divergono vince
--    quello che nessuno stava guardando.
