'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { supabase } from '../../lib/supabase'

type Student = {
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

type Product = {
  id: string
  name: string
  price: number
  stock: number
  image_url: string | null
  active: boolean
  created_at: string
}

type WalletTransaction = {
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

export default function AdminPage() {
  const [ready, setReady] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [students, setStudents] = useState<Student[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [selected, setSelected] = useState<Student | null>(null)
  const [history, setHistory] = useState<WalletTransaction[]>([])
  const [historyPage, setHistoryPage] = useState(1)
  const historyPageSize = 8
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'students' | 'products'>('students')
  const [historyLoading, setHistoryLoading] = useState(false)
  const [qr, setQr] = useState('')

  const totalHistoryPages = Math.max(1, Math.ceil(history.length / historyPageSize))
  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize
    return history.slice(start, start + historyPageSize)
  }, [history, historyPage, historyPageSize])

  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newClass, setNewClass] = useState('')
  const [newPhoto, setNewPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')

  const [edit, setEdit] = useState<Student | null>(null)
  const [editName, setEditName] = useState('')
  const [editCode, setEditCode] = useState('')
  const [editClass, setEditClass] = useState('')
  const [editPhoto, setEditPhoto] = useState<File | null>(null)
  const [editPhotoPreview, setEditPhotoPreview] = useState('')
  const [removePhoto, setRemovePhoto] = useState(false)

  const [topupAmount, setTopupAmount] = useState('')
  const [topupNote, setTopupNote] = useState('')
  const [topupReference, setTopupReference] = useState('')
  const [topupLoading, setTopupLoading] = useState(false)

  const [productName, setProductName] = useState('')
  const [productPrice, setProductPrice] = useState('')
  const [productStock, setProductStock] = useState('')
  const [productImage, setProductImage] = useState<File | null>(null)
  const [productEdit, setProductEdit] = useState<Product | null>(null)

  const [confirmModal, setConfirmModal] = useState<{
    title: string
    message: string
    detail?: string
    icon?: string
    confirmText?: string
    cancelText?: string
    danger?: boolean
    onConfirm: () => Promise<void> | void
  } | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    if (!supabase) {
      setMessage('ยังไม่ได้ตั้งค่า Supabase')
      setLoading(false)
      return
    }

    const { data } = await supabase.auth.getSession()

    const role =
      data.session?.user?.app_metadata?.role ||
      data.session?.user?.user_metadata?.role

    if (!data.session || role !== 'admin') {
      window.location.href = '/admin/login?next=/admin&error=not_admin'
      return
    }

    setAuthorized(true)
    setReady(true)
    await loadAll()
  }

  async function loadAll() {
    if (!supabase) return

    setLoading(true)
    setMessage('')

    const [studentsResult, productsResult, transactionsResult] = await Promise.all([
      supabase.from('students').select('id,student_code,full_name,class_name,balance,qr_token,photo_url,active,created_at').order('full_name'),
      supabase.from('products').select('id,name,price,stock,image_url,active,created_at').order('name'),
      supabase.from('wallet_transactions').select('id,student_id,type,amount,balance_before,balance_after,reference,note,created_at').order('created_at', { ascending: false }).limit(200),
    ])

    if (studentsResult.error) setMessage(`โหลดนักเรียนไม่สำเร็จ: ${studentsResult.error.message}`)
    if (productsResult.error) setMessage(`โหลดสินค้าไม่สำเร็จ: ${productsResult.error.message}`)
    if (transactionsResult.error) setMessage(`โหลดประวัติไม่สำเร็จ: ${transactionsResult.error.message}`)

    setStudents((studentsResult.data || []) as Student[])
    setProducts((productsResult.data || []) as Product[])
    setTransactions((transactionsResult.data || []) as WalletTransaction[])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return students.filter((student) => !query || student.full_name.toLowerCase().includes(query) || student.student_code.toLowerCase().includes(query) || String(student.class_name || '').toLowerCase().includes(query))
  }, [students, search])

  const totalBalance = useMemo(() => students.filter((student) => student.active).reduce((total, student) => total + Number(student.balance), 0), [students])
  const totalTopup = useMemo(() => transactions.filter((transaction) => transaction.type === 'topup').reduce((total, transaction) => total + Number(transaction.amount), 0), [transactions])
  const totalPurchase = useMemo(() => transactions.filter((transaction) => transaction.type === 'purchase').reduce((total, transaction) => total + Number(transaction.amount), 0), [transactions])

  async function uploadPhoto(file: File, studentId: string) {
    if (!supabase) return null
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${studentId}-${Date.now()}.${extension}`
    const { error } = await supabase.storage.from('student-photos').upload(path, file, { upsert: true })
    if (error) throw error
    return supabase.storage.from('student-photos').getPublicUrl(path).data.publicUrl
  }

  async function addStudent() {
    if (!supabase) return
    if (!newName.trim() || !newCode.trim()) return setMessage('กรุณากรอกชื่อและรหัสนักเรียน')
    setLoading(true)
    try {
      const { data, error } = await supabase.from('students').insert({ full_name: newName.trim(), student_code: newCode.trim(), class_name: newClass.trim() || null }).select().single()
      if (error) throw error
      let row = data as Student
      if (newPhoto) {
        const url = await uploadPhoto(newPhoto, row.id)
        const { data: updated, error: updateError } = await supabase.from('students').update({ photo_url: url }).eq('id', row.id).select().single()
        if (updateError) throw updateError
        row = updated as Student
      }
      setStudents((value) => [...value, row].sort((a, b) => a.full_name.localeCompare(b.full_name)))
      setNewName(''); setNewCode(''); setNewClass(''); setNewPhoto(null); setPhotoPreview('')
      setMessage('เพิ่มนักเรียนเรียบร้อยแล้ว')
    } catch (error) {
      setMessage(`เพิ่มนักเรียนไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`)
    } finally { setLoading(false) }
  }

  function openEdit(student: Student) {
    setEdit(student); setEditName(student.full_name); setEditCode(student.student_code); setEditClass(student.class_name || ''); setEditPhoto(null); setEditPhotoPreview(student.photo_url || ''); setRemovePhoto(false)
  }

  async function saveEdit() {
    if (!supabase || !edit) return
    if (!editName.trim() || !editCode.trim()) return setMessage('กรุณากรอกชื่อและรหัสนักเรียน')
    setLoading(true)
    try {
      let photoUrl = edit.photo_url
      if (removePhoto) photoUrl = null
      if (editPhoto) photoUrl = await uploadPhoto(editPhoto, edit.id)
      const { data, error } = await supabase.from('students').update({ full_name: editName.trim(), student_code: editCode.trim(), class_name: editClass.trim() || null, photo_url: photoUrl }).eq('id', edit.id).select().single()
      if (error) throw error
      const updated = data as Student
      setStudents((value) => value.map((student) => student.id === edit.id ? updated : student))
      if (selected?.id === edit.id) setSelected(updated)
      setEdit(null); setMessage('แก้ไขข้อมูลนักเรียนเรียบร้อยแล้ว')
    } catch (error) {
      setMessage(`แก้ไขไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`)
    } finally { setLoading(false) }
  }

  async function executeDeleteStudent(student: Student) {
    if (!supabase) return
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('admin_deactivate_student', { p_student_id: student.id })
      if (error) throw error
      const updated = data as Student
      setStudents((value) => value.map((current) => current.id === student.id ? updated : current))
      if (selected?.id === student.id) setSelected(null)
      setMessage(`ปิดการใช้งาน ${student.full_name} เรียบร้อยแล้ว`)
    } catch (error) {
      setMessage(`ลบไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`)
    } finally { setLoading(false) }
  }

  function requestDeleteStudent(student: Student) {
    setConfirmModal({
      title: 'ยืนยันปิดการใช้งานนักเรียน',
      message: `คุณต้องการปิดการใช้งานบัญชี "${student.full_name}" ใช่หรือไม่?`,
      detail: `รหัส: ${student.student_code} ${student.class_name ? `· ชั้น: ${student.class_name}` : ''} · ยอดคงเหลือ: ฿${Number(student.balance).toFixed(2)}`,
      icon: '👤',
      confirmText: 'ปิดการใช้งาน',
      cancelText: 'ยกเลิก',
      danger: true,
      onConfirm: () => executeDeleteStudent(student),
    })
  }

  async function topup() {
    if (!supabase || !selected) return
    const amount = Number(topupAmount)
    if (!Number.isFinite(amount) || amount <= 0) return setMessage('กรุณากรอกจำนวนเงินให้ถูกต้อง')
    setTopupLoading(true)
    try {
      const { data, error } = await supabase.rpc('topup_student', { p_student_id: selected.id, p_amount: amount, p_reference: topupReference.trim() || null, p_note: topupNote.trim() || 'เติมเงินโดย Admin' })
      if (error) throw error
      const updated = data as Student
      setStudents((value) => value.map((student) => student.id === selected.id ? updated : student))
      setSelected(updated); setTopupAmount(''); setTopupReference(''); setTopupNote(''); setMessage(`เติมเงินสำเร็จ ฿${amount.toFixed(2)}`); await openHistory(updated)
    } catch (error) {
      setMessage(`เติมเงินไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`)
    } finally { setTopupLoading(false) }
  }

  async function openHistory(student: Student) {
    if (!supabase) return
    setSelected(student)
    setHistoryLoading(true)
    setHistoryPage(1)
    const { data, error } = await supabase.from('wallet_transactions').select('id,student_id,type,amount,balance_before,balance_after,reference,note,created_at').eq('student_id', student.id).order('created_at', { ascending: false })
    if (error) setMessage(`โหลดประวัติไม่สำเร็จ: ${error.message}`)
    setHistory((data || []) as WalletTransaction[])
    setHistoryLoading(false)
  }

  async function showQr(student: Student) {
    try { setQr(await QRCode.toDataURL(`SW:${student.qr_token}`, { width: 420, margin: 2 })) }
    catch (error) { setMessage(`สร้าง QR ไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`) }
  }

  async function executeLogout() {
    await supabase?.auth.signOut()
    window.location.href = '/admin/login'
  }

  function requestLogout() {
    setConfirmModal({
      title: 'ยืนยันออกจากระบบ',
      message: 'คุณต้องการออกจากระบบ Admin ใช่หรือไม่?',
      detail: 'เมื่อออกจากระบบแล้ว คุณจะต้องเข้าสู่ระบบใหม่ด้วยอีเมลและรหัสผ่าน',
      icon: '🚪',
      confirmText: 'ออกจากระบบ',
      cancelText: 'ยกเลิก',
      danger: true,
      onConfirm: executeLogout,
    })
  }

  async function saveProduct() {
    if (!supabase) return
    const price = Number(productPrice); const stock = Math.floor(Number(productStock))
    if (!productName.trim() || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) return setMessage('กรุณากรอกข้อมูลสินค้าให้ถูกต้อง')
    setLoading(true)
    try {
      let imageUrl = productEdit?.image_url || null
      if (productImage) {
        const extension = productImage.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `products/${Date.now()}.${extension}`
        const upload = await supabase.storage.from('student-photos').upload(path, productImage, { upsert: true })
        if (upload.error) throw upload.error
        imageUrl = supabase.storage.from('student-photos').getPublicUrl(path).data.publicUrl
      }
      if (productEdit) {
        const { data, error } = await supabase.from('products').update({ name: productName.trim(), price, stock, image_url: imageUrl }).eq('id', productEdit.id).select().single()
        if (error) throw error
        setProducts((value) => value.map((product) => product.id === productEdit.id ? data as Product : product))
      } else {
        const { data, error } = await supabase.from('products').insert({ name: productName.trim(), price, stock, image_url: imageUrl }).select().single()
        if (error) throw error
        setProducts((value) => [...value, data as Product].sort((a, b) => a.name.localeCompare(b.name)))
      }
      setProductEdit(null); setProductName(''); setProductPrice(''); setProductStock(''); setProductImage(null); setMessage('บันทึกสินค้าเรียบร้อยแล้ว')
    } catch (error) { setMessage(`บันทึกสินค้าไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`) }
    finally { setLoading(false) }
  }

  function editProduct(product: Product) {
    setProductEdit(product); setProductName(product.name); setProductPrice(String(product.price)); setProductStock(String(product.stock)); setProductImage(null)
  }

  async function executeDeleteProduct(product: Product) {
    if (!supabase) return
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('admin_deactivate_product', { p_product_id: product.id })
      if (error) throw error
      setProducts((value) => value.map((current) => current.id === product.id ? data as Product : current))
      setMessage(`ปิดการขาย ${product.name} เรียบร้อยแล้ว`)
    } catch (error) { setMessage(`ลบสินค้าไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`) }
    finally { setLoading(false) }
  }

  function requestDeleteProduct(product: Product) {
    setConfirmModal({
      title: 'ยืนยันปิดการขายสินค้า',
      message: `คุณต้องการปิดการขาย "${product.name}" ใช่หรือไม่?`,
      detail: `ราคา: ฿${Number(product.price).toFixed(2)} · สินค้าคงเหลือในสต็อก: ${product.stock} ชิ้น`,
      icon: '🛍️',
      confirmText: 'ปิดการขาย',
      cancelText: 'ยกเลิก',
      danger: true,
      onConfirm: () => executeDeleteProduct(product),
    })
  }

  if (!ready || !authorized) return <main className="shell"><div className="card">กำลังตรวจสอบสิทธิ์ Admin...</div></main>

  return (
    <main className="shell">
      <div className="topbar admin-topbar">
        <div><div className="brand">⚙️ School Wallet Admin</div><div className="muted">จัดการนักเรียน · เงิน · สินค้า · ประวัติธุรกรรม</div></div>
        <div className="admin-actions">
          <Link href="/kiosk" className="btn admin-kiosk-top-btn">🏪 จุดขาย</Link>
          <button className="btn dark" onClick={requestLogout}>ออกจากระบบ</button>
        </div>
      </div>

      {/* Mobile Quick Kiosk Banner */}
      <div className="admin-mobile-kiosk-banner">
        <div className="admin-kiosk-banner-body">
          <div className="admin-kiosk-banner-icon">🏪</div>
          <div className="admin-kiosk-banner-text">
            <span className="admin-kiosk-banner-badge">จุดขายสำหรับมือถือ</span>
            <h3>เข้าสู่ระบบจุดขาย (Kiosk)</h3>
            <p>สแกน QR นักเรียน หรือค้นหาเพื่อชำระเงินและเติมเงิน</p>
          </div>
        </div>
        <Link href="/kiosk" className="admin-kiosk-banner-btn">
          <span>เปิดจุดขาย / สแกน QR</span>
          <strong>→</strong>
        </Link>
      </div>

      {message && <div className="status" style={{ marginBottom: 16 }}>{message}</div>}

      <div className="grid admin-stats">
        <div className="card"><div className="stat-icon blue">👨‍🎓</div><div><div className="muted">นักเรียน</div><div className="stat-number">{students.filter((student) => student.active).length}</div><div className="muted">คน</div></div></div>
        <div className="card"><div className="stat-icon green">฿</div><div><div className="muted">ยอดเงินคงเหลือรวม</div><div className="stat-number">฿{totalBalance.toFixed(2)}</div></div></div>
        <div className="card"><div className="stat-icon purple">↔</div><div><div className="muted">ธุรกรรม</div><div className="stat-number">{transactions.length}</div><div className="muted">เติม ฿{totalTopup.toFixed(2)} · ซื้อ ฿{totalPurchase.toFixed(2)}</div></div></div>
      </div>

      <div className="admin-tabs">
        <button className={`admin-tab ${tab === 'students' ? 'active' : ''}`} onClick={() => setTab('students')}><span>👨‍🎓</span><b>นักเรียน</b><small>จัดการนักเรียนและเติมเงิน</small></button>
        <button className={`admin-tab ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')}><span>🛍️</span><b>สินค้า</b><small>จัดการสินค้าและสต็อก</small></button>
      </div>

      {tab === 'students' ? (
        <>
          <div className="card admin-section">
            <div className="section-heading"><div><h2>เพิ่มนักเรียน</h2><p className="muted">สร้างบัญชีนักเรียนพร้อมรูปและ QR Code</p></div></div>
            <div className="row admin-add-row">
              <input className="input" placeholder="ชื่อ-นามสกุล" value={newName} onChange={(event) => setNewName(event.target.value)} />
              <input className="input" placeholder="รหัสนักเรียน" value={newCode} onChange={(event) => setNewCode(event.target.value)} />
              <input className="input" placeholder="ชั้นเรียน" value={newClass} onChange={(event) => setNewClass(event.target.value)} />
              <label className="btn upload-btn">📷 เพิ่มรูป<input type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0] || null; setNewPhoto(file); setPhotoPreview(file ? URL.createObjectURL(file) : '') }} /></label>
              <button className="btn primary" onClick={addStudent} disabled={loading}>＋ เพิ่มนักเรียน</button>
            </div>
            {photoPreview && <img src={photoPreview} alt="preview" className="admin-preview" />}
          </div>

          <div className="card admin-section">
            <div className="section-heading"><div><h2>รายชื่อนักเรียน</h2><p className="muted">เลือกนักเรียนเพื่อเติมเงิน ดูประวัติ หรือแสดง QR</p></div><input className="input admin-search" placeholder="🔎 ค้นหาชื่อ / รหัส / ชั้น" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
            <div className="student-list">
              {filtered.filter((student) => student.active).map((student) => (
                <div className="student-row" key={student.id}>
                  <div className="student-main">{student.photo_url ? <img src={student.photo_url} alt="" className="student-avatar" /> : <div className="student-avatar-placeholder student-avatar">👤</div>}<div><b>{student.full_name}</b><div className="muted">{student.student_code} · {student.class_name || 'ไม่ระบุชั้น'}</div></div></div>
                  <div className="student-balance">฿{Number(student.balance).toFixed(2)}</div>
                  <div className="student-actions"><button className="btn primary" onClick={() => openHistory(student)}>＋ เติมเงิน</button><button className="btn" onClick={() => showQr(student)}>▦ QR</button><button className="btn" onClick={() => openEdit(student)}>✎ แก้ไข</button><button className="btn danger-btn" onClick={() => requestDeleteStudent(student)}>ปิดใช้งาน</button></div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="card admin-section">
          <div className="section-heading"><div><h2>จัดการสินค้า</h2><p className="muted">เพิ่ม แก้ไขราคา สต็อก และปิดการขาย</p></div><button className="btn primary" onClick={() => { setProductEdit(null); setProductName(''); setProductPrice(''); setProductStock('') }}>＋ สินค้าใหม่</button></div>
          <div className="product-form"><input className="input" placeholder="ชื่อสินค้า" value={productName} onChange={(event) => setProductName(event.target.value)} /><input className="input" type="number" min="0" step="0.01" placeholder="ราคา" value={productPrice} onChange={(event) => setProductPrice(event.target.value)} /><input className="input" type="number" min="0" step="1" placeholder="Stock" value={productStock} onChange={(event) => setProductStock(event.target.value)} /><label className="btn upload-btn">📷 รูปสินค้า<input type="file" accept="image/*" hidden onChange={(event) => setProductImage(event.target.files?.[0] || null)} /></label><button className="btn primary" onClick={saveProduct}>{productEdit ? 'บันทึกแก้ไข' : 'เพิ่มสินค้า'}</button></div>
          <div className="products admin-products">{products.filter((product) => product.active).map((product) => <div className="product admin-product" key={product.id}>{product.image_url ? <img src={product.image_url} alt="" className="product-thumb" /> : <div className="product-thumb-placeholder">🛍️</div>}<div className="product-info"><b>{product.name}</b><div className="muted">฿{Number(product.price).toFixed(2)} · เหลือ {product.stock} ชิ้น</div></div><div className="row"><button className="btn" onClick={() => editProduct(product)}>✎ แก้ไข</button><button className="btn danger-btn" onClick={() => requestDeleteProduct(product)}>ปิดการขาย</button></div></div>)}</div>
        </div>
      )}

      {selected && (
        <div className="card admin-section history-panel">
          {/* Header */}
          <div className="history-header">
            <div className="history-student-info">
              {selected.photo_url ? (
                <img src={selected.photo_url} alt="" className="history-avatar" />
              ) : (
                <div className="history-avatar history-avatar-placeholder">👤</div>
              )}
              <div>
                <span className="history-student-badge">ประวัติการเงินนักเรียน</span>
                <h2>{selected.full_name}</h2>
                <div className="muted">
                  รหัส: <b>{selected.student_code}</b> · ชั้น: {selected.class_name || 'ไม่ระบุชั้น'}
                </div>
              </div>
            </div>

            <div className="history-header-actions">
              <div className="history-current-balance">
                <span>ยอดเงินคงเหลือ</span>
                <strong>฿{Number(selected.balance).toFixed(2)}</strong>
              </div>
              <button
                type="button"
                className="btn history-close-btn"
                onClick={() => setSelected(null)}
                aria-label="ปิดหน้าต่างประวัติ"
              >
                ✕ ปิดหน้าต่าง
              </button>
            </div>
          </div>

          {/* Quick Topup Form */}
          <div className="history-topup-card">
            <div className="history-topup-title">
              <span>💰 เติมเงินให้นักเรียน</span>
              <small className="muted">เติมเงินเข้ากระเป๋าของนักเรียนได้ทันที</small>
            </div>

            <div className="history-presets">
              {[20, 50, 100, 200, 500].map((preset) => (
                <button
                  type="button"
                  key={preset}
                  className={`history-preset-btn ${Number(topupAmount) === preset ? 'active' : ''}`}
                  onClick={() => setTopupAmount(String(preset))}
                >
                  ฿{preset}
                </button>
              ))}
            </div>

            <div className="row history-topup-row">
              <div className="history-input-wrap">
                <span className="history-currency-symbol">฿</span>
                <input
                  className="input history-amount-input"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="จำนวนเงิน"
                  value={topupAmount}
                  onChange={(event) => setTopupAmount(event.target.value)}
                />
              </div>
              <input
                className="input"
                placeholder="อ้างอิง เช่น เลขสลิป (ถ้ามี)"
                value={topupReference}
                onChange={(event) => setTopupReference(event.target.value)}
              />
              <input
                className="input"
                placeholder="หมายเหตุ (ถ้ามี)"
                value={topupNote}
                onChange={(event) => setTopupNote(event.target.value)}
              />
              <button
                type="button"
                className="btn primary history-topup-submit-btn"
                onClick={topup}
                disabled={topupLoading || !topupAmount || Number(topupAmount) <= 0}
              >
                {topupLoading ? 'กำลังเติม...' : `＋ เติมเงิน ${topupAmount ? `฿${Number(topupAmount).toFixed(2)}` : ''}`}
              </button>
            </div>
          </div>

          {/* Transaction History Section */}
          <div className="history-table-section">
            <div className="history-section-header">
              <div>
                <h3>📜 ประวัติการเงิน &amp; ธุรกรรม</h3>
                <p className="muted">
                  {history.length > 0
                    ? `พบทั้งหมด ${history.length} รายการ (เรียงจากล่าสุด)`
                    : 'ยังไม่มีประวัติการทำรายการ'}
                </p>
              </div>

              {history.length > 0 && (
                <div className="history-page-indicator">
                  หน้า <b>{historyPage}</b> / {totalHistoryPages}
                </div>
              )}
            </div>

            {historyLoading ? (
              <div className="status" style={{ margin: '20px 0' }}>
                ⏳ กำลังโหลดประวัติการเงิน...
              </div>
            ) : !history.length ? (
              <div className="history-empty-state">
                <div className="history-empty-icon">📭</div>
                <h4>ยังไม่มีรายการประวัติการเงิน</h4>
                <p className="muted">เมื่อนักเรียนมีการเติมเงินหรือซื้อสินค้า รายการจะแสดงที่นี่</p>
              </div>
            ) : (
              <>
                <div className="history-table-wrap">
                  <table className="admin-table history-styled-table">
                    <thead>
                      <tr>
                        <th style={{ minWidth: 140 }}>วันเวลา</th>
                        <th style={{ minWidth: 120 }}>ประเภท</th>
                        <th style={{ minWidth: 120, textAlign: 'right' }}>ยอดเงิน</th>
                        <th style={{ minWidth: 160 }}>ยอดคงเหลือ (ก่อน → หลัง)</th>
                        <th style={{ minWidth: 170 }}>หมายเหตุ / อ้างอิง</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedHistory.map((transaction) => {
                        const isPurchase = transaction.type === 'purchase'
                        const isTopup = transaction.type === 'topup'
                        const isRefund = transaction.type === 'refund'

                        return (
                          <tr key={transaction.id} className="history-row">
                            <td className="history-date-cell">
                              <b>
                                {new Date(transaction.created_at).toLocaleDateString('th-TH', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </b>
                              <span className="history-time">
                                {new Date(transaction.created_at).toLocaleTimeString('th-TH', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })} น.
                              </span>
                            </td>

                            <td>
                              {isPurchase && (
                                <span className="history-badge badge-purchase">
                                  🛍️ ซื้อสินค้า
                                </span>
                              )}
                              {isTopup && (
                                <span className="history-badge badge-topup">
                                  💰 เติมเงิน
                                </span>
                              )}
                              {isRefund && (
                                <span className="history-badge badge-refund">
                                  ↩ คืนเงิน
                                </span>
                              )}
                              {!isPurchase && !isTopup && !isRefund && (
                                <span className="history-badge badge-adjustment">
                                  ⚙ ปรับยอด
                                </span>
                              )}
                            </td>

                            <td className="history-amount-cell" style={{ textAlign: 'right' }}>
                              <span
                                className={`history-amount-text ${
                                  isPurchase
                                    ? 'amount-red'
                                    : isTopup || isRefund
                                    ? 'amount-green'
                                    : 'amount-neutral'
                                }`}
                              >
                                {isPurchase ? '−' : isTopup || isRefund ? '＋' : ''}฿
                                {Number(transaction.amount).toFixed(2)}
                              </span>
                            </td>

                            <td>
                              <div className="history-balance-flow">
                                <span>฿{Number(transaction.balance_before).toFixed(2)}</span>
                                <span className="history-flow-arrow">→</span>
                                <b className={isPurchase ? 'flow-after-less' : 'flow-after-more'}>
                                  ฿{Number(transaction.balance_after).toFixed(2)}
                                </b>
                              </div>
                            </td>

                            <td className="history-note-cell">
                              <div className="history-note-text">
                                {transaction.note || '—'}
                              </div>
                              {transaction.reference && (
                                <span className="history-ref-tag">
                                  Ref: {transaction.reference}
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalHistoryPages > 1 && (
                  <div className="history-pagination">
                    <div className="pagination-info muted">
                      แสดงรายการที่ {(historyPage - 1) * historyPageSize + 1} -{' '}
                      {Math.min(historyPage * historyPageSize, history.length)} จากทั้งหมด{' '}
                      {history.length} รายการ
                    </div>

                    <div className="pagination-buttons">
                      <button
                        type="button"
                        className="pagination-btn"
                        onClick={() => setHistoryPage(1)}
                        disabled={historyPage === 1}
                        title="หน้าแรก"
                      >
                        «
                      </button>
                      <button
                        type="button"
                        className="pagination-btn"
                        onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                        disabled={historyPage === 1}
                      >
                        ‹ ก่อนหน้า
                      </button>

                      <div className="pagination-pages">
                        {Array.from({ length: totalHistoryPages }, (_, i) => i + 1)
                          .filter(
                            (page) =>
                              page === 1 ||
                              page === totalHistoryPages ||
                              Math.abs(page - historyPage) <= 1,
                          )
                          .map((page, idx, array) => {
                            const prev = array[idx - 1]
                            const showEllipsis = prev && page - prev > 1
                            return (
                              <span key={page} style={{ display: 'inline-flex', alignItems: 'center' }}>
                                {showEllipsis && <span className="pagination-ellipsis">…</span>}
                                <button
                                  type="button"
                                  className={`pagination-number ${historyPage === page ? 'active' : ''}`}
                                  onClick={() => setHistoryPage(page)}
                                >
                                  {page}
                                </button>
                              </span>
                            )
                          })}
                      </div>

                      <button
                        type="button"
                        className="pagination-btn"
                        onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                        disabled={historyPage === totalHistoryPages}
                      >
                        ถัดไป ›
                      </button>
                      <button
                        type="button"
                        className="pagination-btn"
                        onClick={() => setHistoryPage(totalHistoryPages)}
                        disabled={historyPage === totalHistoryPages}
                        title="หน้าสุดท้าย"
                      >
                        »
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {qr && <div className="card qr-panel"><h2>▦ QR นักเรียน</h2><img src={qr} alt="Student QR" /><button className="btn" onClick={() => setQr('')}>ปิด QR</button></div>}

      {edit && <div className="card admin-section"><div className="section-heading"><h2>✎ แก้ไขนักเรียน</h2><button className="btn" onClick={() => setEdit(null)}>ยกเลิก</button></div><div className="row admin-edit-row"><input className="input" value={editName} onChange={(event) => setEditName(event.target.value)} placeholder="ชื่อ" /><input className="input" value={editCode} onChange={(event) => setEditCode(event.target.value)} placeholder="รหัส" /><input className="input" value={editClass} onChange={(event) => setEditClass(event.target.value)} placeholder="ชั้น" /><label className="btn upload-btn">📷 เปลี่ยนรูป<input type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0] || null; setEditPhoto(file); setEditPhotoPreview(file ? URL.createObjectURL(file) : edit.photo_url || '') }} /></label><button className="btn" onClick={() => { setRemovePhoto(true); setEditPhoto(null); setEditPhotoPreview('') }}>ลบรูป</button><button className="btn primary" onClick={saveEdit}>บันทึก</button></div>{editPhotoPreview && <img src={editPhotoPreview} alt="preview" className="admin-preview" />}</div>}

      {/* Mobile Rich Menu (Bottom Navigation) */}
      <nav className="admin-mobile-menu" aria-label="Admin Mobile Navigation">
        <button
          type="button"
          className={`admin-menu-item ${tab === 'students' ? 'active' : ''}`}
          onClick={() => {
            setTab('students')
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        >
          <span className="admin-menu-icon">👨‍🎓</span>
          <b className="admin-menu-label">นักเรียน</b>
          <small className="admin-menu-sub">{students.filter((s) => s.active).length} คน</small>
        </button>

        <button
          type="button"
          className={`admin-menu-item ${tab === 'products' ? 'active' : ''}`}
          onClick={() => {
            setTab('products')
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        >
          <span className="admin-menu-icon">🛍️</span>
          <b className="admin-menu-label">สินค้า</b>
          <small className="admin-menu-sub">{products.filter((p) => p.active).length} ชิ้น</small>
        </button>

        <Link href="/kiosk" className="admin-menu-item admin-menu-kiosk">
          <span className="admin-menu-icon">🏪</span>
          <b className="admin-menu-label">จุดขาย</b>
          <small className="admin-menu-sub">KIOSK</small>
        </Link>

        <button
          type="button"
          className="admin-menu-item"
          onClick={() => {
            setTab('students')
            if (students[0]) openHistory(students[0])
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        >
          <span className="admin-menu-icon">💰</span>
          <b className="admin-menu-label">เติมเงิน</b>
          <small className="admin-menu-sub">ด่วน</small>
        </button>

        <button
          type="button"
          className="admin-menu-item admin-menu-logout"
          onClick={requestLogout}
        >
          <span className="admin-menu-icon">🚪</span>
          <b className="admin-menu-label">ออกระบบ</b>
          <small className="admin-menu-sub">Logout</small>
        </button>
      </nav>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div
          className="confirm-modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !confirmLoading) {
              setConfirmModal(null)
            }
          }}
        >
          <div className="confirm-modal-card" role="dialog" aria-modal="true">
            <div className="confirm-modal-icon-ring">
              <span>{confirmModal.icon || '⚠️'}</span>
            </div>
            <h3 className="confirm-modal-title">{confirmModal.title}</h3>
            <p className="confirm-modal-message">{confirmModal.message}</p>

            {confirmModal.detail && (
              <div className="confirm-modal-detail">
                {confirmModal.detail}
              </div>
            )}

            <div className="confirm-modal-actions">
              <button
                type="button"
                className="confirm-modal-btn cancel"
                onClick={() => setConfirmModal(null)}
                disabled={confirmLoading}
              >
                {confirmModal.cancelText || 'ยกเลิก'}
              </button>
              <button
                type="button"
                className={`confirm-modal-btn confirm ${confirmModal.danger !== false ? 'danger' : 'primary'}`}
                onClick={async () => {
                  setConfirmLoading(true)
                  try {
                    await confirmModal.onConfirm()
                    setConfirmModal(null)
                  } catch (err: any) {
                    setMessage(`เกิดข้อผิดพลาด: ${err?.message || String(err)}`)
                  } finally {
                    setConfirmLoading(false)
                  }
                }}
                disabled={confirmLoading}
              >
                {confirmLoading ? 'กำลังดำเนินการ...' : (confirmModal.confirmText || 'ยืนยัน')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
