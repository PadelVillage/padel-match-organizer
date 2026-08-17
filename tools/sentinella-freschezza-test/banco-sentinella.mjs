#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// BANCO della sentinella (voce 59/C). Non tocca la rete: fetch e' sostituito.
//   node banco-sentinella.mjs
//
// Prova le cose che una guardia sbaglia di solito, e che rileggendo sembrano a
// posto tutte e quattro:
//   · suona TROPPO PRESTO (e allora in un mese nessuno la legge piu');
//   · suona DUE VOLTE per lo stesso guasto;
//   · scambia «non lo so» per «indietro» — cioe' accusa quando e' cieca;
//   · resta zitta da cieca, che e' lo stesso silenzio di quando va tutto bene.
//
// 🚨 Ogni sabotaggio verifica di essere stato APPLICATO prima di girare: un
//    sabotaggio non applicato da' lo stesso identico verde di un caso cieco.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const A = '1'.repeat(40);   // impronta «vecchia»
const B = '2'.repeat(40);   // impronta «nuova»
const SHA = 'a'.repeat(40);

let scenario = { meta: 'ok', servita: A, sorgente: A, github: 'ok', headLen: 100 };
const inviati = [];

globalThis.fetch = async (url, opz = {}) => {
  const u = String(url);
  if (u.includes('app-meta.json')) {
    if (scenario.meta === 'giu') return { ok: false, status: 503 };
    return { ok: true, status: 200, json: async () => ({ source_sha: SHA }) };
  }
  if (u.includes('api.github.com/repos')) {
    if (scenario.github === 'quota') return { ok: false, status: 403 };
    if (scenario.github === 'rete') throw new Error('getaddrinfo ENOTFOUND');
    const rif = decodeURIComponent(u.split('ref=')[1] || '');
    const sha = rif === SHA ? scenario.servita : scenario.sorgente;
    return { ok: true, status: 200, json: async () => ([
      { name: 'CLAUDE.md', path: 'CLAUDE.md', type: 'file', sha: 'f'.repeat(40), size: 10 },
      { name: 'index.html', path: 'index.html', type: 'file', sha, size: 100 }
    ]) };
  }
  if (u.includes('/app.html')) {
    return { ok: true, status: 200, headers: { get: (k) => (k === 'content-length' ? String(scenario.headLen) : null) } };
  }
  if (u.includes('api.telegram.org')) {
    inviati.push(JSON.parse(opz.body).text);
    return { ok: true, status: 200, text: async () => 'ok' };
  }
  throw new Error('URL non previsto dal banco: ' + u);
};

const dir = mkdtempSync(join(tmpdir(), 'sentinella-'));
process.env.PMO_STATO_FILE = join(dir, 'stato.json');
process.env.TELEGRAM_SENTINELLA_TOKEN = 'finto';
process.env.TELEGRAM_SENTINELLA_CHAT_ID = '1';
process.env.PMO_GIRI_PRIMA_DI_SUONARE = '3';
process.env.PMO_GIRI_CIECHI = '4';

const { giro, prova } = await import('./sentinella.mjs');

let ko = 0, n = 0;
const zittisci = () => { const v = console.log; console.log = () => {}; return () => { console.log = v; }; };
async function passo() { const r = zittisci(); try { return await giro(); } finally { r(); } }
function controlla(nome, cond, dettaglio) {
  n++; if (!cond) ko++;
  console.log(`${cond ? '✅' : '❌'} ${nome}`);
  if (dettaglio) console.log(`     ${dettaglio}`);
}

// ── 1. tutto a posto → silenzio ──────────────────────────────────────────────
inviati.length = 0;
await passo();
controlla('copia fresca → nessun messaggio', inviati.length === 0, `messaggi=${inviati.length}`);

// ── 2. la copia va indietro: PAZIENZA — non suona al 1° ne' al 2° giro ───────
scenario.sorgente = B;                       // il ramo e' andato avanti
inviati.length = 0;
const g1 = await passo();
const g2 = await passo();
controlla('indietro da 1 e 2 giri → ancora zitta (la sincronia ha un cron da 10\')',
  inviati.length === 0 && g1.consecutiviIndietro === 1 && g2.consecutiviIndietro === 2,
  `messaggi=${inviati.length} · di fila=${g2.consecutiviIndietro}`);

// ── 3. al 3° giro suona, UNA volta ───────────────────────────────────────────
const g3 = await passo();
controlla('al 3° giro suona', inviati.length === 1 && /copia VECCHIA/.test(inviati[0] || ''),
  `messaggi=${inviati.length}`);
await passo(); await passo();
controlla('e NON risuona ai giri dopo (un guasto, un messaggio)', inviati.length === 1,
  `messaggi dopo altri 2 giri=${inviati.length}`);

// ── 4. cecita' NON e' un'accusa: GitHub muto non deve produrre allarmi ───────
{
  const dir2 = mkdtempSync(join(tmpdir(), 'sentinella2-'));
  process.env.PMO_STATO_FILE = join(dir2, 'stato.json');
  inviati.length = 0;
  scenario.github = 'quota';
  const a = await passo(); const b = await passo(); const c = await passo();
  controlla('GitHub risponde 403 per 3 giri → nessun allarme di copia vecchia',
    inviati.length === 0 && c.consecutiviIndietro === 0 && c.consecutiviCiechi === 3,
    `messaggi=${inviati.length} · indietro di fila=${c.consecutiviIndietro} (deve restare 0) · ciechi=${c.consecutiviCiechi}`);

  // ── 5. …ma la cecita' prolungata si dichiara ───────────────────────────────
  const d = await passo();
  controlla('al 4° giro cieco lo DICE (una sentinella cieca fa lo stesso silenzio di una tranquilla)',
    inviati.length === 1 && /non riesce piu' a guardare/.test(inviati[0] || ''),
    `messaggi=${inviati.length}`);

  // ── 6. la rete che cade e il dominio giu' sono cecita', non guasto ─────────
  scenario.github = 'rete';
  const e = await passo();
  scenario.github = 'ok'; scenario.meta = 'giu';
  const f = await passo();
  controlla('rete caduta e app-meta.json irraggiungibile → cecita\', mai «indietro»',
    e.misura.esito === 'cieca' && f.misura.esito === 'cieca' && f.consecutiviIndietro === 0,
    `esiti=${e.misura.esito}/${f.misura.esito} · indietro di fila=${f.consecutiviIndietro}`);
  scenario.meta = 'ok';
  rmSync(dir2, { recursive: true, force: true });
}

// ── 7. il rientro si annuncia ────────────────────────────────────────────────
process.env.PMO_STATO_FILE = join(dir, 'stato.json');
inviati.length = 0;
scenario.servita = B;                        // la sincronia e' passata
const r = await passo();
controlla('quando torna fresca lo dice, e l\'allarme si riarma',
  inviati.length === 1 && /tornato fresco/.test(inviati[0] || '') && r.allarmeAttivo === false,
  `messaggi=${inviati.length} · allarmeAttivo=${r.allarmeAttivo}`);

// ── 8. e puo' risuonare per un guasto NUOVO ──────────────────────────────────
inviati.length = 0;
scenario.sorgente = '3'.repeat(40);
await passo(); await passo(); await passo();
controlla('un guasto NUOVO risuona (il silenzio non e\' permanente)',
  inviati.length === 1 && /copia VECCHIA/.test(inviati[0] || ''), `messaggi=${inviati.length}`);

// ── 9. SABOTAGGIO: la pazienza e' davvero misurata? ──────────────────────────
{
  const src = readFileSync(new URL('./sentinella.mjs', import.meta.url), 'utf8');
  const sabotato = src.replace('consecutiviIndietro >= GIRI_PRIMA_DI_SUONARE', 'consecutiviIndietro >= 1');
  const applicato = sabotato !== src;
  if (!applicato) { ko++; n++; console.log('❌ SABOTAGGIO NON APPLICATO — il verde del caso 2 non varrebbe niente'); }
  else {
    const f = join(dir, 'sabotata.mjs');
    (await import('node:fs')).writeFileSync(f, sabotato);
    const dir3 = mkdtempSync(join(tmpdir(), 'sentinella3-'));
    process.env.PMO_STATO_FILE = join(dir3, 'stato.json');
    scenario.servita = A; scenario.sorgente = B; scenario.github = 'ok';
    inviati.length = 0;
    const { giro: giroSab } = await import(f);
    const z = zittisci(); await giroSab(); z();
    controlla('sabotaggio applicato (pazienza a 1): suona SUBITO ⇒ il caso 2 misura davvero',
      inviati.length === 1, `col sabotaggio i messaggi al 1° giro sono ${inviati.length} (senza erano 0)`);
    rmSync(dir3, { recursive: true, force: true });
  }
}

// ── 11-13. `--prova`: l'unica cosa che dimostra che il canale funziona ───────
{
  const dir4 = mkdtempSync(join(tmpdir(), 'sentinella4-'));
  process.env.PMO_STATO_FILE = join(dir4, 'stato.json');
  scenario.servita = A; scenario.sorgente = A; scenario.github = 'ok'; scenario.meta = 'ok';

  inviati.length = 0;
  const z1 = zittisci(); const ok1 = await prova(); z1();
  controlla('--prova armata: manda il messaggio e torna vero',
    ok1 === true && inviati.length === 1 && /installata e ARMATA/.test(inviati[0] || ''),
    `torna ${ok1}, messaggi=${inviati.length}`);

  // Telegram rifiuta (token o chat sbagliati): la PROVA deve dire di NO.
  inviati.length = 0;
  const fetchVero = globalThis.fetch;
  globalThis.fetch = async (u, o = {}) => (String(u).includes('api.telegram.org')
    ? { ok: false, status: 400, text: async () => 'Bad Request: chat not found' }
    : fetchVero(u, o));
  const z2 = zittisci(); const ok2 = await prova(); z2();
  globalThis.fetch = fetchVero;
  controlla('--prova con Telegram che rifiuta: torna FALSO (esce rossa, non verde)',
    ok2 === false && inviati.length === 0,
    `torna ${ok2} (deve essere false), messaggi=${inviati.length}`);

  // Disarmata: non finge di aver mandato.
  inviati.length = 0;
  const t = process.env.TELEGRAM_SENTINELLA_TOKEN; delete process.env.TELEGRAM_SENTINELLA_TOKEN;
  const { prova: provaDisarmata } = await import('./sentinella.mjs?disarmata=1');
  const z3 = zittisci(); const ok3 = await provaDisarmata(); z3();
  process.env.TELEGRAM_SENTINELLA_TOKEN = t;
  controlla('--prova disarmata: torna falso e non finge di aver mandato',
    ok3 === false && inviati.length === 0, `torna ${ok3}, messaggi=${inviati.length}`);
  rmSync(dir4, { recursive: true, force: true });
}

// ── 14-17. il TOKEN PRESO IN PRESTITO dal bot di prova, e il BATTITO ─────────
{
  const dir5 = mkdtempSync(join(tmpdir(), 'sentinella5-'));
  const envFinto = join(dir5, 'bot-prova.env');
  writeFileSync(envFinto, [
    '# commento con dentro un finto 111:xxx che NON deve passare',
    'NODE_ENV=production',
    'QUALCHE_ALTRA_COSA="valore"',
    'UNA_RIGA_QUALUNQUE=7654321:AAHfinto-token-del-bot-di-prova-lungo-abbastanza',
    ''
  ].join('\n'));

  // Il token si riconosce dalla FORMA: la riga si chiama UNA_RIGA_QUALUNQUE apposta.
  process.env.PMO_ENV_BOT_PROVA = envFinto;
  delete process.env.TELEGRAM_SENTINELLA_TOKEN;
  process.env.PMO_STATO_FILE = join(dir5, 'stato.json');
  scenario.servita = A; scenario.sorgente = A; scenario.github = 'ok'; scenario.meta = 'ok';
  inviati.length = 0;
  const { giro: giroPrestito, prova: provaPrestito } = await import('./sentinella.mjs?prestito=1');
  const zp = zittisci(); const okp = await provaPrestito(); zp();
  controlla('token PRESO IN PRESTITO dal .env del bot di prova, riconosciuto dalla FORMA (non dal nome della riga)',
    okp === true && inviati.length === 1, `--prova torna ${okp}, messaggi=${inviati.length}`);

  // Il .env del bot non c'e' → disarmata, non finge.
  process.env.PMO_ENV_BOT_PROVA = join(dir5, 'non-esiste.env');
  inviati.length = 0;
  const { prova: provaSenza } = await import('./sentinella.mjs?senza=1');
  const zs = zittisci(); const oks = await provaSenza(); zs();
  controlla('se il .env del bot di prova sparisce: disarmata e lo dice, non finge di aver mandato',
    oks === false && inviati.length === 0, `--prova torna ${oks}, messaggi=${inviati.length}`);

  // ── e soprattutto: DICE PERCHE'. Un «non ci sono riuscito» muto costa un giro
  //    di indovinelli — e il 17/08 e' costato esattamente quello sulla VM vera.
  //    ⚠️ L'ordine conta: sentinella.mjs legge le variabili all'IMPORT, quindi vanno
  //    impostate PRIMA (sbagliato al primo tentativo, e il banco l'ha detto subito).
  async function fonteVoceCon(envBot, statoFile) {
    process.env.PMO_ENV_BOT_PROVA = envBot;
    process.env.PMO_STATO_FILE = statoFile;
    const { giro: g } = await import(`./sentinella.mjs?fv=${encodeURIComponent(statoFile)}`);
    const z = zittisci(); await g(); z();
    return JSON.parse(readFileSync(statoFile, 'utf8')).fonteVoce || '';
  }

  const fv1 = await fonteVoceCon(join(dir5, 'non-esiste.env'), join(dir5, 'st1.json'));
  controlla("quando la voce manca, lo stato dice PERCHE': file assente E nessun processo",
    /: assente/.test(fv1) && /nessun processo in esecuzione/.test(fv1), `fonteVoce = "${fv1}"`);

  const senzaToken = join(dir5, 'senza-token.env');
  writeFileSync(senzaToken, 'NODE_ENV=production\nPORT=3000\n');
  const fv2 = await fonteVoceCon(senzaToken, join(dir5, 'st2.json'));
  controlla("e distingue «file assente» da «il file c'e' ma nessuna riga ha la forma di un token»",
    /c'è ma nessuna riga ha la forma di un token/.test(fv2), `fonteVoce = "${fv2}"`);

  // ── il pezzo che conta davvero: il token letto dall'AMBIENTE DI UN PROCESSO VIVO.
  //    Sulla VM il .env non esiste, quindi e' QUESTA la strada che verra' usata —
  //    e una strada mai provata e' una strada che non si sa se esiste.
  //    Si fa nascere un processo finto con un token nell'ambiente e un marcatore
  //    nella riga di comando, e si punta li' la sentinella.
  //    ⚠️ Il token deve stare nell'ambiente AL MOMENTO DELL'EXEC: /proc/<pid>/environ
  //    e' una fotografia della partenza, non l'ambiente vivo.
  if (existsSync('/proc/self/environ')) {
    const { spawn } = await import('node:child_process');
    const MARCATORE = 'MARCATORE-BANCO-SENTINELLA';
    const figlio = spawn(process.execPath,
      ['-e', `/*${MARCATORE}*/ setTimeout(() => {}, 8000)`],
      { env: { ...process.env, UN_NOME_QUALUNQUE: '9988776655:AAHtoken-finto-nell-ambiente-del-processo' },
        stdio: 'ignore' });
    await new Promise((r) => setTimeout(r, 400));
    process.env.PMO_CARTELLA_BOT_PROVA = MARCATORE;
    const fv3 = await fonteVoceCon(join(dir5, 'non-esiste.env'), join(dir5, 'st3.json'));
    figlio.kill();
    delete process.env.PMO_CARTELLA_BOT_PROVA;
    controlla('il token si legge dall\'AMBIENTE del processo vivo (la strada che serve sulla VM, dove il .env non c\'è)',
      /ambiente del processo \d+/.test(fv3) && /bot 9988776655/.test(fv3), `fonteVoce = "${fv3}"`);
  } else {
    console.log('⏭️  niente /proc qui: il caso «token dall\'ambiente del processo» non è stato provato');
  }

  // Il BATTITO: al primo giro NON batte (lo ha gia' fatto il --prova del deploy)...
  process.env.PMO_ENV_BOT_PROVA = envFinto;
  const dir6 = mkdtempSync(join(tmpdir(), 'sentinella6-'));
  process.env.PMO_STATO_FILE = join(dir6, 'stato.json');
  inviati.length = 0;
  const { giro: giroBattito } = await import('./sentinella.mjs?battito=1');
  const zb = zittisci(); await giroBattito(); await giroBattito(); zb();
  controlla('il battito NON parte al primo giro (sarebbero due messaggi in 15 minuti)',
    inviati.length === 0, `messaggi dopo 2 giri appena installata=${inviati.length}`);

  // ...ma dopo sette giorni sì. Si invecchia lo stato invece di aspettare una settimana.
  const st = JSON.parse(readFileSync(join(dir6, 'stato.json'), 'utf8'));
  st.ultimoBattito = st.ultimoBattito - 8 * 86400000;
  writeFileSync(join(dir6, 'stato.json'), JSON.stringify(st));
  inviati.length = 0;
  const zb2 = zittisci(); await giroBattito(); await giroBattito(); zb2();
  controlla('dopo 7 giorni batte UNA volta: «se smette di arrivare, ho smesso di guardare»',
    inviati.length === 1 && /sono viva/.test(inviati[0] || ''),
    `messaggi=${inviati.length} (deve essere 1, non 1 per giro)`);

  rmSync(dir5, { recursive: true, force: true });
  rmSync(dir6, { recursive: true, force: true });
}

rmSync(dir, { recursive: true, force: true });
console.log(`\n${ko === 0 ? '🟢 BANCO VERDE' : '🔴 BANCO ROSSO'} — ${n - ko}/${n}`);
process.exit(ko === 0 ? 0 : 1);
