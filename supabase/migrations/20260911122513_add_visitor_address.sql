-- Adds optional contact-location support without rewriting or removing any
-- existing visitor values. The legacy preferred_name column remains intact.
alter table if exists public.visitors
  add column if not exists address text;

comment on column public.visitors.address is
  'Optional visitor mailing or street address supplied through Church Care Hub.';
