'use client'

import { useMemo } from 'react'

type Student = {
  id: string
  student_code: string
  full_name: string
  class_name: string | null
  balance: number
  photo_url: string | null
  active: boolean
}

type Transaction = {
  id: string
  student_id: string
  type: 'topup' | 'purchase' | 'refund' | 'adjustment'
  amount: number
  created_at: string
}

type Props = {
  students: Student[]
  transactions: Transaction[]
  totalBalance: number
}

export default function WalletDashboard({ students, transactions, totalBalance }: Props) {
  const data = useMemo(() => {
    const active = students.filter((student) => student.active)
    const purchases = transactions.filter((transaction) => transaction.type === 'purchase')
    const spending = new Map<string, number>()
    const daily = new Map<string, number>()
    const groups = new Map<string, number>()

    for (const transaction of purchases) {
      const amount = Math.abs(Number(transaction.amount) || 0)
      spending.set(transaction.student_id, (spending.get(transaction.student_id) || 0) + amount)
      const date = new Date(transaction.created_at)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      daily.set(key, (daily.get(key) || 0) + amount)
      const group = active.find((student) => student.id === transaction.student_id)?.class_name || 'ไม่ระบุกลุ่ม'
      groups.set(group, (groups.get(group) || 0) + amount)
    }

    const top = [...spending.entries()]
      .map(([id, amount]) => ({ student: active.find((student) => student.id === id), amount }))
      .filter((item) => item.student)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)

    const today = new Date()
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      return { key, label: date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }), amount: daily.get(key) || 0 }
    })

    return {
      activeCount: active.length,
      lowBalance: active.filter((student) => Number(student.balance) < 20).length,
      top,
      days,
      maxDay: Math.max(1, ...days.map((day) => day.amount)),
      groups: [...groups.entries()].map(([group, amount]) => ({ group, amount })).sort((a, b) => b.amount - a.amount),
      totalSpend: purchases.reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount) || 0), 0),
      purchaseCount: purchases.length,
    }
  }, [students, transactions])

  const money = (amount: number) => amount.toLocaleString('th-TH', { maximumFractionDigits: 2 })

  return (
    <div className="dashboard-layout">
      <div className="dashboard-note">📈 สรุปจากธุรกรรม {transactions.length} รายการล่าสุดที่ระบบโหลดไว้ ตัวเลขจะอัปเดตเมื่อข้อมูลรีเฟรช</div>
      <div className="dashboard-kpis">
        <div className="dashboard-kpi"><span>👨‍🎓 นักเรียนที่ใช้งาน</span><strong>{data.activeCount}</strong><small>บัญชีที่เปิดใช้งาน</small></div>
        <div className="dashboard-kpi"><span>🛍️ ยอดใช้จ่ายรวม</span><strong>฿{money(data.totalSpend)}</strong><small>จากรายการซื้อที่โหลดอยู่</small></div>
        <div className="dashboard-kpi"><span>🧾 จำนวนครั้งที่ซื้อ</span><strong>{data.purchaseCount}</strong><small>ธุรกรรมซื้อสินค้า</small></div>
        <div className="dashboard-kpi warning"><span>⚠️ ยอดเงินต่ำกว่า ฿20</span><strong>{data.lowBalance}</strong><small>ควรตรวจสอบหรือเติมเงิน</small></div>
      </div>

      <div className="dashboard-grid">
        <section className="card admin-section dashboard-panel">
          <div className="section-heading"><div><h2>🏆 นักเรียนใช้เงินมากที่สุด</h2><p className="muted">อันดับตามยอดซื้อในข้อมูลที่โหลดอยู่</p></div></div>
          {!data.top.length ? <div className="dashboard-empty">ยังไม่มีรายการซื้อสินค้าให้จัดอันดับ</div> : <div className="dashboard-ranking">
            {data.top.map((item, index) => item.student && (
              <div className="dashboard-rank-row" key={item.student.id}>
                <span className={`dashboard-rank-number rank-${index + 1}`}>{index + 1}</span>
                {item.student.photo_url ? <img src={item.student.photo_url} alt="" loading="lazy" decoding="async" /> : <span className="dashboard-rank-avatar">👤</span>}
                <div className="dashboard-rank-info"><strong>{item.student.full_name}</strong><small>{item.student.student_code} · {item.student.class_name || 'ไม่ระบุกลุ่ม'}</small><div className="dashboard-bar-track"><span style={{ width: `${Math.max(4, item.amount / Math.max(1, data.top[0]?.amount || 1) * 100)}%` }} /></div></div>
                <b className="dashboard-rank-amount">฿{money(item.amount)}</b>
              </div>
            ))}
          </div>}
        </section>

        <section className="card admin-section dashboard-panel">
          <div className="section-heading"><div><h2>📅 ยอดซื้อรายวัน</h2><p className="muted">7 วันล่าสุด</p></div></div>
          <div className="dashboard-chart" role="img" aria-label="กราฟยอดซื้อรายวัน 7 วันล่าสุด">
            {data.days.map((day) => <div className="dashboard-chart-column" key={day.key}>
              <strong>฿{money(day.amount)}</strong>
              <div className="dashboard-chart-bar-wrap"><span style={{ height: `${day.amount ? Math.max(5, day.amount / data.maxDay * 100) : 0}%` }} /></div>
              <small>{day.label}</small>
            </div>)}
          </div>
        </section>

        <section className="card admin-section dashboard-panel">
          <div className="section-heading"><div><h2>👥 ยอดใช้จ่ายตามกลุ่ม</h2><p className="muted">เปรียบเทียบแต่ละกลุ่มเด็ก</p></div></div>
          {!data.groups.length ? <div className="dashboard-empty">ยังไม่มีข้อมูลยอดซื้อ</div> : <div className="dashboard-group-list">
            {data.groups.map((group) => <div className="dashboard-group-row" key={group.group}>
              <div><strong>{group.group}</strong><b>฿{money(group.amount)}</b></div>
              <div className="dashboard-bar-track"><span style={{ width: `${Math.max(2, group.amount / Math.max(1, data.groups[0]?.amount || 1) * 100)}%` }} /></div>
            </div>)}
          </div>}
        </section>

        <section className="card admin-section dashboard-panel">
          <div className="section-heading"><div><h2>💡 ข้อสังเกตสำหรับ Admin</h2><p className="muted">ตัวช่วยดูแลเงินในกระเป๋านักเรียน</p></div></div>
          <div className="dashboard-insights">
            <div><span>🟠</span><p><strong>{data.lowBalance} คน</strong><small>ยอดเงินคงเหลือต่ำกว่า ฿20</small></p></div>
            <div><span>💰</span><p><strong>฿{money(totalBalance / Math.max(1, data.activeCount))}</strong><small>ยอดเงินคงเหลือเฉลี่ยต่อนักเรียน</small></p></div>
            <div><span>🔄</span><p><strong>{transactions.length} รายการ</strong><small>ธุรกรรมที่นำมาคำนวณในหน้านี้</small></p></div>
          </div>
          <p className="dashboard-footnote">หมายเหตุ: การจัดอันดับนี้คำนวณจากธุรกรรมที่โหลดไว้เท่านั้น ยังไม่ใช่ยอดสะสมตลอดกาล</p>
        </section>
      </div>

      <style jsx>{`
        .dashboard-layout { display: grid; gap: 16px; }
        .dashboard-note { padding: 12px 16px; border: 1px solid #c7d2fe; border-radius: 14px; background: #eef2ff; color: #3730a3; font-size: 13px; font-weight: 700; }
        .dashboard-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
        .dashboard-kpi { display: flex; flex-direction: column; gap: 8px; min-width: 0; padding: 19px; border: 1px solid #e2e8f0; border-radius: 20px; background: linear-gradient(145deg, #fff, #f8fafc); box-shadow: 0 5px 16px rgba(15,23,42,.04); }
        .dashboard-kpi span { color: #64748b; font-size: 13px; font-weight: 800; }
        .dashboard-kpi strong { color: #172033; font-size: clamp(22px, 2.3vw, 30px); font-weight: 900; overflow-wrap: anywhere; }
        .dashboard-kpi small { color: #94a3b8; font-size: 12px; }
        .dashboard-kpi.warning { border-color: #fed7aa; background: linear-gradient(145deg, #fff, #fff7ed); }
        .dashboard-kpi.warning strong { color: #c2410c; }
        .dashboard-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: stretch; gap: 16px; }
        .dashboard-panel { min-width: 0; margin: 0; padding: 22px; overflow: hidden; border: 1px solid #e2e8f0; border-radius: 20px; background: #fff; box-shadow: 0 8px 24px rgba(15,23,42,.05); }
        .dashboard-panel .section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 20px; }
        .dashboard-panel .section-heading h2 { margin: 0; color: #172033; font-size: 19px; font-weight: 900; }
        .dashboard-panel .section-heading p { margin: 6px 0 0; color: #64748b; font-size: 12px; line-height: 1.5; }
        .dashboard-ranking { display: grid; gap: 14px; }
        .dashboard-rank-row { display: flex; align-items: center; gap: 11px; min-width: 0; }
        .dashboard-rank-number { display: grid; place-items: center; width: 30px; height: 30px; flex: 0 0 30px; border-radius: 10px; background: #f1f5f9; color: #475569; font-size: 13px; font-weight: 900; }
        .dashboard-rank-number.rank-1 { background: #fef3c7; color: #92400e; }
        .dashboard-rank-number.rank-2 { background: #e2e8f0; color: #334155; }
        .dashboard-rank-number.rank-3 { background: #ffedd5; color: #9a3412; }
        .dashboard-rank-row img, .dashboard-rank-avatar { display: grid; place-items: center; width: 44px; height: 44px; flex: 0 0 44px; border-radius: 14px; object-fit: cover; background: #ede9fe; }
        .dashboard-rank-avatar { font-size: 23px; }
        .dashboard-rank-info { flex: 1; min-width: 0; }
        .dashboard-rank-info strong, .dashboard-rank-info small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dashboard-rank-info strong { color: #172033; font-size: 14px; }
        .dashboard-rank-info small { margin-top: 3px; color: #64748b; font-size: 11px; }
        .dashboard-bar-track { height: 7px; margin-top: 8px; overflow: hidden; border-radius: 99px; background: #e2e8f0; }
        .dashboard-bar-track span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #6366f1, #8b5cf6); }
        .dashboard-rank-amount { color: #4f46e5; font-size: 14px; white-space: nowrap; }
        .dashboard-chart { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; height: 230px; padding-top: 8px; }
        .dashboard-chart-column { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 8px; min-width: 0; }
        .dashboard-chart-column strong { color: #475569; font-size: 10px; white-space: nowrap; }
        .dashboard-chart-bar-wrap { display: flex; align-items: flex-end; justify-content: center; width: 100%; height: 145px; border-radius: 10px 10px 4px 4px; background: #f1f5f9; overflow: hidden; }
        .dashboard-chart-bar-wrap span { display: block; width: min(70%, 30px); min-height: 0; border-radius: 8px 8px 2px 2px; background: linear-gradient(180deg, #818cf8, #4f46e5); transition: height .25s ease; }
        .dashboard-chart-column small { color: #64748b; font-size: 10px; white-space: nowrap; }
        .dashboard-group-list { display: grid; gap: 18px; }
        .dashboard-group-row > div:first-child { display: flex; justify-content: space-between; gap: 10px; color: #334155; font-size: 13px; }
        .dashboard-group-row > div:first-child b { color: #4f46e5; }
        .dashboard-insights { display: grid; gap: 12px; }
        .dashboard-insights > div { display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 14px; background: #f8fafc; }
        .dashboard-insights > div > span { font-size: 24px; }
        .dashboard-insights p { display: grid; gap: 3px; margin: 0; }
        .dashboard-insights strong { color: #172033; font-size: 15px; }
        .dashboard-insights small { color: #64748b; font-size: 12px; }
        .dashboard-footnote { margin: 16px 0 0; color: #94a3b8; font-size: 11px; line-height: 1.6; }
        .dashboard-empty { padding: 28px 12px; color: #94a3b8; text-align: center; font-size: 13px; }
        @media (max-width: 900px) { .dashboard-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } .dashboard-grid { grid-template-columns: 1fr; } }
        @media (max-width: 480px) { .dashboard-panel { padding: 16px; } .dashboard-panel .section-heading h2 { font-size: 17px; } .dashboard-kpi { padding: 14px; } .dashboard-kpi span { font-size: 12px; } .dashboard-kpi strong { font-size: 22px; } .dashboard-rank-row { gap: 8px; } .dashboard-rank-row img, .dashboard-rank-avatar { width: 38px; height: 38px; flex-basis: 38px; } .dashboard-rank-amount { font-size: 12px; } .dashboard-chart { gap: 4px; } .dashboard-chart-column strong { font-size: 9px; } .dashboard-chart-column small { font-size: 9px; } }
      `}</style>
    </div>
  )
}