#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// SENTINELLA DELLA SALUTE DEL DATABASE — voce 161
//
// Misura ogni giorno i numeri che l'avaria della voce 160 aveva reso visibili
// per settimane senza che nessuno li guardasse, e SUONA su Telegram quando
// escono di riga. Gira su GitHub Actions, non sulla VM.
//
// ⭐⭐ PERCHE' SU ACTIONS E NON SULLA VM — e non e' una svista, e' l'opposto della
//     scelta fatta per la sorella (la sentinella della freschezza di TEST).
//     Quella sorveglia la SINCRONIA, che gira su Actions: metterla su Actions
//     l'avrebbe fatta morire insieme a cio' che guarda. Questa sorveglia
//     SUPABASE, che con Actions non ha niente a che vedere ⇒ l'argomento non si
//     applica, e cade il motivo per spostarla.
//     ⚖️ E cade a favore, per una ragione di sicurezza dichiarata: per leggere
//        `pg_stat_user_tables` e `pg_ls_waldir()` serve una credenziale di
//        AMMINISTRAZIONE del progetto Supabase. Su Actions quel token e' gia' li'
//        (`SUPABASE_ACCESS_TOKEN`, lo stesso dei deploy) e non esce mai; portarlo
//        sulla VM vorrebbe dire posare una chiave che puo' cancellare il database
//        accanto ai due bot. Una guardia non si paga allargando la superficie che
//        difende.
//     ⛔ Il prezzo, detto e non taciuto: se Actions e' in avaria questa sentinella
//        tace, e gli schedule di GitHub si spengono da soli dopo ~60 giorni di
//        repo fermo. Il primo caso costa un giorno di misura (il delta della
//        lettura dopo lo recupera: si normalizza sul tempo passato, non sui giri);
//        il secondo si vede perche' smette di arrivare il BATTITO.
//
// 🚨 LA MEMORIA STA NEL DATABASE CHE GUARDA, non in un file accanto al programma.
//    Un delta vuole la lettura di ieri, e su Actions non c'e' un «accanto» che
//    duri: la cache si sfratta, un file committato sporcherebbe il repo ogni
//    notte. Nella tabella `pmo_sentinella_salute` invece la memoria e' storia —
//    e se il database e' morto la sentinella non legge, quindi esce CIECA, che e'
//    l'unica cosa onesta da dire quando non si e' guardato.
//
// ⏳ E' PAZIENTE, come guard-worker-sync e come la sorella: suona alla SECONDA
//    lettura fuori riga di fila, non alla prima. Un travaso in blocco (un import,
//    un backfill) sposta i numeri per un giorno ed e' normale; il difetto della
//    160 era li' da settimane. Una guardia che ogni tanto ha torto e' una guardia
//    che si smette di leggere.
// ─────────────────────────────────────────────────────────────────────────────

import { pathToFileURL } from 'node:url';
import { deltaFra, giudica, leggibile, regoleDiIeri, evolviRegole, SOGLIE } from './misura.mjs';

const API = 'https://api.supabase.com/v1';
const TOKEN_SUPABASE = process.env.SUPABASE_ACCESS_TOKEN || '';
const REF = process.env.PMO_PROGETTO_REF || 'qqbfphyslczzkxoncgex';
const NOME = process.env.PMO_PROGETTO_NOME || 'PROD';
const TOKEN_TG = process.env.TELEGRAM_SENTINELLA_TOKEN || '';
const CHAT = process.env.TELEGRAM_SENTINELLA_CHAT_ID || '';
const GIRI_PRIMA_DI_SUONARE = Number(process.env.PMO_GIRI_PRIMA_DI_SUONARE || 2);
const BATTITO_GIORNI = Number(process.env.PMO_BATTITO_GIORNI ?? 7);
const TETTO_ATTESA_MS = Number(process.env.PMO_TETTO_ATTESA_MS || 30000);
const QUANTE_TABELLE = Number(process.env.PMO_QUANTE_TABELLE || 25);

const MUTO = process.argv.includes('--muto');     // misura e giudica, non scrive e non manda
const PROVA = process.argv.includes('--prova');   // manda un messaggio e basta

const ora = () => new Date().toISOString();
const log = (...a) => console.log(`[${ora()}]`, ...a);

async function prendi(url, opzioni = {}) {
  const taglio = AbortSignal.timeout ? AbortSignal.timeout(TETTO_ATTESA_MS) : undefined;
  return fetch(url, { ...opzioni, signal: taglio });
}

// ── Il filo verso il database: l'API di gestione, la stessa che usano i deploy ──
async function sql(query) {
  if (!TOKEN_SUPABASE) throw new Error('manca SUPABASE_ACCESS_TOKEN');
  const r = await prendi(`${API}/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN_SUPABASE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`Supabase HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

// Una stringa dentro SQL si mette fra apici, e gli apici dentro si raddoppiano.
// Il contenuto qui e' roba nostra (nomi di tabelle, JSON che abbiamo costruito),
// ma un'abitudine giusta non si sospende perche' oggi l'ingresso e' fidato.
const lett = (s) => `'${String(s).replace(/'/g, "''")}'`;

const QUERY_MISURA = `
select jsonb_build_object(
  'quando', now(),
  'db_bytes', pg_database_size(current_database()),
  'wal_su_disco', (select coalesce(sum(size),0) from pg_ls_waldir()),
  'wal_file', (select count(*) from pg_ls_waldir()),
  'lsn_bytes', pg_wal_lsn_diff(pg_current_wal_lsn(), '0/0')::bigint,
  -- 🚨 06/09: l'LSN avanza di un segmento ogni archive_timeout (120 s) anche a database
  --    fermo. Il WAL SCRITTO davvero e' pg_stat_wal.wal_bytes — e si azzera col riavvio
  --    come gli altri contatori, quindi il delta lo tratta allo stesso modo.
  'wal_scritto', (select wal_bytes from pg_stat_wal),
  'wal_segmento', (select setting::bigint from pg_settings where name = 'wal_segment_size'),
  'archive_timeout_s', (select setting::int from pg_settings where name = 'archive_timeout'),
  -- Il guasto della 160 per nome: l'archiviazione che fallisce.
  'archivio', (select jsonb_build_object(
      'archiviati', archived_count, 'falliti', failed_count,
      'ultimo_ok', last_archived_time, 'ultimo_fallito', last_failed_time,
      'ultimo_segmento', last_archived_wal) from pg_stat_archiver),
  'avvio', pg_postmaster_start_time(),
  'tabelle', (select coalesce(jsonb_agg(jsonb_build_object(
      'nome', relname, 'ins', n_tup_ins, 'upd', n_tup_upd, 'hot', n_tup_hot_upd,
      'del', n_tup_del, 'vive', n_live_tup, 'morte', n_dead_tup) order by n_tup_upd desc), '[]'::jsonb)
    from (select * from pg_stat_user_tables order by n_tup_upd desc limit ${QUANTE_TABELLE}) t)
) as m;`;

async function misuraOra() {
  const righe = await sql(QUERY_MISURA);
  const m = Array.isArray(righe) ? righe[0]?.m : righe?.m;
  if (!m) throw new Error('la query di misura non ha risposto con una misura');
  return m;
}

async function ultimaLettura() {
  const righe = await sql(
    `select misurato_at, misura, verdetto, regole, consecutivi, allarme_attivo, ultimo_battito
       from public.pmo_sentinella_salute
      where progetto = ${lett(NOME)} and misura is not null
      order by id desc limit 1;`);
  return (Array.isArray(righe) ? righe[0] : null) || null;
}

async function salva(riga) {
  await sql(
    `insert into public.pmo_sentinella_salute
       (progetto, misura, verdetto, regole, consecutivi, allarme_attivo, ultimo_battito, mandati)
     values (${lett(NOME)}, ${lett(JSON.stringify(riga.misura))}::jsonb, ${lett(riga.verdetto)},
             ${lett(JSON.stringify(riga.regole))}::jsonb, ${Number(riga.consecutivi)},
             ${riga.allarmeAttivo ? 'true' : 'false'},
             ${riga.ultimoBattito ? lett(riga.ultimoBattito) + '::timestamptz' : 'null'},
             ${lett(JSON.stringify(riga.mandati))}::jsonb);
     delete from public.pmo_sentinella_salute where misurato_at < now() - interval '400 days';`);
}

// 🚨 Con quale bot sta parlando lo si CHIEDE a Telegram, non lo si deduce dal
//    file da cui viene il token: sono due cose diverse, e il 18/08 la differenza
//    e' costata tre giri alla sorella.
async function chiSonoSuTelegram() {
  if (!TOKEN_TG) return '';
  try {
    const r = await prendi(`https://api.telegram.org/bot${TOKEN_TG}/getMe`);
    if (!r.ok) return '';
    const d = await r.json();
    return d?.result?.username ? '@' + d.result.username : '';
  } catch { return ''; }
}

async function telegram(testo) {
  if (!TOKEN_TG || !CHAT) {
    log('🔇 DISARMATA (manca TELEGRAM_SENTINELLA_TOKEN o _CHAT_ID) — avrei mandato:\n' + testo);
    return false;
  }
  if (MUTO) { log('🤐 --muto: non mando. Avrei mandato:\n' + testo); return false; }
  try {
    const r = await prendi(`https://api.telegram.org/bot${TOKEN_TG}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT, text: testo, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    if (!r.ok) { log('⚠️ Telegram ha rifiutato: HTTP', r.status, (await r.text()).slice(0, 200)); return false; }
    log('📨 messaggio mandato');
    return true;
  } catch (e) { log('⚠️ Telegram non raggiungibile:', e.message); return false; }
}

const pieDiPagina = (m, delta) => {
  const finestra = delta.finestraMs > 0
    ? `finestra misurata: <b>${(delta.finestraMs / 3600000).toFixed(1)} ore</b>`
    : 'prima lettura';
  return `database ${leggibile(m.db_bytes)} · WAL sul disco ${leggibile(m.wal_su_disco)} · ${finestra}\n`;
};

// Gli allarmi NUOVI di questo giro; quelli gia' detti e ancora in piedi si citano
// in una riga, senza rifare la lezione — e' la forma che non stanca chi legge.
function testoAllarme(nuovi, ancoraAttivi, regole, delta, m) {
  const nonGiudicate = regole.filter(r => r.esito === 'non-giudicata');
  const vecchi = ancoraAttivi.filter(r => !nuovi.some(n => n.codice === r.codice));
  return (
    `🩺 <b>Salute del database ${NOME}: qualcosa e' fuori riga</b>\n\n` +
    nuovi.map(a => `<b>${a.titolo}</b>\n${a.dettaglio}`).join('\n\n') +
    `\n\n──────────\n` +
    pieDiPagina(m, delta) +
    (vecchi.length
      ? `🔁 ancora fuori riga da prima: ${vecchi.map(r => `<code>${r.codice}</code>`).join(', ')}\n`
      : '') +
    (nonGiudicate.length
      ? `⚠️ non ho potuto giudicare: ${nonGiudicate.map(r => `<code>${r.codice}</code>`).join(', ')} — questo <b>non</b> vuol dire che siano a posto.\n`
      : '') +
    `\n➡️ Da guardare: <code>pg_stat_user_tables</code>, <code>pg_stat_wal</code> e <code>pg_stat_archiver</code> sul progetto <code>${REF}</code>, ` +
    `e la storia in <code>pmo_sentinella_salute</code>.\n` +
    `📌 Questo e' il genere di numero che il 05/09 e' cresciuto per settimane senza che nessuno lo guardasse.`
  );
}

function testoRientro(rientri, ancoraAttivi, delta, m) {
  return (
    `✅ <b>Salute del database ${NOME}: ${rientri.length === 1 ? 'una misura e\' rientrata' : 'alcune misure sono rientrate'}</b>\n\n` +
    rientri.map(r => `<code>${r.codice}</code> — ${r.dettaglio || 'dentro le soglie'}`).join('\n') +
    `\n\n──────────\n` +
    pieDiPagina(m, delta) +
    (ancoraAttivi.length
      ? `🔁 ancora fuori riga: ${ancoraAttivi.map(r => `<code>${r.codice}</code>`).join(', ')}\n`
      : `Niente piu' fuori riga.\n`)
  );
}

export async function giro() {
  let m = null, prima = null, errore = null;
  try {
    prima = await ultimaLettura();
    m = await misuraOra();
  } catch (e) { errore = e.message; }

  // ── CIECA: non ho guardato. Non accuso nessuno e non faccio avanzare niente. ──
  if (!m) {
    log(`❌ cieca: ${errore}`);
    await telegram(
      `🔎 <b>La sentinella della salute di ${NOME} non riesce a guardare</b>\n\n` +
      `Motivo: <code>${(errore || 'ignoto').slice(0, 300)}</code>\n\n` +
      `⚠️ Da adesso il suo silenzio non vuol dire «tutto a posto»: vuol dire che non sta misurando.`);
    return { verdetto: 'cieca', perche: errore };
  }

  const delta = deltaFra(prima?.misura || null, m);
  const g = giudica(m, delta, SOGLIE);
  // 🚨 Gli allarmi si contano e si ricordano PER REGOLA (misura.mjs, `evolviRegole`):
  //    un solo «attivo» per tutto il giro faceva tacere ogni guasto nuovo finche'
  //    ne restava in piedi uno vecchio.
  const s = evolviRegole(regoleDiIeri(prima), g.regole, GIRI_PRIMA_DI_SUONARE);
  const { consecutivi, allarmeAttivo } = s;
  let ultimoBattito = prima?.ultimo_battito || null;
  const mandati = [];

  log(`progetto=${NOME} · verdetto=${g.verdetto} · delta=${delta.stato}` +
      ` · finestra=${(delta.finestraMs / 3600000).toFixed(2)}h · di fila=${consecutivi}` +
      ` · attivi=${s.attivi.map(r => r.codice).join(',') || '(nessuno)'}`);
  for (const r of s.regole) {
    const segno = r.esito === 'allarme' ? '🔴' : r.esito === 'a-posto' ? '🟢' : '⚪';
    log(`   ${segno} ${r.codice}${r.esito === 'allarme' ? ` (di fila ${r.di_fila}${r.attivo ? ', gia\' detto' : ''})` : ''}: ${r.titolo || r.dettaglio || r.perche}`);
  }

  let dettoAdesso = false;
  if (s.nuovi.length) {
    if (await telegram(testoAllarme(s.nuovi, s.attivi, s.regole, delta, m))) { mandati.push('allarme'); dettoAdesso = true; }
  }
  if (s.rientri.length) {
    if (await telegram(testoRientro(s.rientri, s.attivi, delta, m))) { mandati.push('rientro'); dettoAdesso = true; }
  }

  // 💓 Il battito: e' cio' che rende verificabile «silenzio = tutto a posto».
  //    Ogni messaggio mandato vale come battito (dimostra che guardo). Se non e'
  //    partito niente per BATTITO_GIORNI, batto — anche con un allarme in piedi:
  //    un allarme detto una volta e poi silenzio per un mese sarebbe indistinguibile
  //    da una sentinella morta. Al primissimo giro fa partire l'orologio SENZA
  //    battere — chi installa ha gia' ricevuto il --prova.
  if (dettoAdesso) {
    ultimoBattito = ora();
  } else if (!ultimoBattito) {
    ultimoBattito = ora();
  } else if (BATTITO_GIORNI > 0 && g.verdetto !== 'non-giudicabile' &&
             Date.now() - new Date(ultimoBattito).getTime() > BATTITO_GIORNI * 86400000) {
    if (await telegram(
      `💓 <b>Sentinella della salute di ${NOME}: sono viva</b>\n\n` +
      `Database ${leggibile(m.db_bytes)} · WAL sul disco ${leggibile(m.wal_su_disco)}. ` +
      (s.attivi.length
        ? `Ancora fuori riga: ${s.attivi.map(r => `<code>${r.codice}</code>`).join(', ')} — gia' detto, niente di nuovo.\n\n`
        : `Niente da segnalare.\n\n`) +
      `📌 Questo arriva ogni ${BATTITO_GIORNI} giorni <b>apposta</b>: se smette di arrivare, ` +
      `vuol dire che ho smesso di guardare — e quello e' l'unico silenzio di cui preoccuparsi.`)) mandati.push('battito');
    ultimoBattito = ora();
  }

  if (!MUTO) {
    await salva({ misura: m, verdetto: g.verdetto, regole: s.regole, consecutivi, allarmeAttivo, ultimoBattito, mandati });
  } else {
    log('🤐 --muto: non scrivo la lettura nel database.');
  }
  return { verdetto: g.verdetto, delta, regole: s.regole, consecutivi, allarmeAttivo, nuovi: s.nuovi, rientri: s.rientri, mandati };
}

// `--prova`: manda UN messaggio e dice se ce l'ha fatta. Tre esiti, non due —
// «non ho una voce» e «ho una voce e non e' partito» sono cose diverse, e un
// rosso per una credenziale che manca e' un rosso che si smette di leggere.
export async function prova() {
  const chi = await chiSonoSuTelegram();
  log(`--prova: voce = ${chi || '(non risponde)'}, chat = ${CHAT ? 'impostata' : 'MANCANTE'}`);
  if (!TOKEN_TG || !CHAT) {
    log("🔇 --prova: DISARMATA — manca " + (!CHAT ? 'il chat id' : 'il token') + '.');
    return 'disarmata';
  }
  const fatto = await telegram(
    `👋 <b>Sentinella della salute del database: sono armata</b>\n\n` +
    `Da adesso guardo <b>${NOME}</b> (<code>${REF}</code>) una volta al giorno: ` +
    `quanto WAL produce, quante volte le tabelle si riscrivono, quanti aggiornamenti ` +
    `saltano la via veloce (HOT), quante righe morte restano.\n\n` +
    `Se qualcosa esce di riga te lo dico qui. Se non dico niente per ${BATTITO_GIORNI} giorni ` +
    `mando un battito, cosi' sai che sto ancora guardando.\n\n` +
    `📌 Voce 161 — nata dall'avaria del 05/09, che era visibile da settimane in tre numeri ` +
    `che nessuno guardava.`);
  return fatto ? 'mandato' : 'rotto';
}

const eseguitoDirettamente = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (eseguitoDirettamente) {
  const fine = (c) => process.exit(c);
  if (PROVA) {
    prova().then(e => fine(e === 'mandato' ? 0 : e === 'disarmata' ? 2 : 1))
           .catch(e => { log('❌', e.message); fine(1); });
  } else {
    giro().then(r => fine(r.verdetto === 'cieca' ? 1 : 0))
          .catch(e => { log('❌', e.message); fine(1); });
  }
}
