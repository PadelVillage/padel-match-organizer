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
| **`rls_auto_enable()`** | 🔴 **event trigger `ensure_rls`**: accende l'RLS da sola su ogni tabella nuova in `public`. **Su PROD NON c'è** — vedi sotto |

---

## 🔴 La scoperta che pesa più della voce: la rete di sicurezza sta dalla parte sbagliata

`rls_auto_enable()` è agganciata su TEST all'event trigger **`ensure_rls`** (`ddl_command_end`,
abilitato): ogni tabella creata in `public` si ritrova l'RLS acceso **da sola**. Su **PROD quel
trigger non esiste** — ci sono solo i sei di sistema (pgrst, graphql, cron, net).

**E ha già morso.** Su PROD, oggi, due tabelle in `public` senza RLS:

| tabella | righe | RLS | permessi ad `anon` |
|---|---|---|---|
| `pmo_bkp_ospite_20260809` | **699** | ❌ | SELECT, INSERT, UPDATE, DELETE, TRUNCATE |
| `pmo_bkp_kb_livello_20260809` | 1 | ❌ | SELECT, INSERT, UPDATE, DELETE, TRUNCATE |

Non è una mia deduzione: sono i **due soli `ERROR`** del linter di Supabase su PROD
(`rls_disabled_in_public`). Le altre tabelle-copia dello stesso giorno — `_pmo_riassegnazione_*` —
l'RLS ce l'hanno; queste due no.

⚖️ **Sono copie di sicurezza del lavoro «Ospite» del 9/08** — lo stesso in cui «elimina tutto»
avrebbe buttato **€ 7.937** di incassi. La rete messa sotto a quel lavoro è, oggi, l'unica cosa
scoperta del progetto.

🚨 **Cosa NON è stato fatto**: nulla. Accendere l'RLS su PROD è una **modifica alla produzione** e
la decide il committente. È la voce **35**.

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
