# Reliability and inexpensive growth

The frontend stays static on Vercel's CDN. Supabase provides the API, authentication and database. No always-on application server, queue service or paid monitoring subscription was added.

## Current protections

- Authenticated pages are loaded on demand. Hashed public assets cache for one year; private API responses are never put in a shared application cache.
- The Supabase transport deduplicates identical in-flight GET/HEAD reads within one browser client, including Authorization in the key. It does not retain settled response data. Read-only Data API requests retry temporary failures at most twice, with bounded backoff, respecting Retry-After up to two seconds. Individual fetch attempts time out after 12 seconds; caller aborts stop retries. Authentication and writes are never automatically replayed.
- Secure-login POSTs also have a 12-second fetch deadline, without retries. Profile-load failures offer Retry rather than sending an existing user into onboarding. Render failures show a recovery page.
- Member/visitor directories request 51 rows, display 50, and search server-side after a 300 ms debounce. Care histories request 101 and display 100, with explicit loading of older records. Organization/active/date indexes match the directory queries. Stale page responses cannot overwrite a newer selection.
- Imports retain a UUID per validated row and write at most 200 per batch. Confirmed batches are removed after a partial failure; retrying the remaining stable IDs uses ON CONFLICT DO NOTHING. The 1,000-row/5 MiB file bounds remain enforced. A new upload is a new import, not a semantic duplicate detector.
- Attendance retains its payload/UUID after an uncertain response. Retry confirms the same service without inserting another row. Controls stay locked until that pending save is confirmed. Notes and visits also retain IDs while an unchanged payload is retried, and failed note text is preserved.
- Dashboard query failures show an error and Retry rather than misleading zero totals. Existing RLS and permissions remain intact.
- GitHub CI runs transport regressions and a production build on pushes and pull requests.

## Verification

Run `npm ci`, `node --test scripts/reliability.test.cjs`, and `npm run build`.

Regression tests cover 1,000 simultaneous identical reads, isolation between user tokens, bounded retries and non-replayed writes. Browser tests used synthetic authenticated responses and simulated a commit followed by a lost response: a 400-member import finished with exactly 400 unique IDs and attendance with exactly one row. No synthetic members were written to production. These results are not a 1,000-user production capacity guarantee.

## Operations and scaling triggers

Use Vercel deployment/build status and Supabase API/function/database logs and metrics already provided by the platforms. Watch API 429/5xx, login failures, database CPU, connection pressure, query latency, storage and egress. Investigate repeated failures or normal interactive p95 latency above two seconds. No recurring external monitor was configured.

Avoid upgrading frontend hosting simply to solve slow database queries. Check SQL plans and RLS evaluation, then add a narrowly justified index or server-side aggregation before buying larger database compute. Use realistic staging data for capacity tests; do not send large artificial bursts to the live care database.

Next growth targets are server-side dashboard trend/birthday aggregation, birthday/admin list pagination, and shared query caching inside the browser. Some legacy report queries still inherit the Data API row limit (commonly 1,000); they require explicit pagination/aggregation before large datasets to keep totals/pipelines complete. Substring directory search is bounded in returned rows but can still scan many records; consider measured full-text/trigram search if needed, rather than indexing every personal field now.

Idempotent import/attendance state currently lives in the open page. Keep that page open to retry an uncertain result; reloading or deliberately re-uploading a file creates a new operation. Persisting resumable jobs server-side is the next step if imports must survive tab closure. Establish backup/restore and retention policies appropriate to the Supabase plan; no paid backup plan was purchased here.

## Rollback

Revert the deployment commit and redeploy. The two additive active-directory indexes can remain: they do not change data or RLS. Use the Vercel previous production deployment for an immediate frontend rollback if necessary.
