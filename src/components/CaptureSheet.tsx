import { useEffect, useRef, useState } from 'react'
import {
  Calendar,
  ChefHat,
  ListChecks,
  NotebookPen,
  Plus,
  ShoppingCart,
  SquareCheckBig,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import Sheet from './Sheet'
import {
  db,
  moveDumpToListItem,
  moveDumpToNote,
  moveDumpToTask,
  type BrainDumpItem,
} from '../db'

interface Props {
  item?: BrainDumpItem
  onClose: () => void
  onMoveToTask?: (taskId: number) => void
  onMoveToNote?: (noteId: number) => void
}

const FUTURE_TARGETS = [
  { icon: ShoppingCart, label: 'Shopping', phase: 'Phase 4', color: '#EA580C' },
  { icon: ChefHat, label: 'Recipe', phase: 'Phase 4', color: '#16A34A' },
  { icon: Calendar, label: 'Event', phase: 'Later', color: '#DC2626' },
]

export default function CaptureSheet({
  item,
  onClose,
  onMoveToTask,
  onMoveToNote,
}: Props) {
  const [text, setText] = useState(item?.text ?? '')
  const [view, setView] = useState<'main' | 'pick-list'>('main')
  const [newListName, setNewListName] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const canTriage = item?.status === 'inbox'

  const checklists = useLiveQuery(
    () => db.notes.where('type').equals('checklist').toArray(),
    [],
  )

  useEffect(() => {
    if (view === 'main') ref.current?.focus()
  }, [view])

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
    if (!item || !text.trim()) return
    const taskId = await moveDumpToTask(item.id, text.trim())
    onClose()
    onMoveToTask?.(taskId)
  }

  async function moveToNote() {
    if (!item || !text.trim()) return
    const noteId = await moveDumpToNote(item.id, text.trim())
    onClose()
    onMoveToNote?.(noteId)
  }

  async function moveToList(checklistId: number) {
    if (!item || !text.trim()) return
    await moveDumpToListItem(item.id, text.trim(), checklistId)
    onClose()
  }

  async function moveToNewList() {
    if (!item || !text.trim()) return
    const name = newListName.trim()
    if (!name) return
    const now = Date.now()
    const checklistId = await db.notes.add({
      type: 'checklist',
      title: name,
      items: [],
      pinned: 0,
      createdAt: now,
      updatedAt: now,
    })
    await moveToList(checklistId)
  }

  if (view === 'pick-list') {
    return (
      <Sheet title="Add to which list?" onClose={() => setView('main')}>
        <div className="stack">
          {checklists?.map((c) => (
            <button
              key={c.id}
              className="card dump-item tappable"
              onClick={() => void moveToList(c.id)}
            >
              <div className="dump-body">
                <div className="tile-name">{c.title || 'Untitled list'}</div>
                <div className="tile-sub">
                  {(c.items ?? []).length === 0
                    ? 'Empty'
                    : `${(c.items ?? []).filter((i) => !i.done).length} open items`}
                </div>
              </div>
            </button>
          ))}
        </div>
        {checklists && checklists.length === 0 && (
          <p className="sheet-hint">No lists yet — start one below.</p>
        )}
        <form
          className="quick-add"
          onSubmit={(e) => {
            e.preventDefault()
            void moveToNewList()
          }}
        >
          <input
            className="quick-add-input"
            placeholder="New list name…"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
          />
          <button
            type="submit"
            className="quick-add-btn"
            disabled={!newListName.trim()}
            aria-label="Create list and add"
          >
            <Plus aria-hidden />
          </button>
        </form>
      </Sheet>
    )
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
            <button
              className="move-btn"
              style={{ '--tile-color': '#D97706' } as React.CSSProperties}
              disabled={!text.trim()}
              onClick={() => void moveToNote()}
            >
              <NotebookPen aria-hidden />
              Note
            </button>
            <button
              className="move-btn"
              style={{ '--tile-color': '#D97706' } as React.CSSProperties}
              disabled={!text.trim()}
              onClick={() => setView('pick-list')}
            >
              <ListChecks aria-hidden />
              List item
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
