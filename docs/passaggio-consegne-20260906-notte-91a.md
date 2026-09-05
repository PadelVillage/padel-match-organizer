# Passaggio di consegne — 06/09/2026, notte (91ª sessione)

**Leggi PRIMA `CLAUDE.md` e `docs/lavori/README.md`, come sempre.** Questo file dice dove si è
arrivati alle **01:25 locali (23:25 UTC del 05/09)**. Tutto è committato e mergiato su
`test-preview` **e** su `main`.

🟢 **STATO: puoi operare.** Nessun rilancio a mano in sospeso, nessuno stub vivo da nessuna parte,
niente lasciato a metà su TEST né su PROD.

| | |
|---|---|
| **PROD** | app **6.369** (invariata: stanotte nessuna riga di `index.html`) |
| **TEST** | app **6.370** (invariata) |
| `main` | `9d474c4` |
| `test-preview` | `55a0e9d` (i due rami sono **allineati** su `docs/`, workflow, `CLAUDE.md`, `server.mjs` — verificato) |
| **bot** (`assistente-padel-agent`) | **non toccato**: quel repo è **fuori portata** in questa sessione (vedi §4) |
| liste | 🔴 urgenti **0** · 📋 in coda **15** (C 15 + D 0) · 📦 chiuse **145** |

PR di questa sessione: **#1401** (sentinella, codice) e **#1402** (docs). Nessuna PR sul bot.

---

## 0 · Cosa è successo, in cinque righe

1. 🩺⭐⭐ **VOCE 161 COSTRUITA E IN SERVIZIO** — la sentinella della salute del database. Era la
   più grossa rimasta in coda. **Resta aperta per un solo anello**, vedi §2.
2. 🔥⭐⭐ **E AL SUO SECONDO GIRO HA TROVATO UN DIFETTO VERO** ⇒ nasce la **voce 165**: la 160 non
   è finita, è solo rientrato il sintomo.
3. 🚦 **VOCE 162 CHIUSA** a prova provocata sulla pagina viva: il backoff che «voleva un'avaria»
   è stato fatto succedere invece che aspettato.
4. 🖱️ **VOCE 120** cercata sulla pagina viva: due fatti misurati, **nessuno dei due è una causa**,
   e un limite dell'attrezzo che va saputo (§3).
5. 🧹 `prova-urgenti-test` **cancellata** da `cudi…` (era il punto 6 del passaggio precedente).

---

## 1 · La 162, e la manovra che si riusa

**La scheda diceva che non si poteva**: *«il backoff non è stato visto sul vivo: vuole un
gestionale lento, e oggi risponde in un secondo»*.

⇒ **La lentezza non si aspetta: si fabbrica nel punto in cui il codice la legge.** Un ritardo
messo su `window.fetch` **dentro la pagina** di TEST, che risponde sempre un secondo più del
passo corrente. Il codice che decide resta quello **in servizio**: si tocca il **filo**, mai la
regola. È la manovra della **72**, spostata dalla edge al browser — e costa **una console
remota**, non un deploy.

📏 **E il passo non si deduce dagli intervalli: si LEGGE**, spiando cosa `svcGiroDiPolling`
passa a `setTimeout`. È il numero che il codice ha scelto, non quello che l'osservatore stima.

| | |
|---|---|
| salita, mentre le risposte tardavano | `8000` → `16000` |
| discesa, al **primo** giro tornato veloce | `4000` — non a scalare |
| chiamate sovrapposte | **0** |
| tetto, chiesto alla funzione in servizio | `(60s, 32s)` → `32000` |

⛔ **Dichiarato**: la lentezza era **fabbricata** (le durate misurate dal codice erano vere, la
loro **causa** no), e la salita è stata cavalcata fino a **16 s** — il tetto di 32 s è stato
verificato **chiamando** la funzione, non salendoci sopra.

📌 Lo snippet è in `/tmp/.../scratchpad/v162-backoff.js` — **effimero**. Se serve di nuovo si
riscrive: sono trenta righe, e il valore sta nel metodo, non nel file.

---

## 2 · La 161: cosa c'è, e l'unico anello che manca

**Dove sta**: `tools/sentinella-salute-db/` (README dentro) + workflow *Sentinella salute
database (voce 161)*, giro automatico **05:20 UTC** = 07:20 a Roma, più `workflow_dispatch` con
`prod`/`test` e gli interruttori `muto` / `prova`.

- **`misura.mjs`** — il pensiero puro: due letture entrano, un verdetto esce. Nessuna rete.
- **`sentinella.mjs`** — il giro: API di gestione Supabase, Telegram, memoria.
- **`banco-salute.mjs`** — **16 corse**, gira nel workflow **prima** di guardare il database vero.
- **`pmo_sentinella_salute`** — la memoria, **nel database che guarda** (migrazione applicata su
  `cudi…` e `qqbf…`; RLS accesa senza policy; una riga al giorno; si cancella dopo 400 giorni).

⭐⭐ **Gira su Actions e NON sulla VM, all'opposto della sorella, e la ragione va saputa**: quella
sorveglia la sincronia, che gira su Actions ⇒ lì sarebbe morta insieme a ciò che guarda. Questa
sorveglia **Supabase**, quindi l'argomento non si applica — e cade **a favore**, perché leggere
`pg_stat_user_tables` e `pg_ls_waldir()` vuole una credenziale di **amministrazione**: su Actions
`SUPABASE_ACCESS_TOKEN` c'è già e non esce mai, mentre sulla VM sarebbe una chiave capace di
cancellare il database posata accanto ai due bot.

✅ **Cosa è PROVATO** (e sono cose diverse, non una sola):
· **misura** — due database, catena intera dall'API di gestione al verdetto;
· **ricorda** — due righe nella storia di PROD;
· **giudica** — due allarmi veri su dati veri, al secondo giro;
· **tace quando deve** — `consecutivi: 1`, `mandati: []`: ha giudicato «fuori riga» e **non ha
  mandato niente**, perché ne vuole due di fila;
· **dice «non lo so»** — `hot` uscita `non-giudicata` su una finestra di 32 minuti, con motivo,
  invece di rassicurare;
· **sa parlare** — `--prova` alle **22:50:52 UTC**, `@padelvillage_prova_bot` → `📨 messaggio
  mandato`. Un messaggio vero su un telefono vero.

⏳ **L'UNICO ANELLO CHE MANCA: il messaggio d'ALLARME non è ancora partito.** Serve
`consecutivi = 2`, e arriva col **giro automatico delle 05:20 UTC**. Su una finestra di sei ore
anche `hot` avrà i numeri per pronunciarsi.
🎯 **⇒ Prima cosa da fare domattina: guardare se quel messaggio è arrivato.** Se sì, la 161 si
chiude a prova fisica. Se no, il perché è la prima diagnosi — e si legge nel registro del run e
nella riga 3 di `pmo_sentinella_salute`.
⛔ **Non chiuderla prima**, e non chiuderla su un verde: un allarme che nessuno ha visto arrivare
è esattamente la malattia che questa voce cura.

---

## 3 · La 120: due fatti, e nessuno dei due è una causa

⛔ **① Con l'utenza di SOLA LETTURA il difetto non si può nemmeno mettere in scena.** Aperta una
scheda socio vera su PROD: si apre, e **non contiene un solo campo di testo** — misurato **`0`**
fra `input` e `textarea` visibili in **tutta** la pagina. ⇒ *«vado a scrivere»* non è
esercitabile da lì, e non è un limite del difetto: è dell'attrezzo. La console monta un ruolo
`readonly`, e i campi in cui si scrive **per quel ruolo non vengono disegnati**.
🚨 **Va saputo prima di annunciargli una prova**: la console remota, così com'è, **non può
provare niente che passi dallo scrivere**. Un'utenza che può scrivere è una **decisione**, non un
passo — e su PROD è una decisione sua.

📏 **② A riposo, senza che nessuno tocchi niente, l'app si ricostruisce da sola**: in **25
secondi** fermi, **due** riscritture di `#staffCalGridTable.innerHTML`, per la strada
`staffCalRefreshFromCloud → renderStaffCalendar → _staffCalBuildHorizontal` (pila **catturata**,
non dedotta).
⛔ **Ma non è la causa**, e va detto: perché lo diventi bisogna vedere che il campo in cui si
scrive sta **dentro** ciò che viene rifatto, e quella metà non è stata guardata. Scriverla come
causa farebbe cercare quella invece del difetto — ed è la ragione per cui quella scheda nasce
senza ipotesi.

---

## 4 · ⛔ Cosa NON dare per fatto

- 🚨 **IL REPO DEL BOT È FUORI PORTATA in questa sessione.** `add_repo` è stato **rifiutato** e
  le API GitHub rispondono *«repository not configured for this session»*. ⇒ **I due residui
  della voce 119 non sono stati toccati** — la frase da 38 caratteri e il «🔄 Riprova a
  invitare» — perché vivono lì. Erano il punto 1 del passaggio precedente: **non sono stati
  dimenticati, sono stati impediti.** Chi riapre da una sessione che il bot ce l'ha, li trova
  intatti.
- **La 161 NON è chiusa** (§2), e il suo verde non è una prova: manca il messaggio d'allarme.
- **La 162 è chiusa su una lentezza FABBRICATA**, non su un gestionale davvero in ginocchio, e
  il tetto di 32 s è stato verificato chiamando la funzione invece che salendoci sopra.
- **La 165 non ha una cura, e nessun indice è stato toccato.** ⚠️ L'ordine conta: prima si
  **misura quale colonna indicizzata** rompe l'HOT su `pmo_cloud_records`, **poi** si decide. Al
  contrario si toglie l'indice sbagliato e resta tutto com'è, avendo però perso una lettura
  veloce. E **togliere un indice su PROD si dice prima.**
- **La 120 resta aperta**, e la strada dalla console è **sbarrata** finché l'utenza è `readonly`.
- Invariato dal passaggio precedente: **118** non ha visto nessun caso vivo; **115** scrive
  `gesto_dal_bot` solo al prossimo gesto di un socio dal bot su PROD; **122** non è stata
  esercitata sui soci.
- ⚠️ **Su TEST resta la prenotazione di prova** del 06/09 17:30 Campo 1 (marcata `PROVA-…`),
  ereditata dalla sessione precedente. Innocua.

---

## 5 · Cosa fare nella prossima sessione, in ordine

1. 🎯 **Guardare se l'allarme delle 05:20 UTC è arrivato**, e chiudere la **161** se sì (§2).
2. 🔥 **Voce 165** — la più grossa adesso, e ha una prima misura precisa da fare che non tocca
   niente: **quale colonna indicizzata cambia a ogni update di `pmo_cloud_records`**. Si legge
   dal codice del sync e si conferma con `pg_index`. Solo dopo si parla di togliere.
3. 📱 **Voce 119, i due residui** — appena il repo del bot è raggiungibile.
4. 🖱️ **Voce 120** — serve o il suo schermo, o un'utenza che può scrivere (decisione sua).
5. 💰 **La decisione sul compute è SUA** (MICRO oggi, SMALL ~15 $/mese): proporre, non fare.
   ⭐ **E adesso ha un argomento in più**: la 165 dice che il database produce 11 GB di WAL al
   giorno: curare quella potrebbe valere più dei 15 $, o renderli inutili. **Vale la pena dirgli
   le due cose insieme**, invece di chiedergli una spesa che forse non serve.
6. 🔎 **Fabio De Luca, lunedì 7 e martedì 8** — ⚠️ **non aperta apposta: chiediglielo prima.**

---

## 6 · Attrezzi, e cosa si è imparato su di loro

- 🩺 **La sentinella nuova**: `node tools/sentinella-salute-db/banco-salute.mjs` (il pensiero,
  senza toccare niente) · `sentinella.mjs --muto` (misura e giudica, non scrive e non manda) ·
  `--prova` (manda un messaggio e dice se ce l'ha fatta). Da Actions, `workflow_dispatch`.
- 🚨⭐ **Un `workflow_dispatch` non esiste finché il workflow non sta anche su `main`.** Il primo
  tentativo di lanciarlo dal ramo ha risposto **404**, e non era un permesso: è GitHub che il
  workflow lo cerca **sul ramo predefinito**. ⇒ Un attrezzo nuovo che si vuole lanciare a mano va
  **mergiato prima di poterlo provare**, e questo cambia l'ordine dei passi (il `ref` di lancio
  può poi essere qualunque ramo, ma il file dev'essere là).
- 🌐 **Console remota**: funziona, la preparazione del container è automatica. ⚠️ **Ma monta un
  ruolo `readonly`, e questo si vede nel DOM, non solo nelle scritture**: le pagine che
  quell'utenza non può modificare **non hanno i campi**. Prima di progettare una prova che passa
  dallo scrivere, si contano i campi.
- 🧊 **E su TEST il calendario è vuoto anche per la console**: `0` occupazioni idratando dal
  cloud. Per guardare un calendario vero si va su **PROD**, in lettura, che è autorizzato.
- 🚨 **Le variabili di stato dell'app NON stanno su `window`**: sono `let` di primo livello, cioè
  nello **scope lessicale globale**. `window.prenotazioniOccupazione` è `undefined` mentre
  `prenotazioniOccupazione` c'è. Una sonda scritta col `window.` davanti torna **zero** con la
  stessa sicurezza con cui tornerebbe la verità — ed è costato un giro.
- ⏱️ Nel container `sleep` da solo è bloccato: `until [ $(date -u +%s) -ge <istante> ]; do sleep 15; done`.
- 🧮 I conteggi si verificano **prima** di spingere, e sono **otto** numeri (i titoli di sezione
  **e** la tabella in cima). Gli `awk` stanno nel passaggio precedente e funzionano.
- 📌 **Ordine delle spinte**: prima `test-preview`, poi un ramo **da `main`** con le stesse righe
  e la PR. ⚠️ Stanotte un commit è finito **sul ramo della PR invece che su `test-preview`**
  perché `git checkout -B <ramo-main>` era rimasto attivo: si guarda `git branch --show-current`
  **prima** di committare, non dopo.
