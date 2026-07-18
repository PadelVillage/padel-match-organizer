# App consumer — login dei soci

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
| **Consumer** | `Padel Match Assistant TEST` = `aylykijfirtegyxzdwgu` | `auth.users`, `consumer_profiles`, le challenge | **nessuna CI**: si deploya a mano |

🚨 **Le function in `consumer-app/edge-functions/` NON vanno spostate in
`supabase/functions/`.** Quel percorso è cablato nei due workflow di deploy, che puntano al
**gestionale**: ci finirebbero sul progetto sbagliato, dove non esistono né `auth.users`
né le tabelle che usano.

Viceversa `consumer-identity-lookup` sta in `supabase/functions/` **apposta**: legge
l'anagrafica, quindi deve girare sul gestionale, e la CI esistente lo deploya da sola.

⚠️ **Debito noto.** Il progetto consumer non ha una CI di deploy: le sue function si
deployano a mano, ed è esattamente la condizione che ha prodotto il caso
`matchpoint-wallet-correct` (sorgente vivo diverso da quello in git, scoperto solo
diffando col progetto). Finché non c'è un workflow, dopo ogni deploy a mano **verificare
che il sorgente qui corrisponda a quello vivo** (`get_edge_function` restituisce il
sorgente eseguito). Il gate `deno check` della CI non copre questa cartella.

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
  web/                 frontend (GitHub Pages) — nessun build step
    index.html         guscio + stili
    logic.js           logica PURA: niente DOM, niente rete → tutta testabile
    ui.js              schermate e collegamenti
    api.js             l'unico punto che parla con la rete
    test/
      login-logic-test.html   rete di regressione sulla logica pura
      login-flow-test.html    percorre il flusso montando index.html VERO, con fetch simulato
  edge-functions/      → progetto CONSUMER (deploy a mano)
  db/                  migration già applicate sul progetto consumer, versionate qui
```

`supabase/functions/consumer-identity-lookup/` → progetto **gestionale** (deploy dalla CI).

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

- **Il passo `identify` non ha rate limit**: chi prova molti numeri può costruire una mappa
  telefono → nome di battesimo. Accettato — il telefono non è un segreto e il nome da solo
  non apre nulla — ma è una scelta, non una dimenticanza. Il passo `challenge`, che è
  quello che conta, è limitato a **6 tentativi/ora per telefono** più **5 tentativi per
  challenge** sul codice.
- **Login solo via telefono.** Oggi 1030 soci su 1042 (98,8%) entrano così. Restano fuori
  **3** soci che hanno l'email ma non il telefono: per loro serve accettare anche l'email
  come identificatore — è un ramo a sé, con una domanda di UX aperta (con l'email come
  identificatore non c'è un secondo fattore da chiedere).
- **7 soci senza email** in scheda e **2 irraggiungibili**: passano dalla segreteria, per la
  regola 3 qui sopra.
- Nessun `manifest.json` né `sw.js`: install PWA e permesso notifiche sono i passi 4a/4b
  della registrazione, non di questa fetta.
