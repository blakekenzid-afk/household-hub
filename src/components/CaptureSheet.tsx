import { useEffect, useRef, useState } from 'react'
import Sheet from './Sheet'
import { db, type BrainDumpItem } from '../db'

interface Props {
  item?: BrainDumpItem
  onClose: () => void
}

export default function CaptureSheet({ item, onClose }: Props) {
  const [text, setText] = useState(item?.text ?? '')
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  async function save() {
    const trimmed = text.trim()
    if (!trimmed) return
    if (item) {
      await db.brainDump.update(item.id, { text: trimmed })
    } else {
      await db.brainDump.add({
        text: trimmed,
        createdAt: Date.now(),
        status: 'inbox',
      })
    }
    onClose()
  }

  async function remove() {
    if (!item) return
    await db.brainDump.delete(item.id)
    onClose()
  }

  return (
    <Sheet title={item ? 'Edit thought' : 'Brain dump'} onClose={onClose}>
      <textarea
        ref={ref}
        className="capture-input"
        placeholder="What's on your mind? Get it out — sort it later."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            void save()
          }
        }}
      />
      <button className="btn" disabled={!text.trim()} onClick={() => void save()}>
        {item ? 'Save' : 'Drop it in the inbox'}
      </button>
      {item && (
        <button className="btn danger-ghost" onClick={() => void remove()}>
          Delete
        </button>
      )}
    </Sheet>
  )
}
