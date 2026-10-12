'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

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
  type: 'topup' | 'purchase' | 'refund' | 'adjustment' | 'debt_repayment'
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
    const activeById = new Map(active.map((student) => [student.id, student]))
    const purchases = transactions.filter((transaction) => transaction.type === 'purchase' || transaction.type === 'debt_repayment')
    const spending = new Map<string, number>()
    const daily = new Map<string, number>()
    const groups = new Map<string, number>()

    for (const transaction of purchases) {
      const amount = Math.abs(Number(transaction.amount) || 0)
      spending.set(transaction.student_id, (spending.get(transaction.student_id) || 0) + amount)
      const date = new Date(transaction.created_at)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      daily.set(key, (daily.get(key) || 0) + amount)
      const group = activeById.get(transaction.student_id)?.class_name || 'ไม่ระบุกลุ่ม'
      groups.set(group, (groups.get(group) || 0) + amount)
    }

    const top = [...spending.entries()]
      .map(([id, amount]) => ({ student: activeById.get(id), amount }))
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


  type TodayOrder = {
    id: string
    student_id: string
    total: number
    created_at: string
  }
  type TodayOrderItem = {
    id: string
    order_id: string
    product_name: string
    quantity: number
    unit_price: number
    subtotal: number
  }

  const [todayOrders, setTodayOrders] = useState<TodayOrder[]>([])
  const [todayItems, setTodayItems] = useState<TodayOrderItem[]>([])
  const [todayLoading, setTodayLoading] = useState(true)
  const [todayError, setTodayError] = useState('')

  const loadTodaySales = useCallback(async () => {
    if (!supabase) {
      setTodayError('ไม่สามารถเชื่อมต่อฐานข้อมูลได้')
      setTodayLoading(false)
      return
    }

    setTodayLoading(true)
    setTodayError('')
    try {
      // กำหนดขอบเขตวันตามเวลาไทย แล้วแปลงเป็น ISO เพื่อค้นหา created_at แบบ timestamptz
      const dateParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date())
      const part = (type: string) => dateParts.find((item) => item.type === type)?.value || ''
      const todayKey = `${part('year')}-${part('month')}-${part('day')}`
      const [year, month, day] = todayKey.split('-').map(Number)
      const tomorrowDate = new Date(Date.UTC(year, month - 1, day + 1))
      const tomorrowKey = `${tomorrowDate.getUTCFullYear()}-${String(tomorrowDate.getUTCMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getUTCDate()).padStart(2, '0')}`
      const startIso = `${todayKey}T00:00:00+07:00`
      const endIso = `${tomorrowKey}T00:00:00+07:00`

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id,student_id,total,created_at')
        .eq('status', 'paid')
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .order('created_at', { ascending: false })

      if (ordersError) throw ordersError
      const orders = (ordersData || []) as TodayOrder[]
      setTodayOrders(orders)

      if (orders.length === 0) {
        setTodayItems([])
        return
      }

      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('id,order_id,product_name,quantity,unit_price,subtotal')
        .in('order_id', orders.map((order) => order.id))
        .order('product_name', { ascending: true })

      if (itemsError) throw itemsError
      setTodayItems((itemsData || []) as TodayOrderItem[])
    } catch (error) {
      setTodayError(error instanceof Error ? error.message : String(error))
      setTodayOrders([])
      setTodayItems([])
    } finally {
      setTodayLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTodaySales()
  }, [loadTodaySales, transactions])

  const todaySummary = useMemo(() => {
    const products = new Map<string, { name: string; quantity: number; amount: number }>()
    const studentSpend = new Map<string, number>()
    for (const item of todayItems) {
      const name = item.product_name || 'สินค้าไม่ระบุชื่อ'
      const current = products.get(name) || { name, quantity: 0, amount: 0 }
      current.quantity += Number(item.quantity) || 0
      current.amount += Number(item.subtotal) || 0
      products.set(name, current)
    }
    for (const order of todayOrders) {
      studentSpend.set(order.student_id, (studentSpend.get(order.student_id) || 0) + (Number(order.total) || 0))
    }
    const bestProducts = [...products.values()].sort((a, b) => b.quantity - a.quantity || b.amount - a.amount)
    const topStudents = [...studentSpend.entries()]
      .map(([studentId, amount]) => ({
        student: students.find((item) => item.id === studentId),
        amount,
      }))
      .filter((entry) => entry.student)
      .sort((a, b) => b.amount - a.amount)
    return {
      totalAmount: todayOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0),
      orderCount: todayOrders.length,
      quantity: todayItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
      bestProducts,
      topStudents,
      missingStudents: [...studentSpend.keys()].filter((id) => !students.some((student) => student.id === id)).length,
    }
  }, [todayOrders, todayItems, students])

  return (
    <div className="dashboard-layout">
      <div className="dashboard-note">📈 สรุปจากธุรกรรม {transactions.length} รายการล่าสุดที่ระบบโหลดไว้ ตัวเลขจะอัปเดตเมื่อข้อมูลรีเฟรช</div>
      <div className="dashboard-kpis">
        <div className="dashboard-kpi"><span>👨‍🎓 นักเรียนที่ใช้งาน</span><strong>{data.activeCount}</strong><small>บัญชีที่เปิดใช้งาน</small></div>
        <div className="dashboard-kpi"><span>🛍️ ยอดใช้จ่ายรวม</span><strong>฿{money(data.totalSpend)}</strong><small>รวมรายการซื้อและยอดชำระคืนที่อนุมัติแล้ว</small></div>
        <div className="dashboard-kpi"><span>🧾 จำนวนครั้งที่ซื้อ</span><strong>{data.purchaseCount}</strong><small>รายการซื้อและชำระคืนที่อนุมัติ</small></div>
        <div className="dashboard-kpi warning"><span>⚠️ ยอดเงินต่ำกว่า ฿20</span><strong>{data.lowBalance}</strong><small>ควรตรวจสอบหรือเติมเงิน</small></div>
      </div>


      <section className="card admin-section dashboard-panel dashboard-today-panel">
        <div className="section-heading">
          <div>
            <h2>☀️ ภาพรวมการขายวันนี้</h2>
            <p className="muted">{new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · คำนวณตามเวลาไทย</p>
          </div>
          <button type="button" className="dashboard-today-refresh" onClick={() => void loadTodaySales()} disabled={todayLoading}>
            {todayLoading ? 'กำลังโหลด…' : '↻ รีเฟรช'}
          </button>
        </div>
        {todayError && <div className="dashboard-today-error">โหลดข้อมูลวันนี้ไม่สำเร็จ: {todayError}</div>}
        <div className="dashboard-today-kpis">
          <div><span>💵 ยอดขายวันนี้</span><strong>฿{money(todaySummary.totalAmount)}</strong></div>
          <div><span>🧾 คำสั่งซื้อที่ชำระแล้ว</span><strong>{todaySummary.orderCount}</strong></div>
          <div><span>🍪 จำนวนสินค้าที่ขาย</span><strong>{todaySummary.quantity.toLocaleString('th-TH')} ชิ้น</strong></div>
        </div>
        <div className="dashboard-today-columns">
          <div className="dashboard-today-list">
            <h3>🏆 สินค้าขายดีวันนี้</h3>
            <p className="dashboard-today-caption">จัดอันดับตามจำนวนชิ้นที่ขายได้</p>
            {todayLoading ? <div className="dashboard-empty">กำลังโหลดข้อมูลสินค้า…</div> : todaySummary.bestProducts.length === 0 ? <div className="dashboard-empty">วันนี้ยังไม่มีสินค้าที่ขายสำเร็จ</div> : (
              <div className="dashboard-today-product-list">
                {todaySummary.bestProducts.slice(0, 10).map((product, index) => (
                  <div className="dashboard-today-product-row" key={product.name}>
                    <span className={`dashboard-today-rank rank-${index + 1}`}>{index + 1}</span>
                    <div className="dashboard-today-product-info">
                      <strong>{product.name}</strong>
                      <div className="dashboard-bar-track"><span style={{ width: `${Math.max(3, product.quantity / Math.max(1, todaySummary.bestProducts[0]?.quantity || 1) * 100)}%` }} /></div>
                    </div>
                    <div className="dashboard-today-product-values"><b>{product.quantity.toLocaleString('th-TH')} ชิ้น</b><small>฿{money(product.amount)}</small></div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="dashboard-today-list">
            <h3>👧 เด็กที่ใช้เงินวันนี้</h3>
            <p className="dashboard-today-caption">เรียงจากยอดใช้จ่ายมากไปน้อย</p>
            {todayLoading ? <div className="dashboard-empty">กำลังโหลดข้อมูลนักเรียน…</div> : todaySummary.topStudents.length === 0 ? <div className="dashboard-empty">วันนี้ยังไม่มีรายการใช้จ่าย</div> : (
              <div className="dashboard-today-student-list">
                {todaySummary.topStudents.map(({ student, amount }, index) => student && (
                  <div className="dashboard-today-student-row" key={student.id}>
                    <span className={`dashboard-today-rank rank-${index + 1}`}>{index + 1}</span>
                    {student.photo_url ? <img src={student.photo_url} alt="" loading="lazy" decoding="async" /> : <span className="dashboard-today-student-avatar">👤</span>}
                    <div className="dashboard-today-student-info"><strong>{student.full_name}</strong><small>{student.student_code} · {student.class_name || 'ไม่ระบุกลุ่ม'}</small></div>
                    <b>฿{money(amount)}</b>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

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
        .dashboard-today-panel { grid-column: 1 / -1; border-color: #bae6fd; background: linear-gradient(145deg, #ffffff, #f0f9ff); }
        .dashboard-today-refresh { min-height: 40px; padding: 8px 13px; border: 1px solid #bae6fd; border-radius: 11px; background: #fff; color: #0369a1; font: inherit; font-size: 12px; font-weight: 800; cursor: pointer; }
        .dashboard-today-refresh:disabled { opacity: .6; cursor: wait; }
        .dashboard-today-error { margin-bottom: 12px; padding: 10px 12px; border-radius: 10px; background: #fef2f2; color: #b91c1c; font-size: 12px; overflow-wrap: anywhere; }
        .dashboard-today-kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
        .dashboard-today-kpis > div { display: grid; gap: 8px; min-width: 0; padding: 16px; border: 1px solid #e0f2fe; border-radius: 15px; background: #fff; }
        .dashboard-today-kpis span { color: #64748b; font-size: 12px; font-weight: 800; }
        .dashboard-today-kpis strong { color: #0369a1; font-size: clamp(20px, 2vw, 28px); font-weight: 900; overflow-wrap: anywhere; }
        .dashboard-today-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
        .dashboard-today-list { min-width: 0; padding: 16px; border: 1px solid #e2e8f0; border-radius: 16px; background: #fff; }
        .dashboard-today-list h3 { margin: 0; color: #172033; font-size: 16px; font-weight: 900; }
        .dashboard-today-caption { margin: 5px 0 14px; color: #64748b; font-size: 11px; }
        .dashboard-today-product-list, .dashboard-today-student-list { display: grid; gap: 12px; }
        .dashboard-today-product-row, .dashboard-today-student-row { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .dashboard-today-rank { display: grid; place-items: center; width: 27px; height: 27px; flex: 0 0 27px; border-radius: 9px; background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 900; }
        .dashboard-today-rank.rank-1 { background: #fef3c7; color: #92400e; }
        .dashboard-today-rank.rank-2 { background: #e2e8f0; color: #334155; }
        .dashboard-today-rank.rank-3 { background: #ffedd5; color: #9a3412; }
        .dashboard-today-product-info { flex: 1; min-width: 0; }
        .dashboard-today-product-info strong { display: block; overflow: hidden; color: #334155; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
        .dashboard-today-product-info .dashboard-bar-track { margin-top: 6px; }
        .dashboard-today-product-values { display: grid; justify-items: end; gap: 3px; white-space: nowrap; }
        .dashboard-today-product-values b { color: #0369a1; font-size: 12px; }
        .dashboard-today-product-values small { color: #64748b; font-size: 11px; }
        .dashboard-today-student-row img, .dashboard-today-student-avatar { display: grid; place-items: center; width: 38px; height: 38px; flex: 0 0 38px; border-radius: 12px; object-fit: cover; background: #ede9fe; }
        .dashboard-today-student-avatar { font-size: 21px; }
        .dashboard-today-student-info { flex: 1; min-width: 0; }
        .dashboard-today-student-info strong, .dashboard-today-student-info small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dashboard-today-student-info strong { color: #334155; font-size: 13px; }
        .dashboard-today-student-info small { margin-top: 3px; color: #64748b; font-size: 10px; }
        .dashboard-today-student-row > b { color: #be123c; font-size: 13px; white-space: nowrap; }
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
        @media (max-width: 900px) { .dashboard-today-columns { grid-template-columns: 1fr; } .dashboard-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } .dashboard-grid { grid-template-columns: 1fr; } }
        @media (max-width: 480px) { .dashboard-today-panel { padding: 14px; } .dashboard-today-kpis { gap: 7px; } .dashboard-today-kpis > div { padding: 10px; } .dashboard-today-kpis span { font-size: 10px; } .dashboard-today-kpis strong { font-size: 17px; } .dashboard-today-list { padding: 12px; } .dashboard-today-student-row { gap: 7px; } .dashboard-today-student-row img, .dashboard-today-student-avatar { width: 32px; height: 32px; flex-basis: 32px; } .dashboard-today-student-row > b { font-size: 11px; } .dashboard-panel { padding: 16px; } .dashboard-panel .section-heading h2 { font-size: 17px; } .dashboard-kpi { padding: 14px; } .dashboard-kpi span { font-size: 12px; } .dashboard-kpi strong { font-size: 22px; } .dashboard-rank-row { gap: 8px; } .dashboard-rank-row img, .dashboard-rank-avatar { width: 38px; height: 38px; flex-basis: 38px; } .dashboard-rank-amount { font-size: 12px; } .dashboard-chart { gap: 4px; } .dashboard-chart-column strong { font-size: 9px; } .dashboard-chart-column small { font-size: 9px; } }
      `}</style>
    </div>
  )
}