-- VOCE 88 — «Partite Aperte»: il tipo di record che porta l'apertura.
--
-- 🗣️ Voce sua del 24/08/2026: *«poter partecipare a partite non chiuse, ma che un
-- organizzatore volutamente e spontaneamente apre ad altri giocatori»*.
--
-- Che cosa fa: allarga il CHECK di `pmo_cloud_records.record_type` per farci stare
-- `partita_aperta`. Niente altro — nessuna tabella nuova, nessun dato toccato.
--
-- 🚨⭐⭐ PERCHÉ SERVE UNA MIGRAZIONE PER UNA COSA CHE SEMBRA UN CAMPO LIBERO: quel CHECK
-- elenca i 22 tipi ammessi, e un `insert` con un tipo fuori elenco viene rifiutato dal
-- database. ⇒ Senza questa riga le azioni `apri` ed `entra` fallirebbero **a runtime**, con
-- un 500, e il banco non se ne accorgerebbe: nessuna prova del progetto tocca il database
-- vero. 📌 *Una guardia che sta nello schema non la vede nessun banco che gira senza schema.*
--
-- ⚖️ E il verso in cui il CHECK è una PROTEZIONE e non un fastidio, che è la ragione per cui
-- lo si allarga invece di toglierlo: `pmo_cloud_records` è il magazzino di tutto, e un tipo
-- scritto con un refuso («partita-aperta», «partite_aperte») creerebbe righe che nessuno
-- legge e nessuno cancella. Il CHECK trasforma quel refuso in un errore invece che in un
-- silenzio.
--
-- ⚠️ ORDINE: questa migrazione va PRIMA del deploy delle edge sullo stesso ambiente. Un push
-- su `test-preview` deploya `consumer-booking-write` su `cudi`, e da quel momento un socio
-- che tocca «Apri» prende un 500 finché il CHECK non è largo abbastanza.
-- ⭐ Il contrario invece è innocuo: il CHECK largo con le edge vecchie non fa niente a
-- nessuno — nessuno scrive quel tipo.
--
-- ⛔ L'app NON scarica questo tipo, ed è voluto: `index.html` chiede
-- ['booking','booking_occupancy','matchpoint_data','staff_booking','staff_suppress'].
-- L'apertura è un fatto del BOT, e il gestionale la mostrerà quando si deciderà come.
--
-- Idempotente: si può rieseguire.

ALTER TABLE public.pmo_cloud_records
  DROP CONSTRAINT IF EXISTS pmo_cloud_records_type_check;

ALTER TABLE public.pmo_cloud_records
  ADD CONSTRAINT pmo_cloud_records_type_check CHECK (record_type = ANY (ARRAY[
    'member', 'booking', 'booking_occupancy', 'booking_history', 'player_group',
    'match_invitation', 'fill_slot_created_match', 'fill_slot_player_request',
    'guided_invite_session', 'whatsapp_message_history', 'whatsapp_message_template',
    'matchpoint_data', 'assessment_email', 'app_setting', 'staff_booking', 'staff_suppress',
    'booking_job', 'payment', 'wallet_txn', 'wallet_balance', 'staff_edit', 'staff_cancel',
    -- 🆕 VOCE 88 (01/09/2026)
    'partita_aperta'
  ]));

-- 🔎 La ricerca di un'apertura è sempre `(record_type, local_key)`, e quella coppia ha già il
-- suo indice unico (`pmo_cloud_records_unique`). L'ELENCO invece filtra su `payload->>'data'`
-- fra le sole righe di questo tipo: poche decine, quindi nessun indice nuovo — un indice su
-- una manciata di righe costa più scritture di quante letture risparmi.
