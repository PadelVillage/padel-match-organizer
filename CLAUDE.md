# Padel Match Organizer — istruzioni di progetto

## ⚠️ Topologia di deploy (leggere PRIMA di promuovere o toccare il worker)

Due meccanismi di deploy **diversi e indipendenti**:

- **App** (`index.html`): **PROD = branch `main`** (GitHub Pages, `app.padelvillage.club`).
  **TEST = `/test/`**, che carica l'`index.html` di **`test-preview`**. Sono file diversi su branch diversi.
- **Worker** (`tools/matchpoint-browser-worker/src/server.mjs`): **UN solo processo** su Hetzner,
  **condiviso TEST+PROD**, deploy **solo da `main`** (Action `deploy-worker-hetzner.yml`).
  → Il `server.mjs` di `test-preview` **non viene MAI eseguito**. Provare il worker su `/test/`
  significa già usare il worker di PROD (stesso processo).
- **Edge functions** (Supabase): auto-deploy su push a `main`.

## 🔒 Regola anti-disallineamento test↔prod (FERMA)

Il problema "il fix fatto in test non funziona in prod / si rompe un fix precedente" nasce dal drift dei branch.
Per evitarlo, SEMPRE:

1. **Modifiche al WORKER → si fanno da `main`** (branch da `main` → PR a `main`). **MAI** editare il
   `server.mjs` su `test-preview`.
2. **Dopo ogni deploy del worker**, riallinea `test-preview` a `main`:
   `git checkout test-preview && git checkout origin/main -- tools/matchpoint-browser-worker/src/server.mjs`
   poi commit + push (NON deploya). Obiettivo: i due branch hanno `server.mjs` **identico**.
   → Garantito dal workflow CI **`guard-worker-sync.yml`** (fallisce se divergono).
3. **Promozioni dell'APP a PROD → solo le RIGHE del fix** da un branch basato su `main`
   (es. `git show <commit> -- index.html | git apply`), **mai** copiando l'intero `index.html` di `test-preview`
   (porterebbe in PROD scaffolding di test e modifiche non destinate alla prod). Niente codice gated
   `PMO_IS_TEST_ENV` in PROD. Bumpa `APP_VERSION` così il deploy è verificabile dal vivo.
4. Le PR verso `main` passano da `guard-main-prs.yml` (≤15 file, niente cancellazioni, mai dal branch `test-preview`).

## Verifica
- Rete di regressione esecuzione staff: `test/handle-test.html` (servita da `.claude/launch.json` → `pmo-static`,
  porta 8123; apri `http://localhost:8123/test/handle-test.html`, leggi `window.__RESULTS__`). Mocka il worker.
- Worker condiviso: i log PROD sono su Hetzner (`~/.pm2/logs/matchpoint-worker-*.log`), pm2 `matchpoint-worker`.
