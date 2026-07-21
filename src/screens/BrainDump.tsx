import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Brain, ChevronLeft, Plus } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type BrainDumpItem } from '../db'
import { relativeTime } from '../time'
import CaptureSheet from '../components/CaptureSheet'

export default function BrainDump() {
  const [editing, setEditing] = useState<BrainDumpItem | null>(null)
  const [quickText, setQuickText] = useState('')

  const items = useLiveQuery(async () => {
    const inbox = await db.brainDump.where('status').equals('inbox').toArray()
    return inbox.sort((a, b) => b.createdAt - a.createdAt)
  }, [])

  async function quickAdd() {
    const trimmed = quickText.trim()
    if (!trimmed) return
    await db.brainDump.add({
      text: trimmed,
      createdAt: Date.now(),
      status: 'inbox',
    })
    setQuickText('')
  }

  return (
    <>
      <div className="nav-header">
        <Link to="/apps" className="back-link">
          <ChevronLeft aria-hidden /> Apps
        </Link>
      </div>
      <h1 className="screen-title">Brain Dump</h1>
      <p className="screen-sub">
        Get it out of your head now. Sort it into the right place later.
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
          placeholder="Type a thought…"
          value={quickText}
          onChange={(e) => setQuickText(e.target.value)}
        />
        <button
          type="submit"
          className="quick-add-btn"
          disabled={!quickText.trim()}
          aria-label="Add"
        >
          <Plus aria-hidden />
        </button>
      </form>

      {items && items.length === 0 && (
        <div className="empty">
          <Brain aria-hidden />
          <div className="empty-title">Your head is clear</div>
          <p>
            Anything you type here — or capture with the big + button — lands in
            this inbox until you sort it.
          </p>
        </div>
      )}

      <div className="stack">
        {items?.map((item) => (
          <button
            key={item.id}
            className="card dump-item tappable"
            onClick={() => setEditing(item)}
          >
            <div className="dump-body">
              <div className="dump-text">{item.text}</div>
              <div className="dump-time">{relativeTime(item.createdAt)}</div>
            </div>
          </button>
        ))}
      </div>

      {editing && (
        <CaptureSheet item={editing} onClose={() => setEditing(null)} />
      )}
    </>
  )
}
