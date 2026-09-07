import type { CustomItem, Product } from '../../types/school-wallet'

type CartSummaryProps = {
  products: Product[]
  cart: Record<string, number>
  customItems: CustomItem[]
  total: number
  balance: number
  loading: boolean
  message: string
  onRemoveCustomItem: (id: string) => void
  onCheckout: () => void
}

export default function CartSummary({
  products,
  cart,
  customItems,
  total,
  balance,
  loading,
  message,
  onRemoveCustomItem,
  onCheckout,
}: CartSummaryProps) {
  const hasItems =
    products.some((product) => cart[product.id] > 0) || customItems.length > 0
  const insufficientBalance = total > Number(balance)

  return (
    <aside className="cart-summary card">
      <div className="cart-summary-header">
        <div>
          <span className="cart-summary-eyebrow">ORDER</span>
          <h2>🧾 รายการซื้อ</h2>
        </div>

        {hasItems && (
          <span className="cart-summary-count">
            {products.reduce((sum, product) => sum + (cart[product.id] || 0), 0) +
              customItems.reduce((sum, item) => sum + item.quantity, 0)}{' '}
            รายการ
          </span>
        )}
      </div>

      <div className="cart-items">
        {products
          .filter((product) => cart[product.id] > 0)
          .map((product) => (
            <div className="cart-item" key={product.id}>
              <div className="cart-item-icon">🍪</div>
              <div className="cart-item-content">
                <span className="cart-item-name">{product.name}</span>
                <small className="muted">
                  ฿{Number(product.price).toFixed(2)} × {cart[product.id]}
                </small>
              </div>
              <b className="cart-item-total">
                ฿{(Number(product.price) * cart[product.id]).toFixed(2)}
              </b>
            </div>
          ))}

        {customItems.map((item) => (
          <div className="cart-item" key={item.id}>
            <div className="cart-item-icon custom">✏️</div>
            <div className="cart-item-content">
              <span className="cart-item-name">{item.name}</span>
              <small className="muted">
                ฿{Number(item.price).toFixed(2)} × {item.quantity}
              </small>
            </div>
            <div className="cart-item-actions">
              <b className="cart-item-total">
                ฿{(Number(item.price) * item.quantity).toFixed(2)}
              </b>
              <button
                type="button"
                className="cart-remove-btn"
                onClick={() => onRemoveCustomItem(item.id)}
                aria-label={`ลบ ${item.name}`}
              >
                ×
              </button>
            </div>
          </div>
        ))}

        {!hasItems && (
          <div className="cart-empty">
            <div className="cart-empty-icon">🛒</div>
            <b>ยังไม่มีรายการ</b>
            <span>เลือกสินค้าจากด้านซ้ายเพื่อเริ่มสั่งซื้อ</span>
          </div>
        )}
      </div>

      <div className="cart-total-box">
        <div className="space">
          <span>ยอดรวม</span>
          <strong>฿{total.toFixed(2)}</strong>
        </div>

        <div className="cart-balance-row">
          <span>ยอดเงินคงเหลือ</span>
          <span className={insufficientBalance ? 'text-danger' : 'text-success'}>
            ฿{Number(balance).toFixed(2)}
          </span>
        </div>
      </div>

      <button
        type="button"
        className="checkout-btn"
        disabled={loading || !total || insufficientBalance}
        onClick={onCheckout}
      >
        <span>
          {loading
            ? 'กำลังดำเนินการ...'
            : insufficientBalance
              ? 'ยอดเงินไม่เพียงพอ'
              : 'ชำระเงิน'}
        </span>
        {!loading && !insufficientBalance && total > 0 && (
          <strong>฿{total.toFixed(2)} →</strong>
        )}
      </button>

      {message && (
        <div className="status success cart-message">✓ {message}</div>
      )}
    </aside>
  )
}
