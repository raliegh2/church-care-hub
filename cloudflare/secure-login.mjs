import { getAuth } from './auth.mjs';
import { boundedText } from './request-body.mjs';
const reply = (payload, status = 200, retry = 0) => Response.json(payload, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(retry ? { 'Retry-After': String(retry) } : {}) } });
const unavailable = () => reply({ error: 'Sign-in is temporarily unavailable.' }, 503);
async function hash(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function keys(email, request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local-development';
  return [`email:${await hash('email:' + email)}`, `ip:${await hash('ip:' + ip)}`];
}
async function clear(db, buckets) {
  await db.batch(buckets.map(bucket => db.prepare('DELETE FROM auth_login_rate_limits WHERE bucket_key = ?').bind(bucket)));
}
export function failureStatement(db, bucket, limit, blockSeconds, now) {
  // Increment within one statement to preserve limits under concurrent failures.
  return db.prepare(`INSERT INTO auth_login_rate_limits (bucket_key,attempt_count,window_started_at,blocked_until,updated_at)
    VALUES (?,1,?,NULL,?) ON CONFLICT(bucket_key) DO UPDATE SET
    attempt_count=CASE WHEN julianday(window_started_at)<=julianday(?)-900.0/86400 THEN 1 ELSE attempt_count+1 END,
    window_started_at=CASE WHEN julianday(window_started_at)<=julianday(?)-900.0/86400 THEN ? ELSE window_started_at END,
    blocked_until=CASE WHEN julianday(blocked_until)>julianday(?) THEN blocked_until
      WHEN (CASE WHEN julianday(window_started_at)<=julianday(?)-900.0/86400 THEN 1 ELSE attempt_count+1 END)>=? THEN ? ELSE NULL END,
    updated_at=? RETURNING blocked_until`).bind(bucket, now, now, now, now, now, now, now, limit, new Date(Date.parse(now) + blockSeconds * 1000).toISOString(), now);
}
export async function handleSecureLogin(request, env, signIn = authRequest => getAuth(env).handler(authRequest)) {
  if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);
  if (request.headers.get('Origin') !== new URL(request.url).origin) return reply({ error: 'Request origin is not allowed.' }, 403);
  try {
    const raw = await boundedText(request, 8192);
    let body;
    try { body = JSON.parse(raw); } catch { return reply({ error: 'Invalid request.' }, 400); }
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!email || email.length > 254 || !password || password.length > 128) return reply({ error: 'The email or password is incorrect.' }, 401);
    const buckets = await keys(email, request);
    const states = await env.DB.prepare('SELECT blocked_until FROM auth_login_rate_limits WHERE bucket_key IN (?,?)').bind(...buckets).all();
    const retry = Math.max(0, ...states.results.map(row => Math.ceil((Date.parse(row.blocked_until) - Date.now()) / 1000)).filter(Number.isFinite));
    if (retry) return reply({ error: 'Too many sign-in attempts. Please wait before trying again.', retry_after_seconds: retry }, 429, retry);
    const headers = new Headers(request.headers);
    headers.set('Content-Type', 'application/json');
    const response = await signIn(new Request(`${env.PUBLIC_BASE_URL}/api/auth/sign-in/email`, {
      method: 'POST', headers, body: JSON.stringify({ email, password, rememberMe: false })
    }));
    const payload = await response.json().catch(() => ({}));
    if (response.ok && payload.user && payload.token) {
      await clear(env.DB, buckets);
      // Session credentials are only delivered in a secure HttpOnly cookie.
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Cache-Control', 'no-store');
      responseHeaders.set('X-Content-Type-Options', 'nosniff');
      return Response.json({ user: payload.user }, { headers: responseHeaders });
    }
    if (response.status >= 500) return unavailable();
    const now = new Date().toISOString();
    const failures = await env.DB.batch([failureStatement(env.DB, buckets[0], 5, 900, now), failureStatement(env.DB, buckets[1], 20, 1800, now)]);
    const retryAfter = Math.max(Number(response.headers.get('Retry-After')) || 0, ...failures.map(result => Math.max(0, Math.ceil((Date.parse(result.results[0]?.blocked_until) - Date.now()) / 1000) || 0)));
    if (retryAfter || response.status === 429) return reply({ error: 'Too many sign-in attempts. Please wait before trying again.', retry_after_seconds: Math.max(1, retryAfter) }, 429, Math.max(1, retryAfter));
    return reply({ error: 'The email or password is incorrect.' }, 401);
  } catch (failure) {
    if (failure.status === 413) return reply({ error: 'Request is too large.' }, 413);
    if (failure.status === 401) return reply({ error: 'Authentication required.' }, 401);
    return unavailable();
  }
}
