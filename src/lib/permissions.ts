import type { AppRole } from '../types';

export type AppPage = 'dashboard' | 'attendance' | 'visitors' | 'members' | 'import' | 'admin';

export const canManageAttendance = (role: AppRole) => role === 'pastor' || role === 'administrator';
export const canManageVisitors = (role: AppRole) => role === 'usher' || role === 'pastor' || role === 'administrator';
export const canViewMembers = (role: AppRole) => role === 'pastor' || role === 'administrator';
export const canImportMembers = canViewMembers;
export const canAdminister = (role: AppRole) => role === 'administrator';

export function canAccessPage(role: AppRole, page: AppPage): boolean {
  if (page === 'dashboard') return true;
  if (page === 'attendance') return canManageAttendance(role);
  if (page === 'visitors') return canManageVisitors(role);
  if (page === 'members') return canViewMembers(role);
  if (page === 'import') return canImportMembers(role);
  return canAdminister(role);
}

export function roleResponsibility(role: AppRole): string {
  if (role === 'usher') return 'Visitor records, visitor follow-up and visitor totals';
  if (role === 'pastor') return 'Member and visitor pastoral care';
  return 'Full system administration';
}
