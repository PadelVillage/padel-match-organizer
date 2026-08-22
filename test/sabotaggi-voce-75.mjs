// ── I SABOTAGGI DELLA VOCE 75 (22/08/2026) ───────────────────────────────────────────────
//
// 🗣️ Segnalata dal committente dal vivo, col messaggio sullo schermo: *«Non trovo più quella
// partita fra le tue: può essere già cambiata nel frattempo… per questo serve la segreteria»* —
// venticinque secondi dopo che il bot gli aveva scritto «✅ Prenotato».
//
// ⚖️ La cura non è una frase: è non perdere un dato che il gestionale possiede già. La copia
// locale non veniva scritta perché sullo stesso slot giaceva la lapide di un annullo del
// mattino, e la guardia anti-fantasma usciva su `deleted === true` senza guardare altro.
//
// 🚨⭐⭐ PERCHÉ VA SABOTATA, e non basta rileggerla: quando questa regola è rotta **non rompe
// niente**. La prenotazione su Matchpoint riesce, il socio riceve «Prenotato», il sync qualche
// minuto dopo porta la riga e tutto sembra a posto. Il danno vive **nella finestra in mezzo**, e
// lo vede solo chi in quella finestra tocca un bottone — cioè un socio, non un banco.
//
// 🚨🚨 E LA GUARDIA «È ATTERRATO?» VA SABOTATA ANCHE LEI: in fondo alla serie gira un
// sabotaggio che NON TOCCA NIENTE, dichiarato tale, che DEVE risultare non atterrato.
//
// Uso:  node test/sabotaggi-voce-75.mjs

import { readFileSync, writeFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = join(QUI, '..');
const BANCO = 'test/scrivere-sopra-una-lapide.test.mjs';

const F = {
  modulo: join(RADICE, 'supabase/functions/matchpoint-bookings-create/lapide-prenotazione.js'),
  edge: join(RADICE, 'supabase/functions/matchpoint-bookings-create/index.ts'),
};

const SABOTAGGI = [
  {
    nome: '① 🚨🚨 IL DIFETTO DELLA 75: ogni lapide torna a valere «non scrivere»',
    difende: 'è il difetto esatto del 22/08 — riprenotando uno slot annullato la copia locale non nasceva, e il bot rinnegava una prenotazione appena confermata',
    file: F.modulo,
    da: '  if (!o?.lapide) return { si: true, motivo: \'nessuna_lapide\' };',
    a: '  if (o?.lapide) return { si: false, motivo: \'nessuna_lapide\' };\n  if (!o?.lapide) return { si: true, motivo: \'nessuna_lapide\' };',
  },
  {
    nome: '② l\'ORDINE si rovescia: si scrive sopra le lapidi ARRIVATE DOPO',
    difende: 'una lapide più recente dell\'inizio della scrittura può essere l\'annullo di ciò che stiamo scrivendo — resuscitarlo è il fantasma che la guardia esiste per fermare',
    file: F.modulo,
    da: '  return tSepoltura < tScrittura',
    a: '  return tSepoltura > tScrittura',
  },
  {
    nome: '③ si fallisce APERTI invece che chiusi quando gli istanti mancano',
    difende: 'senza confronto non si sa nulla, e i due errori non costano uguale: un «no» di troppo fa aspettare, un «sì» di troppo rimette in piedi un annullo',
    file: F.modulo,
    da: '  if (tSepoltura === null || tScrittura === null) return { si: false, motivo: \'istanti_ignoti\' };',
    a: '  if (tSepoltura === null || tScrittura === null) return { si: true, motivo: \'istanti_ignoti\' };',
  },
  {
    nome: '④ l\'ID smette di avere l\'ultima parola sullo stesso numero',
    difende: 'stesso `idReserva` vuol dire che la lapide è l\'annullo di QUESTA prenotazione: qualunque cosa dicano gli orologi, lì non si scrive',
    file: F.modulo,
    da: "      ? { si: false, motivo: 'stessa_prenotazione' }",
    a: "      ? { si: true, motivo: 'stessa_prenotazione' }",
  },
  {
    nome: '⑤ l\'id si legge con UN nome solo (`id_reserva`), non due',
    difende: 'le due estremità lo scrivono con nomi diversi: leggendone uno, metà delle lapidi risulta senza id e il confronto si spegne IN SILENZIO, cadendo sempre sull\'ordine',
    file: F.modulo,
    da: "  for (const chiave of ['id_reserva', 'idReserva']) {",
    a: "  for (const chiave of ['id_reserva']) {",
  },
  {
    nome: '⑥ il CABLAGGIO si stacca: l\'edge torna alla guardia cieca',
    difende: 'una regola giusta che nessuno chiama è un modulo, non una cura — e questo è il modo in cui il difetto tornerebbe intero col modulo ancora perfetto',
    file: F.edge,
    da: '  if (!verdettoLapide.si) return;',
    a: '  if (esistente?.deleted === true) return;',
  },
  {
    nome: '⑦ sopra una lapide si torna a FONDERE il payload',
    difende: 'i campi di una lapide sono quelli dell\'altra partita: fondendoli la prenotazione nuova nascerebbe col nome e i giocatori della morta — un difetto peggiore di quello curato',
    file: F.edge,
    da: '  const payload = esistente?.deleted === true ? nostro : fondiPayloadPrenotazione(nostro, giaScritto);',
    a: '  const payload = fondiPayloadPrenotazione(nostro, giaScritto);',
  },
  {
    nome: '⑧ 🧪 IL CONTROLLO DEL METRO: una sostituzione che NON tocca niente',
    difende: 'niente: serve a provare che la guardia «è atterrato?» sa dire di no',
    file: F.modulo,
    da: 'export function siPuoScrivereSopraLapide(o) {',
    a: 'export function siPuoScrivereSopraLapide(o) {',
    nullo: true,
  },
];

const rifugio = mkdtempSync(join(tmpdir(), 'sabotaggi-voce-75-'));
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
function bancoVerde() {
  try {
    execFileSync('node', [BANCO], { cwd: RADICE, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

console.log('\n🔪 SABOTAGGI: una lapide non vuol dire sempre la stessa cosa\n');

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
