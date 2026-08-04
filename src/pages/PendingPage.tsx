import { Brand } from '../components/Brand';
import { supabase } from '../lib/supabase';
import type { RoleStatus } from '../types';

export function PendingPage({ status, active }: { status: RoleStatus; active: boolean }) {
  const title = !active
    ? 'Account access suspended'
    : status === 'rejected'
      ? 'Pastor access not approved'
      : 'Pastor access pending';
  const message = !active
    ? 'An administrator has suspended this account. Contact the administrator for assistance.'
    : status === 'rejected'
      ? 'Your pastor-role request was not approved. Contact the administrator before trying again.'
      : 'Your pastor-role request is waiting for an administrator to review and approve it.';

  return (
    <main className="center-screen">
      <section className="onboarding-card">
        <Brand />
        <h1>{title}</h1>
        <p>{message}</p>
        <button className="secondary" onClick={() => void supabase.auth.signOut()}>Sign out</button>
      </section>
    </main>
  );
}
