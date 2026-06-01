# Versioni Mockup — Calendario Staff · Griglia + Chat AI

| Versione | Data       | Changelog                                                                                                                  |
|----------|------------|----------------------------------------------------------------------------------------------------------------------------|
| v3.6     | 2026-05-31 | Tolto il box titolo della chat ("Assistente Prenotazioni Staff"): parte dritta col campo di scrittura; resta solo la ✕ per chiudere su mobile. Nessuna modifica di logica rispetto al v3.5. |
| v3.5     | 2026-05-31 | Chat instrada al flusso guidato i campi mancanti (campo/ora da frase; tipo/durata/giocatori dal flusso esistente); niente più finto-confermato; rimossi nomi demo finti. |
| v3.4     | 2026-05-31 | Lettura dati reali da Supabase TEST via vista `v_calendario_pubblico` (anon key, sola lettura). Dati di esempio rimossi; `loadDay(dateISO)` con cache sostituisce i dati hardcoded. Creazione/modifica/eliminazione restano solo locali (Tappa 3). |
| v3.3     | 2026-05-30 | v3.2 → v3.3: ingranditi i testi del pannello chat e della scheda di modifica su mobile (coerenti con l'agenda a 20px); desktop invariato; nessuna modifica di logica. |
| v3.2     | 2026-05-30 | v3.1 → v3.2: testi mobile portati a 20px base (agenda più leggibile a bordo campo); desktop invariato; nessuna modifica di logica. |
| v3.1     | —          | Tipografia mobile 16px (era 15px); rimossa legenda icone su mobile; desktop invariato.                                     |
| v3.0     | —          | Impianto responsive (griglia ≥900px / agenda <900px); tab C1–C4; navigatore data; fasce libere unite; font 15px; --text-muted più scuro. |
| v2.4     | —          | Rimosso bottone «➕ Aggiungi» ridondante dalla riga Giocatori modifica.                                                     |
| v2.3     | —          | 5 fix: doppione "+", split nomi, scroll chat, chip giocatori, drag&drop con durata evidenziata.                            |
| v2.2     | —          | Modifica guidata staff (scheda in chat, campi editabili, conferma per id).                                                 |
| v2.1     | —          | Validazione canPlace in creazione, bottoni scheda robusti su mobile.                                                       |
| v2.0     | —          | id booking, chip giocatori, drag&drop simulato, schede Modifica/Elimina.                                                   |
