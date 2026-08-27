/* conoscenza.js — IL CANCELLO, in JavaScript e per una ragione precisa.
 *
 * 🚨 Perché un `.js` accanto a un `.ts`, e non un blocco dentro `index.ts`: questo codice è
 * JavaScript vero, ed è **letto ed eseguito dal banco** (`test/assessment-quiz.test.mjs` e
 * `test/autovalutazione-conoscenza.test.mjs`) che lo estrae e lo fa girare in una VM. Metterlo
 * dentro un file `.ts` significava una di due bugie: o aggiungere annotazioni di tipo e rompere
 * il banco, o lasciarlo senza e far fallire `deno check` — che è **esattamente quello che è
 * successo**: 36 errori `TS7006` sulla prima PR verso `main`, presi dalla CI.
 * ⇒ Separarlo non è un modo per zittire il controllo: Deno non type-checka un `.js` importato,
 *   e questo file dichiara con la sua estensione ciò che è sempre stato.
 *
 * ⭐ Dentro ci sta TUTTO ciò che decide un livello e un esito: la banca delle domande con le
 * risposte, la pescata, la correzione, la scala FITP/TPRA e il calcolo del livello. Fino al
 * 14/08/2026 stava in `index.html`, cioè nel file che si scarica per fare il test.
 * 🔗 Le sentinelle ASSESS-KNOWLEDGE SHARED sono i due estremi che il banco cerca: non si
 * toccano, e non si mette codice fra loro che non appartenga al cancello.
 */

/* 🔢 DA STRINGA A NUMERO, o NIENTE — 14/08, quarto giro.
   `calculateAssessmentPublicLevel` restituisce i livelli come STRINGHE, e quando un dato non
   c'è restituisce STRINGA VUOTA: con una scheda normalissima `balanced_level` valeva `""`.
   Passata a una colonna `numeric` diventa `invalid input syntax for type numeric: ""`, e
   l'INTERA scheda non si salva — per un campo secondario.
   ⚖️ Il vuoto NON è zero e non è un errore: è «non lo sappiamo», e in colonna numerica si
   scrive `null`. È la stessa regola già scritta in `pmoLivelloFascia` per il livello del
   socio; qui mancava perché avevo curato solo `raw_score`, l'unico che avevo visto vuoto.
   ⚙️ Senza annotazioni di tipo di proposito, come le funzioni del seme: così il banco la
   esegue davvero invece di limitarsi a constatare che c'è. */
export function numero(v) {
  const t = String(v ?? '').trim();
  if (!t) return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/* ===== ASSESS-KNOWLEDGE SHARED v1 ====================================================
   ⭐ Blocco autonomo: nessun DOM, nessuna dipendenza. Fino al 14/08/2026 viveva in
   `index.html` — cioè nel file che si scarica per fare il test, risposte comprese. Da qui
   in poi vive SOLO qui, ed è la ragione stessa di questa funzione.
   ⚠️ Il commento che stava in app diceva «vive identico in tre posti: qui, nell'emulatore e
   dalla Fase 2 nel bot». Era vecchio: la Fase 2 è abbandonata dal 22/07 e l'emulatore
   pubblicato quelle domande non le ha mai avute (misurato il 12/08). Il posto è UNO.
   🔗 `test/autovalutazione-conoscenza.test.mjs` estrae il blocco da QUI, fra queste due
   sentinelle, e lo esegue: la rete di regressione prova il sorgente vero, non una copia.
   ===================================================================================== */
// Due aiutini locali: il blocco non usa NIENTE dell'app, così la copia nell'emulatore e
// quella nel bot sono identiche a questa riga per riga (l'emulatore non ha cleanCell).
export function assessTxt(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}
export function assessKey(value) {
  return assessTxt(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
export const PMO_LIVELLI = [
  { min: 0.5, max: 1.5, definizione: 'Principiante',   colpi: 'colpi piatti, servizio base',            descrizione: 'Sta imparando a non colpire i vetri. Lo scambio è breve o inesistente.' },
  { min: 2.0, max: 2.5, definizione: 'Base',           colpi: 'inizio uso pareti, volée di posizione',  descrizione: 'Tiene la palla in campo a ritmi bassi. Capisce il rimbalzo sul vetro ma fatica a coordinarsi.' },
  { min: 3.0, max: 3.5, definizione: 'Intermedio',     colpi: 'bandeja base, pallonetto',               descrizione: 'Inizia a giocare con strategia. La bandeja serve a non perdere la rete, il pallonetto è spesso corto.' },
  { min: 4.0, max: 4.5, definizione: 'Avanzato',       colpi: 'vibora, chiquita, smash',                descrizione: 'Livello tipico dei tornei amatoriali. Sa variare gli effetti e usa bene pareti e griglia.' },
  { min: 5.0, max: 5.5, definizione: 'Agonista',       colpi: 'x3 / x4, controparete',                  descrizione: 'Giocatore di 3ª/4ª categoria. Grande intensità, chiude il punto fuori campo e gestisce difese difficili.' },
  { min: 6.0, max: 6.5, definizione: 'Semi-Pro',       colpi: 'dormilona, colpi in sospensione',        descrizione: 'Giocatore di 2ª categoria. Tecnica impeccabile e lettura del gioco in anticipo.' },
  { min: 7.0, max: 7.0, definizione: 'Professionista', colpi: 'massima padronanza di ogni colpo',       descrizione: 'Prima categoria e circuito internazionale. Errore gratuito quasi assente.' }
];

// Numero → riga della tabella. Fuori scala si aggancia agli estremi: nessun livello resta senza nome.
export function pmoLivelloFascia(value) {
  // 🚨 Il vuoto NON è zero: `Number('')` fa 0, e chi non ha ancora un livello si sarebbe
  // visto chiamare «Principiante» da nessun dato. Senza numero non c'è fascia.
  const raw = assessTxt(value).replace(',', '.');
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return PMO_LIVELLI.find(f => n <= f.max) || PMO_LIVELLI[PMO_LIVELLI.length - 1];
}
export function pmoLivelloDefinizione(value) {
  return pmoLivelloFascia(value)?.definizione || '';
}
export const ASSESS_KNOWLEDGE_BANK = {
  version: 1,
  /* 🔄🗣️⭐⭐ 27/08/2026, secondo giro — LA PESCATA PASSA A 2+3 E LA SOGLIA A 4 SU 5, su sua
     delega esplicita: *«se ne può sbagliare una su cinque»*, e poi *«decidi tu, tenendo conto
     che il test deve risultare il più difficile da ricordare e soprattutto da azzeccare per i
     livelli da principiante a intermedio»*.
     ⚖️ La sua regola «una sbagliata su cinque» NON conviveva con `trap_wrong_fails` (una
     trabocchetto sbagliata bocciava da sola, quindi «una qualunque» era falsa): si è scelta la
     SUA — l'errore concesso è UNO, e vale su qualunque domanda, trabocchetto compresa. Chi
     crede a DUE colpi inventati resta fuori comunque.
     🔄 E I MARGINI MORBIDI DI BASE DEL 9/08 SONO STATI TOLTI, non ammorbiditi: quella regola
     nasceva per non punire l'ignoranza di chi si dichiara basso, ma la sua parola di oggi —
     «il più difficile da azzeccare per i livelli da principiante a intermedio» — dice il
     contrario, e la riga vecchia si corregge invece di conviverci. Rifare il test è gratis
     (attesa zero): la severità costa un riprovare, non una porta chiusa.
     ⛔ Principiante resta SENZA quiz (regola del 9/08, non toccata): chi si dichiara al minimo
     della scala non guadagna niente mentendo. */
  pick_normal: 2,
  pick_trap: 3,
  pass_min_correct: 4,     // su 5 pescate: una sbagliata qualunque è concessa, la seconda boccia
  trap_wrong_fails: false, // sostituita dalla soglia: «una su cinque» vale anche su una trabocchetto
  /* 🆕🗣️⭐⭐ 9/08/2026 — IL CANCELLO NON È UGUALE PER TUTTE LE FASCE (variante «B», sua scelta).
     Nato da una sua domanda, fatta dopo essere stato bocciato 2/4 dalla fascia più bassa:
     *«se sono un principiante è facile che io sbagli le trappole… come risolviamo in maniera
     che se sono principiante o base posso avere un tasso di errore più importante?»*

     ⭐⭐ La ragione che decide la forma, e vale più della tabella: **il cancello esiste per
     fermare chi si SOPRAVVALUTA.** Chi dichiara Principiante prende 1.5, cioè il minimo
     della scala: non sta togliendo niente a nessuno. Là il cancello **costa e non rende** —
     e manda alla porta proprio l'81% dei soci che il test deve far entrare.
     ⇒ Sotto non si sbarra: si sbarra dove c'è qualcosa da guadagnare mentendo.

     🚨 E la TRAPPOLA ha la stessa asimmetria: smaschera chi dichiara alto e non lo è. Un
     principiante che crede esista un colpo inventato non sta barando — sta dicendo la
     verità su di sé, cioè che è principiante. Farlo bocciare da quella è punire l'ignoranza
     che il livello «Principiante» già dichiara.

     📏 E c'era un difetto di margine, misurato sul caso vero: con 4 domande e soglia 3,
     **una distrazione sola boccia**, e la pena è 30 giorni d'attesa. */
  regole_fascia: {
    /* 🔄🗣️⭐⭐ 27/08/2026 sera — LE DOMANDE DI PRINCIPIANTE SI SBLOCCANO. Sua decisione:
       *«direi di sbloccare le domande della banca per principiante»*. Qui c'era
       `Principiante: { cancello: false }`, la regola del 9/08: quella fascia il quiz non lo
       vedeva proprio, e le sue **36 domande** (9 trabocchetto) stavano nella banca senza che
       nessuno le pescasse mai.

       🚨⭐⭐ MA IL CANCELLO NON SBARRA, e questa è la metà che tiene in piedi la sua regola —
       sue parole di stasera: *«uno che fa il test per la prima volta ed è livello 0,5 e mi
       sbaglia 4 risposte su cinque: non va principiante? Io direi che principiante mi può
       sbagliare quattro risposte su cinque»*. ⇒ `pass_min_correct: 0`.
       ⚖️ E non è una soglia timida: è l'unica **possibile**. `Principiante` va da 0,5 a 1,5
       (`PMO_LIVELLI`) ⇒ sotto non c'è nessuna fascia dove mandare un bocciato, e il gradino
       (`gradinoOfferto`) su una bocciatura offre proprio la fascia **sotto** la dichiarata.
       Bocciare qui vorrebbe dire lasciare il socio **senza niente** — cioè fuori dalle
       partite, ed è il caso dei 2.281 soci fermi a 0,5, l'81% del circolo.
       📌 *Una domanda si può fare senza che la risposta sbagliata costi qualcosa: quello che
       il cancello di Principiante misura è com'è andata, non chi passa.*

       ⭐ COSA CAMBIA DAVVERO, e vale la pena averlo fatto: il test di quella fascia **esiste**
       (13 domande come per tutti, non 8), l'esito che il bot annuncia torna a essere un
       «superato» **vero** invece di una parola detta su zero domande, e la scheda porta allo
       staff il conteggio delle risposte di chi prima non ne aveva nessuna.
       ⚠️ `senza_cancello` resta nel codice e nei dati: le schede di prima ce l'hanno, il bot
       lo legge, e la regola generale — una fascia può non avere cancello — non è stata tolta,
       è solo che oggi nessuna fascia bassa la usa. Chi la togliesse renderebbe illeggibili le
       schede vecchie.

       🔄 E QUI C'ERA ANCHE `Base: { pass_min_correct: 2, trap_wrong_fails: false }`, i margini
       morbidi del 9/08. TOLTI su sua delega («il più difficile da azzeccare per i livelli da
       principiante a intermedio»): Base gioca con la regola di tutti — 4 su 5, una sbagliata
       concessa. Le righe si correggono, non si affiancano. */
    Principiante: { pass_min_correct: 0 },
  },
  questions: [
    // ── Principiante ────────────────────────────────────────────────────────────────
    { id:'P-01', fascia:'Principiante', trap:false, q:'Quanti giocatori ci sono in campo in una partita di padel?', opts:[
      'Due, uno per parte',
      'Quattro, due per parte',
      'Sei, tre per parte',
      'Dipende dal circolo'], correct:1 },
    { id:'P-02', fascia:'Principiante', trap:false, q:'Come si esegue il servizio?', opts:[
      'Si lancia in aria, come nel tennis',
      'Al volo, senza rimbalzo',
      'Rimbalzo a terra, sotto la vita',
      'Al volo o dopo il rimbalzo, a scelta'], correct:2 },
    { id:'P-03', fascia:'Principiante', trap:false, q:'La palla arriva dagli avversari e colpisce il vetro del mio campo SENZA aver prima rimbalzato a terra. Cosa succede?', opts:[
      'Punto mio: doveva rimbalzare',
      'Punto degli avversari',
      'Si rigioca il punto',
      'Il gioco continua, posso giocarla'], correct:0 },
    { id:'P-04', fascia:'Principiante', trap:false, q:'Come si conta il punteggio nel padel?', opts:[
      'Un punto per scambio, fino a 11',
      'A tempo: vince chi è avanti',
      'A punti fino a 21',
      'Come nel tennis: 15, 30, 40, gioco'], correct:3 },
    { id:'P-T1', fascia:'Principiante', trap:true,  q:'Quando si applica la regola del «doppio rimbalzo difensivo», che concede due rimbalzi a terra a chi difende?', opts:[
      'Solo sul punteggio di 40-40',
      'Non esiste: un solo rimbalzo',
      'Se si è sotto di due giochi',
      'Solo sulla risposta al servizio'], correct:1 },
    { id:'P-T2', fascia:'Principiante', trap:true,  q:'In quale situazione l\'arbitro fischia il «fallo di vetro incrociato»?', opts:[
      'Se tocca due vetri di seguito',
      'Se torna nel campo di chi ha colpito',
      'Non esiste un fallo con questo nome',
      'Se si colpisce dopo il vetro'], correct:2 },

    // ── Base ────────────────────────────────────────────────────────────────────────
    { id:'B-01', fascia:'Base', trap:false, q:'Dove deve rimbalzare la palla del servizio?', opts:[
      'In qualunque punto del campo',
      'Nel riquadro in diagonale',
      'Oltre la linea di metà campo',
      'Vicino al vetro di fondo'], correct:1 },
    { id:'B-02', fascia:'Base', trap:false, q:'Chi riceve il servizio può rispondere al volo?', opts:[
      'Sì, se resta dietro la linea',
      'Sì, sempre: sceglie chi riceve',
      'No, deve prima far rimbalzare',
      'Solo sul secondo servizio'], correct:2 },
    { id:'B-03', fascia:'Base', trap:false, q:'La palla rimbalza a terra nel mio campo e poi va sul mio vetro. Posso giocarla dopo il vetro?', opts:[
      'Sì: dopo il rimbalzo, di vetro',
      'No: prima che tocchi il vetro',
      'No: punto degli avversari',
      'Sì, ma solo sul vetro di fondo'], correct:0 },
    { id:'B-04', fascia:'Base', trap:false, q:'Quanti tentativi di servizio hai a disposizione?', opts:[
      'Uno solo',
      'Due, come nel tennis',
      'Tre',
      'Due, ma solo nel primo gioco'], correct:1 },
    { id:'B-T1', fascia:'Base', trap:true,  q:'Quando è consentito il «servizio a cucchiaio doppio», che permette di far rimbalzare la palla due volte prima di batterla?', opts:[
      'Solo in doppio misto',
      'Dopo un primo servizio fallito',
      'Mai: non esiste questo servizio',
      'Nei tornei, se sono d\'accordo'], correct:2 },
    { id:'B-T2', fascia:'Base', trap:true,  q:'Dopo aver vinto un punto con lo smash, la coppia deve cambiare lato di ricezione. Quando vale questa regola?', opts:[
      'Sempre, in ogni categoria',
      'Solo nei tornei federali',
      'Solo nel set decisivo',
      'Mai: questa regola non esiste'], correct:3 },

    // ── Intermedio ──────────────────────────────────────────────────────────────────
    { id:'I-01', fascia:'Intermedio', trap:false, q:'A cosa serve soprattutto la bandeja?', opts:[
      'A chiudere il punto con potenza',
      'A restare a rete sul pallonetto',
      'A difendere sul vetro di fondo',
      'A rispondere al servizio'], correct:1 },
    { id:'I-02', fascia:'Intermedio', trap:false, q:'Perché un pallonetto troppo corto è pericoloso?', opts:[
      'Perché è quasi sempre fuori',
      'Il compagno non fa in tempo',
      'Regala uno smash comodo',
      'Non si può giocare di rovescio'], correct:2 },
    { id:'I-05', fascia:'Intermedio', trap:false, q:'In uno scambio, quale coppia si trova in vantaggio?', opts:[
      'Quella a fondo campo: più tempo',
      'Quella a rete: da lì si chiude',
      'Nessuna: la posizione non conta',
      'Chi ha vinto il punto prima'], correct:1 },
    { id:'I-04', fascia:'Intermedio', trap:false, q:'Quando conviene salire a rete in coppia?', opts:[
      'Appena possibile, sempre e comunque',
      'Uno alla volta, l\'altro copre',
      'Solo dopo aver vinto lo scambio',
      'Insieme, dopo un colpo che dà tempo'], correct:3 },
    { id:'I-T1', fascia:'Intermedio', trap:true,  q:'A cosa serve la «vibora a doppio taglio inverso»?', opts:[
      'A far tornare la palla indietro',
      'A servire con effetto contrario',
      'Non esiste un colpo con questo nome',
      'A difendere sul vetro laterale'], correct:2 },
    { id:'I-T2', fascia:'Intermedio', trap:true,  q:'Cosa stabilisce la «regola dei tre vetri», sul numero di pareti che la palla può toccare nel proprio campo?', opts:[
      'Che se ne toccano al massimo tre',
      'Che dopo tre vetri si rigioca',
      'Che valgono solo nei campi coperti',
      'Non esiste: mai due rimbalzi a terra'], correct:3 },

    // ── Avanzato ────────────────────────────────────────────────────────────────────
    { id:'A-01', fascia:'Avanzato', trap:false, q:'Che colpo è la vibora?', opts:[
      'Colpo alto tagliato, resta basso',
      'Un pallonetto molto profondo',
      'Una volée bassa giocata incrociata',
      'Uno smash a massima potenza'], correct:0 },
    { id:'A-02', fascia:'Avanzato', trap:false, q:'Che colpo è la chiquita?', opts:[
      'Un pallonetto corto sul rovescio',
      'Palla bassa e lenta sui piedi',
      'Un servizio tagliato verso il vetro',
      'Uno smash che non fa uscire'], correct:1 },
    { id:'A-03', fascia:'Avanzato', trap:false, q:'Quando si gioca la bajada?', opts:[
      'A rete, su una volée alta',
      'Come variante del servizio',
      'Sulla palla in uscita dal vetro',
      'Solo in difesa, dopo un globo'], correct:2 },
    { id:'A-04', fascia:'Avanzato', trap:false, q:'Gli avversari giocano pallonetti molto buoni. Qual è la gestione più solida dei colpi alti?', opts:[
      'Smash a tutta forza a ogni occasione',
      'Rimbalzare e ripartire da fondo',
      'Cambiare lato a ogni pallonetto',
      'Alternare bandeja e vibora'], correct:3 },
    { id:'A-T1', fascia:'Avanzato', trap:true,  q:'In quale situazione si usa il «cambio de pared australiano»?', opts:[
      'Quando si difende sul vetro laterale',
      'Non esiste un colpo con questo nome',
      'Quando si risponde a una vibora',
      'Quando si attacca sul doppio vetro'], correct:1 },
    { id:'A-T2', fascia:'Avanzato', trap:true,  q:'Come si esegue la «sotana in sospensione»?', opts:[
      'Saltando e colpendo sotto la vita',
      'Dopo due rimbalzi sul vetro',
      'Con la racchetta rovesciata',
      'Non esiste un colpo con questo nome'], correct:3 },

    // ── Agonista ────────────────────────────────────────────────────────────────────
    { id:'AG-01', fascia:'Agonista', trap:false, q:'Che cos\'è lo smash «x4»?', opts:[
      'Smash che fa uscire dal fondo',
      'Smash che esce dalla porta',
      'Smash dopo quattro colpi',
      'Uno smash che rimbalza quattro volte'], correct:0 },
    { id:'AG-02', fascia:'Agonista', trap:false, q:'Che cos\'è la controparete?', opts:[
      'Volée appoggiata al vetro',
      'Palla mandata sul proprio vetro',
      'Pallonetto che muore sul fondo',
      'Servizio che tocca la parete'], correct:1 },
    { id:'AG-03', fascia:'Agonista', trap:false, q:'Lo smash manda la palla fuori dal campo e l\'avversario esce dalla porta e la rimette dentro. Cosa succede?', opts:[
      'Punto nostro: fuori non si gioca',
      'Punto nostro se ha passato il vetro',
      'Si rigioca il punto',
      'Il punto continua: è valido'], correct:3 },
    { id:'AG-04', fascia:'Agonista', trap:false, q:'Sul servizio, la palla rimbalza nel riquadro giusto e poi tocca la rete metallica prima che il ricevente la colpisca. Cosa succede?', opts:[
      'Il gioco continua normalmente',
      'È fallo di servizio',
      'Punto diretto di chi serve',
      'Si ripete, come il nastro a tennis'], correct:1 },
    { id:'AG-T1', fascia:'Agonista', trap:true,  q:'Quando si parla di smash «x5»?', opts:[
      'Se la palla esce oltre la tribuna',
      'Se rimbalza cinque metri fuori',
      'Non esiste: si parla di x3 e x4',
      'Se chiude il punto al quinto colpo'], correct:2 },
    { id:'AG-T2', fascia:'Agonista', trap:true,  q:'Cosa prevede la regola del «punto d\'oro obbligatorio dopo tre vantaggi»?', opts:[
      'Il gioco va a chi serve',
      'Si gioca un punto secco',
      'Che vale solo nei tornei federali',
      'Non esiste: si gioca sul 40-40'], correct:3 },

    /* 🆕📚⭐⭐ 9/08/2026 — LA BANCA SI ALLARGA A 8 NORMALI + 3 TRAPPOLE PER FASCIA.
       Sua decisione, e il motivo sta tutto nella regola dei TRE TENTATIVI decisa la stessa
       sera: con 4 normali e 2 trappole se ne pescavano 3+1, quindi in tre giri uno vedeva
       QUASI TUTTA la banca. Senza sapere quali aveva sbagliato non era un indovinello, ma i
       tre tentativi non erano indipendenti: il terzo valeva meno del primo.
       🚨 Sigle NUOVE, mai riciclate (la I-03 ritirata resta un buco): le schede già inviate
       portano gli id dentro \'raw_response\', e riusare una sigla farebbe puntare uno storico
       a una domanda diversa.
       ⛔ Principiante NON si allarga: da stasera quella fascia il quiz non lo pesca più.
       ⭐⭐ Il metro di ogni domanda è uno solo, e viene dal difetto della vecchia I-03 (tolta
       perché «dipende da quanto è veloce»): **una risposta discutibile boccia chi ha
       ragione**. Qui dentro ci sono solo regole e definizioni su cui non si discute. */

    // ── Base ────────────────────────────────────────────────────────────────────────
    { id:'B-05', fascia:'Base', trap:false, q:'Come si colpisce la palla nel servizio?', opts:[
      'Dopo il rimbalzo, sotto la vita',
      'Al volo, sopra la testa',
      'Dopo due rimbalzi a terra',
      'Come si preferisce'], correct:0 },
    { id:'B-06', fascia:'Base', trap:false, q:'Nel servizio la palla tocca il nastro della rete e poi rimbalza nel riquadro giusto. Cosa succede?', opts:[
      'Punto diretto di chi serve',
      'È fallo e si perde il servizio',
      'Il servizio si ripete',
      'Il gioco continua normalmente'], correct:2 },
    { id:'B-07', fascia:'Base', trap:false, q:'Posso toccare la rete con la racchetta o col corpo mentre la palla è in gioco?', opts:[
      'Sì, purché non la sposti',
      'No: si perde il punto',
      'Sì, se la palla ha già rimbalzato',
      'Solo chi è al servizio non può'], correct:1 },
    { id:'B-08', fascia:'Base', trap:false, q:'Quante volte può rimbalzare a terra la palla nel mio campo prima che io la colpisca?', opts:[
      'Una sola',
      'Due',
      'Nessuna: va giocata al volo',
      'Due, se la seconda è dopo il vetro'], correct:0 },
    { id:'B-T3', fascia:'Base', trap:true,  q:'Quando è obbligatorio il «doppio servizio incrociato»?', opts:[
      'Nel primo game di ogni set',
      'Quando si gioca il punto d\'oro',
      'Non esiste questo servizio',
      'Dopo due game persi di fila'], correct:2 },

    // ── Intermedio ──────────────────────────────────────────────────────────────────
    { id:'I-06', fascia:'Intermedio', trap:false, q:'Che cos\'è il pallonetto (globo)?', opts:[
      'Palla alta e profonda',
      'Un colpo piatto e veloce lungolinea',
      'Palla corta oltre la rete',
      'Un servizio giocato molto lento'], correct:0 },
    { id:'I-07', fascia:'Intermedio', trap:false, q:'Finito un game al servizio, chi serve nel game successivo?', opts:[
      'Il compagno di chi ha appena servito',
      'Uno dei due avversari',
      'Sempre lo stesso, fino al game perso',
      'Chi ha vinto il game precedente'], correct:1 },
    { id:'I-08', fascia:'Intermedio', trap:false, q:'Che cos\'è la «salida de pared» (uscita di parete)?', opts:[
      'Servizio che usa il vetro laterale',
      'La palla che esce dal vetro',
      'L\'uscita del giocatore dalla porta',
      'Colpo contro la parete avversaria'], correct:1 },
    { id:'I-09', fascia:'Intermedio', trap:false, q:'Dopo il rimbalzo a terra nel mio campo la palla tocca la griglia metallica. Posso ancora giocarla?', opts:[
      'No: la griglia chiude il punto',
      'Sì, se non rimbalza due volte',
      'Solo se la tocca sopra la metà',
      'Sì, ma vale mezzo punto'], correct:1 },
    { id:'I-T3', fascia:'Intermedio', trap:true,  q:'Quando si usa il «rimbalzo assistito di parete»?', opts:[
      'Per difendere gli smash profondi',
      'Se la palla resta incastrata',
      'Non esiste questa regola',
      'Solo con pareti in muratura'], correct:2 },

    // ── Avanzato ────────────────────────────────────────────────────────────────────
    { id:'A-05', fascia:'Avanzato', trap:false, q:'Un pallonetto profondo finisce sul vetro di fondo del mio campo. Come si gioca correttamente?', opts:[
      'Prima che tocchi il vetro',
      'Dopo il rimbalzo, in uscita',
      'Lasciandola rimbalzare due volte',
      'Solo al volo, prima del rimbalzo'], correct:1 },
    { id:'A-06', fascia:'Avanzato', trap:false, q:'Che differenza c\'è fra bandeja e vibora?', opts:[
      'Nessuna: sono lo stesso colpo',
      'Bandeja rovescio, vibora dritto',
      'La vibora è più veloce e tagliata',
      'La bandeja solo in difesa'], correct:2 },
    { id:'A-07', fascia:'Avanzato', trap:false, q:'Durante lo scambio la palla colpisce un giocatore prima di rimbalzare a terra. Cosa succede?', opts:[
      'Si rigioca il punto',
      'Punto per chi ha colpito',
      'Punto per chi è stato colpito',
      'Continua se resta in campo'], correct:1 },
    { id:'A-08', fascia:'Avanzato', trap:false, q:'La palla che ho colpito tocca la parete del campo avversario PRIMA di rimbalzare a terra. Cosa succede?', opts:[
      'Il punto continua normalmente',
      'Punto loro: doveva rimbalzare',
      'Punto mio, se è il vetro di fondo',
      'Si rigioca il punto'], correct:1 },
    { id:'A-T3', fascia:'Avanzato', trap:true,  q:'In quale situazione si concede il «recupero di parete doppia»?', opts:[
      'Se tocca due pareti prima del suolo',
      'Se il campo ha tre lati in vetro',
      'Solo in difesa, dopo uno smash x4',
      'Non esiste questa regola'], correct:3 },

    // ── Agonista ────────────────────────────────────────────────────────────────────
    { id:'AG-05', fascia:'Agonista', trap:false, q:'Che cos\'è la «dormilona»?', opts:[
      'Smash smorzato che muore a rete',
      'Pallonetto con effetto indietro',
      'Una difesa lenta per prendere tempo',
      'Un servizio giocato senza effetto'], correct:0 },
    { id:'AG-06', fascia:'Agonista', trap:false, q:'Nel punto d\'oro, chi sceglie da che lato ricevere?', opts:[
      'La coppia che serve',
      'La coppia che riceve',
      'L\'arbitro, o il sorteggio',
      'Si gioca sempre dal lato destro'], correct:1 },
    { id:'AG-07', fascia:'Agonista', trap:false, q:'Un giocatore colpisce la palla due volte nello stesso colpo. Cosa succede?', opts:[
      'Continua, se è involontario',
      'Punto per gli avversari',
      'Si rigioca il punto',
      'Vale, purché la palla passi la rete'], correct:1 },
    { id:'AG-08', fascia:'Agonista', trap:false, q:'Nel tie-break, ogni quanti punti si cambia campo?', opts:[
      'Ogni 4 punti',
      'Ogni 6 punti',
      'Solo a metà, sul 6-6',
      'Non si cambia campo nel tie-break'], correct:1 },
    { id:'AG-T3', fascia:'Agonista', trap:true,  q:'Quando si applica la «regola del doppio rimbalzo consentito in difesa»?', opts:[
      'Se la palla arriva da uno smash x4',
      'Quando il campo è bagnato',
      'Solo nel padel indoor',
      'Non esiste: due rimbalzi mai'], correct:3 },

    /* 🆕📚⭐⭐ 25/08/2026 — PRINCIPIANTE SI ALLARGA A 27 NORMALI + 9 TRAPPOLE.
       Sua decisione di stamattina, presa insieme alle altre tre del disegno nuovo: il quiz
       vale ANCHE per i Principianti, e la banca di ogni fascia arriva a 27+9 così che in una
       giornata di tre prove un socio ne veda al massimo un terzo.
       📏 Il conto che l'ha resa necessaria: 3 prove × 4 domande = 12 viste contro le 11 che
       esistevano ⇒ in un giorno solo si vedeva la banca intera, trappole comprese.

       🔄⭐⭐ 27/08/2026 sera — QUESTE DOMANDE SONO IN SERVIZIO, e qui c'era il contrario.
       La riga vecchia diceva: *«non sono ancora in servizio, ed è deliberato… si accende in un
       secondo momento, quando le domande saranno state corrette da lui — accenderla prima
       vorrebbe dire mandare in servizio un cancello che nessuno ha letto»*.
       🗣️ Sua decisione di stasera: *«direi di sbloccare le domande della banca per
       principiante»*.
       ⚖️ **E la ragione della riga vecchia è caduta insieme al cancello, non nonostante lui.**
       Quel timore era di mandare in servizio un CANCELLO non letto — cioè di far **bocciare**
       qualcuno con una domanda sbagliata. Con `pass_min_correct: 0` non si boccia più nessuno
       a questa fascia: una domanda storta costa una lettura, non un livello negato.
       🚨 **Quello che resta vero, e va detto invece di essere taciuto**: le 36 domande di
       Principiante **lui non le ha ancora rilette**, e da stasera i soci le leggono. È un
       rischio di FORMA (una domanda poco chiara), non più di esito. Se una risulta ambigua si
       corregge qui, e nessuna scheda già consegnata cambia esito — perché nessuna può fallire.

       ⭐⭐ IL METRO, e per Principiante è DIVERSO dalle altre fasce. Sua definizione del
       25/08: *«per me un principiante è colui veramente alle prime armi»* ⇒ qui la domanda
       vera non è «sai la tattica», è **«hai mai visto una partita di padel?»**. Perciò le
       trappole di questa fascia non sono (solo) regole inventate: sono i punti in cui
       l'INTUITO DEL TENNIS porta fuori strada — il servizio dall'alto, il vetro che sembra
       fuori, la palla che esce dal campo e si può ancora rincorrere. Chi non ha mai giocato
       risponde col tennis, ed è esattamente ciò che va misurato.
       ⚖️ Resta il metro di tutte le altre (9/08): **una risposta discutibile boccia chi ha
       ragione** ⇒ qui dentro solo regole su cui non si discute, mai «dipende».

       🚨 Sigle NUOVE, mai riciclate: le schede già inviate portano gli id dentro
       `raw_response`, e riusare una sigla farebbe puntare uno storico a una domanda diversa. */

    // ── Principiante — le regole che si vedono guardando una partita ────────────────
    { id:'P-05', fascia:'Principiante', trap:false, q:'La palla ha rimbalzato a terra nel mio campo e poi è finita contro il vetro di fondo. Posso ancora giocarla?', opts:[
      'No: il punto è degli avversari',
      'Sì: dopo il rimbalzo, di parete',
      'Solo sul vetro laterale',
      'Sì, ma il punto vale la metà'], correct:1 },
    { id:'P-06', fascia:'Principiante', trap:false, q:'Il mio compagno serve. Chi riceve può rispondere al volo, prima che la palla rimbalzi?', opts:[
      'Sì, se è abbastanza veloce',
      'No: si gioca dopo il rimbalzo',
      'Sì, ma solo sul secondo servizio',
      'Solo se sta già a rete'], correct:1 },
    { id:'P-07', fascia:'Principiante', trap:false, q:'Com\'è fatta la racchetta da padel?', opts:[
      'Con le corde, ma più piccola',
      'Piena e forata, senza corde',
      'Di legno pieno, senza fori',
      'Con le corde solo nella parte alta'], correct:1 },
    { id:'P-08', fascia:'Principiante', trap:false, q:'Quanti servizi ha a disposizione chi batte?', opts:[
      'Uno solo',
      'Due, come nel tennis',
      'Tre',
      'Illimitati, finché non entra'], correct:1 },
    { id:'P-09', fascia:'Principiante', trap:false, q:'Dove deve rimbalzare il servizio?', opts:[
      'In un punto qualsiasi del campo',
      'In diagonale, nel quadrato giusto',
      'Dritto davanti a sé',
      'Oltre la linea di fondo avversaria'], correct:1 },
    { id:'P-10', fascia:'Principiante', trap:false, q:'Durante lo scambio la palla colpisce il mio compagno sul corpo. Cosa succede?', opts:[
      'Punto degli avversari',
      'Si rigioca il punto',
      'Niente: il gioco continua',
      'Punto nostro, se non è voluto'], correct:0 },
    { id:'P-11', fascia:'Principiante', trap:false, q:'Rimando la palla e questa colpisce PRIMA il vetro del mio campo, poi passa dall\'altra parte. È valido?', opts:[
      'Sì, se poi entra nel campo',
      'No: punto degli avversari',
      'Sì, ma solo con il vetro di fondo',
      'Si rigioca il punto'], correct:1 },
    { id:'P-12', fascia:'Principiante', trap:false, q:'Il servizio tocca il nastro della rete e poi rimbalza regolarmente nel quadrato giusto. Cosa succede?', opts:[
      'È fallo: si passa al secondo',
      'Il servizio si ripete',
      'Il gioco continua normalmente',
      'Punto per chi serve'], correct:1 },
    { id:'P-13', fascia:'Principiante', trap:false, q:'Come finisce una partita di padel?', opts:[
      'A tempo: 60 minuti',
      'Al meglio dei tre set',
      'Quando una coppia arriva a 21 punti',
      'Dopo un numero fisso di scambi'], correct:1 },
    { id:'P-14', fascia:'Principiante', trap:false, q:'Da dove batte chi serve?', opts:[
      'Da dietro la linea di fondo',
      'Dietro la linea, dopo il rimbalzo',
      'Da un punto qualsiasi del campo',
      'Da vicino alla rete'], correct:1 },
    { id:'P-15', fascia:'Principiante', trap:false, q:'Posso colpire la palla al volo, prima che rimbalzi?', opts:[
      'No, mai: deve rimbalzare',
      'Sì, tranne sulla risposta',
      'Sì, sempre, senza nessuna eccezione',
      'Solo se sto a rete'], correct:1 },
    { id:'P-16', fascia:'Principiante', trap:false, q:'Da cosa è chiuso il campo da padel?', opts:[
      'Da niente: è aperto',
      'Da vetri e reti, su tutti i lati',
      'Solo da due pareti di fondo',
      'Da una recinzione bassa'], correct:1 },
    { id:'P-17', fascia:'Principiante', trap:false, q:'Durante lo scambio tocco la rete con la racchetta. Cosa succede?', opts:[
      'Punto degli avversari',
      'Niente: il gioco continua',
      'Si rigioca il punto',
      'La prima volta è un avvertimento'], correct:0 },
    { id:'P-18', fascia:'Principiante', trap:false, q:'In che ordine si serve?', opts:[
      'Sempre lo stesso giocatore',
      'A turno tutti e quattro',
      'Chi ha vinto il punto prima',
      'Si decide all\'inizio di ogni game'], correct:1 },
    { id:'P-19', fascia:'Principiante', trap:false, q:'La palla può rimbalzare a terra due volte prima che io la colpisca?', opts:[
      'Sì, i rimbalzi sono due',
      'No: un solo rimbalzo a terra',
      'Sì, ma solo in difesa',
      'Sì, se il secondo è dietro la linea'], correct:1 },
    { id:'P-20', fascia:'Principiante', trap:false, q:'Cosa vuol dire che una coppia «va a rete»?', opts:[
      'Che ha toccato la rete',
      'Che salgono a rete per attaccare',
      'Che gioca solo palle basse',
      'Che rinuncia al servizio'], correct:1 },
    { id:'P-21', fascia:'Principiante', trap:false, q:'Il servizio rimbalza nel quadrato giusto e poi colpisce la rete metallica (la griglia). Cosa succede?', opts:[
      'È valido: il gioco continua',
      'È fallo di servizio',
      'Il servizio si ripete',
      'Punto per chi serve'], correct:1 },
    { id:'P-22', fascia:'Principiante', trap:false, q:'Con cosa si può colpire la palla?', opts:[
      'Solo col piatto forato',
      'Con la racchetta, mai col corpo',
      'Anche con la mano, una volta',
      'Solo con il bordo della racchetta'], correct:1 },
    { id:'P-23', fascia:'Principiante', trap:false, q:'Quanti punti servono per vincere un game, se non si va ai vantaggi?', opts:[
      'Tre',
      'Quattro: 15, 30, 40 e gioco',
      'Sei',
      'Undici'], correct:1 },
    { id:'P-24', fascia:'Principiante', trap:false, q:'Chi decide quale coppia serve per prima?', opts:[
      'La coppia più forte',
      'Un sorteggio prima della partita',
      'Chi ha prenotato il campo',
      'Chi ha vinto la partita precedente'], correct:1 },
    { id:'P-25', fascia:'Principiante', trap:false, q:'La mia palla rimbalza a terra nel campo avversario e poi tocca la loro rete metallica. Cosa succede?', opts:[
      'Punto mio: la griglia è fuori',
      'Continua: dopo il rimbalzo vale',
      'Si rigioca il punto',
      'Punto degli avversari'], correct:1 },
    { id:'P-26', fascia:'Principiante', trap:false, q:'Si cambia campo durante la partita?', opts:[
      'No, mai',
      'Sì, ai game dispari (1°, 3°, 5°)',
      'Sì, alla fine di ogni game',
      'Solo alla fine di ogni set'], correct:1 },
    { id:'P-27', fascia:'Principiante', trap:false, q:'Io e il mio compagno colpiamo la stessa palla, uno dopo l\'altro. Cosa succede?', opts:[
      'Punto loro: si colpisce una volta',
      'Continua, se passa la rete',
      'Si rigioca il punto',
      'Punto nostro'], correct:0 },

    // ── Principiante · trappole — dove l'intuito del tennis porta fuori strada ──────
    { id:'P-T3', fascia:'Principiante', trap:true,  q:'Quando si applica la «regola dei due tocchi», che permette ai due compagni di passarsi la palla prima di rimandarla?', opts:[
      'Solo in difesa',
      'Non esiste: un solo tocco',
      'Solo dopo un pallonetto',
      'Nei primi due game della partita'], correct:1 },
    { id:'P-T4', fascia:'Principiante', trap:true,  q:'Quando è concesso il servizio colpito sopra la testa, come nel tennis?', opts:[
      'Sul secondo servizio',
      'Mai: si serve sotto la vita',
      'Quando si è sotto nel punteggio',
      'Solo nei tornei'], correct:1 },
    { id:'P-T5', fascia:'Principiante', trap:true,  q:'Quando viene concesso il «rimbalzo di cortesia», cioè un rimbalzo in più a chi riceve?', opts:[
      'Nel primo game della partita',
      'Non esiste: nessun rimbalzo in più',
      'Quando il servizio tocca il nastro',
      'Dopo ogni cambio campo'], correct:1 },
    { id:'P-T6', fascia:'Principiante', trap:true,  q:'Che cos\'è il «punto di vetro»?', opts:[
      'Un punto che vale doppio',
      'Non esiste: valgono tutti uguale',
      'Il punto che chiude il set',
      'Il punto rigiocato col vetro bagnato'], correct:1 },
    { id:'P-T7', fascia:'Principiante', trap:true,  q:'In quale caso si può giocare la palla con la mano libera?', opts:[
      'Una volta per game',
      'Mai: si gioca solo con la racchetta',
      'Solo per fermare la palla',
      'Quando si è caduti a terra'], correct:1 },
    { id:'P-T8', fascia:'Principiante', trap:true,  q:'Quando si applica il «cambio di coppia», la regola che a metà set fa scambiare un giocatore con un avversario?', opts:[
      'Solo negli allenamenti',
      'Non esiste: le coppie non cambiano',
      'Sul 3-3',
      'Lo decide chi ha prenotato il campo'], correct:1 },
    { id:'P-T9', fascia:'Principiante', trap:true,  q:'Un avversario schiaccia, la palla rimbalza nel mio campo e vola fuori sopra le pareti. Il punto è finito?', opts:[
      'Sì: appena esce il punto è chiuso',
      'No: si può uscire e rimandarla',
      'No, se non tocco terra fuori',
      'Sì, tranne che nei tornei ufficiali'], correct:1 },

    /* 🆕📚 25/08/2026 — BASE SI ALLARGA A 27 NORMALI + 9 TRAPPOLE, e SALE di livello.
       📏 Misurato prima di scrivere, ed è il motivo per cui questo blocco non è solo «più
       domande»: le 11 Base di oggi chiedono le stesse cose delle nuove Principiante — dove
       rimbalza il servizio, se si può rispondere al volo, quanti rimbalzi, se si può toccare
       la rete. ⇒ Con Principiante dotato di una banca vera, **Base e Principiante erano lo
       stesso test**, e un cancello che non distingue due fasce non le sta misurando.
       ⭐ Perciò qui il metro sale di un gradino: non «hai visto una partita» ma **«ci hai
       giocato qualche mese»** — le regole che si scoprono giocando (le linee di fondo non
       esistono, si esce dalla porta, il lato di ricezione è fisso per tutto il set) e il
       primo gioco di posizione (rete in due, pallonetto per riprenderla, bandeja).
       ⚖️ Resta il metro di sempre (9/08): una risposta discutibile boccia chi ha ragione ⇒
       niente punto d'oro, niente formati di torneo, niente «dipende dal circolo».
       ⛔ Come Principiante, sigle nuove e mai riciclate. */

    // ── Base — le regole che si scoprono giocando ───────────────────────────────────
    { id:'B-09', fascia:'Base', trap:false, q:'La mia palla passa la rete, rimbalza nel campo avversario e poi finisce sul loro vetro. Il punto è finito?', opts:[
      'Sì: hanno il vetro alle spalle',
      'No: dopo il rimbalzo vale',
      'Sì, ma solo se è il vetro di fondo',
      'Si rigioca il punto'], correct:1 },
    { id:'B-10', fascia:'Base', trap:false, q:'Batto il servizio e nel momento del colpo il mio piede tocca la linea di servizio. Cosa succede?', opts:[
      'È valido: la linea è dentro',
      'È fallo di servizio',
      'Il servizio si ripete',
      'Punto diretto degli avversari'], correct:1 },
    { id:'B-11', fascia:'Base', trap:false, q:'Qual è la posizione da cui una coppia attacca meglio?', opts:[
      'Uno a rete e uno a fondo campo',
      'Tutti e due a rete, affiancati',
      'Tutti e due a fondo campo',
      'Uno al centro, uno al vetro'], correct:1 },
    { id:'B-12', fascia:'Base', trap:false, q:'A cosa serve soprattutto il pallonetto?', opts:[
      'A fare punto diretto',
      'A far arretrare e riprendere la rete',
      'A prendere tempo e fiato',
      'A far rimbalzare la palla sul vetro'], correct:1 },
    { id:'B-13', fascia:'Base', trap:false, q:'Dopo il rimbalzo a terra la palla tocca DUE pareti del mio campo, una dopo l\'altra. Posso ancora giocarla?', opts:[
      'No: due pareti chiudono il punto',
      'Sì: dopo il rimbalzo, comunque',
      'Solo due vetri, non la griglia',
      'Solo se sto difendendo'], correct:1 },
    { id:'B-14', fascia:'Base', trap:false, q:'Sono uscito dalla porta del campo per rincorrere una palla. Posso rimandarla dentro?', opts:[
      'No: fuori non si gioca',
      'Sì, se ha rimbalzato nel mio campo',
      'Sì, sempre, anche senza rimbalzo',
      'Solo nei tornei ufficiali'], correct:1 },
    { id:'B-15', fascia:'Base', trap:false, q:'Che cos\'è la «bandeja»?', opts:[
      'Uno smash colpito a tutta forza',
      'Colpo alto e controllato',
      'Un pallonetto giocato in difesa',
      'Un servizio con effetto'], correct:1 },
    { id:'B-16', fascia:'Base', trap:false, q:'Cosa deve avere obbligatoriamente la racchetta da padel?', opts:[
      'Niente di obbligatorio',
      'Il cordino da polso',
      'Il grip di colore scuro',
      'Un peso non superiore a 300 grammi'], correct:1 },
    { id:'B-17', fascia:'Base', trap:false, q:'La palla che ho colpito passa la rete e colpisce direttamente la griglia avversaria, senza rimbalzare a terra. Cosa succede?', opts:[
      'Punto mio',
      'Punto loro: doveva rimbalzare',
      'Continua: possono giocarla',
      'Si rigioca il punto'], correct:1 },
    { id:'B-18', fascia:'Base', trap:false, q:'Quanti game servono per vincere un set?', opts:[
      'Quattro',
      'Sei, con almeno due game di scarto',
      'Otto',
      'Dipende dalla prenotazione'], correct:1 },
    { id:'B-19', fascia:'Base', trap:false, q:'Mentre la palla è in gioco la racchetta mi sfugge di mano e finisce nel campo avversario. Cosa succede?', opts:[
      'Punto degli avversari',
      'Il gioco continua',
      'Si rigioca il punto',
      'La prima volta è un avvertimento'], correct:0 },
    { id:'B-20', fascia:'Base', trap:false, q:'Chi serve, batte sempre dallo stesso lato del campo?', opts:[
      'Sì, per tutto il game',
      'No: alterna a ogni punto',
      'Cambia lato ogni due punti',
      'Lo sceglie chi riceve'], correct:1 },
    { id:'B-21', fascia:'Base', trap:false, q:'Dentro una coppia, chi serve durante un game?', opts:[
      'I compagni si alternano',
      'Sempre lo stesso, per il game',
      'Chi ha vinto il punto precedente',
      'Si decide a ogni punto'], correct:1 },
    { id:'B-22', fascia:'Base', trap:false, q:'Com\'è l\'altezza della rete da padel?', opts:[
      'Uguale su tutta la lunghezza',
      'Più bassa al centro che ai lati',
      'Più alta al centro che ai lati',
      'Si regola prima di ogni partita'], correct:1 },
    { id:'B-23', fascia:'Base', trap:false, q:'Ho sbagliato il primo servizio. Il secondo dove lo batto?', opts:[
      'Dal lato opposto',
      'Dallo stesso lato',
      'Da dove preferisco',
      'Verso il quadrato opposto'], correct:1 },
    { id:'B-24', fascia:'Base', trap:false, q:'Quanto misura un campo da padel?', opts:[
      '18 metri per 9',
      '20 metri per 10',
      '24 metri per 11',
      'Come un campo da tennis'], correct:1 },
    { id:'B-25', fascia:'Base', trap:false, q:'Gli avversari colpiscono e la palla esce dal campo senza aver mai rimbalzato dentro. Cosa succede?', opts:[
      'Punto mio: non è mai entrata',
      'Punto loro',
      'Si rigioca il punto',
      'Il gioco continua fuori dal campo'], correct:0 },
    { id:'B-26', fascia:'Base', trap:false, q:'Nel padel una palla può essere «fuori» perché rimbalza oltre la linea di fondo?', opts:[
      'Sì, come nel tennis',
      'No: contano solo quelle del servizio',
      'Sì, ma solo sul servizio',
      'Sì, solo nei tornei ufficiali'], correct:1 },
    { id:'B-27', fascia:'Base', trap:false, q:'Durante lo scambio la palla tocca il nastro della rete e passa comunque dall\'altra parte. Cosa succede?', opts:[
      'Si rigioca il punto',
      'Il gioco continua normalmente',
      'Punto di chi ha colpito',
      'Punto degli avversari'], correct:1 },

    // ── Base · trappole ─────────────────────────────────────────────────────────────
    { id:'B-T4', fascia:'Base', trap:true,  q:'Quando si applica la «regola del vetro amico», che permette di far rimbalzare la palla sul proprio vetro prima di rimandarla di là?', opts:[
      'Solo quando si è in difesa',
      'Non esiste: deve passare la rete',
      'Solo dopo un pallonetto avversario',
      'Sul punteggio di 40-40'], correct:1 },
    { id:'B-T5', fascia:'Base', trap:true,  q:'Che cos\'è la «zona morta», l\'area del campo in cui la palla non può rimbalzare?', opts:[
      'Fra la rete e la linea di servizio',
      'Non esiste: si rimbalza dovunque',
      'La fascia vicino ai vetri laterali',
      'Esiste solo nei campi al coperto'], correct:1 },
    { id:'B-T6', fascia:'Base', trap:true,  q:'Quando si applica il «cambio di servizio anticipato», che toglie il servizio a chi perde tre punti di fila?', opts:[
      'Solo nei tornei federali',
      'Non esiste: cambia a fine game',
      'Solo nel primo set',
      'Quando lo chiede chi riceve'], correct:1 },
    { id:'B-T7', fascia:'Base', trap:true,  q:'Chi riceve il servizio dove si deve mettere?', opts:[
      'Dietro la linea, obbligatorio',
      'Dove vuole: nessuna regola',
      'In diagonale, obbligatorio',
      'Al centro del proprio campo'], correct:1 },
    { id:'B-T8', fascia:'Base', trap:true,  q:'In quale caso si può chiedere la «palla di cortesia», cioè ripetere un punto perso per una distrazione?', opts:[
      'Quando un giocatore scivola',
      'Non esiste: non si ripete',
      'Una volta per set',
      'Quando lo concede l\'avversario'], correct:1 },
    { id:'B-T9', fascia:'Base', trap:true,  q:'Quando i due compagni possono scambiarsi il lato di ricezione (destra e sinistra)?', opts:[
      'A ogni cambio campo',
      'Solo a inizio set',
      'Alla fine di ogni game',
      'In qualunque momento, basta avvisare'], correct:1 },

    /* 🆕📚 25/08/2026 — INTERMEDIO SI ALLARGA A 27 NORMALI + 9 TRAPPOLE.
       ⭐ Il metro sale ancora di un gradino, e qui cambia natura: Principiante chiede «hai
       visto una partita», Base «ci hai giocato qualche mese», Intermedio chiede **«sai dove
       stare e cosa scegliere»** — la posizione della coppia, il senso del servizio, l'uscita
       di parete, perché si gioca al centro.
       🚨 È la fascia del TETTO (sua decisione del 25/08): sopra Intermedio il quiz non
       assegna piu' niente, certifica il maestro guardando giocare. ⇒ Questa è l'ultima
       fascia in cui una risposta giusta vale un livello, ed è anche l'ultima in cui mentire
       alla domanda 3 rende qualcosa. Le domande di qui in su servono a MISURARE (il livello
       che le risposte dimostrano, da portare al maestro), non ad assegnare.
       ⚖️ Metro di sempre: una risposta discutibile boccia chi ha ragione ⇒ niente scelte
       tattiche su cui due maestri direbbero cose diverse, solo quelle su cui non si discute.
       ⛔ Sigle nuove, mai riciclate. La I-03, ritirata il 9/08 perché la sua risposta
       dipendeva da quanto è veloce l'avversario, resta un buco e non si riusa. */

    // ── Intermedio — posizione, scelte, uscita di parete ────────────────────────────
    { id:'I-10', fascia:'Intermedio', trap:false, q:'Sono a fondo campo e arriva una palla profonda e veloce sui piedi. La scelta più solida?', opts:[
      'Colpirla al volo, prima che rimbalzi',
      'Lasciarla uscire dal vetro',
      'Colpirla più forte possibile',
      'Provare uno smash'], correct:1 },
    { id:'I-11', fascia:'Intermedio', trap:false, q:'Siamo a rete e gli avversari giocano un pallonetto profondo. Cosa conviene fare?', opts:[
      'Bandeja e restare a rete',
      'Lasciarlo e tornare al fondo',
      'Provare uno smash a tutta forza',
      'Scambiarsi di lato con il compagno'], correct:0 },
    { id:'I-12', fascia:'Intermedio', trap:false, q:'Perché conviene spesso giocare la palla al centro, fra i due avversari?', opts:[
      'Lì la rete è più bassa e confonde',
      'Perché la palla viaggia più veloce',
      'È l\'unica zona senza vetro dietro',
      'Il regolamento premia il centro'], correct:0 },
    { id:'I-13', fascia:'Intermedio', trap:false, q:'Da fondo campo, qual è l\'obiettivo principale dello scambio?', opts:[
      'Fare punto con un colpo forte',
      'Far scendere la palla ai piedi',
      'Tenere la palla alta a lungo',
      'Colpire sul vetro laterale'], correct:1 },
    { id:'I-14', fascia:'Intermedio', trap:false, q:'Sono a rete e mi arriva una palla bassa, sotto il livello del nastro. Cosa conviene?', opts:[
      'Attaccarla forte verso il basso',
      'Volée profonda, e restare a rete',
      'Arretrare subito a fondo campo',
      'Giocare un pallonetto'], correct:1 },
    { id:'I-15', fascia:'Intermedio', trap:false, q:'Dopo aver servito, cosa fa chi ha servito?', opts:[
      'Resta a fondo campo',
      'Sale subito a rete',
      'Aspetta il rimbalzo al centro',
      'Si sposta verso il vetro laterale'], correct:1 },
    { id:'I-16', fascia:'Intermedio', trap:false, q:'Come si dispone la coppia che sta difendendo?', opts:[
      'Uno a rete e uno a fondo campo',
      'Tutti e due a fondo campo',
      'Uno al centro e uno dietro',
      'Ognuno copre il suo lato'], correct:1 },
    { id:'I-17', fascia:'Intermedio', trap:false, q:'Un pallonetto avversario finisce sul vetro di fondo del mio campo. Per me quella palla è:', opts:[
      'Persa: dal fondo non si prende',
      'Comoda: si gioca in uscita',
      'Un punto già degli avversari',
      'Da colpire prima del vetro, sempre'], correct:1 },
    { id:'I-18', fascia:'Intermedio', trap:false, q:'La palla, dopo il rimbalzo, sta uscendo dal vetro laterale. Come conviene giocarla?', opts:[
      'Anticipandola prima del vetro',
      'Aspettando l\'uscita dal vetro',
      'Colpendola forte appena esce',
      'Lasciandola rimbalzare due volte'], correct:1 },
    { id:'I-19', fascia:'Intermedio', trap:false, q:'In quale posizione si vince la maggior parte dei punti?', opts:[
      'A fondo campo',
      'A rete',
      'Sul servizio',
      'Sui vetri laterali'], correct:1 },
    { id:'I-20', fascia:'Intermedio', trap:false, q:'Che effetto si dà di solito alla bandeja?', opts:[
      'Topspin, per farla rimbalzare alta',
      'Taglio, per tenerla bassa',
      'Nessun effetto: è un colpo piatto',
      'Effetto laterale, verso il vetro'], correct:1 },
    { id:'I-21', fascia:'Intermedio', trap:false, q:'A cosa serve soprattutto il servizio nel padel?', opts:[
      'A fare punto diretto',
      'A prendere la rete: è un\'apertura',
      'A mandarla sul vetro avversario',
      'A stancare chi riceve'], correct:1 },
    { id:'I-22', fascia:'Intermedio', trap:false, q:'Il mio compagno ha rincorso una palla larga ed è fuori posizione. Io cosa faccio?', opts:[
      'Resto fermo nella mia metà campo',
      'Copro la sua zona: si va insieme',
      'Salgo a rete da solo',
      'Torno a fondo campo ad aspettarlo'], correct:1 },
    { id:'I-23', fascia:'Intermedio', trap:false, q:'La mia palla rimbalza nel campo avversario, tocca la loro griglia e torna nel mio campo senza che nessuno la tocchi. Cosa succede?', opts:[
      'Punto mio',
      'Punto degli avversari',
      'Si rigioca il punto',
      'Il gioco continua: posso rigiocarla'], correct:0 },
    { id:'I-24', fascia:'Intermedio', trap:false, q:'L\'ordine di servizio dentro una coppia può cambiare durante la partita?', opts:[
      'No: si stabilisce e resta quello',
      'Sì, all\'inizio di ogni set',
      'Sì, all\'inizio di ogni game',
      'Sì, in qualunque momento'], correct:1 },
    { id:'I-25', fascia:'Intermedio', trap:false, q:'Qual è la zona del campo in cui conviene NON farsi sorprendere?', opts:[
      'Il fondo campo',
      'La zona di mezzo campo',
      'La rete',
      'L\'angolo vicino al vetro laterale'], correct:1 },
    { id:'I-26', fascia:'Intermedio', trap:false, q:'Cosa vuol dire «tenere la rete»?', opts:[
      'Toccare la rete senza fallo',
      'Restare a rete senza arretrare',
      'Colpire verso la rete',
      'Difendere solo la propria metà campo'], correct:1 },
    { id:'I-27', fascia:'Intermedio', trap:false, q:'Gli avversari sono tutti e due a rete e io sono in difesa. La prima cosa da NON fare è:', opts:[
      'Giocare basso, sui loro piedi',
      'Regalare una palla alta comoda',
      'Giocare un pallonetto profondo',
      'Lasciarla uscire dal vetro'], correct:1 },
    { id:'I-28', fascia:'Intermedio', trap:false, q:'Durante lo scambio posso passare la racchetta da una mano all\'altra?', opts:[
      'No, mai',
      'Sì: nessuna regola lo vieta',
      'Solo quando si difende',
      'Una volta per game'], correct:1 },

    // ── Intermedio · trappole ───────────────────────────────────────────────────────
    { id:'I-T4', fascia:'Intermedio', trap:true,  q:'Cosa stabilisce la «regola del muro cieco», che vieta di giocare la palla dopo il vetro di fondo?', opts:[
      'Vale solo nei campi al coperto',
      'Non esiste: il vetro di fondo vale',
      'Vale solo sul servizio',
      'Vale quando si è sotto nel punteggio'], correct:1 },
    { id:'I-T5', fascia:'Intermedio', trap:true,  q:'Quando è obbligatoria la «bandeja invertita» sul lato del rovescio?', opts:[
      'Su un pallonetto molto profondo',
      'Non esiste: nessun colpo è obbligato',
      'Nei tornei federali',
      'Difendendo in due al fondo'], correct:1 },
    { id:'I-T6', fascia:'Intermedio', trap:true,  q:'Quando vale il «punto di transizione», che assegna mezzo punto alla coppia che conquista la rete?', opts:[
      'A ogni cambio di posizione',
      'Non esiste: niente mezzi punti',
      'Solo nel tie-break',
      'Solo negli allenamenti'], correct:1 },
    { id:'I-T7', fascia:'Intermedio', trap:true,  q:'Posso mandare la palla dall\'altra parte facendola passare FUORI dai pali della rete, di lato, invece che sopra?', opts:[
      'No: deve passare sopra la rete',
      'Sì, se atterra nel campo giusto',
      'Sì, ma solo quando si difende',
      'Solo nei tornei ufficiali'], correct:1 },
    { id:'I-T8', fascia:'Intermedio', trap:true,  q:'Quando entra in gioco la «regola dell\'ultimo vetro», che chiude il punto se la palla tocca un vetro dopo aver toccato la griglia?', opts:[
      'Solo nel proprio campo',
      'Non esiste: l\'ordine non conta',
      'Solo nel campo avversario',
      'Solo sul servizio'], correct:1 },
    { id:'I-T9', fascia:'Intermedio', trap:true,  q:'Cosa prevede la «regola del servizio lungo», che concede un servizio in più alla coppia che ha appena perso il game?', opts:[
      'Vale dal secondo set in poi',
      'Non esiste: i servizi sono due',
      'Vale solo sul punteggio di parità',
      'La concede l\'arbitro a richiesta'], correct:1 },

    /* 🆕📚 25/08/2026 — AVANZATO SI ALLARGA A 27 NORMALI + 9 TRAPPOLE.
       ⭐ Metro: i COLPI e i loro perché. Qui non si chiede più dove stare (è Intermedio) ma
       che cosa si gioca e con quale effetto — vibora, chiquita, bajada, uscita di parete,
       la prima volée dopo il servizio.
       🚨 SOPRA IL TETTO: da questa fascia in su il quiz non assegna più niente. Chi risponde
       da Avanzato prende comunque **Intermedio**, con scritto che ha risposto da Avanzato e
       che il maestro lo certifica vedendolo giocare (sua regola del 25/08). ⇒ Queste domande
       servono a MISURARE, non ad assegnare — e la misura è quello che il maestro legge prima
       di andare a guardare.
       ⚖️ Metro di sempre: niente scelte tattiche su cui due maestri direbbero cose diverse.
       ⛔ Sigle nuove, mai riciclate. */

    // ── Avanzato — i colpi e il loro perché ─────────────────────────────────────────
    { id:'A-09', fascia:'Avanzato', trap:false, q:'Perché la chiquita si gioca bassa e centrale?', opts:[
      'Per fare punto diretto',
      'Per costringere a una volée bassa',
      'Per farla rimbalzare sul vetro',
      'Per guadagnare tempo'], correct:1 },
    { id:'A-10', fascia:'Avanzato', trap:false, q:'Come si colpisce la vibora?', opts:[
      'Piatta e a tutta forza',
      'Tagliata e laterale, resta bassa',
      'Con topspin, rimbalza alta',
      'Sempre in sospensione, saltando'], correct:1 },
    { id:'A-11', fascia:'Avanzato', trap:false, q:'Qual è l\'errore più comune di chi sta a rete sulle palle alte?', opts:[
      'Giocare troppe bandeje',
      'Smashare tutto e perdere la rete',
      'Giocare troppo al centro',
      'Restare troppo vicino alla rete'], correct:1 },
    { id:'A-12', fascia:'Avanzato', trap:false, q:'Perché il pallonetto è il colpo più usato ad alto livello?', opts:[
      'Perché fa punto diretto',
      'Toglie la rete agli avversari',
      'È il colpo più facile',
      'Perché stanca gli avversari'], correct:1 },
    { id:'A-13', fascia:'Avanzato', trap:false, q:'Perché uno smash piatto e centrale è spesso poco efficace?', opts:[
      'Perché è troppo lento',
      'La palla torna comoda dal vetro',
      'Perché è vietato dal regolamento',
      'Perché stanca troppo chi lo esegue'], correct:1 },
    { id:'A-14', fascia:'Avanzato', trap:false, q:'Sono sotto pressione in difesa. Dove conviene mandare la palla?', opts:[
      'Bassa e veloce al centro',
      'Alta e profonda, per far arretrare',
      'Corta, appena oltre la rete',
      'Sempre contro il vetro laterale'], correct:1 },
    { id:'A-15', fascia:'Avanzato', trap:false, q:'Quando si dice che una coppia ha «l\'iniziativa»?', opts:[
      'Quando è al servizio',
      'Quando sta a rete e li tiene bassi',
      'Quando è avanti nel punteggio',
      'Quando gioca molto sui vetri'], correct:1 },
    { id:'A-16', fascia:'Avanzato', trap:false, q:'Una palla molto veloce e alta finisce sul vetro di fondo del mio campo dopo il rimbalzo. Come si difende?', opts:[
      'Anticipandola prima del vetro',
      'Aspettando l\'uscita, con un globo',
      'Colpendola forte al volo',
      'Lasciandola passare'], correct:1 },
    { id:'A-17', fascia:'Avanzato', trap:false, q:'Perché la prima volée dopo il servizio è così importante?', opts:[
      'Perché è il colpo che fa più punti',
      'Decide se si tiene la rete',
      'È il colpo più facile',
      'Il regolamento obbliga al volo'], correct:1 },
    { id:'A-18', fascia:'Avanzato', trap:false, q:'Posso servire in modo che la palla, dopo il rimbalzo, finisca contro il vetro laterale avversario?', opts:[
      'No: sarebbe fallo di servizio',
      'Sì: dopo il rimbalzo il vetro vale',
      'Solo sul secondo servizio',
      'Solo nei tornei ufficiali'], correct:1 },
    { id:'A-19', fascia:'Avanzato', trap:false, q:'Un avversario esce dalla porta per rincorrere la mia palla. Cosa devo fare io?', opts:[
      'Considerare il punto già vinto',
      'Restare pronto: il punto continua',
      'Fermarmi e aspettare che rientri',
      'Uscire anch\'io dal campo'], correct:1 },
    { id:'A-20', fascia:'Avanzato', trap:false, q:'Cosa rende difficile giocare una palla in uscita di parete?', opts:[
      'Il fatto che arrivi alta',
      'Il taglio: esce poco e resta bassa',
      'Il fatto che arrivi lenta',
      'Il fatto che arrivi al centro'], correct:1 },
    { id:'A-21', fascia:'Avanzato', trap:false, q:'Quando conviene giocare al volo invece di lasciar rimbalzare?', opts:[
      'Sempre, ogni volta che si riesce',
      'A rete, se è sopra il nastro',
      'Solo stando a fondo campo',
      'Mai: conviene far rimbalzare'], correct:1 },
    { id:'A-22', fascia:'Avanzato', trap:false, q:'La racchetta può superare la rete durante il colpo?', opts:[
      'No: la racchetta non passa mai',
      'Sì, nell\'accompagnamento',
      'Sì, e si può anche colpire là',
      'Solo quando si gioca al volo'], correct:1 },
    { id:'A-23', fascia:'Avanzato', trap:false, q:'Che cos\'è il «remate»?', opts:[
      'Il pallonetto',
      'Lo smash',
      'La volée di controllo',
      'Il servizio con effetto'], correct:1 },
    { id:'A-24', fascia:'Avanzato', trap:false, q:'Perché le palle da padel sono meno pressurizzate di quelle da tennis?', opts:[
      'Per costare meno',
      'Rimbalzano meno, più controllo',
      'Per durare più a lungo',
      'Nessuna differenza'], correct:1 },
    { id:'A-25', fascia:'Avanzato', trap:false, q:'Che vantaggio dà la volée profonda rispetto a quella corta?', opts:[
      'Fa punto più facilmente',
      'Tiene gli avversari lontani',
      'È più facile da eseguire',
      'Fa rimbalzare la palla sul vetro'], correct:1 },
    { id:'A-26', fascia:'Avanzato', trap:false, q:'Sono in difesa e gioco un pallonetto corto. Cosa devo aspettarmi?', opts:[
      'Di riprendermi la rete',
      'Uno smash: devo difendere',
      'Che lascino passare la palla',
      'Un punto diretto a mio favore'], correct:1 },
    { id:'A-27', fascia:'Avanzato', trap:false, q:'Qual è il vantaggio principale di chi sta a rete?', opts:[
      'Essere più vicino agli avversari',
      'Colpire dall\'alto verso il basso',
      'Poter usare meglio i vetri',
      'Poter servire da più vicino'], correct:1 },

    // ── Avanzato · trappole ─────────────────────────────────────────────────────────
    { id:'A-T4', fascia:'Avanzato', trap:true,  q:'Quando si esegue la «vibora rovesciata in caduta»?', opts:[
      'Su un pallonetto molto profondo',
      'Non esiste questo colpo',
      'Quando si difende sul vetro laterale',
      'Solo nei tornei al coperto'], correct:1 },
    { id:'A-T5', fascia:'Avanzato', trap:true,  q:'Quando è consentito il «doppio smash consecutivo», cioè smashare due volte la stessa palla quando torna dal vetro?', opts:[
      'Se torna dal vetro di fondo',
      'Non esiste: un solo tocco',
      'Se non ha ancora rimbalzato',
      'Sul punteggio di parità'], correct:1 },
    { id:'A-T6', fascia:'Avanzato', trap:true,  q:'Cosa prevede la «regola dell\'attacco obbligato», che impone di smashare una palla che arriva sopra il nastro?', opts:[
      'Vale solo a rete',
      'Non esiste: nessun obbligo',
      'Vale solo nei tornei federali',
      'Vale dal secondo set in poi'], correct:1 },
    { id:'A-T7', fascia:'Avanzato', trap:true,  q:'Che cos\'è la «cadena», il colpo che permette di legare due volée in un unico movimento?', opts:[
      'Una volée doppia a rete',
      'Non esiste: mai due tocchi',
      'Un colpo difensivo sul vetro',
      'Un servizio con doppio effetto'], correct:1 },
    { id:'A-T8', fascia:'Avanzato', trap:true,  q:'Quando si applica il «recupero di rete», che consente di rigiocare un punto perso per un rimbalzo irregolare sul nastro?', opts:[
      'Se la palla tocca il nastro',
      'Non esiste: il nastro non conta',
      'Solo sul primo servizio',
      'Una volta per set'], correct:1 },
    { id:'A-T9', fascia:'Avanzato', trap:true,  q:'Quando è consentito battere il servizio avanzando, con un piede che supera la linea prima del colpo?', opts:[
      'Sul secondo servizio',
      'Mai: i piedi restano dietro',
      'Servendo dal lato del rovescio',
      'Nei tornei amatoriali'], correct:1 },

    /* 🆕📚 25/08/2026 — AGONISTA SI ALLARGA A 27 NORMALI + 9 TRAPPOLE, ed è l'ULTIMA fascia.
       ⛔ Sopra non si va: sua decisione del 25/08, *«sopra agonista niente quiz»*. Semi-Pro e
       Professionista restano senza domande — sono 0 soci su 2.813, e per quei livelli il
       quiz non aggiungerebbe niente che il maestro non veda meglio da solo.
       ⭐ Metro: il gioco fuori dal campo (x3, x4, contraparete) e il REGOLAMENTO DI GARA —
       tie-break, punto d'oro, tempi fra i punti, chi chiama i falli senza arbitro. È la
       parte che un giocatore di 3ª/4ª conosce perché ci ha giocato dei tornei.
       🚨 SOPRA IL TETTO come Avanzato: chi risponde da Agonista prende **Intermedio**, con
       scritto che ha risposto da Agonista e che il maestro lo certifica vedendolo giocare.
       ⛔ Sigle nuove, mai riciclate. */

    // ── Agonista — fuori dal campo e regolamento di gara ────────────────────────────
    { id:'AG-09', fascia:'Agonista', trap:false, q:'Che cos\'è lo smash «x3» (por tres)?', opts:[
      'Uno smash colpito tre volte di fila',
      'Smash che esce di lato',
      'Uno smash che vale tre punti',
      'Uno smash giocato nel terzo set'], correct:1 },
    { id:'AG-10', fascia:'Agonista', trap:false, q:'Nel tie-break, chi serve per primo?', opts:[
      'Chi ha servito l\'ultimo game',
      'Chi doveva servire, un punto solo',
      'Si sorteggia',
      'Chi ha vinto l\'ultimo punto'], correct:1 },
    { id:'AG-11', fascia:'Agonista', trap:false, q:'Nel tie-break, dopo il primo punto ogni quanti punti cambia chi serve?', opts:[
      'A ogni punto',
      'Ogni due punti',
      'Ogni quattro punti',
      'Non cambia fino alla fine'], correct:1 },
    { id:'AG-12', fascia:'Agonista', trap:false, q:'Dopo il mio x4 un avversario esce dal campo e rimette la palla dentro, che rimbalza nel mio campo. Cosa succede?', opts:[
      'Punto mio: la palla era già uscita',
      'Il gioco continua: devo giocarla',
      'Punto suo',
      'Si rigioca il punto'], correct:1 },
    { id:'AG-13', fascia:'Agonista', trap:false, q:'Perché il servizio «a uscire», verso il vetro laterale, è efficace?', opts:[
      'Perché è più veloce',
      'Porta al vetro e apre il centro',
      'Perché è più difficile da vedere',
      'Perché è obbligatorio in gara'], correct:1 },
    { id:'AG-14', fascia:'Agonista', trap:false, q:'In una partita senza arbitro, chi decide se un servizio è fallo?', opts:[
      'Chi serve',
      'La coppia che riceve',
      'Si rigioca sempre il punto',
      'Il circolo che ospita'], correct:1 },
    { id:'AG-15', fascia:'Agonista', trap:false, q:'Perché ad alto livello si difende con il pallonetto invece che con un colpo teso?', opts:[
      'Perché il pallonetto è più facile',
      'Un colpo teso regala l\'attacco',
      'Il regolamento premia i colpi alti',
      'Perché stanca di più gli avversari'], correct:1 },
    { id:'AG-16', fascia:'Agonista', trap:false, q:'La mia coppia ha appena perso la rete. La cosa più importante è:', opts:[
      'Risalire subito, uno alla volta',
      'Arretrare insieme e ricostruire',
      'Dividersi il campo a metà',
      'Giocare ogni palla al centro'], correct:1 },
    { id:'AG-17', fascia:'Agonista', trap:false, q:'Un giocatore tocca la rete DOPO che il punto si è chiuso. Cosa succede?', opts:[
      'Punto degli avversari',
      'Niente: il punto era già finito',
      'Si rigioca il punto',
      'È un avvertimento formale'], correct:1 },
    { id:'AG-18', fascia:'Agonista', trap:false, q:'Durante lo scambio la palla tocca il palo della rete e cade regolarmente nel campo avversario. Cosa succede?', opts:[
      'Punto perso da chi ha colpito',
      'Continua: è passata regolarmente',
      'Si rigioca il punto',
      'Punto vinto da chi ha colpito'], correct:1 },
    { id:'AG-19', fascia:'Agonista', trap:false, q:'Che cos\'è la «dejada» (smorzata)?', opts:[
      'Un pallonetto molto corto',
      'Palla corta appena oltre la rete',
      'Uno smash controllato',
      'Un servizio giocato lento'], correct:1 },
    { id:'AG-20', fascia:'Agonista', trap:false, q:'Quando conviene giocare la dejada?', opts:[
      'Quando gli avversari sono a rete',
      'Quando sono a fondo campo',
      'Sempre, quando si difende',
      'Sul servizio'], correct:1 },
    { id:'AG-21', fascia:'Agonista', trap:false, q:'In gara, quanto tempo si ha fra la fine di un punto e il servizio successivo?', opts:[
      '10 secondi',
      '20 secondi',
      '45 secondi',
      'Non c\'è un limite'], correct:1 },
    { id:'AG-22', fascia:'Agonista', trap:false, q:'Quanto dura la pausa al cambio campo?', opts:[
      '30 secondi',
      '90 secondi',
      'Due minuti',
      'Non c\'è un limite'], correct:1 },
    { id:'AG-23', fascia:'Agonista', trap:false, q:'Che cos\'è il «punto d\'oro»?', opts:[
      'Un punto che vale doppio',
      'Sul 40-40 un punto decisivo',
      'Il punto che chiude il set',
      'Il primo punto del tie-break'], correct:1 },
    { id:'AG-24', fascia:'Agonista', trap:false, q:'Di che materiale è la superficie di un campo da padel da torneo?', opts:[
      'Cemento',
      'Erba sintetica con sabbia',
      'Terra rossa',
      'Parquet'], correct:1 },
    { id:'AG-25', fascia:'Agonista', trap:false, q:'Perché lo smash «x4» si chiama così?', opts:[
      'Perché vale quattro punti',
      'Fa uscire la palla oltre il fondo',
      'Si colpisce con quattro rimbalzi',
      'Perché si usa nel quarto set'], correct:1 },
    { id:'AG-26', fascia:'Agonista', trap:false, q:'La palla esce dal campo e nessuno la rimette dentro. Il punto è di:', opts:[
      'Chi l\'ha colpita, se era entrata',
      'Chi ha provato a rincorrerla',
      'Nessuno: si rigioca',
      'Chi stava difendendo, sempre'], correct:0 },
    { id:'AG-27', fascia:'Agonista', trap:false, q:'Quante palline si usano in una partita ufficiale?', opts:[
      'Una',
      'Tre',
      'Sei',
      'Dipende dal torneo'], correct:1 },

    // ── Agonista · trappole ─────────────────────────────────────────────────────────
    { id:'AG-T4', fascia:'Agonista', trap:true,  q:'Che cos\'è la «doble pared offensiva», il colpo che obbliga la palla a toccare due pareti avversarie?', opts:[
      'Colpo d\'attacco sul vetro laterale',
      'Non esiste: nessun obbligo di pareti',
      'Una variante della vibora',
      'Un colpo consentito solo in difesa'], correct:1 },
    { id:'AG-T5', fascia:'Agonista', trap:true,  q:'Cosa prevede la «regola del punto lungo», che assegna il punto dopo trenta colpi di scambio?', opts:[
      'Vale solo nei tornei giovanili',
      'Non esiste: nessun limite di durata',
      'Vale dal terzo set',
      'La applica l\'arbitro'], correct:1 },
    { id:'AG-T6', fascia:'Agonista', trap:true,  q:'Quando si può chiedere il «time-out tecnico di parete», per far controllare un vetro durante il punto?', opts:[
      'Una volta per set',
      'Non esiste: nessun controllo',
      'Solo nei campi al coperto',
      'Quando lo concede l\'avversario'], correct:1 },
    { id:'AG-T7', fascia:'Agonista', trap:true,  q:'Quando è obbligatorio giocare la «sotana»?', opts:[
      'Se arriva sotto il ginocchio',
      'Mai: nessun colpo è obbligatorio',
      'Nei tornei federali',
      'Difendendo in due al fondo'], correct:1 },
    { id:'AG-T8', fascia:'Agonista', trap:true,  q:'Quando vale la «regola dei due smash», che vieta allo stesso giocatore due smash consecutivi nello stesso punto?', opts:[
      'Solo nei tornei federali',
      'Non esiste: nessun limite',
      'Vale dal secondo set',
      'Vale solo nel tie-break'], correct:1 },
    { id:'AG-T9', fascia:'Agonista', trap:true,  q:'Cosa prevede la «regola del vantaggio di servizio», che assegna il game a chi vince tre punti di fila al servizio?', opts:[
      'Vale solo sul punteggio di parità',
      'Non esiste: servono quattro punti',
      'Vale nei tornei con punto d\'oro',
      'La concede l\'arbitro'], correct:1 },

    /* ═══ 🆕🗣️⭐⭐ 27/08/2026 — LE TRABOCCHETTO ALLA ROVESCIA, 3 per fascia interrogabile ═══
       🗣️ Delega sua: *«decidi tu, tenendo conto che il test deve risultare il più difficile da
       ricordare e soprattutto da azzeccare per i livelli da principiante a intermedio»*.
       📏 Il difetto misurato che curano: delle 45 trabocchetto, 37 (l'82%) avevano come
       risposta giusta «Non esiste…», e NESSUNA delle 135 normali portava quell'opzione. Chi
       aveva fatto il test una volta imparava una regola sola, senza sapere niente di padel:
       *se c'è «Non esiste», è quella; se non c'è, è una domanda vera.*
       ⇒ Queste sono il contrario: REGOLE VERE che sembrano inventate, dove «Non esiste» c'è
       ed è SBAGLIATA. Da oggi vedere «Non esiste» non dice più da che parte sta la verità.
       ⚖️ Il metro resta quello della vecchia I-03: regole e definizioni su cui non si discute —
       contropared, salida, x3, punto d'oro, dormilona, gancho sono nel regolamento o nel
       lessico consolidato, non opinioni.
       ⛔ Principiante non ne ha: quella fascia il quiz non lo pesca (regola del 9/08, intatta). */

    // ── Base, alla rovescia ─────────────────────────────────────────────────────────
    { id:'B-T10', fascia:'Base', trap:true, q:'Si può colpire la palla contro il PROPRIO vetro per mandarla di là dalla rete?', opts:[
      'Non esiste: vetro proprio vietato',
      'Sì: è la contropared',
      'Solo quando il punteggio è pari',
      'Solo in doppio femminile'], correct:1 },
    { id:'B-T11', fascia:'Base', trap:true, q:'La palla, dopo il rimbalzo, esce dal campo: un giocatore può uscire dalla porta e rimandarla dentro?', opts:[
      'Non esiste: fuori campo è persa',
      'Solo se non ha mai toccato terra',
      'Sì: il punto continua, è regolare',
      'Solo nei tornei federali'], correct:2 },
    { id:'B-T12', fascia:'Base', trap:true, q:'Con lo smash la palla rimbalza nel campo avversario e poi vola FUORI dalla recinzione. Il punto?', opts:[
      'Si rigioca',
      'È degli avversari: palla uscita',
      'Non esiste una regola precisa',
      'È di chi ha smashato'], correct:3 },

    // ── Intermedio, alla rovescia ───────────────────────────────────────────────────
    { id:'I-T10', fascia:'Intermedio', trap:true, q:'La «chiquita» è un colpo vero?', opts:[
      'Non esiste: è un nome inventato',
      'Sì: colpo corto sui piedi, a rete',
      'È un altro nome del pallonetto',
      'Esiste solo tra i professionisti'], correct:1 },
    { id:'I-T11', fascia:'Intermedio', trap:true, q:'Nel mio campo la palla rimbalza a terra e poi tocca DUE pareti. Posso ancora giocarla?', opts:[
      'Non esiste: dopo due pareti è morta',
      'Solo se la seconda è la griglia',
      'Sì: conta solo il rimbalzo a terra',
      'No: si rigioca il punto'], correct:2 },
    { id:'I-T12', fascia:'Intermedio', trap:true, q:'Nel padel professionistico esiste il «punto d\'oro» sul 40-40?', opts:[
      'Non esiste: sempre i vantaggi',
      'Esiste solo nel tie-break',
      'Esiste: un punto secco decide',
      'Esisteva, ma è stato abolito'], correct:2 },

    // ── Avanzato, alla rovescia ─────────────────────────────────────────────────────
    { id:'A-T10', fascia:'Avanzato', trap:true, q:'Lo smash «x3» esiste?', opts:[
      'Non esiste: si parla solo di x4',
      'Sì: esce sopra la parete laterale',
      'È un altro nome della vibora',
      'Solo dal centro del campo'], correct:1 },
    { id:'A-T11', fascia:'Avanzato', trap:true, q:'Rientrando da FUORI campo dopo una salida, la palla può passare di fianco alla rete, più bassa del nastro?', opts:[
      'Non esiste: sempre sopra la rete',
      'Solo se tocca il palo della rete',
      'Solo se l\'avversario è d\'accordo',
      'Sì: da fuori è una giocata valida'], correct:3 },
    { id:'A-T12', fascia:'Avanzato', trap:true, q:'La «dormilona» è un colpo vero?', opts:[
      'Non esiste: è un nome inventato',
      'Sì: uno smash smorzato, corto',
      'È il servizio sottomano',
      'È una posizione, non un colpo'], correct:1 },

    // ── Agonista, alla rovescia ─────────────────────────────────────────────────────
    { id:'AG-T10', fascia:'Agonista', trap:true, q:'Il «gancho» esiste?', opts:[
      'Non esiste: è un nome inventato',
      'Sì: colpo alto a uncino, in salto',
      'È il nome argentino della bandeja',
      'È un\'infrazione di piede'], correct:1 },
    { id:'AG-T11', fascia:'Agonista', trap:true, q:'«Vibora» e «bandeja» sono lo stesso colpo con due nomi?', opts:[
      'Sì: due nomi dello stesso colpo',
      'Non esistono: nomi senza colpo',
      'No: la vibora ha più taglio',
      'Sì, ma solo nel padel maschile'], correct:2 },
    { id:'AG-T12', fascia:'Agonista', trap:true, q:'Il servizio si può battere anche di rovescio?', opts:[
      'Non esiste: solo di dritto',
      'Solo il secondo servizio',
      'Solo avvisando l\'avversario',
      'Sì: contano rimbalzo e cintura'], correct:3 }
  ]
};
// Fascia da interrogare, dal livello dichiarato. Semi-Pro e Professionista non hanno domande:
// un quiz non può validare un giocatore di 2ª categoria, quella scheda va sempre in segreteria.
/* 🎯 LA FASCIA SI RICAVA COME NELL'APP, passando per `assessmentPublicParseLevel` — 14/08.
   Il modulo manda il livello dichiarato così com'è, e a seconda del punto può essere `4` o
   `4.0 - Avanzato`. `pmoLivelloFascia` fa `Number(...)`, che sulla seconda forma dà NaN ⇒
   fascia vuota ⇒ nessuna domanda ⇒ esito `skip`, cioè «vai in segreteria».
   🚨 È un guasto SILENZIOSO e crudele: il socio risponde a tutto, l'invio riesce, e viene
   comunque mandato in segreteria senza che nessuno veda un errore. Trovato con una sonda che
   mandava l'etichetta invece del numero — cioè per fortuna.
   ⇒ Qui si normalizza una volta sola, e chi chiama non deve ricordarselo. */
/* 🆕⭐⭐ 25/08/2026 — IL TETTO, e il messaggio che il socio legge quando lo supera.
 *
 * 🗣️ Sua decisione: *«mettergli intermedio fino a che il maestro non lo certifica»*, e sul
 * messaggio, parole sue: *«deve dire che deve contattare la segreteria affinché il maestro lo
 * guardi durante una partita e di far sapere il giorno in cui gioca»*.
 *
 * ⭐ STA QUI, in `conoscenza.js`, perché questo file è già l'unico posto dove vive «tutto ciò
 * che decide un livello e un esito». Il messaggio nasce dove nasce il numero: se un domani il
 * tetto si sposta, la frase si sposta con lui invece di restare indietro di una versione.
 *
 * 🚨 IL NUMERO ESISTE IN DUE POSTI, ed è dichiarato: qui e in `assessment-apply-level`, che è
 * una funzione diversa e non può importare da questa cartella (i deploy scelgono le funzioni
 * dalle cartelle toccate). ⇒ `test/autovalutazione-conoscenza.test.mjs` confronta i due e
 * diventa rosso se uno solo cambia. È la stessa scelta — deliberata — della scala dei livelli,
 * che di copie ne ha tre.
 *
 * ⚖️ E il messaggio dice DUE cose, non una, perché una sola non basterebbe a nessuno:
 *   · che il livello scritto è Intermedio E che le sue risposte dicevano di più — o suonerebbe
 *     come un declassamento a chi è forte davvero;
 *   · che deve dire QUANDO GIOCA — senza il giorno il maestro non sa quando andare a guardare,
 *     e la certificazione resterebbe una promessa che non arriva.
 */
export const TETTO_AUTOMATICO = 3.5;

export function certificazioneDelMaestro(livelloDimostrato) {
  const n = numero(livelloDimostrato);
  if (n === null || !(n > TETTO_AUTOMATICO)) return null;
  const dimostrata = pmoLivelloDefinizione(n);
  const scritta = pmoLivelloDefinizione(TETTO_AUTOMATICO);
  return {
    dimostrato: n,
    fascia_dimostrata: dimostrata,
    livello_scritto: TETTO_AUTOMATICO,
    fascia_scritta: scritta,
    messaggio: `Le tue risposte dicono ${dimostrata}. Sopra ${scritta} il livello non lo decidiamo con le domande: te lo certifica il maestro guardandoti giocare. Intanto ti registriamo ${scritta}, così puoi già organizzare e giocare. Contatta la segreteria e di\' loro il giorno in cui giochi: il maestro viene a vederti durante una partita e da lì ti mettiamo il livello giusto.`,
  };
}

export function fasciaDaLivello(level) {
  return assessKnowledgeFasciaFor(assessmentPublicParseLevel(level));
}
export function assessKnowledgeFasciaFor(level) {
  const definizione = pmoLivelloDefinizione(level);
  if (!definizione) return '';
  return ASSESS_KNOWLEDGE_BANK.questions.some(q => q.fascia === definizione) ? definizione : '';
}
export function assessKnowledgeShuffle(list, rnd) {
  const sorte = typeof rnd === 'function' ? rnd : Math.random;
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(sorte() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
// Pesca 3 normali + 1 trappola e mescola sia l'ordine delle domande sia quello delle risposte:
// rifare il test, o copiarlo da un amico, non serve a nulla.
// Le regole di QUESTA fascia: i valori generali, più ciò che la fascia sovrascrive.
// ⭐ Una funzione sola invece di leggere la tabella in tre punti: erano tre modi di
// dimenticarsi un'eccezione.
export function assessKnowledgeRegole(fascia) {
  const B = ASSESS_KNOWLEDGE_BANK;
  const propria = (B.regole_fascia || {})[assessTxt(fascia)] || {};
  return {
    cancello: propria.cancello !== false,
    pass_min_correct: propria.pass_min_correct != null ? propria.pass_min_correct : B.pass_min_correct,
    trap_wrong_fails: propria.trap_wrong_fails != null ? propria.trap_wrong_fails : B.trap_wrong_fails
  };
}
/* ═══ 🆕🗣️⭐⭐ 27/08/2026 sera — LA PESCATA HA MEMORIA ═══════════════════════════════════
   🗣️ Segnalazione di Maurizio, riportata da lui: *«facendo il test di livello le domande sono
   sempre le stesse che gli capitano»*.

   📏 MISURATO prima di toccare, perché il sospetto ovvio era il sorteggio ed era SBAGLIATO: su
   6000 pescate la distribuzione è uniforme (scarto 10-17%, cioè rumore). Il meccanismo è sano.
   La causa è un'altra, ed è aritmetica — la probabilità di RIVEDERE una domanda alla prova dopo:

     fino al 27/08 (3 normali + 1 trappola)   normali 31%   trabocchetto 11%
     dal mattino   (2 normali + 2 trappole)   normali 15%   trabocchetto 42%
     da mezzogiorno(2 normali + 3 trappole)   normali 15%   trabocchetto 62%   ⇐ peggiorata da noi

   ⚖️ Alzando le trabocchetto a 3 abbiamo **triplicato** la ripetizione proprio dove lui la
   notava: pescandone 3 su 12, la banca gira in ~12 prove invece di ~25. Le 12 domande nuove
   alla rovescia non bastavano a compensare: il numero di pescate per giro conta più della
   dimensione della banca.

   ⇒ La cura non è allargare ancora la banca (rincorsa senza fine): è **non ripescare ciò che
   il socio ha già visto**, finché c'è altro da dargli.

   🚨⭐⭐ IL VINCOLO CHE DECIDE LA FORMA, e senza il quale questa cura sarebbe un guasto: la
   pescata dev'essere **RIPETIBILE**, perché alla consegna il server RIPESCA per correggere
   (`index.ts`, azione `consegna`) invece di fidarsi degli id che arrivano dal telefono — è
   quella rilettura a impedire che un client scelga le proprie domande. ⇒ Se l'elenco delle
   «già viste» cambiasse fra una risposta e la consegna, il socio verrebbe corretto su domande
   che non ha mai visto.
   ⭐ Perciò le viste NON sono «le sue schede di adesso», ma **le schede consegnate PRIMA che
   questo gettone nascesse** (`assessment_tokens.created_at`): il passato non cambia, quindi
   l'insieme è immutabile per costruzione — nessuna colonna nuova, nessuno stato da tenere
   pulito, e la ragione della voce 27 («non si salva niente») resta intera.

   ⚖️ E NON è un filtro che può svuotare il pool: è un ORDINAMENTO per freschezza. Prima le mai
   viste, poi le più vecchie, mescolate dentro ogni gruppo. Quando il socio ha visto tutto,
   ricomincia dalle più lontane invece di non ricevere niente — degrada, non fallisce. */
export function ordinaPerFreschezza(lista, viste, rnd) {
  const elenco = Array.isArray(lista) ? lista : [];
  // ⚠️ `viste[0]` è la PIÙ RECENTE: l'indice piccolo vuol dire «vista da poco».
  const recenti = Array.isArray(viste) ? viste.map((v) => assessTxt(v)) : [];
  if (!recenti.length) return assessKnowledgeShuffle(elenco, rnd);
  const gruppi = new Map();
  for (const q of elenco) {
    const i = recenti.indexOf(assessTxt(q && q.id));
    const eta = i < 0 ? Infinity : i;
    if (!gruppi.has(eta)) gruppi.set(eta, []);
    gruppi.get(eta).push(q);
  }
  // Dal più lontano al più recente: `Infinity` (mai vista) per prima, poi gli indici alti.
  const chiavi = Array.from(gruppi.keys()).sort((a, b) => b - a);
  const out = [];
  for (const k of chiavi) {
    for (const q of assessKnowledgeShuffle(gruppi.get(k), rnd)) out.push(q);
  }
  return out;
}

export function assessKnowledgePick(fascia, rnd, viste) {
  const cleanFascia = assessTxt(fascia);
  if (!cleanFascia) return [];
  // 🆕 9/08: la fascia più bassa non ha cancello ⇒ non si pesca niente e non si disegna
  // niente. Vedi il perché sopra la tabella `regole_fascia`.
  if (!assessKnowledgeRegole(cleanFascia).cancello) return [];
  const pool = ASSESS_KNOWLEDGE_BANK.questions.filter(q => q.fascia === cleanFascia);
  if (!pool.length) return [];
  // 🆕 27/08 sera — l'ordine è per FRESCHEZZA, non a caso puro: le mai viste per prime.
  //    Con `viste` vuoto è esattamente la mescolata di prima (vedi `ordinaPerFreschezza`).
  const normali = ordinaPerFreschezza(pool.filter(q => !q.trap), viste, rnd).slice(0, ASSESS_KNOWLEDGE_BANK.pick_normal);
  const trappole = ordinaPerFreschezza(pool.filter(q => q.trap), viste, rnd).slice(0, ASSESS_KNOWLEDGE_BANK.pick_trap);
  return assessKnowledgeShuffle(normali.concat(trappole), rnd).map(q => ({
    id: q.id,
    fascia: q.fascia,
    trap: !!q.trap,
    q: q.q,
    opts: assessKnowledgeShuffle(q.opts, rnd)
  }));
}
// Corregge sulla banca, non su quello che arriva dalla pagina: la risposta giusta non passa
// mai dal modulo. `answers` è { idDomanda: testoScelto }.
export function assessKnowledgeEvaluate(pickedIds, answers, fasciaDichiarata) {
  const ids = Array.isArray(pickedIds) ? pickedIds.filter(Boolean) : [];
  if (!ids.length) {
    // 🆕🚨⭐⭐ 9/08 — SENZA DOMANDE CI SI ARRIVA IN DUE MODI OPPOSTI, e confonderli
    // ribalterebbe la regola:
    //   · la fascia più bassa NON HA cancello ⇒ è passata, e il livello si applica;
    //   · Semi-Pro e Professionista non hanno quiz perché un quiz non valida una
    //     seconda categoria ⇒ vanno in segreteria, e `skip` è ciò che li ferma.
    // ⇒ Serve sapere quale fascia ha dichiarato: senza domande pescate, la fascia non si
    //   può dedurre da quelle. È il motivo per cui questa funzione ha un terzo argomento.
    const senzaCancello = !!assessTxt(fasciaDichiarata) && !assessKnowledgeRegole(fasciaDichiarata).cancello;
    return {
      status: senzaCancello ? 'pass' : 'skip',
      senza_cancello: senzaCancello,
      correct: 0, total: 0, trap_failed: false,
      fascia: assessTxt(fasciaDichiarata),
      bank_version: ASSESS_KNOWLEDGE_BANK.version, questions: []
    };
  }
  const dettaglio = ids.map(id => {
    const q = ASSESS_KNOWLEDGE_BANK.questions.find(item => item.id === id) || null;
    const risposta = assessTxt((answers || {})[id] || '');
    const attesa = q ? assessTxt(q.opts[q.correct] || '') : '';
    return {
      id,
      fascia: q?.fascia || '',
      trap: !!q?.trap,
      domanda: q?.q || '',
      risposta,
      attesa,
      giusta: !!q && !!risposta && assessKey(risposta) === assessKey(attesa)
    };
  });
  const correct = dettaglio.filter(d => d.giusta).length;
  const trapFailed = dettaglio.some(d => d.trap && !d.giusta);
  // 🆕 9/08: la soglia e il peso della trappola sono di QUESTA fascia, non più uguali per
  // tutti. La fascia si prende dalle domande pescate (che la portano dentro), e solo in
  // mancanza da quella dichiarata: le domande sono il fatto, la dichiarazione è un'intenzione.
  const fascia = dettaglio[0]?.fascia || assessTxt(fasciaDichiarata);
  const regole = assessKnowledgeRegole(fascia);
  const promosso = correct >= regole.pass_min_correct && !(regole.trap_wrong_fails && trapFailed);
  return {
    status: promosso ? 'pass' : 'fail',
    correct,
    total: dettaglio.length,
    trap_failed: trapFailed,
    soglia: regole.pass_min_correct,
    fascia,
    bank_version: ASSESS_KNOWLEDGE_BANK.version,
    questions: dettaglio
  };
}
/* ===== /ASSESS-KNOWLEDGE SHARED v1 ===================================================== */

/* ── Il calcolo del livello, anch'esso spostato dal telefono ────────────────────
   Non nasconde un segreto come la banca, ma decide `calculated_level` e `staff_status`:
   lasciarlo di là avrebbe voluto dire correggere il quiz sul server e poi credere al
   telefono sul voto. ⇒ Chi scrive la riga la calcola per intero. ────────────────── */
/* 🩹 LE TRE DIPENDENZE CHE MI ERO DIMENTICATO — 14/08/2026, terzo giro.
   `calculateAssessmentPublicLevel` è stata spostata qui senza portarsi dietro `cleanCell`,
   `normalizeText` e `assessmentPublicScoreFromText`, che nell'app stanno altrove. Risultato:
   `ReferenceError: cleanCell is not defined` sulla CONSEGNA — la pescata funzionava, quindi
   sembrava tutto a posto fino al bottone «Invia».
   ⭐ La lezione è la stessa di tre ore fa e va scritta una volta sola: **spostare una funzione
   vuol dire spostare il suo albero**, non la sua riga. E il banco deve ESEGUIRE il ramo, non
   solo dichiararlo: la prova che mancava è quella che chiama davvero il calcolo del livello. */
export function cleanCell(value) {
  return String(value ?? '').replace(/\u00A0/g, ' ').trim();
}
export function normalizeText(value) {
  return cleanCell(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}
export function assessmentPublicScoreFromText(value, map) {
  const raw = cleanCell(value || '');
  if (!raw) return null;
  const key = normalizeText(raw);
  for (const [needle, score] of map) {
    if (key.includes(normalizeText(needle))) return score;
  }
  return null;
}

export function assessmentPublicTechnicalScores(data) {
  const rally = assessmentPublicScoreFromText(data?.rally, [
    ['Faccio fatica a tenere 3-4 colpi', 1.0],
    ['Tengo lo scambio solo a ritmo lento', 2.0],
    ['Tengo scambi regolari con continuità', 3.0],
    ['Tengo scambi anche con ritmo alto', 4.0],
    ['Costruisco il punto con controllo', 5.0]
  ]);
  const glass = assessmentPublicScoreFromText(data?.glass, [
    ['Evito quasi sempre il vetro', 1.0],
    ['Lo uso solo se la palla è facile', 2.0],
    ['Difendo con il vetro in modo base', 2.5],
    ['Lo uso con continuità anche sotto pressione', 3.5],
    ['Lo uso per difendere e ripartire in attacco', 4.5]
  ]);
  const net = assessmentPublicScoreFromText(data?.net, [
    ['Sto poco a rete', 1.5],
    ['Vado a rete ma faccio fatica a chiudere', 2.0],
    ['Gioco volée semplici', 2.5],
    ['Tengo posizione e controllo le volée', 3.5],
    ['Costruisco e chiudo il punto a rete', 4.5]
  ]);
  const overhead = assessmentPublicScoreFromText(data?.overhead, [
    ['Non li uso', 1.5],
    ['Li provo ma con poca sicurezza', 2.0],
    ['Uso almeno la bandeja in modo semplice', 2.5],
    ['Uso bandeja e smash con controllo', 3.5],
    ['Uso colpi alti in modo tattico e affidabile', 4.5]
  ]);
  const values = [rally, glass, net, overhead].filter(v => typeof v === 'number' && Number.isFinite(v));
  const average = values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
  return { rally, glass, net, overhead, average };
}
export function roundAssessmentToHalf(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return String(Math.max(0.5, Math.min(7, Math.round(n * 2) / 2)));
}
export function calculateAssessmentPublicLevel(data) {
  const declared = parseFloat(assessmentPublicParseLevel(data?.declaredLevel));
  const balanced = parseFloat(assessmentPublicParseLevel(data?.balancedLevel));
  const technical = assessmentPublicTechnicalScores(data);
  const parts = [];
  if (Number.isFinite(declared)) parts.push({ value: declared, weight: 0.40 });
  if (Number.isFinite(balanced)) parts.push({ value: balanced, weight: 0.25 });
  if (Number.isFinite(technical.average)) parts.push({ value: technical.average, weight: 0.35 });

  if (!parts.length) {
    return {
      declared_level: '',
      balanced_level: '',
      calculated_level: '',
      technical_average: '',
      technical_scores: technical,
      raw_score: '',
      coherence: 'medium',
      staff_status: 'review',
      note: 'Dati insufficienti per calcolo tecnico'
    };
  }

  const weightSum = parts.reduce((sum, p) => sum + p.weight, 0);
  const rawScore = parts.reduce((sum, p) => sum + p.value * p.weight, 0) / weightSum;
  let calculated = parseFloat(roundAssessmentToHalf(rawScore));

  // Regole prudenziali: non facciamo salti eccessivi senza verifica.
  if (Number.isFinite(declared)) {
    if (calculated > declared + 0.5) calculated = declared + 0.5;
    if (calculated < declared - 1.0) calculated = declared - 1.0;
    calculated = Math.max(0.5, Math.min(7, Math.round(calculated * 2) / 2));
  }

  const technicalRef = Number.isFinite(technical.average) ? technical.average : (Number.isFinite(balanced) ? balanced : calculated);
  const diff = Number.isFinite(declared) ? Math.abs(declared - technicalRef) : 0;
  const coherence = diff <= 0.5 ? 'high' : (diff <= 1 ? 'medium' : 'low');
  const staffStatus = coherence === 'low' ? 'review' : '';

  return {
    declared_level: Number.isFinite(declared) ? String(declared) : '',
    balanced_level: Number.isFinite(balanced) ? String(balanced) : '',
    calculated_level: String(calculated),
    technical_average: Number.isFinite(technical.average) ? String(Math.round(technical.average * 100) / 100) : '',
    technical_scores: technical,
    raw_score: String(Math.round(rawScore * 1000) / 1000),
    coherence,
    staff_status: staffStatus,
    note: coherence === 'low' ? 'Differenza alta tra livello dichiarato e risposte tecniche: verificare staff.' : ''
  };
}
export function assessmentPublicParseLevel(value) {
  const raw = cleanCell(value || '');
  if (!raw) return '';
  const normalized = raw.replace(',', '.').trim();
  if (/^\s*5\+/.test(normalized)) return '5';
  const match = normalized.match(/\d+(?:\.\d+)?/);
  return match ? match[0] : '';
}
/* ── Il seme: dalle stesse due stringhe escono sempre le stesse quattro domande ──────────
   FNV-1a sul gettone e sulla fascia, poi mulberry32. Non è crittografia e non deve esserlo:
   non protegge un segreto, serve solo a essere RIPETIBILE. Il segreto — le risposte — non
   esce mai da questo file. */
// ⚙️ Senza annotazioni di tipo di proposito: così `test/assessment-quiz.test.mjs` può
// eseguirle in una VM insieme al blocco, e la ripetibilità del pesca è PROVATA, non promessa.
export function seme(...parti) {
  let h = 0x811c9dc5;
  for (const p of parti) {
    for (let i = 0; i < p.length; i++) {
      h ^= p.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  }
  return h >>> 0;
}
export function sorteDa(s) {
  let a = s >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Le quattro domande di QUESTO socio per QUESTA fascia. Deterministiche. */
/** Quante domande di conoscenza si pescano in un giro (normali + trabocchetto).
 *  ⭐ Esportata perché il CONTO delle domande lo annuncia il bot prima che il test cominci
 *  (`domandeTotaliPreviste` in `passi.js`): il numero vive dove vivono le domande, e il giorno
 *  in cui la pescata cambia, l'annuncio cambia da sé — nessun 4 o 5 scritto altrove. */
export function quantePescate() {
  return ASSESS_KNOWLEDGE_BANK.pick_normal + ASSESS_KNOWLEDGE_BANK.pick_trap;
}
export function pescaPerGettone(token, fascia, viste) {
  return assessKnowledgePick(fascia, sorteDa(seme(token, assessTxt(fascia))), viste);
}

