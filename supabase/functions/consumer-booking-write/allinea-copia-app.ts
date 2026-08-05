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
/**
 * I due campi che portano i nomi, tenuti SEPARATI anche quando si raccontano.
 *
 * 🚨⭐ Concatenarli sarebbe un misuratore che nasconde ciò che si sta cercando: una riga a
 * quattro giocatori uscirebbe come otto nomi, e chi legge la prova a vuoto conterebbe il
 * doppio. È lo stesso inciampo della sonda del 26/07 che univa i nomi con la virgola e
 * nascondeva che una voce ne conteneva quattro.
 */
export type NomiDellaRiga = { giocatori: string[]; nome: string };

export type EsitoRiga = {
  id: string;
  stato: 'allineata' | 'invariata' | 'non_svuotata';
  /** Presente solo se `allineata`: il payload da scrivere, com'è, senza altre modifiche. */
  payload?: Record<string, unknown>;
  /** La riga prima e dopo. Senza, un «allineata» non dice COSA è cambiato. */
  prima: NomiDellaRiga;
  dopo: NomiDellaRiga;
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

/** I nomi che la riga porta, nei DUE campi tenuti separati. */
function nomiDellaCopia(payload: Record<string, unknown>): NomiDellaRiga {
  const gio = payload.giocatori;
  return {
    giocatori: Array.isArray(gio) ? gio.map(nomeDellElemento).filter(Boolean) : [],
    nome: clean(payload.nome),
  };
}

/** Vero se la riga non porta più nessun nome, in nessuno dei due campi. */
function senzaNessuno(n: NomiDellaRiga): boolean {
  return !n.giocatori.length && !n.nome;
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
    if (senzaNessuno(dopo)) {
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

// ══════════════════════════════════════════════════════════════════════════════════════════
// L'ALTRO VERSO: qualcuno ENTRA — 5/08/2026, con l'invito alla partita.
// ══════════════════════════════════════════════════════════════════════════════════════════
//
// 🚨⭐⭐ NON È SIMMETRIA PER ELEGANZA: senza questo, si entra in CINQUE. La copia in app è ciò
// che questo ponte CONTA per sapere quanti sono in campo, e la copia che viene dal circolo si
// aggiorna ogni ~2 minuti. In quella finestra un secondo invitato che tocca «Ci sto» vedrebbe
// ancora tre giocatori e un posto libero, e il campo finirebbe a cinque — con tutte le
// misure verdi, perché ognuna delle due letture, presa da sola, era giusta.
// ⇒ Scrivere subito il nome nella copia CHIUDE la finestra.
//
// ⚖️ Si tocca SOLO `giocatori`, mai `nome`, e la differenza col verso dell'uscita è voluta:
//  · `giocatori` è un elenco, e a un elenco si aggiunge in coda senza ambiguità;
//  · `nome` **è troncato a metà parola** dal gestionale e a volte non è nemmeno un roster (su
//    una manutenzione è un titolo libero). Appenderci un nome vorrebbe dire allungare una
//    stringa già tagliata, e su una riga che non elenca nessuno inventare un elenco.
// 🚨 Conseguenza dichiarata, non nascosta: una riga che porta i nomi SOLO in `nome` resta
// `invariata`, e per quella la finestra dei due minuti resta aperta. Chi chiama lo registra.
//
// ⭐ In coda e non in testa: l'ordine delle righe della scheda è la CRONOLOGIA DEGLI INGRESSI,
// ed è da lì che si legge chi ha organizzato (il primo). Infilare il nuovo in cima lo farebbe
// diventare l'organizzatore della partita di qualcun altro.

export type EsitoRigaAggiunta = {
  id: string;
  /** `aggiunta` → il payload nuovo è pronto · `invariata` → nessun elenco da toccare ·
   *  `c_era_gia` → il nome era già lì: non si scrive, e non è un errore. */
  stato: 'aggiunta' | 'invariata' | 'c_era_gia';
  payload?: Record<string, unknown>;
  prima: NomiDellaRiga;
  dopo: NomiDellaRiga;
};

export type Aggiunta = {
  righe: EsitoRigaAggiunta[];
  daScrivere: { id: string; payload: Record<string, unknown> }[];
  conteggi: { righe: number; aggiunte: number; invariate: number; c_era_gia: number };
};

/**
 * Scrive il nome di chi entra nelle copie in app dello slot.
 *
 * ⚠️ `nome` è il nome COME LO SCRIVE IL GESTIONALE — quello tornato dal worker dopo
 * l'aggiunta, non quello che abbiamo mandato: le due scritture possono differire, e una copia
 * che scrive il nome in un modo diverso dalla scheda fa contare due persone dove ce n'è una.
 * ⭐ Si appende una STRINGA, non un oggetto: l'elenco ne mescola già di tutt'e due i tipi
 * (misurato su PROD il 28/07) e `nomeDellElemento` legge entrambi — la stringa è la forma che
 * non pretende di sapere quali altri campi un oggetto dovrebbe avere.
 */
export function aggiungiACopiaInApp(righe: RigaCopiaInApp[], nome: string): Aggiunta {
  const esiti: EsitoRigaAggiunta[] = [];
  const daScrivere: { id: string; payload: Record<string, unknown> }[] = [];
  const pulito = clean(nome);

  for (const riga of righe) {
    const payload = riga.payload ?? {};
    const prima = nomiDellaCopia(payload);

    if (!pulito || !Array.isArray(payload.giocatori)) {
      esiti.push({ id: riga.id, stato: 'invariata', prima, dopo: prima });
      continue;
    }
    // 🚨 C'è già? Non si aggiunge una seconda volta. Succede sul serio: un secondo tocco
    // dello stesso invitato, o un giro ripetuto dopo un guasto di rete a metà strada — e
    // due volte lo stesso nome nell'elenco vuol dire un posto libero in meno per nessuno.
    const gia = (payload.giocatori as unknown[]).some((g) => normName(nomeDellElemento(g)) === normName(pulito));
    if (gia) {
      esiti.push({ id: riga.id, stato: 'c_era_gia', prima, dopo: prima });
      continue;
    }

    const nuovo: Record<string, unknown> = { ...payload, giocatori: [...(payload.giocatori as unknown[]), pulito] };
    const dopo = nomiDellaCopia(nuovo);
    esiti.push({ id: riga.id, stato: 'aggiunta', payload: nuovo, prima, dopo });
    daScrivere.push({ id: riga.id, payload: nuovo });
  }

  return {
    righe: esiti,
    daScrivere,
    conteggi: {
      righe: esiti.length,
      aggiunte: esiti.filter((e) => e.stato === 'aggiunta').length,
      invariate: esiti.filter((e) => e.stato === 'invariata').length,
      c_era_gia: esiti.filter((e) => e.stato === 'c_era_gia').length,
    },
  };
}
