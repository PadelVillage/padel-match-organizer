# Slot potenziali

Stato: configurazione iniziale introdotta in v5.233; immagine di riferimento locale aggiunta in v5.234; riquadro DATI orizzontale aperto di default in v5.236.

## Scopo

La griglia Slot potenziali rappresenta gli slot teorici vendibili/giocabili del club, distinti per giorno della settimana.

La griglia non deriva da OCR o immagini in runtime: e' una configurazione dati interna iniziale, salvata in localStorage con chiave `potentialSlotSchedule`.

## Regola comune

`slot potenziali configurati - prenotazioni/occupazioni Matchpoint importate = slot liberi reali`

La stessa fonte deve essere usata da:

- Dashboard / `Slot Liberi`;
- Apri Partite / calendario e proposte slot liberi.

## Griglia iniziale

### Lunedi

- 12:30-14:00
- 14:00-15:30
- 18:00-19:30
- 19:30-21:00
- 21:00-22:30

### Martedi

- 12:30-14:00
- 14:00-15:30
- 18:00-19:30
- 19:30-21:00
- 21:00-22:30

### Mercoledi

- 12:30-14:00
- 14:00-15:30
- 18:00-19:30
- 19:30-21:00
- 21:00-22:30

### Giovedi

- 12:30-14:00
- 14:00-15:30
- 18:00-19:30
- 19:30-21:00
- 21:00-22:30

### Venerdi

- 09:00-10:30
- 10:30-12:00
- 12:30-14:00
- 14:00-15:30
- 15:30-17:00
- 17:00-18:30
- 18:30-20:00
- 20:00-21:30

### Sabato

- 09:00-10:30
- 10:30-12:00
- 12:00-13:30
- 13:30-15:00
- 15:00-16:30
- 16:30-18:00
- 18:00-19:30

### Domenica

- 09:00-10:30
- 10:30-12:00
- 15:00-16:30
- 16:30-18:00
- 18:00-19:30

## Immagine di riferimento

Da v5.234 DATI (in/out) permette di caricare un'immagine aggiornata della griglia slot.

- L'immagine e' salvata localmente con chiave `potentialSlotImage`.
- Serve come riferimento visivo sostituibile nel tempo.
- Non viene letta con OCR e non aggiorna automaticamente `potentialSlotSchedule`.
- Il backup locale include anche l'immagine, se presente.

Se gli slot teorici cambiano, bisogna aggiornare anche la configurazione dati della griglia nello stesso riquadro DATI, tramite l'editor `Griglia slot operativa` e il pulsante `Salva griglia slot`.

Dopo il salvataggio, Dashboard / Slot Liberi e Apri Partite usano subito la nuova fonte `potentialSlotSchedule`; la cache leggera di Apri Partite viene invalidata.

## Layout DATI

Da v5.236 il riquadro `Slot potenziali Matchpoint` e' sotto i quattro box principali della sezione DATI, a tutta larghezza, aperto di default e senza barra di apertura.

Mostra due aree affiancate su desktop:

- immagine griglia slot;
- editor `Griglia slot operativa` con pulsante `Salva griglia slot`.

Su schermi stretti le due aree vanno in colonna.

## Note operative

- Il box DATI `Slot potenziali` salva/ripristina la griglia standard.
- La cancellazione cache Matchpoint ripristina anche questa griglia standard.
- Il backup locale include `potentialSlotSchedule` e, se presente, `potentialSlotImage`; il ripristino backup normalizza la griglia prima del salvataggio.
- La cache leggera di Apri Partite viene invalidata quando la griglia viene salvata.
