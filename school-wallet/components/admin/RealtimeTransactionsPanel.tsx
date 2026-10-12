'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Student, WalletTransaction } from '../../types/admin'

type RealtimeItem = {
  id: string
  order_id: string
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
}

type RealtimeTransactionsPanelProps = {
  students: Student[]
  transactions: WalletTransaction[]
  connected: boolean
  error: string | null
}

const PAGE_SIZE = 8

function bangkokDate(value: string | Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

export default function RealtimeTransactionsPanel({
  students,
  transactions,
  connected,
  error,
}: RealtimeTransactionsPanelProps) {
  const [dateFilter, setDateFilter] = useState<'all' | 'today'>('today')
  const [productSearch, setProductSearch] = useState('')
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, RealtimeItem[]>>({})
  const [itemsLoading, setItemsLoading] = useState(false)
  const [page, setPage] = useState(1)

  useEffect(() => {
    let cancelled = false
    const orderIds = Array.from(new Set(
      transactions
        .filter((transaction) => transaction.type === 'purchase' || transaction.type === 'debt_repayment')
        .map((transaction) => transaction.reference)
        .filter((reference): reference is string => typeof reference === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference)),
    ))

    if (!supabase || orderIds.length === 0) {
      setItemsByOrder({})
      setItemsLoading(false)
      return () => { cancelled = true }
    }

    setItemsLoading(true)
    void supabase
      .from('order_items')
      .select('id,order_id,product_name,quantity,unit_price,subtotal')
      .in('order_id', orderIds)
      .order('id', { ascending: true })
      .then(({ data, error: queryError }) => {
        if (cancelled) return
        if (queryError) {
          setItemsByOrder({})
        } else {
          const grouped: Record<string, RealtimeItem[]> = {}
          for (const item of (data || []) as RealtimeItem[]) {
            if (!grouped[item.order_id]) grouped[item.order_id] = []
            grouped[item.order_id].push(item)
          }
          setItemsByOrder(grouped)
        }
        setItemsLoading(false)
      })

    return () => { cancelled = true }
  }, [transactions])

  const filteredTransactions = useMemo(() => {
    const query = productSearch.trim().toLocaleLowerCase('th-TH')
    const today = bangkokDate(new Date())

    return transactions.filter((transaction) => {
      if (dateFilter === 'today' && bangkokDate(transaction.created_at) !== today) return false
      if (!query) return true
      if (transaction.type !== 'purchase' && transaction.type !== 'debt_repayment') return false
      const items = itemsByOrder[transaction.reference || ''] || []
      return items.some((item) => item.product_name.toLocaleLowerCase('th-TH').includes(query))
    })
  }, [transactions, dateFilter, productSearch, itemsByOrder])

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE))
  const paginatedTransactions = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredTransactions.slice(start, start + PAGE_SIZE)
  }, [filteredTransactions, page])

  useEffect(() => {
    setPage(1)
  }, [dateFilter, productSearch])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  return (
    <div className="card admin-section realtime-transactions-panel">
      <div className="section-heading">
        <div>
          <h2>🔴 ธุรกรรมแบบเรียลไทม์</h2>
          <p className="muted">ดูรายการสินค้าในแต่ละธุรกรรม พร้อมกรองข้อมูลเฉพาะวันนี้หรือค้นหาตามชื่อขนม</p>
        </div>
        <div className={`realtime-status ${connected ? 'online' : 'offline'}`}>
          <span className="realtime-dot" />
          {connected ? 'LIVE เชื่อมต่อแล้ว' : 'กำลังเชื่อมต่อ...'}
        </div>
      </div>

      <div className="realtime-filters">
        <div className="realtime-date-filter" role="group" aria-label="กรองวันที่ธุรกรรม">
          <button type="button" className={dateFilter === 'today' ? 'active' : ''} onClick={() => setDateFilter('today')}>วันนี้</button>
          <button type="button" className={dateFilter === 'all' ? 'active' : ''} onClick={() => setDateFilter('all')}>ทั้งหมด</button>
        </div>
        <label className="realtime-product-search">
          <span>ค้นหาชื่อขนม / สินค้า</span>
          <input
            type="search"
            value={productSearch}
            onChange={(event) => setProductSearch(event.target.value)}
            placeholder="เช่น ขนมโจ, นม, น้ำ..."
            aria-label="ค้นหาชื่อขนมหรือสินค้า"
          />
        </label>
        {productSearch.trim() && (
          <button type="button" className="realtime-clear-filter" onClick={() => setProductSearch('')}>ล้างคำค้น</button>
        )}
      </div>

      <div className="realtime-summary">
        <div><span>รายการตามตัวกรอง</span><b>{filteredTransactions.length}</b></div>
        <div><span>เติมเงิน</span><b>{filteredTransactions.filter((item) => item.type === 'topup').length}</b></div>
        <div><span>ซื้อ / ชำระคืนที่อนุมัติ</span><b>{filteredTransactions.filter((item) => item.type === 'purchase' || item.type === 'debt_repayment').length}</b></div>
      </div>

      {error && <div className="realtime-error">⚠️ Realtime ยังเชื่อมต่อไม่ได้: {error}</div>}

      {filteredTransactions.length === 0 ? (
        <div className="history-empty-state">
          <div className="history-empty-icon">📭</div>
          <h4>ไม่พบธุรกรรมที่ตรงกับตัวกรอง</h4>
          <p className="muted">{productSearch.trim() ? 'ลองเปลี่ยนชื่อขนมหรือเลือกแสดงธุรกรรมทั้งหมด' : 'ยังไม่มีธุรกรรมในช่วงเวลาที่เลือก'}</p>
        </div>
      ) : (
        <>
          <div className="realtime-list">
            {paginatedTransactions.map((transaction) => {
              const student = students.find((item) => item.id === transaction.student_id)
              const isDebtRepayment = transaction.type === 'debt_repayment'
              const isTopup = transaction.type === 'topup'
              const isPurchase = transaction.type === 'purchase'
              const transactionKind = isDebtRepayment ? 'repayment' : isTopup ? 'topup' : 'purchase'
              const transactionLabel = isDebtRepayment ? 'รับชำระคืนค่าขนม' : isTopup ? 'เติมเงิน' : isPurchase ? 'ซื้อสินค้า' : transaction.type === 'refund' ? 'คืนเงิน' : 'ปรับยอด'
              const items = itemsByOrder[transaction.reference || ''] || []

              return (
                <div className="realtime-transaction" key={transaction.id}>
                  <div className={`realtime-type-icon ${transactionKind}`}>
                    {isDebtRepayment ? '✓' : isTopup ? '＋' : '🛍️'}
                  </div>
                  <div className="realtime-transaction-main">
                    <div className="realtime-transaction-title">
                      <b>{student?.full_name || 'ไม่พบข้อมูลนักเรียน'}</b>
                      <span className={`realtime-type-badge ${transactionKind}`}>{transactionLabel}</span>
                    </div>
                    <div className="muted">
                      {student?.student_code || transaction.student_id} · {transaction.note || '-'}
                    </div>
                    {(isPurchase || isDebtRepayment) && (
                      <div className="realtime-item-details">
                        <strong>🛍️ รายละเอียดสินค้า</strong>
                        {itemsLoading && items.length === 0 ? (
                          <small>กำลังโหลดรายการสินค้า...</small>
                        ) : items.length > 0 ? (
                          items.map((item) => (
                            <div className="realtime-item-row" key={item.id}>
                              <span>{item.product_name} <small>× {item.quantity}</small></span>
                              <span>฿{Number(item.unit_price).toFixed(2)} / ชิ้น</span>
                              <b>฿{Number(item.subtotal).toFixed(2)}</b>
                            </div>
                          ))
                        ) : (
                          <small>ไม่มีรายละเอียดสินค้าในรายการนี้</small>
                        )}
                      </div>
                    )}
                    <small className="muted">
                      {new Date(transaction.created_at).toLocaleString('th-TH', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: 'Asia/Bangkok',
                      })}
                    </small>
                  </div>
                  <div className={`realtime-amount ${transactionKind}`}>
                    {isDebtRepayment ? '' : isTopup ? '+' : isPurchase ? '-' : ''}฿{Number(transaction.amount).toFixed(2)}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="realtime-pagination">
            <span className="realtime-pagination-info">
              หน้า {page} / {totalPages} · แสดง {paginatedTransactions.length} จาก {filteredTransactions.length} รายการ
            </span>
            <div className="realtime-pagination-buttons">
              <button type="button" className="realtime-pagination-btn" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>← ก่อนหน้า</button>
              <div className="realtime-pagination-pages">
                {Array.from({ length: totalPages }, (_, index) => index + 1)
                  .slice(Math.max(0, page - 3), Math.min(totalPages, page + 2))
                  .map((pageNumber) => (
                    <button type="button" key={pageNumber} className={`realtime-pagination-number ${pageNumber === page ? 'active' : ''}`} onClick={() => setPage(pageNumber)}>{pageNumber}</button>
                  ))}
              </div>
              <button type="button" className="realtime-pagination-btn" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>ถัดไป →</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}