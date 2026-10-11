'use client'

import type { Dispatch, SetStateAction } from 'react'
import type { Student, WalletTransaction, ConfirmModalData } from '../../types/admin'

type AdminOverlaysProps = {
  selected: Student | null
  topupModalOpen: boolean
  topupLoading: boolean
  topupAmount: string
  topupReference: string
  topupNote: string
  setTopupAmount: (value: string) => void
  setTopupReference: (value: string) => void
  setTopupNote: (value: string) => void
  onCloseTopup: () => void
  onTopup: () => void | Promise<void>

  editTopup: WalletTransaction | null
  selectedStudentName: string
  editTopupLoading: boolean
  editTopupAmount: string
  editTopupReference: string
  editTopupNote: string
  setEditTopupAmount: (value: string) => void
  setEditTopupReference: (value: string) => void
  setEditTopupNote: (value: string) => void
  onCloseEditTopup: () => void
  onSaveEditTopup: () => void | Promise<void>

  confirmModal: ConfirmModalData | null
  confirmLoading: boolean
  setConfirmModal: Dispatch<SetStateAction<ConfirmModalData | null>>
  setConfirmLoading: (value: boolean) => void
  setMessage: (value: string) => void
}

export default function AdminOverlays({
  selected,
  topupModalOpen,
  topupLoading,
  topupAmount,
  topupReference,
  topupNote,
  setTopupAmount,
  setTopupReference,
  setTopupNote,
  onCloseTopup,
  onTopup,
  editTopup,
  selectedStudentName,
  editTopupLoading,
  editTopupAmount,
  editTopupReference,
  editTopupNote,
  setEditTopupAmount,
  setEditTopupReference,
  setEditTopupNote,
  onCloseEditTopup,
  onSaveEditTopup,
  confirmModal,
  confirmLoading,
  setConfirmModal,
  setConfirmLoading,
  setMessage,
}: AdminOverlaysProps) {
  return (
    <>
      {topupModalOpen && selected && (
        <div
          className="topup-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) onCloseTopup()
          }}
        >
          <div className="topup-modal-card" role="dialog" aria-modal="true" aria-labelledby="topup-modal-title">
            <div className="topup-modal-header">
              <div className="topup-student-profile">
                {selected.photo_url ? (
                  <img src={selected.photo_url} alt="" className="topup-modal-avatar" />
                ) : (
                  <div className="topup-modal-avatar topup-modal-avatar-placeholder">👤</div>
                )}
                <div>
                  <span className="topup-modal-badge">เติมเงินนักเรียน</span>
                  <h2 id="topup-modal-title">{selected.full_name}</h2>
                  <p>{selected.student_code} · {selected.class_name || 'ไม่ระบุชั้น'}</p>
                </div>
              </div>
              <button
                type="button"
                className="topup-modal-close"
                onClick={onCloseTopup}
                disabled={topupLoading}
                aria-label="ปิดหน้าต่างเติมเงิน"
              >
                ×
              </button>
            </div>

            <div className="topup-modal-balance">
              <span>ยอดเงินปัจจุบัน</span>
              <strong>฿{Number(selected.balance).toFixed(2)}</strong>
            </div>

            <div className="topup-modal-presets">
              {[10, 15, 20, 30, 40].map((preset) => (
                <button
                  type="button"
                  key={preset}
                  className={`topup-modal-preset ${Number(topupAmount) === preset ? 'active' : ''}`}
                  onClick={() => setTopupAmount(String(preset))}
                  disabled={topupLoading}
                >
                  ฿{preset}
                </button>
              ))}
            </div>

            <label className="topup-modal-label" htmlFor="admin-topup-amount">จำนวนเงินที่ต้องการเติม</label>
            <div className="topup-modal-amount-wrap">
              <span>฿</span>
              <input
                id="admin-topup-amount"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                placeholder="0"
                value={topupAmount}
                onChange={(event) => setTopupAmount(event.target.value)}
                disabled={topupLoading}
                autoFocus
              />
            </div>

            <input
              className="input topup-modal-input"
              placeholder="อ้างอิง เช่น เลขสลิป (ถ้ามี)"
              value={topupReference}
              onChange={(event) => setTopupReference(event.target.value)}
              disabled={topupLoading}
            />

            <input
              className="input topup-modal-input"
              placeholder="หมายเหตุ (ถ้ามี)"
              value={topupNote}
              onChange={(event) => setTopupNote(event.target.value)}
              disabled={topupLoading}
            />

            <div className="topup-modal-actions">
              <button type="button" className="topup-modal-cancel" onClick={onCloseTopup} disabled={topupLoading}>
                ยกเลิก
              </button>
              <button
                type="button"
                className="topup-modal-confirm"
                onClick={onTopup}
                disabled={topupLoading || !topupAmount || Number(topupAmount) <= 0}
              >
                {topupLoading
                  ? 'กำลังเติมเงิน...'
                  : `✓ ยืนยันเติม ${topupAmount ? `฿${Number(topupAmount).toFixed(2)}` : 'เงิน'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {editTopup && (
        <div
          className="edit-topup-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget && !editTopupLoading) onCloseEditTopup()
          }}
        >
          <div className="edit-topup-modal-card" role="dialog" aria-modal="true">
            <div className="edit-topup-modal-header">
              <div>
                <span className="edit-topup-modal-badge">✏️ แก้ไขรายการเติมเงิน</span>
                <h2>แก้ไขยอดเติมเงินย้อนหลัง</h2>
                <p>
                  {selectedStudentName || 'นักเรียน'} · รายการเมื่อ{' '}
                  {new Date(editTopup.created_at).toLocaleString('th-TH')}
                </p>
              </div>
              <button
                type="button"
                className="topup-modal-close"
                onClick={onCloseEditTopup}
                disabled={editTopupLoading}
                aria-label="ปิด"
              >
                ×
              </button>
            </div>

            <div className="edit-topup-warning">
              <strong>⚠️ โปรดตรวจสอบจำนวนเงิน</strong>
              <span>ระบบจะคำนวณยอดคงเหลือใหม่จากรายการนี้และรายการถัดไปโดยอัตโนมัติ</span>
            </div>

            <label className="topup-modal-label">จำนวนเงินที่ถูกต้อง</label>
            <div className="topup-modal-amount-wrap">
              <span>฿</span>
              <input
                inputMode="decimal"
                type="number"
                min="0.01"
                step="0.01"
                value={editTopupAmount}
                onChange={(event) => setEditTopupAmount(event.target.value)}
                disabled={editTopupLoading}
                autoFocus
              />
            </div>

            <label className="topup-modal-label">เลขอ้างอิง (ถ้ามี)</label>
            <input
              className="input topup-modal-input"
              placeholder="เช่น เงินสด / ใบเสร็จ / Ref"
              value={editTopupReference}
              onChange={(event) => setEditTopupReference(event.target.value)}
              disabled={editTopupLoading}
            />

            <label className="topup-modal-label">หมายเหตุ</label>
            <input
              className="input topup-modal-input"
              placeholder="เช่น แก้จาก 100 บาท เป็น 50 บาท"
              value={editTopupNote}
              onChange={(event) => setEditTopupNote(event.target.value)}
              disabled={editTopupLoading}
            />

            <div className="edit-topup-old-value">
              <span>ยอดเดิม</span>
              <strong>฿{Number(editTopup.amount).toFixed(2)}</strong>
              <span>→</span>
              <strong>฿{Number(editTopupAmount || 0).toFixed(2)}</strong>
            </div>

            <div className="topup-modal-actions">
              <button type="button" className="topup-modal-cancel" onClick={onCloseEditTopup} disabled={editTopupLoading}>
                ยกเลิก
              </button>
              <button
                type="button"
                className="topup-modal-confirm"
                onClick={onSaveEditTopup}
                disabled={editTopupLoading || editTopupAmount === '' || Number(editTopupAmount) < 0}
              >
                {editTopupLoading ? 'กำลังบันทึก...' : '✓ บันทึกการแก้ไข'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModal && (
        <div
          className="confirm-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget && !confirmLoading) setConfirmModal(null)
          }}
        >
          <div className="confirm-modal-card" role="dialog" aria-modal="true">
            <div className="confirm-modal-icon-ring">
              <span>{confirmModal.icon || '⚠️'}</span>
            </div>
            <h3 className="confirm-modal-title">{confirmModal.title}</h3>
            <p className="confirm-modal-message">{confirmModal.message}</p>

            {confirmModal.detail && <div className="confirm-modal-detail">{confirmModal.detail}</div>}

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
                  } catch (error) {
                    setMessage(`เกิดข้อผิดพลาด: ${error instanceof Error ? error.message : String(error)}`)
                  } finally {
                    setConfirmLoading(false)
                  }
                }}
                disabled={confirmLoading}
              >
                {confirmLoading ? 'กำลังดำเนินการ...' : confirmModal.confirmText || 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}