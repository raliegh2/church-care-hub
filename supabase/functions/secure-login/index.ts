import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const ALLOWED_ORIGINS = new Set([
  'https://church-care-hub.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

const EMAIL_LIMIT = 5;
const EMAIL_WINDOW_SECONDS = 15 * 60;
const EMAIL_BLOCK_SECONDS = 15 * 60;
const IP_LIMIT = 20;
const IP_WINDOW_SECONDS = 15 * 60;
const IP_BLOCK_SECONDS = 30 * 60;

interface LimitState {
  blocked?: boolean;
  retry_after_seconds?: number;
}

function readNamedKeys(jsonValue: string | undefined): string[] {
  if (!jsonValue) return [];
  try {
    const parsed = JSON.parse(jsonValue) as unknown;
    if (typeof parsed === 'string') return [parsed];
    if (Array.isArray(parsed)) {
      return parsed.filter((value): value is string => typeof value === 'string');
    }
    if (parsed && typeof parsed === 'object') {
      return Object.values(parsed as Record<string, unknown>)
        .filter((value): value is string => typeof value === 'string');
    }
  } catch {
    // Some runtimes expose a single key instead of the JSON key map.
    return [jsonValue];
  }
  return [];
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const publicKeys = new Set([
  ...readNamedKeys(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')),
  Deno.env.get('SUPABASE_ANON_KEY') || '',
].filter(Boolean));
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  || readNamedKeys(Deno.env.get('SUPABASE_SECRET_KEYS'))[0]
  || '';

if (!supabaseUrl || publicKeys.size === 0 || !serviceKey) {
  throw new Error('Secure login is missing required Supabase environment variables.');
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function responseHeaders(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store, max-age=0',
    'Content-Type': 'application/json',
    'Referrer-Policy': 'no-referrer',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function json(
  origin: string | null,
  status: number,
  body: Record<string, unknown>,
  retryAfterSeconds = 0,
): Response {
  const headers = new Headers(responseHeaders(origin));
  if (retryAfterSeconds > 0) {
    headers.set('Retry-After', String(Math.ceil(retryAfterSeconds)));
  }
  return new Response(JSON.stringify(body), { status, headers });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return req.headers.get('cf-connecting-ip')
    || req.headers.get('x-real-ip')
    || forwarded
    || 'unknown';
}

function firstRow(data: unknown): LimitState {
  return Array.isArray(data) && data.length > 0
    ? (data[0] as LimitState)
    : (data as LimitState) || {};
}

async function checkLimit(bucketKey: string): Promise<LimitState> {
  const { data, error } = await admin.rpc('check_auth_login_rate_limit', {
    p_bucket_key: bucketKey,
  });
  if (error) throw error;
  return firstRow(data);
}

async function recordFailure(
  bucketKey: string,
  limit: number,
  windowSeconds: number,
  blockSeconds: number,
): Promise<LimitState> {
  const { data, error } = await admin.rpc('record_auth_login_failure', {
    p_bucket_key: bucketKey,
    p_limit: limit,
    p_window_seconds: windowSeconds,
    p_block_seconds: blockSeconds,
  });
  if (error) throw error;
  return firstRow(data);
}

async function clearLimit(bucketKey: string): Promise<void> {
  const { error } = await admin.rpc('clear_auth_login_rate_limit', {
    p_bucket_key: bucketKey,
  });
  if (error) throw error;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
      return json(origin, 403, { error: 'Request origin is not allowed.' });
    }
    return new Response(null, { status: 204, headers: responseHeaders(origin) });
  }

  if (req.method !== 'POST') {
    return json(origin, 405, { error: 'Method not allowed.' });
  }

  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return json(origin, 403, { error: 'Request origin is not allowed.' });
  }

  const requestPublicKey = req.headers.get('apikey') || '';
  if (!requestPublicKey || !publicKeys.has(requestPublicKey)) {
    return json(origin, 403, { error: 'Request could not be authorized.' });
  }

  let body: { email?: unknown; password?: unknown; action?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(origin, 400, { error: 'Invalid request.' });
  }

  // Clear both rate-limit buckets while the recovery session is still valid.
  // Password changes terminate the current Supabase session, so the client must
  // call this action before updateUser({ password }). The bearer token is
  // verified server-side and only that user's email bucket plus the caller's IP
  // bucket are cleared.
  if (body && body.action === 'reset_complete') {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : '';
    if (!token) {
      return json(origin, 401, { error: 'Authentication required.' });
    }

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const verifiedEmail = userData?.user?.email?.trim().toLowerCase() || '';
    if (userError || !verifiedEmail) {
      return json(origin, 401, { error: 'Authentication required.' });
    }

    try {
      const [emailHash, ipHash] = await Promise.all([
        sha256(`email:${verifiedEmail}`),
        sha256(`ip:${clientIp(req)}`),
      ]);
      await Promise.all([
        clearLimit(`email:${emailHash}`),
        clearLimit(`ip:${ipHash}`),
      ]);
    } catch {
      return json(origin, 503, { error: 'Sign-in is temporarily unavailable.' });
    }

    return json(origin, 200, { cleared: true });
  }

  const email = typeof body.email === 'string'
    ? body.email.trim().toLowerCase()
    : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || email.length > 254 || !password || password.length > 1024) {
    return json(origin, 401, { error: 'The email or password is incorrect.' });
  }

  const [emailHash, ipHash] = await Promise.all([
    sha256(`email:${email}`),
    sha256(`ip:${clientIp(req)}`),
  ]);
  const emailBucket = `email:${emailHash}`;
  const ipBucket = `ip:${ipHash}`;

  try {
    const [emailState, ipState] = await Promise.all([
      checkLimit(emailBucket),
      checkLimit(ipBucket),
    ]);
    const retryAfter = Math.max(
      Number(emailState.retry_after_seconds || 0),
      Number(ipState.retry_after_seconds || 0),
    );
    if (emailState.blocked || ipState.blocked || retryAfter > 0) {
      return json(origin, 429, {
        error: 'Too many sign-in attempts. Please wait before trying again.',
        retry_after_seconds: retryAfter,
      }, retryAfter);
    }
  } catch {
    // Fail closed if the limiter cannot be checked. Authentication should not
    // silently become less protected because its security dependency failed.
    return json(origin, 503, { error: 'Sign-in is temporarily unavailable.' });
  }

  let authResponse: Response;
  try {
    authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: requestPublicKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return json(origin, 503, { error: 'Sign-in is temporarily unavailable.' });
  }

  const authPayload = await authResponse.json().catch(() => ({})) as Record<string, unknown>;

  if (authResponse.ok
      && typeof authPayload.access_token === 'string'
      && typeof authPayload.refresh_token === 'string') {
    try {
      await Promise.all([clearLimit(emailBucket), clearLimit(ipBucket)]);
    } catch {
      return json(origin, 503, { error: 'Sign-in is temporarily unavailable.' });
    }

    return json(origin, 200, {
      access_token: authPayload.access_token,
      refresh_token: authPayload.refresh_token,
      expires_in: authPayload.expires_in,
      token_type: authPayload.token_type,
    });
  }

  if (authResponse.status >= 500) {
    return json(origin, 503, { error: 'Sign-in is temporarily unavailable.' });
  }

  try {
    const [emailState, ipState] = await Promise.all([
      recordFailure(emailBucket, EMAIL_LIMIT, EMAIL_WINDOW_SECONDS, EMAIL_BLOCK_SECONDS),
      recordFailure(ipBucket, IP_LIMIT, IP_WINDOW_SECONDS, IP_BLOCK_SECONDS),
    ]);
    const retryAfter = Math.max(
      Number(emailState.retry_after_seconds || 0),
      Number(ipState.retry_after_seconds || 0),
      Number(authResponse.headers.get('Retry-After') || 0),
    );

    if (emailState.blocked || ipState.blocked || authResponse.status === 429 || retryAfter > 0) {
      return json(origin, 429, {
        error: 'Too many sign-in attempts. Please wait before trying again.',
        retry_after_seconds: retryAfter,
      }, retryAfter);
    }
  } catch {
    return json(origin, 503, { error: 'Sign-in is temporarily unavailable.' });
  }

  // The same response is returned for unknown users, wrong passwords,
  // unconfirmed accounts, and disabled accounts to prevent user enumeration.
  return json(origin, 401, { error: 'The email or password is incorrect.' });
});
