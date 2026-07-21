import Dexie, { type EntityTable } from 'dexie'
import { nextOccurrence } from './dates'

export interface BrainDumpItem {
  id: number
  text: string
  createdAt: number
  status: 'inbox' | 'sorted'
  // Set when an item is triaged into another app
  sortedTo?: 'task' | 'note' | 'list-item' | 'shopping' | 'recipe' | 'event'
}

export interface Task {
  id: number
  title: string
  notes?: string
  status: 'open' | 'done'
  dueDate?: string // YYYY-MM-DD, local
  priority: 'none' | 'low' | 'medium' | 'high'
  repeat: 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly'
  createdAt: number
  completedAt?: number
}

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface Note {
  id: number
  type: 'note' | 'checklist'
  title: string
  body?: string
  items?: ChecklistItem[]
  folderId?: number
  pinned: 0 | 1
  createdAt: number
  updatedAt: number
}

export interface Folder {
  id: number
  name: string
  createdAt: number
}

export const db = new Dexie('household-hub') as Dexie & {
  brainDump: EntityTable<BrainDumpItem, 'id'>
  tasks: EntityTable<Task, 'id'>
  notes: EntityTable<Note, 'id'>
  folders: EntityTable<Folder, 'id'>
}

db.version(1).stores({
  brainDump: '++id, status, createdAt',
})

db.version(2).stores({
  brainDump: '++id, status, createdAt',
  tasks: '++id, status, dueDate, createdAt',
})

db.version(3).stores({
  brainDump: '++id, status, createdAt',
  tasks: '++id, status, dueDate, createdAt',
  notes: '++id, type, folderId, pinned, updatedAt',
  folders: '++id, name',
})

/** Complete/uncomplete a task. Completing a repeating task spawns the next occurrence. */
export async function toggleTask(task: Task): Promise<void> {
  if (task.status === 'open') {
    await db.transaction('rw', db.tasks, async () => {
      await db.tasks.update(task.id, { status: 'done', completedAt: Date.now() })
      if (task.repeat !== 'none' && task.dueDate) {
        await db.tasks.add({
          title: task.title,
          notes: task.notes,
          status: 'open',
          dueDate: nextOccurrence(task.dueDate, task.repeat),
          priority: task.priority,
          repeat: task.repeat,
          createdAt: Date.now(),
        })
      }
    })
  } else {
    await db.tasks.update(task.id, { status: 'open', completedAt: undefined })
  }
}

/** Triage a brain dump item into a task. Returns the new task id. */
export async function moveDumpToTask(itemId: number, title: string): Promise<number> {
  return db.transaction('rw', db.brainDump, db.tasks, async () => {
    const taskId = await db.tasks.add({
      title,
      status: 'open',
      priority: 'none',
      repeat: 'none',
      createdAt: Date.now(),
    })
    await db.brainDump.update(itemId, { status: 'sorted', sortedTo: 'task' })
    return taskId
  })
}

/** Triage a brain dump item into a new note. Returns the new note id. */
export async function moveDumpToNote(itemId: number, text: string): Promise<number> {
  const lines = text.split('\n')
  const title = lines[0].slice(0, 80)
  const body = lines.slice(1).join('\n').trim()
  return db.transaction('rw', db.brainDump, db.notes, async () => {
    const now = Date.now()
    const noteId = await db.notes.add({
      type: 'note',
      title,
      body,
      pinned: 0,
      createdAt: now,
      updatedAt: now,
    })
    await db.brainDump.update(itemId, { status: 'sorted', sortedTo: 'note' })
    return noteId
  })
}

/** Triage a brain dump item into an existing checklist as a new item. */
export async function moveDumpToListItem(
  itemId: number,
  text: string,
  checklistId: number,
): Promise<void> {
  await db.transaction('rw', db.brainDump, db.notes, async () => {
    const list = await db.notes.get(checklistId)
    if (!list || list.type !== 'checklist') throw new Error('Checklist not found')
    const items = [
      ...(list.items ?? []),
      { id: crypto.randomUUID(), text, done: false },
    ]
    await db.notes.update(checklistId, { items, updatedAt: Date.now() })
    await db.brainDump.update(itemId, { status: 'sorted', sortedTo: 'list-item' })
  })
}

export interface BackupFile {
  app: 'household-hub'
  version: number
  exportedAt: string
  brainDump: BrainDumpItem[]
  tasks?: Task[]
  notes?: Note[]
  folders?: Folder[]
}

export async function exportBackup(): Promise<BackupFile> {
  return {
    app: 'household-hub',
    version: 3,
    exportedAt: new Date().toISOString(),
    brainDump: await db.brainDump.toArray(),
    tasks: await db.tasks.toArray(),
    notes: await db.notes.toArray(),
    folders: await db.folders.toArray(),
  }
}

export async function importBackup(data: BackupFile): Promise<void> {
  if (data.app !== 'household-hub' || !Array.isArray(data.brainDump)) {
    throw new Error('Not a Household Hub backup file')
  }
  await db.transaction('rw', db.brainDump, db.tasks, db.notes, db.folders, async () => {
    await db.brainDump.clear()
    await db.brainDump.bulkAdd(data.brainDump)
    await db.tasks.clear()
    if (Array.isArray(data.tasks)) await db.tasks.bulkAdd(data.tasks)
    await db.notes.clear()
    if (Array.isArray(data.notes)) await db.notes.bulkAdd(data.notes)
    await db.folders.clear()
    if (Array.isArray(data.folders)) await db.folders.bulkAdd(data.folders)
  })
}
