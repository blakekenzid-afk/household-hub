import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Plus,
  ShoppingCart,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  addIngredientsToShopping,
  db,
  type MealPlanEntry,
} from '../db'
import { parse, todayStr, weekDates, weekLabel, weekStart } from '../dates'
import { relativeTime } from '../time'
import MealSheet from '../components/MealSheet'

const SLOTS: MealPlanEntry['slot'][] = ['breakfast', 'lunch', 'dinner']
const SLOT_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' }

export default function Meals() {
  const navigate = useNavigate()
  const [view, setView] = useState<'plan' | 'recipes'>('plan')
  const [weekOffset, setWeekOffset] = useState(0)
  const [editingSlot, setEditingSlot] = useState<{
    date: string
    slot: MealPlanEntry['slot']
    entry?: MealPlanEntry
  } | null>(null)
  const [message, setMessage] = useState('')

  const start = weekStart(weekOffset)
  const days = weekDates(start)
  const today = todayStr()

  const entries = useLiveQuery(
    () => db.mealPlan.where('date').between(days[0], days[6], true, true).toArray(),
    [days[0], days[6]],
  )
  const recipes = useLiveQuery(() => db.recipes.toArray(), [])

  const recipeName = (id?: number) =>
    id !== undefined ? recipes?.find((r) => r.id === id)?.name : undefined

  function entryFor(date: string, slot: MealPlanEntry['slot']) {
    return entries?.find((e) => e.date === date && e.slot === slot)
  }

  async function addWeekToShopping() {
    const planned = (entries ?? []).filter((e) => e.recipeId !== undefined)
    const ids = [...new Set(planned.map((e) => e.recipeId!))]
    let added = 0
    for (const id of ids) {
      const recipe = recipes?.find((r) => r.id === id)
      if (recipe) added += await addIngredientsToShopping(recipe)
    }
    setMessage(
      ids.length === 0
        ? 'No recipes planned this week yet.'
        : added === 0
          ? 'Everything is already on the shopping list.'
          : `Added ${added} ingredient${added === 1 ? '' : 's'} to Shopping.`,
    )
  }

  async function newRecipe() {
    const now = Date.now()
    const id = await db.recipes.add({
      name: '',
      ingredients: [],
      createdAt: now,
      updatedAt: now,
    })
    navigate(`/apps/meals/recipes/${id}`)
  }

  const sortedRecipes = (recipes ?? [])
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <>
      <div className="nav-header">
        <Link to="/apps" className="back-link">
          <ChevronLeft aria-hidden /> Apps
        </Link>
      </div>
      <h1 className="screen-title">Meals & Recipes</h1>
      <p className="screen-sub">Plan the week, keep the recipes, skip the “what’s for dinner”.</p>

      <div className="chip-row seg-row">
        <button
          className={`chip${view === 'plan' ? ' active' : ''}`}
          onClick={() => setView('plan')}
        >
          This week
        </button>
        <button
          className={`chip${view === 'recipes' ? ' active' : ''}`}
          onClick={() => setView('recipes')}
        >
          Recipes{recipes && recipes.length > 0 ? ` (${recipes.length})` : ''}
        </button>
      </div>

      {view === 'plan' && (
        <>
          <div className="week-nav">
            <button
              className="icon-btn"
              aria-label="Previous week"
              onClick={() => setWeekOffset((w) => w - 1)}
            >
              <ChevronLeft aria-hidden />
            </button>
            <button
              className="week-label"
              onClick={() => setWeekOffset(0)}
              title="Jump to this week"
            >
              {weekOffset === 0 ? 'This week' : weekLabel(start)}
              <span className="week-sub">{weekLabel(start)}</span>
            </button>
            <button
              className="icon-btn"
              aria-label="Next week"
              onClick={() => setWeekOffset((w) => w + 1)}
            >
              <ChevronRight aria-hidden />
            </button>
          </div>

          <button className="btn secondary" onClick={() => void addWeekToShopping()}>
            <ShoppingCart aria-hidden /> Add week’s ingredients to Shopping
          </button>
          {message && <p className="settings-message">{message}</p>}

          <div className="stack" style={{ marginTop: 14 }}>
            {days.map((date) => {
              const d = parse(date)
              const isToday = date === today
              return (
                <div key={date} className={`card day-card${isToday ? ' today' : ''}`}>
                  <div className="day-head">
                    <span className="day-name">
                      {d.toLocaleDateString(undefined, { weekday: 'long' })}
                    </span>
                    <span className="day-date">
                      {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      {isToday && <span className="today-pill">Today</span>}
                    </span>
                  </div>
                  {SLOTS.map((slot) => {
                    const entry = entryFor(date, slot)
                    const label = entry
                      ? (entry.text ?? recipeName(entry.recipeId) ?? '…')
                      : undefined
                    return (
                      <button
                        key={slot}
                        className={`slot-row${entry ? ' filled' : ''}`}
                        onClick={() => setEditingSlot({ date, slot, entry })}
                      >
                        <span className="slot-name">{SLOT_LABELS[slot]}</span>
                        {label ? (
                          <span className="slot-value">{label}</span>
                        ) : (
                          <span className="slot-empty">
                            <Plus aria-hidden /> Add
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </>
      )}

      {view === 'recipes' && (
        <>
          <button className="btn secondary" onClick={() => void newRecipe()}>
            <ChefHat aria-hidden /> New recipe
          </button>

          {recipes && recipes.length === 0 && (
            <div className="empty">
              <BookOpen aria-hidden />
              <div className="empty-title">Your recipe box is empty</div>
              <p>
                Add your first recipe — or move one over from your Brain Dump
                inbox.
              </p>
            </div>
          )}

          <div className="stack" style={{ marginTop: 14 }}>
            {sortedRecipes.map((r) => (
              <button
                key={r.id}
                className="card dump-item tappable"
                onClick={() => navigate(`/apps/meals/recipes/${r.id}`)}
              >
                <div className="dump-body">
                  <div className="tile-name">{r.name || 'Untitled recipe'}</div>
                  <div className="tile-sub">
                    {r.ingredients.length} ingredient
                    {r.ingredients.length === 1 ? '' : 's'}
                  </div>
                  <div className="dump-time">{relativeTime(r.updatedAt)}</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {editingSlot && (
        <MealSheet
          date={editingSlot.date}
          slot={editingSlot.slot}
          entry={editingSlot.entry}
          onClose={() => setEditingSlot(null)}
        />
      )}
    </>
  )
}
