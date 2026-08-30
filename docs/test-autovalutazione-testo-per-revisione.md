# Il test di autovalutazione del livello — testo completo delle regole

> **A cosa serve questo documento.** È la descrizione **autosufficiente** del test di
> autovalutazione del livello di gioco in uso al Padel Village: cosa chiede, come calcola, cosa
> scrive e cosa no. È scritto per essere dato in pasto a un revisore esterno (una persona o
> un'intelligenza artificiale) e farsi dire **se il test è fatto bene**. Non presuppone di
> conoscere il nostro codice: tutto ciò che serve per giudicare sta qui dentro.
>
> L'**allegato** `test-autovalutazione-banca-domande.md` contiene tutte e 219 le domande di
> conoscenza con la risposta giusta segnata: serve solo al revisore, non va mostrato ai soci.
>
> **Descrive il test com'è al 30/08/2026.** Quel giorno sono stati cambiati quattro punti,
> segnalati nel testo con 🔄: la banca dei trabocchetto è stata bilanciata, i pesi del calcolo
> ribilanciati, le quattro scale tecniche ritarate, e la domanda sulla frequenza ha smesso di
> essere raccolta e buttata. Le versioni precedenti sono citate dove serve a capire perché.

---

## 1. Il contesto in due paragrafi

Il circolo assegna a ogni socio un **livello di gioco** su una scala da 0,5 a 7. Quel numero
serve a **comporre le partite**: chi organizza mette in campo quattro persone di livello vicino,
e una partita fra livelli molto diversi non diverte nessuno dei quattro. Al momento **l'81% dei
soci è fermo a 0,5**, che nel nostro sistema non è un livello vero ma il «da definire»: chi sta
lì è di fatto fuori dalle partite organizzate.

Il test serve a **dare un livello a chi non ce l'ha**, e a farlo senza che qualcuno debba
guardare giocare ogni socio. Si fa dentro un bot Telegram, una domanda alla volta, con risposte a
bottoni. È **gratuito e ripetibile senza limiti**. Il livello **massimo** che il test può
assegnare da solo è **3,5 (Intermedio)**: sopra quella soglia serve un maestro che guardi giocare.

Due vincoli di comunicazione valgono ovunque: al socio si dice **sempre la parola** del livello
(«Intermedio»), **mai il numero**; e ogni messaggio deve lasciare almeno una via d'uscita — un
bottone o un'istruzione a parole — perché un socio non deve mai restare in un vicolo cieco.

---

## 2. La scala dei livelli

Sette fasce. A ogni fascia corrisponde un intervallo di numeri; al socio si mostra solo la parola.

| fascia | intervallo | colpi tipici | descrizione |
|---|---|---|---|
| Principiante | 0,5 – 1,5 | colpi piatti, servizio base | Sta imparando a non colpire i vetri. Lo scambio è breve o inesistente. |
| Base | 2,0 – 2,5 | inizio uso pareti, volée di posizione | Tiene la palla in campo a ritmi bassi. Capisce il rimbalzo sul vetro ma fatica a coordinarsi. |
| Intermedio | 3,0 – 3,5 | bandeja base, pallonetto | Inizia a giocare con strategia. La bandeja serve a non perdere la rete, il pallonetto è spesso corto. |
| Avanzato | 4,0 – 4,5 | vibora, chiquita, smash | Livello tipico dei tornei amatoriali. Sa variare gli effetti e usa bene pareti e griglia. |
| Agonista | 5,0 – 5,5 | x3 / x4, controparete | Giocatore di 3ª/4ª categoria. Grande intensità, chiude il punto fuori campo. |
| Semi-Pro | 6,0 – 6,5 | dormilona, colpi in sospensione | Giocatore di 2ª categoria. Tecnica impeccabile e lettura in anticipo. |
| Professionista | 7,0 | massima padronanza di ogni colpo | Prima categoria e circuito internazionale. Errore gratuito quasi assente. |

Un numero si converte in fascia prendendo **la prima fascia il cui massimo è ≥ al numero**
(3,2 → Intermedio). Quando il socio **sceglie** una fascia, il valore registrato è il **massimo**
di quella fascia (Base → 2,5; Intermedio → 3,5; Avanzato → 4,5 …).

---

## 3. La struttura del test

**13 domande in tutto**, così composte:

- **8 domande di profilo**, uguali per tutti, a risposta chiusa;
- **5 domande di conoscenza** (regole e nomenclatura del padel), pescate da una banca **in base
  alla fascia che il socio ha appena dichiarato**.

Regole di presentazione:

1. **Le prime tre domande sono fisse e in quest'ordine**: esperienza, frequenza, livello
   dichiarato. È una necessità meccanica: la fascia da cui pescare le domande di conoscenza si
   conosce solo dopo la terza risposta.
2. **Dalla quarta in poi l'ordine è mescolato**: le 5 domande di conoscenza sono sparse fra le
   restanti 5 di profilo, non in coda. Serve a impedire che chi rifà il test sappia che «le
   prime otto non bocciano» e si concentri solo sul blocco finale.
3. **Le opzioni di risposta sono mescolate solo su 4 domande** — le quattro tecniche (scambio,
   vetro, rete, colpi alti) — perché lì le opzioni erano in ordine crescente di difficoltà e chi
   rifaceva il test poteva capire che «l'ultima è sempre la più alta» e pilotare il risultato.
   Le altre quattro restano in ordine: due sono scale numeriche (da quanto giochi, quante volte
   al mese) dove nessuno guadagna a mentire sulla posizione, e due sono i sette livelli in scala,
   dove il nome della fascia è scritto sul bottone e l'ordine non aggiunge informazione.
   La mescolata è **uniforme** (tutte le permutazioni equiprobabili): è stato scartato di
   proposito il vincolo «l'opzione più alta mai in ultima posizione», perché insegnerebbe al
   socio a eliminare un candidato a ogni domanda.
4. **Una domanda alla volta**: la successiva non viene consegnata finché non è arrivata la
   risposta alla precedente. Serve a togliere il tempo per cercare le risposte altrove.
5. **Il numero di domande annunciato all'inizio è 13**, ed è una previsione: chi dichiara
   Semi-Pro o Professionista non ha il quiz di conoscenza e ne farà 8. Il conto può **calare**
   dopo la terza risposta, mai crescere.
6. Il test **si può interrompere e riprendere**: si ritrovano le stesse domande, nello stesso
   ordine, con le opzioni nella stessa posizione.
7. Nessuna risposta libera: si accettano **solo** le opzioni offerte, e la risposta viaggia come
   posizione del bottone. Una risposta fuori elenco non passa.

---

## 4. Le 8 domande di profilo, con i punteggi

### 4.1 Domande raccolte ma non pesate nel calcolo (usate come bandiere)

**D1 — Da quanto giochi a padel?**
Meno di 1 mese · 1-3 mesi · 3-6 mesi · 6-12 mesi · Più di 1 anno · Più di 3 anni

**D2 — Quante volte giochi mediamente al mese?**
0-1 · 2-3 · 4-6 · 7-10 · Più di 10

Nessuna delle due entra nel calcolo del livello: tutt'e due servono **solo** come segnali
d'allarme (§ 6.3). 🔄 Fino al 30/08/2026 D2 non serviva a niente — non pesava e non veniva
nemmeno mostrata a nessuno.

### 4.2 Le due domande sul livello (peso complessivo 65%)

**D3 — Che livello pensi di avere?** *(peso 0,20 — 🔄 era 0,40 fino al 30/08/2026)*
Principiante (1,5) · Base (2,5) · Intermedio (3,5) · Avanzato (4,5) · Agonista (5,5) ·
Semi-Pro (6,5) · Professionista (7,0)

**D4 — Con giocatori di che livello te la giochi alla pari?** *(peso 0,25)*
Contro Principianti (1,5) · Contro giocatori Base (2,5) · Contro Intermedi (3,5) ·
Contro Avanzati (4,5) · Contro Agonisti (5,5) · Contro Semi-Pro (6,5) ·
Contro Professionisti (7,0)

D3 e D4 avevano in origine le stesse sette parole e i soci si confondevano credendo di essere
tornati indietro: da qui la forma «Contro …». D4 è tenuta perché è l'unico confronto fra ciò che
uno **dice di essere** e ciò con cui **gioca alla pari**.

### 4.3 Le quattro domande tecniche (peso complessivo 55%, come media semplice)

🔄 **Ritarate il 30/08/2026.** Ogni risposta vale il **minimo della fascia che descrive**:
Principiante 1 · Base 2 · Intermedio 3 · Avanzato 4 · Agonista 5. Prima le quattro scale avevano
corse diverse (1-5 lo scambio, 1,5-4,5 la rete e i colpi alti) pur essendo mediate alla pari.

**D5 — Riesci a mantenere lo scambio?**

| risposta | punti |
|---|---|
| Faccio fatica a tenere 3-4 colpi | 1,0 |
| Tengo lo scambio solo a ritmo lento | 2,0 |
| Tengo scambi regolari con continuità | 3,0 |
| Tengo scambi anche con ritmo alto | 4,0 |
| Costruisco il punto con controllo | 5,0 |

**D6 — Come gestisci il vetro in difesa?**

| risposta | punti |
|---|---|
| Evito quasi sempre il vetro | 1,0 |
| Lo uso solo se la palla è facile | 2,0 |
| Difendo con il vetro in modo base | 3,0 |
| Lo uso con continuità anche sotto pressione | 4,0 |
| Lo uso per difendere e ripartire in attacco | 5,0 |

**D7 — A rete come ti comporti?**

| risposta | punti |
|---|---|
| Sto poco a rete | 1,0 |
| Vado a rete ma faccio fatica a chiudere | 2,0 |
| Gioco volée semplici | 3,0 |
| Tengo posizione e controllo le volée | 4,0 |
| Costruisco e chiudo il punto a rete | 5,0 |

**D8 — Come te la cavi con i colpi alti (bandeja, vibora, smash)?**

| risposta | punti |
|---|---|
| Non li uso | 1,0 |
| Li provo ma con poca sicurezza | 2,0 |
| Uso almeno la bandeja in modo semplice | 3,0 |
| Uso bandeja e smash con controllo | 4,0 |
| Uso colpi alti in modo tattico e affidabile | 5,0 |

La **media tecnica** è la media aritmetica semplice delle risposte date; se una risposta manca,
si media su quelle presenti. Le quattro scale hanno la stessa corsa (1-5), quindi pesano uguale e
la media può dire tutta la scala, da Principiante ad Agonista.

---

## 5. Come si calcola il livello

### 5.1 La media pesata

```
punteggio_grezzo = (0,20 × livello_dichiarato
                  + 0,25 × livello_alla_pari
                  + 0,55 × media_tecnica)  /  somma dei pesi presenti
```

🔄 **Ribilanciati il 30/08/2026** (prima: 0,40 · 0,25 · 0,35). Col vecchio assetto il **65%** del
punteggio veniva da due domande in cui il socio dice di sé; oggi è il **45%**, e la maggioranza
sta nelle risposte. La domanda sul livello dichiarato resta perché sceglie la fascia da cui si
pescano le domande di conoscenza ed è metà del segnale di coerenza.

I pesi delle componenti mancanti si escludono e il divisore si riduce (quindi le proporzioni fra
le componenti presenti restano invariate). Se manca tutto, la scheda va in revisione manuale.

### 5.2 Arrotondamento e freni

1. **Arrotondamento al mezzo punto** più vicino (2,79 → 3,0; 2,74 → 2,5).
2. **Freno verso l'alto**: il calcolato non può superare il **dichiarato + 0,5**. È il tetto
   anti-sopravvalutazione: nessuno esce dal test con più di mezzo passo sopra ciò che ha dichiarato.
3. Il risultato è comunque contenuto fra **0,5 e 7**.

🔄 **Il freno verso il basso è stato tolto il 30/08/2026.** Diceva: il calcolato non scende sotto
il dichiarato − 1,0, cioè **rialzava verso la dichiarazione** chi rispondeva molto più basso di
come si era descritto. Quel caso lo prendono già due protezioni più forti — la coerenza bassa
(§ 5.3) e la regola per cui un livello più basso non si scrive comunque (§ 7.2) — quindi il freno
non proteggeva: gonfiava. Misurato prima di toglierlo: su 44 schede reali nessuno dei due freni
aveva **mai** morso.

### 5.3 Il segnale di coerenza

```
scarto = | livello_dichiarato − media_tecnica |
scarto ≤ 0,5  → coerenza «alta»
scarto ≤ 1,0  → coerenza «media»
scarto  > 1,0 → coerenza «bassa»  ⇒ la scheda NON si applica da sola: va alla segreteria
```

(Se la media tecnica manca, al suo posto si usa il livello «alla pari»; se manca anche quello, il
calcolato — nel qual caso lo scarto è per costruzione piccolo.)

### 5.4 Tre esempi completi

| | dichiarato | alla pari | media tecnica | grezzo | dopo il freno | coerenza | esito |
|---|---|---|---|---|---|---|---|
| **A** | 2,5 (Base) | 3,5 | 3,0 (tutte le terze opzioni) | 3,025 | **3,0** (freno alto = 3,0) | alta | scrive Intermedio |
| **B** | 4,5 (Avanzato) | 4,5 | 5,0 (tutte le quinte) | 4,775 | **5,0** | alta | sopra il tetto: scrive 3,5 e manda dal maestro |
| **C** | 3,5 (Intermedio) | 2,5 | 1,0 (tutte le prime) | 1,875 | **2,0** | **bassa** (scarto 2,5) | non si applica: va alla segreteria |

Il caso A è la forma tipica: chi si dichiara Base ma gioca alla pari con Intermedi e risponde «in
modo base / semplice» su tutte e quattro le tecniche esce **Intermedio**, cioè mezzo passo sopra
quello che ha dichiarato — il massimo che il freno consenta.

Il caso C mostra cosa è cambiato togliendo il freno basso: prima usciva 2,5 (rialzato di mezzo
punto verso la dichiarazione), oggi esce 2,0. In tutt'e due i casi la scheda si ferma comunque in
segreteria per coerenza bassa, quindi il numero non viene scritto: cambia cosa la segreteria si
trova davanti.

---

## 6. Il quiz di conoscenza (le 5 domande che possono bocciare)

### 6.1 La banca

219 domande in tutto, divise per fascia e per tipo. 🔄 **27 trabocchetto sono stati aggiunti il
30/08/2026** per bilanciare la banca (sotto il perché):

| fascia | normali | trabocchetto | di cui negano | di cui affermano | totale |
|---|---|---|---|---|---|
| Principiante | 27 | 16 | 9 | 7 | 43 |
| Base | 27 | 16 | 8 | 8 | 43 |
| Intermedio | 27 | 16 | 8 | 8 | 43 |
| Avanzato | 27 | 17 | 9 | 8 | 44 |
| Agonista | 27 | 19 | 10 | 9 | 46 |
| Semi-Pro | — | — | — | — | **nessuna** |
| Professionista | — | — | — | — | **nessuna** |

Le **domande normali** verificano regole e nomenclatura reali della fascia.

I **trabocchetto** (84 in tutto) sono la parte antifrode e sono di due specie deliberatamente
mescolate, in parti quasi uguali:
- **44 negano**: descrivono una regola o un colpo inventati con un nome plausibile («fallo di
  vetro incrociato», «doppio rimbalzo difensivo») e la risposta giusta nega, nelle tre forme
  «Non esiste», «Mai: …», «No: …»;
- **40 affermano**: descrivono regole o colpi **veri** che suonano inventati («la chiquita è un
  colpo vero?», «si può colpire il proprio vetro per mandare la palla di là?», «la rete è più
  bassa al centro?») e la risposta giusta **conferma**.

🔄 **Perché il bilanciamento, ed è una misura.** Fino al 30/08/2026 i trabocchetto erano 57, di
cui **44 si passavano negando**: chi rispondeva «non esiste» a tutti e tre i trabocchetto del giro
e sapeva le due domande normali passava il quiz nel **76%** dei casi (Base e Intermedio), **87%**
(Avanzato), **96%** (Agonista) — contro il **50%** di chi i trabocchetto non li sa e risponde a
caso. *La scorciatoia rendeva più del sapere.* Con la banca a metà, «nego sempre» paga oggi fra il
50% e il 60% e «confermo sempre» fra il 40% e il 50%: nessuna risposta automatica batte il caso.

⚠️ **La composizione del singolo giro resta casuale, ed è deliberato.** Imporre alla pescata una
composizione fissa (per esempio «2 che negano + 1 che afferma») creerebbe subito la scorciatoia
specchio, perché con soglia 4/5 e le due normali sapute bastano 2 trabocchetto su 3. Si bilancia
la banca, non il giro.

⏳ **Le 27 domande nuove non sono ancora state rilette da una persona che gioca a padel.** Le 36
di Principiante furono lette una per una col committente il 27/08. Una risposta segnata giusta e
sbagliata boccia un socio onesto: è il difetto più costoso di tutto il test, e per queste 27 non
è ancora escluso.

La seconda specie esiste perché la prima, da sola, insegnava una scorciatoia: *quando vedi
«Non esiste», è quella la risposta giusta*. Con le due mescolate, quel segnale non dice più dove
sta la verità.

### 6.2 La pescata e la soglia

- Si pescano **5 domande: 2 normali + 3 trabocchetto**, tutte della fascia **dichiarata** dal
  socio alla domanda 3. La pescata non guarda il verso dei trabocchetto: li tratta come un
  gruppo solo.
- **La pescata ha memoria**: non ripropone le domande già viste nelle **ultime 8 prove** del
  socio, finché nella banca c'è altro da dare. Esaurita la banca, ricomincia dalle più vecchie
  (degrada, non fallisce). L'insieme delle «già viste» è congelato al momento in cui il test
  inizia, così la pescata resta identica se il socio riprende un test lasciato a metà.
- **Soglia di passaggio: 4 risposte giuste su 5.** Un errore è concesso, **qualunque** — anche su
  un trabocchetto. Il secondo errore boccia.
- **Eccezione Principiante: soglia 0.** Chi dichiara la fascia più bassa fa comunque le 5 domande
  (il risultato viene registrato) ma non può essere bocciato. La ragione: il quiz serve a fermare
  chi si **sopravvaluta**, e chi dichiara il minimo della scala non sta togliendo niente a
  nessuno; inoltre sotto Principiante non c'è nessuna fascia dove mandare un bocciato.
- **Semi-Pro e Professionista non hanno quiz**: un quiz di regole non certifica una seconda
  categoria. Le loro schede vanno **direttamente alla segreteria**.
- Le stesse soglie valgono per Base, Intermedio, Avanzato e Agonista: nessuno sconto per le fasce
  basse (un margine più morbido su Base è esistito ed è stato tolto).

### 6.3 Le tre bandiere che fermano una scheda

Anche con il quiz superato, la scheda **non si applica da sola** e finisce in revisione manuale se:

1. la **coerenza è bassa** (§ 5.3);
2. `dichiarato ≥ 3,0` **e** l'esperienza dichiarata è **sotto i 12 mesi** («dichiara un livello
   medio-alto ma gioca da poco»);
3. 🔄 `dichiarato ≥ 3,0` **e** la frequenza dichiarata è **0-1 volte al mese** («dichiara un
   livello medio-alto ma gioca di rado»). Aggiunta il 30/08/2026, ed è dichiaratamente **non
   ancora provata su un caso vero**: sulle 44 schede esistenti non si accende mai, perché chi
   risponde «0-1» dichiara sempre meno di Intermedio;
4. manca il **sesso** del socio in anagrafica (serve alla composizione delle partite).

Nessuna delle quattro boccia: mandano la scheda alla segreteria, che vede il dato su cui la
bandiera si è alzata e decide.

E in ogni caso: se `| calcolato − dichiarato | > 0,5`, la scheda non si applica.

### 6.4 Cosa non esce mai verso il telefono

La risposta giusta e il marchio «questa è un trabocchetto» **non lasciano mai il server**. Alla
consegna il server **ripesca** le domande da sé (dal codice del test) e corregge su quelle,
invece di fidarsi degli identificativi mandati dal telefono. Il telefono riceve solo l'esito:
passato o non passato.

---

## 7. Cosa succede al risultato

### 7.1 Il tetto

Il test da solo scrive al massimo **3,5 (Intermedio)**. Chi dimostra di più:
- se in scheda ha meno di 3,5, gli si scrive **3,5** «intanto», e la scheda va al **maestro**,
  che certifica il resto guardandolo giocare;
- se in scheda ha già 3,5 o più, **non si scrive niente** (non si scende al tetto).

Il maestro viene chiamato **solo se la parola cambia**: chi ha 4,0 in scheda e dimostra 4,5 è
«Avanzato» in tutti e due i casi, quindi non c'è niente da certificare.

### 7.2 Il livello non scende mai da solo

Una prova che dice **meno** di quello che il socio ha in scheda non abbassa niente. A far scendere
qualcuno d'ufficio resta la segreteria. Esiste **una sola** strada automatica verso il basso, e
passa dal socio: il **gradino**.

### 7.3 Il gradino

Nato da una regola esplicita del committente: *«non dobbiamo ferire l'orgoglio del giocatore:
possiamo proporgli di scendere di un gradino, o di rimanere al livello dell'ultimo test, oppure
di rifare il test»*.

Al socio si **offre** — mai si impone — **la fascia più alta che il test non smentisce**:

| la prova | il gradino offerto | perché |
|---|---|---|
| **passata** ma dice meno di quello che ha | la fascia **dimostrata** | il test l'ha detta: è un dato |
| **bocciata** | la fascia **sotto quella dichiarata** | il quiz smentisce la dichiarata e non dice altro |

Vincoli: si scrive solo **al tocco** del socio (col silenzio non scende mai); non può **mai**
offrire una fascia **più alta** di quella che il socio ha già (una bocciatura non promuove
nessuno); l'unica eccezione è chi sta a 0,5, per cui il gradino è semplicemente il livello che il
test gli dà. Il bottone non dice mai «scendo»: dice la parola («Va bene: Base»).

### 7.4 Le tre risposte possibili del socio

Dopo l'esito, il socio vede fino a tre bottoni:
- **«Tengo <parola>»** — registra il livello dimostrato (la parola sul bottone è sempre quella
  **dimostrata**, cioè quella che verrà davvero scritta, non quella dichiarata);
- **«Lo rifaccio»** — la prova non si applica, e vale per sempre;
- **«Va bene: <parola>»** — il gradino, quando c'è.

Se il socio non tocca niente, **l'esito si applica da sé** al giro successivo dell'automatismo
(entro 15 minuti): l'attesa è a zero, i bottoni servono a scegliere, non a sbloccare.

### 7.5 Le protezioni sulla scrittura

Una scheda **non** viene applicata se: è già stata applicata; è in mano alla segreteria; è più
vecchia dell'ultimo aggiornamento del livello del socio; il socio ha già quel livello; il socio
non esiste più in anagrafica; il quiz non è passato; il socio ha scelto «rifaccio». Di ogni socio
si considera **solo la scheda più recente**.

### 7.6 Ripetibilità e promemoria

- **Nessun limite di prove**, nessuna attesa fra un test e l'altro: rifare il test è gratis.
- Ogni prova è una **pescata nuova**: domande diverse e ordine diverso.
- Chi non ha un livello riceve un **promemoria ogni 15 giorni**; chi è in attesa del maestro no
  (l'avviso in quel caso va alla segreteria, non al socio).

---

## 8. Quello che il test dichiaratamente **non** fa

Elencato apposta, perché un revisore lo conti fra i limiti noti e non fra le sviste:

- non misura la prestazione in campo: misura ciò che il socio **dichiara** più ciò che **sa**;
- non certifica nulla sopra Intermedio: quello resta un giudizio umano;
- non abbassa un livello senza il consenso del socio o della segreteria;
- non usa l'esperienza (D1) né la frequenza (D2) nel calcolo: solo come bandiere;
- non ha un cronometro: la difesa contro la ricerca delle risposte è la consegna a una domanda
  per volta, non il tempo;
- non impedisce che due soci facciano il test insieme, o che uno lo faccia per un altro.

---

## 9. Le domande a cui vorremmo che il revisore rispondesse

1. **Il peso dell'autodichiarazione.** Il 45% del punteggio viene ancora da due domande in cui il
   socio dice di sé (livello dichiarato 20%, livello alla pari 25%), e il freno superiore ancora
   comunque il risultato al dichiarato (+0,5 al massimo). È l'equilibrio giusto per lo scopo —
   comporre partite equilibrate — o il dichiarato andrebbe tolto del tutto dal punteggio e
   lasciato solo al segnale di coerenza?
2. **Le quattro scale tecniche.** Ogni risposta vale il minimo della fascia che descrive
   (1 · 2 · 3 · 4 · 5). La mappa fra le parole e i livelli è quella giusta? In particolare: chi
   risponde «in modo base / semplice» su tutte e quattro è davvero un Intermedio, o quella
   taratura è generosa di mezzo passo?
3. **La formulazione delle risposte tecniche.** Sono descrizioni di sé («Costruisco il punto con
   controllo»): quanto sono vulnerabili all'effetto di desiderabilità sociale, e ci sono
   formulazioni migliori a parità di lunghezza (devono stare su un bottone di Telegram)?
4. **Il quiz come cancello.** Cinque domande di regole, di cui tre trabocchetto, con soglia 4/5:
   è una misura sensata di «non ti stai sopravvalutando»? Un giocatore forte ma disattento alle
   regole viene punito ingiustamente? Il tasso di falsi bocciati atteso è accettabile?
5. **La composizione 2 normali + 3 trabocchetto.** Ha senso che i trabocchetto siano la
   maggioranza? Con soglia 4/5, quanto è probabile che un socio onesto e competente sbagli due
   trabocchetto? E il quiz così composto misura la conoscenza del gioco o la resistenza a una
   trappola — cioè due cose diverse?
6. **L'asimmetria Principiante.** Soglia 0 per la fascia più bassa, 4/5 per tutte le altre: la
   discontinuità fra Principiante e Base è giustificata o crea un incentivo a dichiararsi
   Principiante?
7. **Resistenza al gioco strategico.** Con prove illimitate, memoria di sole 8 prove e una banca
   di 36-39 domande per fascia da cui se ne pescano 5, quante prove servono a un socio determinato
   per passare il quiz a memoria? La mescolatura delle opzioni sulle quattro domande tecniche
   basta a togliere il vantaggio di chi ha capito lo schema?
8. **Le soglie di coerenza.** 0,5 e 1,0 di scarto fra dichiarato e media tecnica: sono tarate
   bene? Quante schede oneste finiscono in revisione manuale per niente?
9. **Le bandiere.** «Dichiara ≥ 3,0 e gioca da meno di 12 mesi» e «dichiara ≥ 3,0 e gioca 0-1
   volte al mese» fermano la scheda: sono criteri ragionevoli, o penalizzano chi arriva da un
   altro sport di racchetta e chi gioca poco ma da anni?
10. **Il risultato per chi sta a 0,5.** L'obiettivo dichiarato è far uscire dal limbo l'81% dei
    soci senza livello. Questo test, com'è costruito, ci riesce? Dove perde per strada le persone?
11. **La lingua e la chiarezza.** Le domande sono comprensibili a chi gioca da un mese? Ce ne
    sono di ambigue, o con due opzioni difendibili come giuste?
12. **La banca di domande** (allegato): ci sono risposte **sbagliate**, ambigue, o dipendenti da
    un regolamento non universale? È la verifica che ci interessa di più, perché una domanda
    sbagliata boccia un socio onesto. ⚠️ Le **27 domande aggiunte il 30/08** non sono ancora state
    rilette da nessuno: sono quelle con gli id più alti di ogni fascia (P-T10…P-T16, B-T13…B-T16,
    I-T13…I-T16, A-T13…A-T17, AG-T13…AG-T19), e fra queste le più esposte sono quelle che citano
    misure di regolamento — racchetta, rete, pareti, pressione della palla.
13. **I trabocchetto delle fasce alte** hanno preso una piega da quiz di regolamento (misure,
    procedure, nomi di colpi) più che da conoscenza del gioco. È il modo giusto di distinguere un
    Agonista da un Avanzato, o quella distinzione un quiz non la può fare per niente?

---

## Appendice — dove vivono queste regole (solo per chi ha accesso al codice)

| regola | file |
|---|---|
| le 8 domande di profilo, mescolatura, motore a passi | `supabase/functions/assessment-quiz/passi.js` |
| scala dei livelli, banca delle domande, pescata, correzione, calcolo del livello | `supabase/functions/assessment-quiz/conoscenza.js` |
| tetto, gradino, «dice meno», «sopra il tetto» | `supabase/functions/*/giro-del-test.ts` (tre copie identiche) |
| decisione di scrivere o no il livello | `supabase/functions/assessment-apply-level/index.ts` |
| registrazione della scelta del socio | `supabase/functions/consumer-assessment-decision/index.ts` |

Documenti interni collegati: `docs/test-livello-regole.md` (le regole con lo stato di collaudo di
ognuna) e `docs/test-livello-varianti.md` (tutte le combinazioni di esito).
