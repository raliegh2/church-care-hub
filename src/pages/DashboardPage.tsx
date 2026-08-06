import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ArrowUpRight, CalendarCheck2, ContactRound, HandHeart, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCountUp } from '../lib/useCountUp';
import type { AppPage } from '../lib/permissions';
import type { AppRole, CareNote } from '../types';

interface DashboardStats {
  visitors: number;
  members: number;
  care: number;
  visits: number;
  newVisitors: number;
}

interface PriorityItem {
  id: string;
  name: string;
  personType: 'Visitor' | 'Member';
  need: string;
  priority: 'High' | 'Medium' | 'Low';
}

interface RecentVisitor {
  id: string;
  full_name: string;
  first_visit_date: string;
  created_at: string;
}

const emptyStats: DashboardStats = { visitors: 0, members: 0, care: 0, visits: 0, newVisitors: 0 };
const EMPTY_UUID = '00000000-0000-0000-0000-000000000000';

function monthStartIso(): string {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  return monthStart.toISOString();
}

function buildWeeklyCounts(rows: Array<{ created_at: string }>): number[] {
  const now = new Date();
  const counts = Array.from({ length: 8 }, () => 0);
  for (const row of rows) {
    const created = new Date(row.created_at);
    const daysAgo = Math.floor((now.getTime() - created.getTime()) / 86_400_000);
    const index = 7 - Math.floor(daysAgo / 7);
    if (index >= 0 && index < counts.length) counts[index] += 1;
  }
  return counts;
}

function priorityFor(noteType: string): PriorityItem['priority'] {
  if (noteType === 'prayer' || noteType === 'support') return 'High';
  if (noteType === 'practical_need') return 'Medium';
  return 'Low';
}

export function DashboardPage({ role, onNavigate }: { role: AppRole; onNavigate: (page: AppPage) => void }) {
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [recentVisitors, setRecentVisitors] = useState<RecentVisitor[]>([]);
  const [weeklyCounts, setWeeklyCounts] = useState<number[]>(Array.from({ length: 8 }, () => 0));
  const [priorityItems, setPriorityItems] = useState<PriorityItem[]>([]);

  useEffect(() => {
    let active = true;

    void (async () => {
      const monthStart = monthStartIso();
      const eightWeeksAgo = new Date(Date.now() - 56 * 86_400_000).toISOString();

      const [visitors, visitorCare, visitorVisits, newVisitors, recent, trend] = await Promise.all([
        supabase.from('visitors').select('id', { count: 'exact', head: true }).eq('active', true),
        supabase.from('care_notes').select('id', { count: 'exact', head: true }).not('visitor_id', 'is', null).neq('status', 'resolved'),
        supabase.from('visit_records').select('id', { count: 'exact', head: true }).not('visitor_id', 'is', null),
        supabase.from('visitors').select('id', { count: 'exact', head: true }).eq('active', true).gte('created_at', monthStart),
        supabase.from('visitors').select('id, full_name, first_visit_date, created_at').eq('active', true).order('created_at', { ascending: false }).limit(5),
        supabase.from('visitors').select('created_at').gte('created_at', eightWeeksAgo),
      ]);

      if (!active) return;
      setRecentVisitors((recent.data || []) as RecentVisitor[]);
      setWeeklyCounts(buildWeeklyCounts((trend.data || []) as Array<{ created_at: string }>));

      if (role === 'usher') {
        setStats({
          visitors: visitors.count || 0,
          members: 0,
          care: visitorCare.count || 0,
          visits: visitorVisits.count || 0,
          newVisitors: newVisitors.count || 0,
        });
        setPriorityItems([]);
        return;
      }

      const [members, care, visits, notesResult] = await Promise.all([
        supabase.from('members').select('id', { count: 'exact', head: true }).eq('active', true),
        supabase.from('care_notes').select('id', { count: 'exact', head: true }).neq('status', 'resolved'),
        supabase.from('visit_records').select('id', { count: 'exact', head: true }),
        supabase
          .from('care_notes')
          .select('id, note_text, note_type, visitor_id, member_id, created_at')
          .neq('status', 'resolved')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const notes = (notesResult.data || []) as CareNote[];
      const memberIds = [...new Set(notes.map(note => note.member_id).filter(Boolean))] as string[];
      const visitorIds = [...new Set(notes.map(note => note.visitor_id).filter(Boolean))] as string[];
      const [memberRows, visitorRows] = await Promise.all([
        supabase.from('members').select('id, first_name, last_name').in('id', memberIds.length ? memberIds : [EMPTY_UUID]),
        supabase.from('visitors').select('id, full_name').in('id', visitorIds.length ? visitorIds : [EMPTY_UUID]),
      ]);

      if (!active) return;

      const memberNames = new Map((memberRows.data || []).map(member => [member.id, `${member.first_name} ${member.last_name}`]));
      const visitorNames = new Map((visitorRows.data || []).map(visitor => [visitor.id, visitor.full_name]));
      setPriorityItems(notes.map(note => {
        const isMember = Boolean(note.member_id);
        return {
          id: note.id,
          name: isMember
            ? memberNames.get(note.member_id || '') || 'Member care record'
            : visitorNames.get(note.visitor_id || '') || 'Visitor care record',
          personType: isMember ? 'Member' : 'Visitor',
          need: note.note_text,
          priority: priorityFor(note.note_type),
        };
      }));

      setStats({
        visitors: visitors.count || 0,
        members: members.count || 0,
        care: care.count || 0,
        visits: visits.count || 0,
        newVisitors: newVisitors.count || 0,
      });
    })();

    return () => { active = false; };
  }, [role]);

  const maxWeekly = Math.max(1, ...weeklyCounts);
  const memberShare = useMemo(() => {
    const total = stats.members + stats.newVisitors;
    return total ? Math.round((stats.members / total) * 100) : 0;
  }, [stats.members, stats.newVisitors]);

  if (role === 'usher') {
    return (
      <section className="redesign-dashboard">
        <div className="dashboard-metric-grid three-up">
          <Metric label="Visitors this month" value={stats.newVisitors} detail={`${stats.visitors} active visitor records`} tone="gold" onClick={() => onNavigate('visitors')} />
          <Metric label="First-time visitors" value={stats.newVisitors} detail="New records added this month" tone="green" onClick={() => onNavigate('visitors')} />
          <Metric label="Follow-up needed" value={stats.care} detail={`${stats.visits} visitor visits recorded`} tone="coral" onClick={() => onNavigate('visitors')} />
        </div>

        <div className="dashboard-content-grid usher-grid">
          <article className="panel trend-panel">
            <div className="panel-title-row"><div><h2>Visitor trend</h2><p>New visitor records during the last eight weeks.</p></div><span>Last 8 weeks</span></div>
            <div className="trend-bars" aria-label="Visitor trend chart">
              {weeklyCounts.map((value, index) => (
                <div key={index} className="trend-column">
                  <span style={{ height: `${Math.max(12, (value / maxWeekly) * 100)}%` }} />
                  <small>{index + 1}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="panel recent-visitor-panel">
            <div className="panel-title-row"><div><h2>Recent visitors</h2><p>Newest visitor profiles and their follow-up status.</p></div><ContactRound size={20} /></div>
            <div className="visitor-summary-table">
              <div className="visitor-summary-head"><span>Visitor</span><span>Visit date</span><span>Status</span></div>
              {recentVisitors.map(visitor => (
                <button className="visitor-summary-row" key={visitor.id} onClick={() => onNavigate('visitors')}>
                  <strong>{visitor.full_name}</strong>
                  <span>{new Date(`${visitor.first_visit_date}T00:00:00`).toLocaleDateString()}</span>
                  <em>First visit</em>
                </button>
              ))}
              {recentVisitors.length === 0 && <div className="empty compact-empty">No visitor records yet.</div>}
            </div>
          </article>
        </div>
      </section>
    );
  }

  const nextFocus = priorityItems[0];

  return (
    <section className="redesign-dashboard">
      <div className="dashboard-metric-grid four-up">
        <Metric label="Active members" value={stats.members} detail="Shared pastoral database" tone="green" onClick={() => onNavigate('members')} />
        <Metric label="Visitors this month" value={stats.newVisitors} detail={`${stats.visitors} active visitor records`} tone="gold" onClick={() => onNavigate('visitors')} />
        <Metric label="Open care needs" value={stats.care} detail="Across members and visitors" tone="coral" onClick={() => onNavigate('members')} />
        <Metric label="Visits completed" value={stats.visits} detail="Shared care history" tone="blue" onClick={() => onNavigate('members')} />
      </div>

      <div className="dashboard-content-grid pastor-grid">
        <article className="panel priority-panel">
          <div className="panel-title-row"><div><h2>Care priority queue</h2><p>People with unresolved support needs.</p></div><HandHeart size={20} /></div>
          <div className="priority-list">
            {priorityItems.map(item => (
              <button className="priority-row" key={item.id} onClick={() => onNavigate(item.personType === 'Member' ? 'members' : 'visitors')}>
                <span className={`person-avatar ${item.personType.toLowerCase()}`}>{item.name.slice(0, 1)}</span>
                <span className="priority-person"><strong>{item.name}</strong><small>{item.personType}</small></span>
                <span className="priority-need">{item.need}</span>
                <em className={`priority-pill ${item.priority.toLowerCase()}`}>{item.priority}</em>
              </button>
            ))}
            {priorityItems.length === 0 && <div className="empty compact-empty">No open care needs.</div>}
          </div>
        </article>

        <aside className="dashboard-side-stack">
          <article className="panel community-mix-card">
            <div className="panel-title-row"><div><h2>Community mix</h2><p>Current people records.</p></div><Users size={20} /></div>
            <div className="community-mix-body">
              <div className="community-ring" style={{ '--member-share': `${memberShare}%` } as CSSProperties}>
                <span>{stats.members + stats.newVisitors}</span>
              </div>
              <div className="community-legend">
                <button onClick={() => onNavigate('members')}><i className="member" /> Members <strong>{stats.members}</strong></button>
                <button onClick={() => onNavigate('visitors')}><i className="visitor" /> Visitors this month <strong>{stats.newVisitors}</strong></button>
              </div>
            </div>
          </article>

          <button
            className="next-follow-up-card"
            disabled={!nextFocus}
            onClick={() => nextFocus && onNavigate(nextFocus.personType === 'Member' ? 'members' : 'visitors')}
          >
            <small>Next care focus</small>
            <strong>{nextFocus?.name || 'No urgent follow-up'}</strong>
            <span>{nextFocus?.need || 'All open needs have been resolved.'}</span>
            <ArrowUpRight size={18} />
          </button>
        </aside>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  detail,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  detail: string;
  tone: 'green' | 'gold' | 'coral' | 'blue';
  onClick?: () => void;
}) {
  const displayValue = useCountUp(value);
  return (
    <button className={`dashboard-metric ${tone}`} onClick={onClick}>
      <div><span>{label}</span><i /></div>
      <strong>{displayValue.toLocaleString()}</strong>
      <small><CalendarCheck2 size={13} /> {detail}</small>
    </button>
  );
}
