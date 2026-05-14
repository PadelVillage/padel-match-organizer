# Stato progetto corrente

Ultimo aggiornamento: 2026-05-14 08:04

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
| PROD | v5.411 | `main` | `711efe8` |
| TEST | v5.412 | `test-preview` | `43265c7` |
| TEST sviluppo | v5.412 | `test/accessi-staff-guidati` | `43265c7` |

Nota: PROD resta fermo a v5.411. TEST v5.412 e' la prima fase tecnica per routine email Autovalutazione.

## Link

- TEST: `https://padelvillage.github.io/padel-match-organizer/test/?env=test`
- PROD: `https://padelvillage.github.io/padel-match-organizer/`

## Ultimo lavoro pubblicato

La versione v5.412 e' pubblicata solo in TEST. PROD resta v5.411.

Contiene:

- Autovalutazione fino a v5.407, inclusi storico compatto, lettura risposte email, gestione mancate consegne e stato invio compatto.
- Database soci con riepilogo KPI in tabella compatta.
- Conteggio `Senza email` nel riepilogo Database soci e nel filtro `Attenzione dati`.
- Autovalutazione v5.409 TEST con nuova tab `Matchpoint`: livelli validati internamente da riportare manualmente su Matchpoint, bottone `Segna inserito su Matchpoint` e traccia nello storico.
- Autovalutazione v5.410 TEST con demo non persistente `?env=test&demoMatchpoint=1` per mostrare una riga fittizia in Matchpoint senza salvare dati reali.
- Autovalutazione v5.411 TEST con nuova tab `Cruscotto mattutino`: riepiloga Problemi, Post-invio, Da controllare, Matchpoint e Da inviare con azioni rapide verso i flussi esistenti.
- Autovalutazione v5.412 TEST con prima routine backend email: invio massimo 10 soci alle 05:45 e controlli Gmail automatici alle 06:10, 10:30, 15:30 e 20:30. Edge Function TEST `assessment-email-send` v14 con `verify_jwt=false`, controllo interno JWT staff o secret Vault, filtro tecnico `targetMemberIds` per test mirati e GRANT espliciti `service_role` per le tabelle lette/scritte dalla routine. Nota operativa: il cron TEST generale e' stato rimosso il 2026-05-14 07:39 per evitare invii automatici reali; per il 2026-05-14 09:00 Europe/Rome e' schedulato un solo test reale sul socio `PMO-000948`.
- Documentazione aggiornata per v5.412 TEST.

Non contiene modifiche a:

- Matchpoint;
- import dati.

Nota: le modifiche Supabase/funzione Edge della v5.412 sono solo TEST. Il cron scheduler TEST generale non e' attivo dopo la rimozione manuale del 2026-05-14 07:39. Resta attivo solo il job una tantum `pmo-assessment-email-single-test-0900` per il test controllato `PMO-000948` delle 09:00. Non sono attive in PROD.

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
