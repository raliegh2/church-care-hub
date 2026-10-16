import { PostgrestClient } from '@supabase/postgrest-js';
import { createReliableFetch } from './reliableFetch';

export const canonicalAppOrigin = window.location.origin;
export const organizationId = 'a9456be1-5b06-4fbb-b5c1-cd5b66b3ff6a';
export const recoveryToken = window.location.pathname === '/reset-password'
  ? new URLSearchParams(window.location.search).get('token') : null;
export interface AuthError { message: string; status?: number; code?: string }
export interface Session { user: { id: string; email: string; user_metadata: { display_name: string } } }
type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'USER_UPDATED' | 'PASSWORD_RECOVERY';
let currentSession: Session | null = null;
let sessionGeneration = 0;
const listeners = new Set<(event: AuthEvent, session: Session | null) => void>();
const convert = (user: { id: string; email: string; name: string }): Session => ({
  user: { id: user.id, email: user.email, user_metadata: { display_name: user.name } }
});
function publish(event: AuthEvent, session: Session | null) {
  currentSession = session;
  sessionGeneration++;
  listeners.forEach(listener => listener(event, session));
}
export async function accountRequest(path: string, body?: unknown) {
  try {
    const response = await fetch(`/api/auth/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(['request-password-reset', 'sign-up/email', 'send-verification-email'].includes(path) ? 35000 : 12000)
    });
    const data = await response.json().catch(() => ({}));
    return { data, error: response.ok ? null : { message: data.message || data.error || 'The account request failed.', status: response.status, code: data.code } as AuthError };
  } catch { return { data: null, error: { message: 'Unable to reach the account service.', status: 0 } as AuthError }; }
}
const reliableDataFetch = createReliableFetch((input, init) => fetch(input, { ...init, credentials: 'same-origin' }));
const data = new PostgrestClient(`${canonicalAppOrigin}/api/rest/v1`, { fetch: async (input, init) => {
  const headers = new Headers(init?.headers);
  // Partition in-flight reads across account changes. This marker grants no access.
  headers.set('X-Session-Generation', String(sessionGeneration));
  const response = await reliableDataFetch(input, { ...init, headers });
  if (response.status === 401 && currentSession) publish('SIGNED_OUT', null);
  return response;
} });
export const backend = {
  from: data.from.bind(data), rpc: data.rpc.bind(data),
  auth: {
    async getSession() {
      const result = await accountRequest('get-session');
      if (!result.error) currentSession = result.data?.user ? convert(result.data.user) : null;
      return { data: { session: currentSession }, error: result.error };
    },
    onAuthStateChange(listener: (event: AuthEvent, session: Session | null) => void) {
      listeners.add(listener);
      return { data: { subscription: { unsubscribe() { listeners.delete(listener); } } } };
    },
    async signIn(email: string, password: string) {
      const result = await accountRequest('secure-login', { email, password });
      if (!result.error && result.data?.user) publish('SIGNED_IN', convert(result.data.user));
      return result;
    },
    async signOut(_options?: { scope: string }) {
      const result = await accountRequest('sign-out', {});
      if (!result.error) publish('SIGNED_OUT', null);
      return result;
    },
    async signUp(input: { email: string; password: string; options: { data: { display_name: string }; emailRedirectTo: string } }) {
      const result = await accountRequest('sign-up/email', { email: input.email, password: input.password, name: input.options.data.display_name, callbackURL: canonicalAppOrigin });
      return { data: { session: null }, error: result.error };
    },
    async resetPasswordForEmail(email: string, _options?: { redirectTo: string }) {
      return accountRequest('request-password-reset', { email, redirectTo: `${canonicalAppOrigin}/reset-password` });
    },
    async updateUser(input: { password: string }) {
      if (!recoveryToken) return { error: { message: 'That password-reset link is invalid or expired.', status: 401 } as AuthError };
      return accountRequest('reset-password', { newPassword: input.password, token: recoveryToken });
    }
  }
};
// Retired tokens must not survive the switch to HttpOnly session cookies.
try { window.localStorage.removeItem('sb-vzjcudzsheiszdailwns-auth-token'); } catch { /* Storage can be unavailable. */ }
