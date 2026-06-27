import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

// matchpoint-wallet-sync — sincronizza i SALDI BORSELLINO (Monedero) di TUTTI i soci da
// Matchpoint, in un colpo solo, dal report "Clienti con credito residuo" (Inf. e statistiche →
// Clienti), che esporta un Excel con colonne: Cod. · Cliente · E-mail · Telefono cellulare · Saldo.
// SOLA LETTURA su MP (scarica un report, nessun denaro mosso). Upsert dei record `wallet_balance`
// in pmo_cloud_records, abbinando ogni riga al socio per codice/email/nome. I clienti NON presenti
// nel report non hanno credito → il saldo va azzerato (così la colonna non resta "appiccicata").
//
// Sorgente bytes Excel: o `xlsxBase64` nel body (import manuale / collaudo col file reale), oppure
// il worker browser (`POST /export-wallet-report`) che genera ed esporta il report.

type JsonMap = Record<string, unknown>;

type StaffActor = {
  userId: string;
  email: string;
  role: string;
  permissions: JsonMap;
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pmo-routine-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_BASE_URL = 'https://app-padelvillage-it.matchpoint.com.es';
const SUPABASE_PAGE_SIZE = 1000;
const SALDO_COLUMNS = ['Saldo', 'Saldo residuo', 'Credito residuo', 'Credito', 'Balance'];
const COD_COLUMNS = ['Cod.', 'Cod', 'Codice', 'Code'];
const NAME_COLUMNS = ['Cliente', 'Nominativo', 'Nome e cognome', 'Nome completo'];
const EMAIL_COLUMNS = ['E-mail', 'Email', 'Mail'];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
function ok(body: JsonMap) { return json({ ok: true, ...body }); }
function err(status: number, code: string, message: string, extra: JsonMap = {}) {
  return json({ ok: false, error: code, message, ...extra }, status);
}
function clean(value: unknown) { return String(value ?? '').trim(); }
function errorText(value: unknown) {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message || String(value);
  try { return JSON.stringify(value); } catch { return String(value); }
}

// Centesimi interi da una stringa importo IT/MP ("5" = 5,00 €, "1.234,50" = 1234,50 €). Mirror
// di mpMoneyToCents del worker: gestisce sia il numero secco ("5") sia il formato IT con virgola.
function mpMoneyToCents(text: unknown): number | null {
  const s = String(text == null ? '' : text);
  const m = s.match(/-?\d[\d.\s]*,\d{1,2}|-?\d[\d.\s]*/);
  if (!m) return null;
  let num = m[0].replace(/\s/g, '');
  if (num.includes(',')) num = num.replace(/\./g, '').replace(',', '.');
  const val = Number(num);
  return Number.isFinite(val) ? Math.round(val * 100) : null;
}

function normalizeHeader(value: unknown) {
  return clean(value).toLowerCase().replace(/[\s._-]+/g, '').replace(/[àáâ]/g, 'a').replace(/[èé]/g, 'e').replace(/[ìí]/g, 'i').replace(/[òó]/g, 'o').replace(/[ùú]/g, 'u');
}
// Codice cliente comparabile: solo cifre, senza zeri iniziali ("000004" → "4", "4" → "4").
function normalizeCode(value: unknown) {
  const digits = clean(value).replace(/\D/g, '').replace(/^0+/, '');
  return digits;
}
function normalizeEmail(value: unknown) { return clean(value).toLowerCase(); }
function normalizeName(value: unknown) {
  return clean(value).toLowerCase().replace(/[àáâ]/g, 'a').replace(/[èé]/g, 'e').replace(/[ìí]/g, 'i').replace(/[òó]/g, 'o').replace(/[ùú]/g, 'u').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function getCell(row: JsonMap, names: string[]) {
  const normalized = new Map<string, string>();
  Object.keys(row || {}).forEach((key) => normalized.set(normalizeHeader(key), key));
  for (const name of names) {
    const key = normalized.get(normalizeHeader(name));
    if (key !== undefined) return row[key];
  }
  return '';
}

function hasPermission(actor: StaffActor, perm: string) {
  if (['owner', 'admin'].includes(actor.role)) return true;
  return actor.permissions?.[perm] === true;
}

async function getActor(req: Request): Promise<StaffActor | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const token = clean(req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token || !supabaseUrl || !anonKey) return null;
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: userData, error } = await authClient.auth.getUser(token);
  if (error || !userData?.user) return null;
  const { data: profileData, error: profileError } = await authClient.rpc('pmo_get_my_staff_profile');
  if (profileError || !profileData) return null;
  const profile = Array.isArray(profileData) ? profileData[0] : profileData;
  if (!profile || profile.status !== 'active') return null;
  return {
    userId: userData.user.id,
    email: clean(profile.email || userData.user.email || ''),
    role: String(profile.role ?? 'staff'),
    permissions: (profile.permissions as JsonMap) ?? {},
  };
}

// Routine schedulata (cron pg_cron): valida l'header x-pmo-routine-secret contro il vault
// (stesso meccanismo di ai-propose-lexicon). Permette al cron di girare senza JWT staff.
async function verifyRoutineSecret(admin: ReturnType<typeof createClient>, secret: string) {
  const value = clean(secret);
  if (!value) return false;
  const { data, error } = await admin.rpc('pmo_verify_data_routine_secret', { p_secret: value });
  if (error) return false;
  return data === true;
}

// Chiama il worker browser per generare ed esportare il report saldi. Ritorna i bytes Excel (base64).
async function callWorkerExportWallet(opts: {
  workerUrl: string; workerApiKey: string; username: string; password: string; baseUrl: string;
}): Promise<Uint8Array> {
  const { workerUrl, workerApiKey, username, password, baseUrl } = opts;
  let res: Response;
  try {
    res = await fetch(`${workerUrl}/export-wallet-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${workerApiKey}` },
      body: JSON.stringify({ username, password, baseUrl }),
    });
  } catch (netErr) {
    const e = new Error(`Worker network error: ${errorText(netErr)}`) as Error & { code: string };
    e.code = 'WORKER_NETWORK_ERROR';
    throw e;
  }
  const body = await res.json().catch(() => ({})) as JsonMap;
  if (!res.ok || body.ok === false) {
    const code = clean(body.error) || 'WORKER_ERROR';
    const e = new Error(errorText(body.message || code)) as Error & { code: string; diagnostic?: unknown };
    e.code = code;
    e.diagnostic = body.diagnostic;
    throw e;
  }
  const b64 = clean(body.base64);
  if (!b64) {
    const e = new Error('Worker non ha restituito il file Excel del report saldi.') as Error & { code: string };
    e.code = 'WORKER_EMPTY_DOWNLOAD';
    throw e;
  }
  return base64ToBytes(b64);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

type WalletRow = { cod: string; name: string; email: string; balanceCents: number };

// Parsa l'Excel del report. Sheet-agnostico: usa il primo foglio che contiene la colonna Saldo.
// Scarta la riga totali finale (Cod. non numerico / "Totale…").
function parseWalletWorkbook(bytes: Uint8Array): { ok: true; rows: WalletRow[]; headers: string[]; sourceRows: number } | { ok: false; error: string; message: string; sheetNames?: string[]; headers?: string[] } {
  let workbook: XLSX.WorkBook;
  try { workbook = XLSX.read(bytes, { type: 'array' }); }
  catch (e) { return { ok: false, error: 'XLSX_READ_FAILED', message: errorText(e) }; }
  let chosenSheet: string | null = null;
  let headers: string[] = [];
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as unknown[][];
    const hdr = (matrix[0] || []).map((item) => clean(item));
    const normSet = new Set(hdr.map(normalizeHeader));
    const hasSaldo = SALDO_COLUMNS.some((c) => normSet.has(normalizeHeader(c)));
    const hasCod = COD_COLUMNS.some((c) => normSet.has(normalizeHeader(c)));
    if (hasSaldo && hasCod) { chosenSheet = name; headers = hdr; break; }
  }
  if (!chosenSheet) {
    return { ok: false, error: 'WALLET_COLUMNS_MISSING', message: 'Il file non contiene le colonne Cod./Saldo del report borsellino.', sheetNames: workbook.SheetNames };
  }
  const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[chosenSheet], { defval: '', raw: false }) as JsonMap[];
  const rows: WalletRow[] = [];
  for (const row of rawRows) {
    const codNorm = normalizeCode(getCell(row, COD_COLUMNS));
    // Riga totali / vuota: Cod. non è un codice numerico → scarta.
    if (!codNorm) continue;
    const balanceCents = mpMoneyToCents(getCell(row, SALDO_COLUMNS));
    if (balanceCents === null) continue;
    rows.push({
      cod: codNorm,
      name: clean(getCell(row, NAME_COLUMNS)),
      email: clean(getCell(row, EMAIL_COLUMNS)),
      balanceCents,
    });
  }
  return { ok: true, rows, headers, sourceRows: rawRows.length };
}

type MemberRecord = { local_key: string; payload: JsonMap };
type MemberIndex = { records: MemberRecord[]; byCode: Map<string, MemberRecord>; byEmail: Map<string, MemberRecord>; byName: Map<string, MemberRecord> };

async function loadMembers(admin: ReturnType<typeof createClient>): Promise<MemberIndex> {
  const records: MemberRecord[] = [];
  for (let from = 0, page = 0; page < 50; page += 1, from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await admin
      .from('pmo_cloud_records')
      .select('local_key,payload')
      .eq('record_type', 'member')
      .eq('deleted', false)
      .range(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) throw error;
    const pageRecords = (Array.isArray(data) ? data : []) as MemberRecord[];
    records.push(...pageRecords);
    if (pageRecords.length < SUPABASE_PAGE_SIZE) break;
  }
  const byCode = new Map<string, MemberRecord>();
  const byEmail = new Map<string, MemberRecord>();
  const byName = new Map<string, MemberRecord>();
  for (const rec of records) {
    const p = rec.payload || {};
    const code = normalizeCode(p.memberId);
    if (code && !byCode.has(code)) byCode.set(code, rec);
    const email = normalizeEmail(p.email);
    if (email && !byEmail.has(email)) byEmail.set(email, rec);
    const name = normalizeName(p.name || `${clean(p.firstName)} ${clean(p.surname)}`);
    if (name && !byName.has(name)) byName.set(name, rec);
  }
  return { records, byCode, byEmail, byName };
}

function memberLocalId(rec: MemberRecord): string {
  const p = rec.payload || {};
  return clean(p.id) || clean(rec.local_key);
}

// Carica i record wallet_balance già presenti (per azzerare chi è uscito dal report).
async function loadWalletBalances(admin: ReturnType<typeof createClient>): Promise<MemberRecord[]> {
  const records: MemberRecord[] = [];
  for (let from = 0, page = 0; page < 20; page += 1, from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await admin
      .from('pmo_cloud_records')
      .select('local_key,payload')
      .eq('record_type', 'wallet_balance')
      .eq('deleted', false)
      .range(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) throw error;
    const pageRecords = (Array.isArray(data) ? data : []) as MemberRecord[];
    records.push(...pageRecords);
    if (pageRecords.length < SUPABASE_PAGE_SIZE) break;
  }
  return records;
}

async function logAudit(admin: ReturnType<typeof createClient>, actor: StaffActor | null, action: string, detail: JsonMap) {
  if (!actor) return;
  await admin.from('pmo_audit_log').insert({
    actor_user_id: actor.userId,
    actor_email: actor.email,
    actor_role: actor.role,
    action,
    detail,
  }).then(() => {}, () => {});
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return err(405, 'METHOD_NOT_ALLOWED', 'Only POST supported');

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) return err(500, 'SUPABASE_NOT_CONFIGURED', 'Configurazione Supabase mancante.');
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // Due vie d'accesso: la routine schedulata (x-pmo-routine-secret, cron ~30 min) oppure lo staff
  // loggato con permesso cloud_sync che preme "↻ Aggiorna saldi borsellino".
  const routineOk = await verifyRoutineSecret(admin, req.headers.get('x-pmo-routine-secret') || '');
  let actor: StaffActor | null = null;
  if (!routineOk) {
    actor = await getActor(req).catch(() => null);
    if (!actor) return err(401, 'UNAUTHORIZED', 'Serve la routine secret oppure una sessione staff con permesso cloud_sync.');
    if (!hasPermission(actor, 'cloud_sync')) {
      return err(403, 'FORBIDDEN', 'Permesso cloud_sync richiesto per sincronizzare i saldi borsellino.');
    }
  }

  let body: JsonMap = {};
  try { body = await req.json(); } catch { /* body opzionale */ }

  // 1) Bytes Excel: manuale (xlsxBase64) o dal worker.
  let bytes: Uint8Array;
  const manualB64 = clean(body.xlsxBase64);
  let source = 'worker';
  try {
    if (manualB64) {
      source = 'manual';
      bytes = base64ToBytes(manualB64);
    } else {
      const workerUrl = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_URL'));
      const workerApiKey = clean(Deno.env.get('MATCHPOINT_BROWSER_WORKER_API_KEY'));
      const username = clean(Deno.env.get('MATCHPOINT_USERNAME'));
      const password = clean(Deno.env.get('MATCHPOINT_PASSWORD'));
      const baseUrl = clean(Deno.env.get('MATCHPOINT_BASE_URL')) || DEFAULT_BASE_URL;
      if (!workerUrl || !workerApiKey) return err(500, 'WORKER_NOT_CONFIGURED', 'Worker Matchpoint non configurato.');
      if (!username || !password) return err(500, 'MATCHPOINT_CREDENTIALS_MISSING', 'Credenziali Matchpoint non configurate.');
      bytes = await callWorkerExportWallet({ workerUrl, workerApiKey, username, password, baseUrl });
    }
  } catch (e) {
    const code = clean((e as { code?: string })?.code) || 'WORKER_ERROR';
    const diagnostic = (e as { diagnostic?: unknown })?.diagnostic;
    const status = code === 'WORKER_NETWORK_ERROR' ? 502 : 422;
    return err(status, code, errorText(e), diagnostic ? { diagnostic } : {});
  }

  // 2) Parsa il report.
  const parsed = parseWalletWorkbook(bytes);
  if (!parsed.ok) {
    await logAudit(admin, actor, 'matchpoint_wallet_sync_blocked', { source, error: parsed.error, message: parsed.message });
    return err(422, parsed.error, parsed.message, { sheetNames: parsed.sheetNames, headers: parsed.headers });
  }

  // 3) Abbina ogni riga al socio (codice → email → nome) e costruisci i record wallet_balance.
  const importedAt = new Date().toISOString();
  const members = await loadMembers(admin);
  const records: JsonMap[] = [];
  const seenLocalIds = new Set<string>();
  let matched = 0;
  const unmatchedSample: Array<{ cod: string; name: string }> = [];
  let totalBalanceCents = 0;

  for (const row of parsed.rows) {
    const rec = members.byCode.get(row.cod)
      || (row.email ? members.byEmail.get(normalizeEmail(row.email)) : undefined)
      || (row.name ? members.byName.get(normalizeName(row.name)) : undefined);
    if (!rec) {
      if (unmatchedSample.length < 50) unmatchedSample.push({ cod: row.cod, name: row.name });
      continue;
    }
    const localId = memberLocalId(rec);
    if (!localId || seenLocalIds.has(localId)) continue;
    seenLocalIds.add(localId);
    matched += 1;
    totalBalanceCents += row.balanceCents;
    records.push({
      record_type: 'wallet_balance',
      local_key: `wbal|${localId}`,
      payload: {
        member_local_id: localId,
        id_cliente: row.cod,
        player_name: row.name || clean((rec.payload || {}).name),
        balance_cents: row.balanceCents,
        source: 'matchpoint',
        synced_at: importedAt,
      },
      payload_hash: null,
      deleted: false,
      synced_at: importedAt,
    });
  }

  // 4) Riconcilia: chi aveva un saldo salvato ma NON è più nel report (credito esaurito) → 0.
  let zeroed = 0;
  const existingBalances = await loadWalletBalances(admin);
  for (const rec of existingBalances) {
    const p = rec.payload || {};
    const localId = clean(p.member_local_id) || clean(rec.local_key).replace(/^wbal\|/, '');
    if (seenLocalIds.has(localId)) continue;
    const prev = Number(p.balance_cents) || 0;
    if (prev === 0) continue; // già a zero, niente da fare
    zeroed += 1;
    records.push({
      record_type: 'wallet_balance',
      local_key: clean(rec.local_key) || `wbal|${localId}`,
      payload: { ...p, member_local_id: localId, balance_cents: 0, source: 'matchpoint', synced_at: importedAt },
      payload_hash: null,
      deleted: false,
      synced_at: importedAt,
    });
  }

  // 5) Record riepilogo (sezione Incassi / diagnostica).
  const summaryPayload: JsonMap = {
    synced_at: importedAt,
    source,
    reportRows: parsed.rows.length,
    matched,
    unmatched: parsed.rows.length - matched,
    zeroed,
    totalBalanceCents,
    headers: parsed.headers,
    unmatchedSample,
  };
  records.push({
    record_type: 'matchpoint_data',
    local_key: 'matchpoint_wallet_sync_last',
    payload: summaryPayload,
    payload_hash: null,
    deleted: false,
    synced_at: importedAt,
  });

  // 6) Upsert.
  const { error: upsertError } = await admin
    .from('pmo_cloud_records')
    .upsert(records, { onConflict: 'record_type,local_key' });
  if (upsertError) {
    await logAudit(admin, actor, 'matchpoint_wallet_sync_error', { source, message: errorText(upsertError) });
    return err(500, 'UPSERT_FAILED', errorText(upsertError));
  }

  // 7) Broadcast leggero ai device connessi (re-idratano la colonna Borsellino).
  let broadcast: JsonMap = { sent: 0, ok: true };
  try {
    const env = supabaseUrl.includes('qqbfphyslczzkxoncgex') ? 'prod' : 'test';
    const endpoint = `${supabaseUrl.replace(/\/+$/, '')}/realtime/v1/api/broadcast`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ messages: [{ topic: `pv-staff-cal-${env}`, event: 'wallet-sync-done', payload: { ts: Date.now(), matched, zeroed } }] }),
    });
    broadcast = { sent: res.ok ? 1 : 0, ok: res.ok, status: res.status };
  } catch (e) {
    broadcast = { sent: 0, ok: false, error: errorText(e) };
  }

  await logAudit(admin, actor, 'matchpoint_wallet_sync_success', { source, reportRows: parsed.rows.length, matched, unmatched: parsed.rows.length - matched, zeroed, totalBalanceCents });

  return ok({
    source,
    reportRows: parsed.rows.length,
    matched,
    unmatched: parsed.rows.length - matched,
    zeroed,
    totalBalanceCents,
    headers: parsed.headers,
    unmatchedSample,
    broadcast,
  });
});
