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

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
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

// ── La voce: da dove viene il token ──────────────────────────────────────────
// Scelta del committente, 17/08/2026: *«facciamo la B perché il bot di test non lo
// leveremo mai»*. ⇒ La sentinella non ha un bot suo: parla con quello di PROVA, il
// cui token e' gia' sulla VM nella cartella accanto.
//
// ⚖️ Il rischio che questa scelta accetta, dichiarato e non taciuto: la voce della
//    sentinella dipende da un pezzo che non e' suo. Lui ha risposto sul RITIRO del
//    bot ("non lo leveremo mai"), che e' una decisione sua e vale. Resta l'altra
//    meta' — il token che CAMBIA o si rompe — e quella non si decide, quindi e'
//    chiusa altrove: col BATTITO settimanale piu' in basso.
//
// 🔎 Il token si riconosce dalla FORMA, non dal nome della riga: nel .env del bot
//    quella variabile puo' chiamarsi in molti modi, e un parser legato al nome si
//    romperebbe in silenzio il giorno che qualcuno la rinomina — restituendo
//    "nessun token" con la stessa sicurezza con cui restituirebbe la verita'.
const CARTELLA_BOT_PROVA = process.env.PMO_CARTELLA_BOT_PROVA || '/opt/assistente-padel-agent-prova';
const ENV_BOT_PROVA = process.env.PMO_ENV_BOT_PROVA || `${CARTELLA_BOT_PROVA}/.env`;
const FILE_CANDIDATI = [ENV_BOT_PROVA, `${CARTELLA_BOT_PROVA}/.env.local`, `${CARTELLA_BOT_PROVA}/.env.prova`];
const FORMA_TOKEN = /\b(\d{6,}:[A-Za-z0-9_-]{30,})\b/;

// 🚨 Torna anche il PERCHE' quando non trova niente. La prima versione aveva un
//    `catch { return '' }` e un `return ''` muti: al primo giro sulla VM lo stato ha
//    detto `fonteVoce: "nessuna"` e non c'era modo di sapere se il file mancava, se
//    era illeggibile o se nessuna riga aveva la forma giusta.
//    ⚖️ E' la malattia di questa voce commessa DENTRO la sua cura: un guasto che non
//    dice cosa e' andato storto. Un «non ci sono riuscito» senza motivo costa un giro
//    di indovinelli a chiunque lo legga.
function cercaNelTesto(testo, separatore) {
  for (const riga of testo.split(separatore)) {
    const pulita = riga.trim();
    if (!pulita || pulita.startsWith('#')) continue;
    const m = pulita.replace(/^[A-Za-z0-9_]+\s*=\s*/, '').replace(/^["']|["']$/g, '').match(FORMA_TOKEN);
    if (m) return m[1];
  }
  return '';
}

// 🚨 E il .env NON C'ERA — misurato sulla VM il 17/08, non supposto.
//    La strada «prendi il token dal .env del bot di prova» poggiava su un'assunzione
//    che non avevo provato: che quel bot tenga il token in un file lì dentro. Non lo
//    fa. ⇒ Si cerca dove il token sta DI SICURO se il bot gira: nel suo AMBIENTE.
//    Un processo vivo che parla con Telegram ha per forza il suo token, comunque
//    gliel'abbiano dato — file, pm2, systemd o riga di comando.
// ⚖️ E' la 26ª al contrario: non un limite dichiarato e mai provato, ma una CAPACITA'
//    dichiarata e mai provata. Costa uguale, e si smaschera allo stesso modo:
//    eseguendo.
function tokenDalProcessoDiProva() {
  let pid = '';
  try {
    for (const voce of readdirSync('/proc')) {
      if (!/^\d+$/.test(voce)) continue;
      let cmd;
      try { cmd = readFileSync(`/proc/${voce}/cmdline`, 'utf8'); } catch (e) { continue; }
      if (!cmd.includes(CARTELLA_BOT_PROVA)) continue;
      pid = voce;
      let amb;
      try { amb = readFileSync(`/proc/${voce}/environ`, 'utf8'); } catch (e) {
        return { token: '', motivo: `ambiente del processo ${voce} illeggibile (${e.code || e.message})` };
      }
      const t = cercaNelTesto(amb, '\0');
      if (t) return { token: t, motivo: '', dove: `ambiente del processo ${voce}` };
    }
  } catch (e) {
    return { token: '', motivo: `/proc illeggibile (${e.code || e.message})` };
  }
  return { token: '', motivo: pid
    ? `il processo ${pid} del bot di prova gira, ma non ha un token nel suo ambiente`
    : `nessun processo in esecuzione da ${CARTELLA_BOT_PROVA}` };
}

function tokenDalBotDiProva() {
  // ① i file, in ordine: e' la strada piu' stabile quando c'e'.
  const provati = [];
  for (const f of FILE_CANDIDATI) {
    let testo;
    try { testo = readFileSync(f, 'utf8'); } catch (e) { provati.push(`${f}: ${e.code === 'ENOENT' ? 'assente' : e.code || e.message}`); continue; }
    const t = cercaNelTesto(testo, '\n');
    if (t) return { token: t, motivo: '', dove: f };
    provati.push(`${f}: c'è ma nessuna riga ha la forma di un token`);
  }
  // ② l'ambiente del processo vivo: se il bot gira, il token ce l'ha per forza.
  const dalProcesso = tokenDalProcessoDiProva();
  if (dalProcesso.token) return dalProcesso;
  return { token: '', motivo: `${dalProcesso.motivo}; file: ${provati.join(' · ')}` };
}

const TOKEN_PROPRIO = process.env.TELEGRAM_SENTINELLA_TOKEN || '';
const PRESTITO = TOKEN_PROPRIO ? { token: '', motivo: '' } : tokenDalBotDiProva();
const TOKEN = TOKEN_PROPRIO || PRESTITO.token;
// Da dove viene la voce, in chiaro nel registro. Del token si nomina solo la parte
// PRIMA dei due punti — e' l'id pubblico del bot, non il segreto.
const FONTE_VOCE = TOKEN_PROPRIO ? 'secret proprio'
  : (PRESTITO.token ? `bot di prova — ${PRESTITO.dove} (bot ${PRESTITO.token.split(':')[0]})`
                    : `NESSUNA — ${PRESTITO.motivo}`);
const CHAT = process.env.TELEGRAM_SENTINELLA_CHAT_ID || '';

// 💓 IL BATTITO. Ogni tanto un «sono viva» anche quando va tutto bene.
// 🚨 Serve a rendere VERIFICABILE la frase «silenzio = tutto a posto», che altrimenti
//    e' una speranza: una sentinella muta (token cambiato, bot rotto, VM spenta) fa
//    lo stesso identico silenzio di una sentinella tranquilla. Col battito, il
//    silenzio che conta diventa l'ASSENZA del battito — una cosa che si nota.
//    Ed e' la cura precisa del rischio che la scelta di prendere in prestito il
//    token si porta dietro.
// Si spegne con PMO_BATTITO_GIORNI=0.
const BATTITO_GIORNI = Number(process.env.PMO_BATTITO_GIORNI ?? 7);

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

  log(`voce=${FONTE_VOCE} · esito=${m.esito}` + (m.perche ? ` (${m.perche})` : '') +
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

  // ── 💓 il battito: rende verificabile «silenzio = tutto a posto» ──────────
  // Non parte se c'e' un allarme in corso (li' i messaggi arrivano gia'), ne' se
  // e' cieca: un battito da cieca direbbe «sto guardando» mentre non guarda.
  // 🚨 Al PRIMISSIMO giro l'orologio si fa partire SENZA battere. Senza questa riga
  //    una sentinella appena installata batteva subito, e siccome il deploy ha gia'
  //    mandato il «👋 sono armata» il socio ne riceveva DUE a un quarto d'ora di
  //    distanza. Il battito del giorno zero e' il --prova: qui si comincia a contare.
  //    (Trovato al banco: il caso «copia fresca → nessun messaggio» e' caduto rosso.)
  let ultimoBattito = s.ultimoBattito || 0;
  if (!ultimoBattito) {
    ultimoBattito = Date.now();
  } else if (BATTITO_GIORNI > 0 && m.esito === 'fresca' && !allarmeAttivo &&
      (Date.now() - ultimoBattito) > BATTITO_GIORNI * 86400000) {
    if (await telegram(
      `💓 <b>Sentinella di TEST: sono viva</b>\n\n` +
      `${BASE_TEST} sta servendo la versione giusta ` +
      `(<code>${m.impronta.sorgente.slice(0, 7)}</code>). Niente da segnalare.\n\n` +
      `📌 Questo arriva ogni ${BATTITO_GIORNI} giorni <b>apposta</b>: se smette di arrivare, ` +
      `vuol dire che ho smesso di guardare — e quello è l'unico silenzio di cui preoccuparsi.`
    )) { mandati.push('battito'); }
    ultimoBattito = Date.now();   // anche se non e' partito: non si riprova a raffica
  }

  scriviStato({
    ultimoGiro: ora(), ultimoEsito: m.esito, ultimoPerche: m.perche || null,
    consecutiviIndietro, consecutiviCiechi, allarmeAttivo, cecitaDetta,
    impronta: m.impronta || null, servitoCoerente: m.servitoCoerente ?? null,
    fonteVoce: FONTE_VOCE, ultimoBattito
  });
  return { misura: m, consecutiviIndietro, consecutiviCiechi, allarmeAttivo, cecitaDetta, mandati };
}

// ─────────────────────────────────────────────────────────────────────────────
// `--prova`: manda UN messaggio e dice se ce l'ha fatta. Serve al momento
// dell'armamento, ed e' l'unico modo di sapere che il canale funziona.
//
// 🚨 Senza questo, chi mette i secret non riceve NIENTE finche' non c'e' un guasto
//    ⇒ scoprirebbe che il canale e' rotto (token sbagliato, chat_id sbagliato, il
//    bot che non puo' scrivere per primo) esattamente nel momento in cui serve.
//    Una guardia che non ha mai parlato e una guardia che non PUO' parlare fanno
//    lo stesso identico silenzio: e' la malattia di questa voce, applicata a lei.
// ⚖️ E a differenza del giro normale, questo ESCE ROSSO se il messaggio non parte:
//    e' una prova, non una guardia, e una prova che fallisce deve farsi vedere.
// ─────────────────────────────────────────────────────────────────────────────
export async function prova() {
  log(`--prova: voce = ${FONTE_VOCE}, chat = ${CHAT ? 'impostata' : 'MANCANTE'}`);
  // 🚨 DUE esiti diversi, non uno.
  //    «non ho ancora una voce» e «ho una voce e Telegram l'ha rifiutata» sono due
  //    cose diverse, e trattarle uguale rende il deploy rosso per una credenziale che
  //    manca — cioe' per una cosa in attesa, non per una cosa rotta. Un rosso che sta
  //    li' per un motivo noto e accettato e' un rosso che si smette di leggere, ed e'
  //    la stessa ragione per cui guard-worker-sync e' stata resa paziente.
  if (!TOKEN || !CHAT) {
    log("🔇 --prova: DISARMATA — non c'è niente da provare, manca " +
        (!CHAT ? 'il chat id' : 'il token') + '.');
    return 'disarmata';
  }
  const m = await misura();
  const ok = await telegram(
    `👋 <b>Sentinella di TEST installata e ARMATA</b>\n\n` +
    `Da adesso guardo ogni 15′ se ${BASE_TEST} sta servendo una copia vecchia, ` +
    `e parlo <b>solo se c'è qualcosa da dire</b>: silenzio = tutto a posto` +
    (BATTITO_GIORNI > 0 ? `, più un 💓 ogni ${BATTITO_GIORNI} giorni per farti sapere che sto ancora guardando` : '') +
    `.\n\n` +
    `Misura di adesso: <b>${m.esito}</b>` +
    (m.impronta ? ` (servita <code>${m.impronta.servita.slice(0, 7)}</code>, sorgente <code>${m.impronta.sorgente.slice(0, 7)}</code>)` : '') +
    (m.perche ? `\n<code>${m.perche}</code>` : '') +
    `\n\n📌 Questo è l'unico messaggio che ricevi «perché sì»: è la prova che il canale funziona.`
  );
  log(ok ? '✅ --prova: messaggio partito' : '❌ --prova: il messaggio NON è partito');
  return ok;
}

// Lanciata direttamente (dal timer): un giro e via. Non resta mai in piedi.
// ⚠️ Il confronto e' sul percorso RISOLTO, non sul nome del file: un controllo per
//    suffisso direbbe di si' anche a un altro file che finisce uguale, ed e' il
//    genere di sonda che risponde con sicurezza della cosa sbagliata.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--prova')) {
    // 0 = mandato · 2 = disarmata (in attesa, non rotta) · 1 = aveva una voce e non ha
    // funzionato — l'unico caso che merita un rosso.
    prova()
      .then((esito) => process.exit(esito === true ? 0 : esito === 'disarmata' ? 2 : 1))
      .catch((e) => { log('💥 --prova fallita:', e && e.stack ? e.stack : e); process.exit(1); });
  } else {
    giro()
      .then(() => process.exit(0))              // mai rossa: e' una guardia, non un test
      .catch((e) => { log('💥 giro fallito:', e && e.stack ? e.stack : e); process.exit(0); });
  }
}
