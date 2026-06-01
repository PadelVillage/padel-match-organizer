# Flusso di pubblicazione e Pull Request

Questa regola definisce **come il lavoro arriva su `main`** nel progetto Padel Match Organizer. Vale per l'agente di sviluppo (Claude Code) e per Maurizio.

## Regola ferrea

Il merge su `main` lo fa **sempre Maurizio**, tramite **Pull Request** da GitHub.

L'agente **non fa mai** merge su `main` da solo, **non cancella** branch e **non chiude/forza** Pull Request. Quelle azioni le esegue Maurizio a mano.

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

## Controlli di sicurezza nella Pull Request (Maurizio)

Prima di confermare un merge:

- In **"Files changed"** ci sono **solo** i file attesi. Se sono di più → **STOP**, non mergiare.
- **Nessun segreto** nei file: credenziali, API key, SMTP, `service_role` di Supabase.
- Se la traccia è mockup/documenti, **nessun file PROD** deve risultare toccato.
- Se l'agente segnala **"push rifiutato"** → STOP e capire il perché prima di procedere.

## Cosa NON fa mai l'agente

- Non fa merge su `main`.
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

## Caccia ai branch (pulizia)

La pulizia dei branch è un'attività **separata** e la fa Maurizio a mano. Tenere comunque:

- `main` — casa del sito (Pages) e dove si pubblica.
- `test-preview` — branch dell'app (non toccare).
- `claude/amazing-hypatia-4lgoP` — archivio mockup vecchi v1.0–v2.3 (tenuto apposta).

Gli altri `claude/*` di sessione, una volta mergiati e verificati, si possono cancellare con calma.
