-- 🚨⭐⭐ 11/08/2026 — I DUE TIPI CHE IL DATABASE RIFIUTAVA DA SEMPRE: 'staff_edit' e 'staff_cancel'.
--
-- Trovato provando: il ponte dei soci rispondeva «Modifica di PROVA registrata» e in
-- `pmo_cloud_records` non compariva NIENTE. Non zero righe recenti: **zero righe in assoluto**,
-- su TEST e su PROD, di tutt'e due i tipi.
--
-- La catena, misurata:
--   · `matchpoint-bookings-edit` scrive il registro con `record_type = 'staff_edit'`;
--   · `matchpoint-bookings-cancel` con `'staff_cancel'`;
--   · il CHECK `pmo_cloud_records_type_check` ammette venti tipi e **nessuno dei due c'è**
--     (l'ultima volta che l'elenco è stato toccato è la migrazione dei pagamenti, 27/06);
--   · quindi il database rifiutava con `23514`, e il codice **non guardava l'esito** — perché
--     supabase-js RESTITUISCE l'errore invece di lanciarlo, e il `try/catch` lì intorno non
--     poteva scattare. ⇒ Un rifiuto del database usciva come un «fatto».
--
-- ⚖️ Perché `staff_booking` invece funzionava, ed è il motivo per cui non se n'era accorto
-- nessuno: quel tipo è nell'elenco. Le PRENOTAZIONI di prova si registravano davvero (è la
-- «prova reale» del 7/08), le MODIFICHE e gli ANNULLAMENTI no. Un pezzo funzionante accanto a
-- uno rotto è il modo migliore per non vedere quello rotto.
--
-- 🚨 ORDINE: questa migrazione va applicata PRIMA del deploy del codice che controlla l'esito
-- della scrittura. Al contrario, ogni modifica di prova risponderebbe `503` — corretto ma
-- inutilmente rumoroso — e in produzione riempirebbe i log di `db_save_failed`.
ALTER TABLE pmo_cloud_records DROP CONSTRAINT IF EXISTS pmo_cloud_records_type_check;
ALTER TABLE pmo_cloud_records ADD CONSTRAINT pmo_cloud_records_type_check
  CHECK (record_type = ANY (ARRAY[
    'member','booking','booking_occupancy','booking_history','player_group',
    'match_invitation','fill_slot_created_match','fill_slot_player_request',
    'guided_invite_session','whatsapp_message_history','whatsapp_message_template',
    'matchpoint_data','assessment_email','app_setting','staff_booking','staff_suppress','booking_job',
    'payment','wallet_txn','wallet_balance',
    -- 🆕 11/08/2026: il registro di CHI ha modificato o annullato una prenotazione, e cosa.
    -- In prova è anche la prova stessa che il recinto ha fatto il suo lavoro senza chiamare il
    -- circolo: senza questa riga, «registrata» non è verificabile da nessuna parte.
    'staff_edit','staff_cancel'
  ]::text[]));
