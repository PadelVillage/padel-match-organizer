// ── I SABOTAGGI delle DUE NUMERAZIONI di Matchpoint (20/08/2026) ───────────────────────
//
// 🚨⭐⭐ PERCHÉ ESISTE. Il difetto che questi casi difendono è vissuto **mesi** con tutti i
// banchi verdi, e non l'ha trovato nessuna sonda: l'ha trovato una persona vera che toccava
// «Ci sto» sul telefono e si sentiva rispondere di no. La regola non era sbagliata — il
// worker distingue benissimo il codice cliente dall'id interno, e lo scrive nei suoi commenti
// — era **chi le passava il numero** a scambiarli, un piano più su.
//
// ⚖️ E la stessa malattia era già passata di qui: curata in `matchpoint-bookings-create` il
// 2/08, e non nel ramo `add`. Un difetto curato in un punto e non nell'altro torna dalla porta
// che nessuno guarda — perciò adesso la composizione sta in una funzione sola, e questi
// sabotaggi provano che quella funzione è davvero quella che il worker riceve.
//
// 🚨🚨 E LA GUARDIA «È ATTERRATO?» VA SABOTATA ANCHE LEI: l'atterraggio si misura contro il
// FILE DI PRIMA (copia su disco, byte per byte), mai con `git diff`, che col lavoro non
// commesso risponde «sì è cambiato» anche a sabotaggio non applicato. In fondo alla serie gira
// un sabotaggio che NON TOCCA NIENTE, dichiarato tale, che DEVE risultare non atterrato.
//
// Uso:  node test/sabotaggi-codice-cliente.mjs

import { readFileSync, writeFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = join(QUI, '..');
const BANCO = 'supabase/functions/consumer-booking-write/giocatore-da-aggiungere.test.ts';

const F = {
  modulo: join(RADICE, 'supabase/functions/consumer-booking-write/giocatore-da-aggiungere.ts'),
  edge: join(RADICE, 'supabase/functions/consumer-booking-write/index.ts'),
};

const SABOTAGGI = [
  {
    nome: '① 🚨🚨 IL DIFETTO DEL 19/08: il codice cliente riparte dentro `codice`',
    difende: 'per Lidia il worker confronta 1013 con l\'id interno 1034 e rifiuta — ogni volta, per chiunque',
    file: F.edge,
    da: `            add: [giocatoreDaAggiungere({
              nome: nomeSullaScheda,
              codiceCliente: codiceDaAggiungere,
              idInterno: schedaDaAggiungere.matchpointIdInterno,
            })],`,
    a: `            add: [{
              nome: nomeSullaScheda,
              ...(codiceDaAggiungere ? { codice: codiceDaAggiungere } : {}),
            }],`,
  },
  {
    nome: '② i due campi si scambiano DENTRO la funzione (la regola giusta, al contrario)',
    difende: 'la funzione esiste per tenere separate le due numerazioni: scambiarle lì è il difetto in casa sua',
    file: F.modulo,
    da: `    ...(codice ? { codice } : {}),
    ...(input.codiceCliente ? { codiceCliente: input.codiceCliente } : {}),`,
    a: `    ...(codice ? { codiceCliente: codice } : {}),
    ...(input.codiceCliente ? { codice: input.codiceCliente } : {}),`,
  },
  {
    nome: '③ un id interno storto passa lo stesso',
    difende: 'un id inventato riaprirebbe il confronto fra due numeri di due mondi diversi',
    file: F.modulo,
    da: "  return /^\\d{1,12}$/.test(s) ? s : '';",
    a: '  return s;',
  },
  {
    nome: '④ il campo assente esce come stringa VUOTA invece di non uscire',
    difende: 'chi legge il payload nel log deve vedere se la guardia è accesa: «vuoto» e «assente» si leggono diversi',
    file: F.modulo,
    da: '    ...(codice ? { codice } : {}),',
    a: '    codice,',
  },
  {
    nome: '⑤ la prova a vuoto torna a chiamare `codice` il codice cliente',
    difende: 'una prova a vuoto che riporta un numero deve dire QUALE numero è: il nome corto ha coperto lo scambio',
    file: F.edge,
    da: '          codice_cliente: codiceDaAggiungere,',
    a: '          codice: codiceDaAggiungere,',
  },
  {
    nome: '⑥ 🧪 IL CONTROLLO DEL METRO — non tocca NIENTE, e deve risultare NON ATTERRATO',
    difende: 'la guardia dell\'atterraggio: se questo risultasse atterrato, i cinque rossi non varrebbero niente',
    nullo: true,
    file: F.modulo,
    da: 'export function giocatoreDaAggiungere(',
    a: 'export function giocatoreDaAggiungere(',
  },
];

const rifugio = mkdtempSync(join(tmpdir(), 'sabotaggi-codice-'));
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

console.log('\n🔪 SABOTAGGI: il codice cliente e l\'id interno non si scambiano\n');

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
