# Matchpoint Browser Worker

Worker Node/Playwright per il fallback `Clienti Matchpoint`.

Serve quando il login HTTP puro della Supabase Edge Function viene rimandato a `Login.aspx`: il worker usa un browser vero, scarica l'Excel clienti e lo restituisce alla Edge Function, che continua a fare validazione e import cloud.

## Sicurezza

- Le credenziali Matchpoint stanno solo nelle variabili ambiente del worker.
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
  -d '{}'
```

La risposta contiene `base64`, `filename`, `contentType` e diagnostica tecnica sanificata. La validazione del foglio `Risultati` resta nella Edge Function Supabase.

## Variabili ambiente

| Nome | Obbligatoria | Note |
|---|---:|---|
| `MATCHPOINT_WORKER_API_KEY` | si | Token server-to-server tra Supabase e worker. |
| `MATCHPOINT_USERNAME` | si | Utente Matchpoint dedicato. |
| `MATCHPOINT_PASSWORD` | si | Password Matchpoint dedicata. |
| `MATCHPOINT_BASE_URL` | no | Default `https://app-padelvillage-it.matchpoint.com.es`. |
| `MATCHPOINT_CLIENTS_PATH` | no | Default `/clientes/Listadoclientes.aspx?pagesize=15`. |
| `MATCHPOINT_EXPORT_TARGET` | no | Target postback noto del pulsante export. |
| `MATCHPOINT_HEADLESS` | no | `true` di default; usare `false` solo per diagnosi locale. |
