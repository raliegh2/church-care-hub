# church-care-hub — Security operations adoption

Status: local preparation for owner review; not pushed, merged or deployed.

## Platform and trust boundaries

Cloudflare Workers/D1 with scoped church/account roles. Preserve organization isolation, active-account approval, pastoral access and session revocation. Do not copy pastoral or member records into security reports.

## Prepared protections

The new cloudflare/security-boundary.mjs wraps the existing entry point. It blocks cross-site/foreign-origin API writes before application work, assigns server-owned request IDs, adds no-store and restrictive browser headers to API responses, and emits structured allowlisted security outcome metadata. Response bodies, status and session cookies are preserved. No request body, cookie, credential, customer ID, IP address or query string enters this added logging path. Existing provider/library logs require a separate privacy review. Provider log retention, access and ingestion are not configured by this patch.

A pinned GitHub Actions workflow runs security regressions on pull requests and main/master pushes with contents:read and no deployment step. The workflow is prepared; it has not been confirmed executed on GitHub.

## Verification

30 tests passed locally. The Cloudflare artifact build passed. No production requests containing customer data or real malware were used.

## Fourteen control requirements

### Alert triage

- Named responder and severity policy
- Acknowledgement and escalation targets with an on-call fallback

Evidence needed: named owner, platform applicability/alternative, UTC observation time, revision/provider receipt and verification result. Keep deployment claims pending until verified against the deployed revision.

### Log analysis

- Structured allowlisted metadata logs; no request bodies, cookies or tokens
- Retention, access controls, clock synchronization and ingestion health ownership

Evidence needed: named owner, platform applicability/alternative, UTC observation time, revision/provider receipt and verification result. Keep deployment claims pending until verified against the deployed revision.

### SIEM queries (SPL / KQL)

- Versioned queries with bounded windows and named data-source mappings
- A tested export/ingestion connector; local fixtures do not certify an external SIEM

Evidence needed: named owner, platform applicability/alternative, UTC observation time, revision/provider receipt and verification result. Keep deployment claims pending until verified against the deployed revision.

### EDR investigation

- EDR coverage on supported endpoints or documented platform/provider alternative
- Least privilege and reviewed process execution policy; Workers do not expose workstation process trees

Evidence needed: named owner, platform applicability/alternative, UTC observation time, revision/provider receipt and verification result. Keep deployment claims pending until verified against the deployed revision.

### Phishing analysis

- Mail authentication and reported-message handling where email is used
- Verified password-reset destinations and provider abuse reporting

Evidence needed: named owner, platform applicability/alternative, UTC observation time, revision/provider receipt and verification result. Keep deployment claims pending until verified against the deployed revision.

### Malware triage

- Quarantine and scan upload paths where applicable
- No executable samples or shell commands accepted by Command Deck labs

Evidence needed: named owner, platform applicability/alternative, UTC observation time, revision/provider receipt and verification result. Keep deployment claims pending until verified against the deployed revision.

### IOC enrichment

- Approved enrichment providers and an explicit data-sharing policy
- Local-only lookup by default; no customer indicators sent externally

Evidence needed: named owner, platform applicability/alternative, UTC observation time, revision/provider receipt and verification result. Keep deployment claims pending until verified against the deployed revision.

### Detection tuning

- Versioned thresholds and expiring exceptions
- Detection changes require review; never suppress all failures globally

Evidence needed: named owner, platform applicability/alternative, UTC observation time, revision/provider receipt and verification result. Keep deployment claims pending until verified against the deployed revision.

### ATT&CK mapping

- Reviewable detection-to-technique mapping with coverage gaps
- Technique labels do not establish incident confirmation or prevention coverage

Evidence needed: named owner, platform applicability/alternative, UTC observation time, revision/provider receipt and verification result. Keep deployment claims pending until verified against the deployed revision.

### Forensic timelines

- Protected event retention and export/custody procedure
- Off-device protected log export for stronger integrity guarantees

Evidence needed: named owner, platform applicability/alternative, UTC observation time, revision/provider receipt and verification result. Keep deployment claims pending until verified against the deployed revision.

### Escalation & handoff

- On-call ownership, handoff template and escalation channel
- Sensitive evidence remains in its authorized store; summaries are redacted

Evidence needed: named owner, platform applicability/alternative, UTC observation time, revision/provider receipt and verification result. Keep deployment claims pending until verified against the deployed revision.

### SOAR automation

- Allowlisted actions, least privilege and idempotency
- No automatic production mutations; preserve reviewed-fix workflow

Evidence needed: named owner, platform applicability/alternative, UTC observation time, revision/provider receipt and verification result. Keep deployment claims pending until verified against the deployed revision.

### Reporting & lessons learned

- Post-incident review and tracked corrective work
- Lessons enter RAG/CAG only through the existing review boundary

Evidence needed: named owner, platform applicability/alternative, UTC observation time, revision/provider receipt and verification result. Keep deployment claims pending until verified against the deployed revision.

### Purple team exercises

- Scheduled scoped exercises with rollback and stopping criteria
- Synthetic success is not evidence of live EDR/SIEM coverage

Evidence needed: named owner, platform applicability/alternative, UTC observation time, revision/provider receipt and verification result. Keep deployment claims pending until verified against the deployed revision.


## Rollout and rollback

Review the prepared patch and the source manifest in Command Deck. Re-run the listed tests/build, review existing deployment automation, and use the normal approved merge/deploy workflow. After deployment, test login/session/authorization and safe failure responses, verify request-ID and policy headers, and verify sanitized log ingestion/retention. Do not change production credentials, user records or isolation rules as part of this baseline rollout. Revert the reviewed commit through the normal release path if regression evidence warrants rollback; no data/schema migration is included.

## Knowledge, labs and remaining setup

Command Deck's Cybersecurity section and shared security-operations Markdown library hold the investigation steps, SPL/KQL templates, inert labs and evidence review. Synthetic results never satisfy production controls. SIEM ingestion, endpoint/provider telemetry coverage, mail authentication where applicable, on-call ownership and off-device protected evidence retention still require configured and reviewed evidence. The current local reviewer uses the operator bearer session; no independently authenticated reviewer identity is introduced.
