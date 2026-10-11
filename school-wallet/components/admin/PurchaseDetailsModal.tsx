'use client'

import { X, ShoppingBag } from 'lucide-react'
import type { WalletTransaction } from '../../types/admin'

export type PurchaseItem = {
  id: string
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
}

type PurchaseDetailsModalProps = {
  transaction: WalletTransaction | null
  items: PurchaseItem[]
  loading: boolean
  error: string
  onClose: () => void
}

export default function PurchaseDetailsModal({
  transaction,
  items,
  loading,
  error,
  onClose,
}: PurchaseDetailsModalProps) {
  if (!transaction) return null

  return (
    <div className="purchase-details-backdrop" onClick={onClose}>
      <section
        className="purchase-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-details-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="purchase-details-header">
          <div className="purchase-details-heading-icon"><ShoppingBag size={22} /></div>
          <div>
            <h2 id="purchase-details-title">รายละเอียดสินค้าที่ซื้อ</h2>
            <p>วันที่ {new Date(transaction.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}</p>
          </div>
          <button type="button" className="purchase-details-close" onClick={onClose} aria-label="ปิดรายละเอียด">
            <X size={20} />
          </button>
        </header>

        <div className="purchase-details-summary">
          <span>ยอดซื้อทั้งหมด</span>
          <strong>฿{Number(transaction.amount).toFixed(2)}</strong>
        </div>

        {loading ? (
          <div className="purchase-details-state">กำลังโหลดรายละเอียดสินค้า...</div>
        ) : error ? (
          <div className="purchase-details-error">{error}</div>
        ) : items.length === 0 ? (
          <div className="purchase-details-state">ไม่พบรายละเอียดสินค้าในรายการนี้</div>
        ) : (
          <div className="purchase-details-items">
            {items.map((item) => (
              <article className="purchase-details-item" key={item.id}>
                <div className="purchase-details-item-icon"><ShoppingBag size={17} /></div>
                <div className="purchase-details-item-main">
                  <strong>{item.product_name}</strong>
                  <span>{item.quantity} ชิ้น × ฿{Number(item.unit_price).toFixed(2)}</span>
                </div>
                <b>฿{Number(item.subtotal).toFixed(2)}</b>
              </article>
            ))}
            <div className="purchase-details-total">
              <span>รวมทั้งสิ้น</span>
              <strong>฿{items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0).toFixed(2)}</strong>
            </div>
          </div>
        )}
        {transaction.reference && <footer className="purchase-details-reference">เลขอ้างอิง: {transaction.reference}</footer>}
      </section>
    </div>
  )
}
