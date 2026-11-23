import { Eye, EyeOff, PlugZap, Unplug } from 'lucide-react';
import { useId, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMessages } from '../../i18n';
import { useStorage } from '../../storage';
import type { ConnectionResult } from '../../storage/github/connection';
import { loadGitHubSettings, loadGitHubSettingsDraft, parseRepoInput } from '../../storage/githubSettings';
import { Button, ConfirmDialog, Field, IconButton, Input, useToast } from '../../ui';
import { describedBy, fieldControlClass } from '../../ui/Field';
import {
  settingsFromValues,
  validateConnection,
  valuesFromSettings,
  type ConnectionErrors,
  type ConnectionValues,
} from './connectionForm';
import { settingsMessages } from './messages';
import { isSharedPagesOrigin } from './sharedOrigin';
import { defaultServices, type ConnectionServices } from './services';
import { TestResult } from './TestResult';
import { TokenHelp } from './TokenHelp';
import styles from './SettingsPage.module.css';

interface GitHubConnectionFormProps {
  services?: ConnectionServices;
  /** Where the app is served from (tests pass their own). */
  pageLocation?: { hostname: string; pathname: string };
}

export function GitHubConnectionForm({ services = defaultServices, pageLocation = window.location }: GitHubConnectionFormProps) {
  const t = useMessages(settingsMessages);
  const sharedOrigin = isSharedPagesOrigin(pageLocation);
  const toast = useToast();
  const navigate = useNavigate();
  const storage = useStorage();
  const tokenId = useId();
  const formRef = useRef<HTMLFormElement>(null);

  const [connected, setConnected] = useState(() => loadGitHubSettings() !== null);
  const [values, setValues] = useState<ConnectionValues>(() => valuesFromSettings(loadGitHubSettingsDraft()));
  const [errors, setErrors] = useState<ConnectionErrors>({});
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState<{ result: ConnectionResult; branch: string; contentDir: string } | null>(null);
  const [confirm, setConfirm] = useState<{ drafts: number } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const set = (key: keyof ConnectionValues) => (value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setTested(null);
  };

  const parsed = parseRepoInput(values.repo);
  const repoName = parsed ? `${parsed.owner}/${parsed.repo}` : '';
  const pastedUrl = repoName !== '' && values.repo.trim() !== repoName;

  function check(requireToken: boolean) {
    const found = validateConnection(values, t, requireToken);
    setErrors(found);
    if (Object.keys(found).length === 0) return settingsFromValues(values);
    // Move focus to the first invalid field once React has rendered the errors.
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
    return null;
  }

  async function onTest() {
    const settings = check(false);
    if (!settings) return;
    setTesting(true);
    try {
      const result = await services.test(settings);
      setTested({ result, branch: settings.branch, contentDir: settings.contentDir });
    } finally {
      setTesting(false);
    }
  }

  function onSave(event: FormEvent) {
    event.preventDefault();
    const settings = check(true);
    if (!settings) return;
    services.save(settings);
    toast.show(t.saved, 'success');
    navigate('/');
  }

  async function askDisconnect() {
    const drafts = await storage.changes().then((c) => c.length, () => 0);
    setConfirm({ drafts });
  }

  async function onDisconnect() {
    const settings = settingsFromValues(values) ?? loadGitHubSettingsDraft();
    setDisconnecting(true);
    try {
      await services.disconnect(settings, storage);
      setValues((v) => ({ ...v, token: '' }));
      setConnected(false);
      setTested(null);
      toast.show(t.disconnected, 'success');
    } catch (err) {
      toast.show(t.disconnectFailed(err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      setDisconnecting(false);
      setConfirm(null);
    }
  }

  return (
    <form ref={formRef} className={styles.form} onSubmit={onSave} noValidate>
      <Input
        label={t.repoLabel}
        value={values.repo}
        onChange={(e) => set('repo')(e.target.value)}
        onBlur={() => {
          if (pastedUrl) set('repo')(repoName);
        }}
        placeholder="owner/repo"
        hint={pastedUrl ? t.repoParsed(repoName) : t.repoHint}
        error={errors.repo}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        required
      />
      <div className={styles.row}>
        <Input
          label={t.branchLabel}
          value={values.branch}
          onChange={(e) => set('branch')(e.target.value)}
          placeholder="main"
          error={errors.branch}
          autoCapitalize="off"
          spellCheck={false}
          required
        />
        <Input
          label={t.contentDirLabel}
          value={values.contentDir}
          onChange={(e) => set('contentDir')(e.target.value)}
          placeholder="content"
          hint={t.contentDirHint}
          error={errors.contentDir}
          autoCapitalize="off"
          spellCheck={false}
        />
      </div>

      {sharedOrigin && (
        <p className={styles.warning} role="note">
          {t.sharedOriginWarning}
        </p>
      )}
      <Field id={tokenId} label={t.tokenLabel} hint={t.tokenHint} error={errors.token}>
        <div className={styles.tokenRow}>
          <input
            id={tokenId}
            className={fieldControlClass}
            type={showToken ? 'text' : 'password'}
            value={values.token}
            onChange={(e) => set('token')(e.target.value)}
            placeholder="github_pat_…"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            {...describedBy(tokenId, t.tokenHint, errors.token)}
          />
          <IconButton
            label={showToken ? t.hideToken : t.showToken}
            icon={showToken ? <EyeOff size={18} /> : <Eye size={18} />}
            aria-pressed={showToken}
            onClick={() => setShowToken((s) => !s)}
          />
        </div>
      </Field>
      <p className={styles.note}>{t.tokenPrivacy}</p>
      <TokenHelp />

      <div aria-live="polite">{tested && <TestResult {...tested} />}</div>

      <div className={styles.actions}>
        <Button icon={<PlugZap size={16} />} onClick={onTest} loading={testing}>
          {t.test}
        </Button>
        <Button type="submit" variant="primary">
          {t.save}
        </Button>
        {connected && (
          <Button variant="ghost" icon={<Unplug size={16} />} onClick={askDisconnect} className={styles.push}>
            {t.disconnect}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={t.disconnectTitle}
        message={
          <>
            <p>{t.disconnectText}</p>
            {confirm && confirm.drafts > 0 && <p className={styles.warning}>{t.disconnectDrafts(confirm.drafts)}</p>}
          </>
        }
        confirmLabel={t.disconnect}
        danger
        busy={disconnecting}
        onConfirm={onDisconnect}
        onCancel={() => setConfirm(null)}
      />
    </form>
  );
}
