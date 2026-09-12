import { supabase } from '../supabase'
import type { Student, StudentTransaction, WalletTransaction } from '../../types/school-wallet'

const STUDENT_FIELDS =
  'id,student_code,full_name,class_name,balance,qr_token,photo_url,active,created_at'

export async function getActiveStudentByToken(
  token: string,
): Promise<{ data: Student | null; error: Error | null }> {
  if (!supabase) {
    return {
      data: null,
      error: new Error('ยังไม่ได้ตั้งค่า Supabase'),
    }
  }

  const cleanToken = token.trim().replace(/^SW:/i, '')

  const { data, error } = await supabase
    .from('students')
    .select(STUDENT_FIELDS)
    .eq('qr_token', cleanToken)
    .eq('active', true)
    .maybeSingle()

  return {
    data: data as Student | null,
    error,
  }
}

export async function searchActiveStudents(
  keyword: string,
): Promise<{ data: Student[]; error: Error | null }> {
  if (!supabase) {
    return { data: [], error: new Error('ยังไม่ได้ตั้งค่า Supabase') }
  }

  const cleanKeyword = keyword.trim()

  if (!cleanKeyword) {
    return { data: [], error: null }
  }

  const escapedKeyword = cleanKeyword.replace(/[%,]/g, (character) => `\\${character}`)

  const { data, error } = await supabase
    .from('students')
    .select(STUDENT_FIELDS)
    .eq('active', true)
    .or(
      `full_name.ilike.%${escapedKeyword}%,student_code.ilike.%${escapedKeyword}%`,
    )
    .order('full_name')
    .limit(10)

  return {
    data: (data ?? []) as Student[],
    error,
  }
}

export async function getStudents(): Promise<{
  data: Student[]
  error: Error | null
}> {
  if (!supabase) {
    return { data: [], error: new Error('ยังไม่ได้ตั้งค่า Supabase') }
  }

  const { data, error } = await supabase
    .from('students')
    .select(STUDENT_FIELDS)
    .order('full_name')

  return {
    data: (data ?? []) as Student[],
    error,
  }
}

export async function getStudentTransactions(
  studentId: string,
): Promise<{ data: WalletTransaction[]; error: Error | null }> {
  if (!supabase) {
    return { data: [], error: new Error('ยังไม่ได้ตั้งค่า Supabase') }
  }

  const { data, error } = await supabase
    .from('wallet_transactions')
    .select(
      'id,student_id,type,amount,balance_before,balance_after,reference,note,created_at',
    )
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  return {
    data: (data ?? []) as WalletTransaction[],
    error,
  }
}

/**
 * สำหรับหน้า /student ที่เป็น public:
 * ใช้ QR token เป็นตัวระบุนักเรียน แทนการเปิดสิทธิ์อ่าน wallet_transactions ให้ anon
 * โหลดทีละหน้า และดึงเกินมา 1 รายการเพื่อรู้ว่ามีหน้าถัดไปหรือไม่
 */
export async function getPublicStudentTransactions(
  token: string,
  page = 1,
  pageSize = 5,
): Promise<{ data: StudentTransaction[]; error: Error | null; hasMore: boolean }> {
  if (!supabase) {
    return { data: [], error: new Error('ยังไม่ได้ตั้งค่า Supabase'), hasMore: false }
  }

  const cleanToken = token.trim().replace(/^SW:/i, '')

  if (!cleanToken) {
    return { data: [], error: new Error('ไม่พบ QR Token ของนักเรียน'), hasMore: false }
  }

  const safePage = Math.max(1, Math.floor(page))
  const safePageSize = Math.min(20, Math.max(1, Math.floor(pageSize)))
  const offset = (safePage - 1) * safePageSize

  const { data, error } = await supabase.rpc('get_student_transactions_by_qr_paged', {
    p_qr_token: cleanToken,
    p_offset: offset,
    p_limit: safePageSize + 1,
  })

  if (error) {
    return { data: [], error, hasMore: false }
  }

  const rows = (data ?? []) as StudentTransaction[]
  const hasMore = rows.length > safePageSize

  return {
    data: rows.slice(0, safePageSize),
    error: null,
    hasMore,
  }
}

export async function uploadStudentPhoto(file: File, studentId: string) {
  if (!supabase) {
    throw new Error('ยังไม่ได้ตั้งค่า Supabase')
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${studentId}-${Date.now()}.${extension}`

  const { error } = await supabase.storage
    .from('student-photos')
    .upload(path, file, { upsert: true })

  if (error) {
    throw error
  }

  return supabase.storage.from('student-photos').getPublicUrl(path).data.publicUrl
}
