# Passaggio di consegne — 06/09/2026, NOTTE FONDA (96ª sessione)

> **Prompt di apertura per la chat nuova.** Copia il blocco qui sotto.

---

## 📋 PROMPT DA INCOLLARE

> Riprendi il progetto **PADEL MATCH ORGANIZER**.
>
> Leggi PRIMA, in quest'ordine: **`CLAUDE.md`**, **`docs/lavori/README.md`** (le tre liste) e
> questo file.
>
> 🚨 **Il checkout locale può essere STANTIO**: `git fetch` e confronta gli **sha** prima di
> qualunque cosa — `git status -sb` dice «allineato» e mente (successo il 06/09: **50 commit**
> indietro).
> ⚠️ **La console remota vuole `npm install`** (`cd tools/verifica-browser && npm install`, ~1′):
> il container nasce senza playwright. Le `PMO_VERIFY_*` **ci sono già** nell'ambiente cloud.
> ⚠️ **Deno non si installa da qui** (403). Le prove `.ts` le lancia la CI; in locale
> `node --experimental-strip-types`, e i `test/*.test.mjs` girano con `node <file>`.
>
> ---
>
> 🔴 **C'È UNA VOCE URGENTE, ED È UN GUASTO DI PRODUZIONE SU UNA FUNZIONE DI CASSA: la 171.**
> **L'incasso dalla scheda partita non funziona per NESSUN metodo** — misurato due volte su PROD
> la notte del 06/09, con due metodi diversi, su una partita vera:
> · `method: 'wallet'` → *«Pulsante metodo "Saldo disponibile" non trovato nel dialog incasso»*
> · `method: 'cash'` → *«Pulsante metodo "Contanti" non trovato nel dialog incasso»*
> ⇒ Non è l'etichetta di un metodo: **è il dialog**. Nessun denaro è stato mosso (il gesto fallisce
> **prima** del click sul metodo) e tutto è stato rimesso com'era.
>
> 🎯 **Il primo passo è già deciso e non va ridiscusso**: far dire al worker **quali voci VEDE** nel
> dialog, invece di dire solo quale cercava. Senza quello ogni tentativo è un giro alla cieca su
> una cassa vera. Poi si rifà un tentativo (che fallirà di nuovo senza toccare niente) e si legge.
>
> ---
>
> 🔑⭐⭐ **HAI GIÀ LA SUA AUTORIZZAZIONE PER DUE PROVE CHE SCRIVONO — usale, non richiederle.**
> Sue parole del 06/09 notte fonda:
>
> > *«nel passaggio di consegna nel prompt scrivi anche di provare sia il pagamento col borsellino
> > e poi storno e anche il pagamento della partita e poi storno con Fabiola nella partita di
> > lunedì sette alle dieci e trenta»*
>
> ⇒ **Bersaglio**: **Fabiola Limuti** nella partita di **lunedì 7 settembre, ore 10:30, Campo 4**
> (`idReserva` **9844**; lei ha `idx` 2, id interno `301`, codice `000291`).
> ⇒ **Gesti autorizzati, DUE giri completi:**
> ① pagamento **col borsellino** → storno;
> ② pagamento **della partita** (contanti/carta) → storno.
>
> 🚨🚨 **MA PRIMA VA CURATA LA 171, o nessuna delle due parte** — è misurato, non temuto: stanotte
> tutti e due i metodi hanno risposto *«Pulsante metodo … non trovato nel dialog incasso»*. Farle
> adesso vuol dire ripetere due fallimenti già visti. ⇒ **Prima la sonda, poi la cura, poi le due
> prove.**
>
> ⚠️ **Tre cose da sapere prima di premere, tutte pagate stanotte:**
> ① **si incassa ESATTAMENTE il pendente** (oggi `800` = 8,00 €). Con un importo diverso il worker
>    **riscrive l'importo a carico sulla prenotazione vera** e **lo storno non lo rimette**;
> ② per il **borsellino** Fabiola parte da **0,00 €**: va **ricaricata** prima (8,00 €) e il
>    borsellino va **rimesso a 0** alla fine — la sequenza completa è *ricarica → pagamento →
>    Incassi → storno → storno della ricarica*, e stanotte i primi due passi hanno già funzionato
>    (ricarica 9,7 s, `balanceCentsPost: 800`);
> ③ 🗣️ **fra il pagamento e lo storno ci si FERMA a guardare gli Incassi** — suo ordine del 06/09:
>    *«Prima dello storno vai a vedere in incassi se ti torna tutto e poi fai lo storno.»* Lo storno
>    cancella la scena: un incasso col metodo o l'importo sbagliato si vede **solo mentre c'è**.
>    ⏱️ Il sync incassi di oggi gira **ogni 5 minuti** (`*/5 6-21 * * *`): si aspetta fino a ~5′, non
>    di più.
>
> ⛔ **E il bersaglio SCADE**: passato lunedì 7, quella partita non esiste più come prova. Se ci si
> arriva dopo, se ne sceglie un'altra con un **pendente vero** e — per il borsellino — un socio a
> cui si possa ricaricare e poi togliere. ⛔ **Non Maurizio Aprea**: la sua quota è sempre offerta
> (`gift` a 0) e `/collect-payment` si ferma su `ALREADY_PAID`.

---

## 📏 STATO ALLA CHIUSURA — misurato, non ricordato

| | |
|---|---|
| **PROD** | app **6.390** (verificata servita, non dedotta dal ramo) |
| **TEST** | app **6.391** (1 = allineati) |
| liste | 🔴 urgenti **1** (la 171, nuova) · 📋 in coda **13** · 📦 chiuse **151** |
| rami | `docs/`, workflow, `CLAUDE.md`, `server.mjs` **identici**; guardie **verdi** |
| voce 143 | metà **rilettura** in servizio e **provata su PROD**; metà **pagamento** non provabile finché la 171 non è curata |
| PR | **nessuna aperta**: #1430 · #1431 · #1432 · #1434 · #1435 · #1436 tutte mergiate |

⚠️ **Le versioni si rimisurano:**
```
curl -s -H 'Cache-Control: no-cache' "https://app.padelvillage.club/?cb=$(date +%s)" | grep -o "APP_VERSION = '[0-9.]*'"
curl -s "https://test.padelvillage.club/app-meta.json?cb=$(date +%s)"
```

---

## 🔴 LA 171 — cosa si sa, cosa no, e da dove si riparte

### Il fatto, misurato due volte
Partita **9844** (lunedì 7/09, 10:30, Campo 4), su **Fabiola Limuti** (id interno `301`, codice
`000291`), importo **8,00 €** — cioè **esattamente il pendente**, scelto apposta perché con un
importo diverso il worker **riscrive l'importo a carico sulla prenotazione vera** (`cargo_set`) e
lo storno **non lo rimette**.

| tentativo | metodo | risposta |
|---|---|---|
| 1 | `wallet` | `FORMA_PAGO_NON_TROVATA` — *«Saldo disponibile» non trovato* |
| 2 | `cash` | `FORMA_PAGO_NON_TROVATA` — *«Contanti» non trovato* |

✅ **Nessun danno**: pendente rimasto `800`, **zero** record `payment`, e il borsellino di Fabiola
— caricato di 8,00 € per il primo tentativo — **rimesso a 0** (i due `wallet_txn` +800 e −800 si
annullano).

### Le ipotesi, in ordine di costo
1. 🥇 **il dialog non si apre più** — il click su «Incassare» (`partIncassaBtn`) non produce quello
   che produceva. È l'unica che spiega **tutti e due** i fallimenti con una causa sola;
2. il dialog si apre ma è **cambiato dentro** (i metodi non sono più `button`/`a`/`[onclick]` con
   quel testo);
3. le **etichette** sono cambiate tutte e due insieme.
⛔ **Cade** l'ipotesi «la voce del borsellino compare solo con saldo»: il saldo c'era (8,00 €,
confermati dal worker con `balanceCentsPost: 800`) e comunque **Contanti** non dipende da nessun saldo.

### Da dove si riparte, concretamente
· `_clickCobroMethod` in `tools/matchpoint-browser-worker/src/server.mjs` — è la funzione che
  fallisce, e **oggi non elenca cosa ha visto**: `throw fail('FORMA_PAGO_NON_TROVATA', …)` dice solo
  quale cercava;
· 🚨 **il worker si modifica da `main`**, mai su `test-preview` (regola del `CLAUDE.md`), e il deploy
  è `deploy-worker-hetzner.yml`;
· ⚠️ **il worker è UNO SOLO e condiviso TEST+PROD**: mentre lo si riavvia, si ferma anche il sync
  delle prenotazioni;
· quando abbia smesso **non si sa**: l'ultimo incasso riuscito di cui c'è traccia è quello chiesto
  dal committente il **02/09** (voce 125, contanti). ⇒ Fra il 02/09 e il 06/09 è cambiato qualcosa,
  probabilmente **Matchpoint** — che il worker pilota per selettori e testi.

---

## ✅ LA VOCE 143 — cosa è in servizio e cosa è PROVATO

**La cura**: dopo un gesto che muove il borsellino, il saldo si **rilegge** dal circolo (in
sottofondo, ~10-18 s) e finisce in **due** posti: la **fotografia** `wallet_balance` nel gestionale
(che vede tutta la segreteria) e il **chip 👛** nella scheda partita, che legge `p.saldoCents` ed è
dove sta l'occhio del cassiere. ⛔ Il saldo **non si calcola**, si chiede.

### Provato FISICAMENTE su PROD (non a banco)
| gesto | esito |
|---|---|
| **↻** nella scheda socio (zero euro) | la riga `wbal\|7d45…` è passata da `source: matchpoint` (19:31:04) a **`source: pmo_wallet_read`** (19:33:15), 6 campi esatti — quella parola nessun sync la scrive. **17,7 s** |
| **ricarica** di 8,00 € a Fabiola | fotografia scritta nell'istante: `source: pmo_wallet_correct`, `id_cliente: 000291`. **9,7 s** |
| dopo un incasso **fallito** | **nessuna** rilettura parte (spia su `wallet-read`: **0** chiamate) — i casi ⑩ e ⑪ del banco visti sul campo |

### ⛔ NON provato, e non lo sarà finché la 171 è aperta
Il **pagamento col borsellino** end-to-end: nessun incasso è mai riuscito, quindi la rilettura
**dopo un pagamento** non è mai stata esercitata. La voce **resta aperta** per questo.

### 🚨 Il difetto trovato NELLA CURA, e già corretto (6.390)
La prima stesura scriveva nel campo `id_cliente` della fotografia l'**id interno**; il sync ci
mette il **CODICE CLIENTE**. 📏 La prova che sono due namespace: `id_cliente` **191** in archivio è
**Luciano Pase** (codice `000191`), ma **191** in un roster è l'id interno di **Valeria Moschet**
(codice `000182`).
🚨 **Non si vedeva dalla prova**, fatta su Maurizio Aprea: id interno `4`, codice `000004` — **i due
numeri coincidono**. 📌 *Un caso di prova scelto fra quelli dove i due valori coincidono non prova
niente sui due valori.*
⇒ Ora il codice lo passa il **chiamante** (`socio.memberId`); senza socio agganciato resta `null`.

---

## 🧠 LE TRAPPOLE INCONTRATE, per non ripagarle

1. 🚨 **Il worker RISCRIVE l'importo a carico** se incassi un importo diverso dal pendente
   (`cargo_set:X->Y`, salvato su Matchpoint) — **e lo storno non lo rimette**. ⇒ Si incassa
   **esattamente** il pendente, o si crea un debito che prima non c'era.
2. 🚨 **Maurizio Aprea non si può usare per provare un incasso**: la sua quota è **sempre offerta**
   (`stato: riscosso`, importo `0`, e in archivio **tutti** i suoi pagamenti sono `gift` a 0).
   `/collect-payment` si ferma su `ALREADY_PAID` senza toccare niente.
3. 🚨 **Col borsellino si paga solo fino a quello che c'è**: quasi nessun socio ha saldo (40 righe
   `wallet_balance` in tutto, 36 non-zero su 2823 soci). Per provare bisogna prima **ricaricare**,
   e poi **rimettere a posto**.
4. 🚨 **Un metodo solo non basta a diagnosticare un dialog**: provare `wallet` e concludere
   sull'etichetta del wallet era sbagliato. Il secondo tentativo con `cash` è costato due minuti e
   ha spostato il difetto di un piano.
5. ⚠️ **La scheda partita si apre SUBITO coi dati del gestionale** (voce 142) e il roster vero dal
   worker arriva **dopo** (4-6 s): chi legge subito vede righe **senza importi** e conclude male.
   Si aspetta **il fatto** (`pendenteCents` presente), non i secondi.
6. ⚠️ **La console remota blocca `/functions/v1/` di default**: senza `--allow-writes` la scheda si
   apre a metà e sembra un difetto dell'app. E `--allow-writes` su PROD **scrive davvero**.
7. ⚠️ **Un banco può accusare il codice giusto**: `_pmoWalletRileggiDopoGesto` cattura
   `staffCalPlayersState` per valore ⇒ il contesto va fabbricato **dopo** aver messo il roster; e
   `estrai()` tronca l'`async` davanti a `function`, producendo un errore di sintassi che sembra
   del codice in servizio.
8. 🚨 **Un file di `_shared/` cambiato DA SOLO non rideploya nessuna edge** (l'`awk` del workflow
   salta le cartelle con `_`): deploy **verde** e in servizio resta la regola vecchia. Stanotte non
   è successo (nello stesso commit cambiavano anche le funzioni, **verificato leggendo il sorgente
   in servizio**), ma la trappola resta aperta. Sta fra le *«nate misurando»*, **non** in coda.

---

## 🔧 COSA HO CAMBIATO STANOTTE (5 promozioni a PROD)

| # | cosa |
|---|---|
| 1430 | voce 143 seconda metà: `matchpoint-wallet-read` **scrive** la fotografia; l'app rilegge in sottofondo dopo un pagamento col borsellino; il chip 👛 si aggiorna |
| 1431 | anche il **↻** della scheda socio archivia quello che legge |
| 1432 | registri (avvertenza sul saldo capiente) |
| 1434 | 🚨 **correzione**: alla fotografia va il **codice cliente**, non l'id interno |
| 1435 | apertura della voce **171** |
| 1436 | ⏳ **da mergiare**: la 171 corretta (è il dialog, non il borsellino) |

**Banchi**: `supabase/functions/_shared/fotografia-saldo.test.ts` (12 casi, sabotato 3 volte) e
`test/il-saldo-si-rilegge-dopo-il-gesto.test.mjs` (**17 casi**, che estraggono le funzioni da
`index.html` e le **eseguono**, sabotati 6 volte).
🚨 **E il banco aveva un buco**: i primi otto casi restavano **verdi** spegnendo l'aggancio
(`if (method === 'wallet')` → `if (false)`). Sono stati aggiunti i casi che eseguono
`_pmoCollectPayment` per davvero.

---

## 📏 LE MISURE CHE VALE LA PENA NON RIFARE

| cosa | valore |
|---|---|
| una lettura del saldo al worker (↻) | **17,7 s** |
| una ricarica del borsellino | **9,7 s** |
| roster vero dal worker dopo l'apertura scheda | **4-6 s** |
| sync **incassi di oggi** | `*/5 6-21 * * *` ⇒ **ogni 5 minuti**, non «~5 min» a caso |
| sync **incassi storico** | `23 * * * *` (orario) |
| routine **saldi borsellino** | ogni **10 minuti** dentro `pmo_dispatch_data_routines` (regge: è sua decisione del 04/09) + un cron `*/30` che la affianca |
| righe `wallet_balance` in archivio | **40** (36 non-zero) su 2823 soci |
| Fabiola Limuti | id interno `301` · codice `000291` · `member_local_id` `640a444a-b077-473f-8b6c-009b117d1bd5` |
| Maurizio Aprea | id interno `4` · codice `000004` · `member_local_id` `7d454239-929a-4346-8ba0-ec778d7763a3` |

---

## ⛔ COSA NON DARE PER FATTO

- **la 143 resta APERTA**: manca la prova del pagamento, che dipende dalla 171;
- **la 171 non ha ancora una causa**, solo tre ipotesi ordinate: la prima cosa è la **sonda**, non
  la cura;
- **il borsellino di Fabiola è a 0,00 €** e il suo pendente sulla 9844 è **8,00 €**: è lo stato di
  partenza, non un residuo da sistemare;
- ⚠️ **la partita 9844 è di lunedì 7 mattina**: passata quella, come bersaglio di prova non esiste
  più e ne va scelto un altro (con un pendente vero e, per il borsellino, un saldo capiente);
- **l'arricchimento della 142 è ancora ACCESO a tetto 1** e continua a girare;
- **non misurato**: se l'incasso funzionasse da un browser umano (cioè se il guasto sia del worker
  o di Matchpoint). È la domanda che la sonda della 171 deve chiudere.

---

## Regole di sempre (dal `CLAUDE.md`, che va comunque riletto)

- la catena è **① sviluppo → ② provo su TEST → ③ porto su PROD SENZA CHIEDERE → ④ provo su PROD →
  ⑤ lo avviso**;
- **ogni deploy su PROD si annuncia**, misurando `APP_VERSION` **e** `last-modified`;
- si **misura** invece di dedurre, e quando la misura smentisce una riga scritta, **si corregge
  quella riga**, non la si affianca;
- ogni cura si dichiara per quello che ha provato **e** per quello che **NON** ha provato;
- prima `test-preview`, **poi** un ramo da `main` con le **stesse righe** (la versione a mano);
- a ogni promozione **PROD prende il numero che TEST aveva**, e **TEST riparte da +1**;
- ⛔ **irreversibile o visibile da fuori si dice PRIMA**, anche procedendo.
