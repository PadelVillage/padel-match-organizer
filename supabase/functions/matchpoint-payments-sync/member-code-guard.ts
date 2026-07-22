// Regole PURE di aggancio incasso→socio, estratte da index.ts per poterle provare senza far
// girare il sync (stesso schema di matchpoint-clients-sync/phone-guard.ts).
//
// ⚠️ Il punto delicato: in anagrafica convivono DUE numerazioni INDIPENDENTI.
//   · cliente Matchpoint  → codice di sole cifre        "000326"
//   · socio creato dall'app → progressivo interno       "PMO-000326"
// Ridotti a cifre nude diventano lo stesso "326", ma non sono la stessa persona e non hanno
// nulla in comune: il "PMO-" è un contatore dell'app, non un identificatore Matchpoint.
// `id_cliente` del report 11.13 è SEMPRE un codice Matchpoint, quindi un socio "PMO-" non deve
// mai essere agganciabile PER CODICE. E siccome byCode è provato per PRIMO, una collisione
// numerica BATTE l'email e il nome — che sarebbero corretti. Danno misurato in PROD il 22/07:
// 3 incassi nella scheda di un socio che non li ha mai fatti.

type JsonMap = Record<string, unknown>;
export type MemberRecord = { local_key: string; payload: JsonMap };
export type MemberIndex = {
  byCode: Map<string, MemberRecord>;
  byEmail: Map<string, MemberRecord>;
  byName: Map<string, MemberRecord>;
};

function clean(value: unknown) {
  return String(value ?? '').trim();
}

// Codice cliente comparabile: solo cifre, senza zeri iniziali ("000004" → "4", "4" → "4").
export function normalizeCode(value: unknown) {
  return clean(value).replace(/\D/g, '').replace(/^0+/, '');
}

export function normalizeEmail(value: unknown) {
  return clean(value).toLowerCase();
}

export function normalizeName(value: unknown) {
  return clean(value).toLowerCase()
    .replace(/[àáâ]/g, 'a').replace(/[èé]/g, 'e').replace(/[ìí]/g, 'i')
    .replace(/[òó]/g, 'o').replace(/[ùú]/g, 'u')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

// Test POSITIVO ("è tutto cifre?") e non lista nera del prefisso "PMO-": misurato il 22/07 sui
// soci vivi con codice, le forme in anagrafica sono esattamente DUE — 1050 tutto-cifre e 26
// "PMO-<cifre>", zero altre. Con la lista nera un prefisso futuro diverso da "PMO-" rientrerebbe
// in silenzio nell'indice dei codici; così invece resta fuori da solo.
export function isMatchpointMemberCode(value: unknown) {
  return /^\d+$/.test(clean(value));
}

export function buildMemberIndex(records: MemberRecord[]): MemberIndex {
  const byCode = new Map<string, MemberRecord>();
  const byEmail = new Map<string, MemberRecord>();
  const byName = new Map<string, MemberRecord>();
  const codeCount = new Map<string, number>();
  const nameCount = new Map<string, number>();

  for (const rec of records) {
    const p = rec.payload || {};
    // Solo i codici Matchpoint entrano nell'indice per codice (vedi testa del file).
    const code = isMatchpointMemberCode(p.memberId) ? normalizeCode(p.memberId) : '';
    if (code) {
      codeCount.set(code, (codeCount.get(code) || 0) + 1);
      if (!byCode.has(code)) byCode.set(code, rec);
    }
    const email = normalizeEmail(p.email);
    if (email && !byEmail.has(email)) byEmail.set(email, rec);
    const name = normalizeName(p.name || `${clean(p.firstName)} ${clean(p.surname)}`);
    if (name) {
      nameCount.set(name, (nameCount.get(name) || 0) + 1);
      if (!byName.has(name)) byName.set(name, rec);
    }
  }

  // #4 — i nomi AMBIGUI (≥2 soci OMONIMI) vengono ESCLUSI dal match-per-nome: altrimenti il
  // "primo vince" attribuirebbe il pagamento al socio sbagliato (borsellino/incassi errati).
  // Meglio nessun match → member_local_id null: l'incasso resta in cassa, ma non mal-attribuito.
  for (const [name, n] of nameCount) { if (n > 1) byName.delete(name); }
  // Lo STESSO ragionamento vale per i codici, ed era l'altra metà mancante: anche `byCode` è
  // "primo vince", e chi vince dipende dall'ordine di pagina di loadMembers — cioè da nulla di
  // deterministico. Due sync potrebbero attribuire lo stesso incasso a due soci diversi.
  for (const [code, n] of codeCount) { if (n > 1) byCode.delete(code); }

  return { byCode, byEmail, byName };
}

// L'ordine è codice → email → nome, dal più forte al più debole. Sta qui e non in index.ts
// perché è metà del difetto: è l'essere provato per PRIMO che rende dannosa una collisione
// di codice, e la suite deve poter esercitare la precedenza, non solo le singole mappe.
export function lookupMemberForRow(
  index: MemberIndex,
  row: { cod?: unknown; email?: unknown; name?: unknown },
): MemberRecord | undefined {
  // `normalizeCode` è idempotente ("326"→"326"), quindi va bene sia il cod grezzo della cella
  // sia quello già normalizzato dal parser: la chiave dell'indice si calcola sempre allo stesso
  // modo da entrambi i lati, e nessun chiamante può disallinearli per distrazione.
  const cod = normalizeCode(row.cod);
  const email = clean(row.email);
  const name = clean(row.name);
  return (cod ? index.byCode.get(cod) : undefined)
    || (email ? index.byEmail.get(normalizeEmail(email)) : undefined)
    || (name ? index.byName.get(normalizeName(name)) : undefined);
}
