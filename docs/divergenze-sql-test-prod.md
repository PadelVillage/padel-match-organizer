# Funzioni SQL: cosa diverge fra `qqbf…` (PROD) e `cudi…` (TEST)

**Misurato il 14/08/2026** (voce 33), schema `public`, sui due progetti.
Ripetibile in due query — vedi *Come si rifà la misura* in fondo.

⚠️ **Queste funzioni non hanno sorgente in git.** Vivono solo nel database, quindi
`guard-worker-sync` — che sorveglia il repo — **non le vede**. Questo file è l'unico posto dove
sta scritto cosa è voluto e cosa no. Se qualcuno le cambia senza aggiornarlo, torna il buio.

## Il quadro

| | |
|---|---|
| funzioni su PROD | **64** |
| funzioni su TEST | **62** |
| in comune | 58 |
| **identiche** (a meno di spazi) | **53** |
| **divergenti davvero** | **5** |
| solo su PROD | 6 |
| solo su TEST | 4 |

🚨 **Confrontare le impronte grezze mente.** Al primo giro le divergenti risultavano **28**: su TEST
molte funzioni sono **imbottite di migliaia di spazi** dopo `AS $function$` — `pmo_get_staff_users_admin`
è 27.181 caratteri contro 899, cioè **30 volte**, e il codice è lo **stesso**. Ventitré divergenze su
ventotto erano aria. ⇒ Si confronta sempre **normalizzando gli spazi**:
`md5(regexp_replace(pg_get_functiondef(oid), '\s+', '', 'g'))`.

---

## Le 5 divergenze vere

| funzione | cosa cambia | verdetto |
|---|---|---|
| **`pmo_dispatch_data_routines`** | TEST: slot fissi, prenotazioni 5×/giorno. PROD: slot solo per i clienti + ramo `else` che fa `bookings_live` a ogni giro | ✅ **voluta** — è la voce 32, calendario di TEST congelato per scelta. **Non allineare**: il ritmo di PROD è parità, e la parità costa sul worker condiviso |
| **`pmo_admin_pin_ok`** | PROD: `search_path = public, extensions` e `crypt(...)`. TEST: `search_path = public` e `extensions.crypt(...)` | ✅ **innocua** — due modi di risolvere lo stesso nome. Equivalenti, entrambe con `search_path` fissato |
| **`get_assessment_tokens_admin`** | PROD `from public.assessment_tokens`, TEST `from assessment_tokens` | ✅ **innocua** — entrambe hanno `search_path = public`. Quella di PROD è di stile migliore |
| **`pmo_assegna_codici_mancanti`** | **solo commenti**: TEST porta la spiegazione del 9/08 (perché il progressivo si prende dal massimo VERO, e perché chi non ha telefono resta senza codice); PROD è nuda | ⚠️ **da sanare al contrario** — qui la copia **buona è quella di TEST**. Il «perché» andrebbe portato su PROD, non tolto da TEST |
| **`upsert_assessment_tokens_admin(p_admin_pin, p_tokens)`** | PROD legge il PIN da `admin_settings.assessment_admin_pin_hash`; `pmo_admin_pin_ok` lo legge invece da `assessment_admin_config` | 🔴 **da guardare** — due depositi diversi per lo stesso PIN nello stesso progetto. Non è TEST-vs-PROD: è un'**incoerenza interna a PROD** |

---

## Le 10 presenti da una parte sola

### Solo su PROD — 6

| funzione | perché, per quanto si capisce |
|---|---|
| `pmo_dispatch_anagrafica_report(p_preview)` | serve il cron `pmo-anagrafica-report-telefoni-prod` (jobid 12), che su TEST non c'è ✅ |
| `pmo_dispatch_maestri_allineamento()` | serve il cron `pmo-maestri-allineamento-prod` (jobid 13), idem ✅ |
| `pmo_dispatch_assessment_followup_email_prod(p_now)` | il dispatcher email di PROD — cron **spento** (jobid 4) ⚠️ residuo del canale email smontato il 13/08, come la voce 29 |
| `assessment_level_to_numeric`, `get_assessment_token`, `submit_self_assessment` | aiutanti dell'autovalutazione mai arrivati su TEST ⚠️ da capire se servono ancora |

### Solo su TEST — 4

| funzione | perché, per quanto si capisce |
|---|---|
| `pmo_anagrafica_cron_key()` | serve al cron `pmo-anagrafica-mirror-test` (jobid 14, **acceso**), che specchia l'anagrafica **da PROD**. ✅ È il motivo per cui su TEST i soci sono vivi mentre il calendario è fermo |
| `pmo_dispatch_assessment_email_routines(p_now)` | dispatcher email — cron **spento** (jobid 6) ⚠️ residuo del canale smontato |
| `pmo_dispatch_assessment_email_single_test_0900()` | idem, e nasce già come funzione di prova ⚠️ residuo |
| **`rls_auto_enable()`** | ✅ **event trigger `ensure_rls`**: accende l'RLS da sola su ogni tabella nuova in `public`. **Su PROD mancava**; installata lì il 14/08 chiudendo la voce 35 ⇒ oggi le due copie sono identiche (impronta `2ab30ec5…`) — vedi sotto |

---

## ✅ La scoperta che pesava più della voce: la rete di sicurezza stava dalla parte sbagliata — sanata il 14/08

`rls_auto_enable()` è agganciata su TEST all'event trigger **`ensure_rls`** (`ddl_command_end`,
abilitato): ogni tabella creata in `public` si ritrova l'RLS acceso **da sola**. Su **PROD quel
trigger non esiste** — ci sono solo i sei di sistema (pgrst, graphql, cron, net).

**E ha già morso.** Su PROD, oggi, due tabelle in `public` senza RLS:

| tabella | righe | RLS il 13/08 | RLS dal 14/08 | permessi ad `anon` |
|---|---|---|---|---|
| `pmo_bkp_ospite_20260809` | **699** | ❌ | ✅ | SELECT, INSERT, UPDATE, DELETE, TRUNCATE (muti: la porta è chiusa a monte) |
| `pmo_bkp_kb_livello_20260809` | 1 | ❌ | ✅ | SELECT, INSERT, UPDATE, DELETE, TRUNCATE (idem) |

Non è una mia deduzione: sono i **due soli `ERROR`** del linter di Supabase su PROD
(`rls_disabled_in_public`). Le altre tabelle-copia dello stesso giorno — `_pmo_riassegnazione_*` —
l'RLS ce l'hanno; queste due no.

⚖️ **Sono copie di sicurezza del lavoro «Ospite» del 9/08** — lo stesso in cui «elimina tutto»
avrebbe buttato **€ 7.937** di incassi. La rete messa sotto a quel lavoro è, oggi, l'unica cosa
scoperta del progetto.

✅ **Cosa è stato fatto, il 14/08, dopo la sua conferma esplicita** — la voce 35 è chiusa:

1. **RLS accesa** sulle due tabelle, senza policy. Verificato ruolo per ruolo (`set local role`
   dentro transazione, poi `rollback`): `anon` **0 e 0**, `authenticated` **0 e 0**,
   `service_role` **699 e 1**. Il linter di PROD è passato da **2 `ERROR` a ZERO**.
2. **`ensure_rls` installata anche su PROD**, copia verbatim di TEST — impronta normalizzata
   `2ab30ec5481ea9c5e18a2fa2e2d75e94` **uguale sui due progetti**, stessi tag, stesso
   proprietario. Provata sul vivo: una `create table` dentro una transazione poi annullata
   nasce con `relrowsecurity = true` da sola.
3. **Coda inattesa**: installato il trigger, il linter ha alzato due WARN nuovi —
   `rls_auto_enable()` era eseguibile da `anon` via RPC, e **provando si è visto che la
   chiamata riusciva davvero**. Portata reale nulla (nessun argomento, e fuori dal contesto
   di event trigger il ciclo gira a vuoto), ma è `SECURITY DEFINER`: `EXECUTE` revocato a
   `public`, `anon` e `authenticated` **su entrambi i progetti** — su TEST l'ACL era identica
   e quei due WARN ci stavano da sempre, nessuno li aveva mai guardati. Ora da `anon`:
   `42501 : permission denied`.

⚠️ **Da ricordare d'ora in poi**: ogni tabella nuova in `public` su PROD nasce con RLS e senza
policy, cioè **invisibile ad `anon` e `authenticated`**. Se una tabella nuova deve essere letta
col ruolo pubblico, la policy va scritta a mano. Le edge non ne risentono: usano `service_role`.

📌 **Nota emersa misurando**: la migrazione che creò `pmo_bkp_ospite_20260809`
(`20260809134440_bkp_ospite_prima_dello_spostamento_20260809`) risulta a registro **su Supabase
ma non ha un file nel repo**. Non è un guasto — è però il modo esatto in cui una tabella entra in
produzione senza che nessuno la riveda.

---

## 🗂️ Le MIGRAZIONI: i rami divergono, ma il registro diverge di più — misurato il 30/08/2026

Il passaggio di consegne portava da giorni una riga sola: *«`supabase/migrations/` diverge fra i
rami: **8 file**, nessuna guardia. ⛔ Non è una voce: se la si vuole, la prima cosa è misurarla»*.
Misurata. **L'8 è vero e non è il problema.**

### ① La divergenza fra i rami: 8 file, e nessuno diverso nel CONTENUTO

| | |
|---|---|
| solo su `main` | `voce47_revoca_get_assessment_token_da_anon` · `voce47_revoca_famiglia_pin_da_anon` |
| solo su `test-preview` | `pmo_get_records_admin_page_stable_order` · `togli_le_tre_policy_decorative_anon` · `chiudi_policy_anonime_feedback_post_partita_test` · `voce60_circoli_esterni_tabella` · `voce60_alias_max_padel` · `voce60_marco_polo_fuori` |
| file presenti su entrambi ma **diversi dentro** | **nessuno** |

⇒ È presenza/assenza, non drift di contenuto. `guard-worker-sync` non le guarda, e questo pezzo da
solo non giustificherebbe una guardia.

### ② 🚨 IL REGISTRO E LA CARTELLA SONO DUE LISTE DIVERSE, ed è la misura vera

| | file in git | applicate sul database | in comune (per nome) |
|---|---|---|---|
| `main` → PROD `qqbf…` | **49** | **46** | **30** |
| `test-preview` → TEST `cudi…` | **53** | **49** | — |

Su `main` ci sono **19** nomi che nel registro di PROD non compaiono, e **16** migrazioni applicate
a PROD **senza un file** che le porti. Buona parte è storia — il registro di PROD comincia il
7/05/2026 e prima si passava dall'editor SQL o da `supabase/manual-sql/` — ma il punto resta: *la
cartella non è l'elenco di ciò che è stato applicato, e non lo è mai stata.*

🚨⭐⭐ **E LA SONDA OVVIA MENTE, in tutt'e due i versi.** Chiedendo al registro le **versioni** dei due
file `voce47_*` la risposta è **«nessuna applicata su PROD»**; chiedendo gli stessi due per **nome**
la risposta è **«applicate tutte e due»** — versioni `20260816111339` e `20260816112912`, mentre i
file si chiamano `…113000` e `…115500`. ⇒ Applicando via MCP la versione **nasce nell'istante
dell'applicazione**, non dal nome del file, ed è lo stesso fatto già pagato dalla voce 109 (*la data
del commit non è la data dell'applicazione*) visto dall'altro lato. 📌 *Un confronto fra cartella e
registro si fa sui NOMI; le versioni non sono la stessa grandezza sulle due liste.*
⚠️ E nemmeno i nomi bastano da soli: sul ramo c'è `ai_propose_lexicon_cron`, nel registro
`ai_propose_lexicon_dispatcher` — stessa cosa, due nomi. Una guardia meccanica qui sarebbe rumorosa,
ed è la ragione per cui **non** se ne propone una.

### ③ ✅ La domanda che conta — «c'è un buco?» — e la risposta è NO, misurata

Le due migrazioni che stanno **solo** su `main` sono **revoche di sicurezza** (`REVOKE EXECUTE …
FROM anon, PUBLIC` sulla famiglia col PIN e su `get_assessment_token`). Sembrava che TEST — che ha
gli **stessi soci veri** — ne fosse scoperto. Non lo è:

· su TEST le firme col PIN risultano **già revocate** ad `anon` (`has_function_privilege` = `false`),
  identiche a PROD, benché **nessuna** delle 49 migrazioni di TEST lo faccia;
· `get_assessment_token(text)` su TEST **non esiste proprio** ⇒ non c'è niente da revocare, e
  l'assenza di quella migrazione da `test-preview` è **giusta**, non una dimenticanza;
· le firme **senza** PIN restano eseguibili da `anon` su entrambi, ed è voluto: si chiudono dentro,
  su `pmo_current_staff_profile()`.

⚠️ **Una differenza vera c'è, ed è latente**: PROD concede ad `anon` **più permessi di tabella** di
TEST — `SELECT`+`INSERT`+`UPDATE` su `self_assessments` e su `assessment_tokens`, contro il solo
`SELECT` (su `assessment_tokens`) e nessun `SELECT` (su `self_assessments`) di TEST.
✅ **Ma la porta è chiusa lo stesso, e non è dedotto**: RLS è **accesa** su entrambe le tabelle con
**zero policy**, e la prova è stata fatta col ruolo `anon` vero, dall'esterno —
`GET /rest/v1/self_assessments` e `/assessment_tokens` su PROD tornano **HTTP 200 con `[]`**.
🚨 ⇒ Quei permessi sono **una chiave per una porta chiusa a chiave**: oggi non aprono niente, e il
giorno in cui qualcuno scrivesse una `create policy … using (true)` aprirebbero **PROD e non TEST**.
È il motivo per cui vanno scritti qui invece che archiviati come «tutto a posto».

📌 **Verdetto: non è una voce.** È disallineamento di contabilità, non di comportamento: i due
database fanno la stessa cosa dove conta, e l'unico residuo è una concessione inerte su PROD.

---

## Come si rifà la misura

```sql
-- su ENTRAMBI i progetti, poi si diffano le due liste
select p.proname||'('||pg_get_function_identity_arguments(p.oid)||')|'
    || md5(regexp_replace(pg_get_functiondef(p.oid), '\s+', '', 'g'))
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
order by p.proname;

-- la rete di sicurezza: chi ha l'event trigger, e quali tabelle restano scoperte
select evtname, evtenabled from pg_event_trigger;
select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
```

📌 Da rifare **dopo ogni lavoro che tocchi funzioni SQL**, e comunque quando si sospetta un
disallineamento: è l'unico controllo che esista su questo piano.
