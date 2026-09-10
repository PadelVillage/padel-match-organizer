// ── BANCO: IL CLICK DEL TRASCINAMENTO SI MANGIA (voce 195) ───────────────────────
//
// 🗣️ Sue parole (10/09/2026): «quando faccio il drag & drop sul calendario mi appare per un breve
//    tempo la scheda e poi si chiude».
//
// 📏 IL FATTO, riprodotto sulla pagina viva di TEST (6.435) PRIMA di curare, con la scheda
//    sostituita da una spia: presa finita 100 ms fa ⇒ 0 aperture · 400 ms ⇒ 0 · 600 ms ⇒ 1 ·
//    1500 ⇒ 1 · 3000 ⇒ 1. La guardia della voce 193 era a TEMPO (500 ms) e in mezzo c'è il
//    `confirm()` dello spostamento, che BLOCCA la pagina: il click resta in coda e viene
//    consegnato dopo «quanto ci ha messo lui a premere OK», non dopo la durata del gesto.
//
// 📌 *Una guardia a tempo misura il tempo e presume di misurare un fatto: quando in mezzo c'è
//    qualcosa che blocca, i due si scollano e la guardia scade proprio mentre serve.*
//
// ⭐ Le righe NON sono ricopiate qui: si leggono da `index.html`, senza commenti — un banco che
//    legge i commenti misura come la cura è stata raccontata, non la cura.
//
// Uso:  node test/il-click-del-trascinamento-si-mangia.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const QUI = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(QUI, '..', 'index.html'), 'utf8');

function senzaCommenti(testo) {
  let fuori = '', i = 0, stringa = null, prec = '';
  while (i < testo.length) {
    const c = testo[i], succ = testo[i + 1];
    if (stringa) {
      fuori += c;
      if (c === stringa && prec !== '\\') stringa = null;
      prec = (prec === '\\' && c === '\\') ? '' : c;
      i++; continue;
    }
    if (c === '/' && succ === '/') { const f = testo.indexOf('\n', i); i = f < 0 ? testo.length : f; continue; }
    if (c === '/' && succ === '*') { const f = testo.indexOf('*/', i + 2); i = f < 0 ? testo.length : f + 2; continue; }
    if (c === '"' || c === "'" || c === '`') stringa = c;
    fuori += c; prec = c; i++;
  }
  return fuori;
}
const APP = senzaCommenti(html);

let ok = 0, ko = 0;
function caso(nome, fn) {
  let esito;
  try { esito = fn(); } catch (e) { esito = false; console.log(`   ↳ eccezione: ${e.message}`); }
  console.log(`${esito ? '✅' : '❌'} ${nome}`);
  esito ? ok++ : ko++;
}

console.log('\n🖐️ IL CLICK DEL TRASCINAMENTO SI MANGIA — voce 195\n');

caso('1. il ricordo esiste come FATTO, non come orologio', () =>
  /let _pmoTrascinaClickDaMangiare = false;/.test(APP));

caso('2. 🚨 si arma quando una PRESA finisce — non quando finisce un gesto qualunque', () =>
  /if \(t\.preso\) \{[^}]*_pmoTrascinaClickDaMangiare = true;[^}]*\}/.test(APP));

caso('3. 🚨 il click lo CONSUMA e si ferma: senza il consumo mangerebbe anche i click dopo', () =>
  /if \(_pmoTrascinaClickDaMangiare\) \{ _pmoTrascinaClickDaMangiare = false; return; \}/.test(APP));

caso('4. 🚨 il fatto si guarda PRIMA del tempo: se si guardasse dopo, il tempo scaduto avrebbe già deciso', () => {
  const iFatto = APP.indexOf('if (_pmoTrascinaClickDaMangiare)');
  const iTempo = APP.indexOf('Date.now() - _pmoTrascinaFinitoA < 500');
  return iFatto > 0 && iTempo > 0 && iFatto < iTempo;
});

caso('5. la guardia a tempo RESTA accanto (seconda rete), non è stata tolta', () =>
  /Date\.now\(\) - _pmoTrascinaFinitoA < 500/.test(APP));

caso('6. 🚨 un gesto NUOVO dimentica quello vecchio, o il flag mangerebbe un click legittimo', () => {
  const i = APP.indexOf("blk.addEventListener('pointerdown'");
  if (i < 0) return false;
  const testa = APP.slice(i, i + 260);
  return /_pmoTrascinaClickDaMangiare = false;/.test(testa)
    // …e sta PRIMA dei return che scartano il gesto, o su quelli non si azzererebbe
    && testa.indexOf('_pmoTrascinaClickDaMangiare = false;') < testa.indexOf('return;');
});

caso('7. 📏 il difetto misurato: la finestra a tempo è 500 ms, e il confirm può durare di più', () => {
  // La finestra è un numero dichiarato: se un domani la si allungasse credendo di curare così,
  // questo caso resta verde ma il 3. e il 4. continuano a pretendere il fatto. Qui si fissa solo
  // che il tempo NON è più l'unica difesa.
  const iConfirm = APP.indexOf('Spostare la prenotazione?');
  return iConfirm > 0 && /const confirmed = confirm\(/.test(APP);
});

console.log(`\n${ko === 0 ? '✅' : '❌'} ${ok} passati, ${ko} falliti\n`);
process.exit(ko === 0 ? 0 : 1);
