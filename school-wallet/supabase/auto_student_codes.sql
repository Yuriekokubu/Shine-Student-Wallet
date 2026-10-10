-- Shine Wallet: สร้างรหัสนักเรียนอัตโนมัติเป็น sh0001, sh0002, ...
-- รันไฟล์นี้เพียงครั้งเดียวใน Supabase SQL Editor
-- นักเรียนเดิมจะถูกเรียงตาม created_at จากเก่าสุดไปใหม่สุด
-- รวมทั้งนักเรียนที่ inactive เพื่อไม่ให้รหัสเดิมถูกนำกลับมาใช้ซ้ำ

begin;

lock table public.students in access exclusive mode;

create sequence if not exists public.student_code_seq;

-- เปลี่ยนรหัสเดิมเป็นค่าชั่วคราวก่อน เพื่อหลีกเลี่ยงการชนกับ unique constraint
update public.students
set student_code = '__student_code_migration__' || id::text;

-- กำหนดรหัสใหม่ตามวันที่สร้าง จากเก่าสุดเป็น sh0001
with ranked_students as (
  select
    id,
    row_number() over (order by created_at asc, id asc) as row_number
  from public.students
)
update public.students as student
set student_code = 'sh' || lpad(ranked_students.row_number::text, 4, '0')
from ranked_students
where student.id = ranked_students.id;

-- ตั้ง sequence ให้รหัสนักเรียนใหม่เริ่มต่อจากจำนวนที่มีอยู่
do $$
declare
  student_count bigint;
begin
  select count(*) into student_count from public.students;

  if student_count = 0 then
    perform setval('public.student_code_seq', 1, false);
  else
    perform setval('public.student_code_seq', student_count, true);
  end if;
end;
$$;

create or replace function public.generate_student_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.student_code := 'sh' || lpad(nextval('public.student_code_seq')::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists students_generate_student_code on public.students;

create trigger students_generate_student_code
before insert on public.students
for each row
execute function public.generate_student_code();

commit;
