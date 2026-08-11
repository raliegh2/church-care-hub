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
  created_by: string;
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
  birth_date?: string | null;
  membership_status?: string;
  last_contact_at?: string | null;
  active: boolean;
  created_by: string;
  created_at: string;
}

export interface CareNote {
  id: string;
  organization_id: string;
  note_text: string;
  note_type: string;
  status: string;
  visibility: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
  resolved_at?: string | null;
  visitor_id?: string | null;
  member_id?: string | null;
}

export interface VisitRecord {
  id: string;
  organization_id: string;
  visitor_id?: string | null;
  member_id?: string | null;
  visited_at: string;
  visited_by: string;
  outcome: string;
  summary?: string | null;
  created_at: string;
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
