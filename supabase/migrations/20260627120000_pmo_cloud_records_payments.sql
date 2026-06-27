-- Aggiunge i record_type per la feature Incassi/Cassa + borsellino:
--   'payment'        → una quota pagata da un giocatore per una partita
--                      (local_key: pay|{idReserva}|{idCliente}|{seq})
--   'wallet_txn'     → un movimento del borsellino/Monedero (ricarica o addebito)
--                      (local_key: wtxn|{idCliente}|{client_txn_id})
--   'wallet_balance' → cache del saldo Monedero per cliente (snapshot da Matchpoint)
--                      (local_key: wbal|{idCliente})
-- Accesso invariato: RPC-only via pmo_get_records_admin / pmo_upsert_records_admin
-- (type-agnostiche). Denaro SEMPRE in interi amount_cents nel payload.
ALTER TABLE pmo_cloud_records DROP CONSTRAINT IF EXISTS pmo_cloud_records_type_check;
ALTER TABLE pmo_cloud_records ADD CONSTRAINT pmo_cloud_records_type_check
  CHECK (record_type = ANY (ARRAY[
    'member','booking','booking_occupancy','booking_history','player_group',
    'match_invitation','fill_slot_created_match','fill_slot_player_request',
    'guided_invite_session','whatsapp_message_history','whatsapp_message_template',
    'matchpoint_data','assessment_email','app_setting','staff_booking','staff_suppress','booking_job',
    'payment','wallet_txn','wallet_balance'
  ]::text[]));
