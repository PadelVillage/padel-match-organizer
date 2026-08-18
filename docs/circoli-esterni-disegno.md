# Campi liberi nei circoli vicini — disegno della sezione

**Progetto a sé stante**, deciso dal committente il **18/08/2026**. Questo file è la **consegna**:
contiene tutto ciò che serve per costruirlo partendo da zero in una chat nuova. Quello che c'è
qui è **misurato**, non ricordato — dove non lo è, è detto.

## 🎯 A cosa serve

Il socio chiede al bot *«vorrei giocare giovedì alle 19»*. Il bot risponde **dove c'è un campo
libero**, guardando **più circoli della zona** invece di uno solo.

🗣️ Decisioni del committente (18/08/2026):

| | |
|---|---|
| **tutto gratuito all'inizio** | *«poi penseremo a come monetizzare. Prima dobbiamo far sì che questo servizio diventi fondamentale per i giocatori»* |
| **solo consultazione, sola lettura** | *«mi registro ad ogni web app del circolo, ma mi serve solo per vedere i campi liberi. Stop.»* ⇒ **nessuna prenotazione** sui sistemi altrui, **nessuna credenziale di terzi** |
| **solo padel** | gli altri sport dei circoli non ci interessano |
| **scan a domanda** | non sorveglianza continua: si guarda quando il socio chiede |
| **fotografia valida 5 minuti** | oltre, si rilegge |
| 🔄 **BETA: una lettura al giorno per circolo** *(18/08)* | *«prima devo andare a parlare con Wansport»*. ⚠️ Con 24 ore di invecchiamento il servizio **non può dire «c'è posto»**, solo com'era ieri: la freschezza a 5 minuti torna il giorno dell'accordo, non prima |
| **perimetro: vicinanza, non provincia** | XTRE (Pordenone) dentro, Stone Padel (Padova) fuori |
| **piattaforme: Wansport + Playtomic** | SportClubby esclusa |

⚖️ **Il valore vero non è la consultazione, è l'avviso** — e lo dice un dato: la sera del 17/08,
alla stessa ora, il Marco Polo aveva **tutti e quattro i campi occupati alle 19:30** mentre Padel
Conegliano ne aveva **tre liberi**. ⇒ *«Giovedì alle 19 non c'è posto»* è falso: è vero di un
circolo e falso di quello accanto. **Il servizio non trova un campo: dice che il campo c'è altrove.**
📌 L'avviso («ti dico quando si libera») **non è coperto** da questo disegno: la scadenza a 5 minuti
non lo produce, serve interrogare attivamente la fascia sorvegliata. È la decisione successiva.

## ⭐ Il fatto tecnico che decide l'architettura: **il browser NON serve**

Il login di Wansport è un **Joomla `com_users`** con token CSRF dal nome casuale. Riprodotto con
`curl` puro il 18/08:

```bash
# 1) GET home → cookie di sessione + token CSRF (input con nome di 32 esadecimali, valore 1)
curl -sS -c ck.txt -L "https://<circolo>.wansport.com/" -o h.html
TOK=$(grep -oE 'name="[0-9a-f]{32}" value="1"' h.html | head -1 | grep -oE '[0-9a-f]{32}')

# 2) POST login
curl -sS -b ck.txt -c ck.txt -L -X POST "https://<circolo>.wansport.com/" \
  --data-urlencode "username=$WANSPORT_USER" --data-urlencode "password=$WANSPORT_PASS" \
  -d "option=com_users" -d "task=user.login" -d "return=aW5kZXgucGhw" -d "$TOK=1"

# 3) area giocatore
curl -sS -b ck.txt -L "https://<circolo>.wansport.com/start"     # ~1 MB di calendario
```

⇒ **Il lettore può vivere in una edge function Supabase** (`fetch` + parsing), **non** sul worker
Hetzner.
🎯 Perché conta: il worker `tools/matchpoint-browser-worker/` **muore con Matchpoint** — i suoi 21
endpoint sono tutti automazione del browser su Matchpoint. Legare l'aggregatore al worker avrebbe
significato riscriverlo quel giorno. Così nasce già indipendente, ed è la regola *il gestionale SA,
il bot DICE* applicata a una funzione nuova.

✅ **MISURATO il 18/08/2026, su tre circoli** (Marco Polo, Collalbrigo, Padel Conegliano) — e la
risposta non è nessuna delle due: **`/start` è un GUSCIO**.

| | misura |
|---|---|
| peso | **~1,07 MB** di HTML |
| orari nella pagina (`\d\d:\d\d`) | **0** |
| occorrenze di «padel» | **0** |
| segnaposti di template (`{{…}}`) | **2229** |
| `task=` visibili nell'HTML | **1**, ed è `profilo.downloadModelloDocumento&format=raw` |
| latenza login+lettura | **1,7-1,8 s** |

Identico sui tre ⇒ è la **piattaforma**, non il singolo circolo. La griglia non è nella pagina: la
disegna il browser dopo aver chiesto i dati.
🚨 **Un parser HTML avrebbe trovato una tabella vuota e detto «nessun campo libero»** — il «no»
falso che questo servizio non deve mai dire. La regola «misurare prima di scrivere il parser» ha
pagato: il parser che si stava per scrivere era quello sbagliato.

⇒ **La domanda ora è un'altra: DA DOVE prende i dati.** La pista è la convenzione Joomla
`task=<controller>.<metodo>&format=raw`, e gli endpoint stanno nei **bundle minificati** —
`/templates/wsfrontend5/html/assets/javascripts/ws5-libs-start.min.js` e `app-ws5_utils.min.js`
(23 copioni in tutto, versione `?v8672`).
⭐ **E quei bundle sono file statici PUBBLICI**: si leggono senza login e senza consumare la
lettura giornaliera del circolo. È lì che va guardato il passo 2b, prima di toccare ancora un
portale.

## 🗺️ I 9 circoli operativi

| circolo | comune | piattaforma | indirizzo |
|---|---|---|---|
| Padel Village | Conegliano | **Matchpoint** | il calendario è nostro, si legge dal gestionale |
| Marco Polo Sporting Center | Vittorio Veneto | Wansport | `asdmarcopolovittorioveneto.wansport.com` |
| Padel Conegliano | Conegliano | Wansport | `padelconegliano.wansport.com` |
| Centro Sportivo Collalbrigo | Conegliano | Wansport | `centrosportivocollalbrigo.wansport.com` |
| AH Padel Club | Spresiano | Wansport | `ahpadel.wansport.com` |
| Jungle Padel | Fonte | Wansport | `junglepadel.wansport.com` |
| Solerò Padel Center | Gaiarine | Wansport | `soleropadelcenter.wansport.com` |
| Futbol Latino Social Club | Cappella Maggiore | Wansport | `futbollatinosc.wansport.com` |
| XTRE Padel Club | Fontanafredda (PN) | Wansport | `x3padelclub.wansport.com` |

⚠️ **Padel Village è un caso a parte**: il suo tenant Wansport (`padelvillage.wansport.com`) è
**morto** — licenza ENTERPRISE scaduta il **16/02/2021** — e **non va interrogato**. Il suo
calendario si legge dal gestionale, con un lettore diverso.

**Non operativi**, e perché:

| circolo | stato |
|---|---|
| Padel Oderzo (Ponte di Piave) | 🟡 password impostata, login rifiutato: *«account non ancora approvato dall'amministrazione»* ⇒ dipende da una persona di quel circolo |
| Eurotennis Treviso · DLF Treviso · TC Oderzo · TC Salgareda | ⚪ nessuna utenza: il reset non manda nessuna mail ⇒ servirebbe registrarsi |
| Sporting Life Center | ❌ non ha il padel |
| TC Visnadello · Seven Padel · TC Busatta · TC via Olivera · Stone Padel | ❌ esclusi dal committente |

## 🔑 I tre stati di un circolo — e perché vanno in tabella

Su Wansport **l'anagrafica delle persone è comune, l'utenza è per circolo**: il signup di un
circolo mai visitato risponde «utente già esiste», ma la password vive su ogni portale
separatamente.

| stato | come si riconosce | cosa si può fare |
|---|---|---|
| `attiva` | login → `/start` | si legge |
| `in_approvazione` | login → *«account non ancora approvato dall'amministrazione»* | niente: attende un gestore di quel circolo |
| `assente` | il reset **non manda nessuna mail** | serve registrarsi (`/signup`) — è una **scrittura**, va autorizzata |

📌 **Attivare un circolo** costa un giro una tantum: `Accedi` → «Hai dimenticato la password?» →
codice via **email e SMS** → nuova password. Automatizzabile end-to-end **se** la casella che
riceve i codici è leggibile.
🚨 La mail arriva dal **circolo** (`<circolo>@wansport.com`), non da un mittente unico: un filtro
Gmail per singolo mittente non basta — serve `from:(wansport.com)` **con «Non inviare mai nello
spam»**, perché Gmail **non inoltra** ciò che classifica spam.

## 🧱 Il modello dati

**`pmo_circoli_esterni`** — l'anagrafica
- `id`, `nome`, `comune`, `lat`, `lon`
- `piattaforma`: `wansport` | `matchpoint` | `playtomic`
- `base_url`
- `stato_utenza`: `attiva` | `in_approvazione` | `assente`
- `attivo` (bool): se interrogarlo
- **geometria rilevata**: `slot_minuti`, `apertura`, `chiusura`, `campi[]`
- `ultimo_scan_at`, `ultimo_esito`, `ultima_latenza_ms`

⭐ **Le credenziali NON stanno qui.** L'account Wansport è **uno solo per tutti i circoli**: va nei
segreti della edge function (`WANSPORT_USER` / `WANSPORT_PASS`), non ripetuto in ogni riga. Un
posto solo da proteggere e da ruotare. **In questo file la password non è scritta, di proposito.**

**`pmo_disponibilita_snapshot`** — la fotografia
- `circolo_id`, `data`, `campo`, `inizio`, `fine`, `libero`
- `letto_at` ← **obbligatorio**, vedi la regola della freschezza

## 🧩 I pezzi

1. **`circoli-scan`** (edge function): riceve giorno + fascia, interroga in **parallelo** i circoli
   `attivo=true`, normalizza in `{circolo, data, campo, inizio, fine, libero}`, scrive lo snapshot.
2. **La scadenza**: uno snapshot più fresco di **5 minuti** si riusa; oltre, si rilegge.
3. **Il ponte per il bot**: un'azione nuova dentro `consumer-player-readmodel` (dove già vivono
   `people` e `kb`). Il bot **non parla mai coi circoli**: chiede al gestionale.

🚨 **La regola della freschezza, che è già vostra** (`CLAUDE.md`): *il «no» si dice solo con la
freschezza certificata*. Se lo snapshot è scaduto e la rilettura fallisce, la risposta onesta è
**«non lo so ancora»**, non «non c'è posto». **L'assenza dalla copia non prova l'assenza dal circolo.**
⚖️ Con 5 minuti l'errore possibile è **per difetto** — un campo liberato 3 minuti fa non si vede,
quindi si nega un'occasione invece di mandare qualcuno a vuoto. Accettabile, e in linea col metro
di casa: il sync Matchpoint ha mediana ~2 minuti e massimo 10.

## 🖥️ La sezione in Amministrazione

Si innesta come voce del capitolo **Amministrazione** (che oggi ha Utenti Staff, Notifiche staff,
Dati, Bot Telegram), con `goToTabSection('administration','Circoli esterni')`.

Una riga per circolo:

| circolo | piattaforma | stato | ultimo scan | esito | campi |
|---|---|---|---|---|---|
| Jungle Padel | Wansport | 🟢 attiva | 2 min fa | ok, 1,4 s | 3 |
| Padel Oderzo | Wansport | 🟡 in approvazione | — | login rifiutato | — |

Con: **Prova ora** (scan singolo, mostra latenza e griglia rilevata), interruttore
**attivo/inattivo**, storico degli errori. Si vede lo stato **misurato**, non quello dichiarato.

## 🚨 La trappola del parser

**Ogni circolo ha una geometria diversa, e la differenza è dentro il padel** — non fra sport:

| | Marco Polo | Padel Conegliano | Sporting Life |
|---|---|---|---|
| fasce | ogni **90′**, 07:30→22:30 | ogni **60′**, **05:00→23:00** | orarie, 07:00→21:00 |
| campi | Campo 1-4 | nomi con sponsor (*Esterno 1 – Bravi*) | *Sintetico A/B Indoor*, divisi per zone |

⇒ **La forma della griglia si legge dalla pagina, mai si assume.** Chi scrive il lettore deve
dedurre durata slot, orari e campi; una scorciatoia funziona sui primi due circoli e si rompe al terzo.

⚠️ **E le menzioni di «padel» sulla home NON provano niente**: Futbol Latino ne ha **zero** sulla
home Wansport e ha **due campi WPT**. L'unico controllo affidabile sono le **schede sport dentro
`/start` dopo il login**.

## 📋 Ordine di costruzione proposto

1. **Tabella + sezione in sola lettura**, popolata coi 9 circoli qui sopra. Nessuno scan.
2. **`circoli-scan` su un circolo solo**, col bottone «Prova ora». Qui si misura la latenza vera.
3. **Estensione a N in parallelo** + snapshot + scadenza 5 minuti.
4. **Ponte per il bot.**

## ❓ Questioni aperte, da decidere prima di andare in servizio

- **Condizioni d'uso.** Leggere in automatico i portali di **altri circoli** con un account
  personale è quasi certamente fuori dalle loro condizioni. Il rischio non è teorico: chiudono
  l'account e il servizio dei soci muore. ⇒ **Chiedere un accesso da partner conviene**: uno slot
  di prima serata disdetto e non ricoperto è incasso perso per loro, e un servizio che glielo
  riempie è un procacciatore, non un parassita.
- **I 4 circoli senza utenza**: registrarsi è una scrittura coi dati anagrafici del committente. Da autorizzare.
- **Padel Oderzo**: va chiesto al circolo di approvare l'account.
- **Playtomic**: non ancora toccata. Architettura diversa, da misurare come si è fatto con Wansport.
- **L'avviso** («ti dico quando si libera»): meccanismo separato, non coperto da questo disegno.

## ⚠️ Nota per il merge

`docs/` è sorvegliato da `guard-worker-sync.yml`: quando questo file arriverà su `main` dovrà
essere **identico** anche su `test-preview`, altrimenti la guardia va rossa. Vale la regola 4bis:
**prima `test-preview`, poi `main`**.
