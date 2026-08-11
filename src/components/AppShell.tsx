import { useState, type ReactNode } from 'react';
import {
  Cake,
  ClipboardCheck,
  ContactRound,
  FileUp,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import type { AppRole, UserProfile } from '../types';
import {
  canAdminister,
  canImportMembers,
  canManageAttendance,
  canViewMembers,
  roleResponsibility,
  type AppPage,
} from '../lib/permissions';
import { Brand } from './Brand';

export interface NavItem {
  key: AppPage;
  label: string;
  icon: ReactNode;
}

const roleLabel = (role: AppRole) => role === 'administrator' ? 'Administrator' : role === 'pastor' ? 'Pastor' : 'Usher';

function pageDescription(role: AppRole, page: AppPage): string {
  if (page === 'dashboard') {
    return role === 'usher'
      ? 'Track visitor activity and make sure every follow-up is handled.'
      : role === 'pastor'
        ? 'See the people who need attention across visitors and members.'
        : 'Monitor access, care activity and the health of the ministry workspace.';
  }
  if (page === 'visitors') return 'Manage visitor profiles, visits and support follow-up.';
  if (page === 'members') return 'Review member records, care history and pastoral support.';
  if (page === 'birthdays') return 'See the next member birthday and the full annual birthday pipeline.';
  if (page === 'attendance') return 'Record service attendance and visitor totals.';
  if (page === 'import') return 'Upload, validate and import member records safely.';
  return 'Approve roles, maintain access and monitor the full care system.';
}

export function AppShell({
  profile,
  page,
  setPage,
  signOut,
  children,
}: {
  profile: UserProfile;
  page: AppPage;
  setPage: (page: AppPage) => void;
  signOut: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const role: AppRole = profile.role;
  const items: NavItem[] = [
    {
      key: 'dashboard',
      label: role === 'usher' ? 'Visitor overview' : role === 'administrator' ? 'System overview' : 'Care overview',
      icon: <LayoutDashboard size={18} />,
    },
    { key: 'visitors', label: 'Visitor care', icon: <ContactRound size={18} /> },
  ];

  if (canManageAttendance(role)) {
    items.push({ key: 'attendance', label: 'Attendance', icon: <ClipboardCheck size={18} /> });
  }
  if (canViewMembers(role)) {
    items.push({ key: 'members', label: 'Member care', icon: <Users size={18} /> });
    items.push({ key: 'birthdays', label: 'Birthdays', icon: <Cake size={18} /> });
  }
  if (canImportMembers(role)) {
    items.push({ key: 'import', label: 'Import members', icon: <FileUp size={18} /> });
  }
  if (canAdminister(role)) {
    items.push({ key: 'admin', label: 'Administrator center', icon: <ShieldCheck size={18} /> });
  }

  const current = items.find(item => item.key === page);

  return (
    <div className="app-shell" data-role={role}>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-top">
          <Brand subtitle={`${roleLabel(role)} workspace`} />
          <button className="icon-btn sidebar-close" aria-label="Close menu" onClick={() => setOpen(false)}>
            <X />
          </button>
        </div>

        <nav aria-label={`${roleLabel(role)} workspace navigation`}>
          {items.map(item => (
            <button
              key={item.key}
              className={page === item.key ? 'active' : ''}
              onClick={() => {
                setPage(item.key);
                setOpen(false);
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-role-card">
            <small>{profile.role_status === 'approved' ? 'Approved role' : 'Role status'}</small>
            <strong>{roleLabel(role)}</strong>
            <span>{roleResponsibility(role)}</span>
          </div>
          <div className="user-chip">
            <strong>{profile.display_name}</strong>
            <small>Central Islip SDA</small>
          </div>
          <button onClick={signOut}><LogOut size={17} /> Sign out</button>
        </div>
      </aside>

      <section className="workspace">
        <header>
          <button className="icon-btn mobile-menu" aria-label="Open menu" onClick={() => setOpen(true)}>
            <Menu />
          </button>
          <div className="workspace-heading">
            <div className="eyebrow">{roleLabel(role)} workspace</div>
            <h1>{current?.label || 'Workspace'}</h1>
            <p>{pageDescription(role, page)}</p>
          </div>
          <span className="workspace-role-pill">{roleLabel(role)}</span>
        </header>
        <main className="content">{children}</main>
      </section>
    </div>
  );
}
