# Regola mockup per modifiche grafiche

Questa regola e' obbligatoria per ogni modifica grafica o di layout del progetto Padel Match Organizer.

## Regola ferrea

Ogni modifica visibile deve partire da un mockup visivo approvabile.

Finche' Maurizio non approva esplicitamente il mockup, non si sviluppa la modifica nell'app reale e non si toccano `index.html`, `autovalutazione.html`, CSS o UI operative.

## Cosa richiede un mockup

Serve un mockup per qualunque cambiamento visibile, incluso:

- layout;
- colori;
- testi UI;
- spaziature;
- sezioni e capitoli;
- navigazione;
- bottoni;
- tabelle;
- modali;
- card;
- comportamento responsive.

Le modifiche solo tecniche o backend senza impatto visivo non richiedono mockup.

## Procedura obbligatoria

1. Analizzare il codice e la sezione coinvolta.
2. Creare un mockup visuale nella cartella `mockup/`.
3. Usare un nome descrittivo, per esempio `mockup/admin-sezioni-mockup.html`.
4. Non collegare il mockup a dati reali, Supabase o flussi operativi.
5. Mostrare il mockup a Maurizio e fermarsi.
6. Procedere allo sviluppo solo dopo approvazione esplicita in chat.
7. Pubblicare la versione sviluppata in TEST.
8. Chiedere conferma separata prima di aggiornare PROD.

## Approvazione valida

L'approvazione deve essere chiara nella conversazione, per esempio:

```text
Mockup approvato, procedi allo sviluppo.
```

Frasi generiche, commenti parziali o richieste di modifiche al mockup non autorizzano lo sviluppo dell'app reale.

## Applicazione ad Amministrazione

Per la riorganizzazione della sezione Amministrazione in **Utenti / Sessione / Supabase**, il primo passo e' creare un mockup in `mockup/`.

Solo dopo approvazione esplicita del mockup si potra' modificare `index.html` e pubblicare in TEST.

PROD resta escluso finche' Maurizio non autorizza esplicitamente il passaggio.
