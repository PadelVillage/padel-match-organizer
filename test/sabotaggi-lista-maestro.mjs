// ── I SABOTAGGI DELLA VOCE 98/C (27/08/2026) ─────────────────────────────────────────────
//
// Che cosa sorvegliano: `refreshAssessmentDataForMembersList` e il suo CABLAGGIO, cioè la cura
// che fa arrivare le risposte dell'autovalutazione alla lista «Da certificare dal maestro»
// adesso che le tre porte della sezione congelata sono chiuse tutte e tre.
//
// 🚨⭐⭐ PERCHÉ VA SABOTATA e non basta rileggerla: quando questa cura è rotta **non rompe
// niente**. Anagrafica soci si apre, l'elenco si disegna, nessun errore a schermo — e la lista
// del maestro risponde «Nessun socio trovato». Cioè lo stesso identico verde che darebbe se
// davvero non aspettasse nessuno. È il difetto del 26/08 nella sua forma pura: *uno zero non è
// un risultato, è la stessa faccia che ha «non ho potuto contare»*.
//
// ⭐ Il sabotaggio ③ è quello che conta più di tutti: rovescia l'ORDINE fra gettoni e risposte.
// È la modifica che qualcuno farebbe «per velocità» fra sei mesi, e i due sync presi da soli
// restano verdi in tutt'e due gli ordini.
//
// 🧪 In fondo gira un sabotaggio che NON TOCCA NIENTE, dichiarato tale, che DEVE risultare non
// atterrato: è il controllo del metro.
//
// Uso:  node test/sabotaggi-lista-maestro.mjs

import { readFileSync, writeFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = join(QUI, '..');
const BANCO = 'test/la-lista-del-maestro-si-aggiorna-da-se.test.mjs';
const APP = join(RADICE, 'index.html');

const SABOTAGGI = [
  {
    nome: '① 🚨🚨 IL DIFETTO DEL 26/08: il cablaggio si stacca dall\'ingresso in Anagrafica soci',
    difende: 'è il difetto esatto — la funzione resta perfetta e non la chiama nessuno, quindi la lista del maestro legge un archivio fermo e dice «nessun socio» con la faccia della verità',
    da: "              if (typeof refreshAssessmentDataForMembersList === 'function') refreshAssessmentDataForMembersList(); }",
    a: "              }",
  },
  {
    nome: '② il filtro «Da certificare» smette di FORZARE: risponde col dato del giro prima',
    difende: 'scegliere quel filtro È la domanda «chi aspetta il maestro?»: col freno dei 60 secondi in mezzo, a una domanda esplicita si risponderebbe con una fotografia vecchia',
    da: "      if (_filtro === 'daCertificare' && typeof refreshAssessmentDataForMembersList === 'function') refreshAssessmentDataForMembersList({ force:true });",
    a: "      if (_filtro === 'daCertificare' && typeof refreshAssessmentDataForMembersList === 'function') refreshAssessmentDataForMembersList();",
  },
  {
    nome: '③ ⭐ L\'ORDINE si rovescia: prima le risposte, poi i gettoni',
    difende: 'le schede si cercano PER GETTONE — leggendo le risposte prima dell\'archivio, una scheda nuova arriva con un ingresso di ritardo, ed è il caso del 26/08 delle 08:27',
    da: `        await syncAssessmentTokensFromSupabase({ silent:true });
        await syncAssessmentResponsesFromSupabase({ silent:true, autoPostProcess:false, skipCloudLogs:true });`,
    a: `        await syncAssessmentResponsesFromSupabase({ silent:true, autoPostProcess:false, skipCloudLogs:true });
        await syncAssessmentTokensFromSupabase({ silent:true });`,
  },
  {
    nome: '④ i due giri tornano in PARALLELO, «per velocità»',
    difende: 'è il modo elegante di rompere il ③: `Promise.all` sembra un miglioramento e fa esattamente lo stesso danno — le risposte leggono l\'archivio della visita precedente',
    da: `        await syncAssessmentTokensFromSupabase({ silent:true });
        await syncAssessmentResponsesFromSupabase({ silent:true, autoPostProcess:false, skipCloudLogs:true });`,
    a: `        await Promise.all([
          syncAssessmentTokensFromSupabase({ silent:true }),
          syncAssessmentResponsesFromSupabase({ silent:true, autoPostProcess:false, skipCloudLogs:true })
        ]);`,
  },
  {
    nome: '⑤ la firma torna a essere la sola LUNGHEZZA',
    difende: 'chi rifà il test viene AGGIORNATO in posto e il conteggio non si muove: con la firma corta, un livello dimostrato nuovo non arriverebbe mai in lista',
    da: "      return righe.length + '|' + righe.map(r => `${r?.token || ''}:${r?.calculated_level ?? ''}:${r?.submitted_at || ''}`).join(',');",
    a: "      return String(righe.length);",
  },
  {
    nome: '⑥ il rinfresco riaccende l\'auto-applicazione dei livelli',
    difende: 'questa è una lista che si GUARDA: il livello sopra il tetto lo scrive il maestro. Auto-applicare sarebbe la sezione congelata che rientra dalla finestra, e su dati veri scriverebbe livelli a nome di nessuno',
    da: "        await syncAssessmentResponsesFromSupabase({ silent:true, autoPostProcess:false, skipCloudLogs:true });",
    a: "        await syncAssessmentResponsesFromSupabase({ silent:true, skipCloudLogs:true });",
  },
  {
    nome: '⑦ il freno dei 60 secondi sparisce',
    difende: 'due RPC a OGNI ingresso in Anagrafica soci, che è la scheda su cui la segreteria entra ed esce tutto il giorno',
    da: "      if (!options.force && now - _pmoMaestroRefreshLastAt < 60000) return;",
    a: "      if (false) return;",
  },
  {
    nome: '⑧ la guardia «un giro alla volta» sparisce',
    difende: 'due ingressi ravvicinati farebbero due giri sovrapposti sulle stesse due RPC, e il secondo scriverebbe sopra il primo',
    da: "      if (_pmoMaestroRefreshInFlight) return;",
    a: "      if (false) return;",
  },
  {
    nome: '⑨ un guasto del sync smette di essere assorbito',
    difende: 'l\'errore uscirebbe dalla funzione dentro il render di switchTab: entrare in Anagrafica soci fallirebbe per un problema di rete dell\'autovalutazione',
    da: "      } catch (err) {\n        console.warn('Rinfresco autovalutazione per la lista soci non riuscito:', err);",
    a: "      } catch (err) {\n        throw err;\n        console.warn('Rinfresco autovalutazione per la lista soci non riuscito:', err);",
  },
  {
    nome: '⑩ 🧪 IL CONTROLLO DEL METRO: una sostituzione che NON tocca niente',
    difende: 'niente: serve a provare che la guardia «è atterrato?» sa dire di no',
    da: "    async function refreshAssessmentDataForMembersList(options = {}) {",
    a: "    async function refreshAssessmentDataForMembersList(options = {}) {",
    nullo: true,
  },
];

const rifugio = mkdtempSync(join(tmpdir(), 'sabotaggi-lista-maestro-'));
const copia = join(rifugio, 'index.html');
copyFileSync(APP, copia);
const ripristina = () => copyFileSync(copia, APP);
const atterrato = () => readFileSync(APP, 'utf8') !== readFileSync(copia, 'utf8');
function bancoVerde() {
  try { execFileSync('node', [BANCO], { cwd: RADICE, stdio: 'pipe' }); return true; }
  catch { return false; }
}

console.log('\n🔪 SABOTAGGI: la lista del maestro, e le tre porte chiuse\n');

let rossi = 0;
if (!bancoVerde()) {
  console.log('⛔ Il banco non è verde da fermo: i sabotaggi non misurerebbero niente.\n');
  rmSync(rifugio, { recursive: true, force: true });
  process.exit(1);
}
console.log(`  ✅ banco di partenza verde: ${BANCO}\n`);

for (const s of SABOTAGGI) {
  const testo = readFileSync(APP, 'utf8');
  if (!testo.includes(s.da)) {
    console.log(`❌ ${s.nome}\n   il testo da sostituire NON esiste più: il sabotaggio non descrive il codice`);
    rossi++;
    continue;
  }
  writeFileSync(APP, testo.replace(s.da, s.a));
  const eAtterrato = atterrato();

  if (s.nullo) {
    const ok = !eAtterrato;
    console.log(`${ok ? '✅' : '❌'} ${s.nome}\n   difende: ${s.difende}\n   ${ok ? 'il metro dice NO a una sostituzione nulla: funziona' : '🚨 IL METRO È ROTTO'}`);
    if (!ok) rossi++;
    ripristina();
    continue;
  }
  if (!eAtterrato) {
    console.log(`❌ ${s.nome}\n   difende: ${s.difende}\n   NON ATTERRATO: il rosso (o il verde) che segue non vuol dire niente`);
    rossi++;
    ripristina();
    continue;
  }
  const visto = !bancoVerde();
  console.log(`${visto ? '✅' : '❌'} ${s.nome}\n   difende: ${s.difende}\n   ${visto ? 'il banco lo vede: ROSSO' : '🚨 IL BANCO NON LO VEDE: quella protezione non è provata da niente'}`);
  if (!visto) rossi++;
  ripristina();
}

ripristina();
const sporco = atterrato();
console.log(`\n${sporco ? '❌' : '✅'} index.html ripristinato`);
if (sporco) rossi++;
rmSync(rifugio, { recursive: true, force: true });

const totale = SABOTAGGI.length;
console.log(`\n— ${totale - rossi} sabotaggi visti, ${rossi} problemi su ${totale} —\n`);
process.exit(rossi ? 1 : 0);
