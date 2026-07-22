import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import Sheet from './Sheet'
import { db, type InventoryItem } from '../db'
import { ROOMS } from '../inventory-data'

interface Props {
  item?: InventoryItem
  /** Pre-select a room for a new item (the room currently filtered). */
  defaultRoom?: string
  onClose: () => void
}

export default function ItemSheet({ item, defaultRoom, onClose }: Props) {
  const [name, setName] = useState(item?.name ?? '')
  const [room, setRoom] = useState(item?.room ?? defaultRoom ?? 'Kitchen')
  const [quantity, setQuantity] = useState(item?.quantity ?? 1)
  const [notes, setNotes] = useState(item?.notes ?? '')

  async function save() {
    const trimmed = name.trim()
    if (!trimmed) return
    const fields = {
      name: trimmed,
      room,
      quantity: quantity > 1 ? quantity : undefined,
      notes: notes.trim() || undefined,
    }
    if (item) {
      await db.inventory.update(item.id, fields)
    } else {
      await db.inventory.add({ ...fields, createdAt: Date.now() })
    }
    onClose()
  }

  async function remove() {
    if (!item) return
    await db.inventory.delete(item.id)
    onClose()
  }

  return (
    <Sheet title={item ? 'Edit item' : 'New item'} onClose={onClose}>
      <input
        className="sheet-input"
        placeholder="What is it?"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />

      <div className="sheet-label">Room</div>
      <div className="chip-row wrap">
        {ROOMS.map((r) => (
          <button
            key={r}
            className={`chip${room === r ? ' active' : ''}`}
            onClick={() => setRoom(r)}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="sheet-label">Quantity</div>
      <div className="stepper">
        <button
          className="stepper-btn"
          aria-label="Decrease quantity"
          disabled={quantity <= 1}
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
        >
          <Minus aria-hidden />
        </button>
        <span className="stepper-value">{quantity}</span>
        <button
          className="stepper-btn"
          aria-label="Increase quantity"
          onClick={() => setQuantity((q) => q + 1)}
        >
          <Plus aria-hidden />
        </button>
      </div>

      <div className="sheet-label">Notes</div>
      <textarea
        className="capture-input small"
        placeholder="Model, serial, where exactly, condition…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <button className="btn" disabled={!name.trim()} onClick={() => void save()}>
        {item ? 'Save' : 'Add item'}
      </button>
      {item && (
        <button className="btn danger-ghost" onClick={() => void remove()}>
          Delete
        </button>
      )}
    </Sheet>
  )
}
