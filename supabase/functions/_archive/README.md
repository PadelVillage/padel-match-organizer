# `_archive/` — sorgenti conservati, NON deployati

Le cartelle qui dentro **non vengono mai deployate**: entrambi i workflow
(`deploy-edge-functions-prod.yml`, `deploy-edge-functions-test.yml`) filtrano con
`awk … $3 !~ /^_/`, lo stesso meccanismo per cui `_shared/` non è mai stata deployata.
Per rimettere in gioco una funzione bisogna spostarla fuori da `_archive/`, cioè un gesto
esplicito e visibile in diff.

Serve a un caso preciso: una funzione **viva su Supabase il cui sorgente non sta in git**.
Lasciarla fuori dal repo significa che la pipeline non è in grado di riprodurla; portarla
dentro `supabase/functions/` la deploierebbe. Qui sta tracciata senza essere deployata.

## `matchpoint-payment-write` · `matchpoint-payment-void`

Fase 2b «pagamenti in scrittura» (v6.038, giugno 2026): incasso di un giocatore e storno
del cobro su Matchpoint, via worker `/collect-payment`. **Scrivono denaro reale**, non sono
idempotenti; il backstop è il kill-switch del worker (`MATCHPOINT_PAYMENT_WRITE_ENABLED`,
default OFF).

| dove | stato |
|---|---|
| progetto TEST `cudiqnrrlbyqryrtaprd` | 🆕 **CANCELLATE il 9/08/2026** (erano `ACTIVE` v16) — vedi sotto |
| progetto PROD `qqbfphyslczzkxoncgex` | **non esistono**, e non sono mai esistite |
| git | qui, in `_archive/`: conservate e mai deployate |

### 🆕 9/08/2026 — cancellate da TEST, per sua decisione

Sono uscite allo scoperto rifacendo il censimento «chi scrive sul circolo» durante la voce del
**borsellino**: la voce diceva «7 dentro il recinto, 1 fuori», ma su TEST le funzioni fuori dal
recinto erano **tre** — queste due più `matchpoint-wallet-correct`. Vive **solo** su TEST, cioè
proprio nell'ambiente dove ci si crede al sicuro, e raggiungibili da chiunque avesse un accesso
staff di TEST: una chiamata diretta incassava o stornava **denaro vero** sul Matchpoint del circolo.

Messo davanti alla scelta (cancellarle · metterle dentro il recinto · lasciarle), ha scelto di
**cancellarle**: ⭐ togliere il buco per costruzione invece di sorvegliarlo, e non aggiungere
codice vivo per difendere codice che nessuno usa. L'app non le chiamava da nessuna parte —
in TEST i pagamenti passano dal ramo di simulazione, in PROD `PMO_PAYMENTS_WRITE_ENABLED` è
cablato a `false`.

Fatto con `delete-edge-function.yml`, `environment: test`, una funzione per volta.
📏 Verificato sul bersaglio: sparite dall'elenco di `cudi…`, e il passo «Delete su PROD» risulta
**skipped** in tutt'e due le esecuzioni.
⇒ **Il sorgente resta qui**: se un domani la scrittura pagamenti tornasse a essere una direzione,
si riparte da questi due file. La cancellazione ha tolto il *runtime*, non la memoria.

Il sorgente è stato recuperato il 19/07/2026 da uno stash locale del 30/06 che ne era
l'unica copia dal lato git; i marcatori del codice combaciano con la versione viva letta
via API. In PROD `index.html` le chiama in due punti, ma dietro `PMO_PAYMENTS_WRITE_ENABLED`
cablato a `false`: codice morto, coerente con la decisione «Matchpoint = economia unica,
Incassi in sola lettura».

Entrambe sono nella lista `VERIFY_JWT_FUNCTIONS` dei due workflow (PR #544): se un giorno
uscissero da `_archive/`, il deploy conserverebbe la verifica JWT invece di spegnerla.

✅ **Quella decisione è stata presa il 9/08/2026** (vedi sopra): la scrittura pagamenti da app
non è una direzione, le funzioni sono state cancellate dal runtime di TEST col workflow, e
questa cartella **resta** — perché serve ancora a quello per cui è nata: tenere il sorgente di
una cosa che non deve deployarsi. ⭐ Quello che è cambiato è che ora non c'è più niente di vivo
da nessuna parte a cui corrisponda.
