// ── BANCO: la lista del maestro si aggiorna da sé — voce 98, punto C ─────────────────
//
// Che cosa prova: `refreshAssessmentDataForMembersList`, estratta da `index.html`, e il suo
// CABLAGGIO — cioè i due punti da cui viene chiamata.
//
// 🚨⭐⭐ IL DIFETTO CHE QUESTO BANCO CHIUDE, misurato il 27/08/2026 contando i punti di
//    chiamata dentro `index.html`. Il passaggio di consegne del 26/08 diceva che il rinfresco
//    automatico delle risposte era «appeso a una sezione congelata». Le porte sono **tre**, ed
//    erano chiuse **tutte e tre**:
//      ① il bottone «🔄 Sincronizza risposte da Supabase» sta dentro `#assessment`, tab che
//         `PMO_ASSESSMENT_PARKED` nasconde a TUTTI, owner compreso;
//      ② `refreshAssessmentSectionDataOnEnter` parte solo da `switchTab('assessment')`;
//      ③ `assistantSyncResponses` è viva e il suo bottone esiste nel codice, ma viene scritto
//         dentro `#assistantPlan` — **elemento che nel DOM non c'è**: `id="assistantPlan"`
//         compare 0 volte in `index.html`. Un bottone che nessuno disegna.
//    ⇒ Nell'app viva `assessmentResponses` lo riempiva **solo una console a mano**, mentre la
//    lista «Da certificare dal maestro» sta in Anagrafica soci, che è aperta. Leggeva un
//    archivio che nessuno aggiornava: una lista vuota indistinguibile da «non aspetta nessuno»,
//    che è il modo di sbagliare per cui la voce 98 esiste.
//
// ⭐ IL CASO CHE CONTA È IL 4: protegge una DECISIONE DI ORDINE, non un calcolo. I gettoni vanno
//    letti PRIMA delle risposte, perché le risposte si cercano **per gettone**. Il caso gira
//    tutte e due le strade e mostra cosa si perde in quella sbagliata — la strada parallela è
//    verde su ogni prova dei due pezzi presi da soli.
//
// ⛔ Quello che NON prova: che le due RPC rispondano (sono mockate), e che la riga del maestro
//    si VEDA nel gestionale. Quella è una prova fisica e si fa aprendo Anagrafica soci.
//
// Uso:  node test/la-lista-del-maestro-si-aggiorna-da-se.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(QUI, '..', 'index.html'), 'utf8');

function estrai(nome) {
  const inizio = html.indexOf(`function ${nome}(`);
  if (inizio < 0) throw new Error(`funzione «${nome}» non trovata in index.html`);
  let t = html.indexOf('(', inizio), tonde = 0;
  for (; t < html.length; t++) {
    if (html[t] === '(') tonde++;
    else if (html[t] === ')') { tonde--; if (tonde === 0) { t++; break; } }
  }
  let i = html.indexOf('{', t), livello = 0, stringa = null, prec = '';
  for (; i < html.length; i++) {
    const c = html[i], succ = html[i + 1];
    if (stringa) { if (c === stringa && prec !== '\\') stringa = null; }
    else if (c === '/' && succ === '/') { const fine = html.indexOf('\n', i); i = fine < 0 ? html.length : fine; prec = '\n'; continue; }
    else if (c === '/' && succ === '*') { const fine = html.indexOf('*/', i + 2); i = fine < 0 ? html.length : fine + 1; prec = '/'; continue; }
    else if (c === '"' || c === "'" || c === '`') stringa = c;
    else if (c === '{') livello++;
    else if (c === '}') { livello--; if (livello === 0) { i++; break; } }
    prec = c;
  }
  const asincrona = html.slice(Math.max(0, inizio - 6), inizio) === 'async ';
  return (asincrona ? 'async ' : '') + html.slice(inizio, i);
}

// 🚨 `var` e non `let`: dentro `vm` una `let` non diventa proprietà del contesto, e assegnare
//    ctx.assessmentResponses creerebbe un'ALTRA variabile — un banco verde che non prova niente.
const base = `
  var assessmentResponses = [];
  var GETTONI = [];              // l'archivio che il sync dei gettoni ha portato giù
  var SCHEDE_PER_GETTONE = {};   // il cloud: gettone → riga scheda
  var SESSIONE = { user: 'staff' };
  var PUBBLICO = false;
  var ORDINE = [];
  var RIDISEGNI = 0;
  var OPZIONI_RISPOSTE = null;
  var ERRORE_GETTONI = null;
  var _pmoMaestroRefreshInFlight = false;
  var _pmoMaestroRefreshLastAt = 0;
  function pmoIsPublicAccessMode() { return PUBBLICO; }
  function pmoReadSupabaseStaffSession() { return SESSIONE; }
  function displayMembers() { RIDISEGNI++; }
  async function syncAssessmentTokensFromSupabase() {
    ORDINE.push('gettoni');
    // 🚨 L'attesa è la parte che conta: il sync vero aspetta una RPC, e senza attesa qui la
    //    strada parallela finirebbe per caso nell'ordine giusto — un banco verde su tutt'e due
    //    le strade, cioè una prova che non protegge nessuna decisione.
    await new Promise(r => setTimeout(r, 0));
    if (ERRORE_GETTONI) throw new Error(ERRORE_GETTONI);
    GETTONI = GETTONI_DAL_CLOUD.slice();
  }
  async function syncAssessmentResponsesFromSupabase(opzioni) {
    ORDINE.push('risposte');
    OPZIONI_RISPOSTE = opzioni;
    // 🚨 Il punto della prova: le schede si cercano PER GETTONE, e i gettoni sono quelli
    //    che il giro precedente ha messo in GETTONI. Se nessuno li ha ancora portati giù,
    //    questa lettura non trova la scheda nuova.
    GETTONI.forEach(g => {
      const riga = SCHEDE_PER_GETTONE[g];
      if (!riga) return;
      const i = assessmentResponses.findIndex(r => r.token === riga.token);
      if (i >= 0) assessmentResponses[i] = { ...assessmentResponses[i], ...riga };
      else assessmentResponses.push({ ...riga });
    });
  }
  var GETTONI_DAL_CLOUD = [];
`;

const ctx = { console: { info() {}, warn() {}, log() {}, error() {} }, Date, setTimeout, Promise };
vm.createContext(ctx);
vm.runInContext([base, estrai('pmoFirmaRisposteAutovalutazione'), estrai('refreshAssessmentDataForMembersList')].join('\n'), ctx);

let passati = 0, falliti = 0;
async function caso(titolo, fn) {
  try { await fn(); console.log('✅ ' + titolo); passati++; }
  catch (err) { console.log('❌ ' + titolo + '\n   → ' + (err && err.message || err)); falliti++; }
}
function esigi(condizione, messaggio) { if (!condizione) throw new Error(messaggio); }

// La scheda del 26/08 delle 08:27: appesa a un gettone che l'app ancora non ha.
const SCHEDA_NUOVA = { token: 'tok-aprile', calculated_level: 5, submitted_at: '2026-08-26T08:27:00Z' };

function apparecchia() {
  ctx.assessmentResponses = [];
  ctx.GETTONI = [];
  ctx.GETTONI_DAL_CLOUD = ['tok-aprile'];
  ctx.SCHEDE_PER_GETTONE = { 'tok-aprile': SCHEDA_NUOVA };
  ctx.SESSIONE = { user: 'staff' };
  ctx.PUBBLICO = false;
  ctx.ORDINE = [];
  ctx.RIDISEGNI = 0;
  ctx.OPZIONI_RISPOSTE = null;
  ctx.ERRORE_GETTONI = null;
  ctx._pmoMaestroRefreshInFlight = false;
  ctx._pmoMaestroRefreshLastAt = 0;
}

await caso('1. il giro normale porta giù la scheda che mancava', async () => {
  apparecchia();
  await ctx.refreshAssessmentDataForMembersList();
  esigi(ctx.assessmentResponses.length === 1, 'la scheda non è arrivata: ' + JSON.stringify(ctx.assessmentResponses));
  esigi(ctx.RIDISEGNI === 1, `ridisegni attesi 1, visti ${ctx.RIDISEGNI}`);
});

await caso('2. senza sessione staff non parte NIENTE (le RPC risponderebbero 401)', async () => {
  apparecchia();
  ctx.SESSIONE = null;
  await ctx.refreshAssessmentDataForMembersList();
  esigi(ctx.ORDINE.length === 0, 'ha chiamato lo stesso: ' + ctx.ORDINE.join(' → '));
});

await caso('3. in modalità pubblica non parte NIENTE', async () => {
  apparecchia();
  ctx.PUBBLICO = true;
  await ctx.refreshAssessmentDataForMembersList();
  esigi(ctx.ORDINE.length === 0, 'ha chiamato lo stesso: ' + ctx.ORDINE.join(' → '));
});

await caso('4. ⭐ I GETTONI PRIMA DELLE RISPOSTE — e la strada sbagliata mostra cosa si perde', async () => {
  apparecchia();
  await ctx.refreshAssessmentDataForMembersList();
  esigi(ctx.ORDINE.join(' → ') === 'gettoni → risposte',
    `ordine sbagliato: ${ctx.ORDINE.join(' → ')} — le risposte si cercano PER GETTONE`);
  const conLaStradaGiusta = ctx.assessmentResponses.length;

  // La strada sbagliata: le due in parallelo, come fa il rinfresco della sezione congelata.
  // Verde su ogni prova dei due pezzi presi da soli, e perde la scheda nuova.
  apparecchia();
  await Promise.all([
    ctx.syncAssessmentTokensFromSupabase(),
    ctx.syncAssessmentResponsesFromSupabase({ silent: true })
  ]);
  const conLaStradaSbagliata = ctx.assessmentResponses.length;
  esigi(conLaStradaGiusta === 1 && conLaStradaSbagliata === 0,
    `la strada sbagliata non perde niente (giusta ${conLaStradaGiusta}, sbagliata ${conLaStradaSbagliata}): la prova non protegge più la decisione`);
});

await caso('5. NIENTE auto-applicazione dei livelli: è una lista che si guarda', async () => {
  apparecchia();
  await ctx.refreshAssessmentDataForMembersList();
  esigi(ctx.OPZIONI_RISPOSTE && ctx.OPZIONI_RISPOSTE.autoPostProcess === false,
    'autoPostProcess non è false: la sezione congelata rientrerebbe dalla finestra');
  esigi(ctx.OPZIONI_RISPOSTE.silent === true, 'il giro non è silenzioso: sputerebbe avvisi entrando in Anagrafica');
});

await caso('6. se non è cambiato niente NON si ridisegna l\'elenco', async () => {
  apparecchia();
  await ctx.refreshAssessmentDataForMembersList();
  const dopoIlPrimo = ctx.RIDISEGNI;
  ctx._pmoMaestroRefreshLastAt = 0;   // scavalca il freno, non la firma
  await ctx.refreshAssessmentDataForMembersList();
  esigi(ctx.RIDISEGNI === dopoIlPrimo,
    'ha ridisegnato senza novità: l\'elenco si rifà sotto le mani di chi ci sta lavorando');
});

await caso('7. 🚨 si ridisegna anche quando cambia SOLO il livello dimostrato (stessa lunghezza)', async () => {
  apparecchia();
  await ctx.refreshAssessmentDataForMembersList();
  const dopoIlPrimo = ctx.RIDISEGNI;
  // Il socio rifà il test: `importAssessmentResponses` AGGIORNA in posto, il conteggio non si muove.
  ctx.SCHEDE_PER_GETTONE = { 'tok-aprile': { ...SCHEDA_NUOVA, calculated_level: 6, submitted_at: '2026-08-27T09:00:00Z' } };
  ctx._pmoMaestroRefreshLastAt = 0;
  await ctx.refreshAssessmentDataForMembersList();
  esigi(ctx.assessmentResponses.length === 1, 'il caso non prova quel che dice: la lunghezza è cambiata');
  esigi(ctx.RIDISEGNI === dopoIlPrimo + 1,
    'una firma fatta sulla sola lunghezza: il livello nuovo non arriverebbe mai in lista');
});

await caso('8. il freno dei 60 secondi c\'è, e `force` lo scavalca', async () => {
  apparecchia();
  await ctx.refreshAssessmentDataForMembersList();
  const dopoIlPrimo = ctx.ORDINE.length;
  await ctx.refreshAssessmentDataForMembersList();
  esigi(ctx.ORDINE.length === dopoIlPrimo, 'il freno non tiene: due RPC a ogni ingresso nella scheda');
  await ctx.refreshAssessmentDataForMembersList({ force: true });
  esigi(ctx.ORDINE.length > dopoIlPrimo, 'force non scavalca il freno: la domanda esplicita resterebbe senza risposta fresca');
});

await caso('9. due ingressi ravvicinati non fanno due giri sovrapposti', async () => {
  apparecchia();
  await Promise.all([
    ctx.refreshAssessmentDataForMembersList({ force: true }),
    ctx.refreshAssessmentDataForMembersList({ force: true })
  ]);
  esigi(ctx.ORDINE.filter(x => x === 'gettoni').length === 1,
    'due giri insieme: ' + ctx.ORDINE.join(' → '));
});

await caso('10. un guasto del sync non rompe l\'ingresso in Anagrafica soci', async () => {
  apparecchia();
  ctx.ERRORE_GETTONI = 'rete giù';
  let esploso = false;
  try { await ctx.refreshAssessmentDataForMembersList(); } catch { esploso = true; }
  esigi(!esploso, 'l\'errore è uscito dalla funzione: entrare nella scheda soci fallirebbe');
});

// ── IL CABLAGGIO: si prova a parte, perché il pezzo giusto può esistere e non chiamarlo nessuno ──
const senzaCommenti = html
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map(r => r.replace(/(^|[^:'"`])\/\/.*$/, '$1')).join('\n');

await caso('11. 🚨 lo chiama l\'ingresso nella scheda Anagrafica soci', async () => {
  const riga = senzaCommenti.split('\n').find(r => /tabName === 'members'/.test(r) && /displayMembers\(\)/.test(r));
  esigi(riga, 'il ramo `members` di switchTab non si trova più');
  const blocco = senzaCommenti.slice(senzaCommenti.indexOf(riga), senzaCommenti.indexOf(riga) + 600);
  esigi(/refreshAssessmentDataForMembersList\(\)/.test(blocco.slice(0, blocco.indexOf("tabName === 'contact'") + 1 || 600)),
    'entrando in Anagrafica soci nessuno rinfresca le risposte: la lista del maestro resta ferma');
});

await caso('12. 🚨 scegliere il filtro «Da certificare dal maestro» forza il rinfresco', async () => {
  const inizio = senzaCommenti.indexOf('function pmoOnAttentionFilterChange');
  esigi(inizio > 0, 'pmoOnAttentionFilterChange non si trova più');
  const corpo = senzaCommenti.slice(inizio, senzaCommenti.indexOf('\n    }', inizio));
  esigi(/daCertificare/.test(corpo) && /refreshAssessmentDataForMembersList\(\s*\{\s*force\s*:\s*true\s*\}\s*\)/.test(corpo),
    'il filtro non forza niente: alla domanda esplicita si risponderebbe col dato del giro precedente');
});

await caso('13. il filtro «doppioni» NON trascina il rinfresco autovalutazione', async () => {
  const inizio = senzaCommenti.indexOf('function pmoOnAttentionFilterChange');
  const corpo = senzaCommenti.slice(inizio, senzaCommenti.indexOf('\n    }', inizio));
  const rigaRinfresco = corpo.split('\n').find(r => /refreshAssessmentDataForMembersList/.test(r));
  esigi(rigaRinfresco && /daCertificare/.test(rigaRinfresco),
    'il rinfresco parte anche su filtri che dell\'autovalutazione non chiedono niente');
});

console.log(`\n— ${passati} passati, ${falliti} falliti su ${passati + falliti} casi —`);
process.exit(falliti ? 1 : 0);
