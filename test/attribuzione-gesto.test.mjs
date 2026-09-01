// ── BANCO: CHI HA CHIESTO il gesto arriva fino al bot (voce 79, 01/09/2026) ─────────────
//
// 📏 Nato da una PROVA FISICA, non da una rilettura. Il 01/09 alle 20:01 Laura Aprea è entrata
//    da sé in una partita aperta (voce 88, primo uso vero) e a Maurizio, Marco e Lidia è
//    arrivato sul telefono:
//
//        «Entra Laura Aprea. L'ha cambiata il circolo.
//         Se non te lo aspettavi, chiedi in segreteria: +39 379 115 1472.»
//
//    Due bugie: l'ATTRIBUZIONE (il circolo non aveva fatto niente) e la STRADA (la segreteria
//    di quel gesto non sa nulla e non può rispondere).
//
// 🚨⭐⭐ E PERCHÉ NON BASTAVA `origine`, che è la deduzione a portata di mano: `'conferma'`
//    vuol dire *«registrato nell'istante in cui il circolo ha detto sì»*, e ci passa **anche la
//    segreteria che lavora dall'app**. 📏 Misurato sul database quella sera: delle 16 righe
//    `annullata` con `origine = 'conferma'` non si può dire chi le abbia chieste — e non lo
//    sapeva **nemmeno il gestionale**. Un dato mai scritto non si recupera guardandone un altro.
//
// ⚖️ COSA PROVA QUESTO BANCO, e cosa no. Le frasi stanno nel BOT e hanno i loro casi là
//    (`test/staff-avvisi.test.ts`, repo `assistente-padel-agent`). Qui si prova la **catena**:
//    che il campo parta da chi chiede, attraversi le due edge di scrittura e arrivi in fondo.
//    ⇒ Una catena rotta in un anello solo non fa sbagliare una frase: la fa restare quella di
//    ieri, cioè un difetto che nessuno vede finché non guarda un telefono.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const QUI = dirname(fileURLToPath(import.meta.url));
const FUNZIONI = join(QUI, '..', 'supabase', 'functions');
const leggi = (...p) => readFileSync(join(FUNZIONI, ...p), 'utf8');

test('① chi CHIEDE lo manda: tutte e quattro le porte dei soci, non una sola', () => {
  const src = leggi('consumer-booking-write', 'index.ts');
  assert.ok(src.length > 50000, 'sorgente non letto: questa prova non direbbe niente');
  // 🚨 Il difetto da cui il caso difende è la cura fatta a metà: mandare l'attore solo sul
  // gesto visto sbagliare (`entra`) e lasciare gli altri tre a far dire «il circolo» al primo
  // turno buono. Si contano le OCCORRENZE, che sono quattro quante le scritture verso le due
  // edge — leave, remove, add/entra, cancel.
  const quante = (src.match(/chiestoDa: member\.name/g) ?? []).length;
  assert.equal(quante, 4, `l'attore parte da ${quante} scritture su 4: le altre diranno «il circolo»`);
});

test('② le due edge di scrittura lo raccolgono e lo passano in coda', () => {
  for (const fn of ['matchpoint-bookings-edit', 'matchpoint-bookings-cancel']) {
    const src = leggi(fn, 'index.ts');
    assert.match(src, /chiestoDa\?: string;/, `${fn}: la richiesta non ha il campo`);
    assert.match(src, /chiestoDa: String\(\(body as JsonMap\)\?\.chiestoDa \?\? ''\)/,
      `${fn}: il campo non si legge dal corpo — arriverebbe sempre vuoto`);
    assert.match(src, /chiestoDa: (edit|cancel)\.chiestoDa/,
      `${fn}: letto e poi non passato a chi accoda: la catena si rompe qui, in silenzio`);
  }
});

test('③ chi accoda lo scrive in colonna, e il vuoto vale ASSENTE', () => {
  const src = leggi('_shared', 'dichiara-fatti.ts');
  assert.match(src, /chiesto_da: chiestoDa/, 'il fatto non porta l\'attore');
  // ⚠️ Senza questa normalizzazione una stringa di spazi finirebbe in colonna, e il socio
  // leggerebbe «L'ha chiesto .» — una frase rotta al posto di quella giusta di prima.
  assert.match(src, /String\(opts\.chiestoDa \?\? ''\)\.trim\(\) \|\| null/,
    'una stringa vuota finisce in colonna: il bot direbbe «L\'ha chiesto .»');
});

test('④ chi consegna lo chiede al database col RIPIEGO, e non ferma gli avvisi se manca', () => {
  const src = leggi('consumer-staff-events', 'index.ts');
  // 🚨 È la lezione di `staff_edit` (11/08) e di `origine` (voce 76): chiedere una colonna che
  // su quel progetto non esiste ferma **tutti gli avvisi a tutti i soci**, in silenzio e senza
  // che il guasto assomigli alla sua causa. TEST e PROD non si migrano nello stesso istante.
  assert.match(src, /leggiCoda\(`\$\{COLONNE\}, origine, \$\{COLONNE_79\}, chiesto_da`\)/,
    'la colonna non si chiede: l\'attribuzione non arriverebbe mai');
  assert.match(src, /coda senza 'chiesto_da'[\s\S]{0,200}leggiCoda\(`\$\{COLONNE\}, origine, \$\{COLONNE_79\}`\)/,
    'manca il ripiego: un progetto non migrato smetterebbe di consegnare QUALUNQUE avviso');
});

test('⑤ esce verso il bot — e `origine` NON esce, che è la coppia da non confondere', () => {
  const src = leggi('consumer-staff-events', 'index.ts');
  assert.match(src, /chiesto_da: e\.chiestoDa \?\? null/, 'l\'attore non esce: il bot non lo vedrà mai');
  // ⛔ `origine` governa QUANTO SI ASPETTA, non cosa si dice: se uscisse, il bot avrebbe due
  // strade per la stessa domanda e prima o poi ne userebbe quella sbagliata — che è il modo in
  // cui questo difetto sarebbe rinato da un'altra porta.
  const uscita = src.match(/const eventi = [\s\S]{0,3000}/)?.[0] ?? src;
  assert.ok(!/^\s*origine: /m.test(uscita), '`origine` esce verso il bot: è la deduzione che questa voce esiste per togliere');
});
