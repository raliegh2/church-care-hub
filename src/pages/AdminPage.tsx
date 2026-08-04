import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  ClipboardCheck,
  ContactRound,
  Database,
  HeartHandshake,
  RefreshCw,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { AppRole, UserProfile } from '../types';

interface AdminMetrics {
  users: number;
  visitors: number;
  members: number;
  visits: number;
  openNeeds: number;
  attendanceSessions: number;
}

const emptyMetrics: AdminMetrics = { users: 0, visitors: 0, members: 0, visits: 0, openNeeds: 0, attendanceSessions: 0 };

export function AdminPage({ userId }: { userId: string }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [metrics, setMetrics] = useState<AdminMetrics>(emptyMetrics);
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const load = useCallback(async () => {
    setMessage('');
    const [usersResult, visitors, members, visits, needs, attendance] = await Promise.all([
      supabase.from('user_profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('visitors').select('id', { count: 'exact', head: true }),
      supabase.from('members').select('id', { count: 'exact', head: true }),
      supabase.from('visit_records').select('id', { count: 'exact', head: true }),
      supabase.from('care_notes').select('id', { count: 'exact', head: true }).neq('status', 'resolved'),
      supabase.from('attendance_sessions').select('id', { count: 'exact', head: true }),
    ]);
    const error = usersResult.error || visitors.error || members.error || visits.error || needs.error || attendance.error;
    if (error) {
      setIsError(true);
      setMessage(error.message);
      return;
    }
    const profiles = (usersResult.data || []) as UserProfile[];
    setUsers(profiles);
    setMetrics({
      users: profiles.length,
      visitors: visitors.count || 0,
      members: members.count || 0,
      visits: visits.count || 0,
      openNeeds: needs.count || 0,
      attendanceSessions: attendance.count || 0,
    });
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function decide(id: string, approve: boolean) {
    setBusyUser(id);
    const { error } = await supabase.rpc('approve_role_request', { p_user_id: id, p_approve: approve });
    setBusyUser(null);
    setIsError(Boolean(error));
    setMessage(error ? error.message : approve ? 'Pastor access approved.' : 'Pastor request rejected.');
    if (!error) await load();
  }

  async function manageUser(user: UserProfile, role: AppRole, active: boolean) {
    setBusyUser(user.id);
    const { error } = await supabase.rpc('admin_manage_user', {
      p_user_id: user.id,
      p_role: role,
      p_active: active,
    });
    setBusyUser(null);
    setIsError(Boolean(error));
    setMessage(error ? error.message : `${user.display_name}'s access was updated.`);
    if (!error) await load();
  }

  const pending = users.filter(user => user.role_status === 'pending' && user.requested_role === 'pastor');

  return (
    <section className="admin-workspace">
      {message && <div className={`notice${isError ? ' error' : ''}`}>{message}</div>}
      <div className="admin-heading">
        <div><div className="eyebrow">Administrator only</div><h2>System oversight and maintenance</h2><p>Monitor every ministry workspace, approve pastor access and maintain user responsibility assignments.</p></div>
        <button className="secondary" onClick={() => void load()}><RefreshCw size={17} /> Refresh</button>
      </div>

      <div className="admin-metric-grid">
        <Metric icon={<UserCog />} label="Registered users" value={metrics.users} />
        <Metric icon={<ContactRound />} label="Active visitors" value={metrics.visitors} />
        <Metric icon={<Users />} label="Active members" value={metrics.members} />
        <Metric icon={<HeartHandshake />} label="Recorded visits" value={metrics.visits} />
        <Metric icon={<Database />} label="Open support needs" value={metrics.openNeeds} />
        <Metric icon={<ClipboardCheck />} label="Attendance sessions" value={metrics.attendanceSessions} />
      </div>

      <section className="two-col admin-columns">
        <article className="panel">
          <div className="section-heading"><div><h2>Pastor access requests</h2><p>Pastor accounts remain locked until an administrator approves them.</p></div><ShieldCheck /></div>
          <div className="rows">
            {pending.map(user => (
              <div className="admin-row" key={user.id}>
                <span><strong>{user.display_name}</strong><small>Requested pastor access</small></span>
                <span>
                  <button className="approve" disabled={busyUser === user.id} aria-label={`Approve ${user.display_name}`} onClick={() => void decide(user.id, true)}><Check /></button>
                  <button className="reject" disabled={busyUser === user.id} aria-label={`Reject ${user.display_name}`} onClick={() => void decide(user.id, false)}><X /></button>
                </span>
              </div>
            ))}
            {pending.length === 0 && <div className="empty compact-empty">No pastor requests are waiting.</div>}
          </div>
        </article>

        <article className="panel admin-scope-panel">
          <h2>Administrator scope</h2>
          <p>Your account can open and maintain every section from the sidebar.</p>
          <div className="scope-list">
            <span><CheckCircle /> Visitor and attendance operations</span>
            <span><CheckCircle /> Member database and spreadsheet imports</span>
            <span><CheckCircle /> Visit history and support notes</span>
            <span><CheckCircle /> User roles, approvals and account status</span>
          </div>
        </article>
      </section>

      <article className="panel">
        <div className="section-heading"><div><h2>User responsibility assignments</h2><p>Assign each approved user to the correct workspace, or suspend access immediately.</p></div><UserCog /></div>
        <div className="table-wrap">
          <table className="admin-access-table">
            <thead><tr><th>User</th><th>Current responsibility</th><th>Account status</th><th>Access summary</th></tr></thead>
            <tbody>
              {users.map(user => {
                const isSelf = user.id === userId;
                return (
                  <tr key={user.id}>
                    <td><strong>{user.display_name}</strong><small>{user.role_status}{isSelf ? ' · your account' : ''}</small></td>
                    <td>
                      <select
                        value={user.role}
                        disabled={isSelf || busyUser === user.id || user.role_status === 'pending'}
                        onChange={event => void manageUser(user, event.target.value as AppRole, user.active)}
                      >
                        <option value="usher">Usher</option>
                        <option value="pastor">Pastor</option>
                        <option value="administrator">Administrator</option>
                      </select>
                    </td>
                    <td>
                      <button
                        className={user.active ? 'status-toggle active' : 'status-toggle'}
                        disabled={isSelf || busyUser === user.id}
                        onClick={() => void manageUser(user, user.role, !user.active)}
                      >
                        {user.active ? 'Active' : 'Suspended'}
                      </button>
                    </td>
                    <td>{roleSummary(user.role)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <article className="admin-metric"><span>{icon}</span><strong>{value.toLocaleString()}</strong><small>{label}</small></article>;
}

function CheckCircle() {
  return <span className="scope-check"><Check size={14} /></span>;
}

function roleSummary(role: AppRole): string {
  if (role === 'usher') return 'Visitors, visitor totals, visitor visits and visitor support notes';
  if (role === 'pastor') return 'Visitors, attendance, members, imports and pastoral care';
  return 'Full access to every workspace and administrator controls';
}
