# Security pipeline and production response

## Coverage

Security and regression gate runs on pull requests and pushes to the default and migration/cloudflare branches, daily, and manually. npm ci uses the lockfile without lifecycle scripts; npm audit blocks high/critical advisories. Existing regression tests, authentication/generator smoke tests (LessonPlanToGo), builds (ChurchCareHub), and Cloudflare security tests/builds run where present. Daily/manual runs also explicitly check migration/cloudflare, the currently deployed source. Do not merge the migration merely to activate this pipeline.

Dependabot proposes weekly npm and Actions updates. No automatic merge is configured. Review scanner findings privately; public pipeline incidents contain only evidence links, not advisory or secret details.

Production watch checks the Cloudflare public HTML and same-origin JS/CSS plus /readyz (including D1 readiness) every 15 minutes and on deployment status events. Three failed attempts open one incident assigned to raliegh2. Later passing checks record recovery and close it. Default/migration branch workflow failures open separate deduplicated incidents. Issue assignments and Actions notifications depend on your GitHub account notification settings. Scheduled Actions can be delayed or dropped; this is not an uptime SLA.

Public checks do not verify authenticated journeys, database semantics, payment flows or browser runtime exceptions. Add synthetic accounts and error telemetry separately. The obsolete Supabase keepalive is not evidence of Cloudflare health.

## Release control and setup requirements

Verified Cloudflare release is manual, requires Security and regression gate, builds the same checked-out revision, uses the production environment, and deploys without applying database migrations. Run it on migration/cloudflare after the pipeline changes have reached that branch, or on the default branch after the migration is independently merged. It refuses legacy source without wrangler.jsonc. It needs a narrowly scoped production environment secret CLOUDFLARE_API_TOKEN and variable CLOUDFLARE_ACCOUNT_ID. Do not copy personal tokens into files or issue comments. Restrict the environment to approved release branches and require a reviewer where your plan supports it.

Legacy Vercel automatic deployment is disabled by this change to avoid overwriting the current Cloudflare/redirect setup. Render is currently a legacy redirect; changing its deployment configuration is outside this pipeline setup. GitHub branch protection should require Security and regression gate on default and migration branches where supported. The private LessonPlanToGo repository currently returns a plan-upgrade requirement for branch protection. Local/manual Wrangler commands and host dashboard deploys can bypass GitHub checks; restrict deployment credentials to the controlled release process to enforce this beyond GitHub.

## Incident response

1. Open the linked failed run and distinguish CI failure from production impact. Inspect hosting logs privately.
2. If production regressed, restore a known-good Worker version in Cloudflare. Do not automatically roll back database migrations.
3. Revoke and rotate suspected exposed credentials at their providers; investigate access.
4. Repair through a pull request, pass security/regression checks, then release the tested revision. Verify the affected user journey in production.
5. Record impact, recovery and follow-up without credentials or customer data.

For faster independent outage detection than best-effort Actions, add an external uptime monitor and route alerts to a verified contact channel. GitHub security alert delivery also depends on account preferences.
