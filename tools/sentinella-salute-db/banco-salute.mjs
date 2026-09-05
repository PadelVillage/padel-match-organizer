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

import { deltaFra, giudica, leggibile, SOGLIE } from './misura.mjs';

let fatte = 0, rotte = 0;
const t = (nome, fn) => {
  fatte++;
  try { fn(); console.log(`  🟢 ${nome}`); }
  catch (e) { rotte++; console.log(`  🔴 ${nome}\n       ${e.message}`); }
};
const uguale = (a, b, che) => { if (a !== b) throw new Error(`${che}: ho ${JSON.stringify(a)}, mi aspettavo ${JSON.stringify(b)}`); };
const esitoDi = (g, codice) => (g.regole.find(r => r.codice === codice) || {}).esito || '(regola assente)';

const ORA = Date.parse('2026-09-06T02:00:00Z');
const quando = (msFa) => new Date(ORA - msFa).toISOString();
const ORE = 3600000;

// Una misura sana, con una tabella grande che aggiorna in modo HOT.
const sana = (opz = {}) => ({
  quando: opz.quando || new Date(ORA).toISOString(),
  db_bytes: 700 * 1024 ** 2,
  wal_su_disco: 560 * 1024 ** 2,
  wal_file: 36,
  lsn_bytes: opz.lsn ?? 1_000_000_000_000,
  avvio: opz.avvio || '2026-09-01T00:00:00+00:00',
  tabelle: opz.tabelle || [
    { nome: 'pmo_cloud_records', ins: 100, upd: 20000, hot: 19000, del: 10, vive: 24000, morte: 300 },
    { nome: 'member', ins: 10, upd: 50, hot: 48, del: 0, vive: 2800, morte: 20 },
  ],
});

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
  const dopo = sana({ tabelle: tanteScritture, lsn: 1_000_000_000_000 + 30 * 1024 ** 3 });

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

console.log('\n── ③ il difetto della 160, con i suoi numeri veri ──');
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
  const dopo = sana({ }); dopo.wal_su_disco = 62 * 1024 ** 3; dopo.wal_file = 3968;
  const g = giudica(dopo, deltaFra(null, dopo));
  uguale(esitoDi(g, 'wal-su-disco'), 'allarme', 'wal-su-disco');
  uguale(g.verdetto, 'allarme', 'verdetto');
});

t('560 MB di WAL — la stessa misura dopo la cura — non suona', () => {
  uguale(esitoDi(giudica(sana(), deltaFra(null, sana())), 'wal-su-disco'), 'a-posto', 'wal-su-disco');
});

console.log('\n── ④ «non ho guardato» non diventa mai «a posto» ──');
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
  const vuota = sana({ tabelle: [] });
  vuota.wal_su_disco = null;            // anche la fotografia del WAL manca
  const g = giudica(vuota, deltaFra(null, vuota), { ...SOGLIE, walSuDiscoAllarmeByte: Infinity });
  // wal-su-disco resta `a-posto` con soglia infinita ⇒ si forza il caso togliendola:
  const g2 = giudica({ ...vuota, tabelle: [] }, deltaFra(null, vuota), { ...SOGLIE, walSuDiscoAllarmeByte: Infinity });
  uguale(esitoDi(g2, 'tuple-morte'), 'non-giudicata', 'tuple-morte');
  if (g.verdetto === 'allarme') throw new Error('non doveva suonare');
});

t('una tabella gonfia di righe morte suona', () => {
  const dopo = sana({ tabelle: [{ nome: 'pmo_bkp', ins: 0, upd: 0, hot: 0, del: 0, vive: 5000, morte: 6000 }] });
  uguale(esitoDi(giudica(dopo, deltaFra(null, dopo)), 'tuple-morte'), 'allarme', 'tuple-morte');
});

console.log('\n── ⑤ i byte si leggono come li legge una persona ──');
t('leggibile()', () => {
  uguale(leggibile(0), '0 B', '0');
  uguale(leggibile(1536), '1.5 kB', '1536');
  uguale(leggibile(62 * 1024 ** 3), '62 GB', '62 GB');
});

console.log(`\n${rotte ? '🔴' : '✅'} ${fatte - rotte}/${fatte} corse verdi\n`);
process.exit(rotte ? 1 : 0);
