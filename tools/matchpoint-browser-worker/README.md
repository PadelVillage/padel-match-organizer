# Matchpoint Browser Worker

Worker Node/Playwright per il fallback `Clienti Matchpoint`.

Serve quando il login HTTP puro della Supabase Edge Function viene rimandato a `Login.aspx`: il worker usa un browser vero, scarica l'Excel clienti e lo restituisce alla Edge Function, che continua a fare validazione e import cloud.

## Sicurezza

- Modalita' consigliata: le credenziali Matchpoint restano nei secret della Edge Function Supabase e vengono inviate al worker solo nella chiamata server-to-server protetta.
- Le variabili ambiente `MATCHPOINT_USERNAME` e `MATCHPOINT_PASSWORD` del worker sono solo un fallback per test locali isolati.
- Il worker accetta richieste solo con `Authorization: Bearer <MATCHPOINT_WORKER_API_KEY>`.
- Il file Excel non viene salvato nel repository.
- La Edge Function deve conoscere solo:
  - `MATCHPOINT_BROWSER_WORKER_URL`;
  - `MATCHPOINT_BROWSER_WORKER_API_KEY`.

## Avvio locale

```bash
cp .env.example .env
npm install
npm run install-browsers
npm start
```

Health check:

```bash
curl http://127.0.0.1:8787/health
```

Export clienti:

```bash
curl -X POST http://127.0.0.1:8787/export-clients \
  -H "Authorization: Bearer $MATCHPOINT_WORKER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"username":"utente-matchpoint","password":"password-matchpoint"}'
```

La risposta contiene `base64`, `filename`, `contentType` e diagnostica tecnica sanificata. La validazione del foglio `Risultati` resta nella Edge Function Supabase.

## Deploy stabile su Render

Il repository contiene un Blueprint Render in `render.yaml` e un `Dockerfile` dedicato al worker.

Configurazione prevista:

- servizio web Docker `pmo-matchpoint-browser-worker-test`;
- branch `test-preview`;
- regione `frankfurt`;
- health check `/health`;
- piano `starter`, per evitare sleep/cold start lunghi durante l'import clienti.

Secret richiesto in Render:

| Nome | Valore |
|---|---|
| `MATCHPOINT_WORKER_API_KEY` | chiave lunga casuale condivisa solo con Supabase TEST |

Non salvare in Render:

- `MATCHPOINT_USERNAME`;
- `MATCHPOINT_PASSWORD`.

Le credenziali Matchpoint restano nei secret Supabase TEST e vengono inviate al worker solo dalla Edge Function, con chiamata server-to-server protetta.

Dopo il primo deploy Render:

1. aprire `https://<servizio-render>.onrender.com/health`;
2. verificare risposta `{ "ok": true, "service": "pmo-matchpoint-browser-worker" }`;
3. salvare in Supabase TEST:
   - `MATCHPOINT_BROWSER_WORKER_URL=https://<servizio-render>.onrender.com`;
   - `MATCHPOINT_BROWSER_WORKER_API_KEY=<stessa chiave impostata su Render>`.

## Variabili ambiente

| Nome | Obbligatoria | Note |
|---|---:|---|
| `MATCHPOINT_WORKER_API_KEY` | si | Token server-to-server tra Supabase e worker. |
| `MATCHPOINT_USERNAME` | no | Fallback solo per test locali; in TEST arrivano dalla Edge Function. |
| `MATCHPOINT_PASSWORD` | no | Fallback solo per test locali; in TEST arrivano dalla Edge Function. |
| `MATCHPOINT_BASE_URL` | no | Default `https://app-padelvillage-it.matchpoint.com.es`. |
| `MATCHPOINT_CLIENTS_PATH` | no | Default `/clientes/Listadoclientes.aspx?pagesize=15`. |
| `MATCHPOINT_EXPORT_TARGET` | no | Target postback noto del pulsante export. |
| `MATCHPOINT_HEADLESS` | no | `true` di default; usare `false` solo per diagnosi locale. |
