import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Brain, ChevronLeft, Plus } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type BrainDumpItem } from '../db'
import { relativeTime } from '../time'
import CaptureSheet from '../components/CaptureSheet'
import TaskSheet from '../components/TaskSheet'

const SORTED_LABELS: Record<string, string> = {
  task: 'Task',
  note: 'Note',
  'list-item': 'List',
  shopping: 'Shopping',
  recipe: 'Recipe',
  event: 'Event',
}

export default function BrainDump() {
  const navigate = useNavigate()
  const [view, setView] = useState<'inbox' | 'sorted'>('inbox')
  const [editing, setEditing] = useState<BrainDumpItem | null>(null)
  const [newTaskId, setNewTaskId] = useState<number | null>(null)
  const [quickText, setQuickText] = useState('')

  const items = useLiveQuery(async () => {
    const all = await db.brainDump.where('status').equals(view).toArray()
    return all.sort((a, b) => b.createdAt - a.createdAt)
  }, [view])

  const newTask = useLiveQuery(
    () => (newTaskId !== null ? db.tasks.get(newTaskId) : undefined),
    [newTaskId],
  )

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

  async function clearSorted() {
    const sorted = await db.brainDump.where('status').equals('sorted').toArray()
    if (!window.confirm(`Delete all ${sorted.length} sorted thoughts?`)) return
    await db.brainDump.bulkDelete(sorted.map((i) => i.id))
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

      <div className="chip-row seg-row">
        <button
          className={`chip${view === 'inbox' ? ' active' : ''}`}
          onClick={() => setView('inbox')}
        >
          Inbox
        </button>
        <button
          className={`chip${view === 'sorted' ? ' active' : ''}`}
          onClick={() => setView('sorted')}
        >
          Sorted
        </button>
      </div>

      {view === 'inbox' && (
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
      )}

      {items && items.length === 0 && view === 'inbox' && (
        <div className="empty">
          <Brain aria-hidden />
          <div className="empty-title">Your head is clear</div>
          <p>
            Anything you type here — or capture with the big + button — lands in
            this inbox until you sort it.
          </p>
        </div>
      )}

      {items && items.length === 0 && view === 'sorted' && (
        <div className="empty">
          <ArrowRight aria-hidden />
          <div className="empty-title">Nothing sorted yet</div>
          <p>
            Tap a thought in your inbox and use “Move to” — it ends up in the
            right app and gets filed here.
          </p>
        </div>
      )}

      <div className="stack" style={view === 'sorted' ? { marginTop: 16 } : undefined}>
        {items?.map((item) => (
          <button
            key={item.id}
            className="card dump-item tappable"
            onClick={() => setEditing(item)}
          >
            <div className="dump-body">
              <div className="dump-text">{item.text}</div>
              <div className="dump-time">
                {item.status === 'sorted' && item.sortedTo && (
                  <span className="sorted-tag">
                    → {SORTED_LABELS[item.sortedTo] ?? item.sortedTo}
                  </span>
                )}
                {relativeTime(item.createdAt)}
              </div>
            </div>
          </button>
        ))}
      </div>

      {view === 'sorted' && items && items.length > 0 && (
        <button className="btn danger-ghost" onClick={() => void clearSorted()}>
          Clear sorted
        </button>
      )}

      {editing && (
        <CaptureSheet
          item={editing}
          onClose={() => setEditing(null)}
          onMoveToTask={setNewTaskId}
          onMoveToNote={(noteId) => navigate(`/apps/notes/${noteId}`)}
          onMoveToRecipe={(recipeId) => navigate(`/apps/meals/recipes/${recipeId}`)}
          onMoveToEvent={(eventId) =>
            navigate('/apps/calendar', { state: { openEventId: eventId } })
          }
        />
      )}
      {newTaskId !== null && newTask && (
        <TaskSheet task={newTask} onClose={() => setNewTaskId(null)} />
      )}
    </>
  )
}
