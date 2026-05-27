import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GITHUB_OWNER = 'PadelVillage';
const GITHUB_REPO  = 'padel-match-organizer';
const GITHUB_PATH  = 'supabase/functions/parser-rules/parser_rules.json';

type StaffActor = { userId: string; email: string; role: string; permissions: Record<string, unknown> };
type Modifica   = { tipo: string; [key: string]: unknown };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function clean(v: unknown) { return String(v ?? '').trim(); }

function isAdmin(actor: StaffActor) {
  return ['owner', 'admin'].includes(actor.role);
}

async function authenticateStaff(req: Request, supabaseUrl: string, anonKey: string): Promise<StaffActor> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('AUTH_REQUIRED');
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData?.user) throw new Error('AUTH_REQUIRED');
  const { data: profileData, error: profileError } = await authClient.rpc('pmo_get_my_staff_profile');
  if (profileError) throw new Error(profileError.message || 'AUTH_REQUIRED');
  const profile = Array.isArray(profileData) ? profileData[0] : profileData;
  if (!profile || profile.status !== 'active') throw new Error('AUTH_REQUIRED');
  return {
    userId: userData.user.id,
    email: clean(profile.email || userData.user.email || ''),
    role: clean(profile.role || 'staff'),
    permissions: profile.permissions || {},
  };
}

// ── GitHub API helpers ────────────────────────────────────────────────────────

async function githubGetFile(token: string, branch: string) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}?ref=${branch}`,
    { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'PMO-ParserUpdate/1.0' } }
  );
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status}`);
  const data = await res.json();
  const content = atob(data.content.replace(/\s/g, ''));
  return { sha: data.sha, json: JSON.parse(content) };
}

async function githubPutFile(token: string, branch: string, sha: string, newJson: unknown, message: string) {
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(newJson, null, 2))));
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'PMO-ParserUpdate/1.0',
      },
      body: JSON.stringify({ message, content, sha, branch }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub PUT failed: ${res.status} — ${err}`);
  }
  return await res.json();
}

// ── Merge delle modifiche nel JSON delle regole ───────────────────────────────

function incrementVersion(versione: string): string {
  const m = versione.match(/^v(\d+)\.(\d+)(-.*)?$/);
  if (!m) return versione + '.1';
  return `v${m[1]}.${parseInt(m[2]) + 1}`;
}

function applyModifiche(rules: Record<string, unknown>, modifiche: Modifica[], attore: string): Record<string, unknown> {
  const updated = JSON.parse(JSON.stringify(rules)) as Record<string, unknown>;
  const versione_nuova = incrementVersion(clean(rules.versione));

  for (const mod of modifiche) {
    if (mod.tipo === 'sinonimo_aggiunto' && mod.intent && mod.sinonimo_nuovo) {
      const intents = updated.intents as Record<string, Record<string, unknown>>;
      const intent = intents?.[mod.intent as string];
      if (intent) {
        const sin = (intent.sinonimi as string[]) || [];
        if (!sin.includes(mod.sinonimo_nuovo as string)) sin.push(mod.sinonimo_nuovo as string);
        intent.sinonimi = sin;
      }
    } else if (mod.tipo === 'fuzzy_match_aggiunto' && mod.campo === 'istruttore' && mod.mapping) {
      const campi = updated.campi_opzionali as Record<string, Record<string, unknown>>;
      const istr = campi?.istruttore;
      if (istr) {
        istr.fuzzy_match = { ...(istr.fuzzy_match as object || {}), ...(mod.mapping as object) };
      }
    }
  }

  const logEntry = {
    versione: versione_nuova,
    data: new Date().toISOString().slice(0, 10),
    modifiche: modifiche.map(m => m.tipo).join(', '),
    aggiornato_da: attore,
  };
  const log = (updated.log_evoluzione as unknown[]) || [];
  log.push(logEntry);
  updated.log_evoluzione = log;
  updated.versione = versione_nuova;
  updated.data_ultimo_aggiornamento = new Date().toISOString();
  updated.aggiornato_da = attore;
  return updated;
}

// ── Handler principale ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);

  const supabaseUrl     = Deno.env.get('SUPABASE_URL') || '';
  const anonKey         = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceRoleKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const githubToken     = Deno.env.get('GITHUB_PERSONAL_TOKEN') || '';

  if (!githubToken) return json({ ok: false, error: 'GITHUB_TOKEN_NOT_CONFIGURED' }, 500);

  let actor: StaffActor;
  try {
    actor = await authenticateStaff(req, supabaseUrl, anonKey);
  } catch {
    return json({ ok: false, error: 'AUTH_REQUIRED' }, 401);
  }

  if (!isAdmin(actor)) return json({ ok: false, error: 'PERMISSION_DENIED' }, 403);

  let body: { modifiche: Modifica[]; error_ids: string[]; branch?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'INVALID_JSON' }, 400);
  }

  const { modifiche, error_ids, branch = 'main' } = body;
  if (!Array.isArray(modifiche) || modifiche.length === 0) {
    return json({ ok: false, error: 'NO_MODIFICHE' }, 400);
  }

  try {
    // 1. Leggi file attuale da GitHub
    const { sha, json: currentRules } = await githubGetFile(githubToken, branch);

    // 2. Applica modifiche
    const newRules = applyModifiche(currentRules as Record<string, unknown>, modifiche, 'admin_panel');
    const versione_nuova = clean(newRules.versione as string);
    const nPatterns = modifiche.length;
    const commitMsg = `Auto-fix ${versione_nuova}: ${nPatterns} pattern${nPatterns === 1 ? '' : 's'} corretto`;

    // 3. Commit su GitHub
    await githubPutFile(githubToken, branch, sha, newRules, commitMsg);

    // 4. Salva snapshot in pmo_parser_config
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    await admin.from('pmo_parser_config').insert({
      versione: versione_nuova,
      regole_json: newRules,
      aggiornato_da: 'admin_panel',
      data_aggiornamento: new Date().toISOString(),
      note: `Updated via admin panel by ${actor.email}`,
    });

    // 5. Marca errori come processati (FASE 3)
    let error_ids_updated = 0;
    if (Array.isArray(error_ids) && error_ids.length > 0) {
      const { data: updated } = await admin
        .from('pmo_parser_errors')
        .update({ admin_selected: true })
        .in('id', error_ids)
        .select('id');
      error_ids_updated = updated?.length ?? error_ids.length;
    }

    return json({ ok: true, versione_nuova, commit_message: commitMsg, error_ids_updated, regole_nuove: newRules });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[parser-rules-update]', message);
    return json({ ok: false, error: message }, 500);
  }
});
