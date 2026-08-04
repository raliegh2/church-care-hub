import { createClient } from '@supabase/supabase-js';

export const canonicalAppOrigin = 'https://church-care-hub.vercel.app';

/**
 * Older password-reset emails can still open the retired Vercel deployment.
 * When that deployment receives a new build from this repository, move the
 * browser to the canonical app while preserving Supabase recovery parameters.
 */
function redirectRetiredDeployment(): void {
  if (typeof window === 'undefined') return;

  const retiredHosts = new Set([
    'church-visitor-attendance-productio.vercel.app',
  ]);

  if (!retiredHosts.has(window.location.hostname)) return;

  const destination = `${canonicalAppOrigin}${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(destination);
}

redirectRetiredDeployment();

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
export const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY.');
}

/**
 * Remove tokens created by earlier releases that persisted Supabase sessions in
 * localStorage. The current release intentionally keeps tokens in memory only,
 * so closing or reloading the page always returns the user to the login screen.
 */
function clearLegacyPersistedSession(): void {
  if (typeof window === 'undefined') return;

  try {
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
    if (projectRef) {
      window.localStorage.removeItem(`sb-${projectRef}-auth-token`);
    }
  } catch {
    // A custom Supabase domain may not expose a project ref in its hostname.
    // persistSession=false below remains the security boundary in that case.
  }
}

clearLegacyPersistedSession();

export const organizationId = import.meta.env.VITE_ORGANIZATION_ID as string;
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
