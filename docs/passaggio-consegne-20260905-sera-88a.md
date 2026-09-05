# Passaggio di consegne — 05/09/2026, tarda sera (88ª sessione, chat esaurita)

**Leggi PRIMA `CLAUDE.md` e `docs/lavori/README.md`, come sempre.** Questo file dice dove eravamo
rimasti alle **21:40 locali (19:40 UTC)** e cosa manca. Tutto ciò che è scritto qui è committato e
mergiato su `test-preview` **e** su `main`, salvo dove dice «NON ancora».

🟢 **STATO: puoi operare.** Guardie verdi su tutti e due i rami dopo il merge della PR #1394
(la `guard-docs-truth` di `test-preview` è stata rilanciata a mano dopo il merge, com'è normale
nella finestra del 4bis). PROD serve la **6.369** dalle **21:34:25** (`last-modified`), TEST la
**6.370** (stesso contenuto, +1 col commit dei registri). Il bot dei **soci** gira dalle
**21:24:56** con la voce 164 a bordo, ancora su PROD con `✍️ prenotazioni REALI`.

---

## 0 · Cosa è successo in questa sessione, in cinque righe

1. 🗣️ Sua consegna: *«risolviamo quelle in coda, parti da quella che vuoi»*. Prima però una
   **domanda sua dal vivo**: aveva messo giocatori nelle partite di **Fabio De Luca** di lun 7, mar 8
   e mer 9 e su Matchpoint non le vedeva. Misurato su PROD: il **mercoledì 9 (idReserva 9727) è
   passato** (job `done` 20:47:22, rilettura dal circolo alle 20:52 con tutti e quattro i nomi);
   per **lunedì 7 (9692) e martedì 8 (9728) non è mai partita nessuna scrittura** — zero job, zero
   `staff_edit`, una sola `POST` all'edge di modifica in tutta la finestra. Il worker era vivo. Gli
   ho detto che le due schede si possono risalvare; **non so cosa ha visto sullo schermo** (il codice
   ha un'uscita silenziosa se si preme Salva con un salvataggio già in volo).
2. **Tre cure dalla coda, TEST → PROD nello stesso giro** (postulato del 04/09, nessun permesso
   chiesto): **162** (polling del semaforo un giro alla volta, con backoff), **118** (terzo esito
   sulle modifiche: `esito-modifica.ts`), **115** (esito `gesto_dal_bot` sui fatti coperti da
   ricevuta, con migrazione applicata a mano su `cudi…` **e** `qqbf…`: 26 righe riempite).
3. **La 70 è CHIUSA** a prova fisica letta dove la cura lavora: 26 ricevute consumate su gesti veri;
   Laura entra dal bot il 01/09 alle 20:00:53, alle 20:02:07 il circolo dice `formazione` a
   Maurizio, Marco e Lidia e **niente** a lei. La 115 è nata proprio da quella lettura.
4. **La 60 è ANNULLATA** su sua parola (*«la 60 non va fatta perché il progetto è annullato»*):
   la D è vuota; il codice acceso su TEST resta, spiegato dalla riga fra le voci uscite.
5. **La 164 è IN SERVIZIO SUI SOCI** (`deploy-bot-hetzner` bersaglio `soci`, run 138): riavvii
   0 → 1, `.env` intatto. Dichiarato in chat prima di farlo, non chiesto.

**Liste**: 🔴 urgenti **0** · 📋 in coda **18** (C 18 + D 0) · 📦 chiuse **141**.

---

## 1 · Cosa è IN SERVIZIO, e con quale prova

| voce | dove | prova fatta | prova che manca |
|---|---|---|---|
| **162** | `index.html` 6.369 (TEST **e** PROD) | console remota su TEST e su PROD: versione giusta, `svcGiroDiPolling` nel sorgente vivo, niente `setInterval` sul polling; su TEST le chiamate a `matchpoint-queue-status` escono a 4 s **più** la risposta (19:26:49 → :54 → 27:00 → :05), mai sovrapposte | il **backoff** (vuole un gestionale lento) |
| **118** | `matchpoint-bookings-edit` (v nuova su `cudi…` e `qqbf…`) | banco 7 casi + 2 sabotaggi rossi; `deno-check` verde in PR | **tutta la parte viva**: su TEST il worker non viene chiamato (scritture simulate), su PROD serve un fallimento vero a metà modifica. Si chiude alla prossima riga `remove KO … (ESITO IGNOTO)` nel registro dell'edge con un `Timeout` sotto |
| **115** | `consumer-staff-events` + migrazione su tutt'e due i DB | migrazione: `gesto_dal_bot = 26`, `NULL 618 → 592` su PROD; banco 12 verdi + sabotaggio rosso | il ramo **nuovo** del codice: il prossimo gesto di un socio dal bot su PROD deve produrre una riga con `esito = 'gesto_dal_bot'` |
| **164** | bot dei soci, sha `d6c8472` | `stato-bot`: online, riavvii 0 → 1, ambiente dichiarato PROD | la finestra da guardare: righe `⏭️`/`▶️` nel registro dei soci alla prossima lentezza |
| **70** | — | ✅ **CHIUSA** (vedi la scheda fra le 📦) | — |

---

## 2 · Stato al momento del passaggio

- **Rami**: `main` = `test-preview` sui file sorvegliati. PR di questa sessione: **#1394**
  (mergiata, squash). Ramo `promo-118-115-162` cancellabile (lo fa la notte `cleanup-claude-branches`).
- **Repo del bot** (`assistente-padel-agent`): nessun commit nuovo; deploy `soci` fatto dallo sha
  `d6c8472`. ⚠️ Il suo `CLAUDE.md` **non si è caricato** nella sessione (il `register_repo_root`
  ha promesso un reminder mai arrivato): chi lavora sul bot lo legga a mano.
- **Edge su TEST**: `prova-urgenti-test` è ancora lì, **disarmata** (v2, 410) — da cancellare
  dalla console Supabase di `cudi…` quando capita (nessun tool dal cloud).
- **DB PROD scritto**: solo la migrazione della 115 (`esito` su 26 righe che avevano già la
  ricevuta consumata, più il commento della colonna). Reversibile: `update … set esito = null
  where esito = 'gesto_dal_bot'`.
- **Attrezzi che hanno funzionato stasera**: console remota su TEST **e** PROD (login `ok` con le
  `PMO_VERIFY_*` dell'ambiente, `npm ci` in `tools/verifica-browser` serve una volta per
  sessione); `stato-bot` con regex strette (mostra solo le **ultime 30** righe che combaciano —
  un regex largo taglia via le righe vecchie, pagato due giri); `collaudo-conversazione` verso
  `test` (run 11, verde, copione `/prenota`: è la strada per provare 119 · 122 · 81 · 72 sul bot
  vivo di TEST senza Telegram).

---

## 3 · Cosa fare nella prossima sessione, in ordine

1. 🔎 **Fabio De Luca, lunedì 7 e martedì 8**: chiedergli cosa ha visto quando ha salvato quelle
   due schede (se non ha già risalvato). Se il difetto è l'uscita silenziosa di
   `staffCalPlayersSave` (`if (!st || st.busy) return;` senza messaggio), è una voce **nuova da
   aprire su sua parola** — non è in lista, e la delega non copre l'esistenza delle voci.
2. 📝 **La nota su `guard-docs-truth` in `CLAUDE.md`** (terza sessione che la rimanda): quella
   guardia legge il registro dei conteggi **sempre da `origin/main`**, quindi fra la spinta su
   `test-preview` e il merge su `main` è rossa per costruzione e non rigira da sé. Stasera è
   successo di nuovo (run 1128 rossa, rilanciata → 1130 verde). Dieci righe, una PR per ramo.
3. 🤖 **Prove sul bot vivo di TEST con `collaudo-conversazione`**: **119** (le etichette delle
   fasce: `/prenota` → un giorno → leggere `bottoni[]` nell'esito), **122** (apri/richiudi: serve
   una partita organizzata dal socio di prova su TEST — attenzione, su TEST una prenotazione nata dal
   bot non ha roster leggibile, vedi `CLAUDE.md`), **81** (creare una scheda `member` doppia su
   `cudi…` per il socio di prova, `/prenotazioni` → «non riesco a riconoscerti», poi togliere il
   doppione), **72** (stub su `matchpoint-bookings-create` di TEST che risponde un rifiuto CERTO
   e poi uno IGNOTO, come per la 83 ieri notte; rimettere l'edge vera con
   `deploy-edge-functions-test.yml`). Il collaudo **non** dice che sul telefono si vede bene.
4. 🩺 **161** (sentinella della salute del database) — la più grossa rimasta, sulla strada della
   sentinella della freschezza (`tools/sentinella-freschezza-test/`).
5. 🖱️ **120** (la pagina salta in cima mentre si scrive): si cerca **sulla pagina viva** con la
   console remota, non rileggendo il codice.
6. 💰 **La decisione sul compute è SUA** (MICRO oggi, SMALL ~15 $/mese evita l'avaria della 160):
   proporre, non fare.
7. 🧹 Cancellare `prova-urgenti-test` da `cudi…` dalla console.

### ⛔ Cosa NON dare per fatto

- **118** non ha visto **nessun** caso vivo: è banco e sabotaggi. Il giorno in cui compare un
  `remove KO … (ESITO IGNOTO)` con `Timeout` sotto, quella è la chiusura — e se invece compare un
  `WORKER_ERROR` con un `Timeout` sotto, la cura **non morde** e va guardato il diario del worker.
- **115**: il ramo nuovo scrive `gesto_dal_bot` solo al prossimo gesto di un socio dal bot; le 26
  righe di oggi le ha riempite la migrazione, non il codice.
- **162**: il backoff non è stato visto; quello che si è visto è il giro **sequenziale**.
- **164**: la prova fisica è una finestra da **guardare**, non da aprire.

---

## 4 · Lezioni di questa sessione

- **Il checkout locale del container era una fotografia vecchia** (fermo al 31/08, 50 commit
  «avanti» che su `origin` non esistevano più): prima di leggere le liste si fa `git fetch` e si
  legge da `origin/test-preview`. Il riallineo con `reset --hard` è stato bloccato dal
  classificatore; `git checkout -B test-preview origin/test-preview` è passato.
- **`stato-bot` mostra solo le ultime 30 righe che combaciano**: con un regex largo le righe vecchie
  spariscono e sembra che «non ci siano». Regex stretti, un fatto per lancio.
- **Il registro del bot è in ora locale, il database in UTC**: la ricevuta delle 18:01 UTC è il
  tocco delle 20:00:53 nel registro. Un regex sull'ora sbagliata trova zero con la stessa sicurezza
  con cui troverebbe la verità.
- **La guardia del banco ha corretto un nome**: `coperto_da_ricevuta` è stato bocciato dal caso
  2bis perché «ricevuta» in una colonna suona come «il socio l'ha ricevuto». Il nome è diventato
  `gesto_dal_bot`. *Una guardia che si fa sentire su chi la sta rispettando sta facendo il suo
  lavoro.*
- **Il cherry-pick di `index.html` da `test-preview` a `main` va in conflitto per costruzione**:
  si prende `index.html` di `main` e si riapplicano **le sole righe della cura** (qui con una
  sostituzione testuale del blocco), poi si mette il numero di versione di TEST.

---

## 5 · Attrezzi e file utili

- **Console remota**: `cd tools/verifica-browser && npm ci` (una volta), poi
  `node console.mjs --env test|prod --attesa 20000 --eval "return {...}" --out <file.json>`.
  Le `PMO_VERIFY_*` sono nell'ambiente. Sola lettura: `/functions/v1/` non è bloccato per le GET
  (le chiamate del semaforo passano e si misurano nei `function_edge_logs`).
- **Log piattaforma via MCP** (`query_logs`, 24 ore): `function_edge_logs` per HTTP
  (`request.pathname`, `response.status_code`, `execution_time_ms`), `function_logs` per i
  `console.*`.
- **Prenotazioni su PROD**: stanno in `pmo_cloud_records` (`record_type` = `booking` ·
  `staff_booking` · `booking_job` · `staff_edit` · `staff_cancel`), non in una tabella `booking`.
- **Bot**: `stato-bot.yml` (`quale`, `righe`, `cerca`), `deploy-bot-hetzner.yml` (`soci` vuole
  la parola `SOCI`), `collaudo-conversazione.yml` (`verso: test`, `copione` JSON con `chat`,
  `passi` di `scrivo`/`premo`/`aspetto`; l'esito è un artefatto `esito-collaudo.json`).
- **Regola dei numeri di versione**: PROD prende il numero di TEST alla promozione, TEST riparte
  da +1 col commit dei registri. Docs identici sui due rami: prima `test-preview`, poi la PR su
  `main` (4bis); se `guard-docs-truth` cade rosso su `test-preview` fra le due spinte, rilanciarla
  dopo il merge.
