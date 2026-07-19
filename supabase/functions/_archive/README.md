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
| progetto TEST `cudiqnrrlbyqryrtaprd` | `ACTIVE`, v8, `verify_jwt: true` — deployate a mano il 29/06/2026, mai più toccate |
| progetto PROD `qqbfphyslczzkxoncgex` | **non esistono** |
| git, prima di questo commit | **non esistevano** — su nessun ramo, in tutta la storia |

Il sorgente è stato recuperato il 19/07/2026 da uno stash locale del 30/06 che ne era
l'unica copia dal lato git; i marcatori del codice combaciano con la versione viva letta
via API. In PROD `index.html` le chiama in due punti, ma dietro `PMO_PAYMENTS_WRITE_ENABLED`
cablato a `false`: codice morto, coerente con la decisione «Matchpoint = economia unica,
Incassi in sola lettura».

Entrambe sono nella lista `VERIFY_JWT_FUNCTIONS` dei due workflow (PR #544): se un giorno
uscissero da `_archive/`, il deploy conserverebbe la verifica JWT invece di spegnerla.

Prima di riesumarle, decidere se la scrittura pagamenti da app è ancora una direzione:
se non lo è, la mossa pulita è cancellarle dal progetto TEST con `delete-edge-function.yml`
e togliere anche questa cartella.
