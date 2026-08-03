// Il cuore di `anagrafica-mirror`, tenuto PURO apposta: niente rete, niente
// database, niente `Deno.serve`. Entrano due elenchi, esce che cosa si farà.
//
// Sta in un file a sé per una ragione precisa, imparata a spese nostre: una
// guardia che vive dentro il giro delle chiamate si può provare solo facendo
// finta di tutto il contorno, e a quel punto il banco prova il contorno e non
// la guardia. Qui invece il banco chiama esattamente ciò che decide.

export type JsonMap = Record<string, unknown>;

export type SocioDaProd = { local_key: string; payload: JsonMap };
export type SchedaLocale = { local_key: string; id: string; deleted: boolean };

export type Piano = {
  aggiornati: string[];
  aggiunti: string[];
  cancellati: string[];
};

/**
 * Che cosa diventa TEST perché somigli a PROD.
 *
 * - c'è su PROD e su TEST      → **aggiornato** (e se su TEST era cancellato, torna in vita)
 * - c'è su PROD e non su TEST  → **aggiunto**
 * - c'è su TEST e non su PROD  → **cancellato**
 *
 * L'aggancio è la `local_key`, che è la chiave con cui il cloud identifica la
 * riga: vale per tutte le schede, comprese quelle agganciate all'email o all'id
 * invece che al telefono — che esistono, e agganciando per telefono sarebbero
 * rimaste fuori dallo specchio.
 */
export function calcolaPiano(
  daProd: SocioDaProd[],
  suTest: SchedaLocale[],
): Piano {
  const chiaviProd = new Set(daProd.map((s) => s.local_key));
  const localiPerChiave = new Map(suTest.map((s) => [s.local_key, s]));

  const aggiornati: string[] = [];
  const aggiunti: string[] = [];
  for (const socio of daProd) {
    if (localiPerChiave.has(socio.local_key)) aggiornati.push(socio.local_key);
    else aggiunti.push(socio.local_key);
  }

  const cancellati: string[] = [];
  for (const locale of suTest) {
    // Già fuori scena: toglierla di nuovo non è una modifica, e contarla
    // gonfierebbe il rapporto di cose che non succedono.
    if (locale.deleted) continue;
    if (!chiaviProd.has(locale.local_key)) cancellati.push(locale.local_key);
  }

  return { aggiornati, aggiunti, cancellati };
}

/**
 * Il payload che finisce su TEST: **tutto da PROD tranne il numero di scheda**.
 *
 * 🚨 È la riga che tiene in piedi gli agganci interni di TEST. Chi esiste già si
 * tiene il SUO numero; chi arriva adesso ne prende uno nuovo, nato su TEST.
 * Il numero di PROD non entra mai — il ponte `anagrafica-export` non lo manda
 * nemmeno, quindi qui non c'è niente da scartare: non è mai arrivato.
 */
export function payloadPerTest(
  daProd: JsonMap,
  idEsistente: string,
  nuovoId: () => string = () => crypto.randomUUID(),
): JsonMap {
  const id = idEsistente || nuovoId();
  return { ...daProd, id };
}

/**
 * La sorgente è credibile abbastanza da poterci cancellare sopra?
 *
 * 🚨 Non è una raffinatezza: questa funzione **cancella** da TEST tutto ciò che
 * non è arrivato da PROD. Se PROD ne manda molti meno del previsto — un export
 * a metà, un errore di rete, un filtro sbagliato — la conseguenza automatica
 * sarebbe svuotare l'anagrafica di TEST, in silenzio e con successo dichiarato.
 * Sotto la quota non si tocca niente.
 */
export function sorgenteAffidabile(
  daProd: number,
  viviSuTest: number,
  quotaMinima: number,
): boolean {
  if (viviSuTest <= 0) return true; // TEST vuota: non c'è niente da perdere
  return daProd / viviSuTest >= quotaMinima;
}
