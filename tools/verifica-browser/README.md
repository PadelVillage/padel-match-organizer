# Console remota sul gestionale

Esegue uno snippet di diagnosi **dentro la pagina** del gestionale, su TEST o su PROD, e
restituisce risultato, messaggi di console, errori e screenshot. Serve a chiudere il giro che
prima passava dall'operatore: «apri DevTools, incolla questo, dimmi cosa esce».

`page.evaluate()` di Playwright è la console: stesso motore, stesso `window`, stesso contesto.

## Cosa serve prima

**1. Rete.** L'ambiente di esecuzione ha un allowlist di uscita. Servono questi host:

```
app.padelvillage.club              ← app PROD, e il config.js che l'app chiede in URL assoluto
test.padelvillage.club             ← app TEST
qqbfphyslczzkxoncgex.supabase.co   ← database PROD
cudiqnrrlbyqryrtaprd.supabase.co   ← database TEST
cdn.jsdelivr.net                   ← supabase-js + icone Tabler
unpkg.com                          ← xlsx 0.18.5
raw.githubusercontent.com          ← parser rules
```

Senza i due CDN l'app si carica a metà: `supabase.min.js` viene da jsdelivr e senza quello
il login non parte.

**2. Un utente staff per ambiente.** I due database hanno anagrafiche di accesso separate.
Ruolo consigliato: `readonly` — i permessi sono una whitelist, quindi un `readonly` appena
creato non vede niente finché non si spuntano le singole `view_*`. Credenziali in variabili
d'ambiente, mai nel repo e mai in chat:

| variabile | ambiente |
|---|---|
| `PMO_VERIFY_EMAIL` / `PMO_VERIFY_PASSWORD` | PROD |
| `PMO_VERIFY_EMAIL_TEST` / `PMO_VERIFY_PASSWORD_TEST` | TEST |

## Uso

```bash
npm install                                   # playwright 1.59.1
node console.mjs --env test --eval "return document.title"
node console.mjs --env prod --file diagnosi.js --shot /tmp/x.png --out /tmp/report.json
```

Lo snippet è un **corpo di funzione async**: usa `return` e può usare `await`.

| opzione | effetto |
|---|---|
| `--env test\|prod` | obbligatoria, nessun valore predefinito: l'ambiente si dichiara |
| `--eval "<codice>"` / `--file <path>` | lo snippet da eseguire |
| `--no-login` | non fa login (per le pagine pubbliche) |
| `--shot <path>` / `--out <path>` | screenshot / report JSON su file |
| `--storage-in` / `--storage-out` | carica o salva il `localStorage` (vedi limiti) |
| `--url <url>` | punta a una copia locale dell'app; **non** disattiva il controllo di ambiente |
| `--allow-writes` | disarma la guardia delle scritture. Da usare consapevolmente |

## Le tre guardie

1. **Ambienti incrociati.** Ogni richiesta a un database Supabase del progetto diverso da
   quello dichiarato viene **abortita** e registrata. Vale dal primo byte, prima del login.
2. **Coerenza dichiarato/reale.** Dopo il login — che è il momento in cui l'app carica
   davvero la sua configurazione — si confronta `PADEL_CONFIG.SUPABASE_URL` con l'ambiente
   richiesto, e si controlla quali host il browser ha *effettivamente* contattato. Se non
   combaciano, lo snippet **non viene eseguito**.
3. **Sola lettura** (predefinita). Passano `GET`/`HEAD`/`OPTIONS`, le chiamate `/auth/v1/`
   e le RPC di lettura (`pmo_get_*`, `pmo_can_*`, `pmo_supabase_environment_check`). Sono
   bloccate `PATCH`/`PUT`/`DELETE`, gli insert su tabella e **tutto `/functions/v1/`**, che
   è la strada che porta al worker condiviso e quindi al Matchpoint vero.

Ogni blocco finisce nel report: si vede che lo snippet *ha provato* a scrivere, invece di
vederlo fallire senza spiegazione.

## Limiti, detti chiaramente

- **La guardia sbaglia per eccesso, non per difetto**: una RPC di lettura con un nome fuori
  convenzione viene bloccata. Si aggiunge a `RPC_DI_LETTURA_EXTRA` dopo averla letta.
- **Non è una sandbox.** Con `--allow-writes` le scritture su PROD sono vere.
- **Lo stato parte da zero.** La console dell'operatore gira in un browser con la sua
  sessione e il suo `localStorage`, accumulati in ore d'uso; qui la pagina è sempre pulita.
  Per i sintomi che dipendono dallo stato serve `--storage-in` con un export fatto sul posto,
  e se il difetto nasce da una sequenza lunga di azioni va ricostruita la sequenza.
- **TEST ha il calendario congelato** (vedi `CLAUDE.md`): le prenotazioni lì sono una
  fotografia. Una diagnosi sulle prenotazioni fatta su TEST non fallisce — riesce mostrando
  il passato, che è peggio.
