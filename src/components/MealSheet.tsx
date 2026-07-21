import { useState } from 'react'
import { ChefHat } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import Sheet from './Sheet'
import { db, type MealPlanEntry } from '../db'
import { parse } from '../dates'

interface Props {
  date: string
  slot: MealPlanEntry['slot']
  entry?: MealPlanEntry
  onClose: () => void
}

const SLOT_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' }

export default function MealSheet({ date, slot, entry, onClose }: Props) {
  const [text, setText] = useState(entry?.text ?? '')
  const recipes = useLiveQuery(() => db.recipes.orderBy('name').toArray(), [])

  const dayLabel = parse(date).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })

  async function setEntry(fields: { recipeId?: number; text?: string }) {
    if (entry) {
      await db.mealPlan.update(entry.id, {
        recipeId: fields.recipeId,
        text: fields.text,
      })
    } else {
      await db.mealPlan.add({
        date,
        slot,
        recipeId: fields.recipeId,
        text: fields.text,
        createdAt: Date.now(),
      })
    }
    onClose()
  }

  async function remove() {
    if (!entry) return
    await db.mealPlan.delete(entry.id)
    onClose()
  }

  return (
    <Sheet title={`${SLOT_LABELS[slot]} · ${dayLabel}`} onClose={onClose}>
      <form
        className="quick-add"
        onSubmit={(e) => {
          e.preventDefault()
          if (text.trim()) void setEntry({ text: text.trim() })
        }}
      >
        <input
          className="quick-add-input"
          placeholder="Type anything — “Leftovers”, “Pizza night”…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          className="quick-add-btn"
          disabled={!text.trim()}
          aria-label="Set meal"
        >
          <ChefHat aria-hidden />
        </button>
      </form>

      <div className="sheet-label">Or pick a recipe</div>
      {recipes && recipes.length === 0 && (
        <p className="sheet-hint">
          No recipes yet — add some in the Recipes tab and they’ll show up here.
        </p>
      )}
      <div className="stack">
        {recipes?.map((r) => (
          <button
            key={r.id}
            className={`card dump-item tappable${entry?.recipeId === r.id ? ' selected' : ''}`}
            onClick={() => void setEntry({ recipeId: r.id })}
          >
            <div className="dump-body">
              <div className="tile-name">{r.name || 'Untitled recipe'}</div>
              <div className="tile-sub">{r.ingredients.length} ingredients</div>
            </div>
          </button>
        ))}
      </div>

      {entry && (
        <button className="btn danger-ghost" onClick={() => void remove()}>
          Remove this meal
        </button>
      )}
    </Sheet>
  )
}
