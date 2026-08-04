begin;

-- Replace creator-only access with organization-wide role-based workspaces.

drop policy if exists attendance_sessions_select_owner_or_admin on public.attendance_sessions;
drop policy if exists attendance_sessions_update_owner_or_admin on public.attendance_sessions;
create policy attendance_sessions_select_role_workspace
on public.attendance_sessions for select to authenticated
using (
  organization_id = public.current_org_id()
  and public.current_app_role() = any (array[
    'usher'::public.app_role,
    'pastor'::public.app_role,
    'administrator'::public.app_role
  ])
);
create policy attendance_sessions_update_role_workspace
on public.attendance_sessions for update to authenticated
using (
  organization_id = public.current_org_id()
  and public.current_app_role() = any (array[
    'usher'::public.app_role,
    'pastor'::public.app_role,
    'administrator'::public.app_role
  ])
)
with check (
  organization_id = public.current_org_id()
  and public.current_app_role() = any (array[
    'usher'::public.app_role,
    'pastor'::public.app_role,
    'administrator'::public.app_role
  ])
);

drop policy if exists visitors_select_owner_or_admin on public.visitors;
drop policy if exists visitors_update_owner_or_admin on public.visitors;
create policy visitors_select_role_workspace
on public.visitors for select to authenticated
using (
  organization_id = public.current_org_id()
  and public.current_app_role() = any (array[
    'usher'::public.app_role,
    'pastor'::public.app_role,
    'administrator'::public.app_role
  ])
);
create policy visitors_update_role_workspace
on public.visitors for update to authenticated
using (
  organization_id = public.current_org_id()
  and public.current_app_role() = any (array[
    'usher'::public.app_role,
    'pastor'::public.app_role,
    'administrator'::public.app_role
  ])
)
with check (
  organization_id = public.current_org_id()
  and public.current_app_role() = any (array[
    'usher'::public.app_role,
    'pastor'::public.app_role,
    'administrator'::public.app_role
  ])
);
create policy visitors_delete_admin
on public.visitors for delete to authenticated
using (organization_id = public.current_org_id() and public.is_admin());

drop policy if exists members_select_owner_or_admin on public.members;
drop policy if exists members_update_owner_or_admin on public.members;
create policy members_select_pastoral_workspace
on public.members for select to authenticated
using (
  organization_id = public.current_org_id()
  and public.current_app_role() = any (array[
    'pastor'::public.app_role,
    'administrator'::public.app_role
  ])
);
create policy members_update_pastoral_workspace
on public.members for update to authenticated
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
create policy members_delete_admin
on public.members for delete to authenticated
using (organization_id = public.current_org_id() and public.is_admin());

drop policy if exists care_notes_select_owner_or_admin on public.care_notes;
drop policy if exists care_notes_insert_owned_person on public.care_notes;
create policy care_notes_select_role_workspace
on public.care_notes for select to authenticated
using (
  organization_id = public.current_org_id()
  and (
    (
      visitor_id is not null
      and member_id is null
      and public.current_app_role() = any (array[
        'usher'::public.app_role,
        'pastor'::public.app_role,
        'administrator'::public.app_role
      ])
      and exists (
        select 1 from public.visitors v
        where v.id = care_notes.visitor_id
          and v.organization_id = public.current_org_id()
      )
    )
    or
    (
      member_id is not null
      and visitor_id is null
      and public.current_app_role() = any (array[
        'pastor'::public.app_role,
        'administrator'::public.app_role
      ])
      and exists (
        select 1 from public.members m
        where m.id = care_notes.member_id
          and m.organization_id = public.current_org_id()
      )
    )
  )
);
create policy care_notes_insert_role_workspace
on public.care_notes for insert to authenticated
with check (
  organization_id = public.current_org_id()
  and created_by = auth.uid()
  and (
    (
      visitor_id is not null
      and member_id is null
      and public.current_app_role() = any (array[
        'usher'::public.app_role,
        'pastor'::public.app_role,
        'administrator'::public.app_role
      ])
      and exists (
        select 1 from public.visitors v
        where v.id = care_notes.visitor_id
          and v.organization_id = public.current_org_id()
      )
    )
    or
    (
      member_id is not null
      and visitor_id is null
      and public.current_app_role() = any (array[
        'pastor'::public.app_role,
        'administrator'::public.app_role
      ])
      and exists (
        select 1 from public.members m
        where m.id = care_notes.member_id
          and m.organization_id = public.current_org_id()
      )
    )
  )
);
create policy care_notes_update_role_workspace
on public.care_notes for update to authenticated
using (
  organization_id = public.current_org_id()
  and (created_by = auth.uid() or public.current_app_role() = any (array[
    'pastor'::public.app_role,
    'administrator'::public.app_role
  ]))
  and (
    (visitor_id is not null and member_id is null and public.current_app_role() = any (array[
      'usher'::public.app_role,
      'pastor'::public.app_role,
      'administrator'::public.app_role
    ]))
    or
    (member_id is not null and visitor_id is null and public.current_app_role() = any (array[
      'pastor'::public.app_role,
      'administrator'::public.app_role
    ]))
  )
)
with check (
  organization_id = public.current_org_id()
  and (
    (visitor_id is not null and member_id is null and public.current_app_role() = any (array[
      'usher'::public.app_role,
      'pastor'::public.app_role,
      'administrator'::public.app_role
    ]))
    or
    (member_id is not null and visitor_id is null and public.current_app_role() = any (array[
      'pastor'::public.app_role,
      'administrator'::public.app_role
    ]))
  )
);
create policy care_notes_delete_admin
on public.care_notes for delete to authenticated
using (organization_id = public.current_org_id() and public.is_admin());

drop policy if exists visit_records_select_owner_or_admin on public.visit_records;
drop policy if exists visit_records_insert_owned_person on public.visit_records;
create policy visit_records_select_role_workspace
on public.visit_records for select to authenticated
using (
  organization_id = public.current_org_id()
  and (
    (visitor_id is not null and member_id is null and public.current_app_role() = any (array[
      'usher'::public.app_role,
      'pastor'::public.app_role,
      'administrator'::public.app_role
    ]))
    or
    (member_id is not null and visitor_id is null and public.current_app_role() = any (array[
      'pastor'::public.app_role,
      'administrator'::public.app_role
    ]))
  )
);
create policy visit_records_insert_role_workspace
on public.visit_records for insert to authenticated
with check (
  organization_id = public.current_org_id()
  and visited_by = auth.uid()
  and (
    (
      visitor_id is not null and member_id is null
      and public.current_app_role() = any (array[
        'usher'::public.app_role,
        'pastor'::public.app_role,
        'administrator'::public.app_role
      ])
      and exists (
        select 1 from public.visitors v
        where v.id = visit_records.visitor_id
          and v.organization_id = public.current_org_id()
      )
    )
    or
    (
      member_id is not null and visitor_id is null
      and public.current_app_role() = any (array[
        'pastor'::public.app_role,
        'administrator'::public.app_role
      ])
      and exists (
        select 1 from public.members m
        where m.id = visit_records.member_id
          and m.organization_id = public.current_org_id()
      )
    )
  )
);
create policy visit_records_update_owner_or_admin
on public.visit_records for update to authenticated
using (
  organization_id = public.current_org_id()
  and (visited_by = auth.uid() or public.is_admin())
)
with check (
  organization_id = public.current_org_id()
  and (visited_by = auth.uid() or public.is_admin())
);
create policy visit_records_delete_admin
on public.visit_records for delete to authenticated
using (organization_id = public.current_org_id() and public.is_admin());

create or replace function public.admin_manage_user(
  p_user_id uuid,
  p_role public.app_role,
  p_active boolean
)
returns public.user_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_profile public.user_profiles;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Use another administrator account to change your own access';
  end if;

  update public.user_profiles
  set role = p_role,
      requested_role = p_role,
      role_status = 'approved',
      active = p_active,
      auth_not_before = now(),
      updated_at = now()
  where id = p_user_id
    and organization_id = public.current_org_id()
  returning * into v_profile;

  if v_profile.id is null then
    raise exception 'User not found';
  end if;

  return v_profile;
end;
$function$;
revoke all on function public.admin_manage_user(uuid, public.app_role, boolean) from public;
grant execute on function public.admin_manage_user(uuid, public.app_role, boolean) to authenticated;

commit;
