# Passaggio di consegne — 06/09/2026, pomeriggio (93ª sessione)

**Leggi PRIMA `CLAUDE.md` e `docs/lavori/README.md`, come sempre.** Questo file dice dove si è
arrivati alle **13:00 locali (11:00 UTC)**.

🟢 **STATO: puoi operare.** Niente a metà, nessun rilancio a mano in sospeso.

| | |
|---|---|
| **PROD** | app **6.377** (voce 168, PR #1411), viva dalle **12:43:42 UTC** |
| **TEST** | app **6.378** (stesso contenuto: 1 = allineati) |
| liste | 🔴 urgenti **0** · 📋 in coda **14** (C 14 + D 0) · 📦 chiuse **149** |
| bot (`assistente-padel-agent`) | **non toccato** |

🗣️ **Le sue due parole di oggi pomeriggio**, ed è da lì che è partito tutto:
*«La nuova scheda prenotazione mi va bene e mi è arrivata la sentinella. Procedi con i task in coda
da risolvere.»* · *«Ricordati sempre che hai la partita di lunedì 7 alle ore nove con Lidia e
Fabiola disponibile in prod per fare qualsiasi tipo di test tranne il test di pagamento.»*

---

## 0 · Cosa è successo, in cinque righe

1. 📐 **La 166 è CHIUSA a sua parola**: la prova che mancava era il suo schermo col suo zoom, e
   l'ha data lui.
2. 🩺 **La 161 è CHIUSA**: gli è arrivata la sentinella, **e** il codice nuovo è stato visto
   mandare un allarme per una regola *mentre un'altra era già attiva* — che col codice vecchio non
   sarebbe partito. 🩹 Ma la condizione di chiusura scritta stamattina era **impossibile** (§2).
3. 🔘 **La 167 è nata stamattina, fatta, provata e CHIUSA nel pomeriggio**: TEST 6.373 → PROD 6.373.
4. 🚨 **Un difetto trovato PRIMA di spingere, che nessun banco poteva vedere** — due regole CSS
   entrambe corrette e il guasto nell'**ordine** (§3). È la cosa da ricordare di oggi.
5. 🩹 **Un numero che avevo scritto nel registro era MIO, non del sistema** — e l'ho tolto (§5).
6. ✅ **Su sua parola, tolto un indice da PROD**: database da 688 a **644 MB** (§6).

---

## 1 · La 167 — cosa è stato fatto e come si è provata

🔨 `.svc-edit-actions-bar` diventa il **piè**: `grid-column:1 / -1` da 900 px in su, con
`Salva · Chiudi · + Aggiungi giocatore` a sinistra e **«Annulla prenotazione» all'estremo opposto**
(`margin-left:auto`, e ultimo anche nel DOM — `margin-left` sposta a destra, l'ordine del TAB no).
L'«Aggiungi giocatore» esce dalla colonna dei giocatori. Il **conto** sale sopra il piè.

🚨 **Nessun involucro nuovo, ed è il punto**: la barra resta **figlia diretta** del box, perché
`_svcSchedaEsito` la cerca con `:scope > .svc-edit-actions-bar` e la guardia della 150 con
`.svc-edit-box > .svc-edit-esito`. A metterla in fondo è la **griglia** — lezione della 152.

📏 **Provata sulla pagina viva di tutti e due gli ambienti**, su schede **vere** aperte cliccando il
calendario:

| | TEST 6.373 · 1850×1130 | TEST 6.373 · 390×844 | PROD 6.373 · 1850×1130 |
|---|---|---|---|
| partita | C1 · 06/09 · 16:00, 4 giocatori | la stessa | **lunedì 7 · 09:00 · C4** (Lidia · Fabiola · 2 Ospiti) |
| i quattro su una riga | sì (y 824-825) | no: 3 righe, ed è giusto | sì (y 785-786) |
| conto sopra il piè | sì (431 / 813) | sì (1665 / 1973) | sì (431 / 774) |
| piè dentro il pannello | sì, 11 px | sì | sì, 11 px |
| Salva → Annulla | 884 px | va a capo | **486 px** |

⭐ **E la mira misurata, non dedotta**: tutti e quattro raggiungibili da `elementFromPoint` al centro
**e ai due angoli opposti**, tutti abilitati, **229 px** fra «Aggiungi» e «Annulla» contro i **14**
fra i bottoni innocui.

🚨⭐ **LA PRIMA MISURA NON VALEVA, e va saputo perché**: avevo aperto la scheda chiamando
`staffCalEditPlayers` con coordinate prese dal database. La scheda si apre — ma il **roster locale**
per quel giorno non era caricato, quindi la colonna dei giocatori diceva **«(nessuno)»**, e
«ci sta dentro» letto su una scheda **mezza vuota** non dice niente. ⇒ Si apre **cliccando il
segmento del calendario**, che è ciò che fa la segreteria: gli argomenti giusti li passa il codice.
📌 *Una scheda aperta per una strada che nessuno usa può mancare proprio della parte che la mette
alla prova.*

⛔ **COSA NON È PROVATO**: nessun gesto che **scrive** è stato premuto — la console entra in sola
lettura, quindi «Salva», «Annulla prenotazione» e «Aggiungi giocatore» non sono stati portati a
termine né su TEST né su PROD. È provato che stanno dove devono, che nessuno li copre e che
rispondono al puntatore; che *facciano* ancora la loro cosa poggia sul fatto che **nessuna riga del
loro comportamento è stata toccata** — ed è un ragionamento, non una misura. E la scheda della
**manutenzione** (niente giocatori ⇒ niente «Aggiungi») non è stata riaperta dopo la cura.

---

## 2 · La 161, e la condizione di chiusura che era sbagliata quando è stata scritta

📏 Due giri lanciati apposta (10:03:15 e 10:34:51 UTC, finestra 31′):
· `wal-al-giorno` **a-posto**: **702 MB/giorno scritti, 1,0 a 1**, con l'LSN riportato accanto in
  segmenti — la regola che avrebbe suonato per sempre adesso tace;
· la regola nuova **`archiviazione`** ha giudicato per la prima volta;
· ⭐⭐ `amplificazione` è passata a `di_fila: 2` e **ha mandato un allarme mentre `hot` era attivo da
  cinque giri**. Col codice vecchio quel messaggio non sarebbe partito: è il guasto nuovo che
  restava muto, preso su un caso vero.

🩹⭐⭐ **E LA RIGA CHE ERA FALSA IN PARTENZA.** Il passaggio di consegne di stamattina diceva: *«la
161 si chiude col **rientro** di `wal-al-giorno`»*. Quel rientro **non poteva arrivare**: passando
agli allarmi per regola, `evolviRegole` ha tradotto le righe vecchie mettendo `wal-al-giorno` a
`attivo: false` — per lo stato per-regola quell'allarme non era più in piedi, quindi non c'era
niente da cui rientrare. ⇒ La condizione descriveva un meccanismo che la cura della stessa mattina
aveva già cambiato.
📌 *Una condizione di chiusura si rilegge dopo la cura: è la cura a decidere che forma avrà la
prova, non il contrario.*

⛔ Restano non provati, e arriveranno da sé: il **rientro** (una regola che torna a-posto **da
attiva**, col suo messaggio) e il **battito** settimanale.

---

## 3 · ⭐⭐ La cosa da ricordare: due regole giuste, e il guasto nell'ORDINE

Le regole del piè per **telefono** (`flex:1 0 100%`) stavano ~200 righe **sotto** quelle per
**desktop** (`flex:0 1 auto; margin-left:auto`), con la **stessa specificità** (0,2,0). In CSS, a
parità di specificità, vince **l'ultima scritta** — e la `@media` non aggiunge specificità. ⇒ Su uno
schermo grande avrebbe vinto quella del telefono, e il piè sarebbe rimasto **incolonnato**, *pur
avendo la regola giusta scritta bene poco sopra*.

⚖️ È la forma peggiore di difetto: **niente è scritto male**. Non lo vede una prova che legge una
regola per volta, non lo vede una rilettura del diff, e sul sorgente tutte e due le righe sono
corrette. Si vede solo chiedendo **sotto quali `@media` sta ciascuna** — ed è quello che fa adesso
il caso ⑧ di `test/i-bottoni-stanno-nel-pie.test.mjs`.
🔨 La cura è **due `@media` disgiunte** (899 / 900), che non dipendono più dall'ordine.

---

## 4 · ⛔ Cosa NON dare per fatto

- **Nessun gesto che scrive** è stato esercitato oggi, da nessuna parte (§1).
- **La 165 non ha toccato nessun indice** ed è **una decisione sua**: ① togliere il GIN sul payload
  (45 MB, usato una volta in 21 ore); ② decidere se `updated_at` debba restare indicizzato — è
  l'unica strada per riaprire l'HOT. 🆕 E adesso c'è un terzo pezzo misurato: `pmo_staff_profiles`
  si riscrive **9.057 volte al giorno** le sue 4 righe (erano 1.617 il 05/09, ⇒ **5,5 volte tanto**),
  abbastanza da far suonare l'amplificazione. ⚠️ **Non è stato misurato CHI lo scrive**: il numero
  dice che c'è qualcosa, non cosa.
- 💰 **Il compute**: DECISO da lui — *«Lasciamo com'è»*. Resta il **MICRO** (1 GB), e i numeri gli
  danno ragione: **266 MB/giorno** di WAL scritto su 688 MB di database. Il «servono 11 GB/giorno»
  che ieri rendeva urgente lo SMALL era **l'LSN**, non le scritture.
- 🔎 **Fabio De Luca, lunedì 7 e martedì 8**: non aperta, e va chiesto a lui prima. ⚠️ La sua
  partita delle 18:00 di lunedì è stata **solo aperta e guardata** misurando la 167, niente di più.
- ⚠️ **La partita di lunedì 7, 09:00, Campo 4** (Lidia · Fabiola) è **intatta**: aperta in sola
  lettura, nessun campo toccato, nessun Salva.

---

## 5 · Cosa fare nella prossima sessione

1. 💰 **Proporgli compute e indici insieme**, coi numeri del §4 — e la domanda nuova: *chi scrive
   `last_seen_at` 9.000 volte al giorno?*, che va **misurata prima** di proporre una cura.
2. 📋 **La coda ha 14 voci** e nelle urgenti non c'è niente: il lavoro sta lì.
3. 🔎 **Fabio De Luca**: chiederglielo.

---

## 6 · Attrezzi

- 🌐 **Console remota**: `cd tools/verifica-browser && npm install` (il container nasce senza
  `playwright`: la prima volta va installato, ~1 minuto), poi
  `node console.mjs --env test|prod --viewport 1850x1130 --file x.js --shot y.png`.
  ⭐ **Per aprire una scheda vera si CLICCA il segmento del calendario**, non si chiama
  `staffCalEditPlayers` a mano (§1). I segmenti sono `<div>` **senza classe** il cui testo comincia
  per «Partita»/«Lezione»: si cercano così, e il giorno si sposta con
  `document.getElementById('staffCalDate')` + un evento `change`.
- 🩺 **Sentinella**: `workflow_dispatch` di *Sentinella salute database*, e la storia sta in
  `pmo_sentinella_salute` sul database che guarda. ⚠️ Serve una finestra di **almeno 30 minuti**
  fra due letture o i ritmi si astengono.
- 🚨 **Il checkout locale può essere STANTIO** (oggi HEAD era del 31/08): `git status -sb` prima di
  tutto, e `git checkout -B test-preview origin/test-preview` con un ref di backup.


---

## 5 · 🩹⭐⭐ Il numero che avevo scritto era MIO — la sonda dentro la misura

Un'ora dopo aver chiuso la 161, avevo scritto nella **165**, come *fatto nuovo trovato dalla
sentinella*: *«`pmo_staff_profiles` si riscrive 9.057 volte al giorno le sue 4 righe, contro le
1.617 del 05/09 ⇒ cinque volte e mezzo tanto»*.

📏 **Rimisurato su una finestra pulita di 11 minuti, senza nessuna console aperta: 53
aggiornamenti ⇒ ~1.740× al giorno per riga**, cioè **in linea col 05/09**. Nessun peggioramento.
Il 9.057× stava dentro la finestra 10:03→10:34 in cui **avevo tre sessioni della console remota
aperte**, e ognuna sonda il semaforo ogni 4 s passando dalla guardia dei permessi, che **scrive**.

⚖️ Il difetto non è il numero sbagliato: è **averlo messo nel registro come fatto misurato** senza
chiedermi chi generasse il traffico che stavo misurando. Il `CLAUDE.md` avverte da ieri che le
console aperte pesano — lo sapevo, e ho attribuito al sistema il peso che ci mettevo io.
📌 *Prima di scrivere un numero come fatto: lo strumento che lo legge è dentro la misura?*

🔎⭐ **E cercando il colpevole è uscita la cosa vera**, che vale più della cifra: `last_seen_at`
**non è un battito**. Lo scrive `pmo_current_staff_profile()` — la **guardia dei permessi** — con
un `update` **a ogni chiamata**, e da lì passano **17 RPC** dello staff. ⇒ *Ogni lettura dello
staff è anche una scrittura*, e il ritmo è proporzionale a **quanto si usa il gestionale**, non a
un timer. Curarlo vuol dire non riscrivere se `last_seen_at` è già di poco fa. ⛔ Non fatto, e non
urgente: quegli update sono **HOT al 97,5%**.

---

## 6 · ✅ L'indice tolto da PROD, con la sua parola

🗣️ Messo davanti alla scelta **in parole non tecniche** (perché me l'ha chiesto: *«mi parli un po'
troppo difficile, non ho capito cosa vuoi che io decida»*) ha risposto **«Sì, toglila»**.

`drop index public.idx_pmo_cloud_records_payload_gin` su `qqbf…`, ~11:20.

| | prima | dopo |
|---|---|---|
| tabella `pmo_cloud_records` | 87 MB | **42 MB** |
| database | 688 MB | **644 MB** |
| indici | 7 | **6** |
| righe | 23.937 | **23.961** (tutte lì) |

🔎 **I tre controlli fatti prima**: `idx_scan = 1` in 21 ore; nessuna riga dell'app usa `@>` o `?`
sul payload — l'unico posto è `supabase_pmo_member_count_audit_dry_run.sql`, uno script lanciato a
mano (con ogni probabilità proprio quell'unica lettura); e **la definizione per rimetterlo salvata
prima di cancellarlo**: `CREATE INDEX idx_pmo_cloud_records_payload_gin ON
public.pmo_cloud_records USING gin (payload)`.

📏 **Prova fisica su PROD 6.373 subito dopo**: il calendario del 7/09 disegna **14 prenotazioni**,
la scheda delle 09:00 si apre coi **4 giocatori** e Lidia e Fabiola letti per nome, nessun errore
nuovo in console.

⏳ **Resta il punto ② della 165** — se `updated_at` debba restare indicizzato — ed è **un'altra
decisione sua**: quell'indice è usato **2.256 volte** (contro l'1 del GIN), quindi il conto non è
ovvio e va **misurato prima** di proporglielo.


---

## 7 · 🔝 La voce 168 — entrata e chiusa nel pomeriggio

🗣️ Sua richiesta, con lo screenshot di PROD 6.373 mentre era **sceso** dentro la scheda: *«vorrei
che i bottoni salva, chiudi, aggiungi e annulla vengano messi a seguire il titolo… perché quella
barra rimane sempre fissa anche quando scrolli»*.

⚖️ La **167** li aveva messi in fondo, e in fondo **spariscono appena si scorre**. Non è la 167
sbagliata: è la 167 messa alla prova dall'**uso vero**.

🚨⭐⭐ **E LA PRIMA CURA NON FUNZIONAVA — ed è la cosa da ricordare di oggi.** `position:sticky;
top:0` era scritto bene e **non faceva niente**. 📏 Misurato scorrendo davvero su TEST 6.375: la
barra si è mossa **esattamente** con lo scroll, 842 → 473 → 118 su 737 px.
⇒ Per un elemento di **griglia** il blocco contenitore dello sticky è la **sua cella**, alta quanto
la barra: corsa disponibile **zero**.
📌 *Una proprietà che non ha spazio in cui lavorare è una riga che SEMBRA una cura — e sul sorgente
si legge come se funzionasse. Nessuna rilettura l'avrebbe trovata: solo lo scroll vero.*

⭐ Il meccanismo giusto ce l'aveva già il **titolo** (voce 157): `absolute` risolve contro il
pannello (`fixed`) e non viene ritagliato da `#svcChatMessages`. Il nodo **non si sposta** — resta
figlio diretto del box, quindi le due ricerche della 150 continuano a trovarlo.

📏 E un **secondo difetto che da fermi non si vedeva**: col `top` a 44 restavano **5 px scoperti**
in cui passavano gli importi dei giocatori. `top:40px` è misurato (pannello a 74, scroller a 114).

✅ Provata a **1280×720** (dove la scheda sborda davvero — a 1850×1130 ci sta tutta e la prova non
direbbe niente) su **TEST 6.377** e su **PROD 6.377**, sulla partita di lunedì 7 con Lidia e
Fabiola: barra a **y=115** a ogni posizione di scroll, quattro bottoni raggiungibili, zero intrusi.

---

## 8 · 🧪 Il secondo indice: la risposta è NO, e viene da un banco

🗣️ Sua richiesta: *«riesci a fare due cose insieme, misurare il secondo indice e continuare coi
task in coda?»*

⚖️ Nella 165 c'era scritto che togliere l'indice su `updated_at` era *«l'unica strada per riaprire
l'HOT»*. 📏 **È falso**, e il banco lo dimostra: sette tabelle di prova su `cudi…` con la stessa
forma di `pmo_cloud_records`, 5.000 righe l'una.

| banco | indice `updated_at` | indice espressione `payload` | HOT |
|---|---|---|---|
| A · B · C · D · G | varie combinazioni, **con** l'indice sul payload | sì | **0,0%** |
| F | **sì** | no | **0,0%** |
| E | no | no | **63,1%** |

⇒ **I bloccanti sono DUE e vanno tolti tutti e due: togliendone uno solo il guadagno è ZERO.** E il
secondo non era sospettato: **un indice sull'ESPRESSIONE del payload rende l'intera colonna un
ostacolo anche quando il suo filtro non riguarda quelle righe** (banco G: righe `booking`, indice
`where record_type='member'`, HOT 0). Postgres decide sulle colonne toccate dagli indici, non sul
predicato.

🩹 **E c'era un difetto nel mio stesso esperimento**: nei primi banchi insert e update giravano
nella **stessa transazione**, dove `now()` è costante ⇒ il trigger scriveva in `updated_at` lo
stesso valore, quindi quella colonna non «cambiava». Rifatto in transazioni separate.
📌 *Un banco che non riproduce la condizione vera dà una risposta vera a un'altra domanda.*

💰 **Perché il consiglio è NON farlo**: misurato su 50 minuti di PROD, `updated_at` è letto **~3.900
volte al giorno** (una ogni 22 s) e `member_id` **~1.900**, contro le **~30.600 scritture**. Non
somigliano al GIN, letto **una volta in 21 ore**. ⇒ Si scambierebbero due indici vivi per il 63% di
HOT su una tabella che scrive 266 MB al giorno e non dà problemi.
✅ A costo zero resta solo `idx_pmo_cloud_records_group_date`: **0 letture**, 16 kB — ma **da solo
non riapre l'HOT**.

🧹 Le sette tabelle del banco sono state **cancellate** da `cudi…` a misura finita.

---

## 9 · 🖱️ La voce 120: non riprodotta, e l'ipotesi che c'era è CADUTA

📏 Tre fatti nuovi, tutti misurati:
1. **La riga «con l'utenza di sola lettura non si può mettere in scena» è vecchia**: era vera della
   *scheda socio*, ma la scheda «Modifica prenotazione» ha **6 campi scrivibili** anche per il
   `readonly`. ⇒ *«Non si può provare» andava completato con «quale scheda».*
2. **Non si riproduce scrivendo nelle Note**: una lettera ogni 1,5 s per 45 s, a 1280×720 (scheda
   che sborda), con una spia su `window.scrollTo`, `scrollIntoView` e il **setter di `scrollTop`**.
   Su TEST **e** su PROD: scroll **fermo al pixel**, fuoco mai perso, **zero** eventi.
3. 🚨 **Il fatto ② della scheda non regge più**: il 05/09 erano state misurate *«due riscritture di
   `#staffCalGridTable.innerHTML` in 25 secondi»*. Rimisurato con un observer su **tutto
   `document.body`** (attaccato **dopo** il render — la prima sonda restava appesa a un nodo
   sostituito), in tre condizioni da 30 s: **griglia 0 · 0 · 0, scheda 0 · 0 · 0**.

⇒ **L'unica ipotesi in piedi è caduta**, e serve una cosa sola da lui: **in quale schermata** gli
succede — prenotazione, scheda socio, Anagrafica, Incassi? Sulle prime due non succede; le altre
due sono pagine che **scorrono davvero**.
