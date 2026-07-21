import { Check, Flag, Repeat } from 'lucide-react'
import { toggleTask, type Task } from '../db'
import { dueLabel } from '../dates'

const PRIORITY_COLORS: Record<string, string> = {
  low: '#2563EB',
  medium: '#F59E0B',
  high: '#E5484D',
}

interface Props {
  task: Task
  onOpen?: (task: Task) => void
  showDue?: boolean
}

export default function TaskRow({ task, onOpen, showDue = true }: Props) {
  const done = task.status === 'done'
  const due = showDue && task.dueDate ? dueLabel(task.dueDate) : null

  return (
    <div className="task-row">
      <button
        className={`check${done ? ' done' : ''}`}
        onClick={() => void toggleTask(task)}
        aria-label={done ? 'Mark not done' : 'Mark done'}
      >
        <Check aria-hidden />
      </button>
      <div
        className="task-body"
        role={onOpen ? 'button' : undefined}
        tabIndex={onOpen ? 0 : undefined}
        onClick={() => onOpen?.(task)}
        onKeyDown={(e) => e.key === 'Enter' && onOpen?.(task)}
      >
        <div className={`task-title${done ? ' done' : ''}`}>{task.title}</div>
        {(due || task.priority !== 'none' || task.repeat !== 'none' || task.notes) && (
          <div className="task-meta">
            {due && !done && <span className={`due ${due.tone}`}>{due.text}</span>}
            {task.priority !== 'none' && (
              <Flag
                aria-label={`${task.priority} priority`}
                style={{ color: PRIORITY_COLORS[task.priority] }}
                fill="currentColor"
              />
            )}
            {task.repeat !== 'none' && <Repeat aria-label="Repeats" />}
            {task.notes && <span className="task-note-hint">{task.notes}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
