import type { Product } from '../../types/school-wallet'

type ProductRowProps = {
  product: Product
  onEdit: () => void
  onDeactivate: () => void
}

export default function ProductRow({
  product,
  onEdit,
  onDeactivate,
}: ProductRowProps) {
  return (
    <div className="product admin-product">
      {product.image_url ? (
        <img src={product.image_url} alt="" className="product-thumb" />
      ) : (
        <div className="product-thumb-placeholder">🛍️</div>
      )}

      <div className="product-info">
        <b>{product.name}</b>
        <div className="muted">
          ฿{Number(product.price).toFixed(2)} · เหลือ {product.stock} ชิ้น
        </div>
      </div>

      <div className="row">
        <button className="btn" onClick={onEdit}>
          ✎ แก้ไข
        </button>
        <button className="btn danger-btn" onClick={onDeactivate}>
          ปิดการขาย
        </button>
      </div>
    </div>
  )
}
