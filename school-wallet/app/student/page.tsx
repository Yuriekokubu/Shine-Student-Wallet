'use client'

import { useState } from 'react'
import QrScanner from '../../components/QrScanner'
import { getActiveStudentByToken } from '../../lib/services/student-service'
import type { Student } from '../../types/school-wallet'

export default function StudentPage() {
  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleScan(token: string) {
    setLoading(true)
    setError('')
    setStudent(null)

    try {
      const { data, error: queryError } = await getActiveStudentByToken(token)
      if (queryError) throw queryError
      if (!data) {
        setError('ไม่พบข้อมูลนักเรียน หรือ QR Code นี้ไม่สามารถใช้งานได้')
        return
      }
      setStudent(data)
    } catch (err: any) {
      console.error('[StudentPage] lookup error:', err)
      setError(err?.message || 'ไม่สามารถตรวจสอบข้อมูลได้ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  function scanAgain() {
    setStudent(null)
    setError('')
  }

  const balance = Number(student?.balance ?? 0)
  const formattedBalance = balance.toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return (
    <main className="student-page">
      <div className="student-bg-orb student-bg-orb-one" />
      <div className="student-bg-orb student-bg-orb-two" />
      <div className="student-container">
        <header className="student-header">
          <div className="student-logo">💳</div>
          <div>
            <div className="student-brand">SCHOOL WALLET</div>
            <div className="student-subtitle">กระเป๋าเงินนักเรียน</div>
          </div>
        </header>

        {!student ? (
          <section className="student-scan-card">
            <div className="student-scan-icon">▦</div>
            <div className="student-scan-title">สแกน QR Code</div>
            <p className="student-scan-description">
              สแกน QR Code ประจำตัวนักเรียนเพื่อดูยอดเงินคงเหลือ
            </p>
            <div className="student-scanner-frame">
              <QrScanner onScan={handleScan} />
            </div>
            {loading && (
              <div className="student-loading">
                <span className="student-spinner" />
                กำลังตรวจสอบข้อมูลนักเรียน...
              </div>
            )}
            {error && (
              <div className="student-error">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}
            <div className="student-hint">
              <span>💡</span>
              หัน QR Code เข้าหากล้องให้อยู่ภายในกรอบ
            </div>
          </section>
        ) : (
          <section className="student-result-card">
            <div className="student-result-glow" />
            <div className="student-success-badge">
              <span>✓</span> พบข้อมูลนักเรียน
            </div>

            {/* รูปนักเรียนขนาดใหญ่ — เน้นให้เห็นตัวเด็กชัดเจนหลังสแกน */}
            <div className="student-photo-hero">
              <div className="student-photo-ring">
                {student.photo_url ? (
                  <img
                    src={student.photo_url}
                    alt={`รูปของ ${student.full_name}`}
                    className="student-photo"
                  />
                ) : (
                  <div className="student-photo student-photo-placeholder">👤</div>
                )}
              </div>
              <div className="student-photo-check">✓</div>
            </div>

            <div className="student-name-block">
              <div className="student-label">นักเรียน</div>
              <h1>{student.full_name}</h1>
              <div className="student-class">
                {student.class_name || 'ไม่ระบุชั้นเรียน'}
              </div>
            </div>

            <div className="student-balance-card">
              <div className="student-balance-label">
                <span className="student-balance-icon">฿</span>
                <span>ยอดเงินคงเหลือ</span>
              </div>
              <div className="student-balance-amount">
                <span className="student-currency">฿</span>
                <strong>{formattedBalance}</strong>
              </div>
              <div className="student-balance-note">พร้อมใช้งาน</div>
            </div>

            <div className="student-safe-note">
              🔒 ข้อมูลนี้แสดงเฉพาะยอดเงินคงเหลือของนักเรียน
            </div>

            <button type="button" className="student-scan-again" onClick={scanAgain}>
              <span>📷</span>
              <span>สแกนนักเรียนคนถัดไป</span>
              <span className="student-arrow">→</span>
            </button>
          </section>
        )}

        <footer className="student-footer">
          <span>School Wallet</span>
          <span>•</span>
          <span>ระบบตรวจสอบยอดเงินนักเรียน</span>
        </footer>
      </div>

      <style jsx>{`
        .student-page {
          position: relative;
          min-height: 100svh;
          overflow: hidden;
          padding: 24px 16px 34px;
          background: radial-gradient(circle at 50% -10%, rgba(99, 91, 255, 0.22), transparent 34%), linear-gradient(180deg, #f7f8ff 0%, #eef2ff 100%);
        }
        .student-bg-orb { position: absolute; border-radius: 50%; pointer-events: none; filter: blur(2px); }
        .student-bg-orb-one { width: 240px; height: 240px; top: 110px; left: -150px; background: rgba(129, 140, 248, 0.16); }
        .student-bg-orb-two { width: 300px; height: 300px; right: -190px; bottom: 70px; background: rgba(45, 212, 191, 0.1); }
        .student-container { position: relative; z-index: 1; width: min(100%, 520px); margin: 0 auto; }
        .student-header { display: flex; align-items: center; justify-content: center; gap: 11px; margin-bottom: 20px; }
        .student-logo { width: 48px; height: 48px; display: grid; place-items: center; border-radius: 15px; background: linear-gradient(135deg, #635bff, #4f46e5); color: #fff; font-size: 24px; box-shadow: 0 10px 24px rgba(79, 70, 229, 0.24); }
        .student-brand { color: #252b45; font-size: 16px; font-weight: 800; letter-spacing: 1.2px; line-height: 1.15; }
        .student-subtitle { color: #7b849b; font-size: 11px; margin-top: 2px; }
        .student-scan-card, .student-result-card { position: relative; overflow: hidden; border-radius: 30px; box-shadow: 0 24px 70px rgba(52, 58, 105, 0.12); backdrop-filter: blur(14px); }
        .student-scan-card { border: 1px solid rgba(226, 230, 244, 0.9); background: rgba(255, 255, 255, 0.94); padding: 28px 22px 22px; text-align: center; }
        .student-scan-icon { width: 58px; height: 58px; display: grid; place-items: center; margin: 0 auto 12px; border-radius: 19px; background: linear-gradient(135deg, #eeedff, #e8f0ff); color: #5b52e8; font-size: 31px; }
        .student-scan-title { color: #20263a; font-size: 25px; font-weight: 800; }
        .student-scan-description { max-width: 360px; margin: 6px auto 18px; color: #7b849b; font-size: 13px; line-height: 1.7; }
        .student-scanner-frame { overflow: hidden; padding: 8px; border-radius: 24px; background: #111827; box-shadow: 0 14px 30px rgba(15, 23, 42, 0.13); }
        .student-loading { display: flex; align-items: center; justify-content: center; gap: 9px; margin-top: 14px; padding: 11px 14px; border-radius: 14px; background: #f1f3ff; color: #5148d8; font-size: 12px; font-weight: 600; }
        .student-spinner { width: 16px; height: 16px; border: 2px solid #c9c7ff; border-top-color: #5b52e8; border-radius: 50%; animation: student-spin 0.75s linear infinite; }
        .student-error { display: flex; align-items: flex-start; justify-content: center; gap: 8px; margin-top: 14px; padding: 12px 14px; border-radius: 14px; background: #fff0f2; color: #b42332; font-size: 12px; line-height: 1.5; text-align: left; }
        .student-hint { display: flex; align-items: center; justify-content: center; gap: 7px; margin-top: 15px; color: #8992a8; font-size: 11px; }

        .student-result-card {
          padding: 26px 20px 20px;
          background: radial-gradient(circle at 50% -10%, rgba(255, 255, 255, 0.28), transparent 16rem), linear-gradient(145deg, #6155e8 0%, #4f46c8 58%, #4338a8 100%);
          border: 0;
          color: #fff;
          box-shadow: 0 28px 70px rgba(67, 56, 168, 0.28);
          text-align: center;
        }
        .student-result-glow { position: absolute; width: 260px; height: 260px; left: 50%; top: -160px; transform: translateX(-50%); border: 38px solid rgba(255, 255, 255, 0.07); border-radius: 50%; pointer-events: none; }
        .student-success-badge { position: relative; z-index: 1; width: fit-content; display: flex; align-items: center; gap: 6px; margin: 0 auto 18px; padding: 7px 12px; border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 99px; background: rgba(255, 255, 255, 0.12); color: rgba(255, 255, 255, 0.92); font-size: 11px; font-weight: 700; }
        .student-success-badge span { width: 18px; height: 18px; display: grid; place-items: center; border-radius: 50%; background: #d1fae5; color: #047857; font-size: 12px; }

        /* รูปใหญ่เด่นที่สุดบนหน้าผลลัพธ์ */
        .student-photo-hero { position: relative; z-index: 1; width: 230px; height: 230px; margin: 0 auto 17px; display: grid; place-items: center; }
        .student-photo-ring { width: 218px; height: 218px; padding: 7px; border-radius: 50%; background: rgba(255,255,255,0.96); box-shadow: 0 22px 50px rgba(25, 20, 89, 0.32), 0 0 0 8px rgba(255,255,255,0.08); }
        .student-photo { width: 100%; height: 100%; display: block; object-fit: cover; border-radius: 50%; background: #fff; }
        .student-photo-placeholder { display: grid; place-items: center; color: #5b52e8; font-size: 70px; }
        .student-photo-check { position: absolute; right: 12px; bottom: 9px; width: 42px; height: 42px; display: grid; place-items: center; border: 4px solid #5148d2; border-radius: 50%; background: #d1fae5; color: #047857; font-size: 20px; font-weight: 900; box-shadow: 0 8px 18px rgba(0,0,0,0.18); }
        .student-name-block { position: relative; z-index: 1; }
        .student-label { margin-bottom: 3px; color: rgba(255, 255, 255, 0.62); font-size: 12px; }
        .student-name-block h1 { max-width: 100%; margin: 0; color: #fff; font-size: 30px; line-height: 1.25; word-break: break-word; }
        .student-class { margin-top: 5px; color: rgba(255, 255, 255, 0.76); font-size: 13px; }
        .student-balance-card { position: relative; z-index: 1; margin-top: 23px; padding: 19px 18px 17px; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 23px; background: rgba(255, 255, 255, 0.12); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08); }
        .student-balance-label { display: flex; align-items: center; justify-content: center; gap: 8px; color: rgba(255, 255, 255, 0.78); font-size: 13px; }
        .student-balance-icon { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 9px; background: rgba(255, 255, 255, 0.16); color: #fff; font-weight: 800; }
        .student-balance-amount { display: flex; align-items: baseline; justify-content: center; gap: 7px; margin-top: 4px; }
        .student-currency { color: rgba(255, 255, 255, 0.72); font-size: 25px; font-weight: 600; }
        .student-balance-amount strong { font-size: clamp(42px, 11vw, 58px); line-height: 1.05; letter-spacing: -1px; }
        .student-balance-note { margin-top: 5px; color: rgba(255, 255, 255, 0.58); font-size: 10px; }
        .student-safe-note { position: relative; z-index: 1; margin-top: 13px; color: rgba(255, 255, 255, 0.66); font-size: 10px; }
        .student-scan-again { position: relative; z-index: 1; width: 100%; min-height: 55px; display: flex; align-items: center; gap: 10px; margin-top: 19px; padding: 12px 16px; border: 0; border-radius: 17px; background: #fff; color: #4138a4; font: inherit; font-size: 14px; font-weight: 800; cursor: pointer; box-shadow: 0 12px 26px rgba(25, 20, 89, 0.18); transition: transform 0.16s ease, box-shadow 0.16s ease; }
        .student-scan-again:hover { transform: translateY(-1px); box-shadow: 0 15px 30px rgba(25, 20, 89, 0.22); }
        .student-scan-again:active { transform: scale(0.98); }
        .student-arrow { margin-left: auto; font-size: 21px; }
        .student-footer { display: flex; align-items: center; justify-content: center; gap: 7px; margin-top: 17px; color: #9aa3b7; font-size: 9px; }
        @keyframes student-spin { to { transform: rotate(360deg); } }

        @media (max-width: 480px) {
          .student-page { padding: 15px 10px 25px; }
          .student-header { margin-bottom: 13px; }
          .student-logo { width: 42px; height: 42px; border-radius: 13px; font-size: 21px; }
          .student-brand { font-size: 14px; }
          .student-scan-card { padding: 22px 13px 17px; border-radius: 24px; }
          .student-scan-title { font-size: 22px; }
          .student-scan-description { font-size: 11px; margin-bottom: 13px; }
          .student-result-card { padding: 21px 14px 16px; border-radius: 24px; }
          .student-success-badge { margin-bottom: 14px; }
          .student-photo-hero { width: 205px; height: 205px; margin-bottom: 13px; }
          .student-photo-ring { width: 194px; height: 194px; padding: 6px; }
          .student-photo-check { width: 38px; height: 38px; right: 9px; bottom: 7px; border-width: 3px; }
          .student-name-block h1 { font-size: 24px; }
          .student-class { font-size: 11px; }
          .student-balance-card { margin-top: 18px; padding: 16px 14px; }
          .student-balance-amount strong { font-size: 42px; }
          .student-currency { font-size: 21px; }
          .student-scan-again { min-height: 51px; font-size: 12px; }
        }
      `}</style>
    </main>
  )
}