# Padel Match Organizer — istruzioni di progetto

## ⚠️ Le 4 app e dove si deploya ciascuna (leggere PRIMA di toccare qualcosa)

| app | repo | ramo → dove | backend |
|---|---|---|---|
| **Admin PROD** (staff) | `padel-match-organizer` | `main` → Pages `app.padelvillage.club` | Supabase `qqbfphyslczzkxoncgex` |
| **Admin TEST** | `padel-match-organizer` | `test-preview` → `/test/`, che carica l'`index.html` di quel ramo | Supabase `cudiqnrrlbyqryrtaprd` |
| **Consumer soci** | `padel-match-assistant` | `main` → Pages `soci.padelvillage.club` | Supabase `aylykijfirtegyxzdwgu` |
| **Emulatore** | `chat-giocatori-emulatore` | `main` → Pages | nessuno (solo localStorage) |

Admin PROD e Admin TEST sono **file diversi su rami diversi** dello stesso repo: non è un
ambiente che "punta" a due database, sono due copie dell'app.

**Worker** (`tools/matchpoint-browser-worker/src/server.mjs`): **UN solo processo** su Hetzner,
**condiviso TEST+PROD**, deploy **solo da `main`** (`deploy-worker-hetzner.yml`). Il `server.mjs`
di `test-preview` **non gira MAI**. Provare il worker da `/test/` significa già usare quello di
PROD e scrivere sul **Matchpoint vero**: `/test/` non è una sandbox.

**Edge functions**, tre destinazioni diverse dallo stesso repo:

- `supabase/functions/**` → `qqbf…` da `main`, `cudi…` da `test-preview`
- `consumer-app/edge-functions/**` → `ayly…` da `main` (`deploy-edge-functions-consumer.yml`)
- `supabase/functions/_archive/**` → **nessuna destinazione**: cartelle con `_` iniziale sono
  saltate dai workflow. Ci stanno i sorgenti conservati ma non deployati (vedi il README lì dentro).

Spostare una cartella tra le prime due la manda **sul progetto sbagliato**.

⚠️ **Il frontend consumer si modifica in `padel-match-assistant`**, non in `consumer-app/web/`
di questo repo: quella è una copia **non viva**, i soci non la vedono. Le edge function del
consumer invece restano qui.

⚠️ **Il ponte identità del consumer punta a PROD**: `CONSUMER_IDENTITY_URL` in
`consumer-auth-start` ha come default il gestionale `qqbf…`, e le `consumer-*` del ponte sono
deployate solo lì. Una prova del login consumer legge quindi l'anagrafica **vera** dei soci.
Finché non esiste un ponte verso `cudi…`, il consumer **non ha un ambiente di TEST**.

## 🔒 Regola anti-disallineamento test↔prod (FERMA)

Il problema "il fix fatto in test non funziona in prod / si rompe un fix precedente" nasce dal drift dei branch.
Per evitarlo, SEMPRE:

1. **Modifiche al WORKER → si fanno da `main`** (branch da `main` → PR a `main`). **MAI** editare il
   `server.mjs` su `test-preview`.
2. **Dopo ogni deploy del worker**, riallinea `test-preview` a `main`:
   `git checkout test-preview && git checkout origin/main -- tools/matchpoint-browser-worker/src/server.mjs`
   poi commit + push (NON deploya). Obiettivo: i due branch hanno `server.mjs` **identico**.
3. **Promozioni dell'APP a PROD → solo le RIGHE del fix** da un branch basato su `main`
   (es. `git show <commit> -- index.html | git apply`), **mai** copiando l'intero `index.html` di `test-preview`
   (porterebbe in PROD scaffolding di test e modifiche non destinate alla prod). Niente codice gated
   `PMO_IS_TEST_ENV` in PROD. Bumpa `APP_VERSION` così il deploy è verificabile dal vivo.
4. Le PR verso `main` passano da `guard-main-prs.yml` (≤15 file, niente cancellazioni, mai dal branch `test-preview`).
5. **Anche `.github/workflows/**` e questo `CLAUDE.md` devono essere IDENTICI sui due rami.** Un fix
   alla CI fatto solo su `main` non protegge `test-preview`, da cui scatta `deploy-edge-functions-test.yml`
   (successo il 19/07: la lista `VERIFY_JWT_FUNCTIONS` della #538 stava solo su `main`).

→ I punti 2 e 5 sono garantiti da **`guard-worker-sync.yml`**, che fallisce se i rami divergono
su worker, workflow o istruzioni. Ha anche un backstop giornaliero alle 06:00 UTC.

I rami di lavoro non vanno potati a mano: `cleanup-claude-branches.yml` cancella ogni notte
tutto tranne `main` e `test-preview`. Se ne vedi molti in locale è solo la tua copia stantia
dei ref remoti → `git fetch --prune`.

## Verifica
- Rete di regressione esecuzione staff: `test/handle-test.html` (servita da `.claude/launch.json` → `pmo-static`,
  porta 8123; apri `http://localhost:8123/test/handle-test.html`, leggi `window.__RESULTS__`). Mocka il worker.
- Worker condiviso: i log PROD sono su Hetzner (`~/.pm2/logs/matchpoint-worker-*.log`), pm2 `matchpoint-worker`.
- Una funzione può essere **viva su Supabase senza sorgente in git**: ogni tanto incrocia
  `list_edge_functions` con `ls supabase/functions/` su entrambi i progetti.
