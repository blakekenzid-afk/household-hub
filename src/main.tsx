import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import Today from './screens/Today'
import Apps from './screens/Apps'
import BrainDump from './screens/BrainDump'
import Tasks from './screens/Tasks'
import Notes from './screens/Notes'
import NoteEditor from './screens/NoteEditor'
import Meals from './screens/Meals'
import RecipeEditor from './screens/RecipeEditor'
import Shopping from './screens/Shopping'
import Calendar from './screens/Calendar'
import Finance from './screens/Finance'
import Inventory from './screens/Inventory'
import ComingSoon from './screens/ComingSoon'
import Settings from './screens/Settings'
import './styles.css'
// Registers the sync change-tracking hooks before any screen touches the
// database, and wires up the background sync triggers.
import './sync'

// Apply saved theme before first paint to avoid a flash
const savedTheme = localStorage.getItem('hh-theme')
if (savedTheme === 'light' || savedTheme === 'dark') {
  document.documentElement.dataset.theme = savedTheme
}

const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Today /> },
      { path: 'apps', element: <Apps /> },
      { path: 'apps/brain-dump', element: <BrainDump /> },
      { path: 'apps/tasks', element: <Tasks /> },
      { path: 'apps/notes', element: <Notes /> },
      { path: 'apps/notes/:noteId', element: <NoteEditor /> },
      { path: 'apps/meals', element: <Meals /> },
      { path: 'apps/meals/recipes/:recipeId', element: <RecipeEditor /> },
      { path: 'apps/shopping', element: <Shopping /> },
      { path: 'apps/calendar', element: <Calendar /> },
      { path: 'apps/finance', element: <Finance /> },
      { path: 'apps/inventory', element: <Inventory /> },
      { path: 'apps/soon/:appId', element: <ComingSoon /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
