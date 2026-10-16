import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from './lib/backend';
import { AppShell } from './components/AppShell';
import { Loading } from './components/Loading';
import { SiteCredit } from './components/SiteCredit';
import { authCallback, clearAuthCallbackFromUrl, describeAuthCallbackError } from './lib/authCallback';
import { canAccessPage, type AppPage } from './lib/permissions';
import { backend, recoveryToken } from './lib/backend';
const AdminPage = lazy(() => import('./pages/AdminPage').then(module => ({ default: module.AdminPage })));
const AttendancePage = lazy(() => import('./pages/AttendancePage').then(module => ({ default: module.AttendancePage })));
import { AuthPage, type AuthNotice } from './pages/AuthPage';
const BirthdaysPage = lazy(() => import('./pages/BirthdaysPage').then(module => ({ default: module.BirthdaysPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(module => ({ default: module.DashboardPage })));
const ImportPage = lazy(() => import('./pages/ImportPage').then(module => ({ default: module.ImportPage })));
import { OnboardingPage } from './pages/OnboardingPage';
import { PendingPage } from './pages/PendingPage';
const PeoplePage = lazy(() => import('./pages/PeoplePage').then(module => ({ default: module.PeoplePage })));
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import type { UserProfile } from './types';

/** A recovery link that arrived with credentials the client can still redeem. */
const arrivedFromRecoveryLink = Boolean(recoveryToken) || (authCallback.type === 'recovery' && authCallback.hasToken);

function initialNotice(): AuthNotice | null {
  const failure = describeAuthCallbackError(authCallback);
  return failure ? { text: failure, isError: true } : null;
}

function timeoutAfter(milliseconds: number) {
  return new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('Request timed out')), milliseconds);
  });
}

function SitePage({ children }: { children: ReactNode }) {
  return (
    <div className="site-page">
      {children}
      <SiteCredit />
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  // Seeded from the URL rather than waiting for PASSWORD_RECOVERY. The Supabase
  // client emits that event once, from a timer started before React mounts, so a
  // listener can miss it entirely - which would drop somebody onto the dashboard
  // instead of the "choose a new password" screen, leaving their password
  // unchanged and their next sign-in attempt failing.
  const [recovering, setRecovering] = useState(arrivedFromRecoveryLink);
  const [notice, setNotice] = useState<AuthNotice | null>(initialNotice);
  const [page, setPage] = useState<AppPage>('dashboard');
  const loadedUserId = useRef<string | null>(null);
  const profileRequest = useRef(0);
  const [profileError, setProfileError] = useState('');

  const loadProfile = useCallback(async (current: Session | null) => {
    const request = ++profileRequest.current;
    setProfileError('');
    if (!current) {
      loadedUserId.current = null;
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await Promise.race([
        backend.from('user_profiles').select('*').eq('id', current.user.id).maybeSingle(),
        timeoutAfter(8000),
      ]);
      if (request !== profileRequest.current) return;
      if (error) throw error;
      loadedUserId.current = current.user.id;
      setProfile((data || null) as UserProfile | null);
    } catch (error) {
      if (request !== profileRequest.current) return;
      console.error('Unable to load profile', error);
      setProfileError('Your profile could not be loaded. Please retry.');
      setProfile(null);
    } finally {
      if (request === profileRequest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearAuthCallbackFromUrl();
  }, []);

  useEffect(() => {
    let active = true;
    const fallback = window.setTimeout(() => {
      if (active) setLoading(false);
    }, 5000);

    void Promise.race([backend.auth.getSession(), timeoutAfter(4000)])
      .then(({ data, error }) => {
        if (error) throw error;
        if (!active) return;
        setSession(data.session);
        setLoading(false);
        if (data.session) {
          void loadProfile(data.session);
        } else if (arrivedFromRecoveryLink && !recoveryToken) {
          // The link carried credentials but no session came of them, so the
          // password was not changed. Say so instead of showing a bare form.
          setRecovering(false);
          clearAuthCallbackFromUrl(true);
          setNotice({
            text: 'That password-reset link could not be opened, so your password was not changed. Request a new link and open it in this browser.',
            isError: true,
          });
        }
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

    const { data: { subscription } } = backend.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      setSession(next);
      // A refreshed token or an updated user is still the same person. Reloading
      // the profile for those events raises the full-screen loader over a page
      // that is already working.
      if (next && loadedUserId.current === next.user.id) return;
      // Leave the auth callback before making another Supabase request.
      window.setTimeout(() => { if (active) void loadProfile(next); }, 0);
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

  /**
   * Return to the sign-in screen once recovery ends. Changing the password ends
   * the recovery session anyway, and signing in with the new password is the
   * step that proves the change actually took - so it is worth doing now, while
   * the sign-in throttle has just been cleared, rather than days later.
   */
  const finishRecovery = useCallback(async (text: string, isError: boolean) => {
    window.history.replaceState(null, '', '/');
    setRecovering(false);
    setNotice({ text, isError });
    try {
      await backend.auth.signOut({ scope: 'local' });
    } catch {
      // The recovery session may already have been revoked by the password
      // change. Clearing local state below returns the person to sign-in
      // either way.
    }
    loadedUserId.current = null;
    setSession(null);
    setProfile(null);
  }, []);

  if (loading) return <SitePage><Loading /></SitePage>;
  if (recovering && recoveryToken) return <SitePage><ResetPasswordPage onComplete={finishRecovery} /></SitePage>;
  if (!session) return <SitePage><AuthPage notice={notice} /></SitePage>;
  if (recovering) return <SitePage><ResetPasswordPage onComplete={finishRecovery} /></SitePage>;
  if (profileError) return <SitePage><section className="panel" role="alert"><p>{profileError}</p><button className="primary" onClick={() => void loadProfile(session)}>Retry</button><button className="secondary" onClick={() => void backend.auth.signOut()}>Sign out</button></section></SitePage>;
  if (!profile) {
    return (
      <SitePage>
        <OnboardingPage
          defaultName={String(session.user.user_metadata.display_name || '')}
          onDone={() => loadProfile(session)}
        />
      </SitePage>
    );
  }
  if (!profile.active || profile.role_status !== 'approved') {
    return <SitePage><PendingPage status={profile.role_status} active={profile.active} /></SitePage>;
  }

  const safePage = canAccessPage(profile.role, page) ? page : 'dashboard';
  const selectPage = (nextPage: AppPage) => {
    if (canAccessPage(profile.role, nextPage)) setPage(nextPage);
  };

  return (
    <SitePage>
      <AppShell profile={profile} page={safePage} setPage={selectPage} signOut={() => void backend.auth.signOut()}>
        <Suspense fallback={<Loading />}>
        {safePage === 'dashboard' && (
          <DashboardPage
            role={profile.role}
            displayName={profile.display_name}
            onNavigate={selectPage}
          />
        )}
        {safePage === 'attendance' && <AttendancePage userId={session.user.id} />}
        {safePage === 'visitors' && <PeoplePage type="visitor" userId={session.user.id} role={profile.role} />}
        {safePage === 'members' && <PeoplePage type="member" userId={session.user.id} role={profile.role} />}
        {safePage === 'birthdays' && <BirthdaysPage />}
        {safePage === 'import' && <ImportPage userId={session.user.id} />}
        {safePage === 'admin' && <AdminPage userId={session.user.id} />}
        </Suspense>
      </AppShell>
    </SitePage>
  );
}
