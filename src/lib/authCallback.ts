/**
 * Supabase returns recovery, invite and confirmation links to the app through
 * the URL fragment, because this project uses the implicit flow. Two properties
 * of that hand-off make it unsafe to rely on the Supabase client alone:
 *
 * 1. A *successful* recovery is announced exactly once, from inside a
 *    `setTimeout(..., 0)` in the client's initializer. `createClient` runs at
 *    module load, so that announcement can be made before React has mounted and
 *    subscribed, in which case it is lost and the reset screen never opens.
 * 2. A *failed* recovery link carries no session, so nothing is announced at
 *    all. The user simply lands on the sign-in screen with no explanation.
 *
 * Both cases end the same way: the person believes their password was changed,
 * then cannot sign in with the new one. Reading the fragment synchronously here
 * — before `createClient` consumes and erases it — gives the app a reliable
 * record of what the link actually said.
 */

export type AuthCallbackType =
  | 'recovery'
  | 'signup'
  | 'invite'
  | 'magiclink'
  | 'email_change'
  | null;

export interface AuthCallback {
  /** The link type Supabase reported, when it reported one. */
  type: AuthCallbackType;
  /** True when the fragment still carries credentials for the client to consume. */
  hasToken: boolean;
  /** Machine-readable failure code, e.g. `otp_expired`. */
  errorCode: string | null;
  /** Human-readable failure text supplied by Supabase. */
  errorDescription: string | null;
}

const KNOWN_TYPES: ReadonlySet<string> = new Set([
  'recovery',
  'signup',
  'invite',
  'magiclink',
  'email_change',
]);

const EMPTY: AuthCallback = {
  type: null,
  hasToken: false,
  errorCode: null,
  errorDescription: null,
};

function readAuthCallback(): AuthCallback {
  if (typeof window === 'undefined') return EMPTY;

  const fragment = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;

  // Supabase uses the fragment for the implicit flow, but a rejected link can
  // also come back on the query string, so both are inspected.
  const sources = [new URLSearchParams(fragment), new URLSearchParams(window.location.search)];

  const first = (key: string): string | null => {
    for (const source of sources) {
      const value = source.get(key);
      if (value) return value;
    }
    return null;
  };

  const rawType = first('type');
  const errorCode = first('error_code') || first('error');
  const callback: AuthCallback = {
    type: rawType && KNOWN_TYPES.has(rawType) ? (rawType as AuthCallbackType) : null,
    hasToken: Boolean(first('access_token') || first('code')),
    errorCode,
    errorDescription: first('error_description'),
  };

  return callback;
}

export const authCallback: AuthCallback = readAuthCallback();

/**
 * Drop a rejected link's parameters from the address bar so the failure is not
 * replayed on every refresh. This runs after mount rather than at module load,
 * so it cannot erase a fragment that the legacy-domain redirect in `supabase.ts`
 * still needs to carry across to the canonical host. A fragment holding
 * credentials is never touched — the Supabase client clears that one itself,
 * unless `force` says the client already tried and failed, which leaves a spent
 * token sitting in the address bar.
 */
export function clearAuthCallbackFromUrl(force = false): void {
  if (typeof window === 'undefined') return;
  if (!force && (!authCallback.errorCode || authCallback.hasToken)) return;

  try {
    window.history.replaceState(null, '', window.location.pathname);
  } catch {
    // A browser that refuses the history rewrite is harmless; the message was
    // already captured at module load.
  }
}

/**
 * Turn a rejected link into something a church volunteer can act on. Supabase's
 * own wording ("Email link is invalid or has expired") does not say what to do
 * next, and `otp_expired` is most often a link that was already opened once —
 * commonly by a mail provider scanning the message before the person clicked.
 */
export function describeAuthCallbackError(callback: AuthCallback): string {
  if (!callback.errorCode) return '';

  const expired = callback.errorCode === 'otp_expired'
    || callback.errorCode === 'access_denied'
    || /expired|invalid/i.test(callback.errorDescription || '');

  if (expired) {
    return callback.type === 'recovery' || callback.type === null
      ? 'That password-reset link has expired or was already used, so your password was not changed. Enter your email below and request a new link — then open it straight away, and use the same browser.'
      : 'That email link has expired or was already used. Please request a new one.';
  }

  return callback.errorDescription
    || 'That email link could not be verified. Please request a new one.';
}
