# Redesign parity map — church-care-hub

**Baseline:** `main` @ `02e156d` ("Implement Central Islip SDA Figma redesign")
**Redesign branch:** `redesign/v2`
**Scope agreed:** visual redesign + new components/interactions. Routes, roles, and data behavior stay identical.

---

## 1. Deployment isolation (verified)

| Workflow | Trigger | Effect on the redesign branch |
|---|---|---|
| `deploy-canonical-live-site.yml` | `push` to **main** only | **Never fires** for `redesign/v2`. Production is safe. |
| `build-production-artifact.yml` | `pull_request` → main | Builds, then **pushes a `release-assets/` commit onto your branch** |
| `pin-live-assets.yml` | `pull_request` → main | Downloads the current live bundle, **pushes a `pinned-live-assets/` commit onto your branch** |
| `security-audit.yml` | PR → main, push to main | Read-only audit |

Two consequences to plan for:

1. Opening the PR makes the bot commit to `redesign/v2`. Always `git pull` before your next local push or you'll hit a rejected push.
2. `pin-live-assets` snapshots the **current live** JS/CSS into the branch — a free rollback reference for the old design. Do not delete `pinned-live-assets/`.

Vercel: production is bound to `main`. A branch push produces a preview URL only. Do not promote the preview to production from the Vercel dashboard until the PR merges.

---

## 2. Contracts that must survive the redesign

Changing anything in this section is what breaks the app. The redesign should treat these as read-only.

**Supabase tables:** `user_profiles`, `visitors`, `members`, `care_notes`, `visit_records`, `attendance_sessions`

**Supabase RPCs (name + argument names are load-bearing):**

- `complete_onboarding(...)` — OnboardingPage
- `approve_role_request(p_user_id, p_approve)` — AdminPage
- `admin_manage_user(...)` — AdminPage
- Edge function `secure-login` — via `src/lib/secureAuth.ts`

**Row Level Security:** five migrations under `supabase/migrations/` enforce role isolation server-side. The UI permission checks are a convenience layer, **not** the security boundary. Do not add a UI affordance assuming RLS will allow it — verify against the migration.

**Environment:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_ORGANIZATION_ID`. `src/lib/supabase.ts` has baked-in fallbacks so a missing env var does not blank the site — keep that fallback.

**Auth storage:** tokens are held **in memory only**, `localStorage` is actively cleared (`src/lib/supabase.ts`). A redesign must not introduce "remember me" persistence without a security review.

**Navigation model:** there is **no router**. `App.tsx` holds `page` state typed as `AppPage`. Adding a page means extending the `AppPage` union *and* `canAccessPage()` — a nav item without a matching permission branch silently falls through to the admin-only check.

---

## 3. Role permission matrix — must be reproduced exactly

Source: `src/lib/permissions.ts`

| Page | Usher | Pastor | Administrator |
|---|:--:|:--:|:--:|
| `dashboard` | ✅ | ✅ | ✅ |
| `visitors` | ✅ | ✅ | ✅ |
| `attendance` | ❌ | ✅ | ✅ |
| `members` | ❌ | ✅ | ✅ |
| `import` | ❌ | ✅ | ✅ |
| `admin` | ❌ | ❌ | ✅ |

Enforced in **three** places — all three must stay in sync:

1. `canAccessPage()` guard in the `App.tsx` effect (resets to dashboard on violation)
2. Conditional nav item construction in `AppShell.tsx`
3. `selectPage()` wrapper, which refuses disallowed transitions

---

## 4. Feature inventory → parity checklist

### Gate flow (`App.tsx`)

Order is significant. Reproduce exactly:

| # | Condition | Screen |
|---|---|---|
| 1 | `loading` | `<Loading />` |
| 2 | no session | `AuthPage` |
| 3 | `PASSWORD_RECOVERY` event | `ResetPasswordPage` |
| 4 | session but no profile row | `OnboardingPage` |
| 5 | `!active` or `role_status !== 'approved'` | `PendingPage` |
| 6 | otherwise | `AppShell` + page |

- [ ] All six states reachable in the new design
- [ ] Timeouts preserved: 8s profile fetch, 4s session fetch, 5s loading fallback
- [ ] `onAuthStateChange` subscription still cleaned up on unmount

### AuthPage

- [ ] Sign-in / sign-up toggle
- [ ] Fields: name (signup only), email, password
- [ ] Forgot-password link → `sendReset()`
- [ ] `locked` state disables submit and reset (brute-force throttle)
- [ ] Routes through `secureSignIn()` — **not** `supabase.auth.signInWithPassword` directly
- [ ] `SecureLoginError` messages surfaced to the user

### OnboardingPage

- [ ] Display name field, min 2 chars
- [ ] Explicit role choice required — no default selection
- [ ] Pastor selection communicates that approval is required
- [ ] Submit calls `complete_onboarding` RPC

### PendingPage

- [ ] Three distinct messages: suspended / rejected / pending
- [ ] Sign-out button

### AppShell

- [ ] Sidebar + mobile drawer with open/close
- [ ] `data-role` attribute on root (CSS keys off it)
- [ ] Dashboard nav label varies by role: "Visitor overview" / "Care overview" / "System overview"
- [ ] Role card, `roleResponsibility()` text, user chip, sign-out
- [ ] Per-page header description from `pageDescription()`
- [ ] `aria-label` on nav and icon buttons

### DashboardPage

- [ ] Active visitor count, active member count
- [ ] Open care-note count, visitor-specific note count
- [ ] Visit-record totals
- [ ] 8-week visitor trend (`visitors.created_at >= eightWeeksAgo`)
- [ ] Recent visitors list
- [ ] Name resolution for notes/visits via `.in('id', ids)` batch lookups
- [ ] Usher variant hides member figures

### PeoplePage (serves both `visitors` and `members` via `type` prop)

- [ ] List + search across name, contact, and full record JSON
- [ ] Add / edit record form
- [ ] Visitor fields: full name, preferred name, contact, first visit date, contact consent checkbox
- [ ] Member fields: first, last, email, phone, address, ministry, joined date
- [ ] Record-a-visit form: datetime-local, outcome select (completed / follow_up_required / no_answer), summary (max 2000)
- [ ] Care note form: category select (support / prayer / follow_up / practical_need), text (max 4000)
- [ ] Resolve / reopen note toggle
- [ ] Visit history and care-note history lists with counts
- [ ] Recording a member visit also updates `members.last_contact_at`
- [ ] 1,000-record fetch limit retained

### AttendancePage

This file is **minified onto one line** (5 lines total). Rewrite it readably as part of the redesign, but keep every behavior:

- [ ] Editable service name, default "Sunday Morning Service"
- [ ] New / returning counters with increment and decrement
- [ ] Live total = new + returning
- [ ] Undo-last using the `history` stack (not just decrement)
- [ ] Counters floor at 0
- [ ] Save inserts to `attendance_sessions` with `service_date` = today ISO date
- [ ] Form resets after save

### ImportPage

- [ ] CSV and XLSX upload (drag/drop or picker)
- [ ] Auto column mapping display
- [ ] Preview before commit
- [ ] Limits enforced: 1,000 rows, 32 columns, 5 MB file, 12 MB zip entry
- [ ] Error surfacing for malformed files
- [ ] `src/lib/memberSpreadsheet.ts` is a hand-rolled zip/XML parser — **do not touch it**, only its UI

### AdminPage

- [ ] Pending pastor requests list, Approve / Reject → `approve_role_request`
- [ ] "Access by role" summary
- [ ] System health metrics: member, visitor, visit-record, attendance-session, open-note counts
- [ ] User table with role reassignment and suspend → `admin_manage_user`
- [ ] Refresh button
- [ ] Per-user busy state during mutation

---

## 5. Styling

Two stylesheets: `src/styles.css` (463 lines) and `src/care-workspace.css` (687 lines), both plain CSS with semantic class names. Icons via `lucide-react`.

Recommended approach, lowest risk first:

1. Restyle by editing the two CSS files — class names in the TSX stay untouched, so zero behavioral risk.
2. Only rename classes when you change the corresponding TSX in the same commit.
3. Adding a CSS framework means touching every component; if you go that route, do it page by page with a parity check per page.

Keep: the `data-role` root attribute, `.app-shell` / `.sidebar` / `.workspace` structure the mobile drawer depends on, and the `aria-label`s.

---

## 6. Pre-merge verification

- [ ] `npm run build` passes (`tsc -b && vite build`)
- [ ] `git diff main...redesign/v2 -- src/lib/ supabase/` is **empty** or intentionally reviewed
- [ ] `grep -c "supabase.from\|supabase.rpc"` matches between branches
- [ ] `AppPage` union unchanged, or `canAccessPage` extended to match
- [ ] Manual pass: sign in as usher, pastor, administrator — confirm the §3 matrix
- [ ] Manual pass: all six gate states from §4
- [ ] Vercel preview loads without a blank screen (env injection working)
- [ ] Preview **not** promoted to production
