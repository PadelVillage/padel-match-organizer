# Passaggio di consegne — sera del 21/08/2026

**Come si usa:** incolla questo file (o il suo contenuto) come primo messaggio della chat nuova.
È scritto per essere capito **senza** la conversazione precedente: dove serve un fatto, il fatto
è qui dentro, non «come dicevamo».

Il lavoro nasce da una richiesta del committente: *«controllami tutto il flusso che abbiamo
creato sul bot… ho bisogno di una tua valutazione, se secondo te si può migliorare la usability»*.
Da lì sono usciti una revisione, quattro cure già in servizio, due fasi di lavoro sull'usabilità,
e due difetti trovati misurando.

---

## 1. Cosa gira ADESSO sul bot dei soci

Bot `@loziocoach_bot`, processo pm2 `assistente-telegram` sulla VM Hetzner.
Ultimo deploy: **21/08 ore 20:48** (e uno successivo con la cura del roster), da `main` del repo
`assistente-padel-agent`. All'avvio ha dichiarato `qqbf… (PROD)` · `✍️ prenotazioni REALI`.

In servizio da oggi:

| | cosa | dove |
|---|---|---|
| **Cure delle frasi** | tre messaggi dicevano il falso (l'invito scaduto diceva «la partita è già cominciata»; due punti degli inviti rispondevano col testo della *rubrica*, e nel caso peggiore annunciavano la scomparsa di una persona che stava per giocare) | `invito-partita-testi.ts` |
| **Confronto nomi** | la guardia «sei già in campo» usava una funzione sensibile all'ordine delle parole, mentre il gestionale scrive ora «Nome Cognome» ora «Cognome Nome» ⇒ bucava. Ora usa la gemella del ponte; l'altra si chiama `chiaveNomeEsatta` | `bot.ts`, `rubrica.ts` |
| **Prove automatiche** | il repo aveva 1376 prove verdi e **nessuno che le facesse girare**. Ora `prove.yml` gira a ogni push, su Node 24 come la VM. Non deploya niente | `.github/workflows/prove.yml` |
| **Interventi minori** | `ambienteCorrente` leggeva l'indirizzo come testo (stesso difetto curato altrove il 7/08); il «tetto agli inviti» era una promessa nel commento e nessuno la chiamava (tolta, per decisione del committente); la documentazione dichiarava «sola lettura» in tre punti mentre il bot fa sei scritture | vari |
| **Fase A** | la chat torna una conversazione: l'esito e la scheda operativa non sono più una bolla sola — l'esito resta fermo come ricevuta, la scheda va in fondo e continua a riscriversi. E ogni **decisione** lascia scritto «✅ Hai risposto: …» (solo le sette che cambiano qualcosa, mai la navigazione) | `bot.ts`, `eco-decisione.ts` |
| **Fase B** | l'organizzatore vede «🎾 In attesa di risposta: …» sulla scheda; l'invito dichiara «⏰ L'invito vale fino alle …»; quando il posto finisce chi aspettava **viene avvisato** (messaggio nuovo, non riscrittura: `editMessageText` non notifica) | `bot.ts`, `invito-partita-testi.ts`, `gestisci-testi.ts` |

Banco: **1425 prove verdi**, `tsc --noEmit` pulito.

---

## 2. 🔴 COSA BLOCCA — la prima cosa da fare

### La PR #953 del gestionale è aperta e va mergiata

https://github.com/PadelVillage/padel-match-organizer/pull/953

**Il caso che l'ha fatta nascere** (dal registro del bot dei soci, 21/08):

| ora | cosa |
|---|---|
| 20:50:58 | il committente toglie Fabiola e Lidia **dal bot** |
| ~20:52 | rimette Lidia **dal gestionale** |
| 20:56:01 | il sync porta il dato → il gestionale dice «Maurizio + Lidia» |
| 20:56:27 | riapre la scheda → il bot mostra «⭐ Maurizio — posto libero —…» |

**Causa**: quando il socio toglie qualcuno, il bot lo nasconde per 15 minuti (il sync ci mette un
paio di minuti, e senza quel ricordo il socio rivedrebbe la persona appena tolta). Il ricordo si
arrendeva solo quando la persona spariva dal dato — ma qualcuno l'aveva **rimessa**, quindi nel
dato c'era, e il ricordo la nascondeva lo stesso.

**Cura, in due pezzi**: `consumer-player-readmodel` espone `aggiornato_al` (il `synced_at` più
recente dello slot) — è la PR #953; e `senzaGiocatoriTolti` ha una terza porta: dato più recente
del mio gesto + persona ancora presente ⇒ non è ritardo, è un intervento dopo il mio ⇒ butto il
ricordo. Il pezzo del bot è **già in servizio**.

🚨 **Finché la #953 non è mergiata la cura non funziona**: il bot cerca un campo che il ponte non
manda ancora e, nel dubbio, si tiene il ricordo (verso prudente, deliberato). Il rimedio
temporaneo è aspettare 15 minuti.

📌 Dopo il merge va allineato **`test-preview`** con la stessa modifica: il contratto del ponte
vive sui due lati e le due copie dell'edge devono restare identiche.

---

## 3. Cosa deve fare il committente

**① Mergiare la #953** (protetta: serve la PR, il check `guard-main` gira da sé).

**② Il collaudo sul bot dei soci**, con la guida già scritta:
https://claude.ai/code/artifact/c43285c7-79eb-4ee3-b65f-2d98226314fe

Quattro prove, con *cosa toccare* → *cosa devi vedere* → *cosa vuol dire se non lo vedi*:
1. **le due bolle e l'eco** — basta lui, non tocca niente (`/prenotazioni` → «Togli un giocatore»
   → **«Lascia stare»**);
2. **la riga «In attesa di risposta» + la scadenza sull'invito** — serve il collaboratore;
3. **«Ci sto» e l'eco dal lato di chi riceve** — serve il collaboratore;
4. **la promessa mantenuta** (due invitati, uno accetta) — **saltabile**, serve un secondo invitato.

Accorgimenti: prenotare **per un giorno lontano** (sotto le 48 ore il bot non lascia annullare),
avvisare il collaboratore che riceverà messaggi veri, e alla fine annullare la partita dal bot.

⚠️ **Il collaudo NON si può fare sul bot di prova**, ed è verificato nel codice: verso TEST
`statoScrittura().simula` è `true` e il freno in `bot.ts` (dentro `schedaInvito`) esce **prima**
che l'invito venga creato ⇒ niente invito, niente scadenza, niente «Ci sto», niente riga «In
attesa». In più su TEST le prenotazioni non hanno sync e una prenotazione nata dal bot viene
cancellata dopo 120 secondi.

---

## 4. Cosa resta da fare

### Voce 68 — in coda (sezione C di `docs/lavori/README.md`)

**Lo staff agisce dal gestionale e ai soci non arriva niente.** Segnalato dal committente:
*«quando da gestionale faccio un'azione, cioè metto, levo giocatori o attivo partite o elimino
partite, sul bot dei soci non succede niente, cioè non arriva nessun avviso»*.

Misurato: è un buco di disegno in tre punti sommati —
① il bot non ha un **tipo di avviso** per «partita cambiata dallo staff» (`TipoAvviso` in
`avvisi.ts:41` elenca i nove che esistono);
② l'unico rilevatore di cambiamento (`decidiTornataIncompleta`, `avvisi.ts:398-424`) confronta
**un solo numero** e scatta solo sul calo da 4 a meno di 4 ⇒ le **aggiunte** non lo attivano, e
una **sostituzione** è invisibile perché il conteggio non cambia;
③ una partita **annullata** non viene nemmeno esaminata: il giro itera solo sulle partite che ci
sono adesso (`promemoria.ts:525`).

Il **dato arriva** (il readmodel rilegge live a ogni giro): manca chi lo confronti e chi lo dica.

**La regola, dettata dal committente**: *«ogni volta che si fa un'azione [dal] gestionale e si
interpella un giocatore, al giocatore vanno i messaggi»* ⇒ un'azione dello staff produce per il
giocatore lo **stesso** messaggio che produrrebbe la stessa azione fatta da un socio dal bot: si
riusano i testi esistenti, non se ne inventano di nuovi.

**Tre punti da confermare prima di scrivere codice** (stanno nella voce, con la proposta):
① avvisare anche gli **altri** in campo, non solo l'interpellato; ② la **raffica** — in segreteria
si fanno più gesti di fila, quindi finestra di quiete (~2-3 min) e si manda lo **stato finale**;
③ **toccato ≠ cambiato** — chi apre e salva senza modifiche non fa partire niente.

**Cosa il bot manda già** (misurato, e riduce molto il lavoro): l'annullamento avvisa i compagni
(`testoPartitaAnnullata`), il «togli» avvisa la persona tolta (`testoSeiStatoTolto`), l'accettazione
avvisa entrambe le parti. 🚨 **L'uscita NON avvisa nessuno, per decisione del committente** — «avvisa
tu i tuoi compagni» — quindi *«lo staff fa come il socio»* non si applica meccanicamente: là il
silenzio è voluto perché chi esce è presente. La regola va scritta sul **chi subisce**, non sul verbo.
Manca un messaggio solo, da scrivere: «ti hanno messo in partita» per chi viene aggiunto senza invito.

**Dove va scritto — e il punto tecnico che decide la strada**: gli avvisi puntuali (annulla, togli,
accetta) **non passano dal registro persistente**: la loro unica difesa contro il doppione sono le
memorie di processo del bot (`in-corso.ts`, `fatto-compiuto.ts`), che un'edge del gestionale **non
condivide**. ⇒ La forma sensata è: il gestionale **dichiara il fatto** (una riga di coda), e **il
bot decide se e quando dirlo**, dove le protezioni già vivono. Resta conforme a *il gestionale SA,
il bot DICE* — il gestionale dice **cosa è successo**, non **a chi scrivere**.
Il ponte già pronto è `bot-telegram-admin` (oggi ci passano solo whitelist e inviti d'accesso).

### Altro
- **Proposta 3 del mockup** (il colpo d'occhio sulla settimana): **rimandata** per scelta — aiuta
  a consultare, non a organizzare. Resta disegnata nel mockup.
- **Allineare `test-preview`** dopo il merge della #953.

---

## 5. Trappole imparate oggi (per non ripagarle)

- **Su TEST non si collauda il flusso degli inviti**: il freno esce prima che l'invito esista. E
  una prenotazione nata dal bot su TEST viene cancellata dal sync dopo 120 secondi.
- **Il ricordo dei tolti dura 15 minuti** e nasconde chi hai appena tolto: se togli e rimetti la
  stessa persona in fretta, non la vedi (curato con `aggiornato_al`, ma solo dopo la #953).
- **Il registro del bot si legge senza entrare sulla VM**: workflow `stato-bot.yml`
  (sola lettura, accetta una regex). È così che è stata trovata la sequenza delle 20:50.
- **`editMessageText` non notifica**: per «dirlo» al socio serve un messaggio nuovo. Ha corretto
  il disegno del mockup mentre lo scrivevo.
- **Le guardie del banco vanno aggiornate, non allentate**: quando cambia il *meccanismo* e non la
  *regola*, si insegna loro il posto nuovo. Una guardia cercava «le tre righe dopo la chiamata» e
  diventava rossa **per un commento aggiunto**: è stata riscritta perché cerchi l'assegnazione.
- **Numeri dichiarati nei documenti**: in un messaggio di commit era finito «1419 prove» invece di
  1406. In questo progetto un numero dichiarato che non corrisponde al misurato è precisamente il
  difetto che si sta curando: si verifica prima di scrivere.

---

## 6. Riferimenti

**Rami** (`assistente-padel-agent`): tutto già su `main` — `claude/cure-frasi-e-confronto-nomi`,
`claude/interventi-minori`, `claude/fase-a-b-flusso`, `claude/rimesso-dal-gestionale`.
**Ramo** (`padel-match-organizer`): `claude/padel-village-bot-flow-fykexm` (mockup + voce 68 +
questo file) e `claude/roster-aggiornato-al` (la PR #953).

**Pagine**:
- revisione del flusso → https://claude.ai/code/artifact/cbbf0f3c-dab9-425c-bfdb-4e1428c3e90f
- mockup delle proposte → https://claude.ai/code/artifact/62a46c9d-8351-4dd3-8994-36b4468fa2e0
- guida al collaudo → https://claude.ai/code/artifact/c43285c7-79eb-4ee3-b65f-2d98226314fe

**Se qualcosa va storto sul bot**: si torna indietro deployando `deploy-bot-hetzner.yml`
(bersaglio `soci`, conferma `SOCI`) su un commit precedente. Due minuti, il `.env` non si tocca.
