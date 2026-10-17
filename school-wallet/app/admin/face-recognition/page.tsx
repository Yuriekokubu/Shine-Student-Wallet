'use client'

import '../admin-page.css'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, CheckCircle2, DoorOpen, Fingerprint, LoaderCircle, Search, Trash2, UserRound, X, Wallet, Store, LogOut } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

type Student = {
  id: string
  student_code: string
  full_name: string
  class_name: string | null
  photo_url: string | null
  balance: number
}

type Match = Student & { similarity: number }

export default function FaceRecognitionPage() {
  const [adminDrawerOpen, setAdminDrawerOpen] = useState(false)
  const [students, setStudents] = useState<Student[]>([])
  const [enrolledStudentIds, setEnrolledStudentIds] = useState<string[]>([])
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'enrolled' | 'not-enrolled' | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [imageData, setImageData] = useState('')
  const [imageName, setImageName] = useState('')
  const [searchText, setSearchText] = useState('')
  const [matches, setMatches] = useState<Match[]>([])
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [setupDone, setSetupDone] = useState(false)
  const [consentConfirmed, setConsentConfirmed] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    async function loadStudents() {
      if (!supabase) {
        setError('ยังไม่ได้ตั้งค่า Supabase')
        return
      }
      const { data, error: queryError } = await supabase
        .from('students')
        .select('id,student_code,full_name,class_name,photo_url,balance')
        .eq('active', true)
        .order('full_name')
      if (queryError) setError(queryError.message)
      else setStudents((data ?? []) as Student[])
    }
    void loadStudents()
    void refreshFaceStatuses()
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (video && cameraStream) {
      video.srcObject = cameraStream
      void video.play().catch(() => undefined)
    }
  }, [cameraStream, cameraOpen])

  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach((track) => track.stop())
    }
  }, [cameraStream])

  const filteredStudents = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase()
    return students.filter((student) =>
      !query ||
      student.full_name.toLocaleLowerCase().includes(query) ||
      student.student_code.toLocaleLowerCase().includes(query)
    )
  }, [students, searchText])

  async function refreshFaceStatuses() {
    if (!supabase) {
      setStatusLoading(false)
      return
    }

    setStatusLoading(true)
    try {
      const { data, error: queryError } = await supabase
        .from('student_face_profiles')
        .select('student_id,face_id,provider,consent_status,withdrawn_at')
        .eq('provider', 'rekognition')
        .eq('consent_status', 'granted')
        .is('withdrawn_at', null)
        .not('face_id', 'is', null)

      if (queryError) throw queryError

      const ids = Array.from(
        new Set((data ?? []).map((profile) => profile.student_id).filter(Boolean)),
      )
      setEnrolledStudentIds(ids)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดสถานะการลงทะเบียนใบหน้าไม่สำเร็จ')
    } finally {
      setStatusLoading(false)
    }
  }

  async function requestApi(action: string, extra: Record<string, string | boolean> = {}) {
    const response = await fetch('/api/face-recognition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'คำขอไม่สำเร็จ')
    return payload
  }

  async function setupCollection() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await requestApi('setup')
      setSetupDone(true)
      setNotice(result.status + ' (' + result.collectionId + ')')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ตั้งค่า Collection ไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  async function openCamera() {
    setError('')
    setNotice('')
    setMatches([])
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('เบราว์เซอร์นี้ไม่รองรับการเปิดกล้อง กรุณาใช้ Chrome หรือ Safari ผ่าน HTTPS')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      setCameraStream(stream)
      setCameraOpen(true)
    } catch (err) {
      const name = err instanceof DOMException ? err.name : ''
      setError(
        name === 'NotAllowedError'
          ? 'ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณากด Allow ในหน้าต่างขอสิทธิ์ของเบราว์เซอร์'
          : name === 'NotFoundError'
            ? 'ไม่พบกล้องที่ใช้งานได้บนอุปกรณ์นี้'
            : 'เปิดกล้องไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อกล้องและสิทธิ์การใช้งาน',
      )
    }
  }

  function closeCamera() {
    cameraStream?.getTracks().forEach((track) => track.stop())
    setCameraStream(null)
    setCameraOpen(false)
  }

  function captureCameraImage() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      setError('กล้องยังไม่พร้อม กรุณารอสักครู่แล้วลองอีกครั้ง')
      return
    }

    const maxDimension = 1600
    const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight))
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    const context = canvas.getContext('2d')
    if (!context) {
      setError('ไม่สามารถประมวลผลภาพจากกล้องได้')
      return
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const captured = canvas.toDataURL('image/jpeg', 0.82)
    if (captured.length > 4_300_000) {
      setError('ภาพมีขนาดใหญ่เกินไป กรุณาถ่ายใหม่ในระยะที่เหมาะสม')
      return
    }

    setImageData(captured)
    setImageName('ภาพจากกล้อง.jpg')
    setError('')
    setNotice('ถ่ายภาพจากกล้องแล้ว ตรวจสอบภาพก่อนลงทะเบียนหรือค้นหา')
    setMatches([])
    closeCamera()
  }

  async function enroll() {
    if (!selectedId) {
      setError('กรุณาเลือกนักเรียน')
      return
    }
    if (!imageData) {
      setError('กรุณาเลือกรูปใบหน้าก่อน')
      return
    }
    if (!consentConfirmed) {
      setError('กรุณายืนยันว่าได้รับความยินยอมจากนักเรียนหรือผู้ปกครองก่อนลงทะเบียน')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await requestApi('enroll', { studentId: selectedId, image: imageData, consentConfirmed })
      setNotice(result.message + ': ' + result.student)
      setImageData('')
      setImageName('')
      await refreshFaceStatuses()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ลงทะเบียนใบหน้าไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  async function searchFace() {
    if (!imageData) {
      setError('กรุณาเลือกรูปใบหน้าก่อน')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    setMatches([])
    try {
      const result = await requestApi('search', { image: imageData })
      setMatches((result.matches || []) as Match[])
      setNotice(result.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ค้นหาใบหน้าไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  async function deleteFace() {
    if (!selectedId) {
      setError('กรุณาเลือกนักเรียนที่ต้องการลบ')
      return
    }
    if (!window.confirm('ยืนยันลบข้อมูลใบหน้าของนักเรียนคนนี้?')) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await requestApi('delete', { studentId: selectedId })
      setNotice(result.message)
      await refreshFaceStatuses()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ลบข้อมูลใบหน้าไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const selectedStudent = students.find((student) => student.id === selectedId)

  return (
    <main className="shell admin-page-root face-recognition-admin-root" style={{ minHeight: '100vh', padding: 'clamp(16px, 3vw, 32px)', background: 'linear-gradient(135deg,#f4f7ff 0%,#f9f5ff 55%,#effcf7 100%)', color: '#172033' }}>
      <div className="topbar admin-topbar shine-admin-topbar">
        <button type="button" className="shine-admin-menu-toggle" onClick={() => setAdminDrawerOpen((open) => !open)} aria-label={adminDrawerOpen ? 'ปิดเมนู' : 'เปิดเมนู'} aria-expanded={adminDrawerOpen}>
          <span>{adminDrawerOpen ? '✕' : '☰'}</span>
        </button>
        <div>
          <div className="brand"><span className="admin-brand-icon"><Wallet size={22} strokeWidth={2.4} /></span><span>Shine Wallet <span className="admin-brand-light">Admin</span></span></div>
          <div className="muted">จัดการนักเรียน · เงิน · สินค้า · ประวัติธุรกรรม</div>
        </div>
        <div className="admin-actions">
          <Link href="/kiosk" className="btn admin-kiosk-top-btn"><Store size={17} strokeWidth={2.4} aria-hidden="true" /> จุดขาย</Link>
          <Link href="/admin" className="btn dark admin-logout-btn"><LogOut size={17} strokeWidth={2.4} aria-hidden="true" /> กลับหน้า Admin</Link>
        </div>
      </div>

      {adminDrawerOpen && <button type="button" className="shine-admin-drawer-backdrop" aria-label="ปิดเมนู" onClick={() => setAdminDrawerOpen(false)} />}
      <aside className={`shine-admin-sidebar ${adminDrawerOpen ? 'is-open' : ''}`} aria-label="เมนูผู้ดูแลระบบ">
        <div className="shine-admin-sidebar-heading">เมนูจัดการระบบ</div>
        <Link href="/admin" className="shine-admin-nav-item nav-overview" onClick={() => setAdminDrawerOpen(false)}><span>▦</span><b>ภาพรวม Dashboard</b></Link>
        <Link href="/admin" className="shine-admin-nav-item nav-students" onClick={() => setAdminDrawerOpen(false)}><span>♙</span><b>นักเรียน</b></Link>
        <Link href="/admin" className="shine-admin-nav-item nav-topup" onClick={() => setAdminDrawerOpen(false)}><span>＋</span><b>เติมเงิน / แก้ไขยอดเติมเงิน</b></Link>
        <Link href="/admin" className="shine-admin-nav-item nav-debts" onClick={() => setAdminDrawerOpen(false)}><span>▤</span><b>หนี้ค่าขนม / รับชำระคืน</b></Link>
        <Link href="/admin" className="shine-admin-nav-item nav-products" onClick={() => setAdminDrawerOpen(false)}><span>▣</span><b>สินค้า / สต็อก</b></Link>
        <Link href="/admin" className="shine-admin-nav-item nav-realtime" onClick={() => setAdminDrawerOpen(false)}><span>◉</span><b>ธุรกรรมสด</b></Link>
        <Link href="/admin" className="shine-admin-nav-item nav-history" onClick={() => setAdminDrawerOpen(false)}><span>◷</span><b>ประวัติธุรกรรม / รายงาน</b></Link>
        <Link href="/admin/face-recognition" className="shine-admin-nav-item nav-face is-active" aria-current="page" onClick={() => setAdminDrawerOpen(false)}><span><Camera size={19} strokeWidth={2.4} aria-hidden="true" /></span><b>จดจำใบหน้า</b></Link>
        <Link href="/admin" className="shine-admin-nav-item nav-settings" onClick={() => setAdminDrawerOpen(false)}><span>⚙</span><b>ตั้งค่าระบบ</b></Link>
        <Link href="/admin" className="shine-admin-nav-item nav-backup" onClick={() => setAdminDrawerOpen(false)}><span>▣</span><b>สำรองข้อมูล</b></Link>
        <Link href="/admin" className="shine-admin-nav-item nav-logout" onClick={() => setAdminDrawerOpen(false)}><span><DoorOpen size={19} strokeWidth={2.4} aria-hidden="true" /></span><b>กลับหน้า Admin</b></Link>
      </aside>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>

        <header style={{ padding: '24px', borderRadius: 24, background: 'linear-gradient(120deg,#4338ca,#7c3aed 55%,#0f9f91)', color: 'white', boxShadow: '0 18px 50px #4338ca22' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'grid', placeItems: 'center', width: 54, height: 54, borderRadius: 18, background: '#ffffff25' }}><Fingerprint size={30} /></div>
            <div>
              <h1 style={{ margin: 0, fontSize: 'clamp(24px,4vw,34px)', fontWeight: 850 }}>จดจำใบหน้า · Amazon Rekognition</h1>
              <p style={{ margin: '6px 0 0', color: '#e9e7ff' }}>ลงทะเบียนใบหน้านักเรียนและทดลองค้นหาใบหน้า</p>
            </div>
          </div>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))', gap: 18, marginTop: 20 }}>
          <article style={{ background: 'white', padding: 22, borderRadius: 22, boxShadow: '0 8px 30px #0f172a0a', border: '1px solid #e7eaf3' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 19, margin: '0 0 10px' }}><CheckCircle2 color="#0f9f91" /> 1. ตั้งค่า Collection</h2>
            <p style={{ color: '#64748b', lineHeight: 1.65, marginTop: 0 }}>สร้างพื้นที่เก็บตัวแทนใบหน้าของนักเรียนใน AWS Region ที่กำหนดใน .env.local</p>
            <button onClick={setupCollection} disabled={busy} style={{ width: '100%', border: 0, borderRadius: 12, padding: 13, background: '#4338ca', color: 'white', fontWeight: 750, cursor: busy ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {busy ? <LoaderCircle size={18} /> : <Fingerprint size={18} />} {setupDone ? 'ตรวจสอบ Collection อีกครั้ง' : 'สร้าง / ตรวจสอบ Collection'}
            </button>
          </article>

          <article style={{ background: 'white', padding: 22, borderRadius: 22, boxShadow: '0 8px 30px #0f172a0a', border: '1px solid #e7eaf3' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 19, margin: '0 0 10px' }}><Camera color="#7c3aed" /> 2. เลือกรูปใบหน้า</h2>
            <p style={{ color: '#64748b', lineHeight: 1.65, marginTop: 0 }}>ใช้รูปชัดเจน แสงเพียงพอ และมีใบหน้าของคนเดียวในภาพ</p>
            <button type="button" onClick={openCamera} disabled={busy || cameraOpen} style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, border: 0, borderRadius: 14, padding: 16, color: 'white', fontWeight: 800, fontSize: 16, cursor: busy || cameraOpen ? 'wait' : 'pointer', background: 'linear-gradient(120deg,#6d28d9,#4338ca)', boxShadow: '0 8px 20px #4338ca25' }}>
              <Camera size={22} /> เปิดกล้องถ่ายใบหน้า
            </button>
            {cameraOpen && <div style={{ marginTop: 14, padding: 12, borderRadius: 16, background: '#0f172a' }}>
              <video ref={videoRef} autoPlay muted playsInline style={{ display: 'block', width: '100%', maxHeight: 360, objectFit: 'cover', borderRadius: 12, background: '#020617' }} />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <p style={{ color: '#e2e8f0', fontSize: 13, textAlign: 'center', margin: '10px 0' }}>จัดใบหน้าให้อยู่กลางภาพและมีแสงเพียงพอ</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={captureCameraImage} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 0, borderRadius: 10, padding: 12, background: '#0f9f91', color: 'white', fontWeight: 800, cursor: 'pointer' }}><Camera size={18} /> ถ่ายภาพ</button>
                <button type="button" onClick={closeCamera} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1px solid #475569', borderRadius: 10, padding: 12, background: '#1e293b', color: 'white', fontWeight: 700, cursor: 'pointer' }}><X size={17} /> ปิดกล้อง</button>
              </div>
            </div>}
            {imageData && <div style={{ marginTop: 14, display: 'flex', gap: 14, alignItems: 'center' }}>
              <img src={imageData} alt="ตัวอย่างใบหน้า" style={{ width: 104, height: 104, objectFit: 'cover', borderRadius: 16, border: '1px solid #e2e8f0' }} />
              <div style={{ minWidth: 0 }}><strong>ภาพพร้อมใช้งาน</strong><p style={{ margin: '5px 0', color: '#64748b', overflowWrap: 'anywhere' }}>{imageName}</p><button onClick={() => { setImageData(''); setImageName(''); setMatches([]); setNotice('') }} style={{ border: 0, background: 'transparent', color: '#dc2626', cursor: 'pointer', padding: 0 }}>ถ่ายใหม่ / นำรูปออก</button></div>
            </div>}
          </article>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))', gap: 18, marginTop: 18 }}>
          <article style={{ background: 'white', padding: 22, borderRadius: 22, boxShadow: '0 8px 30px #0f172a0a', border: '1px solid #e7eaf3' }}>
            <h2 style={{ fontSize: 19, margin: '0 0 14px' }}>3. ลงทะเบียนใบหน้านักเรียน</h2>
            <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="ค้นหาชื่อหรือรหัสนักเรียน" style={{ boxSizing: 'border-box', width: '100%', border: '1px solid #dbe1ed', borderRadius: 12, padding: 12, marginBottom: 10, font: 'inherit' }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <button type="button" onClick={() => setStatusFilter(statusFilter === 'enrolled' ? null : 'enrolled')} aria-expanded={statusFilter === 'enrolled'} style={{ border: statusFilter === 'enrolled' ? '2px solid #15803d' : '1px solid transparent', padding: '7px 11px', borderRadius: 999, background: '#dcfce7', color: '#166534', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                ✓ ลงทะเบียนแล้ว {students.filter((student) => enrolledStudentIds.includes(student.id)).length} คน · คลิกดูรายชื่อ
              </button>
              <button type="button" onClick={() => setStatusFilter(statusFilter === 'not-enrolled' ? null : 'not-enrolled')} aria-expanded={statusFilter === 'not-enrolled'} style={{ border: statusFilter === 'not-enrolled' ? '2px solid #64748b' : '1px solid transparent', padding: '7px 11px', borderRadius: 999, background: '#f1f5f9', color: '#475569', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                ○ ยังไม่ลงทะเบียน {students.filter((student) => !enrolledStudentIds.includes(student.id)).length} คน · คลิกดูรายชื่อ
              </button>
              <button type="button" onClick={refreshFaceStatuses} disabled={statusLoading || busy} style={{ marginLeft: 'auto', border: '1px solid #c7d2fe', borderRadius: 999, padding: '6px 10px', background: '#eef2ff', color: '#4338ca', fontSize: 12, fontWeight: 750, cursor: statusLoading || busy ? 'wait' : 'pointer' }}>
                {statusLoading ? 'กำลังตรวจสอบ…' : '↻ รีเฟรชสถานะ'}
              </button>
            </div>
            {statusFilter && <div style={{ marginBottom: 12, padding: 14, borderRadius: 14, border: '1px solid ' + (statusFilter === 'enrolled' ? '#bbf7d0' : '#e2e8f0'), background: statusFilter === 'enrolled' ? '#f0fdf4' : '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                <strong style={{ color: statusFilter === 'enrolled' ? '#166534' : '#475569' }}>{statusFilter === 'enrolled' ? 'รายชื่อนักเรียนที่ลงทะเบียนใบหน้าแล้ว' : 'รายชื่อนักเรียนที่ยังไม่ลงทะเบียนใบหน้า'}</strong>
                <button type="button" onClick={() => setStatusFilter(null)} aria-label="ปิดรายชื่อ" style={{ border: 0, borderRadius: 8, padding: 5, background: 'transparent', color: '#64748b', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ display: 'grid', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
                {students.filter((student) => statusFilter === 'enrolled' ? enrolledStudentIds.includes(student.id) : !enrolledStudentIds.includes(student.id)).map((student) => <button key={student.id} type="button" onClick={() => { setSelectedId(student.id); setStatusFilter(null) }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '9px 10px', border: '1px solid #e2e8f0', borderRadius: 10, background: 'white', cursor: 'pointer' }}>
                  {student.photo_url ? <img src={student.photo_url} alt="" style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover' }} /> : <UserRound size={28} color="#64748b" />}
                  <span style={{ flex: 1, minWidth: 0 }}><strong style={{ display: 'block', fontSize: 13 }}>{student.full_name}</strong><span style={{ color: '#64748b', fontSize: 12 }}>{student.student_code}{student.class_name ? ' · ' + student.class_name : ''}</span></span>
                  <span style={{ color: statusFilter === 'enrolled' ? '#15803d' : '#64748b', fontSize: 12, fontWeight: 800 }}>{statusFilter === 'enrolled' ? 'ลงทะเบียนแล้ว' : 'ยังไม่ลงทะเบียน'}</span>
                </button>)}
                {students.filter((student) => statusFilter === 'enrolled' ? enrolledStudentIds.includes(student.id) : !enrolledStudentIds.includes(student.id)).length === 0 && <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>ไม่มีรายชื่อในหมวดนี้</p>}
              </div>
            </div>}
            <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} style={{ boxSizing: 'border-box', width: '100%', border: '1px solid #dbe1ed', borderRadius: 12, padding: 12, background: 'white', font: 'inherit' }}>
              <option value="">เลือกนักเรียน</option>
              {filteredStudents.map((student) => <option key={student.id} value={student.id}>{student.student_code} · {student.full_name}{student.class_name ? ' · ' + student.class_name : ''}{enrolledStudentIds.includes(student.id) ? ' · ลงทะเบียนแล้ว' : ' · ยังไม่ลงทะเบียน'}</option>)}
            </select>
            {selectedStudent && <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, padding: 12, borderRadius: 14, background: '#f8fafc' }}>
              {selectedStudent.photo_url ? <img src={selectedStudent.photo_url} alt="" style={{ width: 48, height: 48, borderRadius: 14, objectFit: 'cover' }} /> : <UserRound size={34} color="#64748b" />}
              <div style={{ flex: 1 }}>
                <strong>{selectedStudent.full_name}</strong>
                <div style={{ color: '#64748b', fontSize: 13 }}>{selectedStudent.student_code}</div>
                <div style={{ display: 'inline-flex', marginTop: 5, padding: '4px 9px', borderRadius: 999, background: enrolledStudentIds.includes(selectedStudent.id) ? '#dcfce7' : '#f1f5f9', color: enrolledStudentIds.includes(selectedStudent.id) ? '#166534' : '#475569', fontSize: 12, fontWeight: 800 }}>
                  {enrolledStudentIds.includes(selectedStudent.id) ? '✓ ลงทะเบียนใบหน้าแล้ว' : 'ยังไม่ได้ลงทะเบียนใบหน้า'}
                </div>
              </div>
            </div>}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 14, padding: 12, borderRadius: 12, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: 13, lineHeight: 1.6 }}><input type="checkbox" checked={consentConfirmed} onChange={(event) => setConsentConfirmed(event.target.checked)} style={{ marginTop: 4 }} /><span>ยืนยันว่าได้รับความยินยอมจากนักเรียนหรือผู้ปกครองให้เก็บและใช้ข้อมูลใบหน้าเพื่อการระบุตัวตนใน Shine Wallet แล้ว</span></label>
            <button onClick={enroll} disabled={busy || !selectedId || !imageData || !consentConfirmed} style={{ width: '100%', border: 0, borderRadius: 12, padding: 13, marginTop: 14, background: '#0f9f91', color: 'white', fontWeight: 750, cursor: busy ? 'wait' : 'pointer' }}>ลงทะเบียน / เปลี่ยนใบหน้า</button>
            <button onClick={deleteFace} disabled={busy || !selectedId} style={{ width: '100%', border: '1px solid #fecaca', borderRadius: 12, padding: 12, marginTop: 9, background: '#fff7f7', color: '#b91c1c', fontWeight: 700, cursor: busy ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Trash2 size={17} /> ลบข้อมูลใบหน้าที่ลงทะเบียน</button>
          </article>

          <article style={{ background: 'white', padding: 22, borderRadius: 22, boxShadow: '0 8px 30px #0f172a0a', border: '1px solid #e7eaf3' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 19, margin: '0 0 10px' }}><Search color="#2563eb" /> 4. ทดลองค้นหานักเรียน</h2>
            <p style={{ color: '#64748b', lineHeight: 1.65 }}>เลือกรูปใบหน้า แล้วกดค้นหา ระบบจะแสดงนักเรียนที่ตรงกันและคะแนนความคล้ายคลึง</p>
            <button onClick={searchFace} disabled={busy || !imageData} style={{ width: '100%', border: 0, borderRadius: 12, padding: 13, background: '#2563eb', color: 'white', fontWeight: 750, cursor: busy ? 'wait' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
              {busy ? <LoaderCircle size={18} /> : <Search size={18} />} ค้นหาใบหน้า
            </button>
            {matches.map((match) => <div key={match.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, padding: 12, borderRadius: 14, background: '#eff6ff', border: '1px solid #dbeafe' }}>
              {match.photo_url ? <img src={match.photo_url} alt="" style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover' }} /> : <UserRound size={34} color="#64748b" />}
              <div style={{ flex: 1 }}><strong>{match.full_name}</strong><div style={{ color: '#475569', fontSize: 13 }}>{match.student_code} · {match.class_name || 'ไม่ระบุชั้น'}</div></div>
              <strong style={{ color: '#1d4ed8' }}>{match.similarity.toFixed(1)}%</strong>
            </div>)}
          </article>
        </section>

        {(notice || error) && <div role="status" style={{ marginTop: 18, padding: 15, borderRadius: 14, background: error ? '#fff1f2' : '#ecfdf5', color: error ? '#be123c' : '#065f46', border: '1px solid ' + (error ? '#fecdd3' : '#a7f3d0'), fontWeight: 650 }}>{error || notice}</div>}

        <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.7, marginTop: 18 }}>หมายเหตุ: ฟังก์ชันนี้ใช้เพื่อช่วยระบุตัวนักเรียนเท่านั้น ควรได้รับความยินยอมตามนโยบายของโรงเรียน และให้เจ้าหน้าที่ตรวจสอบยืนยันก่อนทำธุรกรรมหรือเปลี่ยนแปลงยอดเงินทุกครั้ง</p>
      </div>
    </main>
  )
}