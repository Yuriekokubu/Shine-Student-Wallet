'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'

function AdminLoginForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data }) => {
      const role =
        data.session?.user?.app_metadata?.role ||
        data.session?.user?.user_metadata?.role

      if (role === 'admin') {
        const next = searchParams.get('next')
        const destination =
          next?.startsWith('/') && !next.startsWith('//') ? next : '/admin'
        window.location.href = destination
      }
    })
  }, [searchParams])

  async function login(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setError('')

    if (!supabase) {
      setError('ไม่พบ Supabase configuration กรุณาตรวจสอบ .env.local')
      return
    }

    if (!email.trim() || !password) {
      setError('กรุณากรอกอีเมลและรหัสผ่าน')
      return
    }

    setLoading(true)

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (loginError) {
        setError(
          loginError.message === 'Invalid login credentials'
            ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
            : loginError.message,
        )
        setLoading(false)
        return
      }

      const role =
        data.user?.app_metadata?.role ||
        data.user?.user_metadata?.role

      if (role !== 'admin') {
        await supabase.auth.signOut()
        setError('บัญชีนี้ไม่มีสิทธิ์ Admin (ต้องมี role: admin)')
        setLoading(false)
        return
      }

      setPassword('')

      const next = searchParams.get('next')
      const destination =
        next?.startsWith('/') && !next.startsWith('//') ? next : '/admin'

      // ใช้ window.location.href เพื่อทำ Hard Navigation ให้บราวเซอร์ส่ง Cookies ไปยัง Server อย่างครบถ้วน
      // ป้องกัน Next.js Router soft-navigate ติดค้างหรือถูก Middleware ดีดกลับ
      window.location.href = destination
    } catch (err: any) {
      console.error('[AdminLogin] Error:', err)
      setError(
        err?.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง',
      )
      setLoading(false)
    }
  }

  return (
    <main
      className="shell"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div className="card" style={{ width: 'min(420px, 100%)' }}>
        <div style={{ textAlign: 'center', fontSize: 42 }}>🔐</div>
        <h1 style={{ textAlign: 'center', marginBottom: 6 }}>Admin Login</h1>
        <p className="muted" style={{ textAlign: 'center' }}>
          School Wallet · Supabase Auth
        </p>

        {searchParams.get('error') === 'not_admin' && (
          <div className="status error" style={{ marginBottom: 12 }}>
            บัญชีนี้ไม่มีสิทธิ์ Admin
          </div>
        )}

        {searchParams.get('error') === 'config' && (
          <div className="status error" style={{ marginBottom: 12 }}>
            ระบบยังไม่ได้ตั้งค่า Supabase
          </div>
        )}

        <form onSubmit={login}>
          <input
            className="input"
            type="email"
            placeholder="อีเมลผู้ดูแล"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            disabled={loading}
          />

          <input
            className="input"
            style={{ marginTop: 10 }}
            type="password"
            placeholder="รหัสผ่าน"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            disabled={loading}
          />

          <button
            type="submit"
            className="btn primary"
            style={{ width: '100%', marginTop: 12 }}
            disabled={loading}
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        {error && (
          <div className="status error" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}

        <Link
          href="/"
          className="btn"
          style={{ width: '100%', marginTop: 10 }}
        >
          ← กลับหน้าหลัก
        </Link>
      </div>
    </main>
  )
}

function AdminLoginFallback() {
  return (
    <main
      className="shell"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="card"
        style={{ width: 'min(420px, 100%)', textAlign: 'center' }}
      >
        กำลังโหลด School Wallet...
      </div>
    </main>
  )
}

export default function AdminLogin() {
  return (
    <Suspense fallback={<AdminLoginFallback />}>
      <AdminLoginForm />
    </Suspense>
  )
}
