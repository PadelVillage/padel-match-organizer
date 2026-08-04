import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  calcolaPiano,
  type JsonMap,
  payloadPerTest,
  type SchedaLocale,
  type SocioDaProd,
  sorgenteAffidabile,
} from './piano.ts';

// anagrafica-mirror — rende l'anagrafica di TEST una COPIA FEDELE di quella di
// PRODUZIONE. Gira SOLO su TEST, una volta a notte più un pulsante per lanciarla
// a mano.
//
// Decisione del committente (3/08/2026): «quando fai la sincronizzazione
// sovrascriviamo tutti i dati di prod su test, e quelli attuali di test si
// cancellano. Deve funzionare sempre così.» ⇒ non è una pulizia una tantum, è
// il modo di funzionare: aggiorna chi c'è, aggiunge chi manca, toglie chi su
// PROD non esiste.
//
// 🚨 L'UNICA COSA CHE NON VIENE DA PROD: il numero di scheda (`payload.id`) di
// chi esiste su tutt'e due resta quello di TEST. Non è un'attenuazione della
// sua decisione: cancellare e riscrivere davvero darebbe a ~2800 soci un numero
// nuovo OGNI NOTTE, e quel numero è l'etichetta con cui l'app tiene insieme
// storici e cassetti (memoria: identita-cassetto-numero-di-scheda). Il risultato
// visibile è identico; l'unica cosa che non si azzera non compare su nessuno
// schermo. Il ponte `anagrafica-export` il numero non lo manda proprio.
//
// 🔒 IL VERSO È IMPOSSIBILE DA INVERTIRE, e non perché il codice stia attento:
//   1. verso PROD si passa da `anagrafica-export`, che contiene SOLO `.select()`;
//   2. le scritture vanno su `SUPABASE_URL`, che è il progetto in cui questa
//      funzione È DEPLOYATA — non un indirizzo che qualcuno può sbagliare;
//   3. e se mai finisse deployata su PROD, la guardia qui sotto la ferma prima
//      di toccare una riga.

// 🚨 Il progetto di PRODUZIONE. Questa funzione non deve MAI scrivere lì: se si
// ritrova a girare su questo ref, si ferma. Guardia volutamente stupida e
// testabile — le guardie che dipendono da una configurazione si spengono con la
// configurazione.
const PROGETTO_PROD = 'qqbfphyslczzkxoncgex';

// Sotto questa quota rispetto a quanto TEST ha adesso, l'export di PROD è
// considerato monco e NON si cancella niente. Un mirror che cancella «tutto ciò
// che non è arrivato» quando è arrivato poco è il modo esatto in cui si svuota
// un'anagrafica per sbaglio.
const QUOTA_MINIMA = 0.9;

const BLOCCO = 500;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
function err(status: number, code: string, message: string, extra: JsonMap = {}) {
  return json({ ok: false, error: code, message, ...extra }, status);
}
function clean(value: unknown) { return String(value ?? '').trim(); }

// Confronto in tempo costante: su un segreto, un confronto che esce al primo
// carattere diverso racconta quanto si è andati vicini.
function safeEqualText(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

type StaffActor = { email: string; role: string; permissions: JsonMap };

function hasPermission(actor: StaffActor, perm: string) {
  if (['owner', 'admin'].includes(actor.role)) return true;
  return actor.permissions?.[perm] === true;
}

// Chi chiede lo specchio dal browser: si decodifica il SUO token e si chiede al
// database che ruolo ha. Stesso modo di `matchpoint-clients-create`.
// 🚨 La chiave pubblicabile da sola non basta a passare di qui: sta scritta in
// chiaro in `config-test.js`, quindi un controllo che si accontentasse di quella
// non sarebbe un controllo.
async function getActor(req: Request): Promise<StaffActor | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const token = clean(req.headers.get('authorization')).replace(/^Bearer\s+/i, '');
  if (!token || !supabaseUrl || !anonKey) return null;

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: userData, error } = await authClient.auth.getUser(token);
  if (error || !userData?.user) return null;

  const { data: profileData, error: profileError } = await authClient.rpc('pmo_get_my_staff_profile');
  if (profileError || !profileData) return null;
  const profile = (Array.isArray(profileData) ? profileData[0] : profileData) as JsonMap | null;
  if (!profile || profile.status !== 'active') return null;

  return {
    email: clean(profile.email || userData.user.email || ''),
    role: String(profile.role ?? 'staff'),
    permissions: (profile.permissions as JsonMap) ?? {},
  };
}

async function scaricaDaProd(
  urlBase: string,
  secret: string,
): Promise<{ soci: SocioDaProd[]; totaleDichiarato: number }> {
  const soci: SocioDaProd[] = [];
  let offset = 0;
  let totaleDichiarato = 0;
  // Tetto di giri: una `has_more` sempre vera non deve poter girare all'infinito.
  for (let giro = 0; giro < 50; giro++) {
    const risposta = await fetch(`${urlBase}/functions/v1/anagrafica-export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Anagrafica-Secret': secret,
      },
      body: JSON.stringify({ offset, limit: BLOCCO }),
    });
    const testo = await risposta.text();
    if (!risposta.ok) {
      throw new Error(`export PROD ha risposto ${risposta.status}: ${testo.slice(0, 200)}`);
    }
    const dati = JSON.parse(testo) as JsonMap;
    if (dati.ok !== true) {
      throw new Error(`export PROD ha rifiutato: ${testo.slice(0, 200)}`);
    }
    totaleDichiarato = Number(dati.totale ?? 0);
    for (const riga of (dati.soci ?? []) as JsonMap[]) {
      const chiave = clean(riga.local_key);
      if (!chiave) continue;
      soci.push({ local_key: chiave, payload: (riga.payload ?? {}) as JsonMap });
    }
    if (dati.has_more !== true) break;
    offset += BLOCCO;
  }
  return { soci, totaleDichiarato };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return err(405, 'METHOD_NOT_ALLOWED', 'Usare POST.');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    return err(503, 'MISSING_ENV', 'SUPABASE_URL/SERVICE_ROLE_KEY non configurati.');
  }

  // ── Guardia 3: non si scrive su PRODUZIONE, mai ────────────────────────────
  if (supabaseUrl.includes(PROGETTO_PROD)) {
    console.error('[anagrafica-mirror] RIFIUTO: girerei sul progetto di PRODUZIONE.');
    return err(
      403,
      'RIFIUTO_SCRITTURA_PROD',
      'Questa funzione scrive l\'anagrafica: sul progetto di PRODUZIONE non deve girare.',
    );
  }

  const secret = clean(Deno.env.get('ANAGRAFICA_MIRROR_SECRET'));
  const sorgente = clean(Deno.env.get('ANAGRAFICA_SOURCE_URL'));
  if (!secret || !sorgente) {
    return err(
      503,
      'MIRROR_DISARMED',
      'ANAGRAFICA_MIRROR_SECRET / ANAGRAFICA_SOURCE_URL non configurati.',
    );
  }
  if (sorgente.includes(new URL(supabaseUrl).hostname)) {
    return err(400, 'SORGENTE_UGUALE_DESTINAZIONE', 'La sorgente coincide con la destinazione.');
  }

  let body: JsonMap = {};
  try {
    const raw = await req.text();
    body = raw ? JSON.parse(raw) as JsonMap : {};
  } catch {
    return err(400, 'BAD_JSON', 'Body non è JSON valido.');
  }
  // 🚨 Nasce a VUOTO: per scrivere davvero bisogna chiederlo. Chi la lancia per
  // sbaglio ottiene un rapporto, non 2800 righe riscritte.
  const scriviDavvero = body.scrivi === true;

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // ── Guardia 0: chi può chiedere lo specchio ────────────────────────────────
  // Due sole vie, e nessuna delle due è «conoscere l'indirizzo»:
  //   • il CRON, con la chiave che sta nel vault (generata dal database: non la
  //     conosce nessuno, nemmeno chi l'ha messa in piedi);
  //   • lo STAFF dal browser, col permesso `cloud_sync`.
  // 🚨 Senza questo cancello la funzione era raggiungibile da chiunque ne
  // sapesse l'indirizzo — e la risposta contiene numeri di telefono dei soci.
  const chiaveRicevuta = clean(req.headers.get('x-cron-key'));
  let comeEntra = '';
  if (chiaveRicevuta) {
    const { data: chiaveVera } = await service.rpc('pmo_anagrafica_cron_key');
    if (chiaveVera && safeEqualText(chiaveRicevuta, String(chiaveVera))) comeEntra = 'cron';
  }
  if (!comeEntra) {
    const attore = await getActor(req);
    if (attore && hasPermission(attore, 'cloud_sync')) comeEntra = `staff ${attore.email}`;
  }
  if (!comeEntra) {
    console.warn('[anagrafica-mirror] chiamata respinta: né chiave del cron né staff.');
    return err(401, 'NON_AUTORIZZATO', 'Serve la chiave del cron o una sessione staff con cloud_sync.');
  }
  console.log(`[anagrafica-mirror] richiesta da: ${comeEntra}`);

  // ── 1. L'anagrafica di PROD, tutta, contata ────────────────────────────────
  let daProd: SocioDaProd[];
  let totaleDichiarato: number;
  try {
    const esito = await scaricaDaProd(sorgente, secret);
    daProd = esito.soci;
    totaleDichiarato = esito.totaleDichiarato;
  } catch (e) {
    console.error('[anagrafica-mirror] scarico fallito:', (e as Error).message);
    return err(502, 'SORGENTE_NON_RAGGIUNGIBILE', (e as Error).message);
  }

  // 🚨 Controllo di arrivo: quello che ho in mano deve essere quanto PROD dice
  // di avere. Senza questo, una pagina persa diventa una cancellazione di massa.
  if (daProd.length !== totaleDichiarato) {
    return err(502, 'SCARICO_INCOMPLETO', 'Ricevuti meno soci di quanti PROD ne dichiara.', {
      ricevuti: daProd.length,
      dichiarati: totaleDichiarato,
    });
  }
  const chiaviUniche = new Set(daProd.map((s) => s.local_key));
  if (chiaviUniche.size !== daProd.length) {
    return err(502, 'CHIAVI_DOPPIE', 'La sorgente ha mandato due volte la stessa chiave.');
  }

  // ── 2. Com'è messa TEST adesso ─────────────────────────────────────────────
  const suTest: SchedaLocale[] = [];
  for (let da = 0; ; da += 1000) {
    const { data, error } = await service
      .from('pmo_cloud_records')
      .select('local_key,payload,deleted')
      .eq('record_type', 'member')
      .order('local_key', { ascending: true })
      .range(da, da + 999);
    if (error) {
      console.error('[anagrafica-mirror] errore lettura TEST:', error.message);
      return err(500, 'DB_ERROR', 'Errore lettura anagrafica di TEST.');
    }
    for (const riga of data ?? []) {
      suTest.push({
        local_key: clean(riga.local_key),
        id: clean((riga.payload as JsonMap | null)?.id),
        deleted: riga.deleted === true,
      });
    }
    if (!data || data.length < 1000) break;
  }

  const viviSuTest = suTest.filter((s) => !s.deleted).length;
  const piano = calcolaPiano(daProd, suTest);

  // 🚨 Guardia sulla quota: se PROD ne manda molti meno di quanti TEST ne ha,
  // qualcosa è andato storto a monte. Meglio non fare niente che svuotare.
  const affidabile = sorgenteAffidabile(daProd.length, viviSuTest, QUOTA_MINIMA);

  const rapporto = {
    da_prod: daProd.length,
    vivi_su_test_prima: viviSuTest,
    aggiornati: piano.aggiornati.length,
    aggiunti: piano.aggiunti.length,
    cancellati: piano.cancellati.length,
    esempi_aggiunti: piano.aggiunti.slice(0, 10),
    esempi_cancellati: piano.cancellati.slice(0, 10),
  };

  if (!affidabile) {
    console.error(
      `[anagrafica-mirror] RIFIUTO: PROD ne manda ${daProd.length} contro ${viviSuTest} vivi su TEST.`,
    );
    return err(409, 'SORGENTE_TROPPO_PICCOLA', 'La sorgente ha troppi pochi soci: non tocco niente.', rapporto);
  }

  if (!scriviDavvero) {
    console.log('[anagrafica-mirror] PROVA A VUOTO:', JSON.stringify(rapporto));
    return json({ ok: true, prova_a_vuoto: true, ...rapporto });
  }

  // ── 3. Scrittura, solo su TEST ─────────────────────────────────────────────
  const idPerChiave = new Map(suTest.map((s) => [s.local_key, s.id]));
  const righe = daProd.map((socio) => ({
    record_type: 'member',
    local_key: socio.local_key,
    payload: payloadPerTest(socio.payload, idPerChiave.get(socio.local_key) ?? ''),
    deleted: false,
  }));

  for (let i = 0; i < righe.length; i += BLOCCO) {
    const { error } = await service
      .from('pmo_cloud_records')
      .upsert(righe.slice(i, i + BLOCCO), { onConflict: 'record_type,local_key' });
    if (error) {
      console.error('[anagrafica-mirror] errore upsert:', error.message);
      return err(500, 'DB_ERROR', 'Errore scrittura anagrafica di TEST.', rapporto);
    }
  }

  // Le schede che su PROD non ci sono escono di scena in modo REVERSIBILE
  // (`deleted = true`): l'app non le vede più — che è ciò che lui ha chiesto —
  // ma una cancellazione vera non si torna indietro, e qui non serve.
  for (let i = 0; i < piano.cancellati.length; i += BLOCCO) {
    const { error } = await service
      .from('pmo_cloud_records')
      .update({ deleted: true })
      .eq('record_type', 'member')
      .in('local_key', piano.cancellati.slice(i, i + BLOCCO));
    if (error) {
      console.error('[anagrafica-mirror] errore cancellazione:', error.message);
      return err(500, 'DB_ERROR', 'Errore rimozione schede non più su PROD.', rapporto);
    }
  }

  console.log('[anagrafica-mirror] FATTO:', JSON.stringify(rapporto));
  return json({ ok: true, prova_a_vuoto: false, ...rapporto });
});
