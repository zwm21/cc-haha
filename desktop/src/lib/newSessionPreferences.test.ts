import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_NEW_SESSION_PREFERENCES,
  MAX_RECENT_LIMIT,
  MIN_RECENT_LIMIT,
  NEW_SESSION_PREFERENCES_STORAGE_KEY,
  migrateNewSessionPreferences,
  normalizeNewSessionPreferences,
  persistNewSessionPreferences,
  readNewSessionPreferences,
  resolveNewSessionHeroSubtitle,
  resolveNewSessionHeroTitle,
  resolveSuggestionText,
} from './newSessionPreferences'
import { translate, type TranslationKey } from '../i18n'

const t = (key: TranslationKey, params?: Record<string, string | number>) =>
  translate('en', key, params)

describe('new session preferences', () => {
  beforeEach(() => localStorage.clear())

  it('defaults to the screen as it shipped: everything visible, localized strings', () => {
    expect(DEFAULT_NEW_SESSION_PREFERENCES).toEqual({
      showHero: true,
      showSuggestions: true,
      showRecentSessions: true,
      recentLimit: 3,
      heroTitle: '',
      heroSubtitle: '',
      suggestionTexts: ['', '', '', ''],
    })
    expect(normalizeNewSessionPreferences(undefined)).toEqual(DEFAULT_NEW_SESSION_PREFERENCES)
  })

  it.each([null, [], 'text', 42, { showHero: 'yes', recentLimit: 'many', suggestionTexts: 'nope' }])(
    'rejects malformed preference values: %j',
    (value) => {
      expect(normalizeNewSessionPreferences(value)).toEqual(DEFAULT_NEW_SESSION_PREFERENCES)
    },
  )

  it('snaps the recent limit to the nearest offered count and pads suggestion texts to the four chips', () => {
    expect(normalizeNewSessionPreferences({ recentLimit: 99 }).recentLimit).toBe(MAX_RECENT_LIMIT)
    expect(normalizeNewSessionPreferences({ recentLimit: -5 }).recentLimit).toBe(MIN_RECENT_LIMIT)
    expect(normalizeNewSessionPreferences({ recentLimit: 5.4 }).recentLimit).toBe(5)
    // Off-menu values a hand-edited store could hold snap to the closest count,
    // so the settings control always has a selection.
    expect(normalizeNewSessionPreferences({ recentLimit: 7 }).recentLimit).toBe(5)
    expect(normalizeNewSessionPreferences({ recentLimit: 4 }).recentLimit).toBe(3)
    expect(normalizeNewSessionPreferences({ suggestionTexts: ['a', 'b'] }).suggestionTexts).toEqual(['a', 'b', '', ''])
    expect(normalizeNewSessionPreferences({ suggestionTexts: ['a', 'b', 'c', 'd', 'e'] }).suggestionTexts).toEqual(['a', 'b', 'c', 'd'])
  })

  it('materializes defaults on a pre-feature install and normalizes junk without touching other keys', () => {
    migrateNewSessionPreferences(localStorage)
    expect(JSON.parse(localStorage.getItem(NEW_SESSION_PREFERENCES_STORAGE_KEY)!)).toEqual({
      version: 1,
      ...DEFAULT_NEW_SESSION_PREFERENCES,
    })
    expect(migrateNewSessionPreferences(localStorage)).toBe(false)

    localStorage.setItem('unrelated-user-key', 'keep')
    localStorage.setItem(NEW_SESSION_PREFERENCES_STORAGE_KEY, JSON.stringify({ showHero: false, recentLimit: 99, extra: true }))
    expect(migrateNewSessionPreferences(localStorage)).toBe(true)
    expect(JSON.parse(localStorage.getItem(NEW_SESSION_PREFERENCES_STORAGE_KEY)!)).toEqual({
      version: 1,
      showHero: false,
      showSuggestions: true,
      showRecentSessions: true,
      recentLimit: MAX_RECENT_LIMIT,
      heroTitle: '',
      heroSubtitle: '',
      suggestionTexts: ['', '', '', ''],
      extra: true,
    })
    expect(localStorage.getItem('unrelated-user-key')).toBe('keep')
  })

  it('round trips preferences while preserving unknown fields', () => {
    localStorage.setItem(NEW_SESSION_PREFERENCES_STORAGE_KEY, JSON.stringify({ version: 1, extra: 'keep' }))
    persistNewSessionPreferences(normalizeNewSessionPreferences({ showSuggestions: false, recentLimit: 5, suggestionTexts: ['x', '', '', ''] }))
    expect(readNewSessionPreferences()).toMatchObject({ showSuggestions: false, recentLimit: 5, suggestionTexts: ['x', '', '', ''] })
    expect(JSON.parse(localStorage.getItem(NEW_SESSION_PREFERENCES_STORAGE_KEY)!)).toHaveProperty('extra', 'keep')
  })

  it('preserves future schemas through reads, migrations and user changes', () => {
    const raw = JSON.stringify({ version: 2, showHero: 'future', custom: [1, 2] })
    localStorage.setItem(NEW_SESSION_PREFERENCES_STORAGE_KEY, raw)
    expect(readNewSessionPreferences()).toEqual(DEFAULT_NEW_SESSION_PREFERENCES)
    expect(migrateNewSessionPreferences(localStorage)).toBe(false)
    persistNewSessionPreferences(normalizeNewSessionPreferences({ showHero: false }))
    expect(localStorage.getItem(NEW_SESSION_PREFERENCES_STORAGE_KEY)).toBe(raw)
  })

  it('falls back safely when storage is corrupt or blocked', () => {
    localStorage.setItem(NEW_SESSION_PREFERENCES_STORAGE_KEY, '{bad')
    expect(readNewSessionPreferences()).toEqual(DEFAULT_NEW_SESSION_PREFERENCES)
    const blocked = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(readNewSessionPreferences(blocked)).toEqual(DEFAULT_NEW_SESSION_PREFERENCES)
    expect(() => persistNewSessionPreferences(DEFAULT_NEW_SESSION_PREFERENCES, blocked)).not.toThrow()
  })

  describe('resolved strings', () => {
    it('uses the localized hero title pair until a stand-in is written', () => {
      const prefs = DEFAULT_NEW_SESSION_PREFERENCES
      expect(resolveNewSessionHeroTitle(prefs, 'alpha', t)).toBe(translate('en', 'empty.heroTitle', { project: 'alpha' }))
      expect(resolveNewSessionHeroTitle(prefs, null, t)).toBe(translate('en', 'empty.heroTitleNoProject'))

      const custom = normalizeNewSessionPreferences({ heroTitle: 'Shipping in {project}?' })
      expect(resolveNewSessionHeroTitle(custom, 'alpha', t)).toBe('Shipping in alpha?')
      // No project open: the placeholder drops rather than rendering empty.
      expect(resolveNewSessionHeroTitle(custom, null, t)).toBe('Shipping in ?')
      // Whitespace alone reads as "reset this field".
      expect(resolveNewSessionHeroTitle(normalizeNewSessionPreferences({ heroTitle: '   ' }), 'alpha', t))
        .toBe(translate('en', 'empty.heroTitle', { project: 'alpha' }))
    })

    it('uses the localized subtitle until a stand-in is written', () => {
      expect(resolveNewSessionHeroSubtitle(DEFAULT_NEW_SESSION_PREFERENCES, t)).toBe(translate('en', 'empty.heroSubtitle'))
      expect(resolveNewSessionHeroSubtitle(normalizeNewSessionPreferences({ heroSubtitle: 'Build something.' }), t)).toBe('Build something.')
    })

    it('falls back per chip, so one blank field resets only its own chip', () => {
      const prefs = normalizeNewSessionPreferences({ suggestionTexts: ['Explain the API', '', '  ', 'Write a migration'] })
      expect(resolveSuggestionText(prefs, 0, 'DEFAULT-0')).toBe('Explain the API')
      expect(resolveSuggestionText(prefs, 1, 'DEFAULT-1')).toBe('DEFAULT-1')
      expect(resolveSuggestionText(prefs, 2, 'DEFAULT-2')).toBe('DEFAULT-2')
      expect(resolveSuggestionText(prefs, 3, 'DEFAULT-3')).toBe('Write a migration')
    })
  })
})
