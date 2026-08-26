// ── BANCO: il gettone vecchio non si butta — e le schede tornano a casa ──────────────
//
// Che cosa prova: `syncAssessmentTokensFromSupabase`, estratta da `index.html`, quando il
// cloud porta PIÙ gettoni per lo stesso socio.
//
// 🚨⭐⭐ IL DIFETTO CHE QUESTO BANCO CHIUDE, misurato sull'app viva di PROD il 26/08/2026.
//    Il giro teneva UN gettone per socio — l'ultimo che passava, con l'ordine deciso da
//    `jsonb_agg`, cioè da nessuno — e buttava gli altri. Ma una scheda si aggancia **per
//    gettone**: buttato il gettone, la scheda diventa irraggiungibile.
//    📏 49 schede su Supabase, **30** arrivate all'app. Fra le 19 perdute c'era quella del
//    26/08 delle 08:27, cioè esattamente il caso per cui la voce 98 esiste — e la lista del
//    maestro risultava vuota su dati veri, che è il peggiore dei modi di sbagliare: uno zero
//    non si distingue da «non c'è nessuno che aspetta».
//
// ⚖️ La cura non inventa niente: `previousTokens` esiste da sempre e lo riempiono gli altri
//    TRE punti che sostituiscono un gettone. Questo era l'unico che non lo faceva. ⇒ Il caso
//    5 è quello che conta: prova che l'archivio è la STESSA cosa che gli altri punti scrivono.
//
// ⛔ Quello che NON prova: che la chiamata a Supabase si autentichi bene (è la seconda metà
//    della cura, e vive in `syncAssessmentResponsesFromSupabase`; qui si prova il caso 6 solo
//    nella forma testuale, leggendo il sorgente) e che la riga si VEDA nel gestionale — quella
//    è una prova fisica e si fa aprendo l'app.
//
// Uso:  node test/il-gettone-vecchio-non-si-butta.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(QUI, '..', 'index.html'), 'utf8');

function estrai(nome) {
  const inizio = html.indexOf(`function ${nome}(`);
  if (inizio < 0) throw new Error(`funzione «${nome}» non trovata in index.html`);
  let t = html.indexOf('(', inizio), tonde = 0;
  for (; t < html.length; t++) {
    if (html[t] === '(') tonde++;
    else if (html[t] === ')') { tonde--; if (tonde === 0) { t++; break; } }
  }
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
  // `estrai` parte dalla parola `function`: se nel sorgente è una funzione asincrona, l'`async`
  // sta PRIMA e resterebbe fuori — e il corpo, pieno di `await`, non compilerebbe nemmeno.
  const asincrona = html.slice(Math.max(0, inizio - 6), inizio) === 'async ';
  return (asincrona ? 'async ' : '') + html.slice(inizio, i);
}

// L'app intorno alla funzione: sono pezzi banali, e si dichiarano tali.
// 🚨 `var` e non `let`: dentro `vm` una `let` non diventa proprietà del contesto, e assegnare
//    ctx.assessmentTokens creerebbe un'ALTRA variabile — un banco verde che non prova niente.
const base = `
  function normalizeText(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
  function cleanCell(v) { return String(v == null ? '' : v).trim(); }
  function getTodayKey() { return new Date().toISOString().slice(0, 10); }
  function showAlert() {}
  var assessmentTokens = {};
  var salvato = null;
  function save(chiave, valore) { salvato = { chiave, valore }; }
  var RISPOSTA_RPC = { ok: true, data: [] };
  async function pmoStaffRpc() { return RISPOSTA_RPC; }
`;

const ctx = { console: { info() {}, warn() {}, log() {}, error() {} } };
vm.createContext(ctx);
vm.runInContext([base, estrai('syncAssessmentTokensFromSupabase')].join('\n'), ctx);

let passati = 0, falliti = 0;
async function caso(titolo, fn) {
  try { await fn(); console.log('✅ ' + titolo); passati++; }
  catch (err) { console.log('❌ ' + titolo + '\n   → ' + (err && err.message || err)); falliti++; }
}
function esigi(condizione, messaggio) { if (!condizione) throw new Error(messaggio); }

async function gira(righeCloud, tokenLocali = {}) {
  ctx.assessmentTokens = JSON.parse(JSON.stringify(tokenLocali));
  ctx.RISPOSTA_RPC = { ok: true, data: righeCloud };
  const esito = await ctx.syncAssessmentTokensFromSupabase({ silent: true });
  return { esito, tokens: ctx.assessmentTokens };
}
const archivio = (rec) => (rec.previousTokens || []).map(x => x.token).sort();

// Il caso vero del 26/08: un socio con più gettoni, la scheda appesa a quello di aprile.
const MAURIZIO = '7d454239-929a-4346-8ba0-ec778d7763a3';
const CLOUD_MAURIZIO = [
  { member_local_id: MAURIZIO, token: 'tok-aprile', member_name: 'Maurizio Aprea', status: 'sent', created_at: '2026-04-30T07:55:32Z', sent_at: '2026-04-30T07:55:32Z' },
  { member_local_id: MAURIZIO, token: 'tok-maggio', member_name: 'Maurizio Aprea', status: 'sent', created_at: '2026-05-02T17:58:04Z', sent_at: '2026-05-02T17:58:04Z' },
];

await caso('1. il gettone PIÙ RECENTE diventa quello corrente', async () => {
  const { tokens } = await gira(CLOUD_MAURIZIO);
  esigi(tokens[MAURIZIO].token === 'tok-maggio', `corrente è «${tokens[MAURIZIO].token}», atteso tok-maggio`);
});

await caso('2. 🚨 il gettone vecchio NON sparisce: finisce in previousTokens', async () => {
  const { tokens } = await gira(CLOUD_MAURIZIO);
  esigi(archivio(tokens[MAURIZIO]).includes('tok-aprile'), 'tok-aprile non è nell\'archivio: la scheda di aprile è irraggiungibile');
});

await caso('3. l\'ordine in cui il cloud consegna le righe non conta', async () => {
  const { tokens } = await gira([...CLOUD_MAURIZIO].reverse());
  esigi(tokens[MAURIZIO].token === 'tok-maggio', 'invertendo le righe cambia il corrente: l\'ordine di jsonb_agg deciderebbe il risultato');
  esigi(archivio(tokens[MAURIZIO]).includes('tok-aprile'), 'invertendo le righe si perde il vecchio');
});

await caso('4. il gettone che l\'app aveva PRIMA si archivia, non si perde', async () => {
  const { tokens } = await gira(CLOUD_MAURIZIO, {
    [MAURIZIO]: { memberId: MAURIZIO, token: 'tok-locale-inventato', status: 'created', previousTokens: [] }
  });
  esigi(archivio(tokens[MAURIZIO]).includes('tok-locale-inventato'), 'il gettone locale precedente è stato buttato');
});

await caso('5. l\'archivio non fa doppioni, nemmeno girando due volte', async () => {
  ctx.assessmentTokens = {};
  ctx.RISPOSTA_RPC = { ok: true, data: CLOUD_MAURIZIO };
  await ctx.syncAssessmentTokensFromSupabase({ silent: true });
  await ctx.syncAssessmentTokensFromSupabase({ silent: true });
  const elenco = archivio(ctx.assessmentTokens[MAURIZIO]);
  esigi(elenco.length === new Set(elenco).size, 'archivio con doppioni: ' + elenco.join(', '));
  esigi(!elenco.includes('tok-maggio'), 'il gettone corrente non deve stare anche in archivio');
});

await caso('6. un socio con UN solo gettone resta come prima (archivio vuoto)', async () => {
  const { tokens } = await gira([
    { member_local_id: 'solo-uno', token: 'tok-unico', member_name: 'Davide Giglio', status: 'sent', created_at: '2026-04-25T21:44:23Z' }
  ]);
  esigi(tokens['solo-uno'].token === 'tok-unico', 'gettone corrente sbagliato');
  esigi(archivio(tokens['solo-uno']).length === 0, 'archivio sporco per chi ha un gettone solo');
});

await caso('7. le righe senza socio si saltano, e non nasce la chiave «null»', async () => {
  const { tokens } = await gira([
    { member_local_id: null, token: 'tok-orfano', status: 'created' },
    { member_local_id: 'buono', token: 'tok-buono', status: 'sent', created_at: '2026-05-01T00:00:00Z' }
  ]);
  esigi(!('null' in tokens) && !('undefined' in tokens), 'è nata una chiave fantasma: ' + Object.keys(tokens).join(', '));
  esigi(tokens['buono'], 'la riga buona si è persa insieme all\'orfana');
});

// ── Le due guardie testuali: sorvegliano la METÀ che il banco non può girare ─────────
const senzaCommenti = html
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map(r => r.replace(/(^|[^:'"`])\/\/.*$/, '$1')).join('\n');

await caso('8. 🚨 chi chiede le schede manda ANCHE i gettoni archiviati', async () => {
  const corpo = senzaCommenti.slice(senzaCommenti.indexOf('async function syncAssessmentResponsesFromSupabase'));
  const fino = corpo.slice(0, corpo.indexOf('p_tokens'));
  esigi(/previousTokens/.test(fino),
    'l\'elenco mandato a get_self_assessments_by_tokens non pesca in previousTokens: le schede vecchie restano invisibili');
});

await caso('9. 🚨 la chiamata alle schede si autentica col gettone di SESSIONE, non con la chiave pubblicabile', async () => {
  const corpo = senzaCommenti.slice(senzaCommenti.indexOf('async function syncAssessmentResponsesFromSupabase'));
  const fino = corpo.slice(0, corpo.indexOf('p_tokens'));
  esigi(/pmoGetSupabaseStaffAccessToken/.test(fino),
    'nessun gettone di staff: con la sola chiave pubblicabile la RPC risponde 401 permission denied, per chiunque');
  esigi(!/'Authorization':\s*`Bearer \$\{supabaseKey\}`/.test(fino),
    'l\'Authorization è ancora la chiave pubblicabile');
});

console.log(`\n— ${passati} passati, ${falliti} falliti su ${passati + falliti} casi —`);
process.exit(falliti ? 1 : 0);
