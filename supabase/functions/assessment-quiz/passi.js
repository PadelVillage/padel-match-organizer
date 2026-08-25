/* passi.js — IL MOTORE A PASSI del test di livello (voce 97, 25/08/2026).
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * 🚨 IL BUCO CHE CHIUDE, ed è l'unico motivo per cui questo file esiste.
 *
 * Fino a oggi il test è «tutto in una consegna»: la pagina chiede `pesca`, riceve **le quattro
 * domande di conoscenza insieme**, le disegna, e manda le dodici risposte in blocco. ⇒ Chi fa
 * il test può **leggersele tutte prima** di rispondere alla prima — cercarle, chiederle a
 * qualcuno, aprirle in un'altra scheda. La risposta giusta non esce dal server (voce 27), ma la
 * DOMANDA sì, e tutte in una volta: il tempo per cercare è la vulnerabilità che resta.
 *
 * ⭐ La cura non è un cronometro — è **non dare la domanda dopo finché non è arrivata la
 * risposta a quella prima**. Un passo per volta, e lo stato di chi è a metà lo tiene il
 * gestionale, non il telefono e non il bot.
 *
 * 🎯 E serve a DUE cose insieme, che è la ragione per cui si fa prima questa e poi Telegram
 * (voce 97): la pagina «una domanda alla volta» e il test **dentro il bot** hanno bisogno
 * esattamente della stessa cosa nuova — un'edge che sappia dire *«questa è la prossima
 * domanda»* e *«questa risposta è arrivata»*. Costruirle separate sarebbe farlo due volte.
 *
 * 🔒 DOVE VIVE LA VERITÀ: qui. Le domande, il loro ordine, cosa è una risposta ammessa e quando
 * il giro è finito lo decide il gestionale. Il bot (o la pagina) mostra e riporta — *il
 * gestionale SA, il bot DICE*. Il giorno in cui la pagina si spegne, questo file non si tocca.
 *
 * 🧪 È un MODULO puro e senza database apposta: il banco lo importa ed esegue le funzioni vere
 * (`test/motore-a-passi.test.mjs`), invece di cercarne le stringhe nel sorgente.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import {
  PMO_LIVELLI,
  assessKey,
  assessTxt,
  fasciaDaLivello,
  pescaPerGettone,
} from './conoscenza.js';

/* Le opzioni delle due domande sul livello: le stesse che la pagina disegna da `PMO_LIVELLI`
   (`pmoLivelliOpzioni`, index.html) — il socio legge le parole, il modulo tiene il numero.
   ⚠️ `value: String(f.max)` non è una scelta di questo file: è la forma che il resto della
   catena già si aspetta (`declared_level`, il tetto, la coerenza). Cambiarla qui la
   cambierebbe solo per metà dei soci. */
export function opzioniLivelli() {
  return PMO_LIVELLI.map((f) => ({ valore: String(f.max), testo: `${f.definizione} — ${f.colpi}` }));
}

function scelte(lista) {
  return lista.map((t) => ({ valore: t, testo: t }));
}

/* ═══ LE OTTO DOMANDE DELLA SCHEDA ═══════════════════════════════════════════════════════
   🚨 IL TESTO DELLE OPZIONI È IL DATO, non un'etichetta: `assessmentPublicTechnicalScores`
   assegna il punteggio **confrontando le parole** (`assessmentPublicScoreFromText`). Cambiare
   «Gioco volée semplici» in «Gioco volee semplici» non cambia una scritta: cambia il livello
   calcolato, in silenzio, e solo per chi risponde da qui.
   ⇒ Per questo `test/motore-a-passi.test.mjs` confronta queste otto domande con i `<select>`
   veri di `index.html`, uno per uno. Finché la pagina è viva ci sono DUE copie, e una prova di
   parità è l'unica cosa che impedisce alle due di raccontare test diversi.
   📌 La chiave (`chiave`) è il `name` del campo nel modulo: è ciò che rende la scheda costruita
   qui **indistinguibile** da quella costruita dalla pagina. */
export const SCHEDA_DOMANDE = [
  {
    chiave: 'experience',
    testo: 'Da quanto giochi a padel?',
    opzioni: scelte(['Meno di 1 mese', '1-3 mesi', '3-6 mesi', '6-12 mesi', 'Più di 1 anno', 'Più di 3 anni']),
  },
  {
    chiave: 'frequency',
    testo: 'Quante volte giochi mediamente al mese?',
    opzioni: scelte(['0-1', '2-3', '4-6', '7-10', 'Più di 10']),
  },
  { chiave: 'declaredLevel', testo: 'Che livello pensi di avere?', opzioni: opzioniLivelli() },
  { chiave: 'balancedLevel', testo: 'Con quali giocatori fai partite equilibrate?', opzioni: opzioniLivelli() },
  {
    chiave: 'rally',
    testo: 'Riesci a mantenere lo scambio?',
    opzioni: scelte([
      'Faccio fatica a tenere 3-4 colpi',
      'Tengo lo scambio solo a ritmo lento',
      'Tengo scambi regolari con continuità',
      'Tengo scambi anche con ritmo alto',
      'Costruisco il punto con controllo',
    ]),
  },
  {
    chiave: 'glass',
    testo: 'Come gestisci il vetro in difesa?',
    opzioni: scelte([
      'Evito quasi sempre il vetro',
      'Lo uso solo se la palla è facile',
      'Difendo con il vetro in modo base',
      'Lo uso con continuità anche sotto pressione',
      'Lo uso per difendere e ripartire in attacco',
    ]),
  },
  {
    chiave: 'net',
    testo: 'A rete come ti comporti?',
    opzioni: scelte([
      'Sto poco a rete',
      'Vado a rete ma faccio fatica a chiudere',
      'Gioco volée semplici',
      'Tengo posizione e controllo le volée',
      'Costruisco e chiudo il punto a rete',
    ]),
  },
  {
    chiave: 'overhead',
    testo: 'Bandeja / vibora / smash',
    opzioni: scelte([
      'Non li uso',
      'Li provo ma con poca sicurezza',
      'Uso almeno la bandeja in modo semplice',
      'Uso bandeja e smash con controllo',
      'Uso colpi alti in modo tattico e affidabile',
    ]),
  },
];

/** La chiave con cui una domanda di conoscenza vive dentro le risposte. Il prefisso serve a
 *  tenerle separate dai campi della scheda senza doverne tenere l'elenco da nessuna parte. */
export function chiaveConoscenza(id) {
  return `k:${assessTxt(id)}`;
}
export function idDaChiaveConoscenza(chiave) {
  const c = assessTxt(chiave);
  return c.startsWith('k:') ? c.slice(2) : '';
}

/* Le quattro domande di conoscenza del giro, se già si sa quale fascia guardare.
   🚨 Si RIPESCANO col gettone, non si salvano: stesso gettone e stessa fascia ⇒ stesse quattro
   domande, senza una riga di stato in più da tenere pulita (è la scelta della voce 27, e qui
   torna utile una seconda volta — chi cambia idea sul livello a metà giro si ritrova domande
   diverse, ed è giusto così: sta rispondendo a un'altra fascia).
   ⛔ `trap` NON esce: dire quale delle quattro è la trappola è mezza risposta regalata. */
function domandeConoscenza(token, risposte) {
  const fascia = fasciaDaLivello((risposte || {}).declaredLevel);
  if (!fascia) return [];
  return pescaPerGettone(assessTxt(token), fascia).map((d) => ({
    chiave: chiaveConoscenza(d.id),
    testo: d.q,
    opzioni: scelte(d.opts),
    conoscenza: true,
  }));
}

/** Tutte le domande del giro, nell'ordine in cui si fanno: prima la scheda, poi il cancello. */
export function domandeDelGiro(token, risposte) {
  return SCHEDA_DOMANDE.concat(domandeConoscenza(token, risposte));
}

/**
 * DOVE SIAMO. Restituisce la prima domanda senza risposta, oppure `finito`.
 *
 * ⚠️ IL TOTALE PUÒ SCENDERE, ed è voluto: finché il livello non è dichiarato non si sa se quel
 * socio avrà il cancello (Principiante non ce l'ha, Semi-Pro e Professionista nemmeno) ⇒ prima
 * della terza domanda il totale è una **previsione** (8 + 4), dopo è un fatto. Meglio un numero
 * che si corregge di uno che promette dodici passi a chi ne farà otto.
 */
export function passoCorrente(token, risposte) {
  const date = risposte || {};
  const domande = domandeDelGiro(token, date);
  const conFascia = !!assessTxt(date.declaredLevel);
  const totale = conFascia ? domande.length : SCHEDA_DOMANDE.length + 4;

  for (let i = 0; i < domande.length; i++) {
    const d = domande[i];
    if (assessTxt(date[d.chiave])) continue;
    return {
      finito: false,
      numero: i + 1,
      totale,
      totale_certo: conFascia,
      domanda: { chiave: d.chiave, testo: d.testo, opzioni: d.opzioni, conoscenza: !!d.conoscenza },
    };
  }
  return { finito: true, numero: domande.length, totale: domande.length, totale_certo: true, domanda: null };
}

/**
 * La risposta è ammessa? Torna il valore **canonico** (quello dell'opzione), non quello
 * arrivato: così una differenza di accento o di spazi non entra nella scheda, dove le parole
 * sono il dato.
 * 🔒 Fallisce chiusa: fuori dalle opzioni offerte non passa niente. Non è pignoleria — è ciò
 * che impedisce di scriversi da sé «Costruisco il punto con controllo» senza averlo scelto.
 */
export function valoreAmmesso(domanda, valore) {
  const v = assessTxt(valore);
  if (!domanda || !v) return '';
  const trovata = (domanda.opzioni || []).find((o) => assessKey(o.valore) === assessKey(v));
  return trovata ? trovata.valore : '';
}

/** Le sole risposte di conoscenza, nella forma che `assessKnowledgeEvaluate` si aspetta. */
export function risposteConoscenza(risposte) {
  const out = {};
  for (const [chiave, valore] of Object.entries(risposte || {})) {
    const id = idDaChiaveConoscenza(chiave);
    if (id) out[id] = assessTxt(valore);
  }
  return out;
}

/**
 * La SCHEDA da consegnare, costruita con le stesse chiavi che manda la pagina
 * (`buildAssessmentPublicPayload`): `experience`, `frequency`, `declaredLevel`, `balancedLevel`,
 * `rally`, `glass`, `net`, `overhead`, più nome e sesso.
 * ⭐ È il punto in cui le due strade si ricongiungono: da qui in poi una scheda fatta a passi e
 * una fatta dalla pagina sono **la stessa cosa**, e la correzione, il livello e il cancello
 * sono un codice solo. Nessuna regola vive in due versioni.
 */
export function schedaDaRisposte(risposte, anagrafica) {
  const date = risposte || {};
  const chi = anagrafica || {};
  const scheda = {};
  for (const d of SCHEDA_DOMANDE) scheda[d.chiave] = assessTxt(date[d.chiave]);
  scheda.first_name = assessTxt(chi.first_name);
  scheda.last_name = assessTxt(chi.last_name);
  // Il sesso non si chiede: lo legge il server dalla scheda socio (voce 84 ⓑ). Qui resta
  // vuoto di proposito — `consegna` lo ripesca, ed è l'unico posto in cui deve saperlo fare.
  scheda.gender = assessTxt(chi.gender);
  scheda.source = 'bot-a-passi';
  scheda.origin = 'bot-a-passi';
  return scheda;
}

/** Nome e cognome dal `member_name` del gettone, con la stessa spaccatura della pagina. */
export function nomeSpezzato(nomeIntero) {
  const parti = assessTxt(nomeIntero).split(/\s+/).filter(Boolean);
  if (!parti.length) return { first_name: '', last_name: '' };
  if (parti.length === 1) return { first_name: parti[0], last_name: '' };
  return { first_name: parti[0], last_name: parti.slice(1).join(' ') };
}
