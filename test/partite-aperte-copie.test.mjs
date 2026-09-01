// ── BANCO: le due copie delle regole «Partite Aperte» (voce 88) ────────────────────────
//
// Che cosa prova: che `partita-aperta.ts` sia IDENTICO nelle due cartelle che lo portano, e
// che nessuna delle due si sia riscritta in casa una delle regole che il modulo tiene.
//
// 🚨 PERCHÉ DUE COPIE E NON `_shared/`: i workflow di deploy scelgono le funzioni dalle
//    CARTELLE TOCCATE e saltano tutto ciò che inizia per `_`. Un modulo in `_shared/`
//    cambierebbe in git senza rideployare NESSUNO — la copia vecchia resterebbe viva in
//    produzione, in silenzio e col semaforo verde. È lo stesso disegno (e lo stesso motivo)
//    di `livello-dimostrato.ts` e di `giro-del-test.ts`.
//
// 🚨⭐⭐ E QUI LA DERIVA HA UNA FORMA SUA, che è la ragione per cui questo banco esiste: le
//    due copie stanno una in chi **ELENCA** (`consumer-player-readmodel`) e una in chi
//    **AMMETTE** (`consumer-booking-write`). Se divergono, il bot mostra una partita in cui
//    poi il gestionale non fa entrare. ⇒ *Un bottone che non può funzionare è peggio di un
//    bottone che non c'è*: il socio non legge «non puoi», legge «non ha funzionato».
//
// ⚖️ Questo banco NON prova le regole — quelle le prova `partita-aperta.test.ts`, coi suoi
//    24 casi, e in particolare i gruppi 4 e 6. Qui si prova solo che ci sia UNA regola.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';

const QUI = dirname(fileURLToPath(import.meta.url));
const FUNZIONI = join(QUI, '..', 'supabase', 'functions');

// La guardia conta le copie da sé: aggiungerne una senza toccare questa riga fa rosso.
const CARTELLE = ['consumer-booking-write', 'consumer-player-readmodel'];
const COPIE = CARTELLE.map((fn) => join(FUNZIONI, fn, 'partita-aperta.ts'));
const SORGENTI = COPIE.map((f) => readFileSync(f, 'utf8'));
const src = SORGENTI[0];
// ⚠️ Le guardie sul CONTENUTO girano sul codice senza commenti: in italiano i commenti
// citano di continuo le regole che sorvegliano («non è `level !== '0.5'`», «i NOMI non
// passano di qua»), e una guardia che legge anche quelli è rossa proprio quando il file
// spiega meglio sé stesso. 📌 *Una guardia che punisce la documentazione la fa sparire.*
const codice = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const indice = (fn) => readFileSync(join(FUNZIONI, fn, 'index.ts'), 'utf8');

const guardie = [
  ['le DUE copie di partita-aperta sono identiche BYTE PER BYTE',
    COPIE.length === 2 && new Set(SORGENTI).size === 1],

  // 🚨 Il modulo decide CHI ENTRA e non deve sapere niente di più: se un giorno leggesse o
  //    scrivesse da sé, la stessa domanda avrebbe due risposte a seconda di chi la fa.
  ['il modulo è PURO: non legge e non scrive niente',
    !/\bfrom\(|\.insert\(|\.update\(|\.upsert\(|\bfetch\(/.test(codice)],

  // 🚨⭐⭐ REGOLA ①: chi non ne fa parte vede solo i NUMERI, mai un nome. La difesa vera è
  //    che il dato non passi di qua — un modulo che non ha mai visto un nome non ne può
  //    far uscire uno.
  ['il modulo non maneggia NOMI', !/\bname\b|\bfirstName\b|\bsurname\b|\bnome\b/i.test(codice)],

  // 🚨 La regola di «avere il livello» è `livelloDimostrato`, non un confronto con '0.5'
  //    scritto a mano: un `level !== '0.5'` guarda solo il numero e lascia passare i livelli
  //    PRESI IN PRESTITO, cioè centra la banda del ±0,5 su un numero mai misurato.
  ['il modulo non si riscrive in casa la regola del livello', !/'0\.5'/.test(codice)],
  ['e la prende da livello-dimostrato', /from '\.\/livello-dimostrato\.ts'/.test(codice)],

  // ⭐ La decisione ① ha DUE metà, e quella che non viene in mente è la seconda: chi non ha
  //    un livello non può nemmeno APRIRE. Senza, la sua partita risulta aperta ai 2.283 soci
  //    a «da definire» — un filtro che non filtra nessuno.
  ['la decisione ① c\'è per intero: si entra E si apre solo col livello',
    /export function puoAprire\(/.test(codice) && /APERTURA_SENZA_LIVELLO/.test(codice)],

  // 🚨 L'ordine dei rifiuti è una scelta, non un caso: `serve_il_test` deve venire prima di
  //    `livello_lontano`, o a 2.283 persone si dice «sei di un altro livello» su un numero
  //    che nessuno ha mai misurato.
  ['serve_il_test è deciso PRIMA di livello_lontano',
    codice.indexOf('MOTIVI.SERVE_IL_TEST') < codice.indexOf('MOTIVI.LIVELLO_LONTANO')],
  // ⭐ E `non_aperta` prima di tutto: di una partita che non è aperta non si dice niente,
  //    nemmeno che è piena.
  ['non_aperta è il primo di tutti',
    codice.indexOf('MOTIVI.NON_APERTA') < codice.indexOf('MOTIVI.GIA_IN_PARTITA')
    && codice.indexOf('MOTIVI.NON_APERTA') < codice.indexOf('MOTIVI.AL_COMPLETO')],

  // ⚠️ Le due funzioni che il modulo NON tiene (`clienteDelCircolo` sta in un modulo suo, e
  //    il roster lo compone chi chiama) devono arrivare come INPUT: un modulo che se le
  //    calcolasse in casa sarebbe una terza lettura della regola ③.
  ['la regola ③ entra come input, non si ricalcola qui',
    /clienteDelCircolo: boolean/.test(codice) && !/FORMA_CODICE_CLIENTE/.test(codice)],

  // 🚨 I due index devono USARE il modulo, non una copia in linea delle sue regole: è il
  //    modo in cui una guardia sui file resta una guardia sul comportamento.
  ['chi AMMETTE importa il modulo',
    /from '\.\/partita-aperta\.ts'/.test(indice('consumer-booking-write'))],
  ['chi ELENCA importa il modulo',
    /from '\.\/partita-aperta\.ts'/.test(indice('consumer-player-readmodel'))],
];

test('BANCO — le due copie delle regole Partite Aperte', () => {
  const rotte = [];
  for (const [nome, ok] of guardie) {
    if (ok) console.log(`ok   - ${nome}`);
    else { console.log(`FAIL - ${nome}`); rotte.push(nome); }
  }
  console.log(`\n${guardie.length - rotte.length} verdi · ${rotte.length} rossi`);
  if (rotte.length) throw new Error(`guardie rotte: ${rotte.join(' · ')}`);
});
