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
  testo?: string; // testo della casella, già su UNA riga: «HH:MM-HH:MM (4/4p) Partita 0,00 …»
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
 * Ricava il TIPO dal testo della casella del tabellone.
 *
 * Il testo arriva appiattito su una riga sola (il worker collassa gli spazi bianchi), nella
 * forma «HH:MM-HH:MM (4/4p) Partita 0,00 - 7,00 misto Mario Rossi …» oppure
 * «HH:MM-HH:MM (2p) Lezione. Santiago Carabajal . : scrivi su WhatsApp al … per prenotare. …».
 *
 * Leggiamo SOLO la parola che segue l'orario. Cercare «lezione» ovunque nel testo sarebbe più
 * semplice e sbagliato: la nota di una lezione è lunga e discorsiva, e la nota di una partita
 * potrebbe contenere quella parola → falsi positivi silenziosi.
 *
 * Ritorna '' se non c'è niente di riconoscibile: la scelta del ripiego spetta a chi chiama,
 * che è l'unico a sapere cosa costa sbagliare.
 */
export function tipoDaTestoTabellone(testo: unknown): string {
  const m = clean(testo).match(
    /^\d{1,2}[:.]\d{2}\s*[-–—]\s*\d{1,2}[:.]\d{2}\s*(?:\([^)]*\)\s*)?([A-Za-zÀ-ÖØ-öø-ÿ]+)/,
  );
  const parola = m ? m[1].toLowerCase() : '';
  if (!parola) return '';
  // Vocabolario dell'export, così a valle non arrivano stringhe che nessuno ha mai visto.
  if (parola.startsWith('lezion')) return 'Lezione Libera';
  if (parola.startsWith('partita')) return 'Partita';
  // Le altre categorie del tabellone (Scuola, Campionato, Seminario, Trattamento…) le
  // riportiamo tali e quali: l'app le mostrerà come «Partita» per la sua regola di ripiego,
  // ma il dato salvato resta quello VERO e un domani si può renderlo meglio senza riscraparlo.
  return parola.charAt(0).toUpperCase() + parola.slice(1);
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
        // Il tipo si LEGGE dalla casella. Prima era la costante 'Lezione Libera', perché il
        // caso che il recupero risolveva erano lezioni vuote: così però OGNI prenotazione
        // recuperata veniva chiamata lezione, comprese le partite senza giocatori (caso reale
        // 8737-8740, 24/07 20:30 sui 4 campi, segnalato dal committente il 21/07).
        // Ripiego 'Partita' quando il testo non dice niente: è la stessa regola che l'app usa
        // già per i tipi che non riconosce, quindi dato e schermo restano d'accordo — e
        // soprattutto NON si torna a dichiarare una lezione che nessuno ha mai visto.
        tipo: tipoDaTestoTabellone(ev.testo) || 'Partita',
        descrizione: roster.length ? roster.map((n) => `-${n}.`).join('') : '',
        ...(evId ? { idReserva: evId } : {}),
        ...(roster.length ? { giocatori: roster } : {}),
        _tabelloneOnly: true,
      });
    }
  }
  return out;
}
