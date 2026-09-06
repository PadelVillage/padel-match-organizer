# Passaggio di consegne — 06/09/2026, mattina (92ª sessione)

**Leggi PRIMA `CLAUDE.md` e `docs/lavori/README.md`, come sempre.** Questo file dice dove si è
arrivati alle **11:50 locali (09:50 UTC)**. Tutto è committato e mergiato su `test-preview` **e**
su `main`, salvo quanto dichiarato in §5.

🟢 **STATO: puoi operare.** Nessun rilancio a mano in sospeso, nessuno stub vivo, niente a metà.

| | |
|---|---|
| **PROD** | app **6.371** (voce 166 promossa stamattina, PR #1406) |
| **TEST** | app **6.372** (stesso contenuto: 1 = allineati) |
| `main` | #1404 (sentinella), #1405 (registri), #1406 (166) mergiate; la PR dei registri di fine mattina è l'ultima |
| **bot** (`assistente-padel-agent`) | **raggiungibile stamattina** (`dc52eee`), **non toccato**: i due residui della 119 si sono sciolti misurando (§3) |
| liste | 🔴 urgenti **0** · 📋 in coda **17** (C 17 + D 0) · 📦 chiuse **145** |

---

## 0 · Cosa è successo, in sei righe

1. 🩺 **L'allarme della 161 è PARTITO** (a mano, 09:13 UTC, Telegram lo ha accettato) — e il
   cron delle 05:20 è scattato **alle 09:26**, quattro ore dopo. GitHub lo ritarda; non lo salta.
2. 🔥⭐⭐ **Guardare l'allarme ha trovato che diceva una cosa FALSA**: il «16,7 a 1» della 165
   era l'**LSN**, non il WAL scritto. E un secondo difetto nella sentinella: un solo allarme per
   giro. Tutt'e due curati e in servizio (#1404).
3. 📉 **La 165 si è ridimensionata da urgenza a decisione**: il database scrive **235 MB in 21
   ore**; i 62 GB della 160 erano **archiviazione ferma × un segmento ogni 2 minuti**, non traffico.
4. 📐 **La 166 è nata da lui e curata la mattina stessa** (TEST 6.371 → PROD 6.371), misurata con
   la console remota alla misura della sua finestra.
5. 🔘 **La 167 è entrata su sua parola** (bottoni in basso nella scheda partita), col mio parere.
6. 📱 **I due residui della 119 non erano lavoro**: uno era un errore di conteggio, l'altro contraddice
   una sua correzione del 22/08.

---

## 1 · La 161 e la 165: cosa si è misurato, e cosa cambia

📏 **Su PROD, in ordine**:
· `archive_timeout = 120` (Supabase, non nostro): ogni 2 minuti il database chiude il segmento
  WAL da 16 MB e ne apre uno nuovo, **pieno o vuoto**. I file in `pg_wal` hanno l'ora di
  modifica esattamente ogni 120 s. ⇒ 720 segmenti/giorno = **11,5 GB di LSN per costruzione**.
· `pg_stat_wal.wal_bytes`: **235 MB in 21 ore** dal riavvio. Due campioni a 2′15″: LSN +16,7 MB,
  scritto **+93 KB**.
· `pg_stat_statements`: 131 MB dei 235 sono l'upsert del sync su `pmo_cloud_records`.
· `pg_stat_archiver`: 637 archiviati, **0 falliti**. I 62 GB della 160 = ~3.900 segmenti = **5
  giorni e mezzo** di `archiving WAL file failed`.
· Lo zero HOT ha un nome: `trg_pmo_cloud_records_updated_at` tocca `updated_at`, che è
  **indicizzato**, a ogni update ⇒ HOT impossibile per costruzione. Il GIN sul payload (45 MB) è
  stato usato **una volta** in 21 ore.

🔨 **La sentinella adesso** (`tools/sentinella-salute-db/`, banco 29/29):
· `wal-al-giorno` giudica sul WAL **scritto**, e riporta l'LSN in segmenti;
· regola nuova **`archiviazione`**: ultimo fallito più recente dell'ultimo archiviato ⇒ allarme.
  È la 160 per nome, 17 ore prima degli 8 GB;
· **allarmi per regola** (`evolviRegole`): `di_fila` e `attivo` per ciascuna; le righe vecchie
  si traducono senza ridire il detto. Con l'HOT fermo in allarme, prima un guasto nuovo **non
  avrebbe mandato niente**;
· il battito parte anche con un allarme in piedi, dopo 7 giorni senza messaggi.

⏳ **Cosa aspetta la 161 per chiudersi**: il primo giro automatico col codice nuovo deve
mandare il **rientro di `wal-al-giorno`** (era attivo nella riga 3, e con la misura giusta
rientra). Sarà il messaggio *per regola* visto passare. E lui deve dire di aver **visto**
l'allarme delle 09:13 sul telefono. ⚠️ Il cron può arrivare ore dopo le 05:20: si guarda la
storia (`pmo_sentinella_salute`) e i run `schedule`, non l'orologio.

💰 **Il compute**: con 270 MB/giorno di scritture vere il MICRO **non è sotto sforzo**. La
decisione sullo SMALL resta sua, ma la cifra da cui partire non è più «11 GB al giorno».

⛔ **Nessun indice toccato.** Le due igiene (GIN da togliere; `updated_at` indicizzato o HOT,
non tutt'e due) sono **una decisione sua** e si dicono prima.

---

## 2 · La 166, e come si è provata

🗣️ Sue parole con screenshot: *«troppo grande e non si vedono tutti gli elementi»* · *«fai come
hai fatto quando apro una scheda di una partita già completa di dati»*.

📏 **Prima** (PROD 6.369, console remota a 1850×1130): scheda **805 px**, titolo 29px, controlli
24px, **due ✕**. La causa: `svcOpenBookingCard` scala sulla larghezza del contenitore fino a 560px
(misure da telefono), e il pannello desktop è largo 620-1180 dal 04/09.
📏 **Dopo** (TEST 6.371, stesse misure e 1480×780): **372 px**, 15/14px, **una ✕**, due colonne,
«Conferma» in vista. Lo screenshot ha anche trovato «Manut.» accorciato senza motivo: corretto.

🚨⭐ **La sua correzione, arrivata subito dopo, e che vale come regola**: *«Aprine una di schede,
guarda che ti mancano dei dati. Qui tu hai fatto solamente vedere dei dati parziali del mio
screenshot, però devi capire che dati ci sono dentro questa scheda prima di fare un nuovo
mockup.»* ⇒ Avevo descritto le due schede dal suo screenshot. Dopo, con la console su PROD 6.371:
· la 166 esercitata nei suoi **stati** — Lezione ⇒ Maestro (LoZio · Spinazze · Lucas Vidal) a
  sinistra e «Allievi»; «apr» scritto ⇒ sei suggerimenti con livello e ID nella colonna destra,
  scheda 372 → 501 px dentro il pannello; un suggerimento toccato ⇒ pastiglia con ✕. Niente
  della scheda vecchia manca;
· la scheda **partita** e quella **manutenzione** aperte e inventariate (sezioni, campi, bottoni,
  conto): l'inventario intero sta nella riga della **167** in `docs/lavori/README.md`, ed è la
  base su cui si disegna — non lo screenshot.
📌 *Una scheda si descrive aprendola. Uno screenshot dice cosa lui ha visto, non cosa c'è.*

⏳ **Resta aperta per la prova sul SUO schermo** su PROD 6.371: la console ha misurato pixel a due
misure di finestra, non il suo zoom (nel suo screenshot Chrome era ingrandito).

---

## 3 · La 119: i residui che non erano lavoro

· `💬 Altri orari? Scrivi alla segreteria` è **37** punti di codice: il 38 era `.length`, che
  conta l'emoji come due. È la stessa stringa letta intera sul suo telefono il 29/07.
· «🔄 Riprova a invitare» sta sotto un testo che dice già *«Attendi un attimo… non rifarla. Poi
  tocca il bottone qui sotto»*, e la forma è **sua** (22/08): il tempo si dice una volta, in testa.
⇒ Nessuna riga del bot toccata. Resta aperta solo per la prova sul suo schermo.

---

## 4 · ⛔ Cosa NON dare per fatto

- **La 161 non è chiusa**: manca il rientro per regola e il suo «l'ho visto».
- **La 166 non è chiusa**: la console non è il suo schermo con il suo zoom.
- **La 167 non è iniziata**: è in lista col parere, la decisione sul disegno è sua.
- **La 165 non ha toccato indici**, e non lo farà senza una sua parola.
- 🚨 Il cron della sentinella **può arrivare ore dopo**: un «non è partito» letto alle 09 era vero
  alle 09 e falso alle 09:26. Prima di scriverlo, si aspetta o si dichiara l'ora della lettura.
- Invariati: **118** nessun caso vivo; **115** al prossimo gesto dal bot; **122** non esercitata
  sui soci; **120** vuole il suo schermo o un'utenza che scrive; la prenotazione di prova su TEST
  del 06/09 17:30 Campo 1 resta, innocua.

---

## 5 · Cosa fare nella prossima sessione, in ordine

1. 🩺 **Guardare se il giro automatico col codice nuovo ha mandato il rientro** (storia
   `pmo_sentinella_salute`, run `schedule`), e chiedergli se ha visto l'allarme delle 09:13.
2. 📐 **Chiedergli di aprire «Nuova prenotazione» su PROD 6.371** e dire se ci sta tutta.
3. 🔘 **Voce 167**, se conferma il disegno (piè unico; Annulla a distanza da Salva; il conto
   sale sopra la barra). ⚠️ Si parte dall'**inventario** scritto nella sua riga, non da uno
   screenshot: è la correzione che ha dato lui stamattina.
4. 💰 **Proporgli** compute e indici insieme, con i numeri di §1.
5. 🔎 **Fabio De Luca, lunedì 7 e martedì 8** — non aperta apposta: chiediglielo prima.

---

## 6 · Attrezzi, e cosa si è imparato

- 🩺 Sentinella: `banco-salute.mjs` · `sentinella.mjs --muto` (da Actions il `ref` può essere
  `test-preview`: gira il codice del ramo prima di mergiarlo) · `--prova`.
- 🌐 **Console remota**: `node console.mjs --env test --viewport 1850x1130 --file x.js --shot y.png`.
  Le funzioni dell'app si chiamano dallo snippet (`svcOpenChat(); svcOpenBookingCard(1,'2026-09-14','10:00')`).
  ⚠️ Si lancia con `cd tools/verifica-browser` **nella stessa riga**: il cwd si azzera fra un
  comando e l'altro.
- 📏 **Prima/dopo si misurano con lo stesso snippet su PROD e su TEST**: è la diagnosi in una
  riga, e dà i numeri da scrivere invece degli aggettivi.
- 🚨 **Il checkout locale può essere STANTIO** (stamattina HEAD era del 31/08, «ahead 50 behind
  50», senza base comune): `git status -sb` prima di tutto, e `git checkout -B test-preview
  origin/test-preview` con un ref di backup.
- 📌 Ordine delle spinte: prima `test-preview`, poi un ramo **da `main`** con le stesse righe;
  la versione la si mette a mano nel patch di promozione (l'unico hunk che non applica).
