# Cloudflare deployment

Application: https://church-care-hub.church-care-hub.workers.dev

Workers serves the Vite frontend, the same-origin D1 data API, and Better Auth authentication. The API checks organization, role, ownership, active status and access-change timestamps on every request. Sessions are signed Secure, HttpOnly, host-only cookies. The frontend has no Supabase service dependency. The PostgREST query-builder package only builds requests to this Worker's API.

## Build and deploy

From the repository root, run `npm ci`, `npm run test:cloudflare`, and `npm run deploy:cloudflare`. Wrangler must be logged into the correct Cloudflare account. Both regular and Cloudflare frontend builds use the same-origin backend.

Set `AUTH_SECRET` and `SMTP_PASSWORD` using `npx wrangler secret put NAME`. Local values belong in ignored `.dev.vars`, never in public configuration or Git. `wrangler.jsonc` configures Gmail SMTP over TLS on port 465 and the public sender address. Gmail requires an App Password with 2-Step Verification enabled. Without the SMTP secret, public signup and password recovery fail explicitly; existing verified accounts can sign in.

## Migration state

Both D1 schemas and three existing identities have already been imported. Do not reapply `0001_initial.sql` or `0002_auth.sql` to this database. Existing IDs, emails and bcrypt hashes were retained. New passwords use native scrypt. Migrating credentials never requires plaintext passwords. `_identity_users` preserves foreign-key links for application records; authentication records live in `cf_auth_*` tables.

Private exports, import statements and verification reports are in ignored `.migration/`. `prepare-auth-import.mjs` generates a new schema and validates a private identity import in SQLite; it is a preparation tool, not a deployment command. `compare-data.mjs` checks private current Supabase and D1 snapshots without exposing records. Initial application export included 19 records; 16 are application records and three are technical keepalive/throttle records.

The authentication tests verify migrated-password login, signed cookie rejection, revocation, suspension, access-change timestamps, signup verification, one-use password recovery and invalidated sessions. `remote-auth-smoke.mjs` creates synthetic test records, verifies deployed login and record creation/edit/reopening, verifies sign-out, then removes only its own synthetic records.

## Cutover and rollback

The Cloudflare application runs independently of Supabase. Gmail authentication and a deployed Worker recovery-email request to the sender mailbox have been verified; signup and recovery are enabled. The old `church-care-hub.vercel.app` address now sends a reversible 307 redirect to Cloudflare, preserving paths and query strings. The repository's `vercel.json` also redirects future Vercel builds to Cloudflare.

The final application snapshot matched the imported data, and an integrity checksum confirmed all three migrated credentials still matched the source. A private final snapshot is retained. After verifying the redirect, the user explicitly approved pausing the old Supabase project as a rollback backup. The pause request succeeded. No broad database grants were changed, and the old project was not deleted. Its old keepalive is no longer needed by Church Care Hub.

After the pause request, deployed synthetic-account tests again passed for login, record creation/edit/reopening, and session revocation. User verification of real accounts remains outstanding at the user's request. The delivery test confirms the Worker email request succeeded; inbox placement should be checked by the mailbox owner.

Rollback requires restoring the old Vercel deployment/routing and reconciling any Cloudflare writes made after cutover. Simply redirecting back would discard those new changes from the user's view.
