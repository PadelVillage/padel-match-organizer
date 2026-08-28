# Passaggio di consegne — 28/08/2026, mezzogiorno

> **Copia questo file come primo messaggio della chat nuova.** Sostituisce quello della mattina
> (`docs/passaggio-consegne-20260828-mattina.md`), che è ormai superato quasi per intero.

---

## 0. In una riga

Si stanno chiudendo le **prove fisiche** del test di livello (punto F di
`docs/test-livello-regole.md`). Stamattina se ne sono chiuse tre e si sono chiuse **quattro voci**
(100, 98, 102, 103), di cui **due nate oggi** da difetti che nessuno stava cercando.

📄 **I due documenti da aprire per primi**, in quest'ordine:

| dove | cosa |
|---|---|
| `docs/lavori/README.md` | la lista dei lavori — **obbligo di casa: si apre PRIMA di lavorare** |
| `docs/test-livello-regole.md` | le regole del test, riga per riga, con lo stato di ognuna |

---

## 1. 🚨 LA COSA URGENTE, e va letta per prima

**Nella chat di Marco c'è un bottone che gli farebbe perdere due fasce di livello.**

Alle **11:26:49** Marco ha fatto un test dichiarando Base ed è stato **bocciato** (3 su 5). Sotto
l'esito ci sono tre bottoni, e il primo è **`✅ Va bene: Principiante`**.

⚠️ **Marco in scheda ha 3,5.** Quel bottone gli scriverebbe **1,5**. Non è un difetto — è il
*gradino* della regola C9, che offre la fascia sotto la **dichiarata** su una bocciatura, e Marco
aveva dichiarato Base — ma nel suo caso sarebbe un danno vero.

👉 **Il bottone sicuro è `👍 Mi tengo il mio livello`**: non scrive niente.
📌 Da verificare all'inizio della sessione nuova: se `member_decision` di quella scheda è ancora
`null`, il bottone è vivo.

```sql
select id, first_name, declared_level, applied_level, member_decision, member_decision_at
from self_assessments where submitted_at > '2026-08-28 09:20:00Z' order by submitted_at desc;
```

---

## 2. Stato del repo — tutto fuso, niente in volo

| | |
|---|---|
| `padel-match-organizer` · `main` | **`cdd35d0`** |
| `padel-match-organizer` · `test-preview` | **`9a77905`** |
| parità sui percorsi sorvegliati | ✅ **allineati** (`docs/`, workflow, `CLAUDE.md`, `server.mjs`) |
| PR aperte | **nessuna**, su nessuno dei due repo |
| `assistente-padel-agent` · `main` | **`fb2cfec`**, ed è **anche ciò che gira sul bot dei soci** |

⇒ Si riparte da una situazione pulita: nessun merge in sospeso, nessun drift, nessuna guardia rossa.
I rami di lavoro rimasti li cancella `cleanup-claude-branches.yml` stanotte.

**Lista dei lavori**: 🔴 urgenti **9** · 📋 in coda **10** · 📦 chiuse **81**.
🆕 La nona urgente è la **104**, aperta a mezzogiorno su sua parola e **promossa da lui** — vedi § 4bis.

---

## 3. Cosa è successo stamattina

### Quattro voci chiuse

| voce | cosa | come si è chiusa |
|---|---|---|
| **100** | chi è sopra il tetto non entrava nella lista del maestro | Laura nel filtro, letta sulla PROD viva con la console remota |
| **98** | la lista per il maestro nel gestionale | **lui** ha aperto Anagrafica soci e visto **due** soci nel filtro — e con questo è caduto anche il residuo del «cablaggio dal vivo», che la console `readonly` non poteva provare |
| **102** 🆕 | l'eco diceva una parola che il bottone non aveva | nata e chiusa in due ore |
| **103** 🆕 | l'esito nominava la parola **dichiarata** invece della **dimostrata** | nata e chiusa in due ore |

### Tre cure in servizio su PROD

1. **L'eco legge il bottone premuto** invece di dedurlo dalla chiave (`eco-decisione.ts`). Allo
   stesso tocco `mi_fermo` corrispondono **tre** bottoni diversi e la chiave è una sola: la parola
   ora si **legge** dalla tastiera che Telegram rimanda col tocco. La tabella resta come
   **cancello** (quali tocchi meritano un'eco), l'etichetta fa la **parola**.
2. **L'esito nomina la parola dimostrata** (`testoEsitoTest` riceve `livelloDimostrato`). Era la
   E4 del 27/08 curata sulla **domanda** e non sull'**esito**. ⛔ Lo `skip` NON si tocca: lì la
   frase dice «per il livello che hai **dichiarato**» e la dichiarata è giusta.
3. **Sette correzioni di italiano** nelle 192 domande della banca (vedi § 6).

📦 Deploy del bot sui soci: **#119**, `fb2cfec`, alle **11:08:04**, verificato sul bersaglio
(«✍️ prenotazioni REALI»).

### 📌 Il filo della giornata, e vale più dei singoli fatti

**Tutto quello che si è chiuso o è nato l'ha trovato qualcuno che guardava una cosa vera**: lui
sullo schermo del telefono (la 103), lui sul gestionale (la 98), io sabotando un banco (il buco
nel cablaggio). **Nessuno dei tre si vedeva rileggendo il codice.**

---

## 4. Le prove fisiche che restano (punto F)

Sono **6**, e stanno in `docs/test-livello-regole.md` § F. In ordine di convenienza:

| # | prova | chi | note |
|---|---|---|---|
| **2** | **la parola dimostrata nella domanda** *(D2)* | Marco | 🎯 **la più vicina**: serve solo che passi il quiz. Vedi § 5 per la ricetta |
| **2bis** | il messaggio del maestro senza corsa *(E11)* | — | ⚠️ **forse è già fatta**: Marco alle **10:58** ha letto *«Il test da solo arriva fino a Intermedio, e te lo sto scrivendo adesso»* e il tetto è stato scritto **8 secondi dopo** (10:58:59). Da valutare se basta a chiuderla — la scheda chiedeva il caso di Laura, ma quello di Marco ha la stessa forma |
| **1** | due test di fila, nessuna domanda ripetuta *(B9)* | chiunque | i dati per provarla ci sono già: Marco ha fatto **tre** test oggi |
| **3** | bottone vecchio «✅ Tengo Agonista» *(D6)* | lui | serve un bottone vecchio nella sua chat |
| **4** | il gradino cronometrato, `applied_at` in ~4 s *(D10)* | lui | 🚨 **scrive un livello vero** |
| **5** | la consegna cronometrata dopo i 2″ *(D9)* | — | ⛔ **bloccata**: i 2 secondi non sono ancora stati fatti (vive nel repo del bot, `promemoria.ts`, `INTERVALLO_SORVEGLIANZA_TEST_MS`) |

**Altre due cose aperte, fuori dal punto F:**

- ⏳ **il residuo della voce 102**: la parola «**Mi tengo il mio livello**» nell'eco non l'ha vista
  nessuno. La cura è provata sull'altro ramo («Tengo Avanzato»), quindi è una **deduzione**
  dichiarata come tale. Si chiude con un test **bocciato o che dice meno**, toccando quel bottone;
- ⏳ **il silenzio su TEST** — vedi § 7.

---

## 4bis. 🆕🗣️ VOCE **104** — le opzioni in ordine casuale *(fra le URGENTI, promossa da lui)*

🗣️ Sue parole, con lo screenshot della domanda «Come gestisci il vetro in difesa?» davanti:

> *«Diverse domande sono in ordine crescente di livello: quella più in alto è il livello più basso,
> quella in fondo è il più alto. Io questa cosa vorrei cambiarla. Dovrebbe essere un ordine random,
> se no dopo un po' la gente capisce questo sistema.»*

🔼 **È la voce 104, e sta fra le URGENTI perché ce l'ha messa lui**: l'avevo aperta in coda
dichiarando che non bloccava niente, e pochi minuti dopo l'ha spostata di sopra — *«mettila nella
lista dei task che stiamo facendo adesso»*. ⇒ **È il lavoro da cui ripartire.**

⇒ **È un difetto del cancello, non di stile**: chi rifà il test qualche volta impara che *l'ultima
opzione è sempre la più alta*, e da lì pilota il livello senza saper giocare. La banca delle domande
di conoscenza ha già la memoria e la pescata a caso; **le otto domande di scheda no**: le loro
opzioni escono sempre nello stesso ordine, e quell'ordine **è** la scala.

### Quello che ho già misurato, e che decide come si fa

✅ **Mescolare è SICURO per il punteggio.** Il punteggio delle quattro domande tecniche nasce
**confrontando il testo** (`assessmentPublicScoreFromText`), non l'indice, e `scelte()` tiene il
**dato** (`valore`) attaccato all'etichetta (`testo`). ⇒ Spostare un'opzione si porta dietro il suo
punteggio. *(Le due domande sul livello usano `valore = String(f.max)`, cioè il numero della fascia:
anche lì il dato viaggia con l'opzione.)*

🚨 **MA NON si mescola dentro `SCHEDA_DOMANDE`**, ed è la trappola. `test/motore-a-passi.test.mjs`
confronta quelle otto domande con i `<select>` veri di `index.html` **opzione per opzione e
nell'ordine** (`domanda.opzioni.map(o => o.valore)` contro quelli della pagina). Mescolare alla
fonte fa diventare rossa quella parità, che esiste per una ragione buona: finché `index.html` è
viva, le domande stanno in **due posti**.
⇒ **Si mescola al momento di presentarle**, cioè in `domandeDelGiro` — dov'è già mescolato l'ordine
delle domande — lasciando `SCHEDA_DOMANDE` come sorgente canonica ordinata.

🔒 **E la mescolata dev'essere RIPETIBILE COL GETTONE**, come quella delle domande: chi lascia un
test a metà deve ritrovare le opzioni dove le aveva lasciate (regola A3). Il modo c'è già ed è
`sorteDa(seme(assessTxt(token), '<sale>'))`.
⚠️ Il **sale dev'essere DIVERSO** da `'ordine-del-giro'` e da quello della pescata — è scritto nel
commento di `domandeDelGiro`: con lo stesso `rnd` un ordine direbbe qualcosa sull'altro.

### La decisione che resta a lui, e va posta prima di scrivere codice

**Quali delle otto mescolare.** Non sono tutte uguali:

| domanda | opzioni | mescolarle? |
|---|---|---|
| scambio · vetro · rete · colpi alti | descrizioni di bravura | ✅ **sì** — sono queste che lui ha visto, e l'ordine è la scala |
| «Da quanto giochi» · «Quante volte al mese» | scale **numeriche** (1 mese → 3 anni · 0-1 → più di 10) | ⚠️ mescolarle rende la lettura faticosa senza togliere nessun vantaggio: il socio non guadagna niente a dichiarare di giocare da più tempo |
| «Che livello pensi di avere» · «alla pari con» | i **sette livelli** in scala | 🚨 **da chiedergli**: è una scala vera e mescolarla confonde chi risponde onesto. E il vantaggio è dubbio, perché il nome del livello è scritto sul bottone: l'ordine non aggiunge informazione |

📌 **La mia proposta, da mettergli davanti**: mescolare **solo le quattro tecniche**. Sono l'unico
posto dove la posizione dice qualcosa che il testo non dice già.

### Cosa NON toccare

⛔ Le opzioni delle **domande di conoscenza**: là la risposta giusta è un **indice** (`correct: N`) e
la correzione avviene sul server ripescando col gettone (regola B7). Mescolarle vorrebbe dire
applicare **la stessa** mescolata anche in correzione, o si corregge la risposta sbagliata. Oggi non
serve: quelle opzioni non sono in ordine di livello, quindi non c'è niente da imparare.

### Prove da scrivere insieme alla cura

- che lo **stesso gettone** dia **lo stesso ordine** (ripetibilità, A3);
- che gettoni diversi diano ordini **diversi** (altrimenti la cura non cura);
- che il **punteggio non cambi** mescolando: stesse risposte, stesso livello calcolato — è la prova
  che il dato viaggia con l'opzione;
- che `motore-a-passi` resti **verde**, cioè che la fonte non sia stata toccata.

⏳ **Non è ancora stato scritto niente**: è un lavoro dichiarato, non fatto. E vuole il deploy del
bot più una prova fisica (aprire il test due volte e vedere le opzioni in ordine diverso).

📄 La scheda completa sta in `docs/lavori/README.md`, voce **104**, fra le urgenti.

---

## 5. ⭐⭐ COME SI PILOTA UN TEST VERSO UN ESITO PRECISO

**Questa è la parte che costa di più da riscoprire, ed è tutta misurata eseguendo il codice vero.**
Senza questa sezione si tira a indovinare, e indovinare è già costato **due test buttati** stamattina.

### Le formule, lette in `supabase/functions/assessment-quiz/conoscenza.js`

```
calcolato_grezzo = 0,40·dichiarato + 0,25·«alla pari» + 0,35·media_tecnica
poi TAGLIATO:   calcolato ≤ dichiarato + 0,5   e   calcolato ≥ dichiarato − 1,0

coerenza: scarto = |dichiarato − media_tecnica|
          ≤ 0,5 → high   ·   ≤ 1 → medium   ·   > 1 → LOW ⇒ staff_status «review»
```

🚨 **`consistency low` è la trappola numero uno**: la scheda va in `review`, il livello non si
applica e **il bot resta muto** dopo «Lo sto registrando: fra poco ti scrivo com'è andata».
⇒ *Rispondere «tutto al massimo» dichiarando una fascia bassa NON funziona mai.*

### I valori delle fasce (`PMO_LIVELLI`, campo `max`)

| Principiante | Base | Intermedio | Avanzato | Agonista | Semi-Pro | Professionista |
|---|---|---|---|---|---|---|
| 1,5 | 2,5 | 3,5 | 4,5 | 5,5 | 6,5 | 7,0 |

### I punteggi delle quattro domande tecniche

| opzione | scambio | vetro | rete | colpi alti |
|---|---|---|---|---|
| 1ª | 1,0 | 1,0 | 1,5 | 1,5 |
| 2ª | 2,0 | 2,0 | 2,0 | 2,0 |
| 3ª | 3,0 | 2,5 | 2,5 | 2,5 |
| 4ª | 4,0 | 3,5 | 3,5 | 3,5 |
| 5ª | 5,0 | 4,5 | 4,5 | 4,5 |

### Le due ricette già calcolate, con la loro robustezza

**Ⓐ Per far uscire «dichiarato Intermedio → dimostrato Avanzato»** (regge 17 deviazioni su 20):

- livello dichiarato: **Intermedio** · alla pari: **contro Avanzati**
- scambio: **«Tengo scambi anche con ritmo alto»** ← il **quarto**, non l'ultimo
- vetro / rete / colpi alti: **l'ultimo** di ognuna
- 🚨 le tre cose che la rompono: alla pari «Principianti» o «Base», e lo scambio all'ultima opzione
  (la media tecnica salirebbe a 4,63 ⇒ scarto > 1 ⇒ `low`)

**Ⓑ Per far uscire «dichiarato Base → dimostrato Intermedio»** — è il caso della prova **2**
(1543 combinazioni valide, quindi molto perdonante):

- livello dichiarato: **Base** · alla pari: **contro Intermedi** (va bene anche Avanzati)
- scambio: «Tengo scambi regolari con continuità» · vetro: «Difendo con il vetro in modo base»
- rete: «Gioco volée semplici» · colpi alti: «Uso almeno la bandeja in modo semplice»
- ⇒ calcolato **3,0 = Intermedio**, coerenza **high**
- 🚨 **non gonfiare**: salendo di un solo gradino su tutte e quattro la media arriva a 3,63 ⇒ `low`
- ⚠️ **e poi bisogna PASSARE il quiz**: almeno **4 su 5**. È qui che Marco si è fermato oggi (3/5)

### Lo script che ha prodotto queste ricette — si ricrea in due minuti

```bash
cp supabase/functions/assessment-quiz/conoscenza.js /tmp/conoscenza.mjs
```
```js
// /tmp/sim.mjs — poi: cd /tmp && node sim.mjs
import { calculateAssessmentPublicLevel, pmoLivelloFascia } from './conoscenza.mjs';
const R=['Faccio fatica a tenere 3-4 colpi','Tengo lo scambio solo a ritmo lento','Tengo scambi regolari con continuità','Tengo scambi anche con ritmo alto','Costruisco il punto con controllo'];
const G=['Evito quasi sempre il vetro','Lo uso solo se la palla è facile','Difendo con il vetro in modo base','Lo uso con continuità anche sotto pressione','Lo uso per difendere e ripartire in attacco'];
const N=['Sto poco a rete','Vado a rete ma faccio fatica a chiudere','Gioco volée semplici','Tengo posizione e controllo le volée','Costruisco e chiudo il punto a rete'];
const O=['Non li uso','Li provo ma con poca sicurezza','Uso almeno la bandeja in modo semplice','Uso bandeja e smash con controllo','Uso colpi alti in modo tattico e affidabile'];
const LIVV=['1.5','2.5','3.5','4.5','5.5'];
const DICH='2.5', VOLUTA='Intermedio';           // ← i due parametri da cambiare
const campi={balancedLevel:LIVV,rally:R,glass:G,net:N,overhead:O};
const buono=(d)=>{const o=calculateAssessmentPublicLevel(d);
  return pmoLivelloFascia(o.calculated_level).definizione===VOLUTA && o.coherence!=='low';};
let best=null;
for(const b of LIVV)for(const r of R)for(const g of G)for(const n of N)for(const o of O){
  const d={declaredLevel:DICH,balancedLevel:b,rally:r,glass:g,net:n,overhead:o};
  if(!buono(d))continue;
  let regge=0,tot=0;
  for(const [c,el] of Object.entries(campi))for(const v of el){if(d[c]===v)continue;tot++;if(buono({...d,[c]:v}))regge++;}
  if(!best||regge>best.regge)best={d,regge,tot,out:calculateAssessmentPublicLevel(d)};
}
console.log(best);   // la combinazione col margine più largo, e quanto ne regge
```

📌 *Eseguire il codice vero invece di ragionare sulle formule: le due volte in cui ho ragionato
a mente, ho sbagliato.*

---

## 6. Le sette correzioni di italiano, già in servizio

Cercate leggendo **tutte** le 192 domande e le 768 opzioni. **Accenti e apostrofi erano già
puliti** — niente `qual'è`, `perchè`, `un'altro`, doppi spazi. Le sette erano di concordanza e di
riferimento:

| dove | prima → dopo |
|---|---|
| **P-20** | «Che **salgono** a rete» → «Che **sale**» (soggetto «una coppia», singolare) |
| **B-T10** | «la **contropared**» → «la **controparete**» (spagnolo; AG-02 diceva già l'italiano) |
| **A-15** | domanda: «…ha «l'iniziativa» **sugli avversari**?» (il «li» dell'opzione non aveva antecedente) |
| **I-15** | «Dopo aver **servito**, cosa fa chi ha **servito**?» → «Dopo **il servizio**…» |
| **P-14** | «**Dietro** la linea di servizio» → «**Da dietro**» |
| **B-22** | «**Com'è** l'altezza…» → «**Come varia** l'altezza…» |
| **B-26** | «contano solo **quelle** del servizio» → «solo **le linee** del servizio» |

⚠️ **Vincolo da ricordare toccando la banca**: le **opzioni** hanno un tetto di **36 caratteri**
(le domande no). Lo verifica `node test/opzioni-che-entrano-nel-bottone.test.mjs`. È il motivo per
cui A-15 è stata corretta nella domanda e non nell'opzione.

---

## 7. Il silenzio su TEST — l'unica cosa aperta e non scavata

📏 Alle **10:05 su TEST** una scheda è finita in `consistency low` → `review`, e dopo «Lo sto
registrando: fra poco ti scrivo com'è andata» **non è arrivato più niente**.

Due misure già in mano:

- su **PROD** le schede `consistency low` sono **16** e **zero** applicate — quindi il caso esiste
  anche là — ma **nessuna** è passata dal test dentro Telegram: sono tutte del vecchio modulo web.
  ⇒ Il muto potrebbe essere un buco della regola **P0** (*«a ogni esito un messaggio esce sempre»*)
  che non ha ancora visto nessuno su PROD;
- il database di **TEST è indietro** rispetto a PROD: gli mancano quattro colonne
  (`consistency_score`, `inconsistency_reasons`, `review_note`, `email`). ⚠️ Però `assessment-quiz`
  **non le scrive** (dice il commento a riga 425), quindi probabilmente **non** è questa la causa.

🗣️ Il committente l'ha messo da parte (*«per il momento lasciamo perdere test»*): si riprende
quando lo dice lui.

---

## 8. Lo stato dei tre soci di prova

| socio | livello in scheda | note |
|---|---|---|
| **Maurizio Aprea** (`000004`) | **4** — Avanzato | invariato da stamattina |
| **Laura Aprea** (`000140`) | **3,5** — Intermedio | nel filtro «Da certificare dal maestro» |
| **Marco Aprea** (`000133`) | **3,5** — Intermedio | 🆕 **salito da 3 alle 10:58:59** (tetto scritto). Anche lui nel filtro del maestro. 🚨 Ha un bottone vivo che gli scriverebbe **1,5** — vedi § 1 |

---

## 9. Attrezzi

**🤖 Repo del bot** — `PadelVillage/assistente-padel-agent` (privato). **Non è attaccato a una
sessione nuova**: `add_repo`, poi *una sola* clonazione con timeout generoso, poi
`register_repo_root`. Serve `npm install` per far girare `npm test` e `npm run check`.

**🚀 Deploy del bot** — `deploy-bot-hetzner.yml`, `workflow_dispatch`. Bersaglio `prova`
(predefinito) o `soci` (serve scrivere la parola **`SOCI`**). ⭐ **Non è automatico**: fondere una PR
non manda niente in servizio. Il `.env` non viene toccato, quindi il bot resta dov'era puntato.

**🔎 Sonda di sola lettura** — `stato-bot.yml`, con `quale` (soci/prova), `righe` e una regex
`cerca`. È il modo di sapere **dove punta** un bot senza dedurlo. ⚠️ Il registro del bot **non
logga le scelte riuscite**, solo i rifiuti: cosa ha letto il socio lo dice solo la sua chat.

**🧪 Bot di prova** — `@padelvillage_prova_bot`, id `8839841397`, punta a **TEST** e ci scrive
davvero. **Aggiornato stamattina** al codice di allora; se serve, rideployarlo prima di usarlo.

**🗄️ Supabase MCP** — PROD `qqbfphyslczzkxoncgex`, TEST `cudiqnrrlbyqryrtaprd`.
⚠️ Le tabelle non si chiamano come ci si aspetta: i soci stanno in `pmo_cloud_records` con
`record_type = 'member'`, e il livello è `payload->>'level'`. Non esiste nessuna tabella `clienti`.

**🌐 Console remota** — `tools/verifica-browser/`, si usa in autonomia su TEST e PROD.
⚠️ L'utenza `readonly` **non apre Anagrafica soci** (`view_members` mancante): per quella schermata
serve il Mac o le sue mani.

**⛔ Telegram non si raggiunge da qui**: `api.telegram.org` è bloccato dal proxy (403 al CONNECT), e
comunque **un bot non può parlare con un bot** — servirebbe un account utente. ⇒ Le prove sul bot le
fa lui, sempre.

---

## 10. Come lavorare con lui

1. **Non si chiede il permesso per il metodo** (delega del 23/08), ma **si dichiara** ciò che si
   decide. Restano fuori: inventare voci che nella lista non ci sono, e le cose irreversibili o che
   si vedono da fuori — quelle **si dicono prima**.
2. **Prima di ogni gesto che tocca un socio vero, dire quale socio si tocca e cosa gli succede in
   scheda.** Oggi è servito due volte.
3. ✋ **Un task non è finito finché non lo si è provato fisicamente.** Un banco verde non è un
   messaggio arrivato a qualcuno. Se la prova non si può fare adesso, la voce **resta aperta e lo
   si dice** — e si scrive **cosa manca** per chiuderla.
4. **La lista si aggiorna DURANTE il lavoro**, non a giornata finita.
5. 🔀 **Ordine dei push**: prima `test-preview`, poi il rispecchio su `main` con una PR (mai una PR
   *da* `test-preview`: `guard-main-prs` la rifiuta). E **ricontrollare la parità dopo il merge** —
   oggi è così che ho scoperto una PR rimasta aperta che teneva i rami disallineati.
6. **I conteggi della lista si verificano girando la logica di `guard-docs-truth` sul file**, non a
   occhio. Sono sei numeri e devono tornare tutti.

### 🩹 I tre errori che ho fatto oggi — per non rifarli

- **Ho dedotto invece di misurare, due volte**: la ricetta del test delle 10:05 (ha mandato la
  scheda in `review` e ha buttato il test) e la previsione «uscirà Intermedio» delle 10:11 (il
  taglio è un **tetto**, non il valore). ⇒ *Eseguire il codice vero.*
- **Ho lasciato una PR aperta** mentre ne aprivo un'altra, e i rami sono rimasti disallineati per
  mezz'ora senza che nessuno se ne accorgesse.
- **Ho scritto una guardia che non copriva la metà che conta**: le prove chiamavano la funzione in
  diretta, quindi staccando il cablaggio restavano verdi. L'ho trovato **sabotando**, non
  rileggendo. ⇒ *Sabotare sempre una cura in tutte le sue metà, cablaggio compreso.*

---

## 11. Il primo messaggio da mandargli

> Ripartiamo. Prima di tutto: **nella chat di Marco c'è ancora il bottone «Va bene: Principiante»**,
> che gli scriverebbe 1,5 al posto del 3,5 che ha adesso — fallo toccare «Mi tengo il mio livello»,
> che non scrive niente.
> Poi la prova più vicina è la **2** del punto F: Marco rifà il test dichiarando **Base** con le
> risposte di profilo a metà, e stavolta deve prendere **almeno 4 su 5** al quiz — oggi si è fermato
> a 3. Le domande saranno diverse, perché la pescata ha memoria.
> Poi c'è la **voce 104**, che hai messo tu fra i task di adesso: le **opzioni in ordine casuale**
> (§ 4bis). È pronta per essere scritta — i due vincoli tecnici sono già misurati — ma prima ho una
> domanda per te: **quali** delle otto domande mescolare. La mia proposta è **solo le quattro
> tecniche**, e nel § 4bis c'è il perché.
> Infine, una cosa da decidere: la prova **2bis** (il messaggio del maestro senza corsa)
> potrebbe essere **già fatta** — Marco alle 10:58 ha letto la frase giusta e il tetto è stato
> scritto otto secondi dopo. Se sei d'accordo la chiudo.
