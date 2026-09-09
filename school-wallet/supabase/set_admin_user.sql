-- School Wallet: ตั้งค่าสิทธิ์ Admin ให้กับผู้ใช้งานใน Supabase Auth
-- วิธีใช้งาน:
-- 1. เปิด Supabase Dashboard -> SQL Editor
-- 2. เปลี่ยน 'admin@school.com' ด้านล่างให้เป็นอีเมลของผู้ดูแลระบบที่ต้องการให้สิทธิ์
-- 3. กด Run

-- 1) ตั้งค่า role = 'admin' ทั้งใน app_metadata และ user_metadata เพื่อความครอบคลุม
update auth.users
set 
  raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb,
  raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
where email = 'admin@school.com'; -- <-- ใส่อีเมล Admin ของคุณตรงนี้

-- 2) ตรวจสอบผลลัพธ์
select id, email, raw_app_meta_data, raw_user_meta_data, created_at
from auth.users
where email = 'admin@school.com'; -- <-- ใส่อีเมล Admin ของคุณตรงนี้
