import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import Today from './screens/Today'
import Apps from './screens/Apps'
import BrainDump from './screens/BrainDump'
import ComingSoon from './screens/ComingSoon'
import Settings from './screens/Settings'
import './styles.css'

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
