# OSS readiness report: project-hq

Date: 2026-11-26. Run unattended. Nothing was pushed, no remote was changed, and history was not rewritten.

## Summary

The repository was already close to ready for open source. The code contains no secrets, and the content location was
already configured through `.env.local` / `npm run setup` instead of being hard-coded. This pass did the following:

- added live refresh, so changes made outside the app show up (this is what the Claude Code workflow needs);
- fixed 5 security findings in the local publish flow;
- added `.env.example`, a hardened `.gitignore`, `SECURITY.md`, a `CLAUDE.md` template for content repositories and a rewritten README;
- moved the last hard-coded locale (`lang="tr"`) out of the code.

The one item you need to decide on before going public is your **personal email in the commit metadata** (see "Secrets and personal data").

## Commits (local, on `main`)

| Commit | What |
| --- | --- |
| `5cf556a` | Your uncommitted README / README.tr edits (the "local publishing and credentials" paragraph), committed as they were so nothing was lost. |
| `70575a1` | feat: pick up content changes made outside the app (`GET /api/stamp`, `useOutsideChanges`, `HQ_WATCH_INTERVAL_MS`) plus tests. |
| `73b3560` | feat(settings): show the absolute content folder path, with a copy button, in local mode; `index.html` and the PWA manifest now default to `lang=en`. |
| `1cc9a9d` | chore: `.env.example`; `.gitignore` now covers `.env*`, keys and certificates, Firebase and service-account JSON, coverage and logs. |
| `3e43030` | fix(security): anti-framing, symlink handling, push option injection, credential redaction, URL normalization (all with tests). |
| `97de878` | feat(setup): `templates/content-repo/CLAUDE.md`, which `npm run setup` copies into new content repos (`--claude-md` / `--no-claude-md`). |
| `5e240ff` | docs: README rewrite, SECURITY.md, CONTRIBUTING and ARCHITECTURE updates, Turkish README sections on configuration and Claude Code. |

## Hard-coded values

A full scan of `src/`, `server/`, `scripts/`, `content/`, `.github/`, `index.html` and `vite.config.ts` found:

- no personal emails;
- no `/Users/...` paths;
- no real AdMob, Play or App Store identifiers (the demo content uses `ca-app-pub-0000000000000000…` and `com.example.*`);
- no token or API base URL besides `api.github.com`.

| Value | Where it was | Where it is configured now |
| --- | --- | --- |
| `project-hq-content` (content repo) | Only a *suggested default* folder name in `scripts/setup-lib.mjs` (`DEFAULT_FOLDER_NAME`). Nothing in the app hard-codes it. | Chosen by the user in `npm run setup` (interactive prompt or `--dir`) and stored as `HQ_ROOT` in `.env.local` / the environment. The app shows the active path under **Settings → Local repository**. Kept as the suggested default. |
| `lang="tr"` | `index.html:2`, PWA manifest `vite.config.ts` | Default is now `en`. At runtime the language still comes from the saved choice or the browser language (`src/i18n`). |
| Content folder name `content` | `server/env.mjs` default | `HQ_CONTENT_DIR` (already existed; now documented). |
| Port `4173` | `server/env.mjs` default | `PORT` (already existed; now documented). |
| Poll interval for outside changes | new | `HQ_WATCH_INTERVAL_MS` (default 3000, 0 = off). |
| GitHub repo / branch for the PWA | `VITE_HQ_REPO`, `VITE_HQ_BRANCH` (already existed) | Documented in `.env.example` / README. In CI they come from the Actions variables `HQ_CONTENT_REPO` / `HQ_CONTENT_BRANCH`. |
| Repo, owner, branch and token for GitHub mode | already in-app | Settings → GitHub connection (browser `localStorage`). |
| Store and AdMob ids, package names, console URLs, code repo links | already in-app | Per project in `project.json` in the user's content repo (Overview / Stores / Ads / Links tabs). |

**Kept on purpose:**

- `https://github.com/EngincanV/project-hq` appears in `package.json`, the README clone command, the CI badge and the
  `CLAUDE.md` template. This is the canonical upstream URL, not user configuration.
- `© Engincan Veske` in LICENSE and README is the MIT copyright line.
- Generic vendor console URLs (play.google.com/console, appstoreconnect.apple.com, admob.google.com, and so on) are
  defaults that users override per project.
- The `127.0.0.1` / localhost bind and host allow-list are fixed on purpose for security.

## Secrets and personal data

Tools used:

- `gitleaks git` over the full history (3 original commits);
- `gitleaks dir` over the working tree;
- `trufflehog git file://.`;
- a manual `git log -p --all` grep for the patterns `ghp_`, `github_pat_`, `AKIA`, `AIza`, `sk-`, `xox`, `BEGIN … PRIVATE KEY`, `private_key`, `client_secret`, `password`, real `ca-app-pub` ids, emails and home paths;
- a check of the 6 screenshots in `docs/screenshots`.

**Result: no secrets in the current code or in history.**

| # | Finding | Location | Type | Action |
| --- | --- | --- | --- | --- |
| 1 | Your personal email (`engi…@gmail.com`) is the author and committer address | Commits `290a01e`, `94ad27e`, `1be8966` (and the 7 new local commits, which use your global git identity) | Personal data, not a credential | **Decide before publishing.** Either accept it, or rewrite the author email to your `<id>+EngincanV@users.noreply.github.com` address (for example with `git filter-repo --mailmap`) before the first public push. Then set `git config user.email` to the noreply address and turn on GitHub's "Block command line pushes that expose my email". |
| 2 | `.env.local` on disk with `HQ_ROOT=../project-hq-content` | Working tree, git-ignored, never committed | Local config, not secret | None. |
| 3 | `.hallmark/salt` | Working tree, git-ignored | Tool file | Keep it ignored. |
| 4 | Test fixtures such as `github_pat_x` / `github_pat_abc` and `you@example.com` | `src/features/settings/*.test.tsx`, `scripts/setup.mjs` | Fake values | None. |

There is no secret to rotate.

## Security fixes (from the security audit)

| Severity | Issue | Fix |
| --- | --- | --- |
| Medium | Another site could frame `http://127.0.0.1:4173` and trick the user into clicking Publish, Discard or Delete (clickjacking). | `X-Frame-Options: DENY` plus `frame-ancestors 'none'` from `npm start`; `X-Frame-Options` from the dev and preview server; `src/main.tsx` refuses to start inside a frame (covers GitHub Pages). |
| Low | Write, delete and discard followed symlinks: deleting a link deleted its target, and `DELETE path=<link to .>&dir=1` could delete the content folder. Links into `.git` were possible when `HQ_CONTENT_DIR=.`. | `resolveEntry()` resolves only the parent folder, so the link itself is replaced or removed. Resolved paths may not enter dot-folders. |
| Low | Remote or branch names starting with `-` could inject options into `git push -u`. | `git push -u --end-of-options <remote> refs/heads/<branch>`. |
| Info | Git error output could carry `https://user:token@…` to the UI. | `redactCredentials()` on every git or error message the API returns. |
| Info | `normalizeGitHubUrl` accepted query strings, for example `?access_token=`. | The owner and repo groups now exclude `?` and `#`. |

Mitigations the audit confirmed were already in place:

- git runs through argument arrays, never a shell, with literal pathspecs;
- cross-site requests and DNS rebinding are blocked on the API;
- the API sends no CORS headers;
- content files are served with a sandbox CSP;
- the token is only ever sent to `api.github.com`;
- Markdown and SVG are sanitized;
- GitHub Actions are pinned to SHAs and use least privilege.

## Claude Code workflow

The flow you described needed one missing piece: the app did not notice files changed by other tools until the next in-app action or a reload. What was added:

- **Live refresh (local mode).** `GET /api/stamp` returns a fingerprint of the content folder: each file's path, size and mtime, plus `HEAD`. The app polls it every `HQ_WATCH_INTERVAL_MS` while visible and on window focus, then re-reads.
  - Open editors take the new text unless they hold unsaved typing.
  - New commits and `git pull` are detected too.
- **Content folder path in Settings**, with a copy button, for `claude --add-dir <path>`.
- **`CLAUDE.md` template** for content repos, describing the layout, the roadmap, plan and `project.json` formats, and the agent rules (no secrets, small edits, let the user publish). `npm run setup` adds it by default.
- **README section** covering setup, workflow A (Claude Code in the app's code repo, using `--add-dir` to reach the content repo), workflow B (Claude Code in the content repo), and a table of what is and isn't supported.

What it does not do yet (documented in the README):

- no live refresh in PWA mode;
- the app does not read the code repository (commits, PRs);
- the same file edited in both places at the same moment is last-write-wins.

## Build and test results

Final run, after all changes, on Node v26.13.1:

| Check | Result |
| --- | --- |
| `npm run typecheck` | ✅ pass |
| `npm test` | ✅ 44 files, **472 tests passed** (baseline was 42 files / 456 tests; 16 tests added) |
| `npm run build` | ✅ pass. One warning: main chunk 1,147 kB (395 kB gzip), over Vite's 500 kB advice. |
| Lint | No lint script exists (TypeScript strict is the gate). None added. |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npm audit` (incl. dev) | 4 moderate, in build-time dependencies only: `glob` and `minimatch` via `vite-plugin-pwa` → `workbox-build`. Nothing in the shipped code. |
| gitleaks re-scan after changes | no leaks |
| Manual smoke test | `npm start` against a temp content repo: `/api/health` reports `contentPath` and `watchIntervalMs`, the framing headers are present, and `/api/stamp` changed after an outside file write. `npm run setup --dir … --yes` in a temp copy created the repo, the `CLAUDE.md` and `HQ_ROOT`. |

## Decisions I made for you

1. **Committed your pending README edits** as their own first commit instead of leaving them uncommitted or folding them into mine.
2. **Kept `project-hq-content` as the suggested default name** in `npm run setup`. It is not hard-coded anywhere the user cannot change: they choose the path in setup and it lives in `.env.local`.
3. **Did not build a "change content folder" control in the browser UI.** It would let the browser re-point the server at any directory on disk at runtime, which is a riskier API than this release needs. Instead, Settings shows the active path and tells the user to re-run `npm run setup`.
4. **Polling instead of `fs.watch`.** It works the same on macOS, Linux and Windows, uses no dependencies, and can be turned off with `HQ_WATCH_INTERVAL_MS=0`.
5. **Did not make roadmap and planner actions re-read the file before writing.** Their operations address cards by position, so applying them to text that changed underneath could edit the wrong card. I documented last-write-wins instead.
6. **Kept the existing real screenshots.** They show only fictional demo data. I added a commented placeholder block for future Publish and Settings screenshots.
7. **Default UI document language is `en`.** Turkish users still get Turkish automatically from the browser language.
8. **Did not delete dead code or unused message keys** that the audit found, because of your rule against removing features. They are listed below.
9. **SECURITY.md points to GitHub private vulnerability reporting**, not an email address, to avoid publishing your address.
10. **Did not apply `npm audit fix --force`.** It would downgrade `workbox-build` (a breaking change) for a build-time-only, moderate issue.

## Left for you before going public

- [ ] **Commit email:** decide on finding #1. Rewriting it means a history rewrite, which I did not do.
- [ ] Turn on **private vulnerability reporting** (Settings → Code security), which SECURITY.md relies on, and optionally secret scanning and push protection.
- [ ] Review the README wording, then push. CI should pass; the Pages deploy skips itself until Pages is turned on.
- [ ] Optional: add `publish.png` and `settings-local.png` screenshots (placeholder block in the README).
- [ ] Optional follow-ups the audits found (none block the release):
  - Code-split the 1.1 MB main bundle (`React.lazy` per route).
  - `/p/:slug/stores` and `/p/:slug/ads` still render when those modules are turned off; only the tab is hidden. The unused keys `storesOff` / `disabledTitle` suggest a "module off" state was planned.
  - Unused i18n keys: `dashboard.openProject`, `overview.storesOff`, `planner.editItem`, `publish.refreshing`, `roadmap.dropHere`, `stores.disabledTitle`.
  - Exports nothing uses: `useFileList` (`src/data/files.ts`), `clearGitHubSettings` (`src/storage/githubSettings.ts`), `isHexColor` (`src/features/project-shared/colors.ts`).
  - `src/features/publish/useChanges.ts` reloads on focus, which the new focus check now duplicates (harmless).
  - The app's own autosaves change the stamp, which causes one extra re-read about 3 s later (harmless, a small cost).
  - On a GitHub Pages *project* site the token is only warned about. You could block saving it there.
  - `.nvmrc` says 24 while you develop on 26 (both are allowed by `engines`).
  - Test PWA publishing against real github.com (so far only tested against the simulated GitHub).
