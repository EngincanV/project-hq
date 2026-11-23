import { useTheme, type ThemeChoice } from '../../app/theme';
import { LANGS, useLang, useMessages, type Lang } from '../../i18n';
import { Select } from '../../ui';
import { settingsMessages } from './messages';
import styles from './SettingsPage.module.css';

const THEMES: readonly ThemeChoice[] = ['system', 'light', 'dark'];

export function AppearanceSettings() {
  const t = useMessages(settingsMessages);
  const { theme, setTheme } = useTheme();
  const [lang, setLang] = useLang();
  return (
    <div className={styles.row}>
      <Select<ThemeChoice>
        label={t.themeLabel}
        value={theme}
        onChange={setTheme}
        options={THEMES.map((value) => ({ value, label: t.themes[value] }))}
      />
      <Select<Lang>
        label={t.languageLabel}
        value={lang}
        onChange={setLang}
        options={LANGS.map((value) => ({ value, label: t.languages[value] }))}
      />
    </div>
  );
}
