create extension if not exists pgcrypto;
create table if not exists public.students(id uuid primary key default gen_random_uuid(),student_code text unique not null,full_name text not null,class_name text,qr_token text unique not null default encode(gen_random_bytes(16),'hex'),balance numeric(12,2) not null default 0,active boolean not null default true,created_at timestamptz not null default now());
alter table public.students add column if not exists photo_url text;
create table if not exists public.products(id uuid primary key default gen_random_uuid(),name text not null,price numeric(10,2) not null check(price>=0),stock integer not null default 0 check(stock>=0),image_url text,active boolean not null default true,created_at timestamptz not null default now());
create table if not exists public.orders(id uuid primary key default gen_random_uuid(),student_id uuid not null references public.students(id),total numeric(12,2) not null check(total>0),status text not null default 'paid' check(status in('paid','cancelled')),created_at timestamptz not null default now());
create table if not exists public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,product_id uuid references public.products(id),product_name text not null,unit_price numeric(10,2) not null,quantity integer not null check(quantity>0),subtotal numeric(12,2) not null);
alter table public.order_items alter column product_id drop not null;
create table if not exists public.wallet_transactions(id uuid primary key default gen_random_uuid(),student_id uuid not null references public.students(id),type text not null check(type in('topup','purchase','refund','adjustment')),amount numeric(12,2) not null check(amount>0),balance_before numeric(12,2) not null,balance_after numeric(12,2) not null,reference text,note text,created_at timestamptz not null default now());
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select coalesce((auth.jwt()->'app_metadata'->>'role')='admin',false); $$;
create or replace function public.topup_student(p_student_id uuid,p_amount numeric,p_reference text default null,p_note text default null) returns public.students language plpgsql security definer set search_path=public as $$ declare s public.students; begin if not public.is_admin() then raise exception 'Admin role required'; end if; if p_amount<=0 then raise exception 'Amount must be greater than zero'; end if; update students set balance=balance+p_amount where id=p_student_id and active=true returning * into s; if not found then raise exception 'Student not found or inactive'; end if; insert into wallet_transactions(student_id,type,amount,balance_before,balance_after,reference,note) values(s.id,'topup',p_amount,s.balance-p_amount,s.balance,p_reference,p_note); return s; end; $$;

-- ชำระเงินจากจุดขาย: อนุญาตเฉพาะ Admin เท่านั้น
create or replace function public.purchase_products(p_student_id uuid,p_items jsonb) returns jsonb language plpgsql security definer set search_path=public as $$ declare s public.students; item jsonb; p public.products; qty int; item_name text; item_price numeric; total numeric:=0; new_balance numeric; o public.orders; begin if not public.is_admin() then raise exception 'Admin role required'; end if; select * into s from students where id=p_student_id and active=true for update; if not found then raise exception 'Student not found or inactive'; end if; for item in select * from jsonb_array_elements(p_items) loop qty:=(item->>'quantity')::int; if qty<=0 then raise exception 'Quantity must be greater than zero'; end if; if nullif(item->>'custom_name','') is not null then item_name:=trim(item->>'custom_name'); item_price:=(item->>'custom_price')::numeric; if item_name='' or item_price is null or item_price<0 then raise exception 'Invalid custom item'; end if; else select * into p from products where id=(item->>'product_id')::uuid and active=true for update; if not found then raise exception 'Product not found'; end if; if p.stock<qty then raise exception 'Insufficient stock for %',p.name; end if; item_name:=p.name; item_price:=p.price; end if; total:=total+item_price*qty; end loop; if total<=0 or s.balance<total then raise exception 'Insufficient balance'; end if; new_balance:=s.balance-total; update students set balance=new_balance where id=s.id; insert into orders(student_id,total,status) values(s.id,total,'paid') returning * into o; for item in select * from jsonb_array_elements(p_items) loop qty:=(item->>'quantity')::int; if nullif(item->>'custom_name','') is not null then item_name:=trim(item->>'custom_name'); item_price:=(item->>'custom_price')::numeric; insert into order_items(order_id,product_id,product_name,unit_price,quantity,subtotal) values(o.id,null,item_name,item_price,qty,item_price*qty); else select * into p from products where id=(item->>'product_id')::uuid; item_name:=p.name; item_price:=p.price; update products set stock=stock-qty where id=p.id; insert into order_items(order_id,product_id,product_name,unit_price,quantity,subtotal) values(o.id,p.id,item_name,item_price,qty,item_price*qty); end if; end loop; insert into wallet_transactions(student_id,type,amount,balance_before,balance_after,reference,note) values(s.id,'purchase',total,s.balance,new_balance,o.id::text,'ซื้อสินค้าโรงเรียน'); return jsonb_build_object('order_id',o.id,'balance',new_balance,'total',total); end; $$;

-- Public student transaction history: ใช้ QR token เท่านั้น และไม่เปิด SELECT ตรงไปยัง wallet_transactions
create or replace function public.get_student_transactions_by_qr(p_qr_token text)
returns table(id uuid,student_id uuid,type text,amount numeric,balance_before numeric,balance_after numeric,reference text,note text,created_at timestamptz,items jsonb)
language sql stable security definer set search_path = public
as $$
  select wt.id,wt.student_id,wt.type,wt.amount,wt.balance_before,wt.balance_after,wt.reference,wt.note,wt.created_at,
    coalesce((select jsonb_agg(jsonb_build_object('name',oi.product_name,'quantity',oi.quantity,'unit_price',oi.unit_price,'subtotal',oi.subtotal) order by oi.id) from order_items oi where oi.order_id = case when wt.reference ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then wt.reference::uuid else null end),'[]'::jsonb) as items
  from wallet_transactions wt
  inner join students s on s.id = wt.student_id
  where s.qr_token = trim(regexp_replace(coalesce(p_qr_token, ''), '^SW:', '', 'i')) and s.active = true
  order by wt.created_at desc;
$$;

revoke all on function public.get_student_transactions_by_qr(text) from public;
grant execute on function public.get_student_transactions_by_qr(text) to anon, authenticated;

-- Public student transaction history แบบ pagination
create or replace function public.get_student_transactions_by_qr_paged(p_qr_token text,p_offset integer default 0,p_limit integer default 6)
returns table(id uuid,student_id uuid,type text,amount numeric,balance_before numeric,balance_after numeric,reference text,note text,created_at timestamptz,items jsonb)
language sql stable security definer set search_path = public
as $$
  select wt.id,wt.student_id,wt.type,wt.amount,wt.balance_before,wt.balance_after,wt.reference,wt.note,wt.created_at,
    coalesce((select jsonb_agg(jsonb_build_object('name',oi.product_name,'quantity',oi.quantity,'unit_price',oi.unit_price,'subtotal',oi.subtotal) order by oi.id) from order_items oi where oi.order_id = case when wt.reference ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then wt.reference::uuid else null end),'[]'::jsonb) as items
  from wallet_transactions wt
  inner join students s on s.id = wt.student_id
  where s.qr_token = trim(regexp_replace(coalesce(p_qr_token, ''), '^SW:', '', 'i')) and s.active = true
  order by wt.created_at desc
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 1), 1), 21);
$$;

revoke all on function public.get_student_transactions_by_qr_paged(text,integer,integer) from public;
grant execute on function public.get_student_transactions_by_qr_paged(text,integer,integer) to anon, authenticated;

alter table students enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table wallet_transactions enable row level security;
drop policy if exists "students read" on students;
drop policy if exists "students insert" on students;
drop policy if exists "students admin update" on students;
drop policy if exists "students admin delete" on students;
drop policy if exists "products read" on products;
drop policy if exists "products admin insert" on products;
drop policy if exists "products admin update" on products;
drop policy if exists "products admin delete" on products;
drop policy if exists "orders read" on orders;
drop policy if exists "order items read" on order_items;
drop policy if exists "wallet transactions read" on wallet_transactions;
create policy "students read" on students for select to anon,authenticated using(active=true);
create policy "students insert" on students for insert to authenticated with check(public.is_admin() and active=true);
create policy "students admin update" on students for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "students admin delete" on students for delete to authenticated using(public.is_admin());
create policy "products read" on products for select to anon,authenticated using(active=true);
create policy "products admin insert" on products for insert to authenticated with check(public.is_admin());
create policy "products admin update" on products for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "products admin delete" on products for delete to authenticated using(public.is_admin());
create policy "orders read" on orders for select to authenticated using(public.is_admin());
create policy "order items read" on order_items for select to authenticated using(public.is_admin());
create policy "wallet transactions read" on wallet_transactions for select to authenticated using(public.is_admin());
revoke execute on function public.topup_student(uuid,numeric,text,text) from anon,authenticated;
grant execute on function public.topup_student(uuid,numeric,text,text) to authenticated;
revoke execute on function public.purchase_products(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.purchase_products(uuid,jsonb) to authenticated;
insert into products(name,price,stock) values('นมกล่อง',10,50),('ขนมปัง',15,30),('น้ำดื่ม',7,100),('ขนมขบเคี้ยว',12,40) on conflict do nothing;
insert into storage.buckets(id,name,public) values('student-photos','student-photos',true) on conflict (id) do update set public=true;
drop policy if exists "student photos admin upload" on storage.objects;
drop policy if exists "student photos public read" on storage.objects;
drop policy if exists "student photos admin update" on storage.objects;
drop policy if exists "student photos admin delete" on storage.objects;
create policy "student photos public read" on storage.objects for select to public using(bucket_id='student-photos');
create policy "student photos admin upload" on storage.objects for insert to authenticated with check(bucket_id='student-photos' and public.is_admin());
create policy "student photos admin update" on storage.objects for update to authenticated using(bucket_id='student-photos' and public.is_admin()) with check(bucket_id='student-photos' and public.is_admin());
create policy "student photos admin delete" on storage.objects for delete to authenticated using(bucket_id='student-photos' and public.is_admin());

-- เปิด Supabase Realtime สำหรับข้อมูลหลักของ Shine Wallet
-- เพื่อให้ทุกหน้าสะท้อนยอดเงิน สินค้า และธุรกรรมที่เปลี่ยนแปลงทันที
do $
declare
  target_table text;
begin
  foreach target_table in array array['students', 'products', 'wallet_transactions'] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target_table);
    end if;
  end loop;
end $;