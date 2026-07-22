// Regole PURE sul telefono in arrivo dall'export Matchpoint, estratte da index.ts per poterle
// provare senza far girare l'import (stesso schema di matchpoint-history-sync/history-window.ts).
//
// ⚠️ Qui dentro c'è il pezzo più delicato dell'anagrafica: il telefono è la CHIAVE D'IDENTITÀ
// del socio (`memberCloudKey` → `phone:<cifre>`), quindi cambiare `normalizePhone` non cambia
// un campo, RINOMINA le persone — scheda vecchia tombstonata e scheda nuova. Si tocca solo con
// una misura davanti (quante chiavi si spostano, quante collidono), mai «a occhio».

function clean(value: unknown) {
  return String(value ?? '').trim();
}

// Mobile italiano storico scritto senza prefisso: 9 cifre che iniziano per 3 (335…, 347…, 360…).
// Esiste solo per NON far scattare lo scalino internazionale qui sotto su un italiano che
// qualcuno ha scritto col "+": senza questa guardia perderebbe il 39, scenderebbe sotto
// PLAUSIBLE_PHONE_MIN_DIGITS e verrebbe scartato dall'import — l'opposto del fix del 19/07.
// Gli E.164 esteri lunghi esattamente 9 cifre e inizianti per 3 sono solo Andorra (+376 + 6):
// nessuno in anagrafica, e sbagliarne uno ipotetico è meglio che azzerare il numero a 5 soci veri.
const ITALIAN_LOCAL_MOBILE_RE = /^3\d{8}$/;

export function normalizePhone(value: unknown) {
  const raw = clean(value);
  let digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  // "Era già internazionale" si decide ORA: lo 00 sparisce alla riga sotto e il + non è mai
  // entrato in `digits`. Valgono entrambe le forme perché non sappiamo quale usi l'export.
  const hadIntlPrefix = raw.startsWith('+') || digits.startsWith('00');
  if (digits.startsWith('00')) digits = digits.slice(2);
  // v6.090: collassa prefisso 39 duplicato (dato sporco Matchpoint "+39+39..." / "+3939...").
  // Rende canonici i soci MP double-39 → agganciano per telefono il gemello Google e si fondono.
  if (digits.length === 14 && digits.startsWith('3939') && /^393\d{9}$/.test(digits.slice(2))) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('3')) digits = `39${digits}`;
  else if (digits.startsWith('0') && digits.length >= 7 && digits.length <= 11) digits = `39${digits}`;
  else if (hadIntlPrefix && digits.length >= 8 && !ITALIAN_LOCAL_MOBILE_RE.test(digits)) {
    // Numero estero già completo di prefisso paese: lasciarlo stare. Lo stesso scalino c'è già
    // in google-contacts-import (getWhatsAppPhoneInfo): era il loro disaccordo ad aprire due
    // schede allo stesso socio estero, una chiavata +39<estero> e una corretta.
  }
  else if (!digits.startsWith('39') && digits.length >= 8 && digits.length <= 11) digits = `39${digits}`;
  if (['3939561626', '393939561626', '03939561626'].includes(raw.replace(/\D/g, '')) || digits === '393939561626') {
    digits = '393939561626';
  }
  return digits ? `+${digits}` : '';
}

export function phoneDigits(value: unknown) {
  return normalizePhone(value).replace(/\D/g, '');
}

// Guardia telefono corto/sospetto (stile anti-churn v6.090): l'export Excel di Matchpoint
// a volte emette per un socio un numero MONCO (es. "+39335811", 8 cifre, socio 000004)
// mentre la pagina cliente mostra quello pieno. Un numero italiano plausibile dopo
// normalizePhone ha almeno 11 cifre ("39" + ≥9): sotto questa soglia il numero in arrivo
// non deve mai sovrascrivere un numero pieno già presente nel record.
// La soglia ha DUE usi, e il secondo è quello che chiude il buco del primo:
//   · in applyMatchpointContacts, per non sovrascrivere un numero pieno — ma protegge solo chi
//     sta GIÀ bene: chi arriva monco la prima volta non ha niente da proteggere, il monco entra
//     e da lì è congelato (monco == monco ⇒ nessun cambiamento);
//   · in parseMemberRow (qui sotto, `decidePhoneImport`), per non farlo entrare proprio —
//     nemmeno come chiave d'identità.
export const PLAUSIBLE_PHONE_MIN_DIGITS = 11;

// La cella in notazione scientifica ("1,13149E+11") va riconosciuta sulla cella GREZZA: dopo
// normalizePhone non si distingue più da un numero corto qualunque.
export const SCIENTIFIC_NOTATION_RE = /\d(?:[.,]\d+)?E[+-]?\d+/i;

/**
 * Decide se il telefono di una riga dell'export entra in anagrafica.
 *
 * Il campo scartato resta VUOTO — un socio senza telefono è visibilmente incompleto e
 * recuperabile — e `phoneImportRejected` lo consegna al report giornaliero
 * (anagrafica-report-telefoni). Soprattutto: la decisione avviene PRIMA della chiave, perché
 * `memberCloudKey` usa il telefono come identità, e un numero storpiato fa sembrare il socio
 * un'altra persona aprendogli una scheda NUOVA (è così che sono nati i doppioni di Longato,
 * Carnevale e — il 22/07 — Neves De Sa).
 *
 * ⚠️ DUE misure, perché la sola soglia lasciava passare proprio gli ESTERI (caso 001070):
 *  1. la notazione scientifica si riconosce sulla cella GREZZA. Un monco italiano resta "39…"
 *     e cade sotto soglia da solo, ma un estero non comincia per 39: il fallback gli mette un
 *     "39" davanti e lo porta a 10 cifre, dove la soglia non lo vedeva più.
 *  2. la soglia si misura sul valore CHE VIENE SALVATO. `normalizePhone` NON è idempotente:
 *     un "+39"+8cifre rientra come "10 cifre che iniziano per 3" e ne esce a 12, cioè SOPRA
 *     soglia. Misurando con `phoneDigits()` la guardia gonfiava esattamente i numeri che
 *     doveva scartare.
 */
export function decidePhoneImport(cell: unknown): { phone: string; phoneImportRejected: boolean } {
  const raw = clean(cell);
  const isScientific = SCIENTIFIC_NOTATION_RE.test(raw);
  const importedPhone = isScientific ? '' : normalizePhone(raw);
  const phoneImportRejected = isScientific
    || (!!importedPhone && importedPhone.replace(/\D/g, '').length < PLAUSIBLE_PHONE_MIN_DIGITS);
  return { phone: phoneImportRejected ? '' : importedPhone, phoneImportRejected };
}
