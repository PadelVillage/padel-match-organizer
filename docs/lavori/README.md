# Padel Match Organizer — i lavori

**Fotografia del 21/08/2026, a fine 46ª sessione.** Misurata, non ricordata.

## 🔎 Il filo della 46ª: **una scheda descrive il difetto che qualcuno ha VISTO**

Il committente ha promosso quattro difetti misurati la notte prima, ognuno con la sua scheda. **Due
schede su quattro dicevano meno di quello che c'era**, e la differenza non si vedeva rileggendole:
si è vista andando a misurare il bersaglio.

| | la scheda diceva | la misura ha detto |
|---|---|---|
| **64** | l'avviso *«arriva anche a chi il gesto l'ha fatto»* | è arrivato a **quattro** persone, e **tre non avevano toccato niente** |
| **63** | *«spostare una partita lascia gli inviti attaccati al vuoto, in silenzio»* | e un invito così può **riagganciarsi a una partita nuova sullo stesso slot**: qualcuno entra in campo dove nessuno l'ha invitato |

⚖️ Non erano schede sbagliate: erano scritte **da chi aveva visto il difetto succedere**, e uno
vede la parte che gli è capitata davanti. La 64 l'ha vista lui sul proprio telefono — quindi la
scheda racconta **il suo** messaggio, non i tre che erano partiti verso altre persone.
⇒ *Chi scrive una scheda racconta il punto da cui guardava. La misura serve a trovare gli altri.*

🚨 E la conseguenza pratica non è «diffidare delle schede»: è che **la cura cambia forma**. Sulla
64, una guardia legata a **chi agisce** avrebbe curato per intero il caso della scheda e lasciato
in piedi i tre avvisi agli estranei — cioè avrebbe curato la metà visibile e lasciato quella che
fa la figura peggiore. Le due domande si fanno **per partita**, e quella decisione viene dalla
misura, non dal difetto raccontato.

## 🔎 Il secondo filo della 46ª: **la diagnostica mancava proprio dove il guasto colpisce**

La voce **66** (`PLAYER_ID_NOT_LOCKED`) non si è potuta curare, e la ragione non è che il difetto
sia difficile: è che **il ramo in cui si presenta era l'unico senza diagnostica**.
`createBookingWithBrowser` allega `steps=[…] url=…` ai suoi errori da sempre;
`editBookingWithBrowser` faceva `catch (_e) { throw _e }`. I due fallimenti veri del 20/08 —
Fabiola alle 20:55:11, Lidia alle 22:36:48 — sono **tutti e due** su `edit-booking`.

📏 Dal registro si leggeva «Autocomplete non agganciato per: Lidia Comes» e nient'altro. I modi di
fallire sono **due** e hanno **due cure diverse** — la tendina che non compare mai, e la tendina
che compare ma lascia vuoto il campo nascosto — e da quella riga non si distinguono.

⇒ *Un guasto intermittente si diagnostica solo dove lascia traccia, e la traccia mancava proprio
lì.* Il lavoro della giornata su quella voce è stato **aggiungere la traccia**, non indovinare la
cura: l'ipotesi c'è (tre casi su tre col campo vuoto hanno **due** liste di autocomplete in
pagina), ma tre casi sono una correlazione, non una prova — e il worker è **uno solo, condiviso
TEST+PROD**, quindi ogni prova scrive sul Matchpoint vero.
📌 *Prima la misura, poi la riga* — e la voce si chiude quando quel fallimento sarà arrivato e
letto, non quando il codice «sembra a posto».

## 📌 Le decisioni prese dal committente nella 46ª

| | |
|---|---|
| ⬆️ **«promuovi tutte e quattro»** | a lista vuota, sulle quattro schede che gli ho messo davanti. ⇒ Urgenti da **0 a 4**, e sono le **63**, **64**, **65**, **66** |
| 🔎 **«solo la diagnostica»** sulla 66 | fra tre strade (diagnostica sola · diagnostica + cura ipotizzata · niente), ha scelto la prima. ⭐ È la scelta che questa casa raccomanda da sé: la cura poggiava su tre casi, e il worker scrive sul circolo vero |
| 🔀 **«fondi la 943 e poi la 944»** | l'ordine del 4bis, detto da lui. La guardia su `test-preview` è partita 20 secondi prima che `main` arrivasse, ha aspettato i suoi 90 secondi, ha riletto ed è passata: **la finestra di transizione, non drift** — che è esattamente il caso per cui il 14/08 è stata resa paziente |
| 🚀 **«fondi anche la 51»** e poi **«lancia tu»** | il deploy sul bot dei **soci**, con la parola `SOCI`, lanciato da qui. ⚠️ Nessuna delle due cure era stata guardata su un telefono: la scelta di andare in servizio senza anteprima è **sua**, dichiarata — come il 20/08 per le spunte |
| 📄 **«aggiorna i documenti»** | ⇒ questa sezione. Le quattro voci restano **urgenti**: tre sono curate e in servizio, ma la loro **cura** nessuno l'ha ancora vista succedere sul bersaglio |

## 🔎 Il filo della 44ª: **un caso che chiama il passo A MANO non prova il BOTTONE**

Il colpo più grave della giornata sarebbe passato, e il banco era **tutto verde**. Scrivendo le
spunte sul «togli un giocatore», un sabotaggio ha cambiato il `callback_data` del bottone
«👋 Togli i 2 giocatori» da *«chiedi conferma»* a *«esegui»*: **1320 casi su 1320 verdi**, e il
socio che tocca quel bottone si ritrova due persone fuori dal campo **senza aver confermato
niente**, su una scrittura che il bot sa fare e non sa disfare.

⇒ La ragione: il mio caso chiamava `schedaTogli({ tipo: 'chiedi_segnati' })` **a mano**. Provava che
*quel passo* chiede conferma — vero, e inutile — senza mai guardare **dove porta il bottone**.

📌 *Il socio non chiama funzioni: tocca bottoni. Fra il bottone e la funzione c'è un
`callback_data`, ed è esattamente il filo che si può scambiare senza che nessun caso se ne accorga.*
⚖️ Non è la 43ª (*il verde muto perché nessun caso arriva lì*): qui il caso **arrivava**, ma entrava
dalla **porta di servizio**. Un caso che entra dal retro prova la stanza, non la porta.
🔨 La cura è di una riga e vale per tutte le famiglie di bottoni: si legge il **dato** del bottone
(`leggiTogli(bottone.callback_data).tipo`), non il suo **testo**. Il testo è quello che promette, il
dato è quello che fa — la stessa distinzione che il 19/08 è costata la scheda doppione.

🔪 **E la seconda cosa, che rovescia l'uso dei sabotaggi: uno che non diventa MAI rosso a volte non
accusa il banco — accusa il CODICE.** Un colpo diceva «il gruppo esegue anche i segni di chi non è
più in partita» e restava verde. Guardando perché, quel filtro in `bot.ts` **non faceva niente**:
chi disegna la tastiera conta già partendo dai giocatori veri. Non era una rete in più, era una
**seconda regola che diceva la stessa cosa** — cioè il posto da cui il giorno dopo nasce una
divergenza. ⇒ Cancellata la riga, e cancellato il colpo con lei.
📌 *Un sabotaggio che non si riesce a far mordere è una domanda sul codice, non sul banco.*

🔁 **E la terza, gemella e opposta: un sabotaggio che smette di DESCRIVERE il codice dice «non
protetto» dove la protezione c'è.** Due colpi del banco del roster sono caduti a vuoto perché il
lavoro di oggi aveva spostato le righe a cui erano ancorati — e uno colpiva la riga **giusta nel
ramo sbagliato**, perché quella riga adesso esiste in due punti e la sostituzione prende il primo.
⇒ Ri-ancorati con il contesto che li distingue. *Un sabotaggio scaduto non è meno grave di un banco
cieco: la volta dopo nessuno lo legge.*

## 🎨 Il secondo filo della 44ª: **una scelta che si VEDE non si decide leggendo**

🗣️ Sue parole, dopo aver provato le spunte sul telefono: *«ho fatto un test con le spunte, però non
è che visivamente si capisca molto»*.

⇒ Il difetto **nel codice non si vedeva**: tutti i test erano verdi, e lo sono tuttora. La domanda
che apriva — *«quale forma si vede meglio?»* — non ha una risposta leggibile in un file: dipende dal
telefono, dal tema chiaro o scuro, dal font delle emoji di **quel** sistema, e dall'occhio di chi
guarda. ⇒ L'unico modo di rispondere è **metterle tutte in mano sua e fargliele toccare**.

⭐ Da qui `/stili` (`src/telegram/vetrina-stili.ts`): **otto forme, una bolla per ciascuna**, con
quattro nomi finti da toccare. Non è un usa-e-getta e non sta nel banco di prova: sta in `src/`
perché la forma scelta serve in **due posti** (l'invito e il «togli»), e averle in tabella vuol dire
che il giorno della scelta si cambia **una riga**.

📏 **Le tre misure che hanno disegnato le otto forme**, e nessuna si vedeva rileggendo il codice:

| | |
|---|---|
| **Telegram CENTRA il testo dei bottoni** | un segno messo solo a sinistra non fa una colonna: **sposta il nome**. Segnandone due in un elenco di quattro, gli altri **ballano** — e l'occhio legge il movimento invece della spunta |
| **il contrasto vero è di COLORE, non di forma** | `⬜` e `☑️` sono due quadratini della **stessa taglia**, e su parecchi sistemi il secondo è grigio-azzurro spento: resta un ticchio di pochi pixel |
| **c'è chi il colore non lo distingue** | perciò una delle otto regge in **bianco e nero** — il maiuscolo, dove a cambiare è la **sagoma** della parola |

🗣️ **Ha scelto la 2 e la 8**, e le due scelte insieme dicono una cosa che una sola non avrebbe detto:
**non è lo stesso segno per i due elenchi**. Sull'invito la spunta vuol dire *questo lo chiamo*
(`✅`); sul «togli» vuol dire *questo esce* (`👋`), e un verde direbbe «tutto bene» nel punto esatto
in cui bisogna leggere prima di toccare.

🗣️🚨 **E una lezione sul MODO di chiedere, pagata subito.** Alla domanda sulla conferma ha risposto:
*«non ho capito bene le domande che mi hai fatto. Puoi farmele più semplici?»*. La domanda era scritta
col vocabolario del progetto — «la forma a spunte ha tolto il passaggio di conferma» — cioè con le
parole di chi ha in testa il codice. Rifatta **con le schermate**, prima e dopo, e con una domanda
sola in fondo (*«dopo che tocchi «Togli i 2 giocatori», il bot deve chiederti ancora sei sicuro?»*),
ha risposto in una riga.
⇒ *Una domanda che chiede al committente di ricostruire il contesto non è una domanda breve: è una
domanda che gli fa fare il lavoro di formularla.* La forma che funziona è **mostrare i due schermi e
chiedere la differenza**, non nominare il meccanismo.

## 🔎 Il filo della 43ª: **un VERDE che sopravvive a un cambio di comportamento è un avviso**

Tre volte nella stessa sessione ho cambiato cosa il socio **vede**, e il banco è rimasto verde:

| | cosa è cambiato | il banco |
|---|---|---|
| ① | la schermata dopo un invito mandato — da «torna alla partita» a «resta sull'elenco» | **1272 su 1272 verdi** |
| ② | otto messaggi riscritti col vocabolario delle emoji | **1282 su 1282 verdi** |
| ③ | le etichette dei due bottoni gemelli | verde finché non ho scritto il caso apposta |

⇒ Ogni volta la ragione era la stessa e non «va tutto bene»: **nessun caso arrivava lì**. Il ① aveva
**un solo** test su quel ramo, e passava con **un amico solo** in rubrica — quindi cadeva sempre nel
ramo di ripiego — e per giunta **in collaudo la funzione esce prima**.
⚖️ Non è la 30ª (*la riga giusta che non difende niente*): quei casi difendevano davvero qualcosa,
solo **non quel pezzo**. Il verde era **vero e muto**, che è più insidioso di un verde bugiardo
perché non c'è niente da correggere — c'è qualcosa da **aggiungere**, e nessuno lo sa.

⭐⭐ **La cura NON è un caso per ogni messaggio: è una guardia della CLASSE.**
`test/vocabolario-emoji.test.ts` tiene 26 messaggi in tabella e quattro regole (il segno c'è · è
quello della sua famiglia · non è monocromo · titolo e dettaglio hanno **due pesi diversi**), più il
controllo del metro che costruisce a mano i tre difetti.
📌 *Un caso per messaggio difende i messaggi che qualcuno si è ricordato di elencare; una guardia
della classe difende anche quelli che scriverà domani chi non avrà letto niente di tutto questo.*

🩹 **E il corollario, pagato TRE volte e sempre scoperto da un rosso, mai rileggendo: non cambiare
le PAROLE dove serve solo l'EMOJI.** Ho scritto «Ci sto ancora lavorando» al posto di «Sto ancora
eseguendo», «Eri già uscito» al posto di «sei già uscito», e un titolo che duplicava «domani».
⇒ La disciplina giusta è **tenere le parole**, spezzarle in titolo + dettaglio, aggiungere il segno.
Si accorcia **solo** dove una parola è diventata ridondante col segno («Fatto:» davanti a un ✅).
⚖️ Lui aveva autorizzato ad accorciare — e proprio per questo la mano scappa: *un permesso a
cambiare non è un obbligo a cambiare*, e ogni parola toccata senza una ragione è una sua decisione
rovesciata di sfuggita.

🔁 **E la terza cosa, che vale oltre oggi: QUANDO UNA REGOLA VIENE ROVESCIATA, la domanda non è
«chi aveva ragione».** Un caso diceva *«le domande e i rifiuti restano SENZA grassetto: su un no è
alzare la voce»*. Il perimetro nuovo lo rovescia — ma quella ragione **non era sbagliata**, è stata
**risolta altrove**: a non alzare la voce su un no ci pensa adesso il **segno** (⚠️ o 🔧, mai ✅).
⇒ *La domanda giusta è: la cosa che la vecchia regola proteggeva, adesso chi la protegge? Se la
risposta è «nessuno», il rovescio è una perdita travestita da decisione.*

## 📌 Le decisioni prese dal committente nella 44ª

| | |
|---|---|
| 🗣️ **«non è che visivamente si capisca molto»** | ⇒ la vetrina delle otto forme (`/stili`). ⭐ Il difetto **non si vedeva nel codice**: tutti i test erano verdi, e lo sono tuttora |
| 🎨 **«scelgo la 2 e la 8»** | la **spunta verde** sull'invito e **il saluto** sul «togli». ⛔ Due segni diversi di proposito: `✅` dice «tutto bene», e sul «togli» sarebbe detto davanti a una cosa che non si torna indietro |
| ✅ **«sì, chiedimelo sempre»** | la conferma sul «togli» **resta**, ed è **una sola per tutto il gruppo**. ⚖️ Sull'invito la forma a spunte l'ha tolta, ma lì non ce n'era una da togliere: qui difende l'irreversibile ⇒ il gesto lungo diventa corto **una volta**, non zero |
| 🚀 **«si fondi e si deploy sul bot dei soci»** | detto **due volte**, per le spunte e poi per il «togli». ⚠️ Nessuna delle due era stata guardata su un telefono: la scelta di andare in servizio senza anteprima è **sua**, dichiarata |
| 🗣️ **«non ho capito bene le domande. Puoi farmele più semplici?»** | ⭐ vedi il secondo filo: una domanda scritta col vocabolario del codice fa fare a lui il lavoro di formularla. Rifatta **con le schermate**, ha risposto in una riga |
| 📄 **«si aggiorna i documenti»** | ⇒ questa sezione. Le tre PR del bot restano fra le 🆕 «nate misurando», **non promosse**: le promozioni le decide lui |

## 📌 Le decisioni prese dal committente nella 43ª

| | |
|---|---|
| 🗣️ **«uniformiamo le parole: se abbiamo messo togli un giocatore, anche invita un giocatore»** | ⭐ E la misura gli ha dato ragione oltre l'estetica: «amico» era l'**unica stringa visibile di tutto il bot** con quella parola, contro quindici che dicono «giocatore» — compresa quella **due centimetri sopra lo stesso bottone** |
| ⛔ **la forma corta («Togli» / «Invita») offerta da lui e NON presa** | ⚖️ gliel'ho detto con la ragione: collide con una **sua** decisione del 5/08 — su Telegram i bottoni sono tutti dello stesso colore, e «Togli», «Esci» e «❌ Annulla» stanno a un dito di distanza |
| 🎨 **«deve essere colorato in quanto tutto il resto è monocolore»** | ⇒ `➖` (U+2796) esce **nero**: era l'unica delle quattro `apertura()` senza colore. Scelta **👋** fra tre proposte |
| ✂️ **«leverei, che lo fai valere per tutti quanti, il fatto di chiama la segreteria»** | 📏 «tutti quanti» sono **due** messaggi, contati. ⭐ La ragione regge da sé: lì il socio non ha un problema **col circolo** ma con **una persona**, e la segreteria non può sapere perché |
| 🗣️ **«dopo che ho aggiunto un giocatore… però poi come proseguo?»** | ⭐⭐ **due lamentele, un difetto solo**: la frase prometteva «puoi invitare anche altri» e sotto ci metteva la **scheda della partita** — la strada per un'altra cosa |
| ⬜ **«decidere con una spunta chi voglio invitare… e poi un bottone sotto per l'invio»** | ⚖️⭐⭐ **rovescia la forma a un tocco che aveva scelto lui, e che IO avevo difeso** con un conto di tocchi (3 contro 4). Chiesto **dopo averlo visto dal vivo**: *una decisione presa guardando la cosa vera vince su una presa guardando un conto* |
| ⛔ **«📨 Invita tutti quelli che restano»: no, per ora** | manderebbe un messaggio **vero** a persone vere con un tocco solo e nessuna conferma |
| 🎨 **«gli emoticon vanno messi sempre. Il motivo? Così differenziamo un messaggio dall'altro»** | ⭐⭐ **la sua ragione detta anche COME sceglierle**: cento emoji diverse non differenzierebbero niente ⇒ **undici famiglie**, approvate da lui, non cento decorazioni |
| ✂️ **«dove puoi accorciare i testi fallo»** | ⚠️ e vedi il corollario del filo qui sopra: il permesso è stato usato **tre volte di troppo**, e ogni volta l'ha detto un rosso |
| 📄 **«segnati questo messaggio da correggere»** | ⇒ la voce sta fra le 🆕 «nate misurando», **non promossa**: le promozioni le decide lui |

## 🔎 Il filo della 36ª: **anche un difetto VISTO è un'ipotesi finché non si misura il bersaglio**

La 33ª mi ha consegnato un difetto che lui aveva visto con i suoi occhi — *«su una scheda dove la
partita è completa c'era la possibilità di mandare un invito»* — più **quattro strade già escluse**,
ognuna con la sua sonda. **Il difetto non c'era**: la partita non era completa, i giocatori erano
due, e me l'ha confermato lui.

⚖️ **Le quattro sonde della 33ª non erano sbagliate: stavano tutte a VALLE della stessa premessa.**
La scheda al completo · il roster più corto del vero · l'invio su una partita piena · le tre
prenotazioni al completo — tutte e quattro rispondono a *«perché il bot offre un invito su una
partita completa?»*, che dà per vera la parola **completa**. Nessuna guardava **se lo fosse**.
⇒ *Quando quattro misure indipendenti dicono «qui non c'è niente», la cosa da sospettare non è la
quinta strada: è la premessa che le tiene insieme.*

⭐ **E la sonda che ha chiuso in dieci minuti non era più intelligente: stava più a MONTE** — una
riga di SQL sul gestionale, prima ancora di aprire il codice del bot. È *il gestionale SA, il bot
DICE* applicato alla **diagnosi**: quanti giocatori ci sono su una partita lo sa il gestionale, e
chiederlo alla schermata che la racconta è chiederlo alla persona sbagliata.

👁️ **E a fare la differenza, ancora una volta, è stata una cosa che ha guardato LUI.** Gli avevo
chiesto quale schermata fosse, con quattro risposte a scelta: ha risposto «la scheda della partita»
— e poi ha mandato **lo screenshot**, che diceva un'altra cosa («👥 Gli inviti mandati») e per giunta
**nominava la partita**, che lui non ricordava. ⇒ *Il ricordo di una schermata è una descrizione;
uno screenshot è una misura.* Chiedere «quale?» costa una domanda; chiedere «me la fai vedere?»
costa la stessa domanda e ne risponde a tre.

🩹 **E una pista mia, scartata, perché scartata è un'informazione**: i due slot da due giocatori
hanno `durata: "1"` e quelli pieni `"1.5"`, e ho pensato a un formato a due. **Falso** — in un mese
su PROD ci sono **3** slot da un'ora in tutto, e **45** da un'ora e mezza con **un nome solo**.


## 🔎 Il filo della 33ª: **un disegno approvato descrive la FORMA, non le regole che attraversa**

Il mockup della voce 62 era approvato *«in pieno»*, e lo restava anche mentre lo si costruiva: il
difetto non era nel disegno. Era che **un disegno non può dichiarare le regole che tocca** — e
questo ne attraversava due, tutt'e due **sue**, scritte mesi prima e in un altro file.

| il disegno diceva | cosa attraversava |
|---|---|
| ⑥ e ⑦ sono schede come le altre | quelle due partite **non hanno una schermata per costruzione**: finiscono negli `scarti` proprio perché senza poteri, e la ragione scritta lì è *«una schermata senza bottoni è un vicolo cieco»*. Il disegno lo **risolveva** (ci mette la segreteria) — ma la scheda del lavoro lo chiamava «cablaggio», e chi si fosse fidato avrebbe riaperto quel vicolo una scheda alla volta |
| le frecce vanno sotto «❌ Annulla» | ci avrebbe messo il bottone **irreversibile** sopra quello che il pollice cerca per primo. ⚖️ E la contro-decisione era **già sua**, del 6/08: «⬅️ Torna all'elenco» sta **sopra** «Annulla», scelto guardando tre forme sul telefono |

⇒ Nessuna delle due si vedeva **rileggendo il disegno**: si sono viste **aprendo il codice che il
disegno tocca**. ⭐ *Approvare una forma non approva le regole che quella forma incontra: quelle
si vanno a rileggere una per una, e stanno sempre in un altro file.*

🔨 **E il secondo filo è nel banco: TRE casi su ventidue non difendevano quello che dicevano**, e a
dirlo non è stata una rilettura — è stato spegnere la riga e guardare. Il ⑨ provava la porta di
dietro invece dell'istante dopo l'azione; il caso del campo illeggibile cercava un bottone
**rotto** mentre il difetto è un bottone che **manca** (lo sfoglio si chiude a metà, in silenzio);
il terzo non guardava niente. ⚖️ È la 30ª di nuovo — *la riga giusta che non difende niente* — ma
in casa mia e **tre volte nello stesso file**, cioè non un incidente: la forma normale di un caso
scritto insieme al codice che deve sorvegliare.

🚨 **E una premessa della consegna era vecchia di due ore.** «Le tre correzioni non vivono, chiedi
dove mandarle»: erano **già sui soci dalle 11:41**, portate dal deploy di un'altra sessione che
spingeva lo stesso commit. ⇒ *Prima di chiedere un'autorizzazione, misurare se serve ancora* —
la domanda giusta fatta su un mondo scaduto è comunque la domanda sbagliata.

## 🔎 Il filo della 31ª: **cercare il POSTO invece di chiedere il RISULTATO**

La 30ª aveva trovato la sonda che parla della **propria posizione**. Questa ha trovato il difetto
gemello, e l'ho ripetuto **quattro volte di fila** dentro lo stesso problema: davanti alla domanda
*«con quale bot sto parlando?»* ho continuato a cercare **dove sta il token** — un file, un altro
file, l'ambiente del processo, il dump di pm2 — quando la domanda si poteva **fare a chi risponde**.

| ho detto | cos'era |
|---|---|
| «il token del bot di prova è nel suo `.env`, basta prenderlo» | **il `.env` non esiste.** Una **capacità dichiarata e mai provata** — la 26ª al rovescio, e costa uguale |
| «allora sta nell'ambiente del processo» | il processo gira, l'ambiente **non ha nessun token** |
| «allora nel dump di pm2» | **muto anche lì**. Tre cassetti, tre no, e ogni volta ho annunciato «trovata» |
| «`fonteVoce` dice da dove viene la voce» | **diceva da quale FILE**, non **a quale BOT**. Due cose diverse, e la seconda è quella che si vede sul telefono |

⇒ La riga che ha chiuso la partita è **`getMe`**: *chi parla non si deduce dal file, si chiede a chi
riceve.* ⚖️ E a vedere la differenza è stato **lui**, guardando lo schermo — *«è arrivato sul bot dei
soci, non su quello di test»* — mentre il mio registro rispondeva con sicurezza a una domanda
**vicina** a quella giusta. È la 22ª, e stavolta l'oggetto sbagliato l'ho guardato per quattro giri.

🚨 **E il difetto peggiore stava nella SCHEDA della voce, non nel codice.** La 59 prescriveva di
confrontare `source_sha` con la testa del ramo: preso alla lettera, l'allarme sarebbe partito quella
sera stessa su una copia **fresca al byte**. Era **la stessa malattia** per cui la strada `synced_at`
era già stata scartata — e l'avvertimento «⛔ non rifarla» stava **quattro righe sotto** la riga che
la rifaceva. ⚖️ *Scartare una strada non vaccina dalla sua parente: la cura era «leggere l'orologio»,
la ricaduta «leggere il numero d'ordine», e nessuna delle due guarda l'app.* A trovarlo è stato il
gesto di sempre — **misurare la premessa prima di scrivere la cura**.

🎯 **E la cosa che ha funzionato meglio di tutte è una riga di diagnostica.** Il primo giro sulla VM
diceva `fonteVoce: "nessuna"` e basta: un `catch { return '' }` muto, cioè **la malattia della voce
commessa dentro la sua cura** — un guasto che non dice cosa è andato storto. Fatto parlare, ha
risposto `file assente: /opt/…/.env` e da lì la diagnosi è avanzata da sola. ⭐ *Il tempo speso a far
dire a un guasto PERCHÉ si ripaga al primo giro dopo.*

🛡️ **In positivo, due meccanismi hanno fatto il loro mestiere senza che nessuno li guardasse.**
① Il deploy **si è rifiutato di dichiararsi riuscito** finché la sentinella non aveva misurato sul
bersaglio — ed è così che si è visto che era installata ma muta. ② Il banco ha preso **due difetti
veri** che rileggendo non si vedevano: l'avviso che spariva quando l'app rifà il `body` (cioè
**proprio il caso per cui la voce esiste**, con gli altri nove verdi) e il battito che partiva al
primo giro mandando due messaggi in un quarto d'ora.

⚖️ **E una regola sua, ottenuta insistendo contro di me**: *«continuo a insistere, non voglio un
terzo bot»*, detto **due volte**. La prima volta l'avevo scartato con un motivo debole — «igiene» —
e quel motivo mi ha impedito per tre giri di **guardare nella cartella accanto**. ⇒ *Un limite messo
per gusto costa quanto uno messo per errore, con l'aggravante che sembra prudenza.*

## 📌 Le decisioni prese dal committente nella 31ª

| | |
|---|---|
| ⭐ **«fai la B e poi la C»** | l'ordine dei pezzi, dato la sera prima. Rispettato: B fusa e viva, poi C |
| ✅ **«ok mergia»** | ⚖️ e copriva i **merge**, non il deploy sulla VM: quello gliel'ho chiesto a parte, perché il merge su `main` lo faceva partire da solo. Autorizzazioni separate, come sempre |
| 🔓 **«sì, mergia e installa disarmata»** | la VM toccata **sapendo cosa sarebbe successo**: si installa e misura, ma non può parlare finché non ha una voce |
| ❓ **«non ho capito perché dobbiamo creare un altro bot»** | ⭐⭐ **la domanda che ha smontato una mia proposta motivata male.** Gli avevo detto «igiene», che non è una ragione per aggiungere un pezzo — e la ragione vera l'ho trovata solo rispondendogli |
| 🚨 **«continuo a insistere, non voglio un terzo bot»** | **la seconda volta**, e aveva ragione: bastava guardare nella cartella del bot dei soci, che non avevo mai aperto |
| 🔎 **«penso che lo prenda su Supabase»** | ⚖️ pista ragionevole e **falsa**, chiusa misurando: `bot-telegram-admin` non è un bot ma un **ponte** — non chiama mai `api.telegram.org` e conosce solo lo *username*. Nessuna edge function ha un token |
| 👁️ **«è arrivato sul bot dei soci, non su quello di test»** | ⭐⭐ **la cosa che vede lui e io non avevo guardato**, per la nona sessione di fila — e qui il log non poteva dirla, perché rispondeva della domanda sbagliata |
| ✅ **il token del bot di prova nel secret** | ⇒ la sentinella parla da `@padelvillage_prova_bot`, **verificato con `getMe`** e non dedotto |
| 📦 **«chiudi la voce cinquantanove e aggiorna i docs»** | la chiusura, a cosa **vista sul telefono**: il messaggio arrivato dal bot giusto |

## 🔎 Il filo della 30ª: **la riga giusta che non difende niente — e la semplificazione che CANCELLA lavoro**

La 29ª aveva trovato la sonda giusta puntata sul soggetto sbagliato. Questa ha trovato il parente
più imbarazzante, perché stava **nel codice appena scritto e nel commento che lo spiegava**: una
riga **corretta, sensata, e inerte**.

| l'ho scritto | cos'era |
|---|---|
| in `offertaDelTest`: *«è `bottone: !!bottone` a impedire che la frase prometta un bottone assente»* | **falso.** Acceso il difetto (`bottone: true`) il banco restava **verde su tutti e 20 i casi**: quella protezione esiste già dal 9/08 **dentro** `frasePerIlTest`, che l'indirizzo se lo ricontrolla da sé. La riga dice il vero e **non difende niente** |
| il caso *«in nessuna delle quattro strade il socio resta senza niente da fare»* | 🔴 **rosso al primo giro, e il rosso era del CASO**: cercavo l'indirizzo *buono* anche sulla strada che ne porta uno storto. La 24ª — *la sonda che guarda nel cassetto sbagliato* — commessa in casa mia, dentro il banco che doveva difendere |
| il deploy dichiarava `Commit: cf7153fe…`, e il mio merge era `2a1c069` | **non era il nostro codice**: `cf7153fe` è il commit dell'**immagine del runner** di GitHub. Lo `head_sha` vero della corsa era `2a1c069` ⇒ allarme mio, chiuso **chiedendo all'API** invece di dedurre dal log |

⚖️ **La lezione non è «commenta meglio».** È che *una riga può essere giusta e non misurare niente*,
e a distinguerle **non è rileggerla**: è **spegnerla e guardare se qualcosa diventa rosso**. Il
commento sbagliato è stato **corretto invece che tolto**, perché la cosa da tramandare è proprio
che quella riga sembrava una difesa e non lo era.

🎯 **E il filo buono della giornata, che vale più del difetto: una sua semplificazione ha CANCELLATO
lavoro invece di aggiungerne.** Il perimetro stava crescendo — bottone + regole del rifare +
eredità dall'organizzatore con le 24 ore — e lui ha proposto: *«chi è invitato gioca senza livello;
chi vuole organizzare deve fare il test»*. Misurando, **quelle due cose erano già vere e già in
servizio**, e l'eredità **non era mai stata costruita** (`ereditato` = 0 su PROD). ⇒ Il pezzo più
grosso è sparito senza essere fatto.
⭐⭐ *Il modo più economico di chiudere un lavoro è scoprire che la regola che lo richiedeva non
serviva più.* E a vederlo è stato lui, non io: io stavo preparando il piano per costruirla.

🛡️ **E in positivo, la guardia che ha fatto il suo mestiere**: uno dei tre sabotaggi **non è
atterrato** (una regex in BRE su `grep` di macOS), e il controllo «è stato applicato?» l'ha
**fermato** invece di lasciarlo passare per verde. È la regola nata la 29ª, alla sua prima prova.

## 📌 Le decisioni prese dal committente nella 30ª

| | |
|---|---|
| 🗣️ **«parliamo della sezione dove c'è scritto il mio livello»** | ⭐ **la richiesta che ha aperto la giornata**, e il difetto lo aveva visto lui: chi il livello lo **chiedeva** leggeva «non ce l'hai» e basta. Il bottone del test nasceva solo per chi provava a **organizzare** |
| ✅ **«sì lo vedono tutti, si può fare il test ogni 30 giorni»** | il bottone aperto anche a chi un livello ce l'ha ⇒ e da lì è nato tutto il resto, perché **rifare** il test oggi fa **scendere** |
| ⚖️ **«si aggiungono»** | i 30 giorni **non sostituiscono** i tre tentativi: chi sbaglia affina, chi passa aspetta. La sua regola del 9/08 resta in piedi |
| 🚨 **«se lo sbaglia in negativo non scende, a meno che non lo sbagli tre volte consecutive»**, poi **«e la terza volta scende solo di 0,5»** | ⭐⭐ **la regola che protegge il socio dal proprio test**: oggi una scheda peggiore fa scendere **subito e per intero** (da 4 a 1). Nata da una domanda mia sul rischio, e la risposta è stata più fine della domanda |
| 🗣️ **«decidi tu a quale delle tre volte ti vuoi fermare»** | ⭐⭐ **il pezzo che non avevo capito**: non è un calcolo, è una **scelta del socio**, prova per prova. ⇒ L'automatismo che oggi applica da sé deve **smettere di decidere da solo** |
| 🔓 **«possiamo fare una cosa ancora più semplice»** (chi è invitato gioca senza livello) | ⭐⭐ **ha tolto dal tavolo il lavoro più grosso**: l'eredità dall'organizzatore, le 24 ore, la scadenza. Misurando, non era mai esistita |
| 🔎 **«abbiamo detto che chi entra prende il livello dell'organizzatore, ti torna?»** | ⭐ **mi ha chiesto di verificare invece di confermare**: la regola c'era davvero (sua, 9/08) **e non era costruita**. Due cose vere insieme, e sarebbe stato facile darne una sola |
| 🗣️ **«non una persona ma il maestro del circolo, tramite la segreteria»** | ⭐ correzione a una mia riga, e **sblocca un silenzio**: chi finisce `skip` oggi dal bot non riceve **niente**, perché *«un messaggio automatico direbbe una cosa che nessuno ha ancora deciso»*. Adesso è deciso ⇒ voce **57**, dal 18/08 dentro la **61** § C |
| 🔓 **«parti a sviluppare da dove pensi sia meglio»** | delega sul **punto di partenza**, non sullo scopo. Scelto il pezzo che sta tutto nel bot e non può far scendere nessuno |
| ✅ **«ok fai il merge»**, poi **«mandalo sul bot di prova»** | due autorizzazioni **separate**, una per volta, come sempre — e il bot dei **soci** non è stato toccato |
| 📄 **«quando hai finito aggiorna i docs»** | la chiusura di rito. Le regole del livello hanno un file loro: `docs/regole-livello-giocatori.md` |
| 🔴 **«non raggiungo più test»**, poi **«segnati subito, dopo fatto questo test, di aggiustare l'app di test»** | ⭐ **il posto in lista gliel'ha dato lui**, non io — ed è diventata la 58 |
| ❓ **«ma perché prod va?»** | ⭐⭐ **la domanda che spiega tutta la voce 58 in una riga**: PROD **ha già** l'app dentro il sito, TEST **va a prendersela** ogni volta. Una porta contro due |
| ❓ **«tu stai lavorando nel cloud di Claude, giusto?»** | 🚨 **ha smontato una mia conclusione**: dal Mac i miei `curl` escono dal **suo** indirizzo, quindi non potevano distinguere «GitHub è giù» da «la nostra rete è bloccata» → secondo filo qui sotto |
| ❓ **«che differenza c'è fra cloud e computer mio? Possiamo sceglierne una per sempre?»** | ⇒ la **regola scritta in `CLAUDE.md`**: cloud per git/Actions/edge/database/bot, Mac quando serve **guardare con i propri occhi** |
| 🔑 **«facciamo la chiave SSH»** | ⚖️ e **non c'era da farla**: esisteva già e funziona (`padel-matchpoint-bot-prod`, su da 85 giorni). Una mia nota del 12/08 diceva il contrario ed era **vecchia** |
| 🔓 **«sì»** (al permesso `ssh` per l'agente) | dato **dopo** che gli avevo detto che quella chiave entra come **`root`**. ⚠️ La regola vincola **la chiave**, non l'host: un prefisso non può guardare oltre le opzioni |
| ⭐ **«fai la B e poi la C»**, e **«facciamolo in una nuova chat»** | il seguito della 58 ⇒ **voce 59** |
| 🚨 **«stai attento perché c'è un'altra sessione che lavora in parallelo»** | e aveva ragione **due volte**: il conflitto è arrivato subito dopo |

## 🔎 Il secondo filo della 30ª: **una sonda che sta nel posto sbagliato — e il posto sbagliato è DOVE SEI TU**

Il primo filo parlava di una riga inerte. Questo è arrivato **da una sua domanda**, e riguarda una
cosa che nessuna rilettura avrebbe trovato: **da dove misuro**.

| dicevo | cos'era |
|---|---|
| «`raw` dà **429** anche su `torvalds/linux` ⇒ **GitHub è in avaria**» | la conclusione era **giusta**, la sonda **non poteva saperlo**: girando sul suo Mac, i miei `curl` escono dal **suo** indirizzo. Quella misura non distingue *GitHub è giù per tutti* da *la nostra rete è bloccata*. ⭐ A dirlo sono state due prove che **non passano da lì**: il log di un deploy (che gira sui computer di GitHub) e **`githubstatus.com`**, un altro host — **Partial System Outage**, API e Actions in *major outage*, incidente aperto dalle **13:40 UTC** |
| la cura della 58 «mette un ripiego» | il difetto era **più largo**: le pagine che morivano erano **due**. E il file che la seconda scaricava da `raw` **non è la scheda**, è un **rimando** ⇒ la catena era di **quattro salti, due su GitHub**. *Si chiedeva a GitHub il permesso di fare un salto che sapevamo già fare.* Ora ne fa **uno** e non chiede niente (#805, #806) |
| «la copia invecchia? basta leggere `synced_at`» | **falso, e scoperto leggendo il workflow prima di scrivere la cura**: `sync-app.yml` fa `exit 0` quando l'app non è cambiata ⇒ quel campo **non è un battito**, e su una copia fresca griderebbe al lupo. ⇒ La strada è **morta**, ed è scritta come morta nella voce 59 |

⚖️ **La lezione**: *una misura fatta dal Mac parla della rete del committente; per parlare del mondo
serve una sonda che stia altrove.* È la 24ª — la sonda che guarda nel cassetto sbagliato — nella
forma in cui **il cassetto sbagliato è la propria posizione**. ⇒ Ora sta in `CLAUDE.md`, accanto
alla regola su dove si lavora.

⭐⭐ **E il fatto che dà ragione alla cura, misurato e non argomentato**: `app.` e `test.` hanno
risposto **200 tutto il giorno**, avaria compresa. La porta su cui la 58 ha spostato TEST è
**rimasta in piedi**.

🚨 **CORRETTA LA SERA STESSA, e la correzione vale più della riga.** Qui c'era scritto *«fra i
componenti in avaria Pages non c'era»*: **era vero alle 17:10 e falso alle 18:30**, quando
l'incidente si è allargato e `Pages` è comparso nell'elenco insieme a Git Operations, API, Issues,
Pull Requests e Actions. ⇒ La frase invitava alla lezione sbagliata — *«Pages non cade mai»* — e a
smentirla è bastato rimisurare un'ora dopo.
⚖️ **Quello che regge è la distinzione, non il componente**: in tutta l'avaria **servire** le pagine
ha continuato a funzionare (200 sempre, anche con Pages dichiarato in avaria), mentre
**pubblicarle** era rotto — il deploy della 58 è fallito con *«is githubstatus.com reporting a Pages
outage?»* ed è servito rilanciarlo. ⇒ La cura regge perché TEST **legge** da Pages, non perché Pages
sia immune. Se un giorno cade anche il servire, cadono TEST **e** PROD insieme.
⭐⭐ *Uno stato letto una volta è una fotografia, non una proprietà: «X non era giù» scade, «X ha
risposto 200 mentre misuravo» no.*

🚨⭐⭐ **DUE SESSIONI SULLA STESSA VOCE, e il prezzo si è pagato.** Mentre la sessione cloud
pubblicava `app.html`, quella sul Mac aveva costruito **e provato nel browser** una soluzione
diversa. Al merge: **conflitto** — e poi un secondo conflitto un'ora dopo, perché nel frattempo lui
aveva **chiuso la 58** di là. La versione cloud è migliore (copia *primaria*, ETag, `sync-app.yml`)
⇒ la PR del Mac è stata **chiusa, non fusa**.
⚖️ *Il conflitto ha fatto da rete: senza quel rifiuto una sessione avrebbe sovrascritto il lavoro
dell'altra senza accorgersene.* È la 28ª, e stavolta ha protetto qualcun altro da noi.
📌 **Il pezzo del Mac che varrebbe la pena innestare**: il **tetto d'attesa** (`AbortSignal.timeout`)
sulle chiamate a GitHub. Un rifiuto arriva subito; un **appeso** lascia «Caricamento…» per sempre.

## 🔎 Il filo della 29ª: **la sonda giusta puntata sul SOGGETTO sbagliato — e il «non si può» mezzo vero**

La 24ª aveva trovato la sonda che guarda **altrove**; la 26ª il **limite dichiarato e mai provato**.
Questa le ha incontrate tutte e due nello stesso collaudo, e nessuna delle due si vedeva
rileggendo — sono venute fuori **eseguendo**.

| l'ho fatto | cos'era |
|---|---|
| il pre-volo del collaudo: ho letto l'ambiente del **bot dei soci** — `PROD`, `prenotazioni REALI` — e ho detto «siamo pronti» | la domanda era **giusta**, il **soggetto** no: la mano del committente era sulla chat del bot di **PROVA**, dove il worker non viene chiamato mai. Ha toccato «Confermo» e ha letto **«✅ Prenotato»**: la prova non falliva, **riusciva mentendo**. ⇒ La cura è meccanica, non l'attenzione: al secondo giro **non ho chiuso il cancello** finché non ho **visto nel registro** le sue righe (`/prenota → griglia`, `tocca: giorno 2026-08-29`) su **quel** bot |
| «dal cloud la VM non si raggiunge»: l'avevo appena riscritto io in due documenti | **mezzo vero**, che è la forma peggiore: vero della **shell**, falso di **GitHub Actions**, che sulla VM entra in SSH e ci lancia comandi qualunque — lo dimostrava il deploy del bot, girato tre volte quella sera. A rimetterlo in discussione è stato **il committente**, non io |
| la sonda del cancello: «Caddy fermato ma risponde ancora **HTTP 000000**» | **la sonda leggeva male SÉ STESSA.** `curl -w '%{http_code}'` stampa già `000` quando non si connette **e** esce con errore ⇒ il ripiego `\|\| echo 000` ne accodava un secondo. 🚨 La stessa riga stava in **quattro** sonde e in **tre** sbagliava nel verso che **rassicura** — il controllo positivo avrebbe detto «il worker c'è» a worker morto. Ed era **inerte finché curl riusciva**: verde in tutti i casi tranne quelli per cui esiste |

⚖️ **La lezione non è «controlla meglio».** È che tutte e tre le volte **qualcosa ha risposto**, con
sicurezza: la sonda dell'ambiente, il documento, il `curl`. ⇒ La domanda da farsi non è «cosa dice?»
ma **«sta rispondendo della cosa che sto per fare?»** — e stanotte la risposta l'ha data l'esecuzione
in tutti e tre i casi.

🎯 **E il primo sabotaggio della serata era INERTE, il che è la stessa malattia vista da dentro**:
il comando non aveva agganciato la riga, il banco restava verde, e sembrava un caso cieco. **Un
sabotaggio non applicato dà lo stesso identico verde di un caso inerte.** ⇒ Da lì in poi ogni
sabotaggio **verifica di essere stato applicato** prima di girare.

🛡️ **E in positivo: la rete progettata per il caso brutto ha retto al primo caso brutto vero.**
Quando la sonda ha sbagliato, il cancello **si è rifiutato di far prenotare** e il passo `always()`
ha riaperto Caddy **da sé in due secondi**. Il difetto era mio, e il meccanismo ha fatto esattamente
ciò per cui era stato scritto: fallire dal lato che non fa danno.

## 🔎 Il filo della 28ª: **un esito visto UNA volta non è una regola — può essere una GARA, una METÀ, o un altro SOGGETTO**

Le sessioni prima avevano imparato a diffidare della *prova* (16ª), dello *strumento* (20ª), della
*misura che concorda col documento* (22ª), dello strumento che guarda **un pezzo solo** (23ª) o
**altrove** (24ª), della *conclusione dedotta da premessa vera* (25ª) e del *limite mai provato*
(26ª). Questa ha trovato la forma che le tiene insieme: **si osserva un esito su un caso, e lo si
prende per la regola.** Tre volte in un giorno, e ogni volta ciò che variava era diverso.

| l'esito osservato | cosa era davvero |
|---|---|
| il controllo del deploy **verde sul bot di prova**, quindi «funziona» | era una **GARA**: `grep -q` chiude la pipe al primo riscontro, `echo` prende SIGPIPE e con `pipefail` l'intera pipeline risulta fallita **anche avendo trovato**. Log corto ⇒ `echo` finiva prima; log lungo (il bot dei soci) ⇒ vinceva grep. **Stesso codice, due esiti** |
| il pre-volo sui conteggi **verde**, quindi il file era a posto | era una **METÀ**: riproducevo 4 controlli della guardia su 8 — i titoli di sezione, non la tabella in cima. E una verifica che copre metà del controllo dà **lo stesso identico verde** di una completa |
| il push diretto su `main` **rifiutato a me**, quindi «la corsia non esiste» | era un altro **SOGGETTO**: sapevo che è chiusa per l'agente, non per il proprietario — le liste di scavalco esistono apposta. La risposta è arrivata solo **guardando la Bypass list** (vuota), non deducendola |

⚖️ **La lezione non è «prova due volte».** È che davanti a un esito la domanda giusta è **«cosa
sarebbe potuto variare fra questo caso e il prossimo?»** — il tempo, la porzione, il soggetto. Le
tre risposte di oggi erano tutte diverse, e nessuna si vedeva rileggendo il codice.

🚨 **E ce n'è una quarta, arrivata da FUORI: una mia deduzione smentita da un'altra sessione.**
Scrivendo la voce 53 avevo dichiarato che la strada del bot sarebbe stata *migliore* di quella
dell'app *«perché il sync è un processo a sé e non passa dal worker»* ⇒ worker giù, quella strada
funziona ancora. **Passa dal worker** (`matchpoint-bookings-sync` → `/export-booking-history`): la
copia si congela **insieme** al worker, e la notte del 15/08 era già successo. ⚖️ Era una
**deduzione** travestita da reperto — la 25ª — e a smentirla è bastato che qualcuno andasse a
**misurare** invece di rileggere. 📌 La misura è la stessa che avevo marcato come bloccante e non
avevo fatto: mediana **~2 minuti**, massimo **10′04″** su 43 creazioni
(📄 [`docs/voce-53-ritardo-sync.md`](../voce-53-ritardo-sync.md)).

🚨 **E la seconda, che è la peggiore perché l'ho fatta CREDENDO di applicare la lezione giusta.**
Avevo scritto di aver «rieseguito il conteggio della guardia»: ne avevo riprodotto **metà**. È la
24ª pari pari, commessa mentre la citavo. ⇒ La cura non è «stare più attento» — l'attenzione è
precisamente ciò che aveva già fallito: ora il pre-volo **estrae lo script della guardia dal
workflow e lo esegue**, invece di riscriverne una parafrasi.

🎯 **E il segnale che avevo sotto gli occhi e non ho raccolto**: `test-preview` **verde** e `main`
**rosso** sullo stesso identico contenuto. La guardia legge sempre `origin/main`, quindi sul ramo di
TEST leggeva il file di *prima* del merge — un verde che **non parlava del file che stavo
spingendo**. Due esiti opposti sulla stessa cosa erano un'informazione, e l'ho lasciata cadere.

## 🎯 Il secondo filo della 28ª: **un fatto NON SCRITTO va riscoperto ogni volta**

È l'immagine speculare della 26ª — là un *limite dichiarato e mai provato* restava vero per sempre;
qui un **fatto vero e mai scritto** costa il suo prezzo a ogni sessione che ne ha bisogno.

Aggiornare il bot sulla VM è costato **un'ora**, e nessuno dei pezzi era difficile:
· l'indirizzo della VM esisteva, **sepolto in una scheda di collaudo** (`docs/collaudo-voce-23-…`),
  l'ultimo posto in cui uno lo cerca;
· la procedura per aggiornare il bot **non esisteva affatto** — e non «era un'altra»: `/opt/assistente-padel-agent`
  **non è un repository git**, i file erano stati copiati a mano l'11/08 e nessuno sapeva più da dove;
· nel mezzo, due comandi sbagliati miei: un blocco con segnaposto che `zsh` non poteva eseguire, e
  un `cat ~/.ssh/config` mandato a cercare un file che non c'era.

⇒ Ne sono nate due cose che quel prezzo non lo faranno ripagare a nessuno: la **scheda della VM** in
`CLAUDE.md` (indirizzo, cartelle, nomi pm2, e le trappole di `pm2 list`) e il **primo modo di
aggiornare il bot che sia mai esistito** — `deploy-bot-hetzner.yml`, con bersaglio `prova`
predefinito e la parola `SOCI` da scrivere a mano per toccare quello vero.

🛡️ **E la terza, in positivo: un RIFIUTO ha fatto da rete.** Spingendo su `test-preview` il push è
stato respinto perché **un'altra sessione** ci aveva appena scritto (la voce 53, su TEST). Senza
quel rifiuto avrei sovrascritto mezz'ora di lavoro altrui **senza accorgermene**. ⇒ Il commit è
stato **ricostruito sopra** il suo, non al posto suo, e verificato dopo che il suo fosse ancora lì.

## 📌 Le decisioni prese dal committente nella 28ª

| | |
|---|---|
| ❓ **«quando prenoto col bot, aspetta la conferma del gestionale?»** | ⭐ **la domanda che ha aperto la giornata, ed era la domanda giusta**: la risposta è **sì**, ma misurando la catena è saltato fuori il **terzo esito** — il caso in cui il bot dice «non ci sono riuscito» **senza saperlo**, e il socio rifacendo occupa il campo due volte |
| 🔓 **«fai la uno e poi metti in coda la due»** | la toppa subito, la cura vera in coda come **voce 53**. ⇒ L'ignoto non si spaccia più per un «no», e la strada per farlo controllare al bot è scritta con dentro la misura che manca |
| 🧭 **«il bot legge tutto dal gestionale. Non è autonomo»** | ⭐⭐ **regola d'architettura**, data lì per lì e valida **soprattutto per il futuro in cui Matchpoint si chiude**: il gestionale SA, il bot DICE. Non era un'abitudine — era già la scelta presa in tre punti, che così smettono di sembrare casi isolati |
| 🔓 **«il merge lo fai tu dopo che io ti ho dato l'ok»** | ⚖️ **sciolta metà della regola vecchia, non tutta**: è cambiato chi tocca il bottone, **non chi sceglie** |
| ✅ **«fai tu in automatico, però poi controlli. E se dà un problema rosso riprovi»** | ⭐ **un ok non autorizza un gesto, autorizza un ESITO** — eseguire, verificare **sul bersaglio**, riparare. Col confine scritto: rimettere in piedi ciò che si è rovesciato sta dentro, aggiungere altro no |
| 👁️ **«attenzione»**, con una schermata del rosso | 🚨 **l'ottava sessione di fila in cui la cosa che vede lui io non l'avevo guardata.** E la causa non era la riga dimenticata: era il pre-volo che ne copriva metà |
| ✅ **«la console si usa in autonomia, sia in test che in prod»** | ⭐ e **PROD compresa è la metà che conta**: col calendario di TEST congelato, una console autorizzata sul solo TEST avrebbe lasciato fuori metà delle diagnosi |
| 🔎 **«dove si deve fare?»** (il ruleset) | ⚖️ **ha scelto di GUARDARE invece di farmi dedurre**, su una cosa che avevo già dichiarato falsa basandomi su un rifiuto che riguardava **me**. La Bypass list era vuota ⇒ la riga si è potuta scrivere **misurata**, non intuita |
| 🗣️ **«ricordati che abbiamo un bot di test e uno di prod»** | ⭐ **l'informazione che ha dato forma al workflow**: bersaglio `prova` predefinito, e la parola `SOCI` da scrivere per toccare quello vero. La protezione sta nel meccanismo, non nella buona volontà di chi clicca |
| 📄 **«aggiorna la fotografia e i docs»** | la chiusura di rito, con le lezioni della giornata scritte dove le rilegge chi apre domani |

**E la 27ª, poche ore prima:**

## 🔎 Il filo della 27ª: **il residuo che si era fatto promuovere, misurato fino in fondo**

La 26ª aveva chiuso la 47 lasciando scritto che «le `SECURITY DEFINER` aperte ad `anon` non le ha
rilette nessuno» — e alla 48 quella frase si era già fatta promuovere, salvo poi rivelarsi gonfiata:
su PROD erano un sottoinsieme esatto delle 33 già lette. Questa sessione ha fatto la cosa che
mancava: è andata **sul perimetro vero — TEST — e le ha ESEGUITE**, non lette.

⚖️ **La lezione, dal lato dell'attrezzo**: la riga di cura che sembrava ovvia era **falsa**, e a
smascherarla è stata una transazione annullata *prima* di agire. `revoke … from anon` lascia `anon`
dentro **via `PUBLIC`**: chi si fermava a leggere il flag `anon=false` **dopo** avrebbe creduto chiusa
una porta ancora aperta. ⇒ La domanda della 25ª — *cosa ho eseguito, e cosa ho solo dedotto?* —
applicata alla **cura**: la si prova col sabotaggio (qui: la `revoke` a metà) prima di fidarsene.

🎯 **E il controllo positivo che conta più del negativo**: che `anon` sia bloccato lo dice il
`42501`; che la cura non abbia rotto altro lo dice `service_role`, che risponde `INVALID_ADMIN_PIN`
**e non** `42501` — cioè raggiunge ancora la funzione. Senza quella controprova, «anon bloccato» si
sarebbe letto come «funziona», e la **trappola `service_role`** della 36 sarebbe passata inosservata.

🎯 **E la quarta, che è la più utile di tutte perché ha impedito un guasto invece di raccontarlo: il CONTROLLO POSITIVO fallito.** Aggiungendo la guardia di staff alla voce 50, la prova «l'intruso non passa» era **verde al primo colpo** — ed era la prova che dà ragione. Quella che dà torto, «lo staff vero passa ancora», era **rossa**: la guardia respingeva tutti. ⇒ Senza il controllo positivo sarebbe andata in produzione una funzione che nega il servizio a chi ne ha diritto, **con la prova di sicurezza tutta verde**. ⚖️ E la causa era **la sonda**: `pmo_current_staff_profile()` vuole `auth.uid()` **e** l'email, io passavo solo la prima. È la 22ª — *cosa saprebbe vedere questa sonda se il documento avesse torto?* — girata al positivo: **cosa saprebbe vedere se la cura fosse troppo stretta?**

🛡️ **E la terza, arrivata a fine giornata: il rosso in bacheca l'ha visto LUI, e la mia riparazione era
un abbaglio di metodo.** Avevo «rilanciato» due guardie rosse con `workflow_dispatch` — che crea una corsa **nuova**
— e guardando quella verde ho dichiarato «nessun rosso in bacheca». ⚠️ **Un verde ACCANTO a un rosso non è un rosso
riparato**: la riga rossa resta, con lo stesso sha, ed è quella che si vede. Me l'ha mostrata con una schermata, ed
erano **due**, non una. ⇒ La cura è meccanica: si usa **`rerun_workflow_run` sull'ID della corsa fallita**, e si
verifica che *quella* corsa passi a **`run_attempt: 2` + `success`** — non che ne esista una verde con lo stesso sha.
⚖️ È la 22ª applicata a me un'altra volta — *guardavo l'oggetto sbagliato, e la sonda mi dava ragione* — ed è la
settima sessione di fila in cui la cosa che vede lui io non l'avevo guardata.

## 📌 Le decisioni prese dal committente nella 27ª

| | |
|---|---|
| 🔓 **«Scegli quella che secondo te è più corretta»** | delega esplicita sullo scopo della cura: scelta la **completa su tutte e 12**, non il sottoinsieme «solo scritture» — le letture espongono staff e anagrafica veri, e mezza cura è mezzo buco |
| 📦 **«chiudila e aggiorna i docs»** | la 48 chiusa su voce **verificata sul bersaglio eseguendo**, non solo «a codice a posto» ⇒ la lista urgenti torna **vuota** |
| 📦 **«chiudi la quindici»** | la voce che aspettava **il suo sguardo** e non altro lavoro: fatta e in PROD dal 15/08, restava aperta perché la card si vede solo col login staff. L'ha guardata ⇒ chiusa |
| ⏸️ **«la diciotto la sospendiamo, levala dall'elenco»** | ⚖️ **sospesa, non annullata** — e la differenza è scritta nella sua riga: non l'ha fermata un problema tecnico, è una priorità sua. Il perché resta agli atti, o fra un mese torna da sé |
| 🔓 **«fai tu e scegli la migliore soluzione»** | ⚖️ **delega piena, dichiarando il perché**: *«non sono un tecnico»*. ⇒ Scelte tutte e tre le mosse su **TEST e PROD**, e prima di produzione **eseguito il ramo mai provato** (il rincaro) invece di fidarsi che fosse corretto |
| 🔎 **«controlla»** (se la registrazione sia aperta) | 🚨 **ha rimesso alla prova un mio «non si può» mai tentato**, e la risposta ha cambiato la giornata: la registrazione è **APERTA** ⇒ `authenticated` è il pubblico, e da lì è nata la voce 50 |
| 🗣️ **«l'autovalutazione l'abbiamo già fatta col bot… non sarà mai più riattivata»** | ⭐ **l'informazione che ha cambiato il lavoro, e non stava in nessun file**: gli avevo proposto di riparare il pezzo rotto, e la riparazione **non aveva più senso**. ⇒ Voce **52**, «morto per scelta». È la stessa correzione della 20ª sulla stessa sezione, portata da lui un'altra volta |
| ⛔ **«lasciare com'è, scrivendolo»** | messo davanti a *riparare*, *potare* o *scrivere e basta*, ha scelto la terza — e la potatura resta **sua**, non una conseguenza automatica di «tanto è morto» |
| 🤝 **«perdiamo ancora venti minuti però facciamo questa prova»** | ⭐ **ha scelto di PROVARE invece di fidarsi**, su una cosa che io avevo marcato come «così funziona Supabase» e non come misura. ⇒ Due click suoi, il banco e le misure miei, e un fatto in più che ora è **eseguito** invece che saputo |
| 🔓 **«fai la prima»** | messo davanti a due strade — guardia dentro la funzione, o chiudere la registrazione dal pannello — ha scelto quella che **non dipende dai grant**. ⚖️ E la scelta regge anche dopo che il mio motivo per proporla si è rivelato falso |
| ❓ **«fammi capire meglio quella del pin»** | ⭐ la richiesta che ha trasformato un residuo in **misura**: costo bcrypt, popolazione `authenticated` e oracolo **eseguito** invece che dedotto — e il quadro che ne esce **ridimensiona** l'allarme che avevo dato |

## 🔎 Il filo della 26ª: **il limite dichiarato che nessuno aveva provato**

La 25ª aveva trovato la conclusione *dedotta* da una premessa vera. Questa ha trovato la sua parente
più costosa: **una frase che dice «da qui non si può fare», scritta senza averlo tentato** — e che
per questo resta vera per sempre, perché nessuno la mette più alla prova.

| stava scritto | cos'era |
|---|---|
| «la **previsione D** non è raggiungibile dalla console: `staffCalGetSlots` non è su `window`» | **premessa vera, conclusione falsa.** La previsione D non chiede quella funzione, chiede *cosa mostra il calendario* — e `renderCal` renderizza il calendario **vero**. Fatta in dieci minuti |
| «per l'**annullo** serve un operatore davanti allo schermo» | il blocco non era la guardia della console ma il **ruolo** dell'account. Cambiata una colonna per la durata della prova, e la cura si è **vista funzionare** |
| «le **20** `SECURITY DEFINER` non le ha rilette nessuno» — scritta da me chiudendo la 47 | **le 20 sono un sottoinsieme esatto delle 33 censite due ore prima.** Un residuo che *sembrava* un buco aperto, e la prima cosa che ha fatto è stata **farsi promuovere** |

⚖️ **La lezione non è «prova tutto».** È che un limite dichiarato ha la stessa forma di una misura ma
**non è stato eseguito**, e siccome sembra prudente nessuno lo ricontrolla. ⇒ La domanda da farsi
davanti a un «non si può» è **«chi l'ha provato, e quando?»** — la stessa che la 22ª faceva alle
sonde, applicata alle **rinunce**.

🎯 **E il secondo filo, dal lato del bene: tre volte la somma ha smascherato ciò che la rilettura non
vedeva.** ① I conteggi del censimento erano **10 e 12** invece di **12 e 11**, e a tradirli è stato
che 2+10+12+2+3+3 fa **32** su 33 voci. ② La PR era `dirty` con **266 cancellazioni**, e l'ho visto
chiedendo lo stato della PR invece di fidarmi dell'elenco delle corse. ③ `git diff --stat` dava
vuoto e l'avevo preso per «nessuna modifica»: era in **staging**, e `git diff` senza `--cached` non
la vede. ⚖️ Nessuna delle tre è stata trovata rileggendo: **tutte e tre da un totale che non
tornava**, o da un attrezzo interrogato nel punto giusto.

🚨 **E la peggiore, perché è di metodo e ha viziato una misura: una funzione con overload e valori
predefiniti non si prova per POSIZIONE.** `pmo_upsert_staff_user_admin` esiste a 5 e a 6 argomenti,
entrambe con default; la chiamata posizionale si è risolta sulla **6-argomenti, quella col PIN**,
perché PostgreSQL preferisce `text` a `jsonb` per l'`unknown`. Credevo di provare la variante senza
PIN e riprovavo quella col PIN. ⇒ È la 24ª — *«questa sonda guarda nel cassetto giusto?»* — nella
forma più subdola, perché qui **i due cassetti hanno lo stesso nome**. ⚖️ E la cura è stata cercare
la **classe**: chieste al database **tutte** le funzioni con parametri predefiniti (11, in 5
famiglie) e ricontrollate una per una — le altre 10 erano legate giuste.

🛡️ **La terza, e riguarda le protezioni: quella che ti salva non è sempre quella che credi.** Prima
dell'annullo vero si è verificato **nella pagina viva** che la simulazione Matchpoint fosse
installata: la sonda ha risposto `simulated:true` **senza uscire dal browser** — e la guardia «sola
lettura» della console **non l'aveva bloccata**, perché a rispondere è l'app *prima* della rete. ⇒
Su quella strada la protezione è il flag `PMO_BOOKINGS_SIMULATE`, **non l'attrezzo**: chi si fidasse
della guardia scriverebbe sul **Matchpoint vero** credendosi al sicuro.

## 📌 Le decisioni prese dal committente nella 26ª

| | |
|---|---|
| ⬆️ **«le 33 `SECURITY DEFINER`»** | messo davanti a quattro proposte con la lista urgenti ridotta alla sola 43, ha scelto il residuo più pesante invece di una voce comoda |
| 🔓 **«fammene una alla volta»** | ⭐ **la regola che ha fatto la qualità del lavoro**: tre reperti, **tre autorizzazioni separate**, mai due insieme. Ed è servita davvero — fra la prima e la seconda la misura ha **cambiato la cura**, da 1 funzione a 12 |
| 🔑 **«dammi il permesso di annullare su TEST»** | l'autorizzazione che ha reso verificabile **sul bersaglio** una cura che altrimenti restava «provata nel banco» |
| ✋ **la scelta della RIGA da annullare** | 🚨 **non l'ho presa io, e non doveva**: su TEST **non esiste nessuna riga di prova** — le 45 occupazioni future sono prenotazioni vere e le tre campionate erano vive **anche in produzione**. La regola *«se risulta anche in PRODUZIONE, fermati»* ha funzionato: la sessione si è fermata e ha chiesto |
| 📦 **«chiudi la quarantasette»**, poi **«chiudi la quarantatré»** | due chiusure, una per volta, entrambe su voci **verificate sul bersaglio** e non solo «a codice a posto» |
| ⬆️ **«promuovi in urgenti le 20 `SECURITY DEFINER`»** | ⚖️ e la promozione ha trovato **una mia frase gonfiata**: le 20 erano già lette. La voce esiste lo stesso, ma il suo perimetro vero è **TEST** — 32 aperte ad `anon`, mai guardate |

**E la 25ª, poche ore prima:**

## 🔎 Il filo della 25ª: **la premessa vera che regge una conclusione falsa**

Le sessioni prima avevano imparato a diffidare della *prova* (16ª), dello *strumento* (20ª), della
*misura che concorda col documento* (22ª), dello strumento che guarda **un pezzo solo** (23ª) e di
quello che guarda **altrove o troppo presto** (24ª). Questa ha trovato la forma più educata di
tutte: **un ragionamento corretto, da una premessa vera, a una conclusione sbagliata.** Non c'è
niente da smascherare nella logica — l'errore sta nel fatto che non è stato *eseguito* niente.

| la nota concludeva | cos'era davvero |
|---|---|
| «`get_self_assessments_by_tokens` è un fatto da sapere, **non un buco aperto**» — perché *«vuole i gettoni in ingresso, che non si rastrellano più»* | la **premessa è vera**. Ma non tutti i gettoni sono forti: fra i 1364 ce n'è uno da 11 caratteri, `MAURIZIO001`, e dietro c'è **un socio vero col telefono**. Eseguendo la funzione **come `anon`** torna nome, cognome e numero. La logica reggeva, il mondo no |
| «la GET è morta perché la tabella risponde vuota» | **vero, e non è il motivo principale**: la guardia che l'accendeva (`!r?.raw_response`) era **irraggiungibile**, perché la RPC porta sempre `coalesce(…, '{}')` e in JS `{}` è **vero**. ⇒ Non partiva **proprio nei casi per cui era stata scritta** |
| «`autovalutazione_url`: grep, **solo il commento**» | nel codice quel nome **non c'è affatto**: vive nel **database**. La conclusione («nessuno la legge») era giusta; il metodo che l'aveva prodotta **non poteva saperlo** |
| «promosso: il merge è passato» | `main` dichiarava una versione di TEST **che non esisteva**. Il commit che la correggeva **l'avevo fatto e non spinto**, e la PR è nata dal ramo *remoto* |

⚖️ **La lezione non è «diffida delle conclusioni».** È che una conclusione va marcata con **come è
stata ottenuta**: *letta*, *dedotta*, o **eseguita**. Le prime tre righe qui sopra erano tutte
*dedotte*, tutte da premesse vere, e tutte e tre sbagliate — e in tutti e tre i casi a smentirle è
bastato **far girare la cosa**: chiamare la funzione come `anon`, interrogare la RPC sui token veri,
guardare nella tabella invece che nel repo. ⇒ La domanda da farsi non è «il ragionamento tiene?», è
**«che cosa ho eseguito, e cosa ho solo dedotto?»**.

🎯 **E il secondo filo, sullo stesso tema dal lato del verde: un verde dimostra meno di quel che sembra.**
Il banco fa **94/94** togliendo il ripiego morto — ma **non poteva** dimostrare che fosse morto:
nessun caso può coprire un ramo **irraggiungibile**. Dimostra solo che non è caduto nulla intorno; a
dimostrare che era morto è la misura sulla RPC. Allo stesso modo il **merge riuscito** non dimostra
che la promozione sia atterrata: le due guardie erano rosse mentre il merge era verde. ⇒ Un verde va
sempre letto insieme alla domanda **«che cosa sarebbe stato capace di far diventare rosso?»**.

🚨 **E la quarta, che è la peggiore perché l'ho fatta DUE VOLTE nello stesso giorno: verifico il ramo
LOCALE e apro la PR dal ramo REMOTO.** Le due volte il commit che aggiornava la tabella delle
versioni l'avevo fatto **e non spinto**; la PR nasceva da `origin/<ramo>`, fermo al commit prima; e
tutti i controlli pre-volo — versioni dichiarate contro versioni vere, docs identiche fra i rami —
usavano `HEAD`, che quel commit **ce l'aveva**. ⇒ **Il controllo dava ragione guardando l'oggetto
sbagliato**, che è la lezione della 22ª applicata a me, e la ripetizione dimostra che *accorgersene*
non basta: la prima volta l'ho diagnosticata bene, spiegata bene, e **due ore dopo l'ho rifatta**.
⚖️ La cura non è «stare attento»: è **una regola meccanica** — *si spinge PRIMA di aprire la PR, e si
verifica `origin/<ramo>`, non `HEAD`*. Applicata alla terza, ha retto.

🎯 **E la quinta, in positivo: due errori li ha presi il controllo DOPO aver agito, non prima.**
① Il ripristino della cura dopo un sabotaggio **non è andato a segno** — il comando è girato con
un'altra cartella corrente e ha scritto il file nel posto sbagliato — e il messaggio a schermo
diceva «ripristinato». A smentirlo è stato il conteggio: *spinta attesa: **0***. Senza quel
controllo avrei spinto su TEST **il codice sabotato**, con il banco che l'avrebbe pure detto rosso
in una corsa che non stavo più guardando. ② La cura stessa, riletta mentre la scrivevo: *«aspettare
la spinta»* **non chiude la finestra**, la sposta **dentro l'attesa**. ⇒ Sono i due casi in cui la
lezione della 23ª — **guarda cosa resta dopo aver agito** — ha pagato in giornata.

🚨 **E la terza, pagata: il mio errore l'ho trovato io, ma il rosso in bacheca l'ha visto LUI.**
Diagnosticato e riparato il drift, ho rilanciato le guardie di `test-preview` e **ho lasciato rossi
quelli di `main`** — riparati sul commit dopo, ma rossi in bacheca. Me l'ha mostrato con una
schermata. ⚖️ *«I rossi vecchi si rilanciano a mano per non lasciarli in bacheca»* è scritto in
fondo a questo file da giorni: sapevo la regola, l'ho applicata su un ramo e non sull'altro. **Una
guardia rossa che si sa spiegare è comunque una guardia rossa**, e chi guarda la bacheca non ha la
spiegazione in testa.

## 📌 Le decisioni prese dal committente nella 25ª

| | |
|---|---|
| 📦 **«chiudo la 42»** e **«decido la 14 adesso»** | la lista era piena di voci mature: due chiuse in un colpo, una a domanda risposta e una **dichiarando** |
| 🔑 **«no» alla 14** | la chiave dell'occupazione **resta col nome dentro**. Deciso coi numeri di oggi davanti — 438 lapidi, `ancora_vive` **0** in **quindici settimane su quindici** — e con la ragione scritta: il costo è contabile, la cura toccherebbe **sync, app e ponti insieme** |
| ✋ **«solo diagnosi» sulla 43** | la cura tocca la strada che annulla **per davvero** su Matchpoint ⇒ si scrive cosa non va, non si tocca. È la stessa scelta della 23ª, ripresa da lui senza che gliela ricordassi |
| ⬆️ **«i tre reperti piccoli»** | promossi in blocco da «nate misurando» — e **uno dei tre non era piccolo**: è diventato la voce 44 |
| 🔓 **«revoca `anon` e PUBLIC»** | l'autorizzazione che ha chiuso una **fessura su dati personali veri in produzione**. Chiesta e data **da sola**, non in blocco con le altre |
| 🔓 **«fai la 46»**, poi **«fai la 45»** | una per volta, mai due insieme |
| ⬆️ **«promuovi su test-preview e poi su main»** | l'ordine del 4bis chiesto **per nome**, e la finestra rossa è caduta dove il 4bis promette |
| 👁️ **«attenzione ai deploy rossi»**, poi una **schermata** | ⭐ **la correzione della sessione, e non l'ho portata io**: avevo guardato le guardie e non i deploy, e avevo lasciato in bacheca due rossi che sapevo spiegare. È la sesta sessione di fila in cui la cosa che vede lui io non l'avevo guardata |

**E la 24ª, poche ore prima:**

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
| 🔴 **Urgenti** | **4** — promosse **tutte e quattro da lui** il 21/08 (**63**, **64**, **65**, **66**), dai difetti misurati la notte prima. Tre sono già curate e in servizio: restano aperte perché la **cura** non l'ha ancora vista succedere nessuno |
| 📋 **In coda** | **1** — la sola **60** (due passi su quattro vivi su TEST, in attesa che parli con Wansport). La **62** è chiusa il 19/08 |
| 📦 **Chiuse** | **57** il 13–19/08 + ~56 dal 7/08 + ~41 fino al 6/08 |

**Neanche la 28ª ha toccato `index.html`**, come la 27ª: il lavoro è stato tutto sul **bot dei soci
e sul suo ponte**. In PROD sono andate due cose — `scheda_del_tolto` (il ponte dice **chi** è stato
tolto) e il **terzo esito** (`esito_ignoto` invece di «errore») — e il bot sulla VM è stato
aggiornato **per la prima volta con un meccanismo**, non a mano.

⭐ **Il fatto nuovo che cambia le sessioni future**: il bot ha finalmente un **deploy**
(`deploy-bot-hetzner.yml` nel suo repo). Prima non ne aveva **nessuno**, e una cura mergiata restava
muta per i soci finché qualcuno non si collegava a mano — cosa che il 16/08 è successa davvero: la
metà gestionale del terzo esito è stata in PROD per ore mentre sul bot non c'era.

📌 **E la VM ora è scritta** in `CLAUDE.md`: indirizzo, le tre cartelle coi tre nomi pm2, e le
trappole — `shadow-backend*` fermi, i **due bot online insieme che sono NORMALI** (token e cartelle
diverse, non è la doppia istanza del 409).
🚨 **CORRETTA NELLA 29ª**: qui c'era scritto che **«dal cloud la VM non si raggiunge»**. È vero
della **shell**, ed è **falso di GitHub Actions**, che sulla VM entra e ci lancia comandi qualunque.
Il committente l'ha rimesso in discussione la sera stessa e aveva ragione ⇒ vedi la tabella degli
attrezzi in `CLAUDE.md`. Ciò che resta fuori portata è **entrare** con una shell interattiva.

**Stato del sistema, rimisurato alla chiusura della 26ª (16/08)** — versioni lette dall'`index.html`
dei due rami, non ricordate: app PROD **6.237** · TEST **6.243** · i **4
percorsi** di `guard-worker-sync` **identici** fra i rami · tutte le guardie **verdi sulle punte di
entrambi i rami**.
📌 **La 26ª non ha toccato una riga di `index.html`**: le versioni sono quelle con cui la 25ª aveva
chiuso, e sono state **rimisurate** invece che ricopiate. Il lavoro è stato tutto su **permessi del
database** (13 revoche su PROD) e su **documenti**.
✅ **E stavolta le due versioni sono verificate DAL SERVER tutt'e due**, cosa che la 25ª non era
riuscita a fare per TEST: aprendo le pagine in un browser vero, i titoli dicono **v6.234** e
**v6.243**. Quella di TEST la 25ª l'aveva **dedotta** dal meccanismo del caricatore, scrivendo che
dal server non si misurava — si misura, basta caricare la pagina invece di scaricare il file.
📌 Gli **sha non sono scritti qui di proposito**, ed è la stessa ragione per cui `guard-docs-truth`
non li controlla: un file che cita il proprio sha è vecchio nell'istante in cui lo si salva — questo
commit stesso lo cambierebbe. Si rileggono con `git rev-parse origin/main origin/test-preview`.
🚫 **E da questa sessione non si scrive più nemmeno «PR aperte: N».** `main` è **protetto**: la spinta
diretta viene rifiutata, quindi *ogni* promozione — **compresa quella di questo file** — passa da una
PR. ⇒ «PR aperte: 0» sarebbe **falsa nell'istante in cui atterra**, ed è esattamente la classe di
frase vietata dalla regola del 15/08: *il commit che porta la frase è uno degli eventi che la frase
conta*. Il fatto **stabile** è questo: `main` è protetto, le promozioni passano da PR, e quante ne
siano aperte **si conta guardando**, non leggendo qui.
📏 **La rete di regressione: PROD 95 casi, TEST 98** — **+1 su entrambi** nella 25ª, ed è il caso
**98** della cura della voce 43. La differenza fra i due resta **solo** i 3 della simulazione incassi.
🚨 **E quel caso è passato per il SABOTAGGIO, non per il verde**: alla prima stesura era **inerte** —
nel banco la spinta si concludeva nell'istante in cui partiva, quindi «attenderla» e «no» davano lo
stesso esito, e il caso sarebbe stato verde **anche togliendo la cura**. È servito aggiungere
`CLOUD_WRITE_RESPONSE_DELAY_MS`, **gemello opposto** del knob della voce 42: quello ritarda *quando
la scrittura si vede*, questo *quanto la spinta ci mette a concludersi*. Il banco distingueva già le
due cose **a parole**; ora le distingue nei fatti. ⇒ Con la cura **95/95** e **98/98**; togliendola,
**94/95** e **97/98**, e cade **solo** quel caso.
📏 Erano 94 e 97 a inizio 25ª. Cresciuta di **4 su entrambi** nella 24ª: due
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

✅ **PROD verificata DAL SERVER alla 25ª, e con la trappola della 20ª evitata.** `pg_net` ha scaricato
`app.padelvillage.club/index.html` → **200**, `APP_VERSION = '6.233'`, cioè il numero dichiarato qui
sopra. E il codice tolto è stato controllato **per forma, non a conteggio**: `async function
fetchAssessmentRawResponsesByTokens` **assente**, `const missingRaw` **assente**, la GET diretta su
`self_assessments` **assente** — e il nome compare **una volta sola**, dentro il commento che spiega
la rimozione. Contarne le occorrenze avrebbe detto «c'è ancora».
⛔ **TEST invece NON è verificata dal server, e va detto**: `test.padelvillage.club/index.html`
risponde 200 ma è il **caricatore** (3.261 byte, repo a parte), non l'app — non contiene
`APP_VERSION`. Che TEST serva la 6.242 lo si sa **dal meccanismo documentato** (il caricatore prende
l'ultimo commit del ramo), *non* da una misura. È una deduzione, ed è marcata come tale.

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

🔭 **La 25ª ha aggiunto una cosa che prima non si era mai fatta da qui: CHIUDERE UN BUCO su PROD.**
Fino a ieri da una sessione cloud si misurava, si scriveva e si promuoveva codice; la voce 44 è la
prima volta che si **toglie un permesso** al database di produzione — e la prova è stata fatta
**eseguendo la funzione come `anon`** dentro transazioni annullate, prima e dopo, con la controprova
positiva su `authenticated` e una conferma indipendente (le `SECURITY DEFINER` aperte ad `anon`
passano da **34 a 33**).
⚠️ **Il che rende più pesante ciò che resta non guardato**: quelle **33** non le ha lette nessuno. Il
linter le segnala tutte con lo stesso titolo da sempre, ed è esattamente la condizione in cui stava
la 44 fino a stamattina — segnalata, letta da nessuno, e con un socio vero dietro.

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

🔄 **18/08, e la 59 è stata CHIUSA da lui** — *«chiudi la voce cinquantanove e aggiorna i docs»*.
Era il seguito della 58, messa qui da lui la sera prima con l'ordine dei pezzi già dato (*«fai la B
e poi la C»*). ⇒ **Urgenti da 1 a 0 — lista vuota.** La sua riga sta fra le 📦 chiuse, con dentro
la riga della scheda che non reggeva e i tre giri che sono serviti a dare una voce alla sentinella.

🔄 **E la sera del 18/08 la lista si è riempita di nuovo, e a riempirla è stato LUI**:
*«inserisci nella lista dei task urgenti la finalizzazione della sezione sul bot che si chiama il mio
livello»*. ⇒ **Urgenti da 0 a 1.**
⬆️ **E con lei sono salite le tre voci del livello**: la domanda gliel'avevo lasciata aperta invece
di deciderla da me — *«la 55, la 56 e la 57 restano in coda o salgono dentro la 61?»* — e la risposta
è stata **«sì assorbile nella 61»**. ⇒ La coda passa da **8 a 5** (sezione C da 5 a 2), e le loro
schede stanno **dentro la 61**, per intero: assorbite, non chiuse e non cancellate.

🔄📦 **E il 19/08 la 61 è stata CHIUSA da lui**, a cosa vista e non a codice scritto: il settimo
pezzo era arrivato sul telefono di una persona vera venti minuti prima. ⇒ **Urgenti da 1 a 0 —
lista vuota.** La sua riga sta fra le 📦 chiuse, con dentro i sette pezzi, le tre schede assorbite
(55, 56, 57) e le trappole che sono costate — compresa quella che nessuna sonda poteva vedere.
🗣️ **E alla domanda su cosa promuovere ha risposto «niente per ora»**: la lista resta vuota per
sua scelta, non per dimenticanza. Si riparte da qui quando lo dice lui.

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
📦 E in fondo alla sessione la **44** — nata nella giornata stessa, curata e poi **chiusa da lui**:
la fessura su PROD è tappata, e il residuo (i gettoni deboli, le altre **33** funzioni mai lette)
è dichiarato nella sua riga fra le chiuse, non taciuto.
⇒ **Urgenti da 3 a 1.** Resta la sola **43**.

⬆️📦 **E il 16/08, 26ª sessione: promossa la 47 e chiusa in giornata.** Con la lista ridotta alla sola
43 — che aspetta le sue mani — gli ho proposto cosa promuovere, e ha scelto **le 33 `SECURITY
DEFINER` aperte ad `anon`**, che stavano fra le «nate misurando» con scritto *«nessuno le ha mai
lette una per una»*. Censite tutte **eseguendole**, tre reperti, **tre autorizzazioni separate — mai
due insieme** («fammene una alla volta»), e chiusa da lui la sera stessa. ⇒ Urgenti **1 → 2 → 1**.

🔧 **E la 43, a fine sessione, è CURATA ma NON CHIUSA** — su sua scelta la cura «A» è stata scritta,
provata col sabotaggio e promossa (TEST **6.243**, PROD **6.234**, verificata dal server). ⛔ **Resta
aperta di proposito, e la ragione è una regola sua**: *«non chiudere una voce che non hai verificato
sul bersaglio — il codice è a posto non è funziona»*. Qui il **difetto** è stato verificato sul
bersaglio; la **cura** no: è provata **nel banco**, con un sabotaggio che la fa cadere, e sull'app
vera non l'ha ancora esercitata nessuno.

✅ **Aggiornamento del 16/08, 26ª sessione: le due cose che mancavano SONO STATE FATTE, tutte e due
da qui.** ① La **previsione D è stata eseguita** — il fantasma sul calendario non si vede, come la
voce prevedeva. ② E **l'annullo vero su TEST pure**, su sua autorizzazione esplicita: il blocco non
era la guardia della console ma il **ruolo** dell'account, cambiato per la sola durata della prova e
**rimesso subito**. ⇒ La cura «A» è ora verificata **sul bersaglio**, che era l'unica cosa che
teneva aperta la voce. 📦 **CHIUSA da lui la sera stessa** — la sua riga sta fra le chiuse.
📄 [`docs/voce-43-prova-dal-mac.md`](../voce-43-prova-dal-mac.md) resta come **fotografia del
difetto**, non come collaudo della cura: le sue previsioni A e B descrivono l'app malata e oggi si
leggono al contrario.

⬆️ **E a lista appena svuotata, il 16/08 lui ne ha promossa una: «promuovi in urgenti le 20
`SECURITY DEFINER`».** ⇒ Urgenti da **0 a 1**. 🚨 **La promozione poggiava su un residuo che avevo
esagerato io**: non erano «mai lette». Il perimetro vero era **TEST**, ed è diventato la voce 48.

🔄 **Aggiornamento del 16/08, 27ª sessione: la 48 è CHIUSA.** Le 32 `SECURITY DEFINER` aperte ad
`anon` su TEST sono state censite **eseguendole**, e le **12 divergenze** con PROD — le varianti col
PIN più `pmo_admin_pin_ok` — allineate alla forma di PROD: `anon` sulle `SECURITY DEFINER` di TEST
**32 → 20** (uguale a PROD), verificato sul bersaglio eseguendo (`42501` da `anon`, non più
`INVALID_ADMIN_PIN`), con la **trappola `service_role`** della 36 evitata (`service_role` resta 46).
⇒ **Urgenti da 1 a 0 — lista vuota.** La sua riga sta fra le 📦 chiuse.

🔄 **17/08, e la lista si è riempita e svuotata in giornata: la 58.** Messa qui **da lui** la
mattina (*«segnati subito, dopo fatto questo test, di aggiustare l'app di test»*), scelta della
cura **sua** il pomeriggio (*«vai con la cura vera»*), fusione sui due rami **sua** (*«fammi il
ramo prima di test-preview e poi di main»*), e **CHIUSA da lui la sera stessa**, a cosa vista:
*«il gestionale di test si apre»*. ⇒ Urgenti di nuovo a **0**. La sua riga sta fra le 📦 chiuse,
col residuo dichiarato (il secret facoltativo per il sync istantaneo).


⬆️ **Promosse dal committente il 21/08/2026, 46ª sessione**, a lista vuota e su mia proposta:
gli ho messo davanti i quattro difetti misurati la notte prima e **li ha promossi tutti e
quattro**. ⇒ Urgenti da **0 a 4**.
⚖️ Tre sono **curate, fuse e in servizio** nella stessa giornata; **restano aperte lo stesso**, ed
è la sua regola: *«non chiudere una voce che non hai verificato sul bersaglio — il codice è a
posto non è funziona»*. Qui il **difetto** è verificato sul bersaglio per tutt'e tre; la **cura**
no: gira in produzione da stamattina e nessuno l'ha ancora vista succedere.
📌 La quarta (la **66**) non è curata di proposito: si è fermata alla diagnosi, e la ragione sta
nella sua scheda.

### **63** — 🚨 Gli inviti restano attaccati a una partita che non c'è più — CURATA, in servizio

🗣️ Visto sul vero il 20/08, non dedotto: la prenotazione `9535` si è spostata dal 24 al 31 agosto
e l'invito di Laura è rimasto agganciato al **24**, che non esiste più. Nessuno l'ha saputo — non
chi aveva invitato (sotto la partita nuova quell'invito non compare, e la vecchia non è più fra le
sue), non chi era stata invitata, con in mano un bottone che non porta più da nessuna parte.

📏 **E non è un caso di scuola**, misurato il 21/08 incrociando `telegram_inviti_partita` (su
`ayly…`) con `pmo_cloud_records` (su `qqbf…`): delle **4** partite che hanno mai avuto inviti,
**2 non esistono più** — **12 inviti su 17**.

🚨⭐⭐ **E la scheda non nominava la cosa peggiore.** Un invito che sopravvive alla sua partita può
**riagganciarsi a una partita NUOVA nello stesso slot** e far entrare in campo qualcuno che nessuno
ha invitato lì. È lo stesso danno che il ritiro del 19/08 impedisce quando la partita la annulla il
socio **dal bot** — solo che lì il bot lo sa, e qui deve accorgersene.
⇒ *Una scheda descrive il difetto che qualcuno ha VISTO, non tutto il difetto che c'è.*

🔨 **La cura** (PR #51 del bot): al giro degli avvisi, gli inviti in sospeso il cui slot non è più
fra le partite del socio si **ritirano**. E il dubbio non ritira niente, in tre casi:
① **la copia più vecchia del fatto** ⇒ si ritira solo alla **seconda conferma** (due giri, mezz'ora):
sulle prenotazioni il gestionale è uno specchio con qualche minuto di ritardo, e un ritiro deciso su
una lettura stantia ucciderebbe l'invito di una partita **viva**;
② **l'elenco tagliato** ⇒ il ponte manda al massimo **10** prenotazioni (`MAX_BOOKINGS` in
`consumer-player-readmodel`) e lo dichiara con `bookings_truncated`: alla partita numero undici
l'assenza dall'elenco non vuol dire niente, e il socio ne aveva già **7**;
③ **il campo illeggibile** ⇒ una partita con la stessa data e ora il cui campo non si legge come
numero vale come «potrebbe essere questa».
⚖️ Il verso giusto del dubbio è **lasciarli vivere**: un orfano di troppo costa un bottone che dice
«quella partita non c'è più»; un invito ritirato per errore costa una persona che non entra in campo
e non sa perché.

🚨 **Nessun messaggio parte, ed è dichiarato**: se il socio debba anche **leggere** che quegli
inviti non valgono più è una decisione **sua**, e finché non l'ha presa il bot non aggiunge avvisi
che nessuno ha chiesto.

⛔ **Quello che la cura NON fa, e non è una svista**: distinguere due prenotazioni diverse sullo
stesso slot. Il **ponte** identifica le partite per `data|ora|campo` e fonde di proposito le due
copie (`booking` del sync e `staff_booking` del percorso consumer) sotto la stessa chiave. Finché
quel dato non arriva dal gestionale, il bot non ha modo — ed è il pezzo che resta scoperto.

### **64** — 🚨 Un avviso automatico parte su una partita che stiamo cambiando noi — CURATA, in servizio

📏 La sequenza, letta nel registro del bot dei soci e misurata al secondo:

| | |
|---|---|
| `00:12:25` | Maurizio tocca «conferma annulla» — 31 agosto, 14:00, campo 1 |
| `00:13:09` | 🔔 «tornata_incompleta» **a Maurizio** — 44 secondi dopo il tocco |
| `00:13:10` | 🔔 «tornata_incompleta» **a Lidia Comes** — non aveva toccato niente |
| `00:13:11` | 🔔 «tornata_incompleta» **a Fabiola Limuti** |
| `00:13:12` | 🔔 «tornata_incompleta» **a Marco Aprea** |
| `00:14:38` | ↳ «Fatto: ho annullato la partita» — **un minuto e mezzo DOPO** gli avvisi |

⇒ Quattro persone vere hanno letto «un giocatore è uscito dalla tua partita» un minuto e mezzo
prima che quella partita venisse **annullata**. L'avviso era già superato quando è partito: la
partita non stava perdendo un giocatore, **stava sparendo**.

⚖️ **La causa non è una regola sbagliata.** Annullare passa dal circolo e ci mette un paio di
minuti, e in quei due minuti il roster si svuota **prima** che la partita sparisca: il giro degli
avvisi ha guardato il mondo **nel mezzo di un'operazione** e ha raccontato il transitorio come un
fatto.

🚨⭐⭐ **E qui la scheda diceva metà.** Era scritta come *«arriva anche a chi il gesto l'ha fatto»*;
i destinatari erano **quattro**, e **tre non avevano toccato niente**. Una guardia legata a **chi
agisce** avrebbe curato il caso più facile da vedere e lasciato in piedi quello che fa la figura
peggiore. ⇒ Le due domande si fanno **per PARTITA**:
· `gestoInVoloSullaPartita` (`in-corso.ts`) — copre i due minuti dell'operazione;
· `fattoDaChiunqueSulla` (`fatto-compiuto.ts`) — copre i quindici in cui il circolo non l'ha ancora
recepito.

⚖️ **Nessuna delle due è una memoria del MONDO**, e la distinzione tiene in piedi la regola ferrea:
sono la memoria di ciò che stiamo facendo **noi**, che è l'unica cosa che il dato non può
raccontare. Lo stato della partita resta del gestionale — *il gestionale SA, il bot DICE*.
⚠️ Coprono i gesti fatti da **questo bot**: una partita annullata dal gestionale o dal circolo qui
non si vede, ed è dichiarato nel codice.

🚨 Si salta la voce **per intero, conteggio compreso**: un numero letto a metà operazione al giro
dopo diventerebbe il «prima» da cui si misura il calo, e la prova che erano in quattro sparirebbe
in silenzio.

### **65** — 🔒 Il nome del worker arrivava al bot dentro il «dettaglio» — CURATA, in servizio

🗣️ La regola ferrea del 19/08: *«il worker il bot non deve proprio filarselo»* — né indirizzo, né
stato, **né nome**. Quel giorno è stato curato il `reason` (`worker_error` →
`scrittura_rifiutata`) e messa la guardia che lo sorveglia. Il **dettaglio** no.

📏 Misurato nel registro del bot dei soci il 21/08 alle 09:28, sull'esito ignoto di una
prenotazione del giorno prima: `Worker network error: error sending request for url
(https://worker…/create-booking): tcp connect error: Connection refused` è arrivato **intero** fino
al bot.

🚨 **E non finisce solo nel log.** Per ogni rifiuto che non sia `esito_ignoto`, il bot passa quel
testo come `spiegazione` al modello che scrive al socio (`prenotazione.ts`): il nome di un pezzo
interno poteva arrivare **sullo schermo di chi gioca**, dentro una frase riformulata. È il difetto
del 29/07 in un'altra stanza.

🔨 La cura (`dettaglioPerIlBot` in `consumer-booking-write/esito-scrittura.ts`, applicata a **tutti
e otto** i punti che scrivono `detail:`): il grezzo resta nel `console.error` dell'edge — dove serve
a noi per la diagnosi — e verso il bot esce una frase muta. **Fallisce chiusa**: al minimo sospetto
non si ritaglia il pezzo colpevole lasciando il resto, perché ritagliare lascia in piedi la metà che
nessuno ha pensato di cercare.
⚖️ **Un url è un nome interno anche quando non contiene nessuna parola vietata**, ed è la forma
esatta in cui il difetto si è presentato: `https?://` sta nella lista accanto ai nomi.
🩹 Il caso che sorveglia la classe non conta quante volte la funzione compare: conta che **nessun**
`detail:` le sfugga — la lezione del caso 18, cioè *si conta ciò che il bot LEGGE, non ciò che il
file contiene*.

### **66** — 🔎 `PLAYER_ID_NOT_LOCKED`: diagnosi fatta, cura NON scritta — di proposito

📏 L'autocomplete di Matchpoint ogni tanto non aggancia e `HiddenFieldIdPeople` resta vuoto: il
worker si rifiuta di salvare (fallisce **chiuso**, ed è giusto) e ogni tentativo costa **~52
secondi**. Ha colpito **Fabiola alle 22:55** e **Lidia alle 00:36** della notte del 21/08, e il
19/08 «Ospite» due volte.

🚨⭐⭐ **Il reperto che cambia il lavoro: il ramo dove il difetto colpisce era l'unico senza
diagnostica.** I due fallimenti di quella notte sono su `/edit-booking` — e
`createBookingWithBrowser` allega `steps=[…] url=…` ai suoi errori **da sempre**, mentre
`editBookingWithBrowser` faceva `catch (_e) { throw _e }` e basta. ⇒ Dal registro si leggeva
«Autocomplete non agganciato per: Lidia Comes» e **nient'altro**, quindi non si poteva distinguere
i due modi di fallire, che hanno **due cure diverse**:
· la tendina non compare mai → `player_option_not_found` ×3;
· compare, si clicca, e il campo nascosto resta vuoto → `player_id_check:…:id=`.
⇒ *Il posto dove un guasto si presenta era esattamente il posto in cui non si poteva guardare.*

📏 **L'ipotesi, dai casi che gli steps ce l'hanno** — e va detta come ipotesi, perché sono **tre**:
dove il campo nascosto resta vuoto in pagina ci sono sempre **due** liste di autocomplete
(`list=2` — 16/08 18:04, 19/08 10:36, 19/08 10:41); dove l'id si aggancia, la lista è **una**
(`list=1`, e allora `id=4`, `id=10`, `id=223`, `id=1034`). L'id però si legge con `.last()`: se
anche del campo **nascosto** restassero due copie, si starebbe leggendo quella che non si riempie
mai.

🔨 **Fatto (PR #944)**: gli steps si allegano anche su `edit-booking`; `player_ctrl_count` conta
anche le copie del campo nascosto; e sul fallimento `player_id_check` riporta **cosa c'è in tutte**.
⛔ **La cura NON è stata scritta**, ed è una scelta: sarebbe poggiata su un'ipotesi non chiusa, e il
worker è **uno solo, condiviso TEST+PROD** — ogni sua prova scrive sul **Matchpoint vero**.
⇒ *Prima la misura, poi la riga.* Al prossimo fallimento vero il registro dirà quale delle due cure
serve. **Questa voce si chiude quando quel fallimento sarà arrivato e letto**, non prima.

## 📋 IN CODA — 1

Le sezioni **A** (cose sue già decise), **B** (lavoretti minuti) ed **E** (manutenzione memoria) sono **vuote**. La **C** era salita tutta in urgenti il 16/08 ed è tornata a **1** la sera stessa con la 52, poi a **2** con la 53 — messa in coda **da lui**, nella stessa frase in cui autorizzava la sua metà piccola.

🔄 **18/08: la C torna a 2.** Le tre voci del livello — **55**, **56** e **57** — sono state
**assorbite dentro la voce 61** (urgenti) per sua decisione: *«sì assorbile nella 61»*. Non sono
state chiuse né cancellate — le loro schede, coi numeri misurati il 17/08, stanno **per intero**
dentro la 61, che è il posto dove adesso si lavora la sezione «Il mio livello».

### C — Cose sapute e non risolte — 0

🔄 **19/08, 35ª sessione: due delle tre voci di questa sezione sono uscite, e per DUE MOTIVI
DIVERSI** — su sue istruzioni. ⇒ **Coda da 6 a 4.** 🗣️ Della **D** ha detto *«fra un po' dico cosa
farne»*: quindi la D **non si tocca** finché non lo dice.

| | dov'è finita | perché la distinzione conta |
|---|---|---|
| **52** Autovalutazione morta | 📦 **CHIUSA DICHIARANDO** | non era un lavoro, era una **decisione presa** il 16/08 (*«lasciare com'è, scrivendolo»*): una decisione dentro una coda di cose da fare fa smettere la coda di dire cosa c'è da fare |
| **54** Spostare una prenotazione | ⛔ **ANNULLATA** — *«non la facciamo più»* | non chiusa: **annullata**. L'etichetta è diversa apposta, perché *«non serviva più»* e *«è stato fatto»* non sono la stessa cosa, e chi legge fra un anno non deve poterle confondere |

🔄📦 **19/08, 36ª sessione: e la 62 è uscita anche lei — CHIUSA da LUI**, a difetto **cercato e
non trovato**. ⇒ **La sezione C resta in piedi VUOTA, e la coda passa da 2 a 1.**

⚖️ **Ed è uscita dalla PORTA GIUSTA, che è il punto della riga di stamattina.** Alla sua frase
*«levala dall'elenco perché la sto lavorando in un'altra sessione»* la lettura comoda era
**cancellarla di qui**: sarebbe stata sbagliata, e l'ha chiarito lui — voleva dire *toglila dalle
cose che mi proponi*, non dai documenti. Cancellarla avrebbe buttato la scheda **viva** di un'altra
sessione, e la 62 non sarebbe risultata né fatta né annullata: sarebbe **sparita**. Restando, quella
scheda è servita fino a sera — è la premessa da cui è ripartita la caccia all'invito, e senza di lei
la caccia sarebbe ricominciata da zero. 📌 La sua riga sta ora fra le 📦 chiuse, col difetto misurato,
le **tre scelte dichiarate** che aspettano ancora una sua parola e il residuo di un'altra famiglia.

📌 **Il fatto di metodo, pagato il 19/08 mattina**: due sessioni scrivevano lo **stesso file** nella
stessa mezz'ora. A fermarmi non è stata la prudenza — è stato un `git apply` **caduto** perché la mia
base era invecchiata di due ore. ⇒ *Con più di una sessione viva, una base non è vecchia quando te ne
accorgi: è vecchia da subito.*

### D — Corpose: solo se si vogliono ATTIVARE — 1

🔄 **19/08, 35ª sessione: la 16 e la 17 sono ANNULLATE** — sua decisione: *«la sedici e la
diciassette non verranno mai fatte»*. ⇒ **Coda da 4 a 2.**
⭐ **E la 17 non è un capriccio: discende da una decisione già presa.** Serviva all'**app dei soci**,
che è **dismessa dal 25/07** per sua scelta — il canale verso i soci è il bot. Una voce che prepara
il terreno a una cosa che non esiste più non è «in coda»: è un residuo che sembra un piano.
🔎 **La 16 invece era vera e resta vera**, e va detto perché la riga non si legga come «era inutile»:
i flag di storno/cobro partita sono **davvero** OFF e **davvero** mai validati. Annullarla non dice
che il problema non c'era — dice che **non lo si affronta**, che è una cosa diversa e più onesta.

⚠️ **La 60 RESTA, e la distinzione l'ha fatta lui**: a differenza delle altre due ha **due passi su
quattro già vivi su TEST** (tabella, RPC, sezione «Circoli», `circoli-scan`, provati sui circoli veri
il 18/08 coi secreti messi da lui) e una **sua** azione in sospeso — *«prima devo andare a parlare con
Wansport»*. ⇒ Annullarla avrebbe lasciato quel codice acceso **senza nessuna voce che lo spieghi**,
che è il modo in cui un residuo diventa un mistero.


| # | cosa |
|---|---|
| **60** | 🎾 **Campi liberi nei circoli vicini** — il bot risponde «dove c'è posto giovedì alle 19» leggendo **9 circoli** invece di uno. Disegno completo e autosufficiente in `docs/circoli-esterni-disegno.md`: il login Wansport si riproduce con `fetch` (**niente browser, niente worker** — quindi non muore con Matchpoint). ⚠️ **Prima del servizio**: le condizioni d'uso dei circoli terzi, che è la questione vera, non un dettaglio. 🔨 **Passo 1 di 4 FATTO su TEST (18/08, app 6.244)**: tabella `pmo_circoli_esterni` (14 righe — 9 operativi, 1 in approvazione, 4 senza utenza), RPC con guardia staff, e la sezione **«Circoli»** in Amministrazione — nome scelto dal committente. **Sola lettura: nessuno scan, nessun contatto coi portali altrui.** 🔨 **Passo 2 di 4 FATTO su TEST (18/08, app 6.245)**: `circoli-scan` + bottone «Prova ora». ⭐ **Senza parser, e per una ragione**: il disegno chiede di MISURARE la forma di `/start` prima di scriverlo, e nessuno può farlo senza un login — quindi il primo giro è uno strumento di misura, e `azione:'scan'` risponde **501** invece di zero campi liberi (un «non c'è posto» falso sarebbe il difetto peggiore di questo servizio). Sei protezioni nel codice — disarmata senza credenziali, un circolo per volta, solo ciò che la tabella autorizza, 60″ fra due letture, sola lettura, `User-Agent` che dichiara chi siamo. Banco con finto Joomla **24/24**, rosso su **4 sabotaggi**. ✅ **PROVATA SUL VERO il 18/08**, su tre circoli, dopo che il committente ha messo i secreti: login **1,7-1,8 s**. ⭐ **E la misura ha risposto alla domanda aperta del disegno con una TERZA risposta: `/start` è un GUSCIO** — 1,07 MB, **zero orari**, **zero «padel»**, **2229 segnaposti di template**, identico sui tre ⇒ è la piattaforma. Un parser HTML avrebbe detto «nessun campo libero»: il «no» falso. La pista per il **passo 2b** sono i bundle minificati (`ws5-libs-start.min.js`), che sono **pubblici** e si leggono senza login. 🔄 **Una lettura al giorno per circolo** (sua decisione: *«prima devo andare a parlare con Wansport»*) — e in quell'assetto il servizio **non può dire «c'è posto»**, solo com'era ieri. Restano i passi 3-4. ⛔ **Non toccata la produzione**, e la sezione **non è ancora stata guardata in un browser** — quello vuole il Mac |

---

## 🆕 Nate misurando, **non** ancora in coda

Nella **45ª** (20-21/08, notte). ⚠️ Stanno qui e non fra le 📦 chiuse per la stessa ragione delle
tre della 44ª: non erano voci numerate. **Tre sono FATTE, fuse e deployate sui soci** (le ultime
tre dell'elenco); **le prime tre sono MISURATE E BASTA** — nessuna promossa, e la scelta di cosa
farne resta sua.

🔄⬆️ **Aggiornamento del 21/08, 46ª sessione: due delle tre "misurate e basta" sono state promosse
da lui, e sono diventate voci numerate.** L'avviso che si mette in fila è la **64** (la sua metà
piccola e curabile: l'avviso che parte su una partita che stiamo cambiando noi); gli inviti
attaccati al vuoto sono la **63**. ⇒ Le loro schede restano **qui per intero** — sono il racconto
del momento in cui il difetto si è visto — e il lavoro sta di sopra, fra le 🔴 urgenti.
⚠️ **E leggendole insieme si vede la cosa che è costata la giornata**: la scheda della 64 dice
*«arriva anche a chi il gesto l'ha fatto»*, e i destinatari erano **quattro**, di cui **tre** che
non avevano toccato niente. Non è un errore di chi l'ha scritta: l'ha scritta chi ha visto arrivare
**il proprio** messaggio. ⇒ Vedi il filo della 46ª, in cima.
📌 E sono nate tutte **guardando la cosa vera insieme a lui**, non rileggendo il codice: dai suoi
screenshot, da una partita che aveva spostato, e da due ore di prove col bot su **persone vere**.
*In quelle due ore sono usciti cinque difetti che settimane di riletture non avevano visto.*

- 🚨⭐⭐ **UN AVVISO AUTOMATICO SI METTE IN FILA DAVANTI A UNA RISPOSTA CHE STAI ASPETTANDO** —
  *portata da lui con due screenshot, 21/08 notte, e la sua diagnosi era SBAGLIATA in un modo che
  vale più della diagnosi giusta.*
  🗣️ Sue parole: *«secondo me c'è un problema di lettura del nostro gestionale. È andato troppo
  veloce a leggere prima che c'era la notifica»*.
  📏 **Misurato, ed è il contrario: è andato LENTO.** Al secondo, dal registro del bot e da quello
  del worker messi insieme —
  `00:12:25` conferma l'annullamento · `00:14:15` **il worker fallisce** (`/cancel-booking`,
  `locator.click: Timeout 10000ms`, un `fancybox-overlay` di Matchpoint si mette davanti al bottone
  «Annullare» e si mangia il clic) · `00:14:38` **il secondo tentativo riesce** · `00:20:03` il
  gestionale lo registra (righe vive per quella partita: **0**).
  ⇒ **L'annullamento era vero**, e il «Fatto» non era una conferma falsa — cosa che a metà indagine
  sembrava, e che è stata detta come sospetto e non come fatto finché la riga del sync non è
  atterrata. ⚖️ *Fra «il worker ha fallito» e «il bot ha mentito» ci sono 23 secondi e un secondo
  tentativo: chi si ferma al primo dei due referti scrive la voce sbagliata.*
  🚨 **Il difetto vero sta in quei 2 minuti e 13 secondi di attesa**: dentro ci è entrato un avviso
  `tornata_incompleta`, che gli è comparso fra «⏳ Attendi un attimo…» e la risposta. Da fuori
  sembra che il bot abbia risposto un'altra cosa.
  📏 **E il meccanismo è stato guardato prima di proporre una cura**, che è ciò che ha impedito di
  scrivere la cura sbagliata: quell'avviso **non nasce dal gesto**. `promemoria.ts` fa un **giro
  periodico** che confronta i giocatori di **adesso** con quanti ne aveva contati **l'ultima volta**,
  e se il numero è calato avvisa. ⇒ Non sa che c'è una conversazione in corso, e **non sa chi ha
  causato il calo**: non lo sa *per costruzione*, non per dimenticanza.
  ⚖️ **Perciò NON è una riga da correggere**, ed è il motivo per cui il 21/08 non è stata toccata:
  per fargli saltare chi ha premuto il bottone servirebbe che il bot ricordasse **chi ha fatto
  cosa** — cioè una memoria parallela, contro la regola ferrea (*il gestionale SA, il bot DICE*).
  📌 Tre difetti distinti, e si curano in tre posti diversi: ① un avviso può scavalcare una risposta
  attesa; ② quell'avviso era **già superato quando è partito** (alle 00:13:09 l'annullamento era
  confermato dalle 00:12:25: gli ha ricordato la scadenza per disdire una partita che stava
  sparendo); ③ è arrivato **anche a chi il gesto l'aveva fatto**.

- ✅🔨⭐⭐ **LA CONFERMA SUL «TOGLI» FUNZIONA SUL BOT VIVO — provata su tre persone vere.**
  ⭐ Vale scritta perché chiude, **sulla cosa e non sul banco**, la paura più grossa della 44ª: il
  sabotaggio che spostava il bottone da *«chiedi conferma»* a *«esegui»* restando verde 1320 volte
  su 1320. Dal registro, `00:11:04` `chiedi_segnati` → `00:11:07` **«Vuoi togliere 3 giocatori?»**
  coi tre nomi → `00:11:10` conferma → `00:11:37` fatto. **Una conferma sola per il gruppo**, che è
  la sua decisione (*«sì, chiedimelo sempre»*), e gli avvisi ai tre partiti davvero.
  📌 E un pezzo **NON** l'ha ancora visto nessuno: la frase che dice **perché** un giocatore non
  esce. Lo stesso gesto era fallito alle 22:57 con tre *«non ci sono riuscito»* generici — ma quello
  era **prima** che la cura andasse viva (23:16), quindi non è una regressione: è la vecchia
  versione. Stanotte è andata bene, e la frase nuova è rimasta invisibile.

- ⚠️⭐ **SPOSTARE UNA PARTITA LASCIA GLI INVITI ATTACCATI AL VUOTO, IN SILENZIO.**
  📏 Visto sul vero il 21/08: la prenotazione `9535` si è spostata dal **24** al **31 agosto** (la
  riga del 24 `deleted: true`, quella del 31 viva). L'invito mandato a una persona restava agganciato
  a `2026-08-24|14:00|1`, che **non esiste più** ⇒ nel bot quella partita non compare, l'invito non è
  né vivo né morto, e **non l'ha saputo né l'invitata né chi l'aveva mandato**.
  ⚖️ Non è un difetto aperto dal lavoro sulle 3 ore: è la famiglia degli **inviti orfani**, che nel
  repo del bot ha già un banco suo (`sabotaggi-inviti-orfani.mjs` — con un colpo dall'àncora scaduta
  da prima della 44ª, residuo dichiarato).

- ✅🎨🗣️⭐⭐ **NOVE SEGNI MONOCROMI DIVENTANO COLORATI — e la guardia impara a leggere i BOTTONI.**
  *(#49, 21/08)* 🗣️ Sua segnalazione, col telefono in mano: *«l'emoticon in testa a invita un
  giocatore è scuro. Abbiamo detto che gli emoticon grigi o neri o bianchi non si devono mettere»*.
  E la regola, detta per esteso quando gli ho chiesto conferma sui rimpiazzi: *«il nero e il bianco,
  se non hanno un contorno, cioè un background di un colore diverso, non si vedono»*.
  ⇒ **Non è una preferenza estetica**: un segno nero su fondo bianco non è un segno, è **un
  carattere in più**, e il bottone perde la cosa che doveva farlo riconoscere a colpo d'occhio.
  🚨 **Erano NOVE, non uno** — trovati cercandoli tutti invece di curare il caso segnalato:
  `➕ Invita un giocatore` · `➖ Togli un giocatore` · `➕ Invita una persona nuova` ·
  `➖ Togli qualcuno dalla rubrica` · il `➕` dell'elenco invitabili · `◀ Torna alle domande` ·
  `◀ Giorni prima` · `Altri giorni ▸` · `◀ Altri giorni`. Adesso `🎾 👋 ⬅️ ➡️`.
  ⚖️⭐⭐ **E IL REPERTO È PERCHÉ ERANO ANCORA LÌ**: la guardia contro i segni monocromi **esisteva
  già** — nata il 20/08 da una sua osservazione sul telefono di Lidia — ma controllava **l'apertura
  dei MESSAGGI**, e questi erano tutti **BOTTONI**. La stessa malattia, nella metà che nessuno
  guardava. 📌 *Una guardia che copre metà della superficie non protegge metà del problema:
  protegge la metà che qualcuno si era ricordato di elencare, e lascia crescere l'altra.*
  🚨⭐ **E LA SONDA STESSA MISURAVA MALE, trovato provando**: l'intervallo `U+2795-27BF` contiene
  anche `➡` (U+27A1), che col carattere invisibile **`U+FE0F`** diventa la freccia **azzurra** `➡️`
  — mentre la gemella `⬅️` (U+2B05) sta **fuori** dall'intervallo. ⇒ La regola vecchia avrebbe
  **bocciato una freccia colorata e lasciato passare la stessa freccia nera**: una sonda che
  risponde con sicurezza alla domanda **vicina** a quella giusta, che è la 24ª. Ora la regola è
  *nell'intervallo **e senza** `U+FE0F`*, che è il meccanismo con cui Unicode dice «a colori».
  ⚠️ **Il buco che resta è dichiarato nel codice**: `➕️` col `U+FE0F` passerebbe e resterebbe nero
  lo stesso, perché quel segno una versione colorata non ce l'ha.
  🔁 **Tre casi sono caduti, e nessuno per il comportamento**: riscrivevano i segni **a mano**
  invece di prenderli dalle costanti — e l'avvertimento era **già scritto** in `mai-un-vicolo-cieco`
  (*«un carattere copiato non diventa rosso: resta verde guardando un segno che non esiste più»*).
  ⇒ Le due frecce entrano nel **vocabolario** (`EMOJI.indietro`/`avanti`), così la guardia del
  monocromo le copre da sola. 🔪 E **due sabotaggi avevano l'àncora scaduta**, dicendo «non
  protetto» dove la protezione c'è: ri-ancorati, non tolti.

- ✅🚨⭐⭐ **CHI È IN CAMPO LEGGE CHE È IN CAMPO — il difetto che non rompeva niente, con una
  persona vera dentro.** *(#50, 21/08 notte.)*
  📏 **Il fatto, al secondo, dai due registri messi insieme:** `00:34:26` Lidia accetta l'invito ·
  `00:36:48` **il worker fallisce** (`PLAYER_ID_NOT_LOCKED`: l'autocomplete di Matchpoint non
  aggancia, la casella dell'id resta vuota, e il worker **si rifiuta di salvare** — fallisce
  **chiuso**, ed è giusto) · `00:36:49` lei ritocca · `00:37:41` **il secondo tentativo RIESCE** e
  il bot le scrive «✅ Sei in campo» · `00:37:41` **nello stesso secondo lei ritocca ancora**, e la
  risposta a quel tocco — «Avevi già risposto» — **riscrive sopra** la buona notizia.
  ⇒ **È rimasta in campo senza saperlo**, con davanti agli occhi un *«non ci sono riuscito,
  contatta la segreteria»*. 📌 *Il tocco che ha cancellato la notizia è proprio quello che uno fa
  perché non l'ha ancora vista.*
  ⚖️ **Dove NON stava la cura**, ed è la metà che ha impedito di scrivere quella sbagliata: **non**
  nel meccanismo dei messaggi, che è giusto (si risponde riscrivendo la schermata del bottone, e ha
  già il suo ripiego: se non riesce a riscrivere, manda nuovo). La cura è nell'**ordine dei
  motivi**: *se la persona È in campo, quello è il fatto, e nessuna contabilità dell'invito lo
  batte.* Ritirato, scaduto, già risposto sono cose vere dell'**invito**; nessuna delle tre è più
  importante di **dove si trova la persona adesso**.
  📌⭐⭐ **E LA REGOLA ERA GIÀ SCRITTA IN QUEL FILE, DUE RIGHE SOTTO**, applicata a **un caso solo**:
  *«Prima "ci sei già" e poi "è pieno": chi è già in campo su una partita al completo deve leggere
  che è dentro, non che è arrivato tardi. L'ordine è la frase che riceve.»* Valeva contro «è pieno»
  e non contro gli altri tre. ⇒ *La stessa regola applicata in un punto e non nell'altro è il modo
  in cui questo difetto è già tornato più volte su questo progetto.*
  🚨🔨 **Il verde che non voleva dire niente**: dopo la cura il banco è rimasto **verde su 1344
  casi**, perché quel comportamento non lo guardava nessuno. I casi sono stati scritti **dopo**, con
  un sabotaggio che rimette il difetto di Lidia **identico** e uno che prova la **bugia opposta**
  («ci sei già» detto a chi in campo non c'è). 1346 verdi, sabotaggi 5 su 5.
  ⛔ **Quello che questa cura NON fa, dichiarato**: l'autocomplete di Matchpoint continua a non
  agganciare ogni tanto (ha colpito **Fabiola alle 22:55 e Lidia alle 00:36**, e il 19/08 «Ospite»
  due volte), e **ogni tentativo costa ~52 secondi**. Quello è di là, ed è la voce **A** dei
  difetti misurati e non curati.

- ✅⏳🗣️⭐⭐ **GLI INVITI DURANO 3 ORE — e la scadenza vale finalmente da TUTT'E DUE I LATI.**
  🗣️ Sue parole, in due frasi a un minuto l'una dall'altra: *«tagliamo la testa al toro. Gli inviti
  mandati alle persone durano 3 ore. Non di più. Dopodiché spariscono»*, e poi *«sull'invio dopo la
  mezzanotte il messaggio deve durare un po' di più, perché uno va a dormire dopo mezzanotte e si
  sveglia alle sei di mattina minimo»*.
  ⇒ **Tre regole in ordine**: ① 3 ore · ② mai prima delle **9 del mattino**, che è la sveglia (6)
  più le 3 ore per leggerlo · ③ mai oltre l'inizio della partita, che **vince sulle altre due**.
  ⚖️ **La notte è scritta guardando QUANDO l'invito muore, non quando è partito**, e non è una
  libertà presa: il danno che lui descrive è *morire mentre l'altro dorme*, e a quel danno l'ora
  d'invio non importa. Un invito mandato alle **23:00** morirebbe alle 02:00 — lo stesso caso, che
  la formulazione «mandato dopo mezzanotte» avrebbe lasciato fuori.
  🚨⭐⭐ **E LA METÀ CHE MANCAVA, misurata PRIMA di toccare una riga: la scadenza valeva DA UN LATO
  SOLO.** Chi riceveva l'invito e toccava «Ci sto» si sentiva dire «scaduto» (`statoInvito`);
  l'**elenco di chi puoi invitare** non guardava l'orologio per niente — e da quella lettura sola
  scendono **quattro** comportamenti: i nomi sotto «gli inviti mandati», i bottoni «ritira»,
  l'esclusione dall'elenco degli invitabili, e la frase del 20/08 che spiega perché un nome non
  compare. ⇒ Cambiare **solo il numero** avrebbe prodotto una cura che *sembra* fatta.
  ⚖️⭐⭐ **E non era una dimenticanza, che è la cosa da ricordare**: `invito-partita.ts`
  **dichiarava** che a guardare l'orologio pensa «chi legge» — e chi legge **non lo faceva**. *Un
  contratto scritto e non onorato è peggio di un buco: chi rilegge trova scritto che il caso è
  coperto, e smette di cercare.* Adesso «chi legge» ha un nome, ed è scritto lì accanto.
  📏 **Perché non si vedeva**: la scadenza cadeva **all'inizio della partita**, e a quell'ora
  quell'elenco non lo guarda più nessuno ⇒ il 20/08 gli inviti scaduti-ma-in-sospeso erano **zero
  in tutto il sistema**. Con le 3 ore diventa il caso di tutti i giorni.
  📏 **E una misura ha smentito la scheda, senza cambiare la conclusione**: la consegna diceva che
  invitare la stessa persona a **più partite** «nei dati non è mai capitato». È capitato: il 20/08
  alle 20:51, per **46 secondi**, due inviti vivi su due partite diverse. ⇒ Quella metà non era
  solo prevista dal codice — il database l'aveva già accettata. Non c'era niente da costruire.
  🔨 **1343 casi verdi** (+9) e **8 sabotaggi su 8**, compresi i due che rimettono apposta la **cura
  a metà**. ⭐ I casi nuovi entrano da `schedaInvito`, cioè **dal bottone**: è la lezione della 44ª
  (*un caso che chiama il passo a mano non prova il bottone*) applicata a un altro filo.
  ⛔🔪⭐⭐ **UN NONO COLPO C'ERA E NON MORDE, ed è dichiarato invece che tolto in silenzio**: la riga
  che passa l'orologio **alla creazione** dell'invito. Il banco **non raggiunge quel codice** —
  `statoScrittura()` vi risponde `simula: true` — e per arrivarci un caso dovrebbe **dichiararsi la
  produzione**, cioè spegnere dentro il banco l'unico freno che impedisce di mandare «vieni a
  giocare» a persone vere durante una prova. ⚖️ *Un sabotaggio che non morde è una domanda sul
  codice; qui la risposta non era «togli il colpo», era «quel codice non lo prova nessuno, e il
  motivo è buono».* La ragione sta in testa a `test/sabotaggi-scadenza-invito.mjs`.
  📌 **Non è retroattivo**: l'unico invito vivo alla consegna tiene la vecchia scadenza.

⬇️ Nella **44ª** (20/08, sera), tutte e tre **chieste da lui** e tutte e tre **fuse e deployate sui
soci**. ⚠️ Restano qui e non fra le 📦 chiuse perché non erano voci numerate: erano ordini suoi
dati a voce nella sessione stessa.

- ✅🎨⭐⭐ **LA VETRINA DELLE OTTO FORME (`/stili`) — e la domanda vera non era il quadratino.**
  🗣️ *«ho fatto un test con le spunte, però non è che visivamente si capisca molto. Mi sviluppi
  altri modi similari in cui quando io spingo su un nome si vede che quel nome viene selezionato?»*
  ⇒ Otto forme, **una bolla per ciascuna**, con quattro nomi finti da toccare. Il comando è **fuori
  dal menu ☰** (come `/invita`, e per la stessa ragione: è un attrezzo per decidere), **non scrive
  niente** da nessuna parte, e il bottone «Manda» è una **fotografia inerte con un codice suo** —
  dargli il dato di un nome avrebbe fatto un bottone che promette una cosa e ne fa un'altra.
  ⭐ Le tre misure che hanno disegnato le forme stanno nel **secondo filo** qui sopra: il testo dei
  bottoni è **centrato** (un segno solo a sinistra fa ballare i nomi), il contrasto vero è di
  **colore** e non di forma, e una delle otto deve reggere in **bianco e nero**.
  🔨 Il banco è quasi tutto **giri su `STILI`**: difende anche la nona forma, che scriverà chi non
  avrà letto niente di tutto questo. **Tre buchi li ha trovati il banco, non una rilettura** —
  `Number('') === 0` faceva passare un dato tagliato (`vs|a|`) come **tocco sul primo nome**; la
  prova dell'ordine si fermava al quarto e restava verde togliendo il ripiego oltre la nona cifra;
  il caso del «non si mescolano» usava due forme con segni **diversi** e restava verde buttando via
  il controllo della forma. **12 sabotaggi, tutti visti.**
  📌 **PR #42 del repo del bot, fusa e deployata sui soci.**

- ✅⬜🗣️ **LA SPUNTA DELL'INVITO DIVENTA IL `✅` VERDE — la 2.**
  ⚖️ **La riga vecchia non era sbagliata**: `⬜`/`☑️` è la coppia «quadratino spento / quadratino
  segnato», il modo in cui una spunta si disegna da sempre. Ma poggiava su una cosa che **sul
  telefono non regge** — i due quadratini hanno la **stessa taglia**, e su parecchi sistemi il
  segnato è grigio spento. ⇒ Col `✅` cambia il **colore**, non la forma.
  🚨 **E i TRE casi che scrivevano il carattere a mano ora leggono le costanti.** Non è pulizia:
  col carattere copiato sarebbero rimasti **verdi guardando un segno che non esiste più** — una
  protezione svuotata senza che nessuno la tolga.
  ⭐⭐ **La guardia nuova nasce da un verde sospetto**: cambiato il segno, il banco è rimasto verde
  su **1299 casi su 1299**. È giusto — *quale* segno sia è una decisione, non un difetto, e i casi
  leggono le costanti apposta — ma vuol dire che da lì in poi **nessuno guarda più** che i due
  segni siano **diversi**. Con `SPUNTA_SI === SPUNTA_NO` la selezione diventerebbe **invisibile sul
  telefono** col banco tutto verde: cioè il difetto che la vetrina è nata per curare, rimesso
  dentro il codice.
  📌 **PR #43 del repo del bot, fusa e deployata sui soci.**

- ✅👋⭐⭐ **LE SPUNTE SUL «TOGLI UN GIOCATORE», COL `👋` E LA CONFERMA CHE RESTA — la 8.**
  🗣️ Suo ordine: *«aggiungi come primo task da fare la spunta sugli invita e togli un giocatore»*.
  ⚠️⚠️ **NON è la gemella dell'invito**, ed è la cosa da capire prima di scrivere una riga: dall'invito
  si torna indietro (si ritira), da qui **mai**; l'invito **non ha** conferma ed è una sua decisione,
  qui **c'è** e difende l'irreversibile; l'invito manda un **messaggio**, qui si **scrive sul
  gestionale del circolo**. ⇒ Copiare la forma dell'invito riga per riga avrebbe portato con sé anche
  ciò che sull'invito è giusto **perché lì non c'era niente da perdere**.
  ✅ **La conferma resta, una sola per tutto il gruppo** — sua decisione fra tre strade: *«sì,
  chiedimelo sempre»*. I nomi si leggono **uno per riga**: è l'ultima schermata prima di una cosa che
  non si disfa, e una riga per nome è la forma in cui l'occhio conta senza rileggere.
  ⭐ **Il bottone della conferma porta i segni DENTRO il dato** invece di rileggerli dallo schermo:
  quello che il testo nomina e quello che il bottone toglie sono la stessa lista, decisa nello stesso
  istante. ⇒ È la voce della **frase e del roster che dicono due numeri diversi** (qui sotto) evitata
  **per costruzione**, invece che curata dopo.
  🚨 **L'esito è PER PERSONA**, e il segno in testa lo decide **l'esito, mai l'intenzione**: `✅` solo
  se qualcuno è uscito davvero · `👍` se erano già tutti fuori · `⚠️` se non è andata. Fra la spunta e
  il tocco su «Togli» passano minuti, e uno può essere già uscito: un «fatto» detto per il gruppo
  sarebbe **falso su di lui**, un «non ha funzionato» detto per il gruppo manderebbe a **rifare** ciò
  che per gli altri era riuscito.
  ⛔ **E il racconto del gruppo NON scrive quanti restano in campo**, deliberatamente: è proprio il
  numero che nella voce qui sotto contraddice l'elenco. **Non se ne fa una seconda copia.**
  ⭐ Lettere **nuove** (`s`, `q`, `z`): i bottoni sono fotografie, e un «Togli un giocatore» aperto
  ieri deve continuare a fare quello di ieri. `c` e `k` non cambiano di un carattere.
  🔨 **17 sabotaggi, tutti visti** — compresi i tre buchi del **primo filo** qui sopra.
  📌 **PR #44 del repo del bot, fusa e deployata sui soci.**

⚠️ **Il residuo dichiarato, e vale per tutte e tre: nessuna è stata guardata su un TELEFONO.** Il
banco dice che il codice fa la cosa giusta; **cosa il socio VEDE lo dice solo un telefono** — e la
terza è la schermata che **scrive sul gestionale del circolo**. 🗣️ La scelta di mandarle in servizio
senza anteprima è **sua e dichiarata** (*«si fondi e si deploy sul bot dei soci»*, detto due volte).
🚨 Nessuna delle tre è provabile fino in fondo sul **bot di prova**: in collaudo l'invito non parte
affatto, quindi la funzione esce **prima** della schermata nuova.

🔎 **E una riga della 43ª si chiude, misurandola invece di ricordarla.** La scheda della frase e del
roster lasciava aperto: *«ai tocchi `togli conferma` delle 21:03:30 e 21:04:11 non segue nessuna riga
di risposta»*, con l'avvertenza che la regex della sonda non conteneva `tolt`. ⇒ Riletto il registro:
**le righe ci sono**, alle `21:03:33` e `21:04:15`, e dicono ⚠️ *«Quella persona non risulta più in
partita»* — cioè la famiglia **«non si può»**, non il `👍 avevo già tolto` che la scheda dava per il
comportamento giusto. 📌 Misura, **non diagnosi**: è una lettura sola, incontrata di striscio, e
quale delle due frasi sia quella giusta lì **non è stato guardato**.

Nella **43ª**, da uno **screenshot suo** e poi misurando (20/08, tardo pomeriggio):

- 🚨⭐⭐ **LA FRASE E IL ROSTER, NELLA STESSA BOLLA, DICONO DUE NUMERI DIVERSI.** 🗣️ Sue parole
  mandando la foto: *«ho tolto Lidia e Fabiola dalla partita, però come vedi nel messaggio in fondo
  dice che sono ancora presenti, e questo non è corretto»*.
  📏 **Misurato nel registro, e la misura dice più della foto: si contraddicono in TUTT'E DUE I
  VERSI** — il che **esclude** «il roster è indietro», perché un ritardo sbaglia sempre dalla stessa
  parte.

  | ora | tolta | la FRASE dice | il ROSTER sotto mostra |
  |---|---|---|---|
  | `21:02:43` | Fabiola | *«Adesso in campo **ci sei solo tu**»* (= 1) | ⭐ Maurizio **e Lidia Comes** (= **2**) |
  | `21:06:02` | Lidia | *«Adesso in campo **siete in 2**»* | ⭐ Maurizio e **tre posti liberi** (= **1**) |

  ⇒ **Le due metà della stessa bolla vengono da due fonti diverse e non si parlano**: il numero
  della frase è `restano`, che arriva dalla **risposta del gestionale alla rimozione**; l'elenco
  sotto è il roster passato da `roster-di-recente`, la memoria in processo che toglie chi è appena
  uscito. Nella prima riga la memoria non aveva ancora tolto Lidia; nella seconda le aveva tolte
  tutt'e due mentre il gestionale ne contava ancora una.
  🔎 **La cura non è aggiustare il numero: è farlo venire dallo STESSO POSTO da cui viene
  l'elenco.** Un numero calcolato dal roster che si sta per mostrare **non può** contraddire quel
  roster — è vero per costruzione. Oggi sono due misure indipendenti della stessa cosa, e due
  misure indipendenti prima o poi divergono. ⇒ *Il difetto non è il valore sbagliato: è che i
  valori siano DUE.*
  ⚖️ **Parente stretto della voce qui sotto (la chat fuori ordine), ma NON la stessa cosa**: là due
  bolle diverse si smentiscono per una questione di **posizione**, qui è **una bolla sola** che si
  smentisce **da sé**. 🚨 *Due difetti che si vedono nella stessa schermata non sono lo stesso
  difetto* — ed è la seconda volta oggi che vale, sulla stessa partita e con le stesse persone.
  📌 **Cura NON scritta.** Voce fra le «nate misurando», **non promossa**.
  🔎 **E una cosa da RIGUARDARE, non da concludere**: ai tocchi `togli conferma` delle `21:03:30` e
  `21:04:11` **non segue nessuna riga di risposta nel registro**. Non è (ancora) un difetto — la
  regex della sonda non conteneva `tolt`, quindi una risposta *«👍 Avevo già tolto Lidia Comes»*,
  che è il comportamento **giusto** del freno, sarebbe stata **filtrata via**. Va riletto con
  `cerca` = `tolt|togli`. 📌 *Una riga che manca in un log filtrato non è una riga che manca.*

- ✅⭐ **LE PAROLE DEI DUE GESTI GEMELLI, UNIFORMATE — e non era estetica.** 🗣️ *«se abbiamo messo
  togli un giocatore direi che possiamo uniformarlo mettendo anche invita un giocatore»*.
  📏 **Misurato prima di toccare**: «amico» era l'**unica stringa visibile di tutto il bot** con
  quella parola, contro **quindici** che dicono «giocatore» — compresa quella che sta **due
  centimetri sopra lo stesso bottone** nella scheda «✅ Prenotato» (*«Tocca qui sotto per invitare
  i giocatori»*). Il socio leggeva «giocatori» e toccava «amico». ⇒ Non si imponeva una regola
  nuova: si **toglieva un'eccezione**.
  ⛔ **La forma corta («Togli» / «Invita») l'ha offerta lui e NON è stata presa**, con la ragione
  detta: collide con una **sua** decisione del **5/08** — su Telegram i bottoni sono tutti dello
  stesso colore, e «Togli», «Esci dalla partita» e «❌ Annulla la partita» stanno a un dito di
  distanza. ⇒ Accorciare lì non è sintesi, è togliere l'unica difesa rimasta a tre bottoni vicini
  di cui uno è irreversibile.
  ⭐ Le due etichette sono diventate **costanti gemelle, accanto**: due etichette che descrivono il
  verso opposto dello stesso gesto devono potersi leggere insieme, o si uniforma una e si dimentica
  l'altra. 🔨 `test/parole-uniformi.test.ts` difende **le due decisioni che tirano in versi
  opposti** (uniformare / non accorciare) nello stesso file — o chi uniformasse **accorciando**
  resterebbe verde. 10 sabotaggi, tutti visti.
  📌 **PR #39 del repo del bot, fusa e deployata sui soci.**

- ✅🗣️ **«COME PROSEGUO?» E «NON POSSO FARE INVITI MULTIPLI» ERANO LO STESSO DIFETTO.** 🗣️ *«dopo
  che io ho aggiunto un giocatore sulla mia chat tu me lo confermi, però poi come proseguo? Tra
  l'altro mi sono accorto adesso che non posso fare una richiesta multipla di inviti»*.
  ⭐ Il testo prometteva *«nel frattempo puoi invitare anche altri»* e sotto ci metteva **la scheda
  della partita**: la parola diceva «continua», lo schermo diceva «finito». ⇒ *Una frase che
  promette una strada e una schermata che ne offre un'altra non è un'imprecisione: è la strada che
  manca.*
  📏 **E l'invito multiplo non aveva bisogno di nessuna meccanica nuova**, misurato prima di
  scrivere: ① la gara *«il posto lo prende chi risponde per primo»* è già decisa al momento della
  **risposta** (`esitoDellaRisposta` rilegge il roster e dà `posto_finito`), non dell'invio;
  ② `invitabili` toglie già da sé chi è in campo e chi ha un invito in sospeso. **Mancava solo lo
  schermo.**
  ⚖️ Rovescia a metà la regola del 19/08 (*«dopo un invito mandato si resta sulla partita»*), e va
  detto: quella regola nasceva perché *«senza la scheda sotto quel "puoi" non aveva dove»* — il
  problema era il **vicolo cieco**, non la partita. Qui il «dove» c'è ed è migliore, e il ritorno
  alla partita resta in fondo.
  📌 **PR #40 del repo del bot, fusa e deployata sui soci alle 14:48.**

- ✅⬜⭐⭐ **LA SCELTA A SPUNTE — e la domanda vera non era il quadratino.** 🗣️ Chiesta da lui
  **dopo averlo visto dal vivo**: *«vorrei la possibilità di decidere con una spunta chi voglio
  invitare, quindi uno, due, tre, quattro, cinque, sei, sette giocatori, facendo sì che col flag li
  attivo per inviarli e poi un bottone sotto per l'invio»*.
  ⚖️ **Rovescia la forma «un tocco, un invito» che aveva scelto lui stesso, e che IO avevo difeso**
  con un conto di tocchi (3 contro 4, e chi ne invita uno solo passa da 1 a 2). Aveva ragione lui:
  *una decisione presa guardando la cosa vera vince su una presa guardando un conto.*
  ⭐⭐ **La domanda vera era DOVE VIVE LA SELEZIONE fra un tocco e l'altro.** Le tre strade ovvie
  hanno tutte un difetto: una memoria in processo **si perde al riavvio** (e i deploy del bot
  riavviano — misurato tre volte nella stessa giornata), una memoria su database va scritta e
  ripulita, e il `callback_data` ha **64 byte** in tutto.
  ⇒ La quarta: **la selezione È LO SCHERMO.** Telegram, insieme al tocco, ridà il messaggio con la
  sua `reply_markup`, e le spunte si rileggono da lì (`segnatiIn`). Niente da tenere, niente da
  scadere, e due partite aperte nella stessa chat non si mescolano — ogni messaggio porta le sue.
  📌 `TgMessage` non dichiarava quel campo: **Telegram lo mandava già**, non si poteva leggere.
  🚨 Lettere **nuove** (`p`, `q`) e non riuso di `m`: i bottoni vecchi restano in chat e toccabili,
  e cambiare il significato di una lettera già disegnata fa fare al bottone vecchio **una cosa
  nuova** — il difetto peggiore, perché è silenzioso.
  🚨 La spunta dice **«lo volevo», non «si può»**: all'invio si passa dall'elenco riletto adesso,
  perché fra il flag e il tocco su «Manda» possono passare minuti.
  📌 **PR #41 del repo del bot, fusa e deployata sui soci alle 20:52.**

- ✅🎨🗣️ **L'EMOJI SU TUTTI I MESSAGGI: un vocabolario di famiglie, non cento decorazioni.**
  🗣️ Guardando il telefono di una socia: *«guarda l'ultimo messaggio che ha ricevuto, non ci sono
  gli emoticon. Secondo me vanno messi sempre. Il motivo? Così differenziamo un messaggio
  dall'altro.»* 📏 Misurato: su **~118 aperture di messaggio, solo 10** avevano un'emoji.
  ⭐⭐ **La sua ragione detta anche COME sceglierle**, ed è il pezzo da non perdere: se ogni
  messaggio avesse la sua, cento emoji diverse non differenzierebbero niente — sarebbero cento
  decorazioni. A distinguere è la **ripetizione**. ⇒ *Un'emoji per messaggio è decorazione;
  un'emoji per FAMIGLIA è un vocabolario.*
  ⇒ **Undici famiglie** in `EMOJI` (`lib/formato.ts`), **in un posto solo**, approvate da lui:
  ✅ fatto · 👋 brutta notizia · 🎾 invito · ❓ domanda · ⚠️ non si può · 🔧 guasto · ⏰ promemoria ·
  👍 ho preso nota · 💶 soldi · 🎯 livello · 📇 rubrica.
  🚨 **Tutte a colori, ed è un requisito e non un gusto**: `➖` (U+2796) esce **nero** su Telegram,
  e in una colonna di testo nero non si vede — *«non lo devi mettere nero o grigio»*, sue parole.
  La guardia vieta la **classe** (il blocco «matematico»), non il singolo carattere: vietare il
  solo `➖` lascerebbe passare il `➕`, che ha lo stesso identico difetto.
  ⚠️ **RESIDUO DICHIARATO**: convertiti i **cinque** file che il socio incontra nell'uso normale
  (invito, togli, uscita, avvisi, rubrica). Restano `ingresso-testi.ts` (l'ingresso, che si vede una
  volta sola) e le schermate di `gestisci-testi.ts`, che hanno già la loro testata. **La guardia lo
  dichiara nel proprio commento** invece di lasciar credere di coprire tutto.
  📌 **PR #41**, insieme alle spunte.

⚠️ **E il residuo che vale per tutte e quattro: nessuna è stata guardata su un TELEFONO da lui.**
Il banco dice che il codice fa la cosa giusta; **cosa il socio VEDE lo dice solo un telefono** — ed
è la lezione che questa giornata ha imparato tre volte. 🚨 Le spunte per giunta **non sono
provabili sul bot di prova**: in collaudo l'invito non parte affatto (è un messaggio a una persona
vera, e un Telegram di prova non esiste), quindi la funzione esce **prima** della schermata nuova.


- 🚨⭐⭐ **LA CHAT NON È PIÙ IN ORDINE DI TEMPO, E DUE BOLLE VICINE SI SMENTISCONO SU UN FATTO
  CONTABILE.** 🗣️ Sue parole mandando la foto: *«segnati anche questo messaggio da correggere
  perché c'è troppa roba che si contraddice»*.
  📏 **Cosa si legge nella foto, dall'alto in basso:**

  | | |
  |---|---|
  | in alto | **«Fatto: Fabiola Limuti non è più nella partita di lunedì 24 agosto alle 14:00, campo 1.»** · *«Adesso in campo ci sei solo tu»* · roster: ⭐ Maurizio Aprea e **tre** posti liberi |
  | in basso | **«Fabiola Limuti ci sta: è in campo per la partita di lunedì 24 agosto alle 14:00, campo 1.»** · *«Restano **2** posti liberi»* |

  ⇒ Nella stessa schermata: è fuori **e** è dentro, tre posti liberi **e** due. E la seconda
  frase, stando sotto, si legge come **l'ultima notizia**.

  📏 **E il registro del bot dice che è esattamente il contrario — misurato, non dedotto:**

  | ora (Roma) | fatto |
  |---|---|
  | `15:13:59` | tocca «invito manda» ⇒ *«Hai invitato Fabiola Limuti…»* |
  | `15:14:29` | **Fabiola tocca «Ci sto»** ⇒ parte a lui *«Fabiola Limuti ci sta: è in campo… Restano 2 posti liberi»* |
  | `15:53:35` | tocca «togli conferma» |
  | `15:53:41` | **«Fatto: Fabiola Limuti non è più nella partita…»** ⇒ roster a un nome, tre liberi |

  ⇒ **Le due frasi sono tutt'e due VERE, a 39 minuti di distanza.** Nessun dato è sbagliato,
  nessuna edge ha fallito: sbagliato è **dove stanno nella chat**.

  ⭐⭐ **LA CAUSA, e non si vedeva dallo screenshot: è la RISCRITTURA SUL POSTO.** La scheda
  della partita non viene rimandata a ogni tocco — viene **riscritta dentro la bolla che
  esisteva già** (`riscriviOMandaNuovo(chatId, messageId, …)` in `bot.ts`, otto punti). Quella
  bolla sta dove è stata **creata la prima volta**, e lì resta per sempre. L'avviso *«X ci sta»*
  invece è un **messaggio nuovo**, e i messaggi nuovi vanno **in fondo**.
  ⇒ Il risultato è meccanico: **più la scheda è vecchia, più in alto sta il suo contenuto più
  nuovo.** In una chat, dove l'ordine verticale *è* l'ordine del tempo, questo non è un
  disallineamento estetico — è una **storia raccontata al contrario**.

  ⚖️ **E la riscrittura sul posto NON è un difetto da togliere: è una cura, del 19/08.** Serve a
  non lasciare in fondo alla chat una fila di schede doppione — e i doppioni erano peggio, perché
  un doppione è *un bottone vivo che promette una cosa e ne fa un'altra* (misurato sul suo
  telefono il 19/08 alle 23:42: toccò «Invita» su un doppione **di un'altra partita**, e l'invito
  partì per la partita sbagliata). ⇒ Chi «curasse» questo tornando a mandare messaggi nuovi
  riaprirebbe quel difetto. **È un compromesso da riprogettare, non un bug da rovesciare.**

  🔎 **Le tre strade, per quando la deciderà lui** — nessuna ancora provata:
  ① la scheda **si sposta in fondo** quando qualcosa la cambia da fuori (cancella e rimanda solo
  in quel caso): l'ordine torna vero, e il doppione non nasce perché la vecchia sparisce;
  ② gli avvisi che riguardano una partita **non sono messaggi nuovi** ma entrano nella scheda
  stessa, che è già l'unico posto dove quella partita si racconta;
  ③ ogni bolla **si data** («alle 15:14»), così l'ordine di lettura smette di essere l'unico
  indizio. ⚠️ Costa la riga più corta ma non toglie la contraddizione: la spiega.

  📌 **E dentro la stessa bolla resta il difetto ① della 42ª, non chiuso**: esito, «Le mie
  partite · 7 di 8» e la **scheda operativa coi bottoni** sono ancora **tre cose in una bolla
  sola**, e il grassetto separa la testata, non i tre blocchi.

  🚨 **Da NON confondere col doppio «togli» della 42ª**: quello era una scrittura fatta due
  volte, questo non scrive niente di sbagliato. Stessa persona, stessa partita, stessa foto —
  difetti diversi. ⇒ *Due difetti che si vedono nella stessa schermata non sono lo stesso
  difetto.*

Nella **42ª**, da uno **screenshot suo** e poi misurando (20/08, primo pomeriggio):

- 🚨⭐⭐ **DUE TOCCHI SU «TOGLI UN GIOCATORE» TOGLIEVANO DUE VOLTE — CURATO E VIVO SUI SOCI
  DALLE 13:57.** Sue parole guardando il telefono di chi era stata tolta: *«sono arrivati 2
  messaggi uguali, non è corretto»*. Prima ancora, sul suo: *«non mi ha aggiornato la partita.
  C'è ancora Fabiola se leggi bene il testo»*.
  📏 **La catena, dal registro del bot e dai log delle edge — non dedotta:**

  | ora (Roma) | fatto |
  |---|---|
  | `13:18:59` | tocca «✅ Confermo» |
  | `13:19:06` | «Fatto: … non è più nella partita» — e **sotto la scheda con lei ancora dentro** |
  | `13:19:07` | tocca «✅ Confermo» una seconda volta |
  | `13:19:12` | «Fatto» identico ⇒ **seconda rimozione vera** e **secondo avviso** a lei |
  | `13:24:48` | il sync riporta il roster giusto: due nomi |

  Sul gestionale: due `consumer-booking-write`, **`request_id` diversi**, `200` tutt'e due,
  `remove OK` tutt'e due. La seconda parte **0,42 s dopo che la prima ha risposto** — non un
  doppio tocco simultaneo, ma il tocco successivo lavorato dal ciclo.
  ⭐ **Due difetti legati da causa a effetto, ed è per questo che la cura è UNA.** ① La scheda
  ridisegnata dopo l'azione legge le righe che arrivano dal circolo, ferme a **prima** della
  scrittura: mostrava tre nomi sotto la frase «non è più nella partita». Non è un difetto di
  lettura — *l'elenco giusto, in quell'istante, non esisteva da nessuna parte*. ② E la scheda
  vecchia è ciò che fa toccare di nuovo.
  🚨⭐⭐ **E IL FRENO CONTRO IL DOPPIO TOCCO ESISTEVA GIÀ DAL 28/07 E NON POTEVA SCATTARE.**
  `in-corso.ts` frena una gemella **in volo**; ma il ciclo del bot lavora gli aggiornamenti
  **uno per volta con `await`**, e `gestisciTocco` li aspetta fino in fondo ⇒ due tocchi non
  si sovrappongono mai, e il secondo trova il posto già libero. Chiedeva *«ce n'è una in
  volo?»* in un mondo dove una gemella in volo **non può esistere**.
  ⚖️ **E il banco lo dichiarava senza accorgersene**: *«si può misurare solo tenendo la prima
  in volo»* — il caso tiene la prima sospesa **a mano** (`sblocca`), cioè costruisce uno stato
  che il bot vero non produce. Verde da sempre, cieco sul difetto. È la **30ª** — *una riga può
  essere giusta e non difendere niente, e a distinguerle non è rileggerla* — al livello di un
  modulo intero, con la sua prova che dice la verità e misura un'altra cosa.
  🔨 **La cura**: `src/mastra/lib/tolto-di-recente.ts` nel repo del bot — una memoria che chiede
  **«è già stata fatta?»** invece di «è in volo?». È la forma di `fatto-compiuto.ts`, che per
  l'**uscita** esiste già ed è il motivo per cui lì il difetto non c'è. ⇒ Il «togli» era
  **l'unico dei tre gesti senza guardia dopo l'esecuzione**: l'uscita ha `fattoCompiuto`,
  l'invito ha lo stato dell'invito. *Una regola curata in due punti su tre.*
  ⭐ Dalla stessa memoria escono le due metà: il secondo tocco **non riesegue e non riavvisa**
  (dice «Avevo già tolto X», non «Fatto»), e i roster non elencano più chi è appena uscito — il
  filtro sta in `readmodelPlayer`, il punto **unico** da cui passano tutte le sedi che mostrano
  una partita al socio. Si scorda da sé appena il circolo si è aggiornato, e scade comunque a
  15 minuti.
  ⭐ La guardia sta **PRIMA** di `ritrovaBersaglio`: dopo, il secondo tocco non troverebbe più
  quella persona nel roster e risponderebbe *«la partita è cambiata»* — vero alla lettera e
  fuorviante, che manda a cercare un guasto quando è andato tutto bene.
  🔨 Banco: **18 casi nuovi** che chiamano `schedaTogli` **due volte di seguito** (la forma che
  il bot vero produce), più **10 sabotaggi** visti cadere sul caso giusto e uno che non tocca
  niente e non atterra. Uno dei casi è di **cablaggio**, perché `readmodelPlayer` chiama la rete
  e dal banco non si esercita: senza, staccare il filtro dal ponte lascerebbe gli altri
  diciassette verdi. Suite intera **1243 verdi**, `tsc` pulito.
  📌 **PR #34 del repo del bot, fusa; deploy `prova` e poi `soci`, verdi; bot ripartito alle
  13:57 e — misurato — ancora su `qqbf… (PROD)` con `prenotazioni REALI`.**
  ⚠️ **RESIDUO DICHIARATO, e non è una formalità**: la cura è provata **nel banco**, non sul
  bersaglio. Nessuno ha ancora tolto un giocatore vero toccando due volte. Per la sua regola —
  *«il codice è a posto non è funziona»* — questo lavoro **non è chiuso**.
  📌 `in-corso.ts` **non è stato tolto**: resta la difesa giusta se un domani gli aggiornamenti
  arrivassero in parallelo (webhook). Ma ora **dichiara di non bastare**, invece di sembrare
  completo — che era la parte pericolosa.


Nella **41ª**, misurando il worker prima di curarlo (20/08, mattina):

- 🚨⭐⭐ **`SAVE_BUTTON_NOT_FOUND` NON È COLPA DI `fillOsservazioni`, e la scheda che lo diceva è
  smentita dal registro.** La consegna della 40ª concludeva *«il worker si sposta da solo dove il
  bottone non c'è, e poi si lamenta che non c'è»* — cioè il click sulla linguetta «Osservazioni»
  porta la pagina altrove e `clickFormSave` cerca il salvataggio da lì.
  📏 **Il dump nella riga stessa che quella scheda cita dice il contrario**: `nearbyText` =
  *«Nuova partita - 24/08/2026 09:30-11:00 Generale Osservazioni Prenotazione Campo»* e
  `CC_HiddenFieldPestanyaIluminada` = **`"0"`**. La pagina è ancora il form, con le tre linguette
  al posto loro, e la linguetta accesa è ancora la **0 = Generale**. Il postback non è mai
  atterrato: **non si è spostato niente.**
  ⭐ **La causa vera sta due piani più su, ed è misurata al millisecondo.** I tempi cumulati
  (`mp_op_timing`, `op:"create"`, `ok:false`): `player_added` 14,7 s → `osservazioni_tab_click`
  20,8 s → `osservazioni_textarea_absent` 28,8 s → `save_button_not_found` **58,8 s**. Trenta
  secondi fra i due: sono gli **otto selettori** di `clickFormSave` che scadono **tutti**. Non è un
  bottone altrove, è **una pagina che non risponde più a niente**.
  E la riga di prima nel registro: `16:52:19.788` — `read-tabellone` `QUEUE_JOB_TIMEOUT`, *«oltre
  90s: annullata per non bloccare la coda»*. La create è partita a `16:52:19.787`
  (`time` 16:53:18.643 meno `runMs` 58856), **un millisecondo dopo**, seconda in coda
  (`queueWaitMs` 11967), su sessione **`warm_new`** — browser nuovo, perché il timeout aveva appena
  chiuso quello vecchio. Ha funzionato venti secondi, poi le è morto sotto.
  ⚖️ **E il codice questa malattia se l'era già scritta**: il commento del timeout di coda dice
  *«Playwright NON è stata interrotta e sta ancora usando la pagina warm CONDIVISA (zombie)…
  origine dei `warm_new` rotti nei log»*; e `edit-booking` ha **già** una guardia contro esattamente
  questo — *«la Ficha non è renderizzata del tutto — tipico SUBITO dopo un rilancio del browser
  (incidente 01/07 10:14: sessione warm_new in login)»* — ma **solo nel ramo delle rimozioni**.
  ⇒ È la frase con cui è stata chiusa la #920 il giorno prima: *una regola curata in un punto e non
  nell'altro è la forma in cui questo difetto è già tornato una volta.*
  🔎 **Confidenza, dichiarata invece che sottintesa**: che la create sia partita sul relitto è
  **misurato**. *Perché* la pagina muoia al ventesimo secondo è **ipotesi** — il `release(failed)`
  dello zombie chiama `mpWarmInvalidate()` senza guardare, e a quel punto `_mpWarm` è il browser di
  qualcun altro. Coerente col codice, **non** vista.
  📌 **Il difetto è misurato UNA volta sola**: la finestra di `out.log` copre ~40 ore e dentro c'è
  un solo `create` fallito così. *Un esito visto una volta non è una regola.*
  ⛔ **La cura che la scheda vecchia implicava — far guardare ai chiamanti il valore di ritorno di
  `fillOsservazioni`, o rimetterla sulla linguetta giusta — NON avrebbe curato niente.**

- 🔴 **`read-tabellone` sfora i 90 secondi, e il numero che stava scritto qui NON REGGE PIÙ.**
  🚨⭐⭐ **Rimisurato il 21/08 alle 00:19** (`stato-worker.yml`, finestra di 400 righe): nel **solo
  20 agosto** ce ne sono **almeno 17** — 10:05, 10:27, 11:41, 11:47, 11:59, 12:32, 13:55, 14:28,
  14:53, 15:55, 19:00, 19:04, 19:07, 20:54, 20:58, 22:13, 22:16 (UTC). Contro il **«~2,5 al
  giorno»** che questa riga dichiarava dal 4 al 20/08.
  ⚖️ **«Almeno», e la parola è pesata**: la finestra era filtrata da una regex, quindi 17 è un
  **pavimento**, non un totale. E non si può dire se sia una **crescita** o se la misura vecchia
  **contasse male**: le due finestre non sono confrontabili, e chiamarla «peggiorato» sarebbe una
  conclusione che il dato non regge. ⇒ Quello che è certo è che **~2,5 al giorno non descrive più
  niente**, ed era il numero su cui si decideva quanto fosse urgente.
  📌 *Un numero vecchio in un documento non invecchia in silenzio: continua a rispondere alla
  domanda «quanto è grave?» con la sicurezza del giorno in cui era vero.* È la ragione per cui
  `guard-docs-truth` esiste — e la ragione per cui non può bastare: quella guardia confronta ciò
  che il file dichiara di **sé**, non ciò che il file dichiara del **mondo**.
  ⭐ È di gran lunga il guasto più frequente del worker, e ogni volta `mpWarmInvalidate()` butta giù
  il **browser condiviso** sotto chiunque lo stia usando. È la causa a monte del reperto qui sopra —
  e il 21/08 si è visto **cosa costa a valle**: la coda occupata ha fatto saltare **due giri di sync
  di fila** (00:16 e 00:18), lasciando il calendario del gestionale fermo per **6 minuti** proprio
  mentre il committente stava annullando una partita.
  ⚖️ **Non si tocca senza aver prima misurato PERCHÉ quella lettura sfori**: alzare il tetto o
  togliere l'invalidazione sono due cure opposte, e quale sia quella giusta dipende da una cosa che
  nessuno ha guardato.

- ⚠️ **`guard-worker-sync` del worker sorveglia SOLO `server.mjs`**, non la cartella. La sua lista è
  `tools/matchpoint-browser-worker/src/server.mjs .github/workflows CLAUDE.md docs`.
  🚨 **Il 20/08 è mancato poco che costasse**: il `server.mjs` nuovo importa `./tipo-ficha.mjs`, e il
  riallineo prescritto dal punto 2 di `CLAUDE.md` — *«copia `server.mjs`»* — preso alla lettera
  avrebbe lasciato su `test-preview` un file che importa qualcosa che là non esiste, **con la
  guardia verde**. È la 24ª nella forma peggiore: una sonda che risponde con sicurezza alla domanda
  **vicina** a quella giusta.
  ⇒ Due strade, e la scelta è del committente: allargare la lista a tutta la cartella del worker,
  **oppure** correggere il testo del punto 2 perché dica «la cartella» e non «il file». La prima
  protegge anche chi non legge; la seconda non tocca la guardia. Il 20/08 il riallineo è stato fatto
  a mano su tutt'e cinque i file, quindi oggi i due rami sono allineati davvero.

Nella **40ª**, dallo screenshot di un telefono vero (19/08, notte):

- 🗣️👁️⭐⭐ **NELLA CHAT DI UN SOCIO NON SI CAPISCE CHI PARLA — e la causa non è grafica: è che il
  socio NON SCRIVE MAI.** Sue parole, guardando il telefono di Fabiola: *«non si capisce chi è che
  scrive»*, *«manca l'icona di quando ti parla l'assistente e di quando parli tu»*.
  📏 **Misurato nel registro invece che dedotto dallo schermo**: in tutta la sua conversazione
  Fabiola ha prodotto **un solo messaggio** — `16:32:50 ▸ /livello` — e per il resto solo **tocchi**
  (`22:15:10 tocca: invito non_posso`, `00:39:28 tocca: invito ci_sto`). Un tocco su un bottone
  inline **non lascia nessun messaggio in chat**. ⇒ Telegram distingue chi parla mettendo l'utente
  a destra e il bot a sinistra: se l'utente non scrive mai, **tutte** le bolle sono a sinistra. La
  chat non *sembra* un monologo, **lo è**.
  🚨 **E la seconda metà è NOSTRA, non di Telegram**: il bot **riscrive** i propri messaggi
  (`riscriviOMandaNuovo`, voce ④ del 19/08). Quando lei ha toccato «Ci sto», il messaggio d'invito
  coi due bottoni è stato **sostituito** dalla risposta ⇒ nello screenshot alle 23:43 c'è «Sei in
  campo: domani alle 17:00, campo 3.» e **la domanda non c'è più**. Stessa cosa alle 18:34: *«Va
  bene, ho detto che non puoi»* arriva senza che si veda **a cosa**. Restano affermazioni senza
  domande e senza risposte, ed è questo a rendere illeggibile chi parla.
  ⛔ **Ciò che NON si può fare, dichiarato perché nessuno ci riprovi: l'icona accanto alle bolle.**
  In chat privata Telegram non mostra avatar per messaggio, per nessun bot — lo decide il client.
  Quello che si vede nell'altro suo allegato (foto + nome) è la **vista elenco**, non la chat.
  ✅ **La cura progettata**: restituire la METÀ MANCANTE del dialogo, cioè far portare a ogni
  risposta **cosa ha scelto il socio** — «✅ Hai risposto: Ci sto» sopra «Sei in campo: …».
  📌 **Due sue decisioni, già prese, che qui restano scritte perché non si ridiscutano:**
  ① **perimetro = solo le DECISIONI** (Ci sto · Non posso · Sì annulla · Esci · Togli un giocatore ·
  Tengo questo livello · Riprovo il test), **non** la navigazione (scegli giorno, scegli ora,
  sfoglia, apri, torna indietro): là sarebbe una didascalia a ogni tocco su schermate che si
  riscrivono sul posto, cioè rumore;
  ② **ordine = DOPO la ③ e la ④** della consegna della 39ª (`SAVE_BUTTON_NOT_FOUND` e il terzo
  esito sulle quattro azioni). Non è una voce in coda: la promozione la dà lui.
  ⚖️ **Perché sta qui e non fra le urgenti**: non è un difetto che rompe qualcosa — tocca il **tono**
  di tutti i messaggi decisivi del bot, che è una scelta di prodotto e non una riparazione.

Nella **29ª**, dal collaudo eseguito (16/08, tarda sera):

- ✅ **RISPOSTA (stessa sessione, un'ora dopo): l'aggancio del MODELLO non è codice morto.** Avevo
  scritto la domanda sospettando che `bot.ts:3216` non potesse mai vedere un esito ignoto. **Falso**,
  e misurato leggendo: lo strumento `prenota` **ha** `conferma` nello schema d'ingresso (gli è solo
  *detto* di non passarlo), `scritta_alle` **c'è** nello schema d'uscita (`prenota.ts:79`), e a
  decidere è `pendenti.ts` — che lascia passare la conferma **solo** con una proposta valida in un
  messaggio precedente. ⇒ Se il modello **disobbedisce** e la rete lo ammette, la scrittura parte e
  l'attesa scatta: quel ramo copre **proprio** la disobbedienza, che il commento dello strumento
  dichiara già misurata sui numeri di telefono.
  ⚖️ **Terza deduzione plausibile su questa voce in un giorno, terza sbagliata.** È l'unica ragione
  per cui era scritta come domanda: se l'avessi scritta come verdetto, sarebbe rimasta lì.
- 🧰 **Gli attrezzi verso la VM sono nel repo del BOT, e il worker è di questo repo.** `cancello-worker.yml`
  ferma Caddy — cioè il worker **condiviso con PROD** — e sta in `assistente-padel-agent` per una
  scelta di velocità dichiarata (là non c'è `guard-worker-sync` a chiedere due PR su due rami).
  ⚠️ Chi cercasse qui «cosa può spegnere il worker» **non lo troverebbe**: per ora lo tiene insieme
  la tabella in `CLAUDE.md`. Se la cosa dura, quei due workflow vanno **spostati accanto a
  `deploy-worker-hetzner.yml`**.
- ✅🧹 **Le righe di prova su TEST erano NOVE, non due, e non dov'erano scritte** — misurato e poi
  **cancellate** su sua decisione («cancella le nove righe da test»): `PROVA-` rimaste **0**,
  `staff_booking` da **283 a 274**, nient'altro toccato.
  🚨 Tre cose che la nota di un'ora prima diceva sbagliate: non stanno fra le `booking` ma fra gli
  **`staff_booking`**; erano **nove**, dal **7 agosto**; e la scheda di collaudo **citava codice che
  non esiste** — su TEST `matchpoint-bookings-create` **non registra niente**, torna `503
  AMBIENTE_DI_PROVA`; a registrarle è il **ponte**.
  ⭐ Il marchio `id_reserva: "PROVA-…"` è esplicito e controllabile a macchina ⇒ nessun rischio di
  scambiarle per partite vere, che è **l'errore della 26ª** (là le «righe di prova» su TEST erano
  prenotazioni vive **anche in produzione**).
  🚨 **E la verifica della cancellazione è stata sbagliata al primo colpo**: `prima`, `delete` e
  `dopo` in **una CTE sola** leggono la **stessa fotografia**, quindi il «dopo» diceva ancora 9. È la
  24ª — *la sonda che guarda troppo presto*. Rimisurato con una query separata: **0**.

**E nella 29ª, collaudando la voce 53 — trovata dal committente**, non da me:

- 📅✅ **«Mercoledì» diventa quello DOPO: il bot salta una settimana — CURATA lo stesso giorno.**
  Chiesto *«che campi sono liberi mercoledì alle 15?»* **domenica 16 agosto**, il bot ha risposto
  **«mercoledì 26 agosto»**. Il primo mercoledì era il **19**.
  ✅ **Il dato che gli veniva dato era GIUSTO, ed è stato eseguito** (`righeCalendario(oggiRoma(), 7)`):
  l'elenco conteneva `- mercoledì 19 agosto 2026 → 2026-08-19`, ed era il primo con quel nome. E
  l'istruzione sotto era esplicita: *«è il **PRIMO** con quel nome in questo elenco»*.
  ⇒ **Il modello ha disobbedito a un'istruzione esplicita avendo il dato giusto davanti.**
  ⚖️ Non era la stessa malattia del 25/07 e del 29/07 (là **calcolava** il giorno della settimana, e
  quella cura regge): qui sbagliava a scegliere **l'occorrenza**, dove il nome torna due volte nella
  finestra di dodici giorni.
  🔨 **La cura è la TABELLA DEI PRIMI**, nel bot dal 16/08 (`src/mastra/lib/formato.ts`): il primo
  giorno di ogni nome è **precalcolato dal codice** e passato al modello già fatto — *«non
  sceglierla dall'elenco qui sopra, dove lo stesso nome torna due volte: COPIALA da questa riga»*.
  Difesa dal banco (`test/calendario.test.ts`, che pretende `mercoledì → 2026-08-19` sullo stesso
  giorno del difetto), e **viva anche per i soci** dal deploy del 18/08.
  ⭐⭐ **E la cura NON è quella che questa nota prevedeva**, che è il pezzo da tramandare. Qui era
  scritto *«manca una domanda sola: se sia il **modello** a passare la data sbagliata o lo
  **strumento** a risolverla male»* — due difetti, due cure, e un comando sui log per scegliere.
  ⇒ La strada presa non ha risposto a quella domanda: **l'ha resa inutile**, togliendo al modello la
  scelta invece di misurare come sbagliava a farla. ⚖️ Il principio stava già scritto nel commento
  della cura del 29/07, quattro righe sopra il punto in cui il difetto è sopravvissuto — *«al
  modello non serviva essere convinto, gli mancava un **FATTO**; le parole in più persuadono, i
  fatti no»* — applicato alle **date** e non all'**occorrenza**: si era fermato un passo prima di sé
  stesso.
  🚨 **Questa riga è rimasta a dichiarare APERTO un difetto chiuso poche ore dopo** (nota scritta la
  sera del 16/08, cura dello stesso 16/08), e a trovarla è stato l'andare a cercare *«un lavoretto
  sul bot da fare»* il 18/08. ⇒ È la malattia di famiglia — **il documento che mente** — nella forma
  più costosa: non spaventa nessuno, ma **fabbrica lavoro finto**, perché il prossimo che apre la
  lista parte a curare una cosa che regge già.

**E misurando il 16/08, nella 27ª, chiudendo la voce 48:**

- 🔑 **Il PIN admin: cosa resta dopo la 48, misurato e RIDIMENSIONATO.** Chiudendo la 48 avevo
  segnalato «l'entropia del PIN non è stata valutata» come residuo. Misurato ora, il quadro è meno grave
  di come l'avevo presentato, e va detto: ① l'oracolo `pmo_admin_pin_ok` **non è più raggiungibile da
  `anon`** né su PROD (dalla 47) né su TEST (dalla 48); ② da `authenticated` **sì**, ed è stato
  **eseguito** per provarlo, non dedotto (risposta `false` a un PIN sbagliato); ③ `auth.users` ha **6 utenti su PROD** e **5 su TEST**.
  🚨 **CORREZIONE, misurata poche ore dopo e da parte mia**: da quei numeri avevo concluso «`authenticated`
  non è il pubblico, è lo staff». **Falso** — i 6 sono **quanti si sono iscritti**, non **chi può**. Vedi la riga
  sulla registrazione qui sotto: è **aperta**. ⇒ Il vettore ERA «chiunque da Internet», e la voce 49 valeva molto
  più di quanto le attribuissi scrivendola. ⚖️ Premessa vera, conclusione falsa: la 25ª, fatta da me.
  ⚠️ **Il fatto scomodo che resta, ed è reale**: il costo bcrypt dell'hash è **`$2a$06$`** su
  entrambi i progetti — **64 giri**, contro i 1024-4096 di un valore prudente ⇒ ogni tentativo è
  **economico**, e la funzione non ha alcun freno sul numero di tentativi. Un PIN corto e numerico
  cadrebbe in fretta a chi ha un account qualsiasi.
  ⛔ **Non misurato, di proposito**: la **lunghezza e la forma del PIN** — saperlo richiederebbe
  provarlo a forza, che è l'attacco, non la diagnosi. E **non è stato verificato se la registrazione
  di nuovi utenti sia aperta**: da qui non si misura (`auth.config` non esiste come tabella, e la
  configurazione sta nel pannello, non nel database). 📌 È **la domanda che decide la gravità**: a
  registrazione chiusa il rischio è interno; ad essa aperta, chiunque può diventare `authenticated`.
  📦 **CHIUSA in giornata come voce 49**, su sua delega: porta chiusa ad `authenticated` su entrambi i
  progetti, freno ai tentativi e rincaro dell'hash. La sua riga sta fra le chiuse.

- 🔒 **LA REGISTRAZIONE DI NUOVI UTENTI ERA APERTA su PROD e su TEST — ed è stata CHIUSA il 16/08.**
  Era `disable_signup` = **false**, provider email attivo ⇒ **`authenticated` non era un cerchio chiuso: chiunque
  poteva entrarci** (l'unico attrito era `Confirm email`, cioè servire una casella vera — un ostacolo, non un muro).
  📦 **Chiusa in giornata, come voce 51**, con la prova fatta a quattro mani. La sua riga sta fra le chiuse.
  🧯 **E il modo in cui è saltata fuori è la lezione della 26ª applicata a me, lo stesso giorno in cui la
  scrivevo.** Avevo dichiarato *«da qui non si misura, `auth.config` non esiste come tabella, sta nel pannello»* —
  vero sul database, **e non l'avevo provato altrove**. Basta `GET /auth/v1/settings`, endpoint **pubblico e di sola
  lettura**, che quel campo lo dichiara. Ha risposto **200 al primo colpo**. ⇒ Un «non si può» scritto senza
  tentare resta vero per sempre, perché nessuno lo rimette alla prova. L'ha rimesso alla prova **lui**, chiedendo.

- 🚨 **E la conseguenza, misurata SUBITO ed ESEGUITA — `get_self_assessments_by_tokens` versa dati personali
  a chiunque si registri.** Con la registrazione aperta, ogni funzione concessa ad `authenticated` è di fatto
  **rivolta al pubblico**. Su PROD sono **8** le `SECURITY DEFINER` concesse ad `authenticated` **senza guardia di
  staff** (7 su TEST); di queste 2 sono trigger e 3 pubbliche per disegno, ma una pesa: chiamata **come
  `authenticated` non-staff** con un gettone vero ha restituito **1 riga con nome, cognome e telefono valorizzati**
  — misurato eseguendo, senza far comparire né il gettone né i dati.
  ⚖️ **La voce 44 NON è sbagliata e regge**: da `anon` la stessa chiamata risponde **42501**, controprova fatta. Ma
  chiuse la porta **ad `anon`** quando la porta accanto era aperta a **chiunque si iscriva** — e allora nessuno
  sapeva che iscriversi si potesse.
  📦 **CURATA in giornata come voce 50**, su sua scelta fra le due strade proposte: guardia di staff **dentro
  la funzione**, su TEST e su PROD. La sua riga sta fra le chiuse. 📌 Stessa situazione, stessa cura, su **TEST**.
  🧯 **E la ragione che avevo dato per NON fare la revoca semplice era falsa**, misurata dopo: avevo scritto
  *«l'app la chiama davvero ⇒ revocarla romperebbe il gestionale»* — **dedotto da un `grep`**, non eseguito. Il codice
  vero (`index.html:29298`) chiama con la **chiave pubblica**, non col token dello staff, mentre le sonde lì accanto il
  token lo passano. ⇒ Anche la revoca sarebbe stata innocua. La strada scelta resta la migliore — una guardia protegge
  a prescindere dai grant, che si possono ridare per sbaglio — ma **il motivo per cui l'avevo scelta era sbagliato**.

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
  (chiave `assistant_kb`), non nel codice. ✅ **Chiusa lo stesso giorno**: tolta da TEST, e le due kb
  hanno ora la **stessa impronta**. 📌 Questa nota diceva «grep: solo il commento» — nel codice il
  nome **non c'è affatto**, perché la voce non è mai stata nel codice.

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
  ⬆️ **Promossa da lui il 16/08, 26ª sessione: è la voce 47** — e là non sono più «mai lette»:
  **tutte e 33 eseguite come `anon`**, con 3 reperti e 2 falsi positivi (sono `trigger`, via RPC non
  si chiamano). 📌 La riga qui sopra diceva «le altre 45»: era già vecchia quando la si è scritta,
  perché nella stessa riga il totale era stato corretto a 34. Il numero da riconoscere è **33**, ed
  è il motivo per cui la voce 47 lo **riconta** invece di ereditarlo.

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

## 📦 CHIUSE — dal 13 al 19/08/2026 — 57 voci

⚠️ **Una sola sezione datata per volta.** `guard-docs-truth` conta le righe di **tutte** le
intestazioni `CHIUSE —` ma legge il numero della **prima**: due blocchi datati affiancati dichiarano
1 e ne contano 9, e la guardia fallisce. Chi chiude in un giorno nuovo **allarga la data di questa**,
non ne apre un'altra sotto.

**Le prime sette voci sono del 19/08**; **le tre dopo sono del 18/08**; **le due dopo sono del 17/08**; **le sedici successive del 16/08**; **le dieci dopo ancora del 15/08** — otto chiuse e **due annullate**, e l'etichetta lo dice riga per riga perché «non serviva più» e «è stato fatto» non sono la stessa cosa. **Le dieci successive sono del 14/08; le otto ultime del 13/08.**

| — | ✅ *(19/08, chiesta da LUI a voce: «non mi fa più aggiungere un ospite alle partite»)* 🅿️ **L'«Ospite» sparito dalle partite: il sync clienti aveva disattivato il jolly 000001.** Il 4-5/08 la regola stale di `matchpoint-clients-sync` — quella che disattiva chi ha un codice Matchpoint e non compare più nell'export — ha colpito la scheda jolly «Ospite», che nell'export clienti **non compare MAI**: è il motivo per cui l'app la ricrea da sé (`ensureOspiteMember`), e nessuna eccezione la proteggeva. Da lì Chiudi Partite e Riempi slot — che scartano i soci `active === false` — buttavano l'Ospite **in silenzio**: la riga del gruppo diceva pure «Trovato», e la partita nasceva senza. 🔎 Trovato guardando l'app viva con la console remota (`active:false` sulla scheda in memoria) e poi il payload su Supabase: `matchpointInactiveReason: matchpoint_snapshot_absent`, su PROD **e** su TEST, con date 4-5/08. ⚖️ Riattivarla a mano non avrebbe retto: la passata dopo l'avrebbe rispenta — e il «Riattiva» dell'app **non azzera i marcatori**. Cura in `stale-guard.ts`, due versi: ① l'eccezione `isGuestJolly` (flag **o** codice 000001) in `decideStaleMember` → `keep`, sempre; ② la **guarigione** — il giro stale riattiva da sé il jolly che porta il marcatore automatico, fuori dal tetto di proposito (è restaurativa e limitata al jolly per costruzione) — così i due database si riparano **al primo import dopo il deploy**, senza una scrittura a mano da coordinare col deploy. Test U-Z con la tabella dei sabotaggi **rimisurata**, non prevista: le due metà del predicato le isola solo V, perché il caso reale U porta le due firme insieme e resta verde sotto ogni dimezzamento. 🚨 Il percorso del calendario staff non era rotto — scrivere «Ospite» lì aggiunge diretto, senza passare dall'anagrafica — ed è il motivo per cui il guasto è rimasto invisibile per due settimane: la strada usata più spesso funzionava, le altre mentivano con un «Trovato». |
| **62** | ✅ *(19/08, 36ª sessione — codice fuso dalla 33ª, **chiusa da LUI** dopo che l'ultimo difetto rimasto è stato cercato e non trovato: «Chiudila»)* 🎾 **62. «Le tue partite» è una scheda per volta, e si sfoglia.** Chiedendo le proprie partite si apre **una** partita — la più vicina nel tempo — e la si sfoglia con «← Precedente» / «Successiva →»; le azioni stanno **sulla scheda** (Invita · Togli · Annulla) e la parola «Gestisci» sparisce. ⭐ **La cura più economica di un difetto è scoprire che il pezzo che lo aveva non serve più**: la domanda di partenza era sua — *«il bottone gestisci può stare sotto la relativa prenotazione?»* — e la risposta scelta quel bottone non lo **sposta**, lo **toglie**. ✅ **Verificata sul telefono da lui** (*«mi sembra che funzioni tutto bene»*), che è l'unica verifica che la sua regola accetta: *«il codice è a posto non è funziona»*. ⭐ E la promessa per cui la variante E aveva battuto le altre cinque — **una notifica sola** — la tiene lo sfoglio che **riscrive** il messaggio (`editMessageText`) invece di mandarne di nuovi: misurata, non dedotta dal disegno. 🚨⭐⭐ **E L'ULTIMA COSA APERTA ERA UN DIFETTO CHE NON C'ERA — vale più del lavoro.** *«Su una scheda dove la partita è completa c'era la possibilità di mandare un invito»*, visto da lui sul bot di prova. Non era la **scheda** ma «👥 Gli inviti mandati»; e soprattutto **la partita non era completa**: su `2026-08-21 17:00 campo 3` i giocatori sono **due** (`-Maurizio Aprea.-pierfrancesco biggi.`), e concordano **tre copie della riga, su TEST e su PROD**, `booking` e `staff_booking`. ⇒ Il bot ha scritto *«Puoi invitare qualcuno dalla tua rubrica»* perché `liberi = 4 − 2 > 0`; con quattro avrebbe scritto **«Siete al completo»**, che è l'altra metà della stessa riga (`invito-partita-testi.ts:227`). Il cancello ha funzionato. 🧊 **E NON era il calendario congelato di TEST** — l'esclusione da fare per prima, che si è chiusa **al rovescio di come me l'aspettavo**: la copia di **PROD** è stata rinfrescata **21 minuti DOPO** lo screenshot e dice le stesse due persone. ⇒ **Confermata la riga 2 della tabella della 33ª** (*«il roster più corto del vero: ipotesi ragionevole e falsa»*). 🔎 **La misura è stata fatta ESEGUENDO il codice del ponte** — `compagni-slot.ts` copiato e girato sui payload veri — **non riscrivendone la regola in SQL**: è l'errore che aveva già morso due volte la 33ª, e una sonda sbagliata dà una risposta **sicura e falsa**. 📏 **Un contorno misurato, che non è un difetto ma va saputo**: su PROD, tipo «Partita», 19/08→19/09, **31 schede distinte su 48 (65%) hanno meno di quattro nomi** ⇒ il bot offrirà «Invita» sulla maggioranza delle partite. Se là dentro ce ne sono che si giocano in quattro, il buco è **in Matchpoint**, non nel bot — *il gestionale SA, il bot DICE*. ⚠️ **TRE SCELTE DICHIARATE, ancora senza la sua parola e tutte da una riga**: ① il **corpo** della scheda è il roster coi «— posto libero —» di oggi e non la riga compatta del mockup (cambiarlo scarterebbe tre sue decisioni del 4-7/08); ② il caso ① mostra **sei** bottoni e non tre («👥 Gli inviti mandati» e «🚪 Esci» esistono già per l'organizzatore); ③ la frase della **lezione** è la sua del 6/08 e non quella nuova del mockup — scriverne una seconda era la copia che questo progetto punisce. ⚠️ **Limite dichiarato**: una prenotazione col **campo illeggibile** (`numeroCampo` torna 0) non è indirizzabile da nessun `callback_data` ⇒ resta fuori dallo sfoglio; lì si ripiega sull'elenco di prima, invece di dire «non hai partite» a chi ne ha una. ⚠️ **Segnalato e NON curato, perché è di un'altra famiglia**: `togli:conferma` scrive al circolo come `uscita:conferma` ma non sta in `SOTTO_AL_BOTTONE` ⇒ il messaggio sotto aspetta la soglia invece di partire subito. 📦 `assistente-padel-agent` **#26** (la voce) e **#27** (la clessidra sotto, su tutti i bottoni), vivi **sul bot di PROVA**; il bot dei **SOCI non è stato toccato**. 🧪 Banco **1132 → 1160**, `tsc --noEmit` pulito, **dieci sabotaggi** ognuno verificato di essere atterrato — e **tre casi erano passati verdi al primo giro**, cioè non difendevano quello che dicevano. |
| **17** | ⛔ **ANNULLATA** *(19/08, 35ª sessione — sua decisione: «la sedici e la diciassette non verranno mai fatte»)* 🔐 **17. Consumer: hook Auth «Customize Access Token».** Senza quell'hook l'RLS **nega in silenzio**, ed era il prerequisito per far funzionare i permessi dell'app dei soci. ⭐ **E l'annullamento discende da una decisione già presa, non è un capriccio**: quell'hook serviva **all'app dei soci**, **dismessa dal 25/07** per sua scelta — Pages spento, repo tornato privato, DNS rimosso, e le due edge di login **cancellate**. Il canale verso i soci è **il bot**. ⚖️ *Una voce che prepara il terreno a una cosa che non esiste più non è «in coda»: è un residuo che sembra un piano* — e la sua riga in coda diceva già la verità (*«rilevante solo quando si riprende l'app soci, 0 utenti veri oggi»*), solo che la teneva viva invece di trarne la conseguenza. |
| **16** | ⛔ **ANNULLATA** *(19/08, 35ª sessione — sua decisione: «la sedici e la diciassette non verranno mai fatte»)* 💰 **16. Storno/cobro PARTITA — flag OFF mai validati.** Andavano validati in TEST prima di qualunque attivazione, e non è mai stato fatto. 🔎 **Il fatto resta vero, e va scritto perché la riga non si legga come «era inutile»**: i flag sono **davvero** OFF e **davvero** mai validati. ⚖️ *Annullarla non dice che il problema non c'era: dice che non lo si affronta* — che è una cosa diversa, e più onesta. 📌 Se un domani si volesse attivarli, il punto di partenza non è cambiato: **si validano in TEST prima**, perché toccano i soldi. |
| **54** | ⛔ **ANNULLATA** *(19/08, 35ª sessione — sua decisione: «non la facciamo più». ⚖️ **Annullata, non chiusa**: l'etichetta è diversa apposta, perché «non serviva più» e «è stato fatto» non sono la stessa cosa)* 🔀 **54. SPOSTARE una prenotazione: il bot non sa farlo, e manda in segreteria.** L'aveva messa in coda **lui** il 16/08 di sua iniziativa (*«non abbiamo ancora inserito modifica una prenotazione?»*), e il 19/08 l'ha tolta. 📏 **Il fatto misurato resta vero e vale la pena tenerlo**: le azioni che il ponte accetta sono **otto** (`consumer-booking-write/index.ts:234`) — `availability · availability_day · create · verifica · cancel · leave · remove · add` — e **spostare non c'è**, né lì né fra i sette strumenti del bot. 🎯 Non era un buco dimenticato: il bot **lo dichiara da sé** in fondo a ogni conferma (*«Per spostarla, chiama la segreteria»*), cioè è una porta che manda in segreteria, **scritta**. 🚨⭐ **E la ragione per cui non era un lavoretto è la cosa da non perdere**: il gestionale non ha uno «sposta», quindi farlo vuol dire **annullare e riprenotare** — **due scritture** al circolo con in mezzo una finestra in cui il campo nuovo può essere preso da un altro **mentre il vecchio è già perso**, e in cui la seconda scrittura può restare **ignota** (il terzo esito della 53). ⚖️ Stessa famiglia della **53**, ma **col verso peggiore**: là il rischio è una prenotazione **doppia**, qui una prenotazione **persa** — *un doppio si disdice, un buco no*. 📌 Le tre domande che sarebbero venute prima di scrivere una riga erano **sue e non tecniche** (si prenota prima il nuovo e solo se riesce si annulla il vecchio, col socio che per un istante ha **due** campi da pagare? se il nuovo non è libero il bot **tiene** il vecchio o chiede? e nel caso peggiore — vecchio annullato, nuovo fallito — chi rimedia?) ⇒ **annullandola ha risposto alla prima**: non si fa. |
| **52** | 📦 ✅ **CHIUSA DICHIARANDO** *(19/08, 35ª sessione — «esce perché è già decisa». ⚖️ Non era un lavoro ma una **decisione presa** il 16/08, e una decisione dentro una coda di cose da fare fa smettere la coda di dire cosa c'è da fare)* 🧟 **52. Il pezzo dell'Autovalutazione rotto nel gestionale — morto per scelta, non da riparare.** 🗣️ Sua, il 16/08: *«lasciare com'è, scrivendolo»*, dopo *«il processo dell'autovalutazione l'abbiamo già fatto col bot, quindi penso che la sezione che c'era dentro il gestionale non sarà mai più riattivata»*. 📏 **Cos'è rotto, misurato via HTTP e non dedotto**: `get_self_assessments_by_tokens` chiamata **come la chiama l'app** risponde **401 / `42501`**. Ne dipendono **due cose sole**, entrambe dentro la sezione congelata dal 13/06 (`PMO_ASSESSMENT_PARKED`): il tasto **«aggiorna risposte»** e la riga **«Schema autovalutazioni»** del pannello diagnostico. ⚖️ **E NON è una regressione della voce 44**, che è la conclusione facile e sbagliata: la 44 tolse ad `anon` una funzione che versa nome, cognome e telefono — cosa giusta, verificata, e che regge. Il punto è che **l'app entrava proprio da lì**, chiamando con la **chiave pubblica** invece che col token dello staff (`index.html:29298`), a differenza delle sonde lì accanto che il token lo passano. ⇒ *Non una regressione da disfare: un chiamante scritto male, in una stanza che intanto ha chiuso.* 🛠️ **La riparazione esiste ed è piccola** — far passare il token dello staff in quelle due chiamate — **e si è scelto di non farla**: rimetterebbe in funzione un bottone dentro una stanza in cui non entra nessuno, al prezzo di una modifica all'app e di una promozione a PROD. ✅⭐ **E il flusso VIVO del bot è SANO, controllato prima di archiviare perché sarebbe stato l'errore grosso**: `assessment-quiz` scrive nella **stessa tabella di prima** (`self_assessments`, upsert su `token`), quindi «nessuna risposta nuova» poteva voler dire **guasto**. Non lo è — dei **19** gettoni creati negli ultimi 30 giorni **nessuno è `completed`**: sono tutti `created`, generati e mai aperti. 🚨 **Il segnale da guardare se un domani il sospetto torna è l'opposto**: un `completed` **senza riga corrispondente**, quello sì sarebbe un guasto. 🚨 **Due avvertenze per il giorno in cui si volesse POTARE**: ① «Autovalutazione» vuol dire **due cose diverse** — la sezione **morta** nel gestionale e il servizio **vivo** del bot (`assessment-quiz`, `consumer-assessment-link`, `assessment-apply-level`, `assessment-notify-staff`, più `self_assessments` e `assessment_tokens`): potare l'una senza toccare l'altro si può, ma **va misurato**; ② restano **459 funzioni** col nome `assessment` e **4678 occorrenze** della parola, e **non sono tutte morte** — la 23ª insegna che l'analizzatore che decide cosa è morto **ha già mentito una volta**, leggendo un blocco `<script>` su cinque. Il perimetro lo decide il committente **guardandolo**. |
| **61** | ✅ *(19/08, 35ª sessione — messa in urgenti da LUI il 18/08, chiusa da LUI il 19 **a cosa vista**: il settimo pezzo era arrivato sul telefono di una persona vera venti minuti prima)* 🎾 **61. La sezione «Il mio livello» del bot, finita — sette pezzi, e il settimo è l'unico che qualcuno abbia RICEVUTO.** ⇒ ① il bottone del test lo vedono **tutti**, e a chi un livello ce l'ha l'invito dice **rifai** · ② i **30 giorni** partono dalla **fine del giro**, e un giro sono tre prove (prima l'attesa scattava dal terzo *fallimento*: chi passava rifaceva **subito e all'infinito**) · ③ **in negativo non si scende**, e solo alla terza prova più bassa si scende di **0,5** (prima `assessment-apply-level` applicava in tutti e due i versi: da Avanzato a Principiante in un colpo) · ④ **il socio sceglie a quale prova fermarsi**, e l'automatismo ha smesso di decidere da solo · ⑤ a Semi-Pro e Professionista si dice che la scheda **la guarda il maestro**, tramite la segreteria · ⑦ a giro finito si dice «**hai finito le tue prove**», non un conto di bocciature · ⑥ il **promemoria gentile** a chi il livello non ce l'ha, ogni **15 giorni**. 🚨⭐⭐ **E il ⑥ è l'unico dei sette che non fosse un prerequisito silenzioso: il destinatario era stato MISURATO PRIMA E NOMINATO** — `Fabiola Limuti`, l'unica delle tre utenze della whitelist senza livello — e la previsione ha retto riga per riga. Merge **09:38** UTC, deploy sui SOCI **09:41:57**, messaggio **09:43:02**, cioè **11:43 di mattina a Roma**. ⭐ Il valore di quella tabella non è di aver indovinato: è di aver reso **falsificabile in anticipo** una cosa che, andando storta, si sarebbe scoperta da un socio sorpreso invece che da una riga di registro. ⚖️ **La decisione che regge il ⑥: il periodo è una CASELLA DI CALENDARIO** (15 giorni dall'epoca fissa), non «15 giorni dall'ultima volta». La strada ovvia vorrebbe una colonna scritta da chi manda il messaggio, e a mandarlo è il **bot** ⇒ quella memoria finirebbe in un **terzo posto** ancora. La casella si **calcola** e non la tiene nessuno; l'«una volta sola» lo garantisce il registro del bot con la chiave `livello:<casella>` — 24,3 messaggi all'anno, cioè la sua frase *«un paio di volte al mese»*. 🌙🚨⭐⭐ **IL DIFETTO CHE STA NELL'INCONTRO FRA TRE COSE GIUSTE, ed è il reperto di metodo della voce.** Il promemoria parte al **primo giro utile** della casella; le caselle cominciano a **mezzanotte UTC**; il giro passa **ogni quarto d'ora**. Nessuna delle tre è sbagliata, e insieme facevano arrivare il «promemoria **gentile**» sempre **verso le due del mattino**. Il banco era verde e i sabotaggi tutti visti: **non lo poteva vedere nessuna sonda** — si vede solo chiedendosi *a che ora, in pratica, questo messaggio arriva a qualcuno*. Curato con una **quarta porta** (di notte si tace), e la reazione è l'**opposta** degli avvisi di disdetta: quelli di notte si **anticipano**, questo si **rimanda**. ⭐ **E la cura non l'ha verificata una sonda: l'ha verificata l'orologio del primo che l'ha ricevuto** — 11:43, non le due. 🚨⭐ **E il difetto gemello del ④ stava FRA i due repo, dove nessun banco dei due poteva vederlo**: la porta `siPuoAnnunciareIlTest` taceva finché il livello non era **scritto**, e col ④ il gestionale aspettava la **risposta** per scriverlo ⇒ il bot avrebbe aspettato il livello per parlare, il gestionale la risposta per scrivere, e la risposta poteva arrivare **solo se il bot parlava**. Tre pezzi giusti e una **catena chiusa**: il ④ sarebbe stato **inerte al 100%**, e il silenzio-assenso delle 24 ore avrebbe fatto sembrare tutto normale. ⚖️ *Il difetto peggiore è quello che non rompe niente.* 🔪 **Provato coi sabotaggi, 45 in tutto** su quattro attrezzi (`sabotaggi-voce-61-quattro.mjs` 9+1, `sabotaggi-voce-61-sei.mjs` 10+1 nel gestionale; `sabotaggi-scelta-livello.mjs` 10+1, `sabotaggi-promemoria-livello.mjs` 13+1 nel bot), e **in fondo a ogni serie un sabotaggio che NON TOCCA NIENTE**, dichiarato tale, che deve risultare **non atterrato**: è il metro che misura il metro. 🚨⭐ **Due guardie rotte e una bugiarda, tutte trovate sabotando o leggendo il rosso invece di crederci**: ① la guardia del cablaggio trovava le stringhe **anche col ramo spento** (`if (false)`) — *una guardia che cerca una parola prova che la parola c'è, non che il codice succeda*; curata **ancorando la regex a inizio riga** (`/^\s*await .../m`), perché un `if` davanti **sposta la riga**; ② un controllo d'ordine confrontava la posizione della **lettura** invece che dell'**azione**, ed era **rosso su codice giusto**; ③ «il ponte guarda l'orologio una volta sola» contava `Date.now()` **anche nei commenti**, compreso quello che spiega perché la chiamata dev'essere una sola. ⇒ *Prima di riparare il codice per un rosso: **cosa misura la sonda?*** — e la stessa domanda va fatta **prima di credere al verde**. 📦 **Assorbite qui e chiuse con lei le voci 55, 56 e 57**, per sua decisione del 18/08 (*«sì assorbile nella 61»*). ⚠️ **Residuo dichiarato, perché nessuno legga «sezione finita e visibile»**: dei sette pezzi **sei sono prerequisiti in servizio** — vivi, e senza nessuno che li possa ancora vedere, perché su PROD **nessun socio ha mai completato un test col cancello del quiz** (42 schede, tutte senza `knowledge`). Il primo che passerà un quiz sarà anche il primo a vedere il ④ e il ⑦. *Vivo non vuol dire visibile*, e dirlo «finito» sarebbe vero del codice e falso dell'esperienza. 🧊 **E una cosa da sapere prima di provare il ⑥ su TEST**: là **tutte e due** le utenze della whitelist un livello ce l'hanno ⇒ `dovuto` è **sempre falso**, per costruzione. Come per il ③, *l'unico posto dove quella regola gira è la produzione*. |
| — | ✅ *(18/08, 32ª sessione — tre correzioni sue, viste sul telefono mentre un'altra sessione lavorava la voce 61)* 👆 **Il riscontro dei tocchi, e l'etichetta del bottone WhatsApp.** ① 🙈 **La clessidra non compare più in cima** nelle schede di «Domande e info». ⚖️ **Non era un difetto di posizione**, ed è la cosa che ha cambiato la forma della cura: quell'avviso è di **Telegram**, lo disegna il client rispondendo al tocco e **dove** metterlo lo decide lui ⇒ al bot restano due sole scelte, dirgli un testo o non dirglielo. **Non si sposta: si toglie**, e sotto ci va il messaggio vero — la strada **già costruita il 16/08** per la sua preferenza di allora (*«la preferirei sotto al bottone che ho premuto»*), che su quei bottoni non si accendeva mai. 🔎 **Perché proprio lì**: le schede si compongono **in casa** (kb in cache 30 s) e riscrivono il messaggio toccato ⇒ il lavoro finisce **sotto la soglia** di mezzo secondo, quindi il messaggio sotto non partiva e restava solo la clessidra in alto, per un'attesa **che non c'era**. ⛔ **Tenuta stretta alle sole voci del menu**: gli altri bottoni chiamano il **ponte**, dove l'attesa è vera e l'avviso in cima è l'unica cosa che Telegram sa attaccare all'istante del tocco. ② ⬅️ **«Torna all'elenco» ha un riscontro** — *«sì, sistema anche il torna all'elenco»*. Era un **limite dichiarato il 16/08 e mai chiuso**: classificato fra i tocchi istantanei mentre il ponte lo fa aspettare davvero ⇒ **niente né sopra né sotto**. ⭐ **A tenerlo aperto era una ragione che è caduta da sé**: valeva finché «toglierlo dagli istantanei» voleva dire per forza «accendergli l'avviso in cima» — separate le due cose dal punto ①, l'obiezione non ha più oggetto. ⚖️ *Un limite scritto con la sua ragione si può riaprire quando la ragione cade; uno scritto senza resta vero per sempre* — la 26ª presa dal verso buono. 🚨 E `elenca` (rubrica, togli, invito) è un **altro nome** e non si è mosso, con un caso che lo verifica: è la trappola dei cassetti omonimi che quel modulo dichiara di evitare. ③ 💬 **«Scrivi» → «Contatta la segreteria su WhatsApp»**. Non è un sinonimo: «Scrivi» dice al socio cosa fare **lui**, «Contatta» dice **a cosa serve** il bottone — e quel numero, dall'altra parte, si può anche chiamare. 📏 **34 caratteri esatti come prima**, sotto il tetto misurato di 37 ⇒ nessun bottone tronca, e c'è un caso che lo misura perché il rischio di un cambio d'etichetta è il **taglio**, che rileggendo non si vede. ⛔ Non toccato «Altri orari? Scrivi alla segreteria»: non dice «su WhatsApp» ⇒ fuori dalla richiesta, e i suoi 37 caratteri sono già il tetto. 🧪 Banco **1078 → 1087**, typecheck pulito, **quattro sabotaggi** ognuno verificato di essere atterrato. 🚨 **Non è viva finché non si deploya**: il merge non basta, e sui soci va chiesto a parte |
| — | ✅ *(18/08, 32ª sessione — chiesta da LUI guardando il bot sul telefono)* 🅿️ **«Parcheggio ampio» → «Parcheggio»**, nella scheda **«Cosa trovi al circolo»** del menu *Domande e info sul circolo*. ⭐ **Non è una riga di codice, ed è il punto**: quell'elenco **non sta nel bot** — `faq.ts` stampa le `dotazioni` della kb voce per voce, apposta perché *«una dotazione aggiunta domani compaia da sola, senza toccare il codice»* — quindi vive in `pmo_ai_settings` → `assistant_kb`. ⇒ **Niente PR, niente deploy, niente riavvio del bot**: una `UPDATE` per ambiente, e il socio la legge entro **30 secondi** (`KB_TTL_MS` in `ponte.ts`, l'unica cache di mezzo). Fatta **prima su TEST e poi su PROD**, con la guardia `@> '["Parcheggio ampio"]'` che la rende ripetibile a vuoto, e verificata che il **resto** della kb non si fosse mosso: `md5(value - 'dotazioni')` **identico prima e dopo** su PROD — perché un `jsonb_set` sbagliato riscrive l'oggetto intero e nessuno se ne accorge finché non manca un recapito. 🧪 **Il banco è stato allineato lo stesso** (`test/faq.test.ts`): la finta kb si dichiara *«copiata dalla forma VERA»*, e una copia rimasta indietro difende una frase che il socio non legge più. ⭐ Il caso ora pretende la riga **intera** — `/^• Parcheggio$/m` — perché `/Parcheggio/` sarebbe restato **verde** con «ampio» rimesso: misurerebbe meno di quello che afferma, che è la riga inerte della 30ª. Sabotaggio eseguito: rimesso «ampio», il banco va **rosso**. Banco **1078/1078**, typecheck pulito |
| **59** | ✅ *(18/08, 31ª sessione — aperta il 17 da LUI, chiusa da LUI: «chiudi la voce cinquantanove»)* 🕰️ **59. TEST poteva mostrare una copia VECCHIA senza dirlo** — il prezzo della cura della 58: `./app.html` è la strada **primaria**, quindi a sincronia ferma TEST serve codice vecchio **e sullo schermo non si vede niente**. Fatte tutte e due nell'ordine che ha dato lui. **B** — il caricatore, caricata l'app, confronta e **avvisa chi guarda**: non bloccante, silenzioso su ogni intoppo (403/429/rete/appeso), 1 chiamata/ora per browser con la memoria che si invalida da sé quando la copia servita cambia; innestato il **tetto d'attesa** che veniva dalla sessione Mac. **C** — una **sentinella sulla VM, non su Actions** (là morirebbe insieme a ciò che sorveglia): `systemd` oneshot + timer 15′, fuori da pm2 di proposito, paziente **3 giri** (~45′) come `guard-worker-sync`, che distingue **«indietro»** da **«non lo so»** e dopo 12 giri ciechi **dichiara la propria cecità**; un messaggio per guasto, il rientro annunciato, e un **💓 ogni 7 giorni** che rende *verificabile* la frase «silenzio = tutto a posto». 🚨 **E la scheda della voce prescriveva un confronto SBAGLIATO**: `source_sha` contro la testa del ramo avrebbe suonato quella sera stessa su una copia **fresca al byte** (impronta `79d1a3a4` sui due lati, **dodici commit** di distanza), perché `sync-app.yml` ricopia solo se `index.html` cambia ⇒ ogni commit su `docs/` allontana il commit senza invecchiare la copia. Era **la stessa malattia** per cui la strada `synced_at` era già stata scartata, ripresentata un gradino più in là e **quattro righe sotto** l'avvertimento «non rifarla» ⇒ si confronta l'**impronta del contenuto**. Verificate **sul bersaglio**: B aperta in un Chromium vero (v6.243 TEST, `PMO_FORCE_ENV` intatta, zero errori JS, nessun avviso su copia fresca), C letta nel suo `stato.json` sulla VM (`fresca`, `servitoCoerente: true`); banco **23 casi** col sabotaggio che verifica di essere stato applicato. ⭐ E il giro della sentinella ha **chiuso una domanda che avevo dichiarato non misurabile dal cloud**: la VM non ha credenziali GitHub, quindi la chiamata anonima che le ha risposto dimostra che **la B non è cieca**. ⚠️ **Residuo dichiarato**: la voce della sentinella è il **token del bot di prova** in un secret — e il ripiego sui bot già sulla VM resta scritto e provato, ma il secret ha la precedenza. |
| — | ✅ *(17/08, 31ª sessione — aperta, curata e chiusa in giornata)* 🌐 **58. L'app di TEST non si carica: `HTTP 429` da GitHub — CHIUSA da LUI** (*«il gestionale di test si apre»*). Il guasto era nel **disegno del caricatore**: scaricava l'app INTERA (~3 MB) da `raw.githubusercontent.com` **a ogni apertura**, anonimo e con un cache-buster che azzerava la CDN — e GitHub strozzava i percorsi per-ramo del repo (429 anti-scraping, **misurato da DUE reti diverse**: non era la quota del circolo). La cura, **scelte sue la ② e la ③**: `app.html` — copia generata dell'app — pubblicata su Pages **nel repo del caricatore** e servita dalla **stessa origine** (niente quota GitHub nel percorso primario, `raw` solo ripiego e senza cache-buster); su errore **messaggio umano + «Riprova»**, niente ricariche automatiche; `sync-app.yml` tiene fresca la copia (dispatch/cron ≤10′/a mano) e `app-meta.json` dichiara **da quale commit e di quando** è la copia — l'anti-trappola della fotografia che sembra viva. Lato repo-app sui due rami (`sync-test-loader.yml`, `CLAUDE.md` corretto); verificata **dal browser vero**: v6.243 TEST, `PMO_FORCE_ENV` intatta, solo `cudi…` contattato. ⚠️ **Residuo dichiarato**: manca il secret `TEST_LOADER_SYNC_TOKEN` (solo lui può crearlo) — senza, la copia si aggiorna **col cron**, non all'istante. 🔄 **E il «~10′» del cron è caduto il 18/08, misurato**: il cron è configurato `*/10` ma GitHub gli schedule li esegue «quando può» — intervalli reali **24-48 minuti** quel giorno, e il giro è passato **25 secondi prima** del merge della 6.244, lasciando il sito vecchio per mezz'ora mentre il committente lo guardava. La via manuale (`sync-app` da Actions) resta quella giusta quando serve adesso; e i cron dei repo fermi GitHub li spegne dopo ~60 giorni, quindi se un giorno TEST sembra vecchio la prima cosa da leggere è `app-meta.json`. |
| — | ✅ *(17/08, 30ª sessione — nata da una sua richiesta, non dalla coda)* 🎾 **Chi CHIEDE il suo livello e non ce l'ha ora vede il bottone del test.** Il bottone «🎾 TEST LIVELLO DI GIOCO» esisteva dal 9/08 ma nasceva **solo** sotto il rifiuto `serve_livello`: lo vedeva chi provava a **organizzare**, non chi il livello lo **chiedeva** — che leggeva *«Non risulti ancora avere un livello di gioco assegnato.»* e basta. L'unica frase del bot che diceva «non ce l'hai» senza dire come prenderselo. ⭐ **Ci va in tutt'e due le strade** — la risposta del modello (quella normale) e la riserva di quando il modello tace: metterlo in una sola avrebbe fatto un bottone presente **metà delle volte**, ed è la lezione delle «tre schermate» dell'11/08, quando il numero del livello usciva **dal modello** proprio perché avevo cercato solo i testi. 🔧 `offertaDelTest` torna **frase e bottone insieme**, così i due punti di chiamata non possono divergere; il ponte si disturba **solo** quando il livello manca davvero, perché chiedere il link **conia un gettone**. 🧪 Banco **1035 → 1055**, typecheck pulito, **tre sabotaggi** ognuno verificato di essere atterrato — e uno **non lo era**, fermato dalla guardia invece che passato per verde. 🚨 **E il primo sabotaggio ha smascherato una mia riga inerte** (vedi il filo della 30ª). 📦 PR **#16** del repo del bot, `main` **`2a1c069`**, **deployata sul bot di PROVA** (riavvii 8 → 9); ⛔ **sui soci NO**, e ci vuole un ok suo separato. ⚠️ Il bottone lo vede **solo chi il livello non ce l'ha**: aprirlo a tutti aspetta la voce **55**, dal 18/08 dentro la **61** § A ⇒ [`docs/regole-livello-giocatori.md`](../regole-livello-giocatori.md) |
| **53** | ✅ *(16/08, 29ª sessione — **chiusa da lui**: «chiudi la cinquantatré»)* 🔁 **Quando il bot non sa com'è andata, va a chiedere al gestionale.** ⭐ **Collaudata su PROD col cancello di Caddy manovrato da GitHub Actions**, sul bot dei soci, slot `2026-08-29 09:00 C1`: il bot ha **taciuto 3′38″ POTENDO rispondere** e ha detto «no» **86 secondi dopo** aver avuto la prova (scrittura 21:20:23.9 · sync atterrato dopo di essa 21:24:02 · verdetto 21:25:28). ⇒ Il rosso ① — *il «no» che esce prima che la copia si sia rinfrescata* — **non si è verificato nella finestra in cui era più facile che capitasse**. Nessuna prenotazione vera nata su Matchpoint, verificata nella copia fresca. ⭐⭐ E il **controllo positivo non è stato costruito: stava nel registro** — alle 20:52 della stessa sera, sullo stesso bot, un `esito IGNOTO` **senza** riga `[attesa-esito]`, perché il codice non c'era ancora. 🚨 Due righe della scheda erano **false** e sono corrette: la «strada del modello» (*«si conferma scrivendo»*) **non esiste** — la conferma è un tocco, per disegno — e la citazione di codice sull'ambiente di prova. ❓ E la mia ipotesi che l'aggancio del modello fosse **codice morto** è **sbagliata**: `pendenti.ts` lo lascia passare se il modello disobbedisce, e `scritta_alle` arriva fino in fondo ⇒ quel ramo copre proprio la disobbedienza. |

| voce | cosa |
|---|---|
| **51** | ✅ *(16/08, 27ª sessione — **chiusa in giornata, prova a QUATTRO MANI**: «facciamo questa prova», poi «fatto» e «fatto in prod»)* 🔒 **La registrazione pubblica di nuovi utenti è CHIUSA, su TEST e su PROD.** Era aperta: chiunque, da qualunque parte, poteva crearsi un account e diventare `authenticated` — ed è ciò che rendeva pubbliche di fatto le funzioni concesse a quel ruolo (voci 49 e 50). 🤝 **La modalità è quella della 41 — lui le mani, la sessione gli occhi**: l'interruttore sta nel pannello Supabase e **fra gli attrezzi di qui non c'è nulla che lo tocchi** (verificato cercandolo, non dedotto). 🧪 **Il banco, montato PRIMA del suo click**: ① una sonda discriminante sulla registrazione pubblica, con password volutamente invalida **così nessun utente può nascere in nessuno dei due esiti** — a porta aperta risponde `weak_password`, a porta chiusa `signup_disabled`; ② una **misura di partenza** su TEST, con una scheda staff usa-e-getta: creare l'accesso **funzionava** (`ok/created/confirmed`, utente verificato in `auth.users`); ③ e poi **azzeramento**, per far ripartire la prova dalle stesse identiche condizioni. ⚖️ **La misura di partenza è ciò che rende la prova una prova**: senza, un «funziona» dopo il click non avrebbe distinto *«l'interruttore non dà fastidio»* da *«questa cosa non funzionava neanche prima»*. ✅ **Esito su TEST**: registrazione pubblica **`signup_disabled`**, e la creazione dell'accesso staff **identica a prima** — `ok/created/confirmed`, con l'utente **verificato nel database**, non solo un 200 di cortesia. ⇒ Ciò che era una mia *conoscenza* («la strada amministrativa non passa da quell'interruttore») è diventata una **misura eseguita sul sistema vero**. 🧹 Pulizia verificata: **0 residui**, `auth.users` di TEST tornato a **5**. ✅ **Esito su PROD**: `disable_signup` = **true** e `signup_disabled` alla sonda; **6 utenti** e **4 staff attivi** invariati, **0** residui finti. ⛔ **Di proposito su PROD NON è stato creato nessun utente di prova**: la tenuta della creazione staff è già dimostrata su TEST, che gira la **stessa edge function**, e un utente finto in produzione non lo si fa nascere «solo per un minuto». 🧯 **E un inciampo che vale la regola**: al primo giro la casella risultava spenta **nella schermata** ma `disable_signup` era ancora `false` — mancava il **«Save changes»**. L'ho visto perché **ho misurato invece di credere alla schermata**, e la schermata stessa lo diceva col pulsante ancora acceso. ⇒ Su un pannello, *spento a video* e *salvato* sono due fatti diversi. ↩️ Reversibile: è un interruttore, si riaccende con un click. |
| **50** | ✅ *(16/08, 27ª sessione — **nata dalla voce 49 e chiusa in giornata su sua scelta**: «fai la prima», cioè la guardia invece della revoca)* 🔒 **`get_self_assessments_by_tokens` non versa più nome, cognome e telefono a chi non è staff.** Il difetto nasceva dalla scoperta che la **registrazione utenti è APERTA**: con `authenticated` che vuol dire *chiunque*, il solo grant non proteggeva nulla — e la funzione, chiamata da un registrato **non-staff** con un gettone vero, restituiva **1 riga con dati personali valorizzati** (misurato eseguendo, senza far comparire né gettone né dati). 🛠️ **La cura**: guardia di staff **dentro la funzione**, con l'idioma già usato da `pmo_get_records_admin` & c. (`pmo_current_staff_profile()` → `AUTH_REQUIRED`) — scelta sopra la revoca perché **protegge a prescindere dai grant**, che si possono ridare per sbaglio. 🎯 **E il CONTROLLO POSITIVO è FALLITO al primo colpo, che è ciò che ha salvato il lavoro**: la guardia respingeva **anche lo staff vero**. Con la sola prova negativa — «l'intruso non passa», quella che dà ragione — sarebbe andata in produzione una funzione che **respinge tutti**. ⚖️ E la colpa era **della sonda, non della guardia**: `pmo_current_staff_profile()` vuole **due** cose dal token, `auth.uid()` **e l'email**, e io ne passavo una sola — la 24ª, *questa sonda guarda nel cassetto giusto?*, in un punto dove il cassetto ne ha due. ✅ **Verificato eseguendo, su TEST e su PROD**, con assert che avrebbero abortito la transazione: registrato non-staff → `AUTH_REQUIRED`; registrato con **identità inventata** → `AUTH_REQUIRED`; **staff vero → 1 riga, continua a funzionare**; `anon` → `42501`. E la controprova **dall'esterno via HTTP** con la chiave pubblica: **401 / 42501** su entrambi. ↩️ Reversibile, SQL di ripristino **verbatim** in testa a entrambe le migrazioni. 🚨 **E un guasto PREESISTENTE trovato per strada, NON curato**: l'app chiama questa RPC con la **chiave pubblica** e non col token dello staff (`index.html:29298`) ⇒ da quando la **voce 44** ha revocato `anon`, quel percorso risponde **401 / 42501** — cioè *era già rotto prima di questa voce*, misurato via HTTP. Riguarda il tasto «aggiorna risposte» e la riga «Schema autovalutazioni» del pannello diagnostico. Non se n'era accorto nessuno perché la sezione è **congelata dal 13/06** (`PMO_ASSESSMENT_PARKED`). ⛔ **Lasciato com'è di proposito**: ripararlo vuol dire far passare all'app il token dello staff, cioè toccare `index.html` di una sezione congelata. 📦 **E la decisione è arrivata la sera stessa**: *«lasciare com'è, scrivendolo»*, perché **quel processo ora lo fa il bot e la sezione non si riaccenderà** ⇒ è la voce **52**, in coda, con dentro la misura e le due avvertenze per un'eventuale potatura. |
| **49** | ✅ *(16/08, 27ª sessione — **nata come nota misurata e chiusa in giornata su sua delega**: «fai tu e scegli la migliore soluzione»)* 🔑 **Il PIN admin: chiusa la porta, non solo stretta.** 🎯 **Il reperto che ha cambiato la cura, e stava in una MIA proposta sbagliata**: avevo proposto di revocare `pmo_admin_pin_ok`, ma **3 delle 12 funzioni non lo chiamano affatto** — `upsert_assessment_tokens_admin` e `upsert_post_match_feedback_tokens_admin` fanno `extensions.crypt()` **in proprio**. Revocare il solo oracolo avrebbe chiuso la porta lasciando **due finestre** altrettanto buone per provare il PIN a ripetizione: è la 23ª — *lo strumento che guarda un pezzo solo del bersaglio* — applicata a una cura invece che a una sonda. ⇒ La cura è diventata **revoca ad `authenticated` di tutte e 12**, non di una. 🔎 **La premessa, misurata prima di toccare**: `admin_pin` compare **48 volte nel repo e tutte nei file di schema** (`manual-sql`, `migrations`) — **zero chiamanti** in client, edge e worker ⇒ quella famiglia è **codice morto**, e questo ha reso la cura a rischio nullo e insieme ne ha ridimensionato il beneficio. 🛠️ **Tre mosse, su TEST e su PROD**: ① `pmo_admin_pin_ok` **rincara l'hash a bcrypt 12** al primo accesso riuscito (l'unica strada senza il PIN in chiaro, che non va chiesto in chat); ② **12 revoche** ad `authenticated` per progetto; ③ **freno** — tavolo `pmo_admin_pin_attempts` (RLS attivo, solo `service_role`), max **10 falliti per attore in 15 minuti**, poi `PIN_THROTTLED`. 🧪 **Il ramo del rincaro non era mai stato ESEGUITO da nessuno**, quindi è stato provato a parte con un PIN finto a costo 06 in transazione annullata: sbagliato → `false` e costo **resta 6**; giusto → `true` e costo **sale a 12**; e la prova che conta, **lo stesso PIN funziona ANCHE DOPO il rincaro** (se no era una chiusura fuori). ✅ **Verificato sul bersaglio eseguendo, su entrambi i progetti**, con assert che avrebbero abortito la transazione: `authenticated` → oracolo **42501**, → finestra laterale **42501**; controlli **positivi** superati — la variante **senza** PIN resta viva, `pmo_get_records_admin` senza PIN risponde `AUTH_REQUIRED` come prima, e `service_role` raggiunge ancora l'oracolo. 📏 **Esito: `pin_ancora_esposte` = 0 su PROD e su TEST**; `authenticated` sulle `SECURITY DEFINER` scende **40→28** (PROD) e **39→27** (TEST), `anon` **20/20** invariato, `service_role` **58/46** intatto. ↩️ Reversibile, SQL di ripristino **verbatim** in testa a entrambe le migrazioni. ⛔ **Residuo dichiarato**: l'hash **resta a `$2a$06$` finché qualcuno non entra con successo almeno una volta** — e siccome nessuno chiama quel percorso, **il rincaro potrebbe non scattare mai**; è una cura che si arma da sé se la strada rivive, non un lavoro già fatto. 🟢 **E il residuo «non si sa se la registrazione sia aperta» HA AVUTO RISPOSTA in giornata, su sua richiesta di controllare: è APERTA** su entrambi i progetti (`disable_signup=false`, letto da `GET /auth/v1/settings`, endpoint pubblico di sola lettura — che avevo dichiarato inesistente senza provarlo). ⇒ **Questa voce valeva molto più di quanto le attribuissi**: fino a stamattina il PIN a bcrypt 6 senza freno era esposto **a chiunque volesse iscriversi**, non ai 6 dello staff. Il resto della conseguenza — la funzione **senza guardia di staff** che versa nome/cognome/telefono — è la **voce 50**, curata subito dopo. |
| **15** | ✅ *(16/08, 27ª sessione — **chiusa da lui**: «chiudi la quindici». Era in sezione D, «resta qui finché non la guardi»: l'ha guardata)* 🎾 **La PARTITA APERTA si riconosce sulla card del calendario staff.** Fatta su TEST (6.240) e promossa a PROD (6.232) il 15/08; restava aperta **solo** in attesa che il committente la vedesse col login staff, che dal cloud non si raggiunge. ✅ **Rimisurata su `origin/main` prima di chiudere**, non data per buona dalla scheda: «Partita aperta» ×6, `isSameField` ×10, `match_invitation` ×6, `_staffCalBuildHorizontal` ×4 — e **`'C'+c` a ZERO**, cioè il difetto che avrebbe reso la card invisibile per sempre **non** è in produzione. ⚖️ Chiusa perché la condizione che la teneva aperta era **il suo sguardo**, e c'è stato. |
| **18** | ⏸️ **SOSPESA** *(16/08, 27ª sessione — **decisione sua**: «la diciotto al momento la sospendiamo, quindi levala dall'elenco»)* 📣 **Pannello avvisi nel gestionale** — lo staff vede cosa il bot ha mandato ai soci. ⚠️ **Non fatta e non annullata: sospesa**, e sta qui perché è dove vivono le voci tolte dall'elenco — l'etichetta lo dice, come per le due annullate del 15/08. 📌 **Il perché, scritto perché non torni per sbaglio fra un mese**: nessun problema tecnico l'ha fermata, è una scelta di priorità del committente. ⚖️ E resta vero il vincolo che la scheda portava: condivide il nodo col **pannello autorizzazioni** ⇒ quando si riprende, **si disegnano insieme**. |
| **48** | ✅ *(16/08, 27ª sessione — **curata, verificata sul bersaglio e chiusa da lui**: «chiudila e aggiorna i docs». Aperta dal committente il 16/08 a lista svuotata)* 🔒 **Le `SECURITY DEFINER` di TEST allineate a PROD.** Censite ed **ESEGUITE** tutte e **32** le funzioni aperte ad `anon` su `cudi…` (transazioni annullate, con controllo positivo): nessuna versa dati a un `anon` nudo — **12** `AUTH_REQUIRED`, **13** `INVALID_ADMIN_PIN`/`pin_ok=false`, **2** a `0 righe` corretto, **3** pubbliche per disegno, **1** reperto C (già deciso alla 47), **2** trigger. 🎯 **La divergenza vera, in UN SOLO senso**: 12 funzioni — le varianti *col PIN* delle admin più `pmo_admin_pin_ok` — erano aperte ad `anon` su TEST e **`authenticated`-only su PROD** (20 anon PROD + 12 = 32 TEST, la somma torna). ⇒ Su TEST l'intera superficie admin, **scritture comprese** (`pmo_upsert_records_admin`, `pmo_upsert_staff_user_admin`, `pmo_set_staff_user_status_admin`), era raggiungibile dalla **chiave pubblica** col solo PIN, e `pmo_admin_pin_ok` aperta ad `anon` rendeva pure **forzabile** il PIN. E `cudi…` ha gli **stessi soci veri** di PROD. 🚨 **La riga di cura proposta era insufficiente**, misurato in transazione annullata *prima* di agire: `revoke … from anon` lasciava `anon` dentro **via `PUBLIC`**. La cura vera è **tre mosse** — `grant service_role` esplicito → `revoke from public` → `revoke from anon` — che porta TEST **esattamente** alla forma ACL di PROD; applicata in un'unica transazione con `assert` che avrebbe abortito se una sola delle 12 non tornava. ✅ **Verificato sul bersaglio ESEGUENDO**: le 12 da `anon` ora `42501 permission denied` (non più `INVALID_ADMIN_PIN`), `anon` sulle `SECURITY DEFINER` di TEST **32 → 20** = uguale a PROD, le non toccate intatte (`AUTH_REQUIRED`, `TOKEN_MISSING`), e il **controllo positivo ③**: `service_role` sull'ex-12 risponde `INVALID_ADMIN_PIN` *non* `42501` ⇒ la **trappola `service_role` della 36 non ha morso** (`service_role` resta 46). ↩️ Reversibile (`grant execute … to anon` sulle 12). ⛔ **Residuo dichiarato**: l'**entropia del PIN** non è stata valutata — non serve più per questo vettore (`anon` non arriva più né su TEST né su PROD), ma resta per chi è `authenticated`; e il **reperto C** è intatto per tua decisione della 47. |
| **43** | ✅ *(16/08, 26ª sessione — **curata, verificata sul bersaglio e chiusa da lui**: «chiudi la quarantatré». Aperta dal committente il 15/08 chiudendo la 42)* ⏱️ **La continuazione staccata che riscriveva lo stato locale — `staffCalRefreshFromCloud`.** Il difetto: `_staffCalCommitLocalCancel` toglieva le righe dalla memoria e **poi** spingeva le lapidi **senza attenderle**, lasciando una finestra di ~100-500 ms in cui il locale diceva «annullata» e il cloud ancora «attiva». 🔬 **VISTO SUCCEDERE** il 16/08 sull'app che gira, non dedotto: ricostruito lo stato della finestra dalla console remota (TEST, scritture bloccate), la riga tolta dalla memoria **è TORNATA** dopo un aggiornamento forzato, e la controprova simmetrica — una riga finta assente nel cloud — è stata **CANCELLATA**. ⇒ L'aggiornamento **non fonde, SOSTITUISCE**. ⭐ Era la **previsione B**, cioè quella che poteva smentire la diagnosi. 🚨 **E la misura ha smentito ENTRAMBE le cure che la voce proponeva**: allungavano la vita di `_staffCalPendingEdits`, ma **la strada rotta quella chiave non la legge** (la riassegnazione dell'occupazione sta 62 righe più in basso e non la riconsulta mai) ⇒ avrebbero fermato **solo** il poll a 4 s, lasciando passare gli altri quattro percorsi forzati. Ed è caduto anche il motivo per preferire la cura «larga» — *«copre anche spostamento e modifica»* — **misurato falso**: lo spostamento non scrive in quelle liste e la modifica dalla v6.150 non scrive in locale prima del sì di Matchpoint. ⚖️ **La cura scritta è una terza**, nata scrivendola: *«aspettare la spinta»* **non chiude la finestra, la sposta dentro l'attesa** — l'unico ordine che la chiude è **prima il cloud, poi la memoria**, così non esiste mai un istante in cui il locale è avanti. 🧪 **Provata col SABOTAGGIO, non col verde**: il caso 98 alla prima stesura era **inerte** (nel banco la spinta si concludeva nell'istante in cui partiva) ed è servito `CLOUD_WRITE_RESPONSE_DELAY_MS`, gemello opposto del knob della 42; con la cura **95/95** e **98/98**, togliendola **94/95** e **97/98**, e cade **solo** quel caso. ✅ **Previsione D eseguita da qui**, e la nota che la diceva irraggiungibile era una **deduzione falsa**: `staffCalGetSlots` non è su `window`, ma `renderCal` renderizza il calendario **vero** — il fantasma **non si vede**, con controllo positivo e controprova, e il bordo della protezione è il **TTL di 30′** (a 29′ nascosto, a 31′ **compare**). ✅✅ **E la CURA VISTA FUNZIONARE con un annullo VERO su TEST**, su sua autorizzazione: a 2 s dall'avvio, con la spinta in volo, la riga è **ancora lì** (col difetto sarebbe stata 0 — è la firma della cura), e **un refresh forzato dentro la finestra non resuscita più niente**; a spinta conclusa 0, e ci resta. ⇒ La previsione **B non è «verificata», è resa IMPOSSIBILE**, e le previsioni A/B della procedura vanno lette al contrario perché descrivevano l'app **malata**. 🚨 **Il controllo che ha preceduto tutto, e che la guardia della console NON dà**: verificato **nella pagina viva** che la simulazione Matchpoint fosse installata — una POST di sonda ha risposto `simulated:true` **senza uscire dal browser**, e la guardia «sola lettura» **non l'aveva bloccata**, perché a rispondere è l'app *prima* della rete. Su quella strada la protezione è il flag `PMO_BOOKINGS_SIMULATE`, **non l'attrezzo**. 🧊 **Scritte due righe su TEST** (lapide + soppressione), **nessun `booking_job` e nessun `staff_cancel`** ⇒ verso worker e Matchpoint **niente**; si richiude da sé al prossimo sync. ✅ **PRODUZIONE INTATTA, misurata**: la stessa occupazione su `qqbf…` resta `deleted: false`. 🔑 **Il blocco non era un permesso ma il RUOLO** (`role === 'readonly'`): toccata la sola colonna per la durata della prova e **rimessa subito**, verificato dopo. 🚨 **E la riga da annullare l'ha scelta lui**, perché sul calendario di TEST **non esiste nessuna riga di prova**: le 45 occupazioni future sono tutte prenotazioni vere del circolo e le tre campionate erano vive **anche in produzione** — la regola *«se risulta anche in PRODUZIONE, fermati»* ha funzionato. 🧯 **Due sonde mie sbagliate, annotate**: la chiave dell'occupazione ha **6 segmenti quando il nome manca** e 7 quando c'è, e leggendo sempre il sesto avevo scambiato la **durata** per un nome; e il ramo della PR l'avevo costruito su una base **stantia**, visto solo perché `mergeable_state` diceva `dirty`. ⛔ **Residuo dichiarato**: la finestra è stata **ricostruita** e non **colta** (che il momento sia raggiungibile davvero resta un calcolo), e la terza scrittura di `staffCalRefreshFromCloud` — quella dei **soci** (38101/38107) — **non è stata misurata**: è il vicino di casa di questa voce, non il suo residuo. 📄 [`docs/voce-43-prova-dal-mac.md`](../voce-43-prova-dal-mac.md) resta come **fotografia del difetto**, non come collaudo della cura. |
| **47** | ✅ *(16/08, 26ª sessione — **promossa e poi chiusa da lui**: «chiudi la quarantasette». Tre reperti, **tre autorizzazioni separate**, mai due insieme)* 🔒 **Le 33 `SECURITY DEFINER` aperte ad `anon` su PROD, lette una per una — e 13 porte chiuse.** ⚖️ **Non è una campionatura nuova: è la chiusura di una vecchia.** La voce **36** (14/08) chiuse 13 funzioni e **dichiarò per iscritto ciò che non aveva guardato** — *«NON esaminate: 3 letture per gettone e la robustezza del PIN»*; la **44** ne prese **una** e ci trovò dietro **un socio vero col telefono**. Restavano le altre due e il PIN. 📏 Numero **ricontato, non ricopiato**: 58 `SECURITY DEFINER` in `public`, **33** eseguibili da `anon`. 🔬 **31 eseguite come `anon`** in transazioni annullate (rollback verificata *prima* di cominciare), più **2 che via RPC non si chiamano affatto: sono `trigger`** — falsi positivi del linter, e vanno detti perché gonfiano il numero che spaventa. **La famiglia `*_admin` regge tutta**, col PIN e senza, in lettura e in scrittura — e non per lettura del codice: le scritture sono state **lanciate** con un carico vero e hanno risposto `AUTH_REQUIRED`/`INVALID_ADMIN_PIN` **prima** di toccare qualunque riga. 🔒 **Reperto A — `get_assessment_token`**, la gemella della 44 rimasta aperta: come `anon` restituisce **nome e stato di un socio vero** sul gettone debole già noto. Revocata ad `anon` e PUBLIC; **non aveva chiamanti in nessun repo**, quindi non c'era niente da rompere (**33 → 32**). 🔒 **Reperto B — `pmo_admin_pin_ok`, un ORACOLO sul PIN**, stessa forma di `pmo_verify_data_routine_secret` che la 36 chiamò «la chiave che apre le altre porte»: bcrypt **costo 6**, **~200 tentativi/s** da `anon` senza limite né traccia, e il PIN apre le 11 varianti `*_admin(p_admin_pin, …)` — elenco staff con email e permessi, registro di controllo, **e le scritture**. ⭐ **Ed è qui che la misura ha cambiato la cura**: `pmo_admin_pin_ok` è la **guardia interna** delle 11, quindi **ognuna è a sua volta un oracolo** — cronometrate, 100 tentativi in **508 / 486 / 472 ms** ⇒ le varianti sono oracoli **alla stessa velocità**, e `pmo_upsert_records_admin` è per giunta quella che a indovinare concede le **scritture**. Revocare il solo oracolo avrebbe **spostato l'attacco senza ridurlo**: una cura che sembra una cura. Revocate **tutte e 12** (**32 → 20**). ✋ **Reperto C — `get_post_match_feedback_by_tokens`: LASCIATO, su sua decisione e con la ragione scritta** — oggi non espone niente (**0 righe** su PROD *e* su TEST), quindi è latente e non aperto. Nella sua riga stanno il **quando** (prima di accendere il feedback post-partita) e il **come**. 🧯 **E il «come» smentisce un costo che avevo messo io fra le ragioni per lasciar perdere**: dicevo che bisognava *scegliere* un permesso staff — falso, la **scrittura** della stessa funzionalità due funzioni più su (29732) usa già `pmoStaffRpc(…, 'cloud_sync', …)`, e la lettura (29852) è **l'unica asimmetrica della sua famiglia** ⇒ il permesso è simmetria, non giudizio. La decisione resta sensata, il costo che le avevo attribuito no. ✅ **Ogni revoca provata prima/dopo, con controprova POSITIVA** (`authenticated` continua a eseguire) **e, sulla B, anche NEGATIVA**: la variante **senza** PIN resta raggiungibile da `anon` e risponde `AUTH_REQUIRED` ⇒ la strada che l'app usa davvero non è stata toccata. ⭐ **Il 32 → 20 confermato TRE volte**: `pg_proc`, il **linter** a 20 `anon_security_definer_function_executable`, e il **totale avvisi da 99 a 87** — esattamente **−12**, senza avvisi nuovi; `authenticated_…` resta **40**. 🔎 **Perimetro verificato su tre lati** prima di chiudere, perché chiudere alla cieca è l'errore del reperto C: app **0**, edge **0**, **bot 0** — repo `assistente-padel-agent` agganciato apposta su sua autorizzazione, e lo zero è **un esito e non una sonda cieca** perché il controllo positivo trova i tre ponti noti su 65 file / 16.460 righe. ↩️ Due migrazioni **reversibili**, con le `GRANT` di ripristino **verbatim** in testa. 🧊 **Zero righe di dati toccate.** 🚨 **E il reperto di METODO, che vale quanto le porte chiuse: due conteggi della tabella erano SBAGLIATI** (10 e 12 invece di **12 e 11**), e a smascherarli non è stata una rilettura ma il fatto che **la somma facesse 32 su 33**. Causa: `pmo_upsert_staff_user_admin` ha due overload **entrambe con valori predefiniti**, e la chiamata a 5 argomenti **posizionali** si è risolta sulla 6-argomenti — **quella col PIN** — perché PostgreSQL preferisce `text` a `jsonb` per l'`unknown`: credevo di provare la variante senza PIN e riprovavo quella col PIN. Rifatta con la **notazione per nome**, che sulla gemella non può cadere. ⚖️ **E la cura è stata cercare la CLASSE, non l'istanza**: chieste al database **tutte** le funzioni aperte ad `anon` con parametri predefiniti — **11 in 5 famiglie** — e ricontrollate le risoluzioni una per una; le altre 10 erano legate giuste, **una sola** era sbagliata. 📌 Da tenere: **una funzione con overload e valori predefiniti non si prova per posizione** — è la 24ª nella forma più subdola, perché qui i due cassetti hanno **lo stesso nome**. ⛔ **NON guardato TEST**: la voce chiedeva le 33 di **PROD**, e su `cudi…` il conto sarà diverso — la 36 aveva già misurato che là la famiglia era «un rattoppo a campione». È il vicino di casa di questa voce, non il suo residuo. ⛔ **Il PIN non è stato indovinato né letto**, e non si farà: si misura l'oracolo, non il segreto. 🔴 **E ciò che resta scoperto, scritto perché nessuno legga «famiglia bonificata»: le 20 ancora aperte ad `anon`** non sono state rilette dopo questa potatura — quelle censite qui erano 33, e 13 sono state chiuse. |
| **44** | ✅ *(16/08, 25ª sessione — **curata su sua autorizzazione**, e **chiusa da lui**: «chiudi da quarantaquattro»)* 🚨 **Una fessura su DATI PERSONALI VERI in produzione, chiusa.** `get_self_assessments_by_tokens` è `SECURITY DEFINER` e restituisce `first_name`, `last_name` e **`phone`**; aveva `EXECUTE` ad **`anon` e a PUBLIC** ⇒ chiunque dalla rete, con la sola chiave pubblicabile e un gettone, poteva leggerli. ⭐ **Ed è nata da una conclusione giusta nel ragionamento e sbagliata nel fatto**: la nota della 15ª diceva «non un buco aperto» perché *«vuole i gettoni in ingresso»* — premessa **vera**, ma fra i 1364 gettoni uno è da 11 caratteri, `MAURIZIO001`, e dietro c'è **un socio vero col telefono**. A vederlo non è bastato leggere i grant: è servito **eseguire la funzione come `anon`**. ✅ **Controllo negativo, fatto prima di credere alla gravità**: la lettura **diretta** della tabella come `anon` vede **0 righe** (RLS attivo, zero policy) ⇒ quella RPC era davvero l'**unica** finestra rimasta accanto alla porta chiusa il 12/08, non una fra tante. 🔧 **La cura**: `REVOKE EXECUTE … FROM anon, PUBLIC` sui **due** progetti — il contratto vive sui due lati — lasciando `authenticated`, così sparisce l'accesso *senza credenziali* e non quello dello staff. 🔬 **Provata su TEST prima che su PROD, e in tre modi**: `anon` **3 righe → 42501** su TEST e **1 riga → 42501** su PROD; **controprova positiva** (`authenticated` passa ancora, di qua e di là) fatta apposta perché senza di essa «blocca tutto» si legge come «funziona»; e una **conferma indipendente che non veniva dalla stessa sonda** — le `SECURITY DEFINER` aperte ad `anon` su PROD passano da **34 a 33**. ↩️ Migrazioni **reversibili**, con le due `GRANT` di ripristino **verbatim** in testa. 🧊 **Zero righe di dati toccate**: tutte le prove d'attacco in transazioni annullate. ⚠️ **Residuo dichiarato e NON fatto**: il gettone `MAURIZIO001` e i quattro `TEST*` **esistono ancora**. Oggi non aprono più niente senza credenziali, quindi non sono un buco — restano **gettoni deboli**, e non sono stati toccati perché dietro c'è **il dato di una persona reale**: prima di cancellare va misurato cosa ci punta. 🔴 **E ciò che questa voce NON copre, scritto perché nessuno legga «famiglia bonificata»: le altre 33** `SECURITY DEFINER` aperte ad `anon`. Questa è **l'unica letta riga per riga**; il linter le segnala tutte con lo stesso titolo da sempre, ed è esattamente la condizione in cui stava la 44 fino a stamattina — segnalata, letta da nessuno, e con un socio vero dietro. |
| **45** | ✅ *(16/08, 25ª sessione — **fatta su sua autorizzazione**, «fai la 45». PROD **6.233**, non ancora promossa)* **Tolto `fetchAssessmentRawResponsesByTokens`: un ripiego che non poteva partire.** ⭐ **La voce chiedeva «a cosa serviva», e la risposta ha trovato un secondo motivo che nessuno aveva visto.** Serviva a rileggere `raw_response` quando la RPC `get_self_assessments_by_tokens` **non portava** quella colonna. Oggi la porta **sempre** — `coalesce(s.raw_response, '{}'::jsonb)` — quindi la chiave c'è in ogni riga, e la guardia che lo accendeva (`!r?.raw_response`) era diventata **IRRAGGIUNGIBILE**: in JS `{}` è **vero**. ⇒ Il ripiego non partiva **nemmeno nei casi per cui era stato scritto** — le risposte davvero vuote, misurate **6 su 42**. 🔬 Provato sul bersaglio, non ragionato: la RPC interrogata sui token veri restituisce `raw_response` **presente e `{}`**, zero righe nulle. 🎯 **Quindi era morto DUE volte**: condizione irraggiungibile *e*, se anche fosse partito, `self_assessments` ha RLS attivo e **zero policy** ⇒ quella `GET` risponde 200 con lista vuota, sempre, sotto un `catch` che taceva. 🧯 **E due numeri della scheda erano falsi**, annotati e non corretti di nascosto: la riga è la **29214/29223**, non la 29939; e le policy sono **zero**, non «3 di INSERT». 📌 Il contesto che ridimensiona tutto: la sezione è **congelata dal 13/06**, la tabella ha l'ultima riga del **23/06** e **zero in 30 giorni** — un vicolo cieco **dentro una stanza già chiusa**, la stessa forma che la 20ª aveva già incontrato. ✅ **Verificato DOPO aver agito**, che è dove si tradisce un analizzatore cieco: **zero riferimenti orfani**, `normalizeAssessmentRawResponse` **ancora viva in 13 punti** (nessuna cascata), sintassi verde su **tutti e 5** i blocchi `<script>` — non su uno, che è la trappola della 23ª — e banco **94/94**, in **A/B contro `main` intatto**. ⚖️ **Il verde del banco NON dimostra che il codice fosse morto**: nessun caso può coprire un ramo irraggiungibile. Dimostra che togliendolo non è caduto nulla intorno; a dimostrare che era morto è la misura sulla RPC. ⛔ **Non promossa**: le righe stanno sul ramo, PROD serve ancora la 6.232 finché non lo decide lui. |
| **46** | ✅ *(16/08, 25ª sessione — **fatta su sua autorizzazione**, «fai la 46»)* **`livello.autovalutazione_url` tolta dalla kb di TEST: adesso le due kb sono IDENTICHE.** Puntava alla pagina di una sezione **congelata dal 13/06**; su PROD era stata tolta il 9/08 — ed è quel gesto ad aver prodotto `pmo_bkp_kb_livello_20260809` — su TEST no. 🔬 **Tre misure prima di scrivere, e la prima ha corretto la nota**: ① non vive nel **codice** ma nel **database** (`pmo_ai_settings`, chiave `assistant_kb`), quindi il grep in `index.html` non l'avrebbe mai trovata; ② **cosa ci punta**: zero occorrenze in tutto il repo fuori dai documenti ⇒ nessun lettore da rompere; ③ **le 13 chiavi di primo livello erano già identiche** fra i due progetti, e `livello` era l'unica a divergere (82 caratteri contro 2). ⚠️ **Ma la kb non è inerte, ed è il motivo per cui la voce esisteva**: `consumer-player-readmodel` — il **ponte del bot** — restituisce il valore **intero** (`kb: kbRow?.value`), senza filtrare le sezioni ⇒ su TEST quella riga arrivava **davvero al modello**. ⭐ **La verifica dopo non è «la divergenza è sparita», che avrebbe guardato solo ciò che sapevo di cercare: è che le due kb hanno la STESSA IMPRONTA** — `md5` identico, `c570a626…`, 6169 caratteri e 13 chiavi di qua e di là. Esclude anche le divergenze che non stavo cercando. ↩️ Migrazione **reversibile**, col valore esatto di prima trascritto **verbatim** in testa. ⛔ **Non provato dal vivo attraverso il ponte**: chiamarlo vuole il segreto, che da qui non c'è. Si è misurato **il valore che il ponte restituirebbe**, non la risposta del ponte — e la differenza è scritta perché non la si legga come una prova end-to-end. |
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
