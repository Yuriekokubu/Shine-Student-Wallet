-- School Wallet: Admin product operations
-- Run this whole file in Supabase SQL Editor.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce((auth.jwt()->'app_metadata'->>'role')='admin',false);
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.admin_deactivate_product(p_product_id uuid)
returns public.products
language plpgsql
security definer
set search_path=public
as $$
declare
  p public.products;
begin
  if not public.is_admin() then
    raise exception 'Admin role required';
  end if;

  update public.products
  set active = false
  where id = p_product_id
  returning * into p;

  if not found then
    raise exception 'Product not found';
  end if;

  return p;
end;
$$;

revoke all on function public.admin_deactivate_product(uuid) from public;
grant execute on function public.admin_deactivate_product(uuid) to authenticated;

alter table public.products enable row level security;

drop policy if exists "products read" on public.products;
drop policy if exists "products admin insert" on public.products;
drop policy if exists "products admin update" on public.products;
drop policy if exists "products admin delete" on public.products;

create policy "products read"
on public.products
for select
to anon, authenticated
using (active = true);

create policy "products admin insert"
on public.products
for insert
to authenticated
with check (public.is_admin());

create policy "products admin update"
on public.products
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "products admin delete"
on public.products
for delete
to authenticated
using (public.is_admin());
