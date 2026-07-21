import Dexie, { type EntityTable } from 'dexie'

export interface BrainDumpItem {
  id: number
  text: string
  createdAt: number
  status: 'inbox' | 'sorted'
  // Set in Phase 2+ when an item is triaged into another app
  sortedTo?: 'task' | 'note' | 'list-item' | 'shopping' | 'recipe' | 'event'
}

export const db = new Dexie('household-hub') as Dexie & {
  brainDump: EntityTable<BrainDumpItem, 'id'>
}

db.version(1).stores({
  brainDump: '++id, status, createdAt',
})

export interface BackupFile {
  app: 'household-hub'
  version: number
  exportedAt: string
  brainDump: BrainDumpItem[]
}

export async function exportBackup(): Promise<BackupFile> {
  return {
    app: 'household-hub',
    version: 1,
    exportedAt: new Date().toISOString(),
    brainDump: await db.brainDump.toArray(),
  }
}

export async function importBackup(data: BackupFile): Promise<void> {
  if (data.app !== 'household-hub' || !Array.isArray(data.brainDump)) {
    throw new Error('Not a Household Hub backup file')
  }
  await db.transaction('rw', db.brainDump, async () => {
    await db.brainDump.clear()
    await db.brainDump.bulkAdd(data.brainDump)
  })
}
