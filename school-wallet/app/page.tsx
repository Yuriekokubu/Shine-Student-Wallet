'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import CartSummary from '../components/wallet/CartSummary'
import CustomItemForm from '../components/wallet/CustomItemForm'
import ProductCard from '../components/wallet/ProductCard'
import { supabase } from '../lib/supabase'
import { getActiveProducts } from '../lib/services/product-service'
import { getActiveStudentByToken } from '../lib/services/student-service'
import { purchaseProducts } from '../lib/services/wallet-service'
import type { CartItem, CustomItem, Product, Student } from '../types/school-wallet'

export default function HomePage() {
  const [student, setStudent] = useState<Student | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<Record<string, number>>({})
  const [customItems, setCustomItems] = useState<CustomItem[]>([])
  const [customName, setCustomName] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [customQuantity, setCustomQuantity] = useState('1')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [token, setToken] = useState<string | null | undefined>(undefined)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setToken(params.get('student'))
  }, [])

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let mounted = true

    const checkAdmin = async () => {
      const { data } = await client.auth.getSession()
      if (mounted) {
        const role = data.session?.user?.app_metadata?.role || data.session?.user?.user_metadata?.role
        setIsAdmin(role === 'admin')
      }
    }

    checkAdmin()
    const { data: listener } = client.auth.onAuthStateChange(() => checkAdmin())
    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (token === undefined) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const productsResult = await getActiveProducts()
      if (cancelled) return

      if (productsResult.error) setMessage(`โหลดสินค้าไม่สำเร็จ: ${productsResult.error.message}`)
      setProducts(productsResult.data)

      if (!token) {
        setStudent(null)
        setLoading(false)
        return
      }

      const studentResult = await getActiveStudentByToken(token)
      if (cancelled) return

      if (studentResult.error) {
        setMessage(`โหลดข้อมูลนักเรียนไม่สำเร็จ: ${studentResult.error.message}`)
        setStudent(null)
      } else if (!studentResult.data) {
        setMessage('ไม่พบข้อมูลนักเรียนจาก QR Code')
        setStudent(null)
      } else {
        setStudent(studentResult.data)
        setMessage('')
      }
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [token])

  const total = useMemo(() => {
    const productTotal = products.reduce((sum, product) => sum + Number(product.price) * (cart[product.id] || 0), 0)
    const customTotal = customItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)
    return productTotal + customTotal
  }, [products, cart, customItems])

  function addProduct(product: Product) {
    if (!isAdmin) {
      setMessage('🔐 การชำระเงินสำหรับ Admin เท่านั้น กรุณา Login Admin ก่อนซื้อสินค้า')
      return
    }

    const quantity = cart[product.id] || 0
    if (quantity >= Number(product.stock)) return
    setCart((current) => ({ ...current, [product.id]: quantity + 1 }))
  }

  function removeProduct(product: Product) {
    if (!isAdmin) return

    const quantity = cart[product.id] || 0
    if (quantity <= 1) {
      setCart((current) => {
        const next = { ...current }
        delete next[product.id]
        return next
      })
      return
    }
    setCart((current) => ({ ...current, [product.id]: quantity - 1 }))
  }

  function addCustomItem() {
    if (!isAdmin) {
      setMessage('🔐 การเพิ่มรายการเพื่อชำระเงินสำหรับ Admin เท่านั้น')
      return
    }

    const name = customName.trim()
    const price = Number(customPrice)
    const quantity = Math.floor(Number(customQuantity))

    if (!name) return setMessage('กรุณากรอกชื่อรายการ')
    if (!Number.isFinite(price) || price < 0) return setMessage('กรุณากรอกราคาให้ถูกต้อง')
    if (!Number.isInteger(quantity) || quantity < 1) return setMessage('กรุณากรอกจำนวนอย่างน้อย 1')

    setCustomItems((current) => [...current, { id: `custom-${Date.now()}`, name, price, quantity }])
    setCustomName('')
    setCustomPrice('')
    setCustomQuantity('1')
    setMessage('เพิ่มรายการกำหนดเองแล้ว')
  }

  async function checkout() {
    if (!student || total <= 0) return

    if (!isAdmin) {
      setMessage('🔐 การชำระเงินสำหรับ Admin เท่านั้น กรุณา Login Admin ก่อน')
      return
    }

    setLoading(true)
    setMessage('กำลังชำระเงิน...')

    const items: CartItem[] = [
      ...Object.entries(cart).filter(([, quantity]) => quantity > 0).map(([product_id, quantity]) => ({ product_id, quantity })),
      ...customItems.map((item) => ({ custom_name: item.name, custom_price: item.price, quantity: item.quantity })),
    ]

    try {
      const result = await purchaseProducts(student.id, items)
      setStudent((current) => current ? { ...current, balance: Number(result.balance) } : current)
      setCart({})
      setCustomItems([])
      setMessage(`ชำระเงินสำเร็จ ฿${Number(result.total).toFixed(2)}`)
    } catch (error) {
      setMessage(`ชำระเงินไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setLoading(false)
    }
  }

  if (token === undefined || (loading && token && !student)) {
    return (
      <main className="shell app-shell">
        <div className="app-loading-card">
          <div className="loading-logo"><img src="/pig-icon.png" alt="Shine Wallet" /></div>
          <strong>Shine Wallet</strong>
          <span>{token ? 'กำลังโหลดข้อมูลนักเรียน...' : 'กำลังเตรียมระบบ...'}</span>
        </div>
      </main>
    )
  }

  return (
    <main className="shell app-shell">
      <header className="topbar app-topbar">
        <div className="brand-block">
          <div className="brand"><img src="/pig-icon.png" alt="Shine Wallet" className="brand-icon" /> Shine Wallet</div>
          <div className="muted">กระเป๋าเงินดิจิทัลสำหรับนักเรียน</div>
        </div>
        <div className="row app-topbar-actions">
          <Link href="/kiosk" className="btn topbar-kiosk-btn">📷 สแกน QR</Link>
          {isAdmin && <Link href="/admin" className="btn topbar-admin-btn">⚙️ Admin</Link>}
        </div>
      </header>

      {!student ? (
        <div className="welcome-layout">
          <section className="welcome-hero">
            <div className="welcome-badge">✨ SHINE WALLET</div>
            <h1>ซื้อขนมง่าย ๆ<br />ด้วย QR Code</h1>
            <p>สแกน QR ของนักเรียน แล้วเลือกสินค้าได้ทันที พร้อมตัดยอดจากกระเป๋าเงินแบบรวดเร็ว</p>
            <Link href="/kiosk" className="welcome-action-btn"><span>เปิดจุดขาย</span><strong>→</strong></Link>
            {message && <div className="status error welcome-message">⚠ {message}</div>}
          </section>

          <section className="welcome-poster-card">
            <img src="/poster.png" alt="Shine Wallet" className="welcome-poster" />
          </section>

          <section className="welcome-features">
            <div className="feature-card feature-purple"><span>📱</span><div><b>สแกนง่าย</b><small>ใช้ QR นักเรียนได้ทันที</small></div></div>
            <div className="feature-card feature-green"><span>💰</span><div><b>รู้ยอดทันที</b><small>ตรวจสอบเงินคงเหลือก่อนซื้อ</small></div></div>
            <div className="feature-card feature-orange"><span>🛍️</span><div><b>เลือกสินค้า</b><small>จัดรายการซื้อได้ง่าย</small></div></div>
          </section>
        </div>
      ) : (
        <>
          <section className="student-hero">
            <div className="student-hero-top">
              <div className="student-avatar-large">
                {student.photo_url ? <img src={student.photo_url} alt={student.full_name} /> : '👤'}
              </div>
              <div className="student-hero-info"><span>สวัสดี 👋</span><h1>{student.full_name}</h1><p>{student.class_name || 'ไม่ระบุชั้น'} · {student.student_code}</p></div>
            </div>
            <div className="student-balance-box"><span>ยอดเงินคงเหลือ</span><strong>฿{Number(student.balance).toFixed(2)}</strong></div>
          </section>

          {!isAdmin && (
            <div className="admin-payment-lock">
              <div className="admin-payment-lock-icon">🔐</div>
              <div className="admin-payment-lock-content">
                <strong>ระบบชำระเงินสำหรับ Admin เท่านั้น</strong>
                <span>นักเรียนสามารถดูสินค้าและยอดเงินได้ แต่ไม่สามารถเพิ่มสินค้าในตะกร้าหรือชำระเงินเอง</span>
              </div>
              <Link href="/admin/login" className="btn primary admin-payment-login-btn">Login Admin</Link>
            </div>
          )}

          <div className="wallet-layout">
            <section className="card product-section">
              <div className="section-heading wallet-section-heading"><div><span className="section-eyebrow">MENU</span><h2>🍪 เลือกขนม</h2><p className="muted">{isAdmin ? 'แตะ + เพื่อเพิ่มลงในรายการ' : 'ดูรายการสินค้าและราคาได้ที่นี่'}</p></div><span className="product-count">{products.length} สินค้า</span></div>
              {products.length > 0 ? <div className="products">{products.map((product) => <ProductCard key={product.id} product={product} quantity={cart[product.id] || 0} onAdd={() => addProduct(product)} onRemove={() => removeProduct(product)} />)}</div> : <div className="status">ยังไม่มีสินค้าในระบบ</div>}
              {isAdmin && <CustomItemForm name={customName} price={customPrice} quantity={customQuantity} onNameChange={setCustomName} onPriceChange={setCustomPrice} onQuantityChange={setCustomQuantity} onAdd={addCustomItem} />}
            </section>
            {isAdmin ? (
              <CartSummary products={products} cart={cart} customItems={customItems} total={total} balance={student.balance} loading={loading} message={message} onRemoveCustomItem={(id) => setCustomItems((current) => current.filter((item) => item.id !== id))} onCheckout={checkout} />
            ) : (
              <section className="card admin-payment-side-lock">
                <div className="admin-payment-side-lock-icon">🔐</div>
                <h3>ชำระเงินโดย Admin เท่านั้น</h3>
                <p>ระบบจะไม่อนุญาตให้บัญชีทั่วไปตัดเงินจากกระเป๋านักเรียน</p>
                <Link href="/admin/login" className="btn primary">Login Admin เพื่อชำระเงิน</Link>
              </section>
            )}
          </div>

          {message && !isAdmin && <div className="status error admin-payment-message">{message}</div>}
        </>
      )}

      <style jsx>{`
        .welcome-poster-card {
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border-radius: 28px;
          background: #fff;
          box-shadow: 0 18px 50px rgba(15, 23, 42, 0.1);
        }
        .welcome-poster {
          display: block;
          width: 100%;
          height: auto;
          max-height: 420px;
          object-fit: contain;
        }
        .admin-payment-lock { display: flex; align-items: center; gap: 14px; margin: 18px 0; padding: 16px 18px; border: 1px solid #fed7aa; border-radius: 20px; background: #fff7ed; color: #9a3412; }
        .admin-payment-lock-icon { width: 46px; height: 46px; flex: 0 0 46px; display: grid; place-items: center; border-radius: 15px; background: #ffedd5; font-size: 23px; }
        .admin-payment-lock-content { min-width: 0; flex: 1; }
        .admin-payment-lock-content strong, .admin-payment-lock-content span { display: block; }
        .admin-payment-lock-content strong { font-size: 15px; }
        .admin-payment-lock-content span { margin-top: 3px; color: #c2410c; font-size: 13px; line-height: 1.5; }
        .admin-payment-login-btn { flex: 0 0 auto; }
        .admin-payment-side-lock { display: flex; min-height: 260px; flex-direction: column; align-items: center; justify-content: center; padding: 28px; text-align: center; }
        .admin-payment-side-lock-icon { width: 70px; height: 70px; display: grid; place-items: center; border-radius: 22px; background: #fff7ed; font-size: 34px; }
        .admin-payment-side-lock h3 { margin: 14px 0 6px; color: #172033; }
        .admin-payment-side-lock p { max-width: 330px; margin: 0 0 18px; color: #64748b; line-height: 1.6; }
        .admin-payment-message { margin-top: 14px; }
        @media (max-width: 700px) {
          .welcome-poster-card {
            width: calc(100% + 32px);
            margin-left: -16px;
            border-radius: 0;
            box-shadow: none;
          }
          .welcome-poster {
            width: 100%;
            max-height: none;
            object-fit: cover;
          }
          .admin-payment-lock { align-items: flex-start; flex-wrap: wrap; }
          .admin-payment-login-btn { width: 100%; }
        }
      `}</style>
    </main>
  )
}