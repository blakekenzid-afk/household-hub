import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, ChefHat, SquareCheckBig, X, type LucideIcon } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { eventDatesInRange, hhmmToMinutes, todayStr } from '../dates'

// How the in-app reminder surfacing behaves. This is Stage 1: it only nudges
// while the app is open. Real background delivery (Web Push) is Stage 2.
const SOON_MINUTES = 60 // show a timed event once it's within this window
const DINNER_HOUR = 15 // from mid-afternoon, nudge if no dinner is planned
const MAX_SHOWN = 2
const STORE_KEY = 'hh-dismissed-reminders'

interface Reminder {
  id: string
  icon: LucideIcon
  text: string
  route: string
}

function loadDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(STORE_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

export default function ReminderBar() {
  const navigate = useNavigate()
  const [now, setNow] = useState(() => new Date())
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed)

  // Re-evaluate every minute so "in N min" counts down and time windows open.
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  const today = todayStr()
  const events = useLiveQuery(() => db.events.toArray(), [])
  const dueTasks = useLiveQuery(
    async () => {
      const open = await db.tasks.where('status').equals('open').toArray()
      return open.filter((t) => t.dueDate && t.dueDate <= today).map((t) => t.dueDate!)
    },
    [today],
    [] as string[],
  )
  // Default true so a nudge never flashes before the meal plan has loaded.
  const dinnerPlanned = useLiveQuery(
    async () => {
      const entries = await db.mealPlan.where('date').equals(today).toArray()
      return entries.some((e) => e.slot === 'dinner' && (e.text || e.recipeId != null))
    },
    [today],
    true,
  )

  const nowMin = now.getHours() * 60 + now.getMinutes()

  const reminders = useMemo<Reminder[]>(() => {
    const list: Reminder[] = []

    // Timed events today that start within the next hour (most time-sensitive).
    for (const e of events ?? []) {
      if (e.allDay || !e.startTime) continue
      if (eventDatesInRange(e, today, today).length === 0) continue
      const delta = hhmmToMinutes(e.startTime) - nowMin
      if (delta < 0 || delta > SOON_MINUTES) continue
      list.push({
        id: `evt-${e.id}-${today}`,
        icon: CalendarClock,
        text: delta === 0 ? `“${e.title}” starts now` : `“${e.title}” starts in ${delta} min`,
        route: '/apps/calendar',
      })
    }

    // Evening nudge if there's still no dinner planned.
    if (now.getHours() >= DINNER_HOUR && !dinnerPlanned) {
      list.push({
        id: `meal-${today}`,
        icon: ChefHat,
        text: 'No dinner planned for tonight',
        route: '/apps/meals',
      })
    }

    // Tasks due today or already overdue.
    const due = dueTasks ?? []
    if (due.length > 0) {
      const overdue = due.filter((d) => d < today).length
      list.push({
        id: `tasks-${today}`,
        icon: SquareCheckBig,
        text:
          overdue > 0
            ? `${due.length} task${due.length === 1 ? '' : 's'} due or overdue`
            : `${due.length} task${due.length === 1 ? '' : 's'} due today`,
        route: '/apps/tasks',
      })
    }

    return list.filter((r) => !dismissed.has(r.id)).slice(0, MAX_SHOWN)
  }, [events, dueTasks, dinnerPlanned, nowMin, now, today, dismissed])

  if (reminders.length === 0) return null

  function dismiss(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(id)
      sessionStorage.setItem(STORE_KEY, JSON.stringify([...next]))
      return next
    })
  }

  return (
    <div className="reminder-bar">
      {reminders.map((r) => {
        const Icon = r.icon
        return (
          <div key={r.id} className="reminder">
            <button className="reminder-main" onClick={() => navigate(r.route)}>
              <Icon aria-hidden />
              <span>{r.text}</span>
            </button>
            <button
              className="reminder-x"
              aria-label="Dismiss reminder"
              onClick={() => dismiss(r.id)}
            >
              <X aria-hidden />
            </button>
          </div>
        )
      })}
    </div>
  )
}
