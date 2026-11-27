# Publishing: how commit and push work

Every edit you make is saved right away. **Publish** turns those saved edits into a git commit (and a push).

| | Local (`npm start`, `npm run dev`, desktop app) | PWA (static hosting, for example GitHub Pages) |
| --- | --- | --- |
| Where it runs | your computer, `127.0.0.1` only | any browser, also installed on a phone |
| Edits go to | files in your content folder, right away | drafts in the browser (IndexedDB) |
| Publish does | commit of the content folder, then (with a remote) `git fetch`, rebase onto the upstream and `git push` | one commit through the GitHub API with your token |
| Discard does | `git checkout` or removes new files, content folder only | drops the browser drafts |
| Refresh does | `git fetch`, then a fast-forward (or a rebase of local commits) | reloads from GitHub |
| Needs | git (and Node when run from source) | a GitHub token for your content repo |

## The Publish panel

Open it with `Mod+Shift+U`. It lists every unpublished change, suggests a commit message, and lets you discard changes
one by one.

## Local mode, step by step

1. Every edit in the app is written to `<HQ_ROOT>/<HQ_CONTENT_DIR>/...` immediately (autosave).
2. The panel shows `git status` for the content folder only. Files elsewhere in the repo (for example `CLAUDE.md` or
   `README.md`) are never staged or committed by the app.
3. **Publish** (`server/sync.mjs`) is a sync with the remote:
   1. *Preflight*: refuses while a rebase, merge, cherry-pick or revert is in progress, while files have unresolved
      conflicts, on a detached HEAD, and when the branch has no upstream although the remote has a branch of that name
      (a branch the remote does not have yet is pushed with `git push -u` and gets its upstream that way). It also
      refuses while a changed file still contains conflict markers.
   2. *Pending edits*: the panel flushes every editor first. Each editor write carries the SHA-256 of the text the
      editor last loaded (`X-HQ-Base-Hash`); when the file on disk is different (changed by Claude Code, another
      editor, a pull), the API answers `409 file_changed` and the editor asks *Use mine* / *Load the version on disk* /
      *Cancel*. Publishing stops while such an edit is held back. An editor closed with a held-back edit saves it next
      to the file as `<name>.unsaved-<date>.md`.
   3. *Commit*: `git add -A -- <content dir>` and `git commit -- <content dir>` with the message from the panel and a
      body listing the changed files (`M content/...`). Files outside the content folder are never committed.
   4. *Merge*: `git fetch <remote>`; when the upstream has new commits, `git rebase <upstream>` (it needs a clean tree,
      so uncommitted changes to tracked files outside the content folder stop it with `outside_changes`).
   5. *Conflicts*: the rebase is aborted (`git rebase --abort`) and the publish commit undone with `git reset --soft`
      (files untouched, changes unpublished again). The result lists the conflicting files (`rebase_conflict`). The
      panel then offers per file *Keep mine*, *Keep the remote one* (sent as `resolutions` together with the conflict's
      `upstream` commit; the next publish replays the rebase and takes that side at every stop, and ignores the choices
      if the remote moved on in the meantime, so an old choice never settles a new conflict) or *I'll edit it myself* (`POST /api/conflict-markers` writes the file
      with `git merge-file` markers; it is published as "mine" once the markers are gone).
   6. *Push*: when it is rejected because the remote moved meanwhile, fetch + rebase + push run once more
      (`retried: true`); a second rejection reports `push_rejected`.
   7. Any failure before the push lands (network, credentials, rejected push) undoes the publish commit the same way,
      so retrying Publish is always possible and nothing is lost. Without a remote it commits locally and says so.
4. File writes and deletes wait for running git operations, so nothing is written in the middle of a rebase.
5. `GET /api/remote-status` fetches and reports `{ behind, ahead }`; the top bar uses it (on start and on window
   focus, at most once a minute) to show "New changes on the remote" with **Sync now** (`POST /api/pull`).
6. Git always runs through argument arrays (never a shell), with literal pathspecs, and only inside the content folder.
   The app never runs `push --force`, `reset --hard`, `checkout -- .` or `clean`.

## Credentials and commit identity

- **The app never sees your credentials.** Publish runs your own `git` in the content folder, and git signs in the way
  it does in a terminal: through its credential helper (the macOS Keychain, Git Credential Manager, and so on) or your
  SSH key. No password or token passes through the app, the browser, or any file in this repo. The push goes to the
  content repo's own `origin`. Credentials embedded in a remote URL are masked in error messages.
- **Each commit carries your git name and email**, like any commit you make by hand. Make sure `user.name` and
  `user.email` are set. If the content repo is or becomes public, that email is visible in its history; set a GitHub
  `noreply` address as `user.email` in that repo first if you want to keep it private.

## PWA mode

Your edits are kept as drafts in that browser until you publish, and Publish makes one commit through the GitHub API. If
a file changed on GitHub since you last loaded it, you are shown the conflicting files and can choose to keep yours. To
load changes made elsewhere, use *Refresh* in the Publish panel. Setup is in [pwa.md](pwa.md).
