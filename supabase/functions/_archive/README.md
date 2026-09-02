# `_archive/` — sorgenti conservati, NON deployati

Le cartelle qui dentro **non vengono mai deployate**: entrambi i workflow
(`deploy-edge-functions-prod.yml`, `deploy-edge-functions-test.yml`) filtrano con
`awk … $3 !~ /^_/`, lo stesso meccanismo per cui `_shared/` non è mai stata deployata.
Per rimettere in gioco una funzione bisogna spostarla fuori da `_archive/`, cioè un gesto
esplicito e visibile in diff.

Serve a un caso preciso: una funzione **viva su Supabase il cui sorgente non sta in git**.
Lasciarla fuori dal repo significa che la pipeline non è in grado di riprodurla; portarla
dentro `supabase/functions/` la deploierebbe. Qui sta tracciata senza essere deployata.

## 📭 Stato al 03/09/2026: la cartella è VUOTA, e non è un errore

Le uniche due funzioni che ci hanno abitato — `matchpoint-payment-write` (incasso) e
`matchpoint-payment-void` (storno di un pagamento) — **sono uscite tutt'e due**, a un giorno di
distanza, e la cartella resta perché resta il meccanismo: il giorno in cui servirà tenere un
sorgente in git senza deployarlo, si mette qui.

| quando | cosa | dove è andata |
|---|---|---|
| 02/09/2026 | `matchpoint-payment-void` | riscritta da zero in `supabase/functions/matchpoint-payment-void/`, **v1 ACTIVE su PROD** |
| 03/09/2026 | `matchpoint-payment-write` | portata in `supabase/functions/matchpoint-payment-write/`, dentro il recinto |

## 🚨⭐⭐ Cosa ha insegnato questa cartella, ed è la parte che conta

Un sorgente in `_archive/` **esiste in git**: si legge, si apre, compare in un `grep`, e ha in
tutto e per tutto l'aspetto di una funzione che c'è. Su Supabase però non arriva mai.
⇒ Per mesi `index.html` ha chiamato `/functions/v1/matchpoint-payment-write` e
`/functions/v1/matchpoint-payment-void` senza che nessuno se ne accorgesse, perché il flag
`PMO_PAYMENTS_WRITE_ENABLED = false` impediva ai bottoni di comparire: **il 404 non è mai arrivato
a nessuno perché nessuno ha mai potuto premere**.

📌 *Il flag che nasconde un bottone è anche ciò che impedisce di accorgersi che dietro non c'è
niente: il difetto non si manifesta finché non lo si accende, cioè nel momento peggiore.*

⇒ Adesso c'è una guardia che lo dice prima, e guarda la **classe** e non i due casi:
`test/porta-che-non-ce.test.mjs` fallisce se l'app compone un indirizzo `/functions/v1/…` che non
ha un sorgente deployabile, **o** che ne ha uno qui dentro.

🩹 E la stessa guardia, il giorno in cui è nata, ha trovato una terza cosa che nessuno cercava:
`matchpoint-payment-void` era stata riscritta il 02/09 **senza togliere da qui la versione di
giugno**. Due cartelle con lo stesso nome, 157 righe contro 276, e quella archiviata era la
versione **senza recinto** — cioè chi fosse andato a leggere «il codice dello storno» avrebbe
letto quello sbagliato, nella direzione meno prudente.
📌 *Un gemello stantio è peggio di nessuna copia: chi lo trova non ha modo di sapere che non è
quello in servizio.* ⇒ Chi tira fuori una funzione da qui **toglie anche il sorgente da qui**, e
la guardia adesso lo impone.

## Perché queste due erano finite in archivio (9/08/2026)

Fase 2b «pagamenti in scrittura» (v6.038, giugno 2026): incasso di un giocatore e storno del cobro
su Matchpoint, via worker `/collect-payment` e `/void-payment`. **Scrivono denaro reale**, non sono
idempotenti; il backstop è il kill-switch del worker (`MATCHPOINT_PAYMENT_WRITE_ENABLED`).

Sono uscite allo scoperto rifacendo il censimento «chi scrive sul circolo» durante la voce del
**borsellino**: la voce diceva «7 dentro il recinto, 1 fuori», ma su TEST le funzioni fuori dal
recinto erano **tre** — queste due più `matchpoint-wallet-correct`. Vive **solo** su TEST, cioè
proprio nell'ambiente dove ci si crede al sicuro, e raggiungibili da chiunque avesse un accesso
staff di TEST: una chiamata diretta incassava o stornava **denaro vero** sul Matchpoint del circolo.

Messo davanti alla scelta (cancellarle · metterle dentro il recinto · lasciarle), ha scelto di
**cancellarle**: ⭐ togliere il buco per costruzione invece di sorvegliarlo. Fatto con
`delete-edge-function.yml`, `environment: test`, una funzione per volta.

⚖️ **E la condizione a cui sono tornate è esattamente quella che mancava allora**: non «l'incasso
non serviva», ma «non si tiene viva una scrittura di denaro fuori dal recinto». Oggi tutte e due
stanno dentro `scrittura-al-circolo.ts` — nona e decima copia — e il caso 9 di
`matchpoint-bookings-edit/scrittura-al-circolo.test.ts` verifica che il recinto stia **sulla
strada** e non solo nella cartella.
📌 *Una funzione si archivia per un difetto: riaccenderla senza aver curato quel difetto è
rimettere in servizio il difetto, non la funzione.*

Entrambe restano nella lista `VERIFY_JWT_FUNCTIONS` dei due workflow (PR #544): il deploy conserva
la verifica JWT invece di spegnerla.
