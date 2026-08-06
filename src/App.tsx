import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AppShell } from './components/AppShell';
import { Loading } from './components/Loading';
import { canAccessPage, type AppPage } from './lib/permissions';
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
  const [page, setPage] = useState<AppPage>('dashboard');

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
      .catch(error => {
        console.error('Unable to initialize session', error);
        if (active) {
          setSession(null);
          setProfile(null);
          setLoading(false);
        }
      })
      .finally(() => window.clearTimeout(fallback));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
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

  useEffect(() => {
    if (profile && !canAccessPage(profile.role, page)) setPage('dashboard');
  }, [page, profile]);

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
  if (!profile.active || profile.role_status !== 'approved') {
    return <PendingPage status={profile.role_status} active={profile.active} />;
  }

  const safePage = canAccessPage(profile.role, page) ? page : 'dashboard';
  const selectPage = (nextPage: AppPage) => {
    if (canAccessPage(profile.role, nextPage)) setPage(nextPage);
  };

  return (
    <AppShell profile={profile} page={safePage} setPage={selectPage} signOut={() => void supabase.auth.signOut()}>
      {safePage === 'dashboard' && <DashboardPage role={profile.role} />}
      {safePage === 'attendance' && <AttendancePage userId={session.user.id} />}
      {safePage === 'visitors' && <PeoplePage type="visitor" userId={session.user.id} role={profile.role} />}
      {safePage === 'members' && <PeoplePage type="member" userId={session.user.id} role={profile.role} />}
      {safePage === 'import' && <ImportPage userId={session.user.id} />}
      {safePage === 'admin' && <AdminPage userId={session.user.id} />}
    </AppShell>
  );
}
