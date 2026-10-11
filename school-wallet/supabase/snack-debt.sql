-- Shine Wallet: ระบบติดเงินค่าขนมและอนุมัติรับชำระ
-- รันไฟล์นี้ใน Supabase SQL Editor ก่อนเปิดใช้งานเมนูติดเงินค่าขนม

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in ('paid', 'cancelled', 'credit'));

alter table public.wallet_transactions drop constraint if exists wallet_transactions_type_check;
alter table public.wallet_transactions add constraint wallet_transactions_type_check check(type in('topup','purchase','refund','adjustment','debt_repayment'));

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

