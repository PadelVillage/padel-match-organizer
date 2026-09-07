/* 🔪 BANCO della VOCE 173 — «lo storno sopravvive al sync».
 *
 * Il fatto da difendere è UNO e si dice in una riga: *dopo un giro di sync, una riga che il
 * gestionale aveva marcato stornata è ancora marcata stornata.* Tutto il resto sono i modi in
 * cui quel fatto può rompersi.
 *
 * ⚖️ Si guarda il FATTO, non la regola: i casi non chiedono «hai chiamato preservaStorno?», ma
 *    «cosa c'è scritto nella riga dopo». Una guardia sulla regola diventa verde riscrivendo il
 *    codice in un modo equivalente, e rossa cambiandolo in un modo innocuo.
 *
 * Si lancia con:  node --experimental-strip-types storno-preservato.test.ts
 * (Deno non si installa dal cloud: in CI gira col runner Deno, in locale con Node.)
 */
import { eStornata, preservaStorno, applicaStorniPreservati } from './storno-preservato.ts';

let falliti = 0;
let passati = 0;
function ok(nome: string, cond: boolean, dettaglio = '') {
  if (cond) { passati += 1; console.log('  ✅ ' + nome); }
  else { falliti += 1; console.log('  ❌ ' + nome + (dettaglio ? '  → ' + dettaglio : '')); }
}
function uguale(nome: string, avuto: unknown, atteso: unknown) {
  const a = JSON.stringify(avuto), b = JSON.stringify(atteso);
  ok(nome, a === b, `avuto ${a}, atteso ${b}`);
}

// La riga come la scrive il report, a ogni giro, sempre identica.
const dalReport = () => ({
  id_cliente_mp: '301', id_cliente: '291', player_name: 'Fabiola Limuti',
  campo: 'Campo 4', data: '2026-09-07', booking_data: '2026-09-07', ora: '10:30',
  amount_cents: 800, method: 'wallet', seq: 1, source: 'matchpoint',
  status: 'paid', synced_at: '2026-09-07T06:00:00.000Z',
});
// La stessa riga dopo che la segreteria ha premuto ↩︎ (così la scrive `marcaStornato`).
const stornataDaNoi = () => ({
  ...dalReport(),
  status: 'void', voided_at: '2026-09-06T22:09:58.473Z', voided_by: 'segreteria@padelvillage.club',
});

console.log('\n① eStornata — la stessa domanda, una sola risposta');
ok('una riga «paid» non è stornata', eStornata(dalReport()) === false);
ok('una riga «void» è stornata', eStornata(stornataDaNoi()) === true);
ok('basta voided_at, anche con status paid (le due metà sono indipendenti)',
   eStornata({ status: 'paid', voided_at: '2026-09-06T22:09:58Z' }) === true);
ok('basta uno status diverso da paid, anche senza voided_at',
   eStornata({ status: 'voided' }) === true);
ok('null e undefined non sono stornati', eStornata(null) === false && eStornata(undefined) === false);
ok('un payload vuoto non è stornato', eStornata({}) === false);
// 🚨 Il caso che a occhio sembra «già stornato» e non lo è: campi presenti ma VUOTI. Una stringa
//    vuota è ciò che resta quando qualcuno azzera un campo, e non deve valere come storno.
ok('voided_at stringa vuota NON è uno storno', eStornata({ status: 'paid', voided_at: '' }) === false);
ok('status stringa vuota NON è uno storno', eStornata({ status: '' }) === false);
ok('voided_at non-stringa non inganna', eStornata({ status: 'paid', voided_at: 0 }) === false);

console.log('\n② preservaStorno — IL FATTO: la riga resta stornata dopo il giro');
{
  const dopo = preservaStorno(dalReport(), stornataDaNoi());
  uguale('status resta «void»', dopo.status, 'void');
  uguale('voided_at resta quello del gesto', dopo.voided_at, '2026-09-06T22:09:58.473Z');
  uguale('voided_by resta chi l\'ha premuto', dopo.voided_by, 'segreteria@padelvillage.club');
}
{
  // ⚖️ E l'altra metà, che è quella che rende la cura onesta: il REPORT vince su tutto il resto.
  const nuovo = { ...dalReport(), amount_cents: 1200, method: 'cash', player_name: 'Fabiola L.' };
  const dopo = preservaStorno(nuovo, stornataDaNoi());
  uguale('l\'importo aggiornato da Matchpoint NON viene sovrascritto dal vecchio', dopo.amount_cents, 1200);
  uguale('il metodo aggiornato resta quello nuovo', dopo.method, 'cash');
  uguale('il nome aggiornato resta quello nuovo', dopo.player_name, 'Fabiola L.');
  uguale('ma lo storno resta', dopo.status, 'void');
  uguale('e synced_at resta quello del giro NUOVO', dopo.synced_at, '2026-09-07T06:00:00.000Z');
}
{
  const dopo = preservaStorno(dalReport(), dalReport());
  uguale('su una riga MAI stornata non si tocca niente: status', dopo.status, 'paid');
  ok('su una riga mai stornata non compare voided_at dal nulla', !('voided_at' in dopo));
}
{
  // 🚨 Un `voided_by` che non c'è non deve diventare `undefined`: sarebbe un campo inventato.
  const senzaAutore: Record<string, unknown> = { ...dalReport(), status: 'void', voided_at: '2026-09-06T22:09:58Z' };
  const dopo = preservaStorno(dalReport(), senzaAutore);
  ok('un voided_by assente NON viene creato', !('voided_by' in dopo));
  uguale('e lo storno c\'è lo stesso', dopo.status, 'void');
}
{
  const originale = stornataDaNoi();
  const nuovo = dalReport();
  preservaStorno(nuovo, originale);
  uguale('non muta il payload NUOVO che riceve', nuovo.status, 'paid');
  uguale('non muta il payload ESISTENTE che riceve', originale.status, 'void');
}

console.log('\n③ applicaStorniPreservati — sul blocco, e conta quante');
{
  const records = [
    { local_key: 'pay|301|291|2026-09-07|800|wallet|1', payload: dalReport() },
    { local_key: 'pay|999|111|2026-09-07|800|cash|1', payload: { ...dalReport(), id_cliente_mp: '999' } },
  ];
  const esistenti = new Map<string, Record<string, unknown>>([
    ['pay|301|291|2026-09-07|800|wallet|1', stornataDaNoi()],
  ]);
  const { preservati } = applicaStorniPreservati(records, esistenti);
  uguale('ne conta esattamente uno', preservati, 1);
  uguale('la riga stornata resta void', (records[0].payload as Record<string, unknown>).status, 'void');
  uguale('la riga di un\'altra persona resta paid', (records[1].payload as Record<string, unknown>).status, 'paid');
}
{
  // 🚨 IL CASO CHE CONTA DI PIÙ, ed è quello di un pagamento RIFATTO dopo uno storno: le due
  //    righe hanno la stessa persona, lo stesso importo, lo stesso metodo e lo stesso giorno —
  //    a distinguerle è solo la `seq`. Se la preservazione le confondesse, il pagamento NUOVO
  //    sparirebbe dalla cassa: un incasso vero dato per annullato.
  const records = [
    { local_key: 'pay|301|291|2026-09-07|800|cash|1', payload: dalReport() },
    { local_key: 'pay|301|291|2026-09-07|800|cash|2', payload: dalReport() },
  ];
  const esistenti = new Map<string, Record<string, unknown>>([
    ['pay|301|291|2026-09-07|800|cash|1', stornataDaNoi()],
  ]);
  const { preservati } = applicaStorniPreservati(records, esistenti);
  uguale('solo la seq stornata resta void', (records[0].payload as Record<string, unknown>).status, 'void');
  uguale('il pagamento RIFATTO resta paid — non lo si perde', (records[1].payload as Record<string, unknown>).status, 'paid');
  uguale('e ne conta uno solo', preservati, 1);
}
{
  const records = [{ payload: dalReport() }]; // senza local_key
  const { preservati } = applicaStorniPreservati(records, new Map([['x', stornataDaNoi()]]));
  uguale('un record senza local_key non fa esplodere niente', preservati, 0);
}
{
  const records = [{ local_key: 'k', payload: undefined as unknown }];
  const { preservati } = applicaStorniPreservati(records, new Map([['k', stornataDaNoi()]]));
  uguale('un payload assente diventa un oggetto con lo storno dentro', preservati, 1);
  uguale('...e lo storno c\'è', (records[0].payload as Record<string, unknown>).status, 'void');
}
{
  const records = [{ local_key: 'k', payload: dalReport() }];
  const { preservati } = applicaStorniPreservati(records, new Map());
  uguale('nessuna riga preesistente ⇒ nessuna preservazione', preservati, 0);
}

console.log(`\n${falliti === 0 ? '✅' : '❌'} ${passati} passati, ${falliti} falliti\n`);
if (falliti > 0) { if (typeof process !== 'undefined') process.exitCode = 1; }
