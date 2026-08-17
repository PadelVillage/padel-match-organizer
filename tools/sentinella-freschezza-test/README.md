# Sentinella della freschezza di TEST — voce 59/C

Guarda ogni 15 minuti se **`test.padelvillage.club` sta servendo una copia vecchia**
dell'app, e lo dice **su Telegram**. Gira **sulla VM Hetzner**, non su GitHub Actions.

## Perché esiste

È il prezzo della cura della voce 58. Da lì in poi TEST serve l'app da `./app.html`,
la copia pubblicata sul repo del caricatore: è la strada **primaria**, ed è giusto —
è quella che ha retto durante l'avaria di GitHub del 17/08. Ma proprio perché è
primaria, **se la sincronia si ferma TEST mostra codice vecchio e sullo schermo non
si vede niente**.

E la sincronia si ferma in modi già visti: un'avaria di Actions (successa), o lo
**spegnimento automatico degli schedule dopo ~60 giorni** di repo fermo, che
`sync-app.yml` documenta da sé.

La **B** della stessa voce avvisa *chi sta guardando TEST*. Questa avvisa **noi**,
anche se TEST non lo apre nessuno per una settimana.

## ⭐⭐ Perché sulla VM e non su Actions

La cosa da sorvegliare **è la sincronia, che gira su Actions**. Una guardia messa
lì morirebbe **insieme a ciò che sorveglia** — cioè tacerebbe esattamente nel caso
per cui esiste. La VM è l'unico pezzo del sistema che non è GitHub.

⇒ Per la stessa ragione la sentinella **non dipende da pm2, dal worker né dai bot**:
è un'unità `systemd` per conto suo. Se muore tutto il resto, lei parla ancora.

## 🚨 Si confronta il CONTENUTO, non il commit

Il confronto ovvio — `source_sha` di `app-meta.json` contro la testa di
`test-preview` — è **sbagliato**, ed è **misurato**:

| il 17/08 alle 21:55 | |
|---|---|
| impronta di `index.html` su `test-preview` | `79d1a3a4…` |
| impronta dei byte serviti da TEST | `79d1a3a4…` → **fresca al byte** |
| `source_sha` dichiarato | `a0640f3` |
| testa di `test-preview` | `77feb7c` → **dodici commit più in là** |

Il motivo sta in `sync-app.yml`: ricopia **solo se `index.html` è cambiato**
(`cmp -s` → `exit 0`). ⇒ Ogni commit che tocca solo `docs/` allontana il commit
**senza invecchiare la copia**.

Una sentinella legata ai commit suonerebbe quasi ogni giorno su copie perfette, e in
un mese nessuno la leggerebbe più — **che è il modo più comune di perdere una
protezione senza toglierla**. È la stessa malattia per cui la strada `synced_at` era
già stata scartata, ripresentata un gradino più in là.

⇒ Si confronta l'**impronta git** di `index.html` fra il commit che TEST *dichiara di
servire* e la testa del ramo, letta dall'elenco della radice: due chiamate piccole,
nessun download da 3 MB.

## Le tre cose che una guardia sbaglia, e cosa fa questa

| | |
|---|---|
| **suona troppo presto** | la sincronia ha un cron da 10′: trovarla indietro *una volta* è normale. Suona dopo **3 giri consecutivi** (~45′). È la pazienza di `guard-worker-sync`, per lo stesso motivo |
| **scambia «non lo so» per «indietro»** | GitHub muto, 403, rete giù → esito **`cieca`**, che **non accusa nessuno** e non fa avanzare il contatore |
| **tace da cieca** | ma una sentinella cieca fa **lo stesso identico silenzio** di una tranquilla ⇒ dopo 12 giri ciechi lo **dichiara** |

E manda **un messaggio per guasto**, non uno per giro; quando rientra lo dice, e da lì
può risuonare per un guasto nuovo.

## Com'è fatta

| file | |
|---|---|
| `sentinella.mjs` | la misura e la decisione. Nessuna dipendenza: solo Node ≥18 |
| `banco-sentinella.mjs` | 10 casi, rete finta, più il sabotaggio che spegne la pazienza |
| `*.service` / `*.timer` | l'unità systemd (oneshot) e il timer da 15′ |
| `stato.json` | ⚠️ generato sulla VM: memoria fra un giro e l'altro |
| `.env` | ⚠️ **solo sulla VM**, mai in git: le due credenziali Telegram |

```bash
node banco-sentinella.mjs     # il banco, da qui, senza toccare la rete
```

## Installazione e aggiornamento

Dal workflow **`deploy-sentinella-hetzner.yml`** di questo repo (l'unico con
`SSH_DEPLOY_KEY`): parte da solo su `main` quando questa cartella cambia, oppure a
mano da Actions. Non tocca il worker, i bot, né pm2, e **non cancella mai il `.env`**.

Il deploy finisce solo se la sentinella **ha misurato davvero** sul bersaglio: legge
lo `stato.json` che ha lasciato e fallisce se non c'è. Un'unità installata che non
gira è il guasto che questa voce esiste per evitare, un piano più in su.

### 🔑 Per armarla servono due secret di questo repo

```
TELEGRAM_SENTINELLA_TOKEN    il token di un bot Telegram
TELEGRAM_SENTINELLA_CHAT_ID  la chat dove scrivere
```

Senza, si installa lo stesso e gira **disarmata**: misura e scrive nel registro ciò
che *avrebbe* mandato. ⚖️ Una guardia disarmata che lo dichiara è onesta; una che
crede di aver mandato il messaggio no — ed è per questo che il deploy stampa se il
`.env` c'è (guardando **che il file esista**, non il suo contenuto).

## Cosa guardare quando suona

```bash
systemctl list-timers sentinella-freschezza-test.timer
journalctl -u sentinella-freschezza-test.service -n 50
cat /opt/sentinella-freschezza-test/stato.json
```

➡️ Il posto dove si ripara è **Actions → `sync-app`** sul repo del caricatore
(`PadelVillage/padel-match-organizer-test`): si rilancia a mano, o si riaccendono
gli schedule se GitHub li ha spenti.
