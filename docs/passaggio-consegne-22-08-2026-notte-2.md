# Passaggio di consegne — 22/08/2026, seconda notte

**Come si usa:** incolla questo file come primo messaggio della chat nuova. È scritto per essere
capito **senza** la conversazione precedente.

⚠️ Ce ne sono altri dello stesso giorno (pomeriggio, sera, notte). Questo racconta le ore **dopo**
la mezzanotte del 22: se qualcosa sembra contraddirli, **vince questo**.

---

## 0. 🚨 LA PRIMA COSA DA FARE — c'è del lavoro NON FUSO

Sul repo `padel-match-organizer` esiste il ramo **`claude/leggi-allegato-p2e7uz`** con **un commit
non ancora fuso**: la regola di architettura in `CLAUDE.md` e l'aggiornamento della voce 75.

⛔ **Non è codice**: sono solo `CLAUDE.md` e `docs/lavori/README.md`. Ma sono file **sorvegliati da
`guard-worker-sync`**, quindi vanno fatti atterrare su **tutt'e due i rami**, in quest'ordine
(punto 4bis della regola anti-disallineamento):

1. prima `test-preview` — portando **le righe**, non il file, se ci fossero divergenze;
2. poi `main`, via PR.

📌 Tutto il resto della notte **è già in servizio**: edge su PROD, bot deployato ai soci.

---

## 1. 🎯 IL PIANO, deciso dal committente e ancora valido

> *«Direi di partire con le urgenti e man mano che le vado a testare ti do il responso. Poi
> possiamo anche passare a quelle in coda sempre da testare. Mi piacerebbe farne una alla volta e
> quando è testata, la mandiamo in chiuse.»*

⇒ **Il lavoro non è scrivere codice: è accompagnare le prove.** Una voce per volta, lui clicca, la
sessione misura, e la chiusura **la decide lui**. Si propone, non si esegue.

🚨 **La divisione che funziona:** *il committente clicca, la sessione misura.* Da una sessione cloud
non si prenota davvero, e inserire righe a mano nel database non è una prova — il sync le tomba.

⚖️ **E la regola che governa tutto:** *il banco dice che il meccanismo è giusto, non che i messaggi
arrivano.* Stanotte, di nuovo, **ogni volta che si è guardato un messaggio vero è saltato fuori un
difetto che rileggendo il codice non si vedeva** — due su due.

---

## 2. 🔁 LA REGOLA NUOVA — «chi conferma, chi registra, chi parla»

Disegnata **dal committente** stanotte, e già scritta in `CLAUDE.md` (nel commit non fuso, §0).

> **Ogni gesto va detto al socio SOLO DOPO che il circolo l'ha confermato — e nello STESSO ISTANTE
> dev'essere registrato dal gestionale.**

Sono **due metà** che governano momenti diversi:

| | governa | se si sbaglia |
|---|---|---|
| **solo dopo** | il **parlare** | un rifiuto di Matchpoint lascia dei soci avvisati di una cosa mai successa |
| **stesso istante** | il **registrare** | il socio legge «fatto» e un attimo dopo il gestionale non sa di cosa parli |

### Il diagramma, come l'ha corretto lui

```
① IL GESTO PARTE DALLA SEGRETERIA

   Segreteria ──gesto──▶ Gestionale ──comanda──▶ worker ──scrive──▶ Matchpoint
                              ▲                                          │
                              └───────────────── ok ─────────────────────┘
                              │                              (si ferma QUI)
                              │
                              └──▶ Socio · bot        (solo adesso: avviso)


② IL GESTO PARTE DAL SOCIO

   Socio·bot ──chiede──▶ Gestionale ──comanda──▶ worker ──scrive──▶ Matchpoint
                              ▲                                          │
                              └───────────────── ok ─────────────────────┘
                              │                              (si ferma QUI)
                              ├──▶ ① copia locale     (registra: la partita, da noi)
                              └──▶ ② Socio · bot      (risponde)

   ⛔ Socio·bot ⇠⇢ worker / Matchpoint : MAI, IN NESSUNO DEI DUE VERSI.
```

🚨⭐⭐ **La correzione che ha dato lui vale più della regola stessa**, perché è quella che si sbaglia
disegnandola: **l'ok di Matchpoint torna al gestionale e SI FERMA LÌ.** Non prosegue verso il bot,
né quando il gesto parte dalla segreteria né quando parte dal socio. A parlare col socio è **sempre
e solo il gestionale**.
⚖️ Non è pignoleria: se Matchpoint rispondesse al bot, il giorno in cui lo si spegne il bot andrebbe
riscritto. È la regola del 19/08 (*«il worker il bot non deve proprio filarselo»*) vista dal verso
del **ritorno** invece che dell'andata.

📌 **`①` e `②` del secondo schema non sono due momenti: sono lo stesso.** Ed è esattamente il punto
in cui la voce 75 si era rotta.

🎯 **La prova che tiene onesta la regola, applicabile oggi a ogni riga nuova**: *il giorno in cui
Matchpoint si spegne, il bot non si tocca.*

⏳ **Cosa NON è ancora vero:** la metà «stesso istante» vale per la **creazione**, non per
l'**annullo** (§4). Sugli altri gesti — entrare, uscire, togliere — **nessuno ha misurato**, e darli
per buoni sarebbe prendere un esito visto una volta per una regola.

---

## 3. ✅ Cosa è andato in servizio stanotte

### Voce 75 — «il bot rinnega la prenotazione che ha appena fatto»

**Segnalata dal committente col messaggio sullo schermo.** Sequenza misurata al secondo (registro
del bot in **ora di Roma**, database in **UTC**):

| ora (Roma) | |
|---|---|
| `10:53:59` | si annulla 31/08 · 09:30 · Campo 1 ⇒ la copia locale diventa una **lapide** |
| `20:58:32` | lo stesso socio riprenota **lo stesso slot** dal bot ⇒ «✅ Prenotato» |
| `20:58:53` | tocca «Invita un giocatore» — il bottone che il bot ha appena offerto |
| `20:58:57` | il bot: **«Non trovo più quella partita fra le tue»** + numero della segreteria |
| `21:02:18` | la partita arriva col sync, quasi quattro minuti dopo |

**Causa**, `supabase/functions/matchpoint-bookings-create/index.ts`: la chiave della copia locale
non contiene l'id della prenotazione, quindi due partite diverse sullo stesso slot **si dividono la
riga**. La guardia anti-fantasma (`if (esistente?.deleted === true) return`) vedeva la lapide del
mattino e usciva **senza scrivere**.

**METÀ A — curata, in servizio su PROD (#987), e VISTA FUNZIONARE.** La regola vive in un modulo
puro, `lapide-prenotazione.js`, e distingue con **due fatti** invece che con una soglia:
① l'`idReserva` quando c'è da entrambe le parti (diverso ⇒ è un'altra partita, si scrive; uguale ⇒
è l'annullo di questa, non si tocca); ② l'ordine fra sepoltura e inizio della scrittura, altrimenti.
Senza fatti confrontabili **si fallisce chiusi**.

🚨 **E la cura ne nascondeva una seconda**: l'upsert fonde `{...nostro, ...esistente}` e l'esistente
vince campo per campo. I campi di una **lapide** sono quelli dell'**altra** partita ⇒ fondendoli la
prenotazione nuova sarebbe nata **col nome e i giocatori della morta**. Su una riga viva si fonde,
sopra una lapide si **sostituisce**.

📏 **Vista funzionare alle 21:54:28**: riprenotato lo slot 31/08 · 11:00 · Campo 1 sopra la lapide
delle 10:54 — copia locale nata **nell'istante**, `id_reserva 9587`, e con **un solo giocatore**
mentre la lapide ne portava due.

**METÀ B — non andava scritta: esisteva già** (è la cura della voce 71) e non si vedeva mai perché
il flusso moriva un gradino prima. Curata la A è diventata raggiungibile — **e appena visibile ha
mostrato un difetto suo.**

### Il difetto della frase — «riprova» non diceva riprovare COSA

🗣️ **Segnalato da lui sul messaggio vero:** *«Se tu dici al socio di riprovare, lui riprova a
prenotare. Non va sulle mie partite. La gente si confonde.»*

⚖️ È la trappola della **voce 72 spostata dall'esito all'OGGETTO**: un'istruzione senza complemento,
letta da chi ha finito di prenotare venti secondi prima ⇒ **riprenota**, e il campo è occupato due
volte. E «fra un minuto» prometteva un tempo non mantenibile: oltre i 7 giorni l'organizzatore
arriva solo col giro pieno (**misurati 4′21″**).

✅ **Curata e deployata ai soci** (bot PR #60, commit `d65e94b`, processo ripartito alle 22:20:01).
Il messaggio adesso è:

> Sto ancora registrando questa prenotazione col circolo. **Attendi un attimo…**
>
> ✅ La partita è prenotata: non rifarla.
>
> Poi tocca il bottone qui sotto e potrai invitare chi vuoi.
>
> `[ 🔄 Riprova a invitare ]`

Tre cose: ① si dice che la prenotazione **è a posto** — si toglie il gesto pericoloso *prima* di
offrirne uno sicuro; ② l'oggetto del riprovare diventa un **bottone** che rifà lo **stesso** tocco
(`codificaElencaInvito`); ③ il tempo si dice **una volta sola**, in testa (sua scelta fra due
proposte).

---

## 4. 🆕 DUE REPERTI APERTI — l'annullo dal bot

Misurati la sera stessa, **non curati**. Nascono dal fatto che *annullare dal bot e annullare dal
gestionale non fanno la stessa cosa*:

① **L'annullo dal bot NON chiude la copia locale.** Misurato: annullo `22:25:10`, sepoltura col sync
`22:28:50` ⇒ **3′40″** in cui su Matchpoint il campo era libero e da noi risultava **occupato**.
⚖️ È il verso che fa male: un campo che sembra occupato mentre è libero è **un socio che non gioca**.

② **Quell'annullo si registra con data, ora e campo VUOTI:**
```
staff_cancel|||Campo |9587|consumer-assistente-soci      ← dal bot
staff_cancel|2026-08-31|11:00|Campo 1|9571|41e635df…    ← dal gestionale
```
L'`idReserva` c'è, ma chi cerca gli annulli **per slot** non li trova — ed è probabilmente lo stesso
motivo per cui **non parte la soppressione** (il meccanismo della voce 67 che fa sparire la card
all'istante).

📌 I due sono facce dello stesso pezzo mancante: **chi scrive quell'annullo lo slot non ce l'ha in
mano.** È la metà «stesso istante» della regola nuova, rotta sul verso dell'annullo.

---

## 5. 📋 La lista, com'è adesso

### 🔴 URGENTI — 6

| | stato | si può provare? |
|---|---|---|
| **63** inviti attaccati a una partita che non c'è più | curata, in servizio | ✅ sì — vuole ~30′ (due giri da 15′) |
| **64** un avviso automatico parte su una partita che stiamo cambiando noi | curata, in servizio | ✅ sì |
| **65** il nome del worker arrivava al bot nel «dettaglio» | curata, in servizio | ⚠️ si aspetta, non si provoca |
| **66** `PLAYER_ID_NOT_LOCKED` | 🔎 diagnosi fatta, cura NON scritta di proposito | ⛔ niente da provare |
| **67** una soppressione nasconde lo slot e la prenotazione nuova sopra | curata, in servizio | ✅ sì |
| **75** il bot rinnega la prenotazione appena fatta | **curata e VISTA**, due residui aperti | ✅ sì, vedi §6 |

### 📋 IN CODA — 8

**68** avvisi dal gestionale · **69** scheda senza telefono → socio doppio (*lavoro vero, non
scritto*) · **70** il circolo annuncia una cosa fatta dal socio · **71** «non l'hai organizzata tu»
· **72** una prenotazione che non riesce lascia il socio senza strada · **73** un annullo dal
gestionale non produce avvisi · **74** uno spostamento manda solo la metà cattiva · **60** campi
liberi nei circoli vicini (sezione D, *lavoro vero*).

⚠️ **Sulla 74**: uno spostamento manda **ancora due messaggi** invece di uno. È dichiarato e non
curato: durante le prove è atteso, non è un guasto nuovo.

---

## 6. 🧪 Le prove da fare

🚨 **Regola per tutte:** fra un gesto e il successivo **sulla stessa persona e partita** lasciar
passare **almeno due minuti**. Sotto quella soglia la quiete (`QUIETE_MS`) li fonde in un avviso
solo — è voluto, non è un difetto.

### 75 — il giro completo (non ancora fatto per intero)

1. **annulla** una partita del socio su uno slot, **dal bot**;
2. ⏳ **aspetta che sparisca anche dal gestionale** — con l'annullo dal bot non è immediato (§4①), e
   su una data oltre i 7 giorni può volerci **fino a un quarto d'ora**. ⚠️ **Senza questa attesa la
   prova non prova niente**: se la copia locale è ancora viva non c'è lapide, il codice entra nel
   caso «nessuna lapide» e passa senza aver esercitato il difetto — il verde muto della 43ª;
3. **riprenota lo stesso slot dal bot**;
4. appena leggi «✅ Prenotato», tocca **subito** «Invita un giocatore»;
5. ✅ **riuscita** = si apre la rubrica, oppure esce il messaggio d'attesa **nuovo** (con «non
   rifarla» e il bottone 🔄).
   ❌ **fallita** = torna «Non trovo più quella partita fra le tue» — quella è la frase vecchia.

### 63 · 64 · 67

Le istruzioni per queste tre stanno nel passaggio di consegne **precedente** (22/08 notte, §4) e
sono ancora valide.

---

## 7. 🧠 Trappole imparate stanotte

- 🚨 **Il confine di una cura non coincide col confine delle righe che si cambiano.** La fusione del
  payload non era nel difetto e non era nella cura: era nella riga **subito sotto** quella toccata,
  e senza accorgersene la cura avrebbe fatto nascere le prenotazioni coi giocatori di quelle morte.
- 🚨 **Una guardia che cerca una PAROLA prova che la parola c'è, non che chi legge capisca.** Il
  banco pretendeva `/riprova/i` — e la frase difettosa la soddisfaceva. Le guardie si **aggiornano**
  al meccanismo nuovo, non si allentano per farle tornare verdi.
- 🚨 **Il ramo che esiste solo su TEST.** Riallineando `test-preview` sono saltate fuori **due**
  chiamate in più alla scrittura della copia locale, nel ramo della simulazione: senza toccarle, la
  cura sarebbe stata monca **proprio dove la si sarebbe provata**.
- 🚨 **Un diagramma è un dato che qualcun altro legge.** Il primo disegno del flusso aveva le frecce
  di ritorno che **non toccavano** il riquadro del gestionale: chiaro per chi l'ha fatto, e letto da
  fuori diceva *«Matchpoint parla col bot»*. L'ha visto il committente in dieci secondi. Stessa
  forma dei difetti che stavamo curando.
- ⚖️ **Una misura senza il suo perimetro invecchia male.** «Il sync ritarda ~2 minuti» è vero
  **entro la settimana**: oltre i 7 giorni il ritardo vero è **fino a ~17′**, perché la finestra dei
  giri leggeri si ferma a 7 giorni e oltre serve il giro pieno (ogni quarto d'ora).
- ⛔ **Un rosso non è tuo finché non l'hai misurato.** Il typecheck dell'edge segnalava 1 errore: la
  stessa funzione su `main`, senza le modifiche, ne segnalava **1**. Preesistente. Lanciato a mano
  il gate perde il termine di paragone e tratta la funzione come nuova.

---

## 8. Riferimenti

**Fuso e in servizio stanotte:**
- gestionale: **#987** (voce 75 metà A) → PROD, deploy edge sul commit `038e84a`, verificato
  leggendo la funzione **viva** su Supabase (6 marcatori su 6);
- `test-preview` riallineato a mano: **`6ddda2e`** (righe del fix, non il file);
- bot: **#60** → `main`, deploy ai soci **`d65e94b`**, processo ripartito **22:20:01**, dichiara
  `✍️ prenotazioni REALI`.

**NON fuso** (§0): ramo `claude/leggi-allegato-p2e7uz` — `CLAUDE.md` (regola nuova) + voce 75
aggiornata.

**Stato dei banchi alla consegna:**
- gestionale **47 verdi, 0 rossi** (Node) + Deno verde; **8 sabotaggi nuovi**
  (`test/sabotaggi-voce-75.mjs`), tutti visti far cadere il caso giusto;
- bot **1459 verdi, 0 rossi**, `tsc --noEmit` pulito; due casi nuovi sul cablaggio, verificati per
  mutazione;
- typecheck edge: **1 errore preesistente**, identico a `main` — non introdotto da queste modifiche.

**Il repo del bot va riagganciato** nella sessione nuova: `add_repo` + clone in
`/home/user/assistente-padel-agent`, poi `npm install` (senza, i file di prova non partono e non è
un banco rotto).

**Fusi orari, perché stanotte è costato attenzione:** il **registro del bot è in ora di Roma**, il
**database in UTC**. Confrontare senza convertire fa sembrare che gli effetti precedano le cause.
