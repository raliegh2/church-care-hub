begin;

create index if not exists care_notes_org_member_fk_idx
  on public.care_notes (organization_id, member_id)
  where member_id is not null;
create index if not exists visit_records_org_member_fk_idx
  on public.visit_records (organization_id, member_id)
  where member_id is not null;

drop policy if exists visitors_insert_owner on public.visitors;
create policy visitors_insert_owner
on public.visitors for insert to authenticated
with check (
  organization_id = public.current_org_id()
  and created_by = (select auth.uid())
  and public.current_app_role() = any (array[
    'usher'::public.app_role,
    'pastor'::public.app_role,
    'administrator'::public.app_role
  ])
);

drop policy if exists members_insert_owner on public.members;
create policy members_insert_owner
on public.members for insert to authenticated
with check (
  organization_id = public.current_org_id()
  and created_by = (select auth.uid())
  and public.current_app_role() = any (array[
    'pastor'::public.app_role,
    'administrator'::public.app_role
  ])
);

drop policy if exists attendance_sessions_insert_owner on public.attendance_sessions;
create policy attendance_sessions_insert_owner
on public.attendance_sessions for insert to authenticated
with check (
  organization_id = public.current_org_id()
  and created_by = (select auth.uid())
  and public.current_app_role() = any (array[
    'usher'::public.app_role,
    'pastor'::public.app_role,
    'administrator'::public.app_role
  ])
);

drop policy if exists attendance_sessions_delete_owner_or_admin on public.attendance_sessions;
create policy attendance_sessions_delete_owner_or_admin
on public.attendance_sessions for delete to authenticated
using (
  organization_id = public.current_org_id()
  and (created_by = (select auth.uid()) or public.is_admin())
);

drop policy if exists care_notes_insert_role_workspace on public.care_notes;
create policy care_notes_insert_role_workspace
on public.care_notes for insert to authenticated
with check (
  organization_id = public.current_org_id()
  and created_by = (select auth.uid())
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

drop policy if exists care_notes_update_role_workspace on public.care_notes;
create policy care_notes_update_role_workspace
on public.care_notes for update to authenticated
using (
  organization_id = public.current_org_id()
  and (created_by = (select auth.uid()) or public.current_app_role() = any (array[
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

drop policy if exists visit_records_insert_role_workspace on public.visit_records;
create policy visit_records_insert_role_workspace
on public.visit_records for insert to authenticated
with check (
  organization_id = public.current_org_id()
  and visited_by = (select auth.uid())
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

drop policy if exists visit_records_update_owner_or_admin on public.visit_records;
create policy visit_records_update_owner_or_admin
on public.visit_records for update to authenticated
using (
  organization_id = public.current_org_id()
  and (visited_by = (select auth.uid()) or public.is_admin())
)
with check (
  organization_id = public.current_org_id()
  and (visited_by = (select auth.uid()) or public.is_admin())
);

commit;
