import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Plus, SquareCheckBig } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Task } from '../db'
import { todayStr } from '../dates'
import TaskRow from '../components/TaskRow'
import TaskSheet from '../components/TaskSheet'

export default function Tasks() {
  const [view, setView] = useState<'open' | 'done'>('open')
  const [editing, setEditing] = useState<Task | null>(null)
  const [quickTitle, setQuickTitle] = useState('')

  const tasks = useLiveQuery(() => db.tasks.toArray(), [])

  const today = todayStr()
  const open = (tasks ?? []).filter((t) => t.status === 'open')
  const byDate = (a: Task, b: Task) => (a.dueDate! < b.dueDate! ? -1 : 1)
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today).sort(byDate)
  const dueToday = open.filter((t) => t.dueDate === today)
  const upcoming = open.filter((t) => t.dueDate && t.dueDate > today).sort(byDate)
  const someday = open
    .filter((t) => !t.dueDate)
    .sort((a, b) => b.createdAt - a.createdAt)
  const done = (tasks ?? [])
    .filter((t) => t.status === 'done')
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))

  async function quickAdd() {
    const trimmed = quickTitle.trim()
    if (!trimmed) return
    await db.tasks.add({
      title: trimmed,
      status: 'open',
      priority: 'none',
      repeat: 'none',
      createdAt: Date.now(),
    })
    setQuickTitle('')
  }

  async function clearDone() {
    if (!window.confirm(`Delete all ${done.length} completed tasks?`)) return
    await db.tasks.bulkDelete(done.map((t) => t.id))
  }

  function section(label: string, list: Task[], tone?: 'overdue') {
    if (list.length === 0) return null
    return (
      <>
        <div className={`section-label${tone === 'overdue' ? ' overdue' : ''}`}>
          {label}
        </div>
        <div className="row-group">
          {list.map((t) => (
            <TaskRow key={t.id} task={t} onOpen={setEditing} />
          ))}
        </div>
      </>
    )
  }

  return (
    <>
      <div className="nav-header">
        <Link to="/apps" className="back-link">
          <ChevronLeft aria-hidden /> Apps
        </Link>
      </div>
      <h1 className="screen-title">Tasks</h1>
      <p className="screen-sub">To-dos, chores, and everything with a deadline.</p>

      <div className="chip-row seg-row">
        <button
          className={`chip${view === 'open' ? ' active' : ''}`}
          onClick={() => setView('open')}
        >
          Open{open.length > 0 ? ` (${open.length})` : ''}
        </button>
        <button
          className={`chip${view === 'done' ? ' active' : ''}`}
          onClick={() => setView('done')}
        >
          Done{done.length > 0 ? ` (${done.length})` : ''}
        </button>
      </div>

      {view === 'open' && (
        <>
          <form
            className="quick-add"
            onSubmit={(e) => {
              e.preventDefault()
              void quickAdd()
            }}
          >
            <input
              className="quick-add-input"
              placeholder="Add a task…"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
            />
            <button
              type="submit"
              className="quick-add-btn"
              disabled={!quickTitle.trim()}
              aria-label="Add task"
            >
              <Plus aria-hidden />
            </button>
          </form>

          {open.length === 0 && tasks && (
            <div className="empty">
              <SquareCheckBig aria-hidden />
              <div className="empty-title">All clear</div>
              <p>
                Add a task above, or move a thought over from your Brain Dump
                inbox.
              </p>
            </div>
          )}

          {section('Overdue', overdue, 'overdue')}
          {section('Today', dueToday)}
          {section('Upcoming', upcoming)}
          {section('Someday', someday)}
        </>
      )}

      {view === 'done' && (
        <>
          {done.length === 0 ? (
            <div className="empty">
              <SquareCheckBig aria-hidden />
              <div className="empty-title">Nothing finished yet</div>
              <p>Completed tasks land here.</p>
            </div>
          ) : (
            <>
              <div className="row-group" style={{ marginTop: 16 }}>
                {done.map((t) => (
                  <TaskRow key={t.id} task={t} onOpen={setEditing} />
                ))}
              </div>
              <button className="btn danger-ghost" onClick={() => void clearDone()}>
                Clear completed
              </button>
            </>
          )}
        </>
      )}

      {editing && <TaskSheet task={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
