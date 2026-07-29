import { useState, type ReactNode } from 'react';
import { BarChart3, ClipboardCheck, ContactRound, FileUp, LayoutDashboard, LogOut, Menu, ShieldCheck, Users, X } from 'lucide-react';
import type { AppRole, UserProfile } from '../types';
import { canAdminister, canViewMembers } from '../lib/permissions';
import { Brand } from './Brand';

type Page = 'dashboard'|'attendance'|'visitors'|'members'|'import'|'admin';
export interface NavItem { key: Page; label: string; icon: ReactNode; }

export function AppShell({ profile, page, setPage, signOut, children }: { profile: UserProfile; page: Page; setPage: (p: Page)=>void; signOut: ()=>void; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const role: AppRole = profile.role;
  const items: NavItem[] = [
    { key:'dashboard', label:'Dashboard', icon:<LayoutDashboard size={19}/> },
    { key:'attendance', label:'Attendance', icon:<ClipboardCheck size={19}/> },
    { key:'visitors', label:'Visitors', icon:<ContactRound size={19}/> },
  ];
  if (canViewMembers(role)) items.push({ key:'members', label:'Members', icon:<Users size={19}/> }, { key:'import', label:'Import Members', icon:<FileUp size={19}/> });
  if (canAdminister(role)) items.push({ key:'admin', label:'Admin Center', icon:<ShieldCheck size={19}/> });
  return <div className="app-shell">
    <aside className={`sidebar ${open?'open':''}`}>
      <div className="sidebar-top"><Brand/><button className="icon-btn sidebar-close" onClick={()=>setOpen(false)}><X/></button></div>
      <nav>{items.map(item=><button key={item.key} className={page===item.key?'active':''} onClick={()=>{setPage(item.key);setOpen(false)}}>{item.icon}<span>{item.label}</span></button>)}</nav>
      <div className="sidebar-footer"><div className="user-chip"><strong>{profile.display_name}</strong><small>{profile.role}</small></div><button onClick={signOut}><LogOut size={18}/> Sign out</button></div>
    </aside>
    <section className="workspace">
      <header><button className="icon-btn mobile-menu" onClick={()=>setOpen(true)}><Menu/></button><div><h1>{items.find(i=>i.key===page)?.label}</h1><p>Community Church · {profile.role}</p></div><BarChart3 className="header-icon"/></header>
      <main className="content">{children}</main>
    </section>
  </div>;
}
