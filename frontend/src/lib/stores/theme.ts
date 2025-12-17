import { writable } from 'svelte/store'
import { browser } from '$app/environment'

type Theme = 'light' | 'dark'

// Get initial theme from localStorage or default to light
function getInitialTheme(): Theme {
  if (!browser) return 'light'
  
  const stored = localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark') {
    return stored
  }
  
  // Check system preference
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  
  return 'light'
}

function createThemeStore() {
  const { subscribe, set, update } = writable<Theme>(getInitialTheme())

  return {
    subscribe,
    set: (value: Theme) => {
      if (browser) {
        localStorage.setItem('theme', value)
        document.documentElement.setAttribute('data-theme', value)
      }
      set(value)
    },
    toggle: () => {
      update(current => {
        const newTheme = current === 'dark' ? 'light' : 'dark'
        if (browser) {
          localStorage.setItem('theme', newTheme)
          document.documentElement.setAttribute('data-theme', newTheme)
        }
        return newTheme
      })
    },
    init: () => {
      if (browser) {
        const theme = getInitialTheme()
        document.documentElement.setAttribute('data-theme', theme)
        set(theme)
      }
    }
  }
}

export const theme = createThemeStore()
