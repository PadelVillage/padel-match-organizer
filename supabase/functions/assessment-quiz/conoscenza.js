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
  pick_normal: 3,
  pick_trap: 1,
  pass_min_correct: 3,     // su 4 pescate
  trap_wrong_fails: true,  // la trappola sbagliata boccia da sola, anche con le altre 3 giuste
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
    // Nessun quiz: si passa dichiarando Principiante. Il livello che se ne ricava è il minimo.
    Principiante: { cancello: false },
    // Un minimo di verifica resta, ma con margine e senza che la trappola sbarri da sola.
    Base: { pass_min_correct: 2, trap_wrong_fails: false }
  },
  questions: [
    // ── Principiante ────────────────────────────────────────────────────────────────
    { id:'P-01', fascia:'Principiante', trap:false, q:'Quanti giocatori ci sono in campo in una partita di padel?', opts:[
      'Due, uno per parte',
      'Quattro, due per parte',
      'Sei, tre per parte',
      'Dipende dal circolo'], correct:1 },
    { id:'P-02', fascia:'Principiante', trap:false, q:'Come si esegue il servizio?', opts:[
      'Si lancia la palla in aria e si colpisce sopra la testa, come nel tennis',
      'Si colpisce al volo, senza farla rimbalzare',
      'Si fa rimbalzare la palla a terra e la si colpisce sotto la vita',
      'Si può scegliere: al volo oppure dopo il rimbalzo'], correct:2 },
    { id:'P-03', fascia:'Principiante', trap:false, q:'La palla arriva dagli avversari e colpisce il vetro del mio campo SENZA aver prima rimbalzato a terra. Cosa succede?', opts:[
      'Punto mio: la palla doveva prima rimbalzare a terra',
      'Punto degli avversari',
      'Si rigioca il punto',
      'Il gioco continua, posso ancora giocarla'], correct:0 },
    { id:'P-04', fascia:'Principiante', trap:false, q:'Come si conta il punteggio nel padel?', opts:[
      'Ogni scambio vale un punto, fino a 11',
      'A tempo: vince chi è avanti allo scadere',
      'A punti fino a 21',
      'Come nel tennis: 15, 30, 40, gioco'], correct:3 },
    { id:'P-T1', fascia:'Principiante', trap:true,  q:'Quando si applica la regola del «doppio rimbalzo difensivo», che concede due rimbalzi a terra a chi difende?', opts:[
      'Solo sul punteggio di 40-40',
      'Non esiste: la palla può rimbalzare a terra una volta sola',
      'Quando si è sotto di due giochi nel set',
      'Solo sulla risposta al servizio'], correct:1 },
    { id:'P-T2', fascia:'Principiante', trap:true,  q:'In quale situazione l\'arbitro fischia il «fallo di vetro incrociato»?', opts:[
      'Quando la palla tocca due vetri diversi di seguito',
      'Quando la palla torna nel campo di chi l\'ha colpita',
      'Non esiste un fallo con questo nome',
      'Quando si colpisce la palla dopo il vetro laterale'], correct:2 },

    // ── Base ────────────────────────────────────────────────────────────────────────
    { id:'B-01', fascia:'Base', trap:false, q:'Dove deve rimbalzare la palla del servizio?', opts:[
      'In qualunque punto del campo avversario',
      'Nel riquadro in diagonale rispetto a chi serve',
      'Oltre la linea di metà campo',
      'Vicino al vetro di fondo'], correct:1 },
    { id:'B-02', fascia:'Base', trap:false, q:'Chi riceve il servizio può rispondere al volo?', opts:[
      'Sì, se resta dietro la linea di servizio',
      'Sì, sempre: è una scelta di chi riceve',
      'No, deve prima lasciar rimbalzare la palla',
      'Solo sul secondo servizio'], correct:2 },
    { id:'B-03', fascia:'Base', trap:false, q:'La palla rimbalza a terra nel mio campo e poi va sul mio vetro. Posso giocarla dopo il vetro?', opts:[
      'Sì: dopo il rimbalzo a terra posso lasciarla andare sul vetro e rigiocarla',
      'No: dopo il rimbalzo devo colpirla prima che tocchi il vetro',
      'No: se tocca il mio vetro il punto è degli avversari',
      'Sì, ma solo se tocca il vetro di fondo'], correct:0 },
    { id:'B-04', fascia:'Base', trap:false, q:'Quanti tentativi di servizio hai a disposizione?', opts:[
      'Uno solo',
      'Due, come nel tennis',
      'Tre',
      'Due, ma solo nel primo gioco'], correct:1 },
    { id:'B-T1', fascia:'Base', trap:true,  q:'Quando è consentito il «servizio a cucchiaio doppio», che permette di far rimbalzare la palla due volte prima di batterla?', opts:[
      'Solo in doppio misto',
      'Dopo un primo servizio fallito',
      'Mai: non esiste un servizio di questo tipo',
      'Nei tornei amatoriali, se le coppie sono d\'accordo'], correct:2 },
    { id:'B-T2', fascia:'Base', trap:true,  q:'Dopo aver vinto un punto con lo smash, la coppia deve cambiare lato di ricezione. Quando vale questa regola?', opts:[
      'Sempre, in ogni categoria',
      'Solo nei tornei federali',
      'Solo nel set decisivo',
      'Mai: questa regola non esiste'], correct:3 },

    // ── Intermedio ──────────────────────────────────────────────────────────────────
    { id:'I-01', fascia:'Intermedio', trap:false, q:'A cosa serve soprattutto la bandeja?', opts:[
      'A chiudere il punto con la massima potenza',
      'A restare a rete controllando il pallonetto avversario',
      'A difendere sul vetro di fondo',
      'A rispondere al servizio'], correct:1 },
    { id:'I-02', fascia:'Intermedio', trap:false, q:'Perché un pallonetto troppo corto è pericoloso?', opts:[
      'Perché è quasi sempre fuori',
      'Perché il compagno non fa in tempo a salire',
      'Perché regala agli avversari uno smash comodo',
      'Perché non si può giocare di rovescio'], correct:2 },
    { id:'I-05', fascia:'Intermedio', trap:false, q:'In uno scambio, quale coppia si trova in vantaggio?', opts:[
      'Quella a fondo campo, perché ha più tempo per preparare i colpi',
      'Quella a rete: da lì si chiude il punto',
      'Nessuna delle due: nel padel la posizione non conta',
      'Quella che ha vinto il punto precedente'], correct:1 },
    { id:'I-04', fascia:'Intermedio', trap:false, q:'Quando conviene salire a rete in coppia?', opts:[
      'Appena possibile, sempre e comunque',
      'Uno alla volta, così uno resta a coprire il fondo',
      'Solo dopo aver vinto lo scambio precedente',
      'Insieme al compagno, dopo un colpo che dà il tempo di salire'], correct:3 },
    { id:'I-T1', fascia:'Intermedio', trap:true,  q:'A cosa serve la «vibora a doppio taglio inverso»?', opts:[
      'A far rimbalzare la palla verso il proprio campo',
      'A servire con effetto contrario',
      'Non esiste un colpo con questo nome',
      'A difendere sul vetro laterale'], correct:2 },
    { id:'I-T2', fascia:'Intermedio', trap:true,  q:'Cosa stabilisce la «regola dei tre vetri», sul numero di pareti che la palla può toccare nel proprio campo?', opts:[
      'Che se ne possono toccare al massimo tre',
      'Che dopo tre vetri il punto si rigioca',
      'Che valgono solo nei campi coperti',
      'Non esiste: la regola è che la palla non rimbalzi due volte a terra'], correct:3 },

    // ── Avanzato ────────────────────────────────────────────────────────────────────
    { id:'A-01', fascia:'Avanzato', trap:false, q:'Che colpo è la vibora?', opts:[
      'Un colpo alto tagliato di lato, che dopo il rimbalzo resta basso e scivola',
      'Un pallonetto difensivo molto profondo',
      'Una volée bassa giocata incrociata',
      'Uno smash giocato con la massima potenza'], correct:0 },
    { id:'A-02', fascia:'Avanzato', trap:false, q:'Che colpo è la chiquita?', opts:[
      'Un pallonetto corto sul rovescio',
      'Una palla bassa e lenta giocata ai piedi di chi sta a rete',
      'Un servizio tagliato verso il vetro',
      'Uno smash controllato che non fa uscire la palla'], correct:1 },
    { id:'A-03', fascia:'Avanzato', trap:false, q:'Quando si gioca la bajada?', opts:[
      'A rete, su una volée alta',
      'Come variante del servizio',
      'Su una palla che esce dal vetro, colpendola in discesa per attaccare',
      'Solo in difesa, dopo un pallonetto avversario'], correct:2 },
    { id:'A-04', fascia:'Avanzato', trap:false, q:'Gli avversari giocano pallonetti molto buoni. Qual è la gestione più solida dei colpi alti?', opts:[
      'Smash a tutta forza a ogni occasione',
      'Lasciar rimbalzare e ripartire sempre da fondo campo',
      'Cambiare posizione con il compagno a ogni pallonetto',
      'Alternare bandeja e vibora di controllo per non perdere la rete'], correct:3 },
    { id:'A-T1', fascia:'Avanzato', trap:true,  q:'In quale situazione si usa il «cambio de pared australiano»?', opts:[
      'Quando si difende sul vetro laterale',
      'Non esiste un colpo con questo nome',
      'Quando si risponde a una vibora',
      'Quando si attacca dopo il doppio vetro'], correct:1 },
    { id:'A-T2', fascia:'Avanzato', trap:true,  q:'Come si esegue la «sotana in sospensione»?', opts:[
      'Saltando e colpendo la palla sotto la vita',
      'Colpendo la palla dopo due rimbalzi sul vetro',
      'Con la racchetta rovesciata, per dare effetto',
      'Non esiste un colpo con questo nome'], correct:3 },

    // ── Agonista ────────────────────────────────────────────────────────────────────
    { id:'AG-01', fascia:'Agonista', trap:false, q:'Che cos\'è lo smash «x4»?', opts:[
      'Uno smash che fa uscire la palla oltre il vetro di fondo, alto 4 metri',
      'Uno smash che fa uscire la palla dalla porta laterale',
      'Uno smash giocato dopo quattro colpi di scambio',
      'Uno smash che rimbalza quattro volte'], correct:0 },
    { id:'AG-02', fascia:'Agonista', trap:false, q:'Che cos\'è la controparete?', opts:[
      'Una volée giocata appoggiandosi al vetro laterale',
      'Un colpo mandato prima contro il proprio vetro e poi oltre la rete',
      'Un pallonetto che muore sul vetro di fondo',
      'Un servizio che tocca la parete prima del rimbalzo'], correct:1 },
    { id:'AG-03', fascia:'Agonista', trap:false, q:'Lo smash manda la palla fuori dal campo e l\'avversario esce dalla porta e la rimette dentro. Cosa succede?', opts:[
      'Punto nostro: fuori dal campo non si può giocare',
      'Punto nostro, se la palla ha superato il vetro di fondo',
      'Si rigioca il punto',
      'Il punto continua: uscire e rimettere la palla in campo è valido'], correct:3 },
    { id:'AG-04', fascia:'Agonista', trap:false, q:'Sul servizio, la palla rimbalza nel riquadro giusto e poi tocca la rete metallica prima che il ricevente la colpisca. Cosa succede?', opts:[
      'Il gioco continua normalmente',
      'È fallo di servizio',
      'Punto diretto di chi serve',
      'Si ripete il servizio, come il nastro nel tennis'], correct:1 },
    { id:'AG-T1', fascia:'Agonista', trap:true,  q:'Quando si parla di smash «x5»?', opts:[
      'Quando la palla esce oltre la tribuna',
      'Quando la palla rimbalza cinque metri oltre il campo',
      'Non esiste: si parla di x3 e x4',
      'Quando lo smash chiude il punto al quinto colpo'], correct:2 },
    { id:'AG-T2', fascia:'Agonista', trap:true,  q:'Cosa prevede la regola del «punto d\'oro obbligatorio dopo tre vantaggi»?', opts:[
      'Che dopo tre vantaggi il gioco si assegna a chi serve',
      'Che dopo tre vantaggi si gioca un punto secco',
      'Che vale solo nei tornei federali',
      'Non esiste: il punto d\'oro, dove previsto, si gioca sul 40-40'], correct:3 },

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
      'Dopo un rimbalzo a terra, all\'altezza della vita o più in basso',
      'Al volo, sopra la testa, come nel tennis',
      'Dopo due rimbalzi a terra',
      'Come si preferisce: non ci sono vincoli'], correct:0 },
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
      'Non esiste un servizio con questo nome',
      'Quando la coppia ha perso due game di fila'], correct:2 },

    // ── Intermedio ──────────────────────────────────────────────────────────────────
    { id:'I-06', fascia:'Intermedio', trap:false, q:'Che cos\'è il pallonetto (globo)?', opts:[
      'Una palla alta e profonda per far arretrare chi è a rete',
      'Un colpo piatto e veloce lungolinea',
      'Una palla corta che muore appena oltre la rete',
      'Un servizio giocato molto lento'], correct:0 },
    { id:'I-07', fascia:'Intermedio', trap:false, q:'Finito un game al servizio, chi serve nel game successivo?', opts:[
      'Il compagno di chi ha appena servito',
      'Uno dei due avversari',
      'Sempre lo stesso giocatore, finché non perde il game',
      'Chi ha vinto il game precedente'], correct:1 },
    { id:'I-08', fascia:'Intermedio', trap:false, q:'Che cos\'è la «salida de pared» (uscita di parete)?', opts:[
      'Un servizio che sfrutta il vetro laterale',
      'La palla che, dopo il rimbalzo a terra, esce dal vetro e va giocata lì',
      'L\'uscita del giocatore dalla porta del campo',
      'Un colpo mandato di proposito contro la parete avversaria'], correct:1 },
    { id:'I-09', fascia:'Intermedio', trap:false, q:'Dopo il rimbalzo a terra nel mio campo la palla tocca la griglia metallica. Posso ancora giocarla?', opts:[
      'No: la griglia interrompe sempre il punto',
      'Sì, purché non rimbalzi una seconda volta a terra',
      'Solo se la tocca sopra la metà',
      'Sì, ma vale mezzo punto'], correct:1 },
    { id:'I-T3', fascia:'Intermedio', trap:true,  q:'Quando si usa il «rimbalzo assistito di parete»?', opts:[
      'Per difendere gli smash molto profondi',
      'Quando la palla resta incastrata fra vetro e griglia',
      'Non esiste una regola con questo nome',
      'Solo nei campi con pareti in muratura'], correct:2 },

    // ── Avanzato ────────────────────────────────────────────────────────────────────
    { id:'A-05', fascia:'Avanzato', trap:false, q:'Un pallonetto profondo finisce sul vetro di fondo del mio campo. Come si gioca correttamente?', opts:[
      'Colpendola prima che tocchi il vetro, sempre',
      'Dopo il rimbalzo a terra, aspettando che esca dalla parete',
      'Lasciandola rimbalzare due volte a terra',
      'Solo al volo, prima del rimbalzo'], correct:1 },
    { id:'A-06', fascia:'Avanzato', trap:false, q:'Che differenza c\'è fra bandeja e vibora?', opts:[
      'Nessuna: sono due nomi dello stesso colpo',
      'La bandeja si gioca di rovescio, la vibora di dritto',
      'La vibora è più veloce e con più effetto laterale; la bandeja è di controllo',
      'La bandeja si gioca solo in difesa, la vibora solo al servizio'], correct:2 },
    { id:'A-07', fascia:'Avanzato', trap:false, q:'Durante lo scambio la palla colpisce un giocatore prima di rimbalzare a terra. Cosa succede?', opts:[
      'Si rigioca il punto',
      'Punto per la coppia che ha colpito la palla',
      'Punto per la coppia del giocatore colpito',
      'Il gioco continua se la palla resta in campo'], correct:1 },
    { id:'A-08', fascia:'Avanzato', trap:false, q:'La palla che ho colpito tocca la parete del campo avversario PRIMA di rimbalzare a terra. Cosa succede?', opts:[
      'Il punto continua normalmente',
      'Punto per gli avversari: doveva rimbalzare prima a terra',
      'Punto mio, se la parete è quella di fondo',
      'Si rigioca il punto'], correct:1 },
    { id:'A-T3', fascia:'Avanzato', trap:true,  q:'In quale situazione si concede il «recupero di parete doppia»?', opts:[
      'Quando la palla tocca due pareti prima del rimbalzo',
      'Quando il campo ha le pareti in cristallo su tre lati',
      'Solo in difesa, dopo uno smash x4',
      'Non esiste una regola con questo nome'], correct:3 },

    // ── Agonista ────────────────────────────────────────────────────────────────────
    { id:'AG-05', fascia:'Agonista', trap:false, q:'Che cos\'è la «dormilona»?', opts:[
      'Uno smash smorzato che fa morire la palla appena oltre la rete',
      'Un pallonetto giocato con effetto all\'indietro',
      'Una difesa lenta per prendere tempo',
      'Un servizio giocato senza effetto'], correct:0 },
    { id:'AG-06', fascia:'Agonista', trap:false, q:'Nel punto d\'oro, chi sceglie da che lato ricevere?', opts:[
      'La coppia che serve',
      'La coppia che riceve',
      'L\'arbitro, o il sorteggio',
      'Si gioca sempre dal lato destro'], correct:1 },
    { id:'AG-07', fascia:'Agonista', trap:false, q:'Un giocatore colpisce la palla due volte nello stesso colpo. Cosa succede?', opts:[
      'Il punto continua se il doppio tocco è involontario',
      'Punto per gli avversari',
      'Si rigioca il punto',
      'Vale, purché la palla passi la rete'], correct:1 },
    { id:'AG-08', fascia:'Agonista', trap:false, q:'Nel tie-break, ogni quanti punti si cambia campo?', opts:[
      'Ogni 4 punti',
      'Ogni 6 punti',
      'Solo a metà, sul 6-6',
      'Non si cambia campo nel tie-break'], correct:1 },
    { id:'AG-T3', fascia:'Agonista', trap:true,  q:'Quando si applica la «regola del doppio rimbalzo consentito in difesa»?', opts:[
      'Quando la palla arriva da uno smash x4',
      'Quando il campo è bagnato',
      'Solo nel padel indoor',
      'Non esiste: il secondo rimbalzo a terra chiude sempre il punto'], correct:3 }
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
export function assessKnowledgePick(fascia, rnd) {
  const cleanFascia = assessTxt(fascia);
  if (!cleanFascia) return [];
  // 🆕 9/08: la fascia più bassa non ha cancello ⇒ non si pesca niente e non si disegna
  // niente. Vedi il perché sopra la tabella `regole_fascia`.
  if (!assessKnowledgeRegole(cleanFascia).cancello) return [];
  const pool = ASSESS_KNOWLEDGE_BANK.questions.filter(q => q.fascia === cleanFascia);
  if (!pool.length) return [];
  const normali = assessKnowledgeShuffle(pool.filter(q => !q.trap), rnd).slice(0, ASSESS_KNOWLEDGE_BANK.pick_normal);
  const trappole = assessKnowledgeShuffle(pool.filter(q => q.trap), rnd).slice(0, ASSESS_KNOWLEDGE_BANK.pick_trap);
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
export function pescaPerGettone(token, fascia) {
  return assessKnowledgePick(fascia, sorteDa(seme(token, assessTxt(fascia))));
}

