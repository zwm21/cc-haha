import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_NEW_SESSION_PREFERENCES, NEW_SESSION_PREFERENCES_STORAGE_KEY } from '@/lib/newSessionPreferences'
import { initializeNewSessionPreferences, useNewSessionPreferencesStore } from './newSessionPreferencesStore'

function defaults() {
  return { ...DEFAULT_NEW_SESSION_PREFERENCES, suggestionTexts: [...DEFAULT_NEW_SESSION_PREFERENCES.suggestionTexts] }
}

describe('new session preferences lifecycle', () => {
  let dispose: (() => void) | undefined
  beforeEach(() => {
    localStorage.clear()
    useNewSessionPreferencesStore.setState({ preferences: defaults() })
  })
  afterEach(() => { dispose?.(); vi.restoreAllMocks() })

  it('restores stored preferences and keeps unrelated keys', () => {
    localStorage.setItem('cc-haha-app-zoom', '1.25')
    localStorage.setItem(NEW_SESSION_PREFERENCES_STORAGE_KEY, JSON.stringify({
      version: 1, showHero: false, recentLimit: 5, suggestionTexts: ['Ship it', '', '', ''],
    }))
    dispose = initializeNewSessionPreferences()
    expect(useNewSessionPreferencesStore.getState().preferences).toMatchObject({ showHero: false, recentLimit: 5 })
  })

  it('normalizes and persists a patch without dropping the other fields', () => {
    useNewSessionPreferencesStore.getState().setPreferences({ showSuggestions: false })
    expect(useNewSessionPreferencesStore.getState().preferences).toMatchObject({
      ...defaults(), showSuggestions: false,
    })
    expect(JSON.parse(localStorage.getItem(NEW_SESSION_PREFERENCES_STORAGE_KEY)!)).toMatchObject({
      version: 1, showSuggestions: false,
    })

    useNewSessionPreferencesStore.getState().setPreferences({ recentLimit: 99 })
    expect(useNewSessionPreferencesStore.getState().preferences.recentLimit).toBe(10)
    expect(useNewSessionPreferencesStore.getState().preferences.showSuggestions).toBe(false)
  })

  it('resets every field back to the shipped defaults', () => {
    useNewSessionPreferencesStore.getState().setPreferences({ showHero: false, heroTitle: 'Custom', suggestionTexts: ['a', 'b', 'c', 'd'] })
    useNewSessionPreferencesStore.getState().resetPreferences()
    expect(useNewSessionPreferencesStore.getState().preferences).toEqual(defaults())
  })

  it('updates other windows without echoing writes and handles key removal', () => {
    dispose = initializeNewSessionPreferences()
    localStorage.setItem(NEW_SESSION_PREFERENCES_STORAGE_KEY, JSON.stringify({ version: 1, showRecentSessions: false, recentLimit: 5 }))
    const write = vi.spyOn(Storage.prototype, 'setItem')
    window.dispatchEvent(new StorageEvent('storage', { key: NEW_SESSION_PREFERENCES_STORAGE_KEY, storageArea: localStorage }))
    expect(useNewSessionPreferencesStore.getState().preferences).toMatchObject({ showRecentSessions: false, recentLimit: 5 })
    expect(write).not.toHaveBeenCalled()
    localStorage.removeItem(NEW_SESSION_PREFERENCES_STORAGE_KEY)
    window.dispatchEvent(new StorageEvent('storage', { key: null, storageArea: localStorage }))
    expect(useNewSessionPreferencesStore.getState().preferences).toEqual(defaults())
  })
})
