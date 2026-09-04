# Passaggio di consegne — 04/09/2026, mattina (fine 79ª sessione)

**Come si usa:** incollalo come primo messaggio della chat nuova. È scritto per essere capito
**senza** la conversazione precedente.

---

## 🟢 LA PRIMA COSA DA SAPERE

> **Il restyling del calendario è FATTO e in PROD, chiuso a prova fisica sua dal cellulare.**
> Ma la cosa che conta di più non è la cura: è **che tre difetti su quattro li ha presi il
> GUARDARE, non il rileggere** — e il quarto l'ha preso il suo dito su un telefono vero.
> ⏳ **Il lavoro che comincia** è la conversazione che ha aperto lui dopo, e che ha già una
> forma decisa insieme: **la scheda completa al click** (voce 142) e **il borsellino in cassa**
> (voce 143).

| | inizio sessione | adesso |
|---|---|---|
| versioni app | PROD 6.311 · TEST 6.312 | **PROD 6.319 · TEST 6.320** |
| PR fuse | — | **#1322 → #1326** |
| banco | 92 verdi | **94 verdi / 0 rossi** |
| urgenti · in coda · chiuse | 5 · 15 · 116 | **5 · 17 · 117** |

⚖️ **Il filo della mattina, e non è lusinghiero per me:**
> *Tre volte ho dichiarato un limite guardando l'attrezzo che conoscevo, senza cercare se ce
> n'era un altro. Tre volte è stato LUI a smentirmi con una domanda —* «mi sa che già lo
> scarichiamo da qualche parte, controlla» *— e aveva ragione tutte e tre.*

---

## 0. 📦 Stato alla consegna

| | |
|---|---|
| PR | **#1322, #1323, #1324, #1325** fuse. ⚠️ **Controlla che la #1326 sia stata fusa**: era l'ultima e la CI stava girando |
| rami | `main` ↔ `test-preview` allineati sui 4 percorsi sorvegliati |
| deployati | app **PROD 6.319** (live, verificata) · **TEST 6.320** · **funzione SQL `pmo_dispatch_data_routines` applicata su PROD** |
| worker · bot · edge | **non toccati** |

### ⛔ LE COSE DA FARE PER PRIME
1. **Verificare che la #1326 sia fusa** e ricontrollare la parità dei rami.
2. **Rifare il mockup della 142**: quello che c'è (`mockup/scheda-giocatori-subito-mockup.html`)
   descrive una forma **superata** dalla conversazione — vedi §3.
3. La **143**, che è la cosa che protesterà per prima quando c'è la fila in cassa.

---

## 1. ✅ Prima di lavorare

```bash
git fetch origin main test-preview
git diff origin/main origin/test-preview -- CLAUDE.md docs/ .github/workflows/ \
  tools/matchpoint-browser-worker/src/server.mjs
```
✅ Dev'essere vuoto. 📕 `docs/lavori/README.md` si apre **PRIMA di lavorare**.
🚨 Clone shallow: `git reset --hard origin/<ramo>` dopo il fetch.

Il banco NON si lancia con `node --test`:
```bash
r=0; v=0
while IFS= read -r f; do
  grep -qE "^\s*(import|export).*['\"]jsr:" "$f" && continue
  if node "$f" >/dev/null 2>&1; then v=$((v+1)); else r=$((r+1)); echo "❌ $f"; fi
done < <(find supabase consumer-app tools test \( -name '*.test.ts' -o -name '*.test.mjs' \) | sort)
echo "$v verdi, $r rossi"
```
🩹 **Sintassi di `index.html`**: `node test/controlla-sintassi.mjs`.
🩹 **Controlla l'ORA prima di scrivere una data**: `TZ=Europe/Rome date '+%Y-%m-%d %H:%M'`.

🚨 **E una trappola che mi è costata oggi**: la console remota (`tools/verifica-browser`) in una
sessione cloud nuova **non ha `node_modules`** → `Cannot find package 'playwright'`. Si cura con
`npm install` dentro quella cartella, e da lì funziona.

---

## 2. 🔨 COSA HA FATTO LA 79ª — il restyling, voce 141 (CHIUSA)

🗣️ **Sua decisione a colazione**: *«Ho preso una decisione. Facciamo un restyling. Leviamo
totalmente l'assistente digitale… la scheda appare sopra il calendario, come nella sezione
anagrafica soci»* · *«il menu lo lascerei in alto e quello spazio lo sfrutterei per ampliare il
calendario»* · *«portiamo il messaggio della barra dentro la scheda, in basso»*.

| | |
|---|---|
| **① via l'assistente** | composer, microfono, «Invia», barra di scrittura del telefono, bottone 💬 |
| **② la scheda è una finestra** | `position:fixed` centrata sopra il calendario, fondo scuro, si adatta al contenuto. **214 → 860 px** |
| **③ via la colonna a sinistra** | solo su desktop. Colonna calendario **1058 → 1362 px (+29%)** |
| **④ la striscia della 137** | due case: in fondo alla scheda quando è aperta, **pastiglia** quando è chiusa |

⛔ **La cosa da NON rifare al contrario**: togliere l'assistente **portandosi via il
contenitore**. `#svcChatPanel` resta e **cambia mestiere** — da chat a finestra — così le venti
strade che disegnano schede, flussi ed esiti dentro `#svcChatMessages` non cambiano di una riga.

🚨⭐⭐ **SU TELEFONO LA COLONNA È IL MENU** (il cassetto del ≡): la regola che la nasconde vive
**dentro** `min-width:900px`, e una guardia del banco si rompe se qualcuno la sposta fuori.
*Da computer sarebbe tutto giusto e il telefono resterebbe senza navigazione.*

### 🩹 I QUATTRO DIFETTI, e da dove sono usciti
| | difetto | l'ha preso |
|---|---|---|
| ① | finestra alta **tutto lo schermo** su una scheda di tre righe (600px di bianco) | una **schermata** |
| ② | striscia `hidden` **e dipinta lo stesso** — fascia azzurra vuota in fondo a **ogni** schermata, da 8 giorni | una **schermata** |
| ③ | testata con la sola ✕ che si mangiava 50px | una **schermata** |
| ④ | sul telefono il «✅ fatto» **schizzava in cima allo schermo** | **il suo dito** |

📌 **La ② è la più istruttiva**: `[hidden]{display:none}` è una regola del **browser**, la più
debole che ci sia, e perdeva contro `.svc-semaforo{display:flex}`. Ed era **cieca alle sonde**,
perché `pointer-events:none` fa rispondere «il calendario» a `elementFromPoint`.
📌 **La ④ è la più bella**: non era un difetto di nessuno dei due pezzi. Alla conferma il foglio
si chiude da sé (giusto), e chiudendosi la striscia diventa pastiglia (giusto) — che era ancorata
al bordo **alto**. ⇒ *Due comportamenti giusti presi da soli ne fanno uno sbagliato quando si
incontrano, e a farli incontrare è l'unica cosa che nessuno dei due conosce: **l'ordine**.*

🗣️ **E una sua richiesta**: *«sulla barra c'è scritto "da te"? io lo leverei»* ⇒ tolto.
⛔ **Ma il «chi» della CODA resta** («richiesta da un socio»), e lui l'ha confermato: *«va bene
così lascia il richiesta da un socio»*. È l'unica cosa che dice a chi fa segreteria *se è stata
lei o no*.

---

## 3. ⏳ IL LAVORO CHE COMINCIA — 142 e 143

### 🪟 142 — la scheda completa al click

🗣️ Nata da lui, provando dal cellulare: *«la lettura dei giocatori ci mette un sacco di tempo,
ma lui ha già i giocatori dentro il gestionale… perché ogni volta dobbiamo andare a leggere
Matchpoint?»* → *«ogni due minuti importiamo tutti questi dati anche se da fonti diverse, così
quando clicco su una scheda ho tutti i dati immediatamente»*.

📏 **Misurato, e la sua intuizione era giusta a metà — è la metà che cambia la cura:**

| dato | ce l'ha il gestionale | dove sta altrimenti |
|---|---|---|
| **nomi** | ✅ ogni 2′ (roster dalla `descrizione` dell'export) | — |
| **id interno** | ❌ | **solo** nella scheda della singola prenotazione (`HiddenFieldIdCliente`) |
| **Osservazioni** | ❌ | idem |
| **importi/pagamenti** | ✅ 3242 record, freschi | — |

📏 **La prova che chiude la questione delle Osservazioni**: la nota *«ciao ciao»* che lui ha
salvato il 03/09 alle 23:10 su Campo 3 · 05/09 · 15:00 **non c'è** nel record — al suo posto
`"-Maurizio Aprea.-Laura Aprea.-Fabiola Limuti."`, cioè la lista dei nomi.

🩹 **E il difetto che lui VEDE è nostro**: la scheda i nomi locali li ha già in mano
all'apertura — poi li **nasconde**. `rosterLoading` copre Giocatori e Pagamenti finché il worker
non risponde. Il commento tre righe sopra dice *«apri SUBITO la scheda con i giocatori già noti
in locale»*, e la riga sotto li copre.

🔨 **La forma DECISA INSIEME** (e il mockup esistente **non** la descrive più): id e Osservazioni
stanno nello **stesso posto**, quindi si prendono con **una** lettura, al **primo incontro** del
sync con una prenotazione — poi **solo quando i nomi cambiano**, che l'export dice.
⇒ Al click la scheda è completa. **Niente attesa, niente bottoni spenti**: quella era una mia
proposta, ed è caduta.
📏 Costo: **300** prenotazioni future (158 con giocatori) una tantum, poi **~40/giorno**.
⭐ E non è lavoro nuovo: è la **stessa** lettura che oggi si fa a **ogni apertura di scheda**.
⚠️ Buco stretto: due omonimi che si scambiano lascerebbero i nomi identici ⇒ prima di un gesto
**distruttivo** si rilegge comunque.
🎁 Chiude anche la **voce 140**: l'id interno oggi ce l'hanno **146 soci su 5766**.

### 👛 143 — il borsellino in cassa

✅ **Già in servizio da oggi**: i saldi si rinfrescano **ogni 10 minuti** (routine `wallet` nello
scheduler PROD). Provato dal vivo: dispatch **11:20:00**, saldi riscritti **11:20:23**.

🗣️ **Ma lui si è contraddetto subito dopo, e ha ragione**: *«quando facciamo le operazioni di
cassa che c'è tanta gente, se non si aggiorna velocemente poi qualcuno della segreteria può
protestare»*.

⚖️ **Accorciare il ritmo NON è la cura**: il dispatcher manda **una** routine per giro, quindi
ogni tick preso al borsellino è tolto alle prenotazioni; e il worker è **un browser solo**.
🔨 **La cura precisa**: dopo un'operazione di cassa sappiamo **esattamente** di chi è cambiato il
saldo ⇒ si rinfresca **quello**, sul colpo. Seconda metà, quando ci saranno gli id: all'apertura
di una scheda si rinfrescano i **≤4** giocatori di quella partita.
📌 *Un dato che si muove non si insegue col ritmo: si rinfresca dove lo si muove.*

---

## 4. 🧠 I DIFETTI PRESI — la parte da non ripetere

- 🩹⭐⭐ **Tre volte ho dichiarato un limite guardando l'attrezzo che conoscevo.** «Il borsellino
  non può entrare nel giro dei 2 minuti» · «vorrebbe dire 2800 aperture di scheda» — vere per
  `read-wallet` (una scheda per persona), **false** per `/export-wallet-report`, che li porta
  tutti in un file solo. A smentirmi è stato lui: *«mi sa che già lo scarichiamo da qualche
  parte, controlla»*. **È la 26ª in diretta.**
- 🩹⭐ **Una sonda che ritaglia troppo dice sempre di sì.** Un sabotaggio non è caduto: la sonda
  ritagliava dal selettore alla **fine del blocco** e trovava un `display:none` venti righe sotto.
  Il ritaglio si chiude alla **graffa della regola**.
- 🩹 **`\b` non funziona sui nomi CSS**: `\.side-nav\b` pescava `.side-nav-close` e
  `.side-nav-chat-host`. Serve `(?![\w-])`.
- 🩹⭐ **Il sabotaggio si fa su una COPIA.** Ho sabotato il file di lavoro e l'ho «ripristinato»
  con `git checkout index.html`, cancellando due cure non ancora committate.
- 🩹 **`git apply --3way` lascia il file in conflitto anche quando il conflitto è una riga sola**
  (l'`APP_VERSION`): va risolto **e `git add`**-ato, o le patch successive falliscono con
  *«does not exist in index»*.

---

## 5. 🔎 FATTI MISURATI CHE VALE LA PENA NON RISCOPRIRE

- **Il sync porta i NOMI, non i numeri**: `giocatori` nel record è un array di **stringhe**
  (`["Maurizio Aprea","Laura Aprea"]`). Il tabellone raschia righe di testo.
- **L'id interno serve anche al BORSELLINO**: `read-wallet` risponde `INVALID_CLIENT_ID` senza.
  ⇒ Il `👛 —` che si vede per il 97% dei soci non è un timeout: **non possiamo chiedere**.
- **`wallet_balance` = chi HA credito** (40 record). Chi non c'è ha zero — ⚠️ da confermare prima
  di mostrarlo come `0,00 €` invece del trattino.
- **Il dispatcher manda UNA routine per giro** — chi ne aggiunge una la toglie a un'altra.
- **`pmo-cloud-backup-auto` è in `VERIFY_JWT_FUNCTIONS` ed è già dispacciato dallo scheduler**:
  è la prova che la publishable key come Bearer passa `verify_jwt`.
- **Promozione a PROD**: si portano **le righe** (`git show <sha> -- index.html | git apply
  --3way` su un ramo basato su `main`), **mai** l'`index.html` di `test-preview`: i due file
  distano **833 inserzioni** prima ancora del lavoro di oggi.
- **La console remota vuole `npm install`** in `tools/verifica-browser` in ogni sessione nuova.
- **PROD ha `max-age=600`**: dopo un merge si guarda `last-modified`, non solo il numero.

---

## 6. 🤝 Come si procede (invariato)

> *«Procediamo sempre come tu pensi sia corretto»* — copre anche le promozioni; il freno è la
> **dichiarazione**. Fuori: **inventare voci non in lista** (la 142 e la 143 nascono dalle sue
> parole, ed è lecito), e l'irreversibile/visibile (si dice **prima**, anche procedendo).
> ✋ **Un task non è finito finché non è provato fisicamente.**
> 🎨 **Ogni modifica VISIBILE parte da un mockup approvato** (`mockup/`), e va detto prima.
> 📌 E: **«scrivi troppo» — risposte corte.**

⭐ **La regola che oggi ha pagato di più:** *quello che si vede lo trova solo chi guarda.* Tre
difetti su quattro sono usciti da una schermata della pagina viva, e il quarto dal suo dito. Le
misure erano tutte verdi.
