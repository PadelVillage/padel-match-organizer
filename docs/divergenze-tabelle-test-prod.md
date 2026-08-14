# Le TABELLE dei due progetti — divergenze misurate

**Misurato il 14/08/2026, 16ª sessione.** Voce 39. Gemello di
[`divergenze-sql-test-prod.md`](divergenze-sql-test-prod.md), che fece lo stesso lavoro sulle
**funzioni** con la voce 33: là il piano erano le funzioni SQL, qui sono le **tabelle**, e di
queste non se n'era mai accorto nessuno.

> 🔎 **Perché esiste questo file.** Fino a oggi le divergenze fra le tabelle si scoprivano **una
> alla volta, in produzione, quando qualcosa rispondeva 500**. Il 14/08 un'edge dell'autovalutazione
> è morta perché la `select` citava `member_email`, che c'è su PROD e non su TEST — e da lì nacque
> la riga *«guardare un solo database è scrivere metà query»*. Quella era una **campionatura di
> due**. Questo è il censimento.

## Come è stato misurato

Per ogni tabella di `public` (`relkind='r'`) su entrambi i progetti:

```sql
select c.relname,
       md5(string_agg(a.attname || ':' || format_type(a.atttypid,a.atttypmod), ',' order by a.attname))
```

Cioè **nome e tipo di ogni colonna**, ordinati per nome così l'ordine di dichiarazione non conta,
poi un'impronta. Due tabelle con la stessa impronta hanno le stesse colonne con gli stessi tipi.

⚠️ **Cosa questo NON misura, e va detto**: indici, vincoli, valori di default, trigger, RLS e
policy, e ovviamente il contenuto. Due tabelle qui dichiarate «identiche» possono avere trigger
diversi — ed è successo davvero: il trigger `trg_post_match_feedback_mark_token_completed`, che ha
avuto un ruolo nella voce 37, non comparirebbe in nessuna riga di questo documento.

## Il conto

| | |
|---|---|
| tabelle su **PROD** (`qqbf…`) | **25** |
| tabelle su **TEST** (`cudi…`) | **23** |
| in comune | **20** |
| ⇒ di cui **identiche** | **18** *(erano 17: la 18ª è stata sanata in giornata, sotto)* |
| ⇒ di cui **divergenti** | **2** *(erano 3)* |
| solo su PROD | **5** |
| solo su TEST | **3** |

## ✅ La divergenza sanata in giornata

### `pmo_parser_errors` — era PROD 9 colonne / TEST 14 · 🔴 **rompeva qualcosa in PRODUZIONE**

Su **TEST** ci sono cinque colonne in più, che insieme formano il flusso «segnalazione risolta»:
`origine`, `stato`, `risolto_il`, `risolto_in_versione`, `nota_risoluzione`.

🚨 **E l'app di PROD le usa lo stesso.** Dalla **PR #648 del 7/08/2026**, `index.html` su `main`:

- **scrive** sempre `origine` (`logParserError`, riga 38935: `origine: origine || 'auto'`);
- **legge** `stato, risolto_il, risolto_in_versione, nota_risoluzione` per il pannello «Le mie
  segnalazioni» (`_myReportsFetch`, riga 38283, filtro `origine=eq.manuale`).

Provato sul bersaglio, su PROD:

```
LETTURA di origine ............................. 42703 — column "origine" does not exist
LETTURA delle 4 colonne del pannello ........... 42703 — column "stato" does not exist
INSERT con origine ............................. 42703 — column "origine" ... does not exist
```

⇒ Su PROD **nessuna segnalazione del parser poteva essere registrata**, e il pannello «Le mie
segnalazioni» **non poteva caricare**: PostgREST rifiuta la colonna sconosciuta e la `fetch` alza
`HTTP 400`. Il fallimento della scrittura era **silenzioso** (`console.warn`, `return false`) — che
è il motivo per cui è rimasto lì dal 7/08 senza che nessuno se ne accorgesse.

⚖️ **Attenzione a non attribuirgli più di quel che è.** La tabella su PROD è ferma a **45 righe,
tutte del 16/06/2026** — cioè il silenzio **precede di quasi due mesi** questo disallineamento.
Avevo ipotizzato che fosse la causa: **la misura ha smentito l'ipotesi**. Sono due fatti distinti:
la tabella tace dal 16/06 per un motivo non ancora indagato, **e** dal 7/08 non avrebbe comunque
più potuto ricevere niente.

📌 È la forma della **voce 31** — codice promosso in PROD portandosi dietro l'idea dello schema di
TEST — e la forma della lezione del 14/08: *chi scrive per i due ambienti scrive
sull'**intersezione***. Qui si è scritto sull'unione.

#### ✅ Sanata il 14/08, con la sua autorizzazione — migrazione `20260814183100`

Scelta la strada che **allinea** invece di quella che mutila: le 5 colonne aggiunte a PROD,
**copiate verbatim da TEST** e non inventate — `stato` e `origine` `NOT NULL` con default
(`'aperta'`, `'auto'`), le altre tre libere. Indici e vincoli erano **già identici** fra i due
progetti, quindi non è stato toccato nulla lì.

| verifica | esito |
|---|---|
| lettura di `origine`, lettura delle 4 del pannello, INSERT nella forma **esatta** dell'app | tutte **riuscite** (l'insert in transazione annullata: 0 residui) |
| impronta delle colonne di PROD | ora **`6db832dc…`**, cioè **identica** a quella censita per TEST *prima* di toccare niente |
| end-to-end via **PostgREST** (`pg_net`, stessa URL e stessa chiave dell'app) | **400 `42703`** → **200 `[]`** |
| linter di PROD | **101 → 101**, `WARN` 83, `ERROR` 0 — nessuna variazione in nessun verso |
| le 45 righe storiche | intatte, ultima ancora del **16/06**; prendono i default `aperta`/`auto` e **non** compaiono nel pannello, che filtra `origine=eq.manuale` |

⚠️ **Resta aperta la domanda vera**: *perché* quella tabella tace dal 16/06. Questa migrazione
chiude il disallineamento, non il silenzio — e i due non erano lo stesso problema, per quanto
comodo sarebbe stato crederlo.

## Le 2 ancora divergenti

### 1. `self_assessments` — PROD 39 colonne, TEST 35

Su **PROD** in più: `email`, `consistency_score`, `inconsistency_reasons`, `review_note`.
Sono le quattro già viste il 14/08 nella 14ª sessione, quando fecero morire l'edge su TEST con un
500. Qui sono solo **confermate**: la campionatura diceva il vero.

### 2. `assessment_tokens` — 13 colonne da entrambe le parti, ma **non le stesse**

| | |
|---|---|
| solo su **PROD** | `member_email` |
| solo su **TEST** | `updated_at` |

🔎 **Questa è la scoperta che la campionatura non poteva fare.** La nota del 14/08 diceva
«`assessment_tokens.member_email` c'è su PROD e non su TEST», ed è vero — ma la divergenza va in
**tutte e due le direzioni**, e col solo conteggio delle colonne (13 = 13) sarebbe rimasta
invisibile. È il motivo per cui qui si confronta l'**impronta**, non il numero.

## Le 5 solo su PROD

| tabella | cosa è |
|---|---|
| `admin_settings` | 🔴 **la nomina una funzione viva** — vedi sotto |
| `_pmo_riassegnazione_20260809` | tabella di lavoro del 9/08, RLS accesa e senza policy con la **voce 35** |
| `_pmo_riassegnazione_20260811` | sorella della precedente, stesso trattamento |
| `pmo_bkp_kb_livello_20260809` | il backup salvato il 9/08 togliendo `autovalutazione_url` dalla kb |
| `pmo_bkp_ospite_20260809` | backup con la **stessa identica impronta** di `pmo_cloud_records` (`a2e34c92…`): è una copia strutturale, non una tabella a sé |

🔴 **`admin_settings` chiude un cerchio aperto dalla voce 33.** Quella voce aveva trovato che
`upsert_assessment_tokens_admin` legge il PIN da `admin_settings` mentre `pmo_admin_pin_ok` lo legge
da `assessment_admin_config`, e concludeva: *«due depositi per lo stesso PIN, e non è TEST-vs-PROD
ma un'incoerenza dentro PROD»*. Misurato ora dal lato tabelle:

- su **PROD**: `admin_settings` esiste, ed **esattamente una** funzione la nomina —
  `upsert_assessment_tokens_admin`;
- su **TEST**: la tabella **non esiste**, e **nessuna** funzione la nomina.

⇒ La conclusione della 33 regge, e si può dire meglio: **non sono due depositi in PROD e uno in
TEST — è un deposito in più che vive solo di là**, insieme all'unica funzione che lo legge. Chi un
domani sanerà il doppio PIN deve sapere che su TEST **non c'è niente da spostare**.

## Le 3 solo su TEST

`pmo_bookings`, `pmo_parse_history`, `pmo_parser_rules_versions`.

- **vuote** tutte e tre (0 righe);
- **zero riferimenti** in tutto il repo — né in `index.html` né nelle edge;
- su PROD **non esistono affatto**;
- portano le tre policy `ALL` per `anon` di cui parla la **voce 37** — che però sono **decorative**:
  ad `anon` mancano i grant di tabella, e la prova d'attacco risponde `42501` su tutto.

⇒ Profilo identico alle due tabelle chiuse con la **voce 35**: scoperte, morte, senza puntatori.

## Le 18 identiche

`assessment_admin_config`, `assessment_external_requests`, `booking_parses`, `pmo_ai_settings`,
`pmo_ai_turns`, `pmo_ai_usage`, `pmo_assessment_notifications`, `pmo_audit_log`,
`pmo_cloud_records`, `pmo_lessico`, `pmo_parser_config`, **`pmo_parser_errors`** *(dal 14/08)*,
`pmo_routine_runs`, `pmo_routine_skips`, `pmo_routines`, `pmo_staff_profiles`,
`post_match_feedback_responses`, `post_match_feedback_tokens`.

📌 Che siano identiche **nelle colonne** non vuol dire che siano uguali: `post_match_feedback_*`
hanno le stesse colonne di qua e di là, ma il 14/08 le policy anonime sono state tolte **solo su
PROD** (voce 37). La parità delle colonne e la parità dei permessi sono due cose diverse, e questo
documento misura la prima.

---

<sub>Misurato il 14/08/2026 nella 16ª sessione, dalla sessione cloud, leggendo `pg_class` e
`pg_attribute` sui due progetti. Nessuna scrittura: le prove che scrivono stavano in transazioni
annullate. Il file dichiara da sé cosa **non** ha guardato — indici, vincoli, default, trigger,
policy — perché un censimento che tace i propri confini è il modo in cui nasce la prossima
campionatura scambiata per misura.</sub>
