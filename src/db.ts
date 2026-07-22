import Dexie, { type EntityTable, type Table } from 'dexie'
import { nextOccurrence, todayStr } from './dates'

// Every record carries a device-independent sync identity (uuid) and a
// last-modified timestamp (updatedAt, ms epoch) used for last-write-wins
// merging. Both are optional in the types because rows created before
// schema v5 lacked them; the v5 upgrade backfills and the sync hooks fill
// them on every new write, so they are always present at runtime.

export interface BrainDumpItem {
  id: number
  uuid?: string
  text: string
  createdAt: number
  updatedAt?: number
  status: 'inbox' | 'sorted'
  // Set when an item is triaged into another app
  sortedTo?: 'task' | 'note' | 'list-item' | 'shopping' | 'recipe' | 'event'
}

export interface Task {
  id: number
  uuid?: string
  updatedAt?: number
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
  uuid?: string
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
  uuid?: string
  name: string
  createdAt: number
  updatedAt?: number
}

export interface Recipe {
  id: number
  uuid?: string
  name: string
  ingredients: string[]
  steps?: string
  createdAt: number
  updatedAt: number
}

export interface MealPlanEntry {
  id: number
  uuid?: string
  date: string // YYYY-MM-DD, local
  slot: 'breakfast' | 'lunch' | 'dinner'
  recipeId?: number
  text?: string
  createdAt: number
  updatedAt?: number
}

export interface ShoppingItem {
  id: number
  uuid?: string
  text: string
  checked: boolean
  source?: string // recipe name it came from, when added via the planner
  createdAt: number
  updatedAt?: number
}

export interface CalendarEvent {
  id: number
  uuid?: string
  updatedAt?: number
  title: string
  date: string // YYYY-MM-DD, local — the (first) day it occurs
  allDay: boolean
  startTime?: string // HH:MM 24h, when not all-day
  endTime?: string // HH:MM 24h
  location?: string
  notes?: string
  repeat: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  createdAt: number
}

/** A local change waiting to be pushed to sync. key = `${tbl}|${uuid}`. */
export interface OutboxEntry {
  key: string
  tbl: string
  uuid: string
  // Set when the record was deleted locally; pushed as a tombstone.
  deletedAt?: number
}

export interface MetaEntry {
  key: string
  value: number
}

export const db = new Dexie('household-hub') as Dexie & {
  brainDump: EntityTable<BrainDumpItem, 'id'>
  tasks: EntityTable<Task, 'id'>
  notes: EntityTable<Note, 'id'>
  folders: EntityTable<Folder, 'id'>
  recipes: EntityTable<Recipe, 'id'>
  mealPlan: EntityTable<MealPlanEntry, 'id'>
  shopping: EntityTable<ShoppingItem, 'id'>
  events: EntityTable<CalendarEvent, 'id'>
  outbox: Table<OutboxEntry, string>
  meta: Table<MetaEntry, string>
}

/**
 * True while sync (or a schema upgrade) is writing remote state into the
 * local database. The sync hooks check this so those writes aren't
 * re-tracked as fresh local edits.
 */
export const syncFlags = { applying: false }

export const SYNC_TABLE_NAMES = [
  // folders and recipes first: notes and meal plan entries pulled in the
  // same sync batch reference them by uuid
  'folders',
  'recipes',
  'brainDump',
  'tasks',
  'notes',
  'mealPlan',
  'shopping',
  'events',
] as const

export type SyncTableName = (typeof SYNC_TABLE_NAMES)[number]

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

db.version(4).stores({
  brainDump: '++id, status, createdAt',
  tasks: '++id, status, dueDate, createdAt',
  notes: '++id, type, folderId, pinned, updatedAt',
  folders: '++id, name',
  recipes: '++id, name, updatedAt',
  mealPlan: '++id, date, slot',
  shopping: '++id, createdAt',
})

// v5: sync support — unique uuid on every record, plus the outbox
// (changes waiting to push) and meta (sync cursors) tables.
db.version(5)
  .stores({
    brainDump: '++id, status, createdAt, &uuid',
    tasks: '++id, status, dueDate, createdAt, &uuid',
    notes: '++id, type, folderId, pinned, updatedAt, &uuid',
    folders: '++id, name, &uuid',
    recipes: '++id, name, updatedAt, &uuid',
    mealPlan: '++id, date, slot, &uuid',
    shopping: '++id, createdAt, &uuid',
    outbox: 'key',
    meta: 'key',
  })
  .upgrade(async (tx) => {
    syncFlags.applying = true
    try {
      // The tables that existed at v5 — literal, not SYNC_TABLE_NAMES, so
      // adding future sync tables (events in v6) can't reach into this
      // v4→v5 backfill for a table that doesn't exist yet.
      const v5Tables = [
        'folders',
        'recipes',
        'brainDump',
        'tasks',
        'notes',
        'mealPlan',
        'shopping',
      ]
      for (const name of v5Tables) {
        await tx
          .table(name)
          .toCollection()
          .modify((row: { uuid?: string; updatedAt?: number; createdAt?: number }) => {
            if (!row.uuid) row.uuid = crypto.randomUUID()
            if (row.updatedAt == null) row.updatedAt = row.createdAt ?? Date.now()
          })
      }
    } finally {
      syncFlags.applying = false
    }
  })

// v6: Calendar — events table (dated, optionally timed, optionally repeating).
db.version(6).stores({
  brainDump: '++id, status, createdAt, &uuid',
  tasks: '++id, status, dueDate, createdAt, &uuid',
  notes: '++id, type, folderId, pinned, updatedAt, &uuid',
  folders: '++id, name, &uuid',
  recipes: '++id, name, updatedAt, &uuid',
  mealPlan: '++id, date, slot, &uuid',
  shopping: '++id, createdAt, &uuid',
  events: '++id, date, &uuid',
  outbox: 'key',
  meta: 'key',
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

/** Triage a brain dump item into the shopping list. */
export async function moveDumpToShopping(itemId: number, text: string): Promise<void> {
  await db.transaction('rw', db.brainDump, db.shopping, async () => {
    await db.shopping.add({ text, checked: false, createdAt: Date.now() })
    await db.brainDump.update(itemId, { status: 'sorted', sortedTo: 'shopping' })
  })
}

/** Triage a brain dump item into a new recipe. First line = name, rest = ingredients. */
export async function moveDumpToRecipe(itemId: number, text: string): Promise<number> {
  const lines = text.split('\n')
  const name = lines[0].slice(0, 80)
  const ingredients = lines
    .slice(1)
    .map((l) => l.trim())
    .filter(Boolean)
  return db.transaction('rw', db.brainDump, db.recipes, async () => {
    const now = Date.now()
    const recipeId = await db.recipes.add({
      name,
      ingredients,
      createdAt: now,
      updatedAt: now,
    })
    await db.brainDump.update(itemId, { status: 'sorted', sortedTo: 'recipe' })
    return recipeId
  })
}

/** Triage a brain dump item into a new all-day event today. Returns the new event id. */
export async function moveDumpToEvent(itemId: number, text: string): Promise<number> {
  const title = text.split('\n')[0].slice(0, 120)
  return db.transaction('rw', db.brainDump, db.events, async () => {
    const eventId = await db.events.add({
      title,
      date: todayStr(),
      allDay: true,
      repeat: 'none',
      createdAt: Date.now(),
    })
    await db.brainDump.update(itemId, { status: 'sorted', sortedTo: 'event' })
    return eventId
  })
}

/**
 * Add a recipe's ingredients to the shopping list, skipping ones already
 * there unchecked. Returns how many were added.
 */
export async function addIngredientsToShopping(recipe: Recipe): Promise<number> {
  return db.transaction('rw', db.shopping, async () => {
    const open = await db.shopping.toArray()
    const existing = new Set(
      open.filter((i) => !i.checked).map((i) => i.text.trim().toLowerCase()),
    )
    let added = 0
    for (const ing of recipe.ingredients) {
      const key = ing.trim().toLowerCase()
      if (!key || existing.has(key)) continue
      existing.add(key)
      await db.shopping.add({
        text: ing.trim(),
        checked: false,
        source: recipe.name || undefined,
        createdAt: Date.now(),
      })
      added++
    }
    return added
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
  recipes?: Recipe[]
  mealPlan?: MealPlanEntry[]
  shopping?: ShoppingItem[]
  events?: CalendarEvent[]
}

export async function exportBackup(): Promise<BackupFile> {
  return {
    app: 'household-hub',
    version: 6,
    exportedAt: new Date().toISOString(),
    brainDump: await db.brainDump.toArray(),
    tasks: await db.tasks.toArray(),
    notes: await db.notes.toArray(),
    folders: await db.folders.toArray(),
    recipes: await db.recipes.toArray(),
    mealPlan: await db.mealPlan.toArray(),
    shopping: await db.shopping.toArray(),
    events: await db.events.toArray(),
  }
}

export async function importBackup(data: BackupFile): Promise<void> {
  if (data.app !== 'household-hub' || !Array.isArray(data.brainDump)) {
    throw new Error('Not a Household Hub backup file')
  }
  const tables = [
    db.brainDump,
    db.tasks,
    db.notes,
    db.folders,
    db.recipes,
    db.mealPlan,
    db.shopping,
    db.events,
    db.outbox,
    db.meta,
  ]
  syncFlags.applying = true
  try {
    await db.transaction('rw', tables, async () => {
      await db.brainDump.clear()
      await db.brainDump.bulkAdd(data.brainDump)
      await db.tasks.clear()
      if (Array.isArray(data.tasks)) await db.tasks.bulkAdd(data.tasks)
      await db.notes.clear()
      if (Array.isArray(data.notes)) await db.notes.bulkAdd(data.notes)
      await db.folders.clear()
      if (Array.isArray(data.folders)) await db.folders.bulkAdd(data.folders)
      await db.recipes.clear()
      if (Array.isArray(data.recipes)) await db.recipes.bulkAdd(data.recipes)
      await db.mealPlan.clear()
      if (Array.isArray(data.mealPlan)) await db.mealPlan.bulkAdd(data.mealPlan)
      await db.shopping.clear()
      if (Array.isArray(data.shopping)) await db.shopping.bulkAdd(data.shopping)
      await db.events.clear()
      if (Array.isArray(data.events)) await db.events.bulkAdd(data.events)
      // The import replaced local state wholesale, so sync bookkeeping
      // must start over: forget cursors and re-merge everything on the
      // next sync.
      await db.outbox.clear()
      await db.meta.clear()
    })
  } finally {
    syncFlags.applying = false
  }
}

/**
 * Wipe everything stored on this device, including sync bookkeeping.
 * Runs with syncFlags.applying set so nothing is pushed as a deletion —
 * this resets the device, it does not delete synced data.
 */
export async function eraseAllLocalData(): Promise<void> {
  const tables = [
    db.brainDump,
    db.tasks,
    db.notes,
    db.folders,
    db.recipes,
    db.mealPlan,
    db.shopping,
    db.events,
    db.outbox,
    db.meta,
  ]
  syncFlags.applying = true
  try {
    await db.transaction('rw', tables, async () => {
      for (const t of tables) await t.clear()
    })
  } finally {
    syncFlags.applying = false
  }
}
