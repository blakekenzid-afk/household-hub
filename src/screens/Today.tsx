import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Brain, ChefHat, ChevronRight, SquareCheckBig } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Task } from '../db'
import { todayStr } from '../dates'
import TaskRow from '../components/TaskRow'
import TaskSheet from '../components/TaskSheet'

const MAX_TASKS_SHOWN = 5

export default function Today() {
  const navigate = useNavigate()
  const [editing, setEditing] = useState<Task | null>(null)

  const inboxCount = useLiveQuery(
    () => db.brainDump.where('status').equals('inbox').count(),
    [],
    0,
  )

  const dueTasks = useLiveQuery(async () => {
    const open = await db.tasks.where('status').equals('open').toArray()
    const today = todayStr()
    return open
      .filter((t) => t.dueDate && t.dueDate <= today)
      .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
  }, [])

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const shown = dueTasks?.slice(0, MAX_TASKS_SHOWN) ?? []
  const extra = (dueTasks?.length ?? 0) - shown.length

  return (
    <>
      <h1 className="screen-title">{greeting}</h1>
      <p className="screen-sub">{dateLabel}</p>

      <div className="section-label">Your inbox</div>
      <div
        className="card tappable"
        role="button"
        tabIndex={0}
        onClick={() => navigate('/apps/brain-dump')}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/apps/brain-dump')}
      >
        <div className="card-row">
          <div className="tile-icon" style={{ '--tile-color': '#7C3AED' } as React.CSSProperties}>
            <Brain aria-hidden />
          </div>
          <div className="card-row-text">
            <div className="tile-name">Brain Dump</div>
            <div className="tile-sub">
              {inboxCount === 0
                ? 'Inbox zero — nothing waiting to be sorted.'
                : `${inboxCount} thought${inboxCount === 1 ? '' : 's'} waiting to be sorted`}
            </div>
          </div>
          <ChevronRight className="chevron" aria-hidden />
        </div>
      </div>

      <div className="section-label">Today’s tasks</div>
      <div className="card today-tasks">
        <div
          className="card-row tappable"
          role="button"
          tabIndex={0}
          onClick={() => navigate('/apps/tasks')}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/apps/tasks')}
        >
          <div className="tile-icon" style={{ '--tile-color': '#2563EB' } as React.CSSProperties}>
            <SquareCheckBig aria-hidden />
          </div>
          <div className="card-row-text">
            <div className="tile-name">Tasks</div>
            <div className="tile-sub">
              {dueTasks === undefined
                ? ' '
                : dueTasks.length === 0
                  ? 'Nothing due today.'
                  : `${dueTasks.length} due or overdue`}
            </div>
          </div>
          <ChevronRight className="chevron" aria-hidden />
        </div>
        {shown.length > 0 && (
          <div className="today-task-list">
            {shown.map((t) => (
              <TaskRow key={t.id} task={t} onOpen={setEditing} />
            ))}
            {extra > 0 && (
              <button
                className="more-link"
                onClick={() => navigate('/apps/tasks')}
              >
                +{extra} more
              </button>
            )}
          </div>
        )}
      </div>

      <div className="section-label">Coming up</div>
      <div className="card muted">
        <div className="card-row">
          <div className="tile-icon" style={{ '--tile-color': '#16A34A' } as React.CSSProperties}>
            <ChefHat aria-hidden />
          </div>
          <div className="card-row-text">
            <div className="tile-name">Tonight’s dinner</div>
            <div className="tile-sub">Your meal plan will show up here — Phase 4.</div>
          </div>
        </div>
      </div>

      {editing && <TaskSheet task={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
