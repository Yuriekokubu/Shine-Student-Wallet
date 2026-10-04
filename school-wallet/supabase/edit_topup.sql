-- อนุญาตให้แก้รายการเติมเงินเป็น 0 ได้
-- รันไฟล์นี้ใน Supabase SQL Editor หลังจากอัปเดตโค้ดหน้า Admin

alter table public.wallet_transactions
  drop constraint if exists wallet_transactions_amount_check;

alter table public.wallet_transactions
  add constraint wallet_transactions_amount_check check (amount >= 0);

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
as $$
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
$$;

revoke execute on function public.admin_edit_topup(uuid,numeric,text,text) from public, anon;
grant execute on function public.admin_edit_topup(uuid,numeric,text,text) to authenticated;
