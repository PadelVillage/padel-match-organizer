# Padel Match Organizer — i lavori

**Fotografia del 16/08/2026, a fine 24ª sessione.** Misurata, non ricordata.

## 🔎 Il filo della 24ª: **la sonda che guarda ALTROVE, o TROPPO PRESTO**

La 23ª aveva trovato lo strumento **cieco** — che guardava un quinto del bersaglio senza saperlo.
Questa ha trovato i due fratelli, e sono più insidiosi perché lo strumento **funziona**: cerca nel
posto sbagliato, o guarda prima che il fatto sia successo. **Cinque volte in una sessione.**

| dicevo | cos'era |
|---|---|
| «**nessuno** dei 4 maestri ha una scheda socio» | la sonda cercava i nomi in `nome`/`cognome`, ma le schede usano `firstName`/`surname` ⇒ **avrebbe risposto zero qualunque fosse la verità**. Ce l'hanno **due su quattro** |
| «la routine non ce l'ha fatta» | leggevo `lastFullSuccessAt`, che appartiene a **un'altra strada**, e lo prendevo per il verdetto di quell'import |
| «il calendario non si è mosso» | misuravo alle **21:47**; la scrittura è atterrata alle **21:48:15** |
| «non è partita nessuna cancellazione verso Matchpoint» | cercavo fra i `booking_job`, ma una cancellazione lì **non compare**: lascia un `staff_cancel`. ⇒ Ho fatto **ricancellare una prenotazione già cancellata**, e a smentirmi è stato **lui guardando Matchpoint** |
| «guardie verdi su entrambi i rami» | ne avevo guardate **due su quattro**: `guard-docs-truth` era **rossa su `main`** da mezz'ora, per un numero della tabella riassuntiva che non avevo aggiornato |

⚖️ **La lezione non è «ricontrolla».** È che tutte e cinque le volte la sonda **ha risposto**, con
sicurezza, e la risposta era priva di valore. ⇒ La domanda da farsi non è «cosa dice?», è **«questa
sonda guarda nel cassetto giusto, e dopo che il fatto poteva essere accaduto?»**. Uno zero non è un
esito finché quelle due cose non sono verificate.
🚨 E la quinta è la peggiore, perché non era una misura sbagliata ma **una misura non fatta**: avevo
verificato **i numeri che pensavo io** invece di quelli che controlla la guardia — e una verifica che
riproduce metà del controllo dà **lo stesso identico verde** di una completa, finché non incontra il
caso in cui le due metà divergono.

🎯 **E il secondo filo, dal lato opposto: un caso di prova verde non vale finché non lo si sabota.**
Dei quattro casi nuovi scritti nel banco, **tre erano INERTI alla prima stesura** — verdi anche col
difetto acceso. Le cause, tutte misurate: ① la push vinceva sempre la corsa sulla rilettura, quindi la
guardia non entrava mai in gioco; ② un controllo negativo letto **subito**, prima che la frase avesse
tempo di comparire; ③ **l'app svuota la chat** dopo un'operazione confermata, e quel timer scatta
mentre gira il caso dopo ⇒ la frase veniva detta **e cancellata prima di essere guardata**, con lo
stesso caso **ROSSO da solo e VERDE dietro al vicino**. ⇒ Due verdetti opposti sullo stesso codice,
decisi da un timer di qualcun altro.

🎯 **E la terza: una procedura scritta bene può essere ineseguibile, e lo si scopre solo eseguendola.**
La parte B della voce 41 è fallita **tre volte** prima di riuscire, e nessuno dei tre fallimenti era
un errore di esecuzione: ① «conta due secondi e dai lo stop» non teneva conto che lo stop via `ssh`
**ci mette del suo**; ② 🚨 **`systemctl stop caddy` non taglia una richiesta già in corso** — è uno
spegnimento *gentile*, e con collegamento già aperto e stop istantaneo al 2º secondo il lavoro
finiva `done` in 4,3 s lo stesso; ③ tenere il collegamento aperto mentre si prenota **lo fa scadere**.
⇒ Al quarto giro, con `SIGKILL` al posto dello stop, **tutte le previsioni si sono avverate**.

## 📌 Le decisioni prese dal committente nella 24ª

| | |
|---|---|
| 🔓 **«aggancia il repo del bot»** | e la scheda della 14bis diceva che era «fuori dal perimetro»: **non lo era**. Da lì la voce si è potuta rispondere |
| 🔓 **«insegna al banco a rispondere a quella domanda»** | il ponte del bot non era modellato ⇒ della proposta del link d'ingresso si provava **solo il ramo del guasto** |
| ⛔ **«lasciamo perdere i maestri, lo faremo quando ci stacchiamo da Matchpoint»** | ⇒ 14bis chiusa **senza farla**, e la ragione **regge nel dato**: sulle lezioni sincronizzate il campo istruttore è **sempre vuoto** |
| 🔑 **«avevamo deciso insieme di fermare tutte le routine di test»** | ⭐ **l'informazione che ha sbloccato la 34, e non stava in nessun file**: non erano spente per un guasto, erano spente **per avere il controllo** |
| ⭐ **«perché non metti un aggiornamento adesso a mezzanotte così proviamo?»** | ⇒ **ha evitato un errore che sarebbe passato per successo**: la mattina dopo si sarebbero viste 5 righe verdi e si poteva dichiarare fatto **contando i lanci invece di guardare i dati** |
| ✋ **le mani sulla voce 41** | la prova la poteva fare **solo lui**: due finestre, due secondi di tempismo, e una prenotazione vera sul Matchpoint del circolo |
| 🗣️ **«non c'è nessuna prenotazione, né sul gestionale né su Matchpoint»** | 🚨 **mi ha smentito una misura**, ed era lui ad avere ragione: guardava il sistema vero, io la nostra copia |
| 📦 **«chiudi la 34 e la 26»**, poi **«porta in urgenti 42, 14 e 43»** | ⇒ la lista è tornata **vuota** e poi si è riempita di nuovo, **tutta di voci lavorabili dal cloud** |

**E la 23ª, il giorno prima:**

## 🔎 Il filo della 23ª: **lo strumento che guarda solo un pezzo del bersaglio**

La 16ª aveva imparato a diffidare della **prova che ti dà ragione**; la 20ª, dello **strumento che
la produce**. Questa ha trovato il caso peggiore della famiglia: uno strumento che **funzionava
benissimo su una porzione del bersaglio, e non sapeva di guardarne una sola**.

| lo strumento diceva | cosa era davvero |
|---|---|
| «le funzioni Autovalutazione morte sono **71**» | l'analizzatore parsava **UN SOLO blocco `<script>` su cinque**. L'app ne ha uno da **976.000 caratteri** ⇒ **645 funzioni erano invisibili come chiamanti**, e tutto ciò che chiamavano risultava «senza chiamanti» |
| «`assessmentEmailSendControlledFollowupTest` è morta» | **falso morto**: la invoca un `onclick` generato e passato **nudo** a `assessmentProcessButton(label, tipo, "nome(...)")`. La sonda cercava `onXXX=`. Potarla avrebbe rotto un bottone vivo — e con lei un'altra |
| «il perimetro è 64 funzioni, come dice la scheda» | il filtro per prefisso `assessment*` nascondeva **34 funzioni** che si chiamano `buildAssessment*`, `openAssessment*`, `renderAssessment*` |
| «`buildAssessmentSecretaryPrompt` è viva» | il mio elenco di controllo era filtrato **collo stesso prefisso**: quel nome non poteva comparirci nemmeno da morto |
| «le morte sono 227» | erano **221**: contavo le 6 righe d'intestazione che lo script stampa sempre |

🎯 **E a smascherare il difetto grosso non è stata una sonda più fine: è stata la verifica DOPO il
taglio.** La prima potatura ha lasciato **due riferimenti orfani** nel file; tirando quel filo è
venuto fuori che l'app aveva cinque blocchi e io ne guardavo uno. ⇒ Senza quel controllo avrei
cancellato codice vivo **con tutti i verdi accesi**: sintassi verde, banco verde, nessun riferimento
apparente. ⚖️ **La lezione non è «misura meglio prima»: è GUARDA COSA RESTA DOPO AVER AGITO**, perché
è lì che uno strumento cieco si tradisce.

🚨 **E la stessa forma mi ha fatto sbagliare una CORREZIONE**, che è il modo più insidioso: ho
«corretto» la frase «*non è un incidente come le tre della notte del 14/08*» credendola riferita ai
tre lavori `unknown` — che sono del 14 **e** del 15. Era **giusta com'era**: parlava delle tre
**prenotazioni vere** create per sbaglio quella notte (misurate: 3 `staff_booking` fra le 21:55 e le
22:00, tutte `deleted`). ⇒ **Due terzetti diversi con lo stesso numero**, e ho preso l'uno per
l'altro. Disfatta, e annotata nel documento perché non ricapiti a chi rilegge.

## 📌 Le decisioni prese dal committente nella 23ª

| | |
|---|---|
| ⬆️ **tre voci promosse dalla coda** | la lista urgenti era **vuota da qui**: le quattro che c'erano erano tutte fuori portata. Ha scelto **15**, **28** (la potatura) e **14** (rifondare la sonda) |
| 🔓 **il perimetro della potatura, scelto guardandolo** | messo davanti a quattro perimetri — 103/1491, 69/945, solo le email, o «mostrami il diff» — ha preso **il più largo**, quello onesto. ⚖️ Ed è stata la scelta giusta per una ragione che nessuno dei due sapeva allora: gli altri due numeri venivano dallo stesso analizzatore cieco |
| 📚 **«riscrivi la quattordici con questi numeri»** | la voce 14 diceva «⑩ chiavi»; sono **438**. Ha scelto di **riscriverla**, non di chiuderla: la domanda vera — togliere il nome dalla chiave — resta sua |
| ⬆️ **«promovi tutto su Test Preview»**, poi **«promovi anche a prod»** | due conferme **separate**, come la regola richiede. TEST **6.241**, PROD **6.232** |
| 🔍 **«il deploy della 743 è fallito»** | e non era vero, ma la segnalazione era giusta: sul merge non era scattato **nessun** workflow di deploy, e il rosso erano le due **guardie**. ⇒ Misurato che l'app era già servita alla 6.241. **La cosa che vede lui non è mai da archiviare, anche quando la diagnosi cambia** |
| 📦 **«riscrivi la coda della 28 e chiudila»** | chiusa **a residuo dichiarato**. La coda della voce era diventata falsa: parlava della potatura come se fosse da fare |
| ❓ **«perché c'è ancora la 41 in coda?»** | ⇒ **una domanda che ha corretto una mia scelta.** Gli avevo proposto di prepararla invece di chiuderla, e lui ha preso **la terza strada che non avevo messo fra le opzioni**: promuoverla fra le urgenti |

**E la 22ª, poche ore prima:**

## 🔎 Il filo della 22ª: **la misura che concorda col documento**

La 16ª aveva imparato a diffidare della **prova che ti dà ragione**. La 20ª, a diffidare dello
**strumento che la produce**. Questa le ha viste **sommarsi**, ed è la combinazione peggiore: una
sonda che sbagliava **nella stessa direzione in cui il registro sbagliava già**.

| quello che davo per buono | cosa era davvero |
|---|---|
| «il `readonly` non vede le prenotazioni» — **e il registro lo diceva identico** | chiamavo `pmoCloudRpc` **senza `accessToken`**: partivo come **anon**, il server rispondeva `AUTH_REQUIRED` e l'app lo traduceva in «Accedi con email personale Supabase». Misuravo **la mia chiamata**, non il `readonly` |
| «le riceve, ma di vive nemmeno una»: `{}` per tipo | **1000 righe è il tetto di PostgREST**, non la fine dei dati. Paginando: **8359** righe, vive **44 / 60 / 150**, identiche al conteggio SQL |
| «le guardie reggono, la corsa è verde» | su PROD `richiesteBloccate` era **vuoto**: l'app non aveva **tentato** nulla. Verde perché non interrogata, non perché interrogata e assolta |
| «la nota sulla seconda guardia descrive l'oggi» | invecchiata **in un giorno**: la 6.231 (#734) fa ricordare `PADEL_CONFIG` anche dopo il login, e la nota raccontava un guasto **già riparato** |
| «lo script di preparazione c'è, l'ha sistemato la 21ª» | il campo «Script di configurazione» dell'ambiente era **vuoto**: container crudo, e la console non raggiungeva **nessun** sito |

⚖️ **La lezione non è «ricontrolla»**, che è la versione comoda. È: **una misura che CONCORDA con ciò
che c'è scritto non ha ancora verificato niente** — ha prodotto la seconda copia della stessa
affermazione. E il primo verdetto sbagliato sarebbe passato per **diligenza**: *chiesto di
verificare, verificato, confermato*, con una sonda nuova a fare da testimone. ⇒ La domanda giusta
non è «la sonda e il documento dicono la stessa cosa?», è **«questa sonda, su questa strada, con
questo token, cosa saprebbe vedere se il documento avesse torto?»**. Qui la risposta era *niente*:
partendo come `anon` quella sonda avrebbe detto «non vede» **qualunque** fosse la verità.

🎯 **E il secondo filo: una protezione che tace non è una protezione osservata.** Le tre guardie
della console sono passate due collaudi senza che nessuna dicesse mai di **no** — su PROD, alla
corsa finale, `richiesteBloccate` era vuoto. Non è una buona notizia: è **assenza di notizia**.
Esercitate apposta con bersagli innocui, hanno risposto tutte, **compresa la controprova positiva**
— la lettura legittima passa — che serviva perché senza di essa «blocca tutto» si legge come
«funziona». ⚠️ Ed è rimasto scritto ciò che **non** si è potuto esercitare: il ramo di ripiego della
seconda guardia, perché il *no* lo pronuncia sempre la prima, che aborta prima.

🎯 **La terza, e riguarda dove vivono le protezioni.** `tools/verifica-browser/` su `test-preview`
era fermo alla **#722** e non aveva mai ricevuto la **#727**: una copia della console che, lanciata
da lì, sarebbe morta all'avvio. Nessuno l'aveva visto perché quella cartella sotto
`guard-worker-sync` **non ci sta** — e un drift che nessuno sorveglia non fa rumore, aspetta. Stessa
forma del difetto ①: l'attrezzo dipendeva da una **casella di configurazione che nessuno vede**, e
quel tipo di dipendenza si rompe nella sessione **nuova**, cioè quando lo si tira fuori per la prima
diagnosi ed è il momento in cui si è meno disposti a sospettare l'attrezzo invece del sito.

## 🔎 Il filo della 20ª: **lo strumento mente prima del codice**

Le sessioni precedenti avevano imparato a diffidare della *prova*. Questa ha imparato a diffidare
dello **strumento che la produce** — ed è successo **cinque volte in un giorno**, sempre con la
stessa forma: una misura ripetibile, quindi credibile, e falsa.

| lo strumento diceva | cosa era davvero |
|---|---|
| il banco fa **24/55**, con 31 eccezioni `localStorage null` — e lo rifà uguale al secondo giro | era il **runner**, che interrogava la pagina *mentre il giro girava*. Aspettando alla cieca e leggendo una volta sola: **55/55**. 🚨 E l'A/B tornava lo stesso — 24 contro 24, «nessuna regressione»: conclusione giusta, con due strumenti rotti |
| «il rimbalzo `switchTab(` c'è ancora dopo il fix» | la sonda pescava **il commento appena scritto**, che quella riga la cita. Saltando le righe di commento: **1 → 0** |
| «la promozione su TEST non è atterrata»: due contatori sporchi | **gli stessi commenti**, di nuovo. Due ore dopo, stessa trappola |
| «33 casi mancanti a PROD, il grosso è la famiglia vai-a-GUARDARE» | confrontavo per **id**, e gli id sono **rinumerati** fra i rami. Quella famiglia `main` **ce l'aveva**. Rifatto per **nome**: mancavano 35, e il grosso erano i **PAGAMENTI** |
| il sabotaggio `PMO_WALLET_WRITE_ENABLED = false` non fa rosso ⇒ «la rete è debole» | **inerte**: l'harness scavalca quell'interruttore. Sabotando il *payload* la rete va **85/87** e cadono i due casi giusti |

⚖️ **La lezione non è «controlla due volte»**, che è quello che si dice sempre. È più stretta:
**una sonda che cerca una stringa nel codice deve saltare i commenti**, un runner non deve toccare
il bersaglio mentre misura, un confronto fra rami non deve poggiare su un campo che i rami
rinumerano, e **un sabotaggio che non fa rosso non dice che la rete è debole: dice che hai rotto la
cosa sbagliata.** Quattro regole concrete, non un invito alla prudenza.

🎯 **E una l'ha corretta il committente, non una misura**: lavoravo su «cinque pannelli tolti da una
sezione viva», e lui ha detto *«la sezione autovalutazione l'abbiamo rimossa»*. Misurato:
`PMO_ASSESSMENT_PARKED = true` **dal 13/06**, nascosta a tutti. ⇒ I cinque pannelli erano stati tolti
**dentro una stanza già chiusa**, e il fix che avevo appena scritto rifiniva una stanza in cui non
entra nessuno. È la quarta volta in tre giorni che la correzione che conta la porta lui.

## 🔎 Il filo della giornata: **la prova che ti dà ragione**

La 15ª sessione aveva imparato che *una porta chiusa non è LA porta chiusa*. La 16ª ha imparato la
cosa accanto, e le è successo **tre volte**, sempre con la stessa forma: una misura che sembrava
confermare, e non confermava niente. 🚨 **La 17ª ha scoperto che una di quelle tre era falsa a sua
volta** — e l'ha aggiunta in fondo alla stessa tabella, che è il posto dove doveva stare.

| la prova diceva | cosa era davvero |
|---|---|
| «`wa-shadow-proxy` non riceve più chiamate» — sonda su `edge_logs`, **0 risultati** | sorgente sbagliata: le edge stanno in **`function_edge_logs`**, dove i 404 erano **619 in 24 ore**. Salvata dal controllo negativo — chiedere alla sonda se sa trovare *qualcosa* (7398 righe) prima di credere a uno zero |
| «le tre policy `ALL` su TEST aprono lettura e scrittura ad `anon`» | **decorative**: ad `anon` mancano i grant di tabella, e l'attacco risponde `42501` **prima** di qualunque modifica. Il no non veniva dall'RLS |
| «i 404 sono andati a zero dopo il disarmo: funziona» | **no**: si erano fermati **12 e 13 minuti PRIMA** che la cura fosse live. Non era una riparazione, era **una scheda del gestionale chiusa** |
| *(17ª)* «i 404 si erano comunque fermati, alle 18:26 e alle 18:29» | **nemmeno per idea**: non si sono **mai** fermati. Ne arrivava uno al minuto ancora alle **19:31**, da una scheda rimasta aperta col codice vecchio. La 16ª aveva letto una finestra che finiva lì e l'aveva presa per la fine del traffico |

⚠️ **Le prime tre avevano un tratto comune**: erano tutte prove che *davano ragione*. Una verifica
che conferma non va guardata meno di una che smentisce — va guardata **di più**, perché è quella che
nessuno ricontrolla. ⇒ Il rimedio non è diffidare: è chiedere alla prova **di cosa sarebbe capace
se il fatto fosse falso**.

🎯 **La quarta insegna il pezzo mancante, ed è più scomodo: anche la prova che ti dà TORTO va
ricontrollata.** La 16ª sessione ha fatto la cosa difficile — ha rifiutato un risultato che la
assolveva — e si è fermata **un passo prima**, senza chiedersi se il dato su cui poggiava lo
smascheramento fosse a sua volta vero. ⇒ Lo scetticismo applicato una volta sola non è scetticismo:
è **un cambio di conclusione**. La domanda non è «questa prova mi conviene?», è sempre e solo
«questa sonda, in questa finestra, con questo campo, cosa sa vedere?».

🎯 **E il censimento ha trovato il lavoro, non solo la mappa.** La voce 39 doveva produrre un
elenco di divergenze. Ha prodotto un **guasto vivo in produzione**: `pmo_parser_errors` con 9
colonne su PROD e 14 su TEST, e l'app che dal 7/08 ne scriveva e leggeva cinque che di là non
esistono — **in silenzio**. È la terza volta in tre giorni che a trovare la causa è **misurare il
contesto**, non eseguire il compito scritto.

## 📌 Le decisioni prese dal committente oggi

| | |
|---|---|
| ⬆️ **quattro voci promosse** | 37, 38, 39 dalle note «nate misurando», e la **23** dalla coda. La lista urgenti era **vuota** e nessuna si promuove da sé |
| 🔓 **quattro autorizzazioni distinte** | famiglia feedback su PROD, le 5 colonne di `pmo_parser_errors`, le tre policy decorative su TEST, e il disarmo WhatsApp — una per ripresa, mai una delega in bianco |
| ✋ **due «no» impliciti, rispettati** | le due policy **portanti** su PROD non sono state toccate, e il **TRUNCATE** ad `anon` neppure: erano fuori da ciò che aveva autorizzato |
| 🔀 **due merge in squash, su sua richiesta** | #698 e #699 |

**E nella 17ª, la sera dello stesso giorno:**

| | |
|---|---|
| 🔓 **famiglia feedback tolta anche su TEST** | la divergenza che la 16ª si era auto-denunciata e aveva lasciato scritta come «la prima cosa da chiedere alla prossima ripresa». Chiesta, autorizzata, fatta |
| 📚 **sanare `docs/` e correggere la voce 38** | non solo riallineare i rami: riscrivere la misura dei 404 con quella vera, invece di portare su `main` un fatto falso |
| ✋ **voce 23: prima diagnosi sì, patch no** | la correzione tocca la strada che prenota **davvero** e dal cloud non è verificabile ⇒ si scrive cosa non va, non si tocca |
| 🔁 **poi «fai la 23»** | ripresa la decisione: scritta e pubblicata **su TEST** (6.232). La diagnosi precedente è rimasta com'era, non riscritta per farla combaciare |
| ⬆️ **«promuovi a prod»** | la conferma separata che la regola richiede. PROD **6.221 → 6.222**, promozione **a righe** — e non era una formalità: `main` non ha `scheda-di-prova.ts`, quindi copiare il file avrebbe portato in produzione il ramo «prova a vuoto» |
| 📦 **voce 37 chiusa DICHIARANDO, non eseguendo** | messo davanti alle tre strade — dichiarare, fare l'RPC, o la «riga di SQL» — ha scelto la prima. Le due «portanti» restano **per scelta misurata**, con la ragione scritta nella loro riga: chiuderle con la riga di SQL sarebbe stato un passo indietro travestito da chiusura |
| 🔄 **ha ricaricato le due schede, e ha chiuso la 38** | la prova che mancava da due sessioni non era una misura più fine: era **una persona davanti allo schermo**. Due secondi di `Cmd-R` contro quattro sonde false — ed è la terza volta in tre giorni che la verifica che conta la fa lui |

**E nella 19ª, la mattina dopo:**

| | |
|---|---|
| 🔓 **la colonna, non la riga della RPC** | messo davanti alle due strade per la voce 40 ha scelto di **aggiungere la colonna** a PROD invece di togliere `updated_at` dalla funzione: così è la produzione a tornare uguale a ciò che il repo dichiara |
| 📅 **le 1364 righe con la data VERA** | non `now()`, che sarebbe stato il default e avrebbe scritto 1364 date false — la stessa specie di bugia che queste giornate stanno togliendo |
| 🔧 **e i due trigger che mancavano** | terza autorizzazione distinta della sola voce 40, chiesta separatamente perché tocca il **comportamento** e non solo la forma |
| ✋ **un «no» implicito, rispettato** | il terzo trigger — quello che brucia il gettone da dentro il database — non è stato toccato: non era fra le tre cose autorizzate, ed è un cambio di comportamento |
| ⛔ **due voci ANNULLATE** | la **11bis** e la **13**: *«leva e annulla perché non servono più»*. Non chiuse — **annullate**, ed è scritto nelle loro righe: una perché la causa sotto era già stata curata alla radice (quindi era una comodità), l'altra perché 1 volta su 24 non giustifica il lavoro. Di tutt'e due resta scritto **il perché**, o fra un mese tornano |
| ⬆️ **sei voci promosse a urgenti** | 31, 29, 28, 34, 26 e 14bis, col criterio dichiarato da lui: *«così le chiudiamo velocemente»*. ⇒ La coda passa da **14 a 6**, le urgenti da 0 a **6** |
| ⚠️ **due avvertenze date, non taciute per compiacenza** | la **34 chiude la 26** ⇒ vanno fatte in quell'ordine, e **né la 34 né la 14bis si fanno dal cloud** (VM la prima, repo privato del bot la seconda). Sono nella testa della sezione urgenti, dove le legge chi parte |
| ⬆️ **e subito dopo: «aggiungi in coda la parte B»** | promossa da nota a **voce 41**, in sezione C. ⇒ Chiusa la voce e messo il residuo dove si vede: la coda passa da 13 a **14** |
| 📦 **«chiudila, ventitré resta solo la parte B»** | la **23** chiusa da lui a residuo dichiarato, non a residuo finito: quello che resta è **una prova da fare dal Mac**, non codice da scrivere. ⇒ La lista urgenti torna **vuota**, e la parte B scende fra le «nate misurando» — dove le promozioni le decide lui |

**E nella 22ª, a sera:**

| | |
|---|---|
| 🔓 **«fai la correzione» ×2** | le due segnalate a fine collaudo — l'auto-preparazione del container e la nota invecchiata — autorizzate **una per una**, come sempre, non in blocco |
| 🔎 **«verifica se su prod il readonly vede le prenotazioni»** | la domanda che ha smascherato la spiegazione falsa del registro. 🚨 **Non l'avrei aperta da solo**: l'avevo lasciata come «non verificato, fuori dal chiesto» — ed è la quinta volta in tre giorni che la correzione che conta la porta lui |
| 🔀 **«riallinea test-preview e poi fai merge su main»** | l'ordine del punto 4bis chiesto **per nome, una volta**; le altre volte la procedura l'ho applicata io, seguendo la regola già scritta — e la distinzione sta qui perché questa tabella raccoglie **le sue** decisioni, non le mie iniziative prese sotto la sua regola. ⚖️ Quando la rossa transitoria è caduta, è caduta su `test-preview`, che è ciò che il 4bis promette; quante volte sia caduta **non è scritto**, per la ragione spiegata in fondo |
| 🔁 **«rilancia il collaudo per confermare che tutto regge»** | ⚖️ **ed è questa richiesta ad aver prodotto il risultato migliore della sessione**: rilanciando da container freddo si è visto che su PROD la guardia delle scritture **non aveva scattato**, e da lì il sabotaggio deliberato. Un «ricontrolla» che ha trovato ciò che il collaudo normale non poteva trovare |
| 👁️ **«rileggi la fotografia e dimmi se regge»** | 🚨 **e non reggeva.** Chiuso il registro, l'avevo riletta **cercando conferma** — e la conferma l'avevo trovata. Riletta cercando dove cedeva: due enumerazioni di esiti CI, una delle quali già falsa e scritta due righe sopra a «il conteggio non si scrive qui», l'altra mai toccata; più una riga che gonfiava **le sue** decisioni con le mie iniziative. ⚖️ La lezione della giornata applicata a chi l'aveva scritta: *una rilettura che concorda con ciò che si è appena scritto non ha riletto niente* |
| ⬆️ **«metti la regola in `CLAUDE.md`»** | la promozione che avevo **proposto e non eseguito**, come vuole la regola sulle promozioni. Ora è istruzione di progetto: **nei documenti si scrivono i fatti stabili, non le misure che il documento stesso muove**, con la prova da farsi prima di scrivere un numero e il perché non ci si mette una guardia sopra |

**E nella 20ª, lo stesso pomeriggio:**

| | |
|---|---|
| 🔓 **«fai la due»** | curata la **mezza promozione** della voce 31: PROD chiamava due agganci di prova che in `index.html` non esistevano (PROD **6.227**) |
| ⚖️ **«sulla 29 decidi tu»** | delega esplicita, e la voce è stata **chiusa dichiarando**: il canale email ritirato è murato in **tre punti indipendenti** e su PROD ha **0 invocazioni in 24 ore**. Asportarlo non sarebbe una potatura per nome — quei porti Gmail li usa `staff_invite`, che è vivo |
| 🗣️ **la correzione sulla sezione Autovalutazione** | *«l'abbiamo rimossa… è rimasta una microsezione nella scheda socio»*. Ha cambiato il lavoro: i «12 vicoli ciechi» sono diventati **uno**, ed era l'unico che faceva danno (PROD **6.228**) |
| 🔓 **«Togli» e «puoi eliminarlo»** | via il requisito dell'email dal bottone e via la conferma email al socio: due residui del canale morto (PROD **6.229**) |
| ⬆️ **«promuovi le tre versioni su test»** | 6.228 e 6.229 portate **a rovescio del solito**, da `main` a `test-preview` (TEST **6.238**) — se no si ricreava la voce 31 al contrario il giorno stesso in cui la si censiva |
| ⬆️ **«vai con la 31»** | la rete di regressione di PROD passa da **55 a 87 casi** (PROD **6.230**) |
| ⬆️ **«promuovi livello-dimostrato»** | la porta del livello **in prestito** chiusa anche sul **ponte del bot**, con la premessa rimisurata sui dati vivi: `ereditato` = **0** su PROD |
| ✅ **«sistema manifest e VERSIONI su test»** | `VERSIONI.md` allineato (era un sottoinsieme stretto). **`manifest.json` no**, e non per pigrizia: su TEST **risponde 404** — il caricatore è un repo a parte e il link è assoluto ⇒ quel file lì **non lo serve nessuno** |
| 🤝 **una seconda sessione in parallelo** | ha unito la **#727** e la **#728** (console remota) mentre lavoravo. Nessuna sovrapposizione — me ne sono accorto perché il conteggio delle chiuse è passato da 23 a 24 **senza che lo toccassi** |

| | |
|---|---|
| 🔴 **Urgenti** | **4** |
| 📋 **In coda** | **4** |
| 📦 **Chiuse** | **33** il 13–16/08 + ~56 dal 7/08 + ~41 fino al 6/08 |

**Stato del sistema, rimisurato alla chiusura della 24ª (16/08)** — versioni lette dall'`index.html`
dei due rami, non ricordate: app PROD **6.232** · TEST **6.241** · i **4
percorsi** di `guard-worker-sync` **identici** fra i rami · **PR aperte 0**, ricontate a fine
sessione · tutte le guardie **verdi su entrambi i rami**.
📌 Gli **sha non sono scritti qui di proposito**, ed è la stessa ragione per cui `guard-docs-truth`
non li controlla: un file che cita il proprio sha è vecchio nell'istante in cui lo si salva — questo
commit stesso lo cambierebbe. Si rileggono con `git rev-parse origin/main origin/test-preview`.
📏 **La rete di regressione: PROD 94 casi, TEST 97** — cresciuta di **4 su entrambi** nella 24ª: due
sulla pulizia-orfani (voce 42) e due sul link d'ingresso al bot. La differenza fra i due resta
**solo** i 3 della simulazione incassi, che in produzione non hanno senso. Erano 90 e 93 a fine 23ª,
55 e 90 a inizio giornata del 15/08.
🚨 **E i 4 nuovi sono passati per il sabotaggio, non per il verde**: tre dei quattro erano **inerti
alla prima stesura** — verdi anche col difetto acceso. Le cause, misurate: ① la push vinceva sempre
la corsa sulla rilettura ⇒ `CLOUD_WRITE_DELAY_MS`; ② un controllo negativo letto **subito**, cioè
prima che la frase avesse tempo di comparire; ③ l'app **svuota la chat** dopo un'operazione
confermata, e quel timer scatta mentre gira il caso dopo ⇒ la frase veniva detta **e cancellata
prima di essere guardata**, con lo stesso caso ROSSO da solo e VERDE dietro al vicino.
⚖️ La ③ è la lezione della giornata, e non è «i test vanno isolati»: è che **un caso può avere due
verdetti opposti sullo stesso codice**, decisi da un timer di qualcun altro — e il verde arriva
esattamente quando l'evidenza è stata cancellata. ⇒ Non si rilegge il registro **dopo**: si registra
**mentre** (`osservaChat`), perché ciò che è stato detto resti detto.
📌 **Fughe dal banco: 0** su entrambi i rami (erano 2 su `main`). Non uscivano davvero — il banco le
bloccava — ma erano il segno che il **ponte del bot non era modellato**, e quindi che della proposta
del link si provava solo il ramo del guasto.

✅ **PROD verificata DAL SERVER, non dall'etichetta.** Alla 22ª, servita e **caricata** in un browser
vero: `app.padelvillage.club` risponde col titolo **v6.231**, che è il numero dichiarato qui sopra —
non letto da `index.html` di un ramo, ma dalla pagina che gira. *(La riga che segue è la misura della
20ª e resta agli atti: allora era la **6.230**.)* `app.padelvillage.club/index.html`
→ `APP_VERSION = '6.230'`, e dentro i **5 agganci** promossi con la 6.230 — e **zero** dei due della
simulazione, che in produzione non devono esistere. Verificate anche le potature: il messaggio nuovo
del bottone è nel codice, quello vecchio sopravvive **solo dentro un commento** (controllato riga per
riga, non a conteggio — è la trappola in cui sono caduto tre volte oggi).
✅ **E il ponte del bot è VIVO, non solo deployato**: `consumer-player-readmodel` passa a **versione
22** su `qqbf…`, e interrogato senza credenziali risponde **401 col suo JSON** — identico al gemello
su `cudi…`. Una funzione che non parte non risponde nemmeno con un errore suo.
✅ **`manifest.json` misurato dai due domini**: PROD **200 `application/json`**, TEST **404
`text/html`**. È la prova che quel file su `test-preview` non lo serve nessuno.

🔁 **La finestra del 4bis cade rossa a volte sì e a volte no, a parità di procedura.**
⚖️ **Quante volte NON si scrive qui**, ed è la stessa ragione per cui sopra non ci sono gli sha: *la
spinta che aggiorna questa riga è essa stessa un giro*, quindi qualunque conteggio è vecchio
nell'istante in cui lo si salva. 📏 Non è teoria, ed è successo **due volte di fila**: la prima
stesura diceva «rossa **una volta su due**» e il giro che l'ha portata sul ramo l'ha resa falsa
mentre atterrava; la correzione ha tolto quel numero e **ne ha scritto un altro** — «tre giri, rossa
verde rossa» — che il giro successivo ha smentito entro un minuto. 🚨 **Curare l'istanza invece della
classe non è una cura**: finché una frase enumera esiti CI, il commit che la trasporta è uno di
quegli esiti. È la malattia dei documenti curata il 13/08, nel suo caso più piccolo — un file che,
per esistere, smentisce sé stesso.
⇒ Resta scritto solo il fatto **stabile**: non è una regola, è una **corsa**, e il colore lo decide
se il riallineo atterra prima che il guard legga i ref. Spingendo prima TEST, quando cade, cade
**là** — che è tutto ciò che il 4bis promette. I rossi vecchi si rilanciano a mano per non lasciarli
in bacheca.
⚠️ **Una cosa che il 4bis NON sa spostare**, misurata oggi: `guard-docs-truth` legge la tabella
**sempre da `origin/main`** (`git show "origin/main:$DOC"`), qualunque ramo la faccia partire ⇒ quando
è **TEST** a cambiare versione, la finestra è rossa su **entrambi** i rami e si può solo tenerla corta.
Il 4bis indirizza `guard-worker-sync`, non questa.

⛔ **Non misurato da qui, e da non dare per buono** — la sessione girava dal cloud: **VM Hetzner**,
**worker** e i suoi log, **`.env` del bot**, **secret**, **cron**, **memoria dell'app**, e soprattutto
**la vista dell'app col login staff**. 🔭 **Ma quest'ultima è uscita dall'elenco alla 22ª**, ed è la
novità della giornata: la console remota apre l'app **col login staff** su TEST e su PROD, da un
container appena nato, e ci esegue dentro quello che serve. Il 13/08 due errori veri erano passati
sotto sintassi verde e rete verde e li aveva trovati lui aprendo l'app: quel giro ora si può fare
da qui. ⚠️ **Non per intero, e la differenza va tenuta a mente**: l'utente è un `readonly` con
**2 permessi su 16**, e la pagina parte con `localStorage` **vuoto** — quindi si vede *un'* app col
login staff, non **la sua**. I sintomi che nascono dallo stato accumulato in ore d'uso restano fuori
portata senza un export fatto sul posto.
✅ Rimisurati invece: le due versioni, gli sha, le PR aperte, i 4 percorsi sorvegliati, i conteggi di
questo file, il ponte del bot dal vivo, e i dati di PROD dietro `livello-dimostrato` (2797 soci vivi,
533 con livello vero, 517 a origine vuota, `ereditato` = **0**).

🔭 **Nella 24ª l'elenco si è accorciato di due voci, e non per una sonda nuova.**
① **Il repo del bot** era dato per «fuori dal perimetro» dalla scheda della 14bis: **non lo era** —
agganciato su sua autorizzazione, il codice del bot si legge da qui. ⚠️ Resta vero che **non lo si può
provare dal vivo**: gira in pm2 sulla VM, e da qui si dice *cosa fa il codice*, non *l'ho visto
succedere*.
② **La VM** è entrata in portata **per interposta persona**, non per accesso: la voce 41 è stata
eseguita **dalle sue mani** con questa sessione a leggere il database in diretta. ⇒ È una modalità
nuova e vale la pena nominarla — **lui le mani, la sessione gli occhi** — perché ha chiuso una voce
che da sola nessuna delle due parti poteva chiudere.
⛔ **Restano fuori portata, e vanno dichiarati**: `ssh` alla VM (non installato, `~/.ssh` vuota,
porta 22 muta — **rimisurato tre volte** in questa sessione, non ricordato), i **log del worker**,
il **`.env` del bot** e i suoi interruttori, i **secret**, la **memoria dell'app**, e la vista
dell'app **col login staff pieno** — la console remota arriva a un `readonly` con 2 permessi su 16 e
`localStorage` vuoto.
🚨 **E una gamba dichiarata mancante su una voce chiusa**: della **34** non si sono potute guardare le
letture in più nei log del worker. È scritto nella sua riga fra le chiuse, non taciuto.

**Alla chiusura della 18ª, poche ore prima** — tenuto perché la lezione è di quel giro:
🚨 **`guard-docs-truth` è andata rossa DUE volte**, e la prima l'ha vista lui, non io: bumpavo
la versione e non toccavo `stato-progetto-corrente.md`. ⇒ Regola imparata: **un deploy non è finito
quando il merge riesce, è finito quando le guardie sono verdi** — e le due che contano scattano sul
**push**, quindi non compaiono fra i check della PR. La seconda volta il rosso l'ho visto **prima**
di promuovere, e il registro è entrato **dentro** la promozione invece che dopo.

🚨 **C'ERA UNA PR APERTA, ED ERA UNA TRAPPOLA: la #700 — ora CHIUSA su sua decisione.** Non erano
zero, come le sessioni precedenti davano per scontato. Era la chiusura della **16ª sessione**,
rimasta indietro con base `481e2a0`, e il suo contenuto era **interamente superato**: quelle stesse
righe erano arrivate su `main` con la #701, e dopo di essa `main` era andato avanti di quattro
merge. ⛔ Unirla avrebbe rimesso **229 righe** che `main` non ha più, cancellando la chiusura della
**37**, quella della **38** e tutta la voce **23**. Chiusa con la ragione scritta nel suo thread; il
ramo lo pota `cleanup-claude-branches.yml` stanotte. ⇒ **PR aperte ora: 0**, ricontate dopo.
📌 Saltata fuori solo perché «PR aperte» è un numero che si **rimisura** invece di ricopiarlo: la
riga della sessione precedente diceva «0 PR aperte» e oggi sarebbe stata falsa.

✅ **PROD verificata DAL SERVER, non dall'etichetta**: `pg_net` su `app.padelvillage.club/index.html`
→ **200**, `APP_VERSION = '6.222'`, e dentro i tre marcatori della voce 23 (`data.status ===
'unknown'`, il conteggio `incerte`, `pmoEsitoIgnoto`). ⚠️ Alla prima lettura serviva ancora la
**6.221** — Pages non aveva finito — ed è la ragione per cui la si guarda **due volte**: un «non
ancora» scambiato per un «no» è lo stesso errore della voce 38, dalla parte opposta.
🧯 E una sonda mal formulata mi ha acceso una spia falsa: cercavo `PMO_IS_TEST_ENV` fra ciò che era
finito in PROD e l'ho trovato. Misurato: **71 occorrenze prima, 71 dopo, 0 righe aggiunte da me** —
è il **meccanismo** che riconosce l'ambiente, che in PROD deve esserci e vale `false`. La regola
vieta il codice **gated** da quel flag, non il flag: la mia sonda chiedeva la cosa sbagliata.

🚨 **E `docs/` NON era allineato: la 17ª è partita con la guardia rossa.** La 16ª sessione ha spinto
la propria chiusura su `test-preview` (`70b48ac`, 19:18) e **non l'ha portata su `main`**:
`guard-worker-sync` è fallita lì alle 19:18 e nessuno l'ha ri-lanciata, mentre `main` — il ramo
predefinito, quello che deve sembrare affidabile a colpo d'occhio — continuava a dichiarare la
fotografia della **15ª**. Non era la finestra transitoria dei 90 secondi del punto ⑥: erano venti
minuti, cioè drift vero.
⚖️ È la regola 4bis presa a metà — *prima `test-preview`, POI il merge su `main`* — dove si fa la
prima metà e si considera finito. La cura non è una guardia in più: è che **una sessione non è
chiusa finché i due rami non dicono la stessa cosa**, e la chiusura scritta su un ramo solo è
esattamente il documento che mente di cui parla la voce 30.

⭐ **PROD è stato verificato dal SERVER, non dall'etichetta**: `pg_net` ha scaricato
`app.padelvillage.club/index.html` → **200**, `APP_VERSION = '6.221'`, e il blocco del disarmo
**presente nel file servito**. È la stessa strada che ha provato l'edge il 14/08: da una sessione
cloud il browser non arriva a `*.supabase.co` né al dominio, ma **il database sì**.

🖐️ **La 16ª sessione ha scritto su PERMESSI, SCHEMA e APP.**
① **PROD**: 3 policy anonime tolte (famiglia feedback), **5 colonne aggiunte** a
`pmo_parser_errors`, app **6.220 → 6.221**.
② **TEST**: 3 policy decorative tolte, app **6.230 → 6.231** con lo **stesso identico blocco** di
PROD — estratto dal file vero, non riscritto.
③ **Dati**: **nessuna riga cancellata, nessuna riga scritta**. Tutte le prove d'attacco e gli
INSERT di verifica stavano in **transazioni annullate**: verificato dopo, 0 residui.
↩️ Tutte e tre le migrazioni reversibili, con l'SQL di ripristino **verbatim** in testa.

**Verificato sul bersaglio il 14/08, 16ª sessione:**
- ✅ **prova d'attacco come `anon`, prima e dopo**, su ogni policy toccata — col **seme** che
  soddisfa la chiave esterna, altrimenti a fermare l'attacco sarebbe il vincolo e non l'RLS
- ✅ **la strada legittima regge**: la RPC pubblica del feedback risponde `{"ok": true}` e scrive
- ✅ **end-to-end via PostgREST** su `pmo_parser_errors`: **400 `42703` → 200 `[]`**, stessa URL e
  stessa chiave dell'app
- ✅ **l'impronta delle colonne** di PROD ora **identica** a quella censita per TEST *prima*
- ✅ **linter diffato voce per voce** a ogni passo, su entrambi i progetti, con la **previsione
  dichiarata prima**: giusta due volte su tre (la terza sbagliata **di due**, in meglio)
- ✅ **rete di regressione**: 13/13 Node, **55/55** su `main` e **90/90** su `test-preview`, prima
  e dopo
- ✅ i **quattro percorsi** di `guard-worker-sync` fra i rami, dopo ogni merge

> ⚠️ **Ancora non misurati**, e da non dare per buoni: la VM (worker e i due bot, riavvii), il
> `.env` del bot e i suoi interruttori, i ponti, i secret Supabase, i cron di entrambi i progetti
> e la **memoria dell'app**. Dalla sessione cloud manca l'accesso a Hetzner.
> ⚠️ **L'app col login STAFF resta non vista, per la seconda sessione di fila.** Ed è la mancanza
> che pesa di più oggi, perché il disarmo WhatsApp **cambia ciò che lo staff vede** e nessuno l'ha
> guardato. 📌 `pg_net` resta la porta di servizio per provare il **server**; lo **schermo** no.

---

## 🔴 URGENTI — 4

**Promosse dal committente il 15/08/2026, a fine 19ª sessione**, con la lista appena tornata vuota
e nello stesso respiro in cui ne ha **annullate due**: *«leva e annulla perché non servono più la
11bis e la 13; promuovi in urgenti, così le chiudiamo velocemente, la 31, la 29, la 28, la 34, la
26 e la 14bis»*. ⇒ La coda passa da **14 a 6**: sei salite qui, due chiuse come annullate.

⚖️ **Il criterio è suo ed è dichiarato: «così le chiudiamo velocemente».** Sono voci mature — quattro
hanno già la causa trovata e aspettano una decisione, non un'indagine. 🚨 Ma tre cose vanno dette
**prima** di partire, e sono misurate, non impressioni:

| | |
|---|---|
| 🔗 **la 34 CHIUDE la 26** | non sono due lavori: la 26 è il **sintomo atteso** di un TEST col calendario congelato, e sparisce da sé il giorno in cui il sync riparte. ⇒ **Prima la 34.** Chiuderle nell'ordine inverso vorrebbe dire dichiarare risolto un sintomo la cui causa è ancora lì |
| ⛔ **la 34 non si fa dal cloud** | serve la VM: accendere quel dispatcher resuscita anche i **6 sync clienti** ritirati il 3/08, e la prima giornata va guardata nei log del worker su **Hetzner**. È la più lenta delle sei, non la più veloce |
| ⛔ **la 14bis nemmeno** | è una domanda sul **bot**, che vive nel repo privato `assistente-padel-agent` — fuori dal perimetro di questa sessione. Da qui si può misurare solo la metà del gestionale |

📌 Le altre quattro — **31**, **29**, **28**, **26** — erano decisioni o potature, e quelle sì si
preparano da qui.

🔄 **Aggiornamento del 15/08, 20ª sessione.** La **31** è **CHIUSA** — censita, e curati i tre reperti che contavano, a partire dalla mezza promozione (PROD **6.227**); la **29** è **chiusa dichiarando**, su sua delega esplicita; la **28** è stata misurata fino in fondo e poi **chiusa il 15/08**, potata e promossa a PROD. ⇒ Delle sei promosse ne restano **tre**: **34** e **14bis** vogliono la VM e il repo privato del bot, la **26** aspetta la 34.

⬆️ **E il 15/08 sera lui ne ha promossa una quarta: la 41**, dalla sezione C — *«promuovi la quarantuno tra le urgenti»*. ⇒ Coda da **7 a 6**, urgenti da 3 a **4**. 📌 Nasce da una domanda sua sul perché fosse ancora in coda: gli avevo proposto di prepararla per il Mac invece di chiuderla, e lui l'ha spostata di sopra — che è la terza strada, quella che non avevo messo fra le opzioni.

🚨 **E ora TUTTE E QUATTRO le urgenti sono fuori dalla portata di una sessione cloud**: la 41 vuole SSH sulla VM, il login staff e una prenotazione vera sul Matchpoint; la 34 la VM; la 14bis il repo privato del bot; la 26 aspetta la 34. ⚖️ **La lista non è corta perché è quasi finita: è corta perché il resto è altrove** — e da stasera è vero per intero, non quasi. La prossima sessione utile su queste è **dal Mac**.


⬆️ **Promosse dal committente il 16/08/2026**, la mattina dopo che la lista era tornata **vuota**:
*«porta in urgenti quarantadue, quattordici e quarantatré»*. ⇒ È **tutta la sezione C** — le tre voci
«sapute e non risolte» — che sale in blocco, e la C resta in piedi vuota.

⚖️ **Hanno un filo in comune, e conviene saperlo prima di partire**: la **42** e la **43** sono le due
metà della stessa malattia — la 42 le *letture* che arrivano presto (misurata **pulita**), la 43 le
*scritture staccate* che atterrano tardi (**non** ancora indagata). La **14** è di un'altra natura:
non è un guasto, è **una decisione tua** — se togliere il nome dalla chiave dell'occupazione.
📌 Tutt'e tre si lavorano **da qui**: nessuna vuole la VM né il repo del bot.

🔄 **Aggiornamento del 16/08, 25ª sessione.** La **43** è stata **misurata** — la risposta sta nella
sua scheda qui sotto — e su sua decisione resta **aperta a diagnosi fatta**: la cura tocca la strada
che annulla *per davvero* su Matchpoint, e da una sessione cloud quella strada non si prova.
📦 La **42** è **CHIUSA**, a domanda risposta: il suo censimento era già stato fatto e non ha trovato
niente, e ciò che ne era uscito è la 43, che vive per conto suo.
📦 E la **14** è **CHIUSA dichiarando**, su sua decisione presa coi numeri di oggi davanti: la chiave
resta com'è, perché il costo è contabile e la cura toccherebbe sync, app e ponti insieme. La **sonda
non muore con la voce** — sta in `docs/voce-14-sonda-chiavi-ospite.md` con la serie di quindici
settimane, ed è lei a dire quando riaprirla.
⇒ **Urgenti da 3 a 1.** Resta la sola **43**, e non è «esegui»: è **una decisione tua** — quale delle
due cure dare alla finestra scoperta dell'annullo, sapendo che si prova solo dal Mac.

### 44. 🚨 La porta di servizio dell'autovalutazione: `get_self_assessments_by_tokens` legge NOME e TELEFONO ad `anon`
*Promossa dal committente il 16/08/2026, 25ª sessione, da «nate misurando» della 15ª — dove stava
come nota di due righe.* 🔬 **Misurata sul bersaglio prima di scriverla, e la nota diceva molto meno
di quello che c'è.**

🎯 **Il fatto, provato eseguendo — non dedotto dai grant.** La funzione è `SECURITY DEFINER`, di
proprietà di `postgres`, con `EXECUTE` a **`anon`, `authenticated` e PUBLIC** (`=X/postgres`).
Eseguita **come `anon`** dentro una transazione annullata, restituisce per ogni token passato:
`first_name`, `last_name`, **`phone`**, i livelli dichiarato e calcolato e l'intero `raw_response`.

✅ **Controllo negativo fatto, e cade bene**: la lettura **diretta** di `self_assessments` come `anon`
vede **0 righe** — la tabella ha RLS attivo e **zero policy**. ⇒ La porta chiusa il 12/08 è chiusa
davvero, e **questa RPC è l'unica finestra rimasta aperta accanto**. Non è una porta fra tante: è
*la* strada.

🚨 **E su PROD esiste un token INDOVINABILE.** Fra i 1364 token, 989 sono da 14 caratteri e 369 sono
`GM-<uuid>` — non forzabili. Ma **cinque no**: `TEST123`, `TEST456`, `TEST789` e **`MAURIZIO001`**.
Quattro non hanno una riga in `self_assessments`; **`MAURIZIO001` sì**, ed è **un socio vero, con
nome, cognome e numero di telefono**, del 25/04. ⇒ Chiunque, dalla rete, con la sola chiave
pubblicabile e indovinando quella parola, si porta via il recapito di una persona reale.

⚖️ **La misura di quanto è grande**: la riga raggiungibile per tentativi è **una**. Non è una fuga di
massa — è una fessura stretta, ma su **dati personali veri** e in **produzione**.
📌 **Stessa forma su TEST** (`cudi…`): identica `SECURITY DEFINER`, stessi grant, RLS attivo, **0
policy**, **7 righe**. Il contratto vive sui due lati e va cambiato insieme.
📏 **E non è sola**: le `SECURITY DEFINER` eseguibili da `anon` su PROD, ricontate oggi, sono **34**
(la nota della 15ª ne diceva 47 — il numero si è mosso, quindi si riconta e non si ricopia). Questa è
**una** di quelle 34, ed è l'unica che qualcuno abbia letto riga per riga. ⚠️ **Le altre 33 restano
non guardate**: questa voce non le copre, e dirlo fa parte della misura.

---

✅ **CURATA il 16/08, su sua autorizzazione: `REVOKE EXECUTE … FROM anon, PUBLIC` sui DUE progetti.**
Il grant ad `authenticated` **resta**: sparisce l'accesso *senza credenziali*, non quello dello staff.

🔬 **Provata prima e dopo, e su TEST prima che su PROD** — non dichiarata:

| | `anon` prima | `anon` dopo | `authenticated` dopo |
|---|---|---|---|
| **TEST** (`cudi…`) | **3 righe** | **42501** `permission denied for function` | **3 righe** |
| **PROD** (`qqbf…`) | **1 riga** — nome, cognome, telefono di `MAURIZIO001` | **42501** | **1 riga** |

✅ **La controprova positiva è stata fatta apposta**, perché senza di essa «blocca tutto» si legge
come «funziona»: la strada legittima **passa ancora**, di qua e di là.
✅ **E una conferma indipendente, che non veniva dalla stessa sonda**: le `SECURITY DEFINER`
eseguibili da `anon` su PROD sono passate da **34 a 33**. Si è chiusa **una** porta, ed è quella.
↩️ Migrazione **reversibile**, con l'SQL di ripristino **verbatim** in testa (le due `GRANT`), su
entrambi i progetti. Nessuna riga di dati toccata: tutte le prove d'attacco in transazioni annullate.

⚠️ **Residuo dichiarato, e NON è stato fatto**: il gettone `MAURIZIO001` — e i quattro `TEST*` senza
riga — **esistono ancora**. Oggi non aprono più niente senza credenziali, quindi non sono un buco;
restano un **gettone debole**. ⛔ Non l'ho toccato di proposito: dietro c'è **il dato di una persona
reale**, e prima di cancellare va misurato **cosa ci punta** — che è una decisione sua, non
manutenzione.
⚠️ **E ciò che questa voce NON copre**: le **altre 33** `SECURITY DEFINER` aperte ad `anon`. Questa è
l'unica letta riga per riga. Le altre non sono state guardate, ed è scritto perché nessuno legga
«famiglia bonificata».

### 45. 🕳️ `fetchAssessmentRawResponsesByTokens`: una lettura che non può riuscire — dentro una stanza già chiusa
*Promossa dal committente il 16/08/2026, 25ª sessione, da «nate misurando» della 15ª.*

🔎 **Il fatto, confermato**: è una `GET` a `/rest/v1/self_assessments` con la **chiave pubblicabile**,
su una tabella con RLS attivo e **zero policy** ⇒ risponde **200 con lista vuota, sempre**, e il
chiamante ha un `catch` che tace. Una lettura che non può riuscire e non lo dice a nessuno.

🚨 **Due cose della nota NON tornano, e sono scritte qui invece che corrette di nascosto:**

| la nota diceva | la misura |
|---|---|
| «riga **29939**» | la funzione è alla **29214**, la `fetch` alla **29223** |
| «ci sono solo le **3 di INSERT**» | le policy sono **ZERO** ⇒ su quella tabella, oggi, `anon` non può nemmeno **scrivere** |

⚖️ **E il contesto che la nota non poteva avere cambia il valore del lavoro**: `self_assessments` ha
**42 righe, l'ultima del 23/06, zero negli ultimi 30 giorni** — perché la sezione Autovalutazione è
**congelata dal 13/06** (`PMO_ASSESSMENT_PARKED = true`, nascosta a tutti). ⇒ È **un vicolo cieco
dentro una stanza in cui non entra nessuno**: esattamente la forma che la 20ª aveva già incontrato,
quando un fix rifiniva una stanza chiusa. Il lavoro qui non è ripararla: è **decidere se togliere il
codice morto**, e la domanda vera resta quella di allora — *a cosa serviva*.

### 46. 🔁 `livello.autovalutazione_url`: rimasta su TEST e non su PROD — la voce 31 al rovescio
*Promossa dal committente il 16/08/2026, 25ª sessione, da «nate misurando» della 14ª.*

🔬 **Confermata sul bersaglio, e vive nel database e non nel codice** (`pmo_ai_settings`, chiave
`assistant_kb`): su **TEST** il valore **cita** `autovalutazione_url`, su **PROD** no. Le due copie
sono state toccate **lo stesso giorno a un minuto di distanza** — PROD 14/08 11:56, TEST 14/08 11:55
— e differiscono di **80 caratteri** (6249 contro 6169), quanto una voce in più.

⚖️ **Perché conta pur non facendo danno**: nessuno la legge (nel codice non c'è nemmeno più il nome),
quindi non rompe niente — **ma sta nella kb che va in pasto al modello**, e punta a una pagina di una
sezione congelata. Su PROD fu tolta il 9/08, ed è quel gesto ad aver prodotto
`pmo_bkp_kb_livello_20260809`; su TEST **no**.
📌 **È la voce 31 al rovescio**: là il pezzo mancava su PROD, qui avanza su TEST. È il lavoro più
piccolo dei tre — una `update` su un solo progetto — ma tocca ciò che il modello legge, quindi è
**una scrittura su TEST**, non una pulizia di forma.

### 43. ⏱️ La continuazione staccata che riscrive lo stato locale — `staffCalRefreshFromCloud`
*Aperta dal committente il 15/08, 24ª sessione, chiudendo la 42.* ⚖️ **Non è il residuo della 42**:
quella chiedeva delle **letture** che arrivano presto ed è misurata pulita. Questa è l'altra metà
della stessa malattia — una **coda staccata che SCRIVE**, che è la forma con cui il difetto si era
manifestato davvero nel banco (il caso 11 che finiva addosso al caso 12).

🔎 **Il fatto, misurato su `main` (PROD 6.232), righe di commento escluse.**
`staffCalRefreshFromCloud` ha **12 punti di chiamata** più la definizione: **8 non attese**, 3 attese,
1 restituita (l'aggancio esportato `refreshFromCloud`). La funzione fa **commit locali dopo un
`await`** — `applyMatchpointMembersToLocal` subito dopo la lettura dei soci dal cloud, e la
riconciliazione delle schede socio subito dopo. ⇒ Chi la lancia senza attenderla va avanti, e la
scrittura locale atterra **dopo**, su uno stato che nel frattempo può essere cambiato.

🚨 **E il debounce NON è la rete di sicurezza che sembra.** C'è un freno di 60 s, ma lo salta chi passa
`force: true` — e a passarlo sono **5 delle 8 chiamate non attese**. Il freno copre le altre 3.
📌 Misurato dopo aver scritto il contrario: nella prima stesura della chiusura della 42 avevo detto
«attenuata da un debounce», che è vero solo per meno della metà dei casi. È il tipo di frase che
suona prudente e non lo è.

⚠️ **Cosa NON è stato fatto, e va detto**: non è dimostrato che una di queste 8 produca oggi un danno
visibile. Quello che è dimostrato è che **la forma c'è** ed è quella che nel banco ha fatto cadere un
caso sull'altro appena è sparito il ritardo di `config.js`. ⇒ Il lavoro è **stabilire quali delle 8
possono atterrare su una modifica locale non ancora spinta**, non «riscrivere tutto con `await`»:
metterlo dappertutto rimetterebbe in circolo la lentezza che la 6.231 ha tolto, e su mobile quella
lettura costava ~20 s.

🧪 **Il banco adesso sa provarlo**, ed è la novità che rende la voce aggredibile: con
`CLOUD_WRITE_DELAY_MS` (aggiunto il 15/08 coi casi 94 e 95) si può mettere la **lettura davanti alla
scrittura** e vedere cosa succede. Senza quel ritardo qualunque caso su questo tema sarebbe **verde a
vuoto** — è successo, ed è documentato nel banco.

📌 **Il sintomo da riconoscere**, se arriva prima della cura: una modifica che **sparisce dagli altri
dispositivi** senza errore in console. È lo stesso della 42, perché la malattia è la stessa; cambia
solo da che parte la si prende.

---

🔬 **MISURATA il 16/08, 25ª sessione, su `main` (PROD 6.232), righe di commento escluse.**
Prima cosa fatta: **riverificare la scheda sul bersaglio**, perché una scheda è un'ipotesi.
✅ **Torna esatta, numero per numero** — 12 punti di chiamata più la definizione, **8 non attese /
3 attese / 1 restituita**, e **5 delle 8** passano `force`. Non c'è niente da correggere.

**① Quali delle 8 possono atterrare — la risposta che la voce chiedeva**

| # | riga | opzioni | freno 60 s | pre-guardia `_staffCalPendingEdits` | atterra a metà operazione |
|---|---|---|---|---|---|
| 1 | 9011 | `force` | **saltato** | no | **sì** |
| 2 | 10315 | — | frena | no | solo a freno scaduto |
| 3 | 29933 | — | frena | no | solo a freno scaduto (avvio) |
| 4 | 37543 | `silent` | frena | no | solo a freno scaduto |
| 5 | 37566 | `force, silent` | **saltato** | **sì**, alla 37556 | sì, ma non con un pending aperto |
| 6 | 37576 | `force, withMembers` | **saltato** | no | **sì** |
| 7 | 37638 | `force` | **saltato** | no | **sì** |
| 8 | 37678 | `force` | **saltato** | no | **sì** |

⇒ **Quattro su otto** non hanno **nessuna** protezione: né il freno né la pre-guardia. La quinta —
il poll a 4 s — è **l'unica delle dodici** che si chieda se un'operazione è in corso prima di partire.

**② E dentro la funzione la guardia copre UN blocco su TRE**

`_staffCalPendingEdits` compare in `staffCalRefreshFromCloud` **una volta sola**, alla **38143**, e
serve al **solo** merge di `staffBookings` (38144-38151). Gli altri due punti in cui la funzione
scrive lo stato locale dopo un `await` **non la consultano affatto**:

- **38101** — `applyMatchpointMembersToLocal(...)` dopo `await pmoLoadMatchpointMembersFromCloud()`;
- **38204-38207** — e questa **la scheda non la nominava**: `prenotazioni = cloud.bookings` e
  `prenotazioniOccupazione = _occToStore`, **assegnazione secca** da una fotografia del cloud letta
  alla **38118**. Nessun merge, nessuna esclusione delle chiavi appena toccate.

⚖️ È la scrittura **più grossa** delle tre e **la meno difesa**: il merge di `staffBookings` è
progettato per tenere il locale (`_pend`, `keptLocal`); questa sovrascrive e basta.

**③ 🚨 Il reperto che cambia il quadro: la protezione si CHIUDE PRIMA della scrittura**

In `staffCalDoCancel` l'ordine è questo, letto riga per riga:

| riga | cosa succede |
|---|---|
| 43490 | `_staffCalPendingEdits.add(_pendCancelKey)` — la finestra si **apre** |
| 43570 / 43598 | `_staffCalPendingEdits.delete(_pendCancelKey)` — la finestra si **chiude** |
| 43579 / 43585 / 43541 | `_applicaAnnullo()` → `_staffCalCommitLocalCancel(...)` |

⇒ **Tutti e tre** i punti in cui l'annullo tocca lo stato locale stanno **a valle** della `delete`.
Controllato e non dedotto: `_applicaAnnullo` ha **esattamente 3 chiamanti**, e `_verifica` — che
contiene il terzo — è invocata anch'essa dopo. E `_staffCalCommitLocalCancel` fa proprio la coppia
che la voce descrive: **toglie** le righe da `prenotazioniOccupazione` e `prenotazioni`
(43404-43410) e poi **spinge le lapidi senza attenderle** — `pmoSyncCloudRecordsNow(…).catch(…)`
alla **43428**.

🚨 **Quindi la finestra scoperta non la copre nessuno degli otto, nemmeno il numero 5**: quando il
commit locale parte, la chiave che avrebbe fatto rinunciare il poll a 4 s **è già stata tolta**. Fra
la rimozione locale e l'atterraggio della lapide sul cloud, un refresh forzato rilegge la fotografia
**vecchia** e la riassegna alla 38205 — il fantasma rientra in `prenotazioniOccupazione`.

**④ Cosa lo tiene a bada, e cosa no — misurato, non dedotto**

⚠️ **Il calendario NON lo mostra**, e va detto subito perché ridimensiona il danno:
`staffCalGetSlots` filtra gli slot soppressi (**38680-38697**) e quel filtro si applica a `result`,
che contiene **anche** le righe di occupazione (costruite alla 38585) — verificato leggendo la
funzione, non il commento. `_staffCalCommitLocalCancel` aggiunge la soppressione locale alla
**43392**, cioè *prima* della pulizia. Finché dura il TTL il fantasma rientrato resta **invisibile
su questo dispositivo**.
📌 Il commento della v5.897 (43393-43396) dice il contrario — «senza, un refresh ri-renderizzava la
copia» — ed è **il racconto di un passato**, non dell'oggi. L'ho misurato invece di crederci, ed è
la ragione per cui questa voce **non** finisce con «guasto vivo in produzione».

⇒ **Resta scoperto chi NON passa da `staffCalGetSlots`**, e sono misurati:
`uniqueFieldOccupancyBookings` (17200, 23533), l'impronta della 18708, i roster di 40081 / 40237 /
40344 e 43261. Lì il fantasma si vede.
🚩 **E un solo punto lo rimanderebbe sul cloud**: `pmoBuildCloudRecordsFromLocalState` (**27614**)
legge `prenotazioniOccupazione` **diretto**, escludendo i soli `_retained` — e un fantasma rientrato
dal cloud `_retained` non è. ⚖️ **Ma il suo unico chiamante è `pmoUploadLocalDataToCloud` (29032),
che è un bottone d'amministrazione, non una routine**: la resurrezione è **possibile, non
automatica**. Lo scrivo con questa cautela perché la differenza è tutta lì, ed è esattamente il
punto in cui una voce diventa allarmismo.

**⑤ Cosa NON è stato fatto, e perché**

⛔ **Non è stata toccata una riga.** La correzione naturale — spostare la `delete` **dopo**
`_applicaAnnullo`, oppure tenere la chiave finché la spinta non è atterrata — sta sulla strada che
**annulla per davvero** su Matchpoint, e da qui quella strada non si prova. È la stessa ragione per
cui la 23ª ebbe *«prima diagnosi sì, patch no»*. ⇒ **Decisione del committente.**
⛔ **Non è stata messa in scena la corsa nel banco.** `CLOUD_WRITE_DELAY_MS` saprebbe farlo, ma un
caso scritto **oggi** proverebbe **la forma**, non il danno — e il danno, misurato, è schermato dalla
soppressione proprio sul percorso che conta. Scriverlo prima di sapere quale delle due cure si
prende vorrebbe dire costruire la prova sulla cura sbagliata.
⛔ **Non è stata misurata la terza scrittura**, quella dei soci (38101 e 38107): la voce chiedeva le
**otto chiamate**, e le otto sono fatte. È il vicino di casa di questa voce, non il suo residuo.

---

## 📋 IN CODA — 4

Le sezioni **A** (cose sue già decise), **B** (lavoretti minuti), **C** (sapute e non risolte — salita tutta in urgenti il 16/08) ed **E** (manutenzione memoria) sono **vuote**.

### C — Cose sapute e non risolte — 0

### D — Corpose: solo se si vogliono ATTIVARE — 4

| # | cosa |
|---|---|
| **15** | 🎾 ✅ **FATTA su TEST (6.240) e PROMOSSA A PROD (6.232), su sua conferma separata. Resta qui finché non la guardi.** Promossa da lui il 15/08. La card ora dice «Partita aperta», bordo tratteggiato, contatore **🟠 n/4** / **🟢 4/4**. 🚨 Il campo si confronta col **numero nudo**: sui 23 record veri di PROD i valori sono `"Campo 1"`…, e `isSameField('Campo 1','C1')` è **falso** ⇒ con `'C'+n` non sarebbe comparsa mai, in silenzio. Rete **90 → 93** (flow `Calendario/Aperta`), sabotaggi provati. ⛔ **Non chiusa da me**: la chiusura la decide il committente, e questa si vede solo col login staff — che dal cloud non si raggiunge |
| **16** | 💰 **Storno/cobro PARTITA** — flag OFF mai validati; validare in TEST prima di qualsiasi attivazione |
| **17** | 🔐 **Consumer: hook Auth «Customize Access Token»** — senza, l'RLS nega in silenzio. Rilevante **solo** quando si riprende l'app soci (0 utenti veri oggi) |
| **18** | 📣 **Pannello avvisi nel gestionale** (lo staff vede cosa il bot ha mandato ai soci). 🚨 Stesso nodo del pannello autorizzazioni ⇒ **si disegnano insieme** |

---

## 🆕 Nate misurando, **non** ancora in coda

Misurando il **12/08**:

- 🔓 Su **TEST** ci sono policy `ALL` (lettura **e scrittura**) per anonimo su `pmo_bookings`, `pmo_parse_history`, `pmo_parser_rules_versions`. Su PROD no.
- 🔓 Su PROD altre **tre tabelle** accettano inserimenti anonimi (`pmo_ai_turns`, `pmo_parser_errors`, `post_match_feedback_responses`): non guardate.
  ⬆️ **Entrambe promosse da lui il 14/08: sono la voce 37**, dove sono anche rimisurate — le policy su PROD sono **quattro**, non tre, e una è un `UPDATE`.

Misurando il **14/08** nella 14ª sessione, provando la voce 27 dal vivo:

- 🔀 **Le TABELLE dei due progetti divergono**, non solo le funzioni SQL della voce 33.
  Misurate finora solo le due dell'autovalutazione: `assessment_tokens.member_email` e
  `self_assessments.email`, `consistency_score`, `inconsistency_reasons`, `review_note` **ci
  sono su PROD e non su TEST**. Nessuno le aveva mai confrontate. ⚠️ Le altre tabelle **non
  sono state guardate**: questa è una campionatura di due, non una misura.
  ⬆️ **Promossa da lui il 14/08: è la voce 39.**
- 📡 **Il gestionale di TEST chiama `wa-shadow-proxy` una volta al minuto e prende 404**: la
  funzione sta nel repo ma **non è mai stata deployata su `cudi…`**. **612 chiamate a vuoto in
  24 ore**, dal 13/08. Non rompe niente di visibile, ed è per questo che nessuno se n'era
  accorto. ⚠️ Non guardato se su PROD c'è.
  ⬆️ **Promossa da lui il 14/08: è la voce 38** — e guardato: **su PROD è uguale**, 623 chiamate
  a vuoto in 24 ore verso una funzione che non è deployata **né di qua né di là**.
- 🧟 **Il riquadro «prova il test» del gestionale non esiste più**: `0` occorrenze di
  `id="assessmentExternalKnowledgeBlock"` anche su `main`, da prima di questo lavoro — tolto il
  13/08 con la #677. Le tre funzioni che lo servivano sono rimaste: sono **voce 28** in piena
  regola. ⇒ Dal gestionale, oggi, il test non si fa: si fa aprendo il link del socio.

Misurando il **14/08** nella 14ª sessione, chiudendo la voce 24:

- 🔁 **`livello.autovalutazione_url` è rimasta su TEST e non su PROD.** Confrontando le kb sezione
  per sezione, **una sola** diverge: `livello` — `{}` su PROD, e su TEST ancora
  `https://test.padelvillage.club/?assessment=link-esterno`. Il codice dice a chiare lettere che
  quella voce **«non si legge più»** e **«va tolta dalla configurazione dei due ambienti»**: su PROD
  fu tolta il 9/08 — ed è proprio ciò che salvò `pmo_bkp_kb_livello_20260809`, la tabella a cui
  stamattina ho acceso l'RLS — su TEST **no**. Nessuno la legge (grep: solo il commento), quindi non
  fa danno; ma sta nella kb che va **in pasto al modello**. ⚖️ **È la forma esatta della voce 31**, e
  stavolta al contrario: il pezzo mancante sta su PROD. Non l'ho toccata — non è la 24.
  ⬆️ **Promossa da lui il 16/08: è la voce 46**, e là è **rimisurata**: vive in `pmo_ai_settings`
  (chiave `assistant_kb`), non nel codice.

Misurando il **14/08** nella 15ª sessione, aprendo il residuo della voce 27:

- 🕳️ **`fetchAssessmentRawResponsesByTokens` non può funzionare su PROD.** La sola `fetch` REST a
  `self_assessments` rimasta in `main` (riga 29939) è una **GET** con la chiave pubblicabile, ma su
  quella tabella **non esiste nessuna policy di SELECT** — ci sono solo le 3 di INSERT. ⇒ Risponde
  `200` con lista **vuota**, sempre, e il chiamante ha un `catch` che tace. Non l'ho toccata: non è
  la voce 27, e va capito **a cosa serviva** prima di decidere se ripararla o toglierla. ⚠️ Non
  guardato se su TEST si comporta uguale.
  ⬆️ **Promossa da lui il 16/08: è la voce 45** — dove **due numeri di questa nota risultano falsi**
  (la riga è la 29214/29223, non la 29939; e le policy non sono «3 di INSERT», sono **zero**), e dove
  è scritto il contesto che qui mancava: la sezione è **congelata dal 13/06**.

- 🔎 **`get_self_assessments_by_tokens` è `SECURITY DEFINER` eseguibile da `anon`**, quindi
  scavalca anche lei la chiusura della lettura del 12/08. **Non toccata di proposito**: l'app la
  usa davvero (`index.html:30062`, ed è la strada che funziona mentre la GET REST accanto non può)
  e vuole i **gettoni in ingresso**, che non si rastrellano più. È un fatto da sapere, non un buco
  aperto — ma è la terza funzione della stessa famiglia, e la famiglia andava guardata tutta.
  ⬆️ **Promossa da lui il 16/08: è la voce 44** — e là **la conclusione di questa nota è ribaltata**.
  «Non un buco aperto» reggeva su *«vuole i gettoni in ingresso»*: vero, ma su PROD **un gettone è
  indovinabile** (`MAURIZIO001`) e dietro c'è **un socio vero col telefono**. Provata **eseguendo la
  funzione come `anon`**, non leggendo i grant. 📌 Anche la riga è sbagliata: la chiamata è alla
  **29316**, non alla 30062.
- 🧮 **Le funzioni `SECURITY DEFINER` chiamabili da `anon` su PROD sono 47**, e due erano quelle
  della voce 27. Il linter le segnalava **tutte e 47 da sempre**, con lo stesso identico titolo:
  📏 **Rimisurate il 16/08: oggi sono 34, non 47.** Il numero si è mosso (le potature delle sessioni
  16ª e 19ª), quindi non va ricopiato: si riconta. Una di queste 34 è la **voce 44**.
  ⚠️ nessuno le ha mai lette una per una. Le altre 45 **non sono state guardate** — questa è una
  campionatura di due, esattamente come le tabelle divergenti di ieri.

Misurando il **14/08** nella 16ª sessione, disarmando la voce 38:

- 🧟 **Il riquadro WhatsApp e il suo blocco JS restano nel file, ora irraggiungibili**: ~150 righe di
  HTML (`index.html:7219–7369`) e ~700 di JS (il blocco `wa*`), tenute in vita solo dal `return` che
  le precede. **È la stessa forma delle voci 28 e 29** — codice dormiente di una cosa smontata — e
  come quelle l'asportazione va provata per bene, non fatta di slancio. ⚖️ **Non l'ho messa in coda
  da me**: le promozioni le decide lui, e questo vale anche per l'ingresso in lista.
- 🔎 **`wa_usage_stats` è rimasta su `ayly…` a leggere tabelle che non esistono più**, ed è
  `SECURITY DEFINER` eseguibile da `anon`. Non fa danno — muore in partenza con `42P01` — ma è la
  **quarta** funzione della famiglia «viva senza il suo mondo» incontrata in due giorni, dopo le tre
  della voce 36. Non toccata: non era la 38.

Misurando il **14/08** nella 16ª sessione, censendo le tabelle (voce 39):

- 🔴 **`pmo_parser_errors`: l'app di PROD scrive e legge colonne che su PROD NON esistono.** Dalla
  **PR #648 del 7/08**, `logParserError` manda sempre `origine` e il pannello «Le mie segnalazioni»
  chiede `stato`, `risolto_il`, `risolto_in_versione`, `nota_risoluzione`: cinque colonne che stanno
  **solo su TEST**. Provato sul bersaglio: **`42703`** su tutte e tre le strade. ⇒ Su PROD nessuna
  segnalazione del parser si registra — **in silenzio** — e quel pannello non carica.
  ⚖️ **Non è la causa** del silenzio della tabella (45 righe, tutte del **16/06**, due mesi prima):
  la mia ipotesi è stata smentita dalla misura, e i due fatti restano distinti.
  ✅ **RIPARATA in giornata, strada scelta da lui: aggiungere le 5 colonne a PROD** — quella che
  allinea, non quella che mutila. Colonne **copiate verbatim da TEST** (`stato` e `origine` `NOT
  NULL` con default, le altre tre libere); indici e vincoli erano **già identici** e non sono stati
  toccati. Verificato: le tre strade che davano `42703` ora riescono (l'INSERT nella forma **esatta**
  dell'app, in transazione annullata, 0 residui); l'**impronta** delle colonne di PROD è ora
  **identica** a quella censita per TEST *prima* di toccare niente; e la prova **end-to-end via
  PostgREST**, stessa URL e stessa chiave dell'app, è passata da **400 `42703`** a **200 `[]`**.
  Linter **101 → 101**, `ERROR` 0. Le 45 righe storiche intatte, ultima ancora del 16/06.
  🔗 Migrazione `20260814183100`, reversibile.
  ⚠️ **Resta aperta la domanda vera**: *perché* quella tabella tace dal **16/06**. La migrazione
  chiude il disallineamento, non il silenzio — e i due non erano lo stesso problema, per quanto
  comodo sarebbe stato crederlo.
- 🧯 **Rivedere quel che ho detto sulla voce 37**: avevo chiamato «portante» la policy di INSERT
  anonimo su `pmo_parser_errors`. Resta vero in linea di principio — il codice ricade su `anon`
  quando la sessione staff manca — ma è **irrilevante in pratica finché resta il 42703**, perché su
  PROD quell'insert non riesce comunque. Ho fatto bene a non toglierla, per il motivo sbagliato.
- 🔎 **`assessment_tokens` diverge in DUE direzioni**, non una: `member_email` solo su PROD,
  `updated_at` solo su TEST, con **13 colonne da entrambe le parti**. Il conteggio non l'avrebbe
  mai mostrato.

Misurando il **14/08** nella 17ª sessione, sanando la 37 e rimisurando la 38:

- 🔓 **Il `TRUNCATE` ad `anon`, sceso qui dalla voce 37 quando è stata chiusa.** Non è stato tolto e
  la voce lo dichiara: riguarda i **grant** e non le policy, e non era ciò che era stato autorizzato.
  Il testo è quello misurato dalla 16ª sessione, intatto:

  🚨 **E sotto c'era altro, che nessuno cercava.** Quella `D` nell'ACL è **TRUNCATE**, e l'**RLS non
  filtra il TRUNCATE**. Provato come `anon` su TEST: `truncate public.pmo_parse_history` **RIUSCITO**.
  (Su `pmo_bookings` risponde `0A000`, ma è la **chiave esterna** di `pmo_parse_history`, non un
  rifiuto di permesso.)
  📊 Su **PROD** sono **14 le tabelle** dove `anon` ha TRUNCATE — con ACL piena `arwdDxtm`, quindi lì
  a trattenerlo è **solo l'RLS**: fra queste `admin_settings`, `assessment_admin_config` (il deposito
  del PIN), `pmo_lessico`, `pmo_ai_settings`, `pmo_parser_config` e i due backup del 9/08.
  ⚖️ **Non è un allarme, ed è importante dirlo**: chi ha la chiave pubblicabile parla **PostgREST**,
  che non ha un verbo TRUNCATE. Per usare quel permesso servirebbe eseguire SQL **come `anon`** — cosa
  che oggi nessuna strada nota permette. È una **configurazione sbagliata latente**, non una porta
  aperta. Ma è la stessa forma della voce 36: un permesso che nessun elenco di «chi scrive» mostra.

- 🔎 **`wa_usage_stats` su `ayly…` non muore come dice la scheda, e non muore sempre.** La voce 38
  dichiara «esiste ancora ma muore — `42P01: relation "whatsapp_inbound_messages" does not exist`».
  Misurato: la funzione **esiste** (`wa_usage_stats(days integer)`, `SECURITY DEFINER`), ma su
  `/rest/v1/rpc/wa_usage_stats` PostgREST risponde **404** — che non è un `42P01`, è «firma non
  trovata». E accanto ai **290** fallimenti ci sono **29 chiamate andate a 200**, l'ultima alle
  **18:56**. ⇒ Delle due cose una: o chiama in due modi diversi, o c'è un secondo chiamante. **Non
  l'ho stabilito**, e non l'ho toccata: il conto dei 404 che serviva alla 38 è giusto lo stesso,
  ma la *ragione* scritta nella scheda non è quella misurata.
- 🕳️ **Su TEST `service_role` non può leggere né scrivere le due tabelle del feedback.** Ha solo
  `REFERENCES/TRIGGER/TRUNCATE` su `post_match_feedback_responses` e `_tokens`, senza
  SELECT/INSERT/UPDATE — condizione **preesistente**, non prodotta dalla migrazione di stasera
  (misurata prima e identica dopo). È la firma del vecchio `revoke ... from public`. Oggi non fa
  danno perché la strada legittima è una RPC `SECURITY DEFINER`; il giorno in cui un'edge provasse
  a leggerle **col ruolo di servizio** fallirebbe, e su PROD la stessa prova riuscirebbe. ⚠️ È la
  forma della voce 39 spostata sui **permessi**: non le colonne a divergere, ma chi può toccarle.
- 🔀 **`matchpoint-bookings-create` diverge fra i rami**: 4 chiamate a `writeBookingJob` su `main`,
  **5** su `test-preview`. La quinta è il ramo «prova a vuoto» del 7/08, che su TEST chiude il
  lavoro con `done` mentre su PROD chiude con `error`. Trovata aprendo la voce 23.
- 🕳️ **`typecheck-edge-functions` gira SOLO sulle PR**, non sui push. ⇒ ogni push a `test-preview`
  che tocca `supabase/functions/**` **deploya la edge su TEST senza alcun `deno check`** — ed è
  proprio l'ambiente dove si prova, cioè dove un errore dovrebbe uscire *prima*. Il gate c'è, ma non
  copre la strada che si usa di più. ⚠️ Non l'ho toccato: è una modifica a un workflow, e i workflow
  sono sorvegliati.
- 🧯 **E lanciato a mano quel gate MENTE, in modo istruttivo.** Con `workflow_dispatch` non esiste un
  `BASE_SHA`, quindi non ha un termine di paragone e stampa *«funzione nuova con N errori di tipo:
  deve nascere pulita»* — su una funzione che nuova non è. Misurato: **`main` fallisce identico**,
  e in locale (con l'import `jsr` sostituito, uguale ovunque) `main`, `test-preview` prima e
  `test-preview` dopo danno **0-0-0**. ⇒ L'errore è **preesistente su entrambi i rami** e vive nella
  parte che la rete di questa sessione non riesce a scaricare. Il differenziale vero lo dà solo una
  PR: fuori da lì quel rosso non distingue «ho rotto qualcosa» da «c'era già».

Misurando il **14/08**, aprendo la voce 22:

- 🧊 Lo specchio delle prenotazioni di TEST fermo dal 7/08 → **promossa da lui a urgente: è la voce 32.**
- 🔢 `payment` su TEST ha **2503** righe contro le **2502** di PROD: una in più, non guardata.

Misurando il **15/08** nella 19ª sessione, sanando la voce 40 e chiudendo la 23:

- 🧪 **LA PARTE B DEL COLLAUDO — «il worker riceve, crea su Matchpoint, e poi la risposta si
  perde».** ⬆️ **Promossa da lui il 15/08, subito dopo: è la voce 41**, in coda nella sezione C.
  È ciò che resta della voce 23, che è stata **chiusa** per sua decisione: non è un lavoro
  di codice, è **una prova da eseguire dal Mac**, e sta scritta per intero nella parte B di
  [`docs/collaudo-voce-23-caduta-worker.md`](../collaudo-voce-23-caduta-worker.md).
  🔎 **Perché ora si può, e prima si diceva di no**: non serve che il worker sia irraggiungibile,
  serve che **la risposta non torni**. Il worker mette il lavoro in **coda** e parla con Matchpoint
  **in uscita**, non attraverso Caddy ⇒ togliendo Caddy *mentre sta già lavorando*, la prenotazione
  si completa e la edge non riceve niente.
  📊 **La finestra è misurata su 191 lavori veri**: il `done` più veloce sta a **4,0 s** (mediana
  8,1 · p90 31,7 · max 148,4), mentre i tre `unknown` del collaudo stanno a **0,2–0,3 s** — tagliare
  a ~2 secondi è dentro il minimo con margine doppio, e il tempo da solo distingue i due casi.
  ⭐ È anche l'**unico** caso che percorre il ramo del **`si`** — ignoto → si guarda → si TROVA →
  lavoro chiuso `done` — mentre il collaudo di ieri prova solo il ramo del `no`.
  🚨 **Due trappole, trovate leggendo il codice prima di scrivere la procedura**: ① lo slot **non**
  dev'essere una manutenzione, perché `staffCalAskMatchpoint` cerca **i nostri nomi** e senza nomi
  il verdetto è `boh` ⇒ si proverebbe la strada sbagliata credendo di aver provato quella giusta;
  ② la prenotazione è **vera per costruzione**, non per incidente come le tre del 14/08, e la
  cancellazione fa parte della procedura.
  ⛔ **Quel che è scritto sono previsioni dichiarate, non misure**, e la principale va detta: *non è
  provato* che il worker prosegua dopo la caduta del client. Se si fermasse, Matchpoint resterebbe
  vuoto e il caso non sarebbe riproducibile così — anche quello è una risposta, da scrivere lì
  invece che riprovare a caso.

- ✅ **Nessun lavoro di prenotazione è MAI rimasto appeso a `pending`**: **191 lavori** da giugno,
  **0** senza esito finale. Il «lavoro fantasma» che il commento di `writeBookingJob` teme —
  *«resta pending PER SEMPRE e chi guarda non saprà mai com'è finita»* — è un rischio reale del
  disegno che in due mesi non si è mai realizzato. ⭐ Vale quanto una prova al contrario: dice che
  la cosa da guardare era il **terzo esito**, non il lavoro perso, e la voce 23 ha guardato dove
  doveva.
- ⚠️ **Il lavoro non sa quanto è durato.** Ogni scrittura **sostituisce** il payload intero, quindi
  `created_at` — presente solo nella prima riga, quella `pending` — sparisce alla seconda. La durata
  si ricava solo dalle colonne della tabella. Non fa danno oggi; sarebbe una riga in più da
  conservare il giorno in cui si volesse misurare la lentezza del worker dal database.

- 🕳️ **A PROD manca `trg_self_assessments_mark_token_completed`, che TEST ha.** Trovato facendo il
  rito «cosa c'è attaccato a questa tabella» prima di montare i due trigger dell'`updated_at`: su
  PROD quelle due tabelle non avevano **nessun** trigger, mentre le funzioni c'erano tutte e tre,
  identiche a quelle di TEST. Due ne mancavano per dimenticanza e sono state rimesse; **questo no,
  di proposito**: non è un allineamento di schema ma un cambio di **comportamento** — brucerebbe il
  gettone da dentro il database, mentre su PROD lo fa la edge (voce 27: 0,15 secondi dopo). ⚠️ Due
  strade che fanno la stessa cosa vanno guardate **insieme**, o si finisce con la scheda marcata
  due volte da due padroni diversi.
- 🔎 **La divergenza `member_email` NON ha un gemello vivo**, e l'ho misurato invece di dedurlo: su
  TEST **nessuna** funzione SQL nomina quella colonna, e nel codice compare solo dentro un commento
  di `assessment-quiz` che spiega perché non va nominata. ⇒ Delle due direzioni della divergenza,
  una sola faceva danno. La simmetria di una tabella non implica la simmetria del guasto.

Misurando il **15/08**, collaudando la voce 23 in produzione:

- 🔴🆕 **`assessment_tokens.updated_at` NON esiste su PROD, e l'app la scrive lo stesso.** Letto
  **dalla console del committente**, in produzione, mentre facevamo altro:
  `POST …/rpc/update_assessment_token_status_admin → 400 (Bad Request)`, con
  `column "updated_at" of relation "assessment_tokens" does not exist` — **due volte in pochi
  secondi**. ⇒ Era già scritto come nota della **voce 39** (*«`assessment_tokens` diverge in DUE
  direzioni: `member_email` solo su PROD, `updated_at` solo su TEST»*), ma lì era una divergenza
  censita; qui è un **guasto vivo**, ed è la stessa forma delle 5 colonne di `pmo_parser_errors`
  sanate il 14/08. ⬆️ **Promossa da lui a prima cosa della ripresa, e chiusa il 15/08: è la voce 40.**
- 🕳️ **Il lavoro resta `unknown` nel database anche quando l'app l'ha risolto.** La chiusura della
  verifica vive solo nel `localStorage` del browser: chi guarda `pmo_cloud_records` vede un lavoro
  eternamente in sospeso che invece è stato chiuso. Piccola, ma è della famiglia «documento che
  mente». ✅ **Chiusa il 15/08 dentro la voce 23** (PROD 6.226): la edge ha l'azione
  `chiudi-lavoro-ignoto` e tutte e quattro le strade dell'app la chiamano.
- 🔎 **Sei divergenze fra documenti e realtà**, tutte misurate mentre servivano:
  la chiave SSH si chiama **`padel_deploy`**, non `pmo_deploy_key`; il worker si raggiunge a
  **`https://worker.91.99.131.243.nip.io`**, non all'IP nudo `:8787`; **davanti c'è Caddy**, non
  documentato da nessuna parte; la **porta 8787 da fuori non risponde** (la strada è la 443); il bot
  Telegram **ha un'anteprima** (`assistente-padel-agent-prova`, accesa, voluta) mentre `CLAUDE.md`
  dichiara «un solo processo, né anteprima né sandbox»; e l'ultimo accesso umano alla VM era del
  **9 giugno**.
- ⚙️ **Da una sessione cloud non si esce verso il gestionale**: `app.padelvillage.club` e
  `*.supabase.co` rispondono **403 CONNECT (policy denial)** sul proxy. L'unica finestra sulla
  produzione è **il database** — `pg_net` per leggere il file servito, SQL per lavori e tracce.
  📌 È la ragione per cui da oggi ogni pezzo nuovo deve **lasciare traccia in una tabella**: senza,
  è invisibile a chi non è seduto davanti a quello schermo.

---

## 📦 CHIUSE — dal 13 al 16/08/2026 — 33 voci

⚠️ **Una sola sezione datata per volta.** `guard-docs-truth` conta le righe di **tutte** le
intestazioni `CHIUSE —` ma legge il numero della **prima**: due blocchi datati affiancati dichiarano
1 e ne contano 9, e la guardia fallisce. Chi chiude in un giorno nuovo **allarga la data di questa**,
non ne apre un'altra sotto.

**Le prime QUATTRO voci sono del 16/08**; **le dieci successive del 15/08** — otto chiuse e **due annullate**, e l'etichetta lo dice riga per riga perché «non serviva più» e «è stato fatto» non sono la stessa cosa. **Le dieci successive sono del 14/08; le otto ultime del 13/08.**

| voce | cosa |
|---|---|
| **14** | ✅ *(16/08, 25ª sessione — **chiusa DICHIARANDO su sua decisione**, non eseguendo)* **Le chiavi «Ospite» che oscillano: benigne, e la chiave resta com'è.** La chiave dell'occupazione contiene il **nome** — `occupancy\|idReserva\|data\|ora\|campo\|NOME\|durata` — quindi un ospite che prende un nome vero **non aggiorna** la riga: ne crea una nuova e lascia una lapide. ⇒ Non è un guasto, **è il progetto della chiave**: succede ogni volta che lo staff sostituisce un ospite con un socio, cioè una cosa che *deve* succedere. 🔬 **Rimisurata sul bersaglio il 16/08 alle 08:47 UTC**, non ricopiata dalla scheda: **571** righe `Ospite` su 3904 di occupazione (15% della tabella), **438** slot oscillanti, `ancora_vive` **0**, `oscillanti_vivi` **0**. ⭐ **E la prova che chiude la voce non è quel totale, è la serie**: `di_cui_vive` = **0 in quindici settimane su quindici**, da maggio. «Zero oggi» è una fotografia e potrebbe essere fortuna; zero per quindici settimane è un **comportamento** — ogni chiave finisce cancellata e lo slot si risolve, sempre. ✅ **Controllo negativo fatto prima di credere allo zero** (lezione della 24ª): l'ultima riga di occupazione aveva **33 secondi**, 73 nelle 24 ore ⇒ la sonda guarda un cassetto **vivo**. Il silenzio di 2 giorni e mezzo sulle sole `Ospite` cade su **Ferragosto**, ed è una pausa del circolo, non del meccanismo. ⚖️ **Perché NON si toglie il nome dalla chiave**: il costo è **contabile e basta** (~30 lapidi a settimana, nessuna riga che resti aperta), mentre la cura è sproporzionata — quella chiave la scrivono e la leggono **sync, app e i ponti**, e cambiarla senza cambiarli insieme spacca l'aggancio fra le due copie. 📄 **La sonda sopravvive alla voce**, con serie storica, controprova su TEST e il controllo negativo, in [`docs/voce-14-sonda-chiavi-ospite.md`](../voce-14-sonda-chiavi-ospite.md): 🔁 si riapre se `ancora_vive` o `oscillanti_vivi` salgono sopra zero. |
| **42** | ✅ *(16/08, 25ª sessione — **chiusa su sua decisione**, a domanda risposta)* **«Cos'altro teneva in piedi quel mezzo secondo?» — nulla: le due corse vere sono progettate per ignorare ciò che la push ha appena scritto.** La voce nasceva dal caso 11 che cadeva addosso al caso 12 quando la 6.231 tolse il riscaricamento di `config.js` (~110 volte al minuto), e chiedeva di censire le altre chiamate in equilibrio su quel ritardo. 🔬 Censite il 15/08 sull'intero sorgente, righe di commento escluse: le **letture** non attese **non esistono** (`pmoStaffRpcPaged` è 16 su 16 attesa — una lettura non può arrivare presto se nessuno la lascia correre); le **scritture** non attese sono 14 su 16; la forma pericolosa dà **3 candidate e nessuna lo è** — una è un falso positivo della sonda di prossimità (due funzioni vicine nel testo, non annidate), le altre due escludono **per costruzione** le chiavi appena spinte (`_already`, `_destId`). ⇒ **«Cosa leggerebbe se arrivasse 50 ms prima?» → la stessa cosa.** 🧯 Lasciata scritta nella voce un'ipotesi mia sbagliata (`staffCalCloudReassignAndSyncMove` che partirebbe dallo slot d'origine: falso, cerca la `entry` al nuovo slot e il commento lo dichiara) — ci avevo creduto perché **cercavo corse**, che è la «prova che ti dà ragione» vista dal lato di chi indaga. ⚖️ **Si chiude a domanda RISPOSTA, non a lavoro finito**: quello che era emerso strada facendo è di un'**altra famiglia** — non una lettura precoce ma una **coda staccata che scrive** — ed è la voce **43**, che resta aperta con la sua misura. |
| **34** | ✅ *(16/08, 24ª sessione — **accesa su sua conferma separata** la sera del 15, e **confermata dal giro automatico** la mattina del 16)* **Il calendario di TEST era una fotografia ferma al 7 agosto: adesso si aggiorna 5 volte al giorno.** 🔓 **A sbloccarla è stata un'informazione sua, che non stava in nessun file**: le routine di TEST erano state fermate *insieme e di proposito*, per fare gli aggiornamenti a mano durante le prove — la scheda poneva come condizione di sapere «perché furono spenti», e quel perché **da qui non era recuperabile**. ⚖️ **Il nodo vero non era nessuno dei tre indicati dalla scheda**: il dispatcher è **UNO per 12 slot** (6 clienti + 1 storico + 5 calendario), quindi «riaccendere solo il calendario» **non esiste come interruttore**. Sciolto **senza toccare la funzione**: sveglia ogni ora al minuto 30, e a decidere è il confronto sull'**ora italiana** che nomina i cinque orari. 🚨 Serve **anche** contro le collisioni, non solo contro l'ora legale: pure i 6 slot dei clienti cadono al minuto 30 — e cinque orari fissi in UTC si sarebbero rotti al cambio dell'ora **in silenzio**, cioè lo stesso guasto muto da cui nasce la voce. 🛑 **Tre punti della scheda smentiti dai fatti**: il `jobid 13` **non è stato toccato** (si è aggiunto il **17**, così tornare indietro è cancellarlo), **era** una riga di SQL, ed **è stata fatta dal cloud**. ✅ **Il filtro esercitato, non dato per buono**: alle 23:30 — slot **clienti** — la sveglia è partita (`succeeded`) senza produrre **nessun** dispatch clienti né storico, ed è stata esclusa la spiegazione alternativa (`on conflict do nothing`: le uniche due righe clienti sono del 2 e 3 agosto, chiavi che non possono collidere). ✅✅ **E la catena provata FINO IN FONDO la sera stessa, su sua idea** — *«perché non metti un aggiornamento adesso a mezzanotte così proviamo?»*: forzando l'orario, **53 righe lette dal Matchpoint vero**, 258 righe toccate, calendario **dal 7 agosto a quella sera**, 49 prenotazioni importate e 79 tolte. 🎯 **Quella prova ha evitato un errore che sarebbe passato per successo**: la mattina dopo si sarebbero viste 5 righe tutte `dispatched` — verdi — e si sarebbe potuto dichiarare fatto **contando i lanci invece di guardare i dati**. ✅ **CONFERMATA dal giro automatico del 16/08**: `bookings_morning` alle **05:30** italiane, **0** risvegli di clienti e storico, calendario aggiornato alle **05:31:55**. 🧯 Due letture sbagliate mie, nel documento: «non ce l'ha fatta» (leggevo un campo di un'altra strada) e «il calendario non si è mosso» (misuravo **un minuto prima** che la scrittura atterrasse) — non la sonda cieca della 23ª, ma **una misura presa prima che il fatto accadesse**. ⛔ **Residuo dichiarato**: le letture in più nei log del worker si vedono solo **dalla VM**. 📄 Procedura, query di controllo e comando di spegnimento in [`docs/voce-34-riaccendere-calendario-test.md`](../voce-34-riaccendere-calendario-test.md). |
| **26** | ✅ *(16/08, 24ª sessione — **chiusa dalla 34**, come la sua stessa scheda prevedeva)* **Il «Fatto» del togli che non si vedeva: non era il bot, era il calendario fermo.** Il bot diceva di aver tolto il giocatore e la riga non spariva. La causa era stata trovata il 14/08 chiudendo la voce 32 — su TEST **non girava nessun sync delle prenotazioni**, quindi non c'era niente che riconciliasse, mentre in PROD lo fa `bookings_live` ogni 2 minuti **con lo stesso identico codice**. ⇒ Il bot era sano: aveva ragione a dire «Fatto». ✅ Dal 16/08 il calendario di TEST si aggiorna 5 volte al giorno (voce 34), quindi il sintomo **sparisce da sé**: non c'era niente da riparare, c'era da riaccendere altrove. ⚖️ È la voce che la 23ª aveva citato come costo dell'inganno del calendario congelato — *«aperta come guasto del bot quando il bot era sano»* — e si chiude senza che una riga di codice sia stata toccata. |
| **41** | ✅ *(15/08, 24ª sessione — **eseguita dal committente**, quarto giro, con la sessione cloud a leggere il database in diretta)* **«Il worker crea, e la risposta si perde» — e il gestionale è andato a GUARDARE.** La parte B della voce 23: l'unico caso che percorre il ramo del **`si`**. ✅ **Tutte le previsioni verificate**: lavoro `unknown` con errore di rete tagliato a **2,2 s**, **8 tentativi** di insistenza, verdetto **`si`**, e chiusura `done` con `chiusa_da = verifica-app` alle 22:29:15. ⭐⭐ **Prima esecuzione VERA di `chiudi-lavoro-ignoto`**: prima di stasera i lavori chiusi dall'app erano **0 su 192** — scritta, provata al banco, mai girata in produzione. ⚖️ **Ma il valore della voce sono i TRE GIRI FALLITI prima**, perché hanno dimostrato che la procedura scritta **non poteva funzionare**: ① «conta due secondi e dai lo stop» non teneva conto che il comando via `ssh` ci mette del suo; ② 🚨 **`systemctl stop caddy` non taglia una richiesta già in corso** — è uno spegnimento gentile, e con collegamento già aperto e stop istantaneo al 2º secondo il lavoro finiva `done` in 4,3 s lo stesso; ③ tenere il collegamento aperto mentre si prenota **lo fa scadere**. ⇒ La cura: `ServerAliveInterval=15` e **`systemctl kill -s SIGKILL`** al posto dello stop. 🧹 Pulizia verificata col testimone indipendente: cancellata 22:30:52, controllo automatico 22:32:00, **zero residui** su tutte e quattro le prove. 🧯 E tre letture sbagliate mie della stessa sera, tutte scritte nel documento: la peggiore — *«non è partita nessuna cancellazione»* — cercava fra i `booking_job`, ma una cancellazione lì **non compare**: lascia un `staff_cancel`. Ho guardato nel cassetto sbagliato, ho preso il silenzio per un fatto, e **a smentirmi è stato lui guardando Matchpoint**. |
| **14bis** | 📦 *(15/08, 24ª sessione — **chiusa dal committente**)* **«Se lo staff mi prenota una LEZIONE, il bot me la ricorda?» — no, e il no era una sua decisione.** Misurato nel codice del bot: `daSeguire()` toglie le lezioni **prima** di dividere le prenotazioni fra avvisi di disdetta e promemoria, e il commento lo dichiara — *«per scelta del committente: le gestisce la segreteria»*. ⇒ La domanda aveva risposta, e la risposta era già scritta. 🔎 Misurato anche il resto, perché serviva a decidere: il riconoscimento regge sui dati veri (`/lezion/i`, e i tipi su PROD sono sei in tutto); il maestro **non è mai nel roster** (12 su 12 sta nel campo `istruttore`); il ponte `consumer-player-readmodel` **non manda affatto** l'istruttore; e oggi un maestro **non si può nemmeno invitare** nel bot, perché l'unico punto che offre il link è la proposta che compare mettendo qualcuno **in partita**. ⛔ **Chiusa senza farla, su sua decisione**: *«lasciamo perdere la situazione dei maestri, lo faremo quando ci stacchiamo da Matchpoint»* — e la ragione regge nel dato, perché sulle lezioni sincronizzate da Matchpoint il campo istruttore è **sempre vuoto**. 📌 Il mockup del passo 1 è disegnato e **non approvato**, in `mockup/invita-nel-bot-da-scheda-socio-mockup.html`: se un domani si riprende, si riparte da lì invece che da capo. |
| **28** | 📦 *(15/08, 23ª sessione — chiusa **a residuo dichiarato**, dopo che la potatura è arrivata anche in PROD)* **I pannelli email rimossi, e la sezione Autovalutazione che era spenta da due mesi.** Nata il 13/08 come «5 pannelli tolti, 60 funzioni rimaste». ⭐ **Il fatto che ha rimesso tutto in scala l'ha detto il committente, non una sonda**: `PMO_ASSESSMENT_PARKED = true` **dal 13/06** ⇒ non erano pannelli tolti da una sezione viva, era **la sezione a essere spenta**, e i «12 punti vivi» sono scesi a **uno** — `restartAssessmentForMember`, sul bottone «Nuova autovalutazione» della scheda socio, che dirottava lo staff sulla Dashboard senza dirlo (PROD 6.228). Poi i due residui del canale email, su sua decisione (6.229). **E infine la potatura: 105 funzioni, 1590 righe, su TEST (6.241) e su PROD (6.232)**, col perimetro **rimisurato su `main`** invece che ricopiato. 🚨 **Il numero della scheda («64 e 1195») era sbagliato in tutti e due i sensi, e per trovarlo sono serviti quattro analizzatori**: il prefisso `assessment*` nascondeva 34 funzioni; la sonda delle invocazioni dinamiche non vedeva `assessmentProcessButton(label, tipo, "nomeFunzione(...)")` e produceva **due falsi morti** che avrebbero rotto due bottoni vivi; e soprattutto **leggeva un solo blocco `<script>` su cinque** — l'app ne ha uno da 976.000 caratteri, quindi 645 funzioni erano invisibili come chiamanti. 🎯 **A smascherarlo è stata la verifica DOPO il taglio, non il taglio**: due riferimenti orfani rimasti nel file potato. Senza quel controllo avrei cancellato codice vivo **con tutti i verdi accesi**. ⚖️ **IL RESIDUO DICHIARATO, misurato e non stimato**: `emailSent`/`emailError` restano nell'esito, sempre `false` e `''`. Sono **11 occorrenze in 3 funzioni VIVE** — `applyAssessmentLevel` li produce, `assessmentEmailRunAutoPostProcessing` li conta, `syncAssessmentResponsesFromSupabase` li espone come `autoEmailSent`. Non è potatura: è **modifica a percorsi che girano**, uno dei quali applica il livello a un socio, per togliere campi che valgono già zero. ⇒ Non vale il rischio, e resta scritto qui invece che in una lista. |
| **31** | 📦 *(15/08, 20ª sessione — chiusa da lui **a residuo dichiarato**, non a residuo finito)* **«La sicura dei bottoni Matchpoint stava solo su TEST», e il censimento che ne è nato.** La domanda aperta era *«cercarne altri della stessa forma»*: cercati, trovati, e i tre che contavano sono **curati**. ① **La mezza promozione** — il banco di PROD chiamava `PMOAi.resetFlow()` e `__PMOStaffCalTest.resetCard()`, che in `main/index.html` **non esistevano** (0 occorrenze): non «la sicura non è arrivata», ma **la maniglia senza la serratura** — peggio, perché il file dichiarava di sé il contrario (PROD **6.227**). ② **La rete di regressione: 55 → 87 casi** (PROD **6.230**). 🚨 La prima conta era sbagliata nella composizione: confrontavo per **id**, e gli id sono **rinumerati** fra i rami ⇒ la famiglia «vai a GUARDARE» `main` ce l'aveva già. Rifatto per **nome**: mancavano **35**, il grosso erano i **PAGAMENTI** (18), portati **32** (i 3 di simulazione restano su TEST per costruzione). Provata coi denti: sabotando il payload verso `matchpoint-wallet-correct` va **85/87**, e cadono esattamente i due casi che quel payload lo asseriscono. ③ **`livello-dimostrato.ts` al ponte del bot**, deployato su `qqbf…` e verificato **vivo** (401 col suo JSON), con la premessa rimisurata sui dati vivi invece che ripresa dalla nota del 9/08: `ereditato` = **0** su PROD. ④ **`VERSIONI.md`** allineato su TEST (era un sottoinsieme stretto: 0 righe esclusive). ⚖️ **Due controlli negativi che valgono quanto i reperti**: il recinto `scrittura-al-circolo.ts` e la migrazione della paginazione stabile **non erano buchi**, verificato interrogando i due database; e **`manifest.json` non andava sistemato** — su TEST risponde **404**, il caricatore è un repo a parte e il link è assoluto ⇒ quel file lì non lo serve nessuno. La scheda diceva il contrario, ed era mio l'errore. 🚨 **Residui dichiarati, scritti perché non si perdano**: `supabase/functions/_archive/**` sta **solo su `test-preview`** mentre `CLAUDE.md` — identico sui due rami — lo descrive per entrambi; e **l'impalcatura dei due banchi diverge nelle DUE direzioni** (`main` ha un controllo su `svcAddMessage`, TEST il tracciamento `WS_BLOCKED`): migliorie nate separatamente, riconciliarle è un lavoro suo. Se un domani tornano, tornano da qui. |
| — | 🔭 *(15/08, 21ª sessione — attrezzo costruito dalla 20ª con la PR #722, **collaudato dal vivo** qui)* **Una console remota sul gestionale**: lo snippet si esegue **DENTRO la pagina** di TEST o di PROD e torna indietro risultato, messaggi di console, errori e screenshot. Chiude il giro che prima passava dall'operatore — «apri DevTools, incolla questo, dimmi cosa esce». ✅ **Collaudo su tutt'e due: TEST v6.238 e PROD v6.229, login staff ok, ciascuno col SOLO suo database fra gli host contattati.** 🚨 **Ma il valore della giornata sono i due difetti che il collaudo ha trovato, e che dal codice NON si vedevano: si vedono solo lanciandolo in un container nuovo.** ① **Non partiva affatto.** Playwright pinna un build di Chromium preciso (**1217**), il container ne ha uno solo (**1194**): moriva invitando a `npx playwright install`, cioè **la cosa che qui non si deve fare** (l'immagine è preparata apposta per non riscaricare i browser). ⚖️ La via d'uscita nel codice **c'era già** — `PMO_CHROMIUM_PATH` — ma non era scritta né nel README né in `prepara-ambiente.sh`: **una scappatoia che nessuno sa che esiste non è una scappatoia**, e serviva proprio alla prima volta, che è l'unica che conta. ② **La seconda guardia era INERTE su PROD.** Confrontava solo `PADEL_CONFIG.SUPABASE_URL`, che dopo il login **su PROD resta `undefined`** mentre su TEST è popolato: il confronto veniva **saltato in silenzio** e il report scriveva `null` come se fosse un esito. ⚖️ Non era un buco aperto — la controprova comportamentale (quali host il browser ha **davvero** contattato) reggeva, ed è la metà forte — ma delle due quella rimasta inerte lo era **proprio nell'ambiente dove sbagliare costa**, e taceva: *un controllo saltato che non lascia traccia si legge come un controllo superato*. È la stessa malattia dei documenti curata il 13/08, spostata dentro un attrezzo. ✅ **Corretti nella PR #727**: ripiego automatico sul Chromium che il container ha davvero, e il dichiarato letto da **due** posti in ordine — `PADEL_CONFIG.SUPABASE_URL`, poi `pmoExpectedSupabaseProjectRef()` — col report che dice **sempre** da quale fonte ha letto (`configFonte`) e, se non risponde nessuna delle due, **lo dichiara** invece di tacere. 🧪 **Sabotaggio di controllo**, perché una guardia che non si è mai vista dire di no non si sa se dice di no: dichiarando `test` mentre si serve la pagina di PROD si ferma **prima** dello snippet, con uscita **1**. 🚧 Detto per intero: quel sabotaggio ha esercitato la strada `PADEL_CONFIG`, **non** quella nuova — il confronto è la stessa riga per entrambe le fonti e le ho viste tutt'e due rispondere giusto, ma il *no* l'ho visto pronunciare per una strada sola. ⚠️ **Limite da ricordare PRIMA di fidarsi di una diagnosi**: negli screenshot i calendari risultano tutti «Libero» e non è un guasto. 🚨 **Il PERCHÉ scritto qui era però sbagliato, e l'ha smentito la misura della 22ª** (voce sotto): diceva «l'utente è un `readonly` senza `view_*`, quindi vede MENO dell'operatore». Non è quello: il `readonly` le prenotazioni **le riceve tutte**. 🔎 Trovato per strada e **non inseguito**, perché fuori dal chiesto: su PROD `PADEL_CONFIG` c'è **prima** del login e sparisce **dopo**; su TEST resta. ✅ **Anche questo è cambiato**: dalla **6.231** (#734) PROD se lo ricorda pure dopo il login |
| — | 🔬 *(15/08, 22ª sessione — **secondo** collaudo della console remota, dopo i bump: TEST **6.239**, PROD **6.231**, login staff ok in entrambi, ciascuno col SOLO suo database fra gli host contattati)* **Due correzioni, e una misura che smentisce la voce qui sopra.** ① 🚨 **Il container era di nuovo CRUDO**: `prepara-ambiente.sh` va incollato nel campo «Script di configurazione» dell'ambiente cloud, e quel campo era **vuoto** — niente `certutil`, niente magazzino NSS, e la console non raggiungeva nessun sito. ⚖️ La radice non è lo script mancante, è la **dipendenza da una casella di configurazione che nessuno vede**: si rompe nella sessione **nuova**, cioè esattamente quando l'attrezzo serve per la prima diagnosi, ed è lo stesso difetto della scappatoia `PMO_CHROMIUM_PATH` che il 21ª aveva trovato non scritta da nessuna parte — *una via d'uscita che nessuno sa che esiste non è una via d'uscita*. ✅ Ora **`console.mjs` lancia lo script da sé** prima del browser (resta l'unica fonte, è idempotente), l'esito va nel report sotto `caProxy`, e se fallisce **lo dice** su standard error invece di lasciar morire il lancio con un errore di certificato che sembra un guasto del sito. Il campo dell'ambiente resta il posto migliore — lì si paga una volta per sessione — ma non è più obbligatorio; `PMO_SALTA_PREPARAZIONE=1` disattiva. 🧪 Provato sui tre percorsi: magazzino **cancellato** → importa, secondo giro → «già presente», opt-out → «saltata». ② 📚 **La nota sulla seconda guardia era invecchiata di un giorno**: diceva che dopo il login «su PROD `PADEL_CONFIG` resta `undefined`», ma PROD è a 6.231 — cioè la promozione **#734** che glielo fa ricordare — e ora `configFonte` legge `PADEL_CONFIG.SUPABASE_URL` su **entrambi**. Il ripiego su `pmoExpectedSupabaseProjectRef()` **resta**, e il perché è stato riscritto per quello che è: la presenza di quel campo è una proprietà della **versione in pagina**, non un fatto stabile dell'ambiente — e la console gira anche su versioni vecchie e, con `--url`, su copie locali. ⚖️ *Una guardia che si fida di un campo comparso ieri torna cieca il giorno in cui qualcuno lo tocca, e ci torna in silenzio: che è il difetto da cui era nata.* ③ 🚨🔎 **E il «il readonly vede meno dell'operatore» era FALSO.** Chiesto di verificarlo, misurato: il `readonly` di PROD ha **2 permessi su 16** (`cloud_sync`, `view_dashboard`), ma `pmo_get_records_admin` richiede **solo `cloud_sync`** e **non filtra per tipo** ⇒ le prenotazioni **le riceve tutte**: RPC paginata **8359 righe**, vive **44 booking / 60 occupancy / 150 staff_booking**, identiche al conteggio SQL, e le **5** del 18/08 con ora e campo. ⚖️ Il calendario è vuoto per un'altra ragione, già scritta nel README come limite ma mai collegata a questo sintomo: **disegna da `localStorage`**, e in un browser appena nato `prenotazioni`, `prenotazioniOccupazione` e `staffBookings` **non esistono proprio**. 🚨 E c'è un secondo fatto indipendente che porta allo stesso «Libero»: su PROD le prenotazioni vive partono dal **17/08** — per il **15/08 sono ZERO**, quindi quel giorno il calendario sarebbe vuoto **anche** con lo stato caricato. 🧪 **Trappola presa in flagrante, ed è la lezione della giornata**: la prima sonda diceva «non vede niente» e **mentiva** — chiamava `pmoCloudRpc` senza `accessToken`, quindi partiva come **anon** e il server rispondeva `AUTH_REQUIRED`, che l'app traduce in «Accedi con email personale Supabase». La strada dell'app è `pmoStaffRpc`, che il token se lo prende. ⇒ Misuravo la **mia chiamata**, non il `readonly` — e la seconda sonda diceva ancora `{}` perché **1000 righe è il tetto di PostgREST**, non la fine dei dati. Tre sonde per una risposta, e le prime due davano lo stesso identico verdetto sbagliato. ✅ **COLLAUDO FINALE, dal codice UNITO e non dal ramo** (`main` a `0492f80`, file identici a quelli provati), con `node_modules` **e** magazzino NSS **cancellati** — cioè da container freddo, non da uno già scaldato dal lavoro di prima, che è l'unica condizione in cui il difetto ① si sarebbe rivisto: TEST **6.239** `caProxy` «importata», PROD **6.231** «già presente», login ok in entrambi, `configFonte` = `PADEL_CONFIG.SUPABASE_URL` di qua e di là, zero errori di pagina, **uscita 0**. 🧪 **E le guardie NON sono state date per buone perché non avevano protestato**: sulla corsa di PROD `richiesteBloccate` era **vuoto** — l'app quel tentativo di scrittura semplicemente non l'ha fatto — quindi sono state **esercitate apposta**, con bersagli innocui anche nel caso peggiore (una tabella inesistente, una lettura verso l'altro database). Esiti: `PATCH` su PROD **bloccata**; contatto verso `cudi…` dalla pagina di PROD **bloccato** come «DATABASE DI UN ALTRO AMBIENTE»; **controprova positiva** — la lettura legittima passa, ruolo `readonly` — che serviva, perché senza di essa «blocca tutto» si legge come «funziona»; e il sabotaggio d'ambiente (dichiarare `test` servendo la pagina di PROD) si ferma **prima** dello snippet, **uscita 1**. 🚧 **Detto per intero, due volte.** ⓐ In quel sabotaggio il *no* l'ha pronunciato la **PRIMA** guardia, non la seconda: le richieste al database estraneo vengono abortite così presto che il login fallisce prima che si arrivi al confronto dichiarato/reale ⇒ **il ramo di ripiego della seconda guardia resta non esercitato**, ed è lo stesso limite che la 21ª si era già annotata. Non chiuso: da questo attrezzo non si costruisce una pagina che esponga una fonte e non l'altra. ⓑ Nel sabotaggio `hostSupabaseContattati` elenca **entrambi** i database, e non è un buco: il controllo comportamentale gira **prima** dello snippet, quindi un contatto incrociato provocato **dallo snippet stesso** viene bloccato e registrato ma non fa fallire la corsa — registrato, non subìto |
| **29** | 📦 *(15/08, 20ª sessione — chiusa **DICHIARANDO**, su sua delega esplicita: «decidi tu»)* **Le azioni email restano dentro `assessment-email-send`.** Le 11 azioni del canale ritirato ci sono ancora, ma sono murate in **tre punti indipendenti**, misurati e non ricordati: il `410` esce alla riga 2607 **prima** del controllo delle ammesse; `ALLOWED_ACTIONS` ne ammette **4** e nessuna è del canale email; e il cron `jobid 4` — **l'unico posto in tutto il database** che nomini quella edge — è `active = false`. Sul vivo: **0 invocazioni in 24 ore** su PROD, con controllo negativo (2344 righe viste nella stessa finestra, e una funzione da 14 chiamate trovata) ⇒ lo zero è vero, non cieco. ⚖️ **Perché dichiarare e non asportare**: non c'è un guasto da riparare, e il taglio **non sarebbe per nome** — `sendAssessmentEmailCore` e i suoi porti (Gmail, MIME, log) sono **gli stessi che serve `staff_invite`**, che è vivo e usa Gmail. Tagliare per somiglianza di nome dentro un file che ha già un problema di codice morto (voce 28) vorrebbe dire fare due potature intrecciate invece di una decisa. 🚨 Resta scritto ciò che **non** si tocca: la funzione non si cancella, i secret Gmail non si tolgono, e il default di `action` è `'send'` — cioè un'azione **ritirata**: chi chiama senza `action` prende un 410, non «azione non valida». Se un domani il canale email deve tornare, si rimettono le azioni in `ALLOWED_ACTIONS` e si riaccende il cron: niente è stato distrutto. |
| **11bis** | ⛔ *(15/08, **ANNULLATA** dal committente a fine 19ª sessione — non fatta, e la differenza conta)* **Il bottone che CREA IN MATCHPOINT chi ha solo l'ID `PMO-`.** Sua idea del 2/08. ⚖️ **Aveva già perso urgenza il 3/08 e la scheda lo diceva**: la visibilità di quei soci era stata curata **alla radice** (PROD 6.169), quindi non era più una riparazione ma **una scelta** — e la scelta, oggi, è no. 📌 Resta qui e non sparisce perché una voce tolta senza il perché torna: il giorno in cui a qualcuno riverrà l'idea, questa riga dice che è già stata guardata, che il problema sotto **non c'è più**, e che il bottone sarebbe una comodità, non una cura |
| **13** | ⛔ *(15/08, **ANNULLATA** dal committente a fine 19ª sessione)* **Il ragionamento del modello, in inglese, dentro il messaggio al socio.** Visto da lui il 29/07, **1 volta su 24**. ⭐ **Il valore della voce non era il difetto, era il punto cieco che aveva rivelato, e quello resta scritto**: era la 21ª trappola vista dalla strada della **prosa**, mentre i test guardavano **i bottoni**. È la stessa lezione che il 15/08 ha fatto scoprire i gemelli della voce 23 — un banco che prova la regola e non ciò che l'utente vede davvero. ⚖️ Annullata perché **la frequenza non giustifica il lavoro** (1/24, cosmetica, nessun dato sbagliato al socio), non perché non fosse vera |
| **23** | ⛔ *(15/08, chiusa dalla 19ª sessione — salita dalla coda il 14/08, scritta dalla 17ª, collaudata dal vivo dalla 18ª)* **«`writeBookingJob` in `create` non guarda com'è andata» — e il titolo ammetteva due letture, tutt'e due vere.** ① La funzione scartava l'esito del proprio `upsert` mentre la sorella dieci righe più su lo controlla: non una convenzione del file, una dimenticanza. ② **Il terzo esito veniva raccontato come il secondo**: gli esiti sono *fatto*, *non fatto* e **non lo so**, e l'ultimo veniva scritto «errore» — lo staff legge «fallita», rifà, e se la prima era passata il campo resta prenotato **due volte** sul sistema del circolo. 📌 Il commento nel codice lo sapeva già (*«NESSUN retry: la prenotazione potrebbe essere già stata creata»*): quello che mancava non era il retry, era **dirlo**. 🛑 **E la scheda sbagliava bersaglio**: diceva «la correzione è nell'app», mentre `writeBookingJob` ha **0 occorrenze** in `index.html` e vive nella edge. 🎯 **La cosa più importante l'ha detta il codice, non io: la macchina dell'ignoto NELL'APP C'ERA GIÀ** dalla v6.150 — la regola del committente *«quando l'esito resta IGNOTO non si indovina, si va a GUARDARE su Matchpoint»* coi tre verdetti `si`/`no`/`boh`. Il difetto non era una mancanza, era **una porta murata davanti a una stanza già arredata**. ✅ **Fatto:** l'errore di rete **marchiato** su una proprietà (non sulle parole — sarebbe il setaccio a maglie larghe della voce 36, e c'è un caso di prova apposta), il lavoro chiuso **`unknown`**, la strada sincrona che risponde `WORKER_ESITO_IGNOTO`, l'app che **insiste** 3 minuti invece di guardare una volta sola, e la domanda che si **deposita** e viene ripresa a ogni apertura. 🚨 **Ma il valore di questa voce è ciò che ha insegnato il COLLAUDO DAL VIVO, in produzione, insieme a lui** — e sono tre cose che nessun banco verde aveva visto. ① **La trappola scritta nel documento è scattata davvero**: fermare il worker **non basta**, davanti c'è **Caddy** che risponde **502**, e un 502 è *una risposta* ⇒ il terzo esito non nasce. Ecco spiegati due mesi di storico — **184 lavori, 16 `error` tutti 5xx, zero `unknown`**: non era un caso raro, era **impossibile**. Si ferma **Caddy**, e il cancello (`curl` prima e dopo) è obbligatorio perché la prima versione era **cieca**. ⚠️ Costo dell'assenza di quel cancello: **tre prenotazioni vere** create la notte del 14/08 credendo di collaudare, tutte annullate. ② **I GEMELLI (6.223 → 6.224)**: le strade di creazione sono **tre** e la correzione ne toccava **una** — lui prenota col clic sullo slot e ha ricevuto il messaggio vecchio. È la voce 31, commessa da me; il banco era verde perché provava la **regola** e non il **cablaggio**. ③ **LA RIPRESA SI ARRENDEVA IN SILENZIO (6.224 → 6.225)**: agganciata a `staffCalInit()`, usciva con un `return` muto se la sessione staff non era ancora pronta — *provare una volta sola nel momento peggiore e arrendersi in silenzio*, cioè il difetto che questa voce toglie dal guardare, **rimesso nella cosa che doveva ripararlo**. 🔍 E funzionava già: lo dimostrava `pmoVerificheInSospeso = []` nel `localStorage`, che **solo** la chiusura definitiva può scrivere — mancava che lo **dicesse**. ✅ **Chiusa il 15/08 col terzo residuo (PROD 6.226)**: il lavoro non resta più `unknown` nel database dopo che l'app l'ha risolto. La edge ha l'azione **`chiudi-lavoro-ignoto`**, la decisione sta nel modulo puro (il banco la **esegue**), e la chiamano tutte e quattro le strade. 🔒 Si chiude **solo** ciò che è `unknown`: la parola del worker — che ha visto la cosa da vicino — non la sovrascrive l'app, che ha guardato il calendario da fuori. ⚖️ Il `boh` non chiude niente, o sarebbe il terzo esito arrotondato al secondo un piano più in là. ✅ Banchi **17/17** e **29/29** (12 casi nuovi), **15/15** Node, browser **55/55** su `main` e **90/90** su TEST, e **tre sabotaggi** che li fanno diventare rossi (28/29, 16/17, 15/17). PROD letta **dal server**. ⇒ **Resta la sola parte B**, e non è più «da non fare»: ha una procedura scritta e una finestra misurata (vedi qui sotto fra le note). 📊 E una misura che vale come prova al contrario: **0 lavori appesi a `pending` su 191** in due mesi — il «lavoro fantasma» che il codice teme è un rischio del disegno che non si è mai realizzato, e dice che questa voce aveva guardato **dove doveva** |
| **40** | 🔴 *(15/08, 19ª sessione — vista in produzione dalla console del committente il 14/08 sera, promossa da lui a «prima cosa della prossima ripresa»)* **`assessment_tokens.updated_at` non esisteva su PROD, e la RPC la scriveva lo stesso: `400` a ogni cambio di stato manuale dello staff, dal 22/05.** 🔎 **L'origine ha una data, e non è di stamattina**: la migrazione `20260522120000` aggiunge `status_autovalutazione` e, dentro `update_assessment_token_status_admin`, scrive `updated_at = now()` **dando per scontato** che la colonna esista. Su TEST esisteva davvero — là `supabase/manual-sql/supabase_schema.sql` era stato applicato per intero, e alla riga 21 la dichiara — su PROD no. ⇒ Quella RPC su PROD **non ha mai funzionato**: non un caso raro, il **100%** per quasi tre mesi. 📊 **Misurato prima di toccare, e le due metà sono il controllo l'una dell'altra**: PROD, 22 ore di log, **40 POST → 400 e zero 200**; TEST, le stesse ore, stessa app, stessa RPC, **4 POST → 200**. Su PROD la colonna la nomina **una sola** funzione, questa. E riprodotto **sul bersaglio per la strada dell'app** — JWT di uno staff vero, transazione annullata — con lo stesso `42703` letto nella sua console. ⚠️ **Cosa costava, ed è più sottile di «un bottone rotto»**: gli stati che si VEDONO su PROD (`PRIMO_SOLLECITO`, `GESTIONE_MANUALE`…) li scrive `assessment-email-send` con un `PATCH`, che `updated_at` non lo tocca — quindi funzionavano. A non arrivare mai al cloud era **solo il cambio di stato fatto a mano dallo staff**, che restava nel `localStorage` di quel browser. Un pezzo sano accanto a uno rotto è il modo migliore per non vedere quello rotto — la stessa forma dell'11/08. E **tre dei quattro** punti di chiamata fallivano in **silenzio** (`console.error` e nient'altro). ✅ **Riparato, strada scelta da lui fra due proposte**: si aggiunge la **colonna**, identica a quella di TEST (`timestamptz not null default now()`), invece di togliere la riga dalla RPC — così è la produzione a tornare uguale a ciò che il repo dichiara, non il contrario. È la stessa cura delle 5 colonne di `pmo_parser_errors` del 14/08. ⭐ **E le 1364 righe già in tabella NON dicono «aggiornata oggi»**: il default avrebbe scritto `now()` in tutte, cioè 1364 date false — proprio il «documento che mente» che in questi giorni si sta togliendo di mezzo. Si è ricostruita la data **vera** (`greatest` dei timestamp noti): misurato dopo, **0 righe** con data di oggi, l'arco va dal **25/04** al **10/08**. 🔎 **Trovato per strada e sanato con lui, perché è la stessa cosa**: su PROD `assessment_tokens` e `self_assessments` **non avevano nessun trigger**, mentre la funzione `assessment_touch_updated_at` c'era già — impronta `77cd2033…` **identica** a quella di TEST. Mancava solo il cablaggio, come nella voce 23. Rimessi i due `updated_at`; senza, la colonna si sarebbe mossa solo quando la RPC la scrive per nome, e una colonna che si aggiorna a volte sì e a volte no è peggio di una che non c'è. ✅ **Prova end-to-end sul bersaglio, in transazione annullata**: `42703` → **`{"ok": true}`**, stato `INVITO_INVIATO` → `GESTIONE_MANUALE`, `updated_at` 10/08 → 15/08. Linter **101 → 101**, `ERROR` **0**, nessun avviso nuovo; 1364 righe intatte. 🔗 Migrazione `20260815112211`, reversibile. ⛔ **Non toccato, e dichiarato invece che fatto di nascosto**: manca a PROD anche `trg_self_assessments_mark_token_completed`, che TEST ha. Quello non è un allineamento di schema ma un cambio di **comportamento** — brucerebbe il gettone da dentro il database, mentre su PROD lo fa la edge (misurato nella voce 27: 0,15 secondi dopo). Due strade che fanno la stessa cosa si guardano insieme, non si sommano di sfuggita: è sceso fra le «nate misurando» |
| **38** | 📡 *(14/08, chiusa dalla 17ª sessione — nata come nota dalla 14ª, promossa alla 16ª)* **`wa-shadow-proxy`: ~1540 chiamate a vuoto al giorno, disarmate e VERIFICATE.** Il pannello WhatsApp dello staff bussava una volta al minuto a una funzione **mai deployata da nessuna parte** — 623 404 al giorno su PROD, 619 su TEST — più un secondo temporizzatore, `wa_usage_stats` su `ayly…` ogni 300 s, **295 fallimenti al giorno**. Un canale **smontato il 25/07** di cui il gestionale non si era accorto: stessa famiglia delle voci 28 e 29. ⚖️ Rideployare non era un'opzione, e l'ha deciso la misura: su `ayly…` ci sono **zero** edge function e **zero** tabelle `whatsapp*`. ✅ **Disarmo minimo**: un `return` in testa a `waInit()` — il riquadro non si mostra, i due temporizzatori non partono, il codice resta dormiente — su **entrambi i rami** con lo **stesso identico blocco** estratto dal file vero (PROD **6.221**, TEST **6.231**), che è il punto della voce 31. La libreria testi e template resta viva. 🎯 **Ma il valore di questa voce non è il disarmo: è la CATENA DI PROVE FALSE che ci è voluta per crederlo, quattro in due giorni.** ① La prima sonda cercava in `edge_logs` e rispondeva **0**: le edge stanno in **`function_edge_logs`** — salvata dal controllo negativo. ② Poi i 404 sembravano fermi alle **18:26/18:29**, *prima* della cura, e la 16ª sessione ha fatto la cosa difficile: **ha rifiutato un risultato che la assolveva**, concludendo «non è la mia riparazione, è una scheda chiusa». ③ 🚨 **E anche quella era falsa**: i 404 **non si erano mai fermati** — ne arrivava uno al minuto ancora alle **19:31** — era una finestra di log che finiva lì, scambiata per la fine del traffico. ④ E alla ripresa la prima query ha risposto **0** di nuovo, perché cercava `request.path` invece di `request.pathname`: di nuovo il controllo negativo (2461 righe) a smascherarla. ⭐⭐ **La lezione, che vale più della voce**: lo scetticismo applicato **una volta sola** non è scetticismo, è un cambio di conclusione. Anche la prova che ti dà **torto** va ricontrollata — la 16ª si è fermata un passo prima, senza chiedersi se il dato su cui poggiava lo smascheramento fosse vero. 🔎 **La causa vera era banale e nessuno l'aveva nominata**: una scheda del gestionale rimasta **aperta col codice vecchio**. Una pagina già caricata non prende il codice nuovo finché non la si **ricarica**, e il buco nei log fra le 23:00 e le 10:00 era il computer chiuso per la notte, non il traffico che cessa. ✅ **CHIUSA con la prova che serviva, e non è un silenzio.** Alle **19:57** il committente ha ricaricato **entrambe** le schede — la firma è inconfondibile nei log (`pmo_get_my_staff_profile`, `pmo_ai_settings`, `pmo_lessico`, il websocket `101`) — e da lì: PROD **0** chiamate al proxy mentre l'app ne faceva **206** fino alle 20:05; TEST ultimo 404 alle **19:57:24** e poi **zero**, con **271** chiamate fino alle 20:05; `ayly…` ultimo fallimento di `wa_usage_stats` alle **19:56:24**. ⭐ **È silenzio CON L'APP CHE PARLA ACCANTO**, ed è esattamente ciò che mancava alle prove precedenti: il controllo **positivo**, non l'assenza di traffico. 📌 Il disarmo era stato verificato anche **sul file SERVITO** via `pg_net` — `200`, `APP_VERSION = '6.221'`, e il `return;` **nudo** dentro `waInit()`: controllato il **return**, non il commento, perché un blocco che *dice* di essere disarmato e non lo è sarebbe la peggiore delle prove comode. ⛔ **Resta fuori, dichiarato**: la potatura del riquadro (~150 righe di HTML) e del blocco JS `wa*` (~700), oggi irraggiungibili — è fra le «nate misurando», stessa forma delle voci 28 e 29 |
| **37** | 🔓 *(14/08, chiusa dalla 17ª sessione — aperta dalla 16ª, nata come nota il 12/08)* **Le policy di scrittura anonima rimaste: sette tolte, due lasciate con la ragione scritta.** 🚨 **La lezione della voce non sono le policy: è che due gruppi con lo STESSO aspetto avevano portata OPPOSTA**, e solo la misura li distingueva. Su TEST le tre `ALL` (`pmo_bookings`, `pmo_parse_history`, `pmo_parser_rules_versions`) sembravano «lettura e scrittura per anonimo» e sono risultate **decorative** — ad `anon` mancano i grant di tabella, e l'attacco rispondeva `42501` **prima** di qualunque modifica ⇒ la 16ª si è **fermata** e le ha tolte solo dopo, con la ragione giusta (`20260814191255`). Le tre della **famiglia feedback**, invece, su TEST erano **portanti davvero**: i grant ci sono (INSERT+UPDATE su `responses`, SELECT su `tokens`), e la prova d'attacco prima di toccare le dà **riuscite** — 2 gettoni letti, risposta scritta (`20260814194040`). ⇒ Un rattoppo «per parità» fatto senza rimisurare sarebbe stato **giusto per caso**. ✅ **Tolte in tutto 7**: 3 su PROD (famiglia feedback, e la terza — `SELECT` sui gettoni — **non la nominava nessuna nota**: è saltata fuori guardando la famiglia intera invece della singola tabella), 3 decorative su TEST, 3 famiglia feedback su TEST. 🔀 **E fra le due ultime c'è la voce 31 in diretta, con la mano della 16ª**: l'autorizzazione diceva «PROD» ed è stata eseguita alla lettera, lasciando la famiglia chiusa di qua e aperta di là — difetto che la sessione **si è auto-denunciata** invece di sanare da sé, e che la 17ª ha chiuso il giorno stesso. ⚪ **Le due «portanti» RESTANO, ed è una scelta misurata, non una rinuncia**: `pmo_ai_turns` e `pmo_parser_errors` scrivono con la chiave pubblicabile **solo come ripiego** quando la sessione staff manca — tutte le chiamanti stanno in schermate staff, e l'app **sale** al token staff quando c'è. Una riga di SQL esisterebbe (`to anon, authenticated` → `to authenticated`) ed è **proprio quella da non fare**: il ripiego ripara un guasto vero, dichiarato nel commento del codice — *«il token grezzo dava 401 quando era scaduto, insert silenziosamente perso»* — e toglierlo lo **ricrea**. ⚖️ Portata di ciò che resta aperto: inserire **spazzatura** in due tabelle di diagnostica, niente lettura e nessun dato del circolo; `pmo_parser_errors` è ferma dal **16/06**, `pmo_ai_turns` dal **13/08**. ✅ Prove: attacco come `anon` **prima e dopo su ognuna**, col **seme** che soddisfa la chiave esterna (senza, a fermarlo sarebbe il vincolo e non l'RLS), e il **controllo negativo**. Linter PROD **99 → 101**, TEST **92 → 95** e **95 → 97**, `WARN` ed `ERROR` invariati ovunque, ogni scarto **previsto e dichiarato prima** di applicare; i nuovi sono tutti `rls_enabled_no_policy` INFO, cioè l'esito voluto. Residui zero. 🧯 **Un errore mio, tenuto perché è il pezzo che insegna**: la prima sonda «dopo» dava `42501` anche sulla RPC legittima e sembrava dire che avessi rotto la strada vera — avevo aggiunto al blocco un `count(*)` che girava ancora come `anon`. **Era la sonda a essere cambiata fra il prima e il dopo**, e stavolta il risultato comodo era quello che mi dava *torto*. ⛔ **Resta fuori, e la voce lo dichiara**: il **TRUNCATE** ad `anon` (14 tabelle su PROD) — riguarda i **grant**, non le policy, e non era ciò che era stato autorizzato. È sceso fra le «nate misurando», dove le promozioni le decide il committente. 🔗 3 migrazioni: `20260814181002`, `20260814191255`, `20260814194040`, tutte reversibili |
| **39** | 🔀 *(14/08, 16ª sessione — promossa da lui)* **Le TABELLE dei due progetti, censite e dichiarate** in [`docs/divergenze-tabelle-test-prod.md`](../divergenze-tabelle-test-prod.md). È il gemello della voce 33, un piano sotto: là le funzioni SQL, qui le tabelle. PROD **25**, TEST **23**, in comune **20**: **17 identiche**, **3 divergenti**. 🎯 **E il censimento ha trovato un guasto vivo in PRODUZIONE, che era il suo scopo:** `pmo_parser_errors` ha 9 colonne su PROD e **14** su TEST, e dalla **PR #648 del 7/08** l'app di `main` **scrive `origine`** a ogni segnalazione e **legge** `stato`, `risolto_il`, `risolto_in_versione`, `nota_risoluzione` per il pannello «Le mie segnalazioni» — colonne che su PROD **non esistono**. Provato sul bersaglio: **`42703`** in lettura, in scrittura e sulle quattro del pannello ⇒ su PROD nessuna segnalazione del parser poteva essere registrata (e falliva in **silenzio**: `console.warn`, `return false`) e quel pannello non poteva caricare. ✅ **Riparato in giornata, strada scelta da lui**: le 5 colonne aggiunte a PROD verbatim da TEST (migrazione `20260814183100`). Prova **end-to-end via PostgREST**, stessa URL e chiave dell'app: **400 `42703` → 200 `[]`**; impronta delle colonne di PROD ora **identica** a quella censita per TEST prima di toccare niente; linter 101 → 101, `ERROR` 0; 45 righe storiche intatte. ⚖️ **Ma non è la causa del silenzio della tabella**, e la misura ha smentito la mia ipotesi: le 45 righe sono **tutte del 16/06**, cioè due mesi **prima** del disallineamento. Sono due fatti distinti, e vanno tenuti distinti. 🔎 **La divergenza che la campionatura non poteva vedere**: `assessment_tokens` ha **13 colonne da entrambe le parti**, ma non le stesse — `member_email` solo su PROD, `updated_at` solo su TEST. Col solo conteggio sarebbe rimasta invisibile: per questo si confronta l'**impronta**. ✅ Confermate le 4 colonne di `self_assessments` già viste il 14/08: la campionatura diceva il vero. 🔗 **Chiude un cerchio della voce 33**: `admin_settings` esiste **solo su PROD**, e su PROD **esattamente una** funzione la nomina (`upsert_assessment_tokens_admin`) mentre su TEST **nessuna** ⇒ non sono «due depositi del PIN in PROD e uno in TEST», è un deposito in più che vive solo di là, con la sua unica lettrice. ⛔ **Non misurati, e il documento lo dichiara**: indici, vincoli, default, trigger, policy e contenuti — due tabelle qui dette «identiche» possono avere trigger diversi, ed è successo davvero con quello che ha avuto un ruolo nella voce 37 |
| **36** | 🔎 *(14/08, 15ª sessione — promossa da lui)* **Le 45 funzioni `SECURITY DEFINER` chiamabili da `anon` su PROD, passate in rassegna. Undici erano aperte.** Nata dalla 27, che ne aveva scoperte due. 🚨 **La prima classificazione era sbagliata, ed è il pezzo che vale più delle funzioni chiuse**: avevo diviso in «24 che scrivono / 21 che leggono» cercando `insert|update|delete` nel sorgente — ma **far partire una chiamata HTTP non è una scrittura SQL**, e sette `pmo_dispatch_*` stavano fra le «letture» mentre fanno `net.http_post`. Ne avevo chiusa **una su otto** credendo di aver chiuso la famiglia. ⇒ Una funzione si classifica per **cosa provoca**, non per quali parole contiene. 🎯 E il pezzo peggiore non scriveva né chiamava nessuno: **`pmo_verify_data_routine_secret(text)`**, che confronta un candidato col segreto nel vault e risponde sì/no ⇒ da `anon` è un **oracolo a tentativi illimitati** sul segreto che autorizza tutte le routine; con quello in mano le edge si chiamano dritte. Non sarebbe comparso in nessun elenco di «funzioni che scrivono», per costruzione. 🔴 **Chiuse 11**: i **7 dispatcher** (pagamenti ×2, portafoglio, contatti Google, maestri, avvisi autovalutazione, lessico AI), **`pmo_dispatch_data_routines`** (faceva partire la catena dei cron, `p_now` a scelta del chiamante), **`pmo_cleanup_dispatch_logs`** (`DELETE` senza guardia: con `0` cancellava **1457** righe di storia dei dispatch), **`pmo_audit_admin`** (falsificava il registro di controllo — provato come `anon`: scritta «`presidente@padelvillage.club` · `owner` · `staff_delete_full`») e l'**oracolo**. ✅ **Guardate e a posto**: tutta la famiglia `*_admin` risponde **`AUTH_REQUIRED`** — provata come `anon`, non dedotta — più `INVALID_ORIGIN` e i cancelli a gettone. ⚪ **Aperta per disegno**: `pmo_can_register_staff`, oracolo di enumerazione ma chiamata dalla schermata di **registrazione**, dove nessuno è ancora autenticato. 🔀 **Su TEST due erano già chiuse e su PROD no**: è la **voce 31 al contrario**, e sul resto della famiglia TEST era un rattoppo a campione senza criterio. 🚨 **Trappola `service_role`, incontrata TRE volte oggi**: su PROD i grant sono espliciti e il `revoke ... from public` non li tocca, su TEST spesso passano da PUBLIC ⇒ la stessa revoca glieli toglie. Su TEST si rimisura **dopo**, contro la fotografia presa **prima** — non contro PROD. ✅ Linter di PROD, quattro fotografie diffate: **123 → 125 → 121 → 99**, `WARN` 109 → **83**, `ERROR` **0** sempre; spariti 26 avvisi, esattamente 13 funzioni × 2 ruoli, **nessuno nuovo**. ⛔ **Non esaminate**: 3 letture per gettone e la robustezza del PIN. 🔗 4 migrazioni `2026081416*` |
| **27** | 🔒 *(14/08, 15ª sessione)* **Il cancello dell'autovalutazione è chiuso davvero — e la prima chiusura non bastava.** Punto 1 fatto **da lui**: scheda vera compilata su `app.padelvillage.club` col gettone `TEST456`, quiz 3/4 con la trappola indovinata (soglia **3** ⇒ `pass`), riga con `corretta_dal_server: true`, gettone bruciato dall'edge **0,15 secondi dopo**. ⭐ È quella riga a dimostrare che PROD serve la **6.220**, non l'etichetta della scheda: la 6.219 scriveva da sé con la chiave pubblicabile e non avrebbe potuto scrivere quel campo. ⇒ Poi il **passo 4**: tolte le **4** policy di scrittura anonima (3 di INSERT su `self_assessments` + `public_update_token_completed` su `assessment_tokens`, che la scheda non nominava). ✅ Verificato: `anon` → **42501**, `service_role` → scrive. 🚨 **E lì sembrava finita, e non lo era.** Facendo il rito «cosa punta a questa riga» prima di togliere la scheda di prova, è saltata fuori **`submit_self_assessment_public`**: `SECURITY DEFINER`, eseguibile da `anon`, **scavalca l'RLS per costruzione** e prende `staff_status` dal payload — se manca resta **vuoto**, cioè lo stato in cui `apply-level` applica da sé. Provato come `anon` in transazione annullata: livello **7** scritto, segreteria vuota, nessun `knowledge` ⇒ in `decidi()` il controllo sul quiz **non viene proprio fatto**. Le policy non la riguardavano nemmeno. ⇒ `EXECUTE` revocato a `public`/`anon`/`authenticated` su **PROD e TEST** (là il passo 4 era stato dichiarato completo il 14/08 con una verifica **giusta e insufficiente**: guardava l'RLS). `service_role` conserva l'esecuzione — su TEST è stato rimesso con una migrazione di parità, perché là il grant non era esplicito. ✅ `anon` → **42501 permission denied**; linter **125 → 121** avvisi, `WARN` 109 → **105**, `ERROR` **0**, spariti esattamente i 4 attesi e **nessuno nuovo**. ⚪ `get_self_assessments_by_tokens` non toccata: è lettura e l'app la usa (`index.html:30062`). 🧹 Residuo della prova ripulito: scheda tolta (salvata per intero nel commit) e `TEST456` riarmato a `created`. 🔗 3 migrazioni `2026081416*` |
| **24** | 🔔 *(14/08, 14ª sessione)* **Il raddoppio dell'ultimo avviso di disdetta è ACCESO, su PROD e su TEST.** La decisione che la voce aspettava l'ha presa lui: `disdetta.avvisi_ore_prima_scadenza_bis = 1`. 🔎 Scheda **confermata di nuovo**: il codice c'era davvero (`avvisi.ts`, `TIPI` con `finale_bis` dall'11/08), la colonna `finale_bis` su `ayly…` pure, e la chiave **mancava su entrambi** — i due oggetti `disdetta` erano identici e nessuno dei due la conteneva. 🚨 **La scheda però non diceva la cosa che contava**: la kb finisce **in pasto al modello** (`conoscenza` → `readmodelKb`), e la sua prosa dichiarava «**Tre** promemoria… l'ultimo 6 ore prima» con `quanti_avvisi: 3`. Accendere la sola chiave avrebbe fatto **mandare quattro avvisi al bot mentre ne dichiarava tre ai soci** ⇒ chiave, `quanti_avvisi` e testo corretti **nello stesso istante**. ✅ Verificato dando la kb VERA in pasto al codice VERO: momenti `primo` (5g), `secondo` (3g), `finale` (−6h), `finale_bis` (−1h). E 61/61 verdi nella rete di regressione del bot. ✅ **Nessuna raffica**: misurato prima di accendere che 0 prenotazioni stavano nella finestra del bis; la prima scadenza utile è del 15/08, quindi il primo raddoppio parte ~21 ore dopo. ⏱️ In servizio senza rideploy: la kb ha una cache di **30 secondi**. ⚖️ I due `disdetta` restano **identici byte per byte** (`330f2d22…`), com'erano prima. 📌 Il registro su `ayly…` ha `ambiente='prod'` per tutte e 11 le righe e `finale_bis` a **0**: il primo lo si vedrà lì |
| **35** | 🔒 *(14/08, 14ª sessione)* **Le due tabelle scoperte di PROD sono chiuse, e la rete di sicurezza è tornata dalla parte giusta.** 🔎 **Per la prima volta la misura ha confermato la scheda**, e su tutti i campi: 2 `ERROR` e solo quelli, 699 e 1 righe, RLS spenta con 0 policy, `anon` con SELECT/INSERT/UPDATE/**DELETE**/TRUNCATE, le sorelle `_pmo_riassegnazione_*` coperte, `ensure_rls` presente **solo** su TEST. Fatto il rito prima di toccare: **nessuna** vista, foreign key o funzione le nomina, nessun riferimento nel repo fuori da `docs/`, e `pg_stat_user_tables` su una finestra di **128 giorni** conta 8 e 4 seq_scan in tutta la loro vita — l'ultimo dei quali era la mia stessa `count(*)` di dieci minuti prima. ⇒ ① **RLS accesa** senza policy: `anon` **0/0**, `authenticated` **0/0**, `service_role` **699/1** (provato con `set local role` in transazione annullata, non dedotto) e il linter di PROD **da 2 `ERROR` a ZERO**. ⇒ ③ **`ensure_rls` installata anche su PROD**, verbatim da TEST: impronta normalizzata `2ab30ec5…` **identica** sui due progetti, e provata sul vivo — una `create table` poi annullata nasce con l'RLS accesa da sola. 🐛 **Coda inattesa, trovata dal linter dopo l'installazione**: `rls_auto_enable()` era `SECURITY DEFINER` **eseguibile da `anon`**, e provandolo la chiamata **riusciva davvero**. Portata reale nulla — nessun argomento, e fuori contesto il ciclo gira a vuoto — ma `EXECUTE` revocato su **entrambi** i progetti, perché su TEST l'ACL era identica e quei due WARN ci stavano **da sempre** senza che nessuno li guardasse. Ora da `anon`: `42501 permission denied`. ⚠️ **Da ricordare**: ogni tabella nuova in `public` su PROD nasce ora **invisibile** ad `anon`/`authenticated`; se deve essere letta col ruolo pubblico, la policy va scritta a mano. 🔗 [`docs/divergenze-sql-test-prod.md`](../divergenze-sql-test-prod.md) e le 3 migrazioni in `supabase/migrations/2026081411*` |
| **33** | 🔀 *(14/08)* **Le funzioni SQL dei due progetti, misurate e dichiarate** in [`docs/divergenze-sql-test-prod.md`](../divergenze-sql-test-prod.md). PROD **64**, TEST **62**, in comune 58: **53 identiche**, **5 divergenti davvero**. 🚨 Il primo giro ne dava **28**, ma 23 erano **aria**: su TEST molte funzioni sono imbottite di migliaia di spazi dopo `AS $function$` — `pmo_get_staff_users_admin` è **30 volte** più lunga con lo stesso codice dentro. Si confronta normalizzando gli spazi, o l'impronta mente. Delle 5 vere: una **voluta** (la 32), due **innocue** (solo `public.` esplicito o meno), una da sanare **al contrario** — `pmo_assegna_codici_mancanti` ha i commenti del 9/08 su **TEST** e non su PROD, quindi è la copia buona a stare di là — e una **da guardare**, `upsert_assessment_tokens_admin`, che legge il PIN da `admin_settings` mentre `pmo_admin_pin_ok` lo legge da `assessment_admin_config`: due depositi per lo stesso PIN, e non è TEST-vs-PROD ma un'incoerenza **dentro** PROD. Delle 10 presenti da una parte sola, tre sono **residui del canale email smontato** (parenti della voce 29) e una spiega perché su TEST i soci sono vivi col calendario fermo: `pmo_anagrafica_cron_key`, che serve il mirror dell'anagrafica **da PROD**. ⇒ Da qui è nata la **voce 35** |
| **32** | 🧊 *(14/08)* **Il calendario di TEST è congelato — ora è una scelta dichiarata, non un inganno.** Nata misurando la 22, promossa da lui, diagnosticata e decisa in giornata. La misura ha smentito perfino il titolo con cui era nata: non «fermo dal 7 agosto», ma **mai partito** — righe `data_routine_dispatch_bookings_live_*` **0 in tutta la storia** di `cudi…` contro **1575** su `qqbf…`; il 7/08 era solo l'ultimo import lanciato **a mano**. Tre disallineamenti sovrapposti, ognuno da solo sufficiente: il cron **spento** (jobid 13, fermo dal 3/08), l'argomento `<oggi 04:30>` che lo **inchioda** al ramo clienti anche da acceso, e la **funzione stessa diversa** fra i due progetti (`1609186e…` contro `e38984df…`). ⚖️ **Scelta la strada B: congelare e dichiararlo.** Il danno non era la vecchiaia del dato — era che **sembrasse fresco**: aveva già fatto aprire la voce 26 come guasto del bot e per poco cancellare una partita vera. Scritto in `CLAUDE.md`, dove ogni sessione lo legge prima di toccare TEST. Il riaccendimento è la **voce 34** in coda: costa poco (**+1,7%** sul worker, non il raddoppio che sembrava) ma va fatto **dal Mac**, coi log del worker sotto gli occhi |
| **22** | 🧹 *(14/08)* **Righe di prova su TEST: tolte 3 punti su 4, e il quarto non era rumore.** Tolte in modo **reversibile**, dopo aver misurato cosa ci puntava: le **4** `staff_edit` e la partita di prova 14/08 12:30 C4 messe a `deleted=true` (soft delete nativo, l'app non le vede più); **Lidia Comes** nella whitelist `test` messa a `attivo=false` — la gemella `prod` intatta. Il quarto punto non era una riga sola ma una **terna** — token `completed` + scheda `applied` + marcatore «già segnalato» `sa:ITBAOQWO8CB5KU` — e toglierne una su tre avrebbe **sporcato** la prossima prova invece di pulirla: rimosse insieme, salvate per intero nel messaggio di commit. ⚠️ Il livello di Aprea era **già tornato a 4** da solo: il mirror aveva fatto la sua parte. 🚨 **Il primo punto è uscito dalla voce**: «9305 del 13/08» erano **due** partite (9305 dell'11/08, 9306 del 13/08), **entrambe vere e presenti su PROD**, entrambe nate su TEST nello stesso istante di un lotto di sync — è scattata per la **prima volta** la clausola *«se risulta anche su PROD, fermati e chiedi»*, e la causa è diventata la **voce 32** |

Le prime 6 del 13/08 nella 12ª sessione, la **30** e quella dei conteggi in serata.


| — | 📚 **I tre registri di versione riallineati** (PR #674): `stato-progetto-corrente` era **689 versioni indietro** mentre chiedeva di credergli *contro* i prompt; `VERSIONI.md` senza voci 6.x → **188 ricostruite dai commit**, ognuna con PR, sha e data; `registro-versioni-sezioni` con **172 righe verso file spariti** → dichiarate e sostituite da un indice per area |
| — | ⛔ **Canale email dell'Autovalutazione disarmato su tre strati**: cron già spento, app (PR #675, PROD 6.217), edge potata con **410** (PR #676). Resta **solo l'invito staff** a mandare email |
| — | 🧹 **Via 5 pannelli e 8 bottoni morti** dell'Autovalutazione (PR #677, PROD 6.218) + **«Verifica Gmail» riparata** (regressione mia: l'avevo disarmata insieme al canale, era rotta **anche in PROD**) + tre testi corretti |
| — | 🧪 **Il banco Matchpoint rimosso** — i due bottoni rossi che creavano prenotazioni e clienti **veri** (PR #678, PROD 6.219). ⚠️ Non promozione a righe: i rami avevano **7 funzioni contro 4** |
| **25** | 📧 **Il canale email ai soci non è più «spento»: è SMONTATO.** La decisione che la voce aspettava è stata presa ed eseguita. Riaprirlo non è riaccendere un cron, è **rimontare un canale** |
| **19** | 🏠 **Destino di `soci.padelvillage.club`: chiuso.** Misurato il 13/08 — DNS **non risolve**, `ayly…` ha **ZERO edge function**. ⚠️ La voce diceva «login e identità vivi»: **era sbagliata**, il login è morto. Vivo solo `consumer-identity-lookup` su `qqbf…`/`cudi…` |
| — | 🔢 **Anche le chiuse si contano** (#686). `guard-docs-truth` sorvegliava le liste **vive** — urgenti e in coda — e lasciava fuori l'unica che **cresce** a ogni sessione. Il conto tornava, 7 dichiarate e 7 righe, ma **per diligenza**: nessuno lo imponeva. È la condizione esatta da cui è partita la sezione **C**, diligente anche lei e falsa lo stesso per mesi. Aggiunti **due** numeri (titolo di sezione e riga «Chiuse»), verificati per conto loro. ⚖️ Restano fuori i conteggi storici `~56` e `~41`: portano la **tilde** e le voci non sono più nel file ⇒ incontabili per costruzione, e un numero che si dichiara approssimato non promette nulla da verificare |
| **30** | 🛡️ **`docs/` ha due guardiani, non uno.** Nata in coda, promossa da lui e chiusa in giornata. **Parità** (`guard-worker-sync` esteso a `docs/`, #683): scoperto che 4 file divergevano — la #674 aveva curato i registri **solo su `main`** e su `test-preview` `stato-progetto-corrente.md` diceva ancora «PROD v5.527» del 22/05 con TEST a 6.222. **Verità** (`guard-docs-truth.yml`, #684): confronta il dichiarato col misurato — e alla prima esecuzione ha colto il registro che, curato la mattina, **la sera dichiarava già 6.216/6.217 contro 6.219/6.222**. ⚖️ Sono complementari: la parità non vede la **menzogna concorde**, la verità non protegge l'**altro ramo** ⇒ si tolgono insieme o mai |

*(Le chiuse dal 7/08 al 12/08 e quelle fino al 6/08 restano come nella fotografia del 12/08.)*

---

# 🧠 Memorie tematiche

## Gmail / email del gestionale

> **`assessment-email-send` non è solo il canale email: il nome inganna.** Dentro vive
> l'amministrazione utenti staff — `staff_invite` (manda una mail **vera** con Gmail:
> `getGmailAccessToken` + `sendGmailMessage`) e `staff_delete_full` (elimina l'utente in `auth`,
> non spedisce).
>
> 🚫 **Non togliere i secret Gmail**: spegneresti l'invito staff.
> 🚫 **Non cancellare la edge**: perderesti l'eliminazione utente.
>
> ✅ `gmail-check` è **esente** dal disarmo, in app (`PMO_ASSESSMENT_EMAIL_ACTIONS_ESENTI`) e in
> edge (`ALLOWED_ACTIONS`): sono **gemelle, si cambiano insieme**. Alimenta «Verifica Gmail» in
> Amministrazione › Utenti, **l'unico posto da cui si ricollega Gmail quando il token scade**.
> Senza, l'invito si rompe e **non si ripara dall'app** — e il suo messaggio d'errore rimanda
> proprio lì, in un cerchio chiuso.
>
> 📌 Il **connettore Gmail di claude.ai non c'entra**: è uno strumento della chat. L'app usa
> credenziali proprie su Supabase (`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`).
> Il 13/08 stavamo per riconfigurare Gmail su una diagnosi falsa: le credenziali erano sane, era
> il blocco a impedire il controllo.
>
> 📌 Dove è finita l'Autovalutazione: il socio riceve il **link personale dal bot Telegram**
> (`consumer-assessment-link`), lo staff è avvisato da `assessment-notify-staff` (cron ogni 5'),
> il livello è applicato da `assessment-apply-level` (cron ogni 15').

## Lezioni di metodo

> **La documentazione non ha un guardiano.** `guard-worker-sync` protegge worker, workflow e
> `CLAUDE.md`. `docs/` no — e infatti tre registri hanno mentito per tre mesi mentre uno si
> autoproclamava «fonte rapida ufficiale» e chiedeva di credergli *contro* i prompt. **Una fonte
> che si dichiara autorevole e non è verificata è peggio di nessuna fonte.**
>
> **Disarmare per ambito, non per nome.** `gmail-check` è stata spenta perché stava nella stessa
> funzione del canale email: apparteneva invece all'invito staff. Prima di disarmare, chiedersi
> **a chi serve**, non **dove sta**.
>
> **Il fix che resta su un ramo solo non protegge.** La sicura dei bottoni Matchpoint fu scritta
> su TEST il 3/08 e mai promossa: per dieci giorni in PROD gli stessi bottoni sono rimasti senza.
>
> **Misurare batte ricordare, e il clone può mentire.** Il 13/08 il clone era *shallow*: la storia
> partiva dal 2/08 e mostrava `VERSIONI.md` come «creato quel giorno con 387 righe» — era il bordo
> del troncamento. `git fetch --unshallow` (1950 commit dal 25/04) ha rimesso i conti a posto.
>
> **Una sonda può cambiare ciò che misura, e allora il rosso è suo.** *(15/08)* Il banco
> `handle-test.html` dava **24/55** con 31 eccezioni `localStorage null` — ripetibile, quindi
> credibile. Non era il codice: era il mio runner, che **interrogava la pagina mentre il giro
> era in corso** (`waitForFunction`, poi `evaluate` ogni 3 secondi). Lo stesso codice, con un
> runner che aspetta **alla cieca** e legge **una volta sola alla fine**, fa **55/55**. ⇒ Prima
> di attribuire un rosso al lavoro di qualcuno, chiedersi **cosa fa lo strumento al bersaglio**:
> qui il baseline era rotto quanto il fix, e un A/B fra due misure sbagliate sarebbe sembrato
> pulito — 24 contro 24, «nessuna regressione». Vera la conclusione, per la ragione sbagliata.
>
> **E la prova che il fix FA qualcosa va cercata a parte.** Il banco passa 55/55 prima e dopo:
> da solo non distingue «l'ho riparato» da «non ho toccato niente». Il controllo positivo è
> stato aprire l'app nel browser e guardare i due agganci: `undefined` prima, `function` dopo.
> Senza quello, la voce 31 si sarebbe chiusa su una rete verde che non aveva visto nulla.

> **Le prove dell'utente valgono più delle mie verifiche.** I due errori del 13/08 — «Verifica
> Gmail» disarmata e la parola sbagliata — non li ha trovati nessun test: li ha trovati lui
> aprendo l'app. Sintassi e rete di regressione erano verdi in entrambi i casi.
>
> **La scheda di un lavoro è un'ipotesi, non una misura.** *(14/08)* La voce 22 diceva «partita
> **9305** del **13/08**, riga di prova»: erano **due** partite, la 9305 dell'11/08 e la 9306 del
> 13/08, **entrambe vere e presenti su PROD**. Numero, data e natura: tre campi su tre sbagliati, in
> una scheda scritta tre giorni prima da chi c'era. Eseguirla alla lettera avrebbe cancellato dati
> del circolo — e sarebbe sembrato un lavoro fatto bene. ⇒ La riga è finita nel prompt di apertura.
>
> **Il sintomo sta in cima alla lista, la causa non sta in lista affatto.** La 22 chiedeva di
> spazzare quattro righe; sotto c'era uno **specchio fermo da una settimana** che ne sporcava 2721.
> Chi esegue il compito scritto non trova mai la causa: la trova solo chi **misura il contesto**
> della riga che sta per toccare. Il rito «misura cosa punta a quella riga» serve a non fare danni;
> misurare *perché* quella riga è com'è serve a **trovare il lavoro vero**.
>
> **Un sintomo in due posti è una causa sola.** La voce 26 («il "Fatto" del togli non si vede»,
> aperta come guasto del bot) e il primo punto della 22 erano lo **stesso** fatto: su TEST nessun
> sync riconcilia. In PROD lo stesso codice si auto-corregge in due minuti. Prima di aprire una voce
> per un componente, chiedersi se il vicino ha già lo stesso male.
>
> **«Ipotesi, non misura» non vuol dire «probabilmente sbagliata».** *(14/08, 14ª sessione)* La
> scheda della 35 ha retto su **tutti** i campi: due `ERROR` e solo quelli, 699 e 1 righe, `anon`
> con DELETE e TRUNCATE, le sorelle coperte, `ensure_rls` solo su TEST. Dopo tre smentite di fila
> la tentazione era leggere il rito come un modo per cogliere in fallo chi ha scritto la scheda:
> non lo è. Serve a **sapere**, e sapere che è giusta vale la stessa misura che scoprire che è
> sbagliata — con la differenza che stavolta si è potuto eseguire senza esitare.
>
> **Chi tappa un buco ne apre uno più piccolo, e deve guardare.** *(14/08)* Installato
> `ensure_rls`, il linter ha alzato due WARN che prima non c'erano: la funzione era `SECURITY
> DEFINER` chiamabile da `anon`. Sarebbe passata liscia — l'obiettivo dichiarato era «i due
> `ERROR` spariti», e quelli erano spariti. Il diff **prima/dopo di tutti e 123 gli avvisi**, non
> solo dei due che si volevano chiudere, è ciò che l'ha fatta vedere. ⇒ E aprendola si è scoperto
> che su **TEST** quella porta era aperta **da sempre**: un difetto nuovo in un posto è spesso un
> difetto vecchio nell'altro.
>
> **Un banco più permissivo della produzione dà FIDUCIA SBAGLIATA.** *(14/08, 14ª sessione)*
> L'edge dell'autovalutazione è stata deployata su TEST con **14 suite verdi** e non è mai
> partita: `Identifier 'pmoLivelloFascia' has already been declared`. Dal browser si vedeva solo
> «Failed to fetch» — una funzione che non fa il boot non risponde nemmeno con un errore.
> ⭐⭐ Il motivo per cui il banco non poteva vederlo: `vm.runInContext` esegue il codice come
> **script**, e in uno script ridichiarare una funzione è **lecito**; Deno lo carica come
> **modulo**, dove è fatale. Il banco girava in un mondo più largo del vero, quindi poteva solo
> dire di sì. ⇒ Un banco che gira in condizioni più larghe della produzione non è debole: è
> **peggio di non averlo**, perché verde e inutile è la condizione in cui nessuno va a guardare.
> La cura: il blocco ora si analizza **come modulo**, e la prova ha il suo controllo negativo.
>
> **Guardare un solo database è scrivere metà query.** *(14/08)* Subito dopo, la stessa edge ha
> risposto 500: la `select` citava `member_email`, che c'è su **PROD** e **non su TEST**. Come
> `self_assessments.email`, `consistency_score`, `inconsistency_reasons`, `review_note`. ⇒ **Le
> due tabelle divergono**, ed è la voce 33 un piano più sotto — là erano le funzioni SQL, qui
> sono le TABELLE, e di queste non se n'era accorto nessuno. Chi scrive per i due ambienti
> scrive sull'**intersezione**, e la verifica su entrambi prima di spingere.
>
> **«Failed to fetch» è il nulla travestito da errore.** *(14/08)* Ha fatto perdere un giro
> intero di prove: il browser non poteva dire altro, e la funzione non scriveva niente. La
> diagnosi è arrivata in un minuto **dai log di Supabase**, non dallo schermo. ⇒ Da lì in poi
> gli errori del database finiscono in `console.error`: al socio una frase comprensibile, a chi
> indaga il motivo vero.
>
> **CINQUE guasti, e li ha trovati tutti LUI provando.** *(14/08, voce 27 passo 3)* L'edge è
> stata pubblicata su TEST **sei volte** (6.223→6.228) prima di funzionare. I guasti, in ordine:
> ① dichiarazione doppia ⇒ non faceva il boot; ② colonne che esistono solo su PROD ⇒ 500;
> ③ funzione spostata senza il suo albero (`cleanCell`) ⇒ moriva la consegna; ④ stringa vuota
> in colonna `numeric` ⇒ la scheda non si salvava per un campo secondario; ⑤ la fascia ricavata
> senza il parsing dell'app ⇒ **`skip` silenzioso**, il socio rispondeva a tutto e finiva in
> segreteria senza che nessuno vedesse un errore.
> ⭐⭐ Il filo che li lega tutti e cinque: **il mio banco constatava, non eseguiva**. Girava come
> script invece che come modulo, esercitava solo il quiz e mai il calcolo del livello, e usava
> la forma del dato che immaginavo io invece di quella che manda il modulo. Ogni volta era
> verde, e ogni volta era il committente ad aprire l'app e vedere il rosso. ⇒ Non è «poca
> attenzione»: è che **una funzione mai chiamata non rivela le sue dipendenze mancanti**, e un
> ramo mai percorso non rivela niente di sé.
> 📌 Il rimedio è nel repo, non in questa riga: `test/assessment-quiz.test.mjs` ora ESEGUE il
> calcolo, analizza il blocco come modulo, prova il vuoto e prova le due forme del livello —
> ognuna con il suo controllo negativo.
>
> **Un file mente anche con l'estensione.** *(14/08)* La PR verso `main` è stata bocciata da
> `deno check` con **36 errori**: il blocco del cancello è JavaScript e stava dentro un `.ts`.
> Non era forma — era una contraddizione insanabile: il banco lo **esegue** in una VM, quindi
> tipizzarlo rompeva le prove e non tipizzarlo rompeva la CI. Le due cose non potevano stare
> nello stesso file, e infatti non ci stavano. ⇒ Separato in `conoscenza.js`. E il banco ci ha
> guadagnato: da un modulo vero non si estrae **a fette cercando marcatori di testo**, si
> importa — e quelle fette mi avevano già tradito due volte nello stesso pomeriggio.
>
> **Quando stubbi qualcosa, chiediti cosa smette di essere controllato.** *(14/08)* Seconda
> bocciatura della stessa PR: 5 errori sui tipi di `supabase-js`, invisibili in locale perché
> avevo sostituito `createClient` con uno stub che torna `any` — cioè avevo stubbato **proprio
> la cosa che porta i tipi**. ⇒ È la TERZA volta in un pomeriggio che il banco è più permissivo
> del vero (script invece di modulo, ramo mai eseguito, tipi stubbati) e la terza volta che
> **verde non voleva dire niente**. La cura è stata prendere lo stesso pacchetto da **npm**,
> che il proxy non nega, e riprodurre i 5 errori prima di correggerli.
>
> **Un errore che non si sa leggere costa più del guasto.** *(14/08)* Un'eccezione non catturata
> la risponde il runtime, non la funzione: 500 **senza CORS** ⇒ il browser dice «Failed to
> fetch», che è il nulla. Tre giri di prove per arrivare a un `ReferenceError` che il server
> conosceva dal primo istante. ⇒ Rete sotto tutto, e il motivo vero nel log: il quarto e il
> quinto guasto sono stati diagnosticati **in un minuto** invece che in un'ora.
>
> **Chi non può aprire l'app può ancora bussare dal database.** *(14/08)* La rete della sessione
> cloud nega le chiamate a `*.supabase.co`, ma `pg_net` parte da dentro Postgres e ci arriva.
> ⇒ Da qui in poi un'edge si prova **senza aspettare una persona**: `net.http_post` e la
> risposta in `net._http_response`. È ciò che ha chiuso gli ultimi tre guasti senza fargli
> ricaricare la pagina sei volte.
>
> **Una funzione si classifica per COSA PROVOCA, non per quali parole contiene.** *(14/08,
> voce 36)* Per passare in rassegna 45 funzioni le ho divise in «scrivono» e «leggono»
> cercando `insert|update|delete` nel sorgente. Sembrava rigoroso ed era un setaccio a maglie
> larghe: **far partire una chiamata HTTP non è una scrittura SQL**, e sette `pmo_dispatch_*`
> sono finite fra le «letture» mentre fanno `net.http_post` verso le edge. Avevo chiuso una
> funzione su otto della stessa famiglia **credendo di aver chiuso la famiglia**, che è la
> forma peggiore dell'errore: non lascia un buco, lascia un buco e la convinzione di averlo
> tappato. ⇒ Un classificatore per parole chiave è un punto di partenza, **mai** una misura.
>
> **Il pezzo peggiore non scriveva niente.** *(14/08)* `pmo_verify_data_routine_secret`
> confronta un candidato col segreto nel vault e risponde sì/no: da `anon` è un oracolo a
> tentativi illimitati sulla chiave che autorizza tutte le routine. Non scrive, non chiama
> nessuno, non compare in nessun elenco di «funzioni pericolose» — e con quello in mano ogni
> altro cancello è aggirato. ⇒ Cercare *chi fa danno* non basta: va cercato anche **chi dice
> qualcosa che non dovrebbe dire**.
>
> **Un avviso ripetuto 47 volte non è un avviso.** *(14/08)* Tutte e 13 le funzioni chiuse
> oggi erano già nel linter, sotto due titoli soli — `anon_security_definer_function_executable`
> e il gemello per `authenticated` — insieme ad altre decine identiche. Nessuno le aveva mai
> lette una per una, ed è ragionevole: 47 righe uguali sono rumore. ⇒ Un avviso che non si
> può **contare fino a zero** smette di essere letto. Il diff prima/dopo funziona solo perché
> si sa già cosa cercare.
>
> **Su TEST i permessi passano da PUBLIC, su PROD sono espliciti.** *(14/08, tre volte nella
> stessa sessione)* Ogni `revoke ... from public` su `cudi…` ha tolto a `service_role` un
> permesso che su `qqbf…` sopravviveva, perché lì il grant è esplicito in ACL. ⇒ Su TEST si
> rimisura **dopo ogni revoca**, e ci si confronta con la fotografia presa **prima** — non con
> PROD: `pmo_dispatch_assessment_apply_level` aveva già `false` da prima, e "ripristinarlo"
> sarebbe stato un cambiamento travestito da ripristino.
>
> **`SECURITY DEFINER` scavalca l'RLS: chiudere le policy non chiude la porta.** *(14/08, 15ª
> sessione)* Tolte le 4 policy di scrittura anonima su `self_assessments`, la verifica è stata
> fatta come si deve — `anon` → `42501`, `service_role` → scrive, linter diffato voce per voce — e
> **sembrava finita**. Non lo era: `submit_self_assessment_public` è `SECURITY DEFINER`, gira come
> proprietario e l'RLS non la riguarda. Prende `staff_status` dal payload e, se manca, lo lascia
> vuoto: livello 7 scritto da `anon` in tre righe di SQL, e `apply-level` l'avrebbe applicato in 15
> minuti. ⭐⭐ Il punto non è che mancava una verifica: le verifiche c'erano ed erano giuste. È che
> **erano tutte sullo stesso strato**. Chi chiude una porta deve chiedersi *quante ne esistono di
> quel tipo*, non *se quella è chiusa bene*. ⇒ E la stessa svista stava su TEST, dove il passo 4
> era stato dichiarato completo il giorno prima con la medesima verifica corretta e parziale.
>
> **Il rito «cosa punta a questa riga» trova cose che non c'entrano con la riga.** *(14/08)* La
> seconda porta non l'ha trovata un controllo di sicurezza: è saltata fuori mentre misuravo chi
> puntasse alla **scheda di prova da cancellare**, e la risposta conteneva tre funzioni con
> `self_assessments` dentro. Il rito serve a non fare danni cancellando; qui ha trovato il lavoro
> vero, come già il 14/08 con la voce 22. ⇒ Vale la pena farlo **anche quando si è certi** che
> nulla punti lì: il valore non è la risposta, è l'inventario che si è costretti a guardare.
>
> **Un controllo negativo mal fatto assolve l'imputato.** *(14/08)* Per provare che la 4ª policy
> fosse davvero pericolosa l'ho rimessa in una transazione annullata e ho rilanciato l'attacco:
> **0 righe**. Sembrava la smentita del mio stesso allarme. Era invece il mio controllo a essere
> sbagliato — avevo scritto un `where`, che legge una colonna, e la lettura è chiusa dal 12/08.
> Senza `where`: **1364 righe su 1364**. ⇒ Quando la prova ti dà ragione *troppo comodamente*, o
> torto troppo comodamente, la prima cosa da controllare è la prova.
>
> **Il linter lo diceva da sempre, in mezzo a 47 uguali.** *(14/08)* Le due funzioni scavalcabili
> erano già negli avvisi come `anon_security_definer_function_executable` — insieme ad altre 45
> con lo stesso identico titolo. Un avviso ripetuto 47 volte non è un avviso: è rumore, e il
> rumore lo si smette di leggere. ⇒ Il diff prima/dopo le ha fatte vedere in mezzo secondo, ma
> solo perché **si sapeva già cosa cercare**.
>
> **Togliere una riga di una terna sporca più che pulire.** *(14/08)* Il «socio di prova» erano
> **tre** righe legate — token `completed`, scheda `applied`, marcatore «già segnalato». Togliere
> solo quella nominata nella scheda avrebbe lasciato un token bruciato senza scheda: la prova
> successiva sarebbe fallita **per il residuo della pulizia**.

---

# ⚙️ Come si lavora, a seconda di dove si apre la chat

| | cloud (claude.ai / app) | Mac |
|---|---|---|
| GitHub, PR, CI | ✅ | ✅ |
| Supabase (cron, edge, SQL) | ✅ | ✅ |
| Repo, git, test Node, `controlla-sintassi` | ✅ | ✅ |
| **Memoria dell'app** | ❌ **non accessibile** | ✅ |
| VM Hetzner, worker, pm2, log | ❌ | ✅ |
| `.env` del bot, whitelist, ponti | ❌ | ✅ |
| Secret Supabase | ❌ (nessuno strumento) | ✅ dalla dashboard |
| `deno check` in locale | ❌ (solo in CI) | ✅ |
| Vedere l'app col login staff | ❌ | ✅ |

🚨 **In cloud il container viene riciclato**: quello che non è pushato si perde.

📌 **Questo file non va più allegato a mano.** Vive nel repo ed è citato in `CLAUDE.md`, che ogni
sessione carica da sola: chi apre una chat — dal cloud o dal Mac — lo trova già letto. È la cura
del buco del 13/08, quando la sessione è partita cieca e ha scelto da sé su cosa lavorare.

📌 **I due prompt — apertura e chiusura — stanno in [`prompt-apertura-chiusura.md`](prompt-apertura-chiusura.md)**,
qui accanto, dal 14/08. Erano tenuti a memoria, e quello di apertura mandava ancora ad aprire la
memoria `lavori-urgenti` **svuotata il giorno prima**: la sessione del 14/08 è partita cercando una
fonte che non esiste più. Stessa malattia dei tre registri, stessa cura — **scritto, nel repo,
accanto a ciò che descrive**.

📌 **Le memorie `lavori-*` sono in pensione dal 13/08/2026.** `lavori-urgenti`, `lavori-in-coda`,
`lavori-chiusi` e `lavori-chiusi-storico` — più le tematiche su Gmail e autovalutazione — vanno
svuotate e sostituite da un rimando a questo file. Il loro contenuto è **qui**, liste e memorie
tematiche comprese.
🚨 **Non riscriverci dentro le liste.** Due copie divergono, ed è esattamente la malattia curata
il 13/08: tre registri che dicevano il falso mentre uno si dichiarava «fonte rapida ufficiale».
⚖️ **Le altre memorie restano dove sono** — VM, `.env` del bot, chiavi SSH, decisioni personali:
il repo non le sostituisce, e chi svuota deve saper distinguere.
🖥️ Lo svuotamento **si fa dal Mac**: dal cloud la memoria dell'app non si tocca (tabella qui sopra),
e la sessione del 13/08 che ha scritto questa riga non ha potuto farlo da sé.

⚠️ **Chi lo aggiorna:** si aggiorna **durante il lavoro**, come gli altri documenti del repo, e
il commit resta nella storia (`git log docs/lavori/README.md` dice quando una voce è nata e quando
è stata chiusa). Le **promozioni dalla coda alle urgenti le decide il committente**, mai la sessione.

---

<sub>Aggiornato il 14/08/2026 a fine **17ª sessione**, la quinta dello stesso giorno. Chiuse **due**
voci, la **37** e la **38**, e nessuna promossa: le urgenti scendono da 3 a **1**. La **23** è stata
scritta, pubblicata su TEST e poi **promossa a PROD** (6.222) su conferma separata — resta aperta
perché la caduta vera del worker non è provabile da qui. La sessione è partita trovando `docs/`
disallineato e `guard-worker-sync` **rossa** su `test-preview` — la 16ª aveva spinto la propria
chiusura là e non l'aveva portata su `main` — e la prima cosa fatta è stata sanare quello. La **37** è stata prima
sanata e poi chiusa: tolto il residuo che la 16ª si era auto-denunciata — le 3 policy della famiglia
feedback su TEST, dove però la misura ha smentito l'aspettativa mostrandole **portanti** e non
decorative — con prova d'attacco a sonda identica prima e dopo, previsione del linter dichiarata
prima (95 → 97) e zero residui. Le **due portanti** restano, e la voce si chiude **dichiarandole**:
misurando il codice è saltato fuori che la «riga di SQL» esiste (`to anon, authenticated` →
`to authenticated`) e che è **proprio quella da non fare**, perché il ripiego ad `anon` ripara un
guasto dichiarato nel commento del codice e toglierlo lo ricrea. ⇒ La scheda diceva «è lavoro, non
una riga di SQL»: la misura ha smentito anche quello, e nel verso che conta — non è che il lavoro
sia più piccolo, è che la scorciatoia sarebbe **un passo indietro**. Il `TRUNCATE` ad `anon` non è
sparito con la voce: è sceso fra le «nate misurando», perché le promozioni le decide lui. Della **38** è stata smentita la misura della 16ª: i 404 **non si sono mai
fermati**, ne arrivava uno al minuto ancora alle 19:31 da una scheda aperta col codice vecchio, e
il disarmo — verificato sul file **servito**, sul `return` e non sul commento — è giusto: la prova
che manca è un **ricaricamento**, non un'attesa. Della **23** è stata scritta la diagnosi e **non**
la patch, per sua decisione: la scheda sbagliava bersaglio (è nella edge, non nell'app), i due rami
divergono, e la correzione tocca la strada che prenota davvero, non verificabile dal cloud.
📌 Quanto segue è la chiusura della **16ª**, lasciata come l'ha scritta:</sub>

<sub>Aggiornato il 14/08/2026 a fine **16ª sessione**, la quarta dello stesso giorno. La lista urgenti era **vuota**: le quattro promozioni le ha decise il committente, su proposta fatta a misura già presa. Chiusa **una sola** voce, la **39** — il censimento delle tabelle dei due progetti — perché è l'unica verificata sul bersaglio fino in fondo. La **38** è chiusa, e la sua storia vale più del suo contenuto: quattro prove false in due giorni prima di poterci credere, e la quarta era la smentita della terza. A chiuderla non è stata una sonda più fine ma **lui che ha ricaricato le due schede alle 19:57** — dopodiché i 404 sono spariti *mentre l'app continuava a chiamare*, che è il controllo positivo che mancava a tutte le prove precedenti. La **37** resta aperta con un residuo che è colpa mia: la famiglia del feedback è chiusa su PROD e **ancora aperta su TEST**, perché l'autorizzazione diceva «PROD» e l'ho eseguita alla lettera — giusto rispetto al mandato, sbagliato rispetto al sistema, ed è la voce 31 in diretta. La **23** è stata prima diagnosticata e poi, su sua richiesta, **scritta e pubblicata su TEST**
(6.232): la scoperta che vale è che la macchina dei tre esiti nell'app **c'era già dalla v6.150**,
come regola sua, e che la edge le murava la porta davanti chiamando «errore» ciò che non sapeva.
Poi, su sua conferma separata, **promossa a PROD (6.222) a righe e non a file** — distinzione che
qui pesava, perché `main` non ha `scheda-di-prova.ts` e copiare avrebbe portato in produzione il
ramo «prova a vuoto» del 7/08. Resta **aperta** per una cosa sola: la **caduta vera del worker** non
è provabile né dal cloud né su TEST, dove la creazione è simulata e il worker è uno solo condiviso.
⚖️ Se chiuderla o tenerla aperta lo decide lui: il lavoro è finito, la prova no. Versioni, sha, PR aperte, linter dei due progetti e tutti e otto i conteggi **rimisurati alla chiusura**, non ricordati; PROD verificato **dal server** con `pg_net`, non dall'etichetta. La sessione girava dal cloud: VM, worker, `.env`, secret, ponti e memoria dell'app non sono stati misurati — e con loro **il gestionale col login staff**, che stavolta pesa il doppio, perché il disarmo cambia proprio ciò che lo staff vede. I conteggi di questo file e le versioni dichiarate nei registri sono verificati dalla CI (`guard-docs-truth.yml`); la parità fra i rami da `guard-worker-sync.yml`. Le promozioni dalla coda alle urgenti le decide il committente.</sub>
