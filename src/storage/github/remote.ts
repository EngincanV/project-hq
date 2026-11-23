// Reading the published state from GitHub: branch head → root tree → content folder subtree.
import { GitHubError, type GitHubApi, type TreeEntry } from './api';
import { gm } from './messages';

export type Head =
  | { empty: false; commitSha: string; rootTreeSha: string }
  /** The repository has no commits yet; the Git Database API answers 409 for it. */
  | { empty: true };

export async function fetchHead(api: GitHubApi, branch: string): Promise<Head> {
  let commitSha: string;
  try {
    commitSha = (await api.getRef(branch)).object.sha;
  } catch (err) {
    if (err instanceof GitHubError && err.status === 409) return { empty: true };
    if (err instanceof GitHubError && err.status === 404) {
      // A missing ref means: no such repository, an empty repository, or a missing branch.
      if (await isEmptyRepo(api)) return { empty: true };
      throw new GitHubError(gm().branchNotFound(branch), 404);
    }
    throw err;
  }
  const commit = await api.getCommit(commitSha);
  return { empty: false, commitSha, rootTreeSha: commit.tree.sha };
}

/** True for a repository without branches; rethrows when the repository itself is not reachable. */
async function isEmptyRepo(api: GitHubApi): Promise<boolean> {
  try {
    return (await api.listBranches()).length === 0;
  } catch (err) {
    if (err instanceof GitHubError && err.status === 409) return true;
    throw err;
  }
}

/** `path → blob sha` of every file under `contentDir` (relative to it). Missing folder → `{}`. */
export async function fetchContentFiles(
  api: GitHubApi,
  rootTreeSha: string,
  contentDir: string,
): Promise<Record<string, string>> {
  let treeSha = rootTreeSha;
  for (const segment of contentDir.split('/').filter(Boolean)) {
    const { tree } = await api.getTree(treeSha, false);
    const next = tree.find((e) => e.path === segment && e.type === 'tree');
    if (!next) return {};
    treeSha = next.sha;
  }

  const full = await api.getTree(treeSha, true);
  const entries = full.truncated ? await walkTree(api, treeSha, '') : full.tree;
  const files: Record<string, string> = {};
  for (const entry of entries) {
    // Plain and executable files only: no submodules ("commit") or symlinks (mode 120000).
    if (entry.type === 'blob' && entry.mode !== '120000') files[entry.path] = entry.sha;
  }
  return files;
}

/** Fallback for trees too big for one `recursive=1` response: fetch every subtree on its own. */
async function walkTree(api: GitHubApi, sha: string, prefix: string): Promise<TreeEntry[]> {
  const { tree } = await api.getTree(sha, false);
  const out: TreeEntry[] = [];
  for (const entry of tree) {
    const path = prefix + entry.path;
    if (entry.type === 'tree') out.push(...(await walkTree(api, entry.sha, `${path}/`)));
    else out.push({ ...entry, path });
  }
  return out;
}
