import { useNavigate } from 'react-router-dom'
import { Brain, ChefHat, ChevronRight, SquareCheckBig } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

export default function Today() {
  const navigate = useNavigate()
  const inboxCount = useLiveQuery(
    () => db.brainDump.where('status').equals('inbox').count(),
    [],
    0,
  )

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <>
      <h1 className="screen-title">{greeting}</h1>
      <p className="screen-sub">{dateLabel}</p>

      <div className="section-label">Your inbox</div>
      <div
        className="card tappable"
        role="button"
        tabIndex={0}
        onClick={() => navigate('/apps/brain-dump')}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/apps/brain-dump')}
      >
        <div className="card-row">
          <div className="tile-icon" style={{ '--tile-color': '#7C3AED' } as React.CSSProperties}>
            <Brain aria-hidden />
          </div>
          <div className="card-row-text">
            <div className="tile-name">Brain Dump</div>
            <div className="tile-sub">
              {inboxCount === 0
                ? 'Inbox zero — nothing waiting to be sorted.'
                : `${inboxCount} thought${inboxCount === 1 ? '' : 's'} waiting to be sorted`}
            </div>
          </div>
          <ChevronRight className="chevron" aria-hidden />
        </div>
      </div>

      <div className="section-label">Coming up</div>
      <div className="stack">
        <div className="card muted">
          <div className="card-row">
            <div className="tile-icon" style={{ '--tile-color': '#2563EB' } as React.CSSProperties}>
              <SquareCheckBig aria-hidden />
            </div>
            <div className="card-row-text">
              <div className="tile-name">Today’s tasks</div>
              <div className="tile-sub">Your to-dos will show up here — Phase 2.</div>
            </div>
          </div>
        </div>
        <div className="card muted">
          <div className="card-row">
            <div className="tile-icon" style={{ '--tile-color': '#16A34A' } as React.CSSProperties}>
              <ChefHat aria-hidden />
            </div>
            <div className="card-row-text">
              <div className="tile-name">Tonight’s dinner</div>
              <div className="tile-sub">Your meal plan will show up here — Phase 4.</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
