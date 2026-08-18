-- ── LA SCELTA DEL SOCIO sulla propria prova — voce 61 § A ④ (19/08/2026) ──────────────
--
-- 🗣️ Sua regola del 17/08: «decidi tu a quale delle tre volte ti vuoi fermare». Fino a
-- oggi il livello lo applicava un automatismo da sé (cron `pmo-assessment-apply-level-prod`,
-- jobid 16, ogni 15′): nessuno chiedeva niente al socio, e la risposta non aveva nemmeno
-- una casella dove atterrare. Queste due colonne sono quella casella.
--
-- ⚖️ PERCHÉ SULLA SCHEDA E NON ALTROVE: la scelta è un fatto su UNA prova precisa — «di
-- questo esito qui, cosa vuoi fare?» — non uno stato del socio. Su una tabella a parte
-- servirebbe una chiave verso la scheda e un modo di tenerle allineate; qui la scelta muore
-- con la scheda a cui appartiene, che è esattamente la sua vita. È anche «il gestionale SA,
-- il bot DICE»: la scelta vive nel gestionale, non nella memoria di un bot che si riavvia.
--
-- 🔒 CHI SCRIVE: solo `consumer-assessment-decision`, col `service_role` e dietro il
-- segreto del ponte (`CONSUMER_BRIDGE_SECRET`). Nessuna policy nuova per `anon`: la tabella
-- ha già le sue, e queste colonne non cambiano chi può toccarla.
--
-- ⚠️ SI APPLICA A MANO, e nell'ordine: prima `cudi…` (TEST), poi `qqbf…` (PRODUZIONE) —
-- e la produzione vuole un ok separato del committente. 🚨 Va applicato PRIMA che il codice
-- che legge queste colonne arrivi sul progetto: `consumer-assessment-link` e
-- `assessment-apply-level` le chiedono nel `select`, e un `select` su una colonna che non
-- esiste fallisce l'intera lettura — il ponte risponderebbe 500 e il cron smetterebbe di
-- applicare qualunque livello. ⇒ Prima il DDL, poi il merge.
--
-- ⭐ È idempotente (`if not exists`): rilanciarlo non fa niente, e questo file resta la
-- fonte di com'è fatta la casella.

alter table public.self_assessments
  add column if not exists member_decision text,
  add column if not exists member_decision_at timestamptz;

comment on column public.self_assessments.member_decision is
  'Voce 61 ④: la scelta del socio su QUESTA prova — «mi_fermo» (tieni questo livello, e il '
  'giro si chiude) o «riprovo» (scarta: questa prova non si applica mai). Vuoto = non ha '
  'ancora risposto, e dopo 24 ore il silenzio vale assenso. La scrive solo '
  '`consumer-assessment-decision`, quando il socio tocca il bottone del bot.';

comment on column public.self_assessments.member_decision_at is
  'Quando il socio ha scelto. Da qui partono i 30 giorni quando la scelta è «mi_fermo»: '
  'non dalla prova — fra le due cose possono passare ore, e farli partire dalla prova '
  'regalerebbe tempo a chi tarda a rispondere.';

-- 🔎 Come si guarda dopo averlo applicato (deve dire 2):
--   select count(*) from information_schema.columns
--    where table_schema = 'public' and table_name = 'self_assessments'
--      and column_name in ('member_decision', 'member_decision_at');
