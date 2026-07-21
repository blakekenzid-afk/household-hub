import { NavLink } from 'react-router-dom'
import { Brain, House, LayoutGrid, Plus, Settings } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

export default function TabBar({ onCapture }: { onCapture: () => void }) {
  const inboxCount = useLiveQuery(
    () => db.brainDump.where('status').equals('inbox').count(),
    [],
    0,
  )

  return (
    <nav className="tabbar">
      <NavLink to="/" end className="tab">
        <House aria-hidden />
        <span>Today</span>
      </NavLink>
      <NavLink to="/apps" end className="tab">
        <LayoutGrid aria-hidden />
        <span>Apps</span>
      </NavLink>
      <button className="capture-btn" onClick={onCapture} aria-label="Quick capture">
        <Plus aria-hidden />
      </button>
      <NavLink to="/apps/brain-dump" className="tab">
        <Brain aria-hidden />
        <span>Inbox</span>
        {inboxCount > 0 && <span className="badge">{inboxCount}</span>}
      </NavLink>
      <NavLink to="/settings" className="tab">
        <Settings aria-hidden />
        <span>Settings</span>
      </NavLink>
    </nav>
  )
}
