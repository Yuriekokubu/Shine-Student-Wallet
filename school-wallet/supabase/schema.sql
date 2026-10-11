create extension if not exists pgcrypto;
create table if not exists public.students(id uuid primary key default gen_random_uuid(),student_code text unique not null,full_name text not null,class_name text,qr_token text unique not null default encode(gen_random_bytes(16),'hex'),balance numeric(12,2) not null default 0,active boolean not null default true,created_at timestamptz not null default now());
alter table public.students add column if not exists photo_url text;
create table if not exists public.products(id uuid primary key default gen_random_uuid(),name text not null,price numeric(10,2) not null check(price>=0),stock integer not null default 0 check(stock>=0),image_url text,active boolean not null default true,created_at timestamptz not null default now());
create table if not exists public.orders(id uuid primary key default gen_random_uuid(),student_id uuid not null references public.students(id),total numeric(12,2) not null check(total>0),status text not null default 'paid' check(status in('paid','cancelled')),created_at timestamptz not null default now());
create table if not exists public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,product_id uuid references public.products(id),product_name text not null,unit_price numeric(10,2) not null,quantity integer not null check(quantity>0),subtotal numeric(12,2) not null);
alter table public.order_items alter column product_id drop not null;
create table if not exists public.wallet_transactions(id uuid primary key default gen_random_uuid(),student_id uuid not null references public.students(id),type text not null check(type in('topup','purchase','refund','adjustment','debt_repayment')),amount numeric(12,2) not null check(amount>=0),balance_before numeric(12,2) not null,balance_after numeric(12,2) not null,reference text,note text,created_at timestamptz not null default now());
alter table public.wallet_transactions drop constraint if exists wallet_transactions_type_check;
alter table public.wallet_transactions add constraint wallet_transactions_type_check check(type in('topup','purchase','refund','adjustment','debt_repayment'));
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select coalesce((auth.jwt()->'app_metadata'->>'role')='admin',false); $$;
create or replace function public.topup_student(p_student_id uuid,p_amount numeric,p_reference text default null,p_note text default null) returns public.students language plpgsql security definer set search_path=public as $$ declare s public.students; begin if not public.is_admin() then raise exception 'Admin role required'; end if; if p_amount<=0 then raise exception 'Amount must be zero or greater'; end if; update students set balance=balance+p_amount where id=p_student_id and active=true returning * into s; if not found then raise exception 'Student not found or inactive'; end if; insert into wallet_transactions(student_id,type,amount,balance_before,balance_after,reference,note) values(s.id,'topup',p_amount,s.balance-p_amount,s.balance,p_reference,p_note); return s; end; $$;

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


-- แก้ไขรายการเติมเงินย้อนหลังสำหรับ Admin
-- เมื่อแก้ยอด ระบบจะคำนวณ balance_before / balance_after ของรายการถัดไปใหม่ทั้งหมด
create or replace function public.admin_edit_topup(
  p_transaction_id uuid,
  p_amount numeric,
  p_reference text default null,
  p_note text default null
) returns public.students
language plpgsql
security definer
set search_path = public
as $
declare
  tx public.wallet_transactions;
  s public.students;
  row_tx public.wallet_transactions;
  running_balance numeric := 0;
  delta numeric;
begin
  if not public.is_admin() then
    raise exception 'Admin role required';
  end if;

  if p_amount is null or p_amount < 0 then
    raise exception 'Amount must be zero or greater';
  end if;

  select *
  into tx
  from public.wallet_transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Transaction not found';
  end if;

  if tx.type <> 'topup' then
    raise exception 'Only topup transactions can be edited';
  end if;

  select *
  into s
  from public.students
  where id = tx.student_id
  for update;

  if not found then
    raise exception 'Student not found';
  end if;

  update public.wallet_transactions
  set
    amount = p_amount,
    reference = p_reference,
    note = p_note
  where id = p_transaction_id;

  -- คำนวณยอดคงเหลือใหม่ตามลำดับธุรกรรมจริง
  for row_tx in
    select *
    from public.wallet_transactions
    where student_id = tx.student_id
    order by created_at asc, id asc
  loop
    if row_tx.type in ('topup', 'refund', 'adjustment') then
      delta := row_tx.amount;
    elsif row_tx.type = 'purchase' then
      delta := -row_tx.amount;
    elsif row_tx.type = 'debt_repayment' then
      -- การรับชำระหนี้ค่าขนมเป็นประวัติการรับเงิน ไม่เปลี่ยนยอดกระเป๋านักเรียน
      delta := 0;
    else
      raise exception 'Unsupported transaction type: %', row_tx.type;
    end if;

    if running_balance + delta < 0 then
      raise exception 'แก้ไขไม่ได้ เพราะยอดใหม่ทำให้ยอดคงเหลือติดลบหลังรายการ %', row_tx.id;
    end if;

    update public.wallet_transactions
    set
      balance_before = running_balance,
      balance_after = running_balance + delta
    where id = row_tx.id;

    running_balance := running_balance + delta;
  end loop;

  update public.students
  set balance = running_balance
  where id = tx.student_id
  returning * into s;

  return s;
end;
$;

revoke execute on function public.admin_edit_topup(uuid,numeric,text,text) from public, anon;
grant execute on function public.admin_edit_topup(uuid,numeric,text,text) to authenticated;


-- อนุญาตให้รายการเติมเงินมีจำนวน 0 ได้ (เช่น แก้รายการเติมเงินผิดจาก 100 -> 0)
-- ต้องรันส่วนนี้ใน Supabase SQL Editor หากฐานข้อมูลถูกสร้างไปแล้วก่อนหน้านี้
alter table public.wallet_transactions
  drop constraint if exists wallet_transactions_amount_check;

alter table public.wallet_transactions
  add constraint wallet_transactions_amount_check check (amount >= 0);

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

-- Include the snack-credit migration for fresh installations.
-- Shine Wallet: ระบบติดเงินค่าขนมและอนุมัติรับชำระ
-- รันไฟล์นี้ใน Supabase SQL Editor ก่อนเปิดใช้งานเมนูติดเงินค่าขนม

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in ('paid', 'cancelled', 'credit'));

create table if not exists public.snack_debts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  order_id uuid not null unique references public.orders(id),
  amount numeric(12,2) not null check (amount > 0),
  items jsonb not null default '[]'::jsonb,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  paid_by uuid references auth.users(id)
);

alter table public.snack_debts enable row level security;
drop policy if exists "snack debts admin read" on public.snack_debts;
create policy "snack debts admin read"
  on public.snack_debts for select to authenticated
  using (public.is_admin());

revoke insert, update, delete on public.snack_debts from anon, authenticated;

create or replace function public.record_snack_debt(
  p_student_id uuid,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.students;
  item jsonb;
  p public.products;
  qty integer;
  item_name text;
  item_price numeric;
  total numeric := 0;
  o public.orders;
  debt public.snack_debts;
  summary jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin role required';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'กรุณาเลือกรายการขนมก่อนบันทึกติดเงิน';
  end if;

  select * into s
  from public.students
  where id = p_student_id and active = true
  for update;

  if not found then
    raise exception 'Student not found or inactive';
  end if;

  -- ตรวจสอบรายการ ราคา และสต็อกก่อนเริ่มบันทึก
  for item in select * from jsonb_array_elements(p_items) loop
    qty := (item->>'quantity')::integer;
    if qty is null or qty <= 0 then
      raise exception 'Quantity must be greater than zero';
    end if;

    if nullif(item->>'custom_name', '') is not null then
      item_name := trim(item->>'custom_name');
      item_price := (item->>'custom_price')::numeric;
      if item_name = '' or item_price is null or item_price < 0 then
        raise exception 'Invalid custom item';
      end if;
    else
      select * into p
      from public.products
      where id = (item->>'product_id')::uuid and active = true
      for update;
      if not found then
        raise exception 'Product not found';
      end if;
      if p.stock < qty then
        raise exception 'Insufficient stock for %', p.name;
      end if;
      item_name := p.name;
      item_price := p.price;
    end if;

    total := total + item_price * qty;
  end loop;

  if total <= 0 then
    raise exception 'ยอดติดเงินต้องมากกว่า 0 บาท';
  end if;

  -- บันทึกออเดอร์เป็นเครดิต โดยไม่หักยอดเงินในกระเป๋านักเรียน
  insert into public.orders(student_id, total, status)
  values (s.id, total, 'credit')
  returning * into o;

  for item in select * from jsonb_array_elements(p_items) loop
    qty := (item->>'quantity')::integer;

    if nullif(item->>'custom_name', '') is not null then
      item_name := trim(item->>'custom_name');
      item_price := (item->>'custom_price')::numeric;
      insert into public.order_items(order_id, product_id, product_name, unit_price, quantity, subtotal)
      values (o.id, null, item_name, item_price, qty, item_price * qty);
    else
      select * into p
      from public.products
      where id = (item->>'product_id')::uuid
      for update;
      item_name := p.name;
      item_price := p.price;
      update public.products set stock = stock - qty where id = p.id;
      insert into public.order_items(order_id, product_id, product_name, unit_price, quantity, subtotal)
      values (o.id, p.id, item_name, item_price, qty, item_price * qty);
    end if;
  end loop;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', oi.product_name,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price,
        'subtotal', oi.subtotal
      ) order by oi.id
    ),
    '[]'::jsonb
  )
  into summary
  from public.order_items oi
  where oi.order_id = o.id;

  insert into public.snack_debts(student_id, order_id, amount, items)
  values (s.id, o.id, total, summary)
  returning * into debt;

  return jsonb_build_object(
    'debt_id', debt.id,
    'order_id', o.id,
    'amount', total,
    'balance', s.balance
  );
end;
$$;

create or replace function public.approve_snack_debt_payment(
  p_debt_id uuid
) returns public.snack_debts
language plpgsql
security definer
set search_path = public
as $$
declare
  debt public.snack_debts;
  student_balance numeric(12,2);
begin
  if not public.is_admin() then
    raise exception 'Admin role required';
  end if;

  update public.snack_debts
  set status = 'paid',
      paid_at = now(),
      paid_by = auth.uid()
  where id = p_debt_id
    and status = 'unpaid'
  returning * into debt;

  if not found then
    raise exception 'รายการนี้ได้รับชำระแล้ว หรือไม่พบรายการติดเงิน';
  end if;

  update public.orders
  set status = 'paid'
  where id = debt.order_id
    and status = 'credit';

  -- บันทึกการรับชำระคืนลงประวัติของนักเรียน โดยไม่เปลี่ยนยอดเงินในกระเป๋า
  select balance into student_balance
  from public.students
  where id = debt.student_id
  for update;

  insert into public.wallet_transactions (
    student_id, type, amount, balance_before, balance_after, reference, note
  ) values (
    debt.student_id,
    'debt_repayment',
    debt.amount,
    coalesce(student_balance, 0),
    coalesce(student_balance, 0),
    debt.order_id::text,
    'รับชำระเงินคืนค่าขนม'
  );

  return debt;
end;
$$;

revoke execute on function public.record_snack_debt(uuid, jsonb) from public, anon;
grant execute on function public.record_snack_debt(uuid, jsonb) to authenticated;
revoke execute on function public.approve_snack_debt_payment(uuid) from public, anon;
grant execute on function public.approve_snack_debt_payment(uuid) to authenticated;
 
-- เติมประวัติย้อนหลังสำหรับหนี้ค่าขนมที่ชำระแล้วก่อนมีการบันทึก wallet_transactions
-- ใช้ order_id เป็น reference เพื่อให้รันซ้ำได้โดยไม่สร้างรายการซ้ำ
insert into public.wallet_transactions (
  student_id,
  type,
  amount,
  balance_before,
  balance_after,
  reference,
  note,
  created_at
)
select
  debt.student_id,
  'debt_repayment',
  debt.amount,
  coalesce(student.balance, 0),
  coalesce(student.balance, 0),
  debt.order_id::text,
  'รับชำระเงินคืนค่าขนม (บันทึกย้อนหลัง)',
  coalesce(debt.paid_at, debt.created_at)
from public.snack_debts as debt
join public.students as student
  on student.id = debt.student_id
where debt.status = 'paid'
  and not exists (
    select 1
    from public.wallet_transactions as wt
    where wt.student_id = debt.student_id
      and wt.type = 'debt_repayment'
      and wt.reference = debt.order_id::text
  );

-- ให้รายการติดเงินอัปเดตแบบ Realtime ในหน้า Admin
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'snack_debts'
  ) then
    alter publication supabase_realtime add table public.snack_debts;
  end if;
end $$;


-- ลบรายการซื้อโดย Admin พร้อมคืนสต็อกและปรับยอดเงินนักเรียนใหม่
-- คำสั่งซื้อจะถูกเปลี่ยนเป็น cancelled และเก็บ order_items ไว้เป็นหลักฐาน
-- ลบรายการซื้อสินค้า หรือรายการรับชำระคืนค่าขนมที่อนุมัติแล้ว
-- ยกเลิกคำสั่งซื้อ คืนสต็อก และคำนวณยอดกระเป๋าใหม่ใน transaction เดียว
create or replace function public.admin_delete_purchase_transaction(
  p_transaction_id uuid
) returns public.students
language plpgsql
security definer
set search_path = public
as $$
declare
  tx public.wallet_transactions;
  s public.students;
  o public.orders;
  debt public.snack_debts;
  oi record;
  row_tx public.wallet_transactions;
  running_balance numeric := 0;
  delta numeric;
begin
  if not public.is_admin() then
    raise exception 'Admin role required';
  end if;

  select *
    into tx
  from public.wallet_transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'ไม่พบธุรกรรมที่ต้องการลบ';
  end if;
  if tx.type not in ('purchase', 'debt_repayment') then
    raise exception 'ลบได้เฉพาะธุรกรรมซื้อสินค้าและรับชำระคืนค่าขนม';
  end if;
  if tx.reference is null
    or tx.reference !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'ไม่พบเลขอ้างอิงคำสั่งซื้อ จึงไม่สามารถคืนสต็อกได้';
  end if;

  select *
    into o
  from public.orders
  where id = tx.reference::uuid
    and student_id = tx.student_id
  for update;

  if not found or o.status <> 'paid' then
    raise exception 'คำสั่งซื้อไม่อยู่ในสถานะที่สามารถลบได้';
  end if;

  if tx.type = 'debt_repayment' then
    select *
      into debt
    from public.snack_debts
    where order_id = o.id
      and student_id = tx.student_id
    for update;

    if not found or debt.status <> 'paid' then
      raise exception 'ไม่พบรายการหนี้ที่ชำระแล้วซึ่งเชื่อมกับธุรกรรมนี้';
    end if;
  end if;

  select *
    into s
  from public.students
  where id = tx.student_id
  for update;

  if not found then
    raise exception 'ไม่พบนักเรียนของธุรกรรมนี้';
  end if;

  -- คืนสต็อกสินค้าจริงจากรายการสินค้าในคำสั่งซื้อ
  for oi in
    select product_id, quantity
    from public.order_items
    where order_id = o.id
      and product_id is not null
    order by id
  loop
    update public.products
    set stock = stock + oi.quantity
    where id = oi.product_id;
  end loop;

  -- ยกเลิกคำสั่งซื้อเพื่อป้องกันการคืนสต็อกซ้ำ
  update public.orders
  set status = 'cancelled'
  where id = o.id;

  -- เมื่อยกเลิกรายการรับชำระคืน ให้ลบหนี้ที่ผูกกับคำสั่งซื้อที่ยกเลิกด้วย
  if tx.type = 'debt_repayment' then
    delete from public.snack_debts
    where id = debt.id;
  end if;

  delete from public.wallet_transactions
  where id = tx.id;

  -- คำนวณยอดเงินและ balance_before/after ใหม่จากธุรกรรมที่เหลือ
  for row_tx in
    select *
    from public.wallet_transactions
    where student_id = tx.student_id
    order by created_at asc, id asc
    for update
  loop
    if row_tx.type in ('topup', 'refund', 'adjustment') then
      delta := row_tx.amount;
    elsif row_tx.type = 'purchase' then
      delta := -row_tx.amount;
    elsif row_tx.type = 'debt_repayment' then
      delta := 0;
    else
      raise exception 'Unsupported transaction type: %', row_tx.type;
    end if;

    if running_balance + delta < 0 then
      raise exception 'ไม่สามารถลบรายการนี้ได้ เพราะจะทำให้ยอดเงินตามประวัติติดลบ';
    end if;

    update public.wallet_transactions
    set balance_before = running_balance,
        balance_after = running_balance + delta
    where id = row_tx.id;

    running_balance := running_balance + delta;
  end loop;

  update public.students
  set balance = running_balance
  where id = tx.student_id
  returning * into s;

  return s;
end;
$$;

revoke execute on function public.admin_delete_purchase_transaction(uuid) from public, anon;
grant execute on function public.admin_delete_purchase_transaction(uuid) to authenticated;

