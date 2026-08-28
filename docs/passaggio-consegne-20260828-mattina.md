# Passaggio di consegne — 28/08/2026 mattina · **si riprende dal PUNTO F**

> **Copia questo file come primo messaggio della chat nuova.** Contiene tutto quello che serve
> per continuare senza rileggere la conversazione di ieri notte.

---

## 0. Cosa si stava facendo, in una riga

Il committente e io stiamo **validando riga per riga le regole del test di livello**. Le sezioni
**A, B, C, D, E, G sono chiuse**. Resta la **F: le prove fisiche**, e ne restano **otto**.

📄 **I due documenti da aprire per primi:**

| dove | cosa |
|---|---|
| `docs/test-livello-regole.md` (ramo `test-preview`) | **la copia canonica**, aggiornata con tutto quello che segue |
| https://claude.ai/code/artifact/1ff03857-4d66-4590-8cce-3b6b17165585 | lo stesso documento pubblicato, che lui guarda |

🚨 **Sono gemelli e vanno tenuti allineati**: quando una regola cambia, si corregge **la riga**, in
tutti e due. E `docs/` dev'essere **identico** su `test-preview` e `main`, o `guard-worker-sync` va
rossa (vedi § 5).

---

## 1. ⚠️ Stato del repo in questo momento — leggere prima di toccare git

| | |
|---|---|
| ramo di sviluppo | `test-preview`, ultimo commit **`4a586f76`** |
| PR verso `main` | [#1153](https://github.com/PadelVillage/padel-match-organizer/pull/1153) — **APERTA, verde, senza conflitti** |
| ramo della PR | `regole-test-livello-validate`, ultimo commit `59d7f8d0` |

🚨 **La PR #1153 non è ancora fusa, e va fusa da lui.** Finché non lo è, `docs/` è **diverso** fra i
due rami e la guardia anti-drift resta scontenta. La PR contiene *solo documentazione*, nessun
codice, nessun deploy.
⚠️ **Se serve aggiungere altre righe ai documenti prima del merge**: si spinge su `test-preview` e
**poi si rispecchia lo stesso file sul ramo della PR** (`git checkout <sha-di-test-preview> --
docs/<file>`), invece di aprire una PR nuova. È quello che ho fatto stamattina con la prova di Laura.

⛔ **La PR verso `main` NON può partire da `test-preview`**: `guard-main-prs` la rifiuta. Deve
partire da un ramo nato da `main`.

---

## 2. ✅ Cosa è stato deciso ieri notte (già scritto nei due documenti)

**Otto regole corrette da lui:**

| | cosa è cambiato |
|---|---|
| **A1** | il ripiego web esce dalla regola — *«il link web non serve più»* |
| **A2** | **nessun limite di prove**; sparisce il vocabolario dei «giri da 3 prove» |
| **A3** | ogni test è una **pescata nuova**, ma chi lascia a metà **ritrova le sue domande** |
| **A6** | chi aspetta il maestro **non** riceve il promemoria: l'avviso va alla **segreteria** ⇒ ⚠️ da fare |
| **C5** | i **due esiti** della coerenza separati (staff / non si applica niente) |
| **C7** | per scrivere Intermedio bisogna dimostrare **almeno Avanzato** ⇒ ⚠️ da misurare nel codice |
| **D1** | via il riferimento alla «terza prova» |
| **D11** | **nuova**: «test superato» non si dice su una scheda **senza cancello** |

**Sezione E: nove punti, tutti approvati, nessuno scartato.** Su tre la **forma l'ha scelta lui**:

- **E3** → leggere **tutta la storia**, non alzare il limite delle 20 schede;
- **E5** → **togliere** il numero del livello dalla risposta al bot, non rinominarlo;
- **E8** → potare **solo i campi morti**; gli **interruttori a zero** restano (attesa fra i giri,
  silenzio-assenso), perché rimetterli non dev'essere un lavoro.

Gli altri sei: **E1** portare le tre protezioni anche nel ponte che *registra*; **E2** leggere
`applied_at` invece di dedurlo dalle date; **E6** togliere `applicazione_lanciata` per adesso;
**E7** scrivere le due frasi mancanti (`AMBIGUA`, `SCHEDA_NON_TROVATA`); **E9** = A6; **E10**
fermare la scheda anonima e chiedere il nome.

**Due lavori nati dalle sue domande:**

- **D9 — la sorveglianza da 5″ a 2″.** Oggi: **30″** finché il socio non apre il quiz (fino a 4h),
  poi **5″** per 20 minuti. Portando i 5″ a 2″ si tolgono ~1,5″ dei 4 misurati; costa ~600 domande
  al ponte invece di ~240 nel caso peggiore, **una persona per volta**. Vive nel repo del bot:
  `src/telegram/promemoria.ts`, `INTERVALLO_SORVEGLIANZA_TEST_MS`. ⚠️ Vuole **deploy sulla VM** e poi
  la prova col cronometro.
- **D10 — l'obiettivo dei ~4 secondi** (vedi § 4, è la cosa aperta più interessante).

---

## 3. 🎯 IL PUNTO F — le otto prove che restano

⛔ **Su TEST non si provano**: il calendario è congelato e le scritture verso Matchpoint sono
simulate. **La prova fisica è su PROD**, e quasi tutte vogliono un gesto dal suo telefono.
🚨 **E cambiano dati veri**: ogni test che passa può riscrivere il livello di un socio. Prima di
chiedergli un gesto, dirgli **quale socio** si tocca e **cosa gli succede in scheda**.

| # | prova | serve |
|---|---|---|
| 1 | **Il gradino su una prova PASSATA** — dichiarare una fascia più bassa e **passare**: devono uscire i **tre bottoni** (C4, P7) | suo telefono |
| 2 | **Il gradino cronometrato** — un tocco vero, e `applied_at` deve arrivare in **~4 s** (D10) | suo telefono + misura mia |
| 3 | **La parola dimostrata nella domanda** — rifare il caso di Marco (dichiarato Base, calcolato Intermedio) e leggere «Il test dice **Intermedio**» (D2) | suo telefono |
| 4 | **Il messaggio del maestro senza corsa** — rifare il caso di Laura e leggere «il test da solo arriva fino a Intermedio, e te lo sto scrivendo adesso» (D3) | suo telefono |
| 5 | **Due test di fila** con lo stesso socio: **nessuna domanda ripetuta** (B9) | suo telefono |
| 6 | **Un bottone vecchio** («✅ Tengo Agonista» di ieri): deve rispondere il maestro (D6) | sua chat |
| 7 | **«Tengo» a parola uguale** → «è già il livello che hai in scheda» (D4) | suo telefono |
| 8 | **La consegna cronometrata**, dopo aver fatto i 2 secondi (D9) | dopo il deploy del bot |

✅ **FATTA stamattina, e la nona è chiusa**: *Laura nel filtro «Da certificare dal maestro»*.
📏 Misurata sulla **PROD viva** (v6.253) con la console remota, utenza di sola lettura: nel filtro
c'è **esattamente una riga**, la sua, con la spiegazione *«il test dice Avanzato (4), in scheda
Intermedio (3.5) · nessuna partita nei prossimi 30 giorni»*. ⇒ **voce 100 chiusa.**

💡 **Suggerimento di ordine**: la 7 e la 6 sono le più innocue (non riscrivono nessun livello); la
1, la 3 e la 4 cambiano un livello vero. La 2 si può appendere **a qualunque tocco** delle altre.

---

## 4. 🚨 LA COSA APERTA PIÙ INTERESSANTE — i 70 secondi del gradino

📏 Le uniche **quattro** applicazioni vere che esistono su PROD, dal tocco al livello scritto:

| quando | scelta | tocco → scritto |
|---|---|---|
| 24/08 20:03 | «mi fermo» | **4 secondi** |
| 24/08 09:18 | «mi fermo» | 11′27″ |
| 24/08 08:01 | «mi fermo» | 14′03″ |
| 27/08 22:06 | **gradino** (Fabiola) | **70 secondi** |

I due lunghi sono *prima* della cura del 24/08 e sono il cron dei 15′. Quando la strada veloce
funziona vale **4 secondi**. **I 70 di Fabiola non sono né l'uno né l'altro.**

🚨 **L'ipotesi ovvia è già stata verificata ed è FALSA**: che il gradino non lanciasse il giro
veloce. La riga `if ((scelta === SCELTA_MI_FERMO && provaSuperata) || scelta === SCELTA_SCENDO)` in
`supabase/functions/consumer-assessment-decision/index.ts` **c'è dal commit `3eb8026`** (27/08 15:29
UTC), **cinque ore prima** del suo tocco. ⇒ Non ripartire da lì.

⚠️ **E dai log non si ricostruisce**: il registro dei dispatch **non conserva nessuna riga** per quel
giro (misurato: zero righe con chiavi `%assessment%apply%`). È lo stesso difetto della E6.

**Piste non ancora battute:** il ritardo di consegna di `pg_net` fra la RPC e l'edge; il tetto
`MASSIMO_PER_GIRO = 50` in `assessment-apply-level` con più schede in coda quella sera; la lentezza
del giro stesso (carica anagrafica + storia). **La misura che decide è la prova F#2.**

📌 Query utile (Supabase MCP, progetto PROD `qqbfphyslczzkxoncgex`):

```sql
select id, member_decision, member_decision_at, applied_at,
  round(extract(epoch from (applied_at::timestamptz - member_decision_at::timestamptz))) as secondi
from self_assessments
where applied_at is not null and member_decision_at is not null
order by applied_at desc limit 12;
```

---

## 5. 🧰 Attrezzi che servono, e come si usano

**🌐 Console remota sul gestionale** — `tools/verifica-browser/`. È l'attrezzo con cui ho chiuso la
voce 100 stamattina; **si usa in autonomia, su TEST e su PROD** (autorizzazione sua del 16/08).

```bash
cd tools/verifica-browser && npm install          # NON è già installato in una sessione nuova
node console.mjs --env prod --file /percorso/snippet.js --out /percorso/report.json
```

- Le credenziali sono **già nell'ambiente** (`PMO_VERIFY_EMAIL` / `PMO_VERIFY_PASSWORD` per PROD):
  non si chiedono in chat, mai.
- Di default **non scrive** (bloccati PATCH/PUT/DELETE, gli insert e tutto `/functions/v1/`).
  `--allow-writes` resta a domanda.
- Lo snippet è un **corpo di funzione async**: si usa `return` e si può `await`.
- 💡 Snippet che ha funzionato per il filtro del maestro: `switchTab('members')` → aspetta le righe
  → `await refreshAssessmentDataForMembersList()` → `attentionFilter.value='daCertificare'` →
  `pmoOnAttentionFilterChange()` → leggi `#memberTableBody tr`.

**🤖 Repo del bot** — `PadelVillage/assistente-padel-agent` (privato). **Non è attaccato a una
sessione nuova**: si aggiunge con `add_repo` e poi si clona (una sola clonazione, timeout generoso).
Serve per il lavoro dei 2 secondi (D9).

**🗄️ Supabase MCP** — PROD `qqbfphyslczzkxoncgex`, TEST `cudiqnrrlbyqryrtaprd`.

**🖥️ La VM** non si raggiunge dalla shell del cloud (porta 22 chiusa), **ma GitHub Actions ci entra**:
`deploy-bot-hetzner.yml` nel repo del bot, bersaglio `prova` o `soci` (per i soci va scritta la
parola `SOCI`).

---

## 6. 🤝 Come lavorare con lui — quello che ha chiesto esplicitamente

1. 🚨 **Una regola alla volta.** Sue parole: *«non mi far vedere una nuova regola finché non abbiamo
   esaurito le risposte per quella precedente»*. Si riporta la riga **esatta** com'è scritta, si
   aspetta il suo «sì è corretta» o la correzione, **poi** si passa alla successiva.
2. **Non si chiede il permesso per il metodo** (delega del 23/08), ma **si dichiara** quello che si
   decide. Restano fuori: inventare voci che nella lista non ci sono, e le cose irreversibili o che
   si vedono da fuori (scritture vere su Matchpoint, messaggi ai soci) — quelle si dicono prima.
3. **Si misura invece di dedurre**, e quando la misura smentisce ciò che è scritto, **si corregge la
   riga vecchia** invece di affiancarla.
4. ⚠️ **Un banco verde non è una prova fisica.** «Fatto» è quando qualcuno ha visto la cosa
   succedere sul gestionale o sul bot.
5. 🚨 **Attenzione alle copie in cache**: ieri ho letto una versione vecchia dell'artefatto e ho
   detto che era «indietro» quando non lo era. Prima di dire che un documento è vecchio, **rileggerlo
   dalla fonte**.

---

## 7. Il primo messaggio da mandargli

> Riprendiamo dal punto F. Ne restano **otto** (la nona, Laura nel filtro del maestro, l'ho chiusa
> stamattina misurandola sulla PROD viva).
> Propongo di partire dalle due che **non riscrivono il livello di nessuno**: «**Tengo** a parola
> uguale» e il «**bottone vecchio**». Poi passiamo a quelle che cambiano un livello vero, dicendoti
> ogni volta **quale socio** si tocca e **cosa gli succede in scheda**.
> E ti ricordo che la **PR #1153** è verde e aspetta solo il tuo merge.
