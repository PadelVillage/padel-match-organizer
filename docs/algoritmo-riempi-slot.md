# Algoritmo Riempi slot

## Obiettivo

Riempi slot e il motore centrale di Padel Match Organizer: deve trasformare dati separati in proposte operative per riempire gli slot liberi, riducendo contatti inutili e aumentando la probabilita di creare partite equilibrate.

In questa fase l'algoritmo assiste lo staff: propone, ordina e segnala. La decisione finale resta manuale. In una fase successiva potra diventare la base di un agente AI che prepara automaticamente le migliori proposte e le porta allo staff per approvazione.

## Fonti dati

L'algoritmo incrocia progressivamente queste fonti:

- Excel Matchpoint giocatori: anagrafica, telefono, sesso, livello operativo, stato attivo.
- Excel Matchpoint prenotazioni future: occupazione campi, conflitti giocatore, carico nei prossimi giorni.
- Excel Matchpoint storico: abitudini reali per giorno, fascia oraria e ricorrenza.
- Gruppi salvati: bacini gia curati dallo staff, con compatibilita, giorno e orario indicativo.
- Autovalutazione: livello validato dal giocatore; il nuovo modulo email non raccoglie disponibilita.
- Programmazione Partite: partite aperte, conferme, riposo settimanale, contatti gia avviati.
- Richieste giocatore: input manuali dello staff quando un socio chiede di aprire una partita in un giorno/orario o come promemoria operativo.

## Richieste giocatore

Una richiesta giocatore puo' nascere anche prima di avere tutti i dati operativi. Per questo puo' essere salvata come promemoria in Apri Partite anche senza data/orario oppure con nominativi non ancora completi.

Quando la richiesta deve diventare una proposta operativa, deve portare all'algoritmo almeno:

- livello indicativo della partita, se noto;
- tipologia partita: mista, maschile o femminile;
- giocatori gia presenti.

I giocatori gia presenti vengono trattati cosi:

- se il nome viene riconosciuto in anagrafica, viene usato il socio esistente e conta come gia presente;
- se il nome non viene riconosciuto, resta come ospite/non in anagrafica e conta come gia presente solo nella proposta;
- per aprire la proposta, ogni ospite non in anagrafica deve avere almeno nome, cognome e telefono;
- se manca un dato, Apri proposta deve portare alla scheda standard Nuovo socio della sezione Giocatori, non a una scheda parallela;
- in quel flusso la scheda Nuovo socio mostra un pulsante contestuale per salvare il socio e tornare alla proposta;
- il pulsante contestuale deve stare nella riga azioni in basso, accanto ad Annulla, con colore riconoscibile;
- per creare un nuovo socio sono obbligatori nome, cognome, sesso, livello e telefono;
- i campi obbligatori devono essere segnalati visivamente con stellina rossa e microlegenda nella barra azioni;
- il pulsante "Salva socio e torna alla proposta" deve tornare alla proposta solo se il nuovo socio e' stato effettivamente creato; in caso di dato mancante o doppione deve restare sulla scheda e mostrare l'errore;
- se nella stessa richiesta ci sono piu ospiti non riconosciuti, l'app deve gestirli come coda di completamento: dopo il salvataggio del primo apre il successivo, e solo quando tutti sono in anagrafica torna alla proposta;
- la logica di riconoscimento nominativi deve essere comune a Richiesta giocatore e Gruppi staff;
- se un nome scritto a mano non viene riconosciuto ma somiglia a un socio, l'app deve mostrare suggerimenti "forse intendevi" prima di creare una nuova anagrafica;
- ogni suggerimento deve mostrare il numero di telefono, oltre a nome, livello e sesso, per permettere allo staff un controllo sicuro sugli omonimi o sugli errori di battitura;
- ogni nominativo ambiguo deve offrire anche un'uscita operativa `Nuovo socio`: se nessun suggerimento e' quello corretto, lo staff apre la scheda standard Nuovo socio per quel singolo nome;
- in Richiesta giocatore il pulsante `Nuovo socio` deve preservare la richiesta salvata, completare eventuali altri ospiti in coda e poi tornare alla proposta;
- quando un ospite viene salvato come nuovo socio, la richiesta deve sostituire il testo grezzo inserito a mano con il nome e cognome reali del socio appena creato, cosi' la proposta non resta bloccata sullo stesso ambiguo;
- nei Gruppi staff il pulsante `Nuovo socio` serve a inserire il nominativo in anagrafica prima di salvare il gruppo, evitando gruppi con nomi ambigui o conferme forzate;
- nome+cognome esatti e cognome+nome esatti possono essere riconosciuti automaticamente;
- nomi singoli, parziali o con refusi non devono essere riconosciuti automaticamente: devono essere confermati dal suggerimento con telefono;
- nella scheda Nuovo gruppo la stessa logica deve bloccare il salvataggio del gruppo finche' i nominativi ambigui non vengono confermati;
- il livello `0,5` e' ammesso in anagrafica solo come stato "da valutare": non rappresenta un livello tecnico di gioco e resta escluso dalle proposte Apri Partite finche' non viene aggiornato;
- il tipo partita preferita non deve essere precompilato dalla richiesta: resta su Seleziona salvo scelta manuale dello staff;
- un ospite incompleto puo' restare in Richieste salvate, ma blocca l'apertura proposta finche' non viene inserito in anagrafica o eliminato dalla richiesta.

Il bottone `Apri proposta` in Richieste salvate deve comparire solo quando la richiesta e' davvero pronta: data e orario futuri, livello indicativo, nominativi confermati senza ambiguita' e soci presenti con anagrafica operativa completa. Quando viene cliccato deve aprire esattamente la proposta legata a quella richiesta, non una proposta staff/algoritmo diversa dello stesso slot.

L'apertura da `Richieste salvate` deve essere deterministica: mentre si apre la proposta non deve partire un ricalcolo standard del calendario che possa sostituire la richiesta selezionata con un gruppo staff o con una proposta algoritmo dello stesso orario.

Il livello indicativo e la tipologia partita filtrano i candidati proposti dall'algoritmo: una richiesta maschile cerca uomini, una femminile cerca donne, una mista usa il bacino misto; il livello indicativo della partita comanda la ricerca verso candidati vicini alla fascia richiesta.

Eccezione richiesta giocatore: i giocatori gia' presenti nella richiesta sono considerati fissi e possono essere mantenuti anche se il loro livello personale e' fuori dalla fascia tecnica scelta per la partita. La deroga vale solo per i presenti della richiesta, perche' sono loro il motivo operativo dell'apertura partita. I candidati aggiunti dall'algoritmo, invece, devono rispettare il livello indicativo e la tipologia partita indicati nella richiesta.

Quando una proposta da richiesta deve passare a Chiudi Partite, l'app conta solo:

- giocatori gia presenti nella richiesta, trattati come fissi;
- candidati accettati manualmente dallo staff.

Il bottone `Crea in Chiudi Partite` resta grigio e non cliccabile finche il totale non arriva almeno a 4. Se i presenti sono 2, servono almeno altri 2 accettati. Se il totale e' 3, la proposta non puo' essere inviata a Chiudi Partite. Se lo staff accetta 6, 7 o 8 giocatori, tutti gli accettati entrano nella rosa operativa da gestire in Chiudi Partite. L'algoritmo non deve completare automaticamente con candidati non accettati.

## Fonte slot potenziali

Da v5.233 gli slot teorici non devono essere inventati da fasce standard hardcoded. La fonte comune e' `potentialSlotSchedule`, configurata nella sezione DATI (in/out) e documentata in `docs/slot-potenziali.md`.

Il calendario Apri Partite e la Dashboard devono calcolare gli slot liberi con la stessa regola:

`slot potenziali configurati - prenotazioni/occupazioni Matchpoint importate = slot liberi reali`

Le logiche di ranking candidati, gruppi staff, richieste giocatore e creazione in Chiudi Partite restano separate da questa configurazione: usano gli slot liberi risultanti, ma non devono duplicare la griglia.

## Priorita slot

La priorita dello slot serve all'algoritmo, non deve necessariamente essere visibile in ogni card. Risponde alla domanda: quale buco conviene provare a riempire prima?

Ordine attuale:

1. Sera feriale, dal lunedi al venerdi.
2. Weekend utile: sabato mattina, sabato pomeriggio, domenica mattina.
3. Pranzo feriale.
4. Pomeriggio feriale.
5. Mattina feriale.
6. Bassa priorita: domenica pomeriggio e altri casi non centrali.

Questa priorita entra nello score degli slot e nell'assegnazione dei candidati.

## Vista calendario

Il calendario non deve mostrare i conteggi tecnici dei candidati. Deve essere una mappa operativa degli slot liberi.

La vista Apri Partite deve rimanere sempre scrollabile: la pagina principale non deve restare bloccata da overlay, calendario o layer di caricamento. Il calendario puo' avere uno scroll interno, ma lo scroll verticale della pagina deve restare disponibile come fallback operativo.

Per ragioni di performance, il calendario deve aprirsi con un'analisi leggera:

- occupazione campo;
- campi liberi per data/orario/fascia;
- richieste giocatore compatibili;
- gruppi staff compatibili;
- conteggio rapido dei giocatori operativi disponibili.

La classifica completa dei candidati, lo storico dettagliato, le finestre livello e la proposta vera e propria vanno calcolate solo quando lo staff clicca uno slot. La cache locale puo' conservare solo l'analisi leggera del calendario, non copie pesanti delle rose complete, per evitare rallentamenti e saturazione del browser.

Dalla v5.224 Apri Partite non mostra piu' loading visivi durante l'apertura ordinaria della sezione o della scheda proposta: il calendario deve comparire direttamente. Per velocizzare il click sullo slot, l'app puo' preparare in memoria, dopo il render del calendario, il contesto candidati riusabile nella sessione corrente. Questo contesto non va salvato come cache permanente pesante: serve solo a evitare di ricostruire piu volte gli stessi dati durante il lavoro dello staff.

Il box calendario rappresenta:

- giorno;
- fascia;
- orario;
- campi liberi aggregati.

Esempio:

- 12:30;
- C1, C2, C4;
- 3 campi liberi;
- G 3;
- A 2.

Dove:

- G = gruppi staff compatibili con giorno/orario/fascia;
- A = proposte algoritmo disponibili per lo stesso orario.

Il calendario non assegna ancora una proposta a un campo. Mostra solo quante opportunita ci sono. L'abbinamento campo-proposta si fa nella scheda operativa.

## Slot orario multi-campo

Riempi slot deve ragionare per slot orario, non solo per campo singolo.

Uno slot orario contiene:

- data;
- fascia;
- orario;
- campi liberi;
- gruppi staff compatibili;
- proposte algoritmo;
- eventuali proposte gia lavorate, scartate o create in Partite Aperte.

Per decidere se un campo e libero, l'algoritmo deve usare le occupazioni campo importate da Matchpoint, non solo le prenotazioni con giocatore. Rientrano quindi tra gli slot occupati anche:

- manutenzione;
- blocchi campo;
- lezioni;
- partite;
- righe con data, ora e campo anche se non hanno un giocatore associato.

Se nello stesso orario sono liberi piu campi, l'algoritmo puo proporre piu partite nello stesso blocco orario. Per esempio:

- C1: gruppo staff pranzo lunedi;
- C2: proposta algoritmo;
- C4: ancora libero.

Questa assegnazione non viene mostrata nel calendario come default: viene gestita nella scheda proposta.

## Gruppi staff e proposte algoritmo

Le proposte possono avere origini diverse:

- Gruppo staff: gruppo creato manualmente dallo staff, gia curato per compatibilita, giorno e orario.
- Proposta algoritmo: gruppo potenziale generato da storico, prenotazioni future, eventuali preferenze operative gia presenti e regole anti-spam.

Un gruppo staff compatibile ha priorita operativa alta, perche nasce da una scelta umana gia validata. Se in uno slot orario esiste un solo campo libero e un gruppo staff compatibile, la scheda puo aprire direttamente quel gruppo.

Se invece ci sono piu campi liberi o piu proposte disponibili, la scheda deve mostrare su quale campo si sta lavorando:

- C1 selezionato, gruppo staff;
- C2 libero, proposta algoritmo;
- C4 libero, da assegnare.

## Classifica candidati

L'algoritmo distingue due livelli:

- Candidato grezzo: un giocatore teoricamente compatibile con uno slot.
- Candidato prioritario: un giocatore che ha senso proporre/contattare per quello slot dopo le regole anti-spam.

Nella scheda proposta non si devono mostrare score, probabilita alta/bassa o motivazioni algoritmiche troppo tecniche. La probabilita deve emergere dall'ordine della lista.

La scheda mostra una classifica 1-12:

- 1 = candidato piu forte per quello slot/proposta;
- 12 = candidato piu debole tra quelli ancora operativi.

Ogni riga puo mostrare solo dati oggettivi utili:

- nome;
- livello;
- sesso;
- origine, per esempio staff o algoritmo;
- storico sintetico, per esempio "ha giocato 4 pranzi";
- carico futuro, per esempio "0 partite future" o "1 partita futura";
- eventuale "gia proposto 1 volta".

La scheda non deve mostrare "WhatsApp ok": il contatto valido e un requisito di ingresso.

## Requisiti minimi candidato

Per entrare nella classifica operativa, un giocatore deve avere dati minimi completi:

- nome identificabile;
- contatto valido per invio messaggi;
- livello disponibile e gia valutato;
- sesso disponibile quando serve per comporre la proposta;
- nessun blocco operativo evidente.

Il livello `0,5` non e un livello tecnico di gioco: indica un socio ancora da valutare. Questi giocatori devono essere esclusi a priori dal bacino dell'algoritmo e dalle proposte staff/algoritmo finche non ricevono un livello reale dalla scheda giocatore o dal flusso di autovalutazione.

Chi non rispetta questi requisiti non entra nella classifica 1-12. Puo essere gestito in un controllo tecnico separato, ma non nella scheda operativa.

## Regola anti-spam

Per evitare di contattare sempre le stesse persone:

- un giocatore puo essere assegnato al massimo a 2 slot nella finestra di analisi;
- i 2 slot devono essere in giorni diversi;
- non viene contato due volte nello stesso giorno;
- se un giocatore e compatibile con molti slot, viene assegnato prima agli slot con miglior punteggio personale e priorita operativa.

Questa regola riduce il rumore e rende il numero in calendario piu vicino al bacino realmente contattabile.

## Score giocatore su slot

Per ogni coppia giocatore-slot l'algoritmo considera:

- storico nella stessa fascia;
- storico nello stesso giorno;
- storico nello stesso giorno e fascia;
- attivita recente nello storico;
- numero totale di presenze storiche;
- partite future nei prossimi 10 giorni;
- conflitti diretti su quello slot;
- eventuali disponibilita o preferenze operative gia presenti fuori dal nuovo modulo email di autovalutazione.

Quando esistono disponibilita o preferenze operative gia valide, aggiungono o tolgono peso:

- bonus se la fascia dichiarata combacia con lo slot;
- bonus se il tipo giorno dichiarato combacia, per esempio settimana o weekend;
- bonus leggero se il tipo partita dichiarato e coerente con il filtro sesso/tipo;
- penalita leggera se fascia o giorni dichiarati sono diversi.

Lo storico resta importante perche misura comportamento reale; l'autovalutazione aggiorna soprattutto il livello tecnico. Dal flusso email 2026-05-11 non deve arrivare una nuova disponibilita, perche la scheda pubblica non la richiede piu'.

## Score proposta partita

Una proposta partita nasce da uno slot orario libero e puo avere due origini:

- gruppo salvato compatibile;
- gruppo potenziale da storico/candidati.

La proposta riceve uno score che combina:

- priorita dello slot;
- coerenza giorno/orario del gruppo salvato;
- ampiezza del bacino disponibile;
- qualita dei candidati prioritari;
- presenza di candidati ad alta probabilita;
- segnali storico giorno/fascia;
- attenzioni operative.

Le attenzioni includono:

- telefono mancante;
- 2 o piu partite future nei prossimi 10 giorni;
- nominativi del gruppo non trovati;
- esclusioni per riposo settimanale;
- possibile squilibrio di livello o composizione.

Questi score servono all'algoritmo per ordinare e generare la classifica. Non devono essere necessariamente mostrati nella scheda operativa.

## Scarti e rigenerazione

Scartare un candidato non lo elimina. Lo sposta in "Scartati recuperabili".

La rigenerazione della proposta deve:

- mantenere lo stesso slot orario;
- mantenere il campo selezionato, salvo scelta diversa dello staff;
- tenere conto degli accettati;
- penalizzare o escludere gli scartati nella nuova proposta;
- conservare gli scartati come memoria operativa;
- rispettare sempre le regole anti-spam.

## Coerenza livello proposta algoritmo

Le proposte generate dall'algoritmo devono essere coerenti per livello. Lo storico e le eventuali preferenze operative non possono far entrare un giocatore tecnicamente fuori partita.

Regola attuale:

- la proposta algoritmo viene costruita dentro una finestra massima di `0,5` punti livello;
- la finestra deve avere una direzione chiara: pari livello, pari/-0,5 oppure pari/+0,5;
- se la base e livello 3, sono ammesse separatamente le finestre 3, 2,5-3 oppure 3-3,5;
- non e ammessa una proposta che contenga insieme 2,5, 3 e 3,5, perche tra minimo e massimo c'e un punto intero;
- una proposta 2-2,5 non puo contenere livelli 4, 5 o simili;
- se non esistono almeno 4 giocatori validi nella stessa finestra livello, l'algoritmo non deve forzare una proposta sbilanciata;
- il bottone "Rigenera proposta" prova una finestra o rotazione diversa, quando ci sono alternative disponibili.

Questa regola riguarda le proposte algoritmo. I gruppi staff restano una fonte umana gia curata, ma vengono comunque filtrati per requisiti minimi operativi, inclusa l'esclusione dei livello 0,5.

### Coerenza uomo/donna nei match misti

Nei match misti il numero livello non va letto in modo puramente grezzo, perche uomo e donna possono avere un impatto di gioco diverso a parita di livello dichiarato.

Regola iniziale di calibrazione:

- nelle proposte algoritmo con filtro `Misto`, il quartetto iniziale deve essere 2 uomini + 2 donne;
- gli uomini vengono raggruppati su una base livello unica, senza mischiare mezzo punto sotto;
- le donne devono essere pari alla base uomo oppure mezzo punto sopra;
- l'algoritmo preferisce le donne mezzo punto sopra la base uomo, quando disponibili;
- se la proposta include una donna 3,5, gli uomini devono essere 3 e non 2,5;
- una donna 1,5 non deve quindi essere proposta in una partita con un uomo 2,5;
- una rosa con M4.5/F4 non deve mescolarsi automaticamente con M3/F3;
- se non esistono almeno 2 uomini e 2 donne coerenti con questa regola, l'algoritmo non deve forzare una proposta mista sbilanciata.

Questa e una regola prudente e modificabile: se lo staff decide in futuro una diversa soglia uomo/donna, il valore potra essere cambiato senza riscrivere l'intero algoritmo.

## Azioni operative nella scheda proposta

Ogni candidato nella scheda proposta puo avere tre stati:

- neutro: mostra `Accetta` e `Scarta`;
- accettato: il bottone diventa `Accettata`, la riga diventa verde e un nuovo click riporta il candidato allo stato neutro;
- scartato: il candidato scende in `Scartati recuperabili`.

Da `Scartati recuperabili`, il bottone `Prendi` riporta il candidato nella classifica operativa in stato neutro.

## Salvataggi operativi

I salvataggi manuali non devono rallentare il lavoro dello staff quando non ci sono modifiche reali.

Regola applicativa:

- se si apre una scheda e si preme Salva senza cambiare nulla, l'app deve mostrare "nessuna modifica" e non riscrivere i dati;
- il salvataggio locale deve confrontare il contenuto serializzato prima di scrivere in localStorage;
- i campi tecnici come `updatedAt` devono aggiornarsi solo quando cambia davvero un dato operativo;
- questa logica vale in particolare per Richiesta giocatore, scheda giocatore, gruppi staff, impostazioni e registro operativo partita.

La creazione in Chiudi Partite richiede almeno 4 candidati accettati. La classifica puo contenere piu candidati, ma solo gli accettati vengono passati alla partita operativa.

Se lo staff clicca "Crea in Chiudi Partite", la partita operativa riceve:

- campo selezionato;
- proposta scelta, staff o algoritmo;
- giocatori accettati;
- scartati recuperabili;
- origine della proposta.

Dopo la creazione:

- lo staff deve restare in Apri Partite, senza cambio automatico verso Chiudi Partite;
- il campo/data/orario appena creato viene salvato in `fillSlotCreatedMatches`;
- quel campo viene tolto dagli slot liberi per evitare di creare due volte la stessa partita;
- se nello stesso orario restano altri campi liberi, il box del calendario resta visibile ma mostra solo i campi ancora disponibili;
- Chiudi Partite resta il luogo dove gestire inviti, risposte e conferme dopo la validazione.

## Flusso operativo

La sezione operativa viene presentata come **Apri Partite**. Il nome chiarisce che qui si apre una possibile partita partendo dagli slot liberi, ma non si gestiscono ancora inviti e conferme: quelli vengono lavorati in Chiudi Partite.

Il flusso UI deve restare in massimo tre passaggi principali:

1. **Slot liberi**: calendario aggregato per giorno, fascia e orario. Ogni box mostra orario, campi liberi e segnali S/A.
2. **Proposta partita**: dopo il click sul box si apre la scheda dello slot, con scelta del campo e origine della proposta, gruppo staff o algoritmo.
3. **Crea in Chiudi Partite**: lo staff accetta/scarta i candidati, puo rigenerare la proposta, oppure crea la partita nella sezione Chiudi Partite.

Questo evita sottosezioni ridondanti come "gruppi staff compatibili", "candidati algoritmo" e "proposte da validare": queste informazioni restano dentro la stessa scheda, ordinate dall'algoritmo.

Nel menu principale Apri Partite deve essere una voce autonoma. Chiudi Partite resta separata e serve per inviti, risposte, conferme, storico e messaggio finale.

La UI deve restare compatta: niente testata descrittiva, box stepper, testata "Slot liberi" o barra filtri sopra il calendario. Il primo elemento operativo deve essere il calendario slot liberi, preceduto solo dalla legenda S/A.

I filtri della vista calendario non sono visibili nella fase operativa manuale. L'algoritmo usa internamente impostazioni neutre:

- Fascia: Tutte, poi Mattino, Pranzo, Pomeriggio, Sera.
- Livello: Tutti, poi 1, 1.5, 2, 2.5, 3, 3.5, 4+.
- Sesso: Misto come default.
- Min candidati: Tutti, poi 8+, 12+, 16+.

La pagina deve aprirsi subito. Se l'analisi richiede tempo:

- mostra subito una anteprima statica del calendario, cosi la pagina non sembra vuota;
- sovrapponi un caricamento percentuale con numeri in progressione costante;
- non fermare visivamente il caricamento a una percentuale intermedia;
- al 95% sostituisci l'anteprima con il calendario definitivo;
- chiudi il caricamento al 100%.

Per la giornata odierna, Apri Partite mostra solo gli slot non ancora iniziati. Se l'orario di inizio dello slot e gia passato, quello slot viene escluso dalla vista operativa anche se il campo risulta libero.

Il calendario deve essere responsive: la pagina non deve allargarsi oltre il viewport. Se le 10 colonne non entrano nello spazio disponibile, lo scroll orizzontale deve rimanere dentro il contenitore calendario.

## Richieste giocatori

Apri Partite puo ricevere anche richieste arrivate allo staff via messaggio. Il pulsante **+ Richiesta giocatore** registra:

- data;
- orario;
- campo desiderato o primo campo libero;
- giocatori gia presenti, uno per riga;
- eventuali note operative.

La richiesta viene mostrata nel calendario con indicatore **R**. Quando si apre lo slot:

- i giocatori gia presenti e riconosciuti nel database vengono trattati come fissi;
- se sono 1, l'algoritmo completa con 3 candidati;
- se sono 2, completa con 2 candidati;
- se sono 3, completa con 1 candidato;
- se sono gia 4, la proposta puo essere creata direttamente in Chiudi Partite;
- i candidati da completare rispettano le regole di livello, sesso, telefono, storico, futuro e anti-spam gia definite.

1. Matchpoint aggiorna i dati sorgente tramite import Excel.
2. Riempi slot ricalcola gli slot orari liberi e i campi disponibili.
3. L'algoritmo trova gruppi staff compatibili e proposte algoritmo.
4. Il calendario mostra per ogni orario campi liberi, numero gruppi staff e numero proposte algoritmo.
5. Lo staff apre uno slot orario e sceglie campo/proposta da lavorare.
6. La scheda mostra la classifica candidati 1-12.
7. Lo staff accetta, scarta, riprende o rigenera.
8. La proposta approvata entra in Chiudi Partite.
9. Chiudi Partite gestisce inviti, risposte, conferme, riserve e chiusura.

Apri Partite pensa e propone. Chiudi Partite esegue e traccia.

Quando una proposta viene approvata da Apri Partite:

- la partita entra in Chiudi Partite senza spostare automaticamente lo staff fuori da Apri Partite;
- il campo/data/orario approvato viene marcato come consumato e non viene riproposto nel calendario;
- il calendario Apri Partite considera occupati anche i campi gia presenti in Chiudi Partite, cosi una partita gia aperta non ricompare come slot libero;
- il record resta operativo in Partite Aperte anche se lo slot e gia passato rispetto all'orario corrente;
- passa nello storico solo quando viene chiuso o annullato.

Gli avvisi operativi dell'app devono comparire come overlay centrato, cosi le conferme e gli errori restano visibili anche quando l'azione avviene in fondo pagina o dentro pannelli scrollabili.

Le azioni operative non devono lasciare l'utente senza feedback:

- quando lo staff clicca Crea in Chiudi Partite, l'app mostra subito un avviso centrale di lavorazione;
- durante la creazione viene bloccato il doppio click sullo stesso comando;
- dopo il salvataggio non si ricalcola tutto il calendario se non serve;
- la vista corrente rimuove solo il campo appena consumato e lascia gli altri campi dello stesso orario disponibili.

## Stato implementazione

Implementato:

- analisi empty slot su 10 giorni;
- priorita operativa slot;
- candidati per slot da giocatori, prenotazioni future e storico;
- regola anti-spam massimo 2 slot in giorni diversi;
- uso solo di eventuali disponibilita/preferenze operative gia presenti, senza richiederle nel nuovo modulo email di autovalutazione;
- distinzione interna tra candidati grezzi e prioritari;
- base per proposte da gruppi salvati e da storico/candidati.
- mockup approvato del calendario aggregato per slot orario multi-campo;
- mockup approvato della scheda proposta con selezione campo e classifica candidati 1-12.

Da raffinare:

- pesi numerici dopo test con dati reali;
- incompatibilita note tra giocatori;
- gestione contatti gia effettuati su WhatsApp;
- storico risposte, affidabilita e probabilita di accettazione;
- bilanciamento livello/sesso piu esplicito;
- suggerimenti automatici di sostituzione;
- implementazione nel file applicativo del nuovo modello slot orario multi-campo;
- futura automazione tramite agente AI con approvazione staff.

## Changelog algoritmo

- v5.152: prima sezione autonoma Riempi slot con calendario e candidati.
- v5.154: introdotta base proposte partita da gruppi salvati e storico.
- v5.155: vista calendario operativa, dettagli e proposte nascosti dalla UI principale.
- v5.178: la sezione viene rinominata operativamente in Proposte Partite e il flusso viene fissato in tre passaggi: Slot liberi, Proposta partita, Crea partita aperta.
- v5.179: Proposte Partite diventa voce principale autonoma nel menu; l'apertura di uno slot riusa l'analisi gia calcolata per ridurre la lentezza.
- v5.180: rimossi testata descrittiva e box stepper superflui; la sezione apre direttamente sul calendario operativo.
- v5.181: corretti default e ordine dei filtri; introdotto caricamento con percentuale e ottimizzato il matching nomi su prenotazioni/storico tramite lookup.
- v5.182: rimossa testata "Slot liberi" e corretto il rendering del caricamento percentuale prima del calcolo calendario.
- v5.183: raffinato caricamento percentuale: progressione da 0 con passi graduali, senza salto immediato alla fase finale.
- v5.184: il calendario viene mostrato prima del 100%; il loading finale continua sopra la vista gia visibile e poi sparisce.
- v5.185: rallentata la progressione prima del calcolo pesante per evitare blocchi visivi troppo anticipati.
- v5.186: Proposte Partite usa `prenotazioniOccupazione` per riconoscere manutenzioni e blocchi campo come occupazioni reali.
- v5.187: rimosse le vecchie viste operative Matching, Analizza Slot e Crea partita; eventuali richiami residui vengono ricondotti a Proposte Partite per evitare rotture e doppioni di flusso.
- v5.188: ottimizzato il click sui box calendario: apertura immediata della scheda proposta e ricalcolo limitato allo slot selezionato, senza ridisegnare calendario e KPI.
- v5.189: la scheda proposta diventa overlay operativa sopra calendario e filtri; la chiusura non ridisegna il calendario.
- v5.190: livello 0,5 trattato come "non valutato" ed escluso a priori dalle proposte; anche il conteggio staff S richiede una proposta con almeno 4 giocatori validi; aggiunto loading immediato su Rigenera proposta.
- v5.191: introdotta coerenza livello per le proposte algoritmo: finestra massima 0,5 punti e rigenerazione con rotazione/finestra diversa quando esistono alternative.
- v5.197: Crea in Partite Aperte resta nella sezione proposte e consuma solo il campo creato, evitando doppioni nello stesso slot/campo.
- v5.198: le partite create restano operative fino a chiusura/annullamento anche se lo slot e gia passato; il calendario esclude i campi gia presenti nella gestione operativa; alert globali centrati in overlay.
- v5.199: feedback immediato su Crea in Partite Aperte, protezione dal doppio click e aggiornamento leggero della vista senza ricalcolo completo del calendario.
- v5.200: rinomina operativa Apri Partite / Chiudi Partite; il bottone di creazione diventa Crea in Chiudi Partite.
- v5.201: rimossa la barra filtri visibile da Apri Partite; il calendario e la legenda S/A diventano la vista operativa principale.
- v5.202: esclusi gli slot odierni con orario gia passato e resa responsive la griglia calendario con scroll interno.
- v5.203: aggiunta Richiesta giocatore in Apri Partite: indicatore R nel calendario e proposta con giocatori gia presenti bloccati.
- v5.204: ripristinato il conteggio Richieste salvate nella barra alta e aggiunta lista consultabile delle richieste aperte; quando si esce da Apri Partite vengono annullati i calcoli pendenti del calendario per mantenere reattiva la navigazione.
- v5.205: una partita annullata in Chiudi Partite libera lo slot/campo in Apri Partite se non e gia passato; le partite con data/orario passati non possono essere riaperte; dopo la creazione viene mostrato un bottone operativo per andare alla gestione della partita; rimossi i tooltip nativi dai bottoni.
- v5.206: Richiesta giocatore usa come default il primo slot futuro utile, non un orario gia passato; l'elenco Richieste salvate permette di riaprire una richiesta non ancora trasformata in partita e la rimuove dalla coda quando viene convertita.
- v5.207: le richieste salvate con data/orario passati vengono marcate come scadute e non alimentano piu la coda Richieste salvate ne il segnale R sul calendario.
- v5.208: data e orario della Richiesta giocatore sono opzionali; una richiesta senza slot resta come appunto operativo riapribile/eliminabile e non produce proposta finche non viene completata con data/orario futuri.
- v5.209: calendario interno di Apri Partite reso responsive: la griglia si adatta alla larghezza disponibile e non usa piu min-width fisso con sbordo orizzontale.
- v5.272: Chiudi Partite diventa una tabella operativa: ogni riga e' una partita gia' creata da Apri Partite, ordinabile e filtrabile per giorno, slot, tipologia, livello e priorita temporale. I dettagli giocatori/inviti/risposte restano nella scheda partita in overlay. Le partite chiuse, annullate o passate non occupano la vista principale.
- v5.156: introdotta regola anti-spam candidati, massimo 2 slot per giocatore in giorni diversi.
- v5.157: aggiunto primo uso delle disponibilita dichiarate da autovalutazione nello score giocatore-slot e creata questa specifica.
- post v5.157: definito il modello operativo slot orario multi-campo, calendario senza numeri candidati, indicatori G/A, selezione campo nella scheda e classifica candidati 1-12.
- v5.158: prima implementazione nel file applicativo del calendario multi-campo, indicatori G/A, selezione campo e scheda con classifica candidati 1-12.
- v5.159: interfaccia operativa piu pulita, senza testata ridondante; la scheda proposta si apre sopra il calendario solo dopo il click su uno slot e si richiude con Chiudi.
- v5.160: la scheda proposta di Riempi slot non e piu un blocco sopra il calendario, ma un pannello operativo sovrapposto che copre il calendario e si chiude con Chiudi.
- v5.161: il tondino verde G nel calendario segnala i gruppi staff compatibili per giorno/orario anche prima della validazione operativa dei 4 giocatori.
- v5.162: calendario Riempi slot piu compatto, rimossa la scritta ridondante "campo/i liberi" dai box; restano orario, campi C1-C4 e indicatori G/A.
- v5.163: rinominato l'indicatore calendario dei gruppi staff da G a S, per distinguere meglio staff da algoritmo A.

## Regola progetto locale

Per ogni nuova versione o nuova cartella di lavoro, seguire il prompt operativo in `docs/prompt-operativo-salvataggio-locale.md`. La cartella unica di riferimento e `/Users/maurizioaprea/Downloads/Padel Match Organizer`; dopo ogni cambio percorso va verificato il localStorage e, se necessario, ripristinato il backup piu recente.


- v5.177: primo restyling applicativo del calendario Riempi Slot su base v5.176: card slot piu leggibili, colonne calendario piu larghe, header/date sticky piu chiari, legenda S/A riallineata e conteggio campi liberi visibile nella card. Nessuna modifica ai blocchi protetti principali.
