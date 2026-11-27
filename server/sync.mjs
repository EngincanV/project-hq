// Publishing as a safe sync with the remote, for the local API (api.mjs):
//
//   preflight → commit local work (the app's and any other tool's) → fetch → rebase onto the upstream → push
//   (when another push got in between: fetch + rebase once more, then push again).
//
// Rules: never force-push, never `reset --hard`, never `clean`, never check out over uncommitted work. The only
// history edit is `reset --soft` of the commit this very run created, so a publish that does not reach the remote
// leaves the repository as it found it: files untouched, the changes still listed as unpublished. A rebase that
// stops on a conflict is always aborted (back to the commit we made) unless the caller chose a side for every
// conflicting file ("mine" / "theirs"). Git always runs through execFile with argument arrays (git.mjs).
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { git, parsePorcelainZ } from './git.mjs';

/** Stable codes for sync results (merged into CODES in api.mjs; translated in src/storage/serverMessages.ts). */
export const SYNC_CODES = /** @type {const} */ ({
  operationInProgress: 'operation_in_progress',
  unmergedFiles: 'unmerged_files',
  detachedHead: 'detached_head',
  noUpstream: 'no_upstream',
  conflictMarkers: 'conflict_markers',
  outsideChanges: 'outside_changes',
  fetchFailed: 'fetch_failed',
  rebaseFailed: 'rebase_failed',
  rebaseConflict: 'rebase_conflict',
  pushRejected: 'push_rejected',
  pulledOnly: 'pulled_only',
  localChanges: 'local_changes',
  mergeUnavailable: 'merge_unavailable',
  fileChanged: 'file_changed',
});

const NET_TIMEOUT = 120_000;
const BACKGROUND_FETCH_TIMEOUT = 20_000;
/** A rebase must never wait for an editor. */
const REBASE_ENV = { GIT_EDITOR: 'true', GIT_SEQUENCE_EDITOR: 'true', GIT_MERGE_AUTOEDIT: 'no' };
const MAX_LISTED_FILES = 30;
const MAX_REBASE_STEPS = 500;
const MARKER_EXT = new Set(['.md', '.markdown', '.txt', '.json']);

/** A sync step that failed with a code the UI knows. `detail` carries git's (redacted) output. */
export class SyncError extends Error {
  /** @param {string} code @param {string} message @param {{ detail?: string, files?: string[], keepCommit?: boolean }} [extra] */
  constructor(code, message, extra = {}) {
    super(message);
    this.code = code;
    this.detail = extra.detail;
    this.files = extra.files;
    /** true when the repository is in a state where undoing our commit would be wrong (a failed rebase --abort) */
    this.keepCommit = extra.keepCommit ?? false;
  }
}

/**
 * @typedef {object} SyncContext
 * @property {string} root folder git runs in (the configured repository folder)
 * @property {string} top the repository's top-level folder (paths from git are relative to it)
 * @property {string} contentSpec pathspec of the content folder, relative to `root`
 * @property {{ branch: string, upstream?: string, remote?: string, remoteUrl?: string, hasHead: boolean }} state
 * @property {(repoRel: string) => string | undefined} toContentRel
 * @property {(contentRel: string) => string} toRepoRel
 * @property {(contentRel: string) => Promise<string>} entryPath absolute, validated path of a content file
 * @property {(text: string) => string} redact
 */

/** @typedef {'mine' | 'theirs'} Resolution */

const output = (r) => (r.stderr || r.stdout).trim();
const fail = (code, error, extra = {}) => ({ ok: false, pushed: false, code, error, ...extra });

// ---------- small git queries ----------

/** The git operation that is half-way done in the repository (rebase, merge, …), or null. */
export async function operationInProgress(root) {
  const markers = [
    ['rebase-merge', 'rebase'],
    ['rebase-apply', 'rebase'],
    ['MERGE_HEAD', 'merge'],
    ['CHERRY_PICK_HEAD', 'cherry-pick'],
    ['REVERT_HEAD', 'revert'],
  ];
  for (const [name, op] of markers) {
    const r = await git(root, ['rev-parse', '--git-path', name]);
    if (r.code !== 0) continue;
    try {
      await fs.access(path.resolve(root, r.stdout.trim()));
      return op;
    } catch {
      // not there
    }
  }
  return null;
}

/** Repo-relative paths with unresolved conflicts in the index. */
async function unmergedPaths(top) {
  const r = await git(top, ['diff', '--name-only', '--diff-filter=U', '-z']);
  return [...new Set(r.stdout.split('\0').filter(Boolean))];
}

async function headSha(root) {
  const r = await git(root, ['rev-parse', '--verify', '--quiet', 'HEAD']);
  return r.code === 0 ? r.stdout.trim() : undefined;
}

async function count(root, range) {
  const r = await git(root, ['rev-list', '--count', range]);
  return r.code === 0 ? Number(r.stdout.trim()) || 0 : 0;
}

/** Number of content files the upstream changed since it split from `from`. */
async function remoteChangedFiles(ctx, from, up) {
  const r = await git(ctx.root, ['diff', '--name-only', '-z', `${from}...${up}`, '--', ctx.contentSpec]);
  return r.code === 0 ? r.stdout.split('\0').filter(Boolean).length : 0;
}

// ---------- steps ----------

/**
 * Refuses to start when the repository is mid-operation, on a detached HEAD, or on a branch without an upstream
 * while the remote already has a branch of that name. (A branch the remote does not have yet is fine: the first
 * push sets the upstream, as before.) Returns a failed result, or null to go on.
 * @param {SyncContext} ctx
 */
export async function preflight(ctx) {
  const { root, state } = ctx;
  const op = await operationInProgress(root);
  if (op) {
    return fail(SYNC_CODES.operationInProgress, `A git ${op} is in progress in the content repository. Finish it or run \`git ${op} --abort\` there first.`, { detail: op });
  }
  const unmerged = await unmergedPaths(ctx.top);
  if (unmerged.length) {
    return fail(SYNC_CODES.unmergedFiles, 'The content repository has files with unresolved conflicts. Resolve them in git first.', { files: unmerged });
  }
  if (!state.remote) return null;
  if (state.branch === 'HEAD') {
    return fail(SYNC_CODES.detachedHead, 'The content repository is not on a branch (detached HEAD). Check out a branch first.');
  }
  if (!state.upstream && (await remoteBranchExists(ctx))) return fail(SYNC_CODES.noUpstream, noUpstreamText(ctx));
  return null;
}

async function remoteBranchExists(ctx) {
  const { root, state } = ctx;
  return (await git(root, ['rev-parse', '--verify', '--quiet', `refs/remotes/${state.remote}/${state.branch}`])).code === 0;
}

function noUpstreamText(ctx) {
  const { remote, branch } = ctx.state;
  return `The branch "${branch}" has no upstream. Set it once with \`git branch --set-upstream-to=${remote}/${branch}\` in the content repository.`;
}

/** Content files (text) that still hold git conflict markers. */
async function filesWithConflictMarkers(ctx) {
  const r = await git(ctx.root, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', ctx.contentSpec]);
  if (r.code !== 0) return [];
  const found = [];
  for (const { xy, path: repoRel } of parsePorcelainZ(r.stdout)) {
    if (xy.includes('D') || !MARKER_EXT.has(path.extname(repoRel).toLowerCase())) continue;
    let text;
    try {
      text = await fs.readFile(path.join(ctx.top, ...repoRel.split('/')), 'utf8');
    } catch {
      continue;
    }
    if (/^<{7}( |$)/m.test(text) && /^>{7}( |$)/m.test(text)) found.push(ctx.toContentRel(repoRel) ?? repoRel);
  }
  return found;
}

/** `M path` lines for the commit body, so `git log` shows which files a publish touched. */
function fileListBody(nameStatusZ) {
  const parts = nameStatusZ.split('\0');
  const lines = [];
  for (let i = 0; i < parts.length; i++) {
    const status = parts[i];
    if (!status) continue;
    const letter = status[0];
    if (letter === 'R' || letter === 'C') {
      const from = parts[++i];
      const to = parts[++i];
      lines.push(`${letter} ${from} -> ${to}`);
    } else {
      lines.push(`${letter} ${parts[++i]}`);
    }
  }
  const shown = lines.slice(0, MAX_LISTED_FILES);
  if (lines.length > shown.length) shown.push(`… (+${lines.length - shown.length})`);
  return shown.join('\n');
}

/**
 * Commits every change in the content folder (written by the app or by any other tool). Returns the commit, or
 * undefined when there was nothing to commit.
 * @param {SyncContext} ctx
 * @param {string} subject
 */
async function commitLocal(ctx, subject) {
  const { root, contentSpec } = ctx;
  const add = await git(root, ['add', '-A', '--', contentSpec]);
  if (add.code !== 0) throw new SyncError('commit_failed', 'git add failed', { detail: ctx.redact(output(add)) });
  const diff = await git(root, ['diff', '--cached', '--quiet', '--', contentSpec]);
  if (diff.code === 0) return undefined;
  if (diff.code !== 1) throw new SyncError('diff_failed', 'git diff failed', { detail: ctx.redact(output(diff)) });
  const names = await git(root, ['diff', '--cached', '--name-status', '-z', '--', contentSpec]);
  const body = names.code === 0 ? fileListBody(names.stdout) : '';
  const message = body ? `${subject}\n\n${body}` : subject;
  const c = await git(root, ['commit', '-q', '-m', message, '--', contentSpec]);
  if (c.code !== 0) throw new SyncError('commit_failed', 'git commit failed', { detail: ctx.redact(output(c)) });
  return { sha: /** @type {string} */ (await headSha(root)), message };
}

/**
 * Undoes the commit this run created (`reset --soft`: files and index stay as they are), so the changes show up
 * as unpublished again. Only when HEAD still is that commit (possibly rebased) and it has a parent.
 * @param {SyncContext} ctx
 * @param {{ sha: string, message: string } | undefined} own
 * @param {string} [up] the upstream commit, when known: a commit the upstream already has is never ours to undo
 */
async function undoOwnCommit(ctx, own, up) {
  if (!own) return;
  const { root } = ctx;
  const head = await headSha(root);
  if (!head) return;
  if (head !== own.sha) {
    const msg = await git(root, ['log', '-1', '--format=%B', head]);
    if (msg.code !== 0 || msg.stdout.trim() !== own.message.trim()) return;
    if (up && (await git(root, ['merge-base', '--is-ancestor', head, up])).code === 0) return;
  }
  if ((await git(root, ['rev-parse', '--verify', '--quiet', `${head}^`])).code === 0) {
    await git(root, ['reset', '-q', '--soft', `${head}^`]);
  } else {
    // The repository's first commit: back to "no commits yet", everything still staged (only if HEAD is unchanged).
    await git(root, ['update-ref', '-d', 'HEAD', head]);
  }
}

/** @param {SyncContext} ctx @param {number} [timeout] */
async function fetchRemote(ctx, timeout = NET_TIMEOUT) {
  const r = await git(ctx.root, ['fetch', '--quiet', '--end-of-options', /** @type {string} */ (ctx.state.remote)], { timeout });
  if (r.code !== 0) throw new SyncError(SYNC_CODES.fetchFailed, 'Could not fetch from the remote.', { detail: ctx.redact(output(r)) });
}

/**
 * The upstream commit to integrate (after a fetch), or undefined for a branch the remote does not have yet.
 * @param {SyncContext} ctx
 */
async function upstreamCommit(ctx) {
  const { root, state } = ctx;
  if (!state.upstream) {
    if (await remoteBranchExists(ctx)) throw new SyncError(SYNC_CODES.noUpstream, noUpstreamText(ctx));
    return undefined;
  }
  const r = await git(root, ['rev-parse', '--verify', '--quiet', '@{u}^{commit}']);
  return r.code === 0 ? r.stdout.trim() : undefined;
}

/** A rebase needs a clean index and work tree (tracked files): after our commit, anything left is outside content. */
async function ensureCleanTree(
  ctx,
  code = SYNC_CODES.outsideChanges,
  message = 'There are uncommitted changes outside the content folder; commit or undo them in the content repository first.',
) {
  const r = await git(ctx.top, ['status', '--porcelain=v1', '-z', '--untracked-files=no']);
  const files = parsePorcelainZ(r.stdout).map((e) => e.path);
  if (r.code !== 0 || files.length) throw new SyncError(code, message, { files });
}

/** @param {SyncContext} ctx */
async function abortRebase(ctx) {
  const r = await git(ctx.top, ['rebase', '--abort']);
  if (r.code !== 0) {
    throw new SyncError(SYNC_CODES.rebaseFailed, 'Could not undo a failed rebase. Run `git rebase --abort` in the content repository.', {
      detail: ctx.redact(output(r)),
      keepCommit: true,
    });
  }
}

/**
 * Rebases HEAD onto `up`. At every stop, files with a resolution are taken from our side ("mine": the commit we
 * started from) or the upstream ("theirs"). When a conflicting file has no resolution the rebase is aborted (the
 * repository is back where it started) and the conflicting files are returned. Keys of `resolutions` and of the
 * returned list are content-relative paths (repo-relative for files outside the content folder).
 * @param {SyncContext} ctx
 * @param {string} up
 * @param {Record<string, Resolution>} resolutions
 * @returns {Promise<{ conflicts?: string[] }>}
 */
async function rebaseOnto(ctx, up, resolutions) {
  const { top } = ctx;
  const tip = /** @type {string} */ (await headSha(top));
  const keyOf = (repoRel) => ctx.toContentRel(repoRel) ?? repoRel;
  let r = await git(top, ['rebase', '--no-autostash', up], { env: REBASE_ENV, timeout: NET_TIMEOUT });
  for (let step = 0; r.code !== 0; step++) {
    if (!(await operationInProgress(top))) {
      // Git refused to start (e.g. an untracked file would be overwritten): nothing changed.
      throw new SyncError(SYNC_CODES.rebaseFailed, 'git rebase failed.', { detail: ctx.redact(output(r)) });
    }
    if (step >= MAX_REBASE_STEPS) {
      await abortRebase(ctx);
      throw new SyncError(SYNC_CODES.rebaseFailed, 'git rebase did not finish.', { detail: ctx.redact(output(r)) });
    }
    const conflicted = await unmergedPaths(top);
    if (!conflicted.length) {
      // Stopped without conflicts: a commit became empty after the resolutions. Skipping it drops nothing.
      if ((await git(top, ['diff', '--cached', '--quiet'])).code === 0) {
        r = await git(top, ['rebase', '--skip'], { env: REBASE_ENV });
        continue;
      }
      const detail = ctx.redact(output(r));
      await abortRebase(ctx);
      throw new SyncError(SYNC_CODES.rebaseFailed, 'git rebase stopped unexpectedly.', { detail });
    }
    if (conflicted.some((p) => !resolutions[keyOf(p)])) {
      await abortRebase(ctx);
      return { conflicts: conflicted.map(keyOf).sort() };
    }
    for (const p of conflicted) {
      const source = resolutions[keyOf(p)] === 'mine' ? tip : up;
      const exists = (await git(top, ['cat-file', '-e', `${source}:${p}`])).code === 0;
      // `checkout <commit> -- <path>` only touches this conflicted path, whose content git itself just produced.
      const applied = exists
        ? await git(top, ['checkout', source, '--', p])
        : await git(top, ['rm', '-q', '--ignore-unmatch', '--', p]);
      if (applied.code !== 0) {
        const detail = ctx.redact(output(applied));
        await abortRebase(ctx);
        throw new SyncError(SYNC_CODES.rebaseFailed, 'Could not apply the chosen version.', { detail });
      }
    }
    r = await git(top, ['rebase', '--continue'], { env: REBASE_ENV });
  }
  return {};
}

/** True when a push failed because the remote moved (another push got in between). */
async function upstreamMoved(ctx, up) {
  try {
    await fetchRemote(ctx);
    return (await upstreamCommit(ctx)) !== up;
  } catch {
    return false;
  }
}

/**
 * The whole Publish flow. Returns a PublishResult (see src/storage/types.ts).
 * @param {SyncContext} ctx
 * `resolutions` only apply to the conflict they were chosen for: `upstream` must be the upstream commit that conflict
 * reported. When the remote moved on since, they are ignored and any conflict is reported (and asked) again.
 * @param {{ message: string, resolutions?: Record<string, Resolution>, upstream?: string }} options
 */
export async function publishSync(ctx, { message, resolutions = {}, upstream: resolvedAgainst }) {
  const { root, state } = ctx;
  const pre = await preflight(ctx);
  if (pre) return pre;
  const marked = await filesWithConflictMarkers(ctx);
  if (marked.length) {
    return fail(SYNC_CODES.conflictMarkers, 'Some files still contain conflict markers (<<<<<<< / >>>>>>>). Edit them, then publish again.', { files: marked });
  }

  /** @type {{ sha: string, message: string } | undefined} */
  let own;
  let up;
  try {
    own = await commitLocal(ctx, message);
    const commitUrl = (sha) => (sha && state.remoteUrl ? `${state.remoteUrl}/commit/${sha}` : undefined);

    if (!state.remote) {
      if (!own) return { ok: true, pushed: false, message: 'Nothing to publish: no changes in the content folder', code: 'nothing_to_publish' };
      return { ok: true, pushed: false, commitSha: own.sha, commitUrl: commitUrl(own.sha), message: 'Committed locally (no git remote configured)', code: 'committed_local' };
    }

    let pulled = 0;
    let retried = false;
    let fetched = false;
    for (let attempt = 1; ; attempt++) {
      if (!fetched) await fetchRemote(ctx);
      fetched = false;
      up = await upstreamCommit(ctx);
      const head = await headSha(root);
      if (up && head && (await count(root, `${head}..${up}`)) > 0) {
        await ensureCleanTree(ctx);
        pulled += await remoteChangedFiles(ctx, head, up);
        const rebased = await rebaseOnto(ctx, up, resolvedAgainst === up ? resolutions : {});
        if (rebased.conflicts) {
          await undoOwnCommit(ctx, own, up);
          return fail(SYNC_CODES.rebaseConflict, 'Your changes and the remote changed the same lines. Nothing was published or lost.', {
            conflicts: rebased.conflicts,
            upstream: up,
          });
        }
      }
      const tip = await headSha(root);
      const ahead = !tip ? 0 : up ? await count(root, `${up}..${tip}`) : 1;
      if (!ahead) {
        if (pulled) return { ok: true, pushed: false, pulled, message: 'Nothing new to publish; changes from the remote were pulled in.', code: SYNC_CODES.pulledOnly };
        return { ok: true, pushed: false, message: 'Nothing to publish: no changes in the content folder', code: 'nothing_to_publish' };
      }

      // `--end-of-options` and a full ref: a remote or branch name that starts with `-` is never read as an option.
      const pushArgs = state.upstream ? ['push'] : ['push', '-u', '--end-of-options', /** @type {string} */ (state.remote), `refs/heads/${state.branch}`];
      const p = await git(root, pushArgs, { timeout: NET_TIMEOUT });
      if (p.code === 0) {
        const base = { ok: true, pushed: true, commitSha: tip, commitUrl: commitUrl(tip), pulled, retried };
        return own ? base : { ...base, message: 'No new changes; pushed earlier commits', code: 'pushed_earlier' };
      }
      const detail = ctx.redact(output(p));
      if (up && (await upstreamMoved(ctx, up))) {
        if (attempt === 1) {
          retried = true;
          fetched = true;
          continue;
        }
        throw new SyncError(SYNC_CODES.pushRejected, 'The remote kept changing while publishing. Try again in a moment.', { detail });
      }
      throw new SyncError('push_failed', 'git push failed.', { detail });
    }
  } catch (e) {
    if (!(e instanceof SyncError)) {
      await undoOwnCommit(ctx, own, up).catch(() => {});
      throw e;
    }
    if (!e.keepCommit) await undoOwnCommit(ctx, own, up);
    return fail(e.code, e.message, { ...(e.detail ? { detail: e.detail } : {}), ...(e.files?.length ? { files: e.files } : {}) });
  }
}

/**
 * "Refresh" / "Sync now" without publishing: brings in the remote's commits. Fast-forwards when there are no local
 * commits (git refuses on its own when that would overwrite uncommitted work); rebases local commits otherwise,
 * which needs a clean tree. Conflicts abort the rebase. Throws SyncError.
 * @param {SyncContext} ctx
 * @returns {Promise<{ updated: number }>}
 */
export async function pullSync(ctx) {
  const { root, state } = ctx;
  if (!state.remote || !state.upstream || !state.hasHead) return { updated: 0 };
  const pre = await preflight(ctx);
  if (pre) throw new SyncError(pre.code, pre.error, { files: pre.files });
  await fetchRemote(ctx);
  const up = await upstreamCommit(ctx);
  const head = await headSha(root);
  if (!up || !head || (await count(root, `${head}..${up}`)) === 0) return { updated: 0 };
  const updated = await remoteChangedFiles(ctx, head, up);
  if ((await count(root, `${up}..${head}`)) === 0) {
    const r = await git(root, ['merge', '--ff-only', '--quiet', up]);
    if (r.code !== 0) {
      throw new SyncError(SYNC_CODES.localChanges, 'Your unpublished changes touch files the remote changed too. Publish them first; publishing merges both.', {
        detail: ctx.redact(output(r)),
      });
    }
    return { updated };
  }
  await ensureCleanTree(ctx, SYNC_CODES.localChanges, 'You have unpublished changes and local commits. Publish to merge them with the remote.');
  const rebased = await rebaseOnto(ctx, up, {});
  if (rebased.conflicts) {
    throw new SyncError(SYNC_CODES.rebaseConflict, 'Your changes and the remote changed the same lines. Publish to choose which version to keep.', {
      files: rebased.conflicts,
    });
  }
  return { updated };
}

/**
 * How far the branch is behind / ahead of its upstream after a fetch (for the "new changes on the remote" hint).
 * @param {SyncContext} ctx
 */
export async function remoteStatus(ctx) {
  const { root, state } = ctx;
  if (!state.remote || !state.upstream || !state.hasHead) return { behind: 0, ahead: 0 };
  // Short timeout: this runs in the background, and file writes wait for it (api.mjs serialises git work).
  await fetchRemote(ctx, BACKGROUND_FETCH_TIMEOUT);
  const up = await upstreamCommit(ctx);
  if (!up) return { behind: 0, ahead: 0 };
  return { behind: await count(root, `HEAD..${up}`), ahead: await count(root, `${up}..HEAD`) };
}

/**
 * "I'll edit it myself": writes the file with git conflict markers (`<<<<<<< mine` … `>>>>>>> remote`) merged from
 * the local version (the file as it is now), the upstream version and their common ancestor. Nothing is lost: the
 * local side is in the file. The user edits it and publishes again. Text files that exist on both sides only.
 * @param {SyncContext} ctx
 * @param {string} contentRel
 */
export async function writeConflictMarkers(ctx, contentRel) {
  const { top, state } = ctx;
  const unavailable = (why) => new SyncError(SYNC_CODES.mergeUnavailable, why);
  if (!state.upstream) throw unavailable('The branch has no upstream.');
  const up = await upstreamCommit(ctx);
  const head = await headSha(top);
  if (!up || !head) throw unavailable('The branch has no upstream.');
  const repoRel = ctx.toRepoRel(contentRel);
  const abs = await ctx.entryPath(contentRel);
  let mine;
  try {
    mine = await fs.readFile(abs, 'utf8');
  } catch {
    mine = null;
  }
  const theirs = await git(top, ['show', `${up}:${repoRel}`]);
  if (mine === null || theirs.code !== 0) throw unavailable('The file was deleted on one side; keep one of the versions instead.');
  if (mine.includes('\0') || theirs.stdout.includes('\0')) throw unavailable('This is not a text file; keep one of the versions instead.');
  const mb = await git(top, ['merge-base', head, up]);
  const base = mb.code === 0 ? await git(top, ['show', `${mb.stdout.trim()}:${repoRel}`]) : undefined;

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'hq-merge-'));
  try {
    const files = { mine: path.join(tmp, 'mine'), base: path.join(tmp, 'base'), theirs: path.join(tmp, 'theirs') };
    await fs.writeFile(files.mine, mine);
    await fs.writeFile(files.base, base?.code === 0 ? base.stdout : '');
    await fs.writeFile(files.theirs, theirs.stdout);
    const r = await git(tmp, ['merge-file', '-p', '-L', 'mine', '-L', 'base', '-L', 'remote', files.mine, files.base, files.theirs]);
    if (r.code < 0 || r.code > 127) throw unavailable(`git merge-file failed: ${ctx.redact(output(r))}`);
    const out = path.join(path.dirname(abs), `.${path.basename(abs)}.${process.pid}.${Date.now()}.tmp`);
    await fs.writeFile(out, r.stdout);
    await fs.rename(out, abs);
    return { ok: true, conflicts: r.code };
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}
