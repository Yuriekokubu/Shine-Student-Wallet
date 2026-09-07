type AdminStatsProps = {
  activeStudents: number
  totalBalance: number
  transactionCount: number
  totalTopup: number
  totalPurchase: number
}

export default function AdminStats({
  activeStudents,
  totalBalance,
  transactionCount,
  totalTopup,
  totalPurchase,
}: AdminStatsProps) {
  return (
    <div className="grid admin-stats">
      <div className="card">
        <div className="stat-icon blue">👨‍🎓</div>
        <div>
          <div className="muted">นักเรียน</div>
          <div className="stat-number">{activeStudents}</div>
          <div className="muted">คน</div>
        </div>
      </div>

      <div className="card">
        <div className="stat-icon green">฿</div>
        <div>
          <div className="muted">ยอดเงินคงเหลือรวม</div>
          <div className="stat-number">฿{totalBalance.toFixed(2)}</div>
        </div>
      </div>

      <div className="card">
        <div className="stat-icon purple">↔</div>
        <div>
          <div className="muted">ธุรกรรม</div>
          <div className="stat-number">{transactionCount}</div>
          <div className="muted">
            เติม ฿{totalTopup.toFixed(2)} · ซื้อ ฿{totalPurchase.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  )
}
