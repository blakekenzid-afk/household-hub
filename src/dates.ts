import type { Task } from './db'

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

/** Days from today to dateStr (negative = past) */
function daysFromToday(dateStr: string): number {
  const ms = parse(dateStr).getTime() - parse(todayStr()).getTime()
  return Math.round(ms / 86400000)
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
    case 'monthly': {
      const d = parse(dateStr)
      const day = d.getDate()
      d.setDate(1)
      d.setMonth(d.getMonth() + 1)
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      d.setDate(Math.min(day, lastDay))
      return toStr(d)
    }
    case 'yearly': {
      const d = parse(dateStr)
      d.setFullYear(d.getFullYear() + 1)
      return toStr(d)
    }
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
