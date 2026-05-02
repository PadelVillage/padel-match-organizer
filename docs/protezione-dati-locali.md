# Protezione Dati Locali

Stato: introdotta in v5.176.

Questa app salva i dati operativi nel browser tramite localStorage. Gli aggiornamenti pubblicati su GitHub non dovrebbero cancellare i dati locali, ma il browser puo' mostrare dati vuoti se:

- si apre la app da un dominio o percorso diverso;
- si usa un altro browser o dispositivo;
- si svuotano dati sito/cache/localStorage;
- si usa modalita privata;
- il browser rimuove dati locali per politiche privacy o spazio.

## Misure introdotte

- All'avvio l'app chiede al browser, quando disponibile, di rendere persistente lo storage locale.
- Se trova dati operativi, crea uno snapshot automatico locale in `pmoAutoDataSnapshotV1`.
- Se una versione parte vuota ma esiste uno snapshot con soci, prenotazioni, storico o gruppi, mostra un pannello di recupero.
- Il pannello permette di ripristinare lo snapshot senza reimportare Excel.
- La cancellazione cache Matchpoint richiede conferma forte scrivendo `ELIMINA` e salva prima uno snapshot locale.

## Limiti

Lo snapshot automatico e' salvato nello stesso browser. Non sostituisce il backup manuale JSON, perche' se il browser cancella completamente i dati del sito puo' eliminare anche lo snapshot.

Regola operativa: prima di ogni pubblicazione importante o import massivo fare sempre anche `Backup Dati`.
