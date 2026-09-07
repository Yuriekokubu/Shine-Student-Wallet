# School Wallet

Web App สำหรับโรงเรียน ใช้ QR ประจำตัวนักเรียนเป็นกระเป๋าเงินดิจิทัลสำหรับซื้อขนม/สินค้า โดยใช้ Supabase เป็นฐานข้อมูล

## Routes
- `/` หน้ากระเป๋านักเรียนและซื้อสินค้า
- `/kiosk` จุดขายสำหรับสแกน QR
- `/admin` จัดการนักเรียนและเติมเงิน

## ติดตั้ง
```bash
pnpm install
```
คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ Supabase URL และ anon key จากนั้นรัน `supabase/schema.sql` ใน Supabase SQL Editor

```bash
pnpm dev
```

## หมายเหตุด้านความปลอดภัย
โค้ดนี้เป็น MVP สำหรับเริ่มต้นพัฒนา การเติมเงินจริงควรเชื่อม Payment Gateway/PromptPay webhook และทำ Supabase Auth + RLS ตามบทบาท admin/cashier/parent/student ก่อนใช้งานจริง ห้ามเปิดสิทธิ์ให้ client เพิ่มยอดเงินโดยตรงใน production