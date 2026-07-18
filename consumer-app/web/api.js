// api.js — l'unico punto dell'app che parla con la rete.
//
// Il browser vede tre endpoint e nient'altro. In particolare NON vede mai:
// il cognome del socio, la sua email in anagrafica, il suo memberId Matchpoint.
// L'identità viaggia come `challenge_id` opaco finché il codice non è verificato.

const PROJECT_URL = 'https://aylykijfirtegyxzdwgu.supabase.co';

// Chiave PUBBLICABILE: è progettata per stare nel client (finisce comunque nel
// sorgente di qualunque pagina che parli con Supabase). Non dà accesso ai dati:
// il cancello è la RLS, più il fatto che le tabelle del login non hanno policy.
const PUBLISHABLE_KEY = 'sb_publishable_OxDoNIxlLzpcQ0ORqQyONw_zf-_2qYO';

const SESSION_KEY = 'pmo_consumer_session';

async function callFunction(name, body) {
  let res;
  try {
    res = await fetch(`${PROJECT_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: PUBLISHABLE_KEY,
        Authorization: `Bearer ${PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    // Rete assente o richiesta bloccata: non è un errore dell'utente.
    return { ok: false, error: 'NETWORK', message: 'Connessione assente.' };
  }
  const data = await res.json().catch(() => null);
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'BAD_RESPONSE', message: 'Risposta non leggibile.' };
  }
  return data;
}

/** Passo 1 — telefono → nome di battesimo (o più nomi, se il numero è condiviso). */
export function identify(phoneLast10) {
  return callFunction('consumer-auth-start', { step: 'identify', phone: phoneLast10 });
}

/**
 * Passo 2 — email digitata a confronto con la scheda.
 * Risponde sempre allo stesso modo, che l'email combaci o no: la differenza
 * sta solo nel fatto che il codice parta davvero.
 */
export function challenge(phoneLast10, candidateIndex, email) {
  return callFunction('consumer-auth-start', {
    step: 'challenge',
    phone: phoneLast10,
    candidate_index: candidateIndex,
    email,
  });
}

/** Passo 3 — codice a 6 cifre → sessione. */
export function verify(challengeId, code) {
  return callFunction('consumer-auth-verify', { challenge_id: challengeId, code });
}

/**
 * La sessione vive in localStorage, come fa la libreria Supabase.
 * L'access token porta il claim matchpoint_member_id: è quello che la RLS
 * userà per decidere cosa il socio può vedere.
 */
export function saveSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      saved_at: Date.now(),
    }));
    return true;
  } catch (e) {
    // Quota piena o storage negato (Safari in navigazione privata): l'accesso
    // è comunque riuscito, semplicemente non sopravvive alla chiusura.
    console.warn('[api] sessione non salvata:', e);
    return false;
  }
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* niente da fare */ }
}
