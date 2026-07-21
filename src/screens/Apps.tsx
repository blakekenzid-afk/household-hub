import { Link } from 'react-router-dom'
import { APPS } from '../apps-data'

export default function Apps() {
  return (
    <>
      <h1 className="screen-title">Apps</h1>
      <p className="screen-sub">Your household tools.</p>

      <div className="tile-grid">
        {APPS.map((app) => {
          const Icon = app.icon
          const soon = !app.route
          return (
            <Link
              key={app.id}
              to={app.route ?? `/apps/soon/${app.id}`}
              className={`card tile tappable${soon ? ' soon' : ''}`}
              style={{ '--tile-color': app.color } as React.CSSProperties}
            >
              <div className="tile-icon">
                <Icon aria-hidden />
              </div>
              <div className="tile-text">
                <div className="tile-name">{app.name}</div>
                <div className="tile-sub">{app.subtitle}</div>
              </div>
              {app.phase && <span className="phase-pill">{app.phase}</span>}
            </Link>
          )
        })}
      </div>
    </>
  )
}
