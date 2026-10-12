import { DetectLabelsCommand } from '@aws-sdk/client-rekognition'
import { NextResponse } from 'next/server'
import { getAdminSupabase, getRekognition } from '../../../lib/server/rekognition'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    await getAdminSupabase()
    const body = await request.json() as { image?: unknown }
    if (typeof body.image !== 'string') {
      return NextResponse.json({ error: 'กรุณาถ่ายภาพขนมก่อน' }, { status: 400 })
    }

    const base64 = body.image.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '')
    if (!base64 || base64.length > 4_300_000) {
      return NextResponse.json({ error: 'รูปภาพว่างหรือมีขนาดใหญ่เกินไป (สูงสุด 3 MB)' }, { status: 400 })
    }

    const bytes = new Uint8Array(Buffer.from(base64, 'base64'))
    if (!bytes.length) {
      return NextResponse.json({ error: 'ไม่สามารถอ่านรูปภาพได้' }, { status: 400 })
    }

    const rekognition = getRekognition()
    const result = await rekognition.send(new DetectLabelsCommand({
      Image: { Bytes: bytes },
      MaxLabels: 50,
      MinConfidence: 35,
    }))

    // ถุง/ซอง/แพ็กเกจที่เด็กถือ อาจถูก Rekognition เรียกว่า Bag, Packaging,
    // Product หรือ Wrapper แทนคำว่า Snack จึงต้องพิจารณาป้ายกำกับเหล่านี้ด้วย
    const snackKeywords = [
      'snack', 'food', 'cookie', 'biscuit', 'candy', 'chocolate',
      'confectionery', 'cracker', 'chip', 'dessert', 'pastry', 'bread',
      'fruit', 'noodle', 'sweet',
    ]
    const packageKeywords = [
      'bag', 'packet', 'packaging', 'package', 'wrapper', 'pouch',
      'sachet', 'plastic bag', 'food container', 'product package',
      'grocery bag', 'shopping bag', 'box',
    ]
    const labels = (result.Labels ?? []).map((label) => ({
      name: label.Name ?? '',
      confidence: label.Confidence ?? 0,
      instances: (label.Instances ?? []).filter((item) => (item.Confidence ?? 0) >= 35).length,
    }))
    const isMatch = (name: string, keywords: string[]) =>
      keywords.some((keyword) => name.toLowerCase().includes(keyword))
    const snackLabels = labels.filter((label) => isMatch(label.name, snackKeywords))
    const packageLabels = labels.filter((label) => isMatch(label.name, packageKeywords))
    const hasPerson = labels.some((label) => label.name.toLowerCase() === 'person')
    // นับจาก label เดียวที่มีจำนวน instance สูงสุด ไม่บวก label ซ้ำชั้นกัน
    // เช่น Bag + Package + Product ซึ่งอาจเป็นวัตถุชิ้นเดียวกัน
    const countableLabels = snackLabels.length ? snackLabels : (hasPerson ? packageLabels : [])
    const quantity = countableLabels.reduce((max, label) => Math.max(max, label.instances), 0)
    const detected = snackLabels.length > 0 || (hasPerson && packageLabels.length > 0)
    const confidenceLabels = snackLabels.length ? snackLabels : packageLabels

    return NextResponse.json({
      ok: true,
      detected,
      productName: 'ขนม',
      quantity: detected && quantity === 0 ? 1 : quantity,
      needsManualCount: !detected || quantity === 0,
      confidence: confidenceLabels.length
        ? Math.max(...confidenceLabels.map((label) => label.confidence))
        : 0,
      labels: labels.filter((label) => label.confidence >= 35).slice(0, 15),
      message: detected
        ? quantity > 0
          ? 'ตรวจพบขนมหรือถุง/ซองที่อาจเป็นขนมแล้ว ระบบนับจากวัตถุที่ตรวจพบ กรุณาตรวจสอบจำนวนก่อนใส่ตะกร้า'
          : 'ตรวจพบคนถือถุงหรือแพ็กเกจที่อาจเป็นขนม เบื้องต้นตั้งจำนวน 1 ชิ้น กรุณาตรวจสอบและแก้จำนวนให้ตรงกับภาพ'
        : 'ยังไม่พบขนมหรือถุง/ซองที่ชัดเจน กรุณาถ่ายภาพให้เห็นถุงขนมเต็ม ๆ และไม่ถูกบัง',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการตรวจจับขนม'
    const status = message === 'UNAUTHORIZED' ? 401 : 500
    return NextResponse.json({
      error: status === 401 ? 'ต้องเข้าสู่ระบบด้วยบัญชี Admin' : message,
    }, { status })
  }
}