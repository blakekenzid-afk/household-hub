import { db, syncFlags, SYNC_TABLE_NAMES, type OutboxEntry, type SyncTableName } from './db'
import { supabase } from './supabase'

/**
 * Sync engine. The local Dexie database is the source of truth; the
 * server holds one generic `records` row per local record, merged with
 * last-write-wins by the client-side updatedAt timestamp.
 *
 * - Local writes are tracked by Dexie hooks into the outbox table.
 * - syncNow() pulls remote changes since the last cursor, merges them,
 *   then pushes the outbox through the push_records RPC (which ignores
 *   anything older than what the server already has).
 * - Local integer ids never leave the device: cross-record references
 *   (note→folder, meal→recipe) travel as uuids and are re-resolved to
 *   local ids on arrival.
 */

interface SyncRow {
  id?: number
  uuid?: string
  updatedAt?: number
  [key: string]: unknown
}

interface RemoteRecord {
  tbl: string
  uuid: string
  data: Record<string, unknown>
  updated_at: number
  deleted: boolean
  server_seq: number
}

interface PushRow {
  tbl: string
  uuid: string
  data: Record<string, unknown>
  updated_at: number
  deleted: boolean
}

const PULL_PAGE = 1000
const PUSH_CHUNK = 500

function outboxKey(tbl: string, uuid: string): string {
  return `${tbl}|${uuid}`
}

function isSyncTable(tbl: string): tbl is SyncTableName {
  return (SYNC_TABLE_NAMES as readonly string[]).includes(tbl)
}

// ---- status, exposed to the Settings screen ----

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'error'
  error?: string
}

let status: SyncStatus = { state: 'idle' }
const statusListeners = new Set<() => void>()

export function subscribeSyncStatus(fn: () => void): () => void {
  statusListeners.add(fn)
  return () => statusListeners.delete(fn)
}

export function getSyncStatus(): SyncStatus {
  return status
}

function setStatus(next: SyncStatus) {
  status = next
  for (const fn of statusListeners) fn()
}

// ---- meta helpers ----

async function getMeta(key: string): Promise<number | undefined> {
  return (await db.meta.get(key))?.value
}

async function setMeta(key: string, value: number): Promise<void> {
  await db.meta.put({ key, value })
}

// ---- local change tracking ----
// Hooks can't write to the outbox table directly (it isn't part of the
// app's transactions), so entries buffer in memory and flush right after.
// Over-tracking is safe — push re-reads the live row and skips entries
// whose record never materialized — but under-tracking would lose edits.

const pendingOutbox = new Map<string, OutboxEntry>()
let flushTimer: number | undefined

function queueOutbox(tbl: string, uuid: string, deletedAt?: number) {
  const key = outboxKey(tbl, uuid)
  const prev = pendingOutbox.get(key)
  pendingOutbox.set(key, { key, tbl, uuid, deletedAt: deletedAt ?? prev?.deletedAt })
  if (flushTimer == null) {
    flushTimer = window.setTimeout(() => {
      flushTimer = undefined
      void flushOutbox()
    }, 50)
  }
}

async function flushOutbox(): Promise<void> {
  if (!pendingOutbox.size) return
  const entries = [...pendingOutbox.values()]
  pendingOutbox.clear()
  await db.outbox.bulkPut(entries)
  scheduleSync()
}

for (const tbl of SYNC_TABLE_NAMES) {
  const table = db.table(tbl)
  table.hook('creating', function (_pk, obj: SyncRow) {
    if (!obj.uuid) obj.uuid = crypto.randomUUID()
    if (obj.updatedAt == null) obj.updatedAt = Date.now()
    if (!syncFlags.applying) queueOutbox(tbl, obj.uuid)
  })
  table.hook('updating', function (mods, _pk, obj: SyncRow) {
    if (syncFlags.applying) return undefined
    const uuid = ((mods as SyncRow).uuid ?? obj.uuid) as string | undefined
    if (uuid) queueOutbox(tbl, uuid)
    return { updatedAt: Date.now() }
  })
  table.hook('deleting', function (_pk, obj: SyncRow | undefined) {
    if (syncFlags.applying || !obj?.uuid) return
    queueOutbox(tbl, obj.uuid, Date.now())
  })
}

// ---- payload mapping ----
// The payload is the whole record minus the local id. Local integer
// references are swapped for uuids on the way out and back on the way in
// (the referenced table syncs in the same pass, ordered first).

async function toPayload(tbl: SyncTableName, row: SyncRow): Promise<Record<string, unknown>> {
  const { id: _id, uuid: _uuid, ...data } = row
  if (tbl === 'notes') {
    const folderId = data.folderId as number | undefined
    delete data.folderId
    if (folderId != null) {
      const folder = await db.folders.get(folderId)
      if (folder?.uuid) data.folderUuid = folder.uuid
    }
  }
  if (tbl === 'mealPlan') {
    const recipeId = data.recipeId as number | undefined
    delete data.recipeId
    if (recipeId != null) {
      const recipe = await db.recipes.get(recipeId)
      if (recipe?.uuid) data.recipeUuid = recipe.uuid
    }
  }
  return data
}

async function fromPayload(
  tbl: SyncTableName,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const row = { ...data }
  if (tbl === 'notes') {
    const folderUuid = row.folderUuid as string | undefined
    delete row.folderUuid
    delete row.folderId
    if (folderUuid) {
      const folder = await db.folders.where('uuid').equals(folderUuid).first()
      if (folder) row.folderId = folder.id
    }
  }
  if (tbl === 'mealPlan') {
    const recipeUuid = row.recipeUuid as string | undefined
    delete row.recipeUuid
    delete row.recipeId
    if (recipeUuid) {
      const recipe = await db.recipes.where('uuid').equals(recipeUuid).first()
      if (recipe) row.recipeId = recipe.id
    }
  }
  return row
}

// ---- pull ----

async function pullOnce(): Promise<void> {
  let cursor = (await getMeta('pullCursor')) ?? 0
  const fetched: RemoteRecord[] = []
  for (;;) {
    const { data, error } = await supabase
      .from('records')
      .select('tbl,uuid,data,updated_at,deleted,server_seq')
      .gt('server_seq', cursor)
      .order('server_seq', { ascending: true })
      .limit(PULL_PAGE)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as RemoteRecord[]
    fetched.push(...rows)
    if (rows.length) cursor = rows[rows.length - 1].server_seq
    if (rows.length < PULL_PAGE) break
  }
  if (!fetched.length) return

  // Keep only the newest version of each record (rows arrive in
  // server_seq order, so later entries win).
  const latest = new Map<string, RemoteRecord>()
  for (const rec of fetched) {
    if (isSyncTable(rec.tbl)) latest.set(outboxKey(rec.tbl, rec.uuid), rec)
  }

  const txTables = [...SYNC_TABLE_NAMES.map((t) => db.table(t)), db.outbox, db.meta]
  syncFlags.applying = true
  try {
    await db.transaction('rw', txTables, async () => {
      for (const tbl of SYNC_TABLE_NAMES) {
        const table = db.table(tbl)
        for (const rec of latest.values()) {
          if (rec.tbl !== tbl) continue
          const key = outboxKey(tbl, rec.uuid)
          const local = (await table.where('uuid').equals(rec.uuid).first()) as
            | SyncRow
            | undefined
          const pendingDeleteAt = (await db.outbox.get(key))?.deletedAt

          if (rec.deleted) {
            const localWins = local != null && (local.updatedAt ?? 0) > rec.updated_at
            if (!localWins) {
              if (local?.id != null) await table.delete(local.id)
              // keep our own tombstone only if it's newer than the
              // remote one and still needs to push
              if (!(pendingDeleteAt != null && pendingDeleteAt > rec.updated_at)) {
                await db.outbox.delete(key)
              }
            }
            continue
          }

          if (pendingDeleteAt != null) {
            if (pendingDeleteAt >= rec.updated_at) {
              // This record was deleted locally after the remote version
              // was written — the tombstone wins and will push. Without
              // this check, a record's own push echo would resurrect it.
              if (local?.id != null) await table.delete(local.id)
              continue
            }
            // remote version is newer than the local deletion: undelete
            await db.outbox.delete(key)
          }

          if (!local) {
            await table.add({
              ...(await fromPayload(tbl, rec.data)),
              uuid: rec.uuid,
              updatedAt: rec.updated_at,
            })
          } else if (rec.updated_at > (local.updatedAt ?? 0)) {
            // put (not update) so fields the other device removed
            // disappear here too
            await table.put({
              ...(await fromPayload(tbl, rec.data)),
              id: local.id,
              uuid: rec.uuid,
              updatedAt: rec.updated_at,
            })
            await db.outbox.delete(key)
          }
        }
      }
      await setMeta('pullCursor', cursor)
    })
  } finally {
    syncFlags.applying = false
  }
}

// ---- push ----

async function pushOnce(): Promise<void> {
  await flushOutbox()
  const entries = await db.outbox.toArray()
  if (!entries.length) return

  const rows: PushRow[] = []
  // key → updatedAt that was pushed; Infinity marks entries that are
  // final (tombstones, aborted creates) and can always be cleared
  const pushed = new Map<string, number>()
  for (const e of entries) {
    if (!isSyncTable(e.tbl)) {
      pushed.set(e.key, Infinity)
      continue
    }
    const local = (await db.table(e.tbl).where('uuid').equals(e.uuid).first()) as
      | SyncRow
      | undefined
    const deletedAt = e.deletedAt
    if (deletedAt != null && (local == null || deletedAt >= (local.updatedAt ?? 0))) {
      // The deletion is the newest thing that happened to this record.
      rows.push({ tbl: e.tbl, uuid: e.uuid, data: {}, updated_at: deletedAt, deleted: true })
      pushed.set(e.key, Infinity)
      if (local?.id != null) {
        // a pull echo resurrected the record after it was deleted; the
        // tombstone is newer, so the stale copy goes
        syncFlags.applying = true
        try {
          await db.table(e.tbl).delete(local.id)
        } finally {
          syncFlags.applying = false
        }
      }
    } else if (local) {
      const updatedAt = local.updatedAt ?? Date.now()
      rows.push({
        tbl: e.tbl,
        uuid: e.uuid,
        data: await toPayload(e.tbl, local),
        updated_at: updatedAt,
        deleted: false,
      })
      pushed.set(e.key, updatedAt)
    } else {
      pushed.set(e.key, Infinity)
    }
  }

  for (let i = 0; i < rows.length; i += PUSH_CHUNK) {
    const { error } = await supabase.rpc('push_records', { _rows: rows.slice(i, i + PUSH_CHUNK) })
    if (error) throw new Error(error.message)
  }

  // Clear what we pushed — unless the record changed again mid-push, in
  // which case its entry stays for the next round.
  const txTables = [...SYNC_TABLE_NAMES.map((t) => db.table(t)), db.outbox]
  await db.transaction('rw', txTables, async () => {
    for (const [key, ts] of pushed) {
      if (ts === Infinity) {
        await db.outbox.delete(key)
        continue
      }
      const entry = await db.outbox.get(key)
      if (!entry) continue
      if (entry.deletedAt != null && entry.deletedAt > ts) continue // deleted after we pushed; keep tombstone
      const row = (await db.table(entry.tbl).where('uuid').equals(entry.uuid).first()) as
        | SyncRow
        | undefined
      if (!row || (row.updatedAt ?? 0) <= ts) await db.outbox.delete(key)
    }
  })
}

// ---- orchestration ----

async function enqueueAll(): Promise<void> {
  const entries: OutboxEntry[] = []
  for (const tbl of SYNC_TABLE_NAMES) {
    const rowsInTable = (await db.table(tbl).toArray()) as SyncRow[]
    for (const row of rowsInTable) {
      if (row.uuid) entries.push({ key: outboxKey(tbl, row.uuid), tbl, uuid: row.uuid })
    }
  }
  if (entries.length) await db.outbox.bulkPut(entries)
}

let inFlight: Promise<void> | null = null

export function syncNow(): Promise<void> {
  inFlight ??= doSync().finally(() => {
    inFlight = null
  })
  return inFlight
}

async function doSync(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session || !navigator.onLine) return
  setStatus({ state: 'syncing' })
  try {
    // First sync on this device pushes everything it already has; the
    // pull that runs first merges in whatever the server knows.
    const firstSync = !(await getMeta('initialPushDone'))
    if (firstSync) await enqueueAll()
    await pullOnce()
    await pushOnce()
    if (firstSync) await setMeta('initialPushDone', 1)
    await setMeta('lastSyncAt', Date.now())
    setStatus({ state: 'idle' })
  } catch (err) {
    setStatus({ state: 'error', error: err instanceof Error ? err.message : String(err) })
  }
}

let syncTimer: number | undefined

export function scheduleSync(delay = 2500): void {
  if (syncTimer != null) clearTimeout(syncTimer)
  syncTimer = window.setTimeout(() => {
    syncTimer = undefined
    void syncNow()
  }, delay)
}

supabase.auth.onAuthStateChange((event, session) => {
  if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
    scheduleSync(300)
  }
  if (event === 'SIGNED_OUT') {
    // Cursors are per-account; drop them so a future sign-in (possibly a
    // different account) starts with a clean, full merge.
    void db.meta.bulkDelete(['pullCursor', 'initialPushDone', 'lastSyncAt'])
  }
})

window.addEventListener('online', () => scheduleSync(300))
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') scheduleSync(300)
})
