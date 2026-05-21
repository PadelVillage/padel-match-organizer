# Regola prompt definitivi per chat MOCK-UP

Questa regola definisce come la chat RAGIONAMENTO deve preparare i prompt da passare alla chat MOCK-UP.

Data: 2026-05-16  
Chat: RAGIONAMENTO  
Titolo breve: `Regola prompt MOCK-UP definitivi`

## Obiettivo

Evitare prompt incompleti, progressivi o corretti a rilanci successivi.

Quando Maurizio chiede un prompt da passare alla chat MOCK-UP, la chat RAGIONAMENTO deve distinguere chiaramente tra:

- ragionamento ancora aperto;
- bozza non definitiva;
- prompt definitivo copiabile.

Un prompt puo' essere chiamato definitivo solo se supera il controllo completezza indicato sotto.

## Regola fondamentale

La chat RAGIONAMENTO non deve scrivere `PROMPT DEFINITIVO` se ha ancora dubbi, assunzioni non dichiarate o elementi mancanti.

Se manca una decisione, un dato o un vincolo, deve fermarsi e dichiarare:

```text
Il prompt non e' ancora definitivo perche' manca: ...
```

oppure deve fare una domanda breve e operativa.

## Controllo completezza obbligatorio

Prima di scrivere un prompt definitivo per MOCK-UP, la chat RAGIONAMENTO deve verificare:

```text
CONTROLLO COMPLETEZZA PROMPT MOCK-UP
- Stato progetto letto
- Versione TEST/PROD e commit
- Documenti da leggere
- Sessioni browser / login staff valutati se serve riferimento UI reale
- ID PROMPT univoco e REGOLA ANTI-DOPPIO presenti
- Applicativo: Admin / Assistente / entrambi
- Sezione coinvolta
- Obiettivo operativo
- Utente principale
- Decisioni approvate
- Assunzioni esplicite
- Alternative da esplorare
- Dati simulati realistici
- Dati esistenti vs dati ipotetici
- Stati UI
- Responsive
- Cosa preservare
- Cosa non modificare
- Privacy/dati reali valutati
- Supabase/Matchpoint/routine/import/export/comunicazioni valutati
- Condizioni di stop
- Criteri di approvazione
- Output richiesto
- Consegna per SVILUPPO TEST
```

Se una voce non e' applicabile, va indicato esplicitamente:

```text
Non applicabile: ...
```

Non va lasciata implicita.

## Struttura obbligatoria del prompt definitivo

Un prompt definitivo per MOCK-UP deve includere almeno:

1. `ID PROMPT` univoco e `REGOLA ANTI-DOPPIO`, secondo `docs/regola-id-prompt-anti-doppio.md`;
2. nome proposta;
3. applicativo coinvolto: Admin, Assistente o entrambi solo come contesto;
4. sezione coinvolta;
5. stato progetto rilevato;
6. documenti da leggere;
7. eventuale uso di sessione browser solo come riferimento visuale, senza credenziali o azioni operative;
8. obiettivo operativo;
9. utente principale;
10. flusso desiderato;
11. dati da mostrare;
12. dati simulati realistici;
13. stati UI;
14. regole UX approvate;
15. testi UI proposti;
16. cosa preservare della UI attuale;
17. cosa non modificare;
18. vincoli su dati reali, Supabase, Matchpoint, routine, import/export e comunicazioni;
19. alternative grafiche da esplorare, se utili;
20. condizioni di stop;
21. criteri di approvazione;
22. nome file suggerito;
23. output finale richiesto alla chat MOCK-UP;
24. sintesi pronta per SVILUPPO TEST.

## Condizioni di stop

Il prompt deve dire alla chat MOCK-UP di fermarsi se:

- il file `stato-progetto-corrente.md` non coincide con le versioni dichiarate;
- il mock-up di riferimento indicato non esiste;
- servono dati reali per proseguire;
- serve accesso post-login ma non esiste una sessione browser gia aperta;
- la richiesta implica modifiche a `index.html`, versioni ufficiali, SQL, Supabase, funzioni, scheduler, deploy o dati reali;
- emerge un impatto non previsto su TEST/PROD;
- manca una decisione necessaria per scegliere tra due alternative grafiche incompatibili.

## Regole per Admin e Assistente

Ogni prompt deve dichiarare se riguarda:

| Caso | Regola |
|---|---|
| Admin | Mock-up separato, nessuna modifica app reale |
| Assistente Partite | Mock-up separato, dati fittizi, nessun backend |
| Entrambi | Chiarire quale parte e' solo contesto e quale va prototipata |

Per l'Assistente Partite, aggiungere sempre:

- no dati reali soci;
- no accesso anonimo nei flussi reali;
- no telefono/email come rubrica libera;
- no metriche interne o giudizi personali visibili;
- no invio automatico WhatsApp/email/notifiche.

## Sessioni browser per mock-up

Ogni prompt MOCK-UP deve chiarire se la chat deve solo creare un file separato o se deve anche guardare la UI reale come riferimento visuale. Se serve UI reale post-login, usare solo una sessione gia aperta da Maurizio:

- TEST: `aprea.maurizio+codex.test@gmail.com` quando configurata e gia aperta;
- PROD: `aprea.maurizio+codex.prod@gmail.com` solo lettura/consultazione, solo come riferimento visuale non distruttivo.

La chat MOCK-UP non deve chiedere password, non deve salvare credenziali, non deve modificare dati e non deve usare comandi operativi nella web app reale. Se la sessione non esiste o e' scaduta, deve fermarsi e chiedere login manuale a Maurizio.

## Regole responsive

Ogni prompt deve chiedere alla chat MOCK-UP di considerare:

- desktop;
- larghezza stretta tipo browser laterale Codex;
- mobile se l'interfaccia e' pubblica o usata dai soci;
- nessuno scroll orizzontale inutile;
- testi e bottoni leggibili senza sovrapposizioni.

## Output richiesto alla chat MOCK-UP

Ogni prompt deve chiedere alla chat MOCK-UP di concludere con:

- file creato;
- cosa mostra;
- cosa cambia rispetto alla UI attuale;
- alternative grafiche, se presenti;
- punti da approvare;
- eventuali rischi;
- sintesi pronta per SVILUPPO TEST;
- cosa non deve essere integrato.

## Regola sui rilanci

Se Maurizio chiede:

```text
Sei sicuro che il prompt sia completo?
```

la chat RAGIONAMENTO non deve aggiungere dettagli marginali a rate.

Deve rispondere in uno dei due modi:

```text
Si', confermo: il prompt e' definitivo e non aggiungo altro.
```

oppure:

```text
No, manca un punto. Riscrivo il prompt definitivo completo.
```

Se manca qualcosa, non si aggiunge una toppa separata: si riscrive il prompt completo.

## Formula finale

Solo dopo il controllo completo, il blocco copiabile deve iniziare con:

```text
PROMPT DEFINITIVO COPIABILE PER CHAT MOCK-UP

ID PROMPT: MOCKUP-[AAAA-MM-GG]-[NNN]

REGOLA ANTI-DOPPIO:
Se questo ID PROMPT e' gia stato eseguito in questa chat, non rieseguire il prompt, non modificare file, non creare nuovi output e rispondi solo:
"Prompt gia ricevuto: nessuna azione eseguita."

Chat MOCK-UP, crea un prototipo separato per...
```

Questo segnala che il testo puo' essere copiato e incollato senza ulteriori integrazioni.

## Documenti collegati

- `docs/stato-progetto-corrente.md`
- `docs/regola-mockup-grafici.md`
- `docs/registro-versioni-sezioni.md`
- `docs/regola-id-prompt-anti-doppio.md`
- `docs/separazione-admin-assistente-partite.md`
- documento specifico della sezione coinvolta
