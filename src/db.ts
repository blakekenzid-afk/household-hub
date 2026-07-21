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

export interface Recipe {
  id: number
  name: string
  ingredients: string[]
  steps?: string
  createdAt: number
  updatedAt: number
}

export interface MealPlanEntry {
  id: number
  date: string // YYYY-MM-DD, local
  slot: 'breakfast' | 'lunch' | 'dinner'
  recipeId?: number
  text?: string
  createdAt: number
}

export interface ShoppingItem {
  id: number
  text: string
  checked: boolean
  source?: string // recipe name it came from, when added via the planner
  createdAt: number
}

export const db = new Dexie('household-hub') as Dexie & {
  brainDump: EntityTable<BrainDumpItem, 'id'>
  tasks: EntityTable<Task, 'id'>
  notes: EntityTable<Note, 'id'>
  folders: EntityTable<Folder, 'id'>
  recipes: EntityTable<Recipe, 'id'>
  mealPlan: EntityTable<MealPlanEntry, 'id'>
  shopping: EntityTable<ShoppingItem, 'id'>
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

db.version(4).stores({
  brainDump: '++id, status, createdAt',
  tasks: '++id, status, dueDate, createdAt',
  notes: '++id, type, folderId, pinned, updatedAt',
  folders: '++id, name',
  recipes: '++id, name, updatedAt',
  mealPlan: '++id, date, slot',
  shopping: '++id, createdAt',
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
}

export async function exportBackup(): Promise<BackupFile> {
  return {
    app: 'household-hub',
    version: 4,
    exportedAt: new Date().toISOString(),
    brainDump: await db.brainDump.toArray(),
    tasks: await db.tasks.toArray(),
    notes: await db.notes.toArray(),
    folders: await db.folders.toArray(),
    recipes: await db.recipes.toArray(),
    mealPlan: await db.mealPlan.toArray(),
    shopping: await db.shopping.toArray(),
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
  ]
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
  })
}
