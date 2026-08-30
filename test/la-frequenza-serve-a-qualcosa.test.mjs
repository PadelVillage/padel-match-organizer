// ── BANCO: la domanda 2 non è più raccolta e buttata ─────────────────────────────────
//
// 🗣️ Nasce dalla sua parola del 30/08/2026 sulla proposta ④ — *«VAi procedi e fai il lavoro»*.
//
// 📏 IL FATTO: «quante volte giochi mediamente al mese?» era chiesta a ogni socio e non serviva
//    a niente. Non pesava nel calcolo del livello (quello si sapeva), ma **non finiva nemmeno
//    dove qualcuno la potesse leggere**: la colonna `monthly_frequency` era vuota su 44 schede
//    su 44, perché la scrittura cercava una chiave che nessuno manda, e nel gestionale non
//    c'era nessun punto che la mostrasse.
//    ⇒ O le si dà un lavoro, o la domanda si toglie. Questo banco tiene fermo il lavoro.
//
// 🚨 IL CASO CHE PROTEGGE DAVVERO è il terzo: una bandiera che vive in due copie — l'edge che
//    decide e l'app che PREVEDE cosa deciderà l'edge — è il posto classico in cui le due
//    divergono, e allora il gestionale promette un'applicazione automatica che poi non arriva.
//    La gemella `experience_flag` esisteva già in tutti e quattro i posti: questa deve
//    seguirla ovunque, e «ovunque» si conta invece di ricordarselo.
//
// Uso:  node test/la-frequenza-serve-a-qualcosa.test.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { assessKey } from '../supabase/functions/assessment-quiz/conoscenza.js';

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = join(QUI, '..');
const leggi = (p) => readFileSync(join(RADICE, p), 'utf8');

let passati = 0, falliti = 0;
function caso(titolo, fn) {
  try { fn(); console.log('✅ ' + titolo); passati++; }
  catch (err) { console.log('❌ ' + titolo + '\n   → ' + (err && err.message || err)); falliti++; }
}
function esigi(condizione, messaggio) { if (!condizione) throw new Error(messaggio); }

const QUIZ = leggi('supabase/functions/assessment-quiz/index.ts');

caso('1. 🩹 la risposta finisce in COLONNA, e dalla chiave che il test manda davvero', () => {
  /* La chiave è `frequency`: è il `name` del campo nel modulo e la `chiave` in `passi.js`.
     Scrivere da `monthly_frequency` — il nome della colonna — sembrava giusto e non lo era:
     nessuno manda quel nome. 📌 Un dato che c'è e non si trova non è un dato mancante. */
  const riga = QUIZ.split('\n').find((l) => /^\s*monthly_frequency:/.test(l));
  esigi(riga, 'la riga che scrive `monthly_frequency` non c\'è più');
  esigi(/scheda\.frequency/.test(riga),
    `la colonna si scrive senza guardare \`scheda.frequency\`, che è la chiave che il modulo e ` +
    `il bot mandano davvero — la risposta resterebbe solo dentro raw_response:\n     ${riga.trim()}`);
});

caso('2. la bandiera si alza SOLO su «dichiara Intermedio o più» E «gioca 0-1 volte al mese»', () => {
  /* La regola si ESEGUE, estratta dal sorgente vero: un banco che cercasse la stringa
     proverebbe che la stringa c'è, non che la condizione fa quello che dice. */
  const i = QUIZ.indexOf('const pocaFrequenza =');
  esigi(i >= 0, '`pocaFrequenza` non esiste più in assessment-quiz/index.ts');
  const espressione = QUIZ.slice(i + 'const pocaFrequenza ='.length, QUIZ.indexOf(';', i));
  const regola = new Function('dichiarato', 'scheda', 'assessKey', `return (${espressione});`);
  const prova = (dich, freq) => !!regola(dich, { frequency: freq }, assessKey);

  esigi(prova(3.5, '0-1'), 'dichiara Intermedio e gioca 0-1: la bandiera doveva alzarsi');
  esigi(prova(7, '0-1'), 'dichiara Professionista e gioca 0-1: la bandiera doveva alzarsi');
  esigi(!prova(2.5, '0-1'), 'dichiara Base e gioca 0-1: NON si ferma nessuno — chi dichiara basso non guadagna niente');
  esigi(!prova(3.5, '2-3'), 'dichiara Intermedio e gioca 2-3 volte: la bandiera non c\'entra');
  esigi(!prova(5.5, 'Più di 10'), 'chi gioca tanto non va fermato');
  esigi(!prova(NaN, '0-1'), 'senza livello dichiarato non si alza niente');
  esigi(!prova(3.5, ''), 'senza risposta alla domanda 2 non si alza niente: il vuoto non è «0-1»');
});

caso('3. 🚨⭐ la bandiera vive in TUTTI i posti dove vive la sua gemella', () => {
  /* `experience_flag` è nominata in quattro file: l'edge che scrive la scheda, quella che
     applica il livello, quella che avvisa la segreteria, e l'app — che PREVEDE cosa deciderà
     l'edge per dire al socio se il livello si applicherà da sé. Se `frequency_flag` mancasse
     in uno solo di quei posti, quel posto direbbe una cosa che gli altri smentiscono.
     ⇒ I file non si elencano: si cercano. Un elenco scritto a mano dimentica il file nuovo, e
     chi lo scrive non se ne accorge mai. */
  const CARTELLE = ['supabase/functions', 'consumer-app'];
  const file = ['index.html'];
  const cammina = (dir) => {
    for (const nome of readdirSync(join(RADICE, dir))) {
      const p = join(dir, nome);
      if (statSync(join(RADICE, p)).isDirectory()) cammina(p);
      else if (/\.(ts|js|mjs|html)$/.test(nome)) file.push(p);
    }
  };
  CARTELLE.forEach(cammina);

  const conGemella = file.filter((p) => leggi(p).includes('experience_flag'));
  esigi(conGemella.length >= 4,
    `«experience_flag» si trova solo in ${conGemella.length} file: questo banco cerca nel posto sbagliato`);
  const orfani = conGemella.filter((p) => !leggi(p).includes('frequency_flag'));
  esigi(orfani.length === 0,
    `${orfani.length} file conoscono «experience_flag» ma non «frequency_flag» — là la bandiera ` +
    `nuova non esiste, e quel posto dirà una cosa che gli altri smentiscono:\n     ${orfani.join('\n     ')}`);
});

caso('4. la segreteria ha una frase che dice PERCHÉ, non solo che la scheda è ferma', () => {
  const avviso = leggi('supabase/functions/assessment-notify-staff/index.ts');
  const i = avviso.indexOf('frequency_flag');
  esigi(i >= 0, 'l\'avviso alla segreteria non nomina la bandiera nuova');
  const riga = avviso.slice(avviso.lastIndexOf('\n', i) + 1, avviso.indexOf('\n', i));
  esigi(/motivi\.push\(/.test(riga) && /mese/.test(riga),
    `la bandiera è nominata ma non produce un motivo leggibile:\n     ${riga.trim()}`);
});

console.log(`\n— ${passati} passati, ${falliti} falliti su ${passati + falliti} casi —`);
process.exit(falliti === 0 ? 0 : 1);
