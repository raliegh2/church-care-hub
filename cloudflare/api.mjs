import catalog from './source-catalog.json' with { type: 'json' };
import { handleSecureLogin } from './secure-login.mjs';
import { getAuth, handleAuth } from './auth.mjs';
import { boundedText } from './request-body.mjs';

const publicTables = new Set(['user_profiles', 'visitors', 'members', 'care_notes', 'visit_records', 'attendance_sessions']);
const schemas = new Map(catalog.catalog.map(table => [table.table, table.columns]));
const pastoral = actor => ['pastor', 'administrator'].includes(actor.profile?.role);
const administrator = actor => actor.profile?.role === 'administrator';
const error = (message, status = 400) => Object.assign(new Error(message), { status });
const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
const q = value => `"${value}"`;
function field(table, name) {
  if (!schemas.get(table)?.some(column => column.name === name)) throw error('Unknown column');
  return q(name);
}
function normalize(table, row) {
  const result = { ...row };
  for (const column of schemas.get(table)) if (column.type === 'boolean' && result[column.name] != null) result[column.name] = Boolean(result[column.name]);
  return result;
}
function value(table, name, input) {
  const column = schemas.get(table).find(column => column.name === name);
  if (column.type === 'boolean') {
    if (![true, false, 'true', 'false', 0, 1].includes(input)) throw error('Invalid boolean');
    return input === true || input === 'true' || input === 1 ? 1 : 0;
  }
  if (input != null && typeof input === 'object') throw error('Invalid field value');
  return input ?? null;
}

export function scope(table, method, actor) {
  const p = actor.profile;
  if (table === 'user_profiles') {
    if (!['GET', 'HEAD'].includes(method)) throw error('Profiles are managed through account actions', 403);
    return administrator(actor) && actor.approved ? { sql: '(id = ? OR organization_id = ?)', values: [actor.id, p.organization_id] } : { sql: 'id = ?', values: [actor.id] };
  }
  if (!actor.approved) throw error('An approved active account is required', 403);
  if (!['usher', 'pastor', 'administrator'].includes(p.role)) throw error('This role cannot access care records', 403);
  const values = [p.organization_id];
  let sql = 'organization_id = ?';
  if (['members', 'attendance_sessions'].includes(table) && !pastoral(actor)) throw error('Pastoral access is required', 403);
  if (['care_notes', 'visit_records'].includes(table) && !pastoral(actor)) sql += ' AND visitor_id IS NOT NULL AND member_id IS NULL';
  if (table === 'care_notes' && method === 'PATCH' && !pastoral(actor)) { sql += ' AND created_by = ?'; values.push(actor.id); }
  if (table === 'visit_records' && method === 'PATCH' && !administrator(actor)) { sql += ' AND visited_by = ?'; values.push(actor.id); }
  if (method === 'DELETE') {
    if (table === 'attendance_sessions' && !administrator(actor)) { sql += ' AND created_by = ?'; values.push(actor.id); }
    else if (!administrator(actor)) throw error('Administrator access is required', 403);
  }
  return { sql, values };
}

export function filters(table, params) {
  const fragments = [], values = [];
  function condition(name, raw) {
    const column = field(table, name);
    const parsed = raw.match(/^(eq|neq|gte|gt|lte|lt|ilike|like|in|is|not\.is)\.(.*)$/s);
    if (!parsed) throw error('Unsupported filter');
    const [, operator, operand] = parsed;
    if (operator === 'is' || operator === 'not.is') {
      if (operand !== 'null') throw error('Unsupported null filter');
      return `${column} IS ${operator === 'not.is' ? 'NOT ' : ''}NULL`;
    }
    if (operator === 'in') {
      if (!operand.startsWith('(') || !operand.endsWith(')')) throw error('Invalid list filter');
      const entries = operand.slice(1, -1).split(',').map(x => x.replace(/^"|"$/g, ''));
      if (!entries.length || entries.length > 1000) throw error('Invalid list length');
      values.push(...entries.map(entry => value(table, name, entry)));
      return `${column} IN (${entries.map(() => '?').join(',')})`;
    }
    const operators = { eq: '=', neq: '<>', gte: '>=', gt: '>', lte: '<=', lt: '<', ilike: 'LIKE', like: 'LIKE' };
    values.push(value(table, name, operand));
    return `${column} ${operators[operator]} ?`;
  }
  for (const [name, raw] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(name)) continue;
    if (name === 'or') {
      if (!raw.startsWith('(') || !raw.endsWith(')')) throw error('Invalid search filter');
      const parts = raw.slice(1, -1).split(',').map(part => {
        const dot = part.indexOf('.');
        return condition(part.slice(0, dot), part.slice(dot + 1));
      });
      fragments.push('(' + parts.join(' OR ') + ')');
    } else fragments.push(condition(name, raw));
  }
  return { sql: fragments.length ? ' AND ' + fragments.join(' AND ') : '', values };
}

export async function authenticate(request, env) {
  const authenticated = await getAuth(env).api.getSession({ headers: request.headers });
  if (!authenticated?.user?.id) throw error('Session is invalid or expired', 401);
  const { user, session } = authenticated;
  const profile = await env.DB.prepare('SELECT * FROM user_profiles WHERE id = ?').bind(user.id).first();
  const approved = Boolean(profile?.active && profile.role_status === 'approved' && Date.parse(session.createdAt) >= Date.parse(profile.auth_not_before));
  return { id: user.id, email: user.email, profile, approved };
}

async function readBody(request) {
  const body = await boundedText(request, 1024 * 1024);
  try { return JSON.parse(body); } catch { throw error('Invalid JSON'); }
}
function selectedColumns(table, params) {
  const select = params.get('select') || '*';
  return select === '*' ? '*' : select.split(',').map(name => field(table, name.trim())).join(',');
}
function representation(request, table, rows, status) {
  const normalized = rows.map(row => normalize(table, row));
  if (request.headers.get('Accept')?.includes('application/vnd.pgrst.object+json')) {
    if (normalized.length !== 1) return json({ code: 'PGRST116', message: 'Expected exactly one row', details: `The result contains ${normalized.length} rows` }, 406);
    return json(normalized[0], status);
  }
  return json(normalized, status);
}

export async function handleData(request, env, actor) {
  const url = new URL(request.url);
  const table = url.pathname.split('/').at(-1);
  if (!publicTables.has(table)) throw error('Unknown resource', 404);
  const permission = scope(table, request.method, actor);
  const filter = filters(table, url.searchParams);
  const where = permission.sql + filter.sql;
  const bindings = [...permission.values, ...filter.values];
  const columns = selectedColumns(table, url.searchParams);
  if (['GET', 'HEAD'].includes(request.method)) {
    const order = url.searchParams.get('order')?.split(',').map(part => {
      const [name, direction = 'asc'] = part.split('.');
      if (!['asc', 'desc'].includes(direction)) throw error('Invalid ordering');
      return field(table, name) + ' ' + direction.toUpperCase();
    }).join(',');
    const range = request.headers.get('Range')?.match(/^(\d+)-(\d+)$/);
    const offset = Number(url.searchParams.get('offset') || range?.[1] || 0);
    const limit = Number(url.searchParams.get('limit') || (range ? Number(range[2]) - Number(range[1]) + 1 : 1000));
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 1000) throw error('Invalid pagination');
    let count;
    if (request.headers.get('Prefer')?.includes('count=exact') || request.method === 'HEAD') count = (await env.DB.prepare(`SELECT count(*) AS total FROM ${q(table)} WHERE ${where}`).bind(...bindings).first()).total;
    const result = request.method === 'HEAD' ? { results: [] } : await env.DB.prepare(`SELECT ${columns} FROM ${q(table)} WHERE ${where}${order ? ' ORDER BY ' + order : ''} LIMIT ? OFFSET ?`).bind(...bindings, limit, offset).all();
    const headers = count === undefined ? {} : { 'Content-Range': result.results.length ? `${offset}-${offset + result.results.length - 1}/${count}` : `*/${count}`, 'Range-Unit': 'items' };
    if (request.method === 'HEAD') return new Response(null, { status: 200, headers: { 'Cache-Control': 'no-store', ...headers } });
    const response = representation(request, table, result.results, 200);
    for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
    return response;
  }
  if (request.method === 'POST') {
    const raw = await readBody(request), rows = Array.isArray(raw) ? raw : [raw];
    if (!rows.length || rows.length > 250) throw error('Invalid batch size');
    const ignore = request.headers.get('Prefer')?.includes('resolution=ignore-duplicates');
    if (url.searchParams.has('on_conflict') && url.searchParams.get('on_conflict') !== 'id') throw error('Unsupported conflict key');
    const statements = [];
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw error('Invalid record');
      const actorField = table === 'visit_records' ? 'visited_by' : 'created_by';
      if (row.organization_id !== actor.profile.organization_id || row[actorField] !== actor.id) throw error('Record ownership is invalid', 403);
      if (['care_notes', 'visit_records'].includes(table)) {
        if (Boolean(row.visitor_id) === Boolean(row.member_id) || row.member_id && !pastoral(actor)) throw error('Invalid person access', 403);
        const personTable = row.visitor_id ? 'visitors' : 'members';
        const person = await env.DB.prepare(`SELECT id FROM ${personTable} WHERE id = ? AND organization_id = ?`).bind(row.visitor_id || row.member_id, actor.profile.organization_id).first();
        if (!person) throw error('Person was not found', 403);
      }
      const record = { ...row, id: row.id || crypto.randomUUID() };
      const keys = Object.keys(record);
      for (const key of keys) { field(table, key); if (schemas.get(table).find(c => c.name === key).generated === 'ALWAYS') throw error('Generated columns cannot be written'); }
      // ON CONFLICT(id) avoids treating a different CHECK or FK error as a retry.
      statements.push(env.DB.prepare(`INSERT INTO ${q(table)} (${keys.map(q).join(',')}) VALUES (${keys.map(() => '?').join(',')})${ignore ? ' ON CONFLICT(id) DO NOTHING' : ''} RETURNING ${columns}`).bind(...keys.map(key => value(table, key, record[key]))));
    }
    const results = await env.DB.batch(statements);
    const output = results.flatMap(result => result.results || []);
    if (!request.headers.get('Prefer')?.includes('return=representation')) return new Response(null, { status: 201, headers: { 'Cache-Control': 'no-store' } });
    return representation(request, table, output, 201);
  }
  if (request.method === 'PATCH') {
    const row = await readBody(request);
    if (!row || Array.isArray(row) || typeof row !== 'object') throw error('Invalid update');
    const immutable = new Set(['id', 'organization_id', 'created_by', 'visited_by', 'created_at', 'visitor_id', 'member_id']);
    const keys = Object.keys(row);
    if (!keys.length || keys.some(key => immutable.has(key))) throw error('Ownership and person links cannot be changed', 403);
    for (const key of keys) { field(table, key); if (schemas.get(table).find(c => c.name === key).generated === 'ALWAYS') throw error('Generated columns cannot be written'); }
    if (schemas.get(table).some(c => c.name === 'updated_at')) row.updated_at = new Date().toISOString();
    const updatedKeys = Object.keys(row);
    const result = await env.DB.prepare(`UPDATE ${q(table)} SET ${updatedKeys.map(key => q(key) + ' = ?').join(',')} WHERE ${where} RETURNING ${columns}`).bind(...updatedKeys.map(key => value(table, key, row[key])), ...bindings).all();
    if (!request.headers.get('Prefer')?.includes('return=representation')) return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    return representation(request, table, result.results, 200);
  }
  if (request.method === 'DELETE') {
    await env.DB.prepare(`DELETE FROM ${q(table)} WHERE ${where}`).bind(...bindings).run();
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  }
  throw error('Unsupported method', 405);
}

async function rpc(request, env, actor) {
  if (request.method !== 'POST') throw error('Unsupported method', 405);
  const name = new URL(request.url).pathname.split('/').at(-1), body = await readBody(request);
  const now = new Date().toISOString();
  if (name === 'complete_onboarding') {
    const displayName = String(body.p_display_name || '').trim();
    if (displayName.length < 2 || displayName.length > 80) throw error('Display name must contain 2 to 80 characters');
    if (actor.profile) {
      const profile = await env.DB.prepare('UPDATE user_profiles SET display_name = ?, updated_at = ? WHERE id = ? RETURNING *').bind(displayName, now, actor.id).first();
      return json(normalize('user_profiles', profile));
    }
    if (!['usher', 'pastor'].includes(body.p_requested_role)) throw error('Select either usher or pastor');
    const profile = await env.DB.prepare("INSERT INTO user_profiles (id,organization_id,display_name,role,requested_role,role_status,active) VALUES (?,?,?,'usher',?,?,1) RETURNING *").bind(actor.id, env.ORGANIZATION_ID, displayName, body.p_requested_role, body.p_requested_role === 'pastor' ? 'pending' : 'approved').first();
    return json(normalize('user_profiles', profile));
  }
  if (!actor.approved || !administrator(actor)) throw error('Administrator access required', 403);
  if (body.p_user_id === actor.id) throw error('Use another administrator to change your own access', 403);
  if (name === 'approve_role_request') {
    if (typeof body.p_approve !== 'boolean') throw error('Invalid approval');
    const results = await env.DB.batch([
      env.DB.prepare("UPDATE user_profiles SET role=?,role_status=?,updated_at=?,auth_not_before=? WHERE id=? AND organization_id=? AND role_status='pending' AND requested_role='pastor' RETURNING *").bind(body.p_approve ? 'pastor' : 'usher', body.p_approve ? 'approved' : 'rejected', now, now, body.p_user_id, actor.profile.organization_id),
      env.DB.prepare('UPDATE pastor_applications SET reviewed_at=?,reviewed_by=? WHERE profile_id=? AND organization_id=? AND EXISTS (SELECT 1 FROM user_profiles WHERE id=? AND updated_at=?)').bind(now, actor.id, body.p_user_id, actor.profile.organization_id, body.p_user_id, now)
    ]);
    if (!results[0].results.length) throw error('Pending user request not found', 404);
    return json(normalize('user_profiles', results[0].results[0]));
  }
  if (name === 'admin_manage_user') {
    if (!['usher', 'pastor', 'administrator', 'auditor'].includes(body.p_role) || typeof body.p_active !== 'boolean') throw error('Invalid account settings');
    const profile = await env.DB.prepare("UPDATE user_profiles SET role=?,requested_role=?,role_status='approved',active=?,auth_not_before=?,updated_at=? WHERE id=? AND organization_id=? RETURNING *").bind(body.p_role, body.p_role, Number(body.p_active), now, now, body.p_user_id, actor.profile.organization_id).first();
    if (!profile) throw error('User not found', 404);
    return json(normalize('user_profiles', profile));
  }
  throw error('Unknown account action', 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.endsWith('.map')) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
    if (url.pathname === '/readyz') {
      try { await env.DB.prepare('SELECT 1 FROM cf_auth_users LIMIT 1').first(); if (!env.AUTH_SECRET) throw new Error('Missing secret'); return json({ ok: true, database: 'D1', authentication: 'Cloudflare' }); }
      catch { return json({ ok: false }, 503); }
    }
    if (['/api/auth/secure-login', '/api/auth/sign-in/email'].includes(url.pathname)) return handleSecureLogin(request, env);
    if (url.pathname.startsWith('/api/auth/')) return handleAuth(request, env);
    if (!url.pathname.startsWith('/api/rest/v1/')) return env.ASSETS.fetch(request);
    try {
      if (!['GET', 'HEAD'].includes(request.method)) {
        const origin = request.headers.get('Origin');
        if (origin !== env.PUBLIC_BASE_URL) throw error('Origin is not allowed', 403);
      }
      const actor = await authenticate(request, env);
      return url.pathname.startsWith('/api/rest/v1/rpc/') ? await rpc(request, env, actor) : await handleData(request, env, actor);
    } catch (failure) {
      const status = failure.status || (/constraint/i.test(failure.message) ? 409 : 500);
      return json({ message: status === 500 ? 'The request could not be completed.' : failure.message, code: status === 401 ? 'AUTH_REQUIRED' : 'REQUEST_FAILED' }, status);
    }
  }
};
