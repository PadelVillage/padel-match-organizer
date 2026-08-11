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
const SORGENTE = join(QUI, '..', 'supabase', 'functions', 'assessment-apply-level', 'index.ts');
const src = readFileSync(SORGENTE, 'utf8');

// Stesso estrattore degli altri banchi: salta i commenti (in italiano sono pieni di
// apostrofi) e parte dopo la lista dei parametri.
function estrai(nome) {
  const inizio = src.indexOf(`function ${nome}(`);
  if (inizio < 0) throw new Error(`funzione «${nome}» non trovata nell'edge`);
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
const spoglia = (codice) => codice.replace(/([(,]\s*\w+)\s*:\s*any\b/g, '$1');

const ctx = { FONTE: 'autovalutazione' };
vm.createContext(ctx);
vm.runInContext(
  spoglia(['clean', 'numero', 'quando', 'livelloDellaScheda', 'decidi', 'payloadAggiornato'].map(estrai).join('\n')),
  ctx
);
const { decidi, payloadAggiornato } = ctx;

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

caso('8. il test di conoscenza: fallito no, passato sì, ASSENTE sì (le schede vecchie non ce l\'hanno)', () => {
  const conTest = (status) => scheda({ raw_response: { source: 'scheda-pubblica', knowledge: { status, correct: 2, total: 4 } } });
  return [
    decidi(conTest('fail'), socio()).applica === false,
    decidi(conTest('pass'), socio()).applica === true,
    decidi(scheda(), socio()).applica === true,   // nessun `knowledge`: come prima
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

// ── GUARDIE SULLA BASE ──────────────────────────────────────────────────────────
// 🚨 Un banco che misura ZERO resta verde: queste guardano il sorgente dell'edge, non la
//    regola, e fermano i tre modi in cui questa funzione può fare danno.
const guardie = [
  ['la regola esiste ed è quella estratta', typeof decidi === 'function' && typeof payloadAggiornato === 'function'],
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
];

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
