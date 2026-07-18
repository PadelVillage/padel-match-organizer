// ui.js — schermate e collegamento fra il DOM e i due moduli puri.
// Qui non c'è nessuna regola di sicurezza: quelle stanno nel server. Qui c'è
// solo il compito di non mostrare mai più di quello che il server ha mandato.

import * as L from './logic.js';
import * as api from './api.js';

const $ = (id) => document.getElementById(id);

// Stato del flusso. `phone` sono le ultime 10 cifre, `email` è quella DIGITATA
// dal socio: l'indirizzo in anagrafica non arriva mai fin qui.
const S = {
  phone: '',
  candidateIndex: 0,
  firstName: '',
  email: '',
  challengeId: '',
  expiresAt: 0,
};

function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id));
  document.querySelectorAll('.msg.bad').forEach((m) => m.classList.remove('on'));
}

function fail(id, text) {
  const el = $(id);
  el.textContent = text;
  el.classList.add('on');
}

/** Pulsante occupato: niente doppi invii mentre la rete sta lavorando. */
function busy(btn, on, label) {
  btn.disabled = on;
  btn.innerHTML = on ? `<span class="spin"></span>${label}` : label;
}

// ── Passo 1: telefono ─────────────────────────────────────────────────────
async function submitPhone() {
  const btn = $('btn-telefono');
  const { last10, valid } = L.normalizePhone($('in-telefono').value);
  if (!valid) {
    fail('err-telefono', 'Servono almeno 10 cifre. Controlla il numero.');
    return;
  }
  busy(btn, true, 'Continua');
  const res = await api.identify(last10);
  busy(btn, false, 'Continua');

  if (res.ok !== true) {
    fail('err-telefono', 'Non riusciamo a controllare adesso. Riprova tra poco.');
    return;
  }
  S.phone = last10;

  const next = L.decideAfterIdentify(res);
  if (next.screen === 'sconosciuto') return show('sc-sconosciuto');
  if (next.screen === 'scelta') return renderScelta(next.candidates);
  applyCandidate(next);
}

function renderScelta(candidates) {
  const box = $('lista-scelta');
  box.innerHTML = '';
  for (const c of candidates) {
    const b = document.createElement('button');
    b.className = 'pick';
    // Solo il nome di battesimo: è tutto ciò che il server ha mandato.
    b.textContent = `👤 ${L.prettyName(c.first_name)}`;
    b.addEventListener('click', () => applyCandidate(L.decideForCandidate(c)));
    box.appendChild(b);
  }
  show('sc-scelta');
}

function applyCandidate(next) {
  S.candidateIndex = next.index;
  S.firstName = L.prettyName(next.firstName);
  if (next.screen === 'segreteria') {
    $('saluto-segreteria').textContent = `Ciao ${S.firstName}!`;
    return show('sc-segreteria');
  }
  $('saluto-email').textContent = `Ciao ${S.firstName}! 👋`;
  show('sc-email');
}

// ── Passo 2: email ────────────────────────────────────────────────────────
async function submitEmail() {
  const btn = $('btn-email');
  const email = L.normalizeEmail($('in-email').value);
  if (!L.isPlausibleEmail(email)) {
    fail('err-email', "Controlla l'indirizzo: sembra incompleto.");
    return;
  }
  busy(btn, true, 'Inviami il codice');
  const res = await api.challenge(S.phone, S.candidateIndex, email);
  busy(btn, false, 'Inviami il codice');

  if (res.ok !== true || !res.challenge_id) {
    fail('err-email', 'Non riusciamo a inviare adesso. Riprova tra poco.');
    return;
  }

  // Da qui in poi la schermata è identica sia che l'email combaci sia che no:
  // se non combacia semplicemente il codice non arriverà mai. Il server non ci
  // dice quale dei due casi sia, ed è voluto — altrimenti l'app diventerebbe
  // uno strumento per indovinare le email dei soci.
  S.email = email;
  S.challengeId = res.challenge_id;
  S.expiresAt = Date.now() + (Number(res.expires_in) || 600) * 1000;

  $('dove-codice').textContent =
    `Abbiamo inviato un codice a 6 cifre a ${L.maskEmail(email)}. Arriva entro un minuto.`;
  $('in-codice').value = '';
  show('sc-codice');
  tickCountdown();
}

let countdownTimer = null;
function tickCountdown() {
  clearInterval(countdownTimer);
  const paint = () => {
    const left = Math.round((S.expiresAt - Date.now()) / 1000);
    $('nota-scadenza').textContent = left > 0
      ? `Il codice scade fra ${L.formatCountdown(left)}.`
      : 'Il codice è scaduto: richiedine uno nuovo.';
    if (left <= 0) clearInterval(countdownTimer);
  };
  paint();
  countdownTimer = setInterval(paint, 1000);
}

// ── Passo 3: codice ───────────────────────────────────────────────────────
async function submitCode() {
  const btn = $('btn-codice');
  const code = L.sanitizeCode($('in-codice').value);
  if (!L.isCompleteCode(code)) {
    fail('err-codice', 'Il codice è di 6 cifre.');
    return;
  }
  busy(btn, true, 'Entra');
  const res = await api.verify(S.challengeId, code);
  busy(btn, false, 'Entra');

  if (res.ok !== true || !res.access_token) {
    fail('err-codice', 'Codice non valido o scaduto. Controlla e riprova.');
    return;
  }

  api.saveSession(res);
  clearInterval(countdownTimer);
  $('saluto-dentro').textContent = S.firstName ? `Bentornato, ${S.firstName}!` : 'Bentornato!';
  show('sc-dentro');
}

// ── Collegamenti ──────────────────────────────────────────────────────────
$('btn-telefono').addEventListener('click', submitPhone);
$('btn-email').addEventListener('click', submitEmail);
$('btn-codice').addEventListener('click', submitCode);

$('in-telefono').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitPhone(); });
$('in-email').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitEmail(); });
$('in-codice').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitCode(); });

// Il campo del codice accetta solo cifre, anche se incollate.
$('in-codice').addEventListener('input', (e) => {
  e.target.value = L.sanitizeCode(e.target.value);
});

// «Non ho ricevuto il codice»: mai un vicolo cieco, si finisce sempre da
// qualche parte. Vale sia per chi ha sbagliato email sia per chi ha il codice
// in spam, e le due cose restano indistinguibili.
$('btn-nocode').addEventListener('click', () => {
  fail('err-codice',
    "Controlla anche la posta indesiderata. Se non arriva, l'indirizzo potrebbe " +
    'essere diverso da quello registrato al circolo: scrivi in segreteria.');
});

document.querySelectorAll('[data-back]').forEach((b) => {
  b.addEventListener('click', () => {
    clearInterval(countdownTimer);
    show(b.dataset.back);
  });
});

// Sessione già presente: per ora si limita a saltare il login. Quando ci sarà
// l'app vera, questo è il punto in cui si entra direttamente.
if (api.loadSession()) {
  show('sc-dentro');
}

$('in-telefono').focus();

// Aggancio per l'harness: espone lo stato interno alle sole pagine di test.
// In produzione resta inerte — è un oggetto in sola lettura su window.
window.__PMO_LOGIN__ = { S, show };
