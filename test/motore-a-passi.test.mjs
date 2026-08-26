// ── BANCO: «una domanda alla volta, e la prossima non esiste ancora» ─────────────
//
// Che cosa prova: il MOTORE A PASSI del test di livello (voce 97, 25/08/2026) — il pezzo che
// serve sia alla pagina «una alla volta» sia al test dentro Telegram, e che per questo si fa
// prima di Telegram e non dopo.
//
// ⭐ Non cerca stringhe nel sorgente: importa `passi.js` ed ESEGUE le funzioni vere. Ciò che
//    prova sono decisioni — quale domanda tocca adesso, cosa è una risposta ammessa, quando il
//    giro è finito — e le decisioni si provano facendole succedere.
//
// 🚨 LA PROVA CHE VALE PIÙ DI TUTTE È LA PARITÀ CON LA PAGINA, ed è l'unica che non si potrebbe
//    ricostruire leggendo: finché `index.html` è viva, le otto domande della scheda esistono in
//    DUE posti. E il testo delle opzioni non è un'etichetta — è il DATO: il punteggio tecnico si
//    assegna confrontando le parole (`assessmentPublicScoreFromText`). Un accento diverso da una
//    parte non si vede, non rompe niente, e cambia il livello calcolato **solo a metà dei soci**.
//    ⇒ Quando la pagina si spegnerà (terzo passo della voce 97), questa prova va tolta con lei:
//    una prova di parità vale finché esistono due cose che devono restare pari.
//
// Uso:  node test/motore-a-passi.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const QUI = dirname(fileURLToPath(import.meta.url));
const APP = join(QUI, '..', 'index.html');
const PASSI = join(QUI, '..', 'supabase', 'functions', 'assessment-quiz', 'passi.js');
const CONOSCENZA = join(QUI, '..', 'supabase', 'functions', 'assessment-quiz', 'conoscenza.js');

const P = await import(`file://${PASSI}`);
const C = await import(`file://${CONOSCENZA}`);

let falliti = 0;
function prova(nome, fn) {
  try { fn(); console.log(`✅ ${nome}`); }
  catch (err) { falliti++; console.log(`❌ ${nome}\n   ${err.message}`); }
}
function uguale(visto, atteso, che) {
  const a = JSON.stringify(visto), b = JSON.stringify(atteso);
  if (a !== b) throw new Error(`${che}: visto ${a}, atteso ${b}`);
}
function vero(condizione, che) {
  if (!condizione) throw new Error(che);
}

/** Risponde a tutto il giro passo per passo, come farebbe il bot: chiede dove siamo, risponde a
 *  QUELLA domanda, richiede. Se il motore ripetesse una domanda o ne saltasse una, il giro non
 *  finirebbe — ed è esattamente ciò che questa funzione trasforma in un rosso. */
function giroIntero(token, scegli) {
  const risposte = {};
  const visti = [];
  for (let sicurezza = 0; sicurezza < 50; sicurezza++) {
    const passo = P.passoCorrente(token, risposte);
    if (passo.finito) return { risposte, visti, passi: sicurezza };
    const d = passo.domanda;
    vero(!visti.includes(d.chiave), `la domanda ${d.chiave} è stata chiesta due volte`);
    visti.push(d.chiave);
    risposte[d.chiave] = scegli(d, passo);
  }
  throw new Error('il giro non finisce mai');
}
const primaOpzione = (d) => d.opzioni[0].valore;

console.log('\nBANCO — motore a passi del test di livello (voce 97)\n');

/* ─────────────────────────────────────────────────────────────────────────────────
   ① LA PARITÀ CON LA PAGINA — le otto domande esistono in due posti finché la pagina vive
   ───────────────────────────────────────────────────────────────────────────────── */
prova('le 8 domande della scheda dicono le stesse parole della pagina', () => {
  const html = readFileSync(APP, 'utf8');
  for (const domanda of P.SCHEDA_DOMANDE) {
    const i = html.indexOf(`name="${domanda.chiave}"`);
    vero(i >= 0, `nella pagina non c'è più il campo ${domanda.chiave}`);
    const blocco = html.slice(i, html.indexOf('</select>', i));
    // Le due domande sul livello nella pagina non hanno opzioni scritte: le riempie
    // `pmoLivelliOpzioni` dalla tabella dei livelli, che è la stessa fonte usata qui.
    if (blocco.includes('data-pmo-livelli')) {
      uguale(domanda.opzioni, P.opzioniLivelli(), `${domanda.chiave}: opzioni dai livelli`);
      continue;
    }
    const dallaPagina = [...blocco.matchAll(/<option(?![^>]*value="")[^>]*>([^<]+)<\/option>/g)]
      .map((m) => m[1].trim())
      .filter((t) => t && t !== 'Seleziona');
    /* 🔄 26/08/2026 — SI CONFRONTANO I VALORI, non le etichette, e la differenza è il senso
       stesso di questa prova. Fino a oggi le due coincidevano e il confronto poteva farsi su
       `testo` senza accorgersi di quale delle due cose stesse guardando.
       🗣️ Da oggi no: sul bot le etichette sono **accorciate apposta** (sua decisione, dopo tre
       schermate di prova), mentre il `valore` — che è il dato su cui nasce il punteggio — resta
       identico al carattere. ⇒ Confrontare le etichette renderebbe questa prova rossa su una
       differenza VOLUTA, e per farla tornare verde qualcuno riallineerebbe i testi, cioè
       disferebbe la cura.
       📌 *Due copie devono raccontare lo stesso test, non avere lo stesso aspetto.* */
    uguale(domanda.opzioni.map((o) => o.valore), dallaPagina, `${domanda.chiave}: valori`);
  }
});

/* 🗣️⭐⭐ 26/08/2026 — LE ETICHETTE STANNO SUL BOTTONE, INTERE.
   Sua decisione del pomeriggio, presa guardando quattro schermate del telefono: niente elenco
   sopra le domande, niente puntini sui bottoni. ⇒ L'unica strada che dà tutt'e due le cose è
   che le etichette siano **corte davvero**, ed è questa la prova che lo pretende.
   ⚖️ Il numero (24) è il tetto del bot meno il «N · » davanti — `ETICHETTA_SICURA = 28` in
   `assistente-padel-agent/src/telegram/test-a-passi.ts`, che a sua volta è una stima prudente
   di un limite in PIXEL (il confine visto sulle sue schermate sta fra 42 e 43 caratteri).
   🚨 Vive QUI e non solo là perché qui stanno i testi: una guardia nel bot direbbe «accorcio
   io», che è esattamente ciò che lui non vuole più vedere. */
prova('🗣️ ogni etichetta della scheda entra in un bottone Telegram, senza puntini', () => {
  const TETTO = 24;
  for (const domanda of P.SCHEDA_DOMANDE) {
    for (const o of domanda.opzioni) {
      vero(o.testo.length <= TETTO,
        `${domanda.chiave}: «${o.testo}» è di ${o.testo.length} caratteri, sul bottone si taglia`);
    }
  }
});

prova('ogni opzione tecnica ha ancora un punteggio (nessuna parola sfasata)', () => {
  /* 🚨 È la prova che coglie il refuso che la parità da sola potrebbe non cogliere — se qualcuno
     lo facesse **in tutti e due i posti**. Il punteggio si assegna cercando la frase nella
     tabella di `assessmentPublicTechnicalScores`: una parola cambiata lì in mezzo non dà
     errore, dà `null`, e un `null` non fa rumore — abbassa il livello calcolato e basta. */
  for (const chiave of ['rally', 'glass', 'net', 'overhead']) {
    const domanda = P.SCHEDA_DOMANDE.find((d) => d.chiave === chiave);
    for (const o of domanda.opzioni) {
      const punteggi = C.assessmentPublicTechnicalScores({ [chiave]: o.valore });
      vero(typeof punteggi[chiave] === 'number', `${chiave}: «${o.valore}» non vale più niente`);
    }
  }
});

/* ─────────────────────────────────────────────────────────────────────────────────
   ② UN PASSO PER VOLTA — il buco che la voce 97 chiude
   ───────────────────────────────────────────────────────────────────────────────── */
prova('esce UNA domanda alla volta, mai le quattro insieme', () => {
  const passo = P.passoCorrente('gettone-A', {});
  uguale(Object.keys(passo).sort(), ['domanda', 'finito', 'numero', 'totale', 'totale_certo'], 'forma del passo');
  vero(!Array.isArray(passo.domanda), 'la risposta contiene un ELENCO di domande');
  uguale(passo.domanda.chiave, 'experience', 'la prima domanda');
  uguale(passo.numero, 1, 'numero');
});

prova('la domanda di conoscenza non dice quale sia la trappola né la risposta giusta', () => {
  const { risposte } = giroIntero('gettone-B', (d, passo) => {
    if (!d.conoscenza) return d.chiave === 'declaredLevel' ? '5.5' : primaOpzione(d);
    // Alla prima domanda di conoscenza guardiamo cosa è uscito dal server.
    uguale(Object.keys(d).sort(), ['chiave', 'conoscenza', 'opzioni', 'testo'], `campi della domanda ${passo.numero}`);
    return primaOpzione(d);
  });
  const conoscenza = Object.keys(risposte).filter((k) => k.startsWith('k:'));
  uguale(conoscenza.length, 4, 'domande di conoscenza fatte');
});

prova('il giro finisce in 12 passi, senza ripetere e senza saltare', () => {
  const { visti, passi } = giroIntero('gettone-C', (d) => (d.chiave === 'declaredLevel' ? '3.5' : primaOpzione(d)));
  uguale(passi, 12, 'passi');
  uguale(visti.slice(0, 8), P.SCHEDA_DOMANDE.map((d) => d.chiave), 'le prime otto, in ordine');
  vero(visti.slice(8).every((k) => k.startsWith('k:')), 'le ultime quattro sono di conoscenza');
});

prova('senza cancello il giro finisce a 8, e il totale si CORREGGE invece di mentire', () => {
  // Principiante non ha cancello; Semi-Pro e Professionista non hanno quiz. In tutti e tre i
  // casi le domande sono otto — ma prima della terza risposta non lo sa nessuno.
  for (const [livello, nome] of [['1.5', 'Principiante'], ['6.5', 'Semi-Pro'], ['7', 'Professionista']]) {
    const prima = P.passoCorrente('gettone-D', { experience: 'Meno di 1 mese', frequency: '0-1' });
    uguale([prima.totale, prima.totale_certo], [12, false], 'prima della terza risposta è una previsione');
    const { passi } = giroIntero('gettone-D', (d) => (d.chiave === 'declaredLevel' ? livello : primaOpzione(d)));
    uguale(passi, 8, `${nome}: passi`);
  }
});

prova('cambiare idea sul livello a metà giro cambia le domande, e il giro finisce lo stesso', () => {
  // Le domande di conoscenza si ripescano dalla fascia dichiarata: chi torna indietro e si
  // dichiara di un'altra fascia sta rispondendo a un altro cancello, ed è giusto così.
  const base = { experience: 'Più di 1 anno', frequency: '4-6', declaredLevel: '5.5', balancedLevel: '5.5',
    rally: 'Costruisco il punto con controllo', glass: 'Lo uso per difendere e ripartire in attacco',
    net: 'Costruisco e chiudo il punto a rete', overhead: 'Uso colpi alti in modo tattico e affidabile' };
  const agonista = P.passoCorrente('gettone-E', base).domanda.chiave;
  const intermedio = P.passoCorrente('gettone-E', { ...base, declaredLevel: '3.5' }).domanda.chiave;
  vero(agonista !== intermedio, 'le due fasce pescano la stessa domanda');
});

/* ─────────────────────────────────────────────────────────────────────────────────
   ③ COSA SI PUÒ RISPONDERE — la porta che tiene fuori le risposte inventate
   ───────────────────────────────────────────────────────────────────────────────── */
prova('si accetta solo un\'opzione offerta, e torna scritta come sta nella banca', () => {
  const d = P.SCHEDA_DOMANDE.find((x) => x.chiave === 'net');
  uguale(P.valoreAmmesso(d, 'Gioco volée semplici'), 'Gioco volée semplici', 'esatta');
  uguale(P.valoreAmmesso(d, '  gioco volee SEMPLICI '), 'Gioco volée semplici', 'accenti e spazi si perdonano, il valore no');
  uguale(P.valoreAmmesso(d, 'Chiudo tutto'), '', 'inventata');
  uguale(P.valoreAmmesso(d, ''), '', 'vuota');
  uguale(P.valoreAmmesso(null, 'Sto poco a rete'), '', 'senza domanda');
});

prova('si può rispondere anche col NUMERO DEL BOTTONE, ed è come risponde Telegram', () => {
  const d = P.SCHEDA_DOMANDE.find((x) => x.chiave === 'glass');
  uguale(P.valoreDaIndice(d, 0), 'Evito quasi sempre il vetro', 'primo bottone');
  uguale(P.valoreDaIndice(d, 4), 'Lo uso per difendere e ripartire in attacco', 'ultimo bottone');
  uguale(P.valoreDaIndice(d, 5), '', 'un bottone che non c\'è');
  uguale(P.valoreDaIndice(d, -1), '', 'indice negativo');
  uguale(P.valoreDaIndice(d, '2'), 'Difendo con il vetro in modo base', 'numero arrivato come testo');
  uguale(P.valoreDaIndice(d, 1.5), '', 'mezzo bottone non esiste');
  uguale(P.valoreDaIndice(d, null), '', 'niente');
  uguale(P.valoreDaIndice(null, 0), '', 'senza domanda');
});

prova('il livello si risponde col NUMERO della scala, non con la parola', () => {
  const d = P.SCHEDA_DOMANDE.find((x) => x.chiave === 'declaredLevel');
  uguale(P.valoreAmmesso(d, '5.5'), '5.5', 'numero');
  uguale(P.valoreAmmesso(d, 'Agonista'), '', 'la sola parola non basta');
  uguale(d.opzioni.map((o) => o.valore), C.PMO_LIVELLI.map((f) => String(f.max)), 'la scala intera');
});

/* ─────────────────────────────────────────────────────────────────────────────────
   ④ IL RICONGIUNGIMENTO — una scheda fatta a passi è la stessa di una fatta a modulo
   ───────────────────────────────────────────────────────────────────────────────── */
prova('la scheda costruita a passi ha le stesse chiavi che manda la pagina', () => {
  const { risposte } = giroIntero('gettone-F', (d) => (d.chiave === 'declaredLevel' ? '3.5' : primaOpzione(d)));
  const scheda = P.schedaDaRisposte(risposte, { first_name: 'Laura', last_name: 'Aprea' });
  for (const d of P.SCHEDA_DOMANDE) vero(scheda[d.chiave] === risposte[d.chiave], `manca ${d.chiave}`);
  vero(!Object.keys(scheda).some((k) => k.startsWith('k:')), 'le risposte del quiz sono finite nella scheda');
  uguale([scheda.first_name, scheda.last_name, scheda.gender], ['Laura', 'Aprea', ''], 'anagrafica');
});

prova('il livello calcolato è lo STESSO che darebbe il modulo', () => {
  // Le stesse risposte, una volta passate dal motore e una volta scritte a mano come le manda
  // la pagina: se i due livelli divergessero, un socio avrebbe un livello diverso a seconda di
  // dove ha risposto — ed è il difetto peggiore che questo lavoro possa produrre.
  const daModulo = {
    experience: 'Più di 1 anno', frequency: '4-6', declaredLevel: '3.5', balancedLevel: '3.5',
    rally: 'Tengo scambi regolari con continuità', glass: 'Difendo con il vetro in modo base',
    net: 'Gioco volée semplici', overhead: 'Uso almeno la bandeja in modo semplice',
  };
  const aPassi = P.schedaDaRisposte(daModulo, { first_name: 'Laura', last_name: 'Aprea' });
  uguale(
    C.calculateAssessmentPublicLevel(aPassi).calculated_level,
    C.calculateAssessmentPublicLevel(daModulo).calculated_level,
    'livello calcolato',
  );
});

prova('le risposte di conoscenza si separano dal resto, e la correzione le riconosce', () => {
  const { risposte } = giroIntero('gettone-G', (d) => (d.chiave === 'declaredLevel' ? '3.5' : primaOpzione(d)));
  const soloQuiz = P.risposteConoscenza(risposte);
  const pescate = C.pescaPerGettone('gettone-G', 'Intermedio');
  uguale(Object.keys(soloQuiz).sort(), pescate.map((p) => p.id).sort(), 'gli id sono quelli pescati');
  const esito = C.assessKnowledgeEvaluate(pescate.map((p) => p.id), soloQuiz, 'Intermedio');
  uguale(esito.total, 4, 'domande corrette dal server');
  vero(['pass', 'fail'].includes(esito.status), 'esito riconosciuto');
});

prova('il nome si spezza come lo spezza la pagina', () => {
  uguale(P.nomeSpezzato('Laura Aprea'), { first_name: 'Laura', last_name: 'Aprea' }, 'due parole');
  uguale(P.nomeSpezzato('Maria Grazia De Luca'), { first_name: 'Maria', last_name: 'Grazia De Luca' }, 'quattro parole');
  uguale(P.nomeSpezzato('  Marco  '), { first_name: 'Marco', last_name: '' }, 'una sola');
  uguale(P.nomeSpezzato(null), { first_name: '', last_name: '' }, 'niente');
});

/* ─────────────────────────────────────────────────────────────────────────────────
   ⑤ SABOTAGGI — un banco che non cade quando si rompe il codice non prova niente
   ───────────────────────────────────────────────────────────────────────────────── */
prova('SABOTAGGIO: se una domanda smettesse di contare come «risposta», il giro non finirebbe', () => {
  // Si simula il difetto più probabile di questo motore — una risposta salvata con una chiave
  // che il passo dopo non riconosce — e si pretende che il banco lo VEDA.
  const risposte = {};
  let esploso = false;
  try {
    for (let i = 0; i < 20; i++) {
      const passo = P.passoCorrente('gettone-H', risposte);
      if (passo.finito) break;
      risposte[`sbagliata:${passo.domanda.chiave}`] = primaOpzione(passo.domanda); // chiave storpiata
    }
  } catch { esploso = true; }
  const passo = P.passoCorrente('gettone-H', risposte);
  vero(!esploso && !passo.finito && passo.numero === 1, 'con le chiavi storpiate il giro risulterebbe avanzato');
});

prova('SABOTAGGIO: una risposta fuori elenco non entra nella scheda', () => {
  const d = P.SCHEDA_DOMANDE.find((x) => x.chiave === 'rally');
  const finta = 'Costruisco il punto con controllo assoluto'; // somiglia, non è
  uguale(P.valoreAmmesso(d, finta), '', 'la quasi-uguale passa');
  const scheda = P.schedaDaRisposte({ rally: P.valoreAmmesso(d, finta) }, {});
  uguale(scheda.rally, '', 'la scheda ha preso una risposta mai offerta');
});

/* ─────────────────────────────────────────────────────────────────────────────────
   ⑥ IL TRONCAMENTO DI TELEGRAM — le opzioni sono BOTTONI, e un bottone si accorcia
   ───────────────────────────────────────────────────────────────────────────────── */
/* 📏 MISURATO il 26/08/2026, e la scheda della 97 guardava il posto sbagliato. La paura
   dichiarata erano le due domande sul livello (49 caratteri, le più lunghe): sono invece le
   PIÙ AL SICURO — le sette fasce si separano al terzo carattere. Il caso stretto è `rally`,
   dove quattro opzioni su cinque cominciano per «Tengo»/«Faccio» e servono **14 caratteri**
   perché diventino diverse.
   ⇒ Il taglio si dichiara a 20: sotto quella soglia nessun client di Telegram accorcia un
   bottone a riga piena, e sopra c'è il margine per una domanda scritta domani.
   🚨 Non prova che il testo si LEGGA per intero — quello si vede solo su un telefono, e resta
   da guardare. Prova la cosa che conta di più: che chi legge un'etichetta accorciata non possa
   ritrovarsi due opzioni **identiche** e scegliere a caso. */
const TAGLIO_TELEGRAM = 20;
prova(`le opzioni restano DISTINTE anche accorciate a ${TAGLIO_TELEGRAM} caratteri`, () => {
  for (const d of P.SCHEDA_DOMANDE) {
    const tagliate = d.opzioni.map((o) => o.testo.slice(0, TAGLIO_TELEGRAM));
    vero(
      new Set(tagliate).size === d.opzioni.length,
      `la domanda ${d.chiave} ha due opzioni che accorciate diventano uguali: ${tagliate.join(' / ')}`,
    );
  }
});

prova('SABOTAGGIO: due opzioni che si separano troppo tardi verrebbero VISTE', () => {
  const finta = { chiave: 'finta', opzioni: [
    { valore: 'a', testo: 'Uso bandeja e smash in modo semplice' },
    { valore: 'b', testo: 'Uso bandeja e smash in modo tattico' }, // si separano al 27°
  ] };
  const tagliate = finta.opzioni.map((o) => o.testo.slice(0, TAGLIO_TELEGRAM));
  uguale(new Set(tagliate).size, 1, 'il taglio dichiarato non le fonde: la prova sopra non proverebbe niente');
});

/* 🗣️⭐⭐ 26/08/2026 — IL CONTO DELLE DOMANDE SI PUÒ CHIEDERE PRIMA CHE IL TEST COMINCI.
   Sua richiesta: *«sin dall'inizio deve dire che sono 12 domande»*. L'invito parte quando di
   risposte non ce n'è nessuna, quindi il numero non può venire dal passo: `passi.js` lo
   espone, `consumer-assessment-link` lo legge di qui e lo manda al bot.
   🔒 Vive in UNA fonte per una ragione precisa: il giorno in cui una domanda si aggiunge o si
   toglie, la frase dell'invito cambia da sé. Un numero copiato nell'edge sarebbe diventato
   falso in silenzio, e solo per chi legge l'invito. */
prova('🗣️ il conto previsto è quello VERO, e coincide col totale del primo passo', () => {
  uguale(P.domandeTotaliPreviste(), P.SCHEDA_DOMANDE.length + 4, 'il conto non nasce dalle domande');
  // 🚨 La cosa che conta non è che faccia 12: è che dica lo STESSO numero del primo passo.
  //    Se le due divergessero, il socio leggerebbe «sono 12 domande» e poi «Domanda 1 di 14».
  const primo = P.passoCorrente('gettone-conto', {});
  uguale(primo.totale, P.domandeTotaliPreviste(), 'l\'invito e il primo passo direbbero numeri diversi');
  vero(primo.totale_certo === false, 'prima della fascia il totale è una previsione');
});

prova('🚨 CABLAGGIO: l\'edge del link chiede il conto QUI, invece di ricopiarlo', () => {
  /* ⭐ Senza questo caso il numero potrebbe essere copiato nell'edge e nessuno se ne
     accorgerebbe finché le domande non cambiano — cioè quando è troppo tardi. */
  const edge = readFileSync(join(QUI, '..', 'supabase', 'functions', 'consumer-assessment-link', 'index.ts'), 'utf8');
  vero(/import \{ domandeTotaliPreviste \} from '\.\.\/assessment-quiz\/passi\.js'/.test(edge),
    'l\'edge non importa il conto da passi.js');
  vero(/domande_totali: domandeTotaliPreviste\(\)/.test(edge),
    'l\'edge non manda `domande_totali`, o lo calcola per conto suo');
  const senzaCommenti = edge
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map((r) => r.replace(/(^|[^:'"`])\/\/.*$/, '$1')).join('\n');
  vero(!/domande_totali:\s*\d+/.test(senzaCommenti), 'c\'è un numero di domande scritto a mano nell\'edge');
});

console.log(`\n— ${falliti ? `${falliti} prove ROSSE` : 'tutte le prove verdi'} —\n`);
process.exit(falliti ? 1 : 0);
