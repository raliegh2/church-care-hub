import { useEffect, useState } from 'react';
import { CalendarPlus, ContactRound, HandHeart, Home, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { AppRole } from '../types';

interface DashboardStats {
  visitors: number;
  members: number;
  care: number;
  visits: number;
  newVisitors: number;
}

const emptyStats: DashboardStats = { visitors: 0, members: 0, care: 0, visits: 0, newVisitors: 0 };

export function DashboardPage({ role }: { role: AppRole }) {
  const [stats, setStats] = useState<DashboardStats>(emptyStats);

  useEffect(() => {
    let active = true;

    void (async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const visitorQueries = [
        supabase.from('visitors').select('id', { count: 'exact', head: true }).eq('active', true),
        supabase.from('care_notes').select('id', { count: 'exact', head: true }).not('visitor_id', 'is', null).neq('status', 'resolved'),
        supabase.from('visit_records').select('id', { count: 'exact', head: true }).not('visitor_id', 'is', null),
        supabase.from('visitors').select('id', { count: 'exact', head: true }).eq('active', true).gte('created_at', monthStart.toISOString()),
      ] as const;

      if (role === 'usher') {
        const [visitors, care, visits, newVisitors] = await Promise.all(visitorQueries);
        if (!active) return;
        setStats({
          visitors: visitors.count || 0,
          members: 0,
          care: care.count || 0,
          visits: visits.count || 0,
          newVisitors: newVisitors.count || 0,
        });
        return;
      }

      const [visitors, members, care, visits, newVisitors] = await Promise.all([
        visitorQueries[0],
        supabase.from('members').select('id', { count: 'exact', head: true }).eq('active', true),
        supabase.from('care_notes').select('id', { count: 'exact', head: true }).neq('status', 'resolved'),
        supabase.from('visit_records').select('id', { count: 'exact', head: true }),
        visitorQueries[3],
      ]);
      if (!active) return;
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

  const cards = role === 'usher'
    ? [
        [ContactRound, 'Active visitors', stats.visitors],
        [CalendarPlus, 'New visitors this month', stats.newVisitors],
        [HandHeart, 'Open visitor needs', stats.care],
        [Home, 'Visitor visits recorded', stats.visits],
      ] as const
    : [
        [ContactRound, 'Visitors', stats.visitors],
        [Users, 'Members', stats.members],
        [HandHeart, 'Open care needs', stats.care],
        [Home, 'Completed visits', stats.visits],
      ] as const;

  return (
    <>
      <section className="hero">
        <small>{role === 'usher' ? 'VISITOR OVERVIEW' : 'MINISTRY OVERVIEW'}</small>
        <h2>{role === 'usher' ? 'Welcome and follow up with every visitor.' : 'One place to welcome, care and follow up.'}</h2>
        <p>{role === 'usher' ? 'Your workspace contains visitor records, visitor care notes, visits and visitor totals only.' : 'See the responsibilities assigned to your role and keep every next step visible.'}</p>
      </section>
      <section className="metric-grid">
        {cards.map(([Icon, label, value]) => <article key={label}><Icon /><span>{label}</span><strong>{value}</strong></article>)}
      </section>
      <section className="panel">
        <h3>{role === 'usher' ? 'Visitor follow-up' : 'Care workflow'}</h3>
        <p>Register the person, record the support needed, and document each completed visit or follow-up.</p>
      </section>
    </>
  );
}
