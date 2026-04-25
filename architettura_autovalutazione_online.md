# Architettura Autovalutazione Online

Obiettivo: consentire al socio di cliccare un link WhatsApp, compilare una scheda online e salvare automaticamente la risposta in un database.

## Scelta consigliata

```text
GitHub + Supabase + pagina autovalutazione online + sezione admin futura
```

## Flusso

```text
Web app admin genera link personale
↓
Staff manda WhatsApp
↓
Socio compila autovalutazione.html
↓
Risposta salvata in Supabase
↓
Staff vede risposta e approva livello
```

## Regole

- Link personale senza login.
- Nessun dato personale visibile nell'URL.
- Livello autovalutato non è livello certificato.
- Lo staff approva prima di applicare il livello.
- Test iniziale con 3-5 soci.

## Prossimi sviluppi

- Sezione admin `Autovalutazione Livelli` in `index.html`.
- Generazione token/link personali.
- Lettura risposte Supabase.
- Pulsante `Applica livello`.
