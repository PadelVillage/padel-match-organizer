# Voce 53 — collaudo: il bot torna a chiedere al gestionale

**Scheda del 16/08/2026, 29ª sessione.** Il ponte è vivo sui due gestionali —
`consumer-booking-write` **v26 su PROD**, **v34 su TEST** — e il ciclo è sul **bot dei soci** oltre
che su quello di prova.

# ✅ ESEGUITA IL 16/08/2026 ALLE 23:20, E VERDE — la strada dei BOTTONI

**Su PROD, bot dei soci, slot `2026-08-29 09:00 C1`.** Il cancello di Caddy manovrato da GitHub
Actions (`cancello-worker.yml`), non a mano.

| istante (UTC) | fatto |
|---|---|
| 21:19:51 | cancello chiuso, verificato `HTTP 000` |
| 21:20:23.9 | il tocco su «✅ Confermo» → `Connection refused` su `/create-booking` → **esito ignoto** |
| 21:21:07 | cancello riaperto, verificato |
| 21:24:02 | primo sync atterrato **dopo** la scrittura: la copia diventa una testimone |
| 21:25:28 | verdetto **`no`** consegnato al socio |

⇒ **5′04″** dal tocco alla verità, di cui **3′38″ di silenzio onesto**: il bot poteva rispondere e
non l'ha fatto, perché non aveva la prova. Il «no» è uscito **86 secondi dopo** che la prova è
arrivata, e non un istante prima.

**Le parole vere al socio**, nell'ordine: *«Non ho la conferma… ⚠️ Non rifarla adesso: potrebbe
essere passata lo stesso… Ci penso io: controllo e ti scrivo appena lo so, entro un quarto d'ora»*
→ e poi *«Ho controllato: la prenotazione … non è stata registrata. Il campo è ancora libero»*.

**I rossi della scheda, uno per uno**: ① «no» prematuro **assente** (è il guasto grosso) · ② ciclo
**partito** · ③ griglia **non** riproposta · ⑥ nessun `rinuncia/guasto` · ⑦ **nessuna prenotazione
vera**, verificata nella copia fresca (per il 29/08 09:00 solo righe del **Campo 3**, partita di
altri, `idReserva 9371`).

⭐ **E un controllo positivo che non è stato costruito: era nel registro.** Alle 20:52 della stessa
sera, **sullo stesso bot**, c'era già stato un `esito IGNOTO` — e lì **nessuna riga
`[attesa-esito]`**, perché il bot non aveva ancora il codice. Stesso bot, stesso guasto, prima
nessun ciclo e dopo sì: è la differenza che dimostra che quelle righe le produce **la cura**.

## 🚨 E LA STRADA DEL MODELLO NON È COLLAUDABILE COM'ERA SCRITTA QUI

La tabella qui sotto diceva: *«modello — si chiede lo slot e si conferma **scrivendo**»*.
**Quella cosa non può accadere**, e provarla il 16/08 l'ha dimostrato: alla frase *«sì, confermo la
prenotazione di domenica 30 agosto alle 16:00»* il bot ha risposto con la **scheda a bottoni** dello
slot giusto. Ha capito, e si è fermato.

Il codice lo dice esplicito (`bot.ts:3199` e `:3207`):

> ⭐ *Se il giro ha toccato `prenota`, comanda la scheda a bottoni: **il socio non deve mai scrivere
> una data né un «sì»**.*
> 🚨 *…il sì dovrà comunque arrivare da **un tocco**, che è un turno diverso.*

⇒ Il modello arriva **sempre** fino alla proposta e poi consegna ai bottoni. La conferma è, per
disegno, un tocco — e il disegno è una protezione, non una svista.

❓ **DOMANDA APERTA, da misurare e non da dedurre**: se il modello finisce sempre in una proposta,
l'aggancio dell'attesa sulla sua strada (`bot.ts:3216`) può vedere solo esiti **senza scrittura**,
e mai un esito ignoto — cioè per la voce 53 **non scatterebbe mai**. 🚨 Non è scritto come verdetto
di proposito: sarebbe la **terza** deduzione plausibile su questa voce in un giorno solo, e le prime
due — *«il sync non passa dal worker»* e *«su TEST il worker viene chiamato lo stesso»* — erano
**entrambe false**.

⛔ **Finché questa scheda non è stata eseguita la voce NON si chiude**: *«il codice è a posto non è
funziona»*. Per la strada dei bottoni, ora, **lo è**.

---

# 🚨🚨 CORREZIONE DEL 16/08 — LA PRIMA VERSIONE DI QUESTA SCHEDA ERA SBAGLIATA

**Provata, e fallita al primo giro.** Diceva di collaudare sul **bot di prova** fermando Caddy. Non
può funzionare, e non per come è stata eseguita: **su TEST il worker non viene chiamato mai.**

```ts
// matchpoint-bookings-create/index.ts — PRIMA di qualunque chiamata al worker
if (!scritturaAlCircoloConsentita(supabaseUrl)) {
  console.warn(JSON.stringify({ event: 'ambiente_di_prova', azione: 'create', booking }));
  const workerResult = esitoDiProva('create');
  …            // registra la partita di prova e risponde OK
}
```

E la guardia è **l'indirizzo del progetto**:

```ts
export function scritturaAlCircoloConsentita(supabaseUrl: unknown): boolean {
  …
  if (host === `${REF_PROD}.supabase.co`) return true;   // ⇐ vera SOLO su PROD
```
📄 `supabase/functions/matchpoint-bookings-cancel/scrittura-al-circolo.ts:147`

⇒ Su TEST la catena si ferma **prima** di Caddy. Fermare Caddy non cambia niente, perché su quella
strada **Caddy non c'è**. L'esito ignoto sul bot di prova è **irraggiungibile**, e nessun tempismo
lo rende raggiungibile.

**L'esito misurato** (16/08, ~20:38, con Caddy `failed` e il cancello `HTTP 000` passato): il bot
ha risposto **«✅ Prenotato: mercoledì 26 agosto, 09:30–11:00, campo 1»**. Nessun esito ignoto,
nessun ciclo d'attesa, niente da guardare.

## ⚖️ L'errore di metodo, scritto perché è il più insidioso della famiglia

Scrivendo la prima versione avevo letto `esitoVieneDaUnaProva(workerResult)` (riga **316**), che
decide il **marchio sulla riga**, e ne avevo concluso: *«la simulazione è a valle, quindi il worker
viene chiamato comunque»*. Il recinto vero sta **350 righe più in là**, e non l'ho cercato.

🚨 **È la 25ª — premessa vera, conclusione falsa — con l'aggravante che l'ho scritta con la faccia
di una misura**: *«misurato nel codice, non dedotto»*. Una deduzione travestita da reperto si legge
come un fatto e nessuno la ricontrolla. È lo stesso identico difetto che la 28ª aveva già trovato
in questa voce, sul sync che «non passa dal worker».

⚠️ **E `CLAUDE.md` mi ha confermato nell'errore**: dice *«quello che lo trattiene è la simulazione
gated `PMO_IS_TEST_ENV`, non l'indirizzo»*. È vero **per la strada dell'app**, che chiama il worker
e lì viene simulata. Sulla strada del **bot** il recinto è **esattamente l'indirizzo**, e sta una
porta prima. ⇒ Due strade, due protezioni diverse, e una frase giusta applicata a quella sbagliata.

## 🎯 E una cosa la prova l'ha dimostrata sul serio

**La griglia ha risposto con il worker morto** — cancello `HTTP 000`, e il bot ha comunque elencato
le fasce libere. È la tesi centrale della voce — *una copia risponde sempre, anche a worker morto* —
**verificata sul bersaglio**, non più creduta. La cura dell'app, nella stessa condizione, non
otterrebbe niente.

---

# La procedura VERA: si collauda su PROD, o non si collauda

L'esito ignoto nasce **solo dove il worker viene chiamato davvero**. Non c'è una scorciatoia:
è una protezione voluta, e va bene che ci sia.

## Le due strade, e la differenza è CHI VEDE, non cosa succede

| | dove si scrive | chi vede la chat | il rischio |
|---|---|---|---|
| **A — bot dei SOCI** (`@loziocoach_bot`) | PROD | i soci usano quel bot; la chat però è **tua** | nessun socio vede la prova, ma il bot è quello vivo |
| **B — bot di prova puntato a PROD** | PROD | **solo tu** | vuole la manovra delle **tre righe** del `.env`, quella col cartello più grosso in `CLAUDE.md` |

🚨 **La manovra B non si fa a cuor leggero**: `PMO_FUNCTIONS_URL`, `CONSUMER_BRIDGE_SECRET_FILE` e
**`PMO_PRENOTAZIONI_SIMULA`**. Chi ne sposta **due** porta il bot su PROD **senza** simulazione. Qui
la simulazione va tolta **apposta** — è il punto della prova — quindi il cartello vale doppio: quel
bot, finché il `.env` resta così, **prenota per davvero**.
⇒ Qualunque strada si scelga, **il `.env` si rimette com'era** appena finito, e lo si verifica con
la riga d'avvio.

## ⭐ E su PROD nessuna prenotazione vera nasce — se il cancello è passato

Con Caddy giù la richiesta **non arriva a Matchpoint**: la `fetch` verso il worker cade, ed è
proprio quello che genera l'esito ignoto. ⇒ Il campo resta libero.
📌 **Misurato il 15/08** sulla voce 41: con Caddy ucciso, `matchpoint-bookings-create` su PROD diede
`unknown` con `Worker network error`. La create usa **un solo** `MATCHPOINT_BROWSER_WORKER_URL`, e
in nessuna edge compare una porta di ripiego ⇒ chiuso Caddy, **non c'è un'altra via**.

🎁 **E stavolta il «no» diventa raggiungibile, ed è la strada felice del collaudo**: la copia di PROD
è viva. Riacceso Caddy, il sync riparte entro ~2 minuti, la copia diventa **più fresca** della
scrittura, e il verdetto passa a **`no`** — che è **vero**, perché la prenotazione davvero non c'è.
⇒ Si vedono **tutt'e due le facce**: il «non lo so» finché la copia è ferma, e il «no» appena è
fresca. Su TEST questo non era possibile.

---

## Passo 0 — pre-volo

**a) L'ora.** Il circolo dev'essere fermo per i pochi secondi in cui Caddy è giù: **nessuno
prenota**, né lo staff né i soci.

**b) Il bot deve dire dove punta**, ed è l'unica prova che valga:
```bash
ssh -i ~/.ssh/padel_deploy root@91.99.131.243 \
  'pm2 logs <assistente-telegram|assistente-telegram-prova> --lines 40 --nostream | grep -E "ponti edge|prenotazioni"'
```
🚨 Per questo collaudo **deve** dire `✍️ prenotazioni REALI`. È l'unico caso in cui quella riga è
quella giusta — e va riletta **dopo**, a `.env` rimesso a posto, per vederla tornare com'era.

**c) Lo slot**: data lontana, campo e ora che non usa nessuno. Una **partita**, non una
manutenzione.

## ① Controllo positivo

```bash
curl -m 5 -sS -o /dev/null -w "worker: HTTP %{http_code}\n" https://worker.91.99.131.243.nip.io/
```
**Deve stampare un numero** (404 va benissimo). Se dice già «Failed to connect», **fermarsi**.

## ② Fermare Caddy

```bash
ssh -i ~/.ssh/padel_deploy root@91.99.131.243 'systemctl stop caddy; systemctl is-active caddy'
```
📌 `failed` va bene quanto `inactive`: vuol dire comunque non attivo.

## ③ 🚦 IL CANCELLO — stesso comando del passo ①

**Deve dire `Failed to connect` / `HTTP 000`.** Se risponde un numero, **fermarsi e non prenotare**:
la prenotazione sarebbe **vera**. 🚨 Senza questo cancello, la notte del 14/08 nacquero **tre
prenotazioni vere** credendo di collaudare.

## ④ Prenotare dal bot — e le strade sono DUE

⚠️ **`bot.ts` aggancia l'attesa in due punti diversi**, e vanno provati tutt'e due:

| strada | come si esercita |
|---|---|
| **bottoni** | si chiede lo slot e si tocca **✅ Confermo** — ✅ **fatta il 16/08, verde** |
| ~~**modello**~~ | ~~si chiede lo slot e si conferma **scrivendo**~~ 🚨 **RIGA FALSA**: confermare scrivendo è impedito per costruzione. Vedi in testa alla scheda |

## ⑤ Riaccendere Caddy — subito

```bash
ssh -i ~/.ssh/padel_deploy root@91.99.131.243 'systemctl start caddy; systemctl is-active caddy'
curl -m 5 -sS -o /dev/null -w "worker: HTTP %{http_code}\n" https://worker.91.99.131.243.nip.io/
```
⭐ L'attesa **non passa da Caddy** (`verifica` è una chiamata alla edge e non chiama il worker):
il ciclo continua per conto suo, e la finestra col circolo fermo dura **secondi**.

---

## Le previsioni, dichiarate PRIMA

| quando | cosa deve succedere |
|---|---|
| **subito** | il bot dice che **non ha la conferma**, che **NON bisogna rifarla**, e che **ci pensa lui** («entro un quarto d'ora») |
| **subito** | ⛔ **non ripropone la griglia** e non invita a riprovare |
| **+1 minuto** | prima domanda al gestionale — si aspetta **prima** di chiedere |
| **prime domande** | `non_ancora / copia_ferma`: il sync è fermo anche lui, perché **passa dal worker** |
| **dopo la riaccensione** | entro ~2 minuti il sync riparte, la copia si rinfresca |
| **poi** | ⭐ verdetto **`no`**, motivo **`copia_aggiornata_dopo`** — e il bot scrive: *«Ho controllato: … non è stata registrata. Il campo è ancora libero…»* |

### Nei log del bot
```
[prenota] esito IGNOTO per <personaId> su <data> <ora> C<campo>: <dettaglio>
  ⏳ [attesa-esito] chat <id>: torno a chiedere per <data> <ora> C<campo> (scritta <istante>)
  ⏳ [attesa-esito] chat <id>: no
```

### Nei log del gestionale
```
[booking-write] verifica <data> <ora> C<campo> per <nome>: non_ancora/copia_ferma (copia al …)
[booking-write] verifica <data> <ora> C<campo> per <nome>: no/copia_aggiornata_dopo (copia al …)
```

---

## 🚨 COSA SAREBBE UN ROSSO VERO

| # | il rosso | perché è grave |
|---|---|---|
| ① | ⭐⭐ **il «no» esce PRIMA** che la copia si sia rinfrescata (motivo diverso da `copia_aggiornata_dopo`) | **è IL guasto.** Direbbe a un socio che il campo è libero senza averne la prova |
| ② | **nessun secondo messaggio** dopo 15 minuti, col bot vivo | il ciclo non è partito o è morto muto. Guardare **prima** i log: se manca `torno a chiedere`, non è partito |
| ③ | **il bot ripropone la griglia** o invita a rifare | è il danno originale: il tocco successivo prenota due volte |
| ④ | **una strada sì e l'altra no** (modello ok, bottoni muti, o viceversa) | i due agganci devono stare in pari |
| ⑤ | il ciclo parte su un rifiuto **normale** (campo occupato, troppi giorni) | un messaggio di troppo a chi non aspettava niente |
| ⑥ | esce **`rinuncia/guasto`** invece di un verdetto | non si è mai riusciti a **chiedere**: problema diverso, da indagare a parte |
| ⑦ | 🚨 **la prenotazione ESISTE davvero** su Matchpoint | il cancello non ha tenuto. Va **cancellata**, e la procedura rivista prima di rifarla |

### ⛔ E cosa NON è un rosso

- **`rinuncia/tetto`**, se per qualunque ragione il sync non è ripartito in tempo: è la risposta
  onesta, non un difetto.
- **Il secondo messaggio non arriva perché il bot è stato riavviato**: è il **limite dichiarato**,
  scelto dal committente il 16/08. L'attesa vive nel processo.

---

## 🎯 Il controllo positivo, e qui è GRATIS

Sulla strada di PROD non serve montarlo: il collaudo **contiene già** sia il caso in cui il «no» non
deve uscire (copia ferma) sia quello in cui deve (copia rinfrescata). ⇒ Se si vedono tutt'e due,
la prova non è inerte.

⚠️ Se invece si vedesse **solo** `copia_ferma` fino al tetto, la prova dimostra **metà**: che non
esce un «no» sbagliato, non che il «no» sappia uscire.

---

## Pulizia — non è opzionale

1. **Caddy**: `systemctl is-active caddy` deve dire `active`, e il `curl` tornare a un numero.
2. **Il `.env` del bot**, se si è usata la strada B: rimesso com'era, e **verificato dalla riga
   d'avvio** che il bot torni a dichiarare l'ambiente di prima.
3. **Su Matchpoint**: controllare che sullo slot **non ci sia niente**. Se c'è, cancellarla.
4. **Su TEST** è rimasta la partita di prova del giro fallito (26 agosto, 09:30, campo 1), marchiata
   `nata_in_prova`. Innocua — il circolo non è stato toccato — ma è lì.

---

## 🌙 Una cosa da NON fare a quell'ora

Fra l'**01:00 e le 06:00** il sync non gira (📄 `voce-53-ritardo-sync.md` §3.4): la copia non si
rinfresca mai, il verdetto resta `copia_ferma` e l'esito è `rinuncia/tetto` **per costruzione**.
Non c'è niente da collaudare a quell'ora — c'è solo da non scambiarlo per un guasto.
