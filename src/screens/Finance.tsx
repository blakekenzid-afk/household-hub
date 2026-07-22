import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, Wallet } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Transaction } from '../db'
import { addMonths, dayHeading, monthLabel, monthStart, sameMonth, todayStr } from '../dates'
import { formatCents } from '../money'
import { categoryColor } from '../finance-data'
import TransactionSheet from '../components/TransactionSheet'

export default function Finance() {
  const today = todayStr()
  const [monthAnchor, setMonthAnchor] = useState(() => monthStart(today))
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [adding, setAdding] = useState(false)

  const all = useLiveQuery(() => db.transactions.toArray(), [])
  const monthTx = (all ?? [])
    .filter((t) => sameMonth(t.date, monthAnchor))
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))

  const income = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const spent = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const net = income - spent

  // group the month's entries by day, newest first
  const groups: { date: string; items: Transaction[] }[] = []
  for (const t of monthTx) {
    const last = groups[groups.length - 1]
    if (last && last.date === t.date) last.items.push(t)
    else groups.push({ date: t.date, items: [t] })
  }

  return (
    <>
      <div className="nav-header">
        <Link to="/apps" className="back-link">
          <ChevronLeft aria-hidden /> Apps
        </Link>
      </div>
      <h1 className="screen-title">Finance</h1>
      <p className="screen-sub">Track what comes in and what goes out.</p>

      <div className="week-nav">
        <button
          className="icon-btn"
          aria-label="Previous month"
          onClick={() => setMonthAnchor((m) => addMonths(m, -1))}
        >
          <ChevronLeft aria-hidden />
        </button>
        <button
          className="week-label"
          onClick={() => setMonthAnchor(monthStart(today))}
          title="Jump to this month"
        >
          {monthLabel(monthAnchor)}
        </button>
        <button
          className="icon-btn"
          aria-label="Next month"
          onClick={() => setMonthAnchor((m) => addMonths(m, 1))}
        >
          <ChevronRight aria-hidden />
        </button>
      </div>

      <div className="card fin-summary">
        <div className="fin-stat">
          <span className="fin-stat-label">In</span>
          <span className="fin-stat-value income">{formatCents(income)}</span>
        </div>
        <div className="fin-stat">
          <span className="fin-stat-label">Out</span>
          <span className="fin-stat-value expense">{formatCents(spent)}</span>
        </div>
        <div className="fin-stat">
          <span className="fin-stat-label">Net</span>
          <span className={`fin-stat-value${net < 0 ? ' expense' : net > 0 ? ' income' : ''}`}>
            {net < 0 ? `−${formatCents(-net)}` : formatCents(net)}
          </span>
        </div>
      </div>

      <button className="btn secondary" onClick={() => setAdding(true)}>
        <Plus aria-hidden /> Add entry
      </button>

      {monthTx.length === 0 && (
        <div className="empty">
          <Wallet aria-hidden />
          <div className="empty-title">Nothing logged this month</div>
          <p>Tap “Add entry” to record an expense or some income.</p>
        </div>
      )}

      <div className="stack" style={{ marginTop: 14 }}>
        {groups.map((g) => (
          <div key={g.date} className="fin-group">
            <div className="agenda-date">{dayHeading(g.date)}</div>
            <div className="card day-detail">
              {g.items.map((t) => (
                <button key={t.id} className="tx-row" onClick={() => setEditing(t)}>
                  <span
                    className="tx-dot"
                    style={{ background: categoryColor(t.category) }}
                    aria-hidden
                  />
                  <span className="tx-main">
                    <span className="tx-category">{t.category}</span>
                    {t.note && <span className="tx-note">{t.note}</span>}
                  </span>
                  <span className={`tx-amount ${t.type}`}>
                    {t.type === 'expense' ? '−' : '+'}
                    {formatCents(t.amount)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {(adding || editing) && (
        <TransactionSheet
          transaction={editing ?? undefined}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
        />
      )}
    </>
  )
}
