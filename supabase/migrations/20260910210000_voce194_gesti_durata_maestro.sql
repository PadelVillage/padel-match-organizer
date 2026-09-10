-- Voce 194 ② — DUE GESTI NUOVI: «durata» e «maestro».
--
-- 🗣️ Sua richiesta del 10/09/2026: «bisogna attivare le notifiche sul chatbot quando c'è
-- qualsiasi operazione», tradotta in un elenco che ha approvato lui, col criterio che ha
-- approvato lui: **si avvisa se il socio deve comportarsi diversamente**, non se è cambiato un
-- campo. Una partita che finisce a un'ora diversa e una lezione con un altro maestro cambiano
-- tutt'e due quello che il socio farà; una nota di servizio no.
--
-- 🚨⭐⭐ QUESTA MIGRAZIONE È IL SECONDO DEI TRE PASSI, E L'ORDINE NON SI SCEGLIE.
-- ① il **bot** impara le due parole (`ponte.ts` scarta i gesti che non conosce ⇒ da solo è
--    inerte: nessuno gliele manda);
-- ② **questa migrazione** apre il `CHECK`;
-- ③ il **gestionale** comincia a dichiararle.
-- ⇒ Al contrario, per la finestra fra i due deploy quel fatto non lo direbbe **nessuno**: la
-- riga sarebbe rifiutata dal vincolo (② prima di ③) oppure scartata dal bot (③ prima di ①).
-- 📌 *Un vincolo che rifiuta una riga non perde un messaggio: perde il fatto, e in silenzio.*
--
-- ⛔ E IL TERZO GESTO CHE AVEVA APPROVATO — **partita ↔ lezione** — NON È QUI, per una misura
-- e non per una dimenticanza: quel gesto **non esiste**. Il tipo si sceglie solo in creazione
-- (non c'è nella scheda, non c'è in `EditRequest`, e su Matchpoint una partita e una lezione
-- sono due schede diverse: `FichaPartida…` e `FichaClaseSuelta…`), e in **3621** prenotazioni
-- non è mai cambiato — misurato sullo stesso conto che sulle durate ne trova **18**, cioè col
-- suo controllo negativo. ⇒ Aprire il `CHECK` a una parola che nessuno può scrivere avrebbe
-- lasciato in giro un permesso senza un gesto.
-- 📌 *Prima di allungare una lista, si misura se la lista di oggi parte.*

-- ── ① Le tre colonne: ognuna risponde a UNA domanda ───────────────────────────────────────
--
-- ⚖️ PERCHÉ TRE COLONNE STRETTE E NON UN RIUSO DI `da`. `da` risponde a «dov'era prima», ed è
-- popolata solo su `spostata`. Infilarci dentro l'orario di fine la farebbe rispondere a due
-- domande diverse — *«dov'era»* e *«fin quando durava»* — e in questo progetto una cosa che
-- risponde a due domande non risponde a nessuna delle due: la prima riga che le confonde è
-- quella che poi nessuno riesce più a separare.
-- ⚠️ E niente colonna generica (un `dettaglio jsonb` buono per tutto): un sacco accetta anche
-- ciò che nessuno ha previsto, e la prima cosa che ci finisce dentro è quello che non si è
-- saputo dove mettere.

alter table public.pmo_eventi_staff
  -- ⏱️ A che ora si finisce ADESSO e a che ora si finiva PRIMA (`HH:MM`). Solo su `durata`.
  -- ⭐ Servono in COPPIA per la parola che porta l'informazione — «allungata» o «accorciata» —
  --    che è la prima riga del messaggio e spesso l'unica che si legge nella notifica.
  -- ⚠️ Tutt'e due possono restare vuote: il bot degrada per gradi invece di tacere o inventare
  --    (due orari ⇒ il verso; solo il nuovo ⇒ fin quando si gioca; nessuno ⇒ il fatto nudo).
  -- 🚨 L'ora d'INIZIO non è qui perché su questo gesto **non cambia**: se cambiasse sarebbe uno
  --    spostamento, e il gesto sarebbe `spostata`. Due fatti diversi, due gesti diversi.
  add column if not exists fine text,
  add column if not exists fine_prima text,
  -- 👨‍🏫 Chi tiene la lezione ADESSO, col nome come lo scrive il circolo. Solo su `maestro`.
  -- ⛔ Il maestro di PRIMA non si conserva, ed è deliberato: al socio serve sapere chi troverà,
  --    non chi non troverà. Nominare chi se n'è andato è una notizia sul maestro, non sulla sua
  --    lezione — e una colonna che esiste prima o poi qualcuno la mostra.
  add column if not exists maestro text;

comment on column public.pmo_eventi_staff.fine is
  'Voce 194 ②: ora di fine NUOVA (HH:MM), solo sul gesto «durata». Vuota = non si dice.';
comment on column public.pmo_eventi_staff.fine_prima is
  'Voce 194 ②: ora di fine di PRIMA (HH:MM), solo sul gesto «durata». Con `fine` fa «allungata»/«accorciata».';
comment on column public.pmo_eventi_staff.maestro is
  'Voce 194 ②: il maestro di ADESSO, solo sul gesto «maestro». Vuota = si dice che è cambiato, senza dire chi.';

-- ── ② Il vincolo si allarga di DUE parole, non di tre ──────────────────────────────────────
--
-- 🚨 Si toglie e si rimette nella stessa transazione: un `CHECK` non si «modifica». E resta un
-- elenco CHIUSO — è la stessa scelta del bot, e per la stessa ragione: un gesto che nessuno sa
-- dire deve essere **rifiutato**, non accettato e poi taciuto a valle. Il rifiuto lascia una
-- riga in un registro; il silenzio no.

alter table public.pmo_eventi_staff drop constraint if exists pmo_eventi_staff_gesto_check;
alter table public.pmo_eventi_staff add constraint pmo_eventi_staff_gesto_check
  check (gesto = any (array[
    'aggiunto'::text,    -- il socio è entrato in campo
    'tolto'::text,       -- il socio non c'è più
    'annullata'::text,   -- la partita non c'è più
    'spostata'::text,    -- la partita si è mossa (voce 74/76)
    'formazione'::text,  -- sono cambiati i compagni (voce 79)
    'durata'::text,      -- 🆕 si finisce a un'ora diversa (voce 194 ②)
    'maestro'::text      -- 🆕 la lezione la tiene un altro (voce 194 ②)
  ]));
