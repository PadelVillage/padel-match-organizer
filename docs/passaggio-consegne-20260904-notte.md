# Passaggio di consegne — 04/09/2026, notte (fine 82ª sessione)

**Come si usa:** incollalo come primo messaggio della chat nuova. È scritto per essere capito
**senza** la conversazione precedente.

---

## 🟢 LE TRE COSE DA SAPERE PRIMA DI TUTTO

> **① SONO NATE DUE REGOLE SUE, e stanno in `CLAUDE.md`.** Quel file si carica a ogni sessione e
> si legge PRIMA di lavorare. La più importante è **«la scheda segnalata è campo libero»**: su una
> prenotazione che lui indica si scrive **davvero**, senza chiedere, **anche su PROD** — tranne il
> **salvataggio di un pagamento**.
>
> **② IL RUOLO DELL'UTENZA DELLA CONSOLE È CAMBIATO: adesso è `staff`, su TEST E su PROD.**
> Fino a stasera era `readonly` e `pmoBlockWriteIfReadonly` fermava ogni Salva alla prima riga.
> ⇒ **Adesso un Salva arriva fino in fondo.** Con quello che comporta su PROD.
>
> **③ LA SCHEDA AUTORIZZATA È: `7/09/2026 · Campo 4 · 09:00`** (Lidia Comes, Fabiola Limuti,
> 2 Ospiti, 8,00 a testa, `idReserva 9844`). È l'unico posto su PROD in cui si scrive.

| | inizio sessione | adesso |
|---|---|---|
| versioni app | PROD 6.334 · TEST 6.335 | **PROD 6.340 · TEST 6.341** |
| PR fuse | — | **#1345 → #1348** (quattro) |
| banco | 99 verdi | **102 verdi / 0 rossi** (su `test-preview`) |
| voci chiuse | 122 | 122 (nessuna chiusa: tre nuove, tutte aperte per il suo occhio) |
| urgenti | 6 | **9** (entrano 150, 151, 152) |

---

## 0. 📦 Stato alla consegna

| | |
|---|---|
| rami | `main` ↔ `test-preview` allineati sui 4 percorsi sorvegliati |
| guardie | verdi su **entrambi** i rami, all'ultimo commit di ciascuno |
| worker · bot · edge | **non toccati** in tutta la sessione |
| ⚠️ da fare per primo | il **controllo su PROD** della 152 (vedi punto 5) e questo file da spingere |

### ⛔ LE COSE DA FARE PER PRIME
1. 🚨⭐⭐ **LA 152 SU PROD È AL LIMITE, e questo è il primo lavoro.** Misurata **due volte** sulla
   stessa scheda (7/09 · Campo 4) alla stessa larghezza (1440×900), a dieci minuti di distanza:
   · **771 px** di contenuto in **761** visibili ⇒ **sfora di 10**;
   · **755 px** in **755** ⇒ **entra**.
   ⚖️ Non è un errore di misura: è **una riga di testo che va a capo o no** a seconda del momento
   (il suggerimento sotto i giocatori, e le righe che cambiano forma quando la lettura del worker
   atterra). ⇒ La cura ha fatto quasi tutto — da **453 px** da scorrere a **0÷10** — ma **non ha
   chiuso**: a volte scorre ancora, per una decina di pixel.
   📌 *Un numero che cambia fra due misure non si arrotonda a quello che fa comodo: si dice che
   oscilla, e si cura il caso peggiore.*
   🔨 **Il rimedio era già dichiarato nel mockup**: allargare la finestra da 860 a ~1000 px (a 1440
   di schermo c'è posto), oppure stringere la colonna sinistra da 330 a 300. ⛔ **Non è ancora
   stato scritto**, e le prove fatte sulla pagina viva **non lo dimostrano**: nell'istante in cui
   sono girate la scheda stava già a 755, quindi tutte e sei le larghezze provate «entravano» —
   la sonda non poteva distinguerle. Va rimisurato **nel momento in cui sfora**.
   ⚠️ *Questa è la sonda che non discrimina: sei prove tutte verdi non dicono che sei rimedi
   funzionano, dicono che il caso da curare non c'era.*
2. **Il ramo «conto parziale» non è mai passato sul vivo**: la partita di prova è saldata, quindi
   l'avviso «⚠️ Conto parziale» l'ha eseguito solo il banco. Serve una scheda con **un importo non
   letto** — si trova aprendo una partita e guardando **entro il primo secondo**, prima che la
   lettura del worker atterri.
3. Le **tre voci nuove (150 · 151 · 152) sono tutte APERTE** e aspettano il suo occhio.

---

## 1. ✅ Prima di lavorare

```bash
git fetch origin main test-preview
git reset --hard origin/test-preview      # 🚨 il clone è shallow e parte VECCHIO
git diff origin/main origin/test-preview -- CLAUDE.md docs/ .github/workflows/ \
  tools/matchpoint-browser-worker/src/server.mjs      # dev'essere vuoto
```
📕 `docs/lavori/README.md` si apre **PRIMA** di lavorare.

Il banco NON si lancia con `node --test`:
```bash
r=0; v=0
while IFS= read -r f; do
  grep -qE "^\s*(import|export).*['\"]jsr:" "$f" && continue
  if node "$f" >/dev/null 2>&1; then v=$((v+1)); else r=$((r+1)); echo "❌ $f"; fi
done < <(find supabase consumer-app tools test \( -name '*.test.ts' -o -name '*.test.mjs' \) | sort)
echo "$v verdi, $r rossi"
```
🩹 Sintassi: `node test/controlla-sintassi.mjs` · Ora: `TZ=Europe/Rome date '+%Y-%m-%d %H:%M'`
🩹 La console vuole `npm install` in `tools/verifica-browser` a ogni sessione nuova.
🔑 Le quattro `PMO_VERIFY_*` **ci sono già**: provalo prima di dubitarne.

---

## 2. 🗣️ LE DUE REGOLE NUOVE — in `CLAUDE.md`

### 🎯 ① LA SCHEDA SEGNALATA DA LUI È CAMPO LIBERO *(in testa, dentro il POSTULATO)*
> *«Quando io ti segnalo una scheda dove tu puoi lavorare, tu lì hai campo libero per procedere in
> totale autonomia tranne sul salvataggio di un pagamento.»*
> *«Ricordati però che puoi operare sulle schede che io ti autorizzo.»*

⇒ Su **quella** scheda il confine «guardare/scrivere» **non si applica**: si scrive davvero, senza
chiedere, anche su PROD. È la **designazione** a fare l'autorizzazione.
⛔ **Resta fuori il salvataggio di un PAGAMENTO** — Cash · Card · Wallet e lo storno.
⚖️ **Il perché, e va capito**: un incasso entra nella **cassa del circolo**. L'**importo a carico**
invece **non è un pagamento** (voce 132): è idempotente, non genera nessun `payment`, gli Incassi
non lo vedono ⇒ sta **dentro** il campo libero.
📌 *La riga non separa scritture pericolose da innocue: separa ciò che si può rifare da ciò che
qualcuno deve contare.*

### 📢 ② (già c'era, ma è stata usata tutta la sera) OGNI DEPLOY SU PROD SI ANNUNCIA
🟢 «puoi operare» / 🔴 «non sono pronto», col numero e `last-modified`, e **cosa NON è provato**.
🚨 «Non mi dire di fare»: l'avviso **apre un campo**, non assegna un compito.

---

## 3. 🔑 I TRE CANCELLI — e adesso sono tutti aperti

Misurati uno per uno il 04/09, perché sono **indipendenti**:

| | cancello | stato ADESSO |
|---|---|---|
| ① | il **ruolo** (`pmoBlockWriteIfReadonly` ferma `staffCalPlayersSave` se `role === 'readonly'`) | 🟢 **`staff`** su TEST **e** PROD |
| ② | il **permesso** `cloud_sync` | 🟢 `true` |
| ③ | la guardia dell'attrezzo (`--allow-writes`) | 🟢 mia |

🚨 **La trappola della scheda utente, che è costata una spiegazione**: cambiare il **Ruolo**
esegue `pmoApplyRolePermissions()` e **azzera tutte le spunte**; e `cloud_sync` **non è una
casella** — è **derivato** (`permissions.cloud_sync = anyView`, cioè «è visibile almeno una
sezione»). ⇒ Chi cambia il ruolo e salva senza rimettere una spunta lascia l'utenza **senza
`cloud_sync`**, e il calendario si apre vuoto.
📌 Lui ha spuntato **tutte e quattro** le sezioni. Verificato: `manage_users` e `routines` restano
**false**, perché i permessi forti si accendono dai **figli** (0/4 e 0/5 spuntati).

⛔ **E il perimetro adesso NON lo tiene più il ruolo, lo tiene la REGOLA**: `staff` toglie il freno
a **tutte** le scritture della scheda, non solo a quella autorizzata.

---

## 4. 🔒 IL RECINTO — misurato, e VISTO scattare

`scritturaAlCircoloConsentita` (11 copie, tenute identiche byte per byte da
`scrittura-al-circolo.test.ts`): si parla al worker **solo** se l'indirizzo è il Supabase di
produzione (`qqbfphyslczzkxoncgex`). Altrimenti **il worker non viene chiamato affatto**.

⭐ **Due comportamenti diversi, e la differenza conta:**

| dalla TEST | |
|---|---|
| `bookings-create · edit · cancel` | **registrano di prova**: risposta «fatto, di prova» |
| 💶 `charge-write` · `payment-write` · `payment-void` · wallet · anagrafica | **RIFIUTANO** `503 AMBIENTE_DI_PROVA` |

📏 **Visto scattare il 04/09**, non solo letto — cambio importo vero da TEST:
```
matchpoint-charge-write → 503
{ "ok": false, "error": "AMBIENTE_DI_PROVA",
  "message": "…La richiesta è arrivata intera ed è stata capita, ma il gestionale non è stato toccato.",
  "avrebbe_scritto": { "op": "set_charge", "idReserva": "9755", … } }
```
⇒ **Su TEST un cambio importo non può riuscire, mai, con nessun ruolo.** Quello si prova **solo su
PROD**, sulla scheda autorizzata.

🩹 **E un difetto di documentazione trovato per strada, NON curato**: l'intestazione di
`scrittura-al-circolo.ts` dichiara **«otto copie»** e le elenca — ma sono **undici**
(`charge-write`, `payment-write`, `payment-void` sono arrivate dopo). Il meccanismo è sano (la
prova le conta tutte e undici, dinamicamente): è un **commento vecchio dentro un file che
sorveglia i soldi**, e chi lo legge per aggiornarlo ne salterebbe tre. **Va corretto in tutte e
undici le copie insieme**, o la prova di identità byte-per-byte diventa rossa.

---

## 5. 🔨 LE TRE VOCI NUOVE — tutte in servizio, tutte APERTE

### 🔔 150 — l'esito detto due volte in fondo alla scheda
🗣️ *«Continuano ad esserci due messaggi uno dopo l'altro in basso alla scheda.»*
📏 Riprodotto a 390×844 **prima** di curare: `.svc-edit-esito` a 573→650 e `#svcQueueStatus` a
771→844, tutte e due dentro `#svcChatPanel`.
🚨 **Le quattro cure prima (136 · 137⑤ · 145 · 147) governavano tutte l'ATTESA**; nessuna
l'**esito**. 🔨 Regola pura `svcBarraDoppiaDellaRiga` + tre freni (solo gesto **locale**, solo
**finito**, solo se la riga **si vede**). ⭐ E il **ridisegno** da `_svcSchedaEsito` nei due versi:
la striscia arriva a «finita» **prima** che la riga esista.
✅ Provato su TEST **e su PROD**: 2 riquadri → 1.

### 💶 151 — l'importo si ricorda, e dice QUANDO
🗣️ *«sull'importo c'è un trattino, dopo circa otto secondi appare l'importo»* → *«Sì, procedi col
salvare l'importo quando si legge.»*
🚨 **La sua premessa era falsa e ha deciso la strada**: il sync ogni 2 minuti **non legge gli
importi** (solo nomi, dalla descrizione dell'export); aprirle tutte sarebbero ~150.000 visite/g sul
worker condiviso. ⇒ L'unica lettura che li vede è quella della scheda, **e si buttava via**.
🔨 `_staffCalPersistRosterFromWorker` ora li tiene, con **`lettoAt`**. Terzo esito della casella:
*letto · **ricordato** (bordo tratteggiato) · non letto*.
⛔ **Non** si ricordano borsellino e **stato del pagamento** (un «✓ pagato» ricordato su uno storno
fa saltare un incasso vero).
✅ **Provato su PROD, e a provarlo è stato LUI**: aprendo la scheda alle 19:31 il write-back ha
scritto `importoCents: 800 · lettoAt: 17:32:08Z`. Riaperta: **8,00 a 1,2 secondi** invece di otto.

### 📐 152 — la scheda entra tutta, e il conto della partita
🗣️ *«far entrare tutte le informazioni dentro la scheda aperta»* → **«fai la A»**.
📏 Misurato su PROD: finestra **860**, scheda **612** (231 vuoti a destra), **453 px** da scorrere.
🎨 Mockup `mockup/scheda-entra-tutta-mockup.html`, che **si misura da sé** (ha scoperto che una
variante sforava di 5 px, prima di scriverla).
🔨 ① **due colonne da 900 px in su**, sotto una sola; ② **il conto**: a carico · già incassato ·
manca, regola pura `_pmoContoPartita`.
🚨⭐⭐ **SOLO CSS, il DOM non si tocca**: `_svcSchedaEsito` e la guardia della **150** cercano la
riga dell'esito fra i **figli diretti** del box — incartare le sezioni le ucciderebbe **in
silenzio**. Il banco ha una prova apposta che lo vieta.
🚨 `ignoti` vale più dei tre numeri: una riga non letta rende la somma un **minimo**, dichiarato.
🩹 Il vecchio **«Totale da incassare» è stato TOLTO**, non affiancato (sarebbe stato il **quinto**
giro del difetto 136·145·147·150, stavolta sui soldi).
✅ TEST 6.340: a 1440 **744 in 744 ⇒ zero scorrimento**; a 390 una colonna.
⏳ **Non provato**: PROD, e il ramo «conto parziale».

---

## 6. 🧠 I DIFETTI DI METODO PRESI OGGI

- 🩹⭐⭐ **UNA DIAGNOSI DEL PASSAGGIO DI CONSEGNE PRECEDENTE ERA FALSA, E DETTAVA IL PRIMO LAVORO.**
  Diceva *«su TEST `st.payRows` è vuoto ⇒ il percorso non si attraversa»*. Misurato: **non era
  vuoto**. `staffCalPlayersState` è una variabile di **closure** e non sta su `window`, quindi da
  `page.evaluate()` si legge `undefined`. La scheda disegnava regolarmente 4 righe e 4 caselle.
  📌 *Un vuoto va attribuito alla propria sonda prima che al mondo — e quel vuoto era stato
  promosso a primo lavoro della sessione dopo.*
- 🩹⭐ **UNA SONDA CHE CONTA I SECONDI TROVA VUOTO E CI CREDE**: `await sleep(9000)` e poi
  `safeLoad` → zero record. Con un'**attesa che guarda il fatto** invece del cronometro: 26 record
  al primo giro. *Si aspetta il fatto, non un numero.*
- 🩹⭐ **UN BANCO TARATO SU UNA DISTANZA**: una prova cercava due `setAttribute` «entro 600
  caratteri» e dichiarava mancante ciò che c'era. E un'altra cercava «Totale da incassare» nel
  sorgente **intero**, trovandola **nei commenti che spiegano perché è stata tolta**.
  📌 *Una sonda tarata su una LUNGHEZZA misura quanto è lungo il codice; una che cerca una parola
  non distingue il codice dal racconto del codice.*
- 🩹⭐ **IL BANCO DELLA 149 AVEVA UN RITAGLIO A CASO** (`APP.slice(i, i + 4200)`): il ramo è
  cresciuto di poche righe e `amt.disabled` è finito fuori ⇒ dichiarava disabilitata una casella
  che nessuno aveva toccato. Ora conta le graffe. E la sua prova ⑤ è stata **rafforzata**: prima
  cercava una stringa **a parole**, adesso **esegue** la regola sui tre esiti.
- 🩹⭐⭐ **UN SABOTAGGIO SBAGLIATO HA SCOPERTO UN BUCO VERO**: togliendo dalla chiave il solo
  `pendenteCents` il banco restava **verde**, perché la prova cambiava i due numeri **insieme**.
  Difendeva «almeno uno dei due». 📌 *Un sabotaggio che non fa diventare rosso non dice «la cura è
  solida»: dice che il banco guardava altrove — e va creduto lui, non il verde.*

---

## 7. ⏳ COSA RESTA IN PIEDI

| | |
|---|---|
| **152** (aperta) | 🚨 **su PROD sfora ancora di ~10 px**, a intermittenza (vedi punto 0) · e il ramo «conto parziale» non è mai passato sul vivo |
| **151** (aperta) | provata su PROD; manca il suo occhio |
| **150** (aperta) | provata su TEST e PROD; manca il suo occhio |
| **149** (aperta) | in servizio; che il trattino si veda bene lo dice il suo occhio |
| **147** (chiusa) | ⚠️ chiusa nei registri, ma il difetto che curava si vedeva ancora ⇒ è nata la 150 |
| **142** (aperta) | id interno + Osservazioni nel gestionale ⇒ chiude anche la **138** |
| ⏳ **92 · 83 · 65 · 137 · 138** | invariate: aspettano un caso che non si può provocare |
| 🩹 **le «otto copie»** | il commento di `scrittura-al-circolo.ts` dice 8, sono **11** (punto 4) |
| ⚠️ **la partita di prova** | **lunedì 7 alle 9, Campo 4** — è il banco autorizzato su PROD |

---

## 8. 🤝 Come si procede

> 🥇 **POSTULATO**: la prova la faccio io — su TEST **e** su PROD — e lui **supervisiona che quel
> che ho detto sia vero**.
> 🚀 **La promozione a PROD non si chiede.** 🔎 **Lui controlla sempre su PROD.**
> 🟢🔴 **L'avviso ha due stati, e apre un campo invece di dare un compito.**
> 🎯 **Sulla scheda che segnala lui: campo libero — tranne salvare un pagamento.**
> ✋ Un task non è finito finché non è provato **fisicamente**.
> 🎨 Ogni modifica **visibile** parte da un mockup approvato (`mockup/`), e va detto prima.
> 📌 E: **«scrivi troppo» — risposte corte.**

⭐ **La regola che oggi ha pagato di più**, e viene dritta dalla sessione prima: *quando una misura
dice «non si può» o «non c'è», la prima cosa da sospettare è la sonda.* Stasera è successo
**quattro** volte — il `payRows` ereditato, i 26 record «mancanti», i due `setAttribute` «lontani»,
la frase trovata nei commenti. **Quattro su quattro erano miei.**

⭐⭐ E quella nuova, che è la lezione della 152: *chi cambia la **parentela** del DOM per ottenere
un layout paga in **guardie che muoiono in silenzio**.* Una disposizione si cambia con la
disposizione.
