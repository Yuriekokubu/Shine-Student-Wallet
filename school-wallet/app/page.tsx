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
import { useWalletRealtime } from '../lib/use-wallet-realtime'
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

  // Refresh only the data affected by a Realtime event to avoid redundant queries.
  useWalletRealtime((table) => {
    if (table === 'products') {
      void getActiveProducts().then((result) => {
        if (!result.error) setProducts(result.data)
      })
      return
    }

    if (table === 'students' && token) {
      void getActiveStudentByToken(token).then((result) => {
        if (!result.error && result.data) setStudent(result.data)
      })
    }
  }, token !== undefined)

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

      // Load independent data in parallel instead of waiting for products before the student lookup.
      const [productsResult, studentResult] = await Promise.all([
        getActiveProducts(),
        token ? getActiveStudentByToken(token) : Promise.resolve(null),
      ])
      if (cancelled) return

      if (productsResult.error) {
        setMessage(`โหลดสินค้าไม่สำเร็จ: ${productsResult.error.message}`)
      } else {
        setProducts(productsResult.data)
      }

      if (!token) {
        setStudent(null)
        setLoading(false)
        return
      }

      if (!studentResult) {
        setLoading(false)
        return
      }

      if (studentResult.error) {
        setMessage(`โหลดข้อมูลนักเรียนไม่สำเร็จ: ${studentResult.error.message}`)
        setStudent(null)
      } else if (!studentResult.data) {
        setMessage('ไม่พบข้อมูลนักเรียนจาก QR Code')
        setStudent(null)
      } else {
        setStudent(studentResult.data)
        if (!productsResult.error) setMessage('')
      }
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [token])

  // แสดงเฉพาะสินค้าที่มีสต็อกเหลือมากกว่า 0
  const availableProducts = useMemo(
    () => products.filter((product) => Number(product.stock) > 0),
    [products],
  )

  const total = useMemo(() => {
    const productTotal = availableProducts.reduce(
      (sum, product) => sum + Number(product.price) * (cart[product.id] || 0),
      0,
    )
    const customTotal = customItems.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0,
    )
    return productTotal + customTotal
  }, [availableProducts, cart, customItems])

  function addProduct(product: Product) {
    // บัญชีที่ไม่ใช่ Admin ดูสินค้าได้ แต่ไม่สามารถเพิ่มลงตะกร้าได้
    if (!isAdmin) return

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
    if (!isAdmin) return

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

    if (!isAdmin) return

    setLoading(true)
    setMessage('กำลังชำระเงิน...')

    const items: CartItem[] = [
      ...Object.entries(cart)
        .filter(([, quantity]) => quantity > 0)
        .map(([product_id, quantity]) => ({ product_id, quantity })),
      ...customItems.map((item) => ({
        custom_name: item.name,
        custom_price: item.price,
        quantity: item.quantity,
      })),
    ]

    try {
      const result = await purchaseProducts(student.id, items)
      setStudent((current) =>
        current ? { ...current, balance: Number(result.balance) } : current,
      )
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
            <div className="welcome-actions">
              <Link href="/kiosk" className="welcome-action-btn"><span className="welcome-action-icon">📷</span><span>เปิดจุดขาย</span><strong>→</strong></Link>
              <Link href="/student" className="welcome-action-btn"><span className="welcome-action-icon">💰</span><span>เช็คยอดเงินของฉัน</span><strong>→</strong></Link>
            </div>
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

          <div className="wallet-layout">
            <section className="card product-section">
              <div className="section-heading wallet-section-heading">
                <div>
                  <span className="section-eyebrow">MENU</span>
                  <h2>🍪 เลือกขนม</h2>
                  <p className="muted">{isAdmin ? 'แตะ + เพื่อเพิ่มลงในรายการ' : 'รายการสินค้าและราคาสำหรับนักเรียน'}</p>
                </div>
                <span className="product-count">{availableProducts.length} สินค้า</span>
              </div>

              {availableProducts.length > 0 ? (
                <div className="products">
                  {availableProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      quantity={cart[product.id] || 0}
                      onAdd={() => addProduct(product)}
                      onRemove={() => removeProduct(product)}
                      canOrder={isAdmin}
                    />
                  ))}
                </div>
              ) : (
                <div className="status">ขณะนี้ไม่มีสินค้าที่มีสต็อก</div>
              )}

              {isAdmin && (
                <CustomItemForm
                  name={customName}
                  price={customPrice}
                  quantity={customQuantity}
                  onNameChange={setCustomName}
                  onPriceChange={setCustomPrice}
                  onQuantityChange={setCustomQuantity}
                  onAdd={addCustomItem}
                />
              )}
            </section>

            {isAdmin ? (
              <CartSummary
                products={availableProducts}
                cart={cart}
                customItems={customItems}
                total={total}
                balance={student.balance}
                loading={loading}
                message={message}
                onRemoveCustomItem={(id) =>
                  setCustomItems((current) => current.filter((item) => item.id !== id))
                }
                onCheckout={checkout}
              />
            ) : null}
          </div>

          {message && <div className={message.includes('สำเร็จ') ? 'status success' : 'status error'}>{message}</div>}
        </>
      )}

    </main>
  )
}