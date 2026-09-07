import type { ChangeEvent } from 'react'

type CustomItemFormProps = {
  name: string
  price: string
  quantity: string
  onNameChange: (value: string) => void
  onPriceChange: (value: string) => void
  onQuantityChange: (value: string) => void
  onAdd: () => void
}

export default function CustomItemForm({
  name,
  price,
  quantity,
  onNameChange,
  onPriceChange,
  onQuantityChange,
  onAdd,
}: CustomItemFormProps) {
  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    onNameChange(event.target.value)
  }

  const handlePriceChange = (event: ChangeEvent<HTMLInputElement>) => {
    onPriceChange(event.target.value)
  }

  const handleQuantityChange = (event: ChangeEvent<HTMLInputElement>) => {
    onQuantityChange(event.target.value)
  }

  return (
    <section className="custom-item-form">
      <div className="custom-item-header">
        <div className="custom-item-icon">✏️</div>
        <div>
          <h3>รายการอื่น</h3>
          <p>กรอกราคาเองสำหรับสินค้าที่ไม่มีในเมนู</p>
        </div>
      </div>

      <div className="custom-item-fields">
        <input
          className="input"
          placeholder="ชื่อรายการ เช่น อาหารกลางวัน"
          value={name}
          onChange={handleNameChange}
        />

        <div className="custom-item-row">
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            placeholder="ราคา (บาท)"
            value={price}
            onChange={handlePriceChange}
          />

          <input
            className="input custom-quantity-input"
            type="number"
            min="1"
            step="1"
            placeholder="จำนวน"
            value={quantity}
            onChange={handleQuantityChange}
          />

          <button type="button" className="custom-add-btn" onClick={onAdd}>
            ＋ เพิ่ม
          </button>
        </div>
      </div>
    </section>
  )
}
