# Passaggio di consegne — 24/08/2026, sera

Sessione nata da **una sua domanda**, non da un difetto: *«se uno scrive al bot facendogli delle
domande, lui sa rispondere su tutto quello che abbiamo sviluppato per lui?»* — e la risposta
misurata era **no**. Da lì cinque voci nuove (**87 → 91**), quattro curate e in servizio, una
chiusa con prova sua.

---

## 🟢 COSA È IN SERVIZIO ADESSO — verificato sul bersaglio, non sul verde dei workflow

| dove | versione | come l'ho verificato |
|---|---|---|
| bot dei soci (VM) | `874cc6e` — deploy **#88** | riga d'avvio delle 16:58: `prenotazioni REALI` su `qqbf…`, e **«ogni 20 s»** (prova che gira il codice della 89) |
| gestionale PROD `qqbf…` | `3e37ee9` (PR #1052) | `consumer-player-readmodel` **v26**, con `in_campo` dentro |
| gestionale TEST `cudi…` | `72afd4a` | da `test-preview` |
| kb (PROD **e** TEST) | — | riletta dopo ogni scrittura; nessun deploy, è live all'istante |

⚠️ **`main` e `test-preview` sono identici** su `docs/`, workflow, `CLAUDE.md`, worker e sulle due
edge toccate. Controllato dopo il merge.

---

## 📦 CHIUSA: la 91

**La partita appena prenotata non si vedeva.** Il ragionamento che ha deciso la cura è **suo**: se
il gestionale ha detto «prenotata», la partita ce l'ha in casa, e mostrarla è un fatto interno.

⭐ **La distinzione che ha sciolto il nodo**: *«chi c'è»* e *«in che ordine»* sono due fatti diversi,
e stavano impastati in un unico `giocatori: []`. Ora `in_campo` porta i nomi e `giocatori` resta
l'unica lista **ordinata**.

🚨 **Il pericolo evitato, da ricordare**: `organizzatoreDellaPartita` prende **il primo** di
`giocatori` e **non guarda `ordine`**. Riempire quel campo avrebbe incoronato il primo nome della
copia locale — per una prenotazione dal bot è il socio *per fortuna*, per una scritta dalla
segreteria è chi capita.
📌 *Un campo che qualcuno usa per DECIDERE non si riempie di un dato che dice un'altra cosa: se ne
aggiunge uno.*

✅ **La prova, sua, al secondo**: copia locale nata **17:12:53** → lui guarda **17:13:34** (41″
dopo) e vede il suo nome, senza stella, senza posti liberi, con «⏳ questo elenco sta cambiando
proprio adesso» → la scheda del circolo arriva **17:14:53**. Finestra di **2 minuti esatti**.

---

## 🔴 LE TRE APERTE DI OGGI — manca solo la prova FISICA, e sono di tre difficoltà diverse

| voce | cosa manca | quanto è facile |
|---|---|---|
| **87** | cinque domande **scritte a mano** al bot: *come funziona la rubrica · come aggiungo un amico · come faccio ad avere un livello · quanto dura un invito · perché mi è arrivato questo messaggio* | 🟢 quando vuole. Sulle prime due deve comparire anche il bottone **📇 Apri la mia rubrica** |
| **89** | un gesto della segreteria **cronometrato** fino al messaggio sul telefono | 🟡 serve la segreteria. «Entro 1 minuto» oggi è **calcolato** (30s quiete + 20s ritiro = 50s), non misurato — e il calcolo non tiene conto della latenza di Telegram |
| **90** | una prenotazione che finisce in **esito ignoto** | 🔴 **non si provoca**: capita quando il circolo non risponde in tempo |

⏳ **La 88 («Partite Aperte») è ferma per sua scelta** — *«ne parliamo in un'altra sessione»*. Nella
scheda ci sono già le due domande di disegno da sciogliere: **cosa vede di una partita aperta chi
non ne fa parte** (i nomi, o solo «3 su 4, livello Intermedio»), e il filtro **rubrica + cliente**
da spezzare in due.

---

## 🗣️ LE SUE DECISIONI DI OGGI

· **I testi del bot li scrive LUI.** `rubrica.come_funziona`, `livello.come_funziona`,
  `inviti.come_funziona` sono parole sue. ⇒ Le mie bozze le avevo scritte leggendo il codice, che
  dice **cos'è** una funzione e non **come la si racconta a un socio**. Sulla rubrica la sua
  definizione è un'altra cosa dalla mia — *«le persone con cui ti piacerebbe giocare»* invece di
  *«le persone che hai fatto entrare»*: la prima dice a cosa serve, la seconda com'è fatta, e al
  socio serve la prima.
· **«Entro 1 minuto»** nella kb, scelto **a conseguenza dichiarata** dopo che gli avevo messo
  davanti tre strade. ⇒ Non è una descrizione, è un **bersaglio** (voce 89).
· **Niente tempi nella bolla dell'attesa**: né «un attimo» né il tetto. *«Non va bene che scrivi
  entro un quarto d'ora.»*
· **Le partite aperte** come direzione dichiarata ⇒ *«si gioca solo con chi hai in rubrica»* è vera
  oggi e **non è una legge del progetto**: va tenuta dove costa poco cambiarla (la kb), non in una
  guardia.

---

## 🎓 LE LEZIONI DI METODO — sono la parte che vale più del codice

**① Una guardia scritta insieme alla cura eredita le ipotesi della cura.** Il filtro delle note di
servizio (`_`) girava su una kb **finta**, scritta da me nello stesso momento: conteneva le `_` che
avevo in mente, non quelle che esistono. Su nove chiavi vere, **due** contenevano il testo e non un
appunto ⇒ per un'ora il bot non ha saputo spiegare avvisi e promemoria.
⇒ *Un filtro che decide per prefisso va provato sui dati VERI almeno una volta.*

**② Una nota che spiega perché una cosa non si può fare va riletta quando quella cosa viene fatta.**
Ho aperto la 89 dicendo «sono 4-8 minuti e il gestionale scopre invece di dichiarare»: **falso in
tutte e due le metà**. Avevo creduto a una nota del 22/08 superata il giorno dopo dalle voci 76 e
dal 23/08. La catena vera era 30s-2′30″ e la cura **una costante sola**.

**③ Un caso che pretende un valore scritto a mano non impedisce il drift: lo sposta dentro di sé.**
Il nome della voce di menu era scritto a mano in **sette** posti — e uno era il caso che avrebbe
dovuto accorgersene, rimasto a pretendere il nome vecchio. Ora nasce da `ETICHETTA_ELENCO`.

**④ Il banco non prova ciò che il bot DICE DI SÉ.** Dopo la 89 il bot ha dichiarato all'avvio
«ogni **0** min» — 1541 casi verdi col numero sbagliato stampato in faccia. L'ha trovato la lettura
del registro vero, fatta per un'altra ragione.
⇒ *Cambiare l'unità di una costante cambia anche chi la stampa.*

**⑤ Una schermata giusta al momento sbagliato risponde a un'altra domanda.** La sua prima prova
della 91 sembrava buona e non provava niente: era cinque minuti **dopo** l'arrivo della scheda.
Me ne sono accorto solo **datando il fatto** invece di guardare l'immagine.

**⑥ Un deploy verde risponde a «è ripartito?», non a «gira il commit che credo?».** Ho scritto due
volte «la metà del bot è in servizio» citando un deploy che **precedeva** il commit. Sono due
domande, e ho risposto alla seconda con la prova della prima.

**⑦ Ogni scorciatoia che scavalca l'agente gli sottrae un pezzo di mondo.** È la causa della voce
87: i comandi del menu sono intercettati **prima** del modello — scelta giusta — ma più il menu
cresce, più il modello resta indietro **senza che si veda**, perché dal bottone funziona tutto.
⇒ Ora c'è un caso che lo impedisce: *ogni voce del menu deve avere un intento corrispondente*.

**⑧ Un invariante fra due repo non si prova copiando: si divide in due impegni.** Il budget del
minuto (voce 89) è 60 secondi in due metà da 30 — la quiete la difende il gestionale, il ritiro il
bot, e nessuno dei due conosce il numero dell'altro.

---

## ⚠️ DA SAPERE PRIMA DI TOCCARE

· **Il modello riceve la kb quasi intera**, meno le chiavi `_`. Chi aggiunge una chiave nuova
  scriva il **contenuto** senza `_` e l'**appunto** con `_`, o il socio non la vedrà mai.
· **`in_campo` si legge per MOSTRARE, mai per DECIDERE.** `puoiTogliere`, `puoiUscire` e
  `alCompleto` restano su `giocatori`.
· **Dentro la finestra «Invita un giocatore» non compare**, e non è una regressione: invitare
  richiede di sapere chi ha organizzato, e quello lo dice solo la scheda del circolo. È la stessa
  attesa da cui nacque la voce 71.
· **Il ritiro dei fatti del circolo è a 20 secondi.** Alzarlo rompe la promessa scritta nella kb, e
  un caso lo dice. ⛔ `PERIODO_MS` (i promemoria) resta a 15 minuti: legge gli inviti **per ogni
  socio**, è un altro costo.
