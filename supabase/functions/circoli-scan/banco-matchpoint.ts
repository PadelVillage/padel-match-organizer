// Banco di prova della sonda Matchpoint, senza toccare il portale vero.
//
//   deno run -A banco-matchpoint.ts
//
// Gemello di `banco.ts` (che finge un Joomla/Wansport): qui il finto portale è un
// ASP.NET, quindi pretende indietro i tre campi ViewState e risponde con due
// `Repeater` numerati — che è il solo aggancio da cui la sonda legge gli slot.
//
// 🚨 Ogni caso ha il suo SABOTAGGIO, perché un banco che non si è mai visto rosso
//    non prova niente (regola di casa). Il sabotaggio che conta più di tutti è il
//    ④: un portale che risponde 200 con una pagina QUALUNQUE non deve produrre
//    «0 slot liberi». «Non ho potuto leggere» e «non c'è posto» sono la stessa
//    frase solo per chi non deve giocarci — e la seconda manda a casa un socio
//    che un campo ce l'aveva.
//
// 📌 Le stesse verifiche sono già passate FUORI da questo banco il 24/08/2026:
//    sull'HTML vero salvato dal portale (17 slot, 4 campi, passo 90′) e contro
//    Matchpoint dal vivo in 2,5 s. Questo banco serve a non doverlo rifare a mano.

import { sondaMatchpoint, slotDaHtml, grigliaDaSlot, dataPerMatchpoint } from './matchpoint.ts';

type Caso = { nome: string; atteso: string; ottenuto: string; ok: boolean };
const casi: Caso[] = [];
const prova = (nome: string, atteso: string, ottenuto: string) =>
  casi.push({ nome, atteso, ottenuto, ok: atteso === ottenuto });

// ── Il finto portale ─────────────────────────────────────────────────────────
let modo: 'ok' | 'login' | 'manutenzione' | 'controlli-cambiati' | 'guasto' = 'ok';
let ultimoModulo = '';

// 🚨 `grassetto` NON è un capriccio del banco: lo stesso portale, alla stessa
//    ora, serve l'etichetta nei due modi — nuda o avvolta in <b>. Misurato il
//    24/08/2026 dalla prova fisica, dopo che la variante col <b> aveva fatto
//    uscire i campi come «risorsa 13». Il banco lo prova adesso in tutti e due.
const scheda = (i: number, campo: string, ora: string, fine: string, idr: string, etichetta = 'LabelPista', grassetto = false) => `
  <span id="ContentPlaceHolderContenido_RepeaterHorariosDisponibles_${etichetta}_${i}">${grassetto ? `<b>${campo} (Indoor)</b>` : `${campo} (Indoor)`}</span>
  <a id="ContentPlaceHolderContenido_RepeaterHorariosDisponibles_HyperLinkAcceder_${i}"
     href="Match.aspx?id=abc&amp;idrecurso=${idr}&amp;fecha=25-08-2026&amp;horainicio=${ora}&amp;horafin=${fine}&amp;iddeporte=2">Nuova Partita</a>`;

const viewState = `
  <input type="hidden" id="__VIEWSTATE" value="VS-FINTO" />
  <input type="hidden" id="__VIEWSTATEGENERATOR" value="GEN" />
  <input type="hidden" id="__EVENTVALIDATION" value="EV" />`;

const finto = Deno.serve({ port: 8792, onListen: () => {} }, async (req) => {
  const html = (c: string) => new Response(c, { headers: { 'content-type': 'text/html' } });
  if (modo === 'guasto') return new Response('', { status: 503 });
  if (modo === 'manutenzione') return html('<html><h1>Sito in manutenzione</h1></html>');
  if (modo === 'login') return html(`<html><input id="ContentPlaceHolderContenido_Login1_UserName"></html>`);

  if (req.method === 'GET') return html(`<html>${viewState}<select id="ContentPlaceHolderContenido_DropDownListFecha"></select></html>`);

  ultimoModulo = await req.text();
  const et = modo === 'controlli-cambiati' ? 'LabelXXX' : 'LabelPista';
  return html(`<html>${viewState}
    ${scheda(0, 'Campo 1', '9:30', '11:00', '13', et)}
    ${scheda(1, 'Campo 4', '9:30', '11:00', '16', et, true)}
    ${scheda(2, 'Campo 4', '21:00', '22:30', '16', et)}</html>`);
});

const chiedi = (u: string, o: RequestInit) => fetch(u, o);
const BASE = 'http://127.0.0.1:8792/';

// ── ① il caso buono ──────────────────────────────────────────────────────────
modo = 'ok';
const buono = await sondaMatchpoint(BASE, '2026-08-25', chiedi);
prova('① legge tutti gli slot', '3', String(buono.slot.length));
prova('① il nome del campo è quello del circolo', 'Campo 4', buono.slot[1].campo);
prova('① legge il nome anche se il portale lo mette in <b>', 'Campo 4', buono.slot[1].campo);
prova('① e non si porta dietro i tag', 'no', /[<>]/.test(buono.slot[1].campo) ? 'sì' : 'no');
prova('① tiene ora di inizio e fine', '9:30-11:00', `${buono.slot[1].ora}-${buono.slot[1].oraFine}`);
prova('① la data va nel formato della tendina', 'sì', ultimoModulo.includes('25%2F08%2F2026') ? 'sì' : 'no');
prova('① chiede tutta la giornata', 'sì', ultimoModulo.includes('CheckBoxSinHorario') ? 'sì' : 'no');
prova('① rimanda indietro il ViewState', 'sì', ultimoModulo.includes('VS-FINTO') ? 'sì' : 'no');
prova('① NON manda credenziali', 'sì', /password|username|UserName/i.test(ultimoModulo) ? 'no' : 'sì');

// ── ② la griglia dedotta ─────────────────────────────────────────────────────
const g = grigliaDaSlot(buono.slot);
prova('② passo in minuti', '90', String(g.slotMinuti));
prova('② apertura osservata', '09:30', String(g.apertura));
prova('② chiusura osservata', '22:30', String(g.chiusura));
prova('② elenco campi senza doppioni', 'Campo 1,Campo 4', g.campi.join(','));

// ── ③ la data ────────────────────────────────────────────────────────────────
prova('③ ISO → formato italiano', '25/08/2026', dataPerMatchpoint('2026-08-25'));
try { dataPerMatchpoint('25/08/2026'); prova('③ rifiuta il formato sbagliato', 'errore', 'passata'); }
catch { prova('③ rifiuta il formato sbagliato', 'errore', 'errore'); }

// ── ④ IL SABOTAGGIO CHE CONTA ────────────────────────────────────────────────
// Un portale che risponde ma non è la ricerca: mai «0 liberi», sempre un errore.
for (const [nome, m] of [['login', 'login'], ['manutenzione', 'manutenzione'], ['guasto', 'guasto']] as const) {
  modo = m;
  try {
    const r = await sondaMatchpoint(BASE, '2026-08-25', chiedi);
    prova(`④ ${nome}: grida invece di dire «nessun posto»`, 'errore', `ha detto ${r.slot.length} liberi`);
  } catch (e) {
    prova(`④ ${nome}: grida invece di dire «nessun posto»`, 'errore', 'errore');
  }
}

// ── ⑤ se il portale rinomina i controlli, gli slot NON spariscono ────────────
// Perdere uno slot in silenzio è dire «non c'è posto» dove il posto c'era: il
// nome del campo degrada a un ripiego dichiarato, la riga resta.
modo = 'controlli-cambiati';
const degradato = await sondaMatchpoint(BASE, '2026-08-25', chiedi);
prova('⑤ gli slot restano contati', '3', String(degradato.slot.length));
prova('⑤ il nome diventa un ripiego riconoscibile', 'sì', degradato.slot[0].campo.startsWith('risorsa ') ? 'sì' : 'no');

// ── ⑥ parser su pezzi rotti ──────────────────────────────────────────────────
prova('⑥ HTML vuoto', '0', String(slotDaHtml('').length));
prova('⑥ HTML senza schede', '0', String(slotDaHtml('<html><body>niente</body></html>').length));

await finto.shutdown();

const rossi = casi.filter((c) => !c.ok);
for (const c of casi) console.log(`  ${c.ok ? '✅' : '❌'} ${c.nome}${c.ok ? '' : `  atteso «${c.atteso}», ottenuto «${c.ottenuto}»`}`);
console.log(`\n${casi.length - rossi.length}/${casi.length} passate`);
if (rossi.length) Deno.exit(1);
