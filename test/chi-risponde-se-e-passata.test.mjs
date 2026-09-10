// ── BANCO: CHI RISPONDE SE LA PRENOTAZIONE È PASSATA (voce 187) ──────────────────
//
// Che cosa prova: che la domanda *«la prenotazione che ho appena provato a scrivere esiste?»*
// abbia un destinatario anche quando il circolo esterno non c'è — e che il destinatario sia il
// **GESTIONALE**, non un secondo indirizzo aggiunto accanto al primo.
//
// 🚨 IL CASO CHE CONTA, ed è quello che questo banco esiste per difendere: **il «no»**. Chi lo
//    legge riprova, e la partita si prenota due volte. ⇒ Deve uscire SOLO da una lettura che è
//    riuscita E che ha potuto vedere tutto. Permesso mancante, rete caduta, pagina piena: `boh`.
//
// ⭐ Le funzioni NON sono ricopiate qui: vengono ESTRATTE da `index.html` e valutate. Un banco che
//    prova una copia del codice prova la copia, non il prodotto.
// ⭐ `fetch` e l'orologio sono iniettati: il ramo della rete si esercita davvero, in un
//    millisecondo e senza rete.
//
// Uso:  node test/chi-risponde-se-e-passata.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const INDEX = join(QUI, '..', 'index.html');
const html = readFileSync(INDEX, 'utf8');

// 🚨⭐⭐ SENZA I COMMENTI, e non è un dettaglio di forma: è costato tre banchi rossi in una sola
//    sessione (09/09). Una cura porta accanto a sé un commento che CITA la frase vecchia per dire
//    che l'ha tolta, e un controllo testuale la legge come se fosse ancora viva. ⇒ Ogni controllo
//    su `index.html` passa di qui. *Un banco che legge i commenti non misura il programma: misura
//    come è stato raccontato.*
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

function estrai(nome) {
  let inizio = html.indexOf(`async function ${nome}(`);
  if (inizio < 0) inizio = html.indexOf(`function ${nome}(`);
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
    else if (c === '/' && succ === '/') { const f = html.indexOf('\n', i); i = f < 0 ? html.length : f; prec = '\n'; continue; }
    else if (c === '/' && succ === '*') { const f = html.indexOf('*/', i + 2); i = f < 0 ? html.length : f + 1; prec = '/'; continue; }
    else if (c === '"' || c === "'" || c === '`') { stringa = c; }
    else if (c === '{') livello++;
    else if (c === '}') { livello--; if (livello === 0) { i++; break; } }
    prec = c;
  }
  return html.slice(inizio, i);
}

// Le costanti vere, lette anch'esse da `index.html`: se un domani cambiassero, il banco deve
// accorgersene invece di provare numeri suoi.
const rigaFinestra = html.match(/const _STAFF_CAL_GEST_FINESTRA_MS = [^;]+;/);
if (!rigaFinestra) throw new Error('`_STAFF_CAL_GEST_FINESTRA_MS` non trovata in index.html');
const rigaPagina = html.match(/const _STAFF_CAL_GEST_PAGINA = [^;]+;/);
if (!rigaPagina) throw new Error('`_STAFF_CAL_GEST_PAGINA` non trovata in index.html');
const rigaEta = html.match(/const _PMO_VERIFICHE_ETA_MAX_MS = [^;]+;/);
if (!rigaEta) throw new Error('`_PMO_VERIFICHE_ETA_MAX_MS` non trovata in index.html');

const ctx = vm.createContext({ console });
vm.runInContext([
  rigaFinestra[0], rigaPagina[0], rigaEta[0],
  estrai('_staffCalNormNome'),
  estrai('_staffCalTokenNome'),
  estrai('staffCalNomiAttesi'),
  estrai('staffCalRiconosceINostriNomi'),
  estrai('staffCalVerdettoDalGestionale'),
  estrai('staffCalChiediAlGestionale'),
].join('\n\n'), ctx);

const verdetto = ctx.staffCalVerdettoDalGestionale;
const chiedi = ctx.staffCalChiediAlGestionale;
const nomiAttesi = ctx.staffCalNomiAttesi;
const FINESTRA = vm.runInContext('_STAFF_CAL_GEST_FINESTRA_MS', ctx);
const PAGINA = vm.runInContext('_STAFF_CAL_GEST_PAGINA', ctx);
const ETA_DEPOSITO = vm.runInContext('_PMO_VERIFICHE_ETA_MAX_MS', ctx);

const NOSTRA = { data: '2026-09-11', ora: '14:30', campoNum: 3, nome: 'Maurizio Aprea, Fabiola Limuti', giocatori: [{ nome: 'Maurizio Aprea' }, { nome: 'Fabiola Limuti' }] };
const riga = (over) => ({ record_type: 'staff_booking', local_key: 'k' + Math.random(), deleted: false, payload: Object.assign({ data: '2026-09-11', ora: '14:30', campo: '3', nome: 'Maurizio Aprea, Fabiola Limuti', giocatori: [{ nome: 'Maurizio Aprea' }, { nome: 'Fabiola Limuti' }] }, over || {}) });

// Un `fetch` finto: dichiara cosa risponde, e registra com'è stato chiamato.
function rete(risposta) {
  const visto = { chiamate: 0, url: '', corpo: null, headers: null };
  const f = async function (url, opzioni) {
    visto.chiamate++; visto.url = url; visto.headers = (opzioni || {}).headers || null;
    try { visto.corpo = JSON.parse((opzioni || {}).body || 'null'); } catch (e) { visto.corpo = null; }
    if (risposta instanceof Error) throw risposta;
    return { ok: risposta.ok !== false, status: risposta.status || 200, text: async () => risposta.testo };
  };
  return { f, visto };
}

let ok = 0, ko = 0;
async function caso(nome, fn) {
  let esito;
  try { esito = await fn(); } catch (e) { esito = false; console.log(`   ↳ eccezione: ${e.message}`); }
  const passato = Array.isArray(esito) ? esito.every(Boolean) : !!esito;
  console.log(`${passato ? '✅' : '❌'} ${nome}`);
  passato ? ok++ : ko++;
}

console.log('\n❓ CHI RISPONDE SE È PASSATA — voce 187\n');

// ── il verdetto, cioè la parte che può sbagliare ──────────────────────────────
await caso('1. riga viva sullo slot coi nostri nomi ⇒ SÌ', () =>
  verdetto([riga()], NOSTRA, false).verdict === 'si');

await caso('2. nessuna riga, lettura completa ⇒ NO (è la risposta che la voce doveva sbloccare)', () =>
  verdetto([], NOSTRA, false).verdict === 'no');

await caso('3. 🚨 nessuna riga ma PAGINA PIENA ⇒ BOH: non ho finito di guardare, il «no» sarebbe inventato', () =>
  verdetto([], NOSTRA, true).verdict === 'boh');

await caso('4. 🚨 slot occupato da un COLLEGA (nomi altrui) ⇒ BOH, mai SÌ', () => {
  const r = verdetto([riga({ nome: 'Giovanni Rossi', giocatori: [{ nome: 'Giovanni Rossi' }] })], NOSTRA, false);
  return r.verdict === 'boh' && r.names.length > 0;
});

await caso('5. la riga è una LAPIDE (deleted) ⇒ non conta: NO', () =>
  verdetto([Object.assign(riga(), { deleted: true })], NOSTRA, false).verdict === 'no');

await caso('6. riga giusta ma su un ALTRO slot (ora diversa) ⇒ NO', () =>
  verdetto([riga({ ora: '15:30' })], NOSTRA, false).verdict === 'no');

await caso('7. riga giusta ma su un ALTRO campo ⇒ NO', () =>
  verdetto([riga({ campo: '4' })], NOSTRA, false).verdict === 'no');

await caso('8. il campo si confronta per NUMERO: «Campo 3» e «3» sono lo stesso campo', () =>
  verdetto([riga({ campo: 'Campo 3' })], NOSTRA, false).verdict === 'si');

await caso('9. basta UNO dei nostri nomi (il roster può essere cambiato dopo)', () =>
  verdetto([riga({ nome: 'Fabiola Limuti', giocatori: [{ nome: 'Fabiola Limuti' }] })], NOSTRA, false).verdict === 'si');

await caso('10. l\'intestazione unita si spezza: cercarla tutta in un nome solo non troverebbe niente', () => {
  const soloNome = { data: '2026-09-11', ora: '14:30', campoNum: 3, nome: 'Maurizio Aprea, Fabiola Limuti', giocatori: [] };
  return nomiAttesi(soloNome).length === 2
    && verdetto([riga({ nome: 'Maurizio Aprea', giocatori: [] })], soloNome, false).verdict === 'si';
});

await caso('11. una riga senza NESSUN nome non conferma niente ⇒ BOH', () =>
  verdetto([riga({ nome: '', giocatori: [] })], NOSTRA, false).verdict === 'boh');

// ── il guscio: la rete, e i modi in cui può andare storta ─────────────────────
await caso('12. chiede al GESTIONALE (PostgREST), non a una edge del circolo', async () => {
  const { f, visto } = rete({ testo: JSON.stringify([riga()]) });
  const r = await chiedi(NOSTRA, { accessToken: 'T' }, 'https://cudi.supabase.co', 'K', { fetch: f });
  return r.verdict === 'si'
    && visto.url === 'https://cudi.supabase.co/rest/v1/rpc/pmo_get_records_admin_page'
    && !/functions\/v1|matchpoint/i.test(visto.url)
    && visto.corpo.p_record_types[0] === 'staff_booking';
});

await caso('13. 🚨 PERMESSO NEGATO ⇒ BOH, mai NO: non guardare non è guardare e non trovare', async () => {
  const { f } = rete({ ok: false, status: 403, testo: JSON.stringify({ message: 'PERMISSION_DENIED' }) });
  const r = await chiedi(NOSTRA, { accessToken: 'T' }, 'https://cudi.supabase.co', 'K', { fetch: f });
  return r.verdict === 'boh' && /PERMISSION_DENIED/.test(r.why);
});

await caso('14. 🚨 la rete cade (eccezione) ⇒ BOH', async () => {
  const { f } = rete(new Error('tcp connect error'));
  const r = await chiedi(NOSTRA, { accessToken: 'T' }, 'https://cudi.supabase.co', 'K', { fetch: f });
  return r.verdict === 'boh';
});

await caso('15. 🚨 risposta che NON è una lista (HTML di un proxy, testo storto) ⇒ BOH', async () => {
  const { f } = rete({ testo: '<html>gateway</html>' });
  const r = await chiedi(NOSTRA, { accessToken: 'T' }, 'https://cudi.supabase.co', 'K', { fetch: f });
  return r.verdict === 'boh';
});

await caso('16. 🚨 pagina PIENA dal vivo ⇒ BOH anche qui, non solo nella funzione pura', async () => {
  const piena = new Array(PAGINA).fill(0).map(() => riga({ ora: '09:00' }));
  const { f } = rete({ testo: JSON.stringify(piena) });
  const r = await chiedi(NOSTRA, { accessToken: 'T' }, 'https://cudi.supabase.co', 'K', { fetch: f });
  return r.verdict === 'boh';
});

await caso('17. la finestra chiesta parte da adesso meno la costante, e supera il deposito (48 h)', async () => {
  const { f, visto } = rete({ testo: '[]' });
  const adesso = Date.parse('2026-09-10T12:00:00.000Z');
  await chiedi(NOSTRA, { accessToken: 'T' }, 'https://cudi.supabase.co', 'K', { fetch: f, adesso });
  return visto.corpo.p_since === new Date(adesso - FINESTRA).toISOString()
    && FINESTRA > ETA_DEPOSITO;
});

await caso('18. il gettone dello staff viaggia: senza, la RPC risponderebbe AUTH_REQUIRED', async () => {
  const { f, visto } = rete({ testo: '[]' });
  await chiedi(NOSTRA, { accessToken: 'T-abc' }, 'https://cudi.supabase.co', 'K', { fetch: f });
  return visto.headers.Authorization === 'Bearer T-abc' && visto.headers.apikey === 'K';
});

// ── il bivio dentro `staffCalAskMatchpoint`, letto SENZA COMMENTI ──────────────
await caso('19. 🚨 il ramo «non collegato al circolo» chiama il gestionale, e NON torna più «boh»', () => {
  const corpo = senzaCommenti(estrai('staffCalAskMatchpoint'));
  const m = corpo.match(/if \(!pmoGestionaleCollegatoAlCircolo\(supabaseUrl\)\) \{([\s\S]*?)\n    \}/);
  return !!m && /staffCalChiediAlGestionale\(/.test(m[1]) && !/verdict: 'boh'/.test(m[1]);
});

await caso('20. 🚨 il bot non deve sentir parlare del worker: la strada nuova non nomina niente di interno', () => {
  const corpo = senzaCommenti(estrai('staffCalChiediAlGestionale')) + senzaCommenti(estrai('staffCalVerdettoDalGestionale'));
  return !/worker|matchpoint|hetzner|caddy|playwright/i.test(corpo);
});

await caso('21. i due destinatari fanno lo STESSO confronto sui nomi (una regola, non due copie)', () => {
  const vecchia = senzaCommenti(estrai('staffCalAskMatchpoint'));
  return /_staffCalNormNome/.test(vecchia) && /_staffCalTokenNome/.test(vecchia);
});

console.log(`\n${ko === 0 ? '✅' : '❌'} ${ok} passati, ${ko} falliti\n`);
process.exit(ko === 0 ? 0 : 1);
