import { supabase } from '../supabase'
import type { CartItem, PurchaseResult, Student } from '../../types/school-wallet'

function getSupabaseErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>

    if (typeof value.message === 'string' && value.message) {
      return value.message
    }

    if (typeof value.details === 'string' && value.details) {
      return value.details
    }

    if (typeof value.hint === 'string' && value.hint) {
      return value.hint
    }

    try {
      return JSON.stringify(error)
    } catch {
      return 'เกิดข้อผิดพลาดจากระบบ'
    }
  }

  return 'เกิดข้อผิดพลาดจากระบบ'
}

export function getWalletErrorMessage(error: unknown): string {
  return getSupabaseErrorMessage(error)
}

export async function topUpStudent(
  studentId: string,
  amount: number,
  reference?: string | null,
  note?: string | null,
): Promise<Student> {
  if (!supabase) {
    throw new Error('ยังไม่ได้ตั้งค่า Supabase')
  }

  const { data, error } = await supabase.rpc('topup_student', {
    p_student_id: studentId,
    p_amount: amount,
    p_reference: reference || null,
    p_note: note || 'เติมเงินโดย Admin',
  })

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error('ระบบเติมเงินไม่ส่งข้อมูลนักเรียนกลับมา')
  }

  return data as Student
}

export async function purchaseProducts(
  studentId: string,
  items: CartItem[],
): Promise<PurchaseResult> {
  if (!supabase) {
    throw new Error('ยังไม่ได้ตั้งค่า Supabase')
  }

  const { data, error } = await supabase.rpc('purchase_products', {
    p_student_id: studentId,
    p_items: items,
  })

  if (error) {
    throw error
  }

  return data as PurchaseResult
}