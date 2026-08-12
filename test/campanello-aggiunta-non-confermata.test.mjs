// ── BANCO: IL CAMPANELLO CHE NOTAVA E TACEVA ─────────────────────────────────────
//
// Che cosa prova: che `pmoAggiunteNonConfermate` tiri fuori dalla risposta del worker i
// nomi che, dopo l'aggiunta, Matchpoint NON ha confermato — e soprattutto che non ne
// inventi quando non c'è niente da dire.
//
// ⭐ Le funzioni NON sono ricopiate qui: vengono ESTRATTE da `index.html` e valutate.
//    Un banco che prova una copia del codice prova la copia, non il prodotto.
//
// 🚨 La ragione per cui esiste: fino alla 6.216 quell'annotazione non usciva da nessuna
//    parte e l'app scriveva «✅ Operazione confermata» mentre il giocatore spariva dalla
//    card. È così che il 2/08/2026, in PRODUZIONE, è sparita Laura Aprea.
//
// 🚨 Il caso che conta è il 5°: la risposta arriva incartata in DUE modi diversi a seconda
//    dell'operazione (`worker` per la modifica, `worker_result` per la creazione). Leggere
//    un solo involucro vuol dire tacere per metà delle strade — e tacere è esattamente il
//    guasto che stiamo curando.
//
// Uso:  node test/campanello-aggiunta-non-confermata.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const INDEX = join(QUI, '..', 'index.html');
const html = readFileSync(INDEX, 'utf8');

// Estrazione identica a quella di `id-interno-matchpoint.test.mjs`: si conta le graffe
// saltando commenti e stringhe (i commenti italiani sono pieni di apostrofi, e ognuno
// preso per un apice manda in tilt il conteggio).
function estrai(nome) {
  const inizio = html.indexOf(`function ${nome}(`);
  if (inizio < 0) throw new Error(`funzione «${nome}» non trovata in index.html`);
  let t = html.indexOf('(', inizio), tonde = 0;
  for (; t < html.length; t++) {
    if (html[t] === '(') tonde++;
    else if (html[t] === ')') { tonde--; if (tonde === 0) { t++; break; } }
  }
  let i = html.indexOf('{', t), livello = 0, dentroStringa = null, prec = '';
  for (; i < html.length; i++) {
    const c = html[i], succ = html[i + 1];
    if (dentroStringa) {
      if (c === dentroStringa && prec !== '\\') dentroStringa = null;
    } else if (c === '/' && succ === '/') { const fine = html.indexOf('\n', i); i = fine < 0 ? html.length : fine; prec = '\n'; continue; }
    else if (c === '/' && succ === '*') { const fine = html.indexOf('*/', i + 2); i = fine < 0 ? html.length : fine + 1; prec = '/'; continue; }
    else if (c === '"' || c === "'" || c === '`') { dentroStringa = c; }
    else if (c === '{') livello++;
    else if (c === '}') { livello--; if (livello === 0) { i++; break; } }
    prec = c;
  }
  return html.slice(inizio, i);
}

const NOMI = ['cleanCell', 'pmoAggiunteNonConfermate', 'pmoElencoNomi'];
const ctx = vm.createContext({ console });
vm.runInContext(NOMI.map(estrai).join('\n\n'), ctx);
const nonConfermate = ctx.pmoAggiunteNonConfermate;
const elenco = ctx.pmoElencoNomi;

let ok = 0, ko = 0;
function caso(nome, fn) {
  let esito;
  try { esito = fn(); } catch (e) { esito = false; console.log(`   ↳ eccezione: ${e.message}`); }
  const passato = Array.isArray(esito) ? esito.every(Boolean) : !!esito;
  console.log(`${passato ? '✅' : '❌'} ${nome}`);
  passato ? ok++ : ko++;
}
const uguali = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('\n🔕 IL CAMPANELLO CHE NOTAVA E TACEVA — pmoAggiunteNonConfermate\n');

caso('1. la modifica: il worker ha annotato UN nome ⇒ lo si tira fuori', () =>
  uguali(nonConfermate({ ok: true, worker: { diagnostic: { addVerifyInconclusive: ['Anna Verdi'] } } }), ['Anna Verdi']));

caso('2. 🚨 IL CONTROLLO OPPOSTO: niente annotazione ⇒ NESSUN nome (il campanello resta muto)', () =>
  uguali(nonConfermate({ ok: true, worker: { diagnostic: { steps: ['salva', 'done'] } } }), []));

caso('3. il worker non manda affatto la diagnostica ⇒ muto, non un errore', () => [
  uguali(nonConfermate({ ok: true, worker: { partecipantiFinali: [] } }), []),
  uguali(nonConfermate({ ok: true }), []),
  uguali(nonConfermate(null), []),
  uguali(nonConfermate('non è nemmeno un oggetto'), []),
]);

caso('4. più nomi restano TUTTI, e nell\'ordine in cui il worker li ha visti', () =>
  uguali(nonConfermate({ worker: { diagnostic: { addVerifyInconclusive: ['Anna Verdi', 'Luca Bianchi'] } } }),
    ['Anna Verdi', 'Luca Bianchi']));

caso('5. 🚨 I DUE INVOLUCRI: `worker` (modifica) e `worker_result` (creazione) si leggono uguale', () => [
  uguali(nonConfermate({ worker: { diagnostic: { addVerifyInconclusive: ['Anna'] } } }), ['Anna']),
  uguali(nonConfermate({ worker_result: { diagnostic: { addVerifyInconclusive: ['Anna'] } } }), ['Anna']),
  uguali(nonConfermate({ result: { diagnostic: { addVerifyInconclusive: ['Anna'] } } }), ['Anna']),
  // …e anche senza involucro, se un domani la risposta arrivasse nuda.
  uguali(nonConfermate({ diagnostic: { addVerifyInconclusive: ['Anna'] } }), ['Anna']),
]);

caso('6. ⚠️ i doppioni si accorpano: «Ospite, Ospite» non si dice (il conteggio non lo sappiamo)', () =>
  uguali(nonConfermate({ worker: { diagnostic: { addVerifyInconclusive: ['Ospite', 'Ospite', 'ospite'] } } }), ['Ospite']));

caso('7. i vuoti non diventano nomi (una stringa vuota non è una persona che manca)', () =>
  uguali(nonConfermate({ worker: { diagnostic: { addVerifyInconclusive: ['', '  ', null, undefined, 'Anna Verdi'] } } }),
    ['Anna Verdi']));

caso('8. 🚨 IL CAMPO CHE NON È UN ELENCO non si legge come risposta (44ª trappola)', () => [
  uguali(nonConfermate({ worker: { diagnostic: { addVerifyInconclusive: 'Anna Verdi' } } }), []),
  uguali(nonConfermate({ worker: { diagnostic: { addVerifyInconclusive: true } } }), []),
]);

caso('9. ⭐ un ALTRO campo della diagnostica non fa suonare niente (lo spostamento ha la sua strada)', () =>
  uguali(nonConfermate({ worker: { diagnostic: { moveVerifyInconclusive: true, steps: ['move_verify_inconclusive'] } } }), []));

console.log('\n🗣️ Come si dicono i nomi — pmoElencoNomi\n');

caso('10. uno solo: il nome e basta', () => elenco(['Anna Verdi']) === 'Anna Verdi');
caso('11. due: «e» in mezzo, non la virgola', () => elenco(['Anna', 'Luca']) === 'Anna e Luca');
caso('12. tre: virgole e l\'ultima «e»', () => elenco(['Anna', 'Luca', 'Marco']) === 'Anna, Luca e Marco');
caso('13. nessuno: stringa vuota, non «undefined» sullo schermo', () => [elenco([]) === '', elenco(null) === '']);

console.log(`\n${ko === 0 ? '✅ TUTTO VERDE' : '❌ CI SONO ROSSI'} — ${ok} passate, ${ko} fallite\n`);
process.exit(ko === 0 ? 0 : 1);
