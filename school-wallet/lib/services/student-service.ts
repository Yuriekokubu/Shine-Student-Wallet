import { supabase } from '../supabase'
import type { Student, WalletTransaction } from '../../types/school-wallet'

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
