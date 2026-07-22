import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Package, Plus, Search } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type InventoryItem } from '../db'
import { ROOMS, roomColor } from '../inventory-data'
import ItemSheet from '../components/ItemSheet'

export default function Inventory() {
  const [search, setSearch] = useState('')
  const [room, setRoom] = useState<'all' | string>('all')
  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const [adding, setAdding] = useState(false)

  const all = useLiveQuery(() => db.inventory.toArray(), [])
  const q = search.trim().toLowerCase()

  const filtered = (all ?? [])
    .filter((i) => (room === 'all' ? true : i.room === room))
    .filter(
      (i) =>
        !q ||
        i.name.toLowerCase().includes(q) ||
        i.room.toLowerCase().includes(q) ||
        (i.notes ?? '').toLowerCase().includes(q),
    )
    .sort((a, b) => a.name.localeCompare(b.name))

  // Rooms that actually have items, in the canonical order, for the filter row.
  const usedRooms = ROOMS.filter((r) => (all ?? []).some((i) => i.room === r))
  const extraRooms = [...new Set((all ?? []).map((i) => i.room))].filter(
    (r) => !ROOMS.includes(r),
  )
  const roomChips = [...usedRooms, ...extraRooms]

  // When showing everything, group by room; otherwise a flat list.
  const grouped =
    room === 'all' && !q
      ? roomChips
          .map((r) => ({ room: r, items: filtered.filter((i) => i.room === r) }))
          .filter((g) => g.items.length > 0)
      : null

  const total = all?.length ?? 0

  return (
    <>
      <div className="nav-header">
        <Link to="/apps" className="back-link">
          <ChevronLeft aria-hidden /> Apps
        </Link>
      </div>
      <h1 className="screen-title">Home Inventory</h1>
      <p className="screen-sub">
        Catalog what you own, by room — then find anything in seconds.
      </p>

      <div className="search-wrap">
        <Search aria-hidden />
        <input
          className="search-input"
          placeholder="Search items, rooms, notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {roomChips.length > 0 && (
        <div className="chip-row scroll-row">
          <button
            className={`chip${room === 'all' ? ' active' : ''}`}
            onClick={() => setRoom('all')}
          >
            All{total > 0 ? ` (${total})` : ''}
          </button>
          {roomChips.map((r) => (
            <button
              key={r}
              className={`chip${room === r ? ' active' : ''}`}
              onClick={() => setRoom(r)}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      <button
        className="btn secondary"
        onClick={() => setAdding(true)}
        style={{ marginTop: 12 }}
      >
        <Plus aria-hidden /> Add item
      </button>

      {total === 0 && (
        <div className="empty">
          <Package aria-hidden />
          <div className="empty-title">Nothing cataloged yet</div>
          <p>Add what you own — appliances, tools, keepsakes — and never lose track again.</p>
        </div>
      )}

      {total > 0 && filtered.length === 0 && (
        <div className="empty">
          <Search aria-hidden />
          <div className="empty-title">No matches</div>
          <p>Try a different search or room.</p>
        </div>
      )}

      <div className="stack" style={{ marginTop: 14 }}>
        {grouped
          ? grouped.map((g) => (
              <div key={g.room} className="inv-group">
                <div className="agenda-date">
                  <span className="room-dot" style={{ background: roomColor(g.room) }} aria-hidden />
                  {g.room}
                </div>
                <div className="card day-detail">
                  {g.items.map((i) => (
                    <ItemRow key={i.id} item={i} onOpen={() => setEditing(i)} showRoom={false} />
                  ))}
                </div>
              </div>
            ))
          : filtered.length > 0 && (
              <div className="card day-detail">
                {filtered.map((i) => (
                  <ItemRow key={i.id} item={i} onOpen={() => setEditing(i)} showRoom />
                ))}
              </div>
            )}
      </div>

      {(adding || editing) && (
        <ItemSheet
          item={editing ?? undefined}
          defaultRoom={room === 'all' ? undefined : room}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
        />
      )}
    </>
  )
}

function ItemRow({
  item,
  onOpen,
  showRoom,
}: {
  item: InventoryItem
  onOpen: () => void
  showRoom: boolean
}) {
  return (
    <button className="inv-row" onClick={onOpen}>
      <span className="inv-main">
        <span className="inv-name">
          {item.name}
          {item.quantity && item.quantity > 1 && (
            <span className="qty-badge">×{item.quantity}</span>
          )}
        </span>
        {(showRoom || item.notes) && (
          <span className="inv-sub">
            {showRoom && (
              <span className="inv-room">
                <span className="room-dot" style={{ background: roomColor(item.room) }} aria-hidden />
                {item.room}
              </span>
            )}
            {item.notes && <span className="inv-note">{item.notes}</span>}
          </span>
        )}
      </span>
    </button>
  )
}
