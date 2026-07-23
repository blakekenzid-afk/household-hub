import { useEffect, useRef, useState } from 'react'
import type { CalendarEvent, Task } from '../db'
import { formatTime, hhmmToMinutes, minutesToHHMM, parse } from '../dates'
import { noteColorHex } from '../note-colors'

const SNAP_MIN = 15

const HOUR_H = 44
const DAY_H = 24 * HOUR_H
const TASK_COLOR = '#2563EB'

function eventColor(ev: CalendarEvent): string {
  return noteColorHex(ev.color) ?? '#DC2626'
}

interface Block {
  ev: CalendarEvent
  top: number // minutes from midnight
  height: number // minutes
  leftPct: number
  widthPct: number
}

/** Lay timed events into non-overlapping columns, cluster by cluster. */
function layoutTimed(events: CalendarEvent[]): Block[] {
  const timed = events
    .filter((e) => !e.allDay && e.startTime)
    .map((e) => {
      const s = hhmmToMinutes(e.startTime!)
      const en = e.endTime ? hhmmToMinutes(e.endTime) : s + 60
      return { e, s, en: Math.max(en, s + 20) }
    })
    .sort((a, b) => a.s - b.s || a.en - b.en)

  const out: Block[] = []
  let cluster: typeof timed = []
  let clusterEnd = -1
  const flush = () => {
    const colEnds: number[] = []
    const placed = cluster.map((it) => {
      let c = colEnds.findIndex((end) => end <= it.s)
      if (c === -1) {
        c = colEnds.length
        colEnds.push(it.en)
      } else colEnds[c] = it.en
      return { it, col: c }
    })
    const n = colEnds.length || 1
    for (const { it, col } of placed) {
      out.push({
        ev: it.e,
        top: it.s,
        height: it.en - it.s,
        leftPct: (col / n) * 100,
        widthPct: (1 / n) * 100,
      })
    }
    cluster = []
    clusterEnd = -1
  }
  for (const it of timed) {
    if (cluster.length && it.s >= clusterEnd) flush()
    cluster.push(it)
    clusterEnd = Math.max(clusterEnd, it.en)
  }
  if (cluster.length) flush()
  return out
}

interface Props {
  days: string[]
  today: string
  selected: string
  eventsByDay: Map<string, CalendarEvent[]>
  tasksByDay: Map<string, Task[]>
  onSelectDay: (day: string) => void
  onEventOpen: (ev: CalendarEvent) => void
  onTaskOpen: (task: Task) => void
  onSlotAdd: (day: string) => void
  onReschedule: (ev: CalendarEvent, day: string, startTime: string) => void
}

export default function CalendarTimeGrid({
  days,
  today,
  selected,
  eventsByDay,
  tasksByDay,
  onSelectDay,
  onEventOpen,
  onTaskOpen,
  onSlotAdd,
  onReschedule,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{
    id: number
    dx: number
    dy: number
  } | null>(null)
  const dragInfo = useRef<{ ev: CalendarEvent; day: string; startMin: number; dur: number } | null>(
    null,
  )
  const startPt = useRef<{ x: number; y: number } | null>(null)
  const movedRef = useRef(false)

  // Open scrolled to ~7am rather than midnight.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_H - 8
  }, [])

  const single = days.length === 1
  const hours = Array.from({ length: 24 }, (_, h) => h)

  return (
    <div className={`tg${single ? ' tg-day' : ''}`}>
      <div className="tg-head">
        <div className="tg-corner" />
        {days.map((d) => {
          const dt = parse(d)
          return (
            <button
              key={d}
              className={`tg-dayhead${d === today ? ' today' : ''}${d === selected ? ' selected' : ''}`}
              onClick={() => onSelectDay(d)}
            >
              <span className="tg-dow">{dt.toLocaleDateString(undefined, { weekday: 'short' })}</span>
              <span className="tg-dnum">{dt.getDate()}</span>
            </button>
          )
        })}
      </div>

      <div className="tg-allday">
        <div className="tg-corner tg-allday-label">all-day</div>
        {days.map((d) => {
          const allDay = (eventsByDay.get(d) ?? []).filter((e) => e.allDay)
          const tks = tasksByDay.get(d) ?? []
          return (
            <div key={d} className="tg-allday-col">
              {allDay.map((ev) => (
                <button
                  key={ev.id}
                  className="tg-chip"
                  style={{ '--ic': eventColor(ev) } as React.CSSProperties}
                  onClick={() => onEventOpen(ev)}
                >
                  {ev.title || 'Event'}
                </button>
              ))}
              {tks.map((t) => (
                <button
                  key={`t${t.id}`}
                  className="tg-chip"
                  style={{ '--ic': TASK_COLOR } as React.CSSProperties}
                  onClick={() => onTaskOpen(t)}
                >
                  {t.title}
                </button>
              ))}
            </div>
          )
        })}
      </div>

      <div className="tg-scroll" ref={scrollRef}>
        <div className="tg-grid" style={{ height: DAY_H }}>
          <div className="tg-gutter">
            {hours.map((h) => (
              <div key={h} className="tg-hour" style={{ height: HOUR_H }}>
                <span>{h === 0 ? '' : `${((h + 11) % 12) + 1} ${h < 12 ? 'AM' : 'PM'}`}</span>
              </div>
            ))}
          </div>
          {days.map((d) => {
            const blocks = layoutTimed(eventsByDay.get(d) ?? [])
            return (
              <div
                key={d}
                className="tg-col"
                data-day={d}
                onClick={(e) => {
                  if (e.target === e.currentTarget) onSlotAdd(d)
                }}
              >
                {blocks.map((b, i) => {
                  const isDragging = drag?.id === b.ev.id
                  const draggable = b.ev.repeat === 'none'
                  return (
                    <button
                      key={i}
                      className={`tg-event${draggable ? ' draggable' : ''}`}
                      style={
                        {
                          top: (b.top / 60) * HOUR_H,
                          height: Math.max((b.height / 60) * HOUR_H - 2, 18),
                          left: `${b.leftPct}%`,
                          width: `calc(${b.widthPct}% - 2px)`,
                          '--ic': eventColor(b.ev),
                          transform: isDragging
                            ? `translate(${drag!.dx}px, ${drag!.dy}px)`
                            : undefined,
                          zIndex: isDragging ? 5 : undefined,
                          opacity: isDragging ? 0.9 : undefined,
                        } as React.CSSProperties
                      }
                      onPointerDown={(e) => {
                        if (!draggable) return
                        e.currentTarget.setPointerCapture(e.pointerId)
                        startPt.current = { x: e.clientX, y: e.clientY }
                        movedRef.current = false
                        dragInfo.current = { ev: b.ev, day: d, startMin: b.top, dur: b.height }
                        setDrag({ id: b.ev.id, dx: 0, dy: 0 })
                      }}
                      onPointerMove={(e) => {
                        if (!startPt.current || !dragInfo.current) return
                        const dx = e.clientX - startPt.current.x
                        const dy = e.clientY - startPt.current.y
                        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) movedRef.current = true
                        setDrag({ id: b.ev.id, dx, dy })
                      }}
                      onPointerUp={(e) => {
                        const st = startPt.current
                        const info = dragInfo.current
                        startPt.current = null
                        dragInfo.current = null
                        setDrag(null)
                        if (!st || !info || !movedRef.current) return
                        const dy = e.clientY - st.y
                        const minsDelta = Math.round(((dy / HOUR_H) * 60) / SNAP_MIN) * SNAP_MIN
                        const newStart = Math.max(
                          0,
                          Math.min(1440 - info.dur, info.startMin + minsDelta),
                        )
                        let targetDay = info.day
                        if (days.length > 1) {
                          const el = e.currentTarget as HTMLElement
                          const prev = el.style.pointerEvents
                          el.style.pointerEvents = 'none'
                          const under = document.elementFromPoint(e.clientX, e.clientY)
                          el.style.pointerEvents = prev
                          const col = under?.closest('[data-day]') as HTMLElement | null
                          if (col?.dataset.day) targetDay = col.dataset.day
                        }
                        onReschedule(info.ev, targetDay, minutesToHHMM(newStart))
                      }}
                      onClick={() => {
                        if (movedRef.current) {
                          movedRef.current = false
                          return
                        }
                        onEventOpen(b.ev)
                      }}
                    >
                      <span className="tg-event-title">{b.ev.title || 'Event'}</span>
                      <span className="tg-event-time">{formatTime(b.ev.startTime!)}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
