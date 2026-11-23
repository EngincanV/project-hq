import { useMatch } from 'react-router-dom';
import { Menu, Monitor, Moon, Sun } from 'lucide-react';
import { useProject } from '../data';
import { PublishButton } from '../features/publish/PublishButton';
import { useLang, useMessages } from '../i18n';
import { PwaStatus } from '../pwa';
import { useStorageInfo } from '../storage';
import { Badge, IconButton } from '../ui';
import { appMessages } from './messages';
import { ProjectAvatar } from './ProjectAvatar';
import { useTheme, type ThemeChoice } from './theme';
import styles from './Topbar.module.css';

const NEXT_THEME: Record<ThemeChoice, ThemeChoice> = { system: 'light', light: 'dark', dark: 'system' };
const THEME_ICON: Record<ThemeChoice, typeof Sun> = { system: Monitor, light: Sun, dark: Moon };

interface TopbarProps {
  onOpenMenu: () => void;
}

export function Topbar({ onOpenMenu }: TopbarProps) {
  const t = useMessages(appMessages);
  const [lang, setLang] = useLang();
  const { theme, setTheme } = useTheme();
  const info = useStorageInfo();
  const slug = useMatch('/p/:slug/*')?.params.slug;
  const { project } = useProject(slug);
  const ThemeIcon = THEME_ICON[theme];

  return (
    <header className={styles.topbar}>
      <IconButton className={styles.menu} label={t.openMenu} icon={<Menu size={20} />} onClick={onOpenMenu} />
      <div className={styles.title}>
        {project ? (
          <>
            <ProjectAvatar meta={project.meta} size={24} />
            <span className={styles.titleText}>{project.meta.name}</span>
          </>
        ) : (
          <span className={styles.titleText}>{t.appName}</span>
        )}
      </div>
      <div className={styles.actions}>
        <PwaStatus />
        {info && (
          <Badge className={styles.mode} tone={info.mode === 'local' ? 'neutral' : 'accent'} title={info.label}>
            {info.mode === 'local' ? t.modeLocal : t.modeGitHub}
          </Badge>
        )}
        <PublishButton />
        <IconButton
          label={t.themeLabel(t.themes[theme])}
          icon={<ThemeIcon size={18} />}
          onClick={() => setTheme(NEXT_THEME[theme])}
        />
        <IconButton
          label={t.switchLanguage}
          icon={<span className={styles.lang}>{t.languageShort}</span>}
          onClick={() => setLang(lang === 'tr' ? 'en' : 'tr')}
        />
      </div>
    </header>
  );
}
