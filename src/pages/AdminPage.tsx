import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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
    setLastUpdated(new Date());
    setIsError(false);
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
  const activeUsers = users.filter(user => user.active && user.role_status === 'approved');
  const roleCounts = useMemo(() => ({
    usher: activeUsers.filter(user => user.role === 'usher').length,
    pastor: activeUsers.filter(user => user.role === 'pastor').length,
    administrator: activeUsers.filter(user => user.role === 'administrator').length,
  }), [activeUsers]);
  const maxRoleCount = Math.max(1, roleCounts.usher, roleCounts.pastor, roleCounts.administrator);

  return (
    <section className="admin-workspace redesign-admin">
      {message && <div className={`notice${isError ? ' error' : ''}`}>{message}</div>}

      <div className="admin-summary-row">
        <AdminMetric label="Pastor requests" value={pending.length} detail="Waiting for approval" tone="gold" />
        <AdminMetric label="Active users" value={activeUsers.length} detail={`${roleCounts.usher} ushers · ${roleCounts.pastor} pastors`} tone="green" />
        <AdminMetric label="Open care needs" value={metrics.openNeeds} detail="Across members and visitors" tone="coral" />
        <AdminMetric label="People records" value={metrics.visitors + metrics.members} detail={`${metrics.visitors} visitors · ${metrics.members} members`} tone="blue" />
      </div>

      <div className="admin-dashboard-grid">
        <article className="panel pending-role-panel">
          <div className="panel-title-row">
            <div><h2>Pending pastor requests</h2><p>Review each account before granting member-record access.</p></div>
            <span className="count-pill gold">{pending.length} pending</span>
          </div>
          <div className="admin-request-list">
            {pending.map(user => (
              <div className="admin-request-row" key={user.id}>
                <span className="person-avatar visitor">{user.display_name.slice(0, 1)}</span>
                <span className="request-person"><strong>{user.display_name}</strong><small>Requested pastor access</small></span>
                <span className="request-date">Awaiting review</span>
                <span className="request-actions">
                  <button className="secondary" disabled={busyUser === user.id} onClick={() => void decide(user.id, false)}><X size={15} /> Reject</button>
                  <button className="primary" disabled={busyUser === user.id} onClick={() => void decide(user.id, true)}><Check size={15} /> Approve</button>
                </span>
              </div>
            ))}
            {pending.length === 0 && <div className="empty compact-empty">No pastor requests are waiting.</div>}
          </div>
        </article>

        <aside className="admin-side-stack">
          <article className="panel access-role-card">
            <div className="panel-title-row"><div><h2>Access by role</h2><p>Approved active users.</p></div><UserCog size={19} /></div>
            {([
              ['Ushers', roleCounts.usher, 'usher'],
              ['Pastors', roleCounts.pastor, 'pastor'],
              ['Administrators', roleCounts.administrator, 'administrator'],
            ] as const).map(([label, value, key]) => (
              <div className="role-access-bar" key={key}>
                <span><strong>{label}</strong><small>{value} users</small></span>
                <i><b style={{ width: `${(value / maxRoleCount) * 100}%` }} /></i>
              </div>
            ))}
          </article>

          <article className="panel system-health-card">
            <div className="panel-title-row"><div><h2>System health</h2><p>Current connected data status.</p></div><span className="table-status ready">Healthy</span></div>
            <dl>
              <div><dt>Database access</dt><dd>{isError ? 'Needs attention' : 'Active'}</dd></div>
              <div><dt>Role protection</dt><dd>Enforced</dd></div>
              <div><dt>Recorded visits</dt><dd>{metrics.visits}</dd></div>
              <div><dt>Attendance sessions</dt><dd>{metrics.attendanceSessions}</dd></div>
              <div><dt>Last refresh</dt><dd>{lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Loading'}</dd></div>
            </dl>
          </article>
        </aside>
      </div>

      <article className="panel admin-user-access-panel">
        <div className="section-heading">
          <div><h2>User access and responsibility</h2><p>Assign approved users to the correct workspace or suspend access immediately.</p></div>
          <button className="secondary" onClick={() => void load()}><RefreshCw size={16} /> Refresh</button>
        </div>
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

      <div className="admin-data-footer">
        <span><ShieldCheck size={16} /> Administrator controls are restricted to approved administrator accounts.</span>
        <span><Database size={16} /> {metrics.members + metrics.visitors} people records monitored.</span>
        <span><HeartHandshake size={16} /> {metrics.openNeeds} unresolved care needs.</span>
        <span><ContactRound size={16} /> {metrics.visitors} visitor profiles.</span>
        <span><Users size={16} /> {metrics.members} member records.</span>
      </div>
    </section>
  );
}

function AdminMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  tone: 'green' | 'gold' | 'coral' | 'blue';
}) {
  return (
    <article className={`dashboard-metric ${tone}`}>
      <div><span>{label}</span><i /></div>
      <strong>{value.toLocaleString()}</strong>
      <small>{detail}</small>
    </article>
  );
}

function roleSummary(role: AppRole): string {
  if (role === 'usher') return 'Visitor profiles, visitor totals, visits and visitor support notes';
  if (role === 'pastor') return 'Visitors, attendance, members, imports and pastoral care';
  return 'Full access to every workspace and administrator controls';
}
