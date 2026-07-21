import { useEffect, useRef, useState } from 'react'
import {
  Calendar,
  ChefHat,
  ListChecks,
  NotebookPen,
  ShoppingCart,
  SquareCheckBig,
} from 'lucide-react'
import Sheet from './Sheet'
import { db, moveDumpToTask, type BrainDumpItem } from '../db'

interface Props {
  item?: BrainDumpItem
  onClose: () => void
  onMoveToTask?: (taskId: number) => void
}

const FUTURE_TARGETS = [
  { icon: NotebookPen, label: 'Note', phase: 'Phase 3', color: '#D97706' },
  { icon: ListChecks, label: 'List item', phase: 'Phase 3', color: '#D97706' },
  { icon: ShoppingCart, label: 'Shopping', phase: 'Phase 4', color: '#EA580C' },
  { icon: ChefHat, label: 'Recipe', phase: 'Phase 4', color: '#16A34A' },
  { icon: Calendar, label: 'Event', phase: 'Later', color: '#DC2626' },
]

export default function CaptureSheet({ item, onClose, onMoveToTask }: Props) {
  const [text, setText] = useState(item?.text ?? '')
  const ref = useRef<HTMLTextAreaElement>(null)
  const canTriage = item?.status === 'inbox'

  useEffect(() => {
    ref.current?.focus()
  }, [])

  async function save() {
    const trimmed = text.trim()
    if (!trimmed) return
    if (item) {
      await db.brainDump.update(item.id, { text: trimmed })
    } else {
      await db.brainDump.add({
        text: trimmed,
        createdAt: Date.now(),
        status: 'inbox',
      })
    }
    onClose()
  }

  async function remove() {
    if (!item) return
    await db.brainDump.delete(item.id)
    onClose()
  }

  async function moveToTask() {
    if (!item) return
    const trimmed = text.trim()
    if (!trimmed) return
    const taskId = await moveDumpToTask(item.id, trimmed)
    onClose()
    onMoveToTask?.(taskId)
  }

  return (
    <Sheet title={item ? 'Edit thought' : 'Brain dump'} onClose={onClose}>
      <textarea
        ref={ref}
        className="capture-input"
        placeholder="What's on your mind? Get it out — sort it later."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            void save()
          }
        }}
      />

      {canTriage && (
        <>
          <div className="sheet-label">Move to</div>
          <div className="move-grid">
            <button
              className="move-btn"
              style={{ '--tile-color': '#2563EB' } as React.CSSProperties}
              disabled={!text.trim()}
              onClick={() => void moveToTask()}
            >
              <SquareCheckBig aria-hidden />
              Task
            </button>
            {FUTURE_TARGETS.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.label}
                  className="move-btn"
                  style={{ '--tile-color': t.color } as React.CSSProperties}
                  disabled
                >
                  <Icon aria-hidden />
                  {t.label}
                  <span className="move-phase">{t.phase}</span>
                </button>
              )
            })}
          </div>
        </>
      )}

      <button className="btn" disabled={!text.trim()} onClick={() => void save()}>
        {item ? 'Save' : 'Drop it in the inbox'}
      </button>
      {item && (
        <button className="btn danger-ghost" onClick={() => void remove()}>
          Delete
        </button>
      )}
    </Sheet>
  )
}
