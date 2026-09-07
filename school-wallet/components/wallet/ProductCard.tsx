import type { Product } from '../../types/school-wallet'

type ProductCardProps = {
  product: Product
  quantity: number
  onAdd: () => void
  onRemove: () => void
}

export default function ProductCard({
  product,
  quantity,
  onAdd,
  onRemove,
}: ProductCardProps) {
  const isOutOfStock = Number(product.stock) <= 0
  const reachedStock = quantity >= Number(product.stock)

  return (
    <article className="product-card">
      <div className="product-card-media">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="product-card-image"
          />
        ) : (
          <div className="product-card-placeholder" aria-hidden="true">
            🍪
          </div>
        )}

        {isOutOfStock && (
          <span className="product-stock-badge product-stock-badge-out">
            หมด
          </span>
        )}
      </div>

      <div className="product-card-body">
        <h3 className="product-card-name">{product.name}</h3>

        <div className="product-card-bottom">
          <div>
            <div className="product-card-price">
              ฿{Number(product.price).toFixed(2)}
            </div>
            <small className="product-card-stock">
              {isOutOfStock ? 'สินค้าหมด' : `เหลือ ${product.stock} ชิ้น`}
            </small>
          </div>

          <div className="product-quantity-control">
            {quantity > 0 && (
              <button
                type="button"
                className="quantity-btn quantity-btn-minus"
                onClick={onRemove}
                aria-label={`ลด ${product.name}`}
              >
                −
              </button>
            )}

            {quantity > 0 && (
              <span className="quantity-value" aria-label="จำนวน">
                {quantity}
              </span>
            )}

            <button
              type="button"
              className="quantity-btn quantity-btn-plus"
              onClick={onAdd}
              disabled={isOutOfStock || reachedStock}
              aria-label={`เพิ่ม ${product.name}`}
            >
              +
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
