import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import TabBar from './components/TabBar'
import CaptureSheet from './components/CaptureSheet'

export default function App() {
  const [capturing, setCapturing] = useState(false)

  return (
    <div className="app">
      <main className="screen">
        <Outlet />
      </main>
      <TabBar onCapture={() => setCapturing(true)} />
      {capturing && <CaptureSheet onClose={() => setCapturing(false)} />}
    </div>
  )
}
