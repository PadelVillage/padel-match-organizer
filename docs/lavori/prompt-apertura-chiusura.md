# I prompt di sessione: apertura, chiusura, e la pensione delle memorie

Stanno qui, nel repo, per lo stesso motivo per cui ci sta `README.md`: un prompt scritto a memoria
invecchia senza che nessuno se ne accorga. Quello di apertura in uso fino al 13/08/2026 mandava ad
aprire la memoria **`lavori-urgenti`**, che il 13/08 è andata in pensione — e la sessione del 14/08
è partita cercando una fonte che non esiste più.

⚠️ **Si copiano e si incollano così come sono.** Se cambia il modo di lavorare, si cambiano **qui**,
non nella testa di chi apre la chat.

📌 **Il terzo prompt si usa UNA VOLTA SOLA**, dal Mac, e poi si può dimenticare: manda in pensione
le memorie `lavori-*` per davvero. Sta in fondo.

---

## 🟢 Prompt di APERTURA

> Riprendi il progetto PADEL MATCH ORGANIZER.
>
> Apri **`docs/lavori/README.md`** e parti dalle **🔴 urgenti**. È lì che stanno i lavori — urgenti,
> in coda, chiuse — più le memorie tematiche e lo stato del sistema all'ultima misura.
>
> Non leggere `📋 IN CODA` né `📦 CHIUSE` di tua iniziativa. Se le urgenti si esauriscono, dimmelo e
> **proponimi** cosa promuovere dalla coda: **la scelta la faccio io**.
>
> ⚠️ Le memorie `lavori-urgenti`, `lavori-in-coda`, `lavori-chiusi` e `lavori-chiusi-storico` sono
> **in pensione dal 13/08/2026**: non aprirle e non scriverci. Il loro contenuto è nel file qui sopra.
> Le altre memorie — VM, `.env` del bot, chiavi, decisioni personali — restano dove sono e valgono.
>
> 🔎 **La scheda di un lavoro è un'ipotesi, non una misura.** Prima di eseguire, verifica **sul
> bersaglio** che le righe citate siano davvero quelle: numeri, date e nomi nelle schede sono stati
> scritti a memoria e più di una volta erano sbagliati. Se la misura contraddice la scheda,
> **fermati e dimmelo** — non correggere la scheda per farla tornare e proseguire.
>
> 🚨 Prima di cancellare qualunque cosa: misura **cosa punta a quella riga** e dimmelo. Se una riga
> che la scheda chiama «di prova» risulta anche in **PRODUZIONE**, fermati: là non è rumore, è un
> dato del circolo.

### Perché ogni riga è lì

| riga | il guasto che cura |
|---|---|
| «apri `docs/lavori/README.md`» | 13/08: la sessione partì **senza** la lista e lavorò mezza giornata su cose scelte da sé |
| «la scelta la faccio io» | le promozioni dalla coda alle urgenti sono del committente, si **propongono** |
| «memorie in pensione» | 14/08: il prompt mandava su `lavori-urgenti`, svuotata il giorno prima |
| «la scheda è un'ipotesi» | 14/08: la voce 22 diceva «partita 9305 del 13/08, riga di prova». Erano **due** partite (9305 dell'11/08 e 9306 del 13/08) e **nessuna** era di prova: entrambe dati veri del circolo |
| «misura cosa punta a quella riga» | il caso Ospite: «elimina tutto» avrebbe buttato **€ 7.937** di incassi |

---

## 🔴 Prompt di CHIUSURA

> Chiudiamo la sessione. Prima di salutarci, nell'ordine:
>
> 1. **Aggiorna `docs/lavori/README.md`**: sposta le voci chiuse, riscrivi la fotografia in cima e
>    correggi i **conteggi** — urgenti, C, D, coda (C+D), chiuse — sia nei titoli di sezione sia
>    nella tabella. La CI li verifica **uno per uno e non solo la somma** (`guard-docs-truth`):
>    il 13/08 due errori opposti si annullavano e il totale tornava lo stesso.
> 2. **Rimisura, non ricordare**: `APP_VERSION` dall'`index.html` dei due rami, sha, PR aperte. Se
>    `docs/stato-progetto-corrente.md` dichiara versioni diverse da quelle vere **correggilo**:
>    quella tabella blocca la CI, perché quel file promette in testa a sé stesso di essere corrente.
> 3. **Specchia sui due rami** ciò che `guard-worker-sync` sorveglia: `docs/`,
>    `.github/workflows/**`, `CLAUDE.md`, `server.mjs`. Se divergono, fallisce.
> 4. **Committa e pusha.** In cloud il container viene riciclato: quello che non è pushato si perde.
> 5. Scrivimi in chat, in breve: **cosa è chiuso**, **cosa è rimasto aperto e perché**, e **cosa non
>    hai potuto misurare** da dove giravi (dal cloud mancano VM, worker, `.env`, secret, memoria
>    dell'app e la vista dell'app col login staff).
>
> ⚖️ Non chiudere una voce che non hai verificato sul bersaglio. «Il codice è a posto» non è
> «funziona»: il 13/08 due errori veri sono passati sotto sintassi verde e rete di regressione verde,
> e li ha trovati il committente aprendo l'app.

### Perché ogni riga è lì

| riga | il guasto che cura |
|---|---|
| conteggi uno per uno | 13/08: sezione C dichiarava 11 con 12 voci, D 5 con 4 — si annullavano |
| «rimisura le versioni» | `stato-progetto-corrente.md` è stato **689 versioni** indietro per tre mesi |
| «specchia sui due rami» | la sicura dei bottoni Matchpoint stette **solo su TEST** per dieci giorni |
| «committa e pusha» | in cloud il container muore e si perde tutto |
| «cosa non hai potuto misurare» | dal cloud metà del sistema è invisibile: dirlo evita che passi per verificato |

---

## 🧹 Prompt UNA TANTUM — mandare in pensione le memorie `lavori-*`

**Da usare dal Mac, una volta sola.** Dal cloud non si può: la memoria dell'app non è raggiungibile
e non esiste nessuno strumento che la tocchi — verificato il 14/08/2026, non dedotto.

🚩 **Perché serve ancora, anche col prompt di apertura nuovo.** Quel prompt dice «non aprire le
memorie `lavori-*`», e protegge dal caso *la sessione va a cercarle*. Non protegge dall'altro: le
memorie dell'app possono essere **servite da sole** nel contesto, senza che nessuno le apra, e lì
il divieto non arriva. ⚖️ È un rischio di **confusione**, non di danno — chi legge anche
`docs/lavori/README.md` trova la contraddizione e il prompt gli dice a chi credere — quindi **non è
urgente**. Ma finché non si fa, il progetto ha due fonti che si contraddicono, ed è la malattia
curata il 13/08.

> Devi svuotare delle memorie dell'app che sono in pensione dal 13/08/2026, e sostituirle con un
> rimando. Sono queste, e SOLO queste:
>
> `lavori-urgenti`, `lavori-in-coda`, `lavori-chiusi`, `lavori-chiusi-storico`, più le memorie
> tematiche su **Gmail** e sull'**autovalutazione**.
>
> Per ciascuna: cancella tutto il contenuto e mettici **solo** questa riga —
>
> «In pensione dal 13/08/2026. I lavori e le memorie tematiche stanno in `docs/lavori/README.md`
> nel repo `padel-match-organizer`, che ogni sessione carica da sola tramite `CLAUDE.md`.
> Non riscrivere le liste qui: due copie divergono.»
>
> 🚨 **Non toccare NESSUN'ALTRA memoria.** Quelle su VM, `.env` del bot, chiavi SSH, decisioni
> personali e preferenze **restano dove sono**: il repo non le sostituisce, e chi svuota deve saper
> distinguere. Se non sei sicuro che una memoria sia una delle sei elencate, **lasciala stare e
> chiedimelo**.
>
> ⚠️ Prima di cancellare, **fammi vedere cosa c'è dentro** ciascuna delle sei: se una contiene
> qualcosa che NON è nel repo — una decisione, un numero, un perché — quello va prima portato in
> `docs/lavori/README.md` con una PR, e solo dopo si svuota. Svuotare per primo perde l'unica copia.
>
> Alla fine dimmi quali hai svuotato e quali hai lasciato stare, e perché.

### Perché è scritto così

| riga | il guasto che cura |
|---|---|
| l'elenco chiuso delle sei | evita che una sessione zelante svuoti anche le memorie che servono |
| «lasciala stare e chiedimelo» | nel dubbio non si cancella: è il rito dell'Ospite, dove «elimina tutto» avrebbe buttato **€ 7.937** |
| «fammi vedere cosa c'è dentro» | svuotare per primo perde l'unica copia di quello che non è nel repo |
| il testo del rimando, già scritto | così il committente non deve inventarselo, e le sei memorie dicono tutte la stessa cosa |
