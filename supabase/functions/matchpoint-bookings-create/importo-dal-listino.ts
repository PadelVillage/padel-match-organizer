/**
 * 💶 L'IMPORTO A CARICO NASCE DAL LISTINO — voce 180. Regola pura, senza database.
 *
 * 🚨⭐⭐ IL FATTO CHE LA RENDE NECESSARIA, misurato l'08/09/2026 e non dedotto: oggi gli importi
 * della scheda partita **arrivano da Matchpoint dal vivo** (`matchpoint-bookings-edit` con
 * `read: true`, l'unica strada che salta il recinto). ⇒ Delle **256** `staff_booking` vive su PROD
 * solo **14** portano gli importi — le stesse 14 che qualcuno ha **aperto a mano**. Le altre 242
 * hanno solo i nomi. 📏 Sul sistema nuovo la proporzione è la stessa: **30 righe vive, 2 con
 * importi**.
 * ⇒ **La cassa non ha su cosa addebitare**, e costruirla su un dato che esiste nel 5% dei casi
 *   vorrebbe dire scoprirlo con i soldi veri di qualcuno.
 *
 * 🎯 LA CURA, ed è il verso del distacco: l'importo **non si va a leggere**, si **fa nascere**.
 * Il listino (voce 185) dice quanto paga ogni giocatore su quella fascia; la prenotazione nasce
 * già con quel numero addosso. Il giorno in cui Matchpoint si spegne, qui non cambia niente.
 *
 * ⚖️ LE QUATTRO REGOLE, e ciascuna è un modo di sbagliare che è già costato altrove:
 *   ① **`null` non è `0`.** Prezzo non deciso ⇒ **non si scrive niente**. Zero vorrebbe dire
 *      «gratis», e una partita segnata gratis non la rivede più nessuno (è la stessa distinzione
 *      che il vincolo del database protegge da quando la tabella esiste).
 *   ② **Non si sovrascrive un importo che c'è già.** Una riga può portare un numero **letto dal
 *      circolo** o **messo a mano dalla segreteria**: il listino è il valore di partenza, non
 *      un'autorità che passa sopra a una decisione presa.
 *   ③ **`pendenteCents` nasce uguale all'importo.** Nessuno ha ancora pagato: dire «pendente 0»
 *      su una partita appena creata sarebbe dichiararla riscossa.
 *   ④ 🚨 **NON si scrive `lettoAt`.** Quel campo vuol dire *«questo numero l'ho letto dal
 *      circolo»*, e appiccicarlo a un importo nato qui direbbe il falso proprio nel campo che
 *      esiste per tenere onesto il ricordo. ⇒ Si scrive `origineImporto: 'listino'` e
 *      `importoAt`. 📌 *Due provenienze diverse non si scrivono nello stesso campo: il giorno in
 *      cui divergono, nessuno sa più quale delle due sta leggendo.*
 *
 * 🔒 Modulo PURO: non conosce il database, non fa chiamate, non decide da dove viene il listino.
 * Stessa divisione di `scheda-nativa.ts` e `roster-slot.ts` — una regola che si può sbagliare va
 * messa dove la si può misurare **da sola**.
 */

/** Una fascia come la rende `pmo_calendario_effettivo`. */
export type FasciaListino = {
  ora_inizio?: unknown;
  ora_fine?: unknown;
  prezzo_cents?: unknown;
};

/** Un giocatore nella forma che la copia locale già conosce. */
export type GiocatoreRiga = Record<string, unknown> & { nome?: unknown };

/** `16:30:00` → `16:30`; tutto ciò che non è un orario → `null`. */
function oraPulita(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

/**
 * Il prezzo A GIOCATORE della fascia che **comincia** a quell'ora.
 *
 * ⚖️ Si guarda l'ora d'INIZIO e non «l'ora che cade dentro la fascia», ed è deliberato: una
 * prenotazione che comincia a metà di una fascia non è quella fascia — è un caso che il circolo
 * oggi non ha, e indovinare un prezzo per lui sarebbe inventarlo.
 * ⇒ `null` vuol dire **«non lo sappiamo»**, e chi legge deve dirlo invece di mettere zero.
 */
export function prezzoDellaFascia(fasce: readonly FasciaListino[] | null | undefined, ora: unknown): number | null {
  const cercata = oraPulita(ora);
  if (!cercata || !Array.isArray(fasce)) return null;
  for (const f of fasce) {
    if (!f || typeof f !== 'object') continue;
    if (oraPulita(f.ora_inizio) !== cercata) continue;
    const p = f.prezzo_cents;
    return (typeof p === 'number' && Number.isFinite(p) && p >= 0) ? Math.round(p) : null;
  }
  return null;
}

/**
 * Mette l'importo del listino addosso a ogni giocatore che non ne ha già uno.
 *
 * ⇒ Torna SEMPRE un elenco nuovo (non tocca quello ricevuto) e, se non c'è niente da mettere,
 * torna l'elenco **identico**: chi chiama può confrontare senza dover sapere le regole.
 */
export function importiDalListino(
  giocatori: readonly GiocatoreRiga[] | null | undefined,
  prezzoCents: number | null,
  quando: string,
): GiocatoreRiga[] {
  const elenco = Array.isArray(giocatori) ? giocatori : [];
  // ① prezzo non deciso ⇒ non si scrive niente. Zero sarebbe «gratis», che è un'altra cosa.
  if (prezzoCents === null || !Number.isFinite(prezzoCents) || prezzoCents < 0) {
    return elenco.map((g) => ({ ...g }));
  }
  return elenco.map((g) => {
    const riga: GiocatoreRiga = { ...g };
    // ② un importo già presente vince: può venire dal circolo o dalla segreteria.
    const gia = riga.importoCents;
    if (typeof gia === 'number' && Number.isFinite(gia)) return riga;
    riga.importoCents = prezzoCents;
    // ③ nessuno ha ancora pagato.
    const pen = riga.pendenteCents;
    if (!(typeof pen === 'number' && Number.isFinite(pen))) riga.pendenteCents = prezzoCents;
    // ④ da dove viene, detto per quello che è — e mai `lettoAt`.
    riga.origineImporto = 'listino';
    riga.importoAt = String(quando || '');
    return riga;
  });
}

/** Quanti giocatori hanno un importo, in questo elenco. Serve a dirlo nel registro. */
export function quantiConImporto(giocatori: readonly GiocatoreRiga[] | null | undefined): number {
  return (Array.isArray(giocatori) ? giocatori : [])
    .filter((g) => g && typeof g === 'object' && typeof g.importoCents === 'number').length;
}
