import { useState, type FormEvent } from 'react';
import type { AuthError } from '@supabase/supabase-js';
import { Brand } from '../components/Brand';
import { supabase } from '../lib/supabase';
import { clearLoginThrottleForPasswordReset } from '../lib/secureAuth';

/**
 * A recovery session is short-lived, so somebody who opens the link and then
 * leaves the form sitting can come back to a session that no longer exists.
 * Supabase reports that as an ordinary update failure, which reads as though the
 * password was rejected rather than the link having lapsed.
 */
function recoverySessionExpired(error: AuthError): boolean {
  if (error.status === 401 || error.status === 403) return true;
  return /session|expired|jwt|token/i.test(error.message);
}

export function ResetPasswordPage({
  onComplete,
}: {
  onComplete: (message: string, isError: boolean) => void;
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage('');
    const f = new FormData(e.currentTarget);
    const password = String(f.get('password'));
    const confirmation = String(f.get('confirmation'));

    if (password !== confirmation) {
      setMessage('The passwords do not match.');
      return;
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)) {
      setMessage('Use at least 8 characters with an uppercase letter, lowercase letter, number, and symbol.');
      return;
    }

    setBusy(true);
    // Supabase terminates the recovery session when the password changes. Clear
    // the login throttle first, while the recovery token can still be verified,
    // so the sign-in that follows is not turned away by an earlier lockout.
    await clearLoginThrottleForPasswordReset();

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setBusy(false);
      if (recoverySessionExpired(error)) {
        onComplete(
          'That reset link expired before the new password could be saved, so your password has not changed. Request a new link and open it straight away.',
          true,
        );
        return;
      }
      setMessage(error.message);
      return;
    }

    setBusy(false);
    onComplete('Your password has been updated. Sign in below with your new password.', false);
  }

  return (
    <main className="center-screen">
      <section className="onboarding-card">
        <Brand />
        <h1>Choose a new password</h1>
        <p>Enter a new password for your Church Care Hub account. You will sign in with it on the next screen.</p>
        {message && <div className="notice error" role="alert">{message}</div>}
        <form onSubmit={submit}>
          <label>
            New password
            <input name="password" type="password" minLength={8} autoComplete="new-password" required />
            <small>8+ characters with uppercase, lowercase, number, and symbol.</small>
          </label>
          <label>
            Confirm new password
            <input name="confirmation" type="password" minLength={8} autoComplete="new-password" required />
          </label>
          <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
        </form>
      </section>
    </main>
  );
}
