-- Generated from the inspected production catalog. Data is exported separately.
-- D1 does not implement PostgreSQL RLS, triggers or stored procedures.
-- The application API must port their authorization and mutation behavior before cutover.
CREATE TABLE _identity_users (id TEXT PRIMARY KEY NOT NULL);
CREATE TABLE "legacy_profiles" (
  "id" TEXT NOT NULL,
  "full_name" TEXT NOT NULL,
  "email" TEXT,
  "role" TEXT NOT NULL DEFAULT 'usher' CHECK ("role" IN ('admin', 'pastor', 'usher', 'member')),
  "is_active" INTEGER NOT NULL DEFAULT 1 CHECK ("is_active" IN (0, 1)),
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "profiles_email_key" UNIQUE (email),
  CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES _identity_users(id) ON DELETE CASCADE,
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id)
);
CREATE TABLE "organizations" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  "name" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "organizations_name_check" CHECK (((length(trim(name)) >= 2) AND (length(trim(name)) <= 120))),
  CONSTRAINT "organizations_pkey" PRIMARY KEY (id)
);
CREATE TABLE "admin_signup_notifications" (
  "user_id" TEXT NOT NULL,
  "notified_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "admin_signup_notifications_pkey" PRIMARY KEY (user_id),
  CONSTRAINT "admin_signup_notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES _identity_users(id) ON DELETE CASCADE
);
CREATE TABLE "auth_login_rate_limits" (
  "bucket_key" TEXT NOT NULL,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "window_started_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "blocked_until" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "auth_login_rate_limits_attempt_count_check" CHECK ((attempt_count >= 0)),
  CONSTRAINT "auth_login_rate_limits_bucket_length" CHECK (((length(bucket_key) >= 1) AND (length(bucket_key) <= 200))),
  CONSTRAINT "auth_login_rate_limits_pkey" PRIMARY KEY (bucket_key)
);
CREATE TABLE "keepalive" (
  "id" INTEGER NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "keepalive_pkey" PRIMARY KEY (id),
  CONSTRAINT "keepalive_single_row" CHECK ((id = 1))
);
CREATE TABLE "legacy_people" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  "first_name" TEXT NOT NULL,
  "last_name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "person_type" TEXT NOT NULL DEFAULT 'visitor',
  "first_visit_date" TEXT,
  "notes" TEXT,
  "consent_to_contact" INTEGER NOT NULL DEFAULT 0 CHECK ("consent_to_contact" IN (0, 1)),
  "created_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "people_created_by_fkey" FOREIGN KEY (created_by) REFERENCES legacy_profiles(id) ON DELETE SET NULL,
  CONSTRAINT "people_person_type_check" CHECK ((person_type IN ('visitor', 'member'))),
  CONSTRAINT "people_pkey" PRIMARY KEY (id)
);
CREATE TABLE "legacy_services" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  "title" TEXT NOT NULL,
  "service_date" TEXT NOT NULL,
  "start_time" TEXT,
  "end_time" TEXT,
  "location" TEXT,
  "notes" TEXT,
  "created_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "services_created_by_fkey" FOREIGN KEY (created_by) REFERENCES legacy_profiles(id) ON DELETE SET NULL,
  CONSTRAINT "services_pkey" PRIMARY KEY (id),
  CONSTRAINT "services_title_service_date_start_time_key" UNIQUE (title, service_date, start_time)
);
CREATE TABLE "legacy_audit_logs" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  "actor_id" TEXT,
  "action" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT,
  "metadata" TEXT NOT NULL DEFAULT '{}' CHECK ("metadata" IS NULL OR json_valid("metadata")),
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES legacy_profiles(id) ON DELETE SET NULL,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY (id)
);
CREATE TABLE "user_profiles" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'usher' CHECK ("role" IN ('administrator', 'usher', 'auditor', 'pastor')),
  "active" INTEGER NOT NULL DEFAULT 1 CHECK ("active" IN (0, 1)),
  "auth_not_before" TEXT NOT NULL DEFAULT '1970-01-01 00:00:00+00',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "requested_role" TEXT NOT NULL DEFAULT 'usher' CHECK ("requested_role" IN ('administrator', 'usher', 'auditor', 'pastor')),
  "role_status" TEXT NOT NULL DEFAULT 'approved',
  "clerk_user_id" TEXT,
  CONSTRAINT "user_profiles_display_name_check" CHECK (((length(trim(display_name)) >= 2) AND (length(trim(display_name)) <= 80))),
  CONSTRAINT "user_profiles_org_id_unique" UNIQUE (organization_id, id),
  CONSTRAINT "user_profiles_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  CONSTRAINT "user_profiles_pkey" PRIMARY KEY (id),
  CONSTRAINT "user_profiles_role_status_check" CHECK ((role_status IN ('pending', 'approved', 'rejected')))
);
CREATE TABLE "legacy_attendance_records" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  "service_id" TEXT NOT NULL,
  "person_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'present',
  "checked_in_at" TEXT,
  "checked_in_by" TEXT,
  "notes" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "attendance_records_checked_in_by_fkey" FOREIGN KEY (checked_in_by) REFERENCES legacy_profiles(id) ON DELETE SET NULL,
  CONSTRAINT "attendance_records_person_id_fkey" FOREIGN KEY (person_id) REFERENCES legacy_people(id) ON DELETE CASCADE,
  CONSTRAINT "attendance_records_pkey" PRIMARY KEY (id),
  CONSTRAINT "attendance_records_service_id_fkey" FOREIGN KEY (service_id) REFERENCES legacy_services(id) ON DELETE CASCADE,
  CONSTRAINT "attendance_records_service_id_person_id_key" UNIQUE (service_id, person_id),
  CONSTRAINT "attendance_records_status_check" CHECK ((status IN ('present', 'absent', 'excused')))
);
CREATE TABLE "legacy_follow_ups" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  "person_id" TEXT NOT NULL,
  "assigned_to" TEXT,
  "due_date" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "notes" TEXT NOT NULL,
  "created_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "follow_ups_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES legacy_profiles(id) ON DELETE SET NULL,
  CONSTRAINT "follow_ups_created_by_fkey" FOREIGN KEY (created_by) REFERENCES legacy_profiles(id) ON DELETE SET NULL,
  CONSTRAINT "follow_ups_person_id_fkey" FOREIGN KEY (person_id) REFERENCES legacy_people(id) ON DELETE CASCADE,
  CONSTRAINT "follow_ups_pkey" PRIMARY KEY (id),
  CONSTRAINT "follow_ups_status_check" CHECK ((status IN ('open', 'completed', 'cancelled')))
);
CREATE TABLE "organization_settings" (
  "organization_id" TEXT NOT NULL,
  "visitor_retention_months" INTEGER NOT NULL DEFAULT 24,
  "contact_retention_months" INTEGER NOT NULL DEFAULT 12,
  "attendance_retention_months" INTEGER NOT NULL DEFAULT 36,
  "audit_retention_months" INTEGER NOT NULL DEFAULT 24,
  "not_seen_days" INTEGER NOT NULL DEFAULT 30,
  "require_service_assignment" INTEGER NOT NULL DEFAULT 1 CHECK ("require_service_assignment" IN (0, 1)),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_by" TEXT,
  CONSTRAINT "organization_settings_attendance_retention_months_check" CHECK (((attendance_retention_months >= 1) AND (attendance_retention_months <= 120))),
  CONSTRAINT "organization_settings_audit_retention_months_check" CHECK (((audit_retention_months >= 6) AND (audit_retention_months <= 120))),
  CONSTRAINT "organization_settings_contact_retention_months_check" CHECK (((contact_retention_months >= 1) AND (contact_retention_months <= 120))),
  CONSTRAINT "organization_settings_not_seen_days_check" CHECK (((not_seen_days >= 7) AND (not_seen_days <= 730))),
  CONSTRAINT "organization_settings_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT "organization_settings_pkey" PRIMARY KEY (organization_id),
  CONSTRAINT "organization_settings_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES user_profiles(id) ON DELETE SET NULL,
  CONSTRAINT "organization_settings_visitor_retention_months_check" CHECK (((visitor_retention_months >= 1) AND (visitor_retention_months <= 120)))
);
CREATE TABLE "services" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  "organization_id" TEXT NOT NULL,
  "service_name" TEXT NOT NULL,
  "service_date" TEXT NOT NULL,
  "start_time" TEXT NOT NULL,
  "active" INTEGER NOT NULL DEFAULT 1 CHECK ("active" IN (0, 1)),
  "created_by" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "services_created_by_fkey1" FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE RESTRICT,
  CONSTRAINT "services_created_by_same_org" FOREIGN KEY (organization_id, created_by) REFERENCES user_profiles(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT "services_org_id_unique" UNIQUE (organization_id, id),
  CONSTRAINT "services_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  CONSTRAINT "services_organization_id_service_name_service_date_start_ti_key" UNIQUE (organization_id, service_name, service_date, start_time),
  CONSTRAINT "services_pkey1" PRIMARY KEY (id),
  CONSTRAINT "services_service_name_check" CHECK (((length(trim(service_name)) >= 2) AND (length(trim(service_name)) <= 100)))
);
CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  "organization_id" TEXT NOT NULL,
  "actor_user_id" TEXT,
  "action" TEXT NOT NULL,
  "resource_type" TEXT NOT NULL,
  "resource_id" TEXT,
  "event_timestamp" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "outcome" TEXT NOT NULL,
  "safe_metadata" TEXT NOT NULL DEFAULT '{}' CHECK ("safe_metadata" IS NULL OR json_valid("safe_metadata")),
  CONSTRAINT "audit_logs_action_check" CHECK (((length(action) >= 3) AND (length(action) <= 80))),
  CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES user_profiles(id) ON DELETE SET NULL,
  CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  CONSTRAINT "audit_logs_outcome_check" CHECK ((outcome IN ('success', 'denied', 'failure'))),
  CONSTRAINT "audit_logs_pkey1" PRIMARY KEY (id),
  CONSTRAINT "audit_logs_resource_type_check" CHECK (((length(resource_type) >= 2) AND (length(resource_type) <= 80))),
  CONSTRAINT "audit_logs_safe_metadata_check" CHECK ((json_type(safe_metadata) = 'object'))
);
CREATE TABLE "attendance_sessions" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  "organization_id" TEXT NOT NULL,
  "service_name" TEXT NOT NULL,
  "service_date" TEXT NOT NULL,
  "service_time" TEXT,
  "new_visitors" INTEGER NOT NULL DEFAULT 0,
  "returning_visitors" INTEGER NOT NULL DEFAULT 0,
  "total_attendance" INTEGER GENERATED ALWAYS AS ((new_visitors + returning_visitors)) STORED,
  "notes" TEXT,
  "created_by" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "attendance_sessions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES user_profiles(id),
  CONSTRAINT "attendance_sessions_new_visitors_check" CHECK ((new_visitors >= 0)),
  CONSTRAINT "attendance_sessions_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY (id),
  CONSTRAINT "attendance_sessions_returning_visitors_check" CHECK ((returning_visitors >= 0))
);
CREATE TABLE "visitors" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  "organization_id" TEXT NOT NULL,
  "full_name" TEXT NOT NULL,
  "preferred_name" TEXT,
  "first_visit_date" TEXT NOT NULL,
  "optional_contact" TEXT,
  "contact_consent" INTEGER NOT NULL DEFAULT 0 CHECK ("contact_consent" IN (0, 1)),
  "active" INTEGER NOT NULL DEFAULT 1 CHECK ("active" IN (0, 1)),
  "anonymized_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "created_by" TEXT NOT NULL,
  "address" TEXT,
  CONSTRAINT "visitors_anonymized_state" CHECK (((anonymized_at IS NULL) OR ((active = 0) AND (optional_contact IS NULL) AND (contact_consent = 0)))),
  CONSTRAINT "visitors_contact_requires_consent" CHECK (((optional_contact IS NULL) OR (contact_consent = 1))),
  CONSTRAINT "visitors_created_by_fkey" FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE RESTRICT,
  CONSTRAINT "visitors_created_by_same_org" FOREIGN KEY (organization_id, created_by) REFERENCES user_profiles(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT "visitors_full_name_check" CHECK (((length(trim(full_name)) >= 2) AND (length(trim(full_name)) <= 100))),
  CONSTRAINT "visitors_optional_contact_check" CHECK (((optional_contact IS NULL) OR (length(optional_contact) <= 120))),
  CONSTRAINT "visitors_org_id_unique" UNIQUE (organization_id, id),
  CONSTRAINT "visitors_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  CONSTRAINT "visitors_pkey" PRIMARY KEY (id),
  CONSTRAINT "visitors_preferred_name_check" CHECK (((preferred_name IS NULL) OR ((length(trim(preferred_name)) >= 1) AND (length(trim(preferred_name)) <= 60))))
);
CREATE TABLE "members" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  "organization_id" TEXT NOT NULL,
  "first_name" TEXT NOT NULL,
  "last_name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "membership_status" TEXT NOT NULL DEFAULT 'active',
  "last_contact_at" TEXT,
  "imported_at" TEXT,
  "import_batch_id" TEXT,
  "created_by" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "ministry" TEXT,
  "joined_date" TEXT,
  "active" INTEGER NOT NULL DEFAULT 1 CHECK ("active" IN (0, 1)),
  "birth_date" TEXT,
  CONSTRAINT "members_created_by_same_org" FOREIGN KEY (organization_id, created_by) REFERENCES user_profiles(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT "members_membership_status_check" CHECK ((membership_status IN ('active', 'inactive', 'prospective'))),
  CONSTRAINT "members_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  CONSTRAINT "members_pkey" PRIMARY KEY (id)
);
CREATE TABLE "pastor_applications" (
  "profile_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "church_name" TEXT NOT NULL,
  "pastor_name" TEXT NOT NULL,
  "district" TEXT NOT NULL,
  "denomination" TEXT NOT NULL,
  "church_phone" TEXT NOT NULL,
  "submitted_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "reviewed_at" TEXT,
  "reviewed_by" TEXT,
  "verification_notes" TEXT,
  CONSTRAINT "pastor_application_profile_same_org" FOREIGN KEY (organization_id, profile_id) REFERENCES user_profiles(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT "pastor_application_reviewer_same_org" FOREIGN KEY (organization_id, reviewed_by) REFERENCES user_profiles(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT "pastor_applications_church_name_check" CHECK (((length(trim(church_name)) >= 2) AND (length(trim(church_name)) <= 160))),
  CONSTRAINT "pastor_applications_church_phone_check" CHECK (((length(trim(church_phone)) >= 7) AND (length(trim(church_phone)) <= 40))),
  CONSTRAINT "pastor_applications_denomination_check" CHECK (((length(trim(denomination)) >= 2) AND (length(trim(denomination)) <= 120))),
  CONSTRAINT "pastor_applications_district_check" CHECK (((length(trim(district)) >= 2) AND (length(trim(district)) <= 120))),
  CONSTRAINT "pastor_applications_pastor_name_check" CHECK (((length(trim(pastor_name)) >= 2) AND (length(trim(pastor_name)) <= 120))),
  CONSTRAINT "pastor_applications_pkey" PRIMARY KEY (profile_id),
  CONSTRAINT "pastor_applications_verification_notes_check" CHECK (((verification_notes IS NULL) OR (length(trim(verification_notes)) <= 500)))
);
CREATE TABLE "service_assignments" (
  "organization_id" TEXT NOT NULL,
  "service_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "assigned_by" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "assignments_actor_same_org" FOREIGN KEY (organization_id, assigned_by) REFERENCES user_profiles(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT "assignments_service_same_org" FOREIGN KEY (organization_id, service_id) REFERENCES services(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT "assignments_user_same_org" FOREIGN KEY (organization_id, user_id) REFERENCES user_profiles(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT "service_assignments_assigned_by_fkey" FOREIGN KEY (assigned_by) REFERENCES user_profiles(id) ON DELETE RESTRICT,
  CONSTRAINT "service_assignments_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT "service_assignments_pkey" PRIMARY KEY (service_id, user_id),
  CONSTRAINT "service_assignments_service_id_fkey" FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  CONSTRAINT "service_assignments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE
);
CREATE TABLE "attendance" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  "organization_id" TEXT NOT NULL,
  "visitor_id" TEXT NOT NULL,
  "service_id" TEXT NOT NULL,
  "checked_in_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "checked_in_by" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "voided_at" TEXT,
  "voided_by" TEXT,
  "void_reason" TEXT,
  CONSTRAINT "attendance_actor_same_org" FOREIGN KEY (organization_id, checked_in_by) REFERENCES user_profiles(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT "attendance_checked_in_by_fkey" FOREIGN KEY (checked_in_by) REFERENCES user_profiles(id) ON DELETE RESTRICT,
  CONSTRAINT "attendance_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  CONSTRAINT "attendance_pkey" PRIMARY KEY (id),
  CONSTRAINT "attendance_service_id_fkey" FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT,
  CONSTRAINT "attendance_service_same_org" FOREIGN KEY (organization_id, service_id) REFERENCES services(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT "attendance_single_checkin" UNIQUE (organization_id, visitor_id, service_id),
  CONSTRAINT "attendance_visitor_id_fkey" FOREIGN KEY (visitor_id) REFERENCES visitors(id) ON DELETE RESTRICT,
  CONSTRAINT "attendance_visitor_same_org" FOREIGN KEY (organization_id, visitor_id) REFERENCES visitors(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT "attendance_void_actor_same_org" FOREIGN KEY (organization_id, voided_by) REFERENCES user_profiles(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT "attendance_void_consistency" CHECK ((((voided_at IS NULL) AND (voided_by IS NULL) AND (void_reason IS NULL)) OR ((voided_at IS NOT NULL) AND (voided_by IS NOT NULL) AND (void_reason IS NOT NULL)))),
  CONSTRAINT "attendance_void_reason_check" CHECK (((void_reason IS NULL) OR ((length(trim(void_reason)) >= 8) AND (length(trim(void_reason)) <= 240)))),
  CONSTRAINT "attendance_voided_by_fkey" FOREIGN KEY (voided_by) REFERENCES user_profiles(id) ON DELETE RESTRICT
);
CREATE TABLE "retention_actions" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  "organization_id" TEXT NOT NULL,
  "action_type" TEXT NOT NULL CHECK ("action_type" IN ('contact_purged', 'visitor_anonymized', 'attendance_deleted', 'manual_deletion')),
  "visitor_id" TEXT,
  "performed_by" TEXT NOT NULL,
  "performed_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "reason" TEXT NOT NULL,
  CONSTRAINT "retention_actions_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  CONSTRAINT "retention_actions_performed_by_fkey" FOREIGN KEY (performed_by) REFERENCES user_profiles(id) ON DELETE RESTRICT,
  CONSTRAINT "retention_actions_pkey" PRIMARY KEY (id),
  CONSTRAINT "retention_actions_reason_check" CHECK (((length(trim(reason)) >= 10) AND (length(trim(reason)) <= 240))),
  CONSTRAINT "retention_actions_visitor_id_fkey" FOREIGN KEY (visitor_id) REFERENCES visitors(id) ON DELETE SET NULL,
  CONSTRAINT "retention_actor_same_org" FOREIGN KEY (organization_id, performed_by) REFERENCES user_profiles(organization_id, id) ON DELETE RESTRICT
);
CREATE TABLE "care_notes" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  "organization_id" TEXT NOT NULL,
  "visitor_id" TEXT,
  "member_id" TEXT,
  "note_text" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "visibility" TEXT NOT NULL DEFAULT 'pastoral_team',
  "created_by" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "note_type" TEXT NOT NULL DEFAULT 'care',
  "resolved_at" TEXT,
  CONSTRAINT "care_notes_actor_same_org" FOREIGN KEY (organization_id, created_by) REFERENCES user_profiles(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT "care_notes_member_same_org" FOREIGN KEY (organization_id, member_id) REFERENCES members(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT "care_notes_note_text_check" CHECK (((length(trim(note_text)) >= 2) AND (length(trim(note_text)) <= 2000))),
  CONSTRAINT "care_notes_one_person" CHECK (((visitor_id IS NULL) <> (member_id IS NULL))),
  CONSTRAINT "care_notes_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  CONSTRAINT "care_notes_pkey" PRIMARY KEY (id),
  CONSTRAINT "care_notes_status_check" CHECK ((status IN ('open', 'resolved'))),
  CONSTRAINT "care_notes_visibility_check" CHECK ((visibility IN ('assigned_team', 'pastoral_team', 'administrator'))),
  CONSTRAINT "care_notes_visitor_same_org" FOREIGN KEY (organization_id, visitor_id) REFERENCES visitors(organization_id, id) ON DELETE RESTRICT
);
CREATE TABLE "visit_records" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  "organization_id" TEXT NOT NULL,
  "visitor_id" TEXT,
  "member_id" TEXT,
  "visited_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "visited_by" TEXT NOT NULL,
  "outcome" TEXT NOT NULL DEFAULT 'completed',
  "summary" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "visit_records_actor_same_org" FOREIGN KEY (organization_id, visited_by) REFERENCES user_profiles(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT "visit_records_member_same_org" FOREIGN KEY (organization_id, member_id) REFERENCES members(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT "visit_records_one_person" CHECK (((visitor_id IS NULL) <> (member_id IS NULL))),
  CONSTRAINT "visit_records_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  CONSTRAINT "visit_records_outcome_check" CHECK (((length(trim(outcome)) >= 2) AND (length(trim(outcome)) <= 120))),
  CONSTRAINT "visit_records_pkey" PRIMARY KEY (id),
  CONSTRAINT "visit_records_visitor_same_org" FOREIGN KEY (organization_id, visitor_id) REFERENCES visitors(organization_id, id) ON DELETE RESTRICT
);
CREATE INDEX idx_people_name ON legacy_people (last_name, first_name);
CREATE INDEX idx_people_type ON legacy_people (person_type);
CREATE INDEX idx_people_email ON legacy_people (email);
CREATE INDEX idx_attendance_service ON legacy_attendance_records (service_id);
CREATE INDEX idx_attendance_person ON legacy_attendance_records (person_id);
CREATE INDEX idx_attendance_status ON legacy_attendance_records (status);
CREATE INDEX idx_followups_person ON legacy_follow_ups (person_id);
CREATE INDEX idx_followups_assigned_to ON legacy_follow_ups (assigned_to);
CREATE INDEX idx_followups_status ON legacy_follow_ups (status);
CREATE INDEX idx_audit_logs_actor ON legacy_audit_logs (actor_id);
CREATE INDEX idx_audit_logs_entity ON legacy_audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON legacy_audit_logs (created_at DESC);
CREATE INDEX services_org_date_idx ON services (organization_id, service_date DESC, start_time);
CREATE INDEX service_assignments_user_idx ON service_assignments (organization_id, user_id, service_id);
CREATE INDEX attendance_service_active_idx ON attendance (organization_id, service_id, checked_in_at) WHERE (voided_at IS NULL);
CREATE INDEX attendance_visitor_idx ON attendance (organization_id, visitor_id, checked_in_at DESC);
CREATE INDEX audit_logs_org_time_idx ON audit_logs (organization_id, event_timestamp DESC);
CREATE INDEX retention_actions_org_time_idx ON retention_actions (organization_id, performed_at DESC);
CREATE INDEX attendance_sessions_org_date_idx ON attendance_sessions (organization_id, service_date DESC);
CREATE INDEX attendance_sessions_org_created_by_idx ON attendance_sessions (organization_id, created_by);
CREATE INDEX user_profiles_org_role_idx ON user_profiles (organization_id, role, active);
CREATE UNIQUE INDEX user_profiles_clerk_user_id_key ON user_profiles (clerk_user_id) WHERE (clerk_user_id IS NOT NULL);
CREATE INDEX visitors_org_name_idx ON visitors (organization_id, lower(full_name)) WHERE (active = 1);
CREATE INDEX visitors_org_first_visit_idx ON visitors (organization_id, first_visit_date);
CREATE INDEX visitors_org_created_by_idx ON visitors (organization_id, created_by);
CREATE INDEX visitors_active_directory_idx ON visitors (organization_id, created_at DESC, id DESC) WHERE (active = 1);
CREATE INDEX pastor_applications_org_time_idx ON pastor_applications (organization_id, submitted_at DESC);
CREATE INDEX auth_login_rate_limits_updated_at_idx ON auth_login_rate_limits (updated_at);
CREATE INDEX care_notes_visitor_idx ON care_notes (visitor_id, created_at DESC) WHERE (visitor_id IS NOT NULL);
CREATE INDEX care_notes_member_idx ON care_notes (member_id, created_at DESC) WHERE (member_id IS NOT NULL);
CREATE INDEX care_notes_org_person_idx ON care_notes (organization_id, visitor_id, member_id, created_at DESC);
CREATE INDEX care_notes_org_status_idx ON care_notes (organization_id, status, created_at DESC);
CREATE INDEX care_notes_org_created_by_idx ON care_notes (organization_id, created_by);
CREATE INDEX care_notes_org_member_fk_idx ON care_notes (organization_id, member_id) WHERE (member_id IS NOT NULL);
CREATE INDEX visit_records_visitor_idx ON visit_records (visitor_id, visited_at DESC) WHERE (visitor_id IS NOT NULL);
CREATE INDEX visit_records_member_idx ON visit_records (member_id, visited_at DESC) WHERE (member_id IS NOT NULL);
CREATE INDEX visit_records_org_person_idx ON visit_records (organization_id, visitor_id, member_id, visited_at DESC);
CREATE INDEX visit_records_org_visited_by_idx ON visit_records (organization_id, visited_by);
CREATE INDEX visit_records_org_member_fk_idx ON visit_records (organization_id, member_id) WHERE (member_id IS NOT NULL);
CREATE UNIQUE INDEX members_org_id_id_uidx ON members (organization_id, id);
CREATE INDEX members_org_name_idx ON members (organization_id, lower(last_name), lower(first_name)) WHERE (active = 1);
CREATE INDEX members_org_created_by_idx ON members (organization_id, created_by);
CREATE INDEX members_org_active_birth_date_idx ON members (organization_id, birth_date) WHERE ((active = 1) AND (birth_date IS NOT NULL));
CREATE INDEX members_active_directory_idx ON members (organization_id, created_at DESC, id DESC) WHERE (active = 1);
