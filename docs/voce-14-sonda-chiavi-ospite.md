# Voce 14 — la sonda delle chiavi «Ospite»

**La voce è CHIUSA il 16/08/2026 dichiarando**, non eseguendo: il fenomeno è misurato **benigno**,
e togliere il nome dalla chiave è stato valutato e **non fatto**. Questo file esiste per una sola
ragione — **la sonda deve sopravvivere alla voce**. Se un domani il fenomeno smette di essere
benigno, qui c'è come accorgersene senza rifare l'indagine da capo.

📌 Sostituisce `fp_hot`, che **non è mai esistita nel repo** (`git log -S`: nessuna traccia in tutta
la storia) — stava nelle memorie andate in pensione il 13/08 ed è irrecuperabile.

## Il fatto, in una riga

La chiave dell'occupazione **contiene il nome del giocatore**:

```
occupancy|<idReserva>|<data>|<ora>|<campo>|<nome>|<durata>
```

Un posto occupato da «Ospite» che poi prende un nome vero **non aggiorna** la riga: ne genera una
**nuova** e lascia una lapide sulla vecchia. ⇒ Non è un guasto, **è il progetto della chiave**:
l'oscillazione è ciò che succede ogni volta che lo staff sostituisce un ospite con un socio, cioè
una cosa che *deve* succedere. Il costo è **una lapide per sostituzione**.

## La sonda (sola lettura, gira su `qqbf…` e su `cudi…`)

```sql
with o as (
  select local_key, deleted, updated_at,
         split_part(local_key,'|',2) as idreserva, split_part(local_key,'|',3) as data,
         split_part(local_key,'|',4) as ora,       split_part(local_key,'|',5) as campo,
         split_part(local_key,'|',6) as nome
  from pmo_cloud_records where record_type = 'booking_occupancy'
), slot as (
  select idreserva, data, ora, campo,
         count(*) filter (where nome ilike 'ospite')     as come_ospite,
         count(*) filter (where nome not ilike 'ospite') as con_nome,
         bool_and(deleted) as tutte_cancellate
  from o group by 1,2,3,4
)
select (select count(*) from o    where nome ilike 'ospite')                     as righe_ospite,
       (select count(*) from o    where nome ilike 'ospite' and not deleted)     as ancora_vive,
       (select count(*) from slot where come_ospite > 0)                         as slot_con_ospite,
       (select count(*) from slot where come_ospite > 0 and con_nome > 0)        as slot_oscillanti,
       (select count(*) from slot where come_ospite > 0 and con_nome > 0
                                    and not tutte_cancellate)                    as oscillanti_vivi;
```

🚨 **I due numeri che contano sono `ancora_vive` e `oscillanti_vivi`.** Finché restano **0** il
fenomeno è rumore contabile e la voce resta chiusa. Il giorno che uno dei due sale, allora sì c'è
una riga che **non si chiude** — e quella è una voce nuova, non questa.

## Il controllo negativo — da fare PRIMA di credere a uno zero

⚠️ Uno zero non è un esito finché non si è verificato che la sonda **guardi nel cassetto giusto** e
**dopo** che il fatto poteva accadere. È la lezione della 24ª sessione, pagata cinque volte in un
giorno. Prima di concludere «`ancora_vive` = 0, tutto bene», chiedere alla sonda se sa vedere
*qualcosa*:

```sql
with o as (
  select local_key, deleted, updated_at, split_part(local_key,'|',6) as nome
  from pmo_cloud_records where record_type = 'booking_occupancy'
)
select
  (select max(updated_at) from o)                                          as ultima_riga_occupancy,
  (select max(updated_at) from o where nome ilike 'ospite')                 as ultima_riga_ospite,
  (select count(*) from o where updated_at >= now() - interval '24 hours')  as occupancy_ultime_24h,
  now()                                                                     as adesso;
```

Se `ultima_riga_occupancy` è vecchia di ore, **non è il fenomeno a essersi fermato: è il sync**, e
lo zero non dice niente. Su `cudi…` questo è lo stato *normale* — il calendario di TEST era una
fotografia ferma al 7 agosto fino alla voce 34.

## La serie storica: perché non servono «tre sonde a distanza di ore»

La scheda vecchia chiedeva tre campionamenti diffati. **Non servono**: `updated_at` **è già** la
serie storica, e copre mesi invece di ore — una prova più forte di quella chiesta, e che non va
aspettata.

```sql
select date_trunc('week', updated_at)::date as settimana,
       count(*) as righe_ospite_toccate,
       count(*) filter (where not deleted) as di_cui_vive
from pmo_cloud_records
where record_type = 'booking_occupancy'
  and split_part(local_key,'|',6) ilike 'ospite'
group by 1 order by 1;
```

## La misura alla chiusura — PROD (`qqbf…`), 16/08/2026 08:47 UTC

| | |
|---|---|
| `righe_ospite` | **571** (su **3904** righe di occupazione totali ⇒ **15%** della tabella) |
| `ancora_vive` | **0** |
| `slot_con_ospite` | **568** |
| `slot_oscillanti` | **438** — gli slot in cui la sostituzione è avvenuta davvero |
| `oscillanti_vivi` | **0** |

I restanti **130** slot sono ospiti rimasti ospiti: non oscillano, non costano niente.

**La serie settimanale, 15 settimane di fila** — `di_cui_vive` è **0 in OGNI settimana**:

| settimana | righe toccate | di cui vive |
|---|---|---|
| 04/05 | 11 | 0 |
| 11/05 | 54 | 0 |
| 18/05 | 49 | 0 |
| 25/05 | 30 | 0 |
| 01/06 | 37 | 0 |
| 08/06 | 46 | 0 |
| 15/06 | 53 | 0 |
| 22/06 | 54 | 0 |
| 29/06 | 45 | 0 |
| 06/07 | 28 | 0 |
| 13/07 | 35 | 0 |
| 20/07 | 42 | 0 |
| 27/07 | 31 | 0 |
| 03/08 | 25 | 0 |
| 10/08 | 31 | 0 |

⚖️ **È questa colonna a chiudere la voce, non il totale.** «0 vive oggi» è una fotografia e potrebbe
essere fortuna; **«0 vive in quindici settimane su quindici»** è un comportamento. Ogni chiave
`Ospite` finisce cancellata e lo slot si risolve — sempre, da maggio.

📌 **Nulla dal 13/08 22:01** alla chiusura, due giorni e mezzo che cadono su **Ferragosto**: è una
pausa del circolo, non del meccanismo. Le 31 righe della settimana corrente sono già in linea con le
quindici precedenti.

## La controprova su TEST

Su `cudi…` le stesse chiavi erano **210**, ferme al **7 agosto** — la data esatta a cui era fermo il
calendario di TEST. ⇒ Il fenomeno sta nel **meccanismo**, non nei dati di PROD: dove il sync gira si
accumula, dove era congelato si era fermato lì. *(Dal 16/08 quel sync è riacceso, voce 34: il numero
adesso si muove anche là.)*

## Perché NON si è tolto il nome dalla chiave

Messo davanti alla scelta, il committente ha deciso di **non farlo** (16/08/2026). Le ragioni, tutte
misurate:

1. **Il costo è contabile, non funzionale**: 438 lapidi, ~30 a settimana, e nessuna riga che resti
   aperta. Nulla si rompe, nulla resta visibile a nessuno.
2. **La cura è sproporzionata**: quella chiave la scrivono e la leggono **il sync, l'app e i ponti**.
   Cambiarla senza cambiarli *insieme* spacca l'aggancio fra le due copie — non è una riga di SQL, è
   un lavoro a tre teste con una migrazione del già scritto.
3. **La sonda basta**: finché `ancora_vive` e `oscillanti_vivi` sono 0, non c'è niente da inseguire.

🔁 **Cosa farebbe riaprire la voce**: uno dei due numeri diverso da zero, misurato **dopo** il
controllo negativo qui sopra.
