import { betterAuth } from 'better-auth';
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { boundedText } from './request-body.mjs';

const derive = promisify(scrypt);
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password.normalize('NFKC'), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 33554432 });
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword({ hash, password }) {
  // Supabase's bcrypt hashes are verified without asking users for new passwords.
  if (/^\$2[aby]\$/.test(hash)) return bcrypt.compare(password, hash.replace(/^\$2y\$/, '$2b$'));
  if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash)) return false;
  const [, salt, encoded] = hash.split(':');
  const key = await derive(password.normalize('NFKC'), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 33554432 });
  return timingSafeEqual(key, Buffer.from(encoded, 'hex'));
}
export function emailReady(env) {
  return Boolean(env.MAIL_FROM && env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD);
}
export async function sendAccountEmail(env, to, subject, url) {
  if (!emailReady(env)) throw new Error('Account email is not configured');
  const target = new URL(url);
  if (target.origin !== env.PUBLIC_BASE_URL) throw new Error('Invalid account link origin');
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST, port: 465, secure: true,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    logger: false, debug: false
  });
  try {
    await transport.sendMail({ from: { name: 'Church Care Hub', address: env.MAIL_FROM }, to, subject,
      text: `Church Care Hub\n\n${subject}:\n${url}\n\nIf you did not request this, you can ignore this email.` });
  } finally { transport.close(); }
}
export function createAuth(env, { schemaOnly = false, sendEmail = sendAccountEmail } = {}) {
  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) throw new Error('Authentication secret is missing');
  return betterAuth({
    appName: 'Church Care Hub', database: env.DB,
    secret: env.AUTH_SECRET, baseURL: env.PUBLIC_BASE_URL, basePath: '/api/auth',
    trustedOrigins: [env.PUBLIC_BASE_URL],
    user: { modelName: 'cf_auth_users' },
    account: { modelName: 'cf_auth_accounts' },
    verification: { modelName: 'cf_auth_verifications' },
    session: { modelName: 'cf_auth_sessions', expiresIn: 28800, updateAge: 1800, cookieCache: { enabled: false } },
    advanced: {
      useSecureCookies: true, database: { generateId: 'uuid', validateSchema: !schemaOnly },
      cookies: { session_token: { name: '__Host-churchcarehub.session', attributes: { httpOnly: true, secure: true, sameSite: 'lax', path: '/' } } },
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] }
    },
    // Application-level atomic D1 throttling guards sign-in. Better Auth also
    // limits other endpoints using persistent database counters.
    rateLimit: { enabled: true, storage: 'database', modelName: 'cf_auth_rate_limits', window: 60, max: 30 },
    emailAndPassword: {
      enabled: true, disableSignUp: !emailReady(env), requireEmailVerification: true,
      minPasswordLength: 11, maxPasswordLength: 128,
      password: { hash: hashPassword, verify: verifyPassword },
      resetPasswordTokenExpiresIn: 1800, revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => sendEmail(env, user.email, 'Reset your password', url),
      onPasswordReset: async ({ user }) => {
        const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('email:' + user.email.toLowerCase()));
        const key = 'email:' + [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
        await env.DB.prepare('DELETE FROM auth_login_rate_limits WHERE bucket_key=?').bind(key).run();
      }
    },
    emailVerification: {
      sendOnSignUp: true, sendOnSignIn: true, expiresIn: 3600,
      sendVerificationEmail: async ({ user, url }) => sendEmail(env, user.email, 'Verify your email address', url)
    },
    databaseHooks: {
      user: { create: { after: async user => {
        await env.DB.prepare('INSERT OR IGNORE INTO _identity_users(id) VALUES (?)').bind(user.id).run();
      } } },
      session: { create: { before: async session => {
        const profile = await env.DB.prepare('SELECT active FROM user_profiles WHERE id=?').bind(session.userId).first();
        if (profile && !profile.active) return false;
        return { data: session };
      } } }
    },
    logger: { level: 'error' }
  });
}

const instances = new WeakMap();
export function getAuth(env) {
  let auth = instances.get(env.DB);
  if (!auth) { auth = createAuth(env); instances.set(env.DB, auth); }
  return auth;
}
const endpoints = new Set(['/get-session', '/sign-out', '/sign-up/email', '/request-password-reset', '/reset-password', '/verify-email', '/send-verification-email']);
export async function handleAuth(request, env) {
  const url = new URL(request.url), route = url.pathname.slice('/api/auth'.length);
  const reply = (message, status) => Response.json({ message }, { status, headers: { 'Cache-Control': 'no-store' } });
  if (route === '/config' && request.method === 'GET') return Response.json({ registrationEnabled: emailReady(env), passwordRecoveryEnabled: emailReady(env) }, { headers: { 'Cache-Control': 'no-store' } });
  if (!endpoints.has(route)) return reply('Account action not found', 404);
  if (!['GET', 'POST'].includes(request.method)) return reply('Method not allowed', 405);
  if (request.method === 'POST' && request.headers.get('Origin') !== env.PUBLIC_BASE_URL) return reply('Request origin is not allowed', 403);
  if (['/sign-up/email', '/request-password-reset', '/send-verification-email'].includes(route) && !emailReady(env)) return reply('Account email is not configured yet. Contact your administrator.', 503);
  if (request.method === 'POST') {
    let body;
    try { body = await boundedText(request, 8192); }
    catch (failure) { return reply(failure.status === 413 ? 'Request is too large' : 'Invalid request', failure.status === 413 ? 413 : 400); }
    // Replay only validated, bounded bytes; do not tee an unbounded original.
    const headers = new Headers(request.headers);
    headers.delete('Content-Length');
    request = new Request(request.url, { method: request.method, headers, body });
    if (['/sign-up/email', '/reset-password'].includes(route)) {
      let payload;
      try { payload = JSON.parse(body); } catch { return reply('Invalid request', 400); }
      const password = route === '/reset-password' ? payload.newPassword : payload.password;
      if (typeof password !== 'string' || password.length > 128 || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{11,}$/.test(password)) return reply('Use at least 11 characters with an uppercase letter, lowercase letter, number, and symbol.', 400);
    }
  }
  try {
    const response = await getAuth(env).handler(request);
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store');
    headers.set('X-Content-Type-Options', 'nosniff');
    if (route === '/get-session' && response.ok) {
      const value = await response.json();
      return Response.json(value ? { user: value.user, session: { createdAt: value.session.createdAt, expiresAt: value.session.expiresAt } } : null, { headers });
    }
    return new Response(response.body, { status: response.status, headers });
  } catch { return reply('Account service is temporarily unavailable.', 503); }
}
