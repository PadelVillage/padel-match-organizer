#!/usr/bin/env node
// I SABOTAGGI del ramo manutenzione — 20/08/2026.
//
// 🔨 La regola di casa: un caso verde non dimostra niente finché non lo si è visto ROSSO. Qui
// ogni difetto viene riacceso uno per volta nel sorgente, il banco rilanciato, e ci si aspetta
// che cada — e che cada IL CASO GIUSTO, non un altro qualunque.
//
// 🚨⭐ E l'atterraggio si MISURA, contro il file di prima e non con `git diff`: un sabotaggio che
// non viene applicato lascia il banco verde, e quel verde si legge come «il caso difende» mentre
// vuol dire «non ho toccato niente». È già successo in questo progetto (30ª, una regex BRE su
// `grep` di macOS che non atterrava).
// ⇒ In fondo alla serie c'è un sabotaggio che NON deve atterrare: senza di lui, «atterrato» è una
// parola che nessuno ha mai visto valere `false`, e un rilevatore che dice sempre sì non è un
// rilevatore.
//
// Uso: node test/sabotaggi-annullo-manutenzione.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.join(QUI, '..');
const SERVER = path.join(RADICE, 'src', 'server.mjs');
const MODULO = path.join(RADICE, 'src', 'tipo-ficha.mjs');

const SABOTAGGI = [
  {
    nome: 'annulloSupportato dice sempre di sì',
    file: MODULO,
    cerca: "return tipo !== 'manutenzione';",
    metti: 'return true;',
    caso: 'l\'annullo è supportato su partita e lezione, e NON sulla manutenzione',
  },
  {
    nome: 'il ripiego diventa «manutenzione» invece di «partita»',
    file: MODULO,
    cerca: "  return 'partita';\n}",
    metti: "  return 'manutenzione';\n}",
    caso: 'un URL sconosciuto ripiega su «partita», e non su «manutenzione»',
  },
  {
    nome: 'i due riconoscimenti invertiti: la manutenzione prima della lezione',
    file: MODULO,
    cerca: "  if (u.includes('ClaseSuelta')) return 'lezione';\n  if (u.includes('Mantenimiento')) return 'manutenzione';",
    metti: "  if (u.includes('Mantenimiento')) return 'manutenzione';\n  if (u.includes('ClaseSuelta')) return 'lezione';",
    caso: 'la lezione vince sulla manutenzione: sono URL diverse, mai la stessa',
  },
  {
    nome: 'il riconoscimento della lezione guarda la parola sbagliata',
    file: MODULO,
    cerca: "if (u.includes('ClaseSuelta')) return 'lezione';",
    metti: "if (u.includes('ClaseDoble')) return 'lezione';",
    caso: 'riconosce i tre tipi dalle URL vere di Matchpoint',
  },
  {
    nome: 'il motivo torna a nominare un pezzo interno',
    file: MODULO,
    cerca: "  'Le manutenzioni non si annullano da qui: vanno cancellate dal tabellone, perché toccano rimborsi e pagamenti.';",
    metti: "  'Il worker non sa annullare una manutenzione su Matchpoint. Cancellala dal tabellone.';",
    caso: 'il motivo non nomina NESSUN pezzo interno — regola ferrea del 19/08',
  },
  {
    nome: 'server.mjs smette di importare la regola',
    file: SERVER,
    cerca: "} from './tipo-ficha.mjs';",
    metti: "} from './tipo-ficha-COPIA-LOCALE.mjs';",
    caso: 'server.mjs importa la regola invece di riscriverla',
  },
  {
    nome: 'il rifiuto non passa più da fail(): torna un errore grezzo',
    file: SERVER,
    cerca: '      throw fail(CODICE_ANNULLO_NON_SUPPORTATO, MOTIVO_ANNULLO_NON_SUPPORTATO, diagnostic);',
    metti: '      throw new Error(MOTIVO_ANNULLO_NON_SUPPORTATO);',
    caso: 'il rifiuto viaggia col suo codice e col suo motivo, non con un errore grezzo',
  },
  {
    nome: 'torna la riga che tratta i tre tipi uguali',
    file: SERVER,
    cerca: "    diagnostic.steps.push('click_annulla:' + tipoFicha);",
    metti: "    // PARTITA / LEZIONE / MANUTENZIONE: il click apre l'iframe fancybox anularreserva.aspx con ButtonAnular.\n    diagnostic.steps.push('click_annulla:partita/lezione');",
    caso: 'i due commenti che si contraddicevano non si contraddicono più',
  },
  {
    // ⭐ L'ordine è la metà della cura, e questi due lo provano dai due lati opposti.
    nome: 'il rifiuto scivola DOPO l\'attesa del bottone (i 10 secondi tornano)',
    file: SERVER,
    sposta: {
      blocco: '    if (!annulloSupportato(tipoFicha)) {\n      diagnostic.steps.push(\'annullo_non_supportato:\' + tipoFicha);\n      throw fail(CODICE_ANNULLO_NON_SUPPORTATO, MOTIVO_ANNULLO_NON_SUPPORTATO, diagnostic);\n    }\n\n',
      dopo: "    await dlg.locator('#CC_Datos_ButtonAnular').first().waitFor({ state: 'visible', timeout: 10000 });\n",
    },
    caso: 'l\'annullo RIFIUTA prima di cercare il bottone di conferma',
  },
  {
    nome: 'il rifiuto scivola PRIMA di «già annullata» (rompe un caso che funzionava)',
    file: SERVER,
    sposta: {
      blocco: '    if (!annulloSupportato(tipoFicha)) {\n      diagnostic.steps.push(\'annullo_non_supportato:\' + tipoFicha);\n      throw fail(CODICE_ANNULLO_NON_SUPPORTATO, MOTIVO_ANNULLO_NON_SUPPORTATO, diagnostic);\n    }\n\n',
      prima: '    // Verifica stato iniziale (se già annullata, esci ok)\n',
    },
    caso: 'il rifiuto sta DOPO «già annullata», così una manutenzione già cancellata risponde ok',
  },
  {
    // 🎯 IL CONTROLLO, e va in fondo di proposito: cerca una riga che NON esiste. Deve risultare
    // NON ATTERRATO e il banco deve restare VERDE. Se questo dicesse «atterrato», tutti i sì di
    // sopra varrebbero zero.
    nome: '(controllo) una riga che non esiste — NON deve atterrare',
    file: SERVER,
    cerca: "if (!annulloSupportato(questaRigaNonEsisteDavvero))",
    metti: 'if (true)',
    deveAtterrare: false,
  },
];

function banco() {
  try {
    execFileSync('npm', ['test'], { cwd: RADICE, stdio: 'pipe' });
    return 'VERDE';
  } catch (e) {
    const out = String(e.stdout || '') + String(e.stderr || '');
    const caduti = [...out.matchAll(/^not ok \d+ - (.+)$/gm)].map((m) => m[1].trim());
    return { stato: 'ROSSO', caduti };
  }
}

const originali = new Map([[SERVER, fs.readFileSync(SERVER, 'utf8')], [MODULO, fs.readFileSync(MODULO, 'utf8')]]);
const ripristina = () => { for (const [f, testo] of originali) fs.writeFileSync(f, testo); };

console.log('── prima di tutto: il banco dev\'essere VERDE ──');
const partenza = banco();
if (partenza !== 'VERDE') {
  console.error('🔴 il banco è già rosso PRIMA dei sabotaggi — non si può misurare niente:', partenza);
  process.exit(1);
}
console.log('✅ VERDE\n');

let problemi = 0;
for (const s of SABOTAGGI) {
  const prima = originali.get(s.file);
  let dopo;
  if (s.sposta) {
    const senza = prima.replace(s.sposta.blocco, '');
    if (senza === prima) { console.error(`🔴 ${s.nome}: blocco da spostare non trovato`); problemi++; continue; }
    dopo = s.sposta.dopo
      ? senza.replace(s.sposta.dopo, s.sposta.dopo + '\n' + s.sposta.blocco)
      : senza.replace(s.sposta.prima, s.sposta.blocco + s.sposta.prima);
  } else {
    dopo = prima.replace(s.cerca, s.metti);
  }

  // 🚨 L'ATTERRAGGIO, misurato contro il file di PRIMA. Non `git diff`, non «il replace è andato».
  const atterrato = dopo !== prima;
  const atteso = s.deveAtterrare !== false;
  if (atterrato !== atteso) {
    console.error(`🔴 ${s.nome}\n   atterrato=${atterrato}, atteso=${atteso}`);
    problemi++;
    continue;
  }
  if (!atteso) {
    console.log(`✅ ${s.nome}\n   → NON atterrato, come deve: il rilevatore sa dire anche di no.`);
    continue;
  }

  fs.writeFileSync(s.file, dopo);
  const esito = banco();
  ripristina();

  if (esito === 'VERDE') {
    console.error(`🔴 ${s.nome}\n   → atterrato ma il banco resta VERDE: nessun caso lo difende.`);
    problemi++;
  } else if (!esito.caduti.includes(s.caso)) {
    console.error(`🔴 ${s.nome}\n   → rosso, ma è caduto il caso SBAGLIATO.\n     atteso: ${s.caso}\n     caduti: ${esito.caduti.join(' · ')}`);
    problemi++;
  } else {
    console.log(`✅ ${s.nome}\n   → rosso su «${s.caso}»${esito.caduti.length > 1 ? ` (+${esito.caduti.length - 1} altri)` : ''}`);
  }
}

ripristina();
const finale = banco();
console.log(`\n── ripristinato: il banco è ${finale === 'VERDE' ? 'VERDE ✅' : 'ROSSO 🔴'} ──`);
if (finale !== 'VERDE') problemi++;
console.log(problemi === 0 ? `\n🎉 ${SABOTAGGI.length} sabotaggi, tutti visti.` : `\n🔴 ${problemi} problemi.`);
process.exit(problemi === 0 ? 0 : 1);
