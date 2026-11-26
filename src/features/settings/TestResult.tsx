import { useMessages } from '../../i18n';
import type { ConnectionResult } from '../../storage/github/connection';
import { settingsMessages } from './messages';
import { ResultList, type ResultTone } from './ResultList';

interface TestResultProps {
  result: ConnectionResult;
  branch: string;
  contentDir: string;
}

/** The checklist shown after "Test connection". */
export function TestResult({ result, branch, contentDir }: TestResultProps) {
  const t = useMessages(settingsMessages);
  const lines: [ResultTone, string][] = [];
  if (!result.ok) {
    lines.push(['fail', t.testFailed(result.error)]);
  } else {
    lines.push(['ok', t.repoReachable(result.fullName, result.private)]);
    if (result.canPush === true) lines.push(['ok', t.canPush]);
    else if (result.canPush === false) lines.push(['fail', t.cannotPush]);
    else lines.push(['warn', t.pushUnknown]);
    const dir = contentDir === '.' || contentDir === '' ? t.repoRoot : contentDir;
    if (result.empty) lines.push(['info', t.repoEmpty]);
    else if (!result.branchExists) lines.push(['fail', t.branchMissing(branch, result.defaultBranch)]);
    else {
      lines.push(['ok', t.branchExists(branch)]);
      lines.push(result.fileCount > 0 ? ['ok', t.contentFiles(result.fileCount, dir)] : ['info', t.contentMissing(dir)]);
    }
  }
  return <ResultList lines={lines} label={t.testResults} />;
}
