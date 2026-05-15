# Stato progetto corrente

Ultimo aggiornamento: 2026-05-15 10:01

Questo file e' la fonte rapida ufficiale per capire su quale versione del progetto stanno lavorando le chat RAGIONAMENTO, MOCK-UP e SVILUPPO.

Se le informazioni scritte in un prompt non coincidono con questo file, considera piu affidabile questo file e chiedi conferma prima di procedere.

## Lettura obbligatoria prima di iniziare

Per le chat RAGIONAMENTO e MOCK-UP, prima di proporre idee, piani, layout o testi:

1. leggere questo file;
2. leggere il `Registro versioni per sezione`;
3. leggere i documenti collegati alla sezione su cui si sta lavorando;
4. dichiarare in apertura quale versione TEST/PROD risulta corrente;
5. non modificare codice, funzioni, SQL, deploy o dati reali.

Per la chat SVILUPPO, prima di modificare file reali:

1. leggere questo file;
2. leggere i documenti obbligatori del progetto;
3. verificare branch, stato Git e commit corrente;
4. integrare solo piani o mockup approvati;
5. aggiornare questo file quando cambia la versione TEST o PROD.

## Versione corrente

| Ambiente | Versione | Branch | Commit app pubblicata |
|---|---:|---|---|
| PROD | v5.422 | `main` | `6549f18` |
| TEST | v5.423 | `test-preview` | candidato pubblicazione TEST |
| TEST sviluppo | v5.423 | `test/accessi-staff-guidati` | candidato pubblicazione TEST |

Nota: PROD resta fermo a v5.422. In TEST v5.423 le modifiche alla scheda socio vengono anche inviate subito a Supabase come record `member`, senza aspettare backup cloud manuale o automatico. Lo scheduler email Autovalutazione PROD resta non attivo.

## Link

- TEST: `https://padelvillage.github.io/padel-match-organizer/test/?env=test`
- PROD: `https://padelvillage.github.io/padel-match-organizer/`

## Ultimo lavoro pubblicato

La versione v5.423 e' candidata TEST su branch `test/accessi-staff-guidati`; PROD resta a v5.422.

Contiene:

- Autovalutazione fino a v5.407, inclusi storico compatto, lettura risposte email, gestione mancate consegne e stato invio compatto.
- Database soci con riepilogo KPI in tabella compatta.
- Conteggio `Senza email` nel riepilogo Database soci e nel filtro `Attenzione dati`.
- Autovalutazione v5.409 TEST con nuova tab `Matchpoint`: livelli validati internamente da riportare manualmente su Matchpoint, bottone `Segna inserito su Matchpoint` e traccia nello storico.
- Autovalutazione v5.410 TEST con demo non persistente `?env=test&demoMatchpoint=1` per mostrare una riga fittizia in Matchpoint senza salvare dati reali.
- Autovalutazione v5.411 TEST con nuova tab `Cruscotto mattutino`: riepiloga Problemi, Post-invio, Da controllare, Matchpoint e Da inviare con azioni rapide verso i flussi esistenti.
- Autovalutazione v5.412 TEST con prima routine backend email: invio massimo 10 soci alle 05:45 e controlli Gmail automatici alle 06:10, 10:30, 15:30 e 20:30. Edge Function TEST `assessment-email-send` v14 con `verify_jwt=false`, controllo interno JWT staff o secret Vault, filtro tecnico `targetMemberIds` per test mirati e GRANT espliciti `service_role` per le tabelle lette/scritte dalla routine. Nota operativa: il cron TEST generale e' stato rimosso il 2026-05-14 07:39 per evitare invii automatici reali; il test reale controllato delle 09:00 Europe/Rome sul socio `PMO-000948` ha inviato una sola email.
- Autovalutazione v5.413 TEST con nuovo `Cruscotto mattutino` tabellare `Processo utenti`: assorbe le informazioni della vecchia tab `Stato invio`, mantiene come tab principali solo `Cruscotto mattutino`, `Storico`, `Testi` e `Scheda pubblica`, e usa filtri rapidi (`Tutti`, `Oggi`, `Da inviare`, `In attesa`, `Problemi`, `Risposte`, `Da controllare`, `Matchpoint`, `Completati`) alimentati dalle logiche gia esistenti.
- Autovalutazione v5.414 TEST: rimossa dal `Cruscotto mattutino` la barra informativa `Matchpoint va aggiornato manualmente...`, gia nota allo staff. Nessuna modifica a invii, scheduler, Gmail, storico, Matchpoint reale o PROD.
- Autovalutazione v5.415 TEST: il `Cruscotto mattutino` mostra al massimo 20 righe per volta per il filtro attivo, mantenendo i conteggi reali e aggiungendo `Mostra altri 20` quando esistono altri soci. Nessuna modifica a invii, scheduler, Gmail, storico, Matchpoint reale o PROD.
- Autovalutazione v5.416 TEST: hotfix del `Cruscotto mattutino`; il limite progressivo a 20 righe usa uno stato separato dalla funzione di calcolo, evitando il blocco dei box filtro. Nessuna modifica a invii, scheduler, Gmail, storico, Matchpoint reale o PROD.
- Autovalutazione v5.417 TEST: aggiunta ricerca interna al `Cruscotto mattutino` / `Processo utenti`, estesa la ricerca a ID socio, email, telefono, token e dati del giro, e resa stabile la ricerca nello `Storico` mentre si digita. Serve a ritrovare anche soci usciti dai primi 20 o finiti in filtri diversi. Nessuna modifica a invii, scheduler, Gmail, storico dati, Matchpoint reale o PROD.
- Autovalutazione v5.418 TEST/PROD: i controlli manuali Gmail `Aggiorna risposte email` e `Controlla mancate consegne` non compaiono piu nei pannelli operativi e sono disponibili solo dentro `Strumenti tecnici avanzati`. Il deploy PROD non ha applicato SQL scheduler e non ha attivato cron email Autovalutazione.
- Autovalutazione v5.419 TEST: il `Cruscotto mattutino` aggancia i log cloud `assessment_email` anche tramite ID giocatore `memberId`/`PMO-...`, importa automaticamente in modo silenzioso gli ultimi log cloud quando si apre Autovalutazione, archivia il token precedente se arriva un nuovo invio e considera un nuovo invio successivo a un ciclo gia chiuso come nuovo ciclo `In attesa`, non come `Completato`.
- Autovalutazione v5.420 TEST: nella ricerca `Cerca nel processo`, i box filtro sopra la tabella si evidenziano quando contengono il socio cercato, cosi' lo staff vede subito se il socio e' in `Da inviare`, `In attesa`, `Problemi`, `Risposte`, `Da controllare`, `Matchpoint` o `Completati`.
- Autovalutazione v5.421 TEST/PROD: la ricerca del `Cruscotto mattutino` e dello `Storico` diventa a parole indipendenti: se il nome/cognome del socio viene digitato in ordine diverso, il socio viene comunque trovato.
- Anagrafica soci / Autovalutazione v5.422 TEST/PROD: dopo aggiunta, modifica, disattivazione o cancellazione socio, la sezione Autovalutazione viene rinfrescata subito; la ricerca del Database soci usa parole indipendenti, coerente con cruscotto e storico.
- Anagrafica soci / Cloud v5.423 TEST sviluppo: aggiunta, modifica, disattivazione/riattivazione e cancellazione socio preparano subito la scrittura puntuale del record `member` in Supabase tramite RPC staff, senza attendere il backup cloud. Se la scrittura cloud non riesce, la modifica locale resta salvata e viene mostrato un avviso.
- Routine TEST una tantum: il job `pmo-assessment-email-single-test-1630` per `PMO-000948` si e' eseguito correttamente alle 16:30 Europe/Rome, si e' rimosso e ha inviato una sola email confermata dall'utente. Non ha coinvolto la coda generale e non ha toccato PROD.
- Documentazione aggiornata per v5.423 TEST sviluppo.

Non contiene modifiche a:

- Matchpoint;
- import dati.

Nota: il deploy PROD v5.422 non applica SQL scheduler e non attiva routine email automatiche. Il controllo live su Supabase PROD del 2026-05-15 08:52 mostra in `cron.job` solo `pmo-data-routines-dispatcher-prod`, cioe' lo scheduler dati/Matchpoint gia esistente. Il cron scheduler TEST generale non e' attivo dopo la rimozione manuale del 2026-05-14 07:39. Il job una tantum TEST `pmo-assessment-email-single-test-1630` per `PMO-000948` si e' gia eseguito e rimosso.

Nota tecnica PROD 2026-05-13 20:08: durante il test controllato in PROD e' stato riallineato lo schema Supabase `assessment_tokens`, aggiungendo la colonna `registered_at` richiesta dalla RPC `upsert_assessment_tokens_admin`. La modifica non cambia la versione app e non invia email.

## Regole operative per le chat

### Chat RAGIONAMENTO

- Legge questo file prima di proporre piani.
- Definisce idee, requisiti, flussi e priorita.
- Non modifica il codice principale.
- Se la proposta ha impatto grafico, prepara un passaggio per la chat MOCK-UP.
- Se la proposta richiede integrazione reale, prepara un passaggio per la chat SVILUPPO.

### Chat MOCK-UP

- Legge questo file prima di creare mockup.
- Crea solo prototipi separati dentro `mockup/`.
- Non modifica `index.html`, versioni ufficiali, SQL, funzioni Supabase o file di deploy.
- A fine lavoro prepara un passaggio consegne per SVILUPPO con file, stato approvazione, testi, regole grafiche e verifiche consigliate.

### Chat SVILUPPO

- E' l'unica chat autorizzata a modificare la web app principale.
- Integra solo piani o mockup approvati.
- Aggiorna questo file a ogni nuova versione TEST o PROD.
- Non porta modifiche in PROD senza autorizzazione esplicita.

## File principali da consultare

- Registro versioni per sezione:
  `/Users/maurizioaprea/Downloads/Padel Match Organizer/docs/registro-versioni-sezioni.md`
- Regole Supabase Data API / grant futuri:
  `/Users/maurizioaprea/Downloads/Padel Match Organizer/docs/supabase-data-api-regole.md`
- Algoritmo Riempi Slot:
  `/Users/maurizioaprea/Downloads/Padel Match Organizer/docs/algoritmo-riempi-slot.md`
- Matchpoint / DATI:
  `/Users/maurizioaprea/Downloads/Padel Match Organizer/docs/matchpoint.md`
- Routine dati automatiche:
  `/Users/maurizioaprea/Downloads/Padel Match Organizer/docs/routine-dati-automatiche.md`
- Autovalutazione email:
  `/Users/maurizioaprea/Downloads/Padel Match Organizer/docs/autovalutazioni-email-routine.md`

## Documentazione da leggere in base all'area

| Area di lavoro | Documenti da leggere prima |
|---|---|
| Autovalutazione | `stato-progetto-corrente.md`, `registro-versioni-sezioni.md`, `autovalutazioni-email-routine.md` |
| Database soci / Anagrafica | `stato-progetto-corrente.md`, `registro-versioni-sezioni.md`, `algoritmo-riempi-slot.md` |
| DATI / Matchpoint / backup | `stato-progetto-corrente.md`, `registro-versioni-sezioni.md`, `matchpoint.md`, `routine-dati-automatiche.md` |
| Supabase / SQL / Data API | `stato-progetto-corrente.md`, `registro-versioni-sezioni.md`, `ambienti-test-prod.md`, `supabase-data-api-regole.md` |
| Apri Partite / algoritmo | `stato-progetto-corrente.md`, `registro-versioni-sezioni.md`, `algoritmo-riempi-slot.md`, `matchpoint.md` |
| Chiudi Partite / WhatsApp | `stato-progetto-corrente.md`, `registro-versioni-sezioni.md`, `algoritmo-riempi-slot.md` |
| Nuovi mockup grafici | `stato-progetto-corrente.md`, `registro-versioni-sezioni.md` e il mockup approvato piu recente della sezione |

## Percorsi progetto

- Root progetto:
  `/Users/maurizioaprea/Downloads/Padel Match Organizer`
- Repo Git:
  `/Users/maurizioaprea/Downloads/Padel Match Organizer/padel-match-organizer-github`
- App principale:
  `/Users/maurizioaprea/Downloads/Padel Match Organizer/padel-match-organizer-github/index.html`
- Mockup:
  `/Users/maurizioaprea/Downloads/Padel Match Organizer/padel-match-organizer-github/mockup`
- File temporanei:
  `/Users/maurizioaprea/Downloads/Padel Match Organizer/lavoro-codex`

## Percorso da non usare

Non usare:

`/Users/maurizioaprea/Documents/New project`
