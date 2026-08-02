// ── BANCO: si CERCA per telefono prima di creare un cliente in Matchpoint ────────────
//
// Che cosa prova: che la difesa anti-doppione decida bene — e soprattutto che NON adotti
// la scheda di un altro, che significherebbe dare al socio nuovo i pagamenti e il
// borsellino di qualcun altro.
//
// ⭐ Le funzioni NON sono ricopiate qui: vengono ESTRATTE da `server.mjs` e valutate.
//
// 🚨 I due casi che contano:
//    · PADRE E FIGLIO con lo stesso numero: stesso cognome, nome diverso ⇒ NON si adotta.
//      È il motivo per cui il cognome da solo non basta.
//    · «non ho POTUTO cercare» ≠ «non c'è»: se la ricerca non riesce e si crea lo stesso,
//      il doppione nasce proprio quando la difesa è rotta.
//
// Uso:  node test/creazione-cliente-telefono.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = join(QUI, '..');
const WORKER = join(RADICE, 'tools', 'matchpoint-browser-worker', 'src', 'server.mjs');
const EDGE = join(RADICE, 'supabase', 'functions', 'matchpoint-clients-create', 'index.ts');
const APP = join(RADICE, 'index.html');
const worker = readFileSync(WORKER, 'utf8');
const edge = readFileSync(EDGE, 'utf8');
const app = readFileSync(APP, 'utf8');

// Stessa estrazione degli altri banchi: si salta la lista dei parametri (una firma come
// `f(o = {})` ha una graffa lì dentro) e si saltano i COMMENTI, che in italiano sono pieni
// di apostrofi e presi per apici sballano il conteggio delle graffe.
function estrai(sorgente, nome) {
  const inizio = sorgente.indexOf(`function ${nome}(`);
  if (inizio < 0) throw new Error(`funzione «${nome}» non trovata`);
  let t = sorgente.indexOf('(', inizio), tonde = 0;
  for (; t < sorgente.length; t++) {
    if (sorgente[t] === '(') tonde++;
    else if (sorgente[t] === ')') { tonde--; if (tonde === 0) { t++; break; } }
  }
  let i = sorgente.indexOf('{', t), livello = 0, dentroStringa = null, prec = '';
  for (; i < sorgente.length; i++) {
    const c = sorgente[i], succ = sorgente[i + 1];
    if (dentroStringa) {
      if (c === dentroStringa && prec !== '\\') dentroStringa = null;
    } else if (c === '/' && succ === '/') { const fine = sorgente.indexOf('\n', i); i = fine < 0 ? sorgente.length : fine; prec = '\n'; continue; }
    else if (c === '/' && succ === '*') { const fine = sorgente.indexOf('*/', i + 2); i = fine < 0 ? sorgente.length : fine + 1; prec = '/'; continue; }
    else if (c === '"' || c === "'" || c === '`') { dentroStringa = c; }
    else if (c === '{') livello++;
    else if (c === '}') { livello--; if (livello === 0) { i++; break; } }
    prec = c;
  }
  return sorgente.slice(inizio, i);
}

const ctx = { console: { log() {}, warn() {}, error() {} } };
vm.createContext(ctx);
vm.runInContext(['mpPhoneKey10', 'mpPhoneSearchTerms', 'mpNomeToken', 'mpDecideCreazioneCliente']
  .map(n => estrai(worker, n)).join('\n'), ctx);
const { mpPhoneKey10, mpPhoneSearchTerms, mpDecideCreazioneCliente } = ctx;

const casi = [];
const caso = (nome, fn) => casi.push({ nome, fn });

// ── La CHIAVE del telefono ──────────────────────────────────────────────────────

caso('1. lo stesso numero scritto in 4 modi dà la STESSA chiave', () => {
  const k = mpPhoneKey10('+39 333 1234567');
  return [k === '3331234567',
          mpPhoneKey10('00393331234567') === k,
          mpPhoneKey10('3331234567') === k,
          mpPhoneKey10('+39-333-123.45.67') === k];
});

caso('2. 🚨 una cifra in meno NON è lo stesso numero (il caso Ruzzini)', () => {
  // In PROD la riga viva ha +393492222564, le morte +39349222564: fonderli sarebbe peggio
  // del problema, perché adotterebbe la scheda di chissà chi.
  return [mpPhoneKey10('+393492222564') !== mpPhoneKey10('+39349222564')];
});

caso('3. numero troppo corto: chiave vuota, così non si confronta a caso', () => {
  return [mpPhoneKey10('12345') === '', mpPhoneKey10('') === '', mpPhoneKey10(null) === '',
          mpPhoneKey10('non è un numero') === ''];
});

caso('4. i termini di ricerca: prima il numero nudo, senza doppioni né vuoti', () => {
  const t = mpPhoneSearchTerms('+39 333 1234567');
  return [t[0] === '3331234567', t.includes('393331234567'),
          new Set(t).size === t.length, t.every(x => x !== '')];
});

caso('5. numero già nudo: un solo termine, non tre uguali', () => {
  return [mpPhoneSearchTerms('3331234567').length === 1];
});

// ── La DECISIONE ────────────────────────────────────────────────────────────────

caso('6. telefono non trovato in Matchpoint → si CREA, come sempre', () => {
  const d = mpDecideCreazioneCliente({ trovato: false, motivo: 'telefono_non_trovato', nome: 'Marco', cognome: 'Rossi' });
  return [d.azione === 'crea'];
});

caso('7. stessa persona (nome E cognome) → si ADOTTA il suo codice', () => {
  const d = mpDecideCreazioneCliente({ trovato: true, intestatario: 'Rossi Marco', nome: 'Marco', cognome: 'Rossi' });
  return [d.azione === 'adotta', d.motivo === 'stessa_persona'];
});

caso('8. 🚨 PADRE E FIGLIO: stesso cognome, nome diverso → CONFLITTO, non si adotta', () => {
  // Il caso che rende insufficiente il solo cognome: adottare qui darebbe al figlio la
  // scheda del padre, coi suoi pagamenti e il suo borsellino.
  const d = mpDecideCreazioneCliente({ trovato: true, intestatario: 'Rossi Mario', nome: 'Luca', cognome: 'Rossi' });
  return [d.azione === 'conflitto', d.motivo === 'nome_diverso'];
});

caso('9. intestatario tutto diverso → conflitto', () => {
  const d = mpDecideCreazioneCliente({ trovato: true, intestatario: 'Bianchi Anna', nome: 'Marco', cognome: 'Rossi' });
  return [d.azione === 'conflitto', d.motivo === 'intestatario_diverso'];
});

caso('10. più schede con quel numero → conflitto, mai una scelta a caso', () => {
  const d = mpDecideCreazioneCliente({ trovato: true, motivo: 'piu_schede', intestatario: 'Rossi Marco / Rossi Luca', nome: 'Marco', cognome: 'Rossi' });
  return [d.azione === 'conflitto', d.motivo === 'piu_schede'];
});

caso('11. non si riesce a leggere chi è → conflitto, non si indovina', () => {
  const d = mpDecideCreazioneCliente({ trovato: true, intestatario: '', nome: 'Marco', cognome: 'Rossi' });
  return [d.azione === 'conflitto', d.motivo === 'intestatario_illeggibile'];
});

caso('12. accenti, apostrofi e MAIUSCOLE non impediscono di riconoscersi', () => {
  const d = mpDecideCreazioneCliente({ trovato: true, intestatario: "D'AMICO NICOLO'", nome: 'Nicolò', cognome: "D'Amico" });
  return [d.azione === 'adotta'];
});

caso('13. l\'ordine nome/cognome non conta: Matchpoint non promette un ordine', () => {
  const a = mpDecideCreazioneCliente({ trovato: true, intestatario: 'Rossi Marco', nome: 'Marco', cognome: 'Rossi' });
  const b = mpDecideCreazioneCliente({ trovato: true, intestatario: 'Marco Rossi', nome: 'Marco', cognome: 'Rossi' });
  return [a.azione === 'adotta', b.azione === 'adotta'];
});

caso('14. cognome composto: devono esserci TUTTI i pezzi', () => {
  const ok = mpDecideCreazioneCliente({ trovato: true, intestatario: 'Dalla Cia Lorenzo', nome: 'Lorenzo', cognome: 'Dalla Cia' });
  const no = mpDecideCreazioneCliente({ trovato: true, intestatario: 'Cia Lorenzo', nome: 'Lorenzo', cognome: 'Dalla Cia' });
  return [ok.azione === 'adotta', no.azione === 'conflitto'];
});

caso('15. secondo nome sulla scheda: basta il primo per riconoscersi', () => {
  const d = mpDecideCreazioneCliente({ trovato: true, intestatario: 'Rossi Maria Grazia', nome: 'Maria', cognome: 'Rossi' });
  return [d.azione === 'adotta'];
});

// ── 🚨 GUARDIE SULLA BASE E SULL'ANELLO DI MEZZO ─────────────────────────────────
// I casi qui sopra proverebbero le funzioni anche se nessuno le chiamasse, e anche se il
// dato che serve non arrivasse fin lì. La difesa vive su TRE file — app, edge, worker — e
// l'ultima volta un edge che buttava un campo ha reso INERTE una guardia che sembrava a
// posto: da fuori i due estremi erano giusti e il guasto stava nel mezzo.
const corpoCreate = estrai(worker, 'createClientWithBrowser');
const guardie = [
  ['il worker cerca il telefono DENTRO la creazione',
    /mpCercaClientePerTelefono\(/.test(corpoCreate)],
  ['e la decisione la prende la funzione apposta',
    /mpDecideCreazioneCliente\(/.test(corpoCreate)],
  ['cerca per «Telefono cellulare», non per codice',
    /Telefono cellulare/.test(estrai(worker, 'mpCercaClientePerTelefono'))],
  // 🚨 Il caso che sembra innocuo: se la ricerca non riesce e si tira dritto, il doppione
  //    nasce proprio quando la difesa è rotta — l'atteso soddisfatto da un guasto.
  ['«non ho potuto cercare» FERMA la creazione',
    /ricerca_non_riuscita/.test(corpoCreate) && /CLIENT_PHONE_CHECK_FAILED/.test(corpoCreate)],
  ['la ricerca distingue i due modi di non trovare',
    /ricerca_non_riuscita/.test(estrai(worker, 'mpCercaClientePerTelefono'))
      && /telefono_non_trovato/.test(estrai(worker, 'mpCercaClientePerTelefono'))],
  ['si può scavalcare SOLO con forzaCreazione', /forzaCreazione/.test(corpoCreate)],
  ['la ricerca NON scrive niente su Matchpoint',
    !/ButtonActualizar|__doPostBack\('ctl01/.test(estrai(worker, 'mpCercaClientePerTelefono'))],
  // 🚨 La difesa INERTE: se la voce «Telefono cellulare» non venisse selezionata, la
  //    ricerca girerebbe sul criterio di default e concluderebbe «non c'è» — verde da
  //    fuori, spenta dentro. Perciò il criterio si RILEGGE dopo averlo impostato.
  ['il criterio scelto viene RILETTO, non dato per buono',
    /criterio_non_impostato/.test(estrai(worker, 'mpCercaClientePerTelefono'))
      && /selectedIndex/.test(estrai(worker, 'mpCercaClientePerTelefono'))],
  // ── L'ANELLO DI MEZZO: i tre file devono dire gli stessi nomi ──
  ['l\'EDGE passa forzaCreazione al worker', /forzaCreazione/.test(edge)],
  ['l\'EDGE riconosce l\'esito «conflitto_telefono»', /conflitto_telefono/.test(edge)],
  ['l\'EDGE non dice «Cliente creato» quando ha adottato', /adottato/.test(edge)],
  ['l\'APP manda forzaCreazione', /forzaCreazione:\s*options\.forzaCreazione/.test(app)],
  ['l\'APP riconosce «conflitto_telefono»', /conflitto_telefono/.test(app)],
  ['l\'APP offre le due risposte invece di un vicolo cieco',
    /svcMakeStepButtons\(\[_stessa, _altra\]/.test(app)],
  ['il bottone «crea lo stesso» accende davvero forzaCreazione',
    /forzaCreazione:\s*true/.test(app)],
];

let passati = 0, falliti = 0;
console.log('BANCO — si cerca per telefono prima di creare un cliente\n');
console.log('Guardie sulla base e sull\'anello di mezzo (app ↔ edge ↔ worker):');
guardie.forEach(([nome, ok]) => {
  console.log(`  ${ok ? '✅' : '❌'} ${nome}`);
  if (!ok) falliti++;
});
console.log('');
for (const c of casi) {
  let esiti;
  try { esiti = c.fn(); } catch (err) { esiti = [false]; c.errore = err; }
  const ok = Array.isArray(esiti) && esiti.length > 0 && esiti.every(Boolean);
  if (ok) { passati++; console.log(`✅ ${c.nome}`); }
  else {
    falliti++;
    console.log(`❌ ${c.nome}`);
    if (c.errore) console.log(`   errore: ${c.errore.message}`);
    else console.log(`   controlli: [${esiti.map(v => v ? 'ok' : 'NO').join(', ')}]`);
  }
}
console.log(`\n— ${passati} passati, ${falliti} falliti su ${casi.length} casi —`);
