#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// BANCO DELLA SENTINELLA DELLA SALUTE — voce 161
//
// ⭐ Le corse che contano sono quelle che DISCRIMINANO: due misure che
//    differiscono per UNA cosa e danno esiti opposti. Una prova che conferma
//    quello che gia' si crede non prova niente — e' la lezione della 89ª, dove
//    la cura della 72 e' stata dimostrata da due corse a una riga di distanza.
//
// ⛔ E cio' che questo banco NON dice, dichiarato qui e non in fondo: non dice che
//    la query giri su Postgres, non dice che il token di Supabase sia buono, non
//    dice che Telegram consegni. Dice che il PENSIERO e' giusto. Il resto e' la
//    corsa vera del workflow.
//
//    node banco-salute.mjs
// ─────────────────────────────────────────────────────────────────────────────

import { deltaFra, giudica, leggibile, regoleDiIeri, evolviRegole, SOGLIE } from './misura.mjs';

let fatte = 0, rotte = 0;
const t = (nome, fn) => {
  fatte++;
  try { fn(); console.log(`  🟢 ${nome}`); }
  catch (e) { rotte++; console.log(`  🔴 ${nome}\n       ${e.message}`); }
};
const uguale = (a, b, che) => { if (a !== b) throw new Error(`${che}: ho ${JSON.stringify(a)}, mi aspettavo ${JSON.stringify(b)}`); };
const esitoDi = (g, codice) => (g.regole.find(r => r.codice === codice) || {}).esito || '(regola assente)';
const regolaDi = (g, codice) => g.regole.find(r => r.codice === codice) || {};

const ORA = Date.parse('2026-09-06T02:00:00Z');
const quando = (msFa) => new Date(ORA - msFa).toISOString();
const ORE = 3600000;
const GB = 1024 ** 3, MB = 1024 ** 2;

// Una misura sana, con una tabella grande che aggiorna in modo HOT.
// 📏 I numeri del WAL sono quelli VERI di PROD del 06/09: l'LSN avanza di 16 MB ogni
//    2 minuti (archive_timeout), il WAL scritto e' ~270 MB al giorno.
const sana = (opz = {}) => ({
  quando: opz.quando || new Date(ORA).toISOString(),
  db_bytes: 700 * MB,
  wal_su_disco: 560 * MB,
  wal_file: 36,
  lsn_bytes: opz.lsn ?? 1_000_000_000_000,
  wal_scritto: opz.scritto === undefined ? 200 * MB : opz.scritto,
  wal_segmento: 16 * MB,
  archivio: opz.archivio === undefined
    ? { archiviati: 637, falliti: 0, ultimo_ok: '2026-09-06T01:58:37+00:00', ultimo_fallito: null }
    : opz.archivio,
  avvio: opz.avvio || '2026-09-01T00:00:00+00:00',
  tabelle: opz.tabelle || [
    { nome: 'pmo_cloud_records', ins: 100, upd: 20000, hot: 19000, del: 10, vive: 24000, morte: 300 },
    { nome: 'member', ins: 10, upd: 50, hot: 48, del: 0, vive: 2800, morte: 20 },
  ],
});
// Un giorno di PROD com'e' davvero: 720 segmenti chiusi a tempo, 270 MB scritti.
const unGiornoVero = (scrittoMB = 270) => sana({ lsn: 1_000_000_000_000 + 720 * 16 * MB, scritto: 200 * MB + scrittoMB * MB });

console.log('\n── ① l\'azzeramento si RICONOSCE, non si legge come un calo ──');

t('il database e\' ripartito ⇒ azzerata, e nessuna regola di delta si pronuncia', () => {
  const prima = sana({ quando: quando(24 * ORE), avvio: '2026-09-01T00:00:00+00:00' });
  const dopo = sana({ avvio: '2026-09-05T12:08:27+00:00' });
  const d = deltaFra(prima, dopo);
  uguale(d.stato, 'azzerata', 'stato');
  const g = giudica(dopo, d);
  uguale(esitoDi(g, 'hot'), 'non-giudicata', 'hot');
  uguale(esitoDi(g, 'wal-al-giorno'), 'non-giudicata', 'wal-al-giorno');
  uguale(g.verdetto, 'serena', 'verdetto');   // le fotografie sono a posto: non si accusa nessuno
});

t('un contatore che SCENDE ⇒ azzerata (e non un delta negativo silenzioso)', () => {
  const prima = sana({ quando: quando(24 * ORE) });
  const dopo = sana({ tabelle: [{ nome: 'pmo_cloud_records', ins: 5, upd: 30, hot: 28, del: 0, vive: 24000, morte: 300 }] });
  uguale(deltaFra(prima, dopo).stato, 'azzerata', 'stato');
});

t('il WAL che va indietro ⇒ azzerata', () => {
  const prima = sana({ quando: quando(24 * ORE), lsn: 2_000_000_000_000 });
  uguale(deltaFra(prima, sana()).stato, 'azzerata', 'stato');
});

t('il contatore del WAL SCRITTO che scende ⇒ azzerata (si azzera col riavvio come gli altri)', () => {
  const prima = sana({ quando: quando(24 * ORE), scritto: 900 * MB });
  uguale(deltaFra(prima, sana({ scritto: 100 * MB })).stato, 'azzerata', 'stato');
});

t('la primissima lettura non e\' un allarme: e\' una primissima lettura', () => {
  const d = deltaFra(null, sana());
  uguale(d.stato, 'prima-misura', 'stato');
  uguale(giudica(sana(), d).verdetto, 'serena', 'verdetto');
});

console.log('\n── ② LA CORSA CHE DISCRIMINA: stessi numeri, finestra diversa ──');
// 🚨 E' il cuore della voce: un ritmo calcolato su due minuti moltiplica il rumore
//    per settecento. Le due corse qui sotto hanno gli STESSI numeri e cambiano solo
//    quanto tempo e' passato — e devono dare esiti opposti.
const tanteScritture = [{ nome: 'pmo_cloud_records', ins: 100, upd: 20000 + 42000, hot: 19000 + 41000, del: 10, vive: 24000, morte: 300 }];
{
  const primaLunga = sana({ quando: quando(24 * ORE) });
  const primaCorta = sana({ quando: quando(2 * 60000) });
  const dopo = sana({ tabelle: tanteScritture, lsn: 1_000_000_000_000 + 30 * GB, scritto: 200 * MB + 30 * GB });

  t('finestra CORTA (2 minuti) ⇒ i ritmi restano NON GIUDICATI, non «a posto»', () => {
    const g = giudica(dopo, deltaFra(primaCorta, dopo));
    uguale(esitoDi(g, 'wal-al-giorno'), 'non-giudicata', 'wal-al-giorno');
    uguale(esitoDi(g, 'amplificazione'), 'non-giudicata', 'amplificazione');
    uguale(g.verdetto, 'serena', 'verdetto');
  });
  t('finestra LUNGA (24 ore), stessi identici numeri ⇒ ALLARME sul WAL', () => {
    const g = giudica(dopo, deltaFra(primaLunga, dopo));
    uguale(esitoDi(g, 'wal-al-giorno'), 'allarme', 'wal-al-giorno');
    uguale(g.verdetto, 'allarme', 'verdetto');
  });
  t('e sulla finestra corta l\'HOT invece SI pronuncia: e\' un rapporto, non un ritmo', () => {
    uguale(esitoDi(giudica(dopo, deltaFra(primaCorta, dopo)), 'hot'), 'a-posto', 'hot');
  });
}

console.log('\n── ③ LA SECONDA CORSA CHE DISCRIMINA: l\'LSN che avanza NON e\' WAL scritto (06/09) ──');
// 🚨⭐ La prima stesura giudicava il ritmo sull'LSN, e su PROD suonava 16,7 a 1 PER
//    COSTRUZIONE: archive_timeout chiude un segmento da 16 MB ogni 2 minuti, pieno o
//    vuoto. Le due corse qui sotto hanno lo STESSO avanzamento dell'LSN (11,5 GB al
//    giorno) e cambiano solo quanto e' stato scritto davvero.
{
  const prima = sana({ quando: quando(24 * ORE) });
  t('720 segmenti al giorno (11,5 GB di LSN) con 270 MB scritti ⇒ wal-al-giorno A POSTO', () => {
    const g = giudica(unGiornoVero(270), deltaFra(prima, unGiornoVero(270)));
    uguale(esitoDi(g, 'wal-al-giorno'), 'a-posto', 'wal-al-giorno');
    if (!/720 segmenti/.test(regolaDi(g, 'wal-al-giorno').dettaglio)) throw new Error('il dettaglio deve dire quanti segmenti: ' + regolaDi(g, 'wal-al-giorno').dettaglio);
    uguale(g.verdetto, 'serena', 'verdetto');
  });
  t('stesso LSN, ma 6,5 GB SCRITTI ⇒ allarme (il rapporto e\' sui byte scritti)', () => {
    const dopo = unGiornoVero(6.5 * 1024);
    uguale(esitoDi(giudica(dopo, deltaFra(prima, dopo)), 'wal-al-giorno'), 'allarme', 'wal-al-giorno');
  });
  t('la lettura di ieri NON aveva il WAL scritto (riga vecchia) ⇒ non-giudicata, non un allarme sull\'LSN', () => {
    const vecchia = sana({ quando: quando(24 * ORE), scritto: null });
    const g = giudica(unGiornoVero(270), deltaFra(vecchia, unGiornoVero(270)));
    uguale(esitoDi(g, 'wal-al-giorno'), 'non-giudicata', 'wal-al-giorno');
    uguale(deltaFra(vecchia, unGiornoVero(270)).walScritto, null, 'walScritto');
  });
}

console.log('\n── ④ il difetto della 160, con i suoi numeri veri ──');
// 🚨⭐ QUESTA CORSA HA CORRETTO UNA SOGLIA, ed e' il motivo per cui il banco si
//    scrive coi numeri VERI invece che con numeri comodi. La prima stesura si
//    aspettava che a prendere la 160 fosse ANCHE la regola dell'amplificazione:
//    non e' cosi'. 400 mila aggiornamenti al giorno su 31 mila righe sono
//    ~13 volte, cioe' SOTTO la soglia di 30 — e la 160 stava li' da settimane
//    proprio a quel ritmo. ⇒ A prendere quel difetto e' l'HOT, da sola.
//    ⚖️ Tenere la soglia dell'amplificazione a 30 e' la scelta giusta lo stesso
//       (serve a un giro impazzito, non a questo difetto), ma andava SAPUTO quale
//       regola difende da cosa: una guardia di cui si crede il falso e' peggio di
//       una guardia in meno, perche' ci si conta sopra.
// 📏 E il 06/09 si e' saputo il resto: i 62 GB non li ha fatti l'HOT ma
//    l'ARCHIVIAZIONE ferma (regola ⑤ qui sotto). L'HOT resta un difetto vero e
//    una regola giusta; non e' piu' «quella che prende la 160» da sola.
t('14 milioni di UPDATE con HOT a zero ⇒ allarme sull\'HOT — e SOLO sull\'HOT', () => {
  const prima = sana({ quando: quando(24 * ORE) });
  const dopo = sana({ tabelle: [{ nome: 'pmo_cloud_records', ins: 100, upd: 20000 + 400000, hot: 19000, del: 10, vive: 31000, morte: 2000 }] });
  const g = giudica(dopo, deltaFra(prima, dopo));
  uguale(esitoDi(g, 'hot'), 'allarme', 'hot');
  uguale(esitoDi(g, 'amplificazione'), 'a-posto', 'amplificazione');
  uguale(g.verdetto, 'allarme', 'verdetto');
});

t('un giro impazzito — 2 milioni di scritture al giorno su 20 mila righe — lo prende l\'amplificazione', () => {
  const prima = sana({ quando: quando(24 * ORE) });
  const dopo = sana({ tabelle: [{ nome: 'pmo_cloud_records', ins: 100, upd: 20000 + 2000000, hot: 19000 + 1990000, del: 10, vive: 20000, morte: 300 }] });
  const g = giudica(dopo, deltaFra(prima, dopo));
  uguale(esitoDi(g, 'hot'), 'a-posto', 'hot');            // scrive bene, ma scrive troppo
  uguale(esitoDi(g, 'amplificazione'), 'allarme', 'amplificazione');
});

t('62 GB di WAL sul disco ⇒ allarme SENZA bisogno di nessuna finestra', () => {
  const dopo = sana({ }); dopo.wal_su_disco = 62 * GB; dopo.wal_file = 3968;
  const g = giudica(dopo, deltaFra(null, dopo));
  uguale(esitoDi(g, 'wal-su-disco'), 'allarme', 'wal-su-disco');
  uguale(g.verdetto, 'allarme', 'verdetto');
});

t('560 MB di WAL — la stessa misura dopo la cura — non suona', () => {
  uguale(esitoDi(giudica(sana(), deltaFra(null, sana())), 'wal-su-disco'), 'a-posto', 'wal-su-disco');
});

console.log('\n── ⑤ l\'ARCHIVIAZIONE: il guasto della 160 per nome, preso PRIMA degli 8 GB ──');
// 🚨 «archiving WAL file failed too many times» e' cio' che ha messo giu' PROD il 05/09.
//    Con un segmento ogni 2 minuti, aspettare gli 8 GB della regola ① vuol dire
//    aspettare 17 ore. `pg_stat_archiver` lo dice al primo fallimento non seguito
//    da una ripresa.
t('ultimo fallimento DOPO l\'ultimo archiviato ⇒ allarme, anche con 560 MB sul disco', () => {
  const dopo = sana({ archivio: { archiviati: 600, falliti: 3, ultimo_ok: '2026-09-06T01:40:00+00:00', ultimo_fallito: '2026-09-06T01:58:00+00:00' } });
  const g = giudica(dopo, deltaFra(null, dopo));
  uguale(esitoDi(g, 'archiviazione'), 'allarme', 'archiviazione');
  uguale(g.verdetto, 'allarme', 'verdetto');
});
t('un fallimento seguito da una RIPRESA ⇒ a posto (e il dettaglio lo racconta)', () => {
  const dopo = sana({ archivio: { archiviati: 600, falliti: 3, ultimo_ok: '2026-09-06T01:58:00+00:00', ultimo_fallito: '2026-09-06T01:40:00+00:00' } });
  const g = giudica(dopo, deltaFra(null, dopo));
  uguale(esitoDi(g, 'archiviazione'), 'a-posto', 'archiviazione');
  if (!/3 fallimenti/.test(regolaDi(g, 'archiviazione').dettaglio)) throw new Error('dettaglio: ' + regolaDi(g, 'archiviazione').dettaglio);
});
t('mai archiviato E gia\' fallito dal riavvio ⇒ allarme', () => {
  const dopo = sana({ archivio: { archiviati: 0, falliti: 1, ultimo_ok: null, ultimo_fallito: '2026-09-06T01:58:00+00:00' } });
  uguale(esitoDi(giudica(dopo, deltaFra(null, dopo)), 'archiviazione'), 'allarme', 'archiviazione');
});
t('nessun evento dal riavvio ⇒ non-giudicata; misura senza pg_stat_archiver ⇒ non-giudicata', () => {
  const zero = sana({ archivio: { archiviati: 0, falliti: 0, ultimo_ok: null, ultimo_fallito: null } });
  uguale(esitoDi(giudica(zero, deltaFra(null, zero)), 'archiviazione'), 'non-giudicata', 'zero eventi');
  const senza = sana({ archivio: null });
  uguale(esitoDi(giudica(senza, deltaFra(null, senza)), 'archiviazione'), 'non-giudicata', 'senza misura');
});

console.log('\n── ⑥ «non ho guardato» non diventa mai «a posto» ──');
t('pochi aggiornamenti nella finestra ⇒ HOT non giudicata (non «a posto»)', () => {
  const prima = sana({ quando: quando(24 * ORE) });
  const dopo = sana({ tabelle: [{ nome: 'pmo_cloud_records', ins: 100, upd: 20010, hot: 19000, del: 10, vive: 24000, morte: 300 }] });
  uguale(esitoDi(giudica(dopo, deltaFra(prima, dopo)), 'hot'), 'non-giudicata', 'hot');
});

t('nessuna tabella grande ⇒ tuple-morte non giudicata (una misura vuota non rassicura)', () => {
  const vuota = sana({ tabelle: [] });
  const g = giudica(vuota, deltaFra(null, vuota));
  uguale(esitoDi(g, 'tuple-morte'), 'non-giudicata', 'tuple-morte');
});

t('se NESSUNA regola si e\' pronunciata il verdetto e\' «non-giudicabile», non «serena»', () => {
  const vuota = sana({ tabelle: [], archivio: null });
  vuota.wal_su_disco = null;            // anche la fotografia del WAL manca
  const g = giudica(vuota, deltaFra(null, vuota), { ...SOGLIE, walSuDiscoAllarmeByte: Infinity });
  // wal-su-disco resta `a-posto` con soglia infinita ⇒ si forza il caso togliendola:
  const g2 = giudica({ ...vuota, tabelle: [] }, deltaFra(null, vuota), { ...SOGLIE, walSuDiscoAllarmeByte: Infinity });
  uguale(esitoDi(g2, 'tuple-morte'), 'non-giudicata', 'tuple-morte');
  uguale(esitoDi(g2, 'archiviazione'), 'non-giudicata', 'archiviazione');
  if (g.verdetto === 'allarme') throw new Error('non doveva suonare');
});

t('una tabella gonfia di righe morte suona', () => {
  const dopo = sana({ tabelle: [{ nome: 'pmo_bkp', ins: 0, upd: 0, hot: 0, del: 0, vive: 5000, morte: 6000 }] });
  uguale(esitoDi(giudica(dopo, deltaFra(null, dopo)), 'tuple-morte'), 'allarme', 'tuple-morte');
});

console.log('\n── ⑦ gli allarmi si contano e si dicono PER REGOLA, non per giro (06/09) ──');
// 🚨⭐ Il buco della prima stesura: un solo `allarme_attivo` per tutto il giro. Con l'HOT
//    fermo in allarme (e su pmo_cloud_records lo e' per costruzione) un guasto NUOVO
//    non avrebbe mandato niente. Le corse qui sotto sono la sequenza dei giorni.
const R = (codice, esito, extra = {}) => ({ codice, esito, titolo: codice, dettaglio: 'x', ...extra });
t('un allarme suona alla SECONDA lettura di fila, non alla prima', () => {
  const g1 = evolviRegole([], [R('hot', 'allarme')]);
  uguale(g1.nuovi.length, 0, 'nuovi al 1° giro');
  uguale(g1.consecutivi, 1, 'di fila al 1° giro');
  const g2 = evolviRegole(g1.regole, [R('hot', 'allarme')]);
  uguale(g2.nuovi.map(r => r.codice).join(), 'hot', 'nuovi al 2° giro');
  uguale(g2.allarmeAttivo, true, 'attivo');
  const g3 = evolviRegole(g2.regole, [R('hot', 'allarme')]);
  uguale(g3.nuovi.length, 0, 'al 3° giro non si ridice');
  uguale(g3.consecutivi, 3, 'di fila al 3° giro');
});
t('🎯 con l\'HOT gia\' attivo, l\'ARCHIVIAZIONE che si ferma per due giri viene DETTA lo stesso', () => {
  let s = evolviRegole([], [R('hot', 'allarme'), R('archiviazione', 'a-posto')]);
  s = evolviRegole(s.regole, [R('hot', 'allarme'), R('archiviazione', 'a-posto')]);      // hot detto
  uguale(s.nuovi.map(r => r.codice).join(), 'hot', 'giro 2');
  s = evolviRegole(s.regole, [R('hot', 'allarme'), R('archiviazione', 'allarme')]);      // archivio: 1° giro
  uguale(s.nuovi.length, 0, 'giro 3: pazienza anche sul nuovo');
  s = evolviRegole(s.regole, [R('hot', 'allarme'), R('archiviazione', 'allarme')]);      // 2° giro
  uguale(s.nuovi.map(r => r.codice).join(), 'archiviazione', 'giro 4: il guasto nuovo si dice');
  uguale(s.attivi.map(r => r.codice).join(), 'hot,archiviazione', 'attivi');
});
t('il RIENTRO e\' per regola: il WAL rientra, l\'HOT resta attivo e non si ridice', () => {
  let s = evolviRegole([], [R('hot', 'allarme'), R('wal-al-giorno', 'allarme')]);
  s = evolviRegole(s.regole, [R('hot', 'allarme'), R('wal-al-giorno', 'allarme')]);
  uguale(s.nuovi.map(r => r.codice).join(), 'hot,wal-al-giorno', 'entrambi detti');
  s = evolviRegole(s.regole, [R('hot', 'allarme'), R('wal-al-giorno', 'a-posto')]);
  uguale(s.rientri.map(r => r.codice).join(), 'wal-al-giorno', 'rientro');
  uguale(s.nuovi.length, 0, 'niente di nuovo');
  uguale(s.attivi.map(r => r.codice).join(), 'hot', 'resta attivo');
  uguale(s.allarmeAttivo, true, 'allarme_attivo');
  s = evolviRegole(s.regole, [R('hot', 'allarme'), R('wal-al-giorno', 'a-posto')]);
  uguale(s.rientri.length, 0, 'il rientro non si ridice');
});
t('`non-giudicata` non avanza, non azzera e non spegne un allarme attivo', () => {
  let s = evolviRegole([], [R('hot', 'allarme')]);
  s = evolviRegole(s.regole, [R('hot', 'non-giudicata')]);
  uguale(regolaDi(s, 'hot').di_fila, 1, 'di fila fermo');
  s = evolviRegole(s.regole, [R('hot', 'allarme')]);
  uguale(s.nuovi.map(r => r.codice).join(), 'hot', 'riprende da dov\'era: 2 ⇒ suona');
  s = evolviRegole(s.regole, [R('hot', 'non-giudicata')]);
  uguale(regolaDi(s, 'hot').attivo, true, 'attivo resta');
  uguale(s.rientri.length, 0, 'nessun rientro finto');
});
t('le righe VECCHIE (un solo consecutivi/allarme_attivo) si traducono: l\'allarme gia\' detto non si ridice', () => {
  // La riga 3 di PROD del 06/09 09:13: hot e wal-al-giorno in allarme, consecutivi 2, allarme_attivo true.
  const rigaVecchia = {
    consecutivi: 2, allarme_attivo: true,
    regole: [R('wal-su-disco', 'a-posto'), R('hot', 'allarme'), R('wal-al-giorno', 'allarme'), R('amplificazione', 'a-posto')],
  };
  const ieri = regoleDiIeri(rigaVecchia);
  uguale(regolaDi({ regole: ieri }, 'hot').di_fila, 2, 'hot eredita il conteggio');
  uguale(regolaDi({ regole: ieri }, 'hot').attivo, true, 'hot eredita lo stato');
  uguale(regolaDi({ regole: ieri }, 'wal-su-disco').di_fila, 0, 'a-posto parte da zero');
  // Il giro dopo, con la misura corretta: l'HOT resta, il WAL rientra, l'archiviazione e' nuova e a posto.
  const s = evolviRegole(ieri, [R('wal-su-disco', 'a-posto'), R('hot', 'allarme'), R('wal-al-giorno', 'a-posto'), R('amplificazione', 'a-posto'), R('archiviazione', 'a-posto')]);
  uguale(s.nuovi.length, 0, 'l\'HOT non si ridice');
  uguale(s.rientri.map(r => r.codice).join(), 'wal-al-giorno', 'il WAL rientra');
  uguale(s.consecutivi, 3, 'consecutivi');
  uguale(regoleDiIeri(null).length, 0, 'senza riga di ieri: niente');
});

console.log('\n── ⑧ i byte si leggono come li legge una persona ──');
t('leggibile()', () => {
  uguale(leggibile(0), '0 B', '0');
  uguale(leggibile(1536), '1.5 kB', '1536');
  uguale(leggibile(62 * GB), '62 GB', '62 GB');
});

console.log(`\n${rotte ? '🔴' : '✅'} ${fatte - rotte}/${fatte} corse verdi\n`);
process.exit(rotte ? 1 : 0);
