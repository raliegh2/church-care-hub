begin;

-- ---------------------------------------------------------------------------
-- Server-side login throttling. Bucket keys are SHA-256 hashes produced by the
-- Edge Function; plaintext email addresses, passwords, and IP addresses are
-- never stored in this table.
-- ---------------------------------------------------------------------------
create table if not exists public.auth_login_rate_limits (
  bucket_key text primary key,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  constraint auth_login_rate_limits_bucket_length check (char_length(bucket_key) between 1 and 200)
);

alter table public.auth_login_rate_limits enable row level security;
revoke all on table public.auth_login_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.auth_login_rate_limits to service_role;

create index if not exists auth_login_rate_limits_updated_at_idx
  on public.auth_login_rate_limits (updated_at);

create or replace function public.check_auth_login_rate_limit(p_bucket_key text)
returns table(blocked boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_blocked_until timestamptz;
begin
  if p_bucket_key is null or char_length(p_bucket_key) not between 1 and 200 then
    raise exception 'invalid rate-limit bucket';
  end if;

  select r.blocked_until
    into v_blocked_until
  from public.auth_login_rate_limits r
  where r.bucket_key = p_bucket_key;

  blocked := coalesce(v_blocked_until > clock_timestamp(), false);
  retry_after_seconds := case
    when blocked then greatest(1, ceil(extract(epoch from (v_blocked_until - clock_timestamp())))::integer)
    else 0
  end;
  return next;
end;
$$;

create or replace function public.record_auth_login_failure(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer,
  p_block_seconds integer
)
returns table(blocked boolean, retry_after_seconds integer, attempt_count integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.auth_login_rate_limits%rowtype;
  v_now timestamptz := clock_timestamp();
  v_count integer;
  v_window_started timestamptz;
  v_blocked_until timestamptz;
begin
  if p_bucket_key is null or char_length(p_bucket_key) not between 1 and 200
     or p_limit not between 1 and 100
     or p_window_seconds not between 30 and 86400
     or p_block_seconds not between 30 and 86400 then
    raise exception 'invalid rate-limit configuration';
  end if;

  insert into public.auth_login_rate_limits (
    bucket_key, attempt_count, window_started_at, blocked_until, updated_at
  ) values (
    p_bucket_key, 0, v_now, null, v_now
  )
  on conflict (bucket_key) do nothing;

  select * into v_row
  from public.auth_login_rate_limits r
  where r.bucket_key = p_bucket_key
  for update;

  if v_row.blocked_until is not null and v_row.blocked_until > v_now then
    v_count := v_row.attempt_count;
    v_window_started := v_row.window_started_at;
    v_blocked_until := v_row.blocked_until;
  else
    if v_row.window_started_at <= v_now - make_interval(secs => p_window_seconds) then
      v_count := 1;
      v_window_started := v_now;
    else
      v_count := v_row.attempt_count + 1;
      v_window_started := v_row.window_started_at;
    end if;

    v_blocked_until := case
      when v_count >= p_limit then v_now + make_interval(secs => p_block_seconds)
      else null
    end;

    update public.auth_login_rate_limits r
    set attempt_count = v_count,
        window_started_at = v_window_started,
        blocked_until = v_blocked_until,
        updated_at = v_now
    where r.bucket_key = p_bucket_key;
  end if;

  blocked := coalesce(v_blocked_until > v_now, false);
  retry_after_seconds := case
    when blocked then greatest(1, ceil(extract(epoch from (v_blocked_until - v_now)))::integer)
    else 0
  end;
  attempt_count := v_count;
  return next;
end;
$$;

create or replace function public.clear_auth_login_rate_limit(p_bucket_key text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_bucket_key is null or char_length(p_bucket_key) not between 1 and 200 then
    raise exception 'invalid rate-limit bucket';
  end if;

  delete from public.auth_login_rate_limits r
  where r.bucket_key = p_bucket_key;
end;
$$;

revoke execute on function public.check_auth_login_rate_limit(text) from public, anon, authenticated;
revoke execute on function public.record_auth_login_failure(text, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.clear_auth_login_rate_limit(text) from public, anon, authenticated;
grant execute on function public.check_auth_login_rate_limit(text) to service_role;
grant execute on function public.record_auth_login_failure(text, integer, integer, integer) to service_role;
grant execute on function public.clear_auth_login_rate_limit(text) to service_role;

-- ---------------------------------------------------------------------------
-- Remove broad client grants and replace them with the minimum privileges used
-- by the current application. Row ownership is enforced by RLS below.
-- ---------------------------------------------------------------------------
revoke all on table public.visitors from public, anon, authenticated;
revoke all on table public.members from public, anon, authenticated;
revoke all on table public.attendance_sessions from public, anon, authenticated;
revoke all on table public.care_notes from public, anon, authenticated;
revoke all on table public.visit_records from public, anon, authenticated;
revoke all on table public.user_profiles from public, anon, authenticated;
revoke all on table public.admin_signup_notifications from public, anon, authenticated;

alter table public.admin_signup_notifications enable row level security;

grant select, insert, update on table public.visitors to authenticated;
grant select, insert, update on table public.members to authenticated;
grant select, insert, update, delete on table public.attendance_sessions to authenticated;
grant select, insert on table public.care_notes to authenticated;
grant select, insert on table public.visit_records to authenticated;
grant select on table public.user_profiles to authenticated;

-- Drop every permissive policy on user-owned data before recreating a single,
-- auditable policy set. This avoids an older policy silently widening access.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'visitors', 'members', 'attendance_sessions',
        'care_notes', 'visit_records', 'user_profiles'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      v_policy.policyname,
      v_policy.schemaname,
      v_policy.tablename
    );
  end loop;
end;
$$;

-- A user can only read and change visitor rows they created. Administrators
-- can oversee all rows in their own organization.
create policy visitors_select_owner_or_admin
on public.visitors for select
to authenticated
using (
  organization_id = public.current_org_id()
  and (created_by = auth.uid() or public.is_admin())
);

create policy visitors_insert_owner
on public.visitors for insert
to authenticated
with check (
  organization_id = public.current_org_id()
  and created_by = auth.uid()
  and public.current_app_role() in (
    'usher'::public.app_role,
    'pastor'::public.app_role,
    'administrator'::public.app_role
  )
);

create policy visitors_update_owner_or_admin
on public.visitors for update
to authenticated
using (
  organization_id = public.current_org_id()
  and (created_by = auth.uid() or public.is_admin())
)
with check (
  organization_id = public.current_org_id()
  and (created_by = auth.uid() or public.is_admin())
);

-- Pastors can only manage member rows they created. Administrators retain
-- organization-wide oversight.
create policy members_select_owner_or_admin
on public.members for select
to authenticated
using (
  organization_id = public.current_org_id()
  and (
    public.is_admin()
    or (public.current_app_role() = 'pastor'::public.app_role and created_by = auth.uid())
  )
);

create policy members_insert_owner
on public.members for insert
to authenticated
with check (
  organization_id = public.current_org_id()
  and created_by = auth.uid()
  and public.current_app_role() in ('pastor'::public.app_role, 'administrator'::public.app_role)
);

create policy members_update_owner_or_admin
on public.members for update
to authenticated
using (
  organization_id = public.current_org_id()
  and (
    public.is_admin()
    or (public.current_app_role() = 'pastor'::public.app_role and created_by = auth.uid())
  )
)
with check (
  organization_id = public.current_org_id()
  and (
    public.is_admin()
    or (public.current_app_role() = 'pastor'::public.app_role and created_by = auth.uid())
  )
);

create policy attendance_sessions_select_owner_or_admin
on public.attendance_sessions for select
to authenticated
using (
  organization_id = public.current_org_id()
  and (created_by = auth.uid() or public.is_admin())
);

create policy attendance_sessions_insert_owner
on public.attendance_sessions for insert
to authenticated
with check (
  organization_id = public.current_org_id()
  and created_by = auth.uid()
  and public.current_app_role() in (
    'usher'::public.app_role,
    'pastor'::public.app_role,
    'administrator'::public.app_role
  )
);

create policy attendance_sessions_update_owner_or_admin
on public.attendance_sessions for update
to authenticated
using (
  organization_id = public.current_org_id()
  and (created_by = auth.uid() or public.is_admin())
)
with check (
  organization_id = public.current_org_id()
  and (created_by = auth.uid() or public.is_admin())
);

create policy attendance_sessions_delete_owner_or_admin
on public.attendance_sessions for delete
to authenticated
using (
  organization_id = public.current_org_id()
  and (created_by = auth.uid() or public.is_admin())
);

create policy care_notes_select_owner_or_admin
on public.care_notes for select
to authenticated
using (
  organization_id = public.current_org_id()
  and (created_by = auth.uid() or public.is_admin())
);

create policy care_notes_insert_owned_person
on public.care_notes for insert
to authenticated
with check (
  organization_id = public.current_org_id()
  and created_by = auth.uid()
  and (
    (
      visitor_id is not null
      and member_id is null
      and exists (
        select 1
        from public.visitors v
        where v.id = visitor_id
          and v.organization_id = public.current_org_id()
          and (v.created_by = auth.uid() or public.is_admin())
      )
    )
    or (
      member_id is not null
      and visitor_id is null
      and public.current_app_role() in ('pastor'::public.app_role, 'administrator'::public.app_role)
      and exists (
        select 1
        from public.members m
        where m.id = member_id
          and m.organization_id = public.current_org_id()
          and (m.created_by = auth.uid() or public.is_admin())
      )
    )
  )
);

create policy visit_records_select_owner_or_admin
on public.visit_records for select
to authenticated
using (
  organization_id = public.current_org_id()
  and (visited_by = auth.uid() or public.is_admin())
);

create policy visit_records_insert_owned_person
on public.visit_records for insert
to authenticated
with check (
  organization_id = public.current_org_id()
  and visited_by = auth.uid()
  and (
    (
      visitor_id is not null
      and member_id is null
      and exists (
        select 1
        from public.visitors v
        where v.id = visitor_id
          and v.organization_id = public.current_org_id()
          and (v.created_by = auth.uid() or public.is_admin())
      )
    )
    or (
      member_id is not null
      and visitor_id is null
      and public.current_app_role() in ('pastor'::public.app_role, 'administrator'::public.app_role)
      and exists (
        select 1
        from public.members m
        where m.id = member_id
          and m.organization_id = public.current_org_id()
          and (m.created_by = auth.uid() or public.is_admin())
      )
    )
  )
);

-- Profiles are never directly writable from the browser. The current user can
-- read only their own profile; administrators can read profiles in their org.
create policy profiles_select_self
on public.user_profiles for select
to authenticated
using (id = auth.uid());

create policy profiles_admin_select_org
on public.user_profiles for select
to authenticated
using (
  public.is_admin()
  and organization_id = public.current_org_id()
);

-- ---------------------------------------------------------------------------
-- Harden onboarding and approval RPCs so arbitrary URL/ID parameters cannot be
-- used to change another account or move an account between organizations.
-- ---------------------------------------------------------------------------
create or replace function public.complete_onboarding(
  p_display_name text,
  p_requested_role text
)
returns public.user_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner_id constant uuid := 'a5b51f32-2336-4b37-afae-710647f1e5cf';
  v_org_id constant uuid := 'a9456be1-5b06-4fbb-b5c1-cd5b66b3ff6a';
  v_name text := btrim(coalesce(p_display_name, ''));
  v_role public.app_role;
  v_requested public.app_role;
  v_status text;
  v_profile public.user_profiles;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if char_length(v_name) not between 2 and 100 then
    raise exception 'Display name must contain 2 to 100 characters';
  end if;

  select * into v_profile
  from public.user_profiles p
  where p.id = v_user_id
  for update;

  if found then
    update public.user_profiles
    set display_name = v_name,
        updated_at = now()
    where id = v_user_id
    returning * into v_profile;
    return v_profile;
  end if;

  if v_user_id = v_owner_id then
    v_role := 'administrator'::public.app_role;
    v_requested := 'administrator'::public.app_role;
    v_status := 'approved';
  else
    if p_requested_role not in ('usher', 'pastor') then
      raise exception 'Select either usher or pastor';
    end if;
    v_requested := p_requested_role::public.app_role;
    v_role := 'usher'::public.app_role;
    v_status := case when p_requested_role = 'usher' then 'approved' else 'pending' end;
  end if;

  insert into public.user_profiles (
    id, organization_id, display_name, role, requested_role, role_status, active
  ) values (
    v_user_id, v_org_id, v_name, v_role, v_requested, v_status, true
  )
  returning * into v_profile;

  return v_profile;
end;
$$;

create or replace function public.approve_role_request(
  p_user_id uuid,
  p_approve boolean default true
)
returns public.user_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.user_profiles;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Self review is not permitted';
  end if;

  select * into v_profile
  from public.user_profiles p
  where p.id = p_user_id
    and p.organization_id = public.current_org_id()
    and p.role_status = 'pending'
    and p.requested_role = 'pastor'::public.app_role
  for update;

  if not found then
    raise exception 'Pending user request not found';
  end if;

  update public.user_profiles
  set role = case when p_approve then 'pastor'::public.app_role else 'usher'::public.app_role end,
      role_status = case when p_approve then 'approved' else 'rejected' end,
      updated_at = now(),
      auth_not_before = now()
  where id = p_user_id
    and organization_id = public.current_org_id()
  returning * into v_profile;

  update public.pastor_applications
  set reviewed_at = now(),
      reviewed_by = auth.uid()
  where profile_id = p_user_id
    and organization_id = public.current_org_id();

  return v_profile;
end;
$$;

-- SECURITY DEFINER routines bypass RLS, so remove browser execution by default
-- and explicitly restore only the helpers and two RPCs used by this frontend.
do $$
declare
  v_function record;
begin
  for v_function in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      v_function.signature
    );
  end loop;
end;
$$;

revoke execute on function public.current_actor_external_id() from public, anon;
revoke execute on function public.current_actor_id() from public, anon;
revoke execute on function public.has_aal2() from public, anon;

grant execute on function public.current_actor_external_id() to authenticated;
grant execute on function public.current_actor_id() to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_org_id() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_pastor_or_admin() to authenticated;
grant execute on function public.has_aal2() to authenticated;
grant execute on function public.complete_onboarding(text, text) to authenticated;
grant execute on function public.approve_role_request(uuid, boolean) to authenticated;

-- Restore service-only access after the blanket SECURITY DEFINER revocation.
grant execute on function public.check_auth_login_rate_limit(text) to service_role;
grant execute on function public.record_auth_login_failure(text, integer, integer, integer) to service_role;
grant execute on function public.clear_auth_login_rate_limit(text) to service_role;

create index if not exists visitors_org_created_by_idx
  on public.visitors (organization_id, created_by);
create index if not exists members_org_created_by_idx
  on public.members (organization_id, created_by);
create index if not exists attendance_sessions_org_created_by_idx
  on public.attendance_sessions (organization_id, created_by);
create index if not exists care_notes_org_created_by_idx
  on public.care_notes (organization_id, created_by);
create index if not exists visit_records_org_visited_by_idx
  on public.visit_records (organization_id, visited_by);

commit;
