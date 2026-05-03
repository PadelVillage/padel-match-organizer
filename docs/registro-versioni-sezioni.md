# Registro versioni per sezione

Ultimo aggiornamento: 2026-05-02

Questo documento serve a evitare fusioni sbagliate tra sezioni. Ogni sezione deve avere una fonte dichiarata: file HTML dell'app, mockup approvato, documentazione o nota "da confermare".

## Regola operativa

- Non integrare una sezione "a memoria".
- Prima di modificare una sezione, controllare questa tabella.
- Se una sezione e' stata validata in un'altra chat ma non e' salvata qui, va marcata **da confermare** finche' non viene indicato il file corretto.
- Le versioni finali devono essere salvate sotto: 
  
  `/Users/maurizioaprea/Downloads/Padel Match Organizer`

## Mappa sezioni

| Sezione | Fonte locale attuale | Stato | Note operative |
|---|---|---|---|
| Menu laterale / navigazione | `padel_match_organizer_v5_226.html` | **In lavorazione su v5.226, da validare manualmente** | Rimpaginazione grafica semplice del menu sinistro: capitoli numerati 0 Dashboard, 1 Apri Partite, 2 Chiudi Partite, 3 Autovalutazioni, 4 Giocatori, 5 Matchpoint. Sottomenu a fisarmonica e WhatsApp ricollocato come voce di supporto sotto Chiudi Partite. v5.226 corregge l'apertura incompleta in alto di Dashboard e Apri Partite resettando lo scroll del contenuto principale; inoltre rimuove dalla Dashboard la barra superiore con titolo/badge, mantenendo l'accesso menu su mobile. Nessuna logica dati modificata. |
| Apri Partite - calendario e scheda proposta | `versioni/padel_match_organizer_v5_163.html` come base stabile; mockup `mockup/padel-fill-slot-calendar-staff-mockup.html`; mockup `mockup/padel-fill-slot-proposal-staff-mockup.html`; app `padel_match_organizer_v5_224.html` | **Pubblicata e validata in v5.224** | v5.224 e' la seconda fase performance: rimuove il loading visibile da Apri Partite, mantiene il calendario leggero, riusa in memoria il contesto candidati e lo prepara in background dopo il render. Rimane invariata la regola dei 4 confermati per creare in Chiudi Partite. Base pubblicata attuale prima della grafica menu v5.225. |
| Protezione dati locali | `docs/protezione-dati-locali.md`; `versioni/padel_match_organizer_v5_176.html` | **Candidata a collaudo** | Snapshot automatico in browser, avviso se dati operativi risultano vuoti ma esiste uno snapshot, ripristino rapido e conferma forte su cancellazione cache Matchpoint. |
| Riempi Slot - algoritmo | `docs/algoritmo-riempi-slot.md` | **Documentato** | Include priorita' slot, limite contatto massimo 2 slot in giorni diversi, ranking candidati, gruppi staff e proposte algoritmo. |
| Giocatori / gruppi staff | `versioni/padel_match_organizer_v5_176.html`; root `padel_match_organizer_v5_176.html`; repo `padel-match-organizer-github/index.html`; mockup `mockup/padel-players-section-mockup.html` | **Ricostruita da chat e pronta per collaudo finale** | Ricostruita dalla grafica approvata in chat: database con scheda inline, gruppi in minitabella, niente qualita dati/disponibilita da storico. v5.168 rimuove Livello 0.5 dal filtro Attenzione dati; v5.169 apre la scheda socio come overlay; v5.170 estende overlay a nuovo socio, dettaglio gruppo, modifica gruppo e nuovo gruppo. v5.171 corregge lo scroll di apertura schede e rimuove Dettagli dai gruppi, lasciando Modifica come azione unica. v5.172 centra meglio l’apertura dell’editor gruppo quando si clicca Modifica. v5.173 rende l’editor gruppo una finestra fissa centrata, con intestazione sempre visibile. v5.174 applica la stessa finestra fissa anche a scheda socio, nuovo socio e overlay gruppi. v5.175 aggiunge Cancella gruppo nella scheda Modifica gruppo. v5.176 introduce protezione dati locali: snapshot automatico, avviso anti-svuotamento e conferma forte sulla cancellazione cache Matchpoint. Riempi Slot preservato dalla 5.163. |
| Database giocatori | `versioni/padel_match_organizer_v5_176.html` | **Ricostruito da chat e pronto per collaudo finale** | Lista max 10, filtri espliciti, attenzione dati senza doppione Livello 0.5 e scheda socio, nuovo socio e gruppi in overlay sopra elenco; cancella gruppo disponibile dalla modifica gruppo. |
| Autovalutazioni / dashboard | `mockup/padel-dashboard-mockup.html`; viewer `mockup/padel-players-assessment-viewer.html` | **Da confermare** | La 164 non va considerata definitiva. Serve recuperare la versione validata della chat dedicata. |
| Programmazione Partite / Partite aperte | Da confermare | **Da confermare** | Riempi Slot dovra' creare proposte verso Partite Aperte, non direttamente verso invio richiesta. |
| WhatsApp / messaggi | Da confermare | **Da confermare** | Nessun invio automatico senza conferma manuale. |
| Matchpoint import | App storica nelle versioni 151-165 | **Da confermare** | Import Excel deve aggiornare automaticamente giocatori, prenotazioni, storico, Riempi Slot e disponibilita'. |

## Versioni da non usare come base globale

- `padel_match_organizer_v5_164.html`: non valida come base globale. Ha rotto/alterato sezioni e non deve essere usata per proseguire.

## Versioni candidate

- `padel_match_organizer_v5_163.html`: base stabile per Riempi Slot prima della 164.
- `padel_match_organizer_v5_165.html`: correzione di emergenza non definitiva: riparte dalla 163 e aggiunge un primo tentativo grafico su Giocatori/gruppi.
- `padel_match_organizer_v5_166.html`: versione di riallineamento conservativa, superata perche non conteneva l'ultima grafica approvata Giocatori.
- `padel_match_organizer_v5_167.html`: versione ricostruita dalla chat per Giocatori/Gruppi staff su base stabile 5.163.
- `padel_match_organizer_v5_168.html`: raffinamento Database giocatori; tolto Livello 0.5 da Attenzione dati, resta nel filtro Livello.
- `padel_match_organizer_v5_169.html`: raffinamento Database giocatori; scheda socio aperta come overlay sopra elenco giocatori.\n- `padel_match_organizer_v5_176.html`: raffinamento Giocatori/Gruppi; nuovo socio, nuovo gruppo, dettaglio e modifica gruppo aperti in overlay.
- `padel_match_organizer_v5_177.html`: restyling calendario Riempi Slot, superata da v5.178; non pubblicata.
- `padel_match_organizer_v5_178.html`: evoluzione Proposte Partite con flusso operativo in 3 passaggi, superata da v5.179; non pubblicata.
- `padel_match_organizer_v5_179.html`: correzione menu Proposte Partite come voce principale autonoma e ottimizzazione apertura slot; superata da v5.180; non pubblicata.
- `padel_match_organizer_v5_180.html`: versione compatta Proposte Partite, senza testata descrittiva e senza box stepper; superata da v5.181; non pubblicata.
- `padel_match_organizer_v5_181.html`: filtri corretti e ottimizzazione apertura Proposte Partite con contatore caricamento; superata da v5.182; non pubblicata.
- `padel_match_organizer_v5_182.html`: rimozione testata Slot liberi e correzione avanzamento loading; superata da v5.183; non pubblicata.
- `padel_match_organizer_v5_183.html`: caricamento percentuale piu progressivo e naturale; superata da v5.184; non pubblicata.
- `padel_match_organizer_v5_184.html`: calendario visibile prima del 100% e loading finale sovrapposto per circa due secondi; superata da v5.185; non pubblicata.
- `padel_match_organizer_v5_185.html`: loading pre-calcolo piu lento e progressivo; superata da v5.186; non pubblicata.
- `padel_match_organizer_v5_186.html`: manutenzioni e blocchi campo riconosciuti come occupazione campo in Proposte Partite; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_187.html`: pulizia del vecchio Matching/Analizza Slot/Crea partita; Proposte Partite resta la sezione operativa per validare proposte prima di Partite Aperte; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_188.html`: correzione performance click calendario Proposte Partite; la scheda si apre subito con stato di caricamento e calcola solo la proposta selezionata; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_189.html`: scheda proposta aperta come overlay sopra il calendario; filtri e calendario restano dietro oscurati e non vengono ridisegnati in chiusura; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_190.html`: feedback loading su Rigenera proposta e esclusione livello 0,5 dai candidati/proposte; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_191.html`: coerenza livello nelle proposte algoritmo con finestra massima 0,5 punti e rigenerazione che cambia davvero la rosa quando ci sono alternative; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_192.html`: coerenza mista nelle proposte algoritmo con livello equivalente uomo/donna, quartetto misto 2M/2F quando il filtro e Misto e nessun salto tecnico tipo M4.5/F4 con M3/F3; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_193.html`: azioni candidati in proposta come toggle Accetta/Accettata, Scarta verso Scartati recuperabili, Prendi per recuperare; Crea in Partite Aperte richiede 4 accettati. Regola misto aggiornata: donne almeno pari al livello uomo piu alto del quartetto, preferenza a +0,5; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_194.html`: caricamento Proposte Partite con anteprima statica immediata del calendario, overlay percentuale progressiva fino al 95%, sostituzione con calendario reale e completamento al 100%; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_195.html`: algoritmo misto con base uomo unica: se le donne sono 3.5, gli uomini devono essere 3 e non 2.5; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_196.html`: algoritmo omogeneo generale con finestre direzionali pari, pari/-0,5 o pari/+0,5; non permette nella stessa proposta livelli 2,5, 3 e 3,5; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_197.html`: Crea in Partite Aperte resta in Proposte Partite, salva memoria `fillSlotCreatedMatches` e rimuove dal calendario solo il campo consumato; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_198.html`: le partite aperte da Proposte Partite restano visibili nella gestione operativa anche se lo slot/orario e passato, fino a chiusura o annullamento; il calendario Proposte Partite esclude anche i campi gia trasformati in Partite Aperte; tutti gli alert dell'app sono centrati in overlay; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_199.html`: feedback immediato su Crea in Partite Aperte, blocco doppio click durante la creazione e aggiornamento leggero della vista che elimina solo il campo consumato senza ricalcolo completo; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_200.html`: rinomina visibile della sezione da Proposte Partite ad Apri Partite, rinomina Programmazione Partite in Chiudi Partite e aggiorna il bottone in Crea in Chiudi Partite, mantenendo alias interno e flusso operativo; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_201.html`: rimossa la barra filtri da Apri Partite; il calendario diventa il primo elemento operativo e usa piu altezza disponibile; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_202.html`: esclusi gli slot di oggi con orario gia passato e resa responsive la griglia calendario con scroll interno; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_203.html`: aggiunta Richiesta giocatore in Apri Partite con indicatore R nel calendario e proposta che blocca i giocatori gia presenti; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_204.html`: ripristinato bottone Richieste salvate con conteggio e lista consultabile; navigazione menu resa piu reattiva annullando i calcoli pendenti di Apri Partite quando si cambia sezione; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_205.html`: annullare una partita nata da Apri Partite libera lo slot/campo se ancora futuro; riaprire partite passate viene bloccato; dopo la creazione compare Vai a gestire la partita; rimossi i tooltip nativi `title` dai bottoni; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_206.html`: Richiesta giocatore propone sempre il primo slot futuro utile; Richieste salvate diventa una coda riapribile con bottone Apri richiesta; le richieste convertite in partita escono dalla coda; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_207.html`: le richieste salvate con data/orario passati vengono archiviate come scadute e non compaiono piu in Richieste salvate ne nel calendario; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_208.html`: data/orario delle richieste giocatore diventano opzionali; Richieste salvate consente Apri richiesta, Apri proposta solo se esiste uno slot futuro, ed Elimina; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_209.html`: calendario Apri Partite reso responsive all'interno della finestra, senza larghezza minima fissa e senza sbordo orizzontale; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_210.html`: Richiesta giocatore con livello indicativo e tipologia partita; ospiti non in anagrafica ammessi come promemoria ma bloccati gia su Apri proposta, con deviazione alla scheda standard Nuovo socio e ritorno automatico alla proposta dopo il salvataggio; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_211.html`: ottimizzazione salvataggi a vuoto: `save()` evita riscritture localStorage identiche e i salvataggi manuali principali intercettano l'assenza di modifiche; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_212.html`: rifinitura Nuovo socio da Apri Partite: azione "Salva socio e torna alla proposta" spostata in basso, dati minimi obbligatori e tipo partita preferita non precompilato; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_213.html`: Nuovo socio mostra stelline sui campi obbligatori e microlegenda nella barra azioni; il ritorno alla proposta avviene solo dopo creazione socio riuscita; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_214.html`: Richiesta giocatore con piu nomi non in anagrafica: completamento in sequenza degli ospiti prima di aprire la proposta; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_215.html`: riconoscimento nominativi con suggerimenti "forse intendevi" in Richiesta giocatore e Gruppi staff, mostrando sempre il telefono per conferma; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_216.html`: riconoscimento nominativi piu rigido: automatico solo su nome+cognome o cognome+nome esatti; parziali/refusi bloccano apertura proposta o salvataggio gruppo finche non vengono confermati dai suggerimenti con telefono; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_217.html`: sui nominativi ambigui compare un bottone `Nuovo socio` per ogni nome inserito; se i suggerimenti non sono quelli giusti, Apri Partite porta alla scheda standard Nuovo socio e, nelle richieste giocatore, conserva la coda e il ritorno alla proposta; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_218.html`: correzione blocco scroll verticale in Apri Partite; il body non resta piu bloccato quando si lavora su calendario, richieste o layer interni; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_219.html`: Richiesta giocatore resa deterministica: conferma nominativo salvata, ritorno alla lista richieste, `Apri proposta` visibile solo se davvero pronta e apertura vincolata alla proposta della richiesta; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_220.html`: proposta da richiesta pronta con almeno 4 giocatori operativi; `Crea in Chiudi Partite` diventa verde e completa con i primi candidati non scartati se non sono stati accettati manualmente tutti; deroga livello solo per giocatori gia presenti nella richiesta; superata da v5.221; non pubblicata.
- `padel_match_organizer_v5_221.html`: creazione in Chiudi Partite vincolata ai soli giocatori fissi della richiesta e ai candidati accettati manualmente; il bottone resta disabilitato sotto 4 confermati e passa tutta la rosa confermata se superiore a 4; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_222.html`: apertura proposta da Richieste salvate resa deterministica e sidebar lasciata scrollabile durante gli overlay Apri Partite su desktop; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_223.html`: ottimizzazione performance Apri Partite: calendario leggero, cache locale `fillSlotsFastAnalysisCache`, proposte/candidati calcolati solo al click; non ancora pubblicata; richiede validazione manuale.
- `padel_match_organizer_v5_224.html`: seconda fase performance Apri Partite: nessun loading visibile nella sezione, contesto candidati riusato in memoria e pre-riscaldato dopo il calendario; pubblicata e validata come base stabile attuale.
- `padel_match_organizer_v5_225.html`: rimpaginazione grafica del menu laterale con capitoli numerati nell'ordine operativo indicato, sottomenu chiusi e apertura a fisarmonica; WhatsApp spostato sotto Chiudi Partite come supporto operativo; da validare manualmente e non ancora pubblicata.
- `padel_match_organizer_v5_226.html`: correzione scroll menu laterale: Dashboard e Apri Partite si aprono dalla parte alta della vista resettando `.main-content`; lo stesso criterio viene usato dal ritorno in alto di Apri Partite. Rimossa dalla Dashboard la barra superiore con titolo/badge mostrata sopra i contenuti; da validare manualmente e non ancora pubblicata.

## Checklist prima di creare una nuova versione globale

1. Confermare il file definitivo per ogni sezione.
2. Annotare qui la fonte definitiva.
3. Integrare una sezione alla volta.
4. Testare navigazione laterale e console error.
5. Salvare in root, `versioni/`, `docs/` e repository locale.
6. Solo dopo validazione, fare commit/push GitHub.

## Prompt da usare quando si apre una nuova chat/sezione

Stiamo lavorando su Padel Match Organizer. Salva sempre i dati locali sotto:

`/Users/maurizioaprea/Downloads/Padel Match Organizer`

Prima di modificare file, leggi:

`/Users/maurizioaprea/Downloads/Padel Match Organizer/docs/registro-versioni-sezioni.md`

La sezione su cui stiamo lavorando e' autonoma. Non modificare altre sezioni se non richiesto. Alla fine aggiorna questo registro con file, stato e note di validazione.
