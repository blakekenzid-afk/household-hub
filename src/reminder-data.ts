import type { ReminderLead } from './db'

/** The lead-time options offered in the sheets. 'off' means no reminder. */
export const REMINDER_OPTIONS: ('off' | ReminderLead)[] = ['off', 0, 10, 30, 60]

export function reminderLabel(value: 'off' | ReminderLead): string {
  switch (value) {
    case 'off':
      return 'Off'
    case 0:
      return 'At time'
    case 60:
      return '1 hr before'
    default:
      return `${value} min before`
  }
}

/** Short label for lists, e.g. a bell chip on a task row. */
export function reminderShort(value: ReminderLead): string {
  return value === 0 ? 'At time' : value === 60 ? '1 hr' : `${value} min`
}
