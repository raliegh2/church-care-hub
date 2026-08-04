import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AppShell } from './components/AppShell';
import { Loading } from './components/Loading';
import { supabase } from './lib/supabase';
import { AdminPage } from './pages/AdminPage';
import { AttendancePage } from './pages/AttendancePage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { ImportPage } from './pages/ImportPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { PendingPage } from './pages/PendingPage';
import { PeoplePage } from './pages/PeoplePage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import type { UserProfile } from './types';

type Page = 'dashboard' | 'attendance' | 'visitors' | 'members' | 'import' | 'admin';

function timeoutAfter(milliseconds: number) {
  return new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('Request timed out')), milliseconds);
  });
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  const [page, setPage] = useState<Page>('dashboard');

  const loadProfile = useCallback(async (current: Session | null) => {
    if (!current) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await Promise.race([
        supabase.from('user_profiles').select('*').eq('id', current.user.id).maybeSingle(),
        timeoutAfter(8000),
      ]);
      if (error) throw error;
      setProfile((data || null) as UserProfile | null);
    } catch (error) {
      console.error('Unable to load profile', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const fallback = window.setTimeout(() => {
      if (active) setLoading(false);
    }, 5000);

    void Promise.race([supabase.auth.getSession(), timeoutAfter(4000)])
      .then(({ data, error }) => {
        if (error) throw error;
        if (!active) return;
        setSession(data.session);
        setLoading(false);
        if (data.session) void loadProfile(data.session);
      })
      .catch((error) => {
        console.error('Unable to initialize session', error);
        if (active) {
          setSession(null);
          setProfile(null);
          setLoading(false);
        }
      })
      .finally(() => window.clearTimeout(fallback));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      setSession(next);
      void loadProfile(next);
    });

    return () => {
      active = false;
      window.clearTimeout(fallback);
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  if (loading) return <Loading />;
  if (!session) return <AuthPage />;
  if (recovering) return <ResetPasswordPage onDone={() => setRecovering(false)} />;
  if (!profile) {
    return (
      <OnboardingPage
        defaultName={String(session.user.user_metadata.display_name || '')}
        onDone={() => loadProfile(session)}
      />
    );
  }
  if (profile.role_status === 'pending') return <PendingPage />;

  return (
    <AppShell profile={profile} page={page} setPage={setPage} signOut={() => void supabase.auth.signOut()}>
      {page === 'dashboard' && <DashboardPage />}
      {page === 'attendance' && <AttendancePage userId={session.user.id} />}
      {page === 'visitors' && <PeoplePage type="visitor" userId={session.user.id} />}
      {page === 'members' && <PeoplePage type="member" userId={session.user.id} />}
      {page === 'import' && <ImportPage userId={session.user.id} />}
      {page === 'admin' && <AdminPage />}
    </AppShell>
  );
}
