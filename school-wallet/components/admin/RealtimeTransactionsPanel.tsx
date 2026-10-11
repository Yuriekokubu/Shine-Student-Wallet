'use client'

import type { Student, WalletTransaction } from '../../types/admin'

type RealtimeTransactionsPanelProps = {
  students: Student[]
  transactions: WalletTransaction[]
  paginatedTransactions: WalletTransaction[]
  connected: boolean
  error: string | null
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export default function RealtimeTransactionsPanel({
  students,
  transactions,
  paginatedTransactions,
  connected,
  error,
  page,
  totalPages,
  onPageChange,
}: RealtimeTransactionsPanelProps) {
  return (
    <div className="card admin-section realtime-transactions-panel">
      <div className="section-heading">
        <div>
          <h2>🔴 ธุรกรรมแบบเรียลไทม์</h2>
          <p className="muted">รายการเติมเงิน ซื้อสินค้า และรับชำระคืนค่าขนมจะแสดงอัตโนมัติ โดยไม่ต้องรีเฟรชหน้า</p>
        </div>
        <div className={`realtime-status ${connected ? 'online' : 'offline'}`}>
          <span className="realtime-dot" />
          {connected ? 'LIVE เชื่อมต่อแล้ว' : 'กำลังเชื่อมต่อ...'}
        </div>
      </div>

      <div className="realtime-summary">
        <div><span>รายการที่แสดง</span><b>{transactions.length}</b></div>
        <div><span>เติมเงิน</span><b>{transactions.filter((item) => item.type === 'topup').length}</b></div>
        <div><span>ซื้อ / ชำระคืนที่อนุมัติ</span><b>{transactions.filter((item) => item.type === 'purchase' || item.type === 'debt_repayment').length}</b></div>
      </div>

      {error && <div className="realtime-error">⚠️ Realtime ยังเชื่อมต่อไม่ได้: {error}</div>}

      {transactions.length === 0 ? (
        <div className="history-empty-state">
          <div className="history-empty-icon">📭</div>
          <h4>ยังไม่มีธุรกรรม</h4>
          <p className="muted">เมื่อมีการเติมเงิน ซื้อสินค้า หรืออนุมัติรับชำระคืนค่าขนม รายการจะปรากฏที่นี่ทันที</p>
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

              return (
                <div className="realtime-transaction" key={transaction.id}>
                  <div className={`realtime-type-icon ${transactionKind}`}>
                    {isDebtRepayment ? '✓' : isTopup ? '＋' : '🛍️'}
                  </div>
                  <div className="realtime-transaction-main">
                    <div className="realtime-transaction-title">
                      <b>{student?.full_name || 'ไม่พบข้อมูลนักเรียน'}</b>
                      <span className={`realtime-type-badge ${transactionKind}`}>
                        {transactionLabel}
                      </span>
                    </div>
                    <div className="muted">
                      {student?.student_code || transaction.student_id} · {transaction.note || '-'}
                    </div>
                    <small className="muted">
                      {new Date(transaction.created_at).toLocaleString('th-TH', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
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
              หน้า {page} / {totalPages} · แสดง {paginatedTransactions.length} จาก {transactions.length} รายการ
            </span>
            <div className="realtime-pagination-buttons">
              <button
                type="button"
                className="realtime-pagination-btn"
                onClick={() => onPageChange(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                ← ก่อนหน้า
              </button>
              <div className="realtime-pagination-pages">
                {Array.from({ length: totalPages }, (_, index) => index + 1)
                  .slice(Math.max(0, page - 3), Math.min(totalPages, page + 2))
                  .map((pageNumber) => (
                    <button
                      type="button"
                      key={pageNumber}
                      className={`realtime-pagination-number ${pageNumber === page ? 'active' : ''}`}
                      onClick={() => onPageChange(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  ))}
              </div>
              <button
                type="button"
                className="realtime-pagination-btn"
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                ถัดไป →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}