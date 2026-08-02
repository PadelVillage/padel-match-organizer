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

let errori = 0;
console.log(`CONTROLLO SINTASSI — ${blocchi.length} blocchi <script> in index.html\n`);
blocchi.forEach((b, i) => {
  try {
    new vm.Script(b.codice, { filename: `index.html:blocco${i + 1}` });
    console.log(`✅ blocco ${i + 1} (riga ~${b.riga}) — ${b.codice.split('\n').length} righe`);
  } catch (err) {
    errori++;
    console.log(`❌ blocco ${i + 1} (riga ~${b.riga}): ${err.message}`);
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

console.log(`\n— ${blocchi.length - errori >= 0 ? blocchi.length : 0} blocchi controllati, ${errori} errori —`);
process.exit(errori ? 1 : 0);
