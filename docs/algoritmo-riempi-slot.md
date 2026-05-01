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
- Autovalutazioni: livello validato e disponibilita dichiarata dal giocatore.
- Programmazione Partite: partite aperte, conferme, riposo settimanale, contatti gia avviati.

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

## Candidati grezzi e candidati prioritari

L'algoritmo distingue due livelli:

- Candidato grezzo: un giocatore teoricamente compatibile con uno slot.
- Candidato prioritario: un giocatore che ha senso proporre/contattare per quello slot dopo le regole anti-spam.

Nel calendario il numero grande deve rappresentare i candidati prioritari, non tutti i candidati teorici.

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
- disponibilita dichiarata in autovalutazione.

Le disponibilita dichiarate aggiungono o tolgono peso:

- bonus se la fascia dichiarata combacia con lo slot;
- bonus se il tipo giorno dichiarato combacia, per esempio settimana o weekend;
- bonus leggero se il tipo partita dichiarato e coerente con il filtro sesso/tipo;
- penalita leggera se fascia o giorni dichiarati sono diversi.

Lo storico resta importante perche misura comportamento reale; l'autovalutazione aggiunge intenzione dichiarata.

## Score proposta partita

Una proposta partita nasce da uno slot libero e puo avere due origini:

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

## Flusso operativo

1. Matchpoint aggiorna i dati sorgente tramite import Excel.
2. Riempi slot ricalcola gli empty slot e i candidati prioritari.
3. L'algoritmo ordina slot e proposte.
4. Lo staff sceglie/approva una proposta.
5. La proposta approvata entra in Programmazione Partite.
6. Programmazione Partite gestisce inviti, risposte, conferme, riserve e chiusura.

Riempi slot pensa e propone. Programmazione Partite esegue e traccia.

## Stato implementazione

Implementato:

- analisi empty slot su 10 giorni;
- priorita operativa slot;
- candidati per slot da giocatori, prenotazioni future e storico;
- regola anti-spam massimo 2 slot in giorni diversi;
- uso iniziale delle disponibilita dichiarate da autovalutazione nello score;
- distinzione interna tra candidati grezzi e prioritari;
- base per proposte da gruppi salvati e da storico/candidati.

Da raffinare:

- pesi numerici dopo test con dati reali;
- incompatibilita note tra giocatori;
- gestione contatti gia effettuati su WhatsApp;
- storico risposte, affidabilita e probabilita di accettazione;
- bilanciamento livello/sesso piu esplicito;
- suggerimenti automatici di sostituzione;
- futura automazione tramite agente AI con approvazione staff.

## Changelog algoritmo

- v5.152: prima sezione autonoma Riempi slot con calendario e candidati.
- v5.154: introdotta base proposte partita da gruppi salvati e storico.
- v5.155: vista calendario operativa, dettagli e proposte nascosti dalla UI principale.
- v5.156: introdotta regola anti-spam candidati, massimo 2 slot per giocatore in giorni diversi.
- v5.157: aggiunto primo uso delle disponibilita dichiarate da autovalutazione nello score giocatore-slot e creata questa specifica.
