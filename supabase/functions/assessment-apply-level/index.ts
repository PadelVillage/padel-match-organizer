import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';
import {
  TENTATIVI_PER_GIRO,
  ORE_SILENZIO_ASSENSO,
  SCELTA_MI_FERMO,
  SCELTA_RIPROVO,
  laProvaEsaurisceIlGiro,
} from './giro-del-test.ts';

// ─────────────────────────────────────────────────────────────────────────────
// assessment-apply-level — il livello dell'autovalutazione si applica senza che
// nessuno apra il gestionale; e dal 19/08/2026, sulle prove col cancello, SOLO
// quando il socio ha avuto la sua parola (la scelta, il giro finito, o il
// silenzio-assenso — la regola intera è qualche riga più giù).
//
// Voce `A4ter`, sua decisione del 9/08/2026: «tutto il processo automatico, la
// segreteria solo in casi estremi».
//
// 🚨 PERCHÉ NON BASTAVA QUELLO CHE C'ERA. Fino a stanotte il livello lo scriveva
// il GESTIONALE: `assessmentEmailRunAutoPostProcessing`, dentro l'app dello
// staff, sui dati caricati in QUEL browser, e solo quando qualcuno lanciava la
// sincronizzazione delle risposte. ⇒ «automatico» voleva dire «quando qualcuno
// apre l'app e preme un bottone». Misurato su PROD l'11/08: 12 soci avevano
// fatto il test fra maggio e giugno ed erano ancora a 0,5 — e da quando il muro
// del bot è acceso quel ritardo non è più una scomodità: è la porta chiusa in
// faccia a chi ha fatto quello che gli avevamo chiesto.
//
// 🚨🚨 LA REGOLA CHE IMPEDISCE IL DANNO, e non è un dettaglio di comodo.
// La versione ovvia — «applica tutte le schede non ancora applicate» — sarebbe
// stata una rovina: nel cloud di PROD c'è una scheda di aprile che calcola 2,5
// per una persona che oggi ha 4. Applicarla l'avrebbe fatta SCENDERE, e col
// muro acceso l'avrebbe bloccata. ⇒ Si applica una scheda solo se è più recente
// dell'ultimo aggiornamento del livello di quel socio (`applicabile`, qui sotto).
//
// 🚨🚨 E LA REGOLA CHE PROTEGGE IL SOCIO DAL PROPRIO TEST — sua, il 17/08/2026:
// *«se lo sbaglia in negativo non scende, a meno che non lo sbagli tre volte
// consecutive»*, e *«la terza volta scende solo di 0,5»*.
// Fino a qui la funzione applicava ogni scheda più recente **in tutti e due i
// versi**: una brutta giornata portava da Avanzato (4) a Principiante (1) in un
// colpo solo, e col muro del bot acceso quel socio non poteva più organizzare.
// ⇒ Adesso: al RIALZO si applica come sempre; al RIBASSO non si scende, e solo
// alla TERZA prova di fila più bassa si scende di mezzo passo — a 3,5, non a
// quello che dice il test.
// ⭐ Il conto NON è tenuto da nessuna parte: si CALCOLA dai fatti, come il conto
// dei tentativi nel ponte (`consumer-assessment-link`). Non c'è niente da
// azzerare e niente da tenere allineato: si guardano le schede del socio dalla
// più recente all'indietro e ci si ferma alla prima che non dice meno.
// 🔒 E fallisce CHIUSA: se la storia non si riesce a leggere il conto è 0, cioè
// «non si scende». Il guasto di una lettura non può far scendere nessuno.
//
// ⚖️ Cosa NON fa, per decisione sua dell'11/08:
//   · non manda nessuna email al socio (il cron delle email ai soci è spento);
//   · non tocca le schede che la segreteria ha in mano (`staff_status` non vuoto);
//   · non tocca chi arriva dal link generico: quello non è ancora un socio.
//
// 🚨🚨 E DAL 19/08/2026 LA MACCHINA NON DECIDE PIÙ DA SOLA — voce 61 § A ④, sua
// regola del 17/08: *«decidi tu a quale delle tre volte ti vuoi fermare»*.
// Una prova col cancello del quiz si applica SOLO quando c'è una di queste tre cose:
//   · la SCELTA del socio: «mi fermo» (`member_decision`, scritta dal ponte
//     `consumer-assessment-decision` quando il socio risponde al bot);
//   · il giro ESAURITO: la terza prova non ha una domanda da aspettare — non c'è
//     una quarta a cui rimandare — e si applica da sola;
//   · il SILENZIO oltre le `ORE_SILENZIO_ASSENSO` (24): sua regola del 19/08 —
//     *«dopo 24 ore si applica»* — perché «aspetta per sempre» riaprirebbe la porta
//     chiusa in faccia per cui questa funzione è nata: un socio a 0,5 che ignora la
//     domanda resterebbe senza livello e senza poter organizzare.
// Chi ha risposto «riprovo» ha SCARTATO quella prova: non si applica mai, nemmeno
// dopo le 24 ore — il silenzio è assenso, una risposta è una risposta.
// ⚖️ Le schede VECCHIE senza cancello restano applicabili come sempre: vengono
// dall'epoca delle email, nessun bot può fare loro una domanda, e la tolleranza del
// gestionale su di loro non cambia.
//
// 🔒 Come le altre routine: si entra solo col segreto (`x-pmo-routine-secret`),
// verificato dal database. Nessuna porta per lo staff, nessuna chiamata a mano.
// 🧪 `{"simula": true}` fa il giro SENZA scrivere e restituisce l'elenco di cosa
// farebbe: è il modo in cui si guarda prima di accendere, e resta utile dopo.
// ─────────────────────────────────────────────────────────────────────────────

type JsonMap = Record<string, unknown>;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pmo-routine-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PROD_PROJECT_REF = 'qqbfphyslczzkxoncgex';
const MASSIMO_PER_GIRO = 50;   // un tetto: se qualcosa impazzisce, non riscrive l'anagrafica intera
const FONTE = 'autovalutazione';

// ── I numeri della regola del RIBASSO (sue, 17/08/2026) ──────────────────────
const PROVE_PER_SCENDERE = 3;    // «a meno che non lo sbagli tre volte consecutive»
const PASSO_DISCESA = 0.5;       // «la terza volta scende solo di 0,5»
// 🚨 Il pavimento, e non è nella sua regola: è la conseguenza di applicarla.
// `0.5` in questo gestionale non è un livello, è «da definire» — e chi ce l'ha
// non può organizzare (il muro del bot). Far scendere qualcuno LÌ per tre prove
// storte vorrebbe dire togliergli il diritto di organizzare come effetto
// collaterale di una regola nata per PROTEGGERLO. ⇒ Si scende fino a 1, non oltre.
const LIVELLO_MINIMO_SCESO = 1;
const STORICO_PER_SOCIO = 20;    // quante schede si guardano indietro, come fa il ponte

// ── 🆕 IL TETTO DEL TEST, e il TERZO ESITO (sue decisioni del 25/08/2026) ─────
// 🗣️ Sue parole: *«Io direi di mettergli intermedio fino a che il maestro non lo certifica,
// e quindi noi da gestionale dentro la sua scheda certifichiamo il livello»*, e sul perché:
// *«questo fa sì anche che non ci sarà più gente che può barare»*.
//
// ⭐⭐ LA COSA CHE RENDE IL TETTO DIVERSO DA UN FILTRO, e va capita o si sbaglia il codice:
// il quiz produce DUE valori, non uno.
//   · il livello che si SCRIVE       → col tetto: mai sopra Intermedio;
//   · il livello che le risposte DIMOSTRANO → senza tetto, ed è quello che legge il maestro.
// 🚨 Sua correzione, e nasce da un mio errore: avevo proposto di far fare a chi dichiara alto
// il quiz di Intermedio — cioè di buttare via la seconda riga. *«Se tu sei un vero agonista,
// il quiz lo deve tirare fuori, poi ti blocca a intermedio e ti dice che il maestro ti deve
// vedere, ma comunque ti dice che tu hai risposto da agonista.»*
// ⇒ Perciò qui si CALCOLA sul livello dimostrato e si SCRIVE il livello tagliato: la misura
// non si perde, si limita solo ciò che la macchina si prende la responsabilità di scrivere.
//
// ⚖️ PERCHÉ IL TETTO TOGLIE IL GUADAGNO DEL BARARE: l'unico modo di barare misurato era
// alzare la dichiarazione e passare il cancello della fascia sopra. Col tetto il massimo che
// si ottiene mentendo è Intermedio — e chi ci arriva mentendo si trova in campo con Intermedi
// veri, cioè si smaschera giocando. Sopra, non decide più il quiz: decide il maestro.
const TETTO_AUTOMATICO = 3.5;    // l'estremo alto di Intermedio: sopra, certifica il maestro

// 🆕 IL TERZO ESITO — «livello scritto E segreteria avvisata».
// 🚨 Fino a stamattina non esisteva una via di mezzo: `staff_status` non vuoto voleva dire
// FERMO (vedi il controllo in `decidi`), quindi ogni sospetto diventava un blocco e la
// segreteria si sarebbe ritrovata sommersa di schede da guardare a mano. ⇒ Senza questa
// riga, il tetto o non serviva a niente o bloccava tutti.
// ⭐ La parola è nuova ma NON rompe l'app: i punti che chiedono «è applicata?» guardano
// `applied_at` e `applied_member_id`, che qui si scrivono lo stesso; i punti che chiedono
// «va guardata?» fanno `.includes('review')`, e questa parola lo contiene.
const STAFF_DA_CERTIFICARE = 'applied_review';

// 🚨 TERZA COPIA DELLA SCALA, dichiarata: la prima sta in `conoscenza.js`, la seconda
// nell'edge dell'email. Un livello chiamato con due nomi diversi in due messaggi è lo stesso
// difetto della voce 71 — un dato che dice due cose a chi lo legge.
// 🔗 `test/autovalutazione-conoscenza.test.mjs` confronta TUTTE E TRE e diventa rosso se una
// sola cambia. La tabella sta DENTRO la funzione di proposito: il banco estrae funzioni per
// nome, e una tabella fuori resterebbe fuori dalla prova.
function definizioneLivello(value: any) {
  const LIVELLI = [
    { max: 1.5, definizione: 'Principiante' },
    { max: 2.5, definizione: 'Base' },
    { max: 3.5, definizione: 'Intermedio' },
    { max: 4.5, definizione: 'Avanzato' },
    { max: 5.5, definizione: 'Agonista' },
    { max: 6.5, definizione: 'Semi-Pro' },
    { max: 7.0, definizione: 'Professionista' },
  ];
  // 🚨 IL VUOTO NON È ZERO, e trovato dal banco (caso 41): `Number('')` fa 0, quindi un
  // livello mancante si sarebbe chiamato «Principiante» — un nome inventato su un non-dato,
  // scritto dentro un messaggio che va al maestro. È la stessa riga che `pmoLivelloFascia`
  // in `conoscenza.js` ha già dovuto scrivere: senza numero non c'è fascia.
  const raw = String(value ?? '').replace(',', '.').trim();
  if (!raw) return '';
  const n = Number(raw);
  if (!Number.isFinite(n)) return '';
  return (LIVELLI.find((f) => n <= f.max) || LIVELLI[LIVELLI.length - 1]).definizione;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// ── LA REGOLA, ed è scritta in JavaScript nudo di proposito ───────────────────
// Da qui in giù la regola è JavaScript, e i parametri sono annotati SOLO con `: any`:
// così `test/assessment-apply-level.test.mjs` può ESTRARRE queste funzioni dal sorgente
// vero, spogliarle di quelle sei parole e provarle una per una. Una copia riscritta nel
// banco misurerebbe il banco, non questa funzione.
// ⚠️ Chi aggiunge qui un tipo diverso da `any` non rompe niente in silenzio: il banco non
// riesce più a valutare la funzione e diventa rosso subito.
function clean(value: any) {
  return typeof value === 'string' ? value.trim() : (value === null || value === undefined ? '' : String(value));
}

function numero(value: any) {
  const raw = clean(value).replace(',', '.');
  if (!raw) return NaN;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

function quando(value: any) {
  const raw = clean(value);
  if (!raw) return 0;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? 0 : t;
}

// Il livello che la scheda propone: il calcolato se c'è, altrimenti il dichiarato.
function livelloDellaScheda(scheda: any) {
  const calcolato = numero(scheda?.calculated_level);
  return Number.isNaN(calcolato) ? numero(scheda?.declared_level) : calcolato;
}

// ── QUANTE PROVE DI FILA DICONO MENO ─────────────────────────────────────────
// Si scorre la storia del socio dalla PIÙ RECENTE all'indietro e ci si ferma alla
// prima che non dice meno del livello di oggi: quello è l'inizio della discesa.
// ⭐ È la stessa forma del conto dei tentativi nel ponte, e per la stessa ragione:
// un conto TENUTO va azzerato, sincronizzato e prima o poi diverge dai fatti; un
// conto CALCOLATO non può divergere da ciò da cui è calcolato.
// ⚖️ Due tagli dichiarati, perché sono scelte e non dettagli:
//   · una prova più VECCHIA dell'ultimo livello scritto non conta — appartiene a
//     un'altra epoca, e il giro comincia dopo l'ultimo aggiornamento;
//   · una scheda SENZA livello valido non è né più né meno: si salta, e non
//     interrompe la serie (interromperla regalerebbe una discesa in meno o in più
//     a seconda di un dato mancante, che è il peggior modo di decidere).
function proveConsecutiveAlRibasso(storia: any, attuale: any, ultimoAggiornamento: any) {
  if (!Array.isArray(storia) || !storia.length) return 0;
  if (!Number.isFinite(attuale)) return 0;
  const elenco = storia.slice().sort((a: any, b: any) => quando(b?.submitted_at) - quando(a?.submitted_at));
  let quante = 0;
  for (const s of elenco) {
    if (ultimoAggiornamento && !(quando(s?.submitted_at) > ultimoAggiornamento)) break;
    const l = livelloDellaScheda(s);
    if (Number.isNaN(l)) continue;
    if (l < attuale) quante++;
    else break;
  }
  return quante;
}

// Torna { applica, motivo, livello }. `motivo` è sempre valorizzato — anche quando
// si applica — perché il riepilogo del giro dev'essere leggibile senza il codice
// accanto: è quello che finisce nella risposta e nei log.
// ⭐ `storia` sono le schede di QUEL socio (la corrente compresa): serve al ribasso
// e al giro, e chi non la passa ottiene «non si scende» e «non si applica ancora»,
// che sono i versi sicuri. `adessoMs` è l'orologio del giro, passato da fuori:
// serve alla regola del silenzio, e un orologio letto qui dentro renderebbe la
// funzione improvabile a tavolino.
function decidi(scheda: any, socio: any, storia: any, adessoMs: any) {
  // ⚠️ `let` e non `const`: il tetto qui sotto lo taglia. Il valore DIMOSTRATO resta in
  // `dimostrato`, e le due cose da lì in poi sono separate per sempre.
  let livello = livelloDellaScheda(scheda);
  if (Number.isNaN(livello)) return { applica: false, motivo: 'la scheda non ha un livello valido', livello: null };

  // Quello che la segreteria ha già in mano non si tocca: `review`, `pending`,
  // `pending_attention` sono decisioni di una persona, e questa è una macchina.
  if (clean(scheda?.staff_status) !== '') return { applica: false, motivo: `in mano alla segreteria (${clean(scheda.staff_status)})`, livello };
  if (clean(scheda?.applied_at) !== '') return { applica: false, motivo: 'già applicata', livello };

  const raw = (scheda?.raw_response || {});
  if (clean(raw.source) === 'link-esterno') return { applica: false, motivo: 'arriva dal link generico: non è ancora un socio', livello };
  if (raw.experience_flag) return { applica: false, motivo: 'dichiara un livello medio-alto ma gioca da poco', livello };

  // Il test di conoscenza vale solo dove c'è: le schede vecchie non ce l'hanno e
  // restano applicabili come sempre — è la stessa tolleranza del gestionale.
  const knowledge = raw.knowledge || null;
  if (knowledge && clean(knowledge.status) !== 'pass') {
    return { applica: false, motivo: `test di conoscenza non superato (${clean(knowledge.correct)}/${clean(knowledge.total)})`, livello };
  }

  // 🚨🚨 LA SCELTA DEL SOCIO (voce 61 § A ④, 19/08/2026): su una prova col cancello
  // la macchina non decide più da sola. Vedi l'intestazione del file per la regola
  // intera; l'ordine dei controlli qui è il suo significato —
  //   «riprovo» è un NO detto chiaro e vale per sempre;
  //   «mi fermo» è il SÌ e si applica subito;
  //   senza risposta: la terza prova non aspetta nessuno (non c'è una domanda),
  //   le altre aspettano il socio fino a `ORE_SILENZIO_ASSENSO`, poi il silenzio
  //   è assenso.
  if (knowledge) {
    const scelta = clean(scheda?.member_decision);
    if (scelta === SCELTA_RIPROVO) {
      return { applica: false, motivo: 'il socio ha scelto di riprovare: questa prova non si applica', livello };
    }
    if (scelta !== SCELTA_MI_FERMO && !laProvaEsaurisceIlGiro(storia, scheda, TENTATIVI_PER_GIRO)) {
      const eta = adessoMs - quando(scheda?.submitted_at);
      if (!(eta >= ORE_SILENZIO_ASSENSO * 60 * 60 * 1000)) {
        return { applica: false, motivo: `aspetta la scelta del socio (silenzio-assenso a ${ORE_SILENZIO_ASSENSO} ore dalla prova)`, livello };
      }
    }
  }

  if (clean(scheda?.consistency_status) === 'low') return { applica: false, motivo: 'le risposte non tornano con il livello dichiarato', livello };

  const dichiarato = numero(scheda?.declared_level);
  if (!Number.isNaN(dichiarato) && Math.abs(livello - dichiarato) > 0.5) {
    return { applica: false, motivo: `dichiarato e calcolato distano ${Math.abs(livello - dichiarato)}`, livello };
  }

  // ── 🆕 IL TETTO, e sta QUI e non prima per una ragione precisa ────────────────
  // 🚨 I due controlli di coerenza appena sopra confrontano il calcolato col DICHIARATO:
  // tagliando prima, un socio che dichiara 5 e risponde da 5 si vedrebbe confrontare 3.5
  // con 5, cioè verrebbe bocciato per incoerenza proprio perché è stato coerente.
  // ⇒ Si controlla sul dimostrato, si taglia dopo. Da qui in giù `livello` è ciò che si
  // scrive e `dimostrato` è ciò che si è misurato.
  const dimostrato = livello;
  let segnala = '';
  if (dimostrato > TETTO_AUTOMATICO) {
    segnala = `ha risposto da ${definizioneLivello(dimostrato)} (${dimostrato}): sopra ${definizioneLivello(TETTO_AUTOMATICO)} certifica il maestro, guardandolo giocare`;
    livello = TETTO_AUTOMATICO;
  }

  if (!socio) return { applica: false, motivo: 'il socio non esiste più in anagrafica', livello, segnala };

  // 🚨🚨 IL CONTROLLO CHE IMPEDISCE IL DANNO: una scheda vecchia non deve mai
  // scavalcare un livello aggiornato dopo. Senza questa riga, una scheda di
  // aprile riporterebbe a 2,5 chi oggi ha 4 — e col muro acceso lo bloccherebbe.
  const scritta = quando(scheda?.submitted_at);
  const ultimo = Math.max(quando(socio.lastLevelUpdateAt), quando(socio.selfAssessmentDate));
  if (ultimo && !(scritta > ultimo)) {
    return { applica: false, motivo: 'il livello del socio è stato aggiornato dopo questa scheda', livello, segnala };
  }

  // Niente scritture a vuoto: se il livello è già quello, la riga non si tocca.
  const attuale = numero(socio.level);
  if (attuale === livello) return { applica: false, motivo: 'il socio ha già questo livello', livello, segnala };

  // 🚨🚨 IL RIBASSO, ed è la regola che protegge il socio dal proprio test.
  // Al rialzo non cambia niente: si passa oltre e si applica come sempre.
  if (!Number.isNaN(attuale) && livello < attuale) {
    const quante = proveConsecutiveAlRibasso(storia, attuale, ultimo);
    if (quante < PROVE_PER_SCENDERE) {
      return {
        applica: false,
        motivo: `il test dice più basso (${livello} contro ${attuale}): non si scende — prova ${quante} di ${PROVE_PER_SCENDERE}`,
        livello,
      segnala,
      };
    }
    const sceso = Math.max(LIVELLO_MINIMO_SCESO, attuale - PASSO_DISCESA);
    // Chi è già al pavimento non scende più: la regola non ha altro da togliere,
    // e una scrittura che non cambia niente sarebbe solo una data mossa.
    if (sceso === attuale) {
      return { applica: false, motivo: `${quante} prove di fila più basse, ma ${attuale} è il minimo: non si scende oltre`, livello, segnala };
    }
    return {
      applica: true,
      motivo: `${quante} prove di fila più basse: da ${attuale} a ${sceso} (mezzo passo, non a ${livello})`,
      livello: sceso,
      segnala,
    };
  }

  return { applica: true, motivo: `da ${clean(socio.level) || 'senza livello'} a ${livello}`, livello, segnala };
}

// ── UNA SOLA SCHEDA PER SOCIO, LA PIÙ RECENTE ────────────────────────────────
// 🚨🚨 TROVATO DAL GIRO A VUOTO, non dal banco. La prima versione elaborava le schede una
// per una, e su TEST il primo giro simulato diceva questo:
//     «da 4 a 1» · «da 4 a 4.5» · «da 4 a 1.5» — tre volte la STESSA persona.
// Cioè: chi ha compilato più schede se le vedeva applicare tutte in fila, e il livello
// restava quello dell'ultima ESAMINATA, non della più recente. Il controllo sulle date non
// poteva accorgersene: guarda il socio com'era all'inizio del giro, e dentro lo stesso giro
// quel socio non era ancora cambiato.
// ⇒ Si tiene una scheda sola per socio — la più recente — e le altre restano lì: al giro
// dopo il socio ha una data più fresca e le salta da sé.
// ⭐ Il banco provava `decidi` su UNA scheda per volta, quindi era cieco per costruzione: un
// difetto che vive nel GIRO non lo vede un caso che prova la regola.
function soloLaPiuRecentePerSocio(schede: any, socioPerToken: any) {
  const migliore = new Map();
  const senzaSocio = [];
  for (const scheda of schede) {
    const socioId = socioPerToken.get(clean(scheda.token)) || '';
    if (!socioId) { senzaSocio.push(scheda); continue; }   // senza socio la regola dirà da sé perché
    const prima = migliore.get(socioId);
    if (!prima || quando(scheda.submitted_at) > quando(prima.submitted_at)) migliore.set(socioId, scheda);
  }
  return [...senzaSocio, ...migliore.values()];
}

/**
 * 🆕🔗⭐⭐ VOCE 85 (24/08/2026) — IL LIVELLO APPLICATO ARRIVA ANCHE SU MATCHPOINT.
 *
 * 🗣️ Nato da una sua attesa che non sarebbe mai finita, la sera del collaudo di Marco Aprea:
 * *«adesso aspetto che il gestionale sincronizzi il livello su matchpoint»*.
 *
 * 📏 MISURATO PRIMA DI SCRIVERE, e la misura era netta: questo file aveva ZERO riferimenti a
 * Matchpoint, e gli unici a chiamare `matchpoint-clients-update` erano quattro punti di
 * `index.html`. ⇒ Il livello scritto dal test si fermava in `pmo_cloud_records`: non tardava,
 * NON PARTIVA. Aspettare non lo avrebbe portato da nessuna parte, mai.
 * 📌 *Una funzione che sta nell'interfaccia esiste solo per chi passa dall'interfaccia.* Il
 * test di livello, per disegno, non ci passa — parla direttamente col gestionale.
 *
 * ⭐ SI CHIEDE ALL'EDGE, non al worker, ed è la stessa scelta della cura ④: la strada verso il
 * circolo è una sola e ha dentro il recinto di TEST, il contratto col worker e il ripiego per
 * ritrovare la scheda. Una seconda copia di quella regola divergerebbe al primo ripensamento.
 *
 * 🚨 NON PUÒ FAR FALLIRE NIENTE, e l'ordine è deliberato: si spinge DOPO che il livello è
 * scritto e la scheda marcata. Se la spinta non riesce, il livello resta applicato e il socio
 * ha già avuto il suo messaggio — si perde la SPINTA, non il FATTO. L'esito finisce negli
 * avvisi del giro, dove lo si vede, invece che in un silenzio.
 *
 * 🧊 IN SIMULAZIONE NON PARTE: `simula` esiste per guardare cosa succederebbe, e una scrittura
 * sul Matchpoint del circolo non è una cosa che si guarda.
 */
async function spingiIlLivelloAlCircolo(opts: {
  supabaseUrl: string;
  segreto: string;
  payload: any;
}): Promise<{ esito: string; motivo: string }> {
  const codice = clean(opts.payload?.memberId ?? '');
  // Stessa regola dell'app: senza un codice del circolo non c'è nessuna scheda da aggiornare.
  // Non è un guasto ed è frequente (ospiti, soci mai importati): si dice e si va avanti.
  if (!/^\d{4,6}$/.test(codice)) return { esito: 'senza_codice', motivo: 'socio senza codice Matchpoint' };

  const genere = clean(opts.payload?.gender ?? '');
  const client = {
    codice,
    firstName: clean(opts.payload?.firstName ?? ''),
    surname: clean(opts.payload?.surname ?? ''),
    phone: clean(opts.payload?.phone ?? ''),
    email: clean(opts.payload?.email ?? ''),
    gender: genere === 'F' ? 'F' : (genere === 'M' ? 'M' : ''),
    level: opts.payload?.level,
  };

  try {
    const risposta = await fetch(`${opts.supabaseUrl}/functions/v1/matchpoint-clients-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-pmo-routine-secret': opts.segreto },
      body: JSON.stringify({ client }),
    });
    const testo = await risposta.text();
    let dati: any = null;
    try { dati = testo ? JSON.parse(testo) : null; } catch { dati = null; }
    if (risposta.ok && !(dati && dati.ok === false)) return { esito: 'ok', motivo: '' };
    const motivo = clean(dati?.message ?? dati?.error ?? `HTTP ${risposta.status}`);
    // 🧪 Su TEST il recinto risponde così, ed è il comportamento GIUSTO: non è un guasto da
    // segnalare come tale, o il giro di TEST urlerebbe a ogni livello applicato.
    if (clean(dati?.error) === 'AMBIENTE_DI_PROVA' || risposta.status === 503) {
      return { esito: 'ambiente_di_prova', motivo };
    }
    return { esito: 'non_riuscita', motivo };
  } catch (e) {
    return { esito: 'non_riuscita', motivo: clean((e as Error)?.message ?? String(e)) };
  }
}

// Il payload nuovo del socio: si parte da quello che c'è e si toccano SOLO il
// livello e i suoi satelliti. ⚠️ `updatedAt` in ISO con la Z: il gestionale
// confronta quel campo come stringa, e un altro formato lo lascerebbe indietro
// per sempre.
function payloadAggiornato(payload: any, scheda: any, livello: any, adesso: any) {
  return {
    ...payload,
    level: livello,
    levelSource: FONTE,
    selfAssessmentDate: clean(scheda?.submitted_at) || adesso,
    selfAssessmentStaffStatus: 'applied',
    selfAssessmentToken: clean(scheda?.token),
    lastLevelUpdateAt: adesso,
    updatedAt: adesso,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);

  const supabaseUrl = clean(Deno.env.get('SUPABASE_URL'));
  const serviceKey = clean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  if (!supabaseUrl || !serviceKey) return json({ ok: false, error: 'SUPABASE_SECRETS_MISSING' }, 500);
  const admin = createClient(supabaseUrl, serviceKey);

  const secret = clean(req.headers.get('x-pmo-routine-secret'));
  if (!secret) return json({ ok: false, error: 'ROUTINE_SECRET_REQUIRED' }, 401);
  const { data: secretOk, error: secretErr } = await admin.rpc('pmo_verify_data_routine_secret', { p_secret: secret });
  if (secretErr || secretOk !== true) return json({ ok: false, error: 'ROUTINE_SECRET_INVALID' }, 401);

  const body: JsonMap = await req.json().catch(() => ({}));
  const simula = body?.simula === true;
  const ambiente = supabaseUrl.includes(PROD_PROJECT_REF) ? 'PROD' : 'TEST';
  const adesso = new Date().toISOString();

  // ① Le schede candidate: quelle che nessuno ha ancora preso in mano.
  const { data: schedeRaw, error: erroreSchede } = await admin
    .from('self_assessments')
    .select('id, token, submitted_at, first_name, last_name, declared_level, calculated_level, consistency_status, staff_status, applied_at, raw_response, member_decision, member_decision_at')
    .is('applied_at', null)
    .order('submitted_at', { ascending: true })
    .limit(MASSIMO_PER_GIRO * 4);
  if (erroreSchede) return json({ ok: false, error: 'SCHEDE_READ_FAILED', dettaglio: clean(erroreSchede.message) }, 500);

  const schede = (schedeRaw || []) as JsonMap[];
  if (!schede.length) return json({ ok: true, ambiente, simula, esaminate: 0, applicate: 0, saltate: [], dettaglio: [], avvisi: [] });

  // ② A chi appartengono: il collegamento scheda→socio passa dal token.
  const tokens = schede.map((s) => clean(s.token)).filter(Boolean);
  const { data: tokenRaw, error: erroreToken } = await admin
    .from('assessment_tokens')
    .select('token, member_local_id, member_name')
    .in('token', tokens);
  if (erroreToken) return json({ ok: false, error: 'TOKEN_READ_FAILED', dettaglio: clean(erroreToken.message) }, 500);
  const socioPerToken = new Map<string, string>();
  ((tokenRaw || []) as JsonMap[]).forEach((t) => {
    const tok = clean(t.token);
    const id = clean(t.member_local_id);
    if (tok && id) socioPerToken.set(tok, id);
  });

  // ③ Le righe vive dell'anagrafica, una lettura sola per tutti gli id.
  const idSoci = [...new Set([...socioPerToken.values()])];
  const righePerId = new Map<string, JsonMap>();
  if (idSoci.length) {
    const { data: righeRaw, error: erroreRighe } = await admin
      .from('pmo_cloud_records')
      .select('id, local_key, payload, updated_at')
      .eq('record_type', 'member')
      .eq('deleted', false)
      .in('payload->>id', idSoci);
    if (erroreRighe) return json({ ok: false, error: 'ANAGRAFICA_READ_FAILED', dettaglio: clean(erroreRighe.message) }, 500);
    ((righeRaw || []) as JsonMap[]).forEach((r) => {
      const p = (r.payload || {}) as JsonMap;
      const id = clean(p.id);
      if (!id) return;
      // ⚠️ Un id può avere più righe vive (i doppioni sono un problema noto qui):
      // si tiene la più recente, che è quella che il bot e il gestionale leggono.
      const prima = righePerId.get(id);
      if (!prima || clean(r.updated_at) > clean(prima.updated_at)) righePerId.set(id, r);
    });
  }

  // ③bis LA STORIA DI CIASCUNO, e serve a due cose: al RIBASSO e al GIRO (la terza
  // prova si applica da sola, e per riconoscerla va ricostruito il giro — vedi
  // `laProvaEsaurisceIlGiro` in `giro-del-test.ts`).
  // Si passa per i gettoni, che sono il filo fra la persona e la scheda — la stessa
  // strada del ponte (`consumer-assessment-link`), perché il conto delle prove è lo
  // stesso fatto guardato da due parti, e due strade diverse prima o poi divergono.
  // 🔒 Se una di queste due letture non riesce NON si ferma il giro: la storia resta
  // vuota, il conto viene 0 e nessuno scende. Si perde una discesa legittima, non si
  // regala una discesa sbagliata — ed è dichiarato nella risposta, non taciuto.
  // ⚠️ E sul lato della SCELTA il verso sicuro è l'attesa: senza storia la terza
  // prova non si riconosce, quindi non si applica subito — la ripesca il silenzio
  // delle 24 ore, o il giro dopo del cron quando la lettura torna a riuscire.
  const storiaPerSocio = new Map<string, JsonMap[]>();
  const avvisi: string[] = [];
  if (idSoci.length) {
    const { data: gettoniRaw, error: erroreGettoni } = await admin
      .from('assessment_tokens')
      .select('token, member_local_id')
      .in('member_local_id', idSoci);
    if (erroreGettoni) {
      avvisi.push(`storia non letta (gettoni): ${clean(erroreGettoni.message)} — al ribasso nessuno scende`);
    } else {
      const socioPerGettone = new Map<string, string>();
      ((gettoniRaw || []) as JsonMap[]).forEach((t) => {
        const tok = clean(t.token);
        const id = clean(t.member_local_id);
        if (tok && id) socioPerGettone.set(tok, id);
      });
      const tuttiIGettoni = [...socioPerGettone.keys()];
      if (tuttiIGettoni.length) {
        const { data: storicoRaw, error: erroreStorico } = await admin
          .from('self_assessments')
          .select('token, submitted_at, declared_level, calculated_level, raw_response, member_decision, member_decision_at')
          .in('token', tuttiIGettoni)
          .order('submitted_at', { ascending: false })
          .limit(idSoci.length * STORICO_PER_SOCIO);
        if (erroreStorico) {
          avvisi.push(`storia non letta (schede): ${clean(erroreStorico.message)} — al ribasso nessuno scende`);
        } else {
          ((storicoRaw || []) as JsonMap[]).forEach((riga) => {
            const id = socioPerGettone.get(clean(riga.token)) || '';
            if (!id) return;
            const finora = storiaPerSocio.get(id) || [];
            finora.push(riga);
            storiaPerSocio.set(id, finora);
          });
        }
      }
    }
  }

  const dettaglio: JsonMap[] = [];
  const saltate: JsonMap[] = [];
  let applicate = 0;

  // ⭐ Una scheda sola per socio, la più recente: vedi soloLaPiuRecentePerSocio.
  const daEsaminare = soloLaPiuRecentePerSocio(schede, socioPerToken);

  for (const scheda of daEsaminare) {
    if (applicate >= MASSIMO_PER_GIRO) break;
    const nome = `${clean(scheda.first_name)} ${clean(scheda.last_name)}`.trim() || 'senza nome';
    const socioId = socioPerToken.get(clean(scheda.token)) || '';
    const riga = socioId ? righePerId.get(socioId) : null;
    const payload = (riga?.payload || null) as JsonMap | null;

    const esito = decidi(scheda, payload, socioId ? (storiaPerSocio.get(socioId) || []) : [], Date.parse(adesso));
    if (!esito.applica) {
      saltate.push({ persona: nome, motivo: esito.motivo, scheda: clean(scheda.submitted_at).slice(0, 10) });
      // 🚨 UNA SEGNALAZIONE NON SI PERDE PERCHÉ IL LIVELLO NON SI SCRIVE, e il caso non è
      // teorico: chi è già a 3.5 e risponde da Agonista viene fermato da «ha già questo
      // livello» — il livello è giusto, ma il fatto che il maestro deve guardarlo è vero
      // lo stesso. Tacere lì vorrebbe dire che proprio gli Intermedi che meritano di salire
      // sono gli unici di cui nessuno viene informato.
      if (clean(esito.segnala)) avvisi.push(`${nome}: ${esito.segnala} — livello non riscritto (${esito.motivo})`);
      continue;
    }

    if (simula) {
      applicate++;
      dettaglio.push({ persona: nome, cambio: esito.motivo, scheda: clean(scheda.submitted_at).slice(0, 10), simulato: true, segnala: clean(esito.segnala) || undefined });
      continue;
    }

    // ④ La scrittura, mirata: si tocca QUELLA riga, non si ripubblica l'anagrafica.
    const nuovo = payloadAggiornato(payload as JsonMap, scheda, esito.livello, adesso);
    const { error: erroreScrittura } = await admin
      .from('pmo_cloud_records')
      .update({ payload: nuovo, updated_at: adesso })
      .eq('id', riga!.id);
    if (erroreScrittura) {
      saltate.push({ persona: nome, motivo: `scrittura anagrafica fallita: ${clean(erroreScrittura.message)}`, scheda: clean(scheda.submitted_at).slice(0, 10) });
      continue;
    }

    // ⑤ E solo DOPO si marca la scheda: se il passo ④ fallisce, al giro dopo si
    // riprova. Marcandola prima, un livello mai scritto risulterebbe applicato.
    const { error: erroreScheda } = await admin
      .from('self_assessments')
      .update({
        // 🆕 IL TERZO ESITO: `applied` quando non c'è niente da guardare, `applied_review`
        // quando il livello è scritto MA una persona deve dare un'occhiata. Le due non sono
        // «applicata» e «ferma»: sono tutte e due APPLICATE — `applied_at` e
        // `applied_member_id` qui sotto si scrivono in tutti e due i casi, ed è da quelli che
        // l'app capisce che il livello c'è.
        staff_status: clean(esito.segnala) ? STAFF_DA_CERTIFICARE : 'applied',
        applied_level: esito.livello,
        applied_at: adesso,
        applied_member_id: socioId,
      })
      .eq('id', scheda.id);
    if (erroreScheda) {
      saltate.push({ persona: nome, motivo: `livello scritto ma scheda non marcata: ${clean(erroreScheda.message)}`, scheda: clean(scheda.submitted_at).slice(0, 10) });
      continue;
    }

    // ⚠️ La copia in memoria si aggiorna col payload appena scritto: difesa in profondità
    // accanto a `soloLaPiuRecentePerSocio`. Senza, dentro lo stesso giro il socio resterebbe
    // «com'era all'inizio» per chiunque lo guardi dopo.
    righePerId.set(socioId, { ...(riga as JsonMap), payload: nuovo, updated_at: adesso });

    applicate++;

    // ⑥ 🆕 VOCE 85 — e ADESSO il livello va anche sul gestionale del circolo. Ultimo passo di
    // proposito: qui il fatto è già al sicuro (livello scritto, scheda marcata), quindi
    // qualunque cosa succeda di qui in poi non può togliere niente a nessuno.
    let spinta: { esito: string; motivo: string } = { esito: 'simulata', motivo: '' };
    if (!simula) {
      spinta = await spingiIlLivelloAlCircolo({ supabaseUrl, segreto: secret, payload: nuovo });
      if (spinta.esito === 'non_riuscita') {
        // 🚨 NON è un `continue`: il livello RESTA applicato. Va negli avvisi perché qualcuno
        // lo veda — un livello giusto da noi e vecchio sul Matchpoint del circolo è la voce 85
        // in persona, e il modo di accorgersene non deve essere un socio che se ne lamenta.
        avvisi.push(`livello applicato ma non spinto su Matchpoint per ${nome}: ${spinta.motivo}`);
      }
    }

    if (clean(esito.segnala)) avvisi.push(`${nome}: ${esito.segnala}`);

    dettaglio.push({
      persona: nome,
      cambio: esito.motivo,
      scheda: clean(scheda.submitted_at).slice(0, 10),
      matchpoint: spinta.esito,
      segnala: clean(esito.segnala) || undefined,
    });
  }

  console.log('PMO_ASSESSMENT_APPLY_LEVEL', JSON.stringify({ ambiente, simula, esaminate: schede.length, applicate, saltate: saltate.length, avvisi }));
  return json({ ok: true, ambiente, simula, esaminate: schede.length, applicate, dettaglio, saltate, avvisi });
});
