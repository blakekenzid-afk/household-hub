import { useRef, useState } from 'react'
import { CloudOff, Download, Upload } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, exportBackup, importBackup, type BackupFile } from '../db'

type Theme = 'system' | 'light' | 'dark'

function currentTheme(): Theme {
  const t = localStorage.getItem('hh-theme')
  return t === 'light' || t === 'dark' ? t : 'system'
}

export default function Settings() {
  const [theme, setTheme] = useState<Theme>(currentTheme)
  const [message, setMessage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const itemCount = useLiveQuery(
    async () =>
      (await db.brainDump.count()) +
      (await db.tasks.count()) +
      (await db.notes.count()) +
      (await db.folders.count()) +
      (await db.recipes.count()) +
      (await db.mealPlan.count()) +
      (await db.shopping.count()),
    [],
    0,
  )

  function applyTheme(t: Theme) {
    setTheme(t)
    if (t === 'system') {
      localStorage.removeItem('hh-theme')
      delete document.documentElement.dataset.theme
    } else {
      localStorage.setItem('hh-theme', t)
      document.documentElement.dataset.theme = t
    }
  }

  async function handleExport() {
    const data = await exportBackup()
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `household-hub-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMessage('Backup downloaded.')
  }

  async function handleImport(file: File) {
    try {
      const data = JSON.parse(await file.text()) as BackupFile
      if (
        !window.confirm(
          'Importing replaces everything currently in the app with the backup. Continue?',
        )
      ) {
        return
      }
      await importBackup(data)
      setMessage('Backup restored.')
    } catch {
      setMessage("That file isn't a Household Hub backup.")
    }
  }

  return (
    <>
      <h1 className="screen-title">Settings</h1>
      <p className="screen-sub">Household Hub</p>

      <div className="section-label">Appearance</div>
      <div className="chip-row">
        {(['system', 'light', 'dark'] as Theme[]).map((t) => (
          <button
            key={t}
            className={`chip${theme === t ? ' active' : ''}`}
            onClick={() => applyTheme(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="section-label">Your data</div>
      <div className="row-group">
        <button className="row" onClick={() => void handleExport()}>
          <Download aria-hidden />
          Export backup
          <span className="row-value">{itemCount} items</span>
        </button>
        <button className="row" onClick={() => fileRef.current?.click()}>
          <Upload aria-hidden />
          Import backup
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleImport(file)
          e.target.value = ''
        }}
      />
      {message && <p className="settings-message">{message}</p>}

      <div className="section-label">Sync</div>
      <div className="card">
        <div className="card-row">
          <CloudOff className="sync-icon" aria-hidden />
          <div className="card-row-text">
            <div className="tile-name">Local-only for now</div>
            <div className="tile-sub">
              Everything is stored privately on this device. Cross-device sync
              arrives in a later phase — until then, use Export/Import to move
              your data between devices.
            </div>
          </div>
        </div>
      </div>

      <div className="section-label">About</div>
      <div className="card">
        <div className="tile-sub">Household Hub · Phase 4 · v0.4.0</div>
      </div>
    </>
  )
}
