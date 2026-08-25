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

export const ORE_SILENZIO_ASSENSO = 24;

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
