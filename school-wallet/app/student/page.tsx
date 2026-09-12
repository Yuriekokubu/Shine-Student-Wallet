'use client'

import { useState } from 'react'
import QrScanner from '../../components/QrScanner'
import { getActiveStudentByToken, getPublicStudentTransactions } from '../../lib/services/student-service'
import type { Student, StudentTransaction } from '../../types/school-wallet'

const TRANSACTIONS_PER_PAGE = 5

export default function StudentPage() {
  const [student, setStudent] = useState<Student | null>(null)
  const [scanToken, setScanToken] = useState('')
  const [transactions, setTransactions] = useState<StudentTransaction[]>([])
  const [transactionsPage, setTransactionsPage] = useState(1)
  const [transactionsHasMore, setTransactionsHasMore] = useState(false)
  const [showTransactions, setShowTransactions] = useState(false)
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [transactionsError, setTransactionsError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleScan(token: string) {
    setLoading(true)
    setError('')
    setStudent(null)
    setShowTransactions(false)
    setTransactions([])
    setTransactionsPage(1)
    setTransactionsHasMore(false)
    setScanToken(token)

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

  async function loadTransactions(page: number) {
    if (!scanToken) return

    setTransactionsLoading(true)
    setTransactionsError('')

    try {
      const { data, error: queryError, hasMore } = await getPublicStudentTransactions(
        scanToken,
        page,
        TRANSACTIONS_PER_PAGE,
      )

      if (queryError) throw queryError

      setTransactions(data)
      setTransactionsPage(page)
      setTransactionsHasMore(hasMore)
    } catch (err: any) {
      console.error('[StudentPage] transactions error:', err)
      setTransactionsError(err?.message || 'ไม่สามารถโหลดประวัติธุรกรรมได้ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setTransactionsLoading(false)
    }
  }

  async function openTransactions() {
    if (!scanToken) return

    setShowTransactions(true)
    setTransactionsPage(1)
    setTransactions([])
    setTransactionsHasMore(false)
    await loadTransactions(1)
  }

  function scanAgain() {
    setStudent(null)
    setScanToken('')
    setTransactions([])
    setTransactionsPage(1)
    setTransactionsHasMore(false)
    setShowTransactions(false)
    setTransactionsError('')
    setError('')
  }

  const balance = Number(student?.balance ?? 0)
  const formattedBalance = balance.toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const transactionStudentName = student?.full_name ?? ''

  function formatDate(value: string) {
    return new Date(value).toLocaleString('th-TH', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }

  function formatAmount(amount: number) {
    return Math.abs(Number(amount)).toLocaleString('th-TH', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    })
  }

  function getTransactionTitle(transaction: StudentTransaction) {
    if (transaction.type === 'topup') return 'เติมเงิน'
    if (transaction.type === 'purchase') return 'ซื้อสินค้า'
    if (transaction.type === 'refund') return 'คืนเงิน'
    return 'ปรับยอดเงิน'
  }

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
            <p className="student-scan-description">สแกน QR Code ประจำตัวนักเรียนเพื่อดูยอดเงินคงเหลือ</p>
            <div className="student-scanner-frame"><QrScanner onScan={handleScan} /></div>
            {loading && <div className="student-loading"><span className="student-spinner" />กำลังตรวจสอบข้อมูลนักเรียน...</div>}
            {error && <div className="student-error"><span>⚠️</span><span>{error}</span></div>}
            <div className="student-hint"><span>💡</span>หัน QR Code เข้าหากล้องให้อยู่ภายในกรอบ</div>
          </section>
        ) : (
          <section className="student-result-card">
            <div className="student-result-glow" />
            <div className="student-success-badge"><span>✓</span> พบข้อมูลนักเรียน</div>

            <div className="student-photo-hero">
              <div className="student-photo-ring">
                {student.photo_url ? (
                  <img src={student.photo_url} alt={`รูปของ ${student.full_name}`} className="student-photo" />
                ) : (
                  <div className="student-photo student-photo-placeholder">👤</div>
                )}
              </div>
              <div className="student-photo-check">✓</div>
            </div>

            <div className="student-name-block">
              <div className="student-label">นักเรียน</div>
              <h1>{student.full_name}</h1>
              <div className="student-class">{student.class_name || 'ไม่ระบุชั้นเรียน'}</div>
            </div>

            <div className="student-balance-card">
              <div className="student-balance-label"><span className="student-balance-icon">฿</span><span>ยอดเงินคงเหลือ</span></div>
              <div className="student-balance-amount"><span className="student-currency">฿</span><strong>{formattedBalance}</strong></div>
              <div className="student-balance-note">พร้อมใช้งาน</div>
            </div>

            <div className="student-safe-note">🔒 ข้อมูลนี้แสดงเฉพาะยอดเงินคงเหลือของนักเรียน</div>

            <button type="button" className="student-history-button" onClick={openTransactions}>
              <span className="student-history-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M6 3h12v18H6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              </span>
              <span><strong>ดูประวัติธุรกรรมย้อนหลัง</strong><small>รายการเติมเงินและการซื้อสินค้า</small></span>
              <span className="student-history-arrow">›</span>
            </button>

            <button type="button" className="student-scan-again" onClick={scanAgain} aria-label="สแกน QR Code">
              <span className="student-scan-camera-icon" aria-hidden="true">
                <svg viewBox="0 0 64 64" fill="none"><path d="M16 20h7l4-6h10l4 6h7c3.3 0 6 2.7 6 6v20c0 3.3-2.7 6-6 6H16c-3.3 0-6-2.7-6-6V26c0-3.3 2.7-6 6-6Z" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" /><circle cx="32" cy="36" r="10" stroke="currentColor" strokeWidth="4" /><circle cx="47" cy="27" r="2.5" fill="currentColor" /></svg>
              </span>
              <span className="student-scan-again-text">สแกน QR Code</span>
              <span className="student-arrow">→</span>
            </button>
          </section>
        )}

        <footer className="student-footer"><span>School Wallet</span><span>•</span><span>ระบบตรวจสอบยอดเงินนักเรียน</span></footer>
      </div>

      {showTransactions && (
        <div className="student-modal-backdrop" onClick={() => setShowTransactions(false)}>
          <section className="student-history-modal" role="dialog" aria-modal="true" aria-labelledby="student-history-title" onClick={(event) => event.stopPropagation()}>
            <div className="student-history-modal-header">
              <div>
                <div className="student-history-modal-kicker">TRANSACTION HISTORY</div>
                <h2 id="student-history-title">ประวัติธุรกรรม</h2>
                <p>{transactionStudentName}</p>
              </div>
              <button type="button" className="student-modal-close" onClick={() => setShowTransactions(false)} aria-label="ปิดประวัติธุรกรรม">×</button>
            </div>

            <div className="student-history-list">
              {transactionsLoading ? (
                <div className="student-history-state"><span className="student-spinner student-spinner-dark" />กำลังโหลดประวัติธุรกรรม...</div>
              ) : transactionsError ? (
                <div className="student-history-state student-history-error"><span>⚠️</span>{transactionsError}</div>
              ) : transactions.length === 0 ? (
                <div className="student-history-state"><span className="student-empty-icon">📋</span>ยังไม่มีประวัติธุรกรรม</div>
              ) : (
                transactions.map((transaction) => {
                  const isTopup = transaction.type === 'topup' || transaction.type === 'refund'
                  return (
                    <article className="student-transaction-item" key={transaction.id}>
                      <div className={`student-transaction-icon ${isTopup ? 'is-in' : 'is-out'}`}>{isTopup ? '↓' : '↑'}</div>
                      <div className="student-transaction-main">
                        <div className="student-transaction-title-row"><strong>{getTransactionTitle(transaction)}</strong><strong className={isTopup ? 'amount-in' : 'amount-out'}>{isTopup ? '+' : '-'}฿{formatAmount(transaction.amount)}</strong></div>
                        <div className="student-transaction-date">{formatDate(transaction.created_at)}</div>
                        {transaction.items?.length > 0 && <div className="student-transaction-items">{transaction.items.map((item, index) => <div key={`${transaction.id}-${index}`}>{item.name} × {item.quantity}</div>)}</div>}
                        {transaction.note && <div className="student-transaction-note">{transaction.note}</div>}
                      </div>
                    </article>
                  )
                })
              )}
            </div>

            {!transactionsLoading && !transactionsError && transactions.length > 0 && (
              <div className="student-pagination">
                <button
                  type="button"
                  className="student-page-button"
                  onClick={() => loadTransactions(transactionsPage - 1)}
                  disabled={transactionsPage <= 1}
                >
                  ‹ ก่อนหน้า
                </button>
                <span className="student-page-number">หน้า {transactionsPage}</span>
                <button
                  type="button"
                  className="student-page-button"
                  onClick={() => loadTransactions(transactionsPage + 1)}
                  disabled={!transactionsHasMore}
                >
                  ถัดไป ›
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      <style jsx>{`
        .student-page { position:relative; min-height:100svh; overflow:hidden; padding:24px 16px 34px; background:radial-gradient(circle at 50% -10%,rgba(99,91,255,.22),transparent 34%),linear-gradient(180deg,#f7f8ff 0%,#eef2ff 100%); }
        .student-bg-orb { position:absolute; border-radius:50%; pointer-events:none; filter:blur(2px); }
        .student-bg-orb-one { width:240px;height:240px;top:110px;left:-150px;background:rgba(129,140,248,.16); }
        .student-bg-orb-two { width:300px;height:300px;right:-190px;bottom:70px;background:rgba(45,212,191,.1); }
        .student-container { position:relative;z-index:1;width:min(100%,520px);margin:0 auto; }
        .student-header { display:flex;align-items:center;justify-content:center;gap:11px;margin-bottom:20px; }
        .student-logo { width:48px;height:48px;display:grid;place-items:center;border-radius:15px;background:linear-gradient(135deg,#635bff,#4f46e5);color:#fff;font-size:24px;box-shadow:0 10px 24px rgba(79,70,229,.24); }
        .student-brand { color:#252b45;font-size:16px;font-weight:800;letter-spacing:1.2px;line-height:1.15; }
        .student-subtitle { color:#7b849b;font-size:11px;margin-top:2px; }
        .student-scan-card,.student-result-card { position:relative;overflow:hidden;border-radius:30px;box-shadow:0 24px 70px rgba(52,58,105,.12);backdrop-filter:blur(14px); }
        .student-scan-card { border:1px solid rgba(226,230,244,.9);background:rgba(255,255,255,.94);padding:28px 22px 22px;text-align:center; }
        .student-scan-icon { width:58px;height:58px;display:grid;place-items:center;margin:0 auto 12px;border-radius:19px;background:linear-gradient(135deg,#eeedff,#e8f0ff);color:#5b52e8;font-size:31px; }
        .student-scan-title { color:#20263a;font-size:25px;font-weight:800; }
        .student-scan-description { max-width:360px;margin:6px auto 18px;color:#7b849b;font-size:13px;line-height:1.7; }
        .student-scanner-frame { overflow:hidden;padding:8px;border-radius:24px;background:#111827;box-shadow:0 14px 30px rgba(15,23,42,.13); }
        .student-loading { display:flex;align-items:center;justify-content:center;gap:9px;margin-top:14px;padding:11px 14px;border-radius:14px;background:#f1f3ff;color:#5148d8;font-size:12px;font-weight:600; }
        .student-spinner { width:16px;height:16px;border:2px solid #c9c7ff;border-top-color:#5b52e8;border-radius:50%;animation:student-spin .75s linear infinite; }
        .student-spinner-dark { border-color:#dfe3f2;border-top-color:#5b52e8; }
        .student-error { display:flex;align-items:flex-start;justify-content:center;gap:8px;margin-top:14px;padding:12px 14px;border-radius:14px;background:#fff0f2;color:#b42332;font-size:12px;line-height:1.5;text-align:left; }
        .student-hint { display:flex;align-items:center;justify-content:center;gap:7px;margin-top:15px;color:#8992a8;font-size:11px; }
        .student-result-card { padding:26px 20px 20px;background:radial-gradient(circle at 50% -10%,rgba(255,255,255,.28),transparent 16rem),linear-gradient(145deg,#6155e8 0%,#4f46c8 58%,#4338a8 100%);border:0;color:#fff;box-shadow:0 28px 70px rgba(67,56,168,.28);text-align:center; }
        .student-result-glow { position:absolute;width:260px;height:260px;left:50%;top:-160px;transform:translateX(-50%);border:38px solid rgba(255,255,255,.07);border-radius:50%;pointer-events:none; }
        .student-success-badge { position:relative;z-index:1;width:fit-content;display:flex;align-items:center;gap:6px;margin:0 auto 18px;padding:7px 12px;border:1px solid rgba(255,255,255,.18);border-radius:99px;background:rgba(255,255,255,.12);color:rgba(255,255,255,.92);font-size:11px;font-weight:700; }
        .student-success-badge span { width:18px;height:18px;display:grid;place-items:center;border-radius:50%;background:#d1fae5;color:#047857;font-size:12px; }
        .student-photo-hero { position:relative;z-index:1;width:230px;height:230px;margin:0 auto 17px;display:grid;place-items:center; }
        .student-photo-ring { width:218px;height:218px;padding:7px;border-radius:50%;background:rgba(255,255,255,.96);box-shadow:0 22px 50px rgba(25,20,89,.32),0 0 0 8px rgba(255,255,255,.08); }
        .student-photo { width:100%;height:100%;display:block;object-fit:cover;border-radius:50%;background:#fff; }
        .student-photo-placeholder { display:grid;place-items:center;color:#5b52e8;font-size:70px; }
        .student-photo-check { position:absolute;right:12px;bottom:9px;width:42px;height:42px;display:grid;place-items:center;border:4px solid #5148d2;border-radius:50%;background:#d1fae5;color:#047857;font-size:20px;font-weight:900;box-shadow:0 8px 18px rgba(0,0,0,.18); }
        .student-name-block { position:relative;z-index:1; }
        .student-label { margin-bottom:3px;color:rgba(255,255,255,.62);font-size:12px; }
        .student-name-block h1 { max-width:100%;margin:0;color:#fff;font-size:30px;line-height:1.25;word-break:break-word; }
        .student-class { margin-top:5px;color:rgba(255,255,255,.76);font-size:13px; }
        .student-balance-card { position:relative;z-index:1;margin-top:23px;padding:19px 18px 17px;border:1px solid rgba(255,255,255,.15);border-radius:23px;background:rgba(255,255,255,.12);box-shadow:inset 0 1px 0 rgba(255,255,255,.08); }
        .student-balance-label { display:flex;align-items:center;justify-content:center;gap:8px;color:rgba(255,255,255,.78);font-size:13px; }
        .student-balance-icon { width:28px;height:28px;display:grid;place-items:center;border-radius:9px;background:rgba(255,255,255,.16);color:#fff;font-weight:800; }
        .student-balance-amount { display:flex;align-items:baseline;justify-content:center;gap:7px;margin-top:4px; }
        .student-currency { color:rgba(255,255,255,.72);font-size:25px;font-weight:600; }
        .student-balance-amount strong { font-size:clamp(42px,11vw,58px);line-height:1.05;letter-spacing:-1px; }
        .student-balance-note { margin-top:5px;color:rgba(255,255,255,.58);font-size:10px; }
        .student-safe-note { position:relative;z-index:1;margin-top:13px;color:rgba(255,255,255,.66);font-size:10px; }
        .student-history-button { position:relative;z-index:1;width:100%;min-height:70px;display:flex;align-items:center;gap:12px;margin-top:15px;padding:10px 14px;border:1px solid rgba(255,255,255,.14);border-radius:19px;background:rgba(255,255,255,.13);color:#fff;font:inherit;cursor:pointer;transition:transform .16s ease,background .16s ease;text-align:left; }
        .student-history-button:hover { transform:translateY(-1px);background:rgba(255,255,255,.18); }
        .student-history-icon { width:45px;height:45px;flex:0 0 45px;display:grid;place-items:center;border-radius:13px;background:rgba(255,255,255,.15); }
        .student-history-icon svg { width:25px;height:25px; }
        .student-history-button strong { display:block;font-size:14px; }
        .student-history-button small { display:block;margin-top:3px;color:rgba(255,255,255,.62);font-size:10px; }
        .student-history-arrow { margin-left:auto;color:rgba(255,255,255,.72);font-size:28px;line-height:1; }
        .student-scan-again { position:relative;z-index:1;width:100%;min-height:68px;display:flex;align-items:center;gap:13px;margin-top:12px;padding:10px 16px;border:0;border-radius:19px;background:#fff;color:#4138a4;font:inherit;cursor:pointer;box-shadow:0 12px 26px rgba(25,20,89,.18);transition:transform .16s ease,box-shadow .16s ease;text-align:left; }
        .student-scan-again:hover { transform:translateY(-1px);box-shadow:0 15px 30px rgba(25,20,89,.22); }
        .student-scan-again:active { transform:scale(.98); }
        .student-scan-camera-icon { width:48px;height:48px;flex:0 0 48px;display:grid;place-items:center;border-radius:14px;background:#eeedff;color:#5148d8; }
        .student-scan-camera-icon svg { width:34px;height:34px; }
        .student-scan-again-text { font-size:17px;font-weight:850; }
        .student-arrow { margin-left:auto;font-size:23px; }
        .student-modal-backdrop { position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.55);backdrop-filter:blur(6px); }
        .student-history-modal { width:min(100%,500px);max-height:min(720px,calc(100svh - 36px));display:flex;flex-direction:column;overflow:hidden;border-radius:26px;background:#fff;color:#20263a;box-shadow:0 30px 90px rgba(15,23,42,.3); }
        .student-history-modal-header { display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:22px 20px 16px;border-bottom:1px solid #edf0f7; }
        .student-history-modal-kicker { color:#6258df;font-size:9px;font-weight:800;letter-spacing:1.2px; }
        .student-history-modal h2 { margin:3px 0 0;font-size:22px; }
        .student-history-modal-header p { margin:3px 0 0;color:#8a93a8;font-size:11px; }
        .student-modal-close { width:38px;height:38px;flex:0 0 38px;border:0;border-radius:12px;background:#f1f3f8;color:#5e667b;font-size:27px;line-height:1;cursor:pointer; }
        .student-history-list { overflow-y:auto;padding:8px 14px 8px; }
        .student-history-state { min-height:180px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;color:#7d879b;font-size:12px;text-align:center; }
        .student-history-error { color:#b42332;padding:20px; }
        .student-empty-icon { font-size:34px; }
        .student-transaction-item { display:flex;gap:11px;padding:13px 6px;border-bottom:1px solid #edf0f7; }
        .student-transaction-item:last-child { border-bottom:0; }
        .student-transaction-icon { width:38px;height:38px;flex:0 0 38px;display:grid;place-items:center;border-radius:12px;font-size:19px;font-weight:800; }
        .student-transaction-icon.is-in { background:#e8faf1;color:#0b9460; }
        .student-transaction-icon.is-out { background:#fff0f2;color:#d13c51; }
        .student-transaction-main { min-width:0;flex:1; }
        .student-transaction-title-row { display:flex;align-items:flex-start;justify-content:space-between;gap:10px; }
        .student-transaction-title-row strong:first-child { font-size:13px; }
        .student-transaction-title-row strong:last-child { white-space:nowrap;font-size:13px; }
        .amount-in { color:#07905c; }
        .amount-out { color:#d13c51; }
        .student-transaction-date { margin-top:2px;color:#98a0b2;font-size:9px; }
        .student-transaction-items { margin-top:7px;padding:7px 9px;border-radius:9px;background:#f6f7fb;color:#697287;font-size:10px;line-height:1.65; }
        .student-transaction-note { margin-top:5px;color:#8a93a8;font-size:9px; }
        .student-pagination { display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px 14px;border-top:1px solid #edf0f7;background:#fff; }
        .student-page-button { min-width:92px;height:38px;padding:0 12px;border:1px solid #e2e5ee;border-radius:11px;background:#f7f8fc;color:#4d556a;font:inherit;font-size:11px;font-weight:700;cursor:pointer;transition:background .15s ease,transform .15s ease; }
        .student-page-button:hover:not(:disabled) { background:#eeedff;color:#5148d8;transform:translateY(-1px); }
        .student-page-button:disabled { opacity:.38;cursor:not-allowed; }
        .student-page-number { min-width:55px;text-align:center;color:#697287;font-size:11px;font-weight:700; }
        .student-footer { display:flex;align-items:center;justify-content:center;gap:7px;margin-top:17px;color:#9aa3b7;font-size:9px; }
        @keyframes student-spin { to { transform:rotate(360deg); } }
        @media (max-width:480px) {
          .student-page { padding:15px 10px 25px; }
          .student-header { margin-bottom:13px; }
          .student-logo { width:42px;height:42px;border-radius:13px;font-size:21px; }
          .student-brand { font-size:14px; }
          .student-scan-card { padding:22px 13px 17px;border-radius:24px; }
          .student-scan-title { font-size:22px; }
          .student-scan-description { font-size:11px;margin-bottom:13px; }
          .student-result-card { padding:21px 14px 16px;border-radius:24px; }
          .student-success-badge { margin-bottom:14px; }
          .student-photo-hero { width:205px;height:205px;margin-bottom:13px; }
          .student-photo-ring { width:194px;height:194px;padding:6px; }
          .student-photo-check { width:38px;height:38px;right:9px;bottom:7px;border-width:3px; }
          .student-name-block h1 { font-size:24px; }
          .student-class { font-size:11px; }
          .student-balance-card { margin-top:18px;padding:16px 14px; }
          .student-balance-amount strong { font-size:42px; }
          .student-currency { font-size:21px; }
          .student-history-button { min-height:66px; }
          .student-history-button strong { font-size:13px; }
          .student-scan-again { min-height:64px; }
          .student-scan-camera-icon { width:46px;height:46px;flex-basis:46px; }
          .student-scan-again-text { font-size:15px; }
          .student-modal-backdrop { padding:10px; }
          .student-history-modal { max-height:calc(100svh - 20px);border-radius:22px; }
          .student-history-modal-header { padding:18px 15px 13px; }
          .student-history-modal h2 { font-size:20px; }
          .student-page-button { min-width:84px;height:36px;padding:0 9px;font-size:10px; }
          .student-page-number { font-size:10px; }
        }
      `}</style>
    </main>
  )
}
