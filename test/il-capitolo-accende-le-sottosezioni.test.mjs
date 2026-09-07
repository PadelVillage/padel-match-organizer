// il-capitolo-accende-le-sottosezioni.test.mjs — VOCE 172 (07/09/2026)
//
// 🎯 COSA DIFENDE. Nel pannello dei permessi staff, spuntare il CAPITOLO
// («Impostazioni», «Anagrafica soci», «Autovalutazione») deve accendere le sue
// sottosezioni. 🗣️ Difetto SUO, visto il 06/09 aprendo i permessi dell'utenza della
// console: le sottosezioni restavano spente e le ha dovute mettere una per una a mano.
//
// 📏 MISURATO PRIMA DI CURARE, sull'app viva (TEST 6.391, console remota, sola lettura) —
// la scheda della voce poneva tre domande e chiedeva di non toccare il codice prima:
//   ① solo il disegno o anche il salvataggio? → SOLO IL DISEGNO. Spuntando il capitolo i
//     cinque figli restavano `checked:false`, contatore «0 / 5»; il salvataggio raccoglieva
//     fedelmente `view_admin_utenti:false`. Il Salva era onesto: mostrava il vero.
//   ② togliendo la spunta al capitolo i figli restano accesi? → SÌ: restavano `true` e solo
//     `disabled`, il contatore diceva «5 / 5» di un gruppo spento, e il salvataggio scriveva
//     cinque `true` sotto un padre `false`. ⚖️ Non aprivano niente (il padre fa da cancello),
//     ma restavano in archivio illeggibili.
//   ③ il capitolo da solo apre qualcosa o niente? → 🚨 APRE, ed è il verso che la scheda
//     dichiarava NON MISURATO. Con `view_administration:true` e le cinque sottosezioni a
//     `false`, `pmoAdminSectionViewAllowed('users')` rispondeva **false** e l'app apriva
//     lo stesso **Utenti Staff**: il `|| 'users'` finale di `pmoFirstAllowedAdminSection`
//     vinceva sul permesso.
//
// 🚨 LE PROVE SONO SUL COMPORTAMENTO: le funzioni si ESTRAGGONO da `index.html` e si
// ESEGUONO, e il gesto passa dall'attributo `onchange` dell'HTML generato — così il banco
// prova anche il CABLAGGIO. Un banco che chiamasse la funzione a mano resterebbe verde
// davanti a una casella scollegata (lezione del 19/08: il ramo spento).
//
// ⛔ QUELLO CHE QUESTO BANCO NON DICE: che sullo schermo la spunta si veda comparire. Dice
// che il modello dietro la casella cambia come deve. Che si veda lo dice solo una prova
// sull'app viva — che c'è, ed è la sonda della console remota.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const QUI = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(QUI, '..', 'index.html'), 'utf8');

// Stesso estrattore degli altri banchi che leggono `index.html`: salta i commenti, che in
// italiano sono pieni di apostrofi e manderebbero in tilt il conteggio delle graffe.
function corpoDaGraffa(inizio) {
  let i = html.indexOf('{', inizio), livello = 0, stringa = null, prec = '';
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
  return i;
}
function estrai(nome) {
  const inizio = html.indexOf(`function ${nome}(`);
  if (inizio < 0) throw new Error(`funzione «${nome}» non trovata in index.html`);
  let t = html.indexOf('(', inizio), tonde = 0;
  for (; t < html.length; t++) {
    if (html[t] === '(') tonde++;
    else if (html[t] === ')') { tonde--; if (tonde === 0) { t++; break; } }
  }
  return html.slice(inizio, corpoDaGraffa(t));
}
// Il blocco intero delle sezioni: dalle costanti fino alla fine di `pmoUpdateSectionTree`.
// Si prende in blocco e non funzione per funzione perché è UNA regola sola: l'albero, chi lo
// disegna, chi lo aggiorna e chi decide cosa è visibile stanno insieme e si leggono a vicenda.
function blocco(daCosa, aFunzione) {
  const inizio = html.indexOf(daCosa);
  if (inizio < 0) throw new Error(`«${daCosa}» non trovato in index.html`);
  const f = html.indexOf(`function ${aFunzione}(`, inizio);
  if (f < 0) throw new Error(`«${aFunzione}» non trovata dopo «${daCosa}»`);
  return html.slice(inizio, corpoDaGraffa(html.indexOf('(', f)));
}

const SORGENTE = [
  blocco('const PMO_ASSESSMENT_PARKED', 'pmoUpdateSectionTree'),
  estrai('pmoAdminSectionKey'),
  estrai('pmoCollectAdminPermissions'),
].join('\n');

/* ─────────────────────────────────────────────────────────────────────────────
   IL MONDO ATTORNO, ridotto a ciò che le funzioni toccano davvero.
   🚨 Si rifabbrica a OGNI caso: l'albero tiene stato (le caselle), e un contesto
      riusato porterebbe le spunte del caso precedente.
   ───────────────────────────────────────────────────────────────────────────── */

/** Un DOM finto ma FEDELE, costruito leggendo l'HTML che `pmoSectionTreeHtml` produce
 *  davvero: i nodi nascono dai suoi `<input>`, non da un'idea di come dovrebbero essere. */
function domDa(htmlAlbero) {
  const inputs = [];
  for (const tag of htmlAlbero.match(/<input\b[^>]*>/g) || []) {
    const attr = (n) => (tag.match(new RegExp(`${n}="([^"]*)"`)) || [])[1];
    inputs.push({
      dataset: {
        adminPermission: attr('data-admin-permission'),
        groupKey: attr('data-group-key'),
        parentKey: attr('data-parent-key'),
      },
      onchangeAttr: attr('onchange') || '',
      checked: /\schecked(\s|\/|>)/.test(tag),
      disabled: false,
      indeterminate: false,
      _riga: { classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } } },
      closest() { return this._riga; },
    });
  }
  const contatori = new Map();
  for (const m of htmlAlbero.matchAll(/data-count-for="([^"]*)"/g)) contatori.set(m[1], { textContent: '' });

  const cerca = (sel) => {
    let m;
    if (sel === '[data-admin-permission]') return inputs.filter((i) => i.dataset.adminPermission);
    if (sel === 'input[data-group-key]') return inputs.filter((i) => i.dataset.groupKey);
    if ((m = sel.match(/^input\[data-parent-key="(.+)"\]$/))) return inputs.filter((i) => i.dataset.parentKey === m[1]);
    if ((m = sel.match(/^\[data-count-for="(.+)"\]$/))) return contatori.has(m[1]) ? [contatori.get(m[1])] : [];
    throw new Error(`il DOM finto non sa rispondere a «${sel}» — va insegnato, non aggirato`);
  };
  const albero = { querySelectorAll: cerca, querySelector: (s) => cerca(s)[0] || null };
  return { inputs, contatori, albero };
}

function banco(spunte = {}, { ruolo = 'staff' } = {}) {
  const ctx = {
    console: { warn() {} },
    document: { getElementById: () => null, querySelectorAll: () => [] },
  };
  vm.createContext(ctx);
  vm.runInContext(SORGENTE, ctx);
  // `escapeHtml` non sta nel blocco: è la vera, ritagliata dall'app — ma sta su UNA riga e
  // il suo corpo contiene la regex `/[&<>"']/g`, che l'estrattore a graffe scambierebbe per
  // l'inizio di una stringa. 📌 Si prende a riga, non a graffe: l'attrezzo si adatta alla
  // forma di ciò che legge, invece di far finta che la forma sia un'altra.
  // Stessa forma per `cleanCell`, che `pmoAdminSectionKey` usa per normalizzare il nome.
  for (const nome of ['escapeHtml', 'cleanCell']) {
    const riga = html.slice(html.indexOf(`function ${nome}(`));
    vm.runInContext(riga.slice(0, riga.indexOf('\n')), ctx);
  }
  // Profilo staff: il blocco lo consulta solo tramite queste due, che stanno altrove.
  vm.runInContext('function pmoIsStaffProfileActive(p){ return !!p && p.status === "active"; }\n'
    + 'function pmoIsPublicAccessMode(){ return false; }\n'
    + 'var pmoStaffProfile = null;', ctx);

  // 🚨 Un `const` di primo livello NON diventa una proprietà del contesto: resta una
  // dichiarazione lessicale. È lo stesso fatto che nel browser rende `window.PMO_SECTION_TREE`
  // `undefined` mentre il nome nudo risponde — e che ha fatto sbagliare la prima sonda del 07/09.
  vm.runInContext('globalThis.PMO_SECTION_TREE = PMO_SECTION_TREE;'
    + 'globalThis.PMO_ADMIN_SECTION_NESSUNA = PMO_ADMIN_SECTION_NESSUNA;', ctx);

  const dom = domDa(ctx.pmoSectionTreeHtml(spunte));
  ctx.document.getElementById = (id) => (id === 'pmoSectionTree' ? dom.albero
    : id === 'pmoStaffUserRole' ? { value: ruolo } : null);
  ctx.document.querySelectorAll = (sel) => dom.albero.querySelectorAll(sel);

  const perChiave = (k) => dom.inputs.find((i) => i.dataset.adminPermission === k && !i.dataset.parentKey);
  const figliDi = (k) => dom.inputs.filter((i) => i.dataset.parentKey === k);

  /** Il gesto VERO: si legge dall'HTML quale funzione la casella dichiara di chiamare e si
   *  chiama QUELLA. Se un domani l'`onchange` viene scollegato, questi casi cadono. */
  const clic = (input, nuovo) => {
    input.checked = nuovo;
    const nome = (input.onchangeAttr.match(/^(\w+)\(/) || [])[1];
    assert.ok(nome && typeof ctx[nome] === 'function', `la casella «${input.dataset.adminPermission}» non chiama nessuna funzione nota: onchange="${input.onchangeAttr}"`);
    if (/\(this\)/.test(input.onchangeAttr)) ctx[nome](input); else ctx[nome]();
  };

  return { ctx, dom, perChiave, figliDi, clic,
    contatore: (k) => dom.contatori.get(k)?.textContent ?? null };
}

/** Tutte le chiavi a `false`: è il profilo di un utente nuovo — l'app lo dichiara nel suo
 *  stesso suggerimento («Un nuovo utente parte senza nulla spuntato»). */
function tuttoSpento(ctx) {
  const o = {};
  ctx.PMO_SECTION_TREE.forEach((n) => { o[n.key] = false; (n.children || []).forEach((c) => { o[c.key] = false; }); });
  return o;
}
const GRUPPO = 'view_administration';

// ══════════════════════════════════════════════════════════════════════════════════════════
// ① IL DIFETTO SUO, esattamente come l'ha visto: spunto il capitolo, i figli si accendono.
// ══════════════════════════════════════════════════════════════════════════════════════════
test('① spuntando «Impostazioni» le cinque sottosezioni si accendono da sole', () => {
  const b0 = banco({});
  const b = banco(tuttoSpento(b0.ctx));
  const padre = b.perChiave(GRUPPO);
  // 🚨 Il numero dei figli si LEGGE dall'albero, non si scrive qui: `main` ne ha quattro e
  //    `test-preview` cinque (su PROD «Circoli» non c'è ancora). Un banco che scrivesse «5»
  //    sarebbe rosso su un ramo sano — e la 26ª insegna che poi lo si smette di leggere.
  const quanti = b.figliDi(GRUPPO).length;
  assert.ok(quanti >= 4, `il capitolo Impostazioni ha ${quanti} sottosezioni: il caso non prova più niente`);

  b.clic(padre, true);

  assert.deepEqual(b.figliDi(GRUPPO).map((k) => k.checked), new Array(quanti).fill(true),
    'il click sul capitolo NON propaga: è il difetto del 06/09, tornato');
  assert.equal(b.contatore(GRUPPO), `${quanti} / ${quanti}`, 'il contatore non dice il vero');
});

test('① e il salvataggio raccoglie ciò che le caselle mostrano, senza sorprese', () => {
  const b0 = banco({});
  const b = banco(tuttoSpento(b0.ctx));
  b.clic(b.perChiave(GRUPPO), true);
  const p = b.ctx.pmoCollectAdminPermissions();
  assert.equal(p.view_administration, true);
  assert.equal(p.view_admin_utenti, true);
  assert.equal(p.manage_users, true, 'il permesso forte deriva dalla sezione: se «Utenti Staff» è acceso, manage_users pure');
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// ② IL VERSO OPPOSTO — e qui l'errore costerebbe di più: togliere e restare aperti.
// ══════════════════════════════════════════════════════════════════════════════════════════
test('② togliendo il capitolo si spengono anche i figli: niente `true` orfani in archivio', () => {
  const b0 = banco({});
  const b = banco({});                                   // fail-open: tutto spuntato
  const quanti = b.figliDi(GRUPPO).length;
  assert.deepEqual(b.figliDi(GRUPPO).map((k) => k.checked), new Array(quanti).fill(true));

  b.clic(b.perChiave(GRUPPO), false);

  assert.deepEqual(b.figliDi(GRUPPO).map((k) => k.checked), new Array(quanti).fill(false),
    'i figli restano accesi sotto un padre spento: `true` illeggibili in archivio');
  assert.equal(b.contatore(GRUPPO), `0 / ${quanti}`, 'il contatore dice il pieno di un gruppo spento');
  const p = b.ctx.pmoCollectAdminPermissions();
  assert.equal(p.view_administration, false);
  assert.equal(p.view_admin_utenti, false);
  assert.equal(p.manage_users, false);
  void b0;
});

test('② i figli NON restano disabilitati: si può sempre riaprirne uno solo', () => {
  // 🚨 Col padre derivato dai figli, disabilitarli quando il padre è spento chiuderebbe la
  //    porta a chiave dall'interno: nessuno potrebbe più riaccenderne uno.
  const b = banco({});
  b.clic(b.perChiave(GRUPPO), false);
  const quanti = b.figliDi(GRUPPO).length;
  assert.deepEqual(b.figliDi(GRUPPO).map((k) => k.disabled), new Array(quanti).fill(false));

  const uno = b.figliDi(GRUPPO)[0];
  b.clic(uno, true);
  assert.equal(b.contatore(GRUPPO), `1 / ${quanti}`);
  assert.equal(b.perChiave(GRUPPO).indeterminate, true, 'un gruppo a metà deve dirlo, o la casella mente');
  assert.equal(b.perChiave(GRUPPO).checked, false);
  assert.equal(b.ctx.pmoCollectAdminPermissions().view_admin_utenti, true);
});

test('② riaccendendo l’ultimo figlio il capitolo torna spuntato da sé', () => {
  const b = banco({});
  b.clic(b.perChiave(GRUPPO), false);
  b.figliDi(GRUPPO).forEach((k) => b.clic(k, true));
  assert.equal(b.perChiave(GRUPPO).checked, true);
  assert.equal(b.perChiave(GRUPPO).indeterminate, false);
  assert.equal(b.ctx.pmoCollectAdminPermissions().view_administration, true);
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// ③ IL BUCO VERO, quello misurato: il ripiego che apriva una sezione VIETATA.
// ══════════════════════════════════════════════════════════════════════════════════════════
const profilo = (permessi) => ({ role: 'staff', status: 'active', permissions: permessi });

test('③ 🚨 col solo capitolo spuntato, l’app NON atterra su «Utenti Staff»', () => {
  const b = banco({});
  const p = profilo(Object.assign(tuttoSpento(b.ctx), { view_administration: true }));

  assert.equal(b.ctx.pmoSectionVisibleFor('administration', p), true, 'il capitolo è concesso');
  assert.equal(b.ctx.pmoAdminSectionViewAllowed('users', p), false, 'e «Utenti Staff» è negato');

  const dove = b.ctx.pmoFirstAllowedAdminSection(p);
  assert.notEqual(dove, 'users', '🚨 si apre il pannello più potente del gestionale con la sua casella spenta');
  assert.equal(dove, b.ctx.PMO_ADMIN_SECTION_NESSUNA);
});

test('③ e il sentinella sopravvive alla normalizzazione: non torna «users» da un’altra strada', () => {
  // `pmoAdminSectionKey` normalizza qualunque nome sconosciuto a 'users'. Se non riconoscesse
  // il sentinella, `pmoApplyAdminSectionVisibility` mostrerebbe di nuovo Utenti Staff.
  const b = banco({});
  assert.equal(b.ctx.pmoAdminSectionKey(b.ctx.PMO_ADMIN_SECTION_NESSUNA), b.ctx.PMO_ADMIN_SECTION_NESSUNA);
  assert.equal(b.ctx.pmoAdminSectionKey('roba-che-non-esiste'), 'users', 'la vecchia rete di sicurezza per i nomi legacy è stata tolta');
});

test('③ chi ha una sola sottosezione atterra LÌ, non sulla prima della lista', () => {
  const b = banco({});
  const p = profilo(Object.assign(tuttoSpento(b.ctx), { view_administration: true, view_admin_telegram: true }));
  assert.equal(b.ctx.pmoFirstAllowedAdminSection(p), 'telegram');
  assert.equal(b.ctx.pmoAdminSectionViewAllowed('users', p), false);
});

test('③ il Proprietario non è toccato da niente di tutto questo', () => {
  const b = banco({});
  const owner = { role: 'owner', status: 'active', permissions: tuttoSpento(b.ctx) };
  assert.equal(b.ctx.pmoFirstAllowedAdminSection(owner), 'users');
  assert.equal(b.ctx.pmoAdminSectionViewAllowed('users', owner), true);
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// ④ IL CABLAGGIO — la casella del capitolo deve chiamare l'interruttore maestro.
// ══════════════════════════════════════════════════════════════════════════════════════════
test('④ la casella del capitolo è cablata all’interruttore maestro, e riceve sé stessa', () => {
  const b = banco({});
  const padre = b.perChiave(GRUPPO);
  assert.match(padre.onchangeAttr, /^pmoToggleSectionGroup\(this\)$/,
    'il capitolo è tornato a chiamare il solo aggiornamento: il click non propagherebbe più');
  const figlio = b.figliDi(GRUPPO)[0];
  assert.match(figlio.onchangeAttr, /^pmoUpdateSectionTree\(\)$/);
});

test('④ vale per TUTTI i capitoli con figli, non solo per Impostazioni', () => {
  const b0 = banco({});
  const conFigli = b0.ctx.PMO_SECTION_TREE.filter((n) => (n.children || []).length);
  assert.ok(conFigli.length >= 2, 'i capitoli con figli sono meno di due: il caso non prova più niente');
  for (const nodo of conFigli) {
    const b = banco(tuttoSpento(b0.ctx));
    b.clic(b.perChiave(nodo.key), true);
    // 🚨 `new Array(...).fill` e non `nodo.children.map(...)`: `PMO_SECTION_TREE` vive nel
    //    contesto vm, e un array nato LÌ ha un altro `Array.prototype` ⇒ `deepStrictEqual`
    //    lo rifiuta pur avendo gli stessi valori, e il messaggio d'errore mostra due liste
    //    identiche. Un banco che accusa il codice per un confine di realm è peggio di niente.
    assert.deepEqual(b.figliDi(nodo.key).map((k) => k.checked), new Array(nodo.children.length).fill(true),
      `il capitolo «${nodo.label}» non accende i suoi figli`);
    assert.equal(b.contatore(nodo.key), `${nodo.children.length} / ${nodo.children.length}`);
  }
});
