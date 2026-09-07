import { supabase } from '../supabase'
import type { Product } from '../../types/school-wallet'

const PRODUCT_FIELDS = 'id,name,price,stock,image_url,active,created_at'

export async function getActiveProducts(): Promise<{
  data: Product[]
  error: Error | null
}> {
  if (!supabase) {
    return { data: [], error: new Error('ยังไม่ได้ตั้งค่า Supabase') }
  }

  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_FIELDS)
    .eq('active', true)
    .order('name')

  return {
    data: (data ?? []) as Product[],
    error,
  }
}

export async function uploadProductImage(file: File) {
  if (!supabase) {
    throw new Error('ยังไม่ได้ตั้งค่า Supabase')
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `products/${Date.now()}.${extension}`

  const { error } = await supabase.storage
    .from('student-photos')
    .upload(path, file, { upsert: true })

  if (error) {
    throw error
  }

  return supabase.storage.from('student-photos').getPublicUrl(path).data.publicUrl
}
