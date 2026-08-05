import type { AppPage } from './permissions';

export const APP_ORIGIN = 'https://church-care-hub.vercel.app';
export const DEFAULT_DESCRIPTION = 'A secure ministry workspace for Central Islip SDA ushers, pastors, and administrators to coordinate visitor care, attendance, member support, and follow-up.';
export const SOCIAL_IMAGE_URL = `${APP_ORIGIN}/og-image.png`;

export const PAGE_PATHS: Record<AppPage, string> = {
  dashboard: '/dashboard',
  attendance: '/attendance',
  visitors: '/visitors',
  members: '/members',
  import: '/import-members',
  admin: '/administrator',
};

const PATH_TO_PAGE = new Map<string, AppPage>(
  Object.entries(PAGE_PATHS).map(([page, path]) => [path, page as AppPage]),
);

export const KNOWN_APP_PATHS = new Set([
  '/',
  '/login',
  '/reset-password',
  '/onboarding',
  '/pending',
  ...Object.values(PAGE_PATHS),
]);

export interface DocumentMetadata {
  title: string;
  description: string;
  path: string;
  indexable?: boolean;
}

export function normalizePath(pathname: string): string {
  const withoutTrailingSlash = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return withoutTrailingSlash || '/';
}

export function pageFromPath(pathname: string): AppPage | null {
  const path = normalizePath(pathname);
  if (path === '/' || path === '/login') return 'dashboard';
  return PATH_TO_PAGE.get(path) || null;
}

export function isKnownAppPath(pathname: string): boolean {
  return KNOWN_APP_PATHS.has(normalizePath(pathname));
}

export function metadataForPage(page: AppPage, role?: string): DocumentMetadata {
  const roleName = role === 'administrator' ? 'Administrator' : role === 'pastor' ? 'Pastor' : role === 'usher' ? 'Usher' : '';
  const suffix = 'Central Islip SDA Church Care Hub';

  if (page === 'dashboard') {
    return {
      title: `${roleName ? `${roleName} Dashboard` : 'Dashboard'} | ${suffix}`,
      description: role === 'usher'
        ? 'Review visitor activity, follow-up needs, and recent visitor records in the Central Islip SDA care workspace.'
        : 'Review ministry care priorities, community activity, and follow-up needs in the Central Islip SDA care workspace.',
      path: PAGE_PATHS.dashboard,
      indexable: false,
    };
  }
  if (page === 'attendance') return { title: `Attendance | ${suffix}`, description: 'Record service attendance and visitor totals in the secure Central Islip SDA ministry workspace.', path: PAGE_PATHS.attendance, indexable: false };
  if (page === 'visitors') return { title: `Visitor Care | ${suffix}`, description: 'Manage visitor profiles, visits, support notes, and follow-up in the secure church care workspace.', path: PAGE_PATHS.visitors, indexable: false };
  if (page === 'members') return { title: `Member Care | ${suffix}`, description: 'Review member records, pastoral visits, care notes, and follow-up in the secure church care workspace.', path: PAGE_PATHS.members, indexable: false };
  if (page === 'import') return { title: `Import Members | ${suffix}`, description: 'Validate and import member records into the secure Central Islip SDA church care workspace.', path: PAGE_PATHS.import, indexable: false };
  return { title: `Administrator Center | ${suffix}`, description: 'Manage approved user access, ministry roles, and system health in the secure church care workspace.', path: PAGE_PATHS.admin, indexable: false };
}

export const PUBLIC_METADATA: Record<'login' | 'reset' | 'onboarding' | 'pending' | 'notFound', DocumentMetadata> = {
  login: {
    title: 'Sign In | Central Islip SDA Church Care Hub',
    description: DEFAULT_DESCRIPTION,
    path: '/',
    indexable: true,
  },
  reset: {
    title: 'Reset Password | Central Islip SDA Church Care Hub',
    description: 'Choose a new password for your secure Central Islip SDA Church Care Hub account.',
    path: '/reset-password',
    indexable: false,
  },
  onboarding: {
    title: 'Choose Your Ministry Role | Central Islip SDA Church Care Hub',
    description: 'Choose the approved ministry role used to access the secure Central Islip SDA Church Care Hub.',
    path: '/onboarding',
    indexable: false,
  },
  pending: {
    title: 'Account Access Status | Central Islip SDA Church Care Hub',
    description: 'Review the approval status of your Central Islip SDA Church Care Hub account.',
    path: '/pending',
    indexable: false,
  },
  notFound: {
    title: 'Page Not Found | Central Islip SDA Church Care Hub',
    description: 'The requested Church Care Hub page could not be found.',
    path: '/404',
    indexable: false,
  },
};

function upsertMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

function upsertCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.rel = 'canonical';
    document.head.appendChild(element);
  }
  element.href = href;
}

export function applyDocumentMetadata(metadata: DocumentMetadata) {
  const canonicalUrl = `${APP_ORIGIN}${metadata.path}`;
  const robots = metadata.indexable === false
    ? 'noindex, nofollow, noarchive'
    : 'index, follow, max-image-preview:large';

  document.documentElement.lang = 'en-US';
  document.title = metadata.title;
  upsertCanonical(canonicalUrl);
  upsertMeta('name', 'description', metadata.description);
  upsertMeta('name', 'robots', robots);
  upsertMeta('property', 'og:type', 'website');
  upsertMeta('property', 'og:locale', 'en_US');
  upsertMeta('property', 'og:site_name', 'Central Islip SDA Church Care Hub');
  upsertMeta('property', 'og:title', metadata.title);
  upsertMeta('property', 'og:description', metadata.description);
  upsertMeta('property', 'og:url', canonicalUrl);
  upsertMeta('property', 'og:image', SOCIAL_IMAGE_URL);
  upsertMeta('property', 'og:image:alt', 'Central Islip SDA Church Care Hub');
  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', metadata.title);
  upsertMeta('name', 'twitter:description', metadata.description);
  upsertMeta('name', 'twitter:image', SOCIAL_IMAGE_URL);
  upsertMeta('name', 'twitter:image:alt', 'Central Islip SDA Church Care Hub');
}
