// ── BANCO: «il livello si applica da solo, ma una scheda vecchia non scavalca mai» ─────
//
// Che cosa prova: la REGOLA dell'edge `assessment-apply-level` (voce `A4ter`), che decide
// quali autovalutazioni diventano il livello del socio senza che nessuno apra il gestionale.
//
// 🚨🚨 IL CASO 1 È QUELLO CHE ESISTE PER FERMARE LA VERSIONE OVVIA. «Applica tutte le
//    schede non ancora applicate» sembra la cosa giusta e sarebbe una rovina: su PROD c'è
//    una scheda di aprile che calcola 2,5 per una persona che oggi ha 4. Applicarla la
//    farebbe SCENDERE, e col muro del bot acceso la bloccherebbe — cioè lo stesso danno
//    della lapide, per un'altra strada. Chi toglie quel controllo deve vedere un rosso.
//
// ⭐ Le funzioni sono ESTRATTE dal sorgente vero dell'edge, non ricopiate qui: un banco che
//    prova una copia prova la copia. Per questo, in quel file, la regola è scritta in
//    JavaScript nudo — senza annotazioni di tipo — dentro un `.ts` che per il resto le usa.
//
// Uso:  node --test test/assessment-apply-level.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const CARTELLA = join(QUI, '..', 'supabase', 'functions', 'assessment-apply-level');
const SORGENTE = join(CARTELLA, 'index.ts');
const src = readFileSync(SORGENTE, 'utf8');
// 🆕 19/08/2026 (④): `decidi` non decide più da sola — chiede al GIRO se questa prova è
// l'ultima, e il giro vive nel modulo qui accanto (in tre copie identiche: il perché sta
// nella sua intestazione). Il banco estrae da tutti e due i file, o proverebbe metà regola.
const srcGiro = readFileSync(join(CARTELLA, 'giro-del-test.ts'), 'utf8');

// Stesso estrattore degli altri banchi: salta i commenti (in italiano sono pieni di
// apostrofi) e parte dopo la lista dei parametri.
function estrai(nome, testo = src) {
  const src = testo;
  const inizio = src.indexOf(`function ${nome}(`);
  if (inizio < 0) throw new Error(`funzione «${nome}» non trovata nel sorgente`);
  let t = src.indexOf('(', inizio), tonde = 0;
  for (; t < src.length; t++) {
    if (src[t] === '(') tonde++;
    else if (src[t] === ')') { tonde--; if (tonde === 0) { t++; break; } }
  }
  let i = src.indexOf('{', t), livello = 0, stringa = null, prec = '';
  for (; i < src.length; i++) {
    const c = src[i], succ = src[i + 1];
    if (stringa) { if (c === stringa && prec !== '\\') stringa = null; }
    else if (c === '/' && succ === '/') { const fine = src.indexOf('\n', i); i = fine < 0 ? src.length : fine; prec = '\n'; continue; }
    else if (c === '/' && succ === '*') { const fine = src.indexOf('*/', i + 2); i = fine < 0 ? src.length : fine + 1; prec = '/'; continue; }
    else if (c === '"' || c === "'" || c === '`') stringa = c;
    else if (c === '{') livello++;
    else if (c === '}') { livello--; if (livello === 0) { i++; break; } }
    prec = c;
  }
  return src.slice(inizio, i);
}

// ⚠️ L'unica annotazione di tipo ammessa nella regola è `: any` sui parametri, e serve al
// `deno check` della CI, che gira in modalità `strict`. Qui si toglie — è l'unica differenza
// fra il testo del sorgente e quello che si prova. Chi nell'edge usasse un tipo diverso non
// romperebbe niente in silenzio: questa `vm` non riuscirebbe più a valutare la funzione.
// ⚠️ Si tolgono le annotazioni `any` sui parametri E sulle variabili locali: il modulo del
// giro ne ha due (`const chiusi: any[]`, `let corrente: any[]`), ed è la stessa spoglia del
// banco del ponte. Chi usasse un tipo diverso non romperebbe niente in silenzio: questa
// `vm` non riuscirebbe più a valutare la funzione e il banco morirebbe rumorosamente.
const spoglia = (codice) => codice
  .replace(/([(,]\s*\w+)\s*:\s*any\b/g, '$1')
  .replace(/\b(let|const)\s+(\w+)\s*:\s*any(\[\])?(?=\s*[=;])/g, '$1 $2');

// ⭐ I NUMERI della regola si LEGGONO dal sorgente, non si ricopiano qui: ricopiarli
// vorrebbe dire che il banco resta verde anche se domani qualcuno mette 2 prove invece
// di 3 — proverebbe la propria copia. Se una costante sparisce o cambia forma, questo
// muore rumorosamente invece di misurare un'altra cosa.
function costante(nome, testo = src) {
  const m = testo.match(new RegExp(`const ${nome} = ([0-9.]+)`));
  if (!m) throw new Error(`costante «${nome}» non trovata nel sorgente`);
  return Number(m[1]);
}
function parola(nome, testo = srcGiro) {
  const m = testo.match(new RegExp(`const ${nome} = '([^']+)'`));
  if (!m) throw new Error(`costante «${nome}» non trovata nel modulo del giro`);
  return m[1];
}
/* 🔄 27/08 — la soglia si legge dal MODULO del giro, non più dall'edge: da oggi vive lì,
   perché serviva anche al ponte del link (per dire al socio che aspetta il maestro) e una
   terza copia di un numero che decide chi sale di livello non si scrive. */
const TETTO_AUTOMATICO = costante('TETTO_AUTOMATICO', srcGiro);
const TENTATIVI_PER_GIRO = costante('TENTATIVI_PER_GIRO', srcGiro);
const ORE_SILENZIO_ASSENSO = costante('ORE_SILENZIO_ASSENSO', srcGiro);
const SCELTA_MI_FERMO = parola('SCELTA_MI_FERMO');
const SCELTA_RIPROVO = parola('SCELTA_RIPROVO');

const ctx = {
  FONTE: 'autovalutazione',
  TENTATIVI_PER_GIRO, ORE_SILENZIO_ASSENSO, SCELTA_MI_FERMO, SCELTA_RIPROVO,
  TETTO_AUTOMATICO,
};
vm.createContext(ctx);
vm.runInContext(
  spoglia([
    // 🔄 27/08 — `definizioneLivello` si estrae dal MODULO: da oggi la scala vive lì, perché
    //    serviva anche al ponte del link per dire al socio che livello ha ADESSO in scheda.
    ...['esitoDellaProva', 'quandoMs', 'sceltaDellaProva', 'stessaProva', 'giriDelSocio', 'laProvaEsaurisceIlGiro', 'definizioneLivello']
      .map((n) => estrai(n, srcGiro)),
    ...['clean', 'numero', 'quando', 'livelloDellaScheda', 'decidi', 'soloLaPiuRecentePerSocio', 'payloadAggiornato']
      .map((n) => estrai(n)),
  ].join('\n')),
  ctx
);
const { decidi, payloadAggiornato, soloLaPiuRecentePerSocio, laProvaEsaurisceIlGiro, definizioneLivello } = ctx;

// ── Il materiale, modellato sui dati veri di PROD ────────────────────────────────
const scheda = (extra = {}) => ({
  id: 'sa-1',
  token: 'TOK-1',
  submitted_at: '2026-06-23T10:00:00.000Z',
  first_name: 'Diego', last_name: 'Braido',
  declared_level: 1, calculated_level: 1,
  consistency_status: 'high',
  staff_status: '',
  applied_at: null,
  raw_response: { source: 'scheda-pubblica' },
  ...extra,
});
const socio = (extra = {}) => ({ id: 'soc-1', level: '0.5', ...extra });

// ── Il materiale del ④: le prove col cancello del quiz, e l'orologio ─────────────
// ⭐ L'orologio si passa da FUORI (`decidi(..., adessoMs)`): una funzione che leggesse
//    l'ora da sé darebbe due risposte diverse alla stessa scheda a un'ora di distanza, e
//    la regola del silenzio non si potrebbe provare a tavolino.
const ADESSO_MS = Date.parse('2026-08-19T12:00:00.000Z');
const oreFa = (n) => new Date(ADESSO_MS - n * 60 * 60 * 1000).toISOString();
// Una prova col cancello: `scheda` per la regola, `provaGiro` per la storia (che è quello
// che `laProvaEsaurisceIlGiro` cammina). Lo stesso gettone e lo stesso istante: è così che
// `stessaProva` le riconosce come la stessa cosa vista da due elenchi.
const provaPassata = (token, quandoIso, extra = {}) => scheda({
  token, submitted_at: quandoIso,
  raw_response: { source: 'scheda-pubblica', knowledge: { status: 'pass', correct: 4, total: 4 } },
  ...extra,
});
const provaGiro = (token, quandoIso, esito, extra = {}) => ({
  token, submitted_at: quandoIso,
  declared_level: 1, calculated_level: 1,
  raw_response: { knowledge: { status: esito } },
  ...extra,
});

const casi = [];
const caso = (nome, fn) => casi.push({ nome, fn });

caso('1. 🚨🚨 una scheda VECCHIA non scavalca un livello aggiornato dopo (il caso vero di PROD)', () => {
  const vecchia = scheda({ submitted_at: '2026-04-30T10:00:00.000Z', calculated_level: 2.5, declared_level: 2.5 });
  const chiHaGiaIlLivello = socio({ level: '4', levelSource: 'autovalutazione', lastLevelUpdateAt: '2026-05-02T18:02:42.813Z' });
  const esito = decidi(vecchia, chiHaGiaIlLivello);
  return [esito.applica === false, /aggiornato dopo/.test(esito.motivo)];
});

caso('2. la scheda di chi è rimasto a 0,5 si applica, e il motivo dice il cambio', () => {
  const esito = decidi(scheda(), socio());
  return [esito.applica === true, esito.livello === 1, /da 0.5 a 1/.test(esito.motivo)];
});

caso('3. anche `selfAssessmentDate` conta come ultimo aggiornamento (non solo lastLevelUpdateAt)', () => {
  const esito = decidi(scheda(), socio({ level: '3', selfAssessmentDate: '2026-07-01T10:00:00.000Z' }));
  return [esito.applica === false, /aggiornato dopo/.test(esito.motivo)];
});

caso('4. quello che la segreteria ha in mano non si tocca', () => {
  return ['review', 'pending', 'pending_attention'].map((stato) => decidi(scheda({ staff_status: stato }), socio()).applica === false);
});

caso('5. coerenza bassa: decide una persona, non la macchina', () => {
  const esito = decidi(scheda({ consistency_status: 'low' }), socio());
  return [esito.applica === false, /non tornano/.test(esito.motivo)];
});

caso('6. il link generico non è un socio: mai applicato da solo', () => {
  const esito = decidi(scheda({ raw_response: { source: 'link-esterno' } }), socio());
  return [esito.applica === false, /generico/.test(esito.motivo)];
});

caso('7. «dichiara alto ma gioca da poco» resta alla segreteria', () => {
  const esito = decidi(scheda({ raw_response: { source: 'scheda-pubblica', experience_flag: true } }), socio());
  return [esito.applica === false];
});

caso('8. il test di conoscenza: fallito no; passato SOLO col ④; ASSENTE sì (le schede vecchie)', () => {
  // 🔁 19/08/2026: il «passato sì» di prima è diventato «passato quando il socio ha detto
  //    la sua» — vedi i casi 28-34. Qui resta la parte che il ④ non tocca: la bocciatura
  //    non si applica mai, e una scheda SENZA cancello si applica come sempre (viene
  //    dall'epoca delle email, e a lei nessun bot può fare domande).
  const conTest = (status) => scheda({ raw_response: { source: 'scheda-pubblica', knowledge: { status, correct: 2, total: 4 } } });
  return [
    decidi(conTest('fail'), socio(), [], ADESSO_MS).applica === false,
    decidi(scheda(), socio(), [], ADESSO_MS).applica === true,   // nessun `knowledge`: come prima
  ];
});

caso('9. dichiarato e calcolato distanti più di 0,5: non è automatico', () => {
  const esito = decidi(scheda({ declared_level: 1, calculated_level: 3 }), socio());
  return [esito.applica === false, /distano/.test(esito.motivo)];
});

caso('10. socio sparito dall\'anagrafica: non si inventa niente', () => {
  const esito = decidi(scheda(), null);
  return [esito.applica === false, /non esiste/.test(esito.motivo)];
});

caso('11. nessuna scrittura a vuoto: se il livello è già quello, la riga non si tocca', () => {
  // ⚠️ dichiarato E calcolato a 2: con solo il calcolato la scheda usciva prima, sul
  //    controllo della distanza, e il caso misurava un'altra regola credendo di misurare questa.
  const esito = decidi(scheda({ calculated_level: 2, declared_level: 2 }), socio({ level: 2 }));
  return [esito.applica === false, /ha già questo livello/.test(esito.motivo)];
});

caso('12. una scheda già applicata non si riapplica', () => {
  const esito = decidi(scheda({ applied_at: '2026-07-01T10:00:00.000Z' }), socio());
  return [esito.applica === false, /già applicata/.test(esito.motivo)];
});

caso('13. senza livello calcolato si usa il dichiarato; senza nessuno dei due non si applica', () => {
  return [
    decidi(scheda({ calculated_level: null, declared_level: 2 }), socio()).livello === 2,
    decidi(scheda({ calculated_level: null, declared_level: null }), socio()).applica === false,
  ];
});

caso('14. la virgola decimale non fa saltare il conto (2,5 è 2.5)', () => {
  const esito = decidi(scheda({ calculated_level: '2,5', declared_level: '2,5' }), socio());
  return [esito.applica === true, esito.livello === 2.5];
});

caso('15. 🚨 il payload nuovo tocca SOLO il livello e i suoi satelliti', () => {
  const prima = { id: 'soc-1', name: 'Diego Braido', phone: '351 900 0001', level: '0.5',
                  pmoPlayerId: 'PMO-000123', memberId: '000456', active: true, updatedAt: '2026-01-01T00:00:00.000Z' };
  const dopo = payloadAggiornato(prima, scheda(), 1, '2026-08-11T23:00:00.000Z');
  return [
    dopo.level === 1,
    dopo.levelSource === 'autovalutazione',
    dopo.lastLevelUpdateAt === '2026-08-11T23:00:00.000Z',
    dopo.selfAssessmentDate === '2026-06-23T10:00:00.000Z',
    dopo.selfAssessmentToken === 'TOK-1',
    // ⚠️ ciò che non c'entra col livello resta com'era: il codice Padel Village, il
    // telefono, il nome, l'id Matchpoint. Una scrittura che li perdesse li perderebbe
    // per tutti, in silenzio.
    dopo.pmoPlayerId === 'PMO-000123',
    dopo.phone === '351 900 0001',
    dopo.name === 'Diego Braido',
    dopo.memberId === '000456',
    dopo.active === true,
  ];
});

caso('16. `updatedAt` in ISO con la Z, o il gestionale non lo vedrebbe mai più recente', () => {
  const dopo = payloadAggiornato({ id: 'soc-1' }, scheda(), 1, '2026-08-11T23:00:00.000Z');
  return [
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(dopo.updatedAt),
    dopo.updatedAt > '2026-08-09T10:30:03.689Z',
  ];
});

caso('17. 🚨🚨 tre schede della STESSA persona: ne passa UNA, la più recente (trovato dal giro a vuoto)', () => {
  // Il primo giro simulato su TEST diceva «da 4 a 1», «da 4 a 4.5», «da 4 a 1.5» — tre volte
  // la stessa persona, e il livello sarebbe rimasto quello dell'ultima ESAMINATA.
  const perToken = new Map([['T1', 'soc-1'], ['T2', 'soc-1'], ['T3', 'soc-1'], ['T4', 'soc-2']]);
  const tre = [
    scheda({ id: 'a', token: 'T1', submitted_at: '2026-05-12T10:00:00.000Z' }),
    scheda({ id: 'b', token: 'T3', submitted_at: '2026-08-09T18:00:00.000Z' }),
    scheda({ id: 'c', token: 'T2', submitted_at: '2026-08-09T09:00:00.000Z' }),
    scheda({ id: 'd', token: 'T4', submitted_at: '2026-07-01T10:00:00.000Z' }),
  ];
  const tenute = soloLaPiuRecentePerSocio(tre, perToken);
  const perSoc1 = tenute.filter((s) => ['a', 'b', 'c'].includes(s.id));
  return [
    tenute.length === 2,              // una per socio
    perSoc1.length === 1,
    perSoc1[0].id === 'b',            // la più recente, non l'ultima dell'elenco
    tenute.some((s) => s.id === 'd'), // l'altro socio non si perde
  ];
});

caso('18. la scheda senza socio non sparisce: passa alla regola, che dirà perché', () => {
  const orfana = scheda({ id: 'x', token: 'IGNOTO' });
  const tenute = soloLaPiuRecentePerSocio([orfana], new Map());
  return [tenute.length === 1, decidi(tenute[0], null).applica === false];
});

// ── IL RIBASSO NON ESISTE PIÙ: il livello non scende MAI da solo (sua, 27/08) ────
// 🚨🚨 IL CASO 19 RESTA IL DIFETTO VERO, quello per cui il bottone del test è rimasto
//    chiuso a chi un livello ce l'ha: una brutta giornata portava da Avanzato (4) a
//    Principiante (1) in un colpo solo. Chi riapre quella strada deve vedere un rosso.
// 🔄 Il 27/08 la protezione è diventata SENZA ECCEZIONI: prima la terza prova di fila
//    più bassa faceva scendere di mezzo passo, adesso non fa niente. ⇒ I casi 20, 21,
//    23, 24 e 25 non contano più le prove: contano che il numero di prove **non conti**.
//    È la stessa forma della prova che gira tutte e due le strade — quello che va
//    protetto qui è che una serie lunga NON produca una discesa.
const provaBassa = (quandoIso, livello) => ({ token: 'T', submitted_at: quandoIso, declared_level: livello, calculated_level: livello });
const avanzato = (extra = {}) => socio({ level: '4', levelSource: 'autovalutazione', lastLevelUpdateAt: '2026-05-01T00:00:00.000Z', ...extra });
const schedaBassa = (quandoIso, livello) => scheda({ submitted_at: quandoIso, declared_level: livello, calculated_level: livello });

caso('19. 🚨🚨 UNA scheda più bassa NON fa scendere: da 4 a 1 non succede più', () => {
  const oggi = '2026-08-09T10:00:00.000Z';
  const esito = decidi(schedaBassa(oggi, 1), avanzato(), [provaBassa(oggi, 1)]);
  return [esito.applica === false, /non scende/.test(esito.motivo)];
});

caso('20. 🔄 due prove più basse non fanno niente, e non si aspetta più nessuna terza', () => {
  const oggi = '2026-08-09T10:00:00.000Z';
  const storia = [provaBassa('2026-08-01T10:00:00.000Z', 2), provaBassa(oggi, 1)];
  const esito = decidi(schedaBassa(oggi, 1), avanzato(), storia);
  return [esito.applica === false, /non scende/.test(esito.motivo), !/prova \d+ di/.test(esito.motivo)];
});

caso('21. ⭐🔄 TRE prove di fila più basse: NON si scende più nemmeno di mezzo passo', () => {
  const oggi = '2026-08-09T10:00:00.000Z';
  const storia = [provaBassa('2026-08-01T10:00:00.000Z', 2), provaBassa('2026-08-05T10:00:00.000Z', 2), provaBassa(oggi, 1)];
  const esito = decidi(schedaBassa(oggi, 1), avanzato(), storia);
  return [
    esito.applica === false,
    esito.livello !== 3.5,          // il mezzo passo di prima
    /non scende/.test(esito.motivo),
  ];
});

caso('21bis. 🚨 e nemmeno DIECI prove di fila: il numero non conta più', () => {
  const oggi = '2026-08-09T10:00:00.000Z';
  const storia = Array.from({ length: 10 }, (_, i) => provaBassa(`2026-07-${String(10 + i).padStart(2, '0')}T10:00:00.000Z`, 1));
  storia.push(provaBassa(oggi, 1));
  const esito = decidi(schedaBassa(oggi, 1), avanzato(), storia);
  return [esito.applica === false, /non scende/.test(esito.motivo)];
});

caso('22. al RIALZO non cambia niente: si applica come sempre, storia o non storia', () => {
  const su = scheda({ submitted_at: '2026-08-09T10:00:00.000Z', declared_level: 2, calculated_level: 2 });
  const esito = decidi(su, socio({ level: '1', lastLevelUpdateAt: '2026-05-01T00:00:00.000Z' }), []);
  return [esito.applica === true, esito.livello === 2, /da 1 a 2/.test(esito.motivo)];
});

caso('23. 🔄 una prova ALTA in mezzo non cambia niente: comunque non si scende', () => {
  const oggi = '2026-08-09T10:00:00.000Z';
  const storia = [
    provaBassa('2026-08-03T10:00:00.000Z', 2),
    provaBassa('2026-08-05T10:00:00.000Z', 4.5),
    provaBassa(oggi, 1),
  ];
  const esito = decidi(schedaBassa(oggi, 1), avanzato(), storia);
  return [esito.applica === false, /non scende/.test(esito.motivo)];
});

caso('24. 🔄 e nemmeno le prove di un\'ALTRA EPOCA: la storia non decide più niente al ribasso', () => {
  const oggi = '2026-08-09T10:00:00.000Z';
  const storia = [
    provaBassa('2026-04-10T10:00:00.000Z', 1),
    provaBassa('2026-04-20T10:00:00.000Z', 1),
    provaBassa(oggi, 1),
  ];
  const esito = decidi(schedaBassa(oggi, 1), avanzato(), storia);
  return [esito.applica === false, /non scende/.test(esito.motivo)];
});

caso('25. 🚨 CHI STA IN BASSO non finisce a 0,5, che qui vuol dire «senza livello» (e muro)', () => {
  const oggi = '2026-08-09T10:00:00.000Z';
  const storia = [provaBassa('2026-08-01T10:00:00.000Z', 0.5), provaBassa('2026-08-05T10:00:00.000Z', 0.5), provaBassa(oggi, 0.5)];
  const alMinimo = socio({ level: '1', lastLevelUpdateAt: '2026-05-01T00:00:00.000Z' });
  const esito = decidi(schedaBassa(oggi, 0.5), alMinimo, storia);
  return [esito.applica === false, esito.livello !== 0.5 || esito.applica === false];
});

caso('26. 🔒 FALLISCE CHIUSA: senza storia (lettura andata male) nessuno scende', () => {
  const oggi = '2026-08-09T10:00:00.000Z';
  return [
    decidi(schedaBassa(oggi, 1), avanzato(), []).applica === false,
    decidi(schedaBassa(oggi, 1), avanzato(), null).applica === false,
    decidi(schedaBassa(oggi, 1), avanzato(), undefined).applica === false,
  ];
});

caso('27. 🔄 il MOTIVO non parla più di conti: al socio non si chiede di contare i suoi fallimenti', () => {
  const oggi = '2026-08-09T10:00:00.000Z';
  const storia = [provaBassa('2026-08-01T10:00:00.000Z', 2), provaBassa('2026-08-05T10:00:00.000Z', 2), provaBassa(oggi, 1)];
  const esito = decidi(schedaBassa(oggi, 1), avanzato(), storia);
  return [
    !/prova \d+ di \d+/.test(esito.motivo),
    !/prove di fila/.test(esito.motivo),
    !/mezzo passo/.test(esito.motivo),
  ];
});

caso('28. ⭐ una prova PASSATA si applica SUBITO: non c\'è più un tempo di mezzo', () => {
  /* 🔄 26/08 — questo caso pretendeva l'OPPOSTO («si aspetta la scelta del socio») ed è
     diventato rosso con `ORE_SILENZIO_ASSENSO = 0`. Sua decisione, guardando il messaggio
     sul telefono: *«la variazione la fai immediata»*.
     ⚖️ La metà che REGGE, e resta provata qui sotto e nel 32: la scelta del socio non è
     sparita — «riprovo» vale per sempre e non si scavalca (caso 32), «mi fermo» conferma
     invece di provocare. Ciò che è sparito è l'intervallo in cui il socio aveva un livello
     nuovo che il gestionale non aveva ancora. */
  const p = provaPassata('T1', oreFa(1));
  const esito = decidi(p, socio(), [provaGiro('T1', oreFa(1), 'pass')], ADESSO_MS);
  return [esito.applica === true, esito.livello === 1];
});

caso('29. ⭐ il SILENZIO è assenso dopo 24 ore: nessuno resta senza livello per non aver risposto', () => {
  const p = provaPassata('T1', oreFa(ORE_SILENZIO_ASSENSO + 1));
  const storia = [provaGiro('T1', oreFa(ORE_SILENZIO_ASSENSO + 1), 'pass')];
  const esito = decidi(p, socio(), storia, ADESSO_MS);
  return [esito.applica === true, esito.livello === 1];
});

caso('30. il confine dell\'attesa è dove dice il modulo, qualunque numero ci sia', () => {
  /* 🔄 26/08 — con l'attesa a ZERO questo caso continuava a passare **senza provare niente**:
     `oreFa(ORE_SILENZIO_ASSENSO - 0.02)` diventa una prova consegnata nel FUTURO, e che una
     prova del futuro non si applichi non è la regola che questo caso deve difendere.
     📌 *Un verde che sopravvive a un cambio di comportamento è un avviso* (il filo della 43ª):
     riscritto in modo che il confine si sposti col numero invece di essere inchiodato a 24.
     ⇒ Rimettendo 24 questo caso torna a misurare le 24 ore, senza toccarlo. */
  const dentro = provaPassata('T1', oreFa(ORE_SILENZIO_ASSENSO + 0.02));   // l'attesa è passata
  const prima = provaPassata('T2', oreFa(ORE_SILENZIO_ASSENSO - 0.02));    // manca ancora un po'
  return [
    decidi(dentro, socio(), [provaGiro('T1', dentro.submitted_at, 'pass')], ADESSO_MS).applica === true,
    decidi(prima, socio(), [provaGiro('T2', prima.submitted_at, 'pass')], ADESSO_MS).applica === false,
  ];
});

caso('31. ⭐ «mi fermo»: si applica SUBITO, senza aspettare le 24 ore', () => {
  const p = provaPassata('T1', oreFa(1), { member_decision: SCELTA_MI_FERMO, member_decision_at: oreFa(0.5) });
  const storia = [provaGiro('T1', oreFa(1), 'pass', { member_decision: SCELTA_MI_FERMO, member_decision_at: oreFa(0.5) })];
  const esito = decidi(p, socio(), storia, ADESSO_MS);
  return [esito.applica === true, esito.livello === 1];
});

caso('32. 🚨 «riprovo» vale PER SEMPRE: non si applica nemmeno passate le 24 ore', () => {
  // ⚖️ Il silenzio è assenso; una RISPOSTA è una risposta. Se le 24 ore scavalcassero anche
  //    il «riprovo», il socio si vedrebbe applicare il livello che aveva rifiutato — cioè
  //    la domanda sarebbe finta, che è peggio che non farla.
  const p = provaPassata('T1', oreFa(ORE_SILENZIO_ASSENSO + 48), { member_decision: SCELTA_RIPROVO, member_decision_at: oreFa(ORE_SILENZIO_ASSENSO + 47) });
  const storia = [provaGiro('T1', p.submitted_at, 'pass', { member_decision: SCELTA_RIPROVO })];
  const esito = decidi(p, socio(), storia, ADESSO_MS);
  return [esito.applica === false, /riprovare/.test(esito.motivo)];
});

caso('33. ⭐ la TERZA prova si applica da sola: non c\'è una quarta a cui rimandare', () => {
  // Sua risposta del 19/08: arrivare alla terza È essersi fermati alla terza. Qui la prova è
  // di un minuto fa e non ha nessuna scelta addosso: senza questa regola aspetterebbe 24 ore
  // per una domanda che non ha senso fare.
  const terza = provaPassata('T3', oreFa(0.1));
  const storia = [
    provaGiro('T1', oreFa(50), 'fail'),
    provaGiro('T2', oreFa(30), 'fail'),
    provaGiro('T3', oreFa(0.1), 'pass'),
  ];
  const esito = decidi(terza, socio(), storia, ADESSO_MS);
  return [esito.applica === true, laProvaEsaurisceIlGiro(storia, terza, TENTATIVI_PER_GIRO) === true];
});

caso('34. 🔒 una storia illeggibile non manda il socio in nessun limbo', () => {
  /* 🔄 26/08 — qui c'era scritto «FALLISCE CHIUSA: si aspetta», e con l'attesa a ZERO è
     diventato rosso perché *aspettare* e *applicare* sono ormai la stessa cosa: il silenzio
     ripescava comunque il caso dopo 24 ore, adesso lo ripesca dopo zero.
     ⚖️ La metà che REGGE — ed è quella per cui il caso esisteva — non è «si aspetta»: è che
     un guasto di lettura **non lasci il socio senza livello**, che era la porta chiusa in
     faccia da cui questa funzione è nata. Con l'attesa a zero il verso sicuro è l'opposto di
     prima, e la garanzia è la stessa.
     🚨 Quello che un guasto di lettura non deve poter fare resta provato dal 32: scavalcare
     un «riprovo» detto dal socio. Lì non c'è niente da dedurre dalla storia — la scelta è
     scritta sulla prova. */
  const terza = provaPassata('T3', oreFa(0.1));
  return [
    decidi(terza, socio(), [], ADESSO_MS).applica === true,
    decidi(terza, socio(), null, ADESSO_MS).applica === true,
  ];
});

caso('35. il ④ non tocca il RIBASSO: una prova passata più bassa resta ferma alla regola del ③', () => {
  // Anche col «mi fermo» addosso, una prova che dice meno non fa scendere: le due regole si
  // sommano, e la scelta del socio non è un permesso di farsi male.
  const p = provaPassata('T1', oreFa(1), { declared_level: 1, calculated_level: 1, member_decision: SCELTA_MI_FERMO, member_decision_at: oreFa(0.5) });
  const storia = [provaGiro('T1', oreFa(1), 'pass', { member_decision: SCELTA_MI_FERMO })];
  const esito = decidi(p, avanzato(), storia, ADESSO_MS);
  return [esito.applica === false, /non scende/.test(esito.motivo)];
});

// ── 🆕 IL TETTO E IL TERZO ESITO (25/08/2026) ───────────────────────────────────
// 🚨 Questi casi non provano un calcolo: proteggono una DECISIONE, e quelle sono ciò che il
// codice dimentica per primo. In particolare il 37 gira la strada sbagliata accanto a quella
// giusta, perché il difetto che evita è invisibile a chiunque guardi solo il risultato.

caso('36. il tetto TAGLIA il livello scritto, ma non la misura: chi risponde da Agonista prende Intermedio', () => {
  const alta = scheda({ declared_level: 5, calculated_level: 5 });
  const esito = decidi(alta, socio());
  return [
    esito.applica === true,
    esito.livello === TETTO_AUTOMATICO,
    /Agonista/.test(esito.segnala),
    /maestro/.test(esito.segnala),
  ];
});

caso('37. 🚨 il taglio arriva DOPO i controlli di coerenza, o boccerebbe chi è stato coerente', () => {
  // La strada sbagliata: tagliare a 3.5 PRIMA di confrontare col dichiarato. Chi dichiara 5 e
  // risponde da 5 si vedrebbe confrontare 3.5 con 5 — distanza 1.5 — e verrebbe fermato per
  // incoerenza proprio perché è stato coerente. Nessuna prova del solo risultato lo vedrebbe:
  // in tutti e due gli ordini «il livello scritto» è 3.5.
  const coerenteInAlto = decidi(scheda({ declared_level: 5, calculated_level: 5 }), socio());
  const davveroIncoerente = decidi(scheda({ declared_level: 5, calculated_level: 2 }), socio());
  return [
    coerenteInAlto.applica === true,
    davveroIncoerente.applica === false,
    /distano/.test(davveroIncoerente.motivo),
  ];
});

caso('38. sotto il tetto non cambia NIENTE: nessuna segnalazione dove non serve', () => {
  const esito = decidi(scheda({ declared_level: 3, calculated_level: 3 }), socio());
  return [esito.applica === true, esito.livello === 3, !esito.segnala];
});

caso('39. 🚨 la segnalazione sopravvive al livello NON scritto: chi è già a 3.5 e risponde da Agonista', () => {
  // È il caso che si perde per primo scrivendo la cura in fretta: il livello è già quello, la
  // regola dice «non si tocca» — ma il fatto che il maestro debba guardarlo è vero lo stesso.
  // Tacere qui vorrebbe dire che gli unici di cui nessuno viene informato sono proprio gli
  // Intermedi che meritano di salire.
  const esito = decidi(scheda({ declared_level: 5, calculated_level: 5 }), socio({ level: '3.5' }));
  return [esito.applica === false, /ha già questo livello/.test(esito.motivo), /Agonista/.test(esito.segnala)];
});

caso('40. il tetto non fa SCENDERE nessuno: un Avanzato che risponde da Agonista resta a 4', () => {
  // 3.5 è più basso di 4 ⇒ entra la regola del ribasso, che protegge. Il tetto limita ciò che
  // la macchina si prende la responsabilità di scrivere, non toglie quello che c'è già.
  const esito = decidi(scheda({ declared_level: 5, calculated_level: 5 }), avanzato());
  return [esito.applica === false, /non scende/.test(esito.motivo), /Agonista/.test(esito.segnala)];
});

caso('41. i nomi della scala sono quelli, e il tetto si chiama Intermedio', () => {
  return [
    definizioneLivello(TETTO_AUTOMATICO) === 'Intermedio',
    definizioneLivello(5) === 'Agonista',
    definizioneLivello(4.5) === 'Avanzato',
    definizioneLivello(1) === 'Principiante',
    definizioneLivello('') === '',
  ];
});

// ── GUARDIE SULLA BASE ──────────────────────────────────────────────────────────
// 🚨 Un banco che misura ZERO resta verde: queste guardano il sorgente dell'edge, non la
//    regola, e fermano i tre modi in cui questa funzione può fare danno.
const guardie = [
  ['la regola esiste ed è quella estratta', typeof decidi === 'function' && typeof payloadAggiornato === 'function'],
  // 🆕 IL TERZO ESITO, guardato sul sorgente: senza questa riga la cura sarebbe una parola in
  // più in un oggetto e nessuna scheda finirebbe mai davanti a una persona.
  ['🆕 il terzo esito esiste: `applied_review` quando c\'è da guardare, `applied` quando no',
    /const STAFF_DA_CERTIFICARE = 'applied_review'/.test(src)
    && /staff_status: clean\(esito\.segnala\) \? STAFF_DA_CERTIFICARE : 'applied'/.test(src)],
  // 🚨 …e la scheda segnalata resta APPLICATA: sono `applied_at` e `applied_member_id` a dirlo
  //    all'app, non la parola. Se un domani sparissero, `applied_review` diventerebbe un blocco.
  ['🚨 la scheda segnalata porta comunque `applied_at` e `applied_member_id`',
    /applied_at: adesso/.test(src) && /applied_member_id: socioId/.test(src)],
  /* 🔄 27/08 — il tetto è dichiarato come costante NEL MODULO condiviso, e questa edge lo
     IMPORTA invece di riscriverlo. La guardia si sposta con lui: pretendere ancora la
     dichiarazione qui vorrebbe dire pretendere la seconda copia che si è appena tolta. */
  ['🆕 il tetto è dichiarato nel modulo del giro, non sparso nel codice', /export const TETTO_AUTOMATICO = 3\.5/.test(srcGiro)],
  ['🚨 …e questa edge lo IMPORTA, non lo riscrive', /TETTO_AUTOMATICO as TETTO_DAL_MODULO/.test(src) && !/const TETTO_AUTOMATICO = [0-9]/.test(src)],
  // 🚨🚨 `pmo_upsert_records_admin` fa `payload = excluded.payload`: REPLACE TOTALE. Usarlo
  //    qui vorrebbe dire riscrivere il socio intero con quello che l'edge ha in mano.
  ['scrive con una modifica MIRATA, mai con un upsert', !/upsert\(/.test(src) && !/pmo_upsert_records_admin/.test(src)],
  ['la scrittura è agganciata alla riga per id', /\.update\(\{ payload: nuovo/.test(src) && /\.eq\('id', riga!\.id\)/.test(src)],
  // Sua decisione dell'11/08: l'automatismo non manda niente a nessuno.
  ['non manda email a nessuno', !/gmail/i.test(src) && !/mandaEmail/.test(src)],
  ['si entra solo col segreto della routine', /pmo_verify_data_routine_secret/.test(src) && /ROUTINE_SECRET_REQUIRED/.test(src)],
  ['esiste il giro a vuoto (`simula`) per guardare prima di scrivere', /body\?\.simula === true/.test(src)],
  ['c\'è un tetto per giro', /MASSIMO_PER_GIRO/.test(src)],
  // ⚠️ L'ordine dei due passi: prima il livello, poi la marcatura. Al contrario, un livello
  //    mai scritto risulterebbe applicato e nessuno ci tornerebbe sopra.
  ['il livello si scrive PRIMA di marcare la scheda', src.indexOf("from('pmo_cloud_records')\n      .update") < src.indexOf("from('self_assessments')\n      .update")],
  // ── 🔄 27/08: LA DISCESA AUTOMATICA NON DEVE POTER TORNARE, e si guarda sulla base ──
  // 🚨 Questi tre non provano un comportamento: provano che i PEZZI di quella regola non
  //    siano più nel sorgente. Un caso può restare verde con la macchina ancora lì e un
  //    ramo che non si esercita; un sorgente che non ha più i numeri non può scendere.
  ['non esistono più i numeri della discesa', !/PROVE_PER_SCENDERE|PASSO_DISCESA|LIVELLO_MINIMO_SCESO/.test(src.replace(/\/\/.*$/gm, ''))],
  ['non esiste più il contatore delle prove al ribasso', !/function proveConsecutiveAlRibasso/.test(src)],
  ['nessun conto viene tenuto in una colonna', !/prove_al_ribasso|discese_consecutive/.test(src)],
  // 🔒 La storia serve ancora — al GIRO, non al ribasso — e se non si legge lo si dice.
  ['la storia che non si legge resta un avviso', /avvisi\.push/.test(src) && /storia non letta/.test(src)],
  // ── Il ④: la scelta del socio, guardata sulla BASE e non solo sui casi ──
  // 🚨 IL CABLAGGIO, che è il punto cieco dei casi: `decidi` può essere perfetta e non
  //    ricevere mai i dati che le servono. Queste due guardie misurano che l'edge LEGGA la
  //    scelta dal database e passi l'orologio alla regola — senza, tutti i casi qui sopra
  //    restano verdi mentre in produzione nessuna prova aspetta nessuno.
  ['l\'edge LEGGE la scelta dal database', /member_decision, member_decision_at/.test(src)],
  ['la storia porta il cancello del quiz (`raw_response`), o il giro non si ricostruisce', /select\('token, submitted_at, declared_level, calculated_level, raw_response/.test(src)],
  ['`decidi` riceve l\'orologio da fuori, non lo legge da sé', /decidi\(scheda, payload, socioId \? \(storiaPerSocio\.get\(socioId\) \|\| \[\]\) : \[\], Date\.parse\(adesso\)\)/.test(src)],
  ['la regola del giro arriva dal modulo, non da una copia locale', /from '\.\/giro-del-test\.ts'/.test(src) && !/function laProvaEsaurisceIlGiro/.test(src)],
  // 🔄 26/08 — era `=== 24`. Sua decisione: l'attesa va a ZERO, il livello si scrive subito.
  // ⚖️ La guardia NON diventa «qualunque numero»: un valore preciso è ciò che rende visibile
  //    un cambio fatto per sbaglio. Cambiare il numero resta un gesto che si dichiara qui.
  ['l\'attesa del silenzio-assenso è ZERO, e il numero sta nel modulo', ORE_SILENZIO_ASSENSO === 0],
  // ⚖️ «riprovo» non ha scadenza: se le 24 ore lo scavalcassero, la domanda sarebbe finta.
  ['«riprovo» esce PRIMA del silenzio-assenso', src.indexOf('SCELTA_RIPROVO') < src.indexOf('ORE_SILENZIO_ASSENSO * 60')],

  // ── 🆕🔗 VOCE 85 (24/08/2026): il livello applicato arriva ANCHE su Matchpoint ──────────
  //
  // 📏 Il difetto misurato: questo file aveva ZERO riferimenti a Matchpoint, e i soli a
  // chiamare `matchpoint-clients-update` erano quattro punti di `index.html`. ⇒ Il livello
  // che nasce dal test si fermava in `pmo_cloud_records`: non tardava, NON PARTIVA.
  //
  // ⚠️ Sono guardie TESTUALI, e si dicono per quello che sono: il giro parla col database e
  // con la rete, e da qui non si può ESEGUIRE. Provano che la spinta c'è, dov'è, e che non
  // può far danno — non provano che Matchpoint la riceva. Quella è una prova fisica.
  ['🔗 il livello applicato viene spinto verso il circolo',
    /spingiIlLivelloAlCircolo\(/.test(src)],
  // ⭐ Si passa dall'EDGE, non dal worker: la strada verso il circolo è una sola e ha dentro
  //    il recinto di TEST. Una seconda copia di quella regola divergerebbe al primo
  //    ripensamento — è la stessa scelta già fatta con la cura ④ (il dispatcher, non l'edge).
  ['…chiedendolo all\'edge che ha già il recinto, non al worker',
    /functions\/v1\/matchpoint-clients-update/.test(src)
    && !/MATCHPOINT_BROWSER_WORKER_URL|\/update-client/.test(src)],
  // 🚨 L'ORDINE, ed è il punto: si spinge DOPO che la scheda è marcata. Spingendo prima, un
  //    intoppo lascerebbe il livello sul Matchpoint del circolo e non da noi — cioè la voce 85
  //    esatta, al rovescio.
  ['🚨 si spinge DOPO aver marcato la scheda, non prima',
    src.indexOf("applied_at: adesso") < src.indexOf('spingiIlLivelloAlCircolo({')],
  // 🚨 E NON PUÒ TOGLIERE NIENTE A NESSUNO: una spinta fallita non salta il socio. Il livello
  //    resta applicato e il socio ha già avuto il suo messaggio — si perde la spinta, non il
  //    fatto. Chi mettesse un `continue` in quel ramo lo scoprirebbe da un socio, non da qui.
  ['🚨 una spinta fallita NON annulla l\'applicazione (nessun `continue`)',
    /spinta\.esito === 'non_riuscita'\)\s*\{[\s\S]{0,400}?avvisi\.push/.test(src)
    && !/spinta\.esito === 'non_riuscita'\)\s*\{[\s\S]{0,400}?continue;/.test(src)],
  // 🧊 `simula` esiste per GUARDARE cosa succederebbe, e una scrittura sul Matchpoint del
  //    circolo non è una cosa che si guarda.
  ['🧊 in simulazione la spinta NON parte', /if \(!simula\) \{\s*\n\s*spinta = await spingiIlLivelloAlCircolo/.test(src)],
  // 🔇 Su TEST il recinto risponde 503, ed è il comportamento GIUSTO: non deve finire fra gli
  //    avvisi, o il giro di TEST urlerebbe a ogni livello applicato e si smetterebbe di leggerlo.
  ['🔇 il rifiuto di TEST non viene scambiato per un guasto',
    /AMBIENTE_DI_PROVA[\s\S]{0,120}ambiente_di_prova/.test(src)],
  // 🔒 Un socio senza codice del circolo non è un guasto: si dice e si va avanti.
  ['🔒 senza codice Matchpoint non si tenta, e non si urla', /senza_codice/.test(src)],
];

// ── La porta di `matchpoint-clients-update`, che questa cura ha allargato ────────────────
const srcClienti = readFileSync(
  join(QUI, '..', 'supabase', 'functions', 'matchpoint-clients-update', 'index.ts'), 'utf8');

guardie.push(
  ['🔑 l\'edge dei clienti accetta anche una ROUTINE, oltre a una persona',
    /routineAutorizzata\(/.test(srcClienti) && /pmo_verify_data_routine_secret/.test(srcClienti)],
  // 🔒 FALLISCE CHIUSA: senza la chiave per verificare il segreto, la porta resta chiusa. Un
  //    dubbio non diventa mai un sì verso il gestionale del circolo.
  ['🔒 …e senza la chiave per verificarlo la porta resta CHIUSA',
    /if \(!supabaseUrl \|\| !serviceKey\) return false;/.test(srcClienti)],
  // 🚨⭐⭐ E LA ROUTINE NON SCAVALCA IL RECINTO, che è la protezione vera: deve restare DOPO
  //    l'autenticazione, o una routine scriverebbe sul Matchpoint vero anche da TEST.
  // 🚨⭐ E si pretende che la chiamata CI SIA prima di guardare dov'è: con un solo `indexOf`
  //    cancellare la chiamata darebbe −1, che è minore di qualunque cosa, e la guardia
  //    resterebbe VERDE proprio mentre la porta sparisce. Trovata sabotandola, non rileggendola.
  ['🚨 il recinto di TEST resta DOPO la porta, anche per le routine',
    srcClienti.includes('routineAutorizzata(req)')
    && srcClienti.includes('scritturaAlCircoloConsentita(')
    && srcClienti.indexOf('routineAutorizzata(req)') < srcClienti.indexOf('scritturaAlCircoloConsentita(')],
);

test('BANCO — il livello si applica da solo, ma una scheda vecchia non scavalca mai', () => {
  console.log('\nBANCO — assessment-apply-level\n');
  let rossi = 0;
  console.log('Guardie sulla base:');
  for (const [nome, ok] of guardie) {
    console.log(`  ${ok ? '✅' : '❌'} ${nome}`);
    if (!ok) rossi++;
  }
  console.log('');
  for (const c of casi) {
    let esiti;
    try { esiti = c.fn(); } catch (e) { esiti = [false]; console.log(`❌ ${c.nome}\n   errore: ${e.message}`); rossi++; continue; }
    const ok = esiti.every(Boolean);
    console.log(`${ok ? '✅' : '❌'} ${c.nome}`);
    if (!ok) { console.log(`   controlli: [${esiti.map((x) => (x ? 'ok' : 'NO')).join(', ')}]`); rossi++; }
  }
  const totale = casi.length + guardie.length;
  console.log(`\n— ${totale - rossi} passati, ${rossi} falliti su ${totale} —`);
  if (rossi) throw new Error(`${rossi} prove rosse`);
});
