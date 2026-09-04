# Passaggio di consegne — 04/09/2026, pomeriggio (fine 80ª sessione)

**Come si usa:** incollalo come primo messaggio della chat nuova. È scritto per essere capito
**senza** la conversazione precedente.

---

## 🟢 LA PRIMA COSA DA SAPERE

> **Oggi è cambiata una REGOLA, e viene prima di tutto il resto: la prova la faccio IO, lui
> supervisiona.** Sta in testa a `CLAUDE.md` come **POSTULATO PRINCIPALE**.
> 🗣️ Sue parole: *«Puoi anche fare tu la prova su prod prima di dirmi che il lavoro è ok. Io devo
> solo supervisionare che quello che hai detto risponde a verità.»*
> ⇒ Non gli si consegna un lavoro **da collaudare**: gli si consegna un lavoro **provato**, con
> scritto **cosa** è stato provato e **cosa no**.

🚨⭐⭐ **E IL LIMITE VERO, misurato oggi — il confine non passa dove sembra.** La console remota
entra come utenza **`readonly`**, quindi ogni gesto che **scrive** sbatte contro
`pmoBlockWriteIfReadonly` prima di partire.
· ✅ **guardare e calcolare** — su **TEST e su PROD**: una voce di menu, una scheda che si apre,
  un banner, due bottoni che si toccano, cosa risponde `elementFromPoint`, cosa scrive una
  funzione;
· ⛔ **scrivere davvero** — Salva da owner, incasso, prenotazione, giocatore tolto: **restano
  suoi**, perché lo strumento non li fa e perché su PROD toccherebbero il Matchpoint del circolo.
📌 *Il confine non è fra TEST e PROD: è fra **guardare** e **scrivere**.*

| | inizio sessione | adesso |
|---|---|---|
| versioni app | PROD 6.319 · TEST 6.320 | **PROD 6.328 · TEST 6.329** |
| PR fuse | — | **#1328 → #1334** (sette) |
| banco | 94 verdi | **97 verdi / 0 rossi** |
| voci chiuse | 117 | **120** (144, 145, 146) |

---

## 0. 📦 Stato alla consegna

| | |
|---|---|
| PR | **#1328, #1329, #1330, #1331, #1332, #1333, #1334** tutte fuse |
| rami | `main` ↔ `test-preview` **allineati** sui 4 percorsi sorvegliati (verificato) |
| deployati | app **PROD 6.328** · **TEST 6.329** |
| worker · bot · edge | **non toccati** |
| guardie | `guard-worker-sync` ✅ · `guard-docs-truth` ✅ (era **rossa da ieri sera**, corretta) |

### ⛔ LE COSE DA FARE PER PRIME
1. **Verificare che PROD serva davvero 6.328** (`curl -s https://app.padelvillage.club/ | grep -o
   "APP_VERSION = '[0-9.]*'"`) e **fare la prova fisica della 146 su PROD** — l'ultima rimasta in
   sospeso: a 390 px, aprire una scheda, scorrere finché una riga giocatore arriva sotto la ✕, e
   verificare che nel punto **accanto alla ✕ Chiudi** risponda la **fascia** e non un bottone.
2. **Lui prova dal cellulare** (l'ha chiesto): è la verifica finale, non il collaudo.
3. La **142** è a metà: id interno e Osservazioni dentro il gestionale.

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
🩹 Sintassi di `index.html`: `node test/controlla-sintassi.mjs`
🩹 Ora prima di scrivere una data: `TZ=Europe/Rome date '+%Y-%m-%d %H:%M'`
🩹 **La console remota vuole `npm install`** in `tools/verifica-browser` in ogni sessione nuova.
🆕 **La console accetta `--viewport 390x844`**: senza, «l'ho guardata» vuol dire «su un solo
schermo» — e i tre difetti di oggi si vedevano **solo** a larghezza telefono.

---

## 2. 🔨 COSA HA FATTO LA 80ª — quattro voci

### 🔻 144 — via la sezione «Assistente AI» (CHIUSA)
🗣️ *«Quando decidi tu puoi eliminare la sezione Assistente AI sia da test che da prod.»*
Tolti: il capitolo dalla barra, il pannello `#assistanteAI` (Vocabolario · Modalità apprendimento
· Consumo Gemini), il permesso `view_assistante_ai` dall'albero ruoli, il CSS e **33 funzioni**.
**−635 righe, +22.**
⛔ **NON tolto**: il motore `PMOAi` — `logManual` (il diario che scrivono venti gesti), `execBegin/
execEnd`, `isEnabled`, e `#svcChatPanel`, che dalla 141 **è la finestra delle schede**.
⚠️ **Restano orfane 4 edge** (`ai-propose-lexicon`, `ai-lex-examples`, `ai-reason`, `ai-parse`):
vive e innocue, **non toccate di proposito** — cancellarle è un gesto a parte, da chiedergli.

### 🪟 142 — la scheda si apre CON i giocatori (PRIMO PASSO, voce APERTA)
🗣️ *«Continua a esserci la rotellina che pensa e mi dice "leggo i giocatori da Matchpoint":
questo non dovrebbe più esistere.»*
🚨⭐⭐ **La misura ha spaccato il difetto in DUE**, ed è la lezione: dei roster in `staff_booking`,
**173 sono elenchi di OGGETTI** e **67 di STRINGHE** (il sync scrive i nomi, il worker gli
oggetti) e `_normRoster` **teneva solo i secondi**. ⇒ Per i 173 la rotellina copriva nomi che
c'erano; per i 67 **sotto non c'era niente**. Curare solo il velo avrebbe lasciato un quarto
delle partite con una sezione **vuota** — *peggio, perché una sezione vuota sembra una risposta*.
🔨 ① `_normRoster` accetta le stringhe · ② il velo si alza solo dove non c'è niente da mostrare ·
③ **tre** segni di pagamento invece di due (stato non letto ⇒ cerchio grigio «non lo so», non la
✗ rossa «da incassare») · ④ `rosterRefreshing`, flag separato con un rigo discreto.
⚖️ Rischio accettato: l'elenco locale può essere vecchio ~2′. 🚨 **Ma non può far togliere la
persona sbagliata**: la rimozione manda il **nome**, mai la posizione — e il banco ⑤ difende
quella riga, che è **il freno di tutta la scelta**.
⏳ **RESTA APERTA**: id interno e Osservazioni dentro il gestionale al primo incontro del sync ⇒
**i soldi arrivano ancora dal worker**, la **138** aspetta l'id, e la seconda metà della **143** pure.

### 🔔 145 — un avviso solo per un fatto solo (CHIUSA)
🗣️ *«C'è ancora un doppio banner di messaggio, ce ne deve essere solo uno.»*
🚨⭐⭐ **Su quel difetto erano già passate DUE voci** — la **136** (doppione con la pastiglia) e la
**137 ⑤** (la regola: *gli avanzamenti escono dalla scheda, gli esiti restano*, applicata a
`svcAddMessage`). **Nessuna delle due guardò `_svcSchedaEsito`**, il **terzo** posto in cui una
frase può comparire. 📌 *Una regola applicata in due punti su tre non è una regola: è una
coincidenza, e tiene finché il terzo punto non viene usato.*
🔨 `_svcSchedaEsito` non disegna i `wait` e toglie la riga vecchia. ⛔ Gli **esiti restano**: la
barra dura 6-14 s, un rifiuto col motivo serve anche cinque minuti dopo.

### ✕✕ 146 — le due ✕ non si toccano (CHIUSA su TEST, ⏳ PROD da verificare)
🗣️ *«Penso che la doppia x sia qualcosa da analizzare.»* — **aveva ragione lui**: io l'avevo letta
come «due chiusure, brutte ma innocue».
🚨⭐⭐ **NON ERANO DUE CHIUSURE**: una chiude la finestra, l'altra è la **✕ Rimuovi giocatore**, che
toglie qualcuno dalla partita e finisce **su Matchpoint**.
📏 A 390 px si **sovrapponevano** su **8 × 28 px**; bastavano **5 px più a sinistra** per togliere
un giocatore mirando a chiudere.
⚖️ Causa: la fascia della ✕ è alta **52 px**, i messaggi ne riservavano **30** — 22 di terra di
nessuno — ed era `left:auto` + `transparent`, cioè **copriva la ✕ innocua e lasciava scoperta la
pericolosa**.
🔨 Ora **opaca, a tutta larghezza, altezza dichiarata** (`height:44px`): ciò che le scorre sotto è
coperto e **inerte**. Costo netto **8 px** (non si rimette la testata da 50 che la 141 tolse).
🔔 **E cercando il doppio sul Salva ne è saltato fuori un terzo**: `pmoBlockWriteIfReadonly`
diceva la stessa frase **due volte** (scheda **e** toast) — unica coppia del genere su **530**
chiamate a `showAlert`. Ora sono alternativi.
✅ **Il salvataggio da owner è pulito**, provato un messaggio per volta: `mp-sync-head`, «Modifica
non riuscita», «Non ho la conferma», avanzamento roster **non entrano in chat**; la domanda
dell'assistente e «Modifica salvata, ma c'è una cosa da controllare» **restano**.
⚠️ **Non provato**: il percorso completo del Salva **da owner** (gate readonly).

---

## 3. 🧠 I DIFETTI PRESI — la parte da non ripetere

- 🩹⭐⭐ **Ho DEDOTTO un numero invece di misurarlo.** Altezza della fascia: «bottone 30 + padding
  4+4 = **38**» — la pagina viva ne misurava **48**. Dieci pixel di contenuto nascosti, e una
  guardia che confrontava due numeri che combaciavano **solo nella mia aritmetica**.
  📌 *Se un numero deve combaciare con un altro, il modo di farli combaciare è **scriverli**.*
- 🩹⭐ **Una sonda che pesca la PRIMA occorrenza di un nome dichiarato due volte non misura il
  pezzo di cui parla**: `.svc-chat-close-btn` esiste per desktop **e** per telefono, e il banco
  leggeva quella sbagliata dicendo «l'altezza non si legge più» invece della verità.
- 🩹⭐ **Ho quasi archiviato la doppia ✕ come innocua.** Era il gesto **distruttivo** ad essere in
  gioco. *Prima di dire «è solo estetica», guarda cosa fanno i due bottoni.*
- 🩹 **`git stash -u` porta via anche l'index**: un conflitto risolto e `git add`-ato è sparito
  cambiando ramo, e la promozione è ripartita da 6.319 senza avvisare.
- 🩹 **`git apply --3way` in serie**: il primo conflitto va risolto **e `git add`**-ato, o la
  patch successiva fallisce con *«does not exist in index»*.
- 🩹 **`guard-docs-truth` era ROSSA da ieri sera** (in coda: 17 dichiarate con 15 voci; chiuse:
  116 con 117) e nessuno l'aveva guardata. *Una guardia che resta rossa si smette di leggere.*

---

## 4. 🔎 FATTI MISURATI CHE VALE LA PENA NON RISCOPRIRE

- **I roster hanno DUE forme**: `staff_booking` → 173 record con oggetti (`nome`, `codice`,
  `codiceCliente`), **67 con stringhe**. Gli oggetti **non** portano `idCliente`, quindi importi e
  stato pagamento arrivano **solo** dal worker.
- **`staffBookings` nel browser si idrata dopo ~2-4 s** dall'apertura del Calendario: una sonda
  che guarda subito lo trova **vuoto** e conclude il falso.
- **La console remota blocca `/functions/v1/` di proposito** (strada verso il worker condiviso ⇒
  Matchpoint vero): da lì le riletture falliscono **all'istante**, quindi le durate reali non si
  misurano. `--allow-writes` disarma **anche le scritture**: non si usa per una misura.
- **PROD ha `max-age=600`**: dopo un merge il numero da solo non basta, si guarda `last-modified`.
- **Il caricatore di TEST arriva live in ~20-30 s**, ma `raw.githubusercontent.com` serve
  `app-meta.json` da una cache più vecchia: per sapere se è live si guarda `app.html`, non `raw`.
- **Promozione a PROD**: si portano **le righe** (`git show <sha> -- index.html | git apply
  --3way` su un ramo basato su `main`), **mai** l'`index.html` di `test-preview` (833 inserzioni
  di distanza). Verificare sempre `grep -c pmo-mp-sim` = **0**.
- **Numeri**: a ogni promozione **PROD prende il numero che TEST ha**, e **TEST riparte da +1**.
  1 = allineati, più di 1 = lavoro su TEST non ancora promosso.

---

## 5. ⏳ COSA RESTA IN PIEDI

| | |
|---|---|
| **142** (aperta) | id interno + Osservazioni nel gestionale al primo incontro del sync ⇒ chiude anche la **138** e la seconda metà della **143** |
| **146** | ⏳ manca la **prova su PROD** della distanza fra le due ✕ (su TEST è fatta) |
| **4 edge orfane** | `ai-propose-lexicon`, `ai-lex-examples`, `ai-reason`, `ai-parse`: vive e innocue, cancellarle è un gesto da chiedergli |
| **doppio messaggio** | se ne vede ancora uno **salvando da owner**, serve la sua schermata: il percorso non è attraversabile dalla console |

---

## 6. 🤝 Come si procede

> 🥇 **POSTULATO**: la prova la faccio io — su TEST **e** su PROD — e lui **supervisiona che quel
> che ho detto sia vero**. Il confine è fra **guardare** (mio) e **scrivere** (suo).
> *«Procediamo sempre come tu pensi sia corretto»* — copre anche le promozioni; il freno è la
> **dichiarazione**. Fuori: **inventare voci non in lista**, e l'irreversibile/visibile (si dice
> **prima**, anche procedendo).
> ✋ Un task non è finito finché non è provato **fisicamente**.
> 🎨 Ogni modifica **visibile** parte da un mockup approvato (`mockup/`), e va detto prima.
> 📌 E: **«scrivi troppo» — risposte corte.**

⭐ **La regola che oggi ha pagato di più:** *quello che si vede lo trova solo chi guarda — e alla
larghezza giusta.* I tre difetti di oggi (rotellina, doppio banner, doppia ✕) erano **tutti**
invisibili a 1440 px e tutti veri a 390.
