// ─────────────────────────────────────────────────────────────────────────────
// SONDA MATCHPOINT — leggere gli slot liberi di un circolo servito da Matchpoint.
//
// Nasce il 24/08/2026, dopo che il committente ha chiesto di rendere Padel
// Village interrogabile come gli altri circoli. Fino a quel giorno la sua riga
// era esclusa da una guardia (`NON_SI_INTERROGA`) con una ragione scritta:
// «casa nostra si legge dal gestionale». Quella ragione non è sbagliata — è la
// più fresca, perché il gestionale sincronizza ogni 2 minuti — ma non copre il
// caso per cui questa sezione esiste: dire al socio DOVE c'è posto, confrontando
// noi con gli altri **con lo stesso metro**. Due fonti diverse non si confrontano.
//
// ⭐⭐ LA MISURA CHE HA DECISO IL DISEGNO (24/08/2026): la lettura degli slot
//    liberi **NON richiede login**. Provato nei due modi a pochi secondi di
//    distanza, stessa data: senza credenziali 17 slot, con credenziali gli
//    stessi 17, identici uno per uno.
//    ⇒ Questa sonda NON ha credenziali, e non deve averne. Niente
//      `MATCHPOINT_USER`/`MATCHPOINT_PASS` nei segreti, niente password nella
//      tabella dei circoli — che infatti non ha colonne per tenerle, e non è una
//      dimenticanza. Ciò che non si possiede non si può perdere.
//    ⚠️ È una misura, non una legge del portale: se un domani Matchpoint
//      chiudesse la ricerca dietro il login, questa sonda comincerebbe a
//      leggere ZERO slot. Per questo `SENZA_MODULO` (sotto) è un ERRORE
//      dichiarato e non un elenco vuoto: «non ho potuto leggere» e «non c'è
//      posto» sono la stessa frase solo per chi non deve giocarci.
//
// Il flusso, due sole richieste — misurate in ~2,4 s in tutto:
//   ① GET  /Matches/OpenNew.aspx   → cookie di sessione + i tre campi ViewState
//   ② POST /Matches/OpenNew.aspx   → data + «tutta la giornata» + CERCA CAMPO
//                                    e la risposta È già l'elenco degli slot.
//
// 🔎 Perché il parsing regge: gli slot NON si leggono dal disegno della pagina
//    ma dai due `Repeater` che ASP.NET numera con lo stesso indice —
//    `LabelPista_<n>` (il nome del campo) e `HyperLinkAcceder_<n>` (il link, che
//    porta idrecurso/horainicio/horafin nei parametri). Appaiare per indice
//    sopravvive a un cambio di CSS, di colori e di ordine delle schede: si
//    romperebbe solo se cambiassero i nomi dei controlli, e quello si vede
//    subito perché il conto va a zero.
// ─────────────────────────────────────────────────────────────────────────────

export type SlotLibero = {
  campo: string;        // «Campo 4» come lo scrive il circolo
  tipo: string | null;  // «Indoor» / «Outdoor», se dichiarato
  idRisorsa: string;    // idrecurso: l'identificatore interno del campo
  ora: string;          // «9:30»
  oraFine: string;      // «11:00»
};

/** I tre campi nascosti che ASP.NET pretende indietro a ogni POST. */
function campiViewState(html: string): Record<string, string> {
  const leggi = (nome: string) =>
    (html.match(new RegExp(`id="${nome}"[^>]*value="([^"]*)"`, 'i')) || [])[1] ?? '';
  return {
    __VIEWSTATE: leggi('__VIEWSTATE'),
    __VIEWSTATEGENERATOR: leggi('__VIEWSTATEGENERATOR'),
    __EVENTVALIDATION: leggi('__EVENTVALIDATION'),
  };
}

/** `&amp;` e simili: gli href nell'HTML sono codificati, i parametri no. */
const decodi = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/**
 * Estrae gli slot liberi appaiando i due Repeater per indice.
 * Un link senza il suo LabelPista non viene buttato: il campo resta `null` e la
 * riga si vede lo stesso — perdere uno slot in silenzio sarebbe dire «non c'è
 * posto» dove il posto c'era.
 */
export function slotDaHtml(html: string): SlotLibero[] {
  const nomi = new Map<string, { campo: string; tipo: string | null }>();
  for (const m of html.matchAll(/LabelPista_(\d+)"[^>]*>([^<]+)</gi)) {
    const testo = decodi(m[2]).trim();                       // es. «Campo 4 (Indoor)»
    const pezzi = testo.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
    nomi.set(m[1], { campo: (pezzi?.[1] ?? testo).trim(), tipo: pezzi?.[2]?.trim() ?? null });
  }

  const slot: SlotLibero[] = [];
  for (const m of html.matchAll(/HyperLinkAcceder_(\d+)"[^>]*href="([^"]+)"/gi)) {
    const p = new URLSearchParams(decodi(m[2]).split('?')[1] ?? '');
    const ora = p.get('horainicio');
    const oraFine = p.get('horafin');
    if (!ora || !oraFine) continue;                          // non è una scheda di slot
    const n = nomi.get(m[1]);
    slot.push({
      campo: n?.campo ?? `risorsa ${p.get('idrecurso') ?? '?'}`,
      tipo: n?.tipo ?? null,
      idRisorsa: p.get('idrecurso') ?? '',
      ora, oraFine,
    });
  }
  return slot;
}

/** `2026-08-25` → `25/08/2026`, il solo formato che quella tendina accetta. */
export function dataPerMatchpoint(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error('DATA_NON_VALIDA');
  return `${m[3]}/${m[2]}/${m[1]}`;
}

type Chiedi = (url: string, opts: RequestInit) => Promise<Response>;

/**
 * Legge gli slot liberi di UNA data. Non scrive niente: nessuna prenotazione
 * parte da qui, e la pagina che tocchiamo è quella di ricerca.
 */
export async function sondaMatchpoint(
  base: string, dataIso: string, chiedi: Chiedi, durataMinuti = 90,
): Promise<{ slot: SlotLibero[]; tappe: Record<string, unknown>[] }> {
  const tappe: Record<string, unknown>[] = [];
  const dataIt = dataPerMatchpoint(dataIso);
  const url = new URL('Matches/OpenNew.aspx', base).toString();

  // ① la pagina di ricerca: da qui arrivano il cookie e il ViewState
  const t1 = Date.now();
  const resApri = await chiedi(url, { method: 'GET' });
  const htmlApri = await resApri.text();
  const vs = campiViewState(htmlApri);
  const haModulo = /DropDownListFecha/.test(htmlApri);
  tappe.push({ tappa: 'apri ricerca', http: resApri.status, ms: Date.now() - t1, byte: htmlApri.length, haModulo });
  if (!resApri.ok) throw new Error(`RICERCA_HTTP_${resApri.status}`);

  // ⚠️ Il modulo assente vuol dire che il portale ci sta mostrando altro — un
  //    login, una manutenzione, una pagina cambiata. Proseguire troverebbe zero
  //    slot e li chiamerebbe «nessun posto libero»: la bugia più costosa che
  //    questo servizio possa dire, perché ha esattamente la forma della verità.
  if (!haModulo) throw new Error('SENZA_MODULO');

  // ② la ricerca vera: tutta la giornata, così una sola richiesta copre l'intero giorno
  const t2 = Date.now();
  const p = 'ctl00$ContentPlaceHolderContenido$';
  const modulo = new URLSearchParams({
    ...vs,
    [`${p}DropDownListDeportes`]: '2',              // 2 = Padel
    [`${p}DropDownListFecha`]: dataIt,
    [`${p}DropDownListDuracionPartidos`]: String(durataMinuti),
    [`${p}CheckBoxSinHorario`]: 'on',               // «Vedere tutto il giorno»
    [`${p}ButtonLocalizar`]: 'CERCA CAMPO',
  });
  const resCerca = await chiedi(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: modulo.toString(),
  });
  const htmlCerca = await resCerca.text();
  const slot = slotDaHtml(htmlCerca);
  tappe.push({ tappa: 'cerca campo', http: resCerca.status, ms: Date.now() - t2, byte: htmlCerca.length, slot: slot.length, data: dataIt });
  if (!resCerca.ok) throw new Error(`CERCA_HTTP_${resCerca.status}`);

  return { slot, tappe };
}

/**
 * Griglia dedotta dagli slot: apertura, chiusura, passo, elenco campi.
 * ⚠️ È dedotta da ciò che è LIBERO, quindi descrive il giorno osservato e non
 *    l'orario del circolo: un giorno pieno restituirebbe una griglia stretta.
 *    Serve a riempire le colonne della tabella con qualcosa di misurato — mai a
 *    rispondere «il circolo apre alle…».
 */
export function grigliaDaSlot(slot: SlotLibero[]) {
  if (!slot.length) return { apertura: null, chiusura: null, slotMinuti: null, campi: [] as string[] };
  const inMinuti = (h: string) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
  const dueCifre = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  const inizi = slot.map((s) => inMinuti(s.ora));
  const fini = slot.map((s) => inMinuti(s.oraFine));
  const durate = slot.map((s, i) => fini[i] - inizi[i]).filter((d) => d > 0);
  return {
    apertura: dueCifre(Math.min(...inizi)),
    chiusura: dueCifre(Math.max(...fini)),
    slotMinuti: durate.length ? durate.sort((a, b) => a - b)[Math.floor(durate.length / 2)] : null,
    campi: [...new Set(slot.map((s) => s.campo))].sort(),
  };
}
