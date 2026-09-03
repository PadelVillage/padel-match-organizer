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
// 🚨🧰 QUESTO BANCO ERA MUTO, e non da oggi: era rosso su 10 prove su 13 mentre la funzione che
// sorveglia funzionava benissimo. Due marciture, tutt'e due dello STRUMENTO:
//   · il contesto isolato non aveva `cleanCell`, che la funzione ha cominciato a usare quando le è
//     entrata dentro `identita` (la potatura dei fantasmi, 10/08) ⇒ ogni prova moriva sul nascere.
//     Si porta dentro quella VERA, estratta dall'HTML: una finta scritta qui potrebbe divergere da
//     quella dell'app senza che nessuno se ne accorga;
//   · la funzione da allora non torna più un array ma `{ members, retired, live, rowAt }`, e il
//     banco leggeva ancora `.length` sul risultato intero.
// ⇒ ⭐⭐ Un banco che nessuno fa girare non protegge niente: era verde l'ultima volta che qualcuno
// l'ha guardato, e da allora il codice sotto è cambiato tre volte. Va nel giro, o non esiste.
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
  vm.runInContext(estrai('cleanCell') + '\n' + estrai('pmoLoadAllMembersFromCloud'), ctx);
  const esito = await ctx.pmoLoadAllMembersFromCloud();
  return { soci: esito.members, esito, chiamata };
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

// ── L'OROLOGIO DELLE RIGHE, e la regola che ci decide sopra (11/08/2026, «la lapide») ────────
// Il gestionale mostrava un livello e un codice vecchi mentre il cloud aveva quelli giusti: la
// copia del browser era FERMA e nessuno la ricuciva. La radice sta nel campo su cui si decide chi
// è più recente — `payload.updatedAt` non lo aggiorna chi corregge nel cloud (2.785 righe vive su
// 2.795 lo avevano fermo da oltre un giorno) — quindi si guarda `updated_at` DELLA RIGA.
// ⚠️ `estrai` sa prendere solo le funzioni: l'elenco dei campi è una `const`, e senza di lei la
// regola muore con «PMO_MEMBER_CLOUD_FIELDS is not defined». Si prende quella VERA dall'HTML —
// scriverne una copia qui vorrebbe dire che il giorno in cui si aggiunge un campo il banco resta
// verde misurando l'elenco di ieri.
function estraiCost(nome) {
  const inizio = html.indexOf(`const ${nome} = `);
  if (inizio < 0) throw new Error(`costante ${nome} non trovata`);
  const fine = html.indexOf(';', inizio);
  return html.slice(inizio, fine + 1);
}

const regola = () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(estraiCost('PMO_MEMBER_CLOUD_FIELDS') + '\n' + estrai('pmoCloudTsMs') + '\n' + estrai('pmoMemberFieldsFromCloud'), ctx);
  return ctx;
};

caso('13. l\'orologio arriva dalle righe VIVE, per identità — e le lapidi non lo sporcano', async () => {
  const { esito } = await scarica([
    { record_type: 'member', local_key: 'email:a@prova.local', deleted: false,
      updated_at: '2026-08-11 10:30:37.700616+00', payload: { id: 'x1', name: 'Ada', updatedAt: '2026-07-17T20:17:49.450Z' } },
    { record_type: 'member', local_key: 'phone:391', deleted: true,
      updated_at: '2026-08-09 10:30:36.98085+00', payload: { id: 'x1', name: 'Ada', updatedAt: '2026-08-09T10:30:03.689Z' } },
  ]);
  return [
    // ⚠️ non `instanceof Map`: la funzione gira in un contesto isolato, dove `Map` è un'ALTRA
    // classe con lo stesso nome — l'`instanceof` direbbe di no su una mappa perfettamente buona.
    typeof esito.rowAt?.get === 'function',
    esito.rowAt.get('x1') === '2026-08-11 10:30:37.700616+00',   // la viva, non la lapide
    esito.retired.has('x1') && esito.live.has('x1'),             // la stessa identità sta in tutt'e due
  ];
});

caso('14. 🚨 il cloud detta solo se la sua RIGA è più recente — non se lo dice il payload', async () => {
  const ctx = regola();
  const locale = { id: 'x1', level: 0.5, pmoPlayerId: 'PMO-000222', updatedAt: '2026-08-09T10:30:03.689Z' };
  const cloud  = { id: 'x1', level: 4,   pmoPlayerId: 'PMO-000523', updatedAt: '2026-07-17T20:17:49.450Z' };
  // ① la forma reale: il payload del cloud è PIÙ VECCHIO, ma la riga è stata scritta dopo
  const a = ctx.pmoMemberFieldsFromCloud(locale, cloud, '2026-08-11 10:30:37.700616+00');
  // ② la modifica fatta qui e non ancora spinta: la riga del cloud è indietro ⇒ non si tocca
  const b = ctx.pmoMemberFieldsFromCloud(locale, cloud, '2026-08-01 10:00:00.000000+00');
  // ③ niente da cambiare ⇒ non si dichiara un cambiamento (o l'elenco si riscriverebbe a vuoto)
  const c = ctx.pmoMemberFieldsFromCloud(locale, { id: 'x1', level: 0.5, pmoPlayerId: 'PMO-000222' }, '2026-08-11 10:30:37.700616+00');
  return [
    a.changed === true, Number(a.next.level) === 4, a.next.pmoPlayerId === 'PMO-000523',
    b.changed === false, Number(b.next.level) === 0.5,
    c.changed === false,
  ];
});

caso('15. ciò che il cloud NON NOMINA non si cancella; ciò che ha svuotato arriva vuoto', async () => {
  const ctx = regola();
  const locale = { id: 'x1', level: 4, phone: '351 900 0011', pmoPlayerId: 'PMO-000523', updatedAt: '2026-08-09T10:30:03.689Z' };
  const RECENTE = '2026-08-11 10:30:37.700616+00';
  const senzaTel = ctx.pmoMemberFieldsFromCloud(locale, { id: 'x1', level: 5 }, RECENTE);
  const codiceVuoto = ctx.pmoMemberFieldsFromCloud(locale, { id: 'x1', pmoPlayerId: '' }, RECENTE);
  return [
    senzaTel.next.phone === '351 900 0011',        // il telefono non nominato resta
    Number(senzaTel.next.level) === 5,
    codiceVuoto.changed === true,
    codiceVuoto.next.pmoPlayerId === '',           // le utenze di servizio stanno senza codice
    codiceVuoto.next.level === 4,                  // e il resto non si muove
  ];
});

caso('16. l\'orologio digerisce il formato di Postgres, o il confronto tornerebbe sempre zero', async () => {
  const ctx = regola();
  return [
    ctx.pmoCloudTsMs('2026-08-11 10:30:37.700616+00') > 0,
    ctx.pmoCloudTsMs('2026-08-11T10:30:37.700Z') > 0,
    ctx.pmoCloudTsMs('2026-08-11 10:30:37.700616+00') > ctx.pmoCloudTsMs('2026-08-09T10:30:03.689Z'),
    ctx.pmoCloudTsMs('') === 0,
    ctx.pmoCloudTsMs('non una data') === 0,
  ];
});

caso('17. 🚨 i SATELLITI del livello arrivano col livello, o l\'automatismo gira in cerchio', async () => {
  const ctx = regola();
  const locale = { id: 'x1', level: 0.5, updatedAt: '2026-08-09T10:30:03.689Z' };
  const cloud = { id: 'x1', level: 2, levelSource: 'autovalutazione',
                  selfAssessmentDate: '2026-06-23T10:00:00.000Z', lastLevelUpdateAt: '2026-08-11T23:00:00.000Z' };
  const esito = ctx.pmoMemberFieldsFromCloud(locale, cloud, '2026-08-11 23:00:01.000000+00');
  // Senza `lastLevelUpdateAt` in locale, al primo salvataggio di scheda il browser lo
  // rispingerebbe vuoto e l'edge riapplicherebbe la stessa scheda al giro dopo.
  return [
    esito.changed === true,
    Number(esito.next.level) === 2,
    esito.next.levelSource === 'autovalutazione',
    esito.next.lastLevelUpdateAt === '2026-08-11T23:00:00.000Z',
    esito.next.selfAssessmentDate === '2026-06-23T10:00:00.000Z',
  ];
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
// ── 🆔 L'ID INTERNO MATCHPOINT — e PERCHÉ sta fuori dal confronto sulla freschezza ──────────
// 📏 Difetto misurato il 03/09/2026 sulla scheda del 04/09 C3 14:00, su TEST: il nome di
// Michele Marchi si apriva (289) e quelli di Erika Poser (239) e Marta Morelli (187) no —
// mentre nel cloud tutti e tre avevano il loro id, identico. La causa: `matchpointIdInterno`
// non era in `PMO_MEMBER_CLOUD_FIELDS`, quindi per un socio GIÀ in localStorage non arrivava
// MAI. Chi ce l'aveva, ce l'aveva solo perché la sua riga era entrata dopo.
//
// 🚨⭐⭐ E il caso 18 è quello che protegge la DECISIONE, non il calcolo: la cura «ovvia» —
// aggiungere il campo a `PMO_MEMBER_CLOUD_FIELDS` — è verde su tutti gli altri casi e
// FALLISCE solo qui, perché quell'elenco si copia unicamente quando la riga del cloud è più
// fresca della copia locale. Un id non compete sulla freschezza: è l'indirizzo della persona
// su Matchpoint. Dentro il gate la cura resterebbe inerte proprio per i soci che ne hanno
// bisogno — quelli fermi in locale da prima che il numero esistesse, cioè tutti.
//
// ⚖️ È la stessa forma della chiave `cloudLocalKey` del 28/08, curata dieci righe sopra nello
// stesso file: *una cura che produce un valore che nessuno riceve è verde in ogni banco che
// guardi il produttore invece del destinatario.*
// Toglie commenti e stringhe: una guardia deve rompersi su ciò che è SBAGLIATO, non su ciò
// che ne PARLA. Il 03/09 tre sonde di fila hanno pescato il commento che spiega perché una
// cosa non si fa, e sono state rosse (o verdi) per il testo invece che per il codice.
function soloCodice(testo) {
  let out = '', stringa = null, prec = '';
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i], succ = testo[i + 1];
    if (stringa) { if (c === stringa && prec !== '\\') stringa = null; prec = c; continue; }
    if (c === '/' && succ === '/') { const f = testo.indexOf('\n', i); i = f < 0 ? testo.length : f; out += '\n'; prec = '\n'; continue; }
    if (c === '/' && succ === '*') { const f = testo.indexOf('*/', i + 2); i = f < 0 ? testo.length : f + 1; out += ' '; prec = ' '; continue; }
    if (c === '"' || c === "'" || c === '`') { stringa = c; prec = c; continue; }
    out += c; prec = c;
  }
  return out;
}

const regolaId = () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(estrai('cleanCell') + '\n' + estrai('pmoIdInternoDalCloud'), ctx);
  return ctx;
};

caso('18. il socio fermo in locale IMPARA l\'id interno dal cloud', async () => {
  const ctx = regolaId();
  return [
    ctx.pmoIdInternoDalCloud({ matchpointIdInterno: '' }, { matchpointIdInterno: '239' }) === '239',
    ctx.pmoIdInternoDalCloud({}, { matchpointIdInterno: '187' }) === '187',
    // già uguale ⇒ niente da imparare (o l'elenco si riscriverebbe a vuoto ad ogni giro)
    ctx.pmoIdInternoDalCloud({ matchpointIdInterno: '289' }, { matchpointIdInterno: '289' }) === '',
  ];
});

caso('19. ⛔ un cloud SENZA id non PROPONE niente — e chi chiama scrive solo su proposta', async () => {
  const ctx = regolaId();
  // È il verso pericoloso: l'id lo scrive l'app quando aggiunge un giocatore a una partita,
  // quindi può esistere qui PRIMA che la riga del cloud lo porti. Cancellarlo spegnerebbe il
  // nome cliccabile proprio per i soci su cui aveva funzionato.
  //
  // 🚨🧰 E QUESTO CASO, SCRITTO COM'ERA, PASSAVA PER LA RAGIONE SBAGLIATA — trovato
  // sabotandolo il 03/09. La funzione torna «il valore da scrivere», quindi davanti a un cloud
  // vuoto torna '' comunque: togliendole la riga di guardia il caso restava VERDE. Cioè
  // sorvegliava una cosa che non poteva rompersi, mentre la cosa che può rompersi — che chi
  // chiama scriva SOLO su proposta non vuota — non la guardava nessuno.
  // ⇒ La metà che conta è la seconda, ed è una guardia sul CODICE di chi chiama.
  // 📌 *Un sabotaggio che lascia verde non dice che la cura è solida: dice che la prova non
  //    guarda dove sta il rischio.*
  const proposte = [
    ctx.pmoIdInternoDalCloud({ matchpointIdInterno: '289' }, {}) === '',
    ctx.pmoIdInternoDalCloud({ matchpointIdInterno: '289' }, { matchpointIdInterno: '' }) === '',
    ctx.pmoIdInternoDalCloud({ matchpointIdInterno: '289' }, { matchpointIdInterno: '   ' }) === '',
  ];
  // La scrittura nell'idratazione è CONDIZIONATA. Si guarda il solo codice: la parola
  // `matchpointIdInterno` compare qui sopra una dozzina di volte nei commenti che spiegano
  // la regola, e una sonda ingenua pescherebbe la spiegazione invece dell'assegnamento.
  const corpo = soloCodice(estrai('pmoEnsureCloudMembersHydrated'));
  const scritturaGuardata = /if\s*\(\s*idImparato\s*\)\s*g\.matchpointIdInterno\s*=/.test(corpo);
  const scrittureTotali = (corpo.match(/g\.matchpointIdInterno\s*=/g) || []).length;
  return [
    ...proposte,
    scritturaGuardata,          // si scrive solo se c'è una proposta
    scrittureTotali === 1,      // e non c'è una seconda scrittura non guardata
  ];
});

caso('20. 🚨 l\'id NON passa dal confronto sulla freschezza — la strada sbagliata muore qui', async () => {
  const ctx = regolaId();
  const regolaCampi = regola();
  const VECCHIA = '2026-08-01 10:00:00.000000+00';   // la riga del cloud è INDIETRO
  const locale = { id: 'x1', matchpointIdInterno: '', updatedAt: '2026-08-09T10:30:03.689Z' };
  const cloud  = { id: 'x1', matchpointIdInterno: '239' };
  // ① la via giusta: fuori dal gate, l'id arriva anche con la riga del cloud vecchia
  const fuori = ctx.pmoIdInternoDalCloud(locale, cloud);
  // ② la via sbagliata, simulata: dentro `pmoMemberFieldsFromCloud` non arriverebbe MAI —
  //    e non perché il campo non c'è, ma perché il gate chiude prima. Lo si mostra su un
  //    campo che NELL'ELENCO C'È DAVVERO, così il caso non regge su una svista.
  const dentro = regolaCampi.pmoMemberFieldsFromCloud(
    { id: 'x1', level: 0.5, updatedAt: '2026-08-09T10:30:03.689Z' },
    { id: 'x1', level: 4 },
    VECCHIA,
  );
  return [
    fuori === '239',
    dentro.changed === false,   // ⇐ la prova che il gate chiude: il livello NON passa
  ];
});

// ── Guardia testuale: il campo non deve finire nell'elenco che passa dal gate ────────────────
// ⚠️ Cerca nel SOLO CODICE, non nei commenti: qui sopra la parola `matchpointIdInterno` compare
// una dozzina di volte proprio per spiegare perché lì non ci va, e una sonda ingenua pescherebbe
// la spiegazione invece del difetto — è successo tre volte il 03/09.
const elencoCampi = (() => {
  const i = html.indexOf('const PMO_MEMBER_CLOUD_FIELDS');
  return i < 0 ? '' : html.slice(i, html.indexOf(';', i));
})();
guardie.push([
  'matchpointIdInterno NON è in PMO_MEMBER_CLOUD_FIELDS (starebbe dietro il gate sulla freschezza)',
  !!elencoCampi && !elencoCampi.includes('matchpointIdInterno'),
]);

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
