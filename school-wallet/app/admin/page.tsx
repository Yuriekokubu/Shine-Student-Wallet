'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { supabase } from '../../lib/supabase'
import { useWalletRealtime } from '../../lib/use-wallet-realtime'
import WalletDashboard from '../../components/admin/WalletDashboard'
import { Activity, CheckCircle2, ClipboardCheck, GraduationCap, History, LayoutDashboard, LogOut, Package, Pencil, Plus, QrCode, RadioTower, Search, ShoppingBag, Store, Trash2, UsersRound, Wallet, X } from 'lucide-react'
import AdminOverlays from '../../components/admin/AdminOverlays'
import RealtimeTransactionsPanel from '../../components/admin/RealtimeTransactionsPanel'
import PurchaseDetailsModal, { type PurchaseItem } from '../../components/admin/PurchaseDetailsModal'
import type { Student, Product, WalletTransaction, ConfirmModalData } from '../../types/admin'
import './admin-page.css'

type SnackDebtItem = {
  name: string
  quantity: number
  unit_price: number
  subtotal: number
}

type SnackDebt = {
  id: string
  student_id: string
  order_id: string
  amount: number
  items: SnackDebtItem[]
  status: 'unpaid' | 'paid'
  created_at: string
  paid_at: string | null
  student: {
    full_name: string
    student_code: string
    class_name: string | null
  } | null
}

export default function AdminPage() {
  const [ready, setReady] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [students, setStudents] = useState<Student[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [snackDebts, setSnackDebts] = useState<SnackDebt[]>([])
  const [debtLoading, setDebtLoading] = useState(false)
  const [debtMessage, setDebtMessage] = useState('')
  const [debtActionId, setDebtActionId] = useState<string | null>(null)
  const [debtApprovalModal, setDebtApprovalModal] = useState<SnackDebt | null>(null)
  const [selected, setSelected] = useState<Student | null>(null)
  const [history, setHistory] = useState<WalletTransaction[]>([])
  const [historyPage, setHistoryPage] = useState(1)
  const historyPageSize = 8
  const [realtimePage, setRealtimePage] = useState(1)
  const realtimePageSize = 8
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'dashboard' | 'students' | 'products' | 'realtime' | 'debts'>('dashboard')
  const { connected: realtimeConnected, error: realtimeError } = useWalletRealtime((table) => {
    if (!supabase) return

    // Update only the table that changed instead of reloading all admin data.
    if (table === 'students') {
      void supabase
        .from('students')
        .select('id,student_code,full_name,class_name,balance,qr_token,photo_url,active,created_at')
        .order('full_name')
        .then(({ data, error }) => {
          if (!error) setStudents((data || []) as Student[])
        })
      return
    }

    if (table === 'products') {
      void supabase
        .from('products')
        .select('id,name,price,stock,image_url,active,created_at')
        .order('name')
        .then(({ data, error }) => {
          if (!error) setProducts((data || []) as Product[])
        })
      return
    }

    if (table === 'wallet_transactions') {
      void supabase
        .from('wallet_transactions')
        .select('id,student_id,type,amount,balance_before,balance_after,reference,note,created_at')
        .order('created_at', { ascending: false })
        .limit(200)
        .then(({ data, error }) => {
          if (!error) setTransactions((data || []) as WalletTransaction[])
        })
    }

    if (table === 'snack_debts') {
      void loadSnackDebts()
    }
  }, authorized, true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [purchaseDetailsTransaction, setPurchaseDetailsTransaction] = useState<WalletTransaction | null>(null)
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([])
  const [purchaseDetailsLoading, setPurchaseDetailsLoading] = useState(false)
  const [purchaseDetailsError, setPurchaseDetailsError] = useState('')
  const [qr, setQr] = useState('')

  const selectedHistory = useMemo(() => {
    if (!selected) return []
    return history.filter((transaction) => transaction.student_id === selected.id)
  }, [history, selected])

  const totalHistoryPages = Math.max(1, Math.ceil(selectedHistory.length / historyPageSize))
  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize
    return selectedHistory.slice(start, start + historyPageSize)
  }, [selectedHistory, historyPage, historyPageSize])

  const totalRealtimePages = Math.max(1, Math.ceil(transactions.length / realtimePageSize))
  const paginatedRealtime = useMemo(() => {
    const start = (realtimePage - 1) * realtimePageSize
    return transactions.slice(start, start + realtimePageSize)
  }, [transactions, realtimePage, realtimePageSize])

  useEffect(() => {
    if (realtimePage > totalRealtimePages) {
      setRealtimePage(totalRealtimePages)
    }
  }, [realtimePage, totalRealtimePages])

  const [newName, setNewName] = useState('')
  const [newGroup, setNewGroup] = useState('เด็กเล็ก')
  const [newPhoto, setNewPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')

  const [edit, setEdit] = useState<Student | null>(null)
  const [editName, setEditName] = useState('')
  const [editGroup, setEditGroup] = useState('เด็กเล็ก')
  const [editPhoto, setEditPhoto] = useState<File | null>(null)
  const [editPhotoPreview, setEditPhotoPreview] = useState('')
  const [removePhoto, setRemovePhoto] = useState(false)

  const [topupAmount, setTopupAmount] = useState('')
  const [topupNote, setTopupNote] = useState('')
  const [topupReference, setTopupReference] = useState('')
  const [topupLoading, setTopupLoading] = useState(false)
  const [topupModalOpen, setTopupModalOpen] = useState(false)
  const [topupStudentPickerOpen, setTopupStudentPickerOpen] = useState(false)
  const [topupStudentSearch, setTopupStudentSearch] = useState('')
  const [editTopup, setEditTopup] = useState<WalletTransaction | null>(null)
  const [editTopupAmount, setEditTopupAmount] = useState('')
  const [editTopupNote, setEditTopupNote] = useState('')
  const [editTopupReference, setEditTopupReference] = useState('')
  const [editTopupLoading, setEditTopupLoading] = useState(false)

  const [productName, setProductName] = useState('')
  const [productPrice, setProductPrice] = useState('')
  const [productStock, setProductStock] = useState('')
  const [productImage, setProductImage] = useState<File | null>(null)
  const [productEdit, setProductEdit] = useState<Product | null>(null)

  const [confirmModal, setConfirmModal] = useState<ConfirmModalData | null>(null)
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

  async function loadSnackDebts() {
    if (!supabase) return

    setDebtLoading(true)
    setDebtMessage('')

    const { data, error } = await supabase
      .from('snack_debts')
      .select('id,student_id,order_id,amount,items,status,created_at,paid_at,student:students!snack_debts_student_id_fkey(full_name,student_code,class_name)')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      setDebtMessage(`โหลดประวัติติดเงินไม่สำเร็จ: ${error.message}`)
      setSnackDebts([])
    } else {
      setSnackDebts((data || []) as unknown as SnackDebt[])
    }

    setDebtLoading(false)
  }

  async function approveSnackDebtPayment(debtId: string) {
    if (!supabase || debtActionId) return

    setDebtActionId(debtId)
    setDebtMessage('กำลังอนุมัติการชำระเงิน...')

    try {
      const { error } = await supabase.rpc('approve_snack_debt_payment', {
        p_debt_id: debtId,
      })

      if (error) {
        setDebtMessage(`อนุมัติไม่สำเร็จ: ${error.message}`)
      } else {
        setDebtApprovalModal(null)
        setDebtMessage('อนุมัติรับชำระเงินคืนเรียบร้อยแล้ว')
        await loadSnackDebts()
      }
    } catch (error) {
      setDebtMessage(`อนุมัติไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setDebtActionId(null)
    }
  }

  // Prepare the active student list once so the students tab and top-up picker
  // don't repeatedly filter and sort the full dataset during renders.
  const activeStudents = useMemo(
    () => students.filter((student) => student.active),
    [students],
  )

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return activeStudents
      .filter((student) => !query || student.full_name.toLowerCase().includes(query) || student.student_code.toLowerCase().includes(query) || String(student.class_name || '').toLowerCase().includes(query))
      .sort((a, b) => {
        const groupOrder = (group: string | null) => group === 'เด็กโต' ? 0 : group === 'เด็กเล็ก' ? 1 : 2
        return groupOrder(a.class_name) - groupOrder(b.class_name) || a.full_name.localeCompare(b.full_name, 'th')
      })
  }, [activeStudents, search])

  const topupPickerStudents = useMemo(() => {
    const query = topupStudentSearch.trim().toLowerCase()
    return activeStudents.filter((student) =>
      !query ||
      student.full_name.toLowerCase().includes(query) ||
      student.student_code.toLowerCase().includes(query) ||
      String(student.class_name || '').toLowerCase().includes(query),
    )
  }, [activeStudents, topupStudentSearch])

  const totalBalance = useMemo(() => students.filter((student) => student.active).reduce((total, student) => total + Number(student.balance), 0), [students])
  const totalTopup = useMemo(() => transactions.filter((transaction) => transaction.type === 'topup').reduce((total, transaction) => total + Number(transaction.amount), 0), [transactions])
  const totalPurchase = useMemo(() => transactions.filter((transaction) => transaction.type === 'purchase' || transaction.type === 'debt_repayment').reduce((total, transaction) => total + Number(transaction.amount), 0), [transactions])

  async function compressStudentPhoto(file: File): Promise<File> {
    if (!file.type.startsWith('image/')) return file

    try {
      const imageUrl = URL.createObjectURL(file)
      try {
        const image = new Image()
        image.src = imageUrl
        await image.decode()

        const maxDimension = 720
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))

        const context = canvas.getContext('2d')
        if (!context) return file
        context.drawImage(image, 0, 0, canvas.width, canvas.height)

        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82))
        if (!blob || blob.size >= file.size) return file
        return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', {
          type: 'image/webp',
          lastModified: Date.now(),
        })
      } finally {
        URL.revokeObjectURL(imageUrl)
      }
    } catch {
      // ถ้าเบราว์เซอร์แปลงรูปไม่ได้ ให้อัปโหลดไฟล์ต้นฉบับแทน
      return file
    }
  }

  async function uploadPhoto(file: File, studentId: string) {
    if (!supabase) return null
    const optimizedFile = await compressStudentPhoto(file)
    const isWebp = optimizedFile.type === 'image/webp'
    const extension = isWebp ? 'webp' : optimizedFile.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${studentId}-${Date.now()}.${extension}`
    const { error } = await supabase.storage.from('student-photos').upload(path, optimizedFile, {
      upsert: true,
      contentType: optimizedFile.type || undefined,
      cacheControl: '31536000',
    })
    if (error) throw error
    return supabase.storage.from('student-photos').getPublicUrl(path).data.publicUrl
  }

  async function addStudent() {
    if (!supabase) return
    if (!newName.trim()) return setMessage('กรุณากรอกชื่อ-นามสกุลนักเรียน')
    setLoading(true)
    try {
      // student_code จะถูกสร้างอัตโนมัติจาก Supabase เป็น sh0001, sh0002, ...
      const { data, error } = await supabase.from('students').insert({ full_name: newName.trim(), class_name: newGroup }).select().single()
      if (error) throw error
      let row = data as Student
      if (newPhoto) {
        const url = await uploadPhoto(newPhoto, row.id)
        const { data: updated, error: updateError } = await supabase.from('students').update({ photo_url: url }).eq('id', row.id).select().single()
        if (updateError) throw updateError
        row = updated as Student
      }
      setStudents((value) => [...value, row].sort((a, b) => a.full_name.localeCompare(b.full_name)))
      setNewName(''); setNewGroup('เด็กเล็ก'); setNewPhoto(null); setPhotoPreview('')
      setMessage('เพิ่มนักเรียนเรียบร้อยแล้ว')
    } catch (error) {
      setMessage(`เพิ่มนักเรียนไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`)
    } finally { setLoading(false) }
  }

  function openEdit(student: Student) {
    setEdit(student); setEditName(student.full_name); setEditGroup(student.class_name === 'เด็กโต' ? 'เด็กโต' : 'เด็กเล็ก'); setEditPhoto(null); setEditPhotoPreview(student.photo_url || ''); setRemovePhoto(false)
  }

  async function saveEdit() {
    if (!supabase || !edit) return
    if (!editName.trim()) return setMessage('กรุณากรอกชื่อ-นามสกุลนักเรียน')
    setLoading(true)
    try {
      let photoUrl = edit.photo_url
      if (removePhoto) photoUrl = null
      if (editPhoto) photoUrl = await uploadPhoto(editPhoto, edit.id)
      const { data, error } = await supabase.from('students').update({ full_name: editName.trim(), class_name: editGroup, photo_url: photoUrl }).eq('id', edit.id).select().single()
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

  function openTopupModal(student: Student) {
    setSelected(student)
    setTopupAmount('')
    setTopupReference('')
    setTopupNote('')
    setTopupModalOpen(true)
  }

  function closeTopupModal() {
    if (topupLoading) return
    setTopupModalOpen(false)
    setTopupStudentSearch('')
    setTopupStudentPickerOpen(true)
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
      setSelected(updated); setTopupAmount(''); setTopupReference(''); setTopupNote(''); setMessage(`เติมเงินสำเร็จ ฿${amount.toFixed(2)}`); setTopupModalOpen(false); await openHistory(updated)
    } catch (error) {
      setMessage(`เติมเงินไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`)
    } finally { setTopupLoading(false) }
  }

  function openEditTopup(transaction: WalletTransaction) {
    if (transaction.type !== 'topup') return
    setEditTopup(transaction)
    setEditTopupAmount(String(Number(transaction.amount)))
    setEditTopupNote(transaction.note || '')
    setEditTopupReference(transaction.reference || '')
  }

  function closeEditTopup() {
    if (editTopupLoading) return
    setEditTopup(null)
  }

  async function saveEditTopup() {
    if (!supabase || !editTopup) return

    const amount = Number(editTopupAmount)
    if (!Number.isFinite(amount) || amount < 0) {
      setMessage('กรุณากรอกจำนวนเงินใหม่ให้ถูกต้อง')
      return
    }

    setEditTopupLoading(true)
    try {
      const { data, error } = await supabase.rpc('admin_edit_topup', {
        p_transaction_id: editTopup.id,
        p_amount: amount,
        p_reference: editTopupReference.trim() || null,
        p_note: editTopupNote.trim() || 'แก้ไขรายการเติมเงินโดย Admin',
      })

      if (error) throw error

      const updatedStudent = data as Student

      setStudents((value) =>
        value.map((student) =>
          student.id === updatedStudent.id ? updatedStudent : student,
        ),
      )

      if (selected?.id === updatedStudent.id) {
        setSelected(updatedStudent)
      }

      setEditTopup(null)
      setMessage(
        `แก้ไขรายการเติมเงินเป็น ฿${amount.toFixed(2)} เรียบร้อยแล้ว ยอดเงินนักเรียนถูกปรับตามส่วนต่างแล้ว`,
      )

      await loadAll()
      await openHistory(updatedStudent)
    } catch (error) {
      setMessage(
        `แก้ไขรายการเติมเงินไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      setEditTopupLoading(false)
    }
  }

  async function executeDeletePurchase(transaction: WalletTransaction) {
    if (!supabase || (transaction.type !== 'purchase' && transaction.type !== 'debt_repayment')) return

    try {
      const { data, error } = await supabase.rpc('admin_delete_purchase_transaction', {
        p_transaction_id: transaction.id,
      })
      if (error) throw error

      const updatedStudent = data as Student
      setStudents((current) =>
        current.map((student) => student.id === updatedStudent.id ? updatedStudent : student),
      )
      if (selected?.id === updatedStudent.id) setSelected(updatedStudent)

      // อัปเดตข้อมูลสินค้า สต็อก และธุรกรรมจากฐานข้อมูลหลังลบสำเร็จ
      await loadAll()
      if (selected) {
        const { data: historyData, error: historyError } = await supabase
          .from('wallet_transactions')
          .select('id,student_id,type,amount,balance_before,balance_after,reference,note,created_at')
          .eq('student_id', selected.id)
          .order('created_at', { ascending: false })

        if (historyError) throw historyError
        setHistory((historyData || []) as WalletTransaction[])
      }

      setMessage(transaction.type === 'debt_repayment' ? 'ลบรายการรับชำระคืนค่าขนมแล้ว ยกเลิกคำสั่งซื้อและคืนสต็อกสินค้าเรียบร้อยแล้ว' : 'ลบธุรกรรมซื้อสินค้าเรียบร้อยแล้ว คืนเงินให้นักเรียนและคืนสต็อกสินค้าแล้ว')
    } catch (error) {
      setMessage(`ลบธุรกรรมไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  function requestDeletePurchase(transaction: WalletTransaction) {
    if (transaction.type !== 'purchase' && transaction.type !== 'debt_repayment') return
    const isRepayment = transaction.type === 'debt_repayment'
    setConfirmModal({
      title: isRepayment ? 'ยืนยันลบรายการรับชำระคืนค่าขนม' : 'ยืนยันลบธุรกรรมซื้อสินค้า',
      message: isRepayment ? 'ต้องการลบรายการรับชำระคืนนี้และยกเลิกคำสั่งซื้อที่เกี่ยวข้องใช่หรือไม่?' : 'ต้องการลบรายการซื้อสินค้านี้ใช่หรือไม่?',
      detail: `ยอด ฿${Number(transaction.amount).toFixed(2)} · ระบบจะยกเลิกคำสั่งซื้อ คืนสต็อกสินค้า และคำนวณยอดคงเหลือใหม่${isRepayment ? ' พร้อมลบรายการหนี้ที่ผูกกับคำสั่งซื้อนี้' : ' และคืนเงินให้นักเรียน'}`,
      icon: '🗑️',
      confirmText: 'ลบธุรกรรมและคืนสต็อก',
      cancelText: 'ยกเลิก',
      danger: true,
      onConfirm: () => executeDeletePurchase(transaction),
    })
  }

  async function openPurchaseDetails(transaction: WalletTransaction) {
    // รายการรับชำระคืนค่าขนมใช้อ้างอิง order_id เดียวกับคำสั่งซื้อ
    // จึงสามารถเปิดรายละเอียดสินค้าเดิมได้เช่นเดียวกับรายการซื้อสินค้า
    if (transaction.type !== 'purchase' && transaction.type !== 'debt_repayment') return

    setPurchaseDetailsTransaction(transaction)
    setPurchaseItems([])
    setPurchaseDetailsError('')
    setPurchaseDetailsLoading(true)

    try {
      if (!transaction.reference || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(transaction.reference)) {
        throw new Error('รายการนี้ไม่มีเลขอ้างอิงคำสั่งซื้อที่ถูกต้อง')
      }
      if (!supabase) throw new Error('ไม่สามารถเชื่อมต่อฐานข้อมูลได้')

      const { data, error } = await supabase
        .from('order_items')
        .select('id,product_name,quantity,unit_price,subtotal')
        .eq('order_id', transaction.reference)
        .order('id', { ascending: true })

      if (error) throw error
      setPurchaseItems((data || []) as PurchaseItem[])
    } catch (error) {
      setPurchaseDetailsError(error instanceof Error ? error.message : String(error))
    } finally {
      setPurchaseDetailsLoading(false)
    }
  }

  async function openHistory(student: Student) {
    if (!supabase) return

    setSelected(student)
    setHistory([])
    setHistoryPage(1)
    setHistoryLoading(true)

    // Scroll to the history panel as soon as it is rendered, without waiting
    // for the transaction query to finish.
    window.setTimeout(() => {
      document.querySelector('.history-panel')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 0)

    try {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('id,student_id,type,amount,balance_before,balance_after,reference,note,created_at')
        .eq('student_id', student.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const studentHistory = ((data || []) as WalletTransaction[]).filter(
        (transaction) => transaction.student_id === student.id,
      )

      // ใช้ข้อมูลจากรายการที่โหลดไว้แล้วเป็น fallback เพื่อไม่ให้ประวัติของเด็กคนอื่นปนกัน
      const fallbackHistory = transactions.filter(
        (transaction) => transaction.student_id === student.id,
      )

      setHistory(studentHistory.length > 0 ? studentHistory : fallbackHistory)
    } catch (error) {
      setHistory([])
      setMessage(`โหลดประวัติไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setHistoryLoading(false)
    }
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
    <main className="shell admin-page-root">
      <div className="topbar admin-topbar">
        <div><div className="brand"><span className="admin-brand-icon"><Wallet size={22} strokeWidth={2.4} /></span><span>Shine Wallet <span className="admin-brand-light">Admin</span></span></div><div className="muted">จัดการนักเรียน · เงิน · สินค้า · ประวัติธุรกรรม</div></div>
        <div className="admin-actions">
          <Link href="/kiosk" className="btn admin-kiosk-top-btn"><Store size={17} /> จุดขาย</Link>
          <button className="btn dark admin-logout-btn" onClick={requestLogout}><LogOut size={17} /> ออกจากระบบ</button>
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
        <div className="card"><div className="stat-icon blue"><GraduationCap size={25} strokeWidth={2.2} /></div><div><div className="muted">นักเรียน</div><div className="stat-number">{students.filter((student) => student.active).length}</div><div className="muted">คน</div></div></div>
        <div className="card"><div className="stat-icon green"><Wallet size={24} strokeWidth={2.2} /></div><div><div className="muted">ยอดเงินคงเหลือรวม</div><div className="stat-number">฿{totalBalance.toFixed(2)}</div></div></div>
        <div className="card"><div className="stat-icon purple"><Activity size={24} strokeWidth={2.2} /></div><div><div className="muted">ธุรกรรม</div><div className="stat-number">{transactions.length}</div><div className="muted">เติม ฿{totalTopup.toFixed(2)} · ซื้อ ฿{totalPurchase.toFixed(2)}</div></div></div>
      </div>

      <div className="admin-tabs">
        <button className={`admin-tab ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')} aria-label="ภาพรวม"><span><LayoutDashboard size={22} strokeWidth={2.2} /></span><b>ภาพรวม</b><small>Dashboard &amp; สรุปข้อมูล</small></button>
        <button className={`admin-tab ${tab === 'students' ? 'active' : ''}`} onClick={() => setTab('students')} aria-label="นักเรียน"><span><UsersRound size={22} strokeWidth={2.2} /></span><b>นักเรียน</b><small>ข้อมูลและกระเป๋าเงิน</small></button>
        <button className={`admin-tab ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')} aria-label="สินค้า"><span><ShoppingBag size={22} strokeWidth={2.2} /></span><b>สินค้า</b><small>สินค้าและสต็อก</small></button>
        <button className={`admin-tab ${tab === 'debts' ? 'active' : ''}`} onClick={() => { setTab('debts'); void loadSnackDebts() }} aria-label="ติดเงินค่าขนม"><span><ClipboardCheck size={22} strokeWidth={2.2} /></span><b>ติดเงินค่าขนม</b><small>ประวัติและอนุมัติรับชำระ</small></button>
        <button className={`admin-tab ${tab === 'realtime' ? 'active' : ''}`} onClick={() => setTab('realtime')} aria-label="ธุรกรรมสด"><span><RadioTower size={22} strokeWidth={2.2} /></span><b>ธุรกรรมสด</b><small>ติดตามรายการล่าสุด</small></button>
      </div>

      {tab === 'dashboard' ? (
        <WalletDashboard students={students} transactions={transactions} totalBalance={totalBalance} />
      ) : tab === 'realtime' ? (
        <RealtimeTransactionsPanel
          students={students}
          transactions={transactions}
          paginatedTransactions={paginatedRealtime}
          connected={realtimeConnected}
          error={realtimeError}
          page={realtimePage}
          totalPages={totalRealtimePages}
          onPageChange={setRealtimePage}
        />
      ) : tab === 'debts' ? (
        <section className="card admin-section snack-debt-section">
          <div className="section-heading">
            <div>
              <h2><ClipboardCheck size={23} aria-hidden="true" /> ติดเงินค่าขนม</h2>
              <p className="muted">บันทึกรายการที่นักเรียนรับขนมไปก่อน และอนุมัติเมื่อได้รับเงินคืนแล้ว</p>
            </div>
            <button type="button" className="btn" onClick={() => void loadSnackDebts()} disabled={debtLoading}>
              {debtLoading ? 'กำลังโหลด...' : '↻ รีเฟรช'}
            </button>
          </div>

          <div className="snack-debt-summary">
            <div><span>ยอดค้างชำระ</span><strong>฿{snackDebts.filter((debt) => debt.status === 'unpaid').reduce((sum, debt) => sum + Number(debt.amount), 0).toFixed(2)}</strong></div>
            <div><span>รายการค้างชำระ</span><strong>{snackDebts.filter((debt) => debt.status === 'unpaid').length}</strong></div>
            <div><span>ชำระแล้ว</span><strong>{snackDebts.filter((debt) => debt.status === 'paid').length}</strong></div>
          </div>

          {debtMessage && <div className={`status ${debtMessage.includes('เรียบร้อยแล้ว') ? 'success' : 'error'} snack-debt-message`}>{debtMessage}</div>}

          {debtLoading && snackDebts.length === 0 ? (
            <div className="snack-debt-empty">กำลังโหลดประวัติติดเงิน...</div>
          ) : snackDebts.length === 0 ? (
            <div className="snack-debt-empty">
              <span>🧾</span>
              <strong>ยังไม่มีประวัติติดเงินค่าขนม</strong>
              <p>เมื่อบันทึกการซื้อเป็นเงินเชื่อ รายการจะปรากฏที่นี่</p>
              {debtMessage.includes('ไม่สำเร็จ') && <small>หากยังไม่ได้ติดตั้งระบบ ให้รันไฟล์ supabase/snack-debt.sql ใน Supabase SQL Editor ก่อน</small>}
            </div>
          ) : (
            <div className="snack-debt-list">
              {[...snackDebts].sort((a, b) => Number(a.status === 'paid') - Number(b.status === 'paid') || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((debt) => (
                <article className={`snack-debt-card ${debt.status === 'paid' ? 'is-paid' : 'is-unpaid'}`} key={debt.id}>
                  <div className="snack-debt-card-top">
                    <div className="snack-debt-student">
                      <strong>{debt.student?.full_name || 'ไม่พบชื่อนักเรียน'}</strong>
                      <span>{debt.student?.student_code || '—'} · {debt.student?.class_name || 'ไม่ระบุชั้น'}</span>
                    </div>
                    <span className={`snack-debt-status ${debt.status}`}>{debt.status === 'paid' ? '✓ ชำระแล้ว' : 'ยังค้างชำระ'}</span>
                  </div>
                  <div className="snack-debt-items">
                    {(Array.isArray(debt.items) ? debt.items : []).map((item, index) => (
                      <div key={`${debt.id}-${index}`}>
                        <span>{item.name} × {item.quantity}</span>
                        <b>฿{Number(item.subtotal).toFixed(2)}</b>
                      </div>
                    ))}
                  </div>
                  <div className="snack-debt-card-bottom">
                    <div>
                      <small>ยอดติดเงิน</small>
                      <strong>฿{Number(debt.amount).toFixed(2)}</strong>
                      <span>บันทึกเมื่อ {new Date(debt.created_at).toLocaleString('th-TH')}</span>
                      {debt.paid_at && <span>รับชำระเมื่อ {new Date(debt.paid_at).toLocaleString('th-TH')}</span>}
                    </div>
                    {debt.status === 'unpaid' ? (
                      <button type="button" className="snack-debt-approve-btn" onClick={() => setDebtApprovalModal(debt)} disabled={debtActionId !== null}>
                        ✓ อนุมัติรับชำระเงินคืน
                      </button>
                    ) : (
                      <span className="snack-debt-paid-note">บันทึกการชำระเงินแล้ว</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : tab === 'students' ? (
        <>
          <div className="card admin-section">
            <div className="section-heading"><div><h2>เพิ่มนักเรียน</h2><p className="muted">สร้างบัญชีนักเรียนพร้อมรูปและ QR Code</p></div></div>
            <div className="row admin-add-row">
              <input className="input" placeholder="ชื่อ-นามสกุล" value={newName} onChange={(event) => setNewName(event.target.value)} />
              <select className="input student-group-select" value={newGroup} onChange={(event) => setNewGroup(event.target.value)} aria-label="กลุ่มนักเรียน"><option value="เด็กเล็ก">เด็กเล็ก</option><option value="เด็กโต">เด็กโต</option></select>
              <label className="btn upload-btn"><Plus size={16} /> เพิ่มรูป<input type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0] || null; setNewPhoto(file); setPhotoPreview(file ? URL.createObjectURL(file) : '') }} /></label>
              <button className="btn primary" onClick={addStudent} disabled={loading}><Plus size={17} /> เพิ่มนักเรียน</button>
            </div>
            {photoPreview && <img src={photoPreview} alt="preview" className="admin-preview" />}
          </div>

          <div className="card admin-section">
            <div className="section-heading"><div><h2>รายชื่อนักเรียน</h2><p className="muted">เลือกนักเรียนเพื่อเติมเงิน ดูประวัติ หรือแสดง QR</p></div><div className="admin-search-wrap"><Search size={17} /><input className="input admin-search" placeholder="ค้นหาชื่อ / รหัส / ชั้น" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
            <div className="student-list">
              {filtered.map((student) => (
                <div className="student-row" key={student.id}>
                  <div className="student-main"><Link href={`/?student=${encodeURIComponent(student.qr_token)}`} className="student-avatar-link" aria-label={`ไปหน้าซื้อสินค้าสำหรับ ${student.full_name}`} title="คลิกรูปเพื่อไปหน้าซื้อสินค้า">{student.photo_url ? <img src={student.photo_url} alt={`รูปนักเรียน ${student.full_name}`} className="student-avatar" loading="lazy" decoding="async" /> : <div className="student-avatar-placeholder student-avatar">👤</div>}</Link><div className="student-main-info"><b>{student.full_name}</b><div className="student-meta"><span className="muted">{student.student_code}</span><span className={`student-group-badge ${student.class_name === 'เด็กโต' ? 'group-older' : student.class_name === 'เด็กเล็ก' ? 'group-younger' : 'group-unknown'}`}>{student.class_name || 'ไม่ระบุกลุ่ม'}</span></div></div></div>
                  <div className={`student-balance ${Number(student.balance) !== 0 ? 'has-balance' : ''}`}>฿{Number(student.balance).toFixed(2)}</div>
                  <div className="student-actions">
                    <button type="button" className="btn primary" onClick={() => openTopupModal(student)} title="เติมเงินให้นักเรียน" aria-label={`เติมเงิน ${student.full_name}`}>＋ เติมเงิน</button>
                    <button type="button" className="btn history-open-btn" onClick={() => openHistory(student)} title="ดูประวัติธุรกรรม" aria-label={`ประวัติธุรกรรม ${student.full_name}`}><History size={15} /> ประวัติ</button>
                    <button type="button" className="btn" onClick={() => showQr(student)} title="แสดง QR Code" aria-label={`แสดง QR Code ${student.full_name}`}><QrCode size={15} /> QR</button>
                    <button type="button" className="btn" onClick={() => openEdit(student)} title="แก้ไขข้อมูลนักเรียน" aria-label={`แก้ไข ${student.full_name}`}><Pencil size={15} /> แก้ไข</button>
                    <button type="button" className="btn danger-btn" onClick={() => requestDeleteStudent(student)} title="ปิดใช้งานนักเรียน" aria-label={`ปิดใช้งาน ${student.full_name}`}>ปิดใช้งาน</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="card admin-section">
          <div className="section-heading"><div><h2>จัดการสินค้า</h2><p className="muted">เพิ่ม แก้ไขราคา สต็อก และปิดการขาย</p></div><button className="btn primary" onClick={() => { setProductEdit(null); setProductName(''); setProductPrice(''); setProductStock('') }}>＋ สินค้าใหม่</button></div>
          <div className="product-form"><input className="input" placeholder="ชื่อสินค้า" value={productName} onChange={(event) => setProductName(event.target.value)} /><input className="input" type="number" min="0" step="0.01" placeholder="ราคา" value={productPrice} onChange={(event) => setProductPrice(event.target.value)} /><input className="input" type="number" min="0" step="1" placeholder="Stock" value={productStock} onChange={(event) => setProductStock(event.target.value)} /><label className="btn upload-btn">📷 รูปสินค้า<input type="file" accept="image/*" hidden onChange={(event) => setProductImage(event.target.files?.[0] || null)} /></label><button className="btn primary" onClick={saveProduct}>{productEdit ? 'บันทึกแก้ไข' : 'เพิ่มสินค้า'}</button></div>
          <div className="products admin-products">{products.filter((product) => product.active).map((product) => <div className="product admin-product" key={product.id}>{product.image_url ? <img src={product.image_url} alt="" className="product-thumb" /> : <div className="product-thumb-placeholder"><Package size={24} /></div>}<div className="product-info"><b>{product.name}</b><div className="muted">฿{Number(product.price).toFixed(2)} · เหลือ {product.stock} ชิ้น</div></div><div className="row"><button className="btn" onClick={() => editProduct(product)}><Pencil size={15} /> แก้ไข</button><button className="btn danger-btn" onClick={() => requestDeleteProduct(product)}>ปิดการขาย</button></div></div>)}</div>
        </div>
      )}

      {selected && !topupModalOpen && (
        <div className="card admin-section history-panel">
          {/* Header */}
          <div className="history-header">
            <div className="history-student-info">
              {selected.photo_url ? (
                <img src={selected.photo_url} alt="" className="history-avatar" loading="lazy" decoding="async" />
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
              {[10, 15, 20, 30, 40].map((preset) => (
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
                  {selectedHistory.length > 0
                    ? `พบทั้งหมด ${selectedHistory.length} รายการ (เรียงจากล่าสุด)`
                    : 'ยังไม่มีประวัติการทำรายการ'}
                </p>
              </div>

              {selectedHistory.length > 0 && (
                <div className="history-page-indicator">
                  หน้า <b>{historyPage}</b> / {totalHistoryPages}
                </div>
              )}
            </div>

            {historyLoading ? (
              <div className="status" style={{ margin: '20px 0' }}>
                ⏳ กำลังโหลดประวัติการเงิน...
              </div>
            ) : !selectedHistory.length ? (
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
                        <th style={{ minWidth: 110 }}>จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedHistory.map((transaction) => {
                        const isPurchase = transaction.type === 'purchase'
                        const isTopup = transaction.type === 'topup'
                        const isRefund = transaction.type === 'refund'
                        const isDebtRepayment = transaction.type === 'debt_repayment'

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
                              {isDebtRepayment && (
                                <span className="history-badge badge-refund">
                                  ✓ รับชำระคืนค่าขนม
                                </span>
                              )}
                              {!isPurchase && !isTopup && !isRefund && !isDebtRepayment && (
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
                                    : isTopup || isRefund || isDebtRepayment
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
                            <td className="history-action-cell">
                              {(isPurchase || isDebtRepayment) && (
                                <button
                                  type="button"
                                  className="history-view-purchase-btn"
                                  onClick={() => void openPurchaseDetails(transaction)}
                                  title="ดูรายการสินค้าที่ซื้อด้วยเงินค้างชำระ"
                                >
                                  <ShoppingBag size={14} /> ดูสินค้า
                                </button>
                              )}
                              {(isPurchase || isDebtRepayment) && (
                                <button
                                  type="button"
                                  className="btn danger-btn history-delete-transaction-btn"
                                  onClick={() => requestDeletePurchase(transaction)}
                                  title="ลบธุรกรรมและคืนสต็อกสินค้า"
                                >
                                  <Trash2 size={14} /> ลบ
                                </button>
                              )}
                              {isTopup && (
                                <button
                                  type="button"
                                  className="history-edit-topup-btn"
                                  onClick={() => openEditTopup(transaction)}
                                  title="แก้ไขรายการเติมเงิน"
                                >
                                  ✏️ แก้ไข
                                </button>
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
                      {Math.min(historyPage * historyPageSize, selectedHistory.length)} จากทั้งหมด{' '}
                      {selectedHistory.length} รายการ
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

      {edit && <div className="admin-edit-modal-backdrop" role="presentation" onClick={() => setEdit(null)}><section className="admin-edit-modal card admin-section" role="dialog" aria-modal="true" aria-labelledby="admin-edit-modal-title" onClick={(event) => event.stopPropagation()}><div className="section-heading"><div><h2 id="admin-edit-modal-title">✎ แก้ไขนักเรียน</h2><p className="muted">แก้ไขข้อมูลและรูปภาพนักเรียน</p></div><button type="button" className="admin-edit-modal-close" onClick={() => setEdit(null)} aria-label="ปิดหน้าต่างแก้ไขนักเรียน" title="ปิด"><X size={20} aria-hidden="true" /></button></div><div className="admin-edit-modal-fields"><label className="admin-edit-field">ชื่อ-นามสกุล<input className="input" value={editName} onChange={(event) => setEditName(event.target.value)} placeholder="ชื่อ-นามสกุลนักเรียน" /></label><label className="admin-edit-field">รหัสนักเรียน<input className="input" value={edit.student_code} placeholder="รหัสอัตโนมัติ" readOnly /></label><label className="admin-edit-field">กลุ่มนักเรียน<select className="input student-group-select" value={editGroup} onChange={(event) => setEditGroup(event.target.value)} aria-label="กลุ่มนักเรียน"><option value="เด็กเล็ก">เด็กเล็ก</option><option value="เด็กโต">เด็กโต</option></select></label><div className="admin-edit-photo-actions"><label className="btn upload-btn">📷 เปลี่ยนรูป<input type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0] || null; setEditPhoto(file); setEditPhotoPreview(file ? URL.createObjectURL(file) : edit.photo_url || '') }} /></label><button type="button" className="btn" onClick={() => { setRemovePhoto(true); setEditPhoto(null); setEditPhotoPreview('') }}>ลบรูป</button></div>{editPhotoPreview && <img src={editPhotoPreview} alt="ตัวอย่างรูปนักเรียน" className="admin-preview admin-edit-modal-preview" />}</div><div className="admin-edit-modal-footer"><button type="button" className="btn primary" onClick={saveEdit} disabled={loading}>{loading ? 'กำลังบันทึก…' : 'บันทึกการแก้ไข'}</button></div></section></div>}

      {/* Mobile Rich Menu (Bottom Navigation) */}
      <nav className="admin-mobile-menu" aria-label="Admin Mobile Navigation">
        <button
          type="button"
          className={`admin-menu-item ${tab === 'realtime' ? 'active' : ''}`}
          onClick={() => {
            setTab('realtime')
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        >
          <span className="admin-menu-icon"><Activity size={22} strokeWidth={2.4} aria-hidden="true" /></span>
          <b className="admin-menu-label">ธุรกรรม</b>
          <small className="admin-menu-sub">LIVE</small>
        </button>

        <Link href="/kiosk" className="admin-menu-item admin-menu-kiosk">
          <span className="admin-menu-icon"><Store size={23} strokeWidth={2.4} aria-hidden="true" /></span>
          <b className="admin-menu-label">จุดขาย</b>
          <small className="admin-menu-sub">KIOSK</small>
        </Link>

        <button
          type="button"
          className="admin-menu-item"
          onClick={() => {
            setTab('students')
            setTopupStudentSearch('')
            setTopupStudentPickerOpen(true)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        >
          <span className="admin-menu-icon"><Wallet size={22} strokeWidth={2.4} aria-hidden="true" /></span>
          <b className="admin-menu-label">เติมเงิน</b>
          <small className="admin-menu-sub">เลือกนักเรียน</small>
        </button>

      </nav>

      {/* Student Picker for Rich Menu Top Up */}
      {topupStudentPickerOpen && (
        <div className="topup-picker-backdrop" role="presentation" onClick={(event) => {
          if (event.target === event.currentTarget) setTopupStudentPickerOpen(false)
        }}>
          <div className="topup-picker-card" role="dialog" aria-modal="true" aria-labelledby="topup-picker-title">
            <div className="topup-picker-header">
              <div>
                <span className="topup-modal-badge">SHINE WALLET</span>
                <h2 id="topup-picker-title">เลือกนักเรียนเพื่อเติมเงิน</h2>
                <p>ค้นหาจากชื่อ รหัสนักเรียน หรือชั้นเรียน</p>
              </div>
              <button type="button" className="topup-modal-close" onClick={() => setTopupStudentPickerOpen(false)} aria-label="ปิดหน้าต่างเลือกนักเรียน">×</button>
            </div>
            <input className="input topup-picker-search" type="search" placeholder="🔎 ค้นหาชื่อ / รหัส / ชั้น" value={topupStudentSearch} onChange={(event) => setTopupStudentSearch(event.target.value)} autoFocus />
            <div className="topup-picker-list">
              {topupPickerStudents.map((student) => (
                <button key={student.id} type="button" className="topup-picker-student" onClick={() => {
                  setTopupStudentPickerOpen(false)
                  openTopupModal(student)
                }}>
                  {student.photo_url ? <img src={student.photo_url} alt="" className="topup-picker-avatar" loading="lazy" decoding="async" /> : <span className="topup-picker-avatar topup-picker-avatar-placeholder">👤</span>}
                  <span className="topup-picker-student-info">
                    <strong>{student.full_name}</strong>
                    <small className="topup-picker-meta"><span>{student.student_code}</span><span className={`student-group-badge ${student.class_name === 'เด็กโต' ? 'group-older' : student.class_name === 'เด็กเล็ก' ? 'group-younger' : 'group-unknown'}`}>{student.class_name || 'ไม่ระบุกลุ่ม'}</span></small>
                  </span>
                  <span className="topup-picker-balance">฿{Number(student.balance).toFixed(2)}</span>
                  <span className="topup-picker-arrow">›</span>
                </button>
              ))}
              {topupPickerStudents.length === 0 && <div className="topup-picker-empty">{students.some((student) => student.active) ? 'ไม่พบนักเรียนที่ตรงกับคำค้นหา' : 'ยังไม่มีนักเรียนที่เปิดใช้งาน'}</div>}
            </div>
          </div>
        </div>
      )}

      {debtApprovalModal && (
        <div
          className="snack-debt-approval-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget && !debtActionId) setDebtApprovalModal(null)
          }}
        >
          <section
            className="snack-debt-approval-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="snack-debt-approval-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="snack-debt-approval-close"
              onClick={() => setDebtApprovalModal(null)}
              disabled={debtActionId !== null}
              aria-label="ปิดหน้าต่างยืนยัน"
              title="ปิด"
            >
              <X size={20} aria-hidden="true" />
            </button>

            <div className="snack-debt-approval-hero">
              <span className="snack-debt-approval-icon"><CheckCircle2 size={34} strokeWidth={2.2} aria-hidden="true" /></span>
              <span className="snack-debt-approval-eyebrow">SHINE WALLET · REPAYMENT</span>
              <h2 id="snack-debt-approval-title">ยืนยันรับชำระเงินคืน</h2>
              <p>ตรวจสอบข้อมูลให้ถูกต้องก่อนบันทึกการชำระเงิน</p>
            </div>

            <div className="snack-debt-approval-student">
              <span className="snack-debt-approval-avatar">👤</span>
              <div>
                <strong>{debtApprovalModal.student?.full_name || 'ไม่พบชื่อนักเรียน'}</strong>
                <span>รหัส {debtApprovalModal.student?.student_code || '—'}{debtApprovalModal.student?.class_name ? ` · ${debtApprovalModal.student.class_name}` : ''}</span>
              </div>
            </div>

            <div className="snack-debt-approval-total">
              <span>ยอดที่ได้รับชำระ</span>
              <strong>฿{Number(debtApprovalModal.amount).toFixed(2)}</strong>
            </div>

            <div className="snack-debt-approval-items">
              <div className="snack-debt-approval-items-heading">รายการค่าขนม</div>
              {(debtApprovalModal.items || []).map((item, index) => (
                <div className="snack-debt-approval-item" key={`${item.name}-${index}`}>
                  <span>{item.name} <small>× {item.quantity}</small></span>
                  <strong>฿{Number(item.subtotal).toFixed(2)}</strong>
                </div>
              ))}
            </div>

            <div className="snack-debt-approval-warning">
              <CheckCircle2 size={17} aria-hidden="true" />
              <span>เมื่อยืนยันแล้ว รายการนี้จะเปลี่ยนสถานะเป็น <b>ชำระแล้ว</b> และบันทึกวันเวลารับเงิน</span>
            </div>

            <div className="snack-debt-approval-actions">
              <button
                type="button"
                className="snack-debt-approval-cancel"
                onClick={() => setDebtApprovalModal(null)}
                disabled={debtActionId !== null}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="snack-debt-approval-confirm"
                onClick={() => void approveSnackDebtPayment(debtApprovalModal.id)}
                disabled={debtActionId !== null}
              >
                {debtActionId === debtApprovalModal.id ? 'กำลังบันทึก…' : 'ยืนยันรับเงินแล้ว'}
              </button>
            </div>
          </section>
        </div>
      )}

      <PurchaseDetailsModal
        transaction={purchaseDetailsTransaction}
        items={purchaseItems}
        loading={purchaseDetailsLoading}
        error={purchaseDetailsError}
        onClose={() => {
          setPurchaseDetailsTransaction(null)
          setPurchaseItems([])
          setPurchaseDetailsError('')
        }}
      />

      <AdminOverlays
        selected={selected}
        topupModalOpen={topupModalOpen}
        topupLoading={topupLoading}
        topupAmount={topupAmount}
        topupReference={topupReference}
        topupNote={topupNote}
        setTopupAmount={setTopupAmount}
        setTopupReference={setTopupReference}
        setTopupNote={setTopupNote}
        onCloseTopup={closeTopupModal}
        onTopup={topup}
        editTopup={editTopup}
        selectedStudentName={selected?.full_name || ''}
        editTopupLoading={editTopupLoading}
        editTopupAmount={editTopupAmount}
        editTopupReference={editTopupReference}
        editTopupNote={editTopupNote}
        setEditTopupAmount={setEditTopupAmount}
        setEditTopupReference={setEditTopupReference}
        setEditTopupNote={setEditTopupNote}
        onCloseEditTopup={closeEditTopup}
        onSaveEditTopup={saveEditTopup}
        confirmModal={confirmModal}
        confirmLoading={confirmLoading}
        setConfirmModal={setConfirmModal}
        setConfirmLoading={setConfirmLoading}
        setMessage={setMessage}
      />

    </main>
  )
}