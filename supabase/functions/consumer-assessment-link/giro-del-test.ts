// giro-del-test.ts — LA REGOLA DEL GIRO, una sola, in TRE COPIE IDENTICHE.
//
// 🚨⭐⭐ PERCHÉ TRE COPIE E NON `_shared/`: dalla voce 61 § A ④ (18/08/2026) il giro lo
// devono ricostruire più funzioni — `consumer-assessment-link` per dire al socio a che
// punto è, `assessment-apply-level` per sapere se una prova si applica da sola,
// `consumer-assessment-decision` per validare la scelta. I workflow di deploy scelgono le
// funzioni dalle **cartelle toccate** e saltano tutto ciò che inizia per `_`: un modulo in
// `_shared/` cambierebbe in git senza rideployare NESSUNO — resterebbe la copia vecchia,
// in silenzio e col semaforo verde. È lo stesso motivo (e lo stesso disegno) di
// `scrittura-al-circolo.ts`, che di copie ne ha otto.
// ⚠️ Le TRE copie vivono in `consumer-assessment-link/`, `assessment-apply-level/` e
// `consumer-assessment-decision/`, e le tiene uguali **byte per byte** il banco
// `test/consumer-assessment-link.test.mjs`: chi ne cambia una le cambia tutte — ed è
// proprio quel gesto a far rideployare tutte le funzioni che la usano.
//
// ── LA REGOLA, decisa dal committente (17-19/08/2026) ────────────────────────────────────
// · un giro sono TRE prove (una prova = una scheda arrivata col cancello `pass` o `fail`);
// · *«decidi tu a quale delle tre volte ti vuoi fermare»* ⇒ il giro si chiude in DUE modi:
//   - ESAURITO: le prove sono finite — l'attesa parte dall'ultima prova;
//   - CONFERMATO: il socio ha detto «mi fermo» — l'attesa parte dalla sua scelta;
// · se la terza prova porta anche la conferma, il giro è ESAURITO: era finito comunque,
//   e contare l'attesa dalla scelta (che arriva dopo) la allungherebbe a chi ha solo
//   risposto a una domanda;
// · `skip` non è una prova (Semi-Pro e Professionista il quiz non ce l'hanno);
// · il SILENZIO non blocca per sempre: una prova senza risposta si applica da sé dopo
//   `ORE_SILENZIO_ASSENSO` (regola del 19/08: *«dopo 24 ore si applica»*) — quel pezzo
//   vive in `assessment-apply-level`; qui sta solo il numero, perché il ponte lo racconta
//   («hai tempo fino a…») e due copie del numero divergerebbero.
//
// ── COME SI PROVA ────────────────────────────────────────────────────────────────────────
// Da qui in giù è JavaScript NUDO: le uniche annotazioni sono `: any`, di proposito — i
// banchi (`test/consumer-assessment-link.test.mjs`, `test/assessment-apply-level.test.mjs`,
// `test/consumer-assessment-decision.test.mjs`) ESTRAGGONO queste funzioni dal sorgente
// vero e le provano una per una. Una copia riscritta nel banco misurerebbe la copia. Chi
// mette qui un tipo diverso da `any` non rompe niente in silenzio: il banco non riesce più
// a valutare la funzione e muore subito.

export const TENTATIVI_PER_GIRO = 3;

/* 🆕⭐⭐ 25/08/2026 — L'ATTESA È TOLTA: da 30 giorni a ZERO. Sua decisione, presa insieme al
   tetto a Intermedio e alla banca allargata.
   🗣️ Era partito volendola accorciare (*«ogni 24 ore puoi ripetere il test per max 3 volte
   di seguito»*), e misurando è saltato fuori che accorciarla non bastava: con 11 domande per
   fascia, 3 prove al giorno × 4 domande fanno 12 viste — cioè in UN GIORNO SOLO un socio
   vedeva la banca intera, trappole comprese. ⇒ L'attesa non era una difesa: era un ritardo
   che sembrava una difesa.

   ⚖️ QUELLO CHE DIFENDE DAVVERO, e per questo l'attesa si può togliere senza scoprire niente:
     · la BANCA GRANDE (27 normali + 9 trabocchetti per fascia, dal 25/08): in tre prove si
       vede al massimo un terzo delle domande, quindi rifare il test non è più «ricordare»;
     · il TETTO a Intermedio: sopra non decide il quiz ma il maestro, guardando giocare ⇒ il
       massimo che si ottiene mentendo è Intermedio, e chi ci arriva mentendo si smaschera in
       campo con Intermedi veri.
   ⇒ Le due difese non dipendono dal tempo, e infatti il tempo se n'è potuto andare.

   🔒 SI METTE A ZERO, NON SI CANCELLA: la macchina del giro resta intera (`statoDelGiro` la
   legge come parametro), quindi rimetterla è cambiare un numero. Cancellarla vorrebbe dire
   riscrivere la regola per tornare indietro — e una decisione di prodotto va tenuta
   reversibile quanto è facile cambiarla.
   📏 Con zero il ramo dell'attesa è irraggiungibile per costruzione: `adessoMs < chiusoIl + 0`
   è falso appena il giro è chiuso, quindi si cade sul giro nuovo. Nessuna inversione, nessun
   caso limite: è lo stesso codice di prima con la porta sempre aperta.
   ⛔ Il bot non ha una riga da cambiare: lo stato `attesa` glielo diceva il ponte, e adesso
   il ponte non lo dice più. */
export const GIORNI_DI_ATTESA = 0;

/* 🆕⭐⭐ 26/08/2026 — IL SILENZIO NON SI ASPETTA PIÙ: da 24 ore a ZERO. Sua decisione, presa
   guardando il messaggio arrivato sul telefono: *«l'ultima frase io direi di levarla in quanto
   la variazione la fai immediata»*.
   ⚖️ Era la riga «Se non mi dici niente entro giovedì 10:27, tengo questo livello». La sua
   premessa non era ancora vera — l'attesa c'era, ed era di 24 ore (regola sua del 19/08) — ⇒
   invece di togliere la frase e lasciare l'attesa (che avrebbe reso il bot **muto** su una cosa
   che succede lo stesso: la definizione di sleale), si è tolta **l'attesa**, e la frase è
   sparita perché non aveva più niente da annunciare.
   📌 *Una frase che descrive un meccanismo si toglie togliendo il meccanismo, non la frase.*

   ⚖️ QUELLO CHE NON CAMBIA, ed è il motivo per cui si può togliere: la scelta del socio resta.
   «Riprovo il test» apre un giro nuovo come prima (rifarlo è libero dal 25/08, `GIORNI_DI_ATTESA
   = 0`), e «Tengo questo livello» conferma una cosa già scritta invece di provocarla. Ciò che
   sparisce è solo il **tempo di mezzo**, in cui il socio aveva un livello nuovo che il
   gestionale non aveva ancora.

   🔒 SI METTE A ZERO, NON SI CANCELLA — stessa scelta di `GIORNI_DI_ATTESA` qui sopra, e per
   la stessa ragione: la macchina del silenzio-assenso resta intera in `assessment-apply-level`,
   quindi rimetterla è cambiare un numero. Con zero il confronto `adesso >= consegna + 0` è vero
   dal primo giro del cron: nessuna inversione, nessun caso limite, è lo stesso codice con la
   porta sempre aperta.
   ⏳ «Subito» vuol dire «al primo giro del cron», non «nello stesso istante»: quanto ci metta lo
   sa il gestionale, ed è per questo che il bot continua a dire «fra poco» e non un numero di
   minuti (lezione della voce 89). */
export const ORE_SILENZIO_ASSENSO = 0;

// I due valori che `self_assessments.member_decision` può assumere. Sono parole del socio
// («mi fermo» / «riprovo»), scritte come le ha dette lui: chi legge il database deve capire
// la scelta senza una tabella di decodifica accanto.
export const SCELTA_MI_FERMO = 'mi_fermo';
export const SCELTA_RIPROVO = 'riprovo';

export function esitoDellaProva(scheda: any) {
  const knowledge = ((scheda || {}).raw_response || {}).knowledge || {};
  return String(knowledge.status ?? '').trim();
}

export function quandoMs(value: any) {
  const t = Date.parse(String(value ?? '').trim());
  return Number.isNaN(t) ? 0 : t;
}

export function sceltaDellaProva(scheda: any) {
  return String((scheda || {}).member_decision ?? '').trim();
}

// La stessa prova, riconosciuta in due elenchi diversi: il gettone è il filo fra la persona
// e la scheda, e la data disambigua l'improbabile gettone che ne portasse due.
export function stessaProva(a: any, b: any) {
  const tokA = String((a || {}).token ?? '').trim();
  const tokB = String((b || {}).token ?? '').trim();
  if (!tokA || !tokB || tokA !== tokB) return false;
  return String((a || {}).submitted_at ?? '').trim() === String((b || {}).submitted_at ?? '').trim();
}

// ── LA CAMMINATA: dalle schede ai giri ───────────────────────────────────────────────────
// Si formano i giri in ordine di tempo. Un giro si chiude quando le sue prove sono finite
// (ESAURITO) o quando il socio si è fermato (CONFERMATO); quello che resta in fondo è il
// giro aperto. ⚠️ Un giro cominciato e abbandonato resta APERTO, anche per mesi: chi ha
// fatto una prova sola e non è più tornato ne ha ancora due. Farlo scadere sarebbe una
// regola che nessuno ha deciso, e qui non si inventano regole per il socio.
// 🚨 L'ordine dei due controlli NON è libero: alla terza prova l'esaurimento vince sulla
// conferma — vedi l'intestazione. Chi li scambia allunga l'attesa a chi risponde.
export function giriDelSocio(schede: any, provePerGiro: any) {
  const prove = (Array.isArray(schede) ? schede : [])
    .filter((s: any) => { const e = esitoDellaProva(s); return e === 'pass' || e === 'fail'; })
    .slice()
    .sort((a: any, b: any) => quandoMs(a?.submitted_at) - quandoMs(b?.submitted_at));

  const chiusi: any[] = [];
  let corrente: any[] = [];
  for (const s of prove) {
    corrente.push(s);
    const falliti = corrente.filter((x: any) => esitoDellaProva(x) === 'fail').length;
    if (corrente.length >= provePerGiro) {
      chiusi.push({ motivo: 'esaurito', chiusoIl: String(s?.submitted_at ?? '').trim(), falliti, prove: corrente });
      corrente = [];
    } else if (sceltaDellaProva(s) === SCELTA_MI_FERMO) {
      chiusi.push({ motivo: 'confermato', chiusoIl: String(s?.member_decision_at ?? '').trim(), falliti, prove: corrente });
      corrente = [];
    }
  }
  return { chiusi, corrente };
}

// Torna sempre la stessa forma, anche quando ammette: il bot deve poter dire «è la tua
// seconda prova, te ne resta una» senza tenere niente in memoria.
export function statoDelGiro(schede: any, adessoMs: any, provePerGiro: any, giorniDiAttesa: any) {
  const giri = giriDelSocio(schede, provePerGiro);
  const corrente = giri.corrente;

  const falliteAperte = corrente.filter((x: any) => esitoDellaProva(x) === 'fail').length;
  if (corrente.length) {
    return { ammesso: true, prova: corrente.length + 1, falliti: falliteAperte, ultima_prova: corrente.length + 1 >= provePerGiro, attesa: null };
  }

  const chiuso = giri.chiusi.length ? giri.chiusi[giri.chiusi.length - 1] : null;
  if (chiuso) {
    const sbloccoMs = quandoMs(chiuso.chiusoIl) + giorniDiAttesa * 24 * 60 * 60 * 1000;
    // 🔒 Se la data di chiusura non si legge NON si blocca nessuno: `quandoMs` torna 0,
    // l'attesa risulterebbe scaduta nel 1970 e il giro riparte. Un dato storto non deve
    // trasformarsi in una porta chiusa in faccia a un socio che non ha fatto niente.
    if (quandoMs(chiuso.chiusoIl) && adessoMs < sbloccoMs) {
      return {
        ammesso: false,
        prova: 0,
        falliti: chiuso.falliti,
        ultima_prova: false,
        attesa: {
          motivo: chiuso.motivo,
          dal: new Date(sbloccoMs).toISOString(),
          giorni: Math.max(1, Math.ceil((sbloccoMs - adessoMs) / (24 * 60 * 60 * 1000))),
        },
      };
    }
  }

  // Nessuna prova, o attesa scaduta: il giro nuovo nasce INTERO.
  // ⭐ È il vantaggio del conto calcolato: il tempo fa da sé quello che altrove
  // sarebbe una riga da aggiornare (e da dimenticare).
  return { ammesso: true, prova: 1, falliti: 0, ultima_prova: provePerGiro <= 1, attesa: null };
}

/* ═══ 🆕🗣️⭐⭐ 27/08/2026 — IL TETTO, e da oggi vive QUI ═══════════════════════════════
   🗣️ Sua regola: *«quando un socio fa il test e risulta un livello superiore da avanzato in
   su, gli viene detto di contattare la segreteria per farsi vedere dal maestro in una partita
   in modo da validare il nuovo livello. Ma al momento resta invariato il suo livello.»*

   🚨 PERCHÉ LA SOGLIA SI SPOSTA IN QUESTO MODULO invece di essere letta dove serve: fino a
   stamattina `3.5` stava in **due** posti — `TETTO_AUTOMATICO` in `assessment-apply-level`
   (che taglia il livello scritto) e `PMO_TETTO_MAESTRO` in `index.html` (che fa la lista del
   maestro). Per dire al SOCIO che aspetta il maestro serviva saperlo anche nel ponte del
   link: sarebbe stata la **terza** copia di un numero che decide chi sale di livello.
   ⇒ Il modulo del giro è già l'unico posto che le tre edge condividono byte per byte, con una
   guardia che lo pretende. La soglia entra lì.
   ⚠️ La copia in `index.html` resta, e si dichiara: la pagina non importa moduli dalle edge.
   È l'ultima gemella, ed è scritta nel commento di `PMO_TETTO_MAESTRO`.

   ⚖️ E COSA NON DECIDE, che è la metà che tiene la regola onesta: `sopraIlTetto` dice solo
   *«questa prova ha dimostrato più di quanto il test possa scrivere»*. Cosa scrivere in scheda
   lo decide `assessment-apply-level` (Intermedio a chi sta sotto, niente a chi sta già sopra —
   sua decisione del 26/08, ribadita il 27/08); cosa dire al socio lo decide il bot. Una
   funzione sola per una domanda sola. */
export const TETTO_AUTOMATICO = 3.5;

/* 🔄 27/08 — LA SCALA arriva anche lei qui, e per la stessa ragione del tetto. Stava in
   `assessment-apply-level` (`definizioneLivello`), e serviva anche al ponte del link per dire
   al socio quale livello ha ADESSO in scheda — perché la parola che il bot annunciava era la
   fascia **dichiarata**, non quella scritta, e sopra il tetto le due divergono.
   ⚠️ Le altre copie restano e si dichiarano: `PMO_LIVELLI` in `conoscenza.js` (che serve al
   calcolo, non a questa domanda) e `pmoLivelloFascia` in `index.html` (la pagina non importa
   moduli dalle edge). Qui non se ne aggiunge una: se ne sposta una. */
/**
 * Da numero a PAROLA. 🚨 IL VUOTO NON È ZERO — trovato da un banco: `Number('')` fa 0, quindi
 * un livello mancante si sarebbe chiamato «Principiante», cioè un nome inventato su un
 * non-dato, dentro un messaggio che va a una persona. Senza numero non c'è fascia.
 * ⚠️ La tabella sta DENTRO la funzione, e non è stile: i banchi estraggono le funzioni una per
 * una dal sorgente vero e le eseguono in una `vm`. Una tabella fuori resterebbe indietro, e la
 * funzione morirebbe con `LIVELLI is not defined` — misurato, non previsto.
 */
export function definizioneLivello(value: any) {
  const LIVELLI = [
    { max: 1.5, definizione: 'Principiante' },
    { max: 2.5, definizione: 'Base' },
    { max: 3.5, definizione: 'Intermedio' },
    { max: 4.5, definizione: 'Avanzato' },
    { max: 5.5, definizione: 'Agonista' },
    { max: 6.5, definizione: 'Semi-Pro' },
    { max: 7.0, definizione: 'Professionista' },
  ];
  const raw = String(value ?? '').replace(',', '.').trim();
  if (!raw) return '';
  const n = Number(raw);
  if (!Number.isFinite(n)) return '';
  return (LIVELLI.find((f) => n <= f.max) || LIVELLI[LIVELLI.length - 1]).definizione;
}

/** Il livello che la prova ha DIMOSTRATO — numero, o `null` se non se ne ricava uno. */
export function livelloDimostrato(scheda: any) {
  const grezzo = String((scheda || {}).calculated_level ?? '').trim().replace(',', '.');
  if (!grezzo) return null;
  const n = Number(grezzo);
  return Number.isFinite(n) ? n : null;
}

/**
 * «Questa prova aspetta il maestro?» — cioè: il quiz è passato, il livello dimostrato sta sopra
 * il tetto, **e il socio ha dimostrato più di quello che ha in scheda**.
 *
 * 🚨 Il quiz DEVE essere passato: a chi lo fallisce la promessa del maestro non è mai uscita, e
 * dargliela qui vorrebbe dire mandare in segreteria chi ha sbagliato le domande.
 *
 * 🔄🗣️⭐⭐ 27/08/2026 sera — IL TERZO PEZZO È ARRIVATO DOPO, ed è quello che tiene insieme le due
 * metà. Nato la mattina, questo controllo guardava solo il tetto; la lista del maestro nel
 * gestionale, invece, usa `dimostrato > inScheda` (voce 100, allargata da lui la sera stessa).
 * ⇒ Senza questa riga le due regole **direbbero cose diverse**: chi ha 4 e dimostra 4 — il caso
 * vero del 26/08, dove non c'è niente da certificare — si sarebbe visto mandare in segreteria
 * dal bot, e in Anagrafica soci non ci sarebbe stato. Un socio che si presenta al circolo per
 * una cosa che il circolo non gli ha chiesto.
 * 📌 *Due regole che rispondono alla stessa domanda non possono vivere in due posti con due
 * forme: o è una sola, o prima o poi divergono — e chi paga la divergenza è chi ci cammina.*
 * ⚠️ La gemella che resta è `assessmentAspettaIlMaestro` in `index.html`, e si dichiara: la
 * pagina non importa moduli dalle edge. Le due si guardano nel banco `lista-per-il-maestro`.
 *
 * 🔒 Chi non ha ancora un livello (`livelloAttuale` non è un numero) entra: non ha niente da
 * confrontare, e il tetto sopra basta da solo. È il verso sicuro — quel socio è proprio quello
 * per cui la certificazione serve di più.
 */
/* ⚠️ `livelloAttuale: any` e non `?: any`, e non è stile: i banchi estraggono queste funzioni
   dal sorgente vero e le spogliano delle annotazioni con una regexp che il punto interrogativo
   non conosce. Con `?:` la `vm` muore con `Unexpected token '?'` — misurato, non previsto. */
export function sopraIlTetto(scheda: any, livelloAttuale: any) {
  if (esitoDellaProva(scheda) !== 'pass') return false;
  const n = livelloDimostrato(scheda);
  if (n === null || !(n > TETTO_AUTOMATICO)) return false;
  const grezzo = String(livelloAttuale ?? '').trim().replace(',', '.');
  const inScheda = grezzo ? Number(grezzo) : NaN;
  if (!Number.isFinite(inScheda)) return true;
  if (!(n > inScheda)) return false;
  /* 🔄🗣️⭐⭐ 27/08/2026 mattina — E SI CONFRONTANO LE PAROLE, NON SOLO I NUMERI. Sua regola,
     data col caso di Maurizio sotto gli occhi (in scheda 4, test 4,5 — tutti e due «Avanzato»):
     *«quando uno fa il test e risulta lo stesso livello che già ha nella scheda di anagrafica,
     non c'è bisogno che si chiami il maestro. Ci deve essere il bottone: tengo il mio livello
     oppure rifaccio il test.»*
     ⚖️ Il livello di un socio è una PAROLA (regola del 9/08: il numero non gli si dice mai), e
     il maestro certifica una parola che il socio non ha ancora. Qui la parola è già la sua:
     mandarlo in segreteria è chiedere al maestro un lavoro già fatto — e il messaggio che ne
     usciva diceva «in scheda hai Avanzato… le tue risposte sono da Avanzato», cioè la stessa
     parola due volte, con in mezzo l'ordine di farla certificare.
     ⇒ Il confronto sui numeri resta (chi dimostra MENO non è mai «sopra»); a fare la differenza
     in più serve una FASCIA diversa. La gemella `assessmentAspettaIlMaestro` in `index.html`
     cambia insieme, e le due si guardano nei banchi. */
  return definizioneLivello(n) !== definizioneLivello(inScheda);
}

/**
 * 🆕🗣️ 27/08/2026 mattina (variante P7 di `docs/test-livello-varianti.md`, approvata da lui) —
 * «questa prova ha detto MENO di quello che il socio ha in scheda?».
 *
 * ⚖️ Dove è vero non c'è nessuna scelta da fare: il livello non si abbassa mai con un test
 * (sua regola del 27/08), quindi «tieni o riprovi?» avrebbe due risposte che portano allo
 * stesso posto — non una scelta, una promessa travestita (la stessa forma del caso di Laura
 * sopra il tetto, un ramo più in là). Il ponte lo manda al bot (`il_test_dice_meno`), che
 * dice il fatto — «il tuo livello resta X» — e offre il bottone per riprovare.
 *
 * 🚨 Il MENO si misura in PAROLE, come il «di più» di `sopraIlTetto`: 4 e 4,5 sono tutti e
 * due «Avanzato», e quel caso resta una scelta vera (tengo = resto quello che sono). Serve
 * quindi numero più basso E fascia diversa.
 * 🔒 Chi non ha un livello in scheda non può «dire meno» di niente: falso.
 */
export function ilTestDiceMeno(scheda: any, livelloAttuale: any) {
  if (esitoDellaProva(scheda) !== 'pass') return false;
  const n = livelloDimostrato(scheda);
  if (n === null) return false;
  const grezzo = String(livelloAttuale ?? '').trim().replace(',', '.');
  const inScheda = grezzo ? Number(grezzo) : NaN;
  if (!Number.isFinite(inScheda)) return false;
  if (!(n < inScheda)) return false;
  return definizioneLivello(n) !== definizioneLivello(inScheda);
}

// «Questa prova ha ESAURITO il suo giro?» — è la domanda di `assessment-apply-level`:
// alla terza prova non c'è una domanda da fare al socio (non c'è una quarta a cui
// rimandare), quindi il suo esito si applica da solo, con le protezioni del ribasso.
// ⚖️ Conta SOLO l'esaurimento: una prova con «mi fermo» si applica perché il socio l'ha
// detto, non perché chiude il giro — e quella strada in `decidi` esiste già per conto suo.
export function laProvaEsaurisceIlGiro(schede: any, scheda: any, provePerGiro: any) {
  const giri = giriDelSocio(schede, provePerGiro);
  for (const g of giri.chiusi) {
    if (g.motivo !== 'esaurito') continue;
    if (stessaProva(g.prove[g.prove.length - 1], scheda)) return true;
  }
  return false;
}
