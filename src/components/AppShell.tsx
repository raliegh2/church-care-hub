import { useState, type ReactNode } from 'react';
import {
  BarChart3,
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
  canViewMembers,
  roleResponsibility,
  type AppPage,
} from '../lib/permissions';
import { Brand } from './Brand';

export interface NavItem { key: AppPage; label: string; icon: ReactNode; }

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
    { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={19} /> },
    { key: 'attendance', label: 'Attendance', icon: <ClipboardCheck size={19} /> },
    { key: 'visitors', label: 'Visitor Care', icon: <ContactRound size={19} /> },
  ];
  if (canViewMembers(role)) items.push({ key: 'members', label: 'Member Care', icon: <Users size={19} /> });
  if (canImportMembers(role)) items.push({ key: 'import', label: 'Import Members', icon: <FileUp size={19} /> });
  if (canAdminister(role)) items.push({ key: 'admin', label: 'Admin Center', icon: <ShieldCheck size={19} /> });

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-top"><Brand /><button className="icon-btn sidebar-close" aria-label="Close menu" onClick={() => setOpen(false)}><X /></button></div>
        <div className="role-workspace-label"><small>Signed in as</small><strong>{role}</strong><span>{roleResponsibility(role)}</span></div>
        <nav>
          {items.map(item => (
            <button key={item.key} className={page === item.key ? 'active' : ''} onClick={() => { setPage(item.key); setOpen(false); }}>
              {item.icon}<span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip"><strong>{profile.display_name}</strong><small>{roleResponsibility(role)}</small></div>
          <button onClick={signOut}><LogOut size={18} /> Sign out</button>
        </div>
      </aside>
      <section className="workspace">
        <header>
          <button className="icon-btn mobile-menu" aria-label="Open menu" onClick={() => setOpen(true)}><Menu /></button>
          <div><h1>{items.find(item => item.key === page)?.label || 'Workspace'}</h1><p>Community Church · {roleResponsibility(role)}</p></div>
          <BarChart3 className="header-icon" />
        </header>
        <main className="content">{children}</main>
      </section>
    </div>
  );
}
