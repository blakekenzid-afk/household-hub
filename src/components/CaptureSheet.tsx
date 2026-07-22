import { useEffect, useRef, useState } from 'react'
import {
  Calendar,
  ChefHat,
  ListChecks,
  NotebookPen,
  Plus,
  Scissors,
  ShoppingCart,
  SquareCheckBig,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import Sheet from './Sheet'
import {
  db,
  moveDumpToEvent,
  moveDumpToListItem,
  moveDumpToNote,
  moveDumpToRecipe,
  moveDumpToShopping,
  moveDumpToTask,
  type BrainDumpItem,
} from '../db'

interface Props {
  item?: BrainDumpItem
  onClose: () => void
  onMoveToTask?: (taskId: number) => void
  onMoveToNote?: (noteId: number) => void
  onMoveToRecipe?: (recipeId: number) => void
  onMoveToEvent?: (eventId: number) => void
}

export default function CaptureSheet({
  item,
  onClose,
  onMoveToTask,
  onMoveToNote,
  onMoveToRecipe,
  onMoveToEvent,
}: Props) {
  const [text, setText] = useState(item?.text ?? '')
  const [view, setView] = useState<'main' | 'pick-list'>('main')
  const [newListName, setNewListName] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const canTriage = item?.status === 'inbox'
  // Non-empty lines — a pasted list can become one inbox item per line.
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

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

  // Drop each line into the inbox as its own thought. When editing an
  // existing item, the original is replaced by the split-out lines.
  async function splitToInbox() {
    if (lines.length < 2) return
    const now = Date.now()
    await db.transaction('rw', db.brainDump, async () => {
      if (item) await db.brainDump.delete(item.id)
      await db.brainDump.bulkAdd(
        lines.map((line, i) => ({
          text: line,
          // First line newest so the inbox reads top-to-bottom in list order.
          createdAt: now + (lines.length - 1 - i),
          status: 'inbox' as const,
        })),
      )
    })
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

  async function moveToShopping() {
    if (!item || !text.trim()) return
    await moveDumpToShopping(item.id, text.trim())
    onClose()
  }

  async function moveToRecipe() {
    if (!item || !text.trim()) return
    const recipeId = await moveDumpToRecipe(item.id, text.trim())
    onClose()
    onMoveToRecipe?.(recipeId)
  }

  async function moveToEvent() {
    if (!item || !text.trim()) return
    const eventId = await moveDumpToEvent(item.id, text.trim())
    onClose()
    onMoveToEvent?.(eventId)
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
            <button
              className="move-btn"
              style={{ '--tile-color': '#EA580C' } as React.CSSProperties}
              disabled={!text.trim()}
              onClick={() => void moveToShopping()}
            >
              <ShoppingCart aria-hidden />
              Shopping
            </button>
            <button
              className="move-btn"
              style={{ '--tile-color': '#16A34A' } as React.CSSProperties}
              disabled={!text.trim()}
              onClick={() => void moveToRecipe()}
            >
              <ChefHat aria-hidden />
              Recipe
            </button>
            <button
              className="move-btn"
              style={{ '--tile-color': '#DC2626' } as React.CSSProperties}
              disabled={!text.trim()}
              onClick={() => void moveToEvent()}
            >
              <Calendar aria-hidden />
              Event
            </button>
          </div>
        </>
      )}

      {lines.length >= 2 && (
        <button className="btn secondary" onClick={() => void splitToInbox()}>
          <Scissors aria-hidden /> Split into {lines.length} separate thoughts
        </button>
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
