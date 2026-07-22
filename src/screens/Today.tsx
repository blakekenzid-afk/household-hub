import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Brain, CalendarDays, ChefHat, ChevronRight, SquareCheckBig, Wallet } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Task } from '../db'
import { eventDatesInRange, formatTime, monthStart, sameMonth, todayStr } from '../dates'
import { formatCents } from '../money'
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

  const todayEvents = useLiveQuery(async () => {
    const today = todayStr()
    const all = await db.events.toArray()
    return all
      .filter((e) => eventDatesInRange(e, today, today).length > 0)
      .sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
        return (a.startTime ?? '').localeCompare(b.startTime ?? '')
      })
  }, [])

  const monthSpent = useLiveQuery(async () => {
    const anchor = monthStart(todayStr())
    const all = await db.transactions.toArray()
    return all
      .filter((t) => t.type === 'expense' && sameMonth(t.date, anchor))
      .reduce((s, t) => s + t.amount, 0)
  }, [])

  const dinner = useLiveQuery(async () => {
    const entries = await db.mealPlan.where('date').equals(todayStr()).toArray()
    const withNames = await Promise.all(
      entries.map(async (e) => ({
        slot: e.slot,
        label:
          e.text ??
          (e.recipeId !== undefined
            ? (await db.recipes.get(e.recipeId))?.name
            : undefined) ??
          '…',
      })),
    )
    const order = { breakfast: 0, lunch: 1, dinner: 2 }
    return withNames.sort((a, b) => order[a.slot] - order[b.slot])
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

      <div className="section-label">Today’s calendar</div>
      <div className="card today-tasks">
        <div
          className="card-row tappable"
          role="button"
          tabIndex={0}
          onClick={() => navigate('/apps/calendar')}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/apps/calendar')}
        >
          <div className="tile-icon" style={{ '--tile-color': '#DC2626' } as React.CSSProperties}>
            <CalendarDays aria-hidden />
          </div>
          <div className="card-row-text">
            <div className="tile-name">Calendar</div>
            <div className="tile-sub">
              {todayEvents === undefined
                ? ' '
                : todayEvents.length === 0
                  ? 'Nothing on today.'
                  : `${todayEvents.length} event${todayEvents.length === 1 ? '' : 's'} today`}
            </div>
          </div>
          <ChevronRight className="chevron" aria-hidden />
        </div>
        {todayEvents && todayEvents.length > 0 && (
          <div className="today-task-list">
            {todayEvents.map((e) => (
              <div key={e.id} className="today-event">
                <span className="today-event-time">
                  {e.allDay ? 'All day' : formatTime(e.startTime!)}
                </span>
                <span className="today-event-title">{e.title || 'Untitled event'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section-label">Today’s meals</div>
      <div
        className="card tappable"
        role="button"
        tabIndex={0}
        onClick={() => navigate('/apps/meals')}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/apps/meals')}
      >
        <div className="card-row">
          <div className="tile-icon" style={{ '--tile-color': '#16A34A' } as React.CSSProperties}>
            <ChefHat aria-hidden />
          </div>
          <div className="card-row-text">
            <div className="tile-name">Meals</div>
            <div className="tile-sub">
              {dinner === undefined
                ? ' '
                : dinner.length === 0
                  ? 'Nothing planned today — tap to plan.'
                  : dinner
                      .map((d) => `${d.slot === 'dinner' ? 'Dinner' : d.slot === 'lunch' ? 'Lunch' : 'Breakfast'}: ${d.label}`)
                      .join(' · ')}
            </div>
          </div>
          <ChevronRight className="chevron" aria-hidden />
        </div>
      </div>

      <div className="section-label">This month</div>
      <div
        className="card tappable"
        role="button"
        tabIndex={0}
        onClick={() => navigate('/apps/finance')}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/apps/finance')}
      >
        <div className="card-row">
          <div className="tile-icon" style={{ '--tile-color': '#4F46E5' } as React.CSSProperties}>
            <Wallet aria-hidden />
          </div>
          <div className="card-row-text">
            <div className="tile-name">Finance</div>
            <div className="tile-sub">
              {monthSpent === undefined
                ? ' '
                : monthSpent === 0
                  ? 'No spending logged this month.'
                  : `${formatCents(monthSpent)} spent this month`}
            </div>
          </div>
          <ChevronRight className="chevron" aria-hidden />
        </div>
      </div>

      {editing && <TaskSheet task={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
