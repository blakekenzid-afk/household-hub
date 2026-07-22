// send-reminders: invoked by pg_cron every ~5 min. For each user with push
// subscriptions, finds tasks/events whose reminder is due in this window and
// delivers a Web Push notification, deduping via reminder_log so each fires
// once. Times are stored as local wall-clock, so we compare in the user's tz.

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:blakekenzid@gmail.com'
const APP_URL = 'https://blakekenzid-afk.github.io/household-hub/'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

// Fire a reminder if its local fire-time is at or just behind "now". The
// dedupe log means a generous window can't double-send; it only lets a
// missed cron tick catch up.
const GRACE_MS = 15 * 60 * 1000

type Rec = { uuid: string; user_id: string; data: Record<string, unknown> }
type Sub = { id: string; endpoint: string; p256dh: string; auth: string; timezone: string | null }

const pad = (n: number) => String(n).padStart(2, '0')

/** Wall-clock components of a UTC instant, rendered in the given IANA tz. */
function localParts(now: Date, tz: string) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const p: Record<string, string> = {}
  for (const part of f.formatToParts(now)) p[part.type] = part.value
  // Some runtimes emit hour "24" for local midnight; normalize to 0.
  const h = p.hour === '24' ? 0 : +p.hour
  return { date: `${p.year}-${p.month}-${p.day}`, y: +p.year, mo: +p.month, d: +p.day, h, mi: +p.minute }
}

/** A wall-clock (local) datetime as a comparable pseudo-UTC ms value. */
function wallMs(dateStr: string, timeStr: string): number {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const [h, mi] = timeStr.split(':').map(Number)
  return Date.UTC(y, mo - 1, d, h, mi)
}

function addDaysStr(dateStr: string, n: number): string {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, mo - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

/** Does a repeating event occur on `target`? (event stored once from `start`.) */
function occursOn(start: string, repeat: string, target: string): boolean {
  if (target < start) return false
  if (repeat === 'none' || !repeat) return start === target
  const [sy, sm, sd] = start.split('-').map(Number)
  const [ty, tm, td] = target.split('-').map(Number)
  if (repeat === 'daily') return true
  if (repeat === 'weekly') {
    const a = Date.UTC(sy, sm - 1, sd)
    const b = Date.UTC(ty, tm - 1, td)
    return Math.round((b - a) / 86400000) % 7 === 0
  }
  if (repeat === 'monthly') return sd === td
  if (repeat === 'yearly') return sm === tm && sd === td
  return false
}

interface Fire {
  fireKey: string
  fireMs: number
  title: string
  body: string
  url: string
}

serve_handler()

function serve_handler() {
  Deno.serve(async (req) => {
    if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
      return new Response('forbidden', { status: 403 })
    }
    const db = createClient(SUPABASE_URL, SERVICE_ROLE)
    const now = new Date()
    const nowMs = now.getTime()

    const { data: subsRaw } = await db
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth, timezone')
    const subsByUser = new Map<string, { tz: string; subs: Sub[] }>()
    for (const s of subsRaw ?? []) {
      const entry = subsByUser.get(s.user_id) ?? { tz: s.timezone ?? 'UTC', subs: [] }
      if (s.timezone) entry.tz = s.timezone
      entry.subs.push(s)
      subsByUser.set(s.user_id, entry)
    }
    if (subsByUser.size === 0) return json({ ok: true, users: 0, sent: 0 })

    const { data: recs } = await db
      .from('records')
      .select('uuid, user_id, data, tbl')
      .in('tbl', ['tasks', 'events'])
      .eq('deleted', false)
    const recsByUser = new Map<string, { tasks: Rec[]; events: Rec[] }>()
    for (const r of recs ?? []) {
      const e = recsByUser.get(r.user_id) ?? { tasks: [], events: [] }
      if (r.tbl === 'tasks') e.tasks.push(r)
      else e.events.push(r)
      recsByUser.set(r.user_id, e)
    }

    let sent = 0
    for (const [userId, { tz, subs }] of subsByUser) {
      const recsFor = recsByUser.get(userId)
      if (!recsFor) continue
      const ln = localParts(now, tz)
      const fires: Fire[] = []

      // Tasks: single occurrence at dueDate/dueTime, minus the lead.
      for (const t of recsFor.tasks) {
        const d = t.data
        if (d.status !== 'open') continue
        const dueDate = d.dueDate as string | undefined
        const dueTime = d.dueTime as string | undefined
        const lead = d.reminderLead as number | undefined
        if (!dueDate || !dueTime || lead == null) continue
        const fireMs = wallMs(dueDate, dueTime) - lead * 60000
        fires.push({
          fireKey: `task:${t.uuid}:${dueDate}T${dueTime}`,
          fireMs,
          title: (d.title as string) || 'Task',
          body: lead === 0 ? 'Due now' : `Due at ${fmt12(dueTime)}`,
          url: `${APP_URL}#/apps/tasks`,
        })
      }

      // Events: expand today's and yesterday's occurrences (covers leads that
      // cross local midnight), minus the lead.
      for (const ev of recsFor.events) {
        const d = ev.data
        if (d.allDay || !d.startTime) continue
        const start = d.date as string | undefined
        const startTime = d.startTime as string | undefined
        const lead = (d.reminderLead as number | undefined) ?? undefined
        if (!start || !startTime || lead == null) continue
        const repeat = (d.repeat as string) ?? 'none'
        for (const target of [ln.date, addDaysStr(ln.date, -1)]) {
          if (!occursOn(start, repeat, target)) continue
          const fireMs = wallMs(target, startTime) - lead * 60000
          fires.push({
            fireKey: `event:${ev.uuid}:${target}T${startTime}`,
            fireMs,
            title: (d.title as string) || 'Event',
            body: lead === 0 ? 'Starting now' : `Starts at ${fmt12(startTime)}`,
            url: `${APP_URL}#/apps/calendar`,
          })
        }
      }

      const nowLocalMs = Date.UTC(ln.y, ln.mo - 1, ln.d, ln.h, ln.mi)
      for (const f of fires) {
        if (!(f.fireMs <= nowLocalMs && nowLocalMs - f.fireMs < GRACE_MS)) continue
        // Dedupe: only proceed if we can claim the fire_key.
        const { error: claimErr } = await db
          .from('reminder_log')
          .insert({ fire_key: f.fireKey, user_id: userId })
        if (claimErr) continue // already sent (pk conflict) or write failed
        const payload = JSON.stringify({ title: f.title, body: f.body, url: f.url })
        for (const s of subs) {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              payload,
            )
            sent++
          } catch (err) {
            const code = (err as { statusCode?: number }).statusCode
            if (code === 404 || code === 410) {
              await db.from('push_subscriptions').delete().eq('id', s.id)
            }
          }
        }
      }
    }
    return json({ ok: true, users: subsByUser.size, sent, at: now.toISOString(), nowMs })
  })
}

function fmt12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const ap = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${pad(m)} ${ap}`
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
}
