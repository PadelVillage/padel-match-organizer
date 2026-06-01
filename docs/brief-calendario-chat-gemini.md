# BRIEF — CALENDARIO CHAT CON GEMINI FLASH 1.5 — v2.4
**Padel Match Organizer TEST**

> **Versione documento: v2.4** — aggiunta la bozza conversazionale multi-turn di Gemini (§5.1) + nota sulla convivenza via strutturata/discorsiva (§14.4).
> Storico: v1.0 (bozza) → v2.0 (struttura dati corretta sul DB) → v2.1 (creazione socio al volo) → v2.2 (6 decisioni finali) → v2.3 (UI mockup + backlog) → v2.4 (bozza conversazionale Gemini).

---

## 0. AMBIENTE (SOLO TEST)

| Voce | Valore |
|------|--------|
| URL | https://padelvillage.github.io/padel-match-organizer/test/?env=test |
| Config | config-test.js |
| Supabase | TEST `cudiqnrrlbyqryrtaprd` |
| Branch | test-preview (auto-deploy su URL TEST) |
| Repo | PadelVillage/padel-match-organizer |

**Regola ferrea:** zero interventi su PROD (`qqbfphyslczzkxoncgex`) finché LoZio non approva esplicitamente.

---

## 1. COSA FA LA FEATURE

Aggiunge al Calendario un **campo chat in linguaggio naturale** (e il click sulla griglia) per permettere allo **staff** di **creare, modificare e cancellare prenotazioni**, e di **registrare al volo un nuovo socio** se un giocatore non è in anagrafica.

Decisioni di design fondamentali:
1. **Booking Matchpoint = SOLA LETTURA** (mostrano l'occupazione reale dei campi).
2. **Lo staff crea sempre un booking nuovo da zero** → `record_type = 'staff_booking'`.
3. **Nessun conflitto con l'import:** Matchpoint scrive solo i `booking` e i soci `matchpoint_auto`; gli `staff_booking` e i soci `staff_manual` vivono in parallelo e non vengono mai sovrascritti.

---

## 2. STRUTTURA DATI REALE (verificata nel DB)

### 2.1 Booking Matchpoint (sola lettura) — `record_type = 'booking'`
```json
{
  "ora": "21:00", "data": "2026-05-18", "tipo": "Partita",
  "campo": "Campo 4", "durata": "2", "numero": "6992",
  "giocatore": "Luca Abbiati",
  "descrizione": "-Luca Abbiati.-Simone Vitiello.-Daniele Mazzer.-Nico Meneghin."
}
```
- Campi in italiano. `durata` in ORE come stringa (`"1"`,`"1.5"`,`"2"`,`"3"`).
- Giocatori come testo libero in `descrizione`; nessun ID verso l'anagrafica.
- `local_key`: `booking|numero|data|ora|campo|giocatore|durata`.
- Campi disponibili: **Campo 1–4**.

### 2.2 Soci — `record_type = 'member'` (973 soci)
```json
{
  "id": "matchpoint_10mf7vv", "memberId": "PMO-000735",
  "name": "Alessandro Vettori", "firstName": "Alessandro", "surname": "Vettori",
  "phone": "+393494071934", "email": "...", "level": 0.5,
  "active": true, "gender": "M", "source": "matchpoint_auto"
}
```
Dati reali rilevanti:
- Origine: **972 `matchpoint_auto`** + **1 `legacy_duplicate`** (i doppioni sono già successi).
- Solo `active: true/false`; **nessun campo "moroso"**.
- **`memberId` quasi sempre VUOTO:** 967/973 vuoto, solo 6 con `PMO-` (max attuale **PMO-000948**). Matchpoint **non** assegna i PMO-.
- L'identificatore univoco affidabile è il campo **`id`** (es. `matchpoint_xxx`), non il `memberId`.

### 2.3 Booking creato dallo staff — `record_type = 'staff_booking'` (oggi 0 record)
```json
{
  "ora": "19:00", "data": "2026-05-30", "tipo": "Partita",
  "campo": "Campo 3", "durata": "1.5",
  "giocatore": "Marco Rossi",
  "descrizione": "-Marco Rossi.-Luigi Bianchi.",
  "giocatori_ref": [
    { "member_id": "matchpoint_xxx", "memberId": "PMO-000735", "nome": "Marco", "cognome": "Rossi" },
    { "member_id": "local_ab12cd",   "memberId": "PMO-000949", "nome": "Luigi", "cognome": "Bianchi" }
  ],
  "creato_da": "staff@club.it", "creato_il": "2026-05-29T16:00:00Z", "origine": "staff_chat"
}
```
- `durata` in ORE stringa; `descrizione` replica il formato Matchpoint per uniformità grafica.
- `giocatori_ref` collega ogni giocatore al socio (Matchpoint o creato al volo).
- `local_key`: `staff_booking|<id_locale>|data|ora|campo`.

---

## 3. TIPI E DURATE (creabili dallo staff)

| Tipo | Etichetta salvata | Durate selezionabili |
|------|-------------------|----------------------|
| Lezione di Gruppo | "Lezione di Gruppo" | 60' / 90' |
| Lezione Singola | "Lezione Singola" | 60' / 90' |
| Partita | "Partita" | 60' / 90' / 120' / 180' |
| Torneo | "Torneo" | 90' / 120' / 180' |

**Conversione durata** (UI minuti → DB ore stringa): 60→`"1"`, 90→`"1.5"`, 120→`"2"`, 180→`"3"`.

---

## 4. ARCHITETTURA

```
BROWSER (TEST URL)
  Calendario (griglia Campo × Orario) + campo Chat
        │  staff scrive o clicca una cella
        ▼
SUPABASE EDGE FUNCTION (calendar-command)
  1. Gemini Flash 1.5 → estrae i campi dal testo
  2. confidence < 80% → "Intendi: …" (no salvataggio)
  3. Lookup soci (member)
     └─ se un giocatore non esiste → flusso "crea socio al volo" (§6)
  4. Validazioni business (§7)
  5. Se OK → salva staff_booking + log su pmo_audit_log
  6. Se errore → errore + suggerimenti
        │
        ▼
BROWSER → aggiorna chat + griglia in tempo reale
```
API key Gemini in secret Supabase (mai nel browser).

---

## 5. COSA ESTRAE GEMINI (output JSON)
```json
{
  "intent": "crea", "tipo": "Partita", "confidence": 0.88,
  "campo": { "value": "Campo 3", "original_text": "campo 3" },
  "data":  { "value": "2026-05-30", "original_text": "domani" },
  "ora":   { "value": "19:00", "original_text": "19" },
  "durata_minuti": 90,
  "giocatori": [ {"nome":"Marco","cognome":"Rossi"}, {"nome":"Luigi","cognome":"Bianchi"} ],
  "interpreted_text": "Crea partita Campo 3 domani 19:00 (90') con Marco Rossi e Luigi Bianchi",
  "raw_input": "...", "warnings": [], "errors": []
}
```
Intent: `crea`/`prenota`, `modifica`, `cancella`, `info`.

Lookup giocatori e disambiguazione:
```
"Marco Rossi" → 1 risultato OK · più risultati → "Quale Marco Rossi?" con telefono
"Marco"       → "Cognome di Marco?"
"Rossi"       → mostra i nomi col cognome, con telefono
nessun match  → propone la CREAZIONE del socio (§6)
socio active:false → inseribile, ma con avviso "⚠️ socio inattivo"
```
Numero giocatori **libero** per tutti i tipi.

### 5.1 Bozza conversazionale multi-turn

La chat con lo staff **non è a comando singolo**: Gemini mantiene una **bozza dell'evento** durante la conversazione e la **rifinisce passo passo** finché lo staff non conferma. Ogni messaggio è interpretato come un'**operazione sulla bozza**, non salvato alla lettera.

Stato che Gemini tiene in conversazione:
```json
"bozza": {
  "tipo": "Lezione Singola", "durata_minuti": 60,
  "campo": "Campo 2", "data": "2026-05-30", "ora": "09:30",
  "giocatori": [ {"nome":"Mirko"}, {"nome":"Mauri"} ],
  "stato": "in_compilazione"
}
```
Lo `stato` diventa `"confermato"` solo con un comando esplicito di conferma.

Intent estesi (oltre a `crea`/`modifica`/`cancella`/`info`): un intent `aggiorna_bozza` con `operazione` ∈:
`set_tipo` · `set_durata` · `set_campo` · `set_data` · `set_ora` · `aggiungi_giocatore` · `rimuovi_giocatore` · `svuota_giocatori` · `conferma` · `annulla`.

Esempio di output per un'operazione di rifinitura:
```json
{
  "intent": "aggiorna_bozza",
  "operazione": "aggiungi_giocatore",
  "giocatori": [ {"nome": "Livia"} ],
  "confidence": 0.9,
  "interpreted_text": "Aggiungo Livia ai giocatori della bozza",
  "raw_input": "aggiungi anche livia"
}
```

Flusso tipico ("prima di definire l'evento"):
```
Staff:  "Lezione singola domani Campo 2 alle 9:30 con mirko e mauri"
Gemini: bozza creata → "Lezione Singola · Campo 2 · 30/05 09:30 · Mirko, Mauri. Confermo?"
Staff:  "aggiungi anche livia"
Gemini: aggiorna la bozza (3 giocatori) — NON crea un giocatore "aggiungi anche livia"
Staff:  "togli mauri"             → bozza: Mirko, Livia
Staff:  "anzi facciamo 90 minuti" → bozza: durata 90' (se valida per il tipo)
Staff:  "ok conferma"             → validazioni (§7) e salvataggio
```

Regole:
- **Nessuna scrittura sul DB** finché non arriva un comando esplicito di conferma. Tutto avviene sulla bozza.
- Le operazioni sui giocatori passano dal **lookup/disambiguazione** già descritto (omonimi, "crea socio al volo"): la frase non viene mai presa alla lettera come nome.
- Le validazioni (§7: slot libero, orari, durata ammessa per tipo) si applicano **alla conferma**; durante la rifinitura Gemini può segnalare in anticipo un conflitto.
- Sotto la soglia di confidence (§11), Gemini chiede conferma ("Intendi…?") invece di applicare l'operazione.

> Nota: nel **mockup** (Tappe 1–4) l'inserimento giocatori resta **letterale** (scrivi un nome → chip): è la via *strutturata*, voluta così. L'interpretazione del linguaggio ("aggiungi/togli", frasi naturali) arriva **solo** con Gemini alla Tappa 5.

---

## 6. CREAZIONE SOCIO "AL VOLO"

Dati richiesti (**tutti e 4 obbligatori**): nome, cognome, email, telefono.

**Flusso:**
```
Giocatore non trovato
 1) ANTI-DUPLICATO debole: cerca nome+cognome simili
    candidati → "Forse è uno di questi?" [lista+telefono] [No, è nuovo]
 2) RACCOLTA dei 4 dati obbligatori
 3) ANTI-DUPLICATO forte: se telefono O email coincidono con un socio esistente
    → blocca: "Esiste già un socio con questo telefono/email: …"
 4) CONFERMA: mostra la scheda → "Creo il socio?" [Sì] [Modifica] [Annulla]
 5) CREA member:
    source   = "staff_manual"
    id       = "local_<random>"            ← identificatore tecnico univoco (anti-collisione)
    memberId = prossimo PMO- libero        ← continua la serie dell'app: MAX(PMO-) + 1 (oggi → PMO-000949)
    active = true, creato_da, creato_il
 6) log su pmo_audit_log
 7) il nuovo socio entra subito nei giocatori_ref del booking in corso
```

**Numerazione `memberId`:** calcolare a runtime `MAX(memberId con formato PMO-) + 1` (non hardcodare 949). Sicura perché Matchpoint non genera PMO-.

**Riconciliazione con Matchpoint (scelta 1+2):**
- Il socio `staff_manual` resta separato: l'import non lo sovrascrive mai.
- All'import, se Matchpoint porta un socio con **stesso telefono o email** di un `staff_manual` → **alert di possibile duplicato** (nessuna fusione automatica; la decide una persona).
- Match forte = telefono/email uguali. Match debole = solo nome+cognome (avviso, non blocco).

> "Creare un socio" = aggiungere una riga anagrafica nel gestionale, **non** un account con credenziali. La scrittura avviene solo dopo la conferma del passo 4.

---

## 7. VALIDAZIONI (Edge Function)
```
✓ Staff autorizzato? role ∈ (owner, admin, staff). Esclusi readonly/non-staff.
✓ Slot Campo+Orario libero? Controlla SIA i booking Matchpoint SIA gli staff_booking
  (sovrapposizione campo/data/ora/durata). Se occupato → errore + alternative.
✓ Orari apertura 07:00–23:00 → vincolo: inizio + durata ≤ 23:00
  (es. Partita 180' può iniziare al massimo alle 20:00).
✓ Data nel range: da (oggi − 7 giorni) in poi editabile; oltre = sola lettura.
✓ Giocatori in anagrafica? altrimenti → creazione al volo (§6).
  Socio inattivo → consentito con avviso.
✓ Durata ammessa per il tipo (vedi §3).
✓ Socio al volo: 4 campi presenti + nessun duplicato forte (telefono/email).
✗ (rimosso) "staff moroso" · ✗ (rimosso) limite numero giocatori
```

---

## 8. ERRORI CON SUGGERIMENTI

| Errore | Messaggio + suggerimento |
|--------|--------------------------|
| Slot occupato | ❌ Campo 3 occupato lunedì 19:00. Liberi: Campo 1 19:00, Campo 3 20:30 |
| Fuori orario | ❌ Oltre l'orario: con 180' l'inizio max è 20:00 (chiusura 23:00) |
| Socio non trovato | ❓ "Marco Rossi" non in anagrafica → [Crea nuovo socio] / candidati simili |
| Duplicato forte | ❌ Esiste già un socio con questo telefono/email: … |
| Socio inattivo | ⚠️ Marco Rossi è inattivo — confermi l'inserimento? |
| Solo nome | ❓ Cognome di Marco? |
| Omonimi | ❓ Quale Rossi? → Marco Rossi (+39 349…), Mario Rossi (+39 333…) |
| Data oltre 7gg fa | ❌ Non puoi modificare prenotazioni di oltre 7 giorni fa |
| Durata mancante | ❓ Quale durata? [opzioni del tipo] |
| Confidence < 80% | ❓ Intendi: «…»? [✓ Sì] [✗ No] [✎ Riscrivi] |

---

## 9. AUTORIZZAZIONE & AUDIT
- Chat accessibile a tutto lo staff con `role ∈ (owner, admin, staff)`. Esclusi readonly.
- **Modifica/cancella:** tutto lo staff può operare su **qualsiasi** `staff_booking` (non solo i propri). La tracciabilità è garantita dall'audit log.
- Log su `pmo_audit_log` per ogni azione (booking e creazione socio): `actor_email`, `actor_role`, `action`, `detail{raw_input, intent, esito, error_code, local_key/member_id}`.

---

## 10. UI — GRIGLIA + CHAT

Scelte consolidate nel mockup approvato (vedi `mockup/calendario-chat-mockup-v1.x.html`):
- **Tema chiaro** (off-white, testo scuro) per leggibilità di giorno e da mobile.
- Griglia **Campo (4 colonne) × Orario (righe)**, fasce **07:00–23:00 passo 30'** (32 slot).
- Mostra insieme booking Matchpoint (sola lettura, 🔒) e staff_booking (modificabili, ✏️), **distinti a colpo d'occhio** (Matchpoint neutro/grigio, Staff azzurro/bordo blu).
- **Navigazione data compatta:** apertura su **oggi**; box centrale `‹ Giorno ›` (±1 giorno); icona 📅 con datepicker per saltare a qualsiasi data; pulsante "Oggi". (Sostituisce la vecchia striscia di tutti i giorni.)
- **Chat responsive:** su **desktop** in colonna fissa **a destra** della griglia (entrambe visibili); su **mobile** **a comparsa** con pulsante flottante 💬 (griglia a tutto schermo, chat in overlay/slide-up).
- **Legenda** puramente informativa a **sole icone + testo** (🔒 / ✏️ / ➕), nessun quadratino (evitava l'equivoco "checkbox").
- Click su cella libera → precompila campo + data + ora nella chat.
- Scrittura libera → Gemini interpreta (campo scrivibile come "Campo 3").
- Aggiornamento griglia in tempo reale dopo ogni azione riuscita.
- **Mockup obbligatorio** in `mockup/` prima della UI reale (regola repo), da far approvare a LoZio.

---

## 11. GEMINI FLASH 1.5
- In Edge Function, temperatura ~0.1, output JSON forzato, soglia confidence **80%**.
- Nota: 1.5 Flash è del 2024; verificare la disponibilità su Google AI Studio allo sviluppo, altrimenti usare l'equivalente Flash più recente. Scelta del modello = di LoZio.

---

## 12. TESTING (pre-rilascio)
- Parsing: date IT, ore, campo, durata, nomi, tutti e 4 i tipi.
- Conversione durata minuti→ore stringa.
- Lookup soci: nome+cognome, solo nome, solo cognome, omonimi, non trovato, inattivo (avviso).
- Creazione socio al volo: 4 campi obbligatori, blocco duplicato forte (telefono/email), conferma prima di scrivere, `source="staff_manual"` + `id=local_*` + `memberId` = MAX(PMO-)+1.
- Slot: l'occupazione considera ANCHE i booking Matchpoint.
- Orari 07:00–23:00 con inizio+durata ≤ 23:00. Limite 7 giorni sul passato.
- Modifica/cancella di un booking creato da un altro staff (deve essere permesso e loggato).
- Confidence < 80% → "Intendi". Audit: ogni azione tracciata.
- **Bozza conversazionale (§5.1):** una sequenza multi-turn ("crea… → aggiungi giocatore → togli giocatore → cambia durata → conferma") aggiorna sempre la stessa bozza e salva solo alla conferma.
- Verifica finale: conteggio prenotazioni mostrate = dati reali nel DB.

---

## 13. FLUSSO DI RILASCIO
1. **Mockup** griglia+chat → approvazione LoZio.
2. Sviluppo Edge Function + UI → merge in `test-preview`.
3. Deploy automatico su URL TEST → verifica LoZio.
4. Solo dopo OK esplicito: valutazione porting su PROD (mai prima).

Versionamento: nuovo file HTML versionato + registro in `VERSIONI.md`. Mai sovrascrivere versioni stabili.

---

## 14. MIGLIORIE FUTURE (post-MVP, da valutare più avanti)

1. **Dettatura vocale nella chat** — *da valutare DOPO la Tappa 5 (parser Gemini).* Lo staff usa lo strumento da mobile, spesso a bordo campo: dettare il comando a voce è comodo. Il vocale produce comunque testo che passa per Gemini, quindi va aggiunto solo quando il parser scritto funziona bene (per non testare due cose insieme). Scelta tecnica da fare al momento: spesso **basta il microfono nativo della tastiera del telefono** (costo zero, già disponibile); un pulsante 🎤 dedicato in-app (Web Speech API o servizio esterno) è opzione più ricca ma più costosa.
2. **Filtri per tipo / "solo le mie"** — non servono ora (4 campi, una giornata si legge a colpo d'occhio). Da rivalutare se si introduce una vista multi-giorno o calendari molto pieni.
3. **Vista settimana / multi-giorno** — possibile evoluzione della navigazione data; sarebbe il trigger naturale per i filtri del punto 2.
4. **Convivenza tra via strutturata e via discorsiva (da definire a Tappa 5).** La scheda guidata (bottoni + chip) e la chat libera convivono già nel design (§10). Con Gemini va decisa l'integrazione: la chat principale è interpretata da Gemini (bozza conversazionale, §5.1) mentre l'input giocatori dentro la scheda guidata resta letterale? Oppure la scheda diventa pilotabile a linguaggio naturale ("aggiungi Livia" mentre la scheda è aperta)? Scelta di architettura da fare a Tappa 5. Si lega alla dettatura vocale (punto 1): il vocale produce testo che alimenta questa chat discorsiva.

---

## CHANGELOG

**v2.3 → v2.4**
- §5.1: aggiunta la "bozza conversazionale multi-turn" — Gemini mantiene e rifinisce la bozza dell'evento (aggiungi/togli giocatore, cambia campo/durata/ora) e salva solo alla conferma; intent `aggiorna_bozza` con operazioni. Chiarito che l'input letterale del mockup è voluto e superato da Gemini a Tappa 5.
- §14.4: nota sulla convivenza via strutturata / via discorsiva da decidere a Tappa 5 (collegata alla dettatura vocale).
- §12: aggiunto test della sequenza multi-turn sulla bozza.

**v2.2 → v2.3**
- §10 UI allineata alle scelte consolidate dal mockup: tema chiaro, navigatore data compatto (‹ › + 📅 + Oggi), chat a destra su desktop / a comparsa 💬 su mobile, legenda a sole icone.
- Aggiunta sezione "Migliorie future (post-MVP)" con la dettatura vocale (da valutare dopo la Tappa 5).

**v2.1 → v2.2** (decisioni finali)
- Tipi: aggiunti Torneo (90/120/180') e i due tipi di lezione (di Gruppo, Singola); tabella tipi/durate in §3.
- Orari club 07:00–23:00 con vincolo inizio+durata ≤ chiusura.
- Soci inattivi: inseribili con avviso.
- Modifica/cancella: consentita a tutto lo staff su qualsiasi staff_booking (audit garantisce tracciabilità).
- memberId soci a mano: continua la serie PMO- (MAX+1), affiancato da id tecnico `local_*`.

**v2.0 → v2.1**
- §6 creazione socio al volo (4 campi obbligatori, anti-duplicato, conferma, origine staff_manual).

**v1.0 → v2.0**
- Struttura payload reale (italiano, durata in ore stringa, giocatori testo libero). Rimossi "moroso" e (inizialmente) "tornei". Introdotto il "campo" (1–4). Matchpoint sola lettura; staff crea solo staff_booking.

---

**Data:** 30 maggio 2026 · **Versione:** v2.4 · **Stato:** ✅ completo — Tappa 1 (mockup) chiusa (mockup live v3.3); backlog aggiornato.
