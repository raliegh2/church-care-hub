import { useState } from 'react';
import { ContactRound, HeartHandshake, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Brand } from '../components/Brand';
import { supabase } from '../lib/supabase';

export function OnboardingPage({ defaultName, onDone }: { defaultName: string; onDone: () => void }) {
  const [role, setRole] = useState<'usher' | 'pastor' | null>(null);
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!role) {
      setError('Select either Usher or Pastor to continue.');
      return;
    }
    if (name.trim().length < 2) {
      setError('Enter your display name to continue.');
      return;
    }

    setBusy(true);
    setError('');
    const { error: saveError } = await supabase.rpc('complete_onboarding', {
      p_display_name: name.trim(),
      p_requested_role: role,
    });
    setBusy(false);
    if (saveError) setError(saveError.message);
    else onDone();
  }

  return (
    <main className="role-onboarding-page">
      <header className="role-onboarding-header">
        <Brand subtitle="Church Care System" />
        <div className="role-progress" aria-label="Account setup progress">
          <span className="complete">Account</span>
          <span className="active">Choose role</span>
          <span>Access</span>
        </div>
      </header>

      <section className="role-onboarding-content">
        <div className="role-onboarding-intro">
          <div className="eyebrow">Ministry responsibility</div>
          <h1>Choose how you serve</h1>
          <p>Your role controls what information you can see and manage. You can request a change later from an administrator.</p>
        </div>

        {error && <div className="notice error">{error}</div>}

        <label className="onboarding-name-field">
          Display name
          <input value={name} onChange={event => setName(event.target.value)} maxLength={100} required />
        </label>

        <div className="role-choice-grid" aria-label="Choose your role">
          <button
            type="button"
            aria-pressed={role === 'usher'}
            className={role === 'usher' ? 'selected' : ''}
            onClick={() => setRole('usher')}
          >
            <span className="role-choice-icon"><ContactRound /></span>
            <span className="role-choice-copy">
              <span className="role-choice-title"><strong>Usher</strong><small>Immediate access</small></span>
              <span>Manage visitor profiles, visitor counts, visit history and visitor support notes.</span>
              <em>{role === 'usher' ? 'Selected' : 'Select this role'}</em>
            </span>
          </button>

          <button
            type="button"
            aria-pressed={role === 'pastor'}
            className={role === 'pastor' ? 'selected' : ''}
            onClick={() => setRole('pastor')}
          >
            <span className="role-choice-icon pastor"><HeartHandshake /></span>
            <span className="role-choice-copy">
              <span className="role-choice-title"><strong>Pastor</strong><small>Administrator approval required</small></span>
              <span>Access visitor and member care records, member imports, attendance and ministry follow-up.</span>
              <em>{role === 'pastor' ? 'Selected' : 'Select this role'}</em>
            </span>
          </button>
        </div>

        <div className="administrator-role-note">
          <span className="role-choice-icon pastor"><ShieldCheck /></span>
          <span><strong>Administrator roles are assigned, not self-selected.</strong><small>An existing administrator reviews the account and grants full system access.</small></span>
        </div>

        <div className="role-onboarding-actions">
          <div className="role-security-note"><LockKeyhole size={16} /> Pastor access remains locked until an administrator approves the request.</div>
          <button className="primary" disabled={!role || busy || name.trim().length < 2} onClick={() => void save()}>
            {busy ? 'Saving…' : role === 'pastor' ? 'Request pastor access' : 'Continue as usher'}
          </button>
        </div>
      </section>
    </main>
  );
}
