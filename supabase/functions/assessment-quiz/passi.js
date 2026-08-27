/* passi.js — IL MOTORE A PASSI del test di livello (voce 97, 25/08/2026).
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * 🚨 IL BUCO CHE CHIUDE, ed è l'unico motivo per cui questo file esiste.
 *
 * Fino a oggi il test è «tutto in una consegna»: la pagina chiede `pesca`, riceve **le quattro
 * domande di conoscenza insieme**, le disegna, e manda le dodici risposte in blocco. ⇒ Chi fa
 * il test può **leggersele tutte prima** di rispondere alla prima — cercarle, chiederle a
 * qualcuno, aprirle in un'altra scheda. La risposta giusta non esce dal server (voce 27), ma la
 * DOMANDA sì, e tutte in una volta: il tempo per cercare è la vulnerabilità che resta.
 *
 * ⭐ La cura non è un cronometro — è **non dare la domanda dopo finché non è arrivata la
 * risposta a quella prima**. Un passo per volta, e lo stato di chi è a metà lo tiene il
 * gestionale, non il telefono e non il bot.
 *
 * 🎯 E serve a DUE cose insieme, che è la ragione per cui si fa prima questa e poi Telegram
 * (voce 97): la pagina «una domanda alla volta» e il test **dentro il bot** hanno bisogno
 * esattamente della stessa cosa nuova — un'edge che sappia dire *«questa è la prossima
 * domanda»* e *«questa risposta è arrivata»*. Costruirle separate sarebbe farlo due volte.
 *
 * 🔒 DOVE VIVE LA VERITÀ: qui. Le domande, il loro ordine, cosa è una risposta ammessa e quando
 * il giro è finito lo decide il gestionale. Il bot (o la pagina) mostra e riporta — *il
 * gestionale SA, il bot DICE*. Il giorno in cui la pagina si spegne, questo file non si tocca.
 *
 * 🧪 È un MODULO puro e senza database apposta: il banco lo importa ed esegue le funzioni vere
 * (`test/motore-a-passi.test.mjs`), invece di cercarne le stringhe nel sorgente.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import {
  PMO_LIVELLI,
  assessKey,
  assessTxt,
  fasciaDaLivello,
  pescaPerGettone,
  quantePescate,
  seme,
  sorteDa,
} from './conoscenza.js';

/* Le opzioni delle due domande sul livello: le stesse che la pagina disegna da `PMO_LIVELLI`
   (`pmoLivelliOpzioni`, index.html) — il socio legge le parole, il modulo tiene il numero.
   ⚠️ `value: String(f.max)` non è una scelta di questo file: è la forma che il resto della
   catena già si aspetta (`declared_level`, il tetto, la coerenza). Cambiarla qui la
   cambierebbe solo per metà dei soci. */
/* Da «Avanzato» a «Avanzati»: la domanda 4 parla di AVVERSARI, e «Contro Avanzato» sarebbe
   sgrammaticato sotto gli occhi del socio. Le sette parole sono queste e non cambiano: si
   scrive la tabella invece di inventare una regola di plurale italiana che sbaglierebbe su
   «Semi-Pro» e «Professionista». */
const PLURALE_LIVELLO = {
  Principiante: 'Principianti',
  Base: 'giocatori Base',
  Intermedio: 'Intermedi',
  Avanzato: 'Avanzati',
  Agonista: 'Agonisti',
  'Semi-Pro': 'Semi-Pro',
  Professionista: 'Professionisti',
};
function etichettaPlurale(definizione) {
  return PLURALE_LIVELLO[definizione] || definizione;
}

export function opzioniLivelli(prefisso) {
  /* 🔄🗣️⭐⭐ 26/08/2026 — VIA I COLPI DALL'ETICHETTA, e il valore non si tocca.
     🗣️ Sua decisione del pomeriggio, dopo tre schermate di prova sul telefono: le risposte
     devono stare **sui bottoni**, intere, senza elenco sopra e senza puntini. ⇒ L'unica strada
     che dà tutt'e tre le cose è accorciare il TESTO, e qui costa zero: `${definizione} — ${colpi}`
     arrivava a **49 caratteri** («Professionista — massima padronanza di ogni colpo») mentre la
     parola da sola è **14** al massimo.
     ⚖️ E si può fare **senza rischio** proprio qui, che è il punto: su questa domanda il dato è
     `valore` (il NUMERO della fascia), non le parole — quindi accorciare l'etichetta non tocca
     né il punteggio, né la coerenza, né il tetto. Sulle altre domande le parole sono il dato, e
     infatti là si accorcia con un secondo campo (vedi `scelte`).
     📌 *Prima di accorciare un testo si guarda se quel testo È il dato: qui non lo era, e la
     descrizione dei colpi stava aiutando a scegliere sul modulo, dove c'è spazio, non sul bottone.* */
  /* Il prefisso serve alla domanda 4, che chiede «contro CHI» e non «che cosa sei»: senza, le
     due domande di fila avrebbero le stesse identiche sette risposte (27/08). Cambia solo il
     `testo`; il `valore` — il numero della fascia — resta quello di sempre. */
  const p = String(prefisso ?? '');
  return PMO_LIVELLI.map((f) => ({
    valore: String(f.max),
    testo: p ? `${p}${etichettaPlurale(String(f.definizione))}` : String(f.definizione),
  }));
}

/**
 * Le opzioni di una domanda. Un elemento può essere:
 *   · una stringa            → `valore` e `testo` coincidono (com'è sempre stato);
 *   · `[valore, testoBreve]` → il dato resta il PRIMO, sul bottone si legge il secondo.
 *
 * 🚨⭐⭐ LA COPPIA ESISTE PER NON TOCCARE IL DATO, ed è la sola forma sicura di accorciamento.
 * Su queste domande il punteggio nasce **confrontando le parole**
 * (`assessmentPublicScoreFromText`): riscrivere «Tengo scambi regolari con continuità» in
 * «Scambi regolari» cambierebbe il livello calcolato, in silenzio, e solo per chi risponde dal
 * bot. ⇒ Il `valore` resta **identico al carattere** a quello che la pagina manda da sempre; il
 * `testo` è solo ciò che si legge.
 * ⚖️ Ed è il motivo per cui la prova di parità con i `<select>` di `index.html` confronta i
 * **valori** e non le etichette: due copie devono raccontare lo stesso test, non avere lo
 * stesso aspetto — e da oggi l'aspetto è diverso apposta.
 */
function scelte(lista) {
  return lista.map((t) => (Array.isArray(t)
    ? { valore: String(t[0]), testo: String(t[1]) }
    : { valore: t, testo: t }));
}

/* ═══ LE OTTO DOMANDE DELLA SCHEDA ═══════════════════════════════════════════════════════
   🚨 IL TESTO DELLE OPZIONI È IL DATO, non un'etichetta: `assessmentPublicTechnicalScores`
   assegna il punteggio **confrontando le parole** (`assessmentPublicScoreFromText`). Cambiare
   «Gioco volée semplici» in «Gioco volee semplici» non cambia una scritta: cambia il livello
   calcolato, in silenzio, e solo per chi risponde da qui.
   ⇒ Per questo `test/motore-a-passi.test.mjs` confronta queste otto domande con i `<select>`
   veri di `index.html`, uno per uno. Finché la pagina è viva ci sono DUE copie, e una prova di
   parità è l'unica cosa che impedisce alle due di raccontare test diversi.
   📌 La chiave (`chiave`) è il `name` del campo nel modulo: è ciò che rende la scheda costruita
   qui **indistinguibile** da quella costruita dalla pagina. */
export const SCHEDA_DOMANDE = [
  {
    chiave: 'experience',
    testo: 'Da quanto giochi a padel?',
    opzioni: scelte(['Meno di 1 mese', '1-3 mesi', '3-6 mesi', '6-12 mesi', 'Più di 1 anno', 'Più di 3 anni']),
  },
  {
    chiave: 'frequency',
    testo: 'Quante volte giochi mediamente al mese?',
    opzioni: scelte(['0-1', '2-3', '4-6', '7-10', 'Più di 10']),
  },
  { chiave: 'declaredLevel', testo: 'Che livello pensi di avere?', opzioni: opzioniLivelli() },
  /* 🔄🗣️⭐⭐ 27/08/2026 — LA QUARTA NON DEVE SEMBRARE LA TERZA. Sua segnalazione:
     *«nel test la domanda 3 e la quattro la gente si confonde a rispondere»*.
     📏 E il perché si vede mettendole in fila: la 3 chiede «che livello pensi di avere?» e la 4
     «con quali giocatori fai partite equilibrate?», e tutt'e due rispondevano con le **stesse
     sette parole** — Principiante, Base, Intermedio… Due schermate identiche di fila: chi legge
     in fretta crede di aver sbagliato bottone, o di essere tornato indietro.
     ⇒ La domanda cambia forma e le risposte diventano «Contro giocatori Avanzati»: **il dato non
     si tocca**, perché il `valore` resta il numero della fascia, identico al carattere a quello
     che la pagina manda da sempre (peso 0,25 nel calcolo).
     ⚖️ Perché non toglierla, che era la strada più corta: è l'unico confronto fra ciò che uno
     **dice di essere** e ciò con cui **gioca alla pari**, e da quel confronto nasce il segnale
     di incoerenza che ferma chi si sopravvaluta. Toglierla avrebbe reso il test più corto e il
     cancello più cieco.
     📌 *Due domande diverse con le stesse risposte non sono due domande: sono la stessa domanda
     fatta due volte, e chi risponde lo sente prima di saperlo spiegare.* */
  {
    chiave: 'balancedLevel',
    testo: 'Con giocatori di che livello te la giochi alla pari?',
    opzioni: opzioniLivelli('Contro '),
  },
  {
    chiave: 'rally',
    testo: 'Riesci a mantenere lo scambio?',
    opzioni: scelte([
      ['Faccio fatica a tenere 3-4 colpi', 'Fatico su 3-4 colpi'],
      ['Tengo lo scambio solo a ritmo lento', 'Solo a ritmo lento'],
      ['Tengo scambi regolari con continuità', 'Scambi regolari'],
      ['Tengo scambi anche con ritmo alto', 'Anche a ritmo alto'],
      ['Costruisco il punto con controllo', 'Costruisco il punto'],
    ]),
  },
  {
    chiave: 'glass',
    testo: 'Come gestisci il vetro in difesa?',
    opzioni: scelte([
      ['Evito quasi sempre il vetro', 'Evito il vetro'],
      ['Lo uso solo se la palla è facile', 'Solo se è facile'],
      ['Difendo con il vetro in modo base', 'Difesa base col vetro'],
      ['Lo uso con continuità anche sotto pressione', 'Anche sotto pressione'],
      ['Lo uso per difendere e ripartire in attacco', 'Difendo e riparto'],
    ]),
  },
  {
    chiave: 'net',
    testo: 'A rete come ti comporti?',
    opzioni: scelte([
      'Sto poco a rete',
      ['Vado a rete ma faccio fatica a chiudere', 'Fatico a chiudere'],
      'Gioco volée semplici',
      ['Tengo posizione e controllo le volée', 'Controllo le volée'],
      ['Costruisco e chiudo il punto a rete', 'Chiudo il punto'],
    ]),
  },
  {
    chiave: 'overhead',
    /* 🗣️ 27/08 notte — era «Bandeja / vibora / smash» e basta, e lui l'ha trovata sul telefono:
       *«non è chiaro cosa bisogna rispondere»*. Le altre domande della scheda fanno tutte una
       DOMANDA; questa era l'unica a essere un elenco di nomi. */
    /* 🗣️ E rifinita di nuovo su sua parola (27/08 notte, seconda passata): «quanto li usi?»
       chiedeva una frequenza, ma le risposte parlano di padronanza — quali colpi sai fare e
       con che sicurezza. La domanda si adegua alle risposte, non il contrario. */
    testo: 'Come te la cavi con i colpi alti (bandeja, vibora, smash)?',
    opzioni: scelte([
      'Non li uso',
      ['Li provo ma con poca sicurezza', 'Li provo, poca sicurezza'],
      ['Uso almeno la bandeja in modo semplice', 'Bandeja semplice'],
      ['Uso bandeja e smash con controllo', 'Bandeja e smash'],
      ['Uso colpi alti in modo tattico e affidabile', 'Colpi alti, tattici'],
    ]),
  },
];

/** La chiave con cui una domanda di conoscenza vive dentro le risposte. Il prefisso serve a
 *  tenerle separate dai campi della scheda senza doverne tenere l'elenco da nessuna parte. */
export function chiaveConoscenza(id) {
  return `k:${assessTxt(id)}`;
}
export function idDaChiaveConoscenza(chiave) {
  const c = assessTxt(chiave);
  return c.startsWith('k:') ? c.slice(2) : '';
}

/* Le quattro domande di conoscenza del giro, se già si sa quale fascia guardare.
   🚨 Si RIPESCANO col gettone, non si salvano: stesso gettone e stessa fascia ⇒ stesse quattro
   domande, senza una riga di stato in più da tenere pulita (è la scelta della voce 27, e qui
   torna utile una seconda volta — chi cambia idea sul livello a metà giro si ritrova domande
   diverse, ed è giusto così: sta rispondendo a un'altra fascia).
   ⛔ `trap` NON esce: dire quale delle quattro è la trappola è mezza risposta regalata. */
function domandeConoscenza(token, risposte, viste) {
  const fascia = fasciaDaLivello((risposte || {}).declaredLevel);
  if (!fascia) return [];
  return pescaPerGettone(assessTxt(token), fascia, viste).map((d) => ({
    chiave: chiaveConoscenza(d.id),
    testo: d.q,
    opzioni: scelte(d.opts),
    conoscenza: true,
  }));
}

/* 🔄🗣️⭐⭐ 27/08/2026 — LE DOMANDE DI CONOSCENZA SI MISCHIANO FRA QUELLE DELLA SCHEDA, su sua
   richiesta (*«sei d'accordo di mischiare le domande trabocchetto tra una domanda vera e
   un'altra?»*) e delega. Fino a oggi il cancello stava in blocco in fondo: chi rifaceva il
   test sapeva che le prime otto non bocciano e si concentrava sulla coda.
   ⚖️ Le PRIME TRE restano fisse e per una ragione di meccanica, non di stile: la fascia da cui
   pescare si sa solo DOPO «Che livello pensi di avere?» (la terza). Da lì in poi l'ordine è
   una mescolata COL GETTONE — stesso gettone, stesso ordine, così chi riprende un test a metà
   ritrova le domande dove le aveva lasciate (è la stessa ripetibilità della pescata).
   🚨 Il sale è DIVERSO da quello della pescata («ordine-del-giro»): con lo stesso rnd l'ordine
   direbbe qualcosa su quali domande sono uscite. */
export function domandeDelGiro(token, risposte, viste) {
  const conoscenza = domandeConoscenza(token, risposte, viste);
  if (!conoscenza.length) return SCHEDA_DOMANDE;
  const testa = SCHEDA_DOMANDE.slice(0, 3);
  const coda = SCHEDA_DOMANDE.slice(3).concat(conoscenza);
  const rnd = sorteDa(seme(assessTxt(token), 'ordine-del-giro'));
  for (let i = coda.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [coda[i], coda[j]] = [coda[j], coda[i]];
  }
  return testa.concat(coda);
}

/** Quante domande sono in TUTTO, prima di sapere che fascia dichiarerà il socio.
 *
 * 🆕🗣️⭐⭐ 26/08/2026 — esiste perché il numero serve **prima** che il test cominci: sua
 * richiesta, *«sin dall'inizio deve dire che sono 12 domande»*, e l'invito parte quando di
 * risposte non ce n'è nessuna.
 * 🔒 È una FUNZIONE ESPORTATA e non un 12 scritto da qualche parte, ed è tutto il punto: il
 * conto lo sa questo file, che è quello che le domande le ha. `consumer-assessment-link` lo
 * chiede qui e lo manda al bot; il bot lo ripete e basta — *il gestionale SA, il bot DICE*.
 * ⇒ Il giorno in cui una domanda si aggiunge o si toglie, la frase dell'invito cambia da sé,
 * e nessuno deve ricordarsi di rincorrerla in tre posti.
 * ⚠️ È una PREVISIONE, non un fatto: chi dichiara Semi-Pro o Professionista non ha il quiz e
 * ne farà otto. Il conto cala dopo la terza risposta — cala, non cresce.
 * 🔄 27/08 sera — e Principiante è uscito da quell'elenco: da stasera le sue domande si
 * pescano come per tutti (sua decisione, «sblocca le domande della banca per principiante»),
 * quindi per lui la previsione di 13 è diventata un fatto invece di un numero da correggere.
 */
export function domandeTotaliPreviste() {
  // 🔄 27/08 — il 4 scritto a mano è diventato il conto vero della pescata (oggi 5): il
  // numero che il bot annuncia vive dove vivono le domande.
  return SCHEDA_DOMANDE.length + quantePescate();
}

/**
 * DOVE SIAMO. Restituisce la prima domanda senza risposta, oppure `finito`.
 *
 * ⚠️ IL TOTALE PUÒ SCENDERE, ed è voluto: finché il livello non è dichiarato non si sa se quel
 * socio avrà il cancello (Semi-Pro e Professionista non ce l'hanno) ⇒ prima della terza domanda
 * il totale è una **previsione**, dopo è un fatto. Meglio un numero che si corregge di uno che
 * promette tredici passi a chi ne farà otto.
 * 🔄 27/08 sera — Principiante è uscito dall'elenco: le sue domande adesso si pescano.
 */
export function passoCorrente(token, risposte, viste) {
  const date = risposte || {};
  const domande = domandeDelGiro(token, date, viste);
  const conFascia = !!assessTxt(date.declaredLevel);
  const totale = conFascia ? domande.length : domandeTotaliPreviste();

  for (let i = 0; i < domande.length; i++) {
    const d = domande[i];
    if (assessTxt(date[d.chiave])) continue;
    return {
      finito: false,
      numero: i + 1,
      totale,
      totale_certo: conFascia,
      domanda: { chiave: d.chiave, testo: d.testo, opzioni: d.opzioni, conoscenza: !!d.conoscenza },
    };
  }
  return { finito: true, numero: domande.length, totale: domande.length, totale_certo: true, domanda: null };
}

/**
 * La risposta è ammessa? Torna il valore **canonico** (quello dell'opzione), non quello
 * arrivato: così una differenza di accento o di spazi non entra nella scheda, dove le parole
 * sono il dato.
 * 🔒 Fallisce chiusa: fuori dalle opzioni offerte non passa niente. Non è pignoleria — è ciò
 * che impedisce di scriversi da sé «Costruisco il punto con controllo» senza averlo scelto.
 */
export function valoreAmmesso(domanda, valore) {
  const v = assessTxt(valore);
  if (!domanda || !v) return '';
  const trovata = (domanda.opzioni || []).find((o) => assessKey(o.valore) === assessKey(v));
  return trovata ? trovata.valore : '';
}

/**
 * La risposta scelta per POSIZIONE, che è come arriva da un bottone di Telegram.
 *
 * ⭐⭐ Perché il numero e non il testo, ed è una scelta di disegno: `callback_data` ha 64 byte in
 * tutto, e soprattutto **la corrispondenza numero → risposta la deve fare chi conosce le
 * domande**. Se la facesse il bot, il bot terrebbe una copia dell'elenco — e due elenchi, prima
 * o poi, divergono. Il bot manda «ha toccato il terzo bottone della domanda X»; qual è il terzo
 * lo sa il gestionale. *Il gestionale SA, il bot DICE.*
 * 🔒 Fuori intervallo torna vuoto, come una risposta inventata: non esiste un «terzo bottone»
 * su una domanda che ne ha due.
 */
export function valoreDaIndice(domanda, indice) {
  /* 🚨 `Number(null)` fa **0**, e `Number('')` pure: senza questa riga «non mi hai detto quale
     bottone» diventerebbe «ha toccato il primo», cioè una risposta scelta dal codice al posto
     del socio. Trovato dal banco, non rileggendo — è il gemello di `definizioneLivello('')`
     che tornava Principiante, e la coppia dice che in questa catena lo zero implicito è il
     difetto ricorrente. */
  const grezzo = assessTxt(indice);
  const n = Number(grezzo);
  if (!domanda || !grezzo || !Number.isInteger(n) || n < 0) return '';
  const opzione = (domanda.opzioni || [])[n];
  return opzione ? opzione.valore : '';
}

/** Le sole risposte di conoscenza, nella forma che `assessKnowledgeEvaluate` si aspetta. */
export function risposteConoscenza(risposte) {
  const out = {};
  for (const [chiave, valore] of Object.entries(risposte || {})) {
    const id = idDaChiaveConoscenza(chiave);
    if (id) out[id] = assessTxt(valore);
  }
  return out;
}

/**
 * La SCHEDA da consegnare, costruita con le stesse chiavi che manda la pagina
 * (`buildAssessmentPublicPayload`): `experience`, `frequency`, `declaredLevel`, `balancedLevel`,
 * `rally`, `glass`, `net`, `overhead`, più nome e sesso.
 * ⭐ È il punto in cui le due strade si ricongiungono: da qui in poi una scheda fatta a passi e
 * una fatta dalla pagina sono **la stessa cosa**, e la correzione, il livello e il cancello
 * sono un codice solo. Nessuna regola vive in due versioni.
 */
export function schedaDaRisposte(risposte, anagrafica) {
  const date = risposte || {};
  const chi = anagrafica || {};
  const scheda = {};
  for (const d of SCHEDA_DOMANDE) scheda[d.chiave] = assessTxt(date[d.chiave]);
  scheda.first_name = assessTxt(chi.first_name);
  scheda.last_name = assessTxt(chi.last_name);
  // Il sesso non si chiede: lo legge il server dalla scheda socio (voce 84 ⓑ). Qui resta
  // vuoto di proposito — `consegna` lo ripesca, ed è l'unico posto in cui deve saperlo fare.
  scheda.gender = assessTxt(chi.gender);
  scheda.source = 'bot-a-passi';
  scheda.origin = 'bot-a-passi';
  return scheda;
}

/** Nome e cognome dal `member_name` del gettone, con la stessa spaccatura della pagina. */
export function nomeSpezzato(nomeIntero) {
  const parti = assessTxt(nomeIntero).split(/\s+/).filter(Boolean);
  if (!parti.length) return { first_name: '', last_name: '' };
  if (parti.length === 1) return { first_name: parti[0], last_name: '' };
  return { first_name: parti[0], last_name: parti.slice(1).join(' ') };
}
