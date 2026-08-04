begin;

-- Ushers work only with visitor records, visitor care notes, visitor visits and visitor totals.
-- Attendance sessions are restricted to approved pastors and administrators.

drop policy if exists attendance_sessions_select_role_workspace on public.attendance_sessions;
drop policy if exists attendance_sessions_insert_owner on public.attendance_sessions;
drop policy if exists attendance_sessions_update_role_workspace on public.attendance_sessions;
drop policy if exists attendance_sessions_delete_owner_or_admin on public.attendance_sessions;

create policy attendance_sessions_select_pastoral_workspace
on public.attendance_sessions for select to authenticated
using (
  organization_id = public.current_org_id()
  and public.current_app_role() = any (array[
    'pastor'::public.app_role,
    'administrator'::public.app_role
  ])
);

create policy attendance_sessions_insert_pastoral_workspace
on public.attendance_sessions for insert to authenticated
with check (
  organization_id = public.current_org_id()
  and created_by = (select auth.uid())
  and public.current_app_role() = any (array[
    'pastor'::public.app_role,
    'administrator'::public.app_role
  ])
);

create policy attendance_sessions_update_pastoral_workspace
on public.attendance_sessions for update to authenticated
using (
  organization_id = public.current_org_id()
  and public.current_app_role() = any (array[
    'pastor'::public.app_role,
    'administrator'::public.app_role
  ])
)
with check (
  organization_id = public.current_org_id()
  and public.current_app_role() = any (array[
    'pastor'::public.app_role,
    'administrator'::public.app_role
  ])
);

create policy attendance_sessions_delete_pastoral_workspace
on public.attendance_sessions for delete to authenticated
using (
  organization_id = public.current_org_id()
  and (
    public.current_app_role() = 'administrator'::public.app_role
    or (
      public.current_app_role() = 'pastor'::public.app_role
      and created_by = (select auth.uid())
    )
  )
);

commit;
