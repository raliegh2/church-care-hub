import type { Member } from '../types';

export interface MemberBirthday {
  member: Member;
  occurrence: Date;
  daysAway: number;
}

const DAY_MS = 86_400_000;

function localToday(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function birthdayInYear(birthDate: string, year: number) {
  const [, month, day] = birthDate.split('-').map(Number);
  const occurrence = new Date(year, month - 1, day);
  if (month === 2 && day === 29 && occurrence.getMonth() !== 1) return new Date(year, 1, 28);
  return occurrence;
}

export function getBirthdayPipeline(members: Member[], now = new Date()) {
  const today = localToday(now);
  const datedMembers = members.filter(
    (member): member is Member & { birth_date: string } => Boolean(member.active && member.birth_date),
  );
  const thisYear: MemberBirthday[] = datedMembers.map(member => {
    const occurrence = birthdayInYear(member.birth_date, today.getFullYear());
    return { member, occurrence, daysAway: Math.round((occurrence.getTime() - today.getTime()) / DAY_MS) };
  });
  const upcoming = thisYear
    .filter(item => item.daysAway >= 0)
    .sort((a, b) => a.daysAway - b.daysAway || a.member.last_name.localeCompare(b.member.last_name));
  const passed = thisYear
    .filter(item => item.daysAway < 0)
    .sort((a, b) => b.daysAway - a.daysAway || a.member.last_name.localeCompare(b.member.last_name));
  const next: MemberBirthday | null = upcoming[0] ?? datedMembers
    .map(member => {
      const occurrence = birthdayInYear(member.birth_date, today.getFullYear() + 1);
      return { member, occurrence, daysAway: Math.round((occurrence.getTime() - today.getTime()) / DAY_MS) };
    })
    .sort((a, b) => a.daysAway - b.daysAway)[0] ?? null;
  return { next, upcoming, passed };
}

export const memberName = (member: Member) => `${member.first_name} ${member.last_name}`;

export function formatBirthday(date: Date) {
  return new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric' }).format(date);
}
