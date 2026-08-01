// Rete di prova della logica di `bot-telegram-admin`.
// Si lancia con:  cd supabase/functions/bot-telegram-admin && deno test --allow-none logica.test.ts
// (oppure `deno test` dalla cartella: non serve nessun permesso, sono funzioni pure).

import { assertEquals } from 'jsr:@std/assert';
import {
  ambienteDa,
  componiInvito,
  componiPersona,
  indicizzaSoci,
  livelloLeggibile,
  REF_PROD,
  statoInvito,
  trovaSocio,
  vedeLaSezione,
  type InvitiPerToken,
  type RigaInvito,
  type RigaOperatore,
} from './logica.ts';

// 🚨⭐⭐ I dati finti hanno la forma che la PRODUZIONE ha davvero, e la forma vera qui è
// che il `memberId` in anagrafica **c'è quasi sempre**: solo che per due persone su tre è
// un `PMO-…` messo da noi, non un codice del circolo. Un finto con la casella vuota
// («tanto è un test») farebbe coincidere i due rami e cancellerebbe dalla misura proprio
// quello che gira sul telefono della gente → metodo-il-caso-reale-non-discrimina (29ª).
const SOCI = indicizzaSoci([
  { payload: { id: 'sch-mau', memberId: '000004', firstName: 'Maurizio', surname: 'Aprea', phone: '+39 333 1112223', level: '3' } },
  { payload: { id: 'sch-luca', memberId: '000029', firstName: 'Luca', surname: 'Allera', phone: '', level: '0.5' } },
  { payload: { id: 'sch-sheila', memberId: '000760', name: 'Sheila Zaccaron', phone: '3401234567', level: '2.5', selfAssessmentDate: '2026-07-01' } },
  // Le due forme del «senza codice»: il segnaposto `PMO-…` e la casella vuota.
  { payload: { id: 'sch-giuliano', memberId: 'PMO-000060', firstName: 'Giuliano', surname: 'Dal Cin', phone: '+39 347 7654321', level: '0.5' } },
  { payload: { id: 'matchpoint_n29tlt', memberId: '', firstName: 'Chiara', surname: 'Abbiati', phone: '3382910997', level: '0.5' } },
]);

// ── l'ambiente ───────────────────────────────────────────────────────────────

Deno.test('ambiente: prod SOLO se l’indirizzo è quello di produzione', () => {
  assertEquals(ambienteDa(`https://${REF_PROD}.supabase.co`), 'prod');
  assertEquals(ambienteDa('https://cudiqnrrlbyqryrtaprd.supabase.co'), 'test');
});

Deno.test('ambiente: indirizzo vuoto o sconosciuto NON diventa mai prod', () => {
  // Il verso del dubbio: un errore di configurazione deve far finire sull'ambiente
  // dove non si tocca il bot vero, mai il contrario.
  assertEquals(ambienteDa(''), 'test');
  assertEquals(ambienteDa('https://esempio.example.com'), 'test');
});

// ── chi vede la sezione ──────────────────────────────────────────────────────

Deno.test('permesso: owner e admin vedono sempre', () => {
  assertEquals(vedeLaSezione('owner', { view_admin_telegram: false }), true);
  assertEquals(vedeLaSezione('admin', { view_admin_telegram: false }), true);
});

Deno.test('permesso: profilo senza nessuna configurazione = retrocompatibilità, vede', () => {
  assertEquals(vedeLaSezione('collaboratore', {}), true);
  assertEquals(vedeLaSezione('collaboratore', null), true);
  assertEquals(vedeLaSezione('collaboratore', { manage_users: true }), true);
});

Deno.test('permesso: con una configurazione presente, la voce spuntata via CHIUDE', () => {
  assertEquals(vedeLaSezione('collaboratore', { view_dashboard: true, view_admin_telegram: false }), false);
  assertEquals(vedeLaSezione('collaboratore', { view_dashboard: true, view_admin_telegram: true }), true);
  // Chiave assente ma configurazione presente: come le altre sezioni nuove, resta visibile.
  assertEquals(vedeLaSezione('collaboratore', { view_dashboard: true }), true);
});

Deno.test('permesso: chiuso il capitolo Amministrazione, è chiusa anche la sezione', () => {
  // Senza questo controllo si entrerebbe in una sotto-sezione di un capitolo negato.
  assertEquals(vedeLaSezione('collaboratore', { view_administration: false, view_admin_telegram: true }), false);
});

// ── il livello, scritto senza mentire ────────────────────────────────────────

Deno.test('livello: 0.5 è dichiarato per quello che è, un valore di partenza', () => {
  assertEquals(livelloLeggibile('0.5'), '0.5 · valore di partenza');
  assertEquals(livelloLeggibile('3'), '3');
  assertEquals(livelloLeggibile('2,5'), '2.5');
  assertEquals(livelloLeggibile(''), '—');
  assertEquals(livelloLeggibile('2.5', true), '2.5 · autovalutato');
});

// ── la riga di una persona ───────────────────────────────────────────────────

const OPERATORE: RigaOperatore = {
  chat_id: 1256773674,
  member_id: '000004',
  persona_id: 'sch-mau',
  telefono_chiave: null,
  etichetta: 'Maurizio Aprea (committente)',
  attivo: true,
  ambiente: 'prod',
  created_at: '2026-07-25T08:27:04Z',
  invitato_da_member_id: null,
  invito_token: null,
};

/** La riga che il bot scrive dal passo 1b per chi al circolo NON è cliente:
 *  `member_id` nullo, il cassetto intestato al numero di scheda, la chiave del telefono. */
const SENZA_CODICE: RigaOperatore = {
  chat_id: 555000111,
  member_id: null,
  persona_id: 'sch-giuliano',
  telefono_chiave: '3477654321',
  etichetta: 'Giuliano Dal Cin',
  attivo: true,
  ambiente: 'prod',
  created_at: '2026-08-02T09:10:00Z',
  invitato_da_member_id: '000004',
  invito_token: 'tok-uno',
};

Deno.test('persona: nome, telefono e livello arrivano dall’anagrafica del gestionale', () => {
  const p = componiPersona(OPERATORE, SOCI);
  assertEquals(p.nome, 'Maurizio Aprea');
  assertEquals(p.telefono, '+39 333 1112223');
  assertEquals(p.livello, '3');
  assertEquals(p.schedaTrovata, true);
  assertEquals(p.chatId, '1256773674');
  assertEquals(p.attivo, true);
  assertEquals(p.senzaCodice, false);
});

Deno.test('persona: senza scheda si mostra l’etichetta del bot e si DICHIARA che manca', () => {
  const p = componiPersona({ ...OPERATORE, member_id: '999999', persona_id: null }, SOCI);
  assertEquals(p.nome, 'Maurizio Aprea (committente)');
  assertEquals(p.schedaTrovata, false);
  assertEquals(p.livello, '—');
});

Deno.test('persona: senza scheda e senza etichetta resta il codice, mai una riga vuota', () => {
  const p = componiPersona({ ...OPERATORE, member_id: '999999', persona_id: null, etichetta: null }, SOCI);
  assertEquals(p.nome, 'socio 999999');
  assertEquals(p.schedaTrovata, false);
});

Deno.test('persona: «chi l’ha invitata» si risolve in un nome', () => {
  const p = componiPersona({ ...OPERATORE, invitato_da_member_id: '000029' }, SOCI);
  assertEquals(p.invitatoDa, 'Luca Allera');
  assertEquals(p.invitatoDaMemberId, '000029');
});

Deno.test('persona: invitante senza scheda NON diventa un trattino — resta il codice', () => {
  // «Chi ha invitato chi» è la difesa più forte del progetto: perdere quel nome
  // per una scheda mancante renderebbe la traccia muta proprio dove serve.
  const p = componiPersona({ ...OPERATORE, invitato_da_member_id: '123456' }, SOCI);
  assertEquals(p.invitatoDa, 'socio 123456');
});

Deno.test('persona: chi non è stato invitato da nessuno non inventa un invitante', () => {
  const p = componiPersona(OPERATORE, SOCI);
  assertEquals(p.invitatoDa, '');
  assertEquals(p.viaInvito, false);
});

// ── il passo 1b: chi al circolo non è cliente ────────────────────────────────

Deno.test('senza codice: la scheda si trova lo stesso, per NUMERO DI SCHEDA', () => {
  // Il difetto che questo caso sorveglia: cercando solo per codice, le 1.722 persone
  // senza codice comparirebbero tutte come «scheda non trovata», cioè come un guasto.
  const p = componiPersona(SENZA_CODICE, SOCI);
  assertEquals(p.schedaTrovata, true);
  assertEquals(p.nome, 'Giuliano Dal Cin');
  assertEquals(p.telefono, '+39 347 7654321');
  assertEquals(p.livello, '0.5 · valore di partenza');
});

Deno.test('senza codice: si DICHIARA, ed è il fatto che dice «da Telegram non prenota»', () => {
  assertEquals(componiPersona(SENZA_CODICE, SOCI).senzaCodice, true);
  assertEquals(componiPersona(OPERATORE, SOCI).senzaCodice, false);
});

Deno.test('senza codice: un PMO-… in anagrafica NON è un codice del circolo', () => {
  // Controllo opposto del precedente: la persona HA un `memberId` scritto in anagrafica,
  // e se lo si prendesse per buono il pannello direbbe che può prenotare. Non può.
  assertEquals(componiPersona(SENZA_CODICE, SOCI).memberId, '');
  assertEquals(componiPersona(SENZA_CODICE, SOCI).senzaCodice, true);
});

Deno.test('🚪⭐⭐ quando il circolo la attiva, il pannello lo vede SUBITO', () => {
  // 🚨 Il caso che nasce dal percorso normale: la persona va in segreteria, il circolo la
  // crea, l'anagrafica prende il codice — e la riga del bot resta quella di allora.
  // Se «senza codice» si leggesse dalla riga, questo pannello direbbe «senza codice» per
  // sempre di una persona che da ieri prenota benissimo. Si legge dall'anagrafica, che è
  // ciò che il bot richiede al circolo prima di rifiutare (fix del 1/08/2026).
  const soci = indicizzaSoci([
    { payload: { id: 'sch-giuliano', memberId: '001234', firstName: 'Giuliano', surname: 'Dal Cin', phone: '+39 347 7654321', level: '0.5' } },
  ]);
  const p = componiPersona(SENZA_CODICE, soci);
  assertEquals(p.senzaCodice, false);
  assertEquals(p.memberId, '001234');
});

Deno.test('🚨 CONTROLLO OPPOSTO: la riga del bot vale come RIPIEGO, non si butta via', () => {
  // Se contasse solo l'anagrafica, una persona la cui scheda non si trova — ma che nella
  // riga del bot il codice ce l'ha — comparirebbe come «senza codice» pur prenotando
  // benissimo. Le due fonti si sommano: basta che UNA delle due abbia un codice vero.
  const vuota = indicizzaSoci([]);
  const p = componiPersona(OPERATORE, vuota);
  assertEquals(p.schedaTrovata, false);
  assertEquals(p.senzaCodice, false);
  assertEquals(p.memberId, '000004');
});

Deno.test('senza codice: chi non ha il codice da NESSUNA delle due parti resta segnato', () => {
  const p = componiPersona({ ...SENZA_CODICE, persona_id: 'sch-ignota' }, SOCI);
  assertEquals(p.senzaCodice, true);
  assertEquals(p.memberId, '');
});

Deno.test('senza codice: chi INVITA senza codice non diventa «riga messa a mano»', () => {
  // La guardia registra chi ha invitato solo per codice: se l'invitante non ce l'ha,
  // quella colonna resta vuota e il pannello direbbe che nessuno l'ha invitata —
  // cancellando la traccia su cui posa tutta la sicurezza del progetto.
  const inviti: InvitiPerToken = new Map([['tok-due', {
    ...INVITO,
    token: 'tok-due',
    invitante_member_id: null,
    invitante_persona_id: 'sch-giuliano',
  }]]);
  const p = componiPersona(
    { ...SENZA_CODICE, chat_id: 555000222, invitato_da_member_id: null, invito_token: 'tok-due' },
    SOCI,
    inviti,
  );
  assertEquals(p.viaInvito, true);
  assertEquals(p.invitatoDa, 'Giuliano Dal Cin');
});

Deno.test('senza codice: un invito che non si ritrova NON si traveste da «messa a mano»', () => {
  // La lista degli inviti è tagliata a 200: di una riga vecchia il token può non esserci
  // più. «Non so chi» e «nessuno» sono due cose diverse, e la seconda sarebbe falsa.
  const p = componiPersona(
    { ...SENZA_CODICE, invitato_da_member_id: null, invito_token: 'tok-perduto' },
    SOCI,
  );
  assertEquals(p.viaInvito, true);
  assertEquals(p.invitatoDa, '—');
});

Deno.test('senza codice: la chiave del telefono resta leggibile, è l’unico appiglio', () => {
  // Senza codice e senza scheda trovata non c'è altro con cui riconoscere la persona.
  const p = componiPersona({ ...SENZA_CODICE, persona_id: 'sch-ignota' }, SOCI);
  assertEquals(p.schedaTrovata, false);
  assertEquals(p.telefonoChiave, '3477654321');
  assertEquals(p.nome, 'Giuliano Dal Cin');
});

// ── lo stato di un invito ────────────────────────────────────────────────────

const ADESSO = new Date('2026-07-31T18:00:00Z');
const INVITO: RigaInvito = {
  token: 'tdF4MbfW1234',
  ambiente: 'prod',
  invitante_member_id: '000004',
  invitante_persona_id: 'sch-mau',
  invitante_etichetta: null,
  partita: null,
  creato_il: '2026-07-31T10:00:10Z',
  scade_il: null,
  annullato: false,
  aperto_da_chat_id: null,
  aperto_il: null,
  usato_da_chat_id: null,
  usato_il: null,
  esito: null,
};

Deno.test('invito: quello appena fatto è «in giro» e si può ritirare', () => {
  const v = componiInvito(INVITO, SOCI, ADESSO);
  assertEquals(v.stato, 'in giro');
  assertEquals(v.ritirabile, true);
  assertEquals(v.invitante, 'Maurizio Aprea');
});

Deno.test('invito: usato e ritirato NON si possono ritirare di nuovo', () => {
  const usato = componiInvito({ ...INVITO, usato_il: '2026-07-31T10:28:23Z', esito: 'abilitato' }, SOCI, ADESSO);
  assertEquals(usato.stato, 'usato');
  assertEquals(usato.ritirabile, false);
  assertEquals(usato.motivo, 'abilitato');

  const ritirato = componiInvito({ ...INVITO, annullato: true }, SOCI, ADESSO);
  assertEquals(ritirato.stato, 'ritirato');
  assertEquals(ritirato.ritirabile, false);
});

Deno.test('invito: ritirato BATTE usato — è una decisione presa, non un fatto capitato', () => {
  const v = statoInvito({ ...INVITO, annullato: true, usato_il: '2026-07-31T10:28:23Z' }, ADESSO);
  assertEquals(v, 'ritirato');
});

Deno.test('invito: la scadenza vale, ma una data illeggibile non spegne niente', () => {
  assertEquals(statoInvito({ ...INVITO, scade_il: '2026-07-30T10:00:00Z' }, ADESSO), 'scaduto');
  assertEquals(statoInvito({ ...INVITO, scade_il: '2026-08-30T10:00:00Z' }, ADESSO), 'in giro');
  assertEquals(statoInvito({ ...INVITO, scade_il: 'domani mattina' }, ADESSO), 'in giro');
});

Deno.test('invito: aperto ma non completato si distingue da uno mai toccato', () => {
  const v = componiInvito({ ...INVITO, aperto_il: '2026-07-31T10:25:07Z', aperto_da_chat_id: 1256773674 }, SOCI, ADESSO);
  assertEquals(v.stato, 'in giro');
  assertEquals(v.motivo, 'aperto, non ancora completato');
});

Deno.test('invito: senza partita si dice la ragione VERA — «per entrare nel bot»', () => {
  assertEquals(componiInvito(INVITO, SOCI, ADESSO).partita, 'per entrare nel bot');
  assertEquals(
    componiInvito({ ...INVITO, partita: 'sab 2 ago 15:00 · Campo 4' }, SOCI, ADESSO).partita,
    'sab 2 ago 15:00 · Campo 4',
  );
});

// ── l'indice dei soci ────────────────────────────────────────────────────────

Deno.test('anagrafica: si indicizza per codice, e ci finisce solo chi ha quello VERO', () => {
  assertEquals(SOCI.perCodice.size, 3);
  assertEquals(SOCI.perCodice.get('000760')?.nome, 'Sheila Zaccaron');
  assertEquals(SOCI.perCodice.get('000760')?.autovalutato, true);
  assertEquals(SOCI.perCodice.get('000004')?.autovalutato, false);
  // Il `PMO-000060` non è una chiave: non deve comparire da nessuna parte qui dentro.
  assertEquals(SOCI.perCodice.get('PMO-000060'), undefined);
});

Deno.test('anagrafica: si indicizza ANCHE per numero di scheda, e lì ci sono tutti', () => {
  assertEquals(SOCI.perScheda.size, 5);
  assertEquals(SOCI.perScheda.get('sch-giuliano')?.nome, 'Giuliano Dal Cin');
  assertEquals(SOCI.perScheda.get('sch-giuliano')?.memberId, '');
  // 🚨 Il numero di scheda NON è sempre un uuid: 108 soci su 2.789 hanno questa forma,
  // e uno ne ha una lunga tre caratteri. Una guardia scritta a occhio li chiuderebbe fuori.
  assertEquals(SOCI.perScheda.get('matchpoint_n29tlt')?.nome, 'Chiara Abbiati');
});

Deno.test('anagrafica: si cerca prima per scheda, e il codice resta come ripiego', () => {
  // L'ordine conta: il numero di scheda non cambia mai, il codice cambia il giorno in cui
  // il circolo attiva la persona. Si cerca prima per la chiave che non si muove.
  assertEquals(trovaSocio(SOCI, 'sch-luca', '')?.nome, 'Luca Allera');
  assertEquals(trovaSocio(SOCI, '', '000029')?.nome, 'Luca Allera');
  assertEquals(trovaSocio(SOCI, 'sch-ignota', '000029')?.nome, 'Luca Allera');
  assertEquals(trovaSocio(SOCI, '', 'PMO-000060'), undefined);
});
