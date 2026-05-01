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
| Riempi Slot - calendario e overlay | `versioni/padel_match_organizer_v5_163.html` come base stabile; mockup `mockup/padel-fill-slot-calendar-staff-mockup.html`; mockup `mockup/padel-fill-slot-proposal-staff-mockup.html` | **Da considerare stabile rispetto alla 163; da ricontrollare in app finale** | La 164 non e' valida per questa sezione. La 165 riparte dalla 163 per non rompere Riempi Slot. |
| Riempi Slot - algoritmo | `docs/algoritmo-riempi-slot.md` | **Documentato** | Include priorita' slot, limite contatto massimo 2 slot in giorni diversi, ranking candidati, gruppi staff e proposte algoritmo. |
| Giocatori / gruppi staff | `mockup/padel-players-section-mockup.html`; app `padel_match_organizer_v5_165.html` | **Da validare visivamente** | La 165 aggiorna solo la sezione gruppi/giocatori partendo dalla 163. Se esiste una chat con versione definitiva diversa, va indicato il file. |
| Database giocatori | Da confermare | **Da confermare** | La 164 ha provato a modificarla ma non va considerata definitiva. Serve recuperare la versione validata della chat dedicata. |
| Autovalutazioni / dashboard | `mockup/padel-dashboard-mockup.html`; viewer `mockup/padel-players-assessment-viewer.html` | **Da confermare** | La 164 non va considerata definitiva. Serve recuperare la versione validata della chat dedicata. |
| Programmazione Partite / Partite aperte | Da confermare | **Da confermare** | Riempi Slot dovra' creare proposte verso Partite Aperte, non direttamente verso invio richiesta. |
| WhatsApp / messaggi | Da confermare | **Da confermare** | Nessun invio automatico senza conferma manuale. |
| Matchpoint import | App storica nelle versioni 151-165 | **Da confermare** | Import Excel deve aggiornare automaticamente giocatori, prenotazioni, storico, Riempi Slot e disponibilita'. |

## Versioni da non usare come base globale

- `padel_match_organizer_v5_164.html`: non valida come base globale. Ha rotto/alterato sezioni e non deve essere usata per proseguire.

## Versioni candidate

- `padel_match_organizer_v5_163.html`: base stabile per Riempi Slot prima della 164.
- `padel_match_organizer_v5_165.html`: correzione d'emergenza: riparte dalla 163 e aggiunge solo un aggiornamento grafico controllato su Giocatori/gruppi.

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
