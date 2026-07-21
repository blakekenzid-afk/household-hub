import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ShoppingCart, Trash2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addIngredientsToShopping, db } from '../db'

export default function RecipeEditor() {
  const navigate = useNavigate()
  const { recipeId } = useParams()
  const id = Number(recipeId)

  const fetched = useLiveQuery(
    async () => ({ recipe: await db.recipes.get(id) }),
    [id],
  )
  const recipe = fetched?.recipe

  const [loaded, setLoaded] = useState(false)
  const [name, setName] = useState('')
  const [ingredientsText, setIngredientsText] = useState('')
  const [steps, setSteps] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (recipe && !loaded) {
      setName(recipe.name)
      setIngredientsText(recipe.ingredients.join('\n'))
      setSteps(recipe.steps ?? '')
      setLoaded(true)
    }
  }, [recipe, loaded])

  const parsedIngredients = ingredientsText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  useEffect(() => {
    if (!loaded || !recipe) return
    const changed =
      name !== recipe.name ||
      JSON.stringify(parsedIngredients) !== JSON.stringify(recipe.ingredients) ||
      steps !== (recipe.steps ?? '')
    if (!changed) return
    const t = window.setTimeout(() => {
      void db.recipes.update(id, {
        name,
        ingredients: parsedIngredients,
        steps: steps.trim() || undefined,
        updatedAt: Date.now(),
      })
    }, 250)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, ingredientsText, steps, recipe, loaded])

  async function goBack() {
    const empty = !name.trim() && parsedIngredients.length === 0 && !steps.trim()
    if (empty) await db.recipes.delete(id)
    navigate('/apps/meals')
  }

  async function remove() {
    if (!window.confirm('Delete this recipe? Planned meals using it lose their link.')) return
    await db.recipes.delete(id)
    navigate('/apps/meals')
  }

  async function toShopping() {
    if (!recipe) return
    const added = await addIngredientsToShopping({
      ...recipe,
      name,
      ingredients: parsedIngredients,
    })
    setMessage(
      added === 0
        ? 'Everything is already on the shopping list.'
        : `Added ${added} ingredient${added === 1 ? '' : 's'} to Shopping.`,
    )
  }

  if (fetched === undefined) return null
  if (!recipe && !loaded) {
    return (
      <div className="empty">
        <p>This recipe doesn’t exist anymore.</p>
      </div>
    )
  }

  return (
    <>
      <div className="nav-header editor-header">
        <button className="back-link as-button" onClick={() => void goBack()}>
          <ChevronLeft aria-hidden /> Meals
        </button>
        <div className="editor-actions">
          <button className="icon-btn" aria-label="Delete recipe" onClick={() => void remove()}>
            <Trash2 aria-hidden />
          </button>
        </div>
      </div>

      <input
        className="editor-title"
        placeholder="Recipe name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div className="sheet-label">Ingredients — one per line</div>
      <textarea
        className="capture-input recipe-ingredients"
        placeholder={'2 lbs chicken thighs\n1 jar salsa verde\n…'}
        value={ingredientsText}
        onChange={(e) => setIngredientsText(e.target.value)}
      />

      <button
        className="btn secondary"
        disabled={parsedIngredients.length === 0}
        onClick={() => void toShopping()}
      >
        <ShoppingCart aria-hidden /> Add ingredients to Shopping
      </button>
      {message && <p className="settings-message">{message}</p>}

      <div className="sheet-label">Steps</div>
      <textarea
        className="editor-body recipe-steps"
        placeholder="How it comes together…"
        value={steps}
        onChange={(e) => setSteps(e.target.value)}
      />
    </>
  )
}
