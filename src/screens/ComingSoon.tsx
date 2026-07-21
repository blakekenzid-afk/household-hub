import { Link, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { APPS } from '../apps-data'

export default function ComingSoon() {
  const { appId } = useParams()
  const app = APPS.find((a) => a.id === appId)

  if (!app) {
    return (
      <div className="empty">
        <p>That app doesn’t exist.</p>
      </div>
    )
  }

  const Icon = app.icon

  return (
    <>
      <div className="nav-header">
        <Link to="/apps" className="back-link">
          <ChevronLeft aria-hidden /> Apps
        </Link>
      </div>
      <div className="empty" style={{ '--tile-color': app.color } as React.CSSProperties}>
        <div className="tile-icon large">
          <Icon aria-hidden />
        </div>
        <div className="empty-title">{app.name}</div>
        <p className="phase-note">{app.phase}</p>
        <p>{app.soon}</p>
      </div>
    </>
  )
}
