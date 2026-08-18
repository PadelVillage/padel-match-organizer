# 🎾 Le regole del LIVELLO, dal punto di vista del giocatore

**Scritte il 17/08/2026, 30ª sessione**, su richiesta del committente: *«facciamo una tabella di
riepilogo di tutte queste regole che riguardano i giocatori rispetto al test di livello»*.

🚨 **Ogni riga dice se è VIVA oggi o solo DECISA.** È la distinzione che in questo progetto costa
di più quando manca — un fatto vero e mai scritto va riscoperto ogni volta, e una regola decisa e
mai costruita, riletta un mese dopo, sembra in servizio.

| segno | vuol dire |
|---|---|
| ✅ | **in servizio**, misurato |
| 🆕 | **decisa e NON costruita** |
| ❌ | **cancellata**, e non si costruisce più |
| 🔴 | **rotta o mancante** oggi |

---

## A · Chi il livello NON ce l'ha

Sono **2.276 soci su 2.801**: il valore `0,5` con cui il gestionale scrive «da definire».

| la regola | oggi |
|---|---|
| Se è **invitato**, gioca lo stesso: il livello non serve | ✅ |
| **Non può organizzare** una partita | ✅ dall'11/08 (il «muro», rifiuto `serve_livello`) |
| Non può nemmeno **invitare** né **togliere** un giocatore | ✅ |
| Quando ci prova, riceve il messaggio col bottone 🎾 **TEST LIVELLO DI GIOCO** | ✅ |
| Se **chiede** «che livello ho?», gli si dice che non ce l'ha **e come farlo**, col bottone | ✅ **dal 17/08** — prima era un vicolo cieco |
| Riceve un **promemoria gentile**, un paio di volte al mese | 🆕 → voce **61** § B |
| **Non eredita** il livello di chi lo invita | ✅ — e l'eredità è ❌ (sotto) |

### ❌ L'eredità dall'organizzatore — cancellata il 17/08

Il 9/08 era stata decisa così: chi entra invitato senza livello **eredita** quello
dell'organizzatore, «da confermare», e l'eredità **scade dopo 24 ore**; chi ha un ereditato
resta comunque **bloccato** se vuole organizzare.

🚨 **Non è mai stata costruita.** Misurato il 17/08: nel gestionale non c'è una riga che scriva un
livello ereditato, e **nessun socio ne ha uno** (`ereditato` = 0 su PROD). Esiste solo la porta
chiusa — chi ha un livello *in prestito* non può organizzare — ma il prestito non lo dà nessuno.

🗣️ **Il committente l'ha sostituita con una regola più semplice**: *«chi è invitato in una partita
e non ha il livello, visto che è invitato dall'organizzatore, gioca senza livello. Chi vuole
organizzare una partita deve obbligatoriamente fare il test»*.
⚖️ E quelle due cose **erano già vere e già in servizio**: la semplificazione non ha aggiunto
lavoro, ne ha tolto — l'eredità, le 24 ore e la scadenza non si costruiscono più.

---

## B · Fare il test

| la regola | oggi |
|---|---|
| Il link è **personale**: non è un indirizzo da girare a un amico | ✅ |
| **Tre prove** per giro | ✅ |
| È il socio a **decidere a quale prova fermarsi** | ✅ **dal 19/08/2026, e VIVO ANCHE PER I SOCI**: l'automatismo non applica più da sé, il bot chiede «tieni questo o riprovi?», e il silenzio vale assenso dopo 24 ore. ⚠️ Vivo non vuol dire visibile: su PROD nessuno ha ancora passato un quiz, quindi non c'è ancora una prova a cui si applichi → voce **61** § A ④ |
| Finito il giro → **30 giorni** prima di rifarlo | ✅ **dal 18/08/2026** — un giro sono **tre prove**, e quando finiscono partono i 30 giorni. Prima l'attesa scattava solo dopo tre **bocciature**, e chi **passava** poteva rifarlo **subito e all'infinito** |
| Dopo una prova **riuscita** si può ancora **affinare** | ✅ — è il giro disegnato qui sotto: quello che si è tolto è il *«all'infinito»*, non il riprovare |
| Finita l'attesa, il giro dopo nasce **intero** (tre prove, non una) | ✅ dal 18/08 — 🚨 prima no, e nessuno l'aveva visto: con **quattro** bocciature di fila il conto restava ≥ 3 e l'attesa ripartiva dall'ultima ⇒ **una prova ogni 30 giorni, per sempre** |
| Chi viene bocciato **non sa perché**: nessun suggerimento, solo l'offerta di rifarlo | ✅ — un test che spiega è un oracolo |
| Semi-Pro e Professionista il quiz non ce l'hanno (`skip`) | ✅ |
| …e la loro scheda la guarda **il maestro del circolo**, che si contatta **tramite la segreteria** | ✅ **dal 18/08, e vivo anche per i SOCI**. 🚨 E vale solo per chi una fascia ce l'ha: `skip` esce **anche** quando il livello dichiarato non si è letto, e a quel socio «la guarda il maestro» sarebbe **falso** — là il bot dice che la scheda è arrivata e indica la segreteria |
| Dopo tre bocciature: 30 giorni, e si può parlare con la **segreteria** | ✅ |
| Il conto dei tentativi vive nel **ponte**, non nel bot | ✅ — un bot si riavvia, il conto no |
| Il **perché** dell'attesa lo dice il ponte (`motivo_attesa`), e un motivo che il bot non conosce **non si racconta** | ✅ dal 18/08 — dice il *quando* e tace sul *perché*. ⏭️ Serve al giorno del **④**, quando arriverà un secondo motivo e il bot sulla VM sarà ancora quello di ieri |
| A giro finito il bot dice **«hai finito le tue prove»**, non «hai sbagliato tre volte» | ✅ **dal 18/08/2026, e VIVO ANCHE PER I SOCI** dalla sera. Diceva «Hai già fatto **tre tentativi**», col tre scritto a mano, mentre un giro finito può essere **due bocciature e una passata**. ⭐ Il numero non è stato corretto, è stato **tolto**: il ponte porta il conto vero, ma un conteggio esatto delle bocciature è lo stesso rimprovero con un numero più preciso |

---

## C · Chi il livello ce l'ha già

| la regola | oggi |
|---|---|
| Può **rifare** il test | ✅ **dal 18/08/2026, e VIVO ANCHE PER I SOCI** dalla sera. Il bottone lo vedono tutti, e a chi un livello ce l'ha l'invito dice **rifare**, non «fai» |
| Se il test dice **più alto** → sale | ✅ |
| Se dice **più basso** → **non scende** | ✅ **dal 18/08/2026**, su PROD — prima scendeva **subito e per intero**, da 4 a 1 |
| Solo se **tutte e tre** le prove dicono più basso → scende, e **solo di 0,5** | ✅ **dal 18/08/2026**, su PROD |
| Il livello si dice sempre **a parole**, mai a numeri | ✅ |
| Scendendo non si finisce mai **sotto Principiante (1)** | ✅ dal 18/08 — 🚨 **non è una sua regola, è la conseguenza di applicarla**: `0,5` qui vuol dire «da definire», e chi ce l'ha **non può organizzare**. Una regola nata per proteggere non può togliere quel diritto per effetto collaterale |

### Il giro, disegnato — sei Avanzato (4)

| | il test dice | tu | come finisce |
|---|---|---|---|
| **1ª prova** | Intermedio | ti fermi | **resti Avanzato** — in negativo non si scende |
| | | riprovi ↓ | |
| **2ª prova** | Semi-Pro | ti fermi | **diventi Semi-Pro** — è quella che confermi |
| | | riprovi ↓ | |
| **3ª prova** | — | — | l'ultima: qui il giro finisce comunque |

E il caso brutto: **tutte e tre dicono più basso** ⇒ scendi, e **solo di 0,5** (da 4 a 3,5), non al
livello che dicono i test. Finito il giro ⇒ **30 giorni** prima di poterne fare un altro.

🔨 **Fatto il 18/08/2026, e vive su PROD**: le due righe del **non scendere** qui sopra. Al ribasso
l'automatismo non scrive più niente finché le prove non sono **tre di fila**, e alla terza toglie
**mezzo passo** invece del salto al livello che dice il test. Il conto delle prove **si calcola dalle
schede**, come il conto dei tentativi nel ponte: non è tenuto da nessuna parte, quindi non c'è niente
da azzerare e niente che possa divergere dai fatti.

🔨✅ **Fatti il 18/08 anche il ①, il ⑦ e il ⑤ — e stanno nel BOT, quindi «fatto» vuol dire un'altra cosa.**
Il bottone del test lo vedono **tutti** (PR #18), la frase di giro finito non conta più le bocciature
(PR #19), e Semi-Pro e Professionista non restano più in silenzio (PR #21): fusi su `main` del repo
del bot e **deployati sul bot di PROVA** (run 15, `506653b`, riavvii 9 → 12, verificato leggendo la
riga d'avvio sulla VM), e **la sera anche sui SOCI** — `@loziocoach_bot`, run **16**, riavvii 4 → 5,
e dopo il riavvio dichiara `qqbf…` (PROD) e `✍️ prenotazioni REALI` **come prima**: il `.env` non lo
tocca il deploy, e lo si è **verificato** invece di darlo per buono.
🚨 **La regola che ne discende, pagata il 18/08**: di un pezzo del bot non si dice mai «fatto» senza
dire, **nella stessa frase**, che sui bot non cambia niente finché non si fonde **e** non si deploya.
⚠️ E il ⑦ **si è potuto guardare**, contro quello che avevo scritto: la misura «nessuno è dentro un
giro» valeva su **PROD**, e il gestionale di TEST — quello a cui punta il bot di prova — ha invece un
giro chiuso. ⇒ Lo scatto del committente ha mostrato la frase nuova **sul caso esatto per cui esiste**:
un giro fatto di **due bocciature e una passata**, dove il bot vecchio avrebbe detto «hai già fatto
tre tentativi». ⚖️ *Una misura giusta letta sul database sbagliato è una misura sbagliata.*
⚠️ Il **⑤** invece davvero non si vede: schede `skip` non ne esiste **nessuna**, di qua né di là.

🔤 **E dallo stesso scatto è uscito un difetto che nessuno cercava**: la frase finiva **senza punto**
dopo il numero della segreteria. Erano **cinque** punti che scrivevano il punto *solo se il numero non
c'era*, contro **sedici** che lo scrivevano sempre — un'eccezione che sembrava uno stile. Curati tutti
e cinque *(PR #20)*, con un banco nuovo che rende oltre 30 messaggi e pretende che nessuno finisca col
numero. 🚨 Il banco era **verde con tutti e cinque i difetti accesi**: *un difetto che nessun caso può
vedere non è piccolo, è invisibile — e la sua cura lo è altrettanto.*

✅🎉⭐⭐ **④ FATTO IL 19/08/2026 — VIVO SU PROD E PER I SOCI.**
Fino al 18/08 il livello **non lo confermava nessuno**: lo scriveva `assessment-apply-level` (cron
ogni 15′) applicando la scheda da sé. Adesso, su una prova col cancello del quiz, si applica solo
con **«mi fermo»** del socio, col **giro esaurito** (la terza prova non ha una domanda da
aspettare), o col **silenzio oltre 24 ore** — sua scelta del 19/08 contro «aspetta per sempre»,
che riaprirebbe la porta chiusa in faccia per cui l'automatismo era nato.
⚖️ **«Riprovo» vale per sempre** e non lo scavalcano le 24 ore: il silenzio è assenso, una
risposta è una risposta — altrimenti la domanda sarebbe finta.
⭐ **E non è «nel gestionale, non nel bot»**, come diceva questa riga fino a ieri: sono **due
metà**, e il difetto più caro stava **fra le due** — il bot taceva aspettando il livello, il
gestionale aspettava la risposta per scriverlo, e la risposta arrivava solo se il bot parlava.
Una catena chiusa, con ognuno dei due lati corretto da solo. Il racconto intero sta nella voce 61.

---

## D · Regole di casa, sempre

| la regola | oggi |
|---|---|
| **Mai un vicolo cieco**: se il link manca, si manda in segreteria | ✅ |
| Le quattro strade dell'offerta del test — bottone · link scritto · segreteria · attesa | ✅ |
| La frase **promette il bottone solo dove il bottone c'è davvero** | ✅ (la difesa vive in `frasePerIlTest`) |
| Il livello sta nel **gestionale**; la regola di quando è «dimostrato» sta nel **ponte** | ✅ — un livello annunciato in rubrica e negato nella scheda sarebbe la stessa persona con due verità |

---

## ⚠️ «Autovalutazione» vuol dire DUE cose

Da tenere separate, o si pota la cosa sbagliata:

| | cos'è | stato |
|---|---|---|
| il **servizio del bot** | `assessment-quiz`, `consumer-assessment-link`, `assessment-apply-level`, `assessment-notify-staff` + le tabelle `self_assessments` e `assessment_tokens` | ✅ **vivo e in uso** |
| la **sezione nel gestionale** | il tasto «aggiorna risposte» e la riga «Schema autovalutazioni» | ❌ **morta per scelta** → voce **52** |

---

📌 **Dove stanno i pezzi ancora da fare**: tutti dentro la voce **61** di
[`docs/lavori/README.md`](lavori/README.md) — *«finalizzare la sezione «Il mio livello» del bot»*,
messa fra le 🔴 **urgenti** dal committente il 18/08/2026.
🔄 **Le vecchie voci 55, 56 e 57 non esistono più come voci a sé**: assorbite nella 61 la sera
stessa (*«sì assorbile nella 61»*), e le loro schede stanno là dentro per intero — § **A** le regole
del rifare, § **B** il promemoria gentile, § **C** il silenzio su Semi-Pro e Professionista.
🚨 **L'ordine non è libero**: le regole del § A (in negativo non si scende) vengono **prima** di
aprire il bottone a chi un livello ce l'ha, o la cura fa il danno da cui difende.
