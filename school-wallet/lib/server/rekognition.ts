import {
  CreateCollectionCommand,
  DeleteFacesCommand,
  IndexFacesCommand,
  RekognitionClient,
  SearchFacesByImageCommand,
} from '@aws-sdk/client-rekognition'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const region = process.env.AWS_REGION
const collectionId = process.env.AWS_REKOGNITION_COLLECTION_ID

function getRekognitionClient() {
  if (!region || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error('กรุณาตั้งค่า AWS_REGION, AWS_ACCESS_KEY_ID และ AWS_SECRET_ACCESS_KEY ใน .env.local')
  }

  if (!collectionId) {
    throw new Error('กรุณาตั้งค่า AWS_REKOGNITION_COLLECTION_ID ใน .env.local')
  }

  return new RekognitionClient({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  })
}

export function getCollectionId() {
  if (!collectionId) {
    throw new Error('กรุณาตั้งค่า AWS_REKOGNITION_COLLECTION_ID ใน .env.local')
  }
  return collectionId
}

export async function getAdminSupabase() {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !key) {
    throw new Error('ยังไม่ได้ตั้งค่า Supabase')
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Route handlers can refresh auth cookies; middleware handles page refreshes.
        }
      },
    },
  })

  const { data: { user }, error } = await supabase.auth.getUser()
  const role = user?.app_metadata?.role || user?.user_metadata?.role
  if (error || !user || role !== 'admin') {
    throw new Error('UNAUTHORIZED')
  }

  return supabase
}

export function getRekognition() {
  return getRekognitionClient()
}

export async function ensureCollection() {
  const client = getRekognitionClient()
  try {
    await client.send(new CreateCollectionCommand({
      CollectionId: getCollectionId(),
    }))
    return 'created'
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'ResourceAlreadyExistsException' ||
        error.name === 'ResourceAlreadyExists')
    ) {
      return 'exists'
    }
    throw error
  }
}

export async function enrollFace(imageBytes: Uint8Array, studentId: string) {
  const client = getRekognitionClient()
  const collection = getCollectionId()

  const result = await client.send(new IndexFacesCommand({
    CollectionId: collection,
    Image: { Bytes: imageBytes },
    ExternalImageId: studentId,
    MaxFaces: 2,
    QualityFilter: 'AUTO',
    DetectionAttributes: ['DEFAULT'],
  }))

  const faces = result.FaceRecords ?? []
  if (faces.length !== 1 || !faces[0]?.Face?.FaceId) {
    const ids = faces.map((record) => record.Face?.FaceId).filter(Boolean) as string[]
    if (ids.length) {
      await client.send(new DeleteFacesCommand({
        CollectionId: collection,
        FaceIds: ids,
      }))
    }
    throw new Error(
      faces.length === 0
        ? 'ไม่พบใบหน้าในภาพ กรุณาใช้ภาพที่เห็นใบหน้าชัดเจน'
        : 'พบหลายใบหน้าในภาพ กรุณาใช้ภาพที่มีนักเรียนเพียงคนเดียว',
    )
  }

  return {
    faceId: faces[0].Face.FaceId,
    confidence: faces[0].Face.Confidence ?? null,
  }
}

export async function searchFace(imageBytes: Uint8Array) {
  const client = getRekognitionClient()
  return client.send(new SearchFacesByImageCommand({
    CollectionId: getCollectionId(),
    Image: { Bytes: imageBytes },
    MaxFaces: 5,
    FaceMatchThreshold: 90,
    QualityFilter: 'AUTO',
  }))
}

export async function removeFace(faceId: string) {
  const client = getRekognitionClient()
  return client.send(new DeleteFacesCommand({
    CollectionId: getCollectionId(),
    FaceIds: [faceId],
  }))
}