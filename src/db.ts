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

export const db = new Dexie('household-hub') as Dexie & {
  brainDump: EntityTable<BrainDumpItem, 'id'>
  tasks: EntityTable<Task, 'id'>
}

db.version(1).stores({
  brainDump: '++id, status, createdAt',
})

db.version(2).stores({
  brainDump: '++id, status, createdAt',
  tasks: '++id, status, dueDate, createdAt',
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

export interface BackupFile {
  app: 'household-hub'
  version: number
  exportedAt: string
  brainDump: BrainDumpItem[]
  tasks?: Task[]
}

export async function exportBackup(): Promise<BackupFile> {
  return {
    app: 'household-hub',
    version: 2,
    exportedAt: new Date().toISOString(),
    brainDump: await db.brainDump.toArray(),
    tasks: await db.tasks.toArray(),
  }
}

export async function importBackup(data: BackupFile): Promise<void> {
  if (data.app !== 'household-hub' || !Array.isArray(data.brainDump)) {
    throw new Error('Not a Household Hub backup file')
  }
  await db.transaction('rw', db.brainDump, db.tasks, async () => {
    await db.brainDump.clear()
    await db.brainDump.bulkAdd(data.brainDump)
    await db.tasks.clear()
    if (Array.isArray(data.tasks)) await db.tasks.bulkAdd(data.tasks)
  })
}
