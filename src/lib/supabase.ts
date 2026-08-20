// Imported first, and only for its side effect: it records what the Supabase
// email link said before `createClient` below consumes and erases the URL
// fragment that carries it.
import './authCallback';
import { createClient } from '@supabase/supabase-js';

export const canonicalAppOrigin = 'https://church-care-hub.vercel.app';

/**
 * These are public browser-client settings. Environment variables can override
 * them, but production remains functional if a hosting project is recreated or
 * its Vite variables are accidentally removed.
 */
const defaultSupabaseUrl = 'https://vzjcudzsheiszdailwns.supabase.co';
const defaultSupabasePublishableKey = 'sb_publishable_jQr7KcgsDrPf0yptfJloXA_WtC93lpL';
const defaultOrganizationId = 'a9456be1-5b06-4fbb-b5c1-cd5b66b3ff6a';

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

export const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || defaultSupabaseUrl;
export const supabasePublishableKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() || defaultSupabasePublishableKey;
export const organizationId =
  (import.meta.env.VITE_ORGANIZATION_ID as string | undefined)?.trim() || defaultOrganizationId;

/**
 * Render a readable message instead of a blank white screen if the public
 * client configuration is ever invalid.
 */
function renderConfigError(): void {
  if (typeof document === 'undefined') return;
  const root = document.getElementById('root');
  if (!root) return;
  root.innerHTML =
    '<div style="min-height:100vh;display:grid;place-items:center;padding:24px;' +
    'font-family:Inter,system-ui,-apple-system,sans-serif;color:#102438;text-align:center">' +
    '<div style="max-width:440px">' +
    '<h1 style="margin:0 0 8px;color:#071a2b">Central Islip SDA</h1>' +
    '<p style="color:#637487;line-height:1.55">This site is temporarily unavailable because its ' +
    'configuration is invalid. Please contact the administrator and try again shortly.</p>' +
    '</div></div>';
}

let configurationValid = true;
try {
  const parsedUrl = new URL(supabaseUrl);
  configurationValid = parsedUrl.protocol === 'https:' && Boolean(supabasePublishableKey) && Boolean(organizationId);
} catch {
  configurationValid = false;
}

if (!configurationValid) {
  renderConfigError();
  throw new Error('Invalid public Supabase client configuration.');
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

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
