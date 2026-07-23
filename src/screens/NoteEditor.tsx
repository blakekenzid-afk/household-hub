import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronLeft, Folder, Palette, Pin, Trash2, X } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type ChecklistItem, type NoteColor } from '../db'
import { NOTE_COLORS, noteColorHex } from '../note-colors'
import Sheet from '../components/Sheet'

export default function NoteEditor() {
  const navigate = useNavigate()
  const { noteId } = useParams()
  const id = Number(noteId)

  const fetched = useLiveQuery(
    async () => ({ note: await db.notes.get(id) }),
    [id],
  )
  const note = fetched?.note
  const folders = useLiveQuery(() => db.folders.orderBy('name').toArray(), [])

  const [loaded, setLoaded] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [pinned, setPinned] = useState<0 | 1>(0)
  const [folderId, setFolderId] = useState<number | undefined>(undefined)
  const [color, setColor] = useState<NoteColor | undefined>(undefined)
  const [newItem, setNewItem] = useState('')
  const [folderPickerOpen, setFolderPickerOpen] = useState(false)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)

  useEffect(() => {
    if (note && !loaded) {
      setTitle(note.title)
      setBody(note.body ?? '')
      setItems(note.items ?? [])
      setPinned(note.pinned)
      setFolderId(note.folderId)
      setColor(note.color)
      setLoaded(true)
    }
  }, [note, loaded])

  // Debounced auto-save, only when content actually differs from the stored note
  useEffect(() => {
    if (!loaded || !note) return
    const changed =
      title !== note.title ||
      (note.type === 'note' && body !== (note.body ?? '')) ||
      (note.type === 'checklist' &&
        JSON.stringify(items) !== JSON.stringify(note.items ?? []))
    if (!changed) return
    const t = window.setTimeout(() => {
      void db.notes.update(id, {
        title,
        body: note.type === 'note' ? body : undefined,
        items: note.type === 'checklist' ? items : undefined,
        updatedAt: Date.now(),
      })
    }, 250)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, items, note, loaded])

  async function goBack() {
    // Discard notes that were never given any content
    const empty =
      !title.trim() &&
      (note?.type === 'note' ? !body.trim() : items.length === 0)
    if (empty) await db.notes.delete(id)
    navigate('/apps/notes')
  }

  async function togglePin() {
    const next = pinned === 1 ? 0 : 1
    setPinned(next)
    await db.notes.update(id, { pinned: next })
  }

  async function pickFolder(fid: number | undefined) {
    setFolderId(fid)
    setFolderPickerOpen(false)
    await db.notes.update(id, { folderId: fid })
  }

  async function pickColor(c: NoteColor | undefined) {
    setColor(c)
    setColorPickerOpen(false)
    await db.notes.update(id, { color: c })
  }

  async function remove() {
    if (!window.confirm('Delete this note?')) return
    await db.notes.delete(id)
    navigate('/apps/notes')
  }

  function toggleItem(itemId: string) {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)),
    )
  }

  function editItem(itemId: string, text: string) {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, text } : i)))
  }

  function removeItem(itemId: string) {
    setItems((prev) => prev.filter((i) => i.id !== itemId))
  }

  function addItem() {
    const text = newItem.trim()
    if (!text) return
    setItems((prev) => [...prev, { id: crypto.randomUUID(), text, done: false }])
    setNewItem('')
  }

  if (fetched === undefined) return null
  if (!note && !loaded) {
    return (
      <div className="empty">
        <p>This note doesn’t exist anymore.</p>
      </div>
    )
  }

  const folderName = folders?.find((f) => f.id === folderId)?.name

  return (
    <>
      <div className="nav-header editor-header">
        <button className="back-link as-button" onClick={() => void goBack()}>
          <ChevronLeft aria-hidden /> Notes
        </button>
        <div className="editor-actions">
          <button
            className={`icon-btn${pinned === 1 ? ' accent' : ''}`}
            aria-label={pinned === 1 ? 'Unpin' : 'Pin'}
            onClick={() => void togglePin()}
          >
            <Pin aria-hidden />
          </button>
          <button
            className="icon-btn"
            aria-label="Note color"
            onClick={() => setColorPickerOpen(true)}
            style={color ? { color: noteColorHex(color) } : undefined}
          >
            <Palette aria-hidden />
          </button>
          <button
            className="icon-btn"
            aria-label="Choose folder"
            onClick={() => setFolderPickerOpen(true)}
          >
            <Folder aria-hidden />
          </button>
          <button className="icon-btn" aria-label="Delete note" onClick={() => void remove()}>
            <Trash2 aria-hidden />
          </button>
        </div>
      </div>

      {folderName && <div className="editor-folder-tag">{folderName}</div>}

      <input
        className="editor-title"
        placeholder={note?.type === 'checklist' ? 'List title' : 'Title'}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      {note?.type === 'note' && (
        <textarea
          className="editor-body"
          placeholder="Start writing…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      )}

      {note?.type === 'checklist' && (
        <div className="cl-list">
          {items.map((i) => (
            <div key={i.id} className="cl-item">
              <button
                className={`check${i.done ? ' done' : ''}`}
                onClick={() => toggleItem(i.id)}
                aria-label={i.done ? 'Uncheck' : 'Check'}
              >
                <Check aria-hidden />
              </button>
              <input
                className={`cl-text${i.done ? ' done' : ''}`}
                value={i.text}
                onChange={(e) => editItem(i.id, e.target.value)}
              />
              <button
                className="icon-btn subtle"
                aria-label="Remove item"
                onClick={() => removeItem(i.id)}
              >
                <X aria-hidden />
              </button>
            </div>
          ))}
          <form
            className="cl-add"
            onSubmit={(e) => {
              e.preventDefault()
              addItem()
            }}
          >
            <span className="cl-add-ring" aria-hidden />
            <input
              className="cl-text"
              placeholder="Add item…"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
            />
          </form>
          {items.some((i) => i.done) && (
            <button
              className="more-link"
              onClick={() => setItems((prev) => prev.filter((i) => !i.done))}
            >
              Clear checked items
            </button>
          )}
        </div>
      )}

      {colorPickerOpen && (
        <Sheet title="Color" onClose={() => setColorPickerOpen(false)}>
          <div className="color-row">
            <button
              className={`color-swatch none${!color ? ' active' : ''}`}
              aria-label="No color"
              onClick={() => void pickColor(undefined)}
            />
            {NOTE_COLORS.map((c) => (
              <button
                key={c}
                className={`color-swatch${color === c ? ' active' : ''}`}
                style={{ '--sw': noteColorHex(c) } as React.CSSProperties}
                aria-label={c}
                onClick={() => void pickColor(c)}
              />
            ))}
          </div>
        </Sheet>
      )}

      {folderPickerOpen && (
        <Sheet title="Folder" onClose={() => setFolderPickerOpen(false)}>
          <div className="chip-row">
            <button
              className={`chip${folderId === undefined ? ' active' : ''}`}
              onClick={() => void pickFolder(undefined)}
            >
              None
            </button>
            {folders?.map((f) => (
              <button
                key={f.id}
                className={`chip${folderId === f.id ? ' active' : ''}`}
                onClick={() => void pickFolder(f.id)}
              >
                {f.name}
              </button>
            ))}
          </div>
          {(folders?.length ?? 0) === 0 && (
            <p className="sheet-hint">
              No folders yet — create one from the Notes screen.
            </p>
          )}
        </Sheet>
      )}
    </>
  )
}
