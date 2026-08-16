# Voce 43 — la prova dal Mac

**Preparata il 16/08/2026, 25ª sessione, da eseguire dal Mac.** La voce è **misurata** (la scheda in
`docs/lavori/README.md` ha i numeri); qui c'è solo **come vederla succedere**.

---

## ⚠️ AGGIORNAMENTO, poche ore dopo: la metà che conta è già stata fatta — DA REMOTO

📌 **Questo documento è nato credendo che servissero le mani di qualcuno davanti allo schermo. Per
buona parte non era vero**, e a ricordarlo è stato il committente: la **console remota**
(`tools/verifica-browser/`, costruita nella 22ª) apre l'app in un browser vero da una sessione cloud
ed esegue codice dentro la pagina.

🎯 **E la chiave non è stata l'attrezzo, è stata la domanda**: non serve *cogliere* la finestra al
volo — basta **ricostruire lo stato in cui l'app si trova dentro quella finestra**. Una riga tolta
dalla memoria locale, la lapide **non spinta**, poi l'aggiornamento forzato. Nessun annullo, nessuna
scrittura: l'attrezzo aveva le scritture **bloccate** per tutta la prova.

**Esito (TEST 6.242):**

| | |
|---|---|
| riga tolta dalla memoria, non spinta | dopo l'aggiornamento è **TORNATA** 🔴 |
| riga **finta**, assente nel cloud | dopo l'aggiornamento è **CANCELLATA** 🔴 |

⇒ **L'aggiornamento non fonde: SOSTITUISCE.** La **previsione B è confermata**, ed era quella che
poteva smentire la diagnosi. Il blocco è **identico su PROD** (diffato).

### Cosa di questo documento resta valido

⛔ E resta valido come **ricetta per cogliere la finestra davvero**, se un domani si vorrà: qui sotto
c'è come allargarla. Ma per *decidere la cura* non serve più — quello che si voleva sapere si sa.

## 🚨 SECONDO AGGIORNAMENTO, 26ª sessione: anche la previsione D è stata fatta DA REMOTO

📌 **Qui sopra c'era scritto** che della previsione D *«`staffCalGetSlots` non è raggiungibile dalla
console remota, e quella metà vuole ancora un operatore davanti allo schermo»*. **Era falso**, ed è
lo stesso errore che questo documento aveva già fatto una volta — dichiarare un attrezzo inadatto
**senza provarlo**. La premessa reggeva (quella funzione sta dentro l'IIFE e su `window` non c'è);
la conclusione no, perché la previsione D **non chiede quella funzione**, chiede *cosa mostra il
calendario* — e `__PMOStaffCalTest.renderCal(iso)` è esposto, renderizza il calendario **vero** e
restituisce il testo delle card.

**Esito (TEST 6.243), col metodo della previsione B — ricostruire lo stato, non coglierlo:**

| | il calendario mostra il fantasma? |
|---|---|
| controllo positivo: riga presente, **senza** soppressione | 🟢 **sì** (la sonda sa vedere) |
| riga presente **+** soppressione locale | ⚪️ **no** |
| controprova: soppressione tolta | 🟢 **sì** |

⇒ **Previsione D confermata: il fantasma non si vede.** E il bordo della protezione è il **TTL di
30 minuti**: misurato a **29** ⇒ nascosto, a **31** ⇒ 🔴 **compare**.

### ⇒ Cosa resta DAVVERO da fare dal Mac

⛔ **Una cosa sola: l'annullo vero su TEST**, cioè la procedura qui sotto. Il `readonly` della
console remota non ci arriva — `staffCalDoCancel` esce subito su `pmoBlockWriteIfReadonly` — e serve
a esercitare **la catena vera**: il commit locale dentro `_staffCalCommitLocalCancel` con la cura A
attiva, che dal cloud non è mai stata fatta girare sull'app vera.
📌 Le previsioni **A**, **B** e **C** qui sotto restano da guardare in quella corsa; la **D** no, è
fatta.

⚖️ **La procedura qui sotto NON è stata buttata**: è la prova che è cambiata di natura, non che fosse
sbagliata. Chi la esegue oggi esercita la catena vera dell'annullo, che la prova da remoto **non**
tocca.

---

## ⭐ La scoperta che cambia la prova: si fa su TEST, non su PROD

La scheda della 43 dice che la sua cura *«tocca la strada che annulla per davvero su Matchpoint»*, ed
è per questo che era stata rimandata al Mac. **Misurato il 16/08: la corsa si riproduce interamente
su TEST, senza toccare il Matchpoint del circolo.**

Perché: su TEST `PMO_BOOKINGS_SIMULATE = PMO_IS_TEST_ENV`, e la simulazione intercetta **la `fetch`**
verso `matchpoint-bookings-cancel` restituendo `{ok: true, simulated: true}` con **status 200**.
Dentro `staffCalDoCancel` quel 200 soddisfa `response.ok && data?.ok !== false` ⇒ **`_applicaAnnullo()`
parte davvero**, e con lui tutta la catena che ci interessa: il commit locale e la spinta **non
attesa** delle lapidi.

⇒ **Del percorso si esercita tutto tranne l'unica parte che non ci serve** — la scrittura su
Matchpoint. È esattamente ciò che rende la prova sicura.

🚨 **Quello che invece si scrive DAVVERO** (e va saputo prima di partire): `pmoSyncCloudRecordsNow`
non è simulata. Sul Supabase **di TEST** (`cudi…`) atterrano per davvero un `staff_booking` con
`deleted:true`, uno `staff_suppress` e le lapidi `booking_occupancy`/`booking` dello slot.
⚖️ Si richiude da sé: dal 16/08 il calendario di TEST si risincronizza **5 volte al giorno** (voce
34), quindi la riga torna al giro dopo. Ma è una scrittura, non una simulazione — e su **PROD** non
si tocca niente.

---

## Cosa serve

| | |
|---|---|
| dove | `test.padelvillage.club` — **non** `app.` |
| chi | un login staff **con il permesso di annullare**. ⚠️ Il `readonly` della console remota **non basta**: `staffCalDoCancel` esce subito su `pmoBlockWriteIfReadonly` |
| cosa | DevTools aperta sulla console |
| quando | una prenotazione qualunque sul calendario di TEST, meglio se **di oggi o futura** (il ponte `_retained` conserva solo le date **passate**, e falserebbe la lettura) |

📌 `window.__PMOStaffCalTest` esiste **solo su TEST** (è gated `PMO_IS_TEST_ENV`): è da lì che si
legge lo stato senza dover frugare nelle closure.

---

## La procedura

### ① Allargare la finestra — se no la corsa non si vede

La finestra scoperta dura quanto la POST delle lapidi: **~100–500 ms**. Il poll rapido gira ogni
**4 s** sotto i 900 px di larghezza e ogni **8 s** sopra ⇒ a caso ci si azzecca circa **una volta su
dieci**, e dieci annullamenti sono dieci scritture. Meglio allargarla, da console e **senza toccare
l'app**:

```js
// Ritarda di 6 secondi SOLO la spinta dei record cloud, così il poll da 4 s
// cade di certo dentro la finestra. Niente modifiche all'app: solo questa scheda.
window.__pmoRealFetch = window.fetch;
window.fetch = function (u, o) {
  const url = (typeof u === 'string') ? u : (u && u.url) || '';
  if (/\/rest\/v1\/rpc\/pmo_upsert_records/.test(url)) {
    console.warn('[prova-43] ritardo la spinta delle lapidi di 6s');
    return new Promise(r => setTimeout(() => r(window.__pmoRealFetch(u, o)), 6000));
  }
  return window.__pmoRealFetch(u, o);
};
```

🚨 **Restringere la finestra del browser sotto i 900 px** prima di partire: sopra, il poll salta un
giro su due (`_staffCalPullTick % 2`) e il ritardo di 6 s potrebbe non bastare.

### ② Fotografare lo stato PRIMA

```js
const slot = { data: '2026-08-16', campo: 1, ora: '18:00' };   // ← quello che annullerai
const conta = () => __PMOStaffCalTest.getOccupancy()
  .filter(p => p.data === slot.data
            && Number(String(p.campo).replace(/\D/g,'')) === slot.campo
            && String(p.ora).trim() === slot.ora).length;
console.log('PRIMA:', conta());        // atteso: 1
```

### ③ Annullare dalla scheda, e guardare

Annulla lo slot **dall'interfaccia**, normalmente. Poi, mentre il ritardo di 6 s è in corso:

```js
setTimeout(() => console.log('DOPO il commit, DURANTE la finestra:', conta()), 1000);
setTimeout(() => console.log('dopo un poll (finestra ancora aperta):',  conta()), 5000);
setTimeout(() => console.log('a lapidi atterrate:',                     conta()), 12000);
```

### ④ Rimettere a posto

```js
window.fetch = window.__pmoRealFetch;   // togli il ritardo
```

E ricarica la pagina. La riga tornerà da sé al prossimo giro del sync di TEST.

---

## Le previsioni, dichiarate PRIMA — è questo che rende la prova una prova

| # | previsione | cosa significa se sbaglia |
|---|---|---|
| **A** | a 1 s dal commit `conta()` è **0** | il commit locale non toglie la riga ⇒ ho letto male `_staffCalCommitLocalCancel` |
| **B** | a 5 s — dopo che il poll ha girato, con le lapidi **non** ancora atterrate — `conta()` è tornato **1** | 🚨 **è LA previsione della voce.** Se resta 0, la riassegnazione secca di `prenotazioniOccupazione` (righe 38181-38182) non fa quello che dico, e **la diagnosi della 43 è sbagliata**: va riscritta, non aggiustata |
| **C** | a 12 s, lapidi atterrate, `conta()` è di nuovo **0** | se resta 1 la corsa non si richiude da sé, ed è **peggio** di quanto scritto: sarebbe un guasto stabile, non una finestra |
| **D** | **il calendario NON mostra mai il fantasma**, in nessuno dei tre momenti | se lo mostra, la soppressione locale non copre l'occupazione come ho misurato, e il danno è **più grande** di quanto dice la voce |

⚖️ **B e D insieme sono il punto della voce**: lo stato locale *sbaglia*, e lo schermo *non lo dice*.
È per questo che il difetto non si è mai visto — e per questo la cura è una decisione e non
un'urgenza.

---

## Cosa questa prova NON dimostra

⛔ **Non dimostra che oggi qualcuno ci abbia rimesso.** Dimostra che **la forma c'è** ed è
raggiungibile. I lettori che il fantasma lo vedrebbero davvero non passano da `staffCalGetSlots`
(`uniqueFieldOccupancyBookings`, i roster), e l'unico punto che lo **rimanderebbe sul cloud** —
`pmoBuildCloudRecordsFromLocalState` — è dietro un **bottone d'amministrazione**, non una routine.
⛔ **Non prova la cura**, perché la cura non è ancora scelta. Serve a decidere *se* farla.

## Le due cure, da decidere DOPO aver guardato

| | cosa cambia | costo |
|---|---|---|
| **minima** | spostare `_staffCalPendingEdits.delete(_pendCancelKey)` **dopo** `_applicaAnnullo()` | 2 righe, ma copre **solo** il poll rapido (l'unico dei 5 forzati che quella chiave la consulta) |
| **larga** | tenere la chiave finché `pmoSyncCloudRecordsNow` non è atterrata | copre tutta la corsa, ma allunga l'attesa cross-device: gli altri device vedono lo slot «in lavorazione» più a lungo |

📌 **Nessuna delle due è «metti `await` dappertutto»**: rimetterebbe in circolo la lentezza che la
6.231 ha tolto, e su mobile quella lettura costava ~20 s.

---

## Le righe citate, misurate il 16/08 su `main` (PROD 6.233)

⚠️ **Sono cambiate oggi**: la voce 45 ha tolto ~30 righe più in alto nello stesso file. Questi sono i
numeri di *adesso*; su `test-preview` (6.242) le stesse cose stanno ~400 righe più in basso.

| cosa | riga su `main` |
|---|---|
| `_staffCalPendingEdits.add(_pendCancelKey)` — la finestra si apre | **43467** |
| `_staffCalPendingEdits.delete(_pendCancelKey)` — si chiude **troppo presto** | **43547** e **43575** |
| `_applicaAnnullo()` — i tre commit, tutti **a valle** della delete | **43518**, **43556**, **43562** |
| `_staffCalCommitLocalCancel` — toglie le righe locali | **43358** |
| la spinta **non attesa** delle lapidi | **43405** |
| `const cloud = await pmoLoadMatchpointBookingsFromCloud()` — la fotografia | **38095** |
| `prenotazioni = cloud.bookings` / `prenotazioniOccupazione = _occToStore` — la **riassegnazione secca** | **38181-38182** |
| la pre-guardia del poll rapido | **37533** |
