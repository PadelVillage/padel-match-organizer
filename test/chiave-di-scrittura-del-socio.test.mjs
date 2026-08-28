// chiave-di-scrittura-del-socio.test.mjs — VOCE 105 (28/08/2026)
//
// 🚨⭐⭐ IL GUASTO CHE QUESTO BANCO ESISTE PER FERMARE, visto succedere su PROD.
// Alle 22:17 del 28/08 una modifica di livello dalla segreteria ha SDOPPIATO Maurizio Aprea, e
// due minuti dopo il bot gli ha risposto «preferisco non scegliere al posto tuo» — perché con
// due righe il ponte non può sapere chi è. Con lo stesso difetto quel socio non riesce nemmeno
// ad aprire il test (`consumer-assessment-link` ha la stessa difesa).
//
// 📏 LA CAUSA, isolata misurando e non rileggendo: le righe `member` toccate per minuto quella
// sera erano `17:31 → 1096` (giro di massa: il sync) contro `20:08 → 1`, `20:17 → 1`,
// `20:21 → 1`. Le tre da UNA riga sola sono i gesti della segreteria. ⇒ Il doppione lo fa una
// SCRITTURA SINGOLA dell'app, non l'import — e il passaggio di consegne lo attribuiva al sync.
//
// ⚖️ LA REGOLA CHE SI PROTEGGE QUI, in una riga: *chi scrive un socio scrive sulla riga che è
// VIVA, non su una chiave che si è calcolato da sé.* Una scrittura non deve poter inventare
// un'identità, e men che meno riportare in vita una riga che qualcuno aveva archiviato.
//
// 🚨 LE PROVE SONO SUL COMPORTAMENTO, non sul testo: le funzioni si ESTRAGGONO da `index.html`
// e si eseguono. Un banco che cercasse la stringa `cloudLocalKey` resterebbe verde davanti a un
// ramo spento — è la lezione del 19/08.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const INDEX = join(QUI, '..', 'index.html');
const html = readFileSync(INDEX, 'utf8');

// Stesso estrattore degli altri banchi che leggono `index.html`: salta i commenti, che in
// italiano sono pieni di apostrofi e manderebbero in tilt il conteggio delle graffe.
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
  return html.slice(inizio, i);
}

// Le costanti (array/oggetti) non sono funzioni: si estraggono con la loro parentesi quadra.
function estraiCost(nome) {
  const i = html.indexOf(`const ${nome} =`);
  if (i < 0) throw new Error(`costante «${nome}» non trovata in index.html`);
  const fine = html.indexOf('];', i);
  // 🚨 Si toglie il `const`: dentro `vm.runInContext` una dichiarazione `const` resta nello
  //    scope dello script e NON compare sul contesto — il banco leggerebbe `undefined` e
  //    fallirebbe su codice giusto. Senza `const` diventa un'assegnazione globale.
  return html.slice(i, fine + 2).replace(/^const\s+/, '');
}

const ctx = { pmoShortHash: () => 'HASH' };
vm.createContext(ctx);
vm.runInContext(
  [estrai('cleanCell'), estrai('pmoMemberCloudLocalKey'), estrai('pmoBuildMemberCloudRecord')].join('\n'),
  ctx,
);
const { pmoMemberCloudLocalKey: chiave, pmoBuildMemberCloudRecord: costruisci } = ctx;

// Il socio come esce dall'idratazione: porta la chiave della riga da cui è stato letto.
const socio = (extra = {}) => ({
  id: '7d454239-929a-4346-8ba0-ec778d7763a3',
  name: 'Maurizio Aprea',
  phone: '+39 335 7615855',
  level: '4',
  ...extra,
});

// ══════════════════════════════════════════════════════════════════════════════════════════
test('① 🚨 IL CASO DI MAURIZIO: chi vive su `email:` si riscrive su `email:`, non su `phone:`', () => {
  // Questo è il guasto, riprodotto: prima della cura tornava `phone:393357615855` — una riga
  // DIVERSA da quella viva, e per Maurizio una riga ARCHIVIATA dal 19 luglio, che la scrittura
  // avrebbe riportato in vita.
  const m = socio({ cloudLocalKey: 'email:aprea.maurizio@gmail.com' });
  assert.equal(chiave(m), 'email:aprea.maurizio@gmail.com');
  assert.notEqual(chiave(m), 'phone:393357615855');
});

test('② e vale anche per `name:` e per le chiavi legacy, che sono gli altri 4 esposti', () => {
  assert.equal(chiave(socio({ cloudLocalKey: 'name:maurizio aprea' })), 'name:maurizio aprea');
  assert.equal(chiave(socio({ cloudLocalKey: '7d454239-929a-4346-8ba0-ec778d7763a3' })),
    '7d454239-929a-4346-8ba0-ec778d7763a3');
});

test('③ 🚨 I 2788 SOCI GIÀ SU `phone:` NON SI MUOVONO — è il danno grande da non fare', () => {
  // ⛔ La scorciatoia che verrebbe in mente (invertire l'ordine delle regole) cambierebbe la
  //    chiave a tutti loro. Qui si aggiunge un gradino SOPRA, e chi sta già su `phone:` ci resta.
  assert.equal(chiave(socio({ cloudLocalKey: 'phone:393357615855' })), 'phone:393357615855');
  // E chi non porta nessuna chiave — un socio NUOVO, creato qui e mai letto dal cloud — segue
  // la regola di sempre: il telefono. Toglierla romperebbe la creazione.
  assert.equal(chiave(socio()), 'phone:393357615855');
});

test('④ una chiave VUOTA non conta come chiave: si ricade sulla regola di sempre', () => {
  // 🚨 Serve davvero: `cleanCell` di una riga senza `local_key` torna stringa vuota, e un
  //    `if (viva)` scritto male la prenderebbe per buona producendo `local_key: ''`.
  for (const vuota of ['', '   ', null, undefined]) {
    assert.equal(chiave(socio({ cloudLocalKey: vuota })), 'phone:393357615855');
  }
});

test('⑤ 🚨 il campo NON finisce nel payload scritto nel cloud', () => {
  // Serve a decidere DOVE scrivere, non è un dato del socio: lasciarlo entrare vorrebbe dire
  // che il prossimo che legge l'anagrafica lo scambia per un campo vero e ci si fida.
  const rec = costruisci(socio({ cloudLocalKey: 'email:aprea.maurizio@gmail.com' }));
  assert.equal(rec.local_key, 'email:aprea.maurizio@gmail.com');
  assert.equal('cloudLocalKey' in rec.payload, false);
  // …e il resto del socio ci deve essere ancora: togliere un campo non deve togliere gli altri.
  assert.equal(rec.payload.name, 'Maurizio Aprea');
  assert.equal(rec.payload.level, '4');
});

test('⑥ 🚨 anche l\'ARCHIVIAZIONE segue la riga viva, o archivierebbe la riga sbagliata', () => {
  // ⚖️ È il caso peggiore di tutti: `pmoBuildMemberCloudRecord(m, {deleted:true})` con la chiave
  //    calcolata avrebbe messo la lapide su una riga diversa da quella viva — cioè avrebbe
  //    lasciato vivo il socio che si voleva archiviare E scritto una lapide su un'altra riga.
  const rec = costruisci(socio({ cloudLocalKey: 'email:aprea.maurizio@gmail.com' }), { deleted: true });
  assert.equal(rec.local_key, 'email:aprea.maurizio@gmail.com');
  assert.equal(rec.deleted, true);
  assert.equal(rec.payload.active, false);
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// 🚨 IL CABLAGGIO: le prove qui sopra girano sulla funzione, e resterebbero verdi se nessuno
// le passasse mai la chiave. Qui si misura che l'IDRATAZIONE la porti davvero — e che la porti
// dalla riga, non da una costante.
/* ══════════════════════════════════════════════════════════════════════════════════════════
   🩹🚨⭐⭐ 28/08 tarda sera — I CASI CHE MANCAVANO, E CHE SONO COSTATI UN SOCIO SDOPPIATO.
   La prima stesura di questo banco provava il PRODUTTORE (`pmoLoadAllMembersFromCloud` mette
   `cloudLocalKey`) e la funzione in isolamento. Era tutto verde, e la cura era **inerte**:
   il valore non arrivava MAI al socio che poi viene scritto, perché la fusione copia solo i
   campi di `PMO_MEMBER_CLOUD_FIELDS`. 📏 Misurato pagando: Fabiola Limuti si è sdoppiata lo
   stesso alle 20:54:23, con la cura in servizio su PROD da otto minuti.
   📌 *Una cura che produce un valore che nessuno riceve è verde in ogni banco che guardi il
   produttore invece del destinatario.* ═══════════════════════════════════════════════════ */

test('⑧ 🚨 LA FUSIONE DEI CAMPI NON PORTA LA CHIAVE — ed è il motivo per cui serve la riga esplicita', () => {
  // Non è un difetto di `pmoMemberFieldsFromCloud`: è il suo mestiere, copia una lista chiusa.
  // Questo caso esiste per fissare il FATTO, così chi domani togliesse la riga esplicita
  // pensando «tanto la fusione la porta» vede subito che non è vero.
  const ctx2 = { };
  vm.createContext(ctx2);
  vm.runInContext([estrai('cleanCell'), estrai('pmoCloudTsMs'), estraiCost('PMO_MEMBER_CLOUD_FIELDS'),
                   estrai('pmoMemberFieldsFromCloud')].join('\n'), ctx2);
  assert.equal(ctx2.PMO_MEMBER_CLOUD_FIELDS.includes('cloudLocalKey'), false,
    'se un giorno ci entrasse, questo caso va riscritto — non cancellato');
  const locale = { id: 'X', name: 'Tizio', level: '1.5', updatedAt: '2026-01-01T00:00:00Z' };
  const cloud = { id: 'X', name: 'Tizio', level: '2', cloudLocalKey: 'email:tizio@x.it' };
  const esito = ctx2.pmoMemberFieldsFromCloud(locale, cloud, '2026-08-28T00:00:00Z');
  assert.equal(esito.changed, true, 'il livello è cambiato: la fusione deve scattare');
  assert.equal(esito.next.cloudLocalKey, undefined, 'la fusione NON porta la chiave: serve la riga esplicita');
});

test('⑨ 🚨 …quindi l\'idratazione la scrive DA SÉ, e FUORI dal confronto sulla freschezza', () => {
  /* 🚨 Le due metà si misurano separate perché falliscono in modi diversi:
     · la riga può mancare del tutto (è com'era stasera: cura inerte);
     · la riga può esserci ma DENTRO `if (esito.changed)` — e allora un socio la cui copia
       locale è già aggiornata non riceverebbe mai la chiave, che è il caso più comune. */
  const fn = html.slice(html.indexOf('async function pmoEnsureCloudMembersHydrated'));
  const giro = fn.slice(fn.indexOf('giocatori.forEach((g, i) =>'), fn.indexOf('PMO_CLOUD_MEMBERS_REFRESHED'));
  assert.match(giro, /g\.cloudLocalKey = chiaveViva/,
    'l\'idratazione non scrive la chiave sul socio: la cura è inerte');
  assert.ok(giro.indexOf('g.cloudLocalKey = chiaveViva') < giro.indexOf('if (esito.changed)'),
    'la chiave si scrive PRIMA e FUORI dal confronto sulla freschezza: non è un dato, è l\'indirizzo della riga');
});

test('⑦ 🚨 l\'idratazione porta la chiave della riga, e la prende da `row.local_key`', () => {
  const carica = html.slice(html.indexOf('async function pmoLoadAllMembersFromCloud'));
  const corpo = carica.slice(0, carica.indexOf('const retired = new Set();'));
  assert.match(corpo, /cloudLocalKey: cleanCell\(row\.local_key\)/,
    'l\'idratazione non porta la chiave della riga: la cura è inerte');
});
