// ── I SABOTAGGI del ⑥: ogni porta del promemoria gentile, spenta una per volta ─────────
//
// 🚨⭐⭐ PERCHÉ ESISTE QUESTO FILE. Un banco verde non dimostra niente finché non lo si
// sabota. Il 19/08, nel ④, DUE guardie sono risultate rotte e a trovarle non è stata una
// rilettura: una cercava le stringhe di un ramo e le trovava **anche col ramo spento**
// (`if (false)`), e il sabotaggio passava VERDE. *Una guardia che cerca una parola prova
// che la parola c'è, non che il codice succeda.*
//
// 🚨🚨 E LA GUARDIA «IL SABOTAGGIO È ATTERRATO?» VA SABOTATA ANCHE LEI. L'atterraggio si
// misura contro il FILE DI PRIMA (una copia su disco, confronto byte per byte), mai contro
// `git diff`: col lavoro non ancora commesso `git diff` risponde «sì è cambiato» anche a
// sabotaggio NON applicato, cioè certifica il lavoro invece del sabotaggio. In fondo alla
// serie gira un sabotaggio che NON TOCCA NIENTE, dichiarato tale, che DEVE risultare non
// atterrato: se risultasse atterrato, i dieci rossi qui sopra non varrebbero niente.
//
// ⚖️ QUI I SABOTAGGI SPENGONO QUASI TUTTI UN **SILENZIO**, ed è la natura di questa regola:
// il promemoria è un messaggio che nessuno ha chiesto, quindi ogni porta è un «non parlare»
// e ogni sabotaggio fa **parlare a sproposito** — a chi il livello ce l'ha, a chi il test non
// lo può rifare, a chi ha una domanda in sospeso, a chi la scheda ce l'ha già dal maestro.
//
// Uso:  node test/sabotaggi-voce-61-sei.mjs

import { readFileSync, writeFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = join(QUI, '..');
const FUNZIONI = join(RADICE, 'supabase', 'functions');

const MODULO = join(FUNZIONI, 'consumer-assessment-link', 'promemoria-livello.ts');
const PONTE = join(FUNZIONI, 'consumer-assessment-link', 'index.ts');
const LIVELLO_READMODEL = join(FUNZIONI, 'consumer-player-readmodel', 'livello-dimostrato.ts');

const BANCHI = { link: 'test/consumer-assessment-link.test.mjs' };

// `nullo: true` marca il sabotaggio che non tocca niente: è il controllo del metro.
const SABOTAGGI = [
  {
    nome: '① il promemoria arriva anche a chi il livello CE L\'HA',
    difende: 'la domanda non lo riguarda: sarebbe il bot che ricorda una cosa già fatta',
    file: [MODULO],
    da: '  if (dati.haIlLivello === true) return { dovuto: false, motivo: MOTIVO_HA_LIVELLO, ...comune };',
    a: '  if (false) return { dovuto: false, motivo: MOTIVO_HA_LIVELLO, ...comune };',
    banchi: ['link'],
  },
  {
    nome: '② il promemoria arriva anche a chi è in ATTESA',
    difende: 'il vicolo cieco: «fai il test» a chi il test non lo può rifare per trenta giorni',
    file: [MODULO],
    da: "  if (dati.ammesso !== true) return { dovuto: false, motivo: MOTIVO_IN_ATTESA, ...comune };",
    a: "  if (false) return { dovuto: false, motivo: MOTIVO_IN_ATTESA, ...comune };",
    banchi: ['link'],
  },
  {
    nome: '③ 🚨 il promemoria arriva a chi ha una DOMANDA IN SOSPESO (il ④)',
    difende: 'IL PEGGIO: sollecitare il test mentre il bot aspetta la risposta alla domanda di prima',
    file: [MODULO],
    da: '  if (ultima >= casella.inizioMs) return { dovuto: false, motivo: MOTIVO_SCHEDA_RECENTE, ...comune };',
    a: '  if (false) return { dovuto: false, motivo: MOTIVO_SCHEDA_RECENTE, ...comune };',
    banchi: ['link'],
  },
  {
    nome: '④ il promemoria arriva a chi ha una scheda `skip` (la guarda il maestro)',
    difende: 'a Semi-Pro e Professionista «rifai il test» sarebbe FALSO: il test l\'hanno fatto',
    file: [MODULO],
    da: "  if (String(dati.ultimoEsito ?? '').trim() === 'skip') {",
    a: "  if (false) {",
    banchi: ['link'],
  },
  {
    nome: '⑤ una data di scheda illeggibile smette di valere silenzio',
    difende: 'il dubbio vale silenzio: senza la data non si può dire se la scheda è di questa casella',
    file: [MODULO],
    da: '  if (!Number.isFinite(ultima)) return { dovuto: false, motivo: MOTIVO_DATA_ILLEGGIBILE, ...comune };',
    a: '  if (false) return { dovuto: false, motivo: MOTIVO_DATA_ILLEGGIBILE, ...comune };',
    banchi: ['link'],
  },
  {
    nome: '⑥ la casella non contiene più il suo istante (`floor` diventa `ceil`)',
    difende: 'una casella che non contiene l\'adesso darebbe la chiave della casella SBAGLIATA',
    file: [MODULO],
    da: '  const indice = Math.floor((t - epoca) / passo);',
    a: '  const indice = Math.ceil((t - epoca) / passo);',
    banchi: ['link'],
  },
  {
    nome: '⑦ la cadenza cambia: tutte le settimane invece di due volte al mese',
    difende: 'la sua frase: «magari non tutte le settimane, ma un paio di volte al mese»',
    file: [MODULO],
    da: 'export const GIORNI_TRA_PROMEMORIA = 15;',
    a: 'export const GIORNI_TRA_PROMEMORIA = 7;',
    banchi: ['link'],
  },
  {
    nome: '⑧ 🚨 il ponte smette di guardare il livello VERO e lo dichiara sempre assente',
    difende: 'il cablaggio: la regola resterebbe intatta e INERTE, e il promemoria andrebbe a TUTTI',
    file: [PONTE],
    da: '    haIlLivello: livelloDimostrato(payload.level, payload.levelSource),',
    a: '    haIlLivello: false,',
    banchi: ['link'],
  },
  {
    nome: '⑨ il promemoria sparisce da UNA delle due strade della risposta',
    difende: 'il bot deve leggere la risposta allo stesso modo dalla strada dell\'attesa e da quella del link',
    file: [PONTE],
    da: '      promemoria,\n    });',
    a: '    });',
    banchi: ['link'],
  },
  {
    nome: '⑩ le due copie di `livello-dimostrato` divergono',
    difende: 'chi riceve il promemoria e chi può organizzare devono leggere «avere il livello» allo stesso modo',
    file: [LIVELLO_READMODEL],
    da: "export const LIVELLO_DA_DEFINIRE = '0.5';",
    a: "export const LIVELLO_DA_DEFINIRE = '0.6';",
    banchi: ['link'],
  },
  {
    nome: '⑪ 🧪 IL CONTROLLO DEL METRO — non tocca NIENTE, e deve risultare NON ATTERRATO',
    difende: 'la guardia dell\'atterraggio: se questo risultasse atterrato, i dieci rossi sopra non varrebbero niente',
    nullo: true,
    file: [MODULO],
    da: 'export const GIORNI_TRA_PROMEMORIA = 15;',
    a: 'export const GIORNI_TRA_PROMEMORIA = 15;',
    banchi: ['link'],
  },
];

// ── Il giro ─────────────────────────────────────────────────────────────────────
const rifugio = mkdtempSync(join(tmpdir(), 'sabotaggi-61-sei-'));
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

// 🚨 L'ATTERRAGGIO si misura contro il FILE DI PRIMA, non contro `git diff`.
function atterrato(file) {
  return readFileSync(file, 'utf8') !== readFileSync(originali.get(file), 'utf8');
}

function bancoVerde(chiave) {
  try {
    execFileSync('node', ['--test', BANCHI[chiave]], { cwd: RADICE, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

console.log('\n🔪 SABOTAGGI DEL ⑥ — ogni porta del promemoria spenta una per volta\n');

let rossi = 0;
for (const [chiave, percorso] of Object.entries(BANCHI)) {
  const verde = bancoVerde(chiave);
  console.log(`  ${verde ? '✅' : '❌'} banco di partenza verde: ${percorso}`);
  if (!verde) rossi++;
}
if (rossi) {
  console.log('\n⛔ Il banco non è verde da fermo: i sabotaggi non misurerebbero niente.\n');
  rmSync(rifugio, { recursive: true, force: true });
  process.exit(1);
}
console.log('');

for (const s of SABOTAGGI) {
  const files = Array.isArray(s.file) ? s.file : [s.file];
  files.forEach(salva);

  let applicatoOvunque = true;
  for (const f of files) {
    const testo = readFileSync(f, 'utf8');
    if (!testo.includes(s.da)) {
      console.log(`❌ ${s.nome}\n   il testo da sostituire NON esiste in ${f.replace(RADICE + '/', '')} — il sabotaggio non descrive più il codice`);
      applicatoOvunque = false;
      break;
    }
    writeFileSync(f, testo.replace(s.da, s.a));
  }
  if (!applicatoOvunque) { ripristina(); rossi++; continue; }

  const cambiati = files.filter(atterrato).length;
  const eAtterrato = cambiati > 0;

  if (s.nullo) {
    const ok = !eAtterrato;
    console.log(`${ok ? '✅' : '❌'} ${s.nome}`);
    console.log(`   difende: ${s.difende}`);
    console.log(`   ${ok ? 'il metro dice NO a un sabotaggio che non tocca niente: funziona' : '🚨 IL METRO È ROTTO: dice «atterrato» a una sostituzione nulla'}`);
    if (!ok) rossi++;
    ripristina();
    continue;
  }

  if (!eAtterrato) {
    console.log(`❌ ${s.nome}\n   difende: ${s.difende}\n   il sabotaggio NON È ATTERRATO: il rosso (o il verde) che segue non vuol dire niente`);
    rossi++;
    ripristina();
    continue;
  }

  const visti = s.banchi.map((b) => ({ b, verde: bancoVerde(b) }));
  const visto = visti.some((v) => !v.verde);
  console.log(`${visto ? '✅' : '❌'} ${s.nome}`);
  console.log(`   difende: ${s.difende}`);
  console.log(`   atterrato su ${cambiati}/${files.length} file · banchi: ${visti.map((v) => `${v.b}=${v.verde ? 'verde' : 'ROSSO'}`).join(' ')}`);
  if (!visto) {
    console.log('   🚨 NESSUN BANCO LO HA VISTO: quella protezione non è provata da niente');
    rossi++;
  }
  ripristina();
}

ripristina();
rmSync(rifugio, { recursive: true, force: true });

console.log(`\n— ${SABOTAGGI.length - rossi} visti, ${rossi} sfuggiti su ${SABOTAGGI.length} —\n`);
process.exit(rossi ? 1 : 0);
