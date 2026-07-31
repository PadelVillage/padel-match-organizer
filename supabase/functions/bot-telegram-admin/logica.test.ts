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
  vedeLaSezione,
  type RigaInvito,
  type RigaOperatore,
} from './logica.ts';

const SOCI = indicizzaSoci([
  { payload: { memberId: '000004', firstName: 'Maurizio', surname: 'Aprea', phone: '+39 333 1112223', level: '3' } },
  { payload: { memberId: '000029', firstName: 'Luca', surname: 'Allera', phone: '', level: '0.5' } },
  { payload: { memberId: '000760', name: 'Sheila Zaccaron', phone: '3401234567', level: '2.5', selfAssessmentDate: '2026-07-01' } },
  { payload: { firstName: 'Senza', surname: 'Codice' } },
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
  etichetta: 'Maurizio Aprea (committente)',
  attivo: true,
  ambiente: 'prod',
  created_at: '2026-07-25T08:27:04Z',
  invitato_da_member_id: null,
  invito_token: null,
};

Deno.test('persona: nome, telefono e livello arrivano dall’anagrafica del gestionale', () => {
  const p = componiPersona(OPERATORE, SOCI);
  assertEquals(p.nome, 'Maurizio Aprea');
  assertEquals(p.telefono, '+39 333 1112223');
  assertEquals(p.livello, '3');
  assertEquals(p.schedaTrovata, true);
  assertEquals(p.chatId, '1256773674');
  assertEquals(p.attivo, true);
});

Deno.test('persona: senza scheda si mostra l’etichetta del bot e si DICHIARA che manca', () => {
  const p = componiPersona({ ...OPERATORE, member_id: '999999' }, SOCI);
  assertEquals(p.nome, 'Maurizio Aprea (committente)');
  assertEquals(p.schedaTrovata, false);
  assertEquals(p.livello, '—');
});

Deno.test('persona: senza scheda e senza etichetta resta il codice, mai una riga vuota', () => {
  const p = componiPersona({ ...OPERATORE, member_id: '999999', etichetta: null }, SOCI);
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
  assertEquals(componiPersona(OPERATORE, SOCI).invitatoDa, '');
});

// ── lo stato di un invito ────────────────────────────────────────────────────

const ADESSO = new Date('2026-07-31T18:00:00Z');
const INVITO: RigaInvito = {
  token: 'tdF4MbfW1234',
  ambiente: 'prod',
  invitante_member_id: '000004',
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

Deno.test('anagrafica: si indicizza per codice, e chi non ce l’ha viene saltato', () => {
  assertEquals(SOCI.size, 3);
  assertEquals(SOCI.get('000760')?.nome, 'Sheila Zaccaron');
  assertEquals(SOCI.get('000760')?.autovalutato, true);
  assertEquals(SOCI.get('000004')?.autovalutato, false);
});
