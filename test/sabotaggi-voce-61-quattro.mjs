// ── I SABOTAGGI del ④: ogni protezione nuova, spenta una per volta ────────────────────
//
// 🚨⭐⭐ PERCHÉ ESISTE QUESTO FILE. Un banco verde non dimostra niente finché non lo si
// sabota: il 18/08 il banco era verde con CINQUE difetti di punteggiatura accesi, e un
// sabotaggio del ⑤ era passato verde perché il caso girava sull'input comodo. *Un caso che
// gira sul ramo felice non è una difesa: è una difesa mai attaccata.*
//
// 🚨🚨 E LA GUARDIA «IL SABOTAGGIO È ATTERRATO?» VA SABOTATA ANCHE LEI — costava già una
// volta: la prima stesura lo chiedeva a `git diff`, che col lavoro non commesso risponde
// «sì è cambiato» anche a sabotaggio NON applicato ⇒ certificava il lavoro invece del
// sabotaggio. Qui si confronta col FILE DI PRIMA (una copia su disco, `cmp` byte per byte),
// e in fondo gira un sabotaggio che NON TOCCA NIENTE — dichiarato tale — che DEVE risultare
// non atterrato. Se anche quello risultasse atterrato, il metro sarebbe rotto e i rossi
// degli altri non varrebbero niente.
//
// Uso:  node test/sabotaggi-voce-61-quattro.mjs

import { readFileSync, writeFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = join(QUI, '..');
const FUNZIONI = join(RADICE, 'supabase', 'functions');

const COPIE_GIRO = ['consumer-assessment-link', 'assessment-apply-level', 'consumer-assessment-decision']
  .map((fn) => join(FUNZIONI, fn, 'giro-del-test.ts'));

const BANCHI = {
  link: 'test/consumer-assessment-link.test.mjs',
  apply: 'test/assessment-apply-level.test.mjs',
  decision: 'test/consumer-assessment-decision.test.mjs',
};

// ── I sabotaggi ─────────────────────────────────────────────────────────────────
// Ognuno spegne UNA protezione. `nullo: true` marca quello che non tocca niente: è il
// controllo del metro, e DEVE risultare «non atterrato».
// ⚠️ `file` è uno solo, ma per il modulo del giro la sostituzione va fatta su TUTTE E TRE
// le copie: altrimenti a diventare rossa sarebbe la guardia dell'uguaglianza fra copie —
// un rosso vero, ma per il motivo sbagliato, che è il modo più elegante di illudersi.
const SABOTAGGI = [
  {
    nome: '① la conferma non chiude più il giro («mi fermo» ignorato)',
    difende: 'la sua regola: «decidi tu a quale delle tre volte ti vuoi fermare»',
    file: COPIE_GIRO,
    da: "} else if (sceltaDellaProva(s) === SCELTA_MI_FERMO) {",
    a: "} else if (false) {",
    banchi: ['link'],
  },
  {
    nome: '② l\'ordine si inverte: la conferma vince sull\'esaurimento',
    difende: 'chi risponde alla domanda della terza prova non deve aspettare PIÙ di chi la ignora',
    file: COPIE_GIRO,
    da: `    if (corrente.length >= provePerGiro) {
      chiusi.push({ motivo: 'esaurito', chiusoIl: String(s?.submitted_at ?? '').trim(), falliti, prove: corrente });
      corrente = [];
    } else if (sceltaDellaProva(s) === SCELTA_MI_FERMO) {
      chiusi.push({ motivo: 'confermato', chiusoIl: String(s?.member_decision_at ?? '').trim(), falliti, prove: corrente });
      corrente = [];
    }`,
    a: `    if (sceltaDellaProva(s) === SCELTA_MI_FERMO) {
      chiusi.push({ motivo: 'confermato', chiusoIl: String(s?.member_decision_at ?? '').trim(), falliti, prove: corrente });
      corrente = [];
    } else if (corrente.length >= provePerGiro) {
      chiusi.push({ motivo: 'esaurito', chiusoIl: String(s?.submitted_at ?? '').trim(), falliti, prove: corrente });
      corrente = [];
    }`,
    banchi: ['link'],
  },
  {
    nome: '③ l\'automatismo torna a decidere da solo (il ④ spento del tutto)',
    difende: 'IL CUORE: prima di oggi il livello si applicava entro 15′ senza chiedere niente al socio',
    file: [join(FUNZIONI, 'assessment-apply-level', 'index.ts')],
    da: '  if (knowledge) {\n    const scelta = clean(scheda?.member_decision);',
    a: '  if (false) {\n    const scelta = clean(scheda?.member_decision);',
    banchi: ['apply'],
  },
  {
    nome: '④ «riprovo» smette di valere per sempre (lo scavalcano le 24 ore)',
    difende: 'una risposta è una risposta: applicare il livello rifiutato renderebbe finta la domanda',
    file: [join(FUNZIONI, 'assessment-apply-level', 'index.ts')],
    da: "    if (scelta === SCELTA_RIPROVO) {",
    a: "    if (scelta === '__mai__') {",
    banchi: ['apply'],
  },
  {
    nome: '⑤ il silenzio non è più assenso: si aspetta per sempre',
    difende: 'la porta chiusa in faccia — un socio a 0,5 che ignora la domanda resterebbe senza livello',
    file: [join(FUNZIONI, 'assessment-apply-level', 'index.ts')],
    da: '      if (!(eta >= ORE_SILENZIO_ASSENSO * 60 * 60 * 1000)) {',
    a: '      if (true) {',
    banchi: ['apply'],
  },
  /* 🔄 26/08/2026 — QUI C'ERA IL ⑥ («la terza prova non si applica più da sola»), ed è stato
     TOLTO perché non produce più un rosso: con `ORE_SILENZIO_ASSENSO = 0` (sua decisione, la
     variazione è immediata) il controllo dell'età alla riga sotto è sempre soddisfatto, quindi
     il ramo dell'attesa non si prende MAI e sabotare la condizione che ci porta non cambia
     nessun esito.
     ⚖️ Non è una protezione indebolita: è una porta che non esiste più. Lo stesso è già
     successo il 25/08 a `GIORNI_DI_ATTESA`, e la scelta lì fu la stessa — mettere a zero
     invece di cancellare, così il ramo resta e rimetterlo è cambiare un numero.
     🚨 SE UN DOMANI L'ATTESA TORNA (`ORE_SILENZIO_ASSENSO` diverso da zero), questo sabotaggio
     va rimesso: senza, la regola «arrivare alla terza È essersi fermati alla terza» (sua
     risposta del 19/08) resterebbe scritta e non sorvegliata.
     📌 Un sabotaggio che non fa più rosso non si lascia lì: passerebbe verde dichiarando di
     difendere qualcosa, ed è peggio di non averlo. */
  {
    nome: '⑦ il bottone vecchio di Telegram torna a funzionare (scheda superata accettata)',
    difende: 'la scelta si fa sull\'ULTIMA prova: una scelta sul passato riscrive la storia del giro',
    file: [join(FUNZIONI, 'consumer-assessment-decision', 'index.ts')],
    da: "    if ((e === 'pass' || e === 'fail') && quandoMs(s?.submitted_at) > quandoScheda) return 'SCHEDA_SUPERATA';",
    a: "    if (false) return 'SCHEDA_SUPERATA';",
    banchi: ['decision'],
  },
  {
    nome: '⑧ si può scegliere anche sulla terza prova RIUSCITA (e bloccarne l\'esito con «riprovo»)',
    difende: 'un «riprovo» sulla terza passata fermerebbe per sempre un livello che deve essere scritto',
    file: [join(FUNZIONI, 'consumer-assessment-decision', 'index.ts')],
    da: "  if (provaSuperata && laProvaEsaurisceIlGiro(elenco, scheda, TENTATIVI_PER_GIRO)) return 'GIRO_FINITO';",
    a: "  if (false) return 'GIRO_FINITO';",
    banchi: ['decision'],
  },
  {
    nome: '⑨ su una prova non riuscita passa QUALUNQUE scelta, non solo il «mi fermo»',
    difende: 'su una bocciatura l\'unica scelta che ha un fatto dietro è tenersi il livello di adesso: ogni altra scriverebbe qualcosa che il test non ha dimostrato',
    file: [join(FUNZIONI, 'consumer-assessment-decision', 'index.ts')],
    da: "  if (!provaSuperata && !(cosa === SCELTA_MI_FERMO && esito === 'fail')) return 'PROVA_NON_PASSATA';",
    a: "  if (false) return 'PROVA_NON_PASSATA';",
    banchi: ['decision'],
  },
  {
    nome: '⑩ 🧪 IL CONTROLLO DEL METRO — non tocca NIENTE, e deve risultare NON ATTERRATO',
    difende: 'la guardia dell\'atterraggio: se questo risultasse atterrato, i nove rossi qui sopra non varrebbero niente',
    nullo: true,
    file: [join(FUNZIONI, 'assessment-apply-level', 'index.ts')],
    da: '  if (knowledge) {',
    a: '  if (knowledge) {',
    banchi: ['apply'],
  },
];

// ── Il giro ─────────────────────────────────────────────────────────────────────
const rifugio = mkdtempSync(join(tmpdir(), 'sabotaggi-61-'));
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

// 🚨 L'ATTERRAGGIO si misura contro il FILE DI PRIMA, non contro `git diff`: col lavoro non
// ancora commesso `git diff` risponde «sì è cambiato» anche a sabotaggio non applicato.
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

console.log('\n🔪 SABOTAGGI DEL ④ — ogni protezione spenta una per volta\n');

// Prima di tutto: i banchi devono essere VERDI da fermi, o un rosso non vorrebbe dire niente.
let rossi = 0;
for (const [chiave, percorso] of Object.entries(BANCHI)) {
  const verde = bancoVerde(chiave);
  console.log(`  ${verde ? '✅' : '❌'} banco di partenza verde: ${percorso}`);
  if (!verde) rossi++;
}
if (rossi) {
  console.log('\n⛔ I banchi non sono verdi da fermi: i sabotaggi non misurerebbero niente.\n');
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

  // ① È ATTERRATO? (col metro giusto: il file di prima)
  const cambiati = files.filter(atterrato).length;
  const eAtterrato = cambiati > 0;

  if (s.nullo) {
    // Il controllo del metro: DEVE risultare non atterrato.
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

  // ② Adesso che è atterrato: il banco lo vede?
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

// I file devono tornare come prima: un sabotaggio dimenticato sul disco è il peggior lascito.
ripristina();
let sporchi = 0;
for (const file of originali.keys()) if (atterrato(file)) sporchi++;
console.log(`\n${sporchi ? '❌' : '✅'} tutti i file ripristinati (${originali.size} toccati, ${sporchi} sporchi)`);
if (sporchi) rossi++;
rmSync(rifugio, { recursive: true, force: true });

const totale = SABOTAGGI.length;
console.log(`\n— ${totale - rossi} sabotaggi visti, ${rossi} problemi su ${totale} —\n`);
process.exit(rossi ? 1 : 0);
