// promemoria-livello.ts — «a questo socio il promemoria del livello tocca ADESSO?»
//
// 🗣️ La riga è sua, 17/08/2026 (voce 61 § B): *«a chi non ha il livello ci dobbiamo
// ricordare di chiedere gentilmente se può fare il test. Magari non tutte le settimane, ma
// un paio di volte al mese»*.
//
// ⭐⭐ PERCHÉ LA REGOLA STA QUI E NON NEL BOT. È la divisione dichiarata in `CLAUDE.md` —
// *il gestionale SA, il bot DICE* — e qui non è una formalità: «chi non ha il livello» è
// una domanda sull'anagrafica e sulle schede, cioè su cose che vivono in questo database e
// che il bot non vede. Il bot riceve un sì/no e una chiave, esattamente come per
// `puo_prenotare` e `puo_scegliere`: il giorno in cui il committente cambia la cadenza,
// questo file cambia e sulla VM non si tocca niente.
//
// ⚖️ IL PERIODO È UNA CASELLA DEL CALENDARIO, NON «N GIORNI DALL'ULTIMA VOLTA», ed è la
// decisione che regge tutto il resto. La strada ovvia — ricordare quando si è parlato e
// contare da lì — vorrebbe una colonna nuova, in un database, scritta da chi manda il
// messaggio. Ma a mandarlo è il BOT, e la memoria finirebbe in un terzo posto ancora: né
// dove sta la verità sul socio, né dove sta la regola.
// ⇒ Qui il periodo si CALCOLA: dall'epoca fissa, a passi di `GIORNI_TRA_PROMEMORIA`. È lo
//   stesso mestiere che in `giro-del-test.ts` fa il conto delle prove — *non è tenuto, è
//   calcolato dai fatti* — e ha lo stesso vantaggio: non c'è niente da azzerare, niente da
//   sincronizzare, e due processi che chiedono insieme leggono la stessa casella.
// 🚨 Il «una volta sola per casella» non lo garantisce questo file e non deve: lo garantisce
//   il registro del bot, con lo stesso `update … where colonna is null` che dal 9/08 impedisce
//   il doppio avviso dopo il test. Qui si dice QUALE casella; là si dice se è già bruciata.
//
// 🔢 UNA COPIA SOLA, e va detto perché non sembri una dimenticanza: `giro-del-test.ts` vive
// in TRE copie identiche perché la usano tre funzioni, e i deploy saltano `_shared/`. Questa
// la usa **un ponte solo**. Il giorno in cui servisse a un secondo, si copia e si mette la
// guardia byte-per-byte — non prima: una copia che nessuno usa è solo un secondo posto dove
// sbagliare.
//
// ── COME SI PROVA ────────────────────────────────────────────────────────────────────────
// Come `giro-del-test.ts`: da qui in giù è JavaScript NUDO, e le uniche annotazioni sono
// `: any`. Il banco (`test/consumer-assessment-link.test.mjs`) ESTRAE queste funzioni dal
// sorgente vero e le prova una per una — un banco che ricopiasse la regola proverebbe la
// propria copia.

/** Quanti giorni dura una casella. 15 ⇒ due volte al mese, che è la sua frase. */
export const GIORNI_TRA_PROMEMORIA = 15;

/**
 * L'inizio del calendario delle caselle.
 *
 * ⚖️ Un istante qualunque nel passato andrebbe bene: quello che conta è che sia FISSO e
 * uguale per tutti. Fosse «la data di iscrizione del socio», due soci avrebbero caselle
 * sfasate e la stessa domanda darebbe risposte diverse a seconda di chi la fa.
 */
export const EPOCA_PROMEMORIA = '2026-01-01T00:00:00.000Z';

/** I motivi del NO, che si raccontano invece di tacere: servono a diagnosticare dal vivo. */
export const MOTIVO_HA_LIVELLO = 'ha_livello';
export const MOTIVO_IN_ATTESA = 'in_attesa';
export const MOTIVO_SCHEDA_RECENTE = 'scheda_recente';
export const MOTIVO_DA_PERSONA = 'scheda_da_persona';
export const MOTIVO_DATA_ILLEGGIBILE = 'data_scheda_illeggibile';
export const MOTIVO_OROLOGIO = 'orologio_illeggibile';
export const MOTIVO_DOVUTO = 'senza_livello';
/* 🆕 28/08/2026 (E9 / A6) — chi aspetta il maestro non è «senza livello per pigrizia»: ha
   già fatto il test, l'ha passato, e sta fermo per una ragione che non dipende da lui.
   Ricordarglielo sarebbe chiedergli di rifare una cosa **appena fatta e riuscita**. */
export const MOTIVO_ASPETTA_MAESTRO = 'aspetta_il_maestro';

/**
 * La casella di calendario in cui cade questo istante.
 *
 * Torna `null` su un orologio che non si legge: chi chiama non manda niente, che è il verso
 * giusto del dubbio per un messaggio che nessuno ha chiesto.
 */
export function casellaDelPromemoria(adessoMs: any, giorni: any) {
  const t = Number(adessoMs);
  const epoca = Date.parse(String(EPOCA_PROMEMORIA));
  const passi = Math.round(Number(giorni));
  if (!Number.isFinite(t) || !Number.isFinite(epoca) || !Number.isFinite(passi) || passi < 1) return null;
  const passo = passi * 24 * 60 * 60 * 1000;
  const indice = Math.floor((t - epoca) / passo);
  const inizio = epoca + indice * passo;
  return {
    // La chiave è la DATA d'inizio della casella: si legge a occhio in un registro, e due
    // caselle distano quindici giorni, quindi due date non possono coincidere.
    chiave: new Date(inizio).toISOString().slice(0, 10),
    inizio: new Date(inizio).toISOString(),
    fine: new Date(inizio + passo).toISOString(),
    inizioMs: inizio,
    fineMs: inizio + passo,
  };
}

/**
 * 🚨⭐⭐ LA REGOLA, e le quattro porte sono tutte «NON parlare».
 *
 * Un promemoria è un messaggio che nessuno ha chiesto: il costo di mandarlo a sproposito è
 * molto più alto del costo di saltarne uno. ⇒ Ogni dubbio si risolve col silenzio, e ogni
 * porta ha il suo motivo scritto, così dal vivo si vede PERCHÉ uno non è partito.
 *
 * ① **ha già il livello** — la domanda non lo riguarda. La regola di cosa sia «averlo» non
 *    la si riscrive qui: è `livelloDimostrato`, la stessa del readmodel, byte per byte;
 * ② **è in attesa** — ha finito il suo giro e il test non lo può rifare adesso. Dirgli «fai
 *    il test» sarebbe mandarlo contro una porta chiusa, cioè il vicolo cieco che su questo
 *    bot non si fa mai;
 * ③ **la sua ultima scheda è arrivata in questa casella** — ha appena fatto una prova, o ha
 *    una domanda in sospeso da rispondere (il ④). Ricordarglielo mentre aspetta la sua stessa
 *    risposta sarebbe il bot che non sa cosa ha già detto;
 * ④ **la sua ultima scheda è `skip`** — il quiz non l'ha giudicato, e a `skip` ci si arriva
 *    in due modi opposti: Semi-Pro e Professionista (la scheda la guarda il maestro, voce 61
 *    ⑤) e la fascia illeggibile (il guasto del 14/08). ⚖️ In TUTTI E DUE «rifai il test» non
 *    produrrebbe un livello, e nel primo sarebbe anche falso — quel socio il test l'ha fatto.
 *    ⭐ Qui non si distinguono i due, di proposito: distinguerli vorrebbe una seconda copia
 *    della regola della fascia (che vive nel bot) per guadagnare un messaggio che in un caso
 *    sarebbe sbagliato e nell'altro inutile. Il muro dell'organizzare resta e non passa di qui:
 *    chi ha bisogno del livello lo trova comunque, quando prova a usarlo.
 *
 * ⑤ **la data della sua ultima scheda non si legge** — non è una porta in più, è la ③ che si
 *    rifiuta di indovinare: senza la data non si può dire se la scheda cade in questa casella,
 *    e la risposta onesta è tacere. Ha un motivo suo per distinguerlo, dal vivo, da un socio
 *    che una scheda ce l'ha davvero.
 */
export function promemoriaDelLivello(d: any) {
  const dati = d || {};
  const casella = casellaDelPromemoria(dati.adessoMs, dati.giorni);
  if (!casella) return { dovuto: false, motivo: MOTIVO_OROLOGIO, periodo: '', fino_a: '' };

  const comune = { periodo: casella.chiave, fino_a: casella.fine };
  if (dati.haIlLivello === true) return { dovuto: false, motivo: MOTIVO_HA_LIVELLO, ...comune };
  if (dati.ammesso !== true) return { dovuto: false, motivo: MOTIVO_IN_ATTESA, ...comune };
  if (String(dati.ultimoEsito ?? '').trim() === 'skip') {
    return { dovuto: false, motivo: MOTIVO_DA_PERSONA, ...comune };
  }
  /* 🆕🚨⭐⭐ 28/08/2026 — E9 / A6: CHI ASPETTA IL MAESTRO NON RICEVE IL PROMEMORIA.
     🗣️ Regola sua, e vale **solo** per chi aspetta il maestro: il promemoria normale ai soci
     senza livello resta (A5), non si tocca.
     📏 Il difetto: qui si escludeva solo `skip`, quindi a chi aveva appena **passato** il test
     con un livello sopra il tetto il bot chiedeva di **rifarlo** — a uno che ha fatto tutto
     giusto e sta aspettando che qualcun altro faccia la sua parte. È la stessa forma di P0: un
     silenzio (o qui un rumore) che nasce dal guardare il livello invece del **perché** manca.
     ⚖️ E l'altra metà della A6 — *«l'avviso va alla segreteria»* — è già viva e sta altrove:
     `assessment-apply-level` mette `staff_status: applied_review` e scrive in `segnala`
     *«sopra Intermedio certifica il maestro, guardandolo giocare»*. ⇒ Qui non si aggiunge un
     secondo canale verso la segreteria: si toglie il messaggio sbagliato al socio.
     📌 *Chi aspetta qualcun altro non va sollecitato: va sollecitato l'altro.* */
  if (dati.aspettaIlMaestro === true) {
    return { dovuto: false, motivo: MOTIVO_ASPETTA_MAESTRO, ...comune };
  }
  // 🚨 Chi chiama passa 0 quando di schede non ce n'è NESSUNA, e un valore non leggibile
  // quando ce n'è una la cui data non si legge. I due casi hanno risposte opposte, e
  // confonderli è il modo in cui una data storta si trasformerebbe in un messaggio: qui il
  // dubbio vale silenzio, come nelle altre porte.
  const ultima = Number(dati.ultimaSchedaMs);
  if (!Number.isFinite(ultima)) return { dovuto: false, motivo: MOTIVO_DATA_ILLEGGIBILE, ...comune };
  if (ultima >= casella.inizioMs) return { dovuto: false, motivo: MOTIVO_SCHEDA_RECENTE, ...comune };
  return { dovuto: true, motivo: MOTIVO_DOVUTO, ...comune };
}
