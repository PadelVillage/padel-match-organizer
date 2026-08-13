# Versioni

> ⚠️ **Le voci da v5.766 a v6.216 sono state ricostruite il 13/08/2026 dalla cronologia git di `main`.**
> Il registro si era fermato al **14/06/2026** (v5.761, PR #317) e non ha mai avuto voci 6.x: per due mesi
> la storia è vissuta solo nei messaggi di commit e nelle PR. Da lì vengono titolo e descrizione di ogni
> voce ricostruita — non sono riscritti a mano, e ciascuna porta in coda la PR, lo sha e la data da cui è tratta.
>
> Due limiti da conoscere prima di usarle:
>
> - **Coprono solo le versioni arrivate in PROD** (ramo `main`). Le versioni vissute solo su `test-preview`
>   non ci sono: per questo la numerazione ha buchi (es. la 6.215 manca — è rimasta su TEST, e la 6.214
>   di PROD è la promozione di quelle righe). Non è un errore del registro, è come lavora il progetto.
> - **La descrizione è il commit, non una release note scritta per il lettore.** Dice cosa è stato fatto e
>   spesso perché, ma è tagliata al primo paragrafo utile. Per il dettaglio completo: `git show <sha>`.
>
> Le voci fino a v5.761 comprese sono le originali, scritte a mano a suo tempo.

## v6.216 — Campanello: l'aggiunta che Matchpoint non conferma ora si DICE (9ter)
- Il worker, dopo aver aggiunto un giocatore, rilegge la scheda di Matchpoint: se non lo trova se lo annota (`diagnostic.addVerifyInconclusive`) e non fa fallire niente — soft-pass voluto, per non revertire aggiunte in realta' riuscite. — PR #671 · `fb27c05` · 12/08/2026

## v6.214 — Livello: l'automatismo del livello (A4ter) — l'edge, il ponte e i satelliti
- ⚠️ L'edge nasce INERTE: nessun cron la chiama. Il primo giro si fa a mano e a vuoto (`simula: true`), si guarda l'elenco, e solo dopo si accende. — PR #670 · `e48bc43` · 11/08/2026

## v6.213 — Livello: nel gestionale il livello si dice a PAROLE, col numero accanto
- Sua richiesta: «porta nel gestionale di prod la parola sia in elenco che in scheda». Il numero NON si toglie — l'etichetta dello staff è «parole E numero, perché in coda il numero serve a decidere». Tre punti: colonna «Livello» dell'elenco, pastiglia in testa alla scheda, e la parola sotto il campo «Livello di gioco», che segue il numero mentre lo si scrive (lì la parola è SOLA: il numero è già nella casella accanto). Chi non ha livello continua a non vedere niente — il vuoto non è zero. — PR #669 · `ab48592` · 11/08/2026

## v6.212 — Lapide: la scheda del socio era FERMA, e nessuno la ricuciva col cloud
- Trovato da lui: sul bot il suo livello è «Avanzato», nella sua scheda del gestionale è 0,5, e il codice mostrato nel cloud esiste solo su una riga archiviata. Il browser però non legge la lapide — tutte le strade filtrano `!deleted`: tiene la propria copia FERMA, che coincide con la lapide perché la lapide è la fotografia di quello stesso stato. — PR #668 · `6207b5d` · 11/08/2026

## v6.211 — Soci: il browser IMPARA il codice Padel Village dal cloud
- LA RADICE del guasto misurato l'11/08: le riassegnazioni dei codici si DISFACEVANO da sole. La cura del 9/08 fu fatta solo nel cloud, e le tre strade che riscrivono un socio in locale con cio' che arriva dal cloud copiavano OTTO campi — firstName, surname, name, phone, email, level, gender, updatedAt — e `pmoPlayerId` NON era fra questi. Quindi il browser teneva il codice di MAGGIO per sempre e lo RISPINGEVA su al primo salvataggio di scheda. — PR #666 · `b19a4c3` · 10/08/2026

## v6.210 — Soci: l'avviso della potatura CONCORDA al plurale
- Dall'avviso VERO in produzione, letto da lui: «Rimossi 2 soci archiviati che ERA RIMASTO solo in questo browser: Santiago Carabajal, Roberto Ruzzini». La coda della frase stava fuori dai due rami singolare/plurale, quindi restava al singolare qualunque fosse il numero. Ora sta dentro ciascun ramo. — PR #665 · `f7f75bd` · 10/08/2026

## v6.209 — Soci: la copia del browser DIMENTICA — il socio archiviato nel cloud sparisce anche da qui
- Il fatto: archiviato nel cloud il doppione di un socio, quel socio continuava a comparire nell'elenco dell'app e ricaricare non bastava — `giocatori` vive in localStorage e niente lo ripuliva dalle righe che il cloud ha marcato `deleted`. — PR #664 · `63a674c` · 10/08/2026

## v6.206 — Codici: l'app SMETTE di coniare l'ID Padel Village — lo da' il database
- 🚨 URGENTE, ed e' il motivo per cui si promuove stanotte: il rubinetto NON e' storico. Il committente ha mandato due schede della sua app di PROD che mostrano `PMO-000587` (Samuele Collodel) e `PMO-002853` (Mauro Fresh). Nel cloud quei due numeri sono di Enrico Manfren e Enrico Galli: la sua postazione li ha CONIATI da se', e salvando una di quelle schede riscriverebbe i codici veri. — PR #662 · `bcb7a93` · 09/08/2026

## v6.204 — Autovalutazione: UNA scheda sola + il cancello per fascia + banca a 50
- 1) UNA SCHEDA SOLA — sua richiesta: «facciamo si' che la trappola delle due schede non esista piu' e ci sia una scheda sola». Nel gestionale c'erano TRE sottosezioni che rifacevano a mano la scheda del socio, e una conteneva le 8 domande RISCRITTE NELL'HTML. ! Non erano un'anteprima: erano una seconda verita' che invecchiava da sola — diceva ancora «lo staff verifichera' il livello», abolito dal disegno automatico, e mostrava il riquadro in cima gia' tolto. Chi guardava di li' vedeva la scheda di mesi fa. Al loro posto un pannello che APRE la scheda vera invece di ridisegnarla. — PR #660 · `a327dff` · 09/08/2026

## v6.200 — Autovalutazione: la scheda del socio comincia dalle domande
- La scheda del socio comincia dalle domande (v6.200) — PR #657 · `bf5a0bb` · 09/08/2026

## v6.199 — Autovalutazione: il menu del gestionale non deve comparire nella pagina del socio
- Il menu del gestionale non deve comparire nella pagina del socio — PR #655 · `c945f70` · 09/08/2026

## v6.197 — Autovalutazione: il test del livello si passa solo dicendo cose giuste — A4ter in PROD
- Il test del livello si passa solo dicendo cose giuste — A4ter in PROD — PR #654 · `f87fec1` · 09/08/2026

## v6.194 — Scheda-socio: «Bot Telegram» nella scheda del socio
- Idea sua del 31/07, in fondo al pannello: la stessa informazione dove lo staff guarda davvero — nella scheda della persona — e senza il numero di Telegram. Posto scelto da lui fra quattro: Anagrafica → Dati socio, sotto Email. — `253706e` · 08/08/2026

## v6.192 — Privacy: l'informativa si raggiunge dal menu, anche in PROD
- Nel menu del gestionale la pagina non c'era: ci si arrivava solo scrivendo l'indirizzo a mano. Ora sta in fondo alla barra a sinistra, sotto la chat, e non passa dal gating dei ruoli — è un documento, non una sezione: la deve poter aprire chiunque, come chiunque la può leggere dal bot. — `2557b23` · 08/08/2026

## v6.190 — Prenotazioni: una lezione senza maestro non parte — e nessuno se ne inventa uno
- La premessa da cui era partito il lavoro era FALSA e va detto: la scheda «Nuova prenotazione» il maestro lo chiedeva già e si rifiutava di confermare senza, e l'assistente lo chiede per primo. Su PROD 10 lezioni su 12 il maestro ce l'hanno. — PR #650 · `f8c99f2` · 07/08/2026

## v6.189 — Calendario: il MAESTRO non si butta insieme all'occupazione scartata
- Caso reale segnalato dal committente su PROD il 7/08/2026: lezione Campo 1 ore 19:30 (idReserva 9197) senza maestro sulla card, mentre su Matchpoint il monitor «Lucas Vidal» c'era — ed era già nel nostro database, su DUE record. — PR #649 · `4a721ad` · 07/08/2026

## v6.188 — Invito-segreteria: il link d'ingresso al bot, promosso in produzione
- Cosa fa: quando la segreteria mette in partita un socio che nel bot non è mai entrato, l'app se ne accorge e propone il link d'ingresso, col messaggio WhatsApp già scritto. Chi non è nel bot oggi è irraggiungibile — niente promemoria, non vede le sue partite, e se l'organizzatore lo toglie non lo sa da nessuno. — PR #648 · `1979463` · 07/08/2026

## v6.184 — Attesa: 6.184 — «Sto elaborando la richiesta», e la scheda lo dice UNA volta
- 6.183 — «Sto elaborando la richiesta», e la scheda lo dice UNA volta Scelta del committente sull'anteprima delle varianti (la «C»): mentre si aspetta, la scheda scriveva la stessa cosa due volte con parole diverse — in testa «In attesa di Matchpoint», sotto in blu «Sto chiedendo a Matchpoint…». — PR #642 · `219dd7c` · 04/08/2026

## v6.181 — Permessi: 6.181 — spariscono le caselle delle sezioni congelate
- «Sezioni visibili» elencava 20 caselle, e 7 non governavano più niente: quella dei Messaggi WhatsApp (canale dismesso il 25/07) e le 6 dell'Autovalutazione (congelata dal 13/06). Le due sezioni sono nascoste a TUTTI, owner compreso, quindi spuntarle o no non cambiava nulla: l'elenco prometteva un potere che non esisteva. — PR #641 · `115c3ff` · 04/08/2026

## v6.179 — Accesso staff: 6.179 — l'invito SCADE anche in PROD
- `staff-create-access` e' l'unica edge function che risponde a chi non e' autenticato — di proposito: serve a chi un accesso non ce l'ha ancora. Ma l'invito non scadeva MAI, quindi fra l'invito e la registrazione chiunque conoscesse l'indirizzo poteva prendersi l'accesso al gestionale scegliendo lui la password. Provato dal vivo su TEST prima di curarlo: chiamata anonima -> {"ok":true,"created":true,"confirmed":true}. — PR #640 · `92d9381` · 04/08/2026

## v6.174 — PROD 6.174 — una prenotazione, UNA riga nel cloud (+ la card giusta quando ne restano due)
- ① LA RADICE — l'edge usa la chiave dell'app. L'app genera l'id della prenotazione PRIMA di chiamare l'edge e glielo manda come `sbId`; l'edge lo buttava via e chiavava `staff_booking|<data>|<ora>|Campo <n>|<userId>`, mentre l'app scriveva la sua riga con quell'id ⇒ DUE righe per la stessa partita. Misurate su PROD: 36 doppie su 84, l'ultima la mattina del 3/08. L'accordo era già spedito: nessuno lo leggeva. Ora `sbId` è la chiave quando c'è; senza — cioè quando prenota il BOT — resta quella di prima, perché là la riga dell'edge è l'UNICA che esiste. Condividere la chiave è il pezzo pericoloso: la RPC dell'app SOSTITUISCE il payload e nel flusso asincrono l'app salva prima. — PR #636 · `6d167a6` · 03/08/2026

## v6.169 — PROD 6.169 — l'idratazione dal cloud non lascia più fuori i soci nati nell'app
- L'app aveva SOLO DUE canali per scaricare un socio dal cloud — marchio Matchpoint e marchio rubrica Google. Chi non aveva né l'uno né l'altro non era previsto da nessuna delle due idratazioni: nessuna funzione andava a prenderlo. Sono i soci creati a mano dal modulo «Nuovo socio» o dall'assistente. Su PROD sono 8 record, 6 attivi — e sono esattamente i 7 «invisibili allo sportello» del pannello diagnostica, più Ospite. — PR #635 · `a744894` · 03/08/2026

## v6.167 — PROD 6.167 — si CERCA per telefono prima di creare un cliente in Matchpoint
- Si CERCA per telefono prima di creare un cliente in Matchpoint Regola sua del 2/08: «dobbiamo far sì che non si creino doppioni … la discriminante unica è il numero di telefono». — PR #634 · `0e20d34` · 03/08/2026

## v6.161 — Diagnostica: PROD 6.161 — il bottone che RICOLLEGA le schede che non si riconoscono
- Sua domanda del 2/08: «perché di Roberto Ruzzini mi dici scheda non collegata? L'ho trovato sia in Matchpoint sia nella nostra anagrafica». Aveva ragione, e il pannello pure: la persona c'è e si trova, ma la copia locale e quella del cloud portano numeri di scheda diversi e non si riconoscono. — PR #633 · `0d5632a` · 03/08/2026

## v6.159 — Diagnostica: PROD 6.159 — il bottone che RIPARA i soci mancanti al browser
- ── Il bottone ── «Scarica in questo browser i N soci che non si trovano»: prende dal cloud i record che in quella postazione mancano e li rimette nella copia locale. 🚨 Agisce SOLO sui «non c'è proprio». Sugli altri la scheda in quel browser c'è già, e aggiungerla creerebbe un doppione VERO allo sportello — peggio del problema. ⭐ Il cloud non viene toccato: è la copia locale a essere indietro, la fonte ha ragione. ⚠️ Se il salvataggio fallisce per memoria piena lo DICE invece di annunciare successo — difetto già visto, ed è una delle cause sospettate di questo stesso problema. Il messaggio finale avverte che è una riparazione, non una cura. — PR #632 · `c06d571` · 02/08/2026

## v6.158 — Diagnostica: PROD 6.158 — il pannello soci dice CHI manca al browser
- Chiesto da lui: dalla sua postazione l'anagrafica mostra 2778 soci contro i 2788 del cloud, 8 dei quali ATTIVI — gente che allo sportello non si trova. Il pannello «Diagnostica conteggi soci» diceva già QUANTI; per sapere CHI serviva la console del browser, che non è uno strumento da dargli ogni volta. — PR #631 · `6e9e75e` · 02/08/2026

## v6.157 — Anagrafica: PROD 6.157 — l'app raccoglie l'ID interno Matchpoint, e il livello si chiama col suo nome
- ── Cosa fa ── Il worker aggancia già l'id interno Matchpoint (`idPeople`) a ogni giocatore che aggiunge a una prenotazione e lo mette nella risposta (`resolvedPlayers`); l'edge la inoltra intera. L'app non la guardava: `resolvedPlayers` non compariva NEMMENO UNA VOLTA in index.html. Per questo l'id interno ce l'hanno 9 soci su 2788, e ogni confronto con una riga di Matchpoint deve ripiegare sul NOME — con 12 gruppi di omonimi esatti (24 soci). Da qui in poi ogni socio che passa da una prenotazione se lo porta a casa da solo. — PR #629 · `3c37235` · 02/08/2026

## v6.155 — PROD 6.155 — i due ID del giocatore (promozione a righe di 6.153/6.154/
- PROD 6.155 — i due ID del giocatore (promozione a righe di 6.153/6.154/6.155) — PR #625 · `482aaea` · 02/08/2026

## v6.151 — PROD 6.151 — «prima Matchpoint, poi il calendario» + fila doppioni + menu
- PROD 6.151 — «prima Matchpoint, poi il calendario» + fila doppioni + menu — PR #623 · `69ec671` · 02/08/2026

## v6.146 — Calendario: PROD 6.146 — anche la CREAZIONE smette di indovinare, e il lavoro si INTERROGA
- PROD 6.146 — anche la CREAZIONE smette di indovinare, e il lavoro si INTERROGA — PR #620 · `35ff870` · 01/08/2026

## v6.144 — Calendario: PROD 6.144 — «non ho ricevuto risposta» non vuol dire «non è stato scritto»
- PROD 6.144 — «non ho ricevuto risposta» non vuol dire «non è stato scritto» — PR #619 · `8605e88` · 01/08/2026

## v6.142 — PROD 6.142 — il pannello «Bot Telegram» vede chi è «senza codice», e dice cosa fare
- PROD 6.142 — il pannello «Bot Telegram» vede chi è «senza codice», e dice cosa fare — PR #618 · `f86a37f` · 01/08/2026

## v6.139 — Admin: PROD v6.139 — i controlli tecnici entrano in «Utenti», via la voce «Supabase»
- PROD v6.139 — i controlli tecnici entrano in «Utenti», via la voce «Supabase» — PR #616 · `f971c0e` · 31/07/2026

## v6.137 — Bot: PROD v6.137 — la sezione «Bot Telegram» nel gestionale (passo 2)
- Lo staff vede chi è entrato dal bot dei soci, con chi l'ha invitato e il suo livello, e può togliergli l'accesso; sotto, gli inviti con com'è finito ognuno e il ritiro di quelli ancora in giro. Un interruttore solo, per sua decisione: chi entra col link è per forza un socio che il circolo conosce già, e un socio noto prenota subito — «approva a prenotare» oggi non avrebbe nessuno da approvare, e nasce col passo 1b. — PR #615 · `69d0392` · 31/07/2026

## v6.135 — Ruoli: PROD v6.135 — se il primo è un Ospite, la scheda DICE che è della segreteria
- Sua regola del 30/07 sera: «può capitare una partita con 4 ospiti… l'organizzatore è la SEGRETERIA», perché è la segreteria ad aprire quel tipo di partita. Il POTERE era già coperto (primo «Ospite» ⇒ nessun organizzatore ⇒ il ponte manda in segreteria); mancavano le PAROLE: la scheda non diceva niente. Ora lo dice in una fascia sopra l'elenco. — PR #614 · `4112371` · 30/07/2026

## v6.128 — PROD v6.128 — stellina dell'organizzatore + il nome ha la riga tutta per sé
- PROD v6.128 — stellina dell'organizzatore + il nome ha la riga tutta per sé — PR #611 · `9e5df5d` · 30/07/2026

## v6.127 — Maestri: PROD v6.127 — il maestro delle lezioni Matchpoint si legge dal tabellone
- Segnalazione: "su prod in alcune prenotazioni di lezione non vedo il nome del maestro anche se su Matchpoint e' stato inserito". — PR #610 · `c7dd252` · 29/07/2026

## v6.126 — Maestri: PROD v6.126 — Lucas Vidal selezionabile anche in produzione
- L'elenco maestri non viene da Matchpoint: e' una lista scritta a mano in parser_rules.json, da cui dipendono tutti i punti in cui si sceglie un maestro (selettore della scheda lezione, flusso "prenota lezione", riconoscimento del nome nell'assistente). Creare il maestro su Matchpoint non bastava. — PR #603 · `5a470df` · 29/07/2026

## v6.125 — Whatsapp: congelo la sezione «Messaggi WhatsApp» in PROD — canale dismesso
- Il canale WhatsApp è dismesso per decisione del committente (25/07): dei soci si occupa il bot Telegram. La sezione era l'ultimo pezzo ancora capace di FARE qualcosa — il «Rispondi» consegnava davvero un messaggio al socio via wa-shadow-proxy → whatsapp-send. — PR #590 · `7f7d214` · 25/07/2026

## v6.124 — Calendario: Maestro in modifica sulle lezioni Matchpoint
- Maestro in modifica sulle lezioni Matchpoint (PROD 6.124) — PR #586 · `9004040` · 23/07/2026

## v6.123 — Storico: il browser lascia andare le righe che il cloud ha ritirato
- Il browser lascia andare le righe che il cloud ha ritirato (v6.123) — PR #573 · `1bf38ec` · 22/07/2026

## v6.122 — Storico: «Sincronizza dati locali» non resuscita le righe ritirate dal cloud
- «Sincronizza dati locali» non resuscita le righe ritirate dal cloud (v6.122) — PR #572 · `8b52318` · 21/07/2026

## v6.121 — Storico: la checklist post-import non cita più un'etichetta che non esiste
- Dopo la riconciliazione (#569) il riepilogo non mostra più «Diverse protette» — ora ci sono «Aggiornate», «Ritirate» e «Diverse fuori periodo» — ma il punto 4 della checklist continuava a mandare l'operatore a cercare quell'etichetta, e a dirgli di controllare a mano record che adesso si aggiornano da soli. — PR #571 · `0a3f2c2` · 21/07/2026

## v6.120 — Storico: dentro il periodo importato Matchpoint fa fede
- PROBLEMA — segnalato dal committente («lo storico non coincide») e verificato sui dati di PROD. L'import storico era CUMULATIVO: aggiungeva le righe nuove e non toccava mai quelle gia presenti. Due conseguenze: — PR #569 · `cd38921` · 21/07/2026

## v6.119 — Whatsapp: 💶 la card Consumi arriva anche in PROD — volumi giornalieri e costo stimato
- Non era scaffolding di TEST: non è gated PMO_IS_TEST_ENV, e il commento sopra dice l'opposto — è pensata per stare in ogni ambiente (SOLO aggregati, nessun testo né numero di telefono). — PR #567 · `92301df` · 21/07/2026

## v6.117 — Routine: l'orario della rubrica Google segue l'ora legale invece di mentire sei mesi l'anno
- La tabella «Stato routine automatiche» dichiarava per «Contatti Google» un fisso 04:15, ma quel cron è l'unico con un job tutto suo (jobid 11 `pmo-google-contacts-import-prod`, `15 3 * * *`) e un dispatcher senza gate sull'orario: parte alle 03:15 UTC secche, cioè alle 05:15 italiane con l'ora legale e alle 04:15 solo con quella solare. — PR #563 · `80236ee` · 21/07/2026

## v6.114 — Test: /test/ diventa un rimando al nuovo indirizzo e PROD si libera dei residui
- Chiude lo spostamento di TEST su test.padelvillage.club (#558 v6.112, #559 v6.113), che è LIVE e verificato: ambiente test, Supabase cudi…, Matchpoint simulato, certificato HTTPS approvato. — PR #560 · `0e20106` · 20/07/2026

## v6.112 — Test: TEST riconosciuto anche dal suo indirizzo, non solo dal percorso /test/
- Preparazione allo spostamento di TEST su un sottodominio suo (test.padelvillage.club), dove il percorso è "/" e non più "/test/". — PR #558 · `6f677f1` · 20/07/2026

## v6.110 — Prenotazioni: a memoria piena la prenotazione non si perde più — si fa spazio e si ritenta, e il cloud riceve comunque
- A memoria piena la prenotazione non si perde più — si fa spazio e si ritenta, e il cloud riceve comunque (v6.110) — PR #556 · `854072a` · 20/07/2026

## v6.109 — Prenotazioni: il salvataggio locale che fallisce non è più muto — niente «✅ Salvata» quando la copia in pagina non c'è
- Caso del 20/07: due prenotazioni create dal calendario di PROD sono comparse prima su Matchpoint e solo ~2 minuti dopo nel gestionale, riportate indietro dal sync. La causa è il salvataggio in localStorage fallito: l'errore veniva inghiottito in tre punti diversi, ognuno col suo modo di mentire. — PR #555 · `c290dc5` · 20/07/2026

## v6.107 — Whatsapp: sgancio gate PMO_WHATSAPP_TEST_ONLY — sezione «Messaggi WhatsApp» visibile in PROD
- Promozione a righe di 1216ee6 (test-preview): il «Rispondi» consegna davvero (wa-shadow-proxy PROD v12 → whatsapp-send, PR #534), quindi la condizione «quando la feature sarà pronta» del gate è soddisfatta. La visibilità passa ai normali permessi sezione (view_contact): admin/owner subito, altri staff da profilo. Bump APP_VERSION 6.105 → 6.107 (la 6.106 è il riallineo TEST). — PR #535 · `3d4e2f3` · 18/07/2026

## v6.105 — Whatsapp: pannello staff PROD — lista+triage via wa-shadow-proxy, polling 60s
- Banco differenziale sul worktree: pristino 54/59 KO {49,50,51,53,54} leak 1 → patch 54/59 KO identici leak 0. — PR #533 · `1815af0` · 17/07/2026

## v6.102 — Pagamenti: 🎁 sulla chip del calendario per la quota offerta
- Glifo chip via _payChipGlyph: 🎁 title «Offerta» quando l'unico metodo è omaggio; ✓ verde standard negli altri casi, incluso il misto omaggio+incasso vero (il 🎁 nasconderebbe il pagamento reale). Hook chipGlyph per il banco. — PR #527 · `ddd2216` · 17/07/2026

## v6.101 — Pagamenti: payload payment id_reserva → id_cliente_mp nell'edge payments-sync
- Il campo conteneva da sempre l'identificativo CLIENTE Matchpoint (header fuorviante del report 11.13), mai il numero di prenotazione. Nessun lettore funzionale: local_key pay|… invariata (idempotenza), join per chiave naturale intatto. Record storici migrati via SQL (TEST fatto; PROD dopo il merge). — PR #526 · `75a0b3c` · 17/07/2026

## v6.100 — Incassi: colonne Campo e Ora in tabella — una riga per giocatore E partita
- La riga non aggrega più tutti i pagamenti del giocatore nel giorno: la chiave include campo+ora+giorno prenotazione, così «Ospite» con più partite si spezza per partita e ogni riga dice a quale slot appartiene. Ordine per ora → campo; partita di un giorno diverso dal pagamento = data piccola accanto all'ora; record vecchi senza campo/ora = «—» in coda. — PR #525 · `ac470a5` · 17/07/2026

## v6.099 — Pagamenti: quota OFFERTA visibile ovunque — 🎁 in scheda, zero in Incassi, chip ✓; icone stato ✓/✗/🎁
- Su Matchpoint una quota «riscossa» a importo 0 = OFFERTA dal club (convenzione segreteria). Un omaggio non è un pagamento: non compare MAI nel report 11.13 (provato: 0 record a 0 € su 1624 in PROD; l'edge non scarta le righe a 0,00) → la scheda restava su «modalità in arrivo…» per sempre (caso David Cesca 16/07). — PR #524 · `4cb930d` · 17/07/2026

## v6.096 — Pagamenti: la scheda mostra con che cosa ha pagato ogni giocatore + il ✓ pagato si accende davvero
- Cosa cambia: - Sotto la riga di ogni giocatore già pagato compare una pastiglia con icona ed etichetta (Contanti / Carta / Borsellino); il metodo finisce anche nel tooltip del ✓ sulle chip. Se il pagamento risulta ma il metodo non è ancora sincronizzato: «modalità in arrivo…». - ⭐ RADICE riparata: nei record `payment` il campo payload.id_reserva è l'identificativo del CLIENTE, non della prenotazione (verificato in PROD sul report 11.13) → il join per idReserva non agganciava MAI e il ✓ verde «pagato» spariva al reload. L'aggancio ora usa la chiave naturale giorno|campo|ora (_payNatKey) + nome normalizzato; _staffCalPaidIndex passa a natKey → nome → {methods, cents}. — PR #523 · `68d85b8` · 16/07/2026

## v6.095 — Sync+anagrafica: idReserva dal numero dell'export (sblocca la modifica) + conteggio soci senza salto
- ── P1 «🔒 Questa prenotazione non è ancora sincronizzata (manca l'idReserva)» Bloccava la modifica finché non si lanciava «Aggiorna prenotazioni» a mano. Caso reale: Campo 1 ore 21:00 del 16/07, bloccata 16:32→16:44, poi guarita da sola. — PR #522 · `60c22cf` · 16/07/2026

## v6.093 — Assistente: «Chiudi» della scheda modifica non chiudeva — smonta il box come il Salva
- Nella scheda «Modifica prenotazione» (sidebar assistente) il pulsante «Chiudi» accanto a «Salva» non chiudeva: la scheda restava a schermo, coi pulsanti ancora cliccabili (si poteva premere «Salva» su una scheda creduta chiusa). — PR #521 · `da38a52` · 16/07/2026

## v6.092 — PROD: socio non-in-MP — editor manuale blocca nomi sconosciuti + lazy-create in edit
- PROD: socio non-in-MP — editor manuale blocca nomi sconosciuti + lazy-create in edit (v6.092) — PR #520 · `3c66308` · 15/07/2026

## v6.090 — Anagrafica: ferma churn contatti Google + collassa telefoni doppio-39
- Ferma churn contatti Google + collassa telefoni doppio-39 (v6.090) — PR #519 · `4c5490b` · 14/07/2026

## v6.089 — Google-contacts: esito import notturno visibile in app
- La routine notturna «Import contatti Google» scriveva l'esito solo via email e console.log: il cron risultava sempre "riuscito" (dispatch fire-and-forget) anche quando la lettura da Google falliva in silenzio (es. token scaduto). — PR #518 · `75dc4c8` · 13/07/2026

## v6.088 — Admin: rinomina titoli sezione — «Dati» e «Aggiornamenti dati e backup»
- Solo copy UI (nessuna logica): - Voce menu Amministrazione (desktop + dropdown), intestazione h3, label permessi e SECTION_LABELS: «Dati Matchpoint» → «Dati». - Card accordion passo 2: «Aggiornamenti Matchpoint e backup» → «Aggiornamenti dati e backup». - Chiave di navigazione goToTabSection('...','Dati Matchpoint') INVARIATA (matcha #pmoAdminMatchpointDataPanel via SIDEBAR_ANCHOR_MAP + runSidebarSectionAction). - Messaggi in prosa (avvisi/nota dashboard) lasciati con «Matchpoint» per contesto. — PR #516 · `62eb3ac` · 10/07/2026

## v6.087 — Anagrafica: NON persistere i contatti rubrica Google in localStorage
- Seguito di #514. Su browser con localStorage pieno (PROD+TEST condividono l'origine, ~5MB saturi) persistere ~1700 google (giocatori a ~2759 ≈ 1.6MB) supera la quota e fa lanciare QUALSIASI save('giocatori'). I google sono cloud-backed e ri-idratati ogni sessione, quindi non servono in localStorage. Choke-point unico in pmoEncodeForStorage: filtra via importedFrom='rubrica-google' quando serializza 'giocatori'. localStorage resta solo-Matchpoint (leggero); i google vivono in memoria. Idratazione resa difensiva (re-render anche se save fallisce). — PR #515 · `9f6ad9e` · 10/07/2026

## v6.086 — Anagrafica: idrata i contatti rubrica Google dal cloud su ogni dispositivo
- I contatti importedFrom='rubrica-google' vivono nel cloud ma pmoLoadMatchpointMembersFromCloud (MP-only) non li carica: comparivano solo nel browser che aveva fatto l'import. Aggiunge pmoLoadRubricaGoogleMembersFromCloud + pmoEnsureRubricaGoogleHydrated (dedup nome+telefono via pmoImportContactKey, throttle 10min, staff-gated), agganciata all'apertura di Anagrafica soci. Sola lettura cloud + scrittura localStorage; nessuna scrittura su cloud/Matchpoint. — PR #514 · `8ab6e21` · 10/07/2026

## v6.085 — Anagrafica: promozione PROD import contatti Google "padel" (People API)
- - Nuova edge function google-contacts-import (3 percorsi: preview/apply JWT staff + apply cron con x-pmo-routine-secret e email di riepilogo). - Migration pmo_dispatch_google_contacts_import (dispatcher innocuo; lo schedule cron si crea SOLO in PROD, a mano nel SQL editor). - Client (index.html a righe): pulsante «Importa da Google Contacts (live)» in card Dati Matchpoint + riga «Contatti Google» in Stato routine. Bump APP_VERSION 6.085. Nessun gating PMO_IS_TEST_ENV. — PR #513 · `6167cf9` · 10/07/2026

## v6.084 — Soci: email FACOLTATIVA in creazione — email tecnica quando manca
- Il form "+ Nuovo socio" (e lo sheet calendario) bloccava senza email perché il worker Matchpoint la richiede. Ora l'email è facoltativa: se manca, si sintetizza un'email tecnica <cifre>@nomail.padelvillage.club (sottodominio non instradabile), la stessa scelta già usata dall'import rubrica, così il worker passa senza modifiche e KPI/Autovalutazione/scheda la trattano come assente (pmoIsSyntheticEmail). — PR #512 · `eae5eb4` · 10/07/2026

## v6.083 — Promote: import rubrica Google + Matchpoint LAZY + Correggi nome↔cognome
- Import contatti rubrica Google (app+cloud) + creazione Matchpoint LAZY alla prenotazione (v6.083) Import "rubrica Google" in Dati Matchpoint (box 2·b): CSV/XLSX → anteprima con dedup per telefono (chiave cloud), sesso dedotto dal nome (correggibile, NA evidenziato), livello 0.5, email tecnica <cifre>@nomail.padelvillage.club se manca quella vera. Scrive SOLO app+cloud a blocchi (no creazione MP di massa). — PR #511 · `4cebfc8` · 10/07/2026

## v6.082 — Mobile: unifica la frontiera breakpoint a 899/900 — il ☰ apre la nav su tablet portrait
- Dead-zone 801–899px: la shell mobile del calendario (#staffCalV36) attiva a ≤899 ma drawer/sidebar+offset-desktop usavano 800/801. Nella fascia 801–899 (iPad/tablet portrait) il ☰ mostrava ma non apriva il menu → si restava intrappolati sul calendario. — PR #510 · `0576a1b` · 09/07/2026

## v6.081 — Assistente: anagrafica — FIND «cerca/dammi i dati» + nome pulito + card modifica chiudibile a voce
- Anagrafica — «cerca/trova/dammi i dati» leggono la scheda + nome pulito da «:»/virgole (v6.080) Due finding minori dell'usability testing 09/07 (assistente via chat, validati su /test/ v6.080): — PR #509 · `6e54b07` · 09/07/2026

## v6.079 — Assistente: «elimina X» non colpisce il socio sbagliato
- Trovato in usability testing e validato su /test/ v6.079: «elimina definitivamente il socio <Nome Cognome>» proponeva di disattivare una persona DIVERSA (fuzzy-match errato, auto-eseguito perché unico candidato). — PR #508 · `07fee9d` · 09/07/2026

## v6.078 — Assistente: roster completo nella lista + pulsanti Sì/No sulla conferma sposta
- Lista «che partite» usa il roster completo, non solo l'intestatario (v6.077) _answerBookings costruiva i nomi da r.nome (per le partite MP = titolo, spesso il solo intestatario). La card calendario (_staffCalBuildHorizontal) usa invece l'array giocatori con fallback a nome. Allineo l'assistente allo stesso pattern: prima r.giocatori (array di stringhe o {nome}), fallback a r.nome. — PR #507 · `7c7ebc5` · 09/07/2026

## v6.076 — Sposta: timeout worker ≠ fallimento — niente più «Spostamento non riuscito» falso
- StaffCalDoMove (spostamento drag&drop dal calendario) mostrava "❌ Spostamento non riuscito" su QUALSIASI risposta non-ok, incluso il timeout dell'edge (worker in coda) — quando lo spostamento su Matchpoint può essere passato lo stesso. Allinea il percorso move a edit/cancel: AbortController 200s + ramo AbortError; ramo _staffCalIsTimeoutClass → "⌛ esito non confermato" invece del falso "non riuscito"; errori reali via _staffCalFriendlyOpError. — PR #506 · `52a7d13` · 07/07/2026

## v6.075 — Login: sopravvive a localStorage pieno — sfratta cache ricostruibili e ritenta
- PmoSetItemResilient() — su quota piena sfratta le cache RICOSTRUIBILI (di entrambi gli ambienti, più grandi prima) e ritenta; usato per token sessione + profilo staff. Le cache si ri-idratano dal cloud. Nessun cambio quando c'è spazio; nessun codice gated PMO_IS_TEST_ENV. Sintassi 5/5 blocchi inline OK. — PR #505 · `b93912d` · 05/07/2026

## v6.074 — Assistente: conferma dell'annullo con «Sì annulla»/«annulla» non deve dire 'non ho annullato nulla'
- La guardia conferma generica trattava 'annulla' come parola di USCITA anche per il flusso 'cancella', dove 'annulla' È il verbo dell'azione (= conferma). Con la 'sì' accentata non salvata da _yesRe (il \b dopo 'ì' non è confine di parola), «Sì annulla» risolveva a canon 'no' → 'non ho annullato nulla'. _exitRe ora è kind-aware: per 'cancella' esclude annull\w* (allineato al gestore dedicato _confirmCancellaAnswer). — PR #503 · `05d9aa0` · 03/07/2026

## v6.073 — Calendario: timeout edge dell'annullo/modifica NON ripristina alla cieca — cura dei 'fantasmi'
- `_staffCalIsTimeoutClass` (idle timeout/deadline/504/524/408, NON il 502 generico) nei rami errore di annullo e modifica: su timeout NON si reverta (esito INCERTO) → "⌛ esito non confermato, ricarica e controlla", la sync riconcilia. I rifiuti VERI (SLOT_OCCUPATO ecc.) ripristinano come prima. — PR #502 · `d64414f` · 03/07/2026

## v6.071 — Assistente: ospiti add/remove a scheda aperta — chiede la prenotazione giusta, non socio/quale
- Nessuno scaffolding test (l'ambiente chiuso /test/ resta solo su test-preview). — PR #501 · `743b60f` · 03/07/2026

## v6.068 — Calendario: niente buco a mezzanotte — retieni l'occupazione live del giorno appena finito
- A mezzanotte l'edge di sync tombstona l'occupazione live delle date passate (finestra da oggi in poi): il calendario per ieri restava scoperto finché l'archivio (storicoPrenotazioni) non subentrava → 'le prenotazioni di ieri sparivano per qualche minuto' al cambio data (confermato nel DB PROD: le 49 occupancy del 02/07 tombstonate alle 00:04 di Roma). — PR #500 · `88d5fe2` · 03/07/2026

## v6.067 — Scheda: redesign 'Giocatori e pagamenti' + retry config.js
- Redesign 'Giocatori e pagamenti' + retry config.js — PROD v6.067 — PR #499 · `ef84d9c` · 03/07/2026

## v6.066 — Assistente: 'aggiungi N ospiti' non legge il numero come Campo N
- La cifra di «aggiungi 3 ospiti» veniva presa dall'euristica telegrafica di _campoX come «campo 3»: con la scheda aperta su un altro campo il comando cadeva nella disambiguazione «Quale prenotazione?» coi campi sbagliati invece di aggiungere gli ospiti alla scheda aperta. — PR #498 · `b6d279e` · 03/07/2026

## v6.065 — Scheda: cambia MAESTRO della lezione
- Cambia MAESTRO della lezione — PROD v6.065 — PR #497 · `80138d6` · 02/07/2026

## v6.064 — Calendario: avviso "sessione scaduta, rientra" invece di dati vecchi in silenzio
- Chiude il "punto 3" (sessione scaduta = disallineamento silenzioso) emerso nel fix allineamento app↔Matchpoint. — PR #495 · `1d7d019` · 01/07/2026

## v6.063 — Calendario: allineamento app↔Matchpoint — reset cache + archivio solo passato
- 1) Reset una-tantum cache prenotazioni (flag pmoBookingCacheResetV1): alla prima apertura post-update purga prenotazioni/prenotazioniOccupazione/staffBookings/ staffCalCancelled e le riscarica dal cloud. Rimuove residui locali stantii (card a slot sbagliato sopravvissute in localStorage). Una volta per device. — PR #494 · `e93a6b0` · 01/07/2026

## v6.056 — Assistente: sposta senza orario = stesso orario (risolve sorgente per campo)
- Sposta senza orario = stesso orario (risolve sorgente per campo) — v6.056 — PR #493 · `2900cb9` · 01/07/2026

## v6.055 — Assistente: legge la scheda aperta prima di rispondere + verifica coordinate
- Legge la scheda aperta prima di rispondere + verifica coordinate — v6.055 — PR #492 · `460f91a` · 01/07/2026

## v6.054 — Incassi: auto-refresh al rientro nella scheda (regressione #5 audit)
- PR #483 · `e76dd1c` · 01/07/2026

## v6.053 — App: normalizza Ospite dal worker (fix #3/#8 audit)
- App: normalizza Ospite dal worker (fix #3/#8 audit) — v6.053 — PR #481 · `440b60f` · 01/07/2026

## v6.052 — Sicurezza: token Shadow fuori dal client → edge proxy wa-shadow-proxy
- Sicurezza: token Shadow fuori dal client → edge proxy wa-shadow-proxy — v6.052 — PR #479 · `6bd0376` · 01/07/2026

## v6.051 — Incassi: frecce ◀ ▶ navigazione giorno + rimuovi ↻ Aggiorna
- Incassi: frecce ◀ ▶ navigazione giorno + rimuovi ↻ Aggiorna — v6.051 — PR #478 · `6c355db` · 01/07/2026

## v6.050 — PWA: nome app home screen "ADMIN" maiuscolo
- Manifest name/short_name e apple-mobile-web-app-title da "admin" a "ADMIN". — PR #473 · `f02cce3` · 30/06/2026

## v6.049 — PWA: nome app home screen "admin" al posto di "Padel Village"
- Manifest.json name/short_name e apple-mobile-web-app-title → "admin". Cambia l'etichetta sotto l'icona quando si salva la web app PROD sul desktop del telefono (Android usa manifest, iPhone usa il meta apple). — PR #472 · `6c4ea28` · 30/06/2026

## v6.046 — Menu mobile: rimossa la numerazione delle voci (badge nav-order) — v6.046 (PROD)
- Promozione PROD a righe: i badge .nav-order erano indici fissi, partivano da 0 e disallineati (Incassi e Messaggi WhatsApp entrambi "3"). Rimossi span + CSS correlato. Solo index.html. — PR #471 · `590e189` · 30/06/2026

## v6.045 — Scheda socio: layout a TAB (opzione A) + accorpamento 7→4 sezioni + permessi per-staff
- Solo index.html. — PR #470 · `7e4e02f` · 30/06/2026

## v6.044 — Mobile: ☰ Menu a destra nella testata calendario + blocco orientamento verticale
- Solo index.html, niente fisarmonica/permessi (restano su test-preview). — PR #469 · `155d19f` · 30/06/2026

## v6.039 — Borsellino: RICARICA saldo in PROD (blocco ＋Ricarica scheda socio)
- RICARICA saldo in PROD (blocco ＋Ricarica scheda socio) — v6.039 — PR #468 · `43b64a9` · 30/06/2026

## v6.038 — Pagamenti: PROMOZIONE PROD — storno borsellino (Correzione del saldo) live; cobro/storno partita inerti (flag OFF)
- Promuove la Fase 2b a PROD limitata allo STORNO BORSELLINO (validato dal vivo 30/06): - PMO_WALLET_WRITE_ENABLED=true → bottone 'Storna saldo' su ogni scheda socio con saldo>0; worker /correct-wallet (già su main/Hetzner) risolve id-da-codice + Correzione del saldo. - PMO_PAYMENTS_WRITE_ENABLED=false → incasso e storno PARTITA presenti ma INERTI (non validati). - Include chip ✓ 'pagato' su calendario (read-only) + fix UX (scheda non copre la chat, auto-clear chat). Backstop: kill-switch worker + edge auth cloud_sync. Solo index.html (diff = solo Fase 2b). Edge matchpoint-wallet-correct da deployare su PROD a parte. — PR #466 · `169ef46` · 30/06/2026

## v6.029 — Incassi: % incidenza + header una riga + sticky (PROD)
- % incidenza + header una riga + sticky (PROD) — v6.029 — PR #458 · `e88277c` · 29/06/2026

## v6.026 — Incassi: etichetta cadenza ~5 min (PROD)
- Etichetta cadenza ~5 min (PROD) — v6.026 — PR #457 · `d4b588a` · 29/06/2026

## v6.025 — Incassi: PROD — ultima sincronizzazione + tabella per giocatore
- PROD — ultima sincronizzazione + tabella per giocatore (v6.025) — PR #455 · `46a089d` · 29/06/2026

## v6.024 — Incassi: PROD — sezione Incassi + blocco Pagamenti + edge payments-sync
- PROD — sezione Incassi + blocco Pagamenti + edge payments-sync (v6.024) — PR #454 · `f3266af` · 29/06/2026

## v6.002 — Scheda prenotazione: carica il webfont Tabler — icone (x/+/check…) visibili
- Carica il webfont Tabler — icone (x/+/check…) visibili — v6.002 — PR #452 · `f82fd9f` · 29/06/2026

## v6.001 — Ux: "aggiorno…" non lampeggia più ad ogni poll automatico del calendario
- Ux: "aggiorno…" non lampeggia più ad ogni poll automatico del calendario — v6.001 — PR #450 · `edd4a5b` · 29/06/2026

## v6.000 — Ux: bottone "Aggiungi" giocatore differenziato dai chip (scheda prenotazione)
- Ux: bottone "Aggiungi" giocatore differenziato dai chip (scheda prenotazione) — v6.000 — PR #449 · `86cb0e8` · 29/06/2026

## v5.999 — Promote(scheda prenotazione): restyling a sezioni + fix lampo/note/roster
- Promote(scheda prenotazione): restyling a sezioni + fix lampo/note/roster — v5.999 — PR #447 · `4888002` · 29/06/2026

## v5.998 — Borsellino fix: scheda socio senza id interno MP → avviso
- Borsellino fix: scheda socio senza id interno MP → avviso (v5.998) — PR #446 · `03cf47d` · 28/06/2026

## v5.997 — Borsellino saldi Monedero in PROD (v5.997) — colonna + filtro + ordinamento + sync
- Borsellino saldi Monedero in PROD (v5.997) — colonna + filtro + ordinamento + sync — PR #445 · `d09ee77` · 28/06/2026

## v5.996 — Assistente: verbo "metti/aggiungi" non letto come giocatore nel one-shot
- Verbo "metti/aggiungi" non letto come giocatore nel one-shot — v5.996 — PR #440 · `2a52359` · 27/06/2026

## v5.995 — Promo PROD: omonimi rimozione (ID+telefono) + range orari EN "from…to…"
- Promo PROD: omonimi rimozione (ID+telefono) + range orari EN "from…to…" — v5.995 — PR #439 · `1f50057` · 26/06/2026

## v5.994 — Promo PROD: rimosso il campo fantasma "moroso/stato" dal parser
- Promo PROD: rimosso il campo fantasma "moroso/stato" dal parser — v5.994 — PR #438 · `5ab9290` · 26/06/2026

## v5.993 — Promo PROD: "mi levi N ospiti …" + comandi composti "togli … E aggiungi …"
- Promo PROD: "mi levi N ospiti …" + comandi composti "togli … E aggiungi …" — v5.993 — PR #437 · `b06dd91` · 26/06/2026

## v5.991 — Promote(PROD): assistente — ospiti multipli, inglese, conferme typo-tolerant
- Promote(PROD): assistente — ospiti multipli, inglese, conferme typo-tolerant — v5.991 — PR #436 · `8387b44` · 26/06/2026

## v5.985 — Promote(PROD): fix assistente giocatori + nota in linea
- Promote(PROD): fix assistente giocatori + nota in linea — v5.985 — PR #435 · `2a25787` · 26/06/2026

## v5.981 — Promote(PROD): assistente conversazionale completo
- Promote(PROD): assistente conversazionale completo — v5.981 — PR #434 · `0ba7ce1` · 26/06/2026

## v5.961 — Assistente: chat legata al Calendario, scheda Assistente AI separata
- La CHAT dell'assistente ora è gated da view_dashboard (Calendario), non più da view_assistante_ai. Lo staff operativo usa la chat senza vedere la SCHEDA "Assistente AI" (Vocabolario), che resta gated da view_assistante_ai. — PR #433 · `0ae21d4` · 25/06/2026

## v5.960 — Assistente-mobile: re-init chat al load del profilo staff (4G lento) → microfono + Invia funzionano
- Su rete lenta il profilo staff arriva dopo i tentativi di initChatUI al boot: l'assistente non veniva inizializzato → barra mobile senza microfono, svcChatInput disabilitato, "Invia" muto. Fix: pmoStoreStaffProfile re-inizializza la chat (idempotente) + difesa anti-timing in openAssistant e nel tasto Invia mobile. — PR #432 · `555047f` · 25/06/2026

## v5.959 — Assistente-mobile: tastiera iOS si apre al tap sulla barra — focus sincrono (no setTimeout)
- Su iPhone toccare la barra launcher apriva il pannello ma non la tastiera: il focus su svcChatInput era in setTimeout(40) → iOS perde la user-activation e non mostra la tastiera. Ora focus sincrono dentro il gesto del tap. — PR #431 · `6ab51d9` · 25/06/2026

## v5.958 — Utenti-staff: permessi operativi dalle sezioni visibili
- Permessi operativi dalle sezioni visibili — v5.958 — PR #430 · `2efe11b` · 25/06/2026

## v5.956 — Promozione PROD: validatore parse-gate Vocabolario + fix accenti sinonimi
- Promozione PROD: validatore parse-gate Vocabolario + fix accenti sinonimi (v5.956) — PR #429 · `eeb62ce` · 25/06/2026

## v5.954 — Assistente: Vocabolario manuale — bottone "Analizza ora" (Gemini a comando)
- Vocabolario manuale — bottone "Analizza ora" (Gemini a comando) v5.954 — PR #428 · `64b508d` · 25/06/2026

## v5.952 — PROD: revisione Utenti Staff + registrazione 1-passo + eliminazione completa
- PROD: revisione Utenti Staff + registrazione 1-passo + eliminazione completa (v5.952) — PR #427 · `9c0e181` · 25/06/2026

## v5.951 — App: durata default Lezione 60' / Partita 90'
- Durata default Lezione 60' / Partita 90' — v5.951 — PR #426 · `4c07eea` · 25/06/2026

## v5.943 — Ui(app/admin): pannello routine allineato (prenotazioni live 2min, backup 06:00)
- Ui(app/admin): pannello routine allineato (prenotazioni live 2min, backup 06:00) v5.943 — PR #424 · `f27dcba` · 25/06/2026

## v5.942 — App: manutenzione — sblocco nota + scheda a due campi (Descrizione + Osservazioni)
- App: manutenzione — sblocco nota + scheda a due campi (Descrizione + Osservazioni) v5.942 — PR #421 · `41487c2` · 24/06/2026

## v5.937 — Promozione PROD: Vocabolario assistente v5.928→v5.937 (Fase 3 completa + Gemini)
- Promozione PROD: Vocabolario assistente v5.928→v5.937 (Fase 3 completa + Gemini) — PR #419 · `4cc844b` · 24/06/2026

## v5.927 — App/staff-cal: estendi orario Calendario campi staff fino a 00:00 (mezzanotte)
- Promozione a PROD delle sole righe staff-cal da test-preview (d8b0f7f). STAFF_CAL_END_H 22→24; slot di partenza fino a 23:30; viste orizzontale e mappa estese a 1440min con etichetta mezzanotte '00'. Solo index.html. — PR #418 · `8998dfb` · 24/06/2026

## v5.926 — App: creazione socio — email obbligatoria, chat (mobile), asterischi, livello 0,5
- Creazione socio — email obbligatoria, chat (mobile), asterischi, livello 0,5 (v5.926) — PR #417 · `846731e` · 24/06/2026

## v5.922 — App/mobile: pannello Soci sopra la tastiera
- Pannello Soci sopra la tastiera (v5.922) — PR #416 · `b52c2bf` · 24/06/2026

## v5.921 — App: chat scheda socio si apre anche su PROD
- Chat scheda socio si apre anche su PROD (v5.921) — PR #415 · `f228ff0` · 24/06/2026

## v5.920 — App/mobile: chat scheda visibile su mobile + soci-sheet sincronizza
- Chat scheda visibile su mobile + soci-sheet sincronizza (v5.920) — PR #414 · `65e4f0a` · 24/06/2026

## v5.917 — App: modifiche scheda socio nella chat di sinistra
- Modifiche scheda socio nella chat di sinistra (v5.917) — PR #412 · `76a9cba` · 24/06/2026

## v5.916 — Worker+app: cambio livello anagrafica si replica su Matchpoint
- Cambio livello anagrafica si replica su Matchpoint (v5.916) — PR #399 · `c304a1f` · 23/06/2026

## v5.915 — Promote(app): scheda socio + pannello Soci con campi grandi su mobile (Opzione 1,
- Promote(app): scheda socio + pannello Soci con campi grandi su mobile (Opzione 1, v5.915) — PR #398 · `bf72730` · 23/06/2026

## v5.914 — Doppione stesso giocatore nella prenotazione (worker idempotente + dedup app)
- Doppione stesso giocatore nella prenotazione (worker idempotente + dedup app) v5.914 — PR #397 · `89fd2e0` · 23/06/2026

## v5.913 — Promote(app): annullo ottimistico cross-device, niente flicker
- Promote(app): annullo ottimistico cross-device, niente flicker (PROD v5.913) — PR #396 · `c80dd3c` · 23/06/2026

## v5.912 — Prenota: mostra l'ID utente sul chip giocatore (mobile+desktop,
- Promozione a PROD delle sole righe del fix da test-preview (commit 27bb019). Il chip del form "Nuova prenotazione" mostra nome + badge ID, rispecchiando il menù di autocompletamento (ID interno Matchpoint, altrimenti codice cliente). Helper condiviso _staffCalPlayerIdLabel, riusato nei chip "Da aggiungere". — PR #395 · `e90f101` · 23/06/2026

## v5.911 — Promote(app): mobile aspetta conferma MP + nota di sync più visibile
- Promote(app): mobile aspetta conferma MP + nota di sync più visibile (PROD v5.911) — PR #394 · `9b0f77e` · 23/06/2026

## v5.909 — Chat: auto-pulizia chat SOLO dopo la conferma reale di Matchpoint
- Prima la chat si svuotava 4s dopo l'OK ottimistico (operazione registrata nell'app), mentre Matchpoint scriveva ancora in background: un errore/timeout tardivo finiva in chat vuota. Ora la pulizia parte quando la nota di sync diventa verde "✅ …su Matchpoint" (#067647) per crea/modifica/annulla; su errore o timeout (rosso/arancio) la chat NON si pulisce e l'esito resta visibile. Le operazioni senza scrittura Matchpoint (spostamento confermato dal worker, rimozione card fantasma locale) programmano la pulizia direttamente. — PR #390 · `d180a5e` · 23/06/2026

## v5.908 — Chat: auto-pulizia chat assistente a fine operazione
- Auto-pulizia chat assistente dopo un esito positivo (v5.907) Quando un'operazione si conclude con successo (messaggio 'ok': prenotazione creata/aggiornata, spostata, annullata, card rimossa) la chat dell'assistente si svuota da sola dopo ~2,5s, lasciando spazio pulito alla prossima operazione. Stesso container #svcChatMessages su desktop e mobile → un'unica logica copre entrambi. Centralizzato in svcAddMessage: 'ok' programma svcClearLog, qualsiasi altro messaggio (errore tardivo dal worker, nuova scelta, input staff) annulla la pulizia così l'utente fa sempre in tempo a leggerlo. Guardia anti-conflitto se nel frattempo riparte un flow (scheda/scelta aperta). — PR #389 · `153bb69` · 23/06/2026

## v5.906 — Chat: messaggi d'errore worker chiari per l'operatore + diagnostica manuale uniforme
- Indagine sui fallimenti reali (DB PROD): il worker è corretto e la comprensione del testo pure; i fallimenti sono di ESECUZIONE (fantasma già mitigato, rete "Failed to fetch", caso noto "Lidia" player-verify). Restava il fatto che l'app mostrava all'operatore l'errore GREZZO del worker ("recurso 13", "steps=[...]url="). — PR #387 · `56348c6` · 23/06/2026

## v5.905 — Chat-ui: chat WhatsApp (msg in fondo) + scheda non più bloccata dopo il blocco
- Chat assistente stile WhatsApp omogeneo — messaggio nuovo SEMPRE in fondo (sopra l'input), non in cima (v5.904) — PR #386 · `d829601` · 23/06/2026

## v5.903 — Assistente+manuale: BLOCCA prenotazione senza maestro/giocatore al collo di bottiglia della create
- Regola "maestro obbligatorio" viveva solo in _advancePrenota (raccolta slot) → i rami che arrivano alla create per altra via (conferma testuale, ripartenze) la bypassavano. Per il giocatore non c'era blocco (auto-Ospite silenzioso). — PR #385 · `b2f0d46` · 23/06/2026

## v5.902 — Annullo: sweep cloud degli staff_booking del slot → niente più fantasma 'Partita' dall'annullo
- Fix (solo index.html): _staffCalCommitLocalCancel fa uno SWEEP del cloud e tombstona TUTTI gli staff_booking ATTIVI dello slot, qualunque sia il creatore (come staffCalForceRemoveSlot). Fire-and-forget. Vale per annullo da bottone e da assistente. server.mjs invariato. Validato verde su test-preview v5.902 (22/22·73/74·63/63). — PR #383 · `dd976a6` · 22/06/2026

## v5.901 — Cross-device/mobile: auto-risveglio canale realtime + heartbeat più rapido → aggiornamento istantaneo anche su telefono
- Server.mjs invariato. Logica validata verde su test-preview v5.901 (22/22·73/74·63/63). — PR #382 · `f73242d` · 22/06/2026

## v5.900 — Cross-device: annullo non resta appeso ai ~15s dell'heartbeat realtime quando il broadcast non è consegnato
- Fix (solo index.html): - staffCalRefreshFromCloud: idratazione occupancy/bookings ridisegna SOLO su cambiamento reale (firma JSON) → niente redisegno a ogni pull; - poll di sicurezza desktop infittito da ~60s a ~8s (ora innocuo). Mobile resta 4s. — PR #381 · `139dccc` · 22/06/2026

## v5.897 — Annullo: cura del flicker-annullo (rimozione locale+tombstone cloud delle copie MP)
- Cura del flicker-annullo (rimozione locale+tombstone cloud delle copie MP) v5.897 — PR #380 · `07073d9` · 22/06/2026

## v5.896 — Cross-device: staff_booking porta id_reserva → no fantasma origine spostamento sul 2° device
- Staff_booking porta id_reserva → no fantasma origine spostamento sul 2° device (v5.896) — PR #379 · `a169e21` · 22/06/2026

## v5.895 — Mobile: rimuove chiusura-scheda v5.894 (rompeva sposta/durata/annulla via testo)
- Rimuove chiusura-scheda v5.894 (rompeva sposta/durata/annulla via testo) (v5.895) — PR #378 · `f469185` · 22/06/2026

## v5.894 — Mobile: chiudi la scheda quando il comando non le è diretto
- Chiudi la scheda quando il comando non le è diretto (v5.894) — PR #377 · `e68ae86` · 22/06/2026

## v5.893 — Assistente: 'come giocatore' salta disambiguazione + risposta-giocatore nel flow
- 'come giocatore' salta disambiguazione + risposta-giocatore nel flow (v5.893) — PR #376 · `23601ae` · 22/06/2026

## v5.892 — Routing: _editNames estrae nome completo, non scambia 'come'
- _editNames estrae nome completo, non scambia 'come' (v5.892) — PR #375 · `0912362` · 22/06/2026

## v5.891 — Routing: cognome 'Aprea' non scambiato per 'apri'
- Cognome 'Aprea' non scambiato per 'apri' (v5.891) — PR #374 · `9df15f7` · 22/06/2026

## v5.890 — Cross-device: edit in-place ottimistici sul 2° device
- Edit in-place ottimistici sul 2° device (v5.890) — PR #373 · `da4e2e4` · 22/06/2026

## v5.889 — Promozione PROD: A1 idReserva persistente negli edit + bump
- Promuove SOLO le modifiche A1 da test-preview (commit ec43c88), NON il hook di test. Gli edit (togli giocatore / durata / sposta / nota) catturano l'idReserva all'apertura scheda e dalla lettura autorevole del worker, e lo passano SEMPRE → Ficha diretta, niente risoluzione fragile per coordinate (causa dei PRENOTAZIONE_NON_TROVATA dopo uno spostamento o su slot stantio). Verificato a regressione: handle-test.html 22/22. — PR #371 · `3a44d94` · 22/06/2026

## v5.888 — Promote: cross-device sposta-campo ottimistico + fix latenza mobile
- Promote: cross-device sposta-campo ottimistico + fix latenza mobile (v5.888) — PR #368 · `0ec1aae` · 22/06/2026

## v5.886 — Promote: "cancella" nudo dopo create in chat annulla quella prenotazione
- Promote: "cancella" nudo dopo create in chat annulla quella prenotazione (v5.886) — PR #367 · `9196435` · 21/06/2026

## v5.885 — Promote: "cancella"/"annulla" nudi = annullo prenotazione (non elimina-socio) + surfacer handle()
- Promote: "cancella"/"annulla" nudi = annullo prenotazione (non elimina-socio) + surfacer handle() (v5.885) — PR #366 · `eb79bf5` · 21/06/2026

## v5.883 — PROD: CREATE assistente senza lag pre-commit
- PROD: CREATE assistente senza lag pre-commit (v5.883) — PR #365 · `d5ecab9` · 21/06/2026

## v5.882 — PROD: UI ottimistica EDIT/CANCEL + create-da-slot + disambiguazione a pulsanti
- PROD: UI ottimistica EDIT/CANCEL + create-da-slot + disambiguazione a pulsanti (v5.873→v5.882) — PR #364 · `21025a4` · 21/06/2026

## v5.872 — Staff cal: conferma Matchpoint + op dipendente attende
- Staff cal: conferma Matchpoint + op dipendente attende (v5.872) — PR #363 · `1241298` · 21/06/2026

## v5.871 — Staff cal: CREATE ottimistico — fatto subito, Matchpoint in background
- Staff cal: CREATE ottimistico — fatto subito, Matchpoint in background (v5.871) — PR #362 · `19b8a40` · 21/06/2026

## v5.870 — Assistente: lezione con giocatore non confusa con anagrafica
- Assistente: lezione con giocatore non confusa con anagrafica (v5.870) — PR #361 · `c0bee70` · 21/06/2026

## v5.869 — Promote(PROD): assistente — comando composto 'crei una lezione … e aggiungi X' = CREA
- Promote(PROD): assistente — comando composto 'crei una lezione … e aggiungi X' = CREA (v5.869) — PR #358 · `cedc9d7` · 21/06/2026

## v5.868 — Promote(PROD): assistente/anagrafica — nome incompleto risolto al socio giusto
- Promote(PROD): assistente/anagrafica — nome incompleto risolto al socio giusto (v5.868) — PR #357 · `c063494` · 21/06/2026

## v5.867 — Promote(PROD): assistente — lessico durata + leva la partita = annulla
- Promote(PROD): assistente — lessico durata + leva la partita = annulla (v5.867) — PR #355 · `8b6d744` · 21/06/2026

## v5.866 — Promote(PROD): assistente — rimuovi giocatore a scheda aperta + verbi accorcia durata
- Promote(PROD): assistente — rimuovi giocatore a scheda aperta + verbi accorcia durata (v5.866) — PR #354 · `cf8e2c7` · 21/06/2026

## v5.864 — Promote(PROD): autoapprendimento esito reale sulla creazione
- Promote(PROD): autoapprendimento esito reale sulla creazione (v5.864) — PR #351 · `fc9cf09` · 21/06/2026

## v5.863 — Promote(PROD): autoapprendimento esito reale executed/failed
- Promote(PROD): autoapprendimento esito reale executed/failed (v5.863) — PR #350 · `9dc0af7` · 21/06/2026

## v5.862 — Promote: fix "con lo zio" non aggiunge "zio" come giocatore
- Da test-preview 8494c28. _lezionePlayerText rimuove anche gli alias fuzzy del maestro ("lo zio"→LoZio), così "Mi prenoti una lezione con lo zio" non lascia "zio" → fuzzy su un socio a caso. Solo Pages (index.html), niente edge/worker. — PR #349 · `9bd0f84` · 21/06/2026

## v5.861 — Promote: STEP 2 — "aggiungi <nome>" dopo prenotazione creata la aggancia
- Promozione PROD dello Step 2 (da test-preview 179460b): dopo che l'assistente CREA una prenotazione, "aggiungi/inserisci/inseriscimi <nome>" entro 5 min la aggiunge a QUELLA prenotazione (riapre la scheda e chiede conferma) invece di instradare ad anagrafica. Guard contro altre prenotazioni/note/contatti; "iscrivi X" resta creazione socio. Solo Pages (index.html), niente edge/worker. — PR #348 · `0ef62d2` · 21/06/2026

## v5.860 — Promote: fix parser imperativi col pronome enclitico "-mi"
- Solo Pages (index.html) + harness. Niente edge/worker. Harness: anagrafica 63/63, prenotazioni 73/74 (fail residuo id 20 pre-esistente). — PR #347 · `e7a91cb` · 21/06/2026

## v5.859 — Promote(PROD): storico visibile+modificabile + import manutenzioni storiche
- Promote(PROD): storico visibile+modificabile + import manutenzioni storiche (v5.859) — PR #345 · `51fa977` · 21/06/2026

## v5.856 — Promote(assistente): Capitolo 2 v5.840→v5.856 in PROD
- Promote(assistente): Capitolo 2 v5.840→v5.856 in PROD — PR #342 · `3d72013` · 21/06/2026

## v5.838 — PROD v5.838 — autoapprendimento attivo in PROD (cattura diario + lessico)
- PROD v5.838 — autoapprendimento attivo in PROD (cattura diario + lessico) — PR #341 · `60dd1b2` · 19/06/2026

## v5.837 — PROD v5.837 — assistente prenotazioni/anagrafica + import manutenzione Matchpoint
- PROD v5.837 — assistente prenotazioni/anagrafica + import manutenzione Matchpoint — PR #340 · `895f065` · 19/06/2026

## v5.836 — Promote(PROD): fix anagrafica assistente
- Promozione in PROD dei 9 fix anagrafica assistente collaudati su /test/ (solo index.html): - disambiguazione socio per nome/cognome (non solo numero) - follow-up col pronome (ultimo socio del discorso, _anaLastSubject) - scheda vuota/nuova = creazione; comando esplicito esce dal flusso in sospeso - "variare" come update + livello "da X a Y" → valore target - email facoltativa in creazione ("salta"/"non la conosco") - livello validato 0–7 (no troncamento "21"→"2") — PR #339 · `5576963` · 18/06/2026

## v5.833 — Promozione PROD: assistente anagrafica + banco di prova + fix prenotazione
- Promozione PROD: assistente anagrafica + banco di prova + fix prenotazione (v5.833) — PR #338 · `92dc52a` · 18/06/2026

## v5.832 — Promozione PROD: anagrafica assistente + disiscrizione/ri-iscrizione Matchpoint
- Promozione PROD: anagrafica assistente + disiscrizione/ri-iscrizione Matchpoint (v5.832) — PR #336 · `bb3934c` · 18/06/2026

## v5.821 — Assistente: chiede 'partita o lezione?' per primo
- Chiede 'partita o lezione?' per primo (v5.821) — PR #334 · `c64d029` · 17/06/2026

## v5.820 — Note: note prenotazioni bidirezionali app↔Matchpoint
- Note prenotazioni bidirezionali app↔Matchpoint (v5.820) — PR #333 · `7271ea9` · 17/06/2026

## v5.819 — Assistente: lezione richiede maestro + rimuove benvenuto chat (v5.819) → PROD
- Lezione richiede maestro + rimuove benvenuto chat (v5.819) → PROD — PR #331 · `02151b1` · 17/06/2026

## v5.818 — Fix mobile: tooltip title non fisso su touch
- Fix mobile: tooltip title non fisso su touch — v5.818 — PR #330 · `5c14737` · 17/06/2026

## v5.817 — Nasconde Messaggi WhatsApp in PROD (sperimentale)
- Nasconde Messaggi WhatsApp in PROD (sperimentale) — v5.817 — PR #329 · `6825abe` · 17/06/2026

## v5.816 — Fix prenota AI: campo non come giocatore + domanda Ospite
- Fix prenota AI: campo non come giocatore + domanda Ospite — v5.816 — PR #328 · `189cce1` · 17/06/2026

## v5.815 — Attiva Assistente AI in PROD (chat)
- Attiva Assistente AI in PROD (chat) — v5.815 — PR #327 · `86fe688` · 17/06/2026

## v5.814 — Promozione PROD: Assistente AI (test-preview v5.814 → main)
- Promozione PROD: Assistente AI (test-preview v5.814 → main) — PR #326 · `3199ea0` · 17/06/2026

## v5.771 — Rbac: ripristina il gating ruoli sulla barra capitoli desktop + robustezza permessi
- - v5.769: il redesign desktop (capitoli in barra orizzontale) aveva ri-rotto il gating ruoli con lo stesso bug CSS di v5.758 ma sui nuovi selettori: estese le regole [hidden]{display:none!important} a .pmo-chapter-item/.pmo-chapter-group/ .pmo-chapter-dropdown button (prima staff ristretto vedeva tutti i capitoli). Aggiunta anche la voce "Assistente AI" all'albero permessi (solo TEST, via PMO_IS_TEST_ENV → in PROD l'albero resta invariato). - v5.770: la voce AI è iniettata a runtime DOPO il gate di boot → re-gate dopo l'iniezione (effetto solo TEST: in PROD la voce AI non viene iniettata). — PR #324 · `7e5e8cd` · 15/06/2026

## v5.768 — Sidebar: header compatto + logo a tutta altezza
- Promozione PROD dell'header sidebar ridisegnato (testato su test-preview): - logo + "Padel Village" su una riga, "Esci" come icona (logout); - rimosso il sottotitolo ridondante "Match Organizer"; - meta "versione" sotto il nome (in PROD senza etichetta TEST: il badge è gated da PMO_IS_TEST_ENV, quindi non compare); - logo ingrandito (36px) per coprire l'altezza del blocco nome. Vale anche per il drawer mobile. — PR #323 · `c282080` · 15/06/2026

## v5.766 — Layout: promozione PROD redesign home calendario
- Include anche il refactor staff-cal già presente su test-preview (staffCalToggleStaffPlayers riusa _staffCalStoredRosterNames). — PR #322 · `a75a07e` · 15/06/2026

## v5.761 — Roster calendario: ripristino "mostra il roster più completo"
- Ritirata la modifica roster del v5.760: su ambienti dove la lettura live del Matchpoint torna parziale (2-3 nomi su 4) il fidarsi del live nascondeva giocatori reali dalla card. Ripristinato il comportamento sicuro precedente (`staffCalViewMatchpointPlayers`): tra lettura live e roster sincronizzato vince **sempre il più completo**, così i giocatori non spariscono. Il fix del throttle profilo (v5.760) resta invariato. Solo app.

## v5.760 — Robustezza: throttle profilo solo su successo + roster calendario meno aggressivo
- **Rilettura profilo (`pmoRefreshStaffProfileFromCloud`)**: il throttle persistente di 3 minuti ora viene scritto **solo dopo** una chiamata a `pmo_get_my_staff_profile` andata a buon fine. Prima veniva scritto *prima* della RPC: un errore transitorio (rete/token) "consumava" la finestra e per 3 minuti i reload successivi saltavano la rilettura, ritardando la propagazione di un cambio permessi dell'admin. Ora un fallimento non blocca il retry al reload successivo. (Audit invariato: si scrive un solo record per chiamata riuscita.)
- **Roster card calendario staff (`staffCalViewMatchpointPlayers`)**: la scelta tra lettura live e roster sincronizzato non è più basata solo sul numero di nomi. Ci si fida del live appena ha un roster plausibile (≥2 nomi) e si ricade sullo stored solo quando il live è degenere (0/1 nome) e lo stored ne ha di più. Mantiene la protezione contro la lettura troncata ("1 solo nome") ma non maschera più una rimozione reale di giocatori (es. 4→2) quando il roster sincronizzato non è ancora aggiornato. Solo app.

## v5.759 — Permessi: rilettura profilo dal cloud al reload (non solo al login)
- Un cambio di permessi/ruolo fatto dall'admin ora si propaga al **semplice reload** della pagina, senza bisogno di logout/login. All'avvio, se la sessione è valida, l'app rilegge in background il profilo dal cloud (`pmoRefreshStaffProfileFromCloud`) con throttle persistente di 3 minuti (perché `pmo_get_my_staff_profile` scrive un record di audit ad ogni chiamata). Se rileva un cambiamento riapplica la visibilità sezioni (`pmoApplyRolePermissions`) e forza il pull del calendario. Caso tipico risolto: utente "solo Calendario" a cui viene attivato `cloud_sync` ora vede partite/lezioni dopo un reload, senza attendere il polling né rifare il login. Solo app.

## v5.715 — Editor modifica prenotazione: stesso stile delle schede di prenotazione
- L'editor che si apre modificando una prenotazione (giocatori + spostamento) ora usa lo stesso design delle schede di prenotazione: stessi bottoni (`.svc-btn-step`, conferma verde/rosso), chip giocatori (`.svc-player-chip` + ✕ tondo), etichette e campi coerenti coi token, e gli stessi caratteri (anche le misure su mobile). Eliminati gli stili inline ad-hoc e l'override `font-size:20px` dedicato. Solo presentazione: comportamento, handler e logica invariati. Solo app.

## v5.714 — Sync staff: reconcile PER-ID (Fase B riordino)
- Il calendario staff ora riconcilia le prenotazioni col cloud confrontando l'`id` stabile (`sbId`) invece dello slot. Una prenotazione che cambia campo/data/ora è riconosciuta come la stessa voce e la card si SPOSTA su tutti i device, senza più "orfane" e senza tombstone. Mantenuto un ponte per slot per i record legacy e per gli annullamenti (chiavati per slot), così la transizione è liscia. Lo spostamento non ri-genera più l'id e non scrive tombstone sintetici; resta lo `staff_suppress` per nascondere l'occupazione Matchpoint sul vecchio slot. Solo app. (La edge `matchpoint-bookings-edit` verrà ripulita dei tombstone a parte, dopo l'aggiornamento dei device.)

## v5.713 — Sync staff: id prenotazione condiviso col cloud (Fase A riordino)
- La creazione di una prenotazione staff genera ora un `sbId` (UUID) che il client passa alla edge `matchpoint-bookings-create` e usa anche come id locale. Così la edge e il client scrivono lo STESSO record cloud (chiave = `sbId`) invece di due record distinti (UUID lato client + stringa-slot lato edge). Nessun cambiamento visibile: è preparazione al reconcile-per-id (Fase B) e rimuove il doppio record alla radice. Richiede la edge `matchpoint-bookings-create` v17 (deployata a parte). Solo app.

## v5.699 — Revert ottimistico cross-device (torna a comportamento 5.697)
- Rimossa la propagazione broadcast pending/resolved (staffCalRtBroadcastPending, staffCalRtBroadcastResolved, staffCalRtOnRemotePending, staffCalRtOnRemoteResolved) introdotta nella 5.698. Si torna al comportamento della 5.697: ottimistico locale sul device che prenota + propagazione normale agli altri via `staff-changed` (desktop istantaneo, mobile ~10-12s). Solo app.

## v5.637 — Chat: tolta l'etichetta "Sistema" dalle schede
- In cima alle schede della chat del Calendario non compare più l'etichetta "🤖 Sistema": le schede risultano più pulite. Il contenuto resta invariato (ha già le sue icone). L'etichetta "👤 Staff" sui messaggi dell'operatore resta. Solo CSS, nessun cambio di comportamento. Solo app.

## v5.636 — Chat: resta blu solo la scheda in cima, le card "flow" sotto sono grigie
- Nella colonna chat del Calendario solo la scheda più recente (in cima) resta evidenziata in blu. Le schede di tipo "flow" (disambiguazione "Quale «…»?", card "Giocatori partita", "Quale maestro?") non hanno più lo sfondo/bordo blu fisso: una volta scorse sotto dopo l'uso appaiono grigie come le altre schede di sistema. La scheda in cima resta blu in ogni caso (regola first-child invariata, anche se è una "flow" attiva). Solo CSS, nessun cambio di comportamento. Solo app.

## v5.635 — Creazione prenotazioni: anti-omonimia via Codice cliente
- Anche in creazione (partita e lezione), quando si sceglie un socio l'app aggancia ora il Codice cliente (memberId, es. 000005) al giocatore e lo manda al worker come `codiceCliente`, così Matchpoint identifica la persona dalla riga "Codice-Nome" della tendina ed evita gli omonimi — come già avviene nell'editor delle prenotazioni esistenti. Additivo: per i soci senza Codice valido (creati in-app o testo libero) resta l'aggiunta per nome. Richiede il worker con anti-omonimia in creazione (già in produzione). Solo app.

## v5.634 — Editor giocatori: il chip "Da aggiungere" mostra il Codice cliente
- Il chip di un giocatore in attesa di salvataggio nell'editor 👥 mostrava "(senza codice)" anche quando il Codice cliente (memberId, es. 000005) era presente, perché l'etichetta guardava solo l'id interno Matchpoint (matchpointIdInterno, quasi sempre vuoto). Ora mostra il primo codice disponibile — id interno o, in mancanza, Codice cliente — e tiene "(senza codice)" solo quando manca davvero ogni codice (socio creato in-app o testo libero). Solo etichetta: nessun cambio di logica, il codiceCliente era già passato al worker da v5.633. Solo app.

## v5.633
- Editor giocatori: l'app passa al worker il Codice cliente (memberId, es. 000005) come `codiceCliente`, così Matchpoint identifica il socio dalla riga "Codice-Nome" della tendina ed evita gli omonimi. Additivo: se il Codice manca, resta l'aggiunta per nome come prima.

## v5.632 — Lezioni: abilitato il bottone 👥 per modificare gli allievi
- Il bottone 👥 (aggiungi/rimuovi giocatori) ora compare anche sulle card delle lezioni, oltre che sulle partite, in entrambe le viste (griglia e agenda). Gli allievi sono gli stessi soci del DB. Le manutenzioni restano escluse (niente partecipanti). Richiede il supporto lezioni nel worker (già in produzione). Solo app.

## v5.631 — Giocatori: la scheda attiva torna in cima dopo la disambiguazione
- Aggiungendo giocatori, quando un nome è ambiguo compare la scheda "Quale «…»?" in cima alla chat. Dopo la scelta, la scheda dello step attivo (la "Chi gioca?" in creazione, la card "Giocatori partita" nell'editor 👥) ora torna in cima invece di restare sotto la disambiguazione, così l'operatore continua a lavorare dall'alto. Vale per entrambi i flussi (creazione ed editor). Solo app.

## v5.630 — Chat: la scheda in testa risalta (barra accent a sinistra)
- Nella colonna chat del Calendario la scheda più recente (in cima) ora si distingue nettamente dalle altre grazie a una barra accent a sinistra + un leggero sfondo accent. Realizzato in CSS puro su `#svcChatMessages > .svc-msg:first-child`, quindi l'evidenziazione si sposta da sola sulla nuova scheda quando arriva un messaggio. Non altera il colore-tipo delle schede (verde ok / ambra conferma / accent flusso), che resta visibile. Nessun JavaScript. Solo app.

## v5.629 — Editor giocatori: niente più blocco infinito (timeout + messaggio chiaro)
- Le chiamate dell'editor 👥 (lettura e salvataggio giocatori partita) non avevano timeout: se il worker Matchpoint era lento o si piantava, l'interfaccia restava col contatore all'infinito e si era costretti a ricaricare. Aggiunto un timeout lato app: 90s sulla lettura, 200s sul salvataggio. Allo scadere l'editor si sblocca e mostra un messaggio dedicato; sul salvataggio avvisa che la modifica potrebbe essere già stata applicata (ricaricare e controllare prima di ritentare, per non duplicare). I 200s sono volutamente sopra il guardiano della coda del worker (180s), così l'eventuale errore reale del worker emerge invece di restare nascosto. Solo app; edge e worker invariati.

## v5.628 — La prenotazione annullata non "rinasce" più nel calendario
- Dopo un annullamento riuscito, lo slot veniva talvolta ridisegnato come 🔒 sola lettura perché la cache di occupazione Matchpoint (`prenotazioniOccupazione`) era ancora vecchia. Ora il calendario tiene una lista a scadenza (30 min) degli slot annullati di recente e li nasconde finché i dati non si aggiornano. La lista si pulisce da sola ed è azzerata quando si crea/sposta una prenotazione sullo stesso slot. Solo app; nessun dato principale cancellato; edge e worker invariati.

## v5.627 — Rimosso il banner "Sincronizzazione automatica in corso"
- Tolto il banner azzurro nel pannello Calendario e il relativo polling (ogni 4s). Effetto collaterale voluto: la riga di input della chat torna allineata in alto con l'intestazione dei campi. Solo app; edge e worker invariati.

## v5.626 — Calendario: pannello più alto (chat non più tagliata)
- L'altezza del blocco calendario+chat in desktop passa da 520px fissi a `min(80vh, 860px)` (adattiva all'altezza schermo, con tetto). I messaggi lunghi (es. editor giocatori) non restano più tagliati in basso e si vedono più ore nella griglia. Solo CSS; edge e worker invariati.

## v5.625 — Giocatori: usare l'id interno Matchpoint (matchpointIdInterno) invece di memberId
- Aggiungendo un giocatore (editor 👥 e creazione prenotazione) l'app passava `memberId` (codice/tessera) come codice atteso, ma il worker confronta con `HiddenFieldIdPeople` = id interno (`id_people`). Risultato: `PLAYER_CODE_MISMATCH` per i soci con id interno noto. Ora si passa `matchpointIdInterno` (l'id interno reale). Se assente, aggiunta per nome come prima. Solo app; edge e worker invariati.

## v5.624 — Calendario: avvio indipendente (fix definitivo griglia vuota all'apertura)
- La griglia restava vuota (data "gg/mm/aaaa") perché `staffCalInit` non veniva chiamato: nella sequenza di avvio `renderInitialDashboard()` non è protetta ed è subito prima di `staffCalInit`; un suo errore interrompeva l'avvio. Aggiunto `staffCalBootstrap`: un poller indipendente che inizializza il calendario appena il contenitore è pronto e si ferma quando la griglia è disegnata. Solo app; edge e worker invariati.

## v5.623 — Calendario: fix griglia vuota all'apertura (ridisegno di sicurezza)
- All'apertura del Calendario la griglia poteva restare vuota (data "gg/mm/aaaa") finché non si cliccava "Oggi": `staffCalInit` disegnava prima che il contenitore fosse pronto. Aggiunto `staffCalEnsureRendered`: per ~5s dopo l'apertura ridisegna appena la griglia è costruibile ma vuota e imposta la data di oggi. Si ferma da solo appena la griglia è piena. Solo app; edge e worker invariati.

## v5.622 — Calendario: modifica giocatori sulle card partita (👥)
- Sulle card partita staff (✏️) un nuovo pulsante 👥 apre un editor nel pannello chat: legge i partecipanti reali da Matchpoint (edge `matchpoint-bookings-edit` con `read`), permette di rimuovere i presenti e aggiungere nuovi soci tramite la ricerca clienti (che porta il codice → aggiunta a prova di omonimi). Al salvataggio chiama la edge col blocco `players`, aggiorna la card locale con la lista reale restituita dal worker e ridisegna. Compare solo sulle partite (non su lezione/manutenzione). Solo app; edge e worker già pronti.

## v5.621 — Calendario: rimossa la legenda e la riga di suggerimento in alto
- Tolta dalla testata del Calendario staff la legenda colorata (Partita / Lezione [STAFF] / Prenotazione staff / Libero) e la riga grigia di suggerimento ("Clicca su uno slot libero…"). Rimosse anche le regole CSS ormai inutilizzate (`.staff-cal-legend`, `.staff-cal-legend-dot`, `.staff-cal-hint`). Solo app; edge e worker invariati.

## v5.620 — Calendario: card staff più chiare (tipo reale) + via il pulsante 🧹
- Le card delle prenotazioni staff (✏️) mostrano ora il **tipo reale** scelto in prenotazione (Partita / Lezione / Manutenzione / Torneo) al posto della generica "Staff", sia in griglia desktop sia in agenda mobile. Il tipo è già salvato nel record; ora `staffCalGetSlots` lo porta come `tipoReale` e un helper `_staffCalTipoLabel` lo traduce in etichetta. Le card Matchpoint (🔒) restano invariate.
- Rimosso il pulsante 🧹 "rimuovi solo dal calendario" da entrambe le viste e cancellata la funzione `staffCalRemoveLocalOnly` ormai inutilizzata. L'annullamento con 🗑 ripulisce già da solo le card "fantasma" non più presenti su Matchpoint. Solo app; edge e worker invariati.

## v5.619 — Calendario: spostamento prenotazione dalla card (↔)
- Sulle card staff (✏️) un pulsante "↔ Sposta" avvia lo spostamento: si clicca lo slot libero di destinazione (anche di un altro giorno) e l'app chiama l'edge `matchpoint-bookings-edit` col solo blocco move (campo/data/ora; durata invariata). Non tocca i giocatori. Conferma e feedback nel pannello chat; copia locale aggiornata.

## v5.618 — Calendario: stato coda Matchpoint nel pannello chat
- Il pannello "Assistente prenotazioni" mostra in tempo quasi-reale cosa sta facendo il worker e chi l'ha avviato (+ quanti job in coda), leggendo la edge `matchpoint-queue-status` ogni 4s mentre la tab Calendario è attiva. Sola lettura: nessun impatto sul flusso di prenotazione.

## v5.617 — Pulizia: rimosso il codice morto del vecchio Tabellone Matchpoint (blocco <script> "Calendario Matchpoint" e regole CSS .cal-*), ormai inutilizzato dopo lo spostamento del Calendario staff (v5.616). Mantenuta la regola #dashboard { padding:0 } che stila la tab Calendario. Nessun cambio di comportamento. Solo app; edge e worker invariati. [Fase 2/2]

## v5.616 — Calendario: la tab "Calendario" ora mostra il Calendario campi staff (spostato qui da Amministrazione) al posto del vecchio Tabellone Matchpoint. Riagganciati avvio (DOMContentLoaded) e apertura tab a staffCalInit; aggiornate le etichette ("Campi staff"); rimosso il link ridondante in Amministrazione. Il codice del vecchio tabellone resta presente ma inutilizzato (sarà rimosso in una versione successiva). Solo app; edge e worker invariati. [Fase 1/2]

## v5.615 — Calendario staff: corretta la durata degli eventi. La durata importata da Matchpoint è in ore come stringa (es. '1.5'=90min); con parseInt diventava 1 → tutti gli eventi apparivano lunghi 1 minuto ("17:00–17:01") su un solo slot. Ora un helper converte correttamente ore→minuti (minuti già numerici invariati) per occupazione, prenotazioni e prenotazioni staff: card e orario di fine rispettano la durata reale. Solo app; edge e worker invariati.

## v5.614 — Calendario staff: corrette le frecce ‹ › di navigazione giorno. Usavano toISOString() (UTC) per riformattare la data: in Italia (UTC+1/+2) la freccia avanti restava ferma e quella indietro saltava di 2 giorni. Ora lo spostamento usa i componenti di data locali, con base a mezzogiorno (robusto ai cambi ora legale/solare). Solo app; edge e worker invariati.

## v5.613 — Calendario staff: nuovo pulsante 🧹 "rimuovi solo dal calendario" sulle card Staff (griglia + agenda), in grigio per distinguerlo dal 🗑. Rimuove la copia locale all'istante senza chiamare il worker (per i fantasmi già rimossi a mano su Matchpoint), con conferma che avvisa che NON tocca Matchpoint.

## v5.612 — Calendario staff: il 🗑 ora rimuove davvero la card locale dopo l'annullamento (confronto campo come numero: alcune card vecchie lo avevano come stringa e non sparivano). Se la prenotazione non è più su Matchpoint, la card viene comunque ripulita invece di restare bloccata in errore.

## v5.611 — TEST: modifica prenotazione anche per campo+data+ora. Edge matchpoint-bookings-edit accetta la terna (oltre all'idReserva) e la inoltra al worker (che la risolve dal tabellone). Pulsante 🧪 Modifica: idReserva vuoto → chiede campo,YYYY-MM-DD,HH:MM. Additivo e retrocompatibile.

## v5.610 — Calendario staff: l'esito dell'annullamento dal 🗑 ora compare come bolla SISTEMA in cima alla colonna chat (⏳ in corso con contatore secondi → ✅/❌), coerente con la creazione prenotazione. Niente più riga di stato nascosta. Logica di cancellazione invariata.

## v5.609 — Calendario staff: pulsante 🗑 sulle card ✏️ Staff (griglia desktop + agenda mobile) per annullare la prenotazione su Matchpoint via campo+data+ora (con conferma) e rimuovere la copia locale. Le card 🔒 Matchpoint restano sola lettura. Edge e worker invariati.

## v5.608 — TEST: pulsante "🧪 Annulla prenotazione" ora accetta anche la terna campo+data+ora (formato campo,YYYY-MM-DD,HH:MM) oltre all'idReserva — per validare la cancellazione via tabellone prima di collegare il 🗑 al calendario. Solo pulsante di test; edge e worker invariati.

## v5.607 — Calendario staff: disambiguazione giocatori/allievi con lista nomi completi quando un nome è ambiguo; i chip portano il codice socio scelto e vengono inviati codici esatti (partita e lezione) → niente più aggancio omonimo. Allievo obbligatorio per la lezione. (A3b+)

## 2026-06-02 / DB: migrazione — aggiunto record_type 'booking_job' al vincolo di pmo_cloud_records (stato lavoro prenotazione asincrona). Già applicato a mano su TEST; il file lo rende permanente e lo porta in PROD.

## 2026-06-02 / TEST (edge matchpoint-bookings-create): aggiunta modalità asincrona opzionale (flag async) + endpoint GET stato lavoro, riusando pmo_cloud_records (record_type booking_job). Retrocompatibile: senza async, comportamento invariato. Worker non toccato.

## 2026-06-02 / TEST (edge matchpoint-bookings-create): rimosso il retry automatico (erano 3 tentativi) della chiamata al worker per create-booking — anti-doppione su prenotazioni lente. Una sola chiamata.

## v5.603 — Assistente: controllo stato prenotazione più frequente (1,5s) per conferma più rapida.

## v5.606 — Calendario staff: flusso Lezione collegato al motore reale (step maestro a pulsanti + istruttore). Singola/Gruppo inviate come 'lezione'. Allievi opzionali. (Tappa A3b)

## v5.605 — Calendario staff: assistente a pulsanti in sidebar (come mockup v3.6), flusso Partita collegato al motore reale (prenotazione asincrona + conferma). Lezione/Torneo visibili ma non ancora attivi. (Tappa A3a)

## v5.604 — Calendario staff: nuovo look griglia v3.6 (desktop) + agenda mobile, alimentato dai dati esistenti. Nessuna modifica al motore di prenotazione. (Tappa A1)

## v5.602 — Assistente prenotazioni (ramo singolo): modalità asincrona — invia, mostra 'in corso…' e conferma 'prenotata ✓' a esito reale; gestiti errore e attesa troppo lunga. Ricorrenza invariata.

## v5.601 — Assistente prenotazioni: controllo istantaneo 'slot già occupato' (anche sovrapposizioni parziali) prima di inviare al worker; messaggio di successo più onesto ('inviata a Matchpoint, controlla nel calendario').

## v5.600 — Assistente prenotazioni: invio nome→codice Matchpoint (campo giocatori[]) alla edge per le partite; più giocatori; omonimi → 'specifica meglio'. Lezione invariata.

## 2026-06-02 / TEST: il pulsante test prenotazione prenota una PARTITA su un socio per nome, risolvendo il codice Matchpoint dal DB locale (solo numerico; PMO-/vuoto -> nome). Valida la catena con disambiguazione per codice.

## 2026-06-02 / TEST: rimossi gli ultimi riferimenti placeholder PMO-000948; i test (notifiche/follow-up/link autovalutazione/testValidare) puntano al socio di prova Maurizio Aprea via email/codice reale. Mantenuti gli override email/telefono di test.

## 2026-06-02 / TEST: rimosso il trattamento segnaposto/test del socio Maurizio Aprea nell'audit soci e nei default del modulo autovalutazione; ora gestito come socio normale (codice Matchpoint 000004). Notifiche/email di test trattate a parte.

## 2026-06-02 / TEST · Edge function `matchpoint-bookings-create` — giocatori con codice Matchpoint

- edge `matchpoint-bookings-create` — accetta e inoltra al worker la lista giocatori con codice Matchpoint (retrocompatibile).

## 2026-06-01 / TEST · Edge function `matchpoint-clients-sync` v45 + browser worker + guardrail PROD

- **Solo ambiente TEST** (Supabase `cudiqnrrlbyqryrtaprd`; nessuna modifica a PROD). Modifiche a Edge Function `matchpoint-clients-sync` (versione 45) e al browser worker, non alla UI dell'app.
- **ID Matchpoint nei soci**: la sync clienti scarica anche il report `Listadoclientes` (colonna `Codice`) e riempie `memberId` con il codice interno a 6 cifre (es. `000004`), abbinando per telefono/email. Collaudo: 982/983 soci agganciati; 1 segnalato per revisione manuale (Fabio De Luca).
- **Login HTTP non operativo**: entrambi i report (livello + Codice) passano dal browser worker; il report Codice usa la modalita' `direct_clients`. La sync risulta piu' lenta (due chiamate al worker).
- **Pulizia doppioni legacy**: i record non-Matchpoint (`PMO-xxxxxx`) con gemello Matchpoint vengono soft-deleted (`legacy_duplicate_superseded`), con due guardie (sopravvissuto Matchpoint + nessun dato curato); i doppioni con dati curati vengono solo segnalati. Collaudo: 1 eliminato (`PMO-000948`), 0 in revisione, 0 soci attivi con id `PMO-` residuo. **Supera la decisione v5.488** (vedi `docs/matchpoint.md`, nota TEST 2026-06-01).
- **Guardrail PROD (su `main`)**: aggiunto workflow `guard-main` (`.github/workflows/guard-main-prs.yml`) + ruleset GitHub sul branch `main`. La verifica fallisce se una PR verso `main` proviene da `test-preview`, cancella file, o tocca piu' di 15 file; il ruleset blocca anche force-push e cancellazione del branch.

## v5.596 / TEST: slot prova Matchpoint allineato a 90 min

- **Solo ambiente TEST**: aggiornato il payload di prova del pulsante **🧪 Test prenotazione Matchpoint** da 60 a 90 minuti (`ora: "09:00"`, `oraFine: "10:30"`, `durata: 90`), allineando la prenotazione di test al default Matchpoint per le partite.

## v5.595 / TEST: pulsante test prenotazione Matchpoint

- **Solo ambiente TEST** (guard su `PMO_IS_TEST_ENV` / `data-test-env-only`): aggiunto pulsante nascosto **🧪 Test prenotazione Matchpoint** nell'area dati Matchpoint, dopo il box "Backup dati". Permette allo staff con permesso `cloud_sync` di lanciare una singola prenotazione di prova reale (`Campo 1 · 2026-06-01 · 08:00–09:00 · "TEST PV — CANCELLARE"`) chiamando la edge function `matchpoint-bookings-create`. Il pulsante richiede conferma esplicita, mostra lo stato di avanzamento, disabilita il pulsante durante l'attesa e visualizza l'esito (successo o errore) in un riquadro colorato. In produzione non compare mai.

## v5.594 / TEST: storico prenotazioni disattivato

- **Solo ambiente TEST** (guard su `PMO_IS_TEST_ENV`): lo storico prenotazioni non viene più caricato, salvato in localStorage, né spinto sul cloud. Evita l'errore `setItem ... exceeded the quota` dovuto al localStorage di dominio condiviso con PROD, e non serve in TEST. Quattro guard: (a) `importMatchpointHistoryAutomatic()` no-op, (b) `save()` salta `storicoPrenotazioni`, (c) backup cloud non spinge `booking_history`, (d) restore non ripopola lo storico. **PROD invariato.**

## v5.588 / Fix: Tab 2 INVALID_RULES

- **Correzione INVALID_RULES nel Parser Config (Tab 2 "Genera Aggiornamento")**: Il pulsante "Approva e Aggiorna File" ritornava `INVALID_RULES`. Causa: il front-end inviava alla Edge Function `parser-rules-update` solo le `modifiche` e il frammento filtrato di regole mostrato in Tab 2, mentre la funzione valida lo schema completo delle regole. Ora il client costruisce il SET COMPLETO di regole applicando le modifiche all'intero `PARSER_RULES` e lo invia nel campo `regole` del payload. La Edge Function è stata irrobustita per accettare e validare l'oggetto `regole` completo (con fallback su `modifiche`), restituendo `INVALID_RULES` solo se mancano `intents` o `campi_obbligatori`.

## v5.538 / Scorciatoia di sincronizzazione nel lotto vuoto dell'Autovalutazione

- **Pulsante Sincronizza Ora nel Flusso**: Aggiunto un pulsante di sincronizzazione rapida ("Sincronizza dati locali ora") direttamente nel riquadro dell'Autovalutazione quando il lotto risulta vuoto. Questo evita allo staff di dover cercare il pannello "Amministrazione > Supabase", guidandoli visivamente all'azione corretta e gestendo in tempo reale la notifica di eventuali errori di permessi.

## v5.537 / Fix errata formattazione righe in Da Inviare

- **Correzione Errata Formattazione Righe**: Risolto il problema per cui i soci pronti al primo invio (senza risposta) venivano erroneamente formattati come "Scheda compilata / Da validare". Questo accadeva a causa di un fallback scorretto nella funzione `assessmentProcessEntryResponse` che confondeva l'oggetto di presentazione del rendering con la risposta Supabase reale. Ora gli stati e i bottoni vengono renderizzati in modo impeccabile per ciascun socio.

## v5.536 / Fix visualizzazione tabella Da inviare autovalutazione

- **Correzione visualizzazione tabella Da inviare**: Risolto il problema del caricamento vuoto (con soli trattini `-` sotto le colonne *Routine*, *Fase*, *Prossimo step*, ecc.) per i soci pronti al primo invio nel pannello Autovalutazione. Ora le righe vengono visualizzate con tutti i relativi stati operativi e pulsanti d'azione completi.

## v5.535 / Messaggi manuali editabili ed eliminazione testi

- **Integrazione WhatsApp Desktop Forzata**: Corretta l'idratazione e salvataggio dei dati per impostare di default la modalità Desktop (`whatsapp://`) anziché Web.
- **Eliminazione Modelli Personalizzati**: Introdotta la possibilità per lo staff di eliminare i modelli email e whatsapp creati su misura sia dalla scheda "Testi" che direttamente dalle liste di invio.
- **Modello di Sistema "Solo saluto"**: Creato il modello protetto `'whatsapp-saluto'` per inviare messaggi liberi ai soci mantenendo l'intestazione iniziale automatica.
- **Messaggi Editabili al Volo**: Sostituita l'anteprima statica del modal WhatsApp manuale di Kanban con una `<textarea>` interattiva, che permette allo staff di personalizzare o completare il messaggio prima dell'invio.
- **Copia e Apri Dinamici**: I pulsanti "Copia" e "Apri WhatsApp" acquisiscono in tempo reale le modifiche scritte a mano dallo staff nella textarea.
- **Iniezione ZWSP per WhatsApp**: Risolto il problema del comportamento del parser di WhatsApp Desktop su macOS ( Catalyst app) tramite l'iniezione automatica e dinamica di un carattere invisibile a larghezza zero (Zero-Width Space, `\u200B`) subito dopo l'a capo finale di qualsiasi messaggio generato o modificato a mano.
- **Pulizia Interfaccia**: Rimosso il pulsante verde "Segna gestito" dal modal WhatsApp per rendere l'azione immediata e intuitiva.

## v5.526 / Compattazione filtri Autovalutazione su riga unica

- Compattata la barra dei filtri della sezione Autovalutazione riducendo il gap orizzontale (da 24px a 12px) e il padding interno dei bottoni (da 16px a 12px) per assicurare che tutti i 5 tab stiano su una riga singola su desktop.
- Ridotto lo spazio a sinistra del dot pulsante e del badge "Lotto pronto" per guadagnare ulteriore compattezza visiva.

## v5.525 / Evidenziato lotto pronto in Da inviare

- Inserito un indicatore visivo "Lotto pronto" ed un dot verde pulsante sul tab "1. Da inviare" quando il lotto manuale di email quotidiano è preparato.
- Disegnato uno stile coordinato con sfondo verde tenue e bordi definiti per guidare visivamente lo staff verso l'invio.

## v5.341 / Permesso solo consultazione

- Rinominata la dicitura del permesso `read_all` da "Lettura completa" a "Solo consultazione".
- Allineato il mockup Amministrazione alla nuova etichetta.

## v5.340 / Amministrazione in TEST ottimizzata

- Riorganizzata Amministrazione in due sottosezioni: Utenti e Supabase.
- Spostata la sessione personale in un box account compatto, senza capitolo dedicato.
- Semplificata la gestione Utenti: lista caricata automaticamente, tabella piu leggera e modifiche ruolo/stato/permessi tramite Modifica.
- Chiarita la sezione Supabase come area diagnostica TEST/PROD senza modifiche ai dati.

## v5.339 / Occhio password in angolo destro

- Spostata l'icona mostra/nascondi password sul bordo inferiore destro del campo.
- Rimossa l'interferenza del tooltip globale `button[title]` dal controllo password.

## v5.338 / Fix rendering icona password

- Azzerati padding e margin globali sul bottone icona password, che schiacciavano l'SVG e lasciavano visibile solo un puntino.
- Bloccata la dimensione del controllo a 34px per renderlo stabile dentro il campo password.

## v5.337 / Icona password sempre visibile

- Inserita l'icona occhio direttamente nel markup dei campi password, senza dipendere dall'inizializzazione JavaScript.
- Mantenuto il toggle mostra/nascondi con icona coerente e label accessibile.

## v5.336 / Icona mostra password

- Sostituito il pulsante testuale "Mostra" con una piccola icona occhio dentro i campi password.
- Allineato il controllo mostra/nascondi a destra del campo per evitare sovrapposizioni tra email e password.

## v5.335 / Login solo accesso personale

- Rimossa dalla login la sezione "Oppure accesso beta".
- Disattivato il fallback tecnico con password beta condivisa: l'accesso staff passa solo da email e password personale Supabase.
- Aggiornati i testi in Amministrazione per mostrare solo lo stato della sessione personale.

## v5.334 / Registrazione staff guidata

- Separata la login staff in due stati: accesso e registrazione.
- Aggiunto mostra/nascondi password nei campi personali e nel recupero password.
- La registrazione controlla prima la nuova RPC `pmo_can_register_staff`: solo email gia autorizzate in Amministrazione possono creare l'accesso Supabase.
- Dopo la conferma email l'app collega il profilo staff, chiude la sessione temporanea e torna alla login con email precompilata.
- La password resta quella scelta nella schermata di registrazione e non viene inviata via email.

## v5.333 / Accessi staff guidati in TEST

- Ridisegnata in ambiente TEST la sezione Amministrazione > Accessi staff come flusso guidato: autorizza email, crea accesso, lavora con permessi.
- Semplificata la gestione quotidiana con preset ruolo e riepilogo permessi visibile.
- Spostate le checkbox avanzate dietro "Personalizza permessi", lasciando invariata la logica Supabase Auth + permessi.
- Rinominata l'azione principale in "Autorizza email" per chiarire che la password viene scelta dalla persona dalla schermata iniziale.
- Preparata la versione TEST per funzionare anche dal canale Pages `/test/?env=test`.

## v5.332 / Admin Supabase senza PIN staff

- Rimosso il PIN operativo dalle sezioni Amministrazione, Routine cloud, registrazione token autovalutazione e feedback post-partita.
- Le RPC amministrative usano Supabase Auth e controllano ruolo/permessi del profilo staff (`owner`, `admin`, `staff`, `readonly`).
- Aggiunte RPC no-PIN compatibili per utenti staff autenticati, lasciando le vecchie firme con PIN solo come compatibilita' legacy.
- Ripulito `assessmentSettings` dal vecchio `adminPin` prima del sync cloud.

## v5.331 / Verifica ambiente Supabase

- Aggiunto in Amministrazione il pannello "Ambiente Supabase" per controllare ambiente app, config caricata, project ref, Auth e principali RPC.
- Il check segnala se TEST punta per errore al project ref PROD.
- Migliorato il messaggio quando in TEST `config-test.js` e' presente ma mancano URL o anon key.
- Collegato `config-test.js` al progetto Supabase TEST `cudiqnrrlbyqryrtaprd`.

## v5.151 / Scheda socio ottimizzata

- Ridisegnata la scheda socio con header compatto, dati socio, preferenze operative e stato rapido separati.
- Rinominati i KPI operativi in "Messaggi inviati totali", "Messaggi inviati questa settimana" e "Ultimo messaggio inviato".
- Spostati dettagli tecnici di autovalutazione e storico invii/token/risposte in una colonna dedicata con blocco richiudibile.
- Mantenute le funzioni esistenti di salvataggio, reinvio autovalutazione, disattivazione e cancellazione socio.

## v5.150 / Messaggio livello validato compatto

- Reso più compatto il messaggio WhatsApp "Avvisa socio" dopo la validazione del livello.
- Ridotti gli spazi verticali tra le frasi, mantenendo una sola separazione prima della firma.

## v5.149 / Archivio senza scroll orizzontale

- Rimosso lo scroll orizzontale dall'Archivio autovalutazioni.
- La lista ora si adatta al box: layout tabellare su desktop ampio e layout compatto/card quando lo spazio non basta.
- I pulsanti Azioni rientrano nel contenitore e vanno a capo senza tagliare il testo.

## v5.148 / Archivio autovalutazioni essenziale

- Alleggerita la lista Archivio autovalutazioni: resta visibile solo il riepilogo operativo essenziale.
- Spostato lo storico completo di invii/token e risposte dentro la scheda socio, in un blocco richiudibile.

## v5.147 / Archivio autovalutazioni responsive

- Corretta la griglia dell'Archivio autovalutazioni: la colonna Azioni non si sovrappone più al riepilogo invio/risposta.
- Migliorato il comportamento responsive dell'Archivio con layout a card su larghezze intermedie e mobile.
- Allineata la costante interna `APP_VERSION` alla versione mostrata nell'interfaccia.

## v5.146 / Avviso socio livello validato

- Dopo l'applicazione del livello da autovalutazione, l'app mostra l'azione manuale "Avvisa socio" per preparare un messaggio WhatsApp con il livello validato.
- La notifica viene tracciata come preparata nella scheda socio, nel Post-invio e nell'Archivio, senza invio automatico.

## v5.145 / Scheda test in nuova tab

- I pulsanti "Apri scheda test" aprono la scheda pubblica in una nuova tab, mantenendo l'app admin nella posizione corrente.

## v5.144 / Codice staff nel Pre-invio

- Il bottone "Prepara" resta nel flusso Pre-invio: se serve il Codice staff Supabase, apre le azioni tecniche locali sotto il pulsante invece di portare in fondo agli strumenti avanzati.
- Aggiunto il campo Codice staff Supabase dentro le azioni tecniche del Pre-invio, sincronizzato con le impostazioni avanzate.

## v5.143 / Riga senza telefono Pre-invio

- La riga "Senza telefono" nel Pre-invio usa un layout dedicato: il pulsante "Apri scheda" resta sotto al nome e non viene più tagliato nelle larghezze intermedie.

## v5.142 / Responsive riga Pre-invio

- Corretto l'allineamento del pulsante "Apri scheda" nelle righe Pre-invio, evitando tagli del testo su desktop e mantenendo l'azione sotto al nome su mobile/tablet.

## v5.141 / Feedback bottone 0.5 da inviare

- Quando il bottone "0.5 da inviare" non trova candidati, il Pre-invio mostra un messaggio esplicito con riepilogo dei soci 0.5 invece del generico "nessun socio trovato".

## v5.140 / Post-invio più leggibile e sync a sessione

- Ridisegnata la riga del Post-invio con intestazione socio/stato/azioni e dettagli risposta in blocchi compatti.
- Il pulsante "Aggiorna risposte" torna rosso a ogni ricarica pagina finché non viene eseguita una sincronizzazione Supabase nella sessione corrente.

## v5.139 / Flusso unico 0.5 da inviare

- Rimosso il bottone rapido separato "Token da registrare" dal Pre-invio.
- Il bottone "0.5 da inviare" mostra i candidati livello 0.5 sia pronti sia da preparare, fino a 10 soci.
- Se tra i selezionati ci sono token mancanti o non registrati, il pannello di invio propone la preparazione token/Supabase prima di WhatsApp.

## v5.138 / Pre-invio solo livello 0.5

- Il bottone rapido "Pronti 0.5 da inviare" mostra e preseleziona solo soci con livello attuale 0.5.
- Aggiornati conteggi e testo del Pre-invio per rendere esplicita la routine dedicata ai nuovi soci da autovalutare.

## v5.137 / Fix scroll lista Pre-invio

- Ripristinato lo scroll interno della lista "Controlla" nel Pre-invio quando sono selezionati fino a 10 soci pronti.
- Mantenuta fissa l'intestazione con conteggio risultati/selezionati durante lo scroll.

## v5.136 / Layout admin Autovalutazioni

- Resa più compatta e leggibile la sezione interna Autovalutazioni.
- Allineato il comando "Aggiorna risposte" nell'header del box Post-invio.
- Ridotto l'ingombro di pannelli, righe, filtri e azioni nei flussi Pre-invio, Post-invio e Archivio.

## v5.135 / Autovalutazioni app interna

- Validata la sezione interna Autovalutazioni: Pre-invio, Post-invio, Archivio, Token e Supabase.
- Il link laterale Token e Supabase apre direttamente gli strumenti tecnici avanzati.
- Nel Post-invio una risposta già applicata non mostra più l'azione Applica come se fosse ancora da lavorare.
- L'applicazione del livello salva origine, data, token, coerenza e disponibilità nella scheda giocatore.
- L'Archivio mostra storico token/invii e risposte ricevute anche dopo la preparazione di una nuova autovalutazione.
- Il payload pubblico include anche i campi disponibilità top-level per il fallback diretto su Supabase.
- Reso più robusto l'RPC Supabase quando `submitted_at` arriva vuoto.

## v5.134 / Scheda Autovalutazione

- Validata la scheda pubblica di autovalutazione compilata dal socio.
- Allineato il calcolo tecnico alle risposte reali del modulo pubblico.
- Reso configurabile il link pubblico generato per WhatsApp.
- Corretti i rientri interni verso Pre-invio e Archivio.
- Aggiornato lo schema Supabase con RPC, campi risposta, disponibilità e PIN staff.

## v5.133

- Versione base corrente importata come nuovo punto stabile di lavoro.
- Da questa versione si lavora per sezioni autonome tramite branch dedicate.
- Ogni sezione validata viene consolidata su `main` prima di aprire la sezione successiva.

## v5.10.1

- Archivio storico prenotazioni cumulativo.
- Conservazione automatica solo degli ultimi 12 mesi di storico.
- Import clienti e prenotazioni manuale da Matchpoint.
- Backup e ripristino dati locali.
- Gestione soci e schede socio.
- Analisi slot vuoti.
- Creazione partita e contatti giocatori.

## Prossima area di sviluppo: v5.11 / Autovalutazione Livelli

Obiettivo:

- individuare soci con livello 0,5;
- generare link personale di autovalutazione;
- inviare messaggio WhatsApp;
- ricevere risposte online;
- proporre livello operativo;
- permettere conferma staff prima di applicare il livello.
