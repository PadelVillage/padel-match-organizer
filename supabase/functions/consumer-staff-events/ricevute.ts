// ricevute.ts — quali fatti NON vanno detti, perché non li ha fatti il circolo (voce 70).
//
// 🗣️ Nasce da un difetto misurato al secondo la notte del 21/08/2026: Lidia accetta un invito
// dal bot, il bot le dice «✅ Sei in campo», e fra i 4 e i 19 minuti dopo il **circolo** le
// annuncia che è stata aggiunta alla partita. Il gesto era suo.
//
// 🔎 LA CAUSA, e non è una svista: `eventi-staff.ts` confronta due fotografie del calendario,
// cioè **DATI**. Vede *cosa* è cambiato e non può sapere **CHI** l'ha cambiato — è la stessa
// scelta che gli regala gratis il ③ («toccato ≠ cambiato»). ⇒ L'informazione manca là, ma
// esiste altrove: la scrittura l'ha eseguita `consumer-booking-write`, che quindi **sa**.
// Questo modulo è il punto in cui le due cose si incontrano.
//
// ⚖️ COSA SCARTA, esattamente: un fatto che combacia con una ricevuta recente. Una ricevuta
// dice *«questo cambiamento è passato dal canale del socio, non dalla segreteria»* — e un
// «avviso dal circolo» su un gesto che il circolo non ha fatto è falso nell'attribuzione per
// chiunque lo riceva, non solo per chi ha toccato il bottone. Il ragionamento gesto per gesto,
// coi conti, sta in `supabase/manual-sql/supabase_pmo_ricevute_gesti.sql`.
//
// 🚨⭐⭐ E SI SCARTA PRIMA DELLA RIDUZIONE, non dopo: è la riga che decide se questo modulo
// cura o rompe. Un socio che entra dal bot e che poi la **segreteria** toglie produce due
// fatti: `aggiunto` (suo) e `tolto` (del circolo). Scartando prima, resta il `tolto` e lui lo
// sente — che è giusto, perché quello non l'ha fatto lui. Scartando dopo, i due si sarebbero
// già fusi in un netto nullo e **non avrebbe saputo di essere stato tolto**.
// ⇒ *La riduzione risponde a «cosa è successo in tutto»; la ricevuta a «chi l'ha fatto». La
// seconda domanda va posta finché i singoli gesti esistono ancora.*

import type { FattoInCoda } from './riduzione.ts';

/** Una ricevuta come sta in tabella. */
export type Ricevuta = {
  id: string;
  data: string;
  ora: string;
  campo: string;
  persona: string;
  gesto: 'aggiunto' | 'tolto' | 'annullata';
  /** Quando il gestionale ha finito di scrivere, in ISO. */
  scritta_at: string;
};

/**
 * Quanto a lungo una ricevuta può coprire un fatto che arriva **dopo** di lei.
 *
 * 📏 Non è un numero a caso: il fatto nasce col ritardo del sync, misurato il 16/08/2026 su 43
 * creazioni — mediana **~2 minuti** (che è il cron da 2′) e massimo **10′04″**. Venti minuti
 * sono quel massimo raddoppiato, più i 2′ di quiete della consegna.
 * ⚖️ Il verso dell'errore, se la finestra fosse troppo stretta: torna il difetto della voce 70
 * (un avviso falso). Se troppo larga: una ricevuta potrebbe coprire un gesto vero della
 * segreteria — ma solo UNO, perché si consuma, ed è il motivo per cui il consumo esiste.
 */
export const FINESTRA_RICEVUTA_MS = 20 * 60 * 1000;

/**
 * Quanto una ricevuta può coprire un fatto visto **prima** che lei fosse scritta.
 *
 * 🚨 Sembra un paradosso e non lo è: la scrittura su Matchpoint la fa il worker guidando un
 * browser, che ci mette decine di secondi, e la ricevuta si scrive **dopo** che il worker ha
 * risposto. Un giro di sync che cade in mezzo vede il cambiamento **prima** che la ricevuta
 * esista. ⇒ Senza questa tolleranza il difetto tornerebbe proprio nelle scritture più lente,
 * cioè quelle in cui è più probabile.
 */
export const TOLLERANZA_ANTICIPO_MS = 3 * 60 * 1000;

/** Forma normalizzata di un nome, per confrontare e mai per mostrare. Gemella di `normNome`. */
function nomeConfrontabile(value: unknown): string {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * La chiave su cui un fatto e una ricevuta si riconoscono: partita, persona, gesto.
 *
 * 🚨⭐ NON si usa la stringa `slot` già pronta, ed è deliberato: le due copie della stessa
 * partita scrivono l'**ora** in due modi («09:30» e «09:30:00», secondo la strada da cui
 * arrivano) e il **campo** in due modi («Campo 1» dal sync Matchpoint, «1» dallo
 * `staff_booking` dell'app). Confrontare le stringhe grezze farebbe cadere l'accoppiamento in
 * silenzio — cioè riporterebbe il difetto senza che nessuno veda un errore.
 * ⇒ Si normalizza qui, una volta, per tutti e due i lati: ora ai primi cinque caratteri
 * (`HH:MM`), campo alle sole cifre, nome senza accenti né maiuscole.
 */
export function chiaveGesto(
  data: unknown,
  ora: unknown,
  campo: unknown,
  persona: unknown,
  gesto: unknown,
): string {
  const d = String(data ?? '').trim().slice(0, 10);
  const o = String(ora ?? '').trim().slice(0, 5);
  const c = String(campo ?? '').replace(/\D/g, '');
  return `${d}|${o}|${c}|${nomeConfrontabile(persona)}|${String(gesto ?? '').trim()}`;
}

/** Cosa resta da consegnare, e cosa è stato coperto da una ricevuta. */
export type Copertura = {
  /** I fatti che il circolo ha davvero prodotto: proseguono verso la riduzione. */
  daConsegnare: FattoInCoda[];
  /** I fatti scartati, ognuno con la ricevuta che l'ha coperto. */
  coperti: Array<{ fatto: FattoInCoda; ricevuta: Ricevuta }>;
};

/**
 * Separa i fatti del circolo da quelli che il socio ha fatto passando dal bot.
 *
 * @param fatti     I fatti ancora in coda, in qualunque ordine.
 * @param ricevute  Le ricevute recenti non ancora consumate, in qualunque ordine.
 *
 * ⭐ Una ricevuta copre **un solo** fatto: le si accoppiano in ordine di tempo, la più vecchia
 * col fatto più vecchio. Se la segreteria ripete lo stesso gesto sulla stessa persona nella
 * stessa mezz'ora, il secondo passa — ed è giusto che passi, perché quello è suo.
 *
 * ⚠️ Un istante illeggibile su una delle due parti fa fallire l'accoppiamento, cioè **consegna**.
 * È il verso prudente per questa funzione: sbagliando si torna al fastidio di prima, non al
 * silenzio — e un silenzio qui sarebbe indistinguibile da un fatto che non è successo.
 */
export function copertura(
  fatti: FattoInCoda[],
  ricevute: Ricevuta[],
  finestraMs: number = FINESTRA_RICEVUTA_MS,
  tolleranzaMs: number = TOLLERANZA_ANTICIPO_MS,
): Copertura {
  const perChiave = new Map<string, Ricevuta[]>();
  for (const r of ricevute) {
    const k = chiaveGesto(r.data, r.ora, r.campo, r.persona, r.gesto);
    const gia = perChiave.get(k);
    if (gia) gia.push(r);
    else perChiave.set(k, [r]);
  }
  for (const [, gruppo] of perChiave) {
    gruppo.sort((a, b) => String(a.scritta_at).localeCompare(String(b.scritta_at)));
  }

  const usate = new Set<string>();
  const daConsegnare: FattoInCoda[] = [];
  const coperti: Copertura['coperti'] = [];

  // I fatti si guardano dal più vecchio: così il primo fatto prende la prima ricevuta, e una
  // raffica di due gesti uguali non si fa coprire due volte dalla stessa riga.
  const inOrdine = [...fatti].sort((a, b) => String(a.visto_at).localeCompare(String(b.visto_at)));

  for (const f of inOrdine) {
    const k = chiaveGesto(f.data, f.ora, f.campo, f.persona, f.gesto);
    const visto = Date.parse(f.visto_at);
    const candidate = perChiave.get(k) ?? [];
    let presa: Ricevuta | null = null;
    if (Number.isFinite(visto)) {
      for (const r of candidate) {
        if (usate.has(r.id)) continue;
        const scritta = Date.parse(r.scritta_at);
        if (!Number.isFinite(scritta)) continue;
        const distanza = visto - scritta;
        if (distanza > finestraMs) continue;        // ricevuta troppo vecchia per questo fatto
        if (distanza < -tolleranzaMs) continue;     // il fatto precede troppo la scrittura
        presa = r;
        break;
      }
    }
    if (presa) {
      usate.add(presa.id);
      coperti.push({ fatto: f, ricevuta: presa });
    } else {
      daConsegnare.push(f);
    }
  }

  return { daConsegnare, coperti };
}
