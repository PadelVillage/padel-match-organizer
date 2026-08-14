-- 🛡️ `ensure_rls` ANCHE SU PROD — la rete di sicurezza torna dalla parte giusta (voce 35 ③, 14/08/2026)
--
-- IL FATTO: l'event trigger che accende l'RLS da sola su ogni tabella nuova esisteva
-- **solo su TEST**. Su PROD c'erano i 6 event trigger di serie di Supabase (`issue_*`,
-- `pgrst_*`) e nient'altro — misurato su `pg_event_trigger`, non dedotto.
-- ⇒ È il motivo per cui il 9/08 le due copie «Ospite» sono nate scoperte: nessuno le ha
-- dimenticate, semplicemente **non c'era niente che le coprisse**. Accendere l'RLS su
-- quelle due (migrazione sorella) chiude il buco di ieri; questo chiude quello di domani.
--
-- ⚖️ RISCHIO MISURATO, non stimato: nessuna funzione SQL di PROD crea tabelle a runtime
-- (`pg_proc.prosrc ~* 'create .* table'` fuori dagli schemi di sistema: **zero righe**).
-- Quindi questo trigger scatta solo su DDL fatto a mano o da una migrazione — mai in
-- mezzo al traffico dell'app.
--
-- ⚠️ EFFETTO DA RICORDARE: da adesso ogni tabella nuova in `public` nasce con RLS e
-- **senza policy**, cioè invisibile ad `anon` e `authenticated`. Se una tabella nuova deve
-- essere letta dall'app col ruolo pubblico, la sua policy va scritta esplicitamente. Le
-- edge non ne risentono: usano `service_role`, che scavalca l'RLS.
-- 📌 Il trigger fallisce chiuso e silenzioso: l'`EXCEPTION WHEN OTHERS` scrive nel log e
-- lascia passare il DDL, quindi non può bloccare una migrazione.
--
-- 🔁 Copia VERBATIM da TEST (`cudi…`), corpo identico carattere per carattere: i due
-- progetti devono restare confrontabili, ed è esattamente ciò che la voce 33 misurava.
-- ✅ Impronta normalizzata uguale sui due progetti dopo l'installazione:
--    `2ab30ec5481ea9c5e18a2fa2e2d75e94` — stessi tag, stesso proprietario (`postgres`).
-- ✅ E provato sul vivo: `create table` dentro una transazione con `rollback` ⇒ la tabella
--    nasce con `relrowsecurity = true` senza che nessuno gliel'abbia detto.
--
-- ↩️ Reversibile: `drop event trigger ensure_rls;` (la funzione può restare, è inerte).

create or replace function public.rls_auto_enable()
 returns event_trigger
 language plpgsql
 security definer
 set search_path to 'pg_catalog'
as $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

drop event trigger if exists ensure_rls;

create event trigger ensure_rls
  on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function public.rls_auto_enable();
