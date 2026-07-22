import { supabase } from './supabase'

// Web Push (Stage 2). The public VAPID key is safe to ship; its private
// half lives only in the Supabase Edge Function that sends the pushes.
const VAPID_PUBLIC_KEY =
  'BCKTEHMQfB6ecng3KR4H8y3LbQt1t73ia6M1QS2FARIylckyAgOXzlJ0s4X5TIHzK2E3pHyDRJteyUO-7wjdwQI'

export function pushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export type PushState = 'unsupported' | 'blocked' | 'off' | 'on'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.ready)
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  const reg = await registration()
  const sub = reg ? await reg.pushManager.getSubscription() : null
  return sub ? 'on' : 'off'
}

/** Ask for permission, subscribe, and store the subscription for this user. */
export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'signed-out' }

  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return { ok: false, reason: perm === 'denied' ? 'blocked' : 'dismissed' }

  const reg = await registration()
  if (!reg) return { ok: false, reason: 'no-service-worker' }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
  })
  const json = sub.toJSON()
  if (!json.keys) return { ok: false, reason: 'no-keys' }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      endpoint: sub.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    { onConflict: 'endpoint' },
  )
  if (error) return { ok: false, reason: error.message }
  return { ok: true }
}

/** Unsubscribe this device and forget its stored subscription. */
export async function disablePush(): Promise<void> {
  const reg = await registration()
  const sub = reg ? await reg.pushManager.getSubscription() : null
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
