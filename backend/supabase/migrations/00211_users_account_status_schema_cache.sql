-- Repair databases where the Operations Studio user migration was applied
-- incompletely, then make PostgREST see the repaired schema immediately.

alter table public.users
  add column if not exists account_status text;

update public.users
set account_status = case status::text
  when 'Active' then 'ACTIVE'
  else 'INACTIVE'
end
where account_status is null;

alter table public.users drop constraint if exists users_account_status_check;
alter table public.users add constraint users_account_status_check
  check (account_status in ('INVITED', 'ACTIVE', 'INACTIVE', 'SUSPENDED'));

notify pgrst, 'reload schema';
