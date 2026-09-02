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

**3. Preparare il container — se ne occupa la console.** Il container di una sessione è
effimero e nasce senza due cose che servono al browser: `certutil` e la CA del proxy nel
magazzino NSS di Chromium. Le mette `prepara-ambiente.sh`, che **`console.mjs` lancia da sé
a ogni avvio**, prima del browser. Non c'è niente da fare a mano, e l'esito finisce nel
report sotto `caProxy`.

Chromium su Linux **non** guarda i certificati di sistema, guarda il proprio magazzino, che
nasce vuoto. Senza quel passaggio ogni pagina muore con `ERR_CERT_AUTHORITY_INVALID` — e
`curl` intanto funziona, il che rende il sintomo confondente.

📌 **Il campo «Script di configurazione» dell'ambiente cloud resta il posto migliore** dove
incollare quello script: lì gira **una volta per sessione**, prima di Claude, invece che a
ogni lancio della console. Ma non è più *obbligatorio*, ed è un cambio nato da un guasto:
📏 al collaudo del 15/08 quel campo era **vuoto**, il container crudo, e la console non
raggiungeva nessun sito. Un attrezzo che dipende da una casella di configurazione che
nessuno vede si rompe nella sessione **nuova** — cioè esattamente quando lo si tira fuori
per la prima diagnosi, ed è il momento in cui si è meno disposti a sospettare l'attrezzo
invece del sito. Con `PMO_SALTA_PREPARAZIONE=1` si disattiva l'avvio automatico.

## Tre trappole del container, già gestite nel codice

Sono scritte qui perché si ripresentano identiche in ogni sessione nuova, e il sintomo che
producono somiglia a «il sito è irraggiungibile» invece che «l'attrezzo è configurato male».

1. **Il browser non eredita il proxy.** `curl` legge `HTTPS_PROXY` da solo, Chromium no: va
   passato a `chromium.launch({ proxy })`, altrimenti `ERR_CONNECTION_RESET` ovunque.
2. **Il tunnel non regge il TLS 1.3.** Gli host dell'allowlist personalizzata passano in
   tunnel cieco, col certificato vero e non sostituito, e quel tunnel si spezza sul TLS 1.3
   di Chromium. Il browser parte con `--ssl-version-max=tls1.2`. ⚠️ **Non è un allentamento
   della verifica**: il certificato viene validato esattamente come prima, cambia solo la
   versione del protocollo. Si può alzare con `PMO_TLS_MAX=tls1.3` per riprovare, ed è la
   prima cosa da rimuovere il giorno in cui il tunnel regge.
3. **Il Chromium del container non è quello che Playwright si aspetta.** Playwright pinna un
   numero di build preciso e cerca lì e basta; il container ne ha **uno solo**, messo in
   `/opt/pw-browsers` quando l'immagine è stata costruita, e quasi mai coincide. Il lancio
   muore con `Executable doesn't exist at …/chromium_headless_shell-<numero>/…` e invita a
   `npx playwright install` — che qui è **la cosa da non fare**: l'immagine è preparata
   apposta per non riscaricare i browser, e il download non passerebbe comunque
   dall'allowlist. `trovaChromium()` ripiega da sé sul Chromium che il container ha davvero,
   e solo quando quello pinnato manca. Con `PMO_CHROMIUM_PATH=<percorso>` si forza a mano.
   Il percorso usato finisce nel report, sotto `chromium`.

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
| `--viewport <L>x<A>` | dimensioni della finestra (predefinito `1440x900`). Serve per le pieghe: questa app ne ha a **1024** e a **760px**, e senza questa opzione «l'ho guardata» vuol dire «su un solo schermo». Un valore storpiato fa fallire il lancio invece di ripiegare in silenzio |

## Le tre guardie

1. **Ambienti incrociati.** Ogni richiesta a un database Supabase del progetto diverso da
   quello dichiarato viene **abortita** e registrata. Vale dal primo byte, prima del login.
2. **Coerenza dichiarato/reale.** Dopo il login — che è il momento in cui l'app carica
   davvero la sua configurazione — si confronta quello che la pagina **dichiara** con
   l'ambiente richiesto, e si controlla quali host il browser ha *effettivamente*
   contattato. Se non combaciano, lo snippet **non viene eseguito**.

   Il dichiarato si legge da **due posti, in quest'ordine**: `PADEL_CONFIG.SUPABASE_URL` e,
   se manca, `pmoExpectedSupabaseProjectRef()`. Il report dice sempre da quale delle due ha
   letto, in `configFonte`.

   Il ripiego nasce da un difetto vero: dopo il login **su PROD `PADEL_CONFIG` restava
   `undefined`** (su TEST no), quindi guardando solo lì questa metà della guardia leggeva
   `null`, saltava il confronto **in silenzio** e non controllava niente, proprio
   nell'ambiente dove sbagliare costa. 📏 **Dal 15/08 quel difetto non c'è più**: PROD è a
   6.231 — la promozione #734, «la configurazione Supabase si ricorda anche in produzione» —
   e il collaudo legge `PADEL_CONFIG.SUPABASE_URL` su **entrambi** gli ambienti.

   ⚠️ **Il ripiego resta lo stesso, e non per inerzia.** Quel campo lo popola una funzione
   dell'app: la sua presenza è una proprietà della **versione che sta in pagina**, non un
   fatto stabile dell'ambiente. Questa console gira anche su versioni vecchie e, con `--url`,
   su copie locali. Una guardia che si fida di un campo comparso ieri torna cieca il giorno
   in cui qualcuno lo tocca — e torna cieca **in silenzio**, che è esattamente il difetto da
   cui è nata.

   ⚠️ Se **nessuna** delle due risponde, l'esecuzione **prosegue** — la prova comportamentale
   qui sotto è quella forte, e fermarsi renderebbe l'attrezzo inservibile su una pagina che
   non espone la sua configurazione — ma lo **dichiara**, in `avvisi` e sullo standard error.
   Un controllo saltato che non lascia traccia si legge come un controllo superato.
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
- **`api.github.com` dalla pagina non risponde.** L'app di TEST interroga l'API di GitHub
  (regole del parser): dal browser del container quella chiamata fallisce, perché il traffico
  GitHub passa da un proxy dedicato con le sue regole. La pagina si carica lo stesso, ma le
  funzioni che dipendono da quella lettura vanno verificate altrove.
- **TEST ha il calendario congelato** (vedi `CLAUDE.md`): le prenotazioni lì sono una
  fotografia. Una diagnosi sulle prenotazioni fatta su TEST non fallisce — riesce mostrando
  il passato, che è peggio.
