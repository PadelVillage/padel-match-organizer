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
| È il socio a **decidere a quale prova fermarsi** | 🆕 → voce **61** § A |
| Finito il giro → **30 giorni** prima di rifarlo | 🔴 oggi solo dopo **tre bocciature**; chi **passa** può rifarlo **subito** → voce **61** § A |
| Chi viene bocciato **non sa perché**: nessun suggerimento, solo l'offerta di rifarlo | ✅ — un test che spiega è un oracolo |
| Semi-Pro e Professionista il quiz non ce l'hanno (`skip`) | ✅ |
| …e la loro scheda la guarda **il maestro del circolo**, che si contatta **tramite la segreteria** | 🆕 (17/08) — 🔴 oggi il bot **tace** → voce **61** § C |
| Dopo tre bocciature: 30 giorni, e si può parlare con la **segreteria** | ✅ |
| Il conto dei tentativi vive nel **ponte**, non nel bot | ✅ — un bot si riavvia, il conto no |

---

## C · Chi il livello ce l'ha già

| la regola | oggi |
|---|---|
| Può **rifare** il test | 🆕 il bottone non gli compare mai → voce **61** § A |
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

🚨⭐⭐ **Quello che RESTA è la parte più pesante, e non è un bottone in più.** Oggi il livello **non lo
conferma nessuno**: lo scrive un automatismo (`assessment-apply-level`, cron ogni 15 minuti) che
applica la scheda da sé, senza chiedere niente al socio. La regola della scelta gli mette davanti
**una domanda** — «tieni questo o riprovi?» — cioè l'automatismo deve **smettere di decidere da
solo** e aspettare. È nel gestionale, non nel bot.

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
