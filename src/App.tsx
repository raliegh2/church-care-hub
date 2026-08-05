import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AppShell } from './components/AppShell';
import { Loading } from './components/Loading';
import { canAccessPage, type AppPage } from './lib/permissions';
import {
  applyDocumentMetadata,
  isKnownAppPath,
  metadataForPage,
  normalizePath,
  PAGE_PATHS,
  pageFromPath,
  PUBLIC_METADATA,
} from './lib/seo';
import { supabase } from './lib/supabase';
import { AuthPage } from './pages/AuthPage';
import type { UserProfile } from './types';
import './care-workspace.css';

const AdminPage = lazy(() => import('./pages/AdminPage').then(module => ({ default: module.AdminPage })));
const AttendancePage = lazy(() => import('./pages/AttendancePage').then(module => ({ default: module.AttendancePage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(module => ({ default: module.DashboardPage })));
const ImportPage = lazy(() => import('./pages/ImportPage').then(module => ({ default: module.ImportPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then(module => ({ default: module.NotFoundPage })));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then(module => ({ default: module.OnboardingPage })));
const PendingPage = lazy(() => import('./pages/PendingPage').then(module => ({ default: module.PendingPage })));
const PeoplePage = lazy(() => import('./pages/PeoplePage').then(module => ({ default: module.PeoplePage })));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then(module => ({ default: module.ResetPasswordPage })));

function timeoutAfter(milliseconds: number) {
  return new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('Request timed out')), milliseconds);
  });
}

export default function App() {
  const initialPath = normalizePath(window.location.pathname);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  const [routePath, setRoutePath] = useState(initialPath);
  const [page, setPage] = useState<AppPage>(() => pageFromPath(initialPath) || 'dashboard');

  const notFound = !isKnownAppPath(routePath);
  const safePage = profile && canAccessPage(profile.role, page) ? page : 'dashboard';

  const navigateToPath = useCallback((path: string, replace = false) => {
    const normalized = normalizePath(path);
    if (normalizePath(window.location.pathname) !== normalized) {
      const nextUrl = `${normalized}${window.location.search}${window.location.hash}`;
      if (replace) window.history.replaceState({}, '', nextUrl);
      else window.history.pushState({}, '', nextUrl);
    }
    setRoutePath(normalized);
  }, []);

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
    } catch {
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
      .catch(() => {
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
      if (event === 'SIGNED_OUT') setRecovering(false);
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
    const handlePopState = () => {
      const nextPath = normalizePath(window.location.pathname);
      const nextPage = pageFromPath(nextPath);
      setRoutePath(nextPath);
      if (nextPage) setPage(nextPage);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (profile && !canAccessPage(profile.role, page)) {
      setPage('dashboard');
      navigateToPath(PAGE_PATHS.dashboard, true);
    }
  }, [navigateToPath, page, profile]);

  useEffect(() => {
    if (notFound) {
      applyDocumentMetadata({ ...PUBLIC_METADATA.notFound, path: routePath });
      return;
    }
    if (loading || !session) {
      applyDocumentMetadata(PUBLIC_METADATA.login);
      return;
    }
    if (recovering) {
      applyDocumentMetadata(PUBLIC_METADATA.reset);
      return;
    }
    if (!profile) {
      applyDocumentMetadata(PUBLIC_METADATA.onboarding);
      return;
    }
    if (!profile.active || profile.role_status !== 'approved') {
      applyDocumentMetadata(PUBLIC_METADATA.pending);
      return;
    }
    applyDocumentMetadata(metadataForPage(safePage, profile.role));
  }, [loading, notFound, profile, recovering, routePath, safePage, session]);

  useEffect(() => {
    if (loading || notFound) return;

    let expectedPath = '/';
    if (session && recovering) expectedPath = '/reset-password';
    else if (session && !profile) expectedPath = '/onboarding';
    else if (profile && (!profile.active || profile.role_status !== 'approved')) expectedPath = '/pending';
    else if (profile?.active && profile.role_status === 'approved') expectedPath = PAGE_PATHS[safePage];

    if (routePath !== expectedPath) navigateToPath(expectedPath, true);
  }, [loading, navigateToPath, notFound, profile, recovering, routePath, safePage, session]);

  const selectPage = (nextPage: AppPage) => {
    if (!profile || !canAccessPage(profile.role, nextPage)) return;
    setPage(nextPage);
    navigateToPath(PAGE_PATHS[nextPage]);
  };

  const returnHome = () => {
    setPage('dashboard');
    navigateToPath('/', true);
  };

  if (notFound) {
    return (
      <Suspense fallback={<Loading />}>
        <NotFoundPage onHome={returnHome} />
      </Suspense>
    );
  }
  if (loading) return <Loading />;
  if (!session) return <AuthPage />;
  if (recovering) {
    return (
      <Suspense fallback={<Loading />}>
        <ResetPasswordPage onDone={() => setRecovering(false)} />
      </Suspense>
    );
  }
  if (!profile) {
    return (
      <Suspense fallback={<Loading />}>
        <OnboardingPage
          defaultName={String(session.user.user_metadata.display_name || '')}
          onDone={() => loadProfile(session)}
        />
      </Suspense>
    );
  }
  if (!profile.active || profile.role_status !== 'approved') {
    return (
      <Suspense fallback={<Loading />}>
        <PendingPage status={profile.role_status} active={profile.active} />
      </Suspense>
    );
  }

  return (
    <AppShell
      profile={profile}
      page={safePage}
      setPage={selectPage}
      signOut={() => {
        navigateToPath('/', true);
        void supabase.auth.signOut();
      }}
    >
      <Suspense fallback={<Loading />}>
        {safePage === 'dashboard' && <DashboardPage role={profile.role} />}
        {safePage === 'attendance' && <AttendancePage userId={session.user.id} />}
        {safePage === 'visitors' && <PeoplePage type="visitor" userId={session.user.id} role={profile.role} />}
        {safePage === 'members' && <PeoplePage type="member" userId={session.user.id} role={profile.role} />}
        {safePage === 'import' && <ImportPage userId={session.user.id} />}
        {safePage === 'admin' && <AdminPage userId={session.user.id} />}
      </Suspense>
    </AppShell>
  );
}
