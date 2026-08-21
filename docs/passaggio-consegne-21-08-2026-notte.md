# Passaggio di consegne — notte del 21/08/2026

**Come si usa:** incolla questo file (o il suo contenuto) come primo messaggio della chat nuova.
È scritto per essere capito **senza** la conversazione precedente: dove serve un fatto, il fatto
è qui dentro, non «come dicevamo».

⚠️ **Non è il primo passaggio della giornata.** Ce n'è uno della sera
(`docs/passaggio-consegne-21-08-2026.md`), e questo racconta le **tre ore dopo**. Se qualcosa qui
sembra contraddire quello, vince questo — e la riga vecchia va corretta, non affiancata.

---

## 1. La cosa più importante da sapere subito

🎾 **La voce 68 è IN SERVIZIO su PROD, e la catena intera è stata provata dal vivo.** Quando la
segreteria mette o toglie un giocatore da una partita, o la annulla, al giocatore toccato arriva
un messaggio dal bot.

Ma **il primo giorno vero non c'è ancora stato**: l'unico fatto consegnato finora è uno di prova,
messo a mano. ⇒ **La prima cosa da fare in una sessione di domani è guardare come è andata**, e
sotto c'è come si fa.

🔌 **E c'è un interruttore**, se facesse danni: si spegne cambiando **un `true` in `false`** nella
kb, e basta. Nessun deploy, effetto al giro dopo (≤15 minuti).

```sql
-- SPEGNERE gli avvisi del circolo (progetto qqbfphyslczzkxoncgex)
update public.pmo_ai_settings
   set value = jsonb_set(value, '{avvisi_dal_circolo,attivi}', 'false'::jsonb)
 where key = 'assistant_kb' and env = 'prod';
```

Per riaccenderlo, `'true'::jsonb`. ⚖️ Spegne **solo** quegli avvisi: il resto del bot non se ne
accorge. Prima di stanotte l'unica strada era rideployare il bot indietro, che avrebbe spento
anche tutto il resto atterrato con lui.

---

## 2. 🔴 COSA BLOCCA — il collaudo delle quattro prove, appena cominciato

🗣️ Sua richiesta di stanotte: *«dopo che hai finito il lavoro facciamo questo?»* — cioè la guida
al collaudo delle **Fasi A e B**, scritta la sera e mai eseguita:

**https://claude.ai/code/artifact/c43285c7-79eb-4ee3-b65f-2d98226314fe**

⏸️ **Siamo fermi alla Prova 1**, che gli era stata appena proposta. Nessuna delle quattro è stata
eseguita. È la **richiesta da cui è nato tutto** — *«controllami tutto il flusso… se secondo te si
può migliorare la usability»* — e le due fasi sono in servizio da ieri sera **senza che nessuno le
abbia guardate con gli occhi di un socio**.

✅ **Il pre-volo è già fatto**: verificato che il commit in servizio (`2c6c0ae`) contenga tutto
quello che le quattro prove cercano — `eco-decisione.ts`, la riga «In attesa di risposta», la
scadenza sull'invito, il testo «Non ho toccato niente». ⇒ Se una prova fallisce, **non è perché il
codice non è arrivato**.

🚨 **DUE CORREZIONI ALLA GUIDA, da dire prima che tocchi il telefono:**

1. La guida dice *«se qualcosa non va, rimetto il codice di stamattina»*. **Non è più vero**: sopra
   ci sono la voce 68 e l'interruttore. Tornare indietro adesso spegnerebbe anche quelli.
2. **Gli avvisi del circolo sono accesi**: se durante le prove tocca il gestionale, possono
   arrivare messaggi della voce 68 che si mescolano a quelli del collaudo. Se confondono, si
   spengono col comando qui sopra e si riaccendono dopo.

📌 E un accorgimento in più: **evitare il 31 agosto 09:30 campo 1**, che è la partita vera con
Lidia Comes usata per il collaudo della voce 68.

---

## 3. Cosa è stato fatto nelle ultime tre ore

### La voce 68, dal nulla al servizio

Le **tre decisioni del committente** che l'hanno sbloccata:
① **solo la persona interpellata** (non gli altri in campo) · ② **2 minuti** di quiete poi lo
stato finale · ③ **toccato ≠ cambiato**.

⚠️ **L'annullamento è l'unica eccezione alla ①, ed è dichiarata**: la ① risponde a «oltre
all'interpellato, anche gli spettatori?», e in un annullamento spettatori non ce ne sono —
avvisarne uno solo manderebbe gli altri tre al campo.

**La forma**, conforme alla regola ferrea *il gestionale SA, il bot DICE*:

| pezzo | dove | cosa fa |
|---|---|---|
| `matchpoint-bookings-sync/eventi-staff.ts` | gestionale | confronta le due fotografie del calendario → i fatti |
| `pmo_eventi_staff` | `qqbf…` e `cudi…` | la coda dei fatti (RLS chiusa, potatura 14gg) |
| `consumer-staff-events/` | gestionale | quiete di 2′, raffica ridotta al netto, nome → persona |
| bot: `staff-testi.ts`, `staff-avvisi.ts` | bot | trova la chat, scrive in italiano |

⭐ Il giorno in cui Matchpoint si spegne, **il bot non si tocca**.

🚨 **I TESTI SONO NUOVI, e la voce prevedeva di riusare quelli esistenti.** Provandolo si scopre
che direbbero il falso: `testoSeiStatoTolto` dice *«Ti ha tolto X, che l'aveva organizzata»* e
*«parlane con X»* — quando a togliere è la segreteria, accusa una persona che non ha fatto niente
e manda il socio da chi non può rispondere.
⭐ E la ragione originale conferma il rovescio: il 20/08 il committente aveva tolto la segreteria
da quelle frasi perché *«il socio non ha un problema col circolo, ha un problema con una
persona»*. Qui il gesto l'ha fatto il circolo, quindi la segreteria **rientra**.

**Il collaudo dal vivo**, con la sua autorizzazione (*«fai tutto su prod usando maurizio aprea e
lidia comes»*):

| anello | prova | esito |
|---|---|---|
| ① sync → fatti | i **dati veri** di PROD, in sola lettura | 1 · 1 · **2** · **0** nei quattro casi |
| ② coda → ponte | `consegnato_at` | ✅ 20:50:44 |
| ③ ponte → bot | registro del bot | ✅ `🔔 detto a Maurizio Aprea` |
| ④ bot → telefono | **i suoi occhi** | ✅ *«Confermo che Maurizio ha ricevuto il messaggio»* |

📏 **Dal fatto al messaggio: 15′21″.** La finestra vera è **4-19 minuti** (ritardo sync ~2′ + 2′ di
quiete + il giro del bot, che passa **ogni 15 minuti**). ⚠️ Un primo numero scritto nei documenti
diceva «5-10 minuti» e **era sbagliato**: dimenticava il giro. È la differenza fra «non funziona»
e «non è ancora arrivato».

### Le prove girano in CI (PR #956)

Il repo del gestionale aveva **42 file di prova e nessuno che li lanciasse**. Ora `prove.yml` gira
a ogni spinta: gate **assoluto** (non c'era debito), **due corridoi** (Node e Deno — tre file sono
prove Deno che `node` non sa lanciare), e i file si **rilevano**, non si elencano.

🚨 **Scrivendolo sono usciti TRE difetti**, tutti invisibili perché nessuno lanciava niente:
① `test/guarda-finche-non-sai.test.mjs` era **rosso da tre giorni** (dalla #853): `pmoVerificheSegna`
aveva preso un quinto parametro e la guardia cercava la firma a quattro — **guardia aggiornata, non
allentata**; ② e ③ `creazione-cliente-telefono` e `schede-non-collegate` contavano i falliti e
**uscivano 0 lo stesso**: dentro un gate erano **prove finte**.

### L'interruttore della voce 68 (PR #54 sul bot)

Vedi §1. ⭐ **E scrivendolo sono usciti due difetti miei, prima che arrivassero ai soci**:
① le famiglie di avvisi erano diventate **tre** e il giro ne contava due (gli avvisi del circolo si
sarebbero spenti insieme alle altre); ② il rimedio a quel primo difetto invalidava una
`configGioco!` poco sotto, e il mio secondo rimedio — **una costante di ripiego** — **l'ha respinto
il banco**, che aveva ragione: la regola *«un messaggio mandato con orari inventati è peggio di uno
che non parte»* è scritta in due punti del codice.
⚖️ **Il secondo l'ha trovato la CI messa in piedi la stessa sera, mezz'ora dopo.** È la
dimostrazione più diretta del perché un banco che gira valga più di uno che esiste.

### Il doppione di Lidia Comes

Trovato **durante** il collaudo, ed è il difetto che le 42 prove non potevano vedere: aveva **due
schede vive** in anagrafica, stessa persona (`PMO-000583`, `001013`). La regola *«più di una scheda
⇒ non si scrive a nessuno»* le rifiutava entrambe ⇒ **non avrebbe mai ricevuto un avviso**, in
silenzio.

🩹 **Curato in due modi indipendenti**: la regola ora chiede *«puntano alla stessa persona?»* e non
*«quante schede?»* (PR #955); e la riga duplicata è stata cancellata a mano. **Zero persone doppie
su 2810 soci.**

---

## 4. Cosa resta da fare

### 🔴 Subito

1. **Il collaudo delle quattro prove** (§2) — è il lavoro in corso, interrotto alla Prova 1.
2. **Il primo giorno vero della voce 68.** Si guarda così:

```sql
-- I fatti prodotti e consegnati (progetto qqbfphyslczzkxoncgex)
select persona, gesto, data, ora, campo, visto_at, consegnato_at
  from public.pmo_eventi_staff
 order by created_at desc limit 50;
```

E il registro del bot, **senza entrare sulla VM**: workflow `stato-bot.yml` sul repo del bot
(`quale: soci`, `cerca: detto a|staff|circolo`).

⭐ **La coda dice da sola dove si è rotto**, ed è il pregio del disegno:

| cosa si vede | dove si è rotto |
|---|---|
| nessuna riga, ma la segreteria ha agito | il sync non confronta (o è scattata la guardia del crollo) |
| riga presente, `consegnato_at` vuoto | il bot non ritira (interruttore spento? ponte?) |
| `consegnato_at` pieno, niente messaggio | chat non trovata, o Telegram ha rifiutato |

### 📋 In coda (sezione C di `docs/lavori/README.md`)

- **Voce 69** — 🧬 *una scheda senza telefono nell'export genera un socio doppio*. Messa in lista
  da lui stanotte. È la causa del caso di Lidia. **1 su 2810**, nessuna urgenza: il ponte regge già
  l'effetto. ⚠️ Nella scheda c'è la cosa da guardare **prima** di scrivere: il sync sa già
  deduplicare e su Lidia non l'ha fatto — capire perché, o si mettono due meccanismi dove non ne
  funziona nemmeno uno.
- **Voce 68** — resta in coda finché il primo giorno vero non è stato guardato.

### 💭 Proposto, non deciso

**Far entrare più soci nel bot.** Oggi nel bot ci sono **5 soci su 2810** (Fabiola Limuti, Laura
Aprea, Lidia Comes, Marco Aprea, Maurizio Aprea) — tutti di casa. ⇒ È il numero che dovrebbe
decidere le priorità: il lavoro sull'usabilità serve a questo, e cinque persone non bastano a dire
se il flusso funziona. *Un socio che non è tuo parente non chiede spiegazioni: smette di usarlo, e
quella è l'informazione che oggi non c'è.*

---

## 5. Trappole imparate stanotte

- **Una prova che passa non dice che il codice è giusto**: dice che è giusto **sui casi che
  qualcuno ha immaginato**. L'anagrafica vera ne aveva uno che nessuno aveva immaginato (Lidia).
- **Il difetto visibile è spesso il meno grave.** Un banco rosso lo si vede; una prova che **non sa
  diventare rossa** non la vede nessuno, per costruzione.
- **Le guardie del banco si aggiornano, non si allentano.** Due volte stanotte: quando cambia il
  *meccanismo* e non la *regola*, si insegna loro il posto nuovo — e poi si **sabota una copia** per
  verificare che sappiano ancora cadere.
- **Un byte NUL in un sorgente lo rende «binario» per git**: niente diff, quindi sparisce dalle
  revisioni mentre continua a essere codice che gira. Successo a `riduzione.ts`.
- **I backtick nei messaggi di commit scritti via shell vengono eseguiti**: tre frammenti erano
  spariti da un commit. Si usa un heredoc quotato (`<<'FINE'`).
- **`git diff --stat` che dice `Bin` su un file di testo è un segnale**, non un dettaglio.
- **Il conteggio delle sezioni in `docs/lavori/README.md` è sorvegliato** (`guard-docs-truth`):
  aggiungendo una voce vanno aggiornati **due** numeri, quello di sezione e quello di «IN CODA».

---

## 6. Riferimenti

**Rami** — tutto già mergiato su `main` e allineato su `test-preview`.
· `padel-match-organizer`: `claude/leggi-allegato-iocuax` (PR #954, #955, #956 mergiate)
· `assistente-padel-agent`: `claude/voce-68-avvisi-staff` (#53), `claude/interruttore-avvisi-circolo` (#54)

**Stato dei sistemi al momento della consegna:**
· bot dei soci: commit `2c6c0ae`, online, `qqbf… (PROD)`, `✍️ prenotazioni REALI`
· edge PROD: `consumer-staff-events` v1, `matchpoint-bookings-sync` v59, `consumer-player-readmodel` v24
· `prove.yml`: verde sui due rami · banco bot: **1443 verdi** · banco gestionale: **42 file, 0 rossi**

**Pagine**: revisione del flusso → `cbbf0f3c-dab9-425c-bfdb-4e1428c3e90f` · mockup →
`62a46c9d-8351-4dd3-8994-36b4468fa2e0` · **guida al collaudo** →
`c43285c7-79eb-4ee3-b65f-2d98226314fe` (tutte su `claude.ai/code/artifact/`)

**Se qualcosa va storto sul bot**: `deploy-bot-hetzner.yml`, bersaglio `soci`, conferma `SOCI`, su
un commit precedente. ⚠️ Ma prima **valutare l'interruttore** (§1): quasi sempre è lui che serve, e
non porta indietro nient'altro.
