# Passaggio di consegne — 07/09/2026, MATTINA (99ª sessione)

> **Prompt di apertura per la chat nuova.** Copia il blocco fra le due righe.

---

## 📋 PROMPT DA INCOLLARE

> Riprendi il progetto **PADEL MATCH ORGANIZER**.
>
> Leggi PRIMA, in quest'ordine: **`CLAUDE.md`** (c'è un POSTULATO in testa che viene prima di
> tutto), **`docs/lavori/README.md`** (le tre liste) e questo file.
>
> ### 🔧 Tre cose sull'ambiente, misurate — non fidarti della memoria
>
> · 🚨 **Il checkout locale può essere STANTIO.** Il 06/09 era **50 commit indietro** con
>   `git status` che diceva «allineato»: il clone è **shallow**, quindi `git merge-base` mente.
>   ⇒ `git fetch --unshallow origin` (o `--deepen`) **prima** di credere a qualunque confronto.
> · ⚠️ **La console remota vuole `npm install`** (`cd tools/verifica-browser && npm install`, ~1′):
>   il container nasce senza playwright. Le `PMO_VERIFY_*` **ci sono già** nell'ambiente cloud.
> · ✅ **DENO SI INSTALLA — da npm, non da deno.land.** `npm install deno` porta un Deno vero
>   (2.9.6). ⛔ Ma `jsr.io` è **fuori allowlist**, quindi `deno check index.ts` su un'edge muore
>   sull'import `jsr:` della riga 1: si copia la cartella fuori dal repo, si sostituisce quella
>   riga con uno stub, e il conteggio degli errori torna **identico a quello della CI**.
>   📏 Servito il 07/09 a trovare un errore di tipo in due minuti invece di indovinarlo a colpi
>   di CI.
>
> ---
>
> ## 🔴 SI RIPARTE DA QUI: LA VOCE 174, ed è l'unica urgente
>
> **👛 La correzione del borsellino non trova più il suo pulsante — e ha lasciato denaro addosso
> a una persona vera.**
>
> 🚨 **La cosa da sapere subito: Fabiola Limuti ha 8,00 € di borsellino che NON le spettano.**
> Sono il rimborso dello storno di una prova con carta. Finché la voce è aperta si tolgono **a
> mano** dal gestionale: *scheda socio → Portafoglio → Correzione del saldo, −8,00 €*.
> ⇒ **Chiediglielo, o proponi di rifarlo tu appena la cura c'è.**
>
> 📏 **Il guasto, misurato due volte identiche** (`matchpoint-wallet-correct`, `subtractCents: 800`,
> id interno 301):
> > `WALLET_CORRECTION_UI_NON_TROVATA` — *«Pulsante "Correzione del saldo" non trovato»*
> > `correzioneCandidates: []`
>
> Traccia: `open_ficha:301` · `saldo_pre:800` · **`wallet_subtab:none`** · **`swal_dismiss:corr_pre`**
> (e legge `walletTextPre: "Portafoglio: 8,00 €"`, quindi **sulla ficha giusta ci arriva**).
>
> ⚖️ **Lo stesso gesto è riuscito TRE volte su tre nella notte** (ultimo successo: **06/09
> 22:11:27Z**). Primo fallimento: **07/09 08:33**. In mezzo il worker è stato **ridistribuito**
> (deploy delle 08:26).
> ⛔ **Ma quel deploy NON tocca `correct_wallet`**: cambia `_findParticipantRow` e la lettura del
> roster, e `correct_wallet` non passa da nessuna delle due. ⇒ Il sospetto **non è il codice
> nuovo, è il RIAVVIO** — sessione browser nuova, che può incontrare un avviso che una sessione
> vecchia aveva già chiuso. È esattamente ciò che `swal_dismiss:corr_pre` racconta.
> 🚨 **È un'IPOTESI, non una diagnosi. Non curare prima di aver guardato.**
>
> 🔨 **Il primo lavoro è la SONDA, non la cura**, ed è la stessa medicina che ha risolto la 171:
> `correzioneCandidates` **esiste già e torna VUOTO** ⇒ non elenca abbastanza (iframe? un'altra
> sotto-scheda?). Allargarlo perché dica **cosa VEDE** — iframe compresi, in sola lettura — è il
> passo uno.
> 📌 *Una sonda che torna una lista vuota non dice «non c'è niente»: dice «non ho guardato dove
> serviva».*
>
> ---
>
> ## ✅ COSA È STATO CHIUSO IN QUESTA SESSIONE (tutto in servizio su PROD)
>
> | voce | cosa |
> |---|---|
> | **173** | il **sync degli incassi cancellava lo storno** — curata, provata su TEST e PROD |
> | **171** | l'**incasso dalla scheda partita**: tutti e tre i metodi visti riuscire |
> | **172** | *(aperta, in coda)* spuntando il capitolo dei permessi le sottosezioni non si attivano |
>
> ### 🥇 La cosa da portarsi dietro, e vale oltre questo progetto
>
> **Uno specchio non può cancellare un fatto che nasce da noi.** Il sync degli incassi
> ricostruiva il payload da capo a ogni giro con `status: 'paid'` fisso, e cancellava lo storno
> che il gestionale aveva appena scritto. Il sync gira **ogni 5 minuti** ⇒ negli Incassi uno
> storno durava **al massimo cinque minuti**.
> ⭐ **E la misura che ha cambiato la gravità della voce**: su **3297** pagamenti vivi di PROD il
> campo `status` aveva **UN SOLO VALORE**, `paid`. Zero storni, in tutto il database. Non era
> sfortuna: era lo **stato stazionario** — ogni storno mai fatto era già stato cancellato.
> ⛔ **E il passato non si recupera**: Matchpoint non dice quali pagamenti erano stornati (il
> report 11.13 non ha quella colonna) e da noi non è rimasta traccia. **La cassa storica resta
> gonfiata di un importo ignoto**, e non è un lavoro rimandato: è un dato che non esiste.
>
> ---
>
> ## 📏 LE MISURE DELLA MATTINA (da non rifare)
>
> | cosa | valore |
> |---|---|
> | incasso **contanti** | 23 s |
> | incasso **borsellino** | 10,8 s |
> | incasso **carta** | **5,1 s** — il più veloce: salta la cassa dei contanti |
> | **storno** | 12-22 s |
> | lettura roster (`matchpoint-bookings-edit` con `read:true`) | 2,1-3,0 s |
> | sync incassi a mano, finestra 3 giorni | 21-83 s |
> | Fabiola Limuti | id interno **301** · codice **000291** · idx **2** nella 9844 |
> | partita di servizio | **9844** = 07/09 · 10:30 · Campo 4 |
>
> 🚨 **E TRE REPERTI CHE VALGONO PIÙ DEI TEMPI:**
> · **il rimborso di uno storno finisce SEMPRE nel borsellino**, qualunque sia il metodo con cui
>   si era incassato — misurato **tre volte su tre**. ⇒ *Dopo ogni storno si guarda anche il
>   saldo, non solo il pendente e lo stato.*
> · col **borsellino** la finestra del rimborso **non compare** (`storno_rimborso:assente`); con
>   **carta** e **contanti** compare (`storno_rimborso_accetta`);
> · lo storno marca le righe **per cliente e SLOT**, non per movimento ⇒ può marcarne **più di
>   una** (`righeMarcate: 2` la prima volta, `1` la seconda perché le altre erano già `void`).
>
> ---
>
> ## ⛔ COSA NON DARE PER FATTO
>
> · **La cura dell'attesa sul repeater (171) NON è provata contro il guasto che l'ha fatta
>   nascere.** Il `GIOCATORE_NON_TROVATO` su un giocatore che c'era è **intermittente** e non si
>   sa provocare; la causa **non è stata trovata**. È provato il meccanismo (banco, 26 casi,
>   6 sabotaggi) e che **non costa niente** sulla strada normale (`repeater:comparso:giro1`,
>   2,1-3,0 s). ⇒ **La prova arriverà dai registri**: se comparirà un `repeater:comparso:giro2`
>   o un `repeater:ricaricata`, **quello sarà il giorno in cui l'incasso sarebbe fallito e non è
>   fallito**. Vale la pena andarlo a cercare ogni tanto.
> · **La voce 143 resta APERTA** e la sua condizione non è cambiata: il pagamento col borsellino
>   è stato mandato **all'edge diretta**, quindi il ramo dell'app che **rilegge il saldo** non è
>   stato esercitato. ⇒ Serve **un click suo** sul bottone Wallet nella scheda partita. *Provare
>   la strada non è provare la porta da cui ci si entra.*
> · **La 172 non è stata misurata**, solo aperta: prima di curarla vanno guardate tre cose (se il
>   difetto sia solo nel disegno della casella o anche nel salvataggio; se togliendo il capitolo
>   le sottosezioni restino accese; cosa apra il capitolo spuntato da solo).
>
> ---
>
> ## 🗣️ LE RICHIESTE APERTE PER LUI — ne resta UNA sola
>
> **1️⃣ 👛 un click suo sul bottone «Wallet»** nella scheda della partita, su un socio che ha
> credito — *dall'app, non dall'edge*. Un minuto, e chiude la **143**.
>
> 🩹 La richiesta *«un incasso vero con carta»* **è stata esaudita** ed è stata tolta dalla lista:
> l'ho fatto io il 07/09. *Una richiesta che resta scritta dopo essere stata esaudita non è
> vecchia: mente.*
>
> ---
>
> ## 🧭 REGOLE CHE HANNO GOVERNATO QUESTA SESSIONE (stanno nel `CLAUDE.md`, rileggilo)
>
> · la catena è **① sviluppo → ② provo su TEST → ③ porto su PROD SENZA CHIEDERE → ④ provo su
>   PROD → ⑤ avviso** — e il ③ **non si chiede**;
> · **la prova la faccio IO, lui supervisiona** — anche su PROD, con la console remota;
> · ⛔ **irreversibile o visibile da fuori si dice PRIMA**, anche procedendo: una scrittura vera
>   sul Matchpoint del circolo, un messaggio ai soci, `--allow-writes` su PROD;
> · **il worker si modifica SOLO da `main`**, e subito dopo si riallinea `test-preview`
>   (punto 2). Il worker è **condiviso TEST+PROD**: ogni suo deploy tocca la produzione;
> · prima `test-preview`, **poi** `main`; `docs/` e `CLAUDE.md` **identici** sui due rami;
> · 🚨 **la finestra del punto 4bis lascia `guard-worker-sync` rossa su `test-preview`** per i
>   minuti fra le due spinte: **la si rilancia** (`workflow_dispatch`), non si aspetta il
>   backstop. *Una guardia che resta rossa si smette di leggere.*
> · ogni cura si dichiara per quello che ha provato **e** per quello che **NON** ha provato.

---

## 🔧 DETTAGLI TECNICI (fuori dal prompt — si leggono quando servono)

### Cosa è andato in servizio, e dove

| PR | dove | cosa |
|---|---|---|
| #1448 | docs | `guard-docs-truth` era **rossa da tre ore**: la 171 promossa e il riepilogo a `0`. Più due righe del `CLAUDE.md` corrette (l'utenza della console **non** è più `readonly`) |
| #1449 | docs | il giro col borsellino, e la nascita della 173 |
| **#1450** | **edge PROD** | **la cura della 173**: `storno-preservato.ts` + 8 errori di tipo preesistenti portati a 0 |
| #1451 · #1452 | docs | la 173 chiusa, e la prova del cron |
| **#1453** | **worker PROD** | **la cura della 171**: l'attesa sul repeater |
| #1454 | docs | la 171 chiusa, la 174 aperta |

⭐ **Il worker DICHIARA cosa sa fare** — si controlla, non si deduce dal ramo:
`/health` → `features: [… 'cobro-nel-frame-del-dialog', 'cobro-confermato-in-cassa',
'storno-conferma-rimborso', 'repeater-atteso-non-cronometrato']`.

### Come si è provata la 173, e perché la prova regge

Non «non è successo niente di male», ma **«è passato di lì e non è successo niente»**:

| dove | cosa | esito |
|---|---|---|
| TEST | storno piantato su `pay\|1\|1\|2026-09-06\|1000\|cash\|1` → sync vero (23 righe) | ancora `void` · `storniPreservati: 1` |
| PROD | due righe vere marcate `void` → sync (50 righe, 30,7 s) | ancora `void` · `storniPreservati: 2` |
| **PROD, cron 07:30** — *non lanciato da nessuno* | riscritte (`synced_at` aggiornato) | **ancora `void`** |
| **PROD, cron 08:35** — *dopo la prova con carta* | | `storniPreservati: 3` |

⭐ **Il dettaglio che rende la prova forte è il `synced_at` DELLA RIGA**: aggiornato al giro nuovo
⇒ la riga non è stata *saltata*, è stata **riscritta**, e lo storno è rimasto.

### Il metodo che ha funzionato tre volte di fila, e conviene riusarlo

**Prima la sonda, poi la cura.** Ogni volta che un gesto moriva su Matchpoint, la domanda giusta
non era *«come si chiama il bottone»* ma **«in quale stanza sono?»** — e la risposta è arrivata
facendo elencare al worker **cosa vede**, iframe compresi, in sola lettura.

📌 *Un elemento cercato nel contesto sbagliato non è «assente»: è **altrove**, e le due cose si
somigliano solo per chi guarda da un posto solo.*

E il gemello, che è quello che ha risolto il resto:

📌 *Un'attesa fissa non distingue «non c'è» da «non c'è **ancora**», e le due vogliono cure
opposte.*

### Due trappole delle sonde, pagate in questa sessione

· 🩹 **Ho letto un campo che non esiste.** Cercavo `payload.stornato` e il campo si chiama
  `voided_at`: `null` diceva «non stornato» con la stessa faccia con cui avrebbe detto la verità.
  ⇒ **Prima di concludere da un `null`, si guarda come si chiama davvero il campo nel codice che
  lo scrive.**
· 🩹 **Un sabotaggio che non faceva cadere niente.** Nel banco della 171 i casi «senza
  diagnostic» uscivano al **primo giro**, cioè **prima** del ramo che dicevano di difendere: il
  banco era verde con la difesa tolta. ⇒ *Un caso che non attraversa la riga che dice di
  difendere non la difende: la guarda da lontano.*

### Una cosa che sembrava un difetto e NON lo era

Il tombstone del sync scrive `status: 'voided'` mentre l'app riconosce `'void'` — **sembra** un
buco, e non lo è: il tombstone scrive anche `deleted: true`, e `_incassiFetch` salta le righe
cancellate ⇒ è metadato morto su una riga già invisibile. **Non toccato**: sarebbe stato curare
una cosa sana.

📌 *Guardare prima di curare vale anche — e soprattutto — quando si è già convinti.*
