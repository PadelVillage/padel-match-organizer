/* 🏷️ «Impostazioni, non Amministrazione» — banco della VOCE 156 (04/09/2026).
 *
 * 🗣️ Suo: «nel menù in alto c'è una parola che si chiama amministrazione che può essere confusa
 *    con l'amministrazione economica. cambiamo il nome» → scelto **Impostazioni**.
 *
 * 📏 Guardato PRIMA di proporre il nome, perché un'etichetta deve descrivere quello che apre:
 *    dentro quel menu ci sono **Utenti Staff · Notifiche staff · Dati · Bot Telegram · Circoli**.
 *    Non una riga di soldi — gli incassi hanno un capitolo tutto loro.
 *
 * 🎯 LE COSE CHE QUESTO BANCO DIFENDE:
 *   ① la parola vecchia non si legge più DA NESSUNA PARTE nell'app. Non basta cambiarla nel menu:
 *      compariva in 24 punti, fra cui la pagina di accesso («email autorizzata in Amministrazione»)
 *      e tre messaggi d'errore del login. Cambiarne uno solo manda la gente a cercare una voce che
 *      non esiste;
 *   ② 🚨🚨 **LA CHIAVE INTERNA `administration` NON SI TOCCA**, ed è il vero pericolo di questa
 *      voce: ci sono appese la visibilità per ruolo (`view_administration`, `data-section-key`) e
 *      la navigazione (`goToTabSection('administration', …)`). Chi «completa» la rinomina
 *      cambiando anche quella non rompe una scritta: **spegne un capitolo intero per tutti**, e
 *      lo fa in silenzio, perché il menu continua a disegnarsi;
 *   ③ il bottone del menu porta il nome nuovo, e il capitolo ha ancora i suoi cinque figli.
 *
 * ⛔ QUELLO CHE NON DICE: che la parola scelta sia quella giusta. Quello l'ha deciso lui.
 *
 * Esegui:  node test/il-menu-non-dice-amministrazione.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(QUI, '..', 'index.html'), 'utf8');
assert.ok(APP.length > 500000, 'sorgente non letto: questo banco non direbbe niente');

let passed = 0, failed = 0;
function test(nome, fn) {
  try { fn(); passed++; console.log('ok   - ' + nome); }
  catch (e) { failed++; console.log('FAIL - ' + nome + '\n       ' + e.message); }
}

// ─────────────────────────────────────────────────────────────────────────────
test('① la parola vecchia non si legge più da nessuna parte', () => {
  const righe = APP.split('\n');
  const restate = [];
  righe.forEach((r, i) => { if (/Amministrazione/i.test(r)) restate.push((i + 1) + ': ' + r.trim().slice(0, 90)); });
  assert.deepEqual(restate, [],
    'restano ' + restate.length + ' punti che dicono ancora «Amministrazione»:\n       ' + restate.join('\n       '));
});

test('① e il nome nuovo c\'è, nei punti che si leggono', () => {
  assert.match(APP, /<h2>Impostazioni<\/h2>/, 'il titolo della sezione non porta il nome nuovo');
  assert.match(APP, /class="nav-main">Impostazioni</, 'il menu del telefono non porta il nome nuovo');
  assert.match(APP, /administration:\s*'🔐 Impostazioni'/, 'l\'etichetta del capitolo non è stata cambiata');
});

test('① i testi del LOGIN puntano al nome nuovo (è lì che si va a cercare la voce)', () => {
  // 🚨 Questi sono i punti che una rinomina «del menu» dimentica sempre: chi non riesce a
  //    entrare legge QUI dove deve andare, e se il nome è vecchio cerca una voce che non c'è.
  const login = APP.match(/pmoLoginIntro[\s\S]{0,400}/);
  assert.ok(login && /Impostazioni/.test(login[0]), 'la pagina di accesso non nomina Impostazioni');
  for (const frase of [
    'Email non abilitata o utente disattivato in Impostazioni.',
    'Password aggiornata, ma utente non attivo in Impostazioni.',
    'Email confermata, ma utente non attivo in Impostazioni.',
  ]) {
    assert.ok(APP.includes(frase), 'messaggio del login non aggiornato: «' + frase + '»');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ② 🚨🚨 La chiave interna. È qui che questa voce può fare male sul serio.
// ─────────────────────────────────────────────────────────────────────────────
test('② 🚨🚨 la chiave `administration` regge ancora la visibilità per ruolo', () => {
  assert.match(APP, /data-section-key="administration"/,
    'il bottone del capitolo ha perso `data-section-key="administration"`: il gating per ruolo '
    + 'non trova più il capitolo e le voci si mostrerebbero a chi non deve vederle');
  assert.match(APP, /key:\s*'view_administration',\s*tab:\s*'administration'/,
    'il permesso `view_administration` non è più agganciato al capitolo `administration`');
});

test('② 🚨🚨 e la navigazione punta ancora alla chiave, non al nome', () => {
  const salti = APP.match(/goToTabSection\('administration',\s*'[^']+'\)/g) || [];
  assert.ok(salti.length >= 5,
    'i salti verso il capitolo sono ' + salti.length + ' invece dei 5 attesi: se qualcuno ha '
    + 'rinominato la CHIAVE insieme all\'etichetta, il capitolo si spegne in silenzio');
  // 🚨 e nessuno dei salti deve essere stato «tradotto» col nome nuovo
  assert.doesNotMatch(APP, /goToTabSection\('impostazioni'/i,
    'un salto usa il NOME al posto della chiave: la rinomina è arrivata dove non doveva');
  assert.doesNotMatch(APP, /data-section-key="impostazioni"/i,
    'data-section-key porta il nome invece della chiave');
});

// ─────────────────────────────────────────────────────────────────────────────
test('③ il capitolo ha ancora i suoi figli', () => {
  const i = APP.indexOf('data-section-key="administration"');
  assert.ok(i > 0, 'bottone del capitolo non trovato');
  const menu = APP.slice(i, i + 1800);
  // ⚖️ Le voci elencate sono le QUATTRO che vivono su TUTT'E DUE i rami. «Circoli» esiste solo
  //    su test-preview: pretenderla qui renderebbe questo banco ROSSO SU PROD per una voce che
  //    a PROD non è mai stata promossa — cioè farebbe fallire una cura sana per un fatto che
  //    non la riguarda. 📌 Un banco che accompagna una promozione deve reggere sui due rami,
  //    o diventa un ostacolo alla promozione invece che una garanzia.
  for (const voce of ['Utenti Staff', 'Notifiche staff', 'Dati', 'Bot Telegram']) {
    assert.ok(menu.includes('>' + voce + '<'), 'sparita la voce «' + voce + '» dal menu');
  }
  const quanti = (menu.match(/data-subsection-key="view_admin_/g) || []).length;
  assert.ok(quanti >= 4, 'il capitolo ha ' + quanti + ' voci: ne sono sparite');
});

test('③ il bottone del menu si legge «Impostazioni»', () => {
  const i = APP.indexOf('data-section-key="administration"');
  const bottone = APP.slice(i, APP.indexOf('</button>', i));
  assert.match(bottone, /Impostazioni/, 'il bottone del capitolo non porta il nome nuovo');
  assert.doesNotMatch(bottone, /Amministrazione/i);
});

console.log('\n' + passed + ' passati, ' + failed + ' falliti');
process.exit(failed ? 1 : 0);
