# Voce 34 — riaccendere SOLO il calendario su TEST

**Preparato ed ESEGUITO il 15/08/2026, 24ª sessione**, su conferma separata del committente
(*«direi che possiamo procedere»*) — chiesta a parte perché aggiunge lavoro al worker **condiviso
con la produzione**.

✅ **ACCESO alle 23:26 italiane del 15/08**: `cron.job` **jobid 17**,
`pmo-calendario-test-solo-prenotazioni`, `30 * * * *`, attivo.
⚖️ Il **jobid 13 NON è stato toccato**: resta spento e inchiodato al ramo clienti, esattamente
com'era. Tornare indietro è cancellare il 17, non ricostruire il 13.
📌 Ambiente al momento dell'accensione: **ora legale** — 23:26 italiane contro 21:26 di Greenwich,
due ore di differenza. È la condizione in cui gli orari fissi funzionerebbero e in cui la loro
fragilità **non si vedrebbe**: motivo in più per non averli usati.

---

## 1. Cosa fa, e cosa NON fa

Rimette in moto l'aggiornamento del **calendario** di TEST — **5 volte al giorno**, alle
**05:30, 10:30, 14:30, 17:30, 21:30** italiane. Lascia fermi i **6 aggiornamenti clienti** e
lo **storico**, che restano manuali come li ha voluti il committente.

🔓 **Il perché erano fermi, detto da lui il 15/08** — l'informazione che alla scheda mancava:
*«avevamo deciso insieme di fermare tutte le routine di test proprio perché così facevamo gli
aggiornamenti manuali quando ci serviva di fare dei test»*. ⇒ Non erano spente per un guasto:
erano spente **per avere il controllo**. Ed è la ragione per cui qui si riaccende **una sola** cosa.

⚠️ **Solo LETTURE.** `matchpoint-bookings-sync` chiama il worker su `/read-tabellone` e
`/export-booking-history`: va a **guardare** il calendario del circolo e se lo porta via. Non crea,
non disdice, non modifica nulla su Matchpoint.
🚨 **Ma il worker è quello VERO e condiviso** — la premessa «TEST non parla con Matchpoint» è falsa,
e va detta com'è: TEST ci parla eccome. Regge la conclusione, non la premessa: **leggere il
calendario del circolo non cambia niente al circolo**. Le scritture stanno su un'altra strada e
restano spente.

## 1bis. ✅ Il filtro è stato ESERCITATO, non dato per buono — 15/08, 23:30

⭐ Quattro minuti dopo l'accensione è caduto uno slot **dei clienti** (23:30), ed è stata la prima
occasione di vedere il filtro dire **no**. *Una protezione che non si è mai vista rifiutare non si sa
se rifiuta.*

| controllo | esito |
|---|---|
| 🚨 **base: si è svegliata davvero?** | **sì**, `cron.job_run_details` la dà partita alle **23:30:00**, esito `succeeded`. Senza questo, «non è successo niente» non proverebbe nulla |
| **ha lasciato stare i clienti?** | **sì**: `data_routine_dispatch_clients%` dopo l'accensione = **0** |
| **e lo storico?** | **0** |

🔬 **E la spiegazione alternativa è stata esclusa, invece che ignorata.** L'insert del dispatcher è
`on conflict do nothing`: una riga già esistente avrebbe prodotto lo stesso identico zero, per un
motivo completamente diverso. Misurato: le uniche due righe clienti sono `clients_0430` del **2 e 3
agosto**, mentre un giro delle 23:30 avrebbe creato `clients_2330_20260815_2330` — chiave nuova, che
non può collidere con niente. ⇒ Lo zero **non** viene da un conflitto: la funzione non è stata
chiamata affatto.
📌 Nota a margine che conferma il racconto: l'ultimo aggiornamento clienti è del **3 agosto**,
esattamente la data in cui furono ritirati.

⚠️ **Quello che questo NON prova**: `return_message` di pg_cron per una `select` dice solo «1 row»,
non quale ramo ha risposto. La prova qui è **comportamentale** — la conseguenza che sarebbe dovuta
apparire e non è apparsa — e vale di più di un'etichetta, ma va detta per quello che è.

⏭️ **Il primo slot di calendario è alle 05:30 del 16/08.** Fino ad allora `bookings` resta a **0**, e
non è un guasto: è che non è ancora passata l'ora.

## 2. Il punto di partenza, misurato il 15/08 (serve per il confronto dopo)

| | |
|---|---|
| aggiornamenti del **calendario** in tutta la storia di TEST | **0** |
| aggiornamenti **clienti** | 2 |
| aggiornamenti **storico** | 0 |
| ultima riga di calendario toccata | **7 agosto 2026** |
| prenotazioni vive | 155 |
| le 3 chiavi che servono alla routine (`vault`) | **tutte e tre presenti** |
| cron `jobid 13` | **spento**, e inchiodato al ramo clienti dall'argomento `<oggi 04:30>` |

## 3. Il comando da eseguire — UNA volta, sul database di TEST (`cudiqnrrlbyqryrtaprd`)

⚖️ **Il `jobid 13` non si tocca**: resta spento dov'è. Si aggiunge un lavoro NUOVO, così tornare
indietro è cancellare quello nuovo e non ricostruire il vecchio.

```sql
select cron.schedule(
  'pmo-calendario-test-solo-prenotazioni',
  '30 * * * *',
  $$
  select case
    when to_char(now() at time zone 'Europe/Rome', 'HH24:MI')
         in ('05:30','10:30','14:30','17:30','21:30')
    then (public.pmo_dispatch_data_routines())::text
    else 'slot non di calendario: salto'
  end;
  $$
);
```

### Perché «ogni ora al minuto 30» e non cinque orari fissi

Perché **la sveglia del database ragiona in ora di Greenwich, e la routine ragiona in ora italiana**
— d'estate due ore di differenza, d'inverno una. Cinque orari fissi funzionerebbero fino al cambio
dell'ora, poi cadrebbero su orari che **non corrispondono a nessuno slot**: la sveglia suonerebbe e
non farebbe niente, **senza errori e senza avvisi**. Il calendario tornerebbe a congelarsi e nessuno
se ne accorgerebbe — cioè esattamente il guasto silenzioso da cui nasce questa voce.

⇒ Qui si sveglia **ogni ora al minuto 30** e a decidere è il confronto sull'**ora italiana**, dentro
il comando. Il cambio dell'ora non lo tocca: la decisione la prende chi sa che ore sono in Italia.
🚨 E il confronto serve **anche** contro le collisioni: pure i 6 slot dei clienti cadono al minuto
30 (04:30, 07:30, 12:30, 16:30, 19:30, 23:30). È quell'elenco di cinque orari a tenerli fuori, non
l'orario della sveglia.

### La prova che si può fare PRIMA di accendere

```sql
select to_char(now() at time zone 'Europe/Rome','HH24:MI') as ora_italiana,
       to_char(now(),'HH24:MI')                            as ora_di_greenwich;
```

Se le due colonne differiscono di 2 ore siamo in ora legale, di 1 in ora solare. È la differenza che
renderebbe fragili gli orari fissi, e che il comando qui sopra non subisce.

## 4. Cosa guardare, il giorno dopo

### ① Ha funzionato? — devono comparire fino a 5 righe al giorno

```sql
select local_key,
       payload->>'status'             as stato,
       payload->>'scheduledLocalTime' as ora_italiana,
       synced_at
from pmo_cloud_records
where record_type = 'matchpoint_data'
  and local_key like 'data_routine_dispatch_bookings%'
order by synced_at desc
limit 10;
```

✅ Atteso: righe con stato **`dispatched`**, agli orari 05:30 / 10:30 / 14:30 / 17:30 / 21:30.
🚨 Se lo stato è **`blocked`** con `PMO_DATA_ROUTINE_VAULT_SECRET_MISSING`, mancano le chiavi —
oggi ci sono, quindi vorrebbe dire che qualcuno le ha tolte nel frattempo.
⚠️ **Zero righe** non vuol dire «non funziona»: vuol dire che non si è ancora svegliata a un orario
di calendario. Si riguarda dopo il primo slot utile.

### ② Il resto è rimasto fermo? — è il controllo che conta davvero

```sql
select count(*) as risvegli_indesiderati
from pmo_cloud_records
where record_type = 'matchpoint_data'
  and (local_key like 'data_routine_dispatch_clients%'
    or local_key like 'data_routine_dispatch_history%')
  and synced_at > '<METTI QUI LA DATA E ORA DELL ACCENSIONE>';
```

✅ Atteso: **0**. Se non è zero, il filtro non ha tenuto e sono ripartiti i clienti o lo storico:
si spegne subito (§5) e si guarda perché.
📌 Il conteggio è **dopo l'accensione** di proposito: prima ce n'erano già 2 di clienti, e contarli
tutti darebbe un falso allarme.

### ③ Il calendario si sta scongelando?

```sql
select max(updated_at)::date               as ultimo_aggiornamento,
       count(*) filter (where not deleted) as prenotazioni_vive
from pmo_cloud_records
where record_type in ('booking','booking_occupancy');
```

✅ Atteso: `ultimo_aggiornamento` **si muove da `2026-08-07` a oggi**. È la prova finale: fin qui
quella data non si è mai mossa.

### ④ Dalla macchina — la sola cosa che da qui non si vede

Nei registri del worker su Hetzner (`~/.pm2/logs/matchpoint-worker-*.log`): **5 letture in più al
giorno**, e nessun errore accanto. Serve a vedere che le letture in più non disturbino la
produzione, che usa lo stesso programma.

## 5. Come si spegne, in un secondo

```sql
select cron.unschedule('pmo-calendario-test-solo-prenotazioni');
```

Non lascia niente dietro: il `jobid 13` non è stato toccato e resta com'era.

## 6. Cosa questa voce NON risolve

Il **bot Telegram** e la **app** continuano a leggere il calendario di TEST come sempre: qui cambia
solo che quel calendario è aggiornato invece che fermo al 7 agosto. ⇒ Il giorno in cui si accende,
la **voce 26** si chiude da sé: quel «Fatto» che non si vedeva era il sintomo del calendario fermo,
non un guasto del bot.
