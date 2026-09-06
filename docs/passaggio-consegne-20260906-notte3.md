# Passaggio di consegne — 06/09/2026, NOTTE (97ª sessione)

> **Prompt di apertura per la chat nuova.** Copia il blocco qui sotto.

---

## 📋 PROMPT DA INCOLLARE

> Riprendi il progetto **PADEL MATCH ORGANIZER**.
>
> Leggi PRIMA, in quest'ordine: **`CLAUDE.md`**, **`docs/lavori/README.md`** (le tre liste) e
> questo file.
>
> 🚨 **Il checkout locale può essere STANTIO**: `git fetch` e confronta gli **sha** prima di
> qualunque cosa (il 06/09 è successo: **50 commit** indietro con `git status` che diceva
> «allineato»).
> ⚠️ **La console remota vuole `npm install`** (`cd tools/verifica-browser && npm install`, ~1′):
> il container nasce senza playwright. Le `PMO_VERIFY_*` **ci sono già** nell'ambiente cloud.
> ⚠️ **Deno non si installa da qui** (403). Le prove `.ts` le lancia la CI; in locale
> `node --experimental-strip-types`, e i `test/*.test.mjs` girano con `node <file>`.
>
> ---
>
> ## 🟢 LA 171 È CURATA: INCASSO **E** STORNO FUNZIONANO, provati su PROD con denaro vero
>
> | gesto | esito misurato |
> |---|---|
> | **incasso** contanti 8,00 € (Fabiola, 9844) | `ok:true · riscosso · pendente 0` — **23 s** |
> | **storno** dello stesso | `ok:true · in_sospeso · pendente 800` — **22 s** |
> | **borsellino** rimesso a 0 | `balanceCentsPost: 0` — **10 s** |
>
> ✅ **La partita 9844 è ESATTAMENTE com'era**: Lidia 800, Ospite 800, Fabiola 800 `in_sospeso`
> con borsellino **0**, Maurizio `riscosso` (la sua quota è sempre offerta). **Nessun residuo.**
>
> 🚨⭐⭐ **MA C'È UNA COSA CHE VA SAPUTA PRIMA DI FARE UN ALTRO STORNO: IL RIMBORSO FINISCE NEL
> BORSELLINO.** Dopo lo storno Fabiola aveva **8,00 € di credito** che prima non aveva. Il
> «rimborso con lo stesso metodo del documento» **non restituisce contanti: accredita il
> borsellino**. L'ho rimesso a zero, ma nessuno me l'aveva detto — l'ho visto perché ho riletto
> **tutta** la riga, non solo il pendente.
> 📌 *Uno storno non riporta il mondo com'era: lo riporta com'era **sul conto che guardavi**.*
> ⇒ **Dopo ogni storno si guarda anche il `saldo`**, non solo `pendente` e `stato`.
>
> ---
>
> ## 🎯 DA DOVE SI RIPARTE — il giro col BORSELLINO, che è la prova che manca
>
> È la seconda delle due prove che lui aveva autorizzato, e adesso **si può fare** (prima no:
> l'incasso non funzionava). Chiude anche la **voce 143**.
>
> **La sequenza, nell'ordine:**
> ① **ricarica** il borsellino di Fabiola di 8,00 € (`matchpoint-wallet-correct`, `addCents: 800`);
> ② **incassa col borsellino** (`matchpoint-payment-write`, `method: 'wallet'`, importo **pari al
>    pendente**, che va **riletto**, non ricordato);
> ③ 🗣️ **fermati a guardare gli Incassi** — suo ordine: *«prima dello storno vai a vedere in
>    incassi se ti torna tutto»*;
> ④ **storna**, e ⑤ **rimetti il borsellino a 0** (`subtractCents`), controllando il `saldo`.
>
> ⚠️ **Cosa aspettarsi che sia diverso**: la cassa `AyudaCobroEfectivo.aspx` è quella dei
> **contanti**. Col borsellino il terzo gradino potrebbe non esserci o essere un'altra pagina —
> il codice lo gestisce (se la cassa non compare prosegue, e l'esito lo dice la rilettura del
> pendente), **ma nessuno l'ha ancora visto**. Se fallisce: **prima la sonda, poi la cura**, che
> stanotte ha funzionato tre volte su tre.

---

## 🔑 DUE COSE CHE HA CAMBIATO LUI E VANNO SAPUTE

1. **L'utenza della console su PROD è `staff`** (non più `readonly`) con **tutti** i permessi
   spuntati — `manage_users`, `view_incassi`, `view_members_anagrafica`, `view_members_borsellino`
   compresi. ⚠️ Il `CLAUDE.md` in un punto dice ancora che quei quattro restano `no`: **la riga è
   da correggere**. Il ruolo si **misura** (`pmoStaffProfile.role`), non si ricorda.
   🩹 Il motivo per cui li ha spuntati tutti è **un difetto del gestionale che ha trovato lui**:
   *spuntando il capitolo, le sottosezioni non si attivavano*. Non è ancora una voce in lista.
2. **La modalità dei permessi della sessione è stata cambiata da lui**, perché il classificatore
   bloccava sia la console sia i pagamenti. ⇒ In una chat nuova **può ribloccare**: se un comando
   viene negato, non è il gestionale — è il guscio, e si chiede a lui.

---

## ✅ COSA È IN SERVIZIO (tutto su PROD, worker + edge)

| PR | cosa |
|---|---|
| #1438 | la **sonda**: davanti a un metodo non trovato il worker elenca cosa VEDE, iframe compresi |
| #1439 | `matchpoint-payment-write` **registra** la diagnosi (`console.error`) invece di solo restituirla |
| #1441 | **la cura**: il metodo si clicca nel **frame del dialog**, per **id**, con guardia sul nome |
| #1442 | la sonda anche sul **salvataggio** |
| #1443 | **la cassa**: il cobro si conferma in `AyudaCobroEfectivo.aspx`, con guardie su **importo e persona** |
| #1445 | la sonda anche sullo **storno** |
| #1446 | **lo storno**: si conferma in `SeleccionFormaPago.aspx` («Accettare», predefinito) |
| #1440 · #1444 | i registri |

⭐ **Il worker DICHIARA cosa sa fare** — si controlla, non si deduce dal ramo:
`/health` → `features: [… 'sonda-dialog-incasso', 'cobro-nel-frame-del-dialog',
'cobro-confermato-in-cassa', 'storno-conferma-rimborso']`.

---

## 🧠 LA COSA DA PORTARSI DIETRO: **erano TRE STANZE, e il difetto era sempre lo stesso**

La 171 sembrava un guasto dell'incasso. Era invece **un gesto cercato nella stanza sbagliata**,
tre volte di fila:

| | dove | cosa c'è dentro |
|---|---|---|
| ① | la **scheda** partita | «Incassare» per ogni riga |
| ② | iframe `CobroParticipanteReserva.aspx?id_participante=…` | i **metodi**: `CC_Datos_LinkButtonCobrarEfectivo` (Contanti) · `…CobrarTarjeta` (Carta) · `…CobrarSaldo` («**Saldo disponibile: 0,00**» — il testo porta il saldo dentro!) |
| ③ | iframe `cobro/AyudaCobroEfectivo.aspx?importe=…&idpeople=…` | la **cassa**: Annullare · **Incassare** (`CC_Datos_ButtonSoloCobrar`) · Incassare e stampare |
| ③b | iframe `Facturacion/SeleccionFormaPago.aspx` (solo storno) | «con quale metodo rimborsare?» · **Accettare** (`CC_Datos_ButtonAceptar`) |

📌 **Un elemento cercato nel contesto sbagliato non è «assente»: è ALTROVE** — e le due cose si
somigliano solo per chi guarda da un posto solo. Le tre ipotesi della scheda erano tutte sul
*cosa*; nessuna sul *dove*.
📌 **E la cura è sempre stata la stessa: guardare prima di cercare.** Mai indovinare un pulsante su
una cassa vera. Ogni volta che il gesto moriva, la sonda ha detto in un colpo dove fosse.

🚨 **Quando un dialog di Matchpoint non risponde, la prima domanda è «in quale frame sono?»**, non
«come si chiama il bottone». Vale per tutti i gesti futuri su quel gestionale.

---

## 🔒 LE GUARDIE NATE CON LA CURA (e perché non c'erano prima)

Finché il worker non cliccava, non servivano. Aprendo la strada sono arrivati i suoi pericoli:

· **il nome nel dialog** — il dialog è per-partecipante (`id_participante`): cliccare in un frame
  trovato per URL potrebbe incassare **alla persona sbagliata** ⇒ `COBRO_DIALOG_ALTRO_GIOCATORE`;
· ⭐⭐ **importo e persona dall'URL della cassa**, scritti da Matchpoint e leggibili **prima** di
  premere — l'unico istante in cui si sa *cosa* si sta per incassare e *a chi* **mentre si è
  ancora in tempo a non farlo** ⇒ `COBRO_CASSA_IMPORTO_DIVERSO` · `COBRO_CASSA_PERSONA_DIVERSA`.
  Il confronto è in **centesimi**, non fra stringhe.
· 🚨 **e l'esito reso onesto**: il worker tornava `ok:true` **sempre**, anche col pendente intero —
  l'app guarda `data.ok`, quindi avrebbe scritto **«✅ Incassato» su un incasso mai avvenuto**.
  Invisibile finché il gesto moriva prima. Ora `COBRO_NON_CONFERMATO` (non è passato) e
  `COBRO_ESITO_IGNOTO` (non lo so) sono **due risposte diverse**, e la seconda dice di non riprovare.

📌 *Una cura che apre una strada nuova porta con sé i pericoli nuovi di quella strada.*

---

## 📏 LE MISURE DELLA SERATA (da non rifare)

| cosa | valore |
|---|---|
| un incasso completo (contanti) | **23 s** |
| roster della scheda partita (`matchpoint-bookings-edit` con `read:true`) | ~10 s |
| Fabiola Limuti | id interno **301** · codice **000291** · idx **2** nella 9844 |
| pendente di tutti sulla 9844 | 800 (Lidia, Ospite, Fabiola) · 0 e `gift` per Maurizio |
| sync **incassi di oggi** | `*/5 6-21 * * *` **in UTC** (il db è UTC) |
| sync **incassi storico** | `23 * * * *` |
| finestra del report incassi | **[oggi−N, oggi]** sulla data della PARTITA |

🚨⭐ **E UNA TRAPPOLA NUOVA, misurata: la sezione Incassi NON può mostrare oggi un incasso su una
partita di DOMANI.** Il report che alimenta i `payment` è filtrato su una finestra che finisce
**oggi**: il mio incasso, su una partita del 7/09, non compare — nemmeno forzando il sync
(`reconcileWindow: 2026-09-04 → 2026-09-06`, 64 righe, nessuna con partita futura).
⇒ Non è un difetto della cura: è l'**orizzonte del report**. Chi cerca la conferma di un incasso
su una partita futura deve guardare **Matchpoint** (pendente/stato sulla scheda), non gli Incassi.

🚨 **E una seconda trappola, dello stesso tipo di quella della voce 143 — DUE NAMESPACE DI ID:**
nei record `payment` il campo `id_cliente` è il **CODICE** cliente (301 = *Lorenzo Marangoni*),
mentre nel **roster** della scheda partita `idCliente` è l'**id interno** (301 = *Fabiola Limuti*).
📌 Cercare un pagamento con l'id sbagliato dà **zero** con la stessa faccia con cui darebbe la
verità. Si cerca per `player_name`, o si converte.

---

## ⛔ COSA NON DARE PER FATTO

- **carta e borsellino non sono mai stati provati**: la cassa `AyudaCobroEfectivo` è quella dei
  **contanti**. Per gli altri metodi il terzo gradino potrebbe non esserci o essere un'altra
  pagina — il codice lo gestisce (se la cassa non compare prosegue, e l'esito lo dice la rilettura
  del pendente), **ma nessuno l'ha visto succedere**;
- **il giro col BORSELLINO è ancora tutto da fare** — è la seconda prova che lui aveva autorizzato:
  *ricarica → pagamento wallet → Incassi → storno → storno della ricarica*. Fabiola parte da
  **0,00 €**, quindi va ricaricata prima e rimessa a 0 alla fine;
- ⇒ **la voce 143 resta APERTA** per la stessa ragione di ieri: la rilettura del saldo **dopo un
  pagamento col borsellino** non è mai stata esercitata. Adesso però si **può** fare, perché
  l'incasso funziona;
- **lo storno vero non è ancora stato visto riuscire** (vedi il blocco in cima);
- **la voce 171 NON è ancora stata spostata fra le 📦 chiuse**: manca la prova dello storno e dei
  metodi diversi dai contanti. La scheda in `docs/lavori/README.md` dice cosa manca.

---

## Regole di sempre (dal `CLAUDE.md`, che va comunque riletto)

- la catena è **① sviluppo → ② provo su TEST → ③ porto su PROD SENZA CHIEDERE → ④ provo su PROD →
  ⑤ lo avviso**, e il ③ **non si chiede**;
- **la prova la faccio IO, lui supervisiona** — anche su PROD, con la console remota;
- ⛔ **irreversibile o visibile da fuori si dice PRIMA**, anche procedendo: una scrittura vera sul
  Matchpoint del circolo, un messaggio ai soci, `--allow-writes` su PROD;
- ⛔ **il salvataggio di un PAGAMENTO resta fuori dal campo libero**, e stanotte è stato fatto
  **solo perché lui l'ha autorizzato esplicitamente** per Fabiola sulla 9844;
- ogni cura si dichiara per quello che ha provato **e** per quello che **NON** ha provato;
- prima `test-preview`, **poi** `main`; il **worker si modifica solo da `main`**, e subito dopo si
  riallinea `test-preview` (punto 2 della regola anti-drift);
- **ogni deploy su PROD si annuncia**.
