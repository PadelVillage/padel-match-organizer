#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// SENTINELLA DELLA FRESCHEZZA DI TEST — voce 59/C
//
// Guarda periodicamente se test.padelvillage.club sta servendo una copia VECCHIA
// dell'app, e lo dice su Telegram. Gira SULLA VM Hetzner, non su GitHub Actions.
//
// ⭐⭐ PERCHE' SULLA VM E NON SU ACTIONS, che e' il punto di tutta la voce:
//     la cosa da sorvegliare e' la sincronia, che gira SU ACTIONS. Una guardia su
//     Actions morirebbe INSIEME a cio' che sorveglia — cioe' tacerebbe esattamente
//     nel caso per cui esiste. La VM e' l'unico pezzo del sistema che non e' GitHub.
//     ⇒ E per la stessa ragione questa sentinella non dipende da pm2, dal worker,
//        ne' dal bot: e' un timer systemd per conto suo. Se muore tutto il resto,
//        lei parla ancora.
//
// 🚨 SI CONFRONTA IL CONTENUTO, NON IL COMMIT.
//    Il confronto ovvio — source_sha di app-meta.json contro la testa di
//    test-preview — e' SBAGLIATO, ed e' misurato: il 17/08 la copia era fresca al
//    byte (impronta 79d1a3a4 sui due lati) mentre i due commit distavano DODICI
//    passi. Motivo, letto in sync-app.yml: ricopia solo se index.html e' cambiato
//    (`cmp -s` → `exit 0`), quindi ogni commit che tocca solo docs/ allontana il
//    commit senza invecchiare la copia. Una sentinella legata ai commit
//    suonerebbe quasi ogni giorno su copie perfette, e in un mese nessuno la
//    leggerebbe piu' — che e' il modo piu' comune di perdere una protezione senza
//    toglierla. (E' la stessa malattia per cui la strada `synced_at` era gia'
//    stata scartata: qui ripresentata un gradino piu' in la'.)
//
// ⏳ E' PAZIENTE DI PROPOSITO, come guard-worker-sync: la sincronia ha un cron da
//    10 minuti, quindi trovare la copia indietro UNA volta e' normale, non e' un
//    guasto. Suona solo se resta indietro per GIRI CONSECUTIVI.
//
// 🔇 E distingue «indietro» da «non lo so»: se GitHub non risponde la sentinella
//    NON accusa nessuno. Ma se resta cieca a lungo lo dice, perche' una sentinella
//    cieca e una sentinella tranquilla fanno lo stesso identico silenzio.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO_APP = process.env.PMO_REPO_APP || 'PadelVillage/padel-match-organizer';
const RAMO = process.env.PMO_RAMO_TEST || 'test-preview';
const BASE_TEST = process.env.PMO_BASE_TEST || 'https://test.padelvillage.club';
const STATO = process.env.PMO_STATO_FILE || '/opt/sentinella-freschezza-test/stato.json';

// Quanti giri consecutivi «indietro» prima di suonare. Col timer da 15 minuti
// sono 45 minuti: oltre ogni finestra normale del cron da 10' della sincronia.
const GIRI_PRIMA_DI_SUONARE = Number(process.env.PMO_GIRI_PRIMA_DI_SUONARE || 3);
// Quanti giri consecutivi di CECITA' prima di dire «non riesco piu' a guardare».
const GIRI_CIECHI_PRIMA_DI_DIRLO = Number(process.env.PMO_GIRI_CIECHI || 12);
const TETTO_ATTESA_MS = Number(process.env.PMO_TETTO_ATTESA_MS || 15000);

const TOKEN = process.env.TELEGRAM_SENTINELLA_TOKEN || '';
const CHAT = process.env.TELEGRAM_SENTINELLA_CHAT_ID || '';

const ora = () => new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z';
const log = (...a) => console.log(`[${ora()}]`, ...a);

async function prendi(url, opzioni = {}) {
  const r = await fetch(url, {
    ...opzioni,
    signal: AbortSignal.timeout(TETTO_ATTESA_MS),
    headers: { 'User-Agent': 'pmo-sentinella-freschezza-test', ...(opzioni.headers || {}) }
  });
  return r;
}

// L'impronta git di index.html sul ramo/commit chiesto, letta dall'ELENCO della
// radice: poche decine di voci, qualche KB. Chiedere il file si tirerebbe dietro
// 3 MB che non servono a nessuno.
async function improntaIndexHtml(riferimento) {
  const r = await prendi(
    `https://api.github.com/repos/${REPO_APP}/contents/?ref=${encodeURIComponent(riferimento)}`,
    { headers: { Accept: 'application/vnd.github+json' } }
  );
  if (!r.ok) throw new Error(`elenco radice @${riferimento}: HTTP ${r.status}`);
  const radice = await r.json();
  if (!Array.isArray(radice)) throw new Error(`elenco radice @${riferimento}: risposta inattesa`);
  const voce = radice.find((v) => v && (v.name === 'index.html' || v.path === 'index.html'));
  if (!voce || !/^[0-9a-f]{40}$/i.test(voce.sha || '')) throw new Error(`index.html non trovato @${riferimento}`);
  return { impronta: voce.sha.toLowerCase(), dimensione: Number(voce.size) || null };
}

// ── La misura. Torna sempre un verdetto dichiarato: fresca | indietro | cieca ──
export async function misura() {
  // ① Cosa dichiara di servire il dominio di TEST. Si legge il file SERVITO, non
  //    quello nel repo: fra «pubblicare» e «servire» c'e' di mezzo Pages, e il
  //    17/08 si e' visto che le due cose cadono separatamente.
  let meta;
  try {
    const r = await prendi(`${BASE_TEST}/app-meta.json`, { cache: 'no-store' });
    if (!r.ok) return { esito: 'cieca', perche: `app-meta.json servito: HTTP ${r.status}` };
    meta = await r.json();
  } catch (e) {
    return { esito: 'cieca', perche: `app-meta.json servito: ${e.message}` };
  }
  const shaServito = String(meta?.source_sha || '');
  if (!/^[0-9a-f]{40}$/i.test(shaServito)) return { esito: 'cieca', perche: 'app-meta.json servito senza source_sha valido' };

  // ② L'impronta dei due lati. Confronto sul CONTENUTO: e' l'unica cosa che
  //    cambia se e solo se l'app cambia davvero.
  let servita, sorgente;
  try {
    servita = await improntaIndexHtml(shaServito);
    sorgente = await improntaIndexHtml(RAMO);
  } catch (e) {
    return { esito: 'cieca', perche: e.message };
  }

  // ③ Controprova end-to-end: il file davvero servito da Pages e' grande quanto
  //    quello che il meta dichiara? Separa «la copia e' vecchia» da «Pages serve
  //    una cosa diversa da quella che ha pubblicato». Non decide l'allarme —
  //    e' un dato in piu' nel messaggio.
  let servitoCoerente = null;
  try {
    const h = await prendi(`${BASE_TEST}/app.html`, { method: 'HEAD', headers: { 'Accept-Encoding': 'identity' } });
    const len = Number(h.headers.get('content-length'));
    if (h.ok && len && servita.dimensione) servitoCoerente = len === servita.dimensione;
  } catch (e) { /* controprova facoltativa: se non risponde, pazienza */ }

  const indietro = servita.impronta !== sorgente.impronta;
  return {
    esito: indietro ? 'indietro' : 'fresca',
    shaServito, impronta: { servita: servita.impronta, sorgente: sorgente.impronta },
    servitoCoerente
  };
}

// ── Memoria fra un giro e l'altro ────────────────────────────────────────────
function leggiStato() {
  try { return JSON.parse(readFileSync(STATO, 'utf8')); } catch (e) { return {}; }
}
function scriviStato(s) {
  try { mkdirSync(dirname(STATO), { recursive: true }); writeFileSync(STATO, JSON.stringify(s, null, 2)); }
  catch (e) { log('⚠️ non riesco a scrivere lo stato:', e.message); }
}

async function telegram(testo) {
  if (!TOKEN || !CHAT) {
    log('🔇 DISARMATA (manca TELEGRAM_SENTINELLA_TOKEN o _CHAT_ID) — avrei mandato:\n' + testo);
    return false;
  }
  try {
    const r = await prendi(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT, text: testo, parse_mode: 'HTML', disable_web_page_preview: true })
    });
    if (!r.ok) { log('⚠️ Telegram ha rifiutato: HTTP', r.status, (await r.text()).slice(0, 200)); return false; }
    log('📨 messaggio mandato');
    return true;
  } catch (e) { log('⚠️ Telegram non raggiungibile:', e.message); return false; }
}

export async function giro() {
  const s = leggiStato();
  const m = await misura();
  const consecutiviIndietro = m.esito === 'indietro' ? (s.consecutiviIndietro || 0) + 1 : 0;
  const consecutiviCiechi = m.esito === 'cieca' ? (s.consecutiviCiechi || 0) + 1 : 0;
  let allarmeAttivo = !!s.allarmeAttivo;
  let cecitaDetta = !!s.cecitaDetta;
  const mandati = [];

  log(`esito=${m.esito}` + (m.perche ? ` (${m.perche})` : '') +
      (m.impronta ? ` servita=${m.impronta.servita.slice(0, 7)} sorgente=${m.impronta.sorgente.slice(0, 7)}` : '') +
      ` · indietro di fila=${consecutiviIndietro} · ciechi di fila=${consecutiviCiechi}`);

  // ── suona: la copia e' indietro da abbastanza giri, e non l'ho gia' detto ──
  if (m.esito === 'indietro' && consecutiviIndietro >= GIRI_PRIMA_DI_SUONARE && !allarmeAttivo) {
    const minuti = consecutiviIndietro * Number(process.env.PMO_MINUTI_PER_GIRO || 15);
    await telegram(
      `🕰️ <b>TEST sta servendo una copia VECCHIA</b>\n\n` +
      `La sincronia non passa da almeno <b>${minuti} minuti</b>: ${BASE_TEST} mostra codice ` +
      `piu' vecchio del ramo <code>${RAMO}</code>.\n\n` +
      `impronta servita: <code>${m.impronta.servita.slice(0, 12)}</code>\n` +
      `impronta sorgente: <code>${m.impronta.sorgente.slice(0, 12)}</code>\n` +
      (m.servitoCoerente === false ? `⚠️ e Pages sta servendo un file che non corrisponde nemmeno a cio' che ha pubblicato\n` : '') +
      `\n➡️ Da guardare: Actions → <code>sync-app</code> sul repo del caricatore. ` +
      `Se gli schedule si sono spenti da soli (succede dopo ~60 giorni di repo fermo) ` +
      `si riaccendono da li', o si lancia un <code>workflow_dispatch</code>.\n\n` +
      `🚨 Fino ad allora una prova fatta su TEST parla di codice vecchio.`
    );
    mandati.push('allarme');
    allarmeAttivo = true;
  }

  // ── rientro: era suonata, ora e' tornata fresca ──
  if (m.esito === 'fresca' && allarmeAttivo) {
    await telegram(`✅ <b>TEST e' tornato fresco</b>\n\nLa copia servita da ${BASE_TEST} ` +
                   `e' di nuovo allineata a <code>${RAMO}</code> (<code>${m.impronta.sorgente.slice(0, 12)}</code>).`);
    mandati.push('rientro');
    allarmeAttivo = false;
  }

  // ── cecita': una sentinella cieca fa lo stesso silenzio di una tranquilla ──
  if (consecutiviCiechi >= GIRI_CIECHI_PRIMA_DI_DIRLO && !cecitaDetta) {
    await telegram(`🔎 <b>La sentinella di TEST non riesce piu' a guardare</b>\n\n` +
                   `${consecutiviCiechi} giri di fila senza risposta utile. Ultimo motivo: <code>${m.perche || 'ignoto'}</code>.\n\n` +
                   `⚠️ Da adesso il suo silenzio non vuol dire «tutto a posto»: vuol dire che non sta misurando.`);
    mandati.push('cecita');
    cecitaDetta = true;
  }
  if (m.esito !== 'cieca') cecitaDetta = false;

  scriviStato({
    ultimoGiro: ora(), ultimoEsito: m.esito, ultimoPerche: m.perche || null,
    consecutiviIndietro, consecutiviCiechi, allarmeAttivo, cecitaDetta,
    impronta: m.impronta || null, servitoCoerente: m.servitoCoerente ?? null
  });
  return { misura: m, consecutiviIndietro, consecutiviCiechi, allarmeAttivo, cecitaDetta, mandati };
}

// Lanciata direttamente (dal timer): un giro e via. Non resta mai in piedi.
// ⚠️ Il confronto e' sul percorso RISOLTO, non sul nome del file: un controllo per
//    suffisso direbbe di si' anche a un altro file che finisce uguale, ed e' il
//    genere di sonda che risponde con sicurezza della cosa sbagliata.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  giro()
    .then((r) => process.exit(r.misura.esito === 'cieca' ? 0 : 0))   // mai rossa: e' una guardia, non un test
    .catch((e) => { log('💥 giro fallito:', e && e.stack ? e.stack : e); process.exit(0); });
}
