# Collaudo della voce 23 — la caduta vera del worker

**Scritto il 14/08/2026, 18ª sessione.** Procedura da eseguire **dal Mac**, con l'accesso a Hetzner:
è l'unica parte della voce 23 che non si può provare né dal cloud né su TEST, ed è il motivo per
cui la voce è rimasta aperta dopo essere andata in produzione (PROD 6.222).

Tutti i nomi, gli indirizzi e i numeri qui sotto sono stati **misurati** sul codice dei due rami e
sul progetto Supabase di PROD, non ricordati. Dove c'è una previsione invece di una misura, è
dichiarato.

---

## Cosa si prova, e cosa no

La voce 23 ha cambiato **quattro** cose, e sono queste che il collaudo deve vedere:

1. l'errore di rete viene **marchiato** `esitoIgnoto` (una proprietà, non le parole del messaggio);
2. il lavoro asincrono si chiude **`unknown`** invece di `error`;
3. la strada **sincrona** risponde `WORKER_ESITO_IGNOTO` con `esitoIgnoto: true`;
4. `writeBookingJob` **guarda** l'esito del proprio `upsert` invece di scartarlo.

⚠️ La macchina che va a **guardare** su Matchpoint — `staffCalAskMatchpoint`, coi tre verdetti
`si` / `no` / `boh` — c'era già dalla **v6.150** ed è una regola del committente: *«quando l'esito
resta IGNOTO non si indovina, si va a GUARDARE»*. **Non è quella che si sta collaudando.** Il
difetto della voce 23 era che la edge appiattiva il terzo esito sul secondo, e così quella macchina
non veniva mai chiamata.

---

## 🚨 La trappola che invaliderebbe tutto il collaudo

Il terzo esito si raggiunge **solo se la `fetch` lancia**, cioè se non arriva **nessuna** risposta.
Se qualcosa risponde `502` o `503` — tipicamente un reverse proxy davanti al worker — quella **è**
una risposta, e il codice prende la strada `error` normale. Correttamente. Ma il collaudo
diventerebbe **verde sulla strada sbagliata**, senza dirlo.

Misurato nel repo (`docs/ambienti-test-prod.md`): PROD punta a **`http://91.99.131.243:8787`** —
IP diretto, porta nuda, UFW aperto solo su 22 e 8787 ⇒ **nessun proxy** ⇒ a worker fermo il kernel
risponde RST ⇒ `ECONNREFUSED` ⇒ la `fetch` lancia. È la forma giusta.

🚨 **Quel valore però viene da un DOCUMENTO, e qui i documenti hanno già mentito.** Prima di
cominciare, aprire davvero: **Supabase PROD → Edge Functions → Secrets →
`MATCHPOINT_BROWSER_WORKER_URL`**. Se al posto dell'IP c'è un `https://` con un dominio, **fermarsi**:
c'è un intermediario e la procedura cambia.

---

## Quando farlo

Ora morta, e **evitare le 05:00** (`anagrafica-mirror`). La finestra deve durare ~15 minuti, perché
a worker fermo cade tutto ciò che ne dipende:

- le prenotazioni dello staff — falliscono **in sicurezza**: non viene creato niente;
- `matchpoint-bookings-sync`, ogni 2 minuti: il calendario smette di rinfrescarsi e **si risana da
  sé** al riavvio;
- **il bot dei soci**: chi prenota da `@loziocoach_bot` in quella finestra finisce sulla stessa
  strada. A ora morta è improbabile, ed è la ragione per cui la finestra resta corta.

---

## Passo 0 — pre-volo

### a) La edge deployata è quella nuova

Verificato dal cloud il 14/08: `matchpoint-bookings-create` su `qqbfphyslczzkxoncgex` è alla
**versione 37** e il suo `FEATURES` contiene `esito-ignoto`. Riconfermarlo il giorno stesso, dalla
console del gestionale già loggato come staff:

```js
const cfg = await loadAssessmentSupabaseConfig();
const tok = await pmoGetSupabaseStaffAccessToken();
const r = await fetch(cfg.supabaseUrl + '/functions/v1/matchpoint-bookings-create?features=1',
  { headers: { apikey: cfg.supabaseKey, Authorization: 'Bearer ' + tok } });
console.log(await r.json());
```

Deve elencare `esito-ignoto`. **Se manca, fermarsi**: si starebbe collaudando il codice vecchio.

### b) L'app servita è la 6.222

Ricarica forzata (`Cmd-Shift-R`) e titolo della scheda. È la lezione del 14/08: Pages può ancora
servire il file precedente, e un «non ancora» scambiato per un «no» è già costato una diagnosi.

### c) Lo slot bersaglio

Data lontana nel futuro, campo e ora che non usa nessuno, slot **vuoto**. Annotare campo, data e
ora: servono per il controllo negativo.

### d) Due terminali su Hetzner

```bash
ssh root@91.99.131.243
pm2 list
tail -f ~/.pm2/logs/matchpoint-worker-*.log
```

Il servizio pm2 si chiama **`matchpoint-worker`** e vive in **`/opt/matchpoint-worker`**
(misurato in `deploy-worker-hetzner.yml`).

---

## Le previsioni, dichiarate PRIMA

| passo | cosa deve succedere |
|---|---|
| creazione asincrona, worker fermo | lavoro chiuso **`unknown`**, non `error` |
| messaggio in app | «⌛ Non ho la conferma — sto guardando su Matchpoint…», poi il testo lungo con «**Controlla prima di rifarla**» |
| verdetto del guardare | **`boh`**, non `no` — la lettura passa dallo **stesso worker** (`matchpoint-bookings-edit` con `read: true`), quindi a worker fermo non *può* guardare. Un `no` qui sarebbe un difetto |
| calendario | **niente disegnato** |
| ricorrente | `502` con `WORKER_ESITO_IGNOTO` e `esitoIgnoto: true`; il riassunto dice le **incerte per prime** |
| log del worker | **nessuna riga** `/create-booking` in tutta la finestra |
| Matchpoint | slot **vuoto** |

⏱️ **Con `ECONNREFUSED` la edge fallisce in millisecondi**, quindi la reazione dell'app arriva in
**pochi secondi**. Se tocca aspettare minuti non si è nella forma «rifiuto» ma in quella
«silenzio» (Prova 3), e questo è già un dato.

---

## Prova 1 — la strada asincrona

1. `pm2 stop matchpoint-worker` — **annotare l'ora esatta**
2. Calendario staff → creare una prenotazione normale sullo slot scelto
3. Entro pochi secondi deve comparire il messaggio ⌛
4. Trascrivere o fotografare il testo finale
5. Verificare che sul calendario **non sia comparso niente**

## Prova 2 — il ricorrente (strada sincrona)

Worker sempre fermo. Creare un **ricorrente di almeno 2 occorrenze** — stesso slot, settimane
diverse.

Atteso: il riassunto che dice le incerte **per prime** — «⌛ 2 non so come sono andate (il
gestionale non ha risposto): controllale su Matchpoint PRIMA di rifarle…». Nella scheda Network:
`502`, `error: "WORKER_ESITO_IGNOTO"`, `esitoIgnoto: true`.

🚨 **È la prova che pesa di più**: da qui passa la strada che poteva produrre **quattro doppioni
veri di fila** sul gestionale del circolo.

## Il controllo negativo — è la metà che decide

Senza questo il collaudo non prova niente. È la lezione in cima a `docs/lavori/README.md`:
*chiedere alla prova di cosa sarebbe capace se il fatto fosse falso*.

1. Nel log del worker: **zero** righe `/create-booking` nella finestra. Se ce n'è anche **una**,
   fermarsi: la richiesta è passata e qualcosa può essere stato prenotato davvero.
2. `pm2 start matchpoint-worker`, aspettare ~30 secondi
3. Aprire quello slot: **vuoto**, sia in app sia su Matchpoint.

## Cosa leggere nel database, dopo

```sql
select local_key as job, payload->>'status' as stato,
       payload->>'message' as messaggio, payload->>'error' as errore, updated_at
from pmo_cloud_records
where record_type = 'booking_job' and updated_at > now() - interval '1 hour'
order by updated_at desc;
```

Atteso: almeno una riga **`unknown`** col messaggio «controlla su Matchpoint prima di rifarla».

- 🚨 se si legge **`error`** → la `fetch` ha ricevuto una risposta ⇒ c'è un intermediario ⇒
  collaudo **non valido**;
- 🚨 se si legge **`pending` che non si chiude mai** → si è nell'altra forma, ed è un ritrovamento
  (vedi Prova 3).

📌 Linea di base misurata il 14/08, prima del collaudo: su PROD **184** lavori in tutta la storia —
168 `done`, 16 `error`, **0 `pending`**, **0 `unknown`** — e tutti e 16 gli `error` erano
`Worker error 5xx`, cioè il worker aveva **risposto**. In due mesi (10/06 → 12/08) il terzo esito,
sulla strada asincrona, **non si è mai verificato**. ⚠️ Quella sonda però non vede la strada
sincrona, che non lascia righe.

## Ripristino — da non saltare

```bash
pm2 start matchpoint-worker
pm2 list      # deve dire online
pm2 save
```

Poi una verifica **vera**, non l'etichetta: aspettare il giro di `bookings_live` (2 minuti) e
controllare che il calendario torni a rinfrescarsi. Il worker dev'essere dimostrabilmente vivo
prima di andarsene.

---

## Prova 3 — opzionale, ed è la forma che NON conosciamo

`pm2 stop` produce un **rifiuto**. L'altra forma è il **silenzio**: pacchetti buttati, nessuna
risposta. Si ottiene con `ufw insert 1 deny in to any port 8787`, e si toglie con `ufw delete`.

**Previsione, non misura**: la `fetch` della edge **non ha alcun timeout** — verificato, nessun
`AbortSignal` nel sorgente di `callWorkerCreateBooking`. Quindi la connessione resta appesa finché
il runtime non uccide il lavoro di sfondo ⇒ `writeBookingJob` non gira mai ⇒ **il lavoro resta
`pending` per sempre** ⇒ l'app aspetta 3 minuti (`maxMs`), poi altri 6 (`lateMaxMs`), e finisce
sullo stesso «non so com'è andata». Esito **sicuro**, ma più lento e con la ragione persa.

Se va così è un **ritrovamento da voce nuova**: un lavoro che non si chiude mai, e l'argomento per
mettere un timeout esplicito su quella `fetch`.

⚠️ Costa ~9 minuti di attesa dell'app. Farla solo con tempo, e **ricordarsi di togliere la regola
UFW**.

---

## Cosa questo collaudo NON prova

Il caso davvero pericoloso: il worker **riceve** la richiesta, **crea** la prenotazione su
Matchpoint, e *poi* la risposta si perde. Lì l'ambiguità è reale e il doppione sarebbe vero.

Questa procedura non ci arriva **di proposito**, perché arrivarci significa creare una prenotazione
vera sul gestionale del circolo. Quel caso resta coperto **dal disegno** — il messaggio dice
«controlla prima di rifarla», e il sync riporta dentro la prenotazione da sé entro un paio di
minuti — **non dalla prova**. Va detto invece che taciuto.

## Pulizia

Le righe `booking_job` con `unknown` restano in `pmo_cloud_records`. **Conviene lasciarle**: sono
il verbale del collaudo, non fanno danno, e la regola qui è misurare **cosa punta a una riga** prima
di toglierla.

Nient'altro dovrebbe restare: sulla strada dell'ignoto `saveStaffBookingRecord` non viene **mai**
chiamata — sta dentro il `try` dopo la chiamata al worker — e l'app dichiara di non aver scritto
niente sul calendario (`_staffCalCreateSettle(_optimKey, true)`).
