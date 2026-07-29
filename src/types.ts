export type AppRole = 'usher' | 'pastor' | 'administrator';
export type RoleStatus = 'pending' | 'approved' | 'rejected';

export interface UserProfile {
  id: string;
  organization_id: string;
  display_name: string;
  role: AppRole;
  requested_role: AppRole;
  role_status: RoleStatus;
  active: boolean;
  created_at: string;
}

export interface Visitor {
  id: string;
  organization_id: string;
  full_name: string;
  preferred_name?: string | null;
  optional_contact?: string | null;
  first_visit_date: string;
  contact_consent: boolean;
  active: boolean;
  created_at: string;
}

export interface Member {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  ministry?: string | null;
  joined_date?: string | null;
  active: boolean;
  created_at: string;
}

export interface CareNote {
  id: string;
  note_text: string;
  note_type: string;
  status: string;
  visibility: string;
  created_at: string;
  visitor_id?: string | null;
  member_id?: string | null;
}

export interface AttendanceSession {
  id: string;
  service_name: string;
  service_date: string;
  service_time?: string | null;
  new_visitors: number;
  returning_visitors: number;
  total_attendance: number;
  created_at: string;
}
