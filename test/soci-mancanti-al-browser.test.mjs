// ── BANCO: «chi c'è nel cloud e non in questo browser» ───────────────────────────
//
// Che cosa prova: che `pmoBuildMemberCountAudit` sappia dire QUALI soci del cloud non
// stanno nella copia locale del browser, e soprattutto che distingua i due modi di
// mancare — «non c'è proprio» e «c'è ma con un altro identificativo» — perché hanno
// cause opposte e portano a due indagini diverse.
//
// ⭐ La funzione è ESTRATTA da index.html, non ricopiata: un banco che prova una copia
//    prova la copia. Le funzioni di appoggio che le servono vengono estratte anche loro;
//    solo i dati (`giocatori`, dashboard, fotografia Matchpoint) sono finti.
//
// Uso:  node test/soci-mancanti-al-browser.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(QUI, '..', 'index.html'), 'utf8');

function estrai(nome) {
  const inizio = html.indexOf(`function ${nome}(`);
  if (inizio < 0) throw new Error(`funzione «${nome}» non trovata in index.html`);
  // 🚨 Il corpo comincia DOPO la lista dei parametri, e per trovarlo si bilanciano le
  // tonde: una firma come `funzione(row={})` ha una graffa dentro i parametri, e partire
  // dalla prima `{` che si incontra ritaglia mezza funzione — che poi non compila, e
  // sembra un difetto dell'app quando invece è di questo estrattore.
  let t = html.indexOf('(', inizio), tonde = 0;
  for (; t < html.length; t++) {
    if (html[t] === '(') tonde++;
    else if (html[t] === ')') { tonde--; if (tonde === 0) { t++; break; } }
  }
  let i = html.indexOf('{', t), livello = 0, stringa = null, prec = '';
  for (; i < html.length; i++) {
    const c = html[i];
    if (stringa) { if (c === stringa && prec !== '\\') stringa = null; }
    else if (c === '"' || c === "'" || c === '`') stringa = c;
    else if (c === '{') livello++;
    else if (c === '}') { livello--; if (livello === 0) { i++; break; } }
    prec = c;
  }
  return html.slice(inizio, i);
}

// Le funzioni vere che servono al calcolo (estratte dal file).
const DAL_FILE = [
  'cleanCell', 'compactSpaces', 'pmoMemberAuditPayload', 'pmoMemberAuditFullName', 'pmoMemberAuditEmail',
  'pmoMemberAuditPhone', 'pmoMemberAuditSourceLabel', 'pmoMemberAuditIsMatchpoint',
  'pmoMemberAuditBaseRow', 'pmoMemberAuditAddKey', 'pmoMemberAuditFindTwin',
  'pmoMemberAuditApprovedDecision', 'isTechnicalMemberRecord', 'pmoBuildMemberCountAudit',
];

// ⭐ Il calcolo si appoggia a una catena di funzioncine del file, e elencarle a mano
// significa scoprirne una per giro. Invece si parte da quelle note e, ogni volta che
// l'esecuzione si ferma su «X is not defined», si va a prendere X dal file vero e si
// riprova. Così il banco resta in piedi anche se domani la catena cambia — e se una
// funzione davvero non c'è, lo dice col suo nome invece di un errore oscuro.
function banco(cloudRows, sociLocali) {
  const ctx = {
    giocatori: sociLocali,
    matchpointData: { clientCount: 0 },
    getDashboardActiveMembers: () => sociLocali.filter(m => m && m.active !== false),
    // Appoggi semplici, con lo stesso contratto di quelli veri.
    normalizeEmailForMatch: (v) => String(v || '').trim().toLowerCase(),
    phoneDigitsForWhatsApp: (v) => String(v || '').replace(/\D/g, '').slice(-10),
    playerFullName: (m) => `${(m && m.firstName) || ''} ${(m && m.surname) || ''}`.trim(),
    console: { info(){}, warn(){}, log(){}, error(){} },
  };
  vm.createContext(ctx);
  const presi = [...DAL_FILE];
  for (let giro = 0; giro < 40; giro++) {
    try {
      vm.runInContext(presi.map(estrai).join('\n'), ctx);
      return ctx.pmoBuildMemberCountAudit(cloudRows);
    } catch (err) {
      const mancante = /(\w+) is not defined/.exec(String(err && err.message));
      if (!mancante || presi.includes(mancante[1])) throw err;
      presi.push(mancante[1]);      // la prossima volta viene estratta anche lei
    }
  }
  throw new Error('troppe dipendenze da risolvere: qualcosa non torna nell\'estrazione');
}

// Un record del cloud come arriva davvero da `pmo_get_records_admin`.
const rec = (id, firstName, surname, phone, extra = {}) => ({
  record_type: 'member',
  local_key: 'k-' + id,
  deleted: false,
  updated_at: '2026-08-02T10:00:00Z',
  payload: { id, firstName, surname, phone, active: true, memberId: '', ...extra },
});
const socio = (id, firstName, surname, phone, extra = {}) =>
  ({ id, firstName, surname, phone, active: true, memberId: '', ...extra });

const casi = [];
const caso = (nome, fn) => casi.push({ nome, fn });

caso('1. copia locale completa: non manca nessuno', () => {
  const cloud = [rec('a', 'Anna', 'Bianchi', '+393331110001'), rec('b', 'Bruno', 'Neri', '+393331110002')];
  const loc = [socio('a', 'Anna', 'Bianchi', '+393331110001'), socio('b', 'Bruno', 'Neri', '+393331110002')];
  const r = banco(cloud, loc);
  return [r.missingRows.length === 0, r.summary.missingLocal === 0];
});

caso('2. un socio del cloud non è nel browser: «non c\'è proprio»', () => {
  const cloud = [rec('a', 'Anna', 'Bianchi', '+393331110001'), rec('b', 'Bruno', 'Neri', '+393331110002')];
  const loc = [socio('a', 'Anna', 'Bianchi', '+393331110001')];
  const r = banco(cloud, loc);
  return [r.missingRows.length === 1, r.missingRows[0].fullName.includes('Bruno'),
          r.missingRows[0].modo === 'assente', r.summary.missingLocal === 1];
});

caso('3. 🚨 stessa persona con un ALTRO identificativo: «doppia scheda», non «assente»', () => {
  // Nel cloud ha id 'b', nel browser la stessa persona (stesso telefono) ha id 'b-vecchio'.
  const cloud = [rec('b', 'Bruno', 'Neri', '+393331110002')];
  const loc = [socio('b-vecchio', 'Bruno', 'Neri', '+393331110002')];
  const r = banco(cloud, loc);
  return [r.missingRows.length === 1, r.missingRows[0].modo === 'altro_id',
          r.missingRows[0].gemelloNome.includes('Bruno'), r.missingRows[0].gemelloId === 'b-vecchio'];
});

caso('4. il gemello si riconosce anche dal CODICE Matchpoint, non solo dal telefono', () => {
  const cloud = [rec('c', 'Carla', 'Verdi', '', { memberId: '001234' })];
  const loc = [socio('c-altro', 'Carla', 'Verdi', '', { memberId: '001234' })];
  const r = banco(cloud, loc);
  return [r.missingRows.length === 1, r.missingRows[0].modo === 'altro_id'];
});

caso('5. i record già cancellati non contano come mancanti', () => {
  const cancellato = { ...rec('z', 'Zeno', 'Uscito', '+393331119999'), deleted: true };
  const r = banco([rec('a', 'Anna', 'Bianchi', '+393331110001'), cancellato], [socio('a', 'Anna', 'Bianchi', '+393331110001')]);
  return [r.missingRows.length === 0];
});

caso('6. gli ATTIVI vengono prima dei non attivi, e sono contati a parte', () => {
  const spento = rec('s', 'Sergio', 'Spento', '+393331110003', { active: false });
  const acceso = rec('t', 'Tina', 'Attiva', '+393331110004');
  const r = banco([spento, acceso], []);
  return [r.missingRows.length === 2, r.missingRows[0].fullName.includes('Tina'),
          r.summary.missingLocalActive === 1, r.summary.missingLocal === 2];
});

caso('7. il conto dei due modi torna con il totale', () => {
  const cloud = [rec('a', 'Anna', 'B', '+393331110001'), rec('b', 'Bruno', 'N', '+393331110002'),
                 rec('c', 'Carla', 'V', '+393331110003')];
  const loc = [socio('b-vecchio', 'Bruno', 'N', '+393331110002')];
  const r = banco(cloud, loc);
  const perModo = r.missingRows.reduce((acc, x) => (acc[x.modo] = (acc[x.modo] || 0) + 1, acc), {});
  return [r.missingRows.length === 3, perModo.altro_id === 1, perModo.assente === 2,
          r.summary.missingLocalAltroId === 1];
});

caso('8. browser VUOTO: mancano tutti (la guardia contro il banco che misura zero)', () => {
  const cloud = [rec('a', 'Anna', 'B', '+393331110001'), rec('b', 'Bruno', 'N', '+393331110002')];
  const r = banco(cloud, []);
  return [r.missingRows.length === 2, r.summary.missingLocal === 2];
});

let passati = 0, falliti = 0;
console.log('BANCO — i soci che stanno nel cloud e non in questo browser\n');
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
process.exit(falliti ? 1 : 0);
