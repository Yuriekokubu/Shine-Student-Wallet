'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import QrScanner from '../../components/QrScanner'
import {
  getActiveStudentByToken,
  searchActiveStudents,
} from '../../lib/services/student-service'
import {
  getWalletErrorMessage,
  topUpStudent,
} from '../../lib/services/wallet-service'
import { supabase } from '../../lib/supabase'
import { useWalletRealtime } from '../../lib/use-wallet-realtime'
import type { Student } from '../../types/school-wallet'

const TOPUP_AMOUNTS = [20, 50, 100, 200, 500]

export default function KioskPage() {
  const [student, setStudent] = useState<Student | null>(null)
  const [searchResults, setSearchResults] = useState<Student[]>([])
  const [message, setMessage] = useState('')
  const [manual, setManual] = useState('')
  const [loading, setLoading] = useState(false)
  const [topupOpen, setTopupOpen] = useState(false)
  const [topupAmount, setTopupAmount] = useState('100')
  const [topupLoading, setTopupLoading] = useState(false)
  const [topupMessage, setTopupMessage] = useState('')
  const [topupSuccess, setTopupSuccess] = useState(false)
  const [adminLoggedIn, setAdminLoggedIn] = useState(false)


  const refreshSelectedStudent = useCallback(async () => {
    if (!student) return
    const result = await getActiveStudentByToken(student.qr_token)
    if (!result.error && result.data) {
      setStudent(result.data)
    }
  }, [student])

  useWalletRealtime(() => {
    void refreshSelectedStudent()
  }, Boolean(student))

  useEffect(() => {
    let mounted = true

    async function checkAdminSession() {
      if (!supabase) return

      const { data } = await supabase.auth.getSession()
      const role =
        data.session?.user?.app_metadata?.role ||
        data.session?.user?.user_metadata?.role

      if (mounted) setAdminLoggedIn(role === 'admin')
    }

    checkAdminSession()

    return () => {
      mounted = false
    }
  }, [])

  const selectStudent = useCallback((selectedStudent: Student) => {
    setStudent(selectedStudent)
    setSearchResults([])
    setManual('')
    setMessage('พบข้อมูลนักเรียนแล้ว')
    setTopupOpen(false)
    setTopupMessage('')
    setTopupSuccess(false)
  }, [])

  const lookup = useCallback(async (token: string) => {
    if (!token.trim()) {
      setMessage('กรุณาสแกน QR หรือกรอกชื่อนักเรียน / รหัสนักเรียน')
      return
    }

    setLoading(true)
    setMessage('กำลังค้นหาข้อมูลนักเรียน...')
    setSearchResults([])

    try {
      const result = await getActiveStudentByToken(token)

      if (result.error) {
        setStudent(null)
        setMessage(`ค้นหาไม่สำเร็จ: ${result.error.message}`)
        return
      }

      if (result.data) {
        selectStudent(result.data)
        return
      }

      // ถ้าไม่ใช่ QR Token ให้ค้นจากชื่อหรือรหัสนักเรียนแทน
      const searchResult = await searchActiveStudents(token)

      if (searchResult.error) {
        setStudent(null)
        setMessage(`ค้นหาไม่สำเร็จ: ${searchResult.error.message}`)
        return
      }

      if (searchResult.data.length === 0) {
        setStudent(null)
        setMessage('ไม่พบนักเรียนจากชื่อหรือรหัสนักเรียน กรุณาลองใหม่อีกครั้ง')
        return
      }

      if (searchResult.data.length === 1) {
        selectStudent(searchResult.data[0])
        return
      }

      setStudent(null)
      setSearchResults(searchResult.data)
      setMessage(`พบ ${searchResult.data.length} คน กรุณาเลือกนักเรียนที่ต้องการ`)
    } catch (error) {
      setStudent(null)
      setMessage(`เกิดข้อผิดพลาด: ${getWalletErrorMessage(error)}`)
    } finally {
      setLoading(false)
    }
  }, [selectStudent])

  function openTopup() {
    setTopupAmount('100')
    setTopupMessage('')
    setTopupSuccess(false)
    setTopupOpen(true)
  }

  async function confirmTopup() {
    if (!student) return

    if (!adminLoggedIn) {
      setTopupMessage(
        'ไม่สามารถเติมเงินได้ เนื่องจากจุดขายยังไม่ได้เข้าสู่ระบบ Admin',
      )
      setTopupSuccess(false)
      return
    }

    const amount = Number(topupAmount)

    if (!Number.isFinite(amount) || amount <= 0) {
      setTopupMessage('กรุณาระบุจำนวนเงินที่มากกว่า 0 บาท')
      setTopupSuccess(false)
      return
    }

    setTopupLoading(true)
    setTopupMessage('กำลังเติมเงิน...')
    setTopupSuccess(false)

    try {
      const updatedStudent = await topUpStudent(
        student.id,
        amount,
        `KIOSK-${Date.now()}`,
        'เติมเงินจากจุดขาย',
      )

      setStudent((current) =>
        current
          ? { ...current, balance: Number(updatedStudent.balance) }
          : current,
      )
      setTopupMessage(`เติมเงิน ฿${amount.toFixed(2)} สำเร็จแล้ว`)
      setTopupSuccess(true)
    } catch (error) {
      setTopupMessage(`เติมเงินไม่สำเร็จ: ${getWalletErrorMessage(error)}`)
      setTopupSuccess(false)
    } finally {
      setTopupLoading(false)
    }
  }

  function resetKiosk() {
    setStudent(null)
    setSearchResults([])
    setManual('')
    setMessage('พร้อมสแกนนักเรียนคนถัดไป')
    setTopupOpen(false)
    setTopupMessage('')
    setTopupSuccess(false)
  }

  return (
    <main className="shell kiosk-page">
      <header className="topbar kiosk-topbar">
        <div className="brand-block">
          <div className="brand">🏪 จุดขายโรงเรียน</div>
          <div className="muted">สแกน QR เพื่อเลือกนักเรียน</div>
        </div>

        <div className="kiosk-header-actions">
          {adminLoggedIn ? (
            <span className="kiosk-admin-status">✓ Admin</span>
          ) : (
            <Link href="/admin/login" className="btn dark kiosk-login-btn">
              🔐 Login Admin
            </Link>
          )}

          <Link href="/" className="btn dark kiosk-home-btn">
            ← หน้าหลัก
          </Link>
        </div>
      </header>

      <div className="kiosk-layout">
        <section className="card kiosk-scanner-card">
          <div className="kiosk-card-heading">
            <div className="kiosk-heading-icon">▦</div>
            <div>
              <span className="kiosk-eyebrow">SCAN &amp; GO</span>
              <h1>สแกน QR นักเรียน</h1>
              <p>สแกน QR หรือค้นหาด้วยชื่อนักเรียน / รหัสนักเรียน</p>
            </div>
          </div>

          <div className="scanner-wrapper">
            <QrScanner onScan={lookup} />
          </div>

          <div className="kiosk-divider">
            <span>หรือค้นหานักเรียนเอง</span>
          </div>

          <div className="kiosk-manual-search">
            <input
              className="input"
              placeholder="พิมพ์ชื่อ หรือ รหัสนักเรียน"
              value={manual}
              onChange={(event) => setManual(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') lookup(manual)
              }}
            />
            <button
              type="button"
              className="btn primary"
              onClick={() => lookup(manual)}
              disabled={loading}
            >
              {loading ? 'ค้นหา...' : 'ค้นหา'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="student-search-results">
              <div className="student-search-results-title">เลือกนักเรียน</div>
              {searchResults.map((result) => (
                <button
                  type="button"
                  key={result.id}
                  className="student-search-result"
                  onClick={() => selectStudent(result)}
                >
                  <div className="student-search-avatar">
                    {result.photo_url ? (
                      <img src={result.photo_url} alt="" />
                    ) : (
                      '👤'
                    )}
                  </div>
                  <div className="student-search-info">
                    <strong>{result.full_name}</strong>
                    <span>
                      {result.student_code} · {result.class_name || 'ไม่ระบุชั้น'}
                    </span>
                  </div>
                  <span className="student-search-arrow">→</span>
                </button>
              ))}
            </div>
          )}

          {message && (
            <div
              className={`status ${student ? 'success' : searchResults.length ? 'success' : 'error'} kiosk-message`}
            >
              {student ? '✓ ' : searchResults.length ? '✓ ' : '⚠ '}
              {message}
            </div>
          )}
        </section>

        <section className="kiosk-result-card">
          {student ? (
            <>
              <div className="kiosk-result-label">STUDENT WALLET</div>

              <div className="kiosk-student-profile">
                {student.photo_url ? (
                  <img
                    className="kiosk-student-photo"
                    src={student.photo_url}
                    alt={`รูปนักเรียน ${student.full_name}`}
                  />
                ) : (
                  <div className="kiosk-student-photo kiosk-student-placeholder">👤</div>
                )}

                <div className="kiosk-student-info">
                  <span>นักเรียน</span>
                  <h2>{student.full_name}</h2>
                  <div>
                    {student.class_name || 'ไม่ระบุชั้น'} · {student.student_code}
                  </div>
                </div>
              </div>

              <div className="kiosk-balance-card">
                <span>ยอดเงินคงเหลือ</span>
                <strong>฿{Number(student.balance).toFixed(2)}</strong>
              </div>

              <div className="kiosk-action-grid">
                <Link className="kiosk-continue-btn" href={`/?student=${student.qr_token}`}>
                  <span>🛍️ ไปหน้าซื้อขนม</span>
                  <strong>→</strong>
                </Link>

                <button type="button" className="kiosk-topup-btn" onClick={openTopup}>
                  <span>💰 เติมเงิน</span>
                  <strong>＋</strong>
                </button>
              </div>

              {!adminLoggedIn && (
                <div className="kiosk-topup-warning">🔐 การเติมเงินต้อง Login Admin ก่อน</div>
              )}

              <button type="button" className="kiosk-reset-btn" onClick={resetKiosk}>
                ↻ สแกนคนถัดไป
              </button>
            </>
          ) : (
            <div className="kiosk-empty-state">
              <div className="kiosk-empty-illustration">📱</div>
              <h2>พร้อมรับ QR แล้ว</h2>
              <p>สแกน QR Code หรือค้นหาด้วยชื่อ / รหัสนักเรียนเพื่อแสดงข้อมูล</p>
              <div className="kiosk-tip">💡 สามารถพิมพ์เพียงบางส่วนของชื่อเพื่อค้นหาได้</div>
            </div>
          )}
        </section>
      </div>

      {topupOpen && student && (
        <div className="topup-modal-backdrop" role="presentation">
          <div className="topup-modal" role="dialog" aria-modal="true" aria-labelledby="topup-title">
            <div className="topup-modal-header">
              <div>
                <span className="topup-modal-eyebrow">WALLET TOP UP</span>
                <h2 id="topup-title">💰 เติมเงินให้นักเรียน</h2>
              </div>
              <button type="button" className="topup-close-btn" onClick={() => setTopupOpen(false)} aria-label="ปิดหน้าต่างเติมเงิน">×</button>
            </div>

            <div className="topup-student-mini">
              <div className="topup-student-avatar">
                {student.photo_url ? <img src={student.photo_url} alt="" /> : '👤'}
              </div>
              <div>
                <strong>{student.full_name}</strong>
                <span>{student.student_code}</span>
              </div>
            </div>

            <div className="topup-current-balance">
              <span>ยอดเงินปัจจุบัน</span>
              <strong>฿{Number(student.balance).toFixed(2)}</strong>
            </div>

            {!adminLoggedIn && (
              <div className="topup-result-message error">
                🔐 กรุณา Login Admin ก่อนใช้งานระบบเติมเงิน
                <Link href="/admin/login" className="topup-login-link">ไปหน้า Login Admin →</Link>
              </div>
            )}

            <div className="topup-field">
              <label htmlFor="topup-amount">จำนวนเงินที่ต้องการเติม</label>
              <div className="topup-input-wrap">
                <span>฿</span>
                <input id="topup-amount" type="number" min="1" step="1" inputMode="numeric" value={topupAmount} onChange={(event) => setTopupAmount(event.target.value)} disabled={!adminLoggedIn || topupLoading} />
              </div>
            </div>

            <div className="topup-quick-grid">
              {TOPUP_AMOUNTS.map((amount) => (
                <button type="button" key={amount} className={`topup-quick-btn ${Number(topupAmount) === amount ? 'active' : ''}`} onClick={() => setTopupAmount(String(amount))} disabled={!adminLoggedIn || topupLoading}>
                  ฿{amount}
                </button>
              ))}
            </div>

            {topupMessage && (
              <div className={`topup-result-message ${topupSuccess ? 'success' : 'error'}`}>
                {topupSuccess ? '✓' : '⚠'} {topupMessage}
              </div>
            )}

            {topupSuccess ? (
              <div className="topup-success-actions">
                <button type="button" className="topup-done-btn" onClick={() => setTopupOpen(false)}>✓ เสร็จเรียบร้อย</button>
                <button type="button" className="topup-another-btn" onClick={() => { setTopupAmount('100'); setTopupMessage(''); setTopupSuccess(false) }}>เติมเพิ่มอีกครั้ง</button>
              </div>
            ) : (
              <div className="topup-modal-actions">
                <button type="button" className="topup-cancel-btn" onClick={() => setTopupOpen(false)} disabled={topupLoading}>ยกเลิก</button>
                <button type="button" className="topup-confirm-btn" onClick={confirmTopup} disabled={topupLoading || !adminLoggedIn}>
                  {topupLoading ? 'กำลังเติมเงิน...' : `ยืนยันเติม ฿${Number(topupAmount || 0).toFixed(2)}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .kiosk-header-actions { display: flex; align-items: center; gap: 8px; }
        .kiosk-admin-status { min-height: 42px; display: inline-flex; align-items: center; padding: 0 14px; border-radius: 14px; background: #ecfdf5; color: #047857; font-size: 14px; font-weight: 800; }
        .kiosk-topup-warning { margin-top: 12px; padding: 11px 14px; border-radius: 14px; background: #fff7ed; color: #c2410c; font-size: 13px; font-weight: 700; text-align: center; }
        .topup-login-link { display: block; margin-top: 6px; color: inherit; font-weight: 800; }
        .kiosk-action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 18px; }
        .kiosk-topup-btn, .kiosk-continue-btn { min-height: 64px; border-radius: 18px; border: 0; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; gap: 10px; text-decoration: none; font: inherit; font-weight: 700; cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .kiosk-continue-btn { background: linear-gradient(135deg, #6d28d9, #8b5cf6); color: #fff; box-shadow: 0 12px 28px rgba(109, 40, 217, 0.22); }
        .kiosk-topup-btn { background: linear-gradient(135deg, #059669, #10b981); color: #fff; box-shadow: 0 12px 28px rgba(5, 150, 105, 0.22); }
        .kiosk-topup-btn:hover, .kiosk-continue-btn:hover { transform: translateY(-2px); }
        .student-search-results { margin-top: 14px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 18px; background: #f8fafc; }
        .student-search-results-title { margin: 2px 4px 8px; color: #334155; font-size: 13px; font-weight: 800; }
        .student-search-result { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px; border: 1px solid #e2e8f0; border-radius: 14px; background: #fff; text-align: left; cursor: pointer; margin-top: 7px; }
        .student-search-result:hover { border-color: #8b5cf6; background: #faf5ff; }
        .student-search-avatar { width: 42px; height: 42px; flex: 0 0 42px; overflow: hidden; display: grid; place-items: center; border-radius: 12px; background: #ede9fe; }
        .student-search-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .student-search-info { min-width: 0; flex: 1; }
        .student-search-info strong, .student-search-info span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .student-search-info strong { color: #172033; font-size: 14px; }
        .student-search-info span { margin-top: 2px; color: #64748b; font-size: 12px; }
        .student-search-arrow { color: #7c3aed; font-size: 20px; font-weight: 800; }
        .topup-modal-backdrop { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 18px; background: rgba(15, 23, 42, 0.68); backdrop-filter: blur(8px); }
        .topup-modal { width: min(100%, 480px); max-height: calc(100vh - 36px); overflow-y: auto; background: #fff; border-radius: 28px; padding: 24px; box-shadow: 0 30px 80px rgba(15, 23, 42, 0.28); }
        .topup-modal-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .topup-modal-eyebrow { display: block; margin-bottom: 4px; color: #059669; font-size: 12px; font-weight: 800; letter-spacing: 0.12em; }
        .topup-modal-header h2 { margin: 0; color: #172033; font-size: 25px; }
        .topup-close-btn { width: 40px; height: 40px; flex: 0 0 40px; border: 0; border-radius: 50%; background: #f1f5f9; color: #475569; font-size: 28px; line-height: 1; cursor: pointer; }
        .topup-student-mini { display: flex; align-items: center; gap: 12px; margin-top: 20px; padding: 12px; border-radius: 18px; background: #f8fafc; }
        .topup-student-avatar { width: 48px; height: 48px; overflow: hidden; border-radius: 15px; display: grid; place-items: center; background: #ede9fe; font-size: 22px; }
        .topup-student-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .topup-student-mini strong, .topup-student-mini span { display: block; }
        .topup-student-mini strong { color: #172033; font-size: 16px; }
        .topup-student-mini span { margin-top: 2px; color: #64748b; font-size: 13px; }
        .topup-current-balance { display: flex; align-items: center; justify-content: space-between; margin-top: 14px; padding: 15px 16px; border-radius: 18px; background: #ecfdf5; color: #047857; }
        .topup-current-balance span { font-size: 14px; font-weight: 600; }
        .topup-current-balance strong { font-size: 22px; }
        .topup-field { margin-top: 20px; }
        .topup-field label { display: block; margin-bottom: 8px; color: #334155; font-weight: 700; }
        .topup-input-wrap { display: flex; align-items: center; gap: 8px; padding: 4px 16px; border: 2px solid #dbeafe; border-radius: 18px; background: #fff; transition: border-color 0.15s ease, box-shadow 0.15s ease; }
        .topup-input-wrap:focus-within { border-color: #10b981; box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.12); }
        .topup-input-wrap span { color: #059669; font-size: 24px; font-weight: 800; }
        .topup-input-wrap input { width: 100%; min-width: 0; border: 0; outline: 0; padding: 12px 0; color: #172033; background: transparent; font: inherit; font-size: 28px; font-weight: 800; }
        .topup-quick-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 12px; }
        .topup-quick-btn { min-height: 44px; border: 1px solid #dbe4ef; border-radius: 12px; background: #f8fafc; color: #334155; font: inherit; font-weight: 700; cursor: pointer; }
        .topup-quick-btn.active { border-color: #10b981; background: #d1fae5; color: #047857; }
        .topup-quick-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .topup-result-message { margin-top: 14px; padding: 12px 14px; border-radius: 14px; font-weight: 600; }
        .topup-result-message.success { background: #ecfdf5; color: #047857; }
        .topup-result-message.error { background: #fef2f2; color: #b91c1c; }
        .topup-modal-actions, .topup-success-actions { display: grid; grid-template-columns: 0.8fr 1.2fr; gap: 10px; margin-top: 18px; }
        .topup-modal-actions button, .topup-success-actions button { min-height: 52px; border-radius: 15px; border: 0; padding: 12px 14px; font: inherit; font-weight: 800; cursor: pointer; }
        .topup-cancel-btn, .topup-another-btn { background: #f1f5f9; color: #475569; }
        .topup-confirm-btn, .topup-done-btn { background: #059669; color: #fff; box-shadow: 0 10px 22px rgba(5, 150, 105, 0.2); }
        .topup-modal-actions button:disabled { opacity: 0.6; cursor: not-allowed; }
        @media (max-width: 600px) {
          .kiosk-header-actions { gap: 6px; }
          .kiosk-admin-status { min-height: 38px; padding: 0 10px; font-size: 12px; }
          .kiosk-login-btn, .kiosk-home-btn { min-height: 38px; padding: 8px 10px; font-size: 12px; }
          .kiosk-action-grid { grid-template-columns: 1fr; }
          .topup-modal-backdrop { align-items: flex-end; padding: 0; }
          .topup-modal { width: 100%; max-height: 92vh; border-radius: 28px 28px 0 0; padding: 22px 18px calc(22px + env(safe-area-inset-bottom)); }
          .topup-quick-grid { grid-template-columns: repeat(3, 1fr); }
          .topup-modal-actions, .topup-success-actions { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  )
}