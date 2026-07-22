import { useState } from 'react'
import Sheet from './Sheet'
import { db, type CalendarEvent } from '../db'
import { addDays, todayStr } from '../dates'

interface Props {
  event?: CalendarEvent
  /** Pre-fill the date for a brand-new event (e.g. the day tapped in the grid). */
  defaultDate?: string
  onClose: () => void
}

const REPEATS: CalendarEvent['repeat'][] = ['none', 'daily', 'weekly', 'monthly', 'yearly']

const REPEAT_LABELS: Record<CalendarEvent['repeat'], string> = {
  none: 'Never',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
}

export default function EventSheet({ event, defaultDate, onClose }: Props) {
  const [title, setTitle] = useState(event?.title ?? '')
  const [date, setDate] = useState(event?.date ?? defaultDate ?? todayStr())
  const [allDay, setAllDay] = useState(event?.allDay ?? true)
  const [startTime, setStartTime] = useState(event?.startTime ?? '09:00')
  const [endTime, setEndTime] = useState(event?.endTime ?? '')
  const [location, setLocation] = useState(event?.location ?? '')
  const [notes, setNotes] = useState(event?.notes ?? '')
  const [repeat, setRepeat] = useState<CalendarEvent['repeat']>(event?.repeat ?? 'none')

  const today = todayStr()
  const tomorrow = addDays(today, 1)
  const isQuickDate = date === today || date === tomorrow

  async function save() {
    const trimmed = title.trim()
    if (!trimmed) return
    const fields = {
      title: trimmed,
      date,
      allDay,
      startTime: allDay ? undefined : startTime,
      endTime: allDay || !endTime ? undefined : endTime,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
      repeat,
    }
    if (event) {
      await db.events.update(event.id, fields)
    } else {
      await db.events.add({ ...fields, createdAt: Date.now() })
    }
    onClose()
  }

  async function remove() {
    if (!event) return
    await db.events.delete(event.id)
    onClose()
  }

  return (
    <Sheet title={event ? 'Edit event' : 'New event'} onClose={onClose}>
      <input
        className="sheet-input"
        placeholder="What's happening?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <div className="sheet-label">Day</div>
      <div className="chip-row">
        <button
          className={`chip${date === today ? ' active' : ''}`}
          onClick={() => setDate(today)}
        >
          Today
        </button>
        <button
          className={`chip${date === tomorrow ? ' active' : ''}`}
          onClick={() => setDate(tomorrow)}
        >
          Tomorrow
        </button>
        <input
          type="date"
          className={`chip date-chip${!isQuickDate ? ' active' : ''}`}
          value={date}
          onChange={(e) => setDate(e.target.value || today)}
          aria-label="Event date"
        />
      </div>

      <div className="sheet-label">Time</div>
      <div className="chip-row">
        <button
          className={`chip${allDay ? ' active' : ''}`}
          onClick={() => setAllDay(true)}
        >
          All day
        </button>
        <button
          className={`chip${!allDay ? ' active' : ''}`}
          onClick={() => setAllDay(false)}
        >
          At a time
        </button>
      </div>
      {!allDay && (
        <div className="time-row">
          <label className="time-field">
            <span>Starts</span>
            <input
              type="time"
              className="sheet-input time-input"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value || '09:00')}
            />
          </label>
          <label className="time-field">
            <span>Ends</span>
            <input
              type="time"
              className="sheet-input time-input"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              aria-label="End time (optional)"
            />
          </label>
        </div>
      )}

      <div className="sheet-label">Repeat</div>
      <div className="chip-row">
        {REPEATS.map((r) => (
          <button
            key={r}
            className={`chip${repeat === r ? ' active' : ''}`}
            onClick={() => setRepeat(r)}
          >
            {REPEAT_LABELS[r]}
          </button>
        ))}
      </div>

      <div className="sheet-label">Location</div>
      <input
        className="sheet-input"
        placeholder="Where? (optional)"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />

      <div className="sheet-label">Notes</div>
      <textarea
        className="capture-input small"
        placeholder="Anything extra…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <button className="btn" disabled={!title.trim()} onClick={() => void save()}>
        {event ? 'Save' : 'Add event'}
      </button>
      {event && (
        <button className="btn danger-ghost" onClick={() => void remove()}>
          Delete
        </button>
      )}
    </Sheet>
  )
}
