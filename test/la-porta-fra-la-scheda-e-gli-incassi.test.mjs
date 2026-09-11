// la-porta-fra-la-scheda-e-gli-incassi.test.mjs — VOCE 198 (11/09/2026)
//
// 🗣️ Sua richiesta: *«bisogna collegare la sezione incassi con i pagamenti tramite la scheda
//    partite e lezioni e tornei e anche il borsellino»*.
//
// ⚖️⭐⭐ COSA QUESTO BANCO PRETENDE, E COSA NO — la distinzione che lo rende utile.
// **NON** pretende una RICONCILIAZIONE, e non per pigrizia: il rischio non è simmetrico. Una
// porta che sbaglia apre la pagina sbagliata e te ne accorgi subito; un conto che sbaglia
// **accusa una persona che aveva già pagato**. 📏 E delle 256 prenotazioni vive solo **14**
// portano gli importi ⇒ un giudice costruito adesso direbbe «non pagato» nel 94% dei casi.
// **Pretende** che le due porte esistano, che siano la stessa strada nei due versi, e che
// nessuna delle due INVENTI un dato che può leggere.
//
// 🚨⭐⭐ IL DIFETTO VERO CHE QUESTO BANCO FERMA, e non era nel verso nuovo: era in quello che
// c'era già. Dei **12** chiamanti di `staffCalEditPlayers` esattamente **uno** non aveva il tipo
// da passare e lo CABLAVA — `pmoIncassiApriPartita`, con `'partita'` e `90`. ⇒ Una riga di cassa
// di una LEZIONE apriva la scheda come partita, e una scheda «partita» non disegna il selettore
// del maestro. Il maestro spariva dalla vista, e niente diventava rosso.
// 📌 *Un chiamante che non sa un dato non deve inventarlo: deve leggerlo dove sta.*
//
// 🚨 E la trappola che ha quasi fatto scrivere la cura sbagliata: il calendario legge
// `slot.tipoReale || slot.tipo`, e leggendo lui si sarebbe cercato `tipoReale` nei record.
// 📏 Misurato sul database vero: `tipoReale` **non esiste in nessuno dei 2.027 record** — vive
// solo in memoria. Nei record il campo è `tipo`. *Una sonda puntata su un campo che non esiste
// risponde `undefined` per sempre, e sembra funzionare.*

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = join(QUI, '..');
const APP = readFileSync(join(RADICE, 'index.html'), 'utf8');

function sorgenteDi(nome) {
  const i = APP.indexOf('function ' + nome + '(');
  assert.ok(i > 0, 'funzione non trovata: ' + nome);
  const apre = APP.indexOf(') {', i);
  let g = 0, visto = false, k = apre + 2;
  for (; k < APP.length; k++) {
    const c = APP[k];
    if (c === '{') { g++; visto = true; }
    else if (c === '}') { g--; if (visto && g === 0) { k++; break; } }
  }
  return APP.slice(i, k);
}

// ── ① LE DUE PORTE ESISTONO, E SONO LA STESSA STRADA NEI DUE VERSI ──────────────────────
test('la porta dalla scheda a Incassi esiste', () => {
  assert.ok(/function pmoSchedaApriIncassi\(/.test(APP), 'manca pmoSchedaApriIncassi');
  assert.ok(/window\.pmoSchedaApriIncassi\s*=/.test(APP), 'pmoSchedaApriIncassi non è raggiungibile da un onclick');
});

test('la porta da Incassi alla scheda esiste ancora', () => {
  assert.ok(/function pmoIncassiApriPartita\(/.test(APP), 'manca pmoIncassiApriPartita');
});

test('il focus si può togliere, o la tabella resta filtrata per sempre', () => {
  assert.ok(/function _incassiFocusClear\(/.test(APP), 'manca _incassiFocusClear');
  assert.ok(/onclick="_incassiFocusClear\(\)"/.test(APP), 'nessun bottone chiama _incassiFocusClear');
});

// ── ② NESSUN CHIAMANTE INVENTA IL TIPO ──────────────────────────────────────────────────
// 🚨 È la prova che avrebbe fermato il difetto. Si cercano le chiamate a `staffCalEditPlayers`
//    con una STRINGA LETTERALE come sesto argomento: quello è un tipo inventato dal chiamante.
/* 🚨⭐⭐ QUESTA SONDA È NATA CIECA, e l'ha scoperto il SABOTAGGIO — non la rilettura.
 * Cercava le chiamate con `/staffCalEditPlayers\([^)]*\)/`: `[^)]*` si ferma alla PRIMA parentesi
 * chiusa, che nella chiamata vera sta dentro `String(nome || '')` ⇒ la sonda leggeva
 * `staffCalEditPlayers(iso, campo, ora, String(nome || ''` e il `, 'partita')` finale — cioè
 * esattamente il difetto da prendere — restava **fuori dalla lettura**.
 * 📏 Misurato: col tipo cablato rimesso a mano il banco restava **VERDE**.
 * 📌 *Una sonda che legge un pezzo troncato non è meno severa: è cieca proprio sulla coda, che
 *    è dove stanno gli argomenti che si sbagliano.* ⇒ Le parentesi si BILANCIANO, non si
 *    ritagliano con una classe negata. */
function chiamateDi(nome) {
  const out = [];
  let i = 0;
  while ((i = APP.indexOf(nome + '(', i)) !== -1) {
    // non è una chiamata se è la dichiarazione, o se fa parte di un identificatore più lungo
    const prima = APP[i - 1] || '';
    if (/[A-Za-z0-9_$]/.test(prima)) { i += nome.length; continue; }
    let g = 0, k = i + nome.length;
    for (; k < APP.length; k++) {
      const c = APP[k];
      if (c === '(') g++;
      else if (c === ')') { g--; if (g === 0) { k++; break; } }
    }
    out.push(APP.slice(i, k));
    i = k;
  }
  return out;
}

test('nessun chiamante di staffCalEditPlayers cabla il tipo', () => {
  const chiamate = chiamateDi('staffCalEditPlayers').filter((c) => !/^staffCalEditPlayers\(isoDate, campo/.test(c));
  assert.ok(chiamate.length >= 10, 'me ne aspettavo più di dieci, ne ho trovate ' + chiamate.length);
  const cablate = chiamate.filter((c) => /,\s*'(partita|lezione|stage|torneo|manutenzione)'\s*\)\s*$/.test(c));
  assert.deepEqual(cablate, [], 'questi chiamanti inventano il tipo invece di leggerlo: ' + cablate.join(' · '));
});

// ── ③ L'HELPER LEGGE IL CAMPO CHE ESISTE NEI RECORD, E NORMALIZZA ────────────────────────
function montaLookup(staffBookings, occupazione, elenco) {
  const sorgente = [
    sorgenteDi('pmoTipoScheda'),
    sorgenteDi('pmoTipoParola'),
    sorgenteDi('_pmoTrovaSlot'),
    sorgenteDi('_pmoLookupTipoDurata'),
  ].join('\n');
  const fab = new Function('SB', 'OCC', 'PRE', `
    const PMO_TIPI_PRENOTAZIONE = ${JSON.stringify(
      // la tabella vera, riletta dal sorgente: se un tipo nuovo entra, entra anche qui
      (() => {
        const m = APP.match(/const PMO_TIPI_PRENOTAZIONE = \[([\s\S]*?)\n  \];/);
        assert.ok(m, 'non trovo PMO_TIPI_PRENOTAZIONE');
        const righe = m[1].match(/\{[^}]*\}/g) || [];
        return righe.map((r) => ({
          tipo: (r.match(/tipo:\s*'([^']+)'/) || [])[1],
          etichetta: (r.match(/etichetta:\s*'([^']+)'/) || [])[1],
          engine: (r.match(/engine:\s*'([^']+)'/) || [])[1],
          giocatori: /giocatori:\s*true/.test(r),
          maestro: /maestro:\s*true/.test(r),
        }));
      })()
    )};
    const safeLoad = (k, d) => (k === 'staffBookings' ? SB : (k === 'prenotazioni' ? PRE : d));
    const prenotazioniOccupazione = OCC;
    const prenotazioni = PRE;
    ${sorgente}
    return _pmoLookupTipoDurata;
  `);
  return fab(staffBookings, occupazione, elenco || []);
}

test('il tipo si legge dal campo `tipo` dei record, non da `tipoReale` che non esiste', () => {
  // 📏 Forma vera di un `staff_booking` su cudi: `tipo` minuscolo, nessun `tipoReale`.
  const lookup = montaLookup([{ data: '2026-09-26', campo: '4', ora: '10:30', tipo: 'lezione', durata: 60 }], []);
  const r = lookup('2026-09-26', 4, '10:30');
  assert.equal(r.tipo, 'lezione', 'una lezione deve restare una lezione');
  assert.equal(r.durata, 60, 'la durata vera è 60, non il ripiego 90');
});

test('il vocabolario del circolo si normalizza: «Lezione Libera» è una lezione', () => {
  // 📏 Misurato: `booking_occupancy` dice `Partita` · `Lezione Libera` · `manutenzione`.
  const lookup = montaLookup([], [{ data: '2026-09-26', campo: '2', ora: '18:00', tipo: 'Lezione Libera', durata: 90 }]);
  assert.equal(lookup('2026-09-26', 2, '18:00').tipo, 'lezione');
});

test('lo stage non diventa una lezione: il NOME si conserva', () => {
  // 🏆 È la 207: il macchinario si eredita, il nome no.
  const lookup = montaLookup([{ data: '2026-10-01', campo: '1', ora: '09:00', tipo: 'stage', durata: 120 }], []);
  assert.equal(lookup('2026-10-01', 1, '09:00').tipo, 'stage');
});

test('uno slot senza tipo non mente: torna null e lascia decidere al ripiego', () => {
  // 📏 59 `staff_booking` su 338 non hanno `tipo` affatto.
  const lookup = montaLookup([{ data: '2026-10-02', campo: '3', ora: '20:00', durata: 90 }], []);
  assert.equal(lookup('2026-10-02', 3, '20:00').tipo, null);
});

test('uno slot che non esiste non inventa niente', () => {
  const lookup = montaLookup([], []);
  assert.deepEqual(lookup('2026-10-03', 1, '08:00'), { tipo: null, durata: null });
});

test('il campo si confronta come NUMERO: «Campo 3» e 3 sono lo stesso slot', () => {
  const lookup = montaLookup([{ data: '2026-10-04', campo: 'Campo 3', ora: '11:00', tipo: 'torneo', durata: 180 }], []);
  assert.equal(lookup('2026-10-04', '3', '11:00').tipo, 'torneo');
});

// ── ④ IL FOCUS IGNORA L'INTERVALLO DI DATE, ED È UNA CORRETTEZZA ────────────────────────
// 🚨⭐⭐ Il caso per cui la porta serve davvero: la partita è di un giorno, l'incasso di un
//    altro. Un focus che rispettasse l'intervallo risponderebbe «nessun incasso» proprio lì.
test('il focus guarda la PRENOTAZIONE, non il giorno in cui si è incassato', () => {
  const blocco = APP.match(/if \(_fx\) \{[\s\S]*?\} else if \(!data \|\| data < st\.from \|\| data > st\.to\) continue;/);
  assert.ok(blocco, 'il ramo del focus non c\'è, o non scavalca più il vincolo di data');
  const t = blocco[0];
  assert.ok(/_fBdata !== _fx\.bdata/.test(t), 'il focus non confronta la data della prenotazione');
  assert.ok(/String\(_fCampo\) !== String\(_fx\.campo\)/.test(t), 'il focus non confronta il campo');
  assert.ok(/_fOra !== _fx\.ora/.test(t), 'il focus non confronta l\'ora');
  /* 🩹⭐ QUESTA RIGA L'HA CHIESTA IL SABOTAGGIO ⑤, e senza di lei il banco restava verde:
   * rimettendo `data < st.from || data > st.to` DENTRO il ramo del focus, il blocco continuava
   * a esistere e a contenere i tre confronti ⇒ le asserzioni qui sopra passavano tutte, e il
   * focus tornava a rispondere «nessun incasso» per la partita pagata un altro giorno.
   * 📌 *Verificare che una guardia CI SIA non verifica che faccia la sua parte: il ramo giusto
   *    con dentro la regola sbagliata ha la stessa forma di quello corretto.* */
  const ramoFocus = t.slice(0, t.indexOf('} else if'));
  assert.ok(!/st\.from|st\.to/.test(ramoFocus),
    'il ramo del focus guarda ancora l\'intervallo di date: la partita incassata un altro giorno risulterebbe senza incassi');
  // e il vincolo di date resta per il caso NORMALE, o si romperebbe la sezione Incassi
  assert.ok(/\} else if \(!data \|\| data < st\.from \|\| data > st\.to\) continue;/.test(t),
    'senza focus l\'intervallo di date deve continuare a valere');
});

// ── ⑤ IL FILTRO SI VEDE, E NON SOPRAVVIVE AL MENU ───────────────────────────────────────
// 📌 Un totale filtrato senza il filtro accanto è un totale sbagliato.
test('la barra del focus sta nella parte STICKY, insieme ai totali che spiega', () => {
  const m = APP.match(/root\.innerHTML = `<div style="position:sticky[^`]*`;/);
  assert.ok(m, 'non trovo il render finale di Incassi');
  assert.ok(m[0].includes('${_fxBar('), 'la barra del focus non è nella parte sticky: scorrerebbe via lasciando numeri parziali senza spiegazione');
  assert.ok(m[0].indexOf('${_fxBar(') < m[0].indexOf('${summary}'), 'la barra deve stare PRIMA dei totali che filtra');
  /* 🩹 La barra riceve l'incassato SOLO col focus attivo: passarlo sempre farebbe comparire un
     confronto anche nell'elenco intero, dove «dovuto» non vuol dire niente. */
  assert.ok(/_fxBar\(_fx \? sel\.totale : undefined\)/.test(m[0]),
    'la barra deve ricevere l\'incassato solo quando il focus è attivo');
});

test('entrare in Incassi dal menu NON lascia un focus appeso', () => {
  const m = APP.match(/if \(tabName === 'incassi'\) \{[^}]*\}/);
  assert.ok(m, 'non trovo l\'ingresso nella sezione Incassi');
  // Il ramo CONSUMA il pending: dal menu è vuoto ⇒ focus a null; dalla porta è pieno ⇒ applicato.
  assert.ok(/_incassiState\.focus = _incassiFocusPending/.test(m[0]),
    'il ramo non consuma il focus «in arrivo»');
  assert.ok(/_incassiFocusPending = null/.test(m[0]),
    'il pending non viene svuotato: il focus tornerebbe al prossimo ingresso dal menu');
});

/* 🚨⭐⭐ QUESTO TEST NASCE DA UN DIFETTO CHE IL BANCO VERDE NON VEDEVA, e l'ha trovato il DITO.
 * 📏 Premuto il bottone sulla pagina viva di TEST 6.443: si arrivava in Incassi e il filtro
 *    **non c'era** (totale «Oggi · 2026-09-11», nessuna barra). Causa: il ramo `incassi` di
 *    `switchTab` sta dentro un `setTimeout(…, 0)`, quindi il suo azzeramento girava DOPO
 *    l'assegnazione che nel codice veniva dopo di lui — e la cancellava.
 * 📌 *Fra due scritture dello stesso stato non decide l'ordine delle righe: decide chi gira per
 *    ultimo. Con un lavoro differito in mezzo, le due cose sono opposte.*
 * ⇒ La forma che questo test pretende non è «l'ordine giusto»: è che **non ci siano due
 *   scritture** da mettere in ordine. */
test('la porta CHIEDE il focus, non lo scrive prima di switchTab', () => {
  const corpo = sorgenteDi('pmoSchedaApriIncassi');
  const iSwitch = corpo.indexOf("switchTab('incassi')");
  assert.ok(iSwitch > 0, 'la porta non chiama più switchTab');
  const prima = corpo.slice(0, iSwitch);
  assert.ok(!/_incassiState\.focus\s*=/.test(prima),
    'la porta scrive `_incassiState.focus` PRIMA di switchTab: il ramo differito di switchTab lo cancellerà, e il filtro non si applicherà (misurato sulla pagina viva)');
  assert.ok(/_incassiFocusPending\s*=\s*\{/.test(prima),
    'la porta non chiede il focus tramite il pending');
});

test('col focus il vuoto non parla di intervalli, e non accusa nessuno', () => {
  /* 🩹⭐⭐ QUESTA SONDA È NATA SBAGLIATA, ed è la 24ª commessa dentro il banco che doveva
   * difendere: cercava le parole vietate in **400 caratteri intorno** al messaggio, e diventava
   * rossa per il COMMENTO due righe sopra, dove quelle parole sono citate per dire di non
   * usarle. ⇒ Ancorata al **contenitore giusto**: il solo template del ramo `_fx`.
   * 📌 *Una sonda che trova «qualcosa che somiglia» non sta misurando: sta indovinando.* */
  const m = APP.match(/table = _fx\s*\?\s*`([\s\S]*?)`\s*:/);
  assert.ok(m, 'non trovo il ramo del vuoto col focus');
  const msg = m[1];
  assert.ok(/non risulta/.test(msg), 'il messaggio deve dire «non risulta»');
  assert.ok(!/(non|nessuno) ha pagato/.test(msg),
    'il vuoto non deve affermare che qualcuno non ha pagato: qui si sa solo cosa è stato REGISTRATO');
  assert.ok(!/intervallo/.test(msg), 'col focus l\'intervallo di date non c\'entra: nominarlo sarebbe falso');
});

// ── ⑥ IL BOTTONE NELLA SCHEDA USA LE STESSE COORDINATE DELL'ALTRO VERSO ─────────────────
test('il bottone della scheda passa le coordinate della prenotazione aperta', () => {
  const i = APP.indexOf('Vedi gli incassi di questa prenotazione');
  assert.ok(i > 0, 'manca il bottone nella scheda');
  const intorno = APP.slice(i, i + 900);
  assert.ok(/pmoSchedaApriIncassi\(st\.origIso, st\.origCampo, st\.origOra/.test(intorno),
    'il bottone non passa st.orig* — cioè le stesse coordinate con cui l\'altro verso apre questa scheda');
});

// ── ⑦ LE FONTI SONO TRE, E LA TERZA È LA PIÙ CAPIENTE ───────────────────────────────────
/* 📏 Contate sulla pagina viva di TEST l'11/09: `prenotazioni` **288** · `occupazione` **163** ·
 * `staffBookings` **36**. Fermarsi alle due fonti di `_staffCalLookupIdReserva` lasciava fuori
 * la più grande — e con lei gli slot per cui il ripiego «partita» nasconde il maestro.
 * 📌 *Riusare le fonti di un'altra funzione non garantisce che bastino alla propria domanda:
 *    quella cercava un id, questa cerca un tipo, e i due non vivono negli stessi posti.* */
test('il tipo si trova anche nella terza fonte, `prenotazioni`', () => {
  const lookup = montaLookup([], [], [{ data: '2026-09-20', campo: '1', ora: '18:00', tipo: 'Lezione Libera', durata: '1.5' }]);
  const r = lookup('2026-09-20', 1, '18:00');
  assert.equal(r.tipo, 'lezione', 'la terza fonte non viene guardata');
});

test('le nostre fonti vincono su quelle del circolo', () => {
  // stesso slot in due fonti con tipi diversi: deve vincere `staffBookings`
  const lookup = montaLookup(
    [{ data: '2026-09-21', campo: '2', ora: '10:00', tipo: 'stage', durata: 120 }],
    [{ data: '2026-09-21', campo: '2', ora: '10:00', tipo: 'Partita', durata: '2' }],
    []);
  assert.equal(lookup('2026-09-21', 2, '10:00').tipo, 'stage',
    'una fonte importata ha scavalcato la nostra: il nome proprio della prenotazione si perde');
});

// ── ⑧ LA DURATA HA DUE FORMATI, E NON SI CONVERTE DUE VOLTE ─────────────────────────────
/* 📏 Misurato: `staffBookings` tiene la durata in MINUTI (`90`), le fonti del circolo in ORE
 * come stringa (`"1.5"`, `"2"`). L'helper la restituisce GREZZA perché la normalizza
 * `_staffCalDurMin` dentro `staffCalEditPlayers` — e quella sa leggere entrambi.
 * 📌 *Normalizzare due volte è peggio che una: la seconda conversione riceve un numero già
 *    convertito e non ha modo di saperlo.* */
test('la durata in ORE non viene convertita qui, ma passa grezza a chi sa farlo', () => {
  const lookup = montaLookup([], [{ data: '2026-09-22', campo: '3', ora: '09:00', tipo: 'Partita', durata: '1.5' }], []);
  assert.equal(lookup('2026-09-22', 3, '09:00').durata, '1.5',
    'la durata è stata convertita qui: verrà riconvertita da _staffCalDurMin e uscirà sbagliata');
});

test('e chi la normalizza sa leggere tutti e due i formati', () => {
  const dur = new Function(`${sorgenteDi('_staffCalDurMin')}; return _staffCalDurMin;`)();
  assert.equal(dur('1.5'), 90, 'ore stringa → minuti');
  assert.equal(dur(90), 90, 'minuti → minuti');
  assert.equal(dur('2'), 120, 'due ore → 120 minuti');
  assert.equal(dur(60), 60, 'sessanta minuti restano sessanta');
  assert.equal(dur(null), 90, 'senza durata, il ripiego dichiarato');
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// ⑨ IL CONFRONTO COL DOVUTO — passo ③, e si ferma alla PARTITA
// ══════════════════════════════════════════════════════════════════════════════════════════
/* 🚨⭐⭐ PERCHÉ PER PARTITA E NON PER PERSONA: è una MISURA dell'11/09, non una preferenza.
 * Abbinando le 17 righe giocatore che hanno un importo ai pagamenti per `data+campo+ora+nome`:
 *  · **12** non hanno nessun pagamento sullo slot ⇒ lì «non pagato» sarebbe vero;
 *  · **07/09 C2 18:00**: il dovuto è di *Fabio De Luca* e i 3 pagamenti sono di **altre tre
 *    persone** ⇒ un conto per nome direbbe che lui non ha pagato, e può essere **falso**;
 *  · **03/09 C2 21:00**: nel roster ci sono **DUE «Ospite»** e pagamenti «Ospite» ⇒ per persona
 *    è **indecidibile**.
 * 📌 *Quando l'unità di misura sbagliata produce un'accusa, non si affina: si cambia unità.* */

function montaDovuto(staffBookings) {
  const sorgente = [
    sorgenteDi('_pmoContoPartita'),
    sorgenteDi('_pmoTrovaSlot'),
    sorgenteDi('_pmoDovutoDelloSlot'),
  ].join('\n');
  const fab = new Function('SB', `
    const safeLoad = (k, d) => (k === 'staffBookings' ? SB : d);
    const prenotazioniOccupazione = [];
    const prenotazioni = [];
    ${sorgente}
    return _pmoDovutoDelloSlot;
  `);
  return fab(staffBookings);
}

const SLOT = { data: '2026-09-03', campo: '2', ora: '21:00' };
const conSlot = (giocatori) => [Object.assign({}, SLOT, { giocatori })];

test('il dovuto della partita è la somma delle quote', () => {
  const dov = montaDovuto(conSlot([
    { nome: 'Dominik', importoCents: 1200 }, { nome: 'Jury', importoCents: 1200 },
    { nome: 'Ospite', importoCents: 1200 }, { nome: 'Ospite', importoCents: 1200 },
  ]));
  const r = dov('2026-09-03', 2, '21:00');
  assert.equal(r.cents, 4800, 'quattro quote da 12,00 € fanno 48,00 €');
  assert.equal(r.ignoti, 0);
  assert.equal(r.righe, 4);
  assert.equal(r.trovato, true);
});

/* ⛔ LA RIGA CHE IMPEDISCE L'ACCUSA: se una quota non ha importo, il dovuto è un MINIMO.
 * 📌 *Un totale che ha saltato una riga non è un totale approssimato: è un totale falso, e non
 *    si distingue da uno vero guardandolo* — voce 152, e qui costerebbe un'accusa. */
test('una quota senza importo rende il dovuto INCOMPLETO, non più piccolo', () => {
  const dov = montaDovuto(conSlot([
    { nome: 'A', importoCents: 1200 }, { nome: 'B' }, { nome: 'C', importoCents: 1200 },
  ]));
  const r = dov('2026-09-03', 2, '21:00');
  assert.equal(r.ignoti, 1, 'la riga senza importo deve essere CONTATA a parte');
  assert.equal(r.cents, 2400, 'e la somma resta quella delle righe note: è un minimo');
  assert.equal(r.righe, 3);
});

test('zero giocatori non è dovuto zero: è «niente da addebitare»', () => {
  const dov = montaDovuto(conSlot([]));
  const r = dov('2026-09-03', 2, '21:00');
  assert.equal(r.righe, 0);
  assert.equal(r.cents, null, 'con nessun giocatore il dovuto non è 0: non esiste');
  assert.equal(r.trovato, true, 'la prenotazione però ESISTE, e va distinta da una non trovata');
});

test('una prenotazione che non è in casa dà «non lo so», non zero', () => {
  const dov = montaDovuto([]);
  const r = dov('2026-09-03', 2, '21:00');
  assert.equal(r.trovato, false, 'non trovata deve essere distinguibile da trovata-e-vuota');
  assert.equal(r.cents, null);
});

test('il dovuto NON guarda chi ha pagato: `incassato` è false per tutte', () => {
  // Se passasse `incassato: true` per le righe già saldate, `aCaricoCents` resterebbe uguale
  // ma il significato cambierebbe — e l'incassato verrebbe contato DUE volte nel focus, una
  // dalla prenotazione e una dai pagamenti.
  const src = sorgenteDi('_pmoDovutoDelloSlot');
  assert.ok(/incassato:\s*false/.test(src),
    'il dovuto deve chiedere il conto con incassato:false, o somma due verità diverse');
  assert.ok(!/pendenteCents/.test(src),
    'il dovuto non deve guardare `pendenteCents`: nel focus l\'incassato si sa dai pagamenti');
});

// ── la barra: i TRE esiti, e nessuno accusa una persona ─────────────────────────────────
test('la barra del focus ha TRE esiti e non due', () => {
  const i = APP.indexOf('VOCE 198, passo ③ — IL CONFRONTO');
  assert.ok(i > 0, 'manca il blocco del confronto');
  const blocco = APP.slice(i, i + 3000);
  assert.ok(/quadra/.test(blocco), 'manca l\'esito «quadra»');
  assert.ok(/mancano/.test(blocco), 'manca l\'esito «mancano»');
  assert.ok(/dovuto <strong>non so<\/strong>/.test(blocco), 'manca il terzo esito: «non so»');
  assert.ok(/incompleto/.test(blocco), 'manca l\'esito del dovuto incompleto (ignoti > 0)');
});

test('la barra non dice mai che una PERSONA non ha pagato', () => {
  const i = APP.indexOf('VOCE 198, passo ③ — IL CONFRONTO');
  const blocco = APP.slice(i, i + 3000);
  // le frasi mostrate all'utente stanno fra apici/backtick: qui si cerca l'accusa in chiaro
  assert.ok(!/non ha pagato/.test(blocco), 'la barra accusa una persona');
  assert.ok(/sulla PARTITA, non su una persona/.test(blocco),
    'manca la dichiarazione che la differenza è della partita: senza, chi legge la attribuisce a chi è in riga');
});

test('col dovuto incompleto la barra NON dichiara una differenza', () => {
  const i = APP.indexOf('VOCE 198, passo ③ — IL CONFRONTO');
  const blocco = APP.slice(i, i + 3000);
  // il ramo ignoti>0 deve venire PRIMA dei rami che confrontano, o si annuncerebbe un «mancano»
  // calcolato su un dovuto che è solo un minimo.
  const iIgnoti = blocco.indexOf('d.ignoti > 0');
  const iQuadra = blocco.indexOf('incassatoCents === d.cents');
  assert.ok(iIgnoti > 0 && iQuadra > 0, 'non trovo i due rami');
  assert.ok(iIgnoti < iQuadra,
    'il ramo del dovuto incompleto deve essere controllato PRIMA del confronto, o si annuncia una differenza calcolata su un minimo');
});

test('anche l\'incassato in più ha una spiegazione, non un allarme', () => {
  const i = APP.indexOf('VOCE 198, passo ③ — IL CONFRONTO');
  const blocco = APP.slice(i, i + 3000);
  assert.ok(/in più/.test(blocco), 'il caso incassato > dovuto non è previsto');
  assert.ok(/importo cambiato dopo l'incasso/.test(blocco),
    'manca la spiegazione del caso «in più»: senza, sembra un errore di chi ha incassato');
});
