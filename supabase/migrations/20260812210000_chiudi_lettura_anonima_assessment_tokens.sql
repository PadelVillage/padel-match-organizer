-- 🔒🚨 CHIUDE LA LETTURA ANONIMA DI `assessment_tokens` (12/08/2026)
--
-- IL FATTO, misurato dall'esterno e non dedotto: con la sola chiave pubblica che sta in
-- `app.padelvillage.club/config.js` — scaricabile da chiunque — una GET su
-- `/rest/v1/assessment_tokens` rispondeva `206` con `content-range: 0-0/1364`.
-- Cioè: **1364 righe leggibili senza autenticarsi**, e non solo i token —
-- `member_name` (1364 righe piene), `phone_last4` (1357), `member_local_id`.
-- ⇒ Era l'elenco dei soci del circolo, con nome e cognome, alla portata di chiunque.
--
-- 🎯 E il token non è un dato qualsiasi: è la CHIAVE della scheda di autovalutazione.
-- Chi ce l'ha può inserire una scheda in `self_assessments` (INSERT anonimo permesso, e
-- resta permesso finché il punto 2 non sposta la correzione sul server), e il cron
-- `pmo-assessment-apply-level-prod` la applica entro 15 minuti. Con l'elenco dei token
-- in mano, il muro «senza livello non si organizza» si scavalcava dall'esterno.
-- 🚨 I token non scadono: `expires_at` è NULL su tutte e 1364, i più vecchi sono di aprile.
--
-- ⚖️ PERCHÉ SI PUÒ TOGLIERE SENZA ROMPERE NIENTE — verificato, non supposto:
--   · nel gestionale non c'è **nessuna** chiamata REST diretta a questa tabella: tutti gli
--     accessi dello staff passano da `get_assessment_tokens_admin` /
--     `upsert_assessment_tokens_admin` (RPC, permesso `cloud_sync`);
--   · le 663 GET viste nei log delle ultime 24 ore vengono TUTTE dalle edge
--     (`Deno/SupabaseEdgeRuntime`) — `consumer-assessment-link` e compagne usano
--     `SUPABASE_SERVICE_ROLE_KEY`, che **scavalca RLS**: queste policy non le riguardano.
--     (In `assessment-email-send` la chiave pubblica serve solo a validare il JWT dello
--     staff, non a leggere dati.)
--   · l'unico chiamante non-edge in 24 ore era la sonda con cui ho misurato il buco.
-- ⚠️ La finestra dei log è di 24 ore: se un giorno qualcosa di raro si rompesse qui,
--   questo è il primo posto da guardare.
--
-- ⛔ NON si tocca `public_update_token_completed`: è la sola transizione stretta
--   (`created`/`sent` → `completed`) e, chiusa la lettura, non è più utilizzabile da chi
--   un token non ce l'ha già. Si tolgono invece le due UPDATE a `USING (true)`, che
--   lasciavano modificare QUALSIASI riga — nome del socio compreso.

-- ── Lettura: via tutte e tre ────────────────────────────────────────────────────
drop policy if exists "Permetti lettura token autovalutazione" on public.assessment_tokens;
drop policy if exists "assessment_tokens_select_public"        on public.assessment_tokens;
drop policy if exists "public_read_active_tokens"              on public.assessment_tokens;

-- ── Scrittura indiscriminata: via le due senza condizioni ───────────────────────
drop policy if exists "Permetti aggiornamento token autovalutazione" on public.assessment_tokens;
drop policy if exists "assessment_tokens_update_public"              on public.assessment_tokens;
