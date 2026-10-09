import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useSettingsStore } from '@/stores/settingsStore'
import { useNewSessionPreferencesStore } from '@/stores/newSessionPreferencesStore'
import { DEFAULT_NEW_SESSION_PREFERENCES, NEW_SESSION_PREFERENCES_STORAGE_KEY } from '@/lib/newSessionPreferences'
import { NewSessionPreferencesSettings } from './NewSessionPreferencesSettings'

function defaults() {
  return { ...DEFAULT_NEW_SESSION_PREFERENCES, suggestionTexts: [...DEFAULT_NEW_SESSION_PREFERENCES.suggestionTexts] }
}

describe('New session screen settings', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.setState({ locale: 'en' })
    useNewSessionPreferencesStore.setState({ preferences: defaults() })
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
    useNewSessionPreferencesStore.setState(useNewSessionPreferencesStore.getInitialState(), true)
  })

  it('writes every control straight to the store and storage', () => {
    render(<NewSessionPreferencesSettings />)

    fireEvent.click(screen.getByRole('switch', { name: 'Show title block' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Show starter suggestions' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Show recent sessions' }))
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Recent sessions to list' })).getByRole('radio', { name: '5' }))
    fireEvent.change(screen.getByLabelText('Title text'), { target: { value: 'Building {project}' } })
    fireEvent.change(screen.getByLabelText('Subtitle text'), { target: { value: 'One thing at a time.' } })
    fireEvent.change(screen.getByLabelText('Explain how this repo is structured'), { target: { value: 'Tour the codebase' } })

    expect(useNewSessionPreferencesStore.getState().preferences).toEqual({
      showHero: false,
      showSuggestions: false,
      showRecentSessions: false,
      recentLimit: 5,
      heroTitle: 'Building {project}',
      heroSubtitle: 'One thing at a time.',
      suggestionTexts: ['Tour the codebase', '', '', ''],
    })
    expect(JSON.parse(localStorage.getItem(NEW_SESSION_PREFERENCES_STORAGE_KEY)!)).toMatchObject({
      showHero: false, recentLimit: 5, heroTitle: 'Building {project}',
    })
  })

  it('labels the four suggestion fields with their built-in wording, in order', () => {
    render(<NewSessionPreferencesSettings />)

    expect([
      screen.getByLabelText('Explain how this repo is structured'),
      screen.getByLabelText('Fix the failing tests'),
      screen.getByLabelText('Review my uncommitted changes'),
      screen.getByLabelText('Build a new feature'),
    ]).toHaveLength(4)
  })

  it('restores the shipped defaults with the reset action', () => {
    useNewSessionPreferencesStore.getState().setPreferences({
      showHero: false, recentLimit: 10, heroTitle: 'Custom', suggestionTexts: ['a', 'b', 'c', 'd'],
    })

    render(<NewSessionPreferencesSettings />)

    expect(screen.getByRole('switch', { name: 'Show title block' })).not.toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Reset new session screen' }))

    expect(useNewSessionPreferencesStore.getState().preferences).toEqual(defaults())
    expect(screen.getByRole('switch', { name: 'Show title block' })).toBeChecked()
    expect(within(screen.getByRole('radiogroup', { name: 'Recent sessions to list' })).getByRole('radio', { name: '3' }))
      .toHaveAttribute('aria-checked', 'true')
  })
})
