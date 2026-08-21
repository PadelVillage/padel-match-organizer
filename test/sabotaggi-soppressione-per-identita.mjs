// ── I SABOTAGGI DELLA SOPPRESSIONE PER IDENTITÀ (21/08/2026) ────────────────────────────────
//
// 🚨⭐⭐ PERCHÉ VA SABOTATO, e i due versi non si equivalgono.
//
// Il verso RUMOROSO: la soppressione smette di nascondere ⇒ tornano le card fantasma dopo un
// annullo. Fastidioso, e qualcuno lo segnala.
// Il verso MUTO, che è quello che è costato la lezione di sabato: la soppressione nasconde
// TROPPO ⇒ una prenotazione vera sparisce e il campo sembra libero. Nessuno segnala una card
// che non c'è: la si scopre quando due persone si presentano sullo stesso campo. I colpi ①②③
// sono di questo verso.
//
// 🔪 E c'è il colpo ⑤, che è il più insidioso di tutti: NON tocca la decisione — spegne il
// posto in cui gli `idReserva` vengono RACCOLTI. La funzione continua a fare la cosa giusta su
// una lista sempre vuota, cioè ogni soppressione nasce cieca e il difetto torna intero mentre
// tutti i casi sulla decisione restano verdi.
//
// Uso:  node test/sabotaggi-soppressione-per-identita.mjs

import { readFileSync, writeFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = join(QUI, '..');
const BANCO = ['test/soppressione-per-identita.test.mjs'];
const APP = join(RADICE, 'index.html');

const SABOTAGGI = [
  {
    nome: '① 🚨🚨 IL DIFETTO DEL 21/08: la soppressione torna a nascondere lo SLOT',
    difende: 'la lezione delle 9 di sabato col maestro Lucas resta invisibile per mezz\'ora, e il campo sembra libero',
    da: '    return ids.indexOf(suo) >= 0;                       // nascondi SOLO la prenotazione annullata',
    a: '    return true;',
  },
  {
    nome: '② 🔇 la lista degli id viene ignorata: ogni soppressione è cieca',
    difende: 'stessa cosa del ①, ma da un\'altra riga: la cura si può spegnere sia in fondo sia in cima',
    da: "    const ids = Array.isArray(soppr.ids) ? soppr.ids.filter(Boolean).map(String) : null;",
    a: '    const ids = null;',
  },
  {
    nome: '③ 🔇 gli id si confrontano senza normalizzare il tipo',
    difende: 'l\'idReserva arriva a volte come numero e a volte come testo: confrontandoli crudi, la prenotazione annullata NON si riconosce più e la card fantasma resta',
    da: "    const suo = riga && riga.idReserva != null ? String(riga.idReserva).trim() : '';",
    a: '    const suo = riga && riga.idReserva != null ? riga.idReserva : \'\';',
  },
  {
    nome: '④ 📣 il verso opposto: una riga senza idReserva viene MOSTRATA',
    difende: 'manutenzioni e card vecchie non hanno un id: mostrarle vuol dire far tornare la card fantasma proprio dove non si può distinguere',
    da: "    if (!suo) return true;                              // riga senza identità: come prima",
    a: '    if (!suo) return false;',
  },
  {
    nome: '⑤ 🔇🔇 la RACCOLTA degli id si spegne: la decisione resta giusta su una lista sempre vuota',
    difende: 'il difetto torna INTERO mentre ogni caso sulla decisione resta verde — è la 43ª: il verde muto perché il dato non arriva mai fin lì',
    da: '        if (id && visti.indexOf(id) < 0) visti.push(id);',
    a: '        if (false) visti.push(id);',
  },
  {
    nome: '⑥ 🚨 qualcuno si scrive una soppressione a mano, fuori dal posto solo',
    difende: 'i punti che sopprimono sono tre: uno che se la scrivesse da sé nascerebbe senza `ids`, cioè col difetto del 21/08, in un punto che nessuno guarda',
    da: "      record_type: 'staff_suppress',",
    a: "      record_type: 'staff_suppress', // e un altro qui sotto:\n      _finto: { record_type: 'staff_suppress' },",
  },
  {
    nome: '⑦ 🧪 IL CONTROLLO DEL METRO: una sostituzione che NON tocca niente',
    difende: 'niente: serve a provare che la guardia «è atterrato?» sa dire di no',
    da: "    if (!soppr) return false;",
    a: "    if (!soppr) return false;",
    nullo: true,
  },
];

const rifugio = mkdtempSync(join(tmpdir(), 'sabotaggi-soppr-'));
const copia = join(rifugio, 'index.html');
copyFileSync(APP, copia);
const ripristina = () => copyFileSync(copia, APP);
// 🚨 L'atterraggio si misura contro il FILE DI PRIMA, mai con `git diff`.
const atterrato = () => readFileSync(APP, 'utf8') !== readFileSync(copia, 'utf8');
function bancoVerde() {
  try { execFileSync('node', BANCO, { cwd: RADICE, stdio: 'pipe' }); return true; }
  catch { return false; }
}

console.log('\n🔪 SABOTAGGI: la soppressione nasconde una prenotazione, non uno slot\n');

let rossi = 0;
if (!bancoVerde()) {
  console.log('⛔ Il banco non è verde da fermo: i sabotaggi non misurerebbero niente.\n');
  rmSync(rifugio, { recursive: true, force: true });
  process.exit(1);
}
console.log(`  ✅ banco di partenza verde: ${BANCO.join(' + ')}\n`);

for (const s of SABOTAGGI) {
  const testo = readFileSync(APP, 'utf8');
  if (!testo.includes(s.da)) {
    console.log(`❌ ${s.nome}\n   il testo da sostituire NON esiste più: il sabotaggio non descrive il codice`);
    rossi++;
    continue;
  }
  writeFileSync(APP, testo.replace(s.da, s.a));
  const eAtterrato = atterrato();

  if (s.nullo) {
    const ok = !eAtterrato;
    console.log(`${ok ? '✅' : '❌'} ${s.nome}`);
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
const sporco = atterrato();
console.log(`\n${sporco ? '❌ index.html NON ripristinato' : '✅ index.html ripristinato'}`);
if (sporco) rossi++;
rmSync(rifugio, { recursive: true, force: true });
console.log(`\n— ${SABOTAGGI.length - rossi} sabotaggi visti, ${rossi} problemi su ${SABOTAGGI.length} —\n`);
process.exit(rossi ? 1 : 0);
