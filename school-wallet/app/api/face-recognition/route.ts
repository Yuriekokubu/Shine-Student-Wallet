import { NextResponse } from 'next/server'
import {
  enrollFace,
  ensureCollection,
  getAdminSupabase,
  getCollectionId,
  removeFace,
  searchFace,
} from '../../../lib/server/rekognition'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function describeError(error: unknown): { message: string; status: number; code?: string } {
  if (error instanceof Error) {
    const status = error.message === 'UNAUTHORIZED' ? 401 : 500
    return {
      message: error.message || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ',
      status,
      code: error.name,
    }
  }

  // Supabase/PostgREST errors and some AWS SDK exceptions are plain objects,
  // not always instances of Error. Preserve their useful diagnostic message.
  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>
    const message =
      (typeof value.message === 'string' && value.message) ||
      (typeof value.details === 'string' && value.details) ||
      (typeof value.error === 'string' && value.error) ||
      (typeof value.__type === 'string' && value.__type) ||
      'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ'
    const code =
      (typeof value.code === 'string' && value.code) ||
      (typeof value.name === 'string' && value.name) ||
      (typeof value.__type === 'string' && value.__type) ||
      undefined

    return { message, status: 500, code }
  }

  return {
    message: typeof error === 'string' && error ? error : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ',
    status: 500,
  }
}

function jsonError(error: unknown) {
  const detail = describeError(error)
  if (detail.message === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'ต้องเข้าสู่ระบบด้วยบัญชี Admin' }, { status: 401 })
  }

  // Return actionable error text but never include credentials or environment values.
  return NextResponse.json({
    error: detail.message,
    ...(detail.code ? { code: detail.code } : {}),
  }, { status: detail.status })
}

function parseImage(value: unknown): Uint8Array {
  if (typeof value !== 'string') throw new Error('กรุณาถ่ายภาพใบหน้าก่อน')
  const base64 = value.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '')
  if (!base64 || base64.length > 4_300_000) {
    throw new Error('รูปภาพว่างหรือมีขนาดใหญ่เกินไป กรุณาใช้ภาพไม่เกิน 3 MB')
  }
  const buffer = Buffer.from(base64, 'base64')
  if (!buffer.length) throw new Error('ไม่สามารถอ่านรูปภาพได้')
  return new Uint8Array(buffer)
}

export async function POST(request: Request) {
  try {
    const supabase = await getAdminSupabase()
    const body = await request.json() as {
      action?: string
      image?: string
      studentId?: string
      consentConfirmed?: boolean
    }

    if (body.action === 'status') {
      const { data: profiles, error: profilesError } = await supabase
        .from('student_face_profiles')
        .select('student_id')
        .eq('provider', 'rekognition')
        .eq('consent_status', 'granted')
        .is('withdrawn_at', null)
        .not('face_id', 'is', null)

      if (profilesError) throw profilesError

      const enrolledStudentIds = Array.from(
        new Set((profiles ?? []).map((profile) => profile.student_id).filter(Boolean)),
      )

      return NextResponse.json({
        ok: true,
        enrolledStudentIds,
        enrolledCount: enrolledStudentIds.length,
      })
    }

    if (body.action === 'setup') {
      const result = await ensureCollection()
      return NextResponse.json({
        ok: true,
        collectionId: getCollectionId(),
        status: result === 'created' ? 'สร้าง Collection สำเร็จ' : 'Collection มีอยู่แล้ว',
      })
    }

    if (body.action === 'enroll') {
      if (!body.studentId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.studentId)) {
        throw new Error('รหัสนักเรียนไม่ถูกต้อง')
      }
      if (body.consentConfirmed !== true) {
        throw new Error('กรุณายืนยันว่าได้รับความยินยอมจากนักเรียนหรือผู้ปกครองก่อนลงทะเบียนข้อมูลใบหน้า')
      }
      const imageBytes = parseImage(body.image)
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id,full_name,active')
        .eq('id', body.studentId)
        .eq('active', true)
        .maybeSingle()

      if (studentError) throw studentError
      if (!student) throw new Error('ไม่พบนักเรียนที่เปิดใช้งาน')

      const { data: previousProfiles, error: previousError } = await supabase
        .from('student_face_profiles')
        .select('id,face_id')
        .eq('student_id', student.id)
        .eq('provider', 'rekognition')
        .order('updated_at', { ascending: false })
        .limit(1)
      if (previousError) throw previousError
      const previous = previousProfiles?.[0]

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('ไม่สามารถตรวจสอบบัญชี Admin สำหรับบันทึกการยินยอมได้')

      const indexed = await enrollFace(imageBytes, student.id)
      const now = new Date().toISOString()
      const { error: saveError } = await supabase
        .from('student_face_profiles')
        .insert({
          student_id: student.id,
          provider: 'rekognition',
          provider_face_token: indexed.faceId,
          face_id: indexed.faceId,
          collection_id: getCollectionId(),
          consent_status: 'granted',
          consented_by: user.id,
          consent_reference: 'ยืนยันโดยผู้ดูแลระบบก่อนลงทะเบียนผ่านหน้า Admin',
          consented_at: now,
          withdrawn_at: null,
          created_by: user.id,
          updated_at: now,
        })

      if (saveError) {
        await removeFace(indexed.faceId).catch(() => undefined)
        throw saveError
      }

      if (previous?.face_id && previous.face_id !== indexed.faceId) {
        await removeFace(previous.face_id).catch(() => undefined)
      }
      if (previous?.id) {
        const { error: previousDeleteError } = await supabase
          .from('student_face_profiles')
          .delete()
          .eq('id', previous.id)
        if (previousDeleteError) console.error('[face-recognition] previous profile cleanup failed', previousDeleteError)
      }

      return NextResponse.json({
        ok: true,
        student: student.full_name,
        message: 'ลงทะเบียนใบหน้าสำเร็จ',
      })
    }

    if (body.action === 'search') {
      const imageBytes = parseImage(body.image)
      const result = await searchFace(imageBytes)
      const matches = (result.FaceMatches ?? [])
        .filter((match) => match.Face?.FaceId)
        .map((match) => ({
          faceId: match.Face!.FaceId!,
          similarity: match.Similarity ?? 0,
        }))

      if (!matches.length) {
        return NextResponse.json({ ok: true, found: false, message: 'ไม่พบใบหน้าที่ตรงกันในระบบ' })
      }

      const faceIds = matches.map((match) => match.faceId)
      const { data: profiles, error: profileError } = await supabase
        .from('student_face_profiles')
        .select('face_id,student_id,students(id,student_code,full_name,class_name,photo_url,balance,qr_token,active)')
        .in('face_id', faceIds)

      if (profileError) throw profileError

      const found = matches
        .map((match) => {
          const profile = profiles?.find((item) => item.face_id === match.faceId)
          const studentValue = profile?.students as unknown
          const student = Array.isArray(studentValue) ? studentValue[0] : studentValue
          const studentRecord = student as Record<string, unknown> | null
          return studentRecord && studentRecord.active === true
            ? { ...studentRecord, similarity: match.similarity }
            : null
        })
        .filter(Boolean)

      return NextResponse.json({
        ok: true,
        found: found.length > 0,
        matches: found,
        message: found.length ? 'ค้นหาใบหน้าสำเร็จ' : 'พบใบหน้า แต่ยังไม่มีข้อมูลนักเรียนที่เชื่อมโยง',
      })
    }

    if (body.action === 'delete') {
      if (!body.studentId) throw new Error('กรุณาเลือกนักเรียน')
      const { data: profiles, error: profileError } = await supabase
        .from('student_face_profiles')
        .select('id,face_id')
        .eq('student_id', body.studentId)
        .eq('provider', 'rekognition')
      if (profileError) throw profileError
      if (!profiles?.length) return NextResponse.json({ ok: true, message: 'นักเรียนคนนี้ยังไม่มีข้อมูลใบหน้า' })

      const faceIds = profiles.map((profile) => profile.face_id).filter((faceId): faceId is string => Boolean(faceId))
      if (faceIds.length) {
        for (const faceId of faceIds) await removeFace(faceId)
      }
      const { error: deleteError } = await supabase
        .from('student_face_profiles')
        .delete()
        .in('id', profiles.map((profile) => profile.id))
      if (deleteError) throw deleteError
      return NextResponse.json({ ok: true, message: 'ลบข้อมูลใบหน้าสำเร็จ' })
    }

    throw new Error('ไม่รู้จักคำสั่งที่ร้องขอ')
  } catch (error) {
    console.error('[face-recognition]', error)
    return jsonError(error)
  }
}