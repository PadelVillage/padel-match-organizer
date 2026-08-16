# Flusso di pubblicazione e Pull Request

Questa regola definisce **come il lavoro arriva su `main`** nel progetto Padel Match Organizer. Vale per l'agente di sviluppo (Claude Code) e per Maurizio.

## Regola ferrea

Il merge su `main` **lo decide sempre Maurizio**, tramite **Pull Request** da GitHub. A
**eseguirlo** può essere l'agente, ma **solo dopo un ok esplicito**: mai di sua iniziativa,
nemmeno con le guardie tutte verdi e il lavoro pronto. **Un ok che non arriva vale come un no.**

> 🔄 **Cambiata il 16/08/2026, decisione del committente**: *«Direi che il merge lo fai tu dopo che
> io ti ho dato l'ok»*. Fino a quel giorno qui c'era scritto che il merge lo faceva **sempre lui a
> mano**, e che l'agente non lo faceva **mai**.
>
> ⚖️ **Cosa NON è cambiato, ed è la metà che porta il peso: la decisione resta sua.** È cambiato chi
> tocca il bottone, non chi sceglie. La regola vecchia difendeva due cose insieme — *chi decide* e
> *chi esegue* — e solo la seconda è stata sciolta.
>
> 📌 Nata il giorno stesso, dopo un merge fatto dall'agente su sua istruzione esplicita (#784): la
> regola era stata **derogata prima di essere riscritta**, e un documento che dice il contrario di
> ciò che si fa è peggio di uno vecchio — si continua a citarlo.

L'agente **non cancella** branch e **non chiude/forza** Pull Request: quelle restano a Maurizio.

## ✅ COSA COMPRENDE UN OK — non solo il merge (FERMA)

**Decisione del committente, 16/08/2026**: *«Preferisco che quando io ti do l'ok fai tu in
automatico, però poi controlli che tutto funzioni. E se dà un problema rosso riprovi.»*

⇒ **Un ok non autorizza un gesto: autorizza un ESITO.** Chi lo riceve va avanti da solo fino in
fondo, e sono **tre** cose, non una:

| | |
|---|---|
| ① **eseguire** | il merge, e tutto ciò che quel merge fa scattare (deploy compresi) |
| ② **verificare che funzioni** | non che il comando sia riuscito: che la cosa **sia viva sul bersaglio**. Un verde di CI non è una verifica, è un indizio |
| ③ **riparare i rossi** | se qualcosa cade, si ripara e si **riprova**, senza tornare a chiedere un secondo ok |

🚨 **Il punto ③ è il motivo per cui questa regola esiste, ed è nato da un caso vero**: il 16/08 un
merge ha lasciato **tre rossi in bacheca** — un conteggio sbagliato e due guardie cadute nella
finestra fra i due rami. Erano tutti riparabili in tre minuti, ma la regola di allora non diceva se
per ripararli servisse un ok nuovo. ⇒ Ora lo dice: **non serve**. Chi ha dato l'ok non deve fare
anche il guardiano.

⚖️ **Cosa NON allarga**: l'ok resta legato a **quel lavoro lì**. Riparare un rosso **causato da quel
lavoro** è dentro; cogliere l'occasione per fare altro è fuori, e vuole un ok suo. La differenza è
semplice: *sto rimettendo in piedi ciò che ho appena rovesciato, o sto aggiungendo qualcosa?*

🔧 **Come si ripara un rosso, meccanicamente** (regola della 27ª): si usa **`rerun` sulla corsa
FALLITA**, e si verifica che *quella* passi a **`run_attempt: 2` + `success`**. ⛔ **Non** si lancia
una corsa nuova accanto: un verde **accanto** a un rosso non è un rosso riparato — la riga rossa
resta, con lo stesso sha, ed è quella che si vede aprendo la bacheca.

📌 **E se il rosso non si lascia riparare** — perché la causa non è nostra, o perché la cura vera è
una decisione — allora **si dice**, con la diagnosi in mano. Il silenzio non è un esito: il
committente guarda la bacheca, e un rosso che io so spiegare è comunque un rosso che lui vede.

## Perché l'agente lavora sul suo branch di sessione

Ogni chat di Claude Code nasce su un **proprio** branch di sessione e tende a ignorare gli ordini di spostarsi su un branch fisso (es. `test-preview`). Inseguire un branch fisso fa **perdere lavoro**.

Quindi la regola operativa è: l'agente **committa e pusha sempre sul proprio branch di sessione** (gli riesce sempre, così il lavoro non si perde nemmeno se la chat satura). Lo spostamento verso `test-preview` o `main` è responsabilità di Maurizio, via Pull Request.

## Le due tracce

### Traccia A — App operativa (PROD)

Vale per `index.html`, `autovalutazione.html`, i file `padel_match_organizer_v5_*.html` e qualsiasi file deployato. È il flusso TEST → PROD del `.cursorrules` (§6).

1. L'agente lavora sul **suo branch di sessione**, commit + push lì.
2. Maurizio porta il lavoro su **`test-preview`** via Pull Request (controllando i "Files changed").
3. Deploy automatico sull'URL TEST → **Maurizio verifica**.
4. Solo dopo **OK esplicito**, Maurizio fa il merge `test-preview` → `main` (PROD) via Pull Request.

Prima di toccare `index.html` o altri file deployati, l'agente **chiede sempre conferma esplicita** a Maurizio.

### Traccia B — Mockup e documenti

Vale per i file in `mockup/` e per i documenti in `docs/`.

1. L'agente lavora sul **suo branch di sessione**, commit + push lì.
2. Maurizio fa il merge su **`main`** via Pull Request, controllando i "Files changed" (solo i file attesi).
3. La pubblicazione del mockup avviene da `main` (GitHub Pages).

**Eccezione (commit diretto su `main`):** le modifiche **solo CSS/grafiche** e i **documenti** (`docs/`) possono andare direttamente su `main` — commit diretto o `Add file → Upload files` fatto a mano — senza Pull Request. Restano comunque soggette ai controlli di sicurezza qui sotto.

> 🚨 **QUESTA CORSIA VELOCE, PER L'AGENTE, È CHIUSA — misurato provandoci il 16/08/2026**, e proprio
> nel momento in cui serviva: un rosso da riparare, **una riga** di un documento. GitHub ha risposto
> `GH013: Repository rule violations` — *«Changes must be made through a pull request»* più il check
> `guard-main` obbligatorio. La regola guarda il **ramo**, non i file: non sa cosa sia un documento.
> ⇒ **L'agente passa sempre da una PR**, anche per una virgola in `docs/`.
>
> ⚠️ **E per Maurizio? NON verificato.** Le regole di GitHub possono avere una lista di chi le
> scavalca, e il proprietario di solito ci sta dentro: quindi questa riga può essere **vera per lui
> dal sito** e falsa per l'agente. Si guarda in `Settings → Rules`, ed è una cosa sua.
>
> 📊 Quello che la storia dice: negli ultimi **84** commit di `main`, **54** sono entrati con
> *squash* da PR, **30** da PR mergiate con *merge commit*, e **zero** spinti dritti. ⇒ Questa
> corsia **non l'ha mai usata nessuno** — il che spiega perché nessuno si era accorto che per
> l'agente non funziona, ma **non dimostra** che lui non potrebbe.
>
> ⚖️ La riga resta **com'è finché non decide lui**: l'errore da non rifare è correggerla su una
> deduzione, che è esattamente come ci si è arrivati.

⚠️ **Ma `docs/` sta sotto `guard-worker-sync`**: la stessa modifica va messa **anche su `test-preview`**, altrimenti la guardia trova i rami diversi e diventa rossa. E vale l'ordine del punto 4bis del `CLAUDE.md` — **prima `test-preview`, poi `main`** — così la finestra rossa, se capita, cade sul ramo che non è quello predefinito.

### Traccia C — Edge Function (`supabase/functions/**`)

🚨 **Qui il merge su `main` NON è un passo prima del deploy: È il deploy in PROD.**
`deploy-edge-functions-prod.yml` scatta al push su `main` e pubblica su `qqbfphyslczzkxoncgex`. Non
c'è un «poi guardo e decido»: quando l'ok arriva, la funzione va **in produzione**. Il gemello
`deploy-edge-functions-test.yml` fa lo stesso da `test-preview` verso `cudiqnrrlbyqryrtaprd`.

⇒ Un ok su una PR che tocca quella cartella vale **due cose insieme**: *mergia* **e** *pubblica in
PROD*. Chi lo chiede ha il dovere di dirlo; chi lo dà lo sta dando a tutt'e due.

⛔ **E non esiste la prova intermedia che c'è per l'app**: la Traccia A può fermarsi su TEST e farsi
guardare. Qui il posto dove ci si ferma è **`test-preview`**, cioè *prima* della PR — non dopo.

📌 Constatato il 16/08/2026 promuovendo `scheda_del_tolto` (#784): merge alle 14:28:04, funzione
viva su PROD alle **14:28:25**. Ventun secondi.

## Controlli di sicurezza nella Pull Request (Maurizio)

Prima di confermare un merge:

- In **"Files changed"** ci sono **solo** i file attesi. Se sono di più → **STOP**, non mergiare.
- **Nessun segreto** nei file: credenziali, API key, SMTP, `service_role` di Supabase.
- Se la traccia è mockup/documenti, **nessun file PROD** deve risultare toccato.
- Se l'agente segnala **"push rifiutato"** → STOP e capire il perché prima di procedere.

## Cosa NON fa mai l'agente

- Non fa merge su `main` **senza un ok esplicito** (con l'ok invece lo esegue lui — vedi «Regola ferrea»).
- Non cancella branch (le cancellazioni le fa Maurizio a mano).
- Non chiude né forza Pull Request.
- Non tocca PROD né usa `service_role` (solo `anon key` per le letture in TEST).

## Versionamento (richiamo)

- **Mockup:** nuovo file per versione (`...-vX.Y.html`), 5 anchor di versione, registro in `VERSIONI.md`, `node --check` sullo `<script>` prima di pubblicare. Mai sovrascrivere una versione stabile.
- **Documenti:** nome **stabile** (es. `docs/brief-calendario-chat-gemini.md`), versione scritta **dentro** il file (intestazione + changelog), storia garantita da git.

## Approvazione valida

Per il passaggio TEST → PROD (Traccia A) serve un OK **esplicito** in chat, per esempio:

```text
Approvato, mergia test-preview su main.
```

Frasi generiche o commenti parziali non autorizzano il merge su PROD.

⭐ **Dal 16/08/2026 la stessa asticella vale per OGNI merge su `main` eseguito dall'agente**, non
solo per la Traccia A: serve un ok esplicito **su quel lavoro lì**. Un ok dato a una cosa non si
allunga a quella dopo, e «va bene» detto guardando una PR non autorizza la successiva.

## Caccia ai branch (pulizia)

La pulizia dei branch è un'attività **separata** e la fa Maurizio a mano. Tenere comunque:

- `main` — casa del sito (Pages) e dove si pubblica.
- `test-preview` — branch dell'app (non toccare).
- `claude/amazing-hypatia-4lgoP` — archivio mockup vecchi v1.0–v2.3 (tenuto apposta).

Gli altri `claude/*` di sessione, una volta mergiati e verificati, si possono cancellare con calma.
