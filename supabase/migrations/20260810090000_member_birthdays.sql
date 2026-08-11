begin;

alter table public.members
  add column if not exists birth_date date;

comment on column public.members.birth_date is
  'Member date of birth. Access is restricted by the members table pastoral workspace RLS policies.';

create index if not exists members_org_active_birth_date_idx
  on public.members (organization_id, birth_date)
  where active = true and birth_date is not null;

-- Keep inserts compatible with both the current Supabase identity and the
-- external-identity mapping supported by current_actor_id().
drop policy if exists members_insert_owner on public.members;
create policy members_insert_owner
on public.members for insert to authenticated
with check (
  organization_id = (select public.current_org_id())
  and created_by = (select public.current_actor_id())
  and (select public.current_app_role()) = any (array[
    'pastor'::public.app_role,
    'administrator'::public.app_role
  ])
);

commit;
