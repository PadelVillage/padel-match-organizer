# Collaudo della voce 23 — la caduta vera del worker

**Scritto il 14/08/2026 notte. ✅ ESEGUITO il 15/08/2026, in produzione, due volte — e riscritto con
quello che l'esecuzione ha insegnato.** La prima versione di questo documento diceva di fermare il
**worker**: è sbagliato, e sotto c'è il perché.

Procedura da eseguire **dal Mac**, con l'accesso alla VM. Tutto ciò che segue è **misurato**, non
ricordato: dove c'è una previsione invece di una misura, è dichiarato.

---

## Cosa si prova

La voce 23 ha cambiato **quattro** cose:

1. l'errore di rete viene **marchiato** `esitoIgnoto` (una proprietà, non le parole del messaggio);
2. il lavoro si chiude **`unknown`** invece di `error`;
3. la strada sincrona risponde `WORKER_ESITO_IGNOTO`;
4. `writeBookingJob` **guarda** l'esito del proprio `upsert`.

E poi, il 15/08, altre due:

5. quando l'esito è ignoto l'app **insiste** a guardare su Matchpoint — 3 minuti, un colpo ogni 15
   secondi — invece di guardare una volta sola;
6. se dopo tre minuti non sa ancora, la domanda si **deposita** e viene ripresa a ogni apertura,
   finché non è un sì o un no.

---

## 🚨 LA TRAPPOLA — ed è scattata davvero

Il terzo esito si raggiunge **solo se la `fetch` lancia**, cioè se non arriva **nessuna** risposta.

**Fermare il worker NON basta.** Davanti c'è **Caddy**:

```
/etc/caddy/Caddyfile
worker.91.99.131.243.nip.io {
        reverse_proxy localhost:8787
}
```

A worker fermo, **Caddy risponde `502`** al posto suo — e un 502 **è una risposta**, quindi la edge
lo tratta come un errore normale. Corretto, ma il collaudo non prova niente.

⇒ **Si ferma CADDY, non il worker.** Il worker resta acceso ma **non riceve niente**, perché tutto
passa da lì: il rischio di creare una prenotazione vera scende a **zero per costruzione**, non per
tempismo.

📌 **E questo spiega lo storico**: 184 lavori, 16 `error` tutti `Worker error 5xx`, **zero
`unknown`** in due mesi. Non era un caso raro — da un worker fermo il terzo esito **non può**
nascere.

⚠️ `docs/ambienti-test-prod.md` dichiara `MATCHPOINT_BROWSER_WORKER_URL = http://91.99.131.243:8787`.
**È sbagliato**: la strada vera è `https://worker.91.99.131.243.nip.io` (porta 443). Dal Mac la 8787
non risponde affatto.

---

## Passo 0 — pre-volo

**a) La chiave SSH si chiama `padel_deploy`** (non `pmo_deploy_key`, come dice il documento degli
ambienti):

```bash
ssh -i ~/.ssh/padel_deploy root@91.99.131.243
```

**b) L'app dev'essere l'ultima.** `Cmd + Shift + R` e controlla la versione in basso a sinistra.
Con una versione vecchia si collauda il codice vecchio — è già successo.

**c) Lo slot bersaglio**: data lontana, campo e ora che non usa nessuno, slot vuoto.

**d) L'ora**: il circolo dev'essere fermo. Con Caddy giù nessuno prenota — né lo staff né il bot — e
il sync del calendario si ferma (si risana da sé al riavvio).

---

## Le previsioni, dichiarate PRIMA

| passo | cosa deve succedere | misurato il 15/08 |
|---|---|---|
| creazione, Caddy fermo | lavoro **`unknown`**, non `error` | ✅ `Connection refused` su `/create-booking` |
| l'app insiste | contatore dei tentativi visibile | ✅ **13 tentativi** (3 min ÷ 15 s) |
| dopo 3 minuti | «**La verifica resta APERTA**» | ✅ |
| verdetto del guardare | **`boh`**, non `no` | ✅ passa dalla stessa strada caduta |
| calendario | **niente disegnato** | ✅ slot libero |
| Matchpoint | **niente creato** | ✅ 0 righe su quello slot |

---

## ① Controllo positivo — la sonda deve saper vedere

```bash
curl -m 5 -sS -o /dev/null -w "worker: HTTP %{http_code}\n" https://worker.91.99.131.243.nip.io/
```

**Deve stampare un numero** (404 va benissimo). Se dice già «Failed to connect», **fermarsi**: la
sonda non misura quello che si crede.

## ② Fermare Caddy

```bash
ssh -i ~/.ssh/padel_deploy root@91.99.131.243 'systemctl stop caddy; echo "caddy: $(systemctl is-active caddy)"'
```

## ③ 🚦 IL CANCELLO — stesso comando del passo ①

```bash
curl -m 5 -sS -o /dev/null -w "worker: HTTP %{http_code}\n" https://worker.91.99.131.243.nip.io/
```

**Deve dire `Failed to connect`.** Se risponde ancora un numero, **ci si ferma e non si tocca il
calendario**.

🚨 **Perché il cancello esiste.** Senza, la notte del 14/08 sono state create **tre prenotazioni
vere** credendo di collaudare: il `pm2 stop` non era mai stato eseguito (nessuna sessione SSH
aperta) e nulla lo diceva. Tutte annullate, ma il costo è stato quello.
⚠️ E la **prima** versione del cancello era **cieca**: usava la porta 8787, che dal Mac va in timeout
sia a worker acceso sia a worker spento. Una sonda che dà sempre la stessa risposta non è una sonda —
se ne è accorto solo il controllo positivo del passo ①.

## ④ Prenotare

Dal calendario, sullo slot scelto. ⚠️ **Le strade di creazione sono tre** — il modulo, il **clic
sullo slot** e l'assistente — e si comportano allo stesso modo solo dalla **6.224** in poi. Provare
da quella che usa davvero lo staff: **il clic sullo slot**.

## ⑤ Riaccendere

```bash
ssh -i ~/.ssh/padel_deploy root@91.99.131.243 'systemctl start caddy' && \
curl -m 5 -sS -o /dev/null -w "worker: HTTP %{http_code}\n" https://worker.91.99.131.243.nip.io/
```

## ⑥ Ricaricare la pagina

La verifica in sospeso viene **ripresa da sola** e chiusa: «NON è stata creata, lo slot è libero».

---

## Cosa leggere nel database

**Il lavoro:**
```sql
select local_key, payload->>'status' as stato, payload->>'message' as messaggio,
       left(payload->>'error', 200) as errore, updated_at
from pmo_cloud_records
where record_type = 'booking_job' and updated_at > now() - interval '1 hour'
order by updated_at desc;
```
Atteso: **`unknown`** con `Connection refused`. Se leggi **`error`** con `Worker error 502`, hai
fermato il worker e non Caddy.

**La ripresa** (dalla 6.225 lascia traccia):
```sql
select created_at, outcome, meta from pmo_ai_turns
where meta::text like '%ripresa verifica%'
order by created_at desc limit 10;
```
`ripresa-avviata` · `verifica-chiusa-si` · `verifica-chiusa-no` · `ripresa-senza-sessione`.
🚨 **Niente del tutto** significa deposito vuoto — la ripresa esce prima di tracciare.

**Il controllo negativo, ed è la metà che decide:**
```sql
select count(*) from pmo_cloud_records
where record_type = 'staff_booking' and payload->>'data' = '<data>' and payload->>'ora' = '<ora>'
  and deleted = false;
```
Deve essere **0**.

---

## Cosa questo collaudo NON prova

Il caso davvero pericoloso: **il worker riceve, crea la prenotazione su Matchpoint, e poi la
risposta si perde.** Lì la partita esiste e il gestionale non lo sa.

La procedura non ci arriva **di proposito**: arrivarci significa creare una prenotazione vera. Quel
caso resta coperto **dal disegno** — l'app dice «non so, e sto verificando», non disegna niente, e
quando la strada torna va a guardare e trova — **non dalla prova**.

---

## Pulizia

Le righe `booking_job` con `unknown` restano in `pmo_cloud_records`: sono il verbale del collaudo.
⚠️ **Restano `unknown` anche dopo che l'app ha risolto la verifica**, perché la chiusura vive nel
`localStorage` del browser. Chi legge il database vede un lavoro in sospeso che invece è chiuso — è
un residuo noto, non un guasto.

Se il collaudo crea per sbaglio una prenotazione vera: **annullarla dall'app** e verificare
`deleted = true` sulla riga corrispondente.
