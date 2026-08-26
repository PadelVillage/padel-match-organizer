// ── BANCO: la RISPOSTA del socio — «ti fermi o riprovi?» ───────────────────────────────
//
// Che cosa prova: `motivoDelRifiuto` dell'edge `consumer-assessment-decision`, cioè il
// pezzo che decide se una scelta arrivata dal bot si può scrivere sulla scheda. Voce 61
// § A ④ (19/08/2026), sua regola del 17/08: *«decidi tu a quale delle tre volte ti vuoi
// fermare»*.
//
// 🚨 IL CASO 5 È IL PIÙ IMPORTANTE E IL MENO OVVIO: i bottoni di Telegram non scadono. Il
//    socio può schiacciare «mi fermo» su un messaggio di tre settimane fa, quando nel
//    frattempo ha già rifatto il test. Scrivere quella scelta riscriverebbe la storia di un
//    giro già andato avanti — e la scelta si fa sull'ULTIMA prova, non sul passato.
//
// 🚨 IL CASO 6 È IL SUO GEMELLO all'altro capo: sulla TERZA prova non c'è niente da
//    scegliere (si applica da sola, non c'è una quarta a cui rimandare). Una scelta
//    registrata lì potrebbe solo BLOCCARE un esito che deve passare — «riprovo» su una
//    prova che il cron sta per applicare la fermerebbe per sempre.
//
// ⭐ Le funzioni sono ESTRATTE dal sorgente vero dell'edge e dal modulo del giro, non
//    ricopiate qui: un banco che prova una copia prova la copia.
//
// Uso:  node --test test/consumer-assessment-decision.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const CARTELLA = join(QUI, '..', 'supabase', 'functions', 'consumer-assessment-decision');
const src = readFileSync(join(CARTELLA, 'index.ts'), 'utf8');
/** Il sorgente SENZA commenti: le guardie devono guardare i fatti, non le parole che li raccontano. */
const codice = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const srcGiro = readFileSync(join(CARTELLA, 'giro-del-test.ts'), 'utf8');

// Stesso estrattore degli altri banchi: salta i commenti (in italiano sono pieni di
// apostrofi) e parte dopo la lista dei parametri.
function estrai(nome, testo) {
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

const spoglia = (codice) => codice
  .replace(/([(,]\s*\w+)\s*:\s*any\b/g, '$1')
  .replace(/\b(let|const)\s+(\w+)\s*:\s*any(\[\])?(?=\s*[=;])/g, '$1 $2');

// ⭐ I numeri e le parole della regola si LEGGONO dal modulo: ricopiarli qui vorrebbe dire
// che il banco resta verde anche se domani la regola ne usasse altri.
function costante(nome) {
  const m = srcGiro.match(new RegExp(`const ${nome} = ([0-9.]+)`));
  if (!m) throw new Error(`costante «${nome}» non trovata nel modulo del giro`);
  return Number(m[1]);
}
function parola(nome) {
  const m = srcGiro.match(new RegExp(`const ${nome} = '([^']+)'`));
  if (!m) throw new Error(`costante «${nome}» non trovata nel modulo del giro`);
  return m[1];
}
const TENTATIVI_PER_GIRO = costante('TENTATIVI_PER_GIRO');
const MI_FERMO = parola('SCELTA_MI_FERMO');
const RIPROVO = parola('SCELTA_RIPROVO');

const ctx = { TENTATIVI_PER_GIRO, SCELTA_MI_FERMO: MI_FERMO, SCELTA_RIPROVO: RIPROVO };
vm.createContext(ctx);
vm.runInContext(
  spoglia([
    ...['esitoDellaProva', 'quandoMs', 'sceltaDellaProva', 'stessaProva', 'giriDelSocio', 'laProvaEsaurisceIlGiro']
      .map((n) => estrai(n, srcGiro)),
    estrai('motivoDelRifiuto', src),
  ].join('\n')),
  ctx,
);
const { motivoDelRifiuto } = ctx;

// ── Il materiale ────────────────────────────────────────────────────────────────
const GIORNO = 24 * 60 * 60 * 1000;
const ADESSO = Date.parse('2026-08-19T12:00:00.000Z');
const giorniFa = (n) => new Date(ADESSO - n * GIORNO).toISOString();
const prova = (token, quando, esito, extra = {}) => ({
  token, submitted_at: quando, applied_at: null,
  raw_response: { knowledge: { status: esito } },
  ...extra,
});

const casi = [];
const caso = (nome, fn) => casi.push({ nome, fn });

caso('1. la scelta buona passa: «mi fermo» e «riprovo», e nient\'altro', () => {
  const p = prova('T1', giorniFa(1), 'pass');
  return [
    motivoDelRifiuto(MI_FERMO, p, [p]) === '',
    motivoDelRifiuto(RIPROVO, p, [p]) === '',
    motivoDelRifiuto('forse', p, [p]) === 'SCELTA_SCONOSCIUTA',
    motivoDelRifiuto('', p, [p]) === 'SCELTA_SCONOSCIUTA',
    motivoDelRifiuto(null, p, [p]) === 'SCELTA_SCONOSCIUTA',
  ];
});

caso('2. una scheda che non c\'è (o non è sua) si rifiuta UGUALE, senza dire quale dei due', () => {
  // ⚖️ Il rifiuto è lo stesso nei due casi di proposito: due rifiuti diversi direbbero a
  //    chiunque provi un gettone a caso se quel gettone ESISTE, cioè farebbero scoprire le
  //    schede degli altri una domanda per volta.
  return [motivoDelRifiuto(MI_FERMO, null, []) === 'SCHEDA_NON_TROVATA'];
});

caso('3. 🔄🗣️ su una BOCCIATURA «mi fermo» ADESSO SI PUÒ — «riprovo» no', () => {
  /* 🗣️ 27/08, sua segnalazione con lo schermo davanti: *«manca il bottone che mi lascia il
     livello come per il precedente»*. Fin qui questo caso pretendeva il rifiuto su tutt'e due
     le scelte, ed era giusto finché il «no» era una riga di testo.
     ⇒ Adesso «mi fermo» su una bocciata è un FATTO che si registra — *ho letto, mi tengo il
     livello che ho* — e non può scrivere nessun livello: `assessment-apply-level` ferma le
     schede col quiz non superato PRIMA di guardare la scelta del socio.
     ⛔ Il «riprovo» resta rifiutato: rifare il test si fa dal link, non è una scelta da
     registrare — accettarlo qui darebbe due strade per la stessa cosa. */
  const bocciata = prova('T1', giorniFa(1), 'fail');
  const senzaCancello = { token: 'T1', submitted_at: giorniFa(1), applied_at: null, raw_response: {} };
  return [
    motivoDelRifiuto(MI_FERMO, bocciata, [bocciata]) === '',
    motivoDelRifiuto(RIPROVO, bocciata, [bocciata]) === 'PROVA_NON_PASSATA',
    // ⛔ E `skip` resta fuori: a Semi-Pro e Professionista il quiz non viene nemmeno posto,
    //    quindi non c'è nessuna domanda a cui questa sarebbe una risposta.
    motivoDelRifiuto(MI_FERMO, senzaCancello, [senzaCancello]) === 'PROVA_NON_PASSATA',
  ];
});

caso('3bis. 🚨 alla TERZA prova bocciata il «mi fermo» non diventa GIRO_FINITO', () => {
  /* GIRO_FINITO dice «l'esito si applica da solo, non c'è niente da scegliere»: su una
     bocciata non c'è nessun esito da applicare, e quel rifiuto direbbe al socio «non c'è
     niente da scegliere» proprio mentre gli si offre di scegliere. */
  const una = prova('T1', giorniFa(3), 'fail');
  const due = prova('T2', giorniFa(2), 'fail');
  const treBocciata = prova('T3', giorniFa(1), 'fail');
  const trePassata = prova('T3', giorniFa(1), 'pass');
  return [
    motivoDelRifiuto(MI_FERMO, treBocciata, [una, due, treBocciata]) === '',
    // …mentre su una prova SUPERATA il rifiuto resta, che è il caso per cui esiste.
    motivoDelRifiuto(MI_FERMO, trePassata, [una, due, trePassata]) === 'GIRO_FINITO',
  ];
});

caso('3ter. 🚨 CABLAGGIO: il giro d\'applicazione NON parte su una bocciata', () => {
  /* Il caso qui sopra prova la REGOLA; questo prova il punto di chiamata, che è dove il
     difetto tornerebbe intero con la regola ancora perfetta: senza la guardia, ogni tocco su
     una bocciata lancerebbe un giro che non può applicare niente. */
  return [
    /scelta === SCELTA_MI_FERMO && provaSuperata/.test(codice),
    // …e che il verdetto esca verso il bot, invece di farglielo indovinare.
    /prova_superata: provaSuperata/.test(codice),
  ];
});

caso('4. una scheda GIÀ APPLICATA non si sceglie più: la scelta è arrivata dopo i fatti', () => {
  const applicata = prova('T1', giorniFa(2), 'pass', { applied_at: giorniFa(1) });
  return [motivoDelRifiuto(MI_FERMO, applicata, [applicata]) === 'GIA_APPLICATA'];
});

caso('5. 🚨🚨 IL BOTTONE VECCHIO: una prova SUPERATA da una più recente non si sceglie', () => {
  // I bottoni di Telegram non scadono. Se questa scelta passasse, il socio riscriverebbe la
  // storia di un giro che è già andato avanti — e il giro cambierebbe forma sotto il cron.
  const vecchia = prova('T1', giorniFa(20), 'pass');
  const nuova = prova('T2', giorniFa(1), 'fail');
  return [
    motivoDelRifiuto(MI_FERMO, vecchia, [vecchia, nuova]) === 'SCHEDA_SUPERATA',
    // …e sulla più recente invece si sceglie eccome (se ha passato il quiz)
    motivoDelRifiuto(MI_FERMO, prova('T2', giorniFa(1), 'pass'), [vecchia, prova('T2', giorniFa(1), 'pass')]) === '',
  ];
});

caso('6. 🚨 sulla TERZA prova non c\'è niente da scegliere: si applica da sola', () => {
  // ⚖️ E il rifiuto qui PROTEGGE: senza, un «riprovo» sulla terza fermerebbe per sempre un
  //    esito che la sua regola vuole applicato — il socio si troverebbe il giro finito e il
  //    livello mai scritto.
  const terza = prova('T3', giorniFa(1), 'pass');
  const giro = [prova('T1', giorniFa(5), 'fail'), prova('T2', giorniFa(3), 'fail'), terza];
  return [
    motivoDelRifiuto(MI_FERMO, terza, giro) === 'GIRO_FINITO',
    motivoDelRifiuto(RIPROVO, terza, giro) === 'GIRO_FINITO',
  ];
});

caso('7. sulla PRIMA e sulla SECONDA prova invece si sceglie: sono quelle con una domanda', () => {
  const prima = prova('T1', giorniFa(5), 'pass');
  const seconda = prova('T2', giorniFa(3), 'pass');
  return [
    motivoDelRifiuto(MI_FERMO, prima, [prima]) === '',
    motivoDelRifiuto(MI_FERMO, seconda, [prima, seconda]) === '',
  ];
});

caso('8. ⭐ la scelta si può CAMBIARE finché è viva: l\'ultima parola vince', () => {
  // «Mi fermo» e poi «riprovo» dieci minuti dopo è un ripensamento, non un guasto: a
  // congelarla sono i FATTI (l'applicazione del cron, una prova nuova), non un divieto.
  const giaScelta = prova('T1', giorniFa(1), 'pass', { member_decision: MI_FERMO, member_decision_at: giorniFa(1) });
  return [motivoDelRifiuto(RIPROVO, giaScelta, [giaScelta]) === ''];
});

caso('9. `skip` non è una prova passata: Semi-Pro e Professionista non scelgono niente', () => {
  // La loro scheda la guarda il maestro (voce 61 § C): non c'è un livello calcolato da
  // tenere o rifiutare, e trattarli come una prova li chiuderebbe in un giro che non hanno.
  const skip = prova('T1', giorniFa(1), 'skip');
  return [motivoDelRifiuto(MI_FERMO, skip, [skip]) === 'PROVA_NON_PASSATA'];
});

caso('10. l\'ordine dell\'elenco non conta, e un elenco assente non fa esplodere niente', () => {
  const vecchia = prova('T1', giorniFa(20), 'pass');
  const nuova = prova('T2', giorniFa(1), 'pass');
  return [
    motivoDelRifiuto(MI_FERMO, vecchia, [nuova, vecchia]) === 'SCHEDA_SUPERATA',
    motivoDelRifiuto(MI_FERMO, vecchia, [vecchia, nuova]) === 'SCHEDA_SUPERATA',
    motivoDelRifiuto(MI_FERMO, nuova, null) === '',
    motivoDelRifiuto(MI_FERMO, nuova, undefined) === '',
  ];
});

// ── GUARDIE SULLA BASE ──────────────────────────────────────────────────────────
// 🚨 Un banco che misura ZERO resta verde: queste guardano il sorgente dell'edge, non la
//    regola, e fermano i modi in cui questa funzione può fare danno.
const guardie = [
  ['la regola esiste ed è quella estratta', typeof motivoDelRifiuto === 'function'],
  ['il ponte resta disarmato senza segreto', /CONSUMER_BRIDGE_SECRET/.test(src) && /BRIDGE_DISARMED/.test(src)],
  ['il segreto si confronta in tempo costante', /function safeEqual/.test(src) && /diff \|= ab\[i\] \^ bb\[i\]/.test(src)],
  // 🚨 IL CABLAGGIO: la regola è pura, e una regola che nessuno chiama resta verde senza
  //    difendere niente. Qui si misura che l'edge la CHIAMI, e che il rifiuto FERMI la
  //    scrittura invece di limitarsi a comparire nella risposta.
  ['l\'edge CHIAMA la regola', /const rifiuto = motivoDelRifiuto\(scelta, scheda, elencoSchede\)/.test(src)],
  ['il rifiuto FERMA la scrittura', src.indexOf('if (rifiuto)') < src.indexOf(".update({ member_decision: scelta")],
  // 🚨 Il gettone da solo non basta: una scelta scritta su fede del solo gettone
  //    permetterebbe a un client confuso di decidere per la persona sbagliata.
  ['il gettone deve essere del socio che chiede', /member_local_id\) !== memberId/.test(src)],
  // ⚖️ Questa funzione scrive DUE colonne e nient'altro: il livello lo scrive il cron, e
  //    una scrittura sull'anagrafica da qui salterebbe tutte le protezioni del ③.
  ['scrive solo la scelta, mai il livello del socio', !/pmo_cloud_records/.test(src) && !/levelSource/.test(src)],
  ['non promette quando il livello sarà scritto', !/livello_applicato: true/.test(src)],
  // 🚨 Due schede sullo stesso gettone non dovrebbero esistere: se succede non si sceglie a
  //    caso — è la stessa difesa dell'ambiguità del readmodel e del link.
  ['sull\'ambiguo non sceglie', /AMBIGUA/.test(src)],
  ['la regola del giro arriva dal modulo, non da una copia locale', /from '\.\/giro-del-test\.ts'/.test(src) && !/function laProvaEsaurisceIlGiro/.test(src)],
  // 🚨⭐⭐ DA QUI IN GIÙ SI GUARDA `codice`, NON `src` — e non è pignoleria: la prima stesura
  // di queste guardie cercava i nomi dentro il FILE, e i commenti che spiegano la cura li
  // contengono tutti. Sabotaggio fatto: tolto il lancio vero, la guardia restava verde perché
  // il nome era ancora scritto lì sopra. ⇒ Una guardia che legge le parole invece dei fatti è
  // esattamente l'errore da cui questo progetto si difende dappertutto, e qui difendeva niente.
  // ⚡ VOCE 84 ⓒ (24/08/2026) — «se non lo trova variato è un disservizio» (parole sue).
  // Il livello non aspetta più il cron dei 15 minuti: su «mi fermo» il giro parte SUBITO.
  ['su «mi fermo» il giro d\'applicazione parte subito', /pmo_dispatch_assessment_apply_level/.test(codice)],
  ['il giro parte SOLO su «mi fermo» (su «riprovo» non c\'è niente da applicare)',
    /scelta === SCELTA_MI_FERMO[\s\S]{0,900}pmo_dispatch_assessment_apply_level/.test(codice)],
  // 🔒 Non si ricopia la regola dell'applicazione: quelle vivono in `assessment-apply-level`,
  // e una seconda copia divergerebbe al primo ripensamento.
  // 🚨 Si guarda il CODICE, non il file: la prima stesura di questa guardia cadeva sul
  // COMMENTO che spiega perché la regola non va ricopiata — cioè leggeva le parole invece dei
  // fatti, che è esattamente l'errore da cui questo progetto si difende dappertutto.
  ['la regola dell\'applicazione NON è ricopiata qui',
    !/applied_level\s*:|applied_at\s*:|\.from\(.pmo_cloud_records.\)/.test(codice)],
  // 🔒 Si passa dal DISPATCHER, che legge il vault da sé: il segreto delle routine non deve
  // avere un secondo posto da cui uscire. Chiamare l'edge dritta vorrebbe dire portarcelo.
  ['non si chiama l\'edge dritta con un segreto in mano', !/x-pmo-routine-secret/.test(codice)],
  // ⚖️ La risposta al socio non aspetta il giro: la scelta è già scritta e vera. Se il giro
  // non parte si perde la fretta, non il fatto — quindi l'errore si logga e non esce.
  ['un giro fallito non fa fallire la risposta', /console\.error[\s\S]{0,140}giro d.applicazione non partito/.test(codice)],
];

test('BANCO — la risposta del socio: «ti fermi o riprovi?»', () => {
  console.log('\nBANCO — consumer-assessment-decision\n');
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
