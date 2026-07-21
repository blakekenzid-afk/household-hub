import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ListChecks,
  MoreHorizontal,
  NotebookPen,
  Pin,
  Search,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Note } from '../db'
import { relativeTime } from '../time'
import Sheet from '../components/Sheet'

export default function Notes() {
  const navigate = useNavigate()
  const [folderId, setFolderId] = useState<number | 'all'>('all')
  const [search, setSearch] = useState('')
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [folderOptionsOpen, setFolderOptionsOpen] = useState(false)
  const [folderName, setFolderName] = useState('')

  const folders = useLiveQuery(() => db.folders.orderBy('name').toArray(), [])
  const notes = useLiveQuery(() => db.notes.toArray(), [])

  const activeFolder =
    folderId !== 'all' ? folders?.find((f) => f.id === folderId) : undefined

  const q = search.trim().toLowerCase()
  const visible = (notes ?? [])
    .filter((n) => folderId === 'all' || n.folderId === folderId)
    .filter(
      (n) =>
        !q ||
        n.title.toLowerCase().includes(q) ||
        (n.body ?? '').toLowerCase().includes(q) ||
        (n.items ?? []).some((i) => i.text.toLowerCase().includes(q)),
    )
    .sort((a, b) => b.pinned - a.pinned || b.updatedAt - a.updatedAt)

  async function createNote(type: Note['type']) {
    const now = Date.now()
    const id = await db.notes.add({
      type,
      title: '',
      body: type === 'note' ? '' : undefined,
      items: type === 'checklist' ? [] : undefined,
      folderId: folderId === 'all' ? undefined : folderId,
      pinned: 0,
      createdAt: now,
      updatedAt: now,
    })
    navigate(`/apps/notes/${id}`)
  }

  async function addFolder() {
    const name = folderName.trim()
    if (!name) return
    const id = await db.folders.add({ name, createdAt: Date.now() })
    setFolderName('')
    setNewFolderOpen(false)
    setFolderId(id)
  }

  async function renameFolder() {
    const name = folderName.trim()
    if (!name || folderId === 'all') return
    await db.folders.update(folderId, { name })
    setFolderOptionsOpen(false)
  }

  async function deleteFolder() {
    if (folderId === 'all') return
    if (!window.confirm('Delete this folder? Its notes move to All.')) return
    const id = folderId
    await db.transaction('rw', db.notes, db.folders, async () => {
      await db.notes.where('folderId').equals(id).modify({ folderId: undefined })
      await db.folders.delete(id)
    })
    setFolderOptionsOpen(false)
    setFolderId('all')
  }

  function snippet(n: Note): string {
    if (n.type === 'checklist') {
      const total = n.items?.length ?? 0
      const done = n.items?.filter((i) => i.done).length ?? 0
      return total === 0 ? 'Empty list' : `${done} of ${total} checked`
    }
    return (n.body ?? '').slice(0, 140) || 'No text'
  }

  return (
    <>
      <div className="nav-header">
        <Link to="/apps" className="back-link">
          <ChevronLeft aria-hidden /> Apps
        </Link>
      </div>
      <h1 className="screen-title">Notes & Lists</h1>
      <p className="screen-sub">Notebooks, checklists, and everything worth keeping.</p>

      <div className="search-wrap">
        <Search aria-hidden />
        <input
          className="search-input"
          placeholder="Search notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="chip-row seg-row">
        <button
          className={`chip${folderId === 'all' ? ' active' : ''}`}
          onClick={() => setFolderId('all')}
        >
          All
        </button>
        {folders?.map((f) => (
          <button
            key={f.id}
            className={`chip${folderId === f.id ? ' active' : ''}`}
            onClick={() => setFolderId(f.id)}
          >
            {f.name}
          </button>
        ))}
        <button
          className="chip"
          onClick={() => {
            setFolderName('')
            setNewFolderOpen(true)
          }}
        >
          + Folder
        </button>
        {activeFolder && (
          <button
            className="icon-btn"
            aria-label="Folder options"
            onClick={() => {
              setFolderName(activeFolder.name)
              setFolderOptionsOpen(true)
            }}
          >
            <MoreHorizontal aria-hidden />
          </button>
        )}
      </div>

      <div className="create-row">
        <button className="create-btn" onClick={() => void createNote('note')}>
          <NotebookPen aria-hidden /> New note
        </button>
        <button className="create-btn" onClick={() => void createNote('checklist')}>
          <ListChecks aria-hidden /> New list
        </button>
      </div>

      {notes && visible.length === 0 && (
        <div className="empty">
          <NotebookPen aria-hidden />
          <div className="empty-title">
            {q ? 'Nothing matches' : 'Nothing here yet'}
          </div>
          <p>
            {q
              ? 'Try a different search.'
              : 'Start a note or a checklist — or move a thought over from your Brain Dump inbox.'}
          </p>
        </div>
      )}

      <div className="note-grid">
        {visible.map((n) => {
          const folder =
            folderId === 'all' && n.folderId
              ? folders?.find((f) => f.id === n.folderId)
              : undefined
          return (
            <button
              key={n.id}
              className="card note-card tappable"
              onClick={() => navigate(`/apps/notes/${n.id}`)}
            >
              <div className="note-card-head">
                {n.type === 'checklist' ? (
                  <ListChecks className="note-type-icon" aria-label="Checklist" />
                ) : (
                  <NotebookPen className="note-type-icon" aria-label="Note" />
                )}
                {n.pinned === 1 && <Pin className="pin-ind" aria-label="Pinned" />}
              </div>
              <div className="note-title">{n.title || 'Untitled'}</div>
              <div className="note-snippet">{snippet(n)}</div>
              <div className="note-meta">
                {folder && <span className="note-folder">{folder.name}</span>}
                {relativeTime(n.updatedAt)}
              </div>
            </button>
          )
        })}
      </div>

      {newFolderOpen && (
        <Sheet title="New folder" onClose={() => setNewFolderOpen(false)}>
          <input
            className="sheet-input"
            placeholder="Folder name"
            value={folderName}
            autoFocus
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void addFolder()}
          />
          <button className="btn" disabled={!folderName.trim()} onClick={() => void addFolder()}>
            Create folder
          </button>
        </Sheet>
      )}

      {folderOptionsOpen && activeFolder && (
        <Sheet title="Folder" onClose={() => setFolderOptionsOpen(false)}>
          <input
            className="sheet-input"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void renameFolder()}
          />
          <button className="btn" disabled={!folderName.trim()} onClick={() => void renameFolder()}>
            Rename
          </button>
          <button className="btn danger-ghost" onClick={() => void deleteFolder()}>
            Delete folder
          </button>
        </Sheet>
      )}
    </>
  )
}
