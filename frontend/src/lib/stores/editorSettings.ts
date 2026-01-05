import { writable } from 'svelte/store'
import { browser } from '$app/environment'

export interface EditorSettings {
  fontSize: number
  fontFamily: string
}

const DEFAULT_SETTINGS: EditorSettings = {
  fontSize: 13,
  fontFamily: '"JetBrains Mono", monospace'
}

// Get initial settings from localStorage or default values
function getInitialSettings(): EditorSettings {
  if (!browser) return DEFAULT_SETTINGS
  
  try {
    const stored = localStorage.getItem('editorSettings')
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        fontSize: typeof parsed.fontSize === 'number' ? parsed.fontSize : DEFAULT_SETTINGS.fontSize,
        fontFamily: typeof parsed.fontFamily === 'string' ? parsed.fontFamily : DEFAULT_SETTINGS.fontFamily
      }
    }
  } catch (error) {
    console.error('Failed to parse editor settings from localStorage:', error)
  }
  
  return DEFAULT_SETTINGS
}

function createEditorSettingsStore() {
  const { subscribe, set, update } = writable<EditorSettings>(getInitialSettings())

  return {
    subscribe,
    set: (value: EditorSettings) => {
      if (browser) {
        localStorage.setItem('editorSettings', JSON.stringify(value))
      }
      set(value)
    },
    update: (updater: (current: EditorSettings) => EditorSettings) => {
      update(current => {
        const newSettings = updater(current)
        if (browser) {
          localStorage.setItem('editorSettings', JSON.stringify(newSettings))
        }
        return newSettings
      })
    },
    setFontSize: (fontSize: number) => {
      update(current => {
        const newSettings = { ...current, fontSize }
        if (browser) {
          localStorage.setItem('editorSettings', JSON.stringify(newSettings))
        }
        return newSettings
      })
    },
    setFontFamily: (fontFamily: string) => {
      update(current => {
        const newSettings = { ...current, fontFamily }
        if (browser) {
          localStorage.setItem('editorSettings', JSON.stringify(newSettings))
        }
        return newSettings
      })
    },
    resetFontSize: () => {
      update(current => {
        const newSettings = { ...current, fontSize: DEFAULT_SETTINGS.fontSize }
        if (browser) {
          localStorage.setItem('editorSettings', JSON.stringify(newSettings))
        }
        return newSettings
      })
    },
    resetFontFamily: () => {
      update(current => {
        const newSettings = { ...current, fontFamily: DEFAULT_SETTINGS.fontFamily }
        if (browser) {
          localStorage.setItem('editorSettings', JSON.stringify(newSettings))
        }
        return newSettings
      })
    },
    reset: () => {
      if (browser) {
        localStorage.setItem('editorSettings', JSON.stringify(DEFAULT_SETTINGS))
      }
      set(DEFAULT_SETTINGS)
    }
  }
}

export const editorSettings = createEditorSettingsStore()
