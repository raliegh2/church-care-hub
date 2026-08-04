import { supabase, supabasePublishableKey, supabaseUrl } from './supabase';

interface SecureLoginResponse {
  access_token?: string;
  refresh_token?: string;
  retry_after_seconds?: number;
  error?: string;
}

export class SecureLoginError extends Error {
  readonly retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds = 0) {
    super(message);
    this.name = 'SecureLoginError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export async function secureSignIn(email: string, password: string): Promise<void> {
  const headers: Record<string, string> = {
    apikey: supabasePublishableKey,
    'Content-Type': 'application/json',
  };

  // Legacy anon keys are JWTs and can be sent as a bearer token. Modern
  // publishable keys must only be sent through the apikey header.
  if (!supabasePublishableKey.startsWith('sb_publishable_')) {
    headers.Authorization = `Bearer ${supabasePublishableKey}`;
  }

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/secure-login`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
      credentials: 'omit',
    });
  } catch {
    throw new SecureLoginError('Unable to reach the secure login service. Please try again.');
  }

  const payload = (await response.json().catch(() => ({}))) as SecureLoginResponse;
  const retryAfterSeconds = Math.max(
    0,
    Number(payload.retry_after_seconds || response.headers.get('Retry-After') || 0),
  );

  if (!response.ok || !payload.access_token || !payload.refresh_token) {
    const message = response.status === 429
      ? 'Too many sign-in attempts. Please wait before trying again.'
      : response.status === 401
        ? 'The email or password is incorrect.'
        : 'Sign-in is temporarily unavailable. Please try again.';
    throw new SecureLoginError(message, retryAfterSeconds);
  }

  const { error } = await supabase.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  });

  if (error) {
    throw new SecureLoginError('The secure session could not be established. Please sign in again.');
  }
}

/**
 * Clear login throttles while the password-recovery session is still valid.
 * Supabase terminates the current session when the password changes, so this
 * must run before updateUser({ password }). Best-effort: a cleanup failure must
 * never prevent the user from setting a new password.
 */
export async function clearLoginThrottleForPasswordReset(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return false;

  const headers: Record<string, string> = {
    apikey: supabasePublishableKey,
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/secure-login`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'reset_complete' }),
      cache: 'no-store',
      credentials: 'omit',
    });
    return response.ok;
  } catch {
    return false;
  }
}
