# Passaggio di consegne — 07/09/2026, POMERIGGIO (100ª sessione)

> **Prompt di apertura per la chat nuova.** Copia il blocco fra le due righe.

---

## 📋 PROMPT DA INCOLLARE

> Riprendi il progetto **PADEL MATCH ORGANIZER**.
>
> Leggi PRIMA, in quest'ordine: **`CLAUDE.md`** (c'è un POSTULATO in testa che viene prima di
> tutto), **`docs/lavori/README.md`** (le tre liste) e questo file.
>
> ### 🔧 Quattro cose sull'ambiente, misurate — non fidarti della memoria
>
> · 🚨 **Il checkout locale nasce STANTIO.** Il 07/09 era **~50 commit indietro** con
>   `git status` che diceva «allineato»: il clone è **shallow**, quindi `git merge-base` mente.
>   ⇒ `git fetch --unshallow origin` e `git reset --hard origin/test-preview` **prima** di
>   credere a qualunque confronto. Costa un minuto e ha già salvato una sessione intera.
> · ⚠️ **La console remota vuole `npm install`** (`cd tools/verifica-browser && npm install`, ~1′):
>   il container nasce senza playwright. Le `PMO_VERIFY_*` **ci sono già** nell'ambiente cloud.
> · 🚨⭐ **`--allow-writes` su PROD può essere RIFIUTATO dal classificatore dell'ambiente**, ed è
>   **non deterministico**: il 07/09 lo stesso identico comando è passato alle 09:19, è stato
>   bloccato **tre volte** alle 11:00, ed è tornato a passare alle 12:00. ⇒ Non è un divieto del
>   progetto: se capita, **non insistere** — si dice al committente, che può dare il permesso, e
>   si riprova.
> · ✅ **Il worker NON si raggiunge dal container** (`worker.91.99.131.243.nip.io` è fuori
>   allowlist): il suo `/health` si legge **dal log del deploy**, che gira sui computer di GitHub.
>
> ---
>
> ## 🟢 SI RIPARTE DA QUI: LE URGENTI SONO **ZERO**
>
> Non è un modo di dire: la sezione 🔴 è vuota. Delle 13 in coda, la maggior parte **aspetta un
> caso che non si può provocare** o è **una decisione sua**. ⇒ La prima cosa da fare **non** è
> scegliere un lavoro: è **chiedere a lui su cosa vuole andare**, o guardare i due filoni qui sotto.
>
> ⛔ E la regola che regge tutto: **non si inventa un lavoro che nella lista non c'è.** La delega
> copre l'**ordine** delle voci, non la loro **esistenza**. Una voce nuova nasce da una misura o da
> una sua parola, mai da un'idea di fine giornata.
>
> ---
>
> ## ✅ COSA È STATO CHIUSO IN QUESTA SESSIONE (tutto in servizio su PROD e provato lì)
>
> | voce | cosa |
> |---|---|
> | **174** | 👛 la **correzione del borsellino** non trovava più il suo pulsante — curata, e chiusa **due volte**: prima dall'edge, poi **dal bottone** |
> | **165** | 🔥 il presunto **«11 GB di WAL al giorno»** — chiusa, e il numero di partenza era **falso** |
>
> ### 🥇 Le due cose da portarsi dietro, e valgono oltre questo progetto
>
> **① Uno ZERO non distingue «curata» da «rotta» da «nessuno la sta chiamando».**
> Curando la 165 ho guardato le scritture subito dopo il deploy: **zero**, e sembrava la prova.
> Non lo era — una funzione che va in eccezione produce lo **stesso identico zero**, e i log
> dicevano che in quella finestra le chiamate erano **6, le mie**. La prova vera è arrivata dieci
> minuti dopo, quando le tre cose stavano insieme: **434 chiamate** (l'app è in uso), **0 errori**
> (la guardia risponde), **1 scrittura** (non scrive più).
> 📌 *Quando lo zero che speri e lo zero del guasto sono lo stesso numero, quel numero non è una
> misura: va affiancato da qualcosa che dica che il meccanismo è stato ATTRAVERSATO.*
>
> **② Un elemento cercato nel contesto sbagliato non è «assente»: è ALTROVE.**
> La 174 sembrava «il pulsante non c'è più». Non c'era la **stanza**: un avviso swal2 copriva la
> ficha e **intercettava ogni click**, quindi il ledger del borsellino non si apriva mai — e il
> pulsante vive lì dentro. Il segno che lo diceva era già nella traccia: **le letture passavano e
> i click no**, che è la firma di un overlay.
>
> ---
>
> ## 📏 LE MISURE DI OGGI (da non rifare)
>
> | cosa | valore |
> |---|---|
> | correzione borsellino (edge) | **42,3 s** a worker libero |
> | ricarica dal bottone | **69,5 s** |
> | storno dal bottone **subito dopo** la ricarica | **231,7 s** — cinque volte tanto |
> | lettura `match_invitation` (23 righe) | 310 ms |
> | WAL **vero** di PROD | **522 MB in 48,68 h ⇒ ~257 MB/giorno su 646 MB = 0,4 a 1** |
> | scritture su `pmo_staff_profiles` | prima **0,91 per chiamata**, dopo **0,002** |
> | Fabiola Limuti | id interno **301** · borsellino **0,00 €** |
>
> 🚨 **E IL REPERTO CHE VALE PIÙ DEI TEMPI: due gesti incatenati si fanno la fila, e la verifica
> subito dopo NON passa.** Il worker è **UNO**: lo storno lanciato dopo la ricarica ha impiegato
> 231,7 s contro i 42,3 s dello stesso gesto a worker libero, e la rilettura di controllo lanciata
> subito dopo è tornata **504**, poi 200 due minuti più tardi.
> ⚖️ Quel 504 **non diceva «non è andata»: diceva «non lo so ancora»** — cioè `esito_ignoto`, la
> parola che questo progetto ha già coniato per il bot, qui incontrata dal lato di **chi verifica**.
> ⇒ **Dopo un gesto sul worker, la rilettura di controllo si fa a worker libero**, o si legge un
> timeout come un fallimento che non c'è stato.
>
> ---
>
> ## ⛔ COSA NON DARE PER FATTO
>
> · **La cura della 174 è provata contro IL guasto visto, non contro un avviso di forma diversa.**
>   La difesa è generica (`button.swal2-confirm`), ma il caso osservato era **uno solo**.
> · **La cura della 165 su `last_seen_at` ha una finestra di 5 minuti scelta da me**, non misurata
>   contro un requisito: `last_seen_at` si vede in **un solo posto** (colonna «ultimo accesso» in
>   amministrazione), quindi 5 minuti sembrano larghi — ma se un domani qualcuno volesse sapere
>   «chi è online adesso», quel campo **non serve più a quello**.
> · **La 143 resta APERTA** e la sua condizione non è cambiata: serve **un click suo** sul bottone
>   Wallet nella scheda partita, dall'app e non dall'edge. *Provare la strada non è provare la
>   porta da cui ci si entra.*
> · **In `tools/verifica-browser/` i due rami divergono** di un file
>   (`collaudo-esito-offline.mjs`, solo su `main` da agosto). **Non è sorvegliato** dalla guardia e
>   non l'ho toccato: non è una voce, è un fatto da sapere.
>
> ---
>
> ## 🗣️ LE RICHIESTE APERTE PER LUI — ne resta UNA sola
>
> **1️⃣ 👛 un click suo sul bottone «Wallet»** nella scheda della partita, su un socio che ha
> credito — *dall'app, non dall'edge*. Un minuto, e chiude la **143**.
>
> 🩹 La richiesta *«la 84 col difetto vero davanti»* resta com'era: **si fa quando capita**, non si
> può provocare.
>
> ---
>
> ## 🧭 REGOLE CHE HANNO GOVERNATO QUESTA SESSIONE (stanno nel `CLAUDE.md`, rileggilo)
>
> · la catena è **① sviluppo → ② provo su TEST → ③ porto su PROD SENZA CHIEDERE → ④ provo su
>   PROD → ⑤ avviso** — e il ③ **non si chiede**;
> · **la prova la faccio IO, lui supervisiona** — anche su PROD, con la console remota;
> · ⛔ **irreversibile o visibile da fuori si dice PRIMA**, anche procedendo: una scrittura vera
>   sul Matchpoint del circolo, un messaggio ai soci, `--allow-writes` su PROD, **e togliere un
>   indice su PROD**;
> · **il worker si modifica SOLO da `main`**, e subito dopo si riallinea `test-preview`;
> · prima `test-preview`, **poi** `main`; `docs/` e `CLAUDE.md` **identici** sui due rami;
> · 🚨 **la finestra del 4bis lascia `guard-worker-sync` rossa su `test-preview`** per i minuti fra
>   le due spinte: **la si rilancia** (`workflow_dispatch`), non si aspetta il backstop. Oggi è
>   successo **tre volte** ed è normale;
> · ogni cura si dichiara per quello che ha provato **e** per quello che **NON** ha provato;
> · 🧹 **una voce provata si sposta fra le chiuse SUBITO**, e i conteggi si aggiornano nello stesso
>   commit — sono dichiarati in **due** posti e `guard-docs-truth` li confronta numero per numero.

---

## 🔧 DETTAGLI TECNICI (fuori dal prompt — si leggono quando servono)

### Cosa è andato in servizio, e dove

| PR / migrazione | dove | cosa |
|---|---|---|
| **#1456** | **worker PROD** | la cura della **174**: l'avviso si toglie **prima** di aprire il ledger |
| #1457 · #1458 · #1459 | docs | la 174: causa trovata, chiusa, e il residuo del bottone |
| **`voce_165_last_seen_at_non_si_riscrive_se_fresco`** | **DB TEST + PROD** | `pmo_current_staff_profile()` non scrive più a ogni lettura |
| **`voce_165_via_indice_group_date_mai_usato`** | **DB PROD** | `drop index idx_pmo_cloud_records_group_date` |
| #1460 · #1461 · #1462 | docs | la 165: la cura, la prova sotto carico, la chiusura |

⚠️ **`APP_VERSION` è rimasta 6.390**: oggi non è stato toccato `index.html`. Le due cure della 165
sono **funzioni e indici del database**, non l'app ⇒ nessun deploy di Pages da aspettare.

⭐ **Il worker DICHIARA cosa sa fare** — si controlla, non si deduce dal ramo:
`/health` → `features: [… 'repeater-atteso-non-cronometrato', 'borsellino-avviso-tolto-prima']`.
Dal container non si raggiunge: si legge **nel log del deploy**.

### Come si è provata la 174, e perché la prova regge

⭐⭐ **Il segno di chiusura era stato SCRITTO PRIMA della prova.** Nel commit delle 09:08 stava già:
*«`matchpoint-wallet-correct` è andato 422 tre volte oggi — 08:33:24, 08:35:25, 08:51:01 — un 200 al
prossimo tentativo è la chiusura»*. Il registro dice **200 alle 09:19:51**.
📌 *Un criterio di successo dichiarato prima della prova non si può accomodare dopo: è l'unica
forma di verde che non si può concedere da sé.*

E la verifica **non è il ritorno della scrittura stessa**: il saldo è stato **riletto** da Matchpoint
con l'edge di lettura. *Una scrittura che si dichiara riuscita da sola non è una prova.*

Poi, su sua richiesta, rifatto **dal bottone**:

| | | |
|---|---|---|
| 10:49:12 | ricarica **+5,00 €** | UI 0,00 → 5,00 · cache 500 · **compare** «↩︎ Storna» |
| 10:52:03 | storno **−5,00 €** | anteprima 0,00 **prima** di premere · UI 5,00 → 0,00 · **sparisce** «↩︎ Storna» |
| 10:56:52 | Matchpoint | **0** |

⭐ Importo **5,00** e non 8,00 apposta: rende le due righe nuove inconfondibili nel ledger.
⭐ Il bottone «Storna» esiste **solo con saldo > 0** (`_walletHaSaldo`) ⇒ l'ordine ricarica→storno
non è una scelta, è l'unico possibile.

### Le trappole pagate scrivendo il banco della 174

· 🩹 **Un sabotaggio che non faceva cadere niente**: ne mutava **una sola** delle due `catch`, e
  l'altra bastava a far passare il caso. Il banco restava verde con la difesa tolta.
· 🩹 **Una guardia che passava per il motivo sbagliato**: il caso ⑤ controllava `/_ko:/`, che
  matcha anche `swal_dismiss:ledger_ko` ⇒ passava **senza mai toccare la riga che diceva di
  difendere**.
📌 *Un caso che non attraversa la riga che dice di difendere non la difende: la guarda da lontano.*

### Il bilancio della 165, che è la parte più istruttiva

Era nata come allarme **«11 GB di WAL al giorno, 16,7 a 1»**. Quel numero era **falso**: non era WAL
scritto, era l'avanzamento dell'LSN, che su Supabase avanza così **per costruzione**
(`archive_timeout = 120 s` chiude un segmento da 16 MB ogni due minuti, pieno o vuoto).

⇒ Delle **quattro** cure proposte alla sua apertura:

| | proposta | esito |
|---|---|---|
| ① | togliere l'indice che rompe l'HOT | **controproducente** — misurato su banco: i bloccanti sono **due**, e togliendone uno il guadagno è **zero**; due dei tre indici si usano davvero |
| ② | `fillfactor` sotto 100 | **inutile** da solo |
| ③ | il GIN sul payload | **giusta** — 45 MB per **una** lettura in 21 ore, tolto il 06/09 |
| ④ | «il battito di `pmo_staff_profiles` può scrivere ogni N minuti» | **scritta male**: non era un battito. Era che **ogni lettura dello staff era una scrittura** |

📌 *La voce si è chiusa curando due cose che alla sua apertura non erano nella lista, e non curando
tre che c'erano.*

### La cura di `last_seen_at`, e cosa la rende sicura

`pmo_current_staff_profile()` è la **guardia dei permessi**: ci passano **17 RPC** dello staff, e
scriveva `last_seen_at = now()` a **ogni** chiamata. Il costo vero non erano i byte (quegli update
sono HOT al 95%): era che **il carico cresce proporzionalmente all'uso**, cioè aumenta proprio
quando il gestionale arranca — la condizione in cui è nata l'avaria della **160**.

⚖️ **Il pezzo che rende la cura sicura**: il ramo di lettura usa lo **STESSO IDENTICO predicato**
dell'update che sostituisce ⇒ saltare la scrittura non può restituire una riga diversa da quella
che si sarebbe scritta. La rete di sicurezza preesistente (per email **o** per uid) non è stata
toccata.

📄 SQL e istruzioni per tornare indietro: `supabase/manual-sql/supabase_pmo_current_staff_profile_voce_165.sql`.

### Un fatto sull'ambiente che è costato tre tentativi

`--allow-writes` su PROD è stato **rifiutato dal classificatore** tre volte di fila alle 11:00,
dopo essere passato alle 09:19 e prima di tornare a passare alle 12:00. **Non è una regola del
progetto**: è il guardiano dell'ambiente, ed è non deterministico. La cosa giusta è **fermarsi e
dirlo**, non cercare scorciatoie — e infatti è bastato che lui desse il permesso.
