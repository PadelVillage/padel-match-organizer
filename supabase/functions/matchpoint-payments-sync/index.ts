import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import {
  buildMemberIndex,
  lookupMemberForRow,
  normalizeCode,
  type MemberIndex,
  type MemberRecord,
} from './member-code-guard.ts';

// matchpoint-payments-sync — sincronizza gli INCASSI delle prenotazioni dei campi da Matchpoint,
// dal report 11.13 "Pagamenti effettuati nelle prenotazioni" (Estadisticas/Reservas/
// ListadoPagosRealizados.aspx), che esporta un Excel con una riga per pagamento e colonne:
// Data Pagamento · D. Pagamento (metodo) · Importo Totale · Cod. · Nome · E-mail ·
// Numero di prenotazione · Giorno · Ora · Spazio. SOLA LETTURA su MP (scarica un report).
// Upsert dei record `payment` in pmo_cloud_records (uno per riga, idempotente per chiave composta),
// abbinando ogni pagamento al socio per codice/email/nome QUANDO possibile (un incasso conta nel
// totale anche se il cliente non è un socio app, es. "Ospite"). La sezione Incassi aggrega questi
// record per giorno/settimana/mese e li divide per metodo Cash/Card/Wallet.
//
// Sorgente bytes Excel: `xlsxBase64` nel body (collaudo col file reale) oppure il worker browser
// (`POST /export-payments-report`) con intervallo date.

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

// Colonne report 11.13 (header-name match, ordine irrilevante).
const PAYDATE_COLUMNS = ['Data Pagamento', 'Data pagamento', 'Fecha Cobro', 'Fecha de cobro'];
const METHOD_COLUMNS = ['D. Pagamento', 'D Pagamento', 'Forma di pagamento', 'Modalità di pagamento', 'Forma de pago'];
const AMOUNT_COLUMNS = ['Importo Totale', 'Importo totale', 'Importo', 'Imp. Totale', 'Importe'];
const COD_COLUMNS = ['Cod.', 'Cod', 'Codice', 'Code'];
const NAME_COLUMNS = ['Nome', 'Cliente', 'Nominativo'];
const EMAIL_COLUMNS = ['E-mail', 'Email', 'Mail'];
// ⚠️ Il report 11.13 intitola questa colonna "Numero di prenotazione" ma il valore è
// l'identificativo del CLIENTE Matchpoint (stesso valore su prenotazioni diverse dello
// stesso socio, diverso tra i 4 giocatori della stessa partita) → nel payload va come
// `id_cliente_mp`, NON come id della prenotazione.
const IDCLIENTE_MP_COLUMNS = ['Numero di prenotazione', 'N. prenotazione', 'Numero prenotazione', 'N° prenotazione'];
const BOOKDAY_COLUMNS = ['Giorno'];
const BOOKTIME_COLUMNS = ['Ora'];
const SPACE_COLUMNS = ['Spazio', 'Campo'];
const REF_COLUMNS = ['Rif. Pagamento', 'Rif Pagamento', 'Riferimento', 'Ref. pago'];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
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

// Centesimi interi da importo IT/MP ("10,00"→1000, "5"→500, "1.234,50"→123450).
function mpMoneyToCents(text: unknown): number | null {
  const s = String(text == null ? '' : text);
  const m = s.match(/-?\d[\d.\s]*,\d{1,2}|-?\d[\d.\s]*/);
  if (!m) return null;
  let num = m[0].replace(/\s/g, '');
  if (num.includes(',')) num = num.replace(/\./g, '').replace(',', '.');
  const val = Number(num);
  return Number.isFinite(val) ? Math.round(val * 100) : null;
}

// Metodo canonico a 3 bucket + residuo: Contanti→cash, Carta/Online→card, Saldo/Prepagato→wallet,
// else→other. "Online" su MP = pagamento col gateway/pasarela online = carta incassata online →
// per la nostra app rientra in Card (decisione committente 29/06).
function normalizeMethod(value: unknown): 'cash' | 'card' | 'wallet' | 'other' {
  const s = clean(value).toLowerCase();
  if (/contant|efectiv|cash/.test(s)) return 'cash';
  if (/cart|tarjet|\bcard\b|bancomat|pos\b|online|pasarela|gateway|\btpv\b/.test(s)) return 'card';
  if (/saldo|prepag|monedero|borsell|wallet|credito/.test(s)) return 'wallet';
  return 'other'; // Emettere fattura, Regalare, Assegno, Bonifico…
}

// "22/06/2026" → "2026-06-22". Accetta anche già-ISO. Vuoto se non parsabile.
function itDateToIso(value: unknown): string {
  const s = clean(value);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

function normalizeHeader(value: unknown) {
  return clean(value).toLowerCase().replace(/[\s._-]+/g, '').replace(/[àáâ]/g, 'a').replace(/[èé]/g, 'e').replace(/[ìí]/g, 'i').replace(/[òó]/g, 'o').replace(/[ùú]/g, 'u');
}
// normalizeCode / normalizeEmail / normalizeName vivono in ./member-code-guard.ts insieme alle
// regole di aggancio: erano la stessa cosa scritta in due punti, e il difetto del 22/07 stava
// proprio nella distanza fra "come si riduce un codice" e "chi ha diritto di essere indicizzato".

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
  const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
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

async function verifyRoutineSecret(admin: ReturnType<typeof createClient>, secret: string) {
  const value = clean(secret);
  if (!value) return false;
  const { data, error } = await admin.rpc('pmo_verify_data_routine_secret', { p_secret: value });
  if (error) return false;
  return data === true;
}

// Chiama il worker per generare ed esportare il report pagamenti. Ritorna i bytes Excel.
async function callWorkerExportPayments(opts: {
  workerUrl: string; workerApiKey: string; username: string; password: string; baseUrl: string; dateFrom?: string; dateTo?: string; days?: number;
}): Promise<Uint8Array> {
  const { workerUrl, workerApiKey, username, password, baseUrl, dateFrom, dateTo, days } = opts;
  let res: Response;
  try {
    res = await fetch(`${workerUrl}/export-payments-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${workerApiKey}` },
      body: JSON.stringify({ username, password, baseUrl, dateFrom, dateTo, days }),
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
    const e = new Error('Worker non ha restituito il file Excel del report pagamenti.') as Error & { code: string };
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

type PaymentRow = {
  payDateIso: string; method: 'cash' | 'card' | 'wallet' | 'other'; amountCents: number;
  cod: string; name: string; email: string; idClienteMp: string; bookDayIso: string; ora: string; campo: string; ref: string;
};

// Parsa l'Excel. Sheet col primo foglio che ha Data Pagamento + Importo. Scarta righe totali/vuote.
function parsePaymentsWorkbook(bytes: Uint8Array): { ok: true; rows: PaymentRow[]; headers: string[]; sourceRows: number } | { ok: false; error: string; message: string; sheetNames?: string[]; headers?: string[] } {
  let workbook: XLSX.WorkBook;
  try { workbook = XLSX.read(bytes, { type: 'array' }); }
  catch (e) { return { ok: false, error: 'XLSX_READ_FAILED', message: errorText(e) }; }
  let chosenSheet: string | null = null;
  let headers: string[] = [];
  for (const name of workbook.SheetNames) {
    const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '', raw: false }) as unknown[][];
    const hdr = (matrix[0] || []).map((item) => clean(item));
    const normSet = new Set(hdr.map(normalizeHeader));
    const hasDate = PAYDATE_COLUMNS.some((c) => normSet.has(normalizeHeader(c)));
    const hasAmount = AMOUNT_COLUMNS.some((c) => normSet.has(normalizeHeader(c)));
    if (hasDate && hasAmount) { chosenSheet = name; headers = hdr; break; }
  }
  if (!chosenSheet) {
    return { ok: false, error: 'PAYMENTS_COLUMNS_MISSING', message: 'Il file non contiene le colonne Data Pagamento/Importo del report pagamenti.', sheetNames: workbook.SheetNames };
  }
  const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[chosenSheet], { defval: '', raw: false }) as JsonMap[];
  const rows: PaymentRow[] = [];
  for (const row of rawRows) {
    const payDateIso = itDateToIso(getCell(row, PAYDATE_COLUMNS));
    const amountCents = mpMoneyToCents(getCell(row, AMOUNT_COLUMNS));
    // Riga totali / vuota: niente data pagamento o niente importo → scarta.
    if (!payDateIso || amountCents === null) continue;
    rows.push({
      payDateIso,
      method: normalizeMethod(getCell(row, METHOD_COLUMNS)),
      amountCents,
      cod: normalizeCode(getCell(row, COD_COLUMNS)),
      name: clean(getCell(row, NAME_COLUMNS)),
      email: clean(getCell(row, EMAIL_COLUMNS)),
      idClienteMp: clean(getCell(row, IDCLIENTE_MP_COLUMNS)),
      bookDayIso: itDateToIso(getCell(row, BOOKDAY_COLUMNS)),
      ora: clean(getCell(row, BOOKTIME_COLUMNS)),
      campo: clean(getCell(row, SPACE_COLUMNS)),
      ref: clean(getCell(row, REF_COLUMNS)),
    });
  }
  return { ok: true, rows, headers, sourceRows: rawRows.length };
}

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
  return buildMemberIndex(records);
}

function memberLocalId(rec: MemberRecord): string {
  const p = rec.payload || {};
  return clean(p.id) || clean(rec.local_key);
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

  // Accesso: routine schedulata (x-pmo-routine-secret) oppure staff con permesso cloud_sync.
  const routineOk = await verifyRoutineSecret(admin, req.headers.get('x-pmo-routine-secret') || '');
  let actor: StaffActor | null = null;
  if (!routineOk) {
    actor = await getActor(req).catch(() => null);
    if (!actor) return err(401, 'UNAUTHORIZED', 'Serve la routine secret oppure una sessione staff con permesso cloud_sync.');
    if (!hasPermission(actor, 'cloud_sync')) return err(403, 'FORBIDDEN', 'Permesso cloud_sync richiesto per sincronizzare gli incassi.');
  }

  let body: JsonMap = {};
  try { body = await req.json(); } catch { /* body opzionale */ }

  // 1) Bytes Excel: manuale (xlsxBase64) o dal worker (con intervallo date).
  let bytes: Uint8Array;
  const manualB64 = clean(body.xlsxBase64);
  let source = 'worker';
  const dateFrom = clean(body.dateFrom) || undefined;
  const dateTo = clean(body.dateTo) || undefined;
  const days = Number(body.days) > 0 ? Number(body.days) : undefined;
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
      bytes = await callWorkerExportPayments({ workerUrl, workerApiKey, username, password, baseUrl, dateFrom, dateTo, days });
    }
  } catch (e) {
    const code = clean((e as { code?: string })?.code) || 'WORKER_ERROR';
    const diagnostic = (e as { diagnostic?: unknown })?.diagnostic;
    const status = code === 'WORKER_NETWORK_ERROR' ? 502 : 422;
    return err(status, code, errorText(e), diagnostic ? { diagnostic } : {});
  }

  // 2) Parsa.
  const parsed = parsePaymentsWorkbook(bytes);
  if (!parsed.ok) {
    await logAudit(admin, actor, 'matchpoint_payments_sync_blocked', { source, error: parsed.error, message: parsed.message });
    return err(422, parsed.error, parsed.message, { sheetNames: parsed.sheetNames, headers: parsed.headers });
  }

  // 3) Abbina al socio (codice→email→nome) e costruisci i record `payment`. Un incasso si registra
  // ANCHE se il cliente non è un socio (member_local_id null) → il totale di cassa è completo.
  const importedAt = new Date().toISOString();
  const members = await loadMembers(admin);
  const records: JsonMap[] = [];
  const seqByKey = new Map<string, number>();
  let matched = 0;
  const byMethod: Record<string, number> = { cash: 0, card: 0, wallet: 0, other: 0 };
  let totalCents = 0;
  // #3 — per la riconciliazione tombstone: chiavi dei pagamenti PRESENTI nel report + la
  // finestra effettiva coperta (min/max data-pagamento). Il report è completo per finestra
  // date, quindi ciò che è in [minPayDate,maxPayDate] ma NON in newPaymentKeys è stato stornato.
  const newPaymentKeys = new Set<string>();
  let minPayDate = '';
  let maxPayDate = '';

  for (const row of parsed.rows) {
    const rec = lookupMemberForRow(members, row);
    const memberLid = rec ? memberLocalId(rec) : '';
    if (memberLid) matched += 1;
    // Rif. Pagamento è spesso vuoto → chiave composta deterministica (id_cliente_mp, id_cliente,
    // giorno-pagamento, importo, metodo) coerente col match cross-source del piano, + una `seq`
    // che distingue righe ALTRIMENTI identiche (es. un solo pagatore che copre più giocatori della
    // stessa prenotazione = più righe stesso cod/importo). La seq è assegnata per ordine nel report,
    // quindi il re-sync dello stesso report rigenera le stesse chiavi (upsert idempotente).
    const baseKey = `${row.idClienteMp || 'na'}|${row.cod || 'na'}|${row.payDateIso}|${row.amountCents}|${row.method}`;
    const seq = (seqByKey.get(baseKey) || 0) + 1;
    seqByKey.set(baseKey, seq);
    const localKey = `pay|${baseKey}|${seq}`;
    newPaymentKeys.add(localKey);
    if (row.payDateIso) {
      if (!minPayDate || row.payDateIso < minPayDate) minPayDate = row.payDateIso;
      if (!maxPayDate || row.payDateIso > maxPayDate) maxPayDate = row.payDateIso;
    }
    byMethod[row.method] += row.amountCents;
    totalCents += row.amountCents;
    records.push({
      record_type: 'payment',
      local_key: localKey,
      payload: {
        // Fino a v6.100 questo campo si chiamava `id_reserva` (nome ereditato dall'header
        // fuorviante del report); i record storici sono stati migrati via SQL alla chiave nuova.
        id_cliente_mp: row.idClienteMp,
        id_cliente: row.cod,
        member_local_id: memberLid || null,
        player_name: row.name,
        campo: row.campo,
        data: row.payDateIso,        // data del PAGAMENTO (per aggregare gli Incassi)
        booking_data: row.bookDayIso, // data della prenotazione
        ora: row.ora,
        amount_cents: row.amountCents,
        method: row.method,           // cash | card | wallet | other
        seq,
        source: 'matchpoint',
        mp_payment_ref: row.ref || null,
        status: 'paid',
        synced_at: importedAt,
      },
      payload_hash: null,
      deleted: false,
      synced_at: importedAt,
    });
  }
  const paymentsWritten = records.length;

  // 3b) #3 — TOMBSTONE dei cobros spariti dal report (stornati/mutati in Matchpoint). Senza
  // questa passata un pagamento annullato in MP resterebbe come record `payment` ATTIVO e la
  // sezione Incassi lo conterebbe ancora (doppio conteggio). Riconciliazione sulla FINESTRA
  // effettiva del report [minPayDate,maxPayDate] (completa per finestra date): ogni `payment`
  // esistente in quella finestra la cui chiave non è più nel report → deleted:true.
  // NB: se il report è VUOTO (minPayDate assente) NON si tombstona nulla (evita che un export
  // fallito/vuoto cancelli pagamenti veri).
  // NB2: si riconciliano SOLO le chiavi `pay|…` generate da QUESTA sync: i record `payment`
  // scritti dall'app (omaggi `paygift|…`, simulazioni `pmo_sim_pay|…`) non vengono dal report,
  // quindi «assente dal report» non significa stornato — senza questo filtro morirebbero qui.
  let tombstoned = 0;
  if (minPayDate && maxPayDate) {
    const existing: { local_key: string; payload: JsonMap }[] = [];
    for (let from = 0, page = 0; page < 200; page += 1, from += SUPABASE_PAGE_SIZE) {
      const { data, error } = await admin
        .from('pmo_cloud_records')
        .select('local_key,payload')
        .eq('record_type', 'payment')
        .eq('deleted', false)
        .like('local_key', 'pay|%')
        .gte('payload->>data', minPayDate)
        .lte('payload->>data', maxPayDate)
        .range(from, from + SUPABASE_PAGE_SIZE - 1);
      if (error) { await logAudit(admin, actor, 'matchpoint_payments_sync_error', { source, message: 'tombstone_scan: ' + errorText(error) }); break; }
      const rows = (Array.isArray(data) ? data : []) as { local_key: string; payload: JsonMap }[];
      existing.push(...rows);
      if (rows.length < SUPABASE_PAGE_SIZE) break;
    }
    for (const exRow of existing) {
      if (!newPaymentKeys.has(exRow.local_key)) {
        records.push({
          record_type: 'payment',
          local_key: exRow.local_key,
          payload: { ...(exRow.payload || {}), status: 'voided', voided_at: importedAt, synced_at: importedAt },
          payload_hash: null,
          deleted: true,
          synced_at: importedAt,
        });
        tombstoned += 1;
      }
    }
  }

  // 4) Record riepilogo (diagnostica + sezione Incassi).
  records.push({
    record_type: 'matchpoint_data',
    local_key: 'matchpoint_payments_sync_last',
    payload: {
      synced_at: importedAt, source, dateFrom: dateFrom || null, dateTo: dateTo || null,
      reportRows: parsed.rows.length, written: paymentsWritten, matched, tombstoned,
      unmatched: parsed.rows.length - matched, totalCents, byMethod, headers: parsed.headers,
    },
    payload_hash: null,
    deleted: false,
    synced_at: importedAt,
  });

  // 5) Upsert a blocchi (i pagamenti possono essere molti).
  for (let i = 0; i < records.length; i += 500) {
    const chunk = records.slice(i, i + 500);
    const { error: upsertError } = await admin.from('pmo_cloud_records').upsert(chunk, { onConflict: 'record_type,local_key' });
    if (upsertError) {
      await logAudit(admin, actor, 'matchpoint_payments_sync_error', { source, message: errorText(upsertError) });
      return err(500, 'UPSERT_FAILED', errorText(upsertError));
    }
  }

  // 6) Broadcast leggero (la sezione Incassi re-idrata).
  let broadcast: JsonMap = { sent: 0, ok: true };
  try {
    const env = supabaseUrl.includes('qqbfphyslczzkxoncgex') ? 'prod' : 'test';
    const endpoint = `${supabaseUrl.replace(/\/+$/, '')}/realtime/v1/api/broadcast`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ messages: [{ topic: `pv-staff-cal-${env}`, event: 'payments-sync-done', payload: { ts: Date.now(), written: paymentsWritten, matched } }] }),
    });
    broadcast = { sent: res.ok ? 1 : 0, ok: res.ok, status: res.status };
  } catch (e) {
    broadcast = { sent: 0, ok: false, error: errorText(e) };
  }

  await logAudit(admin, actor, 'matchpoint_payments_sync_success', { source, reportRows: parsed.rows.length, matched, totalCents, byMethod });

  return ok({ source, dateFrom: dateFrom || null, dateTo: dateTo || null, reportRows: parsed.rows.length, written: paymentsWritten, tombstoned, matched, unmatched: parsed.rows.length - matched, totalCents, byMethod, headers: parsed.headers, broadcast });
});
