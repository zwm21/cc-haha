import type { TranslationKey } from '../i18n'

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string

export const NEW_SESSION_PREFERENCES_STORAGE_KEY = 'cc-haha-new-session-preferences'
export const NEW_SESSION_PREFERENCES_VERSION = 1

/**
 * What the new-session screen shows, and in whose words.
 *
 * The defaults are the screen as it shipped: hero, starter chips and recent
 * sessions all visible, three recent threads, every string from the locale
 * files. A preference only ever *replaces* that, so a user who touches nothing
 * sees exactly what they saw before this feature existed.
 */
export type NewSessionPreferences = {
  /** The hero block: brand mark, title and subtitle as one unit. */
  showHero: boolean
  showSuggestions: boolean
  showRecentSessions: boolean
  /** How many recent threads the list shows. */
  recentLimit: number
  /**
   * Stand-in title. Empty means the localized default; `{project}` is replaced
   * by the project label (or dropped when no project is open).
   */
  heroTitle: string
  /** Stand-in subtitle. Empty means the localized default. */
  heroSubtitle: string
  /**
   * Stand-in texts for the four starter chips, by index. An empty entry falls
   * back to that chip's localized default; icons and order are not affected.
   */
  suggestionTexts: string[]
}

export const DEFAULT_NEW_SESSION_PREFERENCES: NewSessionPreferences = {
  showHero: true,
  showSuggestions: true,
  showRecentSessions: true,
  recentLimit: 3,
  heroTitle: '',
  heroSubtitle: '',
  suggestionTexts: ['', '', '', ''],
}

/** The four starter chips these texts stand in for, in render order. */
export const SUGGESTION_TEXT_COUNT = 4

/**
 * The recent-session counts the settings control offers, as its option
 * values. Normalizing to the nearest of these (rather than clamping to a
 * range) keeps the stored value inside the option set, so the control always
 * has a selection — the same guarantee the enum preferences give their
 * segmented controls.
 */
export const RECENT_LIMIT_OPTIONS = ['3', '5', '10'] as const
export type RecentLimitOption = (typeof RECENT_LIMIT_OPTIONS)[number]

const RECENT_LIMIT_COUNTS = RECENT_LIMIT_OPTIONS.map(Number)

/**
 * The starter chips' localized defaults, in render order — the single source
 * of truth for which chip `suggestionTexts[i]` replaces, shared by the
 * component that renders them and the settings panel that relabels them.
 */
export const SUGGESTION_DEFAULT_KEYS: readonly TranslationKey[] = [
  'empty.suggestion.explainRepo',
  'empty.suggestion.fixTests',
  'empty.suggestion.reviewChanges',
  'empty.suggestion.newFeature',
]

export const MIN_RECENT_LIMIT = RECENT_LIMIT_COUNTS[0]
export const MAX_RECENT_LIMIT = RECENT_LIMIT_COUNTS[RECENT_LIMIT_COUNTS.length - 1]

export type PreferencesStorage = Pick<Storage, 'getItem' | 'setItem'>

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeRecentLimit(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_NEW_SESSION_PREFERENCES.recentLimit
  return RECENT_LIMIT_COUNTS.reduce((nearest, option) =>
    Math.abs(option - value) < Math.abs(nearest - value) ? option : nearest)
}

function normalizeSuggestionTexts(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : []
  const texts: string[] = []
  for (let index = 0; index < SUGGESTION_TEXT_COUNT; index += 1) {
    texts.push(normalizeText(raw[index]))
  }
  return texts
}

export function normalizeNewSessionPreferences(value: unknown): NewSessionPreferences {
  const record = isRecord(value) ? value : {}
  return {
    showHero: typeof record.showHero === 'boolean' ? record.showHero : DEFAULT_NEW_SESSION_PREFERENCES.showHero,
    showSuggestions: typeof record.showSuggestions === 'boolean' ? record.showSuggestions : DEFAULT_NEW_SESSION_PREFERENCES.showSuggestions,
    showRecentSessions: typeof record.showRecentSessions === 'boolean' ? record.showRecentSessions : DEFAULT_NEW_SESSION_PREFERENCES.showRecentSessions,
    recentLimit: normalizeRecentLimit(record.recentLimit),
    heroTitle: normalizeText(record.heroTitle),
    heroSubtitle: normalizeText(record.heroSubtitle),
    suggestionTexts: normalizeSuggestionTexts(record.suggestionTexts),
  }
}

export function getPreferencesStorage(): PreferencesStorage | null {
  try { return globalThis.localStorage ?? null } catch { return null }
}

function parseStored(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    return isRecord(value) ? value : null
  } catch { return null }
}

function isFutureVersion(value: Record<string, unknown> | null): boolean {
  return value?.version !== undefined && value.version !== NEW_SESSION_PREFERENCES_VERSION
}

export function readNewSessionPreferences(storage: PreferencesStorage | null = getPreferencesStorage()): NewSessionPreferences {
  try {
    const value = parseStored(storage?.getItem(NEW_SESSION_PREFERENCES_STORAGE_KEY) ?? null)
    return normalizeNewSessionPreferences(isFutureVersion(value) ? null : value)
  } catch { return { ...DEFAULT_NEW_SESSION_PREFERENCES, suggestionTexts: [...DEFAULT_NEW_SESSION_PREFERENCES.suggestionTexts] } }
}

/**
 * Materialize the default record on a pre-feature install (missing key) and
 * normalize a junk value, without touching other UI preferences. Unversioned
 * data is normalized; unknown versions are left intact for newer builds.
 */
export function migrateNewSessionPreferences(storage: PreferencesStorage): boolean {
  const raw = storage.getItem(NEW_SESSION_PREFERENCES_STORAGE_KEY)
  const value = parseStored(raw)
  if (isFutureVersion(value)) return false
  const next = JSON.stringify({ ...value, version: NEW_SESSION_PREFERENCES_VERSION, ...normalizeNewSessionPreferences(value) })
  if (raw === next) return false
  storage.setItem(NEW_SESSION_PREFERENCES_STORAGE_KEY, next)
  return true
}

export function persistNewSessionPreferences(preferences: NewSessionPreferences, storage: PreferencesStorage | null = getPreferencesStorage()): void {
  if (!storage) return
  try {
    const value = parseStored(storage.getItem(NEW_SESSION_PREFERENCES_STORAGE_KEY))
    if (isFutureVersion(value)) return
    storage.setItem(NEW_SESSION_PREFERENCES_STORAGE_KEY, JSON.stringify({ ...value, version: NEW_SESSION_PREFERENCES_VERSION, ...normalizeNewSessionPreferences(preferences) }))
  } catch { /* Keep controls usable when storage is unavailable. */ }
}

/**
 * The hero title: the stand-in text with `{project}` filled in, or the
 * localized default (which itself has the with/without-project pair).
 */
export function resolveNewSessionHeroTitle(
  preferences: NewSessionPreferences,
  projectLabel: string | null | undefined,
  t: Translate,
): string {
  const custom = preferences.heroTitle.trim()
  if (custom) return custom.replaceAll('{project}', projectLabel ?? '')
  return projectLabel
    ? t('empty.heroTitle', { project: projectLabel })
    : t('empty.heroTitleNoProject')
}

/** The hero subtitle: the stand-in text, or the localized default. */
export function resolveNewSessionHeroSubtitle(preferences: NewSessionPreferences, t: Translate): string {
  return preferences.heroSubtitle.trim() || t('empty.heroSubtitle')
}

/**
 * A starter chip's text: the stand-in for its index, or the chip's localized
 * default. Trimming first means a field holding only spaces reads as "reset
 * this one", not as a blank chip.
 */
export function resolveSuggestionText(preferences: NewSessionPreferences, index: number, fallback: string): string {
  return preferences.suggestionTexts[index]?.trim() || fallback
}
