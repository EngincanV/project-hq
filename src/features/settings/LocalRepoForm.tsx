import { FolderOpen, PlugZap } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { useMessages } from '../../i18n';
import { Button, Field, Input, useToast } from '../../ui';
import { describedBy, fieldControlClass } from '../../ui/Field';
import {
  createLocalRepoServices,
  LocalSettingsError,
  type LocalRepoCheck,
  type LocalRepoServices,
  type LocalSettings,
} from './localRepoServices';
import { settingsMessages, type SettingsMessages } from './messages';
import { ResultList, type ResultTone } from './ResultList';
import styles from './SettingsPage.module.css';

/** The checklist shown after "Test connection" for a local folder. */
export function localCheckLines(check: LocalRepoCheck, contentDir: string, t: SettingsMessages): [ResultTone, string][] {
  const lines: [ResultTone, string][] = [];
  lines.push(check.gitVersion ? ['ok', t.gitFound(check.gitVersion)] : ['fail', t.gitMissing(check.gitError ?? '—')]);
  if (!check.folderExists) {
    lines.push(['fail', t.folderMissing(check.root)]);
    return lines;
  }
  if (check.gitVersion) {
    if (!check.isRepo) lines.push(['warn', t.notARepo]);
    else {
      lines.push(['ok', t.localBranch(check.branch ?? 'HEAD')]);
      if (check.remoteUrl) lines.push(['ok', t.localRemoteFound(check.remoteUrl)]);
      else if (check.remote) lines.push(['ok', t.localRemoteOther(check.remote)]);
      else lines.push(['info', t.localRemoteMissing]);
    }
  }
  const dir = contentDir === '.' || contentDir === '' ? t.repoRoot : contentDir;
  lines.push(check.contentExists && check.contentFiles > 0 ? ['ok', t.contentFiles(check.contentFiles, dir)] : ['info', t.localContentMissing(dir)]);
  return lines;
}

function errorText(err: unknown, t: SettingsMessages): string {
  if (err instanceof LocalSettingsError && err.code && t.localErrors[err.code]) return t.localErrors[err.code];
  return err instanceof Error ? err.message : String(err);
}

interface LocalRepoFormProps {
  /** Replaces the server calls and the folder picker (tests). */
  services?: LocalRepoServices;
}

/**
 * Local mode: choose the content repository folder. Works with `npm start` / `npm run dev` (saved to
 * `.env.local`) and in the desktop app (saved to its settings file, with a native "Choose folder" button).
 */
export function LocalRepoForm({ services: injected }: LocalRepoFormProps) {
  const t = useMessages(settingsMessages);
  const toast = useToast();
  const rootId = useId();
  const [services] = useState(() => injected ?? createLocalRepoServices());
  const [settings, setSettings] = useState<LocalSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [root, setRoot] = useState('');
  const [contentDir, setContentDir] = useState('content');
  const [rootError, setRootError] = useState<string | undefined>();
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tested, setTested] = useState<{ check: LocalRepoCheck; contentDir: string } | null>(null);

  useEffect(() => {
    let alive = true;
    services.load().then(
      (s) => {
        if (!alive) return;
        setSettings(s);
        setRoot(s.root);
        setContentDir(s.contentDir);
      },
      (err: unknown) => alive && setLoadError(errorText(err, t)),
    );
    return () => {
      alive = false;
    };
    // Load once: `t` only formats the error text.
  }, [services]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loadError) return <p className={styles.note}>{t.localLoadFailed(loadError)}</p>;
  if (!settings) return <p className={styles.note}>{t.loading}</p>;

  const locked = settings.envOverride || settings.pinned;
  const edit = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setRootError(undefined);
    setTested(null);
  };

  function valid() {
    if (root.trim()) return true;
    setRootError(t.localRootRequired);
    return false;
  }

  async function onPick() {
    const picked = await services.pickFolder?.(root || undefined);
    if (picked) edit(setRoot)(picked);
  }

  async function onTest() {
    if (!valid()) return;
    setTesting(true);
    try {
      const check = await services.test(root.trim(), contentDir.trim());
      setTested({ check, contentDir: contentDir.trim() });
    } catch (err) {
      setRootError(errorText(err, t));
    } finally {
      setTesting(false);
    }
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!valid()) return;
    setSaving(true);
    try {
      const saved = await services.save(root.trim(), contentDir.trim());
      setSettings(saved);
      setRoot(saved.root);
      setContentDir(saved.contentDir);
      toast.show(t.localSaved, 'success');
    } catch (err) {
      const text = errorText(err, t);
      if (err instanceof LocalSettingsError && err.code?.startsWith('root_')) setRootError(text);
      else toast.show(t.localSaveFailed(text), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={onSave} noValidate>
      <h3 className={styles.subTitle}>{t.localFormTitle}</h3>
      {settings.envOverride && (
        <p className={styles.warning} role="note">
          {t.localEnvOverride}
        </p>
      )}
      {settings.pinned && !settings.envOverride && <p className={styles.note}>{t.localPinned}</p>}
      <Field id={rootId} label={t.localRootLabel} hint={t.localRootHint} error={rootError}>
        <div className={styles.tokenRow}>
          <input
            id={rootId}
            className={fieldControlClass}
            value={root}
            onChange={(e) => edit(setRoot)(e.target.value)}
            placeholder={settings.mode === 'desktop' ? '' : '../project-hq-content'}
            disabled={locked}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            {...describedBy(rootId, t.localRootHint, rootError)}
          />
          {services.pickFolder && (
            <Button icon={<FolderOpen size={16} />} onClick={() => void onPick()} disabled={locked}>
              {t.chooseFolder}
            </Button>
          )}
        </div>
      </Field>
      <Input
        label={t.contentDirLabel}
        value={contentDir}
        onChange={(e) => edit(setContentDir)(e.target.value)}
        placeholder="content"
        hint={t.contentDirHint}
        disabled={locked}
        autoCapitalize="off"
        spellCheck={false}
      />

      <div aria-live="polite">
        {tested && <ResultList lines={localCheckLines(tested.check, tested.contentDir, t)} label={t.testResults} />}
      </div>

      <p className={styles.note}>{t.localSettingsFile(settings.file)}</p>
      {settings.mode === 'web' && <p className={styles.note}>{t.localOtherRepo}</p>}

      <div className={styles.actions}>
        <Button icon={<PlugZap size={16} />} onClick={() => void onTest()} loading={testing}>
          {t.test}
        </Button>
        <Button type="submit" variant="primary" loading={saving} disabled={locked}>
          {t.save}
        </Button>
      </div>
    </form>
  );
}
