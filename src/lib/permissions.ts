import type { AppRole } from '../types';

export const canViewMembers = (role: AppRole) => role === 'pastor' || role === 'administrator';
export const canImportMembers = canViewMembers;
export const canAdminister = (role: AppRole) => role === 'administrator';
export const canManageVisitors = (_role: AppRole) => true;
