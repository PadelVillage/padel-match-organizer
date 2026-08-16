# Voce 53 — collaudo: il bot torna a chiedere al gestionale

**Scheda scritta il 16/08/2026, 29ª sessione. Da eseguire con le mani del committente.**
Il codice è in produzione sul **bot di prova** (`assistente-telegram-prova`, deploy del 16/08 da
`main` di `assistente-padel-agent`, commit `22bc111`), e il ponte è vivo sui due gestionali —
`consumer-booking-write` **v26 su PROD**, **v34 su TEST**, verificate sul progetto e non dedotte
dal merge.

⛔ **Finché questa scheda non è stata eseguita la voce NON si chiude**, ed è la regola del
committente: *«il codice è a posto non è funziona»*.

---

## Cosa si prova

Che dopo un **esito ignoto** il bot **torna a chiedere al gestionale da solo** e scrive al socio un
esito vero, invece di lasciare il controllo a lui.

## 🚨⭐⭐ E cosa NON si può provare qui — dichiarato PRIMA, non dopo

**Il «sì» è irraggiungibile sul bot di prova.** Non è un limite della procedura, è un fatto della
catena, e sapere che l'esito atteso è un altro impedisce di leggere un `rinuncia/tetto` come un
fallimento:

- il bot di prova punta al gestionale di **TEST** (`cudi…`) — lo dichiara lui all'avvio;
- su TEST la scrittura verso Matchpoint è **simulata**: il circolo non si tocca, quindi la
  prenotazione **non nasce mai** sul sistema del circolo;
- e la copia di TEST è alimentata solo da import **a mano**: al momento della scrittura di questa
  scheda `max(synced_at)` era **15:30 UTC**, vecchia di **2h44m**.

⇒ Il ciclo girerà 15 minuti e finirà in **`rinuncia/tetto`**. ⚖️ **Ed è la parte che vale di più**:
è il **ramo pericoloso**, quello in cui una copia stantia potrebbe far dire un «no» falso. Se esce
«non lo so ancora» e non un «no», la cosa per cui esiste tutta la voce ha funzionato.

📌 La strada felice avrà la sua prova solo sul bersaglio **`soci`**, dove la copia è viva — e quello
vuole un ok separato e la parola `SOCI` scritta a mano.

---

## 🎁 IL FATTO CHE SEMPLIFICA TUTTO: qui NON serve lo strappo a metà volo

**Misurato nel codice il 16/08, non dedotto.** `matchpoint-bookings-create` marchia l'esito come
ignoto a **qualunque** caduta di rete della chiamata al worker:

```js
} catch (netErr) {
  // NESSUN retry: la prenotazione potrebbe essere già stata creata dal worker.
  throw erroreEsitoIgnoto(`Worker network error: ${errorText(netErr)}`);
```
📄 `supabase/functions/matchpoint-bookings-create/index.ts:194`

Il marchio sta su una **proprietà**, non sulle parole del messaggio, e «connection refused» ci
rientra. Lo conferma la misura già fatta: la **parte A** della voce 41, con Caddy **fermo prima**,
diede `unknown` con `Connection refused` — non `error`.

⇒ **Basta Caddy giù PRIMA di prenotare.** Non serve la procedura difficile della parte B — il
collegamento tenuto vivo, i due secondi contati, `systemctl kill -s SIGKILL` — che era necessaria
là perché lì bisognava tagliare **a metà**, e lo spegnimento gentile non taglia mai (il difetto ②
dei tre giri falliti del 15/08).

## 🎁 E LA FINESTRA COL CIRCOLO FERMO DURA SECONDI, NON QUINDICI MINUTI

L'attesa **non passa da Caddy**: `verifica` è una chiamata alla edge su Supabase, e quella funzione
**non chiama il worker** — è la sua ragione d'essere. ⇒ Appena la prenotazione è partita si può
**riaccendere Caddy subito**, e il ciclo continua per conto suo.

⭐ Ed è esattamente la tesi centrale della voce, che così viene **esercitata** invece che creduta:
*una copia risponde sempre, anche a worker morto*. Se le domande del ciclo rispondono a Caddy
ancora giù, quella frase smette di essere un ragionamento e diventa una misura.

---

## Passo 0 — pre-volo

**a) La chiave SSH** è `padel_deploy`:
```bash
ssh -i ~/.ssh/padel_deploy root@91.99.131.243
```

**b) Il bot di prova dev'essere quello nuovo, e deve dirlo lui.**
```bash
ssh -i ~/.ssh/padel_deploy root@91.99.131.243 \
  'pm2 logs assistente-telegram-prova --lines 40 --nostream | grep -E "ponti edge|GESTIONALE DI PROVA"'
```
Deve stampare **`cudi… (TEST)`** e **`🧪 prenotazioni sul GESTIONALE DI PROVA`**.
🚨 Se dicesse **`✍️ prenotazioni REALI`**, **fermarsi**: quello è il gestionale vero.

**c) La chat giusta.** Il bot di prova ha un **token suo**, quindi è un *altro* bot su Telegram —
non `@loziocoach_bot`. La prova va fatta nella sua chat, non in quella dei soci.

**d) Lo slot bersaglio**: data lontana, campo e ora che non usa nessuno.

**e) L'ora**: il circolo dev'essere fermo per i pochi secondi in cui Caddy è giù — con Caddy fermo
**nessuno prenota**, né lo staff né i soci.

---

## ① Controllo positivo — la sonda deve saper vedere

```bash
curl -m 5 -sS -o /dev/null -w "worker: HTTP %{http_code}\n" https://worker.91.99.131.243.nip.io/
```
**Deve stampare un numero** (404 va benissimo). Se dice già «Failed to connect», **fermarsi**: la
sonda non misura quello che si crede.

## ② Fermare Caddy

```bash
ssh -i ~/.ssh/padel_deploy root@91.99.131.243 'systemctl stop caddy; echo "caddy: $(systemctl is-active caddy)"'
```

## ③ 🚦 IL CANCELLO — stesso comando del passo ①

```bash
curl -m 5 -sS -o /dev/null -w "worker: HTTP %{http_code}\n" https://worker.91.99.131.243.nip.io/
```
**Deve dire `Failed to connect`.** Se risponde ancora un numero, **ci si ferma e non si tocca
niente.** 🚨 Senza questo cancello, la notte del 14/08 furono create **tre prenotazioni vere**
credendo di collaudare.

## ④ Prenotare dal bot di prova — e le strade sono DUE

⚠️ **`bot.ts` aggancia l'attesa in due punti diversi**, e vanno provati **tutt'e due**: sono la
stessa famiglia di difetto della voce 23, dove una delle tre strade di creazione si comportava
diversamente dalle altre.

| strada | come si esercita | dove sta l'aggancio |
|---|---|---|
| **modello** | si chiede a parole: *«prenotami campo X venerdì alle 19»* e si conferma parlando | dopo `mandaScheda` |
| **bottoni** | si tocca la griglia e poi il bottone **conferma** | in `gestisciTocco` |

📌 La griglia **si vede lo stesso** con Caddy giù: `availability` legge la copia e non chiama il
worker. È solo la **creazione** a cadere.

## ⑤ Riaccendere Caddy — subito, senza aspettare

```bash
ssh -i ~/.ssh/padel_deploy root@91.99.131.243 'systemctl start caddy; systemctl is-active caddy'
curl -m 5 -sS -o /dev/null -w "worker: HTTP %{http_code}\n" https://worker.91.99.131.243.nip.io/
```

---

## Le previsioni, dichiarate PRIMA

| quando | cosa deve succedere |
|---|---|
| **subito** | il bot dice che **non ha la conferma**, che **NON bisogna rifarla**, e che **ci pensa lui** («sto controllando col gestionale e ti scrivo appena lo so, entro un quarto d'ora») |
| **subito** | ⛔ **NON ripropone la griglia** e non invita a riprovare: un secondo tocco duplicherebbe |
| **+1 minuto** | prima domanda al gestionale. ⭐ Si aspetta **prima** di chiedere: nell'istante della scrittura la copia non può ancora saperne niente |
| **ogni minuto** | una domanda, fino a **15** |
| **+15 minuti** | secondo messaggio al socio: *«Non ho ancora la conferma per … e ho smesso di aspettare per non tenerti sulle spine. ⚠️ Non rifare la prenotazione senza aver controllato: potrebbe esserci già.»* |
| **per tutto il giro** | ⭐⭐ il gestionale risponde **`non_ancora / copia_ferma`**, e risponde **anche con Caddy ancora giù** |

### Nei log del bot (VM, `pm2 logs assistente-telegram-prova`)

```
[prenota] esito IGNOTO per <personaId> su <data> <ora> C<campo>: <dettaglio>
  ⏳ [attesa-esito] chat <id>: torno a chiedere per <data> <ora> C<campo> (scritta <istante>)
  ⏳ [attesa-esito] chat <id>: rinuncia/tetto
```

### Nei log del gestionale di TEST (`consumer-booking-write`)

```
[booking-write] verifica <data> <ora> C<campo> per <nome>: non_ancora/copia_ferma (copia al <istante>)
```
Quindici righe, una al minuto. **`copia_ferma`, mai `copia_aggiornata_dopo`.**

---

## 🚨 COSA SAREBBE UN ROSSO VERO

Un collaudo che non sa in anticipo cosa lo farebbe fallire dà un verde che non ha controllato
niente. Questi sono i rossi, in ordine di gravità:

| # | il rosso | perché è grave |
|---|---|---|
| ① | ⭐⭐ **esce un «no»** — *«la prenotazione non è stata registrata»* | **è IL guasto.** Con la copia ferma il «no» non può uscire: significherebbe che la regola della freschezza non regge, e su PROD direbbe a un socio che il campo è libero quando è occupato |
| ② | **nessun secondo messaggio** dopo 15 minuti, col bot ancora vivo | il ciclo non è partito o è morto in silenzio. ⚠️ Guardare **prima** i log: se manca la riga `torno a chiedere`, non è partito — probabilmente `scritta_alle` non è arrivato |
| ③ | **il bot ripropone la griglia** o invita a rifare | è il danno originale della voce: il tocco successivo prenota due volte |
| ④ | **una strada sì e l'altra no** (modello ok, bottoni muti, o viceversa) | i due agganci sono nati per stare in pari; uno solo vuol dire che metà dei soci non è coperta |
| ⑤ | il ciclo parte su un rifiuto **normale** (campo occupato, troppi giorni) | un messaggio di troppo a chi non aspettava niente: l'attesa deve partire **solo** sull'ignoto |
| ⑥ | esce `rinuncia/**guasto**` invece di `rinuncia/tetto` | vuol dire che **non si è mai riusciti a chiedere**: il ponte era irraggiungibile, che è un problema diverso e va indagato a parte |

### ⛔ E cosa NON è un rosso, per non correggere ciò che è stato scelto

- **`rinuncia/tetto`**: è l'esito **atteso** qui (vedi in cima). Non è la voce che non funziona, è la
  copia di TEST che è ferma per scelta.
- **Il secondo messaggio non arriva perché il bot è stato riavviato nel frattempo**: è il **limite
  dichiarato**, deciso dal committente il 16/08 — l'attesa vive nel processo. Non è un difetto da
  riparare di corsa; è il motivo per cui il primo messaggio continua a dire al socio che può
  chiedere lui.

---

## 🎯 IL CONTROLLO POSITIVO — senza, questo collaudo dimostra metà

Un `rinuncia/tetto` verde dimostra che **non esce un no sbagliato**. Non dimostra che il «no»
**sappia uscire**: se fosse rotto e non uscisse **mai**, questa prova sarebbe **identica**.
⚖️ È la lezione della 27ª — *la prova che dà torto conta più di quella che dà ragione* — e quella
volta impedì di mandare in produzione una guardia che negava il servizio a chi ne aveva diritto,
**con la prova di sicurezza tutta verde**.

**Come si esercita** (facoltativo, ma è la metà che manca): mentre il ciclo gira, si lancia **un
import a mano** delle prenotazioni su TEST. La copia diventa più fresca di `scritta_alle + 150 s`,
e alla domanda successiva il verdetto passa a **`no`**.

⚖️ E **quel** «no» è **corretto**: su TEST la scrittura era simulata, quindi la prenotazione
davvero non c'è. ⇒ Si vedono le due facce nello stesso giro — il «no» che **non** esce quando la
copia è ferma, e che **esce** appena la copia è fresca.

---

## Pulizia

**Niente da pulire sul circolo**: la scrittura su TEST è simulata, il Matchpoint vero non è stato
toccato. ⚠️ Su TEST può restare una riga marchiata `nata_in_prova` — è il marchio che le impedisce
di sparire al primo sync, e va bene che resti.

🚨 **L'unica cosa da verificare è Caddy**: `systemctl is-active caddy` deve dire **`active`**, e il
`curl` del passo ① deve tornare a stampare un numero. A Caddy giù non prenota nessuno.

---

## Cosa resta fuori da questa scheda

1. ⛔ **La strada felice** — il «sì» — che vuole la copia viva, cioè il bersaglio **`soci`**, con ok
   separato e la parola `SOCI` scritta a mano.
2. 🌙 **La finestra notturna 01:00-06:00**, in cui il sync non gira (📄 `docs/voce-53-ritardo-sync.md`
   §3.4): lì l'esito è `rinuncia/tetto` **per costruzione**, su qualunque bersaglio. Non c'è niente
   da collaudare — c'è da saperlo prima di provare a quell'ora e credere di aver trovato un guasto.
