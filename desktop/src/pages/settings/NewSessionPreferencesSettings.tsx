import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import {
  SettingsBlock,
  SettingsGroup,
  SettingsRow,
  SettingsSection,
  SettingsSwitchRow,
} from '@/components/settings/SettingsSection'
import { useTranslation } from '@/i18n'
import { useNewSessionPreferencesStore } from '@/stores/newSessionPreferencesStore'
import { RECENT_LIMIT_OPTIONS, SUGGESTION_DEFAULT_KEYS, SUGGESTION_TEXT_COUNT, type RecentLimitOption } from '@/lib/newSessionPreferences'

/**
 * The new-session screen's display preferences: which blocks show, how many
 * recent threads, and stand-in words for the hero and the starter chips. An
 * empty text field falls back to the built-in wording, so the localized
 * defaults stay the norm rather than a frozen copy.
 */
export function NewSessionPreferencesSettings() {
  const t = useTranslation()
  const { preferences, setPreferences, resetPreferences } = useNewSessionPreferencesStore()

  const setSuggestionText = (index: number, text: string) => {
    const suggestionTexts = [...preferences.suggestionTexts]
    while (suggestionTexts.length < SUGGESTION_TEXT_COUNT) suggestionTexts.push('')
    suggestionTexts[index] = text
    setPreferences({ suggestionTexts })
  }

  // Normalizing keeps the stored limit inside the offered options, so the
  // control always has a selection to show.
  const recentLimit = String(preferences.recentLimit) as RecentLimitOption

  return (
    <SettingsSection
      title={t('settings.newSession.title')}
      description={t('settings.newSession.description')}
      action={(
        <Button size="sm" variant="ghost" onClick={resetPreferences}>
          {t('settings.newSession.reset')}
        </Button>
      )}
    >
      <SettingsGroup>
        <SettingsSwitchRow
          title={t('settings.newSession.showHero')}
          description={t('settings.newSession.showHeroHint')}
          checked={preferences.showHero}
          onChange={(showHero) => setPreferences({ showHero })}
        />
        <SettingsSwitchRow
          title={t('settings.newSession.showSuggestions')}
          description={t('settings.newSession.showSuggestionsHint')}
          checked={preferences.showSuggestions}
          onChange={(showSuggestions) => setPreferences({ showSuggestions })}
        />
        <SettingsSwitchRow
          title={t('settings.newSession.showRecentSessions')}
          description={t('settings.newSession.showRecentSessionsHint')}
          checked={preferences.showRecentSessions}
          onChange={(showRecentSessions) => setPreferences({ showRecentSessions })}
        />
        <SettingsRow title={t('settings.newSession.recentLimit')}>
          <SegmentedControl<RecentLimitOption>
            label={t('settings.newSession.recentLimit')}
            size="sm"
            value={recentLimit}
            onChange={(value) => setPreferences({ recentLimit: Number(value) })}
            items={RECENT_LIMIT_OPTIONS.map((option) => ({ value: option, label: option }))}
          />
        </SettingsRow>
        <SettingsBlock className="space-y-3">
          <Input
            label={t('settings.newSession.heroTitle')}
            hint={t('settings.newSession.heroTitleHint')}
            value={preferences.heroTitle}
            onChange={(event) => setPreferences({ heroTitle: event.target.value })}
          />
          <Input
            label={t('settings.newSession.heroSubtitle')}
            hint={t('settings.newSession.heroSubtitleHint')}
            value={preferences.heroSubtitle}
            onChange={(event) => setPreferences({ heroSubtitle: event.target.value })}
          />
        </SettingsBlock>
        <SettingsBlock className="space-y-3">
          <p className="text-xs font-medium text-[var(--color-text-tertiary)]">
            {t('settings.newSession.suggestionsTitle')}
          </p>
          {SUGGESTION_DEFAULT_KEYS.map((key, index) => (
            <Input
              key={key}
              label={t(key)}
              value={preferences.suggestionTexts[index] ?? ''}
              onChange={(event) => setSuggestionText(index, event.target.value)}
            />
          ))}
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {t('settings.newSession.suggestionHint')}
          </p>
        </SettingsBlock>
      </SettingsGroup>
    </SettingsSection>
  )
}
