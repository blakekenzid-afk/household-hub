// Push handlers, imported into the generated Workbox service worker via
// vite-plugin-pwa's workbox.importScripts. Kept as a plain JS file (not
// bundled) so it can layer onto the auto-generated SW without switching
// the whole PWA to injectManifest.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Household Hub'
  const url = data.url || '/household-hub/'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/household-hub/pwa-192.png',
      badge: '/household-hub/pwa-192.png',
      tag: title + '|' + (data.body || ''),
      data: { url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/household-hub/'
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of all) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) {
            try {
              await client.navigate(url)
            } catch (e) {
              /* cross-origin or not allowed; ignore */
            }
          }
          return
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})
