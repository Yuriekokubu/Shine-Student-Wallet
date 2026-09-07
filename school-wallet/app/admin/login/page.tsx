'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'

function AdminLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.app_metadata?.role === 'admin') {
        router.replace('/admin')
      }
    })
  }, [router])

  async function login() {
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

    const role = data.user?.app_metadata?.role

    if (role !== 'admin') {
      await supabase.auth.signOut()
      setError('บัญชีนี้ไม่มีสิทธิ์ Admin')
      setLoading(false)
      return
    }

    setPassword('')

    const next = searchParams.get('next')
    const destination = next?.startsWith('/') && !next.startsWith('//')
      ? next
      : '/admin'

    router.replace(destination)
    router.refresh()
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

        <input
          className="input"
          type="email"
          placeholder="อีเมลผู้ดูแล"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') login()
          }}
          autoComplete="email"
        />

        <input
          className="input"
          style={{ marginTop: 10 }}
          type="password"
          placeholder="รหัสผ่าน"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') login()
          }}
          autoComplete="current-password"
        />

        <button
          className="btn primary"
          style={{ width: '100%', marginTop: 12 }}
          onClick={login}
          disabled={loading}
        >
          {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>

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
