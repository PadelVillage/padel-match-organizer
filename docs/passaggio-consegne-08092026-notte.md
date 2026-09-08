# Passaggio di consegne — 08/09/2026, notte (102ª sessione)

> **Prompt da incollare nella chat nuova.** Copia tutto quello che sta fra le due righe.

---

## 📋 PROMPT

> Riprendi il progetto **PADEL MATCH ORGANIZER**.
>
> Leggi PRIMA, in quest'ordine: **`CLAUDE.md`** (il postulato in testa, e la sezione *«IL GESTIONALE
> DI TEST DIVENTA IL VERO»*), **`docs/lavori/README.md`**, e questo file.
>
> ### 🚨 PRIMA DI CREDERE A QUALUNQUE CONFRONTO
> Il checkout locale nasce **stantio e shallow**, e `git status` dice «allineato» mentendo. ⇒
> `git fetch --unshallow origin && git fetch origin main test-preview && git reset --hard origin/test-preview`
> 🚨 **E CONTROLLA SU QUALE RAMO SEI PRIMA DI MISURARE**: stanotte ho letto il recinto su `main`
> e ho detto al committente una cosa falsa su TEST. `git status -sb`, sempre, prima di un `grep`
> che diventa un'affermazione.
>
> ---
>
> ## 🟢 IL PRIMO LAVORO: la SECONDA METÀ della 180
>
> La prima metà è in servizio e provata: **l'importo a carico nasce dal listino** alla creazione
> nativa (`importo-dal-listino.ts`, modulo puro, 20 casi e 5 sabotaggi). Restano **tre cose
> distinte**, e la prima è quella che tiene ancora aperta la strada fuori dal recinto:
>
> · ⛔ **la SCHEDA legge ancora dal vivo da Matchpoint.** `matchpoint-bookings-edit` con
>   `read: true` è l'unica strada che **salta il recinto** (`index.ts:674` — `if (!readOnly && …)`),
>   e l'app la chiama da **tre punti** di `index.html` (44800 · 45030 · 45190). ⇒ Va fatta leggere
>   dalla **copia locale** quando l'importo è nato qui (`origineImporto: 'listino'`);
> · 📦 **le righe già esistenti non hanno importi**: 📏 su `cudi` **30 vive, 2 con importi**. Serve un
>   riempimento dal listino — una-tantum, o all'apertura della scheda;
> · ➕ **un giocatore aggiunto dopo non prende il prezzo**: nasce senza importo.
>
> 🎯 Poi viene la **181** (la cassa nativa), e **non prima**: costruire la cassa su un dato che
> esiste nel 5% dei casi vorrebbe dire scoprirlo con i soldi veri di qualcuno.
>
> ---
>
> ## ✅ FATTO IN QUESTA SESSIONE
>
> **① Voce 185 — IL LISTINO HA UN CALENDARIO** (nuova, da una sua richiesta). Una **griglia base**
> senza date sempre valida, **periodi** datati che la coprono coi *loro* orari **e** i *loro*
> prezzi, e le **chiusure** sopra a tutto. Due periodi non si possono sovrapporre e a impedirlo è
> il **database**; un giorno scoperto **non può esistere** perché la base non ha date.
> ⭐ A decidere «che orari e che prezzi valgono il giorno X» è **UNA** funzione,
> `pmo_calendario_effettivo`, chiamata dall'app **e** dalle due edge del bot.
> 🖥️ Pannello in Amministrazione → *Fasce prenotabili*, in quattro passi: cosa vale oggi · i periodi
> come bottoni · orari e prezzi (con «copia da…» per giorno) · chiusure + feste italiane in blocco ·
> **calendario di controllo di un anno**, un quadratino per giorno.
> ⭐ Un periodo nuovo **nasce come copia** di quello che guardi: un periodo a metà **svuota** i
> giorni non compilati (misurato).
>
> **② Voce 183 — I 41 PREZZI, misurati e confermati da lui.** Presi dai **3.336 pagamenti veri** su
> `cudi` (importo più frequente per giorno+ora, tolte le giornate-torneo a 20 €) e confermati con un
> «confermo». 8 € di giorno e il sabato · 10 € a pranzo · 12 € alle 18:00 e 21:00 · **13 € alle
> 19:30**. ⚠️ Quattro fasce non avevano **nessun** pagamento dietro (lun 16:30, mer 14:00, gio 14:00,
> sab 12:00): il loro numero viene dalla fascia gemella, non da una misura.
> 📏 **Misurato e non chiesto**: **ospite e socio pagano uguale** (946 vs 949 pagamenti, tipico 12 €).
>
> **③ LE SCRITTURE DI TEST SONO CHIUSE, E LE PRENOTAZIONI SONO NATIVE.** Sua richiesta: *«devono
> essere proprio chiuse, non simulate»*. C'erano **due** finzioni sovrapposte, tolte entrambe:
> · l'**intercettatore nel browser** fermava le chiamate alle edge di scrittura e **rispondeva da
>   sé** `{ok:true, simulated:true}` con un `idReserva` inventato (`TEST-…`);
> · l'edge rispondeva *«fatto, di prova»* con un `PROVA-…`.
> ⇒ Messo davanti alle due strade — rifiutare tutto o rendere la prenotazione **vera del gestionale
> nuovo** — ha scelto **native**: `esitoDiProva` → `esitoNativo`, marchio `nata_in_prova` →
> `nata_nel_gestionale`, prefisso **`PMO-`**, file rinominati (`scheda-nativa`, `bersaglio-nativo`).
> ⚖️ Il marchio **vecchio resta riconosciuto** da sync e annullo: una riga su `cudi` lo porta ancora.
>
> **④ Voce 180, prima metà** (sopra). **⑤ La settimana comincia dal LUNEDÌ** nel pannello — ordine
> di visualizzazione, non il numero: `giorno` resta l'indice di `Date.getDay()`.
>
> **⑥ Misurato dove punta il bot** (⇒ il blocco qui sotto).
>
> ---
>
> ## 🚨 IL BOT DEI SOCI È ATTACCATO A PROD — misurato, e deciso cosa farne
>
> 📏 **Da due parti indipendenti**: la dichiarazione d'avvio sulla VM (`ponti edge:
> qqbfphyslczzkxoncgex… (PROD)` · *«scrive sul gestionale VERO»*) **e** i registri dei due database —
> **6.557 chiamate** ai ponti del bot su `qqbf` in 24 h (`consumer-staff-events` 4.070 ·
> `consumer-player-readmodel` 2.487) contro **zero** sugli stessi ponti di `cudi`.
> ✅ Il bot di **prova** punta già a `cudi`, come deve.
> 🗣️ **Portato a lui, che ha deciso: si sposta AL PASSAGGIO** (voce 184), non adesso — perché oggi
> vorrebbe dire che le prenotazioni dei soci **non arrivano più a Matchpoint** (il circolo non le
> vede fino al distacco) e che il bot racconterebbe un calendario **fermo al 07/09 17:32**.
> ⇒ **Non riaprire la domanda**: è decisa. Va fatta *quando* si fa il passaggio.
>
> ---
>
> ## 📊 STATO, misurato a fine sessione
>
> | | |
> |---|---|
> | **PROD** | `v6.397`, **intoccata**. Su `main` sono andati solo documenti |
> | **TEST** (il sistema nuovo) | `v6.404` · edge 177+178+179+**185**+**180a** in servizio su `cudi` |
> | guardie | `guard-worker-sync` · `guard-docs-truth` **verdi su tutti e due i rami** |
> | lista lavori | 🔴 **5 urgenti** (177 · 178 · 180 · 183 · **185**) · 📋 **4 in coda** (181 · 182 · 184 · **186**) · 📦 **171 chiuse** |
> | banco | **126 file verdi, 0 rossi** (7 Deno saltati) |
> | listino | ⚠️ **38 fasce, 37 col prezzo** — *lui le ha modificate a mano stanotte* (erano 41): una fascia nuova è senza prezzo. **Non è un difetto** |
>
> ---
>
> ## 🥇 LE COSE DA PORTARSI DIETRO (pagate stanotte)
>
> **①🚨 GUARDA SU QUALE RAMO SEI PRIMA DI MISURARE.** Ho letto `scrittura-al-circolo.ts` mentre ero
> su un ramo basato su `main` e ho detto *«su TEST le scritture sono già tutte rifiutate»*: falso.
> Su `main` quel modulo rifiuta e basta; su `test-preview` aveva il ramo che registrava. ⇒ *Due rami
> con lo stesso file sono due file: il `grep` non te lo dice, `git status` sì.*
>
> **②⭐ UNA SONDA CHE NON TROVA NIENTE VA PROVATA SUL CASSETTO GIUSTO.** `window.pmoListino` tornava
> `undefined` e sembrava «il listino non si carica»: le `let` di script **non sono** proprietà di
> `window`. Il dato c'era. ⇒ Prima di concludere «non c'è», far dire alla sonda **dove ha guardato**.
>
> **③⭐⭐ UN SABOTAGGIO PROVATO CON UN INPUT INNOCUO RESTA VERDE PER SEMPRE.** Due sabotaggi nuovi
> non cadevano: il fixture aveva un giorno chiuso **senza fasce**, e quindi non distingueva la cura
> dal difetto. ⇒ Una guardia si prova sull'input che deve **fermare**.
>
> **④ IL DEPLOY DELLE EDGE NON DICE «uguale a prima».** Rideployare 11 funzioni ha bumpato la
> versione senza cambiare una riga (il codice era già quello): il numero di versione **non** è una
> misura di cosa c'è dentro. ⇒ Si legge il **sorgente deployato**, non il contatore.
>
> **⑤ `get_edge_function` che sfora il limite SALVA SU FILE**, e quel file si `grep`a per pochi
> gettoni: è il modo economico di leggere una funzione deployata (e di prenderne l'`id` per
> incrociarlo coi registri).
>
> ---
>
> ## ⛔ COSA NON DARE PER FATTO
> · **PROD non si tocca** — unica eccezione dichiarata: la 182, in lettura;
> · **`scritturaAlCircoloConsentita` è cablata sul ref di PROD** (11 copie byte-identiche): è
>   l'unica cosa che impedisce al sistema nuovo di scrivere sul Matchpoint del circolo. Va tenuta
>   **per sempre**;
> · **su PROD non si salva mai un pagamento**; sul sistema nuovo la cassa nasce nostra (voce 181);
> · la lista delle simulazioni legate a `PMO_IS_TEST_ENV` **non è chiusa**: prima del passaggio va
>   cercata tutta (`grep -n 'PMO_IS_TEST_ENV\|isTestEnv()'`). Ne restano almeno due vive —
>   `PMO_PAYMENTS_SIMULATE` (che oggi accende solo i bottoni: l'edge **rifiuta**) e
>   `WA_TEST_OVERRIDE_NUMBER`, che manda **ogni WhatsApp su un solo telefono**;
> · **il bot non è stato provato** contro le edge nuove: il banco le copre, ma nessun gesto vero ci
>   è passato. È la prova che manca anche alla **177**.

---

## 🔧 DETTAGLI OPERATIVI (fuori dal prompt)

### Cosa è nato stanotte, e dove sta

| pezzo | dove |
|---|---|
| tabelle `pmo_listino_periodi` · `pmo_chiusure` · colonna `periodo_id` | `supabase/migrations/20260908220000_voce185_listino_per_periodi.sql` |
| le 5 funzioni del listino (`pmo_calendario_effettivo` · `get_listino` · `set_periodo` · `elimina_periodo` · `set_chiusure`) | stessa migrazione, applicata a mano su `cudi` |
| il pannello | `index.html`, blocco «VOCE 185 — IL LISTINO HA UN CALENDARIO» |
| l'importo dal listino | `supabase/functions/matchpoint-bookings-create/importo-dal-listino.ts` (+ `.test.ts`) |
| i lettori del bot | `fasce-prenotabili.ts` (2 copie identiche): `giornoDalCalendario`, `grigliaDalCalendario` |

### Prove fisiche fatte (TEST 6.402 → 6.404, console remota)
- pannello: 41 righe disegnate, calendario di controllo **366 quadratini su 13 mesi**;
- **periodo creato dal pannello** → nasce con 41 fasce copiate; prezzo cambiato dentro → il **05/11**
  risponde col periodo e il **31/10** resta base; **chiusura** → quel giorno chiuso, zero fasce;
  poi **tutto rimesso com'era**;
- **prenotazione nativa** → `200`, `PMO-7a10c08b…`, marchio `nata_nel_gestionale`, roster leggibile;
- **anagrafica** → `503 AMBIENTE_DI_PROVA` (rifiuto visibile);
- **importi**: mercoledì 19:30 → **1300** su entrambi i giocatori, `origineImporto: listino`, nessun
  `lettoAt`; 07:00 (fuori griglia) → **nessun importo**;
- annullo nativo → *«La partita è stata tolta dal gestionale»*, riga chiusa. **TEST ripulito.**

### Misure da non rifare
| cosa | valore |
|---|---|
| pagamenti veri su `cudi` | **3.336** (24/05 → 07/09), 17 importi distinti |
| ospite vs socio | stesso prezzo (946 / 949, tipico 12 €) |
| `staff_booking` vive su `cudi` | **30**, di cui **2** con importi |
| ponti del bot su `qqbf` (24 h) | 4.070 + 2.487 + 458 · su `cudi`: **0** |
| bot soci / bot prova | `qqbf` (PROD) / `cudi` (TEST) |

### PR di stanotte su `main` (solo documenti)
**#1497** la 185 e la 186 in lista · **#1498** le scritture chiuse e le native · **#1499** la 180 a
metà strada, il bot misurato, TEST 6.404.

### Attrezzi
- console remota: `cd tools/verifica-browser && npm install` (il container nasce senza
  `node_modules`), poi `node console.mjs --env test --eval "…"`. Le `PMO_VERIFY_*` **ci sono già**.
  Su TEST `--allow-writes` si usa senza chiedere; su PROD si dice prima.
- `pmo_calendario_effettivo` è **fra le RPC di lettura** della console (aggiunta nominata).
- Banco: `find supabase consumer-app tools test \( -name '*.test.mjs' -o -name '*.test.ts' \)` poi
  `node --experimental-strip-types` su ciascuno; **7 sono Deno** e vanno saltati.
- I conteggi di `guard-docs-truth` si replicano in locale **prima** di spingere (gli `awk` stanno
  nel workflow, righe 215-300).
