# Procedura catena MOCK-UP -> SVILUPPO TEST -> PROMOZIONE PROD

Data: 2026-05-17

Titolo breve: `Catena guidata mockup sviluppo prod`

## Obiettivo

Definire una procedura operativa per far avanzare una modifica approvata dal mock-up fino alla preparazione della promozione PROD, riducendo passaggi manuali ripetitivi ma mantenendo i controlli necessari su app reale, dati, Supabase, scheduler, routine e deploy.

La procedura non sostituisce le regole esistenti:

- `docs/stato-progetto-corrente.md`
- `docs/regola-mockup-grafici.md`
- `docs/regola-prompt-mockup-definitivi.md`
- `docs/prompt-definitivi-sviluppo-test.md`
- `docs/regola-id-prompt-anti-doppio.md`
- `docs/pmo-policy-test-prod-routine-deploy.md`
- `docs/procedura-deploy-test-prod.md`

## Principio

La catena puo essere guidata e standardizzata, ma non deve diventare un automatismo cieco.

Si possono automatizzare:

- generazione mock-up navigabile;
- verifica visuale del mock-up;
- prompt definitivo per SVILUPPO TEST;
- integrazione in TEST;
- test browser in TEST;
- preparazione del prompt per PROMOZIONE PROD;
- preflight PROD;
- test post-deploy PROD;
- report finale.

Non si devono automatizzare senza conferma esplicita:

- approvazione del mock-up;
- modifica della web app reale;
- promozione PROD;
- attivazione scheduler o routine automatiche PROD;
- modifiche a Supabase PROD, SQL, Edge Function, segreti o dati reali;
- invii reali verso soci;
- rollback PROD.

## Sessioni browser nella catena

La catena puo usare il browser solo con sessioni gia aperte da Maurizio. Nessuna chat deve chiedere, scrivere o salvare password.

Regole per fase:

- MOCK-UP: puo guardare la UI reale solo come riferimento visuale, senza modificare dati e senza azioni operative; il mock-up finale resta un file separato in `mockup/` con dati simulati.
- SVILUPPO TEST Admin: puo usare la sessione TEST `aprea.maurizio+codex.test@gmail.com` per verifiche post-login della versione TEST, rispettando i permessi TEST.
- Promuovi PROD Admin: puo usare la sessione PROD `aprea.maurizio+codex.prod@gmail.com` solo per smoke test non distruttivi, con ruolo `Solo lettura` / `Solo consultazione`.

Se una sessione e' assente o scaduta, la chat deve fermarsi e chiedere login manuale a Maurizio.

Gli handoff devono indicare se serve una verifica browser post-login, su quale ambiente e con quali limiti.

## Comando di benestare dal MOCK-UP

Quando Maurizio ha verificato il mock-up e vuole avviare la catena guidata, deve usare una formula esplicita.

Formula breve:

```text
APPROVO CATENA
```

Questo comando equivale a:

```text
Mockup approvato. Autorizzo la catena guidata fino alla preparazione di PROMOZIONE PROD, senza deploy PROD automatico.
```

Il comando autorizza la chat MOCK-UP a produrre un prompt completo per SVILUPPO TEST Admin e a impostare il passaggio successivo.

Questo comando non autorizza:

- deploy PROD;
- comando `PROMUOVI PROD`;
- attivazione scheduler PROD;
- invii automatici verso soci;
- modifiche dirette a Supabase PROD;
- rollback.

Per pubblicare in PROD serve sempre il comando separato:

```text
PROMUOVI PROD
```

## ID prompt anti-doppio

Ogni prompt operativo e ogni file handoff della catena deve contenere un `ID PROMPT` univoco e la `REGOLA ANTI-DOPPIO`, come definito in:

```text
docs/regola-id-prompt-anti-doppio.md
```

Se una chat riceve due volte lo stesso `ID PROMPT`, deve rispondere solo:

```text
Prompt gia ricevuto: nessuna azione eseguita.
```

## Handoff temporanei locali

La chat che prepara il passaggio alla chat successiva deve creare un file handoff locale temporaneo, cosi' Maurizio non deve copiare prompt lunghi tra chat.

Cartella locale:

```text
/Users/maurizioaprea/Downloads/Padel Match Organizer/lavoro-codex/handoff/
```

File standard:

| Passaggio | File handoff | Comando breve nella chat successiva |
|---|---|---|
| MOCK-UP -> SVILUPPO TEST Admin | `sviluppo-test-admin.md` | `LEGGI HANDOFF TEST` |
| SVILUPPO TEST Admin -> Promuovi PROD Admin | `promuovi-prod-admin.md` | `LEGGI HANDOFF PROD` |

Regole:

- i file handoff restano solo in locale;
- non vanno committati;
- non vanno copiati in `docs/`;
- non vanno inseriti nel repo;
- non devono contenere segreti, password, service role key o credenziali;
- devono contenere solo istruzioni operative, percorsi, versioni, commit, test richiesti e vincoli;
- devono contenere `ID PROMPT` e `REGOLA ANTI-DOPPIO`;
- ogni file handoff deve indicare quale chat lo deve leggere;
- la chat successiva deve leggere il file e poi confermare se il contenuto e' sufficiente o se serve chiarimento.

## Pulizia handoff

Per evitare accumulo di file locali, si usano nomi fissi e non timestamp.

Regole di pulizia:

- prima di creare un nuovo handoff dello stesso tipo, la chat deve verificare se esiste gia' un file precedente;
- se il file precedente risulta gia preso in carico dalla chat successiva, puo essere sostituito;
- se non e' chiaro se sia stato preso in carico, la chat deve fermarsi e chiedere conferma;
- dopo che SVILUPPO TEST ha preso in carico `sviluppo-test-admin.md`, quel file puo essere cancellato o sovrascritto al prossimo handoff TEST;
- dopo che Promuovi PROD ha preso in carico `promuovi-prod-admin.md`, quel file puo essere cancellato o sovrascritto al prossimo handoff PROD;
- nessuna chat deve creare copie infinite tipo `handoff-1`, `handoff-2`, `handoff-finale`, `handoff-definitivo`;
- se serve conservare una consegna per storico, la sintesi stabile deve finire nei documenti condivisi corretti, non nella cartella handoff.

La cartella `lavoro-codex/handoff/` e' quindi solo una cassetta temporanea di passaggio, non un archivio.

## Responsabilita delle chat

| Chat | Responsabilita | Deve fermarsi quando |
|---|---|---|
| RAGIONAMENTO | Definisce requisito, flusso, rischi, dati, TEST/PROD e brief per MOCK-UP | requisito ambiguo, impatto dati non chiaro, mancano regole operative |
| MOCK-UP | Crea solo mock-up separati e prompt definitivo per SVILUPPO TEST | mock-up non approvato, elementi visivi ambigui, esempi non rimossi, interazioni non censite |
| SVILUPPO TEST Admin | Integra solo in TEST il mock-up approvato, testa e prepara prompt per Promuovi PROD Admin | test falliti, diff fuori perimetro, impatto Supabase/SQL/scheduler non previsto |
| Promuovi PROD Admin | Esegue solo preflight e promozione di versioni TEST validate | alert deploy, scheduler non certificato, Edge Function non compatibile, diff imprevisto |

## Controllo umano sul mock-up

Il punto piu delicato della catena e' il mock-up.

Prima di dare il benestare, Maurizio deve verificare che il mock-up sia pulito:

- nessun testo finto rimasto per errore;
- nessun esempio che potrebbe essere copiato nell'app reale;
- bottoni coerenti con il flusso reale;
- dati simulati chiaramente fittizi;
- nessuna azione che sembri automatica se deve essere manuale;
- nessun riferimento improprio a PROD, Supabase, Matchpoint, Gmail o dati reali;
- stati UI completi: normale, vuoto, errore, caricamento, conferma, disabilitato, warning;
- filtri, badge, azioni e righe tabella coerenti con l'uso quotidiano dello staff;
- testi semplici e non tecnici;
- nessuna modifica grafica non richiesta.

Se il mock-up contiene ancora elementi dimostrativi o dubbi, non va dato il benestare alla catena.

## Errori attesi e rischio residuo

Non esiste garanzia 100%.

La catena riduce gli errori, ma non li elimina. I rischi piu probabili sono:

| Fase | Rischio | Mitigazione |
|---|---|---|
| MOCK-UP | esempi o placeholder copiati nel prompt sviluppo | controllo umano prima del benestare |
| MOCK-UP | bottone visuale non censito come interattivo | checklist `prompt-definitivi-sviluppo-test.md` |
| SVILUPPO TEST | integrazione che rompe filtri, conteggi o rerender esistenti | test browser e verifica regressioni |
| SVILUPPO TEST | modifica piu ampia del necessario | patch minima e diff review |
| Edge Function | UI TEST usa azioni non presenti in PROD | controllo compatibilita app/funzione |
| Supabase | scheduler o cron PROD non certificato | preflight seriale `cron.job` |
| PROD | deploy pubblicato in orario sbagliato o con staff operativo | finestra serale e comando esplicito |
| Documentazione | decisione valida resta solo in chat | aggiornamento documenti condivisi |

Se una fase produce alert, la catena si interrompe. Non si prosegue per inerzia.

## Flusso operativo standard

### 1. RAGIONAMENTO

Output richiesto:

- brief per MOCK-UP;
- obiettivo operativo;
- dati coinvolti;
- impatto TEST/PROD;
- rischi;
- test da fare;
- cosa non modificare;
- vincoli su Supabase, Matchpoint, routine, import/export e messaggi ai soci.

### 2. MOCK-UP

Output richiesto:

- file mock-up in `mockup/`;
- sintesi di cosa mostra;
- cosa cambia rispetto alla UI attuale;
- alternative grafiche;
- punti da approvare;
- elenco degli elementi interattivi;
- prompt definitivo per SVILUPPO TEST Admin.

La chat MOCK-UP puo avviare la preparazione del prompt per SVILUPPO TEST solo dopo approvazione chiara.

### 3. SVILUPPO TEST Admin

Output richiesto:

- versione TEST creata;
- commit;
- file modificati;
- cosa e' cambiato;
- cosa e' rimasto invariato;
- test tecnici;
- test browser;
- impatto su Supabase, SQL, Edge Function, scheduler, Matchpoint, dati reali e PROD;
- documenti aggiornati;
- prompt completo per Promuovi PROD Admin.

SVILUPPO TEST non promuove PROD.

### 4. Promuovi PROD Admin

Output richiesto prima del deploy:

- versione TEST da promuovere;
- versione PROD corrente;
- commit rollback;
- diff TEST -> PROD;
- compatibilita Edge Function;
- stato scheduler PROD;
- impatto su SQL, segreti, dati reali, Matchpoint, routine e comunicazioni;
- alert eventuali;
- richiesta esplicita del comando `PROMUOVI PROD`.

Output richiesto dopo il deploy:

- versione PROD pubblicata;
- commit;
- verifica raw GitHub;
- test browser PROD;
- stato Supabase/cron/routine;
- documentazione aggiornata;
- report finale.

## Regola sui comandi espliciti

Il benestare dato in MOCK-UP non vale come `PROMUOVI PROD`.

Sono comandi diversi:

| Comando | Effetto |
|---|---|
| `APPROVO CATENA` | avvia passaggio MOCK-UP -> SVILUPPO TEST -> preparazione PROMOZIONE PROD |
| `LEGGI HANDOFF TEST` | chiede a SVILUPPO TEST Admin di leggere il file locale `sviluppo-test-admin.md` |
| `LEGGI HANDOFF PROD` | chiede a Promuovi PROD Admin di leggere il file locale `promuovi-prod-admin.md` |
| `PROMUOVI PROD` | autorizza la promozione PROD, solo dopo preflight pulito |
| `ROLLBACK PROD` | autorizza rollback alla versione stabile precedente |

## Regola finale

La catena deve velocizzare il lavoro, non ridurre i controlli.

Se il mock-up non e' pulito, la catena non parte.

Se TEST non e' verificato, non si prepara PROD.

Se il preflight PROD non e' pulito, non si chiede `PROMUOVI PROD`.

Se PROD ha un problema dopo deploy, si usa la procedura di rollback e si corregge poi in TEST.
