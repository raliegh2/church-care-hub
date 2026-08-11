import { useEffect, useMemo, useState } from 'react';
import { Cake, CalendarClock, History } from 'lucide-react';
import { formatBirthday, getBirthdayPipeline, memberName, type MemberBirthday } from '../lib/birthdays';
import { supabase } from '../lib/supabase';
import type { Member } from '../types';

function timingLabel(daysAway: number) {
  if (daysAway === 0) return 'Today';
  const days = Math.abs(daysAway);
  return daysAway > 0 ? `In ${days} day${days === 1 ? '' : 's'}` : `${days} day${days === 1 ? '' : 's'} ago`;
}

function BirthdayList({ birthdays, empty }: { birthdays: MemberBirthday[]; empty: string }) {
  if (!birthdays.length) return <div className="birthday-empty">{empty}</div>;
  return <div className="birthday-list">{birthdays.map(item => (
    <article key={item.member.id}>
      <span className="birthday-avatar">{item.member.first_name[0]}{item.member.last_name[0]}</span>
      <div><strong>{memberName(item.member)}</strong><small>{formatBirthday(item.occurrence)}</small></div>
      <em className={item.daysAway === 0 ? 'today' : ''}>{timingLabel(item.daysAway)}</em>
    </article>
  ))}</div>;
}

export function BirthdaysPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void supabase.from('members')
      .select('id,organization_id,first_name,last_name,birth_date,active,created_by,created_at')
      .eq('active', true)
      .not('birth_date', 'is', null)
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) setError(loadError.message);
        else setMembers((data || []) as Member[]);
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const pipeline = useMemo(() => getBirthdayPipeline(members), [members]);

  if (loading) return <section className="panel birthday-loading">Loading member birthdays…</section>;
  if (error) return <div className="notice error">{error}</div>;

  return <section className="birthdays-page">
    <article className="birthday-spotlight">
      <span className="birthday-spotlight-icon"><Cake /></span>
      <div><small>Next member birthday</small>{pipeline.next ? <><h2>{memberName(pipeline.next.member)}</h2><p>{formatBirthday(pipeline.next.occurrence)} · {timingLabel(pipeline.next.daysAway).toLowerCase()}</p></> : <><h2>No birthdays recorded</h2><p>Add dates of birth from Member care.</p></>}</div>
      {pipeline.next && <strong>{pipeline.next.daysAway === 0 ? 'Today' : pipeline.next.daysAway}</strong>}
    </article>
    <div className="birthday-grid">
      <article className="panel birthday-panel">
        <div className="panel-title-row"><div><h2>Upcoming birthdays</h2><p>Birthdays still ahead this calendar year.</p></div><CalendarClock size={20}/></div>
        <BirthdayList birthdays={pipeline.upcoming} empty="No more birthdays are scheduled this year." />
      </article>
      <article className="panel birthday-panel">
        <div className="panel-title-row"><div><h2>Birthdays passed</h2><p>Birthdays earlier this calendar year.</p></div><History size={20}/></div>
        <BirthdayList birthdays={pipeline.passed} empty="No member birthdays have passed this year." />
      </article>
    </div>
  </section>;
}
