# Passaggio di consegne — 31/08/2026, sera (fine 65ª sessione)

**Come si usa:** incollalo come primo messaggio della chat nuova. È scritto per essere capito
**senza** la conversazione precedente.

---

## 🟢 LA PRIMA COSA DA SAPERE

> **Chiuse DUE voci, tutt'e due a PROVA FISICA SUA e nella stessa giornata: la 109 (urgente) e
> la 79. E la 79 è stata chiusa due volte — l'avviso alle 15:28, la sua velocità alle 20:34.**

| | inizio giornata | adesso |
|---|---|---|
| 🔴 urgenti | 5 | **4** |
| 📋 in coda | 9 | **8** (C 7 · D 1) |
| 📦 chiuse | 95 | **97** |

⚖️ **Il filo della giornata, ed è uno solo:** *due volte una domanda posta PRIMA ha cambiato la
forma del lavoro.* La sua — *«controlla prima il doppione»* — ha scoperto che la cura ovvia
avrebbe mangiato messaggi veri, e ha riscritto il disegno. La mia mancata domanda del mattino —
non ero andato a leggere **da dove nasce** il record dell'omaggio — mi aveva fatto inseguire per
tre giorni una sonda che non poteva concludere.
📌 *Chiedere «cosa succede se…» prima costa cinque minuti; scoprirlo dopo costa una prenotazione,
un messaggio sbagliato, o tre giorni di sonde storte.*

---

## 0. 📦 Stato alla consegna

| | |
|---|---|
| PR aperte | **nessuna** |
| PR fuse oggi | #1230, #1231, #1232 (gestionale) · bot#113 |
| lavoro non committato | **nessuno** |
| rami | `main` e `test-preview` **allineati** sui quattro percorsi sorvegliati |
| versioni app | PROD **6.259** · TEST **6.263** — **l'app non è stata toccata** in tutta la sessione |
| bot dei soci | `main` = `f5076b1`, deployato alle 12:50, `online`, `ponti edge qqbf… (PROD)`, `✍️ prenotazioni REALI` |
| banco | gestionale **71 verdi / 0 rossi** · bot **1673 verdi / 0 rossi** (erano 1662) |

---

## 1. ✅ Prima di lavorare

```bash
git fetch origin main test-preview
git diff origin/main origin/test-preview -- CLAUDE.md docs/ .github/workflows/ \
  tools/matchpoint-browser-worker/src/server.mjs
```
✅ Dev'essere vuoto.

📕 `docs/lavori/README.md` si apre **PRIMA di lavorare** — obbligo di casa.

🚨 Il banco del gestionale NON si lancia con `node --test`. Il giro vero (**71 verdi**):
```bash
r=0; v=0
while IFS= read -r f; do
  grep -qE "^\s*(import|export).*['\"]jsr:" "$f" && continue
  if node "$f" >/dev/null 2>&1; then v=$((v+1)); else r=$((r+1)); echo "❌ $f"; fi
done < <(find supabase consumer-app tools test \( -name '*.test.ts' -o -name '*.test.mjs' \) | sort)
echo "$v verdi, $r rossi"
```

🤖 **Il repo del BOT si può attaccare alla sessione** e serve spesso: `add_repo` su
`PadelVillage/assistente-padel-agent`, poi `git clone --depth 1`. ⚠️ **`npm ci` è necessario**:
senza `node_modules` il banco del bot risulta 44 rossi che non sono suoi (`@mastra/core` non
risolto), e si rischia di inseguire guasti inesistenti. Con le dipendenze: `node --test test/*.test.ts`
→ 1673, e `npm run check` per `tsc`.

---

## 2. 🔨 COSA HA FATTO LA 65ª

### 📦 109 CHIUSA — e **l'ha chiusa il CODICE, non la sonda**

La voce aspettava di sapere se un omaggio (quota offerta a 0 €) arrivasse su Matchpoint. La
sonda era stata sbagliata **tre volte in tre giorni**, ogni volta nel verso di affermare il
falso: il campo (`data` è il giorno del **pagamento**, `booking_data` quello della **partita**),
poi la finestra dell'export, poi il **bersaglio annullato**.

🎯 **La risposta stava nel codice e non serviva nessuna sonda**: `_pmoGiftSyncFromRoster`
(`index.html`) riceve **solo** `data.worker.partecipantiFinali`, cioè il roster letto **dal vivo
sulla ficha di Matchpoint** — `partecipantiFinali` lo produce solo `server.mjs` — e scrive solo
per chi ha `stato === 'riscosso' && importoCents === 0`.
⇒ **Un record `paygift` non può esistere se la ficha non diceva già «riscosso, 0 €»**: la
direzione è Matchpoint → gestionale, e *«l'omaggio è passato di là»* è vero **per costruzione**.
📌 *La scheda conteneva tutt'e due le letture a quindici righe di distanza: una scheda che si
contraddice non si risolve scegliendo la riga più convincente, si va a leggere il codice.*

✅ **La prova fisica è arrivata da sé** il 31/08 alle 07:53:29 UTC: un omaggio vero della
segreteria su una partita viva, scritto nel cloud con `cloud_records_upsert {count: 1}` allo
stesso microsecondo. Prima della cura sarebbe caduto in silenzio.

⚠️ **UN RESIDUO CHE NON È DI QUELLA VOCE, e va saputo**: l'export dei pagamenti di Matchpoint
**non porta le righe a 0 €**. Su **3063** pagamenti mai tornati, quelli a zero sono **ZERO**, e
il 31/08 l'omaggio delle 09:30 non è tornato benché l'export delle 08:55 avesse il 31/08 nella
finestra (che è su `booking_data`, misurato). È un fatto sugli **Incassi**, non un difetto.

### 📦 79 CHIUSA — il quinto gesto `formazione`, e poi la sua velocità

**Il difetto**: i fatti `aggiunto`/`tolto` nascevano intestati a chi si era **mosso**; chi
restava in campo non era previsto. Con un ospite non c'era **nessun destinatario possibile** ⇒
silenzio totale — il caso da cui la sua segnalazione del 23/08 era nata.

**Ⓐ La cura**: un quinto gesto `formazione` per chi resta, con dentro chi è entrato e chi è
uscito (ospiti compresi — `puoRicevere` decide chi **riceve**, non chi si può **nominare**).
**Ⓑ E la seconda porta**: `testoTornataIncompleta` raccontava il **netto** (`vistiPrima −
giocatoriOra`) come se fosse un evento — due uscite più un ingresso lo facevano valere `1`. Il
campo è stato **tolto**, non corretto: nessun accordo grammaticale poteva renderlo vero. Adesso
quel messaggio dichiara uno **stato** («Non siete più al completo»).

✅ **Prova fisica 1** (15:28, suo telefono): *«È cambiata la formazione della tua partita · Entra
un ospite»* — l'ospite aggiunto, il caso esatto.

⏱️ **Poi ha detto la cosa che valeva più del verde**: *«però ci ha messo parecchio tempo»*.
📏 Misurato: 131,6 s dal timbro alla consegna, più 0-120 di attesa del giro. La causa era una
parola nel fatto: **`origine: 'sync'`**. La strada veloce esiste dalla voce 76 (istante vero,
quiete 30 s) ma `matchpoint-bookings-edit` la usava **solo per lo spostamento puro**.

🚨⭐⭐ **E LA SUA DOMANDA HA CAMBIATO LA CURA.** A *«controlla prima il doppione»* la sonda ha
risposto: **il doppione no, ma il dedup mangiava un cambiamento vero.** Su `aggiunto`/`tolto` la
chiave `(slot, persona, gesto)` dice **cosa** è successo, perché `persona` è chi si è **mosso**;
su `formazione` `persona` è chi **riceve** ⇒ due cambi diversi sullo stesso slot hanno la
**stessa chiave**. Caso concreto: un ospite aggiunto dal gestionale e un altro messo su
Matchpoint — il socio avrebbe saputo del primo e non del secondo.
⇒ Cura: il dedup **sottrae** invece di scartare in blocco. E `fattiDaCambioRoster` **non
riscrive la regola**: chiama `fattiDaConfronto`, la stessa del sync, su due fotografie di un solo
slot — con un caso del banco che confronta i due risultati per **identità**.

✅ **Prova fisica 2** (20:34 e 20:36, due gesti distanziati di 2′23″):

| gesto | `origine` | dal gesto alla consegna |
|---|---|---|
| `+ Lidia Comes` | **`conferma`** | **33,6 s** |
| `− Ospite` | **`conferma`** | **32,7 s** |

⭐ E tre cose che il dato ha mostrato senza che nessuno le cercasse: ① i due gesti non si sono
fusi; ② al secondo **anche Lidia** ha ricevuto `formazione` perché era entrata due minuti prima
(la squadra è quella del momento); ③ **doppioni dal sync: ZERO**, e lo zero vale perché il sync
**è passato** nel frattempo (ultimo giro 20:39:12).

---

## 3. 🔴 LE 4 URGENTI CHE RESTANO

| voce | cosa aspetta | dal cloud? |
|---|---|---|
| **92** | un gesto che attraversa un riavvio del bot | ⏳ non si provoca |
| **84** | il difetto **in atto** | ⏳ non si provoca |
| **83** | un worker oltre i 150 s | ⏳ provocabile col cancello, ⚠️ danno non simmetrico |
| **65** | curata e in servizio, si aspetta il caso | ⏳ |

⚖️ **Tutte e quattro aspettano un caso che non si provoca.** Non è una lista di lavoro fermo: è
la forma che prende un progetto in cui le cure vengono messe in servizio prima di essere state
viste sbagliare.

## 4. 📋 LA CODA — 8 (C 7 · D 1)

**88** · **68** · **70** · **72** · **81** · **111** · **112** · **60** *(sezione D)*.
📌 **111** e **112** non sono lavori: sono **decisioni sue** (la regola sull'età; se i 1736
contatti della rubrica debbano stare in anagrafica).

---

## 5. 🧠 LE TRAPPOLE DELLA 65ª

**① 🚨⭐⭐ UNA SONDA RESA CONCLUSIVA È ANCHE PERICOLOSA.** Finché l'assenza voleva dire «non lo
so», una sonda storta costava una mezza risposta. Da quando la sua parola l'ha resa conclusiva,
la stessa sonda storta **afferma**. ⇒ Prima di leggerne il silenzio, si ricontrolla che il
bersaglio esista ancora — e si guarda **da dove nasce il dato**, che spesso risponde meglio.

**② 🚨⭐⭐ IL VERDE DI UN CONTROLLO CHE NON HA POTUTO CONCLUDERE.** Ho installato Deno da npm
(funziona, 2.9.6) e ho annunciato «adesso il typecheck lo faccio qui». Falso: **`jsr.io` è
irraggiungibile da questo container** (403 sia diretto sia via proxy) ⇒ `deno check` esce
*prima* di controllare i tipi, e il mio «0 errori» era un **controllo mancato letto come via
libera**. Il workflow ha una guardia apposta contro questo; io no.
⇒ **Il typecheck delle edge lo fa SOLO la CI**, e la causa non è l'installazione: è il registro
delle dipendenze.

**③ ⭐⭐ IL GATE DIFFERENZIALE NON SI ESERCITA COL `workflow_dispatch`.** Lanciato a mano,
`typecheck-edge-functions` non ha un termine di paragone (`BASE_SHA` vuoto) e chiama «funzione
nuova, deve nascere pulita» **qualunque cosa trovi** — quindi escono rossi anche sei debiti
vecchi. ⇒ Per sapere se un errore è tuo serve **la PR**, dove il gate confronta con `main`. Ho
annunciato «è debito preesistente» prima di averlo verificato: sulla prima funzione la verifica
poi l'ha confermato, sulla seconda no, e ho dovuto correggermi.

**④ ⭐ UNA DOMANDA POSTA PRIMA VALE PIÙ DI UNA CURA SCRITTA BENE.** La sua *«controlla prima il
doppione»* ha trovato che la cura ovvia avrebbe perso messaggi. Posta dopo sarebbe stata un
incidente su gente vera.

**⑤ 🔧 `list_workflow_runs` SFORA IL CONTESTO** (90k caratteri per una riga). Il risultato va su
file e si legge con `python3`. Per un run singolo: `actions_get` / `list_workflow_jobs`.
E **lo zip dei log completi è bloccato dal proxy** (`results-receiver.actions.githubusercontent.com`
→ 403): per leggere un errore serve `get_job_logs` con `tail_lines` tarato a mano.

**⑥ ⚠️ `git checkout <file>` CANCELLA IL LAVORO NON COMMITTATO.** L'ho usato per ripristinare
dopo un sabotaggio e mi sono riportato indietro un file intero di cure. Per i sabotaggi:
`cp` in scratchpad **prima**, e ripristino dalla copia.

---

## 6. 🆕 NATE MISURANDO, non ancora in coda

**💶 I tre omaggi del cloud sono tutti e tre ORFANI** — le tre partite sono annullate, e la
terza l'ha disdetta lui due ore dopo l'omaggio: *«ho cancellato la partita perché non sono
venuti»*. Il sync **protegge apposta** le righe `paygift|…` dallo storno, ma niente le chiude
quando la partita sparisce ⇒ restano `status: paid` e **gli Incassi le contano come omaggi** di
partite mai giocate. ⚖️ Gli importi sono 0 € quindi i totali non sbagliano di un centesimo: a
sbagliare è il **conteggio degli omaggi**. 🚨 E il caso non è raro, è quello **tipico**: una
quota va a zero proprio quando i giocatori non si presentano. ⛔ **Nessuna cura proposta: la
scelta è sua.**

---

## 7. 🧰 Attrezzi

| | |
|---|---|
| ordine push | prima `test-preview`, **poi PR a `main`** (≤15 file, mai dal ramo `test-preview`) |
| edge | `supabase/functions/**` → `cudi` da `test-preview`, `qqbf` da `main`. **Un push le deploya** |
| ⚠️ `_shared/` | le cartelle con `_` iniziale **NON si deployano da sole**: viaggiano dentro il bundle delle edge che le importano. Toccare solo lì non manda niente in servizio |
| migrazioni | **nessun workflow le applica**: si fanno a mano con `apply_migration`, e **prima** del push delle edge |
| bot | `deploy-bot-hetzner.yml` (`workflow_dispatch`), bersaglio `soci` **richiede la parola `SOCI`**. `stato-bot.yml` legge i log in sola lettura |
| DB | MCP Supabase — PROD `qqbfphyslczzkxoncgex`, TEST `cudiqnrrlbyqryrtaprd`, memoria bot `aylykijfirtegyxzdwgu` |
| conteggi lista | l'aritmetica di `guard-docs-truth` si rifà in locale **prima** di spingere |
| ⏱️ latenza avvisi | dal gestionale, gesto sul roster: **~33 s** (`origine: conferma`). Dal sync: **~130 s + 0-120** di attesa del giro |

---

## 8. 🤝 Come si procede (invariato)

> *«Procediamo sempre come tu pensi sia corretto»* — copre anche le promozioni; il freno è la
> **dichiarazione**. Fuori: **inventare voci non in lista**, e l'irreversibile/visibile (si dice
> prima, anche procedendo). ✋ **Un task non è finito finché non è provato fisicamente.**
> 📌 E: **«scrivi troppo» — risposte corte.**

⭐ **Quello che la 65ª ha imparato, ed è una cosa sola:** *una domanda posta prima di agire vale
più di una cura scritta bene.* La sua ha riscritto il disegno della strada veloce; la mia,
mancata al mattino, mi aveva fatto inseguire per tre giorni una sonda che non poteva concludere —
e la risposta stava in quindici righe di codice che nessuno era andato a leggere.
