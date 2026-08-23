-- 🔄 VOCE 74 — uno SPOSTAMENTO è un gesto suo, non un annullo travestito.
--
-- 🗣️ Regola del committente, 23/08/2026:
--   «Quando la segreteria fa un qualsiasi tipo di operazione, le persone che sono dentro la
--    partita devono essere avvisate.»
--   «Gli avvisi se devono arrivare devono arrivare corretti fino in fondo.»
--   «Logicamente questa regola vale anche per una lezione.»
--
-- 📏 Il fatto misurato quel giorno, sulle sue due prove: spostando una partita dalle 09:30
-- campo 1 alle 11:30 campo 2 nasceva `annullata` per lo slot vecchio e ZERO fatti per quello
-- nuovo ⇒ al socio arrivava «La tua partita non c'è più… è stata annullata dal circolo», che è
-- falso. Chi legge «annullata» non va a cercare la partita altrove: la dà per persa.
--
-- ⚖️ Perché serve un gesto NUOVO e non basta smettere di dire «annullata»: le due metà di uno
-- spostamento (lo slot che sparisce, quello che nasce) sono due fatti scollegati, e chi li
-- riceve dovrebbe capire da sé che parlano della stessa partita. Un gesto solo dice la cosa
-- una volta e per intero.

alter table public.pmo_eventi_staff
  drop constraint if exists pmo_eventi_staff_gesto_check;

alter table public.pmo_eventi_staff
  add constraint pmo_eventi_staff_gesto_check
  check (gesto in ('aggiunto', 'tolto', 'annullata', 'spostata'));

-- 🔄 DA DOVE si è mossa. Le colonne principali del fatto restano quelle NUOVE — è lì che si va
-- a giocare — e questa dice da dove, perché il socio quella partita ce l'ha in testa com'era
-- prima.
--
-- ⭐ È `jsonb` e non tre colonne, per una ragione di forma: il fatto nel codice porta un oggetto
-- `da` opzionale e viene inserito con uno spread (`{...f}`), quindi una sola colonna tiene le
-- due forme allineate. Tre colonne piatte chiederebbero una mappatura a mano nel punto
-- dell'insert, cioè un secondo posto in cui la forma può divergere.
-- ⚠️ NULL su tutti gli altri gesti, e nullo anche su uno spostamento di cui non si conoscano le
-- coordinate vecchie: chi scrive il messaggio deve reggere senza.
alter table public.pmo_eventi_staff
  add column if not exists da jsonb;

comment on column public.pmo_eventi_staff.da is
  'Solo su gesto=spostata: {data, ora, campo} dello slot di PARTENZA. Le colonne data/ora/campo del fatto sono quelle di ARRIVO.';
