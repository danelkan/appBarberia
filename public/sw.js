self.addEventListener('push', event => {
  const fallback = {
    title: 'Felito Barber Studio',
    body: 'Tenés una novedad en la agenda.',
    url: '/admin/agenda',
    tag: 'felito-notification',
  }

  let data = fallback
  try {
    data = event.data ? event.data.json() : fallback
  } catch {
    data = fallback
  }
  const title = data.title || fallback.title
  const options = {
    body: data.body || fallback.body,
    icon: '/icon-192.png',
    badge: '/favicon.svg',
    tag: data.tag || fallback.tag,
    data: {
      url: data.url || fallback.url,
    },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/admin/agenda'

  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find(client => 'focus' in client && client.url.includes('/admin'))
    if (existing) {
      await existing.focus()
      return existing.navigate(url)
    }
    return clients.openWindow(url)
  })())
})
