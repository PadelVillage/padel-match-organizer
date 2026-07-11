// Recupero delle prenotazioni/lezioni SENZA giocatori dal tabellone Matchpoint.
//
// Perché serve: l'export "prenotazioni future" è il report "Elenco utenti negli spazi"
// (ListadoUsuariosEspacios), che elenca le prenotazioni ATTRAVERSO i loro occupanti. Una
// prenotazione/lezione senza giocatori non produce righe → l'app la vede come slot Libero
// anche se su Matchpoint il campo è occupato. Il tabellone invece la espone come evento
// (div.evento con id/idrecurso/inicio/fin e roster vuoto). Qui la trasformiamo in occupancy.
//
// Estratto in modulo puro (nessuna dipendenza da rete/Supabase) così è testabile in isolamento:
// la correttezza delle sicurezze anti-fantasma è la parte critica.

export type TabelloneEvent = {
  id?: string;
  campo: number;
  ora: string;
  oraFine?: string;
  giocatori?: string[];
  tipo?: string; // 'manutenzione' per i blocchi manutenzione (gestiti altrove)
};

export type RescuedOccupancy = {
  numero: string;
  giocatore: string;
  data: string;
  ora: string;
  durata: string;
  campo: string;
  tipo: string;
  descrizione: string;
  idReserva?: string;
  giocatori?: string[];
  _tabelloneOnly: true;
};

function clean(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function toMin(value: unknown): number {
  const m = String(value ?? '').match(/(\d{1,2})[:.](\d{2})/);
  return m ? (+m[1]) * 60 + (+m[2]) : NaN;
}

/**
 * Ritorna le occupancy da AGGIUNGERE per gli eventi del tabellone che NON hanno una riga
 * nell'export (tipicamente lezioni senza giocatori). Sicurezze anti-fantasma:
 *  1) `matchedKeys` (data|campo|ora) — gli slot che combaciano con l'export sono già coperti
 *     dai booking reali (che hanno sempre giocatori) → mai duplicati né sovrascritti;
 *  2) `exportNumeri` (idReserva già presenti nell'export) — backstop se il match campo+ora
 *     fallisse, evita di re-importare la stessa prenotazione una seconda volta.
 * La manutenzione è esclusa (ha un percorso dedicato).
 */
export function collectTabelloneOnlyOccupancies(
  tabelloneData: Record<string, TabelloneEvent[]>,
  matchedKeys: Set<string>,
  exportNumeri: Set<string>,
): RescuedOccupancy[] {
  const out: RescuedOccupancy[] = [];
  for (const [data, evs] of Object.entries(tabelloneData || {})) {
    for (const ev of (evs || [])) {
      if (!ev || ev.tipo === 'manutenzione') continue;
      const campoNum = Number(ev.campo) || 0;
      if (!campoNum || !ev.ora) continue;
      if (matchedKeys.has(`${data}|${campoNum}|${ev.ora}`)) continue;
      const evId = clean(ev.id || '');
      if (evId && exportNumeri.has(evId)) continue;
      const roster = Array.isArray(ev.giocatori)
        ? ev.giocatori.map((n) => clean(n)).filter(Boolean)
        : [];
      const mins = toMin(ev.oraFine) - toMin(ev.ora);
      const durata = (Number.isFinite(mins) && mins > 0) ? String(mins / 60) : '1.5';
      out.push({
        numero: evId,
        giocatore: '',
        data,
        ora: ev.ora,
        durata,
        campo: `Campo ${campoNum}`,
        tipo: 'Lezione Libera',
        descrizione: roster.length ? roster.map((n) => `-${n}.`).join('') : '',
        ...(evId ? { idReserva: evId } : {}),
        ...(roster.length ? { giocatori: roster } : {}),
        _tabelloneOnly: true,
      });
    }
  }
  return out;
}
