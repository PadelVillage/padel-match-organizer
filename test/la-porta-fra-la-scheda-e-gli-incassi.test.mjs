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
function montaLookup(staffBookings, occupazione) {
  const sorgente = [
    sorgenteDi('pmoTipoScheda'),
    sorgenteDi('pmoTipoParola'),
    sorgenteDi('_pmoLookupTipoDurata'),
  ].join('\n');
  const fab = new Function('SB', 'OCC', `
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
    const safeLoad = (k, d) => (k === 'staffBookings' ? SB : d);
    const prenotazioniOccupazione = OCC;
    ${sorgente}
    return _pmoLookupTipoDurata;
  `);
  return fab(staffBookings, occupazione);
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
  assert.ok(m[0].includes('${_fxBar}'), 'la barra del focus non è nella parte sticky: scorrerebbe via lasciando numeri parziali senza spiegazione');
  assert.ok(m[0].indexOf('${_fxBar}') < m[0].indexOf('${summary}'), 'la barra deve stare PRIMA dei totali che filtra');
});

test('entrare in Incassi dal menu azzera il focus', () => {
  const m = APP.match(/if \(tabName === 'incassi'\) \{[^}]*\}/);
  assert.ok(m, 'non trovo l\'ingresso nella sezione Incassi');
  assert.ok(/_incassiState\.focus = null/.test(m[0]),
    'il focus sopravvive al menu: chi apre «Incassi» troverebbe una tabella filtrata senza averlo chiesto');
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
