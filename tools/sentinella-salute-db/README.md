# Sentinella della salute del database — voce 161

Guarda una volta al giorno i numeri che l'avaria del **05/09/2026** (voce 160) aveva
reso visibili **per settimane** senza che nessuno li guardasse, e lo dice **su
Telegram** quando escono di riga.

## Perché esiste

Il difetto della 160 non era invisibile. Era **scritto**, in tre numeri che stavano
tutti in `pg_stat_user_tables` e nei contatori di Supabase:

| il numero | quanto era | cosa voleva dire |
|---|---|---|
| `n_tup_upd` di `pmo_cloud_records` | 14 milioni su 31 mila righe | la tabella si riscriveva centinaia di volte |
| `n_tup_hot_upd` della stessa | **zero** | ogni aggiornamento riscriveva tutti gli indici |
| WAL prodotto | **62 GB** per un database da 685 MB | novanta a uno |

Nessuno dei tre è un'opinione, e nessuno dei tre lo leggeva nessuno.

📌 *Una misura che esiste ma che nessuno legge protegge quanto una misura che non
esiste.* Questa voce è la conseguenza di quella frase.

## ⭐⭐ Perché su Actions e non sulla VM — l'opposto della sorella, e non è una svista

La [sentinella della freschezza di TEST](../sentinella-freschezza-test/) sta sulla VM
**apposta**: sorveglia la sincronia, che gira su Actions, e una guardia messa lì
morirebbe *insieme a ciò che guarda*.

Questa sorveglia **Supabase**, che con Actions non ha niente a che vedere ⇒ quell'
argomento **non si applica**, e cade il motivo per spostarla.

⚖️ E cade **a favore**, per una ragione di sicurezza dichiarata: per leggere
`pg_stat_user_tables` e `pg_ls_waldir()` serve una credenziale di **amministrazione**
del progetto Supabase. Su Actions `SUPABASE_ACCESS_TOKEN` c'è già — è lo stesso dei
deploy — e non esce mai. Portarlo sulla VM vorrebbe dire posare accanto ai due bot una
chiave che **può cancellare il database**. *Una guardia non si paga allargando la
superficie che difende.*

⛔ **Il prezzo, detto e non taciuto**: se Actions è in avaria questa sentinella tace, e
gli schedule di GitHub si spengono da soli dopo ~60 giorni di repo fermo.
· Il primo caso costa **una misura e non di più**: il delta si normalizza sul **tempo
passato**, non sui giri, quindi la lettura del giorno dopo copre due giorni da sé.
· Il secondo si vede perché smette di arrivare il **battito**.

## 🚨 La memoria sta nel database che guarda

`pg_stat_user_tables` conta dall'ultimo riavvio e **si azzera con lui** (il 05/09 alle
12:08 è ripartito da zero). ⇒ Una soglia sul **totale** tacerebbe per giorni dopo ogni
riavvio, cioè **proprio dopo un'avaria**. La forma giusta è un **delta**, e un delta
vuole la lettura di ieri.

Su Actions un «accanto» che duri non c'è: la cache si sfratta, un file committato
sporcherebbe il repo ogni notte. Nella tabella `pmo_sentinella_salute` invece la memoria
è **storia** — e se il database è morto la sentinella non la legge, quindi esce
**cieca**, che è l'unica cosa onesta da dire quando non si è guardato.

Una riga al giorno, cancellate da sé dopo 400 giorni: *una sentinella della salute che
gonfia il database che sorveglia sarebbe la 160 in miniatura.*

## Le sei regole, e cosa difende ciascuna

| regola | forma | soglia | prende |
|---|---|---|---|
| `wal-su-disco` | fotografia | ≥ 8 GB | il WAL che si accumula (62 GB, il 05/09) |
| `archiviazione` | fotografia | ultimo tentativo **fallito** più recente dell'ultimo riuscito (`pg_stat_archiver`) | 🎯 **il guasto della 160 per nome**, 17 ore prima degli 8 GB |
| `hot` | **rapporto** | HOT < 20% su ≥ 500 aggiornamenti | gli aggiornamenti che pagano tutti gli indici |
| `wal-al-giorno` | **ritmo** | WAL **scritto** > 6× la dimensione del database | il traffico che diventa WAL |
| `amplificazione` | **ritmo** | una tabella > 30× le sue righe al giorno | un giro impazzito |
| `tuple-morte` | fotografia | > 40% su tabelle ≥ 1000 righe | il bloat |

🚨⭐⭐ **L'LSN NON È IL WAL SCRITTO — misurato il 06/09/2026, e la prima stesura lo
confondeva.** Su Supabase `archive_timeout` è **120 s**: ogni due minuti il database
chiude il segmento corrente (16 MB) e ne apre uno nuovo, pieno o vuoto. La posizione
(`pg_current_wal_lsn`) salta quindi di 16 MB ogni 2 minuti — **720 volte al giorno,
11,5 GB** — qualunque cosa faccia l'applicazione.
📏 Su PROD, due campioni a **2′15″** di distanza: LSN avanzato **16,7 MB**, WAL scritto
(`pg_stat_wal.wal_bytes`) **93 KB**. In 21 ore dal riavvio: **235 MB** scritti contro
**~10 GB** di LSN. I file in `pg_wal` hanno l'ora di modifica esattamente ogni 120 s.
⇒ La regola `wal-al-giorno` giudica sul **WAL scritto**; l'avanzamento dell'LSN lo
riporta accanto, in segmenti, perché è **quello** che si accumula sul disco quando
l'archiviazione si ferma — ed è esattamente la 160: 62 GB in cinque giorni di
`archiving WAL file failed`, non cinque giorni di scritture.
⚖️ Per questo la regola nuova è `archiviazione`, e non una soglia più furba sul WAL: il
rubinetto dei 62 GB era l'archiviazione ferma, e `pg_stat_archiver` lo dice al primo
tentativo fallito non seguito da una ripresa.

🚨⭐ **E gli allarmi si contano e si dicono PER REGOLA, non per giro** (`evolviRegole`
in `misura.mjs`). La prima stesura aveva un solo `allarme_attivo`: con l'HOT fermo in
allarme — e su `pmo_cloud_records` lo è **per costruzione**, finché il trigger
`pmo_touch_updated_at` tocca `updated_at`, che è indicizzato, a ogni update — lo stato
restava «attivo» per sempre, e un guasto **nuovo** non avrebbe mandato **nessun
messaggio**. Ora ogni regola ha il suo `di_fila` e il suo `attivo`: un allarme nuovo si
dice quando arriva a due giri, un rientro si dice per la regola che rientra, e le
righe scritte prima del 06/09 (un solo conteggio per giro) si traducono senza ridire
ciò che era già stato detto.

🚨⭐ **Quale regola prende quale difetto è MISURATO, non supposto — e la prima stesura
sbagliava.** Il banco si aspettava che la 160 la prendessero *due* regole: l'HOT **e**
l'amplificazione. Non è così. 400 mila aggiornamenti al giorno su 31 mila righe sono
~13 volte, cioè **sotto** la soglia di 30, ed è esattamente il ritmo a cui la 160 è
cresciuta per settimane. ⇒ **A prendere quel difetto è l'HOT, da sola.**
⚖️ La soglia dell'amplificazione resta 30 lo stesso (serve a un giro impazzito, che è
un'altra malattia), ma andava **saputo**: *una guardia di cui si crede il falso è
peggio di una guardia in meno, perché ci si conta sopra.*

## 🚨 Ogni regola dichiara SE ha potuto giudicare

Le regole di **ritmo** dividono per il tempo passato: su una finestra di due minuti
moltiplicano il rumore per settecento e accuserebbero un database sano. ⇒ Sotto i **30
minuti** quella regola esce `non-giudicata` — che **non** è `a-posto`.

Le regole di **rapporto** (HOT, tuple morte) non dividono per il tempo e valgono su
qualunque finestra abbastanza popolata; sotto il minimo di popolazione escono anche
loro `non-giudicata`.

⚖️ È la lezione della 24ª — *la sonda che guarda troppo presto* — messa **dentro la
regola** invece che nella testa di chi legge. E se **nessuna** regola si è potuta
pronunciare il verdetto è `non-giudicabile`, mai `serena`.

## Le tre cose che una guardia sbaglia, e cosa fa questa

| | |
|---|---|
| **suona troppo presto** | suona alla **seconda** lettura fuori riga di fila. Un travaso in blocco sposta i numeri per un giorno ed è normale; la 160 era lì da settimane |
| **scambia «non lo so» per «a posto»** | database irraggiungibile → **`cieca`**, che non accusa nessuno; regola senza dati → `non-giudicata` |
| **tace e sembra tranquilla** | **battito** ogni 7 giorni senza messaggi — anche con un allarme in piedi, perché «detto una volta e poi silenzio per un mese» sarebbe indistinguibile da una sentinella morta. Ogni messaggio mandato vale come battito |

## Come si usa

```bash
# il pensiero, senza toccare niente
node tools/sentinella-salute-db/banco-salute.mjs

# un giro vero (vuole SUPABASE_ACCESS_TOKEN)
node tools/sentinella-salute-db/sentinella.mjs

# misura e giudica, ma non scrive la lettura e non manda niente
node tools/sentinella-salute-db/sentinella.mjs --muto

# arma la voce: manda UN messaggio e dice se ce l'ha fatta
node tools/sentinella-salute-db/sentinella.mjs --prova
```

Da Actions: workflow **«Sentinella salute database (voce 161)»**, `workflow_dispatch`,
con la scelta fra `prod` e `test` e gli interruttori `muto` / `prova`.

🔑 **La voce sono due secret già esistenti** — `TELEGRAM_SENTINELLA_TOKEN` e
`TELEGRAM_SENTINELLA_CHAT_ID`, gli stessi della sorella, quindi **nessun terzo bot**
(richiesta del committente, ribadita due volte il 17/08). Senza, gira **disarmata**:
misura, ricorda, e scrive nel registro ciò che avrebbe mandato.

## ⛔ Cosa questo attrezzo NON dice

- **Non dice che il database sia sano**: dice che i sei numeri che guarda sono
  dentro le soglie. Un guasto di altra forma passa senza che lei se ne accorga.
- **Non dice che il giro automatico sia partito**: il 06/09 il cron delle 05:20 UTC
  **non è scattato** (nessun run `schedule` in Actions, nessuna riga nella storia),
  e il giro lo ha lanciato una mano alle 09:12. Se GitHub salta uno schedule lo si
  vede solo dal **battito** che non arriva, o guardando la storia.
- **Non guarda TEST se non glielo si chiede**: il giro automatico è su **PROD**. Un
  allarme su TEST — dove il calendario è congelato e il traffico è finto — sarebbe
  rumore, e *una guardia che ogni tanto ha torto è una guardia che si smette di leggere*.
- **Il banco non prova la query**: prova il **pensiero**. Che `pg_ls_waldir()` risponda,
  che il token sia buono e che Telegram consegni lo dice solo la corsa vera.
