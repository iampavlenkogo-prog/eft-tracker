import api from '../api/axios'

export async function subscribeToPush(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

  try {
    const { data } = await api.get('/push/vapid-public-key')
    const vapidPublicKey: string = data.publicKey
    if (!vapidPublicKey) return

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    const registration = await navigator.serviceWorker.ready
    const existing = await registration.pushManager.getSubscription()
    if (existing) {
      await api.post('/push/subscribe', existing.toJSON()).catch(() => {})
      return
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })

    await api.post('/push/subscribe', subscription.toJSON())
  } catch (err) {
    console.warn('[push] subscribe failed:', err)
  }
}

export function updateAppBadge(count: number): void {
  if ('setAppBadge' in navigator) {
    if (count > 0) (navigator as any).setAppBadge(count)
    else (navigator as any).clearAppBadge()
  }
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr.buffer as ArrayBuffer
}
