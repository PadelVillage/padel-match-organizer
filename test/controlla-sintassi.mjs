// ── CONTROLLO SINTASSI di index.html ─────────────────────────────────────────────
//
// 🚨 Perché esiste (33ª trappola, pagata dal vivo): un errore di sintassi — un `const`
//    dichiarato due volte, una graffa in più — non rompe una funzione: **spegne l'app
//    intera**, e nella console del browser non compare granché. Chi prova «non parte» a
//    mano ci mette mezz'ora; un parser lo dice in mezzo secondo.
//
// Che cosa fa: prende i blocchi <script> di `index.html` che contengono codice (non quelli
// con `src`, non i `type="application/json"` e simili) e li fa analizzare a Node. NON li
// esegue: cerca solo errori di sintassi.
//
// ⚠️ Ogni blocco si controlla DA SOLO: i blocchi condividono lo stesso ambito nel browser,
//    quindi un doppione fra blocchi diversi qui non si vede. Per quello c'è il controllo
//    sui nomi dichiarati due volte, in fondo.
//
// Uso:  node test/controlla-sintassi.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const INDEX = join(QUI, '..', 'index.html');
const html = readFileSync(INDEX, 'utf8');

// Numero di riga nel file, per dire DOVE invece di dire soltanto CHE.
const rigaDi = (indice) => html.slice(0, indice).split('\n').length;

const blocchi = [];
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let m;
while ((m = re.exec(html)) !== null) {
  const attributi = m[1] || '';
  const codice = m[2] || '';
  if (/\ssrc\s*=/i.test(attributi)) continue;                       // script esterno: niente da leggere
  const tipo = (/\stype\s*=\s*["']([^"']+)["']/i.exec(attributi) || [, ''])[1].toLowerCase();
  if (tipo && !/javascript|module|text\/js/.test(tipo)) continue;    // json, template, ecc.
  if (!codice.trim()) continue;
  blocchi.push({ codice, riga: rigaDi(m.index), modulo: tipo === 'module' });
}

// La lettura di UN blocco, isolata apposta: è la stessa funzione che usa il controllo vero
// e il controllo negativo qui sotto. Se fossero due copie, il negativo potrebbe restare
// verde mentre quello vero è cieco — cioè esattamente il guasto che deve impedire.
const erroreDiSintassi = (codice, nome) => {
  try {
    new vm.Script(codice, { filename: nome });
    return null;
  } catch (err) {
    return err.message;
  }
};

let errori = 0;
console.log(`CONTROLLO SINTASSI — ${blocchi.length} blocchi <script> in index.html\n`);
blocchi.forEach((b, i) => {
  const problema = erroreDiSintassi(b.codice, `index.html:blocco${i + 1}`);
  if (problema) {
    errori++;
    console.log(`❌ blocco ${i + 1} (riga ~${b.riga}): ${problema}`);
  } else {
    console.log(`✅ blocco ${i + 1} (riga ~${b.riga}) — ${b.codice.split('\n').length} righe`);
  }
});

// ── Nomi dichiarati DUE VOLTE nello stesso blocco ────────────────────────────────
// `const` e `let` doppi sono l'errore che spegne l'app. Dentro un blocco lo trova già il
// parser qui sopra; questo controllo aggiunge il caso più insidioso — due `const` con lo
// stesso nome al primo livello di **blocchi diversi**, che nel browser condividono l'ambito
// e quindi si scontrano, mentre analizzati uno per uno sono entrambi validi.
const dichiarazioniPrimoLivello = (codice) => {
  const nomi = [];
  codice.split('\n').forEach((r) => {
    const d = /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/.exec(r);   // ^ = colonna 0, primo livello
    if (d) nomi.push(d[1]);
  });
  return nomi;
};
const visti = new Map();
blocchi.forEach((b, i) => {
  dichiarazioniPrimoLivello(b.codice).forEach((nome) => {
    if (visti.has(nome)) {
      errori++;
      console.log(`❌ «${nome}» dichiarato al primo livello sia nel blocco ${visti.get(nome)} sia nel ${i + 1}: nel browser si scontrano`);
    } else visti.set(nome, i + 1);
  });
});

// ── 🚨⭐⭐ IL CONTROLLO NEGATIVO — e gira DA SÉ, senza che nessuno lo chieda ──────
//
// Perché esiste, e perché non è dietro un'opzione: un «0 errori» può voler dire due cose
// opposte — «il file è sano» oppure «questo attrezzo non sta guardando niente». Le due si
// leggono uguali, e la seconda arriva proprio nel momento in cui ci si fida di più.
// Basta un `re` che smette di agganciare i tag, un filtro sul `type` scritto al contrario,
// un `readFileSync` sul percorso sbagliato: nessuno di questi rompe niente, e tutti e tre
// producono un verde.
//
// ⇒ Prima di dire «tutto a posto», lo strumento si SABOTA da solo e pretende di
//   accorgersene. Se non ci riesce si dichiara CIECO e FALLISCE, invece di rassicurare.
//
// 🚑 I difetti sono appesi IN FONDO all'ultimo blocco, e non è un dettaglio: la prima
//    versione di questo controllo (7/08, nell'attrezzo poi perduto) raddoppiava il primo
//    apice inverso del file, e quel sabotaggio NON era deterministico — a seconda di dove
//    cadeva quell'apice, il codice restava valido e il controllo si dichiarava cieco per
//    sbaglio. Un difetto appeso in coda non si può chiudere in nessun modo.
//
// ⭐ Il primo dei due è l'apice inverso perché è il guasto VERO dell'8/08/2026: una stringa
//   template lasciata aperta, che spense l'app intera.
const SABOTAGGI = [
  { nome: 'stringa template lasciata aperta', coda: '\nconst _sabotaggio = `mai chiusa' },
  { nome: 'parentesi mai chiusa', coda: '\nconst _sabotaggio = (1 + ' },
];

const ultimo = blocchi[blocchi.length - 1];
if (!ultimo) {
  console.log('\n🚨 CIECO: non ho trovato NESSUN blocco <script> da controllare.');
  console.log('   Un file senza script non esiste in questo progetto: o è cambiato il modo');
  console.log('   di scriverli, o questo attrezzo non li aggancia più.');
  process.exit(1);
}

let cieco = false;
console.log('\n— controllo negativo: mi sabota da solo e deve accorgersene —');
SABOTAGGI.forEach((s) => {
  const visto = erroreDiSintassi(ultimo.codice + s.coda, 'controllo-negativo');
  if (visto) {
    console.log(`✅ ${s.nome}: visto (${visto.split('\n')[0]})`);
  } else {
    cieco = true;
    console.log(`🚨 ${s.nome}: NON VISTO`);
  }
});

// E lo stesso per l'altra metà: il controllo sui nomi doppi fra blocchi diversi. Ha una sua
// logica, quindi ha bisogno di un suo sabotaggio — quello sopra non lo tocca nemmeno.
const doppioneFinto = ['const cosiNonSiChiamaNiente = 1;', 'const cosiNonSiChiamaNiente = 2;'];
const nomiA = dichiarazioniPrimoLivello(doppioneFinto[0]);
const nomiB = dichiarazioniPrimoLivello(doppioneFinto[1]);
if (nomiA.length && nomiB.length && nomiA[0] === nomiB[0]) {
  console.log('✅ nome dichiarato due volte in blocchi diversi: visto');
} else {
  cieco = true;
  console.log('🚨 nome dichiarato due volte in blocchi diversi: NON VISTO');
}

if (cieco) {
  console.log('\n🚨🚨 QUESTO ATTREZZO È CIECO — non fidarti del suo verde.');
  console.log('   Non ha visto un difetto che DEVE vedere: qualunque cosa dica sopra sui');
  console.log('   blocchi di index.html non ha valore. Riparalo prima di promuovere.');
  process.exit(2);
}

console.log(`\n— ${blocchi.length} blocchi controllati, ${errori} errori, controllo negativo passato —`);
process.exit(errori ? 1 : 0);
