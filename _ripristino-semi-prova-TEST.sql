-- ─────────────────────────────────────────────────────────────────────────────
-- RIPRISTINO dei semi di prova di TEST, tolti il 2/08/2026 dopo la promozione
-- del pannello «(senza codice)» in produzione.
--
-- Perché esiste: una pulizia senza il modo di rimetterla è irreversibile, e questi
-- casi sono COSTRUITI — se domani servisse riguardare il pannello con la novità
-- visibile, ricostruirli a memoria costerebbe più che rileggerli da qui.
-- Sta fuori da git (il `_` iniziale è ignorato): vive solo sul Mac.
--
-- ⚠️ Sono TRE blocchi su DUE progetti diversi. Si eseguono separatamente.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══ 1) ayly… (Padel Match Assistant TEST) — la guardia del bot, righe ambiente='test'
insert into public.telegram_operatori
select * from jsonb_populate_recordset(null::public.telegram_operatori, '[
  {"chat_id":900000001,"ambiente":"test","member_id":"000004","persona_id":"matchpoint_n29tlt","telefono_chiave":null,"etichetta":"PROVA — primo entrato","attivo":true,"created_at":"2026-07-28T14:49:42.743665+00:00","invitato_da_member_id":null,"invito_token":null},
  {"chat_id":900000002,"ambiente":"test","member_id":"000029","persona_id":null,"telefono_chiave":null,"etichetta":"PROVA — invitato da Maurizio","attivo":false,"created_at":"2026-07-29T14:49:42.743665+00:00","invitato_da_member_id":"000004","invito_token":null},
  {"chat_id":900000003,"ambiente":"test","member_id":"999999","persona_id":null,"telefono_chiave":null,"etichetta":"PROVA — scheda mancante","attivo":false,"created_at":"2026-07-30T14:49:42.743665+00:00","invitato_da_member_id":"000004","invito_token":null},
  {"chat_id":900000011,"ambiente":"test","member_id":null,"persona_id":"aaaa1b1b-0000-4000-8000-00000000b1b0","telefono_chiave":"3500000011","etichetta":"PROVA — senza codice","attivo":true,"created_at":"2026-08-01T13:46:57.139783+00:00","invitato_da_member_id":"000004","invito_token":null},
  {"chat_id":900000012,"ambiente":"test","member_id":null,"persona_id":"aaaa1b1b-0000-4000-8000-00000000b1b1","telefono_chiave":"3500000012","etichetta":"PROVA — attivata dopo l''ingresso","attivo":true,"created_at":"2026-08-01T14:46:57.139783+00:00","invitato_da_member_id":"000004","invito_token":null},
  {"chat_id":900000013,"ambiente":"test","member_id":null,"persona_id":"aaaa1b1b-0000-4000-8000-00000000b1b2","telefono_chiave":"3500000013","etichetta":"PROVA — invitata da chi non ha codice","attivo":true,"created_at":"2026-08-01T15:46:57.139783+00:00","invitato_da_member_id":null,"invito_token":"PROVA-SENZACODICE"}
]'::jsonb);

-- ═══ 2) ayly… — gli inviti di prova
insert into public.telegram_inviti
select * from jsonb_populate_recordset(null::public.telegram_inviti, '[
  {"token":"PROVA-in-giro-0001","ambiente":"test","invitante_member_id":"000004","invitante_persona_id":null,"invitante_chat_id":null,"invitante_etichetta":null,"partita":null,"creato_il":"2026-07-31T12:49:42.743665+00:00","scade_il":null,"annullato":false,"aperto_da_chat_id":null,"aperto_il":null,"usato_da_chat_id":null,"usato_il":null,"esito":null},
  {"token":"PROVA-usato-0002","ambiente":"test","invitante_member_id":"000004","invitante_persona_id":null,"invitante_chat_id":null,"invitante_etichetta":null,"partita":null,"creato_il":"2026-07-29T14:49:42.743665+00:00","scade_il":null,"annullato":false,"aperto_da_chat_id":900000002,"aperto_il":"2026-07-29T14:49:42.743665+00:00","usato_da_chat_id":900000002,"usato_il":"2026-07-29T14:49:42.743665+00:00","esito":"abilitato"},
  {"token":"PROVA-ritirato-0003","ambiente":"test","invitante_member_id":"000029","invitante_persona_id":null,"invitante_chat_id":null,"invitante_etichetta":null,"partita":null,"creato_il":"2026-07-30T14:49:42.743665+00:00","scade_il":null,"annullato":true,"aperto_da_chat_id":null,"aperto_il":null,"usato_da_chat_id":null,"usato_il":null,"esito":null},
  {"token":"PROVA-SENZACODICE","ambiente":"test","invitante_member_id":null,"invitante_persona_id":"aaaa1b1b-0000-4000-8000-00000000b1b0","invitante_chat_id":900000011,"invitante_etichetta":"Prova Passo1b","partita":null,"creato_il":"2026-08-01T14:46:46.785506+00:00","scade_il":null,"annullato":false,"aperto_da_chat_id":900000013,"aperto_il":"2026-08-01T15:46:46.785506+00:00","usato_da_chat_id":900000013,"usato_il":"2026-08-01T15:46:46.785506+00:00","esito":"abilitato"}
]'::jsonb);

-- ═══ 3) cudi… (Padel Match Organizer TEST) — le tre schede finte in anagrafica
-- ⚠️ Sono state TOMBSTONATE (deleted=true), non cancellate: è il modo in cui l'app
-- stessa cancella un socio, e serve perché la copia nel browser dello staff si
-- allinei invece di ricrearle al primo sync. Quindi qui si RIACCENDONO.
update public.pmo_cloud_records
   set deleted = false, updated_at = now(), synced_at = now()
 where local_key in ('phone:393500000011','phone:393500000012','phone:393500000013');

-- Se invece le righe non ci fossero più affatto, si ricreano così:
-- insert into public.pmo_cloud_records (local_key, record_type, deleted, payload)
-- values
--  ('phone:393500000011','member',false,'{"id":"aaaa1b1b-0000-4000-8000-00000000b1b0","name":"Prova Passo1b","firstName":"Prova","surname":"Passo1b","email":"393500000011@nomail.padelvillage.club","phone":"+393500000011","level":0.5,"active":true,"gender":"M","guestJolly":false,"importedFrom":"collaudo-passo1b-20260802","createdAt":"2026-08-02T09:00:00.000Z","updatedAt":"2026-08-02T09:00:00.000Z"}'::jsonb),
--  ('phone:393500000012','member',false,'{"id":"aaaa1b1b-0000-4000-8000-00000000b1b1","name":"Prova Attivata","firstName":"Prova","surname":"Attivata","memberId":"009998","email":"393500000012@nomail.padelvillage.club","phone":"+393500000012","level":0.5,"active":true,"gender":"F","guestJolly":false,"importedFrom":"pannello-senzacodice-20260802"}'::jsonb),
--  ('phone:393500000013','member',false,'{"id":"aaaa1b1b-0000-4000-8000-00000000b1b2","name":"Prova ConPmo","firstName":"Prova","surname":"ConPmo","memberId":"PMO-009999","email":"393500000013@nomail.padelvillage.club","phone":"+393500000013","level":0.5,"active":true,"gender":"M","guestJolly":false,"importedFrom":"pannello-senzacodice-20260802"}'::jsonb);
