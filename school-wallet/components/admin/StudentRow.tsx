import type { Student } from '../../types/school-wallet'

type StudentRowProps = {
  student: Student
  onTopUp: () => void
  onShowQr: () => void
  onEdit: () => void
  onDeactivate: () => void
}

export default function StudentRow({
  student,
  onTopUp,
  onShowQr,
  onEdit,
  onDeactivate,
}: StudentRowProps) {
  return (
    <div className="student-row">
      <div className="student-main">
        {student.photo_url ? (
          <img src={student.photo_url} alt="" className="student-avatar" />
        ) : (
          <div className="student-avatar-placeholder student-avatar">👤</div>
        )}

        <div>
          <b>{student.full_name}</b>
          <div className="muted">
            {student.student_code} · {student.class_name || 'ไม่ระบุชั้น'}
          </div>
        </div>
      </div>

      <div className="student-balance">
        ฿{Number(student.balance).toFixed(2)}
      </div>

      <div className="student-actions">
        <button className="btn primary" onClick={onTopUp}>
          ＋ เติมเงิน
        </button>
        <button className="btn" onClick={onShowQr}>
          ▦ QR
        </button>
        <button className="btn" onClick={onEdit}>
          ✎ แก้ไข
        </button>
        <button className="btn danger-btn" onClick={onDeactivate}>
          ปิดใช้งาน
        </button>
      </div>
    </div>
  )
}
