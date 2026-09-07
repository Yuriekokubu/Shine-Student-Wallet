-- School Wallet: FINAL fix for Admin deactivate student
-- Run this ENTIRE file in Supabase SQL Editor.

-- 1) Make sure students is not forced into RLS for the SECURITY DEFINER function.
alter table public.students enable row level security;
alter table public.students no force row level security;

-- 2) Admin checker.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce((auth.jwt()->'app_metadata'->>'role') = 'admin', false);
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 3) Re-create the deactivate function.
-- SECURITY DEFINER means this UPDATE is executed with the function owner's privileges.
create or replace function public.admin_deactivate_student(p_student_id uuid)
returns public.students
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.students;
begin
  if not public.is_admin() then
    raise exception 'Admin role required';
  end if;

  update public.students
  set active = false
  where id = p_student_id
  returning * into s;

  if not found then
    raise exception 'Student not found';
  end if;

  return s;
end;
$$;

-- Ensure the function is owned by the database owner so SECURITY DEFINER can bypass RLS.
alter function public.admin_deactivate_student(uuid) owner to postgres;

revoke all on function public.admin_deactivate_student(uuid) from public;
grant execute on function public.admin_deactivate_student(uuid) to authenticated;

-- 4) Keep normal admin UPDATE/DELETE policies correct.
drop policy if exists "students admin update" on public.students;
drop policy if exists "students admin delete" on public.students;

create policy "students admin update"
on public.students
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "students admin delete"
on public.students
for delete
to authenticated
using (public.is_admin());

-- 5) Verify after running.
select
  p.oid::regprocedure as function_name,
  p.prosecdef as security_definer,
  r.rolname as function_owner
from pg_proc p
join pg_roles r on r.oid = p.proowner
where p.oid = 'public.admin_deactivate_student(uuid)'::regprocedure;

select
  relname,
  relrowsecurity,
  relforcerowsecurity
from pg_class
where oid = 'public.students'::regclass;