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
  type: 'topup' | 'purchase' | 'refund' | 'adjustment' | 'debt_repayment'
  amount: number
  balance_before: number
  balance_after: number
  reference: string | null
  note: string | null
  created_at: string
}

export type ConfirmModalData = {
  title: string
  message: string
  detail?: string
  icon?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  onConfirm: () => Promise<void> | void
}