// ─────────────────────────────────────────────────────────────────────────────
// Confronto fra i maestri di Matchpoint e la lista del gestionale.
//
// Logica PURA e isolata dal resto (niente rete, niente Deno.env) apposta per
// essere provata: è il pezzo che decide se stanotte parte un'email o no.
//
// 🚨 La regola di confronto NON è l'uguaglianza, è «CONTIENE» — dev'essere la
// stessa di selectIstruttore() nel worker (server.mjs), che al salvataggio cerca
// l'opzione del dropdown il cui testo contiene il nostro valore. Se qui usassimo
// l'uguaglianza, "Santiago" (nostro) vs "Santiago Carabajal" (Matchpoint)
// risulterebbe disallineato tutte le notti pur funzionando benissimo.
// ─────────────────────────────────────────────────────────────────────────────

export type Esito = {
  allineato: boolean;
  /** Voci di Matchpoint che nessun nostro valore intercetta: maestri NUOVI, non selezionabili. */
  daAggiungere: string[];
  /** Nostri valori che nessuna voce di Matchpoint contiene: il salvataggio fallirebbe MUTO. */
  rotti: string[];
  /** Coppie che si corrispondono, per il corpo dell'email. */
  coperti: { nostro: string; matchpoint: string }[];
};

function norm(s: unknown): string {
  return String(s ?? '').trim().toLowerCase();
}

/**
 * @param nostri      valori_validi di parser_rules.json (quelli che l'app offre)
 * @param matchpoint  testi delle option del dropdown Monitor (già ripuliti dal worker)
 */
export function confronta(nostri: string[], matchpoint: string[]): Esito {
  const nostriPuliti = (nostri || []).map((v) => String(v ?? '').trim()).filter(Boolean);
  const mpPuliti = (matchpoint || []).map((v) => String(v ?? '').trim()).filter(Boolean);

  const coperti: { nostro: string; matchpoint: string }[] = [];
  const rotti: string[] = [];

  for (const nostro of nostriPuliti) {
    const voce = mpPuliti.find((m) => norm(m).includes(norm(nostro)));
    if (voce) coperti.push({ nostro, matchpoint: voce });
    else rotti.push(nostro);
  }

  // Una voce di Matchpoint è "coperta" se QUALCHE nostro valore la intercetta.
  // Attenzione: non basta guardare i `coperti` di sopra — due nostri valori
  // potrebbero puntare alla stessa voce, lasciandone un'altra scoperta.
  const daAggiungere = mpPuliti.filter(
    (m) => !nostriPuliti.some((nostro) => norm(m).includes(norm(nostro))),
  );

  return {
    allineato: daAggiungere.length === 0 && rotti.length === 0,
    daAggiungere,
    rotti,
    coperti,
  };
}

/** Impronta stabile dell'esito: serve a non rimandare la stessa email ogni notte. */
export function impronta(esito: Esito): string {
  return JSON.stringify({
    a: [...esito.daAggiungere].sort(),
    r: [...esito.rotti].sort(),
  });
}
