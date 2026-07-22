import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Bell, BellOff, Cloud, CloudOff, Download, Trash2, Upload } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Session } from '@supabase/supabase-js'
import {
  db,
  eraseAllLocalData,
  exportBackup,
  importBackup,
  type BackupFile,
} from '../db'
import { supabase } from '../supabase'
import { getSyncStatus, subscribeSyncStatus, syncNow } from '../sync'
import { disablePush, enablePush, getPushState, pushSupported, type PushState } from '../push'

type Theme = 'system' | 'light' | 'dark'

function currentTheme(): Theme {
  const t = localStorage.getItem('hh-theme')
  return t === 'light' || t === 'dark' ? t : 'system'
}

function formatWhen(ts: number): string {
  const d = new Date(ts)
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function SyncSection() {
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [authMsg, setAuthMsg] = useState('')
  const status = useSyncExternalStore(subscribeSyncStatus, getSyncStatus)
  const pending = useLiveQuery(() => db.outbox.count(), [], 0)
  const lastSyncAt = useLiveQuery(() => db.meta.get('lastSyncAt'), [])?.value

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setAuthMsg('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) {
      setAuthMsg(error.message)
    } else {
      setEmail('')
      setPassword('')
    }
  }

  async function handleSignUp() {
    if (!email || !password) {
      setAuthMsg('Enter an email and a password (8+ characters) first.')
      return
    }
    setBusy(true)
    setAuthMsg('')
    const { data, error } = await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (error) {
      setAuthMsg(error.message)
    } else if (!data.session) {
      setAuthMsg('Account created — check your email for a confirmation link, then sign in here.')
    }
  }

  if (!session) {
    return (
      <div className="card">
        <div className="card-row">
          <CloudOff className="sync-icon" aria-hidden />
          <div className="card-row-text">
            <div className="tile-name">Sync is off</div>
            <div className="tile-sub">
              Sign in to back up your data and keep your phone and computer up
              to date. First time? Create an account with any email and
              password.
            </div>
          </div>
        </div>
        <form className="sync-form" onSubmit={(e) => void handleSignIn(e)}>
          <input
            className="sheet-input"
            type="email"
            placeholder="Email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="sheet-input"
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="sync-btn-row">
            <button className="btn" type="submit" disabled={busy}>
              Sign in
            </button>
            <button
              className="btn secondary"
              type="button"
              disabled={busy}
              onClick={() => void handleSignUp()}
            >
              Create account
            </button>
          </div>
        </form>
        {authMsg && <p className="settings-message">{authMsg}</p>}
      </div>
    )
  }

  const statusLine =
    status.state === 'syncing'
      ? 'Syncing…'
      : status.state === 'error'
        ? `Sync error: ${status.error}`
        : lastSyncAt
          ? `Last synced ${formatWhen(lastSyncAt)}${pending ? ` · ${pending} pending` : ''}`
          : 'Not synced yet'

  return (
    <div className="card">
      <div className="card-row">
        <Cloud className="sync-icon" aria-hidden />
        <div className="card-row-text">
          <div className="tile-name">{session.user.email}</div>
          <div className="tile-sub">{statusLine}</div>
        </div>
      </div>
      <div className="sync-btn-row">
        <button
          className="btn"
          disabled={status.state === 'syncing'}
          onClick={() => void syncNow()}
        >
          Sync now
        </button>
        <button className="btn secondary" onClick={() => void supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    </div>
  )
}

function ReminderSection() {
  const [session, setSession] = useState<Session | null>(null)
  const [state, setState] = useState<PushState | 'loading'>('loading')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    void getPushState().then(setState)
  }, [session])

  async function toggle() {
    setBusy(true)
    setMsg('')
    if (state === 'on') {
      await disablePush()
      setState('off')
    } else {
      const res = await enablePush()
      if (res.ok) {
        setMsg('Reminders are on for this device.')
      } else if (res.reason === 'blocked') {
        setMsg('Notifications are blocked in your browser settings — allow them there, then try again.')
      } else if (res.reason === 'signed-out') {
        setMsg('Sign in above first, then turn on reminders.')
      } else if (res.reason === 'dismissed') {
        setMsg('Permission was dismissed. Tap Enable and choose Allow.')
      } else {
        setMsg(`Couldn’t enable reminders: ${res.reason}`)
      }
      await getPushState().then(setState)
    }
    setBusy(false)
  }

  if (!pushSupported()) {
    return (
      <div className="card">
        <div className="tile-sub">
          This browser doesn’t support notifications. On iPhone, add the app to your Home
          Screen first, then reopen it here.
        </div>
      </div>
    )
  }

  const on = state === 'on'
  return (
    <div className="card">
      <div className="card-row">
        {on ? <Bell className="sync-icon" aria-hidden /> : <BellOff className="sync-icon" aria-hidden />}
        <div className="card-row-text">
          <div className="tile-name">{on ? 'Reminders are on' : 'Reminders are off'}</div>
          <div className="tile-sub">
            {!session
              ? 'Sign in above, then turn this on to be notified even when the app is closed.'
              : 'Get notified for timed tasks and events — even when the app is closed.'}
          </div>
        </div>
      </div>
      <button
        className="btn"
        disabled={busy || state === 'loading' || (!session && !on)}
        onClick={() => void toggle()}
      >
        {on ? 'Turn off reminders' : 'Enable reminders'}
      </button>
      {msg && <p className="settings-message">{msg}</p>}
    </div>
  )
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
      void syncNow()
    } catch {
      setMessage("That file isn't a Household Hub backup.")
    }
  }

  async function handleErase() {
    if (
      !window.confirm(
        "Erase everything stored on this device? If you're signed in, your synced data will download again. Otherwise this cannot be undone.",
      )
    ) {
      return
    }
    await eraseAllLocalData()
    setMessage('Local data erased.')
    void syncNow()
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

      <div className="section-label">Sync</div>
      <SyncSection />

      <div className="section-label">Reminders</div>
      <ReminderSection />

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
        <button className="row danger" onClick={() => void handleErase()}>
          <Trash2 aria-hidden />
          Erase local data
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

      <div className="section-label">About</div>
      <div className="card">
        <div className="tile-sub">Household Hub · Push reminders · v0.9.0</div>
      </div>
    </>
  )
}
