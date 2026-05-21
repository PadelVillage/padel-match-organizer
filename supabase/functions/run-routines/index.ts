import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TIME_ZONE = 'Europe/Rome';
const FIELDS = ['Campo 1', 'Campo 2', 'Campo 3', 'Campo 4'];

type CloudRecord = {
  record_type: string;
  local_key: string;
  payload: Record<string, any>;
  deleted?: boolean;
};

type Routine = {
  id: string;
  routine_type: string;
  local_key: string;
  name: string;
  status: string;
  source_local_key: string;
  config: Record<string, any>;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeKey(value: unknown) {
  return clean(value)
    .toLocaleLowerCase('it-IT')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function playerFullName(player: Record<string, any>) {
  return `${clean(player.firstName)} ${clean(player.surname)}`.trim() || clean(player.name);
}

function parseTimeMinutes(value: unknown, fallback = '12:30') {
  const text = clean(value || fallback).replace('.', ':');
  const [hRaw, mRaw] = text.split(':');
  return (parseInt(hRaw || '0', 10) || 0) * 60 + (parseInt(mRaw || '0', 10) || 0);
}

function minutesToTime(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function addMinutesToTime(value: unknown, minutes: number) {
  return minutesToTime(parseTimeMinutes(value) + minutes);
}

function localParts(date: Date, timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const out: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') out[part.type] = parseInt(part.value, 10);
  }
  return out;
}

function timeZoneOffsetMs(date: Date, timeZone = TIME_ZONE) {
  const p = localParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

function zonedDateTimeToUtc(dateISO: string, time: string, timeZone = TIME_ZONE) {
  const [y, m, d] = dateISO.split('-').map((x) => parseInt(x, 10));
  const [hh, mm] = clean(time || '12:30').split(':').map((x) => parseInt(x, 10));
  let utc = new Date(Date.UTC(y, m - 1, d, hh || 0, mm || 0, 0));
  for (let i = 0; i < 2; i += 1) {
    utc = new Date(Date.UTC(y, m - 1, d, hh || 0, mm || 0, 0) - timeZoneOffsetMs(utc, timeZone));
  }
  return utc;
}

function localDateISO(date: Date, timeZone = TIME_ZONE) {
  const p = localParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function localWeekday(date: Date, timeZone = TIME_ZONE) {
  const text = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(text);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function nextDateForWeekday(wanted: string, now = new Date()) {
  if (wanted === '') return '';
  const wantedNumber = parseInt(wanted, 10);
  if (!Number.isFinite(wantedNumber)) return '';
  for (let i = 0; i <= 35; i += 1) {
    const candidate = addDays(now, i);
    if (localWeekday(candidate) === wantedNumber) return localDateISO(candidate);
  }
  return '';
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return parseTimeMinutes(aStart) < parseTimeMinutes(bEnd) && parseTimeMinutes(aEnd) > parseTimeMinutes(bStart);
}

function bookingEnd(row: Record<string, any>) {
  const start = clean(row.ora || row.orario || row.time || row.timeStart || '12:30');
  const raw = clean(row.durata || row.duration || '');
  if (raw.includes(':')) {
    const [h, m] = raw.split(':').map((x) => parseInt(x, 10) || 0);
    return addMinutesToTime(start, h * 60 + m);
  }
  const numeric = parseFloat(raw.replace(',', '.'));
  if (Number.isFinite(numeric) && numeric > 0) return addMinutesToTime(start, Math.round(numeric * 60));
  return addMinutesToTime(start, 90);
}

function isFieldBlocked(field: string, date: string, startTime: string, endTime: string, occupancy: CloudRecord[], matches: CloudRecord[]) {
  const blockedByBookings = occupancy.some((record) => {
    const row = record.payload || {};
    if (clean(row.data || row.date) !== date) return false;
    if (clean(row.campo || row.field) !== field) return false;
    const rowStart = clean(row.ora || row.orario || row.time || row.timeStart || startTime);
    return overlaps(startTime, endTime, rowStart, bookingEnd(row));
  });
  if (blockedByBookings) return true;

  return matches.some((record) => {
    const row = record.payload || {};
    if (row.status === 'cancelled') return false;
    if (clean(row.date) !== date) return false;
    if (clean(row.field) !== field) return false;
    return overlaps(startTime, endTime, clean(row.time || startTime), clean(row.endTime || addMinutesToTime(row.time, 90)));
  });
}

function resolveGroupPlayers(group: Record<string, any>, members: CloudRecord[]) {
  const byName = new Map<string, Record<string, any>>();
  for (const record of members) {
    const member = record.payload || {};
    byName.set(normalizeKey(playerFullName(member)), member);
  }
  const missing: string[] = [];
  const inactive: string[] = [];
  const players: Record<string, any>[] = [];
  const names = Array.isArray(group.names) ? group.names : [];
  for (const rawName of names) {
    const member = byName.get(normalizeKey(rawName));
    if (!member) {
      missing.push(clean(rawName));
      continue;
    }
    if (member.active === false) {
      inactive.push(playerFullName(member));
      continue;
    }
    players.push(member);
  }
  return { players, missing, inactive };
}

function buildMatchPayload(group: Record<string, any>, date: string, field: string, players: Record<string, any>[]) {
  const startTime = clean(group.startTime || '12:30');
  const endTime = clean(group.endTime || addMinutesToTime(startTime, 90));
  const key = `routine_${clean(group.id)}_${date}_${startTime}_${endTime}`.replace(/[^a-zA-Z0-9_:-]/g, '_');
  const now = new Date().toISOString();
  const playerMap: Record<string, any> = {};
  for (const player of players) {
    const id = clean(player.id || player.memberId || normalizeKey(playerFullName(player)));
    playerMap[id] = {
      id,
      name: playerFullName(player),
      realName: playerFullName(player),
      firstName: clean(player.firstName),
      phone: clean(player.phone),
      level: player.level ?? '',
      gender: clean(player.gender),
      status: 'pending',
      firstSeenAt: now,
      updatedAt: now,
    };
  }
  return {
    key,
    createdAt: now,
    updatedAt: now,
    date,
    time: startTime,
    endTime,
    field,
    type: clean(group.matchType || 'mista'),
    groupId: clean(group.id),
    groupName: clean(group.name || 'Gruppo soci'),
    formatName: '',
    players: playerMap,
    status: 'inviting',
    createdFromFillSlot: true,
    createdFromGroup: true,
    creationSource: 'group_routine',
    autoCreatedAt: now,
    autoRoutineKey: `${clean(group.id)}|${date}|${startTime}|${endTime}`,
    sourceGroupId: clean(group.id),
    sourceGroupName: clean(group.name || 'Gruppo soci'),
  };
}

Deno.serve(async (req) => {
  try {
    const expectedSecret = Deno.env.get('ROUTINE_SHARED_SECRET') || '';
    if (expectedSecret) {
      const auth = req.headers.get('authorization') || '';
      if (auth !== `Bearer ${expectedSecret}`) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: 'SUPABASE_ENV_MISSING' }, 500);

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const now = new Date();

    const { data: routines, error: routinesError } = await supabase
      .from('pmo_routines')
      .select('*')
      .eq('routine_type', 'group_match_auto_create')
      .eq('status', 'active');
    if (routinesError) throw routinesError;

    const { data: records, error: recordsError } = await supabase
      .from('pmo_cloud_records')
      .select('record_type,local_key,payload,deleted')
      .in('record_type', ['player_group', 'member', 'booking', 'booking_occupancy', 'match_invitation'])
      .eq('deleted', false);
    if (recordsError) throw recordsError;

    const all = (records || []) as CloudRecord[];
    const byType = (type: string) => all.filter((record) => record.record_type === type);
    const groups = new Map(byType('player_group').map((record) => [clean(record.local_key), record.payload]));
    const members = byType('member');
    const occupancy = [...byType('booking_occupancy'), ...byType('booking')];
    const matches = byType('match_invitation');
    const created: string[] = [];
    const blocked: Array<Record<string, unknown>> = [];

    for (const routine of ((routines || []) as Routine[])) {
      const group = groups.get(clean(routine.source_local_key));
      if (!group) {
        blocked.push({ routine: routine.local_key, reason: 'GROUP_NOT_FOUND' });
        continue;
      }
      const date = nextDateForWeekday(clean(group.day), now);
      if (!date) {
        blocked.push({ routine: routine.local_key, group: group.name, reason: 'GROUP_DAY_MISSING' });
        continue;
      }
      const startTime = clean(group.startTime || routine.config?.startTime || '12:30');
      const endTime = clean(group.endTime || routine.config?.endTime || addMinutesToTime(startTime, 90));
      const target = zonedDateTimeToUtc(date, startTime);
      const diffHours = (target.getTime() - now.getTime()) / 36e5;
      const hoursBefore = Math.max(1, parseInt(clean(routine.config?.hoursBefore || 48), 10) || 48);
      if (diffHours < 0 || diffHours > hoursBefore) continue;

      const alreadyExists = matches.some((record) => {
        const payload = record.payload || {};
        if (payload.status === 'cancelled') return false;
        return clean(payload.groupId || payload.sourceGroupId) === clean(group.id)
          && clean(payload.date) === date
          && clean(payload.time) === startTime
          && clean(payload.endTime) === endTime;
      });
      if (alreadyExists) continue;

      const resolved = resolveGroupPlayers(group, members);
      if (resolved.missing.length || resolved.inactive.length || resolved.players.length < 4) {
        blocked.push({
          routine: routine.local_key,
          group: group.name,
          reason: 'PLAYERS_BLOCKED',
          missing: resolved.missing,
          inactive: resolved.inactive,
          playerCount: resolved.players.length,
        });
        continue;
      }

      const field = FIELDS.find((candidate) => !isFieldBlocked(candidate, date, startTime, endTime, occupancy, matches)) || '';
      if (!field && routine.config?.createWithEmptyFieldIfBlocked !== true) {
        blocked.push({ routine: routine.local_key, group: group.name, reason: 'NO_FREE_FIELD', date, startTime, endTime });
        continue;
      }

      const payload = buildMatchPayload(group, date, field, resolved.players);
      const { error: upsertError } = await supabase
        .from('pmo_cloud_records')
        .upsert({
          record_type: 'match_invitation',
          local_key: payload.key,
          payload,
          payload_hash: null,
          deleted: false,
          synced_at: new Date().toISOString(),
        }, { onConflict: 'record_type,local_key' });
      if (upsertError) throw upsertError;
      matches.push({ record_type: 'match_invitation', local_key: payload.key, payload, deleted: false });
      created.push(payload.key);
    }

    await supabase.from('pmo_routine_runs').insert({
      routine_type: 'group_match_auto_create',
      run_status: created.length ? 'success' : (blocked.length ? 'blocked' : 'noop'),
      started_at: now.toISOString(),
      finished_at: new Date().toISOString(),
      summary: { created: created.length, blocked: blocked.length },
      created_records: created,
      error_message: blocked.length ? JSON.stringify(blocked.slice(0, 20)) : null,
    });

    return json({ ok: true, created, blocked });
  } catch (error) {
    return json({ ok: false, error: error?.message || String(error) }, 500);
  }
});
