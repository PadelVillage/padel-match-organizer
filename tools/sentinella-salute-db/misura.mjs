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
// ─────────────────────────────────────────────────────────────────────────────

export const SOGLIE = {
  // Il difetto della 160 in una cifra: 14 milioni di UPDATE con n_tup_hot_upd a
  // ZERO. Un aggiornamento non-HOT riscrive tutti gli indici della riga e finisce
  // per intero nel WAL; a quel punto il WAL cresce come il traffico, non come i dati.
  hotMinimoPct: 20,
  updMinimiPerGiudicareHot: 500,

  // WAL PRODOTTO in un giorno, diviso la dimensione del database. Il 05/09 il
  // rapporto misurato sull'accumulo era 90 a 1 (62 GB su 685 MB).
  walSuDbAllarme: 6,

  // WAL FERMO SUL DISCO. Questo non e' un ritmo: e' una fotografia, e vale sempre.
  walSuDiscoAllarmeByte: 8 * 1024 ** 3,

  // Quante volte al giorno una tabella riscrive se stessa. `pmo_cloud_records`:
  // 14 milioni di update su 31 mila righe.
  amplificazioneAllarme: 30,

  // Tuple morte: bloat. Solo su tabelle abbastanza grandi da contare.
  mortePctAllarme: 40,
  viveMinimePerGiudicareMorte: 1000,

  // Sotto questa finestra le regole di RITMO non si pronunciano.
  finestraMinimaMsPerRitmo: 30 * 60 * 1000,
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

/**
 * Il salto fra due misure.
 *
 * 🚨 `azzerata` non e' un guasto e non e' un allarme: e' «questo delta non si puo'
 *    calcolare». Chi lo riceve deve TACERE e aspettare la lettura dopo, non
 *    accusare nessuno — un riavvio del database e' una cosa normale, e leggerlo
 *    come un crollo dei contatori sarebbe la 24a al contrario.
 */
export function deltaFra(prima, adesso) {
  if (!prima || !prima.tabelle) {
    return { stato: 'prima-misura', finestraMs: 0, tabelle: [], walProdotto: 0 };
  }
  const finestraMs = new Date(adesso.quando).getTime() - new Date(prima.quando).getTime();
  if (!(finestraMs > 0)) {
    return { stato: 'orologio-storto', finestraMs, tabelle: [], walProdotto: 0 };
  }
  if (prima.avvio && adesso.avvio && prima.avvio !== adesso.avvio) {
    return { stato: 'azzerata', perche: 'il database e\' ripartito fra le due letture', finestraMs, tabelle: [], walProdotto: 0 };
  }

  const primaPerNome = new Map((prima.tabelle || []).map(t => [t.nome, t]));
  const tabelle = [];
  for (const t of adesso.tabelle || []) {
    const p = primaPerNome.get(t.nome);
    if (!p) continue;                                   // tabella nuova: nessun confronto possibile
    if (t.upd < p.upd || t.ins < p.ins || t.hot < p.hot) {
      return { stato: 'azzerata', perche: `i contatori di ${t.nome} sono scesi`, finestraMs, tabelle: [], walProdotto: 0 };
    }
    tabelle.push({
      nome: t.nome,
      upd: t.upd - p.upd, ins: t.ins - p.ins, hot: t.hot - p.hot, del: (t.del || 0) - (p.del || 0),
      vive: t.vive, morte: t.morte,
    });
  }

  const walProdotto = Number(adesso.lsn_bytes) - Number(prima.lsn_bytes);
  if (walProdotto < 0) {
    return { stato: 'azzerata', perche: 'la posizione del WAL e\' andata indietro', finestraMs, tabelle: [], walProdotto: 0 };
  }
  return { stato: 'confrontabile', finestraMs, tabelle, walProdotto };
}

const alGiorno = (quanto, finestraMs) => (quanto * GIORNO_MS) / finestraMs;

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

    // ③ WAL prodotto al giorno, sulla dimensione del database — e' un ritmo.
    if (!larga) {
      salta('wal-al-giorno', `finestra di ${Math.round(delta.finestraMs / 60000)} minuti: troppo corta per un ritmo`);
    } else {
      const alDi = alGiorno(delta.walProdotto, delta.finestraMs);
      const rapporto = Number(adesso.db_bytes) > 0 ? alDi / Number(adesso.db_bytes) : 0;
      if (rapporto >= soglie.walSuDbAllarme) {
        suona('wal-al-giorno', 'Il database riscrive il proprio peso in WAL molte volte al giorno',
          `${leggibile(alDi)} di WAL al giorno su un database di ${leggibile(adesso.db_bytes)} — <b>${rapporto.toFixed(1)} a 1</b>.`);
      } else {
        ok('wal-al-giorno', `${leggibile(alDi)}/giorno (${rapporto.toFixed(1)} a 1)`);
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

  const allarmi = regole.filter(r => r.esito === 'allarme');
  const giudicate = regole.filter(r => r.esito !== 'non-giudicata');
  // 🚨 Se NESSUNA regola ha potuto pronunciarsi il verdetto non e' `serena`: e'
  //    `non-giudicabile`. Una sentinella che non ha guardato e una che ha guardato
  //    e non ha visto niente fanno lo stesso silenzio — ed e' la malattia che
  //    questa voce esiste per curare, applicata a lei stessa.
  const verdetto = allarmi.length ? 'allarme' : (giudicate.length ? 'serena' : 'non-giudicabile');
  return { verdetto, regole, allarmi };
}
