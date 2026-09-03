# Passaggio di consegne — 03/09/2026, mattina (fine 74ª sessione)

**Come si usa:** incollalo come primo messaggio della chat nuova. È scritto per essere capito
**senza** la conversazione precedente.

---

## 🟢 LA PRIMA COSA DA SAPERE

> **Cinque voci chiuse in una mattina, e nessuna era una supposizione.** Ogni cura è nata da una
> misura presa sulla pagina viva o sul database, e due volte la misura ha **cambiato il disegno**
> rispetto a quello che lui aveva chiesto — con la sua parola, non alle sue spalle.
> ⏳ **Restano due prove fisiche, e sono sue: un click su una riga di cassa, e un incasso vero.**

| | inizio sessione | adesso |
|---|---|---|
| versioni app | PROD 6.277 · TEST 6.290 | **PROD 6.280 · TEST 6.293** |
| PR fuse | — | **#1286 #1287 #1288 #1289 #1290 #1291** |
| banco | 82 | **86 verdi / 0 rossi** |
| urgenti | 6 | **7** |
| chiuse | 104 | **108** |

⚖️ **Il filo della mattina:**
> *Tre volte su cinque la cosa che ha deciso il lavoro non era il difetto raccontato, ma un
> **numero** andato a prendere prima di scrivere.*
> La scheda tagliata non era tagliata (era **scrollata**). Il calendario che si spostava non si
> spostava (si spostava **l'etichetta sopra di lui**). E lo storno «dalla scheda socio» avrebbe
> coperto **il 46%** delle righe, perché metà della cassa sono **Ospiti**.

---

## 0. 📦 Stato alla consegna

| | |
|---|---|
| PR | **#1286 → #1291** tutte fuse. Nessuna aperta |
| rami | `main` ↔ `test-preview` **allineati** sui 4 percorsi sorvegliati (verificato dopo l'ultima fusione) |
| deployati | app **PROD 6.280** · **TEST 6.293** |
| banco | **86 verdi / 0 rossi** |
| migrazioni · edge | **nessuna toccata** |
| bot · worker | **non toccati** |

### ⛔ LE COSE DA FARE PER PRIME
1. **La voce 132** — l'importo cambiato a mano che deve arrivare su Matchpoint **e** sul gestionale.
   È **sua**, è aperta, e **non è ancora stata misurata**: è il lavoro che stava per cominciare (§4).
2. **Chiedergli le due prove fisiche** che chiudono la **133** e la **125** (§3).
3. La **129** (saldo wallet a colpo d'occhio) ha ancora **una domanda aperta** che aspetta lui (§5).

---

## 1. ✅ Prima di lavorare

```bash
git fetch origin main test-preview
git diff origin/main origin/test-preview -- CLAUDE.md docs/ .github/workflows/ \
  tools/matchpoint-browser-worker/src/server.mjs
```
✅ Dev'essere vuoto. 📕 `docs/lavori/README.md` si apre **PRIMA di lavorare**.
🚨 Clone shallow: `git reset --hard origin/<ramo>` dopo il fetch — **e verifica su quale ramo sei**:
in questa sessione due `python3` sono girati con la cartella sbagliata perché un `cd` di un comando
precedente era rimasto attaccato.

Il banco NON si lancia con `node --test`:
```bash
r=0; v=0
while IFS= read -r f; do
  grep -qE "^\s*(import|export).*['\"]jsr:" "$f" && continue
  if node "$f" >/dev/null 2>&1; then v=$((v+1)); else r=$((r+1)); echo "❌ $f"; fi
done < <(find supabase consumer-app tools test \( -name '*.test.ts' -o -name '*.test.mjs' \) | sort)
echo "$v verdi, $r rossi"
```

🩹 **Controlla l'ORA prima di scrivere una data**: `TZ=Europe/Rome date '+%Y-%m-%d %H:%M'`.

---

## 2. 🔨 COSA HA FATTO LA 74ª — cinque voci, e le misure che le hanno decise

### 🖼️ 127 — la scheda della partita «tagliata in alto» → era SCROLLATA

📏 Misurato su PROD 6.276 spazzando l'altezza utile del riquadro:

| eccedenza del pannello | titolo |
|---|---|
| 281px | ✅ si vede |
| **231px** | ❌ tagliato di **221px** |
| 81px | ❌ tagliato di 71px |
| 0 | ✅ si vede |

La chat dello staff si incolla in fondo quando mancano **meno di 260px** ⇒ una scheda che sborda di
**poco** ci cade dentro intera. **Colpisce proprio sullo schermo normale**, ed è il motivo per cui
non capitava sempre e rileggendo il CSS non si vedeva niente. E si ripeteva: la nota *«Aggiorno la
lista giocatori… (Ns)»* **riscrive sé stessa ogni secondo**.
🔨 Cura: un **tetto** all'auto-scroll — in fondo come sempre, **mai oltre la cima della scheda** — e
l'observer non strappa **mai** verso l'alto chi sta leggendo.

### 🗓️ 130 — il calendario che «sale e scende» → non era il calendario

📏 Catturato con `PerformanceObserver` su `layout-shift`, che dice anche **chi**: `div#staffCalV36`
189 → 213 (+24px) e, 4 secondi dopo, 213 → 189. Era `#staffCalCloudStatus` («aggiorno…») a crescere
**dentro il flusso** dell'intestazione (56 → 80px).
📌 *Quando esiste uno strumento che nomina il colpevole, provarlo costa meno che formulare la prima
ipotesi — e non si affeziona.*
🔨 L'etichetta esce dal flusso, con `line-height:1` (la sua riga è alta 17px contro 16 di margine).

### 🆕 131 — «Nuova prenotazione»: testa tagliata e campi su una riga

⭐ **La cosa che ha cambiato il lavoro è stata una sua frase**: *«fammi vedere un esempio prima di
sviluppare»*. Tre disposizioni disegnate alla larghezza vera e misurate; ha scelto la **A**. Senza
quel passaggio avrei scritto la **B** — la più corta, quella che *sembra* la lettura letterale di
«tutti su una riga» — perdendo i quattro pallini colorati, che sono la lingua del calendario.
📌 *Un esempio prima di scrivere non è cortesia: è il momento in cui il costo di una scelta si vede
invece di doverlo indovinare.*
🚨 Il taglio era **la 127 su un'altra scheda**: la cura era giusta, **l'elenco era corto**.
🚨⭐ **Due trappole misurate, nessuna deducibile**: un `<button>` in griglia **non riceve lo stretch**
(colonne 51,25px, bottoni 43, tutte e quattro le parole troncate) e **nemmeno `flex-grow` lo
allarga**. 📌 *La larghezza a un bottone gliela si dà, non gliela si chiede.*

### 🏷️ 128 — Cash · Card · Wallet ovunque nel gestionale

**51 sostituzioni una per una, mai un `sed`.** Intatte **tre famiglie di chiavi diverse fra loro**:
il permesso `view_members_borsellino` (vive nei **profili staff sul database**), le chiavi di dato
degli Incassi (i totali andrebbero a zero **senza errori in console**), e i testi che **Matchpoint
scrive** e il worker clicca **per testo**.
🩹 Curata la colonna «come» della scheda socio, che scriveva la **chiave grezza in minuscolo**.
🩹 E una riga della scheda dava per da fare una cosa **già fatta**: la sezione Incassi parlava già
inglese. 📌 *Una scheda scritta guardando il codice a colpo d'occhio elenca anche ciò che è già
fatto.*

### 💶 133 — lo storno dagli Incassi (§3, è quella che aspetta la sua prova)

---

## 3. ⏳ LE DUE PROVE FISICHE CHE MANCANO — sono sue

### ① Un click su una riga di cassa *(chiude la voce 133)*
> **Incassi → una riga di movimento → si apre la scheda della partita → ↩︎ su un giocatore.**

Cosa chiedergli: ① la riga si apre sulla partita giusta? ② nella scheda c'è il ↩︎ accanto a chi ha
già pagato? ③ lo storno arriva a termine?
🚨 **È denaro vero**: il ↩︎ nella scheda della partita **è acceso da stamattina**, su sua
autorizzazione esplicita (*«mi hai convinto, procediamo con la B»*).

### ② Il primo incasso vero *(chiude la voce 125, aperta dal 02/09)*
Scheda di una partita → riga di un giocatore che deve pagare → importo giusto → **Cash**.
⭐ Il metodo è suo: usare **incassi veri che deve fare comunque**, così la cassa è corretta per
costruzione.

---

## 4. ⛔ LA VOCE 132 — è il lavoro che comincia

🗣️ **Sua**, 03/09 mattina: *«quando su una scheda cambio l'importo e poi clicco salva me lo deve
riportare su Matchpoint e sul gestionale»*. 📸 Con schermata di PROD 6.278.

⛔ **NON MISURATA.** Le tre domande da chiudere **guardando**, prima di scrivere una riga:
① l'importo digitato oggi **dove finisce** quando si preme Salva?
② la scrittura dell'importo su Matchpoint **esiste già** nel worker (l'incasso lo imposta prima di
cliccare *Incassare*) o va aggiunta?
③ 🚨 **«e sul gestionale» in che forma?** Un importo **a carico** non è un pagamento: se finisse fra
i `payment`, la sezione Incassi lo conterebbe come **incassato**, che è falso finché nessuno paga.

🚨⭐⭐ **La regola che la governa è già scritta in `CLAUDE.md`**: *ogni gesto va detto al socio SOLO
DOPO che il circolo l'ha confermato — e nello STESSO ISTANTE dev'essere registrato dal gestionale.*
⇒ «su Matchpoint **e** sul gestionale» non sono due destinazioni a scelta: sono le due metà dello
stesso passo. È la voce 75 applicata al **denaro**.

---

## 5. ⏳ LE ALTRE VOCI APERTE

| voce | stato |
|---|---|
| **125** incasso nella scheda partita | in servizio, aspetta **il primo incasso vero** (§3) |
| **129** saldo wallet a colpo d'occhio | la pastiglia si può fare subito; ⏳ **il nome cliccabile aspetta la sua scelta**: ⓐ solo se non c'è niente di modificato · ⓑ con conferma · ⓒ si apre sopra senza cambiare tab |
| **132** l'importo a Matchpoint e al gestionale | §4 |
| **133** storno dagli Incassi | in servizio, aspetta il suo click (§3) |
| **92 · 83 · 65** | aspettano un caso |

---

## 6. 🧠 I DIFETTI PRESI, e come — la parte da non ripetere

- 🩹⭐⭐ **«Serve il suo schermo» era falso.** La scheda della 127 lo dichiarava, ed era vero **della
  strada che avevo provato** (cliccare un riquadro nel calendario, che la console non popola) e
  **falso del difetto**: la scheda si apre **chiamandola per nome** (`staffCalEditPlayers`), senza
  cliccare niente. 📌 *Prima di dichiarare che serve un altro paio di occhi, chiediti se c'è una
  porta di servizio.*
- 🩹 **La prima sonda della 131 sbagliava la SEQUENZA**: aperta la schedina senza che prima passasse
  un messaggio dalla chat **non si taglia**, perché è `svcAddMessage` a installare l'auto-scroll.
  📌 *Una sonda che salta un passo dell'antefatto risponde «non succede» con la stessa sicurezza.*
- 🩹⭐ **Uno zero letto troppo presto.** Per vedere la colonna «come» ho letto
  `__pmoPagamentiCache` **prima che fosse riempita**: 0 movimenti su 400 soci. Poi le ho dato 2,5
  secondi, a una lettura che scarica **quattro tipi di record interi**. Al terzo giro, con tempo
  vero, le righe c'erano. 📌 *Uno zero letto troppo presto non dice «non c'è»: dice «non è ancora
  arrivato».*
- 🩹 **Un campione non è una misura.** Ho scritto *«`mp_payment_ref` è vuoto»* guardando **6 righe**:
  ne sono 88 su 3183.
- 🩹 **Un numero preso prima della cura non descrive la pagina che la cura produce**: avevo scritto
  che l'etichetta «chiede 14px», misurati quando stava ancora **nel** flusso; fuori dal flusso la
  sua riga è alta **17**, e sbordava di 1px.

---

## 7. 🧰 ATTREZZI — quello che è servito davvero

| attrezzo | come |
|---|---|
| **console remota** | `cd tools/verifica-browser && npm ci && node console.mjs --env test\|prod --viewport 1440x900 --attesa 60000 --file <s.js> --out <r.json>`. Le `PMO_VERIFY_*` **ci sono già**. Il risultato: `python3 -c "import json;print(json.load(open('r.json'))['risultato'])"` |
| ⭐ **`PerformanceObserver` su `layout-shift`** | per «qualcosa si sposta»: dice **quanto** e **chi**. Ha risolto la 130 in un colpo |
| ⭐ **aprire le schede CHIAMANDOLE** | `staffCalEditPlayers(iso, campo, ora, nome, 90, 'partita')` e `svcOpenBookingCard(campo, iso, ora)` aprono i pannelli **senza** il calendario popolato ⇒ si diagnostica anche con `/functions/v1/` bloccato |
| 🚨 **la sequenza conta** | per riprodurre i tagli serve **prima** un `svcAddMessage(...)`: è lui che installa l'auto-scroll sul contenitore |
| **leggere le variabili** | non `window.x`: `const L=(n)=>{try{return eval(n)}catch(e){return undefined}}` |
| **il DB di PROD/TEST** | `mcp__Supabase__execute_sql` su `qqbfphyslczzkxoncgex` / `cudiqnrrlbyqryrtaprd`, tabella **`pmo_cloud_records`**. È da lì che sono usciti i numeri che hanno deciso la 133 |
| 🩹 **sintassi di `index.html`** | dopo una riscrittura grossa: estrai i `<script>` inline e `node --check` su ciascuno — 5 blocchi, e ha già evitato di spingere due conflitti non risolti |

---

## 8. 🤝 Come si procede (invariato)

> *«Procediamo sempre come tu pensi sia corretto»* — copre anche le promozioni; il freno è la
> **dichiarazione**. Fuori: **inventare voci non in lista**, e l'irreversibile/visibile (si dice
> **prima**, anche procedendo). ✋ **Un task non è finito finché non è provato fisicamente.**
> 📌 E: **«scrivi troppo» — risposte corte.**

⭐ **La regola che stamattina ha pagato di più, ed è la terza volta in due giorni**: *quando una
misura smentisce ciò che era scritto, si corregge la riga vecchia invece di affiancarla* — la 127
diceva «serve il suo schermo», la 128 elencava un lavoro già fatto, il commento del `_payVoidActive`
diceva «resta spenta». Tutte e tre corrette **dentro** la loro scheda, non in una nota a fondo
pagina.

⚠️ **E una che è costata una guardia rossa, bene**: quando una guardia si rompe per un cambio di
forma, la si **riporta sul fatto**, non la si allenta. La 128 controllava `pl.borsellino`, sparito
legittimamente con l'aggregazione; ora controlla le tre parole che `_incassiMethodBucket`
**restituisce**, che non cambiano forma quando cambia la tabella.
