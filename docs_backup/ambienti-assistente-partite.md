# Ambienti Assistente Partite

Data: 2026-05-17

Titolo breve: `Ambienti Assistente Partite`

## Stato progetto letto

Fonte: `docs/stato-progetto-corrente.md`

Stato al momento della stesura:

| Ambiente Admin | Versione | Branch | Commit app |
|---|---:|---|---|
| PROD Admin | v5.440 | `main` | `a6cc9d5` |
| TEST Admin | v5.441 | `test-preview` | `85edd3e` |
| TEST sviluppo Admin | v5.441 | `test/accessi-staff-guidati` | `85edd3e` |

Nota: questo documento riguarda il futuro `Assistente Partite Giocatori`, non modifica gli ambienti Admin esistenti.

## Obiettivo

Definire gli ambienti tecnici e operativi per sviluppare l'Assistente Partite in modo separato dall'app Admin Padel Village / Padel Match Organizer.

L'Assistente e' una web app pubblica protetta, destinata ai soci, che aiutera' a creare e chiudere partite usando dati minimizzati e regole controllate.

## Decisione centrale

L'Assistente deve essere separato dall'Admin su:

- chat di sviluppo;
- chat di promozione PROD;
- repository GitHub;
- deploy TEST;
- deploy PROD;
- Supabase TEST;
- Supabase PROD;
- dati;
- configurazioni;
- routine;
- segreti.

Ragionamento e mock-up possono restare comuni per coerenza progettuale, ma sviluppo e produzione devono essere separati.

## Struttura chat

| Fase | Admin | Assistente |
|---|---|---|
| RAGIONAMENTO | Chat unica attuale | Chat unica attuale |
| MOCK-UP | Chat unica attuale | Chat unica attuale, con mockup `assistente-*` |
| SVILUPPO TEST | `SVILUPPO TEST Admin` | nuova chat `SVILUPPO TEST Assistente Partite` |
| PROMOZIONE PROD | `Promuovi PROD Admin` | nuova chat `Promuovi PROD Assistente Partite` |

Regole:

- la chat `SVILUPPO TEST Assistente Partite` non deve modificare `index.html` Admin;
- la chat `Promuovi PROD Assistente Partite` non deve promuovere o modificare l'Admin;
- la chat `SVILUPPO TEST Admin` non deve costruire l'app pubblica giocatori;
- ogni handoff deve indicare chiaramente se riguarda Admin o Assistente.
- ogni prompt o handoff operativo deve includere `ID PROMPT` e `REGOLA ANTI-DOPPIO`, secondo `docs/regola-id-prompt-anti-doppio.md`.

## GitHub

Scelta consigliata: repository separato.

Nome repo proposto:

```text
padel-match-assistant
```

Percorso locale proposto:

```text
/Users/maurizioaprea/Downloads/Padel Match Organizer/padel-match-assistant-github
```

Branch proposti:

| Branch | Uso |
|---|---|
| `main` | PROD Assistente |
| `test-preview` | TEST Assistente pubblicato |
| `test/accessi-assistente` | sviluppo TEST Assistente |

Regole GitHub:

- l'Assistente non deve vivere nel repo Admin;
- l'Assistente non deve essere pubblicato tramite il deploy Admin;
- una promozione Admin non deve portare online codice Assistente;
- una promozione Assistente non deve modificare `main` Admin;
- i mock-up iniziali possono restare nella cartella mockup del progetto corrente, con prefisso `assistente-*`, finche' non viene creato il repo Assistente;
- dopo creazione repo Assistente, i mock-up approvati rilevanti possono essere copiati o documentati nel nuovo repo, senza duplicare dati reali.

## Deploy

Canali da definire:

| Ambiente | URL | Stato |
|---|---|---|
| Assistente TEST | da creare | non attivo |
| Assistente PROD | da creare | non attivo |

Opzione consigliata iniziale:

- GitHub Pages separato per il repo Assistente;
- TEST pubblicato da `test-preview`;
- PROD pubblicato da `main`;
- eventuale dominio personalizzato solo dopo collaudo.

Regola:

```text
Nessun deploy Assistente deve usare il dominio o il loader TEST/PROD dell'Admin.
```

## Supabase

Servono due nuovi progetti Supabase separati.

| Ambiente | Project ref | Stato |
|---|---|---|
| Assistente TEST | da creare | non attivo |
| Assistente PROD | da creare | non attivo |

Project ref Admin gia esistenti, da non usare per l'Assistente:

| Ambiente Admin | Project ref |
|---|---|
| Admin TEST | `cudiqnrrlbyqryrtaprd` |
| Admin PROD | `qqbfphyslczzkxoncgex` |

Regole Supabase Assistente:

- non usare i project ref Admin;
- non dare all'Assistente accesso diretto libero al database Admin;
- non condividere service role Admin;
- non esporre tabelle Admin al client Assistente;
- usare RLS su ogni tabella esposta;
- usare grant espliciti per Data API quando necessario;
- tenere TEST e PROD Assistente separati;
- nessuna routine TEST Assistente deve inviare comunicazioni reali o modificare dati reali;
- PROD Assistente deve essere attivato solo dopo policy privacy, consenso e flussi validati.

## Configurazioni

File/configurazioni da prevedere nel repo Assistente:

| File | Uso |
|---|---|
| `config.js` | configurazione PROD Assistente |
| `config-test.js` | configurazione TEST Assistente |
| `.gitignore` | esclude file locali, segreti, output temporanei |
| `README.md` | descrive app, ambienti e comandi |
| `docs/` | documentazione Assistente |
| `supabase/` | migrazioni e funzioni Assistente, se necessarie |

Regole:

- nessun secret nel client;
- nessun service role nel repo;
- nessuna credenziale Matchpoint nel repo;
- nessun dato reale soci nei mock-up;
- nessun file Excel Matchpoint permanente nel repo.

## Dati

L'Assistente deve usare solo dati minimizzati.

| Dato | Assistente TEST | Assistente PROD |
|---|---|---|
| Soci | fittizi o copia minimizzata controllata | solo soci abilitati e consenzienti |
| Livelli | fittizi o copia controllata | solo livello necessario al matching |
| Disponibilita' | fittizie o copia controllata | solo disponibilita' utili |
| Storico partite | simulato o aggregato | solo segnali necessari, non storico grezzo completo |
| Reputazione/affidabilita' | simulata | aggregata, non umiliante, non pubblica come metrica negativa |
| Email/telefono | non pubblici | usati solo per auth/contatto autorizzato |
| Note staff | non disponibili | non disponibili |

## Flusso dati Admin -> Assistente

Il collegamento deve essere governato.

Opzioni da valutare:

| Opzione | Descrizione | Nota |
|---|---|---|
| Snapshot minimizzato | Admin esporta solo dati necessari verso Assistente | semplice e controllabile |
| API controllata | Assistente chiede dati filtrati tramite funzione/API | piu evoluta |
| Sync programmato | routine copia dati minimizzati | solo dopo policy e test |

Regola iniziale consigliata:

```text
Partire con snapshot/export minimizzato controllato, non con accesso diretto al database Admin.
```

## Flusso dati Assistente -> Admin

L'Assistente potra' restituire:

- richieste partita create dai soci;
- slot desiderati;
- giocatori proposti/contattati;
- risposte ricevute;
- stato di chiusura partita;
- segnali aggregati di affidabilita';
- casi da far vedere allo staff.

Questi dati devono tornare all'Admin tramite flusso documentato, non con scritture libere nel database Admin PROD.

## Auth e privacy

Regola iniziale:

- niente accesso anonimo libero;
- accesso semplice per soci gia presenti nel database;
- registrazione minima solo se socio non riconosciuto;
- consenso privacy obbligatorio;
- consenso uso Assistente obbligatorio;
- se il socio non accetta, non usa il servizio;
- nessuna lista soci pubblica navigabile;
- nomi reali visibili solo dentro flussi coerenti di proposta partita, non come rubrica generale.

Da decidere domani:

- metodo login: email, telefono, magic link, codice, OTP o altra soluzione;
- livello di verifica identita';
- durata sessione;
- gestione nuovi utenti non agganciati al socio Admin;
- testi privacy e consenso.

## Routine e comunicazioni

Prima fase:

- nessun WhatsApp automatico;
- nessuna email automatica verso soci;
- nessuna notifica automatica senza approvazione specifica;
- eventuali messaggi sono preparati e confermati dal giocatore o dallo staff;
- ogni futura automazione deve passare da mock-up, sviluppo TEST, autorizzazione PROD separata.

## Handoff

La procedura handoff locale vale anche per l'Assistente, ma con file separati.

Cartella:

```text
/Users/maurizioaprea/Downloads/Padel Match Organizer/lavoro-codex/handoff/
```

File proposti:

| Passaggio | File |
|---|---|
| MOCK-UP -> SVILUPPO TEST Assistente | `sviluppo-test-assistente.md` |
| SVILUPPO TEST Assistente -> Promuovi PROD Assistente | `promuovi-prod-assistente.md` |

Comandi brevi proposti:

```text
LEGGI HANDOFF ASSISTENTE TEST
```

```text
LEGGI HANDOFF ASSISTENTE PROD
```

Regola pulizia:

- usare nomi fissi;
- inserire sempre nel file handoff un `ID PROMPT` nuovo;
- non creare copie infinite;
- cancellare o sovrascrivere solo quando la chat successiva ha preso in carico il file;
- se serve storico, aggiornare documenti condivisi, non accumulare handoff.

## Setup da fare domattina

Sequenza consigliata:

1. Confermare nome repo GitHub Assistente.
2. Confermare struttura branch.
3. Confermare se GitHub Pages e' il deploy iniziale.
4. Creare repo locale e remoto Assistente.
5. Creare chat `SVILUPPO TEST Assistente Partite`.
6. Creare chat `Promuovi PROD Assistente Partite`.
7. Creare progetto Supabase `Assistente TEST`.
8. Creare progetto Supabase `Assistente PROD`.
9. Annotare project ref nel documento ambienti.
10. Preparare config TEST/PROD Assistente.
11. Preparare schema iniziale minimo solo dopo piano dati approvato.
12. Preparare policy RLS e grant Data API prima di esporre tabelle.
13. Creare primo mock-up Assistente o importare mock-up gia approvato.
14. Pubblicare solo TEST Assistente.
15. PROD Assistente resta spento finche' non autorizzato.

## Cosa non fare stanotte da soli

Non creare ambienti reali senza Maurizio se mancano conferme su:

- nome repo definitivo;
- account/organizzazione GitHub;
- metodo deploy;
- nomi progetti Supabase;
- regione Supabase;
- piano/billing;
- policy privacy;
- metodo login;
- dati iniziali;
- schema minimo;
- segreti;
- eventuali domini pubblici.

Preparare documentazione e checklist e' sicuro. Creare ambienti reali senza conferma non e' consigliato.

## Checklist decisioni domattina

| Decisione | Stato |
|---|---|
| Nome repo Assistente | da confermare |
| Percorso locale Assistente | proposto |
| Branch Assistente | proposti |
| Deploy TEST Assistente | da confermare |
| Deploy PROD Assistente | da confermare |
| Supabase TEST Assistente | da creare |
| Supabase PROD Assistente | da creare |
| Regione Supabase | da scegliere |
| Auth soci | da decidere |
| Privacy/consenso | da definire |
| Dati minimizzati iniziali | da definire |
| Primo mock-up Assistente | da scegliere |
| Prima chat sviluppo Assistente | da creare |
| Prima chat promozione Assistente | da creare |

## Regola finale

Admin e Assistente fanno parte dello stesso ecosistema, ma non devono condividere ambienti operativi.

L'Admin resta il gestionale interno.

L'Assistente diventa una web app soci separata, protetta, con dati minimizzati e ambienti propri.

Ogni collegamento tra i due deve essere esplicito, documentato, testato e reversibile.
