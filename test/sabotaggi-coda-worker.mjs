// ── I SABOTAGGI DELLA CODA DEL WORKER (22/08/2026) ───────────────────────────────────
//
// La coda esiste per un'invariante che il worker DICHIARA nel proprio commento: «mai due
// sessioni Matchpoint in parallelo». Il 22/08 quattro endpoint la aggiravano, e il primo di
// loro è la chiamata del sync delle prenotazioni: ogni due minuti, tutto il giorno.
//
// 🚨⭐⭐ PERCHÉ VA SABOTATA, e non basta rileggerla: questa regola, quando è rotta, **non
// rompe niente subito**. Il worker risponde, le prenotazioni si fanno, i banchi restano verdi.
// Il danno è statistico e arriva ore dopo — un giro di sync saltato, una lettura del tabellone
// morta a 90 secondi, un browser chiuso sotto qualcun altro — e in quel momento nessuno lo
// collega più alla riga che l'ha causato. È rimasta rotta per mesi proprio per questo.
//
// 🚨🚨 E LA GUARDIA «È ATTERRATO?» VA SABOTATA ANCHE LEI: in fondo alla serie gira un
// sabotaggio che NON TOCCA NIENTE, dichiarato tale, che DEVE risultare non atterrato.
//
// Uso:  node test/sabotaggi-coda-worker.mjs

import { readFileSync, writeFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = join(QUI, '..');
const BANCO = 'tools/matchpoint-browser-worker/test/coda-priorita.test.mjs';

const F = {
  modulo: join(RADICE, 'tools/matchpoint-browser-worker/src/coda-priorita.mjs'),
  server: join(RADICE, 'tools/matchpoint-browser-worker/src/server.mjs'),
};

const SABOTAGGI = [
  {
    nome: '① 🚨🚨 IL DIFETTO DEL 22/08: il sync torna a scavalcare la coda',
    difende: 'è la chiamata di ogni due minuti: fuori dalla coda apre una seconda sessione Matchpoint sullo stesso unico account, tutto il giorno',
    file: F.server,
    da: "const result = await mpQueueRun(mpJobMeta('export-history', body), () => exportBookingHistoryWithBrowser(body));",
    a: '  const result = await exportBookingHistoryWithBrowser(body);',
  },
  {
    nome: '② 🚨 il peggiore dei quattro: /get-slots torna a prendere la pagina CONDIVISA fuori dalla coda',
    difende: 'non è una sessione di troppo: è la STESSA pagina di un altro job, e il suo release può chiuderne il browser sotto',
    file: F.server,
    da: "const result = await mpQueueRun(mpJobMeta('get-slots', body), () => getSlotsWithBrowser(body));",
    a: '  const result = await getSlotsWithBrowser(body);',
  },
  {
    nome: '③ i due livelli si appiattiscono: le sincronizzazioni tornano nel fondo',
    difende: 'senza il livello di mezzo il sync aspetta dietro il poller, che fa tre giri per volta — si toglierebbe la collisione pagandola con la freschezza della copia',
    file: F.modulo,
    da: "  if (MP_SYNC_OPS.has(op)) return PRIORITA.SINCRONIZZAZIONE;",
    a: '',
  },
  {
    nome: '④ l\'aggiunta di mezzo schiaccia quello di sopra: le persone non passano più davanti',
    difende: 'il modo sbagliato di aggiungere un livello è degradare quello che c\'era: chi ha toccato un bottone aspetta dietro un export',
    file: F.modulo,
    da: 'export const PRIORITA = { INTERATTIVA: 2, SINCRONIZZAZIONE: 1, FONDO: 0 };',
    a: 'export const PRIORITA = { INTERATTIVA: 1, SINCRONIZZAZIONE: 1, FONDO: 0 };',
  },
  {
    nome: '⑤ un\'op sconosciuta scavalca invece di aspettare',
    difende: 'il default per l\'ignoto dev\'essere il FONDO: un\'op nuova che passa davanti alle persone è un difetto silenzioso, una che aspetta un po\' no',
    file: F.modulo,
    da: '  return PRIORITA.FONDO;\n}',
    a: '  return PRIORITA.INTERATTIVA;\n}',
  },
  {
    nome: '⑥ 🚨 /poller/force-run finisce in coda: sarebbe uno STALLO del worker',
    difende: 'delega a runPollCycle, che i job li mette in coda lui: un job che aspetta altri job a concorrenza 1 ferma tutto',
    file: F.modulo,
    da: "  'handleHistoryExport', 'handleExport', 'handleSlotScheduleExport', 'handleGetSlots',",
    a: "  'handleHistoryExport', 'handleExport', 'handleSlotScheduleExport', 'handleGetSlots',\n  'handlePollerForceRun',",
  },
  {
    nome: '⑦ la regola torna ad avere una copia dentro server.mjs',
    difende: 'due copie della stessa tabella divergono al primo ripensamento, e il banco proverebbe quella che non gira',
    file: F.server,
    da: 'import { mpJobPriority } from \'./coda-priorita.mjs\';',
    a: 'function mpJobPriority(meta) { return (meta && meta.priority) || 0; }',
  },
  {
    nome: '⑧ 🧪 IL CONTROLLO DEL METRO: una sostituzione che NON tocca niente',
    difende: 'niente: serve a provare che la guardia «è atterrato?» sa dire di no',
    file: F.modulo,
    da: 'export function mpJobPriority(meta) {',
    a: 'export function mpJobPriority(meta) {',
    nullo: true,
  },
];

const rifugio = mkdtempSync(join(tmpdir(), 'sabotaggi-coda-'));
const originali = new Map();
function salva(file) {
  if (originali.has(file)) return;
  const copia = join(rifugio, Buffer.from(file).toString('hex'));
  copyFileSync(file, copia);
  originali.set(file, copia);
}
function ripristina() {
  for (const [file, copia] of originali) copyFileSync(copia, file);
}
function atterrato(file) {
  return readFileSync(file, 'utf8') !== readFileSync(originali.get(file), 'utf8');
}
// ⭐ Il banco è un file `node:test`: si guarda il codice d'uscita, che è ciò che dichiara.
function bancoVerde() {
  try {
    execFileSync('node', [BANCO], { cwd: RADICE, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

console.log('\n🔪 SABOTAGGI: chi apre un browser passa dalla coda, e in che ordine\n');

let rossi = 0;
if (!bancoVerde()) {
  console.log('⛔ Il banco non è verde da fermo: i sabotaggi non misurerebbero niente.\n');
  rmSync(rifugio, { recursive: true, force: true });
  process.exit(1);
}
console.log(`  ✅ banco di partenza verde: ${BANCO}\n`);

for (const s of SABOTAGGI) {
  salva(s.file);
  const testo = readFileSync(s.file, 'utf8');
  if (!testo.includes(s.da)) {
    console.log(`❌ ${s.nome}\n   il testo da sostituire NON esiste più: il sabotaggio non descrive il codice`);
    rossi++;
    continue;
  }
  writeFileSync(s.file, testo.replace(s.da, s.a));

  const eAtterrato = atterrato(s.file);

  if (s.nullo) {
    const ok = !eAtterrato;
    console.log(`${ok ? '✅' : '❌'} ${s.nome}`);
    console.log(`   difende: ${s.difende}`);
    console.log(`   ${ok ? 'il metro dice NO a una sostituzione nulla: funziona' : '🚨 IL METRO È ROTTO'}`);
    if (!ok) rossi++;
    ripristina();
    continue;
  }

  if (!eAtterrato) {
    console.log(`❌ ${s.nome}\n   difende: ${s.difende}\n   NON ATTERRATO: il rosso (o il verde) che segue non vuol dire niente`);
    rossi++;
    ripristina();
    continue;
  }

  const visto = !bancoVerde();
  console.log(`${visto ? '✅' : '❌'} ${s.nome}`);
  console.log(`   difende: ${s.difende}`);
  console.log(`   ${visto ? 'il banco lo vede: ROSSO' : '🚨 IL BANCO NON LO VEDE: quella protezione non è provata da niente'}`);
  if (!visto) rossi++;
  ripristina();
}

ripristina();
let sporchi = 0;
for (const file of originali.keys()) if (atterrato(file)) sporchi++;
console.log(`\n${sporchi ? '❌' : '✅'} tutti i file ripristinati (${originali.size} toccati, ${sporchi} sporchi)`);
if (sporchi) rossi++;
rmSync(rifugio, { recursive: true, force: true });

const totale = SABOTAGGI.length;
console.log(`\n— ${totale - rossi} sabotaggi visti, ${rossi} problemi su ${totale} —\n`);
process.exit(rossi ? 1 : 0);
