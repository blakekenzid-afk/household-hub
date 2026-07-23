import type { CalendarEvent, Task } from './db'

/** Local date as YYYY-MM-DD */
export function todayStr(): string {
  return toStr(new Date())
}

export function toStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parse(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(dateStr: string, n: number): string {
  const d = parse(dateStr)
  d.setDate(d.getDate() + n)
  return toStr(d)
}

/** Add n months, clamping the day to the target month's length (Jan 31 → Feb 28). */
export function addMonths(dateStr: string, n: number): string {
  const d = parse(dateStr)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  return toStr(d)
}

export function addYears(dateStr: string, n: number): string {
  const d = parse(dateStr)
  d.setFullYear(d.getFullYear() + n)
  return toStr(d)
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000)
}

/** Days from today to dateStr (negative = past) */
function daysFromToday(dateStr: string): number {
  return daysBetween(todayStr(), dateStr)
}

export interface DueLabel {
  text: string
  tone: 'overdue' | 'today' | 'soon' | 'future'
}

export function dueLabel(dateStr: string): DueLabel {
  const diff = daysFromToday(dateStr)
  if (diff < 0) {
    return {
      text: diff === -1 ? 'Yesterday' : `${-diff} days overdue`,
      tone: 'overdue',
    }
  }
  if (diff === 0) return { text: 'Today', tone: 'today' }
  if (diff === 1) return { text: 'Tomorrow', tone: 'soon' }
  const d = parse(dateStr)
  if (diff < 7) {
    return { text: d.toLocaleDateString(undefined, { weekday: 'long' }), tone: 'future' }
  }
  return {
    text: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    tone: 'future',
  }
}

/** Sunday of the current week, shifted by offsetWeeks */
export function weekStart(offsetWeeks = 0): string {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay() + offsetWeeks * 7)
  return toStr(d)
}

/** The 7 dates of the week beginning at startStr */
export function weekDates(startStr: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startStr, i))
}

/** First day of the month containing dateStr. */
export function monthStart(dateStr: string): string {
  const d = parse(dateStr)
  d.setDate(1)
  return toStr(d)
}

/** The 42 dates (6 weeks, Sun-start) of the calendar grid for a month. */
export function monthGridDates(anchorInMonth: string): string[] {
  const first = monthStart(anchorInMonth)
  const gridStart = addDays(first, -parse(first).getDay())
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
}

export function monthLabel(anchorInMonth: string): string {
  return parse(anchorInMonth).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

/** Same calendar month (and year) — compares the YYYY-MM prefix. */
export function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7)
}

/** A friendly day heading, e.g. "Today", "Tomorrow", or "Mon, Aug 3". */
export function dayHeading(dateStr: string): string {
  const diff = daysBetween(todayStr(), dateStr)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return parse(dateStr).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** 24h "HH:MM" → minutes since midnight. */
export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Minutes since midnight → "HH:MM" (wraps into 0–1439). */
export function minutesToHHMM(mins: number): string {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** 24h "HH:MM" → locale-formatted time, e.g. "9:00 AM". */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function weekLabel(startStr: string): string {
  const start = parse(startStr)
  const end = parse(addDays(startStr, 6))
  const startLabel = start.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
  const endLabel =
    start.getMonth() === end.getMonth()
      ? end.toLocaleDateString(undefined, { day: 'numeric' })
      : end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${startLabel} – ${endLabel}`
}

function nextOnce(dateStr: string, repeat: Task['repeat']): string {
  switch (repeat) {
    case 'daily':
      return addDays(dateStr, 1)
    case 'weekdays': {
      let next = addDays(dateStr, 1)
      while ([0, 6].includes(parse(next).getDay())) next = addDays(next, 1)
      return next
    }
    case 'weekly':
      return addDays(dateStr, 7)
    case 'monthly':
      return addMonths(dateStr, 1)
    case 'yearly':
      return addYears(dateStr, 1)
    default:
      return dateStr
  }
}

/** Next occurrence after completing a repeating task — always lands after today */
export function nextOccurrence(dateStr: string, repeat: Task['repeat']): string {
  const today = todayStr()
  let next = nextOnce(dateStr, repeat)
  let guard = 0
  while (next <= today && guard < 1000) {
    next = nextOnce(next, repeat)
    guard++
  }
  return next
}

function stepEvent(dateStr: string, repeat: CalendarEvent['repeat']): string {
  switch (repeat) {
    case 'daily':
      return addDays(dateStr, 1)
    case 'weekly':
      return addDays(dateStr, 7)
    case 'monthly':
      return addMonths(dateStr, 1)
    case 'yearly':
      return addYears(dateStr, 1)
    default:
      return dateStr
  }
}

/**
 * Every date on which `event` occurs within [rangeStart, rangeEnd] (inclusive).
 * A recurring event is stored once and expanded on demand — daily/weekly
 * fast-forward to the window; monthly/yearly step (small counts) so the
 * day-of-month clamp stays exact.
 */
export function eventDatesInRange(
  event: Pick<CalendarEvent, 'date' | 'repeat'>,
  rangeStart: string,
  rangeEnd: string,
): string[] {
  const { date, repeat } = event
  if (repeat === 'none') {
    return date >= rangeStart && date <= rangeEnd ? [date] : []
  }
  let cur = date
  // Cheap arithmetic fast-forward for fixed-length steps.
  if (cur < rangeStart && (repeat === 'daily' || repeat === 'weekly')) {
    const step = repeat === 'daily' ? 1 : 7
    const gap = daysBetween(cur, rangeStart)
    cur = addDays(cur, Math.floor(gap / step) * step)
  }
  const out: string[] = []
  let guard = 0
  while (cur <= rangeEnd && guard < 500) {
    if (cur >= rangeStart) out.push(cur)
    cur = stepEvent(cur, repeat)
    guard++
  }
  return out
}

/**
 * Every calendar day an event touches within [rangeStart, rangeEnd] —
 * expanding recurrence and spreading each occurrence across its multi-day
 * span (endDate). Used to place an event on every cell it covers.
 */
export function eventOccurrenceDays(
  event: Pick<CalendarEvent, 'date' | 'endDate' | 'repeat'>,
  rangeStart: string,
  rangeEnd: string,
): string[] {
  const span =
    event.endDate && event.endDate > event.date
      ? Math.max(0, daysBetween(event.date, event.endDate))
      : 0
  // An occurrence starting up to `span` days before the window can still
  // reach into it, so widen the start we scan from.
  const starts = eventDatesInRange(event, addDays(rangeStart, -span), rangeEnd)
  const days = new Set<string>()
  for (const start of starts) {
    for (let i = 0; i <= span; i++) {
      const d = addDays(start, i)
      if (d >= rangeStart && d <= rangeEnd) days.add(d)
    }
  }
  return [...days]
}
