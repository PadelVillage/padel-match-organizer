# Piano tecnico — Autoapprendimento assistente (regole + Gemini)

> Documento di progetto. Data: 2026-06-18.
> Stato: **Fase 1 (cattura) COSTRUITA e verificata in TEST** (vedi nota sotto).

> ## ⚙️ Aggiornamenti post-verifica (2026-06-18)
>
> **Fatto (Fase 1, solo TEST, solo cattura — nessuna auto-applicazione):**
> - Tabella `pmo_ai_turns` su Supabase TEST (diario turni chat+manuale con esito).
> - Logging chat in `PMOAi` (`_logInteraction`) con esiti `confirmed`/`reformulated`/`reported`; non bloccante.
> - Logging manuale anagrafica (`saveMemberCard`→modifica, `toggleMemberActive`→disattiva/riattiva) via `PMOAi.logManual`.
> - Vista osservabile nel pannello *Assistente AI* ("📊 Autoapprendimento — diario turni").
> - Guardrail verificati: harness anagrafica 55/55, prenotazioni 70/71 (invariati).
>
> **Correzioni alle sezioni sotto (emerse dall'esplorazione del codice):**
> 1. §5 — "Tab Addestramento" **non è un tab separato**: è il **sandbox esistente** in `#assistanteAI` (`index.html:7165`). La vista del diario è stata aggiunta lì.
> 2. §2 — **parte del lessico è già data-driven**: i sinonimi degli intenti top-level vivono in `PARSER_RULES` da config Supabase (`index.html:35055`) → aggiungibili **senza deploy**. Solo il lessico profondo (`_AUGMENT`, `_BOOK_VERB`, `_ppDialect`, i dict) è ancora hard-coded.
>
> **Da fare:** robustezza vocabolario anagrafica (buchi confermati live: `dammi i dati di X`, `aggiungi X` senza "socio", `iscrivi X`, cognomi-in-stoplist) + cattura prenotazioni manuali + Fasi 2-3.

## 0. Principio guida (il "freno")

L'autoapprendimento **non** è un'AI che riscrive il proprio codice in PROD.
È un **volano di dati**: il sistema osserva dove sbaglia → propone la correzione →
un umano (tu, o io in una sessione schedulata) approva → la correzione entra come
**dato** (non come deploy). Tre invarianti non negoziabili:

1. **Le regole deterministiche restano l'ancora di fiducia.** Gemini è solo il
   traduttore del fallback (confidence < 0.75 → stesso JSON). Mai scrive l'archivio.
2. **Nessun auto-merge in PROD.** Ogni cambiamento passa dagli harness offline
   (70/71 prenotazioni, 55/55 anagrafica) + revisione umana.
3. **Si impara solo da esiti verificati** (conferme reali dell'utente), mai da
   input grezzi → difesa dall'avvelenamento.

---

## 1. Il segnale che oggi manca: l'ESITO del turno

Oggi logghiamo la frase (`pmo_parser_errors`) ma non **cosa è successo dopo**.
Il dato d'oro non è la frase, è l'esito:

| Esito | Come si rileva | Segnale |
|---|---|---|
| `confirmed` | l'utente conferma/esegue l'azione proposta | 👍 positivo |
| `cancelled` | l'utente preme annulla sulla proposta | 👎 negativo |
| `reformulated` | nuovo messaggio entro N sec che riformula lo stesso intento | 👎 negativo (debole) |
| `reported` | l'utente preme "Segnala" | 👎 esplicito |
| `abandoned` | nessuna azione entro la sessione | neutro/debole |

Con l'esito loggato, il sistema sa **da solo** quali frasi sono andate male,
senza che nessuno le segnali a mano.

### 1.1 Schema tabella `pmo_ai_turns` (TEST per primo)

```sql
create table if not exists pmo_ai_turns (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  session_id    text,                 -- per raggruppare i turni di una conversazione
  user_id       text,                 -- staff loggato (per filtrare rumore di test)
  env           text not null default 'test',  -- 'test' | 'prod'
  domain        text not null,        -- 'prenotazione' | 'anagrafica'
  utterance     text not null,        -- frase utente normalizzata
  source        text not null,        -- 'rules' | 'gemini' (chi ha prodotto il JSON)
  confidence    numeric,              -- confidence delle regole (per capire la coda)
  parsed_json   jsonb,                -- output del parser (azione/campi)
  outcome       text,                 -- confirmed|cancelled|reformulated|reported|abandoned
  outcome_at    timestamptz,          -- quando si è risolto l'esito
  next_utterance text,                -- la riformulazione, se outcome=reformulated
  meta          jsonb default '{}'::jsonb
);

create index on pmo_ai_turns (env, domain, outcome);
create index on pmo_ai_turns (created_at desc);
```

> Nota: NON sostituisce `pmo_parser_errors` (resta per le segnalazioni manuali con
> screenshot). `pmo_ai_turns` è il diario **completo** dei turni, non solo dei
> fallimenti. Si possono linkare via `meta.parser_error_id`.

### 1.2 Punti d'aggancio nel parser (alto livello)

- `PMOAi.parse(...)` → al ritorno, scrive una riga `pmo_ai_turns` con
  `source`, `confidence`, `parsed_json` (fire-and-forget, mai bloccante).
- `PMOAi.handle(...)` / UI di conferma → quando l'utente conferma/annulla,
  fa `UPDATE ... set outcome=?, outcome_at=now()` sull'ultimo turno della sessione.
- Rilevatore `reformulated`: se entro N secondi arriva un nuovo messaggio nello
  stesso dominio prima che il precedente sia `confirmed`, marca il precedente
  `reformulated` e salva `next_utterance`.
- Tutto **best-effort**: se il log fallisce, l'assistente funziona uguale.

---

## 2. Lessico data-driven (la leva più alta)

Oggi, per insegnare un termine nuovo ("variare", "porta", "scheda vuota"),
si editano regex in `index.html` e si deploya. Spostiamo il **lessico** in tabella:
imparare un termine = inserire una riga (niente deploy), e la riga può essere
**proposta in automatico** dai log e **approvata** da te nel tab Addestramento.

### 2.1 Schema tabella `pmo_lessico`

```sql
create table if not exists pmo_lessico (
  id          bigint generated always as identity primary key,
  domain      text not null,          -- 'prenotazione' | 'anagrafica'
  kind        text not null,          -- 'verbo'|'campo'|'sinonimo'|'valore'
  surface     text not null,          -- come lo scrive l'utente ("variare","porta")
  maps_to     text not null,          -- intento/campo canonico ("modifica_orario","campo")
  value       text,                   -- valore canonico opzionale (per kind='valore')
  status      text not null default 'proposed', -- 'proposed'|'approved'|'rejected'
  source      text not null default 'manual',   -- 'manual'|'auto'|'gemini-distill'
  confidence  numeric,
  examples    jsonb default '[]'::jsonb,  -- frasi d'esempio che lo motivano
  created_at  timestamptz not null default now(),
  approved_by text,
  approved_at timestamptz,
  unique (domain, kind, surface)
);

create index on pmo_lessico (domain, status);
```

### 2.2 Aggancio nel parser

- All'avvio (o con cache TTL breve), `PMOAi` fa una `select` delle righe
  `status='approved'` e costruisce mappe in memoria
  (`verboMap`, `campoMap`, `sinonimoMap`, …).
- `_enrichInterpret` / `_anaInterpret` consultano **prima** le mappe da DB,
  poi le regex hard-coded come fallback. Così il lessico cresce senza deploy.
- **Parità form manuale ↔ chat:** stessa mappa usata anche dalla validazione
  manuale (coerente con [[feature-parity-assistente-manuale]]).

### 2.3 Guardrail lessico

- Solo righe `approved` entrano nel parser. `proposed` resta in panchina finché
  non la confermi nel tab Addestramento.
- Ogni proposta porta con sé gli `examples` (le frasi reali che la motivano) →
  decidi guardando i casi veri, non in astratto.

---

## 3. Test set che si auto-accresce (memoria anti-regressione)

Ogni segnalazione **risolta** e ogni esito `confirmed` interessante diventa un
**caso d'oro** negli harness offline (`input → output atteso`).
È già ciò che facciamo a mano (55/55 anagrafica, 70/71 prenotazioni): va solo
formalizzato.

- Fonte: `pmo_ai_turns` (esiti confermati) + `pmo_parser_errors` (report risolti).
- Formato: stesso degli harness attuali
  (`test/parser-anagrafica-test.html`, `test/parser-test.html`).
- Regola: **un bug risolto = un caso permanente**. Il sistema non ripete un
  errore passato perché l'harness lo cattura prima del merge.

---

## 4. Distillazione Gemini → regole (coda lunga sotto controllo)

Quando Gemini gestisce bene un fallback **e l'utente conferma**, salviamo la
coppia `(frase → JSON)` in `pmo_ai_turns` (già previsto, `source='gemini'`,
`outcome='confirmed'`).

- I pattern che **ricorrono spesso** vengono proposti come righe di `pmo_lessico`
  o come nuovi casi-regola → smetti di pagare/aspettare Gemini su quel pattern,
  e diventa **deterministico e verificabile**.
- Gemini resta solo sulla **coda lunga** (frasi rare). Effetto collaterale buono:
  costo e latenza Gemini calano nel tempo.

---

## 5. Tab Addestramento (la UI di revisione, oggi solo-TEST)

Da pannello-vetrina a **cruscotto di revisione**. Tre liste:

1. **Frasi non capite questa settimana** — da `pmo_ai_turns` con esito negativo,
   raggruppate per similarità. Per ognuna: "che intento era?" → genera una
   proposta `pmo_lessico`.
2. **Proposte di lessico in attesa** (`status='proposed'`) — con gli esempi.
   Bottoni: **Approva** / **Rifiuta** / **Modifica**.
3. **Casi d'oro candidati** — esiti confermati interessanti da promuovere a test.

Mock testuale del flusso:

```
┌ Addestramento ──────────────────────────────────────────────┐
│ ▸ Non capite (12)   ▸ Proposte lessico (5)   ▸ Casi d'oro (8)│
├──────────────────────────────────────────────────────────────┤
│ Proposta #1  [auto]  dominio: anagrafica                     │
│   "porta il livello a 5"  →  campo=livello, azione=imposta   │
│   visto 4 volte · ultima ieri                                │
│   esempi: «portami il livello…», «porta livello di Anna…»    │
│   [ Approva ]  [ Modifica ]  [ Rifiuta ]                     │
└──────────────────────────────────────────────────────────────┘
```

> Tutto resta dietro il permesso `assistanteAI` e `PMO_IS_TEST_ENV`
> finché non decidi di promuoverlo (coerente con [[staff-section-visibility-roles]]).

---

## 6. Routine schedulata Fase 3 (il "si migliora da solo", col freno)

Un agente Claude Code schedulato (es. ogni domenica) che:

1. Legge i fallimenti della settimana da `pmo_ai_turns` (TEST).
2. Li raggruppa per similarità.
3. Propone righe `pmo_lessico` (`status='proposed'`) e/o nuovi casi-regola.
4. **Li testa contro gli harness offline** — scarta tutto ciò che causa regressioni.
5. Apre una **PR** (branch `train-*`, mai diretta su main) con il riepilogo:
   "queste 12 frasi non le ho capite, ecco le righe che le sistemerebbero,
   harness 70/71→71/71".
6. **Tu approvi** (o io in sessione). Niente entra in PROD senza il tuo OK.

Strumenti già disponibili: skill `schedule` / `mcp__scheduled-tasks__*` per il cron;
guard-main impone già branch dedicati (≤15 file, no delete) → coerente con
[[prod-promotion-process]] e [[promote-test-preview-prod-2026-06]].

---

## 7. Roadmap consigliata (valore/rischio)

| Fase | Cosa | Sblocca | Rischio | Deploy? |
|---|---|---|---|---|
| **0** | Ogni report risolto → caso negli harness | memoria anti-regressione | ~0 | no (già in corso) |
| **1** | Logging **esito** in `pmo_ai_turns` | tutto il resto | basso | sì (solo log, non bloccante) |
| **2** | Tabella `pmo_lessico` + parser la legge + tab Addestramento | **vero** auto-miglioramento | medio | sì (TEST) |
| **3** | Routine schedulata che propone PR | "si migliora da solo" | medio (col freno PR) | sì (TEST → PR) |

**Primo passo ad alto rendimento / basso rischio:** Fase 1 (logging esito) +
Fase 2 (lessico in tabella). Insieme rendono il sistema capace di dirti:
*"queste 12 frasi questa settimana non le ho capite, ecco le righe di lessico
che le sistemerebbero."*

---

## 8. Domande aperte da decidere prima di scrivere codice

1. **Dove logghiamo l'esito** — solo TEST all'inizio, o anche PROD in sola lettura
   (più dati veri, ma serve gating `env`)? *Proposta: TEST prima, PROD dopo la Fase 1 validata.*
2. **Quale progetto Supabase** ospita `pmo_ai_turns`/`pmo_lessico` — quello TEST
   (cfr. [[deploy-topology-test-prod]]). Va deciso anche RLS (probabile RPC-only,
   cfr. [[pmo-cloud-records-realtime-rls]]).
3. **Soglia "ricorre spesso"** per promuovere Gemini→regola (es. ≥3 occorrenze).
4. **Privacy/rumore**: filtrare i turni fatti dall'utente di test
   ([[test-login-credentials]]) per non avvelenare le proposte.

---

*Collegato a:* [[ai-assistant-pmoai]] · [[parser-rules-A-I-test]] ·
[[parser-anagrafica-A-I]] · [[ai-segnalazioni-workflow]] ·
[[parser-reports-screenshot-storage]]
