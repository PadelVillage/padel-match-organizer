// Dopo che il socio è USCITO davvero, la COPIA IN APP va allineata: qui si calcola come.
//
// 🚨⭐⭐ Il fatto strutturale, verificato nel codice il 28/07/2026 dopo la prima uscita vera
// dal bot — e non dedotto: **nessuno aggiorna gli `staff_booking`**.
//   · `matchpoint-bookings-create` li CREA, col roster del momento;
//   · `matchpoint-bookings-edit` (che toglie o aggiunge giocatori) scrive un record
//     `staff_edit`, cioè il REGISTRO dell'operazione, e non li tocca;
//   · `matchpoint-bookings-sync`, ogni ~2 minuti, aggiorna le righe `booking` e mai gli
//     `staff_booking` — è una scelta esplicita del frontend («la sync arricchisce le
//     occupancy, NON gli staff_booking»);
//   · l'unico momento in cui quella copia si riallinea è quando uno STAFF apre la
//     prenotazione nell'app.
// ⇒ Un'uscita fatta dal bot lasciava quella copia ferma a prima. E siccome i ponti dei soci
// SOMMANO le due copie, il socio uscito tornava in campo: la partita gli restava nell'elenco
// e ogni «Esci» rifaceva l'operazione. Misurato sui dati veri di PROD il 28/07: 6 slot futuri
// con entrambe le copie, 5 concordi, 1 discorde — ed era proprio quello dell'uscita. Non era
// un'eredità dell'archivio: **lo creava l'uscita**, e ogni uscita futura ne avrebbe creato uno.
//
// ⭐ Strada scelta dal committente fra tre (28/07), e il perché delle scartate va tenuto:
//   A ✅ dopo un `leave` riuscito il ponte allinea anche la copia in app — circoscritta al
//     percorso del socio, e rende VERO il dato invece di nasconderne le conseguenze;
//   B ⛔ «vince sempre la scheda del circolo»: tocca una regola già provata, e sotto i quattro
//     giocatori la scheda non si consulta *per scelta* (in 4 slot su 88 elenca un «Ospite»
//     che la nostra lettura non vede) ⇒ sposterebbe conteggi dove oggi funzionano;
//   C ⛔ nascondere la partita al socio per qualche minuto: un cerotto, e la copia resterebbe
//     sbagliata anche per lo STAFF che guarda il calendario.
//
// ⚠️ Vale per `leave` e basta. Una `cancel` fa sparire l'intero slot, e lì la copia in app la
// toglie già il reconcile del sync: aggiungerci una scrittura non chiesta significherebbe
// provare due percorsi con una prova sola.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🚨⭐⭐ Perché è un modulo PURO e staccato dall'edge, come `roster-slot.ts`
//
// L'ambiente di TEST **non contiene la forma del dato**: misurato il 28/07, là ci sono 24
// righe `staff_booking` vive e **nessuna futura** (l'ultima è del 25/07), mentre su PROD ce ne
// sono 7 vive e future. Una prova fatta là non toccherebbe mai questo codice, e passerebbe.
// Staccandolo, i payload VERI di PROD si danno in pasto alla funzione in sola lettura, senza
// scrivere niente da nessuna parte — è la stessa ragione per cui esiste `roster-slot.ts`,
// ed è la sola che rende provabile un pezzo che TEST non sa esercitare.
// ══════════════════════════════════════════════════════════════════════════════════════════

import { clean, normName } from './roster-slot.ts';

/** Una riga `staff_booking` dello slot, come sta nell'archivio. */
export type RigaCopiaInApp = {
  /** La chiave primaria di `pmo_cloud_records`: è con questa che si riscrive, non con lo slot. */
  id: string;
  payload: Record<string, unknown>;
};

/**
 * Cosa succede a UNA riga.
 * · `allineata`   → il socio c'era, il payload nuovo è pronto;
 * · `invariata`   → il socio non c'era: non si scrive, e non è un errore;
 * · `non_svuotata`→ toglierlo lascerebbe la riga senza nessun nome ⇒ non si tocca (sotto).
 */
export type EsitoRiga = {
  id: string;
  stato: 'allineata' | 'invariata' | 'non_svuotata';
  /** Presente solo se `allineata`: il payload da scrivere, com'è, senza altre modifiche. */
  payload?: Record<string, unknown>;
  /** I nomi della riga prima e dopo. Servono a leggere la prova a vuoto: senza, un «allineata» non dice COSA. */
  prima: string[];
  dopo: string[];
  /** Dove il socio è stato trovato. Due campi indipendenti: può stare in uno solo dei due. */
  da_giocatori: boolean;
  da_nome: boolean;
};

export type Allineamento = {
  righe: EsitoRiga[];
  /** Le sole righe da riscrivere, già pronte. */
  daScrivere: { id: string; payload: Record<string, unknown> }[];
  conteggi: { righe: number; allineate: number; invariate: number; non_svuotate: number };
};

/** I nomi scritti in `giocatori`, che mescola OGGETTI e STRINGHE nello stesso elenco. */
function nomeDellElemento(g: unknown): string {
  return clean(typeof g === 'object' && g !== null ? (g as Record<string, unknown>).nome : g);
}

/**
 * Toglie UNA occorrenza del socio da `giocatori`.
 *
 * ⭐ Una sola, mai tutte quelle che combaciano: è la stessa regola di `senzaDiMe` in
 * `roster-slot.ts` — chi esce toglie sé stesso, non i suoi omonimi. E gli altri elementi si
 * ricopiano **com'erano**: la riga può mescolare oggetti e stringhe nello stesso elenco
 * (misurato su PROD il 28/07: `["Fabio De Luca", {nome:…}, {nome:…}, {nome:…}]`), e
 * normalizzarli qui vorrebbe dire riscrivere dati che nessuno ci ha chiesto di toccare.
 */
function togliDaGiocatori(giocatori: unknown[], varianti: Set<string>): { nuovo: unknown[]; tolto: boolean } {
  let tolto = false;
  const nuovo: unknown[] = [];
  for (const g of giocatori) {
    if (!tolto && varianti.has(normName(nomeDellElemento(g)))) { tolto = true; continue; }
    nuovo.push(g);
  }
  return { nuovo, tolto };
}

/**
 * Toglie il socio da `nome`, che è la lista dei giocatori unita da virgole.
 *
 * 🚨 `staff_booking.nome` **è TRONCATO** — «Aldo Bianchi, Bruna Conti, Nicola St» — quindi
 * l'ultima voce può essere un nome tagliato a metà parola e un confronto esatto la manca.
 * Perciò, se il confronto esatto fallisce, si guarda **solo l'ultima voce** (è l'unica che il
 * troncamento può aver toccato) e la si toglie se è un PREFISSO proprio del nome del socio.
 * 🚨⭐ Il discriminante che evita il falso positivo: quella voce non deve comparire, intera,
 * fra i `giocatori` della riga. «Mario» accanto a un socio «Mario Bianchi» è un prefisso, ma
 * se «Mario» sta anche in `giocatori` allora è una persona vera e non un troncamento — e
 * toglierla vorrebbe dire cancellare dalla copia qualcuno che gioca davvero.
 *
 * ⭐ Non si RICOSTRUISCE `nome` dai `giocatori`, che pure sarebbe più semplice: `nome` non è
 * per forza un roster (può essere un titolo libero, e la riga di una manutenzione lo è), e
 * riscriverlo lo distruggerebbe. Togliendo per confronto, un titolo che non contiene il socio
 * resta intatto — che è la risposta giusta.
 */
function togliDalNome(
  nome: string,
  varianti: Set<string>,
  nomiInGiocatori: string[],
): { nuovo: string; tolto: boolean } {
  const voci = nome.split(',').map((v) => clean(v)).filter(Boolean);
  if (!voci.length) return { nuovo: nome, tolto: false };

  const esatta = voci.findIndex((v) => varianti.has(normName(v)));
  if (esatta >= 0) {
    voci.splice(esatta, 1);
    return { nuovo: voci.join(', '), tolto: true };
  }

  const ultima = normName(voci[voci.length - 1]);
  const inGiocatori = new Set(nomiInGiocatori.map(normName).filter(Boolean));
  const troncata = !!ultima
    && !inGiocatori.has(ultima)
    && [...varianti].some((v) => v.length > ultima.length && v.startsWith(ultima));
  if (troncata) {
    voci.pop();
    return { nuovo: voci.join(', '), tolto: true };
  }

  return { nuovo: nome, tolto: false };
}

/** Tutti i nomi che la riga porta, in un elenco solo: serve a dire se resterebbe vuota. */
function nomiDellaCopia(payload: Record<string, unknown>): string[] {
  const nomi: string[] = [];
  const gio = payload.giocatori;
  if (Array.isArray(gio)) for (const g of gio) { const n = nomeDellElemento(g); if (n) nomi.push(n); }
  for (const v of String(payload.nome ?? '').split(',')) { const n = clean(v); if (n) nomi.push(n); }
  return nomi;
}

/**
 * Le righe della copia in app dopo che il socio è uscito.
 *
 * 🚨⭐ Si passano **tutte** le righe `staff_booking` dello slot, non una: misurato su PROD il
 * 28/07, uno stesso slot può averne **DUE** — quella creata dall'app (chiave a UUID) e quella
 * che scrive `matchpoint-bookings-create` (chiave `staff_booking|data|ora|Campo N|utente`).
 * Allinearne una sola lascerebbe l'altra a rimettere il socio in campo, cioè il difetto
 * intero, e con una misura che direbbe «fatto».
 *
 * ⭐⭐ **Mai svuotare la copia**: se togliere il socio lasciasse la riga senza nessun nome —
 * né in `giocatori` né in `nome` — la riga non si tocca. Una copia ferma è meno dannosa di una
 * copia vuota, che nel calendario dello staff diventa una card senza nessuno dentro; ed è la
 * stessa regola che l'app applica a sé stessa quando riscrive il roster letto dal gestionale
 * («mai svuotare il roster da una lettura»). 📊 Sui dati veri di PROD del 28/07 il caso non
 * esiste: nessuna delle 7 righe vive e future porta un solo giocatore.
 *
 * 🚨⭐ `varianti` sono le stesse **forme del nome** con cui il ponte riconosce il socio nel
 * roster (`nameVariants`), non un nome solo: il gestionale scrive ora «Nome Cognome» ora
 * «Cognome Nome», e le due copie possono averlo scritto in versi diversi. Passando una forma
 * sola, una copia scritta al contrario risulterebbe «invariata» — cioè il difetto intero, con
 * una misura che dice «fatto».
 */
export function allineaCopiaInApp(righe: RigaCopiaInApp[], varianti: Set<string>): Allineamento {
  const esiti: EsitoRiga[] = [];
  const daScrivere: { id: string; payload: Record<string, unknown> }[] = [];

  for (const riga of righe) {
    const payload = riga.payload ?? {};
    const prima = nomiDellaCopia(payload);
    const nuovo: Record<string, unknown> = { ...payload };

    let daGiocatori = false;
    if (Array.isArray(payload.giocatori)) {
      const r = togliDaGiocatori(payload.giocatori as unknown[], varianti);
      daGiocatori = r.tolto;
      if (r.tolto) nuovo.giocatori = r.nuovo;
    }

    let daNome = false;
    if (clean(payload.nome)) {
      const nomiGio = Array.isArray(payload.giocatori)
        ? (payload.giocatori as unknown[]).map(nomeDellElemento).filter(Boolean)
        : [];
      const r = togliDalNome(String(payload.nome), varianti, nomiGio);
      daNome = r.tolto;
      if (r.tolto) nuovo.nome = r.nuovo;
    }

    if (!daGiocatori && !daNome) {
      esiti.push({ id: riga.id, stato: 'invariata', prima, dopo: prima, da_giocatori: false, da_nome: false });
      continue;
    }

    const dopo = nomiDellaCopia(nuovo);
    if (!dopo.length) {
      esiti.push({ id: riga.id, stato: 'non_svuotata', prima, dopo: prima, da_giocatori: daGiocatori, da_nome: daNome });
      continue;
    }

    esiti.push({ id: riga.id, stato: 'allineata', payload: nuovo, prima, dopo, da_giocatori: daGiocatori, da_nome: daNome });
    daScrivere.push({ id: riga.id, payload: nuovo });
  }

  return {
    righe: esiti,
    daScrivere,
    conteggi: {
      righe: esiti.length,
      allineate: esiti.filter((e) => e.stato === 'allineata').length,
      invariate: esiti.filter((e) => e.stato === 'invariata').length,
      non_svuotate: esiti.filter((e) => e.stato === 'non_svuotata').length,
    },
  };
}
