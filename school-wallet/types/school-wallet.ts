export type Student = {
  id: string
  student_code: string
  full_name: string
  class_name: string | null
  balance: number
  qr_token: string
  photo_url: string | null
  active: boolean
  created_at: string
}

export type Product = {
  id: string
  name: string
  price: number
  stock: number
  image_url: string | null
  active: boolean
  created_at: string
}

export type WalletTransaction = {
  id: string
  student_id: string
  type: 'topup' | 'purchase' | 'refund' | 'adjustment'
  amount: number
  balance_before: number
  balance_after: number
  reference: string | null
  note: string | null
  created_at: string
}

export type StudentTransaction = WalletTransaction & {
  items: Array<{
    name: string
    quantity: number
    unit_price: number
    subtotal: number
  }>
}

export type CartItem = {
  product_id?: string
  custom_name?: string
  custom_price?: number
  quantity: number
}

export type CustomItem = {
  id: string
  name: string
  price: number
  quantity: number
}

export type PurchaseResult = {
  order_id: string
  balance: number
  total: number
}