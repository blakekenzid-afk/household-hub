import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  CalendarPlus,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  Repeat,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type CalendarEvent, type Task } from '../db'
import {
  addDays,
  addMonths,
  dayHeading,
  eventOccurrenceDays,
  formatTime,
  monthGridDates,
  monthLabel,
  monthStart,
  parse,
  sameMonth,
  todayStr,
} from '../dates'
import { noteColorHex } from '../note-colors'
import EventSheet from '../components/EventSheet'
import TaskSheet from '../components/TaskSheet'
import TaskRow from '../components/TaskRow'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const AGENDA_DAYS = 60
const TASK_COLOR = '#2563EB'

/** An event's colour — its chosen palette colour, or the calendar red. */
function eventColor(ev: CalendarEvent): string {
  return noteColorHex(ev.color) ?? '#DC2626'
}

function rangeLabel(ev: CalendarEvent): string {
  const s = parse(ev.date)
  const e = parse(ev.endDate!)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const end =
    s.getMonth() === e.getMonth()
      ? e.toLocaleDateString(undefined, { day: 'numeric' })
      : e.toLocaleDateString(undefined, opts)
  return `${s.toLocaleDateString(undefined, opts)} – ${end}`
}

/** Events sorted for display: all-day first, then by start time. */
function sortEvents(evs: CalendarEvent[]): CalendarEvent[] {
  return [...evs].sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
    if (a.allDay) return a.title.localeCompare(b.title)
    return (a.startTime ?? '').localeCompare(b.startTime ?? '')
  })
}

function EventRow({ event, onOpen }: { event: CalendarEvent; onOpen: () => void }) {
  const time = event.allDay
    ? 'All day'
    : event.endTime
      ? `${formatTime(event.startTime!)} – ${formatTime(event.endTime)}`
      : formatTime(event.startTime!)
  const multiDay = event.endDate && event.endDate > event.date
  return (
    <button className="event-row" onClick={onOpen}>
      <span className="event-stripe" style={{ background: eventColor(event) }} aria-hidden />
      <span className={`event-time${event.allDay ? ' all-day' : ''}`}>{time}</span>
      <span className="event-main">
        <span className="event-title">{event.title || 'Untitled event'}</span>
        {(event.location || event.repeat !== 'none' || multiDay) && (
          <span className="event-sub">
            {multiDay && (
              <>
                <CalendarRange aria-hidden />
                {rangeLabel(event)}
              </>
            )}
            {event.repeat !== 'none' && <Repeat aria-label="Repeats" />}
            {event.location && (
              <>
                <MapPin aria-hidden />
                {event.location}
              </>
            )}
          </span>
        )}
      </span>
    </button>
  )
}

export default function Calendar() {
  const navigate = useNavigate()
  const location = useLocation()
  const today = todayStr()
  const [view, setView] = useState<'month' | 'agenda'>('month')
  const [monthAnchor, setMonthAnchor] = useState(() => monthStart(today))
  const [selected, setSelected] = useState(today)
  const [editingEvent, setEditingEvent] = useState<{
    event?: CalendarEvent
    date?: string
  } | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const events = useLiveQuery(() => db.events.toArray(), [])
  const tasks = useLiveQuery(
    async () => (await db.tasks.where('status').equals('open').toArray()).filter((t) => t.dueDate),
    [],
  )

  // Opened via Brain Dump triage ("Move to → Event"): jump to that event.
  const openEventId = (location.state as { openEventId?: number } | null)?.openEventId
  useEffect(() => {
    if (openEventId == null || !events) return
    const ev = events.find((e) => e.id === openEventId)
    if (ev) {
      setSelected(ev.date)
      setMonthAnchor(monthStart(ev.date))
      setEditingEvent({ event: ev })
    }
    navigate(location.pathname, { replace: true, state: null })
  }, [openEventId, events, navigate, location.pathname])

  const gridDates = monthGridDates(monthAnchor)
  const gridStart = gridDates[0]
  const gridEnd = gridDates[gridDates.length - 1]

  // date → events touching that day (recurrence + multi-day spans), within grid
  const eventsByDay = new Map<string, CalendarEvent[]>()
  for (const ev of events ?? []) {
    for (const d of eventOccurrenceDays(ev, gridStart, gridEnd)) {
      const list = eventsByDay.get(d)
      if (list) list.push(ev)
      else eventsByDay.set(d, [ev])
    }
  }
  const tasksByDay = new Map<string, Task[]>()
  for (const t of tasks ?? []) {
    if (t.dueDate! >= gridStart && t.dueDate! <= gridEnd) {
      const list = tasksByDay.get(t.dueDate!)
      if (list) list.push(t)
      else tasksByDay.set(t.dueDate!, [t])
    }
  }

  // Combined coloured items for a month cell (events first, then tasks).
  function cellItems(day: string): { color: string; label: string }[] {
    const evs = sortEvents(eventsByDay.get(day) ?? []).map((ev) => ({
      color: eventColor(ev),
      label: ev.title || 'Event',
    }))
    const tks = (tasksByDay.get(day) ?? []).map((t) => ({ color: TASK_COLOR, label: t.title }))
    return [...evs, ...tks]
  }

  const dayEvents = sortEvents(eventsByDay.get(selected) ?? [])
  const dayTasks = (tasks ?? [])
    .filter((t) => t.dueDate === selected)
    .sort((a, b) => a.title.localeCompare(b.title))

  function goMonth(delta: number) {
    const next = addMonths(monthAnchor, delta)
    setMonthAnchor(next)
    setSelected(sameMonth(next, today) ? today : monthStart(next))
  }

  function goToday() {
    setMonthAnchor(monthStart(today))
    setSelected(today)
  }

  // ---- agenda: occurrences from today through the horizon, grouped by day ----
  const agendaEnd = addDays(today, AGENDA_DAYS)
  const agendaMap = new Map<string, { events: CalendarEvent[]; tasks: Task[] }>()
  const ensure = (d: string) => {
    let g = agendaMap.get(d)
    if (!g) {
      g = { events: [], tasks: [] }
      agendaMap.set(d, g)
    }
    return g
  }
  for (const ev of events ?? []) {
    for (const d of eventOccurrenceDays(ev, today, agendaEnd)) ensure(d).events.push(ev)
  }
  for (const t of tasks ?? []) {
    if (t.dueDate! >= today && t.dueDate! <= agendaEnd) ensure(t.dueDate!).tasks.push(t)
  }
  const agendaDays = [...agendaMap.keys()].sort()

  return (
    <>
      <div className="nav-header">
        <Link to="/apps" className="back-link">
          <ChevronLeft aria-hidden /> Apps
        </Link>
      </div>
      <h1 className="screen-title">Calendar</h1>
      <p className="screen-sub">Events and your dated tasks, all in one place.</p>

      <div className="chip-row seg-row">
        <button
          className={`chip${view === 'month' ? ' active' : ''}`}
          onClick={() => setView('month')}
        >
          Month
        </button>
        <button
          className={`chip${view === 'agenda' ? ' active' : ''}`}
          onClick={() => setView('agenda')}
        >
          Agenda
        </button>
      </div>

      <button className="btn secondary" onClick={() => setEditingEvent({ date: selected })}>
        <CalendarPlus aria-hidden /> New event
      </button>

      {view === 'month' && (
        <>
          <div className="week-nav">
            <button className="icon-btn" aria-label="Previous month" onClick={() => goMonth(-1)}>
              <ChevronLeft aria-hidden />
            </button>
            <button className="week-label" onClick={goToday} title="Jump to today">
              {monthLabel(monthAnchor)}
            </button>
            <button className="icon-btn" aria-label="Next month" onClick={() => goMonth(1)}>
              <ChevronRight aria-hidden />
            </button>
          </div>

          <div className="cal-grid cal-weekdays">
            {WEEKDAYS.map((d, i) => (
              <div key={i} className="cal-weekday">
                {d}
              </div>
            ))}
          </div>
          <div className="cal-grid cal-month">
            {gridDates.map((d) => {
              const items = cellItems(d)
              const shown = items.slice(0, 3)
              const extra = items.length - shown.length
              return (
                <button
                  key={d}
                  className={
                    'cal-cell' +
                    (sameMonth(d, monthAnchor) ? '' : ' other-month') +
                    (d === today ? ' today' : '') +
                    (d === selected ? ' selected' : '')
                  }
                  onClick={() => setSelected(d)}
                >
                  <span className="cal-daynum">{parse(d).getDate()}</span>
                  <span className="cal-items">
                    {shown.map((it, i) => (
                      <span
                        key={i}
                        className="cal-item"
                        style={{ '--ic': it.color } as React.CSSProperties}
                      >
                        <span className="cal-item-label">{it.label}</span>
                      </span>
                    ))}
                    {extra > 0 && <span className="cal-more">+{extra}</span>}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="section-label">{dayHeading(selected)}</div>
          {dayEvents.length === 0 && dayTasks.length === 0 ? (
            <div className="card empty-day">
              <p>Nothing scheduled.</p>
              <button className="more-link" onClick={() => setEditingEvent({ date: selected })}>
                <Plus aria-hidden /> Add an event
              </button>
            </div>
          ) : (
            <div className="card day-detail">
              {dayEvents.map((ev) => (
                <EventRow
                  key={ev.id}
                  event={ev}
                  onOpen={() => setEditingEvent({ event: ev })}
                />
              ))}
              {dayTasks.length > 0 && (
                <div className="day-tasks">
                  {dayTasks.map((t) => (
                    <TaskRow key={t.id} task={t} onOpen={setEditingTask} showDue={false} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {view === 'agenda' && (
        <div className="stack" style={{ marginTop: 14 }}>
          {agendaDays.length === 0 && (
            <div className="empty">
              <CalendarRange aria-hidden />
              <div className="empty-title">Nothing coming up</div>
              <p>
                No events or dated tasks in the next {AGENDA_DAYS} days. Tap “New event”
                to add one.
              </p>
            </div>
          )}
          {agendaDays.map((d) => {
            const g = agendaMap.get(d)!
            const evs = sortEvents(g.events)
            const tks = g.tasks.slice().sort((a, b) => a.title.localeCompare(b.title))
            return (
              <div key={d} className="agenda-group">
                <div className="agenda-date">
                  <Clock aria-hidden />
                  {dayHeading(d)}
                </div>
                <div className="card day-detail">
                  {evs.map((ev) => (
                    <EventRow
                      key={ev.id}
                      event={ev}
                      onOpen={() => setEditingEvent({ event: ev })}
                    />
                  ))}
                  {tks.length > 0 && (
                    <div className="day-tasks">
                      {tks.map((t) => (
                        <TaskRow key={t.id} task={t} onOpen={setEditingTask} showDue={false} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editingEvent && (
        <EventSheet
          event={editingEvent.event}
          defaultDate={editingEvent.date}
          onClose={() => setEditingEvent(null)}
        />
      )}
      {editingTask && <TaskSheet task={editingTask} onClose={() => setEditingTask(null)} />}
    </>
  )
}
