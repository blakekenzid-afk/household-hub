import { useState } from 'react'
import Sheet from './Sheet'
import { db, type Task } from '../db'
import { addDays, todayStr } from '../dates'

interface Props {
  task?: Task
  onClose: () => void
}

const REPEATS: Task['repeat'][] = ['none', 'daily', 'weekdays', 'weekly', 'monthly', 'yearly']
const PRIORITIES: Task['priority'][] = ['none', 'low', 'medium', 'high']

const REPEAT_LABELS: Record<Task['repeat'], string> = {
  none: 'Never',
  daily: 'Daily',
  weekdays: 'Weekdays',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
}

const PRIORITY_LABELS: Record<Task['priority'], string> = {
  none: 'None',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

export default function TaskSheet({ task, onClose }: Props) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [dueDate, setDueDate] = useState<string | undefined>(task?.dueDate)
  const [priority, setPriority] = useState<Task['priority']>(task?.priority ?? 'none')
  const [repeat, setRepeat] = useState<Task['repeat']>(task?.repeat ?? 'none')

  const today = todayStr()
  const tomorrow = addDays(today, 1)
  const nextWeek = addDays(today, 7)
  const isQuickDue =
    dueDate === undefined || dueDate === today || dueDate === tomorrow || dueDate === nextWeek

  async function save() {
    const trimmed = title.trim()
    if (!trimmed) return
    const fields = {
      title: trimmed,
      notes: notes.trim() || undefined,
      dueDate,
      priority,
      repeat: dueDate ? repeat : ('none' as const),
    }
    if (task) {
      await db.tasks.update(task.id, fields)
    } else {
      await db.tasks.add({ ...fields, status: 'open', createdAt: Date.now() })
    }
    onClose()
  }

  async function remove() {
    if (!task) return
    await db.tasks.delete(task.id)
    onClose()
  }

  return (
    <Sheet title={task ? 'Edit task' : 'New task'} onClose={onClose}>
      <input
        className="sheet-input"
        placeholder="What needs doing?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <div className="sheet-label">Due</div>
      <div className="chip-row">
        <button
          className={`chip${dueDate === undefined ? ' active' : ''}`}
          onClick={() => setDueDate(undefined)}
        >
          None
        </button>
        <button
          className={`chip${dueDate === today ? ' active' : ''}`}
          onClick={() => setDueDate(today)}
        >
          Today
        </button>
        <button
          className={`chip${dueDate === tomorrow ? ' active' : ''}`}
          onClick={() => setDueDate(tomorrow)}
        >
          Tomorrow
        </button>
        <button
          className={`chip${dueDate === nextWeek ? ' active' : ''}`}
          onClick={() => setDueDate(nextWeek)}
        >
          Next week
        </button>
        <input
          type="date"
          className={`chip date-chip${!isQuickDue ? ' active' : ''}`}
          value={!isQuickDue ? dueDate : ''}
          onChange={(e) => setDueDate(e.target.value || undefined)}
          aria-label="Custom due date"
        />
      </div>

      <div className="sheet-label">Repeat</div>
      <div className="chip-row">
        {REPEATS.map((r) => (
          <button
            key={r}
            className={`chip${repeat === r ? ' active' : ''}`}
            disabled={!dueDate && r !== 'none'}
            onClick={() => setRepeat(r)}
          >
            {REPEAT_LABELS[r]}
          </button>
        ))}
      </div>
      {!dueDate && <p className="sheet-hint">Set a due date to make a task repeat.</p>}

      <div className="sheet-label">Priority</div>
      <div className="chip-row">
        {PRIORITIES.map((p) => (
          <button
            key={p}
            className={`chip${priority === p ? ' active' : ''}`}
            onClick={() => setPriority(p)}
          >
            {PRIORITY_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="sheet-label">Notes</div>
      <textarea
        className="capture-input small"
        placeholder="Anything extra…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <button className="btn" disabled={!title.trim()} onClick={() => void save()}>
        {task ? 'Save' : 'Add task'}
      </button>
      {task && (
        <button className="btn danger-ghost" onClick={() => void remove()}>
          Delete
        </button>
      )}
    </Sheet>
  )
}
