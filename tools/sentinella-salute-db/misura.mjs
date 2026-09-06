// ─────────────────────────────────────────────────────────────────────────────
// SENTINELLA DELLA SALUTE DEL DATABASE — voce 161. Il PENSIERO, senza il mondo.
//
// Qui dentro non si parla con nessuno: niente rete, niente file, niente orologio
// preso da se'. Si ricevono DUE misure (quella di ieri e quella di adesso) e si
// torna un verdetto. E' il modulo puro, quello che il banco puo' interrogare —
// stessa forma dei moduli `esito-*.ts` delle edge (voci 72, 118).
//
// ⚖️ PERCHE' UN DELTA E NON UN TOTALE, che e' la riga che regge tutta la voce:
//    `pg_stat_user_tables` si AZZERA a ogni riavvio del database. Il 05/09 alle
//    12:08 e' ripartito, e i suoi contatori con lui. Una soglia messa sul TOTALE
//    direbbe «tutto bene» per giorni dopo ogni riavvio — cioe' tacerebbe proprio
//    dopo un'avaria, che e' il momento in cui serve. ⇒ Si guarda quanto e'
//    cresciuto fra due letture, e l'azzeramento si RICONOSCE (un contatore che
//    scende, o l'ora d'avvio che cambia) invece di essere letto come un calo.
//
// 🚨 E OGNI REGOLA DICHIARA SE HA POTUTO GIUDICARE. Le regole di RITMO (WAL al
//    giorno, aggiornamenti su righe) dividono per il tempo passato: su una
//    finestra di due minuti moltiplicano il rumore per 700 e accuserebbero un
//    database sano. ⇒ Sotto la finestra minima quella regola esce `non-giudicata`,
//    che NON e' `a posto`. Le regole di RAPPORTO (HOT, tuple morte) non dividono
//    per il tempo e valgono su qualunque finestra abbastanza popolata.
//    ⚖️ E' la lezione della 24a — la sonda che guarda troppo presto — messa dentro
//       la regola invece che nella testa di chi legge.
//
// 🚨⭐⭐ L'LSN NON E' IL WAL SCRITTO — misurato il 06/09/2026, e la prima stesura
//    lo confondeva. Su Supabase `archive_timeout` e' 120 s: ogni due minuti il
//    database CHIUDE il segmento corrente (16 MB) e ne apre uno nuovo, anche se
//    dentro ci stavano cento kilobyte. La posizione (`pg_current_wal_lsn`) salta
//    quindi di 16 MB ogni 2 minuti — 720 volte al giorno, 11,5 GB — qualunque cosa
//    faccia l'applicazione. Misurato su PROD con due campioni a 2′15″ di distanza:
//    LSN avanzato 16,7 MB, WAL scritto (`pg_stat_wal.wal_bytes`) 93 KB.
//    ⇒ Il ritmo si giudica sul WAL SCRITTO. L'avanzamento dell'LSN si riporta, come
//       numero di segmenti, perche' e' quello che si accumula sul disco quando
//       l'archiviazione si ferma — ed e' esattamente la 160: 62 GB in cinque giorni
//       di `archiving WAL file failed`, non cinque giorni di scritture.
//    ⚖️ Una regola che suona per sempre su un numero letto male e' peggio di una
//       regola in meno: dopo tre giorni nessuno la legge piu', e con lei tace tutto
//       il resto. Per questo gli allarmi sono anche PER REGOLA (`evolviRegole`).
// ─────────────────────────────────────────────────────────────────────────────

export const SOGLIE = {
  // Il difetto della 160 in una cifra: 14 milioni di UPDATE con n_tup_hot_upd a
  // ZERO. Un aggiornamento non-HOT riscrive tutti gli indici della riga e finisce
  // per intero nel WAL; a quel punto il WAL cresce come il traffico, non come i dati.
  // 📏 06/09: su `pmo_cloud_records` lo zero ha una causa strutturale — il trigger
  //    `pmo_touch_updated_at` tocca `updated_at`, che e' indicizzato, a OGNI update.
  //    Resta un difetto vero (ogni scrittura paga sette indici), ma pesa ~130 MB di
  //    WAL al giorno, non gigabyte: non e' lui che ha fatto i 62 GB.
  hotMinimoPct: 20,
  updMinimiPerGiudicareHot: 500,

  // WAL SCRITTO in un giorno (pg_stat_wal.wal_bytes), diviso la dimensione del
  // database. Su PROD, 06/09: ~270 MB/giorno su 688 MB, cioe' 0,4 a 1.
  // ⛔ NON l'avanzamento dell'LSN: quello e' 16,7 a 1 per costruzione (vedi sopra).
  walSuDbAllarme: 6,

  // WAL FERMO SUL DISCO. Questo non e' un ritmo: e' una fotografia, e vale sempre.
  // 8 GB = ~500 segmenti = ~17 ore di archiviazione ferma.
  walSuDiscoAllarmeByte: 8 * 1024 ** 3,

  // Quante volte al giorno una tabella riscrive se stessa. `pmo_cloud_records`:
  // 14 milioni di update su 31 mila righe.
  amplificazioneAllarme: 30,

  // Tuple morte: bloat. Solo su tabelle abbastanza grandi da contare.
  mortePctAllarme: 40,
  viveMinimePerGiudicareMorte: 1000,

  // Sotto questa finestra le regole di RITMO non si pronunciano.
  finestraMinimaMsPerRitmo: 30 * 60 * 1000,

  // Dimensione di un segmento WAL, se la misura non la porta con se'.
  segmentoWalByte: 16 * 1024 ** 2,
};

const GIORNO_MS = 86400000;

/** Byte in una forma leggibile da una persona mezza addormentata. */
export function leggibile(byte) {
  const n = Number(byte) || 0;
  const u = ['B', 'kB', 'MB', 'GB', 'TB'];
  let i = 0, v = Math.abs(n);
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${(n < 0 ? -v : v).toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

const numeroONull = (x) => (x === null || x === undefined || x === '' ? null : Number(x));

/**
 * Il salto fra due misure.
 *
 * 🚨 `azzerata` non e' un guasto e non e' un allarme: e' «questo delta non si puo'
 *    calcolare». Chi lo riceve deve TACERE e aspettare la lettura dopo, non
 *    accusare nessuno — un riavvio del database e' una cosa normale, e leggerlo
 *    come un crollo dei contatori sarebbe la 24a al contrario.
 *
 * Torna due misure del WAL, e sono due cose diverse:
 * · `walAvanzato` — di quanto e' avanzato l'LSN (segmenti chiusi, a tempo o no);
 * · `walScritto`  — quanti byte di record sono stati scritti davvero (`pg_stat_wal`),
 *                   oppure `null` se una delle due letture non lo aveva.
 */
export function deltaFra(prima, adesso) {
  const vuoto = { tabelle: [], walAvanzato: 0, walScritto: null };
  if (!prima || !prima.tabelle) {
    return { stato: 'prima-misura', finestraMs: 0, ...vuoto };
  }
  const finestraMs = new Date(adesso.quando).getTime() - new Date(prima.quando).getTime();
  if (!(finestraMs > 0)) {
    return { stato: 'orologio-storto', finestraMs, ...vuoto };
  }
  if (prima.avvio && adesso.avvio && prima.avvio !== adesso.avvio) {
    return { stato: 'azzerata', perche: 'il database e\' ripartito fra le due letture', finestraMs, ...vuoto };
  }

  const primaPerNome = new Map((prima.tabelle || []).map(t => [t.nome, t]));
  const tabelle = [];
  for (const t of adesso.tabelle || []) {
    const p = primaPerNome.get(t.nome);
    if (!p) continue;                                   // tabella nuova: nessun confronto possibile
    if (t.upd < p.upd || t.ins < p.ins || t.hot < p.hot) {
      return { stato: 'azzerata', perche: `i contatori di ${t.nome} sono scesi`, finestraMs, ...vuoto };
    }
    tabelle.push({
      nome: t.nome,
      upd: t.upd - p.upd, ins: t.ins - p.ins, hot: t.hot - p.hot, del: (t.del || 0) - (p.del || 0),
      vive: t.vive, morte: t.morte,
    });
  }

  const walAvanzato = Number(adesso.lsn_bytes) - Number(prima.lsn_bytes);
  if (walAvanzato < 0) {
    return { stato: 'azzerata', perche: 'la posizione del WAL e\' andata indietro', finestraMs, ...vuoto };
  }

  const scrittoPrima = numeroONull(prima.wal_scritto), scrittoAdesso = numeroONull(adesso.wal_scritto);
  let walScritto = null;
  if (scrittoPrima !== null && scrittoAdesso !== null) {
    walScritto = scrittoAdesso - scrittoPrima;
    if (walScritto < 0) {
      return { stato: 'azzerata', perche: 'il contatore del WAL scritto (pg_stat_wal) e\' sceso', finestraMs, ...vuoto };
    }
  }
  return { stato: 'confrontabile', finestraMs, tabelle, walAvanzato, walScritto };
}

const alGiorno = (quanto, finestraMs) => (quanto * GIORNO_MS) / finestraMs;
const quando = (iso) => (iso ? Date.parse(iso) : NaN);
const oraCorta = (iso) => (iso ? String(iso).replace('T', ' ').slice(0, 19) : '—');

/**
 * Il verdetto. Torna SEMPRE l'elenco delle regole con l'esito di ciascuna —
 * `allarme` · `a-posto` · `non-giudicata` — perche' «non ho potuto guardare» e
 * «ho guardato ed e' a posto» sono due cose diverse e vanno lette diverse.
 */
export function giudica(adesso, delta, soglie = SOGLIE) {
  const regole = [];
  const salta = (codice, perche) => regole.push({ codice, esito: 'non-giudicata', perche });
  const ok = (codice, dettaglio) => regole.push({ codice, esito: 'a-posto', dettaglio });
  const suona = (codice, titolo, dettaglio) => regole.push({ codice, esito: 'allarme', titolo, dettaglio });

  // ① WAL fermo sul disco — fotografia, nessuna finestra richiesta.
  if (Number(adesso.wal_su_disco) >= soglie.walSuDiscoAllarmeByte) {
    suona('wal-su-disco', 'Il WAL sul disco e\' fuori misura',
      `${leggibile(adesso.wal_su_disco)} in ${adesso.wal_file} file, contro un database di ${leggibile(adesso.db_bytes)}.`);
  } else {
    ok('wal-su-disco', `${leggibile(adesso.wal_su_disco)} (${adesso.wal_file} file)`);
  }

  if (delta.stato !== 'confrontabile') {
    // Niente confronto: TUTTE le regole che vogliono un delta restano non giudicate.
    for (const c of ['hot', 'wal-al-giorno', 'amplificazione']) salta(c, delta.perche || delta.stato);
  } else {
    const larga = delta.finestraMs >= soglie.finestraMinimaMsPerRitmo;

    // ② Il rapporto HOT — NON e' un ritmo: vale su qualunque finestra popolata.
    const candidate = delta.tabelle.filter(t => t.upd >= soglie.updMinimiPerGiudicareHot);
    if (!candidate.length) {
      salta('hot', `nessuna tabella ha superato ${soglie.updMinimiPerGiudicareHot} aggiornamenti nella finestra`);
    } else {
      const malate = candidate
        .map(t => ({ ...t, pct: Math.round((t.hot * 1000) / t.upd) / 10 }))
        .filter(t => t.pct < soglie.hotMinimoPct)
        .sort((a, b) => b.upd - a.upd);
      if (malate.length) {
        suona('hot', 'Aggiornamenti che riscrivono gli indici (poco HOT)',
          malate.map(t => `<code>${t.nome}</code>: ${t.upd} aggiornamenti, HOT ${t.pct}%`).join('\n'));
      } else {
        ok('hot', candidate.map(t => `${t.nome} ${Math.round((t.hot * 100) / t.upd)}%`).join(' · '));
      }
    }

    // ③ WAL SCRITTO al giorno, sulla dimensione del database — e' un ritmo.
    //    L'avanzamento dell'LSN si riporta accanto, in segmenti: e' cio' che finisce
    //    sul disco, non cio' che l'applicazione ha scritto.
    const segmento = Number(adesso.wal_segmento) > 0 ? Number(adesso.wal_segmento) : soglie.segmentoWalByte;
    const avanzatoAlDi = alGiorno(delta.walAvanzato, delta.finestraMs);
    const segmentiAlDi = Math.round(avanzatoAlDi / segmento);
    const avanzamento = `l'LSN avanza di ${leggibile(avanzatoAlDi)}/giorno (${segmentiAlDi} segmenti da ${leggibile(segmento)}: chiusi a tempo, non riempiti)`;
    if (!larga) {
      salta('wal-al-giorno', `finestra di ${Math.round(delta.finestraMs / 60000)} minuti: troppo corta per un ritmo`);
    } else if (delta.walScritto === null) {
      salta('wal-al-giorno', `una delle due letture non aveva il WAL scritto (pg_stat_wal) — ${avanzamento}`);
    } else {
      const scrittoAlDi = alGiorno(delta.walScritto, delta.finestraMs);
      const rapporto = Number(adesso.db_bytes) > 0 ? scrittoAlDi / Number(adesso.db_bytes) : 0;
      if (rapporto >= soglie.walSuDbAllarme) {
        suona('wal-al-giorno', 'Il database riscrive il proprio peso in WAL molte volte al giorno',
          `${leggibile(scrittoAlDi)} di WAL scritto al giorno su un database di ${leggibile(adesso.db_bytes)} — <b>${rapporto.toFixed(1)} a 1</b>. (${avanzamento})`);
      } else {
        ok('wal-al-giorno', `${leggibile(scrittoAlDi)}/giorno scritti (${rapporto.toFixed(1)} a 1) · ${avanzamento}`);
      }
    }

    // ④ Quante volte al giorno una tabella riscrive se stessa — e' un ritmo.
    if (!larga) {
      salta('amplificazione', `finestra di ${Math.round(delta.finestraMs / 60000)} minuti: troppo corta per un ritmo`);
    } else {
      const gonfie = delta.tabelle
        .filter(t => t.vive > 0 && t.upd > 0)
        .map(t => ({ ...t, volte: alGiorno(t.upd, delta.finestraMs) / t.vive }))
        .filter(t => t.volte >= soglie.amplificazioneAllarme)
        .sort((a, b) => b.volte - a.volte);
      if (gonfie.length) {
        suona('amplificazione', 'Una tabella si riscrive troppe volte al giorno',
          gonfie.map(t => `<code>${t.nome}</code>: ${Math.round(t.volte)}× le sue ${t.vive} righe`).join('\n'));
      } else {
        ok('amplificazione', 'nessuna tabella oltre soglia');
      }
    }
  }

  // ⑤ Tuple morte — fotografia, indipendente dal delta.
  // 🚨 «nessuna tabella abbastanza grande da giudicare» NON e' «nessuna tabella
  //    gonfia»: se la misura torna vuota — e una misura puo' tornare vuota — la
  //    riga `a-posto` sarebbe una rassicurazione presa dal nulla. E' lo zero letto
  //    troppo presto del 23/08, in miniatura.
  const grandi = (adesso.tabelle || [])
    .filter(t => t.vive >= soglie.viveMinimePerGiudicareMorte && (t.vive + t.morte) > 0);
  if (!grandi.length) {
    salta('tuple-morte', `nessuna tabella arriva a ${soglie.viveMinimePerGiudicareMorte} righe vive`);
  } else {
    const morte = grandi
      .map(t => ({ ...t, pct: Math.round((t.morte * 1000) / (t.vive + t.morte)) / 10 }))
      .filter(t => t.pct >= soglie.mortePctAllarme)
      .sort((a, b) => b.pct - a.pct);
    if (morte.length) {
      suona('tuple-morte', 'Tabelle gonfie di righe morte',
        morte.map(t => `<code>${t.nome}</code>: ${t.pct}% morte (${t.morte} su ${t.vive + t.morte})`).join('\n'));
    } else {
      ok('tuple-morte', `${grandi.length} tabelle guardate, nessuna oltre soglia`);
    }
  }

  // ⑥ L'ARCHIVIAZIONE del WAL — fotografia di `pg_stat_archiver`. E' il guasto della
  //    160 per nome: `archiving WAL file failed too many times`. Se l'ultimo tentativo
  //    fallito e' piu' recente dell'ultimo riuscito, in questo momento i segmenti
  //    restano sul disco — 720 al giorno, 11 GB — finche' qualcuno non se ne accorge.
  //    🚨 Non aspetta la soglia degli 8 GB della regola ①: quella arriva 17 ore dopo.
  const a = adesso.archivio;
  if (!a || typeof a !== 'object') {
    salta('archiviazione', 'la misura non porta pg_stat_archiver');
  } else if (!a.ultimo_ok && !a.ultimo_fallito) {
    salta('archiviazione', 'nessun segmento ancora archiviato ne\' fallito dal riavvio');
  } else if (a.ultimo_fallito && (!a.ultimo_ok || quando(a.ultimo_fallito) > quando(a.ultimo_ok))) {
    suona('archiviazione', 'L\'archiviazione del WAL sta fallendo',
      `ultimo tentativo fallito alle ${oraCorta(a.ultimo_fallito)} UTC, ultimo segmento archiviato ${a.ultimo_ok ? 'alle ' + oraCorta(a.ultimo_ok) + ' UTC' : 'mai dal riavvio'} ` +
      `(${Number(a.falliti) || 0} fallimenti). Finche' dura, ogni segmento chiuso resta sul disco: e' il guasto del 05/09.`);
  } else {
    ok('archiviazione', `${Number(a.archiviati) || 0} segmenti archiviati dal riavvio, ultimo alle ${oraCorta(a.ultimo_ok)} UTC` +
      (Number(a.falliti) > 0 ? ` (${a.falliti} fallimenti, poi ripresa)` : ''));
  }

  const allarmi = regole.filter(r => r.esito === 'allarme');
  const giudicate = regole.filter(r => r.esito !== 'non-giudicata');
  // 🚨 Se NESSUNA regola ha potuto pronunciarsi il verdetto non e' `serena`: e'
  //    `non-giudicabile`. Una sentinella che non ha guardato e una che ha guardato
  //    e non ha visto niente fanno lo stesso silenzio — ed e' la malattia che
  //    questa voce esiste per curare, applicata a lei stessa.
  const verdetto = allarmi.length ? 'allarme' : (giudicate.length ? 'serena' : 'non-giudicabile');
  return { verdetto, regole, allarmi };
}

/**
 * Le regole di IERI nella forma che `evolviRegole` sa leggere.
 *
 * Le righe scritte prima del 06/09 non hanno `di_fila` e `attivo` per regola: avevano
 * un solo `consecutivi` e un solo `allarme_attivo` per tutto il giro. Si traducono
 * cosi': ogni regola che IERI era in allarme eredita quel conteggio e quello stato.
 * ⇒ Un allarme gia' mandato non viene rimandato, e uno gia' attivo non viene perso.
 */
export function regoleDiIeri(prima) {
  if (!prima || !Array.isArray(prima.regole)) return [];
  return prima.regole.map(r => {
    if (r.di_fila !== undefined && r.di_fila !== null) return r;
    const inAllarme = r.esito === 'allarme';
    return {
      ...r,
      di_fila: inAllarme ? Number(prima.consecutivi || 0) : 0,
      attivo: inAllarme && !!prima.allarme_attivo,
    };
  });
}

/**
 * Gli allarmi PER REGOLA: chi e' fuori riga da quanti giri, e chi e' gia' stato detto.
 *
 * 🚨⭐ PERCHE' PER REGOLA E NON PER GIRO — il buco della prima stesura, visto il 06/09:
 *    un solo `allarme_attivo` per tutto il giro. Con l'HOT fermo in allarme (e su
 *    `pmo_cloud_records` lo e' per costruzione, finche' il trigger tocca `updated_at`)
 *    lo stato restava «attivo» per sempre ⇒ un guasto NUOVO — l'archiviazione che si
 *    ferma, cioe' la 160 — non avrebbe mandato NESSUN messaggio. La guardia sarebbe
 *    stata verde nel registro e muta sul telefono.
 *
 * Regole:
 * · `allarme`       → `di_fila` + 1; se arriva a `giriPrimaDiSuonare` e non era gia'
 *                     `attivo`, e' un allarme NUOVO (da mandare);
 * · `a-posto`       → `di_fila` torna a 0; se era `attivo`, e' un RIENTRO (da mandare);
 * · `non-giudicata` → non avanza, non azzera, non spegne: non ho guardato, non cambio idea.
 */
export function evolviRegole(regolePrima, regole, giriPrimaDiSuonare = 2) {
  const ieri = new Map((regolePrima || []).map(r => [r.codice, r]));
  const nuovi = [], rientri = [];
  const evolute = (regole || []).map(r => {
    const p = ieri.get(r.codice) || {};
    let diFila = Number(p.di_fila || 0);
    let attivo = !!p.attivo;
    if (r.esito === 'allarme') {
      diFila += 1;
      if (!attivo && diFila >= giriPrimaDiSuonare) { attivo = true; nuovi.push(r); }
    } else if (r.esito === 'a-posto') {
      diFila = 0;
      if (attivo) { attivo = false; rientri.push(r); }
    }
    return { ...r, di_fila: diFila, attivo };
  });
  const attivi = evolute.filter(r => r.attivo);
  return {
    regole: evolute,
    nuovi,
    rientri,
    attivi,
    allarmeAttivo: attivi.length > 0,
    consecutivi: Math.max(0, ...evolute.filter(r => r.esito === 'allarme').map(r => r.di_fila)),
  };
}
