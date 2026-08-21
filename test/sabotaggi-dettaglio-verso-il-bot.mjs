// ── I SABOTAGGI DEL DETTAGLIO CHE ESCE VERSO IL BOT (21/08/2026) ──────────────────────
//
// 🗣️ Regola ferrea del committente, 19/08: *«il worker il bot non deve proprio filarselo»* —
// né indirizzo, né stato, **né nome**. Quel giorno è stato curato il `reason`; il DETTAGLIO
// no, e il 21/08 alle 09:28 il registro del bot dei soci portava ancora, per intero,
// «Worker network error: error sending request for url (https://worker…/create-booking)».
//
// 🚨⭐⭐ PERCHÉ VA SABOTATO, e non basta rileggerlo: questa regola non rompe niente quando
// viene violata. Il bot funziona, il socio riceve una risposta, i banchi restano verdi — e il
// giorno in cui Matchpoint si spegne ci si accorge che metà delle frasi parlano di un pezzo
// che non esiste più. Un difetto che non fa rumore lo trova solo un colpo che lo rimette.
//
// 🚨🚨 E LA GUARDIA «È ATTERRATO?» VA SABOTATA ANCHE LEI: in fondo alla serie gira un
// sabotaggio che NON TOCCA NIENTE, dichiarato tale, che DEVE risultare non atterrato.
//
// Uso:  node test/sabotaggi-dettaglio-verso-il-bot.mjs

import { readFileSync, writeFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = join(QUI, '..');
const BANCO = 'supabase/functions/consumer-booking-write/esito-scrittura.test.ts';

const F = {
  modulo: join(RADICE, 'supabase/functions/consumer-booking-write/esito-scrittura.ts'),
  edge: join(RADICE, 'supabase/functions/consumer-booking-write/index.ts'),
};

const SABOTAGGI = [
  {
    nome: '① 🚨🚨 IL DIFETTO DEL 21/08: il dettaglio grezzo esce tale e quale',
    difende: 'l\'indirizzo del worker arriva nel registro del bot, e per i rifiuti non ignoti finisce come «spiegazione» al modello che scrive al socio',
    file: F.edge,
    da: 'detail: dettaglioPerIlBot(data?.message ?? data?.error ?? `HTTP ${res.status}`),',
    a: 'detail: String(data?.message ?? data?.error ?? `HTTP ${res.status}`),',
  },
  {
    nome: '② la ripulitura non riconosce più gli INDIRIZZI',
    difende: 'un url è un nome interno anche senza nessuna parola vietata dentro — ed è la forma esatta in cui il difetto si è presentato',
    file: F.modulo,
    da: '/worker|matchpoint|hetzner|playwright|caddy|nip\\.io|browser|https?:\\/\\//i',
    a: '/worker|matchpoint|hetzner|playwright|caddy|nip\\.io|browser/i',
  },
  {
    nome: '③ la ripulitura non riconosce più il nome del WORKER',
    difende: 'è il nome che il committente ha vietato per primo, e quello che compare nella riga vera del 21/08',
    file: F.modulo,
    da: '/worker|matchpoint|hetzner',
    a: '/hetzner',
  },
  {
    nome: '④ si RITAGLIA il pezzo colpevole invece di fermare tutto',
    difende: 'ritagliare lascia in piedi la metà che nessuno ha pensato di cercare: qui un mezzo successo vale zero',
    file: F.modulo,
    da: '  return (NOMI_INTERNI.test(testo) ? DETTAGLIO_SENZA_SPIEGAZIONE : testo).slice(0, 200);',
    a: '  return testo.replace(/https?:\\/\\/\\S+/g, \'\').slice(0, 200);',
  },
  {
    nome: '⑤ la guardia diventa una MUSERUOLA: non esce più nessun dettaglio',
    difende: 'cancellare tutto protegge la regola togliendo l\'unica cosa che il dettaglio serve a dare, cioè il perché',
    file: F.modulo,
    da: '  if (!testo) return \'\';\n  return (NOMI_INTERNI.test(testo)',
    a: '  if (!testo) return \'\';\n  return (true',
  },
  {
    nome: '⑥ il GREZZO non si scrive più nemmeno nel log dell\'edge',
    difende: 'curare la regola perdendo la diagnosi: il dettaglio pulito non basta a capire cos\'è successo, e il posto giusto per il grezzo è il log di qui',
    file: F.edge,
    da: 'console.error(`[booking-write] create ESITO IGNOTO (nessuna risposta dal gestionale): ${testo}`);',
    a: '',
  },
  {
    nome: '⑦ 🧪 IL CONTROLLO DEL METRO: una sostituzione che NON tocca niente',
    difende: 'niente: serve a provare che la guardia «è atterrato?» sa dire di no',
    file: F.modulo,
    da: 'export function dettaglioPerIlBot(grezzo: unknown): string {',
    a: 'export function dettaglioPerIlBot(grezzo: unknown): string {',
    nullo: true,
  },
];

const rifugio = mkdtempSync(join(tmpdir(), 'sabotaggi-dettaglio-'));
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
// ⭐ Il banco è uno script con i suoi contatori, non `node --test`: si guarda il codice
// d'uscita, che è la cosa che il banco DICHIARA quando qualcosa fallisce.
function bancoVerde() {
  try {
    execFileSync('node', [BANCO], { cwd: RADICE, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

console.log('\n🔪 SABOTAGGI: il nome del worker non arriva al bot\n');

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
