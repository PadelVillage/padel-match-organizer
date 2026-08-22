// ── I SABOTAGGI DELLA VOCE 72 (22/08/2026) ───────────────────────────────────────────
//
// 🗣️ Segnalata dal committente dal vivo: *«ho ricevuto un messaggio dopo aver provato la prima
// prenotazione che non è andata a buon fine che diceva che la segreteria non ha dato la
// spiegazione. Il messaggio potrebbe essere ancora più carino verso il socio… quello di
// riprovare»*.
//
// ⚖️ La cura NON è la frase: è ciò che la rende lecita. Dire «riprova» si può solo dove si sa
// che la prenotazione non è passata — e fino al 22/08 non si sapeva, perché il timeout della
// coda del worker arrivava qui come un rifiuto pur essendo un «non lo so».
//
// 🚨⭐⭐ PERCHÉ VA SABOTATA, e non basta rileggerla: questa regola, quando è rotta, **non rompe
// niente**. La prenotazione fallisce lo stesso, il socio riceve lo stesso una risposta, i banchi
// restano verdi. Il danno arriva un piano più in là e a casa di qualcun altro: il socio rifà,
// e il campo del circolo resta occupato DUE volte. Un difetto che non fa rumore lo trova solo
// un colpo che lo rimette.
//
// 🚨🚨 E LA GUARDIA «È ATTERRATO?» VA SABOTATA ANCHE LEI: in fondo alla serie gira un
// sabotaggio che NON TOCCA NIENTE, dichiarato tale, che DEVE risultare non atterrato.
//
// Uso:  node test/sabotaggi-voce-72.mjs

import { readFileSync, writeFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = join(QUI, '..');
const BANCO = 'test/tre-esiti-prenotazione.test.mjs';

const F = {
  modulo: join(RADICE, 'supabase/functions/matchpoint-bookings-create/esito-prenotazione.js'),
  edge: join(RADICE, 'supabase/functions/matchpoint-bookings-create/index.ts'),
};

const SABOTAGGI = [
  {
    nome: '① 🚨🚨 IL DIFETTO DELLA 72: il timeout della coda torna a essere un «no»',
    difende: 'il worker smette di aspettare un\'operazione ancora in corso; se il click su «Salvare» era partito, la prenotazione c\'è — e chiamarla rifiutata manda il socio a farne una seconda',
    file: F.modulo,
    da: "  'SAVE_BUTTON_NOT_FOUND',\n]);",
    a: "  'SAVE_BUTTON_NOT_FOUND',\n  'QUEUE_JOB_TIMEOUT',\n]);",
  },
  {
    nome: '② l\'elenco si ROVESCIA: si elencano gli ignoti invece dei certi',
    difende: 'un elenco al contrario fallisce APERTA — ogni codice futuro, cioè ogni guasto di cui non si sa niente, uscirebbe come «non è passata»',
    file: F.modulo,
    da: "  if (!CODICI_FALLIMENTO_CERTO.has(codice)) return 'ignoto';",
    a: "  if (codice === 'QUEUE_JOB_TIMEOUT') return 'ignoto';",
  },
  {
    nome: '③ la crepa dentro SAVE_BUTTON_NOT_FOUND si richiude',
    difende: 'lo stesso codice racconta due fatti opposti — «nessun bottone c\'era» e «ho premuto e non so com\'è finita» — e solo il secondo è un ignoto',
    file: F.modulo,
    da: "  return tentativi.some((t) => t && typeof t === 'object' && String(t.action || '') === 'save_attempt');",
    a: '  return false;',
  },
  {
    nome: '④ il CABLAGGIO si stacca: l\'edge non fabbrica più l\'errore marchiato',
    difende: 'una regola giusta che nessuno chiama è un modulo, non una cura: senza il marchio il caso non entra nella macchina dell\'esito ignoto (voce 23 + voce 53)',
    file: F.edge,
    da: "  if (esitoDellaRispostaWorker(body) === 'ignoto') throw erroreEsitoIgnoto(testo);",
    a: '',
  },
  {
    nome: '⑤ 🧪 IL CONTROLLO DEL METRO: una sostituzione che NON tocca niente',
    difende: 'niente: serve a provare che la guardia «è atterrato?» sa dire di no',
    file: F.modulo,
    da: 'export function esitoDellaRispostaWorker(corpo) {',
    a: 'export function esitoDellaRispostaWorker(corpo) {',
    nullo: true,
  },
];

const rifugio = mkdtempSync(join(tmpdir(), 'sabotaggi-voce-72-'));
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
// ⭐ Il banco è uno script coi suoi contatori, non `node --test`: si guarda il codice d'uscita,
// che è la cosa che il banco DICHIARA quando qualcosa fallisce.
function bancoVerde() {
  try {
    execFileSync('node', [BANCO], { cwd: RADICE, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

console.log('\n🔪 SABOTAGGI: un rifiuto del worker non è per forza un fallimento\n');

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
