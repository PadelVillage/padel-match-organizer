// ⛔️ COPIA NON VIVA — la sorgente è il repo PadelVillage/padel-match-assistant,
// che è quello pubblicato su https://soci.padelvillage.club. Modificare QUESTO file
// non cambia nulla di ciò che vedono i soci. Vedi ../README.md.
// logic.js — logica PURA del login: nessun DOM, nessuna rete, nessuno stato
// globale. Tutto ciò che sta qui è esercitabile dall'harness
// (web/test/login-logic-test.html) senza far partire l'app.
//
// Regola che governa questo file: il server non manda mai al browser il cognome
// né l'email in anagrafica del socio. Qui dentro quei dati non esistono, e le
// funzioni sono scritte per non poterli nemmeno dedurre.

/**
 * Telefono digitato → cifre utili. Accetta le forme che la gente scrive
 * davvero: «339 123 4567», «+39 339 1234567», «0039...», con punti o trattini.
 * Il confronto in anagrafica avviene sulle ultime 10 cifre, come già fa il
 * ponte dati esistente.
 */
export function normalizePhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  const last10 = digits.slice(-10);
  return { digits, last10, valid: digits.length >= 10 };
}

/** Solo trim + minuscolo: gli stessi due passi che fa il server. */
export function normalizeEmail(raw) {
  return String(raw ?? '').trim().toLowerCase();
}

/**
 * Controllo di forma, per fermare i refusi prima di spendere una challenge.
 * Volutamente permissivo: l'autorità è il confronto server-side con la scheda,
 * non questa regex.
 */
export function isPlausibleEmail(raw) {
  const email = normalizeEmail(raw);
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);
}

/**
 * Maschera per il messaggio «ti ho mandato il codice a…».
 * Maschera SEMPRE la stringa che l'utente ha appena digitato, mai un indirizzo
 * che arrivi dal server: così la schermata è identica sia quando l'email
 * combacia sia quando non combacia, e non rivela nulla dell'anagrafica.
 */
export function maskEmail(raw) {
  const email = normalizeEmail(raw);
  const at = email.lastIndexOf('@');
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const keep = local.length <= 2 ? 1 : 2;
  return local.slice(0, keep) + '•'.repeat(Math.max(2, local.length - keep)) + domain;
}

/** Il campo del codice accetta 6 cifre e nient'altro. */
export function sanitizeCode(raw) {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 6);
}

export function isCompleteCode(raw) {
  return /^[0-9]{6}$/.test(sanitizeCode(raw));
}

/**
 * Che schermata mostrare dopo il passo «identify».
 *
 *   sconosciuto → il numero non è di un socio: si va in segreteria.
 *   scelta      → più soci sullo stesso telefono (coppie, famiglie): pulsanti
 *                 coi soli nomi di battesimo.
 *   segreteria  → socio riconosciuto ma senza email in scheda. NON gli si
 *                 chiede di inserirne una: il telefono non è un segreto, quindi
 *                 chiunque lo conosca metterebbe la propria email e si
 *                 prenderebbe l'account. L'indirizzo si raccoglie prima, da un
 *                 canale già fidato.
 *   email       → caso normale: si chiede l'email e la si fa confrontare.
 */
export function decideAfterIdentify(res) {
  const candidates = Array.isArray(res?.candidates) ? res.candidates : [];
  if (res?.found !== true || candidates.length === 0) {
    return { screen: 'sconosciuto' };
  }
  if (candidates.length > 1) {
    return { screen: 'scelta', candidates };
  }
  return decideForCandidate(candidates[0]);
}

/** Ramo per un singolo candidato, usato anche dopo la scelta a pulsanti. */
export function decideForCandidate(candidate) {
  const firstName = String(candidate?.first_name ?? '').trim();
  const index = Number(candidate?.index ?? 0);
  if (candidate?.has_email !== true) {
    return { screen: 'segreteria', firstName, index };
  }
  return { screen: 'email', firstName, index };
}

/** «mario» → «Mario». Il server manda il nome com'è in anagrafica. */
export function prettyName(raw) {
  const name = String(raw ?? '').trim();
  if (!name) return '';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** mm:ss per il conto alla rovescia della challenge. */
export function formatCountdown(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}
