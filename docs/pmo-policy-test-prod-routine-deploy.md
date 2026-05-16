# Padel Match Organizer - Policy TEST/PROD per routine e deploy

Documento di riferimento per separare in modo sicuro gli ambienti TEST e PROD del progetto Padel Match Organizer.

Data: 2026-05-15
Chat: RAGIONAMENTO
Destinatari: Chat SVILUPPO TEST e Chat PROMOZIONE PROD
Titolo breve: `Policy TEST/PROD routine e deploy`
Ultimo aggiornamento regole workspace: 2026-05-16

## Stato progetto al momento della definizione

- TEST pubblicato: v5.423
- PROD pubblicato: v5.422
- TEST sviluppo: v5.423
- Commit app pubblicata: 6549f18
- Documento stato letto: `docs/stato-progetto-corrente.md`
- Documenti collegati letti:
  - `docs/ambienti-test-prod.md`
  - `docs/procedura-deploy-test-prod.md`
  - `docs/autovalutazioni-email-routine.md`
  - `docs/routine-dati-automatiche.md`
  - `docs/matchpoint.md`
  - `docs/supabase-data-api-regole.md`
  - `docs/regola-mockup-grafici.md`

## Fonti ufficiali e ordine di lettura

Questa policy e' la fonte centrale per le regole TEST/PROD, routine, comunicazioni, dati e promozione.

Se due documenti non coincidono:

| Informazione | Fonte piu affidabile |
|---|---|
| Versioni correnti, commit, branch, link e ultimo lavoro pubblicato | `docs/stato-progetto-corrente.md` |
| Regole operative TEST/PROD, routine, dati, comunicazioni e comandi | `docs/pmo-policy-test-prod-routine-deploy.md` |
| Passi tecnici di promozione, preflight, rollback e controlli Git/Supabase | `docs/procedura-deploy-test-prod.md` |
| Configurazione ambienti, project ref Supabase, config TEST/PROD | `docs/ambienti-test-prod.md` |
| Dettagli funzionali della sezione lavorata | Documento area specifico |

Lettura minima per la chat SVILUPPO TEST:

1. `docs/stato-progetto-corrente.md`
2. `docs/pmo-policy-test-prod-routine-deploy.md`
3. `docs/ambienti-test-prod.md`
4. `docs/registro-versioni-sezioni.md`
5. documento della sezione su cui deve lavorare.

Lettura minima per la chat PROMOZIONE PROD:

1. `docs/stato-progetto-corrente.md`
2. `docs/pmo-policy-test-prod-routine-deploy.md`
3. `docs/procedura-deploy-test-prod.md`
4. `docs/ambienti-test-prod.md`
5. `docs/registro-versioni-sezioni.md`
6. documenti delle sezioni toccate dalla versione da promuovere.


## Regola aggiornamento documentazione condivisa

Le decisioni validate non devono restare solo nella cronologia di una singola chat.

Se una chat del progetto produce una modifica, decisione o regola validata che impatta:

- flussi operativi;
- UI o mock-up approvati;
- sviluppo TEST;
- promozione PROD;
- rollback;
- routine;
- Supabase;
- Matchpoint;
- dati reali;
- import/export;
- comunicazioni verso soci;
- regole TEST/PROD;
- procedure operative condivise;

allora la chat deve verificare quali documenti condivisi devono essere aggiornati.

Documenti da considerare:

- `docs/stato-progetto-corrente.md`;
- `docs/registro-versioni-sezioni.md`;
- `docs/pmo-policy-test-prod-routine-deploy.md`;
- `docs/procedura-deploy-test-prod.md`;
- `docs/ambienti-test-prod.md`;
- `docs/regola-mockup-grafici.md`;
- documento specifico della sezione coinvolta.

Regola pratica:

- RAGIONAMENTO aggiorna o prepara aggiornamenti documentali per requisiti, decisioni, piani e policy.
- MOCK-UP aggiorna o prepara consegne documentali solo per mock-up approvati e regole grafiche validate.
- SVILUPPO TEST aggiorna la documentazione quando integra modifiche validate in TEST.
- PROMOZIONE PROD aggiorna la documentazione quando cambia versione PROD, rollback, deploy, stato scheduler o stato reale degli ambienti.

Nessuna regola condivisa deve vivere solo dentro una chat. Se una decisione diventa valida per il progetto, deve essere riportata nei documenti corretti.

Se la chat non e' autorizzata a modificare direttamente quel documento, deve almeno produrre un testo preciso da passare alla chat autorizzata.

## Obiettivo

Ridurre gli errori nel passaggio tra TEST e PROD, soprattutto dove sono coinvolti dati reali, Supabase, Matchpoint, scheduler, routine automatiche ed eventuali comunicazioni verso soci.

La regola centrale e':

**TEST serve a provare senza effetti reali. PROD serve a lavorare con dati e utenti reali.**

## Struttura chat consigliata

| Chat | Ruolo | Regola |
|---|---|---|
| RAGIONAMENTO | Definisce requisiti, rischi, priorita' e piani | Non modifica codice |
| MOCK-UP | Crea prototipi separati approvabili | Non modifica app principale |
| SVILUPPO TEST | Implementa e corregge solo in TEST | Non promuove in PROD |
| PROMOZIONE PROD | Porta in PROD solo versioni TEST validate | Non sviluppa nuove funzioni |

## Regola fondamentale

Su PROD non si sviluppa nulla.

| Ambiente | Uso corretto |
|---|---|
| TEST | Sviluppo, bugfix, prove, collaudi, mock-up integrati |
| PROD | Solo promozione di versioni validate |
| PROD hotfix | Solo emergenza documentata, poi riallineamento su TEST |

Se durante una promozione PROD emerge un problema, la chat PROMOZIONE PROD deve fermarsi e tornare a SVILUPPO TEST, salvo rollback immediato a versione stabile precedente.

## Regola workspace e strumenti di promozione

La promozione PROD deve usare strumenti e workspace separati dal lavoro quotidiano.

Regole obbligatorie:

- PROD si promuove solo da workspace pulito derivato dai remoti aggiornati.
- La repo principale sporca non si usa per deploy, merge o push PROD.
- I branch locali vecchi non sono fonte affidabile finche' non sono stati verificati contro i remoti.
- Supabase CLI non va eseguita dentro il worktree Git di promozione, perche' puo creare `supabase/.temp/` anche durante controlli apparentemente read-only.
- I controlli Supabase PROD sono seriali, non paralleli.
- Se scheduler PROD o compatibilita Edge Function non sono certificati, la promozione e' bloccata.
- Se la UI TEST richiede azioni Edge Function non presenti nella funzione PROD live, prima serve deploy controllato della sola funzione PROD, mantenendo `verify_jwt=true` salvo autorizzazione separata.
- La documentazione condivisa deve essere aggiornata subito quando una regola di processo viene validata o quando cambia lo stato reale di PROD.

Queste regole sono dettagliate nella sezione `Pipeline tecnica obbligatoria di promozione PROD` di `docs/procedura-deploy-test-prod.md`.

## Regole routine TEST/PROD

| Area | TEST | PROD |
|---|---|---|
| Routine | Solo manuali o job una tantum autorizzati | Automatiche solo se gia' approvate |
| Scheduler | Nessun cron generale attivo salvo autorizzazione esplicita | Solo cron documentati e approvati |
| Email verso soci | Mai verso soci reali: destinatario forzato a `aprea.maurizio@gmail.com` | Verso utenti reali solo se routine approvata |
| WhatsApp | Solo preparazione/apertura manuale | Solo manuale, salvo decisione futura esplicita |
| Dati Matchpoint | Import manuali controllati | Routine automatiche gia' approvate |
| Supabase | Progetto TEST, dati controllati | Progetto PROD, dati reali |
| Log | Devono indicare chiaramente `TEST` | Devono indicare chiaramente `PROD` |
| Oggetti email | Prefisso `[TEST]` quando possibile | Nessun prefisso test |
| Link pubblici | Non da distribuire ai soci | Link reali utilizzabili dai soci |

## Regola dati TEST/PROD

TEST e PROD non devono usare lo stesso dato vivo.

PROD e' la fonte ufficiale operativa. TEST e' una sandbox separata, che puo' usare copie realistiche o riallineamenti controllati, ma non deve condividere scritture o stato vivo con PROD.

| Tipo dati | TEST | PROD |
|---|---|---|
| Anagrafica soci | Copia separata o riallineamento controllato, su Supabase/localStorage TEST | Fonte reale operativa |
| Dati soci modificati dallo staff | Modifiche valide solo in TEST | Modifiche reali operative |
| Import clienti Matchpoint | Manuale o copia controllata dell'ultimo dato valido | Automatico/operativo se approvato |
| Storico Matchpoint | Copia o import controllato, mai scheduler parallelo non autorizzato | Storico ufficiale operativo |
| Prenotazioni future Matchpoint | Copia o refresh manuale controllato | Fotografia reale operativa |
| Autovalutazione | Token, invii, risposte, storico e livelli separati/protetti | Token, invii, risposte, storico e livelli reali |
| Email Autovalutazione | Solo destinatario protetto `aprea.maurizio@gmail.com` | Soci reali solo se routine approvata |
| Matchpoint reale | Nessuna scrittura/modifica reale da TEST | Gestione reale secondo procedure approvate |

Regole operative:

- TEST puo' usare dati realistici per collaudo, ma come copia separata.
- TEST non deve mai scrivere su Supabase PROD.
- TEST non deve mai aggiornare dati reali PROD o Matchpoint reale.
- Le copie da PROD/Matchpoint verso TEST devono essere esplicite, controllate e documentate.
- Un dato lavorato in TEST non diventa reale finche' non viene promosso con procedura approvata o reinserito nel flusso PROD previsto.
- Autovalutazione TEST e Autovalutazione PROD devono restare separate: token, log, risposte email, storico e stati Matchpoint non vanno condivisi come dato vivo.
- Se una verifica richiede la stessa base dati tra TEST e PROD, usare riallineamento controllato e dichiararlo prima.

## Regola di preservazione PROD

La modalita' manuale di TEST non deve mai alterare le routine automatiche gia' approvate in PROD.

Quando una versione viene promossa da TEST a PROD:

- non si copia lo stato scheduler di TEST su PROD;
- non si disattivano cron PROD gia' approvati;
- non si cambiano orari, secret, funzioni o dispatcher PROD salvo richiesta esplicita;
- non si attivano nuove routine PROD solo perche' esistono in TEST;
- si preserva la configurazione automatica PROD gia' documentata.

In altre parole:

```text
TEST manuale = regola dell'ambiente TEST.
PROD automatico approvato = regola dell'ambiente PROD.
Il deploy dell'app non deve trasformare PROD in manuale e non deve spegnere gli automatici PROD esistenti.
```

Ogni promozione deve quindi distinguere:

| Caso | Comportamento corretto |
|---|---|
| Routine PROD gia' approvata e attiva | Deve restare attiva |
| Routine TEST manuale | Resta manuale in TEST, non viene copiata come stato PROD |
| Nuova routine sviluppata in TEST | Resta spenta in PROD finche' non autorizzata |
| Modifica esplicita a routine PROD | Richiede conferma separata e documentazione |

## Regola TEST sulle comunicazioni

In ambiente TEST ogni routine che invia comunicazioni deve neutralizzare i destinatari reali.

Regola server-side obbligatoria:

```text
Se ambiente = TEST:
- ignorare l'email reale del socio;
- inviare solo a aprea.maurizio@gmail.com;
- aggiungere prefisso [TEST] nell'oggetto quando applicabile;
- registrare nei log che il destinatario reale e' stato sostituito.
```

Questa protezione deve stare lato backend/funzione, non solo nella UI.

## Regola PROD sulle comunicazioni

In PROD gli invii verso utenti reali sono consentiti solo se:

- la routine e' stata validata in TEST;
- la routine e' documentata;
- l'utente ha autorizzato esplicitamente l'attivazione;
- esiste un modo chiaro per spegnerla;
- la prima esecuzione PROD e' controllata o monitorata.

### Regola PROD Autovalutazione email

Per la routine email Autovalutazione, l'autorizzazione PROD riguarda l'attivazione della routine reale, non ogni singolo richiamo.

Regola approvata:

- il primo invio del ciclo viene avviato dallo staff con controllo manuale del lotto;
- dopo il primo invio, il socio entra automaticamente nel ciclo di follow-up PROD;
- secondo e terzo richiamo non richiedono una nuova approvazione staff;
- prima di ogni richiamo automatico la routine deve controllare scheda compilata tramite token, risposta email ricevuta, mancata consegna/bounce, pausa o problema operativo;
- se il socio compila la scheda, il ciclo email si ferma e passa a `Post-invio`;
- se il socio risponde via email, i richiami si sospendono e il caso passa allo staff;
- se c'e' mancata consegna, il caso va in `Problemi` e non partono altri richiami automatici;
- se non ci sono stop, il secondo richiamo parte dopo 2 giorni dal primo invio e il terzo dopo altri 2 giorni;
- dopo il terzo richiamo senza esito non partono altre email automatiche: recupero manuale staff;
- dopo applicazione/validazione livello, parte la mail di conferma livello validato e il giro va nello storico.

Questa regola deve essere inclusa nel pacchetto PROMOZIONE PROD quando l'Autovalutazione email viene promossa o quando viene attivato/modificato lo scheduler email PROD.

## Regola routine dati Matchpoint

Le routine dati Matchpoint sono diverse dalle routine email.

| Routine | TEST | PROD |
|---|---|---|
| Clienti Matchpoint | Manuale o test controllato | Automatica se gia' approvata |
| Storico Matchpoint | Manuale o test controllato | Automatica se gia' approvata |
| Prenotazioni future Matchpoint | Manuale o test controllato | Automatica se gia' approvata |
| Backup cloud | Separato per ambiente | Automatico/documentato se approvato |

Regola importante:

**Non tenere scheduler Matchpoint automatici attivi contemporaneamente in TEST e PROD sullo stesso account/servizio.**

Motivi:

- evitare doppie chiamate allo stesso account Matchpoint;
- evitare log confusi;
- evitare diagnosi non distinguibili;
- evitare carichi o blocchi non necessari.

## Nuove automazioni

Nessuna nuova automazione nasce attiva in PROD.

| Fase | Stato routine |
|---|---|
| Sviluppo TEST | Manuale |
| Collaudo TEST | Manuale, destinatario protetto se comunica |
| Approvazione utente | Obbligatoria |
| Primo PROD | Primo invio controllato dallo staff; scheduler attivo solo se previsto e autorizzato |
| PROD stabile | Follow-up automatici secondo regole documentate, con controlli stop prima di ogni richiamo |

## Comandi operativi

La chat PROMOZIONE PROD deve agire solo con comandi espliciti.

| Comando | Significato |
|---|---|
| `PROMUOVI PROD` | Autorizza la promozione della versione TEST validata in PROD |
| `ROLLBACK PROD` | Autorizza il ritorno immediato alla versione PROD precedente |

Senza questi comandi, la chat PROMOZIONE PROD non deve pubblicare, attivare scheduler o fare rollback.

## Alert e blocchi durante il deploy

Il comando `PROMUOVI PROD` autorizza la promozione solo se i controlli preflight sono puliti.

Se durante il controllo TEST -> PROD emerge qualcosa che non torna, la chat PROMOZIONE PROD deve fermarsi e mostrare un alert esplicito.

Alert bloccanti:

| Alert | Regola |
|---|---|
| File inattesi nel diff | Fermarsi |
| Sezione protetta modificata senza richiesta | Fermarsi |
| Scheduler PROD approvato modificato o rimosso | Fermarsi |
| Scheduler TEST generale ancora attivo | Fermarsi |
| Nuova routine PROD attiva senza autorizzazione | Fermarsi |
| Email TEST non forzata a `aprea.maurizio@gmail.com` | Fermarsi |
| Email PROD nuova/modificata senza approvazione | Fermarsi |
| WhatsApp automatico | Fermarsi |
| Supabase PROD coinvolto senza piano | Fermarsi |
| Matchpoint PROD coinvolto senza piano | Fermarsi |
| Rollback non pronto | Fermarsi |
| Test non eseguiti o risultato incerto | Fermarsi e dichiarare rischio |

Formato alert obbligatorio:

```text
ALERT DEPLOY:
- cosa non torna;
- rischio concreto;
- opzioni:
  1. correggere in TEST;
  2. annullare la promozione;
  3. continuare solo con autorizzazione esplicita.
```

Se compare un alert dopo il comando `PROMUOVI PROD`, il comando non vale piu' come autorizzazione sufficiente. Serve una nuova conferma testuale specifica sul rischio emerso.

## Finestra deploy PROD

Le promozioni PROD devono avvenire solo in finestra di basso utilizzo, preferibilmente la sera, quando lo staff non usa l'app.

Regole:

- non promuovere PROD durante l'uso operativo dello staff;
- non promuovere se subito dopo non e' possibile fare un controllo;
- non promuovere se ci sono correzioni TEST ancora aperte;
- non promuovere se non e' pronto il rollback.

## Procedura promozione PROD

Prima di promuovere, la chat PROMOZIONE PROD deve dichiarare:

```text
Versione PROD attuale:
- versione
- commit

Versione TEST da promuovere:
- versione
- commit

Rollback pronto verso:
- versione precedente
- commit precedente

Impatto routine:
- Scheduler nuovi: si/no
- Scheduler modificati: si/no
- Scheduler PROD gia' approvati preservati: si/no
- Email automatiche: si/no
- Matchpoint automatico: si/no
- Dati reali coinvolti: si/no
- Rollback pronto: si/no

Alert preflight:
- Alert bloccanti presenti: si/no
- Se si', elenco alert e decisione richiesta

Attendo conferma: PROMUOVI PROD
```

## Smoke test post-PROD

Dopo la promozione, verificare almeno:

| Area | Verifica |
|---|---|
| App | Link PROD carica correttamente |
| Login staff | Accesso ok |
| Database soci | Lista e ricerca funzionano |
| Autovalutazione | Cruscotto apre senza errori |
| DATI | Routine/scheduler coerenti con quanto dichiarato |
| Matchpoint | Nessuna automazione nuova attivata per errore |
| WhatsApp | Nessun invio automatico |
| Supabase | Cron PROD approvati ancora presenti e invariati salvo autorizzazione |
| Console browser | Nessun errore bloccante evidente |

Se il bug e' grave:

1. non correggere direttamente in PROD;
2. eseguire rollback con comando `ROLLBACK PROD`;
3. tornare in SVILUPPO TEST;
4. correggere in TEST;
5. rivalidare;
6. ripetere la promozione.

## Rollback

Ogni promozione PROD deve avere un rollback pronto alla versione precedente stabile.

Il rollback non e' una nuova correzione: e' solo il ritorno al commit/versione PROD precedente.

Regola:

**Se PROD non funziona dopo il deploy, si torna alla versione precedente. Le correzioni si fanno poi in TEST.**

## Differenze visive consigliate

| Elemento | TEST | PROD |
|---|---|---|
| Banner ambiente | `AMBIENTE TEST - nessun invio reale` | Standard o `PROD` discreto |
| Colore ambiente | Bordo/arancione o giallo | Blu standard |
| Oggetto email | `[TEST] ...` | Oggetto normale |
| Cruscotti routine | Mostrano stato `manuale` | Mostrano orari automatici reali |

## Cose da non fare

- Non sviluppare direttamente in PROD.
- Non attivare nuove routine PROD durante una promozione se non previste.
- Non lasciare scheduler TEST attivi per errore.
- Non inviare email TEST a soci reali.
- Non fare fix veloci in PROD dopo un bug: usare rollback o tornare a TEST.
- Non promuovere PROD senza sapere versione e commit di rollback.
- Non fare deploy PROD durante l'orario operativo dello staff.

## Sintesi finale

La policy corretta e':

```text
TEST = sviluppo manuale, protetto, senza effetti reali sui soci.
PROD = ambiente reale, automatico solo dove gia' approvato.
PROMOZIONE PROD = nessuna nuova funzione, solo passaggio controllato.
ROLLBACK = sempre pronto prima di ogni deploy.
```
