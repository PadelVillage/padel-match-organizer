// ── BANCO: «una lapide non vuol dire sempre la stessa cosa» (voce 75, 22/08/2026) ────────
//
// Che cosa prova: che la copia locale di una prenotazione venga scritta anche quando sullo
// stesso slot, con la stessa chiave, giace la lapide di un annullo PRECEDENTE — e che continui
// a NON essere scritta nel caso per cui la guardia anti-fantasma è nata.
//
// 📏 IL FATTO CHE L'HA FATTO NASCERE, visto su una persona vera il 22/08 sera:
//   10:53:59  si annulla 31/08 · 09:30 · Campo 1  ⇒ `staff_booking|…|consumer-assistente-soci`
//             diventa una lapide
//   20:58:32  lo stesso socio riprenota LO STESSO slot dal bot ⇒ stessa chiave ⇒ la guardia
//             usciva senza scrivere
//   20:58:57  il bot: «Non trovo più quella partita fra le tue… serve la segreteria»
//   21:02:18  la partita arriva col sync, quasi quattro minuti dopo
//
// ⚖️ Le due risposte costano in modo DIVERSO, ed è la ragione per cui la regola fallisce chiusa:
// un «no» di troppo lascia il socio ad aspettare il sync (il comportamento di prima, fastidioso);
// un «sì» di troppo rimette in piedi una prenotazione annullata (il fantasma di luglio, grave).
//
// ⭐ Il CABLAGGIO si prova qui dentro (sezione ⑥), e non è un di più: una regola giusta che
// nessuno chiama è un modulo, non una cura. A verificare che questo banco MORDA davvero c'è
// `test/sabotaggi-voce-75.mjs`, che rimette il difetto e pretende un rosso.
//
// ⛔ Quello che questo banco NON prova, e va detto: che scrivendo quella riga il socio veda la
// partita. Fra questa decisione e il suo schermo ci sono l'upsert, il ponte, l'elenco del bot e
// Telegram. Il banco prova la DECISIONE e il CABLAGGIO — ciò che è nostro e puro — non il giro.
//
// Uso:  node test/scrivere-sopra-una-lapide.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const QUI = dirname(fileURLToPath(import.meta.url));
const MODULO = join(QUI, '..', 'supabase', 'functions', 'matchpoint-bookings-create', 'lapide-prenotazione.js');
const { siPuoScrivereSopraLapide, idPrenotazione } = await import(MODULO);

let falliti = 0;
function prova(nome, atteso, avuto) {
  const ok = JSON.stringify(atteso) === JSON.stringify(avuto);
  if (!ok) {
    falliti += 1;
    console.error(`  ❌ ${nome}\n     atteso ${JSON.stringify(atteso)}\n     avuto  ${JSON.stringify(avuto)}`);
  } else {
    console.log(`  ✅ ${nome}`);
  }
}

// ── ① Nessuna lapide: la domanda non si pone ────────────────────────────────────────────
prova(
  'riga viva (o inesistente) ⇒ si scrive, e il motivo lo dice',
  { si: true, motivo: 'nessuna_lapide' },
  siPuoScrivereSopraLapide({ lapide: false, payloadLapide: null, idNuovo: '9585', sepoltaAlle: null, scritturaIniziataAlle: null }),
);

// ── ② L'ID decide, nei due versi ────────────────────────────────────────────────────────
prova(
  'id DIVERSO ⇒ è un\'altra partita, si scrive',
  { si: true, motivo: 'id_diverso' },
  siPuoScrivereSopraLapide({
    lapide: true, payloadLapide: { id_reserva: '9549' }, idNuovo: '9585',
    sepoltaAlle: '2026-08-22T10:53:59Z', scritturaIniziataAlle: '2026-08-22T18:58:20Z',
  }),
);
prova(
  'id UGUALE ⇒ è la lapide di QUESTA prenotazione, non si tocca',
  { si: false, motivo: 'stessa_prenotazione' },
  siPuoScrivereSopraLapide({
    lapide: true, payloadLapide: { id_reserva: '9585' }, idNuovo: '9585',
    sepoltaAlle: '2026-08-22T10:53:59Z', scritturaIniziataAlle: '2026-08-22T18:58:20Z',
  }),
);
// 🚨 L'id vince SULL'ORDINE, e va provato apposta: qui la lapide è precedente — il fatto che da
// solo direbbe «scrivi» — ma è la stessa prenotazione, quindi no. Se un domani qualcuno
// invertisse i due controlli «per pulizia», questo caso è l'unico che se ne accorgerebbe.
prova(
  'id uguale + lapide precedente ⇒ vince l\'id: non si scrive',
  { si: false, motivo: 'stessa_prenotazione' },
  siPuoScrivereSopraLapide({
    lapide: true, payloadLapide: { id_reserva: '9585' }, idNuovo: '9585',
    sepoltaAlle: '2026-08-22T08:00:00Z', scritturaIniziataAlle: '2026-08-22T18:58:20Z',
  }),
);

// ── ③ Senza id, decide l'ORDINE ─────────────────────────────────────────────────────────
// 🎯 IL CASO VERO DEL 22/08, coi suoi dati: la lapide di quella riga NON portava `id_reserva`
// (payload misurato su PROD: ora, data, nome, tipo, campo, durata, ora_fine — e nient'altro).
// ⇒ Se la regola si fosse fermata all'id, il difetto sarebbe sopravvissuto intero alla cura.
prova(
  '🎯 il caso vero: lapide delle 10:53, scrittura delle 20:58, nessun id ⇒ si scrive',
  { si: true, motivo: 'lapide_precedente' },
  siPuoScrivereSopraLapide({
    lapide: true,
    payloadLapide: { ora: '09:30', data: '2026-08-31', nome: 'Maurizio Aprea, Lidia Comes', tipo: 'partita', campo: 1, durata: 90, ora_fine: '11:00' },
    idNuovo: '9585',
    sepoltaAlle: '2026-08-22T10:53:59.865Z',
    scritturaIniziataAlle: '2026-08-22T18:58:21.000Z',
  }),
);
prova(
  'lapide arrivata DOPO l\'inizio della scrittura ⇒ può essere il suo annullo: non si tocca',
  { si: false, motivo: 'lapide_successiva' },
  siPuoScrivereSopraLapide({
    lapide: true, payloadLapide: { nome: 'Tizio' }, idNuovo: '9585',
    sepoltaAlle: '2026-08-22T18:58:40Z', scritturaIniziataAlle: '2026-08-22T18:58:21Z',
  }),
);

// ── ④ Si fallisce CHIUSI ────────────────────────────────────────────────────────────────
for (const [nome, o] of [
  ['manca l\'istante della scrittura', { sepoltaAlle: '2026-08-22T10:53:59Z', scritturaIniziataAlle: null }],
  ['manca l\'istante della sepoltura', { sepoltaAlle: null, scritturaIniziataAlle: '2026-08-22T18:58:21Z' }],
  ['due date illeggibili', { sepoltaAlle: 'ieri', scritturaIniziataAlle: 'poco fa' }],
]) {
  prova(
    `${nome} ⇒ non si scrive (si fallisce chiusi)`,
    { si: false, motivo: 'istanti_ignoti' },
    siPuoScrivereSopraLapide({ lapide: true, payloadLapide: { nome: 'Tizio' }, idNuovo: '9585', ...o }),
  );
}
// ⚠️ Un id da una parte sola NON basta a decidere: se la lapide ne ha uno e noi no (o viceversa)
// il confronto ① non si può fare, e si scende all'ordine — non si tira a indovinare.
prova(
  'id solo sulla lapide ⇒ si scende all\'ordine, non si indovina',
  { si: true, motivo: 'lapide_precedente' },
  siPuoScrivereSopraLapide({
    lapide: true, payloadLapide: { id_reserva: '9549' }, idNuovo: null,
    sepoltaAlle: '2026-08-22T10:53:59Z', scritturaIniziataAlle: '2026-08-22T18:58:21Z',
  }),
);

// ── ⑤ L'id si legge coi DUE nomi che le due estremità usano ──────────────────────────────
// 🚨 Non è pignoleria: la nostra riga scrive `id_reserva`, quella che l'app pusha per conto suo
// scrive `idReserva`. Leggendone uno solo, metà delle lapidi risulterebbe senza id e il
// confronto ① si spegnerebbe IN SILENZIO, cadendo sempre sull'ordine — che nel caso «stessa
// prenotazione riannullata» darebbe la risposta sbagliata.
prova('id_reserva si legge', '9549', idPrenotazione({ id_reserva: '9549' }));
prova('idReserva si legge', '9549', idPrenotazione({ idReserva: 9549 }));
prova('stringa vuota vale come assente', null, idPrenotazione({ id_reserva: '   ' }));
prova('payload assente ⇒ nessun id', null, idPrenotazione(null));

// ── ⑥ IL CABLAGGIO: la regola dev'essere CHIAMATA, e la guardia cieca non deve tornare ──
// 🚨 Ancorato a INIZIO RIGA, e non è pignoleria: la lezione del 19/08 è che *una guardia che
// cerca una parola prova che la parola c'è, non che il codice succeda* — un `if (false)` davanti
// sposta la riga, e una ricerca libera la troverebbe lo stesso.
const edge = readFileSync(join(QUI, '..', 'supabase', 'functions', 'matchpoint-bookings-create', 'index.ts'), 'utf8');
prova(
  'l\'edge chiama la regola',
  true,
  /^\s*const verdettoLapide = siPuoScrivereSopraLapide\(\{/m.test(edge),
);
prova(
  'l\'edge esce sul verdetto, non sul flag',
  true,
  /^\s*if \(!verdettoLapide\.si\) return;/m.test(edge),
);
// ⛔ La guardia cieca di prima: se qualcuno la rimette, il difetto torna intero e il banco
// resterebbe verde — la regola continuerebbe a decidere benissimo senza che nessuno l'ascolti.
prova(
  'la guardia cieca NON è tornata',
  false,
  /^\s*if \(esistente\?\.deleted === true\) return;/m.test(edge),
);
// 🚨 E la fusione: sopra una lapide si SOSTITUISCE. Fondere farebbe nascere la prenotazione
// nuova coi campi della morta — nome e giocatori sbagliati, che è peggio del difetto curato.
prova(
  'sopra una lapide il payload si sostituisce, non si fonde',
  true,
  /^\s*const payload = esistente\?\.deleted === true \? nostro : fondiPayloadPrenotazione\(nostro, giaScritto\);/m.test(edge),
);

console.log('');
if (falliti) {
  console.error(`── ${falliti} prove rosse ──`);
  process.exit(1);
}
console.log('── tutte verdi ──');
