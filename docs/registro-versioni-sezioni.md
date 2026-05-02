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
| Giocatori / gruppi staff | `versioni/padel_match_organizer_v5_175.html`; root `padel_match_organizer_v5_175.html`; repo `padel-match-organizer-github/index.html`; mockup `mockup/padel-players-section-mockup.html` | **Ricostruita da chat e pronta per collaudo finale** | Ricostruita dalla grafica approvata in chat: database con scheda inline, gruppi in minitabella, niente qualita dati/disponibilita da storico. v5.168 rimuove Livello 0.5 dal filtro Attenzione dati; v5.169 apre la scheda socio come overlay; v5.170 estende overlay a nuovo socio, dettaglio gruppo, modifica gruppo e nuovo gruppo. v5.171 corregge lo scroll di apertura schede e rimuove Dettagli dai gruppi, lasciando Modifica come azione unica. v5.172 centra meglio l’apertura dell’editor gruppo quando si clicca Modifica. v5.173 rende l’editor gruppo una finestra fissa centrata, con intestazione sempre visibile. v5.174 applica la stessa finestra fissa anche a scheda socio, nuovo socio e overlay gruppi. v5.175 aggiunge Cancella gruppo nella scheda Modifica gruppo. Riempi Slot preservato dalla 5.163. |
| Database giocatori | `versioni/padel_match_organizer_v5_175.html` | **Ricostruito da chat e pronto per collaudo finale** | Lista max 10, filtri espliciti, attenzione dati senza doppione Livello 0.5 e scheda socio, nuovo socio e gruppi in overlay sopra elenco; cancella gruppo disponibile dalla modifica gruppo. |
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
- `padel_match_organizer_v5_169.html`: raffinamento Database giocatori; scheda socio aperta come overlay sopra elenco giocatori.\n- `padel_match_organizer_v5_175.html`: raffinamento Giocatori/Gruppi; nuovo socio, nuovo gruppo, dettaglio e modifica gruppo aperti in overlay.

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
