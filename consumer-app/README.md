# App consumer — login dei soci

> # ⛔️ `web/` NON è più la sorgente viva
>
> Dal **19/07/2026** il frontend è pubblicato su **https://soci.padelvillage.club** dal repo
> **[`PadelVillage/padel-match-assistant`](https://github.com/PadelVillage/padel-match-assistant)**,
> dove i file stanno nella **radice** (serve perché lo scope del service worker sia `/`).
>
> **Le modifiche al frontend vanno fatte lì.** I file in `web/` qui sotto sono una copia
> rimasta indietro: toccarli non cambia nulla di ciò che vedono i soci, ed è il modo esatto
> per ricreare il disallineamento che su questo progetto è già costato caro.
>
> Sono ancora qui solo perché `guard-main-prs.yml` vieta le PR verso `main` che cancellano
> file. Vanno tolti con una cancellazione deliberata, non di straforo.
>
> ⚠️ **Le edge function invece restano qui** (`edge-functions/`, più
> `consumer-identity-lookup` in `supabase/functions/`): quelle **non** sono duplicate, e
> questo è tuttora il loro unico posto. Vedi più sotto il perché.

Web app per i giocatori (vanilla zero-build multi-file). Questa cartella contiene la
**fetta verticale del login**: telefono → nome di battesimo → email confrontata → codice a
6 cifre → profilo agganciato. Il resto dell'app (prenotazioni, borsellino, partite aperte)
arriva dopo.

---

## ⚠️ Due progetti Supabase, due meccanismi di deploy

Questa cartella tocca **due** progetti. Confonderli è l'errore facile da fare qui.

| | Progetto | Cosa | Deploy |
|---|---|---|---|
| **Gestionale** | `padel-match-organizer` = `qqbfphyslczzkxoncgex` | l'anagrafica dei soci | `supabase/functions/**` → auto-deploy al push su `main` |
| **Consumer** | `Padel Match Assistant TEST` = `aylykijfirtegyxzdwgu` | `auth.users`, `consumer_profiles`, le challenge | `consumer-app/edge-functions/**` → auto-deploy al push su `main` |

🚨 **Le function in `consumer-app/edge-functions/` NON vanno spostate in
`supabase/functions/`.** Quel percorso è cablato nei workflow di deploy del **gestionale**:
ci finirebbero sul progetto sbagliato, dove non esistono né `auth.users` né le tabelle che
usano.

Viceversa `consumer-identity-lookup` sta in `supabase/functions/` **apposta**: legge
l'anagrafica, quindi deve girare sul gestionale, e la CI esistente lo deploya da sola.

### Il debito «deploy a mano» è chiuso

Le function del consumer si deployavano a mano — la stessa condizione che aveva prodotto
il caso `matchpoint-wallet-correct` (sorgente vivo diverso da quello in git, scoperto solo
diffando col progetto). Ora ci pensa `deploy-edge-functions-consumer.yml`, e il gate
`deno check` copre anche questa cartella.

Tre cose di quel workflow non sono dettagli:

- **`verify_jwt` è ACCESO per default**, l'opposto del workflow del gestionale, dove
  `--no-verify-jwt` è incondizionato con una allowlist di eccezioni — ed è proprio quella
  forma che ha spento la verifica a quattro funzioni per sbaglio (PR #538). Le function
  pubbliche vanno dichiarate in `PUBLIC_FUNCTIONS`, una alla volta e per iscritto.
- **Dopo il deploy lo stato viene RILETTO** dal Management API e confrontato con
  l'intenzione. Un deploy che esce 0 non è la prova che `verify_jwt` sia rimasto com'era:
  è esattamente l'assunzione che ha lasciato passare la #538.
- **Mai aggiungere `--prune`**: cancellerebbe dal progetto `whatsapp-webhook` e
  `whatsapp-send`, che di sorgente nel repo non ne hanno affatto.

La CLI Supabase cerca i sorgenti solo in `<workdir>/supabase/functions/<slug>/` e non
accetta percorsi: il workflow costruisce perciò un albero di staging usa-e-getta in
`RUNNER_TEMP` e ci punta con `--workdir`, senza spostare nulla nel repo.

---

## Il flusso, e perché è fatto così

```
  ┌─ browser ────────────┐   ┌─ consumer aylykijf… ─────┐   ┌─ gestionale qqbfph… ───┐
  │ telefono             │──▶│ consumer-auth-start      │──▶│ consumer-identity-     │
  │                      │◀──│   identify               │◀──│   lookup (identify)    │
  │ «Ciao Mario 👋»       │   │                          │   │  → solo nome battesimo │
  │                      │   │                          │   │                        │
  │ email digitata       │──▶│   challenge              │──▶│   lookup (challenge)   │
  │                      │   │   • confronta            │◀──│  → member_id + email   │
  │                      │   │   • crea challenge       │   │     SOLO se combacia   │
  │                      │◀──│   • OTP all'email        │   └────────────────────────┘
  │ «codice inviato»     │   │     IN ANAGRAFICA        │
  │                      │   │                          │
  │ codice 6 cifre       │──▶│ consumer-auth-verify     │
  │                      │   │   verifyOtp → bind →     │
  │ sessione             │◀──│   REFRESH → token        │
  └──────────────────────┘   └──────────────────────────┘
```

**Il browser non riceve mai** il cognome del socio, la sua email in anagrafica, il suo
memberId. Fra un passo e l'altro l'identità viaggia come `challenge_id` opaco.

### Le quattro proprietà da non rompere

1. **Solo il nome di battesimo al passo 1.** Chi prova numeri a caso non deve poter
   ricostruire l'elenco nome+cognome dei soci.
2. **L'email si confronta, non si accetta.** Il codice parte verso l'indirizzo *in
   anagrafica*, mai verso quello digitato. Se non combacia non si dice perché: si crea una
   challenge **decoy** (stessa risposta, nessun codice, verifica che fallirà). Anche i
   **tempi** di risposta devono coincidere — per questo l'invio gira in `waitUntil`, fuori
   dalla risposta. Senza questo accorgimento il decoy si riconosce col cronometro.
3. **Al socio senza email in scheda NON si chiede di inserirla.** Il telefono non è un
   segreto: chiunque lo conosca metterebbe la propria email e si prenderebbe l'account.
   L'indirizzo si raccoglie prima, da un canale già fidato (segreteria / `staff-create-access`).
   *Dopo* l'autenticazione si può chiedere e aggiornare tutto.
4. **Il profilo lo scrive solo `service_role`.** `consumer_profiles` non ha policy INSERT
   né UPDATE apposta: se il socio potesse scriverselo rivendicherebbe qualunque memberId.

### ⚠️ L'ordine in `consumer-auth-verify` non è arbitrario

`verifyOtp` → `consumer_bind_profile` → **`refreshSession`**.

L'hook `custom_access_token_hook` mette `matchpoint_member_id` nel JWT leggendo
`consumer_profiles`. Al primo accesso quel profilo **non esiste ancora** quando GoTrue
emette il token: l'access token di `verifyOtp` nasce quindi **senza il claim**, e con la
RLS costruita sul claim il socio entrerebbe in un'app che gli nega tutto. Il refresh
riesegue l'hook. È un fallimento silenzioso: **non togliere il refresh**.

---

## Cosa serve configurare a mano (dashboard, non raggiungibile via MCP)

Il codice si può leggere e rivedere senza questi passi, ma **il login non funziona finché
non sono fatti tutti**, sul progetto **`aylykijfirtegyxzdwgu`**.

1. **Auth → Hooks → Customize Access Token (JWT) Claims** → `public.custom_access_token_hook`.
   Senza, il claim non viene emesso: il login sembra riuscire e poi la RLS nega tutto.
2. **Auth → Emails → Templates**: i template devono contenere **`{{ .Token }}`**, altrimenti
   parte un magic link e non un codice a 6 cifre. Servono **entrambi**: *Confirm signup*
   (primo accesso, l'utente GoTrue non esiste ancora) e *Magic Link* (accessi successivi).
3. **Auth → Emails → SMTP**: il custom SMTP è configurato su gestionale PROD e TEST ma
   **non risulta su questo progetto**. Con l'SMTP di default Supabase limita a pochi invii
   all'ora e verso i soli membri del team → i soci non riceverebbero nulla. Stessa
   configurazione degli altri due progetti (`smtp.gmail.com:587`, `info@padelvillage.club`,
   App Password Google riusabile).
4. **Secret `CONSUMER_BRIDGE_SECRET`**: già presente sul progetto consumer (lo usa
   `whatsapp-webhook`); dev'essere **lo stesso valore** presente sul gestionale, dove lo
   legge `consumer-identity-lookup`.

---

## Contenuto

```
consumer-app/
  web/                 frontend — nessun build step. NON pubblicato: escluso da Pages in
                       _config.yml, destinato a `soci.padelvillage.club` da un repo a parte
                       (origin separato da quello dello staff — vedi sotto)
    index.html         guscio + stili
    logic.js           logica PURA: niente DOM, niente rete → tutta testabile
    ui.js              schermate e collegamenti
    api.js             l'unico punto che parla con la rete
    test/
      login-logic-test.html   rete di regressione sulla logica pura
      login-flow-test.html    percorre il flusso montando index.html VERO, con fetch simulato
  edge-functions/      → progetto CONSUMER (deploy-edge-functions-consumer.yml)
  db/                  migration già applicate sul progetto consumer, versionate qui
```

`supabase/functions/consumer-identity-lookup/` → progetto **gestionale** (deploy dalla CI).

### Dove va pubblicata `web/` — deciso, e perché

**`soci.padelvillage.club`, da un repo separato.** La ragione non è estetica: è che un
**origin separato** da quello dell'app staff porta con sé localStorage separato. Su questo
progetto la quota di localStorage è già stata saturata una volta lato staff — esiste
`pmoSetItemResilient` proprio per quello — e una PWA dei soci sullo stesso origin
competerebbe per la stessa quota. In più il service worker prende scope `/` invece di una
sottocartella, e lo scope non si cambia più dopo che i soci hanno installato la PWA.

Le edge function **restano qui** anche quando `web/` si sposta: vanno su Supabase, non su
Pages, e tenerle nel repo del gestionale mantiene atomico ogni cambio al contratto del
ponte (`consumer-identity-lookup` ↔ `consumer-auth-start`), che vive su entrambi i lati.

> ⚠️ **Creando una tabella nuova su questo progetto, ricordarsi i GRANT.** RLS e policy
> non bastano: in Postgres servono anche i privilegi. Le tabelle create di recente qui
> **non** ricevono quelli che Supabase concede per default (le `whatsapp_*`, più vecchie,
> li hanno; le `consumer_*` no), e senza `grant … to service_role` le edge function
> rispondono `DB_ERROR`. Non si nota provando le RPC: quelle sono `SECURITY DEFINER` e
> ignorano i grant. Si nota solo sull'accesso diretto via PostgREST. Vedi
> `db/20260718193000_consumer_grants_service_role.sql`.

### Provare in locale

```bash
python3 -m http.server 8199        # dalla radice del repo
# poi apri:
#   http://127.0.0.1:8199/consumer-app/web/test/login-logic-test.html
#   http://127.0.0.1:8199/consumer-app/web/test/login-flow-test.html
```

Le due pagine scrivono l'esito macchina in `window.__RESULTS__`
(`{pass, fail, total, failures}`). Al 18/07/2026: **53/53** e **30/30**.

---

## Limiti noti, dichiarati

- **Rate limit.** `challenge` è limitato a **6 tentativi/ora per telefono** più **5
  tentativi per challenge** sul codice. `identify` è limitato a **60/ora per IP**
  (`consumer_identify_throttle`).

  Il limite su `identify` è stato aggiunto il 18/07/2026, quando il ponte è andato
  in produzione: finché rispondeva `BRIDGE_DOWN` la mappa telefono → nome era
  inerte, dal deploy è diventata estraibile davvero. Non difende un account — il
  nome di battesimo da solo non apre nulla — difende l'**anagrafica**: senza, chi
  possiede una lista di numeri sa in pochi minuti quali sono soci del circolo, che
  è un dato personale in quanto rivela un'affiliazione.

  Perché 60 e non 6: la chiave è l'IP, e i soci al circolo stanno dietro lo stesso
  wifi — un limite stretto li bloccherebbe a vicenda proprio dove useranno l'app.

  ⚠️ **Mitigante, non barriera**: chi ruota IP aggira. Alza il costo di due o tre
  ordini di grandezza, non lo rende impossibile.

  ⚠️ Il conteggio usa **solo `cf-connecting-ip`**, e va lasciato così. La prima
  versione usava `x-real-ip` con fallback su `x-forwarded-for`: misurata mandando
  header falsificati, quattro richieste dallo stesso computer finivano in quattro
  bucket diversi — il client sceglieva la propria chiave di rate limit. Quei due
  header arrivano come li scrive il chiamante; `cf-connecting-ip` no, falsificarlo
  fa respingere la richiesta con 403 dal proxy prima ancora della funzione.
- **Login solo via telefono.** Oggi 1030 soci su 1042 (98,8%) entrano così. Restano fuori
  **3** soci che hanno l'email ma non il telefono: per loro serve accettare anche l'email
  come identificatore — è un ramo a sé, con una domanda di UX aperta (con l'email come
  identificatore non c'è un secondo fattore da chiedere).
- **7 soci senza email** in scheda e **2 irraggiungibili**: passano dalla segreteria, per la
  regola 3 qui sopra.
- Nessun `manifest.json` né `sw.js`: install PWA e permesso notifiche sono i passi 4a/4b
  della registrazione, non di questa fetta.
