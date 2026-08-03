// ── BANCO: «l'idratazione dei soci dal cloud non lascia fuori nessuno» ───────────
//
// Che cosa prova: che `pmoLoadAllMembersFromCloud` porti giù dal cloud OGNI socio vivo,
// qualunque sia la sua provenienza. Fino al 3/08/2026 filtrava `importedFrom ===
// 'rubrica-google'`, e l'altra idratazione prende solo chi ha il marchio Matchpoint: chi
// non aveva né l'uno né l'altro — i soci NATI NELL'APP — non era previsto da nessuna delle
// due e restava visibile solo nel browser che l'aveva creato.
//
// 🚨⭐⭐ Il caso 3 è quello che ha bocciato la prima idea. La cura «ovvia» era filtrare
//    «tutto tranne Matchpoint», il complemento esatto dell'altra idratazione. Ma 17 record
//    veri hanno ENTRAMBI i marchi e NON si persistono in localStorage: vivono solo di
//    questa idratazione. Quel filtro li avrebbe buttati fuori — 8 soci curati, 17 rotti, in
//    silenzio. Il caso 3 esiste per fermare chiunque riprovi quella strada.
//
// ⭐ La funzione è ESTRATTA da index.html, non ricopiata: un banco che prova una copia
//    prova la copia. Solo le righe del cloud sono finte.
//
// Uso:  node test/idratazione-soci-dal-cloud.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(QUI, '..', 'index.html'), 'utf8');

function estrai(nome) {
  const inizio = html.indexOf(`function ${nome}(`);
  if (inizio < 0) throw new Error(`funzione «${nome}» non trovata in index.html`);
  // 🚨 Il corpo comincia DOPO la lista dei parametri: una firma come `funzione(row={})` ha
  // una graffa DENTRO i parametri, e partire dalla prima `{` ritaglia mezza funzione.
  let t = html.indexOf('(', inizio), tonde = 0;
  for (; t < html.length; t++) {
    if (html[t] === '(') tonde++;
    else if (html[t] === ')') { tonde--; if (tonde === 0) { t++; break; } }
  }
  // 🚨 I COMMENTI vanno saltati, non letti come codice: in italiano sono pieni di apostrofi
  // («c'è», «l'operatore») e ognuno, preso per un apice di stringa, sballa il conteggio
  // delle graffe tirando dentro le funzioni successive.
  let i = html.indexOf('{', t), livello = 0, stringa = null, prec = '';
  for (; i < html.length; i++) {
    const c = html[i], succ = html[i + 1];
    if (stringa) { if (c === stringa && prec !== '\\') stringa = null; }
    else if (c === '/' && succ === '/') { const fine = html.indexOf('\n', i); i = fine < 0 ? html.length : fine; prec = '\n'; continue; }
    else if (c === '/' && succ === '*') { const fine = html.indexOf('*/', i + 2); i = fine < 0 ? html.length : fine + 1; prec = '/'; continue; }
    else if (c === '"' || c === "'" || c === '`') stringa = c;
    else if (c === '{') livello++;
    else if (c === '}') { livello--; if (livello === 0) { i++; break; } }
    prec = c;
  }
  // La firma può essere `async function …`: la parolina sta PRIMA di «function» e senza di
  // lei la funzione estratta non è più asincrona — il banco proverebbe un'altra cosa.
  const asincrona = html.slice(Math.max(0, inizio - 6), inizio) === 'async ';
  return (asincrona ? 'async ' : '') + html.slice(inizio, i);
}

// Esegue la funzione VERA con una RPC finta che restituisce le righe date.
async function scarica(righe) {
  let chiamata = null;
  const ctx = {
    pmoStaffRpcPaged: async (fn, params, permesso, etichetta) => {
      chiamata = { fn, params, permesso, etichetta };
      return righe;
    },
    console: { info() {}, warn() {}, log() {}, error() {} },
  };
  vm.createContext(ctx);
  vm.runInContext(estrai('pmoLoadAllMembersFromCloud'), ctx);
  const soci = await ctx.pmoLoadAllMembersFromCloud();
  return { soci, chiamata };
}

// Una riga del cloud come arriva davvero da `pmo_get_records_admin`.
const riga = (local_key, payload, extra = {}) => ({
  record_type: 'member',
  local_key,
  deleted: false,
  updated_at: '2026-08-03T10:00:00Z',
  payload,
  ...extra,
});

const MARCHIO_MP = { source: 'matchpoint_auto' };
const MARCHIO_RUBRICA = { importedFrom: 'rubrica-google' };

const casi = [];
const caso = (nome, fn) => casi.push({ nome, fn });

caso('1. il socio NATO NELL\'APP (nessun marchio) viene scaricato — è il difetto curato', async () => {
  const { soci } = await scarica([
    riga('phone:393296725414', { id: 'e5bc', name: 'Giovanni Bronca', phone: '+393296725414', active: true }),
  ]);
  return [soci.length === 1, soci[0].name === 'Giovanni Bronca'];
});

caso('2. il contatto della RUBRICA continua a scendere (nessuna regressione)', async () => {
  const { soci } = await scarica([
    riga('phone:393331110002', { id: 'r1', name: 'Anna Bianchi', ...MARCHIO_RUBRICA }),
  ]);
  return [soci.length === 1, soci[0].id === 'r1'];
});

caso('3. 🚨 chi ha ENTRAMBI i marchi scende — il filtro «tutto tranne Matchpoint» lo perdeva', async () => {
  // I 17 record veri nati dalla rubrica e diventati poi clienti Matchpoint. Non si
  // persistono in localStorage: se questa idratazione non li porta, spariscono dal browser.
  const { soci } = await scarica([
    riga('phone:393331110003', { id: 'x1', name: 'Marco Verdi', ...MARCHIO_MP, ...MARCHIO_RUBRICA }),
  ]);
  return [soci.length === 1, soci[0].id === 'x1'];
});

caso('4. anche il socio col solo marchio MATCHPOINT scende: nessuna provenienza è esclusa', async () => {
  const { soci } = await scarica([
    riga('phone:393331110004', { id: 'm1', name: 'Luca Rossi', ...MARCHIO_MP }),
  ]);
  return [soci.length === 1, soci[0].id === 'm1'];
});

caso('5. le quattro provenienze insieme: scendono tutte e quattro', async () => {
  const { soci } = await scarica([
    riga('k1', { id: 'a', name: 'Nato nell app' }),
    riga('k2', { id: 'b', name: 'Rubrica', ...MARCHIO_RUBRICA }),
    riga('k3', { id: 'c', name: 'Entrambi', ...MARCHIO_MP, ...MARCHIO_RUBRICA }),
    riga('k4', { id: 'd', name: 'Matchpoint', ...MARCHIO_MP }),
  ]);
  return [soci.length === 4, soci.map(s => s.id).join(',') === 'a,b,c,d'];
});

caso('6. il record CANCELLATO non scende', async () => {
  const { soci } = await scarica([
    riga('k1', { id: 'a', name: 'Vivo' }),
    riga('k2', { id: 'b', name: 'Cancellato' }, { deleted: true }),
  ]);
  return [soci.length === 1, soci[0].id === 'a'];
});

caso('7. le righe che NON sono soci non scendono (prenotazioni, impostazioni…)', async () => {
  const { soci } = await scarica([
    riga('k1', { id: 'a', name: 'Socio' }),
    { record_type: 'staff_booking', local_key: 'b1', deleted: false, payload: { id: 'b1', nome: 'Partita' } },
    { record_type: 'app_setting', local_key: 's1', deleted: false, payload: { key: 's1' } },
  ]);
  return [soci.length === 1, soci[0].id === 'a'];
});

caso('8. la riga senza payload non fa cadere lo scarico', async () => {
  const { soci } = await scarica([
    riga('k1', null),
    riga('k2', { id: 'a', name: 'Socio' }),
  ]);
  return [soci.length === 1, soci[0].id === 'a'];
});

caso('9. senza id nel payload si usa la chiave del cloud, così il socio ha SEMPRE un id', async () => {
  const { soci } = await scarica([
    riga('phone:393296725414', { name: 'Senza id', phone: '+393296725414' }),
  ]);
  return [soci.length === 1, soci[0].id === 'phone:393296725414'];
});

caso('10. una risposta non valida dalla RPC dà elenco vuoto, non un errore', async () => {
  const a = await scarica(null);
  const b = await scarica(undefined);
  return [a.soci.length === 0, b.soci.length === 0];
});

caso('11. chiede il permesso cloud_sync e i soli record «member»', async () => {
  const { chiamata } = await scarica([]);
  return [
    chiamata.fn === 'pmo_get_records_admin',
    Array.isArray(chiamata.params.p_record_types),
    chiamata.params.p_record_types.length === 1,
    chiamata.params.p_record_types[0] === 'member',
    chiamata.permesso === 'cloud_sync',
  ];
});

caso('12. scarica TUTTO lo storico, non solo le ultime modifiche', async () => {
  // p_since valorizzato prenderebbe solo una finestra recente: un socio fermo da maggio —
  // ed è esattamente il caso dei 7 invisibili — non tornerebbe mai giù.
  const { chiamata } = await scarica([]);
  return [chiamata.params.p_since === null];
});

// ── GUARDIE SULLA BASE ──────────────────────────────────────────────────────────
// 🚨 Un banco che misura ZERO resta verde: queste controllano che ci sia davvero
//    qualcosa da misurare, e che la CHIAMATA sia agganciata dove serve.
const corpoScarico = estrai('pmoLoadAllMembersFromCloud');
const corpoIdratazione = estrai('pmoEnsureCloudMembersHydrated');
const corpoStorage = estrai('pmoEncodeForStorage');

const guardie = [
  ['la funzione di scarico esiste', !!corpoScarico],
  ['l\'idratazione esiste', !!corpoIdratazione],

  // ⭐⭐ LA GUARDIA CHE CONTA: se qualcuno rimette un filtro di provenienza, il difetto
  // torna e i casi qui sopra — che passano righe già scelte a mano — potrebbero non
  // accorgersene. Questa guarda il CODICE, non il risultato.
  ['lo scarico NON filtra per provenienza', !/importedFrom|matchpoint_auto|matchpointImportedAt|isMatchpointCloudMemberPayload/.test(corpoScarico)],

  ['l\'idratazione chiama il nuovo scarico', /pmoLoadAllMembersFromCloud\(/.test(corpoIdratazione)],
  ['l\'idratazione NON chiama più il vecchio scarico filtrato', !/pmoLoadRubricaGoogleMembersFromCloud/.test(html)],
  ['nessun riferimento rimasto al vecchio nome', !/pmoEnsureRubricaGoogleHydrated/.test(html)],

  ['l\'idratazione NON scrive nel cloud', !/pmoSyncCloudRecordsNow\(|pmoCloudRpc\(|pmoUpsertRecords/.test(corpoIdratazione)],
  ['l\'idratazione non cancella soci', !/splice\(|giocatori\s*=\s*\[\]/.test(corpoIdratazione)],
  ['aggiunge solo chi manca (dedup per id)', /seenIds\.has\(/.test(corpoIdratazione)],
  ['aggiunge solo chi manca (dedup per nome+telefono)', /seenKeys\.has\(/.test(corpoIdratazione)],
  ['salva in locale quello che ha aggiunto', /save\('giocatori'/.test(corpoIdratazione)],

  // 🚨 Il freno che protegge la quota del browser deve restare: i ~1700 contatti rubrica
  // NON si persistono. Toglierlo farebbe fallire QUALSIASI salvataggio su un browser pieno.
  ['la rubrica resta fuori dal localStorage', /rubrica-google/.test(corpoStorage)],

  // La chiamata deve stare dove il socio serve: all'ingresso nell'app e in Anagrafica.
  ['è agganciata all\'avvio e alla scheda Anagrafica', (html.match(/pmoEnsureCloudMembersHydrated\(\)/g) || []).length >= 2],
];

let passati = 0, falliti = 0;
console.log('BANCO — l\'idratazione dei soci dal cloud non lascia fuori nessuno\n');
console.log('Guardie sulla base:');
guardie.forEach(([nome, ok]) => {
  console.log(`  ${ok ? '✅' : '❌'} ${nome}`);
  if (!ok) falliti++;
});
console.log('');
for (const c of casi) {
  let esiti;
  try { esiti = await c.fn(); } catch (err) { esiti = [false]; c.errore = err; }
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
