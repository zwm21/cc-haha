import { create } from 'zustand'
import {
  DEFAULT_NEW_SESSION_PREFERENCES,
  NEW_SESSION_PREFERENCES_STORAGE_KEY,
  getPreferencesStorage,
  normalizeNewSessionPreferences,
  persistNewSessionPreferences,
  readNewSessionPreferences,
  type NewSessionPreferences,
} from '@/lib/newSessionPreferences'

type NewSessionPreferencesState = {
  preferences: NewSessionPreferences
  setPreferences: (patch: Partial<NewSessionPreferences>) => void
  resetPreferences: () => void
}

function cloneDefaults(): NewSessionPreferences {
  return { ...DEFAULT_NEW_SESSION_PREFERENCES, suggestionTexts: [...DEFAULT_NEW_SESSION_PREFERENCES.suggestionTexts] }
}

export const useNewSessionPreferencesStore = create<NewSessionPreferencesState>((set, get) => ({
  preferences: readNewSessionPreferences(),
  setPreferences: (patch) => {
    const preferences = normalizeNewSessionPreferences({ ...get().preferences, ...patch })
    persistNewSessionPreferences(preferences)
    set({ preferences })
  },
  resetPreferences: () => get().setPreferences(cloneDefaults()),
}))

/** Called after persistence migrations, before the app renders. */
export function initializeNewSessionPreferences(): () => void {
  const refresh = () => {
    useNewSessionPreferencesStore.setState({ preferences: readNewSessionPreferences() })
  }
  refresh()
  if (typeof window === 'undefined') return () => {}
  const onStorage = (event: StorageEvent) => {
    if (event.storageArea !== null && event.storageArea !== getPreferencesStorage()) return
    if (event.key === NEW_SESSION_PREFERENCES_STORAGE_KEY || event.key === null) refresh()
  }
  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}
