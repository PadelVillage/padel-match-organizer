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
      'Non esiste: il secondo rimbalzo a terra chiude sempre il punto'], correct:3 },

    /* 🆕📚⭐⭐ 25/08/2026 — PRINCIPIANTE SI ALLARGA A 27 NORMALI + 9 TRAPPOLE.
       Sua decisione di stamattina, presa insieme alle altre tre del disegno nuovo: il quiz
       vale ANCHE per i Principianti, e la banca di ogni fascia arriva a 27+9 così che in una
       giornata di tre prove un socio ne veda al massimo un terzo.
       📏 Il conto che l'ha resa necessaria: 3 prove × 4 domande = 12 viste contro le 11 che
       esistevano ⇒ in un giorno solo si vedeva la banca intera, trappole comprese.

       ⛔⛔ QUESTE DOMANDE NON SONO ANCORA IN SERVIZIO, ed è deliberato: `regole_fascia`
       dice ancora `Principiante: { cancello: false }`, quindi da questa fascia non si pesca
       niente e la banca resta inerte. Si accende in un secondo momento, quando le domande
       saranno state corrette da lui — accenderla prima vorrebbe dire mandare in servizio un
       cancello che nessuno ha letto.

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
      'No: appena tocca il vetro il punto è degli avversari',
      'Sì: dopo il rimbalzo a terra posso giocarla di parete',
      'Solo se il vetro è quello laterale, non quello di fondo',
      'Sì, ma il punto vale la metà'], correct:1 },
    { id:'P-06', fascia:'Principiante', trap:false, q:'Il mio compagno serve. Chi riceve può rispondere al volo, prima che la palla rimbalzi?', opts:[
      'Sì, se è abbastanza veloce',
      'No: la risposta al servizio si gioca sempre dopo il rimbalzo',
      'Sì, ma solo sul secondo servizio',
      'Solo se sta già a rete'], correct:1 },
    { id:'P-07', fascia:'Principiante', trap:false, q:'Com\'è fatta la racchetta da padel?', opts:[
      'Con le corde come quella da tennis, ma più piccola',
      'Piena e forata, senza corde',
      'Di legno pieno, senza fori',
      'Con le corde solo nella parte alta'], correct:1 },
    { id:'P-08', fascia:'Principiante', trap:false, q:'Quanti servizi ha a disposizione chi batte?', opts:[
      'Uno solo',
      'Due, come nel tennis',
      'Tre',
      'Illimitati, finché non entra'], correct:1 },
    { id:'P-09', fascia:'Principiante', trap:false, q:'Dove deve rimbalzare il servizio?', opts:[
      'In un punto qualsiasi del campo avversario',
      'In diagonale, dentro il quadrato di servizio avversario',
      'Dritto davanti a sé, nel quadrato avversario',
      'Oltre la linea di fondo avversaria'], correct:1 },
    { id:'P-10', fascia:'Principiante', trap:false, q:'Durante lo scambio la palla colpisce il mio compagno sul corpo. Cosa succede?', opts:[
      'Punto degli avversari',
      'Si rigioca il punto',
      'Non succede niente, il gioco continua',
      'Punto nostro, se non l\'ha fatto apposta'], correct:0 },
    { id:'P-11', fascia:'Principiante', trap:false, q:'Rimando la palla e questa colpisce PRIMA il vetro del mio campo, poi passa dall\'altra parte. È valido?', opts:[
      'Sì, se poi entra nel campo avversario',
      'No: la palla deve passare la rete direttamente — punto degli avversari',
      'Sì, ma solo con il vetro di fondo',
      'Si rigioca il punto'], correct:1 },
    { id:'P-12', fascia:'Principiante', trap:false, q:'Il servizio tocca il nastro della rete e poi rimbalza regolarmente nel quadrato giusto. Cosa succede?', opts:[
      'È fallo: si passa al secondo servizio',
      'Il servizio si ripete',
      'Il gioco continua normalmente',
      'Punto per chi serve'], correct:1 },
    { id:'P-13', fascia:'Principiante', trap:false, q:'Come finisce una partita di padel?', opts:[
      'A tempo: dopo 60 minuti vince chi è avanti',
      'Al meglio dei tre set, come nel tennis',
      'Quando una coppia arriva a 21 punti',
      'Dopo un numero fisso di scambi'], correct:1 },
    { id:'P-14', fascia:'Principiante', trap:false, q:'Da dove batte chi serve?', opts:[
      'Da dietro la linea di fondo, come nel tennis',
      'Da dietro la linea di servizio, facendo prima rimbalzare la palla a terra',
      'Da un punto qualsiasi del proprio campo',
      'Da vicino alla rete'], correct:1 },
    { id:'P-15', fascia:'Principiante', trap:false, q:'Posso colpire la palla al volo, prima che rimbalzi?', opts:[
      'No, mai: nel padel la palla deve sempre rimbalzare',
      'Sì, sempre — tranne sulla risposta al servizio',
      'Sì, sempre, senza nessuna eccezione',
      'Solo se sto a rete'], correct:1 },
    { id:'P-16', fascia:'Principiante', trap:false, q:'Da cosa è chiuso il campo da padel?', opts:[
      'Da niente: è aperto come quello da tennis',
      'Da pareti di vetro e reti metalliche, su tutti i lati',
      'Solo da due pareti di fondo, i lati sono aperti',
      'Da una recinzione bassa che non entra in gioco'], correct:1 },
    { id:'P-17', fascia:'Principiante', trap:false, q:'Durante lo scambio tocco la rete con la racchetta. Cosa succede?', opts:[
      'Punto degli avversari',
      'Non succede niente, il gioco continua',
      'Si rigioca il punto',
      'La prima volta è solo un avvertimento'], correct:0 },
    { id:'P-18', fascia:'Principiante', trap:false, q:'In che ordine si serve?', opts:[
      'Serve sempre lo stesso giocatore per tutta la partita',
      'A turno tutti e quattro, alternando le due coppie',
      'Serve chi ha vinto il punto precedente',
      'Si decide all\'inizio di ogni game'], correct:1 },
    { id:'P-19', fascia:'Principiante', trap:false, q:'La palla può rimbalzare a terra due volte prima che io la colpisca?', opts:[
      'Sì, nel padel sono concessi due rimbalzi',
      'No: un solo rimbalzo a terra',
      'Sì, ma solo in difesa',
      'Sì, se il secondo rimbalzo è dietro la linea di servizio'], correct:1 },
    { id:'P-20', fascia:'Principiante', trap:false, q:'Cosa vuol dire che una coppia «va a rete»?', opts:[
      'Che ha toccato la rete con la racchetta',
      'Che i due giocatori avanzano verso la rete per attaccare',
      'Che gioca solo palle basse',
      'Che rinuncia al servizio'], correct:1 },
    { id:'P-21', fascia:'Principiante', trap:false, q:'Il servizio rimbalza nel quadrato giusto e poi colpisce la rete metallica (la griglia). Cosa succede?', opts:[
      'È valido: il gioco continua',
      'È fallo di servizio',
      'Il servizio si ripete',
      'Punto per chi serve'], correct:1 },
    { id:'P-22', fascia:'Principiante', trap:false, q:'Con cosa si può colpire la palla?', opts:[
      'Solo con il piatto forato della racchetta',
      'Con qualunque parte della racchetta, ma mai con la mano o con il corpo',
      'Anche con la mano libera, una volta per game',
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
      'Il gioco continua: dopo il rimbalzo a terra la palla può toccare griglia e vetri',
      'Si rigioca il punto',
      'Punto degli avversari'], correct:1 },
    { id:'P-26', fascia:'Principiante', trap:false, q:'Si cambia campo durante la partita?', opts:[
      'No, mai',
      'Sì, alla fine dei game dispari (1°, 3°, 5°…)',
      'Sì, alla fine di ogni game',
      'Solo alla fine di ogni set'], correct:1 },
    { id:'P-27', fascia:'Principiante', trap:false, q:'Io e il mio compagno colpiamo la stessa palla, uno dopo l\'altro. Cosa succede?', opts:[
      'Punto degli avversari: la palla si colpisce una volta sola',
      'Il gioco continua, se la palla passa la rete',
      'Si rigioca il punto',
      'Punto nostro'], correct:0 },

    // ── Principiante · trappole — dove l'intuito del tennis porta fuori strada ──────
    { id:'P-T3', fascia:'Principiante', trap:true,  q:'Quando si applica la «regola dei due tocchi», che permette ai due compagni di passarsi la palla prima di rimandarla?', opts:[
      'Solo in difesa',
      'Non esiste: la palla si colpisce una volta sola',
      'Solo dopo un pallonetto',
      'Nei primi due game della partita'], correct:1 },
    { id:'P-T4', fascia:'Principiante', trap:true,  q:'Quando è concesso il servizio colpito sopra la testa, come nel tennis?', opts:[
      'Sul secondo servizio',
      'Mai: nel padel il servizio si colpisce sempre all\'altezza della vita o più in basso',
      'Quando si è sotto nel punteggio',
      'Solo nei tornei'], correct:1 },
    { id:'P-T5', fascia:'Principiante', trap:true,  q:'Quando viene concesso il «rimbalzo di cortesia», cioè un rimbalzo in più a chi riceve?', opts:[
      'Nel primo game della partita',
      'Non esiste: chi riceve non ha nessun rimbalzo in più',
      'Quando il servizio tocca il nastro',
      'Dopo ogni cambio campo'], correct:1 },
    { id:'P-T6', fascia:'Principiante', trap:true,  q:'Che cos\'è il «punto di vetro»?', opts:[
      'Un punto che vale doppio se lo si chiude con un colpo di parete',
      'Non esiste: nel padel nessun punto vale più di un altro',
      'Il punto che chiude il set',
      'Il punto che si rigioca quando un vetro è bagnato'], correct:1 },
    { id:'P-T7', fascia:'Principiante', trap:true,  q:'In quale caso si può giocare la palla con la mano libera?', opts:[
      'Una volta per game',
      'Mai: si gioca solo con la racchetta',
      'Solo per fermare la palla, non per rimandarla',
      'Quando si è caduti a terra'], correct:1 },
    { id:'P-T8', fascia:'Principiante', trap:true,  q:'Quando si applica il «cambio di coppia», la regola che a metà set fa scambiare un giocatore con un avversario?', opts:[
      'Solo negli allenamenti',
      'Non esiste: le coppie restano le stesse per tutta la partita',
      'Sul 3-3',
      'Lo decide chi ha prenotato il campo'], correct:1 },
    { id:'P-T9', fascia:'Principiante', trap:true,  q:'Un avversario schiaccia, la palla rimbalza nel mio campo e vola fuori sopra le pareti. Il punto è finito?', opts:[
      'Sì: appena la palla esce dal campo il punto è chiuso',
      'No: dove il campo lo consente posso uscire dalla porta e rimandarla dentro',
      'No, ma solo se non tocco terra fuori dal campo',
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
      'Sì, punto mio: hanno il vetro alle spalle',
      'No: dopo il rimbalzo a terra possono giocarla di parete',
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
      'Uno al centro e uno appoggiato al vetro'], correct:1 },
    { id:'B-12', fascia:'Base', trap:false, q:'A cosa serve soprattutto il pallonetto?', opts:[
      'A fare punto diretto',
      'A far arretrare gli avversari e riprendersi la rete',
      'A guadagnare tempo per riprendere fiato',
      'A far rimbalzare la palla sul vetro'], correct:1 },
    { id:'B-13', fascia:'Base', trap:false, q:'Dopo il rimbalzo a terra la palla tocca DUE pareti del mio campo, una dopo l\'altra. Posso ancora giocarla?', opts:[
      'No: due pareti chiudono il punto',
      'Sì: dopo il rimbalzo a terra posso giocarla comunque',
      'Solo se sono due vetri e non la griglia',
      'Solo se sto difendendo'], correct:1 },
    { id:'B-14', fascia:'Base', trap:false, q:'Sono uscito dalla porta del campo per rincorrere una palla. Posso rimandarla dentro?', opts:[
      'No: fuori dal campo non si può più giocare',
      'Sì, purché la palla abbia prima rimbalzato dentro il mio campo',
      'Sì, sempre, anche se non ha rimbalzato',
      'Solo nei tornei ufficiali'], correct:1 },
    { id:'B-15', fascia:'Base', trap:false, q:'Che cos\'è la «bandeja»?', opts:[
      'Uno smash colpito a tutta forza',
      'Un colpo sopra la testa, controllato, che serve a non perdere la rete',
      'Un pallonetto giocato in difesa',
      'Un servizio con effetto'], correct:1 },
    { id:'B-16', fascia:'Base', trap:false, q:'Cosa deve avere obbligatoriamente la racchetta da padel?', opts:[
      'Niente di obbligatorio',
      'Il cordino da polso, per non farla sfuggire di mano',
      'Il grip di colore scuro',
      'Un peso non superiore a 300 grammi'], correct:1 },
    { id:'B-17', fascia:'Base', trap:false, q:'La palla che ho colpito passa la rete e colpisce direttamente la griglia avversaria, senza rimbalzare a terra. Cosa succede?', opts:[
      'Punto mio',
      'Punto degli avversari: doveva prima rimbalzare a terra',
      'Il gioco continua: possono ancora giocarla',
      'Si rigioca il punto'], correct:1 },
    { id:'B-18', fascia:'Base', trap:false, q:'Quanti game servono per vincere un set?', opts:[
      'Quattro',
      'Sei, con almeno due game di scarto',
      'Otto',
      'Dipende da quanto tempo si è prenotato'], correct:1 },
    { id:'B-19', fascia:'Base', trap:false, q:'Mentre la palla è in gioco la racchetta mi sfugge di mano e finisce nel campo avversario. Cosa succede?', opts:[
      'Punto degli avversari',
      'Il gioco continua',
      'Si rigioca il punto',
      'È solo un avvertimento la prima volta'], correct:0 },
    { id:'B-20', fascia:'Base', trap:false, q:'Chi serve, batte sempre dallo stesso lato del campo?', opts:[
      'Sì, per tutto il game',
      'No: alterna destra e sinistra a ogni punto',
      'Cambia lato ogni due punti',
      'Lo sceglie chi riceve'], correct:1 },
    { id:'B-21', fascia:'Base', trap:false, q:'Dentro una coppia, chi serve durante un game?', opts:[
      'I due compagni si alternano punto per punto',
      'Sempre lo stesso giocatore, per tutto il game',
      'Chi ha vinto il punto precedente',
      'Si decide a ogni punto'], correct:1 },
    { id:'B-22', fascia:'Base', trap:false, q:'Com\'è l\'altezza della rete da padel?', opts:[
      'Uguale su tutta la lunghezza',
      'Più bassa al centro che ai lati',
      'Più alta al centro che ai lati',
      'Si regola prima di ogni partita'], correct:1 },
    { id:'B-23', fascia:'Base', trap:false, q:'Ho sbagliato il primo servizio. Il secondo dove lo batto?', opts:[
      'Dal lato opposto',
      'Dallo stesso lato, verso lo stesso quadrato',
      'Da dove preferisco',
      'Verso il quadrato opposto'], correct:1 },
    { id:'B-24', fascia:'Base', trap:false, q:'Quanto misura un campo da padel?', opts:[
      '18 metri per 9',
      '20 metri per 10',
      '24 metri per 11',
      'Come un campo da tennis'], correct:1 },
    { id:'B-25', fascia:'Base', trap:false, q:'Gli avversari colpiscono e la palla esce dal campo senza aver mai rimbalzato dentro. Cosa succede?', opts:[
      'Punto mio: la palla non è mai entrata',
      'Punto loro',
      'Si rigioca il punto',
      'Il gioco continua fuori dal campo'], correct:0 },
    { id:'B-26', fascia:'Base', trap:false, q:'Nel padel una palla può essere «fuori» perché rimbalza oltre la linea di fondo?', opts:[
      'Sì, come nel tennis',
      'No: le uniche linee che contano sono quelle del servizio',
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
      'Non esiste: la palla deve passare la rete direttamente',
      'Solo dopo un pallonetto avversario',
      'Sul punteggio di 40-40'], correct:1 },
    { id:'B-T5', fascia:'Base', trap:true,  q:'Che cos\'è la «zona morta», l\'area del campo in cui la palla non può rimbalzare?', opts:[
      'La striscia fra la rete e la linea di servizio',
      'Non esiste: dentro il campo la palla può rimbalzare dovunque',
      'La fascia vicino ai vetri laterali',
      'Esiste solo nei campi al coperto'], correct:1 },
    { id:'B-T6', fascia:'Base', trap:true,  q:'Quando si applica il «cambio di servizio anticipato», che toglie il servizio a chi perde tre punti di fila?', opts:[
      'Solo nei tornei federali',
      'Non esiste: il servizio cambia soltanto alla fine del game',
      'Solo nel primo set',
      'Quando lo chiede chi riceve'], correct:1 },
    { id:'B-T7', fascia:'Base', trap:true,  q:'Chi riceve il servizio dove si deve mettere?', opts:[
      'Dietro la linea di servizio, obbligatoriamente',
      'Dove vuole: nessuna regola fissa la posizione di chi riceve',
      'In diagonale rispetto a chi serve, obbligatoriamente',
      'Al centro del proprio campo'], correct:1 },
    { id:'B-T8', fascia:'Base', trap:true,  q:'In quale caso si può chiedere la «palla di cortesia», cioè ripetere un punto perso per una distrazione?', opts:[
      'Quando un giocatore scivola',
      'Non esiste: un punto perso non si ripete a richiesta',
      'Una volta per set',
      'Quando lo concede l\'avversario'], correct:1 },
    { id:'B-T9', fascia:'Base', trap:true,  q:'Quando i due compagni possono scambiarsi il lato di ricezione (destra e sinistra)?', opts:[
      'A ogni cambio campo',
      'Solo all\'inizio di un nuovo set: dentro il set il lato resta quello',
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
      'Lasciarla rimbalzare e giocarla in uscita dal vetro',
      'Colpirla più forte possibile, per rispondere alla velocità',
      'Provare uno smash'], correct:1 },
    { id:'I-11', fascia:'Intermedio', trap:false, q:'Siamo a rete e gli avversari giocano un pallonetto profondo. Cosa conviene fare?', opts:[
      'Arretrare, giocare una bandeja e restare a rete',
      'Lasciare il pallonetto e tornare tutti e due a fondo campo',
      'Provare uno smash a tutta forza',
      'Scambiarsi di lato con il compagno'], correct:0 },
    { id:'I-12', fascia:'Intermedio', trap:false, q:'Perché conviene spesso giocare la palla al centro, fra i due avversari?', opts:[
      'Perché lì la rete è più bassa e crea indecisione fra i due',
      'Perché la palla viaggia più veloce',
      'Perché è l\'unica zona senza vetro alle spalle',
      'Perché il regolamento premia i colpi al centro'], correct:0 },
    { id:'I-13', fascia:'Intermedio', trap:false, q:'Da fondo campo, qual è l\'obiettivo principale dello scambio?', opts:[
      'Fare punto diretto con un colpo forte',
      'Far scendere la palla ai piedi di chi sta a rete, per riprendersi la rete',
      'Tenere la palla alta il più a lungo possibile',
      'Colpire sempre verso il vetro laterale'], correct:1 },
    { id:'I-14', fascia:'Intermedio', trap:false, q:'Sono a rete e mi arriva una palla bassa, sotto il livello del nastro. Cosa conviene?', opts:[
      'Attaccarla forte verso il basso',
      'Giocare una volée di controllo, profonda, e restare a rete',
      'Arretrare subito a fondo campo',
      'Giocare un pallonetto'], correct:1 },
    { id:'I-15', fascia:'Intermedio', trap:false, q:'Dopo aver servito, cosa fa chi ha servito?', opts:[
      'Resta a fondo campo ad aspettare la risposta',
      'Sale subito a rete',
      'Aspetta il rimbalzo restando al centro',
      'Si sposta verso il vetro laterale'], correct:1 },
    { id:'I-16', fascia:'Intermedio', trap:false, q:'Come si dispone la coppia che sta difendendo?', opts:[
      'Uno a rete e uno a fondo campo',
      'Tutti e due a fondo campo, affiancati',
      'Uno al centro e uno dietro',
      'Non c\'è una disposizione: ognuno copre il suo lato'], correct:1 },
    { id:'I-17', fascia:'Intermedio', trap:false, q:'Un pallonetto avversario finisce sul vetro di fondo del mio campo. Per me quella palla è:', opts:[
      'Persa: dal vetro di fondo non si recupera',
      'Comoda: esce dal vetro e si rigioca in uscita di parete',
      'Un punto già assegnato agli avversari',
      'Da colpire prima del vetro, sempre'], correct:1 },
    { id:'I-18', fascia:'Intermedio', trap:false, q:'La palla, dopo il rimbalzo, sta uscendo dal vetro laterale. Come conviene giocarla?', opts:[
      'Anticipandola prima che tocchi il vetro, sempre',
      'Aspettando che esca dal vetro e accompagnandola',
      'Colpendola con tutta la forza appena esce',
      'Lasciandola rimbalzare una seconda volta'], correct:1 },
    { id:'I-19', fascia:'Intermedio', trap:false, q:'In quale posizione si vince la maggior parte dei punti?', opts:[
      'A fondo campo',
      'A rete',
      'Sul servizio',
      'Sui vetri laterali'], correct:1 },
    { id:'I-20', fascia:'Intermedio', trap:false, q:'Che effetto si dà di solito alla bandeja?', opts:[
      'Topspin, per farla rimbalzare alta',
      'Taglio, per tenerla bassa e controllata',
      'Nessun effetto: è un colpo piatto',
      'Effetto laterale, per mandarla sul vetro'], correct:1 },
    { id:'I-21', fascia:'Intermedio', trap:false, q:'A cosa serve soprattutto il servizio nel padel?', opts:[
      'A fare punto diretto',
      'A prendere la rete: è un colpo di apertura, non di attacco',
      'A mandare la palla contro il vetro avversario',
      'A stancare chi riceve'], correct:1 },
    { id:'I-22', fascia:'Intermedio', trap:false, q:'Il mio compagno ha rincorso una palla larga ed è fuori posizione. Io cosa faccio?', opts:[
      'Resto fermo nella mia metà campo',
      'Mi sposto per coprire la sua zona: la coppia si muove insieme',
      'Salgo a rete da solo',
      'Torno a fondo campo ad aspettarlo'], correct:1 },
    { id:'I-23', fascia:'Intermedio', trap:false, q:'La mia palla rimbalza nel campo avversario, tocca la loro griglia e torna nel mio campo senza che nessuno la tocchi. Cosa succede?', opts:[
      'Punto mio',
      'Punto degli avversari',
      'Si rigioca il punto',
      'Il gioco continua: posso rigiocarla'], correct:0 },
    { id:'I-24', fascia:'Intermedio', trap:false, q:'L\'ordine di servizio dentro una coppia può cambiare durante la partita?', opts:[
      'No, mai: si stabilisce all\'inizio e resta quello',
      'Sì, all\'inizio di ogni set',
      'Sì, all\'inizio di ogni game',
      'Sì, in qualunque momento'], correct:1 },
    { id:'I-25', fascia:'Intermedio', trap:false, q:'Qual è la zona del campo in cui conviene NON farsi sorprendere?', opts:[
      'Il fondo campo',
      'La zona di mezzo, fra la linea di servizio e la rete',
      'La rete',
      'L\'angolo vicino al vetro laterale'], correct:1 },
    { id:'I-26', fascia:'Intermedio', trap:false, q:'Cosa vuol dire «tenere la rete»?', opts:[
      'Toccare la rete con la racchetta senza fallo',
      'Restare nella posizione di rete senza farsi arretrare dai pallonetti',
      'Colpire sempre in direzione della rete',
      'Difendere solo la propria metà campo'], correct:1 },
    { id:'I-27', fascia:'Intermedio', trap:false, q:'Gli avversari sono tutti e due a rete e io sono in difesa. La prima cosa da NON fare è:', opts:[
      'Giocare basso, sui loro piedi',
      'Regalare una palla alta e comoda a mezzo campo',
      'Giocare un pallonetto profondo',
      'Aspettare la palla lasciandola uscire dal vetro'], correct:1 },
    { id:'I-28', fascia:'Intermedio', trap:false, q:'Durante lo scambio posso passare la racchetta da una mano all\'altra?', opts:[
      'No, mai',
      'Sì: nessuna regola lo vieta',
      'Solo quando si difende',
      'Una volta per game'], correct:1 },

    // ── Intermedio · trappole ───────────────────────────────────────────────────────
    { id:'I-T4', fascia:'Intermedio', trap:true,  q:'Cosa stabilisce la «regola del muro cieco», che vieta di giocare la palla dopo il vetro di fondo?', opts:[
      'Vale solo nei campi al coperto',
      'Non esiste: dopo il rimbalzo a terra la palla si gioca anche di vetro di fondo',
      'Vale solo sul servizio',
      'Vale quando si è sotto nel punteggio'], correct:1 },
    { id:'I-T5', fascia:'Intermedio', trap:true,  q:'Quando è obbligatoria la «bandeja invertita» sul lato del rovescio?', opts:[
      'Quando il pallonetto è molto profondo',
      'Non esiste: nessun colpo è obbligatorio, la bandeja invertita non è una regola',
      'Nei tornei federali',
      'Quando si difende in due a fondo campo'], correct:1 },
    { id:'I-T6', fascia:'Intermedio', trap:true,  q:'Quando vale il «punto di transizione», che assegna mezzo punto alla coppia che conquista la rete?', opts:[
      'A ogni cambio di posizione',
      'Non esiste: nel padel non ci sono mezzi punti',
      'Solo nel tie-break',
      'Solo negli allenamenti'], correct:1 },
    { id:'I-T7', fascia:'Intermedio', trap:true,  q:'Posso mandare la palla dall\'altra parte facendola passare FUORI dai pali della rete, di lato, invece che sopra?', opts:[
      'No: la palla deve sempre passare sopra la rete',
      'Sì: purché atterri nel campo avversario, può passare anche fuori dai pali',
      'Sì, ma solo quando si difende',
      'Solo nei tornei ufficiali'], correct:1 },
    { id:'I-T8', fascia:'Intermedio', trap:true,  q:'Quando entra in gioco la «regola dell\'ultimo vetro», che chiude il punto se la palla tocca un vetro dopo aver toccato la griglia?', opts:[
      'Solo nel proprio campo',
      'Non esiste: dopo il rimbalzo a terra l\'ordine di vetri e griglia non conta',
      'Solo nel campo avversario',
      'Solo sul servizio'], correct:1 },
    { id:'I-T9', fascia:'Intermedio', trap:true,  q:'Cosa prevede la «regola del servizio lungo», che concede un servizio in più alla coppia che ha appena perso il game?', opts:[
      'Vale dal secondo set in poi',
      'Non esiste: i servizi sono sempre due',
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
      'Per costringere chi è a rete a una volée bassa e togliergli l\'iniziativa',
      'Per far rimbalzare la palla sul vetro di fondo',
      'Per guadagnare tempo e riprendere fiato'], correct:1 },
    { id:'A-10', fascia:'Avanzato', trap:false, q:'Come si colpisce la vibora?', opts:[
      'Piatta e a tutta forza',
      'Con effetto tagliato e laterale, per farla rimbalzare bassa verso il vetro',
      'Con topspin, per farla rimbalzare alta',
      'Sempre in sospensione, saltando'], correct:1 },
    { id:'A-11', fascia:'Avanzato', trap:false, q:'Qual è l\'errore più comune di chi sta a rete sulle palle alte?', opts:[
      'Giocare troppe bandeje',
      'Voler smashare ogni palla alta, perdendo la posizione di rete',
      'Giocare troppo al centro',
      'Restare troppo vicino alla rete'], correct:1 },
    { id:'A-12', fascia:'Avanzato', trap:false, q:'Perché il pallonetto è il colpo più usato ad alto livello?', opts:[
      'Perché fa punto diretto',
      'Perché è il modo principale per togliere la rete agli avversari',
      'Perché è il colpo più facile da eseguire',
      'Perché stanca gli avversari'], correct:1 },
    { id:'A-13', fascia:'Avanzato', trap:false, q:'Perché uno smash piatto e centrale è spesso poco efficace?', opts:[
      'Perché è troppo lento',
      'Perché la palla torna dal vetro di fondo comoda da rigiocare',
      'Perché è vietato dal regolamento',
      'Perché stanca troppo chi lo esegue'], correct:1 },
    { id:'A-14', fascia:'Avanzato', trap:false, q:'Sono sotto pressione in difesa. Dove conviene mandare la palla?', opts:[
      'Bassa e veloce al centro',
      'Alta e profonda, per guadagnare tempo e far arretrare gli avversari',
      'Corta, appena oltre la rete',
      'Sempre contro il vetro laterale'], correct:1 },
    { id:'A-15', fascia:'Avanzato', trap:false, q:'Quando si dice che una coppia ha «l\'iniziativa»?', opts:[
      'Quando è al servizio',
      'Quando sta a rete e costringe gli avversari a giocare dal basso',
      'Quando è avanti nel punteggio',
      'Quando gioca molto sui vetri'], correct:1 },
    { id:'A-16', fascia:'Avanzato', trap:false, q:'Una palla molto veloce e alta finisce sul vetro di fondo del mio campo dopo il rimbalzo. Come si difende?', opts:[
      'Anticipandola prima che tocchi il vetro',
      'Aspettando l\'uscita dal vetro e giocando un pallonetto profondo',
      'Colpendola forte al volo',
      'Lasciandola passare e sperando che esca'], correct:1 },
    { id:'A-17', fascia:'Avanzato', trap:false, q:'Perché la prima volée dopo il servizio è così importante?', opts:[
      'Perché è il colpo che fa più punti',
      'Perché decide se si riesce a tenere la rete appena conquistata',
      'Perché è il colpo più facile del padel',
      'Perché il regolamento obbliga a giocarla al volo'], correct:1 },
    { id:'A-18', fascia:'Avanzato', trap:false, q:'Posso servire in modo che la palla, dopo il rimbalzo, finisca contro il vetro laterale avversario?', opts:[
      'No: sarebbe fallo di servizio',
      'Sì: dopo il rimbalzo nel riquadro giusto il vetro è permesso, ed è un servizio efficace',
      'Solo sul secondo servizio',
      'Solo nei tornei ufficiali'], correct:1 },
    { id:'A-19', fascia:'Avanzato', trap:false, q:'Un avversario esce dalla porta per rincorrere la mia palla. Cosa devo fare io?', opts:[
      'Considerare il punto vinto: appena la palla esce ho fatto punto',
      'Restare pronto: il punto continua finché la palla non rientra o cade',
      'Fermarmi e aspettare che rientri',
      'Uscire anch\'io dal campo'], correct:1 },
    { id:'A-20', fascia:'Avanzato', trap:false, q:'Cosa rende difficile giocare una palla in uscita di parete?', opts:[
      'Il fatto che arrivi alta',
      'Il taglio e la velocità: esce poco dal vetro e resta bassa',
      'Il fatto che arrivi lenta',
      'Il fatto che arrivi al centro'], correct:1 },
    { id:'A-21', fascia:'Avanzato', trap:false, q:'Quando conviene giocare al volo invece di lasciar rimbalzare?', opts:[
      'Sempre, ogni volta che si riesce',
      'Quando si è a rete e la palla arriva sopra il livello del nastro',
      'Solo stando a fondo campo',
      'Mai: nel padel conviene sempre far rimbalzare'], correct:1 },
    { id:'A-22', fascia:'Avanzato', trap:false, q:'La racchetta può superare la rete durante il colpo?', opts:[
      'No: la racchetta non può mai oltrepassare la rete',
      'Sì, nell\'accompagnamento: ma la palla va colpita dal proprio lato',
      'Sì, e si può anche colpire la palla oltre la rete',
      'Solo quando si gioca al volo'], correct:1 },
    { id:'A-23', fascia:'Avanzato', trap:false, q:'Che cos\'è il «remate»?', opts:[
      'Il pallonetto',
      'Lo smash',
      'La volée di controllo',
      'Il servizio con effetto'], correct:1 },
    { id:'A-24', fascia:'Avanzato', trap:false, q:'Perché le palle da padel sono meno pressurizzate di quelle da tennis?', opts:[
      'Per costare meno',
      'Per rimbalzare meno e rendere gli scambi più controllabili',
      'Per durare più a lungo',
      'Non c\'è differenza: sono le stesse palle'], correct:1 },
    { id:'A-25', fascia:'Avanzato', trap:false, q:'Che vantaggio dà la volée profonda rispetto a quella corta?', opts:[
      'Fa punto più facilmente',
      'Tiene gli avversari lontani dalla rete e rende difficile il pallonetto comodo',
      'È più facile da eseguire',
      'Fa rimbalzare la palla sul vetro'], correct:1 },
    { id:'A-26', fascia:'Avanzato', trap:false, q:'Sono in difesa e gioco un pallonetto corto. Cosa devo aspettarmi?', opts:[
      'Di riprendermi la rete',
      'Uno smash: devo prepararmi a difendere',
      'Che gli avversari lascino passare la palla',
      'Un punto diretto a mio favore'], correct:1 },
    { id:'A-27', fascia:'Avanzato', trap:false, q:'Qual è il vantaggio principale di chi sta a rete?', opts:[
      'Essere più vicino agli avversari',
      'Poter colpire la palla dall\'alto verso il basso',
      'Poter usare meglio i vetri',
      'Poter servire da più vicino'], correct:1 },

    // ── Avanzato · trappole ─────────────────────────────────────────────────────────
    { id:'A-T4', fascia:'Avanzato', trap:true,  q:'Quando si esegue la «vibora rovesciata in caduta»?', opts:[
      'Su un pallonetto molto profondo',
      'Non esiste: non c\'è nessun colpo con questo nome',
      'Quando si difende sul vetro laterale',
      'Solo nei tornei al coperto'], correct:1 },
    { id:'A-T5', fascia:'Avanzato', trap:true,  q:'Quando è consentito il «doppio smash consecutivo», cioè smashare due volte la stessa palla quando torna dal vetro?', opts:[
      'Quando la palla torna dal vetro di fondo',
      'Non esiste: ogni palla si colpisce una volta sola',
      'Solo se la palla non ha ancora rimbalzato',
      'Sul punteggio di parità'], correct:1 },
    { id:'A-T6', fascia:'Avanzato', trap:true,  q:'Cosa prevede la «regola dell\'attacco obbligato», che impone di smashare una palla che arriva sopra il nastro?', opts:[
      'Vale solo a rete',
      'Non esiste: nessuna regola impone quale colpo giocare',
      'Vale solo nei tornei federali',
      'Vale dal secondo set in poi'], correct:1 },
    { id:'A-T7', fascia:'Avanzato', trap:true,  q:'Che cos\'è la «cadena», il colpo che permette di legare due volée in un unico movimento?', opts:[
      'Una volée doppia consentita a rete',
      'Non esiste: nessun colpo permette due tocchi in un movimento',
      'Un colpo difensivo sul vetro',
      'Un servizio con doppio effetto'], correct:1 },
    { id:'A-T8', fascia:'Avanzato', trap:true,  q:'Quando si applica il «recupero di rete», che consente di rigiocare un punto perso per un rimbalzo irregolare sul nastro?', opts:[
      'Durante lo scambio, se la palla tocca il nastro',
      'Non esiste: durante lo scambio il nastro non fa ripetere niente',
      'Solo sul primo servizio',
      'Una volta per set'], correct:1 },
    { id:'A-T9', fascia:'Avanzato', trap:true,  q:'Quando è consentito battere il servizio avanzando, con un piede che supera la linea prima del colpo?', opts:[
      'Sul secondo servizio',
      'Mai: i piedi restano dietro la linea di servizio fino al momento del colpo',
      'Quando si serve dal lato del rovescio',
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
      'Uno smash che fa uscire la palla dal campo dallo spazio laterale',
      'Uno smash che vale tre punti',
      'Uno smash giocato nel terzo set'], correct:1 },
    { id:'AG-10', fascia:'Agonista', trap:false, q:'Nel tie-break, chi serve per primo?', opts:[
      'Chi ha servito l\'ultimo game',
      'Chi avrebbe dovuto servire il game successivo, e serve un solo punto',
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
      'Perché porta il ricevente verso il vetro e apre il centro del campo',
      'Perché è più difficile da vedere',
      'Perché è obbligatorio in gara'], correct:1 },
    { id:'AG-14', fascia:'Agonista', trap:false, q:'In una partita senza arbitro, chi decide se un servizio è fallo?', opts:[
      'Chi serve',
      'La coppia che riceve',
      'Si rigioca sempre il punto',
      'Il circolo che ospita'], correct:1 },
    { id:'AG-15', fascia:'Agonista', trap:false, q:'Perché ad alto livello si difende con il pallonetto invece che con un colpo teso?', opts:[
      'Perché il pallonetto è più facile',
      'Perché un colpo teso a chi è a rete gli regala l\'attacco',
      'Perché il regolamento premia i colpi alti',
      'Perché stanca di più gli avversari'], correct:1 },
    { id:'AG-16', fascia:'Agonista', trap:false, q:'La mia coppia ha appena perso la rete. La cosa più importante è:', opts:[
      'Provare subito a risalire, uno alla volta',
      'Arretrare insieme e ricostruire il punto da fondo campo',
      'Dividersi il campo esattamente a metà',
      'Giocare ogni palla al centro'], correct:1 },
    { id:'AG-17', fascia:'Agonista', trap:false, q:'Un giocatore tocca la rete DOPO che il punto si è chiuso. Cosa succede?', opts:[
      'Punto degli avversari',
      'Niente: il punto era già finito',
      'Si rigioca il punto',
      'È un avvertimento formale'], correct:1 },
    { id:'AG-18', fascia:'Agonista', trap:false, q:'Durante lo scambio la palla tocca il palo della rete e cade regolarmente nel campo avversario. Cosa succede?', opts:[
      'Punto perso da chi ha colpito',
      'Il gioco continua: la palla è passata regolarmente',
      'Si rigioca il punto',
      'Punto vinto da chi ha colpito'], correct:1 },
    { id:'AG-19', fascia:'Agonista', trap:false, q:'Che cos\'è la «dejada» (smorzata)?', opts:[
      'Un pallonetto molto corto',
      'Una palla corta giocata appena oltre la rete',
      'Uno smash controllato',
      'Un servizio giocato lento'], correct:1 },
    { id:'AG-20', fascia:'Agonista', trap:false, q:'Quando conviene giocare la dejada?', opts:[
      'Quando gli avversari sono a rete',
      'Quando gli avversari sono arretrati a fondo campo',
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
      'Sul 40-40 si gioca un punto decisivo, senza vantaggi',
      'Il punto che chiude il set',
      'Il primo punto del tie-break'], correct:1 },
    { id:'AG-24', fascia:'Agonista', trap:false, q:'Di che materiale è la superficie di un campo da padel da torneo?', opts:[
      'Cemento',
      'Erba sintetica con sabbia',
      'Terra rossa',
      'Parquet'], correct:1 },
    { id:'AG-25', fascia:'Agonista', trap:false, q:'Perché lo smash «x4» si chiama così?', opts:[
      'Perché vale quattro punti',
      'Perché fa uscire la palla oltre la parete di fondo, alta quattro metri',
      'Perché si colpisce con quattro rimbalzi',
      'Perché si usa nel quarto set'], correct:1 },
    { id:'AG-26', fascia:'Agonista', trap:false, q:'La palla esce dal campo e nessuno la rimette dentro. Il punto è di:', opts:[
      'Chi l\'ha colpita, se prima aveva rimbalzato nel campo avversario',
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
      'Un colpo d\'attacco sul vetro laterale',
      'Non esiste: nessun colpo obbliga la palla a toccare un numero di pareti',
      'Una variante della vibora',
      'Un colpo consentito solo in difesa'], correct:1 },
    { id:'AG-T5', fascia:'Agonista', trap:true,  q:'Cosa prevede la «regola del punto lungo», che assegna il punto dopo trenta colpi di scambio?', opts:[
      'Vale solo nei tornei giovanili',
      'Non esiste: uno scambio può durare quanto vuole',
      'Vale dal terzo set',
      'La applica l\'arbitro a sua discrezione'], correct:1 },
    { id:'AG-T6', fascia:'Agonista', trap:true,  q:'Quando si può chiedere il «time-out tecnico di parete», per far controllare un vetro durante il punto?', opts:[
      'Una volta per set',
      'Non esiste: durante il punto non si chiede nessun controllo',
      'Solo nei campi al coperto',
      'Quando lo concede l\'avversario'], correct:1 },
    { id:'AG-T7', fascia:'Agonista', trap:true,  q:'Quando è obbligatorio giocare la «sotana»?', opts:[
      'Quando la palla arriva sotto il ginocchio',
      'Mai: la sotana esiste come colpo, ma nessun colpo è obbligatorio',
      'Nei tornei federali',
      'Quando si difende in due a fondo campo'], correct:1 },
    { id:'AG-T8', fascia:'Agonista', trap:true,  q:'Quando vale la «regola dei due smash», che vieta allo stesso giocatore due smash consecutivi nello stesso punto?', opts:[
      'Solo nei tornei federali',
      'Non esiste: si può smashare quante volte si vuole nello stesso punto',
      'Vale dal secondo set',
      'Vale solo nel tie-break'], correct:1 },
    { id:'AG-T9', fascia:'Agonista', trap:true,  q:'Cosa prevede la «regola del vantaggio di servizio», che assegna il game a chi vince tre punti di fila al servizio?', opts:[
      'Vale solo sul punteggio di parità',
      'Non esiste: il game si vince solo arrivando a quattro punti con due di scarto',
      'Vale nei tornei con punto d\'oro',
      'La concede l\'arbitro'], correct:1 }
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

