import { writable } from 'svelte/store'

export type NotificationType = 'info' | 'warning' | 'error'

export interface Notification {
  id: number
  message: string
  type: NotificationType
  closing?: boolean
}

function createNotificationStore() {
  const { subscribe, update } = writable<Notification[]>([])
  let nextId = 0

  return {
    subscribe,
    show: (message: string, type: NotificationType = 'info', duration = 3000) => {
      const id = nextId++
      const notification: Notification = { id, message, type }

      update(notifications => [...notifications, notification])

      if (duration > 0) {
        setTimeout(() => {
          update(notifications =>
            notifications.map(n =>
              n.id === id ? { ...n, closing: true } : n
            )
          )
          setTimeout(() => {
            update(notifications => notifications.filter(n => n.id !== id))
          }, 300)
        }, duration)
      }
    },
    hide: (id: number) => {
      update(notifications =>
        notifications.map(n =>
          n.id === id ? { ...n, closing: true } : n
        )
      )
      setTimeout(() => {
        update(notifications => notifications.filter(n => n.id !== id))
      }, 300)
    },
    clear: () => {
      update(() => [])
    }
  }
}

export const notifications = createNotificationStore()
