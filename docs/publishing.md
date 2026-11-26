# Publishing: how commit and push work

Every edit you make is saved right away. **Publish** turns those saved edits into a git commit (and a push).

| | Local (`npm start`, `npm run dev`, desktop app) | PWA (static hosting, for example GitHub Pages) |
| --- | --- | --- |
| Where it runs | your computer, `127.0.0.1` only | any browser, also installed on a phone |
| Edits go to | files in your content folder, right away | drafts in the browser (IndexedDB) |
| Publish does | `git add` and `git commit` of the content folder, then `git push` if the repo has a remote | one commit through the GitHub API with your token |
| Discard does | `git checkout` or removes new files, content folder only | drops the browser drafts |
| Refresh does | `git pull --ff-only` | reloads from GitHub |
| Needs | git (and Node when run from source) | a GitHub token for your content repo |

## The Publish panel

Open it with `Mod+Shift+U`. It lists every unpublished change, suggests a commit message, and lets you discard changes
one by one.

## Local mode, step by step

1. Every edit in the app is written to `<HQ_ROOT>/<HQ_CONTENT_DIR>/...` immediately (autosave).
2. The panel shows `git status` for the content folder only. Files elsewhere in the repo (for example `CLAUDE.md` or
   `README.md`) are never staged or committed by the app.
3. **Publish** runs `git add -A -- <content dir>`, `git commit -m <message> -- <content dir>`, then `git push` (or
   `git push -u <remote> <branch>` the first time). Without a remote it commits locally and says so. If the push fails,
   the commit stays and the next Publish pushes it.
4. Git always runs through argument arrays (never a shell), with literal pathspecs, and only inside the content folder.

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
