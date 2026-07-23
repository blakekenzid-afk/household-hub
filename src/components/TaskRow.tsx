import { Bell, Check, ChevronsRight, Flag, ListChecks, Repeat } from 'lucide-react'
import { bumpTaskToNextDay, toggleTask, type Task } from '../db'
import { dueLabel, formatTime } from '../dates'

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
        {(due ||
          task.priority !== 'none' ||
          task.repeat !== 'none' ||
          task.reminderLead != null ||
          (task.subtasks && task.subtasks.length > 0) ||
          task.notes) && (
          <div className="task-meta">
            {due && !done && (
              <span className={`due ${due.tone}`}>
                {due.text}
                {task.dueTime ? ` · ${formatTime(task.dueTime)}` : ''}
              </span>
            )}
            {task.subtasks && task.subtasks.length > 0 && (
              <span className="subtask-count">
                <ListChecks aria-hidden />
                {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
              </span>
            )}
            {task.reminderLead != null && !done && <Bell aria-label="Reminder set" />}
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
      {!done && task.dueDate && (
        <button
          className="task-bump"
          aria-label="Move to next day"
          title="Move to next day"
          onClick={() => void bumpTaskToNextDay(task)}
        >
          <ChevronsRight aria-hidden />
        </button>
      )}
    </div>
  )
}
