/* 🚨 «Quello che non è cambiato non si riscrive» — banco della cura del 05/09/2026.
 *
 * 📏 IL DIFETTO, misurato su PROD mentre il database era in avaria: il sync contava le righe
 * invariate — `unchangedBookingRows: 272`, `unchangedOccupancyRows: 165` contro `changed: 0` e
 * `new: 0` — e poi **le riscriveva tutte lo stesso**. 437 righe ogni due minuti, zero cambiate.
 * ⇒ ~250.000 scritture inutili al giorno. Su `pmo_cloud_records`: `n_tup_upd` **14.343.602** su
 * **31.193** righe vive, con `n_tup_hot_upd` a **ZERO** — nessuna riscrittura economica, quindi
 * ognuna genera una riga nuova più tutte le voci d'indice. Una fabbrica di WAL: quella mattina
 * l'archiviazione ha smesso di farcela (`archiving WAL file failed too many times`) e il
 * database è diventato irraggiungibile perfino per il servizio di autenticazione.
 *
 * ⛔ QUELLO CHE QUESTO BANCO NON DICE: che il database sia guarito. Gira senza rete ⇒ prova che
 * il MECCANISMO è quello giusto e che le due condizioni pericolose sono al posto loro.
 *
 * Esegui:  deno test --allow-read non-riscrivere-linvariato.test.ts
 */
import { assert, assertEquals } from 'jsr:@std/assert@1';

const QUI = new URL('.', import.meta.url).pathname;
const SYNC = await Deno.readTextFile(QUI + 'index.ts');
const SCRITTURA = await Deno.readTextFile(
  QUI + '../consumer-booking-write/index.ts',
);

/** Le sole righe di CODICE: i commenti spiegano il difetto e ne NOMINANO i pezzi, quindi una
 *  guardia che li leggesse accuserebbe la riga che la difende. Si taglia per struttura. */
function soloCodice(testo: string): string {
  return testo
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').filter((r) => !/^\s*\/\//.test(r)).join('\n');
}

/** Il corpo di una funzione/arrow, contando le graffe dalla prima del corpo. */
function corpoDa(testo: string, ancora: string): string {
  const i = testo.indexOf(ancora);
  assert(i > 0, 'ancora non trovata: ' + ancora);
  const apre = testo.indexOf('{', i + ancora.length - 1);
  let g = 0, out = '';
  for (let k = apre; k < testo.length; k++) {
    const c = testo[k];
    out += c;
    if (c === '{') g++;
    else if (c === '}') { g--; if (g === 0) break; }
  }
  return out;
}

const ADD = soloCodice(corpoDa(SYNC, 'const addSnapshotRecord ='));

Deno.test('① l\'invariato NON si scrive: c\'è l\'uscita anticipata', () => {
  assert(
    /if\s*\(existingPayload\s*&&\s*stableStringify\(existingPayload\)\s*===\s*stableStringify\(payload\)\)\s*return;/
      .test(ADD),
    'manca il salto: le righe invariate tornano a essere riscritte ogni 2 minuti',
  );
});

Deno.test('② 🚨 la chiave si registra PRIMA del salto, o la riga saltata verrebbe SEPOLTA', () => {
  /* È la condizione che rende la cura sicura invece che distruttiva: chi è sparito si decide
     su `currentKeysByType`. Se il salto avvenisse prima di registrarla, una prenotazione
     invariata risulterebbe assente dalla fotografia e verrebbe tombata — cioè la cura
     cancellerebbe dal calendario proprio le partite che non cambiano mai. */
  const posChiave = ADD.indexOf('currentKeysByType.get(recordType)?.add(localKey)');
  const posSalto = ADD.search(/if\s*\(existingPayload\s*&&\s*stableStringify/);
  assert(posChiave >= 0, 'la chiave corrente non si registra più');
  assert(posSalto >= 0, 'il salto non c\'è');
  assert(
    posChiave < posSalto,
    'il salto viene PRIMA di registrare la chiave: le righe invariate verrebbero sepolte',
  );
});

Deno.test('③ i conteggi restano veri: si contano prima di saltare', () => {
  const posConto = ADD.indexOf('unchangedBookingRows += 1');
  const posSalto = ADD.search(/if\s*\(existingPayload\s*&&\s*stableStringify/);
  assert(posConto >= 0 && posConto < posSalto,
    'le invariate non si contano più: il timbro del giro direbbe il falso');
});

Deno.test('④ ⭐ la FRESCHEZZA non si legge più dalle righe prenotazione', () => {
  /* È la metà che rende la cura possibile. `max(synced_at)` sulle righe obbligava il sync a
     riscriverle tutte per tenere il timbro fresco: il costo di quella lettura non si pagava
     leggendo, si pagava a monte. */
  const codice = soloCodice(SCRITTURA);
  const i = codice.indexOf('const copiaFrescaAl');
  assert(i > 0, 'la freschezza non si legge più');
  const blocco = codice.slice(Math.max(0, i - 700), i);
  assert(
    blocco.includes("'matchpoint_bookings_auto_import_last'"),
    'la freschezza non legge il timbro del giro',
  );
  assert(
    !/\.in\('record_type',\s*\['booking',\s*'booking_occupancy'\]\)[\s\S]{0,200}order\('synced_at'/.test(blocco),
    'la freschezza torna a leggere max(synced_at) dalle righe: il sync dovrà riscriverle tutte',
  );
});

Deno.test('⑤ 🚨 il timbro sta nello STESSO upsert delle righe, o non testimonia niente', () => {
  /* La garanzia che rende la freschezza una testimonianza e non una data: **un giro fallito non
     la muove**. Vale solo se il timbro viene scritto insieme alle righe, nella stessa `upsert`
     che avviene solo a esportazione riuscita. Se un domani qualcuno lo scrivesse per conto suo,
     un giro fallito potrebbe timbrare «fresco» una copia ferma — e su quella il gestionale
     direbbe «no, non hai prenotato» a una prenotazione che esiste. */
  const codice = soloCodice(SYNC);
  const posTimbro = codice.indexOf("local_key: 'matchpoint_bookings_auto_import_last'");
  const posUpsert = codice.indexOf(".upsert(records, { onConflict: 'record_type,local_key' })");
  assert(posTimbro > 0, 'il timbro del giro non si scrive più');
  assert(posUpsert > posTimbro,
    'il timbro non finisce nell\'upsert delle righe: un giro fallito potrebbe timbrarlo lo stesso');
  assert(codice.slice(posTimbro, posUpsert).indexOf('records.push') >= 0 ||
         codice.lastIndexOf('records.push', posTimbro) > 0,
    'il timbro non viene accodato a `records`');
});

Deno.test('⑥ la sepoltura di chi è sparito NON è stata toccata', () => {
  const codice = soloCodice(SYNC);
  assert(/if \(currentKeysByType\.get\(type\)\?\.has\(key\)\) continue;/.test(codice),
    'la riconciliazione di chi è sparito è cambiata: va riprovata a parte');
  assert(/deleted: true,/.test(codice), 'le lapidi non si scrivono più');
});

Deno.test('⑦ la pulizia della fotografia esiste, e tocca SOLO lo specchio', async () => {
  /* ⚠️ Via i commenti PRIMA di guardare: questa scheda spiega perché non si filtra su
     `deleted = true`, quindi quella frase è scritta dentro il file — e una guardia che leggesse
     i commenti accuserebbe la riga che la difende. È la terza volta in due giorni.
     📌 *Una guardia deve rompersi su ciò che è sbagliato, non su ciò che ne parla.* */
  const sql = (await Deno.readTextFile(
    QUI + '../../manual-sql/supabase_pmo_cleanup_booking_snapshot.sql',
  )).split('\n').filter((r) => !/^\s*--/.test(r)).join('\n');
  assert(/record_type in \('booking', 'booking_occupancy'\)/.test(sql),
    'la pulizia non è ristretta allo specchio dell\'ultimo scarico');
  for (const intoccabile of ['booking_history', 'payment', 'staff_booking', 'member']) {
    assert(!new RegExp("in \\([^)]*'" + intoccabile + "'").test(sql),
      'la pulizia tocca ' + intoccabile + ', che nessuno scarico ricostruirebbe');
  }
  assert(/limit p_batch/.test(sql), 'la pulizia non va a lotti: prenderebbe lock e genererebbe WAL');
  assert(/~ '\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$'/.test(sql),
    'una data illeggibile non è protetta: la pulizia deve fallire CHIUSA e tenerla');
  assert(/p_grace_days int default 30/.test(sql),
    'la finestra non è più di 30 giorni: è la misura che ha dato lui');
  /* 🚨⭐⭐ LA GUARDIA CHE NASCE DA UNA SUA CORREZIONE — «attenzione a non cancellare le partite
     degli ultimi 30 giorni e quelle future». La prima stesura buttava tutto ciò che aveva
     `deleted = true` senza guardare la data: fra quelle righe ci sono le lapidi delle partite
     **future annullate**, che hanno data di domani. ⇒ Il taglio dev'essere SOLO sulla data.
     📌 *Un filtro su «è cancellato» non è un filtro su «è vecchio».* */
  assert(!/deleted\s*=\s*true/.test(sql),
    'la pulizia guarda di nuovo `deleted`: cancellerebbe le lapidi delle partite FUTURE annullate');
  /* 🩹⭐ NATA DA UN ERRORE CHE QUESTO BANCO NON AVEVA VISTO: un sabotaggio di prova aveva
     lasciato `payload->>>'data'` — TRE frecce, che in SQL non esistono — e il banco era verde
     lo stesso, perché guardava la regex della data e non l'operatore che la tira fuori.
     📌 *Una guardia che controlla la forma di un pezzo non controlla che il pezzo accanto sia
        valido: il verde diceva «la data è protetta», non «questa SQL si può eseguire».* */
  assert(!/->>>/.test(sql), "operatore JSON storpiato (`->>>`): questa SQL non partirebbe");
  assert(/payload->>'data'/.test(sql), "manca `payload->>'data'`: il taglio non guarda più la data");
});

Deno.test('⑧ i conteggi del giro escono ancora nel timbro', () => {
  const codice = soloCodice(SYNC);
  for (const campo of ['unchangedBookingRows', 'changedBookingRows', 'newBookingRows']) {
    assertEquals(codice.includes(campo + ','), true,
      'il timbro non dichiara più ' + campo + ': senza, il risparmio non si può misurare');
  }
});
