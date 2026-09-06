# Passaggio di consegne — 06/09/2026, sera (94ª sessione)

> **Prompt di apertura per la chat nuova.** Copia il blocco qui sotto.

---

## 📋 PROMPT DA INCOLLARE

> Riprendi il progetto **PADEL MATCH ORGANIZER**.
>
> Leggi PRIMA, in quest'ordine: **`CLAUDE.md`** (il *postulato in testa*: la prova la faccio io,
> lui supervisiona; la promozione a PROD **non si chiede**), **`docs/lavori/README.md`** (le tre
> liste), e questo file.
>
> 🚨 **Il checkout locale può essere STANTIO** — succede quasi ogni volta: `git status -sb` PRIMA
> di tutto, e se serve `git checkout -B test-preview origin/test-preview` tenendo un ref di
> backup.
> ⚠️ **La console remota vuole `npm install`**: il container nasce senza `playwright`.
> `cd tools/verifica-browser && npm install` (~1 minuto), **nella stessa riga di comando**.
> ⚠️ **Deno NON si installa da qui** (il proxy risponde 403 a `deno.land`). Le prove Deno le lancia
> solo la CI. In locale si può eseguire un modulo `.ts` puro con
> `node --experimental-strip-types`, ed è quello che ho usato per il banco della 142.

---

## 📏 STATO ALLA CHIUSURA — misurato, non ricordato

| | |
|---|---|
| **PROD** | app **6.382**, viva dalle **13:53:23 UTC** |
| **TEST** | app **6.383** (1 = allineati) |
| liste | 🔴 urgenti **0** · 📋 in coda **13** (C 13 + D 0) · 📦 chiuse **151** |
| rami | `docs/`, workflow, `CLAUDE.md`, `server.mjs` **identici** sui due rami; guardie **verdi** |
| bot (`assistente-padel-agent`) | **non toccato** in tutta la giornata |
| `PMO_ARRICCHISCI_SCHEDE` | TEST = **0** (spento) · PROD = **mai scritta** |

⚠️ **Le versioni si rimisurano**, non si copiano da qui:
```
curl -s -H 'Cache-Control: no-cache' "https://app.padelvillage.club/?cb=$(date +%s)" | grep -o "APP_VERSION = '[0-9.]*'"
curl -s "https://test.padelvillage.club/app-meta.json?cb=$(date +%s)"
```

---

## Cosa è stato chiuso oggi (94ª)

| voce | com'è stata chiusa |
|---|---|
| **169** il maestro due volte · i nomi tagliati · un banner di troppo | **prova fisica** su TEST **e** PROD 6.382, a tre altezze di finestra |
| **120** la pagina che saltava in cima | **a sua parola**: *«NON SUCCEDE PIU»* |

---

## 🚨 LE QUATTRO LEZIONI DI OGGI, che valgono più del lavoro fatto

**① Una domanda da quattro righe ha risparmiato un giro intero.**
Sul calendario avevo trovato **quattro** cose sbagliate. Messo davanti all'elenco lui ne ha
indicate **due** — il maestro ripetuto e i nomi tagliati — e ha **escluso** le altre due, fra cui
il quadratino verde stretto (*«è giusto»*: è una mezz'ora libera). ⇒ Le due che avevo trovato per
prime e che mi sembravano più evidenti **non erano il difetto**.
📌 *Quando «errori» è al plurale e i candidati sono più d'uno, chiedere quale costa meno che
indovinare.*

**② La cura può essere peggio del difetto, e a dirlo è la MISURA — o lui.**
Sui nomi tagliati ho fatto **quattro** versioni, ognuna smentita da un fatto:
- v1: mostravo un nome e «+3» dove prima se ne leggevano **tre**. *Per togliere mezzo nome ne
  toglievo due interi.*
- v2: mescolavo `offsetTop` (parte dal **bordo**) con `clientHeight` (il bordo **non lo conta**) ⇒
  sbagliavo di **una riga intera**. E il bordo non è nemmeno costante: una *partita aperta* lo ha
  di 2px tratteggiati.
- v3: contavo anche l'**interlinea**, e nascondevo un nome leggibilissimo per **1,5 px**,
  lasciando 16 px di vuoto sotto.
- 🚨 e la v3 l'ha smentita **lui**: *«continuano a vedersi sempre tre giocatori su quattro»*. Il
  «+1» **dichiarava** il nome mancante; lui il nome lo vuole **leggere**. Avevo curato il sintomo
  che avevo scelto io invece della cosa che gli serve.
📌 *Dichiarare un'assenza non è toglierla.*

**③ Uno strumento che non trova il suo bersaglio TACE, e il silenzio somiglia al verde.** Tre
volte oggi, su tre strumenti diversi:
- una `replace` che inseriva tre casi nel banco **non ha trovato il testo** e non ha protestato ⇒
  ho sabotato tre volte e il banco è rimasto **verde** perché quei casi non c'erano;
- il mio controllo locale dei conteggi girava **solo metà** delle regex della guardia (i titoli, non
  la tabella in cima) e diceva «tutto torna» ⇒ l'ha presa `guard-docs-truth` su `main`;
- due versioni di una sonda leggevano il sorgente con una regex e dicevano «rotto» del **codice
  giusto** (pescavano l'annotazione di tipo `giocatori: unknown` e la chiamavano assegnazione).
📌 *Una sonda che gira metà dei controlli non dà mezza risposta: dà un VERDE, con la stessa faccia
di quella che li ha girati tutti.*

**④ «Non si può sapere» va sempre completato con «da dove».**
Avevo scritto che `secrets list` di Supabase prova che una variabile *c'è* ma non *quanto vale*,
«perché mostra solo un'impronta». 📏 Misurato sulla prima corsa vera: quell'impronta è lo
**SHA-256 del valore** — `5feceb66…` è sha256 di «0», `d4735e3a…` di «2». ⇒ La rilettura
dell'interruttore adesso **prova il valore**, non l'esistenza.

---

## 🔨 Dov'è arrivata la voce 142 (la più grossa della coda)

🗣️ Sua, dal 04/09: *«perché ogni volta dobbiamo andare a leggere Matchpoint?»*. La **prima metà**
(i nomi visibili subito) è in servizio dal 04/09. Oggi è stata scritta la **seconda**: l'**id
interno** e le **Osservazioni**, che l'export non porta e che stanno solo dentro la scheda della
singola prenotazione ⇒ una lettura a testa, e una sola.

**Cosa c'è, e dove:**
- `supabase/functions/matchpoint-bookings-sync/arricchimento-scheda.ts` — le funzioni **pure**;
- `…/arricchimento-scheda.test.ts` — banco da **18 casi**, sabotato 5 volte, verde nella corsa
  Deno vera della CI;
- `…/index.ts` — il collegamento dentro il giro del sync, e `leggiSchedaDalWorker`;
- `.github/workflows/interruttore-arricchimento-schede.yml` — **l'interruttore**.

🚨 **È SPENTO**, e vive **solo su `test-preview`**. `PMO_ARRICCHISCI_SCHEDE` = 0.

**Le tre cose da non rompere, se ci si rimette le mani:**
1. 🚨 **nel payload non entra NESSUN TIMBRO DI TEMPO.** Un `arricchitoAt` renderebbe il payload
   diverso a ogni giro ⇒ ogni riga riscritta ogni 2 minuti = la fabbrica di WAL della **voce 160**
   (PROD irraggiungibile otto ore). Il banco ha un caso che cade se qualcuno ce lo rimette.
2. ⛔ **`giocatori` resta `string[]` e non si tocca**: su quella lista `eventi-staff.ts` decide
   **chi viene avvisato**. Gli id stanno in un campo accanto (`idClienti`), come **mappa per nome**
   — un elenco parallelo si disallinea appena qualcuno riordina il roster, e il roster si riordina.
3. ⚖️ **i tre freni**: tetto per giro, budget di tempo, **una lettura alla volta** (il worker è un
   browser solo condiviso con PROD: quattro insieme non vanno in parallelo, vanno in fila).

### 🎛️ Come si accende (l'interruttore è provato, in tutti e due i versi)

Actions → *«Interruttore arricchimento schede (voce 142)»* → **Run workflow**:
`bersaglio` = `test` o `prod` · `tetto` = 0-10 (0 = spento) · `budget_ms` = 5000-60000 ·
per PROD va scritta la parola `PROD`.

📏 Provato il 06/09: corsa **#1** acceso (TEST, tetto 2) · corsa **#2** rispento (TEST, tetto 0),
tutt'e due verdi, con `✅ PMO_ARRICCHISCI_SCHEDE = 0 (impronta verificata)`.

---

## ▶️ COSA FARE ADESSO, in ordine

1. 🚀 **Promuovere la 142 su PROD** — le sole righe di `supabase/functions/matchpoint-bookings-sync/`
   da un ramo basato su `main`. ⚠️ Finché non è promossa, accendere l'interruttore su PROD **non fa
   succedere niente**: la funzione in servizio là quella variabile non la legge nemmeno.
2. 🔥 **Accenderla su PROD con un tetto BASSO (1 o 2) e GUARDARE.** È il passo che non ho fatto, ed
   è tutto il valore della voce. Cosa guardare, in ordine:
   - il registro della funzione: riga `arricchimento_schede` con `tetto` · `lette` · `riuscite`;
   - che i giri del sync **non si allunghino** (il worker è condiviso con PROD);
   - 🚨 che `pmo_cloud_records` **non ricominci a riscrivere l'invariato** — è la cosa che ha messo
     giù il database il 05/09. Il timbro dell'ultimo giro dice `unchanged/changed/new`.
   - ⇒ Se qualcosa si allunga o si riscrive troppo: **si rispegne con lo stesso interruttore**, un
     minuto.
3. 🪟 **Far leggere all'app `idClienti` e `note`** — finché non lo fa, il beneficio che la voce
   insegue **non c'è**: aprendo una scheda i giocatori e i soldi arrivano ancora dal worker. È qui
   che la 142 si chiude davvero, e con lei si sblocca la **138** (che aspetta l'id) e la seconda
   metà della **143**.
4. 📋 Poi la coda: la **143** (il borsellino in cassa), e il resto delle 13.

---

## ⛔ COSA NON DARE PER FATTO

- **Nessun gesto che SCRIVE è stato premuto oggi**, da nessuna parte: la console remota entra in
  **sola lettura**. Della 169 è provato che i riquadri mostrano i nomi giusti e interi — **non**
  che «Salva», «Annulla prenotazione» e «Aggiungi giocatore» portino a termine il loro gesto.
- **Il codice della 142 non è mai stato ESEGUITO in servizio**: nasce spento. Non è misurato quanto
  costa una lettura, né quanto dura un giro col tetto acceso.
- 🚨 **La 142 si può provare SOLO su PROD**: su TEST il calendario è una **fotografia congelata**,
  quindi molte di quelle prenotazioni su Matchpoint non esistono più ⇒ la lettura fallirebbe e
  direbbe «non funziona» di una cosa sana.
- **La 119** (etichette dei bottoni sul telefono) è del **bot**, è già curata, e i due residui sono
  stati misurati il 06/09 mattina: **non sono lavoro**. Resta aperta solo per la prova sul suo
  schermo.
- ⚠️ **La partita di lunedì 7, 09:00, Campo 4** (Lidia · Fabiola) — la partita di servizio su PROD —
  **passato il 7/09 non c'è più**: da lì in poi quella riga va letta come un esempio, non come un
  indirizzo, e per una prova su PROD ne va chiesta un'altra.
- **Invariati**: **115 · 118 · 164** in servizio e in attesa della finestra; **125** aspetta **un
  suo incasso da 1 €**; **111 · 112** sono decisioni sue; **165** è misurata e il consiglio è
  **NON** togliere gli altri due indici (letti ~3.900 e ~1.900 volte al giorno, contro **1 in 21
  ore** del GIN già tolto).

---

## Regole di sempre (dal `CLAUDE.md`, che va comunque riletto)

- la catena è **① sviluppo → ② provo su TEST → ③ porto su PROD SENZA CHIEDERE → ④ provo su PROD →
  ⑤ lo avviso**: ci si ferma solo al ⑤;
- si **misura** invece di dedurre, e quando la misura smentisce una riga scritta, **si corregge
  quella riga**, non la si affianca;
- ogni cura si dichiara per quello che ha provato **e** per quello che **NON** ha provato, e **su
  quale ambiente**;
- prima `test-preview`, **poi** un ramo da `main` con le **stesse righe** (la versione si mette a
  mano: è l'unico pezzo che non applica da solo);
- 🩹 i conteggi delle liste sono dichiarati in **DUE** posti — il titolo di sezione **e** la tabella
  in cima — e `guard-docs-truth` li confronta **tutti e otto**. Girare solo metà delle regex dà un
  verde che non ha controllato niente (oggi è successo);
- ⚠️ **si prova alla misura in cui il difetto esiste**: la 169 a 1490×880 **non si vedeva** (14
  riquadri su 14 dentro il bordo) e una prova lì avrebbe detto «funziona». A **1490×810** — la
  finestra sua — 5 riquadri su 14 tagliavano un nome.
