import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronLeft, Plus, ShoppingCart, X } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

export default function Shopping() {
  const [quickText, setQuickText] = useState('')

  const items = useLiveQuery(() => db.shopping.orderBy('createdAt').toArray(), [])
  const open = (items ?? []).filter((i) => !i.checked)
  const checked = (items ?? []).filter((i) => i.checked)

  async function quickAdd() {
    const text = quickText.trim()
    if (!text) return
    await db.shopping.add({ text, checked: false, createdAt: Date.now() })
    setQuickText('')
  }

  async function toggle(id: number, value: boolean) {
    await db.shopping.update(id, { checked: value })
  }

  async function remove(id: number) {
    await db.shopping.delete(id)
  }

  async function clearChecked() {
    await db.shopping.bulkDelete(checked.map((i) => i.id))
  }

  return (
    <>
      <div className="nav-header">
        <Link to="/apps" className="back-link">
          <ChevronLeft aria-hidden /> Apps
        </Link>
      </div>
      <h1 className="screen-title">Shopping</h1>
      <p className="screen-sub">
        One list for the store — fed by you, the meal planner, and your brain dump.
      </p>

      <form
        className="quick-add"
        onSubmit={(e) => {
          e.preventDefault()
          void quickAdd()
        }}
      >
        <input
          className="quick-add-input"
          placeholder="Add an item…"
          value={quickText}
          onChange={(e) => setQuickText(e.target.value)}
        />
        <button
          type="submit"
          className="quick-add-btn"
          disabled={!quickText.trim()}
          aria-label="Add item"
        >
          <Plus aria-hidden />
        </button>
      </form>

      {items && items.length === 0 && (
        <div className="empty">
          <ShoppingCart aria-hidden />
          <div className="empty-title">List’s empty</div>
          <p>
            Add items above, send a week of ingredients over from the meal
            planner, or move thoughts in from your brain dump.
          </p>
        </div>
      )}

      {open.length > 0 && (
        <>
          <div className="section-label">To buy ({open.length})</div>
          <div className="row-group">
            {open.map((i) => (
              <div key={i.id} className="task-row">
                <button
                  className="check"
                  aria-label="Mark bought"
                  onClick={() => void toggle(i.id, true)}
                >
                  <Check aria-hidden />
                </button>
                <div className="task-body no-tap">
                  <div className="task-title">{i.text}</div>
                  {i.source && (
                    <div className="task-meta">
                      <span className="note-folder">{i.source}</span>
                    </div>
                  )}
                </div>
                <button
                  className="icon-btn subtle"
                  aria-label="Remove item"
                  onClick={() => void remove(i.id)}
                >
                  <X aria-hidden />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {checked.length > 0 && (
        <>
          <div className="section-label">In the cart ({checked.length})</div>
          <div className="row-group">
            {checked.map((i) => (
              <div key={i.id} className="task-row">
                <button
                  className="check done"
                  aria-label="Put back"
                  onClick={() => void toggle(i.id, false)}
                >
                  <Check aria-hidden />
                </button>
                <div className="task-body no-tap">
                  <div className="task-title done">{i.text}</div>
                </div>
                <button
                  className="icon-btn subtle"
                  aria-label="Remove item"
                  onClick={() => void remove(i.id)}
                >
                  <X aria-hidden />
                </button>
              </div>
            ))}
          </div>
          <button className="btn danger-ghost" onClick={() => void clearChecked()}>
            Clear checked items
          </button>
        </>
      )}
    </>
  )
}
