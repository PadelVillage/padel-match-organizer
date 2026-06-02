-- Aggiunge il tipo 'booking_job' ai record ammessi in pmo_cloud_records.
-- Usato dalla edge matchpoint-bookings-create per tracciare lo stato del lavoro
-- asincrono (pending/done/error) letto in polling dall'app.
ALTER TABLE pmo_cloud_records DROP CONSTRAINT IF EXISTS pmo_cloud_records_type_check;
ALTER TABLE pmo_cloud_records ADD CONSTRAINT pmo_cloud_records_type_check
  CHECK (record_type = ANY (ARRAY[
    'member','booking','booking_occupancy','booking_history','player_group',
    'match_invitation','fill_slot_created_match','fill_slot_player_request',
    'guided_invite_session','whatsapp_message_history','whatsapp_message_template',
    'matchpoint_data','assessment_email','app_setting','staff_booking','booking_job'
  ]::text[]));
