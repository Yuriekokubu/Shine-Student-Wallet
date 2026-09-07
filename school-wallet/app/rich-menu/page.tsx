'use client'

import { useState } from 'react'
import Link from 'next/link'

const items = [
  {
    icon: '📷',
    title: 'สแกน QR นักเรียน',
    desc: 'สแกน QR เพื่อเลือกเด็ก',
    href: '/kiosk',
  },
  {
    icon: '💰',
    title: 'เติมเงิน',
    desc: 'เติมเงินเข้ากระเป๋านักเรียน',
    href: '/kiosk',
  },
  {
    icon: '👤',
    title: 'ข้อมูลนักเรียน',
    desc: 'ดูชื่อ ชั้น และยอดคงเหลือ',
    href: '/kiosk',
  },
  {
    icon: '📜',
    title: 'ประวัติธุรกรรม',
    desc: 'ดูรายการเติมเงินและซื้อสินค้า',
    href: '/kiosk',
  },
]

export default function RichMenuPage() {
  const [selected, setSelected] = useState(0)

  return (
    <main className="shell">
      <div className="topbar">
        <div>
          <div className="brand">📱 School Wallet</div>
          <div className="muted">Rich Menu สำหรับผู้ปกครองและครู</div>
        </div>
        <Link href="/" className="btn dark">
          หน้าหลัก
        </Link>
      </div>

      <div className="card" style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ textAlign: 'center' }}>Rich Menu</h1>
        <p className="muted" style={{ textAlign: 'center' }}>
          เลือกเมนูเพื่อเข้าสู่ระบบ School Wallet
        </p>

        <div
          style={{
            margin: '24px auto',
            maxWidth: 600,
            borderRadius: 24,
            overflow: 'hidden',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: '#172033',
            padding: 8,
            gap: 8,
          }}
        >
          {items.map((item, index) => (
            <Link
              key={item.title}
              href={item.href}
              onClick={() => setSelected(index)}
              style={{
                minHeight: 170,
                borderRadius: 18,
                padding: 24,
                textDecoration: 'none',
                color: 'white',
                background: index === selected ? '#4f46e5' : '#263148',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                transition: 'transform .15s, background .15s',
              }}
            >
              <div style={{ fontSize: 52 }}>{item.icon}</div>
              <strong style={{ fontSize: 20, marginTop: 8 }}>
                {item.title}
              </strong>
              <span style={{ fontSize: 14, opacity: 0.82, marginTop: 5 }}>
                {item.desc}
              </span>
            </Link>
          ))}
        </div>

        <div className="notice">
          <b>การใช้งาน</b>
          <div style={{ marginTop: 6 }}>
            กด “สแกน QR นักเรียน” แล้วสแกน QR ของเด็ก จากนั้นระบบจะแสดงข้อมูลและยอดเงินของนักเรียน
          </div>
          <div style={{ marginTop: 6 }}>
            เมื่อต้องการเติมเงินจริง ให้เข้าสู่เมนูเติมเงินจากหน้าจอ Admin ซึ่งมีการตรวจสอบสิทธิ์ผู้ดูแล
          </div>
        </div>
      </div>
    </main>
  )
}
