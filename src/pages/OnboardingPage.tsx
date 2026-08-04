import { useState } from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { Brand } from '../components/Brand';
import { supabase } from '../lib/supabase';

export function OnboardingPage({ defaultName, onDone }: { defaultName: string; onDone: () => void }) {
  const [role, setRole] = useState<'usher' | 'pastor' | null>(null);
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!role || name.trim().length < 2) return;
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
    <main className="center-screen">
      <section className="onboarding-card role-onboarding-card">
        <Brand />
        <div><div className="eyebrow">Personalized ministry workspace</div><h1>Choose what you are responsible for</h1><p>Your approved role determines the sections visible after every sign-in.</p></div>
        {error && <div className="notice error">{error}</div>}
        <label>Display name<input value={name} onChange={event => setName(event.target.value)} maxLength={100} required /></label>
        <div className="role-grid three-role-grid">
          <button type="button" className={role === 'usher' ? 'selected' : ''} onClick={() => setRole('usher')}>
            <strong>Usher</strong><span>Attendance, visitor information, visitor visits and support notes.</span><small>Approved immediately</small>
          </button>
          <button type="button" className={role === 'pastor' ? 'selected' : ''} onClick={() => setRole('pastor')}>
            <strong>Pastor</strong><span>All visitor work plus members, Excel imports and pastoral care records.</span><small>Administrator approval required</small>
          </button>
          <div className="role-card locked-role">
            <ShieldCheck size={22} /><strong>Administrator</strong><span>Full application oversight, user access and all ministry sections.</span><small><LockKeyhole size={14} /> Assigned by an existing administrator</small>
          </div>
        </div>
        <div className="role-security-note"><LockKeyhole size={17} /><span>Administrator access cannot be self-selected. This protects member and care information.</span></div>
        <button className="primary" disabled={!role || busy || name.trim().length < 2} onClick={() => void save()}>{busy ? 'Saving…' : 'Continue to my workspace'}</button>
      </section>
    </main>
  );
}
